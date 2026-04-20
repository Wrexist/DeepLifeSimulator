import type { GameState } from '@/contexts/game/types';
import type { EventTemplate } from './engine';

/**
 * Economic event states that affect all players globally
 */
export type EconomicState = 'normal' | 'recession' | 'boom' | 'crash';

export interface EconomyEventData {
  currentState: EconomicState;
  stateStartWeek: number;
  stateDuration: number;
  modifiers: {
    incomeMultiplier: number;
    stockVolatility: number;
    jobAvailability: number;
  };
}

/**
 * Get current economic state from game state
 */
export function getCurrentEconomicState(state: GameState): EconomyEventData | null {
  return state.economy?.economyEvents || null;
}

/**
 * Check if an economic event should trigger
 * Economic events are rare and long-lasting (4-12 weeks)
 */
export function shouldTriggerEconomicEvent(state: GameState): boolean {
  const currentState: EconomyEventData | null = getCurrentEconomicState(state);
  const weeksLived = state.weeksLived || 0;
  
  // If already in an economic event, check if it should end
  if (currentState) {
    const weeksInState = weeksLived - currentState.stateStartWeek;
    if (weeksInState >= currentState.stateDuration) {
      // Event should end, transition back to normal
      return true;
    }
    return false; // Still in an active economic event
  }
  
  // No active event - check if a new one should start
  // Economic events are rare: ~2% chance per week when in normal state
  const baseChance = 0.02; // Was 5% — reduced to make economy calmer
  // Since currentState is null here, we use weeksLived as weeks since last event
  const weeksSinceLastEvent = weeksLived;

  // Higher chance if it's been a very long time since last event (at least 30 weeks)
  const timeModifier = weeksSinceLastEvent >= 30 ? 1.5 : 1.0;
  const chance = baseChance * timeModifier;
  
  // Use deterministic random based on week for consistency
  const seededRandom = (seed: number) => {
    const x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
  };
  const weekSeed = weeksLived * 1000 + (state.date?.year || 2025) * 100;
  
  return seededRandom(weekSeed + 5000) < chance;
}

/**
 * Generate a new economic event state
 */
export function generateEconomicEvent(state: GameState): EconomyEventData {
  const weeksLived = state.weeksLived || 0;
  const currentState = getCurrentEconomicState(state);
  
  // If transitioning from an event, go back to normal
  if (currentState && currentState.currentState !== 'normal') {
    return {
      currentState: 'normal',
      stateStartWeek: weeksLived,
      stateDuration: 8 + Math.floor(Math.random() * 8), // 8-16 weeks of normal
      modifiers: {
        incomeMultiplier: 1.0,
        stockVolatility: 1.0,
        jobAvailability: 1.0,
      },
    };
  }
  
  // Generate a new economic event
  // Use deterministic random for consistency
  const seededRandom = (seed: number) => {
    const x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
  };
  const weekSeed = weeksLived * 1000 + (state.date?.year || 2025) * 100;
  const eventRoll = seededRandom(weekSeed + 6000);
  
  let newState: EconomicState;
  let modifiers: EconomyEventData['modifiers'];
  let duration: number;
  
  if (eventRoll < 0.35) {
    // 35% chance: Recession
    newState = 'recession';
    modifiers = {
      incomeMultiplier: 0.85, // 15% income reduction
      stockVolatility: 1.5, // Higher volatility
      jobAvailability: 0.7, // 30% fewer jobs
    };
    duration = 6 + Math.floor(seededRandom(weekSeed + 7000) * 6); // 6-12 weeks
  } else if (eventRoll < 0.65) {
    // 30% chance: Economic Boom
    newState = 'boom';
    modifiers = {
      incomeMultiplier: 1.15, // 15% income boost
      stockVolatility: 0.8, // Lower volatility
      jobAvailability: 1.3, // 30% more jobs
    };
    duration = 4 + Math.floor(seededRandom(weekSeed + 8000) * 4); // 4-8 weeks
  } else if (eventRoll < 0.85) {
    // 20% chance: Market Crash
    newState = 'crash';
    modifiers = {
      incomeMultiplier: 0.9, // 10% income reduction
      stockVolatility: 2.5, // Very high volatility
      jobAvailability: 0.8, // 20% fewer jobs
    };
    duration = 3 + Math.floor(seededRandom(weekSeed + 9000) * 3); // 3-6 weeks
  } else {
    // 15% chance: Inflation Spike
    newState = 'normal'; // Treated as normal but with inflation
    modifiers = {
      incomeMultiplier: 0.95, // 5% income reduction
      stockVolatility: 1.2, // Slightly higher volatility
      jobAvailability: 1.0, // No change
    };
    duration = 4 + Math.floor(seededRandom(weekSeed + 10000) * 4); // 4-8 weeks
  }
  
  return {
    currentState: newState,
    stateStartWeek: weeksLived,
    stateDuration: duration,
    modifiers,
  };
}

/**
 * Economic Recession Event Template
 * Triggers when recession state begins
 */
export const economicRecession: EventTemplate = {
  id: 'economic_recession',
  category: 'economy',
  weight: 0,
  condition: (state: GameState) => {
    const econState = getCurrentEconomicState(state);
    const weeksLived = state.weeksLived || 0;
    // Trigger only in the first week of recession
    return econState?.currentState === 'recession' 
      && econState.stateStartWeek === weeksLived;
  },
  generate: (state: GameState) => {
    const econState = getCurrentEconomicState(state);
    const duration = econState?.stateDuration || 8;
    
    return {
      id: 'economic_recession',
      description: `An economic recession has begun! The economy is slowing down, affecting jobs, income, and investments. This will last approximately ${duration} weeks.`,
      choices: [
        {
          id: 'prepare',
          text: 'Prepare for tough times (save money, reduce expenses)',
          effects: {
            stats: { happiness: -5 },
            money: -50, // Emergency fund
          },
        },
        {
          id: 'invest',
          text: 'Invest during the downturn (risky but potentially rewarding)',
          effects: {
            money: -200,
            stats: { happiness: -10 },
          },
        },
        {
          id: 'continue',
          text: 'Continue as normal',
          effects: {},
        },
      ],
    };
  },
};

/**
 * Economic Boom Event Template
 * Triggers when boom state begins
 */
export const economicBoom: EventTemplate = {
  id: 'economic_boom',
  category: 'economy',
  weight: 0,
  condition: (state: GameState) => {
    const econState = getCurrentEconomicState(state);
    const weeksLived = state.weeksLived || 0;
    // Trigger only in the first week of boom
    return econState?.currentState === 'boom' 
      && econState.stateStartWeek === weeksLived;
  },
  generate: (state: GameState) => {
    const econState = getCurrentEconomicState(state);
    const duration = econState?.stateDuration || 6;
    
    return {
      id: 'economic_boom',
      description: `An economic boom is happening! The economy is thriving with increased job opportunities and higher incomes. This will last approximately ${duration} weeks.`,
      choices: [
        {
          id: 'invest',
          text: 'Invest in the booming economy',
          effects: {
            money: -300,
            stats: { happiness: 10, reputation: 5 },
          },
        },
        {
          id: 'job',
          text: 'Look for better job opportunities',
          effects: {
            stats: { happiness: 8, reputation: 10 },
          },
        },
        {
          id: 'enjoy',
          text: 'Enjoy the good times',
          effects: {
            stats: { happiness: 15 },
            money: 100, // Bonus income
          },
        },
      ],
    };
  },
};

/**
 * Market Crash Event Template
 * Triggers when crash state begins
 */
export const marketCrash: EventTemplate = {
  id: 'market_crash',
  category: 'economy',
  weight: 0,
  condition: (state: GameState) => {
    const econState = getCurrentEconomicState(state);
    const weeksLived = state.weeksLived || 0;
    // Trigger only in the first week of crash
    return econState?.currentState === 'crash' 
      && econState.stateStartWeek === weeksLived;
  },
  generate: (state: GameState) => {
    const econState = getCurrentEconomicState(state);
    const duration = econState?.stateDuration || 4;
    const hasStocks = state.stocks && state.stocks.holdings && state.stocks.holdings.length > 0;
    
    return {
      id: 'market_crash',
      description: `A major market crash has occurred! Stock prices are plummeting and the economy is in turmoil. This will last approximately ${duration} weeks.`,
      choices: [
        {
          id: 'buy_dip',
          text: 'Buy the dip (high risk, high reward)',
          effects: {
            money: -500,
            stats: { happiness: -15 },
          },
        },
        {
          id: 'sell',
          text: hasStocks ? 'Sell stocks to minimize losses' : 'Stay out of the market',
          effects: {
            stats: { happiness: -10 },
          },
        },
        {
          id: 'wait',
          text: 'Wait and see',
          effects: {
            stats: { happiness: -5 },
          },
        },
      ],
    };
  },
};

/**
 * Inflation Spike Event Template
 * Triggers when inflation state begins
 */
export const inflationSpike: EventTemplate = {
  id: 'inflation_spike',
  category: 'economy',
  weight: 0,
  condition: (state: GameState) => {
    const econState = getCurrentEconomicState(state);
    const weeksLived = state.weeksLived || 0;
    // Check if inflation is high (modifiers indicate inflation)
    return econState?.currentState === 'normal' 
      && econState.modifiers.incomeMultiplier < 1.0
      && econState.stateStartWeek === weeksLived;
  },
  generate: (state: GameState) => {
    const econState = getCurrentEconomicState(state);
    const duration = econState?.stateDuration || 6;
    
    return {
      id: 'inflation_spike',
      description: `Inflation is rising rapidly! Prices are going up faster than usual, reducing purchasing power. This will last approximately ${duration} weeks.`,
      choices: [
        {
          id: 'invest',
          text: 'Invest to beat inflation',
          effects: {
            money: -250,
            stats: { happiness: -5 },
          },
        },
        {
          id: 'save',
          text: 'Save more aggressively',
          effects: {
            money: -100,
            stats: { happiness: -3 },
          },
        },
        {
          id: 'adapt',
          text: 'Adapt spending habits',
          effects: {
            stats: { happiness: -2 },
          },
        },
      ],
    };
  },
};

/**
 * Economic Event End Notification
 * Triggers when an economic event transitions back to normal
 */
export const economicEventEnd: EventTemplate = {
  id: 'economic_event_end',
  category: 'economy',
  weight: 0,
  condition: (state: GameState) => {
    const econState = getCurrentEconomicState(state);
    const weeksLived = state.weeksLived || 0;
    // Trigger when transitioning from event to normal
    if (!econState || econState.currentState === 'normal') return false;
    const weeksInState = weeksLived - econState.stateStartWeek;
    
    // Only show end event if the event is ending this week (not already ended)
    // AND the event started recently enough that the player should have seen the start event
    // This prevents showing "event ended" for events that started before the player was playing
    const isEndingThisWeek = weeksInState === econState.stateDuration;
    const startedRecently = weeksInState <= econState.stateDuration + 1; // Started within duration + 1 week
    
    return isEndingThisWeek && startedRecently;
  },
  generate: (state: GameState) => {
    const econState = getCurrentEconomicState(state);
    const previousState = econState?.currentState || 'normal';
    
    return {
      id: 'economic_event_end',
      description: `The ${previousState === 'recession' ? 'recession' : previousState === 'boom' ? 'economic boom' : previousState === 'crash' ? 'market crash' : 'inflation spike'} has ended. The economy is returning to normal.`,
      choices: [
        {
          id: 'continue',
          text: 'Continue',
          effects: {
            stats: { happiness: 5 },
          },
        },
      ],
    };
  },
};

export const economyEventTemplates: EventTemplate[] = [
  economicRecession,
  economicBoom,
  marketCrash,
  inflationSpike,
  economicEventEnd,
];

