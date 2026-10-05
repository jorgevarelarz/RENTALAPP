import fs from 'fs';
import { randomUUID } from 'crypto';
import { Contract } from '../models/contract.model';
import { recordContractHistory } from '../utils/history';
import { User } from '../models/user.model';
import { getCatalogByRegion } from '../policies/clauses';
import { generateContractPDF } from '../utils/pdfGenerator';
import { firmaProvider, fetchFirmaSignerLinks } from '../signature/firma';
import { normalizeContractStatus } from '../domain/contracts/status';
import { AuthUserLike, ensureCanReadContract } from '../utils/contractAccess';

export interface SignatureInitResult {
  envelopeId: string;
  provider: string;
  recipientUrls: { landlordUrl?: string; tenantUrl?: string };
  status: string;
}

type RecipientUrls = { landlordUrl?: string; tenantUrl?: string };

const httpError = (message: string, status: number) => Object.assign(new Error(message), { status });

const userIdOf = (user?: AuthUserLike | null) => {
  const id = (user as any)?.id ?? (user as any)?._id;
  return id ? String(id) : undefined;
};

/** Cada parte solo ve su propio enlace de firma; el admin no recibe ninguno. */
const urlsVisibleTo = (contract: any, user: AuthUserLike | undefined | null, urls?: RecipientUrls): RecipientUrls => {
  const userId = userIdOf(user);
  if (!urls || !userId) return {};
  if (String(contract.landlord) === userId) return urls.landlordUrl ? { landlordUrl: urls.landlordUrl } : {};
  if (String(contract.tenant) === userId) return urls.tenantUrl ? { tenantUrl: urls.tenantUrl } : {};
  return {};
};

const ensureLandlordOrAdmin = (contract: any, user: AuthUserLike | undefined | null) => {
  const userId = userIdOf(user);
  if ((user as any)?.role === 'admin') return;
  if (!userId || String(contract.landlord) !== userId) throw httpError('forbidden', 403);
};

export const initSignature = async (
  contractId: string,
  user: AuthUserLike | undefined | null,
): Promise<SignatureInitResult> => {
  const provider = (process.env.SIGN_PROVIDER || 'mock').toLowerCase();
  if (process.env.NODE_ENV === 'production' && provider === 'mock') {
    throw httpError('signature_mock_not_allowed_in_prod', 403);
  }
  const contract = await Contract.findById(contractId);
  if (!contract) {
    throw httpError('contract_not_found', 404);
  }
  ensureLandlordOrAdmin(contract, user);
  const userId = userIdOf(user);

  if (provider === 'firma') {
    const result = await ensureFirmaSignature(contract);
    if (userId && result.created) {
      await recordContractHistory(contractId, 'SIGNATURE_INITIATED', userId, { provider, envelopeId: result.envelopeId });
    }
    return {
      envelopeId: result.envelopeId,
      provider,
      recipientUrls: urlsVisibleTo(contract, user, result.recipientUrls),
      status: 'sent',
    };
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
  return { envelopeId, provider, recipientUrls: urlsVisibleTo(contract, user, recipientUrls), status: 'sent' };
};

export const getSignatureStatus = async (contractId: string, user: AuthUserLike | undefined | null) => {
  await ensureCanReadContract({ contractId, user });
  const contract = await Contract.findById(contractId).lean();
  if (!contract) {
    throw httpError('contract_not_found', 404);
  }
  if (!contract.signature) return { status: 'none' };
  if (contract.signature.status !== 'completed') {
    const { recipientUrls, ...rest } = contract.signature as any;
    return { ...rest, recipientUrls: urlsVisibleTo(contract, user, recipientUrls) };
  }
  return { status: contract.signature.status, pdfUrl: contract.signature.pdfUrl };
};

/** Texto de las cláusulas tal como se imprime en el PDF que se envía a firmar. */
export const renderClausesForSignature = (contract: any): string[] => {
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

const ACTIVE_ENVELOPE_STATUSES = ['sent', 'created'];
const FINISHED_CONTRACT_STATUSES = ['signed', 'active', 'terminated'];
// Si un proceso muere con el bloqueo puesto, otro puede retomarlo pasado este tiempo.
const ENVELOPE_LOCK_TTL_MS = 2 * 60 * 1000;

const isSignatureFinished = (contract: any) =>
  contract.signature?.status === 'completed' ||
  FINISHED_CONTRACT_STATUSES.includes(normalizeContractStatus(contract.status));

const loadSigners = async (contract: any) => {
  const [landlord, tenant] = await Promise.all([User.findById(contract.landlord), User.findById(contract.tenant)]);
  if (!landlord?.email || !tenant?.email) {
    throw httpError('signature_parties_incomplete', 409);
  }
  return { landlord, tenant };
};

/**
 * Devuelve el sobre en curso si existe. Si a un firmante le falta el enlace (Firma.dev no lo
 * devolvió al crear el sobre), se vuelve a pedir y se guarda.
 */
const reuseFirmaEnvelope = async (contract: any) => {
  if (isSignatureFinished(contract)) throw httpError('contract_already_signed', 409);
  const current = contract.signature;
  if (
    current?.provider !== 'firma' ||
    !current?.envelopeId ||
    !ACTIVE_ENVELOPE_STATUSES.includes(String(current.status))
  ) {
    return null;
  }

  const envelopeId = String(current.envelopeId);
  let recipientUrls: RecipientUrls = {
    landlordUrl: current.recipientUrls?.landlordUrl || undefined,
    tenantUrl: current.recipientUrls?.tenantUrl || undefined,
  };
  if (!recipientUrls.landlordUrl || !recipientUrls.tenantUrl) {
    try {
      const { landlord, tenant } = await loadSigners(contract);
      const links = await fetchFirmaSignerLinks(envelopeId, [
        { role: 'owner', email: landlord.email },
        { role: 'tenant', email: tenant.email },
      ]);
      recipientUrls = {
        landlordUrl: recipientUrls.landlordUrl || links.owner,
        tenantUrl: recipientUrls.tenantUrl || links.tenant,
      };
      await Contract.updateOne(
        { _id: contract._id, 'signature.envelopeId': envelopeId },
        { $set: { 'signature.recipientUrls': recipientUrls } },
      );
    } catch (err) {
      console.error('No se pudieron recuperar los enlaces de Firma.dev:', err);
    }
  }
  return { envelopeId, recipientUrls, created: false };
};

/**
 * Firma.dev: un único sobre para arrendador e inquilino. Si el contrato ya tiene uno en curso,
 * se reutiliza (cada sobre enviado cuesta 0,049 €), así que llamar varias veces es seguro.
 * La creación se protege con un bloqueo en `signature.lockedAt` para que dos peticiones
 * simultáneas no creen dos sobres.
 */
export const ensureFirmaSignature = async (contract: any) => {
  const existing = await reuseFirmaEnvelope(contract);
  if (existing) return existing;

  const lockedAt = new Date();
  const locked = await Contract.findOneAndUpdate(
    {
      _id: contract._id,
      $or: [
        { 'signature.lockedAt': { $exists: false } },
        { 'signature.lockedAt': null },
        { 'signature.lockedAt': { $lt: new Date(lockedAt.getTime() - ENVELOPE_LOCK_TTL_MS) } },
      ],
    },
    { $set: { 'signature.lockedAt': lockedAt } },
    { new: true },
  );
  if (!locked) throw httpError('signature_in_progress', 409);

  let pdfPath: string | undefined;
  try {
    // Otra petición pudo crear el sobre entre la primera lectura y el bloqueo
    const reused = await reuseFirmaEnvelope(locked);
    if (reused) return reused;

    const { landlord, tenant } = await loadSigners(locked);
    // PDF aparte: no se sobrescribe uploads/contracts/<id>.pdf, cuyo hash es contract.pdfHash
    const { absolutePath } = await generateContractPDF({
      contract: locked,
      clausesText: renderClausesForSignature(locked),
      signatureAnchors: true,
      fileSuffix: 'firma',
    });
    pdfPath = absolutePath;
    const appUrl = (process.env.FRONTEND_URL || 'https://app.rentalapp.es').replace(/\/$/, '');
    const { requestId, signerLinks } = await firmaProvider.createSignatureFlow({
      contractId: String(locked._id),
      pdfPath: absolutePath,
      signers: [
        { role: 'owner', userId: String(landlord._id), name: (landlord as any).name || 'Arrendador', email: landlord.email },
        { role: 'tenant', userId: String(tenant._id), name: (tenant as any).name || 'Arrendatario', email: tenant.email },
      ],
      returnUrl: `${appUrl}/contracts/${String(locked._id)}`,
      webhookUrl: '',
    });

    // Si falta algún enlace se guarda igualmente: el sobre ya está enviado y reuseFirmaEnvelope lo repara
    const recipientUrls: RecipientUrls = { landlordUrl: signerLinks.owner, tenantUrl: signerLinks.tenant };
    const now = new Date();
    const signatureDoc: any = locked.signature;
    const previous = signatureDoc?.toObject ? signatureDoc.toObject() : signatureDoc || {};
    const { lockedAt: _lock, ...previousSignature } = previous as any;
    const $set: Record<string, unknown> = {
      signature: {
        ...previousSignature,
        provider: 'firma',
        envelopeId: requestId,
        recipientUrls,
        status: 'sent',
        updatedAt: now,
        events: [...(previousSignature.events || []), { at: now, type: 'sent' }],
      },
    };
    // 'generated' y contratos sin estado también son borradores
    if (normalizeContractStatus(locked.status) === 'draft') $set.status = 'pending_signature';
    const saved = await Contract.updateOne({ _id: locked._id, 'signature.lockedAt': lockedAt }, { $set });
    if (!saved.matchedCount) {
      console.error(`Firma.dev: el bloqueo del contrato ${String(locked._id)} caducó; sobre ${requestId} sin guardar`);
      throw httpError('signature_lock_expired', 409);
    }
    return { envelopeId: requestId, recipientUrls, created: true };
  } finally {
    if (pdfPath) await fs.promises.unlink(pdfPath).catch(() => {});
    await Contract.updateOne(
      { _id: contract._id, 'signature.lockedAt': lockedAt },
      { $unset: { 'signature.lockedAt': 1 } },
    ).catch(() => {});
  }
};
