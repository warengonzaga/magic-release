// Core configuration interface
export interface MagicReleaseConfig {
  llm: {
    provider: 'openai' | 'anthropic' | 'azure';
    apiKey?: string;
    model?: string;
    temperature?: number;
    maxTokens?: number;
    // Azure-specific properties
    endpoint?: string;
    apiVersion?: string;
    deploymentName?: string;
    // OpenAI-specific properties
    baseURL?: string;
    organization?: string;
  };
  changelog: {
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
  git: {
    tagPattern?: string;
    remote?: string;
    repository?: string;
  };
  rules?: {
    minCommitsForUpdate?: number;
    includePreReleases?: boolean;
    groupUnreleasedCommits?: boolean;
  };
}

// Git commit interface
export interface Commit {
  hash: string;
  message: string;
  body?: string;
  author: string;
  date: Date;
  type?: string;
  scope?: string;
  breaking?: boolean;
  pr?: number;
  issues?: string[];
}

// Git commit interface with more detailed structure
export interface GitCommit {
  hash: string;
  subject: string;
  body: string;
  author: {
    name: string;
    email: string;
    date: Date;
  };
  committer: {
    name: string;
    email: string;
    date: Date;
  };
}

// Changelog entry interface
export interface ChangelogEntry {
  version: string;
  date?: Date;
  sections: Map<ChangeType, Change[]>;
  compareUrl?: string;
  isPreRelease?: boolean;
}

// Change types following Keep a Changelog format
export type ChangeType = 'Added' | 'Changed' | 'Deprecated' | 'Removed' | 'Fixed' | 'Security';

// Individual change interface
export interface Change {
  description: string;
  scope?: string;
  commits: Commit[];
  pr?: number;
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
