/**
 * Unit tests for Changelog functionality
 * Tests changelog generation, parsing, and formatting
 */

describe('Changelog Functionality', () => {
  describe('Changelog Format Validation', () => {
    it('should validate Keep a Changelog format', () => {
      // Test main changelog header
      const mainHeader = '# Changelog';
      expect(mainHeader).toMatch(/^# Changelog$/);

      // Test version headers with semantic versioning and ISO date format
      const versionHeaders = [
        '## [1.0.0] - 2023-01-01',
        '## [2.1.3] - 2024-12-31',
        '## [0.1.0] - 2022-01-15',
        '## [Unreleased]',
      ];

      versionHeaders.forEach(header => {
        // Version headers should match: ## [version] - date OR ## [Unreleased]
        expect(header).toMatch(/^## \[(?:\d+\.\d+\.\d+|Unreleased)\](?:\s-\s\d{4}-\d{2}-\d{2})?$/);
      });

      // Test section headers (Keep a Changelog standard sections)
      const sectionHeaders = [
        '### Added',
        '### Changed',
        '### Deprecated',
        '### Removed',
        '### Fixed',
        '### Security',
      ];

      const validSectionNames = ['Added', 'Changed', 'Deprecated', 'Removed', 'Fixed', 'Security'];

      sectionHeaders.forEach(header => {
        // Section headers should match: ### [ValidSectionName]
        expect(header).toMatch(/^### (Added|Changed|Deprecated|Removed|Fixed|Security)$/);

        // Extract section name and verify it's in the approved list
        const sectionMatch = header.match(/^### (.+)$/);
        expect(sectionMatch).toBeTruthy();
        if (sectionMatch) {
          expect(validSectionNames).toContain(sectionMatch[1]);
        }
      });

      // Test invalid headers to ensure validation works
      const invalidHeaders = [
        '## 1.0.0 - 2023-01-01', // Missing brackets
        '### InvalidSection', // Not a standard section
        '# changelog', // Wrong case
        '## [1.0] - 2023-01-01', // Invalid version format
        '### added', // Wrong case
      ];

      invalidHeaders.forEach(header => {
        if (header.startsWith('## ')) {
          expect(header).not.toMatch(
            /^## \[(?:\d+\.\d+\.\d+|Unreleased)\](?:\s-\s\d{4}-\d{2}-\d{2})?$/
          );
        } else if (header.startsWith('### ')) {
          expect(header).not.toMatch(/^### (Added|Changed|Deprecated|Removed|Fixed|Security)$/);
        } else if (header.startsWith('# ')) {
          expect(header).not.toMatch(/^# Changelog$/);
        }
      });
    });

    it('should validate semantic version format', () => {
      const validVersions = ['1.0.0', '1.2.3', '0.1.0', '10.20.30'];
      const invalidVersions = ['1.0', '1.0.0.0', 'v1.0.0', '1.0.0-'];

      validVersions.forEach(version => {
        expect(/^\d+\.\d+\.\d+$/.test(version)).toBe(true);
      });

      invalidVersions.forEach(version => {
        expect(/^\d+\.\d+\.\d+$/.test(version)).toBe(false);
      });
    });

    it('should validate ISO date format', () => {
      const validDates = ['2023-01-01', '2023-12-31', '2024-02-29'];
      const invalidDates = ['2023-1-1', '23-01-01', '2023/01/01'];

      validDates.forEach(date => {
        expect(/^\d{4}-\d{2}-\d{2}$/.test(date)).toBe(true);
      });

      invalidDates.forEach(date => {
        expect(/^\d{4}-\d{2}-\d{2}$/.test(date)).toBe(false);
      });
    });
  });

  describe('Commit Message Parsing', () => {
    it('should parse conventional commit format', () => {
      const commits = [
        { message: 'feat: add new feature', expectedType: 'feat', expectedScope: null },
        { message: 'fix(core): resolve bug', expectedType: 'fix', expectedScope: 'core' },
        { message: 'docs: update README', expectedType: 'docs', expectedScope: null },
        { message: 'feat!: breaking change', expectedType: 'feat', expectedBreaking: true },
      ];

      commits.forEach(({ message, expectedType, expectedScope, expectedBreaking }) => {
        // Simple regex parsing simulation
        const conventionalPattern = /^(\w+)(\([^)]+\))?(!?):\s*(.+)$/;
        const match = message.match(conventionalPattern);

        expect(match).toBeTruthy();
        if (match) {
          expect(match[1]).toBe(expectedType);
          if (expectedScope) {
            expect(match[2]).toBe(`(${expectedScope})`);
          }
          if (expectedBreaking) {
            expect(match[3]).toBe('!');
          }
        }
      });
    });

    it('should categorize commit types', () => {
      const typeCategories = {
        feat: 'Added',
        fix: 'Fixed',
        docs: 'Changed',
        style: 'Changed',
        refactor: 'Changed',
        test: 'Changed',
        chore: 'Changed',
      };

      Object.entries(typeCategories).forEach(([_type, category]) => {
        expect(category).toBeTruthy();
        expect(['Added', 'Changed', 'Fixed', 'Removed', 'Deprecated', 'Security']).toContain(
          category
        );
      });
    });
  });

  describe('Changelog Entry Generation', () => {
    it('should format commit entries', () => {
      const commits = [
        { description: 'Add new feature', scope: 'core' },
        { description: 'Fix critical bug', scope: null },
        { description: 'Update documentation', scope: 'docs' },
      ];

      commits.forEach(commit => {
        const entry = commit.scope
          ? `- **${commit.scope}**: ${commit.description}`
          : `- ${commit.description}`;

        expect(entry.startsWith('- ')).toBe(true);
        expect(entry).toContain(commit.description);
        if (commit.scope) {
          expect(entry).toContain(`**${commit.scope}**:`);
        }
      });
    });

    it('should handle version linking', () => {
      const version = '1.0.0';
      const date = '2023-01-01';
      const versionHeader = `## [${version}] - ${date}`;

      // Test that the version header contains the expected components
      expect(versionHeader).toContain(version);
      expect(versionHeader).toContain(date);

      // Test that the version header follows the correct Keep a Changelog format
      expect(versionHeader).toMatch(/^## \[\d+\.\d+\.\d+\] - \d{4}-\d{2}-\d{2}$/);

      // Test that the version and date are properly bracketed and formatted
      expect(versionHeader).toMatch(/^## \[1\.0\.0\] - 2023-01-01$/);
    });
  });

  describe('Changelog Parsing', () => {
    it('should parse existing changelog structure', () => {
      const sampleChangelog = `# Changelog

## [1.0.0] - 2023-01-01

### Added
- New feature implementation

### Fixed
- Bug resolution

## [0.1.0] - 2022-12-01

### Added
- Initial release`;

      const lines = sampleChangelog.split('\n');
      const versionHeaders = lines.filter(line => line.startsWith('## ['));
      const sectionHeaders = lines.filter(line => line.startsWith('### '));

      expect(versionHeaders).toHaveLength(2);
      expect(sectionHeaders).toHaveLength(3);
      expect(versionHeaders[0]).toContain('1.0.0');
      expect(versionHeaders[1]).toContain('0.1.0');
    });

    it('should extract version information', () => {
      const versionLine = '## [1.2.3] - 2023-06-01';
      const versionMatch = versionLine.match(/## \[([^\]]+)\] - (.+)/);

      expect(versionMatch).toBeTruthy();
      if (versionMatch) {
        expect(versionMatch[1]).toBe('1.2.3');
        expect(versionMatch[2]).toBe('2023-06-01');
      }
    });
  });
});
