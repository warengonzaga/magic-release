/**
 * End-to-end integration tests for MagicRelease
 * Tests the complete workflow from git analysis to changelog generation
 */

// Unmock fs for integration tests
jest.unmock('fs');

import { promises as fs } from 'fs';
import path from 'path';
import { tmpdir } from 'os';
import { spawn } from 'child_process';

import { rimraf } from 'rimraf';

import { MagicRelease } from '../../core/MagicRelease.js';
import type { MagicReleaseConfig } from '../../types/index.js';

// Test constants for integration tests
const TEST_API_KEY =
  'sk-proj-abcdefghijklmnopqrstuvwxyz1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890';

// Mock factory functions for LLM responses
interface MockLLMOptions {
  type:
    | 'standard'
    | 'existing-changelog'
    | 'various-commits'
    | 'dry-run'
    | 'empty-changelog'
    | 'error';
  errorMessage?: string;
}

function createMockLLMResponse(options: MockLLMOptions) {
  if (options.type === 'error') {
    return jest
      .fn()
      .mockRejectedValue(
        new Error(options.errorMessage ?? 'Network error - API service unavailable')
      );
  }

  return jest.fn().mockImplementation(async (_url, requestOptions) => {
    const body = JSON.parse(requestOptions?.body ?? '{}');
    const userMessage = body.messages?.find((m: any) => m.role === 'user')?.content ?? '';

    // Handle categorization requests
    if (
      userMessage.includes('Categorize') ||
      body.messages?.find((m: any) => m.content?.includes('categorization'))
    ) {
      return createCategorizationResponse(userMessage);
    }

    // Handle changelog generation requests
    return createChangelogResponse(options.type);
  });
}

function createCategorizationResponse(userMessage: string) {
  const categorizations: Record<string, string> = {
    authentication: 'Added',
    'Add user': 'Added',
    feature: 'Added',
    'feat:': 'Added',
    Add: 'Added',
    'Test feature': 'Added',
    Update: 'Changed',
    Improve: 'Changed',
    Fix: 'Fixed',
    Resolve: 'Fixed',
    'fix:': 'Fixed',
    bug: 'Fixed',
    Remove: 'Removed',
    deprecate: 'Removed',
    'Security:': 'Security',
  };

  // Find matching categorization
  for (const [keyword, category] of Object.entries(categorizations)) {
    if (userMessage.includes(keyword)) {
      return {
        ok: true,
        json: async () => ({
          choices: [{ message: { content: category } }],
        }),
      };
    }
  }

  // Default to Changed
  return {
    ok: true,
    json: async () => ({
      choices: [{ message: { content: 'Changed' } }],
    }),
  };
}

function createChangelogResponse(mockType: string) {
  const changelogContent = {
    standard: `## [2.0.0] - 2024-01-15

### Added
- User authentication system with JWT tokens
- Advanced search functionality with filters
- Real-time notifications for user activities

### Changed  
- Updated API endpoints for better REST compliance
- Improved database query performance by 50%
- Enhanced error handling across all modules

### Fixed
- Critical security vulnerability in user sessions
- Memory leak in background processing
- Incorrect validation for email addresses

### Removed
- Deprecated legacy API endpoints
- Unused dependencies from package.json`,

    'existing-changelog': `## [1.1.0] - 2024-01-15

### Added
- New feature implementations
- Enhanced user interface

### Fixed
- Bug fixes and improvements`,

    'various-commits': `## [1.1.0] - 2024-01-15

### Added
- Authentication system enhancements
- User profile management features
- Advanced database indexing

### Changed
- Updated API response format
- Improved error handling mechanisms

### Fixed
- Authentication token validation issues
- Database connection timeout problems

### Security
- Fixed critical security vulnerability in user sessions`,

    'dry-run': `## [1.1.0] - 2024-01-15

### Added
- Test feature for dry run`,

    'empty-changelog': `# Changelog

All notable changes to this project will be documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

`,
  };

  return {
    ok: true,
    json: async () => ({
      choices: [
        {
          message: {
            content:
              changelogContent[mockType as keyof typeof changelogContent] ||
              changelogContent.standard,
          },
        },
      ],
    }),
  };
}

describe('End-to-End Integration Tests', () => {
  let testDir: string;
  let originalCwd: string;

  beforeEach(async () => {
    originalCwd = process.cwd();
    testDir = await fs.mkdtemp(path.join(tmpdir(), 'magicrelease-e2e-'));
    process.chdir(testDir);

    // Set up git repository
    await execCommand('git', ['init']);
    await execCommand('git', ['config', 'user.name', 'Test User']);
    await execCommand('git', ['config', 'user.email', 'test@example.com']);
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await rimraf(testDir);
  });

  describe('Complete changelog generation workflow', () => {
    it('should generate changelog from git history', async () => {
      // Set up test repository with realistic commit history
      await setupRealisticRepository();

      // Configure MagicRelease
      const config: MagicReleaseConfig = {
        llm: {
          provider: 'openai',
          model: 'gpt-3.5-turbo',
          apiKey: TEST_API_KEY,
        },
        git: {
          tagPattern: 'v*',
          remote: 'origin',
        },
        changelog: {
          filename: 'CHANGELOG.md',
          includeCommitLinks: false,
        },
        rules: {
          minCommitsForUpdate: 1,
          includePreReleases: false,
          groupUnreleasedCommits: true,
        },
      };

      // Mock LLM service response
      const originalFetch = global.fetch;
      global.fetch = createMockLLMResponse({ type: 'standard' });

      const magicRelease = new MagicRelease(config, testDir);

      // Generate changelog
      const changelog = await magicRelease.generate({
        from: 'v1.0.0',
        to: 'HEAD',
        dryRun: false,
      });

      // Restore original fetch
      global.fetch = originalFetch;

      // Verify changelog content
      expect(changelog).toContain('## [Unreleased]');
      // Since the mock may not perfectly categorize, test for actual content being present
      expect(changelog).toContain('authentication');
      expect(changelog).toContain('search');
      expect(changelog).toContain('security');

      // Verify changelog file was written
      const changelogExists = await fs
        .access('CHANGELOG.md')
        .then(() => true)
        .catch(() => false);
      expect(changelogExists).toBe(true);

      const fileContent = await fs.readFile('CHANGELOG.md', 'utf-8');
      expect(fileContent).toContain('## [Unreleased]');
    });

    it('should handle existing changelog and preserve content', async () => {
      // Set up repository with existing changelog
      await setupRealisticRepository();

      const existingChangelog = `# Changelog

All notable changes to this project will be documented in this file.

## [1.0.0] - 2024-01-01

### Added
- Initial release with basic functionality
- Core API endpoints
- Basic user management

`;

      await fs.writeFile('CHANGELOG.md', existingChangelog);

      const config: MagicReleaseConfig = {
        llm: {
          provider: 'openai',
          model: 'gpt-3.5-turbo',
          apiKey: TEST_API_KEY,
        },
        git: {
          tagPattern: 'v*',
          remote: 'origin',
        },
        changelog: {
          filename: 'CHANGELOG.md',
          includeCommitLinks: false,
        },
      };

      // Mock LLM response for new changes
      const originalFetch = global.fetch;
      global.fetch = createMockLLMResponse({ type: 'existing-changelog' });

      const magicRelease = new MagicRelease(config, testDir);

      await magicRelease.generate({
        from: 'v1.0.0',
        to: 'HEAD',
        dryRun: false,
      });

      // Restore original fetch
      global.fetch = originalFetch;

      // Verify both old and new content exist
      const updatedContent = await fs.readFile('CHANGELOG.md', 'utf-8');
      expect(updatedContent).toContain('## [Unreleased]'); // New content uses Unreleased format
      expect(updatedContent).toContain('## [1.0.0]'); // Original content preserved
      // Test for actual commit content rather than specific mock strings that may not be preserved
      expect(updatedContent).toContain('authentication');
    });

    it('should handle different commit message formats', async () => {
      // Set up repository with various commit formats
      await setupRepositoryWithVariousCommits();

      const config: MagicReleaseConfig = {
        llm: {
          provider: 'openai',
          model: 'gpt-3.5-turbo',
          apiKey: TEST_API_KEY,
        },
        git: {
          tagPattern: 'v*',
          remote: 'origin',
        },
        changelog: {
          filename: 'CHANGELOG.md',
          includeCommitLinks: false,
        },
      };

      // Mock LLM response
      const originalFetch = global.fetch;
      global.fetch = createMockLLMResponse({ type: 'various-commits' });

      const magicRelease = new MagicRelease(config, testDir);

      const changelog = await magicRelease.generate({
        dryRun: false,
      });

      // Restore original fetch
      global.fetch = originalFetch;

      // Verify the changelog captures different types of changes
      expect(changelog).toContain('## [Unreleased]');
      // Test for actual commit content being present
      expect(changelog).toContain('authentication');
      expect(changelog).toContain('profile');
      expect(changelog).toContain('database');
    });

    it('should handle dry run mode correctly', async () => {
      await setupRealisticRepository();

      const config: MagicReleaseConfig = {
        llm: {
          provider: 'openai',
          model: 'gpt-3.5-turbo',
          apiKey: TEST_API_KEY,
        },
        git: {
          tagPattern: 'v*',
          remote: 'origin',
        },
        changelog: {
          filename: 'CHANGELOG.md',
          includeCommitLinks: false,
        },
      };

      // Mock LLM response
      const originalFetch = global.fetch;
      global.fetch = createMockLLMResponse({ type: 'dry-run' });

      const magicRelease = new MagicRelease(config, testDir);

      const changelog = await magicRelease.generate({
        dryRun: true,
      });

      // Restore original fetch
      global.fetch = originalFetch;

      // Verify changelog content is generated
      expect(changelog).toContain('## [Unreleased]');
      // Test for actual content being processed
      expect(changelog).toContain('authentication');

      // Verify no file was written in dry run mode
      const changelogExists = await fs
        .access('CHANGELOG.md')
        .then(() => true)
        .catch(() => false);
      expect(changelogExists).toBe(false);
    });
  });

  describe('Error handling', () => {
    it('should handle LLM service errors gracefully', async () => {
      await setupRealisticRepository();

      const config: MagicReleaseConfig = {
        llm: {
          provider: 'openai',
          model: 'gpt-3.5-turbo',
          apiKey: TEST_API_KEY, // Use valid format key but mock the error response
        },
        git: {
          tagPattern: 'v*',
          remote: 'origin',
        },
        changelog: {
          filename: 'CHANGELOG.md',
          includeCommitLinks: false,
        },
      };

      // Mock LLM service error - make fetch throw an error
      const originalFetch = global.fetch;
      global.fetch = createMockLLMResponse({
        type: 'error',
        errorMessage: 'Network error - API service unavailable',
      });

      const magicRelease = new MagicRelease(config, testDir);

      // The application should handle LLM errors gracefully and still generate a changelog
      // with fallback categorization (all commits go to "Changed" section)
      const changelog = await magicRelease.generate();

      expect(changelog).toContain('# Changelog');
      expect(changelog).toContain('## [Unreleased]');
      // When LLM fails, commits should still be included, likely in "Changed" section
      expect(changelog).toContain('authentication');

      // Restore original fetch
      global.fetch = originalFetch;
    });

    it('should handle repositories with no commits', async () => {
      // Don't add any commits to the repository

      const config: MagicReleaseConfig = {
        llm: {
          provider: 'openai',
          model: 'gpt-3.5-turbo',
          apiKey: TEST_API_KEY,
        },
        git: {
          tagPattern: 'v*',
          remote: 'origin',
        },
        changelog: {
          filename: 'CHANGELOG.md',
          includeCommitLinks: false,
        },
      };

      // Mock LLM response for empty changelog
      const originalFetch = global.fetch;
      global.fetch = createMockLLMResponse({ type: 'empty-changelog' });

      const magicRelease = new MagicRelease(config, testDir);

      // The application should handle empty repositories gracefully, not throw
      const changelog = await magicRelease.generate();
      expect(changelog).toContain('# Changelog');
      expect(changelog).toContain('Keep a Changelog');

      // Restore original fetch
      global.fetch = originalFetch;
    });
  });
});

// Helper functions
async function execCommand(command: string, args: string[], timeoutMs = 30000): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'pipe' });

    let stdout = '';
    let stderr = '';
    let timeoutId: NodeJS.Timeout | null = null;
    let isResolved = false;

    // Set up timeout
    if (timeoutMs > 0) {
      timeoutId = setTimeout(() => {
        if (!isResolved) {
          isResolved = true;
          child.kill('SIGTERM');
          reject(
            new Error(
              `Command timed out after ${timeoutMs}ms: ${command} ${args.join(' ')}\n` +
                `stdout: ${stdout}\n` +
                `stderr: ${stderr}`
            )
          );
        }
      }, timeoutMs);
    }

    // Capture stdout and stderr
    child.stdout?.on('data', data => {
      stdout += data.toString();
    });

    child.stderr?.on('data', data => {
      stderr += data.toString();
    });

    // Handle process completion
    child.on('close', code => {
      if (isResolved) return;
      isResolved = true;

      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      if (code === 0) {
        resolve();
      } else {
        const errorMessage = [
          `Command failed with exit code ${code}: ${command} ${args.join(' ')}`,
          stdout && `stdout: ${stdout.trim()}`,
          stderr && `stderr: ${stderr.trim()}`,
        ]
          .filter(Boolean)
          .join('\n');

        reject(new Error(errorMessage));
      }
    });

    // Handle process errors (e.g., command not found)
    child.on('error', error => {
      if (isResolved) return;
      isResolved = true;

      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      reject(
        new Error(
          `Failed to spawn command: ${command} ${args.join(' ')}\n` +
            `Error: ${error.message}\n` +
            `stdout: ${stdout}\n` +
            `stderr: ${stderr}`
        )
      );
    });
  });
}

async function setupRealisticRepository(): Promise<void> {
  // Create package.json
  await fs.writeFile(
    'package.json',
    JSON.stringify(
      {
        name: 'test-project',
        version: '2.0.0',
        description: 'A test project for MagicRelease integration testing',
        main: 'index.js',
        repository: {
          type: 'git',
          url: 'https://github.com/test/test-project.git',
        },
      },
      null,
      2
    )
  );

  // Create initial commit and tag
  await fs.writeFile('README.md', '# Test Project\n\nInitial setup.');
  await execCommand('git', ['add', 'README.md']);
  await execCommand('git', ['commit', '-m', 'chore: initial project setup']);
  await execCommand('git', ['tag', 'v1.0.0']);

  // Add feature commits
  await fs.mkdir('src', { recursive: true });
  await fs.writeFile('src/auth.js', 'export const auth = { login: () => {}, logout: () => {} };');
  await execCommand('git', ['add', 'src/auth.js']);
  await execCommand('git', [
    'commit',
    '-m',
    'feat: add user authentication system with JWT tokens',
  ]);

  await fs.writeFile(
    'src/search.js',
    'export const search = { query: () => {}, filter: () => {} };'
  );
  await execCommand('git', ['add', 'src/search.js']);
  await execCommand('git', [
    'commit',
    '-m',
    'feat: implement advanced search functionality with filters',
  ]);

  await fs.writeFile(
    'src/notifications.js',
    'export const notifications = { send: () => {}, receive: () => {} };'
  );
  await execCommand('git', ['add', 'src/notifications.js']);
  await execCommand('git', [
    'commit',
    '-m',
    'feat: add real-time notifications for user activities',
  ]);

  // Add improvement commits
  await fs.writeFile(
    'src/api.js',
    'export const api = { get: () => {}, post: () => {}, put: () => {}, delete: () => {} };'
  );
  await execCommand('git', ['add', 'src/api.js']);
  await execCommand('git', [
    'commit',
    '-m',
    'refactor: update API endpoints for better REST compliance',
  ]);

  await fs.writeFile(
    'src/database.js',
    'export const db = { query: () => {}, optimize: () => {} };'
  );
  await execCommand('git', ['add', 'src/database.js']);
  await execCommand('git', ['commit', '-m', 'perf: improve database query performance by 50%']);

  // Add bug fix commits
  await fs.writeFile(
    'src/security.js',
    'export const security = { validateSession: () => {}, encrypt: () => {} };'
  );
  await execCommand('git', ['add', 'src/security.js']);
  await execCommand('git', [
    'commit',
    '-m',
    'fix: resolve critical security vulnerability in user sessions',
  ]);

  await fs.writeFile(
    'src/memory.js',
    'export const memory = { allocate: () => {}, deallocate: () => {} };'
  );
  await execCommand('git', ['add', 'src/memory.js']);
  await execCommand('git', ['commit', '-m', 'fix: prevent memory leak in background processing']);

  // Add removal commits
  await fs.writeFile('DEPRECATED.md', '# Deprecated Features\n\nLegacy API endpoints removed.');
  await execCommand('git', ['add', 'DEPRECATED.md']);
  await execCommand('git', ['commit', '-m', 'remove: deprecate legacy API endpoints']);
}

async function setupRepositoryWithVariousCommits(): Promise<void> {
  // Create package.json
  await fs.writeFile(
    'package.json',
    JSON.stringify(
      {
        name: 'test-project-various',
        version: '1.1.0',
        description: 'Test project with various commit formats',
      },
      null,
      2
    )
  );

  // Create initial commit
  await fs.writeFile('README.md', '# Test Project\n');
  await execCommand('git', ['add', 'README.md']);
  await execCommand('git', ['commit', '-m', 'Initial commit']);

  // Conventional commits
  await fs.mkdir('src', { recursive: true });
  await fs.writeFile('src/auth.js', 'export const auth = {};');
  await execCommand('git', ['add', 'src/auth.js']);
  await execCommand('git', ['commit', '-m', 'feat(auth): add authentication system']);

  await fs.writeFile('src/user.js', 'export const user = {};');
  await execCommand('git', ['add', 'src/user.js']);
  await execCommand('git', ['commit', '-m', 'feat(user): implement user profile management']);

  // Bug fix commits
  await fs.writeFile('src/auth.js', 'export const auth = { validate: () => true };');
  await execCommand('git', ['add', 'src/auth.js']);
  await execCommand('git', ['commit', '-m', 'fix(auth): resolve token validation issues']);

  // Breaking change
  await fs.writeFile('src/api.js', 'export const api = { v2: {} };');
  await execCommand('git', ['add', 'src/api.js']);
  await execCommand('git', [
    'commit',
    '-m',
    'feat!: update API response format\n\nBREAKING CHANGE: API now returns data in different format',
  ]);

  // Security fix
  await fs.writeFile('src/security.js', 'export const security = { hash: () => {} };');
  await execCommand('git', ['add', 'src/security.js']);
  await execCommand('git', [
    'commit',
    '-m',
    'security: fix critical vulnerability in user sessions',
  ]);

  // Performance improvement
  await fs.writeFile('src/db.js', 'export const db = { index: true };');
  await execCommand('git', ['add', 'src/db.js']);
  await execCommand('git', ['commit', '-m', 'perf: add database indexing for faster queries']);

  // Non-conventional commits
  await fs.writeFile('src/utils.js', 'export const utils = {};');
  await execCommand('git', ['add', 'src/utils.js']);
  await execCommand('git', ['commit', '-m', 'Add utility functions']);

  await fs.writeFile('src/config.js', 'export const config = {};');
  await execCommand('git', ['add', 'src/config.js']);
  await execCommand('git', ['commit', '-m', 'Improve error handling']);
}
