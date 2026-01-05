module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/src/__tests__/**/*.test.ts', '**/tests/**/!(*.e2e).test.ts'],
  // Backend integration tests can be slow on CI runners
  testTimeout: 60000,
  // Asegura que Jest salga al finalizar (evita quedarse esperando por handles abiertos)
  forceExit: true,
  // Ignore frontend React tests here; they require a jsdom setup.
  // Frontend tests should run with the frontend tooling/config instead.
  testPathIgnorePatterns: ['/node_modules/', '<rootDir>/frontend/'],
  transform: {
    '^.+\\.(t|j)sx?$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
  },
  setupFiles: ['<rootDir>/jest.setup.ts'],
};
