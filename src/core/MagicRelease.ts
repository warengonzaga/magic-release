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
  GitCommit,
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

/**
 * Conversion scenario types for intelligent unreleased conversion
 */
interface ConversionScenario {
  type:
    | 'convert-unreleased'
    | 'use-tag-version'
    | 'dual-conversion'
    | 'new-unreleased'
    | 'no-conversion';
  targetVersion?: string;
  tagDate?: Date;
  preserveExistingUnreleased?: boolean;
  needsNewUnreleased?: boolean;
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

  /** Current conversion scenario being processed */
  private currentScenario?: ConversionScenario;

  /** Cache for AI-processed commit descriptions to avoid re-processing */
  private descriptionCache: Map<string, string> = new Map();

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
        await this.safeWriteChangelog(changelogContent);
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

    // Check if we can use changelog-based analysis
    const existingChangelog = this.getExistingChangelog();
    if (existingChangelog) {
      const parser = new (await import('./generator/ChangelogParser.js')).default();
      const isMagicrGenerated = parser.isMagicrGenerated(existingChangelog);

      if (isMagicrGenerated) {
        logger.info('Detected magicr-generated changelog, using efficient analysis');
        return this.analyzeFromChangelog(options);
      } else {
        logger.info('Existing changelog found but not magicr-generated, using full analysis');
      }
    }

    // Fallback to full git-based analysis
    return this.analyzeRepositoryFull(options);
  }

  /**
   * Full repository analysis (original method)
   */
  private async analyzeRepositoryFull(options: GenerateOptions): Promise<RepositoryAnalysis> {
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
        categorizedCommits: new Map(),
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
      categorizedCommits,
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
   * Analyze repository using changelog-based approach when available
   */
  private async analyzeFromChangelog(options: GenerateOptions): Promise<RepositoryAnalysis> {
    logger.info('Using changelog-based analysis for efficient processing');

    // Get existing changelog
    const existingChangelog = this.getExistingChangelog();
    if (!existingChangelog) {
      throw new Error('Changelog-based analysis requires existing changelog');
    }

    // Parse changelog for latest version and documented commits
    const parser = new (await import('./generator/ChangelogParser.js')).default();
    const latestVersionInChangelog = parser.getLatestVersionFromChangelog(existingChangelog);
    const documentedCommits = parser.getDocumentedCommits(existingChangelog);

    logger.debug('Changelog analysis', {
      latestVersion: latestVersionInChangelog,
      documentedCommitsCount: documentedCommits.size,
    });

    // Validate changelog integrity
    this.validateChangelogIntegrity(existingChangelog, documentedCommits);

    // Get repository information (cached)
    const remoteUrl = this.gitService.getRemoteUrl();
    const repository = this.parseRepositoryInfo(remoteUrl ?? '');

    // Get tags (optimize by only getting what we need)
    const gitTags = this.gitService.getAllTags();
    const tags = this.tagManager.getVersionTags(gitTags);

    // Optimize git scanning range
    const startingPoint = latestVersionInChangelog ?? options.from ?? null;
    const endPoint = options.to ?? 'HEAD';

    if (!startingPoint) {
      logger.warn('No starting point found for incremental scanning, falling back to full scan');
    } else {
      logger.info(`Optimized scanning: ${startingPoint}..${endPoint}`);
    }

    // Get only new commits (since latest changelog version) - optimized
    const gitCommits = this.gitService.getCommitsBetween(startingPoint ?? undefined, endPoint);

    // Enhanced commit deduplication (hash-based, performance optimized)
    const newGitCommits = this.deduplicateCommits(gitCommits, documentedCommits);

    logger.info(
      `Performance: Scanned ${gitCommits.length} commits, ${newGitCommits.length} new (${Math.round((1 - newGitCommits.length / Math.max(gitCommits.length, 1)) * 100)}% reduction)`
    );

    // Parse only new commits (with caching for repeated categorization)
    let categorizedCommits = this.commitParser.parseCommits(newGitCommits);

    // Optimize AI processing by filtering already documented commits
    categorizedCommits = await this.optimizeAIProcessing(categorizedCommits, documentedCommits);

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
      categorizedCommits,
      newVersions: [],
      existingVersions,
    };

    logger.info('Changelog-based analysis complete', {
      tagsCount: tags.length,
      newCommitsCount: commits.length,
      skippedDocumentedCommits: gitCommits.length - newGitCommits.length,
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

    // If we have a current scenario, use scenario-based processing
    if (this.currentScenario) {
      logger.debug('Using scenario-based changelog generation', {
        scenario: this.currentScenario.type,
      });

      // Read existing changelog for scenario-based processing
      const changelogPath = path.join(this.cwd, 'CHANGELOG.md');
      let existingChangelog: string | undefined;

      if (existsSync(changelogPath)) {
        existingChangelog = readFileSync(changelogPath, 'utf-8');
      }

      // Process entries with scenario-specific logic
      const processedEntries = await this.changelogGenerator.processEntriesWithScenario(
        entries,
        existingChangelog,
        this.currentScenario.type,
        this.cwd
      );

      // Generate final changelog using processed entries
      return this.changelogGenerator.generate(processedEntries, this.cwd);
    }

    // Fallback to standard generation
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

    // Enhanced logic to handle both release conversion and new unreleased commits
    const changelogEntries = await this.determineChangelogEntries(analysis);

    for (const entryInfo of changelogEntries) {
      const changelogEntry: ChangelogEntry = {
        version: entryInfo.version,
        ...(entryInfo.date && { date: entryInfo.date }),
        sections: new Map(),
      };

      // Use the categorized commits from the analysis
      const categorizedCommits = entryInfo.commits;

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

        // Pre-process all commits in this category with batch optimization
        await this.batchProcessDescriptions(sortedCategoryCommits);

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
            changelogEntry.sections.set(category, changes);
          }
        }
      }

      entries.push(changelogEntry);
    }

    return entries;
  }

  /**
   * Determine what changelog entries to create based on repository state
   */
  /**
   * Enhanced determination of changelog entries with improved conversion detection
   * Handles edge cases and provides better logic for when to convert unreleased to version
   */
  private async determineChangelogEntries(analysis: RepositoryAnalysis): Promise<
    Array<{
      version: string;
      date?: Date;
      commits: Map<ChangeType, Commit[]>;
    }>
  > {
    const { tags, categorizedCommits } = analysis;
    const existingChangelog = this.getExistingChangelog();
    const hasExistingUnreleased = existingChangelog?.includes('## [Unreleased]') ?? false;

    // Get latest tag information with enhanced validation
    const latestTag = tags.length > 0 ? this.tagManager.getLatestTag(tags) : null;

    if (!latestTag) {
      // No tags exist, everything goes to Unreleased
      logger.debug('No tags found, creating Unreleased entry');
      return [
        {
          version: 'Unreleased',
          date: new Date(),
          commits: categorizedCommits,
        },
      ];
    }

    try {
      const headCommit = this.gitService.getCommitHash('HEAD');
      const tagCommit = latestTag.hash;

      // Enhanced conversion detection logic
      const conversionScenario = this.detectConversionScenario(
        headCommit,
        tagCommit,
        hasExistingUnreleased,
        latestTag,
        categorizedCommits
      );

      return this.executeConversionScenario(conversionScenario, latestTag, categorizedCommits);
    } catch (error) {
      logger.warn('Could not compare tag and HEAD commits, defaulting to Unreleased', error);
      return [
        {
          version: 'Unreleased',
          date: new Date(),
          commits: categorizedCommits,
        },
      ];
    }
  }

  /**
   * Generate user-friendly change description from commit
   * Uses LLM to rephrase commit messages into clear, present imperative tense
   */
  private async generateChangeDescription(commit: Commit): Promise<string> {
    // Check cache first
    const cacheKey = commit.hash;
    if (this.descriptionCache.has(cacheKey)) {
      logger.debug(`Cache hit for commit ${commit.hash}`);
      return this.descriptionCache.get(cacheKey) ?? '';
    }

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

        // Store in cache
        this.descriptionCache.set(cacheKey, cleaned);

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

    // Store fallback result in cache too
    this.descriptionCache.set(cacheKey, description);

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

  /**
   * Determine the target version for commits based on repository analysis
   *
   * This method analyzes the relationship between commits, tags, and HEAD to determine
   * whether commits should be marked as "Unreleased" or associated with a specific version.
   *
   * Logic:
   * - If there's a tag at HEAD that contains all the commits, use that tag's version
   * - If commits are after the latest tag, mark as "Unreleased"
   * - If no tags exist, mark as "Unreleased"
   *
   * TODO: Add CLI flags to control date behavior for changelog generation
   * Features to implement:
   * - `--use-commit-date`: Use the commit date instead of tag creation date
   * - `--use-tag-date`: Use the tag creation date (current default behavior)
   * - `--date-source=<commit|tag|custom>`: Allow users to specify date source
   * - `--custom-date=<YYYY-MM-DD>`: Allow manual date override
   */
  /**
   * Enhanced commit deduplication with performance optimization
   * Uses hash-based comparison for accuracy and efficiency
   */
  private deduplicateCommits(gitCommits: GitCommit[], documentedCommits: Set<string>): GitCommit[] {
    const startTime = Date.now();

    // Create lookup set for O(1) performance
    const documentedHashLookup = new Set<string>();

    // Add both short and full hashes to lookup set
    for (const hash of documentedCommits) {
      documentedHashLookup.add(hash);
      // Also add full hash if this is a short hash
      if (hash.length === 7) {
        // Find matching full hash in git commits
        const fullHash = gitCommits.find(commit => commit.hash.startsWith(hash))?.hash;
        if (fullHash) {
          documentedHashLookup.add(fullHash);
        }
      }
      // Also add short hash if this is a full hash
      if (hash.length > 7) {
        documentedHashLookup.add(hash.substring(0, 7));
      }
    }

    // Filter with optimized lookup
    const newCommits = gitCommits.filter(commit => {
      const shortHash = commit.hash.substring(0, 7);
      const isDocumented =
        documentedHashLookup.has(commit.hash) || documentedHashLookup.has(shortHash);
      return !isDocumented;
    });

    const elapsed = Date.now() - startTime;
    logger.debug(
      `Deduplication completed in ${elapsed}ms: ${gitCommits.length} → ${newCommits.length} commits`
    );

    return newCommits;
  }

  /**
   * Validate changelog integrity to detect corruption
   * Checks for structural issues and potential manual edits that could break processing
   */
  private validateChangelogIntegrity(changelog: string, documentedCommits: Set<string>): void {
    logger.debug('Validating changelog integrity');

    // Check for magicr indicator presence
    if (!changelog.includes('Generated by Magic Release (magicr)')) {
      logger.warn('Changelog missing magicr indicator - may have been manually modified');
    }

    // Check for malformed version headers
    const versionHeaders = changelog.match(/^##\s*\[([^\]]*)\]/gm);
    if (!versionHeaders || versionHeaders.length === 0) {
      throw new Error('Changelog appears corrupted: No valid version headers found');
    }

    // Check for orphaned commit references (references to commits not in git)
    const referencedHashes = Array.from(documentedCommits);
    const invalidHashes = referencedHashes.filter(hash => {
      // Basic validation - should be hex string of appropriate length
      return !/^[a-f0-9]{7,40}$/i.test(hash);
    });

    if (invalidHashes.length > 0) {
      logger.warn(
        `Found ${invalidHashes.length} invalid commit hash references in changelog:`,
        invalidHashes
      );
    }

    // Check for duplicate version sections
    const versions = new Set<string>();
    const duplicates: string[] = [];

    versionHeaders.forEach(header => {
      const match = header.match(/\[([^\]]+)\]/);
      if (match?.[1]) {
        const version = match[1];
        if (versions.has(version)) {
          duplicates.push(version);
        } else {
          versions.add(version);
        }
      }
    });

    if (duplicates.length > 0) {
      throw new Error(
        `Changelog corrupted: Duplicate version sections found: ${duplicates.join(', ')}`
      );
    }

    logger.debug('Changelog integrity validation passed');
  }

  /**
   * Enhanced conversion scenario detection with better edge case handling
   */
  private detectConversionScenario(
    headCommit: string,
    tagCommit: string,
    hasExistingUnreleased: boolean,
    latestTag: Tag,
    categorizedCommits: Map<ChangeType, Commit[]>
  ): ConversionScenario {
    const isTagAtHead = headCommit === tagCommit;
    const hasNewCommits = Array.from(categorizedCommits.values()).some(
      commits => commits.length > 0
    );

    logger.debug('Conversion detection', {
      tagAtHead: isTagAtHead,
      hasUnreleased: hasExistingUnreleased,
      hasNewCommits,
      tagVersion: latestTag.version,
    });

    // Scenario 1: Tag at HEAD + existing unreleased → Convert unreleased to version
    if (isTagAtHead && hasExistingUnreleased) {
      logger.info(
        `Tag ${latestTag.version} at HEAD with existing unreleased - converting to version`
      );
      return {
        type: 'convert-unreleased',
        targetVersion: latestTag.version,
        tagDate: latestTag.date,
        preserveExistingUnreleased: true,
      };
    }

    // Scenario 2: Tag at HEAD + new commits → Use tag version for commits
    if (isTagAtHead && hasNewCommits) {
      logger.info(`Tag ${latestTag.version} at HEAD with new commits - using tag version`);
      return {
        type: 'use-tag-version',
        targetVersion: latestTag.version,
        tagDate: latestTag.date,
      };
    }

    // Scenario 3: Tag behind HEAD + existing unreleased → Convert + add new unreleased
    if (!isTagAtHead && hasExistingUnreleased) {
      logger.info(
        `Tag ${latestTag.version} behind HEAD with existing unreleased - dual conversion`
      );
      return {
        type: 'dual-conversion',
        targetVersion: latestTag.version,
        tagDate: latestTag.date,
        needsNewUnreleased: true,
      };
    }

    // Scenario 4: Tag behind HEAD + new commits → New unreleased only
    if (!isTagAtHead && hasNewCommits) {
      logger.info(`Tag ${latestTag.version} behind HEAD with new commits - new unreleased`);
      return {
        type: 'new-unreleased',
      };
    }

    // Scenario 5: No new commits → Maintain current state
    logger.debug('No conversion needed - maintaining current state');
    return {
      type: 'no-conversion',
    };
  }

  /**
   * Execute the determined conversion scenario with preserved structure
   */
  private async executeConversionScenario(
    scenario: ConversionScenario,
    latestTag: Tag,
    categorizedCommits: Map<ChangeType, Commit[]>
  ): Promise<Array<{ version: string; date?: Date; commits: Map<ChangeType, Commit[]> }>> {
    // Store the current scenario for use in generation
    this.currentScenario = scenario;

    switch (scenario.type) {
      case 'convert-unreleased':
        return [
          {
            version: scenario.targetVersion ?? latestTag.version,
            date: scenario.tagDate ?? new Date(),
            commits: new Map(), // Conversion handled by KeepChangelogGenerator
          },
        ];

      case 'use-tag-version':
        return [
          {
            version: scenario.targetVersion ?? latestTag.version,
            date: scenario.tagDate ?? new Date(),
            commits: categorizedCommits,
          },
        ];

      case 'dual-conversion':
        // Get commits since the tag for new unreleased section
        const commitsRange = this.gitService.getCommitsBetween(latestTag.name, 'HEAD');
        const newCategorizedCommits = this.commitParser.parseCommits(commitsRange);

        logger.debug(
          `Dual conversion: ${scenario.targetVersion} + ${commitsRange.length} new commits to unreleased`
        );

        return [
          {
            version: scenario.targetVersion ?? latestTag.version,
            date: scenario.tagDate ?? new Date(),
            commits: new Map(), // Existing unreleased converted by generator
          },
          {
            version: 'Unreleased',
            date: new Date(),
            commits: newCategorizedCommits,
          },
        ];

      case 'new-unreleased':
        return [
          {
            version: 'Unreleased',
            date: new Date(),
            commits: categorizedCommits,
          },
        ];

      case 'no-conversion':
      default:
        // Return empty to maintain current changelog state
        return [];
    }
  }

  /**
   * Optimize AI processing by batch processing commits and skipping documented ones
   */
  private async optimizeAIProcessing(
    categorizedCommits: Map<ChangeType, Commit[]>,
    documentedCommits?: Set<string>
  ): Promise<Map<ChangeType, Commit[]>> {
    if (!documentedCommits || documentedCommits.size === 0) {
      return categorizedCommits;
    }

    logger.info('Optimizing AI processing - filtering already documented commits');

    const optimizedMap = new Map<ChangeType, Commit[]>();
    let filteredCount = 0;
    let totalCount = 0;

    for (const [category, commits] of categorizedCommits) {
      const undocumentedCommits = commits.filter(commit => {
        totalCount++;
        const isDocumented =
          documentedCommits.has(commit.hash) || documentedCommits.has(commit.hash.substring(0, 7));

        if (isDocumented) {
          filteredCount++;
          return false;
        }
        return true;
      });

      if (undocumentedCommits.length > 0) {
        optimizedMap.set(category, undocumentedCommits);
      }
    }

    const reductionPercentage = Math.round((filteredCount / Math.max(totalCount, 1)) * 100);
    logger.info(
      `AI Processing optimization: ${filteredCount}/${totalCount} commits skipped (${reductionPercentage}% reduction)`
    );

    return optimizedMap;
  }

  /**
   * Batch process commits for AI description generation to improve performance
   */
  private async batchProcessDescriptions(commits: Commit[]): Promise<void> {
    const batchSize = 10; // Process in batches to avoid overwhelming the AI service
    const totalBatches = Math.ceil(commits.length / batchSize);

    logger.debug(`Processing ${commits.length} commits in ${totalBatches} batches of ${batchSize}`);

    for (let i = 0; i < totalBatches; i++) {
      const start = i * batchSize;
      const end = Math.min(start + batchSize, commits.length);
      const batch = commits.slice(start, end);

      logger.debug(`Processing batch ${i + 1}/${totalBatches} (${batch.length} commits)`);

      // Process batch concurrently but with controlled concurrency
      const batchPromises = batch.map(commit => this.generateChangeDescription(commit));
      await Promise.all(batchPromises);

      // Small delay between batches to be respectful to AI service rate limits
      if (i < totalBatches - 1) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
  }

  /**
   * Create backup of existing changelog before modifications
   * Returns the backup file path for potential rollback
   */
  private async createChangelogBackup(): Promise<string | null> {
    const changelogPath = this.getChangelogPath();

    if (!existsSync(changelogPath)) {
      logger.debug('No existing changelog to backup');
      return null;
    }

    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupFileName = `CHANGELOG.backup.${timestamp}.md`;
      const backupPath = path.join(this.cwd, backupFileName);

      const originalContent = readFileSync(changelogPath, 'utf-8');
      const fs = await import('fs/promises');
      await fs.writeFile(backupPath, originalContent, 'utf-8');

      logger.info(`Changelog backup created: ${backupFileName}`);

      return backupPath;
    } catch (error) {
      logger.warn('Failed to create changelog backup', error);
      return null;
    }
  }

  /**
   * Restore changelog from backup file
   */
  private async restoreFromBackup(backupPath: string): Promise<boolean> {
    try {
      const changelogPath = this.getChangelogPath();
      const fs = await import('fs/promises');

      const backupContent = await fs.readFile(backupPath, 'utf-8');
      await fs.writeFile(changelogPath, backupContent, 'utf-8');

      logger.info(`Changelog restored from backup: ${path.basename(backupPath)}`);
      return true;
    } catch (error) {
      logger.error('Failed to restore changelog from backup', error);
      return false;
    }
  }

  /**
   * Clean up old backup files to prevent accumulation
   */
  private async cleanupOldBackups(maxAge: number = 7): Promise<void> {
    try {
      const fs = await import('fs/promises');
      const files = await fs.readdir(this.cwd);
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - maxAge);

      const backupFiles = files.filter(file =>
        file.match(/^CHANGELOG\.backup\.\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z\.md$/)
      );

      let cleanedCount = 0;
      for (const file of backupFiles) {
        const filePath = path.join(this.cwd, file);
        const stats = await fs.stat(filePath);

        if (stats.mtime < cutoffDate) {
          await fs.unlink(filePath);
          cleanedCount++;
          logger.debug(`Cleaned up old backup: ${file}`);
        }
      }

      if (cleanedCount > 0) {
        logger.info(`Cleaned up ${cleanedCount} old backup files`);
      }
    } catch (error) {
      logger.debug('Backup cleanup failed', error);
    }
  }

  /**
   * Safe changelog write with automatic backup and rollback
   */
  private async safeWriteChangelog(content: string): Promise<void> {
    const backupPath = await this.createChangelogBackup();

    try {
      await this.writeChangelog(content);

      // Clean up old backups after successful write
      await this.cleanupOldBackups();

      logger.debug('Changelog written successfully with backup protection');
    } catch (error) {
      logger.error('Failed to write changelog, attempting rollback', error);

      if (backupPath) {
        const rollbackSuccess = await this.restoreFromBackup(backupPath);
        if (rollbackSuccess) {
          logger.info('Changelog successfully rolled back to previous state');
        } else {
          logger.error('Rollback failed - manual intervention may be required');
        }
      }

      throw error;
    }
  }

  // ...existing code...
}

export default MagicRelease;
