/**
 * Pure terms for cash IOUs with contacts (lib/contacts/favors.ts): the lent
 * cash repay week, the borrowed cash due week, and the overdue collection plan
 * that both the Contacts actions and (if wired) the weekly tick can apply.
 */
import {
  BORROWED_CASH_TERM_WEEKS,
  LENT_CASH_TERM_WEEKS,
  addFavor,
  cashDebtDueWeek,
  cashLoanRepayableWeek,
  emptyLedger,
  expireFavors,
  isOverdueCashDebt,
  openCashDebtTo,
  openCashLoanTo,
  planOverdueDebtCollection,
  hasCashDebtDueDate,
  termedDebtId,
  TERMED_DEBT_ID_PREFIX,
  type FavorLedger,
} from '../favors';

/** A TERMED debt (booked with the `loan-` prefix), the only kind with a due date. */
const debt = (id: string, contactId: string, value: number, createdWeek: number) => ({
  id: `${TERMED_DEBT_ID_PREFIX}${id}`, contactId, direction: 'owed-by-player' as const, kind: 'money' as const, value, createdWeek,
});

function ledgerOf(...favors: ReturnType<typeof debt>[]): FavorLedger {
  return favors.reduce((l, f) => addFavor(l, f), emptyLedger());
}

describe('cash IOU terms', () => {
  it('derives both dates from createdWeek', () => {
    expect(cashLoanRepayableWeek({ createdWeek: 10 })).toBe(10 + LENT_CASH_TERM_WEEKS);
    expect(cashDebtDueWeek({ createdWeek: 10 })).toBe(10 + BORROWED_CASH_TERM_WEEKS);
  });

  it('a debt is overdue only AFTER its due week, and only while open', () => {
    // "Pay it back by week N": week N is still on time. The tick settles on the
    // week it advances into, so `>=` collected it as the player arrived in N.
    const [f] = ledgerOf(debt('d', 'mom', 100, 10)).favors;
    expect(isOverdueCashDebt(f, 10 + BORROWED_CASH_TERM_WEEKS)).toBe(false);
    expect(isOverdueCashDebt(f, 10 + BORROWED_CASH_TERM_WEEKS + 1)).toBe(true);
    expect(isOverdueCashDebt({ ...f, status: 'redeemed' }, 999)).toBe(false);
  });

  it('an IOU booked before terms existed keeps "repay any time" - it is never overdue', () => {
    // Old and new IOUs had identical id/note formats; only the `loan-` prefix
    // marks a debt that was taken WITH a due date.
    const legacy = addFavor(emptyLedger(), {
      id: 'iou-mom-5', contactId: 'mom', direction: 'owed-by-player', kind: 'money', value: 100, createdWeek: 5,
    }).favors[0];
    expect(hasCashDebtDueDate(legacy)).toBe(false);
    expect(isOverdueCashDebt(legacy, 10_000)).toBe(false);
    expect(planOverdueDebtCollection({ favors: [legacy] }, 10_000, 1_000).collections).toHaveLength(0);
    expect(termedDebtId('mom', 5)).toBe('loan-mom-5');
  });

  it('finds the one open cash IOU in each direction per contact', () => {
    const l = addFavor(ledgerOf(debt('d', 'mom', 100, 10)), {
      id: 'l', contactId: 'sam', direction: 'owed-to-player', kind: 'money', value: 100, createdWeek: 10,
    });
    expect(openCashDebtTo(l, 'mom')?.id).toBe('loan-d');
    expect(openCashDebtTo(l, 'sam')).toBeUndefined();
    expect(openCashLoanTo(l, 'sam')?.id).toBe('l');
  });

  it('the weekly expiry pass still never forgives a debt (no expiresWeek)', () => {
    const l = ledgerOf(debt('d', 'mom', 100, 10));
    expect(expireFavors(l, 10_000).favors[0].status).toBe('open');
  });
});

describe('planOverdueDebtCollection', () => {
  it('takes cash first, oldest-listed first, and books the rest as arrears', () => {
    const l = ledgerOf(debt('a', 'mom', 100, 0), debt('b', 'sam', 80, 1), debt('c', 'kim', 50, 200));
    const plan = planOverdueDebtCollection(l, 20, 150);
    expect(plan.collections.map((c) => [c.favorId, c.paidFromCash, c.toArrears])).toEqual([
      ['loan-a', 100, 0],
      ['loan-b', 50, 30],
    ]);
    expect(plan.cashCollected).toBe(150);
    expect(plan.toArrears).toBe(30);
    expect(plan.ledger.favors.map((f) => f.status)).toEqual(['redeemed', 'redeemed', 'open']);
  });

  it('settling a settled ledger collects nothing and returns the same ledger', () => {
    const l = ledgerOf(debt('a', 'mom', 100, 0));
    const once = planOverdueDebtCollection(l, 20, 1_000);
    const twice = planOverdueDebtCollection(once.ledger, 20, 1_000);
    expect(twice.collections).toHaveLength(0);
    expect(twice.ledger).toBe(once.ledger);
  });

  it('tolerates a malformed ledger, a NaN week and a corrupt amount', () => {
    expect(planOverdueDebtCollection({} as FavorLedger, 20, 100).collections).toHaveLength(0);
    expect(planOverdueDebtCollection(ledgerOf(debt('a', 'mom', 100, 0)), Number.NaN, 100).collections).toHaveLength(0);
    const corrupt = planOverdueDebtCollection(ledgerOf(debt('a', 'mom', Number.NaN, 0)), 20, 100);
    expect(corrupt.cashCollected + corrupt.toArrears).toBe(0);
    expect(corrupt.ledger.favors[0].status).toBe('redeemed');
  });
});
