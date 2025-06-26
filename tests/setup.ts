/**
 * Jest Test Setup
 * Global configuration and utilities for tests
 */

// Mock external dependencies that require network access
jest.mock('node-fetch', () => {
  return jest.fn();
});

// Mock file system operations for most tests
jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  readFileSync: jest.fn(),
  writeFileSync: jest.fn(),
  existsSync: jest.fn(),
  mkdirSync: jest.fn(),
}));

// Mock the conf package for configuration storage
jest.mock('conf', () => {
  return jest.fn().mockImplementation(() => ({
    get: jest.fn(),
    set: jest.fn(),
    delete: jest.fn(),
    clear: jest.fn(),
    store: {},
    path: '/mock/config/path'
  }));
});

// Global test utilities
global.mockAPIResponse = (status: number, data: any) => {
  const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
  mockFetch.mockResolvedValueOnce({
    ok: status >= 200 && status < 300,
    status,
    json: jest.fn().mockResolvedValue(data),
    text: jest.fn().mockResolvedValue(JSON.stringify(data)),
    statusText: status === 200 ? 'OK' : 'Error'
  } as any);
};

global.mockAPIError = (error: Error) => {
  const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
  mockFetch.mockRejectedValueOnce(error);
};

// Test constants
global.TEST_CONSTANTS = {
  VALID_OPENAI_KEY: 'sk-test1234567890abcdef1234567890abcdef1234567890abcdef12',
  VALID_ANTHROPIC_KEY: 'sk-ant-test1234567890abcdef1234567890abcdef1234567890',
  VALID_AZURE_KEY: '1234567890abcdef1234567890abcdef',
  AZURE_ENDPOINT: 'https://test.openai.azure.com',
  
  SAMPLE_COMMITS: [
    {
      hash: 'abc123',
      message: 'feat: add new feature',
      author: 'Test Author',
      date: new Date('2023-01-01'),
      type: 'feat',
      scope: 'core',
      breaking: false
    },
    {
      hash: 'def456',
      message: 'fix: resolve bug',
      author: 'Test Author',
      date: new Date('2023-01-02'),
      type: 'fix',
      breaking: false
    }
  ],
  
  SAMPLE_CHANGELOG_ENTRY: {
    version: '1.0.0',
    date: new Date('2023-01-01'),
    sections: new Map([
      ['Added', [
        {
          description: 'New feature implementation',
          commits: [{ hash: 'abc123', message: 'feat: add new feature' }],
          scope: 'core'
        }
      ]],
      ['Fixed', [
        {
          description: 'Bug resolution',
          commits: [{ hash: 'def456', message: 'fix: resolve bug' }]
        }
      ]]
    ])
  }
};

// Console methods mocking for cleaner test output
const originalConsole = { ...console };

beforeEach(() => {
  // Reset all mocks before each test
  jest.clearAllMocks();
  
  // Mock console methods to reduce noise in tests
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'info').mockImplementation(() => {});
});

afterEach(() => {
  // Restore console methods
  console.log = originalConsole.log;
  console.warn = originalConsole.warn;
  console.error = originalConsole.error;
  console.info = originalConsole.info;
});

// Global type declarations for TypeScript
declare global {
  function mockAPIResponse(status: number, data: any): void;
  function mockAPIError(error: Error): void;
  
  var TEST_CONSTANTS: {
    VALID_OPENAI_KEY: string;
    VALID_ANTHROPIC_KEY: string;
    VALID_AZURE_KEY: string;
    AZURE_ENDPOINT: string;
    SAMPLE_COMMITS: any[];
    SAMPLE_CHANGELOG_ENTRY: any;
  };
}

// Make this file a module
export {};
