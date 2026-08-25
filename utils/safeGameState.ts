/**
 * Safe accessors for commonly-dereferenced GameState fields.
 *
 * Round 2 finding: ~14 components destructure `settings` (or `stats`, `date`,
 * `userProfile`) directly from `gameState` and then deref subfields without a
 * guard. When a save load races a render, or when DevTools / migration / a
 * mis-shaped setGameState leaves one of these undefined, every consumer
 * crashes simultaneously — and in the case of DeathPopup/Tombstone, the modal
 * blocks dismissal so the player is hard soft-locked at the worst moment.
 *
 * The CLAUDE.md Hard Rule #2 forbids "union without guards". These helpers
 * provide the canonical safe shape with sensible defaults so callers can do:
 *
 *   const settings = safeSettings(gameState);
 *   settings.darkMode  // never throws
 *
 * The defaults match `initialGameState` for the fields that are read most
 * often by UI code (darkMode, hapticFeedback, autoSave, weeklySummaryEnabled).
 */

import type { GameState, GameStats, GameDate, UserProfile } from '@/contexts/game/types';

const DEFAULT_SETTINGS = {
  lifetimePremium: false,
  darkMode: true,
  soundEnabled: true,
  hapticFeedback: true,
  notificationsEnabled: true,
  autoSave: true,
  language: 'English',
  maxStats: false,
  weeklySummaryEnabled: true,
  showDecimalsInStats: false,
} as const;

const DEFAULT_STATS: GameStats = {
  health: 100,
  happiness: 100,
  energy: 100,
  fitness: 10,
  money: 200,
  reputation: 0,
  gems: 0,
};

const DEFAULT_DATE: GameDate = {
  year: 2025,
  month: 'January',
  week: 1,
  age: 18,
};

const DEFAULT_USER_PROFILE: Partial<UserProfile> = {
  name: 'Unknown',
};

export function safeSettings(gameState: GameState | null | undefined): GameState['settings'] {
  if (!gameState || !gameState.settings || typeof gameState.settings !== 'object') {
    return { ...DEFAULT_SETTINGS } as GameState['settings'];
  }
  return gameState.settings;
}

export function safeStats(gameState: GameState | null | undefined): GameStats {
  if (!gameState || !gameState.stats || typeof gameState.stats !== 'object') {
    return { ...DEFAULT_STATS };
  }
  return gameState.stats;
}

export function safeDate(gameState: GameState | null | undefined): GameDate {
  if (!gameState || !gameState.date || typeof gameState.date !== 'object') {
    return { ...DEFAULT_DATE };
  }
  return gameState.date;
}

export function safeUserProfile(gameState: GameState | null | undefined): UserProfile {
  if (!gameState || !gameState.userProfile || typeof gameState.userProfile !== 'object') {
    return { ...DEFAULT_USER_PROFILE } as UserProfile;
  }
  return gameState.userProfile;
}

/**
 * Convenience: return just the dark-mode flag. Most components only need this.
 */
export function safeDarkMode(gameState: GameState | null | undefined): boolean {
  return safeSettings(gameState).darkMode ?? true;
}
