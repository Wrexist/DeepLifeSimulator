import 'react-native-get-random-values';
import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { calcWeeklyPassiveIncome } from '@/lib/economy/passiveIncome';
import { applyWeeklyInflation, getInflatedPrice } from '@/lib/economy/inflation';
import { simulateWeek } from '@/lib/economy/stockMarket';
import {
  Relation,
  RelationAction,
  SocialState,
  processWeeklyRelations,
} from '@/lib/social/relations';
import * as companyLogic from './game/company';
import * as socialLogic from './game/social';
import { rollWeeklyEvents, WeeklyEvent } from '@/lib/events/engine';
import { evaluateAchievements, netWorth } from '@/lib/progress/achievements';
import { v4 as uuidv4 } from 'uuid';
import { showAchievementToast } from '@/components/anim/AchievementToast';
import { scheduleDailyReminder, cancelDailyReminder, notifyAchievementUnlock } from '@/utils/notifications';
import { uploadGameState, downloadGameState, uploadLeaderboardScore } from '@/lib/progress/cloud';

/* ---------- Types ---------- */

export interface GameStats {
  health: number;
  happiness: number;
  energy: number;
  fitness: number;
  money: number;
  reputation: number;
  gems: number;
}

export interface GameDate {
  year: number;
  month: string;
  week: number;
  age: number;
}

export type LifeStage = 'child' | 'teen' | 'adult' | 'senior';

export interface FamilyState {
  spouse?: Relationship;
  children: Relationship[];
}

export interface Pet {
  id: string;
  name: string;
  type: string;
  age: number;
  hunger: number;
  happiness: number;
  health: number;
}

const getLifeStage = (age: number): LifeStage => {
  if (age < 13) return 'child';
  if (age < 20) return 'teen';
  if (age < 65) return 'adult';
  return 'senior';
};

const addWeekToAge = (age: number): number => {
  const weeks = Math.round(age * 52);
  return (weeks + 1) / 52;
};

export type CrimeSkillId = 'stealth' | 'hacking' | 'lockpicking';

export interface CrimeSkill {
  xp: number;
  level: number;
  upgrades?: string[];
}

export interface StreetJob {
  id: string;
  name: string;
  description: string;
  energyCost: number;
  baseSuccessRate: number;
  basePayment: number;
  rank: number;
  progress: number;
  requirements?: string[];
  criminalLevelReq?: number;
  darkWebRequirements?: string[];
  skill?: CrimeSkillId;
  risks?: string[];
  illegal?: boolean;
  wantedIncrease?: number;
  jailWeeks?: number;
}

export interface JailActivity {
  id: string;
  name: string;
  description: string;
  energyCost: number;
  payment?: number;
  sentenceReduction?: number;
  fitnessGain?: number;
  healthGain?: number;
  happinessGain?: number;
  reputationGain?: number;
  skillGain?: string;
  successRate?: number;
  failurePenalty?: number;
  cost?: number;
  requiresEducation?: string;
  requiresWeeks?: number;
  criminalXpGain?: number;
  risk?: string;
}

export interface Career {
  id: string;
  levels: { name: string; salary: number }[];
  level: number;
  description: string;
  requirements: {
    fitness?: number;
    items?: string[];
    education?: string[];
  };
  progress: number;
  applied: boolean;
  accepted: boolean;
}

export interface Hobby {
  id: string;
  name: string;
  description: string;
  energyCost: number;
  skill: number;
  skillLevel: number;
  tournamentReward: number;
  songs?: Song[];
  artworks?: Artwork[];
  contracts?: Contract[];
  sponsors?: Sponsor[];
  maxSponsors?: number;
  team?: string;
  divisions?: Division[];
  league?: League;
  upgrades: HobbyUpgrade[];
}

export interface HobbyUpgrade {
  id: string;
  name: string;
  description: string;
  cost: number;
  level: number;
  maxLevel: number;
  skillBonusPerLevel?: number;
  incomeBonusPerLevel?: number;
  rewardBonusPerLevel?: number;
  slotIncreasePerLevel?: number;
}

export interface Song {
  id: string;
  grade: 'Terrible Song' | 'Bad Song' | 'Normal' | 'Good' | 'Great' | 'Incredible';
  weeklyIncome: number;
}

export interface Artwork {
  id: string;
  grade: 'Terrible Art' | 'Bad Art' | 'Normal' | 'Good' | 'Great' | 'Incredible';
  weeklyIncome: number;
}

export interface Contract {
  id: string;
  team: string;
  matchPay: number;
  weeksRemaining: number;
  totalWeeks: number;
  division: number;
  goal: number;
}

export interface Sponsor {
  id: string;
  name: string;
  weeklyPay: number;
  weeksRemaining: number;
}

export interface TeamInfo {
  name: string;
  goal: number;
}

export interface Division {
  name: string;
  teams: TeamInfo[];
}

export interface TeamStanding {
  team: string;
  points: number;
  played: number;
}

export interface League {
  division: number;
  standings: TeamStanding[];
  matchesPlayed: number;
}

export interface Item {
  id: string;
  name: string;
  price: number;
  description?: string;
  owned: boolean;
  dailyBonus?: Partial<GameStats>;
}

export interface DarkWebItem {
  id: string;
  name: string;
  costBtc: number;
  description?: string;
  owned: boolean;
  riskReduction?: number;
  rewardBonus?: number;
}

export interface HackResult {
  caught: boolean;
  reward: number;
  btcReward: number;
  risk: number;
  jailed?: boolean;
}


export interface Hack {
  id: string;
  name: string;
  description: string;
  costBtc: number;
  risk: number;
  reward: number;
  purchased: boolean;
  energyCost: number;
}

export interface Food {
  id: string;
  name: string;
  price: number;
  healthRestore: number;
  energyRestore: number;
}

export interface HealthActivity {
  id: string;
  name: string;
  description: string;
  price: number;
  happinessGain: number;
  healthGain?: number;
  energyCost?: number;
}

export interface DietPlan {
  id: string;
  name: string;
  description: string;
  dailyCost: number;
  healthGain: number;
  energyGain: number;
  happinessGain?: number;
  active: boolean;
}

export interface Relationship {
  id: string;
  name: string;
  type: 'parent' | 'friend' | 'partner' | 'spouse' | 'child';
  relationshipScore: number;
  income?: number;
  personality: string;
  gender: 'male' | 'female';
  lastMoneyRequest?: number;
  lastCall?: number;
  livingTogether?: boolean;
  age: number;
  profilePicture?: string;
  actions?: { [action: string]: number };
  familyHappiness?: number;
  expenses?: number;
  weeksAtZero?: number;
}

export interface Education {
  id: string;
  name: string;
  description: string;
  cost: number;
  duration: number; // in weeks
  completed: boolean;
  weeksRemaining?: number;
}

export interface CompanyUpgrade {
  id: string;
  name: string;
  description: string;
  cost: number;
  weeklyIncomeBonus: number;
  level: number;
  maxLevel: number;
}

export interface Company {
  id: string;
  name: string;
  type: 'factory' | 'ai' | 'restaurant' | 'realestate' | 'bank';
  weeklyIncome: number;
  baseWeeklyIncome: number;
  upgrades: CompanyUpgrade[];
  employees: number;
  workerSalary: number;
  workerMultiplier: number;
  marketingLevel: number;
  selectedCrypto?: string;
  miners: Record<string, number>;
  electricalBill?: {
    monthlyAmount: number;
    dueWeek: number;
    paid: boolean;
  };
}

export interface Crypto {
  id: string;
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  owned: number;
}

export interface UserProfile {
  name: string;
  handle: string;
  bio: string;
  followers: number;
  following: number;
  gender: 'male' | 'female';
  seekingGender: 'male' | 'female';
  posts?: number;
  firstName?: string;
  lastName?: string;
  sex?: 'male' | 'female';
  sexuality?: 'straight' | 'gay' | 'bi';
}

export interface GameSettings {
  darkMode: boolean;
  soundEnabled: boolean;
  notificationsEnabled: boolean;
  autoSave: boolean;
  language: string;
  maxStats: boolean;
}

export interface Disease {
  id: string;
  name: string;
  severity: 'mild' | 'serious' | 'critical';
  effects: Partial<GameStats>;
  curable: boolean;
  treatmentRequired?: boolean;
  weeksUntilDeath?: number;
}

export interface RealEstate {
  id: string;
  name: string;
  price: number;
  weeklyHappiness: number;
  weeklyEnergy: number;
  owned: boolean;
  interior: string[];
  upgradeLevel: number;
  rent?: number;
  upkeep?: number;
}

export interface Achievement {
  id: string;
  name: string;
  description: string;
  category:
    | 'money'
    | 'career'
    | 'education'
    | 'relationships'
    | 'health'
    | 'items'
    | 'special'
    | 'secret';
  completed: boolean;
  reward?: number;
}

export interface AchievementProgress {
  id: string;
  name: string;
  desc: string;
  unlockedAt?: number;
}

export interface JournalEntry {
  id: string;
  atWeek: number;
  title: string;
  details: string;
  tags: string[];
}

export interface GameProgress {
  achievements: AchievementProgress[];
}

export interface EconomyState {
  inflationRateAnnual: number;
  priceIndex: number;
}

export interface GameState {
  stats: GameStats;
  totalHappiness: number;
  weeksLived: number;
  day: number;
  week: number;
  date: GameDate;
  streetJobs: StreetJob[];
  jailActivities: JailActivity[];
  careers: Career[];
  hobbies: Hobby[];
  items: Item[];
  darkWebItems: DarkWebItem[];
  hacks: Hack[];
  relationships: Relationship[];
  pets: Pet[];
  hasPhone: boolean;
  foods: Food[];
  healthActivities: HealthActivity[];
  dietPlans: DietPlan[];
  educations: Education[];
  companies: Company[];
  company?: Company;
  userProfile: UserProfile;
  currentJob?: string;
  showWelcomePopup: boolean;
  settings: GameSettings;
  cryptos: Crypto[];
  diseases: Disease[];
  realEstate: RealEstate[];
  social: SocialState;
  economy: EconomyState;
  family: FamilyState;
  lifeStage: LifeStage;
  wantedLevel: number;
  jailWeeks: number;
  escapedFromJail: boolean;
  criminalXp: number;
  criminalLevel: number;
  crimeSkills: Record<CrimeSkillId, CrimeSkill>;
  version: number;
  progress: GameProgress;
  journal: JournalEntry[];
  scenarioId?: string;
  bankSavings?: number;
  stocksOwned?: { [key: string]: number };
  stocks?: {
    holdings: Array<{
      symbol: string;
      shares: number;
      averagePrice: number;
      currentPrice: number;
    }>;
    watchlist: string[];
  };
  perks?: {
    workBoost?: boolean;
    mindset?: boolean;
    fastLearner?: boolean;
    goodCredit?: boolean;
    unlockAllPerks?: boolean;
  };
  dailySummary?: {
    moneyChange: number;
    statsChange: Partial<GameStats>;
    events: string[];
  };
  pendingEvents: WeeklyEvent[];
  eventLog: {
    id: string;
    description: string;
    choice: string;
    week: number;
    year: number;
  }[];
  achievements: Achievement[];
  claimedProgressAchievements: string[];
  lastLogin: number;
  updatedAt?: number;
  streetJobsCompleted: number;
  happinessZeroWeeks: number;
  healthZeroWeeks: number;
  showZeroStatPopup: boolean;
  zeroStatType?: 'happiness' | 'health';
  showDeathPopup: boolean;
  deathReason?: 'happiness' | 'health';
}

interface GameContextType {
  gameState: GameState;
  setGameState: React.Dispatch<React.SetStateAction<GameState>>;
  updateStats: (newStats: Partial<GameStats>) => void;
  nextWeek: () => void;
  resolveEvent: (eventId: string, choiceId: string) => void;
  performStreetJob: (
    jobId: string
  ) =>
    | {
        success: boolean;
        message: string;
        events?: string[];
      }
    | void;
  gainCriminalXp: (amount: number) => void;
  gainCrimeSkillXp: (skillId: CrimeSkillId, amount: number) => void;
  unlockCrimeSkillUpgrade: (
    skillId: CrimeSkillId,
    upgradeId: string,
    cost: number,
    levelReq: number
  ) => void;
  applyForJob: (jobId: string) => void;
  quitJob: () => void;
  trainHobby: (
    hobbyId: string
  ) => { success: boolean; message: string } | void;
  enterHobbyTournament: (
    hobbyId: string
  ) => { success: boolean; message: string } | void;
  uploadSong: (
    hobbyId: string
  ) => { success: boolean; message: string } | void;
  uploadArtwork: (
    hobbyId: string
  ) => { success: boolean; message: string } | void;
  playMatch: (
    hobbyId: string
  ) => { success: boolean; message: string } | void;
  acceptContract: (
    hobbyId: string,
    contract: Contract
  ) => { success: boolean; message: string } | void;
  extendContract: (
    hobbyId: string
  ) => { success: boolean; message: string } | void;
  cancelContract: (hobbyId: string) => void;
  buyHobbyUpgrade: (hobbyId: string, upgradeId: string) => void;
  dive: (hobbyId: string) => { success: boolean; message: string } | void;
  buyItem: (itemId: string) => void;
  sellItem: (itemId: string) => void;
  buyDarkWebItem: (itemId: string) => void;
  buyHack: (hackId: string) => void;
  performHack: (hackId: string) => HackResult;
  performJailActivity: (
    activityId: string
  ) => { success: boolean; message: string };
  serveJailTime: () => { events: string[]; statsChange: Partial<GameStats> };
  payBail: () => { success: boolean; message: string };
  updateRelationship: (relationshipId: string, change: number) => void;
  addRelationship: (relationship: Relationship) => void;
  addSocialRelation: (relation: Relation) => void;
  interactRelation: (
    relationId: string,
    action: RelationAction
  ) => { success: boolean; message: string };
  breakUpWithPartner: (partnerId: string) => { success: boolean; message: string };
  proposeToPartner: (partnerId: string) => { success: boolean; message: string };
  moveInTogether: (partnerId: string) => { success: boolean; message: string };
  haveChild: (partnerId: string) => { success: boolean; message: string };
  adoptPet: (type: string) => void;
  feedPet: (petId: string) => void;
  playWithPet: (petId: string) => void;
  dismissWelcomePopup: () => void;
  buyFood: (foodId: string) => void;
  performHealthActivity: (activityId: string) => { message: string } | void;
  toggleDietPlan: (planId: string) => void;
  askForMoney: (relationshipId: string) => { success: boolean; message: string } | void;
  startEducation: (educationId: string) => void;
  createCompany: (companyType: string) => { success: boolean; message?: string; companyId?: string };
  buyCompanyUpgrade: (upgradeId: string, companyId?: string) => void;
  addWorker: (companyId?: string) => void;
  removeWorker: (companyId?: string) => void;
  updateUserProfile: (profile: Partial<UserProfile>) => void;
  updateSettings: (settings: Partial<GameSettings>) => void;
  callRelationship: (relationshipId: string) => { success: boolean; message: string };
  buyCrypto: (cryptoId: string, amount: number) => void;
  sellCrypto: (cryptoId: string, amount: number) => void;
  swapCrypto: (fromId: string, toId: string, amount: number) => void;
  buyPerk: (perkId: string) => void;
  buyStarterPack: (packId: string) => void;
  buyGoldPack: (packId: string) => void;
  buyGoldUpgrade: (upgradeId: string) => void;
  buyMiner: (minerId: string, companyId?: string) => void;
  selectMiningCrypto: (cryptoId: string, companyId?: string) => void;
  saveGame: () => Promise<void>;
  loadGame: (slot?: number) => Promise<void>;
  currentSlot: number;
  restartGame: () => Promise<void>;
  reviveCharacter: () => void;
  dismissStatWarning: () => void;
  checkAchievements: (state?: GameState) => void;
  recordRelationshipAction: (relationshipId: string, action: string) => void;
  claimProgressAchievement: (id: string, gold: number) => void;
  completeMinigame: (hobbyId: string, score: number) => void;
}

/* ---------- Context ---------- */

const GameContext = createContext<GameContextType | undefined>(undefined);

/* ---------- Initial State ---------- */

const STATE_VERSION = 8;

const initialGameState: GameState = {
  version: STATE_VERSION,
  stats: {
    health: 100,
    happiness: 100,
    energy: 100,
    fitness: 10,
    money: 0,
    reputation: 0,
    gems: 0,
  },
  totalHappiness: 0,
  weeksLived: 0,
  wantedLevel: 0,
  jailWeeks: 0,
  escapedFromJail: false,
  criminalXp: 0,
  criminalLevel: 1,
  crimeSkills: {
    stealth: { xp: 0, level: 1, upgrades: [] },
    hacking: { xp: 0, level: 1, upgrades: [] },
    lockpicking: { xp: 0, level: 1, upgrades: [] },
  },
  week: 1,
  date: { year: 2025, month: 'January', week: 1, age: 18 },
  streetJobs: [
    {
      id: 'beg',
      name: 'Beg for Money',
      description: '30% chance to get money, small chance to be robbed',
      energyCost: 20,
      baseSuccessRate: 30,
      basePayment: 25,
      rank: 1,
      progress: 0,
      risks: ['robbery'],
    },
    {
      id: 'dumpster',
      name: 'Dumpster Dive',
      description: '20% chance for money, rare chance for items',
      energyCost: 15,
      baseSuccessRate: 20,
      basePayment: 30,
      rank: 1,
      progress: 0,
    },
    {
      id: 'guitar',
      name: 'Play Guitar',
      description: '70% stable income, requires guitar',
      energyCost: 25,
      baseSuccessRate: 70,
      basePayment: 40,
      rank: 1,
      progress: 0,
      requirements: ['guitar'],
    },
    {
      id: 'delivery',
      name: 'Delivery Cycle',
      description: '90% success rate, requires bike',
      energyCost: 30,
      baseSuccessRate: 90,
      basePayment: 45,
      rank: 1,
      progress: 0,
      requirements: ['bike'],
    },
    {
      id: 'scam',
      name: 'Scam Someone',
      description: 'High risk, high reward. Better with phone/computer',
      energyCost: 25,
      baseSuccessRate: 40,
      basePayment: 45,
      rank: 1,
      progress: 0,
      skill: 'hacking',
      risks: ['police'],
      illegal: true,
      wantedIncrease: 2,
      jailWeeks: 2,
    },
    {
      id: 'shoplift',
      name: 'Shoplift',
      description: 'Steal small items from stores. Requires Lockpick from Onion shop.',
      energyCost: 20,
      baseSuccessRate: 80,
      basePayment: 50,
      rank: 1,
      progress: 0,
      skill: 'stealth',
      illegal: true,
      criminalLevelReq: 1,
      darkWebRequirements: ['lockpick'],
      wantedIncrease: 1,
      jailWeeks: 1,
    },
    {
      id: 'car_theft',
      name: 'Car Theft',
      description: 'Steal a car for profit. Requires Lockpick and Slim Jim from Onion shop.',
      energyCost: 40,
      baseSuccessRate: 50,
      basePayment: 500,
      rank: 1,
      progress: 0,
      skill: 'lockpicking',
      illegal: true,
      criminalLevelReq: 2,
      darkWebRequirements: ['lockpick', 'slim_jim'],
      wantedIncrease: 3,
      jailWeeks: 3,
    },
    {
      id: 'bank_heist',
      name: 'Bank Heist',
      description: 'Attempt a major bank robbery. Requires Drill Kit and Explosives from Onion shop.',
      energyCost: 60,
      baseSuccessRate: 20,
      basePayment: 5000,
      rank: 1,
      progress: 0,
      skill: 'stealth',
      illegal: true,
      criminalLevelReq: 3,
      darkWebRequirements: ['drill_kit', 'explosives'],
      wantedIncrease: 5,
      jailWeeks: 6,
    },
    {
      id: 'pickpocket',
      name: 'Pickpocket',
      description: 'Lift cash from unsuspecting pedestrians. Requires Stealth Gloves.',
      energyCost: 15,
      baseSuccessRate: 60,
      basePayment: 80,
      rank: 1,
      progress: 0,
      skill: 'stealth',
      illegal: true,
      darkWebRequirements: ['gloves'],
      wantedIncrease: 2,
      jailWeeks: 2,
    },
    {
      id: 'burglary',
      name: 'Burglary',
      description: 'Break into homes for valuables. Requires Lockpick and Crowbar.',
      energyCost: 35,
      baseSuccessRate: 45,
      basePayment: 300,
      rank: 1,
      progress: 0,
      skill: 'lockpicking',
      illegal: true,
      criminalLevelReq: 2,
      darkWebRequirements: ['lockpick', 'crowbar'],
      wantedIncrease: 4,
      jailWeeks: 4,
    },
    {
      id: 'cyber_attack',
      name: 'Cyber Attack',
      description: 'Launch an online attack for digital loot. Requires Malware Kit and VPN.',
      energyCost: 30,
      baseSuccessRate: 50,
      basePayment: 600,
      rank: 1,
      progress: 0,
      skill: 'hacking',
      illegal: true,
      criminalLevelReq: 2,
      darkWebRequirements: ['malware_kit', 'vpn'],
      risks: ['trace'],
      wantedIncrease: 3,
      jailWeeks: 4,
    },
    {
      id: 'identity_theft',
      name: 'Identity Theft',
      description: 'Steal personal data to sell on the dark web. Requires VPN.',
      energyCost: 35,
      baseSuccessRate: 55,
      basePayment: 800,
      rank: 1,
      progress: 0,
      skill: 'hacking',
      illegal: true,
      criminalLevelReq: 3,
      darkWebRequirements: ['vpn'],
      wantedIncrease: 4,
      jailWeeks: 5,
    },
    {
      id: 'smuggling',
      name: 'Smuggling',
      description: 'Transport contraband across town. Requires Bike.',
      energyCost: 45,
      baseSuccessRate: 40,
      basePayment: 1000,
      rank: 1,
      progress: 0,
      skill: 'stealth',
      illegal: true,
      criminalLevelReq: 3,
      requirements: ['bike'],
      wantedIncrease: 5,
      jailWeeks: 6,
    },
  ],
  jailActivities: [
    {
      id: 'prison_job',
      name: 'Prison Job',
      description: 'Work in the prison kitchen or laundry for small pay and reduced sentence.',
      energyCost: 20,
      payment: 25,
      sentenceReduction: 1,
    },
    {
      id: 'train_strength',
      name: 'Train Strength',
      description: 'Work out in the prison gym to improve fitness and mental health.',
      energyCost: 20,
      fitnessGain: 3,
      healthGain: 5,
      happinessGain: -1,
    },
    {
      id: 'library_study',
      name: 'Library Study',
      description: 'Study in the prison library to improve your mind and reduce stress.',
      energyCost: 15,
      happinessGain: 8,
      reputationGain: 2,
    },
    {
      id: 'prison_garden',
      name: 'Prison Garden',
      description: 'Work in the prison garden for fresh air and small income.',
      energyCost: 15,
      payment: 15,
      healthGain: 3,
      happinessGain: 5,
    },
    {
      id: 'prison_workshop',
      name: 'Prison Workshop',
      description: 'Learn a trade in the prison workshop for better pay.',
      energyCost: 25,
      payment: 40,
      sentenceReduction: 1,
      skillGain: 'crafting',
    },
    {
      id: 'attempt_escape',
      name: 'Attempt Escape',
      description: 'Risk it all to break out. Very high risk, high reward.',
      energyCost: 50,
      successRate: 0.05, // Reduced from 0.08 to 0.05 (5% success rate)
      failurePenalty: 8, // Increased from 5 to 8 weeks
    },
    {
      id: 'bribe_guard',
      name: 'Bribe Guard',
      description: 'Try to bribe a guard for early release. Expensive but effective.',
      energyCost: 10,
      cost: 1000,
      successRate: 0.6,
    },
    {
      id: 'legal_appeal',
      name: 'Legal Appeal',
      description: 'File a legal appeal for early release. Requires legal knowledge.',
      energyCost: 20,
      cost: 500,
      successRate: 0.4,
      requiresEducation: 'law_degree',
    },
    {
      id: 'good_behavior',
      name: 'Good Behavior',
      description: 'Maintain perfect behavior for sentence reduction.',
      energyCost: 5,
      happinessGain: 10,
      sentenceReduction: 1,
      requiresWeeks: 2,
    },
    {
      id: 'prison_gang',
      name: 'Join Prison Gang',
      description: 'Join a gang for protection and connections. Risky but rewarding.',
      energyCost: 15,
      successRate: 0.7,
      reputationGain: 5,
      criminalXpGain: 10,
      risk: 'violence',
    },
  ],
  careers: [
    {
      id: 'fast_food',
      levels: [
  { name: 'Fast Food Worker', salary: 80 },
  { name: 'Shift Leader', salary: 150 },
  { name: 'Restaurant Manager', salary: 220 },
],
      level: 0,
      description: 'Flip burgers in a fast-food restaurant',
      requirements: {},
      progress: 0,
      applied: false,
      accepted: false,
    },
    {
      id: 'retail',
      levels: [
  { name: 'Retail Associate', salary: 150 },
  { name: 'Floor Supervisor', salary: 220 },
  { name: 'Store Manager', salary: 320 },
],
      level: 0,
      description: 'Assist customers and manage inventory in retail',
      requirements: {},
      progress: 0,
      applied: false,
      accepted: false,
    },
    {
      id: 'janitor',
      levels: [
  { name: 'Janitor', salary: 90 },
  { name: 'Maintenance Lead', salary: 140 },
  { name: 'Facility Manager', salary: 200 },
],
      level: 0,
      description: 'Keep buildings clean and operational',
      requirements: {},
      progress: 0,
      applied: false,
      accepted: false,
    },
    {
      id: 'teacher',
      levels: [
        { name: 'Teaching Assistant', salary: 600 },
        { name: 'School Teacher', salary: 900 },
        { name: 'Department Head', salary: 1200 },
      ],
      level: 0,
      description: 'Educate the next generation',
      requirements: { education: ['business_degree'] },
      progress: 0,
      applied: false,
      accepted: false,
    },
    {
      id: 'nurse',
      levels: [
        { name: 'Nursing Assistant', salary: 800 },
        { name: 'Registered Nurse', salary: 1100 },
        { name: 'Nurse Practitioner', salary: 1500 },
      ],
      level: 0,
      description: 'Provide healthcare services',
      requirements: { fitness: 40, education: ['business_degree'] },
      progress: 0,
      applied: false,
      accepted: false,
    },
    {
      id: 'software',
      levels: [
        { name: 'Junior Developer', salary: 1000 },
        { name: 'Software Engineer', salary: 1500 },
        { name: 'Senior Engineer', salary: 2000 },
      ],
      level: 0,
      description: 'Develop software applications',
      requirements: { items: ['computer'], education: ['masters_degree'] },
      progress: 0,
      applied: false,
      accepted: false,
    },
    {
      id: 'doctor',
      levels: [
        { name: 'Medical Intern', salary: 1500 },
        { name: 'Resident Doctor', salary: 2300 },
        { name: 'Medical Doctor', salary: 3200 },
      ],
      level: 0,
      description: 'Practice medicine and heal patients',
      requirements: { education: ['phd'] },
      progress: 0,
      applied: false,
      accepted: false,
    },
    {
      id: 'lawyer',
      levels: [
        { name: 'Paralegal', salary: 1200 },
        { name: 'Associate Lawyer', salary: 1800 },
        { name: 'Senior Lawyer', salary: 2600 },
      ],
      level: 0,
      description: 'Practice law and represent clients',
      requirements: { items: ['suit'], education: ['legal_studies', 'masters_degree'] },
      progress: 0,
      applied: false,
      accepted: false,
    },
    {
      id: 'corporate',
      levels: [
        { name: 'Business Intern', salary: 1500 },
        { name: 'Manager', salary: 3000 },
        { name: 'CEO', salary: 5000 },
      ],
      level: 0,
      description: 'Climb the corporate ladder',
      requirements: { items: ['suit', 'computer'], education: ['mba'] },
      progress: 0,
      applied: false,
      accepted: false,
    },
    {
      id: 'police',
      levels: [
        { name: 'Police Cadet', salary: 400 },
        { name: 'Police Officer', salary: 600 },
        { name: 'Sergeant', salary: 900 },
      ],
      level: 0,
      description: 'Protect and serve the community',
      requirements: { fitness: 50, education: ['police_academy'] },
      progress: 0,
      applied: false,
      accepted: false,
    },
    {
      id: 'legal',
      levels: [
        { name: 'Junior Legal Assistant', salary: 350 },
        { name: 'Legal Assistant', salary: 500 },
        { name: 'Senior Legal Assistant', salary: 700 },
      ],
      level: 0,
      description: 'Support legal professionals',
      requirements: { items: ['smartphone', 'computer'], education: ['legal_studies'] },
      progress: 0,
      applied: false,
      accepted: false,
    },
    {
      id: 'bank',
      levels: [
        { name: 'Bank Teller', salary: 600 },
        { name: 'Loan Officer', salary: 900 },
        { name: 'Bank Manager', salary: 1300 },
      ],
      level: 0,
      description: 'Manage banking operations',
      requirements: { items: ['smartphone', 'computer', 'suit'], education: ['business_degree'] },
      progress: 0,
      applied: false,
      accepted: false,
    },
    {
      id: 'accountant',
      levels: [
        { name: 'Accounting Clerk', salary: 400 },
        { name: 'Accountant', salary: 700 },
        { name: 'Senior Accountant', salary: 1000 },
      ],
      level: 0,
      description: 'Handle financial records',
      requirements: { items: ['computer'], education: ['business_degree'] },
      progress: 0,
      applied: false,
      accepted: false,
    },
    {
      id: 'politician',
      levels: [
        { name: 'Campaign Volunteer', salary: 500 },
        { name: 'City Council Member', salary: 1200 },
        { name: 'Mayor', salary: 2500 },
      ],
      level: 0,
      description: 'Serve the public through politics',
      requirements: { reputation: 20 },
      progress: 0,
      applied: false,
      accepted: false,
    },
    {
      id: 'celebrity',
      levels: [
        { name: 'Influencer', salary: 800 },
        { name: 'TV Star', salary: 1800 },
        { name: 'Movie Icon', salary: 3500 },
      ],
      level: 0,
      description: 'Live in the spotlight',
      requirements: { reputation: 30 },
      progress: 0,
      applied: false,
      accepted: false,
    },
    {
      id: 'athlete',
      levels: [
        { name: 'Rookie', salary: 700 },
        { name: 'Pro', salary: 1600 },
        { name: 'Champion', salary: 3000 },
      ],
      level: 0,
      description: 'Compete at the highest level',
      requirements: { fitness: 60 },
      progress: 0,
      applied: false,
      accepted: false,
    },
  ],
  hobbies: [
    {
      id: 'music',
      name: 'Music',
      description: 'Practice instruments and perform',
      energyCost: 20,
      skill: 0,
      skillLevel: 1,
      tournamentReward: 100,
      songs: [],
      upgrades: [
        {
          id: 'better_instruments',
          name: 'Better Instruments',
          description: 'Increase song income by 20%',
          cost: 500,
          level: 0,
          maxLevel: 1,
          incomeBonusPerLevel: 0.2,
        },
        {
          id: 'promo_campaign',
          name: 'Promo Campaign',
          description: 'Increase song income by 5% per level',
          cost: 300,
          level: 0,
          maxLevel: 10,
          incomeBonusPerLevel: 0.05,
        },
        {
          id: 'studio_software',
          name: 'Studio Software',
          description: 'Buy a pro music program to boost song income by 5% per level',
          cost: 400,
          level: 0,
          maxLevel: 10,
          incomeBonusPerLevel: 0.05,
        },
        {
          id: 'home_studio',
          name: 'Home Studio',
          description: 'Upgrade your studio to gain +1 skill when training',
          cost: 500,
          level: 0,
          maxLevel: 5,
          skillBonusPerLevel: 1,
        },
      ],
    },
    {
      id: 'art',
      name: 'Art',
      description: 'Create and sell artwork',
      energyCost: 15,
      skill: 0,
      skillLevel: 1,
      tournamentReward: 90,
      artworks: [],
      upgrades: [
        {
          id: 'quality_supplies',
          name: 'Quality Supplies',
          description: 'Increase art income by 20%',
          cost: 400,
          level: 0,
          maxLevel: 1,
          incomeBonusPerLevel: 0.2,
        },
        {
          id: 'gallery_rep',
          name: 'Gallery Representation',
          description: 'Increase art income by 5% per level',
          cost: 300,
          level: 0,
          maxLevel: 10,
          incomeBonusPerLevel: 0.05,
        },
        {
          id: 'digital_tools',
          name: 'Digital Tools',
          description: 'Invest in tablets and software to raise art income by 5% per level',
          cost: 400,
          level: 0,
          maxLevel: 10,
          incomeBonusPerLevel: 0.05,
        },
        {
          id: 'studio_space',
          name: 'Studio Space',
          description: 'Rent a small studio and gain +1 skill when training',
          cost: 500,
          level: 0,
          maxLevel: 5,
          skillBonusPerLevel: 1,
        },
      ],
    },
    {
      id: 'football',
      name: 'Football',
      description: 'Train and play matches',
      energyCost: 25,
      skill: 0,
      skillLevel: 1,
      tournamentReward: 120,
      contracts: [],
      sponsors: [],
      maxSponsors: 1,
      divisions: [
        {
          name: 'Premier Division',
          teams: ['Lions FC', 'Eagles FC', 'Sharks FC', 'Tigers FC', 'Wolves FC', 'Dragons FC', 'Falcons FC', 'Pirates FC', 'Knights FC', 'Rangers FC', 'Comets FC', 'Storm FC'].map((name, i) => ({ name, goal: i + 1 })),
        },
        {
          name: 'Championship Division',
          teams: ['Bulls FC', 'Hurricanes FC', 'Panthers FC', 'Rhinos FC', 'Spartans FC', 'Vikings FC', 'Cobras FC', 'Phoenix FC', 'Raptors FC', 'Giants FC', 'Stallions FC', 'Raiders FC'].map((name, i) => ({ name, goal: i + 1 })),
        },
        {
          name: 'Amateur Division',
          teams: ['Miners FC', 'Sailors FC', 'Titans FC', 'Jets FC', 'Cyclones FC', 'Wildcats FC', 'Monarchs FC', 'Rockets FC', 'Grizzlies FC', 'Cougars FC', 'Tornadoes FC', 'Wizards FC'].map((name, i) => ({ name, goal: i + 1 })),
        },
      ],
      upgrades: [
        {
          id: 'pro_trainer',
          name: 'Pro Trainer',
          description: 'Gain +2 skill when training',
          cost: 350,
          level: 0,
          maxLevel: 1,
          skillBonusPerLevel: 2,
        },
        {
          id: 'sponsorship',
          name: 'Sponsorship Deal',
          description: 'Unlock sponsor offers and increase sponsor pay by 5% per level',
          cost: 400,
          level: 0,
          maxLevel: 10,
          incomeBonusPerLevel: 0.05,
        },
        {
          id: 'sponsor_slots',
          name: 'Sponsor Manager',
          description: 'Increase sponsor slots by 1',
          cost: 500,
          level: 0,
          maxLevel: 3,
          slotIncreasePerLevel: 1,
        },
      ],
    },
    {
      id: 'basketball',
      name: 'Basketball',
      description: 'Shoot hoops and join leagues',
      energyCost: 25,
      skill: 0,
      skillLevel: 1,
      tournamentReward: 120,
      contracts: [],
      sponsors: [],
      maxSponsors: 1,
      divisions: [
        {
          name: 'National League',
          teams: ['Skyhawks', 'Thunder', 'Blaze', 'Titans', 'Storm', 'Bulls', 'Warriors', 'Rockets', 'Panthers', 'Giants', 'Kings', 'Pirates'].map((name, i) => ({ name, goal: i + 1 })),
        },
        {
          name: 'Regional League',
          teams: ['Raptors', 'Comets', 'Falcons', 'Sharks', 'Dragons', 'Cyclones', 'Eagles', 'Wolves', 'Lions', 'Hurricanes', 'Spartans', 'Royals'].map((name, i) => ({ name, goal: i + 1 })),
        },
        {
          name: 'Local League',
          teams: ['Stallions', 'Phoenix', 'Tigers', 'Bisons', 'Vipers', 'Knights', 'Jets', 'Raiders', 'Rams', 'Bulldogs', 'Panthers', 'Stormers'].map((name, i) => ({ name, goal: i + 1 })),
        },
      ],
      upgrades: [
        {
          id: 'training_facility',
          name: 'Training Facility',
          description: 'Gain +2 skill when training',
          cost: 350,
          level: 0,
          maxLevel: 1,
          skillBonusPerLevel: 2,
        },
        {
          id: 'sponsorship',
          name: 'Sponsorship Deal',
          description: 'Unlock sponsor offers and increase sponsor pay by 5% per level',
          cost: 400,
          level: 0,
          maxLevel: 10,
          incomeBonusPerLevel: 0.05,
        },
        {
          id: 'sponsor_slots',
          name: 'Sponsor Manager',
          description: 'Increase sponsor slots by 1',
          cost: 500,
          level: 0,
          maxLevel: 3,
          slotIncreasePerLevel: 1,
        },
      ],
    },
    {
      id: 'tennis',
      name: 'Tennis',
      description: 'Practice your serve and compete',
      energyCost: 20,
      skill: 0,
      skillLevel: 1,
      tournamentReward: 110,
      contracts: [],
      sponsors: [],
      maxSponsors: 1,
      divisions: [
        {
          name: 'World Tour',
          teams: ['Grand Slams', 'Topspinners', 'Baseline Kings', 'Net Chargers', 'Serve Masters', 'Drop Shotters', 'Aces United', 'Spin Doctors', 'Court Warriors', 'Volley Vipers', 'Smash Bros', 'Slice Surge'].map((name, i) => ({ name, goal: i + 1 })),
        },
        {
          name: 'Challenger Tour',
          teams: ['Rally Raiders', 'Topspin Titans', 'Baseline Beasts', 'Net Ninjas', 'Serve Squad', 'Drop Shot Dragons', 'Ace Breakers', 'Spin Sharks', 'Court Crusaders', 'Volley Wolves', 'Smash Squad', 'Slice Strikers'].map((name, i) => ({ name, goal: i + 1 })),
        },
        {
          name: 'Amateur Tour',
          teams: ['Rookie Ralliers', 'Topspin Turtles', 'Baseline Bears', 'Net Knights', 'Serve Savers', 'Drop Shot Dolphins', 'Ace Apprentices', 'Spin Sparrows', 'Court Cadets', 'Volley Vultures', 'Smash Sprinters', 'Slice Swifts'].map((name, i) => ({ name, goal: i + 1 })),
        },
      ],
      upgrades: [
        {
          id: 'tennis_coach',
          name: 'Tennis Coach',
          description: 'Gain +2 skill when training',
          cost: 300,
          level: 0,
          maxLevel: 1,
          skillBonusPerLevel: 2,
        },
        {
          id: 'endorsement',
          name: 'Endorsement Deal',
          description: 'Unlock sponsor offers and increase sponsor pay by 5% per level',
          cost: 350,
          level: 0,
          maxLevel: 10,
          incomeBonusPerLevel: 0.05,
        },
        {
          id: 'sponsor_slots',
          name: 'Sponsor Manager',
          description: 'Increase sponsor slots by 1',
          cost: 500,
          level: 0,
          maxLevel: 3,
          slotIncreasePerLevel: 1,
        },
      ],
    },
  ],
  items: [
    { id: 'guitar', name: 'Guitar', price: 200, owned: false },
    { id: 'bike', name: 'Bike', price: 150, owned: false },
    {
      id: 'smartphone',
      name: 'Smartphone',
      price: 300,
      description: 'Unlocks mobile apps and new ways to earn money',
      owned: false,
    },
    {
      id: 'computer',
      name: 'Computer',
      price: 800,
      description: 'Provides advanced tools and additional income opportunities',
      owned: false,
    },
    { id: 'suit', name: 'Business Suit', price: 400, owned: false },
    {
      id: 'basic_bed',
      name: 'Basic Bed',
      price: 500,
      owned: false,
      dailyBonus: { energy: 10, happiness: 5 },
    },
    {
      id: 'gym_membership',
      name: 'Gym Membership',
      price: 100,
      owned: false,
      dailyBonus: { fitness: 2, health: 3 },
    },
  ],
  darkWebItems: [
    {
      id: 'usb',
      name: 'Special USB',
      description: 'Essential hardware for exploits',
      costBtc: 0.012,
      rewardBonus: 0.1,
      owned: false,
    },
    {
      id: 'vpn',
      name: 'VPN',
      description: 'Mask your identity to reduce risk',
      costBtc: 0.007,
      riskReduction: 0.1,
      owned: false,
    },
    {
      id: 'proxy',
      name: 'Proxy Chain',
      description: 'Route traffic through multiple nodes',
      costBtc: 0.009,
      riskReduction: 0.05,
      owned: false,
    },
    {
      id: 'exploit',
      name: 'Exploit Kit',
      description: 'Advanced tools to find vulnerabilities',
      costBtc: 0.019,
      rewardBonus: 0.3,
      owned: false,
    },
    {
      id: 'encryption',
      name: 'Encryption Suite',
      description: 'Hide your tracks with strong encryption',
      costBtc: 0.016,
      riskReduction: 0.1,
      rewardBonus: 0.2,
      owned: false,
    },
    {
      id: 'lockpick',
      name: 'Lockpick Set',
      description: 'Essential for shoplifting and car theft',
      costBtc: 0.005,
      owned: false,
    },
    {
      id: 'slim_jim',
      name: 'Slim Jim',
      description: 'Tool for silently opening car doors',
      costBtc: 0.008,
      owned: false,
    },
    {
      id: 'drill_kit',
      name: 'Drill Kit',
      description: 'Heavy-duty drill for bank vaults',
      costBtc: 0.03,
      owned: false,
    },
    {
      id: 'explosives',
      name: 'C4 Explosives',
      description: 'Explosives for high-level heists',
      costBtc: 0.05,
      owned: false,
    },
    {
      id: 'gloves',
      name: 'Stealth Gloves',
      description: 'Reduce chance of getting caught while pickpocketing',
      costBtc: 0.004,
      riskReduction: 0.05,
      owned: false,
    },
    {
      id: 'crowbar',
      name: 'Crowbar',
      description: 'Pry open doors and windows during burglaries',
      costBtc: 0.012,
      owned: false,
    },
    {
      id: 'malware_kit',
      name: 'Malware Kit',
      description: 'Toolkit for launching cyber attacks',
      costBtc: 0.02,
      rewardBonus: 0.2,
      owned: false,
    },
  ],
  hacks: [
    {
      id: 'phishing',
      name: 'Phishing Attack',
      description: 'Fake emails to steal credentials',
      costBtc: 0.01,
      risk: 0.3,
      reward: 500,
      purchased: false,
      energyCost: 10,
    },
    {
      id: 'ransomware',
      name: 'Ransomware',
      description: 'Encrypt files for ransom',
      costBtc: 0.02,
      risk: 0.5,
      reward: 1500,
      purchased: false,
      energyCost: 20,
    },
    {
      id: 'sql_injection',
      name: 'SQL Injection',
      description: 'Exploit database vulnerabilities',
      costBtc: 0.015,
      risk: 0.35,
      reward: 800,
      purchased: false,
      energyCost: 15,
    },
    {
      id: 'ddos',
      name: 'DDoS Attack',
      description: 'Overwhelm servers to extort payments',
      costBtc: 0.02,
      risk: 0.4,
      reward: 1200,
      purchased: false,
      energyCost: 25,
    },
    {
      id: 'zero_day',
      name: 'Zero-Day Exploit',
      description: 'Leverage unknown vulnerabilities',
      costBtc: 0.05,
      risk: 0.6,
      reward: 3000,
      purchased: false,
      energyCost: 30,
    },
    {
      id: 'mitm',
      name: 'Man-in-the-Middle',
      description: 'Intercept traffic for sensitive data',
      costBtc: 0.025,
      risk: 0.45,
      reward: 1000,
      purchased: false,
      energyCost: 18,
    },
    {
      id: 'keylogger',
      name: 'Keylogger Deployment',
      description: 'Capture keystrokes covertly',
      costBtc: 0.012,
      risk: 0.25,
      reward: 400,
      purchased: false,
      energyCost: 12,
    },
    {
      id: 'bruteforce',
      name: 'Brute Force Attack',
      description: 'Crack passwords through sheer power',
      costBtc: 0.018,
      risk: 0.4,
      reward: 900,
      purchased: false,
      energyCost: 22,
    },
  ],
  relationships: [
    {
      id: 'parent1',
      name: 'Mom',
      type: 'parent',
      relationshipScore: 50,
      personality: 'caring',
      gender: 'female',
      age: 45,
    },
    {
      id: 'parent2',
      name: 'Dad',
      type: 'parent',
      relationshipScore: 50,
      personality: 'strict',
      gender: 'male',
      age: 47,
    },
  ],
  pets: [],
  social: { relations: [] },
  family: { children: [] },
  lifeStage: getLifeStage(18),
  foods: [
    { id: 'apple', name: 'Apple', price: 5, healthRestore: 3, energyRestore: 2 },
    { id: 'sandwich', name: 'Sandwich', price: 15, healthRestore: 8, energyRestore: 12 },
    { id: 'salad', name: 'Healthy Salad', price: 18, healthRestore: 10, energyRestore: 6 },
    { id: 'pizza', name: 'Pizza Slice', price: 12, healthRestore: 5, energyRestore: 15 },
    { id: 'burger', name: 'Burger', price: 18, healthRestore: 8, energyRestore: 18 },
    { id: 'sushi', name: 'Sushi Roll', price: 25, healthRestore: 15, energyRestore: 8 },
    { id: 'smoothie', name: 'Green Smoothie', price: 14, healthRestore: 12, energyRestore: 7 },
    { id: 'steak', name: 'Steak Dinner', price: 40, healthRestore: 20, energyRestore: 25 },
    { id: 'ramen', name: 'Instant Ramen', price: 8, healthRestore: 4, energyRestore: 8 },
    { id: 'protein_bar', name: 'Protein Bar', price: 10, healthRestore: 5, energyRestore: 12 },
  ],
  healthActivities: [
    { id: 'walk', name: 'Walk in Park', description: 'Peaceful walk to clear your mind', price: 0, happinessGain: 5, healthGain: 3, energyCost: 10 },
    { id: 'meditation', name: 'Meditation Session', description: 'Find inner peace and reduce stress', price: 40, happinessGain: 10, energyCost: 5 },
    { id: 'yoga', name: 'Yoga Class', description: 'Improve flexibility and mental clarity', price: 50, happinessGain: 8, healthGain: 5, energyCost: 5 },
    { id: 'massage', name: 'Spa Massage', description: 'Relax and rejuvenate your body', price: 150, happinessGain: 15, healthGain: 8, energyCost: 5 },
    {
      id: 'doctor',
      name: 'Doctor Visit',
      description: 'Regular checkup (50% chance to cure health issues)',
      price: 250,
      happinessGain: 0,
      healthGain: 25,
      energyCost: 5
    },
    { id: 'therapy', name: 'Therapy Session', description: 'Professional mental health support', price: 200, happinessGain: 20, energyCost: 5 },
    {
      id: 'hospital',
      name: 'Hospital Stay',
      description: 'Cures all health issues except cancer',
      price: 1000,
      happinessGain: -5,
      healthGain: 40,
      energyCost: 5
    },
    { id: 'experimental', name: 'Experimental Treatment', description: 'Cutting-edge medical procedure', price: 6000, happinessGain: 15, healthGain: 25, energyCost: 5 },
    { id: 'vacation', name: 'Weekend Getaway', description: 'Short vacation to recharge', price: 8000, happinessGain: 35, energyCost: -15 },
    { id: 'retreat', name: 'Wellness Retreat', description: 'Multi-day wellness experience', price: 15000, happinessGain: 40, healthGain: 20, energyCost: 5 },
  ],
  dietPlans: [
    { id: 'basic', name: 'Basic Diet', description: 'Simple, healthy meals', dailyCost: 75, healthGain: 3, energyGain: 2, active: false },
    { id: 'premium', name: 'Premium Diet', description: 'Organic, high-quality ingredients', dailyCost: 175, healthGain: 8, energyGain: 5, happinessGain: 3, active: false },
    { id: 'athlete', name: 'Athlete Diet', description: 'High-protein, performance-focused', dailyCost: 250, healthGain: 12, energyGain: 8, happinessGain: 5, active: false },
  ],
  educations: [],
  userProfile: {
    name: 'Player',
    handle: '@player',
    bio: 'Living my best life!',
    followers: 0,
    following: 0,
    gender: 'male',
    seekingGender: 'female',
    firstName: '',
    lastName: '',
    sex: 'male',
    sexuality: 'straight',
  },
  settings: {
    darkMode: false,
    soundEnabled: true,
    notificationsEnabled: true,
    autoSave: true,
    language: 'English',
    maxStats: false,
  },
  diseases: [],
  realEstate: [],
  economy: { inflationRateAnnual: 0.03, priceIndex: 1 },
  cryptos: [
    { id: 'btc', symbol: 'BTC', name: 'Bitcoin', price: 42150.0, change: 0, changePercent: 0, owned: 0 },
    { id: 'eth', symbol: 'ETH', name: 'Ethereum', price: 2580.5, change: 0, changePercent: 0, owned: 0 },
    { id: 'xrp', symbol: 'XRP', name: 'Ripple', price: 0.52, change: 0, changePercent: 0, owned: 0 },
    { id: 'ada', symbol: 'ADA', name: 'Cardano', price: 0.38, change: 0, changePercent: 0, owned: 0 },
    { id: 'sol', symbol: 'SOL', name: 'Solana', price: 98.45, change: 0, changePercent: 0, owned: 0 },
    { id: 'dot', symbol: 'DOT', name: 'Polkadot', price: 5.23, change: 0, changePercent: 0, owned: 0 },
    { id: 'matic', symbol: 'MATIC', name: 'Polygon', price: 0.85, change: 0, changePercent: 0, owned: 0 },
    { id: 'link', symbol: 'LINK', name: 'Chainlink', price: 14.2, change: 0, changePercent: 0, owned: 0 },
  ],
  companies: [],
  company: undefined,
  showWelcomePopup: true,
  achievements: [
    // Money
    { id: 'first_dollar', name: 'First Payday', description: 'Earn your first hard-earned dollar', category: 'money', completed: false },
    { id: 'hundred_dollars', name: 'Hundredaire', description: 'Reach $100 in savings', category: 'money', completed: false },
    { id: 'thousand_dollars', name: 'Thousandaire', description: 'Save up $1,000', category: 'money', completed: false },
    { id: 'ten_thousand', name: 'Five Figures', description: 'Accumulate $10,000 in wealth', category: 'money', completed: false },
    { id: 'hundred_thousand', name: 'Six Figures', description: 'Hit $100,000 net worth', category: 'money', completed: false },
    { id: 'millionaire', name: 'Millionaire', description: 'Become a millionaire', category: 'money', completed: false },
    {
      id: 'deca_millionaire',
      name: 'Deca-Millionaire',
      description: 'Save $10,000,000',
      category: 'money',
      completed: false,
      reward: 50,
    },

    // Career
    { id: 'first_job', name: 'First Job', description: 'Get your first job', category: 'career', completed: false },
    { id: 'street_worker', name: 'Street Smart', description: 'Complete 10 street gigs', category: 'career', completed: false },
    { id: 'career_starter', name: 'Career Starter', description: 'Land a career job', category: 'career', completed: false },
    { id: 'promotion', name: 'Moving Up', description: 'Earn a promotion', category: 'career', completed: false },
    { id: 'entrepreneur', name: 'Entrepreneur', description: 'Start your own company', category: 'career', completed: false },
    { id: 'first_upgrade', name: 'Upgrade Complete', description: 'Purchase your first company upgrade', category: 'career', completed: false },
    { id: 'all_upgrades', name: 'Fully Equipped', description: 'Buy every company upgrade', category: 'career', completed: false },
    { id: 'first_worker', name: 'First Hire', description: 'Hire your first worker', category: 'career', completed: false },
    { id: 'team_builder', name: 'Team Builder', description: 'Hire 5 company workers', category: 'career', completed: false },
    {
      id: 'industry_mogul',
      name: 'Industry Mogul',
      description: 'Reach $50,000 weekly company income',
      category: 'career',
      completed: false,
      reward: 40,
    },
    { id: 'politician_legend', name: 'Political Legend', description: 'Reach the highest level in the politician career', category: 'career', completed: false },
    { id: 'celebrity_icon', name: 'Celebrity Icon', description: 'Reach the highest level in the celebrity career', category: 'career', completed: false },
    { id: 'athletic_champion', name: 'Athletic Champion', description: 'Reach the highest level in the athlete career', category: 'career', completed: false },

    // Education
    { id: 'graduate', name: 'Graduate', description: 'Complete high school', category: 'education', completed: false },
    { id: 'college_grad', name: 'College Graduate', description: 'Finish university', category: 'education', completed: false },
    { id: 'specialist', name: 'Specialist', description: 'Complete a specialized degree', category: 'education', completed: false },
    { id: 'lifelong_learner', name: 'Lifelong Learner', description: 'Complete 3 different educations', category: 'education', completed: false },

    // Relationships
    { id: 'first_friend', name: 'Social Butterfly', description: 'Make your first friend', category: 'relationships', completed: false },
    { id: 'popular', name: 'Popular', description: 'Have 5 relationships', category: 'relationships', completed: false },
    { id: 'lover', name: 'Lover', description: 'Find a romantic partner', category: 'relationships', completed: false },
    { id: 'married', name: 'Married', description: 'Get married', category: 'relationships', completed: false },
    { id: 'parent', name: 'Parent', description: 'Have a child', category: 'relationships', completed: false },
    { id: 'best_friend', name: 'Best Friend', description: 'Reach 100 relationship with a friend', category: 'relationships', completed: false },

    // Health
    { id: 'fitness_buff', name: 'Fitness Buff', description: 'Reach 50 fitness', category: 'health', completed: false },
    { id: 'athlete', name: 'Athlete', description: 'Reach 100 fitness', category: 'health', completed: false },
    { id: 'healthy_lifestyle', name: 'Healthy Lifestyle', description: 'Use a diet plan for 4 weeks', category: 'health', completed: false },
    { id: 'wellness_guru', name: 'Wellness Guru', description: 'Complete 20 health activities', category: 'health', completed: false },

    // Items
    { id: 'first_purchase', name: 'First Purchase', description: 'Buy your first item', category: 'items', completed: false },
    { id: 'tech_savvy', name: 'Tech Savvy', description: 'Own smartphone and computer', category: 'items', completed: false },
    { id: 'luxury_life', name: 'Luxury Life', description: 'Own car, house, and yacht', category: 'items', completed: false },
    { id: 'collector', name: 'Collector', description: 'Own all available items', category: 'items', completed: false },

    // Special
    { id: 'survivor', name: 'Survivor', description: 'Live to age 65', category: 'special', completed: false },
    { id: 'centenarian', name: 'Centenarian', description: 'Live to age 100', category: 'special', completed: false },
    { id: 'crypto_investor', name: 'Crypto Investor', description: 'Own $10,000 worth of cryptocurrency', category: 'special', completed: false },
    {
      id: 'gold_hoarder',
      name: 'Gold Hoarder',
              description: 'Collect 100 Gems',
      category: 'special',
      completed: false,
      reward: 100,
    },

    // Secret achievements
    { id: 'secret_1', name: '???', description: 'Hidden achievement', category: 'secret', completed: false },
    { id: 'secret_2', name: '???', description: 'Hidden achievement', category: 'secret', completed: false },
    { id: 'secret_3', name: '???', description: 'Hidden achievement', category: 'secret', completed: false },
    { id: 'secret_4', name: '???', description: 'Hidden achievement', category: 'secret', completed: false },
    { id: 'secret_5', name: '???', description: 'Hidden achievement', category: 'secret', completed: false },
    { id: 'secret_6', name: '???', description: 'Hidden achievement', category: 'secret', completed: false },
    { id: 'secret_7', name: '???', description: 'Hidden achievement', category: 'secret', completed: false },
    { id: 'secret_8', name: '???', description: 'Hidden achievement', category: 'secret', completed: false },
    { id: 'secret_9', name: '???', description: 'Hidden achievement', category: 'secret', completed: false },
    { id: 'secret_10', name: '???', description: 'Hidden achievement', category: 'secret', completed: false },
  ],
  claimedProgressAchievements: [],
  lastLogin: Date.now(),
  updatedAt: Date.now(),
  streetJobsCompleted: 0,
  happinessZeroWeeks: 0,
  healthZeroWeeks: 0,
  showZeroStatPopup: false,
  zeroStatType: undefined,
  showDeathPopup: false,
  deathReason: undefined,
  hasPhone: false,
  day: 1,
  dailySummary: undefined,
  pendingEvents: [],
  eventLog: [],
  progress: { achievements: [] },
  journal: [],
  scenarioId: undefined,
  stocks: {
    holdings: [],
    watchlist: [],
  },
};

/* ---------- Provider ---------- */

export function GameProvider({ children }: { children: React.ReactNode }) {
  const [gameState, setGameState] = useState<GameState>(initialGameState);
  const [currentSlot, setCurrentSlot] = useState<number>(1);
  const preDeathStateRef = useRef<GameState | null>(null);

  const restartGame = async () => {
    try {
      await AsyncStorage.removeItem('gameState');
    } catch (error) {
      console.error('Failed to remove saved game', error);
    }
    const resetState: GameState = JSON.parse(JSON.stringify(initialGameState));
    // Carry over completed achievements and progress to unlock perks in the next life
    resetState.achievements = JSON.parse(JSON.stringify(gameState.achievements));
    resetState.progress = JSON.parse(JSON.stringify(gameState.progress));
    resetState.stats.gems = gameState.stats.gems;
    setGameState(resetState);
    try {
      await AsyncStorage.setItem('gameState', JSON.stringify(resetState));
    } catch (error) {
      console.error('Failed to persist reset state', error);
    }
  };

  const reviveCharacter = () => {
    const reviveCost = 500;
    if (gameState.stats.gems < reviveCost) {
      Alert.alert('Not enough gems', `You need ${reviveCost} gems to revive.`);
      return;
    }
    if (!preDeathStateRef.current) {
      return;
    }
    const revivedState: GameState = {
      ...preDeathStateRef.current,
      stats: {
        ...preDeathStateRef.current.stats,
        gems: preDeathStateRef.current.stats.gems - reviveCost,
        happiness: 50,
        health: 50,
      },
      happinessZeroWeeks: 0,
      healthZeroWeeks: 0,
      showZeroStatPopup: false,
      zeroStatType: undefined,
      showDeathPopup: false,
      deathReason: undefined,
    };
    preDeathStateRef.current = null;
    setGameState(revivedState);
  };

  const checkAchievements = (state: GameState = gameState) => {
    if (!state.achievements) return;

    const newAchievements = [...state.achievements];
    let hasChanges = false;
    let goldReward = 0;

    const completeAchievement = (id: string) => {
      const achievement = newAchievements.find(a => a.id === id);
      if (achievement && !achievement.completed) {
        achievement.completed = true;
        hasChanges = true;
        goldReward += achievement.reward ?? 1;
        showAchievementToast(achievement.name);
        notifyAchievementUnlock(achievement.name, achievement.reward ?? 1);
      }
    };

    // Money
    if (state.stats.money >= 1) completeAchievement('first_dollar');
    if (state.stats.money >= 100) completeAchievement('hundred_dollars');
    if (state.stats.money >= 1000) completeAchievement('thousand_dollars');
    if (state.stats.money >= 10000) completeAchievement('ten_thousand');
    if (state.stats.money >= 100000) completeAchievement('hundred_thousand');
    if (state.stats.money >= 1000000) completeAchievement('millionaire');
    if (state.stats.money >= 10000000) completeAchievement('deca_millionaire');

    // Career
    if (state.currentJob) completeAchievement('first_job');

    if (state.streetJobsCompleted >= 10) completeAchievement('street_worker');

    const hasCareerJob = state.careers.some(career => career.accepted);
    if (hasCareerJob) completeAchievement('career_starter');

    if (state.companies.length > 0) completeAchievement('entrepreneur');

    const purchasedUpgrades = state.companies.reduce(
      (sum, company) => sum + company.upgrades.filter(u => u.level > 0).length,
      0
    );
    const totalUpgrades = state.companies.reduce((sum, company) => sum + company.upgrades.length, 0);
    if (purchasedUpgrades >= 1) completeAchievement('first_upgrade');
    if (totalUpgrades > 0 && purchasedUpgrades === totalUpgrades) completeAchievement('all_upgrades');

    const hiredWorkers = state.companies.reduce((sum, c) => sum + c.employees, 0);
    if (hiredWorkers >= 1) completeAchievement('first_worker');
    if (hiredWorkers >= 5) completeAchievement('team_builder');
    if (state.companies.some(c => c.weeklyIncome >= 50000)) completeAchievement('industry_mogul');

    // Education
    const completedEducations = state.educations.filter(edu => edu.completed);
    if (completedEducations.some(edu => edu.id === 'high_school')) completeAchievement('graduate');
    if (completedEducations.some(edu => edu.id === 'university')) completeAchievement('college_grad');
    if (completedEducations.some(edu => ['computer_science', 'medical_school'].includes(edu.id)))
      completeAchievement('specialist');
    if (completedEducations.length >= 3) completeAchievement('lifelong_learner');

    // Relationships
    if (state.relationships.some(rel => rel.type === 'friend'))
      completeAchievement('first_friend');
    if (state.relationships.filter(rel => rel.type !== 'parent').length >= 5)
      completeAchievement('popular');
    if (state.relationships.some(rel => rel.type === 'partner')) completeAchievement('lover');
    if (state.relationships.some(rel => rel.type === 'spouse')) completeAchievement('married');
    if (state.relationships.some(rel => rel.type === 'child')) completeAchievement('parent');
    if (state.relationships.some(rel => rel.type === 'friend' && rel.relationshipScore >= 100))
      completeAchievement('best_friend');

    // Health
    if (state.stats.fitness >= 50) completeAchievement('fitness_buff');
    if (state.stats.fitness >= 100) completeAchievement('athlete');

    // Items
    const ownedItems = state.items.filter(item => item.owned);
    if (ownedItems.length >= 1) completeAchievement('first_purchase');

    const hasSmartphone = state.items.find(item => item.id === 'smartphone')?.owned;
    const hasComputer = state.items.find(item => item.id === 'computer')?.owned;
    if (hasSmartphone && hasComputer) completeAchievement('tech_savvy');

    const hasCar = state.items.find(item => item.id === 'car')?.owned;
    const hasHouse = state.items.find(item => item.id === 'house')?.owned;
    const hasYacht = state.items.find(item => item.id === 'yacht')?.owned;
    if (hasCar && hasHouse && hasYacht) completeAchievement('luxury_life');

    if (ownedItems.length === state.items.length && state.items.length > 0)
      completeAchievement('collector');

    // Special
    if (state.date.age >= 65) completeAchievement('survivor');
    if (state.date.age >= 100) completeAchievement('centenarian');

    const cryptoValue = state.cryptos.reduce((total, crypto) => total + crypto.owned * crypto.price, 0);
    if (cryptoValue >= 10000) completeAchievement('crypto_investor');
    if (state.stats.gems >= 100) completeAchievement('gold_hoarder');

    if (goldReward > 0) {
              updateStats({ gems: state.stats.gems + goldReward });
    }
    if (hasChanges) {
      setGameState(prev => ({ ...prev, achievements: newAchievements }));
    }
    const unlocked = evaluateAchievements(state);
    if (unlocked.length > 0) {
      setGameState(prev => ({
        ...prev,
        progress: {
          ...prev.progress,
          achievements: [
            ...prev.progress.achievements,
            ...unlocked.map(a => ({ ...a, unlockedAt: prev.week })),
          ],
        },
        journal: [
          ...prev.journal,
          ...unlocked.map(a => ({
            id: uuidv4(),
            atWeek: prev.week,
            title: `Achievement unlocked: ${a.name}`,
            details: a.desc,
            tags: ['achievement'],
          })),
        ],
      }));
      unlocked.forEach(a => showAchievementToast(a.name));
    }
  };

  useEffect(() => {
    loadGame();

    // Simulate crypto price changes
    const interval = setInterval(() => {
      setGameState(prev => ({
        ...prev,
        cryptos: prev.cryptos.map(crypto => {
          const changePercent = (Math.random() - 0.5) * 15; // -7.5% to +7.5%
          const newPrice = Math.max(0.01, crypto.price * (1 + changePercent / 100));
          const change = newPrice - crypto.price;

          return {
            ...crypto,
            price: parseFloat(
              newPrice.toFixed(crypto.symbol === 'XRP' || crypto.symbol === 'ADA' || crypto.symbol === 'MATIC' ? 4 : 2)
            ),
            change: parseFloat(change.toFixed(2)),
            changePercent: parseFloat(changePercent.toFixed(2)),
          };
        }),
      }));
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const updateStats = (newStats: Partial<GameStats>) => {
    setGameState(prev => {
      const updatedStats = {
        ...prev.stats,
        ...newStats,
        health: Math.max(0, Math.min(100, newStats.health ?? prev.stats.health)),
        happiness: Math.max(0, Math.min(100, newStats.happiness ?? prev.stats.happiness)),
        energy: Math.max(0, Math.min(100, newStats.energy ?? prev.stats.energy)),
        fitness: Math.max(0, newStats.fitness ?? prev.stats.fitness),
        money: Math.max(0, newStats.money ?? prev.stats.money),
        reputation: Math.max(0, newStats.reputation ?? prev.stats.reputation),
        gems: Math.max(0, newStats.gems ?? prev.stats.gems),
      };
      if (prev.settings.maxStats) {
        updatedStats.health = 100;
        updatedStats.happiness = 100;
        updatedStats.energy = 100;
      }
      let showZeroStatPopup = prev.showZeroStatPopup;
      let zeroStatType = prev.zeroStatType;
      if (updatedStats.health <= 0 && prev.stats.health > 0) {
        showZeroStatPopup = true;
        zeroStatType = 'health';
      }
      if (updatedStats.happiness <= 0 && prev.stats.happiness > 0) {
        showZeroStatPopup = true;
        zeroStatType = 'happiness';
      }

      return { ...prev, stats: updatedStats, showZeroStatPopup, zeroStatType };
    });
  };

  const gainCriminalXp: GameContextType['gainCriminalXp'] = amount => {
    setGameState(prev => {
      let xp = prev.criminalXp + amount;
      let level = prev.criminalLevel;
      let threshold = level * 100;
      while (xp >= threshold) {
        xp -= threshold;
        level += 1;
        threshold = level * 100;
      }
      return { ...prev, criminalXp: xp, criminalLevel: level };
    });
  };

  const gainCrimeSkillXp: GameContextType['gainCrimeSkillXp'] = (
    skillId,
    amount
  ) => {
    setGameState(prev => {
      const skill = prev.crimeSkills[skillId];
      const upgrades = skill.upgrades || [];
      let xp = skill.xp + amount;
      let level = skill.level;
      let threshold = level * 100;
      while (xp >= threshold) {
        xp -= threshold;
        level += 1;
        threshold = level * 100;
      }
      return {
        ...prev,
        crimeSkills: {
          ...prev.crimeSkills,
          [skillId]: { xp, level, upgrades },
        },
      };
    });
  };

  const unlockCrimeSkillUpgrade: GameContextType['unlockCrimeSkillUpgrade'] = (
    skillId,
    upgradeId,
    cost,
    levelReq
  ) => {
    setGameState(prev => {
      if (prev.stats.money < cost) return prev;
      const skill = prev.crimeSkills[skillId];
      if (skill.level < levelReq) return prev;
      const upgrades = skill.upgrades || [];
      if (upgrades.includes(upgradeId)) return prev;
      return {
        ...prev,
        stats: { ...prev.stats, money: prev.stats.money - cost },
        crimeSkills: {
          ...prev.crimeSkills,
          [skillId]: { ...skill, upgrades: [...upgrades, upgradeId] },
        },
      };
    });
  };

  useEffect(() => {
    if (
      gameState.settings.maxStats &&
      (gameState.stats.health !== 100 ||
        gameState.stats.happiness !== 100 ||
        gameState.stats.energy !== 100)
    ) {
      setGameState(prev => ({
        ...prev,
        stats: { ...prev.stats, health: 100, happiness: 100, energy: 100 },
      }));
    }
  }, [
    gameState.settings.maxStats,
    gameState.stats.health,
    gameState.stats.happiness,
    gameState.stats.energy,
  ]);

  const performStreetJob: GameContextType['performStreetJob'] = jobId => {
    const job = gameState.streetJobs.find(j => j.id === jobId);
    if (!job) return;
    if (gameState.jailWeeks > 0) {
      return { success: false, message: 'Cannot work while jailed' };
    }

    const basePayment = job.basePayment * (1 + (job.rank - 1) * 0.2);
    if (job.requirements) {
      for (const req of job.requirements) {
        const item = gameState.items.find(i => i.id === req);
        if (!item?.owned) {
          return { success: false, message: `Requires ${item?.name || req}` };
        }
      }
    }

    if (job.criminalLevelReq && gameState.criminalLevel < job.criminalLevelReq) {
      return {
        success: false,
        message: `Requires criminal level ${job.criminalLevelReq}`,
      };
    }

    if (job.darkWebRequirements) {
      for (const req of job.darkWebRequirements) {
        const item = gameState.darkWebItems.find(i => i.id === req);
        if (!item?.owned) {
          return {
            success: false,
            message: `Requires ${item?.name || req}`,
          };
        }
      }
    }

    if (gameState.stats.energy < job.energyCost) {
      return { success: false, message: 'Not enough energy' };
    }

    const rankBonus = (job.rank - 1) * 10;
    let successRate = job.baseSuccessRate + rankBonus;
    if (job.skill) {
      const skillLevel = gameState.crimeSkills[job.skill].level;
      successRate += skillLevel * 2;
    }
    successRate = Math.min(95, successRate);
    let moneyGained = 0;
    let moneyLost = 0;
    let success = false;
    let caught = false;
    const events: string[] = [];

    if (job.illegal) {
      const ownedItems = gameState.darkWebItems.filter(i => i.owned);
      const totalRiskReduction = ownedItems.reduce(
        (sum, i) => sum + (i.riskReduction || 0),
        0
      );
      const totalRewardBonus = ownedItems.reduce(
        (sum, i) => sum + (i.rewardBonus || 0),
        0
      );

      let paymentBonus = 1;
      if (job.id === 'scam') {
        if (gameState.items.find(i => i.id === 'smartphone')?.owned) {
          successRate += 15;
          paymentBonus += 0.5;
          events.push('Phone helped with online scamming');
        }
        if (gameState.items.find(i => i.id === 'computer')?.owned) {
          successRate += 25;
          paymentBonus += 1;
          events.push('Computer enabled advanced scamming');
        }
      }

      successRate += successRate * totalRiskReduction;
      success = Math.random() * 100 < successRate;

      if (success) {
        const rankMultiplier = 1 + (job.rank - 1) * 0.3;
        moneyGained = Math.floor(
          job.basePayment * rankMultiplier * (1 + totalRewardBonus) * paymentBonus
        );
        events.push(`Earned $${moneyGained} from ${job.name}`);
        
        // Increase wanted level
        setGameState(prev => ({
          ...prev,
          wantedLevel: prev.wantedLevel + (job.wantedIncrease || 0),
        }));
        
        // Check for immediate arrest based on wanted level
        const currentWantedLevel = gameState.wantedLevel + (job.wantedIncrease || 0);
        const arrestChance = currentWantedLevel * 0.15; // 15% per wanted level
        
        if (Math.random() < arrestChance) {
          caught = true;
          setGameState(prev => ({
            ...prev,
            jailWeeks: job.jailWeeks || 3,
            wantedLevel: 0,
          }));
          events.push(`Arrested immediately! Jailed for ${job.jailWeeks || 3} weeks.`);
        }
      } else {
        caught = Math.random() < 0.5;
        if (caught) {
          setGameState(prev => ({
            ...prev,
            jailWeeks: job.jailWeeks || 0,
            wantedLevel: 0,
          }));
          events.push(`Caught! Jailed for ${job.jailWeeks} weeks.`);
        } else {
          setGameState(prev => ({
            ...prev,
            wantedLevel:
              prev.wantedLevel + (job.wantedIncrease || 0) * 2,
          }));
          events.push(`${job.name} failed. Wanted level increased.`);
        }
      }

      if (job.id === 'scam' && !caught) {
        if (Math.random() < 0.1) {
          moneyGained = 0;
          events.push('Almost got caught by police!');
          updateStats({ reputation: gameState.stats.reputation - 5 });
        }
        const robberyChance = 0.1 / job.rank;
        if (Math.random() < robberyChance) {
          const lossPercent = 0.15 + Math.random() * 0.1;
          moneyLost = Math.floor(gameState.stats.money * lossPercent);
          events.push(`Got robbed while scamming! Lost $${moneyLost}`);
        }
      }
    } else {
      success = Math.random() * 100 < successRate;
      if (success) {
        const rankMultiplier = 1 + (job.rank - 1) * 0.3;
        moneyGained = Math.floor(job.basePayment * rankMultiplier);
        events.push(`Earned $${moneyGained} from ${job.name}`);
      } else {
        events.push(`${job.name} failed - no earnings`);
      }

      if (job.id === 'beg' && success && Math.random() < 0.05) {
        moneyGained = Math.max(0, moneyGained - 20);
        events.push('Got robbed! Lost $20');
      }

      if (job.id === 'dumpster' && Math.random() < 0.02) {
        const items = ['guitar', 'bike', 'smartphone'];
        const foundItem = items[Math.floor(Math.random() * items.length)];
        const item = gameState.items.find(i => i.id === foundItem);
        if (item && !item.owned) {
          setGameState(prev => ({
            ...prev,
            items: prev.items.map(i =>
              i.id === foundItem ? { ...i, owned: true } : i
            ),
          }));
          events.push(`Found a ${item.name}!`);
        }
      }
    }

    const progressGain = Math.floor(Math.random() * 8) + 5; // 5-12%
    setGameState(prev => ({
      ...prev,
      streetJobs: prev.streetJobs.map(j => {
        if (j.id === jobId) {
          const newProgress = j.progress + progressGain;
          const newRank = newProgress >= 100 ? j.rank + 1 : j.rank;
          return {
            ...j,
            progress: newProgress >= 100 ? newProgress - 100 : newProgress,
            rank: newRank,
          };
        }
        return j;
      }),
      streetJobsCompleted: prev.streetJobsCompleted + 1,
    }));

    updateStats({
      money: gameState.stats.money + moneyGained - moneyLost,
      energy: gameState.stats.energy - job.energyCost,
      happiness: Math.max(0, gameState.stats.happiness - 3),
      health: Math.max(0, gameState.stats.health - 1),
    });

    if (job.illegal) {
      gainCriminalXp(10);
    }

    if (job.skill) {
      gainCrimeSkillXp(job.skill, success ? 15 : 5);
    }

    let message;
    if (caught) {
      message = `Caught! Jailed for ${job.jailWeeks} weeks.`;
    } else if (success) {
      message = job.illegal
        ? `Crime succeeded! Gained $${moneyGained}`
        : `Earned $${moneyGained}!`;
    } else {
      message = job.illegal
        ? 'Crime failed. Wanted level increased.'
        : 'No luck this time';
    }
    if (moneyLost > 0 && moneyGained > 0) {
      message = `Earned $${moneyGained} but robbed of $${moneyLost}`;
    } else if (moneyLost > 0 && !caught) {
      message = `Robbed! Lost $${moneyLost}`;
    }

    return {
      success,
      message,
      events,
    };
  };

  const applyForJob = (jobId: string) => {
    // Prevent multiple job applications or working while applying
    const hasJob = !!gameState.currentJob;
    const hasPendingApplication = gameState.careers.some(
      c => c.applied && !c.accepted
    );
    if (hasJob || hasPendingApplication) {
      Alert.alert(
        'Job Application',
        'You must quit your current job before applying for another.'
      );
      return;
    }

    const career = gameState.careers.find(c => c.id === jobId);
    if (!career) return;

    const meetsFitness =
      !career.requirements.fitness ||
      gameState.stats.fitness >= career.requirements.fitness;
    const hasItems =
      !career.requirements.items ||
      career.requirements.items.every(itemId =>
        gameState.items.find(item => item.id === itemId)?.owned
      );
    const hasEducation =
      !career.requirements.education ||
      career.requirements.education.every(educationId =>
        gameState.educations.find(e => e.id === educationId)?.completed
      );
    if (!meetsFitness || !hasItems || !hasEducation) return;

    setGameState(prev => ({
      ...prev,
      careers: prev.careers.map(c =>
        c.id === jobId ? { ...c, applied: false, accepted: true } : c
      ),
      currentJob: jobId,
    }));

    setTimeout(() => checkAchievements(), 0);
  };

  const quitJob = () => {
    if (!gameState.currentJob) return;
    const jobId = gameState.currentJob;

    setGameState(prev => ({
      ...prev,
      currentJob: undefined,
      careers: prev.careers.map(career =>
        career.id === jobId
          ? { ...career, applied: false, accepted: false }
          : career
      ),
    }));
  };

  const maybeOfferSponsor = (hobbyId: string) => {
    const hobby = gameState.hobbies.find(h => h.id === hobbyId);
    if (!hobby) return;
    const upgrade = hobby.upgrades.find(u => u.id === 'sponsorship' || u.id === 'endorsement');
    if (!upgrade || upgrade.level === 0) return;
    const max = hobby.maxSponsors || 1;
    if ((hobby.sponsors?.length || 0) >= max) return;
    const chance = 0.05 + upgrade.level * 0.05;
    if (Math.random() > chance) return;
    const brands = ['Nyke', 'Adidaz', 'Pooma', 'Reebock', 'Under Amr'];
    const brand = brands[Math.floor(Math.random() * brands.length)];
    const weeks = 10 + Math.floor(Math.random() * 11);
    const payBase = 50 + hobby.skillLevel * 20;
    const pay = Math.round(payBase * (1 + upgrade.level * 0.05));
    Alert.alert(
      'Sponsor Offer',
      `${brand} offers $${pay}/week for ${weeks} weeks. Accept?`,
      [
        { text: 'Decline', style: 'cancel' },
        {
          text: 'Accept',
          onPress: () =>
            setGameState(prev => ({
              ...prev,
              hobbies: prev.hobbies.map(h =>
                h.id === hobbyId
                  ? {
                      ...h,
                      sponsors: [
                        ...(h.sponsors || []),
                        { id: uuidv4(), name: brand, weeklyPay: pay, weeksRemaining: weeks },
                      ],
                    }
                  : h
              ),
            })),
        },
      ]
    );
  };

  const trainHobby: GameContextType['trainHobby'] = hobbyId => {
    const hobby = gameState.hobbies.find(h => h.id === hobbyId);
    if (!hobby) return;
    if (gameState.stats.energy < hobby.energyCost) {
      return { success: false, message: 'Not enough energy' };
    }

    updateStats({
      energy: gameState.stats.energy - hobby.energyCost,
      health: gameState.stats.health - 8,
      happiness: gameState.stats.happiness - 3,
    });

    const skillBonus = hobby.upgrades
      .reduce((sum, u) => sum + (u.skillBonusPerLevel || 0) * u.level, 0);
    const gain = Math.floor(Math.random() * 6) + 5 + skillBonus; // base 5-10 skill
    setGameState(prev => ({
      ...prev,
      hobbies: prev.hobbies.map(h => {
        if (h.id !== hobbyId) return h;
        const total = h.skill + gain;
        const levelUps = Math.floor(total / 100);
        return {
          ...h,
          skill: total % 100,
          skillLevel: h.skillLevel + levelUps,
        };
      }),
    }));

    maybeOfferSponsor(hobbyId);

    return { success: true, message: `Trained ${hobby.name}!` };
  };

  const enterHobbyTournament: GameContextType['enterHobbyTournament'] = hobbyId => {
    const hobby = gameState.hobbies.find(h => h.id === hobbyId);
    if (!hobby) return;
    if (gameState.stats.energy < hobby.energyCost) {
      return { success: false, message: 'Not enough energy' };
    }
    updateStats({
      energy: gameState.stats.energy - hobby.energyCost,
      health: gameState.stats.health - 10,
      happiness: gameState.stats.happiness - 5,
    });
    const effectiveSkill = (hobby.skillLevel - 1) * 20 + hobby.skill;
    if (effectiveSkill < 50) {
      return { success: false, message: 'Skill too low for tournament' };
    }
    const successChance = effectiveSkill / 100;
    const success = Math.random() < successChance;
    const rewardBonus = hobby.upgrades
      .reduce((sum, u) => sum + (u.rewardBonusPerLevel || 0) * u.level, 0);
    const reward = Math.round(hobby.tournamentReward * (1 + rewardBonus));
    if (success) {
      updateStats({
        money: gameState.stats.money + reward,
        reputation: gameState.stats.reputation + 2,
      });
      return {
        success: true,
        message: `Won ${hobby.name} tournament! Earned $${reward}`,
      };
    } else {
      updateStats({ happiness: gameState.stats.happiness - 5 });
      return { success: false, message: `Lost the ${hobby.name} tournament` };
    }
  };

  const uploadSong: GameContextType['uploadSong'] = hobbyId => {
    const hobby = gameState.hobbies.find(h => h.id === hobbyId);
    if (!hobby || hobby.id !== 'music') return;
    const cost = hobby.energyCost + 10;
    if (gameState.stats.energy < cost) {
      return { success: false, message: 'Not enough energy' };
    }

    updateStats({
      energy: gameState.stats.energy - cost,
      health: gameState.stats.health - 7,
      happiness: gameState.stats.happiness - 2,
    });

    const effectiveSkill = (hobby.skillLevel - 1) * 20 + hobby.skill;
    const roll = Math.random() * 100 + effectiveSkill * 0.5;
    let grade: Song['grade'];
    let income: number;
    if (roll < 40) {
      grade = 'Terrible Song';
      income = 5;
    } else if (roll < 70) {
      grade = 'Bad Song';
      income = 10;
    } else if (roll < 90) {
      grade = 'Normal';
      income = 20;
    } else if (roll < 110) {
      grade = 'Good';
      income = 40;
    } else if (roll < 130) {
      grade = 'Great';
      income = 80;
    } else {
      grade = 'Incredible';
      income = 150;
    }

    const incomeBonus = hobby.upgrades
      .reduce((sum, u) => sum + (u.incomeBonusPerLevel || 0) * u.level, 0);
    const finalIncome = Math.round(income * (1 + incomeBonus));
    const song: Song = {
      id: `song-${Date.now()}`,
      grade,
      weeklyIncome: finalIncome,
    };

    setGameState(prev => ({
      ...prev,
      hobbies: prev.hobbies.map(h =>
        h.id === hobbyId
          ? { ...h, songs: [...(h.songs || []), song] }
          : h
      ),
    }));

    maybeOfferSponsor(hobbyId);

    return { success: true, message: `Uploaded ${grade}! Earns $${finalIncome}/week` };
  };

  const uploadArtwork: GameContextType['uploadArtwork'] = hobbyId => {
    const hobby = gameState.hobbies.find(h => h.id === hobbyId);
    if (!hobby || hobby.id !== 'art') return;
    const cost = hobby.energyCost + 10;
    if (gameState.stats.energy < cost) {
      return { success: false, message: 'Not enough energy' };
    }

    updateStats({
      energy: gameState.stats.energy - cost,
      health: gameState.stats.health - 7,
      happiness: gameState.stats.happiness - 2,
    });

    const effectiveSkill = (hobby.skillLevel - 1) * 20 + hobby.skill;
    const roll = Math.random() * 100 + effectiveSkill * 0.5;
    let grade: Artwork['grade'];
    let income: number;
    if (roll < 40) {
      grade = 'Terrible Art';
      income = 5;
    } else if (roll < 70) {
      grade = 'Bad Art';
      income = 10;
    } else if (roll < 90) {
      grade = 'Normal';
      income = 20;
    } else if (roll < 110) {
      grade = 'Good';
      income = 40;
    } else if (roll < 130) {
      grade = 'Great';
      income = 80;
    } else {
      grade = 'Incredible';
      income = 150;
    }

    const incomeBonus = hobby.upgrades
      .reduce((sum, u) => sum + (u.incomeBonusPerLevel || 0) * u.level, 0);
    const finalIncome = Math.round(income * (1 + incomeBonus));
    const artwork: Artwork = {
      id: `art-${Date.now()}`,
      grade,
      weeklyIncome: finalIncome,
    };

    setGameState(prev => ({
      ...prev,
      hobbies: prev.hobbies.map(h =>
        h.id === hobbyId
          ? { ...h, artworks: [...(h.artworks || []), artwork] }
          : h
      ),
    }));

    maybeOfferSponsor(hobbyId);

    return { success: true, message: `Created ${grade}! Earns $${finalIncome}/week` };
  };
  const acceptContract: GameContextType['acceptContract'] = (hobbyId, offer) => {
    if (gameState.hobbies.some(h => h.contracts && h.contracts.length > 0)) {
      return { success: false, message: 'Already contracted in another sport' };
    }
    const hobby = gameState.hobbies.find(h => h.id === hobbyId);
    if (!hobby) return;
    const cost = hobby.energyCost + 10;
    if (gameState.stats.energy < cost) {
      return { success: false, message: 'Not enough energy' };
    }

    updateStats({
      energy: gameState.stats.energy - cost,
      health: gameState.stats.health - 7,
      happiness: gameState.stats.happiness - 2,
    });

    const league: League = {
      division: offer.division,
      standings: hobby.divisions![offer.division].teams.map(team => ({
        team: team.name,
        points: 0,
        played: 0,
      })),
      matchesPlayed: 0,
    };

    const contract: Contract = { ...offer };

    setGameState(prev => ({
      ...prev,
      hobbies: prev.hobbies.map(h =>
        h.id === hobbyId
          ? { ...h, team: offer.team, contracts: [contract], league }
          : h
      ),
    }));

    return {
      success: true,
      message: `Signed contract with ${offer.team} for $${offer.matchPay}/match`,
    };
  };

  const extendContract: GameContextType['extendContract'] = hobbyId => {
    const hobby = gameState.hobbies.find(h => h.id === hobbyId);
    if (!hobby || !hobby.contracts || hobby.contracts.length === 0) return;
    const contract = hobby.contracts[0];
    const extraWeeks = 30 + Math.floor(Math.random() * 39);
    const multipliers = [2, 1.5, 1];
    const effectiveSkill = (hobby.skillLevel - 1) * 20 + hobby.skill;
    const basePay = 20 + effectiveSkill * 2;
    const matchPay = Math.round(basePay * multipliers[contract.division]);
    const updated: Contract = {
      ...contract,
      weeksRemaining: contract.weeksRemaining + extraWeeks,
      totalWeeks: contract.totalWeeks + extraWeeks,
      matchPay,
    };
    setGameState(prev => ({
      ...prev,
      hobbies: prev.hobbies.map(h =>
        h.id === hobbyId ? { ...h, contracts: [updated] } : h
      ),
    }));
    return { success: true, message: `Contract extended by ${extraWeeks} weeks` };
  };

  const cancelContract: GameContextType['cancelContract'] = hobbyId => {
    setGameState(prev => ({
      ...prev,
      hobbies: prev.hobbies.map(h =>
        h.id === hobbyId ? { ...h, contracts: [], team: undefined, league: undefined } : h
      ),
    }));
  };

  const playMatch: GameContextType['playMatch'] = hobbyId => {
    const hobby = gameState.hobbies.find(h => h.id === hobbyId);
    if (!hobby || !hobby.contracts || hobby.contracts.length === 0 || !hobby.league) return;
    const contract = hobby.contracts[0];
    const cost = hobby.energyCost + 5;
    if (gameState.stats.energy < cost) {
      return { success: false, message: 'Not enough energy' };
    }

    updateStats({
      energy: gameState.stats.energy - cost,
      health: gameState.stats.health - 5,
      happiness: gameState.stats.happiness - 3,
    });

    const league = hobby.league;
    const opponents = league.standings.filter(t => t.team !== contract.team);
    const opponent = opponents[Math.floor(Math.random() * opponents.length)];
    const effectiveSkill = (hobby.skillLevel - 1) * 20 + hobby.skill;
    const playerRoll = Math.random() * effectiveSkill;
    const opponentRoll = Math.random() * 100;
    let result: 'win' | 'draw' | 'loss' = 'loss';
    if (playerRoll > opponentRoll + 10) result = 'win';
    else if (Math.abs(playerRoll - opponentRoll) <= 10) result = 'draw';

    const playerTeam = league.standings.find(t => t.team === contract.team)!;
    const oppTeam = league.standings.find(t => t.team === opponent.team)!;
    playerTeam.played += 1;
    oppTeam.played += 1;
    if (result === 'win') playerTeam.points += 3;
    else if (result === 'draw') {
      playerTeam.points += 1;
      oppTeam.points += 1;
    } else {
      oppTeam.points += 3;
    }

    league.standings.forEach(t => {
      if (t.team !== playerTeam.team && t.team !== oppTeam.team) {
        t.played += 1;
        const rnd = Math.random();
        if (rnd < 0.33) t.points += 3;
        else if (rnd < 0.66) t.points += 1;
      }
    });

    league.matchesPlayed += 1;
    updateStats({ money: gameState.stats.money + contract.matchPay });
    contract.weeksRemaining -= 1;
    if (contract.weeksRemaining <= 0) {
      const final = [...league.standings].sort((a, b) => b.points - a.points);
      const position = final.findIndex(t => t.team === contract.team);
      const division = league.division;
      const prizes = [20000, 10000, 4000];
      if (position > -1 && position <= 2) {
        updateStats({ money: gameState.stats.money + prizes[division] });
      }
      const divisions = hobby.divisions!;
      if (division > 0) {
        const promoted = final.slice(0, 3).map(t => t.team);
        divisions[division].teams = divisions[division].teams.filter(
          t => !promoted.includes(t.name)
        );
        promoted.forEach(teamName => {
          divisions[division - 1].teams.push({
            name: teamName,
            goal: divisions[division - 1].teams.length + 1,
          });
        });
      }
      if (division < 2) {
        const demoted = final.slice(-3).map(t => t.team);
        divisions[division].teams = divisions[division].teams.filter(
          t => !demoted.includes(t.name)
        );
        demoted.forEach(teamName => {
          divisions[division + 1].teams.push({
            name: teamName,
            goal: divisions[division + 1].teams.length + 1,
          });
        });
      }
      cancelContract(hobbyId);
    }

    maybeOfferSponsor(hobbyId);

    return {
      success: true,
      message:
        result === 'win'
          ? `Won against ${opponent.team}`
          : result === 'draw'
          ? `Drew with ${opponent.team}`
          : `Lost to ${opponent.team}`,
    };
  };

  const dive: GameContextType['dive'] = hobbyId => {
    const hobby = gameState.hobbies.find(h => h.id === hobbyId);
    if (!hobby || hobby.id !== 'football') return;
    if (gameState.stats.energy < 5) {
      return { success: false, message: 'Not enough energy' };
    }
    updateStats({
      energy: gameState.stats.energy - 5,
      reputation: gameState.stats.reputation - 1,
    });
    return { success: true, message: 'Tried to dive, lost some reputation.' };
  };


  const buyHobbyUpgrade: GameContextType['buyHobbyUpgrade'] = (hobbyId, upgradeId) => {
    const hobby = gameState.hobbies.find(h => h.id === hobbyId);
    if (!hobby) return;
    const upgrade = hobby.upgrades.find(u => u.id === upgradeId);
    if (!upgrade || upgrade.level >= upgrade.maxLevel || gameState.stats.money < upgrade.cost) return;

    updateStats({ money: gameState.stats.money - upgrade.cost });
    setGameState(prev => ({
      ...prev,
      hobbies: prev.hobbies.map(h =>
        h.id === hobbyId
          ? {
              ...h,
              maxSponsors:
                upgrade.slotIncreasePerLevel
                  ? (h.maxSponsors || 1) + upgrade.slotIncreasePerLevel
                  : h.maxSponsors,
              upgrades: h.upgrades.map(u =>
                u.id === upgradeId ? { ...u, level: u.level + 1 } : u
              ),
            }
          : h
      ),
    }));
  };

  const buyItem = (itemId: string) => {
    try {
      const item = gameState.items?.find(i => i.id === itemId);
      if (!item) return;
      const price = getInflatedPrice(
        item.price,
        gameState.economy?.priceIndex ?? 1
      );
      
      if (item.owned) return;
      
      if (gameState.stats.money < price) {
        Alert.alert(
          'Insufficient Funds', 
          `You need $${price.toLocaleString()} to buy ${item.name}. You currently have $${gameState.stats.money.toLocaleString()}.`
        );
        return;
      }

      const updatedState: GameState = {
        ...gameState,
        items: gameState.items.map(i => (i.id === itemId ? { ...i, owned: true } : i)),
        hasPhone: itemId === 'smartphone' ? true : gameState.hasPhone,
        stats: {
          ...gameState.stats,
          money: Math.max(0, gameState.stats.money - price),
        },
      };

      setGameState(updatedState);
      checkAchievements(updatedState);
    } catch (error) {
      console.error('Error buying item:', error);
    }
  };

  const sellItem = (itemId: string) => {
    const item = gameState.items.find(i => i.id === itemId);
    if (!item || !item.owned) return;
    const price = getInflatedPrice(item.price, gameState.economy.priceIndex);
    const sellPrice = price * 0.5;

    setGameState(prev => ({
      ...prev,
      items: prev.items.map(i => (i.id === itemId ? { ...i, owned: false } : i)),
    }));

    updateStats({ money: gameState.stats.money + sellPrice });
  };

  const buyDarkWebItem = (itemId: string) => {
    const item = gameState.darkWebItems.find(i => i.id === itemId);
    const btc = gameState.cryptos.find(c => c.id === 'btc');
    
    if (!item || item.owned || !btc) return;
    
    if (btc.owned < item.costBtc) {
      Alert.alert(
        'Insufficient BTC', 
        `You need ${item.costBtc} BTC to buy ${item.name}. You currently have ${btc.owned.toFixed(6)} BTC.`
      );
      return;
    }

    setGameState(prev => ({
      ...prev,
      darkWebItems: prev.darkWebItems.map(i =>
        i.id === itemId ? { ...i, owned: true } : i
      ),
      cryptos: prev.cryptos.map(c =>
        c.id === 'btc' ? { ...c, owned: c.owned - item.costBtc } : c
      ),
    }));
  };

  const buyHack = (hackId: string) => {
    const hack = gameState.hacks.find(h => h.id === hackId);
    const btc = gameState.cryptos.find(c => c.id === 'btc');
    
    if (!hack || hack.purchased || !btc) return;
    
    if (btc.owned < hack.costBtc) {
      Alert.alert(
        'Insufficient BTC', 
        `You need ${hack.costBtc} BTC to buy ${hack.name}. You currently have ${btc.owned.toFixed(6)} BTC.`
      );
      return;
    }

    setGameState(prev => ({
      ...prev,
      hacks: prev.hacks.map(h =>
        h.id === hackId ? { ...h, purchased: true } : h
      ),
      cryptos: prev.cryptos.map(c =>
        c.id === 'btc' ? { ...c, owned: c.owned - hack.costBtc } : c
      ),
    }));
  };

  const performHack = (hackId: string): HackResult => {
    const hack = gameState.hacks.find(h => h.id === hackId);
    if (!hack || !hack.purchased)
      return { caught: false, reward: 0, btcReward: 0, risk: 0 };

    const energyCost = hack.energyCost || 0;
    if (gameState.stats.energy < energyCost) {
      return { caught: false, reward: 0, btcReward: 0, risk: 0 };
    }

    updateStats({ energy: gameState.stats.energy - energyCost });

    const ownedItems = gameState.darkWebItems.filter(i => i.owned);
    const totalRiskReduction = ownedItems.reduce(
      (sum, i) => sum + (i.riskReduction || 0),
      0
    );
    const totalRewardBonus = ownedItems.reduce(
      (sum, i) => sum + (i.rewardBonus || 0),
      0
    );

    const risk = Math.max(0, hack.risk - totalRiskReduction);
    const reward = hack.reward * (1 + totalRewardBonus);
    const btc = gameState.cryptos.find(c => c.id === 'btc');
    const btcReward = btc ? reward / btc.price : 0;

    const caught = Math.random() < risk;
    if (caught) {
      updateStats({
        money: Math.max(0, gameState.stats.money - 500),
        reputation: Math.max(0, gameState.stats.reputation - 5),
      });
      
      // Increase wanted level for getting caught hacking
      setGameState(prev => ({
        ...prev,
        wantedLevel: prev.wantedLevel + 2,
      }));
      
      // Check for immediate arrest
      const currentWantedLevel = gameState.wantedLevel + 2;
      const arrestChance = currentWantedLevel * 0.2; // 20% per wanted level for hacking
      
      if (Math.random() < arrestChance) {
        setGameState(prev => ({
          ...prev,
          jailWeeks: 4,
          wantedLevel: 0,
        }));
        return { caught: true, reward: 0, btcReward: 0, risk, jailed: true };
      }
      
      return { caught: true, reward: 0, btcReward: 0, risk };
    }

    setGameState(prev => ({
      ...prev,
      cryptos: prev.cryptos.map(c =>
        c.id === 'btc' ? { ...c, owned: c.owned + btcReward } : c
      ),
    }));

    return { caught: false, reward, btcReward, risk };
  };

  const serveJailTime = () => {
    return {
      events: [`Served time in jail. ${Math.max(0, gameState.jailWeeks - 1)} weeks remaining.`],
      statsChange: { happiness: -20, health: -10 },
    };
  };

  const performJailActivity: GameContextType['performJailActivity'] = activityId => {
    if (gameState.jailWeeks === 0)
      return { success: false, message: 'Not currently jailed' };
    const activity = gameState.jailActivities.find(a => a.id === activityId);
    if (!activity) return { success: false, message: 'Invalid activity' };

    if (gameState.stats.energy < activity.energyCost)
      return { success: false, message: 'Not enough energy' };

    // Check for cost requirements
    if (activity.cost && gameState.stats.money < activity.cost)
      return { success: false, message: `Not enough money. Cost: $${activity.cost}` };

    // Check for education requirements
    if (activity.requiresEducation) {
      const hasEducation = gameState.educations.find(e => e.id === activity.requiresEducation)?.completed;
      if (!hasEducation)
        return { success: false, message: `Requires ${activity.requiresEducation.replace('_', ' ')} education` };
    }

    updateStats({ energy: gameState.stats.energy - activity.energyCost });

    let result: { success: boolean; message: string } = {
      success: false,
      message: 'Unknown activity',
    };

    switch (activity.id) {
      case 'prison_job':
        updateStats({
          money: gameState.stats.money + (activity.payment || 25),
          happiness: gameState.stats.happiness + 5,
        });
        if (activity.sentenceReduction) {
          setGameState(prev => ({
            ...prev,
            jailWeeks: Math.max(0, prev.jailWeeks - (activity.sentenceReduction || 0)),
          }));
        }
        result = {
          success: true,
          message: `💼 You worked a prison job and earned $${activity.payment || 25}. Sentence reduced by ${activity.sentenceReduction || 1} week(s).`,
        };
        break;

      case 'train_strength':
        updateStats({
          fitness: gameState.stats.fitness + (activity.fitnessGain || 2),
          health: gameState.stats.health + (activity.healthGain || 5),
          happiness: gameState.stats.happiness + (activity.happinessGain || -2),
        });
        result = {
          success: true,
          message: '💪 You trained and feel stronger. Fitness and health improved!',
        };
        break;

      case 'library_study':
        updateStats({
          happiness: gameState.stats.happiness + (activity.happinessGain || 8),
          reputation: gameState.stats.reputation + (activity.reputationGain || 2),
        });
        result = {
          success: true,
          message: '📚 You studied and feel more educated. Happiness and reputation improved!',
        };
        break;

      case 'prison_garden':
        updateStats({
          money: gameState.stats.money + (activity.payment || 15),
          health: gameState.stats.health + (activity.healthGain || 3),
          happiness: gameState.stats.happiness + (activity.happinessGain || 5),
        });
        result = {
          success: true,
          message: `🌱 You worked in the garden and earned $${activity.payment || 15}. Health and happiness improved!`,
        };
        break;

      case 'prison_workshop':
        updateStats({
          money: gameState.stats.money + (activity.payment || 40),
        });
        if (activity.sentenceReduction) {
          setGameState(prev => ({
            ...prev,
            jailWeeks: Math.max(0, prev.jailWeeks - (activity.sentenceReduction || 0)),
          }));
        }
        result = {
          success: true,
          message: `🔧 You learned a trade and earned $${activity.payment || 40}. Sentence reduced by ${activity.sentenceReduction || 1} week(s).`,
        };
        break;

      case 'attempt_escape':
        const escapeSuccess = Math.random() < (activity.successRate || 0.05);
        if (escapeSuccess) {
          updateStats({ happiness: gameState.stats.happiness + 20 });
          setGameState(prev => ({
            ...prev,
            jailWeeks: 0,
            wantedLevel: prev.wantedLevel + 3,
            escapedFromJail: true,
          }));
          result = { success: true, message: '🎉 MIRACLE! You successfully escaped! But you\'re now wanted more than ever.' };
        } else {
          updateStats({
            happiness: gameState.stats.happiness - 25,
            health: gameState.stats.health - 15,
          });
          const penalty = (activity.failurePenalty || 8) + Math.floor(Math.random() * 4);
          
          // Small chance to get even more jail time (10% chance)
          const extraTime = Math.random() < 0.1 ? Math.floor(Math.random() * 5) + 2 : 0;
          const totalPenalty = penalty + extraTime;
          
          setGameState(prev => ({
            ...prev,
            jailWeeks: prev.jailWeeks + totalPenalty,
          }));
          
          let message = `❌ Escape failed! You were caught and your sentence was extended by ${penalty} weeks.`;
          if (extraTime > 0) {
            message += `\n\n🚨 EXTRA PUNISHMENT: The guards found evidence of your escape attempt and added ${extraTime} more weeks!`;
          }
          
          result = {
            success: false,
            message: message,
          };
        }
        break;

      case 'bribe_guard':
        const bribeSuccess = Math.random() < (activity.successRate || 0.6);
        if (bribeSuccess) {
          updateStats({ money: gameState.stats.money - (activity.cost || 1000) });
          setGameState(prev => ({
            ...prev,
            jailWeeks: 0,
            wantedLevel: prev.wantedLevel + 1,
          }));
          result = { success: true, message: '💰 The guard accepted your bribe. You are free! But your wanted level increased.' };
        } else {
          updateStats({ money: gameState.stats.money - (activity.cost || 1000) });
          result = { success: false, message: 'The guard refused your bribe and kept the money.' };
        }
        break;

      case 'legal_appeal':
        const appealSuccess = Math.random() < (activity.successRate || 0.4);
        if (appealSuccess) {
          updateStats({ money: gameState.stats.money - (activity.cost || 500) });
          setGameState(prev => ({
            ...prev,
            jailWeeks: 0,
          }));
          result = { success: true, message: 'Your legal appeal was successful!' };
        } else {
          updateStats({ money: gameState.stats.money - (activity.cost || 500) });
          result = { success: false, message: 'Your legal appeal was denied.' };
        }
        break;

      case 'good_behavior':
        updateStats({
          happiness: gameState.stats.happiness + (activity.happinessGain || 10),
        });
        if (activity.sentenceReduction) {
          setGameState(prev => ({
            ...prev,
            jailWeeks: Math.max(0, prev.jailWeeks - (activity.sentenceReduction || 0)),
          }));
        }
        result = {
          success: true,
          message: 'Your good behavior was noted by the guards.',
        };
        break;

      case 'prison_gang':
        const gangSuccess = Math.random() < (activity.successRate || 0.7);
        if (gangSuccess) {
          updateStats({
            reputation: gameState.stats.reputation + (activity.reputationGain || 5),
          });
          setGameState(prev => ({
            ...prev,
            criminalXp: prev.criminalXp + (activity.criminalXpGain || 10),
          }));
          result = { success: true, message: '👥 You successfully joined a prison gang and gained respect among inmates.' };
        } else {
          updateStats({
            health: gameState.stats.health - 15,
            happiness: gameState.stats.happiness - 10,
          });
          
          // Small chance to get more jail time for gang violence (5% chance)
          const extraTime = Math.random() < 0.05 ? Math.floor(Math.random() * 3) + 1 : 0;
          if (extraTime > 0) {
            setGameState(prev => ({
              ...prev,
              jailWeeks: prev.jailWeeks + extraTime,
            }));
            result = { 
              success: false, 
              message: `💥 Gang initiation failed! You got into a fight and lost. The guards added ${extraTime} week(s) to your sentence for violence.` 
            };
          } else {
            result = { 
              success: false, 
              message: '💥 Gang initiation failed! You got into a fight and lost.' 
            };
          }
        }
        break;
    }

    setTimeout(() => checkAchievements(), 100);
    saveGame();
    return result;
  };

  const payBail = () => {
    if (gameState.jailWeeks === 0)
      return { success: false, message: 'Not currently jailed' };
    const cost = gameState.jailWeeks * 500;
    if (gameState.stats.money < cost)
      return { success: false, message: `Bail costs $${cost}` };
    updateStats({ money: gameState.stats.money - cost });
    setGameState(prev => ({ ...prev, jailWeeks: 0, wantedLevel: 0 }));
    return { success: true, message: `Paid $${cost} bail and released.` };
  };

  const buyFood = (foodId: string) => {
    const food = gameState.foods.find(f => f.id === foodId);
    if (!food) return;
    const price = getInflatedPrice(food.price, gameState.economy.priceIndex);
    
    if (gameState.stats.money < price) {
      Alert.alert(
        'Insufficient Funds', 
        `You need $${price.toLocaleString()} to buy ${food.name}. You currently have $${gameState.stats.money.toLocaleString()}.`
      );
      return;
    }

    updateStats({
      money: gameState.stats.money - price,
      health: Math.min(100, gameState.stats.health + food.healthRestore),
      energy: Math.min(100, gameState.stats.energy + food.energyRestore),
    });
  };

  const performHealthActivity: GameContextType['performHealthActivity'] = activityId => {
    const activity = gameState.healthActivities.find(a => a.id === activityId);
    if (!activity) return;
    const price = getInflatedPrice(activity.price, gameState.economy.priceIndex);
    if (gameState.stats.money < price) return;

    const energyCost = activity.energyCost || 0;
    if (gameState.stats.energy < energyCost) return;

    updateStats({
      money: gameState.stats.money - price,
      happiness: Math.min(100, gameState.stats.happiness + activity.happinessGain),
      health: Math.min(100, gameState.stats.health + (activity.healthGain || 0)),
      energy: Math.max(0, gameState.stats.energy - energyCost - 5),
    });

    let message: string | undefined;

    if (activity.id === 'doctor') {
      if (gameState.diseases.length > 0) {
        if (Math.random() < 0.5) {
          const remaining = gameState.diseases.filter(d => !d.curable);
          setGameState(prev => ({ ...prev, diseases: remaining }));
          message = 'The doctor cured all your treatable health issues!';
        } else {
          message = 'The doctor could not cure your conditions.';
        }
      }
    } else if (activity.id === 'hospital') {
      if (gameState.diseases.length > 0) {
        const remaining = gameState.diseases.filter(d => !d.curable);
        if (remaining.length < gameState.diseases.length) {
          setGameState(prev => ({ ...prev, diseases: remaining }));
          message = 'All your treatable health issues have been cured!';
        } else {
          message = 'There were no treatable conditions to cure.';
        }
      }
    }

    return message ? { message } : undefined;
  };

  const toggleDietPlan = (planId: string) => {
    setGameState(prev => ({
      ...prev,
      dietPlans: prev.dietPlans.map(plan => ({
        ...plan,
        active: plan.id === planId ? !plan.active : false,
      })),
    }));
    saveGame();
  };

  const breakUpWithPartner = (partnerId: string) => {
    setGameState(prev => {
      const family = { ...prev.family };
      if (family.spouse && family.spouse.id === partnerId) {
        family.spouse = undefined;
      }
      return {
        ...prev,
        relationships: prev.relationships.filter(rel => rel.id !== partnerId),
        family,
      };
    });
    return { success: true, message: 'You ended the relationship.' };
  };

  const proposeToPartner = (partnerId: string) => {
    const partner = gameState.relationships.find(rel => rel.id === partnerId);
    if (!partner || partner.type !== 'partner') return { success: false, message: 'Invalid partner.' };

    const cost = 5000;
    if (gameState.stats.money < cost) {
      return { success: false, message: 'You need $5,000 for an engagement ring!' };
    }

    const successChance = partner.relationshipScore;
    const success = Math.random() * 100 < successChance;

    updateStats({ money: gameState.stats.money - cost });

    if (success) {
      const spouse: Relationship = {
        ...partner,
        type: 'spouse',
        relationshipScore: Math.min(100, partner.relationshipScore + 20),
        familyHappiness: partner.familyHappiness ?? 5,
        expenses: partner.expenses ?? 100,
      };
      setGameState(prev => ({
        ...prev,
        relationships: prev.relationships.map(rel =>
          rel.id === partnerId ? spouse : rel
        ),
        family: { ...prev.family, spouse },
      }));
      return { success: true, message: `${partner.name} said yes! You're now engaged!` };
    } else {
      setGameState(prev => ({
        ...prev,
        relationships: prev.relationships.filter(rel => rel.id !== partnerId),
      }));
      return { success: false, message: `${partner.name} said no and left you...` };
    }
  };

  const moveInTogether = (partnerId: string) => {
    const partner = gameState.relationships.find(rel => rel.id === partnerId);
    if (!partner) return { success: false, message: 'Partner not found.' };

    const hasHome = gameState.realEstate && gameState.realEstate.length > 0;
    if (!hasHome) {
      return { success: false, message: 'You need to own a home first!' };
    }

    const successChance = partner.relationshipScore * 0.8;
    const success = Math.random() * 100 < successChance;

    if (success) {
      setGameState(prev => ({
        ...prev,
        relationships: prev.relationships.map(rel =>
          rel.id === partnerId ? { ...rel, livingTogether: true, relationshipScore: Math.min(100, rel.relationshipScore + 15) } : rel
        ),
      }));
      return { success: true, message: `${partner.name} moved in with you! Daily happiness +5` };
    } else {
      return { success: false, message: `${partner.name} isn't ready to move in together yet.` };
    }
  };

  const haveChild = (partnerId: string) => {
    const partner = gameState.relationships.find(rel => rel.id === partnerId);
    if (!partner || partner.type !== 'spouse') {
      return { success: false, message: 'You need to be married to have a child.' };
    }

    const cost = 10000;
    if (gameState.stats.money < cost) {
      return { success: false, message: 'You need $10,000 for hospital costs!' };
    }

    updateStats({ money: gameState.stats.money - cost });

    const success = Math.random() < 0.1;
    if (!success) {
      return { success: false, message: `${partner.name} and you were unable to conceive. Try again later.` };
    }

    const childNames = ['Emma', 'Liam', 'Olivia', 'Noah', 'Ava', 'Ethan', 'Sophia', 'Mason'];
    const childName = childNames[Math.floor(Math.random() * childNames.length)];

    const child: Relationship = {
      id: `child_${Date.now()}`,
      name: childName,
      type: 'child',
      relationshipScore: 100,
      personality: 'innocent',
      gender: 'female',
      age: 0,
      familyHappiness: 3,
      expenses: 50,
    };

    addRelationship(child);

    setGameState(prev => ({
      ...prev,
      relationships: prev.relationships.map(rel =>
        rel.id === partnerId ? { ...rel, relationshipScore: Math.min(100, rel.relationshipScore + 25) } : rel
      ),
    }));

    return { success: true, message: `Congratulations! ${childName} was born!` };
  };

  const updateRelationship = (relationshipId: string, change: number) => {
    setGameState(prev => ({
      ...prev,
      relationships: prev.relationships.map(rel =>
        rel.id === relationshipId
          ? { ...rel, relationshipScore: Math.max(0, Math.min(100, rel.relationshipScore + change)) }
          : rel
      ),
    }));
  };

  const recordRelationshipAction = (relationshipId: string, action: string) => {
    setGameState(prev => ({
      ...prev,
      relationships: prev.relationships.map(rel =>
        rel.id === relationshipId ? { ...rel, actions: { ...(rel.actions || {}), [action]: prev.day } } : rel
      ),
    }));
  };

  const addRelationship = (relationship: Relationship) => {
    setGameState(prev => {
      if (prev.relationships.some(rel => rel.id === relationship.id)) {
        return prev;
      }
      let relationships = prev.relationships;
      if (relationship.type === 'partner') {
        relationships = relationships.filter(rel => rel.type !== 'partner');
      }
      const family = { ...prev.family };
      if (relationship.type === 'spouse') {
        family.spouse = relationship;
      }
      if (relationship.type === 'child') {
        family.children = [...family.children, relationship];
      }
      return { ...prev, relationships: [...relationships, relationship], family };
    });
  };

  const adoptPet = (type: string) => {
    const costs: Record<string, number> = { Dog: 300, Cat: 240, Bird: 150 };
    const cost = costs[type] ?? 150;
    if (gameState.stats.money < cost) return;
    updateStats({ money: gameState.stats.money - cost });
    const petNames = ['Buddy', 'Max', 'Bella', 'Luna', 'Charlie'];
    const name = petNames[Math.floor(Math.random() * petNames.length)];
    const pet: Pet = {
      id: uuidv4(),
      name,
      type,
      age: 0,
      hunger: 0,
      happiness: 80,
      health: 100,
    };
    setGameState(prev => ({ ...prev, pets: [...prev.pets, pet] }));
  };

  const feedPet = (petId: string) => {
    if (gameState.stats.money < 20) return;
    updateStats({ money: gameState.stats.money - 20 });
    setGameState(prev => ({
      ...prev,
      pets: prev.pets.map(p =>
        p.id === petId
          ? {
              ...p,
              hunger: Math.max(0, p.hunger - 40),
              happiness: Math.min(100, p.happiness + 5),
            }
          : p
      ),
    }));
  };

  const playWithPet = (petId: string) => {
    if (gameState.stats.energy < 10) return;
    updateStats({ energy: gameState.stats.energy - 10 });
    setGameState(prev => ({
      ...prev,
      pets: prev.pets.map(p =>
        p.id === petId
          ? { ...p, happiness: Math.min(100, p.happiness + 10) }
          : p
      ),
    }));
  };

  const nextWeek = () => {
    try {
      simulateWeek();
      const nextWeeksLived = gameState.weeksLived + 1;
      let newDate = { ...gameState.date };
      newDate.week += 1;
      // Advance age by one week
      newDate.age = addWeekToAge(newDate.age);

      if (newDate.age >= 100) {
        Alert.alert('Game Over', 'You have reached the age of 100. Your life journey has ended.');
        return;
      }

      if (newDate.week > 4) {
      newDate.week = 1;
      const months = [
        'January',
        'February',
        'March',
        'April',
        'May',
        'June',
        'July',
        'August',
        'September',
        'October',
        'November',
        'December',
      ];
      const currentMonthIndex = months.indexOf(newDate.month);
      if (currentMonthIndex === 11) {
        newDate.month = 'January';
        newDate.year += 1;
      } else {
        newDate.month = months[currentMonthIndex + 1];
      }
    }

    if (gameState.jailWeeks > 0) {
      const jailResult = serveJailTime();
      const updatedStats = {
        ...gameState.stats,
        health: Math.max(0, Math.min(100, gameState.stats.health + (jailResult.statsChange.health || 0))),
        happiness: Math.max(0, Math.min(100, gameState.stats.happiness + (jailResult.statsChange.happiness || 0))),
        energy: 100,
      };
      const nextTotalHappiness = gameState.totalHappiness + updatedStats.happiness;
      setGameState(prev => ({
        ...prev,
        day: prev.day + 1,
        date: newDate,
        jailWeeks: Math.max(0, prev.jailWeeks - 1),
        wantedLevel: prev.wantedLevel,
        stats: updatedStats,
        pendingEvents: [],
        totalHappiness: nextTotalHappiness,
        weeksLived: nextWeeksLived,
        dailySummary: prev.settings.notificationsEnabled
          ? { moneyChange: 0, statsChange: jailResult.statsChange, events: jailResult.events }
          : undefined,
      }));
      setTimeout(() => checkAchievements(), 100);
      saveGame();
      return;
    }

    let moneyChange = 0;
    const statsChange: Partial<GameStats> = {};
    const events: string[] = [];
    let jailWeeks = gameState.jailWeeks;
    let wantedLevel = gameState.wantedLevel;

    const { total: passiveIncome } = calcWeeklyPassiveIncome(gameState);
    if (passiveIncome > 0) {
      moneyChange += passiveIncome;
      events.push(`Passive income $${passiveIncome.toFixed(2)}`);
    }

    const familyExpense =
      (gameState.family.spouse?.expenses || 0) +
      gameState.family.children.reduce((sum, c) => sum + (c.expenses || 0), 0);
    if (familyExpense > 0) {
      moneyChange -= familyExpense;
      events.push(`Family expenses $${familyExpense}`);
    }

    const familyHappy =
      (gameState.family.spouse?.familyHappiness || 0) +
      gameState.family.children.reduce((sum, c) => sum + (c.familyHappiness || 0), 0);
    if (familyHappy !== 0) {
      statsChange.happiness = (statsChange.happiness || 0) + familyHappy;
    }

    if (wantedLevel > 0) {
      if (Math.random() < wantedLevel * 0.25) {
        jailWeeks = 2 + Math.floor(Math.random() * 4);
        events.push(`Arrested and jailed for ${jailWeeks} weeks`);
        wantedLevel = 0;
      } else {
        wantedLevel = Math.max(0, wantedLevel - 1);
      }
    }

    let pets = gameState.pets.map(p => {
      const hunger = Math.min(100, p.hunger + 10);
      const happiness = Math.max(0, p.happiness - 5);
      const age = p.age + 1;
      const health = Math.max(0, Math.min(100, p.health - (hunger > 80 ? 10 : 0)));
      return { ...p, hunger, happiness, age, health };
    });

    const petBonus = pets.reduce(
      (sum, p) => (p.hunger < 50 && p.happiness >= 35 ? sum + 5 : sum),
      0
    );
    if (petBonus > 0) {
      statsChange.happiness = (statsChange.happiness || 0) + petBonus;
      events.push(`Pets brought you joy (+${petBonus} happiness)`);
    }

    const checkForDisease = () => {
      const baseChance = 2;
      let diseaseChance = baseChance;

      if (gameState.stats.happiness < 30) diseaseChance += 3;
      if (gameState.stats.fitness < 30) diseaseChance += 3;
      if (gameState.stats.health < 30) diseaseChance += 4;

      if (Math.random() * 100 < diseaseChance) {
        const diseases: Disease[] = [
          { id: 'flu', name: 'Flu', severity: 'mild', effects: { health: -15, energy: -20, happiness: -10 }, curable: true },
          { id: 'cold', name: 'Common Cold', severity: 'mild', effects: { health: -10, energy: -15 }, curable: true },
          { id: 'fever', name: 'Fever', severity: 'mild', effects: { health: -20, energy: -25, fitness: -5 }, curable: true },
        ];

        if (Math.random() < 0.001) {
          diseases.push(
            { id: 'heart_attack', name: 'Heart Attack', severity: 'serious', effects: { health: -40, fitness: -20, happiness: -30 }, curable: true },
            { id: 'stroke', name: 'Stroke', severity: 'serious', effects: { health: -35, happiness: -25 }, curable: true }
          );
        }

        if (Math.random() < 0.0001) {
          diseases.push({
            id: 'cancer',
            name: 'Cancer',
            severity: 'critical',
            effects: { health: -20, happiness: -30, energy: -15 },
            curable: false,
            treatmentRequired: true,
            weeksUntilDeath: 52,
          });
        }

        const randomDisease = diseases[Math.floor(Math.random() * diseases.length)];

        if (!gameState.diseases.find(d => d.id === randomDisease.id)) {
          setGameState(prev => ({
            ...prev,
            diseases: [...prev.diseases, randomDisease],
          }));

          const effectText = Object.entries(randomDisease.effects)
            .map(([stat, effect]) => `${effect} ${stat}`)
            .join(', ');

          events.push(`Contracted ${randomDisease.name}! Effects: ${effectText}. Visit a doctor or hospital.`);
          Alert.alert('Health Issue', `${randomDisease.name} contracted! Effects: ${effectText}`);

          Object.entries(randomDisease.effects).forEach(([stat, effect]) => {
            if (effect !== undefined) {
              statsChange[stat as keyof GameStats] = (statsChange[stat as keyof GameStats] || 0) + effect;
            }
          });
        }
      }
    };

    checkForDisease();

    // Weekly disease effects & cancer countdown
    gameState.diseases.forEach(disease => {
      Object.entries(disease.effects).forEach(([stat, effect]) => {
        if (effect !== undefined) {
          statsChange[stat as keyof GameStats] = (statsChange[stat as keyof GameStats] || 0) + effect;
        }
      });

      if (disease.id === 'cancer' && disease.weeksUntilDeath) {
        const newWeeksUntilDeath = disease.weeksUntilDeath - 1;
        if (newWeeksUntilDeath <= 0) {
          Alert.alert('Game Over', 'Cancer has taken your life. Your journey ends here.');
          return;
        }

        setGameState(prev => ({
          ...prev,
          diseases: prev.diseases.map(d => (d.id === 'cancer' ? { ...d, weeksUntilDeath: newWeeksUntilDeath } : d)),
        }));
      }
    });

    if (gameState.diseases.length > 0) {
      const names = gameState.diseases.map(d => d.name).join(', ');
      events.push(`Still affected by ${names}. Visit a doctor or hospital.`);
      Alert.alert('Health Reminder', `You're still suffering from ${names}. Visit a hospital.`);
    }

    // Advance time and age relationships
    setGameState(prev => ({
      ...prev,
      week: prev.week + 1,
      date: newDate,
      relationships: prev.relationships.map(rel => ({
        ...rel,
        age: addWeekToAge(rel.age),
      })),
      family: {
        spouse: prev.family.spouse
          ? { ...prev.family.spouse, age: addWeekToAge(prev.family.spouse.age) }
          : undefined,
        children: prev.family.children.map(c => ({ ...c, age: addWeekToAge(c.age) })),
      },
      lifeStage: getLifeStage(newDate.age),
    }));

    // Daily item bonuses (applied weekly)
    gameState.items.forEach(item => {
      if (item.owned && item.dailyBonus) {
        Object.entries(item.dailyBonus).forEach(([stat, bonus]) => {
          if (bonus !== undefined) {
            statsChange[stat as keyof GameStats] = (statsChange[stat as keyof GameStats] || 0) + bonus;
          }
        });
      }
    });

    // Salary (weekly)
    if (gameState.currentJob) {
      const career = gameState.careers.find(c => c.id === gameState.currentJob);
      if (career) {
        const weeklySalary = career.levels[career.level].salary;
        moneyChange += weeklySalary;
        events.push(`Earned weekly salary: $${weeklySalary}`);

        statsChange.happiness = (statsChange.happiness || 0) - 15;
        statsChange.health = (statsChange.health || 0) - 5;

        const progressGain = Math.floor(Math.random() * 10) + 5;
        setGameState(prev => ({
          ...prev,
          careers: prev.careers.map(c => {
            if (c.id !== gameState.currentJob) return c;
            let newProgress = Math.min(100, c.progress + progressGain);
            let newLevel = c.level;
            if (newProgress >= 100) {
              if (c.level < c.levels.length - 1) {
                newLevel += 1;
                newProgress = 0;
                events.push(`Promoted to ${c.levels[newLevel].name}!`);
              } else if (c.progress < 100) {
                newProgress = 100;
                events.push('You have reached the highest position in your career!');
              }
            }
            return { ...c, progress: newProgress, level: newLevel };
          }),
        }));

        // Advanced career perks
        switch (career.id) {
          case 'politician': {
            const reputationGain = 5;
            statsChange.reputation = (statsChange.reputation || 0) + reputationGain;
            statsChange.happiness = (statsChange.happiness || 0) - 5;
            events.push(`Political work raised reputation by ${reputationGain} but drained happiness.`);
            break;
          }
          case 'celebrity': {
            const reputationGain = 5;
            statsChange.reputation = (statsChange.reputation || 0) + reputationGain;
            statsChange.happiness = (statsChange.happiness || 0) + 5;
            const endorsement = Math.floor(Math.random() * 500) + 200;
            moneyChange += endorsement;
            events.push(`Celebrity endorsement earned $${endorsement}.`);
            break;
          }
          case 'athlete': {
            statsChange.fitness = (statsChange.fitness || 0) + 5;
            statsChange.health = (statsChange.health || 0) + 5;
            statsChange.energy = (statsChange.energy || 0) - 10;
            events.push('Intense training boosted fitness and health but drained energy.');
            break;
          }
        }
      }
    }

    // Process job applications
    const pendingApplications = gameState.careers.filter(c => c.applied && !c.accepted);
    pendingApplications.forEach(career => {
      const meetRequirements =
        (career.requirements.fitness || 0) <= gameState.stats.fitness &&
        (!career.requirements.items ||
          career.requirements.items.every(itemId => gameState.items.find(item => item.id === itemId)?.owned)) &&
        (!career.requirements.education ||
          career.requirements.education.every(educationId =>
            gameState.educations.find(e => e.id === educationId)?.completed
          ));

      if (meetRequirements && Math.random() > 0.3) {
        setGameState(prev => ({
          ...prev,
          careers: prev.careers.map(c => (c.id === career.id ? { ...c, accepted: true } : c)),
          currentJob: career.id,
        }));
        events.push(`Accepted for ${career.levels[career.level].name}!`);
      }
    });

    // Social relations weekly drift
    const socialOutcome = processWeeklyRelations(
      gameState.social.relations,
      gameState.week + 1
    );
    if (socialOutcome.happiness) {
      statsChange.happiness = (statsChange.happiness || 0) + socialOutcome.happiness;
    }
    if (socialOutcome.events.length > 0) {
      events.push(...socialOutcome.events);
    }
    setGameState(prev => ({
      ...prev,
      social: {
        relations: socialOutcome.relations.map(rel => ({
          ...rel,
          age: rel.age !== undefined ? addWeekToAge(rel.age) : undefined,
        })),
      },
    }));

    // Relationship decay and happiness boost from friends
    setGameState(prev => {
      const updatedRelationships = prev.relationships.map(rel => ({
        ...rel,
        relationshipScore: Math.max(0, rel.relationshipScore - 10),
      }));

      const supportiveFriends = updatedRelationships.filter(
        rel => rel.type === 'friend' && rel.relationshipScore > 50
      );

      if (supportiveFriends.length > 0) {
        const happinessGain = supportiveFriends.length * 5;
        statsChange.happiness = (statsChange.happiness || 0) + happinessGain;
        events.push(`Gained happiness from friends: +${happinessGain}`);
      }

      return { ...prev, relationships: updatedRelationships };
    });

    // Diet plan effects
    const activeDietPlan = gameState.dietPlans.find(plan => plan.active);
    if (activeDietPlan) {
      const weeklyCost = activeDietPlan.dailyCost * 7;
      moneyChange -= weeklyCost;
      statsChange.health = (statsChange.health || 0) + activeDietPlan.healthGain * 7;
      statsChange.energy = (statsChange.energy || 0) + activeDietPlan.energyGain * 7;
      if (activeDietPlan.happinessGain) {
        statsChange.happiness = (statsChange.happiness || 0) + activeDietPlan.happinessGain * 7;
      }
      events.push(`Weekly diet plan: -$${weeklyCost}`);
    }

    // Company income & mining
    const cryptoEarnings: Record<string, number> = {};
    gameState.companies.forEach(company => {
      const weeklyIncome = company.weeklyIncome;
      moneyChange += weeklyIncome;
      events.push(`Weekly company income (${company.name}): +$${weeklyIncome}`);

      if (company.selectedCrypto && Object.keys(company.miners).length > 0) {
        const minerEarnings: Record<string, number> = {
          basic: 175,
          advanced: 840,
          pro: 3500,
          industrial: 12600,
          quantum: 56000,
        };
        const minerPower: Record<string, number> = {
          basic: 10,
          advanced: 35,
          pro: 100,
          industrial: 250,
          quantum: 500,
        };

        const weeklyMiningEarnings = Object.entries(company.miners).reduce(
          (sum, [id, count]) => sum + (minerEarnings[id] || 0) * count,
          0
        );
        const totalPower = Object.entries(company.miners).reduce(
          (sum, [id, count]) => sum + (minerPower[id] || 0) * count,
          0
        );
        const selectedCrypto = gameState.cryptos.find(c => c.id === company.selectedCrypto);

        if (selectedCrypto) {
          const cryptoEarned = weeklyMiningEarnings / selectedCrypto.price;
          cryptoEarnings[selectedCrypto.id] = (cryptoEarnings[selectedCrypto.id] || 0) + cryptoEarned;
          events.push(`Mined ${cryptoEarned.toFixed(6)} ${selectedCrypto.symbol} (≈$${weeklyMiningEarnings})`);
        }

        if (gameState.week % 4 === 0 && totalPower > 0) {
          const monthlyBill = totalPower * 0.12 * 30;
          moneyChange -= monthlyBill;
          events.push(`Paid electrical bill: -$${monthlyBill.toFixed(2)}`);
        }
      }
    });

    if (Object.keys(cryptoEarnings).length > 0) {
      setGameState(prev => ({
        ...prev,
        cryptos: prev.cryptos.map(c => ({
          ...c,
          owned: c.owned + (cryptoEarnings[c.id] || 0),
        })),
      }));
    }

    // Real estate bonuses
    gameState.realEstate.forEach(property => {
      if (property.owned) {
        statsChange.happiness = (statsChange.happiness || 0) + property.weeklyHappiness;
        statsChange.energy = (statsChange.energy || 0) + property.weeklyEnergy;

        property.interior.forEach(furnitureId => {
          if (furnitureId === 'luxury_bed') {
            statsChange.energy = (statsChange.energy || 0) + 10;
            statsChange.happiness = (statsChange.happiness || 0) + 5;
          } else if (furnitureId === 'home_gym') {
            statsChange.health = (statsChange.health || 0) + 15;
            statsChange.fitness = (statsChange.fitness || 0) + 5;
          }
        });
      }
    });

    // Partner income and relationship management
    const updatedRelationships: Relationship[] = [];
    
    gameState.relationships.forEach(rel => {
      let updatedRel = { ...rel };
      
      // Partner income
      if (rel.income && (rel.type === 'partner' || rel.type === 'spouse') && rel.relationshipScore >= 50) {
        moneyChange += rel.income;
        events.push(`${rel.name} contributed $${rel.income}`);
      }
      
      // Friend relationship decay and happiness gain
      if (rel.type === 'friend') {
        // Track weeks at 0 relationship
        const weeksAtZero = rel.weeksAtZero || 0;
        
        if (rel.relationshipScore <= 0) {
          updatedRel.weeksAtZero = weeksAtZero + 1;
          
          // Remove friend after 10 weeks at 0
          if (updatedRel.weeksAtZero >= 10) {
            events.push(`${rel.name} removed you from their contacts due to lack of interaction.`);
            return; // Skip adding this relationship
          }
        } else {
          updatedRel.weeksAtZero = 0; // Reset counter if relationship improves
        }
        
        // Happiness gain for high relationships
        if (rel.relationshipScore >= 50) {
          const happinessGain = Math.floor(rel.relationshipScore / 10); // 5-10 happiness based on relationship level
          statsChange.happiness = (statsChange.happiness || 0) + happinessGain;
          events.push(`${rel.name} makes you happy! +${happinessGain} happiness`);
        }
      }
      
      updatedRelationships.push(updatedRel);
    });
    
    // Update relationships in game state
    setGameState(prev => ({
      ...prev,
      relationships: updatedRelationships,
    }));

    // Sponsor income
    const hobbySponsorUpdates = gameState.hobbies.map(h => {
      if (!h.sponsors || h.sponsors.length === 0) return h;
      const activeSponsors: Sponsor[] = [];
      h.sponsors.forEach(s => {
        moneyChange += s.weeklyPay;
        events.push(`Sponsor income (${s.name}): +$${s.weeklyPay}`);
        const weeksLeft = s.weeksRemaining - 1;
        if (weeksLeft > 0) {
          activeSponsors.push({ ...s, weeksRemaining: weeksLeft });
        } else {
          events.push(`Sponsor deal with ${s.name} ended`);
        }
      });
      return { ...h, sponsors: activeSponsors };
    });

    setGameState(prev => ({ ...prev, hobbies: hobbySponsorUpdates }));

    // Education progress
    setGameState(prev => ({
      ...prev,
      educations: prev.educations.map(education => {
        if (education.weeksRemaining && education.weeksRemaining > 0) {
          const newWeeksRemaining = education.weeksRemaining - 1;
          if (newWeeksRemaining === 0) {
            events.push(`Completed ${education.name}!`);
            return { ...education, completed: true, weeksRemaining: undefined };
          }
          return { ...education, weeksRemaining: Math.max(0, newWeeksRemaining) };
        }
        return education;
      }),
    }));

    const weeklyEvents = rollWeeklyEvents(gameState);

    // Natural stat changes
    statsChange.energy = 100;
    statsChange.happiness = (statsChange.happiness || 0) - 5;
    statsChange.health = (statsChange.health || 0) - 5;
    events.push('Weekly lifestyle: -5 health, -5 happiness');
    const updatedStats = {
      ...gameState.stats,
      money: gameState.stats.money + moneyChange,
      health: Math.max(0, Math.min(100, gameState.stats.health + (statsChange.health || 0))),
      happiness: Math.max(0, Math.min(100, gameState.stats.happiness + (statsChange.happiness || 0))),
      energy: Math.max(0, Math.min(100, statsChange.energy || gameState.stats.energy)),
      fitness: Math.max(0, gameState.stats.fitness + (statsChange.fitness || 0)),
      reputation: Math.max(0, gameState.stats.reputation + (statsChange.reputation || 0)),
      gems: gameState.stats.gems,
    };
    const nextTotalHappiness = gameState.totalHappiness + updatedStats.happiness;

    let happinessZeroWeeks = gameState.happinessZeroWeeks;
    let healthZeroWeeks = gameState.healthZeroWeeks;
    let deathReason: 'happiness' | 'health' | undefined;
    if (updatedStats.happiness <= 0) {
      happinessZeroWeeks += 1;
      const weeksLeft = 5 - happinessZeroWeeks;
      if (weeksLeft > 0) {
        Alert.alert(
          'Warning',
          `Your happiness is at 0! Increase it within ${weeksLeft} week${
            weeksLeft === 1 ? '' : 's'
          } or your character will die.`
        );
      } else {
        deathReason = 'happiness';
      }
    } else {
      happinessZeroWeeks = 0;
    }

    if (!deathReason && updatedStats.health <= 0) {
      healthZeroWeeks += 1;
      const weeksLeft = 5 - healthZeroWeeks;
      if (weeksLeft > 0) {
        Alert.alert(
          'Warning',
          `Your health is at 0! Increase it within ${weeksLeft} week${
            weeksLeft === 1 ? '' : 's'
          } or your character will die.`
        );
      } else {
        deathReason = 'health';
      }
    } else if (!deathReason) {
      healthZeroWeeks = 0;
    }

    if (deathReason) {
      const stateBeforeDeath: GameState = {
        ...gameState,
        stats: updatedStats,
        happinessZeroWeeks,
        healthZeroWeeks,
        showZeroStatPopup: false,
        zeroStatType: undefined,
        showDeathPopup: false,
        deathReason: undefined,
      };
      preDeathStateRef.current = JSON.parse(JSON.stringify(stateBeforeDeath));
      setGameState({
        ...stateBeforeDeath,
        showDeathPopup: true,
        deathReason,
      });
      return;
    }

    setTimeout(() => checkAchievements(), 100);

    // Commit weekly summary + stats
    setGameState(prev => {
      const stateWithInflation = applyWeeklyInflation(prev);
      return {
        ...stateWithInflation,
        day: prev.day + 1,
        date: newDate,
        dailySummary: stateWithInflation.settings.notificationsEnabled
          ? {
              moneyChange,
              statsChange,
              events,
            }
          : undefined,
        stats: updatedStats,
        pets,
        pendingEvents: weeklyEvents,
        happinessZeroWeeks,
        healthZeroWeeks,
        totalHappiness: nextTotalHappiness,
        weeksLived: nextWeeksLived,
        jailWeeks,
        wantedLevel,
      };
    });

    saveGame();
    } catch (error) {
      console.error('Error advancing week:', error);
    }
  };

  const resolveEvent: GameContextType['resolveEvent'] = (eventId, choiceId) => {
    setGameState(prev => {
      const event = prev.pendingEvents.find(e => e.id === eventId);
      if (!event) return prev;
      const choice = event.choices.find(c => c.id === choiceId);
      if (!choice) return prev;

      const stats = { ...prev.stats };
      if (choice.effects.money) {
        stats.money = Math.max(0, stats.money + choice.effects.money);
      }
      if (choice.effects.stats) {
        for (const [key, value] of Object.entries(choice.effects.stats)) {
          const k = key as keyof GameStats;
          const delta = value ?? 0;
          if (k === 'health' || k === 'happiness' || k === 'energy') {
            stats[k] = Math.max(0, Math.min(100, stats[k] + delta));
          } else if (k === 'fitness' || k === 'reputation' || k === 'gems') {
            stats[k] = Math.max(0, stats[k] + delta);
          }
        }
      }

      let relationships = prev.relationships;
      let family = prev.family;
      let jailWeeks = prev.jailWeeks;
      let wantedLevel = prev.wantedLevel;
      let pets = prev.pets;
      if (choice.effects.relationship && relationships.length > 0) {
        const index = event.relationId
          ? relationships.findIndex(r => r.id === event.relationId)
          : Math.floor(Math.random() * relationships.length);
        if (index >= 0) {
          const rel = relationships[index];
          const newScore = Math.max(
            0,
            Math.min(100, rel.relationshipScore + choice.effects.relationship)
          );
          relationships = [...relationships];
          relationships[index] = { ...rel, relationshipScore: newScore };
        }
      }

      if (choice.effects.pet && event.relationId) {
        const index = pets.findIndex(p => p.id === event.relationId);
        if (index >= 0) {
          const pet = { ...pets[index] };
          const eff = choice.effects.pet;
          if (eff.hunger !== undefined) {
            pet.hunger = Math.max(0, Math.min(100, pet.hunger + eff.hunger));
          }
          if (eff.happiness !== undefined) {
            pet.happiness = Math.max(0, Math.min(100, pet.happiness + eff.happiness));
          }
          if (eff.health !== undefined) {
            pet.health = Math.max(0, Math.min(100, pet.health + eff.health));
          }
          pets = [...pets];
          pets[index] = pet;
        }
      }

      if (event.id === 'wedding' && choice.id === 'marry' && event.relationId) {
        const idx = relationships.findIndex(r => r.id === event.relationId);
        if (idx >= 0) {
          const partner = relationships[idx];
          const spouse: Relationship = {
            ...partner,
            type: 'spouse',
            familyHappiness: partner.familyHappiness ?? 5,
            expenses: partner.expenses ?? 100,
          };
          relationships = [...relationships];
          relationships[idx] = spouse;
          family = { ...family, spouse };
        }
      }

      if (event.id === 'police_raid') {
        if (choice.id === 'run') {
          if (Math.random() < 0.5) {
            jailWeeks = 2;
            wantedLevel = 0;
          } else {
            wantedLevel = Math.max(0, wantedLevel - 1);
          }
        } else if (choice.id === 'surrender') {
          jailWeeks = 2;
          wantedLevel = 0;
        }
      }

      if (event.id === 'court_trial') {
        if (choice.id === 'plead') {
          jailWeeks = Math.max(0, jailWeeks - 1);
          wantedLevel = 0;
        } else if (choice.id === 'fight') {
          if (Math.random() < 0.5) {
            jailWeeks = 0;
            wantedLevel = 0;
          } else {
            jailWeeks += 2;
          }
        }
      }

      const pendingEvents = prev.pendingEvents.filter(e => e.id !== eventId);
      const logEntry = {
        id: event.id,
        description: event.description,
        choice: choice.text,
        week: prev.date.week,
        year: prev.date.year,
      };

      let dailySummary = prev.dailySummary;
      if (dailySummary) {
        const statsChange = { ...dailySummary.statsChange };
        if (choice.effects.stats) {
          for (const [key, value] of Object.entries(choice.effects.stats)) {
            const k = key as keyof GameStats;
            statsChange[k] = (statsChange[k] || 0) + (value ?? 0);
          }
        }
        dailySummary = {
          moneyChange: dailySummary.moneyChange + (choice.effects.money || 0),
          statsChange,
          events: [...dailySummary.events, `${event.description} - ${choice.text}`],
        };
      }

      return {
        ...prev,
        stats,
        relationships,
        family,
        pets,
        pendingEvents,
        eventLog: [...prev.eventLog, logEntry],
        dailySummary,
        jailWeeks,
        wantedLevel,
      };
    });
  };

  const dismissWelcomePopup = () => {
    setGameState(prev => ({ ...prev, showWelcomePopup: false }));
  };

  const dismissStatWarning = () => {
    setGameState(prev => ({ ...prev, showZeroStatPopup: false, zeroStatType: undefined }));
  };

  const askForMoney: GameContextType['askForMoney'] = relationshipId => {
    const relationship = gameState.relationships.find(r => r.id === relationshipId);
    if (!relationship) return { success: false, message: 'Contact not found' };

    const stage = getLifeStage(relationship.age);
    if (stage === 'child' || stage === 'teen') {
      return { success: false, message: 'You cannot ask a child or teen for money' };
    }

    if (relationship.actions?.money === gameState.day) {
      return { success: false, message: 'Already asked this week' };
    }

    if (relationship.lastMoneyRequest && gameState.week - relationship.lastMoneyRequest < 4) {
      const weeksLeft = 4 - (gameState.week - relationship.lastMoneyRequest);
      return { success: false, message: `Wait ${weeksLeft} more weeks` };
    }

    const relationshipBonus = Math.min(40, relationship.relationshipScore * 0.4);
    const successRate = 30 + relationshipBonus;
    const success = Math.random() * 100 < successRate;

    const rejectionMessages = [
      'No spare cash right now',
      'Maybe another time',
      'Get a job!',
      'Not today',
      "I'm broke too",
      'Ask someone else',
      "I can't help you",
      'You already owe me',
      "I'm saving up",
      'Not in the mood to lend',
    ];

    let amount = 0;
    let message = '';

    if (success) {
      const baseAmount = Math.floor(Math.random() * 91) + 10;
      const relationshipMultiplier = 1 + relationship.relationshipScore / 100;
      amount = Math.floor(baseAmount * relationshipMultiplier);
      message = `Got $${amount} from ${relationship.name}!`;
    } else {
      message = rejectionMessages[Math.floor(Math.random() * rejectionMessages.length)];
    }

    setGameState(prev => ({
      ...prev,
      stats: success
        ? { ...prev.stats, money: prev.stats.money + amount }
        : prev.stats,
      relationships: prev.relationships.map(rel =>
        rel.id === relationshipId
          ? {
              ...rel,
              relationshipScore: Math.max(
                0,
                Math.min(100, rel.relationshipScore + (success ? -10 : -5))
              ),
              lastMoneyRequest: prev.week,
              actions: { ...(rel.actions || {}), money: prev.day },
            }
          : rel
      ),
    }));

    return { success, message };
  };

  const callRelationship = (relationshipId: string) => {
    const relationship = gameState.relationships.find(r => r.id === relationshipId);
    if (!relationship) return { success: false, message: 'Contact not found' };

    if (relationship.lastCall && gameState.week - relationship.lastCall <= 0) {
      return { success: false, message: 'Already called this week' };
    }

    setGameState(prev => ({
      ...prev,
      relationships: prev.relationships.map(rel =>
        rel.id === relationshipId ? { ...rel, lastCall: gameState.week } : rel
      ),
    }));

    updateRelationship(relationshipId, 5);
    return { success: true, message: 'Had a nice conversation!' };
  };

  const startEducation = (educationId: string) => {
    const education = gameState.educations.find(e => e.id === educationId);
    if (!education || education.completed) return;
    const cost = getInflatedPrice(education.cost, gameState.economy.priceIndex);
    if (gameState.stats.money < cost) return;

    setGameState(prev => ({
      ...prev,
      educations: prev.educations.map(e => (e.id === educationId ? { ...e, weeksRemaining: education.duration } : e)),
    }));

    updateStats({ money: gameState.stats.money - cost });
  };


  const updateUserProfile = (profile: Partial<UserProfile>) => {
    setGameState(prev => ({
      ...prev,
      userProfile: { ...prev.userProfile, ...profile },
    }));
  };

  const updateSettings = (settings: Partial<GameSettings>) => {
    setGameState(prev => ({
      ...prev,
      settings: { ...prev.settings, ...settings },
    }));
  };

  const migrateState = (loaded: any): GameState => {
    const version = loaded.version || 1;
    let state = { ...loaded };
    if (!state.economy) {
      state.economy = { inflationRateAnnual: 0.03, priceIndex: 1 };
    }
    if (!state.social) {
      state.social = { relations: [] };
    }
    if (!state.family) {
      state.family = { children: [] };
    } else {
      state.family.children = state.family.children || [];
    }
    if (!state.pets) {
      state.pets = [];
    }
    if (!state.lifeStage) {
      state.lifeStage = getLifeStage(state.date?.age || 18);
    }
    if (!state.pendingEvents) {
      state.pendingEvents = [];
    }
    if (!state.eventLog) {
      state.eventLog = [];
    }
    if (!state.hobbies) {
      state.hobbies = initialGameState.hobbies;
    } else {
      state.hobbies = state.hobbies.map(h => {
        const def = initialGameState.hobbies.find(d => d.id === h.id)!;
        return {
          ...def,
          ...h,
          songs: h.id === 'music' ? h.songs || [] : h.songs,
          artworks: h.id === 'art' ? h.artworks || [] : h.artworks,
          upgrades: h.upgrades || def.upgrades,
        };
      });
    }
    if (!state.progress) {
      state.progress = { achievements: [] };
    }
    if (!state.journal) {
      state.journal = [];
    }
    if (!state.jailActivities) {
      state.jailActivities = initialGameState.jailActivities;
    }
    if (state.escapedFromJail === undefined) {
      state.escapedFromJail = false;
    }
    if (!state.claimedProgressAchievements) {
      state.claimedProgressAchievements = [];
    }
    if (!state.crimeSkills) {
      state.crimeSkills = {
        stealth: { xp: 0, level: 1, upgrades: [] },
        hacking: { xp: 0, level: 1, upgrades: [] },
        lockpicking: { xp: 0, level: 1, upgrades: [] },
      };
    }
    if (!state.lastLogin) {
      state.lastLogin = Date.now();
    }
    if (state.totalHappiness === undefined) {
      state.totalHappiness = 0;
    }
    if (state.weeksLived === undefined) {
      state.weeksLived = 0;
    }
    if (!state.updatedAt) {
      state.updatedAt = Date.now();
    }
    if (version < STATE_VERSION) {
      state.version = STATE_VERSION;
    }
    return state as GameState;
  };

  const saveGame = useCallback(async () => {
    try {
      const stateToSave = {
        ...gameState,
        version: STATE_VERSION,
        updatedAt: Date.now(),
      };
      await AsyncStorage.setItem(
        `save_slot_${currentSlot}`,
        JSON.stringify(stateToSave)
      );
      await AsyncStorage.setItem('lastSlot', String(currentSlot));
      await uploadGameState({ state: stateToSave, updatedAt: stateToSave.updatedAt });
      const playerName = stateToSave.userProfile.name || 'Player';
      const wealthScore = netWorth(stateToSave);
      const topCareer = stateToSave.careers.reduce((m, c) => Math.max(m, c.level), 0);
      const topSkill = stateToSave.hobbies.reduce((m, h) => Math.max(m, h.skill), 0);

      await uploadLeaderboardScore({ category: 'wealth', name: playerName, score: wealthScore });
      await uploadLeaderboardScore({ category: 'career', name: playerName, score: topCareer });
      await uploadLeaderboardScore({ category: 'skills', name: playerName, score: topSkill });
    } catch (error) {
      console.error('Error saving game:', error);
    }
  }, [gameState, currentSlot]);

  const claimProgressAchievement = (id: string, gold: number) => {
    if (gameState.claimedProgressAchievements.includes(id)) return;
            updateStats({ gems: gameState.stats.gems + gold });
    setGameState(prev => ({
      ...prev,
      claimedProgressAchievements: [...prev.claimedProgressAchievements, id],
    }));
    saveGame();
  };

  // Wrappers around extracted logic modules
  const createCompany: GameContextType['createCompany'] = companyType => {
    const result = companyLogic.createCompany(
      gameState,
      setGameState,
      updateStats,
      companyType
    );
    saveGame();
    return result;
  };

  const buyCompanyUpgrade = (upgradeId: string, companyId?: string) => {
    companyLogic.buyCompanyUpgrade(gameState, setGameState, upgradeId, companyId);
    saveGame();
  };

  const addWorker = (companyId?: string) => {
    companyLogic.addWorker(gameState, setGameState, companyId);
    saveGame();
  };

  const removeWorker = (companyId?: string) => {
    companyLogic.removeWorker(gameState, setGameState, companyId);
    saveGame();
  };

  const buyMiner = (minerId: string, companyId?: string) => {
    companyLogic.buyMiner(gameState, setGameState, updateStats, minerId, companyId);
    saveGame();
  };

  const selectMiningCrypto = (cryptoId: string, companyId?: string) => {
    companyLogic.selectMiningCrypto(gameState, setGameState, cryptoId, companyId);
    saveGame();
  };

  const addSocialRelation = (relation: Relation) => {
    socialLogic.addSocialRelation(setGameState, relation);
    saveGame();
  };

  const interactRelation = (
    relationId: string,
    action: RelationAction
  ): { success: boolean; message: string } => {
    const result = socialLogic.interactRelation(
      gameState,
      setGameState,
      relationId,
      action
    );
    saveGame();
    return result;
  };

  const loadGame = async (slot?: number) => {
    try {
      let slotToLoad = slot;
      if (!slotToLoad) {
        const last = await AsyncStorage.getItem('lastSlot');
        slotToLoad = last ? parseInt(last, 10) : 1;
      }
      const savedGame = await AsyncStorage.getItem(`save_slot_${slotToLoad}`);
      const cloudSave = await downloadGameState();
      let rawState: any = savedGame ? JSON.parse(savedGame) : null;
      if (cloudSave && (!rawState || (cloudSave.updatedAt > (rawState.updatedAt ?? 0)))) {
        rawState = cloudSave.state;
      }
      if (rawState) {
        const loadedState = migrateState(rawState);
        setCurrentSlot(slotToLoad);
        const now = Date.now();
        let updatedState: GameState = {
          ...initialGameState,
          ...loadedState,
          settings: { ...initialGameState.settings, ...loadedState.settings },
          userProfile: { ...initialGameState.userProfile, ...loadedState.userProfile },
        };
        let rewardMsg: string | null = null;
        if (!loadedState.lastLogin || now - loadedState.lastLogin > 24 * 60 * 60 * 1000) {
          const worth = netWorth(updatedState);
          const moneyBonus = Math.max(100, Math.floor(worth * 0.001));
          updatedState = {
            ...updatedState,
            stats: {
              ...updatedState.stats,
              money: updatedState.stats.money + moneyBonus,
              gems: updatedState.stats.gems + 1,
            },
            lastLogin: now,
          };
          rewardMsg = `You received 1 gem and $${moneyBonus}`;
        } else {
          updatedState.lastLogin = now;
        }
        setGameState(updatedState);
        if (rewardMsg) {
          Alert.alert('Daily Reward', rewardMsg);
        }
      }
    } catch (error) {
      console.error('Error loading game:', error);
    }
  };

  useEffect(() => {
    if (gameState.settings.autoSave && gameState.scenarioId) {
      saveGame();
    }
  }, [gameState, saveGame]);

  useEffect(() => {
    if (gameState.settings.notificationsEnabled) {
      scheduleDailyReminder();
    } else {
      cancelDailyReminder();
    }
  }, [gameState.settings.notificationsEnabled]);

  const buyCrypto = (cryptoId: string, amount: number) => {
    const crypto = gameState.cryptos.find(c => c.id === cryptoId);
    if (!crypto || gameState.stats.money < amount) return;

    const shares = amount / crypto.price;

    setGameState(prev => ({
      ...prev,
      cryptos: prev.cryptos.map(c => (c.id === cryptoId ? { ...c, owned: c.owned + shares } : c)),
      stats: {
        ...prev.stats,
        money: prev.stats.money - amount,
      },
    }));

    saveGame();
  };

  const sellCrypto = (cryptoId: string, amount: number) => {
    const crypto = gameState.cryptos.find(c => c.id === cryptoId);
    if (!crypto || crypto.owned <= 0 || amount <= 0) return;

    const sellAmount = Math.min(amount, crypto.owned);
    const totalValue = crypto.price * sellAmount;

    setGameState(prev => ({
      ...prev,
      cryptos: prev.cryptos.map(c =>
        c.id === cryptoId ? { ...c, owned: c.owned - sellAmount } : c
      ),
      stats: {
        ...prev.stats,
        money: prev.stats.money + totalValue,
      },
    }));

    saveGame();
  };

  const swapCrypto = (fromId: string, toId: string, amount: number) => {
    const from = gameState.cryptos.find(c => c.id === fromId);
    const to = gameState.cryptos.find(c => c.id === toId);
    if (!from || !to || from.owned <= 0 || amount <= 0) return;

    const swapAmount = Math.min(amount, from.owned);
    const usdValue = swapAmount * from.price;
    const toShares = usdValue / to.price;

    setGameState(prev => ({
      ...prev,
      cryptos: prev.cryptos.map(c => {
        if (c.id === fromId) return { ...c, owned: c.owned - swapAmount };
        if (c.id === toId) return { ...c, owned: c.owned + toShares };
        return c;
      }),
    }));

    saveGame();
  };

  const buyPerk = (perkId: string) => {
    setGameState(prev => ({
      ...prev,
      perks: {
        ...prev.perks,
        [perkId]: true,
      },
    }));
    saveGame();
  };

  const buyStarterPack = (packId: string) => {
    const packs = {
      starter: 50000,
      booster: 250000,
      mega: 2000000,
      crypto: 10000000,
    } as const;

    const amount = packs[packId as keyof typeof packs];
    if (amount) {
      updateStats({ money: gameState.stats.money + amount });
      saveGame();
    }
  };

  const buyGoldPack = (packId: string) => {
    const packs = {
      small: 10,
      medium: 55,
      large: 120,
    } as const;

    const amount = packs[packId as keyof typeof packs];
    if (amount) {
      updateStats({ gems: gameState.stats.gems + amount });
      saveGame();
    }
  };

  const buyGoldUpgrade = (upgradeId: string) => {
    const costs = {
      multiplier: 10000,
      skip_week: 5000,
      youth_pill: 20000,
    } as const;

    const cost = costs[upgradeId as keyof typeof costs];
    if (!cost) return;
    if (gameState.stats.gems < cost) {
      Alert.alert('Not enough gems');
      return;
    }

    if (upgradeId === 'multiplier') {
      updateStats({
        gems: gameState.stats.gems - cost,
        money: Math.floor(gameState.stats.money * 1.5),
      });
      saveGame();
    } else if (upgradeId === 'skip_week') {
      updateStats({ gems: gameState.stats.gems - cost });
      nextWeek();
    } else if (upgradeId === 'youth_pill') {
      updateStats({ gems: gameState.stats.gems - cost });
      setGameState(prev => ({
        ...prev,
        date: { ...prev.date, age: 18 },
      }));
      saveGame();
    }
  };


  const completeMinigame = (hobbyId: string, score: number) => {
    const skillGain = Math.min(5, Math.floor(score / 10));
    setGameState(prev => ({
      ...prev,
      hobbies: prev.hobbies.map(h =>
        h.id === hobbyId ? { ...h, skill: h.skill + skillGain } : h
      ),
    }));
    saveGame();
  };


  return (
    <GameContext.Provider
      value={{
        gameState,
        setGameState,
        updateStats,
        nextWeek,
        resolveEvent,
        performStreetJob,
        gainCriminalXp,
        gainCrimeSkillXp,
        unlockCrimeSkillUpgrade,
        applyForJob,
        quitJob,
        trainHobby,
        enterHobbyTournament,
        uploadSong,
        uploadArtwork,
        playMatch,
        acceptContract,
        extendContract,
        cancelContract,
        buyHobbyUpgrade,
        dive,
        buyItem,
        sellItem,
        buyDarkWebItem,
        buyHack,
        performHack,
        performJailActivity,
        serveJailTime,
        payBail,
        updateRelationship,
        addRelationship,
        addSocialRelation,
        interactRelation,
        breakUpWithPartner,
        proposeToPartner,
        moveInTogether,
        haveChild,
        adoptPet,
        feedPet,
        playWithPet,
        dismissWelcomePopup,
        dismissStatWarning,
        buyFood,
        performHealthActivity,
        toggleDietPlan,
        askForMoney,
        startEducation,
        createCompany,
        buyCompanyUpgrade,
        addWorker,
        removeWorker,
        updateUserProfile,
        updateSettings,
        callRelationship,
        buyCrypto,
        sellCrypto,
        swapCrypto,
        buyPerk,
        buyStarterPack,
        buyGoldPack,
        buyGoldUpgrade,
        buyMiner,
        selectMiningCrypto,
        completeMinigame,
        saveGame,
        loadGame,
        currentSlot,
        restartGame,
        reviveCharacter,
        checkAchievements,
        recordRelationshipAction,
        claimProgressAchievement,
      }}
    >
      {children}
    </GameContext.Provider>
  );
}

/* ---------- Hook ---------- */

export function useGame() {
  const context = useContext(GameContext);
  if (context === undefined) {
    throw new Error('useGame must be used within a GameProvider');
  }
  return context;
}
