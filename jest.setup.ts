process.env.ALLOW_TEST_AUTH = 'true';
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test-only-secret';
