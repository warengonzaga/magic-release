/**
 * Commit Parser - Parse and categorize commit messages
 * Supports conventional commit format and semantic analysis
 */

import type { Commit, ChangeType, GitCommit } from '../../types/index.js';
import { logger } from '../../utils/logger.js';

export interface CommitParseResult {
  type?: string;
  scope?: string;
  description: string;
  body?: string;
  breaking: boolean;
  issues: string[];
  prNumber?: number;
  category: ChangeType;
}

/**
 * CommitParser - Parses and categorizes Git commit messages
 *
 * This class handles parsing of conventional commit format and semantic analysis
 * of commit messages to categorize them into changelog sections following
 * the Keep a Changelog standard.
 *
 * @example
 * ```typescript
 * const parser = new CommitParser();
 * const result = parser.parseCommit(gitCommit);
 * console.log(result.category); // 'Added', 'Fixed', etc.
 * ```
 */
export class CommitParser {
  /** Regular expression to parse conventional commit format */
  private conventionalCommitRegex =
    /^(?<type>\w+)(?:\((?<scope>[\w\-\.\/]+)\))?\!?:\s+(?<description>.+)/;

  /** Regular expression to detect breaking changes */
  private breakingChangeRegex = /BREAKING CHANGE[S]?:|!:/;

  /** Regular expression to extract issue numbers */
  private issueRegex = /#(\d+)/g;

  /** Regular expression to extract pull request numbers */
  private prRegex = /\(#(\d+)\)|\s#(\d+)|PR\s#(\d+)|Pull Request\s#(\d+)/gi;

  /**
   * Parse a single commit into structured information
   *
   * Analyzes a Git commit and extracts structured information including
   * conventional commit type, scope, breaking changes, and associated
   * issues or pull requests.
   *
   * @param commit - The Git commit to parse
   * @returns Parsed commit information with categorization
   */
  public parseCommit(commit: GitCommit): CommitParseResult {
    const result: CommitParseResult = {
      description: commit.subject,
      body: commit.body,
      breaking: false,
      issues: [],
      category: this.determineCategory(commit.subject),
    };

    // Try to parse conventional commit format
    const conventionalMatch = this.conventionalCommitRegex.exec(commit.subject);

    if (conventionalMatch?.groups) {
      const type = conventionalMatch.groups['type'];
      const scope = conventionalMatch.groups['scope'];
      const description = conventionalMatch.groups['description'];

      if (type) {
        result.type = type;
        result.category = this.mapTypeToCategory(type);
      }
      if (scope) {
        result.scope = scope;
      }
      if (description) {
        result.description = description;
      }
    }

    // Check for breaking changes
    result.breaking = this.hasBreakingChange(commit);

    // Extract issue numbers
    result.issues = this.extractIssueNumbers(`${commit.subject} ${commit.body}`);

    // Extract PR number
    const prNumber = this.extractPRNumber(`${commit.subject} ${commit.body}`);
    if (prNumber !== undefined) {
      result.prNumber = prNumber;
    }

    logger.debug(`Parsed commit ${commit.hash.substring(0, 7)}: ${result.category}`, result);

    return result;
  }

  /**
   * Parse multiple commits and group them by category
   *
   * Processes an array of Git commits and organizes them into
   * changelog categories (Added, Fixed, Changed, etc.) based on
   * conventional commit types and semantic analysis.
   *
   * @param commits - Array of Git commits to parse and categorize
   * @returns Map of changelog categories to grouped commits
   */
  public parseCommits(commits: GitCommit[]): Map<ChangeType, Commit[]> {
    const categorizedCommits = new Map<ChangeType, Commit[]>();

    for (const gitCommit of commits) {
      const parsed = this.parseCommit(gitCommit);

      const commit: Commit = {
        hash: gitCommit.hash,
        message: gitCommit.subject,
        body: gitCommit.body,
        author: gitCommit.author.name,
        date: gitCommit.author.date,
        breaking: parsed.breaking,
        issues: parsed.issues,
      };

      // Add optional properties only if they exist
      if (parsed.type) {
        commit.type = parsed.type;
      }
      if (parsed.scope) {
        commit.scope = parsed.scope;
      }
      if (parsed.prNumber) {
        commit.pr = parsed.prNumber;
      }

      if (!categorizedCommits.has(parsed.category)) {
        categorizedCommits.set(parsed.category, []);
      }

      const categoryCommits = categorizedCommits.get(parsed.category);
      if (categoryCommits) {
        categoryCommits.push(commit);
      }
    }

    return categorizedCommits;
  }

  /**
   * Map conventional commit types to changelog categories
   *
   * Converts conventional commit types (feat, fix, etc.) to Keep a Changelog
   * categories (Added, Fixed, Changed, etc.) based on semantic meaning.
   *
   * @param type - The conventional commit type (e.g., 'feat', 'fix')
   * @returns The corresponding changelog category
   */
  private mapTypeToCategory(type: string): ChangeType {
    const typeMap: Record<string, ChangeType> = {
      feat: 'Added',
      feature: 'Added',
      add: 'Added',
      fix: 'Fixed',
      bugfix: 'Fixed',
      hotfix: 'Fixed',
      patch: 'Fixed',
      refactor: 'Changed',
      change: 'Changed',
      update: 'Changed',
      improve: 'Changed',
      enhancement: 'Changed',
      perf: 'Changed',
      performance: 'Changed',
      style: 'Changed',
      docs: 'Changed',
      doc: 'Changed',
      documentation: 'Changed',
      remove: 'Removed',
      delete: 'Removed',
      deprecate: 'Deprecated',
      security: 'Security',
      sec: 'Security',
    };

    return typeMap[type.toLowerCase()] ?? 'Changed';
  }

  /**
   * Determine category based on commit message content (fallback)
   *
   * When conventional commit format is not used, this method analyzes
   * the commit message content to determine the appropriate changelog
   * category based on keywords and semantic analysis.
   *
   * @param message - The commit message to analyze
   * @returns The determined changelog category
   */
  private determineCategory(message: string): ChangeType {
    const lowerMessage = message.toLowerCase();

    // Security-related keywords
    if (
      this.containsKeywords(lowerMessage, [
        'security',
        'vulnerability',
        'cve',
        'exploit',
        'xss',
        'csrf',
        'injection',
      ])
    ) {
      return 'Security';
    }

    // Addition keywords
    if (
      this.containsKeywords(lowerMessage, [
        'add',
        'new',
        'create',
        'implement',
        'introduce',
        'feature',
      ])
    ) {
      return 'Added';
    }

    // Fix keywords
    if (
      this.containsKeywords(lowerMessage, [
        'fix',
        'bug',
        'issue',
        'error',
        'problem',
        'resolve',
        'correct',
      ])
    ) {
      return 'Fixed';
    }

    // Removal keywords
    if (this.containsKeywords(lowerMessage, ['remove', 'delete', 'drop', 'eliminate'])) {
      return 'Removed';
    }

    // Deprecation keywords
    if (this.containsKeywords(lowerMessage, ['deprecate', 'obsolete'])) {
      return 'Deprecated';
    }

    // Default to Changed
    return 'Changed';
  }

  /**
   * Check if message contains any of the keywords
   */
  private containsKeywords(message: string, keywords: string[]): boolean {
    return keywords.some(keyword => message.includes(keyword));
  }

  /**
   * Check if commit has breaking changes
   */
  private hasBreakingChange(commit: GitCommit): boolean {
    const fullMessage = `${commit.subject}\n${commit.body}`;
    return this.breakingChangeRegex.test(fullMessage);
  }

  /**
   * Extract issue numbers from commit message
   */
  private extractIssueNumbers(message: string): string[] {
    const issues: string[] = [];
    let match;

    this.issueRegex.lastIndex = 0; // Reset regex
    while ((match = this.issueRegex.exec(message)) !== null) {
      if (match[1]) {
        issues.push(match[1]);
      }
    }

    return [...new Set(issues)]; // Remove duplicates
  }

  /**
   * Extract PR number from commit message
   */
  private extractPRNumber(message: string): number | undefined {
    this.prRegex.lastIndex = 0; // Reset regex
    const match = this.prRegex.exec(message);

    if (match) {
      // Find the first non-undefined capture group
      const prNumber = match[1] ?? match[2] ?? match[3] ?? match[4];
      return prNumber ? parseInt(prNumber, 10) : undefined;
    }

    return undefined;
  }

  /**
   * Generate a summary of parsed commits
   */
  public generateSummary(commits: GitCommit[]): string {
    const parsed = this.parseCommits(commits);
    const summary: string[] = [];

    for (const [category, categoryCommits] of parsed) {
      summary.push(`${category}: ${categoryCommits.length} commit(s)`);
    }

    return summary.join(', ');
  }
}

export default CommitParser;
