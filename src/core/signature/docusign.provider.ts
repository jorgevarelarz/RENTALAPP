import crypto from 'crypto';

type CreateEnvelopeArgs = {
  contract: any;
  landlord: any;
  tenant: any;
  embedded?: boolean;
};

export async function createEnvelope({ contract: _contract, landlord: _landlord, tenant: _tenant, embedded }: CreateEnvelopeArgs): Promise<{ envelopeId: string; status: 'created'|'sent'; recipientUrls?: { landlordUrl?: string; tenantUrl?: string } }> {
  // Placeholder for real DocuSign integration. In tests this module is mocked.
  const missing: string[] = [];
  const req = ['DOCUSIGN_BASE_URL','DOCUSIGN_INTEGRATOR_KEY','DOCUSIGN_USER_ID','DOCUSIGN_ACCOUNT_ID','DOCUSIGN_PRIVATE_KEY_BASE64'];
  for (const k of req) if (!process.env[k]) missing.push(k);
  if (process.env.NODE_ENV === 'production' && missing.length && process.env.SIGN_PROVIDER === 'docusign') {
    throw Object.assign(new Error(`docusign_env_missing: ${missing.join(',')}`), { status: 500 });
  }
  const envelopeId = `env_${Date.now()}`;
  const recipientUrls = embedded ? { landlordUrl: `https://demo.docusign.net/embedded/${envelopeId}/landlord`, tenantUrl: `https://demo.docusign.net/embedded/${envelopeId}/tenant` } : undefined;
  return { envelopeId, status: 'sent', recipientUrls };
}

export async function fetchCompletedDocument(_envelopeId: string): Promise<Buffer> {
  // Placeholder: in real impl, fetch via DocuSign API
  return Buffer.from('%PDF-signed%');
}

export function verifyConnectHmac(rawBody: string | Buffer, providedSig: string | undefined): boolean {
  const secret = process.env.DOCUSIGN_WEBHOOK_SECRET || '';
  if (!secret || !providedSig) return false;
  const hmac = crypto.createHmac('sha256', secret).update(rawBody).digest('base64');
  // DocuSign sends base64 HMAC in X-DocuSign-Signature-1
  return crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(String(providedSig)));
}
