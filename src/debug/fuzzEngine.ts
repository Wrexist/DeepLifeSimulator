/**
 * Fuzz Testing Engine
 * Generic fuzzer to stress-test game logic and find invariant violations
 * 
 * This engine runs randomized events against game state and checks
 * that invariants hold after each step. Useful for finding edge cases
 * and state corruption bugs.
 */

export interface FuzzConfig<State, Event> {
  /** Factory to create initial state */
  initialStateFactory: () => State;
  
  /** Factory to generate random events based on current state and step number */
  randomEventFactory: (state: State, step: number) => Event;
  
  /** Apply an event to state and return new state (must be pure/immutable) */
  applyEvent: (state: State, event: Event) => State;
  
  /** Invariants that must hold after every step */
  invariants: Array<{
    name: string;
    check: (state: State) => boolean;
  }>;
  
  /** Number of steps to run */
  steps: number;
  
  /** Optional seed for reproducibility */
  seed?: number;
  
  /** Whether to include full history (can be memory-intensive) */
  includeFullHistory?: boolean;
  
  /** Optional callback after each step (for progress tracking) */
  onStep?: (step: number, state: State, event: Event) => void;
  
  /** Optional callback on invariant failure */
  onInvariantFailed?: (invariantName: string, state: State, event: Event, step: number) => void;
}

export interface FuzzResult<State = unknown, Event = unknown> {
  /** Whether all invariants held for all steps */
  ok: boolean;
  
  /** Number of steps actually run */
  stepsRun: number;
  
  /** Step number where failure occurred (if any) */
  failedAtStep?: number;
  
  /** Name of the invariant that failed (if any) */
  failingInvariant?: string;
  
  /** State snapshot at failure (if any) */
  stateSnapshot?: State;
  
  /** The event that caused the failure (if any) */
  lastEvent?: Event;
  
  /** History of steps (if includeFullHistory was true, or last 10 on failure) */
  history: Array<{
    step: number;
    event: Event;
    stateAfter?: State;
  }>;
  
  /** Total duration in milliseconds */
  duration: number;
  
  /** Seed used for this run (for reproducibility) */
  seed: number;
}

/**
 * Simple seeded pseudo-random number generator
 * Uses Linear Congruential Generator algorithm for reproducibility
 */
class SeededRandom {
  private seed: number;
  
  constructor(seed: number) {
    // Ensure seed is a positive integer
    this.seed = Math.abs(Math.floor(seed)) || 1;
  }
  
  /**
   * Get next random number between 0 and 1
   */
  next(): number {
    // LCG parameters (same as glibc)
    this.seed = (this.seed * 1103515245 + 12345) & 0x7fffffff;
    return this.seed / 0x7fffffff;
  }
  
  /**
   * Get next random integer from 0 to max-1
   */
  nextInt(max: number): number {
    return Math.floor(this.next() * max);
  }
  
  /**
   * Get next random integer in range [min, max]
   */
  nextIntRange(min: number, max: number): number {
    return min + this.nextInt(max - min + 1);
  }
  
  /**
   * Get next random boolean
   */
  nextBool(): boolean {
    return this.next() < 0.5;
  }
  
  /**
   * Pick a random element from an array
   */
  pick<T>(array: T[]): T {
    return array[this.nextInt(array.length)];
  }
}

/**
 * Run fuzz testing with the given configuration
 */
export function runFuzz<State, Event>(
  config: FuzzConfig<State, Event>
): FuzzResult<State, Event> {
  const startTime = Date.now();
  const seed = config.seed ?? Date.now();
  // Note: SeededRandom is created but the randomEventFactory should use Math.random
  // If you want reproducible tests, inject the seeded random into your factory
  
  let state = config.initialStateFactory();
  const history: FuzzResult<State, Event>['history'] = [];
  
  for (let i = 0; i < config.steps; i++) {
    const event = config.randomEventFactory(state, i);
    
    // Record history entry
    const historyEntry: typeof history[number] = {
      step: i,
      event,
    };
    
    // Apply event with error handling
    try {
      state = config.applyEvent(state, event);
    } catch (error) {
      // Exception during event application
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      return {
        ok: false,
        stepsRun: i + 1,
        failedAtStep: i,
        failingInvariant: `Exception during applyEvent: ${errorMessage}`,
        stateSnapshot: state,
        lastEvent: event,
        history: config.includeFullHistory ? history : history.slice(-10),
        duration: Date.now() - startTime,
        seed,
      };
    }
    
    // Store state if tracking full history
    if (config.includeFullHistory) {
      try {
        historyEntry.stateAfter = JSON.parse(JSON.stringify(state));
      } catch {
        // State not serializable, skip
      }
    }
    history.push(historyEntry);
    
    // Check all invariants
    for (const inv of config.invariants) {
      let passed = false;
      try {
        passed = inv.check(state);
      } catch (error) {
        // Exception during invariant check
        const errorMessage = error instanceof Error ? error.message : String(error);
        
        config.onInvariantFailed?.(inv.name, state, event, i);
        
        return {
          ok: false,
          stepsRun: i + 1,
          failedAtStep: i,
          failingInvariant: `${inv.name} (threw: ${errorMessage})`,
          stateSnapshot: state,
          lastEvent: event,
          history: config.includeFullHistory ? history : history.slice(-10),
          duration: Date.now() - startTime,
          seed,
        };
      }
      
      if (!passed) {
        config.onInvariantFailed?.(inv.name, state, event, i);
        
        return {
          ok: false,
          stepsRun: i + 1,
          failedAtStep: i,
          failingInvariant: inv.name,
          stateSnapshot: state,
          lastEvent: event,
          history: config.includeFullHistory ? history : history.slice(-10),
          duration: Date.now() - startTime,
          seed,
        };
      }
    }
    
    // Call step callback if provided
    config.onStep?.(i, state, event);
  }
  
  // All steps passed
  return {
    ok: true,
    stepsRun: config.steps,
    history: config.includeFullHistory ? history : [],
    duration: Date.now() - startTime,
    seed,
  };
}

/**
 * Utility function to create a fuzz config with sensible defaults
 */
export function createGameFuzzConfig<State, Event>(
  partial: Partial<FuzzConfig<State, Event>> & 
    Pick<FuzzConfig<State, Event>, 'initialStateFactory' | 'randomEventFactory' | 'applyEvent'>
): FuzzConfig<State, Event> {
  return {
    invariants: [],
    steps: 1000,
    includeFullHistory: false,
    ...partial,
  };
}

/**
 * Export SeededRandom for use in test factories
 */
export { SeededRandom };

/**
 * Common invariant factories for game-like states
 */
export const CommonInvariants = {
  /**
   * Check that a numeric field is within a range
   */
  inRange<S>(
    name: string,
    getter: (state: S) => number,
    min: number,
    max: number
  ): { name: string; check: (state: S) => boolean } {
    return {
      name,
      check: (state: S) => {
        const value = getter(state);
        return typeof value === 'number' && !isNaN(value) && value >= min && value <= max;
      },
    };
  },
  
  /**
   * Check that a numeric field is finite (not NaN or Infinity)
   */
  isFinite<S>(
    name: string,
    getter: (state: S) => number
  ): { name: string; check: (state: S) => boolean } {
    return {
      name,
      check: (state: S) => {
        const value = getter(state);
        return typeof value === 'number' && Number.isFinite(value);
      },
    };
  },
  
  /**
   * Check that a numeric field is non-negative
   */
  nonNegative<S>(
    name: string,
    getter: (state: S) => number
  ): { name: string; check: (state: S) => boolean } {
    return {
      name,
      check: (state: S) => {
        const value = getter(state);
        return typeof value === 'number' && value >= 0;
      },
    };
  },
  
  /**
   * Check that a field is an array
   */
  isArray<S>(
    name: string,
    getter: (state: S) => unknown
  ): { name: string; check: (state: S) => boolean } {
    return {
      name,
      check: (state: S) => Array.isArray(getter(state)),
    };
  },
  
  /**
   * Check that a field is defined (not null/undefined)
   */
  isDefined<S>(
    name: string,
    getter: (state: S) => unknown
  ): { name: string; check: (state: S) => boolean } {
    return {
      name,
      check: (state: S) => getter(state) != null,
    };
  },
};

