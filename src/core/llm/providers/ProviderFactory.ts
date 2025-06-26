/**
 * Provider Factory
 * Creates provider instances based on configuration
 */

import type { MagicReleaseConfig } from '../../../types/interfaces.js';
import { LLMError } from '../../../utils/errors.js';
import { logger } from '../../../utils/logger.js';

import type { ProviderType } from './ProviderInterface.js';
import { OpenAIProvider } from './OpenAIProvider.js';
import { AnthropicProvider } from './AnthropicProvider.js';
import { AzureProvider } from './AzureProvider.js';

export class ProviderFactory {
  /**
   * Create a provider instance based on configuration
   */
  static createProvider(
    config: MagicReleaseConfig
  ): OpenAIProvider | AnthropicProvider | AzureProvider {
    const { provider, ...providerConfig } = config.llm;

    logger.debug(`Creating ${provider} provider`);

    switch (provider) {
      case 'openai': {
        const openaiConfig = {
          apiKey: providerConfig.apiKey ?? '',
        } as Record<string, unknown>;
        if (providerConfig.model) openaiConfig['model'] = providerConfig.model;
        if (providerConfig.temperature !== undefined)
          openaiConfig['temperature'] = providerConfig.temperature;
        if (providerConfig.maxTokens !== undefined)
          openaiConfig['maxTokens'] = providerConfig.maxTokens;
        if (providerConfig.baseURL) openaiConfig['baseURL'] = providerConfig.baseURL;
        if (providerConfig.organization) openaiConfig['organization'] = providerConfig.organization;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return new OpenAIProvider(openaiConfig as any);
      }

      case 'anthropic': {
        const anthropicConfig = {
          apiKey: providerConfig.apiKey ?? '',
        } as Record<string, unknown>;
        if (providerConfig.model) anthropicConfig['model'] = providerConfig.model;
        if (providerConfig.temperature !== undefined)
          anthropicConfig['temperature'] = providerConfig.temperature;
        if (providerConfig.maxTokens !== undefined)
          anthropicConfig['maxTokens'] = providerConfig.maxTokens;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return new AnthropicProvider(anthropicConfig as any);
      }

      case 'azure': {
        const azureConfig = {
          apiKey: providerConfig.apiKey ?? '',
          endpoint: providerConfig.endpoint ?? '',
        } as Record<string, unknown>;
        if (providerConfig.model) azureConfig['model'] = providerConfig.model;
        if (providerConfig.temperature !== undefined)
          azureConfig['temperature'] = providerConfig.temperature;
        if (providerConfig.maxTokens !== undefined)
          azureConfig['maxTokens'] = providerConfig.maxTokens;
        if (providerConfig.apiVersion) azureConfig['apiVersion'] = providerConfig.apiVersion;
        if (providerConfig.deploymentName)
          azureConfig['deploymentName'] = providerConfig.deploymentName;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return new AzureProvider(azureConfig as any);
      }

      default:
        throw new LLMError(`Unsupported provider: ${provider}`);
    }
  }

  /**
   * Get list of available providers
   */
  static getAvailableProviders(): ProviderType[] {
    return ['openai', 'anthropic', 'azure'];
  }

  /**
   * Check if a provider is valid
   */
  static isValidProvider(provider: string): provider is ProviderType {
    return this.getAvailableProviders().includes(provider as ProviderType);
  }
}

export default ProviderFactory;
