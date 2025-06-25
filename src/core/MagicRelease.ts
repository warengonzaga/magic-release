/**
 * Magic Release - Main application class
 * Orchestrates all components for changelog generation
 */

import path from 'path';
import { existsSync, readFileSync, writeFileSync } from 'fs';

import GitService from './git/GitService.js';
import CommitParser from './git/CommitParser.js';
import TagManager from './git/TagManager.js';
import LLMService from './llm/LLMService.js';
import type { 
  MagicReleaseConfig, 
  RepositoryAnalysis,
  CLIFlags,
  Commit
} from '../types/index.js';
import { 
  ChangelogError 
} from '../utils/errors.js';
import { logger } from '../utils/logger.js';

export interface GenerateOptions {
  from?: string;
  to?: string;
  dryRun?: boolean;
  verbose?: boolean;
  includeUnreleased?: boolean;
}

export class MagicRelease {
  private config: MagicReleaseConfig;
  private gitService: GitService;
  private commitParser: CommitParser;
  private tagManager: TagManager;
  private llmService: LLMService;
  private cwd: string;

  constructor(config: MagicReleaseConfig, cwd: string = process.cwd()) {
    this.config = config;
    this.cwd = cwd;

    // Initialize services
    this.gitService = new GitService(cwd);
    this.commitParser = new CommitParser();
    this.tagManager = new TagManager(cwd);
    this.llmService = LLMService.fromConfig(config);

    logger.info('MagicRelease initialized', {
      cwd: this.cwd,
      provider: config.llm.provider,
      model: config.llm.model
    });
  }

  /**
   * Generate changelog based on options
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
   */
  private async analyzeRepository(options: GenerateOptions): Promise<RepositoryAnalysis> {
    logger.debug('Analyzing repository');

    // Get repository information
    const remoteUrl = this.gitService.getRemoteUrl();
    const repository = this.parseRepositoryInfo(remoteUrl || '');

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
      existingVersions
    };

    logger.debug('Repository analysis complete', {
      tagsCount: tags.length,
      commitsCount: commits.length,
      commitRange: `${from || 'beginning'}..${to}`
    });

    return analysis;
  }

  /**
   * Generate changelog content from analysis
   */
  private async generateChangelogContent(analysis: RepositoryAnalysis): Promise<string> {
    logger.debug('Generating changelog content');

    // Format commits for LLM
    const commitsText = this.formatCommitsForLLM(analysis.commits);
    
    // Get project context
    const projectContext = this.getProjectContext();
    
    // Get existing changelog for style consistency
    const existingChangelog = this.getExistingChangelog();

    // Generate using LLM
    const generatedContent = await this.llmService.generateChangelog(
      commitsText,
      projectContext,
      existingChangelog
    );

    // Merge with existing changelog if it exists
    const finalContent = this.mergeWithExistingChangelog(generatedContent, existingChangelog);

    return finalContent;
  }

  /**
   * Determine commit range for analysis
   */
  private determineCommitRange(
    options: GenerateOptions, 
    tags: any[]
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
        to: options.to 
      };
    }

    // Default: from latest tag to HEAD
    const latestTag = this.tagManager.getLatestReleaseTag(tags);
    return { 
      ...(latestTag?.name && { from: latestTag.name }), 
      to: 'HEAD' 
    };
  }

  /**
   * Format commits for LLM processing
   */
  private formatCommitsForLLM(commits: Commit[]): string {
    if (commits.length === 0) {
      return 'No commits found in the specified range.';
    }

    const formatted = commits.map(commit => {
      let line = `- ${commit.message}`;
      
      if (commit.hash) {
        line += ` (${commit.hash.substring(0, 7)})`;
      }
      
      if (commit.pr) {
        line += ` (#${commit.pr})`;
      }
      
      if (commit.issues && commit.issues.length > 0) {
        line += ` [${commit.issues.map(i => `#${i}`).join(', ')}]`;
      }
      
      return line;
    });

    return formatted.join('\n');
  }

  /**
   * Parse repository information from remote URL
   */
  private parseRepositoryInfo(remoteUrl: string): any {
    // Basic GitHub/GitLab URL parsing
    const githubMatch = remoteUrl.match(/github\.com[:/]([^/]+)\/([^/]+?)(?:\.git)?$/);
    const gitlabMatch = remoteUrl.match(/gitlab\.com[:/]([^/]+)\/([^/]+?)(?:\.git)?$/);
    
    if (githubMatch) {
      return {
        owner: githubMatch[1],
        name: githubMatch[2],
        url: `https://github.com/${githubMatch[1]}/${githubMatch[2]}`
      };
    }
    
    if (gitlabMatch) {
      return {
        owner: gitlabMatch[1],
        name: gitlabMatch[2],
        url: `https://gitlab.com/${gitlabMatch[1]}/${gitlabMatch[2]}`
      };
    }

    // Fallback for unknown providers
    return {
      owner: 'unknown',
      name: path.basename(this.cwd),
      url: remoteUrl
    };
  }

  /**
   * Get project context for better LLM understanding
   */
  private getProjectContext(): string {
    const contexts: string[] = [];

    // Check for package.json
    const packageJsonPath = path.join(this.cwd, 'package.json');
    if (existsSync(packageJsonPath)) {
      try {
        const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
        contexts.push(`Project: ${packageJson.name || 'Unknown'}`);
        if (packageJson.description) {
          contexts.push(`Description: ${packageJson.description}`);
        }
        if (packageJson.keywords) {
          contexts.push(`Keywords: ${packageJson.keywords.join(', ')}`);
        }
      } catch {
        // Ignore parsing errors
      }
    }

    // Check for README
    const readmePaths = ['README.md', 'README.txt', 'README'];
    for (const readmePath of readmePaths) {
      const fullPath = path.join(this.cwd, readmePath);
      if (existsSync(fullPath)) {
        try {
          const readme = readFileSync(fullPath, 'utf8');
          // Extract first paragraph
          const firstParagraph = readme.split('\n\n')[0]?.substring(0, 300);
          if (firstParagraph) {
            contexts.push(`Project Description: ${firstParagraph}`);
          }
        } catch {
          // Ignore reading errors
        }
        break;
      }
    }

    return contexts.join('\n');
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
    const versions = new Set<string>();

    if (existing) {
      // Extract version numbers from changelog
      const versionRegex = /##\s*\[?(\d+\.\d+\.\d+[^\]]*)\]?/g;
      let match;
      
      while ((match = versionRegex.exec(existing)) !== null) {
        if (match[1]) {
          versions.add(match[1]);
        }
      }
    }

    return versions;
  }

  /**
   * Merge new content with existing changelog
   */
  private mergeWithExistingChangelog(
    newContent: string, 
    existingContent?: string
  ): string {
    if (!existingContent) {
      return this.addChangelogHeader(newContent);
    }

    // Simple merge: add new content after the header
    const lines = existingContent.split('\n');
    const headerEndIndex = lines.findIndex((line, index) => 
      index > 0 && line.startsWith('## ')
    );

    if (headerEndIndex === -1) {
      // No existing entries, append to end
      return existingContent + '\n\n' + newContent;
    }

    // Insert new content before first existing entry
    const beforeHeader = lines.slice(0, headerEndIndex);
    const afterHeader = lines.slice(headerEndIndex);
    
    return [...beforeHeader, '', newContent, '', ...afterHeader].join('\n');
  }

  /**
   * Add standard changelog header
   */
  private addChangelogHeader(content: string): string {
    const header = `# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

`;

    return header + content;
  }

  /**
   * Write changelog to file
   */
  private async writeChangelog(content: string): Promise<void> {
    const changelogPath = this.getChangelogPath();
    
    try {
      writeFileSync(changelogPath, content, 'utf8');
    } catch (error) {
      throw new ChangelogError(`Failed to write changelog: ${error}`);
    }
  }

  /**
   * Get changelog file path
   */
  private getChangelogPath(): string {
    const filename = this.config.changelog?.filename || 'CHANGELOG.md';
    return path.join(this.cwd, filename);
  }

  /**
   * Test all services connectivity
   */
  async testServices(): Promise<{ git: boolean; llm: boolean }> {
    const results = {
      git: false,
      llm: false
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
