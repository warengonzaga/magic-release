/**
 * Test to verify globals are available
 */

describe('Test Globals', () => {
  it('should have TEST_CONSTANTS available', () => {
    expect(TEST_CONSTANTS).toBeDefined();
    expect(TEST_CONSTANTS.VALID_OPENAI_KEY).toBeDefined();
  });

  it('should have mockAPIResponse available', () => {
    expect(mockAPIResponse).toBeDefined();
    expect(typeof mockAPIResponse).toBe('function');
  });

  it('should have mockAPIError available', () => {
    expect(mockAPIError).toBeDefined();
    expect(typeof mockAPIError).toBe('function');
  });
});
