/**
 * Debug test to understand the workflow test failure
 */

import { promises as fs } from 'fs';
import * as fsSync from 'fs';
import path from 'path';
import { tmpdir } from 'os';
import { rimraf } from 'rimraf';
import { spawn } from 'child_process';

import { MagicRelease } from '../../src/core/MagicRelease.js';
import type { MagicReleaseConfig } from '../../src/types/index.js';

// Unmock fs for integration tests - we need real file system operations
jest.unmock('fs');

// Test constants - using a valid-looking OpenAI API key format
const TEST_API_KEY = 'sk-proj-abcdefghijklmnopqrstuvwxyz1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890';

describe('Debug Workflow Test', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(tmpdir(), 'magicrelease-debug-'));
  });

  afterEach(async () => {
    await rimraf(testDir);
  });

  it('should set up git repository correctly', async () => {
    console.log('Test directory:', testDir);
    
    // Initialize git repository
    try {
      await execCommand('git', ['init'], testDir);
      console.log('Git init completed');
    } catch (error) {
      console.error('Git init failed:', error);
      throw error;
    }
    
    // Check if .git directory exists
    const gitPath = path.join(testDir, '.git');
    console.log('Checking git path:', gitPath);
    
    const gitExists = fsSync.existsSync(gitPath);
    console.log('existsSync result:', gitExists, 'type:', typeof gitExists);
    expect(gitExists).toBe(true);
    
    // Alternative check using fs.stat
    try {
      const stat = await fs.stat(gitPath);
      console.log('Git directory stat:', stat.isDirectory());
      expect(stat.isDirectory()).toBe(true);
    } catch (error) {
      console.error('Git directory stat failed:', error);
      throw error;
    }
    
    // List directory contents
    const contents = await fs.readdir(testDir);
    console.log('Directory contents:', contents);
    expect(contents).toContain('.git');
  });

  it('should create MagicRelease instance after git setup', async () => {
    console.log('Test directory:', testDir);
    
    // Initialize git repository
    await execCommand('git', ['init'], testDir);
    await execCommand('git', ['config', 'user.name', 'Test User'], testDir);
    await execCommand('git', ['config', 'user.email', 'test@example.com'], testDir);
    
    // Create a basic file and commit
    const readmePath = path.join(testDir, 'README.md');
    await fs.writeFile(readmePath, '# Test');
    await execCommand('git', ['add', 'README.md'], testDir);
    await execCommand('git', ['commit', '-m', 'initial'], testDir);
    
    // Verify git directory exists
    const gitPath = path.join(testDir, '.git');
    const gitExists = fsSync.existsSync(gitPath);
    console.log('Git directory exists before MagicRelease:', gitExists);
    expect(gitExists).toBe(true);
    
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

    // This should work now
    console.log('Creating MagicRelease instance...');
    const magicRelease = new MagicRelease(config, testDir);
    expect(magicRelease).toBeDefined();
    console.log('MagicRelease instance created successfully');
  });
});

// Helper function
async function execCommand(command: string, args: string[], cwd: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { 
      cwd,
      stdio: 'pipe'
    });
    
    let stderr = '';
    child.stderr?.on('data', (data) => {
      stderr += data.toString();
    });
    
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Command "${command} ${args.join(' ')}" failed with exit code ${code}. stderr: ${stderr}`));
      }
    });
  });
}
