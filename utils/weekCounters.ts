import { WEEKS_PER_MONTH } from '@/lib/config/gameConstants';

/**
 * Use absolute week for gameplay logic and fall back to legacy week values only
 * when older saves do not have weeksLived populated.
 */
export function resolveAbsoluteWeek(
  weeksLived: number | undefined,
  legacyWeek: number | undefined
): number {
  if (typeof weeksLived === 'number' && isFinite(weeksLived) && weeksLived >= 0) {
    return weeksLived;
  }
  if (typeof legacyWeek === 'number' && isFinite(legacyWeek) && legacyWeek >= 0) {
    return legacyWeek;
  }
  return 0;
}

/**
 * Convert legacy cyclical week markers (1-4) into absolute weeks so existing saves
 * remain valid after moving logic to weeksLived.
 */
export function normalizeStoredWeekToAbsolute(
  storedWeek: number | undefined,
  currentAbsoluteWeek: number,
  currentWeekOfMonth: number
): number {
  if (typeof storedWeek !== 'number' || !isFinite(storedWeek) || storedWeek < 0) {
    return 0;
  }

  const safeAbsoluteWeek = Math.max(0, Math.floor(currentAbsoluteWeek));
  const safeWeekOfMonth = Math.min(
    WEEKS_PER_MONTH,
    Math.max(1, Math.floor(currentWeekOfMonth || 1))
  );

  if (storedWeek <= WEEKS_PER_MONTH && safeAbsoluteWeek > WEEKS_PER_MONTH) {
    return Math.max(
      0,
      safeAbsoluteWeek - ((safeWeekOfMonth - storedWeek + WEEKS_PER_MONTH) % WEEKS_PER_MONTH)
    );
  }

  return Math.max(0, Math.floor(storedWeek));
}

export function getWeeksSinceStoredWeek(
  storedWeek: number | undefined,
  currentAbsoluteWeek: number,
  currentWeekOfMonth: number
): number {
  const normalized = normalizeStoredWeekToAbsolute(storedWeek, currentAbsoluteWeek, currentWeekOfMonth);
  return Math.max(0, currentAbsoluteWeek - normalized);
}
