/**
 * Test to verify globals are available
 * These tests verify that the Jest setup correctly provides global test utilities
 */

describe('Test Globals', () => {
  it('should have TEST_CONSTANTS available', () => {
    expect((global as any).TEST_CONSTANTS).toBeDefined();
    expect((global as any).TEST_CONSTANTS.VALID_OPENAI_KEY).toBeDefined();
    expect((global as any).TEST_CONSTANTS.VALID_ANTHROPIC_KEY).toBeDefined();
    expect((global as any).TEST_CONSTANTS.VALID_AZURE_KEY).toBeDefined();
  });

  it('should have mockAPIResponse available', () => {
    expect((global as any).mockAPIResponse).toBeDefined();
    expect(typeof (global as any).mockAPIResponse).toBe('function');
  });

  it('should have mockAPIError available', () => {
    expect((global as any).mockAPIError).toBeDefined();
    expect(typeof (global as any).mockAPIError).toBe('function');
  });
});
