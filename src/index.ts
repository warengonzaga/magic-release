/**
 * MagicRelease - Main export file
 * AI-powered changelog generator following Keep a Changelog format
 */

// Export types
export type * from './types/index.js';

// Export utilities
export * from './utils/config-store.js';
export * from './utils/errors.js';
export * from './utils/logger.js';

// Export constants
export * from './constants/index.js';

// Export version
export const version = '0.1.0';

// Default export
export default {
  version,
};
