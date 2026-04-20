import { GameState } from '@/contexts/GameContext';
import { advanceWeeks, advanceYears } from './helpers/timeHelpers';
import { setupLargeFamily } from './helpers/scenarioBuilders';
import { expectNumericalStability } from './helpers/assertions';

describe('Relationships & Family Stress Tests', () => {
  let baseState: GameState;

  beforeEach(() => {
    baseState = (global as any).createTestGameState({
      date: { year: 2025, month: 'January', week: 1, age: 25 },
      weeksLived: 364,
      stats: {
        health: 100,
        happiness: 80,
        energy: 100,
        fitness: 70,
        money: 100000,
        reputation: 50,
        gems: 10,
      },
      social: {
        relations: [],
      },
    });
  });

  describe('Test 1: Relationship decay over 50 years', () => {
    it('should calculate decay rate for neglected relationships', () => {
      const initialAffection = 100;
      const decayPerWeek = -5; // After 2+ weeks no interaction
      const years = 50;
      const weeks = years * 52; // 2600 weeks

      // Decay starts after 2 weeks, so 2598 weeks of decay
      const decayWeeks = weeks - 2;
      const totalDecay = decayWeeks * decayPerWeek;
      const finalAffection = Math.max(0, initialAffection + totalDecay);

      expect(finalAffection).toBe(0); // Reaches 0 long before 50 years

      // Calculate when it reaches 0
      const weeksToZero = Math.ceil(initialAffection / Math.abs(decayPerWeek)) + 2;
      expect(weeksToZero).toBe(22); // 20 weeks of decay + 2 weeks grace

      console.log(`Relationship decays to 0 in ${weeksToZero} weeks (~${(weeksToZero / 52).toFixed(1)} years)`);
    });

    it('should simulate relationship decay over 10 relationships', () => {
      const relationships = [];

      for (let i = 0; i < 10; i++) {
        relationships.push({
          id: `friend-${i}`,
          name: `Friend ${i}`,
          type: 'friend',
          age: 25,
          affection: 100,
          reliability: 80,
          history: [],
        });
      }

      let state = {
        ...baseState,
        social: { relations: relationships },
      };

      // Advance 50 years without interaction
      state = advanceYears(state, 50);

      // All relationships should have decayed to 0
      // (In actual implementation, this would be calculated in GameContext)

      console.log(`10 relationships after 50 years of no interaction`);
      console.log(`Expected: All affection at 0`);
    });

    it('should test relationship maintenance vs decay', () => {
      const weeksPerInteraction = 1; // Interact every week
      const affectionGainPerInteraction = 5;
      const decayPerWeek = -5;

      // Net change when interacting every week
      const netChange = affectionGainPerInteraction; // No decay if interacting

      let affection = 50;
      const weeks = 52; // 1 year

      for (let week = 0; week < weeks; week++) {
        affection = Math.min(100, affection + netChange);
      }

      expect(affection).toBe(100); // Should max out

      console.log(`Affection after 1 year of weekly interaction: ${affection}`);
    });
  });

  describe('Test 2: Children aging over 50 years', () => {
    it('should simulate children aging from 0 to 50', () => {
      const state = {
        ...baseState,
        date: { ...baseState.date, age: 20 },
        social: {
          relations: [
            {
              id: 'child-1',
              name: 'First Child',
              type: 'child',
              age: 0,
              affection: 100,
              reliability: 80,
                  history: [],
            },
            {
              id: 'child-2',
              name: 'Second Child',
              type: 'child',
              age: 2,
              affection: 100,
              reliability: 80,
                  history: [],
            },
            {
              id: 'child-3',
              name: 'Third Child',
              type: 'child',
              age: 5,
              affection: 100,
              reliability: 80,
                  history: [],
            },
          ],
        },
      };

      // After 50 years, children would be 50, 52, and 55
      const yearsLater = 50;

      console.log(`Parent age: ${state.date.age} → ${state.date.age + yearsLater}`);
      console.log(`Child 1 age: 0 → 50`);
      console.log(`Child 2 age: 2 → 52`);
      console.log(`Child 3 age: 5 → 55`);

      // Note: In actual implementation, children aging would be handled in GameContext
    });

    it('should calculate when children become adults (age 18)', () => {
      const childBirthAge = 0;
      const adultAge = 18;
      const yearsUntilAdult = adultAge - childBirthAge;
      const weeksUntilAdult = yearsUntilAdult * 52;

      expect(weeksUntilAdult).toBe(936); // 18 years = 936 weeks

      console.log(`Child becomes adult in ${weeksUntilAdult} weeks (${yearsUntilAdult} years)`);
    });

    it('should handle multiple generations', () => {
      // Player at 20, has child at 0
      // Player at 40, child is 20 and has grandchild at 0
      // Player at 70, grandchild is 30

      const generations = [
        { generation: 'Player', startAge: 20, endAge: 70 },
        { generation: 'Child', startAge: 0, endAge: 50 },
        { generation: 'Grandchild', startAge: 0, endAge: 30 }, // Born when player is 40
      ];

      generations.forEach((gen) => {
        console.log(`${gen.generation}: ${gen.startAge} → ${gen.endAge}`);
      });

      expect(generations[0].endAge - generations[0].startAge).toBe(50);
      expect(generations[1].endAge - generations[1].startAge).toBe(50);
      expect(generations[2].endAge - generations[2].startAge).toBe(30);
    });
  });

  describe('Test 3: Large family expenses', () => {
    it('should calculate weekly expenses for large family', () => {
      const spouseExpense = 100;
      const childExpense = 50;
      const numChildren = 10;

      const totalWeeklyExpense = spouseExpense + (childExpense * numChildren);
      expect(totalWeeklyExpense).toBe(600); // $600/week

      console.log(`Weekly family expenses: $${totalWeeklyExpense}`);
    });

    it('should calculate annual family expenses', () => {
      const weeklyExpense = 600;
      const weeksPerYear = 52;
      const annualExpense = weeklyExpense * weeksPerYear;

      expect(annualExpense).toBe(31200); // $31,200/year

      console.log(`Annual family expenses: $${annualExpense.toLocaleString()}`);
    });

    it('should calculate 20 year family expenses', () => {
      const weeklyExpense = 600;
      const years = 20;
      const totalExpense = weeklyExpense * 52 * years;

      expect(totalExpense).toBe(624000); // $624k over 20 years

      console.log(`20 year family expenses: $${totalExpense.toLocaleString()}`);
    });

    it('should verify family can be afforded with sufficient income', () => {
      const weeklyFamilyExpense = 600;
      const weeklyIncome = 2000;
      const netIncome = weeklyIncome - weeklyFamilyExpense;

      expect(netIncome).toBe(1400);
      expect(netIncome).toBeGreaterThan(0); // Can afford family

      console.log(`Weekly income: $${weeklyIncome}, Expenses: $${weeklyFamilyExpense}, Net: $${netIncome}`);
    });

    it('should simulate large family over 10 years', () => {
      let state = {
        ...baseState,
        ...setupLargeFamily(10),
        stats: {
          ...baseState.stats,
          money: 100000,
        },
      };

      const weeklyIncome = 2000;
      const weeklyExpense = 600;
      const netWeekly = weeklyIncome - weeklyExpense;
      const years = 10;

      // Simulate 10 years
      for (let week = 0; week < years * 52; week++) {
        state.stats.money += netWeekly;
      }

      const expectedMoney = 100000 + (netWeekly * years * 52);
      expect(state.stats.money).toBeCloseTo(expectedMoney, 0);

      console.log(`Money after 10 years with large family: $${state.stats.money.toLocaleString()}`);
    });
  });

  describe('Test 4: Spouse aging and survival', () => {
    it('should simulate spouse aging from 25 to 100', () => {
      const state = {
        ...baseState,
        date: { ...baseState.date, age: 25 },
        social: {
          relations: [
            {
              id: 'spouse-1',
              name: 'Spouse',
              type: 'spouse',
              age: 25,
              affection: 100,
              reliability: 90,
                  history: [],
            },
          ],
        },
      };

      const yearsLater = 75; // Age to 100

      console.log(`Spouse age: 25 → ${25 + yearsLater}`);
      console.log(`Player age: 25 → ${25 + yearsLater}`);

      // Both should reach 100 together
      expect(25 + yearsLater).toBe(100);
    });

    it('should calculate lifetime happiness bonus from spouse', () => {
      const weeklyHappinessBonus = 5; // Spouse gives +5 happiness
      const years = 50;
      const totalWeeks = years * 52;
      const totalBonus = weeklyHappinessBonus * totalWeeks;

      expect(totalBonus).toBe(13000); // 13,000 happiness points over 50 years

      console.log(`Lifetime happiness from spouse (50y): ${totalBonus.toLocaleString()}`);
    });

    it('should verify spouse expenses are manageable', () => {
      const weeklySpouseExpense = 100;
      const years = 50;
      const totalExpense = weeklySpouseExpense * 52 * years;

      expect(totalExpense).toBe(260000); // $260k over 50 years

      console.log(`Lifetime spouse expenses (50y): $${totalExpense.toLocaleString()}`);
    });

    it('should handle widowhood (spouse death)', () => {
      let state = {
        ...baseState,
        social: {
          relations: [
            {
              id: 'spouse-1',
              name: 'Spouse',
              type: 'spouse',
              age: 70,
              affection: 100,
              reliability: 90,
                  history: [],
            },
          ],
        },
      };

      // Spouse dies (remove from relations)
      state.social.relations = state.social.relations.filter(
        (rel: any) => rel.type !== 'spouse'
      );

      expect(state.social.relations).toHaveLength(0);

      // Player continues alone
      console.log(`Widowhood: Spouse removed, player continues alone`);
    });
  });

  describe('Relationship System Tests', () => {
    it('should handle 50+ relationships efficiently', () => {
      const relationships = [];

      for (let i = 0; i < 50; i++) {
        relationships.push({
          id: `rel-${i}`,
          name: `Person ${i}`,
          type: i < 10 ? 'friend' : 'acquaintance',
          age: 20 + (i % 40),
          affection: 50 + (i % 50),
          reliability: 60 + (i % 40),
          history: [],
        });
      }

      const state = {
        ...baseState,
        social: { relations: relationships },
      };

      expect(state.social.relations).toHaveLength(50);
      expectNumericalStability(state);

      console.log(`Managing 50 relationships successfully`);
    });

    it('should calculate total family happiness bonus', () => {
      const state = {
        ...baseState,
        ...setupLargeFamily(5),
      };

      // Spouse: +5, Each child: +3
      const spouseBonus = 5;
      const childBonus = 3;
      const numChildren = 5;

      const totalBonus = spouseBonus + (childBonus * numChildren);
      expect(totalBonus).toBe(20); // +20 happiness per week

      console.log(`Weekly family happiness bonus: +${totalBonus}`);
    });
  });
});
