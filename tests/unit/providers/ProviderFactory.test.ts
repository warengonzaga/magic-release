/// <reference path="../../globals.d.ts" />

import { ProviderFactory } from '../../../src/core/llm/providers/ProviderFactory';
import { OpenAIProvider } from '../../../src/core/llm/providers/OpenAIProvider';
import { AnthropicProvider } from '../../../src/core/llm/providers/AnthropicProvider';
import { AzureProvider } from '../../../src/core/llm/providers/AzureProvider';
import type { MagicReleaseConfig } from '../../../src/types/interfaces';

describe('ProviderFactory', () => {
  describe('createProvider', () => {
    it('should create OpenAI provider', () => {
      const config: MagicReleaseConfig = {
        llm: {
          provider: 'openai',
          apiKey: TEST_CONSTANTS.VALID_OPENAI_KEY,
          model: 'gpt-4'
        },
        changelog: {},
        git: {}
      };

      const provider = ProviderFactory.createProvider(config);
      expect(provider).toBeInstanceOf(OpenAIProvider);
    });

    it('should create Anthropic provider', () => {
      const config: MagicReleaseConfig = {
        llm: {
          provider: 'anthropic',
          apiKey: TEST_CONSTANTS.VALID_ANTHROPIC_KEY,
          model: 'claude-3-haiku'
        },
        changelog: {},
        git: {}
      };

      const provider = ProviderFactory.createProvider(config);
      expect(provider).toBeInstanceOf(AnthropicProvider);
    });

    it('should create Azure provider', () => {
      const config: MagicReleaseConfig = {
        llm: {
          provider: 'azure',
          apiKey: TEST_CONSTANTS.VALID_AZURE_KEY,
          model: 'gpt-4',
          endpoint: 'https://test.openai.azure.com',
          deploymentName: 'gpt-4-deployment',
          apiVersion: '2024-02-15-preview'
        },
        changelog: {},
        git: {}
      };

      const provider = ProviderFactory.createProvider(config);
      expect(provider).toBeInstanceOf(AzureProvider);
    });

    it('should throw error for unsupported provider', () => {
      const config: MagicReleaseConfig = {
        llm: {
          provider: 'unsupported' as any,
          apiKey: 'test-key'
        },
        changelog: {},
        git: {}
      };

      expect(() => ProviderFactory.createProvider(config))
        .toThrow('Unsupported provider: unsupported');
    });

    it('should pass configuration options to OpenAI provider', () => {
      const config: MagicReleaseConfig = {
        llm: {
          provider: 'openai',
          apiKey: TEST_CONSTANTS.VALID_OPENAI_KEY,
          model: 'gpt-4',
          temperature: 0.7,
          maxTokens: 2000,
          baseURL: 'https://custom-api.openai.com',
          organization: 'org-123'
        },
        changelog: {},
        git: {}
      };

      const provider = ProviderFactory.createProvider(config);
      expect(provider).toBeInstanceOf(OpenAIProvider);
      // The config is passed to the constructor, so we trust the provider tests verify it's used
    });

    it('should pass configuration options to Anthropic provider', () => {
      const config: MagicReleaseConfig = {
        llm: {
          provider: 'anthropic',
          apiKey: TEST_CONSTANTS.VALID_ANTHROPIC_KEY,
          model: 'claude-3-sonnet',
          temperature: 0.5,
          maxTokens: 1500
        },
        changelog: {},
        git: {}
      };

      const provider = ProviderFactory.createProvider(config);
      expect(provider).toBeInstanceOf(AnthropicProvider);
    });

    it('should pass configuration options to Azure provider', () => {
      const config: MagicReleaseConfig = {
        llm: {
          provider: 'azure',
          apiKey: TEST_CONSTANTS.VALID_AZURE_KEY,
          model: 'gpt-35-turbo',
          temperature: 0.8,
          maxTokens: 3000,
          endpoint: 'https://custom.openai.azure.com',
          deploymentName: 'custom-deployment',
          apiVersion: '2023-12-01-preview'
        },
        changelog: {},
        git: {}
      };

      const provider = ProviderFactory.createProvider(config);
      expect(provider).toBeInstanceOf(AzureProvider);
    });
  });

  describe('getAvailableProviders', () => {
    it('should return list of available providers', () => {
      const providers = ProviderFactory.getAvailableProviders();
      
      expect(providers).toEqual(['openai', 'anthropic', 'azure']);
      expect(providers).toHaveLength(3);
    });
  });

  describe('isValidProvider', () => {
    it('should return true for valid providers', () => {
      expect(ProviderFactory.isValidProvider('openai')).toBe(true);
      expect(ProviderFactory.isValidProvider('anthropic')).toBe(true);
      expect(ProviderFactory.isValidProvider('azure')).toBe(true);
    });

    it('should return false for invalid providers', () => {
      expect(ProviderFactory.isValidProvider('invalid')).toBe(false);
      expect(ProviderFactory.isValidProvider('google')).toBe(false);
      expect(ProviderFactory.isValidProvider('')).toBe(false);
      // @ts-ignore - testing invalid input
      expect(ProviderFactory.isValidProvider(null)).toBe(false);
      // @ts-ignore - testing invalid input
      expect(ProviderFactory.isValidProvider(undefined)).toBe(false);
    });
  });
});
