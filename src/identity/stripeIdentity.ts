import { IdentityProvider, IdentityResult } from './IdentityProvider';

// Minimal Stripe Identity stub; replace with actual Stripe integration when available
export const stripeIdentityProvider: IdentityProvider = {
  async createSession({ userId, returnUrl }) {
    // In a real implementation, call Stripe Identity API
    const sessionId = `sess_${userId}_${Date.now()}`;
    const url = `https://stripe.example/verify/${sessionId}?redirect=${encodeURIComponent(returnUrl)}`;
    return { url, sessionId };
  },

  async fetchResult(sessionId: string): Promise<IdentityResult> {
    // Placeholder that always returns verified
    return { status: 'verified', raw: { sessionId } };
  },
};
