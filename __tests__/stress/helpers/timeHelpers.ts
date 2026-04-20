import { GameState } from '@/contexts/GameContext';

/**
 * Advance game state by specified number of weeks
 * Mimics the nextWeek() logic from GameContext
 */
export function advanceWeeks(state: GameState, weeks: number): GameState {
  let newState = { ...state };

  for (let i = 0; i < weeks; i++) {
    // Calculate new age by adding 1/52 year per week
    const newAge = newState.date.age + (1 / 52);

    // Calculate month based on week number
    const totalWeeksLived = newState.weeksLived + 1;
    const yearWeek = totalWeeksLived % 52;
    const month = Math.floor(yearWeek / 4.33);
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

    newState = {
      ...newState,
      week: newState.week + 1,
      weeksLived: totalWeeksLived,
      date: {
        ...newState.date,
        week: ((newState.week) % 4) + 1,
        age: Number(newAge.toFixed(4)),
        month: monthNames[Math.min(month, 11)] || 'January',
        year: newState.date.year + Math.floor(totalWeeksLived / 52),
      },
      stats: {
        ...newState.stats,
        energy: Math.min(100, newState.stats.energy + 30),
        happiness: Math.max(0, newState.stats.happiness - 2),
      },
    };
  }

  return newState;
}

/**
 * Advance by years (52 weeks per year)
 */
export function advanceYears(state: GameState, years: number): GameState {
  return advanceWeeks(state, years * 52);
}

/**
 * Advance to specific target age
 */
export function advanceToAge(state: GameState, targetAge: number): GameState {
  const currentAge = state.date.age;
  const yearsToAdvance = targetAge - currentAge;

  if (yearsToAdvance <= 0) {
    return state;
  }

  return advanceYears(state, yearsToAdvance);
}

/**
 * Simulate a full week of basic survival activities
 * Helps keep stats stable during stress testing
 */
export function simulateWeekWithBasicCare(state: GameState): GameState {
  const newState = advanceWeeks(state, 1);

  // Boost stats to simulate basic self-care
  return {
    ...newState,
    stats: {
      ...newState.stats,
      health: Math.min(100, newState.stats.health + 5),
      energy: Math.min(100, newState.stats.energy + 20),
      happiness: Math.min(100, newState.stats.happiness + 10),
    },
  };
}
