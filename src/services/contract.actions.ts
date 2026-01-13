import mongoose from 'mongoose';
import crypto from 'crypto';
import { Contract } from '../models/contract.model';
import { ContractParty } from '../models/contractParty.model';
import { Property } from '../models/property.model';
import { User } from '../models/user.model';
import {
  encryptIBAN,
  decryptIBAN,
  createCustomerAndMandate,
  createPaymentIntent,
} from '../utils/payment';
import { recordContractHistory } from '../utils/history';
import { sendContractCreatedEmail } from '../utils/email';
import { normalizeRegion, resolveClauses, type ClauseInput, type ResolvedClause } from './clauses.service';
import { evaluateAndPersist } from '../modules/rentalPublic';

interface CreateContractParams {
  tenantId: mongoose.Types.ObjectId | string;
  landlordId?: mongoose.Types.ObjectId | string;
  propertyId: mongoose.Types.ObjectId | string;
  rent: number;
  deposit: number;
  startDate: Date;
  endDate: Date;
  iban?: string;
  region?: string;
  clauses?: ClauseInput[];
  resolvedClauses?: ResolvedClause[];
}

export const createContractAction = async (params: CreateContractParams) => {
  const {
    tenantId,
    landlordId,
    propertyId,
    rent,
    deposit,
    startDate,
    endDate,
    iban,
    region,
    clauses,
    resolvedClauses,
  } = params;

  const toObjectId = (value: mongoose.Types.ObjectId | string, field: string) => {
    if (value instanceof mongoose.Types.ObjectId) {
      return value;
    }
    if (typeof value === 'string' && mongoose.Types.ObjectId.isValid(value)) {
      return new mongoose.Types.ObjectId(value);
    }
    throw new Error(`${field} debe ser un ObjectId válido`);
  };

  const tenantObjectId = toObjectId(tenantId, 'tenant');
  const propertyObjectId = toObjectId(propertyId, 'property');

  const property = await Property.findById(propertyObjectId).catch(() => null);

  let landlordObjectId: mongoose.Types.ObjectId | undefined;
  if (landlordId) {
    landlordObjectId = toObjectId(landlordId, 'landlord');
  } else if (property?.owner) {
    landlordObjectId = property.owner as mongoose.Types.ObjectId;
  }

  if (!landlordObjectId) {
    throw new Error('No se pudo determinar el arrendador del contrato');
  }

  const now = new Date();
  const activeConflict = await Contract.findOne({
    property: propertyObjectId,
    status: 'active',
    $or: [
      { endDate: { $exists: false } },
      { endDate: null },
      { endDate: { $gte: now } },
    ],
  }).lean();
  if (activeConflict) {
    throw new Error('La propiedad ya tiene un contrato activo vigente');
  }

  const normalizedRegion = normalizeRegion(region ?? undefined) ?? 'general';

  let parsedClauses: ResolvedClause[] = [];
  if (Array.isArray(resolvedClauses) && resolvedClauses.length > 0) {
    parsedClauses = resolvedClauses;
  } else if (normalizedRegion !== 'general' && Array.isArray(clauses)) {
    parsedClauses = resolveClauses(normalizedRegion, clauses);
  }

  const startAt = startDate instanceof Date ? startDate : new Date(startDate);
  const endAt = endDate instanceof Date ? endDate : new Date(endDate);

  // Compose a new contract document.
  const newContractData: any = {
    landlord: landlordObjectId,
    tenant: tenantObjectId,
    property: propertyObjectId,
    rent,
    deposit,
    startDate: startAt,
    endDate: endAt,
    region: normalizedRegion,
    status: 'draft',
    clauses: parsedClauses.map(clause => ({
      id: clause.id,
      label: clause.label,
      version: clause.version,
      params: clause.params,
      text: clause.text,
      scope: clause.scope,
    })),
  };

  if (iban) {
    try {
      newContractData.ibanEncrypted = encryptIBAN(iban);
    } catch (encErr) {
      const message = (encErr as any)?.message || String(encErr);
      throw new Error(`Error al encriptar el IBAN: ${message}`);
    }
  }

  const contract = new Contract(newContractData);

  // Generate hash for PDF consistency check
  const pdfPayload = {
    landlord: String(contract.landlord),
    tenant: String(contract.tenant),
    property: String(contract.property),
    region: contract.region,
    rent: contract.rent,
    deposit: contract.deposit,
    startDate: contract.startDate.toISOString(),
    endDate: contract.endDate.toISOString(),
    clauses: contract.clauses.map(c => ({ id: c.id, text: c.text, params: c.params })),
  };

  const pdfHash = crypto.createHash('sha256').update(JSON.stringify(pdfPayload)).digest('hex');
  contract.pdfHash = pdfHash;
  contract.pdf = {
    ...(contract.pdf ?? {}),
    sha256: pdfHash,
    generatedAt: new Date(),
  };

  await contract.save();

  const tenantUser = await User.findById(tenantObjectId).select('email').lean();
  if (tenantUser?.email) {
    await ContractParty.create({
      contractId: contract._id,
      role: 'TENANT',
      userId: tenantObjectId,
      email: tenantUser.email,
      status: 'JOINED',
    }).catch(() => {});
  }

  // Record history entry for creation
  await recordContractHistory(contract.id, 'created', 'Contrato creado');

  // Send notifications
  try {
    const landlord = await User.findById(contract.landlord);
    const tenant = await User.findById(contract.tenant);
    if (landlord?.email) {
      await sendContractCreatedEmail(landlord.email, contract.id);
    }
    if (tenant?.email) {
      await sendContractCreatedEmail(tenant.email, contract.id);
    }
  } catch (notifyErr) {
    console.error('Error enviando notificaciones:', notifyErr);
  }

  try {
    await evaluateAndPersist(contract.id, {
      changeDate: contract.startDate,
      reason: 'contract_created',
      source: 'system',
    });
  } catch (complianceErr) {
    console.error('Error evaluando compliance Rental Public:', {
      contractId: contract.id,
      message: (complianceErr as any)?.message,
      stack: (complianceErr as any)?.stack,
    });
  }

  return contract;
};

export const signContractAction = async (contractId: string, user: { id: string; role: string }) => {
  const contract = await Contract.findById(contractId);
  if (!contract) {
    throw new Error('Contrato no encontrado');
  }

  // Validar que el contrato se pueda firmar
  if (['active', 'completed', 'cancelled', 'terminated'].includes(contract.status)) {
    throw new Error(`No se puede firmar un contrato en estado ${contract.status}`);
  }

  if (!user) {
    throw new Error('Autenticación requerida');
  }

  let actionLabel = '';
  // Determine who is signing based on the user's role
  if (user.role === 'tenant') {
    const party = await ContractParty.findOne({
      contractId: contract._id,
      role: 'TENANT',
      userId: user.id,
      status: { $in: ['JOINED', 'SIGNED'] },
    });
    if (!party) {
      if (String(contract.tenant) !== String(user.id)) {
        throw new Error('No estás autorizado para firmar este contrato');
      }
      contract.signedByTenant = true;
      actionLabel = 'signedByTenant';
      const u = await User.findById(user.id).select('email').lean();
      if (u?.email) {
        await ContractParty.create({
          contractId: contract._id,
          role: 'TENANT',
          userId: user.id,
          email: u.email,
          status: 'SIGNED',
          signedAt: new Date(),
        }).catch(() => {});
      }
    } else {
      if (party.status === 'SIGNED') {
        throw new Error('Este inquilino ya ha firmado el contrato');
      }
      party.status = 'SIGNED';
      party.signedAt = new Date();
      await party.save();
      actionLabel = 'signedByTenant';
    }
  } else if (user.role === 'landlord') {
    if (contract.signedByLandlord) {
      throw new Error('El arrendador ya ha firmado este contrato');
    }
    contract.signedByLandlord = true;
    actionLabel = 'signedByLandlord';
  } else {
    throw new Error('Rol no autorizado para firmar');
  }

  const tenants = await ContractParty.find({ contractId: contract._id, role: 'TENANT' });
  const allTenantsSigned = tenants.length === 0 ? !!contract.signedByTenant : tenants.every(t => t.status === 'SIGNED');
  if (allTenantsSigned) {
    contract.signedByTenant = true;
  }

  // Actualización de Estado
  if (contract.signedByTenant && contract.signedByLandlord) {
    contract.signedAt = new Date();
    contract.status = 'signed';
  } else {
    contract.status = 'signing';
  }

  await contract.save();

  // Record history entry
  await recordContractHistory(contract.id, actionLabel, `Contrato firmado por ${user.role}`);

  // Notify the other party
  try {
    const landlord = await User.findById(contract.landlord);
    const tenant = await User.findById(contract.tenant);
    if (user.role === 'tenant' && landlord?.email) {
      await sendContractCreatedEmail(landlord.email, contract.id);
    } else if (user.role === 'landlord' && tenant?.email) {
      await sendContractCreatedEmail(tenant.email, contract.id);
    }
  } catch (notifyErr) {
    console.error('Error enviando notificaciones de firma:', notifyErr);
  }

  return contract;
};

export const initiatePaymentAction = async (
  contractId: string,
  amount: number | undefined,
  user: { id: string; role: string },
) => {
  const contract = await Contract.findById(contractId);
  if (!contract) {
    throw new Error('Contrato no encontrado');
  }

  if (user.role !== 'tenant' || String(contract.tenant) !== user.id) {
    throw new Error('Solo el inquilino puede iniciar pagos');
  }

  let customerId = contract.stripeCustomerId;

  // Si no hay cliente de Stripe, intentar crearlo con el IBAN encriptado
  if (!customerId) {
    if (!contract.ibanEncrypted) {
      throw new Error('El contrato no tiene un IBAN asociado y no existe cliente de pago');
    }
    let iban: string;
    try {
      iban = decryptIBAN(contract.ibanEncrypted);
    } catch (decErr) {
      const message = (decErr as any)?.message || String(decErr);
      throw new Error(`No se pudo descifrar el IBAN: ${message}`);
    }

    const tenant = await User.findById(contract.tenant);
    if (!tenant) {
      throw new Error('Inquilino no encontrado para procesar pago');
    }

    customerId = await createCustomerAndMandate(tenant.name || 'Inquilino', tenant.email, iban);
    contract.stripeCustomerId = customerId;
    await contract.save();
  }

  const payAmount = typeof amount === 'number' && amount > 0 ? amount : contract.rent;

  // Crear el intento de pago
  const paymentIntent = await createPaymentIntent(customerId, payAmount, 'eur');

  await recordContractHistory(contract.id, 'paymentInitiated', `Pago iniciado por €${payAmount}`);

  return paymentIntent.client_secret;
};
