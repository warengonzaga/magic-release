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

export class CommitParser {
  private conventionalCommitRegex = /^(?<type>\w+)(?:\((?<scope>[\w\-\.\/]+)\))?\!?:\s+(?<description>.+)/;
  private breakingChangeRegex = /BREAKING CHANGE[S]?:|!:/;
  private issueRegex = /#(\d+)/g;
  private prRegex = /\(#(\d+)\)|\s#(\d+)|PR\s#(\d+)|Pull Request\s#(\d+)/gi;

  /**
   * Parse a single commit into structured information
   */
  public parseCommit(commit: GitCommit): CommitParseResult {
    const result: CommitParseResult = {
      description: commit.subject,
      body: commit.body,
      breaking: false,
      issues: [],
      category: this.determineCategory(commit.subject)
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
    result.issues = this.extractIssueNumbers(commit.subject + ' ' + commit.body);

    // Extract PR number
    const prNumber = this.extractPRNumber(commit.subject + ' ' + commit.body);
    if (prNumber !== undefined) {
      result.prNumber = prNumber;
    }

    logger.debug(`Parsed commit ${commit.hash.substring(0, 7)}: ${result.category}`, result);

    return result;
  }

  /**
   * Parse multiple commits and group them by category
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
        type: parsed.type,
        scope: parsed.scope,
        breaking: parsed.breaking,
        pr: parsed.prNumber,
        issues: parsed.issues
      };

      if (!categorizedCommits.has(parsed.category)) {
        categorizedCommits.set(parsed.category, []);
      }
      
      categorizedCommits.get(parsed.category)!.push(commit);
    }

    return categorizedCommits;
  }

  /**
   * Map conventional commit types to changelog categories
   */
  private mapTypeToCategory(type: string): ChangeType {
    const typeMap: Record<string, ChangeType> = {
      'feat': 'Added',
      'feature': 'Added',
      'add': 'Added',
      'fix': 'Fixed',
      'bugfix': 'Fixed',
      'hotfix': 'Fixed',
      'patch': 'Fixed',
      'refactor': 'Changed',
      'change': 'Changed',
      'update': 'Changed',
      'improve': 'Changed',
      'enhancement': 'Changed',
      'perf': 'Changed',
      'performance': 'Changed',
      'style': 'Changed',
      'docs': 'Changed',
      'doc': 'Changed',
      'documentation': 'Changed',
      'remove': 'Removed',
      'delete': 'Removed',
      'deprecate': 'Deprecated',
      'security': 'Security',
      'sec': 'Security'
    };

    return typeMap[type.toLowerCase()] || 'Changed';
  }

  /**
   * Determine category based on commit message content (fallback)
   */
  private determineCategory(message: string): ChangeType {
    const lowerMessage = message.toLowerCase();

    // Security-related keywords
    if (this.containsKeywords(lowerMessage, ['security', 'vulnerability', 'cve', 'exploit', 'xss', 'csrf', 'injection'])) {
      return 'Security';
    }

    // Addition keywords
    if (this.containsKeywords(lowerMessage, ['add', 'new', 'create', 'implement', 'introduce', 'feature'])) {
      return 'Added';
    }

    // Fix keywords
    if (this.containsKeywords(lowerMessage, ['fix', 'bug', 'issue', 'error', 'problem', 'resolve', 'correct'])) {
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
    const fullMessage = commit.subject + '\n' + commit.body;
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
      const prNumber = match[1] || match[2] || match[3] || match[4];
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
