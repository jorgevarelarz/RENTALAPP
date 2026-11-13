/**
 * Qué rutas de /api/contracts (y los webhooks de pago) responden sin sesión.
 *
 * Los proveedores externos (Firma.dev, el callback de firma y Stripe) llaman sin JWT,
 * así que tienen que llegar a su controlador, que valida su propia firma HMAC. Todo
 * lo demás de /api/contracts cuelga de authenticate. Si alguien mueve un app.use o
 * monta un router antes de tiempo, este test lo cuenta: un webhook detrás de
 * authenticate deja de funcionar en silencio y una ruta privada sin él filtra datos.
 */

import request from 'supertest';

let app: any;
const savedEnv: Record<string, string | undefined> = {};
const ENV_KEYS = ['NODE_ENV', 'ALLOW_TEST_AUTH', 'FIRMA_WEBHOOK_SECRET', 'SIGN_PROVIDER', 'SIGN_WEBHOOK_SECRET'];

const AUTH_REQUIRED = 'Token requerido';
const contractId = '507f1f77bcf86cd799439011';

beforeAll(async () => {
  for (const k of ENV_KEYS) savedEnv[k] = process.env[k];
  process.env.NODE_ENV = 'test';
  // Sin el atajo de cabeceras x-user-*: aquí se prueba la petición anónima real
  process.env.ALLOW_TEST_AUTH = 'false';
  process.env.FIRMA_WEBHOOK_SECRET = 'test-firma-secret';
  const mod = await import('../../src/app');
  app = mod.app || mod.default;
});

afterAll(() => {
  for (const k of ENV_KEYS) {
    if (savedEnv[k] === undefined) delete process.env[k];
    else process.env[k] = savedEnv[k];
  }
});

describe('webhooks públicos: llegan al controlador sin JWT', () => {
  it('POST /api/contracts/signature/firma rechaza por firma HMAC, no por falta de sesión', async () => {
    const res = await request(app)
      .post('/api/contracts/signature/firma')
      .set('x-firma-signature', 'v1=deadbeef')
      .send({ type: 'signing_request.completed', data: { id: 'req_1' } });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('invalid_signature');
  });

  it('POST /api/contracts/signature/callback llega al controlador', async () => {
    // Sin ID de sobre, el controlador responde antes de consultar la base
    const res = await request(app)
      .post('/api/contracts/signature/callback')
      .send({ status: 'completed' });
    expect(res.body.error).not.toBe(AUTH_REQUIRED);
    expect([400, 403]).toContain(res.status);
  });

  it('POST /api/stripe/webhook rechaza por la firma de Stripe, no por falta de sesión', async () => {
    const res = await request(app)
      .post('/api/stripe/webhook')
      .set('Content-Type', 'application/json')
      .set('stripe-signature', 't=1,v1=deadbeef')
      .send('{}');
    expect(res.body?.error).not.toBe(AUTH_REQUIRED);
    expect(res.status).not.toBe(404);
  });
});

describe('/api/contracts privado: sin sesión, 401 antes de tocar nada', () => {
  const privateRoutes: Array<[string, string]> = [
    ['get', '/api/contracts'],
    ['post', '/api/contracts'],
    ['get', `/api/contracts/${contractId}`],
    ['get', `/api/contracts/${contractId}/pdf`],
    ['get', `/api/contracts/${contractId}/pdf/signed`],
    ['get', `/api/contracts/${contractId}/signed.pdf`],
    ['get', `/api/contracts/${contractId}/history`],
    ['get', `/api/contracts/${contractId}/audit-trail`],
    ['get', `/api/contracts/${contractId}/parties`],
    ['get', `/api/contracts/${contractId}/payments`],
    ['get', `/api/contracts/${contractId}/signature/status`],
    ['get', '/api/contracts/earnings/stats'],
    ['get', '/api/contracts/earnings/export'],
    ['patch', `/api/contracts/${contractId}/sign`],
    ['post', `/api/contracts/${contractId}/pay`],
    ['post', `/api/contracts/${contractId}/pay-rent`],
    ['post', `/api/contracts/${contractId}/payments/2026-10/pay`],
    ['post', `/api/contracts/${contractId}/deposit`],
    ['post', `/api/contracts/${contractId}/activate`],
    ['post', `/api/contracts/${contractId}/terminate`],
    ['post', `/api/contracts/${contractId}/tenants/invite`],
    // Rutas de firma genéricas que hoy quedan detrás de authenticate (punto #9 de
    // docs/review-firma-2026-10-05.md, pendiente de decidir). Si se hacen públicas,
    // este caso tiene que cambiar a la vez que se monten antes en app.ts.
    ['post', '/api/contracts/signature/webhook'],
    ['post', `/api/contracts/${contractId}/signature/callback`],
  ];

  it.each(privateRoutes)('%s %s responde 401', async (method, path) => {
    const res = await (request(app) as any)[method](path).send({});
    expect(res.status).toBe(401);
    expect(res.body.error).toBe(AUTH_REQUIRED);
  });
});
