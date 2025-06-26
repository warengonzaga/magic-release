/** @type {import('jest').Config} */
export default {
  preset: 'ts-jest',
  testEnvironment: 'node',
  
  // Test file patterns
  testMatch: [
    '**/tests/**/*.test.ts',
    '**/tests/**/*.spec.ts',
    '**/__tests__/**/*.ts'
  ],
  
  // Coverage configuration - disabled due to ESM/CommonJS mismatch
  collectCoverage: false, // Enable later when ESM issues are resolved
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/cli/**/*', // Exclude CLI components for now
    '!src/**/index.ts' // Exclude index files
  ],
  
  // Transform configuration with custom tsconfig
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      tsconfig: 'tsconfig.test.json'
    }]
  },
  
  // Module resolution
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^(.+)\\.js$': '$1'  // Map .js imports to .ts files
  },
  
  extensionsToTreatAsEsm: ['.ts'],
  
  // Setup files
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  
  // Timeout for tests
  testTimeout: 30000,
  
  // Mock configuration
  clearMocks: true,
  restoreMocks: true,
  
  // Verbose output
  verbose: true
};
