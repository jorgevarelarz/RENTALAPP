import request from 'supertest';
import { pathWithoutQuery } from '../metrics';

let app: any;

beforeAll(async () => {
  process.env.NODE_ENV = 'test';
  const mod = await import('../app');
  app = mod.app || mod.default;
});

afterEach(() => {
  delete process.env.METRICS_TOKEN;
  delete process.env.STRIPE_IDENTITY_WEBHOOK_SECRET;
  process.env.NODE_ENV = 'test';
});

describe('/health', () => {
  it('does not reveal the environment', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body).not.toHaveProperty('env');
  });
});

describe('/metrics', () => {
  it('does not exist without METRICS_TOKEN', async () => {
    const res = await request(app).get('/metrics');
    expect(res.status).toBe(404);
  });

  it('requires the bearer token', async () => {
    process.env.METRICS_TOKEN = 'metrics-secret';
    expect((await request(app).get('/metrics')).status).toBe(401);
    expect((await request(app).get('/metrics').set('Authorization', 'Bearer wrong')).status).toBe(401);
    expect((await request(app).get('/metrics').set('Authorization', 'metrics-secret')).status).toBe(401);
  });

  it('serves the counters with the right token', async () => {
    process.env.METRICS_TOKEN = 'metrics-secret';
    const res = await request(app).get('/metrics').set('Authorization', 'Bearer metrics-secret');
    expect(res.status).toBe(200);
    expect(res.text).toContain('http_requests_total');
  });
});

describe('request logs', () => {
  it('drop the query string (OAuth codes, tokens)', () => {
    expect(pathWithoutQuery('/api/auth/google/callback?code=abc&state=xyz')).toBe('/api/auth/google/callback');
    expect(pathWithoutQuery('/health')).toBe('/health');
    expect(pathWithoutQuery(undefined)).toBe('');
  });
});

describe('/api/kyc/webhook', () => {
  it('rejects unsigned events in production when the secret is missing', async () => {
    // Router aislado: en modo test la app monta rutas de prueba que dan 404 si NODE_ENV cambia en caliente
    const express = (await import('express')).default;
    const identityRoutes = (await import('../routes/identity.routes')).default;
    const kyc = express().use(express.json()).use('/api/kyc', identityRoutes);
    process.env.NODE_ENV = 'production';
    const res = await request(kyc).post('/api/kyc/webhook').send({ sessionId: 'sess_x', status: 'verified' });
    expect(res.status).toBe(503);
  });

  it('keeps accepting the mock path outside production', async () => {
    const express = (await import('express')).default;
    const identityRoutes = (await import('../routes/identity.routes')).default;
    const kyc = express().use(express.json()).use('/api/kyc', identityRoutes);
    const { IdentityCheck } = await import('../models/identityCheck.model');
    const spy = jest.spyOn(IdentityCheck, 'findOneAndUpdate').mockResolvedValue(null as any);
    const res = await request(kyc).post('/api/kyc/webhook').send({ sessionId: 'sess_x', status: 'verified' });
    expect(res.status).toBe(200);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
