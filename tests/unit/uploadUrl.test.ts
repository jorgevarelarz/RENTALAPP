import { isOwnUploadUrl } from '../../src/utils/uploadUrl';

describe('isOwnUploadUrl', () => {
  const env = { ...process.env };
  afterEach(() => { process.env = { ...env }; });

  it('sin configuración solo acepta /uploads/<nombre>', () => {
    delete process.env.UPLOADS_BASE_URL;
    delete process.env.APP_URL;
    delete process.env.FRONTEND_URL;
    expect(isOwnUploadUrl('/uploads/1757758651861_lvp8vdrzgle.PNG')).toBe(true);
    expect(isOwnUploadUrl('/uploads/abc.jpg')).toBe(true);
    // Antes cualquier http(s) valía
    expect(isOwnUploadUrl('https://evil.example.com/pixel.gif')).toBe(false);
    expect(isOwnUploadUrl('/uploads/contracts/a.pdf')).toBe(false);
    expect(isOwnUploadUrl('/uploads/..%2Fa')).toBe(false);
    expect(isOwnUploadUrl('/uploads/')).toBe(false);
  });

  it('acepta la misma ruta bajo APP_URL y FRONTEND_URL', () => {
    delete process.env.UPLOADS_BASE_URL;
    process.env.APP_URL = 'https://app.rentalapp.es/';
    process.env.FRONTEND_URL = 'https://www.rentalapp.es';
    expect(isOwnUploadUrl('https://app.rentalapp.es/uploads/abc.webp')).toBe(true);
    expect(isOwnUploadUrl('https://www.rentalapp.es/uploads/abc.webp')).toBe(true);
    expect(isOwnUploadUrl('https://app.rentalapp.es.evil.com/uploads/abc.webp')).toBe(false);
    expect(isOwnUploadUrl('https://app.rentalapp.es/uploadsX/abc.webp')).toBe(false);
  });
});
