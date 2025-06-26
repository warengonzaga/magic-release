/**
 * Base LLM Provider - Abstract class for all LLM providers
 * Defines the interface for language model interactions
 */

import type { ValidationResult } from './ProviderInterface.js';

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMResponse {
  content: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  model?: string;
  finishReason?: string;
}

export interface LLMConfig {
  apiKey: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  timeout?: number;
}

export abstract class BaseProvider {
  protected config: LLMConfig;

  constructor(config: LLMConfig) {
    this.config = {
      temperature: 0.1, // Low temperature for consistent output
      maxTokens: 2000,
      timeout: 30000, // 30 seconds
      ...config,
    };
  }

  /**
   * Generate completion from messages
   */
  abstract generateCompletion(messages: LLMMessage[]): Promise<LLMResponse>;

  /**
   * Validate API key format - modern async version
   */
  abstract validateApiKey(apiKey: string): Promise<ValidationResult>;

  /**
   * Legacy sync validation method for backward compatibility
   */
  validateApiKeySync(apiKey: string): boolean {
    // Default implementation - should be overridden by providers
    return Boolean(apiKey && apiKey.length > 0);
  }

  /**
   * Get provider name
   */
  abstract getProviderName(): string;

  /**
   * Get available models
   */
  abstract getAvailableModels(): string[];

  /**
   * Test connection to the provider with key
   */
  abstract testConnection(key?: string): Promise<ValidationResult>;

  /**
   * Validate model is supported
   */
  validateModel(model: string): boolean {
    return this.getAvailableModels().includes(model);
  }

  /**
   * Format messages for logging (without sensitive content)
   */
  protected formatMessagesForLog(messages: LLMMessage[]): string {
    return messages.map(msg => `${msg.role}: ${msg.content.substring(0, 100)}...`).join('\n');
  }

  /**
   * Validate message array
   */
  protected validateMessages(messages: LLMMessage[]): void {
    if (!messages ?? messages.length === 0) {
      throw new Error('Messages array cannot be empty');
    }

    for (const message of messages) {
      if (!message.role ?? !message.content) {
        throw new Error('Each message must have role and content');
      }

      if (!['system', 'user', 'assistant'].includes(message.role)) {
        throw new Error(`Invalid message role: ${message.role}`);
      }
    }
  }
}

export default BaseProvider;
