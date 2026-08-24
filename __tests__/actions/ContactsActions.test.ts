/**
 * ContactsActions — recordInteraction (recency stamp) + repayFavor (money sink)
 * + tickFavors (expiry).
 *
 * These back the ContactsApp Wave-A depth pass:
 *  - recordInteraction stamps `lastInteractionWeek` + bumps `weeklyInteractions`
 *    so recency dots warm, the "This wk" chip lights, and the Attention tab
 *    clears — atomically, so a same-batch double-tap can't charge/bump twice.
 *  - repayFavor is a pure money sink that debits cash and closes an
 *    owed-by-player IOU exactly once (double-tap safe, overdraft safe).
 *  - tickFavors marks past-due favors expired.
 */

import type { Dispatch, SetStateAction } from 'react';
import { GameState, Relationship } from '@/contexts/game/types';
import { createTestGameState } from '../helpers/createTestGameState';
import {
  recordInteraction,
  repayFavor,
  recordFavor,
  tickFavors,
} from '@/contexts/game/actions/ContactsActions';

/** Minimal synchronous setGameState honoring functional-updater semantics. */
function makeStore(initial: GameState) {
  let current = initial;
  const setGameState: Dispatch<SetStateAction<GameState>> = (update) => {
    current = typeof update === 'function'
      ? (update as (p: GameState) => GameState)(current)
      : update;
  };
  return { get: () => current, setGameState };
}

function withContact(rel: Partial<Relationship>, overrides: Partial<GameState> = {}): GameState {
  const s = createTestGameState({ weeksLived: 10, ...overrides });
  s.relationships = [
    {
      id: 'c1',
      name: 'Sam',
      type: 'friend',
      relationshipScore: 40,
      personality: 'balanced',
      gender: 'male',
      age: 30,
      ...rel,
    } as Relationship,
  ];
  return s;
}

describe('recordInteraction - recency stamp', () => {
  it('stamps lastInteractionWeek and bumps score + weeklyInteractions', () => {
    const store = makeStore(withContact({}, { weeksLived: 10 }));
    const r = recordInteraction(store.get(), store.setGameState, 'c1', 'call', 0, 3);
    expect(r.success).toBe(true);
    const rel = store.get().relationships![0];
    expect(rel.lastInteractionWeek).toBe(10);
    expect(rel.weeklyInteractions).toBe(1);
    expect(rel.relationshipScore).toBe(43);
    expect(rel.actions?.call).toBe(10);
  });

  it('gates once per week per action (second same-week call is a no-op)', () => {
    const store = makeStore(withContact({}, { weeksLived: 10 }));
    recordInteraction(store.get(), store.setGameState, 'c1', 'call', 0, 3);
    const second = recordInteraction(store.get(), store.setGameState, 'c1', 'call', 0, 3);
    expect(second.success).toBe(false);
    expect(store.get().relationships![0].relationshipScore).toBe(43); // no double bump
    expect(store.get().relationships![0].weeklyInteractions).toBe(1);
  });

  it('resets weeklyInteractions when the last interaction was an earlier week', () => {
    const store = makeStore(
      withContact({ lastInteractionWeek: 8, weeklyInteractions: 5 }, { weeksLived: 10 })
    );
    recordInteraction(store.get(), store.setGameState, 'c1', 'call', 0, 3);
    expect(store.get().relationships![0].weeklyInteractions).toBe(1);
    expect(store.get().relationships![0].lastInteractionWeek).toBe(10);
  });

  it('a same-batch double-tap only bumps once (atomic gate against prev)', () => {
    const store = makeStore(withContact({}, { weeksLived: 10 }));
    const stale = store.get();
    recordInteraction(stale, store.setGameState, 'c1', 'call', 0, 3);
    recordInteraction(stale, store.setGameState, 'c1', 'call', 0, 3);
    expect(store.get().relationships![0].relationshipScore).toBe(43); // exactly one bump
    expect(store.get().relationships![0].weeklyInteractions).toBe(1);
  });

  it('charges a cost via the money leg and rejects when unaffordable', () => {
    const rich = makeStore(withContact({}, { weeksLived: 10, stats: { money: 100 } as any }));
    const r = recordInteraction(rich.get(), rich.setGameState, 'c1', 'hangout', 30, 5);
    expect(r.success).toBe(true);
    expect(rich.get().stats.money).toBe(70);

    const poor = makeStore(withContact({}, { weeksLived: 10, stats: { money: 10 } as any }));
    const rr = recordInteraction(poor.get(), poor.setGameState, 'c1', 'hangout', 30, 5);
    expect(rr.success).toBe(false);
    expect(poor.get().stats.money).toBe(10);
    expect(poor.get().relationships![0].lastInteractionWeek).toBeUndefined();
  });

  it('returns not-found for an unknown contact', () => {
    const store = makeStore(withContact({}, { weeksLived: 10 }));
    const r = recordInteraction(store.get(), store.setGameState, 'nope', 'call', 0, 3);
    expect(r.success).toBe(false);
  });
});

describe('repayFavor - money sink', () => {
  function withDebt(value: number, money: number): ReturnType<typeof makeStore> {
    const store = makeStore(createTestGameState({ stats: { money } as any, weeksLived: 5 }));
    recordFavor(store.setGameState, {
      id: 'debt1',
      contactId: 'lender',
      direction: 'owed-by-player',
      kind: 'money',
      value,
      createdWeek: 5,
    });
    return store;
  }

  it('debits cash and closes the debt exactly once', () => {
    const store = withDebt(500, 2000);
    const r = repayFavor(store.get(), store.setGameState, 'debt1');
    expect(r.success).toBe(true);
    expect(store.get().stats.money).toBe(1500);
    expect(store.get().favorLedger?.favors.find((f) => f.id === 'debt1')?.status).toBe('redeemed');
  });

  it('is double-tap safe - a stale second tap does not double-debit', () => {
    const store = withDebt(500, 2000);
    const stale = store.get();
    repayFavor(stale, store.setGameState, 'debt1');
    repayFavor(stale, store.setGameState, 'debt1');
    expect(store.get().stats.money).toBe(1500); // debited once
  });

  it('rejects when the player cannot afford it and keeps the debt open', () => {
    const store = withDebt(500, 100);
    const r = repayFavor(store.get(), store.setGameState, 'debt1');
    expect(r.success).toBe(false);
    expect(store.get().stats.money).toBe(100);
    expect(store.get().favorLedger?.favors.find((f) => f.id === 'debt1')?.status).toBe('open');
  });

  it('refuses to repay a favor that is not an owed-by-player money debt', () => {
    const store = makeStore(createTestGameState({ stats: { money: 2000 } as any }));
    recordFavor(store.setGameState, {
      id: 'owed',
      contactId: 'uncle',
      direction: 'owed-to-player',
      kind: 'money',
      value: 300,
      createdWeek: 1,
    });
    const r = repayFavor(store.get(), store.setGameState, 'owed');
    expect(r.success).toBe(false);
    expect(store.get().stats.money).toBe(2000);
  });

  it('returns not-found for an unknown favor id', () => {
    const store = makeStore(createTestGameState({ stats: { money: 2000 } as any }));
    const r = repayFavor(store.get(), store.setGameState, 'ghost');
    expect(r.success).toBe(false);
    expect(r.message).toBe('Favor not found');
  });
});

describe('tickFavors - expiry', () => {
  it('expires past-due open favors and leaves current ones open', () => {
    const store = makeStore(createTestGameState({ weeksLived: 1 }));
    recordFavor(store.setGameState, {
      id: 'lapsed',
      contactId: 'a',
      direction: 'owed-to-player',
      kind: 'discount',
      value: 20,
      createdWeek: 1,
      expiresWeek: 4,
    });
    recordFavor(store.setGameState, {
      id: 'fresh',
      contactId: 'b',
      direction: 'owed-to-player',
      kind: 'discount',
      value: 20,
      createdWeek: 1,
      expiresWeek: 20,
    });
    tickFavors(store.setGameState, 5);
    const favors = store.get().favorLedger!.favors;
    expect(favors.find((f) => f.id === 'lapsed')?.status).toBe('expired');
    expect(favors.find((f) => f.id === 'fresh')?.status).toBe('open');
  });

  it('does not expire an owed-by-player IOU that carries no expiresWeek (debt persists)', () => {
    const store = makeStore(createTestGameState({ weeksLived: 1 }));
    recordFavor(store.setGameState, {
      id: 'iou',
      contactId: 'lender',
      direction: 'owed-by-player',
      kind: 'money',
      value: 400,
      createdWeek: 1,
    });
    tickFavors(store.setGameState, 999);
    expect(store.get().favorLedger!.favors.find((f) => f.id === 'iou')?.status).toBe('open');
  });
});
