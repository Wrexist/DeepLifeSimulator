/**
 * MON2-2: the Legacy Pass season must never roll BACKWARD.
 *
 * Seasons come from the device clock and every rollover resets the pass
 * (after auto-collecting earned rewards). Rolling back one season and forward
 * again reset it twice, so XP past tier 25 re-bought the whole reward table on
 * demand instead of once per six real weeks.
 */
import { createTestGameState } from '../helpers/createTestGameState';
import {
  awardLegacyPassXp,
  claimAllLegacyPassRewards,
  claimLegacyPassReward,
  reconcileLegacyPassSeason,
} from '@/contexts/game/actions/LegacyPassActions';
import {
  ensureCurrentSeason,
  getCurrentSeasonId,
  liveSeasonIdFor,
  MAX_TIER,
  SEASON_LENGTH_WEEKS,
  XP_PER_TIER,
} from '@/lib/legacyPass/legacyPass';
import { MS_PER_WEEK } from '@/lib/config/gameConstants';

const NOW = Date.UTC(2026, 3, 1);
const SEASON = getCurrentSeasonId(NOW);
const ONE_SEASON_AGO = NOW - SEASON_LENGTH_WEEKS * MS_PER_WEEK;
const NEXT_SEASON = NOW + SEASON_LENGTH_WEEKS * MS_PER_WEEK;

// The helper seeds a pass on the REAL clock's season, which is later than the
// fixed NOW above and would (correctly) never roll back to it - start without one.
function freshState() {
  return { ...createTestGameState({ stats: { gems: 0 } }), legacyPass: undefined };
}

function fullyClaimedState() {
  const base = freshState();
  const withXp = awardLegacyPassXp(base, MAX_TIER * XP_PER_TIER + 500, NOW);
  return claimAllLegacyPassRewards(withXp, NOW).state;
}

describe('Legacy Pass season is monotonic (MON2-2)', () => {
  it('the clock season differs one season back (sanity)', () => {
    expect(getCurrentSeasonId(ONE_SEASON_AGO)).not.toBe(SEASON);
  });

  it('a clock behind the pass keeps the pass instead of resetting it', () => {
    const s = fullyClaimedState();
    const gemsBefore = s.stats.gems;
    const rolledBack = reconcileLegacyPassSeason(s, false, ONE_SEASON_AGO);
    expect(rolledBack.legacyPass?.seasonId).toBe(SEASON);
    expect(rolledBack.legacyPass?.claimedFreeTiers.length).toBe(MAX_TIER);
    expect(rolledBack.stats.gems).toBe(gemsBefore);
  });

  it('scrubbing back then forward cannot re-earn the claimed tiers', () => {
    const s = fullyClaimedState();
    const gemsBefore = s.stats.gems;
    const back = awardLegacyPassXp(s, 10, ONE_SEASON_AGO);
    const forward = reconcileLegacyPassSeason(back, false, NOW);
    const reclaim = claimAllLegacyPassRewards(forward, NOW);
    expect(reclaim.claimedCount).toBe(0);
    expect(reclaim.state.stats.gems).toBe(gemsBefore);
    expect(reclaim.state.legacyPass?.xp).toBe(MAX_TIER * XP_PER_TIER + 510);
  });

  it('claiming with a clock behind the pass reads the pass, not an empty one', () => {
    const base = awardLegacyPassXp(freshState(), XP_PER_TIER, NOW);
    const { result } = claimLegacyPassReward(base, 'free', 1, ONE_SEASON_AGO);
    expect(result.ok).toBe(true);
  });

  it('a real forward rollover still happens', () => {
    const s = fullyClaimedState();
    const next = reconcileLegacyPassSeason(s, false, NEXT_SEASON);
    expect(next.legacyPass?.seasonId).toBe(getCurrentSeasonId(NEXT_SEASON));
    expect(next.legacyPass?.claimedFreeTiers).toEqual([]);
  });

  it('ensureCurrentSeason and liveSeasonIdFor agree', () => {
    const pass = fullyClaimedState().legacyPass!;
    expect(liveSeasonIdFor(pass, ONE_SEASON_AGO)).toBe(SEASON);
    expect(ensureCurrentSeason(pass, getCurrentSeasonId(ONE_SEASON_AGO))).toBe(pass);
    expect(liveSeasonIdFor(pass, NEXT_SEASON)).toBe(getCurrentSeasonId(NEXT_SEASON));
    expect(liveSeasonIdFor(undefined, NOW)).toBe(SEASON);
  });
});
