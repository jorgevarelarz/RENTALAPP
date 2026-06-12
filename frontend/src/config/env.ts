const viteEnv = ((import.meta as any).env || {}) as Record<string, string | boolean | undefined>;

const legacyEnv =
  typeof process !== 'undefined'
    ? (((process as any).env || {}) as Record<string, string | undefined>)
    : {};

const readEnv = (...keys: string[]) => {
  for (const key of keys) {
    const value = viteEnv[key] ?? legacyEnv[key];
    if (typeof value === 'string' && value.length > 0) return value;
  }
  return '';
};

export const appEnv = {
  apiUrl: readEnv('VITE_API_URL', 'REACT_APP_API_URL'),
  baseUrl: readEnv('BASE_URL', 'PUBLIC_URL'),
  stripeKey: readEnv('VITE_STRIPE_KEY', 'VITE_STRIPE_PK', 'REACT_APP_STRIPE_KEY', 'REACT_APP_STRIPE_PK'),
  rentalPublicDemoMode: readEnv('VITE_RENTAL_PUBLIC_DEMO_MODE', 'REACT_APP_RENTAL_PUBLIC_DEMO_MODE'),
  isProduction: Boolean(viteEnv.PROD) || viteEnv.MODE === 'production' || legacyEnv.NODE_ENV === 'production',
};

