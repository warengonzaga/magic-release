/**
 * Provider Factory - Creates and manages LLM provider instances
 * Handles pr      case 'azure':
        const endpoint = (options as Partial<AzureConfig>).endpoint || process.env['AZURE_OPENAI_ENDPOINT'];
        
        if (!endpoint) {
          throw new ConfigError('Azure endpoint is required. Set AZURE_OPENAI_ENDPOINT or provide endpoint in config.');
        }
        
        const azureConfig: AzureConfig = {
          ...baseConfig,
          endpoint,
        };
        
        // Add optional properties
        const partialAzure = options as Partial<AzureConfig>;
        if (partialAzure.apiVersion) {
          azureConfig.apiVersion = partialAzure.apiVersion;
        }
        if (partialAzure.deploymentName) {
          azureConfig.deploymentName = partialAzure.deploymentName;
        }
        
        return new AzureProvider(azureConfig);tiation and configuration management
 */

import type { LLMConfig } from './providers/BaseProvider.js';
import type { OpenAIConfig } from './providers/OpenAIProvider.js';
import type { AnthropicConfig } from './providers/AnthropicProvider.js';
import type { AzureConfig } from './providers/AzureProvider.js';
import type { ProviderType } from './providers/ProviderInterface.js';

import OpenAIProvider from './providers/OpenAIProvider.js';
import AnthropicProvider from './providers/AnthropicProvider.js';
import AzureProvider from './providers/AzureProvider.js';
import BaseProvider from './providers/BaseProvider.js';

import { ConfigError, createMissingAPIKeyError } from '../../utils/errors.js';
import { logger } from '../../utils/logger.js';

export type ProviderConfig = OpenAIConfig | AnthropicConfig | AzureConfig;

/**
 * Factory class for creating LLM provider instances
 */
export class ProviderFactory {
  /**
   * Create a provider instance based on type and configuration
   */
  static createProvider(
    providerType: ProviderType,
    config: ProviderConfig
  ): BaseProvider {
    logger.debug(`Creating ${providerType} provider instance`);

    if (!config.apiKey) {
      throw createMissingAPIKeyError(providerType);
    }

    switch (providerType) {
      case 'openai':
        return new OpenAIProvider(config as OpenAIConfig);
      
      case 'anthropic':
        return new AnthropicProvider(config as AnthropicConfig);
      
      case 'azure':
        return new AzureProvider(config as AzureConfig);
      
      default:
        throw new ConfigError(`Unsupported provider type: ${providerType}`);
    }
  }

  /**
   * Create a provider from a unified config object
   */
  static createProviderFromConfig(
    providerType: ProviderType,
    apiKey: string,
    options: Partial<LLMConfig> = {}
  ): BaseProvider {
    const baseConfig: LLMConfig = {
      apiKey,
      model: options.model || this.getDefaultModel(providerType),
      temperature: options.temperature ?? 0.1,
      maxTokens: options.maxTokens ?? 1000,
      timeout: options.timeout ?? 30000,
    };

    switch (providerType) {
      case 'openai':
        const openaiConfig: OpenAIConfig = {
          ...baseConfig,
        };
        
        // Add optional properties only if they exist
        const partialOpenAI = options as Partial<OpenAIConfig>;
        if (partialOpenAI.baseURL) {
          openaiConfig.baseURL = partialOpenAI.baseURL;
        }
        if (partialOpenAI.organization) {
          openaiConfig.organization = partialOpenAI.organization;
        }
        
        return new OpenAIProvider(openaiConfig);
      
      case 'anthropic':
        const anthropicConfig: AnthropicConfig = {
          ...baseConfig,
        };
        return new AnthropicProvider(anthropicConfig);
      
      case 'azure':
        const endpoint = (options as Partial<AzureConfig>).endpoint || process.env['AZURE_OPENAI_ENDPOINT'];
        
        if (!endpoint) {
          throw new ConfigError('Azure endpoint is required. Set AZURE_OPENAI_ENDPOINT or provide endpoint in config.');
        }
        
        const azureConfig: AzureConfig = {
          ...baseConfig,
          endpoint,
        };
        
        // Add optional properties
        const partialAzure = options as Partial<AzureConfig>;
        if (partialAzure.apiVersion) {
          azureConfig.apiVersion = partialAzure.apiVersion;
        }
        if (partialAzure.deploymentName) {
          azureConfig.deploymentName = partialAzure.deploymentName;
        }
        
        return new AzureProvider(azureConfig);
      
      default:
        throw new ConfigError(`Unsupported provider type: ${providerType}`);
    }
  }

  /**
   * Get default model for a provider
   */
  static getDefaultModel(providerType: ProviderType): string {
    switch (providerType) {
      case 'openai':
        return 'gpt-4o-mini';
      case 'anthropic':
        return 'claude-3-haiku-20240307';
      case 'azure':
        return 'gpt-4o-mini';
      default:
        return 'gpt-4o-mini';
    }
  }

  /**
   * Get all supported providers
   */
  static getSupportedProviders(): ProviderType[] {
    return ['openai', 'anthropic', 'azure'];
  }

  /**
   * Validate provider type
   */
  static isValidProviderType(providerType: string): providerType is ProviderType {
    return this.getSupportedProviders().includes(providerType as ProviderType);
  }

  /**
   * Get provider display name
   */
  static getProviderDisplayName(providerType: ProviderType): string {
    switch (providerType) {
      case 'openai':
        return 'OpenAI';
      case 'anthropic':
        return 'Anthropic Claude';
      case 'azure':
        return 'Azure OpenAI';
      default:
        return providerType;
    }
  }

  /**
   * Get provider configuration help text
   */
  static getProviderConfigHelp(providerType: ProviderType): string {
    switch (providerType) {
      case 'openai':
        return 'Get your API key from https://platform.openai.com/account/api-keys';
      case 'anthropic':
        return 'Get your API key from https://console.anthropic.com/';
      case 'azure':
        return 'Get your API key and endpoint from Azure OpenAI Service in the Azure portal';
      default:
        return 'Check the provider documentation for API key instructions';
    }
  }
}

export default ProviderFactory;
