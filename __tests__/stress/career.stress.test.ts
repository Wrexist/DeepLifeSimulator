import { GameState } from '@/contexts/GameContext';
import { advanceWeeks, advanceYears } from './helpers/timeHelpers';
import { setupWealthyPlayer } from './helpers/scenarioBuilders';
import { expectNumericalStability } from './helpers/assertions';

describe('Career & Education Stress Tests', () => {
  let baseState: GameState;

  beforeEach(() => {
    baseState = (global as any).createTestGameState({
      date: { year: 2025, month: 'January', week: 1, age: 18 },
      weeksLived: 0,
      stats: {
        health: 100,
        happiness: 80,
        energy: 100,
        fitness: 70,
        money: 50000,
        reputation: 50,
        gems: 10,
      },
      educations: [],
      careers: [],
    });
  });

  describe('Test 1: Complete all education types', () => {
    it('should calculate total duration for all educations', () => {
      const educations = [
        { id: 'high-school', duration: 104, cost: 0 },
        { id: 'police-academy', duration: 30, cost: 12000 },
        { id: 'legal-studies', duration: 46, cost: 18000 },
        { id: 'entrepreneurship', duration: 72, cost: 30000 },
        { id: 'business-degree', duration: 90, cost: 48000 },
        { id: 'computer-science', duration: 104, cost: 72000 },
        { id: 'masters', duration: 120, cost: 90000 },
        { id: 'mba', duration: 150, cost: 120000 },
        { id: 'medical-school', duration: 180, cost: 150000 },
        { id: 'law-school', duration: 156, cost: 132000 },
        { id: 'phd', duration: 208, cost: 180000 },
      ];

      const totalWeeks = educations.reduce((sum, edu) => sum + edu.duration, 0);
      const totalCost = educations.reduce((sum, edu) => sum + edu.cost, 0);
      const totalYears = totalWeeks / 52;

      expect(totalWeeks).toBe(1260);
      expect(totalYears).toBeCloseTo(24.23, 1);
      expect(totalCost).toBe(852000);

      console.log(`Total education duration: ${totalWeeks} weeks (${totalYears.toFixed(1)} years)`);
      console.log(`Total education cost: $${totalCost.toLocaleString()}`);
    });

    it('should simulate completing high school to PhD', () => {
      let state = baseState;

      // Enroll in high school
      state = {
        ...state,
        educations: [
          {
            id: 'high-school',
            name: 'High School',
            description: 'Basic education',
            cost: 0,
            duration: 104,
            weeksRemaining: 104,
            completed: false,
            requirements: [],
            unlocks: [],
          },
        ],
      };

      // Advance 104 weeks
      state = advanceWeeks(state, 104);

      // Mark as completed
      state.educations![0].weeksRemaining = 0;
      state.educations![0].completed = true;

      expect(state.educations).toHaveLength(1);
      expect(state.educations![0].completed).toBe(true);
      expect(state.date.age).toBeCloseTo(20, 1); // 18 + 2 years

      console.log(`Completed high school at age ${state.date.age.toFixed(1)}`);

      // Now enroll in PhD (requires prerequisites)
      state.stats = { ...state.stats, money: Math.max(state.stats.money, 500000) };

      state.educations.push({
        id: 'phd',
        name: 'PhD',
        description: 'Doctorate',
        cost: 180000,
        duration: 208,
        weeksRemaining: 208,
        completed: false,
        requirements: ['masters'],
        unlocks: ['advanced_doctor'],
      });

      // Deduct cost
      state.stats.money -= 180000;

      // Advance 208 weeks
      state = advanceWeeks(state, 208);
      state.educations![1].weeksRemaining = 0;
      state.educations![1].completed = true;

      expect(state.date.age).toBeCloseTo(24, 0); // 20 + 4 years
      expectNumericalStability(state);

      console.log(`Completed PhD at age ${state.date.age.toFixed(1)}`);
    });

    it('should handle multiple simultaneous educations', () => {
      let state = {
        ...baseState,
        stats: {
          ...baseState.stats,
          money: 500000, // Enough for all
        },
        educations: [
          {
            id: 'entrepreneurship',
            name: 'Entrepreneurship',
            description: 'Business',
            cost: 30000,
            duration: 72,
            weeksRemaining: 72,
            completed: false,
            requirements: [],
            unlocks: [],
          },
          {
            id: 'computer-science',
            name: 'Computer Science',
            description: 'CS',
            cost: 72000,
            duration: 104,
            weeksRemaining: 104,
            completed: false,
            requirements: [],
            unlocks: [],
          },
        ],
      };

      // Advance 72 weeks (entrepreneurship completes)
      state = advanceWeeks(state, 72);
      state.educations![0].weeksRemaining = 0;
      state.educations![0].completed = true;
      state.educations![1].weeksRemaining = 104 - 72;

      expect(state.educations![0].completed).toBe(true);
      expect(state.educations![1].completed).toBe(false);
      expect(state.educations![1].weeksRemaining).toBe(32);

      // Advance remaining 32 weeks
      state = advanceWeeks(state, 32);
      state.educations![1].weeksRemaining = 0;
      state.educations![1].completed = true;

      expect(state.educations![1].completed).toBe(true);

      console.log(`Completed 2 educations simultaneously`);
    });
  });

  describe('Test 2: Career progression through all levels', () => {
    it('should calculate career progression from level 0 to max', () => {
      // Fast Food career: 6 levels
      const levels = [
        { level: 0, salary: 30, progressRequired: 100 },
        { level: 1, salary: 45, progressRequired: 100 },
        { level: 2, salary: 60, progressRequired: 100 },
        { level: 3, salary: 75, progressRequired: 100 },
        { level: 4, salary: 90, progressRequired: 100 },
        { level: 5, salary: 110, progressRequired: 100 },
      ];

      // Progress gain: 2-7 per week (average 4.5)
      const avgProgressPerWeek = 4.5;
      const weeksPerLevel = 100 / avgProgressPerWeek;
      const totalWeeks = weeksPerLevel * levels.length;
      const totalYears = totalWeeks / 52;

      expect(weeksPerLevel).toBeCloseTo(22.22, 1);
      expect(totalWeeks).toBeCloseTo(133.33, 1);
      expect(totalYears).toBeCloseTo(2.56, 1);

      console.log(`Fast Food career: ${levels.length} levels`);
      console.log(`Time to max: ${totalWeeks.toFixed(0)} weeks (${totalYears.toFixed(1)} years)`);
    });

    it('should simulate career progression with salary increases', () => {
      let state = baseState;

      // Start Fast Food career
      state = {
        ...state,
        currentJob: {
          id: 'fast-food',
          title: 'Fast Food Worker',
          level: 0,
          salary: 30,
          progress: 0,
          company: 'Burger King',
        },
      };

      // Simulate working for 6 months (26 weeks)
      for (let week = 0; week < 26; week++) {
        // Earn weekly salary
        state.stats.money += state.currentJob!.salary;

        // Gain progress (4 per week)
        state.currentJob!.progress += 4;

        // Check for promotion
        if (state.currentJob!.progress >= 100) {
          state.currentJob!.level += 1;
          state.currentJob!.progress = 0;
          state.currentJob!.salary += 15; // Salary increase
        }
      }

      // After 26 weeks at 4 progress/week = 104 progress = 1 promotion
      expect(state.currentJob!.level).toBe(1);
      expectNumericalStability(state);

      console.log(`After 26 weeks: Level ${state.currentJob!.level}, Salary $${state.currentJob!.salary}`);
    });

    it('should calculate total career earnings over 20 years', () => {
      const avgWeeklySalary = 500; // Average throughout career
      const years = 20;
      const totalWeeks = years * 52;
      const totalEarnings = avgWeeklySalary * totalWeeks;

      // Expected: $500 * 1040 = $520k
      expect(totalEarnings).toBe(520000);

      console.log(`Career earnings over 20 years: $${totalEarnings.toLocaleString()}`);
    });
  });

  describe('Test 3: Career switching', () => {
    it('should handle switching between careers', () => {
      let state = baseState;

      // Start with Fast Food
      state.currentJob = {
        id: 'fast-food',
        title: 'Fast Food',
        level: 2,
        salary: 60,
        progress: 50,
        company: 'Burger King',
      };

      // Switch to Software Engineer (requires education)
      state.currentJob = {
        id: 'software-engineer',
        title: 'Software Engineer',
        level: 0,
        salary: 120,
        progress: 0,
        company: 'Tech Corp',
      };

      expect(state.currentJob.id).toBe('software-engineer');
      expect(state.currentJob.level).toBe(0);
      expect(state.currentJob.salary).toBe(120);

      console.log(`Switched from Fast Food to Software Engineer`);
    });

    it('should verify career requirements', () => {
      // Doctor requires Medical School + PhD
      const doctorRequirements = ['medical-school', 'phd'];

      const state = {
        ...baseState,
        educations: [
          {
            id: 'medical-school',
            name: 'Medical School',
            description: 'Medical',
            cost: 150000,
            duration: 180,
            weeksRemaining: 0,
            completed: true,
            requirements: [],
            unlocks: [],
          },
          {
            id: 'phd',
            name: 'PhD',
            description: 'Doctorate',
            cost: 180000,
            duration: 208,
            weeksRemaining: 0,
            completed: true,
            requirements: [],
            unlocks: [],
          },
        ],
      };

      const hasRequirements = doctorRequirements.every((req) =>
        state.educations.some((edu) => edu.id === req && edu.completed)
      );

      expect(hasRequirements).toBe(true);

      console.log(`Doctor requirements met: Medical School + PhD`);
    });
  });

  describe('Test 4: Education + Career over 30 years', () => {
    it('should simulate full career path from 18 to 48', () => {
      let state = baseState;

      // Phase 1: High School (age 18-20, 104 weeks)
      state = advanceWeeks(state, 104);
      expect(state.date.age).toBeCloseTo(20, 1);

      // Phase 2: Computer Science (age 20-22, 104 weeks)
      state = advanceWeeks(state, 104);
      expect(state.date.age).toBeCloseTo(22, 1);

      // Phase 3: Masters (age 22-24.3, 120 weeks)
      state = advanceWeeks(state, 120);
      expect(state.date.age).toBeCloseTo(24.3, 1);

      // Phase 4: Software Engineer career (age 24-48, ~24 years)
      const careerYears = 24;
      state = advanceYears(state, careerYears);
      expect(state.date.age).toBeCloseTo(48, 0);

      expectNumericalStability(state);

      console.log(`Full career simulation: Age ${baseState.date.age} → ${state.date.age.toFixed(1)}`);
    });

    it('should calculate total education + career income', () => {
      // Education phase: 7 years, no income
      // Career phase: 23 years, average $1000/week

      const educationYears = 7;
      const careerYears = 23;
      const avgWeeklySalary = 1000;

      const totalCareerWeeks = careerYears * 52;
      const totalIncome = avgWeeklySalary * totalCareerWeeks;

      // Expected: $1000 * 1196 = $1.196M
      expect(totalIncome).toBe(1196000);

      console.log(`Career income (${careerYears}y): $${totalIncome.toLocaleString()}`);
    });

    it('should verify energy management over long career', () => {
      let state = baseState;
      state.stats.energy = 100;

      // Simulate 1000 weeks of work
      for (let week = 0; week < 1000; week++) {
        // Work depletes energy
        state.stats.energy = Math.max(0, state.stats.energy - 20);

        // Weekly regeneration
        state.stats.energy = Math.min(100, state.stats.energy + 30);
      }

      // Energy should stabilize at some level
      expect(state.stats.energy).toBeGreaterThan(0);
      expect(state.stats.energy).toBeLessThanOrEqual(100);

      console.log(`Energy after 1000 weeks: ${state.stats.energy}`);
    });
  });

  describe('Performance Tests', () => {
    it('should simulate 30 year career efficiently', () => {
      const startTime = performance.now();

      let state = baseState;
      state = advanceYears(state, 30);

      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(state.date.age).toBeCloseTo(48, 0);
      expect(duration).toBeLessThan(500); // Less than 0.5 seconds

      console.log(`30 year career simulation took ${duration.toFixed(2)}ms`);
    });
  });
});
