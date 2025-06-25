/**
 * Logger utility for MagicRelease using @wgtechlabs/log-engine
 * Provides consistent logging throughout the application with security-first approach
 */

import { LogEngine, LogMode } from '@wgtechlabs/log-engine';

// LogEngine auto-configures based on NODE_ENV, but we can override for specific needs
const env = process.env['NODE_ENV'] || 'development';

// Configure based on environment with security considerations
switch (env) {
  case 'production':
    LogEngine.configure({ mode: LogMode.INFO });
    break;
  case 'staging':
    LogEngine.configure({ mode: LogMode.WARN });
    break;
  case 'test':
    LogEngine.configure({ mode: LogMode.ERROR });
    break;
  case 'development':
  default:
    LogEngine.configure({ mode: LogMode.DEBUG });
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
  /openai/i
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
  'githubToken'
]);

// Logger interface that wraps LogEngine with additional functionality
class Logger {
  /**
   * Debug level logging - most verbose
   */
  debug(message: string, data?: any): void {
    if (data) {
      LogEngine.debug(message, data);
    } else {
      LogEngine.debug(message);
    }
  }

  /**
   * Info level logging - general information
   */
  info(message: string, data?: any): void {
    if (data) {
      LogEngine.info(message, data);
    } else {
      LogEngine.info(message);
    }
  }

  /**
   * Warning level logging
   */
  warn(message: string, data?: any): void {
    if (data) {
      LogEngine.warn(message, data);
    } else {
      LogEngine.warn(message);
    }
  }

  /**
   * Error level logging
   */
  error(message: string, error?: any): void {
    if (error) {
      LogEngine.error(message, error);
    } else {
      LogEngine.error(message);
    }
  }

  /**
   * Critical level logging - always shows (except in OFF mode)
   */
  log(message: string, data?: any): void {
    if (data) {
      LogEngine.log(message, data);
    } else {
      LogEngine.log(message);
    }
  }

  /**
   * Raw logging without redaction - use with extreme caution in development only
   */
  debugRaw(message: string, data?: any): void {
    if (process.env['NODE_ENV'] !== 'development') {
      this.warn('Raw logging attempted in non-development environment, using regular debug instead');
      return this.debug(message, data);
    }
    
    if (data) {
      LogEngine.withoutRedaction().debug(message, data);
    } else {
      LogEngine.withoutRedaction().debug(message);
    }
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
      off: LogMode.OFF
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
      childLogger[method] = (message: string, data?: any) => {
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
}

// Export singleton logger instance
export const logger = new Logger();

// Export LogEngine directly for advanced usage
export { LogEngine, LogMode };

export default logger;
