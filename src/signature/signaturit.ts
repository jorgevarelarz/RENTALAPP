import fs from 'fs/promises';
import path from 'path';
import { SignatureProvider, CreateSignatureArgs, SignatureStatus } from './SignatureProvider';

type SignaturitRecipient = {
  name?: string;
  email?: string;
  url?: string;
  signing_url?: string;
  signingUrl?: string;
};

type SignaturitDocument = {
  id?: string;
  document_id?: string;
  recipients?: SignaturitRecipient[];
  signer_links?: SignaturitRecipient[];
};

type SignaturitSignatureResponse = {
  id?: string;
  signature_id?: string;
  status?: string;
  event?: string;
  type?: string;
  url?: string;
  signing_url?: string;
  signingUrl?: string;
  documents?: SignaturitDocument[];
  processed_documents?: SignaturitDocument[];
};

function getSignaturitBaseUrl() {
  const env = String(process.env.SIGNATURIT_ENV || 'sandbox').toLowerCase();
  return env === 'production' ? 'https://api.signaturit.com/v3' : 'https://api.sandbox.signaturit.com/v3';
}

function getSignaturitToken() {
  const token = process.env.SIGNATURIT_TOKEN;
  if (!token) {
    throw new Error('SIGNATURIT_TOKEN no configurado');
  }
  return token;
}

async function signaturitFetch(endpoint: string, init: RequestInit = {}) {
  const token = getSignaturitToken();
  const headers = new Headers(init.headers || {});
  headers.set('Authorization', `Bearer ${token}`);

  const response = await fetch(`${getSignaturitBaseUrl()}${endpoint}`, {
    ...init,
    headers,
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`Signaturit API error ${response.status}: ${detail || response.statusText}`);
  }

  return response;
}

function normalizeStatus(raw?: string): SignatureStatus {
  switch (String(raw || '').toLowerCase()) {
    case 'completed':
    case 'signed':
      return 'completed';
    case 'declined':
      return 'declined';
    case 'expired':
      return 'expired';
    case 'sent':
    case 'signing':
    case 'ready':
      return 'sent';
    default:
      return 'created';
  }
}

function extractDocumentCandidates(payload: SignaturitSignatureResponse) {
  return [...(payload.documents || []), ...(payload.processed_documents || [])];
}

function extractSignerUrl(
  payload: SignaturitSignatureResponse,
  email?: string,
  fallbackUrl?: string,
) {
  const documents = extractDocumentCandidates(payload);
  for (const document of documents) {
    const recipients = [...(document.recipients || []), ...(document.signer_links || [])];
    for (const recipient of recipients) {
      const matchesEmail = email && recipient.email && recipient.email.toLowerCase() === email.toLowerCase();
      if (matchesEmail || (!email && (recipient.url || recipient.signing_url || recipient.signingUrl))) {
        return recipient.url || recipient.signing_url || recipient.signingUrl;
      }
    }
  }
  return payload.url || payload.signing_url || payload.signingUrl || fallbackUrl;
}

async function getSignature(signatureId: string): Promise<SignaturitSignatureResponse> {
  const response = await signaturitFetch(`/signatures/${signatureId}.json`);
  return response.json() as Promise<SignaturitSignatureResponse>;
}

export const signaturitProvider: SignatureProvider = {
  async createSignatureFlow(args: CreateSignatureArgs) {
    const fileBuffer = await fs.readFile(args.pdfPath);
    const fileName = path.basename(args.pdfPath) || `${args.contractId}.pdf`;
    const form = new FormData();

    args.signers.forEach((signer, index) => {
      form.append(`recipients[${index}][name]`, signer.name);
      form.append(`recipients[${index}][email]`, signer.email);
    });

    form.append('delivery_type', 'url');
    form.append('subject', `Contrato ${args.contractId}`);
    form.append('body', 'Por favor, revisa y firma este contrato en RentalApp.');
    form.append('data[contractId]', args.contractId);
    form.append('callback_url', args.webhookUrl);
    form.append('events_url', args.webhookUrl);
    form.append(
      'files[0]',
      new Blob([new Uint8Array(fileBuffer)], { type: 'application/pdf' }),
      fileName,
    );

    const response = await signaturitFetch('/signatures.json', {
      method: 'POST',
      body: form,
    });
    const payload = (await response.json()) as SignaturitSignatureResponse;
    const requestId = payload.id || payload.signature_id;
    if (!requestId) {
      throw new Error('Signaturit API no devolvió un identificador de firma');
    }

    const signerLinks: Record<string, string> = {};
    for (const signer of args.signers) {
      const url = extractSignerUrl(payload, signer.email, args.returnUrl);
      if (url) {
        signerLinks[signer.role] = url;
      }
    }

    return { requestId, signerLinks };
  },

  parseWebhook(raw: any) {
    const requestId = raw?.signatureId || raw?.signature_id || raw?.id || raw?.requestId;
    return {
      requestId,
      status: normalizeStatus(raw?.status || raw?.event || raw?.type),
      evidence: raw,
    };
  },

  async downloadFinalPdf(requestId: string): Promise<Buffer> {
    const payload = await getSignature(requestId);
    const document = extractDocumentCandidates(payload)[0];
    const documentId = document?.id || document?.document_id;
    if (!documentId) {
      throw new Error(`No se encontró ningún documento para la firma ${requestId}`);
    }

    const response = await signaturitFetch(
      `/signatures/${requestId}/documents/${documentId}/download/signed`,
    );
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  },
};
