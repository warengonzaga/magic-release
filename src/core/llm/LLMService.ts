/**
 * LLM Service - Main service for language model interactions
 * Manages providers and provides unified interface for changelog generation
 */

import type { LLMMessage } from './providers/BaseProvider.js';
import BaseProvider from './providers/BaseProvider.js';
import OpenAIProvider from './providers/OpenAIProvider.js';
import type { MagicReleaseConfig } from '../../types/index.js';
import { LLMError, createMissingAPIKeyError } from '../../utils/errors.js';
import { logger } from '../../utils/logger.js';

export interface LLMServiceConfig {
  provider: 'openai' | 'anthropic' | 'azure';
  apiKey: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export class LLMService {
  private provider: BaseProvider;
  private config: LLMServiceConfig;

  constructor(config: LLMServiceConfig) {
    this.config = config;
    this.provider = this.createProvider(config);
  }

  /**
   * Create LLM provider instance based on configuration
   */
  private createProvider(config: LLMServiceConfig): BaseProvider {
    switch (config.provider) {
      case 'openai':
        return new OpenAIProvider({
          apiKey: config.apiKey,
          model: config.model || 'gpt-4o-mini',
          temperature: config.temperature || 0.1,
          maxTokens: config.maxTokens || 2000
        });
      
      case 'anthropic':
        throw new LLMError('Anthropic provider not yet implemented');
      
      case 'azure':
        throw new LLMError('Azure OpenAI provider not yet implemented');
      
      default:
        throw new LLMError(`Unsupported LLM provider: ${config.provider}`);
    }
  }

  /**
   * Generate changelog content from commit data
   */
  async generateChangelog(
    commits: string,
    projectContext?: string,
    previousChangelog?: string
  ): Promise<string> {
    logger.info(`Generating changelog using ${this.provider.getProviderName()}`);

    const messages: LLMMessage[] = [
      {
        role: 'system',
        content: this.getSystemPrompt()
      },
      {
        role: 'user',
        content: this.getUserPrompt(commits, projectContext, previousChangelog)
      }
    ];

    try {
      const response = await this.provider.generateCompletion(messages);
      
      logger.info('Changelog generated successfully', {
        tokensUsed: response.usage?.totalTokens,
        model: response.model
      });

      return response.content;
    } catch (error) {
      logger.error('Failed to generate changelog', error);
      throw new LLMError(`Failed to generate changelog: ${(error as Error).message}`);
    }
  }

  /**
   * Categorize a single commit
   */
  async categorizeCommit(commitMessage: string): Promise<string> {
    const messages: LLMMessage[] = [
      {
        role: 'system',
        content: 'You are a commit categorization expert. Categorize the following commit into one of these categories: Added, Changed, Deprecated, Removed, Fixed, Security. Respond with only the category name.'
      },
      {
        role: 'user',
        content: `Categorize this commit: ${commitMessage}`
      }
    ];

    try {
      const response = await this.provider.generateCompletion(messages);
      return response.content.trim();
    } catch (error) {
      logger.warn(`Failed to categorize commit: ${commitMessage}`, error);
      return 'Changed'; // Default fallback
    }
  }

  /**
   * Generate release summary
   */
  async generateReleaseSummary(changelogContent: string): Promise<string> {
    const messages: LLMMessage[] = [
      {
        role: 'system',
        content: 'You are a release manager. Create a concise, engaging summary of the release based on the changelog. Focus on the most important changes and their impact for users.'
      },
      {
        role: 'user',
        content: `Create a release summary for this changelog:\n\n${changelogContent}`
      }
    ];

    try {
      const response = await this.provider.generateCompletion(messages);
      return response.content;
    } catch (error) {
      logger.warn('Failed to generate release summary', error);
      return 'Release summary generation failed.';
    }
  }

  /**
   * Test the LLM connection
   */
  async testConnection(): Promise<boolean> {
    logger.debug('Testing LLM connection');
    
    try {
      const isConnected = await this.provider.testConnection();
      logger.info(`LLM connection test: ${isConnected ? 'SUCCESS' : 'FAILED'}`);
      return isConnected;
    } catch (error) {
      logger.error('LLM connection test failed', error);
      return false;
    }
  }

  /**
   * Get system prompt for changelog generation
   */
  private getSystemPrompt(): string {
    return `You are an expert changelog generator that follows the "Keep a Changelog" format (https://keepachangelog.com/). 

Your task is to:
1. Analyze git commit messages and categorize changes into: Added, Changed, Deprecated, Removed, Fixed, Security
2. Generate clean, user-friendly descriptions that focus on the impact for end users
3. Group related changes together
4. Use clear, concise language that non-technical users can understand
5. Follow semantic versioning principles

Format Guidelines:
- Use markdown formatting
- Start each category with ## [Category]
- Use bullet points (- ) for individual changes
- Include relevant issue/PR references when available
- Avoid technical jargon when possible
- Focus on benefits and impacts, not implementation details

Categories:
- **Added** for new features
- **Changed** for changes in existing functionality  
- **Deprecated** for soon-to-be removed features
- **Removed** for now removed features
- **Fixed** for any bug fixes
- **Security** in case of vulnerabilities

Only include categories that have changes. Do not include empty categories.`;
  }

  /**
   * Get user prompt for changelog generation
   */
  private getUserPrompt(
    commits: string,
    projectContext?: string,
    previousChangelog?: string
  ): string {
    let prompt = `Generate a changelog entry based on these git commits:\n\n${commits}\n\n`;

    if (projectContext) {
      prompt += `Project Context:\n${projectContext}\n\n`;
    }

    if (previousChangelog) {
      prompt += `Previous changelog for reference (maintain consistent style):\n${previousChangelog}\n\n`;
    }

    prompt += `Please generate a well-organized changelog entry that follows the Keep a Changelog format. Focus on user-facing changes and their benefits.`;

    return prompt;
  }

  /**
   * Get provider information
   */
  getProviderInfo(): { name: string; model?: string } {
    return {
      name: this.provider.getProviderName(),
      ...(this.config.model && { model: this.config.model })
    };
  }

  /**
   * Get available models for current provider
   */
  getAvailableModels(): string[] {
    return this.provider.getAvailableModels();
  }

  /**
   * Validate API key for current provider
   */
  validateApiKey(apiKey: string): boolean {
    return this.provider.validateApiKey(apiKey);
  }

  /**
   * Create LLM service from Magic Release configuration
   */
  static fromConfig(config: MagicReleaseConfig): LLMService {
    if (!config.llm.apiKey) {
      throw createMissingAPIKeyError(config.llm.provider);
    }

    const serviceConfig: LLMServiceConfig = {
      provider: config.llm.provider,
      apiKey: config.llm.apiKey,
      ...(config.llm.model && { model: config.llm.model }),
      ...(config.llm.temperature && { temperature: config.llm.temperature }),
      ...(config.llm.maxTokens && { maxTokens: config.llm.maxTokens })
    };

    return new LLMService(serviceConfig);
  }
}

export default LLMService;
