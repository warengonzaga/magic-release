/**
 * Magic Release - AI-powered changelog generator
 *
 * Main export file providing public API access to Magic Release functionality.
 * Generates professional changelogs from Git commit history using AI providers
 * like OpenAI, Anthropic, and Azure OpenAI.
 *
 * @example
 * ```typescript
 * import { MagicReleaseConfig, loadConfig } from 'magicr';
 *
 * const config = await loadConfig();
 * // Use Magic Release programmatically
 * ```
 *
 * @version 0.1.0-beta
 * @author Waren Gonzaga <opensource@warengonzaga.com>
 * @license GPL-3.0
 */

// Export types
export type * from './types/index.js';

// Export utilities
export * from './utils/config-store.js';
export * from './utils/errors.js';
export * from './utils/logger.js';

// Export constants
export * from './constants/index.js';

/** Current version of Magic Release */
export const version = '0.1.0-beta';

/** Default export containing version information */
export default {
  version,
};
