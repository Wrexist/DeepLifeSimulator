/**
 * Error Handling Type Definitions
 * 
 * Centralized type definitions for error handling across the app.
 * Ensures type safety and consistency in error handling.
 */

/**
 * Base error interface for all error objects
 */
export interface ErrorObject {
  message: string;
  stack?: string;
  name?: string;
  code?: string | number;
  cause?: unknown;
}

/**
 * Early initialization error (before React renders)
 */
export interface EarlyError extends ErrorObject {
  isFatal?: boolean;
  timestamp?: number;
}

/**
 * Queued error in the global error queue
 */
export interface QueuedError {
  message: string;
  stack: string;
  isFatal: boolean;
  time: number;
  type: 'unhandledRejection' | 'error' | 'fatal' | 'module' | 'network' | 'save';
  category?: 'save' | 'progression' | 'ui' | 'network' | 'module' | 'unknown';
  context?: Record<string, unknown>;
}

/**
 * Error handler function type
 */
export type ErrorHandler = (error: ErrorObject, isFatal?: boolean) => void | undefined;

/**
 * Unhandled promise rejection event
 */
export interface UnhandledRejectionEvent {
  reason?: unknown;
  promise?: Promise<unknown>;
  preventDefault?: () => void;
  type?: string;
}

/**
 * Exception manager error data
 */
export interface ExceptionManagerData {
  message?: string;
  originalMessage?: string;
  stack?: string;
  originalStack?: string;
  name?: string;
  line?: number;
  column?: number;
  [key: string]: unknown;
}

/**
 * Error category for error classification
 */
export type ErrorCategory = 'save' | 'progression' | 'ui' | 'network' | 'module' | 'unknown';

/**
 * Error severity level
 */
export type ErrorSeverity = 'info' | 'warning' | 'error' | 'critical' | 'fatal';

/**
 * Error logging context
 */
export interface ErrorLogContext {
  componentStack?: string;
  retryCount?: number;
  gameContext?: Record<string, unknown>;
  platform?: string;
  platformVersion?: string | number;
  timestamp?: string;
  [key: string]: unknown;
}

/**
 * Type guard to check if value is an Error object
 */
export function isError(error: unknown): error is Error {
  return error instanceof Error;
}

/**
 * Type guard to check if value is an ErrorObject
 */
export function isErrorObject(error: unknown): error is ErrorObject {
  if (typeof error !== 'object' || error === null) {
    return false;
  }
  return 'message' in error && typeof (error as ErrorObject).message === 'string';
}

/**
 * Convert unknown error to ErrorObject
 */
export function toErrorObject(error: unknown): ErrorObject {
  if (isError(error)) {
    return {
      message: error.message,
      stack: error.stack,
      name: error.name,
      cause: error.cause,
    };
  }
  
  if (isErrorObject(error)) {
    return error;
  }
  
  if (typeof error === 'string') {
    return {
      message: error,
      name: 'Error',
    };
  }
  
  return {
    message: 'Unknown error',
    name: 'Error',
    cause: error,
  };
}

/**
 * Create a safe error object from any input
 */
export function createErrorObject(
  message: string,
  options?: {
    stack?: string;
    name?: string;
    code?: string | number;
    cause?: unknown;
    isFatal?: boolean;
  }
): EarlyError {
  return {
    message,
    stack: options?.stack,
    name: options?.name || 'Error',
    code: options?.code,
    cause: options?.cause,
    isFatal: options?.isFatal,
    timestamp: Date.now(),
  };
}

/**
 * Truncate error message to safe length
 */
export function truncateError(message: string, maxLength: number = 500): string {
  if (message.length <= maxLength) {
    return message;
  }
  return message.substring(0, maxLength - 3) + '...';
}

/**
 * Truncate stack trace to safe length
 */
export function truncateStack(stack: string | undefined, maxLength: number = 1000): string {
  if (!stack) {
    return '';
  }
  if (stack.length <= maxLength) {
    return stack;
  }
  // Keep first 20 lines and last 10 lines
  const lines = stack.split('\n');
  if (lines.length <= 30) {
    return stack.substring(0, maxLength - 3) + '...';
  }
  const firstLines = lines.slice(0, 20).join('\n');
  const lastLines = lines.slice(-10).join('\n');
  const truncated = `${firstLines}\n... (${lines.length - 30} lines omitted) ...\n${lastLines}`;
  return truncated.length > maxLength 
    ? truncated.substring(0, maxLength - 3) + '...'
    : truncated;
}

/**
 * Sanitize error context for logging
 */
export function sanitizeErrorContext(context: Record<string, unknown>): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};
  const maxSize = 1000; // Max size per value
  
  for (const [key, value] of Object.entries(context)) {
    if (value === null || value === undefined) {
      continue;
    }
    
    if (typeof value === 'string') {
      sanitized[key] = value.length > maxSize ? value.substring(0, maxSize) + '...' : value;
    } else if (typeof value === 'object') {
      try {
        const stringified = JSON.stringify(value);
        sanitized[key] = stringified.length > maxSize 
          ? stringified.substring(0, maxSize) + '...' 
          : JSON.parse(stringified);
      } catch {
        sanitized[key] = '[Object - serialization failed]';
      }
    } else {
      sanitized[key] = value;
    }
  }
  
  return sanitized;
}

