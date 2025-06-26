/**
 * Project-level configuration utilities for MagicRelease
 * Supports .magicrrc files for per-project customization
 */

import { readFileSync, existsSync } from 'fs';
import { join, resolve } from 'path';
import { cwd } from 'process';

import { logger } from './logger.js';

/**
 * Project configuration interface that can be saved in .magicrrc
 */
export interface ProjectConfig {
  // LLM Configuration
  llm?: {
    provider?: 'openai' | 'anthropic' | 'azure';
    model?: string;
    temperature?: number;
    maxTokens?: number;
    // Note: API keys should NOT be stored in project config files for security
  };

  // Changelog Configuration
  changelog?: {
    filename?: string;
    includeCommitLinks?: boolean;
    includePRLinks?: boolean;
    includeIssueLinks?: boolean;
    linkFormat?: {
      compare?: string;
      commit?: string;
      issue?: string;
      pr?: string;
    };
  };

  // Git Configuration
  git?: {
    tagPattern?: string;
    remote?: string;
    repository?: string;
  };

  // Generation Rules
  rules?: {
    minCommitsForUpdate?: number;
    includePreReleases?: boolean;
    groupUnreleasedCommits?: boolean;
  };
}

/**
 * Default project configuration values
 */
const DEFAULT_PROJECT_CONFIG: ProjectConfig = {
  llm: {
    provider: 'openai',
    model: 'gpt-4o-mini',
    temperature: 0.1,
    maxTokens: 150,
  },
  changelog: {
    filename: 'CHANGELOG.md',
    includeCommitLinks: true,
    includePRLinks: true,
    includeIssueLinks: true,
  },
  git: {
    tagPattern: '^v?\\d+\\.\\d+\\.\\d+',
    remote: 'origin',
  },
  rules: {
    minCommitsForUpdate: 1,
    includePreReleases: false,
    groupUnreleasedCommits: true,
  },
};

/**
 * Supported configuration file names in order of precedence
 */
export const CONFIG_FILENAMES = [
  '.magicrrc',
  '.magicrrc.json',
  '.magicr.json',
  'magicr.config.json',
  '.magicr', // Legacy support
];

/**
 * Find and read project configuration file
 */
export const findProjectConfig = (searchPath: string = cwd()): ProjectConfig | null => {
  for (const filename of CONFIG_FILENAMES) {
    const configPath = join(searchPath, filename);

    if (existsSync(configPath)) {
      try {
        const content = readFileSync(configPath, 'utf-8');
        const config = JSON.parse(content) as ProjectConfig;

        logger.debug(`Found project config at: ${configPath}`);
        return config;
      } catch (error: any) {
        logger.warn(`Failed to parse config file ${configPath}: ${error.message}`);
        continue; // Try next config file
      }
    }
  }

  return null;
};

/**
 * Recursively search for project configuration up the directory tree
 */
export const findProjectConfigRecursive = (startPath: string = cwd()): ProjectConfig | null => {
  let currentPath = resolve(startPath);
  let parentPath = resolve(currentPath, '..');

  // Search up the directory tree until we reach the root
  while (currentPath !== parentPath) {
    const config = findProjectConfig(currentPath);
    if (config) {
      return config;
    }

    currentPath = parentPath;
    parentPath = resolve(currentPath, '..');
  }

  // Check root directory as well
  return findProjectConfig(currentPath);
};

/**
 * Merge project configuration with defaults
 */
export const mergeWithDefaults = (projectConfig: ProjectConfig | null): ProjectConfig => {
  if (!projectConfig) {
    return DEFAULT_PROJECT_CONFIG;
  }

  return {
    llm: {
      ...DEFAULT_PROJECT_CONFIG.llm,
      ...projectConfig.llm,
    },
    changelog: {
      ...DEFAULT_PROJECT_CONFIG.changelog,
      ...projectConfig.changelog,
      linkFormat: {
        ...DEFAULT_PROJECT_CONFIG.changelog?.linkFormat,
        ...projectConfig.changelog?.linkFormat,
      },
    },
    git: {
      ...DEFAULT_PROJECT_CONFIG.git,
      ...projectConfig.git,
    },
    rules: {
      ...DEFAULT_PROJECT_CONFIG.rules,
      ...projectConfig.rules,
    },
  };
};

/**
 * Get the complete project configuration by merging project file with defaults
 */
export const getProjectConfig = (searchPath?: string): ProjectConfig => {
  const projectConfig = findProjectConfigRecursive(searchPath);
  const mergedConfig = mergeWithDefaults(projectConfig);

  if (projectConfig) {
    logger.debug('Using project-specific configuration');
  } else {
    logger.debug('Using default configuration (no .magicrrc found)');
  }

  return mergedConfig;
};

/**
 * Validate project configuration
 */
export const validateProjectConfig = (
  config: ProjectConfig
): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];

  // Validate LLM provider
  if (config.llm?.provider && !['openai', 'anthropic', 'azure'].includes(config.llm.provider)) {
    errors.push(
      `Invalid LLM provider: ${config.llm.provider}. Must be one of: openai, anthropic, azure`
    );
  }

  // Validate temperature
  if (
    config.llm?.temperature !== undefined &&
    (config.llm.temperature < 0 || config.llm.temperature > 2)
  ) {
    errors.push(`Invalid temperature: ${config.llm.temperature}. Must be between 0 and 2`);
  }

  // Validate maxTokens
  if (
    config.llm?.maxTokens !== undefined &&
    (config.llm.maxTokens < 1 || config.llm.maxTokens > 4096)
  ) {
    errors.push(`Invalid maxTokens: ${config.llm.maxTokens}. Must be between 1 and 4096`);
  }

  // Validate changelog filename
  if (config.changelog?.filename && !config.changelog.filename.endsWith('.md')) {
    errors.push(`Invalid changelog filename: ${config.changelog.filename}. Must end with .md`);
  }

  // Validate tag pattern (basic regex validation)
  if (config.git?.tagPattern) {
    try {
      new RegExp(config.git.tagPattern);
    } catch {
      errors.push(
        `Invalid tag pattern: ${config.git.tagPattern}. Must be a valid regular expression`
      );
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};

/**
 * Generate a sample .magicrrc file content
 */
export const generateSampleConfig = (): string => {
  const sampleConfig: ProjectConfig = {
    llm: {
      provider: 'openai',
      model: 'gpt-4o-mini',
      temperature: 0.1,
      maxTokens: 150,
    },
    changelog: {
      filename: 'CHANGELOG.md',
      includeCommitLinks: true,
      includePRLinks: true,
      includeIssueLinks: true,
      linkFormat: {
        compare: 'https://github.com/owner/repo/compare/{previousTag}...{currentTag}',
        commit: 'https://github.com/owner/repo/commit/{hash}',
        issue: 'https://github.com/owner/repo/issues/{issue}',
        pr: 'https://github.com/owner/repo/pull/{pr}',
      },
    },
    git: {
      tagPattern: '^v?\\\\d+\\\\.\\\\d+\\\\.\\\\d+',
      remote: 'origin',
      repository: 'owner/repo',
    },
    rules: {
      minCommitsForUpdate: 1,
      includePreReleases: false,
      groupUnreleasedCommits: true,
    },
  };

  return JSON.stringify(sampleConfig, null, 2);
};
