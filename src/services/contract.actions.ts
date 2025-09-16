import mongoose from 'mongoose';
import crypto from 'crypto';
import { Contract } from '../models/contract.model';
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
  } else if (property?.ownerId) {
    landlordObjectId = property.ownerId as mongoose.Types.ObjectId;
  }

  if (!landlordObjectId) {
    throw new Error('No se pudo determinar el arrendador del contrato');
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

  // Compose a new contract document. Optionally encrypt and store the IBAN
  const newContractData: any = {
    landlord: landlordObjectId,
    tenant: tenantObjectId,
    property: propertyObjectId,
    rent,
    deposit,
    startDate: startAt,
    endDate: endAt,
    region: normalizedRegion,
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

  // Record history entry for creation
  await recordContractHistory(contract.id, 'created', 'Contrato creado');

  // After saving the contract we can send notification emails to landlord and tenant.
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
    // Log and proceed; email errors should not block the response
    console.error('Error enviando notificaciones:', notifyErr);
  }

  return contract;
};

export const signContractAction = async (contractId: string, user: { id: string; role: string }) => {
  const contract = await Contract.findById(contractId);
  if (!contract) {
    throw new Error('Contrato no encontrado');
  }

  if (!user) {
    throw new Error('Autenticación requerida');
  }

  let actionLabel = '';
  // Determine who is signing based on the user's role
  if (user.role === 'tenant') {
    if (contract.signedByTenant) {
      throw new Error('El inquilino ya ha firmado este contrato');
    }
    contract.signedByTenant = true;
    actionLabel = 'signedByTenant';
  } else if (user.role === 'landlord') {
    if (contract.signedByLandlord) {
      throw new Error('El arrendador ya ha firmado este contrato');
    }
    contract.signedByLandlord = true;
    actionLabel = 'signedByLandlord';
  } else {
    throw new Error('Rol no autorizado para firmar');
  }

  // If both parties have signed, set or update signedAt to now and activate
  if (contract.signedByTenant && contract.signedByLandlord) {
    contract.signedAt = new Date();
    // When both have signed, mark the contract as active
    contract.status = 'active';
  }
  await contract.save();

  // Record history entry
  await recordContractHistory(contract.id, actionLabel, `Contrato firmado por ${user.role}`);

  // Notify the other party that the contract has been signed
  try {
    const landlord = await User.findById(contract.landlord);
    const tenant = await User.findById(contract.tenant);
    // Determine which party should be notified
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

export const initiatePaymentAction = async (contractId: string, amount: number | undefined, user: { id: string; role: string }) => {
  const contract = await Contract.findById(contractId);
  if (!contract) {
    throw new Error('Contrato no encontrado');
  }

  if (user.role !== 'tenant' || String(contract.tenant) !== user.id) {
    throw new Error('Solo el inquilino puede iniciar pagos');
  }

  let customerId = contract.stripeCustomerId;
  if (!customerId) {
    if (!contract.ibanEncrypted) {
      throw new Error('El contrato no tiene un IBAN asociado');
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
      throw new Error('Inquilino no encontrado');
    }
    customerId = await createCustomerAndMandate(tenant.name, tenant.email, iban);
    contract.stripeCustomerId = customerId;
    await contract.save();
  }

  const payAmount = typeof amount === 'number' && amount > 0 ? amount : contract.rent;
  const paymentIntent = await createPaymentIntent(customerId, payAmount, 'eur');
  await recordContractHistory(contract.id, 'paymentInitiated', `Pago iniciado por €${payAmount / 1}`);

  return paymentIntent.client_secret;
};
