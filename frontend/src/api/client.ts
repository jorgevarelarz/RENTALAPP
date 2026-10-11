import axios, { type InternalAxiosRequestConfig } from 'axios';
import { appEnv } from '../config/env';

const API_BASE = appEnv.apiUrl;

export const api = axios.create({ baseURL: API_BASE });

export function getApiErrorRequestId(err: any) {
  const headers = err?.response?.headers;
  return (
    err?.response?.data?.requestId ||
    headers?.['x-request-id'] ||
    headers?.['X-Request-Id'] ||
    headers?.get?.('x-request-id') ||
    headers?.get?.('X-Request-Id') ||
    ''
  );
}

export function formatApiError(
  err: any,
  fallback = 'Error de red',
  options: { includeRequestId?: boolean } = {},
) {
  const msg = err?.response?.data?.message || err?.response?.data?.error || err?.message || fallback;
  const requestId = getApiErrorRequestId(err);
  return requestId && options.includeRequestId !== false ? `${msg} (ref: ${requestId})` : msg;
}

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
      const isDev = !appEnv.isProduction;
      if (isDev && u?.role === 'admin' && config.url && /\/api\/admin\//.test(config.url)) {
        (config.headers as any) = { ...(config.headers || {}), 'x-admin': 'true' };
      }
    }
  } catch {}
  return config;
});

// Códigos con los que el backend (auth.middleware.ts) rechaza un token: caducado, mal formado o
// de una sesión cerrada (p. ej. tras restablecer la contraseña). Sin sesión válida no hay nada
// que reintentar: se borra la sesión guardada y se vuelve al login con un aviso.
const SESSION_LOST_CODES = new Set(['session_expired', 'invalid_token']);

export function handleSessionLost(err: any): boolean {
  if (err?.response?.status !== 401 || !SESSION_LOST_CODES.has(err?.response?.data?.code)) return false;
  if (typeof window === 'undefined' || !localStorage.getItem('user')) return false;
  localStorage.removeItem('user');
  try {
    delete (api.defaults.headers.common as any).Authorization;
  } catch {}
  const { pathname, search } = window.location;
  if (pathname !== '/login') {
    const redirect = encodeURIComponent(pathname + search);
    window.location.assign(`/login?session=expired&redirect=${redirect}`);
  }
  return true;
}

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - api puede ser un mock parcial en tests
api?.interceptors?.response?.use?.(
  (res: any) => res,
  (err: any) => {
    handleSessionLost(err);
    return Promise.reject(err);
  },
);

export default api;
