/**
 * Changelog Parser
 * Parses existing CHANGELOG.md files to extract version entries and changes
 */

import type { ChangelogEntry, ChangeType, Change } from '../../types/index.js';
import { logger } from '../../utils/logger.js';

export interface ParseOptions {
  preserveUnreleased?: boolean;
}

export class ChangelogParser {
  constructor(_options: ParseOptions = {}) {
    // Options preserved for future use
  }

  /**
   * Parse changelog content into structured entries
   */
  parse(content: string): ChangelogEntry[] {
    logger.debug('Parsing changelog content');

    const lines = content.split('\n');
    const entries: ChangelogEntry[] = [];
    let currentEntry: ChangelogEntry | null = null;
    let currentSection: ChangeType | null = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]?.trim() ?? '';

      // Skip empty lines and comments
      if (!line || line.startsWith('<!--')) {
        continue;
      }

      // Version header: ## [1.0.0] - 2023-01-01 or ## [Unreleased]
      const versionMatch = line.match(/^##\s*\[([^\]]+)\](?:\s*-\s*(.+))?/);
      if (versionMatch) {
        // Save previous entry
        if (currentEntry) {
          entries.push(currentEntry);
        }

        // Start new entry
        const version = versionMatch[1];
        const dateStr = versionMatch[2];

        if (!version) continue; // Skip if no version found

        const parsedDate = dateStr ? this.parseDate(dateStr) : undefined;

        currentEntry = {
          version,
          sections: new Map(),
          ...(parsedDate && { date: parsedDate }),
        };

        currentSection = null;
        logger.debug(`Found version: ${version}`);
        continue;
      }

      // Section header: ### Added, ### Fixed, etc.
      const sectionMatch = line.match(/^###\s+(Added|Changed|Deprecated|Removed|Fixed|Security)/);
      if (sectionMatch && currentEntry) {
        currentSection = sectionMatch[1] as ChangeType;

        if (!currentEntry.sections.has(currentSection)) {
          currentEntry.sections.set(currentSection, []);
        }

        logger.debug(`Found section: ${currentSection}`);
        continue;
      }

      // Change entry: - Some change description
      const changeMatch = line.match(/^-\s+(.+)/);
      if (changeMatch && currentEntry && currentSection) {
        const description = changeMatch[1];
        if (description) {
          const change = this.parseChangeDescription(description);

          const changes = currentEntry.sections.get(currentSection) ?? [];
          changes.push(change);
          currentEntry.sections.set(currentSection, changes);
        }

        continue;
      }
    }

    // Add final entry
    if (currentEntry) {
      entries.push(currentEntry);
    }

    logger.debug(`Parsed ${entries.length} changelog entries`);
    return entries;
  }

  /**
   * Extract version numbers from changelog content
   */
  extractVersions(content: string): Set<string> {
    const versions = new Set<string>();
    const versionRegex = /^##\s*\[([^\]]+)\]/gm;
    let match;

    while ((match = versionRegex.exec(content)) !== null) {
      if (match[1]) {
        versions.add(match[1]);
      }
    }

    return versions;
  }

  /**
   * Parse change description and extract metadata
   */
  private parseChangeDescription(description: string): Change {
    // Extract scope from **scope**: format
    const scopeMatch = description.match(/^\*\*([^*]+)\*\*:\s*(.+)/);
    let scope: string | undefined;
    let cleanDescription = description;

    if (scopeMatch) {
      scope = scopeMatch[1];
      const desc = scopeMatch[2];
      if (desc) {
        cleanDescription = desc;
      }
    }

    // Extract links and references
    const pr = this.extractPRNumber(description);
    const issues = this.extractIssueNumbers(description);

    // Extract commit references before cleaning (preserve them)
    const commitHashMatch = cleanDescription.match(/\(\[`([a-f0-9]{7,40})`\]\)$/);
    const originalDescription = cleanDescription;

    // Clean description by removing reference links, but preserve commit hashes
    if (commitHashMatch) {
      // If there's a commit hash, preserve the entire description including the hash
      cleanDescription = originalDescription;
    } else {
      // Only remove non-commit references (like PR/issue links without backticks)
      cleanDescription = cleanDescription.replace(/\s*\([^)]*\)\s*$/, '');
    }

    return {
      description: cleanDescription,
      commits: [], // Will be populated elsewhere if needed
      ...(scope && { scope }),
      ...(pr && { pr }),
      ...(issues.length > 0 && { issues }),
    };
  }

  /**
   * Extract PR number from description
   */
  private extractPRNumber(description: string): number | undefined {
    const prMatch = description.match(/\[#(\d+)\]/);
    return prMatch?.[1] ? parseInt(prMatch[1], 10) : undefined;
  }

  /**
   * Extract issue numbers from description
   */
  private extractIssueNumbers(description: string): string[] {
    const issueMatches = description.match(/\[#(\d+)\]/g);
    if (!issueMatches) return [];

    return issueMatches
      .map(match => {
        const numberMatch = match.match(/\d+/);
        return numberMatch ? numberMatch[0] : '';
      })
      .filter(Boolean);
  }

  /**
   * Parse date string from changelog
   */
  private parseDate(dateStr: string): Date | undefined {
    // Handle common date formats: YYYY-MM-DD, DD/MM/YYYY, etc.
    const isoMatch = dateStr.match(/(\d{4}-\d{2}-\d{2})/);
    if (isoMatch?.[1]) {
      return new Date(isoMatch[1]);
    }

    // Try to parse as general date
    const date = new Date(dateStr);
    return isNaN(date.getTime()) ? undefined : date;
  }

  /**
   * Check if changelog was generated by magicr
   */
  isMagicrGenerated(content: string): boolean {
    const magicrIndicator = 'Generated by Magic Release (magicr)';
    return content.includes(magicrIndicator);
  }

  /**
   * Extract latest version tag from changelog
   * Returns the first versioned section found (assuming changelog is in chronological order)
   */
  getLatestVersionFromChangelog(content: string): string | null {
    const versionRegex = /^##\s*\[([^\]]+)\]/gm;
    let match;

    // Find the first non-unreleased version (assuming newest-first order)
    while ((match = versionRegex.exec(content)) !== null) {
      const version = match[1];
      if (version && version !== 'Unreleased') {
        logger.debug(`Found latest version in changelog: ${version}`);
        return version;
      }
    }

    logger.debug('No versioned sections found in changelog');
    return null;
  }

  /**
   * Get all documented commits/changes from changelog
   */
  getDocumentedCommits(content: string): Set<string> {
    const commitHashes = new Set<string>();

    // Match commit hashes in format [`abcd123`] or ([`abcd123`])
    const hashRegex = /\[`([a-f0-9]{7,40})`\]/g;
    let match;

    while ((match = hashRegex.exec(content)) !== null) {
      if (match[1]) {
        commitHashes.add(match[1]);
      }
    }

    logger.debug(`Found ${commitHashes.size} documented commits in changelog`);
    return commitHashes;
  }

  /**
   * Get current unreleased section content
   */
  getUnreleasedContent(content: string): ChangelogEntry | null {
    const entries = this.parse(content);
    const unreleasedEntry = entries.find(entry => entry.version === 'Unreleased');

    if (!unreleasedEntry) {
      return null;
    }

    // Only return if it has actual content
    const hasContent = Array.from(unreleasedEntry.sections.values()).some(
      changes => changes.length > 0
    );

    return hasContent ? unreleasedEntry : null;
  }

  /**
   * Extract the raw unreleased section content with exact formatting
   * This preserves all formatting, spacing, and structure
   */
  extractUnreleasedRaw(content: string): string | null {
    const lines = content.split('\n');
    let startIndex = -1;
    let endIndex = -1;

    // Find the start of the unreleased section
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]?.trim() ?? '';
      if (line.match(/^##\s*\[Unreleased\]/i)) {
        startIndex = i;
        break;
      }
    }

    if (startIndex === -1) {
      return null; // No unreleased section found
    }

    // Find the end of the unreleased section (next ## header or end of file)
    for (let i = startIndex + 1; i < lines.length; i++) {
      const line = lines[i]?.trim() ?? '';
      if (line.match(/^##\s*\[/)) {
        endIndex = i;
        break;
      }
    }

    // If no next section found, take until end of file
    if (endIndex === -1) {
      endIndex = lines.length;
    }

    // Extract the raw content including the header
    const rawContent = lines.slice(startIndex, endIndex).join('\n');

    // Check if section has actual content (not just the header)
    const contentLines = lines.slice(startIndex + 1, endIndex);
    const hasContent = contentLines.some(line => {
      const trimmed = line.trim();
      return trimmed && !trimmed.startsWith('<!--') && trimmed !== '';
    });

    return hasContent ? rawContent : null;
  }

  /**
   * Convert unreleased section to a versioned release with exact structure preservation
   * This maintains all formatting and only changes the header
   */
  convertUnreleasedToVersion(content: string, version: string, date: Date): string {
    const lines = content.split('\n');
    const result = lines.slice();

    // Find and replace the unreleased header
    for (let i = 0; i < result.length; i++) {
      const line = result[i]?.trim() ?? '';
      if (line.match(/^##\s*\[Unreleased\]/i)) {
        // Format the date consistently
        const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD format
        result[i] = `## [${version}] - ${dateStr}`;
        break;
      }
    }

    return result.join('\n');
  }

  /**
   * Remove the unreleased section entirely while preserving structure
   */
  removeUnreleasedSection(content: string): string {
    const lines = content.split('\n');
    let startIndex = -1;
    let endIndex = -1;

    // Find the start of the unreleased section
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]?.trim() ?? '';
      if (line.match(/^##\s*\[Unreleased\]/i)) {
        startIndex = i;
        break;
      }
    }

    if (startIndex === -1) {
      return content; // No unreleased section to remove
    }

    // Find the end of the unreleased section
    for (let i = startIndex + 1; i < lines.length; i++) {
      const line = lines[i]?.trim() ?? '';
      if (line.match(/^##\s*\[/)) {
        endIndex = i;
        break;
      }
    }

    // Remove the section
    let result: string[];
    if (endIndex === -1) {
      // Remove from start to end of file
      result = lines.slice(0, startIndex);
    } else {
      // Remove the section but preserve what comes after
      result = [...lines.slice(0, startIndex), ...lines.slice(endIndex)];
    }

    // Clean up any double empty lines that might result
    const cleanedResult: string[] = [];
    let lastWasEmpty = false;

    for (const line of result) {
      const isEmpty = line.trim() === '';
      if (!(isEmpty && lastWasEmpty)) {
        cleanedResult.push(line);
      }
      lastWasEmpty = isEmpty;
    }

    return cleanedResult.join('\n');
  }
}

export default ChangelogParser;
