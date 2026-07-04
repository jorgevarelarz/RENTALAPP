module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/src/__tests__/**/*.test.ts', '**/tests/**/!(*.e2e).test.ts'],
  // Backend integration tests can be slow on CI runners
  testTimeout: 60000,
  // Ignore frontend React tests here; they require a jsdom setup.
  // Frontend tests should run with the frontend tooling/config instead.
  testPathIgnorePatterns: [
    '/node_modules/',
    '<rootDir>/node_modules 2/',
    '<rootDir>/dist/',
    '<rootDir>/dist 2/',
    '<rootDir>/frontend/',
    '<rootDir>/institution-frontend/',
  ],
  modulePathIgnorePatterns: [
    '<rootDir>/node_modules 2/',
    '<rootDir>/dist 2/',
    '<rootDir>/frontend/',
    '<rootDir>/institution-frontend/',
    '<rootDir>/institution-frontend/node_modules 2/',
  ],
  transform: {
    '^.+\\.(t|j)sx?$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json', diagnostics: false }],
  },
  setupFiles: ['<rootDir>/jest.setup.ts'],
};
