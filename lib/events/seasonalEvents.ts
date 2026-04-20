import type { GameState } from '@/contexts/GameContext';
import { WeeklyEvent, EventTemplate } from './engine';
import { WEEKS_PER_YEAR } from '@/lib/config/gameConstants';

export type Season = 'spring' | 'summer' | 'fall' | 'winter';
export type Holiday = 'valentines' | 'easter' | 'independence' | 'halloween' | 'thanksgiving' | 'blackfriday' | 'christmas' | 'newyear' | null;

export interface SeasonalEventData {
  season: Season;
  holiday: Holiday;
  weekInSeason: number; // 0-12 (13 weeks per season)
}

/**
 * Calculate current season based on weeks lived
 * WEEKS_PER_YEAR weeks = 1 year
 * Each season = 13 weeks
 * TIME PROGRESSION FIX: Use weeksLived instead of week (1-4) for seasonal calculations
 */
export function getCurrentSeason(weeksLived: number): SeasonalEventData {
  const weekInYear = weeksLived % WEEKS_PER_YEAR;
  const weekInSeason = weekInYear % 13;
  
  let season: Season;
  let holiday: Holiday = null;
  
  if (weekInYear < 13) {
    season = 'spring';
    // Easter around week 4-5 of spring
    if (weekInSeason >= 3 && weekInSeason <= 5) {
      holiday = 'easter';
    }
    // Valentine's Day around week 7-8 of spring
    if (weekInSeason >= 6 && weekInSeason <= 8) {
      holiday = 'valentines';
    }
  } else if (weekInYear < 26) {
    season = 'summer';
    // Independence Day around week 1-2 of summer
    if (weekInSeason >= 0 && weekInSeason <= 2) {
      holiday = 'independence';
    }
  } else if (weekInYear < 39) {
    season = 'fall';
    // Halloween around week 9-10 of fall
    if (weekInSeason >= 8 && weekInSeason <= 10) {
      holiday = 'halloween';
    }
    // Thanksgiving around week 10-11 of fall
    if (weekInSeason >= 9 && weekInSeason <= 11) {
      holiday = 'thanksgiving';
    }
    // Black Friday around week 11-12 of fall (right after Thanksgiving)
    if (weekInSeason >= 10 && weekInSeason <= 12) {
      holiday = 'blackfriday';
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
  // TIME PROGRESSION FIX: Use weeksLived instead of week (1-4) for seasonal calculations
  const currentSeason = getCurrentSeason(state.weeksLived || 0);
  
  // Don't trigger if already completed this season
  if (seasonalData.completedEvents.includes(eventId)) {
    return false;
  }
  
  // Check if season changed (reset completed events)
  if (seasonalData.lastSeason !== currentSeason.season) {
    // New season - give a low chance (not guaranteed)
    // Use deterministic random for consistency
    const seededRandom = (seed: number) => {
      const x = Math.sin(seed) * 10000;
      return x - Math.floor(x);
    };
    const weekSeed = (state.weeksLived || 0) * 1000 + (state.date?.year || 2025) * 100;
    const newSeasonChance = 0.04; // 4% chance at start of new season (reduced from 10%)
    return seededRandom(weekSeed + 2000) < newSeasonChance;
  }

  // Random chance for seasonal events (higher chance early in season)
  const baseChance = 0.004; // 0.4% base chance (was 1%) — seasonal events should be rare
  const weekModifier = 1 - (currentSeason.weekInSeason / 13); // Higher chance early season
  const chance = baseChance * (1 + weekModifier);
  
  // Use deterministic random for consistency
  const seededRandom = (seed: number) => {
    const x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
  };
  const weekSeed = (state.weeksLived || 0) * 1000 + (state.date?.year || 2025) * 100;
  
  return seededRandom(weekSeed + 3000) < chance;
}

// Spring Events
const springFestival: EventTemplate = {
  id: 'spring_festival',
  category: 'general',
  weight: 1.0,
  condition: (state) => {
    // TIME PROGRESSION FIX: Use weeksLived instead of week (1-4) for seasonal calculations
    const season = getCurrentSeason(state.weeksLived || 0);
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
    // TIME PROGRESSION FIX: Use weeksLived instead of week (1-4) for seasonal calculations
    const season = getCurrentSeason(state.weeksLived || 0);
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
    // TIME PROGRESSION FIX: Use weeksLived instead of week (1-4) for seasonal calculations
    const season = getCurrentSeason(state.weeksLived || 0);
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
    // TIME PROGRESSION FIX: Use weeksLived instead of week (1-4) for seasonal calculations
    const season = getCurrentSeason(state.weeksLived || 0);
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
    // TIME PROGRESSION FIX: Use weeksLived instead of week (1-4) for seasonal calculations
    const season = getCurrentSeason(state.weeksLived || 0);
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
    // TIME PROGRESSION FIX: Use weeksLived instead of week (1-4) for seasonal calculations
    const season = getCurrentSeason(state.weeksLived || 0);
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
    // TIME PROGRESSION FIX: Use weeksLived instead of week (1-4) for seasonal calculations
    const season = getCurrentSeason(state.weeksLived || 0);
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
    // TIME PROGRESSION FIX: Use weeksLived instead of week (1-4) for seasonal calculations
    const season = getCurrentSeason(state.weeksLived || 0);
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
    // TIME PROGRESSION FIX: Use weeksLived instead of week (1-4) for seasonal calculations
    const season = getCurrentSeason(state.weeksLived || 0);
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
    // TIME PROGRESSION FIX: Use weeksLived instead of week (1-4) for seasonal calculations
    const season = getCurrentSeason(state.weeksLived || 0);
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
    // TIME PROGRESSION FIX: Use weeksLived instead of week (1-4) for seasonal calculations
    const season = getCurrentSeason(state.weeksLived || 0);
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

// Additional Holiday Events
const easter: EventTemplate = {
  id: 'easter',
  category: 'general',
  weight: 1.0,
  condition: (state) => {
    const season = getCurrentSeason(state.weeksLived || 0);
    return season.holiday === 'easter' && shouldTriggerSeasonalEvent(state, 'easter');
  },
  generate: () => ({
    id: 'easter',
    description: 'Easter celebrations are happening! Spring is in full bloom.',
    choices: [
      {
        id: 'celebrate',
        text: 'Join Easter celebrations ($40)',
        effects: {
          stats: { happiness: 15, health: 5 },
          money: -40,
        },
      },
      {
        id: 'quiet',
        text: 'Have a quiet day',
        effects: {
          stats: { happiness: 5 },
        },
      },
    ],
  }),
};

const independenceDay: EventTemplate = {
  id: 'independence_day',
  category: 'general',
  weight: 1.0,
  condition: (state) => {
    const season = getCurrentSeason(state.weeksLived || 0);
    return season.holiday === 'independence' && shouldTriggerSeasonalEvent(state, 'independence_day');
  },
  generate: () => ({
    id: 'independence_day',
    description: 'Independence Day! Fireworks, barbecues, and celebrations everywhere.',
    choices: [
      {
        id: 'party',
        text: 'Attend a 4th of July party ($60)',
        effects: {
          stats: { happiness: 18, reputation: 5 },
          money: -60,
        },
      },
      {
        id: 'bbq',
        text: 'Host a barbecue ($80)',
        effects: {
          stats: { happiness: 20, reputation: 10 },
          money: -80,
        },
      },
      {
        id: 'watch',
        text: 'Watch fireworks (free)',
        effects: {
          stats: { happiness: 12 },
        },
      },
    ],
  }),
};

const thanksgiving: EventTemplate = {
  id: 'thanksgiving',
  category: 'relationship',
  weight: 1.0,
  condition: (state) => {
    const season = getCurrentSeason(state.weeksLived || 0);
    return season.holiday === 'thanksgiving' && shouldTriggerSeasonalEvent(state, 'thanksgiving');
  },
  generate: (state) => {
    const hasFamily = state.family?.children?.length > 0 || state.relationships.some(r => r.type === 'partner' || r.type === 'parent' || r.type === 'child');
    return {
      id: 'thanksgiving',
      description: hasFamily
        ? 'Thanksgiving! Time to gather with family and give thanks.'
        : 'Thanksgiving is here. A time for gratitude and reflection.',
      choices: [
        {
          id: 'feast',
          text: hasFamily ? 'Host Thanksgiving dinner ($150)' : 'Join a Thanksgiving meal ($50)',
          effects: {
            stats: { happiness: hasFamily ? 20 : 15, health: 5 },
            money: hasFamily ? -150 : -50,
          },
        },
        {
          id: 'volunteer',
          text: 'Volunteer at a soup kitchen ($30)',
          effects: {
            stats: { happiness: 15, reputation: 15 },
            money: -30,
          },
        },
        {
          id: 'quiet',
          text: 'Have a quiet Thanksgiving',
          effects: {
            stats: { happiness: 8 },
          },
        },
      ],
    };
  },
};

const blackFriday: EventTemplate = {
  id: 'black_friday',
  category: 'economy',
  weight: 1.0,
  condition: (state) => {
    const season = getCurrentSeason(state.weeksLived || 0);
    return season.holiday === 'blackfriday' && shouldTriggerSeasonalEvent(state, 'black_friday');
  },
  generate: () => ({
    id: 'black_friday',
    description: 'Black Friday sales are here! Massive discounts on everything.',
    choices: [
      {
        id: 'shop',
        text: 'Go shopping (30% off everything, $200)',
        effects: {
          stats: { happiness: 12 },
          money: -200,
        },
      },
      {
        id: 'big',
        text: 'Big shopping spree (40% off, $500)',
        effects: {
          stats: { happiness: 18 },
          money: -500,
        },
      },
      {
        id: 'skip',
        text: 'Skip the sales',
        effects: {
          stats: { happiness: -3 },
        },
      },
    ],
  }),
};

// Additional Cultural Events
const springConcert: EventTemplate = {
  id: 'spring_concert',
  category: 'general',
  weight: 0.7,
  condition: (state) => {
    const season = getCurrentSeason(state.weeksLived || 0);
    return season.season === 'spring' && season.weekInSeason >= 4 && season.weekInSeason <= 8 && shouldTriggerSeasonalEvent(state, 'spring_concert');
  },
  generate: () => ({
    id: 'spring_concert',
    description: 'A spring music festival is happening in the city park.',
    choices: [
      {
        id: 'attend',
        text: 'Attend the concert ($50)',
        effects: {
          stats: { happiness: 15, reputation: 5 },
          money: -50,
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

const summerFestival: EventTemplate = {
  id: 'summer_festival',
  category: 'general',
  weight: 0.8,
  condition: (state) => {
    const season = getCurrentSeason(state.weeksLived || 0);
    return season.season === 'summer' && season.weekInSeason >= 5 && season.weekInSeason <= 9 && shouldTriggerSeasonalEvent(state, 'summer_festival');
  },
  generate: () => ({
    id: 'summer_festival',
    description: 'The annual summer festival is in full swing with food, music, and activities.',
    choices: [
      {
        id: 'participate',
        text: 'Join the festival ($60)',
        effects: {
          stats: { happiness: 18, health: 5 },
          money: -60,
        },
      },
      {
        id: 'observe',
        text: 'Just observe',
        effects: {
          stats: { happiness: 8 },
        },
      },
    ],
  }),
};

const fallHarvest: EventTemplate = {
  id: 'fall_harvest',
  category: 'economy',
  weight: 0.6,
  condition: (state) => {
    const season = getCurrentSeason(state.weeksLived || 0);
    return season.season === 'fall' && season.weekInSeason >= 2 && season.weekInSeason <= 6 && shouldTriggerSeasonalEvent(state, 'fall_harvest');
  },
  generate: () => ({
    id: 'fall_harvest',
    description: 'Harvest season brings opportunities to earn extra money from seasonal work.',
    choices: [
      {
        id: 'work',
        text: 'Take seasonal work',
        effects: {
          stats: { happiness: 5, fitness: 5 },
          money: 300,
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

const winterSports: EventTemplate = {
  id: 'winter_sports',
  category: 'health',
  weight: 0.7,
  condition: (state) => {
    const season = getCurrentSeason(state.weeksLived || 0);
    return season.season === 'winter' && season.weekInSeason >= 3 && season.weekInSeason <= 7 && shouldTriggerSeasonalEvent(state, 'winter_sports');
  },
  generate: () => ({
    id: 'winter_sports',
    description: 'Winter sports season is here! Skiing, ice skating, and snow activities are available.',
    choices: [
      {
        id: 'participate',
        text: 'Join winter sports ($80)',
        effects: {
          stats: { happiness: 15, fitness: 10, health: 5 },
          money: -80,
        },
      },
      {
        id: 'skip',
        text: 'Stay warm inside',
        effects: {
          stats: { happiness: 3 },
        },
      },
    ],
  }),
};

export const seasonalEventTemplates: EventTemplate[] = [
  springFestival,
  gardenEvent,
  springConcert,
  easter,
  beachParty,
  summerSale,
  summerFestival,
  independenceDay,
  harvestFestival,
  careerFair,
  fallHarvest,
  halloween,
  thanksgiving,
  blackFriday,
  winterHolidays,
  winterSports,
  christmas,
  newYear,
  valentinesDay,
];

/**
 * Get seasonal events for the current week
 */
export function getSeasonalEvents(state: GameState): WeeklyEvent[] {
  const events: WeeklyEvent[] = [];
  // TIME PROGRESSION FIX: Use weeksLived instead of week (1-4) for seasonal calculations
  const _currentSeason = getCurrentSeason(state.weeksLived || 0);
  
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

