import type { GameState } from '@/contexts/game/types';
// `import type` — both are interfaces. A plain value import here forms a runtime
// require cycle with engine.ts (engine imports getSeasonalEvents from this file),
// which can resolve to undefined in the production Hermes bundle.
import type { WeeklyEvent, EventTemplate } from './engine';
import { WEEKS_PER_YEAR } from '@/lib/config/gameConstants';

export type Season = 'spring' | 'summer' | 'fall' | 'winter';
export type Holiday = 'valentines' | 'easter' | 'independence' | 'halloween' | 'thanksgiving' | 'blackfriday' | 'christmas' | 'newyear' | null;

/** A season is 13 weeks; four of them make the 52-week game year. */
const WEEKS_PER_SEASON = 13;

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
  const weekInSeason = weekInYear % WEEKS_PER_SEASON;
  
  let season: Season;
  let holiday: Holiday = null;
  
  if (weekInYear < WEEKS_PER_SEASON) {
    season = 'spring';
    // Easter around week 4-5 of spring
    if (weekInSeason >= 3 && weekInSeason <= 5) {
      holiday = 'easter';
    }
    // Valentine's Day around week 7-8 of spring
    if (weekInSeason >= 6 && weekInSeason <= 8) {
      holiday = 'valentines';
    }
  } else if (weekInYear < WEEKS_PER_SEASON * 2) {
    season = 'summer';
    // Independence Day around week 1-2 of summer
    if (weekInSeason >= 0 && weekInSeason <= 2) {
      holiday = 'independence';
    }
  } else if (weekInYear < WEEKS_PER_SEASON * 3) {
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
 * Should a seasonal event fire this week?
 *
 * ## What was wrong
 *
 * This used to consult `state.seasonalEvents` — `{ lastSeason, completedEvents }`
 * — which is initialised to `{ lastSeason: '', completedEvents: [] }` and is
 * **never written by anything in the repo**. Two consequences, both shipped:
 *
 *   1. `completedEvents.includes(eventId)` was always false, so the
 *      "already happened this season" guard never fired and one event could
 *      repeat week after week.
 *   2. `lastSeason` was permanently `''`, so `lastSeason !== currentSeason`
 *      was always true and the function ALWAYS returned from the
 *      "season just changed" branch at a flat 4%. Everything below it — the
 *      0.4% base chance and the `weekInSeason` rarity curve — was unreachable
 *      code that had never executed once.
 *
 * ## Why this derives instead of storing
 *
 * The obvious repair is to start writing `seasonalEvents`. That needs the event
 * engine to report back which template was shown, threaded through the weekly
 * tick, and it leaves a record that can drift from reality if a tick runs twice
 * (React 19 StrictMode can double-invoke an updater — the `R10-2` dedupe on the
 * notification flush exists for exactly that reason).
 *
 * So this follows the Legacy Contracts (v33) precedent instead: derive the
 * answer from values the save already has and that only ever move forward.
 * `weeksLived` alone identifies the season AND the week within it, so for each
 * (event, season) pair we can deterministically decide *whether* the event
 * happens at all and, if so, *which single week* of the thirteen it lands on.
 *
 * That gives the property the stored version was reaching for and never
 * achieved — at most one firing per event per season — with no state, no
 * migration, no double-fire under a replayed tick, and correct behaviour on
 * every existing save from the first week it loads.
 */

/**
 * Chance that a given event happens AT ALL during a given season.
 *
 * The old code's stated intent was "1-2 times per season" across the whole
 * seasonal pool. Per-event this is deliberately low: with several templates per
 * season, a 22% per-event chance lands the pool near that intent without any
 * single event feeling scripted.
 */
const CHANCE_PER_SEASON = 0.22;

/** Deterministic [0,1) from an integer seed. Same primitive the old code used. */
function seededRandom(seed: number): number {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

/**
 * Stable integer identity for a string, so an event id can seed a roll without
 * a lookup table. Small and deterministic; collisions only mean two events
 * share a schedule, which is harmless.
 */
function hashId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i += 1) {
    h = (h * 31 + id.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

/** Absolute season index since birth — the unit a "once per season" rule needs. */
function seasonIndex(weeksLived: number): number {
  return Math.floor(Math.max(0, weeksLived) / WEEKS_PER_SEASON);
}

export function shouldTriggerSeasonalEvent(
  state: GameState,
  eventId: string
): boolean {
  const weeksLived = Math.max(0, Math.floor(state.weeksLived || 0));
  const current = getCurrentSeason(weeksLived);
  const index = seasonIndex(weeksLived);
  const key = hashId(eventId);

  // 1) Does this event happen at all this season? One roll per (event, season),
  //    so the answer is identical on every week of that season.
  const occurs = seededRandom(index * 7919 + key) < CHANCE_PER_SEASON;
  if (!occurs) return false;

  // 2) If it does, which single week does it land on? Biased toward the start
  //    of the season, preserving the "higher chance early in season" intent the
  //    unreachable branch used to express. Squaring pulls the distribution
  //    forward without ever excluding the later weeks.
  const roll = seededRandom(index * 104729 + key + 1);
  const targetWeek = Math.min(
    WEEKS_PER_SEASON - 1,
    Math.floor(roll * roll * WEEKS_PER_SEASON)
  );

  return current.weekInSeason === targetWeek;
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

