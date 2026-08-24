/**
 * ContactsActions.lendMoney — the producer of `owed-to-player` money favors that
 * gives the Favors ledger a Redeem side (previously it had zero producers, so
 * the Redeem button never rendered). Round-trips end-to-end with redeemFavor,
 * which credits the cash back exactly once.
 *
 * Also pins the new id-idempotency of recordFavor.
 */
import type { Dispatch, SetStateAction } from 'react';
import { GameState, Relationship } from '@/contexts/game/types';
import { createTestGameState } from '../helpers/createTestGameState';
import { lendMoney, redeemFavor, recordFavor } from '@/contexts/game/actions/ContactsActions';

function makeStore(initial: GameState) {
  let current = initial;
  const setGameState: Dispatch<SetStateAction<GameState>> = (update) => {
    current = typeof update === 'function'
      ? (update as (p: GameState) => GameState)(current)
      : update;
  };
  return { get: () => current, setGameState };
}

function withContact(money: number, rel: Partial<Relationship> = {}) {
  const s = createTestGameState({ weeksLived: 10, stats: { money } as any });
  s.relationships = [
    { id: 'c1', name: 'Sam', type: 'friend', relationshipScore: 50, personality: 'balanced', gender: 'male', age: 30, ...rel } as Relationship,
  ];
  return makeStore(s);
}

describe('lendMoney → redeemFavor round-trip', () => {
  it('debits the loan, books an owed-to-player money IOU, and redeem credits it back once', () => {
    const store = withContact(1000);

    const r = lendMoney(store.get(), store.setGameState, 'c1', 200);
    expect(r.success).toBe(true);
    expect(store.get().stats.money).toBe(800);

    const favor = store.get().favorLedger!.favors.find((f) => f.direction === 'owed-to-player');
    expect(favor).toBeDefined();
    expect(favor!.kind).toBe('money');
    expect(favor!.value).toBe(200);
    expect(favor!.status).toBe('open');

    // Redeem → cash back exactly once (the contact repays).
    const rr = redeemFavor(store.get(), store.setGameState, favor!.id);
    expect(rr.success).toBe(true);
    expect(store.get().stats.money).toBe(1000);
    expect(store.get().favorLedger!.favors.find((f) => f.id === favor!.id)?.status).toBe('redeemed');
  });

  it('is gated once per week per contact', () => {
    const store = withContact(1000);
    lendMoney(store.get(), store.setGameState, 'c1', 100);
    const second = lendMoney(store.get(), store.setGameState, 'c1', 100);
    expect(second.success).toBe(false);
    expect(store.get().stats.money).toBe(900); // debited once
  });

  it('a same-batch double-tap debits once and mints one IOU', () => {
    const store = withContact(1000);
    const stale = store.get();
    lendMoney(stale, store.setGameState, 'c1', 150);
    lendMoney(stale, store.setGameState, 'c1', 150);
    expect(store.get().stats.money).toBe(850);
    expect(store.get().favorLedger!.favors.filter((f) => f.direction === 'owed-to-player').length).toBe(1);
  });

  it('rejects when the player cannot afford the loan and stays whole', () => {
    const store = withContact(50);
    const r = lendMoney(store.get(), store.setGameState, 'c1', 200);
    expect(r.success).toBe(false);
    expect(store.get().stats.money).toBe(50);
    expect((store.get().favorLedger?.favors.length ?? 0)).toBe(0);
  });
});

describe('recordFavor - id idempotency', () => {
  it('does not append a duplicate row for the same favor id', () => {
    const store = makeStore(createTestGameState({ weeksLived: 3 }));
    const favor = {
      id: 'goodwill-x-3',
      contactId: 'x',
      direction: 'owed-to-player' as const,
      kind: 'intro' as const,
      value: 25,
      createdWeek: 3,
    };
    recordFavor(store.setGameState, favor);
    recordFavor(store.setGameState, favor);
    expect(store.get().favorLedger!.favors.filter((f) => f.id === 'goodwill-x-3').length).toBe(1);
  });
});
