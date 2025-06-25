/**
 * Tag Manager - Handle version tags and semantic versioning
 * Manages Git tags, version parsing, and release planning
 */

import { execSync } from 'child_process';
import semver from 'semver';

import type { GitTag, Tag } from '../../types/index.js';
import { createGitError } from '../../utils/errors.js';
import { logger } from '../../utils/logger.js';

export interface VersionPlan {
  currentVersion?: string;
  nextVersion: string;
  releaseType: 'major' | 'minor' | 'patch' | 'prerelease';
  isFirstRelease: boolean;
}

export class TagManager {
  private cwd: string;

  constructor(cwd: string = process.cwd()) {
    this.cwd = cwd;
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
        stdio: ['ignore', 'pipe', 'pipe']
      });
      
      return result.trim();
    } catch (error: any) {
      logger.error(`Git command failed: git ${command}`, error);
      throw createGitError(`Git command failed: ${error.message}`);
    }
  }

  /**
   * Convert GitTag to Tag with semantic version parsing
   */
  public convertGitTagToTag(gitTag: GitTag): Tag | null {
    const version = this.extractVersion(gitTag.name);
    
    if (!version) {
      logger.debug(`Could not extract version from tag: ${gitTag.name}`);
      return null;
    }

    return {
      name: gitTag.name,
      version,
      hash: this.getTagCommitHash(gitTag.name),
      date: gitTag.date,
      isPreRelease: this.isPreReleaseVersion(version)
    };
  }

  /**
   * Get all valid semantic version tags
   */
  public getVersionTags(gitTags: GitTag[]): Tag[] {
    const versionTags: Tag[] = [];

    for (const gitTag of gitTags) {
      const tag = this.convertGitTagToTag(gitTag);
      if (tag) {
        versionTags.push(tag);
      }
    }

    // Sort by semantic version (newest first)
    return versionTags.sort((a, b) => {
      const compareResult = semver.rcompare(a.version, b.version);
      return compareResult;
    });
  }

  /**
   * Get the latest release tag (non-prerelease)
   */
  public getLatestReleaseTag(tags: Tag[]): Tag | null {
    return tags.find(tag => !tag.isPreRelease) || null;
  }

  /**
   * Get the latest tag (including prereleases)
   */
  public getLatestTag(tags: Tag[]): Tag | null {
    return tags.length > 0 ? tags[0] || null : null;
  }

  /**
   * Extract version string from tag name
   */
  public extractVersion(tagName: string): string | null {
    // Common version tag patterns
    const patterns = [
      /^v?(\d+\.\d+\.\d+(?:-[\w\.-]+)?(?:\+[\w\.-]+)?)$/i, // v1.2.3, 1.2.3, v1.2.3-alpha.1
      /^release[-\/]?v?(\d+\.\d+\.\d+(?:-[\w\.-]+)?(?:\+[\w\.-]+)?)$/i, // release/v1.2.3
      /^(\d+\.\d+\.\d+(?:-[\w\.-]+)?(?:\+[\w\.-]+)?)[-_]release$/i, // 1.2.3-release
    ];

    for (const pattern of patterns) {
      const match = pattern.exec(tagName);
      if (match && match[1]) {
        const version = match[1];
        // Validate with semver
        if (semver.valid(version)) {
          return version;
        }
      }
    }

    return null;
  }

  /**
   * Check if version is a prerelease
   */
  public isPreReleaseVersion(version: string): boolean {
    return semver.prerelease(version) !== null;
  }

  /**
   * Get commit hash for a specific tag
   */
  public getTagCommitHash(tagName: string): string {
    try {
      return this.execGit(`rev-list -n 1 ${tagName}`);
    } catch {
      return '';
    }
  }

  /**
   * Plan the next version based on changes
   */
  public planNextVersion(
    currentTags: Tag[],
    hasBreakingChanges: boolean,
    hasFeatures: boolean,
    hasFixes: boolean
  ): VersionPlan {
    const latestTag = this.getLatestReleaseTag(currentTags);
    const currentVersion = latestTag?.version;

    if (!currentVersion) {
      // First release
      return {
        nextVersion: '1.0.0',
        releaseType: 'major',
        isFirstRelease: true
      };
    }

    let releaseType: 'major' | 'minor' | 'patch' = 'patch';

    if (hasBreakingChanges) {
      releaseType = 'major';
    } else if (hasFeatures) {
      releaseType = 'minor';
    } else if (hasFixes) {
      releaseType = 'patch';
    }

    const nextVersion = semver.inc(currentVersion, releaseType);

    if (!nextVersion) {
      throw createGitError(`Failed to increment version from ${currentVersion}`);
    }

    return {
      currentVersion,
      nextVersion,
      releaseType,
      isFirstRelease: false
    };
  }

  /**
   * Suggest next version based on conventional commits
   */
  public suggestNextVersion(
    currentTags: Tag[],
    commitTypes: string[]
  ): VersionPlan {
    const hasBreaking = commitTypes.some(type => 
      type.includes('!') || type.includes('BREAKING')
    );
    const hasFeature = commitTypes.some(type => 
      type.startsWith('feat') || type.startsWith('feature')
    );
    const hasFix = commitTypes.some(type => 
      type.startsWith('fix') || type.startsWith('bugfix')
    );

    return this.planNextVersion(currentTags, hasBreaking, hasFeature, hasFix);
  }

  /**
   * Check if a tag exists
   */
  public tagExists(tagName: string): boolean {
    try {
      this.execGit(`show-ref --tags --verify refs/tags/${tagName}`);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get tags between two references
   */
  public getTagsBetween(from?: string, to: string = 'HEAD'): Tag[] {
    try {
      let command = '';
      if (from) {
        command = `tag --merged ${to} --no-merged ${from}^`;
      } else {
        command = `tag --merged ${to}`;
      }

      const output = this.execGit(command);
      if (!output) {
        return [];
      }

      const tagNames = output.split('\n').filter(name => name.trim());
      const tags: Tag[] = [];

      for (const tagName of tagNames) {
        const version = this.extractVersion(tagName);
        if (version) {
          tags.push({
            name: tagName,
            version,
            hash: this.getTagCommitHash(tagName),
            date: new Date(), // We'd need additional git command to get exact date
            isPreRelease: this.isPreReleaseVersion(version)
          });
        }
      }

      return this.sortTagsByVersion(tags);
    } catch {
      return [];
    }
  }

  /**
   * Sort tags by semantic version (newest first)
   */
  private sortTagsByVersion(tags: Tag[]): Tag[] {
    return tags.sort((a, b) => semver.rcompare(a.version, b.version));
  }

  /**
   * Format tag name with version
   */
  public formatTagName(version: string, prefix: string = 'v'): string {
    return `${prefix}${version}`;
  }

  /**
   * Validate version string
   */
  public isValidVersion(version: string): boolean {
    return semver.valid(version) !== null;
  }
}

export default TagManager;
