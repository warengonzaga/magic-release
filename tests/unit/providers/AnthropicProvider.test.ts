/// <reference path="../../globals.d.ts" />

/**
 * Unit Tests for Anthropic Provider
 * Tests Claude API integration and provider functionality
 */

import { AnthropicProvider } from '../../../src/core/llm/providers/AnthropicProvider';
import { APIKeyError } from '../../../src/utils/errors';

// Mock fetch globally
global.fetch = jest.fn();

describe('AnthropicProvider', () => {
  const validConfig = {
    apiKey: TEST_CONSTANTS.VALID_ANTHROPIC_KEY,
    model: 'claude-3-haiku-20240307',
    temperature: 0.1,
    maxTokens: 1000
  };

  let provider: AnthropicProvider;

  beforeEach(() => {
    jest.clearAllMocks();
    provider = new AnthropicProvider(validConfig);
  });

  describe('Constructor', () => {
    it('should create provider with valid config', () => {
      expect(provider).toBeInstanceOf(AnthropicProvider);
      expect(provider.getProviderName()).toBe('Anthropic');
    });

    it('should throw error with invalid API key', () => {
      expect(() => {
        new AnthropicProvider({
          ...validConfig,
          apiKey: 'invalid-key'
        });
      }).toThrow(APIKeyError);
    });

    it('should set default model if not provided', () => {
      const providerWithDefaults = new AnthropicProvider({
        apiKey: TEST_CONSTANTS.VALID_ANTHROPIC_KEY
      });
      expect(providerWithDefaults.getAvailableModels()).toContain('claude-3-haiku');
    });
  });

  describe('API Key Validation', () => {
    it('should validate correct Anthropic API key format', async () => {
      const result = await provider.validateApiKey(TEST_CONSTANTS.VALID_ANTHROPIC_KEY);
      expect(result.valid).toBe(true);
      expect(result.message).toContain('valid');
    });

    it('should reject invalid API key formats', async () => {
      const invalidKeys = [
        '',
        'invalid',
        'sk-short',
        'sk-openai1234567890abcdef1234567890abcdef123456', // OpenAI format
        'ant-1234567890abcdef12345' // wrong prefix
      ];

      for (const key of invalidKeys) {
        const result = await provider.validateApiKey(key);
        expect(result.valid).toBe(false);
        expect(result.message).toContain('Invalid');
      }
    });
  });

  describe('Connection Testing', () => {
    it('should test connection successfully', async () => {
      mockAPIResponse(200, {
        id: 'msg_test123',
        type: 'message',
        role: 'assistant',
        content: [{ type: 'text', text: 'Hello!' }],
        model: 'claude-3-haiku-20240307',
        stop_reason: 'end_turn',
        stop_sequence: null,
        usage: {
          input_tokens: 10,
          output_tokens: 5
        }
      });

      const result = await provider.testConnection();
      expect(result.valid).toBe(true);
      expect(result.message).toContain('✅');
    });

    it('should handle unauthorized response', async () => {
      mockAPIResponse(401, {
        error: { message: 'Invalid API key' }
      });

      const result = await provider.testConnection();
      expect(result.valid).toBe(false);
      expect(result.message).toContain('❌');
    });

    it('should handle network errors', async () => {
      mockAPIError(new Error('Network error'));

      const result = await provider.testConnection();
      expect(result.valid).toBe(false);
      expect(result.message).toContain('🌐');
    });

    it('should test connection with custom API key', async () => {
      mockAPIResponse(200, {
        id: 'msg_test123',
        content: [{ type: 'text', text: 'Hello!' }],
        usage: { input_tokens: 10, output_tokens: 5 }
      });

      const customKey = 'sk-ant-custom1234567890abcdef1234567890abcdef123456';
      const result = await provider.testConnection(customKey);
      
      expect(result.valid).toBe(true);
      expect(fetch).toHaveBeenCalledWith(
        'https://api.anthropic.com/v1/messages',
        expect.objectContaining({
          headers: expect.objectContaining({
            'x-api-key': customKey
          })
        })
      );
    });
  });

  describe('Generate Completion', () => {
    const sampleMessages = [
      { role: 'system' as const, content: 'You are a helpful assistant.' },
      { role: 'user' as const, content: 'Generate a changelog entry.' }
    ];

    it('should generate completion successfully', async () => {
      const mockResponse = {
        id: 'msg_test123',
        type: 'message',
        role: 'assistant',
        content: [{
          type: 'text',
          text: '## [1.0.0] - 2023-01-01\n\n### Added\n- New feature'
        }],
        model: 'claude-3-haiku-20240307',
        stop_reason: 'end_turn',
        stop_sequence: null,
        usage: {
          input_tokens: 50,
          output_tokens: 25
        }
      };

      mockAPIResponse(200, mockResponse);

      const result = await provider.generateCompletion(sampleMessages);

      expect(result.content).toContain('## [1.0.0]');
      expect(result.usage?.totalTokens).toBe(75);
      expect(result.model).toBe('claude-3-haiku-20240307');
      expect(result.finishReason).toBe('end_turn');
    });

    it('should handle system messages correctly', async () => {
      const mockResponse = {
        content: [{ type: 'text', text: 'Response' }],
        usage: { input_tokens: 20, output_tokens: 10 }
      };

      mockAPIResponse(200, mockResponse);

      await provider.generateCompletion(sampleMessages);

      expect(fetch).toHaveBeenCalledWith(
        'https://api.anthropic.com/v1/messages',
        expect.objectContaining({
          body: expect.stringContaining('"system":"You are a helpful assistant."')
        })
      );
    });

    it('should handle API errors during completion', async () => {
      mockAPIResponse(429, {
        error: { message: 'Rate limit exceeded' }
      });

      await expect(provider.generateCompletion(sampleMessages))
        .rejects.toThrow('Anthropic API error: 429');
    });

    it('should handle empty content response', async () => {
      mockAPIResponse(200, {
        content: []
      });

      await expect(provider.generateCompletion(sampleMessages))
        .rejects.toThrow('No content returned from Anthropic API');
    });

    it('should validate messages before sending', async () => {
      const invalidMessages = [
        { role: 'invalid' as any, content: 'test' }
      ];

      await expect(provider.generateCompletion(invalidMessages))
        .rejects.toThrow('Invalid message role');
    });

    it('should handle timeout', async () => {
      mockAPIError(new Error('AbortError'));

      await expect(provider.generateCompletion(sampleMessages))
        .rejects.toThrow('AbortError');
    });
  });

  describe('Model Management', () => {
    it('should return available models', () => {
      const models = provider.getAvailableModels();
      expect(models).toContain('claude-3-haiku');
      expect(models).toContain('claude-3-sonnet');
      expect(models).toContain('claude-3-opus');
    });

    it('should validate supported models', () => {
      expect(provider.validateModel('claude-3-haiku')).toBe(true);
      expect(provider.validateModel('claude-3-sonnet')).toBe(true);
      expect(provider.validateModel('invalid-model')).toBe(false);
    });
  });

  describe('Message Format Conversion', () => {
    it('should convert messages to Anthropic format', async () => {
      const messages = [
        { role: 'system' as const, content: 'You are helpful.' },
        { role: 'user' as const, content: 'Hello' },
        { role: 'assistant' as const, content: 'Hi there!' },
        { role: 'user' as const, content: 'Generate changelog' }
      ];

      mockAPIResponse(200, {
        content: [{ type: 'text', text: 'Response' }],
        usage: { input_tokens: 20, output_tokens: 10 }
      });

      await provider.generateCompletion(messages);

      const fetchCall = (fetch as jest.Mock).mock.calls[0];
      const requestBody = JSON.parse(fetchCall[1].body);

      // Should separate system message
      expect(requestBody.system).toBe('You are helpful.');
      
      // Should convert other messages
      expect(requestBody.messages).toEqual([
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there!' },
        { role: 'user', content: 'Generate changelog' }
      ]);
    });
  });

  describe('Request Headers', () => {
    it('should include correct headers', async () => {
      mockAPIResponse(200, {
        content: [{ type: 'text', text: 'Response' }],
        usage: { input_tokens: 20, output_tokens: 10 }
      });

      await provider.generateCompletion([
        { role: 'user', content: 'test' }
      ]);

      expect(fetch).toHaveBeenCalledWith(
        'https://api.anthropic.com/v1/messages',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'x-api-key': TEST_CONSTANTS.VALID_ANTHROPIC_KEY,
            'anthropic-version': '2023-06-01',
            'User-Agent': 'MagicRelease/1.0.0'
          })
        })
      );
    });
  });
});
