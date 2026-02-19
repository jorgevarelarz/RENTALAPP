import request from 'supertest';

jest.mock('../services/ai.service', () => ({
  generatePropertyDescription: jest.fn().mockResolvedValue('Descripcion mock'),
  checkAiHealth: jest.fn().mockResolvedValue({ ok: true, model: 'gemini-flash-latest', test: 'ran' }),
}));

let app: any;

beforeAll(async () => {
  process.env.NODE_ENV = 'test';
  process.env.ALLOW_UNVERIFIED = 'true';
  const mod = await import('../app');
  app = mod.app || mod.default;
});

describe('AI routes', () => {
  it('returns health status', async () => {
    const res = await request(app).get('/api/ai/health?test=true');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.model).toBe('gemini-flash-latest');
  });

  it('generates a description', async () => {
    const res = await request(app)
      .post('/api/ai/description')
      .send({
        features: ['2 habitaciones', '1 bano', '80 m2'],
        language: 'es',
        tone: 'profesional',
        maxWords: 120,
      });

    expect(res.status).toBe(200);
    expect(res.body.description).toBe('Descripcion mock');
  });

  it('validates input', async () => {
    const res = await request(app)
      .post('/api/ai/description')
      .send({ features: [] });

    expect(res.status).toBe(400);
  });
});
