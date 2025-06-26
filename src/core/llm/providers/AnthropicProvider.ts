/**
 * Anthropic Provider
 * Implements Claude API integration
 */

import { createInvalidAPIKeyError, LLMError } from '../../../utils/errors.js';
import { logger } from '../../../utils/logger.js';

import type { LLMMessage, LLMResponse, LLMConfig } from './BaseProvider.js';
import BaseProvider from './BaseProvider.js';
import type { ProviderValidator, ValidationResult } from './ProviderInterface.js';
import { PROVIDER_CONFIGS } from './ProviderInterface.js';

export interface AnthropicConfig extends LLMConfig {
  // Anthropic-specific config options can be added here
}

export interface AnthropicMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface AnthropicResponse {
  id: string;
  type: string;
  role: string;
  content: Array<{
    type: string;
    text: string;
  }>;
  model: string;
  stop_reason: string;
  stop_sequence: null | string;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

interface AnthropicRequestBody {
  model: string;
  messages: AnthropicMessage[];
  max_tokens: number;
  temperature: number;
  system?: string;
}

interface AnthropicErrorResponse {
  error?: {
    message?: string;
  };
}

export class AnthropicProvider extends BaseProvider implements ProviderValidator {
  static config = PROVIDER_CONFIGS['anthropic'];

  constructor(config: AnthropicConfig) {
    super({
      model: 'claude-3-haiku-20240307', // Default to cost-effective model
      ...config,
    });

    if (!this.validateApiKeySync(config.apiKey)) {
      throw createInvalidAPIKeyError('Anthropic');
    }
  }

  /**
   * Validate API key format (sync method for backward compatibility)
   */
  override validateApiKeySync(apiKey: string): boolean {
    if (!apiKey || typeof apiKey !== 'string') {
      return false;
    }
    return AnthropicProvider.config?.apiKeyPattern.test(apiKey) ?? false;
  }

  /**
   * Generate completion using Anthropic API
   */
  async generateCompletion(messages: LLMMessage[]): Promise<LLMResponse> {
    this.validateMessages(messages);

    logger.debug(`Generating completion with Anthropic model: ${this.config.model}`);
    logger.debug(`Messages: ${this.formatMessagesForLog(messages)}`);

    try {
      const response = await this.makeRequest(messages);

      if (!response.content || response.content.length === 0) {
        throw new LLMError('No content returned from Anthropic API');
      }

      const textContent = response.content.find(c => c.type === 'text')?.text ?? '';

      const result: LLMResponse = {
        content: textContent,
        usage: {
          promptTokens: response.usage.input_tokens,
          completionTokens: response.usage.output_tokens,
          totalTokens: response.usage.input_tokens + response.usage.output_tokens,
        },
        model: response.model,
        finishReason: response.stop_reason,
      };

      logger.debug(`Anthropic response: ${result.content.substring(0, 200)}...`);
      logger.debug(`Token usage: ${result.usage?.totalTokens} total tokens`);

      return result;
    } catch (error) {
      if (error instanceof LLMError) {
        throw error;
      }

      logger.error('Anthropic API request failed', error);
      throw new LLMError(`Anthropic API request failed: ${(error as Error).message}`);
    }
  }

  /**
   * Make HTTP request to Anthropic API
   */
  private async makeRequest(messages: LLMMessage[]): Promise<AnthropicResponse> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-api-key': this.config.apiKey,
      'anthropic-version': '2023-06-01',
      'User-Agent': 'MagicRelease/1.0.0',
    };

    // Convert messages format for Anthropic
    const anthropicMessages: AnthropicMessage[] = [];
    let systemMessage = '';

    for (const message of messages) {
      if (message.role === 'system') {
        systemMessage = message.content;
      } else {
        anthropicMessages.push({
          role: message.role as 'user' | 'assistant',
          content: message.content,
        });
      }
    }

    const body: AnthropicRequestBody = {
      model: this.config.model ?? 'claude-3-haiku-20240307',
      messages: anthropicMessages,
      max_tokens: this.config.maxTokens ?? 1000,
      temperature: this.config.temperature ?? 0.7,
    };

    if (systemMessage) {
      body.system = systemMessage;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = (await response.json().catch(() => ({}))) as AnthropicErrorResponse;
        throw new LLMError(
          `Anthropic API error: ${response.status} - ${errorData.error?.message ?? response.statusText}`
        );
      }

      return (await response.json()) as AnthropicResponse;
    } catch (error) {
      clearTimeout(timeoutId);

      if ((error as Error).name === 'AbortError') {
        throw new LLMError('Anthropic API request timed out');
      }

      throw error;
    }
  }

  /**
   * Validate API key format
   */
  async validateApiKey(key: string): Promise<ValidationResult> {
    logger.debug('Validating Anthropic API key format');

    // Basic format validation
    if (!AnthropicProvider.config?.apiKeyPattern.test(key)) {
      return {
        valid: false,
        message: 'Invalid Anthropic API key format. Expected format: sk-ant-xxx...',
      };
    }

    return {
      valid: true,
      message: 'API key format is valid',
    };
  }

  /**
   * Test connection to Anthropic API
   */
  async testConnection(key?: string): Promise<ValidationResult> {
    const apiKey = key ?? this.config.apiKey;
    logger.debug('Testing Anthropic API connection');

    // First validate format
    const formatValidation = await this.validateApiKey(apiKey);
    if (!formatValidation.valid) {
      return formatValidation;
    }

    // Test with a simple API call
    try {
      const headers = {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      };

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: 'claude-3-haiku-20240307',
          messages: [{ role: 'user', content: 'Hi' }],
          max_tokens: 10,
        }),
      });

      if (response.status === 200) {
        logger.info('Anthropic API key validation successful');
        return {
          valid: true,
          message: '✅ Anthropic API key is valid and working!',
        };
      } else if (response.status === 401) {
        logger.warn('Anthropic API key validation failed - unauthorized');
        return {
          valid: false,
          message: '❌ Invalid Anthropic API key - unauthorized',
        };
      } else {
        logger.warn(`Anthropic API returned status ${response.status}`);
        return {
          valid: true,
          message: '⚠️ API key appears valid (non-auth error occurred)',
        };
      }
    } catch (error) {
      logger.error('Anthropic API connection test failed', error);
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
    return AnthropicProvider.config?.supportedModels.includes(model) ?? false;
  }

  /**
   * Get provider name
   */
  getProviderName(): string {
    return 'Anthropic';
  }

  /**
   * Get available models
   */
  getAvailableModels(): string[] {
    return (
      AnthropicProvider.config?.supportedModels ?? [
        'claude-3-haiku-20240307',
        'claude-3-sonnet-20240229',
        'claude-3-opus-20240229',
        'claude-3-5-sonnet-20241022',
      ]
    );
  }
}

export default AnthropicProvider;
