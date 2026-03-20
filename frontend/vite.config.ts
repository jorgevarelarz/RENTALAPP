import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const isProd = mode === 'production';
  const publicEnv = {
    NODE_ENV: isProd ? 'production' : 'development',
    PUBLIC_URL: '',
    REACT_APP_API_URL: env.REACT_APP_API_URL || env.VITE_API_URL || '',
    VITE_API_URL: env.VITE_API_URL || env.REACT_APP_API_URL || '',
    REACT_APP_STRIPE_KEY: env.REACT_APP_STRIPE_KEY || env.REACT_APP_STRIPE_PK || '',
    REACT_APP_STRIPE_PK: env.REACT_APP_STRIPE_PK || env.REACT_APP_STRIPE_KEY || '',
    REACT_APP_RENTAL_PUBLIC_DEMO_MODE:
      env.REACT_APP_RENTAL_PUBLIC_DEMO_MODE || env.VITE_RENTAL_PUBLIC_DEMO_MODE || 'false',
    VITE_RENTAL_PUBLIC_DEMO_MODE:
      env.VITE_RENTAL_PUBLIC_DEMO_MODE || env.REACT_APP_RENTAL_PUBLIC_DEMO_MODE || 'false',
  };

  return {
    plugins: [react()],
    server: {
      port: Number(env.PORT || 3001),
    },
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: './src/setupTests.ts',
      css: true,
    },
    define: {
      'process.env': JSON.stringify(publicEnv),
    },
  };
});
