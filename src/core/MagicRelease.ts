/**
 * MagicRelease - Main application class for AI-powered changelog generation
 *
 * This is the core orchestrator class that coordinates all components of Magic Release
 * to generate professional changelogs from Git commit history using AI. It manages
 * Git operations, commit parsing, AI processing, and changelog generation.
 *
 * @example
 * ```typescript
 * const config = await loadConfig();
 * const magicRelease = new MagicRelease(config);
 * const changelog = await magicRelease.generate({
 *   from: 'v1.0.0',
 *   to: 'HEAD',
 *   dryRun: false
 * });
 * ```
 */

import path from 'path';
import { existsSync, readFileSync } from 'fs';

import type {
  MagicReleaseConfig,
  RepositoryAnalysis,
  Commit,
  ChangelogEntry,
  ChangeType,
  Tag,
  RepositoryInfo,
} from '../types/index.js';
import { logger } from '../utils/logger.js';

import GitService from './git/GitService.js';
import CommitParser from './git/CommitParser.js';
import TagManager from './git/TagManager.js';
import LLMService from './llm/LLMService.js';
import KeepChangelogGenerator from './generator/KeepChangelogGenerator.js';
import ChangelogParser from './generator/ChangelogParser.js';

export interface GenerateOptions {
  from?: string;
  to?: string;
  dryRun?: boolean;
  verbose?: boolean;
  includeUnreleased?: boolean;
}

export class MagicRelease {
  /** Application configuration containing LLM and Git settings */
  private config: MagicReleaseConfig;

  /** Git service for repository operations */
  private gitService: GitService;

  /** Commit parser for analyzing commit messages */
  private commitParser: CommitParser;

  /** Tag manager for version and release management */
  private tagManager: TagManager;

  /** LLM service for AI-powered content generation */
  private llmService: LLMService;

  /** Changelog generator for Keep a Changelog format */
  private changelogGenerator: KeepChangelogGenerator;

  /** Changelog parser for existing changelog analysis */
  private changelogParser: ChangelogParser;

  /** Current working directory */
  private cwd: string;

  /**
   * Create a new MagicRelease instance
   *
   * @param config - Configuration object with LLM provider and changelog settings
   * @param cwd - Working directory (defaults to current working directory)
   */
  constructor(config: MagicReleaseConfig, cwd: string = process.cwd()) {
    this.config = config;
    this.cwd = cwd;

    // Initialize services
    this.gitService = new GitService(cwd);
    this.commitParser = new CommitParser();
    this.tagManager = new TagManager(cwd);
    this.llmService = LLMService.fromConfig(config);
    this.changelogGenerator = new KeepChangelogGenerator(config);
    this.changelogParser = new ChangelogParser();

    logger.info('MagicRelease initialized', {
      cwd: this.cwd,
      provider: config.llm.provider,
      model: config.llm.model,
    });
  }

  /**
   * Generate changelog based on options
   *
   * Main method that orchestrates the complete changelog generation process:
   * 1. Analyzes repository structure and commits
   * 2. Processes commits using AI for categorization
   * 3. Generates formatted changelog content
   * 4. Writes the changelog to file (unless in dry-run mode)
   *
   * @param options - Generation options including commit range and behavior flags
   * @returns Generated changelog content as string
   * @throws {Error} If generation fails at any stage
   */
  async generate(options: GenerateOptions = {}): Promise<string> {
    logger.info('Starting changelog generation', options);

    try {
      // Analyze repository
      const analysis = await this.analyzeRepository(options);

      // Generate changelog content
      const changelogContent = await this.generateChangelogContent(analysis);

      // Write to file unless dry run
      if (!options.dryRun) {
        await this.writeChangelog(changelogContent);
        logger.info(`Changelog written to ${this.getChangelogPath()}`);
      } else {
        logger.info('Dry run mode - changelog not written to file');
      }

      return changelogContent;
    } catch (error) {
      logger.error('Changelog generation failed', error);
      throw error;
    }
  }

  /**
   * Analyze repository and gather information
   *
   * Performs comprehensive repository analysis including:
   * - Repository metadata extraction
   * - Tag and version analysis
   * - Commit retrieval and filtering
   * - Existing changelog parsing
   *
   * @param options - Analysis options for commit range filtering
   * @returns Complete repository analysis data
   */
  private async analyzeRepository(options: GenerateOptions): Promise<RepositoryAnalysis> {
    logger.debug('Analyzing repository');

    // Get repository information
    const remoteUrl = this.gitService.getRemoteUrl();
    const repository = this.parseRepositoryInfo(remoteUrl ?? '');

    // Check if repository has any commits
    if (!this.gitService.hasCommits()) {
      logger.warn('Repository has no commits, returning empty analysis');
      return {
        repository,
        tags: [],
        commits: [],
        newVersions: [],
        existingVersions: new Set<string>(),
      };
    }

    // Get all tags and convert to semantic versions
    const gitTags = this.gitService.getAllTags();
    const tags = this.tagManager.getVersionTags(gitTags);

    // Determine commit range
    const { from, to } = this.determineCommitRange(options, tags);

    // Get commits in range
    const gitCommits = this.gitService.getCommitsBetween(from, to);
    const categorizedCommits = this.commitParser.parseCommits(gitCommits);

    // Convert to structured format
    const commits: Commit[] = [];
    for (const [, categoryCommits] of categorizedCommits) {
      commits.push(...categoryCommits);
    }

    // Get existing changelog versions
    const existingVersions = this.getExistingVersions();

    const analysis: RepositoryAnalysis = {
      repository,
      tags,
      commits,
      newVersions: [], // Will be populated by changelog generation
      existingVersions,
    };

    logger.debug('Repository analysis complete', {
      tagsCount: tags.length,
      commitsCount: commits.length,
      commitRange: `${from ?? 'beginning'}..${to}`,
    });

    return analysis;
  }

  /**
   * Generate changelog content from analysis
   */
  private async generateChangelogContent(analysis: RepositoryAnalysis): Promise<string> {
    logger.debug('Generating changelog content');

    // Convert commits to changelog entries
    const entries = await this.createChangelogEntries(analysis);

    // Generate changelog using Keep a Changelog format
    const changelogContent = await this.changelogGenerator.generate(entries, this.cwd);

    return changelogContent;
  }

  /**
   * Create changelog entries from repository analysis
   */
  private async createChangelogEntries(analysis: RepositoryAnalysis): Promise<ChangelogEntry[]> {
    const entries: ChangelogEntry[] = [];

    if (analysis.commits.length === 0) {
      logger.info('No commits found for changelog generation');
      return entries;
    }

    // Group commits by potential versions or create an "Unreleased" entry
    const unreleasedEntry: ChangelogEntry = {
      version: 'Unreleased',
      date: new Date(),
      sections: new Map(),
    };

    // Re-categorize commits using commit parser to get proper categorization
    const { from, to } = this.determineCommitRange({}, analysis.tags);
    const gitCommits = this.gitService.getCommitsBetween(from, to);
    const categorizedCommits = this.commitParser.parseCommits(gitCommits);

    // Convert categorized commits to changelog entries
    const categorizedChanges = new Map<
      ChangeType,
      Array<{
        description: string;
        commits: Commit[];
        scope?: string;
        pr?: number;
        issues?: string[];
      }>
    >();

    // Process each category from CommitParser
    for (const [category, categoryCommits] of categorizedCommits) {
      // Sort commits within category by date (newest first)
      const sortedCategoryCommits = [...categoryCommits].sort((a, b) => {
        const dateA = a.date ?? new Date(0);
        const dateB = b.date ?? new Date(0);
        return dateB.getTime() - dateA.getTime();
      });

      const changes = await Promise.all(
        sortedCategoryCommits.map(async commit => ({
          description: await this.generateChangeDescription(commit),
          commits: [commit],
          ...(commit.scope && { scope: commit.scope }),
          ...(commit.pr && { pr: commit.pr }),
          ...(commit.issues && commit.issues.length > 0 && { issues: commit.issues }),
        }))
      );

      categorizedChanges.set(category, changes);
    }

    // Add categorized changes to sections in Keep a Changelog order
    const changelogOrder: ChangeType[] = [
      'Added',
      'Changed',
      'Deprecated',
      'Removed',
      'Fixed',
      'Security',
    ];

    for (const category of changelogOrder) {
      if (categorizedChanges.has(category)) {
        const changes = categorizedChanges.get(category);
        if (changes) {
          // Changes are already in newest-first order from sorting
          unreleasedEntry.sections.set(category, changes);
        }
      }
    }

    entries.push(unreleasedEntry);
    return entries;
  }

  /**
   * Generate user-friendly change description from commit
   * Uses LLM to rephrase commit messages into clear, present imperative tense
   */
  private async generateChangeDescription(commit: Commit): Promise<string> {
    try {
      // Use LLM service to rephrase the commit message
      const response = await this.llmService.rephraseCommitMessage(commit.message);

      if (response && response.trim().length > 0) {
        // Clean up any extra formatting from LLM response
        let cleaned = response.trim();
        // Remove quotes if present
        cleaned = cleaned.replace(/^["']|["']$/g, '');
        // Remove leading dash if present
        cleaned = cleaned.replace(/^-\s*/, '');
        // Ensure it starts with capital letter
        cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
        return cleaned;
      }
    } catch (error) {
      logger.warn('Failed to rephrase commit message using LLM, falling back to manual cleanup', {
        error,
      });
    }

    // Fallback: Clean up the commit message manually
    let description = commit.message;

    // Remove conventional commit prefixes and emojis if present
    description = description.replace(
      /^(🐛|🚀|✨|📚|☕|🔧|📦|🎨|♻️|🔥|💚|👷|📝|⚡|🩹|🔒|➕|➖|📌|⬆️|⬇️|📎|🚨|🌐|💄|🍱|♿|💡|🍻|💬|🗃️|🏷️|🧱|👽|💥|🗑️|🔇)?\s*(feat|fix|docs|style|refactor|test|chore|perf|build|ci|revert)(\(.+\))?[!]?:\s*/,
      ''
    );

    // Remove remaining emoji patterns at the start (including broken unicode and � characters)
    description = description.replace(
      /^[🐛🚀✨📚☕🔧📦🎨♻️🔥💚👷📝⚡🩹🔒➕➖📌⬆️⬇️📎🚨🌐💄🍱♿💡🍻💬🗃️🏷️🧱👽💥🗑️🔇�]+\s*/,
      ''
    );

    // Remove common prefixes that don't add value
    description = description.replace(/^(new|add|fix|update|remove|change|improve|tweak):\s*/i, '');

    // Clean up specific patterns
    description = description.replace(/^tweak:\s*/i, '');
    description = description.replace(/^�\s*new:\s*/i, '');
    description = description.replace(/^�\s*/i, '');

    // Remove extra whitespace
    description = description.trim();

    // If description is empty or too short, provide a default
    if (!description || description.length < 3) {
      description = 'Update functionality';
    }

    // Convert to human-readable, present imperative tense
    // Ensure it starts with a capital letter and action verb
    description = this.convertToImperativeTense(description, commit);

    return description;
  }

  /**
   * Convert commit message to human-readable, present imperative tense
   */
  private convertToImperativeTense(description: string, commit: Commit): string {
    // Determine the appropriate action verb based on commit type or content
    const actionVerb = this.getActionVerb(description, commit);

    // Clean up and format the description
    let cleanDescription = description;

    // Remove any existing action verbs if they're redundant
    cleanDescription = cleanDescription.replace(
      /^(add|fix|update|remove|change|improve|implement|create|delete|refactor|optimize|enhance|modify)\s+/i,
      ''
    );

    // Handle specific patterns for better readability
    cleanDescription = this.improveDescriptionReadability(cleanDescription);

    // Combine action verb with cleaned description
    const result = `${actionVerb} ${cleanDescription}`;

    // Ensure proper capitalization
    return result.charAt(0).toUpperCase() + result.slice(1);
  }

  /**
   * Determine appropriate action verb based on commit content
   */
  private getActionVerb(description: string, commit: Commit): string {
    const message = `${commit.message} ${description}`.toLowerCase();

    // Check for specific patterns to determine the most appropriate verb
    if (
      message.includes('bug') ||
      message.includes('error') ||
      message.includes('issue') ||
      message.includes('problem') ||
      message.includes('broken') ||
      commit.type === 'fix'
    ) {
      return 'Fix';
    }

    if (
      message.includes('security') ||
      message.includes('vulnerability') ||
      message.includes('exploit')
    ) {
      return 'Fix';
    }

    if (
      message.includes('performance') ||
      message.includes('optimize') ||
      message.includes('speed') ||
      message.includes('faster') ||
      message.includes('cache')
    ) {
      return 'Optimize';
    }

    if (message.includes('remove') || message.includes('delete') || message.includes('drop')) {
      return 'Remove';
    }

    if (
      message.includes('update') ||
      message.includes('upgrade') ||
      message.includes('modify') ||
      message.includes('change') ||
      commit.type === 'refactor'
    ) {
      return 'Update';
    }

    if (message.includes('improve') || message.includes('enhance') || message.includes('better')) {
      return 'Improve';
    }

    if (
      message.includes('add') ||
      message.includes('new') ||
      message.includes('create') ||
      message.includes('implement') ||
      commit.type === 'feat'
    ) {
      return 'Add';
    }

    // Default to 'Update' for generic changes
    return 'Update';
  }

  /**
   * Improve description readability with specific transformations
   */
  private improveDescriptionReadability(description: string): string {
    let improved = description;

    // Handle common patterns
    improved = improved.replace(/^the\s+/i, '');
    improved = improved.replace(/\s+system$/, ' system');
    improved = improved.replace(/\s+functionality$/, ' functionality');
    improved = improved.replace(/\s+feature$/, ' feature');

    // Handle specific technical terms
    improved = improved.replace(/auth\b/gi, 'authentication');
    improved = improved.replace(/config\b/gi, 'configuration');
    improved = improved.replace(/perf\b/gi, 'performance');
    improved = improved.replace(/\bui\b/gi, 'UI');
    improved = improved.replace(/\bapi\b/gi, 'API');

    // Clean up extra spaces
    improved = improved.replace(/\s+/g, ' ').trim();

    return improved;
  }

  /**
   * Get conventional commit type based on the commit's category or content
   */
  /**
   * Determine commit range for analysis
   */
  private determineCommitRange(
    options: GenerateOptions,
    tags: Tag[]
  ): { from?: string; to: string } {
    if (options.from && options.to) {
      return { from: options.from, to: options.to };
    }

    if (options.from) {
      return { from: options.from, to: 'HEAD' };
    }

    if (options.to) {
      const latestTag = this.tagManager.getLatestReleaseTag(tags);
      return {
        ...(latestTag?.name && { from: latestTag.name }),
        to: options.to,
      };
    }

    // Default: from latest tag to HEAD
    const latestTag = this.tagManager.getLatestReleaseTag(tags);
    return {
      ...(latestTag?.name && { from: latestTag.name }),
      to: 'HEAD',
    };
  }

  /**
   * Format commits for LLM processing
   */
  /**
   * Parse repository information from remote URL
   */
  private parseRepositoryInfo(remoteUrl: string): RepositoryInfo {
    // Basic GitHub/GitLab URL parsing
    const githubMatch = remoteUrl.match(/github\.com[:/]([^/]+)\/([^/]+?)(?:\.git)?$/);
    const gitlabMatch = remoteUrl.match(/gitlab\.com[:/]([^/]+)\/([^/]+?)(?:\.git)?$/);

    if (githubMatch?.[1] && githubMatch?.[2]) {
      return {
        owner: githubMatch[1],
        name: githubMatch[2],
        url: `https://github.com/${githubMatch[1]}/${githubMatch[2]}`,
      };
    }

    if (gitlabMatch?.[1] && gitlabMatch?.[2]) {
      return {
        owner: gitlabMatch[1],
        name: gitlabMatch[2],
        url: `https://gitlab.com/${gitlabMatch[1]}/${gitlabMatch[2]}`,
      };
    }

    // Fallback for unknown providers
    return {
      owner: 'unknown',
      name: path.basename(this.cwd),
      url: remoteUrl,
    };
  }

  /**
   * Get existing changelog content
   */
  private getExistingChangelog(): string | undefined {
    const changelogPath = this.getChangelogPath();

    if (existsSync(changelogPath)) {
      try {
        return readFileSync(changelogPath, 'utf8');
      } catch (error) {
        logger.warn(`Failed to read existing changelog: ${error}`);
      }
    }

    return undefined;
  }

  /**
   * Get existing versions from changelog
   */
  private getExistingVersions(): Set<string> {
    const existing = this.getExistingChangelog();
    return this.changelogParser.extractVersions(existing ?? '');
  }

  /**
   * Write changelog to file
   */
  private async writeChangelog(content: string): Promise<void> {
    await this.changelogGenerator.writeChangelog(content, this.cwd);
  }

  /**
   * Get changelog file path
   */
  private getChangelogPath(): string {
    const filename = this.config.changelog?.filename ?? 'CHANGELOG.md';
    return path.join(this.cwd, filename);
  }

  /**
   * Test all services connectivity
   */
  async testServices(): Promise<{ git: boolean; llm: boolean }> {
    const results = {
      git: false,
      llm: false,
    };

    try {
      this.gitService.getCurrentBranch();
      results.git = true;
    } catch {
      // Git service failed
    }

    try {
      results.llm = await this.llmService.testConnection();
    } catch {
      // LLM service failed
    }

    return results;
  }
}

export default MagicRelease;
