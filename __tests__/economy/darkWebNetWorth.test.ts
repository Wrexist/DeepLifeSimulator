/**
 * Laundered BTC is worth what BTC is worth — in either pocket.
 *
 * PLAYER REPORT (BBQ, 2026-08-11, D-5): "Doesn't add to net worth or attribute
 * any value to items owned."
 *
 * `darkWeb.cleanBtc` is a staging pool, not a currency. `withdrawCleanBtc`
 * moves it 1:1 into `cryptos[btc].owned`, and the canonical `netWorth()` counts
 * `cryptos` at full market price. So the same coin was priced at market in one
 * pocket and at zero in the other, and net worth JUMPED on a tap that moved
 * value from the player's left hand to their right.
 *
 * That figure gates prestige availability, the prestige award, the >$10M
 * passive-income soft cap, bail cost and ad-reward scaling — so the whole
 * laundering loop was penalised on all five for as long as the proceeds sat
 * where the game itself had put them.
 *
 * The conservation test below is the real one. The absolute-value tests only
 * describe today's tuning; `withdrawing does not change net worth` is the
 * property that must hold whatever the numbers become.
 */
import { createTestGameState } from '../helpers/createTestGameState';
import { netWorth } from '@/lib/progress/achievements';
import { withdrawCleanBtc } from '@/lib/darkweb/operations';
import type { GameState } from '@/contexts/game/types';

const BTC_PRICE = 60_000;

/** A player mid-laundering: some clean, some dirty, some already withdrawn. */
function launderer(over: Record<string, unknown> = {}): GameState {
  return createTestGameState({
    stats: { money: 1_000 },
    bankSavings: 0,
    cryptos: [
      { id: 'btc', symbol: 'BTC', name: 'Bitcoin', price: BTC_PRICE, owned: 1, history: [], change24h: 0 },
    ],
    darkWeb: { cleanBtc: 2, dirtyBtc: 5 },
    ...over,
  } as unknown as Partial<GameState>);
}

describe('laundered BTC counts toward net worth', () => {
  it('2 clean BTC adds 2 × the BTC price', () => {
    const withClean = netWorth(launderer());
    const withoutClean = netWorth(launderer({ darkWeb: { cleanBtc: 0, dirtyBtc: 5 } }));

    expect(withClean - withoutClean).toBe(2 * BTC_PRICE);
  });

  it('WITHDRAWING clean BTC does not change net worth (the actual bug)', () => {
    /**
     * The invariant. Before the fix this difference was +2 × BTC_PRICE: tapping
     * Withdraw created $120k of reported wealth out of a pocket transfer.
     */
    const before = launderer();
    const nwBefore = netWorth(before);

    const moved = withdrawCleanBtc(before.darkWeb!, 2);
    expect(moved.ok).toBe(true);
    if (!moved.ok) return;

    const after: GameState = {
      ...before,
      darkWeb: moved.dw,
      cryptos: (before.cryptos ?? []).map((c) =>
        c.id === 'btc' ? { ...c, owned: (c.owned ?? 0) + moved.movedBtc } : c,
      ),
    };

    expect(netWorth(after)).toBe(nwBefore);
  });
});

describe('dirty BTC does NOT count', () => {
  it('is worth nothing until it is laundered', () => {
    // Deliberate: dirty BTC cannot leave without a mixer that takes a cut and
    // several weeks, so it is a claim on future value. Counting it at face
    // would also hide the mixer fee from the scoreboard and remove the reason
    // to launder at all.
    const dirtyRich = netWorth(launderer({ darkWeb: { cleanBtc: 0, dirtyBtc: 50 } }));
    const broke = netWorth(launderer({ darkWeb: { cleanBtc: 0, dirtyBtc: 0 } }));

    expect(dirtyRich).toBe(broke);
  });

  it('so laundering RAISES net worth — the point of the mechanic', () => {
    const dirty = netWorth(launderer({ darkWeb: { cleanBtc: 0, dirtyBtc: 4 } }));
    // Same 4 BTC, laundered (a real mixer takes a cut; this is the ceiling).
    const cleaned = netWorth(launderer({ darkWeb: { cleanBtc: 4, dirtyBtc: 0 } }));

    expect(cleaned).toBeGreaterThan(dirty);
    expect(cleaned - dirty).toBe(4 * BTC_PRICE);
  });
});

describe('it degrades rather than poisoning the total', () => {
  it('a save with no darkWeb slice is unaffected', () => {
    const none = netWorth(launderer({ darkWeb: undefined }));
    const zero = netWorth(launderer({ darkWeb: { cleanBtc: 0, dirtyBtc: 0 } }));

    expect(none).toBe(zero);
    expect(Number.isFinite(none)).toBe(true);
  });

  it('a malformed cleanBtc contributes 0, not NaN', () => {
    // One bad field must not render every net-worth-derived number as NaN —
    // the same failure mode the vehicle guards exist for.
    for (const bad of [NaN, Infinity, -5, null, undefined, 'lots']) {
      const nw = netWorth(launderer({ darkWeb: { cleanBtc: bad, dirtyBtc: 0 } }));
      expect(`${String(bad)} → finite: ${Number.isFinite(nw)}`).toBe(
        `${String(bad)} → finite: true`,
      );
      expect(`${String(bad)} → no credit: ${nw === netWorth(launderer({ darkWeb: { cleanBtc: 0, dirtyBtc: 0 } }))}`)
        .toBe(`${String(bad)} → no credit: true`);
    }
  });

  it('contributes 0 when no BTC price is available to value it against', () => {
    // Without a priced BTC entry there is no honest conversion, so the term
    // drops out rather than guessing.
    const nw = netWorth(launderer({ cryptos: [], darkWeb: { cleanBtc: 3, dirtyBtc: 0 } }));
    const bare = netWorth(launderer({ cryptos: [], darkWeb: { cleanBtc: 0, dirtyBtc: 0 } }));

    expect(nw).toBe(bare);
  });
});

describe('the memo cache cannot serve a stale answer', () => {
  it('a cleanBtc change alone re-computes', () => {
    /**
     * `netWorth` memoises on an explicit list of state slices. `darkWeb` was
     * not on it, so once this term existed the cache would have returned the
     * pre-laundering figure forever for a player who changed nothing else —
     * a fix that reports the old number is not a fix.
     */
    const a = launderer({ darkWeb: { cleanBtc: 1, dirtyBtc: 0 } });
    const first = netWorth(a);

    // Spread the real slice rather than a bare literal: a partial `darkWeb`
    // would need an `as GameState` to compile, and the audit is right that such
    // a cast hides drift (Hard Rule #3).
    const b: GameState = { ...a, darkWeb: { ...a.darkWeb!, cleanBtc: 3 } };
    expect(netWorth(b)).toBe(first + 2 * BTC_PRICE);
  });
});
