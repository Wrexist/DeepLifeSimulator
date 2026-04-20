import { rateLimited } from '@/utils/rateLimiter';
import { withErrorRecovery } from '@/utils/errorRecovery';
import { logger } from '@/utils/logger';

const log = logger.scope('CloudSync');

export interface CloudSave {
  state: any;
  updatedAt: number;
  slotId?: string;
  userId?: string;
  revision?: number;
  hash?: string;
  signature?: string;
}

export interface LeaderboardEntry {
  name: string;
  score: number;
  category: string;
  userId?: string;
  runSignature?: string;
  revision?: number;
}

export interface CloudReadRequest {
  userId?: string;
  slotId?: string;
}

// Defensive: API_URL can be undefined if env var not set (handled at usage sites)
const API_URL: string | undefined = process.env.EXPO_PUBLIC_CLOUD_SAVE_URL;
const CLOUD_AUTH_TOKEN: string | undefined = process.env.EXPO_PUBLIC_CLOUD_AUTH_TOKEN;
const CLOUD_REQUIRE_AUTH = process.env.EXPO_PUBLIC_CLOUD_REQUIRE_AUTH !== 'false';
const CLOUD_SYNC_TIMEOUT = 5000; // 5 seconds
const MIN_CLOUD_REVISION = 1;
const RESERVED_USER_IDS = new Set(['local_player', 'guest', 'anonymous', 'unknown', 'null', 'undefined']);

// Track cloud sync failures for session
let cloudSyncFailureCount = 0;
let cloudSyncNotificationShown = false;
let cloudSyncDisabled = false;
const MAX_CONSECUTIVE_FAILURES = 3;

function cloudWritesAllowed(): boolean {
  if (__DEV__) return true;
  // In production, cloud writes must be authenticated even if a config accidentally disables auth.
  if (!CLOUD_REQUIRE_AUTH) return false;
  return Boolean(CLOUD_AUTH_TOKEN && CLOUD_AUTH_TOKEN.trim().length > 0);
}

function cloudReadsAllowed(): boolean {
  if (__DEV__) return true;
  if (!CLOUD_REQUIRE_AUTH) return false;
  return Boolean(CLOUD_AUTH_TOKEN && CLOUD_AUTH_TOKEN.trim().length > 0);
}

function isValidCloudUserId(userId?: string): boolean {
  if (!userId || typeof userId !== 'string') return false;
  const normalized = userId.trim().toLowerCase();
  if (normalized.length < 3) return false;
  if (RESERVED_USER_IDS.has(normalized)) return false;
  return true;
}

function isValidSlotId(slotId?: string): boolean {
  if (!slotId || typeof slotId !== 'string') return false;
  return /^slot_[1-3]$/.test(slotId.trim());
}

function hasIntegrityProof(hash?: string, signature?: string): boolean {
  return (
    typeof hash === 'string' &&
    hash.trim().length >= 8 &&
    typeof signature === 'string' &&
    signature.trim().length >= 16
  );
}

function buildCloudHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const headers: Record<string, string> = {
    ...extra,
  };
  if (CLOUD_AUTH_TOKEN) {
    headers.Authorization = `Bearer ${CLOUD_AUTH_TOKEN}`;
  }
  return headers;
}

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
  if (!cloudWritesAllowed()) {
    return { success: false, error: 'Cloud writes require authenticated session' };
  }
  if (!__DEV__) {
    const hasRequiredMetadata = Boolean(
      isValidCloudUserId(save.userId) &&
      isValidSlotId(save.slotId) &&
      typeof save.revision === 'number' &&
      Number.isFinite(save.revision) &&
      save.revision >= MIN_CLOUD_REVISION &&
      hasIntegrityProof(save.hash, save.signature)
    );
    if (!hasRequiredMetadata) {
      return {
        success: false,
        error: 'Missing or invalid cloud save metadata (userId, slotId, revision, hash, signature)',
      };
    }
  }
  
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
                headers: buildCloudHeaders({ 'Content-Type': 'application/json' }),
                body: JSON.stringify({
                  state: save.state,
                  updatedAt: save.updatedAt,
                  userId: save.userId,
                  slotId: save.slotId,
                  revision: save.revision,
                  hash: save.hash,
                  signature: save.signature,
                }),
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
  if (!cloudWritesAllowed()) return;
  if (!__DEV__) {
    const validLeaderboardPayload = Boolean(
      isValidCloudUserId(entry.userId) &&
      typeof entry.name === 'string' &&
      entry.name.trim().length >= 1 &&
      Number.isFinite(entry.score) &&
      entry.score >= 0 &&
      typeof entry.category === 'string' &&
      entry.category.trim().length > 0 &&
      typeof entry.revision === 'number' &&
      Number.isFinite(entry.revision) &&
      entry.revision >= MIN_CLOUD_REVISION &&
      typeof entry.runSignature === 'string' &&
      entry.runSignature.trim().length >= 16
    );
    if (!validLeaderboardPayload) {
      log.warn('Blocked leaderboard upload: missing trusted identity or run proof');
      return;
    }
  }
  try {
    await rateLimited('LEADERBOARD', async () => {
      try {
        const response = await fetchWithTimeout(
          `${API_URL}/leaderboard/${entry.category}`,
          {
            method: 'POST',
            headers: buildCloudHeaders({ 'Content-Type': 'application/json' }),
            body: JSON.stringify({
              name: entry.name,
              score: entry.score,
              userId: entry.userId,
              runSignature: entry.runSignature,
              revision: entry.revision,
            }),
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
    const errorMessage = err instanceof Error ? err.message : String(err);
    if (err instanceof Error && err.message.includes('Rate limit exceeded')) {
      log.warn('Leaderboard upload rate limited', { error: errorMessage });
      throw err; // Re-throw rate limit errors
    }
    log.warn('Leaderboard upload failed', { error: errorMessage });
  }
}

export async function fetchLeaderboard(category: string): Promise<LeaderboardEntry[]> {
  if (!API_URL) return [];
  try {
    return await rateLimited('API_GENERAL', async () => {
      try {
        const res = await fetchWithTimeout(
          `${API_URL}/leaderboard/${category}`,
          { method: 'GET', headers: buildCloudHeaders() },
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
      log.warn('Leaderboard fetch rate limited', { error: err instanceof Error ? err.message : String(err) });
      return []; // Return empty array on rate limit
    }
    const errorMessage = err instanceof Error ? err.message : String(err);
    log.warn('Leaderboard fetch failed', { error: errorMessage });
    return [];
  }
}

export async function downloadGameState(request?: CloudReadRequest): Promise<CloudSave | null> {
  if (!API_URL) return null;
  if (!cloudReadsAllowed()) return null;
  if (!__DEV__) {
    const hasRequiredMetadata = Boolean(
      isValidCloudUserId(request?.userId) &&
      isValidSlotId(request?.slotId)
    );
    if (!hasRequiredMetadata) {
      log.warn('Cloud download blocked: missing metadata (userId, slotId)');
      return null;
    }
  }
  
  try {
    return await withErrorRecovery(
      'cloud-download',
      async () => {
        return await rateLimited('CLOUD_SYNC', async () => {
          try {
            const queryParts: string[] = [];
            if (request?.userId) queryParts.push(`userId=${encodeURIComponent(request.userId)}`);
            if (request?.slotId) queryParts.push(`slotId=${encodeURIComponent(request.slotId)}`);
            const queryString = queryParts.join('&');
            const saveUrl = queryString ? `${API_URL}/save?${queryString}` : `${API_URL}/save`;
            const res = await fetchWithTimeout(
              saveUrl,
              { method: 'GET', headers: buildCloudHeaders() },
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
    const errorMessage = err instanceof Error ? err.message : String(err);
    log.warn('Cloud download failed', { error: errorMessage });
    return null;
  }
}
