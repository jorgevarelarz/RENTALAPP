export function isProd(): boolean {
  return (process.env.NODE_ENV || '').toLowerCase() === 'production';
}

export function isMock(provider?: string | null): boolean {
  return (provider || '').toLowerCase() === 'mock';
}

export const flags = {
  escrow: process.env.ESCROW_DRIVER,
  sign: process.env.SIGN_PROVIDER,
  sms: process.env.SMS_PROVIDER,
};

