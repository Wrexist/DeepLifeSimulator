/**
 * A rewind must not re-open an achievement, a life chapter or a weekly
 * challenge the player was already paid for.
 *
 * All three pay GEMS, and gems carry forward through a rewind (the live
 * balance minus the cost). Their claim records - `claimedProgressAchievements`
 * plus the all-lives `prestige.claimedAchievementIds`, `completedChapters`, and
 * `weeklyChallenge.rewardClaimed` - were restored from the SNAPSHOT, so every
 * one claimed since the checkpoint paid a second time on the replay. With
 * Chronomaster a rewind costs nothing, so the loop could be repeated.
 *
 * Companion to `rewindClaimLedgers.test.ts` (daily login, milestones, Legacy
 * Pass), which closed the same hole for the account-level faucets.
 */
import { createCheckpoint, rewindToCheckpoint } from '@/lib/timeMachine/checkpointSystem';
import { applyChapterProgress } from '@/contexts/game/actions/weekly/applyChapterProgress';
import { getActiveChapter, getUpcomingChapter, weeksInThisLife } from '@/lib/progress/lifeChapters';
import { unlockTier } from '@/lib/progress/featureUnlocks';
import { RENTAL_TIERS } from '@/lib/realEstate/rentals';
import { createTestGameState } from '../helpers/createTestGameState';
import type { GameState } from '@/contexts/game/types';

const LIFE_START = 104; // an age-20 start: weeksLived is seeded, not zero (CLAUDE.md §4.2)

type Challenge = NonNullable<GameState['weeklyChallenge']>;

const challenge = (over: Partial<Challenge> = {}): Challenge => ({
  challengeId: 'wc_scholar',
  startedAt: 0,
  startedWeek: LIFE_START + 8,
  progress: [{ objectiveId: 'education_2', current: 0, target: 2, met: false }],
  completed: false,
  rewardClaimed: false,
  ...over,
});

/**
 * The life at the checkpoint: ten weeks in, one achievement, one chapter - and
 * every Chapter 2 goal already met (promoted, $2k saved, a roof, a bond at 60),
 * so the very next tick would pay Chapter 2 if its record were not carried.
 */
function snapshotLife(): GameState {
  const base = createTestGameState();
  const job = base.careers[0];
  return createTestGameState({
    weeksLived: LIFE_START + 10,
    currentJob: job.id,
    careers: base.careers.map((c) => (c.id === job.id ? { ...c, level: 1 } : c)),
    stats: { ...base.stats, money: 5_000 },
    rental: { tierId: RENTAL_TIERS[0].id, startedWeek: LIFE_START + 2 },
    relationships: [
      { id: 'mum', name: 'Mum', type: 'parent', relationshipScore: 70, personality: 'caring', gender: 'female', age: 47 },
    ],
    lifeStartWeek: LIFE_START,
    claimedProgressAchievements: ['first_job'],
    achievementUnlocks: {
      first_job: { unlockedAt: 1, age: 20, weeksLived: LIFE_START + 3, money: 100, year: 2025 },
    },
    prestige: { ...base.prestige!, claimedAchievementIds: ['first_job'] },
    completedChapters: ['ch1_fresh_start'],
    weeklyChallenge: challenge(),
  });
}

/** Now: forty weeks in, more claimed since, rewinding for free. */
function liveLife(liveChallenge: Challenge): GameState {
  const snap = snapshotLife();
  const checkpoint = createCheckpoint(snap, 'Age 20');
  return {
    ...snap,
    weeksLived: LIFE_START + 40,
    stats: { ...snap.stats, gems: 5_000 },
    goldUpgrades: { ...(snap.goldUpgrades ?? {}), chronomaster: true },
    claimedProgressAchievements: ['first_job', 'millionaire'],
    achievementUnlocks: {
      ...snap.achievementUnlocks,
      millionaire: { unlockedAt: 2, age: 20, weeksLived: LIFE_START + 30, money: 1_000_000, year: 2025 },
    },
    prestige: { ...snap.prestige!, claimedAchievementIds: ['first_job', 'millionaire'] },
    completedChapters: ['ch1_fresh_start', 'ch2_settling_in', 'ch3_on_the_rise'],
    weeklyChallenge: liveChallenge,
    checkpoints: [checkpoint],
  };
}

function rewind(live: GameState): GameState {
  const restored = rewindToCheckpoint(live, live.checkpoints![0].id);
  expect(restored).not.toBeNull();
  return restored!;
}

const claimedSameInstance = () =>
  challenge({
    completed: true,
    rewardClaimed: true,
    progress: [{ objectiveId: 'education_2', current: 2, target: 2, met: true }],
  });

describe('rewind keeps achievement claims from the LIVE state', () => {
  it('the achievement claimed since the checkpoint stays claimed', () => {
    const restored = rewind(liveLife(claimedSameInstance()));
    // The per-life gate: no Claim button for it on the replay.
    expect(restored.claimedProgressAchievements).toEqual(['first_job', 'millionaire']);
    // The all-lives gate: even a claim that slipped through mints 0 gems.
    expect(restored.prestige?.claimedAchievementIds).toEqual(['first_job', 'millionaire']);
  });

  it('every claimed id keeps its unlock record', () => {
    const restored = rewind(liveLife(claimedSameInstance()));
    expect(Object.keys(restored.achievementUnlocks ?? {}).sort()).toEqual(['first_job', 'millionaire']);
  });

  it('the rest of the prestige record is still the snapshot (only the claim set carries)', () => {
    const live = liveLife(claimedSameInstance());
    live.prestige = { ...live.prestige!, prestigePoints: 9_999 };
    expect(rewind(live).prestige?.prestigePoints).toBe(snapshotLife().prestige?.prestigePoints);
  });
});

describe('rewind keeps completed life chapters, and the chapter UI stays coherent', () => {
  it('chapters finished since the checkpoint stay finished', () => {
    const restored = rewind(liveLife(claimedSameInstance()));
    expect(restored.completedChapters).toEqual(['ch1_fresh_start', 'ch2_settling_in', 'ch3_on_the_rise']);
  });

  it('the tick pays no chapter again on the replay', () => {
    // Control: the snapshot on its own would complete (and pay) Chapter 2.
    expect(applyChapterProgress({ state: snapshotLife() }).newlyCompleted).toEqual(['ch2_settling_in']);
    const restored = rewind(liveLife(claimedSameInstance()));
    expect(applyChapterProgress({ state: restored }).newlyCompleted).toEqual([]);
    expect(applyChapterProgress({ state: restored }).gemReward).toBe(0);
  });

  it('the card shows the next chapter at its real opening week, not a finished one', () => {
    const restored = rewind(liveLife(claimedSameInstance()));
    // Ten weeks into the restored life; chapter 4 opens at week 30.
    expect(weeksInThisLife(restored)).toBe(10);
    expect(getActiveChapter(restored)).toBeUndefined();
    const upcoming = getUpcomingChapter(restored);
    expect(upcoming?.chapter.id).toBe('ch4_building_empire');
    expect(upcoming?.number).toBe(4);
    expect(upcoming?.weeksUntil).toBe(20);
  });

  it('surfaces the player already uses stay unlocked', () => {
    const live = liveLife(claimedSameInstance());
    expect(unlockTier(rewind(live))).toBeGreaterThanOrEqual(3);
  });
});

describe('rewind keeps a claimed weekly challenge - the same instance only', () => {
  it('the same instance, claimed since the checkpoint, stays claimed and frozen', () => {
    const live = liveLife(claimedSameInstance());
    const restored = rewind(live);
    expect(restored.weeklyChallenge?.challengeId).toBe('wc_scholar');
    expect(restored.weeklyChallenge?.startedWeek).toBe(LIFE_START + 8);
    // The tick's grant guard is `completed && !rewardClaimed`: closed.
    expect(restored.weeklyChallenge?.rewardClaimed).toBe(true);
    expect(restored.weeklyChallenge?.completed).toBe(true);
    // Progress rows travel with the flag, so the card does not read "claimed"
    // over a 0/2 bar.
    expect(restored.weeklyChallenge?.progress).toEqual(live.weeklyChallenge?.progress);
  });

  it('a LATER instance does not come back over the snapshot one', () => {
    // Rotated since the checkpoint and claimed: its startedWeek is in the
    // restored life's future, and it is not the challenge that was live then.
    const later = challenge({
      challengeId: 'wc_fitness_guru',
      startedWeek: LIFE_START + 12,
      completed: true,
      rewardClaimed: true,
    });
    const restored = rewind(liveLife(later));
    expect(restored.weeklyChallenge).toEqual(snapshotLife().weeklyChallenge);
  });

  it('the same challenge id minted in a different week is a different instance', () => {
    const otherWeek = { ...claimedSameInstance(), startedWeek: LIFE_START + 36 };
    const restored = rewind(liveLife(otherWeek));
    expect(restored.weeklyChallenge?.rewardClaimed).toBe(false);
    expect(restored.weeklyChallenge?.startedWeek).toBe(LIFE_START + 8);
  });

  it('an unclaimed live instance changes nothing', () => {
    const restored = rewind(liveLife(challenge({ progress: [] })));
    expect(restored.weeklyChallenge).toEqual(snapshotLife().weeklyChallenge);
  });
});
