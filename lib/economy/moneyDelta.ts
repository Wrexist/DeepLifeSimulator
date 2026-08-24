/**
 * The pure money primitive — the one place a cash balance changes shape.
 *
 * `applyMoneyDelta` is the §4.4 helper: it charges or credits INSIDE the caller's
 * `setGameState` updater, re-checking affordability against `prev`, so a
 * double-tap in the same React batch cannot pay once and grant twice. It moves
 * `stats.money` and the daily-summary mirror and nothing else.
 *
 * It lived in `contexts/game/actions/MoneyActions.ts` (which still re-exports it
 * and `MONEY_CEILING`, unchanged, for its ~50 importers) despite being pure
 * `(state, amount, reason) → Partial<GameState> | null` — no React, no setter,
 * no wall clock. That forced `lib/retirement/elderActivities` to import UPWARD
 * into `contexts/`, inverting the app's one-way layering. The arithmetic belongs
 * at the lower layer; the `setGameState` wrappers around it (`updateMoney`,
 * `batchUpdateMoney`) legitimately do not, and stay where they are.
 */
import type { GameState } from '@/contexts/game/types';
import { logger } from '@/utils/logger';

// Scope kept as 'MoneyActions' so the log lines this helper emits read exactly
// as they did before the move — money-rejection warnings are grepped for in
// crash reports and bug threads.
const log = logger.scope('MoneyActions');

// R10-2: hard ceiling on cash. Without it a runaway exploit can push money to
// ~1e308 and then `currentMoney + amount` overflows to Infinity, which
// validateGameState treats as critical and RESETS to 0 on the next load (a worse
// outcome than capping). Capping keeps the save valid.
export const MONEY_CEILING = Number.MAX_SAFE_INTEGER;

/**
 * Pure spend helper for atomic "charge + grant" updaters (M-batch-A, R8).
 *
 * Mirrors `updateMoney`'s overdraft-reject + NaN guard + daily-summary tracking,
 * but as a PURE function you fold INTO an existing `setGameState` updater.
 * Returns the new `stats`/`dailySummary` slice, or `null` when the spend is
 * unaffordable/invalid (the caller should then `return prev`).
 *
 * Use this so a purchased good is granted in the SAME updater that debits the
 * money — closing the grant-then-charge race where two rapid taps both granted
 * the good while only one `updateMoney` charge went through.
 *
 *   setGameState((prev) => {
 *     const spend = applyMoneyDelta(prev, -cost, reason);
 *     if (!spend) return prev;          // unaffordable → reject atomically
 *     return { ...prev, ...spend, thing: [...] };
 *   });
 */
export function applyMoneyDelta(
  prev: GameState,
  amount: number,
  reason: string
): Pick<GameState, 'stats' | 'dailySummary'> | null {
  if (isNaN(amount) || !isFinite(amount)) {
    log.error(`applyMoneyDelta: invalid amount ${amount}. Reason: ${reason}`);
    return null;
  }
  const currentMoney =
    typeof prev.stats.money === 'number' && !isNaN(prev.stats.money) && isFinite(prev.stats.money)
      ? prev.stats.money
      : 0;
  // Overdraft reject - mirrors updateMoney's B-1 atomic affordability check.
  if (amount < 0 && currentMoney + amount < -0.01) {
    log.warn(
      `applyMoneyDelta rejected: insufficient funds. Has ${currentMoney}, needs ${Math.abs(amount)}. Reason: ${reason}`
    );
    return null;
  }
  const newMoney = Math.min(MONEY_CEILING, Math.max(0, currentMoney + amount));
  const moneyChange = newMoney - currentMoney;
  return {
    stats: { ...prev.stats, money: newMoney },
    dailySummary: {
      ...prev.dailySummary,
      moneyChange: (prev.dailySummary?.moneyChange || 0) + moneyChange,
      statsChange: { ...(prev.dailySummary?.statsChange || {}) },
      events: (prev.dailySummary?.events || []).slice(-50),
    },
  };
}
