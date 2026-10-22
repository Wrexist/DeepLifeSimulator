/**
 * VIS-3 (audit 2026-10-21): the bank's checking balance disagreed with the
 * wallet between weekly ticks, because the mirror accounts were only copied
 * from `stats.money` / `bankSavings` once a week. The screens now read
 * `withLiveMirrorBalances`, the same function the tick writes with.
 */
import { createTestGameState } from '../helpers/createTestGameState';
import {
  withLiveMirrorBalances,
  LEGACY_CHECKING_ACCOUNT_ID,
  LEGACY_SAVINGS_ACCOUNT_ID,
} from '@/lib/banking/operations';

describe('withLiveMirrorBalances (VIS-3)', () => {
  const base = createTestGameState();
  const banking = base.banking!;

  it('shows live cash and savings on the two mirror accounts, leaving others alone', () => {
    const live = withLiveMirrorBalances(banking, 1_234, 567);
    const byId = (id: string) => live.accounts.find((a) => a.id === id);
    expect(byId(LEGACY_CHECKING_ACCOUNT_ID)?.balance).toBe(1_234);
    expect(byId(LEGACY_SAVINGS_ACCOUNT_ID)?.balance).toBe(567);
    for (const a of live.accounts) {
      if (a.id === LEGACY_CHECKING_ACCOUNT_ID || a.id === LEGACY_SAVINGS_ACCOUNT_ID) continue;
      expect(a).toBe(banking.accounts.find((b) => b.id === a.id));
    }
  });

  it('a stale checking mirror is corrected, and an up-to-date one is returned as is', () => {
    const stale = {
      ...banking,
      accounts: [
        { ...banking.accounts[0], id: LEGACY_CHECKING_ACCOUNT_ID, balance: 10_000 },
        ...banking.accounts.slice(1).filter((a) => a.id !== LEGACY_CHECKING_ACCOUNT_ID),
      ],
    };
    const live = withLiveMirrorBalances(stale, 5_000, 0);
    expect(live.accounts.find((a) => a.id === LEGACY_CHECKING_ACCOUNT_ID)!.balance).toBe(5_000);
    expect(withLiveMirrorBalances(live, 5_000, 0)).toBe(live);
  });

  it('never shows a negative or non-finite balance', () => {
    const live = withLiveMirrorBalances(banking, -50, Number.NaN);
    for (const a of live.accounts) expect(a.balance).toBeGreaterThanOrEqual(0);
  });
});
