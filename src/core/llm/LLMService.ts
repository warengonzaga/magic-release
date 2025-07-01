/**
 * LLM Service - Main service for language model interactions
 * Manages providers and provides unified interface for changelog generation
 */

import type { MagicReleaseConfig } from '../../types/index.js';
import { LLMError, createMissingAPIKeyError } from '../../utils/errors.js';
import { logger } from '../../utils/logger.js';

import type { LLMMessage } from './providers/BaseProvider.js';
import BaseProvider from './providers/BaseProvider.js';
import ProviderFactory from './ProviderFactory.js';
import type { ProviderType } from './providers/ProviderInterface.js';
import ChangelogPrompt from './prompts/ChangelogPrompt.js';

export interface LLMServiceConfig {
  provider: ProviderType;
  apiKey: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  endpoint?: string; // For Azure
  apiVersion?: string; // For Azure
  deploymentName?: string; // For Azure
  baseURL?: string; // For OpenAI
  organization?: string; // For OpenAI
}

/**
 * LLMService - Language Model Service for changelog generation
 *
 * This service orchestrates interactions with various LLM providers (OpenAI, Anthropic, Azure)
 * to generate and categorize changelog content from Git commit data. It handles provider
 * initialization, prompt generation, and response processing.
 *
 * @example
 * ```typescript
 * const llmService = LLMService.fromConfig(config);
 * const changelog = await llmService.generateChangelog(commits, projectContext);
 * ```
 */
export class LLMService {
  /** The active LLM provider instance */
  private provider: BaseProvider;

  /** Service configuration including provider settings */
  private config: LLMServiceConfig;

  /** Prompt generator for creating LLM requests */
  private promptGenerator: ChangelogPrompt;

  /**
   * Create a new LLMService instance
   *
   * @param config - Configuration object containing provider settings
   */
  constructor(config: LLMServiceConfig) {
    this.config = config;
    this.provider = this.createProvider(config);
    this.promptGenerator = new ChangelogPrompt({
      llm: {
        provider: config.provider,
        apiKey: config.apiKey,
        ...(config.model && { model: config.model }),
        ...(config.temperature && { temperature: config.temperature }),
        ...(config.maxTokens && { maxTokens: config.maxTokens }),
      },
      changelog: {},
      git: {},
    });
  }

  /**
   * Create LLM provider instance using the factory
   *
   * @param config - Service configuration containing provider type and settings
   * @returns Configured LLM provider instance
   * @throws {Error} If the provider type is not supported
   */
  private createProvider(config: LLMServiceConfig): BaseProvider {
    try {
      // Create base options object
      const options: Record<string, unknown> = {
        model: config.model,
        temperature: config.temperature,
        maxTokens: config.maxTokens,
      };

      // Add provider-specific options
      if (config.provider === 'azure') {
        if (config.endpoint) options['endpoint'] = config.endpoint;
        if (config.apiVersion) options['apiVersion'] = config.apiVersion;
        if (config.deploymentName) options['deploymentName'] = config.deploymentName;
      } else if (config.provider === 'openai') {
        if (config.baseURL) options['baseURL'] = config.baseURL;
        if (config.organization) options['organization'] = config.organization;
      }

      return ProviderFactory.createProviderFromConfig(
        config.provider,
        config.apiKey,
        options as Record<string, unknown>
      );
    } catch (error) {
      logger.error(`Failed to create ${config.provider} provider`, error);
      throw error;
    }
  }

  /**
   * Generate changelog content from commit data
   *
   * Processes commit information and generates a formatted changelog using the
   * configured LLM provider. Optionally includes project context and previous
   * changelog data for improved consistency.
   *
   * @param commits - Formatted commit data for processing
   * @param projectContext - Optional project context for better categorization
   * @param previousChangelog - Optional previous changelog for consistency
   * @returns Generated changelog content
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
        content: this.promptGenerator.getSystemPrompt(),
      },
      {
        role: 'user',
        content: this.getUserPrompt(commits, projectContext, previousChangelog),
      },
    ];

    try {
      const response = await this.provider.generateCompletion(messages);

      logger.info('Changelog generated successfully', {
        tokensUsed: response.usage?.totalTokens,
        model: response.model,
      });

      return response.content;
    } catch (error) {
      logger.error('Failed to generate changelog', error);
      throw new LLMError(`Failed to generate changelog: ${(error as Error).message}`);
    }
  }

  /**
   * Categorize a single commit
   *
   * Uses the LLM to analyze and categorize an individual commit message
   * into appropriate changelog sections (Added, Fixed, Changed, etc.).
   *
   * @param commitMessage - The commit message to categorize
   * @returns The determined category for the commit
   */
  async categorizeCommit(commitMessage: string): Promise<string> {
    const messages: LLMMessage[] = [
      {
        role: 'system',
        content:
          'You are a commit categorization expert. Categorize the following commit into one of these categories: Added, Changed, Deprecated, Removed, Fixed, Security. Respond with only the category name.',
      },
      {
        role: 'user',
        content: this.promptGenerator.getCategorizationPrompt(commitMessage),
      },
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
   *
   * Creates a concise summary of changelog content, highlighting
   * the most important changes and their impact on users.
   *
   * @param changelogContent - The changelog content to summarize
   * @returns Concise release summary
   */
  async generateReleaseSummary(changelogContent: string): Promise<string> {
    const messages: LLMMessage[] = [
      {
        role: 'system',
        content:
          'You are a release manager. Create a concise, engaging summary of the release based on the changelog. Focus on the most important changes and their impact for users.',
      },
      {
        role: 'user',
        content: this.promptGenerator.getReleaseSummaryPrompt(changelogContent),
      },
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
   *
   * Validates that the configured LLM provider is accessible and
   * properly configured by sending a simple test request.
   *
   * @returns True if connection is successful, false otherwise
   */
  async testConnection(): Promise<boolean> {
    logger.debug('Testing LLM connection');

    try {
      const result = await this.provider.testConnection();
      const isConnected = result.valid;
      logger.info(`LLM connection test: ${isConnected ? 'SUCCESS' : 'FAILED'} - ${result.message}`);
      return isConnected;
    } catch (error) {
      logger.error('LLM connection test failed', error);
      return false;
    }
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
      ...(this.config.model && { model: this.config.model }),
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
  async validateApiKey(apiKey: string): Promise<boolean> {
    try {
      const result = await this.provider.validateApiKey(apiKey);
      return result.valid;
    } catch (error) {
      logger.error('API key validation failed', error);
      return false;
    }
  }

  /**
   * Rephrase commit message into clear, present imperative tense
   *
   * Takes a raw commit message and converts it into a clear, professional
   * description suitable for changelog entries, using present imperative tense.
   *
   * @param commitMessage - The commit message to rephrase
   * @returns The rephrased commit description
   */
  async rephraseCommitMessage(commitMessage: string): Promise<string> {
    const messages: LLMMessage[] = [
      {
        role: 'system',
        content:
          'You are a technical writer specializing in clear documentation. Rephrase commit messages into clear, present imperative tense descriptions suitable for changelog bullet points. Start with an action verb (Add, Fix, Update, Remove, etc.). Make it human-readable and professional. Return only the rephrased description.',
      },
      {
        role: 'user',
        content: `Rephrase this commit message into a clear, present imperative tense description: ${commitMessage}`,
      },
    ];

    try {
      const response = await this.provider.generateCompletion(messages);
      return response.content.trim();
    } catch (error) {
      logger.warn(`Failed to rephrase commit message: ${commitMessage}`, error);
      throw error; // Re-throw to allow fallback handling in caller
    }
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
      ...(config.llm.maxTokens && { maxTokens: config.llm.maxTokens }),
    };

    return new LLMService(serviceConfig);
  }
}

export default LLMService;
