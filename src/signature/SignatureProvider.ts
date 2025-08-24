export type SignatureRole = 'owner' | 'tenant';
export type SignatureStatus = 'created' | 'sent' | 'completed' | 'declined' | 'expired';

export interface CreateSignatureArgs {
  contractId: string;
  pdfPath: string;
  signers: { role: SignatureRole; userId: string; name: string; email: string }[];
  returnUrl: string;
  webhookUrl: string;
}

export interface SignatureProvider {
  createSignatureFlow(args: CreateSignatureArgs): Promise<{ requestId: string; signerLinks: Record<string, string> }>;
  parseWebhook(raw: any): { requestId: string; status: SignatureStatus; evidence?: any };
  downloadFinalPdf(requestId: string): Promise<Buffer>;
}
