/**
 * Compact relative "last played" label for the MainMenu Continue badge.
 *
 * The save-slot meta cache has carried `updatedAt` since it existed and the
 * Continue card always dropped it — yet "how long ago was I here?" is the
 * first thing a returning player re-establishes. Uppercase because the badge
 * renders in small caps; null when the stamp is missing or reads from the
 * future (a rewound device clock — never guess, the caller falls back to its
 * static label).
 */
export function lastPlayedLabel(updatedAt: number | undefined, now: number = Date.now()): string | null {
  if (typeof updatedAt !== 'number' || !Number.isFinite(updatedAt)) return null;
  const ms = now - updatedAt;
  if (ms < 0) return null;
  const mins = Math.floor(ms / 60000);
  if (mins < 60) return 'JUST NOW';
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}H AGO`;
  const days = Math.floor(hours / 24);
  if (days < 7) return days === 1 ? 'YESTERDAY' : `${days}D AGO`;
  const weeks = Math.floor(days / 7);
  return weeks === 1 ? '1W AGO' : `${weeks}W AGO`;
}
