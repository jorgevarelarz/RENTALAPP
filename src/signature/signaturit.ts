import { SignatureProvider, CreateSignatureArgs, SignatureStatus } from './SignatureProvider';

// Minimal stub for Signaturit (or similar) integration
export const signaturitProvider: SignatureProvider = {
  async createSignatureFlow(args: CreateSignatureArgs) {
    const requestId = `sig_${Date.now()}`;
    const signerLinks: Record<string, string> = {};
    for (const s of args.signers) {
      signerLinks[s.role] = `https://sign.example/${requestId}/${s.role}`;
    }
    return { requestId, signerLinks };
  },

  parseWebhook(raw: any) {
    const { requestId, status } = raw || {};
    return { requestId, status: (status as SignatureStatus) || 'created', evidence: raw };
  },

  async downloadFinalPdf(requestId: string): Promise<Buffer> {
    // In a real implementation, fetch the signed PDF from provider API
    return Buffer.from(`Signed PDF for ${requestId}`);
  },
};
