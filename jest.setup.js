// Jest setup file for global test configuration

// Mock performance API for performance tests
global.performance = {
  now: () => Date.now(),
  mark: jest.fn(),
  measure: jest.fn(),
  clearMarks: jest.fn(),
  clearMeasures: jest.fn(),
  getEntriesByType: jest.fn(() => []),
  getEntriesByName: jest.fn(() => []),
  getEntries: jest.fn(() => []),
  memory: {
    usedJSHeapSize: 1000000,
    totalJSHeapSize: 2000000,
    jsHeapSizeLimit: 4000000,
  },
};

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  warn: jest.fn(),
  error: jest.fn(),
  log: jest.fn(),
};

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(() => Promise.resolve()),
  getItem: jest.fn(() => Promise.resolve(null)),
  removeItem: jest.fn(() => Promise.resolve()),
  clear: jest.fn(() => Promise.resolve()),
  getAllKeys: jest.fn(() => Promise.resolve([])),
  multiGet: jest.fn(() => Promise.resolve([])),
  multiSet: jest.fn(() => Promise.resolve()),
  multiRemove: jest.fn(() => Promise.resolve()),
}));

// Mock Expo modules
jest.mock('expo-router', () => ({
  useRouter: jest.fn(() => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    canGoBack: jest.fn(() => true),
  })),
  useLocalSearchParams: jest.fn(() => ({})),
}));

jest.mock('expo-linear-gradient', () => 'LinearGradient');

jest.mock('expo-notifications', () => ({
  scheduleNotificationAsync: jest.fn(() => Promise.resolve('id')),
  cancelScheduledNotificationAsync: jest.fn(() => Promise.resolve()),
  getPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted' })),
  requestPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted' })),
}));

// Mock React Native components
jest.mock('react-native', () => {
  const RN = jest.requireActual('react-native');
  return {
    ...RN,
    Animated: {
      ...RN.Animated,
      timing: jest.fn(() => ({
        start: jest.fn(),
        stop: jest.fn(),
      })),
      Value: jest.fn(() => ({
        setValue: jest.fn(),
        addListener: jest.fn(),
        removeListener: jest.fn(),
      })),
    },
  };
});

// Mock Moti
jest.mock('moti', () => ({
  View: 'View',
  Text: 'Text',
  AnimatePresence: ({ children }) => children,
}));

// Mock Lucide React Native
jest.mock('lucide-react-native', () => ({
  ArrowLeft: 'ArrowLeft',
  ArrowRight: 'ArrowRight',
  ChevronLeft: 'ChevronLeft',
  ChevronRight: 'ChevronRight',
  X: 'X',
  HelpCircle: 'HelpCircle',
  Play: 'Play',
  XCircle: 'XCircle',
  User: 'User',
  Users: 'Users',
  Dice1: 'Dice1',
  // Add other icons as needed
}));

// Global test utilities
global.createTestGameState = (overrides = {}) => ({
  stats: { health: 50, happiness: 50, energy: 50, fitness: 50, money: 1000, reputation: 50, gems: 0 },
  day: 1,
  week: 1,
  date: { year: 2025, month: 'January', week: 1, age: 18 },
  totalHappiness: 50,
  weeksLived: 0,
  streetJobs: [],
  careers: [],
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
});

// Test timeout
jest.setTimeout(10000);
