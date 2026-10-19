/**
 * Time Machine market foresight (exploit, 2026-10-18).
 *
 * A rewind restores a checkpoint and replays the same weeks. The stock tape was
 * keyed on the life and the week, and the crypto tape on the week alone, so the
 * replayed weeks walked the prices the player had just watched: rewind, buy the
 * winners. Chronomaster makes rewinds free, which made it unlimited.
 *
 * `marketSalt` folds the rewind count into both tapes. Pinned here on the real
 * weekly tick: a life that never rewinds is unchanged and still reproducible,
 * and the same life after a rewind walks a different tape.
 */

import { runPersona } from '../helpers/earlyGameSim';
import { PERSONAS } from '../helpers/earlyGamePersonas';
import { getStockPricesSnapshot, resetStockPrices } from '@/lib/economy/stockMarket';
import { lifeSalt, marketSalt } from '@/utils/seededRoll';

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

jest.setTimeout(300_000);

const WEEKS = 8;

/** One life for WEEKS weeks; returns the stock and crypto prices it ended on. */
async function tape(rewindsUsed: number): Promise<{ stocks: string; crypto: string }> {
  resetStockPrices();
  const r = await runPersona({
    name: 'tape',
    policy: PERSONAS['B text skipper'](),
    scenarioId: 'food_courier',
    seed: 1,
    weeks: WEEKS,
    seedMathRandom: false,
    mutateSeed: (s) => ({ ...s, lineageId: 'market-tape-life', timeMachineUsesThisLife: rewindsUsed }),
  });
  const stocks = Object.entries(getStockPricesSnapshot())
    .map(([symbol, v]) => `${symbol}:${v.price}`)
    .join(',');
  const crypto = (r.finalState.cryptos ?? []).map((c) => `${c.id}:${c.price}`).join(',');
  return { stocks, crypto };
}

describe('marketSalt', () => {
  it('is the life salt until the first rewind, then moves with every rewind', () => {
    const life = { lineageId: 'L', generationNumber: 2 };
    expect(marketSalt(life)).toBe(lifeSalt(life));
    expect(marketSalt({ ...life, timeMachineUsesThisLife: 0 })).toBe(lifeSalt(life));
    const once = marketSalt({ ...life, timeMachineUsesThisLife: 1 });
    const twice = marketSalt({ ...life, timeMachineUsesThisLife: 2 });
    expect(once).not.toBe(lifeSalt(life));
    expect(twice).not.toBe(once);
  });

  it('ignores a malformed count rather than throwing', () => {
    const life = { lineageId: 'L', generationNumber: 1 };
    expect(marketSalt({ ...life, timeMachineUsesThisLife: Number.NaN })).toBe(lifeSalt(life));
    expect(marketSalt({ ...life, timeMachineUsesThisLife: -3 })).toBe(lifeSalt(life));
    expect(marketSalt(undefined)).toBe(lifeSalt(undefined));
  });
});

describe('the market tape on the real weekly tick', () => {
  let never: { stocks: string; crypto: string };

  beforeAll(async () => {
    never = await tape(0);
  });

  it('a life that never rewinds replays the same prices (still deterministic)', async () => {
    const again = await tape(0);
    expect(again.stocks).toBe(never.stocks);
    expect(again.crypto).toBe(never.crypto);
  });

  it('after a rewind the same weeks walk a different stock AND crypto tape', async () => {
    const rewound = await tape(1);
    expect(never.crypto.length).toBeGreaterThan(0);
    expect(rewound.stocks).not.toBe(never.stocks);
    expect(rewound.crypto).not.toBe(never.crypto);
  });
});
