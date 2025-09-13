export function toAbsoluteUrl(u?: string): string {
  if (!u) return '';
  if (/^https?:\/\//i.test(u)) return u;
  const base = (process.env.REACT_APP_API_URL || (process.env as any).VITE_API_URL || '').replace(/\/$/, '');
  return `${base}${u.startsWith('/') ? '' : '/'}${u}`;
}

