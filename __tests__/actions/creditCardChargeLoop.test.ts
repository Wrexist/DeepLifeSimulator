/**
 * Credit-card living-loop wiring (AdvancedBankApp Charge / Pay / Redeem).
 *
 * Before this, a player could apply for a card but never USE it: nothing charged
 * a balance, so payCreditCard always rejected "zero balance" and rewards could
 * never accrue or be redeemed. The AdvancedBankApp now surfaces the existing
 * `spendOnCard` (charge), `payDownCard` (settle), and `redeemRewards` actions.
 *
 * This suite pins the full loop at the game-state action level:
 *   charge → balance grows, cash unchanged, NO rewards yet (anti-exploit: cashback
 *   accrues on settlement, not on charge) → pay → cashback accrues on the repaid
 *   amount → redeem → cashback banked as cash (atomic, double-tap safe).
 */
import { spendOnCard, payDownCard, redeemRewards } from '@/contexts/game/actions/BankingActions';
import { createTestGameState } from '../helpers/createTestGameState';
import type { GameState } from '@/contexts/game/types';
import { createSetGameStateStub } from '../helpers/setGameStateStub';

/**
 * Thin adapter over the shared stub in `helpers/setGameStateStub`.
 *
 * This was one of eight byte-identical hand-rolled copies. Each took
 * `(update: unknown)` and cast twice — `update as GameState` on the value
 * branch, then the whole function `as React.Dispatch<SetStateAction<GameState>>`
 * — which is exactly the shape that makes a stub's behaviour unverifiable:
 * `unknown` in means nothing about the dispatch is checked, and the outer cast
 * asserts the result matches React's type without anything proving it does.
 */
function makeBatchedSetState(initial: GameState) {
  const stub = createSetGameStateStub(initial);
  return { setState: stub.setGameState, get: stub.current };
}

function stateWithCard(opts: {
  money: number;
  checkingBalance: number;
  cardBalance?: number;
  pendingRewards?: number;
  rewardsRate?: number;
  creditLimit?: number;
}): GameState {
  return createTestGameState({
    stats: { money: opts.money } as never,
    settings: { premiumCreditCard: false } as never,
    banking: {
      accounts: [
        // Non-mirrored id → payDownCard debits the account, not stats.money.
        { id: 'chk', type: 'checking', name: 'Checking', balance: opts.checkingBalance, baseAPR: 0, openedWeek: 0 },
      ],
      creditCards: [
        {
          id: 'card1',
          name: 'Test Card',
          tier: 'standard',
          creditLimit: opts.creditLimit ?? 3000,
          balance: opts.cardBalance ?? 0,
          baseAPR: 0.2,
          rewardsRate: opts.rewardsRate ?? 0.02,
          rewardsType: 'cashback',
          pendingRewards: opts.pendingRewards ?? 0,
          openedWeek: 0,
          minCreditScore: 670,
          annualFee: 0,
        },
      ],
    } as never,
  });
}

describe('credit-card charge → pay → redeem loop', () => {
  it('spendOnCard grows the balance with no cash movement and no rewards yet', () => {
    const { setState, get } = makeBatchedSetState(stateWithCard({ money: 500, checkingBalance: 2000 }));

    spendOnCard(setState, 'card1', 1000, 'Purchase');

    const card = get().banking!.creditCards[0];
    expect(card.balance).toBe(1000); // balance grew
    expect(card.pendingRewards).toBe(0); // cashback accrues on settlement, not charge
    expect(get().stats.money).toBe(500); // cash unchanged at charge time
  });

  it('rejects a charge that would exceed the available credit limit', () => {
    const { setState, get } = makeBatchedSetState(
      stateWithCard({ money: 500, checkingBalance: 2000, creditLimit: 3000, cardBalance: 2500 })
    );

    spendOnCard(setState, 'card1', 1000, 'Purchase'); // 2500 + 1000 > 3000 → reject

    expect(get().banking!.creditCards[0].balance).toBe(2500); // unchanged
  });

  it('paying down accrues cashback on the repaid amount; redeem banks it as cash', () => {
    const { setState, get } = makeBatchedSetState(
      stateWithCard({ money: 500, checkingBalance: 2000, rewardsRate: 0.02 })
    );

    spendOnCard(setState, 'card1', 1000, 'Purchase');
    payDownCard(setState, 'card1', 'chk', 1000);

    const afterPay = get();
    expect(afterPay.banking!.creditCards[0].balance).toBe(0);
    expect(afterPay.banking!.accounts.find((a) => a.id === 'chk')!.balance).toBe(1000); // 2000 − 1000
    expect(afterPay.banking!.creditCards[0].pendingRewards).toBeCloseTo(20, 5); // 2% of repaid $1000
    expect(afterPay.stats.money).toBe(500); // paid from checking, not cash

    redeemRewards(setState, 'card1');

    const afterRedeem = get();
    expect(afterRedeem.banking!.creditCards[0].pendingRewards).toBe(0);
    expect(afterRedeem.stats.money).toBe(520); // 500 + 20 redeemed
  });

  it('double-tap redeem banks the rewards exactly once', () => {
    const { setState, get } = makeBatchedSetState(
      stateWithCard({ money: 500, checkingBalance: 0, cardBalance: 0, pendingRewards: 20 })
    );

    redeemRewards(setState, 'card1');
    redeemRewards(setState, 'card1'); // second tap: pending already 0 → no-op

    expect(get().stats.money).toBe(520);
    expect(get().banking!.creditCards[0].pendingRewards).toBe(0);
  });
});
