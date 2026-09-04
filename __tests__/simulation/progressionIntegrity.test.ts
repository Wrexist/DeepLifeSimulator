/**
 * PROGRESSION AND REWARD INTEGRITY — Master Program 8.
 *
 * The Chapter 2 ledger on the real tick: what completes, what is paid, on
 * which tick, and that nothing is paid twice - not on the next tick, not after
 * a reload. Plus the two things the reported "$2,800 for one promotion" turned
 * out to be made of.
 */
import { runPersona, seedScenario, meetIfOffered, keepInTouch, type SimPolicy, type SimResult } from '../helpers/earlyGameSim';
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

/**
 * The average player - rents the shared room from week 4 (the home goal), says
 * hello to whoever the Contacts app offers, and rings the people in their phone
 * (which is what gets a bond to 60 - the social goal).
 *
 * Both social legs are new with Program 11. `ch2_someone_close` used to be
 * satisfied by the seeded parents at their starting bond of 50 and is a real
 * goal now, so a persona that never opens Contacts cannot finish Chapter 2 -
 * correctly. Neither leg costs anything: `meetIfOffered` is a no-op on the
 * weeks nobody is around, and `keepInTouch` with `hangOut: false` is the free
 * Call, once per contact per week, which is the Contacts app's headline action.
 */
const averageWithBed = (): SimPolicy => {
  const base = PERSONAS['A average']();
  return async (ctx) => {
    await base(ctx);
    await meetIfOffered(ctx);
    await keepInTouch(ctx, { hangOut: false });
  };
};
const CH2_BUNDLE = CH2.completionReward.money + CH2.perGoalReward.money * CH2.goals.length;

describe('goals are earned or intentionally initialised', () => {
  it('a fresh Quick Start has NO Chapter 2 goal pre-completed', () => {
    const s = seedScenario('food_courier'); // seeds a smartphone
    const progress = getChapterProgress(CH2, s);
    const done = CH2.goals.filter((g) => g.checkComplete(s)).map((g) => g.id);
    // ZERO now. "Buy a Smartphone" was complete on frame one for every
    // phone-seeded scenario (Program 8); "Make a Friend" was complete on frame
    // one for EVERY scenario, because it counted the seeded Mom and Dad - a
    // permissive check that was load-bearing while Spark (tier 2) was the only
    // way to meet anyone. It asks for a bond of 60 with somebody now
    // (`ch2_someone_close`), reachable at tier 1 by calling the family you
    // start with or by meeting someone new - so the chapter starts where a
    // chapter should: nothing ticked, nothing paid.
    expect(done).toEqual([]);
    expect(progress.completedGoals).toBe(0);
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
