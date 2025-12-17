import { Contract } from '../models/contract.model';
import { recordContractHistory } from '../utils/history';
import { v4 as uuidv4 } from 'uuid';

export interface SignatureInitResult {
  signUrl: string;
  envelopeId: string;
  provider: string;
}

export const initSignature = async (contractId: string, userId?: string): Promise<SignatureInitResult> => {
  const provider = (process.env.SIGN_PROVIDER || 'mock').toLowerCase();
  const contract = await Contract.findById(contractId);
  if (!contract) {
    throw Object.assign(new Error('contract_not_found'), { status: 404 });
  }

  const envelopeId = contract.signature?.envelopeId || uuidv4();
  const signUrl = provider === 'mock'
    ? `https://example.com/sign/${envelopeId}`
    : `https://sign-provider/${envelopeId}`;

  contract.signature = {
    ...(contract.signature || {}),
    provider: provider as any,
    envelopeId,
    status: 'created',
    updatedAt: new Date(),
  };
  await contract.save();
  if (userId) {
    await recordContractHistory(contractId, 'SIGNATURE_INITIATED', userId, { provider, envelopeId });
  }
  return { signUrl, envelopeId, provider };
};

export const getSignatureStatus = async (contractId: string) => {
  const contract = await Contract.findById(contractId).lean();
  if (!contract) {
    throw Object.assign(new Error('contract_not_found'), { status: 404 });
  }
  return contract.signature || { status: 'none' };
};
