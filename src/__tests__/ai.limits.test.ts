import request from 'supertest';

const getGenerativeModel = jest.fn().mockReturnValue({
  generateContent: jest.fn().mockResolvedValue({ response: { text: () => 'Descripcion mock' } }),
});

jest.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: jest.fn().mockImplementation(() => ({ getGenerativeModel })),
}));

jest.mock('../services/assistant.service', () => ({
  buildPlatformContext: jest.fn().mockResolvedValue({}),
  answerWithClara: jest.fn().mockResolvedValue({ answer: 'ok' }),
}));

let app: any;

const description = { features: ['2 habitaciones', '80 m2'] };

beforeAll(async () => {
  process.env.NODE_ENV = 'test';
  process.env.GOOGLE_API_KEY = 'test-key';
  process.env.AI_RATE_LIMIT_MAX = '2';
  const mod = await import('../app');
  app = mod.app || mod.default;
});

afterAll(() => {
  delete process.env.AI_RATE_LIMIT_MAX;
});

describe('AI limits', () => {
  it('caps output tokens and sets a timeout on the Gemini model', async () => {
    const res = await request(app)
      .post('/api/ai/description')
      .set('x-user-id', '0000000000000000000000a1')
      .send(description);

    expect(res.status).toBe(200);
    const [params, options] = getGenerativeModel.mock.calls[0];
    expect(params.generationConfig.maxOutputTokens).toBeGreaterThan(0);
    expect(options.timeout).toBeGreaterThan(0);
  });

  it('shares one per-user budget between /api/ai and /api/assistant', async () => {
    const user = '0000000000000000000000b2';
    const first = await request(app).post('/api/ai/description').set('x-user-id', user).send(description);
    const second = await request(app)
      .post('/api/assistant/query')
      .set('x-user-id', user)
      .send({ query: '¿Cuándo vence mi contrato?' });
    const third = await request(app).post('/api/ai/description').set('x-user-id', user).send(description);

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(third.status).toBe(429);
    expect(third.body.code).toBe('too_many_requests');
    expect(third.body.error).toMatch(/demasiadas consultas/i);

    const otherUser = await request(app)
      .post('/api/ai/description')
      .set('x-user-id', '0000000000000000000000c3')
      .send(description);
    expect(otherUser.status).toBe(200);
  });
});
