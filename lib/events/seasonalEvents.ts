import type { GameState } from '@/contexts/GameContext';
import { WeeklyEvent, EventTemplate } from './engine';

export type Season = 'spring' | 'summer' | 'fall' | 'winter';
export type Holiday = 'valentines' | 'halloween' | 'christmas' | 'newyear' | null;

export interface SeasonalEventData {
  season: Season;
  holiday: Holiday;
  weekInSeason: number; // 0-12 (13 weeks per season)
}

/**
 * Calculate current season based on game week
 * 52 weeks = 1 year
 * Each season = 13 weeks
 */
export function getCurrentSeason(week: number): SeasonalEventData {
  const weekInYear = week % 52;
  const weekInSeason = weekInYear % 13;
  
  let season: Season;
  let holiday: Holiday = null;
  
  if (weekInYear < 13) {
    season = 'spring';
    // Valentine's Day around week 7-8 of spring
    if (weekInSeason >= 6 && weekInSeason <= 8) {
      holiday = 'valentines';
    }
  } else if (weekInYear < 26) {
    season = 'summer';
  } else if (weekInYear < 39) {
    season = 'fall';
    // Halloween around week 9-10 of fall
    if (weekInSeason >= 8 && weekInSeason <= 10) {
      holiday = 'halloween';
    }
  } else {
    season = 'winter';
    // Christmas around week 11-12 of winter
    if (weekInSeason >= 10 && weekInSeason <= 12) {
      holiday = 'christmas';
    }
    // New Year at week 0 of spring (but we check it here)
    if (weekInYear === 51 || weekInYear === 0) {
      holiday = 'newyear';
    }
  }
  
  return { season, holiday, weekInSeason };
}

/**
 * Check if a seasonal event should occur this week
 * Seasonal events occur 1-2 times per season (every 13 weeks)
 */
export function shouldTriggerSeasonalEvent(
  state: GameState,
  eventId: string
): boolean {
  const seasonalData = state.seasonalEvents || { lastSeason: '', completedEvents: [] };
  const currentSeason = getCurrentSeason(state.week);
  
  // Don't trigger if already completed this season
  if (seasonalData.completedEvents.includes(eventId)) {
    return false;
  }
  
  // Check if season changed (reset completed events)
  if (seasonalData.lastSeason !== currentSeason.season) {
    return true; // New season, can trigger events
  }
  
  // Random chance for seasonal events (higher chance early in season)
  const baseChance = 0.15; // 15% base chance
  const weekModifier = 1 - (currentSeason.weekInSeason / 13); // Higher chance early season
  const chance = baseChance * (1 + weekModifier);
  
  return Math.random() < chance;
}

// Spring Events
const springFestival: EventTemplate = {
  id: 'spring_festival',
  category: 'general',
  weight: 1.0,
  condition: (state) => {
    const season = getCurrentSeason(state.week);
    return season.season === 'spring' && shouldTriggerSeasonalEvent(state, 'spring_festival');
  },
  generate: () => ({
    id: 'spring_festival',
    description: 'Spring Festival is here! The city is blooming with flowers and celebrations.',
    choices: [
      {
        id: 'participate',
        text: 'Join the festival celebrations',
        effects: {
          stats: { happiness: 15, reputation: 5 },
          money: -30,
        },
      },
      {
        id: 'observe',
        text: 'Just observe from afar',
        effects: {
          stats: { happiness: 5 },
        },
      },
    ],
  }),
};

const gardenEvent: EventTemplate = {
  id: 'garden_event',
  category: 'health',
  weight: 0.8,
  condition: (state) => {
    const season = getCurrentSeason(state.week);
    return season.season === 'spring' && shouldTriggerSeasonalEvent(state, 'garden_event');
  },
  generate: () => ({
    id: 'garden_event',
    description: 'A community garden event offers free seeds and gardening tips.',
    choices: [
      {
        id: 'join',
        text: 'Join the gardening event',
        effects: {
          stats: { fitness: 8, happiness: 5, health: 5 },
          money: 50, // Small reward for participation
        },
      },
      {
        id: 'skip',
        text: 'Skip it',
        effects: {},
      },
    ],
  }),
};

// Summer Events
const beachParty: EventTemplate = {
  id: 'beach_party',
  category: 'general',
  weight: 1.0,
  condition: (state) => {
    const season = getCurrentSeason(state.week);
    return season.season === 'summer' && shouldTriggerSeasonalEvent(state, 'beach_party');
  },
  generate: () => ({
    id: 'beach_party',
    description: 'A massive beach party is happening this weekend!',
    choices: [
      {
        id: 'attend',
        text: 'Attend the beach party ($40)',
        effects: {
          stats: { happiness: 20, reputation: 10 },
          money: -40,
        },
      },
      {
        id: 'decline',
        text: 'Stay home',
        effects: {
          stats: { happiness: -5 },
        },
      },
    ],
  }),
};

const summerSale: EventTemplate = {
  id: 'summer_sale',
  category: 'economy',
  weight: 0.9,
  condition: (state) => {
    const season = getCurrentSeason(state.week);
    return season.season === 'summer' && shouldTriggerSeasonalEvent(state, 'summer_sale');
  },
  generate: () => ({
    id: 'summer_sale',
    description: 'Summer sales are everywhere! Great discounts on items and services.',
    choices: [
      {
        id: 'shop',
        text: 'Go shopping (items 20% off)',
        effects: {
          stats: { happiness: 10 },
          money: -100, // Shopping expense
        },
      },
      {
        id: 'save',
        text: 'Save your money',
        effects: {
          stats: { happiness: -3 },
        },
      },
    ],
  }),
};

// Fall Events
const harvestFestival: EventTemplate = {
  id: 'harvest_festival',
  category: 'economy',
  weight: 1.0,
  condition: (state) => {
    const season = getCurrentSeason(state.week);
    return season.season === 'fall' && shouldTriggerSeasonalEvent(state, 'harvest_festival');
  },
  generate: () => ({
    id: 'harvest_festival',
    description: 'The annual Harvest Festival brings food, music, and community together.',
    choices: [
      {
        id: 'participate',
        text: 'Participate in the festival',
        effects: {
          stats: { happiness: 12, health: 5 },
          money: 150, // Festival earnings/rewards
        },
      },
      {
        id: 'skip',
        text: 'Skip the festival',
        effects: {},
      },
    ],
  }),
};

const careerFair: EventTemplate = {
  id: 'career_fair',
  category: 'economy',
  weight: 0.8,
  condition: (state) => {
    const season = getCurrentSeason(state.week);
    return season.season === 'fall' && shouldTriggerSeasonalEvent(state, 'career_fair');
  },
  generate: () => ({
    id: 'career_fair',
    description: 'A career fair is happening downtown with job opportunities and education discounts.',
    choices: [
      {
        id: 'attend',
        text: 'Attend the career fair',
        effects: {
          stats: { reputation: 15, happiness: 8 },
          money: -25, // Travel/entry cost
        },
      },
      {
        id: 'skip',
        text: 'Not interested',
        effects: {},
      },
    ],
  }),
};

// Winter Events
const winterHolidays: EventTemplate = {
  id: 'winter_holidays',
  category: 'relationship',
  weight: 1.0,
  condition: (state) => {
    const season = getCurrentSeason(state.week);
    return season.season === 'winter' && shouldTriggerSeasonalEvent(state, 'winter_holidays');
  },
  generate: (state) => {
    const hasFamily = state.family?.children?.length > 0 || state.relationships.some(r => r.type === 'partner');
    return {
      id: 'winter_holidays',
      description: hasFamily 
        ? 'Winter holidays bring family together. Time for gifts and celebrations!'
        : 'Winter holidays are here. The city is decorated and festive.',
      choices: [
        {
          id: 'celebrate',
          text: hasFamily ? 'Celebrate with family ($200)' : 'Join holiday celebrations ($50)',
          effects: {
            stats: { happiness: hasFamily ? 20 : 15, reputation: 5 },
            money: hasFamily ? -200 : -50,
          },
        },
        {
          id: 'quiet',
          text: 'Have a quiet holiday',
          effects: {
            stats: { happiness: 5 },
          },
        },
      ],
    };
  },
};

const newYear: EventTemplate = {
  id: 'new_year',
  category: 'general',
  weight: 1.0,
  condition: (state) => {
    const season = getCurrentSeason(state.week);
    return season.holiday === 'newyear' && shouldTriggerSeasonalEvent(state, 'new_year');
  },
  generate: () => ({
    id: 'new_year',
    description: 'New Year celebrations! A fresh start with new opportunities.',
    choices: [
      {
        id: 'celebrate',
        text: 'Celebrate the New Year',
        effects: {
          stats: { happiness: 15, energy: 10 },
          money: -30,
        },
      },
      {
        id: 'reflect',
        text: 'Reflect on the past year',
        effects: {
          stats: { happiness: 10, reputation: 5 },
        },
      },
    ],
  }),
};

// Special Holiday Events
const valentinesDay: EventTemplate = {
  id: 'valentines_day',
  category: 'relationship',
  weight: 1.0,
  condition: (state) => {
    const season = getCurrentSeason(state.week);
    return season.holiday === 'valentines' && shouldTriggerSeasonalEvent(state, 'valentines_day');
  },
  generate: (state) => {
    const hasPartner = state.relationships.some(r => r.type === 'partner');
    return {
      id: 'valentines_day',
      description: hasPartner
        ? 'Valentine\'s Day! Time to show your love and appreciation.'
        : 'Valentine\'s Day is here. Love is in the air!',
      choices: hasPartner
        ? [
            {
              id: 'romantic',
              text: 'Plan a romantic evening ($150)',
              effects: {
                stats: { happiness: 20, reputation: 5 },
                money: -150,
                relationship: 15,
              },
            },
            {
              id: 'simple',
              text: 'Simple gesture ($50)',
              effects: {
                stats: { happiness: 10 },
                money: -50,
                relationship: 10,
              },
            },
          ]
        : [
            {
              id: 'social',
              text: 'Go out and socialize ($30)',
              effects: {
                stats: { happiness: 10, reputation: 5 },
                money: -30,
              },
            },
            {
              id: 'home',
              text: 'Stay home',
              effects: {
                stats: { happiness: -5 },
              },
            },
          ],
    };
  },
};

const halloween: EventTemplate = {
  id: 'halloween',
  category: 'general',
  weight: 1.0,
  condition: (state) => {
    const season = getCurrentSeason(state.week);
    return season.holiday === 'halloween' && shouldTriggerSeasonalEvent(state, 'halloween');
  },
  generate: () => ({
    id: 'halloween',
    description: 'Halloween! The city is filled with costumes, decorations, and spooky fun.',
    choices: [
      {
        id: 'party',
        text: 'Attend a Halloween party ($40)',
        effects: {
          stats: { happiness: 18, reputation: 8 },
          money: -40,
        },
      },
      {
        id: 'trickortreat',
        text: 'Go trick-or-treating (free)',
        effects: {
          stats: { happiness: 12 },
          money: 20, // Free candy = small money value
        },
      },
    ],
  }),
};

const christmas: EventTemplate = {
  id: 'christmas',
  category: 'relationship',
  weight: 1.0,
  condition: (state) => {
    const season = getCurrentSeason(state.week);
    return season.holiday === 'christmas' && shouldTriggerSeasonalEvent(state, 'christmas');
  },
  generate: (state) => {
    const hasFamily = state.family?.children?.length > 0 || state.relationships.some(r => r.type === 'partner');
    return {
      id: 'christmas',
      description: hasFamily
        ? 'Christmas! Time for family, gifts, and holiday cheer.'
        : 'Christmas is here! The city is beautifully decorated.',
      choices: [
        {
          id: 'celebrate',
          text: hasFamily ? 'Celebrate with family ($300)' : 'Join Christmas celebrations ($80)',
          effects: {
            stats: { happiness: hasFamily ? 25 : 18, reputation: 10 },
            money: hasFamily ? -300 : -80,
          },
        },
        {
          id: 'charity',
          text: 'Volunteer at charity ($50)',
          effects: {
            stats: { happiness: 15, reputation: 15 },
            money: -50,
          },
        },
      ],
    };
  },
};

export const seasonalEventTemplates: EventTemplate[] = [
  springFestival,
  gardenEvent,
  beachParty,
  summerSale,
  harvestFestival,
  careerFair,
  winterHolidays,
  newYear,
  valentinesDay,
  halloween,
  christmas,
];

/**
 * Get seasonal events for the current week
 */
export function getSeasonalEvents(state: GameState): WeeklyEvent[] {
  const events: WeeklyEvent[] = [];
  const currentSeason = getCurrentSeason(state.week);
  
  // Check each seasonal event template
  for (const template of seasonalEventTemplates) {
    if (template.condition && template.condition(state)) {
      events.push(template.generate(state));
      // Limit to 1 seasonal event per week (can stack with regular events)
      if (events.length >= 1) break;
    }
  }
  
  return events;
}

