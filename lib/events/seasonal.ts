import { GameState } from '@/contexts/GameContext';

export type Season = 'spring' | 'summer' | 'fall' | 'winter';
export type Holiday = 'newYear' | 'valentines' | 'easter' | 'halloween' | 'thanksgiving' | 'christmas';

/**
 * Helper function to normalize month to number
 * Handles both string and number month formats
 */
function getMonthNumber(month: string | number): number {
  if (typeof month === 'number') return month;
  const monthMap: Record<string, number> = {
    'January': 1, 'February': 2, 'March': 3, 'April': 4,
    'May': 5, 'June': 6, 'July': 7, 'August': 8,
    'September': 9, 'October': 10, 'November': 11, 'December': 12
  };
  return monthMap[month] || 1;
}

export interface SeasonalEvent {
  id: string;
  name: string;
  description: string;
  season: Season;
  holiday?: Holiday;
  startDate: { month: number; week: number };
  endDate: { month: number; week: number };
  rewards?: {
    money?: number;
    gems?: number;
    items?: string[];
    achievements?: string[];
  };
  specialActions?: string[];
  isActive: (gameState: GameState) => boolean;
}

/**
 * Get current season based on game date
 */
export function getCurrentSeason(gameState: GameState): Season {
  const month = getMonthNumber(gameState.date.month);
  
  // Assuming months are 1-12
  if (month >= 3 && month <= 5) return 'spring';
  if (month >= 6 && month <= 8) return 'summer';
  if (month >= 9 && month <= 11) return 'fall';
  return 'winter';
}

/**
 * Get current holiday based on game date
 */
export function getCurrentHoliday(gameState: GameState): Holiday | null {
  const month = getMonthNumber(gameState.date.month);
  const week = gameState.date.week;
  
  // New Year (January, weeks 1-2)
  if (month === 1 && week <= 2) return 'newYear';
  
  // Valentine's Day (February, week 2)
  if (month === 2 && week === 2) return 'valentines';
  
  // Easter (April, week 2-3)
  if (month === 4 && week >= 2 && week <= 3) return 'easter';
  
  // Halloween (October, week 4)
  if (month === 10 && week === 4) return 'halloween';
  
  // Thanksgiving (November, week 4)
  if (month === 11 && week === 4) return 'thanksgiving';
  
  // Christmas (December, weeks 3-4)
  if (month === 12 && week >= 3) return 'christmas';
  
  return null;
}

/**
 * Check if a seasonal event is currently active
 */
export function isSeasonalEventActive(event: SeasonalEvent, gameState: GameState): boolean {
  const currentMonth = getMonthNumber(gameState.date.month);
  const currentWeek = gameState.date.week;
  
  const { startDate, endDate } = event;
  
  // Check if current date is within event range
  if (currentMonth < startDate.month || currentMonth > endDate.month) {
    return false;
  }
  
  if (currentMonth === startDate.month && currentWeek < startDate.week) {
    return false;
  }
  
  if (currentMonth === endDate.month && currentWeek > endDate.week) {
    return false;
  }
  
  // Check custom isActive function if provided
  if (event.isActive) {
    return event.isActive(gameState);
  }
  
  return true;
}

/**
 * Get all active seasonal events
 */
export function getActiveSeasonalEvents(gameState: GameState): SeasonalEvent[] {
  return SEASONAL_EVENTS.filter(event => isSeasonalEventActive(event, gameState));
}

/**
 * Get seasonal event by ID
 */
export function getSeasonalEventById(id: string): SeasonalEvent | undefined {
  return SEASONAL_EVENTS.find(event => event.id === id);
}

/**
 * Get events for current season
 */
export function getSeasonalEvents(gameState: GameState): SeasonalEvent[] {
  const season = getCurrentSeason(gameState);
  return SEASONAL_EVENTS.filter(event => event.season === season);
}

/**
 * Predefined seasonal events
 */
export const SEASONAL_EVENTS: SeasonalEvent[] = [
  {
    id: 'new-year',
    name: 'New Year Celebration',
    description: 'Start the year with a fresh beginning! Special bonuses available.',
    season: 'winter',
    holiday: 'newYear',
    startDate: { month: 1, week: 1 },
    endDate: { month: 1, week: 2 },
    rewards: {
      money: 1000,
      gems: 50,
    },
    isActive: (gameState) => {
      const month = getMonthNumber(gameState.date.month);
      return month === 1 && gameState.date.week <= 2;
    },
  },
  {
    id: 'valentines',
    name: 'Valentine\'s Day',
    description: 'Spread love and happiness! Relationship bonuses available.',
    season: 'winter',
    holiday: 'valentines',
    startDate: { month: 2, week: 2 },
    endDate: { month: 2, week: 2 },
    rewards: {
      gems: 25,
    },
    specialActions: ['sendValentine', 'romanticDate'],
    isActive: (gameState) => {
      const month = getMonthNumber(gameState.date.month);
      return month === 2 && gameState.date.week === 2;
    },
  },
  {
    id: 'spring-festival',
    name: 'Spring Festival',
    description: 'Celebrate the arrival of spring with special activities!',
    season: 'spring',
    startDate: { month: 3, week: 1 },
    endDate: { month: 5, week: 4 },
    rewards: {
      money: 500,
    },
    isActive: (gameState) => {
      const month = getMonthNumber(gameState.date.month);
      return month >= 3 && month <= 5;
    },
  },
  {
    id: 'easter',
    name: 'Easter Celebration',
    description: 'Hunt for easter eggs and collect special rewards!',
    season: 'spring',
    holiday: 'easter',
    startDate: { month: 4, week: 2 },
    endDate: { month: 4, week: 3 },
    rewards: {
      gems: 30,
      items: ['easter_egg'],
    },
    specialActions: ['easterEggHunt'],
    isActive: (gameState) => {
      const month = getMonthNumber(gameState.date.month);
      return month === 4 && gameState.date.week >= 2 && gameState.date.week <= 3;
    },
  },
  {
    id: 'summer-sale',
    name: 'Summer Sale',
    description: 'Hot deals on items and services!',
    season: 'summer',
    startDate: { month: 6, week: 1 },
    endDate: { month: 8, week: 4 },
    rewards: {
      money: 750,
    },
    isActive: (gameState) => {
      const month = getMonthNumber(gameState.date.month);
      return month >= 6 && month <= 8;
    },
  },
  {
    id: 'halloween',
    name: 'Halloween',
    description: 'Trick or treat! Spooky events and special rewards await.',
    season: 'fall',
    holiday: 'halloween',
    startDate: { month: 10, week: 4 },
    endDate: { month: 10, week: 4 },
    rewards: {
      gems: 40,
      items: ['halloween_costume'],
    },
    specialActions: ['trickOrTreat', 'halloweenParty'],
    isActive: (gameState) => {
      const month = getMonthNumber(gameState.date.month);
      return month === 10 && gameState.date.week === 4;
    },
  },
  {
    id: 'thanksgiving',
    name: 'Thanksgiving',
    description: 'Give thanks and enjoy special bonuses!',
    season: 'fall',
    holiday: 'thanksgiving',
    startDate: { month: 11, week: 4 },
    endDate: { month: 11, week: 4 },
    rewards: {
      money: 1500,
      gems: 35,
    },
    isActive: (gameState) => {
      const month = getMonthNumber(gameState.date.month);
      return month === 11 && gameState.date.week === 4;
    },
  },
  {
    id: 'christmas',
    name: 'Christmas Celebration',
    description: 'The most wonderful time of the year! Special gifts and bonuses.',
    season: 'winter',
    holiday: 'christmas',
    startDate: { month: 12, week: 3 },
    endDate: { month: 12, week: 4 },
    rewards: {
      money: 2000,
      gems: 100,
      items: ['christmas_gift'],
    },
    specialActions: ['exchangeGifts', 'christmasParty'],
    isActive: (gameState) => {
      const month = getMonthNumber(gameState.date.month);
      return month === 12 && gameState.date.week >= 3;
    },
  },
];

