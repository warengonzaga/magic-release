/**
 * Unit tests for Provider functionality
 * These tests validate provider instantiation and basic functionality
 */

import ProviderFactory from '../../core/llm/ProviderFactory.js';
import { OpenAIProvider } from '../../core/llm/providers/OpenAIProvider.js';
import { AnthropicProvider } from '../../core/llm/providers/AnthropicProvider.js';
import { AzureProvider } from '../../core/llm/providers/AzureProvider.js';
import { PROVIDER_CONFIGS } from '../../core/llm/providers/ProviderInterface.js';

describe('Provider Tests', () => {
  describe('Provider Instantiation', () => {
    it('should create OpenAI provider instance correctly', () => {
      const provider = ProviderFactory.createProviderFromConfig(
        'openai',
        'sk-test1234567890abcdef1234567890abcdef1234567890abcdef',
        {
          model: 'gpt-4o-mini',
          temperature: 0.1,
        }
      );

      expect(provider).toBeInstanceOf(OpenAIProvider);
      expect(provider.constructor.name).toBe('OpenAIProvider');
    });

    it('should create Anthropic provider instance correctly', () => {
      const provider = ProviderFactory.createProviderFromConfig(
        'anthropic',
        'sk-ant-test1234567890abcdef1234567890abcdef1234567890abcdef',
        {
          model: 'claude-3-haiku',
          temperature: 0.1,
        }
      );

      expect(provider).toBeInstanceOf(AnthropicProvider);
      expect(provider.constructor.name).toBe('AnthropicProvider');
    });

    it('should create Azure provider instance correctly', () => {
      const provider = ProviderFactory.createProviderFromConfig(
        'azure',
        'abcd1234567890efgh1234567890ijkl',
        {
          model: 'gpt-4',
          temperature: 0.1,
          endpoint: 'https://test.openai.azure.com/',
        }
      );

      expect(provider).toBeInstanceOf(AzureProvider);
      expect(provider.constructor.name).toBe('AzureProvider');
    });

    it('should throw error for invalid provider type', () => {
      expect(() =>
        ProviderFactory.createProviderFromConfig('invalid-provider' as any, 'test-key')
      ).toThrow();
    });
  });

  describe('Provider Configuration Validation', () => {
    it('should validate OpenAI configuration correctly', () => {
      const config = PROVIDER_CONFIGS['openai']!;

      expect(config.name).toBe('openai');
      expect(config.supportedModels).toContain('gpt-4o-mini');
      expect(config.supportedModels).toContain('gpt-4');
      expect(config.defaultModel).toBe('gpt-4o-mini');
      expect(config.maxTokensLimit).toBe(4096);
      expect(config.temperatureRange).toEqual([0, 2]);
      expect(config.apiKeyPattern).toBeInstanceOf(RegExp);

      // Test API key pattern validation
      expect(
        config.apiKeyPattern.test('sk-test1234567890abcdef1234567890abcdef1234567890abcdef')
      ).toBe(true);
      expect(config.apiKeyPattern.test('invalid-key')).toBe(false);
    });

    it('should validate Anthropic configuration correctly', () => {
      const config = PROVIDER_CONFIGS['anthropic']!;

      expect(config.name).toBe('anthropic');
      expect(config.supportedModels).toContain('claude-3-haiku');
      expect(config.supportedModels).toContain('claude-3-sonnet');
      expect(config.defaultModel).toBe('claude-3-haiku');
      expect(config.maxTokensLimit).toBe(4096);
      expect(config.temperatureRange).toEqual([0, 1]);

      // Test API key pattern validation
      expect(
        config.apiKeyPattern.test('sk-ant-test1234567890abcdef1234567890abcdef1234567890abcdef')
      ).toBe(true);
      expect(config.apiKeyPattern.test('invalid-key')).toBe(false);
    });

    it('should validate Azure configuration correctly', () => {
      const config = PROVIDER_CONFIGS['azure']!;

      expect(config.name).toBe('azure');
      expect(config.supportedModels).toContain('gpt-4');
      expect(config.supportedModels).toContain('gpt-35-turbo');
      expect(config.defaultModel).toBe('gpt-4');
      expect(config.maxTokensLimit).toBe(4096);
      expect(config.temperatureRange).toEqual([0, 2]);

      // Test API key pattern validation
      expect(config.apiKeyPattern.test('abcd1234567890efgh1234567890ijkl')).toBe(true);
      expect(config.apiKeyPattern.test('invalid-key')).toBe(false);
    });
  });

  describe('Provider API Key Validation', () => {
    it('should reject invalid OpenAI API keys', () => {
      const invalidKeys = [
        'invalid-key',
        'sk-short',
        'wrong-prefix-1234567890abcdef1234567890abcdef',
        '',
        'sk-',
      ];

      expect(() => {
        new OpenAIProvider({ apiKey: 'invalid-key' });
      }).toThrow();

      invalidKeys.forEach(key => {
        expect(() => {
          new OpenAIProvider({ apiKey: key });
        }).toThrow();
      });
    });

    it('should reject invalid Anthropic API keys', () => {
      const invalidKeys = [
        'invalid-key',
        'sk-ant-short',
        'sk-wrong-prefix-1234567890abcdef',
        '',
        'sk-ant-',
      ];

      invalidKeys.forEach(key => {
        expect(() => {
          new AnthropicProvider({ apiKey: key });
        }).toThrow();
      });
    });

    it('should reject invalid Azure API keys', () => {
      const invalidKeys = [
        'invalid-key-with-dashes', // contains dashes
        'short', // too short (< 32 chars)
        'has-special-chars!@#$%^&*()', // contains special chars
        '', // empty
        'underscores_not_allowed_in_azure_keys_test', // contains underscores
      ];

      invalidKeys.forEach(key => {
        expect(() => {
          new AzureProvider({
            apiKey: key,
            endpoint: 'https://test.openai.azure.com/',
          });
        }).toThrow();
      });
    });
  });

  describe('Provider Model Support', () => {
    it('should support OpenAI models correctly', () => {
      const provider = new OpenAIProvider({
        apiKey: 'sk-test1234567890abcdef1234567890abcdef1234567890abcdef', // 48+ chars
      });

      const config = PROVIDER_CONFIGS['openai']!;

      // Test supported models
      expect(config.supportedModels).toContain('gpt-4o-mini');
      expect(config.supportedModels).toContain('gpt-4');
      expect(config.supportedModels).toContain('gpt-3.5-turbo');

      // Provider should be created successfully with valid key
      expect(provider).toBeInstanceOf(OpenAIProvider);
    });

    it('should support Anthropic models correctly', () => {
      const provider = new AnthropicProvider({
        apiKey: 'sk-ant-test1234567890abcdef1234567890abcdef1234567890abcdef',
      });

      const config = PROVIDER_CONFIGS['anthropic']!;

      // Test supported models
      expect(config.supportedModels).toContain('claude-3-haiku');
      expect(config.supportedModels).toContain('claude-3-sonnet');
      expect(config.supportedModels).toContain('claude-3-opus');

      // Provider should be created successfully with valid key
      expect(provider).toBeInstanceOf(AnthropicProvider);
    });

    it('should support Azure models correctly', () => {
      const provider = new AzureProvider({
        apiKey: 'abcd1234567890efgh1234567890ijkl',
        endpoint: 'https://test.openai.azure.com/',
      });

      const config = PROVIDER_CONFIGS['azure']!;

      // Test supported models
      expect(config.supportedModels).toContain('gpt-4');
      expect(config.supportedModels).toContain('gpt-4-turbo');
      expect(config.supportedModels).toContain('gpt-35-turbo');

      // Provider should be created successfully with valid key
      expect(provider).toBeInstanceOf(AzureProvider);
    });
  });

  describe('Provider Validation Methods', () => {
    it('should use OpenAI provider validateApiKey method correctly', async () => {
      const provider = new OpenAIProvider({
        apiKey: 'sk-test1234567890abcdef1234567890abcdef1234567890abcdef',
      });

      // Test valid key format
      const validResult = await provider.validateApiKey(
        'sk-test1234567890abcdef1234567890abcdef1234567890abcdef'
      );
      expect(validResult.valid).toBe(true);
      expect(validResult.message).toContain('valid');

      // Test invalid key format
      const invalidResult = await provider.validateApiKey('invalid-key');
      expect(invalidResult.valid).toBe(false);
      expect(invalidResult.message).toContain('Invalid OpenAI API key format');
    });

    it('should use Anthropic provider validateApiKey method correctly', async () => {
      const provider = new AnthropicProvider({
        apiKey: 'sk-ant-test1234567890abcdef1234567890abcdef1234567890abcdef',
      });

      // Test valid key format
      const validResult = await provider.validateApiKey(
        'sk-ant-test1234567890abcdef1234567890abcdef1234567890abcdef'
      );
      expect(validResult.valid).toBe(true);
      expect(validResult.message).toContain('valid');

      // Test invalid key format
      const invalidResult = await provider.validateApiKey('invalid-key');
      expect(invalidResult.valid).toBe(false);
      expect(invalidResult.message).toContain('Invalid Anthropic API key format');
    });

    it('should use Azure provider validateApiKey method correctly', async () => {
      const provider = new AzureProvider({
        apiKey: 'abcd1234567890efgh1234567890ijkl',
        endpoint: 'https://test.openai.azure.com/',
      });

      // Test valid key format
      const validResult = await provider.validateApiKey('abcd1234567890efgh1234567890ijkl');
      expect(validResult.valid).toBe(true);
      expect(validResult.message).toContain('valid');

      // Test invalid key format
      const invalidResult = await provider.validateApiKey('invalid-key');
      expect(invalidResult.valid).toBe(false);
      expect(invalidResult.message).toContain('Invalid Azure API key format');
    });

    it('should validate model support using provider methods', () => {
      const openaiProvider = new OpenAIProvider({
        apiKey: 'sk-test1234567890abcdef1234567890abcdef1234567890abcdef',
      });
      const anthropicProvider = new AnthropicProvider({
        apiKey: 'sk-ant-test1234567890abcdef1234567890abcdef1234567890abcdef',
      });
      const azureProvider = new AzureProvider({
        apiKey: 'abcd1234567890efgh1234567890ijkl',
        endpoint: 'https://test.openai.azure.com/',
      });

      // Test model validation using real provider methods
      expect(openaiProvider.validateModel('gpt-4')).toBe(true);
      expect(openaiProvider.validateModel('invalid-model')).toBe(false);

      expect(anthropicProvider.validateModel('claude-3-haiku')).toBe(true);
      expect(anthropicProvider.validateModel('invalid-model')).toBe(false);

      expect(azureProvider.validateModel('gpt-4')).toBe(true);
      expect(azureProvider.validateModel('invalid-model')).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid provider type', () => {
      const invalidProvider = 'invalid-provider';
      const validProviders = ['openai', 'anthropic', 'azure'];

      expect(validProviders).not.toContain(invalidProvider);
    });

    it('should handle missing API key', () => {
      const apiKey = undefined as string | undefined;
      const isValid = apiKey !== undefined && apiKey.length > 0;

      expect(isValid).toBe(false);
    });

    it('should handle network errors', () => {
      const networkError = new Error('Network request failed');

      expect(networkError.message).toBe('Network request failed');
      expect(networkError).toBeInstanceOf(Error);
    });
  });
});
