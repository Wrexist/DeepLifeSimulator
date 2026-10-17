/**
 * Daily reward ad bonus: watch one rewarded ad to double the day's gems.
 *
 * The daily reward is the moment a player is most receptive to an optional ad
 * (a reward is already on screen, and the offer is "more of it"), which is why
 * most free-to-play games put a doubler there. Every other rewarded offer here
 * was ambient (the orb, the bank, Pulse), so this is the first one at a
 * high-value moment.
 *
 * The cap is the daily reward itself, up to 50 gems: the 7-day cycle is worth
 * 1,100 gems, so the doubler adds at most 350 a week. It needs no new save
 * field or cap of its own: it can only be redeemed while the day's reward
 * popup is still pending (`showDailyRewardPopup` + `dailyRewardAmount`), and
 * redeeming it closes that popup in the SAME updater, so it inherits the daily
 * claim's existing game-week gate (`lastLoginRewardWeek`, v31) and a double
 * tap or a doubled ad callback pays once (CLAUDE.md §4.4).
 */
import type { GameState } from '@/contexts/game/types';

export const DAILY_AD_BONUS_MAX_GEMS = 50;

/** The bonus a daily reward of `rewardGems` is worth: the same again, capped. */
export function dailyAdBonusFor(rewardGems: number | undefined): number {
  if (typeof rewardGems !== 'number' || !Number.isFinite(rewardGems) || rewardGems <= 0) return 0;
  return Math.min(DAILY_AD_BONUS_MAX_GEMS, Math.floor(rewardGems));
}

/**
 * Credit the bonus and close the daily reward popup, or return `prev` when the
 * popup has already been closed (claimed, or a first bonus already landed).
 */
export function applyDailyAdBonus(prev: GameState): GameState {
  if (!prev.showDailyRewardPopup) return prev;
  const bonus = dailyAdBonusFor(prev.dailyRewardAmount);
  if (bonus <= 0) return prev;
  const gems = typeof prev.stats?.gems === 'number' && Number.isFinite(prev.stats.gems) ? prev.stats.gems : 0;
  return {
    ...prev,
    showDailyRewardPopup: false,
    dailyRewardAmount: undefined,
    stats: { ...prev.stats, gems: gems + bonus },
  };
}
