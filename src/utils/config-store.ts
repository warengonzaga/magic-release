/**
 * Configuration Store for MagicRelease
 * Uses conf package for secure storage, following Magic Commit's pattern
 */

import Conf from 'conf';

import type { MagicReleaseConfig } from '../types/index.js';
import type { ProviderType } from '../core/llm/providers/ProviderInterface.js';

import { ConfigError, createInvalidAPIKeyError, createMissingAPIKeyError } from './errors.js';
import { getProjectConfig } from './project-config.js';
import { logger } from './logger.js';

// Configuration interface
interface StoredConfig {
  openai?: string;
  anthropic?: string;
  azure?: string;
  provider?: ProviderType;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  // Azure-specific
  azureEndpoint?: string;
  azureApiVersion?: string;
  azureDeploymentName?: string;
  // OpenAI-specific
  openaiBaseURL?: string;
  openaiOrganization?: string;
}

// Initialize conf with project name and test support
const config = new Conf<StoredConfig>({
  projectName: 'magicr',
  // Use test-specific config directory when in test environment
  ...(process.env['NODE_ENV'] === 'test' && {
    configFileMode: 0o600,
    projectName: 'magicr-test',
    cwd: process.cwd(),
  }),
});

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
      /^sk-[a-zA-Z0-9\-_]{48,}$/, // Generic fallback for future formats
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
          Authorization: `Bearer ${apiKey}`,
          'User-Agent': 'MagicRelease/0.1.0',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.status === 200) {
        return true;
      } else if (response.status === 401) {
        logger.warn('API key validation failed: Invalid credentials');
        return false;
      } else if (response.status === 429) {
        logger.warn('API key validation failed: Rate limit exceeded, but key format is valid');
        // If we hit rate limits, the key is likely valid
        return true;
      } else {
        logger.warn(
          `API validation returned status ${response.status}, assuming key is valid due to network/service issues`
        );
        // For other status codes, assume key is valid to avoid blocking users
        return true;
      }
    } catch (fetchError: any) {
      clearTimeout(timeoutId);

      if (fetchError.name === 'AbortError') {
        logger.warn('API key validation timed out, assuming key is valid');
        return true; // Timeout - assume valid to not block user
      }

      logger.warn(
        'Network error during API key validation, assuming key is valid:',
        fetchError.message
      );
      return true; // Network errors - assume valid to not block user
    }
  } catch (error) {
    logger.warn('Error while validating API key format:', error);
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
    logger.info('✅ OpenAI API key saved (validation skipped)');
    return;
  }

  logger.info('🔍 Validating OpenAI API key...');
  const isValid = await isValidOpenAIKey(key);
  if (isValid) {
    config.set('openai', key);
    config.set('provider', 'openai');
    logger.info('✅ OpenAI API key is valid and saved');
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
  logger.info('⚠️ OpenAI API key saved without validation');
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
  logger.info('🗑️ OpenAI API key deleted');
};

/**
 * Get current provider
 */
export const getCurrentProvider = (): string | undefined => {
  return config.get('provider');
};

/**
 * Set current provider with validation
 */
export const setCurrentProvider = (provider: ProviderType): void => {
  // Check if the provider has a saved key
  const apiKey = config.get(provider);
  if (!apiKey) {
    throw createMissingAPIKeyError(provider);
  }

  config.set('provider', provider);
  logger.info(`✅ Switched to ${provider} provider`);
};

/**
 * Set API key for any provider with validation
 */
export const setProviderApiKey = async (
  provider: ProviderType,
  key: string,
  skipValidation = false
): Promise<void> => {
  if (!skipValidation) {
    logger.info(`🔍 Validating ${provider} API key...`);

    // Use the provider-specific validation
    const isValid = await validateProviderApiKey(provider, key);
    if (!isValid.valid) {
      throw createInvalidAPIKeyError(provider);
    }

    logger.info(`✅ ${provider} API key is valid and saved`);
  } else {
    logger.info(`⚠️ ${provider} API key saved without validation`);
  }

  config.set(provider, key);
  config.set('provider', provider);
};

/**
 * Set API key for any provider without validation
 */
export const setProviderApiKeyUnsafe = (provider: ProviderType, key: string): void => {
  config.set(provider, key);
  config.set('provider', provider);
  logger.info(`⚠️ ${provider} API key saved without validation`);
};

/**
 * Get API key for specific provider
 */
export const getProviderApiKey = (provider: ProviderType): string | undefined => {
  return config.get(provider);
};

/**
 * Delete API key for specific provider
 */
export const deleteProviderApiKey = (provider: ProviderType): void => {
  config.delete(provider);
  if (config.get('provider') === provider) {
    config.delete('provider');
  }
  logger.info(`🗑️ ${provider} API key deleted`);
};

/**
 * Validate API key for any provider
 */
async function validateProviderApiKey(
  provider: ProviderType,
  key: string
): Promise<{ valid: boolean; message: string }> {
  // Use the provider factory to create a provider and test the connection
  try {
    const { ProviderFactory } = await import('../core/llm/ProviderFactory.js');

    // Create a basic config for validation
    const testProvider = ProviderFactory.createProviderFromConfig(provider, key);
    const result = await testProvider.testConnection(key);

    return {
      valid: result.valid,
      message: result.message,
    };
  } catch (error) {
    return {
      valid: false,
      message: `Validation failed: ${(error as Error).message}`,
    };
  }
}

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
 * List all providers and their key status
 */
export const listAllProviders = (): {
  provider: ProviderType;
  hasKey: boolean;
  isCurrent: boolean;
}[] => {
  const currentProvider = getCurrentProvider();
  const providers: ProviderType[] = ['openai', 'anthropic', 'azure'];

  return providers.map(provider => ({
    provider,
    hasKey: Boolean(config.get(provider)),
    isCurrent: provider === currentProvider,
  }));
};

/**
 * Clear all configuration
 */
export const clearAllConfig = (): void => {
  config.clear();
  logger.info('🧹 All configuration cleared');
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
 * Azure-specific configuration
 */
export const setAzureEndpoint = (endpoint: string): void => {
  config.set('azureEndpoint', endpoint);
};

export const getAzureEndpoint = (): string | undefined => {
  return config.get('azureEndpoint');
};

export const setAzureApiVersion = (version: string): void => {
  config.set('azureApiVersion', version);
};

export const getAzureApiVersion = (): string => {
  return config.get('azureApiVersion') || '2024-02-15-preview';
};

export const setAzureDeploymentName = (name: string): void => {
  config.set('azureDeploymentName', name);
};

export const getAzureDeploymentName = (): string | undefined => {
  return config.get('azureDeploymentName');
};

/**
 * OpenAI-specific configuration
 */
export const setOpenAIBaseURL = (url: string): void => {
  config.set('openaiBaseURL', url);
};

export const getOpenAIBaseURL = (): string | undefined => {
  return config.get('openaiBaseURL');
};

export const setOpenAIOrganization = (org: string): void => {
  config.set('openaiOrganization', org);
};

export const getOpenAIOrganization = (): string | undefined => {
  return config.get('openaiOrganization');
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
    errors,
  };
};

/**
 * Get complete configuration object for MagicRelease
 * Merges global user config (API keys) with project-level config (.magicrrc)
 */
export const getConfig = (): MagicReleaseConfig => {
  const provider = (getCurrentProvider() as ProviderType) || 'openai';

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

  // Add provider-specific LLM properties
  if (provider === 'azure' || config.llm.provider === 'azure') {
    const endpoint = getAzureEndpoint();
    const apiVersion = getAzureApiVersion();
    const deploymentName = getAzureDeploymentName();

    if (endpoint) config.llm.endpoint = endpoint;
    if (apiVersion) config.llm.apiVersion = apiVersion;
    if (deploymentName) config.llm.deploymentName = deploymentName;
  }

  if (provider === 'openai' || config.llm.provider === 'openai') {
    const baseURL = getOpenAIBaseURL();
    const organization = getOpenAIOrganization();

    if (baseURL) config.llm.baseURL = baseURL;
    if (organization) config.llm.organization = organization;
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
export const testAPIKey = async (
  apiKey: string
): Promise<{ valid: boolean; message: string; details?: any }> => {
  try {
    // Basic format validation first
    if (!apiKey || typeof apiKey !== 'string') {
      return {
        valid: false,
        message: 'Invalid API key format. API key must be a non-empty string.',
      };
    }

    if (!apiKey.startsWith('sk-') || apiKey.length < 50) {
      return {
        valid: false,
        message:
          'Invalid API key format. OpenAI keys should start with "sk-" and be at least 50 characters long.',
      };
    }

    logger.info('🔍 Testing API key connectivity...');

    // Test with a simple API call
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout for testing

    try {
      const response = await fetch('https://api.openai.com/v1/models', {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'User-Agent': 'MagicRelease/0.1.0',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.status === 200) {
        const data = (await response.json()) as { data?: any[] };
        const modelCount = data.data?.length || 0;
        return {
          valid: true,
          message: `✅ API key is valid! Found ${modelCount} available models.`,
          details: {
            status: response.status,
            modelCount,
            timestamp: new Date().toISOString(),
          },
        };
      } else if (response.status === 401) {
        return {
          valid: false,
          message: '❌ API key is invalid. Please check your key and try again.',
          details: { status: response.status },
        };
      } else if (response.status === 429) {
        return {
          valid: true,
          message: '⚠️ API key is valid but rate limited. Try again in a moment.',
          details: { status: response.status },
        };
      } else if (response.status === 403) {
        return {
          valid: false,
          message:
            '❌ API key is valid but access is forbidden. Check your OpenAI account permissions.',
          details: { status: response.status },
        };
      } else {
        const errorText = await response.text().catch(() => 'Unknown error');
        return {
          valid: false,
          message: `⚠️ Unexpected response from OpenAI API (${response.status}). The key might be valid but there's a service issue.`,
          details: { status: response.status, error: errorText },
        };
      }
    } catch (fetchError: any) {
      clearTimeout(timeoutId);

      if (fetchError.name === 'AbortError') {
        return {
          valid: false,
          message: '⏱️ API test timed out. Check your internet connection or try again.',
          details: { error: 'Timeout after 15 seconds' },
        };
      }

      return {
        valid: false,
        message: `🌐 Network error: ${fetchError.message}. Check your internet connection.`,
        details: { error: fetchError.message },
      };
    }
  } catch (error: any) {
    return {
      valid: false,
      message: `❌ Unexpected error: ${error.message}`,
      details: { error: error.message },
    };
  }
};

/**
 * Auto-detect provider from API key format
 */
export const detectProviderFromKey = (apiKey: string): ProviderType | null => {
  if (!apiKey || typeof apiKey !== 'string') {
    return null;
  }

  // Anthropic keys start with 'sk-ant-' (check this first before OpenAI)
  if (apiKey.startsWith('sk-ant-')) {
    return 'anthropic';
  }

  // OpenAI keys start with 'sk-' but not 'sk-ant-'
  if (apiKey.startsWith('sk-') && !apiKey.startsWith('sk-ant-')) {
    return 'openai';
  }

  // Azure keys are typically UUIDs or custom formats
  // For now, if it's not OpenAI or Anthropic, assume Azure
  if (apiKey.length >= 32) {
    return 'azure';
  }

  return null;
};
