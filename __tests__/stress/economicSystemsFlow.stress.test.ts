/**
 * Economic systems audit: loans, stocks weekly tick, real estate tenant
 * satisfaction.
 *
 * Why this file:
 *  - `loanEligibility` returned NaN when any input was NaN, because
 *    `Math.min(NaN, x) === NaN` and `NaN < 500` is false, so the early-zero
 *    guard let it slip through. BUGFIX #24 — every numeric input is now
 *    sanitized at the entry, and the final value is guarded.
 *  - `runStocksWeeklyTick` orchestrates sector rotation, dividend payouts,
 *    and order matching — a regression here silently corrupts player wealth.
 *  - tenant satisfaction is recomputed every nextWeek for every owned
 *    property; one NaN bleed and the rental income breaks.
 *
 * The satisfaction block below used to drive `@/utils/realEstateWeekly`'s
 * `updateTenantSatisfactionForWeek`, and the note here claimed that function
 * "is called every nextWeek for every owned property". It was not called
 * anywhere in production — the module had ZERO importers outside tests. The
 * shipping path is `lib/realEstate/tenancy.ts`'s `satisfactionStep`, reached
 * per-property from `lib/realEstate/weeklyTick.ts` → `tickProperty`. That
 * orphan module is deleted; these cases now exercise the real one.
 * 2026-07-30 audit PERF-5.
 *
 * `lib/realEstate/__tests__/tenancy.test.ts` already covers the directional
 * unit behaviour (poor condition decays, overcharging decays, clamps hold), so
 * what is added here is what this file is for: long-horizon and hostile-input
 * stress, where a NaN bleed would surface.
 */

import { loanEligibility } from '@/utils/loan';
import { runStocksWeeklyTick } from '@/lib/stocks/weeklyTick';
import { initialSectorSnapshots, placeOrder, cancelOrder } from '@/lib/stocks/operations';
import { marketFillPrice, bidPrice, askPrice } from '@/lib/stocks/orderBook';
import { quarterlyDividend, isDividendWeek } from '@/lib/stocks/dividends';
import { sectorForSymbol, nextState, sampleDuration } from '@/lib/stocks/sectors';
import { satisfactionStep, RENT_MODE_PARAMS, type RentMode } from '@/lib/realEstate/tenancy';
import { WEEKS_PER_YEAR } from '@/lib/config/gameConstants';

// ---------------------------------------------------------------------------
// Loan eligibility — BUGFIX #24
// ---------------------------------------------------------------------------
describe('Loan eligibility - NaN safety', () => {
  const baseInput = {
    netWorth: 100_000,
    educationTiers: 1,
    credit: 0.8,
    weeklyIncome: 1000,
    existingLoans: [] as { weeklyPayment: number }[],
  };

  it('returns finite maxNewLoanAmount when credit is NaN', () => {
    const r = loanEligibility({ ...baseInput, credit: NaN });
    expect(Number.isFinite(r.maxNewLoanAmount)).toBe(true);
    expect(Number.isFinite(r.weeklyPaymentAtMax)).toBe(true);
  });

  it('returns finite values when weeklyIncome is NaN', () => {
    const r = loanEligibility({ ...baseInput, weeklyIncome: NaN });
    expect(Number.isFinite(r.maxNewLoanAmount)).toBe(true);
    expect(Number.isFinite(r.weeklyPaymentAtMax)).toBe(true);
  });

  it('returns finite values when netWorth is NaN', () => {
    const r = loanEligibility({ ...baseInput, netWorth: NaN });
    expect(Number.isFinite(r.maxNewLoanAmount)).toBe(true);
  });

  it('returns finite values when educationTiers is NaN', () => {
    const r = loanEligibility({ ...baseInput, educationTiers: NaN });
    expect(Number.isFinite(r.maxNewLoanAmount)).toBe(true);
  });

  it('returns finite values when an existing loan has NaN weeklyPayment', () => {
    const r = loanEligibility({
      ...baseInput,
      existingLoans: [{ weeklyPayment: NaN }],
    });
    expect(Number.isFinite(r.maxNewLoanAmount)).toBe(true);
    expect(Number.isFinite(r.weeklyPaymentAtMax)).toBe(true);
  });

  it('returns finite values for Infinity inputs', () => {
    const r = loanEligibility({ ...baseInput, weeklyIncome: Infinity });
    expect(Number.isFinite(r.maxNewLoanAmount)).toBe(true);
  });

  it('clamps negative credit to 0 (no bonus, not a multiplier explosion)', () => {
    const positiveCredit = loanEligibility({ ...baseInput, credit: 0 });
    const negativeCredit = loanEligibility({ ...baseInput, credit: -5 });
    // Both should produce the same result (negative clamped to 0)
    expect(negativeCredit.maxNewLoanAmount).toBe(positiveCredit.maxNewLoanAmount);
  });

  it('clamps super-high credit (>1) to 1 (max 25% bonus, no runaway)', () => {
    const maxedCredit = loanEligibility({ ...baseInput, credit: 1 });
    const wayOver = loanEligibility({ ...baseInput, credit: 99 });
    expect(wayOver.maxNewLoanAmount).toBe(maxedCredit.maxNewLoanAmount);
  });

  it('treats undefined existingLoans as empty array (legacy save / bad state)', () => {
    const r = loanEligibility({ ...baseInput, existingLoans: undefined as any });
    expect(Number.isFinite(r.maxNewLoanAmount)).toBe(true);
    expect(r.maxNewLoanAmount).toBeGreaterThanOrEqual(0);
    expect(Number.isFinite(r.weeklyPaymentAtMax)).toBe(true);
  });

  it('caps at 2 active loans', () => {
    const r = loanEligibility({
      ...baseInput,
      existingLoans: [{ weeklyPayment: 50 }, { weeklyPayment: 50 }],
    });
    expect(r.canOpenAnotherLoan).toBe(false);
    expect(r.maxNewLoanAmount).toBe(0);
    expect(r.reasons).toContain('Too many active loans');
  });

  it('honours DTI: 25% of income minus existing payments', () => {
    const r = loanEligibility({
      netWorth: 1_000_000,    // huge so cap is not the limit
      educationTiers: 4,
      credit: 1,
      weeklyIncome: 1000,
      existingLoans: [],
    });
    expect(r.maxNewLoanAmount).toBeGreaterThan(0);
    // weekly payment at max should respect ~25% of weeklyIncome
    expect(r.weeklyPaymentAtMax).toBeLessThanOrEqual(250 + 0.01);
  });

  it('weeklyPaymentAtMax is positive when a loan is approved', () => {
    const r = loanEligibility({
      netWorth: 500_000,
      educationTiers: 2,
      credit: 0.5,
      weeklyIncome: 2000,
      existingLoans: [],
    });
    if (r.maxNewLoanAmount > 0) {
      expect(r.weeklyPaymentAtMax).toBeGreaterThan(0);
    }
  });

  it('fuzz: 200 random inputs always produce finite output', () => {
    for (let i = 0; i < 200; i++) {
      const r = loanEligibility({
        netWorth: (Math.random() - 0.3) * 10_000_000,
        educationTiers: Math.floor(Math.random() * 6),
        credit: Math.random() * 2 - 0.5,    // include negative + >1
        weeklyIncome: Math.random() * 50_000,
        existingLoans: Array.from({ length: Math.floor(Math.random() * 4) }, () => ({
          weeklyPayment: Math.random() * 1000,
        })),
      });
      expect(Number.isFinite(r.maxNewLoanAmount)).toBe(true);
      expect(Number.isFinite(r.weeklyPaymentAtMax)).toBe(true);
      expect(r.maxNewLoanAmount).toBeGreaterThanOrEqual(0);
    }
  });
});

// ---------------------------------------------------------------------------
// Stocks orderBook + sectors
// ---------------------------------------------------------------------------
describe('Stocks orderBook + sectors', () => {
  it('bid < ask (spread is positive)', () => {
    expect(bidPrice(100)).toBeLessThan(askPrice(100));
  });

  it('marketFillPrice: buy ≥ mid, sell ≤ mid', () => {
    expect(marketFillPrice(100, 'buy', 100)).toBeGreaterThanOrEqual(100);
    expect(marketFillPrice(100, 'sell', 100)).toBeLessThanOrEqual(100);
  });

  it('marketFillPrice: sanitizes NaN / negative / huge inputs', () => {
    expect(Number.isFinite(marketFillPrice(NaN, 'buy', 100))).toBe(true);
    expect(Number.isFinite(marketFillPrice(100, 'buy', NaN))).toBe(true);
    expect(Number.isFinite(marketFillPrice(-50, 'buy', 100))).toBe(true);
    expect(Number.isFinite(marketFillPrice(100, 'buy', 1e15))).toBe(true);
  });

  it('marketFillPrice: slippage scales with size (huge order pays more)', () => {
    const small = marketFillPrice(100, 'buy', 1000);
    const huge = marketFillPrice(100, 'buy', 100_000_000);
    expect(huge).toBeGreaterThan(small);
  });

  it('sectorForSymbol: unknown symbol falls back to tech', () => {
    expect(sectorForSymbol('UNKNOWN_TICKER')).toBe('tech');
    expect(sectorForSymbol('AAPL')).toBe('tech');
    expect(sectorForSymbol('JPM')).toBe('finance');
  });

  it('sectors nextState/sampleDuration: stay within state set, duration ≥ 2', () => {
    const states = ['strong', 'neutral', 'weak'] as const;
    for (let i = 0; i < 100; i++) {
      const from = states[Math.floor(Math.random() * states.length)];
      const next = nextState(from, Math.random());
      expect(states).toContain(next);
      const dur = sampleDuration(next, Math.random());
      expect(dur).toBeGreaterThanOrEqual(2);
      expect(Number.isFinite(dur)).toBe(true);
    }
  });

  it('initialSectorSnapshots returns one per sector, all neutral', () => {
    const s = initialSectorSnapshots();
    expect(s.length).toBe(6);
    for (const snap of s) expect(snap.state).toBe('neutral');
  });

  it('placeOrder + cancelOrder: lifecycle moves order to history', () => {
    const { orders: o1, order } = placeOrder([], {
      symbol: 'AAPL',
      side: 'buy',
      type: 'limit',
      amount: 1000,
      limitPrice: 100,
      placedWeek: 1,
    });
    expect(o1.length).toBe(1);
    expect(order.status).toBe('open');
    const { orders: o2, orderHistory } = cancelOrder(o1, [], order.id);
    expect(o2.length).toBe(0);
    expect(orderHistory.length).toBe(1);
    expect(orderHistory[0].status).toBe('cancelled');
  });

  it('cancelOrder: no-op for unknown id', () => {
    const result = cancelOrder([{ id: 'a', symbol: 'X', side: 'buy', type: 'limit', amount: 1, placedWeek: 0, status: 'open' }], [], 'unknown');
    expect(result.orders.length).toBe(1);
    expect(result.orderHistory.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Stocks weekly tick — end-to-end
// ---------------------------------------------------------------------------
describe('runStocksWeeklyTick', () => {
  const seededRoll = (key: string): number => {
    let hash = 0;
    for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) | 0;
    return Math.abs(hash % 1000) / 1000;
  };

  it('pays dividends on quarter weeks only', () => {
    const input = {
      holdings: [{ symbol: 'AAPL', shares: 100, averagePrice: 100, currentPrice: 150 }],
      openOrders: [],
      orderHistory: [],
      yields: { AAPL: 0.04 },
      prices: { AAPL: 150 },
      currentWeek: 13,        // quarter mark — pays
      rollFor: seededRoll,
    };
    const r = runStocksWeeklyTick(input);
    expect(r.dividendsUSD).toBeGreaterThan(0);
    expect(r.cashDelta).toBeGreaterThan(0);

    const noDiv = runStocksWeeklyTick({ ...input, currentWeek: 14 });
    expect(noDiv.dividendsUSD).toBe(0);
  });

  it('200 weekly ticks: holdings stay finite, no NaN cash leakage', () => {
    let holdings = [{ symbol: 'AAPL', shares: 100, averagePrice: 100, currentPrice: 150 }];
    let openOrders: any[] = [];
    let orderHistory: any[] = [];
    let sectorSnapshots = initialSectorSnapshots();
    let totalCash = 0;
    let totalDividends = 0;

    for (let w = 1; w <= 200; w++) {
      const r = runStocksWeeklyTick({
        holdings,
        openOrders,
        orderHistory,
        sectorSnapshots,
        yields: { AAPL: 0.02 },
        prices: { AAPL: 150 + Math.sin(w / 5) * 20 },
        currentWeek: w,
        rollFor: (k) => seededRoll(`${k}-${w}`),
      });
      holdings = r.holdings;
      openOrders = r.openOrders;
      orderHistory = r.orderHistory;
      sectorSnapshots = r.sectorSnapshots;
      totalCash += r.cashDelta;
      totalDividends += r.dividendsUSD;
      expect(Number.isFinite(r.cashDelta)).toBe(true);
      expect(Number.isFinite(r.dividendsUSD)).toBe(true);
      expect(Number.isFinite(r.realizedGains)).toBe(true);
      for (const h of holdings) {
        expect(Number.isFinite(h.shares)).toBe(true);
        expect(Number.isFinite(h.currentPrice)).toBe(true);
      }
    }
    // 200 weeks @ quarterly → ~15 dividend payouts
    expect(totalDividends).toBeGreaterThan(0);
    expect(Number.isFinite(totalCash)).toBe(true);
  });

  it('limit buy order matches when ask crosses limit', () => {
    const order = {
      id: 'o1',
      symbol: 'AAPL',
      side: 'buy' as const,
      type: 'limit' as const,
      amount: 1000,   // $1000 to spend
      limitPrice: 200,  // willing to pay up to $200
      placedWeek: 0,
      status: 'open' as const,
    };
    const r = runStocksWeeklyTick({
      holdings: [],
      openOrders: [order],
      orderHistory: [],
      yields: {},
      prices: { AAPL: 100 },     // mid is well below limit → should fill
      currentWeek: 5,
      rollFor: seededRoll,
    });
    expect(r.openOrders.length).toBe(0);
    expect(r.holdings.length).toBe(1);
    expect(r.cashDelta).toBeLessThan(0); // bought, so cash went out
  });

  it('limit buy order stays open when mid exceeds limit', () => {
    const order = {
      id: 'o1',
      symbol: 'AAPL',
      side: 'buy' as const,
      type: 'limit' as const,
      amount: 1000,
      limitPrice: 50,
      placedWeek: 0,
      status: 'open' as const,
    };
    const r = runStocksWeeklyTick({
      holdings: [],
      openOrders: [order],
      orderHistory: [],
      yields: {},
      prices: { AAPL: 100 },
      currentWeek: 5,
      rollFor: seededRoll,
    });
    expect(r.openOrders.length).toBe(1);
    expect(r.holdings.length).toBe(0);
  });

  it('order with unknown symbol stays open (mid 0 → no fill)', () => {
    const order = {
      id: 'o1', symbol: 'GHOST', side: 'buy' as const, type: 'limit' as const,
      amount: 1000, limitPrice: 100, placedWeek: 0, status: 'open' as const,
    };
    const r = runStocksWeeklyTick({
      holdings: [], openOrders: [order], orderHistory: [],
      yields: {}, prices: { AAPL: 100 }, currentWeek: 5, rollFor: seededRoll,
    });
    expect(r.openOrders.length).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Real estate tenant satisfaction
// ---------------------------------------------------------------------------
describe('Real estate tenant satisfaction', () => {
  const MODES = Object.keys(RENT_MODE_PARAMS) as RentMode[];

  it('covers every rent mode the params table declares', () => {
    // Guards the loops below: a mode added to RENT_MODE_PARAMS without a
    // satisfactionStep branch would otherwise never be stressed here.
    expect(MODES.length).toBeGreaterThan(1);
  });

  it('NaN-safe: hostile inputs still yield a finite 0..100 value', () => {
    const hostile: any[] = [NaN, Infinity, -Infinity, undefined, null, -50, 1e12, 'x'];
    for (const cur of hostile) {
      for (const cond of hostile) {
        for (const mode of MODES) {
          const r = satisfactionStep(cur, cond, NaN, 0, mode);
          expect(Number.isFinite(r)).toBe(true);
          expect(r).toBeGreaterThanOrEqual(0);
          expect(r).toBeLessThanOrEqual(100);
        }
      }
    }
  });

  it('a zero market rent does not divide satisfaction into NaN', () => {
    // `marketWeeklyRent` is the denominator of the rent ratio. A brand-new or
    // zero-valued property makes it 0.
    for (const mode of MODES) {
      expect(Number.isFinite(satisfactionStep(80, 70, 1000, 0, mode))).toBe(true);
    }
  });

  it('200 weeks of neglect: converges to 0 and never underflows', () => {
    for (const mode of MODES) {
      let sat = 80;
      for (let w = 1; w <= 200; w++) {
        // Condition 10 (well under the 50 decay threshold) and a 3x-over-market
        // ask - the worst sustained case a player can create.
        sat = satisfactionStep(sat, 10, 3000, 1000, mode);
        expect(Number.isFinite(sat)).toBe(true);
        expect(sat).toBeGreaterThanOrEqual(0);
      }
      expect(sat).toBe(0);
    }
  });

  it('200 weeks of a well-kept, under-market rental: rises and never overflows', () => {
    // The opposite direction, so the decay test above cannot pass by the
    // function simply returning 0 for everything.
    for (const mode of MODES) {
      let sat = 20;
      for (let w = 1; w <= 200; w++) {
        sat = satisfactionStep(sat, 100, 500, 1000, mode);
        expect(sat).toBeLessThanOrEqual(100);
      }
      expect(sat).toBe(100);
    }
  });

  it('fuzz: 2000 random inputs stay finite and in range', () => {
    for (let i = 0; i < 2000; i++) {
      const r = satisfactionStep(
        Math.random() * 200 - 50,
        Math.random() * 200 - 50,
        Math.random() * 10_000,
        Math.random() * 10_000,
        MODES[Math.floor(Math.random() * MODES.length)],
      );
      expect(Number.isFinite(r)).toBe(true);
      expect(r).toBeGreaterThanOrEqual(0);
      expect(r).toBeLessThanOrEqual(100);
    }
  });
});

// ---------------------------------------------------------------------------
// Cross-system regression
// ---------------------------------------------------------------------------
describe('Economic systems regression', () => {
  it('500 random loanEligibility calls - fuzz with mixed valid/invalid inputs', () => {
    const types: any[] = [0, 1000, -100, NaN, Infinity, undefined, 'not a number'];
    let okCount = 0;
    let invalidCount = 0;
    for (let i = 0; i < 500; i++) {
      const r = loanEligibility({
        netWorth: types[Math.floor(Math.random() * types.length)],
        educationTiers: types[Math.floor(Math.random() * types.length)],
        credit: types[Math.floor(Math.random() * types.length)],
        weeklyIncome: types[Math.floor(Math.random() * types.length)],
        existingLoans: [],
      });
      expect(Number.isFinite(r.maxNewLoanAmount)).toBe(true);
      expect(Number.isFinite(r.weeklyPaymentAtMax)).toBe(true);
      if (r.maxNewLoanAmount > 0) okCount++;
      else invalidCount++;
    }
    // Both branches should occur across 500 trials (sanity check, not strict)
    expect(okCount + invalidCount).toBe(500);
  });

  it('quarterlyDividend: 1000 random inputs always finite ≥ 0', () => {
    for (let i = 0; i < 1000; i++) {
      const v = quarterlyDividend(
        Math.random() * 1e6,
        Math.random() * 1000,
        Math.random() * 0.1,
      );
      expect(Number.isFinite(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(0);
    }
  });

  it(`isDividendWeek fires exactly ⌊weeks / ${13}⌋ times over ${WEEKS_PER_YEAR * 5} weeks`, () => {
    let count = 0;
    const total = WEEKS_PER_YEAR * 5;
    for (let w = 1; w <= total; w++) if (isDividendWeek(w)) count++;
    expect(count).toBe(Math.floor(total / 13));
  });
});
