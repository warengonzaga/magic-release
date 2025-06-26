/// <reference path="../../globals.d.ts" />

import { AzureProvider } from '../../../src/core/llm/providers/AzureProvider';
import type { AzureConfig } from '../../../src/core/llm/providers/AzureProvider';
import type { LLMMessage } from '../../../src/core/llm/providers/BaseProvider';

describe('AzureProvider', () => {
  let provider: AzureProvider;
  let mockConfig: AzureConfig;

  beforeEach(() => {
    mockConfig = {
      apiKey: TEST_CONSTANTS.VALID_AZURE_KEY,
      model: 'gpt-4',
      endpoint: 'https://test.openai.azure.com',
      deploymentName: 'gpt-4-deployment',
      apiVersion: '2024-02-15-preview',
      temperature: 0.3,
      maxTokens: 2000
    };
    provider = new AzureProvider(mockConfig);
  });

  describe('constructor', () => {
    it('should create instance with valid config', () => {
      expect(provider).toBeInstanceOf(AzureProvider);
    });

    it('should throw error if endpoint is missing', () => {
      const invalidConfig = { ...mockConfig, endpoint: '' };
      
      expect(() => new AzureProvider(invalidConfig)).toThrow('Azure endpoint is required');
    });

    it('should use environment variable for endpoint if not provided', () => {
      process.env['AZURE_OPENAI_ENDPOINT'] = 'https://env-endpoint.azure.com';
      const { endpoint: _, ...configWithoutEndpoint } = mockConfig;
      
      const envProvider = new AzureProvider({
        ...configWithoutEndpoint,
        endpoint: undefined as any, // Allow TypeScript to accept missing endpoint for test
      });
      expect(envProvider).toBeInstanceOf(AzureProvider);
      
      delete process.env['AZURE_OPENAI_ENDPOINT'];
    });

    it('should use default API version if not provided', () => {
      const configWithoutVersion = { ...mockConfig };
      delete configWithoutVersion.apiVersion;
      
      const defaultProvider = new AzureProvider(configWithoutVersion);
      expect(defaultProvider).toBeInstanceOf(AzureProvider);
    });
  });

  describe('generateCompletion', () => {
    it('should make successful API call and return response', async () => {
      const mockMessages: LLMMessage[] = [
        { role: 'system', content: 'Generate changelog' },
        { role: 'user', content: 'commit data' }
      ];

      const mockResponse = {
        choices: [{
          message: {
            content: 'Generated changelog content'
          },
          finish_reason: 'stop'
        }],
        usage: {
          prompt_tokens: 100,
          completion_tokens: 200,
          total_tokens: 300
        },
        model: 'gpt-4',
        id: 'test-id',
        object: 'chat.completion',
        created: Date.now()
      };

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      const result = await provider.generateCompletion(mockMessages);

      expect(result.content).toBe('Generated changelog content');
      expect(result.usage?.totalTokens).toBe(300);
      expect(result.finishReason).toBe('stop');
      expect(global.fetch).toHaveBeenCalledWith(
        `${mockConfig.endpoint}/openai/deployments/${mockConfig.deploymentName}/chat/completions?api-version=${mockConfig.apiVersion}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'api-key': mockConfig.apiKey,
            'User-Agent': 'MagicRelease/1.0.0'
          },
          body: JSON.stringify({
            messages: mockMessages.map(msg => ({
              role: msg.role,
              content: msg.content
            })),
            temperature: mockConfig.temperature,
            max_tokens: mockConfig.maxTokens
          }),
          signal: expect.any(AbortSignal)
        }
      );
    });

    it('should use model name as deployment if deploymentName not provided', async () => {
      const configWithoutDeployment = { ...mockConfig };
      delete configWithoutDeployment.deploymentName;
      const providerWithoutDeployment = new AzureProvider(configWithoutDeployment);

      const mockMessages: LLMMessage[] = [
        { role: 'user', content: 'test' }
      ];

      const mockResponse = {
        choices: [{ message: { content: 'response' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
        model: 'gpt-4',
        id: 'test',
        object: 'chat.completion',
        created: Date.now()
      };

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      await providerWithoutDeployment.generateCompletion(mockMessages);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining(`/deployments/${mockConfig.model}/`),
        expect.any(Object)
      );
    });

    it('should handle API errors gracefully', async () => {
      const mockMessages: LLMMessage[] = [
        { role: 'user', content: 'test' }
      ];

      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        json: () => Promise.resolve({
          error: { message: 'Invalid API key' }
        })
      });

      await expect(provider.generateCompletion(mockMessages))
        .rejects.toThrow('Azure OpenAI API error: 401 - Invalid API key');
    });

    it('should handle network errors', async () => {
      const mockMessages: LLMMessage[] = [
        { role: 'user', content: 'test' }
      ];

      global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

      await expect(provider.generateCompletion(mockMessages))
        .rejects.toThrow('Azure OpenAI API request failed: Network error');
    });

    it('should handle timeout errors', async () => {
      const mockMessages: LLMMessage[] = [
        { role: 'user', content: 'test' }
      ];

      const abortError = new Error('The user aborted a request.');
      abortError.name = 'AbortError';
      global.fetch = jest.fn().mockRejectedValue(abortError);

      await expect(provider.generateCompletion(mockMessages))
        .rejects.toThrow('Azure OpenAI API request timed out');
    });

    it('should handle missing content in response', async () => {
      const mockMessages: LLMMessage[] = [
        { role: 'user', content: 'test' }
      ];

      const mockResponse = {
        choices: [],
        usage: { prompt_tokens: 10, completion_tokens: 0, total_tokens: 10 },
        model: 'gpt-4',
        id: 'test',
        object: 'chat.completion',
        created: Date.now()
      };

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      await expect(provider.generateCompletion(mockMessages))
        .rejects.toThrow('No choices returned from Azure OpenAI API');
    });
  });

  describe('validateApiKey', () => {
    it('should validate correct API key format', async () => {
      const validKey = TEST_CONSTANTS.VALID_AZURE_KEY;
      const result = await provider.validateApiKey(validKey);
      
      expect(result.valid).toBe(true);
      expect(result.message).toBe('API key format is valid');
    });

    it('should reject invalid API key format', async () => {
      const invalidKey = 'invalid-key';
      const result = await provider.validateApiKey(invalidKey);
      
      expect(result.valid).toBe(false);
      expect(result.message).toContain('Invalid Azure API key format');
    });
  });

  describe('testConnection', () => {
    it('should return success for valid connection', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        status: 200,
        ok: true
      });

      const result = await provider.testConnection(TEST_CONSTANTS.VALID_AZURE_KEY);
      
      expect(result.valid).toBe(true);
      expect(result.message).toContain('✅');
    });

    it('should return error for unauthorized access', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        status: 401,
        ok: false
      });

      const result = await provider.testConnection('invalid-key-1234567890abcdef1234567890abcdef');
      
      expect(result.valid).toBe(false);
      expect(result.message).toContain('Invalid Azure API key format');
    });

    it('should return error for deployment not found', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        status: 404,
        ok: false
      });

      const result = await provider.testConnection(TEST_CONSTANTS.VALID_AZURE_KEY);
      
      expect(result.valid).toBe(false);
      expect(result.message).toContain('❌ Deployment not found');
    });

    it('should handle network errors', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

      const result = await provider.testConnection(TEST_CONSTANTS.VALID_AZURE_KEY);
      
      expect(result.valid).toBe(false);
      expect(result.message).toContain('🌐 Network error');
    });

    it('should return error if endpoint is missing', async () => {
      const configWithoutEndpoint = { ...mockConfig, endpoint: '' };
      const providerWithoutEndpoint = new AzureProvider({ ...configWithoutEndpoint, endpoint: 'temp' });
      // Manually set endpoint to empty to test this scenario
      (providerWithoutEndpoint as any).endpoint = '';

      const result = await providerWithoutEndpoint.testConnection(TEST_CONSTANTS.VALID_AZURE_KEY);
      
      expect(result.valid).toBe(false);
      expect(result.message).toContain('❌ Azure endpoint is required');
    });
  });

  describe('utility methods', () => {
    it('should return correct provider name', () => {
      expect(provider.getProviderName()).toBe('Azure OpenAI');
    });

    it('should return available models', () => {
      const models = provider.getAvailableModels();
      expect(models).toContain('gpt-4');
      expect(models).toContain('gpt-4-turbo');
      expect(models).toContain('gpt-35-turbo');
    });

    it('should validate supported models', () => {
      expect(provider.validateModel('gpt-4')).toBe(true);
      expect(provider.validateModel('unsupported-model')).toBe(false);
    });

    it('should validate API key format synchronously', () => {
      expect(provider.validateApiKeySync(TEST_CONSTANTS.VALID_AZURE_KEY)).toBe(true);
      expect(provider.validateApiKeySync('invalid-key')).toBe(false);
      expect(provider.validateApiKeySync('')).toBe(false);
      // @ts-ignore - testing invalid input
      expect(provider.validateApiKeySync(null)).toBe(false);
    });
  });
});
