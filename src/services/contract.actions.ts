import mongoose from 'mongoose';
import { Contract } from '../models/contract.model';
import { Property } from '../models/property.model';
import { User } from '../models/user.model';
import { encryptIBAN } from '../utils/payment';
import { recordContractHistory } from '../utils/history';
import { sendContractCreatedEmail } from '../utils/email';

interface CreateContractParams {
  tenantId: mongoose.Types.ObjectId;
  propertyId: mongoose.Types.ObjectId;
  rent: number;
  deposit: number;
  startDate: Date;
  endDate: Date;
  iban?: string;
}

export const createContractAction = async (params: CreateContractParams) => {
  const { tenantId, propertyId, rent, deposit, startDate, endDate, iban } = params;

  // Ensure the property exists
  const property = await Property.findById(propertyId);
  if (!property) {
    throw new Error('Propiedad no encontrada');
  }

  // Compose a new contract document. Optionally encrypt and store the IBAN
  const newContractData: any = {
    landlord: property.ownerId,
    tenant: tenantId,
    property: propertyId,
    rent,
    deposit,
    startDate,
    endDate,
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
  await contract.save();

  // Record history entry for creation
  await recordContractHistory(contract.id, 'created', 'Contrato creado');

  // After saving the contract we can send notification emails to landlord and tenant.
  try {
    const landlord = await User.findById(property.ownerId);
    const tenant = await User.findById(tenantId);
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
