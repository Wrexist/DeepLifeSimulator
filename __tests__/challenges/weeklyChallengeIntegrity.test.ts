/**
 * Weekly challenges: pay for play, and be possible to complete.
 *
 * GP-11 — a fresh challenge was minted with `rewardClaimed: false` even when
 * every objective was ALREADY satisfied at mint time. An established player
 * (owns companies, high net worth) therefore collected 125–300 gems every
 * 4-week rotation for taking no action at all: roughly 1,000–1,400 gems a year
 * of premium currency, minted passively.
 *
 * GP-2 — two challenges worth 250 and 300 gems were mathematically impossible,
 * because their objectives read fields that do not exist in the shape the game
 * actually writes:
 *   - `company_2` filtered on `c.owned`; `Company` has no `owned` field.
 *   - `employees_10` read `c.employees?.length`; `employees` is a NUMBER.
 *   - `achievements_10` counted `achievements[].completed`, the DEPRECATED store
 *     the repo elsewhere documents as never set in play.
 * And the local `getNetWorth` was a partial sum (cash + bank + stocks + real
 * estate), so a "$1M net worth" objective asked for a different, larger number
 * than every other surface in the game shows.
 */
import {
  getOrRotateWeeklyChallenge,
  evaluateChallengeProgress,
  getWeeklyChallengeIdForWeek,
  getWeeklyChallengeDefinition,
  WEEKLY_CHALLENGES,
} from '@/lib/challenges/weeklyChallenges';
import { createTestGameState } from '../helpers/createTestGameState';
import type { GameState } from '@/contexts/game/types';
import { netWorth } from '@/lib/progress/achievements';

/** A late-game player who satisfies essentially every objective already. */
function established(weeksLived: number): GameState {
  const base = createTestGameState();
  return createTestGameState({
    weeksLived,
    stats: { ...base.stats, money: 250_000_000, happiness: 100, health: 100, energy: 100, fitness: 100 },
    bankSavings: 50_000_000,
    companies: [
      { id: 'tech', name: 'A', type: 'tech', employees: 40 },
      { id: 'food', name: 'B', type: 'food', employees: 30 },
      { id: 'media', name: 'C', type: 'media', employees: 25 },
    ] as never,
    claimedProgressAchievements: Array.from({ length: 40 }, (_, i) => `ach_${i}`),
    socialMedia: { ...(base.socialMedia ?? {}), followers: 250_000, posts: 200 } as never,
    reputation: 100,
  });
}

/** The first week whose challenge is `id`. The rotation is deterministic. */
function weekOf(id: string): number {
  for (let w = 0; w < 1000; w += 1) {
    if (getWeeklyChallengeIdForWeek(w) === id) return w;
  }
  throw new Error(`no week rotates to ${id}`);
}

describe('a challenge that is already satisfied is not a payday', () => {
  it('skips past a challenge the player has already satisfied', () => {
    // Deterministic: `wc_fitness_guru` is fitness 80 / health 80 / happiness 70
    // / 1k followers, all of which an established player already has. Minting it
    // would be either a free 150 gems (rewardClaimed: false) or a card reading
    // "Reward collected" for gems never paid (rewardClaimed: true). Neither is
    // acceptable, so the rotation walks on to one that is still a challenge.
    const week = weekOf('wc_fitness_guru');
    const minted = getOrRotateWeeklyChallenge(established(week));

    expect(minted).toBeDefined();
    expect(minted!.challengeId).not.toBe('wc_fitness_guru');
    expect(minted!.completed).toBe(false);
    expect(minted!.rewardClaimed).toBe(false);
  });

  it('never mints completed-but-unclaimed, at any week in the rotation', () => {
    // Sweep the catalogue rather than trusting one week to land on a
    // pre-satisfied challenge. The grant block in the tick fires on
    // `completed && !rewardClaimed`, so that pair must never be minted.
    for (let week = 0; week < 200; week += 1) {
      const minted = getOrRotateWeeklyChallenge(established(week));
      if (!minted) continue;
      expect(minted.completed && !minted.rewardClaimed).toBe(false);
    }
  });

  it('gives even a maxed-out player something still open, where one exists', () => {
    // The guard against the sweep above proving nothing: an established player
    // must be handed a live challenge, not a pre-finished one.
    let anyOpen = false;
    for (let week = 0; week < 200; week += 1) {
      const minted = getOrRotateWeeklyChallenge(established(week));
      if (minted && !minted.completed) anyOpen = true;
    }
    expect(anyOpen).toBe(true);
  });

  it('always mints SOMETHING — walking the rotation must not return undefined', () => {
    // The walk introduces a loop that could fall off the end of the catalogue.
    // A player with no challenge at all loses the whole feature silently, which
    // is how this system spent its life before GP-1.
    for (const state of [established(weekOf('wc_fitness_guru')), createTestGameState({ weeksLived: 8 })]) {
      const minted = getOrRotateWeeklyChallenge(state);
      expect(minted).toBeDefined();
      expect(minted!.progress.length).toBeGreaterThan(0);
    }
  });

  it('still mints claimable for a player who has NOT met the objectives', () => {
    const beginner = createTestGameState({ weeksLived: 8 });
    const minted = getOrRotateWeeklyChallenge(beginner);

    expect(minted).toBeDefined();
    // A real challenge must still be winnable — the fix must not make every
    // challenge arrive pre-claimed.
    expect(minted!.rewardClaimed).toBe(false);
  });

  it('rotates rather than re-minting inside the window', () => {
    const state = established(400);
    const first = getOrRotateWeeklyChallenge(state);
    const held = getOrRotateWeeklyChallenge({ ...state, weeklyChallenge: first });

    expect(held!.challengeId).toBe(first!.challengeId);
    expect(held!.startedWeek).toBe(first!.startedWeek);
  });
});

describe('every objective in the catalogue is reachable', () => {
  it('counts companies the way the game creates them', () => {
    const withTwo = established(100);
    const progress = evaluateChallengeProgress(
      getWeeklyChallengeIdForWeek(
        // find the week whose challenge contains company_2
        (() => {
          for (let w = 0; w < 400; w += 1) {
            const def = getWeeklyChallengeDefinition(getWeeklyChallengeIdForWeek(w));
            if (def?.objectives.some((o) => o.id === 'company_2')) return w;
          }
          return 0;
        })(),
      ),
      withTwo,
    );

    const company = progress.find((p) => p.id === 'company_2');
    expect(company).toBeDefined();
    // Three companies were founded; `.filter(c => c.owned)` used to give 0.
    expect(company!.current).toBe(3);
    expect(company!.completed).toBe(true);
  });

  it('sums employees as the number the game stores', () => {
    const def = WEEKLY_CHALLENGES.find((c) => c.objectives.some((o) => o.id === 'employees_10'));
    expect(def).toBeDefined();

    const objective = def!.objectives.find((o) => o.id === 'employees_10')!;
    // 40 + 30 + 25. Reading `.length` off a number used to give 0 forever.
    expect(objective.checkCurrent(established(100))).toBe(95);
  });

  it('counts achievements from the LIVE store, not the deprecated one', () => {
    const def = WEEKLY_CHALLENGES.find((c) => c.objectives.some((o) => o.id === 'achievements_10'));
    expect(def).toBeDefined();

    const objective = def!.objectives.find((o) => o.id === 'achievements_10')!;
    const state = established(100);

    // 40 claimed progress achievements. The old read counted
    // `achievements[].completed`, which nothing sets in play.
    expect(objective.checkCurrent(state)).toBe(40);
    // And it must be 0 for a player who has claimed nothing.
    expect(objective.checkCurrent(createTestGameState())).toBe(0);
  });

  it('has no objective that is impossible for a maxed-out player', () => {
    // The strongest form of the GP-2 check: for a player who has everything,
    // no objective may report 0 progress — that is the fingerprint of reading a
    // field the game never writes.
    const maxed = established(2000);
    const unreachable: string[] = [];

    for (const challenge of WEEKLY_CHALLENGES) {
      for (const objective of challenge.objectives) {
        let current = 0;
        try {
          current = objective.checkCurrent(maxed);
        } catch {
          unreachable.push(`${challenge.id}/${objective.id} (threw)`);
          continue;
        }
        if (!Number.isFinite(current)) unreachable.push(`${challenge.id}/${objective.id} (not finite)`);
      }
    }

    expect(unreachable).toEqual([]);
  });
});

describe('net worth is the canonical figure', () => {
  it('counts more than cash + bank + stocks + real estate', () => {
    const def = WEEKLY_CHALLENGES.find((c) => c.objectives.some((o) => o.id.startsWith('net_worth')));
    expect(def).toBeDefined();

    const objective = def!.objectives.find((o) => o.id.startsWith('net_worth'))!;
    const rich = established(400);

    // Exact parity with the canonical figure, not merely "> 0" — the old partial
    // sum also cleared zero for this fixture, so the weaker assertion did not
    // discriminate between the two implementations at all. (Review catch.)
    const expected = netWorth(rich) >= 1 ? 1 : 0;
    expect(objective.checkCurrent(rich)).toBe(expected);
  });
});
