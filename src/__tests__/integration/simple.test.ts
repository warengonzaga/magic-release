/**
 * Simplified integration tests for Magic Release core functionality
 * Tests the main workflow without CLI complexity
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
const TEST_ANTHROPIC_KEY =
  'sk-ant-api03-abcdefghijklmnopqrstuvwxyz1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ';

describe('Magic Release Integration Tests', () => {
  let testDir: string;
  let originalCwd: string;

  beforeEach(async () => {
    originalCwd = process.cwd();
    testDir = await fs.mkdtemp(path.join(tmpdir(), 'magicrelease-integration-'));
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

  describe('Basic changelog generation', () => {
    it('should generate changelog from commit history', async () => {
      // Debug: check current working directory
      console.log('Current working directory:', process.cwd());

      // Debug: Check if git repository exists before setup
      const gitExistsBefore = await fs
        .access('.git')
        .then(() => true)
        .catch(() => false);
      console.log('Git repository exists before setup:', gitExistsBefore);

      // Set up test repository with tags
      await setupRepositoryWithTags();

      // Debug: Check if git repository exists after setup
      const gitExistsAfter = await fs
        .access('.git')
        .then(() => true)
        .catch(() => false);
      console.log('Git repository exists after setup:', gitExistsAfter);

      if (!gitExistsAfter) {
        throw new Error('Git repository was not created properly');
      }

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

      // Mock LLM response for individual commit message rephrasing
      const originalFetch = global.fetch;
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'Add new feature' } }],
        }),
      });

      const magicRelease = new MagicRelease(config, testDir);
      const changelog = await magicRelease.generate({
        dryRun: true,
        from: 'v1.0.0',
        to: 'v1.1.0',
      });

      // Restore original fetch
      global.fetch = originalFetch;

      expect(changelog).toContain('## [Unreleased]');
      expect(changelog).toContain('### Added'); // feat: commits go to Added
      expect(changelog).toContain('new feature'); // The commit that's actually being processed
      expect(changelog).toContain('Add new feature'); // Full description
    });

    it('should handle file writing in non-dry-run mode', async () => {
      await setupRepositoryWithTags();

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

      // Mock LLM response for individual commit message rephrasing
      const originalFetch = global.fetch;
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'Add new feature' } }],
        }),
      });

      const magicRelease = new MagicRelease(config, testDir);
      await magicRelease.generate({
        dryRun: false,
        from: 'v1.0.0',
        to: 'v1.1.0',
      });

      // Restore original fetch
      global.fetch = originalFetch;

      // Verify file was created
      const changelogExists = await fs
        .access('CHANGELOG.md')
        .then(() => true)
        .catch(() => false);
      expect(changelogExists).toBe(true);

      const content = await fs.readFile('CHANGELOG.md', 'utf-8');
      expect(content).toContain('## [Unreleased]');
      expect(content).toContain('new feature'); // The commit that's actually being processed
    });

    it('should handle commit range filtering', async () => {
      await setupRepositoryWithTags();

      // Debug: Check git state
      console.log('=== Git Debug Info ===');
      const { spawn } = require('child_process');

      // Check git log
      const gitLog = await new Promise<string>((resolve, reject) => {
        const child = spawn('git', ['log', '--oneline', '--all'], { stdio: 'pipe' });
        let output = '';
        child.stdout?.on('data', (data: Buffer) => {
          output += data.toString();
        });
        child.on('close', (code: number) => {
          code === 0 ? resolve(output) : reject(new Error(`git log failed: ${code}`));
        });
      });
      console.log('Git log:\n', gitLog);

      // Check git tags
      const gitTags = await new Promise<string>((resolve, reject) => {
        const child = spawn('git', ['tag', '-l'], { stdio: 'pipe' });
        let output = '';
        child.stdout?.on('data', (data: Buffer) => {
          output += data.toString();
        });
        child.on('close', (code: number) => {
          code === 0 ? resolve(output) : reject(new Error(`git tag failed: ${code}`));
        });
      });
      console.log('Git tags:\n', gitTags);

      // Check commits between tags
      const gitRange = await new Promise<string>((resolve, reject) => {
        const child = spawn('git', ['log', '--oneline', 'v1.0.0..v1.1.0'], { stdio: 'pipe' });
        let output = '';
        child.stdout?.on('data', (data: Buffer) => {
          output += data.toString();
        });
        child.on('close', (code: number) => {
          code === 0 ? resolve(output) : reject(new Error(`git range failed: ${code}`));
        });
      });
      console.log('Commits between v1.0.0 and v1.1.0:\n', gitRange);

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

      // Mock LLM response for individual commit message rephrasing
      const originalFetch = global.fetch;
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'Add new feature' } }],
        }),
      });

      const magicRelease = new MagicRelease(config, testDir);
      const changelog = await magicRelease.generate({
        from: 'v1.0.0',
        to: 'v1.1.0',
        dryRun: true,
      });

      // Restore original fetch
      global.fetch = originalFetch;

      console.log('Generated changelog:\n', changelog);
      expect(changelog).toContain('new feature'); // The commit that's actually being processed
    });
  });

  describe('Error handling', () => {
    it('should handle LLM API errors gracefully', async () => {
      await setupBasicRepository();

      const config: MagicReleaseConfig = {
        llm: {
          provider: 'openai',
          model: 'gpt-3.5-turbo',
          apiKey:
            'sk-proj-fakefakefakefakefakefakefakefakefakefakefakefakefakefakefakefakefakefakefake',
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

      const magicRelease = new MagicRelease(config, testDir);

      // Should handle error gracefully and still generate basic changelog
      const result = await magicRelease.generate({ dryRun: true });
      expect(result).toContain('# Changelog');

      // Restore original fetch
      global.fetch = originalFetch;
    });

    it('should handle repositories with no valid commits', async () => {
      // Set up empty repository (no commits)

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

      const magicRelease = new MagicRelease(config, testDir);

      // Should generate empty changelog instead of throwing
      const result = await magicRelease.generate({ dryRun: true });
      expect(result).toContain('# Changelog');
      expect(result).toContain(
        'All notable changes to this project will be documented in this file'
      );
    });
  });

  describe('Configuration validation', () => {
    it('should validate LLM configuration', async () => {
      await setupBasicRepository();

      const invalidConfig = {
        // Missing LLM configuration
        git: { tagPattern: 'v*' },
        changelog: { filename: 'CHANGELOG.md' },
      } as MagicReleaseConfig;

      expect(() => new MagicRelease(invalidConfig, testDir)).toThrow();
    });

    it('should work with different providers', async () => {
      await setupBasicRepository();

      const configs = [
        {
          llm: { provider: 'openai' as const, apiKey: TEST_API_KEY },
          git: { tagPattern: 'v*' },
          changelog: { filename: 'CHANGELOG.md' },
        },
        {
          llm: { provider: 'anthropic' as const, apiKey: TEST_ANTHROPIC_KEY },
          git: { tagPattern: 'v*' },
          changelog: { filename: 'CHANGELOG.md' },
        },
      ];

      configs.forEach(config => {
        expect(() => new MagicRelease(config, testDir)).not.toThrow();
      });
    });
  });
});

// Helper functions
async function execCommand(command: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'pipe' });

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

async function setupBasicRepository(): Promise<void> {
  await fs.writeFile(
    'package.json',
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

  await fs.writeFile('README.md', '# Test Project\n\nIntegration test project.');
  await execCommand('git', ['add', 'README.md']);
  await execCommand('git', ['commit', '-m', 'chore: initial setup']);
  await execCommand('git', ['tag', 'v1.0.0']);

  // Create src directory and add files
  await fs.mkdir('src', { recursive: true });

  await fs.writeFile('src/auth.js', 'export const auth = { login: () => {}, logout: () => {} };');
  await execCommand('git', ['add', 'src/auth.js']);
  await execCommand('git', ['commit', '-m', 'feat: add authentication system']);

  await fs.writeFile('src/user.js', 'export const user = { create: () => {}, update: () => {} };');
  await execCommand('git', ['add', 'src/user.js']);
  await execCommand('git', ['commit', '-m', 'feat: add user management features']);

  await fs.writeFile('src/security.js', 'export const security = { validate: () => true };');
  await execCommand('git', ['add', 'src/security.js']);
  await execCommand('git', ['commit', '-m', 'fix: resolve critical security vulnerability']);

  await fs.writeFile('src/performance.js', 'export const perf = { optimize: () => {} };');
  await execCommand('git', ['add', 'src/performance.js']);
  await execCommand('git', ['commit', '-m', 'perf: optimize performance issues']);
}

async function setupRepositoryWithTags(): Promise<void> {
  await fs.writeFile(
    'package.json',
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

  // Initial commit and v1.0.0 tag
  await fs.writeFile('README.md', '# Test Project\n\nIntegration test project.');
  await execCommand('git', ['add', 'README.md']);
  await execCommand('git', ['commit', '-m', 'chore: initial setup']);
  await execCommand('git', ['tag', 'v1.0.0']);

  // Add commits between v1.0.0 and v1.1.0
  await fs.mkdir('src', { recursive: true });

  await fs.writeFile('src/auth.js', 'export const auth = { login: () => {}, logout: () => {} };');
  await execCommand('git', ['add', 'src/auth.js']);
  await execCommand('git', ['commit', '-m', 'feat: add authentication system']);

  await fs.writeFile('src/user.js', 'export const user = { create: () => {}, update: () => {} };');
  await execCommand('git', ['add', 'src/user.js']);
  await execCommand('git', ['commit', '-m', 'feat: add user management features']);

  await fs.writeFile('src/security.js', 'export const security = { validate: () => true };');
  await execCommand('git', ['add', 'src/security.js']);
  await execCommand('git', ['commit', '-m', 'fix: resolve critical security vulnerability']);

  await fs.writeFile('src/performance.js', 'export const perf = { optimize: () => {} };');
  await execCommand('git', ['add', 'src/performance.js']);
  await execCommand('git', ['commit', '-m', 'perf: optimize performance issues']);

  // Add the new feature commit BEFORE tagging v1.1.0
  await fs.writeFile('src/feature.js', 'export const feature = { newFeature: () => {} };');
  await execCommand('git', ['add', 'src/feature.js']);
  await execCommand('git', ['commit', '-m', 'feat: add new feature']);

  // Tag as v1.1.0 - this includes all the commits above including the new feature
  await execCommand('git', ['tag', 'v1.1.0']);

  // Add more commits for future versions (after v1.1.0)
  await fs.writeFile('src/future.js', 'export const future = { futureFeature: () => {} };');
  await execCommand('git', ['add', 'src/future.js']);
  await execCommand('git', ['commit', '-m', 'feat: add future feature']);
}
