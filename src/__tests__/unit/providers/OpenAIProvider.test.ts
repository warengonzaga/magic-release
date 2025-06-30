/// <reference path="../../globals.d.ts" />

/**
 * Unit Tests for OpenAI Provider
 * Tests OpenAI API integration and provider functionality
 */

import { OpenAIProvider } from '../../../core/llm/providers/OpenAIProvider';
import { APIKeyError } from '../../../utils/errors';

// Mock fetch globally
global.fetch = jest.fn();

describe('OpenAIProvider', () => {
  const validConfig = {
    apiKey: TEST_CONSTANTS.VALID_OPENAI_KEY,
    model: 'gpt-4o-mini',
    temperature: 0.1,
    maxTokens: 1000,
  };

  let provider: OpenAIProvider;

  beforeEach(() => {
    jest.clearAllMocks();
    provider = new OpenAIProvider(validConfig);
  });

  describe('Constructor', () => {
    it('should create provider with valid config', () => {
      expect(provider).toBeInstanceOf(OpenAIProvider);
      expect(provider.getProviderName()).toBe('OpenAI');
    });

    it('should throw error with invalid API key', () => {
      expect(() => {
        new OpenAIProvider({
          ...validConfig,
          apiKey: 'invalid-key',
        });
      }).toThrow(APIKeyError);
    });

    it('should set default model if not provided', () => {
      const providerWithDefaults = new OpenAIProvider({
        apiKey: TEST_CONSTANTS.VALID_OPENAI_KEY,
      });
      expect(providerWithDefaults.getAvailableModels()).toContain('gpt-4o-mini');
    });
  });

  describe('API Key Validation', () => {
    it('should validate correct OpenAI API key format', async () => {
      const result = await provider.validateApiKey(TEST_CONSTANTS.VALID_OPENAI_KEY);
      expect(result.valid).toBe(true);
      expect(result.message).toContain('valid');
    });

    it('should reject invalid API key formats', async () => {
      const invalidKeys = [
        { key: '', expectedMessage: 'API key is required' },
        { key: 'invalid', expectedMessage: 'Invalid' },
        { key: 'sk-short', expectedMessage: 'Invalid' },
        { key: 'ak-wrongprefix1234567890abcdef1234567890abcdef123456', expectedMessage: 'Invalid' },
        { key: 'sk-1234567890abcdef12345', expectedMessage: 'Invalid' }, // too short
      ];

      for (const { key, expectedMessage } of invalidKeys) {
        const result = await provider.validateApiKey(key);
        expect(result.valid).toBe(false);
        expect(result.message).toContain(expectedMessage);
      }
    });

    it('should validate project API key format', async () => {
      const projectKey = 'sk-proj-abcdef1234567890abcdef1234567890abcdef1234567890';
      const result = await provider.validateApiKey(projectKey);
      expect(result.valid).toBe(true);
    });

    it('should validate organization API key format', async () => {
      const orgKey = 'sk-org-abcdef1234567890abcdef1234567890abcdef1234567890';
      const result = await provider.validateApiKey(orgKey);
      expect(result.valid).toBe(true);
    });
  });

  describe('Connection Testing', () => {
    it('should test connection successfully', async () => {
      mockAPIResponse(200, {
        data: [
          { id: 'gpt-4o-mini', object: 'model' },
          { id: 'gpt-4', object: 'model' },
        ],
      });

      const result = await provider.testConnection();
      expect(result.valid).toBe(true);
      expect(result.message).toContain('✅');
    });

    it('should handle unauthorized response', async () => {
      mockAPIResponse(401, {
        error: { message: 'Invalid API key' },
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
      mockAPIResponse(200, { data: [] });

      const customKey = 'sk-custom1234567890abcdef1234567890abcdef1234567890';
      const result = await provider.testConnection(customKey);

      expect(result.valid).toBe(true);
      expect(fetch).toHaveBeenCalledWith(
        'https://api.openai.com/v1/models',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: `Bearer ${customKey}`,
          }),
        })
      );
    });
  });

  describe('Generate Completion', () => {
    const sampleMessages = [
      { role: 'system' as const, content: 'You are a helpful assistant.' },
      { role: 'user' as const, content: 'Generate a changelog entry.' },
    ];

    it('should generate completion successfully', async () => {
      const mockResponse = {
        id: 'chatcmpl-123',
        object: 'chat.completion',
        created: 1677652288,
        model: 'gpt-4o-mini',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: '## [1.0.0] - 2023-01-01\n\n### Added\n- New feature',
            },
            finish_reason: 'stop',
          },
        ],
        usage: {
          prompt_tokens: 50,
          completion_tokens: 25,
          total_tokens: 75,
        },
      };

      mockAPIResponse(200, mockResponse);

      const result = await provider.generateCompletion(sampleMessages);

      expect(result.content).toContain('## [1.0.0]');
      expect(result.usage?.totalTokens).toBe(75);
      expect(result.model).toBe('gpt-4o-mini');
      expect(result.finishReason).toBe('stop');
    });

    it('should handle API errors during completion', async () => {
      mockAPIResponse(429, {
        error: { message: 'Rate limit exceeded' },
      });

      await expect(provider.generateCompletion(sampleMessages)).rejects.toThrow(
        'OpenAI API error: 429'
      );
    });

    it('should handle empty response', async () => {
      mockAPIResponse(200, {
        choices: [],
      });

      await expect(provider.generateCompletion(sampleMessages)).rejects.toThrow(
        'No choices returned from OpenAI API'
      );
    });

    it('should validate messages before sending', async () => {
      const invalidMessages = [{ role: 'invalid' as any, content: 'test' }];

      await expect(provider.generateCompletion(invalidMessages)).rejects.toThrow(
        'Invalid message role'
      );
    });

    it('should handle timeout', async () => {
      mockAPIError(new Error('AbortError'));

      await expect(provider.generateCompletion(sampleMessages)).rejects.toThrow('AbortError');
    });
  });

  describe('Model Management', () => {
    it('should return available models', () => {
      const models = provider.getAvailableModels();
      expect(models).toContain('gpt-4o-mini');
      expect(models).toContain('gpt-4');
      expect(models).toContain('gpt-3.5-turbo');
    });

    it('should validate supported models', () => {
      expect(provider.validateModel('gpt-4o-mini')).toBe(true);
      expect(provider.validateModel('gpt-4')).toBe(true);
      expect(provider.validateModel('invalid-model')).toBe(false);
    });
  });

  describe('Cost Calculation', () => {
    it('should calculate cost for gpt-4o-mini', () => {
      const usage = { promptTokens: 1000, completionTokens: 500 };
      const cost = provider.calculateCost(usage);

      // gpt-4o-mini: $0.000150/1K input, $0.0006/1K output
      const expectedCost = (1000 * 0.00015) / 1000 + (500 * 0.0006) / 1000;
      expect(cost).toBeCloseTo(expectedCost, 6);
    });

    it('should get cost per token for current model', () => {
      const costs = provider.getCostPerToken();
      expect(costs).toHaveProperty('input');
      expect(costs).toHaveProperty('output');
      expect(typeof costs.input).toBe('number');
      expect(typeof costs.output).toBe('number');
    });
  });

  describe('Configuration Options', () => {
    it('should support custom base URL', () => {
      const customProvider = new OpenAIProvider({
        ...validConfig,
        baseURL: 'https://custom-openai.example.com/v1',
      });

      expect(customProvider).toBeInstanceOf(OpenAIProvider);
    });

    it('should support organization ID', () => {
      const orgProvider = new OpenAIProvider({
        ...validConfig,
        organization: 'org-123456789',
      });

      expect(orgProvider).toBeInstanceOf(OpenAIProvider);
    });
  });
});
