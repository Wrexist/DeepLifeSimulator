import 'react-native-get-random-values';
import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { Alert, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { calcWeeklyPassiveIncome } from '@/lib/economy/passiveIncome';
import { applyWeeklyInflation, getInflatedPrice } from '@/lib/economy/inflation';
import { simulateWeek, getStockInfo } from '@/lib/economy/stockMarket';
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
import { showAchievementToast, showSecretAchievementToast } from '@/utils/achievementToast';
import { scheduleDailyReminder, cancelDailyReminder, notifyAchievementUnlock, notifySecretAchievementUnlock } from '@/utils/notifications';
import { uploadGameState, downloadGameState, uploadLeaderboardScore } from '@/lib/progress/cloud';
import { CacheManager } from '@/utils/cacheManager';
import PremiumLoadingScreen from '@/components/PremiumLoadingScreen';
import { queueSave, forceSave } from '@/utils/saveQueue';
import { createBackupBeforeMajorAction } from '@/utils/saveBackup';
import { iapService } from '@/services/IAPService';
import { IAP_PRODUCTS } from '@/utils/iapConfig';

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
    reputation?: number;
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

export interface Warehouse {
  level: number; // Warehouse level (0 = no warehouse, 1+ = warehouse levels)
  miners: Record<string, number>; // Miners stored in warehouse
  selectedCrypto?: string; // Selected cryptocurrency for mining
  autoRepairEnabled?: boolean; // Whether auto-repair is enabled
  autoRepairWeeklyCost?: number; // Weekly cost in crypto for auto-repair
  autoRepairCryptoId?: string; // ID of crypto used for auto-repair payments
}

export interface Company {
  id: string;
  name: string;
  type: 'factory' | 'ai' | 'restaurant' | 'realestate' | 'bank';
  weeklyIncome: number;
  baseWeeklyIncome: number;
  money?: number; // Company cash balance
  upgrades: CompanyUpgrade[];
  employees: number;
  workerSalary: number;
  workerMultiplier: number;
  marketingLevel: number;
  selectedCrypto?: string;
  miners: Record<string, number>;
  warehouseLevel: number; // Warehouse level for crypto mining (starts at 0 = 10 slots)
  electricalBill?: {
    monthlyAmount: number;
    dueWeek: number;
    paid: boolean;
  };
  autoRepairEnabled?: boolean;
  autoRepairWeeklyCost?: number;
  autoRepairCryptoId?: string;
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
  hapticFeedback: boolean;
  notificationsEnabled: boolean;
  autoSave: boolean;
  language: string;
  maxStats: boolean;
  weeklySummaryEnabled: boolean;
  showDecimalsInStats: boolean; // Show decimals in savings and gems
  // Bank Services IAP (Computer Banking App Services)
  // Computer Banking App Services (to sync with mobile)
  premiumCreditCard?: boolean;
  premiumCreditCardExpiry?: string;
  financialPlanning?: boolean;
  financialPlanningExpiry?: string;
  businessBanking?: boolean;
  businessBankingExpiry?: string;
  privateBanking?: boolean;
  privateBankingExpiry?: string;
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
  secretName?: string; // Real name shown after unlock
  secretDescription?: string; // Real description shown after unlock
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
  hasBeenInDebt?: boolean;
}

export interface Loan {
  id: string;
  name: string;
  principal: number;
  remaining: number;
  rateAPR: number;
  termWeeks: number;
  weeklyPayment: number;
  startWeek: number;
  autoPay: boolean;
  type: 'personal' | 'business' | 'mortgage' | 'auto';
  weeksRemaining: number;
  interestRate: number;
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
  computerPreviouslyOwned: boolean; // Track if computer was previously owned and sold
  foods: Food[];
  healthActivities: HealthActivity[];
  dietPlans: DietPlan[];
  educations: Education[];
  companies: Company[];
  company?: Company;
  warehouse?: Warehouse;
  userProfile: UserProfile;
  currentJob?: string;
  youthPills: number; // Number of youth pills in inventory
  showWelcomePopup: boolean;
  hasSeenJobTutorial: boolean;
  hasSeenInvestmentTutorial: boolean;
  hasSeenDatingTutorial: boolean;
  hasSeenHealthWarning: boolean;
  hasSeenEnergyWarning: boolean;
  hasSeenMoneyManagementTutorial: boolean;
  hasSeenSocialMediaTutorial: boolean;
  hasSeenRealEstateTutorial: boolean;
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
  weeklyJailActivities?: Record<string, number>; // Track which activities done this week
  criminalLevel: number;
  crimeSkills: Record<CrimeSkillId, CrimeSkill>;
  version: number;
  progress: GameProgress;
  journal: JournalEntry[];
  scenarioId?: string;
  bankSavings?: number;
  loans?: Loan[];
  stocksOwned?: { [key: string]: number };
  stocks?: {
    holdings: {
      symbol: string;
      shares: number;
      averagePrice: number;
      currentPrice: number;
    }[];
    watchlist: string[];
  };
  perks?: {
    workBoost?: boolean;
    mindset?: boolean;
    fastLearner?: boolean;
    goodCredit?: boolean;
    unlockAllPerks?: boolean;
    astute_planner?: boolean;
  };
  dailySummary?: {
    moneyChange: number;
    statsChange: Partial<GameStats>;
    events: string[];
    earningsBreakdown?: {
      gaming: number;
      streaming: number;
      passive: number;
      salary: number;
      sponsors: number;
      other: number;
    };
  };
  showDailyRewardPopup?: boolean;
  dailyRewardAmount?: number;
  gamingStreaming?: {
    followers: number;
    subscribers: number;
    totalViews: number;
    totalEarnings: number;
    totalDonations: number;
    totalSubEarnings: number;
    level: number;
    experience: number;
    gamesPlayed: string[];
    streamHours: number;
    averageViewers: number;
    bestStream: {
      id: string;
      game: string;
      duration: number;
      viewers: number;
      earnings: number;
      followers: number;
      chatMessages: number;
      donations: number;
    } | null;
    currentStream: {
      id: string;
      game: string;
      duration: number;
      viewers: number;
      earnings: number;
      followers: number;
      chatMessages: number;
      donations: number;
    } | null;
    equipment: {
      microphone: boolean;
      webcam: boolean;
      gamingChair: boolean;
      greenScreen: boolean;
      lighting: boolean;
    };
    pcComponents: {
      cpu: boolean;
      gpu: boolean;
      ram: boolean;
      ssd: boolean;
      motherboard: boolean;
      cooling: boolean;
      psu: boolean;
      case: boolean;
    };
    pcUpgradeLevels: {
      cpu: number;
      gpu: number;
      ram: number;
      ssd: number;
      motherboard: number;
      cooling: number;
      psu: number;
      case: number;
    };
    unlockedGames: string[];
    ownedGames: string[];
    streamHistory: {
      id: string;
      game: string;
      duration: number;
      viewers: number;
      earnings: number;
      followers: number;
      subscribers: number;
      chatMessages: number;
      donations: number;
    }[];
    videoTitleCounters: Record<string, number>;
    videos?: {
      id: string;
      title: string;
      description: string;
      game: string;
      views: number;
      earnings: number;
      followers: number;
      subscribers: number;
      uploadDate: string;
    }[];
    videoRecordingState?: {
      isRecording: boolean;
      recordProgress: number;
      renderProgress: number;
      uploadProgress: number;
      currentPhase: 'idle' | 'recording' | 'rendering' | 'uploading' | 'completed';
      videoTitle?: string;
      videoGame?: string;
      isRendering?: boolean;
      isUploading?: boolean;
    };
    streamingState?: {
      isStreaming: boolean;
      streamProgress: number;
      totalDonations: number;
      streamDuration?: number;
      selectedGame?: string;
      currentViewers?: number;
      currentSubsGained?: number;
      upgrades?: Record<string, number>;
    };
  };
  goldUpgrades?: Record<string, boolean>;
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
  healthWeeks: number;
  showZeroStatPopup: boolean;
  zeroStatType?: 'happiness' | 'health';
  showDeathPopup: boolean;
  deathReason?: 'happiness' | 'health';
  showSicknessModal: boolean;
  showCureSuccessModal: boolean;
  curedDiseases: string[];
  // Goal System
  goals: any[];
  goalProgress: Record<string, any>;
  completedGoals: string[];
  // Enhanced Social System
  socialEvents: any[];
  socialGroups: any[];
  socialInteractions: any[];
  lastEventTimes: Record<string, number>;
  // Daily Challenges System
  dailyChallenges?: {
    easy: { id: string; progress: number; claimed: boolean; initialState: any };
    medium: { id: string; progress: number; claimed: boolean; initialState: any };
    hard: { id: string; progress: number; claimed: boolean; initialState: any };
    lastRefresh: number;
  };
}

interface GameContextType {
  gameState: GameState;
  setGameState: React.Dispatch<React.SetStateAction<GameState>>;
  updateGameState: React.Dispatch<React.SetStateAction<GameState>>;
  updateMoney: (amount: number, reason: string, updateDailySummary?: boolean) => void;
  batchUpdateMoney: (transactions: {amount: number, reason: string}[]) => void;
  applyPerkEffects: (baseValue: number, perkType: string) => number;
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
  buyRevival: () => void;
  clearSaveSlot: (slot: number) => Promise<void>;
  savePermanentPerk: (perkId: string) => Promise<void>;
  hasPermanentPerk: (perkId: string) => Promise<boolean>;
  loadPermanentPerks: () => Promise<string[]>;
  initializeDailyChallenges: () => void;
  updateDailyChallengeProgress: () => void;
  claimDailyChallengeReward: (difficulty: 'easy' | 'medium' | 'hard') => { success: boolean; message: string; reward?: number };
  buyMiner: (minerId: string, minerName: string, cost: number, companyId?: string) => { success: boolean; message?: string };
  buyWarehouse: () => { success: boolean; message?: string };
  upgradeWarehouse: () => { success: boolean; message?: string };
  selectMiningCrypto: (cryptoId: string, companyId?: string) => void;
  selectWarehouseMiningCrypto: (cryptoId: string) => void;
  saveGame: () => Promise<void>;
  loadGame: (slot?: number) => Promise<void>;
  currentSlot: number;
  restartGame: () => Promise<void>;
  reviveCharacter: () => void;
  dismissStatWarning: () => void;
  dismissSicknessModal: () => void;
  dismissCureSuccessModal: () => void;
  checkAchievements: (state?: GameState) => void;
  recordRelationshipAction: (relationshipId: string, action: string) => void;
  claimProgressAchievement: (id: string, gold: number) => void;
  completeMinigame: (hobbyId: string, score: number) => void;
  triggerCacheClear: () => Promise<void>;
}

/* ---------- Context ---------- */

const GameContext = createContext<GameContextType | undefined>(undefined);

/* ---------- Initial State ---------- */

const STATE_VERSION = 9;

export const initialGameState: GameState = {
  version: STATE_VERSION,
  stats: {
    health: 100,
    happiness: 100,
    energy: 100,
    fitness: 10,
    money: 200,
    reputation: 0,
    gems: 0,
  },
  bankSavings: 0,
  totalHappiness: 0,
  weeksLived: 0,
  wantedLevel: 0,
  jailWeeks: 0,
  escapedFromJail: false,
  criminalXp: 0,
  weeklyJailActivities: {},
  criminalLevel: 1,
  youthPills: 0,
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
      basePayment: 100,
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
      basePayment: 120,
      rank: 1,
      progress: 0,
    },
    {
      id: 'guitar',
      name: 'Play Guitar',
      description: '70% stable income, requires guitar',
      energyCost: 25,
      baseSuccessRate: 70,
      basePayment: 160,
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
      basePayment: 180,
      rank: 1,
      progress: 0,
      requirements: ['bike'],
    },




    {
      id: 'steal_from_cars',
      name: 'Find Lost Items',
      description: 'Check around for lost or abandoned items. No requirements needed.',
      energyCost: 15,
      baseSuccessRate: 70,
      basePayment: 35,
      rank: 1,
      progress: 0,
      skill: 'stealth',
      illegal: true,
      wantedIncrease: 1,
      jailWeeks: 1,
    },

    {
      id: 'pickpocket_basic',
      name: 'Street Hustle',
      description: 'Use sleight of hand tricks for profit. Requires special gloves.',
      energyCost: 10,
      baseSuccessRate: 70,
      basePayment: 40,
      rank: 1,
      progress: 0,
      skill: 'stealth',
      illegal: true,
      darkWebRequirements: ['gloves'],
      wantedIncrease: 1,
      jailWeeks: 1,
    },

    {
      id: 'hack_public_wifi',
      name: 'Network Testing',
      description: 'Test public WiFi network security. Requires USB tools.',
      energyCost: 20,
      baseSuccessRate: 65,
      basePayment: 60,
      rank: 1,
      progress: 0,
      skill: 'hacking',
      illegal: true,
      darkWebRequirements: ['usb'],
      wantedIncrease: 1,
      jailWeeks: 1,
    },

    {
      id: 'drug_dealing',
      name: 'Street Vending',
      description: 'Sell items on the street without proper permits. Requires vendor supplies.',
      energyCost: 35,
      baseSuccessRate: 65,
      basePayment: 150,
      rank: 1,
      progress: 0,
      skill: 'stealth',
      illegal: true,
      darkWebRequirements: ['drug_supply'],
      wantedIncrease: 2,
      jailWeeks: 2,
    },

    {
      id: 'steal_cars_basic',
      name: 'Vehicle Acquisition',
      description: 'Acquire vehicles through unofficial channels. Requires lockpicking tools.',
      energyCost: 35,
      baseSuccessRate: 60,
      basePayment: 400,
      rank: 1,
      progress: 0,
      skill: 'lockpicking',
      illegal: true,
      criminalLevelReq: 1,
      darkWebRequirements: ['lockpick', 'slim_jim'],
      wantedIncrease: 3,
      jailWeeks: 3,
    },
    {
      id: 'panhandle',
      name: 'Panhandle',
      description: 'Ask strangers for money. Low risk but low reward.',
      energyCost: 5,
      baseSuccessRate: 60,
      basePayment: 60,
      rank: 1,
      progress: 0,
      skill: 'stealth',
      illegal: false,
    },
    {
      id: 'wash_cars',
      name: 'Wash Cars',
      description: 'Offer to wash cars for money. Honest work.',
      energyCost: 20,
      baseSuccessRate: 90,
      basePayment: 140,
      rank: 1,
      progress: 0,
    },
    {
      id: 'sell_water',
      name: 'Sell Water',
      description: 'Buy water bottles and sell them for profit.',
      energyCost: 15,
      baseSuccessRate: 75,
      basePayment: 80,
      rank: 1,
      progress: 0,
    },



    {
      id: 'car_theft',
      name: 'Vehicle Relocation',
      description: 'Relocate vehicles for profit. Requires specialized tools.',
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
      name: 'High-Stakes Scheme',
      description: 'Attempt a complex financial scheme. Requires advanced tools and planning.',
      energyCost: 60,
      baseSuccessRate: 20,
      basePayment: 15000,
      rank: 1,
      progress: 0,
      skill: 'stealth',
      illegal: true,
      criminalLevelReq: 3,
      darkWebRequirements: ['drill_kit', 'explosives'],
      wantedIncrease: 3,
      jailWeeks: 4,
    },

    {
      id: 'burglary',
      name: 'Property Acquisition',
      description: 'Acquire items through questionable means. Requires lockpicking skills.',
      energyCost: 35,
      baseSuccessRate: 45,
      basePayment: 300,
      rank: 1,
      progress: 0,
      skill: 'lockpicking',
      illegal: true,
      criminalLevelReq: 2,
      darkWebRequirements: ['lockpick', 'crowbar'],
      wantedIncrease: 3, // Reduced from 4
      jailWeeks: 3, // Reduced from 4 (moderate-serious crime)
    },
    {
      id: 'cyber_attack',
      name: 'Security Testing',
      description: 'Test network security for profit. Requires security tools and VPN.',
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
      wantedIncrease: 2, // Reduced from 3
      jailWeeks: 3, // Reduced from 4 (cyber crime)
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
      wantedIncrease: 3, // Reduced from 4
      jailWeeks: 3, // Reduced from 5 (cyber crime)
    },
    {
      id: 'steal_phones',
      name: 'Steal Phones',
      description: 'Steal smartphones from people. Requires Stealth Gloves.',
      energyCost: 20,
      baseSuccessRate: 70,
      basePayment: 120,
      rank: 1,
      progress: 0,
      skill: 'stealth',
      illegal: true,
      criminalLevelReq: 1,
      darkWebRequirements: ['gloves'],
      wantedIncrease: 2,
      jailWeeks: 2,
    },
    {
      id: 'smuggling',
      name: 'Smuggling',
      description: 'Transport contraband across town. Requires Bike and Night Vision Goggles.',
      energyCost: 45,
      baseSuccessRate: 40,
      basePayment: 1000,
      rank: 1,
      progress: 0,
      skill: 'stealth',
      illegal: true,
      criminalLevelReq: 3,
      requirements: ['bike'],
      darkWebRequirements: ['night_vision'],
      wantedIncrease: 3, // Reduced from 5
      jailWeeks: 4, // Reduced from 6 (serious crime)
    },
    {
      id: 'steal_laptops',
      name: 'Steal Laptops',
      description: 'Steal laptops from cafes and libraries. Requires Stealth Gloves.',
      energyCost: 25,
      baseSuccessRate: 65,
      basePayment: 200,
      rank: 1,
      progress: 0,
      skill: 'stealth',
      illegal: true,
      criminalLevelReq: 1,
      darkWebRequirements: ['gloves'],
      wantedIncrease: 2,
      jailWeeks: 2,
    },
    {
      id: 'assassination',
      name: 'Elite Contract',
      description: 'Complete high-risk contracts. Requires Stealth Equipment and Night Vision Goggles.',
      energyCost: 80,
      baseSuccessRate: 25,
      basePayment: 20000,
      rank: 1,
      progress: 0,
      skill: 'stealth',
      illegal: true,
      criminalLevelReq: 5,
      darkWebRequirements: ['silencer', 'night_vision'],
      wantedIncrease: 5,
      jailWeeks: 6,
    },
    {
      id: 'cyber_espionage',
      name: 'Cyber Espionage',
      description: 'Steal corporate secrets. Requires Malware Kit, VPN, and Encryption Suite.',
      energyCost: 50,
      baseSuccessRate: 35,
      basePayment: 6000,
      rank: 1,
      progress: 0,
      skill: 'hacking',
      illegal: true,
      criminalLevelReq: 4,
      darkWebRequirements: ['malware_kit', 'vpn', 'encryption'],
      wantedIncrease: 4, // Reduced from 6
      jailWeeks: 5, // Reduced from 8 (serious cyber crime)
    },
    {
      id: 'steal_jewelry',
      name: 'Steal Jewelry',
      description: 'Steal jewelry from stores. Requires Lockpick and Crowbar.',
      energyCost: 30,
      baseSuccessRate: 55,
      basePayment: 300,
      rank: 1,
      progress: 0,
      skill: 'lockpicking',
      illegal: true,
      criminalLevelReq: 2,
      darkWebRequirements: ['lockpick', 'crowbar'],
      wantedIncrease: 3,
      jailWeeks: 3,
    },
    {
      id: 'hack_atm',
      name: 'Hack ATM',
      description: 'Hack ATMs for cash. Requires Wireless Hack Device.',
      energyCost: 40,
      baseSuccessRate: 40,
      basePayment: 800,
      rank: 1,
      progress: 0,
      skill: 'hacking',
      illegal: true,
      criminalLevelReq: 2,
      darkWebRequirements: ['wireless_hack'],
      wantedIncrease: 3, // Reduced from 4
      jailWeeks: 3, // Reduced from 4 (moderate cyber crime)
    },
    {
      id: 'steal_safe',
      name: 'Steal Safe',
      description: 'Steal safes from homes. Requires Thermal Vision Goggles.',
      energyCost: 50,
      baseSuccessRate: 35,
      basePayment: 1200,
      rank: 1,
      progress: 0,
      skill: 'lockpicking',
      illegal: true,
      criminalLevelReq: 3,
      darkWebRequirements: ['thermal_vision'],
      wantedIncrease: 3, // Reduced from 5
      jailWeeks: 3, // Reduced from 5 (moderate-serious crime)
    },
    {
      id: 'disable_security',
      name: 'Disable Security',
      description: 'Disable security systems. Requires EMP Device.',
      energyCost: 45,
      baseSuccessRate: 45,
      basePayment: 1000,
      rank: 1,
      progress: 0,
      skill: 'hacking',
      illegal: true,
      criminalLevelReq: 3,
      darkWebRequirements: ['emp_device'],
      wantedIncrease: 3, // Reduced from 4
      jailWeeks: 3, // Reduced from 4 (moderate-serious crime)
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
  { name: 'Fast Food Worker', salary: 30 },
  { name: 'Crew Member', salary: 40 },
  { name: 'Shift Leader', salary: 55 },
  { name: 'Assistant Manager', salary: 70 },
  { name: 'Restaurant Manager', salary: 85 },
  { name: 'District Manager', salary: 110 },
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
  { name: 'Retail Associate', salary: 55 },
  { name: 'Senior Associate', salary: 70 },
  { name: 'Floor Supervisor', salary: 85 },
  { name: 'Assistant Manager', salary: 100 },
  { name: 'Store Manager', salary: 125 },
  { name: 'Regional Manager', salary: 155 },
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
  { name: 'Janitor', salary: 35 },
  { name: 'Senior Janitor', salary: 45 },
  { name: 'Maintenance Lead', salary: 55 },
  { name: 'Maintenance Supervisor', salary: 70 },
  { name: 'Facility Manager', salary: 85 },
  { name: 'Facilities Director', salary: 105 },
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
        { name: 'Teaching Assistant', salary: 220 },
        { name: 'Substitute Teacher', salary: 280 },
        { name: 'School Teacher', salary: 340 },
        { name: 'Senior Teacher', salary: 400 },
        { name: 'Department Head', salary: 480 },
        { name: 'Principal', salary: 600 },
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
        { name: 'Nursing Assistant', salary: 300 },
        { name: 'LPN', salary: 360 },
        { name: 'Registered Nurse', salary: 420 },
        { name: 'Senior Nurse', salary: 480 },
        { name: 'Nurse Practitioner', salary: 580 },
        { name: 'Nurse Manager', salary: 700 },
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
        { name: 'Junior Developer', salary: 1100 },
        { name: 'Developer', salary: 1400 },
        { name: 'Software Engineer', salary: 1700 },
        { name: 'Senior Engineer', salary: 2000 },
        { name: 'Lead Engineer', salary: 2400 },
        { name: 'Engineering Manager', salary: 3000 },
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
        { name: 'Medical Intern', salary: 1700 },
        { name: 'Resident Doctor', salary: 2200 },
        { name: 'Senior Resident', salary: 2700 },
        { name: 'Medical Doctor', salary: 3200 },
        { name: 'Senior Doctor', salary: 3800 },
        { name: 'Chief of Medicine', salary: 4800 },
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
        { name: 'Paralegal', salary: 1400 },
        { name: 'Junior Associate', salary: 1750 },
        { name: 'Associate Lawyer', salary: 2100 },
        { name: 'Senior Associate', salary: 2600 },
        { name: 'Senior Lawyer', salary: 3100 },
        { name: 'Partner', salary: 4000 },
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
        { name: 'Business Intern', salary: 1750 },
        { name: 'Analyst', salary: 2400 },
        { name: 'Senior Analyst', salary: 3000 },
        { name: 'Manager', salary: 3600 },
        { name: 'Senior Manager', salary: 4800 },
        { name: 'CEO', salary: 6000 },
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
        { name: 'Police Cadet', salary: 150 },
        { name: 'Police Officer', salary: 230 },
        { name: 'Senior Officer', salary: 290 },
        { name: 'Sergeant', salary: 350 },
        { name: 'Lieutenant', salary: 430 },
        { name: 'Captain', salary: 550 },
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
        { name: 'Junior Legal Assistant', salary: 130 },
        { name: 'Legal Assistant', salary: 190 },
        { name: 'Senior Legal Assistant', salary: 270 },
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
        { name: 'Bank Teller', salary: 230 },
        { name: 'Loan Officer', salary: 350 },
        { name: 'Bank Manager', salary: 510 },
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
        { name: 'Accounting Clerk', salary: 155 },
        { name: 'Accountant', salary: 270 },
        { name: 'Senior Accountant', salary: 390 },
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
        { name: 'Campaign Volunteer', salary: 190 },
        { name: 'City Council Member', salary: 470 },
        { name: 'Mayor', salary: 980 },
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
        { name: 'Influencer', salary: 310 },
        { name: 'TV Star', salary: 700 },
        { name: 'Movie Icon', salary: 1370 },
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
        { name: 'Rookie', salary: 270 },
        { name: 'Pro', salary: 620 },
        { name: 'Champion', salary: 1170 },
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
    { id: 'guitar', name: 'Guitar', price: 600, owned: false },
    { id: 'bike', name: 'Bike', price: 450, owned: false },
    {
      id: 'smartphone',
      name: 'Smartphone',
      price: 900,
      description: 'Unlocks mobile apps and new ways to earn money',
      owned: false,
    },
    {
      id: 'computer',
      name: 'Computer',
      price: 2400,
      description: 'Provides advanced tools and additional income opportunities',
      owned: false,
    },
    { id: 'suit', name: 'Business Suit', price: 1200, owned: false },
    {
      id: 'basic_bed',
      name: 'Basic Bed',
      price: 1500,
      owned: false,
      dailyBonus: { energy: 10, happiness: 5 },
    },
    {
      id: 'gym_membership',
      name: 'Gym Membership',
      price: 300,
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
      name: 'Power Tool Kit',
      description: 'Heavy-duty tools for complex tasks',
      costBtc: 0.03,
      owned: false,
    },
    {
      id: 'explosives',
      name: 'Security Bypass Kit',
      description: 'Advanced tools for complex operations',
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
      name: 'Security Testing Kit',
      description: 'Toolkit for network security analysis',
      costBtc: 0.02,
      rewardBonus: 0.2,
      owned: false,
    },
    {
      id: 'spray_paint',
      name: 'Art Supplies',
      description: 'Street art materials for creative expression',
      costBtc: 0.003,
      owned: false,
    },
    {
      id: 'baseball_bat',
      name: 'Sports Equipment',
      description: 'Athletic gear for recreational activities',
      costBtc: 0.006,
      owned: false,
    },
    {
      id: 'drug_supply',
      name: 'Vendor Supplies',
      description: 'Inventory for street vending operations',
      costBtc: 0.015,
      owned: false,
    },
    {
      id: 'night_vision',
      name: 'Night Vision Goggles',
      description: 'See in the dark for stealth operations',
      costBtc: 0.025,
      riskReduction: 0.15,
      owned: false,
    },
    {
      id: 'silencer',
      name: 'Stealth Equipment',
      description: 'Reduce noise during operations',
      costBtc: 0.018,
      riskReduction: 0.1,
      owned: false,
    },
    {
      id: 'wireless_hack',
      name: 'Wireless Security Scanner',
      description: 'Advanced device for wireless network analysis',
      costBtc: 0.022,
      rewardBonus: 0.25,
      owned: false,
    },
    {
      id: 'thermal_vision',
      name: 'Thermal Vision Goggles',
      description: 'See through walls and detect heat signatures',
      costBtc: 0.035,
      riskReduction: 0.2,
      owned: false,
    },
    {
      id: 'emp_device',
      name: 'EMP Device',
      description: 'Electromagnetic pulse device to disable electronics',
      costBtc: 0.040,
      rewardBonus: 0.3,
      owned: false,
    },
  ],
  hacks: [
    {
      id: 'phishing',
      name: 'Social Engineering Test',
      description: 'Test email security systems',
      costBtc: 0.01,
      risk: 0.3,
      reward: 400,
      purchased: false,
      energyCost: 10,
    },
    {
      id: 'ransomware',
      name: 'Encryption Challenge',
      description: 'Test file encryption systems',
      costBtc: 0.02,
      risk: 0.5,
      reward: 1600,
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
    { id: 'meditation', name: 'Meditation Session', description: 'Find inner peace and reduce stress', price: 80, happinessGain: 10, energyCost: 5 },
    { id: 'yoga', name: 'Yoga Class', description: 'Improve flexibility and mental clarity', price: 100, happinessGain: 8, healthGain: 5, energyCost: 5 },
    { id: 'massage', name: 'Spa Massage', description: 'Relax and rejuvenate your body', price: 300, happinessGain: 15, healthGain: 8, energyCost: 5 },
    {
      id: 'doctor',
      name: 'Doctor Visit',
      description: 'Regular checkup (50% chance to cure health issues)',
      price: 500,
      happinessGain: 0,
      healthGain: 25,
      energyCost: 5
    },
    { id: 'therapy', name: 'Therapy Session', description: 'Professional mental health support', price: 400, happinessGain: 20, energyCost: 5 },
    {
      id: 'hospital',
      name: 'Hospital Stay',
      description: 'Cures all health issues except cancer',
      price: 2000,
      happinessGain: -5,
      healthGain: 40,
      energyCost: 5
    },
    { id: 'experimental', name: 'Experimental Treatment', description: 'Cutting-edge medical procedure', price: 12000, happinessGain: 15, healthGain: 25, energyCost: 5 },
    { id: 'vacation', name: 'Weekend Getaway', description: 'Short vacation to recharge', price: 16000, happinessGain: 35, energyCost: -15 },
    { id: 'retreat', name: 'Wellness Retreat', description: 'Multi-day wellness experience', price: 30000, happinessGain: 40, healthGain: 20, energyCost: 5 },
  ],
  dietPlans: [
    { id: 'basic', name: 'Basic Diet', description: 'Simple, healthy meals', dailyCost: 375, healthGain: 3, energyGain: 2, active: false },
    { id: 'premium', name: 'Premium Diet', description: 'Organic, high-quality ingredients', dailyCost: 875, healthGain: 8, energyGain: 5, happinessGain: 3, active: false },
    { id: 'athlete', name: 'Athlete Diet', description: 'High-protein, performance-focused', dailyCost: 1250, healthGain: 12, energyGain: 8, happinessGain: 5, active: false },
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
    darkMode: true,
    soundEnabled: true,
    hapticFeedback: false,
    notificationsEnabled: true,
    autoSave: true,
    language: 'English',
    maxStats: false,
    weeklySummaryEnabled: true,
    showDecimalsInStats: false, // Default to false - no decimals for savings and gems
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
  hasSeenJobTutorial: false,
  hasSeenInvestmentTutorial: false,
  hasSeenDatingTutorial: false,
  hasSeenHealthWarning: false,
  hasSeenEnergyWarning: false,
  hasSeenMoneyManagementTutorial: false,
  hasSeenSocialMediaTutorial: false,
  hasSeenRealEstateTutorial: false,
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

    // Secret achievements - Remain hidden until unlocked
    { 
      id: 'secret_1', 
      name: '???', 
      description: 'Hidden achievement', 
      category: 'secret', 
      completed: false,
      secretName: 'The Centenarian',
      secretDescription: 'Die at exactly age 100',
      reward: 100
    },
    { 
      id: 'secret_2', 
      name: '???', 
      description: 'Hidden achievement', 
      category: 'secret', 
      completed: false,
      secretName: 'Billion Dollar Baby',
      secretDescription: 'Earn $1 billion in net worth in a single life',
      reward: 500
    },
    { 
      id: 'secret_3', 
      name: '???', 
      description: 'Hidden achievement', 
      category: 'secret', 
      completed: false,
      secretName: 'Jack of All Trades',
      secretDescription: 'Reach level 3 in all crime skills',
      reward: 150
    },
    { 
      id: 'secret_4', 
      name: '???', 
      description: 'Hidden achievement', 
      category: 'secret', 
      completed: false,
      secretName: 'Perfect Life',
      secretDescription: 'Survive 10 years (520 weeks) with all stats above 90',
      reward: 300
    },
    { 
      id: 'secret_5', 
      name: '???', 
      description: 'Hidden achievement', 
      category: 'secret', 
      completed: false,
      secretName: 'Real Estate Mogul',
      secretDescription: 'Own 10 or more properties simultaneously',
      reward: 200
    },
    { 
      id: 'secret_6', 
      name: '???', 
      description: 'Hidden achievement', 
      category: 'secret', 
      completed: false,
      secretName: 'Started From the Bottom',
      secretDescription: 'Reach $1M net worth starting from $0',
      reward: 150
    },
    { 
      id: 'secret_7', 
      name: '???', 
      description: 'Hidden achievement', 
      category: 'secret', 
      completed: false,
      secretName: 'True Love',
      secretDescription: 'Get married with a relationship score of 100',
      reward: 100
    },
    { 
      id: 'secret_8', 
      name: '???', 
      description: 'Hidden achievement', 
      category: 'secret', 
      completed: false,
      secretName: 'Criminal Mastermind',
      secretDescription: 'Complete 100 underground jobs',
      reward: 200
    },
    { 
      id: 'secret_9', 
      name: '???', 
      description: 'Hidden achievement', 
      category: 'secret', 
      completed: false,
      secretName: 'The Immortal',
      secretDescription: 'Survive to age 150 or beyond',
      reward: 1000
    },
    { 
      id: 'secret_10', 
      name: '???', 
      description: 'Hidden achievement', 
      category: 'secret', 
      completed: false,
      secretName: 'Easter Egg Hunter',
      secretDescription: 'Unlock all 9 other secret achievements',
      reward: 500
    },
  ],
  claimedProgressAchievements: [],
  lastLogin: Date.now(),
  updatedAt: Date.now(),
  streetJobsCompleted: 0,
  happinessZeroWeeks: 0,
  healthZeroWeeks: 0,
  healthWeeks: 0,
  showZeroStatPopup: false,
  zeroStatType: undefined,
  showDeathPopup: false,
  deathReason: undefined,
  showSicknessModal: false,
  showCureSuccessModal: false,
  curedDiseases: [],
  // Goal System
  goals: [],
  goalProgress: {},
  completedGoals: [],
  // Enhanced Social System
  socialEvents: [],
  socialGroups: [],
  socialInteractions: [],
  lastEventTimes: {},
  hasPhone: false,
  computerPreviouslyOwned: false,
  day: 1,
  dailySummary: undefined,
  gamingStreaming: {
    followers: 0,
    subscribers: 0,
    totalViews: 0,
    totalEarnings: 0,
    totalDonations: 0,
    totalSubEarnings: 0,
    level: 1,
    experience: 0,
    gamesPlayed: [],
    streamHours: 0,
    averageViewers: 0,
    bestStream: null,
    currentStream: null,
    equipment: {
      microphone: false,
      webcam: false,
      gamingChair: false,
      greenScreen: false,
      lighting: false,
    },
    pcComponents: {
      cpu: false,
      gpu: false,
      ram: false,
      ssd: false,
      motherboard: false,
      cooling: false,
      psu: false,
      case: false,
    },
    pcUpgradeLevels: {
      cpu: 0,
      gpu: 0,
      ram: 0,
      ssd: 0,
      motherboard: 0,
      cooling: 0,
      psu: 0,
      case: 0,
    },
    unlockedGames: [],
    ownedGames: [],
    streamHistory: [],
    videos: [],
    videoTitleCounters: {},
    videoRecordingState: {
      isRecording: false,
      recordProgress: 0,
      renderProgress: 0,
      uploadProgress: 0,
      currentPhase: 'idle',
      videoTitle: '',
      videoGame: '',
      isRendering: false,
      isUploading: false,
    },
    streamingState: {
      isStreaming: false,
      streamProgress: 0,
      totalDonations: 0,
      streamDuration: 0,
      selectedGame: '',
      currentViewers: 0,
      currentSubsGained: 0,
      upgrades: {},
    },
  },
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
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const saveDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const saveGameRef = useRef<(() => Promise<void>) | null>(null); // Ref to prevent autosave loop
  const prevMoneyRef = useRef<number>(initialGameState.stats.money);
  const prevTotalsRef = useRef<{ totalEarnings: number; totalDonations: number; totalSubEarnings: number }>({ totalEarnings: 0, totalDonations: 0, totalSubEarnings: 0 });
  const [loadingProgress, setLoadingProgress] = useState<number>(0);
  const [loadingMessage, setLoadingMessage] = useState<string>('Initializing...');
  const [isCacheClearing, setIsCacheClearing] = useState<boolean>(false);
  const [cacheUpdateInfo, setCacheUpdateInfo] = useState<{ oldVersion?: string; newVersion?: string }>({});
  const preDeathStateRef = useRef<GameState | null>(null);

  // Centralized money handling to prevent bugs
  const updateMoney = useCallback((amount: number, reason: string, updateDailySummary: boolean = true) => {
    setGameState(prev => {
      // Apply permanent money multiplier if purchased
      let adjustedAmount = amount;
      if (prev.goldUpgrades?.multiplier && amount > 0) {
        adjustedAmount = Math.floor(amount * 1.5);
      }
      
      const newMoney = Math.max(0, prev.stats.money + adjustedAmount);
      // Money change logged for debugging
      
      return {
        ...prev,
        stats: { ...prev.stats, money: newMoney },
        dailySummary: updateDailySummary ? {
          moneyChange: (prev.dailySummary?.moneyChange || 0) + adjustedAmount,
          statsChange: prev.dailySummary?.statsChange || {},
          events: prev.dailySummary?.events || [],
        } : prev.dailySummary
      };
    });
  }, []);

  // Batch money updates to prevent race conditions
  const batchUpdateMoney = useCallback((transactions: {amount: number, reason: string}[], updateDailySummary: boolean = true) => {
    setGameState(prev => {
      // Apply permanent money multiplier if purchased
      let totalChange = transactions.reduce((sum, t) => sum + t.amount, 0);
      if (prev.goldUpgrades?.multiplier && totalChange > 0) {
        totalChange = Math.floor(totalChange * 1.5);
      }
      
      const newMoney = Math.max(0, prev.stats.money + totalChange);
      
      // Batch money update logged for debugging
      
      return {
        ...prev,
        stats: { ...prev.stats, money: newMoney },
        dailySummary: updateDailySummary ? {
          moneyChange: (prev.dailySummary?.moneyChange || 0) + totalChange,
          statsChange: prev.dailySummary?.statsChange || {},
          events: prev.dailySummary?.events || [],
        } : prev.dailySummary
      };
    });
  }, []);

  // Perk effects application
  const applyPerkEffects = useCallback((baseValue: number, perkType: string): number => {
    const { perks } = gameState;
    let multiplier = 1;
    
    switch (perkType) {
      case 'income':
        if (perks?.workBoost) multiplier *= 1.25; // Reduced from +50% to +25% income
        if (perks?.goodCredit) multiplier *= 1.05; // Reduced from +10% to +5% from good credit
        break;
        
      case 'promotion':
        if (perks?.mindset) multiplier *= 1.25; // Reduced from 50% to 25% faster promotions
        break;
        
      case 'education':
        if (perks?.fastLearner) multiplier *= 1.25; // Reduced from 50% to 25% faster education
        break;
        
      case 'bankInterest':
        if (perks?.goodCredit) multiplier *= 1.15; // Reduced from +25% to +15% bank interest
        break;
        
      case 'energy':
        if (perks?.astute_planner) multiplier *= 0.9; // -10% energy cost
        break;
    }
    
    return Math.round(baseValue * multiplier);
  }, [gameState.perks]);

  const restartGame = async () => {
    try {
      // Create backup before restarting
      await createBackupBeforeMajorAction(currentSlot, gameState, 'restart');
      
      // Show loading state to prevent UI freeze
      setIsLoading(true);
      setLoadingMessage('Restarting game...');
      
      // Reset tutorial completion status for new game
      await AsyncStorage.removeItem('tutorial_completed');
      
      // Create reset state with proper error handling
      const resetState: GameState = JSON.parse(JSON.stringify(initialGameState));
      
      // Load global gems
      const globalGemsData = await AsyncStorage.getItem('globalGems');
      const globalGems = globalGemsData ? parseInt(globalGemsData, 10) : 0;
      
      // Carry over completed achievements and progress to unlock perks in the next life
      if (gameState.achievements) {
        resetState.achievements = JSON.parse(JSON.stringify(gameState.achievements));
      }
      if (gameState.progress) {
        resetState.progress = JSON.parse(JSON.stringify(gameState.progress));
      }
      if (gameState.claimedProgressAchievements) {
        resetState.claimedProgressAchievements = [...gameState.claimedProgressAchievements];
      }
      resetState.stats.gems = globalGems; // Use global gems
      
      // Use setTimeout to break up heavy operations and prevent UI blocking
      await new Promise(resolve => setTimeout(resolve, 0));
      
      // Update state
      setGameState(resetState);
      
      // Save the new state to ensure gems are preserved
      await new Promise(resolve => setTimeout(resolve, 100));
      await saveGame();
      
      // Final setTimeout before clearing loading state
      await new Promise(resolve => setTimeout(resolve, 100));
      
    } catch (error) {
      console.error('Failed to restart game:', error);
      // Show error to user
      Alert.alert('Error', 'Failed to restart game. Please try again.');
    } finally {
      // Always clear loading state
      setIsLoading(false);
      setLoadingMessage('Initializing...');
    }
  };

  // Automated cache management and game loading on startup
  useEffect(() => {
    const initializeGame = async () => {
      try {
        setLoadingProgress(10);
        setLoadingMessage('Checking for updates...');
        
        // Initialize cache manager
        const cacheResult = await CacheManager.initialize();
        
        if (cacheResult.needsCacheClear) {
          setLoadingProgress(30);
          setLoadingMessage('Updating game data...');
          setIsCacheClearing(true);
          setCacheUpdateInfo({
            oldVersion: cacheResult.oldVersion,
            newVersion: '1.0.0'
          });
          
          // Simulate cache clearing progress
          await new Promise(resolve => setTimeout(resolve, 1000));
          setLoadingProgress(60);
          setLoadingMessage('Cache updated successfully');
        }
        
        setLoadingProgress(80);
        setLoadingMessage('Loading saved game...');
        
        // Check if there's a saved game to load
        const lastSlot = await AsyncStorage.getItem('lastSlot');
        if (lastSlot) {
          const slotNumber = parseInt(lastSlot, 10);
          await loadGame(slotNumber);
        }
        
        setLoadingProgress(100);
        setLoadingMessage('Ready to play!');
        
        // Small delay to show completion
        await new Promise(resolve => setTimeout(resolve, 500));
        
        setIsLoading(false);
        setIsCacheClearing(false);
        
      } catch (error) {
        console.error('Failed to initialize game:', error);
        setLoadingMessage('Error loading game');
        setIsLoading(false);
      }
    };

    initializeGame();
  }, []);

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
      bankSavings: preDeathStateRef.current.bankSavings !== undefined ? preDeathStateRef.current.bankSavings : 0,
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

  const checkAchievements = useCallback((state: GameState = gameState) => {
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
        // Removed achievement popup for regular achievements - only show for progress achievements
        notifyAchievementUnlock(achievement.name, achievement.reward ?? 1);
        // Achievement unlocked
      }
    };

    // Money
    if (state.stats.money >= 1) completeAchievement('first_dollar');
    if (state.stats.money >= 100) completeAchievement('hundred_dollars');
    if (state.stats.money >= 1000) completeAchievement('thousand_dollars');
    if (state.stats.money >= 10000) completeAchievement('ten_thousand');
    if (state.stats.money >= 100000) completeAchievement('hundred_thousand');
    if (state.stats.money >= 2000000) completeAchievement('millionaire'); // Doubled from 1M to 2M
    if (state.stats.money >= 20000000) completeAchievement('deca_millionaire'); // Doubled from 10M to 20M

    // Career
    if (state.currentJob) completeAchievement('first_job');

    if (state.streetJobsCompleted >= 20) completeAchievement('street_worker'); // Doubled from 10 to 20

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
    if (state.companies.some(c => c.weeklyIncome >= 100000)) completeAchievement('industry_mogul'); // Doubled from 50K to 100K

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

    // Secret Achievements - Check conditions
    // Secret 1: The Centenarian - Die at exactly age 100
    if (state.deathReason && Math.floor(state.date.age) === 100) {
      const achievement = newAchievements.find(a => a.id === 'secret_1');
      if (achievement && !achievement.completed) {
        achievement.completed = true;
        achievement.name = achievement.secretName || 'The Centenarian';
        achievement.description = achievement.secretDescription || 'Die at exactly age 100';
        hasChanges = true;
        goldReward += achievement.reward ?? 100;
        notifySecretAchievementUnlock(achievement.name, achievement.reward ?? 100);
        showSecretAchievementToast(achievement.name, achievement.reward ?? 100);
      }
    }

    // Secret 2: Billion Dollar Baby - Reach $1B net worth
    const currentNetWorth = netWorth(state);
    if (currentNetWorth >= 1000000000) {
      const achievement = newAchievements.find(a => a.id === 'secret_2');
      if (achievement && !achievement.completed) {
        achievement.completed = true;
        achievement.name = achievement.secretName || 'Billion Dollar Baby';
        achievement.description = achievement.secretDescription || 'Earn $1 billion in net worth';
        hasChanges = true;
        goldReward += achievement.reward ?? 500;
        notifySecretAchievementUnlock(achievement.name, achievement.reward ?? 500);
        showSecretAchievementToast(achievement.name, achievement.reward ?? 500);
      }
    }

    // Secret 3: Jack of All Trades - Level 3 in all crime skills
    const allCrimeSkillsLevel3 = Object.values(state.crimeSkills).every(skill => skill.level >= 3);
    if (allCrimeSkillsLevel3) {
      const achievement = newAchievements.find(a => a.id === 'secret_3');
      if (achievement && !achievement.completed) {
        achievement.completed = true;
        achievement.name = achievement.secretName || 'Jack of All Trades';
        achievement.description = achievement.secretDescription || 'Reach level 3 in all crime skills';
        hasChanges = true;
        goldReward += achievement.reward ?? 150;
        notifySecretAchievementUnlock(achievement.name, achievement.reward ?? 150);
        showSecretAchievementToast(achievement.name, achievement.reward ?? 150);
      }
    }

    // Secret 4: Perfect Life - 520 weeks with all stats above 90
    const allStatsAbove90 = state.stats.health >= 90 && state.stats.happiness >= 90 && 
                           state.stats.energy >= 90 && state.stats.fitness >= 90;
    if (state.week >= 520 && allStatsAbove90) {
      const achievement = newAchievements.find(a => a.id === 'secret_4');
      if (achievement && !achievement.completed) {
        achievement.completed = true;
        achievement.name = achievement.secretName || 'Perfect Life';
        achievement.description = achievement.secretDescription || 'Survive 10 years with all stats above 90';
        hasChanges = true;
        goldReward += achievement.reward ?? 300;
        notifySecretAchievementUnlock(achievement.name, achievement.reward ?? 300);
        showSecretAchievementToast(achievement.name, achievement.reward ?? 300);
      }
    }

    // Secret 5: Real Estate Mogul - Own 10+ properties
    const ownedProperties = state.realEstate.filter(p => p.owned).length;
    if (ownedProperties >= 10) {
      const achievement = newAchievements.find(a => a.id === 'secret_5');
      if (achievement && !achievement.completed) {
        achievement.completed = true;
        achievement.name = achievement.secretName || 'Real Estate Mogul';
        achievement.description = achievement.secretDescription || 'Own 10 or more properties';
        hasChanges = true;
        goldReward += achievement.reward ?? 200;
        notifySecretAchievementUnlock(achievement.name, achievement.reward ?? 200);
        showSecretAchievementToast(achievement.name, achievement.reward ?? 200);
      }
    }

    // Secret 6: Started From the Bottom - $1M net worth (tracked from $0 start)
    if (currentNetWorth >= 1000000) {
      const achievement = newAchievements.find(a => a.id === 'secret_6');
      if (achievement && !achievement.completed) {
        achievement.completed = true;
        achievement.name = achievement.secretName || 'Started From the Bottom';
        achievement.description = achievement.secretDescription || 'Reach $1M net worth';
        hasChanges = true;
        goldReward += achievement.reward ?? 150;
        notifySecretAchievementUnlock(achievement.name, achievement.reward ?? 150);
        showSecretAchievementToast(achievement.name, achievement.reward ?? 150);
      }
    }

    // Secret 7: True Love - Married with 100 relationship score
    const hasMarriageWith100 = state.relationships.some(
      rel => rel.type === 'spouse' && rel.relationshipScore >= 100
    );
    if (hasMarriageWith100) {
      const achievement = newAchievements.find(a => a.id === 'secret_7');
      if (achievement && !achievement.completed) {
        achievement.completed = true;
        achievement.name = achievement.secretName || 'True Love';
        achievement.description = achievement.secretDescription || 'Get married with 100 relationship score';
        hasChanges = true;
        goldReward += achievement.reward ?? 100;
        notifySecretAchievementUnlock(achievement.name, achievement.reward ?? 100);
        showSecretAchievementToast(achievement.name, achievement.reward ?? 100);
      }
    }

    // Secret 8: Criminal Mastermind - Complete 100 underground jobs
    if (state.streetJobsCompleted >= 100) {
      const achievement = newAchievements.find(a => a.id === 'secret_8');
      if (achievement && !achievement.completed) {
        achievement.completed = true;
        achievement.name = achievement.secretName || 'Criminal Mastermind';
        achievement.description = achievement.secretDescription || 'Complete 100 underground jobs';
        hasChanges = true;
        goldReward += achievement.reward ?? 200;
        notifySecretAchievementUnlock(achievement.name, achievement.reward ?? 200);
        showSecretAchievementToast(achievement.name, achievement.reward ?? 200);
      }
    }

    // Secret 9: The Immortal - Survive to age 150
    if (state.date.age >= 150) {
      const achievement = newAchievements.find(a => a.id === 'secret_9');
      if (achievement && !achievement.completed) {
        achievement.completed = true;
        achievement.name = achievement.secretName || 'The Immortal';
        achievement.description = achievement.secretDescription || 'Survive to age 150';
        hasChanges = true;
        goldReward += achievement.reward ?? 1000;
        notifySecretAchievementUnlock(achievement.name, achievement.reward ?? 1000);
        showSecretAchievementToast(achievement.name, achievement.reward ?? 1000);
      }
    }

    // Secret 10: Easter Egg Hunter - Unlock all other secret achievements
    const otherSecretAchievements = newAchievements.filter(
      a => a.category === 'secret' && a.id !== 'secret_10'
    );
    const allOtherSecretsUnlocked = otherSecretAchievements.every(a => a.completed);
    if (allOtherSecretsUnlocked && otherSecretAchievements.length === 9) {
      const achievement = newAchievements.find(a => a.id === 'secret_10');
      if (achievement && !achievement.completed) {
        achievement.completed = true;
        achievement.name = achievement.secretName || 'Easter Egg Hunter';
        achievement.description = achievement.secretDescription || 'Unlock all secret achievements';
        hasChanges = true;
        goldReward += achievement.reward ?? 500;
        notifySecretAchievementUnlock(achievement.name, achievement.reward ?? 500);
        showSecretAchievementToast(achievement.name, achievement.reward ?? 500);
      }
    }

    if (goldReward > 0) {
              updateStats({ gems: state.stats.gems + goldReward }, false);
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
      // Fix: 'category' and 'reward' do not exist on type 'AchievementProgress'.
      // If you want to show the toast, you need to get these from somewhere else.
      // For now, just pass a default category and reward.
      unlocked.forEach(a => showAchievementToast(a.name, 'general', 1));
    }
  }, [gameState]);

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

  // Listen for IAP purchase benefits being applied externally
  useEffect(() => {
    let lastTriggerValue = '';
    let isSyncing = false; // Prevent race conditions
    
    const checkIAPTrigger = async () => {
      // Skip if already syncing to prevent race conditions
      if (isSyncing) {
        console.log('⏳ IAP sync already in progress, skipping...');
        return;
      }
      
      try {
        isSyncing = true;
        const triggerValue = await AsyncStorage.getItem('iap_trigger_reload');
        
        if (triggerValue && triggerValue !== lastTriggerValue) {
          console.log('🔄 IAP purchase benefits detected, reloading game state...');
          lastTriggerValue = triggerValue;
          
          // Small delay to ensure AsyncStorage write completed
          await new Promise(resolve => setTimeout(resolve, 100));
          
          // Reload the game state from AsyncStorage
          const savedData = await AsyncStorage.getItem(`save_slot_${currentSlot}`);
          if (savedData) {
            const loadedState = JSON.parse(savedData);
            const migratedState = migrateState(loadedState);
            setGameState(migratedState);
            console.log('✅ Game state reloaded after IAP purchase');
          }
        }
      } catch (error) {
        console.error('Error checking IAP trigger:', error);
      } finally {
        isSyncing = false;
      }
    };
    
    // Check every 2 seconds for IAP trigger
    const iapTriggerInterval = setInterval(checkIAPTrigger, 2000);
    
    return () => clearInterval(iapTriggerInterval);
  }, [currentSlot]);

  // Memoize expensive achievement calculations to prevent re-filtering on every render
  const completedEducationsCount = React.useMemo(() => 
    gameState.educations.filter(e => e.completed).length,
    [gameState.educations]
  );

  const ownedItemsCount = React.useMemo(() =>
    gameState.items.filter(i => i.owned).length,
    [gameState.items]
  );

  // Trigger achievement checks on relevant events
  useEffect(() => {
    checkAchievements();
  }, [
    gameState.stats.money,
    gameState.stats.fitness,
    gameState.currentJob,
    gameState.streetJobsCompleted,
    gameState.companies.length,
    completedEducationsCount, // Use memoized value
    gameState.relationships.length,
    ownedItemsCount, // Use memoized value
    checkAchievements,
  ]);

  // Initialize daily challenges on app load
  useEffect(() => {
    initializeDailyChallenges();
  }, []);

  // Update daily challenge progress on game state changes
  useEffect(() => {
    if (gameState.dailyChallenges) {
      updateDailyChallengeProgress();
    }
  }, [
    gameState.stats.money,
    gameState.streetJobsCompleted,
    gameState.week,
    gameState.items.filter(i => i.owned).length,
    gameState.realEstate.filter(p => p.owned).length,
    gameState.relationships.length,
    gameState.stats.health,
    gameState.stats.happiness,
    gameState.stats.fitness,
  ]);

  // Function to manually trigger cache clearing (for future updates)
  const triggerCacheClear = useCallback(async () => {
    try {
      setLoadingProgress(0);
      setLoadingMessage('Preparing update...');
      setIsLoading(true);
      setIsCacheClearing(true);
      
      await CacheManager.forceClearCache();
      
      setLoadingProgress(100);
      setLoadingMessage('Update complete!');
      
      setTimeout(() => {
        setIsLoading(false);
        setIsCacheClearing(false);
      }, 1000);
    } catch (error) {
      console.error('Failed to clear cache:', error);
      setIsLoading(false);
      setIsCacheClearing(false);
    }
  }, []);

  // Gem validation function to ensure gems are never negative or invalid
  const validateGems = useCallback((gems: number): number => {
    if (typeof gems !== 'number' || isNaN(gems) || gems < 0) {
      console.warn(`Invalid gem value detected: ${gems}, resetting to 0`);
      return 0;
    }
    // Cap gems at a reasonable maximum to prevent overflow issues
    return Math.min(gems, 999999999);
  }, []);

  // Gem recovery function to restore gems from any available backup
  const recoverGems = useCallback(async (): Promise<number> => {
    try {
      // Try all storage locations and return the highest valid value found
      let maxGems = 0;
      const storageKeys = ['globalGems', 'globalGems_backup', 'globalGems_emergency'];
      
      for (const key of storageKeys) {
        try {
          const gemData = await AsyncStorage.getItem(key);
          if (gemData) {
            const gems = parseInt(gemData, 10);
            if (!isNaN(gems) && gems > maxGems) {
              maxGems = gems;
            }
          }
        } catch (error) {
          console.warn(`Failed to read ${key}:`, error);
        }
      }
      
      const validatedGems = validateGems(maxGems);
      console.log(`Gem recovery found ${validatedGems} gems`);
      return validatedGems;
    } catch (error) {
      console.error('Gem recovery failed:', error);
      return 0;
    }
  }, [validateGems]);

  const updateStats = useCallback((newStats: Partial<GameStats>, updateDailySummary: boolean = true) => {
    // Check if gems are being updated and validate them
    const gemsUpdated = newStats.gems !== undefined;
    if (gemsUpdated) {
      newStats.gems = validateGems(newStats.gems!);
    }
    
    setGameState(prev => {
      const updatedStats = { ...prev.stats };
      
      Object.entries(newStats).forEach(([key, value]) => {
        const statKey = key as keyof GameStats;
        const currentValue = updatedStats[statKey];
        
        if (typeof value === 'number' && typeof currentValue === 'number') {
          // Special handling per stat
          if (statKey === 'gems') {
            // Gems are unbounded and always relative
            const min = 0;
            const max = Number.MAX_SAFE_INTEGER; // Use MAX_SAFE_INTEGER instead of Infinity for JSON safety
            updatedStats[statKey] = Math.max(min, Math.min(max, currentValue + value));
          } else if (statKey === 'money') {
            // Money should NEVER be capped at 100 or treated as absolute. Always apply as delta.
            const min = 0; // Keep non-negative money in this updater; use updateMoney for complex cases
            const max = Number.MAX_SAFE_INTEGER; // Use MAX_SAFE_INTEGER instead of Infinity for JSON safety
            updatedStats[statKey] = Math.max(min, Math.min(max, currentValue + value));
          } else {
            // Default 0..100 clamped, relative change
            const min = 0;
            const max = 100;
            updatedStats[statKey] = Math.max(min, Math.min(max, currentValue + value));
          }
          
          // Stat change logged for debugging
        }
      });

      // Handle max stats setting
      if (prev.settings.maxStats) {
        updatedStats.health = 100;
        updatedStats.happiness = 100;
        updatedStats.energy = 100;
      }

      // Handle zero stat warnings
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

      // Track if player has been in debt
      let hasBeenInDebt = prev.progress?.hasBeenInDebt ?? false;
      if (updatedStats.money < 0 && prev.stats.money >= 0) {
        hasBeenInDebt = true;
      }
      
      return {
        ...prev,
        stats: updatedStats,
        showZeroStatPopup,
        zeroStatType,
        progress: {
          ...prev.progress,
          hasBeenInDebt,
        },
        dailySummary: updateDailySummary ? {
          moneyChange: prev.dailySummary?.moneyChange || 0,
          statsChange: { ...(prev.dailySummary?.statsChange || {}), ...newStats },
          events: prev.dailySummary?.events || [],
        } : prev.dailySummary
      };
    });
    
    // Save global gems if gems were updated
    if (gemsUpdated) {
      setTimeout(async () => {
        try {
          const currentGems = gameState.stats.gems + (newStats.gems || 0);
          await AsyncStorage.setItem('globalGems', currentGems.toString());
        } catch (error) {
          console.error('Failed to save global gems:', error);
        }
      }, 0);
    }
  }, [gameState.stats.gems]);

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

  const performStreetJob: GameContextType['performStreetJob'] = useCallback(jobId => {
    const job = gameState.streetJobs.find(j => j.id === jobId);
    if (!job) return;
    if (gameState.jailWeeks > 0) {
      return { success: false, message: 'Cannot work while jailed' };
    }

    const basePayment = job.basePayment * (1 + (job.rank - 1) * 0.2);
    // Apply perk effects to income
    const finalPayment = applyPerkEffects(basePayment, 'income');
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
      const skill = gameState.crimeSkills[job.skill];
      
      // Apply skill level bonus
      successRate += skillLevel * 2;
      
      // Apply talent upgrades bonus
      if (skill.upgrades && skill.upgrades.length > 0) {
        const talentBonus = skill.upgrades.length * 5; // +5% per talent unlocked
        successRate += talentBonus;
      }
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

      successRate += successRate * totalRiskReduction;
      success = Math.random() * 100 < successRate;

      if (success) {
        const rankMultiplier = 1 + (job.rank - 1) * 0.3;
        
        // Apply talent bonus to payment
        let talentPaymentBonus = 1;
        if (job.skill) {
          const skill = gameState.crimeSkills[job.skill];
          if (skill.upgrades && skill.upgrades.length > 0) {
            talentPaymentBonus += skill.upgrades.length * 0.1; // +10% payment per talent
          }
        }
        
        moneyGained = Math.floor(
          job.basePayment * rankMultiplier * (1 + totalRewardBonus) * paymentBonus * talentPaymentBonus
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


    } else {
      success = Math.random() * 100 < successRate;
      if (success) {
        const rankMultiplier = 1 + (job.rank - 1) * 0.3;
        
        // Apply talent bonus to payment for legal jobs too
        let talentPaymentBonus = 1;
        if (job.skill) {
          const skill = gameState.crimeSkills[job.skill];
          if (skill.upgrades && skill.upgrades.length > 0) {
            talentPaymentBonus += skill.upgrades.length * 0.1; // +10% payment per talent
          }
        }
        
        moneyGained = Math.floor(job.basePayment * rankMultiplier * talentPaymentBonus);
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

    // Use centralized money handling
    updateMoney(moneyGained - moneyLost, `Street job: ${job.name}`, false);
    
    updateStats({
      energy: -job.energyCost,
      happiness: -3,
      health: -1,
    }, false);

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
      inJail: caught,
    };
  }, [gameState, updateMoney, updateStats, applyPerkEffects, gainCriminalXp, gainCrimeSkillXp]);

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

    // Gaming activities cost money
    const gamingActivities = ['gaming', 'esports', 'streaming'];
    let moneyCost = 0;
    if (gamingActivities.includes(hobbyId)) {
      moneyCost = 25; // $25 per gaming session
      if (gameState.stats.money < moneyCost) {
        return { success: false, message: 'Not enough money for gaming session' };
      }
    }

    updateStats({
      energy: -hobby.energyCost,
      health: -8,
      happiness: -3,
      money: -moneyCost,
    }, false);

    const skillBonus = hobby.upgrades
      .reduce((sum, u) => sum + (u.skillBonusPerLevel || 0) * u.level, 0);
    const gain = Math.floor(Math.random() * 3) + 2 + Math.floor(skillBonus / 2); // Reduced from 5-10 to 2-5 (2x slower)
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
      energy: -hobby.energyCost,
      health: -10,
      happiness: -5,
    }, false);
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
        money: reward,
        reputation: 2,
      }, false);
      return {
        success: true,
        message: `Won ${hobby.name} tournament! Earned $${reward}`,
      };
    } else {
      updateStats({ happiness: -5 }, false);
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
      energy: -cost,
      health: -7,
      happiness: -2,
    }, false);

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
      energy: -cost,
      health: -7,
      happiness: -2,
    }, false);

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
      energy: -cost,
      health: -5,
      happiness: -3,
    }, false);

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
    updateMoney(contract.matchPay, 'Match payment', false);
    contract.weeksRemaining -= 1;
    if (contract.weeksRemaining <= 0) {
      const final = [...league.standings].sort((a, b) => b.points - a.points);
      const position = final.findIndex(t => t.team === contract.team);
      const division = league.division;
      const prizes = [20000, 10000, 4000];
      if (position > -1 && position <= 2) {
        updateMoney(prizes[division], 'League prize', false);
      }
      const divisions = hobby.divisions;
      if (!divisions || !Array.isArray(divisions)) {
        console.error('Invalid divisions structure in hobby:', hobby.id);
        return;
      }
      
      if (division > 0 && divisions[division] && divisions[division - 1]) {
        const promoted = final.slice(0, 3).map(t => t.team);
        if (divisions[division].teams && Array.isArray(divisions[division].teams)) {
          divisions[division].teams = divisions[division].teams.filter(
            t => !promoted.includes(t.name)
          );
        }
        promoted.forEach(teamName => {
          if (divisions[division - 1].teams && Array.isArray(divisions[division - 1].teams)) {
            divisions[division - 1].teams.push({
              name: teamName,
              goal: divisions[division - 1].teams.length + 1,
            });
          }
        });
      }
      if (division < 2 && divisions[division] && divisions[division + 1]) {
        const demoted = final.slice(-3).map(t => t.team);
        if (divisions[division].teams && Array.isArray(divisions[division].teams)) {
          divisions[division].teams = divisions[division].teams.filter(
            t => !demoted.includes(t.name)
          );
        }
        demoted.forEach(teamName => {
          if (divisions[division + 1].teams && Array.isArray(divisions[division + 1].teams)) {
            divisions[division + 1].teams.push({
              name: teamName,
              goal: divisions[division + 1].teams.length + 1,
            });
          }
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

    setGameState(prev => ({
      ...prev,
      stats: {
        ...prev.stats,
        money: prev.stats.money - upgrade.cost
      }
    }));
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

  const buyItem = useCallback((itemId: string) => {
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

      // Use centralized money handling - don't update dailySummary for buying items
      updateMoney(-price, `Buy ${item.name}`, false);

      setGameState(prev => ({
        ...prev,
        items: prev.items.map(i => (i.id === itemId ? { ...i, owned: true } : i)),
        hasPhone: itemId === 'smartphone' ? true : prev.hasPhone,
      }));

      // Special message for computer - data restoration confirmation (only if previously owned)
      if (itemId === 'computer') {
        if (gameState.computerPreviouslyOwned) {
          Alert.alert(
            'Computer Purchased!',
            'Welcome back! All your previous data (cryptocurrencies, stocks, real estate, etc.) has been restored.',
            [{ text: 'OK' }]
          );
        } else {
          Alert.alert(
            'Computer Purchased!',
            'Congratulations on your first computer! You now have access to advanced features like cryptocurrency trading, stock market, and real estate.',
            [{ text: 'OK' }]
          );
        }
      }

      checkAchievements();
    } catch (error) {
      console.error('Error buying item:', error);
    }
  }, [gameState.items, gameState.economy?.priceIndex, gameState.stats.money, updateMoney, checkAchievements]);

  const sellItem = useCallback((itemId: string) => {
    const item = gameState.items.find(i => i.id === itemId);
    if (!item || !item.owned) return;
    
    // Special warning for computer - data persistence system
    // When selling the computer, all data (cryptos, stocks, real estate, etc.) 
    // is preserved in gameState and will be restored when buying the computer again
    if (itemId === 'computer') {
      // For now, let's just sell the computer directly without confirmation
      // to test if the basic functionality works
      const price = getInflatedPrice(item.price, gameState.economy?.priceIndex ?? 1);
      const sellPrice = price * 0.5;
      
      // Use centralized money handling - don't update dailySummary for selling items
      updateMoney(sellPrice, `Sell ${item.name}`, false);
      
      setGameState(prev => ({
        ...prev,
        items: prev.items.map(i => (i.id === itemId ? { ...i, owned: false } : i)),
        computerPreviouslyOwned: true, // Mark that computer was previously owned
      }));
      
      return;
    }
    
    const price = getInflatedPrice(item.price, gameState.economy?.priceIndex ?? 1);
    const sellPrice = price * 0.5;

    // Use centralized money handling - don't update dailySummary for selling items
    updateMoney(sellPrice, `Sell ${item.name}`, false);

    setGameState(prev => ({
      ...prev,
      items: prev.items.map(i => (i.id === itemId ? { ...i, owned: false } : i)),
    }));
  }, [gameState.items, gameState.economy?.priceIndex, updateMoney]);

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

    // Energy is now deducted in the UI when hack starts

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
      setGameState(prev => ({
        ...prev,
        stats: {
          ...prev.stats,
          money: Math.max(0, prev.stats.money - 500),
          reputation: Math.max(0, prev.stats.reputation - 5),
        }
      }));
      
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

    // Check if activity already done this week
    const weeklyActivities = gameState.weeklyJailActivities || {};
    const currentWeek = gameState.date.week;
    const lastDoneWeek = weeklyActivities[activityId];
    
    if (lastDoneWeek === currentWeek) {
      return { success: false, message: `You can only do ${activity.name} once per week` };
    }

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

    updateStats({ energy: -activity.energyCost }, false);

    let result: { success: boolean; message: string } = {
      success: false,
      message: 'Unknown activity',
    };

    switch (activity.id) {
      case 'prison_job':
        updateStats({
          money: (activity.payment || 25),
          happiness: 5,
        }, false);
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
          fitness: (activity.fitnessGain || 2),
          health: (activity.healthGain || 5),
          happiness: (activity.happinessGain || -2),
        }, false);
        result = {
          success: true,
          message: '💪 You trained and feel stronger. Fitness and health improved!',
        };
        break;

      case 'library_study':
        updateStats({
          happiness: (activity.happinessGain || 8),
          reputation: (activity.reputationGain || 2),
        }, false);
        result = {
          success: true,
          message: '📚 You studied and feel more educated. Happiness and reputation improved!',
        };
        break;

      case 'prison_garden':
        updateStats({
          money: (activity.payment || 15),
          health: (activity.healthGain || 3),
          happiness: (activity.happinessGain || 5),
        }, false);
        result = {
          success: true,
          message: `🌱 You worked in the garden and earned $${activity.payment || 15}. Health and happiness improved!`,
        };
        break;

      case 'prison_workshop':
        updateStats({
          money: (activity.payment || 40),
        }, false);
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
          updateStats({ happiness: 20 });
          setGameState(prev => ({
            ...prev,
            jailWeeks: 0,
            wantedLevel: prev.wantedLevel + 2, // Reduced from 3
            escapedFromJail: true,
          }));
          result = { success: true, message: '🎉 MIRACLE! You successfully escaped! But you\'re now wanted more than ever.' };
        } else {
          updateStats({
            happiness: -15, // Reduced from -25
            health: -10, // Reduced from -15
          });
          const penalty = 2 + Math.floor(Math.random() * 3); // Reduced: now 2-4 weeks instead of 8-12
          
          setGameState(prev => ({
            ...prev,
            jailWeeks: prev.jailWeeks + penalty,
          }));
          
          result = {
            success: false,
            message: `❌ Escape failed! You were caught and your sentence was extended by ${penalty} weeks.`,
          };
        }
        break;

      case 'bribe_guard':
        const bribeSuccess = Math.random() < (activity.successRate || 0.6);
        if (bribeSuccess) {
          setGameState(prev => ({
            ...prev,
            jailWeeks: 0,
            wantedLevel: prev.wantedLevel + 1,
            stats: {
              ...prev.stats,
              money: prev.stats.money - (activity.cost || 1000),
            },
          }));
          result = { success: true, message: '💰 The guard accepted your bribe. You are free! But your wanted level increased.' };
        } else {
          setGameState(prev => ({
            ...prev,
            stats: {
              ...prev.stats,
              money: prev.stats.money - (activity.cost || 1000),
            },
          }));
          result = { success: false, message: 'The guard refused your bribe and kept the money.' };
        }
        break;

      case 'legal_appeal':
        const appealSuccess = Math.random() < (activity.successRate || 0.4);
        if (appealSuccess) {
          setGameState(prev => ({
            ...prev,
            jailWeeks: 0,
            stats: {
              ...prev.stats,
              money: prev.stats.money - (activity.cost || 500),
            },
          }));
          result = { success: true, message: 'Your legal appeal was successful!' };
        } else {
          setGameState(prev => ({
            ...prev,
            stats: {
              ...prev.stats,
              money: prev.stats.money - (activity.cost || 500),
            },
          }));
          result = { success: false, message: 'Your legal appeal was denied.' };
        }
        break;

      case 'good_behavior':
        setGameState(prev => ({
          ...prev,
          jailWeeks: activity.sentenceReduction ? Math.max(0, prev.jailWeeks - (activity.sentenceReduction || 0)) : prev.jailWeeks,
          stats: {
            ...prev.stats,
            happiness: prev.stats.happiness + (activity.happinessGain || 10),
          },
        }));
        result = {
          success: true,
          message: 'Your good behavior was noted by the guards.',
        };
        break;

      case 'prison_gang':
        const gangSuccess = Math.random() < (activity.successRate || 0.7);
        if (gangSuccess) {
          setGameState(prev => ({
            ...prev,
            criminalXp: prev.criminalXp + (activity.criminalXpGain || 10),
            stats: {
              ...prev.stats,
              reputation: prev.stats.reputation + (activity.reputationGain || 5),
            },
          }));
          result = { success: true, message: '👥 You successfully joined a prison gang and gained respect among inmates.' };
        } else {
          // Small chance to get more jail time for gang violence (5% chance)
          const extraTime = Math.random() < 0.05 ? Math.floor(Math.random() * 3) + 1 : 0;
          setGameState(prev => ({
            ...prev,
            jailWeeks: extraTime > 0 ? prev.jailWeeks + extraTime : prev.jailWeeks,
            stats: {
              ...prev.stats,
              health: prev.stats.health - 15,
              happiness: prev.stats.happiness - 10,
            },
          }));
          
          if (extraTime > 0) {
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

    // Mark activity as done this week if successful
    if (result.success) {
      setGameState(prev => ({
        ...prev,
        weeklyJailActivities: {
          ...prev.weeklyJailActivities,
          [activityId]: currentWeek
        }
      }));
    }

    setTimeout(() => checkAchievements(), 100);
    saveGame();
    return result;
  };

  const payBail = () => {
    // Pay bail debug info
    
    if (gameState.jailWeeks === 0)
      return { success: false, message: 'Not currently jailed' };
    const cost = gameState.jailWeeks * 500;
    if (gameState.stats.money < cost)
      return { success: false, message: `Bail costs $${cost}` };
    
    // Update both money and jail status atomically
    const newState = { 
      ...gameState, 
      jailWeeks: 0, 
      wantedLevel: 0, 
      escapedFromJail: false,
      stats: {
        ...gameState.stats,
        money: gameState.stats.money - cost
      }
    };
    // Setting jail state to cleared and updating money
    
    // Set state and save immediately
    setGameState(newState);
    
    // Force save with the new state
    setTimeout(() => {
      // Saving game after bail payment
      saveGame();
    }, 100);
    
    // Bail payment completed
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
      money: -price,
      health: food.healthRestore,
      energy: food.energyRestore,
    }, false);
  };

  const performHealthActivity: GameContextType['performHealthActivity'] = activityId => {
    const activity = gameState.healthActivities.find(a => a.id === activityId);
    if (!activity) return;
    const price = getInflatedPrice(activity.price, gameState.economy.priceIndex);
    
    // Only check money if the activity costs money
    if (price > 0 && gameState.stats.money < price) return;

    const energyCost = activity.energyCost || 0;
    
    // Only check energy requirement if the activity costs energy (positive value)
    if (energyCost > 0 && gameState.stats.energy < energyCost) return;

    // Calculate energy change (negative values restore energy, positive values cost energy)
    const energyChange = -energyCost; // Negative energyCost means energy gain

    updateStats({
      money: -price, // Pass negative value to subtract from current money
      happiness: activity.happinessGain,
      health: activity.healthGain || 0,
      energy: energyChange,
    });

    let message: string | undefined;

    if (activity.id === 'doctor') {
      if (gameState.diseases.length > 0) {
        if (Math.random() < 0.5) {
          const curableDiseases = gameState.diseases.filter(d => d.curable);
          const remaining = gameState.diseases.filter(d => !d.curable);
          setGameState(prev => ({ 
            ...prev, 
            diseases: remaining,
            showCureSuccessModal: true,
            curedDiseases: curableDiseases.map(d => d.name)
          }));
          message = 'The doctor cured all your treatable health issues!';
        } else {
          message = 'The doctor could not cure your conditions.';
        }
      }
    } else if (activity.id === 'hospital') {
      if (gameState.diseases.length > 0) {
        const curableDiseases = gameState.diseases.filter(d => d.curable);
        const remaining = gameState.diseases.filter(d => !d.curable);
        if (remaining.length < gameState.diseases.length) {
          setGameState(prev => ({ 
            ...prev, 
            diseases: remaining,
            showCureSuccessModal: true,
            curedDiseases: curableDiseases.map(d => d.name)
          }));
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

    // Cooldown: cannot get engaged in the first 36 weeks
    if ((gameState.week ?? 0) < 36) {
      return { success: false, message: 'You need to wait until week 36 to get engaged.' };
    }

    const cost = 5000;
    if (gameState.stats.money < cost) {
      return { success: false, message: 'You need $5,000 for an engagement ring!' };
    }

    const successChance = partner.relationshipScore;
    const success = Math.random() * 100 < successChance;

    setGameState(prev => ({
      ...prev,
      stats: {
        ...prev.stats,
        money: prev.stats.money - cost
      }
    }));

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

    // Cooldown: cannot have a child in the first 36 weeks
    if ((gameState.week ?? 0) < 36) {
      return { success: false, message: 'You need to wait until week 36 to have a child.' };
    }

    const cost = 10000;
    if (gameState.stats.money < cost) {
      return { success: false, message: 'You need $10,000 for hospital costs!' };
    }

    setGameState(prev => ({
      ...prev,
      stats: {
        ...prev.stats,
        money: prev.stats.money - cost
      }
    }));

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
    setGameState(prev => ({
      ...prev,
      stats: {
        ...prev.stats,
        money: prev.stats.money - cost
      }
    }));
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
    setGameState(prev => ({
      ...prev,
      stats: {
        ...prev.stats,
        money: prev.stats.money - 20
      }
    }));
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
    updateStats({ energy: -10 });
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
      
      // Update stock holdings with current prices
      if (gameState.stocks?.holdings) {
        const updatedHoldings = gameState.stocks.holdings.map(holding => ({
          ...holding,
          currentPrice: getStockInfo(holding.symbol).price
        }));
        
        setGameState(prev => ({
          ...prev,
          stocks: {
            ...prev.stocks,
            holdings: updatedHoldings,
            watchlist: prev.stocks?.watchlist || []
          }
        }));
      }
      
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
      console.log('Jail release - Current money before release:', gameState.stats.money);
      const updatedStats = {
        ...gameState.stats, // This preserves all stats including money
        health: Math.max(0, Math.min(100, gameState.stats.health + (jailResult.statsChange.health || 0))),
        happiness: Math.max(0, Math.min(100, gameState.stats.happiness + (jailResult.statsChange.happiness || 0))),
        energy: 100, // Always restore full energy when getting out of jail
        // Explicitly preserve money - no change to money during jail release
        money: gameState.stats.money,
      };
      console.log('Jail release - Money after release:', updatedStats.money);
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
        weeklyJailActivities: {}, // Reset jail activities when getting out of jail
        dailySummary: (Platform.OS === 'web' || prev.settings.notificationsEnabled)
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

    // Gaming and streaming earnings
    let gamingEarnings = 0;
    let streamingEarnings = 0;
    
    if (gameState.gamingStreaming) {
      // Calculate gaming earnings from videos
      const gamingData = gameState.gamingStreaming;
      if (gamingData.videos && gamingData.videos.length > 0) {
        gamingEarnings = gamingData.videos.reduce((sum, video) => {
          // Calculate earnings based on views and engagement
          const baseEarnings = video.views * 0.01; // $0.01 per view
          return sum + baseEarnings;
        }, 0);
      }
      
      // Calculate streaming earnings from stream history
      if (gamingData.streamHistory && gamingData.streamHistory.length > 0) {
        streamingEarnings = gamingData.streamHistory.reduce((sum, stream) => {
          // Calculate earnings based on viewers and duration (donations are added immediately)
          const viewerEarnings = stream.viewers * 0.005; // $0.005 per viewer per stream (4x nerf)
          const durationEarnings = stream.duration * 0.02; // $0.02 per minute (5x nerf)
          // Donations are now added immediately during streaming, not in weekly calculation
          return sum + viewerEarnings + durationEarnings;
        }, 0);
      }
    }
    
    if (gamingEarnings > 0) {
      moneyChange += gamingEarnings;
      events.push(`Gaming earnings $${gamingEarnings.toFixed(2)}`);
    }
    
    if (streamingEarnings > 0) {
      moneyChange += streamingEarnings;
      events.push(`Streaming earnings $${streamingEarnings.toFixed(2)}`);
    }

    const familyExpense =
      (gameState.family.spouse?.expenses || 0) +
      gameState.family.children.reduce((sum, c) => sum + (c.expenses || 0), 0);
    if (familyExpense > 0) {
      moneyChange -= familyExpense;
      events.push(`Family expenses $${familyExpense}`);
    }

    // Automatic loan payments
    const loans = (gameState as any).loans || [];
    if (loans.length > 0) {
      let totalLoanPayments = 0;
      const updatedLoans = loans.map((loan: any) => {
        if (loan.remaining <= 0) return loan;
        
        const weeklyPayment = loan.weeklyPayment || 0;
        if (weeklyPayment > 0) {
          totalLoanPayments += weeklyPayment;
          const newRemaining = Math.max(0, loan.remaining - weeklyPayment);
          return { ...loan, remaining: newRemaining };
        }
        return loan;
      }).filter((loan: any) => loan.remaining > 0); // Remove fully paid loans
      
      if (totalLoanPayments > 0) {
        moneyChange -= totalLoanPayments;
        events.push(`Automatic loan payments: -$${totalLoanPayments.toFixed(2)}`);
        
        // Update loans in game state
        setGameState(prev => ({
          ...prev,
          loans: updatedLoans,
        }));
      }
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

    const petHappinessBonus = pets.reduce(
      (sum, p) => (p.hunger < 50 && p.happiness >= 35 ? sum + 5 : sum),
      0
    );
    if (petHappinessBonus > 0) {
      statsChange.happiness = (statsChange.happiness || 0) + petHappinessBonus;
      events.push(`Pets brought you joy (+${petHappinessBonus} happiness)`);
    }

    const petHealthBonus = pets.reduce(
      (sum, p) => (p.health >= 70 ? sum + 3 : sum),
      0
    );
    if (petHealthBonus > 0) {
      statsChange.health = (statsChange.health || 0) + petHealthBonus;
      events.push(`Healthy pets improved your wellbeing (+${petHealthBonus} health)`);
    }

    const checkForDisease = () => {
      const baseChance = 2;
      let diseaseChance = baseChance;

      // Health and happiness penalties (unchanged)
      if (gameState.stats.happiness < 30) diseaseChance += 3;
      if (gameState.stats.health < 30) diseaseChance += 4;
      
      // Fitness-based disease resistance
      // Higher fitness significantly reduces disease chance
      if (gameState.stats.fitness < 30) {
        diseaseChance += 3; // Low fitness penalty
      } else if (gameState.stats.fitness >= 80) {
        diseaseChance -= 1.5; // High fitness bonus (reduces chance)
      } else if (gameState.stats.fitness >= 60) {
        diseaseChance -= 0.5; // Medium fitness bonus
      }
      
      // Ensure disease chance doesn't go below 0.1% (minimum risk)
      diseaseChance = Math.max(0.1, diseaseChance);

      // Debug logging for fitness-based disease resistance
      if (__DEV__) {
        console.log(`Disease check - Fitness: ${gameState.stats.fitness}, Disease chance: ${diseaseChance.toFixed(2)}%`);
      }

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
          setGameState(prev => ({ ...prev, showSicknessModal: true }));

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
      // Only show sickness modal if it's not already showing
      if (!gameState.showSicknessModal) {
        setGameState(prev => ({ ...prev, showSicknessModal: true }));
      }
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
    let salaryEarnings = 0;
    if (gameState.currentJob) {
      const career = gameState.careers.find(c => c.id === gameState.currentJob);
      if (career) {
        const weeklySalary = career.levels[career.level].salary;
        salaryEarnings = weeklySalary;
        moneyChange += weeklySalary;
        events.push(`Earned weekly salary: $${weeklySalary}`);

        statsChange.happiness = (statsChange.happiness || 0) - 15;
        statsChange.health = (statsChange.health || 0) - 5;

        const progressGain = Math.floor(Math.random() * 5) + 2; // Reduced from 5-15 to 2-7 (2x slower)
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

    // Warehouse mining earnings
    if (gameState.warehouse && gameState.warehouse.selectedCrypto && Object.keys(gameState.warehouse.miners).length > 0) {
      const minerEarnings: Record<string, number> = {
        basic: 22,
        advanced: 105,
        pro: 438,
        industrial: 1575,
        quantum: 7000,
        mega: 35000,
        giga: 140000,
        tera: 700000,
      };
      const minerPower: Record<string, number> = {
        basic: 10,
        advanced: 35,
        pro: 100,
        industrial: 250,
        quantum: 500,
        mega: 2000,
        giga: 5000,
        tera: 15000,
      };

      // Crypto mining difficulty multipliers
      const cryptoMiningMultipliers: Record<string, number> = {
        'btc': 1.0,
        'eth': 0.8,
        'sol': 0.6,
        'link': 0.5,
        'dot': 0.4,
        'matic': 0.3,
        'ada': 0.2,
        'xrp': 0.1,
      };

      const selectedCrypto = gameState.cryptos.find(c => c.id === gameState.warehouse?.selectedCrypto);
      const difficultyMultiplier = cryptoMiningMultipliers[gameState.warehouse.selectedCrypto] || 1.0;

      if (selectedCrypto) {
        const weeklyMiningEarnings = Object.entries(gameState.warehouse.miners).reduce(
          (sum, [id, count]) => sum + (minerEarnings[id] || 0) * count * difficultyMultiplier,
          0
        );
        const totalPower = Object.entries(gameState.warehouse.miners).reduce(
          (sum, [id, count]) => sum + (minerPower[id] || 0) * count,
          0
        );

        const cryptoEarned = weeklyMiningEarnings / selectedCrypto.price;
        cryptoEarnings[selectedCrypto.id] = (cryptoEarnings[selectedCrypto.id] || 0) + cryptoEarned;
        events.push(`Warehouse mined ${cryptoEarned.toFixed(6)} ${selectedCrypto.symbol} (≈$${weeklyMiningEarnings.toFixed(2)})`);

        // Power costs
        const weeklyPowerCost = totalPower * 0.40; // $0.40 per power unit per week
        moneyChange -= weeklyPowerCost;
        events.push(`Warehouse power costs: -$${weeklyPowerCost.toFixed(2)}`);

        // Auto-repair costs
        if (gameState.warehouse.autoRepairEnabled && gameState.warehouse.autoRepairCryptoId) {
          const autoRepairCrypto = gameState.cryptos.find(c => c.id === gameState.warehouse?.autoRepairCryptoId);
          if (autoRepairCrypto && autoRepairCrypto.owned >= (gameState.warehouse.autoRepairWeeklyCost || 0)) {
            const autoRepairCost = gameState.warehouse.autoRepairWeeklyCost || 0;
            setGameState(prev => ({
              ...prev,
              cryptos: prev.cryptos.map(c => 
                c.id === gameState.warehouse?.autoRepairCryptoId 
                  ? { ...c, owned: c.owned - autoRepairCost }
                  : c
              ),
            }));
            events.push(`Auto-repair service: -${autoRepairCost.toFixed(6)} ${autoRepairCrypto.symbol}`);
          }
        }
      }
    }

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
    let sponsorEarnings = 0;
    const hobbySponsorUpdates = gameState.hobbies.map(h => {
      if (!h.sponsors || h.sponsors.length === 0) return h;
      const activeSponsors: Sponsor[] = [];
      h.sponsors.forEach(s => {
        sponsorEarnings += s.weeklyPay;
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
    
    // Reset weekly jail activities for new week
    const resetWeeklyJailActivities = {};
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
    let healthWeeks = gameState.healthWeeks;
    let deathReason: 'happiness' | 'health' | undefined;
    if (updatedStats.happiness <= 0) {
      happinessZeroWeeks += 1;
      console.log('HAPPINESS AT 0 - Week:', happinessZeroWeeks, 'of 4');
      const weeksLeft = 4 - happinessZeroWeeks;
      if (weeksLeft > 0) {
        Alert.alert(
          'Warning',
          `Your happiness is at 0! Increase it within ${weeksLeft} week${
            weeksLeft === 1 ? '' : 's'
          } or your character will die.`
        );
      } else {
        console.log('DEATH BY HAPPINESS - 4 weeks at 0!');
        deathReason = 'happiness';
      }
    } else {
      happinessZeroWeeks = 0;
    }

    if (!deathReason && updatedStats.health <= 0) {
      healthZeroWeeks += 1;
      console.log('HEALTH AT 0 - Week:', healthZeroWeeks, 'of 4');
      const weeksLeft = 4 - healthZeroWeeks;
      if (weeksLeft > 0) {
        Alert.alert(
          'Warning',
          `Your health is at 0! Increase it within ${weeksLeft} week${
            weeksLeft === 1 ? '' : 's'
          } or your character will die.`
        );
      } else {
        console.log('DEATH BY HEALTH - 4 weeks at 0!');
        deathReason = 'health';
      }
    } else if (!deathReason) {
      healthZeroWeeks = 0;
    }

    // Track health weeks for healthy lifestyle achievement
    if (updatedStats.health >= 90) {
      healthWeeks += 1;
    } else {
      healthWeeks = 0; // Reset if health drops below 90
    }

    if (deathReason) {
      console.log('DEATH TRIGGERED:', deathReason, 'happinessZeroWeeks:', happinessZeroWeeks, 'healthZeroWeeks:', healthZeroWeeks);
      
      // Store the state before death for potential revival
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
      
      // Set death state in a single update to prevent race conditions
      setGameState(prev => ({
        ...prev,
        stats: updatedStats,
        happinessZeroWeeks,
        healthZeroWeeks,
        showZeroStatPopup: false,
        zeroStatType: undefined,
        showDeathPopup: true,
        deathReason,
      }));
      
      console.log('DEATH POPUP SHOULD BE SHOWING NOW');
      
      // Safety mechanism: Force show death popup after a short delay if it doesn't appear
      setTimeout(() => {
        setGameState(prev => {
          if (!prev.showDeathPopup) {
            console.log('DEATH POPUP NOT SHOWING - FORCING DISPLAY');
            return {
              ...prev,
              showDeathPopup: true,
              deathReason: deathReason || 'health',
            };
          }
          return prev;
        });
      }, 100);
      
      // Additional safety: Emergency fallback after 2 seconds
      setTimeout(() => {
        setGameState(prev => {
          if (!prev.showDeathPopup) {
            console.error('DEATH POPUP STILL NOT SHOWING - EMERGENCY FALLBACK');
            // Force a complete state reset to show death popup
            return {
              ...prev,
              showDeathPopup: true,
              deathReason: deathReason || 'health',
              showZeroStatPopup: false,
              zeroStatType: undefined,
            };
          }
          return prev;
        });
      }, 2000);
      
      return;
    }

    setTimeout(() => checkAchievements(), 100);

    // Update money immediately for better UX
    setGameState(prev => ({
      ...prev,
      stats: {
        ...prev.stats,
        money: prev.stats.money + moneyChange,
      },
    }));

    // Commit weekly summary + stats with a slight delay to prevent UI blocking
    setTimeout(() => {
      setGameState(prev => {
        const stateWithInflation = applyWeeklyInflation(prev);
        return {
          ...stateWithInflation,
          day: prev.day + 1,
          date: newDate,
          dailySummary: (() => {
            const shouldShow = stateWithInflation.settings.weeklySummaryEnabled && (nextWeeksLived % 4 === 0);
            if (__DEV__) {
              console.log('GameContext - Setting dailySummary:', shouldShow, 'weeklySummaryEnabled:', stateWithInflation.settings.weeklySummaryEnabled, 'nextWeeksLived:', nextWeeksLived, 'nextWeeksLived % 4:', nextWeeksLived % 4);
            }
            return shouldShow;
          })()
            ? {
                moneyChange,
                statsChange,
                events,
                earningsBreakdown: {
                  gaming: gamingEarnings,
                  streaming: streamingEarnings,
                  passive: passiveIncome,
                  salary: salaryEarnings,
                  sponsors: sponsorEarnings,
                  other: 0, // Will be updated for other earnings
                },
              }
            : undefined,
          stats: updatedStats,
          pets,
          pendingEvents: weeklyEvents,
          happinessZeroWeeks,
          healthZeroWeeks,
          healthWeeks,
          totalHappiness: nextTotalHappiness,
          weeksLived: nextWeeksLived,
          jailWeeks,
          wantedLevel,
          weeklyJailActivities: resetWeeklyJailActivities, // Reset jail activities for new week
        };
      });
    }, 50);

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


  const dismissSicknessModal = () => {
    setGameState(prev => ({ ...prev, showSicknessModal: false }));
  };

  const dismissCureSuccessModal = () => {
    setGameState(prev => ({ ...prev, showCureSuccessModal: false, curedDiseases: [] }));
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

    setGameState(prev => ({
      ...prev,
      stats: {
        ...prev.stats,
        money: prev.stats.money - cost
      }
    }));
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
    
    // Ensure all required fields exist with comprehensive validation
    if (!state.stats) state.stats = initialGameState.stats;
    if (!state.settings) state.settings = initialGameState.settings;
    if (!state.achievements) state.achievements = initialGameState.achievements;
    if (!state.perks) state.perks = {};
    if (!state.bankSavings) state.bankSavings = 0;
    if (!state.stocks) state.stocks = { holdings: [], watchlist: [] };
    if (!state.realEstate) state.realEstate = [];
    if (!state.companies) state.companies = [];
    if (!state.relationships) state.relationships = [];
    if (!state.items) state.items = initialGameState.items;
    if (!state.foods) state.foods = initialGameState.foods;
    if (!state.careers) state.careers = initialGameState.careers;
    if (!state.hobbies) state.hobbies = initialGameState.hobbies;
    if (!state.educations) state.educations = initialGameState.educations;
    if (!state.cryptos) state.cryptos = initialGameState.cryptos;
    if (!state.economy) state.economy = initialGameState.economy;
    if (!state.social) state.social = initialGameState.social;
    if (!state.family) state.family = initialGameState.family;
    if (!state.streetJobs) state.streetJobs = initialGameState.streetJobs;
    if (!state.crimeSkills) state.crimeSkills = initialGameState.crimeSkills;
    if (!state.darkWebItems) state.darkWebItems = initialGameState.darkWebItems;
    if (!state.pendingEvents) state.pendingEvents = [];
    if (!state.eventLog) state.eventLog = [];
    if (!state.claimedProgressAchievements) state.claimedProgressAchievements = [];
    if (!state.streetJobsCompleted) state.streetJobsCompleted = 0;
    if (!state.completedGoals) state.completedGoals = [];
    if (!state.happinessZeroWeeks) state.happinessZeroWeeks = 0;
    if (!state.healthZeroWeeks) state.healthZeroWeeks = 0;
    if (!state.healthWeeks) state.healthWeeks = 0;
    if (!state.progress) state.progress = { achievements: [] };
    if (!state.journal) state.journal = [];
    if (!state.scenarioId) state.scenarioId = undefined;
    if (!state.wantedLevel) state.wantedLevel = 0;
    if (!state.jailWeeks) state.jailWeeks = 0;
    if (!state.escapedFromJail) state.escapedFromJail = false;
    if (!state.criminalXp) state.criminalXp = 0;
    if (!state.criminalLevel) state.criminalLevel = 1;
    if (!state.showWelcomePopup) state.showWelcomePopup = true;
    if (!state.currentJob) state.currentJob = undefined;
    if (!state.company) state.company = undefined;
    if (!state.hasPhone) state.hasPhone = false;
    if (!state.showZeroStatPopup) state.showZeroStatPopup = false;
    if (!state.zeroStatType) state.zeroStatType = undefined;
    if (!state.showDeathPopup) state.showDeathPopup = false;
    if (!state.deathReason) state.deathReason = undefined;
    if (!state.lastLogin) state.lastLogin = Date.now();
    if (state.totalHappiness === undefined) state.totalHappiness = 0;
    if (state.weeksLived === undefined) state.weeksLived = 0;
    if (!state.updatedAt) state.updatedAt = Date.now();
    if (!state.weeklyJailActivities) state.weeklyJailActivities = {};
    if (version < STATE_VERSION) state.version = STATE_VERSION;

    // Ensure gamingStreaming block exists and has all required fields (keep scenarios/perks out)
    const gs = state.gamingStreaming || {};
    const eq = gs.equipment || {};
    const pc = gs.pcComponents || {};
    const lv = gs.pcUpgradeLevels || {};
    state.gamingStreaming = {
      followers: gs.followers ?? 0,
      subscribers: gs.subscribers ?? 0,
      totalViews: gs.totalViews ?? 0,
      totalEarnings: gs.totalEarnings ?? 0,
      totalDonations: gs.totalDonations ?? 0,
      totalSubEarnings: gs.totalSubEarnings ?? 0,
      level: gs.level ?? 1,
      experience: gs.experience ?? 0,
      gamesPlayed: gs.gamesPlayed ?? [],
      streamHours: gs.streamHours ?? 0,
      averageViewers: gs.averageViewers ?? 0,
      bestStream: gs.bestStream ?? null,
      currentStream: gs.currentStream ?? null,
      equipment: {
        microphone: eq.microphone ?? false,
        webcam: eq.webcam ?? false,
        gamingChair: eq.gamingChair ?? false,
        greenScreen: eq.greenScreen ?? false,
        lighting: eq.lighting ?? false,
      },
      pcComponents: {
        cpu: pc.cpu ?? false,
        gpu: pc.gpu ?? false,
        ram: pc.ram ?? false,
        ssd: pc.ssd ?? false,
        motherboard: pc.motherboard ?? false,
        cooling: pc.cooling ?? false,
        psu: pc.psu ?? false,
        case: pc.case ?? false,
        network: pc.network ?? false,
      },
      pcUpgradeLevels: {
        cpu: lv.cpu ?? 0,
        gpu: lv.gpu ?? 0,
        ram: lv.ram ?? 0,
        ssd: lv.ssd ?? 0,
        motherboard: lv.motherboard ?? 0,
        cooling: lv.cooling ?? 0,
        psu: lv.psu ?? 0,
        case: lv.case ?? 0,
        network: lv.network ?? 0,
      },
      paidMembers: gs.paidMembers ?? 0,
      membershipRate: gs.membershipRate ?? 4,
      unlockedGames: gs.unlockedGames ?? [],
      ownedGames: gs.ownedGames ?? [],
      streamHistory: gs.streamHistory ?? [],
      videos: gs.videos ?? [],
      videoTitleCounters: gs.videoTitleCounters ?? {},
      videoRecordingState: gs.videoRecordingState ?? {
        isRecording: false,
        recordProgress: 0,
        renderProgress: 0,
        uploadProgress: 0,
        currentPhase: 'idle',
        videoTitle: '',
        videoGame: '',
        isRendering: false,
        isUploading: false,
      },
      streamingState: gs.streamingState ?? {
        isStreaming: false,
        streamProgress: 0,
        totalDonations: 0,
        streamDuration: 0,
        selectedGame: '',
        currentViewers: 0,
        currentSubsGained: 0,
      },
    };
    // Integrity: clamp key numerics to avoid corrupted saves
    const sanitize = (n: any, min = 0): number => {
      const v = typeof n === 'number' && isFinite(n) ? n : 0;
      return v < min ? min : v;
    };
    if (state.stats) {
      state.stats.money = sanitize(state.stats.money, 0);
      // @ts-ignore
      state.stats.energy = sanitize(state.stats.energy, 0);
    }
    if (state.gamingStreaming) {
      // @ts-ignore
      state.gamingStreaming.totalEarnings = sanitize(state.gamingStreaming.totalEarnings, 0);
      // @ts-ignore
      state.gamingStreaming.totalDonations = sanitize(state.gamingStreaming.totalDonations, 0);
      // @ts-ignore
      state.gamingStreaming.totalSubEarnings = sanitize(state.gamingStreaming.totalSubEarnings, 0);
      // @ts-ignore
      state.gamingStreaming.followers = sanitize(state.gamingStreaming.followers, 0);
      // @ts-ignore
      state.gamingStreaming.subscribers = sanitize(state.gamingStreaming.subscribers, 0);
    }

    return state as GameState;
  };

  const saveGame = useCallback(async (retryCount = 0) => {
    try {
      const stateToSave = {
        ...gameState,
        version: STATE_VERSION,
        updatedAt: Date.now(),
        lastLogin: Date.now(),
      };

      // Validate state before saving
      if (!stateToSave.stats || !stateToSave.settings) {
        throw new Error('Invalid game state structure');
      }

      // Save global gems separately
      await AsyncStorage.setItem('globalGems', gameState.stats.gems.toString());

      // Use save queue to prevent race conditions
      await queueSave(currentSlot, stateToSave);

      // Cloud save with error handling
      try {
        await uploadGameState({ state: stateToSave, updatedAt: stateToSave.updatedAt });
        const playerName = stateToSave.userProfile.name || 'Player';
        const wealthScore = netWorth(stateToSave);
        const topCareer = stateToSave.careers.reduce((m, c) => Math.max(m, c.level), 0);
        const topSkill = stateToSave.hobbies.reduce((m, h) => Math.max(m, h.skill), 0);

        await uploadLeaderboardScore({ category: 'wealth', name: playerName, score: wealthScore });
        await uploadLeaderboardScore({ category: 'career', name: playerName, score: topCareer });
        await uploadLeaderboardScore({ category: 'skills', name: playerName, score: topSkill });
        // Cloud save successful
      } catch (cloudError) {
        console.warn('Cloud save failed, but local save succeeded:', cloudError);
      }

      // Game saved successfully
    } catch (error) {
      console.error('Save error:', error);
      
      // Fallback to force save
      try {
        const stateToSave = {
          ...gameState,
          version: STATE_VERSION,
          updatedAt: Date.now(),
          lastLogin: Date.now(),
        };
        await forceSave(currentSlot, stateToSave);
      } catch (fallbackError) {
        console.error('Force save also failed:', fallbackError);
        
        if (retryCount < 3) {
          // Retrying save
          setTimeout(() => saveGame(retryCount + 1), 1000);
        } else {
          console.error('Failed to save game after 3 retries');
        }
      }
    }
  }, [gameState, currentSlot]);

  // Update saveGame ref whenever saveGame changes (prevents dependency loop)
  useEffect(() => {
    saveGameRef.current = saveGame;
  }, [saveGame]);

  // Debounced autosave on state changes (prevents rapid save storms)
  useEffect(() => {
    if (isLoading) return;
    if (saveDebounceRef.current) {
      clearTimeout(saveDebounceRef.current);
      saveDebounceRef.current = null;
    }
    saveDebounceRef.current = setTimeout(() => {
      // Use ref to avoid dependency loop with saveGame
      if (saveGameRef.current) {
        saveGameRef.current();
      }
    }, 500) as any;
    return () => {
      if (saveDebounceRef.current) {
        clearTimeout(saveDebounceRef.current);
        saveDebounceRef.current = null;
      }
    };
  }, [gameState, isLoading]); // Removed saveGame from dependencies

  // Dev transaction log: money + gaming totals
  useEffect(() => {
    if (!__DEV__) return;
    const prev = prevMoneyRef.current;
    const curr = gameState.stats.money;
    if (curr !== prev) {
      const delta = curr - prev;
      // Money change logged
      prevMoneyRef.current = curr;
    }
    const gs: any = (gameState as any).gamingStreaming || {};
    const p = prevTotalsRef.current;
    const te = gs.totalEarnings || 0;
    const td = gs.totalDonations || 0;
    const ts = gs.totalSubEarnings || 0;
    if (te !== p.totalEarnings || td !== p.totalDonations || ts !== p.totalSubEarnings) {
      // Gaming streaming totals logged
      prevTotalsRef.current = { totalEarnings: te, totalDonations: td, totalSubEarnings: ts };
    }
  }, [gameState.stats.money, (gameState as any).gamingStreaming?.totalEarnings, (gameState as any).gamingStreaming?.totalDonations, (gameState as any).gamingStreaming?.totalSubEarnings]);

  const claimProgressAchievement = (id: string, gold: number) => {
    // Ensure claimedProgressAchievements array exists
    const claimedAchievements = gameState.claimedProgressAchievements || [];
    
    // Check if achievement is already claimed
    if (claimedAchievements.includes(id)) {
      console.log(`Achievement ${id} already claimed, skipping`);
      return;
    }
    
    // Find the achievement data to show the popup
    const achievement = gameState.achievements?.find(a => a.id === id);
    if (achievement) {
      // Show achievement popup for progress achievements
      showAchievementToast(achievement.name, achievement.category, gold);
    }
    
    updateStats({ gems: gold }, false);
    setGameState(prev => ({
      ...prev,
      claimedProgressAchievements: [...(prev.claimedProgressAchievements || []), id],
    }));
    saveGame();
  };

  // Wrappers around extracted logic modules
  const createCompany: GameContextType['createCompany'] = companyType => {
    const result = companyLogic.createCompany(
      gameState,
      setGameState,
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

  const buyMiner = (minerId: string, minerName: string, cost: number, companyId?: string) => {
    const result = companyLogic.buyMiner(gameState, setGameState, minerId, minerName, cost, companyId);
    saveGame();
    return result;
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

  const loadGame = useCallback(async (slot?: number) => {
    try {
      const slotToLoad = slot || currentSlot;
      let savedData: string | null = null;
      
      try {
        savedData = await AsyncStorage.getItem(`save_slot_${slotToLoad}`);
      } catch (storageError) {
        console.error('AsyncStorage error while loading game:', storageError);
        Alert.alert(
          'Storage Error',
          'Failed to load game from device storage. Please try restarting the app.',
          [{ text: 'OK' }]
        );
        return;
      }
      
      if (savedData) {
        let loadedState;
        try {
          loadedState = JSON.parse(savedData);
          
          // Validate that the parsed data has the expected structure
          if (!loadedState || typeof loadedState !== 'object') {
            console.error('Invalid game state data structure');
            return;
          }
        } catch (parseError) {
          console.error('Failed to parse saved game data:', parseError);
          return;
        }
        
        // Load global gems with bulletproof recovery
        let globalGems = 0;
        try {
          // Try primary storage first
          let primaryGems = await AsyncStorage.getItem('globalGems');
          if (primaryGems) {
            const parsed = parseInt(primaryGems, 10);
            globalGems = isNaN(parsed) || !isFinite(parsed) ? 0 : Math.max(0, parsed);
            console.log(`Loaded gems from primary storage: ${globalGems}`);
          } else {
            // Try backup storage
            let backupGems = await AsyncStorage.getItem('globalGems_backup');
            if (backupGems) {
              const parsed = parseInt(backupGems, 10);
              globalGems = isNaN(parsed) || !isFinite(parsed) ? 0 : Math.max(0, parsed);
              console.log(`Loaded gems from backup storage: ${globalGems}`);
            } else {
              // Try emergency storage
              let emergencyGems = await AsyncStorage.getItem('globalGems_emergency');
              if (emergencyGems) {
                const parsed = parseInt(emergencyGems, 10);
                globalGems = isNaN(parsed) || !isFinite(parsed) ? 0 : Math.max(0, parsed);
                console.log(`Loaded gems from emergency storage: ${globalGems}`);
              } else {
                console.log('No gem data found in any storage location');
              }
            }
          }
        } catch (error) {
          console.error('Failed to load global gems from all sources:', error);
          // Continue with 0 gems - better than crashing
          globalGems = 0;
        }
        
        // Load permanent perks (perks that persist across all lives)
        let permanentPerks: string[] = [];
        try {
          permanentPerks = await loadPermanentPerks();
          console.log('Loaded permanent perks:', permanentPerks);
        } catch (error) {
          console.error('Failed to load permanent perks:', error);
          // Continue without permanent perks - better than crashing
        }
        
        // Validate and migrate state
        const validatedState = migrateState(loadedState);
        
        // Ensure the state has all required properties
        if (!validatedState.stats || typeof validatedState.stats !== 'object') {
          console.error('Invalid stats structure in loaded state');
          return;
        }
        
        // Ensure all stats are present and valid
        const originalMoney = validatedState.stats?.money ?? 0;
        const validatedStats: GameStats = {
          health: Math.max(0, Math.min(100, validatedState.stats?.health ?? 50)),
          happiness: Math.max(0, Math.min(100, validatedState.stats?.happiness ?? 50)),
          energy: Math.max(0, Math.min(100, validatedState.stats?.energy ?? 50)),
          fitness: Math.max(0, Math.min(100, validatedState.stats?.fitness ?? 50)),
          money: Math.max(0, originalMoney),
          reputation: Math.max(0, Math.min(100, validatedState.stats?.reputation ?? 0)),
          gems: validateGems(globalGems), // Use validated global gems instead of save-specific gems
        };
        
        console.log('Money validation:', {
          originalMoney,
          validatedMoney: validatedStats.money,
          originalStats: validatedState.stats
        });
        
        const now = Date.now();
        
        // Apply permanent perks to the game state
        const perksWithPermanent = { ...(validatedState.perks || {}) };
        permanentPerks.forEach(perkId => {
          perksWithPermanent[perkId] = true;
        });
        
        let updatedState: GameState = {
          ...validatedState,
          stats: validatedStats,
          perks: perksWithPermanent,
          version: STATE_VERSION,
          lastLogin: now,
        };
        
        // Daily reward logic - only give reward if it's been more than 24 hours since last login
        let rewardMsg: string | null = null;
        const lastLoginTime = loadedState.lastLogin || 0;
        const timeSinceLastLogin = now - lastLoginTime;
        const oneDayInMs = 24 * 60 * 60 * 1000;
        
        console.log('Daily reward check:', {
          lastLoginTime,
          now,
          timeSinceLastLogin,
          oneDayInMs,
          shouldGiveReward: lastLoginTime > 0 && timeSinceLastLogin > oneDayInMs,
          currentMoney: updatedState.stats.money
        });
        
        // Only give daily reward if it's been more than 24 hours AND we have a valid lastLogin time
        // AND the user doesn't already have significant money (to prevent reset issues)
        // AND the user is not coming out of jail (to prevent money reset after jail)
        let dailyRewardAmount = 0;
        if (lastLoginTime > 0 && timeSinceLastLogin > oneDayInMs && updatedState.stats.money < 50 && updatedState.jailWeeks === 0) {
          const worth = netWorth(updatedState);
          const moneyBonus = Math.max(50, Math.floor(worth * 0.001)); // Reduced minimum from 100 to 50
          dailyRewardAmount = moneyBonus;
          console.log('Giving daily reward:', { worth, moneyBonus, oldMoney: updatedState.stats.money });
          updatedState = {
            ...updatedState,
            stats: {
              ...updatedState.stats,
              money: updatedState.stats.money + moneyBonus,
              gems: updatedState.stats.gems + 1,
            },
            showDailyRewardPopup: true,
            dailyRewardAmount: moneyBonus,
          };
        } else if (lastLoginTime > 0 && timeSinceLastLogin > oneDayInMs) {
          // Give gems but not money if user already has money or is coming out of jail
          updatedState = {
            ...updatedState,
            stats: {
              ...updatedState.stats,
              gems: updatedState.stats.gems + 1,
            },
            showDailyRewardPopup: true,
            dailyRewardAmount: 0, // No money bonus, just gems
          };
        }
        
        // Ensure completedGoals is initialized
        if (!updatedState.completedGoals) {
          updatedState.completedGoals = [];
        }
        
        // Ensure claimedProgressAchievements is initialized
        if (!updatedState.claimedProgressAchievements) {
          updatedState.claimedProgressAchievements = [];
        }
        
        setGameState(updatedState);
        setCurrentSlot(slotToLoad);
        
        // Game loaded successfully
      } else {
        // No save data found - load global gems for new game with bulletproof recovery
        let globalGems = 0;
        try {
          // Try primary storage first
          let primaryGems = await AsyncStorage.getItem('globalGems');
          if (primaryGems) {
            globalGems = parseInt(primaryGems, 10);
            console.log(`New game - loaded gems from primary storage: ${globalGems}`);
          } else {
            // Try backup storage
            let backupGems = await AsyncStorage.getItem('globalGems_backup');
            if (backupGems) {
              globalGems = parseInt(backupGems, 10);
              console.log(`New game - loaded gems from backup storage: ${globalGems}`);
            } else {
              // Try emergency storage
              let emergencyGems = await AsyncStorage.getItem('globalGems_emergency');
              if (emergencyGems) {
                globalGems = parseInt(emergencyGems, 10);
                console.log(`New game - loaded gems from emergency storage: ${globalGems}`);
              } else {
                console.log('New game - no gem data found, starting with 0 gems');
              }
            }
          }
        } catch (error) {
          console.error('Failed to load global gems for new game:', error);
        }
        
        // Set gems in the initial state with validation
        setGameState(prev => ({
          ...prev,
          stats: {
            ...prev.stats,
            gems: validateGems(globalGems),
          },
        }));
      }
    } catch (error) {
      console.error('Failed to load game:', error);
    }
  }, [currentSlot]);

  useEffect(() => {
    if (gameState.settings.autoSave && gameState.scenarioId) {
      saveGame();
    }
  }, [gameState, saveGame]);

  // Monitor gem changes and save to global storage with multiple backups
  useEffect(() => {
    const saveGlobalGemsBulletproof = async () => {
      try {
        const gemValue = gameState.stats.gems;
        const timestamp = Date.now();
        
        // Primary storage
        try {
          await AsyncStorage.setItem('globalGems', gemValue.toString());
          await AsyncStorage.setItem('globalGems_timestamp', timestamp.toString());
        } catch (storageError) {
          console.error('AsyncStorage error saving global gems:', storageError);
        }
        
        // Backup storage with timestamp
        try {
          await AsyncStorage.setItem('globalGems_backup', gemValue.toString());
          await AsyncStorage.setItem('globalGems_backup_timestamp', timestamp.toString());
        } catch (backupError) {
          console.error('Failed to save gem backup:', backupError);
        }
        
        // Emergency backup (always try to save even if others fail)
        try {
          await AsyncStorage.setItem('globalGems_emergency', gemValue.toString());
        } catch (emergencyError) {
          console.error('Failed to save emergency gem backup:', emergencyError);
        }
        
        console.log(`Gems saved: ${gemValue} (timestamp: ${timestamp})`);
      } catch (error) {
        console.error('Failed to save global gems:', error);
      }
    };
    
    saveGlobalGemsBulletproof();
  }, [gameState.stats.gems]);

  useEffect(() => {
    if (gameState.settings.notificationsEnabled && Platform.OS !== 'web') {
      scheduleDailyReminder();
    } else {
      cancelDailyReminder();
    }
  }, [gameState.settings.notificationsEnabled]);

  // Periodic gem backup system - runs every 2 minutes to ensure gems are always saved
  useEffect(() => {
    if (isLoading) return;
    
    const backupInterval = setInterval(async () => {
      try {
        const currentGems = gameState.stats.gems;
        const timestamp = Date.now();
        
        // Silent backup - don't spam console
        await AsyncStorage.setItem('globalGems_backup', currentGems.toString());
        await AsyncStorage.setItem('globalGems_backup_timestamp', timestamp.toString());
        
        // Emergency backup
        await AsyncStorage.setItem('globalGems_emergency', currentGems.toString());
      } catch (error) {
        console.warn('Periodic gem backup failed:', error);
      }
    }, 120000); // 2 minutes
    
    return () => clearInterval(backupInterval);
  }, [gameState.stats.gems, isLoading]);

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
    // Simulate IAP purchase for perk
    console.log(`IAP Perk purchase initiated: ${perkId}`);
    
    // Give the perk immediately
    setGameState(prev => ({
      ...prev,
      perks: {
        ...prev.perks,
        [perkId]: true,
      },
    }));
    
    // Show success message
    Alert.alert(
      'Purchase Successful!',
      `You have unlocked the ${perkId.replace(/_/g, ' ')} perk!`,
      [{ text: 'Continue' }]
    );
    
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
      // Simulate IAP purchase for money pack
      console.log(`IAP Money pack purchase initiated: ${packId}`);
      
      // Give the money immediately
      setGameState(prev => ({
        ...prev,
        stats: {
          ...prev.stats,
          money: prev.stats.money + amount
        }
      }));
      
      // Show success message
      Alert.alert(
        'Purchase Successful!',
        `You received $${amount.toLocaleString()}!`,
        [{ text: 'Continue' }]
      );
      
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
      // Simulate IAP purchase for gem pack
      console.log(`IAP Gem pack purchase initiated: ${packId}`);
      
      // Give the gems immediately
      updateStats({ gems: gameState.stats.gems + amount }, false);
      
      // Show success message
      Alert.alert(
        'Purchase Successful!',
        `You received ${amount} gems!`,
        [{ text: 'Continue' }]
      );
      
      saveGame();
    }
  };

  const buyRevival = async () => {
    try {
      console.log('IAP Revival purchase initiated');
      
      // Safety check: Ensure IAP service is initialized
      if (!iapService) {
        console.error('IAP service not available');
        Alert.alert(
          'Service Unavailable',
          'The purchase service is not available. Please restart the app and try again.',
          [{ text: 'OK' }]
        );
        return;
      }
      
      // Use the IAP service to purchase the revival pack with extra error handling
      let result;
      try {
        result = await iapService.purchaseProduct(IAP_PRODUCTS.REVIVAL_PACK);
      } catch (purchaseError: any) {
        console.error('IAP purchase error:', purchaseError);
        Alert.alert(
          'Purchase Failed',
          purchaseError?.message || 'Unable to complete purchase. Please check your connection and try again.',
          [{ text: 'OK' }]
        );
        return;
      }
      
      // Safety check: Ensure result exists
      if (!result || typeof result !== 'object') {
        console.error('Invalid purchase result:', result);
        Alert.alert(
          'Purchase Failed',
          'Unable to complete purchase. Please try again or contact support.',
          [{ text: 'OK' }]
        );
        return;
      }
      
      if (result.success) {
        // The purchase was successful and benefits are applied by IAPService
        // We need to reload the game state from AsyncStorage to get the updates
        const gameStateJson = await AsyncStorage.getItem('gameState');
        if (gameStateJson) {
          const updatedState = JSON.parse(gameStateJson);
          setGameState(updatedState);
        }
        
        // Show success message
        Alert.alert(
          'Purchase Successful!',
          'You have been revived! Your character is back to life with restored health and happiness.',
          [{ text: 'Continue' }]
        );
      } else {
        // Purchase failed
        console.error('Revival purchase failed:', result.message);
        Alert.alert(
          'Purchase Failed',
          result.message || 'Unable to complete the revival purchase. Please try again.',
          [{ text: 'OK' }]
        );
      }
    } catch (error: any) {
      console.error('Error during revival purchase:', error);
      Alert.alert(
        'Error',
        error?.message || 'An error occurred while processing your purchase. Please try again.',
        [{ text: 'OK' }]
      );
    }
  };

  // Permanent Perks System - Perks that persist across all lives/saves
  const loadPermanentPerks = async (): Promise<string[]> => {
    try {
      const perksJson = await AsyncStorage.getItem('permanent_perks');
      if (perksJson) {
        return JSON.parse(perksJson);
      }
      return [];
    } catch (error) {
      console.error('Error loading permanent perks:', error);
      return [];
    }
  };

  const savePermanentPerk = async (perkId: string): Promise<void> => {
    try {
      const currentPerks = await loadPermanentPerks();
      if (!currentPerks.includes(perkId)) {
        currentPerks.push(perkId);
        await AsyncStorage.setItem('permanent_perks', JSON.stringify(currentPerks));
        console.log('Permanent perk saved:', perkId);
      }
    } catch (error) {
      console.error('Error saving permanent perk:', error);
    }
  };

  const hasPermanentPerk = async (perkId: string): Promise<boolean> => {
    const perks = await loadPermanentPerks();
    return perks.includes(perkId);
  };

  // Daily Challenges System
  const initializeDailyChallenges = useCallback(() => {
    const { generateDailyChallenges, shouldResetChallenges } = require('@/utils/dailyChallenges');
    
    // Check if we need to reset challenges
    const currentChallenges = gameState.dailyChallenges;
    const now = Date.now();
    
    if (!currentChallenges || shouldResetChallenges(currentChallenges.lastRefresh)) {
      const todaysChallenges = generateDailyChallenges();
      
      // Create deep copy of current state for initial state tracking
      const initialState = JSON.parse(JSON.stringify(gameState));
      
      setGameState(prev => ({
        ...prev,
        dailyChallenges: {
          easy: { 
            id: todaysChallenges.easy.id, 
            progress: 0, 
            claimed: false, 
            initialState 
          },
          medium: { 
            id: todaysChallenges.medium.id, 
            progress: 0, 
            claimed: false, 
            initialState 
          },
          hard: { 
            id: todaysChallenges.hard.id, 
            progress: 0, 
            claimed: false, 
            initialState 
          },
          lastRefresh: now,
        },
      }));
    }
  }, [gameState]);

  const updateDailyChallengeProgress = useCallback(() => {
    const { generateDailyChallenges } = require('@/utils/dailyChallenges');
    
    if (!gameState.dailyChallenges) return;
    
    const todaysChallenges = generateDailyChallenges();
    
    // Get challenge definitions
    const easyChallenge = todaysChallenges.easy;
    const mediumChallenge = todaysChallenges.medium;
    const hardChallenge = todaysChallenges.hard;
    
    // Calculate progress
    const easyProgress = easyChallenge.checkProgress(
      gameState, 
      gameState.dailyChallenges.easy.initialState
    );
    const mediumProgress = mediumChallenge.checkProgress(
      gameState, 
      gameState.dailyChallenges.medium.initialState
    );
    const hardProgress = hardChallenge.checkProgress(
      gameState, 
      gameState.dailyChallenges.hard.initialState
    );
    
    setGameState(prev => ({
      ...prev,
      dailyChallenges: prev.dailyChallenges ? {
        ...prev.dailyChallenges,
        easy: { ...prev.dailyChallenges.easy, progress: easyProgress },
        medium: { ...prev.dailyChallenges.medium, progress: mediumProgress },
        hard: { ...prev.dailyChallenges.hard, progress: hardProgress },
      } : undefined,
    }));
  }, [gameState]);

  const claimDailyChallengeReward = useCallback((difficulty: 'easy' | 'medium' | 'hard') => {
    const { generateDailyChallenges } = require('@/utils/dailyChallenges');
    
    if (!gameState.dailyChallenges) return { success: false, message: 'No challenges available' };
    
    const challenge = gameState.dailyChallenges[difficulty];
    if (challenge.claimed) {
      return { success: false, message: 'Already claimed' };
    }
    
    const todaysChallenges = generateDailyChallenges();
    const challengeDef = todaysChallenges[difficulty];
    
    // Check if completed
    if (challenge.progress < challengeDef.maxProgress) {
      return { success: false, message: 'Challenge not completed' };
    }
    
    // Award reward
    const reward = challengeDef.reward;
    updateStats({ gems: gameState.stats.gems + reward }, false);
    
    // Mark as claimed
    setGameState(prev => ({
      ...prev,
      dailyChallenges: prev.dailyChallenges ? {
        ...prev.dailyChallenges,
        [difficulty]: { ...prev.dailyChallenges[difficulty], claimed: true },
      } : undefined,
    }));
    
    return { success: true, message: `+${reward} gems!`, reward };
  }, [gameState, updateStats]);

  const clearSaveSlot = async (slot: number) => {
    try {
      // Clear all save-related data for the specified slot
      await AsyncStorage.removeItem(`save_slot_${slot}`);
      await AsyncStorage.removeItem(`save_slot_${slot}_backup`);
      await AsyncStorage.removeItem(`save_slot_${slot}_temp`);
      await AsyncStorage.removeItem(`cloud_save_slot_${slot}`);
      await AsyncStorage.removeItem(`cloud_save_slot_${slot}_backup`);
      await AsyncStorage.removeItem(`cache_slot_${slot}`);
      
      // If this is the current slot, also clear lastSlot
      if (slot === currentSlot) {
        await AsyncStorage.removeItem('lastSlot');
      }
      
      console.log(`Save slot ${slot} cleared successfully`);
    } catch (error) {
      console.error(`Failed to clear save slot ${slot}:`, error);
      throw error;
    }
  };

  const buyGoldUpgrade = (upgradeId: string) => {
    const costs = {
      multiplier: 10000,
      skip_week: 5000,
      youth_pill: 20000,
      energy_boost: 15000,
      happiness_boost: 12000,
      fitness_boost: 18000,
      reputation_boost: 25000,
      skill_mastery: 30000,
      time_machine: 50000,
      immortality: 100000,
    } as const;

    const cost = costs[upgradeId as keyof typeof costs];
    if (!cost) return;
    if (gameState.stats.gems < cost) {
      Alert.alert('Not enough gems');
      return;
    }

    if (upgradeId === 'multiplier') {
      // Permanent money multiplier that transfers to all future lives
      updateStats({ gems: gameState.stats.gems - cost }, false);
      setGameState(prev => ({
        ...prev,
        goldUpgrades: {
          ...prev.goldUpgrades,
          multiplier: true,
        },
      }));
      Alert.alert('Permanent Money Multiplier', 'Money multiplier activated! This buff will transfer to all future lives and saves.');
      saveGame();
    } else if (upgradeId === 'skip_week') {
      updateStats({ gems: gameState.stats.gems - cost }, false);
      nextWeek();
      saveGame();
    } else if (upgradeId === 'youth_pill') {
      updateStats({ gems: gameState.stats.gems - cost }, false);
      setGameState(prev => ({
        ...prev,
        date: { ...prev.date, age: 18 },
      }));
      saveGame();
    } else if (upgradeId === 'energy_boost') {
      updateStats({ gems: gameState.stats.gems - cost, energy: 100 }, false);
      setGameState(prev => ({
        ...prev,
        goldUpgrades: {
          ...prev.goldUpgrades,
          energy_boost: true,
        },
      }));
      Alert.alert('Permanent Energy Boost', 'Maximum energy increased to 100! This buff transfers to future lives.');
      saveGame();
    } else if (upgradeId === 'happiness_boost') {
      updateStats({ gems: gameState.stats.gems - cost, happiness: 100 }, false);
      setGameState(prev => ({
        ...prev,
        goldUpgrades: {
          ...prev.goldUpgrades,
          happiness_boost: true,
        },
      }));
      Alert.alert('Permanent Happiness Boost', 'Maximum happiness increased to 100! This buff transfers to future lives.');
      saveGame();
    } else if (upgradeId === 'fitness_boost') {
      updateStats({ gems: gameState.stats.gems - cost, fitness: 100 }, false);
      setGameState(prev => ({
        ...prev,
        goldUpgrades: {
          ...prev.goldUpgrades,
          fitness_boost: true,
        },
      }));
      Alert.alert('Permanent Fitness Boost', 'Maximum fitness increased to 100! This buff transfers to future lives.');
      saveGame();
    } else if (upgradeId === 'reputation_boost') {
      updateStats({ gems: gameState.stats.gems - cost, reputation: 100 }, false);
      saveGame();
    } else if (upgradeId === 'skill_mastery') {
      updateStats({ gems: gameState.stats.gems - cost }, false);
      setGameState(prev => ({
        ...prev,
        goldUpgrades: {
          ...prev.goldUpgrades,
          skill_mastery: true,
        },
      }));
      Alert.alert('Skill Mastery', 'All skills now level up 50% faster! This buff transfers to future lives.');
      saveGame();
    } else if (upgradeId === 'time_machine') {
      updateStats({ gems: gameState.stats.gems - cost }, false);
      setGameState(prev => ({
        ...prev,
        goldUpgrades: {
          ...prev.goldUpgrades,
          time_machine: true,
        },
      }));
      Alert.alert('Time Machine', 'You can now travel back in time! This ability transfers to future lives.');
      saveGame();
    } else if (upgradeId === 'immortality') {
      updateStats({ gems: gameState.stats.gems - cost }, false);
      setGameState(prev => ({
        ...prev,
        goldUpgrades: {
          ...prev.goldUpgrades,
          immortality: true,
        },
      }));
      Alert.alert('Immortality', 'You are now immortal! This status transfers to all future lives.');
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

  // Apply permanent stat boosts from gold upgrades
  useEffect(() => {
    if (gameState.goldUpgrades?.energy_boost) {
      setGameState(prev => ({
        ...prev,
        stats: {
          ...prev.stats,
          energy: Math.max(prev.stats.energy, 100),
        },
      }));
    }
    if (gameState.goldUpgrades?.happiness_boost) {
      setGameState(prev => ({
        ...prev,
        stats: {
          ...prev.stats,
          happiness: Math.max(prev.stats.happiness, 100),
        },
      }));
    }
    if (gameState.goldUpgrades?.fitness_boost) {
      setGameState(prev => ({
        ...prev,
        stats: {
          ...prev.stats,
          fitness: Math.max(prev.stats.fitness, 100),
        },
      }));
    }
  }, [gameState.goldUpgrades]);

  // Warehouse functions
  const buyWarehouse = (): { success: boolean; message?: string } => {
    const warehouseCost = 25000; // Base cost for warehouse
    
    if (gameState.stats.money < warehouseCost) {
      return { success: false, message: 'Not enough money to buy a warehouse' };
    }
    
    if (gameState.warehouse) {
      return { success: false, message: 'You already own a warehouse' };
    }
    
    setGameState(prev => ({
      ...prev,
      warehouse: {
        level: 1,
        miners: {},
      },
      stats: {
        ...prev.stats,
        money: prev.stats.money - warehouseCost,
      },
    }));
    
    saveGame();
    return { success: true, message: 'Successfully purchased warehouse!' };
  };

  const upgradeWarehouse = (): { success: boolean; message?: string } => {
    if (!gameState.warehouse) {
      return { success: false, message: 'You need to buy a warehouse first' };
    }
    
    const currentLevel = gameState.warehouse.level;
    const upgradeCost = 15000 * currentLevel; // Increasing cost per level
    
    if (gameState.stats.money < upgradeCost) {
      return { success: false, message: 'Not enough money to upgrade warehouse' };
    }
    
    if (currentLevel >= 10) {
      return { success: false, message: 'Warehouse is already at maximum level' };
    }
    
    setGameState(prev => ({
      ...prev,
      warehouse: prev.warehouse ? {
        ...prev.warehouse,
        level: prev.warehouse.level + 1,
      } : undefined,
      stats: {
        ...prev.stats,
        money: prev.stats.money - upgradeCost,
      },
    }));
    
    saveGame();
    return { success: true, message: `Successfully upgraded warehouse to level ${currentLevel + 1}!` };
  };

  const selectWarehouseMiningCrypto = (cryptoId: string): void => {
    if (!gameState.warehouse) return;
    
    setGameState(prev => ({
      ...prev,
      warehouse: prev.warehouse ? {
        ...prev.warehouse,
        selectedCrypto: cryptoId,
      } : undefined,
    }));
  };

  // Show loading screen while initializing
  if (isLoading) {
    return (
      <PremiumLoadingScreen
        progress={loadingProgress}
        message={loadingMessage}
        isCacheClearing={isCacheClearing}
        oldVersion={cacheUpdateInfo.oldVersion}
        newVersion={cacheUpdateInfo.newVersion}
      />
    );
  }

  return (
    <GameContext.Provider
      value={{
        gameState,
        setGameState,
        updateGameState: setGameState,
        updateMoney,
        batchUpdateMoney,
        applyPerkEffects,
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
        dismissSicknessModal,
        dismissCureSuccessModal,
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
        buyRevival,
        clearSaveSlot,
        savePermanentPerk,
        hasPermanentPerk,
        loadPermanentPerks,
        initializeDailyChallenges,
        updateDailyChallengeProgress,
        claimDailyChallengeReward,
        buyMiner,
        buyWarehouse,
        upgradeWarehouse,
        selectMiningCrypto,
        selectWarehouseMiningCrypto,
        completeMinigame,
        saveGame,
        loadGame,
        currentSlot,
        restartGame,
        reviveCharacter,
        checkAchievements,
        recordRelationshipAction,
        claimProgressAchievement,
        triggerCacheClear,
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
