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
