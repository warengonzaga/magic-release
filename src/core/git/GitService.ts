/**
 * Git Service - Core Git operations handler
 * Handles all Git repository interactions for Magic Release
 */

import { execSync } from 'child_process';
import { existsSync } from 'fs';
import path from 'path';

import { GitCommit, GitTag } from '../../types/index.js';
import { createGitError, GitError } from '../../utils/errors.js';
import { logger } from '../../utils/logger.js';

export class GitService {
  private cwd: string;

  constructor(cwd: string = process.cwd()) {
    this.cwd = cwd;
    this.validateGitRepository();
  }

  /**
   * Validate that we're in a Git repository
   */
  private validateGitRepository(): void {
    const gitDir = path.join(this.cwd, '.git');
    if (!existsSync(gitDir)) {
      throw createGitError('Not a Git repository');
    }
  }

  /**
   * Execute Git command safely
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
    } catch (error: any) {
      logger.error(`Git command failed: git ${command}`, error);
      throw createGitError(`Git command failed: ${error.message}`);
    }
  }

  /**
   * Get all commits between two references (tags, commits, HEAD)
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
      if (error instanceof GitError && error.message.includes('unknown revision')) {
        logger.warn(`Reference ${from || to} not found, returning empty commits`);
        return [];
      }
      throw error;
    }
  }

  /**
   * Parse raw Git log output into GitCommit objects
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
        hash: hash?.trim() || '',
        subject: subject?.trim() || '',
        body: body?.trim() || '',
        author: {
          name: authorName?.trim() || '',
          email: authorEmail?.trim() || '',
          date: new Date(authorDate?.trim() || Date.now()),
        },
        committer: {
          name: committerName?.trim() || '',
          email: committerEmail?.trim() || '',
          date: new Date(committerDate?.trim() || Date.now()),
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
    } catch (error) {
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
        name: name?.trim() || '',
        date: new Date(date?.trim() || Date.now()),
        subject: subject?.trim() || '',
      });
    }

    return tags;
  }

  /**
   * Get the latest tag
   */
  public getLatestTag(): GitTag | null {
    const tags = this.getAllTags();
    return tags.length > 0 ? tags[0]! : null;
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
}

export default GitService;
