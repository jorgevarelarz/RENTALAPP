import { sanitizeOAuthRedirect } from '../../src/services/oauth.service';

describe('sanitizeOAuthRedirect', () => {
  it('keeps in-app paths', () => {
    expect(sanitizeOAuthRedirect('/landlord/properties')).toBe('/landlord/properties');
    expect(sanitizeOAuthRedirect('/')).toBe('/');
  });

  it('falls back to the role home when the value is unusable', () => {
    expect(sanitizeOAuthRedirect(undefined)).toBe('/tenant');
    expect(sanitizeOAuthRedirect('', 'landlord')).toBe('/landlord');
    expect(sanitizeOAuthRedirect('https://evil.com', 'pro')).toBe('/pro');
    expect(sanitizeOAuthRedirect('evil.com')).toBe('/tenant');
  });

  it('rejects protocol-relative escapes, including the backslash variant', () => {
    expect(sanitizeOAuthRedirect('//evil.com')).toBe('/tenant');
    expect(sanitizeOAuthRedirect('/\\evil.com')).toBe('/tenant');
    expect(sanitizeOAuthRedirect('/\\\\evil.com', 'landlord')).toBe('/landlord');
  });

  it('rejects control characters that browsers strip from URLs', () => {
    expect(sanitizeOAuthRedirect('/\t/evil.com')).toBe('/tenant');
    expect(sanitizeOAuthRedirect('/\n/evil.com')).toBe('/tenant');
    expect(sanitizeOAuthRedirect('/%09/evil.com')).toBe('/%09/evil.com'); // codificado, el navegador no lo decodifica en el path
  });
});
