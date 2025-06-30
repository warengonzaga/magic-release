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
  CLIFlags,
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

    // Categorize commits using LLM
    for (const commit of analysis.commits) {
      try {
        const category = (await this.llmService.categorizeCommit(commit.message)) as ChangeType;

        if (!unreleasedEntry.sections.has(category)) {
          unreleasedEntry.sections.set(category, []);
        }

        const changes = unreleasedEntry.sections.get(category);
        if (changes) {
          changes.push({
            description: this.generateChangeDescription(commit),
            commits: [commit],
            ...(commit.scope && { scope: commit.scope }),
            ...(commit.pr && { pr: commit.pr }),
            ...(commit.issues && commit.issues.length > 0 && { issues: commit.issues }),
          });
        }
      } catch (error) {
        logger.warn(`Failed to categorize commit: ${commit.hash}`, error);
        // Default to 'Changed' category
        if (!unreleasedEntry.sections.has('Changed')) {
          unreleasedEntry.sections.set('Changed', []);
        }
        const changes = unreleasedEntry.sections.get('Changed');
        if (changes) {
          changes.push({
            description: this.generateChangeDescription(commit),
            commits: [commit],
          });
        }
      }
    }

    entries.push(unreleasedEntry);
    return entries;
  }

  /**
   * Generate user-friendly change description from commit
   */
  private generateChangeDescription(commit: Commit): string {
    // Clean up the commit message for user consumption
    let description = commit.message;

    // Remove conventional commit prefixes if present
    description = description.replace(
      /^(feat|fix|docs|style|refactor|test|chore|perf)(\(.+\))?:\s*/,
      ''
    );

    // Capitalize first letter
    description = description.charAt(0).toUpperCase() + description.slice(1);

    // Remove trailing periods
    description = description.replace(/\.$/, '');

    return description;
  }

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

  /**
   * Create Magic Release instance from CLI flags
   *
   * Factory method that creates a configured MagicRelease instance based on
   * command-line flags, setting appropriate logging levels and options.
   *
   * @param flags - CLI flags containing user preferences
   * @param config - Base configuration object
   * @returns Configured MagicRelease instance
   */
  static async fromCLIFlags(flags: CLIFlags, config: MagicReleaseConfig): Promise<MagicRelease> {
    const instance = new MagicRelease(config);

    if (flags.verbose) {
      logger.setLevel('debug');
    }

    return instance;
  }
}

export default MagicRelease;
