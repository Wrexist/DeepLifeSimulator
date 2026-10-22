/**
 * Entry-level job market.
 *
 * The bug being fixed is a design one: eight ungated starting jobs presented
 * only by salary, so the $80 job dominates and the other seven are noise. These
 * tests pin the properties that make the choice real — a fresh character cannot
 * simply take the best-paying job, the board is small and rotates, and it never
 * shows a player four jobs that all reject them.
 */

import {
  ENTRY_JOB_PROFILES,
  BOARD_SIZE,
  BOARD_ROTATION_WEEKS,
  getEntryJobProfile,
  isEntryTierCareer,
  evaluateHiring,
  getJobBoard,
  weeksUntilBoardRefresh,
  careerCeiling,
  growthLabel,
} from '../jobMarket';
import { INITIAL_CAREERS } from '../careerData';
import type { GameState } from '@/contexts/game/types';
import { createTestGameState } from '@/__tests__/helpers/createTestGameState';

/** A freshly created character: fitness 10, reputation 0 (see initialState). */
function freshState(overrides: Partial<GameState['stats']> = {}): GameState {
  return createTestGameState({
    weeksLived: 0,
    // The board seed is `rngCommitLog.seed | userProfile.firstName` — both are
    // pinned here so the rotation assertions below are deterministic.
    rngCommitLog: { seed: 12345, sequence: 0, entries: {}, order: [] },
    userProfile: { ...createTestGameState().userProfile, firstName: 'Test' },
    date: { year: 2000, month: 'January', week: 1, age: 18 },
    stats: { health: 100, happiness: 100, energy: 100, fitness: 10, money: 200, reputation: 0, gems: 0, ...overrides },
  });
}

describe('entry job profiles', () => {
  it('covers exactly the careers that ship with no requirements', () => {
    const ungated = INITIAL_CAREERS.filter(
      (c) => Object.keys(c.requirements ?? {}).length === 0
    ).map((c) => c.id);

    expect([...ENTRY_JOB_PROFILES].map((p) => p.careerId).sort()).toEqual([...ungated].sort());
  });

  it('gives every job a distinct identity, not just a wage', () => {
    for (const p of ENTRY_JOB_PROFILES) {
      expect(p.vibe.length).toBeGreaterThan(10);
      expect(p.path).toContain('→');
      expect(p.weeklyToll.energy).toBeLessThan(0);
      expect(['slow', 'steady', 'fast']).toContain(p.growth);
    }
  });

  it('does not let the best-paying starting job be free', () => {
    // The whole complaint: nobody takes $25 when $80 is one tap away. The $80
    // electrician now wants Fitness 25, which a fresh character (10) lacks.
    const electrician = getEntryJobProfile('electrician');
    expect(electrician?.hiringBar.fitness).toBeGreaterThan(10);
    expect(evaluateHiring(electrician, freshState()).eligible).toBe(false);
  });

  it('keeps the lowest-paying job open to anyone, and worth taking', () => {
    // The musician is the tier's long shot: the best ceiling ($2,120 against
    // the next-best $790) bought with TIME - the slowest pace in the tier,
    // early rungs that barely clear minimum wage, and tenure gates on the top
    // three rungs. It has to stay takeable on day one for that bet to be
    // available at all, which is why the bar stays open even though the audit
    // found this profile dominant: the fix belonged in the payoff curve, not
    // in a gate. (The old comment here said "$25/wk, the worst wage" - true
    // before MIN_ENTRY_WEEKLY_SALARY put every entry ladder on $110 and
    // silently deleted the downside half of the bet.)
    const musician = getEntryJobProfile('musician');
    expect(musician?.hiringBar).toEqual({});
    expect(evaluateHiring(musician, freshState()).eligible).toBe(true);

    const musicianCareer = INITIAL_CAREERS.find((c) => c.id === 'musician');
    const electricianCareer = INITIAL_CAREERS.find((c) => c.id === 'electrician');
    expect(careerCeiling(musicianCareer)).toBeGreaterThan(careerCeiling(electricianCareer));
  });

  it('leaves a real day-one choice rather than a single option', () => {
    const open = ENTRY_JOB_PROFILES.filter((p) => evaluateHiring(p, freshState()).eligible);
    expect(open.length).toBeGreaterThanOrEqual(3);
    // ...and those options must differ on something other than pay.
    expect(new Set(open.map((p) => p.growth)).size).toBeGreaterThan(1);
  });

  it('recognises only entry-tier careers', () => {
    expect(isEntryTierCareer('musician')).toBe(true);
    expect(isEntryTierCareer('doctor')).toBe(false);
  });
});

describe('evaluateHiring', () => {
  it('reports every shortfall, not just the first', () => {
    const profile = {
      careerId: 'x',
      vibe: 'v',
      path: 'a → b',
      hiringBar: { fitness: 50, reputation: 20, health: 90 },
      weeklyToll: { energy: -10 },
      growth: 'steady' as const,
    };
    const verdict = evaluateHiring(profile, freshState({ fitness: 10, reputation: 0, health: 50 }));

    expect(verdict.eligible).toBe(false);
    expect(verdict.missing).toHaveLength(3);
    expect(verdict.missing[0]).toBe('Fitness 50 (you have 10)');
  });

  it('passes once the bar is met exactly', () => {
    const electrician = getEntryJobProfile('electrician');
    expect(evaluateHiring(electrician, freshState({ fitness: 25 })).eligible).toBe(true);
  });

  it('treats an unknown career as ungated rather than blocking it', () => {
    expect(evaluateHiring(undefined, freshState())).toEqual({ eligible: true, missing: [] });
  });

  it('survives a state with no stats', () => {
    expect(() => evaluateHiring(getEntryJobProfile('retail'), null)).not.toThrow();
  });
});

describe('getJobBoard', () => {
  it('shows a handful of openings instead of the whole list', () => {
    expect(getJobBoard(freshState())).toHaveLength(BOARD_SIZE);
    expect(BOARD_SIZE).toBeLessThan(ENTRY_JOB_PROFILES.length);
  });

  it('is stable within a rotation block - a reload never reshuffles it', () => {
    const a = getJobBoard(freshState()).map((o) => o.careerId);
    const b = getJobBoard(freshState()).map((o) => o.careerId);
    expect(a).toEqual(b);

    const sameBlock = { ...freshState(), weeksLived: BOARD_ROTATION_WEEKS - 1 };
    expect(getJobBoard(sameBlock).map((o) => o.careerId)).toEqual(a);
  });

  it('turns over when the block advances', () => {
    const week0 = getJobBoard(freshState()).map((o) => o.careerId);
    const later = getJobBoard({ ...freshState(), weeksLived: BOARD_ROTATION_WEEKS * 5 });
    expect(later.map((o) => o.careerId)).not.toEqual(week0);
  });

  it('gives different lives different markets', () => {
    const a = getJobBoard(freshState()).map((o) => o.careerId);
    const other: GameState = {
      ...freshState(),
      rngCommitLog: { seed: 987654, sequence: 0, entries: {}, order: [] },
      userProfile: { ...freshState().userProfile, firstName: 'Someone Else' },
    };
    const b = getJobBoard(other).map((o) => o.careerId);
    expect(a).not.toEqual(b);
  });

  it('always includes at least one job that would actually hire the player', () => {
    // A board of four rejections is a dead end, not a decision. Checked across
    // many weeks and several stat profiles because the guarantee has to hold
    // for every rotation, not just the first.
    const profiles = [
      { fitness: 0, reputation: 0, health: 10 },
      { fitness: 10, reputation: 0, health: 100 },
      { fitness: 80, reputation: 60, health: 100 },
    ];
    for (const stats of profiles) {
      for (let week = 0; week < BOARD_ROTATION_WEEKS * 12; week += 3) {
        const state = { ...freshState(stats), weeksLived: week };
        const board = getJobBoard(state);
        expect(board.some((o) => o.verdict.eligible)).toBe(true);
      }
    }
  });

  it('never lists the same opening twice', () => {
    for (let week = 0; week < 60; week += 4) {
      const board = getJobBoard({ ...freshState(), weeksLived: week });
      expect(new Set(board.map((o) => o.careerId)).size).toBe(board.length);
    }
  });

  it('survives a missing state', () => {
    expect(() => getJobBoard(null)).not.toThrow();
    expect(getJobBoard(null)).toHaveLength(BOARD_SIZE);
  });
});

describe('board rotation countdown', () => {
  it('counts down to the turnover and never reads zero', () => {
    for (let week = 0; week < BOARD_ROTATION_WEEKS * 3; week += 1) {
      const left = weeksUntilBoardRefresh({ ...freshState(), weeksLived: week });
      expect(left).toBeGreaterThan(0);
      expect(left).toBeLessThanOrEqual(BOARD_ROTATION_WEEKS);
    }
  });
});

describe('presentation helpers', () => {
  it('names the growth pace', () => {
    expect(growthLabel('fast')).toBe('Climbs fast');
    expect(growthLabel('slow')).toBe('Climbs slow');
    expect(growthLabel('steady')).toBe('Steady climb');
  });

  it('reads the ceiling off the ladder', () => {
    expect(careerCeiling({ levels: [{ salary: 10 }, { salary: 90 }, { salary: 40 }] })).toBe(90);
    expect(careerCeiling(undefined)).toBe(0);
    expect(careerCeiling({ levels: [] })).toBe(0);
  });
});

describe('no entry job is a trap (ECO-8, 2026-10-22)', () => {
  // The chef ($805 ceiling, no bar, steady, -1 happiness) beat janitor ($200),
  // retail ($250) and fast food ($230) on ceiling with the same or a lower
  // bar, so whether a new life was stuck on a $200 ceiling came down to which
  // four cards the week-1 board dealt.
  //
  // The first fix lifted the three cheap ladders to $450-$520. That removed
  // the domination by raising the floor of the whole economy: the common
  // personas (who take whatever the board offers, usually the janitor) went
  // from $44k to $82k net worth at week 250, and over-investing in people
  // stopped being a way to go broke (socialBoundaries). So the three ladders
  // keep their pay and the CHEF pays for its ceiling instead: a health-50 bar
  // and a -2 happiness toll.
  type Profile = (typeof ENTRY_JOB_PROFILES)[number];
  const careerOf = (id: string) => INITIAL_CAREERS.find((c) => c.id === id);
  const ceilingOf = (id: string) => careerCeiling(careerOf(id));
  const tenureOf = (id: string) => (careerOf(id)?.levels ?? []).reduce((sum, l) => sum + (l.experienceRequired ?? 0), 0);
  const PACE = { slow: 0, steady: 1, fast: 2 } as const;
  const STATS = ['fitness', 'reputation', 'health'] as const;
  const bar = (p: Profile, k: (typeof STATS)[number]) => p.hiringBar[k] ?? 0;
  const toll = (p: Profile, k: 'energy' | 'health' | 'happiness') => p.weeklyToll[k] ?? 0;
  const profile = (id: string) => ENTRY_JOB_PROFILES.find((p) => p.careerId === id)!;

  /** True when `a` is at least as good as `b` on every axis. */
  const weaklyDominates = (a: Profile, b: Profile) =>
    ceilingOf(a.careerId) >= ceilingOf(b.careerId) &&
    PACE[a.growth] >= PACE[b.growth] &&
    tenureOf(a.careerId) <= tenureOf(b.careerId) &&
    STATS.every((k) => bar(a, k) <= bar(b, k)) &&
    (['energy', 'health', 'happiness'] as const).every((k) => toll(a, k) >= toll(b, k));

  it('no entry profile is at least as good as another on ceiling, pace, bar and toll at once', () => {
    const traps: string[] = [];
    for (const a of ENTRY_JOB_PROFILES) {
      for (const b of ENTRY_JOB_PROFILES) {
        if (a.careerId !== b.careerId && weaklyDominates(a, b)) traps.push(`${a.careerId} >= ${b.careerId}`);
      }
    }
    expect(traps).toEqual([]);
  });

  /**
   * The strict check above was blind to the very case the audit found: the old
   * chef was a point of happiness worse than the janitor and two energy worse
   * than retail, so it never weakly dominated either of them while paying 3-4x
   * as much. A ceiling at least DOUBLE another job's has to be paid for on an
   * axis that matters: a higher hiring bar, a slower pace, more tenure, or a
   * happiness toll at least 2 points heavier. Energy is left out on purpose: a
   * couple of points of a weekly budget does not offset a 3x ceiling.
   */
  const unpaidCeiling = (a: Profile, b: Profile) =>
    ceilingOf(a.careerId) >= 2 * ceilingOf(b.careerId) &&
    !STATS.some((k) => bar(a, k) > bar(b, k)) &&
    PACE[a.growth] >= PACE[b.growth] &&
    tenureOf(a.careerId) <= tenureOf(b.careerId) &&
    toll(a, 'happiness') > toll(b, 'happiness') - 2;

  /**
   * Known and NOT fixed here: the farmer ($790, no bar, slow, -18 energy) over
   * the janitor ($200, health 40, slow, -15 energy). Same shape as the chef
   * case; the audit did not name it and the owner decision covers the chef
   * only, so it is listed rather than hidden. The test fails if it is fixed
   * without removing it from this list, or if any other pair appears.
   */
  const KNOWN_UNPAID = ['farmer >= janitor'];

  it('a ceiling at least double another job\'s is paid for in bar, pace, tenure or happiness', () => {
    const unpaid: string[] = [];
    for (const a of ENTRY_JOB_PROFILES) {
      for (const b of ENTRY_JOB_PROFILES) {
        if (a.careerId !== b.careerId && unpaidCeiling(a, b)) unpaid.push(`${a.careerId} >= ${b.careerId}`);
      }
    }
    expect(unpaid).toEqual(KNOWN_UNPAID);
  });

  it('would have caught the old chef (no bar, -1 happiness) against all three', () => {
    const oldChef: Profile = { ...profile('chef'), hiringBar: {}, weeklyToll: { energy: -14, happiness: -1 } };
    expect(unpaidCeiling(oldChef, profile('janitor'))).toBe(true);
    expect(unpaidCeiling(oldChef, profile('retail'))).toBe(true);
    // Fast food is the FAST ladder: its pace was always its answer.
    expect(unpaidCeiling(oldChef, profile('fast_food'))).toBe(false);
    for (const id of ['janitor', 'retail', 'fast_food']) {
      expect(unpaidCeiling(profile('chef'), profile(id))).toBe(false);
    }
  });

  it('the chef pays for its ceiling with a health-50 bar and a -2 happiness toll', () => {
    expect(profile('chef').hiringBar).toEqual({ health: 50 });
    expect(profile('chef').weeklyToll).toEqual({ energy: -14, happiness: -2 });
    // A fresh character (health 100) still walks in: it is a bar a neglected
    // life falls below, not a gate in front of day one.
    expect(evaluateHiring(profile('chef'), freshState()).eligible).toBe(true);
    expect(evaluateHiring(profile('chef'), freshState({ health: 49 })).eligible).toBe(false);
  });

  it('the three cheap ladders keep their pay - the fix did not lift the low-end economy', () => {
    const ladder = (id: string) => careerOf(id)!.levels.map((l) => l.salary);
    expect(ladder('janitor')).toEqual([110, 130, 135, 135, 165, 200]);
    expect(ladder('retail')).toEqual([110, 120, 140, 165, 205, 250]);
    expect(ladder('fast_food')).toEqual([110, 130, 140, 150, 180, 230]);
  });
});
