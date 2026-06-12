import { appEnv } from '../config/env';

export function toAbsoluteUrl(u?: string): string {
  if (!u) return '';
  if (/^https?:\/\//i.test(u)) return u;
  const base = appEnv.apiUrl.replace(/\/$/, '');
  return `${base}${u.startsWith('/') ? '' : '/'}${u}`;
}
