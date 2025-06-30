/**
 * Unit tests for Git functionality
 * Tests git operations, commit parsing, and tag management
 */

import { GitService } from '../../core/git/GitService.js';
import { CommitParser } from '../../core/git/CommitParser.js';
import { TagManager } from '../../core/git/TagManager.js';
import type { GitCommit, GitTag } from '../../types/index.js';

// Mock child_process and fs for testing
jest.mock('child_process');
jest.mock('fs');

const mockExecSync = jest.fn();
const mockExistsSync = jest.fn();

// Set up mocks
beforeEach(() => {
  const { execSync } = require('child_process');
  const { existsSync } = require('fs');

  execSync.mockImplementation(mockExecSync);
  existsSync.mockImplementation(mockExistsSync);

  // Default to valid git repository
  mockExistsSync.mockReturnValue(true);
  mockExecSync.mockReturnValue('');
});

afterEach(() => {
  jest.clearAllMocks();
});

describe('Git Operations', () => {
  describe('GitService', () => {
    it('should validate git repository structure on initialization', () => {
      mockExistsSync.mockReturnValue(true);

      expect(() => new GitService('/test/repo')).not.toThrow();
      expect(mockExistsSync).toHaveBeenCalledWith(expect.stringContaining('.git'));
    });

    it('should throw error when not in a git repository', () => {
      mockExistsSync.mockReturnValue(false);

      expect(() => new GitService('/test/invalid')).toThrow('Not a Git repository');
    });

    it('should get commits between references', () => {
      const mockCommitOutput =
        'abc123|feat: add feature|Added new authentication|John Doe|john@example.com|2023-06-01 10:00:00 +0000|John Doe|john@example.com|2023-06-01 10:00:00 +0000\n' +
        'def456|fix: bug fix|Fixed authentication issue|Jane Smith|jane@example.com|2023-06-02 11:00:00 +0000|Jane Smith|jane@example.com|2023-06-02 11:00:00 +0000';

      mockExecSync.mockReturnValue(mockCommitOutput);

      const gitService = new GitService('/test/repo');
      const commits = gitService.getCommitsBetween('v1.0.0', 'HEAD');

      expect(commits).toHaveLength(2);
      expect(commits[0]?.hash).toBe('abc123');
      expect(commits[0]?.subject).toBe('feat: add feature');
      expect(commits[0]?.author.name).toBe('John Doe');
      expect(commits[1]?.hash).toBe('def456');
      expect(commits[1]?.subject).toBe('fix: bug fix');
    });

    it('should get all tags from repository', () => {
      const mockTagOutput =
        'v2.0.0|2023-06-15 10:00:00 +0000|Release v2.0.0\n' +
        'v1.0.0|2023-06-01 10:00:00 +0000|Initial release';

      mockExecSync.mockReturnValue(mockTagOutput);

      const gitService = new GitService('/test/repo');
      const tags = gitService.getAllTags();

      expect(tags).toHaveLength(2);
      expect(tags[0]?.name).toBe('v2.0.0');
      expect(tags[1]?.name).toBe('v1.0.0');
    });

    it('should check if reference exists', () => {
      mockExecSync.mockReturnValue('exists');

      const gitService = new GitService('/test/repo');
      const exists = gitService.referenceExists('v1.0.0');

      expect(exists).toBe(true);
      expect(mockExecSync).toHaveBeenCalledWith(
        'git rev-parse --verify v1.0.0',
        expect.any(Object)
      );
    });

    it('should get current branch name', () => {
      mockExecSync.mockReturnValue('main');

      const gitService = new GitService('/test/repo');
      const branch = gitService.getCurrentBranch();

      expect(branch).toBe('main');
      expect(mockExecSync).toHaveBeenCalledWith('git branch --show-current', expect.any(Object));
    });
  });

  describe('CommitParser', () => {
    let commitParser: CommitParser;

    beforeEach(() => {
      commitParser = new CommitParser();
    });

    it('should parse conventional commit messages correctly', () => {
      const testCommit: GitCommit = {
        hash: 'abc123',
        subject: 'feat: add new authentication system',
        body: 'Added OAuth2 authentication',
        author: {
          name: 'John Doe',
          email: 'john@example.com',
          date: new Date('2023-06-01T10:00:00Z'),
        },
        committer: {
          name: 'John Doe',
          email: 'john@example.com',
          date: new Date('2023-06-01T10:00:00Z'),
        },
      };

      const result = commitParser.parseCommit(testCommit);

      expect(result.type).toBe('feat');
      expect(result.description).toBe('add new authentication system');
      expect(result.scope).toBeUndefined();
      expect(result.breaking).toBe(false);
      expect(result.category).toBe('Added');
    });

    it('should parse commit with scope correctly', () => {
      const testCommit: GitCommit = {
        hash: 'def456',
        subject: 'fix(api): resolve user login issue',
        body: '',
        author: {
          name: 'Jane Smith',
          email: 'jane@example.com',
          date: new Date('2023-06-02T14:30:00Z'),
        },
        committer: {
          name: 'Jane Smith',
          email: 'jane@example.com',
          date: new Date('2023-06-02T14:30:00Z'),
        },
      };

      const result = commitParser.parseCommit(testCommit);

      expect(result.type).toBe('fix');
      expect(result.scope).toBe('api');
      expect(result.description).toBe('resolve user login issue');
      expect(result.category).toBe('Fixed');
    });

    it('should detect breaking changes', () => {
      const testCommit: GitCommit = {
        hash: 'ghi789',
        subject: 'feat!: migrate to new database schema',
        body: 'BREAKING CHANGE: removed old user table',
        author: {
          name: 'Bob Johnson',
          email: 'bob@example.com',
          date: new Date('2023-06-03T09:00:00Z'),
        },
        committer: {
          name: 'Bob Johnson',
          email: 'bob@example.com',
          date: new Date('2023-06-03T09:00:00Z'),
        },
      };

      const result = commitParser.parseCommit(testCommit);

      expect(result.type).toBe('feat');
      expect(result.breaking).toBe(true);
      expect(result.category).toBe('Added');
    });
  });

  describe('TagManager', () => {
    let tagManager: TagManager;

    beforeEach(() => {
      tagManager = new TagManager('/test/repo');
    });

    it('should extract version from tag correctly', () => {
      expect(tagManager.extractVersion('v1.0.0')).toBe('1.0.0');
      expect(tagManager.extractVersion('1.2.3')).toBe('1.2.3');
      expect(tagManager.extractVersion('release-2.0.0')).toBe('2.0.0');
      expect(tagManager.extractVersion('version-3.1.0')).toBe('3.1.0');
      expect(tagManager.extractVersion('invalid-tag')).toBeNull();
    });

    it('should detect pre-release versions', () => {
      expect(tagManager.isPreReleaseVersion('1.0.0-alpha')).toBe(true);
      expect(tagManager.isPreReleaseVersion('2.0.0-beta.1')).toBe(true);
      expect(tagManager.isPreReleaseVersion('1.0.0-rc.1')).toBe(true);
      expect(tagManager.isPreReleaseVersion('1.0.0')).toBe(false);
      expect(tagManager.isPreReleaseVersion('2.1.3')).toBe(false);
    });

    it('should format tag names with prefix', () => {
      expect(tagManager.formatTagName('1.0.0')).toBe('v1.0.0');
      expect(tagManager.formatTagName('2.1.3', 'release-')).toBe('release-2.1.3');
      expect(tagManager.formatTagName('1.0.0', '')).toBe('1.0.0');
    });

    it('should convert GitTag to Tag', () => {
      const gitTag: GitTag = {
        name: 'v1.0.0',
        date: new Date('2023-06-01T10:00:00Z'),
        subject: 'Release v1.0.0',
      };

      const tag = tagManager.convertGitTagToTag(gitTag);

      expect(tag).not.toBeNull();
      expect(tag?.name).toBe('v1.0.0');
      expect(tag?.version).toBe('1.0.0');
      expect(tag?.isPreRelease).toBe(false);
    });
  });

  describe('Integration Tests', () => {
    it('should handle empty repository gracefully', () => {
      mockExecSync.mockImplementation(() => {
        throw new Error('unknown revision or path not in the working tree');
      });

      const gitService = new GitService('/test/repo');
      const commits = gitService.getCommitsBetween('nonexistent-tag', 'HEAD');

      expect(commits).toHaveLength(0);
    });

    it('should parse complex commit scenarios with CommitParser', () => {
      const complexCommits: GitCommit[] = [
        {
          hash: 'abc123',
          subject: 'feat(auth)!: implement OAuth2 authentication',
          body: 'BREAKING CHANGE: removed basic auth\n\nFixes #123\nCloses #456',
          author: {
            name: 'John Doe',
            email: 'john@example.com',
            date: new Date('2023-06-01T10:00:00Z'),
          },
          committer: {
            name: 'John Doe',
            email: 'john@example.com',
            date: new Date('2023-06-01T10:00:00Z'),
          },
        },
        {
          hash: 'def456',
          subject: 'docs: update README with new API documentation',
          body: 'Added examples for OAuth2 flow',
          author: {
            name: 'Jane Smith',
            email: 'jane@example.com',
            date: new Date('2023-06-02T14:30:00Z'),
          },
          committer: {
            name: 'Jane Smith',
            email: 'jane@example.com',
            date: new Date('2023-06-02T14:30:00Z'),
          },
        },
      ];

      const commitParser = new CommitParser();
      const categorizedCommits = commitParser.parseCommits(complexCommits);

      expect(categorizedCommits.has('Added')).toBe(true);
      expect(categorizedCommits.has('Changed')).toBe(true);

      const addedCommits = categorizedCommits.get('Added') ?? [];
      const changedCommits = categorizedCommits.get('Changed') ?? [];

      expect(addedCommits.length).toBeGreaterThan(0);
      expect(changedCommits.length).toBeGreaterThan(0);
    });

    it('should work with TagManager for version planning', () => {
      const tagManager = new TagManager('/test/repo');
      const commitTypes = ['feat', 'fix', 'docs'];

      const versionPlan = tagManager.suggestNextVersion([], commitTypes);

      expect(versionPlan.isFirstRelease).toBe(true);
      expect(versionPlan.nextVersion).toBe('1.0.0');
      expect(versionPlan.releaseType).toBe('major');
    });
  });
});
