/**
 * Insuring and restoring a luxury item, end to end.
 *
 * Both actions shipped with the Phase-5 risk system and had ZERO call sites
 * anywhere in the app — and, unsurprisingly for unreachable code, zero tests.
 * That made the weekly incident roll one-way value destruction: a collection
 * could degrade and the player had no way to insure against it or repair it.
 * They are now wired into the item sheet (2026-07-28 audit reach-2), so they
 * need the same coverage every other luxury action has.
 *
 * This matters more now that condition affects the sale price (econ-1) —
 * insurance and restoration are the counterplay to that nerf, which is why the
 * two ship together.
 */
import { setLuxuryInsurance, restoreLuxuryItem, sellLuxuryItem } from '@/contexts/game/actions/LuxuryActions';
import { createTestGameState } from '../helpers/createTestGameState';
import { getCondition, getRestoreCost, getLuxuryItem, getLuxuryHoldingValue } from '@/lib/luxury';
import type { GameState } from '@/contexts/game/types';

const ITEM_ID = 'supercar';
const ITEM = getLuxuryItem(ITEM_ID)!;

function ownerState(holding?: Record<string, unknown>): GameState {
  const base = createTestGameState();
  return createTestGameState({
    weeksLived: 500,
    stats: { ...base.stats, money: 10_000_000 },
    luxuryItems: [ITEM_ID],
    luxuryHoldings: holding ? ({ [ITEM_ID]: holding } as never) : {},
  });
}

/** Drive an action against a mutable state, like the app's setGameState does. */
function drive(state: GameState, fn: (s: GameState, set: never) => { success: boolean; message: string }) {
  let current = state;
  const set = ((u: (prev: GameState) => GameState) => {
    current = typeof u === 'function' ? u(current) : u;
  }) as never;
  const result = fn(current, set);
  return { result, state: current };
}

describe('setLuxuryInsurance', () => {
  it('insures an owned item', () => {
    const { result, state } = drive(ownerState(), (s, set) =>
      setLuxuryInsurance(s, set, ITEM_ID, true),
    );
    expect(result.success).toBe(true);
    expect(state.luxuryHoldings?.[ITEM_ID]?.insured).toBe(true);
  });

  it('cancels insurance again', () => {
    const insured = ownerState({ acquiredWeek: 1, insured: true });
    const { result, state } = drive(insured, (s, set) => setLuxuryInsurance(s, set, ITEM_ID, false));
    expect(result.success).toBe(true);
    expect(state.luxuryHoldings?.[ITEM_ID]?.insured).toBe(false);
  });

  it('refuses an item the player does not own', () => {
    const stranger = createTestGameState({ luxuryItems: [], luxuryHoldings: {} });
    const { result, state } = drive(stranger, (s, set) => setLuxuryInsurance(s, set, ITEM_ID, true));
    expect(result.success).toBe(false);
    expect(state.luxuryHoldings?.[ITEM_ID]).toBeUndefined();
  });

  it('does not mint a holding for an item sold in the same batch', () => {
    // The outer ownership check reads a render-time snapshot; the in-updater
    // re-check is what stops a premium being billed weekly for an item the
    // player no longer has.
    const state = ownerState();
    let current = state;
    const set = ((u: (prev: GameState) => GameState) => {
      current = u(current);
    }) as never;
    // Sell first, then insure from the STALE snapshot.
    sellLuxuryItem(state, set, ITEM_ID);
    setLuxuryInsurance(state, set, ITEM_ID, true);

    expect(current.luxuryItems).not.toContain(ITEM_ID);
    expect(current.luxuryHoldings?.[ITEM_ID]).toBeUndefined();
  });
});

describe('restoreLuxuryItem', () => {
  const damaged = () => ownerState({ acquiredWeek: 1, currentValue: ITEM.price, condition: 40 });

  it('charges the restore cost and returns the item to pristine', () => {
    const before = damaged();
    const cost = getRestoreCost(ITEM, before.luxuryHoldings?.[ITEM_ID]);
    expect(cost).toBeGreaterThan(0);

    const { result, state } = drive(before, (s, set) => restoreLuxuryItem(s, set, ITEM_ID));
    expect(result.success).toBe(true);
    expect(getCondition(state.luxuryHoldings?.[ITEM_ID])).toBe(100);
    expect(state.stats.money).toBe(before.stats.money - cost);
  });

  it('raises what the item sells for — the point of paying for it', () => {
    const before = damaged();
    const valueDamaged = getLuxuryHoldingValue(ITEM, before.luxuryHoldings?.[ITEM_ID]);

    const { state } = drive(before, (s, set) => restoreLuxuryItem(s, set, ITEM_ID));
    const valueRestored = getLuxuryHoldingValue(ITEM, state.luxuryHoldings?.[ITEM_ID]);

    expect(valueRestored).toBeGreaterThan(valueDamaged);
  });

  it('refuses when the item is already pristine (no charge)', () => {
    const pristine = ownerState({ acquiredWeek: 1, condition: 100 });
    const { result, state } = drive(pristine, (s, set) => restoreLuxuryItem(s, set, ITEM_ID));
    expect(result.success).toBe(false);
    expect(state.stats.money).toBe(pristine.stats.money);
  });

  it('refuses when the player cannot afford it (no partial charge)', () => {
    const broke = createTestGameState({
      weeksLived: 500,
      stats: { ...createTestGameState().stats, money: 1 },
      luxuryItems: [ITEM_ID],
      luxuryHoldings: { [ITEM_ID]: { acquiredWeek: 1, currentValue: ITEM.price, condition: 20 } } as never,
    });
    const { result, state } = drive(broke, (s, set) => restoreLuxuryItem(s, set, ITEM_ID));
    expect(result.success).toBe(false);
    expect(state.stats.money).toBe(1);
    expect(getCondition(state.luxuryHoldings?.[ITEM_ID])).toBe(20);
  });

  it('charges once under a same-batch double-tap', () => {
    const before = damaged();
    const cost = getRestoreCost(ITEM, before.luxuryHoldings?.[ITEM_ID]);
    let current = before;
    const set = ((u: (prev: GameState) => GameState) => {
      current = u(current);
    }) as never;

    restoreLuxuryItem(before, set, ITEM_ID);
    restoreLuxuryItem(before, set, ITEM_ID); // second tap, same stale snapshot

    expect(current.stats.money).toBe(before.stats.money - cost);
    expect(getCondition(current.luxuryHoldings?.[ITEM_ID])).toBe(100);
  });
});
