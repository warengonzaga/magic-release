/**
 * Provider Factory
 * Creates provider instances based on configuration
 */

import type { MagicReleaseConfig } from '../../../types/interfaces.js';
import { LLMError } from '../../../utils/errors.js';
import { logger } from '../../../utils/logger.js';

import type { ProviderType } from './ProviderInterface.js';
import { OpenAIProvider, type OpenAIConfig } from './OpenAIProvider.js';
import { AnthropicProvider, type AnthropicConfig } from './AnthropicProvider.js';
import { AzureProvider, type AzureConfig } from './AzureProvider.js';

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
        const openaiConfig: OpenAIConfig = {
          apiKey: providerConfig.apiKey ?? '',
          ...(providerConfig.model && { model: providerConfig.model }),
          ...(providerConfig.temperature !== undefined && {
            temperature: providerConfig.temperature,
          }),
          ...(providerConfig.maxTokens !== undefined && { maxTokens: providerConfig.maxTokens }),
          ...(providerConfig.baseURL && { baseURL: providerConfig.baseURL }),
          ...(providerConfig.organization && { organization: providerConfig.organization }),
        };

        return new OpenAIProvider(openaiConfig);
      }

      case 'anthropic': {
        const anthropicConfig: AnthropicConfig = {
          apiKey: providerConfig.apiKey ?? '',
          ...(providerConfig.model && { model: providerConfig.model }),
          ...(providerConfig.temperature !== undefined && {
            temperature: providerConfig.temperature,
          }),
          ...(providerConfig.maxTokens !== undefined && { maxTokens: providerConfig.maxTokens }),
        };

        return new AnthropicProvider(anthropicConfig);
      }

      case 'azure': {
        const azureConfig: AzureConfig = {
          apiKey: providerConfig.apiKey ?? '',
          endpoint: providerConfig.endpoint ?? '',
          ...(providerConfig.model && { model: providerConfig.model }),
          ...(providerConfig.temperature !== undefined && {
            temperature: providerConfig.temperature,
          }),
          ...(providerConfig.maxTokens !== undefined && { maxTokens: providerConfig.maxTokens }),
          ...(providerConfig.apiVersion && { apiVersion: providerConfig.apiVersion }),
          ...(providerConfig.deploymentName && { deploymentName: providerConfig.deploymentName }),
        };

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
