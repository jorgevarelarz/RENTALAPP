import crypto from 'crypto';
import { encryptIBAN, decryptIBAN } from '../../src/utils/payment';

describe('IBAN encryption', () => {
  const validKey = 'a'.repeat(64);

  beforeEach(() => {
    process.env.IBAN_ENCRYPTION_KEY = validKey;
  });

  it('realiza round-trip correcto', () => {
    const iban = 'ES7921000813610123456789';
    const encrypted = encryptIBAN(iban);
    const decrypted = decryptIBAN(encrypted);
    expect(decrypted).toBe(iban);
    expect(encrypted).not.toBe(iban);
  });

  it('detecta manipulación del ciphertext', () => {
    const iban = 'ES7921000813610123456789';
    const encrypted = encryptIBAN(iban);
    const parts = encrypted.split(':');
    parts[1] = parts[1].slice(0, -2) + 'ff';
    const tampered = parts.join(':');
    expect(() => decryptIBAN(tampered)).toThrow();
  });

  it('exige claves en formato hexadecimal de 32 bytes', () => {
    process.env.IBAN_ENCRYPTION_KEY = 'invalid';
    expect(() => encryptIBAN('ES7921000813610123456789')).toThrow('IBAN_ENCRYPTION_KEY debe tener 64 caracteres hex (32 bytes)');
  });

  it('descifra IBANs almacenados con el formato legado AES-CBC', () => {
    const iban = 'ES7921000813610123456789';
    const key = Buffer.from(validKey, 'hex');
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    const encrypted = Buffer.concat([cipher.update(iban, 'utf8'), cipher.final()]);
    const legacyPayload = `${iv.toString('hex')}:${encrypted.toString('hex')}`;

    const decrypted = decryptIBAN(legacyPayload);
    expect(decrypted).toBe(iban);
  });
});
