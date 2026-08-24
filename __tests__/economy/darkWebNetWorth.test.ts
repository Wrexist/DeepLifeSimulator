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
import { createTestGameState, type TestGameStateOverrides } from '../helpers/createTestGameState';
import { initialGameState } from '@/contexts/game/initialState';
import { netWorth } from '@/lib/progress/achievements';
import { withdrawCleanBtc } from '@/lib/darkweb/operations';
import type { GameState, Crypto, DarkWebState } from '@/contexts/game/types';

const BTC_PRICE = 60_000;

const BTC: Crypto = {
  id: 'btc',
  symbol: 'BTC',
  name: 'Bitcoin',
  price: BTC_PRICE,
  change: 0,
  changePercent: 0,
  owned: 1,
};

/**
 * A real `DarkWebState`, built from the shipped initial slice so the eight
 * fields this suite does not care about stay REAL rather than absent.
 *
 * The fixture used to hand `createTestGameState` a two-field `darkWeb` behind an
 * `as unknown as Partial<GameState>`, and the cast was hiding two genuine
 * defects: `darkWeb` was missing eight required fields, and the crypto literal
 * set a `history` key that does not exist on `Crypto` at all. Both compiled and
 * both asserted nothing — which is the exact drift Hard Rule #3 exists to catch,
 * arriving through the escape hatch the rule warns about.
 */
// A throw, not a `?? {}` fallback: the slice is optional on the type but shipped
// in `initialState`, and silently substituting an empty object would rebuild the
// very partial-fixture problem this replaced.
function requireSlice<T>(slice: T | undefined, name: string): T {
  if (!slice) throw new Error(`initialGameState ships no ${name} slice - fixture cannot be built`);
  return slice;
}

const BASE_DARK_WEB = requireSlice(initialGameState.darkWeb, 'darkWeb');

const darkWebWith = (over: Partial<DarkWebState>): DarkWebState => ({
  ...BASE_DARK_WEB,
  ...over,
});

/** A player mid-laundering: some clean, some dirty, some already withdrawn. */
function launderer(over: TestGameStateOverrides = {}): GameState {
  return createTestGameState({
    stats: { money: 1_000 },
    bankSavings: 0,
    cryptos: [BTC],
    darkWeb: darkWebWith({ cleanBtc: 2, dirtyBtc: 5 }),
    ...over,
  });
}

/**
 * The boundary fixture: a save whose `cleanBtc` is a shape the types forbid.
 *
 * Isolated here, with ONE cast, because that is the only place a malformed
 * persisted value legitimately enters - corrupt storage, a hand-edited save, a
 * field that changed type across versions. Keeping it out of `launderer` means
 * the well-formed fixture stays fully type-checked.
 */
function laundererWithRawCleanBtc(cleanBtc: unknown): GameState {
  return launderer({
    darkWeb: darkWebWith({ cleanBtc: cleanBtc as number, dirtyBtc: 0 }),
  });
}

describe('laundered BTC counts toward net worth', () => {
  it('2 clean BTC adds 2 × the BTC price', () => {
    const withClean = netWorth(launderer());
    const withoutClean = netWorth(launderer({ darkWeb: darkWebWith({ cleanBtc: 0, dirtyBtc: 5 }) }));

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
    const dirtyRich = netWorth(launderer({ darkWeb: darkWebWith({ cleanBtc: 0, dirtyBtc: 50 }) }));
    const broke = netWorth(launderer({ darkWeb: darkWebWith({ cleanBtc: 0, dirtyBtc: 0 }) }));

    expect(dirtyRich).toBe(broke);
  });

  it('so laundering RAISES net worth - the point of the mechanic', () => {
    const dirty = netWorth(launderer({ darkWeb: darkWebWith({ cleanBtc: 0, dirtyBtc: 4 }) }));
    // Same 4 BTC, laundered (a real mixer takes a cut; this is the ceiling).
    const cleaned = netWorth(launderer({ darkWeb: darkWebWith({ cleanBtc: 4, dirtyBtc: 0 }) }));

    expect(cleaned).toBeGreaterThan(dirty);
    expect(cleaned - dirty).toBe(4 * BTC_PRICE);
  });
});

describe('it degrades rather than poisoning the total', () => {
  it('a save with no darkWeb slice is unaffected', () => {
    const none = netWorth(launderer({ darkWeb: undefined }));
    const zero = netWorth(launderer({ darkWeb: darkWebWith({ cleanBtc: 0, dirtyBtc: 0 }) }));

    expect(none).toBe(zero);
    expect(Number.isFinite(none)).toBe(true);
  });

  it('a malformed cleanBtc contributes 0, not NaN', () => {
    // One bad field must not render every net-worth-derived number as NaN -
    // the same failure mode the vehicle guards exist for.
    for (const bad of [NaN, Infinity, -5, null, undefined, 'lots']) {
      const nw = netWorth(laundererWithRawCleanBtc(bad));
      expect(`${String(bad)} → finite: ${Number.isFinite(nw)}`).toBe(
        `${String(bad)} → finite: true`,
      );
      expect(`${String(bad)} → no credit: ${nw === netWorth(launderer({ darkWeb: darkWebWith({ cleanBtc: 0, dirtyBtc: 0 }) }))}`)
        .toBe(`${String(bad)} → no credit: true`);
    }
  });

  it('a numeric STRING gets no credit', () => {
    // `Number('2')` is 2, so a coercing guard would have paid out on a corrupt
    // persisted value. The whole point of the surrounding validation is to
    // reject shapes a real save never produces.
    const strung = netWorth(laundererWithRawCleanBtc('2'));
    const zero = netWorth(launderer({ darkWeb: darkWebWith({ cleanBtc: 0, dirtyBtc: 0 }) }));

    expect(strung).toBe(zero);
  });

  it('an oversized but finite balance stays finite', () => {
    // Two individually-finite numbers can still multiply to Infinity, and the
    // isFinite sweep downstream would then silently zero the entire term.
    const huge = netWorth(launderer({ darkWeb: darkWebWith({ cleanBtc: 1e300, dirtyBtc: 0 }) }));
    expect(Number.isFinite(huge)).toBe(true);
    expect(huge).toBeGreaterThan(0);
  });

  it('contributes 0 when no BTC price is available to value it against', () => {
    // Without a priced BTC entry there is no honest conversion, so the term
    // drops out rather than guessing.
    const nw = netWorth(launderer({ cryptos: [], darkWeb: darkWebWith({ cleanBtc: 3, dirtyBtc: 0 }) }));
    const bare = netWorth(launderer({ cryptos: [], darkWeb: darkWebWith({ cleanBtc: 0, dirtyBtc: 0 }) }));

    expect(nw).toBe(bare);
  });
});

describe('the memo cache cannot serve a stale answer', () => {
  it('a cleanBtc change alone re-computes', () => {
    /**
     * `netWorth` memoises on an explicit list of state slices. `darkWeb` was
     * not on it, so once this term existed the cache would have returned the
     * pre-laundering figure forever for a player who changed nothing else -
     * a fix that reports the old number is not a fix.
     */
    const a = launderer({ darkWeb: darkWebWith({ cleanBtc: 1, dirtyBtc: 0 }) });
    const first = netWorth(a);

    // Spread the real slice rather than a bare literal: a partial `darkWeb`
    // would need an `as GameState` to compile, and the audit is right that such
    // a cast hides drift (Hard Rule #3).
    const b: GameState = { ...a, darkWeb: { ...a.darkWeb!, cleanBtc: 3 } };
    expect(netWorth(b)).toBe(first + 2 * BTC_PRICE);
  });
});
