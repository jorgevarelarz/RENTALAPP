import request from 'supertest';
import { app } from '../../src/app';
import { connectDb, disconnectDb, clearDb } from '../utils/db';
import { bearer } from '../utils/sessionToken';
import Ticket from '../../src/models/ticket.model';

const LANDLORD = '507f1f77bcf86cd799439011';
const TENANT = '507f1f77bcf86cd799439010';
const PRO = '507f1f77bcf86cd799439020';
const OTHER_PRO = '507f1f77bcf86cd799439021';

describe('Profesional: resumen, facturación y filtro de varios estados', () => {
  const originalBypass = process.env.ALLOW_POLICY_BYPASS;
  beforeAll(async () => {
    process.env.ALLOW_POLICY_BYPASS = 'true';
    await connectDb();
  });
  afterAll(async () => {
    if (originalBypass === undefined) delete process.env.ALLOW_POLICY_BYPASS;
    else process.env.ALLOW_POLICY_BYPASS = originalBypass;
    await disconnectDb();
  });
  beforeEach(async () => {
    const base = { contractId: 'c1', ownerId: LANDLORD, openedBy: TENANT, description: 'x', service: 'plumbing' };
    const quote = (amount: number) => ({ amount, currency: 'EUR', proId: PRO, ts: new Date() });
    await Ticket.create([
      { ...base, title: 'Sin presupuesto', status: 'open', proId: PRO },
      { ...base, title: 'Esperando', status: 'quoted', proId: PRO, quote: quote(100) },
      { ...base, title: 'Agendada', status: 'scheduled', proId: PRO, quote: quote(200), extra: { amount: 50, reason: 'pieza', status: 'approved' } },
      { ...base, title: 'Por validar', status: 'awaiting_validation', proId: PRO, quote: quote(300), extra: { amount: 40, reason: 'x', status: 'pending' } },
      { ...base, title: '=HYPERLINK("x")', status: 'closed', proId: PRO, quote: quote(400), extra: { amount: 25.5, reason: 'y', status: 'approved' } },
      { ...base, title: 'De otro profesional', status: 'closed', proId: OTHER_PRO, quote: quote(999) },
    ]);
  });
  afterEach(clearDb);

  it('resume todas las incidencias del profesional con los extras aprobados', async () => {
    const res = await request(app).get('/api/tickets/my/pro/summary').set('Authorization', await bearer(PRO, 'pro'));
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      quotes: { toQuote: 1, awaitingApproval: 1, approved: 3, quotedTotal: 1000 },
      billing: { pendingCount: 2, pendingTotal: 550, releasedCount: 1, releasedTotal: 425.5 },
      work: { toSchedule: 0, inProgress: 1, awaitingValidation: 1 },
    });
  });

  it('el CSV trae solo los trabajos facturables propios, en español y sin fórmulas', async () => {
    const res = await request(app).get('/api/tickets/my/pro/billing.csv').set('Authorization', await bearer(PRO, 'pro'));
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/csv/);
    const lines = res.text.replace(/^﻿/, '').trim().split('\n');
    expect(lines[0]).toBe('Fecha,Trabajo,Servicio,Estado,Presupuesto (EUR),Extra aprobado (EUR),Total (EUR),Referencia');
    expect(lines).toHaveLength(4);
    expect(res.text).not.toContain('De otro profesional');
    expect(res.text).not.toContain('Esperando');
    expect(res.text).toContain(`"'=HYPERLINK(""x"")","Fontanería","Cerrada","400.00","25.50","425.50"`);
    expect(res.text).toContain('"Por validar","300.00","0.00","300.00"');
  });

  it('solo el profesional ve su resumen y su CSV', async () => {
    const landlord = await bearer(LANDLORD, 'landlord');
    expect((await request(app).get('/api/tickets/my/pro/summary').set('Authorization', landlord)).status).toBe(403);
    expect((await request(app).get('/api/tickets/my/pro/billing.csv').set('Authorization', landlord)).status).toBe(403);
  });

  it('el listado admite varios estados separados por comas y sigue validándolos', async () => {
    const auth = await bearer(PRO, 'pro');
    const res = await request(app).get('/api/tickets/my/pro').query({ status: 'awaiting_validation,closed' }).set('Authorization', auth);
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(2);
    expect(res.body.items.map((t: any) => t.title).sort()).toEqual(['=HYPERLINK("x")', 'Por validar']);
    const bad = await request(app).get('/api/tickets/my/pro').query({ status: 'closed,done' }).set('Authorization', auth);
    expect(bad.status).toBe(400);
    expect(bad.body.error).toBe('invalid_status');
  });
});
