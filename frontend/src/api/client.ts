import axios, { type InternalAxiosRequestConfig } from 'axios';

const API_BASE = process.env.REACT_APP_API_URL || (process.env as any).VITE_API_URL || '';

export const api = axios.create({ baseURL: API_BASE });

// Request: inject Authorization and dev-only x-admin for admin routes
// En entorno de test algunos mocks de axios no implementan interceptors;
// protegemos las llamadas para evitar TypeError en Jest.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - api puede ser un mock parcial en tests
api?.interceptors?.request?.use?.((config: InternalAxiosRequestConfig) => {
  try {
    // Authorization from stored user
    const raw = typeof window !== 'undefined' ? localStorage.getItem('user') : null;
    if (raw) {
      const u = JSON.parse(raw || 'null');
      if (u?.token) {
        (config.headers as any) = { ...(config.headers || {}), Authorization: `Bearer ${u.token}` };
      }
      // Dev-only admin header for admin routes
      const isDev = process.env.NODE_ENV !== 'production';
      if (isDev && u?.role === 'admin' && config.url && /\/api\/admin\//.test(config.url)) {
        (config.headers as any) = { ...(config.headers || {}), 'x-admin': 'true' };
      }
    }
  } catch {}
  return config;
});

// Response: toast errors globally (excluding auth endpoints)
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
api?.interceptors?.response?.use?.(
  (res) => res,
  (err) => {
    try {
      const url = err?.config?.url || '';
      if (!/\/api\/auth\//.test(url)) {
        const msg = err?.response?.data?.message || err?.response?.data?.error || err?.message || 'Error de red';
        // Lazy require to avoid circular deps
        require('react-hot-toast').toast.error(msg);
      }
    } catch {}
    return Promise.reject(err);
  }
);

export default api;
