/**
 * GitService - Core Git operations handler
 *
 * This class provides a comprehensive interface for interacting with Git repositories,
 * handling operations like commit retrieval, tag management, and repository analysis.
 * It serves as the primary Git interface for Magic Release functionality.
 *
 * @example
 * ```typescript
 * const gitService = new GitService('/path/to/repo');
 * const commits = gitService.getCommitsBetween('v1.0.0', 'HEAD');
 * const tags = gitService.getTags();
 * ```
 */

import { execSync } from 'child_process';
import { existsSync } from 'fs';
import path from 'path';

import type { GitCommit, GitTag } from '../../types/index.js';
import { createGitError, GitError } from '../../utils/errors.js';
import { logger } from '../../utils/logger.js';

export class GitService {
  /** Working directory path for Git operations */
  private cwd: string;

  /**
   * Create a new GitService instance
   *
   * @param cwd - Working directory path (defaults to current working directory)
   * @throws {GitError} If the directory is not a valid Git repository
   */
  constructor(cwd: string = process.cwd()) {
    this.cwd = cwd;
    this.validateGitRepository();
  }

  /**
   * Validate that we're in a Git repository
   *
   * @throws {GitError} If the current directory is not a Git repository
   */
  private validateGitRepository(): void {
    const gitDir = path.join(this.cwd, '.git');
    if (!existsSync(gitDir)) {
      throw createGitError('Not a Git repository');
    }
  }

  /**
   * Execute Git command safely
   *
   * @param command - Git command to execute (without 'git' prefix)
   * @returns Command output as trimmed string
   * @throws {GitError} If the Git command fails
   */
  private execGit(command: string): string {
    try {
      const fullCommand = `git ${command}`;
      logger.debug(`Executing: ${fullCommand}`);

      const result = execSync(fullCommand, {
        cwd: this.cwd,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      return result.trim();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      logger.error(`Git command failed: git ${command}`, error);
      throw createGitError(`Git command failed: ${errorMessage}`);
    }
  }

  /**
   * Get all commits between two references (tags, commits, HEAD)
   *
   * Retrieves Git commits in a specified range. If no 'from' reference is provided,
   * returns all commits up to the 'to' reference.
   *
   * @param from - Starting reference (tag, commit hash, or branch)
   * @param to - Ending reference (defaults to 'HEAD')
   * @returns Array of parsed Git commits
   * @throws {GitError} If Git command fails or references are invalid
   */
  public getCommitsBetween(from?: string, to: string = 'HEAD'): GitCommit[] {
    let range = '';

    if (from) {
      range = `${from}..${to}`;
    } else {
      // Get all commits if no from reference
      range = to;
    }

    // Use double quotes to properly escape the format string on Windows
    const formatStr = '--pretty=format:"%H|%s|%b|%an|%ae|%ad|%cn|%ce|%cd"';
    const command = `log ${range} ${formatStr} --date=iso`;

    try {
      const output = this.execGit(command);

      if (!output) {
        return [];
      }

      return this.parseCommits(output);
    } catch (error) {
      if (error instanceof GitError) {
        // Handle various empty repository scenarios
        if (
          error.message.includes('unknown revision') ||
          error.message.includes('does not have any commits yet') ||
          error.message.includes('bad revision') ||
          error.message.includes('ambiguous argument')
        ) {
          logger.warn(
            `Reference ${from ?? to} not found or repository is empty, returning empty commits`
          );
          return [];
        }
      }
      throw error;
    }
  }

  /**
   * Parse raw Git log output into GitCommit objects
   *
   * Converts the raw output from `git log` command into structured GitCommit objects
   * with parsed author, committer, and date information.
   *
   * @param output - Raw Git log output string
   * @returns Array of parsed GitCommit objects
   */
  private parseCommits(output: string): GitCommit[] {
    const commits: GitCommit[] = [];
    const lines = output.split('\n');

    for (const line of lines) {
      if (!line.trim()) continue;

      const parts = line.split('|');
      if (parts.length < 9) continue;

      const [
        hash,
        subject,
        body,
        authorName,
        authorEmail,
        authorDate,
        committerName,
        committerEmail,
        committerDate,
      ] = parts;

      commits.push({
        hash: hash?.trim() ?? '',
        subject: subject?.trim() ?? '',
        body: body?.trim() ?? '',
        author: {
          name: authorName?.trim() ?? '',
          email: authorEmail?.trim() ?? '',
          date: new Date(authorDate?.trim() ?? Date.now()),
        },
        committer: {
          name: committerName?.trim() ?? '',
          email: committerEmail?.trim() ?? '',
          date: new Date(committerDate?.trim() ?? Date.now()),
        },
      });
    }

    return commits;
  }

  /**
   * Get all tags in the repository
   */
  public getAllTags(): GitTag[] {
    try {
      const command =
        'tag -l --sort=-version:refname --format="%(refname:short)|%(creatordate:iso)|%(subject)"';
      const output = this.execGit(command);

      if (!output) {
        return [];
      }

      return this.parseTags(output);
    } catch {
      logger.warn('Failed to get tags, repository might have no tags yet');
      return [];
    }
  }

  /**
   * Parse raw Git tag output into GitTag objects
   */
  private parseTags(output: string): GitTag[] {
    const tags: GitTag[] = [];
    const lines = output.split('\n');

    for (const line of lines) {
      if (!line.trim()) continue;

      const parts = line.split('|');
      if (parts.length < 3) continue;

      const [name, date, subject] = parts;

      tags.push({
        name: name?.trim() ?? '',
        date: new Date(date?.trim() ?? Date.now()),
        subject: subject?.trim() ?? '',
      });
    }

    return tags;
  }

  /**
   * Get the latest tag
   */
  public getLatestTag(): GitTag | null {
    const tags = this.getAllTags();
    const firstTag = tags[0];
    return firstTag ?? null;
  }

  /**
   * Check if a reference (tag, commit, branch) exists
   */
  public referenceExists(ref: string): boolean {
    try {
      this.execGit(`rev-parse --verify ${ref}`);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get current branch name
   */
  public getCurrentBranch(): string {
    try {
      return this.execGit('branch --show-current');
    } catch {
      return 'main'; // fallback
    }
  }

  /**
   * Get repository remote URL
   */
  public getRemoteUrl(remote: string = 'origin'): string | null {
    try {
      return this.execGit(`remote get-url ${remote}`);
    } catch {
      return null;
    }
  }

  /**
   * Check if repository is clean (no uncommitted changes)
   */
  public isRepositoryClean(): boolean {
    try {
      const status = this.execGit('status --porcelain');
      return status === '';
    } catch {
      return false;
    }
  }

  /**
   * Get commit count between two references
   */
  public getCommitCount(from?: string, to: string = 'HEAD'): number {
    const commits = this.getCommitsBetween(from, to);
    return commits.length;
  }

  /**
   * Check if the repository has any commits
   */
  public hasCommits(): boolean {
    try {
      this.execGit('rev-parse HEAD');
      return true;
    } catch {
      return false;
    }
  }
}

export default GitService;
