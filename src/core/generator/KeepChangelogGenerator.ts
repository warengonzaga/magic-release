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
  appendOnly?: boolean; // New option for append-only mode
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

    // Handle the changelog generation with proper merging logic
    const finalEntries = await this.processEntriesWithExistingChangelog(
      entries,
      existingChangelog,
      workingDir
    );

    // Generate full changelog content
    let content = this.generateHeader();

    // Add unreleased section if needed
    const unreleasedEntry = finalEntries.find(entry => entry.version === 'Unreleased');
    if (unreleasedEntry && this.hasChanges(unreleasedEntry)) {
      content += this.formatEntry(unreleasedEntry);
    }

    // Add released versions (sorted by version, newest first)
    const releasedEntries = finalEntries
      .filter(entry => entry.version !== 'Unreleased')
      .sort((a, b) => this.compareVersions(b.version, a.version));

    for (const entry of releasedEntries) {
      content += this.formatEntry(entry);
    }

    // Add compare links at the bottom
    if (this.options.includeCompareLinks && releasedEntries.length > 0) {
      content += this.generateCompareLinks(releasedEntries);
    }

    // Ensure content ends with exactly one newline (trim first to remove any extra whitespace, then add single newline)
    return `${content.trim()}\n`;
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
   * Process entries with existing changelog using intelligent merging
   */
  private async processEntriesWithExistingChangelog(
    newEntries: ChangelogEntry[],
    existingChangelog: string | undefined,
    _workingDir: string
  ): Promise<ChangelogEntry[]> {
    // If no existing changelog, return new entries as-is
    if (!existingChangelog) {
      logger.info('No existing changelog found, creating from scratch');
      return newEntries;
    }

    // Parse existing changelog to get structured entries
    const parser = new (await import('./ChangelogParser.js')).default();
    const existingEntries = parser.parse(existingChangelog);
    const documentedVersions = this.extractDocumentedVersions(existingChangelog);

    logger.debug('Found existing changelog', {
      existingVersions: Array.from(documentedVersions),
      newEntries: newEntries.map(e => e.version),
    });

    // Handle different scenarios
    const hasUnreleasedInExisting = documentedVersions.has('Unreleased');
    const hasUnreleasedInNew = newEntries.some(entry => entry.version === 'Unreleased');
    const hasVersionedInNew = newEntries.some(entry => entry.version !== 'Unreleased');

    const finalEntries: ChangelogEntry[] = [];

    // Scenario 1: Converting Unreleased to a versioned release
    if (hasUnreleasedInExisting && hasVersionedInNew) {
      logger.info('Converting existing [Unreleased] section to versioned release');

      // Find the versioned entry from new entries
      const versionedEntry = newEntries.find(entry => entry.version !== 'Unreleased');
      if (versionedEntry) {
        // Convert existing unreleased to the new version
        const existingUnreleased = existingEntries.find(entry => entry.version === 'Unreleased');
        if (existingUnreleased && this.hasChanges(existingUnreleased)) {
          const convertedEntry: ChangelogEntry = {
            version: versionedEntry.version,
            date: versionedEntry.date ?? new Date(),
            sections: existingUnreleased.sections,
          };
          finalEntries.push(convertedEntry);
        }
      }
    }

    // Scenario 2: Add new Unreleased section if there are new unreleased commits
    if (hasUnreleasedInNew) {
      const newUnreleasedEntry = newEntries.find(entry => entry.version === 'Unreleased');
      if (newUnreleasedEntry && this.hasChanges(newUnreleasedEntry)) {
        // If we converted the old unreleased, this becomes the new unreleased section
        finalEntries.push(newUnreleasedEntry);
      }
    }

    // Scenario 3: Add any other NEW versioned entries that don't exist yet and weren't used for conversion
    for (const newEntry of newEntries) {
      if (
        newEntry.version !== 'Unreleased' &&
        !documentedVersions.has(newEntry.version) &&
        !finalEntries.some(entry => entry.version === newEntry.version) && // Avoid duplicates from conversion
        this.hasChanges(newEntry) // Only add if there are actual changes
      ) {
        finalEntries.push(newEntry);
      }
    }

    // Scenario 4: Preserve existing versioned entries (not Unreleased) - but skip duplicates
    for (const existingEntry of existingEntries) {
      const isDuplicate = finalEntries.some(entry => entry.version === existingEntry.version);
      logger.debug(
        `Considering existing entry ${existingEntry.version}, duplicate: ${isDuplicate}`
      );

      if (existingEntry.version !== 'Unreleased' && !isDuplicate) {
        // Only preserve if it has content
        if (this.hasChanges(existingEntry)) {
          logger.debug(`Preserving existing entry: ${existingEntry.version}`);
          finalEntries.push(existingEntry);
        } else {
          logger.debug(`Skipping empty existing entry: ${existingEntry.version}`);
        }
      } else {
        logger.debug(
          `Skipping existing entry: ${existingEntry.version} (Unreleased: ${
            existingEntry.version === 'Unreleased'
          }, duplicate: ${isDuplicate})`
        );
      }
    }

    // If no changes detected, return existing entries to maintain current state
    if (finalEntries.length === 0) {
      logger.info('No new changes detected, maintaining existing changelog');
      return existingEntries;
    }

    logger.info('Processed changelog entries', {
      finalCount: finalEntries.length,
      versions: finalEntries.map(e => e.version),
    });

    return finalEntries;
  }
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
   * Generate changelog header
   */
  private generateHeader(): string {
    return `# Changelog
<!-- 
  Generated by Magic Release (magicr) - https://github.com/warengonzaga/magic-release
  Author: Waren Gonzaga (opensource@warengonzaga.com)
  Do not remove this comment - it's used by magicr for efficient changelog updates
-->

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
      writeFileSync(changelogPath, content, 'utf8');
      logger.info(`Changelog written to: ${changelogPath}`);
    } catch (error) {
      throw new ChangelogError(`Failed to write changelog: ${error}`);
    }
  }

  /**
   * Check if changelog was generated by magicr
   */
  static async isMagicrGenerated(content: string): Promise<boolean> {
    const parser = new (await import('./ChangelogParser.js')).default();
    return parser.isMagicrGenerated(content);
  }

  /**
   * Process entries using scenario-based conversion with structure preservation
   * This method handles the conversion scenarios detected by MagicRelease
   */
  async processEntriesWithScenario(
    entries: ChangelogEntry[],
    existingChangelog: string | undefined,
    scenario:
      | 'convert-unreleased'
      | 'use-tag-version'
      | 'dual-conversion'
      | 'new-unreleased'
      | 'no-conversion',
    _workingDir: string
  ): Promise<ChangelogEntry[]> {
    if (!existingChangelog) {
      logger.info('No existing changelog found, creating from scratch');
      return entries;
    }

    const parser = new (await import('./ChangelogParser.js')).default();
    const existingEntries = parser.parse(existingChangelog);

    logger.debug('Processing entries with scenario', {
      scenario,
      entriesCount: entries.length,
      existingEntriesCount: existingEntries.length,
    });

    switch (scenario) {
      case 'convert-unreleased': {
        // Find the version entry to convert to
        const versionEntry = entries.find(entry => entry.version !== 'Unreleased');
        if (!versionEntry) {
          logger.warn('No version entry found for convert-unreleased scenario');
          return existingEntries;
        }

        // Get existing unreleased content with exact structure
        const unreleasedRaw = parser.extractUnreleasedRaw(existingChangelog);
        if (!unreleasedRaw) {
          logger.info('No unreleased content to convert');
          return [...existingEntries, versionEntry];
        }

        // Convert the unreleased section to the target version
        const convertedContent = parser.convertUnreleasedToVersion(
          unreleasedRaw,
          versionEntry.version,
          versionEntry.date ?? new Date()
        );

        // Parse the converted content to get a proper entry
        const convertedEntries = parser.parse(`# Changelog\n\n${convertedContent}`);
        const convertedEntry = convertedEntries[0];

        if (convertedEntry) {
          // Replace the unreleased with the converted version
          const finalEntries = existingEntries.filter(entry => entry.version !== 'Unreleased');
          finalEntries.unshift(convertedEntry);
          return finalEntries;
        }

        return existingEntries;
      }

      case 'dual-conversion': {
        // Handle both conversion of existing unreleased AND add new unreleased
        const versionEntry = entries.find(entry => entry.version !== 'Unreleased');
        const newUnreleasedEntry = entries.find(entry => entry.version === 'Unreleased');

        const finalEntries: ChangelogEntry[] = [];

        // First, add the new unreleased if it exists
        if (newUnreleasedEntry && this.hasChanges(newUnreleasedEntry)) {
          finalEntries.push(newUnreleasedEntry);
        }

        // Then convert existing unreleased to version
        if (versionEntry) {
          const unreleasedRaw = parser.extractUnreleasedRaw(existingChangelog);
          if (unreleasedRaw) {
            const convertedContent = parser.convertUnreleasedToVersion(
              unreleasedRaw,
              versionEntry.version,
              versionEntry.date ?? new Date()
            );

            const convertedEntries = parser.parse(`# Changelog\n\n${convertedContent}`);
            const convertedEntry = convertedEntries[0];

            if (convertedEntry) {
              finalEntries.push(convertedEntry);
            }
          }
        }

        // Finally, preserve existing versioned entries
        const existingVersioned = existingEntries.filter(entry => entry.version !== 'Unreleased');
        finalEntries.push(...existingVersioned);

        return finalEntries;
      }

      case 'new-unreleased': {
        // Just add new unreleased, keep everything else as-is
        const newUnreleasedEntry = entries.find(entry => entry.version === 'Unreleased');
        if (newUnreleasedEntry && this.hasChanges(newUnreleasedEntry)) {
          const finalEntries = [...existingEntries.filter(entry => entry.version !== 'Unreleased')];
          finalEntries.unshift(newUnreleasedEntry);
          return finalEntries;
        }
        return existingEntries;
      }

      case 'use-tag-version': {
        // Use the tag version for the new commits, preserve everything else
        const versionEntry = entries.find(entry => entry.version !== 'Unreleased');
        if (versionEntry && this.hasChanges(versionEntry)) {
          const finalEntries = [...existingEntries];
          finalEntries.unshift(versionEntry);
          return finalEntries;
        }
        return existingEntries;
      }

      case 'no-conversion':
      default:
        // Maintain current state
        return existingEntries;
    }
  }

  /**
   * Generate changelog with append-only mode for maximum content preservation
   * This method modifies only the necessary sections, preserving all existing content byte-for-byte
   */
  async generateAppendOnly(
    entries: ChangelogEntry[],
    existingContent: string,
    workingDir: string
  ): Promise<string> {
    logger.debug('Generating changelog in append-only mode', {
      entriesCount: entries.length,
      preserveExisting: true,
    });

    if (!existingContent) {
      // No existing content, fallback to normal generation
      return this.generate(entries, workingDir);
    }

    // Parse existing content to understand structure
    const parser = new (await import('./ChangelogParser.js')).default();
    const existingEntries = parser.parse(existingContent);

    // Check if we have magicr-generated content
    const isMagicrGenerated = parser.isMagicrGenerated(existingContent);

    if (!isMagicrGenerated) {
      // For non-magicr changelogs, use minimal modification approach
      return this.appendToNonMagicrChangelog(entries, existingContent, existingEntries);
    }

    // For magicr changelogs, use precision content modification
    return this.appendToMagicrChangelog(entries, existingContent, existingEntries);
  }

  /**
   * Append to non-magicr changelog with minimal modifications
   */
  private async appendToNonMagicrChangelog(
    entries: ChangelogEntry[],
    existingContent: string,
    existingEntries: ChangelogEntry[]
  ): Promise<string> {
    logger.info('Appending to non-magicr changelog with minimal modifications');

    const lines = existingContent.split('\n');
    const result = [...lines];

    // Find insertion point (after header/description, before first version)
    let insertionIndex = 0;

    // Skip header and description lines
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]?.trim() ?? '';

      // Look for first version header
      if (line.match(/^##\s*\[/)) {
        insertionIndex = i;
        break;
      }

      // If we reach the end without finding versions, append at end
      if (i === lines.length - 1) {
        insertionIndex = lines.length;
      }
    }

    // Generate content for new entries only
    const newContent: string[] = [];

    for (const entry of entries) {
      // Check if this version already exists
      const existsInChangelog = existingEntries.some(
        existing => existing.version === entry.version
      );

      if (!existsInChangelog && this.hasChanges(entry)) {
        newContent.push(''); // Empty line before entry
        newContent.push(this.formatEntry(entry).trim());
      }
    }

    // Insert new content
    if (newContent.length > 0) {
      result.splice(insertionIndex, 0, ...newContent);
    }

    return result.join('\n');
  }

  /**
   * Append to magicr-generated changelog with precision modifications
   */
  private async appendToMagicrChangelog(
    entries: ChangelogEntry[],
    existingContent: string,
    existingEntries: ChangelogEntry[]
  ): Promise<string> {
    logger.info('Appending to magicr changelog with precision modifications');

    let result = existingContent;

    for (const entry of entries) {
      const existingEntry = existingEntries.find(existing => existing.version === entry.version);

      if (entry.version === 'Unreleased') {
        // Handle unreleased section updates
        result = await this.updateUnreleasedSection(result, entry);
      } else if (!existingEntry && this.hasChanges(entry)) {
        // Add new version section
        result = this.insertVersionSection(result, entry);
      } else if (existingEntry) {
        // Update existing version section if needed
        result = this.updateVersionSection(result, entry, existingEntry);
      }
    }

    return result;
  }

  /**
   * Update unreleased section with minimal changes
   */
  private async updateUnreleasedSection(
    content: string,
    newEntry: ChangelogEntry
  ): Promise<string> {
    // Create parser instance for this method
    const parser = new (await import('./ChangelogParser.js')).default();
    const existingUnreleased = parser.extractUnreleasedRaw(content);

    if (!existingUnreleased) {
      // No existing unreleased, add new one at top
      return this.insertUnreleasedAtTop(content, newEntry);
    }

    if (!this.hasChanges(newEntry)) {
      // No new changes, keep existing
      return content;
    }

    // Replace unreleased section with updated content
    const newUnreleasedContent = this.formatEntry(newEntry).trim();
    const lines = content.split('\n');
    let startIndex = -1;
    let endIndex = -1;

    // Find unreleased section boundaries
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]?.trim() ?? '';
      if (line.match(/^##\s*\[Unreleased\]/i)) {
        startIndex = i;
      } else if (startIndex !== -1 && line.match(/^##\s*\[/)) {
        endIndex = i;
        break;
      }
    }

    if (startIndex !== -1) {
      if (endIndex === -1) endIndex = lines.length;

      const before = lines.slice(0, startIndex);
      const after = lines.slice(endIndex);
      const newLines = newUnreleasedContent.split('\n');

      return [...before, ...newLines, '', ...after].join('\n');
    }

    return content;
  }

  /**
   * Insert unreleased section at the top of versions
   */
  private insertUnreleasedAtTop(content: string, entry: ChangelogEntry): string {
    const lines = content.split('\n');
    let insertionIndex = lines.length;

    // Find first version header
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]?.trim() ?? '';
      if (line.match(/^##\s*\[/) && !line.match(/unreleased/i)) {
        insertionIndex = i;
        break;
      }
    }

    const entryContent = this.formatEntry(entry).trim();
    const newLines = ['', ...entryContent.split('\n'), ''];

    const result = [...lines];
    result.splice(insertionIndex, 0, ...newLines);

    return result.join('\n');
  }

  /**
   * Insert new version section at appropriate position
   */
  private insertVersionSection(content: string, entry: ChangelogEntry): string {
    const lines = content.split('\n');
    let insertionIndex = lines.length;

    // Find appropriate insertion point (after unreleased, before older versions)
    let foundUnreleased = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]?.trim() ?? '';
      const versionMatch = line.match(/^##\s*\[([^\]]+)\]/);

      if (versionMatch) {
        const version = versionMatch[1];

        if (version === 'Unreleased') {
          foundUnreleased = true;
          continue;
        }

        // If we've passed unreleased, this is where we insert
        if (foundUnreleased || !foundUnreleased) {
          insertionIndex = i;
          break;
        }
      }
    }

    const entryContent = this.formatEntry(entry).trim();
    const newLines = ['', ...entryContent.split('\n'), ''];

    const result = [...lines];
    result.splice(insertionIndex, 0, ...newLines);

    return result.join('\n');
  }

  /**
   * Update existing version section if changes detected
   */
  private updateVersionSection(
    content: string,
    _newEntry: ChangelogEntry,
    existingEntry: ChangelogEntry
  ): string {
    // For now, preserve existing versioned sections
    // This can be enhanced to detect and merge specific changes
    logger.debug(`Preserving existing version section: ${existingEntry.version}`);
    return content;
  }

  // ...existing code...
}

export default KeepChangelogGenerator;
