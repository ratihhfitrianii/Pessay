/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/*.test.ts'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  forceExit: true,
  detectOpenHandles: false,
  testTimeout: 30000,
  setupFiles: ['<rootDir>/src/test/setup-env.cjs'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.test.ts',
    '!src/test/**',
    '!src/index.ts',
    '!src/lib/pg.ts',
    '!src/config/env.ts',
  ],
  coverageThreshold: {
    global: {
      lines: 80,
      functions: 80,
      branches: 80,
      statements: 80,
    },
  },
};