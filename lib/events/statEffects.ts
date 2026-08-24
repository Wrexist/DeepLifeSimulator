/**
 * Applying an event choice's `stats` deltas — with the currencies fenced out.
 *
 * ## The bug this exists to prevent (2026-08-24 gameplay audit)
 *
 * `GameStats` mixes two kinds of number: the four 0-100 wellbeing stats
 * (health, happiness, energy, fitness) plus reputation, and two CURRENCIES
 * (`money`, `gems`) that live on the same object for historical reasons. The
 * inline loop in `resolveEvent` clamped EVERY delivered key to 0-100 — so a
 * template that mis-filed money inside `stats` didn't add money, it OVERWROTE
 * the player's cash with at most $100. Two live producers did exactly that:
 * `policy_voting`'s Vote Yes (`money: policyEffects.money || 0` — even the `0`
 * destroyed cash, because `clamp(0, 100, cash + 0)` is 100 for anyone holding
 * more) and `tech_startup_success`'s Invest. A politician who voted yes on a
 * passing bill lost their entire balance.
 *
 * Both producers are fixed, but with ~400 authored templates the mistake WILL
 * be made again, so the consumer now refuses it: `money` and `gems` are
 * skipped here and warned about, never clamped. Money moves only through the
 * money path (`resolveEventMoney` + the affordability gate), gems only through
 * their explicit grant paths.
 */
import type { GameStats } from '@/contexts/game/types';
import { logger } from '@/utils/logger';

/** Keys on `GameStats` that are currencies, not 0-100 stats. */
export const EVENT_STAT_CURRENCY_KEYS = ['money', 'gems'] as const;

const isCurrencyKey = (key: string): boolean =>
  (EVENT_STAT_CURRENCY_KEYS as readonly string[]).includes(key);

/**
 * Apply `deltas` onto `updatedStats` in place (the caller owns the copy),
 * clamping each real stat to 0-100 and skipping the currency keys entirely.
 *
 * Mutating the passed object mirrors how `resolveEvent` has always treated its
 * `updatedStats` working copy; this is the same loop, extracted so the
 * currency fence is testable and so the next reader finds the reasoning above.
 */
export function applyEventStatDeltas(
  updatedStats: GameStats,
  deltas: Partial<GameStats> | undefined | null
): void {
  if (!deltas) return;
  Object.entries(deltas).forEach(([key, value]) => {
    if (typeof value !== 'number' || !Number.isFinite(value)) return;
    if (isCurrencyKey(key)) {
      // An authored template asked to move a currency through the stat clamp.
      // Dropping it beats destroying a balance; the warn is what gets it fixed.
      logger.warn(
        `[events] '${key}' inside effects.stats is ignored - use effects.money / an explicit grant instead`
      );
      return;
    }
    if (!(key in updatedStats)) return;
    const statKey = key as keyof GameStats;
    const currentVal = (updatedStats[statKey] as number) || 0;
    updatedStats[statKey] = Math.max(0, Math.min(100, currentVal + value));
  });
}
