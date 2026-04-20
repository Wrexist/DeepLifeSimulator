import { GameState } from '@/contexts/GameContext';

/**
 * Create a wealthy player with specified money
 */
export function setupWealthyPlayer(baseMoney: number = 1000000): Partial<GameState> {
  return {
    stats: {
      health: 100,
      happiness: 80,
      energy: 100,
      fitness: 70,
      money: baseMoney,
      reputation: 80,
      gems: 100,
    },
  };
}

/**
 * Create player with multiple companies
 */
export function setupCompanyMogul(): Partial<GameState> {
  return {
    companies: [
      {
        id: 'factory-1',
        type: 'factory',
        name: 'Test Factory',
        level: 1,
        employees: 5,
        money: 100000,
        baseWeeklyIncome: 2000,
        createdAt: Date.now(),
        upgrades: {},
        warehouse: { capacity: 10, items: {}, miners: {} },
      },
      {
        id: 'ai-1',
        type: 'ai',
        name: 'Test AI Company',
        level: 1,
        employees: 3,
        money: 50000,
        baseWeeklyIncome: 2000,
        createdAt: Date.now(),
        upgrades: {},
        warehouse: { capacity: 10, items: {}, miners: {} },
      },
      {
        id: 'restaurant-1',
        type: 'restaurant',
        name: 'Test Restaurant',
        level: 1,
        employees: 4,
        money: 75000,
        baseWeeklyIncome: 2000,
        createdAt: Date.now(),
        upgrades: {},
        warehouse: { capacity: 10, items: {}, miners: {} },
      },
    ],
    stats: {
      ...setupWealthyPlayer(500000).stats!,
    },
    educations: [
      {
        id: 'entrepreneurship',
        name: 'Entrepreneurship',
        description: 'Learn to start and run a business',
        cost: 30000,
        duration: 72,
        weeksRemaining: 0,
        completed: true,
        requirements: [],
        unlocks: ['company_creation'],
      },
    ],
  };
}

/**
 * Create senior citizen (age 65+)
 */
export function setupSenior(age: number = 65): Partial<GameState> {
  return {
    date: {
      year: 2025 + Math.floor(age - 18),
      month: 'January',
      week: 1,
      age,
    },
    weeksLived: Math.floor((age - 18) * 52),
  };
}

/**
 * Create player with large family
 */
export function setupLargeFamily(numChildren: number = 5): Partial<GameState> {
  const children = [];

  for (let i = 0; i < numChildren; i++) {
    children.push({
      id: `child-${i}`,
      name: `Child ${i + 1}`,
      type: 'child' as const,
      age: 5 + i,
      affection: 80,
      reliability: 75,
      history: [],
    });
  }

  return {
    social: {
      relations: [
        {
          id: 'spouse-1',
          name: 'Spouse',
          type: 'spouse' as const,
          age: 30,
          affection: 90,
          reliability: 85,
          history: [],
        },
        ...children,
      ],
    },
  };
}

/**
 * Create player with maxed stats
 */
export function setupMaxedStats(): Partial<GameState> {
  return {
    stats: {
      health: 100,
      happiness: 100,
      energy: 100,
      fitness: 100,
      money: 1000000,
      reputation: 100,
      gems: 1000,
    },
  };
}

/**
 * Create player with near-death stats
 */
export function setupNearDeath(): Partial<GameState> {
  return {
    stats: {
      health: 0,
      happiness: 0,
      energy: 10,
      fitness: 10,
      money: 100,
      reputation: 10,
      gems: 0,
    },
    healthZeroWeeks: 3,
    happinessZeroWeeks: 3,
  };
}
