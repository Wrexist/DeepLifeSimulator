/**
 * Street crime: an arrest spends a run, cannot commit twice, and bail scales
 * with the crime (2026-10-17 economy audit).
 *
 * Three defects in `performStreetJob`'s caught branch:
 *   - `weeklyStreetJobs` was incremented only on the got-away path, so an
 *     arrest was a free retry outside both the per-job (3) and global (8) caps;
 *   - its updater re-checked energy and nothing else, so a same-batch double
 *     tap that rolled "caught" committed twice - two sentences, two 10% cash
 *     seizures (and the loot of both);
 *   - bail was linear in the sentence ($500/week), so a 4-week heist arrest
 *     cost $2,000 against a ~$9,000 success.
 */
import type { Dispatch, SetStateAction } from 'react';
import { createTestGameState } from '../helpers/createTestGameState';
import { performStreetJob, MAX_TOTAL_STREET_JOBS_PER_WEEK } from '@/contexts/game/actions/JobActions';
import { updateMoney } from '@/contexts/game/actions/MoneyActions';
import { updateStats } from '@/contexts/game/actions/StatsActions';
import { computeBailCost } from '@/lib/config/gameConstants';
import type { GameState } from '@/contexts/game/types';

const JOB = 'steal_from_cars'; // illegal, no level gate, 1-week sentence

const deps = {
  updateMoney,
  updateStats,
  gainCriminalXp: jest.fn(),
  gainCrimeSkillXp: jest.fn(),
};

/** Capture the action's updater(s) without applying them. */
function capture(): { set: Dispatch<SetStateAction<GameState>>; updaters: ((s: GameState) => GameState)[] } {
  const updaters: ((s: GameState) => GameState)[] = [];
  const set: Dispatch<SetStateAction<GameState>> = u => {
    if (typeof u === 'function') updaters.push(u);
  };
  return { set, updaters };
}

function criminal(weeksLived: number, over: Partial<GameState> = {}): GameState {
  return createTestGameState({
    weeksLived,
    stats: { money: 10_000, energy: 100, health: 100, happiness: 100 },
    // A high wanted level pushes the arrest chance to its 80% cap.
    wantedLevel: 40,
    jailWeeks: 0,
    weeklyStreetJobs: {},
    ...over,
  });
}

/** First week whose attempt-1 roll is an arrest (rolls are seeded, so this is stable). */
function caughtState(over: Partial<GameState> = {}): GameState {
  for (let w = 100; w < 400; w++) {
    const s = criminal(w, over);
    const c = capture();
    const r = performStreetJob(s, c.set, JOB, deps);
    if (r.inJail) return s;
  }
  throw new Error('no caught roll found in range');
}

describe('a caught street-crime attempt', () => {
  it('spends a run toward the weekly cap', () => {
    const s = caughtState();
    const c = capture();
    performStreetJob(s, c.set, JOB, deps);
    expect(c.updaters).toHaveLength(1);
    const next = c.updaters[0](s);
    expect(next.jailWeeks).toBeGreaterThan(0);
    expect(next.weeklyStreetJobs?.[JOB]).toBe(1);
  });

  it('a same-batch double tap commits ONE arrest: one sentence, one seizure', () => {
    const s = caughtState();
    const c = capture();
    // Both taps read the same render snapshot, so both pass the outer guard.
    performStreetJob(s, c.set, JOB, deps);
    performStreetJob(s, c.set, JOB, deps);
    expect(c.updaters).toHaveLength(2);
    const once = c.updaters[0](s);
    const twice = c.updaters[1](once);
    expect(twice).toBe(once);
    expect(once.jailWeeks).toBe(1);
    expect(once.stats.money).toBeGreaterThan(s.stats.money * 0.85); // one 10% seizure, not two
  });

  it('re-checks the per-job cap against prev (a stale snapshot cannot overrun it)', () => {
    const s = caughtState({ weeklyStreetJobs: { [JOB]: 2 } });
    const c = capture();
    performStreetJob(s, c.set, JOB, deps);
    expect(c.updaters).toHaveLength(1);
    const prevAtCap = { ...s, weeklyStreetJobs: { [JOB]: 3 } };
    expect(c.updaters[0](prevAtCap)).toBe(prevAtCap);
  });

  it('re-checks the global cap against prev', () => {
    const s = caughtState();
    const c = capture();
    performStreetJob(s, c.set, JOB, deps);
    const prevAtCap = { ...s, weeklyStreetJobs: { beg: 3, dumpster: 3, wash_cars: MAX_TOTAL_STREET_JOBS_PER_WEEK - 6 } };
    expect(c.updaters[0](prevAtCap)).toBe(prevAtCap);
  });

  it('pays NO loot when the success roll also landed - only the 10% seizure moves cash', () => {
    // Pity (5 straight failures) forces the success roll, so this finds an
    // attempt that both SUCCEEDED and was CAUGHT. That branch used to credit
    // the full take and only subtract the seizure from it.
    const s = caughtState({ streetJobFailureCount: { [JOB]: 5 } });
    const c = capture();
    const r = performStreetJob(s, c.set, JOB, deps);
    expect(r.success).toBe(true);
    expect(r.inJail).toBe(true);
    expect(r.message).toMatch(/take was seized/i);
    const next = c.updaters[0](s);
    expect(next.stats.money).toBe(s.stats.money - Math.round(s.stats.money * 0.1));
  });

  it('a broke arrest stays at $0 rather than being paid the take', () => {
    const s = caughtState({ streetJobFailureCount: { [JOB]: 5 } });
    const broke = { ...s, stats: { ...s.stats, money: 0 } };
    const c = capture();
    performStreetJob(broke, c.set, JOB, deps);
    expect(c.updaters[0](broke).stats.money).toBe(0);
  });

  it('three arrests exhaust the per-job cap - the fourth attempt is refused', () => {
    const s = criminal(150, { weeklyStreetJobs: { [JOB]: 3 } });
    const c = capture();
    const r = performStreetJob(s, c.set, JOB, deps);
    expect(r.success).toBe(false);
    expect(c.updaters).toHaveLength(0);
  });
});

describe('no street work from a cell', () => {
  it('refuses outright while jailed', () => {
    const s = criminal(150, { jailWeeks: 2 });
    const c = capture();
    const r = performStreetJob(s, c.set, JOB, deps);
    expect(r.success).toBe(false);
    expect(r.message).toMatch(/jail/i);
    expect(c.updaters).toHaveLength(0);
  });

  it('the got-away updater also refuses if prev is jailed', () => {
    // A legal job never rolls "caught", so this exercises the other branch.
    const s = criminal(150, { wantedLevel: 0 });
    const c = capture();
    performStreetJob(s, c.set, 'wash_cars', deps);
    expect(c.updaters).toHaveLength(1);
    const jailedPrev = { ...s, jailWeeks: 1 };
    expect(c.updaters[0](jailedPrev)).toBe(jailedPrev);
  });
});

describe('bail scales with the sentence', () => {
  it('low-tier sentences stay affordable (unchanged)', () => {
    expect(computeBailCost(1, 0)).toBe(500);
    expect(computeBailCost(2, 0)).toBe(1_000);
  });

  it('a 4-week heist arrest now costs $6,000, not $2,000', () => {
    expect(computeBailCost(4, 0)).toBe(6_000);
    expect(computeBailCost(6, 0)).toBe(15_000);
  });

  it('rises monotonically and falls as the sentence is served', () => {
    for (let w = 1; w < 52; w++) {
      expect(computeBailCost(w + 1, 0)).toBeGreaterThanOrEqual(computeBailCost(w, 0));
    }
  });

  it('keeps the wealth term, the $500 floor and the $250k ceiling', () => {
    expect(computeBailCost(1, 10_000_000)).toBe(50_000);
    expect(computeBailCost(0, 0)).toBe(500);
    expect(computeBailCost(52, 0)).toBe(250_000);
    expect(computeBailCost(NaN, NaN)).toBe(500);
  });
});
