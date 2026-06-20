import { shouldTriggerEconomicEvent } from '../economyEvents';
import { createTestGameState } from '@/__tests__/helpers/createTestGameState';
import type { GameState } from '@/contexts/game/types';

/**
 * The macro-economy banner (recession/boom/crash) is driven by
 * `economy.economyEvents`. It previously cycled perpetually: the post-event
 * "normal" stretch was a timed state that GUARANTEED a fresh event on expiry,
 * so the banner was on screen 30-45% of the time. These lock in the calmer
 * behavior — events are rare, with an enforced quiet stretch afterwards.
 */
function stateWithEconomy(
  econ: GameState['economy']['economyEvents'],
  weeksLived: number,
): GameState {
  const base = createTestGameState({ weeksLived });
  return {
    ...base,
    economy: { ...base.economy, economyEvents: econ },
  };
}

describe('shouldTriggerEconomicEvent', () => {
  it('does NOT force a new event when a calm "normal" period elapses', () => {
    // A normal state whose nominal duration is long past. Pre-fix this returned
    // true every single week (perpetual cycle). Post-fix it falls back to the
    // rare ~1% roll, so across a long span it almost never fires.
    let triggers = 0;
    const runs = 200;
    for (let i = 0; i < runs; i++) {
      const weeksLived = 300 + i;
      const normal = {
        currentState: 'normal' as const,
        // Ended 100 weeks ago — well past any duration AND the calm cooldown.
        stateStartWeek: weeksLived - 100,
        stateDuration: 10,
        modifiers: { incomeMultiplier: 1, stockVolatility: 1, jobAvailability: 1 },
      };
      if (shouldTriggerEconomicEvent(stateWithEconomy(normal, weeksLived))) {
        triggers++;
      }
    }
    // Rare, not perpetual: nowhere near the old ~100% rate.
    expect(triggers / runs).toBeLessThan(0.1);
  });

  it('enforces a quiet stretch right after an event ends', () => {
    // 5 weeks since the event ended is inside the 20-week calm window.
    const weeksLived = 150;
    const justEnded = {
      currentState: 'normal' as const,
      stateStartWeek: weeksLived - 5,
      stateDuration: 12,
      modifiers: { incomeMultiplier: 1, stockVolatility: 1, jobAvailability: 1 },
    };
    expect(shouldTriggerEconomicEvent(stateWithEconomy(justEnded, weeksLived))).toBe(false);
  });

  it('ends an ACTIVE event exactly when its duration elapses', () => {
    const weeksLived = 120;
    const recession = {
      currentState: 'recession' as const,
      stateStartWeek: weeksLived - 8,
      stateDuration: 8,
      modifiers: { incomeMultiplier: 0.85, stockVolatility: 1.5, jobAvailability: 0.7 },
    };
    // Duration reached → transition back to normal.
    expect(shouldTriggerEconomicEvent(stateWithEconomy(recession, weeksLived))).toBe(true);

    // One week earlier the event is still running.
    const stillRunning = { ...recession, stateStartWeek: weeksLived - 7 };
    expect(shouldTriggerEconomicEvent(stateWithEconomy(stillRunning, weeksLived))).toBe(false);
  });
});
