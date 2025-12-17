import { Contract } from '../models/contract.model';
import { recordContractHistory } from '../utils/history';
import { v4 as uuidv4 } from 'uuid';

export interface SignatureInitResult {
  envelopeId: string;
  provider: string;
  recipientUrls: { landlordUrl?: string; tenantUrl?: string };
  status: string;
}

export const initSignature = async (contractId: string, userId?: string): Promise<SignatureInitResult> => {
  const provider = (process.env.SIGN_PROVIDER || 'mock').toLowerCase();
  const contract = await Contract.findById(contractId);
  if (!contract) {
    throw Object.assign(new Error('contract_not_found'), { status: 404 });
  }

  // En un entorno real, aquí iría la llamada al proveedor (Docusign/Signaturit)
  // para generar los URLs personalizados para cada parte.
  const envelopeId = contract.signature?.envelopeId || uuidv4();
  const recipientUrls = {
    landlordUrl: `https://sign.example.com/${envelopeId}?role=landlord`,
    tenantUrl: `https://sign.example.com/${envelopeId}?role=tenant`,
  };

  contract.signature = {
    ...(contract.signature || {}),
    provider: provider as any,
    envelopeId,
    status: 'sent',
    updatedAt: new Date(),
  };
  await contract.save();
  if (userId) {
    await recordContractHistory(contractId, 'SIGNATURE_INITIATED', userId, { provider, envelopeId });
  }
  return { envelopeId, provider, recipientUrls, status: 'sent' };
};

export const getSignatureStatus = async (contractId: string) => {
  const contract = await Contract.findById(contractId).lean();
  if (!contract) {
    throw Object.assign(new Error('contract_not_found'), { status: 404 });
  }
  return contract.signature || { status: 'none' };
};
