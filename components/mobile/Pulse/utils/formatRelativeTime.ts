/**
 * Format a post's age relative to the current game week.
 *
 * Pulse posts carry `gameWeek` (weeksLived absolute). The feed compares
 * each post to `currentWeeksLived` and renders "now / 2d / 1w / 3w / 2mo".
 *
 * The threshold semantics:
 *   <= 0  → "now"
 *   1     → "1w"          (1 weeksLived = 1 in-game week)
 *   ≤ 8   → "Nw"
 *   ≤ 52  → "Nmo"         (4 weeks per month in this sim)
 *   > 52  → "Ny"
 */
export function formatRelativeWeek(
  postWeek: number | undefined,
  currentWeeksLived: number,
): string {
  if (typeof postWeek !== 'number' || !Number.isFinite(postWeek)) return '';
  const diff = Math.max(0, currentWeeksLived - postWeek);
  if (diff === 0) return 'now';
  if (diff <= 8) return `${diff}w`;
  if (diff <= 52) return `${Math.floor(diff / 4)}mo`;
  return `${Math.floor(diff / 52)}y`;
}

/**
 * Format a real wall-clock timestamp ago (used for live stream chat,
 * notifications timed by real ms). 5m / 1h / 2d.
 */
export function formatRelativeRealTime(timestampMs: number, nowMs: number = Date.now()): string {
  const diffSec = Math.max(0, Math.floor((nowMs - timestampMs) / 1000));
  if (diffSec < 5) return 'now';
  if (diffSec < 60) return `${diffSec}s`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d`;
  const diffWeek = Math.floor(diffDay / 7);
  if (diffWeek < 4) return `${diffWeek}w`;
  return `${Math.floor(diffDay / 30)}mo`;
}
