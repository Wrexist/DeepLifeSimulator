/**
 * PROGRESSION AND REWARD INTEGRITY — Master Program 8.
 *
 * The Chapter 2 ledger on the real tick: what completes, what is paid, on
 * which tick, and that nothing is paid twice - not on the next tick, not after
 * a reload. Plus the two things the reported "$2,800 for one promotion" turned
 * out to be made of.
 */
import { runPersona, seedScenario, type SimPolicy, type SimResult } from '../helpers/earlyGameSim';
import { PERSONAS } from '../helpers/earlyGamePersonas';
import { LIFE_CHAPTERS, getChapterProgress } from '@/lib/progress/lifeChapters';
import { applyChapterProgress } from '@/contexts/game/actions/weekly/applyChapterProgress';
import { promoteCareer } from '@/contexts/game/actions/JobActions';
import { createTestGameState } from '../helpers/createTestGameState';
import type { GameState } from '@/contexts/game/types';

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

jest.setTimeout(600_000);

const CH2 = LIFE_CHAPTERS.find((c) => c.id === 'ch2_settling_in')!;

/** The average player - rents the shared room from week 4, which is the home goal. */
const averageWithBed = (): SimPolicy => PERSONAS['A average']();
const CH2_BUNDLE = CH2.completionReward.money + CH2.perGoalReward.money * CH2.goals.length;

describe('goals are earned or intentionally initialised', () => {
  it('a fresh Quick Start has exactly one Chapter 2 goal pre-completed, and it is the documented one', () => {
    const s = seedScenario('food_courier'); // seeds a smartphone
    const progress = getChapterProgress(CH2, s);
    const done = CH2.goals.filter((g) => g.checkComplete(s)).map((g) => g.id);
    // "Make a Friend" counts the seeded parents on purpose (lifeChapters.ts
    // explains the deadlock it prevents). The old "Buy a Smartphone" was
    // complete on frame one for every phone-seeded scenario; a home never is -
    // every scenario starts with nowhere to live.
    expect(done).toEqual(['ch2_make_friend']);
    expect(progress.completedGoals).toBe(1);
    expect(CH2.goals.some((g) => g.id === 'ch2_buy_phone')).toBe(false);
    expect(CH2.goals.some((g) => g.id === 'ch2_get_a_home')).toBe(true);
  });
});

describe('the Chapter 2 ledger on the real tick', () => {
  let run: SimResult;
  beforeAll(async () => {
    run = await runPersona({
      name: 'A', policy: averageWithBed(), scenarioId: 'food_courier', seed: 1, weeks: 40,
      mutateSeed: (s) => ({ ...s, lineageId: 'life_ledger' }),
    });
  });

  it('pays the chapter bundle once, on the tick the last goal completes, and never again', () => {
    const idx = run.rows.findIndex((r) => r.chapters.includes('ch2_settling_in'));
    expect(idx).toBeGreaterThan(0);
    const before = run.rows[idx - 1];
    const tick = run.rows[idx];
    expect(before.chapters).not.toContain('ch2_settling_in');
    // The tick's cash delta is the bundle plus one week's wage - nothing else.
    expect(tick.tickDelta).toBeGreaterThanOrEqual(CH2_BUNDLE);
    expect(tick.tickDelta).toBeLessThan(CH2_BUNDLE + 600);
    // Neither neighbour carries a bundle.
    expect(before.tickDelta).toBeLessThan(1_000);
    const after = run.rows[idx + 1];
    if (after) expect(after.tickDelta).toBeLessThan(1_000);
    // And the rest of the life pays it exactly once.
    const bundles = run.rows.filter((r) => r.tickDelta >= CH2_BUNDLE).length;
    expect(bundles).toBe(1);
  });

  it('a reload of the completed state does not pay it again', async () => {
    const idx = run.rows.findIndex((r) => r.chapters.includes('ch2_settling_in'));
    expect(idx).toBeGreaterThan(0);
    // Re-run the life up to the completion tick, then "reload" that exact
    // state and tick once more.
    const upTo = await runPersona({
      name: 'A', policy: averageWithBed(), scenarioId: 'food_courier', seed: 1, weeks: idx + 1,
      mutateSeed: (s) => ({ ...s, lineageId: 'life_ledger' }),
    });
    expect(upTo.finalState.completedChapters).toContain('ch2_settling_in');
    const reloaded = await runPersona({
      name: 'reload', policy: () => undefined, scenarioId: 'food_courier', seed: 1, weeks: 2,
      mutateSeed: () => upTo.finalState,
    });
    for (const row of reloaded.rows) expect(row.tickDelta).toBeLessThan(1_000);
    expect(applyChapterProgress({ state: upTo.finalState }).moneyReward).toBe(0);
  });
});

describe('the promotion itself pays nothing', () => {
  it('promoteCareer changes the level and leaves cash untouched', () => {
    const base = createTestGameState();
    const state: GameState = {
      ...base,
      currentJob: 'janitor',
      careers: base.careers.map((c) =>
        c.id === 'janitor' ? { ...c, applied: true, accepted: true, level: 0, progress: 100, performance: 80 } : c,
      ),
    };
    state.stats.money = 2_000;
    let next: GameState = state;
    const setGameState = (updater: any) => { next = typeof updater === 'function' ? updater(next) : updater; };
    const result = promoteCareer(state, setGameState as any, 'janitor');
    expect(result.success).toBe(true);
    expect(next.careers.find((c) => c.id === 'janitor')!.level).toBe(1);
    expect(next.stats.money).toBe(2_000);
    expect(next.stats.gems).toBe(state.stats.gems);
  });
});
