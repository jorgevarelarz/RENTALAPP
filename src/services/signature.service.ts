import { randomUUID } from 'crypto';
import { Contract } from '../models/contract.model';
import { recordContractHistory } from '../utils/history';
import { User } from '../models/user.model';
import { getCatalogByRegion } from '../policies/clauses';
import { generateContractPDF } from '../utils/pdfGenerator';
import { firmaProvider } from '../signature/firma';

export interface SignatureInitResult {
  envelopeId: string;
  provider: string;
  recipientUrls: { landlordUrl?: string; tenantUrl?: string };
  status: string;
}

export const initSignature = async (contractId: string, userId?: string): Promise<SignatureInitResult> => {
  const provider = (process.env.SIGN_PROVIDER || 'mock').toLowerCase();
  if (process.env.NODE_ENV === 'production' && provider === 'mock') {
    throw Object.assign(new Error('signature_mock_not_allowed_in_prod'), { status: 403 });
  }
  const contract = await Contract.findById(contractId);
  if (!contract) {
    throw Object.assign(new Error('contract_not_found'), { status: 404 });
  }

  if (provider === 'firma') {
    const result = await ensureFirmaSignature(contract);
    if (userId && result.created) {
      await recordContractHistory(contractId, 'SIGNATURE_INITIATED', userId, { provider, envelopeId: result.envelopeId });
    }
    return { envelopeId: result.envelopeId, provider, recipientUrls: result.recipientUrls, status: 'sent' };
  }

  // En un entorno real, aquí iría la llamada al proveedor (Docusign/Signaturit)
  // para generar los URLs personalizados para cada parte.
  const envelopeId = contract.signature?.envelopeId || randomUUID();
  const recipientUrls = {
    landlordUrl: `https://sign.example.com/${envelopeId}?role=landlord`,
    tenantUrl: `https://sign.example.com/${envelopeId}?role=tenant`,
  };

  contract.signature = {
    ...(contract.signature || {}),
    provider: provider as any,
    envelopeId,
    recipientUrls,
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
  if (!contract.signature) return { status: 'none' };
  if (contract.signature.status !== 'completed') {
    return contract.signature;
  }
  return { status: contract.signature.status, pdfUrl: contract.signature.pdfUrl };
};

const renderClauses = (contract: any): string[] => {
  const catalog = contract.region ? getCatalogByRegion(contract.region) : null;
  if (!Array.isArray(contract.clauses)) return [];
  return contract.clauses.map((clause: any) => {
    const definition = (catalog as any)?.[clause.id];
    if (definition) {
      try {
        return `• ${definition.label}\n${definition.render(clause.params ?? {})}`;
      } catch (err) {
        console.error('Error renderizando cláusula para firma:', err);
      }
    }
    const paramsText = clause?.params ? JSON.stringify(clause.params) : '';
    return paramsText ? `• ${clause.id}\n${paramsText}` : `• ${clause.id}`;
  });
};

/**
 * Firma.dev: un único sobre para arrendador e inquilino. Si el contrato ya tiene uno en curso,
 * se reutiliza (cada sobre enviado cuesta 0,049 €), así que llamar varias veces es seguro.
 */
export const ensureFirmaSignature = async (contract: any) => {
  const current = contract.signature;
  if (current?.provider === 'firma' && current?.envelopeId && ['sent', 'created'].includes(String(current.status))) {
    return { envelopeId: current.envelopeId as string, recipientUrls: current.recipientUrls || {}, created: false };
  }

  const [landlord, tenant] = await Promise.all([User.findById(contract.landlord), User.findById(contract.tenant)]);
  if (!landlord?.email || !tenant?.email) {
    throw Object.assign(new Error('signature_parties_incomplete'), { status: 409 });
  }

  const { absolutePath } = await generateContractPDF({ contract, clausesText: renderClauses(contract), signatureAnchors: true });
  const appUrl = (process.env.FRONTEND_URL || 'https://app.rentalapp.es').replace(/\/$/, '');
  const { requestId, signerLinks } = await firmaProvider.createSignatureFlow({
    contractId: String(contract._id),
    pdfPath: absolutePath,
    signers: [
      { role: 'owner', userId: String(landlord._id), name: (landlord as any).name || 'Arrendador', email: landlord.email },
      { role: 'tenant', userId: String(tenant._id), name: (tenant as any).name || 'Arrendatario', email: tenant.email },
    ],
    returnUrl: `${appUrl}/contracts/${String(contract._id)}`,
    webhookUrl: '',
  });

  const recipientUrls = { landlordUrl: signerLinks.owner, tenantUrl: signerLinks.tenant };
  const now = new Date();
  contract.signature = {
    ...(contract.signature?.toObject ? contract.signature.toObject() : contract.signature || {}),
    provider: 'firma',
    envelopeId: requestId,
    recipientUrls,
    status: 'sent',
    updatedAt: now,
    events: [...(contract.signature?.events || []), { at: now, type: 'sent' }],
  };
  if (String(contract.status) === 'draft') contract.status = 'pending_signature';
  await contract.save();
  return { envelopeId: requestId, recipientUrls, created: true };
};
