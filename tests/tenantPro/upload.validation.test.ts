import request from 'supertest';
import { app } from '../../src/app';

describe('Tenant PRO upload validation', () => {
  it('rejects unsupported MIME type (zip) with 400', async () => {
    const res = await request(app)
      .post('/api/tenant-pro/docs')
      .set('x-user-id', '000000000000000000000111')
      .set('x-user-role', 'tenant')
      .attach('file', Buffer.from('zipdata'), { filename: 'bad.zip', contentType: 'application/zip' })
      .field('type', 'nomina');
    expect(res.status).toBe(400);
    expect(res.body?.code).toBe('unsupported_mime');
  });

  it('rejects payload >10MB with 413', async () => {
    const big = Buffer.alloc(10 * 1024 * 1024 + 1, 0x61);
    const res = await request(app)
      .post('/api/tenant-pro/docs')
      .set('x-user-id', '000000000000000000000112')
      .set('x-user-role', 'tenant')
      .attach('file', big, { filename: 'big.pdf', contentType: 'application/pdf' })
      .field('type', 'nomina');
    expect(res.status).toBe(413);
    expect(res.body?.code).toBe('file_too_large');
  });
});
