import fs from 'fs';
import path from 'path';
import request from 'supertest';
import mongoose from 'mongoose';
import { app } from '../../src/app';
import { connectDb, disconnectDb, clearDb } from '../utils/db';
import { Property } from '../../src/models/property.model';
import { User } from '../../src/models/user.model';
import { ensureTenantProDir, encryptAndSaveTP, deleteTP, TENANT_PRO_DIR } from '../../src/services/tenantProStorage';
import { purgeOldTenantProDocs } from '../../src/jobs/tenantProRetention';

const storageDir = TENANT_PRO_DIR;

describe('Tenant PRO flows', () => {
  beforeAll(async () => {
    process.env.TENANT_PRO_UPLOADS_KEY = 'a'.repeat(64);
    process.env.TENANT_PRO_DOCS_TTL_DAYS = '365';
    ensureTenantProDir();
    await connectDb();
  });

  afterEach(async () => {
    await clearDb();
    if (fs.existsSync(storageDir)) {
      fs.rmSync(storageDir, { recursive: true, force: true });
    }
    ensureTenantProDir();
  });

  afterAll(async () => {
    if (fs.existsSync(storageDir)) {
      fs.rmSync(storageDir, { recursive: true, force: true });
    }
    await disconnectDb();
  });

  it('blocks apply when tenant PRO validation missing or insufficient', async () => {
    const tenantId = new mongoose.Types.ObjectId();
    const property = await Property.create({
      owner: new mongoose.Types.ObjectId(),
      title: 'Piso con requisitos',
      description: '---',
      address: 'C/ Mayor 1',
      region: 'galicia',
      city: 'A Coruña',
      location: { type: 'Point', coordinates: [-8.41, 43.36] },
      price: 1200,
      deposit: 1200,
      sizeM2: 70,
      rooms: 3,
      bathrooms: 1,
      furnished: false,
      petsAllowed: false,
      availableFrom: new Date(),
      images: [],
      status: 'active',
      onlyTenantPro: true,
      requiredTenantProMaxRent: 1500,
    });

    await User.create({
      _id: tenantId,
      name: 'Tenant',
      email: 'tenant@example.com',
      passwordHash: 'hashed',
      role: 'tenant',
      tenantPro: { status: 'pending', maxRent: 0, docs: [] },
    } as any);

    const rejected = await request(app)
      .post(`/api/properties/${property._id}/apply`)
      .set('x-user-id', tenantId.toString())
      .set('x-user-role', 'tenant')
      .send()
      .expect(403);
    expect(rejected.body.error).toBe('ONLY_TENANT_PRO');

    await User.findByIdAndUpdate(tenantId, {
      'tenantPro.status': 'verified',
      'tenantPro.maxRent': 2000,
    });

    const accepted = await request(app)
      .post(`/api/properties/${property._id}/apply`)
      .set('x-user-id', tenantId.toString())
      .set('x-user-role', 'tenant')
      .send()
      .expect(200);
    expect(accepted.body.ok).toBe(true);
  });

  it('runs consent + upload + approval flow', async () => {
    const tenantId = new mongoose.Types.ObjectId();
    await User.create({
      _id: tenantId,
      name: 'Tenant',
      email: 'tenant2@example.com',
      passwordHash: 'hashed',
      role: 'tenant',
    } as any);

    await request(app)
      .post('/api/tenant-pro/consent')
      .set('x-user-id', tenantId.toString())
      .set('x-user-role', 'tenant')
      .send({ consent: true, version: 'v1' })
      .expect(200);

    await request(app)
      .post('/api/tenant-pro/docs')
      .set('x-user-id', tenantId.toString())
      .set('x-user-role', 'tenant')
      .field('type', 'nomina')
      .attach('file', Buffer.from('hello'), 'test.pdf')
      .expect(200);

    const pending: any = await User.findById(tenantId).lean();
    expect(pending?.tenantPro?.status).toBe('pending');
    expect(pending?.tenantPro?.docs?.length).toBe(1);

    await request(app)
      .post(`/api/admin/tenant-pro/${tenantId.toString()}/decision`)
      .set('x-user-id', new mongoose.Types.ObjectId().toString())
      .set('x-user-role', 'admin')
      .set('x-admin', 'true')
      .send({ decision: 'approved', maxRent: 1800 })
      .expect(200);

    const verified: any = await User.findById(tenantId).lean();
    expect(verified?.tenantPro?.status).toBe('verified');
    expect(verified?.tenantPro?.maxRent).toBe(1800);
  });

  it('purges documents after TTL with retention job', async () => {
    const tenantId = new mongoose.Types.ObjectId();
    const file = encryptAndSaveTP('ttl.txt', Buffer.from('ttl'));

    await User.create({
      _id: tenantId,
      name: 'Tenant',
      email: 'tenant3@example.com',
      passwordHash: 'hashed',
      role: 'tenant',
      tenantPro: {
        status: 'verified',
        maxRent: 1000,
        docs: [
          {
            type: 'nomina',
            url: file,
            status: 'approved',
            uploadedAt: new Date(Date.now() - 400 * 24 * 60 * 60 * 1000),
          },
        ],
      },
    } as any);

    expect(fs.existsSync(path.join(storageDir, file))).toBe(true);

    await purgeOldTenantProDocs();

    const refreshed: any = await User.findById(tenantId).lean();
    expect(refreshed?.tenantPro?.docs?.length).toBe(0);
    expect(fs.existsSync(path.join(storageDir, file))).toBe(false);
  });

  it('purges only expired documents, keeps an audit entry and survives a missing file', async () => {
    const day = 24 * 60 * 60 * 1000;
    const oldFile = encryptAndSaveTP('old.txt', Buffer.from('old'));
    const freshFile = encryptAndSaveTP('fresh.txt', Buffer.from('fresh'));
    const mixed = await User.create({
      name: 'Mixed',
      email: 'mixed@example.com',
      passwordHash: 'hashed',
      role: 'tenant',
      tenantPro: {
        status: 'verified',
        maxRent: 900,
        docs: [
          { type: 'nomina', url: oldFile, status: 'approved', hash: 'h-old', uploadedAt: new Date(Date.now() - 366 * day) },
          { type: 'renta', url: freshFile, status: 'pending', uploadedAt: new Date(Date.now() - 10 * day) },
        ],
      },
    } as any);
    // El fichero ya no está en disco: la purga no debe fallar por ello
    const gone = await User.create({
      name: 'Gone',
      email: 'gone@example.com',
      passwordHash: 'hashed',
      role: 'tenant',
      tenantPro: {
        docs: [{ type: 'otros', url: 'no-existe.bin', uploadedAt: new Date(Date.now() - 500 * day) }],
      },
    } as any);

    const summary = await purgeOldTenantProDocs();
    expect(summary).toEqual({ users: 2, docs: 2, failed: 0 });

    const after: any = await User.findById(mixed._id).lean();
    expect(after.tenantPro.docs.map((d: any) => d.type)).toEqual(['renta']);
    expect(after.tenantPro.status).toBe('verified');
    expect(after.tenantPro.auditTrail).toHaveLength(1);
    expect(after.tenantPro.auditTrail[0]).toMatchObject({ type: 'nomina', hash: 'h-old', status: 'approved' });
    expect(after.tenantPro.auditTrail[0].archivedAt).toBeInstanceOf(Date);
    expect(fs.existsSync(path.join(storageDir, oldFile))).toBe(false);
    expect(fs.existsSync(path.join(storageDir, freshFile))).toBe(true);

    const goneAfter: any = await User.findById(gone._id).lean();
    expect(goneAfter.tenantPro.docs).toHaveLength(0);

    // Segundo pase: nada que hacer
    expect(await purgeOldTenantProDocs()).toEqual({ users: 0, docs: 0, failed: 0 });
  });

  it('honours TENANT_PRO_DOCS_TTL_DAYS and ignores invalid values', async () => {
    const day = 24 * 60 * 60 * 1000;
    const file = encryptAndSaveTP('ttl30.txt', Buffer.from('x'));
    await User.create({
      name: 'Short',
      email: 'short@example.com',
      passwordHash: 'hashed',
      role: 'tenant',
      tenantPro: { docs: [{ type: 'nomina', url: file, uploadedAt: new Date(Date.now() - 40 * day) }] },
    } as any);
    try {
      process.env.TENANT_PRO_DOCS_TTL_DAYS = 'abc';
      expect(await purgeOldTenantProDocs()).toEqual({ users: 0, docs: 0, failed: 0 });
      process.env.TENANT_PRO_DOCS_TTL_DAYS = '30';
      expect(await purgeOldTenantProDocs()).toEqual({ users: 1, docs: 1, failed: 0 });
    } finally {
      process.env.TENANT_PRO_DOCS_TTL_DAYS = '365';
    }
  });

  it('never deletes outside the Tenant PRO directory', () => {
    const outside = path.join(storageDir, '..', 'keep-me.txt');
    fs.writeFileSync(outside, 'x');
    try {
      deleteTP('../keep-me.txt');
      expect(fs.existsSync(outside)).toBe(true);
    } finally {
      fs.rmSync(outside, { force: true });
    }
  });
});
