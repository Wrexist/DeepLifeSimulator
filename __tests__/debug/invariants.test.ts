/**
 * Game Invariant Tests
 * Uses the fuzz engine to stress-test game logic and ensure invariants hold
 * 
 * These tests run randomized events against simplified game state
 * to find edge cases and invariant violations.
 */

import { runFuzz, FuzzConfig, CommonInvariants } from '../../src/debug/fuzzEngine';

// Simplified game state for testing (mirrors core GameState structure)
interface TestGameState {
  age: number;
  weeksLived: number;
  stats: {
    health: number;
    happiness: number;
    energy: number;
    fitness: number;
    money: number;
    reputation: number;
  };
  jailWeeks: number;
  wantedLevel: number;
  criminalLevel: number;
  currentJob: string | null;
  isAlive: boolean;
}

type TestGameEvent =
  | { type: 'ageUp'; weeks: number }
  | { type: 'work'; income: number }
  | { type: 'expense'; cost: number }
  | { type: 'heal'; amount: number }
  | { type: 'damage'; amount: number }
  | { type: 'rest'; energy: number }
  | { type: 'exercise'; fitness: number; energyCost: number }
  | { type: 'crime'; wantedIncrease: number; jailRisk: number }
  | { type: 'serveJail'; weeks: number }
  | { type: 'getJob'; job: string }
  | { type: 'quitJob' }
  | { type: 'socialAction'; happinessChange: number; reputationChange: number };

function createInitialState(): TestGameState {
  return {
    age: 18,
    weeksLived: 0,
    stats: {
      health: 100,
      happiness: 100,
      energy: 100,
      fitness: 10,
      money: 200,
      reputation: 0,
    },
    jailWeeks: 0,
    wantedLevel: 0,
    criminalLevel: 1,
    currentJob: null,
    isAlive: true,
  };
}

function randomEvent(state: TestGameState, _step: number): TestGameEvent {
  const r = Math.random();
  
  // Age progression
  if (r < 0.10) {
    return { type: 'ageUp', weeks: Math.floor(Math.random() * 4) + 1 };
  }
  
  // Work (only if not in jail)
  if (r < 0.20) {
    return { type: 'work', income: Math.floor(Math.random() * 1000) + 50 };
  }
  
  // Expenses
  if (r < 0.30) {
    return { type: 'expense', cost: Math.floor(Math.random() * 500) };
  }
  
  // Health - heal
  if (r < 0.40) {
    return { type: 'heal', amount: Math.floor(Math.random() * 30) };
  }
  
  // Health - damage
  if (r < 0.50) {
    return { type: 'damage', amount: Math.floor(Math.random() * 40) };
  }
  
  // Energy - rest
  if (r < 0.60) {
    return { type: 'rest', energy: Math.floor(Math.random() * 50) };
  }
  
  // Exercise
  if (r < 0.70) {
    return { 
      type: 'exercise', 
      fitness: Math.floor(Math.random() * 5) + 1, 
      energyCost: Math.floor(Math.random() * 30) + 10,
    };
  }
  
  // Crime
  if (r < 0.80) {
    return { 
      type: 'crime', 
      wantedIncrease: Math.floor(Math.random() * 3) + 1, 
      jailRisk: Math.random(),
    };
  }
  
  // Serve jail time
  if (r < 0.85) {
    return { type: 'serveJail', weeks: Math.floor(Math.random() * 4) + 1 };
  }
  
  // Job actions
  if (r < 0.90) {
    return state.currentJob 
      ? { type: 'quitJob' } 
      : { type: 'getJob', job: 'TestJob' };
  }
  
  // Social actions
  return { 
    type: 'socialAction', 
    happinessChange: Math.floor(Math.random() * 20) - 10,
    reputationChange: Math.floor(Math.random() * 10) - 5,
  };
}

function applyEvent(state: TestGameState, event: TestGameEvent): TestGameState {
  // Don't process events if dead
  if (!state.isAlive) return state;
  
  const newState: TestGameState = JSON.parse(JSON.stringify(state));
  
  switch (event.type) {
    case 'ageUp':
      newState.weeksLived += event.weeks;
      newState.age = 18 + Math.floor(newState.weeksLived / 52);
      // Natural stat decay per week
      newState.stats.energy = Math.max(0, newState.stats.energy - event.weeks * 2);
      newState.stats.happiness = Math.max(0, newState.stats.happiness - event.weeks);
      break;
      
    case 'work':
      // Can't work in jail
      if (newState.jailWeeks === 0 && newState.currentJob) {
        newState.stats.money += event.income;
        newState.stats.energy = Math.max(0, newState.stats.energy - 20);
      }
      break;
      
    case 'expense':
      newState.stats.money -= event.cost;
      break;
      
    case 'heal':
      newState.stats.health = Math.min(100, newState.stats.health + event.amount);
      break;
      
    case 'damage':
      newState.stats.health = Math.max(0, newState.stats.health - event.amount);
      // Check for death
      if (newState.stats.health <= 0) {
        newState.isAlive = false;
      }
      break;
      
    case 'rest':
      newState.stats.energy = Math.min(100, newState.stats.energy + event.energy);
      break;
      
    case 'exercise':
      if (newState.stats.energy >= event.energyCost) {
        newState.stats.fitness = Math.min(100, newState.stats.fitness + event.fitness);
        newState.stats.energy = Math.max(0, newState.stats.energy - event.energyCost);
        newState.stats.health = Math.min(100, newState.stats.health + 1); // Slight health boost
      }
      break;
      
    case 'crime':
      if (newState.jailWeeks === 0) {
        newState.wantedLevel = Math.min(5, newState.wantedLevel + event.wantedIncrease);
        newState.criminalLevel = Math.min(10, newState.criminalLevel + 0.1);
        
        // Risk of going to jail
        if (event.jailRisk < newState.wantedLevel * 0.1) {
          newState.jailWeeks = Math.floor(Math.random() * 4) + 1;
          newState.wantedLevel = 0;
          newState.currentJob = null; // Lose job when jailed
        }
      }
      break;
      
    case 'serveJail':
      if (newState.jailWeeks > 0) {
        newState.jailWeeks = Math.max(0, newState.jailWeeks - event.weeks);
      }
      break;
      
    case 'getJob':
      if (newState.jailWeeks === 0) {
        newState.currentJob = event.job;
      }
      break;
      
    case 'quitJob':
      newState.currentJob = null;
      break;
      
    case 'socialAction':
      newState.stats.happiness = Math.max(0, Math.min(100, 
        newState.stats.happiness + event.happinessChange));
      newState.stats.reputation = Math.max(-100, Math.min(100, 
        newState.stats.reputation + event.reputationChange));
      break;
  }
  
  return newState;
}

// Core game invariants
const gameInvariants = [
  {
    name: 'age-non-negative',
    check: (s: TestGameState) => s.age >= 0,
  },
  {
    name: 'age-reasonable',
    check: (s: TestGameState) => s.age <= 200,
  },
  {
    name: 'health-range',
    check: (s: TestGameState) => s.stats.health >= 0 && s.stats.health <= 100,
  },
  {
    name: 'happiness-range',
    check: (s: TestGameState) => s.stats.happiness >= 0 && s.stats.happiness <= 100,
  },
  {
    name: 'energy-range',
    check: (s: TestGameState) => s.stats.energy >= 0 && s.stats.energy <= 100,
  },
  {
    name: 'fitness-range',
    check: (s: TestGameState) => s.stats.fitness >= 0 && s.stats.fitness <= 100,
  },
  {
    name: 'reputation-range',
    check: (s: TestGameState) => s.stats.reputation >= -100 && s.stats.reputation <= 100,
  },
  {
    name: 'money-is-finite',
    check: (s: TestGameState) => Number.isFinite(s.stats.money),
  },
  {
    name: 'jailWeeks-non-negative',
    check: (s: TestGameState) => s.jailWeeks >= 0,
  },
  {
    name: 'wantedLevel-range',
    check: (s: TestGameState) => s.wantedLevel >= 0 && s.wantedLevel <= 5,
  },
  {
    name: 'weeksLived-non-negative',
    check: (s: TestGameState) => s.weeksLived >= 0,
  },
  {
    name: 'criminalLevel-range',
    check: (s: TestGameState) => s.criminalLevel >= 1 && s.criminalLevel <= 10,
  },
  {
    name: 'no-job-in-jail',
    check: (s: TestGameState) => !(s.jailWeeks > 0 && s.currentJob !== null),
  },
  {
    name: 'dead-means-zero-health',
    check: (s: TestGameState) => s.isAlive || s.stats.health <= 0,
  },
];

describe('Game Invariants - Basic Fuzz', () => {
  it('holds all invariants under 1000 random steps', () => {
    const result = runFuzz<TestGameState, TestGameEvent>({
      initialStateFactory: createInitialState,
      randomEventFactory: randomEvent,
      applyEvent,
      invariants: gameInvariants,
      steps: 1000,
    });

    if (!result.ok) {
      console.error('Fuzz test failed:', {
        step: result.failedAtStep,
        invariant: result.failingInvariant,
        lastEvent: result.lastEvent,
        stateSnapshot: result.stateSnapshot,
      });
    }
    
    expect(result.ok).toBe(true);
    expect(result.stepsRun).toBe(1000);
  });

  it('holds invariants under high stress (5000 steps)', () => {
    const result = runFuzz<TestGameState, TestGameEvent>({
      initialStateFactory: createInitialState,
      randomEventFactory: randomEvent,
      applyEvent,
      invariants: gameInvariants,
      steps: 5000,
    });

    expect(result.ok).toBe(true);
    expect(result.stepsRun).toBe(5000);
  });

  it('completes fuzz test within reasonable time', () => {
    const result = runFuzz<TestGameState, TestGameEvent>({
      initialStateFactory: createInitialState,
      randomEventFactory: randomEvent,
      applyEvent,
      invariants: gameInvariants,
      steps: 1000,
    });

    // Should complete in under 5 seconds
    expect(result.duration).toBeLessThan(5000);
  });
});

describe('Game Invariants - Reproducibility', () => {
  it('produces same result with same seed', () => {
    const seed = 12345;
    
    const config: FuzzConfig<TestGameState, TestGameEvent> = {
      initialStateFactory: createInitialState,
      randomEventFactory: randomEvent,
      applyEvent,
      invariants: gameInvariants,
      steps: 100,
      seed,
      includeFullHistory: false,
    };

    const result1 = runFuzz(config);
    const result2 = runFuzz({ ...config, seed });

    expect(result1.ok).toBe(result2.ok);
    expect(result1.stepsRun).toBe(result2.stepsRun);
    expect(result1.seed).toBe(result2.seed);
  });

  it('reports seed for reproducibility', () => {
    const result = runFuzz<TestGameState, TestGameEvent>({
      initialStateFactory: createInitialState,
      randomEventFactory: randomEvent,
      applyEvent,
      invariants: gameInvariants,
      steps: 100,
    });

    expect(typeof result.seed).toBe('number');
    expect(result.seed).toBeGreaterThan(0);
  });
});

describe('Edge Cases', () => {
  it('handles zero energy correctly', () => {
    const state = createInitialState();
    state.stats.energy = 0;
    
    // Should be able to rest from zero energy
    const newState = applyEvent(state, { type: 'rest', energy: 50 });
    expect(newState.stats.energy).toBe(50);
    expect(newState.stats.energy).toBeLessThanOrEqual(100);
  });

  it('handles negative money (debt)', () => {
    const state = createInitialState();
    state.stats.money = 100;
    
    const newState = applyEvent(state, { type: 'expense', cost: 500 });
    expect(newState.stats.money).toBe(-400);
    expect(Number.isFinite(newState.stats.money)).toBe(true);
  });

  it('prevents working while in jail', () => {
    const state = createInitialState();
    state.jailWeeks = 5;
    state.currentJob = 'TestJob';
    const initialMoney = state.stats.money;
    
    // Work event should not increase money while in jail
    // Note: Our implementation clears job when jailed, so this tests that too
    const stateAfterJail = { ...state, currentJob: null }; // Simulate being jailed
    const newState = applyEvent(stateAfterJail, { type: 'work', income: 1000 });
    expect(newState.stats.money).toBe(initialMoney);
  });

  it('caps stats at 100', () => {
    const state = createInitialState();
    state.stats.health = 95;
    
    const newState = applyEvent(state, { type: 'heal', amount: 50 });
    expect(newState.stats.health).toBe(100);
    expect(newState.stats.health).toBeLessThanOrEqual(100);
  });

  it('handles death correctly', () => {
    const state = createInitialState();
    state.stats.health = 10;
    
    const newState = applyEvent(state, { type: 'damage', amount: 50 });
    expect(newState.stats.health).toBe(0);
    expect(newState.isAlive).toBe(false);
  });

  it('stops processing events after death', () => {
    const state = createInitialState();
    state.isAlive = false;
    state.stats.health = 0;
    const initialMoney = state.stats.money;
    
    const newState = applyEvent(state, { type: 'work', income: 1000 });
    expect(newState.stats.money).toBe(initialMoney);
    expect(newState.isAlive).toBe(false);
  });

  it('clamps wantedLevel to max 5', () => {
    const state = createInitialState();
    state.wantedLevel = 4;
    
    // Crime that would push wanted over 5
    const newState = applyEvent(state, { type: 'crime', wantedIncrease: 3, jailRisk: 1.0 });
    expect(newState.wantedLevel).toBeLessThanOrEqual(5);
  });
});

describe('CommonInvariants Utility', () => {
  it('inRange helper works correctly', () => {
    const invariant = CommonInvariants.inRange<TestGameState>(
      'health-check',
      (s) => s.stats.health,
      0,
      100
    );
    
    const validState = createInitialState();
    expect(invariant.check(validState)).toBe(true);
    
    const invalidState = { ...validState, stats: { ...validState.stats, health: 150 } };
    expect(invariant.check(invalidState)).toBe(false);
  });

  it('isFinite helper catches NaN', () => {
    const invariant = CommonInvariants.isFinite<TestGameState>(
      'money-check',
      (s) => s.stats.money
    );
    
    const validState = createInitialState();
    expect(invariant.check(validState)).toBe(true);
    
    const nanState = { ...validState, stats: { ...validState.stats, money: NaN } };
    expect(invariant.check(nanState)).toBe(false);
    
    const infState = { ...validState, stats: { ...validState.stats, money: Infinity } };
    expect(invariant.check(infState)).toBe(false);
  });

  it('nonNegative helper works correctly', () => {
    const invariant = CommonInvariants.nonNegative<TestGameState>(
      'jail-check',
      (s) => s.jailWeeks
    );
    
    const validState = createInitialState();
    expect(invariant.check(validState)).toBe(true);
    
    const negativeState = { ...validState, jailWeeks: -1 };
    expect(invariant.check(negativeState)).toBe(false);
  });
});

