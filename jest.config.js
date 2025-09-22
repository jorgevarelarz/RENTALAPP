module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/src/__tests__/**/*.test.ts', '**/tests/**/*.test.ts'],
  testTimeout: 30000,
  // Ignore frontend React tests here; they require a jsdom setup.
  // Frontend tests should run with the frontend tooling/config instead.
  testPathIgnorePatterns: ['/node_modules/', '<rootDir>/frontend/'],
  transform: {
    '^.+\\.(t|j)sx?$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
  },
};
