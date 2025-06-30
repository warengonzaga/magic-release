/**
 * Core configuration interface for Magic Release
 *
 * Contains all configuration options for Magic Release including LLM provider settings,
 * changelog formatting options, and Git repository configuration.
 */
export interface MagicReleaseConfig {
  /** LLM provider configuration for AI-powered changelog generation */
  llm: {
    /** AI provider type */
    provider: 'openai' | 'anthropic' | 'azure';
    /** API key for the selected provider */
    apiKey?: string;
    /** Model to use for generation (e.g., 'gpt-4', 'claude-3-sonnet') */
    model?: string;
    /** Temperature for AI responses (0.0-1.0, lower = more consistent) */
    temperature?: number;
    /** Maximum tokens for AI responses */
    maxTokens?: number;
    // Azure-specific properties
    /** Azure OpenAI endpoint URL */
    endpoint?: string;
    /** Azure API version */
    apiVersion?: string;
    /** Azure deployment name */
    deploymentName?: string;
    // OpenAI-specific properties
    /** Custom OpenAI base URL */
    baseURL?: string;
    /** OpenAI organization ID */
    organization?: string;
  };
  /** Changelog generation and formatting options */
  changelog: {
    /** Output filename for the changelog */
    filename?: string;
    /** Include links to individual commits */
    includeCommitLinks?: boolean;
    /** Include links to pull requests */
    includePRLinks?: boolean;
    /** Include links to issues */
    includeIssueLinks?: boolean;
    /** Link format templates for different link types */
    linkFormat?: {
      /** Template for version comparison links */
      compare?: string;
      /** Template for commit links */
      commit?: string;
      /** Template for issue links */
      issue?: string;
      /** Template for pull request links */
      pr?: string;
    };
  };
  /** Git repository configuration */
  git: {
    /** Pattern for matching version tags */
    tagPattern?: string;
    /** Remote name to use for links */
    remote?: string;
    /** Repository identifier for link generation */
    repository?: string;
  };
  /** Additional rules and behavior configuration */
  rules?: {
    /** Minimum number of commits required to generate an update */
    minCommitsForUpdate?: number;
    /** Whether to include pre-release versions */
    includePreReleases?: boolean;
    /** Whether to group unreleased commits together */
    groupUnreleasedCommits?: boolean;
  };
}

/**
 * Git commit interface with essential commit information
 *
 * Represents a Git commit with all relevant metadata for changelog generation
 */
export interface Commit {
  /** Commit hash (SHA) */
  hash: string;
  /** Commit message/subject line */
  message: string;
  /** Full commit body (optional) */
  body?: string;
  /** Commit author name */
  author: string;
  /** Commit date */
  date: Date;
  /** Conventional commit type (feat, fix, etc.) */
  type?: string;
  /** Conventional commit scope */
  scope?: string;
  /** Whether this commit contains breaking changes */
  breaking?: boolean;
  /** Associated pull request number */
  pr?: number;
  /** Array of issue numbers referenced in commit */
  issues?: string[];
}

/**
 * Detailed Git commit interface with full Git metadata
 *
 * Contains complete Git commit information including author and committer details
 */
export interface GitCommit {
  /** Commit hash (SHA) */
  hash: string;
  /** Commit subject line */
  subject: string;
  /** Full commit body */
  body: string;
  /** Author information */
  author: {
    /** Author name */
    name: string;
    /** Author email */
    email: string;
    /** Author date */
    date: Date;
  };
  /** Committer information */
  committer: {
    /** Committer name */
    name: string;
    /** Committer email */
    email: string;
    /** Commit date */
    date: Date;
  };
}

/**
 * Changelog entry representing a version release
 *
 * Contains all information for a single version entry in the changelog
 */
export interface ChangelogEntry {
  /** Version number (semver format) */
  version: string;
  /** Release date (optional for unreleased versions) */
  date?: Date;
  /** Map of change types to their respective changes */
  sections: Map<ChangeType, Change[]>;
  /** URL for comparing this version with previous version */
  compareUrl?: string;
  /** Whether this is a pre-release version */
  isPreRelease?: boolean;
}

/**
 * Change types following Keep a Changelog format
 *
 * Standard categories for organizing changelog entries
 */
export type ChangeType = 'Added' | 'Changed' | 'Deprecated' | 'Removed' | 'Fixed' | 'Security';

/**
 * Individual change within a changelog section
 *
 * Represents a single change item with associated metadata
 */
export interface Change {
  /** Human-readable description of the change */
  description: string;
  /** Scope of the change (optional) */
  scope?: string;
  /** Array of commits that contributed to this change */
  commits: Commit[];
  /** Associated pull request number */
  pr?: number;
  /** Array of related issue numbers */
  issues?: string[];
}

// Git tag interface
export interface Tag {
  name: string;
  version: string;
  hash: string;
  date: Date;
  isPreRelease: boolean;
}

// Git tag interface for repository tags
export interface GitTag {
  name: string;
  date: Date;
  subject: string;
}

// Repository information
export interface RepositoryInfo {
  owner: string;
  name: string;
  url: string;
}

// Analysis options
export interface AnalyzeOptions {
  fromTag?: string;
  toTag?: string;
  includeUnreleased?: boolean;
  verbose?: boolean;
}

// Repository analysis result
export interface RepositoryAnalysis {
  repository: RepositoryInfo;
  tags: Tag[];
  commits: Commit[];
  newVersions: ChangelogEntry[];
  existingVersions: Set<string>;
}

// CLI flags interface for React components
export interface CLIFlags {
  // Provider management
  provider?: 'openai' | 'anthropic' | 'azure';
  setKey?: string;
  setKeyUnsafe?: string;
  testKey?: string;
  deleteKey?: boolean;

  // Configuration
  config?: boolean;
  init?: boolean;
  generateConfig?: boolean;

  // Execution
  verbose?: boolean;
  debug?: boolean;
  dryRun?: boolean;
  from?: string;
  to?: string;

  // Help and version
  help?: boolean;
  version?: boolean;
}

// Logger levels
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

// Configuration schema for validation
export interface ConfigSchema {
  projectName: string;
  configName: string;
  schema: {
    llm: {
      provider: string;
      apiKey: string;
      model: string;
      temperature: number;
      maxTokens: number;
    };
    changelog: {
      filename: string;
      includeCommitLinks: boolean;
      includePRLinks: boolean;
      includeIssueLinks: boolean;
    };
    git: {
      tagPattern: string;
      remote: string;
    };
  };
}

// Git service configuration
export interface GitServiceConfig {
  cwd?: string;
  remote?: string;
}
