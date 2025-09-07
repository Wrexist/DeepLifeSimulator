import { GameState, Career } from '@/contexts/GameContext';

// Mock career data
const mockCareer: Career = {
  id: 'software_engineer',
  levels: [
    { name: 'Junior Developer', salary: 800 },
    { name: 'Senior Developer', salary: 1200 },
    { name: 'Lead Developer', salary: 1800 },
  ],
  level: 0,
  description: 'Build software and climb the corporate ladder',
  requirements: {
    fitness: 30,
    education: ['computer_science'],
  },
  progress: 0,
  applied: false,
  accepted: false,
};

function createGameState(overrides: Partial<GameState> = {}): GameState {
  return {
    stats: { health: 50, happiness: 50, energy: 50, fitness: 50, money: 1000, reputation: 50, gems: 0 },
    day: 1,
    week: 1,
    date: { year: 2025, month: 'January', week: 1, age: 18 },
    totalHappiness: 50,
    weeksLived: 0,
    streetJobs: [],
    careers: [mockCareer],
    hobbies: [],
    items: [],
    darkWebItems: [],
    hacks: [],
    relationships: [],
    social: { relations: [] },
    hasPhone: false,
    foods: [],
    healthActivities: [],
    dietPlans: [],
    educations: [],
    companies: [],
    userProfile: { name: 'Test', handle: 'test', bio: '', followers: 0, following: 0, gender: 'male', seekingGender: 'female' },
    currentJob: undefined,
    showWelcomePopup: true,
    settings: { darkMode: false, soundEnabled: true, notificationsEnabled: true, autoSave: true, language: 'English', maxStats: false },
    cryptos: [],
    diseases: [],
    realEstate: [],
    family: { children: [] },
    lifeStage: 'adult',
    wantedLevel: 0,
    jailWeeks: 0,
    escapedFromJail: false,
    jailActivities: [],
    criminalXp: 0,
    criminalLevel: 1,
    crimeSkills: {
      stealth: { xp: 0, level: 1 },
      hacking: { xp: 0, level: 1 },
      lockpicking: { xp: 0, level: 1 },
    },
    pets: [],
    bankSavings: 0,
    stocksOwned: {},
    perks: {},
    achievements: [],
    claimedProgressAchievements: [],
    lastLogin: Date.now(),
    streetJobsCompleted: 0,
    happinessZeroWeeks: 0,
    healthZeroWeeks: 0,
    showZeroStatPopup: false,
    zeroStatType: undefined,
    showDeathPopup: false,
    deathReason: undefined,
    economy: { inflationRateAnnual: 0.03, priceIndex: 1 },
    version: 5,
    pendingEvents: [],
    eventLog: [],
    progress: { achievements: [] },
    journal: [],
    ...overrides,
  } as GameState;
}

describe('Career Logic', () => {
  describe('Career Requirements', () => {
    it('should check if player meets fitness requirements', () => {
      const state = createGameState({
        stats: { health: 50, happiness: 50, energy: 50, fitness: 35, money: 1000, reputation: 50, gems: 0 },
      });
      
      const career = state.careers[0];
      const meetsFitness = state.stats.fitness >= (career.requirements.fitness || 0);
      
      expect(meetsFitness).toBe(true);
    });

    it('should check if player meets education requirements', () => {
      const state = createGameState({
        educations: [{ id: 'computer_science', name: 'Computer Science', description: 'Computer Science degree', cost: 5000, duration: 12, completed: true, weeksRemaining: 0 }],
      });
      
      const career = state.careers[0];
      const requiredEducation = career.requirements.education || [];
      const hasRequiredEducation = requiredEducation.every(eduId => 
        state.educations.some(edu => edu.id === eduId && edu.completed)
      );
      
      expect(hasRequiredEducation).toBe(true);
    });

    it('should fail when player does not meet requirements', () => {
      const state = createGameState({
        stats: { health: 50, happiness: 50, energy: 50, fitness: 20, money: 1000, reputation: 50, gems: 0 },
        educations: [],
      });
      
      const career = state.careers[0];
      const meetsFitness = state.stats.fitness >= (career.requirements.fitness || 0);
      const requiredEducation = career.requirements.education || [];
      const hasRequiredEducation = requiredEducation.every(eduId => 
        state.educations.some(edu => edu.id === eduId && edu.completed)
      );
      
      expect(meetsFitness).toBe(false);
      expect(hasRequiredEducation).toBe(false);
    });
  });

  describe('Career Progression', () => {
    it('should calculate correct salary for current level', () => {
      const career = mockCareer;
      const currentSalary = career.levels[career.level].salary;
      
      expect(currentSalary).toBe(800);
    });

    it('should allow promotion to next level', () => {
      const career = { ...mockCareer, level: 0 };
      const canPromote = career.level < career.levels.length - 1;
      
      expect(canPromote).toBe(true);
    });

    it('should prevent promotion at max level', () => {
      const career = { ...mockCareer, level: 2 };
      const canPromote = career.level < career.levels.length - 1;
      
      expect(canPromote).toBe(false);
    });
  });

  describe('Career Application', () => {
    it('should allow application when requirements are met', () => {
      const state = createGameState({
        stats: { health: 50, happiness: 50, energy: 50, fitness: 35, money: 1000, reputation: 50, gems: 0 },
        educations: [{ id: 'computer_science', name: 'Computer Science', description: 'Computer Science degree', cost: 5000, duration: 12, completed: true, weeksRemaining: 0 }],
      });
      
      const career = state.careers[0];
      const meetsRequirements = 
        state.stats.fitness >= (career.requirements.fitness || 0) &&
        (career.requirements.education || []).every(eduId => 
          state.educations.some(edu => edu.id === eduId && edu.completed)
        );
      
      expect(meetsRequirements).toBe(true);
    });

    it('should prevent application when requirements are not met', () => {
      const state = createGameState({
        stats: { health: 50, happiness: 50, energy: 50, fitness: 20, money: 1000, reputation: 50, gems: 0 },
        educations: [],
      });
      
      const career = state.careers[0];
      const meetsRequirements = 
        state.stats.fitness >= (career.requirements.fitness || 0) &&
        (career.requirements.education || []).every(eduId => 
          state.educations.some(edu => edu.id === eduId && edu.completed)
        );
      
      expect(meetsRequirements).toBe(false);
    });
  });
});
