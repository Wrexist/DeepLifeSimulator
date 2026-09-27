import { createTestGameState } from '../helpers/createTestGameState';
import { applyWithSetState as apply } from '../helpers/setGameStateStub';
import { withdrawCashFromAccount, closeBankAccount, redeemRewards } from '@/contexts/game/actions/BankingActions';
import { MONEY_CEILING } from '@/contexts/game/actions/MoneyActions';
import { closeAccount } from '@/lib/banking/operations';

function fixture(cash = 100) {
  const state = createTestGameState();
  state.stats.money = cash;
  state.banking!.accounts.push({ id: 'own-savings', type: 'savings', name: 'Rainy day', balance: 100.75, baseAPR: 0.02, openedWeek: 0 });
  state.banking!.creditCards.push({ id: 'rewards', name: 'Starter', tier: 'starter', creditLimit: 500, balance: 0, baseAPR: 0.2, rewardsRate: 0.005, pendingRewards: 50, openedWeek: 0, rewardsType: 'cashback', minCreditScore: 580 });
  return state;
}

it('withdraws the full fractional balance without leaving interest stranded', () => {
  const state = fixture();
  const next = apply(state, set => withdrawCashFromAccount(set, 'own-savings', 100.75));
  expect(next.stats.money).toBe(200.75);
  expect(next.banking!.accounts.find(a => a.id === 'own-savings')!.balance).toBe(0);
});

it.each(['withdraw', 'close', 'reward'] as const)('rejects %s atomically when cash cannot receive the full value', kind => {
  const state = fixture(MONEY_CEILING - 10);
  const next = apply(state, set => {
    if (kind === 'withdraw') withdrawCashFromAccount(set, 'own-savings', 100);
    if (kind === 'close') closeBankAccount(set, 'own-savings');
    if (kind === 'reward') redeemRewards(set, 'rewards');
  });
  expect(next).toBe(state);
});

it('does not erase an overdraft by closing the account', () => {
  const state = fixture();
  state.banking!.accounts.find(a => a.id === 'own-savings')!.balance = -25;
  const result = closeAccount(state.banking!, 'own-savings', state.weeksLived);
  expect(result.ok).toBe(false);
  expect(result.reason).toMatch(/overdraft/);
  expect(apply(state, set => closeBankAccount(set, 'own-savings'))).toBe(state);
});

it('closes a funded account and returns the full residual exactly once', () => {
  const state = fixture();
  const next = apply(state, set => { closeBankAccount(set, 'own-savings'); closeBankAccount(set, 'own-savings'); });
  expect(next.stats.money).toBe(200.75);
  expect(next.banking!.accounts.find(a => a.id === 'own-savings')).toBeUndefined();
});
