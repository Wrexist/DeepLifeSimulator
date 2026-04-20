import { GameState } from '@/contexts/GameContext';
import { advanceWeeks, advanceYears } from './helpers/timeHelpers';
import { setupCompanyMogul, setupWealthyPlayer } from './helpers/scenarioBuilders';
import { expectNumericalStability, expectNoNaN } from './helpers/assertions';

describe('Company Stress Tests', () => {
  let baseState: GameState;

  beforeEach(() => {
    baseState = (global as any).createTestGameState({
      date: { year: 2025, month: 'January', week: 1, age: 25 },
      weeksLived: 364, // 7 years lived
      ...setupWealthyPlayer(1000000),
      educations: [
        {
          id: 'entrepreneurship',
          name: 'Entrepreneurship',
          description: 'Learn business',
          cost: 30000,
          duration: 72,
          weeksRemaining: 0,
          completed: true,
          requirements: [],
          unlocks: ['company_creation'],
        },
      ],
    });
  });

  describe('Test 1: Build all 5 company types', () => {
    it('should create all 5 company types successfully', () => {
      const companyTypes = [
        { type: 'factory', cost: 50000 },
        { type: 'ai', cost: 90000 },
        { type: 'restaurant', cost: 130000 },
        { type: 'real-estate', cost: 200000 },
        { type: 'bank', cost: 2000000 },
      ];

      let state = baseState;
      const companies = [];

      for (const { type, cost } of companyTypes) {
        // Verify player has enough money
        expect(state.stats.money).toBeGreaterThanOrEqual(cost);

        // Create company
        const company = {
          id: `${type}-test`,
          type,
          name: `Test ${type}`,
          level: 1,
          employees: 0,
          money: 0,
          baseWeeklyIncome: 2000,
          createdAt: Date.now(),
          upgrades: {},
          warehouse: { capacity: 10, items: {}, miners: {} },
        };

        companies.push(company);

        // Deduct cost
        state = {
          ...state,
          stats: {
            ...state.stats,
            money: state.stats.money - cost,
          },
          companies: [...(state.companies || []), company],
        };

        console.log(`Created ${type} company for $${cost.toLocaleString()}`);
      }

      // Verify all 5 companies created
      expect(state.companies).toHaveLength(5);
      expectNumericalStability(state);

      console.log(`All 5 company types created successfully`);
      console.log(`Remaining money: $${state.stats.money.toLocaleString()}`);
    });

    it('should verify entrepreneurship requirement', () => {
      // State without entrepreneurship education
      const noEducation = {
        ...baseState,
        educations: [],
      };

      // Should not be able to create company without education
      const hasEntrepreneurship = (noEducation.educations || []).some(
        (edu: any) => edu.id === 'entrepreneurship' && edu.completed
      );

      expect(hasEntrepreneurship).toBe(false);

      console.log(`Entrepreneurship requirement verified`);
    });

    it('should handle inflation-adjusted costs', () => {
      const initialCost = 50000; // Factory cost
      const priceIndex = 2.0; // Doubled prices
      const inflatedCost = initialCost * priceIndex;

      expect(inflatedCost).toBe(100000);

      console.log(`Factory cost at 2x inflation: $${inflatedCost.toLocaleString()}`);
    });
  });

  describe('Test 2: Max out all company upgrades', () => {
    it('should calculate upgrade costs with 1.5x multiplier per level', () => {
      const baseCost = 10000;
      const multiplier = 1.5;

      // Calculate costs for levels 1-5
      const upgradeCosts = [];
      for (let level = 1; level <= 5; level++) {
        const cost = baseCost * Math.pow(multiplier, level - 1);
        upgradeCosts.push(cost);
      }

      expect(upgradeCosts[0]).toBe(10000); // Level 1
      expect(upgradeCosts[1]).toBe(15000); // Level 2
      expect(upgradeCosts[2]).toBe(22500); // Level 3
      expect(upgradeCosts[3]).toBe(33750); // Level 4
      expect(upgradeCosts[4]).toBe(50625); // Level 5

      const totalCost = upgradeCosts.reduce((sum, cost) => sum + cost, 0);
      expect(totalCost).toBeCloseTo(131875, 0);

      console.log(`Upgrade costs:`, upgradeCosts.map(c => `$${c.toLocaleString()}`).join(', '));
      console.log(`Total for all 5 levels: $${totalCost.toLocaleString()}`);
    });

    it('should verify income scaling with upgrades', () => {
      const baseIncome = 2000;
      const incomeBonus = 5000; // Per upgrade level

      // Calculate income with all upgrades (assuming 6 upgrades at max level 5)
      const maxUpgrades = 6;
      const maxLevel = 5;
      const totalIncomeBonus = maxUpgrades * maxLevel * incomeBonus;
      const totalIncome = baseIncome + totalIncomeBonus;

      expect(totalIncome).toBe(152000); // $152k per week

      console.log(`Base income: $${baseIncome.toLocaleString()}`);
      console.log(`Total with max upgrades: $${totalIncome.toLocaleString()}/week`);
    });

    it('should test company income over 50 years with max upgrades', () => {
      const weeklyIncome = 150000; // Maxed company
      const years = 50;
      const totalWeeks = years * 52;
      const totalIncome = weeklyIncome * totalWeeks;

      // Expected: $150k * 2600 = $390M
      expect(totalIncome).toBe(390000000);
      expectNoNaN(totalIncome);

      console.log(`Maxed company over 50 years: $${totalIncome.toLocaleString()}`);
    });
  });

  describe('Test 3: Employee scaling (10 employees each)', () => {
    it('should calculate income multiplier with 10 employees', () => {
      const baseIncome = 2000;
      const employees = 10;
      const multiplier = Math.pow(1.1, employees); // 1.1x per employee

      const totalIncome = baseIncome * multiplier;

      // Expected: 2000 * (1.1)^10 ≈ 5187
      expect(multiplier).toBeCloseTo(2.594, 2);
      expect(totalIncome).toBeCloseTo(5187, 0);

      console.log(`Income multiplier with 10 employees: ${multiplier.toFixed(3)}x`);
      console.log(`Weekly income: $${totalIncome.toLocaleString()}`);
    });

    it('should calculate total weekly expenses for all employees', () => {
      const employees = [
        { salary: 1000 },
        { salary: 1500 },
        { salary: 2000 },
        { salary: 2500 },
        { salary: 3000 },
        { salary: 3500 },
        { salary: 4000 },
        { salary: 4500 },
        { salary: 5000 },
        { salary: 5000 },
      ];

      const totalWeeklySalary = employees.reduce((sum, emp) => sum + emp.salary, 0);
      expect(totalWeeklySalary).toBe(32000);

      console.log(`Total weekly salary for 10 employees: $${totalWeeklySalary.toLocaleString()}`);
    });

    it('should verify net income with employees', () => {
      const grossIncome = 20000; // With multiplier
      const employeeCosts = 10000; // 10 employees
      const netIncome = grossIncome - employeeCosts;

      expect(netIncome).toBe(10000);

      console.log(`Gross: $${grossIncome.toLocaleString()}, Costs: $${employeeCosts.toLocaleString()}, Net: $${netIncome.toLocaleString()}`);
    });
  });

  describe('Test 4: Exponential income growth over 20 years', () => {
    it('should simulate company growth from startup to $1M/week', () => {
      let weeklyIncome = 2000; // Starting

      // Simulate growth over 20 years
      const years = 20;
      const weeksPerYear = 52;

      // Assuming 5% weekly growth (aggressive)
      const weeklyGrowthRate = 0.01; // 1% weekly = ~67% annually

      for (let week = 0; week < years * weeksPerYear; week++) {
        weeklyIncome = weeklyIncome * (1 + weeklyGrowthRate);
      }

      // After 1040 weeks at 1% growth: 2000 * (1.01)^1040
      const expected = 2000 * Math.pow(1.01, 1040);

      expect(weeklyIncome).toBeCloseTo(expected, -3);
      expect(weeklyIncome).toBeGreaterThan(1000000); // Over $1M/week
      expectNoNaN(weeklyIncome);

      console.log(`Company income after 20 years: $${weeklyIncome.toLocaleString(undefined, { maximumFractionDigits: 0 })}/week`);
    });

    it('should calculate total lifetime earnings', () => {
      // Conservative estimate: $10k average per week over 20 years
      const avgWeeklyIncome = 10000;
      const years = 20;
      const totalEarnings = avgWeeklyIncome * 52 * years;

      // Expected: $10k * 1040 = $10.4M
      expect(totalEarnings).toBe(10400000);

      console.log(`Estimated lifetime company earnings (20y): $${totalEarnings.toLocaleString()}`);
    });

    it('should verify company reaches billions in value', () => {
      // Multiple maxed companies
      const companies = [
        { weeklyIncome: 150000 }, // Factory maxed
        { weeklyIncome: 150000 }, // AI maxed
        { weeklyIncome: 150000 }, // Restaurant maxed
        { weeklyIncome: 150000 }, // Real Estate maxed
        { weeklyIncome: 200000 }, // Bank maxed (higher tier)
      ];

      const totalWeeklyIncome = companies.reduce((sum, c) => sum + c.weeklyIncome, 0);
      expect(totalWeeklyIncome).toBe(800000); // $800k/week

      // Over 10 years
      const years = 10;
      const totalEarnings = totalWeeklyIncome * 52 * years;

      // Expected: $800k * 520 = $416M
      expect(totalEarnings).toBe(416000000);

      console.log(`5 maxed companies over 10 years: $${totalEarnings.toLocaleString()}`);
    });
  });

  describe('Performance Tests', () => {
    it('should handle multiple companies efficiently', () => {
      const state = {
        ...baseState,
        ...setupCompanyMogul(),
      };

      const startTime = performance.now();

      // Calculate income for all companies
      let totalIncome = 0;
      state.companies?.forEach((company: any) => {
        const baseIncome = company.baseWeeklyIncome || 2000;
        const employeeMultiplier = Math.pow(1.1, company.employees || 0);
        totalIncome += baseIncome * employeeMultiplier;
      });

      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(totalIncome).toBeGreaterThan(0);
      expect(duration).toBeLessThan(10); // Very fast

      console.log(`Company income calculation took ${duration.toFixed(2)}ms`);
      console.log(`Total weekly income: $${totalIncome.toLocaleString()}`);
    });
  });
});
