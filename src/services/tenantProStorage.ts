import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const DIR = path.resolve(process.cwd(), 'storage/tenant-pro');

function resolveKey() {
  const key = Buffer.from(process.env.TENANT_PRO_UPLOADS_KEY || '', 'hex');
  if (key.length !== 32) {
    throw new Error('TENANT_PRO_UPLOADS_KEY must be a 32-byte hex string');
  }
  return key;
}

export function ensureTenantProDir() {
  fs.mkdirSync(DIR, { recursive: true });
}

export function encryptAndSaveTP(filename: string, buf: Buffer) {
  const key = resolveKey();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  const enc = Buffer.concat([cipher.update(buf), cipher.final()]);
  const file = `${Date.now()}_${filename}.bin`;
  fs.writeFileSync(path.join(DIR, file), Buffer.concat([iv, enc]));
  return file;
}

export function readDecryptedTP(file: string): Buffer {
  const key = resolveKey();
  const raw = fs.readFileSync(path.join(DIR, file));
  const iv = raw.subarray(0, 16);
  const data = raw.subarray(16);
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
  return Buffer.concat([decipher.update(data), decipher.final()]);
}

export function deleteTP(file: string) {
  const p = path.join(DIR, file);
  if (fs.existsSync(p)) fs.unlinkSync(p);
}

export { DIR as TENANT_PRO_DIR };
