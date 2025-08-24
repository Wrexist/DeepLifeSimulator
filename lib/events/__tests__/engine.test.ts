import { rollWeeklyEvents, eventTemplates } from '../engine';
import { GameState } from '@/contexts/GameContext';

function createState(overrides: Partial<GameState>): GameState {
  return {
    stats: { health: 40, happiness: 40, energy: 40, fitness: 0, money: 50, reputation: 0, goldBars: 0 },
    day: 1,
    week: 1,
    date: { year: 2025, month: 'January', week: 1, age: 18 },
    totalHappiness: 0,
    weeksLived: 0,
    streetJobs: [],
    careers: [],
    hobbies: [],
    items: [],
    darkWebItems: [],
    hacks: [],
    relationships: [{ id: 'f1', name: 'Alex', type: 'friend', relationshipScore: 20, personality: '', gender: 'male', age: 20 }],
    hasPhone: false,
    foods: [],
    healthActivities: [],
    dietPlans: [],
    educations: [],
    companies: [],
    userProfile: { name: '', handle: '', bio: '', followers: 0, following: 0, gender: 'male', seekingGender: 'female' },
    currentJob: undefined,
    showWelcomePopup: true,
    settings: { darkMode: false, soundEnabled: true, notificationsEnabled: true, autoSave: true, language: 'English', maxStats: false },
    cryptos: [],
    diseases: [],
    realEstate: [],
    social: { relations: [] },
    economy: { inflationRateAnnual: 0.03, priceIndex: 1 },
    version: 5,
    bankSavings: 0,
    stocksOwned: {},
    perks: {},
    dailySummary: undefined,
    achievements: [],
    claimedProgressAchievements: [],
    lastLogin: Date.now(),
    streetJobsCompleted: 0,
    happinessZeroWeeks: 0,
    healthZeroWeeks: 0,
    pendingEvents: [],
    eventLog: [],
    progress: { achievements: [] },
    journal: [],
    ...overrides,
  } as GameState;
}

describe('events engine', () => {
  it('provides at least twelve event templates', () => {
    expect(eventTemplates.length).toBeGreaterThanOrEqual(12);
  });

  it('generates events based on state risk', () => {
    const spy = jest.spyOn(Math, 'random').mockReturnValue(0);
    const events = rollWeeklyEvents(createState({}));
    spy.mockRestore();
    expect(events.length).toBeGreaterThan(0);
    expect(events[0].choices.length).toBeGreaterThan(0);
  });

  it('limits events to at most two per week', () => {
    const spy = jest.spyOn(Math, 'random').mockReturnValue(0);
    const events = rollWeeklyEvents(createState({}));
    spy.mockRestore();
    expect(events.length).toBeLessThanOrEqual(2);
  });
});

