import express from 'express';
import request from 'supertest';
import notifyRoutes from '../../src/routes/notify.routes';

describe('production notification route scope', () => {
  const previousNodeEnv = process.env.NODE_ENV;

  afterAll(() => {
    if (previousNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = previousNodeEnv;
    }
  });

  it('hides notification endpoints without swallowing later API routes', async () => {
    process.env.NODE_ENV = 'production';
    const app = express();
    app.use('/api', notifyRoutes);
    app.get('/api/sentinel', (_req, res) => res.json({ ok: true }));

    await request(app).post('/api/notify/email').expect(404);
    await request(app).get('/api/sentinel').expect(200, { ok: true });
  });
});
