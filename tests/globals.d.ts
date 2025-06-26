// TypeScript global type definitions for tests
// This file ensures TypeScript recognizes global test utilities

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

export {};
