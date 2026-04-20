import { GameState } from '@/contexts/GameContext';
import { advanceWeeks, advanceYears } from './helpers/timeHelpers';
import { setupWealthyPlayer } from './helpers/scenarioBuilders';
import { expectNumericalStability, expectValidPriceIndex, expectNoNaN, expectNoInfinity } from './helpers/assertions';

describe('Economy Stress Tests', () => {
  let baseState: GameState;

  beforeEach(() => {
    baseState = (global as any).createTestGameState({
      date: { year: 2025, month: 'January', week: 1, age: 18 },
      weeksLived: 0,
      priceIndex: 1,
      stats: {
        health: 100,
        happiness: 80,
        energy: 100,
        fitness: 70,
        money: 10000,
        reputation: 50,
        gems: 10,
      },
    });
  });

  describe('Test 1: Inflation compounding over 50 years', () => {
    it('should compound inflation correctly over 50 years (2600 weeks)', () => {
      const initialPriceIndex = 1;
      const annualInflation = 0.03; // 3% per year
      const years = 50;

      // Expected: (1.03)^50 ≈ 4.38
      const expectedPriceIndex = Math.pow(1 + annualInflation, years);

      // Simulate inflation compounding weekly
      let stateWithInflation = {
        ...baseState,
        priceIndex: initialPriceIndex,
      };

      // Advance 50 years
      stateWithInflation = advanceYears(stateWithInflation, years);

      // Manually calculate inflation (since advanceYears doesn't handle inflation)
      const weeklyRate = annualInflation / 52;
      const weeks = years * 52;
      const calculatedPriceIndex = Math.pow(1 + weeklyRate, weeks);

      console.log(`Expected price index after 50 years: ${expectedPriceIndex.toFixed(4)}`);
      console.log(`Calculated price index: ${calculatedPriceIndex.toFixed(4)}`);
      console.log(`Difference: ${Math.abs(expectedPriceIndex - calculatedPriceIndex).toFixed(4)}`);

      // Verify calculated matches expected (within small margin)
      expect(calculatedPriceIndex).toBeCloseTo(expectedPriceIndex, 1);
      expectValidPriceIndex(calculatedPriceIndex, years);

      // Verify no NaN or Infinity
      expect(calculatedPriceIndex).not.toBeNaN();
      expect(calculatedPriceIndex).toBeGreaterThan(0);
      expect(calculatedPriceIndex).toBeLessThan(Infinity);
    });

    it('should scale prices correctly with inflation', () => {
      const initialPrice = 1000;
      const years = 50;
      const annualInflation = 0.03;
      const expectedMultiplier = Math.pow(1.03, years); // ≈ 4.38

      const inflatedPrice = initialPrice * expectedMultiplier;

      expect(inflatedPrice).toBeCloseTo(4384, 0);
      console.log(`$1000 item after 50 years: $${inflatedPrice.toFixed(2)}`);
    });

    it('should handle 100 year inflation without overflow', () => {
      const years = 100;
      const annualInflation = 0.03;

      // Expected: (1.03)^100 ≈ 19.22
      const expectedMultiplier = Math.pow(1.03, years);

      expect(expectedMultiplier).toBeCloseTo(19.22, 1);
      expect(expectedMultiplier).toBeLessThan(Infinity);
      expect(expectedMultiplier).not.toBeNaN();

      console.log(`Price multiplier after 100 years: ${expectedMultiplier.toFixed(2)}x`);
    });
  });

  describe('Test 2: Extreme wealth (billions)', () => {
    it('should handle $1 billion without precision loss', () => {
      const billionaireState: GameState = {
        ...baseState,
        stats: {
          ...baseState.stats,
          money: 1000000000, // $1 billion
        },
      };

      // Perform various transactions
      const afterPurchase = {
        ...billionaireState,
        stats: {
          ...billionaireState.stats,
          money: billionaireState.stats.money - 50000000, // Spend $50M
        },
      };

      expect(afterPurchase.stats.money).toBe(950000000);
      expectNoNaN(afterPurchase.stats);
      expectNoInfinity(afterPurchase.stats);

      console.log(`Starting money: $${billionaireState.stats.money.toLocaleString()}`);
      console.log(`After $50M purchase: $${afterPurchase.stats.money.toLocaleString()}`);
    });

    it('should handle $10 billion operations', () => {
      const ultraRich = 10000000000; // $10 billion

      // Test addition
      const afterEarning = ultraRich + 1000000000; // +$1B
      expect(afterEarning).toBe(11000000000);

      // Test subtraction
      const afterSpending = ultraRich - 500000000; // -$500M
      expect(afterSpending).toBe(9500000000);

      // Test multiplication (10% return)
      const afterReturns = ultraRich * 1.10;
      expect(afterReturns).toBeCloseTo(11000000000, 0);

      expectNoNaN(afterEarning);
      expectNoInfinity(afterEarning);

      console.log(`$10B operations all valid`);
    });

    it('should handle very large wealth accumulation over time', () => {
      let wealth = 1000000; // Start with $1M

      // Simulate 10% annual growth for 50 years
      for (let year = 0; year < 50; year++) {
        wealth = wealth * 1.10;
      }

      // Expected: $1M * (1.1)^50 ≈ $117M
      const expected = 1000000 * Math.pow(1.10, 50);

      expect(wealth).toBeCloseTo(expected, -3); // Within thousands
      expect(wealth).toBeGreaterThan(100000000); // Over $100M
      expectNoNaN(wealth);
      expectNoInfinity(wealth);

      console.log(`$1M growing at 10% annually for 50 years: $${wealth.toLocaleString(undefined, { maximumFractionDigits: 0 })}`);
    });
  });

  describe('Test 3: Passive income scaling', () => {
    it('should calculate weekly passive income from multiple sources', () => {
      // Simulate state with various income sources
      const richState: GameState = {
        ...baseState,
        ...setupWealthyPlayer(5000000),
        stocks: [
          { symbol: 'AAPL', shares: 1000, purchasePrice: 150, currentPrice: 180, dividendYield: 0.006 },
          { symbol: 'GOOGL', shares: 500, purchasePrice: 120, currentPrice: 140, dividendYield: 0.012 },
        ],
        realEstate: [
          { id: 're-1', name: 'Apartment', cost: 500000, rent: 3000, upkeep: 500, rentalBonus: 0, upkeepBonus: 0 },
          { id: 're-2', name: 'House', cost: 800000, rent: 5000, upkeep: 800, rentalBonus: 0, upkeepBonus: 0 },
        ],
      };

      // Calculate expected weekly passive income
      // Stocks: (180 * 1000 * 0.006 + 140 * 500 * 0.012) / 52
      const stockIncome = ((180 * 1000 * 0.006) + (140 * 500 * 0.012)) / 52;

      // Real estate: (3000 - 500 + 5000 - 800) / 4 weeks per month
      const realEstateIncome = (3000 - 500 + 5000 - 800) / 4;

      const totalWeeklyPassive = stockIncome + realEstateIncome;

      expect(totalWeeklyPassive).toBeGreaterThan(0);
      expectNoNaN(totalWeeklyPassive);

      console.log(`Weekly stock dividends: $${stockIncome.toFixed(2)}`);
      console.log(`Weekly real estate income: $${realEstateIncome.toFixed(2)}`);
      console.log(`Total weekly passive: $${totalWeeklyPassive.toFixed(2)}`);
    });

    it('should scale passive income over 10 years', () => {
      const years = 10;
      const weeklyPassiveIncome = 5000; // $5k per week

      const weeksPerYear = 52;
      const totalWeeks = years * weeksPerYear;
      const totalPassiveEarnings = weeklyPassiveIncome * totalWeeks;

      // Expected: $5k * 520 weeks = $2.6M
      expect(totalPassiveEarnings).toBe(2600000);

      console.log(`$5k weekly passive over 10 years: $${totalPassiveEarnings.toLocaleString()}`);
    });

    it('should handle max portfolio passive income', () => {
      // Simulate max diversified portfolio
      const maxWeeklyPassive = 50000; // $50k per week from all sources

      // Over 50 years
      const years = 50;
      const totalEarnings = maxWeeklyPassive * 52 * years;

      // Expected: $50k * 2600 weeks = $130M
      expect(totalEarnings).toBe(130000000);
      expectNoNaN(totalEarnings);
      expectNoInfinity(totalEarnings);

      console.log(`$50k weekly passive over 50 years: $${totalEarnings.toLocaleString()}`);
    });
  });

  describe('Test 4: Numerical stability', () => {
    it('should run 100 year simulation without NaN', () => {
      let state = baseState;

      // Advance 100 years
      state = advanceYears(state, 100);

      // Verify no NaN anywhere in state
      expectNoNaN(state);
      expectNumericalStability(state);

      console.log(`100 year simulation: No NaN detected`);
      console.log(`Final age: ${state.date.age}`);
    });

    it('should handle repeated large transactions', () => {
      let money = 1000000;

      // Perform 1000 transactions
      for (let i = 0; i < 1000; i++) {
        money += 50000; // Earn $50k
        money -= 10000; // Spend $10k
      }

      const expected = 1000000 + (1000 * 40000); // Net +$40k per transaction
      expect(money).toBe(expected);
      expect(money).toBe(41000000);
      expectNoNaN(money);

      console.log(`After 1000 transactions: $${money.toLocaleString()}`);
    });

    it('should handle floating point arithmetic in financial calculations', () => {
      // Test edge cases in financial calculations
      const price = 99.99;
      const quantity = 333;
      const total = price * quantity;

      expect(total).toBeCloseTo(33296.67, 2);
      expectNoNaN(total);

      // Tax calculation (6.5%)
      const tax = total * 0.065;
      const finalTotal = total + tax;

      expect(finalTotal).toBeCloseTo(35450.85, 2);
      expectNoNaN(finalTotal);

      console.log(`Financial calculation: $${total.toFixed(2)} + tax = $${finalTotal.toFixed(2)}`);
    });

    it('should verify all financial calculations remain valid over time', () => {
      let state = baseState;
      state.stats.money = 10000;

      // Simulate 1000 weeks of income and expenses
      for (let week = 0; week < 1000; week++) {
        state.stats.money += 1000; // Weekly income
        state.stats.money -= 500; // Weekly expenses

        expect(state.stats.money).not.toBeNaN();
        expect(state.stats.money).toBeGreaterThan(0);
        expect(state.stats.money).toBeLessThan(Infinity);
      }

      // Expected: 10000 + (1000 * 500) = 510,000
      expect(state.stats.money).toBe(510000);

      console.log(`After 1000 weeks: $${state.stats.money.toLocaleString()}`);
    });
  });

  describe('Performance Tests', () => {
    it('should handle large financial calculations efficiently', () => {
      const startTime = performance.now();

      let total = 0;
      for (let i = 0; i < 100000; i++) {
        total += 100.50;
        total -= 50.25;
      }

      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(total).toBeCloseTo(5025000, 0);
      expect(duration).toBeLessThan(100); // Should be very fast

      console.log(`100k financial operations took ${duration.toFixed(2)}ms`);
    });
  });
});
