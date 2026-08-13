/**
 * `wealthMark` — the high-water wealth figure the chapter goals and the unlock
 * tiers both read.
 *
 * The degradation path lives in its own file because proving it needs
 * `netWorth` to THROW, and a module mock is hoisted to the top of whichever
 * file declares it. Mocking it inside the main progression suite would have
 * replaced net worth for every other test in that file.
 *
 * Why the path matters: a throw here silently lowers chapter progress and the
 * unlock tier, which looks exactly like a player who has less money — the same
 * class of invisible takeaway the rest of this change exists to fix.
 */
import type { GameState } from '@/contexts/game/types';
import { createTestGameState } from '../../../__tests__/helpers/createTestGameState';

const stateWith = (over: Partial<GameState> = {}): GameState =>
  createTestGameState({
    stats: { ...createTestGameState().stats, money: 1_500 },
    bankSavings: 500,
    ...over,
  });

describe('wealthMark degrades rather than throwing', () => {
  const loadWithNetWorth = (impl: (s: GameState) => number) => {
    let mod!: typeof import('../lifeChapters');
    let errorSpy!: jest.SpyInstance;

    jest.isolateModules(() => {
      jest.doMock('@/lib/progress/achievements', () => ({
        ...jest.requireActual('@/lib/progress/achievements'),
        netWorth: jest.fn(impl),
      }));
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { logger } = require('@/utils/logger');
      errorSpy = jest.spyOn(logger, 'error').mockImplementation(() => undefined);
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      mod = require('../lifeChapters');
    });

    return { mod, errorSpy };
  };

  afterEach(() => {
    jest.restoreAllMocks();
    jest.resetModules();
  });

  it('a throwing netWorth still yields the liquid and peak terms', () => {
    const { mod } = loadWithNetWorth(() => {
      throw new Error('corrupt holdings');
    });

    // Liquid is 2,000; the peak is higher and must still win.
    const state = stateWith({
      lifetimeStatistics: {
        ...createTestGameState().lifetimeStatistics!,
        peakNetWorth: 9_000,
      },
    });

    expect(mod.wealthMark(state)).toBe(9_000);
  });

  it('and says so exactly once, however many renders ask', () => {
    // The caller runs on every render of the app grid, so a state that throws
    // would throw every time. A silent catch hides it; an unthrottled one
    // drowns the log.
    const { mod, errorSpy } = loadWithNetWorth(() => {
      throw new Error('corrupt holdings');
    });

    for (let i = 0; i < 25; i++) mod.wealthMark(stateWith());

    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(String(errorSpy.mock.calls[0][0])).toMatch(/wealthMark/);
  });

  it('logs nothing at all when netWorth behaves (the control)', () => {
    const { mod, errorSpy } = loadWithNetWorth(() => 4_000);

    expect(mod.wealthMark(stateWith())).toBe(4_000);
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('a NaN net worth is sanitised, not propagated', () => {
    // `Math.max` propagates NaN, which would zero the whole signal and take
    // apps away from a player whose save has one bad field.
    const { mod } = loadWithNetWorth(() => NaN);

    expect(mod.wealthMark(stateWith())).toBe(2_000);
  });

  it('a null state is 0, not a throw', () => {
    const { mod } = loadWithNetWorth(() => 0);

    expect(mod.wealthMark(undefined)).toBe(0);
    expect(mod.wealthMark(null)).toBe(0);
  });
});
