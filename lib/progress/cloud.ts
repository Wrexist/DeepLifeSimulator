import { rateLimited, RATE_LIMITS } from '@/utils/rateLimiter';
import { withErrorRecovery } from '@/utils/errorRecovery';
import { logger } from '@/utils/logger';

const log = logger.scope('CloudSync');

export interface CloudSave {
  state: any;
  updatedAt: number;
}

export interface LeaderboardEntry {
  name: string;
  score: number;
  category: string;
}

const API_URL = process.env.EXPO_PUBLIC_CLOUD_SAVE_URL;
const CLOUD_SYNC_TIMEOUT = 5000; // 5 seconds

// Track cloud sync failures for session
let cloudSyncFailureCount = 0;
let cloudSyncNotificationShown = false;
let cloudSyncDisabled = false;
const MAX_CONSECUTIVE_FAILURES = 3;

/**
 * Create a fetch request with timeout using AbortController
 */
async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs: number = CLOUD_SYNC_TIMEOUT): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error(`Request timeout after ${timeoutMs}ms`);
    }
    throw error;
  }
}

/**
 * Reset cloud sync failure tracking (call on successful sync)
 */
export function resetCloudSyncFailures(): void {
  cloudSyncFailureCount = 0;
  cloudSyncDisabled = false;
}

/**
 * Get cloud sync status
 */
export function getCloudSyncStatus(): { disabled: boolean; failureCount: number; notificationShown: boolean } {
  return {
    disabled: cloudSyncDisabled,
    failureCount: cloudSyncFailureCount,
    notificationShown: cloudSyncNotificationShown,
  };
}

/**
 * Mark that cloud sync notification has been shown
 */
export function markCloudSyncNotificationShown(): void {
  cloudSyncNotificationShown = true;
}

export async function uploadGameState(save: CloudSave): Promise<{ success: boolean; error?: string; shouldNotify?: boolean }> {
  if (!API_URL) return { success: true };
  
  // If cloud sync is disabled, skip silently
  if (cloudSyncDisabled) {
    return { success: true }; // Return success to not block local save
  }
  
  try {
    await withErrorRecovery(
      'cloud-sync',
      async () => {
        await rateLimited('CLOUD_SYNC', async () => {
          try {
            const response = await fetchWithTimeout(
              `${API_URL}/save`,
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(save),
              },
              CLOUD_SYNC_TIMEOUT
            );
            if (!response.ok) {
              throw new Error(`Upload failed with status ${response.status}`);
            }
            log.info('Game state uploaded successfully');
            // Reset failure count on success
            cloudSyncFailureCount = 0;
          } catch (error: any) {
            if (error.message?.includes('timeout')) {
              log.warn('Cloud upload timed out');
              throw new Error('Cloud sync timeout - service may be unavailable');
            }
            throw error;
          }
        }, (remaining, resetTime) => {
          log.warn(`Rate limit exceeded. ${remaining} requests remaining. Resets in ${Math.ceil((resetTime - Date.now()) / 1000)}s`);
        });
      },
      async () => {
        // Fallback: save to local storage only
        log.warn('Cloud upload failed, using local storage only');
        cloudSyncFailureCount++;
        
        // Disable cloud sync after max consecutive failures
        if (cloudSyncFailureCount >= MAX_CONSECUTIVE_FAILURES) {
          cloudSyncDisabled = true;
          log.warn(`Cloud sync disabled after ${MAX_CONSECUTIVE_FAILURES} consecutive failures`);
        }
      },
      { maxRetries: 2, initialDelayMs: 500 }
    );
    
    return { success: true };
  } catch (error: any) {
    cloudSyncFailureCount++;
    
    // Disable cloud sync after max consecutive failures
    if (cloudSyncFailureCount >= MAX_CONSECUTIVE_FAILURES) {
      cloudSyncDisabled = true;
      log.warn(`Cloud sync disabled after ${MAX_CONSECUTIVE_FAILURES} consecutive failures`);
    }
    
    // Return info about whether to notify user (only first failure in session)
    const shouldNotify = !cloudSyncNotificationShown && cloudSyncFailureCount === 1;
    
    return {
      success: false,
      error: error.message || 'Cloud sync failed',
      shouldNotify,
    };
  }
}

export async function uploadLeaderboardScore(entry: LeaderboardEntry) {
  if (!API_URL) return;
  try {
    await rateLimited('LEADERBOARD', async () => {
      try {
        const response = await fetchWithTimeout(
          `${API_URL}/leaderboard/${entry.category}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: entry.name, score: entry.score }),
          },
          CLOUD_SYNC_TIMEOUT
        );
        if (!response.ok) {
          throw new Error(`Leaderboard upload failed with status ${response.status}`);
        }
        log.info('Leaderboard score uploaded successfully');
      } catch (error: any) {
        if (error.message?.includes('timeout')) {
          log.warn('Leaderboard upload timed out');
          throw new Error('Leaderboard sync timeout - service may be unavailable');
        }
        throw error;
      }
    }, (remaining, resetTime) => {
      log.warn(`Rate limit exceeded. ${remaining} requests remaining. Resets in ${Math.ceil((resetTime - Date.now()) / 1000)}s`);
    });
  } catch (err) {
    if (err instanceof Error && err.message.includes('Rate limit exceeded')) {
      log.warn('Leaderboard upload rate limited', err);
      throw err; // Re-throw rate limit errors
    }
    log.warn('Leaderboard upload failed', err);
  }
}

export async function fetchLeaderboard(category: string): Promise<LeaderboardEntry[]> {
  if (!API_URL) return [];
  try {
    return await rateLimited('API_GENERAL', async () => {
      try {
        const res = await fetchWithTimeout(
          `${API_URL}/leaderboard/${category}`,
          { method: 'GET' },
          CLOUD_SYNC_TIMEOUT
        );
        if (!res.ok) return [];
        const data = (await res.json()) as LeaderboardEntry[];
        log.info(`Fetched ${data.length} leaderboard entries for ${category}`);
        return data;
      } catch (error: any) {
        if (error.message?.includes('timeout')) {
          log.warn('Leaderboard fetch timed out');
          return []; // Return empty array on timeout
        }
        throw error;
      }
    }, (remaining, resetTime) => {
      log.warn(`Rate limit exceeded. ${remaining} requests remaining. Resets in ${Math.ceil((resetTime - Date.now()) / 1000)}s`);
    });
  } catch (err) {
    if (err instanceof Error && err.message.includes('Rate limit exceeded')) {
      log.warn('Leaderboard fetch rate limited', err);
      return []; // Return empty array on rate limit
    }
    log.warn('Leaderboard fetch failed', err);
    return [];
  }
}

export async function downloadGameState(): Promise<CloudSave | null> {
  if (!API_URL) return null;
  
  try {
    return await withErrorRecovery(
      'cloud-download',
      async () => {
        return await rateLimited('CLOUD_SYNC', async () => {
          try {
            const res = await fetchWithTimeout(
              `${API_URL}/save`,
              { method: 'GET' },
              CLOUD_SYNC_TIMEOUT
            );
            if (!res.ok) {
              throw new Error(`Download failed with status ${res.status}`);
            }
            const data = (await res.json()) as CloudSave;
            log.info('Game state downloaded successfully');
            return data;
          } catch (error: any) {
            if (error.message?.includes('timeout')) {
              log.warn('Cloud download timed out');
              throw new Error('Cloud sync timeout - service may be unavailable');
            }
            throw error;
          }
        }, (remaining, resetTime) => {
          log.warn(`Rate limit exceeded. ${remaining} requests remaining. Resets in ${Math.ceil((resetTime - Date.now()) / 1000)}s`);
        });
      },
      async () => {
        // Fallback: return null (use local save)
        log.warn('Cloud download failed, using local save');
        return null;
      },
      { maxRetries: 2, initialDelayMs: 500 }
    );
  } catch (err) {
    log.warn('Cloud download failed', err);
    return null;
  }
}
