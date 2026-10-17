/**
 * Cash between the player and their contacts has TERMS now.
 *
 *  - LENDING: `lendMoney` + `redeemFavor` round-tripped in the same week, so the
 *    +2 bond bump was free and repeatable. The owner's probe lent and redeemed
 *    every week and took a parent's bond 50 -> 70 in ten weeks for $0.
 *  - BORROWING: "Ask to borrow" booked a debt with no due date that nothing
 *    ever read, and could be repeated every week - relationships as a cash
 *    faucet, which CLAUDE.md §4.7 says they must never be.
 *
 * Both terms are derived from the IOU's existing `createdWeek`; no field added.
 */
import type { Dispatch, SetStateAction } from 'react';
import type { GameState, Relationship } from '@/contexts/game/types';
import { createTestGameState } from '../helpers/createTestGameState';
import {
  borrowMoney,
  borrowBlockedReason,
  lendMoney,
  lendBlockedReason,
  recordFavor,
  recordInteraction,
  redeemFavor,
  repayFavor,
  settleOverdueContactDebts,
} from '@/contexts/game/actions/ContactsActions';
import {
  BORROWED_CASH_TERM_WEEKS,
  LENT_CASH_TERM_WEEKS,
  OVERDUE_DEBT_BOND_HIT,
  termedDebtId,
} from '@/lib/contacts/favors';

function makeStore(initial: GameState) {
  let current = initial;
  const setGameState: Dispatch<SetStateAction<GameState>> = (update) => {
    current = typeof update === 'function' ? (update as (p: GameState) => GameState)(current) : update;
  };
  return { get: () => current, setGameState };
}

const person = (id: string, name: string, score: number, type = 'friend'): Relationship =>
  ({ id, name, type, relationshipScore: score, personality: 'balanced', gender: 'female', age: 52 }) as Relationship;

function world(money: number, week = 100, rels: Relationship[] = [person('mom', 'Mom', 50, 'parent'), person('sam', 'Sam', 40)]) {
  const base = createTestGameState();
  const s = createTestGameState({ weeksLived: week, stats: { ...base.stats, money } });
  s.relationships = rels;
  return makeStore(s);
}

const advance = (store: ReturnType<typeof makeStore>, weeks: number) =>
  store.setGameState((p) => ({ ...p, weeksLived: (p.weeksLived ?? 0) + weeks }));

const bond = (store: ReturnType<typeof makeStore>, id: string) =>
  store.get().relationships!.find((r) => r.id === id)!.relationshipScore;

describe('lending - the cash really leaves for a term', () => {
  it("the owner's probe: lend + redeem every week for ten weeks no longer farms a parent's bond", () => {
    const store = world(10_000);
    for (let w = 0; w < 10; w++) {
      // The farmer's order: call in whatever can be called in, then lend again.
      for (const f of store.get().favorLedger?.favors ?? []) {
        if (f.status === 'open' && f.direction === 'owed-to-player') redeemFavor(store.get(), store.setGameState, f.id);
      }
      lendMoney(store.get(), store.setGameState, 'mom', 100);
      advance(store, 1);
    }
    // Before the fix: 70 (+2 every week, cash back the same week).
    // Now: one loan per term per contact -> lends at weeks 0, 4 and 8.
    expect(bond(store, 'mom')).toBe(50 + 2 * 3);
    // The last loan is still out - it has not had its term yet.
    expect(store.get().stats.money).toBe(10_000 - 100);
  });

  it('redeeming before the term is refused with the wait, and after it pays exactly once', () => {
    const store = world(1_000);
    lendMoney(store.get(), store.setGameState, 'sam', 100);
    const loan = store.get().favorLedger!.favors[0];

    advance(store, LENT_CASH_TERM_WEEKS - 1);
    const early = redeemFavor(store.get(), store.setGameState, loan.id);
    expect(early.success).toBe(false);
    expect(early.message).toMatch(/in 1 week\b/);
    expect(store.get().stats.money).toBe(900);

    advance(store, 1);
    expect(redeemFavor(store.get(), store.setGameState, loan.id).success).toBe(true);
    expect(store.get().stats.money).toBe(1_000);
    expect(redeemFavor(store.get(), store.setGameState, loan.id).success).toBe(false);
    expect(store.get().stats.money).toBe(1_000);
  });

  it('one loan per contact at a time - the button and the action give the same reason', () => {
    const store = world(1_000);
    lendMoney(store.get(), store.setGameState, 'sam', 100);
    advance(store, 1);
    const reason = lendBlockedReason(store.get(), 'sam');
    expect(reason).toMatch(/still owes you \$100/);
    const again = lendMoney(store.get(), store.setGameState, 'sam', 100);
    expect(again).toEqual({ success: false, message: reason });
    expect(store.get().stats.money).toBe(900);
    // A different contact is unaffected.
    expect(lendMoney(store.get(), store.setGameState, 'mom', 100).success).toBe(true);
  });
});

describe('borrowing - a debt with a due date', () => {
  it('books an IOU and refuses to lend again while it is open (weekly asks no longer stack)', () => {
    const store = world(0);
    let granted = 0;
    for (let w = 0; w < BORROWED_CASH_TERM_WEEKS - 1; w++) {
      const r = borrowMoney(store.get(), store.setGameState, 'mom', 0); // roll 0 = yes
      if (r.granted) granted++;
      advance(store, 1);
    }
    expect(granted).toBe(1);
    const open = store.get().favorLedger!.favors.filter((f) => f.status === 'open' && f.direction === 'owed-by-player');
    expect(open).toHaveLength(1);
    expect(borrowBlockedReason(store.get(), 'mom')).toMatch(/still owe Mom/);
  });

  it('a refusal still costs bond and counts toward the guarantee, with no money and no debt', () => {
    const store = world(0);
    const r = borrowMoney(store.get(), store.setGameState, 'sam', 0.99);
    expect(r).toMatchObject({ success: true, granted: false });
    expect(bond(store, 'sam')).toBe(35);
    expect(store.get().stats.money).toBe(0);
    expect(store.get().favorLedger?.favors ?? []).toHaveLength(0);
  });

  it('past the due week, the next contact action collects it from cash and costs the lender bond', () => {
    const store = world(0);
    const r = borrowMoney(store.get(), store.setGameState, 'mom', 0);
    const owed = 25 + Math.round(50 * 1.5); // $100 at bond 50
    expect(r.success && r.granted).toBe(true);
    expect(store.get().stats.money).toBe(owed);
    const momAfterAsk = bond(store, 'mom');

    // ON the due week ("pay it back by week N"): still on time, nothing taken.
    advance(store, BORROWED_CASH_TERM_WEEKS);
    store.setGameState((p) => ({ ...p, stats: { ...p.stats, money: 1_000 } }));
    recordInteraction(store.get(), store.setGameState, 'sam', 'call', 0, 3);
    expect(store.get().stats.money).toBe(1_000);

    // Past it: calling SOMEONE ELSE is enough - Mom takes her money back first.
    advance(store, 1);
    const call = recordInteraction(store.get(), store.setGameState, 'sam', 'call', 0, 3);
    expect(call.success).toBe(true);
    expect(call.message).toMatch(/Mom took back the \$100 you owed/);
    expect(store.get().stats.money).toBe(1_000 - owed);
    expect(bond(store, 'mom')).toBe(momAfterAsk - OVERDUE_DEBT_BOND_HIT);
    expect(store.get().favorLedger!.favors.every((f) => f.status !== 'open')).toBe(true);

    // Collected once: the next action finds nothing due.
    recordInteraction(store.get(), store.setGameState, 'mom', 'call', 0, 3);
    expect(store.get().stats.money).toBe(1_000 - owed);
  });

  it('what cash cannot cover becomes overdue bills - never forgiven', () => {
    const store = world(0);
    borrowMoney(store.get(), store.setGameState, 'mom', 0); // $100
    advance(store, BORROWED_CASH_TERM_WEEKS + 1);
    store.setGameState((p) => ({ ...p, stats: { ...p.stats, money: 30 }, overdueBalance: 50 }));
    recordInteraction(store.get(), store.setGameState, 'sam', 'call', 0, 3);
    expect(store.get().stats.money).toBe(0);
    expect(store.get().overdueBalance).toBe(50 + 70);
  });

  it('a debt borrowed BEFORE terms existed keeps its "repay any time" promise', () => {
    // The shape the old inline ContactsApp handler booked: an owed-by-player
    // money IOU, promised "the debt persists until repaid". Its id format was
    // identical to a new one's, so a due date applied to it would have seized
    // every old debt on the first week after the update. Only `loan-` ids are
    // termed; this one is still owed, and still repayable, but never seized.
    const store = world(500, 300);
    recordFavor(store.setGameState, {
      id: 'iou-mom-40', contactId: 'mom', direction: 'owed-by-player', kind: 'money', value: 160, createdWeek: 40,
      note: 'Borrowed $160 from Mom',
    });
    recordInteraction(store.get(), store.setGameState, 'sam', 'call', 0, 3);
    expect(store.get().stats.money).toBe(500);
    expect(store.get().favorLedger!.favors[0].status).toBe('open');
    expect(repayFavor(store.get(), store.setGameState, 'iou-mom-40').success).toBe(true);
    expect(store.get().stats.money).toBe(340);
  });

  it('several overdue IOUs to one lender cost the bond hit once, not per IOU', () => {
    const store = world(1_000, 300);
    for (const w of [40, 41, 42]) {
      recordFavor(store.setGameState, {
        id: termedDebtId('mom', w), contactId: 'mom', direction: 'owed-by-player', kind: 'money', value: 100, createdWeek: w,
      });
    }
    const settled = settleOverdueContactDebts(store.get());
    expect(settled.state.stats.money).toBe(700);
    expect(settled.state.relationships!.find((r) => r.id === 'mom')!.relationshipScore).toBe(50 - OVERDUE_DEBT_BOND_HIT);
    // Nothing due: the very same object comes back.
    expect(settleOverdueContactDebts(settled.state).state).toBe(settled.state);
  });

  it('repaying on time costs no bond; repaying late is the collection, bond hit included', () => {
    const onTime = world(0);
    borrowMoney(onTime.get(), onTime.setGameState, 'mom', 0);
    const asked = bond(onTime, 'mom');
    advance(onTime, BORROWED_CASH_TERM_WEEKS); // the due week itself is on time
    const debt = onTime.get().favorLedger!.favors[0];
    expect(repayFavor(onTime.get(), onTime.setGameState, debt.id).success).toBe(true);
    expect(bond(onTime, 'mom')).toBe(asked);
    expect(onTime.get().stats.money).toBe(0);

    const late = world(0);
    borrowMoney(late.get(), late.setGameState, 'mom', 0);
    advance(late, BORROWED_CASH_TERM_WEEKS + 1);
    const lateDebt = late.get().favorLedger!.favors[0];
    const r = repayFavor(late.get(), late.setGameState, lateDebt.id);
    expect(r.success).toBe(true);
    expect(r.message).toMatch(/Past due/);
    expect(bond(late, 'mom')).toBe(asked - OVERDUE_DEBT_BOND_HIT);
    expect(late.get().stats.money).toBe(0);
    expect(late.get().favorLedger!.favors[0].status).toBe('redeemed');
  });

  it('a same-batch double tap borrows once and collects once', () => {
    const store = world(0);
    const stale = store.get();
    borrowMoney(stale, store.setGameState, 'mom', 0);
    borrowMoney(stale, store.setGameState, 'mom', 0);
    expect(store.get().favorLedger!.favors).toHaveLength(1);
    expect(store.get().stats.money).toBe(100);

    advance(store, BORROWED_CASH_TERM_WEEKS + 1);
    const due = store.get();
    recordInteraction(due, store.setGameState, 'sam', 'call', 0, 3);
    recordInteraction(due, store.setGameState, 'sam', 'hangout', 0, 3);
    expect(store.get().stats.money).toBe(0);
    expect(bond(store, 'mom')).toBe(47 - OVERDUE_DEBT_BOND_HIT);
  });
});
