export function getInstitutionCaseIdSalt(): string {
  const salt = process.env.INSTITUTION_CASEID_SALT || process.env.JWT_SECRET;
  const isProd = process.env.NODE_ENV === 'production';

  if (!salt && isProd) {
    throw new Error('INSTITUTION_CASEID_SALT is required in production');
  }
  if (!salt) {
    console.warn('WARNING: INSTITUTION_CASEID_SALT not set, using test-only-institution-salt');
  }

  return salt || 'test-only-institution-salt';
}
