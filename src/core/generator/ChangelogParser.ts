/**
 * Changelog Parser
 * Parses existing CHANGELOG.md files to extract version entries and changes
 */

import type { ChangelogEntry, ChangeType, Change } from '../../types/index.js';
import { logger } from '../../utils/logger.js';

export interface ParseOptions {
  preserveUnreleased?: boolean;
  validateFormat?: boolean;
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
      if (!line ?? line.startsWith('<!--')) {
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
   * Check if changelog follows Keep a Changelog format
   */
  validateFormat(content: string): { valid: boolean; issues: string[] } {
    const issues: string[] = [];

    // Check for required header
    if (!content.includes('# Changelog')) {
      issues.push('Missing "# Changelog" header');
    }

    // Check for Keep a Changelog reference
    if (!content.includes('keepachangelog.com')) {
      issues.push('Missing Keep a Changelog reference');
    }

    // Check for semantic versioning reference
    if (!content.includes('semver.org')) {
      issues.push('Missing Semantic Versioning reference');
    }

    // Check version format
    const versionRegex = /##\s*\[([^\]]+)\]/g;
    let match;
    while ((match = versionRegex.exec(content)) !== null) {
      const version = match[1];
      if (version && version !== 'Unreleased' && !this.isValidVersion(version)) {
        issues.push(`Invalid version format: ${version}`);
      }
    }

    // Check section order
    const sectionOrder = ['Added', 'Changed', 'Deprecated', 'Removed', 'Fixed', 'Security'];
    const sections =
      content.match(/###\s+(Added|Changed|Deprecated|Removed|Fixed|Security)/g) ?? [];

    let lastIndex = -1;
    for (const sectionMatch of sections) {
      const section = sectionMatch.replace('### ', '');
      const currentIndex = sectionOrder.indexOf(section);

      if (currentIndex !== -1 && currentIndex < lastIndex) {
        issues.push(`Section "${section}" is out of order`);
      }

      if (currentIndex !== -1) {
        lastIndex = currentIndex;
      }
    }

    return {
      valid: issues.length === 0,
      issues,
    };
  }

  /**
   * Get the latest version from changelog
   */
  getLatestVersion(content: string): string | null {
    const versionRegex = /##\s*\[([^\]]+)\]/;
    const match = content.match(versionRegex);

    if (match?.[1] && match[1] !== 'Unreleased') {
      return match[1];
    }

    return null;
  }

  /**
   * Check if changelog has unreleased section
   */
  hasUnreleasedSection(content: string): boolean {
    return /##\s*\[Unreleased\]/i.test(content);
  }

  /**
   * Extract unreleased changes
   */
  getUnreleasedChanges(content: string): ChangelogEntry | null {
    const entries = this.parse(content);
    return entries.find(entry => entry.version === 'Unreleased') ?? null;
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

    // Clean description by removing reference links
    cleanDescription = cleanDescription.replace(/\s*\([^)]*\)\s*$/, '');

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
   * Validate version format (basic semantic versioning)
   */
  private isValidVersion(version: string): boolean {
    return /^\d+\.\d+\.\d+(?:-[a-zA-Z0-9.-]+)?(?:\+[a-zA-Z0-9.-]+)?$/.test(version);
  }

  /**
   * Merge multiple changelog entries
   */
  static mergeEntries(entries: ChangelogEntry[]): ChangelogEntry[] {
    const versionMap = new Map<string, ChangelogEntry>();

    for (const entry of entries) {
      const existing = versionMap.get(entry.version);

      if (existing) {
        // Merge sections
        for (const [sectionType, changes] of entry.sections) {
          const existingChanges = existing.sections.get(sectionType) ?? [];
          existing.sections.set(sectionType, [...existingChanges, ...changes]);
        }

        // Use the newer date if available
        if (entry.date && (!existing.date ?? entry.date > existing.date)) {
          existing.date = entry.date;
        }
      } else {
        versionMap.set(entry.version, entry);
      }
    }

    return Array.from(versionMap.values());
  }

  /**
   * Convert entries back to changelog content
   */
  static entriesToContent(_entries: ChangelogEntry[]): string {
    // This would use KeepChangelogGenerator - avoiding circular dependency
    // Implementation would be similar to KeepChangelogGenerator.generate()
    throw new Error('Use KeepChangelogGenerator.generate() instead');
  }
}

export default ChangelogParser;
