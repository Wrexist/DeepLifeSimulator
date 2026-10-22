/**
 * When the two floating orbs may appear in a life (MON-7), and how the reward
 * orb / daily doubler present to a player who paid to remove ads (MON-5).
 *
 * MON-7 (owner decision 2026-10-22). Both orbs used to start on a wall-clock
 * timer after mount - the reward orb within ~1 minute and the Remove Ads sales
 * orb within ~3 - with no game-week gate, so a brand-new player was offered an
 * ad, and then offered the removal of ads they had never seen, in the middle
 * of onboarding. Banners already wait a full in-life year
 * (`BANNER_GRACE_WEEKS`) and interstitials longer. Both orbs now gate on weeks
 * played in THIS life (`weeksSinceLifeStart`, CLAUDE.md §4.2):
 *   - the reward orb from `REWARD_ORB_MIN_PLAYED_WEEKS` (8),
 *   - the Remove Ads orb only AFTER the banner grace, so there is an ad to
 *     remove by the time it is sold.
 *
 * MON-5 (owner decision 2026-10-22). Paying to remove ads used to remove the
 * rewarded bonuses too. Ad-free players now keep the reward orb and the daily
 * doubler as a DIRECT grant (`runRewardedAd`'s 'granted-direct' path) at the
 * same caps - the orb's one-cash-grant-per-week and the doubler's
 * 50-gem / still-pending-popup gate - labelled as an ad-free perk.
 */
import type { GameState } from '@/contexts/game/types';
import { WEEKS_PER_YEAR } from '@/lib/config/gameConstants';
import { weeksSinceLifeStart } from '@/utils/weekCounters';
import { adsAvailable } from '@/lib/ads/rewardedAd';

/**
 * A new player sees no banner for a full in-life year. The one definition:
 * `components/BannerAd.tsx` reads it, and the Remove Ads orb waits past it.
 */
export const BANNER_GRACE_WEEKS = WEEKS_PER_YEAR;

/** The reward orb first appears once this many weeks of THIS life are played. */
export const REWARD_ORB_MIN_PLAYED_WEEKS = 8;

/** The label an ad-free player sees on a rewarded bonus that needs no ad. */
export const AD_FREE_PERK_LABEL = 'Ad-free perk';

type WeekFields = Pick<GameState, 'weeksLived' | 'lifeStartWeek'>;

function playedWeeks(state: Partial<WeekFields> | null | undefined): number {
  return weeksSinceLifeStart(state?.weeksLived, state?.lifeStartWeek);
}

/** May the reward orb appear yet in this life? */
export function rewardOrbUnlocked(state: Partial<WeekFields> | null | undefined): boolean {
  return playedWeeks(state) >= REWARD_ORB_MIN_PLAYED_WEEKS;
}

/** May the Remove Ads orb appear yet? Only after the banner grace has ended. */
export function removeAdsOrbUnlocked(state: Partial<WeekFields> | null | undefined): boolean {
  return playedWeeks(state) > BANNER_GRACE_WEEKS;
}

/**
 * How the daily-reward doubler is offered:
 *   - 'perk' - the player paid to remove ads: a direct grant, labelled as an
 *     ad-free perk, never an ad;
 *   - 'ad'   - a real rewarded ad can be shown;
 *   - null   - neither (a build with no ad SDK, where it would be free gems).
 */
export function dailyBonusOfferMode(adsRemoved: boolean): 'perk' | 'ad' | null {
  if (adsRemoved) return 'perk';
  return adsAvailable(false) ? 'ad' : null;
}
