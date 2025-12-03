const baseConfig = require('./jest.config');

module.exports = {
  ...baseConfig,
  testMatch: ['**/tests/e2e/**/*.e2e.test.ts'],
  // Permitir tests e2e en tests/e2e (no ignorar esa carpeta)
  testPathIgnorePatterns: ['/node_modules/', '<rootDir>/frontend/'],
};
