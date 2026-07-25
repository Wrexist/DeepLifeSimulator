/**
 * Buying land — the full buy → mint → sell round trip.
 *
 * The unit tests in lib/luxury cover the pure helpers; this drives the real
 * action against a real state to prove the two systems are actually wired, and
 * that the failure modes that would cost the player money cannot happen.
 */

import { purchaseLuxuryItem, sellLuxuryItem } from '@/contexts/game/actions/LuxuryActions';
import { createTestGameState } from '../helpers/createTestGameState';
import { luxuryPropertyId, getLuxuryItem } from '@/lib/luxury';
import type { GameState } from '@/contexts/game/types';

const ISLAND_ID = 'private_island';
const ISLAND = getLuxuryItem(ISLAND_ID)!;
const PROPERTY_ID = luxuryPropertyId(ISLAND_ID);

/** Drive the action against a mutable state, like the real setGameState does. */
function run(
  state: GameState,
  action: (s: GameState, set: (u: (p: GameState) => GameState) => void) => { success: boolean; message: string },
) {
  let current = state;
  const setGameState = (updater: (prev: GameState) => GameState) => {
    current = updater(current);
  };
  const result = action(current, setGameState as never);
  return { result, state: current };
}

function richState(overrides: Partial<GameState> = {}): GameState {
  return createTestGameState({
    weeksLived: 250,
    stats: { ...createTestGameState().stats, money: 500_000_000 },
    realEstate: [],
    luxuryItems: [],
    luxuryHoldings: {},
    ...overrides,
  });
}

describe('buying a developable luxury item', () => {
  it('mints a real property alongside the item', () => {
    const { result, state } = run(richState(), (s, set) => purchaseLuxuryItem(s, set, ISLAND_ID));

    expect(result.success).toBe(true);
    expect(state.luxuryItems).toContain(ISLAND_ID);

    const property = (state.realEstate || []).find((p) => p.id === PROPERTY_ID);
    expect(property).toBeTruthy();
    expect(property!.owned).toBe(true);
    expect(property!.upgradeLevel).toBe(0);
  });

  it('links the item to its property through the holding', () => {
    const { state } = run(richState(), (s, set) => purchaseLuxuryItem(s, set, ISLAND_ID));

    expect(state.luxuryHoldings![ISLAND_ID]).toEqual({
      acquiredWeek: 250,
      propertyId: PROPERTY_ID,
    });
  });

  it('charges the item price once and not the property value on top', () => {
    const before = richState();
    const { state } = run(before, (s, set) => purchaseLuxuryItem(s, set, ISLAND_ID));

    expect(state.stats.money).toBe(before.stats.money - ISLAND.price);
  });

  it('does not relocate the player onto the island', () => {
    const { state } = run(richState(), (s, set) => purchaseLuxuryItem(s, set, ISLAND_ID));
    const property = (state.realEstate || []).find((p) => p.id === PROPERTY_ID)!;
    expect(property.currentResidence).toBe(false);
  });

  it('leaves existing properties untouched', () => {
    const home = { id: 'starter_home', name: 'Home', owned: true, currentResidence: true } as never;
    const { state } = run(richState({ realEstate: [home] }), (s, set) =>
      purchaseLuxuryItem(s, set, ISLAND_ID),
    );

    expect(state.realEstate).toHaveLength(2);
    expect(state.realEstate!.find((p) => p.id === 'starter_home')).toBe(home);
  });

  it('mints nothing for an ordinary collectible', () => {
    const { state } = run(richState(), (s, set) => purchaseLuxuryItem(s, set, 'supercar'));

    expect(state.luxuryItems).toContain('supercar');
    expect(state.realEstate).toHaveLength(0);
    expect(state.luxuryHoldings!.supercar.propertyId).toBeUndefined();
  });

  it('cannot mint twice on a double-tap', () => {
    // Both taps read the same stale snapshot; the second must be a full no-op.
    const start = richState();
    let current = start;
    const set = (u: (p: GameState) => GameState) => {
      current = u(current);
    };
    purchaseLuxuryItem(start, set as never, ISLAND_ID);
    purchaseLuxuryItem(start, set as never, ISLAND_ID);

    expect(current.luxuryItems!.filter((id) => id === ISLAND_ID)).toHaveLength(1);
    expect((current.realEstate || []).filter((p) => p.id === PROPERTY_ID)).toHaveLength(1);
    expect(current.stats.money).toBe(start.stats.money - ISLAND.price);
  });

  it('mints nothing when the purchase is unaffordable', () => {
    const broke = richState({ stats: { ...richState().stats, money: 100 } });
    const { result, state } = run(broke, (s, set) => purchaseLuxuryItem(s, set, ISLAND_ID));

    expect(result.success).toBe(false);
    expect(state.realEstate).toHaveLength(0);
    expect(state.luxuryHoldings).toEqual({});
  });
});

describe('selling a developable luxury item', () => {
  it('removes the property with the item — no orphan left billing upkeep', () => {
    const { state: bought } = run(richState(), (s, set) => purchaseLuxuryItem(s, set, ISLAND_ID));
    const { result, state: sold } = run(bought, (s, set) => sellLuxuryItem(s, set, ISLAND_ID));

    expect(result.success).toBe(true);
    expect(sold.luxuryItems).not.toContain(ISLAND_ID);
    expect(sold.realEstate!.find((p) => p.id === PROPERTY_ID)).toBeUndefined();
    expect(sold.luxuryHoldings![ISLAND_ID]).toBeUndefined();
  });

  it('keeps the player other properties when selling the island', () => {
    const home = { id: 'starter_home', name: 'Home', owned: true } as never;
    const { state: bought } = run(richState({ realEstate: [home] }), (s, set) =>
      purchaseLuxuryItem(s, set, ISLAND_ID),
    );
    const { state: sold } = run(bought, (s, set) => sellLuxuryItem(s, set, ISLAND_ID));

    expect(sold.realEstate).toHaveLength(1);
    expect(sold.realEstate![0].id).toBe('starter_home');
  });

  it('survives a re-buy after a sell without duplicating the property', () => {
    const { state: bought } = run(richState(), (s, set) => purchaseLuxuryItem(s, set, ISLAND_ID));
    const { state: sold } = run(bought, (s, set) => sellLuxuryItem(s, set, ISLAND_ID));
    const { state: rebought } = run(sold, (s, set) => purchaseLuxuryItem(s, set, ISLAND_ID));

    expect((rebought.realEstate || []).filter((p) => p.id === PROPERTY_ID)).toHaveLength(1);
    expect(rebought.luxuryHoldings![ISLAND_ID].propertyId).toBe(PROPERTY_ID);
  });
});
