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
  
  // Coverage configuration
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/cli/**/*', // Exclude CLI components for now
    '!src/**/index.ts', // Exclude index files
    '!src/utils/config-store.ts', // Exclude due to module resolution issues
    '!src/utils/package-info.ts' // Exclude due to import.meta issues
  ],
  coveragePathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/coverage/',
    'src/utils/package-info.ts' // Exclude this file due to import.meta issues
  ],
  
  // Transform configuration with custom tsconfig
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      tsconfig: 'tsconfig.test.json',
      useESM: true
    }]
  },
  
  // Module resolution
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^(.+)\\.js$': '$1'  // Map .js imports to .ts files
  },
  
  // Handle ES modules
  transformIgnorePatterns: [
    'node_modules/(?!(conf)/)'
  ],
  
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
