const baseConfig = require('./jest.config');

module.exports = {
  ...baseConfig,
  testMatch: ['**/tests/e2e/**/*.e2e.test.ts'],
};