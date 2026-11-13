/**
 * URL absoluta del frontend para enlaces en redirecciones y emails.
 * Usa FRONTEND_URL (o APP_URL si falta) y nunca un dominio escrito a mano.
 */
export function frontendUrl(path: string, params?: Record<string, string>) {
  const base = (process.env.FRONTEND_URL || process.env.APP_URL || 'http://localhost:3000').replace(/\/+$/, '');
  const url = new URL(path, `${base}/`);
  Object.entries(params || {}).forEach(([key, value]) => url.searchParams.set(key, value));
  return url.toString();
}
