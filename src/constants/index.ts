/**
 * Application constants for MagicRelease
 */

// Application metadata
export const APP_NAME = 'MagicRelease';
export const CLI_NAME = 'magicr';
export const APP_DESCRIPTION = 'AI-powered CLI tool that automatically generates and maintains changelogs following the Keep a Changelog format';

// Configuration defaults
export const DEFAULT_CONFIG = {
  llm: {
    provider: 'openai' as const,
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

// Changelog types following Keep a Changelog format
export const CHANGELOG_TYPES = {
  ADDED: 'Added',
  CHANGED: 'Changed',
  DEPRECATED: 'Deprecated',
  REMOVED: 'Removed',
  FIXED: 'Fixed',
  SECURITY: 'Security',
} as const;

// Git conventional commit types mapping to changelog types
export const COMMIT_TYPE_MAPPING = {
  feat: CHANGELOG_TYPES.ADDED,
  fix: CHANGELOG_TYPES.FIXED,
  docs: CHANGELOG_TYPES.CHANGED,
  style: CHANGELOG_TYPES.CHANGED,
  refactor: CHANGELOG_TYPES.CHANGED,
  perf: CHANGELOG_TYPES.CHANGED,
  test: CHANGELOG_TYPES.CHANGED,
  chore: CHANGELOG_TYPES.CHANGED,
  ci: CHANGELOG_TYPES.CHANGED,
  build: CHANGELOG_TYPES.CHANGED,
  revert: CHANGELOG_TYPES.CHANGED,
  security: CHANGELOG_TYPES.SECURITY,
  deprecated: CHANGELOG_TYPES.DEPRECATED,
  removed: CHANGELOG_TYPES.REMOVED,
} as const;

// LLM prompts and templates
export const PROMPTS = {
  CATEGORIZE_COMMITS: `You are a helpful assistant that categorizes git commits into changelog sections following the "Keep a Changelog" format.

Given a list of git commits, categorize each commit into one of these sections:
- Added: for new features
- Changed: for changes in existing functionality
- Deprecated: for soon-to-be removed features
- Removed: for now removed features
- Fixed: for any bug fixes
- Security: in case of vulnerabilities

Respond with a JSON object mapping each commit hash to its category and an improved description.

Example response:
{
  "abc123": {
    "category": "Added",
    "description": "Add user authentication system"
  },
  "def456": {
    "category": "Fixed", 
    "description": "Fix memory leak in data processing"
  }
}`,

  GENERATE_SUMMARY: `Generate a concise summary for this changelog entry. Focus on the most important changes and their impact on users. Keep it under 200 characters.`,
};

// Error messages
export const ERROR_MESSAGES = {
  GIT_NOT_INSTALLED: 'Git is not installed or not available in PATH',
  NOT_GIT_REPOSITORY: 'Current directory is not a Git repository',
  NO_COMMITS_FOUND: 'No commits found in the specified range',
  NO_API_KEY: 'No API key configured. Run "magicr config" to set up your API key',
  INVALID_API_CREDENTIALS: 'Invalid API credentials. Please check your configuration',
  CHANGELOG_NOT_FOUND: 'CHANGELOG.md not found',
  CONFIGURATION_ERROR: 'Configuration error',
  NETWORK_ERROR: 'Network error occurred',
  UNKNOWN_ERROR: 'An unknown error occurred',
};

// Success messages
export const SUCCESS_MESSAGES = {
  CHANGELOG_GENERATED: 'Changelog generated successfully',
  CONFIG_SAVED: 'Configuration saved successfully',
  API_KEY_SAVED: 'API key saved successfully',
  INIT_COMPLETE: 'Project initialized successfully',
};

// File patterns and paths
export const FILE_PATTERNS = {
  CHANGELOG: ['CHANGELOG.md', 'CHANGELOG.rst', 'CHANGELOG.txt', 'CHANGELOG'],
  CONFIG: ['.magicrelease.json', '.magicr.json', 'magicrelease.config.json'],
  GITIGNORE_ENTRY: '\n# MagicRelease configuration\n.magicrelease.json\n.magicr.json\n',
};

// API endpoints and limits
export const API_CONFIG = {
  OPENAI: {
    BASE_URL: 'https://api.openai.com/v1',
    MAX_TOKENS: 4096,
    TIMEOUT: 30000,
  },
  RATE_LIMITS: {
    REQUESTS_PER_MINUTE: 60,
    REQUESTS_PER_HOUR: 3600,
  },
};

// Regex patterns
export const REGEX_PATTERNS = {
  SEMVER: /^v?(\d+)\.(\d+)\.(\d+)(?:-([a-zA-Z0-9.-]+))?(?:\+([a-zA-Z0-9.-]+))?$/,
  CONVENTIONAL_COMMIT: /^(\w+)(?:\(([^)]+)\))?(!)?: (.+)$/,
  GITHUB_ISSUE: /#(\d+)/g,
  GITHUB_PR: /(?:PR|pull request)\s*#(\d+)/gi,
  COMMIT_HASH: /^[a-f0-9]{7,40}$/,
};

// CLI ASCII art and branding
export const ASCII_ART = {
  BANNER: `
╔═╗ ╔═╗ ╔═╗ ╦ ╔═╗ ╦═╗ ╔═╗ ╦   ╔═╗ ╔═╗ ╔═╗ ╔═╗
║║║ ╠═╣ ║ ╦ ║ ║   ╠╦╝ ║╣  ║   ║╣  ╠═╣ ╚═╗ ║╣ 
╩ ╩ ╩ ╩ ╚═╝ ╩ ╚═╝ ╩╚═ ╚═╝ ╩═╝ ╚═╝ ╩ ╩ ╚═╝ ╚═╝
`,
  LOGO: '🪄',
  SUCCESS: '✅',
  ERROR: '❌',
  WARNING: '⚠️',
  INFO: 'ℹ️',
  MAGIC: '✨',
  LOADING: '⏳',
};

// URLs and links
export const URLS = {
  GITHUB: 'https://github.com/warengonzaga/magic-release',
  ISSUES: 'https://github.com/warengonzaga/magic-release/issues',
  DOCS: 'https://github.com/warengonzaga/magic-release#readme',
  AUTHOR: 'https://warengonzaga.com',
  SPONSOR: 'https://github.com/sponsors/warengonzaga',
  OPENAI_KEYS: 'https://platform.openai.com/account/api-keys',
  KEEP_CHANGELOG: 'https://keepachangelog.com/',
  SEMANTIC_VERSIONING: 'https://semver.org/',
};

// Export all constants as default
export default {
  APP_NAME,
  CLI_NAME,
  APP_DESCRIPTION,
  DEFAULT_CONFIG,
  CHANGELOG_TYPES,
  COMMIT_TYPE_MAPPING,
  PROMPTS,
  ERROR_MESSAGES,
  SUCCESS_MESSAGES,
  FILE_PATTERNS,
  API_CONFIG,
  REGEX_PATTERNS,
  ASCII_ART,
  URLS,
};
