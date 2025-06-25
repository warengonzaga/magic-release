/**
 * OpenAI Provider - Implementation for OpenAI GPT models
 * Handles communication with OpenAI API for changelog generation
 */

import type { LLMMessage, LLMResponse, LLMConfig } from './BaseProvider.js';
import BaseProvider from './BaseProvider.js';
import { createInvalidAPIKeyError, LLMError } from '../../../utils/errors.js';
import { logger } from '../../../utils/logger.js';

export interface OpenAIConfig extends LLMConfig {
  baseURL?: string;
  organization?: string;
}

export interface OpenAIResponse {
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

export class OpenAIProvider extends BaseProvider {
  private baseURL: string;
  private organization?: string;

  constructor(config: OpenAIConfig) {
    super({
      model: 'gpt-4o-mini', // Default to more cost-effective model
      ...config
    });

    this.baseURL = config.baseURL || 'https://api.openai.com/v1';
    if (config.organization) {
      this.organization = config.organization;
    }

    if (!this.validateApiKey(config.apiKey)) {
      throw createInvalidAPIKeyError('OpenAI');
    }
  }

  /**
   * Generate completion using OpenAI API
   */
  async generateCompletion(messages: LLMMessage[]): Promise<LLMResponse> {
    this.validateMessages(messages);

    logger.debug(`Generating completion with OpenAI model: ${this.config.model}`);
    logger.debug(`Messages: ${this.formatMessagesForLog(messages)}`);

    try {
      const response = await this.makeRequest(messages);
      
      if (!response.choices || response.choices.length === 0) {
        throw new LLMError('No choices returned from OpenAI API');
      }

      const choice = response.choices[0];
      if (!choice) {
        throw new LLMError('No valid choice returned from OpenAI API');
      }

      const result: LLMResponse = {
        content: choice.message.content,
        usage: {
          promptTokens: response.usage.prompt_tokens,
          completionTokens: response.usage.completion_tokens,
          totalTokens: response.usage.total_tokens
        },
        model: response.model,
        finishReason: choice.finish_reason
      };

      logger.debug(`OpenAI response: ${result.content.substring(0, 200)}...`);
      logger.debug(`Token usage: ${result.usage?.totalTokens} total tokens`);

      return result;
    } catch (error) {
      if (error instanceof LLMError) {
        throw error;
      }

      logger.error('OpenAI API request failed', error);
      throw new LLMError(`OpenAI API request failed: ${(error as Error).message}`);
    }
  }

  /**
   * Make HTTP request to OpenAI API
   */
  private async makeRequest(messages: LLMMessage[]): Promise<OpenAIResponse> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.config.apiKey}`,
      'User-Agent': 'MagicRelease/1.0.0'
    };

    if (this.organization) {
      headers['OpenAI-Organization'] = this.organization;
    }

    const body = {
      model: this.config.model,
      messages: messages.map(msg => ({
        role: msg.role,
        content: msg.content
      })),
      temperature: this.config.temperature,
      max_tokens: this.config.maxTokens
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const response = await fetch(`${this.baseURL}/chat/completions`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({})) as any;
        throw new LLMError(
          `OpenAI API error: ${response.status} - ${errorData.error?.message || response.statusText}`
        );
      }

      return await response.json() as OpenAIResponse;
    } catch (error) {
      clearTimeout(timeoutId);
      
      if ((error as Error).name === 'AbortError') {
        throw new LLMError('OpenAI API request timed out');
      }
      
      throw error;
    }
  }

  /**
   * Validate OpenAI API key format
   */
  validateApiKey(apiKey: string): boolean {
    // OpenAI API keys can be:
    // - Legacy format: sk-[48 chars] 
    // - Project format: sk-proj-[variable length]
    // - Organization format: sk-org-[variable length]
    
    if (!apiKey || typeof apiKey !== 'string') {
      return false;
    }

    // Check if it starts with sk- and has reasonable length
    if (!apiKey.startsWith('sk-') || apiKey.length < 50) {
      return false;
    }

    // Support different OpenAI key formats
    const validPatterns = [
      /^sk-[a-zA-Z0-9]{48}$/, // Legacy format
      /^sk-proj-[a-zA-Z0-9\-_]{40,}$/, // Project format
      /^sk-org-[a-zA-Z0-9\-_]{40,}$/, // Organization format
      /^sk-[a-zA-Z0-9\-_]{48,}$/ // Generic fallback for future formats
    ];

    return validPatterns.some(pattern => pattern.test(apiKey));
  }

  /**
   * Get provider name
   */
  getProviderName(): string {
    return 'OpenAI';
  }

  /**
   * Get available models
   */
  getAvailableModels(): string[] {
    return [
      'gpt-4o',
      'gpt-4o-mini',
      'gpt-4-turbo',
      'gpt-4',
      'gpt-3.5-turbo'
    ];
  }

  /**
   * Get cost per token for the current model (in USD)
   */
  getCostPerToken(): { input: number; output: number } {
    const costs: Record<string, { input: number; output: number }> = {
      'gpt-4o': { input: 0.0025 / 1000, output: 0.01 / 1000 },
      'gpt-4o-mini': { input: 0.000150 / 1000, output: 0.0006 / 1000 },
      'gpt-4-turbo': { input: 0.01 / 1000, output: 0.03 / 1000 },
      'gpt-4': { input: 0.03 / 1000, output: 0.06 / 1000 },
      'gpt-3.5-turbo': { input: 0.0015 / 1000, output: 0.002 / 1000 }
    };

    const modelName = this.config.model || 'gpt-4o-mini';
    return costs[modelName] || costs['gpt-4o-mini']!;
  }

  /**
   * Calculate estimated cost for a response
   */
  calculateCost(usage: { promptTokens: number; completionTokens: number }): number {
    const costs = this.getCostPerToken();
    return (usage.promptTokens * costs.input) + (usage.completionTokens * costs.output);
  }
}

export default OpenAIProvider;
