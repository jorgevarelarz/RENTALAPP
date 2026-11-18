import express from 'express';
import request from 'supertest';
import { sendRouteError } from '../../src/utils/routeError';
import { logger } from '../../src/utils/logger';

const appThrowing = (err: any) => {
  const app = express();
  app.get('/x', (_req, res) => {
    sendRouteError(res, err, 'thing_failed');
  });
  return app;
};

describe('sendRouteError', () => {
  afterEach(() => jest.restoreAllMocks());

  it('keeps the message of a deliberate 4xx', async () => {
    const res = await request(appThrowing(Object.assign(new Error('Forbidden'), { status: 403 }))).get('/x').expect(403);
    expect(res.body).toEqual({ error: 'Forbidden', code: 403 });
  });

  it('hides internal errors behind the fixed code and logs them', async () => {
    const log = jest.spyOn(logger, 'error').mockImplementation(() => undefined as any);
    const mongo = new Error('E11000 duplicate key error collection: users index: email_1 dup key: { email: "ana@example.com" }');
    const res = await request(appThrowing(mongo)).get('/x?token=abc').expect(500);
    expect(res.body).toEqual({ error: 'thing_failed', code: 500 });
    expect(JSON.stringify(res.body)).not.toContain('ana@example.com');
    expect(log).toHaveBeenCalledWith(expect.objectContaining({ method: 'GET', url: '/x', err: mongo }), 'thing_failed');
  });

  it('keeps a deliberate 5xx status without its message', async () => {
    jest.spyOn(logger, 'error').mockImplementation(() => undefined as any);
    const res = await request(appThrowing(Object.assign(new Error('docusign_env_missing: DOCUSIGN_KEY'), { status: 503 }))).get('/x').expect(503);
    expect(res.body).toEqual({ error: 'thing_failed', code: 503 });
  });

  it('treats a non-numeric status as 500', async () => {
    jest.spyOn(logger, 'error').mockImplementation(() => undefined as any);
    const res = await request(appThrowing(Object.assign(new Error('boom'), { status: 'bad' }))).get('/x').expect(500);
    expect(res.body.error).toBe('thing_failed');
  });
});
