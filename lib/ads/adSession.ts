/**
 * Per-session ad pacing memory: when this app session started, and when the
 * last fullscreen ad of each kind was shown.
 *
 * Session state on purpose, not save state. Every rule that reads it is about
 * how the REAL session feels ("never in the first two minutes", "not again
 * within three minutes of the last fullscreen ad"), and none of them gates a
 * reward the player could farm - rewards stay gated on game state
 * (CLAUDE.md §4.4). A fresh launch starting from zero is the correct answer.
 */

export type FullscreenKind = 'interstitial' | 'rewarded' | 'rewardedInterstitial';

interface AdSession {
  startedAt: number;
  /** Last fullscreen ad of any kind. */
  lastFullscreenAt: number;
  /** Last rewarded ad the player chose to watch (orb, bank, Pulse, daily bonus). */
  lastRewardedAt: number;
  /** Year-end breaks offered this session (shown or declined). */
  yearEndOffered: number;
}

const session: AdSession = {
  startedAt: Date.now(),
  lastFullscreenAt: 0,
  lastRewardedAt: 0,
  yearEndOffered: 0,
};

/** Record a fullscreen ad that actually presented. */
export function noteFullscreenShown(kind: FullscreenKind, now: number = Date.now()): void {
  session.lastFullscreenAt = now;
  if (kind === 'rewarded') session.lastRewardedAt = now;
}

/** Record that a year-end break was put in front of the player. */
export function noteYearEndOffered(): void {
  session.yearEndOffered++;
}

export function adSessionSnapshot(): Readonly<AdSession> {
  return { ...session };
}

/** Test-only. */
export function __resetAdSession(startedAt: number = Date.now()): void {
  session.startedAt = startedAt;
  session.lastFullscreenAt = 0;
  session.lastRewardedAt = 0;
  session.yearEndOffered = 0;
}
