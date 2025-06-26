/**
 * Provider Factory
 * Creates provider instances based on configuration
 */

import type { MagicReleaseConfig } from '../../../types/interfaces.js';
import type { ProviderType } from './ProviderInterface.js';
import { OpenAIProvider } from './OpenAIProvider.js';
import { AnthropicProvider } from './AnthropicProvider.js';
import { AzureProvider } from './AzureProvider.js';
import { LLMError } from '../../../utils/errors.js';
import { logger } from '../../../utils/logger.js';

export class ProviderFactory {
  /**
   * Create a provider instance based on configuration
   */
  static createProvider(config: MagicReleaseConfig): OpenAIProvider | AnthropicProvider | AzureProvider {
    const { provider, ...providerConfig } = config.llm;
    
    logger.debug(`Creating ${provider} provider`);

    switch (provider) {
      case 'openai': {
        const openaiConfig: any = {
          apiKey: providerConfig.apiKey || ''
        };
        if (providerConfig.model) openaiConfig.model = providerConfig.model;
        if (providerConfig.temperature !== undefined) openaiConfig.temperature = providerConfig.temperature;
        if (providerConfig.maxTokens !== undefined) openaiConfig.maxTokens = providerConfig.maxTokens;
        if (providerConfig.baseURL) openaiConfig.baseURL = providerConfig.baseURL;
        if (providerConfig.organization) openaiConfig.organization = providerConfig.organization;
        
        return new OpenAIProvider(openaiConfig);
      }

      case 'anthropic': {
        const anthropicConfig: any = {
          apiKey: providerConfig.apiKey || ''
        };
        if (providerConfig.model) anthropicConfig.model = providerConfig.model;
        if (providerConfig.temperature !== undefined) anthropicConfig.temperature = providerConfig.temperature;
        if (providerConfig.maxTokens !== undefined) anthropicConfig.maxTokens = providerConfig.maxTokens;
        
        return new AnthropicProvider(anthropicConfig);
      }

      case 'azure': {
        const azureConfig: any = {
          apiKey: providerConfig.apiKey || '',
          endpoint: providerConfig.endpoint || ''
        };
        if (providerConfig.model) azureConfig.model = providerConfig.model;
        if (providerConfig.temperature !== undefined) azureConfig.temperature = providerConfig.temperature;
        if (providerConfig.maxTokens !== undefined) azureConfig.maxTokens = providerConfig.maxTokens;
        if (providerConfig.apiVersion) azureConfig.apiVersion = providerConfig.apiVersion;
        if (providerConfig.deploymentName) azureConfig.deploymentName = providerConfig.deploymentName;
        
        return new AzureProvider(azureConfig);
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
