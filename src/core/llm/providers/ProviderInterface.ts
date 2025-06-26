/**
 * Provider Interface and Configuration
 * Defines the common interface for all LLM providers
 */

export type ProviderType = 'openai' | 'anthropic' | 'azure';

export interface ProviderConfig {
  name: ProviderType;
  apiKeyPattern: RegExp;
  defaultModel: string;
  supportedModels: string[];
  maxTokensLimit: number;
  temperatureRange: [number, number];
}

export interface ValidationResult {
  valid: boolean;
  message: string;
  details?: Record<string, unknown>;
}

export interface ProviderValidator {
  validateApiKey(key: string): Promise<ValidationResult>;
  validateModel(model: string): boolean;
  testConnection(key: string): Promise<ValidationResult>;
}

// Provider configurations
export const PROVIDER_CONFIGS: Record<string, ProviderConfig> = {
  openai: {
    name: 'openai',
    apiKeyPattern: /^sk-[a-zA-Z0-9\-_]{40,}$/,
    defaultModel: 'gpt-4o-mini',
    supportedModels: ['gpt-4o-mini', 'gpt-4o', 'gpt-4-turbo', 'gpt-3.5-turbo', 'gpt-4'],
    maxTokensLimit: 4096,
    temperatureRange: [0, 2],
  },
  anthropic: {
    name: 'anthropic',
    apiKeyPattern: /^sk-ant-[a-zA-Z0-9\-_]{40,}$/,
    defaultModel: 'claude-3-haiku',
    supportedModels: ['claude-3-haiku', 'claude-3-sonnet', 'claude-3-opus', 'claude-3-5-sonnet'],
    maxTokensLimit: 4096,
    temperatureRange: [0, 1],
  },
  azure: {
    name: 'azure',
    apiKeyPattern: /^[a-zA-Z0-9]{32,}$/,
    defaultModel: 'gpt-4',
    supportedModels: ['gpt-4', 'gpt-4-turbo', 'gpt-35-turbo', 'gpt-4o-mini'],
    maxTokensLimit: 4096,
    temperatureRange: [0, 2],
  },
};

export default PROVIDER_CONFIGS;
