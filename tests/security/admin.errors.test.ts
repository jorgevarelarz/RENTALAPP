import request from 'supertest';
import jwt from 'jsonwebtoken';
import { app } from '../../src/app';
import { connectDb, disconnectDb, clearDb } from '../utils/db';
import { User } from '../../src/models/user.model';
import { Payment } from '../../src/models/payment.model';
import { PolicyVersion } from '../../src/models/policy.model';
import { UserPolicyAcceptance } from '../../src/models/userPolicyAcceptance.model';
import { Verification } from '../../src/models/verification.model';
import Review from '../../src/models/review.model';
import { ComplianceStatus } from '../../src/modules/rentalPublic/models/complianceStatus.model';
import { logger } from '../../src/utils/logger';

// Los 500 de administración, políticas, informe fiscal, institución y verificación
// no devuelven el mensaje interno; los errores deliberados conservan su texto.
describe('Errores de administración, políticas, informe fiscal e institución', () => {
  const adminId = '507f1f77bcf86cd799439c01';
  const landlordId = '507f1f77bcf86cd799439c02';
  const tenantId = '507f1f77bcf86cd799439c03';
  const as = (id: string, role: string, verified = 'true') => ({ 'x-user-id': id, 'x-user-role': role, 'x-user-verified': verified });
  const secret = 'E11000 duplicate key error dup key: { email: "ana@example.com" }';
  const boom = () => {
    throw new Error(secret);
  };

  beforeAll(connectDb);
  afterAll(disconnectDb);
  beforeEach(() => {
    jest.spyOn(logger, 'error').mockImplementation(() => undefined as any);
  });
  afterEach(async () => {
    jest.restoreAllMocks();
    await clearDb();
  });

  it('las estadísticas y los listados de admin dan un código fijo', async () => {
    jest.spyOn(User, 'countDocuments').mockImplementation(boom as any);
    const stats = await request(app).get('/api/admin/stats').set(as(adminId, 'admin')).expect(500);
    expect(stats.body).toEqual({ error: 'admin_stats_failed', code: 500 });

    jest.spyOn(UserPolicyAcceptance, 'find').mockImplementation(boom as any);
    const acc = await request(app).get('/api/admin/policies/acceptances').set(as(adminId, 'admin')).expect(500);
    expect(JSON.stringify(acc.body)).not.toContain('ana@example.com');
    expect(acc.body.error).toBe('compliance_list_failed');

    jest.spyOn(ComplianceStatus, 'aggregate').mockImplementation(boom as any);
    jest.spyOn(ComplianceStatus, 'countDocuments').mockImplementation(boom as any);
    const dash = await request(app).get('/api/admin/compliance/dashboard').set(as(adminId, 'admin')).expect(500);
    expect(dash.body).toEqual({ error: 'compliance_dashboard_failed', code: 500 });
  });

  it('exportar registros de auditoría solo admite ids de contrato válidos', async () => {
    const res = await request(app)
      .get('/api/admin/compliance/audit-trails/export')
      .query({ format: 'zip', contractIds: '../../../package' })
      .set(as(adminId, 'admin'))
      .expect(400);
    expect(res.body).toEqual({ error: 'invalid_contract_id' });
  });

  it('políticas: un fallo interno da código fijo y una versión repetida, 409 sin el error de Mongo', async () => {
    jest.spyOn(PolicyVersion, 'find').mockImplementationOnce(boom as any);
    const active = await request(app).get('/api/policies/active').set(as(tenantId, 'tenant')).expect(500);
    expect(active.body).toEqual({ error: 'policy_list_failed', code: 500 });

    const body = { policyType: 'privacy_policy', version: 'v1.0' };
    // El 409 depende del índice único; en una base recién creada se construye en segundo plano.
    await PolicyVersion.init();
    await request(app).post('/api/policies/version').set(as(adminId, 'admin')).send(body).expect(201);
    const invalid = await request(app).post('/api/policies/version').set(as(adminId, 'admin')).send({ ...body, version: '1' }).expect(400);
    expect(invalid.body).toEqual({ success: false, error: 'invalid_policy' });
    await PolicyVersion.updateMany({}, { $set: { isActive: true } });
    const dup = await request(app).post('/api/policies/version').set(as(adminId, 'admin')).send(body).expect(409);
    expect(dup.body).toEqual({ success: false, error: 'policy_version_exists' });

    jest.spyOn(PolicyVersion, 'findOne').mockImplementationOnce(boom as any);
    const accept = await request(app)
      .post('/api/policies/accept')
      .set(as(tenantId, 'tenant'))
      .send({ policyType: 'privacy_policy', policyVersion: 'v1.0' })
      .expect(500);
    expect(accept.body).toEqual({ error: 'policy_accept_failed', code: 500 });
  });

  it('el informe fiscal y sus exportaciones no devuelven el error interno', async () => {
    jest.spyOn(Payment, 'find').mockImplementation(boom as any);
    const report = await request(app).get('/api/tax/report').set(as(landlordId, 'landlord')).expect(500);
    expect(report.body).toEqual({ error: 'tax_report_failed', code: 500 });
    const csv = await request(app).get('/api/tax/report/export.csv').set(as(landlordId, 'landlord')).expect(500);
    expect(csv.body).toEqual({ error: 'tax_report_export_failed', code: 500 });
    // Un año fuera de rango sigue siendo un 400 con su código.
    const bad = await request(app).get('/api/tax/report/export.pdf?year=1900').set(as(landlordId, 'landlord')).expect(400);
    expect(bad.body.error).toBe('invalid_year');
  });

  it('el panel de la institución da un código fijo', async () => {
    const user = await User.create({
      name: 'Institución',
      email: 'inst-c04@example.com',
      passwordHash: 'hash',
      role: 'institution_viewer',
      institutionScope: { areaKeys: ['galicia|oleiros|'] },
    });
    const token = jwt.sign({ _id: String(user._id), role: 'institution_viewer' }, process.env.JWT_SECRET || 'insecure');
    jest.spyOn(ComplianceStatus, 'aggregate').mockImplementation(boom as any);
    jest.spyOn(ComplianceStatus, 'countDocuments').mockImplementation(boom as any);
    const res = await request(app)
      .get('/api/institution/compliance/dashboard')
      .set('Authorization', `Bearer ${token}`)
      .expect(500);
    expect(res.body).toEqual({ error: 'institution_dashboard_failed', code: 500 });
  });

  it('un fallo al comprobar la verificación da código fijo', async () => {
    jest.spyOn(Verification, 'findOne').mockImplementation(boom as any);
    const res = await request(app).get('/api/reviews/user/x').set(as(tenantId, 'tenant', 'false')).expect(500);
    expect(res.body).toEqual({ error: 'verification_check_failed', code: 500 });
  });

  it('las reseñas de un usuario no enseñan quién opinó ni sobre qué contrato', async () => {
    await User.create({ _id: landlordId, name: 'Laura Martín Ruiz', email: 'laura-c02@example.com', role: 'landlord' });
    await Review.create({
      fromUserId: landlordId,
      toUserId: tenantId,
      roleContext: 'tenant',
      relatedId: '507f1f77bcf86cd799439c99',
      score: 4,
      comment: 'Buen inquilino',
    });
    const res = await request(app).get(`/api/reviews/user/${tenantId}`).set(as(adminId, 'landlord')).expect(200);
    expect(res.body.total).toBe(1);
    expect(res.body.items[0]).toMatchObject({ score: 4, comment: 'Buen inquilino', roleContext: 'tenant', author: 'Laura M.' });
    const raw = JSON.stringify(res.body);
    expect(raw).not.toContain(landlordId);
    expect(raw).not.toContain('439c99');
    expect(raw).not.toContain('laura-c02');
  });
});
