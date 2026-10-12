/**
 * Mapa de sesión de toda la API: cada ruta /api que monta app.ts es pública a propósito
 * (está en PUBLIC_ROUTES) o responde 401 sin JWT. El test recorre la pila de Express, así
 * que una ruta nueva entra sola en la comprobación:
 *  - si se monta sin authenticate y no está en la lista, falla (ruta privada abierta);
 *  - si una ruta de la lista responde 401 «Token requerido», falla (ruta pública que quedó
 *    detrás de la sesión, como las invitaciones hasta la ronda 75).
 * Además, una ruta /api que no existe responde 404 y no 401: ningún app.use('/api', authenticate, …)
 * sin prefijo corta el paso a lo que se monte después.
 */

import request from 'supertest';
import { connectDb, disconnectDb } from '../utils/db';

let app: any;
const savedEnv: Record<string, string | undefined> = {};
const ENV_KEYS = ['ALLOW_TEST_AUTH', 'ALLOW_UNVERIFIED'];
const AUTH_REQUIRED = 'Token requerido';
const FAKE_ID = '000000000000000000000000';

// Rutas que responden sin sesión a propósito («MÉTODO /ruta», tal como las declara Express).
const PUBLIC_ROUTES = new Set([
  // Webhooks: se autentican con la firma del proveedor
  'POST /api/stripe/webhook',
  'POST /api/contracts/signature/callback',
  'POST /api/contracts/signature/firma',
  'POST /api/kyc/webhook',
  // Textos legales y estado del servicio
  'GET /api/legal/tenant-pro-consent',
  'GET /api/legal/privacy-policy',
  'GET /api/health',
  'GET /api/ready',
  // Acceso a la cuenta
  'GET /api/auth/oauth/providers',
  'GET /api/auth/oauth/:provider/start',
  'GET /api/auth/oauth/:provider/callback',
  'POST /api/auth/oauth/:provider/callback',
  'POST /api/auth/oauth/exchange',
  'POST /api/auth/register',
  'POST /api/auth/login',
  'POST /api/auth/request-reset',
  'POST /api/auth/reset',
  // Verificación: comprueban el rol dentro y responden 403 sin sesión
  'POST /api/verification/:userId/approve',
  'POST /api/verification/:userId/reject',
  'POST /api/verification/dev/verify',
  // Anuncios públicos y catálogo de cláusulas
  'GET /api/properties',
  'GET /api/properties/:id',
  'POST /api/properties/:id/view',
  'GET /api/clauses',
  // Invitaciones: el invitado aún no tiene cuenta
  'GET /api/agency-invites/:token',
  'POST /api/agency-invites/:token/accept',
  'GET /api/invites/preview',
]);
// Solo fuera de producción (app.ts no las monta con NODE_ENV=production)
const DEV_ONLY_PREFIX = '/api/testing/';

type Route = { method: string; path: string };

// Prefijo de un app.use('/x', router) en Express 4: la ruta solo queda en la expresión regular
const mountPrefix = (layer: any): string => {
  if (layer.regexp?.fast_slash) return '';
  return String(layer.regexp.source)
    .replace(/^\^/, '')
    .replace(/\\\/\?\(\?=\\\/\|\$\)$/i, '')
    .replace(/\\\//g, '/');
};

const collectRoutes = (stack: any[], base = '', out: Route[] = []): Route[] => {
  for (const layer of stack) {
    if (layer.route && typeof layer.route.path === 'string') {
      const full = (base + layer.route.path).replace(/(.)\/$/, '$1');
      for (const method of Object.keys(layer.route.methods)) {
        if (method !== '_all') out.push({ method: method.toUpperCase(), path: full });
      }
    } else if (layer.name === 'router' && layer.handle?.stack) {
      collectRoutes(layer.handle.stack, base + mountPrefix(layer), out);
    }
  }
  return out;
};

const call = (method: string, path: string) =>
  (request(app) as any)[method.toLowerCase()](path.replace(/:[A-Za-z_]+/g, FAKE_ID));

let apiRoutes: Route[] = [];

beforeAll(async () => {
  for (const k of ENV_KEYS) savedEnv[k] = process.env[k];
  await connectDb();
  // Peticiones reales: ni usuario inventado por cabeceras ni verificación saltada
  process.env.ALLOW_TEST_AUTH = 'false';
  process.env.ALLOW_UNVERIFIED = 'false';
  const mod = await import('../../src/app');
  app = mod.app || mod.default;
  apiRoutes = collectRoutes(app._router.stack).filter(r => r.path.startsWith('/api/'));
});

afterAll(async () => {
  for (const k of ENV_KEYS) {
    if (savedEnv[k] === undefined) delete process.env[k];
    else process.env[k] = savedEnv[k];
  }
  await disconnectDb();
});

describe('mapa de sesión de /api', () => {
  it('encuentra las rutas de app.ts', () => {
    // Si el recorrido de la pila dejara de funcionar (cambio de Express), el resto no probaría nada
    expect(apiRoutes.length).toBeGreaterThan(150);
    const keys = new Set(apiRoutes.map(r => `${r.method} ${r.path}`));
    for (const k of ['GET /api/contracts/:id', 'GET /api/payments', 'GET /api/tax/report', 'POST /api/appointments/:id/cancel']) {
      expect(keys).toContain(k);
    }
    for (const k of PUBLIC_ROUTES) expect(keys).toContain(k);
  });

  it('toda ruta privada responde 401 sin sesión', async () => {
    const open: string[] = [];
    for (const { method, path } of apiRoutes) {
      const key = `${method} ${path}`;
      if (PUBLIC_ROUTES.has(key) || path.startsWith(DEV_ONLY_PREFIX)) continue;
      const res = await call(method, path);
      if (res.status !== 401 || res.body?.error !== AUTH_REQUIRED) open.push(`${key} → ${res.status}`);
    }
    expect(open).toEqual([]);
  });

  it('ninguna ruta pública queda detrás de la sesión', async () => {
    const blocked: string[] = [];
    for (const key of PUBLIC_ROUTES) {
      const [method, path] = key.split(' ');
      const res = await call(method, path);
      if (res.status === 401 && res.body?.error === AUTH_REQUIRED) blocked.push(key);
    }
    expect(blocked).toEqual([]);
  });

  it('una ruta /api que no existe da 404, no 401', async () => {
    await request(app).get('/api/no-existe').expect(404);
    await request(app).post('/api/no-existe/tampoco').expect(404);
  });
});
