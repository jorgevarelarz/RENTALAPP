import request from 'supertest';
import { app } from '../../src/app';
import { connectDb, disconnectDb, clearDb } from '../utils/db';
import { bearer } from '../utils/sessionToken';
import Ticket from '../../src/models/ticket.model';

const LANDLORD = '507f1f77bcf86cd799439011';
const TENANT = '507f1f77bcf86cd799439010';
const OTHER_TENANT = '507f1f77bcf86cd799439030';
const PRO = '507f1f77bcf86cd799439020';

describe('GET /api/tickets/my/*: búsqueda y filtro de estado', () => {
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
    const base = { contractId: 'c1', ownerId: LANDLORD, description: 'x' };
    await Ticket.create([
      { ...base, openedBy: TENANT, service: 'plumbing', title: 'Grifo de la cocina', status: 'open' },
      { ...base, openedBy: TENANT, service: 'electricity', title: 'Enchufe del salón (2)', status: 'closed', proId: PRO },
      { ...base, openedBy: TENANT, service: 'painting', title: 'Mancha en el techo', status: 'open' },
      { ...base, openedBy: OTHER_TENANT, service: 'plumbing', title: 'Grifo del baño', status: 'open' },
    ]);
  });
  afterEach(clearDb);

  const list = async (path: string, user: string, role: string, query: Record<string, string> = {}) =>
    request(app).get(`/api/tickets/my/${path}`).query(query).set('Authorization', await bearer(user, role));

  const titles = (res: any) => res.body.items.map((t: any) => t.title).sort();

  it('busca por título sin distinguir mayúsculas y cuenta el total de lo encontrado', async () => {
    const res = await list('tenant', TENANT, 'tenant', { q: 'GRIFO' });
    expect(res.status).toBe(200);
    expect(titles(res)).toEqual(['Grifo de la cocina']); // el del otro inquilino no sale
    expect(res.body.total).toBe(1);
  });

  it('busca por el nombre del servicio en español, con o sin tilde', async () => {
    expect(titles(await list('tenant', TENANT, 'tenant', { q: 'fontaneria' }))).toEqual(['Grifo de la cocina']);
    expect(titles(await list('owner', LANDLORD, 'landlord', { q: 'Fontanería' }))).toEqual(['Grifo de la cocina', 'Grifo del baño']);
    expect(titles(await list('pro', PRO, 'pro', { q: 'electri' }))).toEqual(['Enchufe del salón (2)']);
  });

  it('busca por título sin distinguir tildes', async () => {
    expect(titles(await list('tenant', TENANT, 'tenant', { q: 'salon' }))).toEqual(['Enchufe del salón (2)']);
    expect(titles(await list('tenant', TENANT, 'tenant', { q: 'SALÓN' }))).toEqual(['Enchufe del salón (2)']);
  });

  it('trata la búsqueda como texto, no como expresión regular', async () => {
    expect(titles(await list('tenant', TENANT, 'tenant', { q: '(2)' }))).toEqual(['Enchufe del salón (2)']);
    const res = await list('tenant', TENANT, 'tenant', { q: '.*' });
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(0);
  });

  it('combina búsqueda y estado, y la paginación cuenta sobre lo filtrado', async () => {
    const res = await list('owner', LANDLORD, 'landlord', { q: 'grifo', status: 'open', limit: '1' });
    expect(res.body.items).toHaveLength(1);
    expect(res.body.total).toBe(2);
    expect((await list('tenant', TENANT, 'tenant', { status: 'open' })).body.total).toBe(2);
  });

  it('rechaza estados desconocidos y operadores de Mongo en la consulta', async () => {
    expect((await list('tenant', TENANT, 'tenant', { status: 'whatever' })).body).toMatchObject({ error: 'invalid_status' });
    const op = await request(app)
      .get('/api/tickets/my/tenant?status[$ne]=closed')
      .set('Authorization', await bearer(TENANT, 'tenant'));
    expect(op.status).toBe(400);
    const qop = await request(app)
      .get('/api/tickets/my/tenant?q[$gt]=')
      .set('Authorization', await bearer(TENANT, 'tenant'));
    expect(qop.status).toBe(400);
  });
});
