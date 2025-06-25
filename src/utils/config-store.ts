/**
 * Configuration Store for MagicRelease
 * Uses conf package for secure storage, following Magic Commit's pattern
 */

import Conf from 'conf';

import type { MagicReleaseConfig } from '../types/index.js';
import { ConfigError, createInvalidAPIKeyError, createMissingAPIKeyError } from './errors.js';
import { getProjectConfig } from './project-config.js';

// Configuration interface
interface StoredConfig {
  openai?: string;
  anthropic?: string;
  azure?: string;
  provider?: 'openai' | 'anthropic' | 'azure';
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

// Initialize conf with project name
const config = new Conf<StoredConfig>({ projectName: 'magicr' });

/**
 * Validate OpenAI API key format and connectivity
 */
export const isValidOpenAIKey = async (apiKey: string): Promise<boolean> => {
  try {
    // Basic format validation - support different OpenAI key formats
    if (!apiKey || typeof apiKey !== 'string') {
      return false;
    }

    // Check if it starts with sk- and has reasonable length
    if (!apiKey.startsWith('sk-') || apiKey.length < 50) {
      return false;
    }

    // Support different OpenAI key formats
    const validPatterns = [
      /^sk-[a-zA-Z0-9]{48}$/, // Legacy format
      /^sk-proj-[a-zA-Z0-9\-_]{40,}$/, // Project format
      /^sk-org-[a-zA-Z0-9\-_]{40,}$/, // Organization format
      /^sk-[a-zA-Z0-9\-_]{48,}$/ // Generic fallback for future formats
    ];

    const hasValidFormat = validPatterns.some(pattern => pattern.test(apiKey));
    if (!hasValidFormat) {
      return false;
    }

    // Try to validate with OpenAI API
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

    try {
      const response = await fetch('https://api.openai.com/v1/models', {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'User-Agent': 'MagicRelease/0.1.0'
        },
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (response.status === 200) {
        return true;
      } else if (response.status === 401) {
        console.warn('API key validation failed: Invalid credentials');
        return false;
      } else if (response.status === 429) {
        console.warn('API key validation failed: Rate limit exceeded, but key format is valid');
        // If we hit rate limits, the key is likely valid
        return true;
      } else {
        console.warn(`API validation returned status ${response.status}, assuming key is valid due to network/service issues`);
        // For other status codes, assume key is valid to avoid blocking users
        return true;
      }
    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      
      if (fetchError.name === 'AbortError') {
        console.warn('API key validation timed out, assuming key is valid');
        return true; // Timeout - assume valid to not block user
      }
      
      console.warn('Network error during API key validation, assuming key is valid:', fetchError.message);
      return true; // Network errors - assume valid to not block user
    }
  } catch (error) {
    console.warn('Error while validating API key format:', error);
    return false;
  }
};

/**
 * Set OpenAI API key with validation
 */
export const setOpenAIKey = async (key: string, skipValidation = false): Promise<void> => {
  if (skipValidation) {
    // Basic format check only
    if (!key || typeof key !== 'string' || !key.startsWith('sk-') || key.length < 50) {
      throw createInvalidAPIKeyError('OpenAI');
    }
    config.set('openai', key);
    config.set('provider', 'openai');
    console.log('✅ OpenAI API key saved (validation skipped)');
    return;
  }

  console.log('🔍 Validating OpenAI API key...');
  const isValid = await isValidOpenAIKey(key);
  if (isValid) {
    config.set('openai', key);
    config.set('provider', 'openai');
    console.log('✅ OpenAI API key is valid and saved');
  } else {
    throw createInvalidAPIKeyError('OpenAI');
  }
};

/**
 * Set OpenAI API key without validation (for offline or connectivity issues)
 */
export const setOpenAIKeyUnsafe = (key: string): void => {
  if (!key || typeof key !== 'string' || !key.startsWith('sk-') || key.length < 50) {
    throw createInvalidAPIKeyError('OpenAI');
  }
  config.set('openai', key);
  config.set('provider', 'openai');
  console.log('⚠️ OpenAI API key saved without validation');
};

/**
 * Get OpenAI API key
 */
export const getOpenAIKey = (): string | undefined => {
  return config.get('openai');
};

/**
 * Delete OpenAI API key
 */
export const deleteOpenAIKey = (): void => {
  config.delete('openai');
  if (config.get('provider') === 'openai') {
    config.delete('provider');
  }
  console.log('🗑️ OpenAI API key deleted');
};

/**
 * Get current provider
 */
export const getCurrentProvider = (): string | undefined => {
  return config.get('provider');
};

/**
 * Set current provider
 */
export const setCurrentProvider = (provider: 'openai' | 'anthropic' | 'azure'): void => {
  config.set('provider', provider);
};

/**
 * Get API key for current provider
 */
export const getCurrentAPIKey = (): string => {
  const provider = getCurrentProvider();
  
  if (!provider) {
    throw new ConfigError('No provider configured. Run magicr config to set up your API key.');
  }

  const apiKey = config.get(provider) as string;
  
  if (!apiKey) {
    throw createMissingAPIKeyError(provider);
  }

  return apiKey;
};

/**
 * Check if user has a valid configuration
 */
export const hasValidConfig = (): boolean => {
  const provider = getCurrentProvider();
  if (!provider) return false;
  
  const apiKey = config.get(provider);
  return Boolean(apiKey);
};

/**
 * Get all configuration
 */
export const getAllConfig = (): StoredConfig => {
  return config.store;
};

/**
 * Clear all configuration
 */
export const clearAllConfig = (): void => {
  config.clear();
  console.log('🧹 All configuration cleared');
};

/**
 * Set model configuration
 */
export const setModel = (model: string): void => {
  config.set('model', model);
};

/**
 * Get model configuration
 */
export const getModel = (): string => {
  return config.get('model') || 'gpt-4o-mini'; // Default model like Magic Commit
};

/**
 * Set temperature configuration
 */
export const setTemperature = (temperature: number): void => {
  if (temperature < 0 || temperature > 2) {
    throw new ConfigError('Temperature must be between 0 and 2');
  }
  config.set('temperature', temperature);
};

/**
 * Get temperature configuration
 */
export const getTemperature = (): number => {
  return config.get('temperature') || 0.1; // Low temperature for consistent outputs
};

/**
 * Set max tokens configuration
 */
export const setMaxTokens = (maxTokens: number): void => {
  if (maxTokens < 1 || maxTokens > 4096) {
    throw new ConfigError('Max tokens must be between 1 and 4096');
  }
  config.set('maxTokens', maxTokens);
};

/**
 * Get max tokens configuration
 */
export const getMaxTokens = (): number => {
  return config.get('maxTokens') || 150; // Reasonable default for commit messages
};

/**
 * Get configuration file path for debugging
 */
export const getConfigPath = (): string => {
  return config.path;
};

/**
 * Validate configuration integrity
 */
export const validateConfig = (): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];
  
  const provider = getCurrentProvider();
  if (provider) {
    const apiKey = config.get(provider);
    if (!apiKey) {
      errors.push(`Missing API key for provider: ${provider}`);
    }
  } else {
    errors.push('No provider configured');
  }

  const temperature = config.get('temperature');
  if (temperature !== undefined && (temperature < 0 || temperature > 2)) {
    errors.push('Temperature must be between 0 and 2');
  }

  const maxTokens = config.get('maxTokens');
  if (maxTokens !== undefined && (maxTokens < 1 || maxTokens > 4096)) {
    errors.push('Max tokens must be between 1 and 4096');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

/**
 * Get complete configuration object for MagicRelease
 * Merges global user config (API keys) with project-level config (.magicrrc)
 */
export const getConfig = (): MagicReleaseConfig => {
  const provider = getCurrentProvider() as 'openai' | 'anthropic' | 'azure' || 'openai';
  
  // Get project-level configuration from .magicrrc file
  const projectConfig = getProjectConfig();
  
  // Get API key safely (might be undefined)
  let apiKey: string | undefined;
  try {
    apiKey = getCurrentAPIKey();
  } catch {
    // API key not configured yet - this is okay for initial setup
    apiKey = undefined;
  }

  // Build the merged configuration step by step
  const config: MagicReleaseConfig = {
    llm: {
      provider: projectConfig.llm?.provider || provider,
    },
    changelog: {},
    git: {},
    rules: {},
  };

  // Add LLM properties only if they exist
  if (apiKey) {
    config.llm.apiKey = apiKey;
  }
  if (projectConfig.llm?.model || getModel()) {
    config.llm.model = projectConfig.llm?.model || getModel();
  }
  if (projectConfig.llm?.temperature !== undefined || getTemperature() !== undefined) {
    config.llm.temperature = projectConfig.llm?.temperature ?? getTemperature();
  }
  if (projectConfig.llm?.maxTokens !== undefined || getMaxTokens() !== undefined) {
    config.llm.maxTokens = projectConfig.llm?.maxTokens ?? getMaxTokens();
  }

  // Add changelog properties
  if (projectConfig.changelog?.filename || 'CHANGELOG.md') {
    config.changelog.filename = projectConfig.changelog?.filename || 'CHANGELOG.md';
  }
  if (projectConfig.changelog?.includeCommitLinks !== undefined || true) {
    config.changelog.includeCommitLinks = projectConfig.changelog?.includeCommitLinks ?? true;
  }
  if (projectConfig.changelog?.includePRLinks !== undefined || true) {
    config.changelog.includePRLinks = projectConfig.changelog?.includePRLinks ?? true;
  }
  if (projectConfig.changelog?.includeIssueLinks !== undefined || true) {
    config.changelog.includeIssueLinks = projectConfig.changelog?.includeIssueLinks ?? true;
  }
  if (projectConfig.changelog?.linkFormat) {
    config.changelog.linkFormat = {};
    if (projectConfig.changelog.linkFormat.compare) {
      config.changelog.linkFormat.compare = projectConfig.changelog.linkFormat.compare;
    }
    if (projectConfig.changelog.linkFormat.commit) {
      config.changelog.linkFormat.commit = projectConfig.changelog.linkFormat.commit;
    }
    if (projectConfig.changelog.linkFormat.issue) {
      config.changelog.linkFormat.issue = projectConfig.changelog.linkFormat.issue;
    }
    if (projectConfig.changelog.linkFormat.pr) {
      config.changelog.linkFormat.pr = projectConfig.changelog.linkFormat.pr;
    }
  }

  // Add git properties
  if (projectConfig.git?.tagPattern || 'v*') {
    config.git.tagPattern = projectConfig.git?.tagPattern || 'v*';
  }
  if (projectConfig.git?.remote || 'origin') {
    config.git.remote = projectConfig.git?.remote || 'origin';
  }
  if (projectConfig.git?.repository) {
    config.git.repository = projectConfig.git.repository;
  }

  // Add rules properties
  if (projectConfig.rules?.minCommitsForUpdate !== undefined || 1) {
    if (!config.rules) config.rules = {};
    config.rules.minCommitsForUpdate = projectConfig.rules?.minCommitsForUpdate ?? 1;
  }
  if (projectConfig.rules?.includePreReleases !== undefined || false) {
    if (!config.rules) config.rules = {};
    config.rules.includePreReleases = projectConfig.rules?.includePreReleases ?? false;
  }
  if (projectConfig.rules?.groupUnreleasedCommits !== undefined || true) {
    if (!config.rules) config.rules = {};
    config.rules.groupUnreleasedCommits = projectConfig.rules?.groupUnreleasedCommits ?? true;
  }
  
  return config;
};

/**
 * Test API key connectivity without setting it
 */
export const testAPIKey = async (apiKey: string): Promise<{ valid: boolean; message: string; details?: any }> => {
  try {
    // Basic format validation first
    if (!apiKey || typeof apiKey !== 'string') {
      return {
        valid: false,
        message: 'Invalid API key format. API key must be a non-empty string.'
      };
    }

    if (!apiKey.startsWith('sk-') || apiKey.length < 50) {
      return {
        valid: false,
        message: 'Invalid API key format. OpenAI keys should start with "sk-" and be at least 50 characters long.'
      };
    }

    console.log('🔍 Testing API key connectivity...');
    
    // Test with a simple API call
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout for testing

    try {
      const response = await fetch('https://api.openai.com/v1/models', {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'User-Agent': 'MagicRelease/0.1.0'
        },
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (response.status === 200) {
        const data = await response.json() as { data?: any[] };
        const modelCount = data.data?.length || 0;
        return {
          valid: true,
          message: `✅ API key is valid! Found ${modelCount} available models.`,
          details: {
            status: response.status,
            modelCount,
            timestamp: new Date().toISOString()
          }
        };
      } else if (response.status === 401) {
        return {
          valid: false,
          message: '❌ API key is invalid. Please check your key and try again.',
          details: { status: response.status }
        };
      } else if (response.status === 429) {
        return {
          valid: true,
          message: '⚠️ API key is valid but rate limited. Try again in a moment.',
          details: { status: response.status }
        };
      } else if (response.status === 403) {
        return {
          valid: false,
          message: '❌ API key is valid but access is forbidden. Check your OpenAI account permissions.',
          details: { status: response.status }
        };
      } else {
        const errorText = await response.text().catch(() => 'Unknown error');
        return {
          valid: false,
          message: `⚠️ Unexpected response from OpenAI API (${response.status}). The key might be valid but there's a service issue.`,
          details: { status: response.status, error: errorText }
        };
      }
    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      
      if (fetchError.name === 'AbortError') {
        return {
          valid: false,
          message: '⏱️ API test timed out. Check your internet connection or try again.',
          details: { error: 'Timeout after 15 seconds' }
        };
      }
      
      return {
        valid: false,
        message: `🌐 Network error: ${fetchError.message}. Check your internet connection.`,
        details: { error: fetchError.message }
      };
    }
  } catch (error: any) {
    return {
      valid: false,
      message: `❌ Unexpected error: ${error.message}`,
      details: { error: error.message }
    };
  }
};
