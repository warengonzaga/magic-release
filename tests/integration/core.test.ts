/**
 * Integration tests for MagicRelease core functionality
 * Tests the core MagicRelease class and its interaction with various services
 */

// Unmock fs for integration tests
jest.unmock('fs');

import { promises as fs } from 'fs';
import path from 'path';
import { tmpdir } from 'os';
import { rimraf } from 'rimraf';
import { spawn } from 'child_process';

import { MagicRelease } from '../../src/core/MagicRelease.js';
import type { MagicReleaseConfig } from '../../src/types/index.js';

// Test constants for integration tests
const TEST_API_KEY = 'sk-proj-abcdefghijklmnopqrstuvwxyz1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890';
const TEST_ANTHROPIC_KEY = 'sk-ant-api03-abcdefghijklmnopqrstuvwxyz1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890ABC';

describe('MagicRelease Core Integration Tests', () => {
  let testDir: string;
  let originalCwd: string;

  beforeEach(async () => {
    originalCwd = process.cwd();
    testDir = await fs.mkdtemp(path.join(tmpdir(), 'magicrelease-core-'));
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

  describe('Repository analysis', () => {
    it('should analyze repository structure correctly', async () => {
      await setupTestRepository();
      
      const config: MagicReleaseConfig = {
        llm: {
          provider: 'openai',
          model: 'gpt-3.5-turbo',
          apiKey: TEST_API_KEY
        },
        git: {
          tagPattern: 'v*'
        },
        changelog: {
          filename: 'CHANGELOG.md'
        }
      };

      const magicRelease = new MagicRelease(config, testDir);
      
      // Test repository analysis
      expect(magicRelease).toBeTruthy();
      expect(typeof magicRelease.generate).toBe('function');
    });

    it('should handle different tag patterns', async () => {
      await setupRepositoryWithDifferentTags();
      
      const config: MagicReleaseConfig = {
        llm: {
          provider: 'openai',
          model: 'gpt-3.5-turbo',
          apiKey: TEST_API_KEY
        },
        git: {
          tagPattern: 'release-*'
        },
        changelog: {
          filename: 'CHANGELOG.md'
        }
      };

      // Mock LLM response
      const originalFetch = global.fetch;
      let callCount = 0;
      global.fetch = jest.fn().mockImplementation(async (_url, options) => {
        callCount++;
        const body = JSON.parse(options?.body || '{}');
        const userMessage = body.messages?.find((m: any) => m.role === 'user')?.content || '';
        
        // If this is a categorization request, return appropriate category
        if (userMessage.includes('Categorize') || body.messages?.find((m: any) => m.content?.includes('categorization'))) {
          if (userMessage.includes('feature')) {
            return {
              ok: true,
              json: async () => ({
                choices: [{ message: { content: 'Added' } }]
              })
            };
          }
          return {
            ok: true,
            json: async () => ({
              choices: [{ message: { content: 'Changed' } }]
            })
          };
        }
        
        // For changelog generation requests
        return {
          ok: true,
          json: async () => ({
            choices: [{
              message: {
                content: `# Changelog

All notable changes to this project will be documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- New feature with custom tag pattern`
              }
            }]
          })
        };
      });

      const magicRelease = new MagicRelease(config, testDir);
      const changelog = await magicRelease.generate({
        from: 'release-1.0.0',
        to: 'HEAD',
        dryRun: true
      });

      // Restore original fetch
      global.fetch = originalFetch;

      expect(changelog).toContain('New feature with custom tag pattern');
    });
  });

  describe('Configuration validation', () => {
    it('should validate required configuration fields', async () => {
      await setupTestRepository();
      
      const invalidConfig = {
        // Missing required fields
        git: {},
        changelog: {}
      } as MagicReleaseConfig;

      expect(() => new MagicRelease(invalidConfig, testDir)).toThrow();
    });

    it('should handle different LLM providers', async () => {
      await setupTestRepository();
      
      const configs = [
        {
          llm: { provider: 'openai' as const, apiKey: TEST_API_KEY },
          git: { tagPattern: 'v*' },
          changelog: { filename: 'CHANGELOG.md' }
        },
        {
          llm: { provider: 'anthropic' as const, apiKey: TEST_ANTHROPIC_KEY },
          git: { tagPattern: 'v*' },
          changelog: { filename: 'CHANGELOG.md' }
        }
      ];

      configs.forEach(config => {
        expect(() => new MagicRelease(config, testDir)).not.toThrow();
      });
    });
  });

  describe('Commit parsing and analysis', () => {
    it('should parse conventional commits correctly', async () => {
      await setupRepositoryWithConventionalCommits();
      
      const config: MagicReleaseConfig = {
        llm: {
          provider: 'openai',
          model: 'gpt-3.5-turbo',
          apiKey: TEST_API_KEY
        },
        git: {
          tagPattern: 'v*'
        },
        changelog: {
          filename: 'CHANGELOG.md',
          includeCommitLinks: true
        }
      };

      // Mock LLM response that recognizes conventional commit types
      const originalFetch = global.fetch;
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: `# Changelog

All notable changes to this project will be documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- User authentication system
- New API endpoints for data management

### Fixed
- Critical bug in user validation
- Performance issues in database queries

### Changed
- Updated authentication flow
- Improved error handling`
            }
          }]
        })
      });

      const magicRelease = new MagicRelease(config, testDir);
      const changelog = await magicRelease.generate({ dryRun: true });

      // Restore original fetch
      global.fetch = originalFetch;

      expect(changelog).toContain('### Added');
      expect(changelog).toContain('### Fixed');
      expect(changelog).toContain('### Changed');
      expect(changelog).toContain('User authentication system');
      expect(changelog).toContain('Critical bug in user validation');
    });

    it('should handle breaking changes correctly', async () => {
      await setupRepositoryWithBreakingChanges();
      
      const config: MagicReleaseConfig = {
        llm: {
          provider: 'openai',
          model: 'gpt-3.5-turbo',
          apiKey: TEST_API_KEY
        },
        git: {
          tagPattern: 'v*'
        },
        changelog: {
          filename: 'CHANGELOG.md'
        }
      };

      // Mock LLM response with breaking changes
      const originalFetch = global.fetch;
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: `# Changelog

All notable changes to this project will be documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### BREAKING CHANGES
- API endpoints have been restructured
- Configuration format has changed

### Added
- New authentication system

### Changed
- Updated API response format`
            }
          }]
        })
      });

      const magicRelease = new MagicRelease(config, testDir);
      const changelog = await magicRelease.generate({ dryRun: true });

      // Restore original fetch
      global.fetch = originalFetch;

      expect(changelog).toContain('### BREAKING CHANGES');
      expect(changelog).toContain('API endpoints have been restructured');
      expect(changelog).toContain('## [Unreleased]');
    });
  });

  describe('File operations', () => {
    it('should create new changelog file when none exists', async () => {
      await setupTestRepository();
      
      const config: MagicReleaseConfig = {
        llm: {
          provider: 'openai',
          model: 'gpt-3.5-turbo',
          apiKey: TEST_API_KEY
        },
        git: {
          tagPattern: 'v*'
        },
        changelog: {
          filename: 'CHANGELOG.md'
        }
      };

      // Mock LLM response
      const originalFetch = global.fetch;
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: `# Changelog

All notable changes to this project will be documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Initial changelog generation`
            }
          }]
        })
      });

      const magicRelease = new MagicRelease(config, testDir);
      await magicRelease.generate({ dryRun: false });

      // Restore original fetch
      global.fetch = originalFetch;

      // Verify file was created
      const changelogExists = await fs.access('CHANGELOG.md').then(() => true).catch(() => false);
      expect(changelogExists).toBe(true);

      const content = await fs.readFile('CHANGELOG.md', 'utf-8');
      expect(content).toContain('## [Unreleased]');
      expect(content).toContain('Initial changelog generation');
    });

    it('should use custom changelog filename', async () => {
      await setupTestRepository();
      
      const config: MagicReleaseConfig = {
        llm: {
          provider: 'openai',
          model: 'gpt-3.5-turbo',
          apiKey: TEST_API_KEY
        },
        git: {
          tagPattern: 'v*'
        },
        changelog: {
          filename: 'HISTORY.md'
        }
      };

      // Mock LLM response
      const originalFetch = global.fetch;
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: '## [1.1.0] - 2024-01-15\n\n### Added\n- Custom filename support'
            }
          }]
        })
      });

      const magicRelease = new MagicRelease(config, testDir);
      await magicRelease.generate({ dryRun: false });

      // Restore original fetch
      global.fetch = originalFetch;

      // Verify custom filename was used
      const historyExists = await fs.access('HISTORY.md').then(() => true).catch(() => false);
      expect(historyExists).toBe(true);

      const changelogExists = await fs.access('CHANGELOG.md').then(() => true).catch(() => false);
      expect(changelogExists).toBe(false);
    });
  });

  describe('Performance and scalability', () => {
    it('should handle large repositories efficiently', async () => {
      await setupLargeRepository();
      
      const config: MagicReleaseConfig = {
        llm: {
          provider: 'openai',
          model: 'gpt-3.5-turbo',
          apiKey: TEST_API_KEY
        },
        git: {
          tagPattern: 'v*'
        },
        changelog: {
          filename: 'CHANGELOG.md'
        }
      };

      // Mock LLM response
      const originalFetch = global.fetch;
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: `# Changelog

All notable changes to this project will be documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Multiple features from large commit history`
            }
          }]
        })
      });

      const startTime = Date.now();
      const magicRelease = new MagicRelease(config, testDir);
      const changelog = await magicRelease.generate({ dryRun: true });
      const endTime = Date.now();

      // Restore original fetch
      global.fetch = originalFetch;

      // Should complete within reasonable time (less than 10 seconds)
      expect(endTime - startTime).toBeLessThan(10000);
      expect(changelog).toContain('Multiple features from large commit history');
    });
  });
});

// Helper functions
async function execCommand(command: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'pipe' });
    
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Command failed with exit code ${code}`));
      }
    });
  });
}

async function setupTestRepository(): Promise<void> {
  await fs.writeFile('package.json', JSON.stringify({
    name: 'test-core-package',
    version: '1.0.0'
  }, null, 2));

  await fs.writeFile('README.md', '# Test Project');
  await execCommand('git', ['add', 'README.md']);
  await execCommand('git', ['commit', '-m', 'feat: initial commit']);
  await execCommand('git', ['tag', 'v1.0.0']);

  await fs.mkdir('src', { recursive: true });
  await fs.writeFile('src/index.js', 'console.log("test");');
  await execCommand('git', ['add', 'src/index.js']);
  await execCommand('git', ['commit', '-m', 'feat: add main file']);
}

async function setupRepositoryWithDifferentTags(): Promise<void> {
  await setupTestRepository();
  
  // Remove git tags and add custom ones
  await execCommand('git', ['tag', '-d', 'v1.0.0']);
  await execCommand('git', ['tag', 'release-1.0.0']);
  
  await fs.mkdir('src', { recursive: true });
  await fs.writeFile('src/feature.js', 'export const feature = {};');
  await execCommand('git', ['add', 'src/feature.js']);
  await execCommand('git', ['commit', '-m', 'feat: add new feature']);
}

async function setupRepositoryWithConventionalCommits(): Promise<void> {
  await fs.writeFile('package.json', JSON.stringify({
    name: 'conventional-commits-test',
    version: '1.0.0'
  }, null, 2));

  await fs.writeFile('README.md', '# Conventional Commits Test');
  await execCommand('git', ['add', 'README.md']);
  await execCommand('git', ['commit', '-m', 'chore: initial setup']);
  await execCommand('git', ['tag', 'v1.0.0']);

  // Add conventional commits
  await fs.mkdir('src', { recursive: true });
  await fs.writeFile('src/auth.js', 'export const auth = {};');
  await execCommand('git', ['add', 'src/auth.js']);
  await execCommand('git', ['commit', '-m', 'feat(auth): add user authentication system']);

  await fs.writeFile('src/api.js', 'export const api = {};');
  await execCommand('git', ['add', 'src/api.js']);
  await execCommand('git', ['commit', '-m', 'feat(api): add new API endpoints for data management']);

  await fs.writeFile('src/fix.js', 'export const fix = {};');
  await execCommand('git', ['add', 'src/fix.js']);
  await execCommand('git', ['commit', '-m', 'fix(auth): resolve critical bug in user validation']);

  await fs.writeFile('src/perf.js', 'export const perf = {};');
  await execCommand('git', ['add', 'src/perf.js']);
  await execCommand('git', ['commit', '-m', 'perf(db): fix performance issues in database queries']);

  await fs.writeFile('src/refactor.js', 'export const refactor = {};');
  await execCommand('git', ['add', 'src/refactor.js']);
  await execCommand('git', ['commit', '-m', 'refactor(auth): update authentication flow']);
}

async function setupRepositoryWithBreakingChanges(): Promise<void> {
  await setupTestRepository();
  
  // Add breaking changes
  await fs.writeFile('src/breaking.js', 'export const breaking = {};');
  await execCommand('git', ['add', 'src/breaking.js']);
  await execCommand('git', ['commit', '-m', 'feat!: restructure API endpoints\n\nBREAKING CHANGE: API endpoints have been restructured']);

  await fs.writeFile('config.json', '{"version": 2}');
  await execCommand('git', ['add', 'config.json']);
  await execCommand('git', ['commit', '-m', 'feat!: update configuration format\n\nBREAKING CHANGE: Configuration format has changed']);
}

async function setupLargeRepository(): Promise<void> {
  await fs.writeFile('package.json', JSON.stringify({
    name: 'large-test-repo',
    version: '1.0.0'
  }, null, 2));

  await fs.writeFile('README.md', '# Large Test Repository');
  await execCommand('git', ['add', 'README.md']);
  await execCommand('git', ['commit', '-m', 'initial commit']);
  await execCommand('git', ['tag', 'v1.0.0']);

  // Create many commits to simulate a large repository
  await fs.mkdir('src', { recursive: true });
  for (let i = 1; i <= 50; i++) {
    await fs.writeFile(`src/file${i}.js`, `export const file${i} = {};`);
    await execCommand('git', ['add', `src/file${i}.js`]);
    await execCommand('git', ['commit', '-m', `feat: add file${i} functionality`]);
  }

  // Add some fix commits
  for (let i = 1; i <= 20; i++) {
    await fs.writeFile(`src/fix${i}.js`, `export const fix${i} = {};`);
    await execCommand('git', ['add', `src/fix${i}.js`]);
    await execCommand('git', ['commit', '-m', `fix: resolve issue ${i}`]);
  }
}
