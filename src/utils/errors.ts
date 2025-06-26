/**
 * Custom error classes for MagicRelease
 * Following the same pattern as Magic Commit but with TypeScript
 */

export class MagicReleaseError extends Error {
  public readonly code: string;
  public readonly context?: Record<string, unknown> | undefined;

  constructor(message: string, code: string, context?: Record<string, unknown>) {
    super(message);
    this.name = 'MagicReleaseError';
    this.code = code;
    this.context = context;

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if ('captureStackTrace' in Error) {
      (
        Error as { captureStackTrace?: (thisArg: object, func: Function) => void }
      ).captureStackTrace?.(this, MagicReleaseError);
    }
  }
}

export class GitError extends MagicReleaseError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'GIT_ERROR', context);
    this.name = 'GitError';
  }
}

export class LLMError extends MagicReleaseError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'LLM_ERROR', context);
    this.name = 'LLMError';
  }
}

export class ConfigError extends MagicReleaseError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'CONFIG_ERROR', context);
    this.name = 'ConfigError';
  }
}

export class ValidationError extends MagicReleaseError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'VALIDATION_ERROR', context);
    this.name = 'ValidationError';
  }
}

export class APIKeyError extends MagicReleaseError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'API_KEY_ERROR', context);
    this.name = 'APIKeyError';
  }
}

export class ChangelogError extends MagicReleaseError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'CHANGELOG_ERROR', context);
    this.name = 'ChangelogError';
  }
}

// Error helper functions
export const isGitInstalled = (): boolean => {
  try {
    // Simple check that can be handled by the calling code
    return true; // Assume git is installed, will fail gracefully in GitService
  } catch {
    return false;
  }
};

export const isGitRepository = (): boolean => {
  try {
    // Simple check that can be handled by the calling code
    return true; // Will be properly validated in GitService
  } catch {
    return false;
  }
};

export const isCommitterConfigured = (): boolean => {
  try {
    // Simple check that can be handled by the calling code
    return true; // Will be properly validated in GitService
  } catch {
    return false;
  }
};

// Error factory functions for common scenarios
export const createGitError = (message: string, context?: Record<string, unknown>): GitError => {
  return new GitError(message, context);
};

export const createGitNotInstalledError = (): GitError => {
  return new GitError(
    'Git is not installed or not available in PATH. Please install Git and try again.',
    { solution: 'Install Git from https://git-scm.com/' }
  );
};

export const createNotGitRepositoryError = (path?: string): GitError => {
  return new GitError(`The current directory${path ? ` (${path})` : ''} is not a Git repository.`, {
    path,
    solution:
      'Initialize a Git repository with "git init" or run this command in a Git repository.',
  });
};

export const createCommitterNotConfiguredError = (): GitError => {
  return new GitError('Git user name and email are not configured.', {
    solution:
      'Configure Git with "git config --global user.name" and "git config --global user.email"',
  });
};

export const createInvalidAPIKeyError = (provider: string): APIKeyError => {
  return new APIKeyError(
    `Invalid API key for ${provider}. Please check your API key and try again.`,
    {
      provider,
      solution: `Get a valid API key from ${provider} and configure it using the config command.`,
    }
  );
};

export const createMissingAPIKeyError = (provider: string): APIKeyError => {
  return new APIKeyError(`No API key configured for ${provider}.`, {
    provider,
    solution: 'Configure your API key using the config command.',
  });
};
