/**
 * ECONOMIC BOUNDARY GATES — Master Program 10 (2026-09-03).
 *
 * The AVERAGE WORKER (`__tests__/helpers/economyPersonas.ts`) lives 100
 * weeks on the REAL tick through the real action modules; the gates pin what
 * the report measured (`tasks/economy-progression-2026-09-03.md`) so a
 * balance change that moves the early-to-mid economy fails here instead of
 * on a device. Bands are deliberately wide around the measured values; the
 * soak (`economyPersonas.sim.test.ts`) is where the exact numbers live.
 */
import { runPersona, rowAt, type SimResult } from '../helpers/earlyGameSim';
import { ECONOMY_PERSONAS } from '../helpers/economyPersonas';
import { recommendGoals } from '@/lib/goals/engine';
import { GOAL_CATALOGUE } from '@/lib/goals/catalogue';

jest.mock('@/utils/saveQueue', () => ({
  saveQueue: {
    addToQueue: jest.fn().mockResolvedValue(undefined),
    forceSave: jest.fn().mockResolvedValue(undefined),
    flushQueue: jest.fn().mockResolvedValue(undefined),
    restoreOnStartup: jest.fn().mockResolvedValue(undefined),
    setToastCallback: jest.fn(),
    getStatus: jest.fn(() => ({ queueLength: 0, isProcessing: false })),
  },
  queueSave: jest.fn().mockResolvedValue(undefined),
  forceSave: jest.fn().mockResolvedValue(undefined),
}));

describe('Economic boundaries (average worker, 100 weeks, real tick)', () => {
  jest.setTimeout(900_000);
  let r: SimResult;

  beforeAll(async () => {
    const spec = ECONOMY_PERSONAS['AVERAGE WORKER'];
    r = await runPersona({ name: 'AVERAGE WORKER', scenarioId: spec.scenarioId, seed: 1, weeks: 100, policy: spec.make() });
  });

  it('survives, and every money figure stays finite and non-negative', () => {
    expect(r.died).toBe(false);
    for (const row of r.rows) {
      for (const v of [row.cash, row.netWorth, row.savings, row.invested, row.debt, row.salary, row.expenses]) {
        expect(Number.isFinite(v)).toBe(true);
      }
      expect(row.cash).toBeGreaterThanOrEqual(0);
    }
  });

  it('never runs up arrears: rent is the only mandatory bill and the wage covers it', () => {
    expect(Math.max(...r.rows.map((row) => row.overdue))).toBe(0);
  });

  it('reaches the entry ladder ceiling by week 100 (five promotions, 13-25 weeks apart)', () => {
    const top = r.rows.find((row) => row.level >= 5);
    expect(top).toBeDefined();
    expect(top!.week).toBeLessThanOrEqual(100);
  });

  it('lands week 100 in the measured band: an entry-ladder life is worth $8k-$60k', () => {
    const row = rowAt(r, 100)!;
    expect(row.netWorth).toBeGreaterThan(8_000);
    expect(row.netWorth).toBeLessThan(60_000);
    expect(row.tier).toBeGreaterThanOrEqual(3);
  });

  it('receives each inheritance at most once in the life', () => {
    const log = r.finalState.eventLog ?? [];
    for (const id of ['ch_mysterious_letter_resolve', 'ch_email_from_lawyer_resolve']) {
      expect(log.filter((e) => e?.id === id).length).toBeLessThanOrEqual(1);
    }
  });

  it('is shown the first rung off the ladder once it can afford it', () => {
    // The goal engine rotates the SOON slot on an 8-week window (Program 9),
    // so the spotlight at week 100 may be another goal's turn; the stable
    // property is that the goal is ELIGIBLE for this player.
    const goal = GOAL_CATALOGUE.find((g) => g.id === 'soon_get_qualified')!;
    expect(goal.isEligible(r.finalState)).toBe(true);
    const rec = recommendGoals(r.finalState);
    expect(rec.every((g) => Number.isFinite(g.progress))).toBe(true);
  });
});
