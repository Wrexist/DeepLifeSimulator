import { AppState, AppStateStatus } from 'react-native';

// REMOVED: NetInfo import - causing iOS 26 crashes
// Network connectivity checks disabled for iOS 26 compatibility

// CRITICAL: Lazy load AsyncStorage to prevent TurboModule crash on iOS 26 Beta
// (Same pattern used in storageWrapper.ts and ErrorBoundary.tsx)
let _realAsyncStorage: typeof import('@react-native-async-storage/async-storage').default | null = null;
let _lastLoadAttempt = 0;
const _LOAD_RETRY_COOLDOWN_MS = 2000;

function getLazyAsyncStorage() {
  if (_realAsyncStorage) return _realAsyncStorage;
  const now = Date.now();
  if (_lastLoadAttempt > 0 && now - _lastLoadAttempt < _LOAD_RETRY_COOLDOWN_MS) return null;
  _lastLoadAttempt = now;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    _realAsyncStorage = require('@react-native-async-storage/async-storage').default;
    return _realAsyncStorage;
  } catch {
    return null;
  }
}

// Lazy-loaded AsyncStorage proxy — same interface as real AsyncStorage
const AsyncStorage = {
  getItem: async (key: string): Promise<string | null> => {
    const storage = getLazyAsyncStorage();
    return storage ? storage.getItem(key) : null;
  },
  setItem: async (key: string, value: string): Promise<void> => {
    const storage = getLazyAsyncStorage();
    if (storage) await storage.setItem(key, value);
  },
  removeItem: async (key: string): Promise<void> => {
    const storage = getLazyAsyncStorage();
    if (storage) await storage.removeItem(key);
  },
};

export interface LogEntry {
  id: string;
  timestamp: string;
  level: string;
  message: string;
  context?: any;
  error?: any;
  deviceInfo?: any;
}

const LOG_STORAGE_KEY = 'unsynced_logs';
const MAX_LOGS = 100; // Reduced to prevent quota issues
const SYNC_INTERVAL = 60000; // 1 minute
const BATCH_SIZE = 50;
const MAX_STORAGE_SIZE = 50000; // Max size in characters (~50KB)

// R7 Phase 5 (5.4): defense-in-depth sanitizer for log context fields.
// Logs never leave the device today (remoteUrl is null) but they ARE
// persisted to AsyncStorage and shown in the in-app log viewer. Any
// caller that accidentally puts a credential / receipt / signature into
// `context` gets it stripped here BEFORE persist + sync. The audit
// confirmed no current callsites leak these keys; this is a guardrail
// against future regressions.
const SENSITIVE_CONTEXT_KEYS = new Set<string>([
  'hmac', 'signature', 'saveKey', 'saveHmacKey', 'hmacKey',
  'receipt', 'receiptData', 'purchaseToken', 'verificationData',
  'apiKey', 'secret', 'token', 'accessToken', 'refreshToken',
  'password', 'credential',
  'email', 'phoneNumber', 'address',
  'cloudUserId', 'deviceId', 'installationId', 'advertisingId',
]);
const REDACTED = '[REDACTED]';

export function sanitizeLogContext(value: unknown, depth = 0): unknown {
  return sanitizeContext(value, depth);
}

function sanitizeContext(value: unknown, depth = 0): unknown {
  if (value == null || depth > 4) return value;
  if (typeof value !== 'object') return value;
  if (Array.isArray(value)) {
    return value.map((v) => sanitizeContext(v, depth + 1));
  }
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (SENSITIVE_CONTEXT_KEYS.has(k)) {
      out[k] = REDACTED;
    } else {
      out[k] = sanitizeContext(v, depth + 1);
    }
  }
  return out;
}

class RemoteLoggingService {
  private queue: LogEntry[] = [];
  private isSyncing = false;
  private syncIntervalId: ReturnType<typeof setInterval> | null = null;
  private remoteUrl: string | null = null;
  private listeners: ((logs: LogEntry[]) => void)[] = [];
  private appStateSubscription: ReturnType<typeof AppState.addEventListener> | null = null;
  private isInitialized = false;

  constructor() {
    // CRITICAL: Do NOT call AsyncStorage in constructor
    // This executes at module load time and can crash the app
    // Defer initialization until after app renders
    // Use lazy initialization pattern
    this.queue = [];
    // Do NOT call loadQueue() here - it will be called on first use
    // Do NOT call startSync() here - it will be called on first use
    // AppState listener will be set up on first use
  }

  // Lazy initialization - call this on first use, not in constructor
  // CRITICAL: Only add AppState listener once to prevent leaks
  private ensureInitialized(): void {
    if (this.isInitialized) {
      return;
    }
    
    this.isInitialized = true;
    this.loadQueue();
    this.startSync();
    
    // CRITICAL: Only add listener once, store subscription for cleanup
    if (!this.appStateSubscription) {
      this.appStateSubscription = AppState.addEventListener('change', this.handleAppStateChange);
    }
  }

  // Cleanup method for when service is no longer needed
  cleanup(): void {
    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
      this.appStateSubscription = null;
    }
    this.stopSync();
    this.isInitialized = false;
  }

  configure(url: string | null) {
    this.remoteUrl = url;
  }

  private handleAppStateChange = (nextAppState: AppStateStatus) => {
    if (nextAppState === 'active') {
      this.startSync();
    } else if (nextAppState === 'background') {
      this.persistQueue();
      this.stopSync();
    }
  };

  private async loadQueue() {
    try {
      const storedLogs = await AsyncStorage.getItem(LOG_STORAGE_KEY);
      if (storedLogs) {
        const parsedLogs = JSON.parse(storedLogs);
        this.queue = [...parsedLogs, ...this.queue].sort(
          (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        );
        // Trim if needed
        if (this.queue.length > MAX_LOGS) {
          this.queue = this.queue.slice(this.queue.length - MAX_LOGS);
        }
        this.notifyListeners();
      }
    } catch (error) {
      if (__DEV__) {
        console.error('Failed to load log queue', error);
      }
    }
  }

  private async persistQueue() {
    try {
      // Aggressively trim queue before persisting
      if (this.queue.length > MAX_LOGS) {
        this.queue = this.queue.slice(this.queue.length - MAX_LOGS);
      }
      
      const serialized = JSON.stringify(this.queue);
      
      // Check size and trim more if needed
      if (serialized.length > MAX_STORAGE_SIZE) {
        // Keep only the most recent logs that fit
        let trimmedQueue = [...this.queue];
        while (JSON.stringify(trimmedQueue).length > MAX_STORAGE_SIZE && trimmedQueue.length > 10) {
          trimmedQueue = trimmedQueue.slice(1); // Remove oldest
        }
        this.queue = trimmedQueue;
      }
      
      await AsyncStorage.setItem(LOG_STORAGE_KEY, JSON.stringify(this.queue));
    } catch (error: any) {
      // Handle quota exceeded error
      if (error?.name === 'QuotaExceededError' || error?.message?.includes('quota')) {
        // Aggressively clear old logs
        const keepCount = Math.floor(this.queue.length * 0.1); // Keep only 10% of logs
        this.queue = this.queue.slice(this.queue.length - keepCount);
        
        try {
          // Try again with reduced logs
          await AsyncStorage.setItem(LOG_STORAGE_KEY, JSON.stringify(this.queue));
        } catch (retryError) {
          // If still failing, clear all logs
          this.queue = [];
          try {
            await AsyncStorage.removeItem(LOG_STORAGE_KEY);
          } catch (clearError) {
            // Silent fail - can't do anything more
          }
        }
      } else if (__DEV__) {
        console.error('Failed to persist log queue', error);
      }
    }
  }

  log(entry: Omit<LogEntry, 'id' | 'timestamp'>) {
    // Lazy initialization - ensure service is initialized on first use
    this.ensureInitialized();

    // R7 Phase 5 (5.4): scrub sensitive fields from context + error before
    // anything is persisted or queued. See SENSITIVE_CONTEXT_KEYS above.
    const sanitizedContext = entry.context !== undefined
      ? sanitizeContext(entry.context)
      : entry.context;
    const sanitizedError = entry.error !== undefined
      ? sanitizeContext(entry.error)
      : entry.error;

    const newLog: LogEntry = {
      ...entry,
      context: sanitizedContext,
      error: sanitizedError,
      id: Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15),
      timestamp: new Date().toISOString(),
    };

    this.queue.push(newLog);
    
    // Aggressively trim to prevent quota issues
    if (this.queue.length > MAX_LOGS) {
      this.queue = this.queue.slice(this.queue.length - MAX_LOGS);
    }

    // Throttle persistence to avoid quota issues
    // Only persist every 10 logs or on important events
    if (this.queue.length % 10 === 0 || entry.level === 'error') {
      this.persistQueue();
    }
    
    this.notifyListeners();
  }

  getLogs(): LogEntry[] {
    // Lazy initialization - ensure service is initialized on first use
    this.ensureInitialized();
    return [...this.queue].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  clearLogs() {
    // Lazy initialization - ensure service is initialized on first use
    this.ensureInitialized();
    this.queue = [];
    this.persistQueue();
    this.notifyListeners();
  }

  subscribe(listener: (logs: LogEntry[]) => void) {
    // Lazy initialization - ensure service is initialized on first use
    this.ensureInitialized();
    this.listeners.push(listener);
    listener(this.getLogs());
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notifyListeners() {
    const logs = this.getLogs();
    this.listeners.forEach(listener => listener(logs));
  }

  private startSync() {
    if (this.syncIntervalId) return;
    this.syncIntervalId = setInterval(() => this.sync(), SYNC_INTERVAL);
  }

  private stopSync() {
    if (this.syncIntervalId) {
      clearInterval(this.syncIntervalId);
      this.syncIntervalId = null;
    }
  }

  private async sync() {
    if (this.isSyncing || !this.remoteUrl || this.queue.length === 0) return;

    // REMOVED: Network connectivity check - causing iOS 26 crashes
    // Assume always connected for iOS 26 compatibility

    this.isSyncing = true;

    // R7 Phase 5: AbortController-backed fetch timeout. The previous safety
    // timeout only reset `isSyncing` — the underlying fetch could still
    // resolve later and waste a request + memory. AbortController actually
    // cancels the request. The 15s envelope is a soft cap, separate from
    // the 10s abort, so a network stuck mid-handshake can't pin the flag.
    const abortController = new AbortController();
    const abortTimeout = setTimeout(() => abortController.abort(), 10000);
    const syncTimeout = setTimeout(() => {
      this.isSyncing = false;
    }, 15000);

    try {
      const batch = this.queue.slice(0, BATCH_SIZE);

      const response = await fetch(this.remoteUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ logs: batch }),
        signal: abortController.signal,
      });

      if (response.ok) {
        // Remove synced logs
        const syncedIds = new Set(batch.map(l => l.id));
        this.queue = this.queue.filter(l => !syncedIds.has(l.id));
        await this.persistQueue();
        this.notifyListeners();
      }
    } catch (error) {
      // Silent fail on sync error (covers both network failure and abort)
    } finally {
      clearTimeout(abortTimeout);
      clearTimeout(syncTimeout);
      this.isSyncing = false;
    }
  }
}

export const remoteLogger = new RemoteLoggingService();


