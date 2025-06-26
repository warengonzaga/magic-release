/**
 * Azure OpenAI Provider
 * Implements Azure OpenAI API integration
 */

import { createInvalidAPIKeyError, LLMError } from '../../../utils/errors.js';
import { logger } from '../../../utils/logger.js';

import type { LLMMessage, LLMResponse, LLMConfig } from './BaseProvider.js';
import BaseProvider from './BaseProvider.js';
import type { ProviderValidator, ValidationResult } from './ProviderInterface.js';
import { PROVIDER_CONFIGS } from './ProviderInterface.js';

export interface AzureConfig extends LLMConfig {
  endpoint: string;
  apiVersion?: string;
  deploymentName?: string;
}

export interface AzureResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export class AzureProvider extends BaseProvider implements ProviderValidator {
  static config = PROVIDER_CONFIGS['azure'];
  private endpoint: string;
  private apiVersion: string;
  private deploymentName: string | undefined;

  constructor(config: AzureConfig) {
    super({
      model: 'gpt-4o-mini', // Default model
      ...config,
    });

    this.endpoint = config.endpoint ?? process.env['AZURE_OPENAI_ENDPOINT'] ?? '';
    this.apiVersion = config.apiVersion ?? '2024-02-15-preview';
    this.deploymentName = config.deploymentName;

    if (!this.endpoint) {
      throw new LLMError(
        'Azure endpoint is required. Set AZURE_OPENAI_ENDPOINT or provide endpoint in config.'
      );
    }

    if (!this.validateApiKeySync(config.apiKey)) {
      throw createInvalidAPIKeyError('Azure');
    }
  }

  /**
   * Validate API key format (sync method for backward compatibility)
   */
  override validateApiKeySync(apiKey: string): boolean {
    if (!apiKey ?? typeof apiKey !== 'string') {
      return false;
    }
    return AzureProvider.config?.apiKeyPattern.test(apiKey) ?? false;
  }

  /**
   * Generate completion using Azure OpenAI API
   */
  async generateCompletion(messages: LLMMessage[]): Promise<LLMResponse> {
    this.validateMessages(messages);

    logger.debug(`Generating completion with Azure OpenAI model: ${this.config.model}`);
    logger.debug(`Messages: ${this.formatMessagesForLog(messages)}`);

    try {
      const response = await this.makeRequest(messages);

      if (!response.choices ?? response.choices.length === 0) {
        throw new LLMError('No choices returned from Azure OpenAI API');
      }

      const choice = response.choices[0];
      if (!choice) {
        throw new LLMError('No valid choice returned from Azure OpenAI API');
      }

      const result: LLMResponse = {
        content: choice.message.content,
        usage: {
          promptTokens: response.usage.prompt_tokens,
          completionTokens: response.usage.completion_tokens,
          totalTokens: response.usage.total_tokens,
        },
        model: response.model,
        finishReason: choice.finish_reason,
      };

      logger.debug(`Azure OpenAI response: ${result.content.substring(0, 200)}...`);
      logger.debug(`Token usage: ${result.usage?.totalTokens} total tokens`);

      return result;
    } catch (error) {
      if (error instanceof LLMError) {
        throw error;
      }

      logger.error('Azure OpenAI API request failed', error);
      throw new LLMError(`Azure OpenAI API request failed: ${(error as Error).message}`);
    }
  }

  /**
   * Make HTTP request to Azure OpenAI API
   */
  private async makeRequest(messages: LLMMessage[]): Promise<AzureResponse> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'api-key': this.config.apiKey,
      'User-Agent': 'MagicRelease/1.0.0',
    };

    // Use deployment name if provided, otherwise use model name
    const modelOrDeployment = this.deploymentName ?? this.config.model;
    const url = `${this.endpoint}/openai/deployments/${modelOrDeployment}/chat/completions?api-version=${this.apiVersion}`;

    const body = {
      messages: messages.map(msg => ({
        role: msg.role,
        content: msg.content,
      })),
      temperature: this.config.temperature,
      max_tokens: this.config.maxTokens,
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = (await response.json().catch(() => ({}))) as any;
        throw new LLMError(
          `Azure OpenAI API error: ${response.status} - ${errorData.error?.message ?? response.statusText}`
        );
      }

      return (await response.json()) as AzureResponse;
    } catch (error) {
      clearTimeout(timeoutId);

      if ((error as Error).name === 'AbortError') {
        throw new LLMError('Azure OpenAI API request timed out');
      }

      throw error;
    }
  }

  /**
   * Validate API key format
   */
  async validateApiKey(key: string): Promise<ValidationResult> {
    logger.debug('Validating Azure API key format');

    // Azure keys are typically 32+ character strings
    if (!AzureProvider.config?.apiKeyPattern.test(key)) {
      return {
        valid: false,
        message: 'Invalid Azure API key format. Expected: 32+ alphanumeric characters',
      };
    }

    return {
      valid: true,
      message: 'API key format is valid',
    };
  }

  /**
   * Test connection to Azure OpenAI API
   */
  async testConnection(key?: string): Promise<ValidationResult> {
    const apiKey = key ?? this.config.apiKey;
    logger.debug('Testing Azure OpenAI API connection');

    // First validate format
    const formatValidation = await this.validateApiKey(apiKey);
    if (!formatValidation.valid) {
      return formatValidation;
    }

    if (!this.endpoint) {
      return {
        valid: false,
        message: '❌ Azure endpoint is required but not configured',
      };
    }

    // Test with a simple API call
    try {
      const modelOrDeployment = this.deploymentName ?? this.config.model;
      const url = `${this.endpoint}/openai/deployments/${modelOrDeployment}/chat/completions?api-version=${this.apiVersion}`;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': apiKey,
        },
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'Hi' }],
          max_tokens: 10,
        }),
      });

      if (response.status === 200) {
        logger.info('Azure OpenAI API key validation successful');
        return {
          valid: true,
          message: '✅ Azure OpenAI API key is valid and working!',
        };
      } else if (response.status === 401) {
        logger.warn('Azure OpenAI API key validation failed - unauthorized');
        return {
          valid: false,
          message: '❌ Invalid Azure OpenAI API key - unauthorized',
        };
      } else if (response.status === 404) {
        return {
          valid: false,
          message: '❌ Deployment not found. Check your model/deployment name and endpoint.',
        };
      } else {
        logger.warn(`Azure OpenAI API returned status ${response.status}`);
        return {
          valid: true,
          message: '⚠️ API key appears valid (non-auth error occurred)',
        };
      }
    } catch (error) {
      logger.error('Azure OpenAI API connection test failed', error);
      return {
        valid: false,
        message: `🌐 Network error: ${(error as Error).message}`,
      };
    }
  }

  /**
   * Validate model is supported
   */
  override validateModel(model: string): boolean {
    return AzureProvider.config?.supportedModels.includes(model) ?? false;
  }

  /**
   * Get provider name
   */
  getProviderName(): string {
    return 'Azure OpenAI';
  }

  /**
   * Get available models
   */
  getAvailableModels(): string[] {
    return (
      AzureProvider.config?.supportedModels ?? [
        'gpt-4',
        'gpt-4-turbo',
        'gpt-35-turbo',
        'gpt-4o-mini',
      ]
    );
  }
}

export default AzureProvider;
