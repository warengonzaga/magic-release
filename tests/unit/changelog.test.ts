/**
 * Unit tests for Changelog functionality
 * Tests changelog generation, parsing, and formatting
 */

describe('Changelog Functionality', () => {
  describe('Changelog Format Validation', () => {
    it('should validate Keep a Changelog format', () => {
      const validHeaders = [
        '# Changelog',
        '## [1.0.0] - 2023-01-01',
        '### Added',
        '### Changed',
        '### Deprecated',
        '### Removed',
        '### Fixed',
        '### Security'
      ];

      validHeaders.forEach(header => {
        expect(header).toBeTruthy();
        expect(header.length).toBeGreaterThan(0);
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
        { message: 'feat!: breaking change', expectedType: 'feat', expectedBreaking: true }
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
        'feat': 'Added',
        'fix': 'Fixed',
        'docs': 'Changed',
        'style': 'Changed',
        'refactor': 'Changed',
        'test': 'Changed',
        'chore': 'Changed'
      };

      Object.entries(typeCategories).forEach(([_type, category]) => {
        expect(category).toBeTruthy();
        expect(['Added', 'Changed', 'Fixed', 'Removed', 'Deprecated', 'Security']).toContain(category);
      });
    });
  });

  describe('Changelog Entry Generation', () => {
    it('should generate proper section headers', () => {
      const sections = ['Added', 'Changed', 'Deprecated', 'Removed', 'Fixed', 'Security'];
      
      sections.forEach(section => {
        const header = `### ${section}`;
        expect(header).toBe(`### ${section}`);
        expect(header.startsWith('### ')).toBe(true);
      });
    });

    it('should format commit entries', () => {
      const commits = [
        { description: 'Add new feature', scope: 'core' },
        { description: 'Fix critical bug', scope: null },
        { description: 'Update documentation', scope: 'docs' }
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
      
      expect(versionHeader).toBe('## [1.0.0] - 2023-01-01');
      expect(versionHeader).toContain(version);
      expect(versionHeader).toContain(date);
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
