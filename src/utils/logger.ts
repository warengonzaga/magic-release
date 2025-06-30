/**
 * Logger utility for MagicRelease using @wgtechlabs/log-engine
 * Provides consistent logging throughout the application with security-first approach
 */

import LogEngine, { LogMode } from '@wgtechlabs/log-engine';

/**
 * Singleton class to manage UI mode state with controlled access
 * Prevents race conditions and unintended state modifications
 */
class UIStateManager {
  private static instance: UIStateManager;
  private _isUIMode: boolean = false;
  private _lockCount: number = 0;

  private constructor() {}

  /**
   * Get the singleton instance
   */
  public static getInstance(): UIStateManager {
    if (!UIStateManager.instance) {
      UIStateManager.instance = new UIStateManager();
    }
    return UIStateManager.instance;
  }

  /**
   * Get the current UI mode state
   */
  public get isUIMode(): boolean {
    return this._isUIMode;
  }

  /**
   * Enable UI mode with optional lock to prevent accidental toggling
   */
  public enableUIMode(withLock: boolean = false): void {
    const wasUIMode = this._isUIMode;
    this._isUIMode = true;

    if (withLock) {
      this._lockCount++;
    }

    // Log state change only if it actually changed and in development
    if (!wasUIMode && process.env['NODE_ENV'] === 'development') {
      LogEngine.debug(
        '[UIStateManager] UI mode enabled - suppressing debug/info logs, errors/warnings still visible'
      );
    }
  }

  /**
   * Disable UI mode, respecting locks
   */
  public disableUIMode(force: boolean = false): boolean {
    if (this._lockCount > 0 && !force) {
      return false; // Cannot disable while locked
    }

    const wasUIMode = this._isUIMode;
    this._isUIMode = false;
    this._lockCount = 0; // Reset lock count when disabling

    // Log state change only if it actually changed and in development
    if (wasUIMode && process.env['NODE_ENV'] === 'development') {
      LogEngine.debug('[UIStateManager] UI mode disabled - all log levels now visible');
    }

    return true;
  }

  /**
   * Release a UI mode lock
   */
  public releaseLock(): void {
    if (this._lockCount > 0) {
      this._lockCount--;
    }
  }

  /**
   * Get current lock count (for debugging purposes)
   */
  public getLockCount(): number {
    return this._lockCount;
  }

  /**
   * Force reset the UI state (emergency use only)
   */
  public forceReset(): void {
    this._isUIMode = false;
    this._lockCount = 0;

    if (process.env['NODE_ENV'] === 'development') {
      LogEngine.warn('[UIStateManager] Force reset executed - UI state cleared');
    }
  }
}

// Get the singleton instance
const uiStateManager = UIStateManager.getInstance();

// LogEngine auto-configures based on NODE_ENV, but we override based on CLI flags
const env = process.env['NODE_ENV'] ?? 'development';

// Configure based on environment with security considerations
// Note: CLI flags will override these defaults via configureLogLevels()
switch (env) {
  case 'production':
    LogEngine.configure({ mode: LogMode.WARN }); // Production: only warnings and errors
    break;
  case 'staging':
    LogEngine.configure({ mode: LogMode.INFO }); // Staging: info, warn, error
    break;
  case 'test':
    LogEngine.configure({ mode: LogMode.ERROR }); // Test: only errors
    break;
  case 'development':
  default:
    LogEngine.configure({ mode: LogMode.DEBUG }); // Development: all logs
    break;
}

// Configure advanced redaction for sensitive data protection
LogEngine.addCustomRedactionPatterns([
  /api[_-]?key/i,
  /secret/i,
  /token/i,
  /password/i,
  /auth/i,
  /credential/i,
  /openai/i,
]);

// Add Magic Release specific sensitive fields
LogEngine.addSensitiveFields([
  'openaiApiKey',
  'apiKey',
  'llmApiKey',
  'authToken',
  'accessToken',
  'refreshToken',
  'gitToken',
  'githubToken',
]);

// Logger interface that wraps LogEngine with additional functionality and UI mode support
class Logger {
  /**
   * Configure log levels based on CLI flags
   * --debug = development mode (all logs)
   * --verbose = staging/test mode (info, warn, error)
   * no flag = production mode (warn, error only)
   */
  configureLogLevels(debug = false, verbose = false): void {
    // Set the underlying log engine level
    if (debug) {
      // Development mode - show all logs
      LogEngine.configure({ mode: LogMode.DEBUG });
    } else if (verbose) {
      // Staging/test mode - show info, warn, and error logs
      LogEngine.configure({ mode: LogMode.INFO });
    } else {
      // Production mode - show only warnings and errors
      LogEngine.configure({ mode: LogMode.WARN });
    }
  }
  /**
   * Centralized logging wrapper that handles LogEngine calls
   * With log-engine v2.1.0, we no longer need UI mode suppression as we use output handlers
   */
  private logWithUICheck(
    level: 'debug' | 'info' | 'warn' | 'error' | 'log',
    message: string,
    data?: unknown,
    options?: { withoutRedaction?: boolean }
  ): void {
    // With the new output handler feature, we can remove the UI mode suppression
    // and let log-engine handle output redirection properly

    const logMethod = options?.withoutRedaction
      ? LogEngine.withoutRedaction()[level]
      : LogEngine[level];

    if (data) {
      logMethod(message, data);
    } else {
      logMethod(message);
    }
  }

  /**
   * Debug level logging - most verbose
   */
  debug(message: string, data?: unknown): void {
    this.logWithUICheck('debug', message, data);
  }

  /**
   * Info level logging - general information
   */
  info(message: string, data?: unknown): void {
    this.logWithUICheck('info', message, data);
  }

  /**
   * Warning level logging - always shows even in UI mode
   */
  warn(message: string, data?: unknown): void {
    this.logWithUICheck('warn', message, data);
  }

  /**
   * Error level logging - always shows even in UI mode (critical for debugging)
   */
  error(message: string, error?: unknown): void {
    this.logWithUICheck('error', message, error);
  }

  /**
   * Critical level logging - always shows (except in OFF mode)
   */
  log(message: string, data?: unknown): void {
    this.logWithUICheck('log', message, data);
  }

  /**
   * Raw logging without redaction - use with extreme caution in development only
   */
  debugRaw(message: string, data?: unknown): void {
    if (process.env['NODE_ENV'] !== 'development') {
      this.warn(
        'Raw logging attempted in non-development environment, using regular debug instead'
      );
      return this.debug(message, data);
    }

    this.logWithUICheck('debug', message, data, { withoutRedaction: true });
  }

  /**
   * Test if a field will be redacted
   */
  willRedact(fieldName: string): boolean {
    return LogEngine.testFieldRedaction(fieldName);
  }

  /**
   * Set log level dynamically
   */
  setLevel(level: 'debug' | 'info' | 'warn' | 'error' | 'silent' | 'off'): void {
    const modeMap = {
      debug: LogMode.DEBUG,
      info: LogMode.INFO,
      warn: LogMode.WARN,
      error: LogMode.ERROR,
      silent: LogMode.SILENT,
      off: LogMode.OFF,
    };

    LogEngine.configure({ mode: modeMap[level] });
  }

  /**
   * Enable or disable redaction dynamically
   */
  configureRedaction(enabled: boolean, customFields?: string[]): void {
    if (!enabled && process.env['NODE_ENV'] === 'production') {
      this.warn('Attempting to disable redaction in production environment');
      return;
    }

    if (customFields) {
      LogEngine.addSensitiveFields(customFields);
    }
  }

  /**
   * Create child logger with prefix
   */
  child(prefix: string): Logger {
    const childLogger = new Logger();

    // Override methods to include prefix
    const originalMethods = ['debug', 'info', 'warn', 'error', 'log'] as const;

    originalMethods.forEach(method => {
      const originalMethod = childLogger[method].bind(childLogger);
      childLogger[method] = (message: string, data?: unknown): void => {
        originalMethod(`[${prefix}] ${message}`, data);
      };
    });

    return childLogger;
  }

  /**
   * Create scoped logger for specific modules
   */
  scope(module: string): Logger {
    return this.child(module.toUpperCase());
  }

  /**
   * Enable UI mode - suppresses debug/info logs, allows errors/warnings through
   */
  enableUIMode(): void {
    uiStateManager.enableUIMode();
  }

  /**
   * Enable UI mode with optional lock to prevent accidental toggling
   */
  enableUIModeWithLock(): void {
    uiStateManager.enableUIMode(true);
  }

  /**
   * Disable UI mode, respecting locks unless forced
   */
  disableUIMode(force: boolean = false): boolean {
    return uiStateManager.disableUIMode(force);
  }

  /**
   * Release a UI mode lock
   */
  releaseUILock(): void {
    uiStateManager.releaseLock();
  }

  /**
   * Get current UI lock count (for debugging purposes)
   */
  getUILockCount(): number {
    return uiStateManager.getLockCount();
  }

  /**
   * Force reset the UI state (emergency use only)
   */
  forceResetUIState(): void {
    uiStateManager.forceReset();
  }

  /**
   * Check if UI mode is active
   */
  isUIMode(): boolean {
    return uiStateManager.isUIMode;
  }

  /**
   * Force log a critical message even in UI mode - use sparingly for emergencies
   */
  forceLog(message: string, data?: unknown): void {
    const originalMode = uiStateManager.isUIMode;
    uiStateManager.disableUIMode(true); // Force disable with override

    try {
      LogEngine.error(`[CRITICAL] ${message}`, data);
    } finally {
      if (originalMode) {
        uiStateManager.enableUIMode(); // Restore original mode if it was enabled
      }
    }
  }
}

// Export singleton logger instance
export const logger = new Logger();

// Export LogEngine directly for advanced usage
export { LogEngine, LogMode };

export default logger;
