import type { CryptoMarketState, Crypto, BankingState, DarkWebState } from '@/contexts/game/types';
import { runCryptoWeeklyTick } from '@/lib/crypto/weeklyTick';
import { runWeeklyBankingTick } from '@/lib/banking/weeklyTick';
import { runDarkWebWeeklyTick } from '@/lib/darkweb/weeklyTick';

/**
 * Regression: a partially-migrated save can carry a subsystem slice that EXISTS
 * but is missing an optional array field (e.g. `cryptoMarket` without `dcaRules`,
 * `banking` without `accounts`, `darkWeb` without `activeJobs`). Because
 * `prevState.X ?? initial` only fires when the WHOLE slice is missing, these
 * partial slices reached the tick and an unguarded `.map()` / `.length` / spread
 * threw INSIDE the weekly-tick setGameState updater — whose outer catch returns
 * prevState, so the player tapped "Next Week" and nothing happened (soft-lock).
 *
 * These ticks must now tolerate the missing arrays without throwing.
 */

const fixedRoll = (_: string) => 0.5;

describe('weekly tick resilience to partially-migrated slices', () => {
  it('crypto tick survives a market missing dcaRules / coinMarkets', () => {
    // Intentionally omit dcaRules and coinMarkets (cast: simulating an old save).
    const market = {
      openOrders: [],
      orderHistory: [],
      costBasis: {},
      realizedGainsThisYear: 0,
      totalRealizedGains: 0,
    } as unknown as CryptoMarketState;
    const btc: Crypto = { id: 'btc', symbol: 'BTC', name: 'Bitcoin', price: 50000, change: 0, changePercent: 0, owned: 0 };

    expect(() =>
      runCryptoWeeklyTick({ market, cryptos: [btc], cashIn: 1000, currentWeek: 10, rollFor: fixedRoll })
    ).not.toThrow();
  });

  it('banking tick survives a banking slice missing accounts', () => {
    const banking = {
      creditCards: [],
      billPayRules: [],
      budgetSpend: [],
      creditScore: {
        score: 650, band: 'fair',
        componentBreakdown: { paymentHistory: 70, utilization: 60, accountAge: 0, creditMix: 30, inquiries: 100 },
        lastUpdatedWeek: 0, history: [], inquiries: [],
      },
      savingsGoals: [],
      totalLateFeesPaid: 0,
      totalInterestEarned: 0,
      totalInterestPaid: 0,
      taxDueThisYear: 0,
    } as unknown as BankingState;

    expect(() =>
      runWeeklyBankingTick({
        banking,
        prevLoans: [],
        processedLoans: [],
        newBankSavings: 0,
        newMoney: 0,
        currentWeek: 10,
      })
    ).not.toThrow();
  });

  it('dark-web tick survives a slice missing activeJobs / recentEvents', () => {
    const dw = {
      heat: 10,
      lastHeatDecayWeek: 0,
      dirtyBtc: 0,
      cleanBtc: 0,
      playerReputation: 0,
      vendors: [],
      listings: [],
      jobHistory: [],
      laundering: [],
      skills: {
        hacking: { level: 1, xp: 0, nextLevelXp: 100 },
        social: { level: 1, xp: 0, nextLevelXp: 100 },
        opsec: { level: 1, xp: 0, nextLevelXp: 100 },
        laundering: { level: 1, xp: 0, nextLevelXp: 100 },
      },
    } as unknown as DarkWebState;

    expect(() =>
      runDarkWebWeeklyTick({ darkWeb: dw, currentWeek: 10, rollFor: () => 0.99 })
    ).not.toThrow();
  });
});
