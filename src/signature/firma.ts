import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { SignatureProvider, CreateSignatureArgs, SignatureStatus, SignatureRole } from './SignatureProvider';

// Firma.dev: firma electrónica avanzada (eIDAS), 0,049 € por sobre firmen cuantos firmen.
// Docs: https://docs.firma.dev — autenticación con la API key en "Authorization" (sin prefijo).
const DEFAULT_BASE_URL = 'https://api.firma.dev/functions/v1/signing-request-api';
const SIGNING_APP_URL = 'https://app.firma.dev/signing';

// Marcas de texto que el PDF del contrato lleva donde va cada firma (ver utils/pdfGenerator.ts).
// Firma.dev las localiza, coloca ahí el campo de firma y borra el texto.
export const FIRMA_ANCHORS: Record<SignatureRole, string> = {
  owner: '[[firma_arrendador]]',
  tenant: '[[firma_arrendatario]]',
};

type FirmaRecipient = { id: string; email?: string; first_name?: string; last_name?: string };
type FirmaUser = { id: string; email?: string };

function baseUrl() {
  return (process.env.FIRMA_API_URL || DEFAULT_BASE_URL).replace(/\/$/, '');
}

function apiKey() {
  const key = process.env.FIRMA_API_KEY;
  if (!key) throw new Error('FIRMA_API_KEY no configurado');
  return key;
}

async function firmaFetch(endpoint: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers || {});
  headers.set('Authorization', apiKey());
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  const response = await fetch(`${baseUrl()}${endpoint}`, { ...init, headers });
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`Firma.dev API error ${response.status}: ${detail || response.statusText}`);
  }
  return response;
}

function splitName(name: string) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { first_name: 'Firmante', last_name: '-' };
  if (parts.length === 1) return { first_name: parts[0], last_name: '-' };
  return { first_name: parts[0], last_name: parts.slice(1).join(' ') };
}

export function signingUrlFor(signingRequestUserId: string) {
  return `${SIGNING_APP_URL}/${signingRequestUserId}?lang=es`;
}

/**
 * El enlace de firma se construye con el id de "signing request user" de cada firmante.
 * Se usa al crear el sobre y para reparar enlaces que faltaban en un sobre ya enviado.
 */
export async function fetchFirmaSignerLinks(
  requestId: string,
  signers: { role: SignatureRole; email: string }[],
): Promise<Partial<Record<SignatureRole, string>>> {
  const usersRes = await firmaFetch(`/signing-requests/${requestId}/users`);
  const usersBody = (await usersRes.json()) as FirmaUser[] | { results?: FirmaUser[] };
  const users = Array.isArray(usersBody) ? usersBody : usersBody.results || [];

  const signerLinks: Partial<Record<SignatureRole, string>> = {};
  for (const signer of signers) {
    const email = signer.email.trim().toLowerCase();
    const user = users.find((u) => u.email && u.email.trim().toLowerCase() === email);
    if (user?.id) signerLinks[signer.role] = signingUrlFor(user.id);
  }
  return signerLinks;
}

// Firma.dev firma el cuerpo como `${t}.${body}` con HMAC-SHA256 en hex: "t=<unix>,v1=<hex>".
export function verifyFirmaSignature(
  rawBody: string | Buffer | undefined,
  header: string | string[] | undefined,
  secret: string | undefined,
  toleranceSeconds = 300,
  nowSeconds = Math.floor(Date.now() / 1000),
): boolean {
  const value = Array.isArray(header) ? header[0] : header;
  if (!secret || !value || rawBody === undefined) return false;
  const parts: Record<string, string> = {};
  for (const piece of value.split(',')) {
    const idx = piece.indexOf('=');
    if (idx > 0) parts[piece.slice(0, idx).trim()] = piece.slice(idx + 1).trim();
  }
  const t = Number(parts.t);
  const v1 = parts.v1;
  if (!Number.isFinite(t) || !v1) return false;
  if (Math.abs(nowSeconds - t) > toleranceSeconds) return false;
  const body = Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : rawBody;
  const expected = crypto.createHmac('sha256', secret).update(`${t}.${body}`).digest('hex');
  const a = Buffer.from(expected, 'hex');
  const b = Buffer.from(v1, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function normalizeEvent(type?: string): SignatureStatus {
  switch (String(type || '')) {
    case 'signing_request.completed':
      return 'completed';
    case 'signing_request.recipient.declined':
    case 'signing_request.cancelled':
      return 'declined';
    case 'signing_request.expired':
      return 'expired';
    case 'signing_request.sent':
    case 'signing_request.viewed':
    case 'signing_request.recipient.signed':
      return 'sent';
    default:
      return 'created';
  }
}

export const firmaProvider: SignatureProvider = {
  async createSignatureFlow(args: CreateSignatureArgs) {
    const pdf = await fs.readFile(args.pdfPath);
    const recipients = args.signers.map((signer, index) => ({
      id: `temp_${signer.role}`,
      ...splitName(signer.name),
      email: signer.email,
      designation: 'Signer',
      order: index + 1,
    }));
    const anchor_tags = args.signers.map((signer) => ({
      anchor_string: FIRMA_ANCHORS[signer.role],
      type: 'signature',
      recipient_id: `temp_${signer.role}`,
      required: true,
      occurrence: 1,
      remove_anchor_text: true,
    }));

    const response = await firmaFetch('/signing-requests/create-and-send', {
      method: 'POST',
      body: JSON.stringify({
        name: `Contrato de arrendamiento ${args.contractId}`,
        description: path.basename(args.pdfPath),
        document: pdf.toString('base64'),
        recipients,
        anchor_tags,
        language: 'es',
        expiration_hours: 24 * 14,
        completion_redirect_url: args.returnUrl,
        settings: {
          use_signing_order: false,
          send_signing_email: true,
          send_finish_email: true,
          attach_pdf_on_finish: true,
        },
      }),
    });
    const created = (await response.json()) as { id?: string; recipients?: FirmaRecipient[] };
    const requestId = created.id;
    if (!requestId) throw new Error('Firma.dev no devolvió el identificador de la solicitud');

    const signerLinks = (await fetchFirmaSignerLinks(requestId, args.signers)) as Record<string, string>;
    return { requestId, signerLinks };
  },

  parseWebhook(raw: any) {
    return {
      requestId: raw?.data?.signing_request?.id,
      status: normalizeEvent(raw?.type),
      evidence: { eventId: raw?.id, type: raw?.type, createdAt: raw?.created_at },
    };
  },

  async downloadFinalPdf(requestId: string): Promise<Buffer> {
    const res = await firmaFetch(`/signing-requests/${requestId}/download`);
    const body = (await res.json()) as { status?: string; is_partial?: boolean; download_url?: string };
    if (!body.download_url || body.is_partial) {
      throw new Error(`El contrato ${requestId} aún no está firmado por todas las partes`);
    }
    const file = await fetch(body.download_url);
    if (!file.ok) throw new Error(`No se pudo descargar el PDF firmado (${file.status})`);
    return Buffer.from(await file.arrayBuffer());
  },
};
