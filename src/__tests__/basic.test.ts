/**
 * Simple test to validate Jest setup
 */

describe('Jest Setup Test', () => {
  it('should run basic JavaScript test', () => {
    expect(1 + 1).toBe(2);
  });

  it('should handle async operations', async () => {
    const result = await Promise.resolve('test');
    expect(result).toBe('test');
  });
});
