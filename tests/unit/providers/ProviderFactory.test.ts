/// <reference path="../../globals.d.ts" />

import { ProviderFactory } from '../../../src/core/llm/ProviderFactory';
import { OpenAIProvider } from '../../../src/core/llm/providers/OpenAIProvider';
import { AnthropicProvider } from '../../../src/core/llm/providers/AnthropicProvider';
import { AzureProvider } from '../../../src/core/llm/providers/AzureProvider';
import type { OpenAIConfig } from '../../../src/core/llm/providers/OpenAIProvider';
import type { AnthropicConfig } from '../../../src/core/llm/providers/AnthropicProvider';
import type { AzureConfig } from '../../../src/core/llm/providers/AzureProvider';

describe('ProviderFactory', () => {
  describe('createProvider', () => {
    it('should create OpenAI provider', () => {
      const config: OpenAIConfig = {
        apiKey: TEST_CONSTANTS.VALID_OPENAI_KEY,
        model: 'gpt-4',
        temperature: 0.1,
        maxTokens: 1000,
        timeout: 30000
      };

      const provider = ProviderFactory.createProvider('openai', config);
      expect(provider).toBeInstanceOf(OpenAIProvider);
    });

    it('should create Anthropic provider', () => {
      const config: AnthropicConfig = {
        apiKey: TEST_CONSTANTS.VALID_ANTHROPIC_KEY,
        model: 'claude-3-haiku',
        temperature: 0.1,
        maxTokens: 1000,
        timeout: 30000
      };

      const provider = ProviderFactory.createProvider('anthropic', config);
      expect(provider).toBeInstanceOf(AnthropicProvider);
    });

    it('should create Azure provider', () => {
      const config: AzureConfig = {
        apiKey: TEST_CONSTANTS.VALID_AZURE_KEY,
        model: 'gpt-4',
        temperature: 0.1,
        maxTokens: 1000,
        timeout: 30000,
        endpoint: 'https://test.openai.azure.com'
      };

      const provider = ProviderFactory.createProvider('azure', config);
      expect(provider).toBeInstanceOf(AzureProvider);
    });

    it('should throw error for invalid provider', () => {
      const config: OpenAIConfig = {
        apiKey: TEST_CONSTANTS.VALID_OPENAI_KEY,
        model: 'gpt-4',
        temperature: 0.1,
        maxTokens: 1000,
        timeout: 30000
      };

      expect(() => ProviderFactory.createProvider('invalid' as any, config))
        .toThrow('Unsupported provider type: invalid');
    });

    it('should throw error for missing API key', () => {
      const config: OpenAIConfig = {
        apiKey: '',
        model: 'gpt-4',
        temperature: 0.1,
        maxTokens: 1000,
        timeout: 30000
      };

      expect(() => ProviderFactory.createProvider('openai', config))
        .toThrow('No API key configured for openai.');
    });
  });

  describe('createProviderFromConfig', () => {
    it('should create OpenAI provider from config', () => {
      const provider = ProviderFactory.createProviderFromConfig('openai', TEST_CONSTANTS.VALID_OPENAI_KEY);
      expect(provider).toBeInstanceOf(OpenAIProvider);
    });

    it('should create Anthropic provider from config', () => {
      const provider = ProviderFactory.createProviderFromConfig('anthropic', TEST_CONSTANTS.VALID_ANTHROPIC_KEY);
      expect(provider).toBeInstanceOf(AnthropicProvider);
    });

    it('should create Azure provider from config with endpoint', () => {
      const provider = ProviderFactory.createProviderFromConfig('azure', TEST_CONSTANTS.VALID_AZURE_KEY, {
        endpoint: 'https://test.openai.azure.com'
      } as Partial<AzureConfig>);
      expect(provider).toBeInstanceOf(AzureProvider);
    });

    it('should throw error for Azure without endpoint', () => {
      expect(() => ProviderFactory.createProviderFromConfig('azure', TEST_CONSTANTS.VALID_AZURE_KEY))
        .toThrow('Azure endpoint is required');
    });
  });

  describe('utility methods', () => {
    it('should return supported providers', () => {
      const providers = ProviderFactory.getSupportedProviders();
      expect(providers).toEqual(['openai', 'anthropic', 'azure']);
    });

    it('should validate provider types', () => {
      expect(ProviderFactory.isValidProviderType('openai')).toBe(true);
      expect(ProviderFactory.isValidProviderType('anthropic')).toBe(true);
      expect(ProviderFactory.isValidProviderType('azure')).toBe(true);
      expect(ProviderFactory.isValidProviderType('invalid')).toBe(false);
      expect(ProviderFactory.isValidProviderType('google')).toBe(false);
      expect(ProviderFactory.isValidProviderType('')).toBe(false);
    });

    it('should return default models', () => {
      expect(ProviderFactory.getDefaultModel('openai')).toBe('gpt-4o-mini');
      expect(ProviderFactory.getDefaultModel('anthropic')).toBe('claude-3-haiku-20240307');
      expect(ProviderFactory.getDefaultModel('azure')).toBe('gpt-4o-mini');
    });

    it('should return provider display names', () => {
      expect(ProviderFactory.getProviderDisplayName('openai')).toBe('OpenAI');
      expect(ProviderFactory.getProviderDisplayName('anthropic')).toBe('Anthropic Claude');
      expect(ProviderFactory.getProviderDisplayName('azure')).toBe('Azure OpenAI');
    });

    it('should return provider config help', () => {
      const openaiHelp = ProviderFactory.getProviderConfigHelp('openai');
      expect(openaiHelp).toContain('https://platform.openai.com');
      
      const anthropicHelp = ProviderFactory.getProviderConfigHelp('anthropic');
      expect(anthropicHelp).toContain('https://console.anthropic.com');
      
      const azureHelp = ProviderFactory.getProviderConfigHelp('azure');
      expect(azureHelp).toContain('Azure OpenAI Service');
    });
  });
});
