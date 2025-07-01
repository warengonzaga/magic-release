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
}

export default ChangelogParser;
