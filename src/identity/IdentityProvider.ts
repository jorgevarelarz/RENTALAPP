export type IdentityStatus = 'created' | 'processing' | 'verified' | 'failed';

export interface IdentityResult {
  status: IdentityStatus;
  docType?: 'dni' | 'nie' | 'passport';
  docNumber?: string;
  firstName?: string;
  lastName?: string;
  birthDate?: string;
  address?: {
    line1?: string;
    city?: string;
    postalCode?: string;
    province?: string;
    country?: string;
  };
  selfieMatch?: boolean;
  raw?: any;
}

export interface IdentityProvider {
  createSession(args: { userId: string; returnUrl: string }): Promise<{ url: string; sessionId: string }>;
  fetchResult(sessionId: string): Promise<IdentityResult>;
}
