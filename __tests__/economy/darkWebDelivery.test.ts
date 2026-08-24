/**
 * A dark-web purchase delivers the thing you bought, or says it delivered
 * nothing.
 *
 * PLAYER REPORT (BBQ, 2026-08-11): "Everything bought from Vendor has no purpose
 * and is a piece of candy. Buy items for exp. Gain nothing."
 *
 * Two separate defects sat behind that one sentence.
 *
 * 1. The delivery path granted `items.findIndex(it => !it.owned)` — the next
 *    unowned entry in CATALOGUE order, which has nothing to do with the listing.
 *    Buying "Night Vision" handed over a "Special USB".
 * 2. Only `gear` and `hackingTools` deliver anything at all, but the success
 *    message read "Delivered. <title> is yours." for all seven categories — so
 *    five of them told the player they owned an item no system had heard of.
 *
 * Both are now pinned. The five non-delivering categories stay reputation/heat
 * plays; giving them real payloads is economy design, not a copy fix.
 */
import type React from 'react';
import { createTestGameState } from '../helpers/createTestGameState';
import { GameState } from '@/contexts/game/types';
import {
  LISTING_TITLE_TO_ITEM_ID,
  TITLES_BY_CATEGORY,
  listingItemId,
  MarketCategory,
} from '@/lib/darkweb/marketplace';
import { initialGameState } from '@/contexts/game/initialState';
import { buyMarketListing } from '@/contexts/game/actions/CrimeActions';

const CATALOGUE_IDS = new Set((initialGameState.darkWebItems ?? []).map((i) => i.id));

/**
 * A state holding one listing from a vendor good enough that the scam roll
 * cannot decide the outcome for us. `veil_market` sits at rep 80 → ~4.7% scam,
 * and `buyMarketListing` pre-rolls with `Math.random`, so the roll is stubbed in
 * the delivery tests below.
 */
function stateWithListing(
  over: { title: string; category: MarketCategory; costBtc?: number } ,
): GameState {
  const base = createTestGameState();
  const dw = initialGameState.darkWeb!;
  return {
    ...base,
    cryptos: (base.cryptos ?? []).map((c) => (c.id === 'btc' ? { ...c, owned: 5 } : c)),
    darkWebItems: (initialGameState.darkWebItems ?? []).map((i) => ({ ...i, owned: false })),
    darkWeb: {
      ...dw,
      vendors: [{ id: 'v-good', handle: 'veil_market', reputation: 95, reviewCount: 400 }],
      listings: [
        {
          id: 'L-test',
          vendorId: 'v-good',
          category: over.category,
          title: over.title,
          description: 'test listing',
          costBtc: over.costBtc ?? 0.01,
          tier: 'common',
          heatCost: 2,
          minBuyerRep: 0,
          postedWeek: 0,
          lifetimeWeeks: 4,
        },
      ],
    },
  };
}

/** Drive the action and return the committed state. */
function buy(
  state: GameState,
  listingId = 'L-test',
): { result: ReturnType<typeof buyMarketListing>; state: GameState } {
  let committed = state;
  // Typed as the real dispatch rather than cast with `as never`. The cast broke
  // the compile-time link between this harness and `buyMarketListing`: a change
  // to the setter parameter would still type-check here while the harness
  // silently stopped matching what the action is actually handed.
  const set: React.Dispatch<React.SetStateAction<GameState>> = (updater) => {
    committed = typeof updater === 'function' ? updater(committed) : updater;
  };
  const result = buyMarketListing(state, set, listingId);
  return { result, state: committed };
}

describe('the title → item map cannot drift from the titles it maps', () => {
  it('every mapped id exists in the darkWebItems catalogue', () => {
    expect(CATALOGUE_IDS.size).toBeGreaterThan(0);
    const danglers = Object.entries(LISTING_TITLE_TO_ITEM_ID)
      .filter(([, id]) => !CATALOGUE_IDS.has(id))
      .map(([title, id]) => `${title} → ${id}`);
    expect(danglers).toEqual([]);
  });

  it('every gear and hackingTools title has an entry', () => {
    // The guard that matters: adding a title to TITLES_BY_CATEGORY without a
    // mapping would silently reintroduce a listing that delivers nothing while
    // claiming otherwise.
    const deliveringTitles = [
      ...TITLES_BY_CATEGORY.gear,
      ...TITLES_BY_CATEGORY.hackingTools,
    ];
    // Assert the input is non-empty FIRST - an undefined/empty source would make
    // the loop below iterate nothing and pass while checking nothing.
    expect(deliveringTitles.length).toBeGreaterThan(0);

    const unmapped = deliveringTitles.filter((t) => !(t in LISTING_TITLE_TO_ITEM_ID));
    expect(unmapped).toEqual([]);
  });

  it('resolves a real generated listing, not just the map', () => {
    // Ties the map back to `listingItemId`, the function the action calls.
    for (const title of TITLES_BY_CATEGORY.gear) {
      expect(listingItemId({ category: 'gear', title })).toBeDefined();
    }
    for (const title of TITLES_BY_CATEGORY.hackingTools) {
      expect(listingItemId({ category: 'hackingTools', title })).toBeDefined();
    }
  });

  it('the five non-delivering categories resolve to nothing', () => {
    const nonDelivering: MarketCategory[] = [
      'stolenAccounts', 'cardedItems', 'fakeIds', 'services', 'data',
    ];
    for (const category of nonDelivering) {
      expect(listingItemId({ category, title: 'Lockpicks' })).toBeUndefined();
    }
  });
});

describe('a successful gear purchase delivers the listed item', () => {
  const realRandom = Math.random;
  beforeEach(() => {
    // 0.99 is above every vendor's scam probability → guaranteed success.
    Math.random = () => 0.99;
  });
  afterEach(() => {
    Math.random = realRandom;
  });

  it('buying "Lockpicks" grants lockpick, not the first catalogue entry', () => {
    const { result, state } = buy(stateWithListing({ title: 'Lockpicks', category: 'gear' }));

    expect(result.outcome).toBe('success');
    expect(state.darkWebItems?.find((i) => i.id === 'lockpick')?.owned).toBe(true);
    // `usb` is index 0 of the catalogue - what the old findIndex(!owned) grant
    // would have handed over regardless of the listing.
    expect(state.darkWebItems?.find((i) => i.id === 'usb')?.owned).toBe(false);
  });

  it('buying "Night Vision" grants night_vision', () => {
    const { state } = buy(stateWithListing({ title: 'Night Vision', category: 'gear' }));
    expect(state.darkWebItems?.find((i) => i.id === 'night_vision')?.owned).toBe(true);
  });

  it('a non-delivering category grants no item and does not claim one', () => {
    const { result, state } = buy(stateWithListing({ title: 'New Identity Kit', category: 'fakeIds' }));

    expect(result.outcome).toBe('success');
    expect((state.darkWebItems ?? []).some((i) => i.owned)).toBe(false);
    expect(result.message).not.toMatch(/is yours/);
    expect(result.message).toMatch(/Nothing to add to your kit/);
  });
});

describe('an already-owned tool is refused before any BTC moves', () => {
  it('rejects the purchase and leaves the wallet untouched', () => {
    // Without this the sale succeeds, charges full price and grants nothing -
    // the "piece of candy" complaint reappearing in a new place.
    const base = stateWithListing({ title: 'Lockpicks', category: 'gear' });
    const owned: GameState = {
      ...base,
      darkWebItems: (base.darkWebItems ?? []).map((i) =>
        i.id === 'lockpick' ? { ...i, owned: true } : i
      ),
    };
    const btcBefore = owned.cryptos?.find((c) => c.id === 'btc')?.owned ?? 0;

    const { result, state } = buy(owned);

    expect(result.success).toBe(false);
    expect(result.message).toMatch(/already own/i);
    expect(state.cryptos?.find((c) => c.id === 'btc')?.owned).toBe(btcBefore);
  });
});
