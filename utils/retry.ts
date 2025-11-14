/**
 * Retry mechanism for async operations
 */
export interface RetryOptions {
  maxAttempts?: number;
  delay?: number;
  backoff?: 'linear' | 'exponential';
  maxDelay?: number;
  retryCondition?: (error: any) => boolean;
}

/**
 * Retry an async operation with configurable options
 */
export async function retry<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxAttempts = 3,
    delay = 1000,
    backoff = 'exponential',
    maxDelay = 10000,
    retryCondition = () => true,
  } = options;

  let lastError: any;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      
      // Check if we should retry this error
      if (!retryCondition(error)) {
        throw error;
      }
      
      // Don't wait after the last attempt
      if (attempt === maxAttempts) {
        break;
      }
      
      // Calculate delay for this attempt
      const currentDelay = calculateDelay(attempt, delay, backoff, maxDelay);
      
      console.log(`Attempt ${attempt} failed, retrying in ${currentDelay}ms:`, error.message);
      await sleep(currentDelay);
    }
  }
  
  throw lastError;
}

/**
 * Calculate delay based on attempt number and backoff strategy
 */
function calculateDelay(
  attempt: number,
  baseDelay: number,
  backoff: 'linear' | 'exponential',
  maxDelay: number
): number {
  let delay: number;
  
  if (backoff === 'exponential') {
    delay = baseDelay * Math.pow(2, attempt - 1);
  } else {
    delay = baseDelay * attempt;
  }
  
  return Math.min(delay, maxDelay);
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry with exponential backoff (default configuration)
 */
export async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  maxAttempts: number = 3
): Promise<T> {
  return retry(operation, {
    maxAttempts,
    delay: 1000,
    backoff: 'exponential',
    maxDelay: 10000,
  });
}

/**
 * Retry for network operations
 */
export async function retryNetwork<T>(
  operation: () => Promise<T>,
  maxAttempts: number = 3
): Promise<T> {
  return retry(operation, {
    maxAttempts,
    delay: 500,
    backoff: 'exponential',
    maxDelay: 5000,
    retryCondition: (error) => {
      // Retry on network errors, timeouts, and 5xx errors
      return (
        error.code === 'NETWORK_ERROR' ||
        error.code === 'TIMEOUT' ||
        (error.status >= 500 && error.status < 600) ||
        error.message.includes('network') ||
        error.message.includes('timeout')
      );
    },
  });
}

/**
 * Retry for storage operations
 */
export async function retryStorage<T>(
  operation: () => Promise<T>,
  maxAttempts: number = 3
): Promise<T> {
  return retry(operation, {
    maxAttempts,
    delay: 200,
    backoff: 'linear',
    maxDelay: 2000,
    retryCondition: (error) => {
      // Retry on storage errors
      return (
        error.message.includes('storage') ||
        error.message.includes('AsyncStorage') ||
        error.code === 'STORAGE_ERROR'
      );
    },
  });
}
