/**
 * KeepChangelogGenerator - Generates changelogs following Keep a Changelog format
 *
 * This class implements the official Keep a Changelog format (https://keepachangelog.com/)
 * and provides functionality to generate, merge, and format changelog entries with proper
 * semantic versioning and categorization.
 *
 * @example
 * ```typescript
 * const generator = new KeepChangelogGenerator(config);
 * const changelog = await generator.generate(entries, workingDir);
 * ```
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import path from 'path';

import type { ChangelogEntry, Change, ChangeType, MagicReleaseConfig } from '../../types/index.js';
import { ChangelogError } from '../../utils/errors.js';
import { logger } from '../../utils/logger.js';

export interface GeneratorOptions {
  includeCompareLinks?: boolean;
  includePRLinks?: boolean;
  includeCommitLinks?: boolean;
  includeIssueLinks?: boolean;
}

export class KeepChangelogGenerator {
  /** Configuration object containing changelog settings */
  private config: MagicReleaseConfig;

  /** Generator options for link inclusion and formatting */
  private options: GeneratorOptions;

  /**
   * Create a new KeepChangelogGenerator instance
   *
   * @param config - Magic Release configuration
   * @param options - Optional generator settings for customization
   */
  constructor(config: MagicReleaseConfig, options: GeneratorOptions = {}) {
    this.config = config;
    this.options = {
      includeCompareLinks: true, // Default to true since it's not in config yet
      includePRLinks: config.changelog?.includePRLinks ?? true,
      includeCommitLinks: config.changelog?.includeCommitLinks ?? true,
      includeIssueLinks: config.changelog?.includeIssueLinks ?? true,
      ...options,
    };
  }

  /**
   * Generate complete changelog from entries
   *
   * Creates a full changelog document following Keep a Changelog format,
   * merging new entries with existing content and maintaining proper
   * version ordering and section organization.
   *
   * @param entries - Array of changelog entries to include
   * @param workingDir - Working directory containing the project
   * @returns Complete formatted changelog content
   */
  async generate(entries: ChangelogEntry[], workingDir: string): Promise<string> {
    logger.debug('Generating Keep a Changelog format', {
      entriesCount: entries.length,
      includeLinks: this.options,
    });

    const existingChangelog = await this.loadExistingChangelog(workingDir);
    const documentedVersions = this.extractDocumentedVersions(existingChangelog);

    // Filter out already documented versions
    const newEntries = entries.filter(entry => !documentedVersions.has(entry.version));

    if (newEntries.length === 0) {
      logger.info('No new versions to document');
      return existingChangelog ?? this.generateHeader();
    }

    // Merge with existing changelog
    const mergedEntries = this.mergeEntries(existingChangelog, newEntries);

    // Generate full changelog content
    let content = this.generateHeader();

    // Add unreleased section if needed
    const unreleasedEntry = mergedEntries.find(entry => entry.version === 'Unreleased');
    if (unreleasedEntry && this.hasChanges(unreleasedEntry)) {
      content += this.formatEntry(unreleasedEntry);
      content += '\n';
    }

    // Add released versions (sorted by version, newest first)
    const releasedEntries = mergedEntries
      .filter(entry => entry.version !== 'Unreleased')
      .sort((a, b) => this.compareVersions(b.version, a.version));

    for (const entry of releasedEntries) {
      content += this.formatEntry(entry);
      content += '\n';
    }

    // Add compare links at the bottom
    if (this.options.includeCompareLinks && releasedEntries.length > 0) {
      content += this.generateCompareLinks(releasedEntries);
    }

    return content.trim();
  }

  /**
   * Load existing changelog file
   *
   * Attempts to read an existing changelog file from the working directory.
   * Returns undefined if no changelog exists.
   *
   * @param workingDir - Directory to search for changelog file
   * @returns Existing changelog content or undefined
   */
  async loadExistingChangelog(workingDir: string): Promise<string | undefined> {
    const filename = this.config.changelog?.filename ?? 'CHANGELOG.md';
    const changelogPath = path.join(workingDir, filename);

    if (!existsSync(changelogPath)) {
      return undefined;
    }

    try {
      const content = readFileSync(changelogPath, 'utf8');
      logger.debug(`Loaded existing changelog: ${changelogPath}`);
      return content;
    } catch (error) {
      logger.warn(`Failed to read existing changelog: ${error}`);
      return undefined;
    }
  }

  /**
   * Extract already documented versions from existing changelog
   */
  extractDocumentedVersions(changelog?: string): Set<string> {
    const versions = new Set<string>();

    if (!changelog) {
      return versions;
    }

    // Match version headers: ## [1.0.0] - 2023-01-01 or ## [Unreleased]
    const versionRegex = /^##\s*\[([^\]]+)\]/gm;
    let match;

    while ((match = versionRegex.exec(changelog)) !== null) {
      if (match[1]) {
        versions.add(match[1]);
      }
    }

    logger.debug(`Found ${versions.size} documented versions`, Array.from(versions));
    return versions;
  }

  /**
   * Merge new entries with existing changelog structure
   */
  private mergeEntries(
    existingChangelog: string | undefined,
    newEntries: ChangelogEntry[]
  ): ChangelogEntry[] {
    // If no existing changelog, return new entries as-is
    if (!existingChangelog) {
      return newEntries;
    }

    // Parse existing entries (simplified - just extract versions)
    const existingVersions = this.extractDocumentedVersions(existingChangelog);
    const allEntries = [...newEntries];

    // Add placeholder entries for existing versions to maintain sort order
    for (const version of existingVersions) {
      if (!newEntries.some(entry => entry.version === version)) {
        allEntries.push({
          version,
          sections: new Map(),
          // Don't include date for existing entries - will be preserved from existing content
        });
      }
    }

    return allEntries;
  }

  /**
   * Generate changelog header
   */
  private generateHeader(): string {
    return `# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

`;
  }

  /**
   * Format a single changelog entry
   */
  private formatEntry(entry: ChangelogEntry): string {
    let content = '';

    // Version header
    if (entry.version === 'Unreleased') {
      content += '## [Unreleased]\n\n';
    } else {
      const dateStr = entry.date ? ` - ${this.formatDate(entry.date)}` : '';
      content += `## [${entry.version}]${dateStr}\n\n`;
    }

    // Sort sections in Keep a Changelog order
    const sectionOrder: ChangeType[] = [
      'Added',
      'Changed',
      'Deprecated',
      'Removed',
      'Fixed',
      'Security',
    ];

    for (const sectionType of sectionOrder) {
      const changes = entry.sections.get(sectionType);
      if (changes && changes.length > 0) {
        content += `### ${sectionType}\n\n`;

        for (const change of changes) {
          content += this.formatChange(change);
        }

        content += '\n';
      }
    }

    return content;
  }

  /**
   * Format a single change entry
   */
  private formatChange(change: Change): string {
    let line = `- ${change.description}`;

    // Add scope if available and format properly
    if (change.scope) {
      line = `- **${change.scope}**: ${change.description}`;
    }

    // Add links
    const links: string[] = [];

    if (this.options.includeCommitLinks && change.commits.length > 0) {
      // Only include first commit to avoid clutter
      const firstCommit = change.commits[0];
      if (firstCommit?.hash) {
        links.push(`[\`${firstCommit.hash.substring(0, 7)}\`]`);
      }
    }

    if (this.options.includePRLinks && change.pr) {
      links.push(`[#${change.pr}]`);
    }

    if (this.options.includeIssueLinks && change.issues && change.issues.length > 0) {
      links.push(...change.issues.map(issue => `[#${issue}]`));
    }

    if (links.length > 0) {
      line += ` (${links.join(', ')})`;
    }

    return `${line}\n`;
  }

  /**
   * Generate compare links section
   */
  private generateCompareLinks(entries: ChangelogEntry[]): string {
    if (!this.config.git?.repository) {
      return '';
    }

    const baseUrl = this.getRepositoryUrl();
    if (!baseUrl) {
      return '';
    }

    let links = '\n<!-- Compare Links -->\n';

    // Unreleased link
    const latestVersion = entries[0]?.version;
    if (latestVersion) {
      links += `[Unreleased]: ${baseUrl}/compare/v${latestVersion}...HEAD\n`;
    }

    // Version compare links
    for (let i = 0; i < entries.length; i++) {
      const current = entries[i];
      const previous = entries[i + 1];

      if (current && previous) {
        links += `[${current.version}]: ${baseUrl}/compare/v${previous.version}...v${current.version}\n`;
      } else if (current) {
        // First release
        links += `[${current.version}]: ${baseUrl}/releases/tag/v${current.version}\n`;
      }
    }

    return links;
  }

  /**
   * Get repository URL for links
   */
  private getRepositoryUrl(): string | null {
    const repo = this.config.git?.repository;
    if (!repo) {
      return null;
    }

    // Handle different URL formats
    if (repo.startsWith('http')) {
      return repo;
    }

    // Assume GitHub format: owner/repo
    if (repo.includes('/')) {
      return `https://github.com/${repo}`;
    }

    return null;
  }

  /**
   * Format date for changelog
   */
  private formatDate(date: Date): string {
    const isoDate = date.toISOString().split('T')[0];
    return isoDate ?? '';
  }

  /**
   * Check if entry has any changes
   */
  private hasChanges(entry: ChangelogEntry): boolean {
    for (const [, changes] of entry.sections) {
      if (changes.length > 0) {
        return true;
      }
    }
    return false;
  }

  /**
   * Compare semantic versions (simplified)
   */
  private compareVersions(a: string, b: string): number {
    const parseVersion = (version: string): number[] => {
      const parts = version.replace(/^v/, '').split('-')[0]?.split('.').map(Number) ?? [];
      return parts.concat([0, 0, 0]).slice(0, 3); // Ensure 3 parts
    };

    const versionA = parseVersion(a);
    const versionB = parseVersion(b);

    for (let i = 0; i < 3; i++) {
      const partA = versionA[i] ?? 0;
      const partB = versionB[i] ?? 0;
      if (partA !== partB) {
        return partA - partB;
      }
    }

    return 0;
  }

  /**
   * Write changelog to file
   */
  async writeChangelog(content: string, workingDir: string): Promise<void> {
    const filename = this.config.changelog?.filename ?? 'CHANGELOG.md';
    const changelogPath = path.join(workingDir, filename);

    try {
      // Create backup if file exists
      if (existsSync(changelogPath)) {
        const backupPath = `${changelogPath}.backup`;
        const existingContent = readFileSync(changelogPath, 'utf8');
        writeFileSync(backupPath, existingContent, 'utf8');
        logger.debug(`Created backup: ${backupPath}`);
      }

      writeFileSync(changelogPath, content, 'utf8');
      logger.info(`Changelog written to: ${changelogPath}`);
    } catch (error) {
      throw new ChangelogError(`Failed to write changelog: ${error}`);
    }
  }
}

export default KeepChangelogGenerator;
