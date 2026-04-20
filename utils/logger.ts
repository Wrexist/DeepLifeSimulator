import { remoteLogger } from '@/services/RemoteLoggingService';

/**
 * Logger Utility
 * Provides structured logging with different log levels, development/production modes,
 * and optional integration with crash reporting services (e.g., Sentry)
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  NONE = 4,
}

interface LogContext {
  [key: string]: any;
}

interface LoggerConfig {
  level: LogLevel;
  enableConsole: boolean;
  enableSentry: boolean; // Kept for backward compat, but effectively unused without the package
  enableRemoteLogging: boolean;
}

class Logger {
  private config: LoggerConfig = {
    level: __DEV__ ? LogLevel.DEBUG : LogLevel.INFO,
    enableConsole: true, // Always enable console for now to ensure logs are visible
    enableSentry: false,
    enableRemoteLogging: true, // Enable internal remote logger by default for in-app viewing
  };

  /**
   * Configure the logger
   */
  configure(config: Partial<LoggerConfig>): void {
    this.config = { ...this.config, ...config };
    if (config.enableRemoteLogging !== undefined) {
       // You might want to configure the remote URL here in a real app
       // remoteLogger.configure('https://api.example.com/logs');
    }
  }

  /**
   * Log a debug message (only in development)
   */
  debug(message: string, context?: LogContext): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      this.log(LogLevel.DEBUG, message, context);
    }
  }

  /**
   * Log an info message
   */
  info(message: string, context?: LogContext): void {
    if (this.shouldLog(LogLevel.INFO)) {
      this.log(LogLevel.INFO, message, context);
    }
  }

  /**
   * Log a warning message
   */
  warn(message: string, context?: LogContext): void {
    if (this.shouldLog(LogLevel.WARN)) {
      this.log(LogLevel.WARN, message, context);
    }
  }

  /**
   * Log an error message
   */
  error(message: string, error?: Error | unknown, context?: LogContext): void {
    if (this.shouldLog(LogLevel.ERROR)) {
      this.log(LogLevel.ERROR, message, { ...context, error });
    }
  }

  /**
   * Check if a log level should be logged
   */
  private shouldLog(level: LogLevel): boolean {
    return level >= this.config.level;
  }

  /**
   * Internal log method
   */
  private log(level: LogLevel, message: string, context?: LogContext): void {
    const levelName = LogLevel[level];
    
    if (this.config.enableConsole) {
      const consoleMethod = this.getConsoleMethod(level);
      if (context && Object.keys(context).length > 0) {
        consoleMethod(`[${levelName}] ${message}`, context);
      } else {
        consoleMethod(`[${levelName}] ${message}`);
      }
    }

    // Send to remote logger (which also handles local persistence for the log viewer)
    if (this.config.enableRemoteLogging) {
      remoteLogger.log({
        level: levelName,
        message,
        context,
        error: context?.error,
      });
    }
  }

  /**
   * Get the appropriate console method for the log level
   */
  private getConsoleMethod(level: LogLevel): typeof console.log {
    switch (level) {
      case LogLevel.DEBUG:
        return console.log;
      case LogLevel.INFO:
        return console.info;
      case LogLevel.WARN:
        return console.warn;
      case LogLevel.ERROR:
        return console.error;
      default:
        return console.log;
    }
  }

  /**
   * Create a scoped logger with a prefix
   */
  scope(prefix: string): ScopedLogger {
    return new ScopedLogger(this, prefix);
  }
}

/**
 * Scoped logger that prefixes all messages with a scope name
 */
class ScopedLogger {
  constructor(
    private logger: Logger,
    private prefix: string
  ) {}

  debug(message: string, context?: LogContext): void {
    this.logger.debug(`[${this.prefix}] ${message}`, context);
  }

  info(message: string, context?: LogContext): void {
    this.logger.info(`[${this.prefix}] ${message}`, context);
  }

  warn(message: string, context?: LogContext): void {
    this.logger.warn(`[${this.prefix}] ${message}`, context);
  }

  error(message: string, error?: Error | unknown, context?: LogContext): void {
    this.logger.error(`[${this.prefix}] ${message}`, error, context);
  }
}

// Export singleton instance
export const logger = new Logger();

// Export convenience methods
export const log = {
  debug: (message: string, context?: LogContext) => logger.debug(message, context),
  info: (message: string, context?: LogContext) => logger.info(message, context),
  warn: (message: string, context?: LogContext) => logger.warn(message, context),
  error: (message: string, error?: Error | unknown, context?: LogContext) => logger.error(message, error, context),
};

// Export default logger
export default logger;

