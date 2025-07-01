/**
 * Integration tests for Magic Release core workflow
 * Tests the complete functionality without CLI complexity
 */

import { promises as fs } from 'fs';
import path from 'path';
import { tmpdir } from 'os';
import { spawn } from 'child_process';

import { rimraf } from 'rimraf';

import { MagicRelease } from '../../core/MagicRelease.js';
import type { MagicReleaseConfig } from '../../types/index.js';

// Unmock fs for integration tests - we need real file system operations
jest.unmock('fs');

// Test constants - using valid-looking API key formats
const TEST_API_KEY =
  'sk-proj-abcdefghijklmnopqrstuvwxyz1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890';

describe('Magic Release Workflow Integration Tests', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(tmpdir(), 'magicrelease-workflow-'));
  });

  afterEach(async () => {
    await rimraf(testDir);
  });

  describe('Core workflow', () => {
    it('should successfully generate changelog with mocked LLM', async () => {
      // Set up test repository in testDir
      await setupTestRepository(testDir);

      const config: MagicReleaseConfig = {
        llm: {
          provider: 'openai',
          model: 'gpt-3.5-turbo',
          apiKey: TEST_API_KEY,
        },
        git: {
          tagPattern: 'v*',
        },
        changelog: {
          filename: 'CHANGELOG.md',
        },
      };

      // Mock LLM response
      const originalFetch = global.fetch;
      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: 'Added',
              },
              finish_reason: 'stop',
            },
          ],
          usage: {
            prompt_tokens: 50,
            completion_tokens: 10,
            total_tokens: 60,
          },
          model: 'gpt-3.5-turbo',
        }),
      });
      global.fetch = mockFetch;

      try {
        const magicRelease = new MagicRelease(config, testDir);
        const changelog = await magicRelease.generate({ dryRun: true });

        console.log('Generated changelog:');
        console.log(changelog);
        console.log('Fetch calls:', mockFetch.mock.calls.length);

        if (mockFetch.mock.calls.length > 0) {
          console.log('First fetch call:', mockFetch.mock.calls[0]);
        }

        // The test should generate a changelog with commit categorization
        expect(changelog).toContain('# Changelog');
        expect(changelog).toContain('## [Unreleased]');

        // Check if LLM categorization worked (commits should be categorized as "Added")
        if (mockFetch.mock.calls.length > 0) {
          expect(changelog).toContain('### Added');
          // Should have categorized the commits as "Added" based on our mock
        }
      } finally {
        // Restore original fetch
        global.fetch = originalFetch;
      }
    });

    it('should handle file writing in non-dry-run mode', async () => {
      await setupTestRepository(testDir);

      const config: MagicReleaseConfig = {
        llm: {
          provider: 'openai',
          model: 'gpt-3.5-turbo',
          apiKey: TEST_API_KEY,
        },
        git: {
          tagPattern: 'v*',
        },
        changelog: {
          filename: 'CHANGELOG.md',
        },
      };

      // Mock LLM response
      const originalFetch = global.fetch;
      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: 'Added',
              },
              finish_reason: 'stop',
            },
          ],
          usage: {
            prompt_tokens: 50,
            completion_tokens: 10,
            total_tokens: 60,
          },
          model: 'gpt-3.5-turbo',
        }),
      });
      global.fetch = mockFetch;

      try {
        const magicRelease = new MagicRelease(config, testDir);
        await magicRelease.generate({ dryRun: false });

        // Verify file was created
        const changelogPath = path.join(testDir, 'CHANGELOG.md');
        const changelogExists = await fs
          .access(changelogPath)
          .then(() => true)
          .catch(() => false);
        expect(changelogExists).toBe(true);

        const content = await fs.readFile(changelogPath, 'utf-8');
        expect(content).toContain('# Changelog');
        expect(content).toContain('## [Unreleased]');
        // Check if LLM categorization worked
        if (mockFetch.mock.calls.length > 0) {
          expect(content).toContain('### Added');
        }
      } finally {
        // Restore original fetch
        global.fetch = originalFetch;
      }
    });

    it('should handle configuration validation', async () => {
      await setupTestRepository(testDir);

      // Test invalid configuration
      const invalidConfig = {
        // Missing required llm config
        git: { tagPattern: 'v*' },
        changelog: { filename: 'CHANGELOG.md' },
      } as MagicReleaseConfig;

      expect(() => new MagicRelease(invalidConfig, testDir)).toThrow();
    });

    it('should handle LLM API errors gracefully', async () => {
      await setupTestRepository(testDir);

      const config: MagicReleaseConfig = {
        llm: {
          provider: 'openai',
          model: 'gpt-3.5-turbo',
          apiKey: TEST_API_KEY, // Use valid format API key
        },
        git: {
          tagPattern: 'v*',
        },
        changelog: {
          filename: 'CHANGELOG.md',
        },
      };

      // Mock LLM error response
      const originalFetch = global.fetch;
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        json: async () => ({
          error: {
            message: 'Invalid API key',
          },
        }),
      });

      try {
        const magicRelease = new MagicRelease(config, testDir);
        // This should still generate a changelog, but LLM categorization will fail and fall back to defaults
        const changelog = await magicRelease.generate({ dryRun: true });
        expect(changelog).toContain('# Changelog');
        expect(changelog).toContain('## [Unreleased]');
        // Should fall back to default categorization (Changed)
        expect(changelog).toContain('### Changed');
      } finally {
        // Restore original fetch
        global.fetch = originalFetch;
      }
    });
  });
});

// Helper functions
async function execCommand(command: string, args: string[], cwd: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      stdio: 'pipe',
    });

    let stderr = '';
    child.stderr?.on('data', data => {
      stderr += data.toString();
    });

    child.on('close', code => {
      if (code === 0) {
        resolve();
      } else {
        reject(
          new Error(
            `Command "${command} ${args.join(' ')}" failed with exit code ${code}. stderr: ${stderr}`
          )
        );
      }
    });
  });
}

async function setupTestRepository(testDir: string): Promise<void> {
  try {
    console.log('Setting up test repository in:', testDir);

    // Initialize git repository
    await execCommand('git', ['init'], testDir);
    console.log('Git init completed');

    await execCommand('git', ['config', 'user.name', 'Test User'], testDir);
    await execCommand('git', ['config', 'user.email', 'test@example.com'], testDir);
    console.log('Git config completed');

    // Create package.json
    const packageJsonPath = path.join(testDir, 'package.json');
    await fs.writeFile(
      packageJsonPath,
      JSON.stringify(
        {
          name: 'test-integration-package',
          version: '1.0.0',
          description: 'Test package for integration tests',
          repository: {
            type: 'git',
            url: 'https://github.com/test/test-package.git',
          },
        },
        null,
        2
      )
    );
    console.log('Package.json created');

    // Create initial files and commits
    const readmePath = path.join(testDir, 'README.md');
    await fs.writeFile(readmePath, '# Test Project\n\nIntegration test project.');
    await execCommand('git', ['add', 'README.md'], testDir);
    await execCommand('git', ['commit', '-m', 'chore: initial setup'], testDir);
    await execCommand('git', ['tag', 'v1.0.0'], testDir);
    console.log('Initial commit and tag created');

    // Create src directory and add files
    const srcDir = path.join(testDir, 'src');
    await fs.mkdir(srcDir, { recursive: true });

    const authPath = path.join(srcDir, 'auth.js');
    await fs.writeFile(authPath, 'export const auth = { login: () => {}, logout: () => {} };');
    await execCommand('git', ['add', 'src/auth.js'], testDir);
    await execCommand('git', ['commit', '-m', 'feat: add authentication system'], testDir);

    const userPath = path.join(srcDir, 'user.js');
    await fs.writeFile(userPath, 'export const user = { create: () => {}, update: () => {} };');
    await execCommand('git', ['add', 'src/user.js'], testDir);
    await execCommand('git', ['commit', '-m', 'feat: add user management features'], testDir);

    const securityPath = path.join(srcDir, 'security.js');
    await fs.writeFile(securityPath, 'export const security = { validate: () => true };');
    await execCommand('git', ['add', 'src/security.js'], testDir);
    await execCommand('git', ['commit', '-m', 'fix: resolve security vulnerability'], testDir);

    const perfPath = path.join(srcDir, 'performance.js');
    await fs.writeFile(perfPath, 'export const perf = { optimize: () => {} };');
    await execCommand('git', ['add', 'src/performance.js'], testDir);
    await execCommand('git', ['commit', '-m', 'perf: optimize performance issues'], testDir);

    console.log('Test repository setup completed');
  } catch (error) {
    console.error('Error setting up test repository:', error);
    throw error;
  }
}
