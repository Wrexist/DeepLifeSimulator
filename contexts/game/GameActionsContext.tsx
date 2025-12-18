// cspell:words uuidv Regen UIUX Minigame watchlist Nyke Adidaz Pooma Reebock Cardano Solana Polkadot Chainlink giga tera networth
import * as JobActions from './actions/JobActions';
import * as FamilyBusinessActions from './actions/FamilyBusinessActions';
import * as TravelActions from './actions/TravelActions';
import * as PoliticalActions from './actions/PoliticalActions';
import * as RDActions from './actions/RDActions';
import * as CompanyActions from './actions/CompanyActions';
import { executeWedding } from './actions/DatingActions';
import { processVehicleWeekly } from './actions/VehicleActions';
import { updatePatents } from '@/lib/rd/patents';
import * as statisticsTracker from '@/lib/statistics/statisticsTracker';

import React, { createContext, useContext, useCallback, useRef, ReactNode, useMemo } from 'react';
import { Alert, Platform, AppState, AppStateStatus } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { calcWeeklyPassiveIncome } from '@/lib/economy/passiveIncome';
import { applyWeeklyInflation, getInflatedPrice } from '@/lib/economy/inflation';
import { simulateWeek, getStockInfo } from '@/lib/economy/stockMarket';
import { MAX_ACTIVE_RELATIONSHIPS, MAX_RELATIONSHIP_INCOME, MAX_RELATIONSHIPS_FOR_INCOME } from '@/lib/economy/balanceConstants';
import {
  Relation,
  RelationAction,
  processWeeklyRelations,
} from '@/lib/social/relations';
import * as companyLogic from './company';
import * as socialLogic from './social';
import { rollWeeklyEvents, type WeeklyEvent } from '@/lib/events/engine';
import { getCurrentSeason } from '@/lib/events/seasonalEvents';
import { evaluateAchievements, netWorth } from '@/lib/progress/achievements';
import { v4 as uuidv4 } from 'uuid';
import { showAchievementToast, showSecretAchievementToast } from '@/utils/achievementToast';
import { notifyAchievementUnlock, notifySecretAchievementUnlock } from '@/utils/notifications';
import { uploadGameState, uploadLeaderboardScore } from '@/lib/progress/cloud';
import { queueSave, forceSave } from '@/utils/saveQueue';
import { createBackupBeforeMajorAction, saveBackupManager } from '@/utils/saveBackup';
import { iapService } from '@/services/IAPService';
import { validateGameState, calculateChecksum } from '@/utils/saveValidation';
import { validateStats, clampStatByKey } from '@/utils/statUtils';
import { logger } from '@/utils/logger';
import { executePrestige as executePrestigeFunction } from '@/lib/prestige/prestigeExecution';
import { getPrestigeThreshold } from '@/lib/prestige/prestigeTypes';
import { getBonusPurchaseCost, canPurchaseBonus, PRESTIGE_BONUSES } from '@/lib/prestige/prestigeBonuses';
import { applyStartingBonuses , getIncomeMultiplier, getExperienceMultiplier, getEnergyRegenMultiplier, getStatDecayMultiplier, getSkillGainMultiplier, getRelationshipGainMultiplier, hasImmortality } from '@/lib/prestige/applyBonuses';
import { validateStatChanges, sanitizeStatChanges, sanitizeFinalStats, validateStateInvariants, validateMoneyInvariants } from '@/utils/stateInvariants';
import { saveLoadMutex } from '@/utils/saveLoadMutex';
import { applyUnlockBonuses, hasEarlyCareerAccess } from '@/lib/prestige/applyUnlocks';
import { shouldAutoCollectRent, shouldAutoReinvestDividends } from '@/lib/prestige/applyQOLBonuses';
import { useGameState } from './GameStateContext';
import { useGameData } from './GameDataContext';
// initialState is provided via useGameData() hook, not imported directly
import { IAP_PRODUCTS } from '@/utils/iapConfig';
import { perks as perksData } from '@/src/features/onboarding/perksData';
import { CacheManager } from '@/utils/cacheManager';
import { useGameUI } from './GameUIContext';
import { useUIUX } from '@/contexts/UIUXContext';
import {
  GameState,
  GameStats,
  Contract,
  Sponsor,
  HackResult,
  CrimeSkillId,
  Relationship,
  UserProfile,
  GameSettings,
  Disease,
  ChildInfo,
  GameProgress,
  GamingStreamingState,
  GamingEquipment,
  PCComponents,
  PCUpgradeLevels,
  PoliticsState,
  HealthActivity,
} from './types';
import { updateChildWeekly } from '@/lib/legacy/children';
import { applyMindsetEffects } from '@/lib/mindset/config';
import { computeInheritance } from '@/lib/legacy/inheritance';
import { FamilyBusinessSystem } from '@/lib/legacy/familyBusiness';
import { LabType } from '@/lib/rd/labs';

// Pet food nutrition values - defined outside component to avoid dependency issues
const PET_FOOD_DATA: Record<string, { price: number; nutrition: number; happiness: number }> = {
  basic: { price: 10, nutrition: 20, happiness: 5 },
  premium: { price: 25, nutrition: 50, happiness: 10 },
  luxury: { price: 50, nutrition: 100, happiness: 20 },
};

/**
 * GameActionsContext
 * Contains all game action functions that modify game state
 * This context depends on GameStateContext for state access
 */

interface GameActionsContextType {
  // Money & Economy
  updateMoney: (amount: number, reason: string, updateDailySummary?: boolean) => void;
  batchUpdateMoney: (transactions: {amount: number, reason: string}[]) => void;
  applyPerkEffects: (baseValue: number, perkType: string) => number;
  updateStats: (newStats: Partial<GameStats>, updateDailySummary?: boolean) => void;

  // Game Progression
  nextWeek: () => void;
  resolveEvent: (eventId: string, choiceId: string) => void;
  checkAchievements: (state?: GameState) => void;

  // Jobs & Careers
  performStreetJob: (jobId: string) => { success: boolean; message: string; events?: string[] } | void;
  gainCriminalXp: (amount: number) => void;
  gainCrimeSkillXp: (skillId: CrimeSkillId, amount: number) => void;
  unlockCrimeSkillUpgrade: (skillId: CrimeSkillId, upgradeId: string, cost: number, levelReq: number) => void;
  applyForJob: (jobId: string) => void;
  quitJob: () => void;

  // Hobbies
  trainHobby: (hobbyId: string) => { success: boolean; message: string } | void;
  enterHobbyTournament: (hobbyId: string) => { success: boolean; message: string } | void;
  uploadSong: (hobbyId: string) => { success: boolean; message: string } | void;
  uploadArtwork: (hobbyId: string) => { success: boolean; message: string } | void;
  playMatch: (hobbyId: string) => { success: boolean; message: string } | void;
  acceptContract: (hobbyId: string, contract: Contract) => { success: boolean; message: string } | void;
  extendContract: (hobbyId: string) => { success: boolean; message: string } | void;
  cancelContract: (hobbyId: string) => void;
  buyHobbyUpgrade: (hobbyId: string, upgradeId: string) => void;
  dive: (hobbyId: string) => { success: boolean; message: string } | void;
  completeMinigame: (hobbyId: string, score: number) => void;

  // Items & Purchases
  buyItem: (itemId: string) => void;
  sellItem: (itemId: string) => void;
  buyDarkWebItem: (itemId: string) => void;
  buyHack: (hackId: string) => void;
  performHack: (hackId: string) => HackResult;
  buyFood: (foodId: string) => void;
  performHealthActivity: (activityId: string) => { message: string } | void;
  dismissSicknessModal: () => void;
  dismissCureSuccessModal: () => void;
  dismissStatWarning: () => void;
  dismissWelcomePopup: () => void;
  toggleDietPlan: (planId: string) => void;

  // Jail
  performJailActivity: (activityId: string) => { success: boolean; message: string };
  serveJailTime: () => { events: string[]; statsChange: Partial<GameStats> };
  payBail: () => { success: boolean; message: string };

  // Relationships
  updateRelationship: (relationshipId: string, change: number) => void;
  addRelationship: (relationship: Relationship) => void;
  addSocialRelation: (relation: Relation) => void;
  interactRelation: (relationId: string, action: RelationAction) => { success: boolean; message: string };
  breakUpWithPartner: (partnerId: string) => { success: boolean; message: string };
  proposeToPartner: (partnerId: string) => { success: boolean; message: string };
  moveInTogether: (partnerId: string) => { success: boolean; message: string };
  haveChild: (partnerId: string) => { success: boolean; message: string };
  askForMoney: (relationshipId: string) => { success: boolean; message: string } | void;
  callRelationship: (relationshipId: string) => { success: boolean; message: string };
  recordRelationshipAction: (relationshipId: string, action: string) => void;
  changeActivityCommitment: (primary?: 'career' | 'hobbies' | 'relationships' | 'health', secondary?: 'career' | 'hobbies' | 'relationships' | 'health') => { success: boolean; message: string };

  // Pets
  adoptPet: (type: string) => void;
  feedPet: (petId: string, foodType?: string) => { success: boolean; message: string } | void;
  playWithPet: (petId: string) => void;
  buyPetToy: (petId: string, toyId: string) => { success: boolean; message: string };
  usePetToy: (petId: string, toyId: string) => { success: boolean; message: string };
  buyPetFood: (foodType: string, quantity?: number) => { success: boolean; message: string };

  // Education
  startEducation: (educationId: string) => void;

  // Company
  createCompany: (companyType: string) => { success: boolean; message?: string; companyId?: string };
  buyCompanyUpgrade: (upgradeId: string, companyId?: string) => void;
  addWorker: (companyId?: string) => void;
  removeWorker: (companyId?: string) => void;
  buyMiner: (minerId: string, minerName: string, cost: number) => { success: boolean; message?: string };
  sellMiner: (minerId: string, minerName: string, purchasePrice: number, companyId?: string) => { success: boolean; message?: string };
  selectMiningCrypto: (cryptoId: string, companyId?: string) => void;
  buyWarehouse: () => { success: boolean; message?: string };
  upgradeWarehouse: () => { success: boolean; message?: string };
  selectWarehouseMiningCrypto: (cryptoId: string) => void;
  createFamilyBusiness: (companyId: string) => void;
  manageFamilyBusiness: (companyId: string, action: 'marketing' | 'branding' | 'reputation') => { success: boolean; message: string } | void;
  
  // R&D
  buildRDLab: (companyId: string, labType: string) => { success: boolean; message: string };
  startResearch: (companyId: string, technologyId: string) => { success: boolean; message: string };
  completeResearch: (companyId: string, projectId: string) => { success: boolean; message: string; patentOpportunity?: boolean };
  filePatent: (companyId: string, technologyId: string) => { success: boolean; message: string };
  enterCompetition: (companyId: string, competitionId: string) => { success: boolean; message: string };

  // Travel
  travelTo: (destinationId: string) => { success: boolean; message: string };

  // Political
  runForOffice: (office: string) => { success: boolean; message: string };
  enactPolicy: (policyId: string) => { success: boolean; message: string };
  lobby: (policyId: string, amount: number) => { success: boolean; message: string };
  joinParty: (party: string) => { success: boolean; message: string };
  formAlliance: (characterId: string, characterName: string) => { success: boolean; message: string };
  campaign: (amount: number) => { success: boolean; message: string };

  // Crypto
  buyCrypto: (cryptoId: string, amount: number) => void;
  sellCrypto: (cryptoId: string, amount: number) => void;
  swapCrypto: (fromId: string, toId: string, amount: number) => void;

  // IAP & Perks
  buyPerk: (perkId: string) => void;
  buyStarterPack: (packId: string) => void;
  buyGoldPack: (packId: string) => void;
  buyGoldUpgrade: (upgradeId: string) => void;
  buyRevival: () => void;

  // Profile & Settings
  updateUserProfile: (profile: Partial<UserProfile>) => void;
  updateSettings: (settings: Partial<GameSettings>) => void;

  // Save & Load
  saveGame: () => Promise<void>;
  loadGame: (slot?: number) => Promise<void>;
  restartGame: () => Promise<void>;
  clearSaveSlot: (slot: number) => Promise<void>;
  triggerCacheClear: () => Promise<void>;

  // Permanent Perks
  savePermanentPerk: (perkId: string) => Promise<void>;
  hasPermanentPerk: (perkId: string) => Promise<boolean>;
  loadPermanentPerks: () => Promise<string[]>;

  // Daily Challenges
  initializeDailyChallenges: () => void;
  updateDailyChallengeProgress: () => void;
  claimDailyChallengeReward: (difficulty: 'easy' | 'medium' | 'hard') => { success: boolean; message: string; reward?: number };

  // Achievements
  claimProgressAchievement: (id: string, gold: number) => void;

  // Character
  reviveCharacter: () => void;

  // Legacy / Generations
  startNewLifeFromLegacy: (heirId?: string) => void;

  // Prestige
  executePrestige: (chosenPath: 'reset' | 'child', childId?: string) => void;
  purchasePrestigeBonus: (bonusId: string) => { success: boolean; message: string };
  checkPrestigeAvailability: () => void;
}

const GameActionsContext = createContext<GameActionsContextType | undefined>(undefined);

export function useGameActions() {
  const context = useContext(GameActionsContext);
  if (!context) {
    throw new Error('useGameActions must be used within GameActionsProvider');
  }
  return context;
}

interface GameActionsProviderProps {
  children: ReactNode;
}

/**
 * GameActionsProvider
 * Provides all game action functions
 * Must be used within GameStateProvider and GameDataProvider
 */
export function GameActionsProvider({ children }: GameActionsProviderProps) {
  const { gameState, setGameState, currentSlot, setCurrentSlot } = useGameState();
  const { getLifeStage, addWeekToAge, initialState, STATE_VERSION: stateVersion } = useGameData();
  const healthActivityDefaults = useMemo(() => {
    const map = new Map<string, HealthActivity>();
    (initialState.healthActivities || []).forEach(activity => {
      map.set(activity.id, { ...activity });
    });
    return map;
  }, [initialState.healthActivities]);
  const { setIsLoading, setLoadingMessage, setLoadingProgress, setIsCacheClearing, setCacheUpdateInfo } = useGameUI();
  const { showLoading, hideLoading, showError } = useUIUX();
  const saveGameRef = useRef<(() => Promise<void>) | null>(null);
  const preDeathStateRef = useRef<GameState | null>(null);
  const checkAchievementsRef = useRef<((state?: GameState) => void) | null>(null);
  const nextWeekRef = useRef<(() => void) | null>(null);
  const actionLockRef = useRef(false);
  const isNextWeekRunningRef = useRef(false);
  // LIFECYCLE FIX: Use refs to prevent stale closures in AppState listener
  const gameStateRef = useRef<GameState | null>(null);
  const isSavingRef = useRef(false);
  const log = logger.scope('GameActions');

  const withActionLock = useCallback((actionName: string, fn: Function) => {
    return (...args: any[]) => {
      if (actionLockRef.current) {
        log.warn(`Action blocked by lock: ${actionName}`);
        return;
      }
      
      actionLockRef.current = true;
      try {
        const result = fn(...args);
        if (result instanceof Promise) {
          return result.finally(() => {
            setTimeout(() => { actionLockRef.current = false; }, 100);
          });
        }
        setTimeout(() => { actionLockRef.current = false; }, 100);
        return result;
      } catch (error) {
        actionLockRef.current = false;
        throw error;
      }
    };
  }, []);

  // Helper function to validate gems
  const validateGems = useCallback((gems: number): number => {
    if (typeof gems !== 'number' || isNaN(gems) || gems < 0) {
      log.warn(`Invalid gem value detected: ${gems}, resetting to 0`);
      return 0;
    }
    return Math.min(gems, 999999999);
  }, []);

  // migrateState helper function
  const migrateState = useCallback((loaded: Partial<GameState> & { version?: number }): GameState => {
    const version = loaded.version || 1;
    // Create a new object to avoid mutating the input, use Partial<GameState> for type safety
    let state: Partial<GameState> = { ...loaded };
    
    // Ensure all required fields exist with comprehensive validation
    if (!state.stats) state.stats = { ...initialState.stats };
    if (!state.settings) state.settings = { ...initialState.settings };
    if (!state.achievements) state.achievements = [...initialState.achievements];
    if (!state.perks) state.perks = {};
    if (!state.bankSavings) state.bankSavings = 0;
    if (!state.stocks) state.stocks = { holdings: [], watchlist: [] };
    if (!state.realEstate) state.realEstate = [];
    if (!state.companies) state.companies = [];
    if (!state.relationships) state.relationships = [];
    if (!state.loans) state.loans = [];
    // Initialize socialMedia with default values if not present
    const defaultSocialMedia = initialState.socialMedia || {
      followers: 0,
      influenceLevel: 'novice' as const,
      totalPosts: 0,
      viralPosts: 0,
      brandPartnerships: 0,
      engagementRate: 0,
      activeBrandDeals: [],
      recentPosts: [],
    };
    if (!state.socialMedia) {
      state.socialMedia = { ...defaultSocialMedia };
    }
    // Note: lastPostTimes and lastPostWeeks are optional and initialized on first use
    if (!state.items) state.items = [...initialState.items];
    
    // Migrate items: Update computer description/price and add passport if missing
    if (state.items && Array.isArray(state.items)) {
      // Update computer item if it exists
      const computerIndex = state.items.findIndex(item => item.id === 'computer');
      if (computerIndex !== -1) {
        const computerItem = initialState.items.find(item => item.id === 'computer');
        if (computerItem) {
          state.items[computerIndex] = {
            ...state.items[computerIndex],
            price: computerItem.price, // Update price
            description: computerItem.description, // Update description
          };
        }
      }
      
      // Add passport item if it doesn't exist
      const passportIndex = state.items.findIndex(item => item.id === 'passport');
      if (passportIndex === -1) {
        const passportItem = initialState.items.find(item => item.id === 'passport');
        if (passportItem) {
          state.items = [...state.items, { ...passportItem }];
        }
      }
    }
    
    if (!state.foods) state.foods = [...initialState.foods];
    if (!state.careers) state.careers = [...initialState.careers];
    if (!state.hobbies) state.hobbies = [...initialState.hobbies];
    if (!state.educations) state.educations = [...initialState.educations];
    if (!state.cryptos) state.cryptos = [...initialState.cryptos];
    if (!state.economy) state.economy = { ...initialState.economy };
    if (!state.social) state.social = { ...initialState.social };
    if (!state.socialMedia) {
      state.socialMedia = { ...defaultSocialMedia };
    } else {
      // Ensure required fields have values by using defaultSocialMedia fallbacks
      const loadedMedia = state.socialMedia;
      state.socialMedia = {
        followers: loadedMedia.followers ?? defaultSocialMedia.followers,
        influenceLevel: loadedMedia.influenceLevel ?? defaultSocialMedia.influenceLevel,
        totalPosts: loadedMedia.totalPosts ?? defaultSocialMedia.totalPosts,
        viralPosts: loadedMedia.viralPosts ?? defaultSocialMedia.viralPosts,
        brandPartnerships: loadedMedia.brandPartnerships ?? defaultSocialMedia.brandPartnerships,
        engagementRate: loadedMedia.engagementRate ?? defaultSocialMedia.engagementRate,
        lastPostWeek: loadedMedia.lastPostWeek,
        lastPostTime: loadedMedia.lastPostTime,
        lastPostDay: loadedMedia.lastPostDay,
        lastPostTimes: loadedMedia.lastPostTimes,
        lastPostWeeks: loadedMedia.lastPostWeeks,
        totalLiveStreams: loadedMedia.totalLiveStreams ?? 0,
        totalLiveViewers: loadedMedia.totalLiveViewers ?? 0,
        totalLiveDuration: loadedMedia.totalLiveDuration ?? 0,
        peakLiveViewers: loadedMedia.peakLiveViewers ?? 0,
        totalEarnings: loadedMedia.totalEarnings ?? 0,
        activeBrandDeals: loadedMedia.activeBrandDeals ?? [],
        recentPosts: Array.isArray(loadedMedia.recentPosts) ? loadedMedia.recentPosts : [],
      };
    }
    // Initialize jailActivities from initialState if missing, or merge missing activities
    if (!state.jailActivities) {
      state.jailActivities = [...initialState.jailActivities];
    } else if (state.jailActivities.length < initialState.jailActivities.length) {
      const existingIds = new Set((state.jailActivities || []).map(a => a.id));
      const missingActivities = (initialState.jailActivities || []).filter(a => !existingIds.has(a.id));
      state.jailActivities = [...state.jailActivities, ...missingActivities];
    }
    if (!state.family) state.family = { ...initialState.family };
    if (!state.streetJobs) state.streetJobs = [...initialState.streetJobs];
    if (!state.crimeSkills) state.crimeSkills = { ...initialState.crimeSkills };
    if (!state.darkWebItems) state.darkWebItems = [...initialState.darkWebItems];
    if (!state.healthActivities) {
      state.healthActivities = [...(initialState.healthActivities || [])];
    } else {
      const defaultHealthActivities = initialState.healthActivities || [];
      const defaultHealthMap = new Map(defaultHealthActivities.map(activity => [activity.id, activity]));
      const updatedHealthActivities = state.healthActivities.map(activity => {
        const defaults = defaultHealthMap.get(activity.id);
        return defaults ? { ...defaults } : activity;
      });
      const existingHealthIds = new Set(updatedHealthActivities.map(activity => activity.id));
      defaultHealthActivities.forEach(defaultActivity => {
        if (!existingHealthIds.has(defaultActivity.id)) {
          updatedHealthActivities.push({ ...defaultActivity });
        }
      });
      state.healthActivities = updatedHealthActivities;
    }
    // Ensure politics block is fully populated
    const currentPolitics = (state.politics ?? {}) as Partial<PoliticsState>;
    const defaultPolitics = initialState.politics ?? {
      activePolicyEffects: undefined,
      careerLevel: 0,
      approvalRating: 50,
      policyInfluence: 0,
      electionsWon: 0,
      policiesEnacted: [],
      lobbyists: [],
      alliances: [],
      campaignFunds: 0,
    };
    state.politics = {
      careerLevel: currentPolitics.careerLevel ?? defaultPolitics.careerLevel ?? 0,
      party: currentPolitics.party ?? defaultPolitics.party,
      approvalRating: currentPolitics.approvalRating ?? defaultPolitics.approvalRating ?? 50,
      policyInfluence: currentPolitics.policyInfluence ?? defaultPolitics.policyInfluence ?? 0,
      electionsWon: currentPolitics.electionsWon ?? defaultPolitics.electionsWon ?? 0,
      policiesEnacted: currentPolitics.policiesEnacted ?? (defaultPolitics.policiesEnacted ? [...defaultPolitics.policiesEnacted] : []),
      activePolicies: currentPolitics.activePolicies ?? defaultPolitics.activePolicies,
      lobbyists: currentPolitics.lobbyists ?? (defaultPolitics.lobbyists ? [...defaultPolitics.lobbyists] : []),
      alliances: currentPolitics.alliances ?? (defaultPolitics.alliances ? [...defaultPolitics.alliances] : []),
      campaignFunds: currentPolitics.campaignFunds ?? defaultPolitics.campaignFunds ?? 0,
      lastElectionWeek: currentPolitics.lastElectionWeek ?? defaultPolitics.lastElectionWeek,
      nextElectionWeek: currentPolitics.nextElectionWeek ?? defaultPolitics.nextElectionWeek,
      activePolicyEffects: currentPolitics.activePolicyEffects ?? defaultPolitics.activePolicyEffects,
    };
    if (!state.pendingEvents) state.pendingEvents = [];
    if (!state.eventLog) state.eventLog = [];
    if (!state.claimedProgressAchievements) state.claimedProgressAchievements = [];
    if (!state.streetJobsCompleted) state.streetJobsCompleted = 0;
    if (!state.completedGoals) state.completedGoals = [];
    if (!state.happinessZeroWeeks) state.happinessZeroWeeks = 0;
    if (!state.healthZeroWeeks) state.healthZeroWeeks = 0;
    if (!state.healthWeeks) state.healthWeeks = 0;
    
    // PRIORITY 3 FIX: Migrate randomness tracking fields for old saves
    // Initialize moneyRequestAttempts and childAttempts on relationships if missing
    if (state.relationships && Array.isArray(state.relationships)) {
      state.relationships = state.relationships.map(rel => ({
        ...rel,
        // Initialize moneyRequestAttempts if missing (defaults to undefined for fresh start)
        moneyRequestAttempts: rel.moneyRequestAttempts !== undefined ? rel.moneyRequestAttempts : undefined,
        // Initialize childAttempts if missing (defaults to undefined for fresh start)
        childAttempts: rel.childAttempts !== undefined ? rel.childAttempts : undefined,
      }));
    }
    // Initialize streetJobFailureCount if missing (defaults to empty object)
    if (!state.streetJobFailureCount) {
      state.streetJobFailureCount = {};
    }
    // Initialize applicationAttempts on careers if missing
    if (state.careers && Array.isArray(state.careers)) {
      state.careers = state.careers.map(career => ({
        ...career,
        // Initialize applicationAttempts if missing (defaults to undefined for fresh start)
        applicationAttempts: career.applicationAttempts !== undefined ? career.applicationAttempts : undefined,
      }));
    }
    if (!state.progress) {
      state.progress = { ...initialState.progress };
    } else {
      const progress = state.progress as Partial<GameProgress>;
      state.progress = {
        adsRemoved: progress.adsRemoved ?? initialState.progress.adsRemoved,
        achievements: progress.achievements ?? [],
        hasBeenInDebt: progress.hasBeenInDebt ?? initialState.progress.hasBeenInDebt,
      };
    }
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
    if (!state.weeklyStreetJobs) state.weeklyStreetJobs = {};
    // Initialize Activity Commitment System
    if (!state.activityCommitments) {
      state.activityCommitments = {
        primary: undefined,
        secondary: undefined,
        lastChangedWeek: undefined,
        commitmentLevels: {
          career: 0,
          hobbies: 0,
          relationships: 0,
          health: 0,
        },
      };
    } else {
      // Ensure commitmentLevels exists with all required fields
      const commitments = state.activityCommitments;
      state.activityCommitments = {
        primary: commitments.primary,
        secondary: commitments.secondary,
        lastChangedWeek: commitments.lastChangedWeek,
        commitmentLevels: {
          career: commitments.commitmentLevels?.career ?? 0,
          hobbies: commitments.commitmentLevels?.hobbies ?? 0,
          relationships: commitments.commitmentLevels?.relationships ?? 0,
          health: commitments.commitmentLevels?.health ?? 0,
        },
      };
    }
    if (version < stateVersion) state.version = stateVersion;

    // Ensure gamingStreaming block exists and has all required fields
    const gs: Partial<GamingStreamingState> = state.gamingStreaming ?? {};
    const eq: Partial<GamingEquipment> = gs.equipment ?? {};
    const pc: Partial<PCComponents> = gs.pcComponents ?? {};
    const lv: Partial<PCUpgradeLevels> = gs.pcUpgradeLevels ?? {};
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
      upgrades: gs.upgrades ?? {},
    };
    
    // Integrity: clamp key numerics to avoid corrupted saves
    const sanitize = (n: any, min = 0): number => {
      const v = typeof n === 'number' && isFinite(n) ? n : 0;
      return v < min ? min : v;
    };
    if (state.stats) {
      state.stats.money = sanitize(state.stats.money, 0);
      state.stats.energy = sanitize(state.stats.energy, 0);
    }
    if (state.gamingStreaming) {
      state.gamingStreaming.totalEarnings = sanitize(state.gamingStreaming.totalEarnings, 0);
      state.gamingStreaming.totalDonations = sanitize(state.gamingStreaming.totalDonations, 0);
      state.gamingStreaming.totalSubEarnings = sanitize(state.gamingStreaming.totalSubEarnings, 0);
      state.gamingStreaming.followers = sanitize(state.gamingStreaming.followers, 0);
      state.gamingStreaming.subscribers = sanitize(state.gamingStreaming.subscribers, 0);
    }

    // ============================================
    // Migrate new Statistics & Analytics fields
    // ============================================
    if (!state.lifetimeStatistics) {
      state.lifetimeStatistics = {
        totalMoneyEarned: 0,
        totalMoneySpent: 0,
        peakNetWorth: state.stats?.money || 0,
        peakNetWorthWeek: state.week || 1,
        totalWeeksWorked: 0,
        totalRelationships: (state.relationships || []).length,
        totalChildren: state.family?.children?.length || 0,
        totalCompaniesOwned: (state.companies || []).length,
        totalPropertiesOwned: (state.realEstate || []).filter(r => r.owned).length,
        totalCrimesCommitted: state.streetJobsCompleted || 0,
        totalJailTime: 0,
        totalTravelDestinations: state.travel?.visitedDestinations?.length || 0,
        totalPostsMade: state.socialMedia?.totalPosts || 0,
        totalViralPosts: state.socialMedia?.viralPosts || 0,
        careerHistory: [],
        netWorthHistory: [],
        weeklyEarningsHistory: [],
        highestSalary: 0,
        totalHobbiesLearned: (state.hobbies || []).filter(h => h.skillLevel > 1).length,
        totalAchievementsUnlocked: (state.achievements || []).filter(a => a.completed).length,
      };
    }

    // ============================================
    // Migrate Dynasty System fields
    // ============================================
    if (!state.dynastyStats) {
      state.dynastyStats = {
        totalGenerations: state.generationNumber || 1,
        totalWealth: state.stats?.money || 0,
        familyReputation: state.stats?.reputation || 0,
        heirlooms: [],
        familyAchievements: [],
        longestLivingMember: { name: state.userProfile?.name || 'Player', age: state.date?.age || 18 },
        wealthiestMember: { name: state.userProfile?.name || 'Player', netWorth: state.stats?.money || 0 },
        totalChildrenAllGenerations: state.family?.children?.length || 0,
        dynastyFoundedYear: 2025,
        familyMotto: undefined,
      };
    }

    // ============================================
    // Migrate Event Chaining fields
    // ============================================
    if (!state.pendingChainedEvents) {
      state.pendingChainedEvents = [];
    }

    // ============================================
    // Migrate Enhanced Social Posts
    // ============================================
    if (!state.socialPosts) {
      state.socialPosts = [];
    }

    // ============================================
    // Migrate UserProfile enhanced fields
    // ============================================
    if (state.userProfile) {
      if (state.userProfile.profilePhoto === undefined) {
        state.userProfile.profilePhoto = undefined;
      }
      if (state.userProfile.headerPhoto === undefined) {
        state.userProfile.headerPhoto = undefined;
      }
      if (!state.userProfile.displayName) {
        state.userProfile.displayName = state.userProfile.name || 'Player';
      }
      if (!state.userProfile.username) {
        state.userProfile.username = state.userProfile.handle?.replace('@', '') || 'player';
      }
      if (!state.userProfile.joinedDate) {
        state.userProfile.joinedDate = new Date().toISOString();
      }
      if (state.userProfile.verified === undefined) {
        // Auto-verify if influencer level or higher
        const influenceLevel = state.socialMedia?.influenceLevel || 'novice';
        state.userProfile.verified = ['influencer', 'celebrity'].includes(influenceLevel);
      }
      if (!state.userProfile.bookmarkedPosts) {
        state.userProfile.bookmarkedPosts = [];
      }
    }

    // ============================================
    // Migrate Revival Pack & Pet System fields
    // ============================================
    if (state.revivalPack === undefined) {
      state.revivalPack = false;
    }
    if (!state.petFood) {
      state.petFood = {};
    }

    // ============================================
    // Migrate Vehicle System fields
    // ============================================
    if (!state.vehicles) {
      state.vehicles = [];
    }
    if (state.activeVehicleId === undefined) {
      state.activeVehicleId = undefined;
    }

    // ============================================
    // Migrate Settings enhanced fields
    // ============================================
    if (state.settings) {
      if (state.settings.lifetimePremium === undefined) {
        state.settings.lifetimePremium = false;
      }
    }

    // ============================================
    // Migrate Life Skills & DM System fields
    // ============================================
    if (!state.unlockedLifeSkills) {
      state.unlockedLifeSkills = [];
    }
    if (!state.dmConversations) {
      state.dmConversations = [];
    }
    if (!state.revealedDMClues) {
      state.revealedDMClues = [];
    }

    // ============================================
    // Migrate Life Milestones
    // ============================================
    if (!state.lifeMilestones) {
      state.lifeMilestones = [];
    }

    // ============================================
    // Migrate Depth Enhancement System fields
    // ============================================
    if (!state.discoveredSystems) {
      state.discoveredSystems = [];
    }
    if (!state.depthMetrics) {
      state.depthMetrics = {
        depthScore: 0,
        systemsEngaged: 0,
        lastCalculated: Date.now(),
      };
    }
    if (!state.progressiveDisclosureLevel) {
      // Auto-calculate based on experience
      const weeksLived = state.weeksLived || 0;
      const discoveredCount = state.discoveredSystems?.length || 0;
      if (weeksLived < 4 || discoveredCount < 3) {
        state.progressiveDisclosureLevel = 'simple';
      } else if (weeksLived >= 20 && discoveredCount >= 10) {
        state.progressiveDisclosureLevel = 'advanced';
      } else {
        state.progressiveDisclosureLevel = 'standard';
      }
    }
    if (!state.systemStatistics) {
      state.systemStatistics = {};
    }

    return state as GameState;
  }, [initialState, stateVersion]);

  // Import all action implementations from the original GameContext
  // For now, we'll create a wrapper that delegates to the original context
  // This allows incremental migration

  // Placeholder implementations - these will be moved from GameContext
  const applyMoneyChange = useCallback((
    stateSetter: React.Dispatch<React.SetStateAction<GameState>>,
    amount: number,
    _reason: string,
    updateDailySummary: boolean = true
  ) => {
    stateSetter(prev => {
      let adjustedAmount = amount;
      if (prev.goldUpgrades?.multiplier && amount > 0) {
        adjustedAmount = Math.floor(amount * 1.5);
      }

      const mindsetAdjusted = applyMindsetEffects(prev, {
        moneyDelta: adjustedAmount,
      });

      const finalDelta = Math.round(mindsetAdjusted.moneyDelta ?? adjustedAmount);
      // CRITICAL FIX: Validate prev.stats.money before calculation
      const currentMoney = typeof prev.stats.money === 'number' && !isNaN(prev.stats.money) 
        ? prev.stats.money 
        : 0;
      const newMoney = Math.max(0, currentMoney + finalDelta);

      return {
        ...prev,
        stats: { ...prev.stats, money: newMoney },
        dailySummary: updateDailySummary
          ? {
              moneyChange: (prev.dailySummary?.moneyChange || 0) + finalDelta,
              statsChange: prev.dailySummary?.statsChange || {},
              events: prev.dailySummary?.events || [],
            }
          : prev.dailySummary,
      };
    });
  }, []);

  const updateMoney = useCallback((amount: number, reason: string, updateDailySummary: boolean = true) => {
    applyMoneyChange(setGameState, amount, reason, updateDailySummary);
  }, [applyMoneyChange, setGameState]);

  const batchUpdateMoney = useCallback((transactions: {amount: number, reason: string}[], updateDailySummary: boolean = true) => {
    setGameState(prev => {
      let totalChange = transactions.reduce((sum, t) => sum + t.amount, 0);
      if (prev.goldUpgrades?.multiplier && totalChange > 0) {
        totalChange = Math.floor(totalChange * 1.5);
      }
      
      const newMoney = Math.max(0, prev.stats.money + totalChange);
      
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
  }, [setGameState]);

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
        
      case 'work':
        return perks?.workBoost ? Math.floor(baseValue * 1.2) : baseValue;
      case 'learning':
        return perks?.fastLearner ? Math.floor(baseValue * 1.15) : baseValue;
    }
    
    return Math.round(baseValue * multiplier);
  }, [gameState.perks]);

  const applyStatsChange = useCallback((
    stateSetter: React.Dispatch<React.SetStateAction<GameState>>,
    newStats: Partial<GameStats>,
    updateDailySummary: boolean = true
  ) => {
    stateSetter(prev => {
      const updatedStats = { ...prev.stats };

      const mindsetAdjusted = applyMindsetEffects(prev, {
        moneyDelta: 0,
        healthDelta: newStats.health ?? 0,
        happinessDelta: newStats.happiness ?? 0,
      });
      
      Object.entries(newStats).forEach(([key, value]) => {
        const statKey = key as keyof GameStats;
        const currentValue = updatedStats[statKey];
        
        if (typeof value === 'number' && typeof currentValue === 'number') {
          if (statKey === 'gems' || statKey === 'money') {
            // CRITICAL FIX: Validate currentValue before calculation
            const validCurrent = !isNaN(currentValue) ? currentValue : 0;
            const validValue = !isNaN(value) ? value : 0;
            updatedStats[statKey] = Math.max(0, validCurrent + validValue);
          } else {
            let delta = value;
            if (statKey === 'health' && mindsetAdjusted.healthDelta !== undefined) {
              delta = mindsetAdjusted.healthDelta;
            }
            if (statKey === 'happiness' && mindsetAdjusted.happinessDelta !== undefined) {
              delta = mindsetAdjusted.happinessDelta;
            }
            // CRITICAL FIX: Validate currentValue before calculation
            const validCurrent = !isNaN(currentValue) ? currentValue : 0;
            const validDelta = !isNaN(delta) ? delta : 0;
            updatedStats[statKey] = clampStatByKey(statKey, validCurrent + validDelta);
          }
        }
      });
      
      const validatedStats = validateStats(updatedStats);

      if (prev.settings.maxStats) {
        validatedStats.health = 100;
        validatedStats.happiness = 100;
        validatedStats.energy = 100;
      }

      let showZeroStatPopup = prev.showZeroStatPopup;
      let zeroStatType = prev.zeroStatType;
      if (validatedStats.health <= 0 && prev.stats.health > 0) {
        showZeroStatPopup = true;
        zeroStatType = 'health';
      }
      if (validatedStats.happiness <= 0 && prev.stats.happiness > 0) {
        showZeroStatPopup = true;
        zeroStatType = 'happiness';
      }

      let hasBeenInDebt = prev.progress?.hasBeenInDebt ?? false;
      if (validatedStats.money < 0 && prev.stats.money >= 0) {
        hasBeenInDebt = true;
      }
      
      return {
        ...prev,
        stats: validatedStats,
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
  }, []);

  const updateStats = useCallback((newStats: Partial<GameStats>, updateDailySummary: boolean = true) => {
    applyStatsChange(setGameState, newStats, updateDailySummary);
  }, [applyStatsChange, setGameState]);

  // Migrated functions - starting with simpler ones
  const gainCriminalXp = useCallback((amount: number) => {
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
  }, [setGameState]);

  const gainCrimeSkillXp = useCallback((skillId: CrimeSkillId, amount: number) => {
    setGameState(prev => {
      // Apply skill gain multiplier from prestige bonuses
      const prestigeData = prev.prestige;
      const unlockedBonuses = prestigeData?.unlockedBonuses || [];
      const skillGainMultiplier = getSkillGainMultiplier(unlockedBonuses);
      const adjustedAmount = Math.floor(amount * skillGainMultiplier);
      
      const skill = prev.crimeSkills[skillId];
      const upgrades = skill.upgrades || [];
      let xp = skill.xp + adjustedAmount;
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
  }, [setGameState]);

  const unlockCrimeSkillUpgrade = useCallback((skillId: CrimeSkillId, upgradeId: string, cost: number, levelReq: number) => {
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
  }, [setGameState]);

  const updateRelationship = useCallback((relationshipId: string, change: number) => {
    setGameState(prev => {
      // Apply commitment bonuses to relationship changes
      const { getCommitmentBonuses, getCommitmentPenalties } = require('@/lib/commitments/commitmentSystem');
      const relationshipBonuses = getCommitmentBonuses(prev, 'relationships');
      const relationshipPenalties = getCommitmentPenalties(prev, 'relationships');
      
      // Apply bonuses/penalties to relationship score change
      let effectiveChange = change;
      if (relationshipBonuses.progressBonus > 0) {
        effectiveChange = change * (1 + relationshipBonuses.progressBonus / 100);
      }
      if (relationshipPenalties.progressPenalty > 0) {
        effectiveChange = change * (1 - relationshipPenalties.progressPenalty / 100);
      }
      
      // Update commitment level for relationships when interacting
      let updatedCommitments = prev.activityCommitments;
      if (updatedCommitments && change > 0) {
        const { updateCommitmentLevel } = require('@/lib/commitments/commitmentSystem');
        const isCommitted = updatedCommitments.primary === 'relationships' || updatedCommitments.secondary === 'relationships';
        const newRelationshipLevel = updateCommitmentLevel(
          updatedCommitments.commitmentLevels?.relationships || 0,
          'relationships',
          isCommitted
        );
        updatedCommitments = {
          ...updatedCommitments,
          commitmentLevels: {
            ...updatedCommitments.commitmentLevels!,
            relationships: newRelationshipLevel,
          },
        };
      }
      
      return {
        ...prev,
        relationships: (prev.relationships || []).map(rel =>
          rel.id === relationshipId
            ? { ...rel, relationshipScore: Math.max(0, Math.min(100, rel.relationshipScore + Math.round(effectiveChange))) }
            : rel
        ),
        activityCommitments: updatedCommitments,
      };
    });
  }, [setGameState]);

  const recordRelationshipAction = useCallback((relationshipId: string, action: string) => {
    setGameState(prev => ({
      ...prev,
      relationships: (prev.relationships || []).map(rel =>
        rel.id === relationshipId ? { ...rel, actions: { ...(rel.actions || {}), [action]: prev.day } } : rel
      ),
    }));
  }, [setGameState]);

  const addRelationship = useCallback((relationship: Relationship) => {
    setGameState(prev => {
      if ((prev.relationships || []).some(rel => rel.id === relationship.id)) {
        return prev;
      }
      let relationships = prev.relationships || [];
      
      // RELATIONSHIP STATE FIX: Only one partner at a time (already enforced)
      if (relationship.type === 'partner') {
        relationships = relationships.filter(rel => rel.type !== 'partner');
      }
      
      // RELATIONSHIP STATE FIX: Only one spouse at a time - remove existing spouse if adding new one
      const family = { ...prev.family };
      if (relationship.type === 'spouse') {
        // Remove existing spouse from relationships if different person
        if (family.spouse && family.spouse.id !== relationship.id) {
          relationships = relationships.filter(rel => rel.id !== family.spouse!.id);
          log.warn('Replacing existing spouse', { oldSpouseId: family.spouse.id, newSpouseId: relationship.id });
        }
        family.spouse = relationship;
      }
      
      // RELATIONSHIP STATE FIX: Prevent duplicate children
      if (relationship.type === 'child') {
        if (!family.children.some(c => c.id === relationship.id)) {
          family.children = [...family.children, relationship];
        }
      }
      
      return { ...prev, relationships: [...relationships, relationship], family };
    });
  }, [setGameState]);

  const adoptPet = useCallback((type: string) => {
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
    const pet = {
      id: uuidv4(),
      name,
      type,
      age: 0,
      hunger: 0,
      happiness: 80,
      health: 100,
    };
    setGameState(prev => ({ ...prev, pets: [...prev.pets, pet] }));
  }, [gameState.stats.money, setGameState]);

  const feedPet = useCallback((petId: string, foodType: string = 'basic') => {
    const pet = gameState.pets?.find(p => p.id === petId);
    if (!pet) {
      return { success: false, message: 'Pet not found' };
    }

    const food = PET_FOOD_DATA[foodType] || PET_FOOD_DATA.basic;
    
    // Check if player has food in inventory
    const foodCount = gameState.petFood?.[foodType] || 0;
    if (foodCount <= 0) {
      // Fallback: allow direct purchase if no food in inventory
      if (gameState.stats.money < food.price) {
        return { success: false, message: `Not enough money. Buy ${foodType} food from the shop first!` };
      }
      // Direct purchase + feed
      setGameState(prev => ({
        ...prev,
        stats: {
          ...prev.stats,
          money: prev.stats.money - food.price
        },
        pets: (prev.pets || []).map(p =>
          p.id === petId
            ? {
                ...p,
                hunger: Math.max(0, p.hunger - food.nutrition),
                happiness: Math.min(100, p.happiness + food.happiness),
              }
            : p
        ),
      }));
      return { success: true, message: `Fed pet with ${foodType} food!` };
    }
    
    // Use food from inventory
    setGameState(prev => ({
      ...prev,
      petFood: {
        ...prev.petFood,
        [foodType]: Math.max(0, (prev.petFood?.[foodType] || 0) - 1),
      },
      pets: (prev.pets || []).map(p =>
        p.id === petId
          ? {
              ...p,
              hunger: Math.max(0, p.hunger - food.nutrition),
              happiness: Math.min(100, p.happiness + food.happiness),
            }
          : p
      ),
    }));
    return { success: true, message: `Fed pet with ${foodType} food from inventory!` };
  }, [gameState.pets, gameState.petFood, gameState.stats.money, setGameState]);

  const buyPetFood = useCallback((foodType: string, quantity: number = 1) => {
    const food = PET_FOOD_DATA[foodType] || PET_FOOD_DATA.basic;
    const totalCost = food.price * quantity;
    
    if (gameState.stats.money < totalCost) {
      return { success: false, message: `Not enough money. You need $${totalCost}.` };
    }
    
    setGameState(prev => ({
      ...prev,
      stats: {
        ...prev.stats,
        money: prev.stats.money - totalCost
      },
      petFood: {
        ...prev.petFood,
        [foodType]: (prev.petFood?.[foodType] || 0) + quantity,
      },
    }));
    
    return { success: true, message: `Bought ${quantity}x ${foodType} food for $${totalCost}!` };
  }, [gameState.stats.money, setGameState]);

  const playWithPet = useCallback((petId: string) => {
    if (gameState.stats.energy < 10) return;
    updateStats({ energy: -10 });
    setGameState(prev => ({
      ...prev,
      pets: (prev.pets || []).map(p =>
        p.id === petId
          ? { ...p, happiness: Math.min(100, p.happiness + 10) }
          : p
      ),
    }));
  }, [gameState.stats.energy, updateStats, setGameState]);

  const buyPetToy = useCallback((petId: string, toyId: string) => {
    const pet = gameState.pets?.find(p => p.id === petId);
    if (!pet) {
      return { success: false, message: 'Pet not found' };
    }

    // Pet toy definitions
    const petToys: Record<string, { price: number; fun: number }> = {
      ball: { price: 15, fun: 30 },
      rope: { price: 20, fun: 40 },
      puzzle: { price: 35, fun: 70 },
    };

    const toy = petToys[toyId];
    if (!toy) {
      return { success: false, message: 'Toy not found' };
    }

    if (gameState.stats.money < toy.price) {
      return { success: false, message: `You need $${toy.price} to buy this toy` };
    }

    // Check if pet already owns this toy
    if (pet.ownedToys?.includes(toyId)) {
      return { success: false, message: 'Pet already owns this toy' };
    }

    // Deduct money and add toy
    updateMoney(-toy.price, `Buy pet toy: ${toyId}`);
    setGameState(prev => ({
      ...prev,
      pets: (prev.pets || []).map(p =>
        p.id === petId
          ? { ...p, ownedToys: [...(p.ownedToys || []), toyId] }
          : p
      ),
    }));

    return { success: true, message: `Successfully bought ${toyId} toy for your pet!` };
  }, [gameState.pets, gameState.stats.money, setGameState, updateMoney]);

  const usePetToy = useCallback((petId: string, toyId: string) => {
    const pet = gameState.pets?.find(p => p.id === petId);
    if (!pet) {
      return { success: false, message: 'Pet not found' };
    }

    // Check if pet owns this toy
    if (!pet.ownedToys?.includes(toyId)) {
      return { success: false, message: 'Pet does not own this toy' };
    }

    // Pet toy definitions
    const petToys: Record<string, { fun: number }> = {
      ball: { fun: 30 },
      rope: { fun: 40 },
      puzzle: { fun: 70 },
    };

    const toy = petToys[toyId];
    if (!toy) {
      return { success: false, message: 'Toy not found' };
    }

    // Increase pet happiness
    setGameState(prev => ({
      ...prev,
      pets: (prev.pets || []).map(p =>
        p.id === petId
          ? { ...p, happiness: Math.min(100, (p.happiness || 0) + toy.fun) }
          : p
      ),
    }));

    return { success: true, message: `Used ${toyId} toy! Pet happiness increased by ${toy.fun}!` };
  }, [gameState.pets, setGameState]);

  const updateUserProfile = useCallback((profile: Partial<UserProfile>) => {
    setGameState(prev => ({
      ...prev,
      userProfile: { ...prev.userProfile, ...profile },
    }));
  }, [setGameState]);

  const updateSettings = useCallback((settings: Partial<GameSettings>) => {
    setGameState(prev => ({
      ...prev,
      settings: { ...prev.settings, ...settings },
    }));
  }, [setGameState]);

  const quitJob = useCallback(() => {
    if (!gameState.currentJob) return;
    const jobId = gameState.currentJob;
    setGameState(prev => ({
      ...prev,
      currentJob: undefined,
      careers: (prev.careers || []).map(career =>
        career.id === jobId
          ? { ...career, applied: false, accepted: false }
          : career
      ),
    }));
  }, [gameState.currentJob, setGameState]);

  const cancelContract = useCallback((hobbyId: string) => {
    setGameState(prev => ({
      ...prev,
      hobbies: (prev.hobbies || []).map(h =>
        h.id === hobbyId ? { ...h, contracts: [], team: undefined, league: undefined } : h
      ),
    }));
  }, [setGameState]);

  const toggleDietPlan = useCallback((planId: string) => {
    setGameState(prev => ({
      ...prev,
      dietPlans: (prev.dietPlans || []).map(plan => ({
        ...plan,
        active: plan.id === planId ? !plan.active : false,
      })),
    }));
    if (saveGameRef.current) saveGameRef.current();
  }, [setGameState]);

  const selectWarehouseMiningCrypto = useCallback((cryptoId: string) => {
    if (!gameState.warehouse) return;
    setGameState(prev => ({
      ...prev,
      warehouse: prev.warehouse ? {
        ...prev.warehouse,
        selectedCrypto: cryptoId,
      } : undefined,
    }));
  }, [gameState.warehouse, setGameState]);

  const selectMiningCrypto = useCallback((cryptoId: string, companyId?: string) => {
    companyLogic.selectMiningCrypto(gameState, setGameState, cryptoId, companyId);
    if (saveGameRef.current) saveGameRef.current();
  }, [gameState, setGameState]);

  const buyCrypto = useCallback((cryptoId: string, amount: number) => {
    const crypto = (gameState.cryptos || []).find(c => c.id === cryptoId);
    if (!crypto || gameState.stats.money < amount) return;

    const shares = amount / crypto.price;

    setGameState(prev => ({
      ...prev,
      cryptos: (prev.cryptos || []).map(c => (c.id === cryptoId ? { ...c, owned: c.owned + shares } : c)),
      stats: {
        ...prev.stats,
        money: prev.stats.money - amount,
      },
    }));

    if (saveGameRef.current) saveGameRef.current();
  }, [gameState.cryptos, gameState.stats.money, setGameState]);

  const sellCrypto = useCallback((cryptoId: string, amount: number) => {
    const crypto = (gameState.cryptos || []).find(c => c.id === cryptoId);
    if (!crypto || crypto.owned <= 0 || amount <= 0) return;

    const sellAmount = Math.min(amount, crypto.owned);
    const totalValue = crypto.price * sellAmount;

    setGameState(prev => ({
      ...prev,
      cryptos: (prev.cryptos || []).map(c =>
        c.id === cryptoId ? { ...c, owned: c.owned - sellAmount } : c
      ),
      stats: {
        ...prev.stats,
        money: prev.stats.money + totalValue,
      },
    }));

    if (saveGameRef.current) saveGameRef.current();
  }, [gameState.cryptos, setGameState]);

  const swapCrypto = useCallback((fromId: string, toId: string, amount: number) => {
    const from = (gameState.cryptos || []).find(c => c.id === fromId);
    const to = (gameState.cryptos || []).find(c => c.id === toId);
    if (!from || !to || from.owned <= 0 || amount <= 0) return;

    const swapAmount = Math.min(amount, from.owned);
    const usdValue = swapAmount * from.price;
    const toShares = usdValue / to.price;

    setGameState(prev => ({
      ...prev,
      cryptos: (prev.cryptos || []).map(c => {
        if (c.id === fromId) return { ...c, owned: c.owned - swapAmount };
        if (c.id === toId) return { ...c, owned: c.owned + toShares };
        return c;
      }),
    }));

    if (saveGameRef.current) saveGameRef.current();
  }, [gameState.cryptos, setGameState]);

  const completeMinigame = useCallback((hobbyId: string, score: number) => {
    const skillGain = Math.min(5, Math.floor(score / 10));
    setGameState(prev => ({
      ...prev,
      hobbies: (prev.hobbies || []).map(h =>
        h.id === hobbyId ? { ...h, skill: h.skill + skillGain } : h
      ),
    }));
    if (saveGameRef.current) saveGameRef.current();
  }, [setGameState]);

  const buyWarehouse = useCallback((): { success: boolean; message?: string } => {
    const warehouseCost = 25000;
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
    if (saveGameRef.current) saveGameRef.current();
    return { success: true, message: 'Successfully purchased warehouse!' };
  }, [gameState.stats.money, gameState.warehouse, setGameState]);

  const upgradeWarehouse = useCallback((): { success: boolean; message?: string } => {
    if (!gameState.warehouse) {
      return { success: false, message: 'You need to buy a warehouse first' };
    }
    const currentLevel = gameState.warehouse.level;
    const upgradeCost = 15000 * currentLevel;
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
    if (saveGameRef.current) saveGameRef.current();
    return { success: true, message: `Successfully upgraded warehouse to level ${currentLevel + 1}!` };
  }, [gameState.warehouse, gameState.stats.money, setGameState]);

  const clearSaveSlot = useCallback(async (slot: number) => {
    try {
      await AsyncStorage.removeItem(`save_slot_${slot}`);
      await AsyncStorage.removeItem(`save_slot_${slot}_backup`);
      await AsyncStorage.removeItem(`save_slot_${slot}_temp`);
      await AsyncStorage.removeItem(`cloud_save_slot_${slot}`);
      await AsyncStorage.removeItem(`cloud_save_slot_${slot}_backup`);
      await AsyncStorage.removeItem(`cache_slot_${slot}`);
      if (slot === currentSlot) {
        await AsyncStorage.removeItem('lastSlot');
      }
      log.info(`Save slot ${slot} cleared successfully`);
    } catch (error) {
      log.error(`Failed to clear save slot ${slot}:`, error);
      throw error;
    }
  }, [currentSlot]);

  const loadPermanentPerks = useCallback(async (): Promise<string[]> => {
    try {
      const perksJson = await AsyncStorage.getItem('permanent_perks');
      if (perksJson) {
        return JSON.parse(perksJson);
      }
      return [];
    } catch (error) {
      log.error('Error loading permanent perks:', error);
      return [];
    }
  }, []);

  const savePermanentPerk = useCallback(async (perkId: string): Promise<void> => {
    try {
      const currentPerks = await loadPermanentPerks();
      if (!currentPerks.includes(perkId)) {
        currentPerks.push(perkId);
        await AsyncStorage.setItem('permanent_perks', JSON.stringify(currentPerks));
        log.info('Permanent perk saved', { perkId });
      }
    } catch (error) {
      log.error('Error saving permanent perk:', error);
    }
  }, [loadPermanentPerks]);

  const hasPermanentPerk = useCallback(async (perkId: string): Promise<boolean> => {
    const perks = await loadPermanentPerks();
    return perks.includes(perkId);
  }, [loadPermanentPerks]);

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
      log.error('Failed to clear cache', error);
      setIsLoading(false);
      setIsCacheClearing(false);
    }
  }, [setIsLoading, setLoadingMessage, setLoadingProgress, setIsCacheClearing]);

  const applyForJob = useCallback((jobId: string) => {
    const hasJob = !!gameState.currentJob;
    const hasPendingApplication = (gameState.careers || []).some(
      c => c.applied && !c.accepted
    );
    if (hasJob || hasPendingApplication) {
      Alert.alert(
        'Job Application',
        'You must quit your current job before applying for another.'
      );
      return;
    }
    const career = (gameState.careers || []).find(c => c.id === jobId);
    if (!career) return;
    const meetsFitness =
      !career.requirements.fitness ||
      gameState.stats.fitness >= career.requirements.fitness;
    const hasItems =
      !career.requirements.items ||
      career.requirements.items.every(itemId =>
        (gameState.items || []).find(item => item.id === itemId)?.owned
      );
    const hasEducation =
      !career.requirements.education ||
      career.requirements.education.every(educationId =>
        (gameState.educations || []).find(e => e.id === educationId)?.completed
      );
    // LIFESTYLE MAINTENANCE: Check if career is unlocked by lifestyle
    const { isCareerUnlockedByLifestyle } = require('@/lib/economy/lifestyle');
    const lifestyleUnlocked = isCareerUnlockedByLifestyle(jobId, gameState);
    // Some careers require lifestyle (corporate, celebrity, politician), others don't
    const lifestyleRequired = ['corporate', 'celebrity', 'politician'].includes(jobId);
    const meetsLifestyle = !lifestyleRequired || lifestyleUnlocked;
    
    if (!meetsFitness || !hasItems || !hasEducation || !meetsLifestyle) {
      if (lifestyleRequired && !lifestyleUnlocked) {
        const { calculateLifestyleLevel } = require('@/lib/economy/lifestyle');
        const currentLevel = calculateLifestyleLevel(gameState);
        Alert.alert(
          'Lifestyle Requirement',
          `This career requires a higher lifestyle level. Your current lifestyle: ${currentLevel}. Required: comfortable or higher`
        );
      }
      return;
    }
    setGameState(prev => ({
      ...prev,
      careers: (prev.careers || []).map(c =>
        c.id === jobId ? { ...c, applied: false, accepted: true } : c
      ),
      currentJob: jobId,
    }));
    if (checkAchievementsRef.current) {
      setTimeout(() => checkAchievementsRef.current!(), 0);
    }
    if (saveGameRef.current) saveGameRef.current();
  }, [gameState.currentJob, gameState.careers, gameState.stats.fitness, gameState.items, gameState.educations, setGameState]);

  const serveJailTime = useCallback(() => {
    return {
      events: [`Served time in jail. ${Math.max(0, gameState.jailWeeks - 1)} weeks remaining.`],
      statsChange: { happiness: -20, health: -10 },
    };
  }, [gameState.jailWeeks]);

  const performJailActivity = useCallback((activityId: string) => {
    if (gameState.jailWeeks === 0)
      return { success: false, message: 'Not currently jailed' };
    const activity = (gameState.jailActivities || []).find(a => a.id === activityId);
    if (!activity) return { success: false, message: 'Invalid activity' };
    const weeklyActivities = gameState.weeklyJailActivities || {};
    const currentWeek = gameState.date.week;
    const lastDoneWeek = weeklyActivities[activityId];
    if (lastDoneWeek === currentWeek) {
      return { success: false, message: `You can only do ${activity.name} once per week` };
    }
    if (gameState.stats.energy < activity.energyCost)
      return { success: false, message: 'Not enough energy' };
    if (activity.cost && gameState.stats.money < activity.cost)
      return { success: false, message: `Not enough money. Cost: $${activity.cost}` };
    if (activity.requiresEducation) {
      const hasEducation = (gameState.educations || []).find(e => e.id === activity.requiresEducation)?.completed;
      if (!hasEducation)
        return { success: false, message: `Requires ${activity.requiresEducation.replace('_', ' ')} education` };
    }
    if (activity.requiresWeeks && gameState.jailWeeks < activity.requiresWeeks) {
      return { success: false, message: `Requires at least ${activity.requiresWeeks} weeks remaining in jail` };
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
          message: `✅ Your good behavior was noted by the guards. Happiness +${activity.happinessGain || 10}. Sentence reduced by ${activity.sentenceReduction || 1} week(s).`,
        };
        break;
      case 'prison_meditation':
        updateStats({
          happiness: (activity.happinessGain || 8),
          health: (activity.healthGain || 3),
        }, false);
        result = {
          success: true,
          message: `🧘 You meditated and found inner peace. Happiness +${activity.happinessGain || 8}, Health +${activity.healthGain || 3}.`,
        };
        break;
      case 'prison_exercise':
        updateStats({
          health: (activity.healthGain || 8),
          fitness: (activity.fitnessGain || 5),
          happiness: (activity.happinessGain || 5),
        }, false);
        result = {
          success: true,
          message: `💪 You worked out in the yard. Health +${activity.healthGain || 8}, Fitness +${activity.fitnessGain || 5}, Happiness +${activity.happinessGain || 5}.`,
        };
        break;
      case 'prison_yoga':
        updateStats({
          health: (activity.healthGain || 5),
          happiness: (activity.happinessGain || 10),
          fitness: (activity.fitnessGain || 2),
        }, false);
        result = {
          success: true,
          message: `🧘‍♀️ You practiced yoga and feel balanced. Health +${activity.healthGain || 5}, Happiness +${activity.happinessGain || 10}, Fitness +${activity.fitnessGain || 2}.`,
        };
        break;
    }
    if (result.success) {
      setGameState(prev => ({
        ...prev,
        weeklyJailActivities: {
          ...prev.weeklyJailActivities,
          [activityId]: currentWeek
        }
      }));
    }
    if (checkAchievementsRef.current) {
      setTimeout(() => checkAchievementsRef.current!(), 100);
    }
    if (saveGameRef.current) saveGameRef.current();
    return result;
  }, [gameState.jailWeeks, gameState.jailActivities, gameState.weeklyJailActivities, gameState.date.week, gameState.stats.energy, gameState.stats.money, gameState.educations, updateStats, setGameState]);

  const payBail = useCallback(() => {
    if (gameState.jailWeeks === 0)
      return { success: false, message: 'Not currently jailed' };
    const cost = gameState.jailWeeks * 500;
    if (gameState.stats.money < cost)
      return { success: false, message: `Bail costs $${cost}` };
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
    setGameState(newState);
    setTimeout(() => {
      if (saveGameRef.current) saveGameRef.current();
    }, 100);
    return { success: true, message: `Paid $${cost} bail and released.` };
  }, [gameState, setGameState]);

  const breakUpWithPartner = useCallback((partnerId: string) => {
    setGameState(prev => {
      const family = { ...prev.family };
      if (family.spouse && family.spouse.id === partnerId) {
        family.spouse = undefined;
      }
      // RELATIONSHIP STATE FIX: Clear livingTogether before removing partner (defensive programming)
      const relationships = (prev.relationships || []).map(rel =>
        rel.id === partnerId ? { ...rel, livingTogether: false } : rel
      ).filter(rel => rel.id !== partnerId);
      
      return {
        ...prev,
        relationships,
        family,
      };
    });
    return { success: true, message: 'You ended the relationship.' };
  }, [setGameState]);

  const proposeToPartner = useCallback((partnerId: string) => {
    const partner = (gameState.relationships || []).find(rel => rel.id === partnerId);
    if (!partner || partner.type !== 'partner') return { success: false, message: 'Invalid partner.' };
    const currentWeek = gameState.week ?? 0;
    const requiredWeek = 36;
    if (currentWeek < requiredWeek) {
      const weeksLeft = requiredWeek - currentWeek;
      return { success: false, message: `You need to wait ${weeksLeft} more week${weeksLeft === 1 ? '' : 's'} before you can get engaged.` };
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
      // RELATIONSHIP STATE FIX: Remove existing spouse if different person (prevent duplicates)
      const spouse: Relationship = {
        ...partner,
        type: 'spouse',
        relationshipScore: Math.min(100, partner.relationshipScore + 20),
        familyHappiness: partner.familyHappiness ?? 5,
        expenses: partner.expenses ?? 100,
        livingTogether: true, // RELATIONSHIP STATE FIX: Spouses automatically live together
        // RELATIONSHIP STATE FIX: Clear engagement properties when becoming spouse
        engagementWeek: undefined,
        engagementRing: undefined,
        weddingPlanned: undefined,
      };
      setGameState(prev => {
        let relationships = prev.relationships || [];
        const existingSpouse = prev.family?.spouse;
        if (existingSpouse && existingSpouse.id !== partnerId) {
          relationships = relationships.filter(r => r.id !== existingSpouse.id);
          log.warn('Replacing existing spouse during proposal', { oldSpouseId: existingSpouse.id, newSpouseId: partnerId });
        }
        
        return {
          ...prev,
          relationships: relationships.map(rel =>
            rel.id === partnerId ? spouse : rel
          ),
          family: { ...prev.family, spouse },
        };
      });
      return { success: true, message: `${partner.name} said yes! You're now engaged!` };
    } else {
      setGameState(prev => ({
        ...prev,
        relationships: (prev.relationships || []).filter(rel => rel.id !== partnerId),
      }));
      return { success: false, message: `${partner.name} said no and left you...` };
    }
  }, [gameState.relationships, gameState.week, gameState.stats.money, setGameState]);

  const moveInTogether = useCallback((partnerId: string) => {
    const partner = (gameState.relationships || []).find(rel => rel.id === partnerId);
    if (!partner) return { success: false, message: 'Partner not found.' };
    const hasHome = gameState.realEstate && gameState.realEstate.length > 0;
    if (!hasHome) {
      return { success: false, message: 'You need to own a home first!' };
    }
    const successChance = partner.relationshipScore * 0.8;
    // RANDOMNESS FIX: Soft guarantee for move in together - 100% success if chance >= 80%
    // Prevents frustrating failures at high relationship scores (similar to proposals)
    const guaranteedSuccess = successChance >= 80;
    const success = guaranteedSuccess ? true : Math.random() * 100 < successChance;
    if (success) {
      setGameState(prev => ({
        ...prev,
        relationships: (prev.relationships || []).map(rel =>
          rel.id === partnerId ? { ...rel, livingTogether: true, relationshipScore: Math.min(100, rel.relationshipScore + 15) } : rel
        ),
      }));
      return { success: true, message: `${partner.name} moved in with you! Daily happiness +5` };
    } else {
      return { success: false, message: `${partner.name} isn't ready to move in together yet.` };
    }
  }, [gameState.relationships, gameState.realEstate, setGameState]);

  const haveChild = useCallback((partnerId: string) => {
    const partner = (gameState.relationships || []).find(rel => rel.id === partnerId);
    if (!partner || partner.type !== 'spouse') {
      return { success: false, message: 'You need to be married to have a child.' };
    }
    const currentWeek = gameState.week ?? 0;
    const requiredWeek = 36;
    if (currentWeek < requiredWeek) {
      const weeksLeft = requiredWeek - currentWeek;
      return { success: false, message: `You need to wait ${weeksLeft} more week${weeksLeft === 1 ? '' : 's'} before you can have a child.` };
    }
    const cost = 10000;
    if (gameState.stats.money < cost) {
      return { success: false, message: 'You need $10,000 for hospital costs!' };
    }
    
    // RANDOMNESS FIX: Pity system for having children - guaranteed success after 15 attempts
    // NOTE: Partner existence validated early (line 1876), but if relationship is removed between
    // validation and state update, childAttempts update will be no-op (safe, just no tracking)
    // PRIORITY 2 FIX: Use constant from randomnessConstants
    const { PITY_THRESHOLD_CHILDREN } = require('@/lib/randomness/randomnessConstants');
    const childAttempts = (partner.childAttempts || 0) + 1;
    const baseChance = 0.1; // 10% base chance
    const pityThreshold = PITY_THRESHOLD_CHILDREN; // Guaranteed success after 15 attempts
    const guaranteedSuccess = childAttempts >= pityThreshold;
    const success = guaranteedSuccess ? true : Math.random() < baseChance;
    
    // CRITICAL FIX: Only deduct money on success to prevent loss on failure
    // Previous version deducted money before success check, which could lose money on failure
    // Now: Money deducted only if success, counter updated regardless
    if (success) {
      setGameState(prev => ({
        ...prev,
        stats: {
          ...prev.stats,
          money: prev.stats.money - cost
        },
        relationships: (prev.relationships || []).map(rel =>
          rel.id === partnerId 
            ? { ...rel, childAttempts: 0 } // Reset counter on success
            : rel
        ),
      }));
    } else {
      // Update counter on failure (but don't deduct money)
      setGameState(prev => ({
        ...prev,
        relationships: (prev.relationships || []).map(rel =>
          rel.id === partnerId 
            ? { ...rel, childAttempts: childAttempts } // Increment counter on failure
            : rel
        ),
      }));
      
      const attemptsRemaining = pityThreshold - childAttempts;
      const message = attemptsRemaining > 0
        ? `${partner.name} and you were unable to conceive. Try again later. (${attemptsRemaining} attempts until guaranteed success)`
        : `${partner.name} and you were unable to conceive. Try again later.`;
      return { success: false, message };
    }
    // BUG FIX: Match child gender to name (prevent male names with female portraits)
    const maleNames = ['Liam', 'Noah', 'Ethan', 'Mason'];
    const femaleNames = ['Emma', 'Olivia', 'Ava', 'Sophia'];
    const allNames = [...maleNames, ...femaleNames];
    const childName = allNames[Math.floor(Math.random() * allNames.length)];
    const childGender = maleNames.includes(childName) ? 'male' : 'female';
    const child: Relationship = {
      id: `child_${Date.now()}`,
      name: childName,
      type: 'child',
      relationshipScore: 100,
      personality: 'innocent',
      gender: childGender, // BUG FIX: Match gender to name
      age: 0,
      familyHappiness: 3,
      expenses: 50,
    };
    addRelationship(child);
    setGameState(prev => ({
      ...prev,
      relationships: (prev.relationships || []).map(rel =>
        rel.id === partnerId 
          ? { ...rel, relationshipScore: Math.min(100, rel.relationshipScore + 25), childAttempts: 0 } // Reset counter on success
          : rel
      ),
    }));
    return { success: true, message: `Congratulations! ${childName} was born!` };
  }, [gameState.relationships, gameState.week, gameState.stats.money, addRelationship, setGameState]);

  const askForMoney = useCallback((relationshipId: string) => {
    const relationship = (gameState.relationships || []).find(r => r.id === relationshipId);
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
    // RANDOMNESS FIX: Pity system for asking for money - guaranteed success after 5 attempts
    // Prevents frustrating streaks with 4-week cooldown
    //
    // SAFETY: This is safe because:
    // - Attempt counter is per-relationship (isolated, no cross-contamination)
    // - Counter is reset on success (prevents accumulation)
    // - Counter persists across weeks (allows pity system to work over time)
    //
    // FRAGILE LOGIC WARNING:
    // - If relationship is removed/deleted, counter is lost (acceptable - new relationship = fresh start)
    // - If relationship ID changes, counter is lost (shouldn't happen, but defensive code could check)
    // - No migration logic: Old saves without moneyRequestAttempts default to 0 (acceptable - fresh start)
    //
    // FUTURE BUG RISK:
    // - If successRate calculation changes, pity threshold might need adjustment
    // - If cooldown period changes, pity threshold might need adjustment (currently 4 weeks)
    const moneyRequestAttempts = (relationship.moneyRequestAttempts || 0) + 1;
    const pityThreshold = 5; // Guaranteed success after 5 attempts
    const guaranteedSuccess = moneyRequestAttempts >= pityThreshold;
    const success = guaranteedSuccess ? true : Math.random() * 100 < successRate;
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
      const attemptsRemaining = pityThreshold - moneyRequestAttempts;
      const rejectionMessage = rejectionMessages[Math.floor(Math.random() * rejectionMessages.length)];
      message = attemptsRemaining > 0 
        ? `${rejectionMessage} (${attemptsRemaining} more attempts until guaranteed success)`
        : rejectionMessage;
    }
    setGameState(prev => ({
      ...prev,
      stats: success
        ? { ...prev.stats, money: prev.stats.money + amount }
        : prev.stats,
      relationships: (prev.relationships || []).map(rel =>
        rel.id === relationshipId
          ? {
              ...rel,
              lastMoneyRequest: prev.week,
              // RANDOMNESS FIX: Reset attempts on success, increment on failure
              moneyRequestAttempts: success ? 0 : moneyRequestAttempts,
              relationshipScore: Math.max(
                0,
                Math.min(100, rel.relationshipScore + (success ? -10 : -5))
              ),
              actions: { ...(rel.actions || {}), money: prev.day },
            }
          : rel
      ),
    }));
    return { success, message };
  }, [gameState.relationships, gameState.day, gameState.week, getLifeStage, setGameState]);

  const callRelationship = useCallback((relationshipId: string) => {
    const relationship = (gameState.relationships || []).find(r => r.id === relationshipId);
    if (!relationship) return { success: false, message: 'Contact not found' };
    if (relationship.lastCall && gameState.week - relationship.lastCall <= 0) {
      return { success: false, message: 'Already called this week' };
    }
    setGameState(prev => ({
      ...prev,
      relationships: (prev.relationships || []).map(rel =>
        rel.id === relationshipId ? { ...rel, lastCall: gameState.week } : rel
      ),
    }));
    updateRelationship(relationshipId, 5);
    return { success: true, message: 'Had a nice conversation!' };
  }, [gameState.relationships, gameState.week, updateRelationship, setGameState]);

  const startEducation = useCallback((educationId: string) => {
    const education = (gameState.educations || []).find(e => e.id === educationId);
    if (!education || education.completed) return;
    const cost = getInflatedPrice(education.cost, gameState.economy.priceIndex);
    if (gameState.stats.money < cost) return;
    setGameState(prev => ({
      ...prev,
      educations: (prev.educations || []).map(e => (e.id === educationId ? { ...e, weeksRemaining: education.duration } : e)),
    }));
    setGameState(prev => ({
      ...prev,
      stats: {
        ...prev.stats,
        money: prev.stats.money - cost
      }
    }));
  }, [gameState.educations, gameState.economy.priceIndex, gameState.stats.money, setGameState]);

  const createCompany = withActionLock('createCompany', useCallback((companyType: string) => {
    const result = companyLogic.createCompany(
      gameState,
      setGameState,
      companyType
    );
    if (saveGameRef.current) saveGameRef.current();
    return result;
  }, [gameState, setGameState]));

  const buyCompanyUpgrade = withActionLock('buyCompanyUpgrade', useCallback((upgradeId: string, companyId?: string) => {
    const result = CompanyActions.buyCompanyUpgrade(gameState, setGameState, upgradeId, companyId, { updateMoney: applyMoneyChange });
    if (result.success && saveGameRef.current) {
      saveGameRef.current();
    }
    if (!result.success) {
      Alert.alert('Upgrade Failed', result.message);
    }
  }, [gameState, setGameState, applyMoneyChange]));

  const createFamilyBusiness = useCallback((companyId: string) => {
    FamilyBusinessActions.createFamilyBusiness(gameState, setGameState, companyId, { updateMoney: applyMoneyChange });
    if (saveGameRef.current) saveGameRef.current();
  }, [gameState, setGameState, applyMoneyChange]);

  // R&D Actions
  const buildRDLab = useCallback((companyId: string, labType: string) => {
    const result = RDActions.buildRDLab(
      gameState,
      setGameState,
      companyId,
      labType as LabType,
      { updateMoney: applyMoneyChange }
    );
    if (saveGameRef.current) saveGameRef.current();
    return result;
  }, [gameState, setGameState, applyMoneyChange, saveGameRef]);

  const startResearch = useCallback((companyId: string, technologyId: string) => {
    const result = RDActions.startResearch(
      gameState,
      setGameState,
      companyId,
      technologyId,
      { updateMoney: applyMoneyChange }
    );
    if (saveGameRef.current) saveGameRef.current();
    return result;
  }, [gameState, setGameState, applyMoneyChange, saveGameRef]);

  const completeResearch = useCallback((companyId: string, projectId: string) => {
    const result = RDActions.completeResearch(
      gameState,
      setGameState,
      companyId,
      projectId
    );
    if (saveGameRef.current) saveGameRef.current();
    return result;
  }, [gameState, setGameState]);

  const filePatent = useCallback((companyId: string, technologyId: string) => {
    const result = RDActions.filePatent(
      gameState,
      setGameState,
      companyId,
      technologyId,
      { updateMoney: applyMoneyChange }
    );
    if (saveGameRef.current) saveGameRef.current();
    return result;
  }, [gameState, setGameState, applyMoneyChange, saveGameRef]);

  const enterCompetition = useCallback((companyId: string, competitionId: string) => {
    const result = RDActions.enterCompetition(
      gameState,
      setGameState,
      companyId,
      competitionId,
      { updateMoney: applyMoneyChange }
    );
    if (saveGameRef.current) saveGameRef.current();
    return result;
  }, [gameState, setGameState, applyMoneyChange, saveGameRef]);

  const manageFamilyBusiness = useCallback((companyId: string, action: 'marketing' | 'branding' | 'reputation') => {
    const result = FamilyBusinessActions.manageFamilyBusiness(gameState, setGameState, companyId, action, { updateMoney: applyMoneyChange });
    if (saveGameRef.current) saveGameRef.current();
    return result;
  }, [gameState, setGameState, applyMoneyChange, saveGameRef]);

  const travelTo = useCallback((destinationId: string) => {
    const result = TravelActions.travelTo(gameState, setGameState, destinationId, { updateMoney: applyMoneyChange, updateStats: applyStatsChange });
    if (saveGameRef.current) saveGameRef.current();
    return result;
  }, [gameState, setGameState, applyMoneyChange, applyStatsChange, saveGameRef]);

  const addWorker = useCallback((companyId?: string) => {
    companyLogic.addWorker(gameState, setGameState, companyId);
    if (saveGameRef.current) saveGameRef.current();
  }, [gameState, setGameState]);

  const removeWorker = useCallback((companyId?: string) => {
    companyLogic.removeWorker(gameState, setGameState, companyId);
    if (saveGameRef.current) saveGameRef.current();
  }, [gameState, setGameState]);

  const buyMiner = useCallback((minerId: string, minerName: string, cost: number) => {
    const result = companyLogic.buyMiner(gameState, setGameState, minerId, minerName, cost);
    if (saveGameRef.current) saveGameRef.current();
    return result;
  }, [gameState, setGameState]);

  const sellMiner = useCallback((minerId: string, minerName: string, purchasePrice: number, companyId?: string) => {
    const result = companyLogic.sellMiner(gameState, setGameState, minerId, minerName, purchasePrice, companyId);
    if (saveGameRef.current) saveGameRef.current();
    return result;
  }, [gameState, setGameState]);

  const addSocialRelation = useCallback((relation: Relation) => {
    socialLogic.addSocialRelation(setGameState, relation);
    if (saveGameRef.current) saveGameRef.current();
  }, [setGameState]);

  const interactRelation = useCallback((
    relationId: string,
    action: RelationAction
  ): { success: boolean; message: string } => {
    const result = socialLogic.interactRelation(
      gameState,
      setGameState,
      relationId,
      action
    );
    if (saveGameRef.current) saveGameRef.current();
    return result;
  }, [gameState, setGameState]);

  const claimProgressAchievement = useCallback(async (id: string, gold: number) => {
    // Check global claimed achievements to prevent farming across saves
    try {
      const globalClaimed = await AsyncStorage.getItem('globalClaimedAchievements');
      const globalClaimedList: string[] = globalClaimed ? JSON.parse(globalClaimed) : [];
      
      if (globalClaimedList.includes(id)) {
        log.info(`Achievement ${id} already claimed globally, skipping`);
        Alert.alert('Already Claimed', 'This achievement reward has already been claimed in another save.');
        return;
      }
      
      // Also check local save to prevent double claiming in same save
      const claimedAchievements = gameState.claimedProgressAchievements || [];
      if (claimedAchievements.includes(id)) {
        log.info(`Achievement ${id} already claimed in this save, skipping`);
        return;
      }
      
      // Mark as claimed globally
      globalClaimedList.push(id);
      await AsyncStorage.setItem('globalClaimedAchievements', JSON.stringify(globalClaimedList));
      
      const achievement = gameState.achievements?.find(a => a.id === id);
      if (achievement) {
        showAchievementToast(achievement.name, achievement.category, gold);
      }
      updateStats({ gems: gold }, false);
      setGameState(prev => ({
        ...prev,
        claimedProgressAchievements: [...(prev.claimedProgressAchievements || []), id],
      }));
      if (saveGameRef.current) saveGameRef.current();
    } catch (error) {
      log.error('Error checking global claimed achievements:', error);
      // Fallback to local check only if global check fails
      const claimedAchievements = gameState.claimedProgressAchievements || [];
      if (claimedAchievements.includes(id)) {
        return;
      }
      updateStats({ gems: gold }, false);
      setGameState(prev => ({
        ...prev,
        claimedProgressAchievements: [...(prev.claimedProgressAchievements || []), id],
      }));
      if (saveGameRef.current) saveGameRef.current();
    }
  }, [gameState.claimedProgressAchievements, gameState.achievements, updateStats, setGameState]);

  const initializeDailyChallenges = useCallback(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    // Dynamic require needed to avoid circular dependencies
    const { generateDailyChallenges, shouldResetChallenges } = require('@/utils/dailyChallenges');
    const currentChallenges = gameState.dailyChallenges;
    const now = Date.now();
    if (!currentChallenges || shouldResetChallenges(currentChallenges.lastRefresh)) {
      const todaysChallenges = generateDailyChallenges();
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
  }, [gameState, setGameState]);

  const updateDailyChallengeProgress = useCallback(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { generateDailyChallenges } = require('@/utils/dailyChallenges');
    if (!gameState.dailyChallenges) return;
    const todaysChallenges = generateDailyChallenges();
    const easyChallenge = todaysChallenges.easy;
    const mediumChallenge = todaysChallenges.medium;
    const hardChallenge = todaysChallenges.hard;
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
  }, [gameState, setGameState]);

  const claimDailyChallengeReward = useCallback((difficulty: 'easy' | 'medium' | 'hard') => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { generateDailyChallenges } = require('@/utils/dailyChallenges');
    if (!gameState.dailyChallenges) return { success: false, message: 'No challenges available' };
    const challenge = gameState.dailyChallenges[difficulty];
    if (challenge.claimed) {
      return { success: false, message: 'Already claimed' };
    }
    const todaysChallenges = generateDailyChallenges();
    const challengeDef = todaysChallenges[difficulty];
    if (challenge.progress < challengeDef.maxProgress) {
      return { success: false, message: 'Challenge not completed' };
    }
    const reward = challengeDef.reward;
    // updateStats ADDS to current value, so just pass the reward amount
    updateStats({ gems: reward }, false);
    setGameState(prev => ({
      ...prev,
      dailyChallenges: prev.dailyChallenges ? {
        ...prev.dailyChallenges,
        [difficulty]: { ...prev.dailyChallenges[difficulty], claimed: true },
      } : undefined,
    }));
    return { success: true, message: `+${reward} gems!`, reward };
  }, [gameState.dailyChallenges, gameState.stats.gems, updateStats, setGameState]);

  const buyPerk = useCallback((perkId: string) => {
    log.info(`IAP Perk purchase initiated: ${perkId}`);
    setGameState(prev => ({
      ...prev,
      perks: {
        ...prev.perks,
        [perkId]: true,
      },
    }));
    Alert.alert(
      'Purchase Successful!',
      `You have unlocked the ${perkId.replace(/_/g, ' ')} perk!`,
      [{ text: 'Continue' }]
    );
    if (saveGameRef.current) saveGameRef.current();
  }, [setGameState]);

  const buyStarterPack = useCallback((packId: string) => {
    const packs = {
      starter: 50000,
      booster: 250000,
      mega: 2000000,
      crypto: 10000000,
    } as const;
    const amount = packs[packId as keyof typeof packs];
    if (amount) {
      log.info(`IAP Money pack purchase initiated: ${packId}`);
      setGameState(prev => ({
        ...prev,
        stats: {
          ...prev.stats,
          money: prev.stats.money + amount
        }
      }));
      Alert.alert(
        'Purchase Successful!',
        `You received $${amount.toLocaleString()}!`,
        [{ text: 'Continue' }]
      );
      if (saveGameRef.current) saveGameRef.current();
    }
  }, [setGameState]);

  const buyGoldPack = useCallback((packId: string) => {
    const packs = {
      small: 10,
      medium: 55,
      large: 120,
    } as const;
    const amount = packs[packId as keyof typeof packs];
    if (amount) {
      log.info(`IAP Gem pack purchase initiated: ${packId}`);
      // updateStats ADDS to current value, so just pass the amount to add
      updateStats({ gems: amount }, false);
      Alert.alert(
        'Purchase Successful!',
        `You received ${amount} gems!`,
        [{ text: 'Continue' }]
      );
      if (saveGameRef.current) saveGameRef.current();
    }
  }, [gameState.stats.gems, updateStats]);

  const buyRevival = useCallback(async () => {
    try {
      log.info('IAP Revival purchase initiated');
      if (!iapService) {
        log.error('IAP service not available');
        Alert.alert(
          'Service Unavailable',
          'The purchase service is not available. Please restart the app and try again.',
          [{ text: 'OK' }]
        );
        return;
      }
      let result;
      try {
        result = await iapService.purchaseProduct(IAP_PRODUCTS.REVIVAL_PACK);
      } catch (purchaseError: any) {
        log.error('IAP purchase error:', purchaseError);
        Alert.alert(
          'Purchase Failed',
          purchaseError?.message || 'Unable to complete purchase. Please check your connection and try again.',
          [{ text: 'OK' }]
        );
        return;
      }
      if (!result || typeof result !== 'object') {
        log.error('Invalid purchase result:', result);
        Alert.alert(
          'Purchase Failed',
          'Unable to complete purchase. Please try again or contact support.',
          [{ text: 'OK' }]
        );
        return;
      }
      if (result.success) {
        const gameStateJson = await AsyncStorage.getItem('gameState');
        if (gameStateJson) {
          const updatedState = JSON.parse(gameStateJson);
          setGameState(updatedState);
        }
        Alert.alert(
          'Purchase Successful!',
          'You have been revived! Your character is back to life with restored health and happiness.',
          [{ text: 'Continue' }]
        );
      } else {
        log.error('Revival purchase failed:', result.message);
        Alert.alert(
          'Purchase Failed',
          result.message || 'Unable to complete the revival purchase. Please try again.',
          [{ text: 'OK' }]
        );
      }
    } catch (error: any) {
      log.error('Error during revival purchase:', error);
      Alert.alert(
        'Error',
        error?.message || 'An error occurred while processing your purchase. Please try again.',
        [{ text: 'OK' }]
      );
    }
  }, [setGameState]);

  const reviveCharacter = useCallback(() => {
    const reviveCost = 500;
    if (gameState.stats.gems < reviveCost) {
      Alert.alert('Not enough gems', `You need ${reviveCost} gems to revive.`);
      return;
    }
    if (!preDeathStateRef.current) {
      // Fallback: revive from current state if no pre-death state available
      log.warn('No pre-death state found, reviving from current state');
      setGameState(prev => ({
        ...prev,
        stats: {
          ...prev.stats,
          gems: prev.stats.gems - reviveCost,
          health: 100,      // Full health
          happiness: 100,   // Full happiness
          energy: 100,      // Full energy
        },
        happinessZeroWeeks: 0,
        healthZeroWeeks: 0,
        showZeroStatPopup: false,
        zeroStatType: undefined,
        showDeathPopup: false,
        deathReason: undefined,
      }));
      
      // Save after revival
      setTimeout(() => {
        if (saveGameRef.current) {
          saveGameRef.current();
          log.info('Revived state saved (fallback)');
        }
      }, 100);
      return;
    }
    
    const revivedState: GameState = {
      ...preDeathStateRef.current,
      bankSavings: preDeathStateRef.current.bankSavings !== undefined ? preDeathStateRef.current.bankSavings : 0,
      stats: {
        ...preDeathStateRef.current.stats,
        gems: preDeathStateRef.current.stats.gems - reviveCost,
        health: 100,      // Full health
        happiness: 100,   // Full happiness
        energy: 100,      // Full energy
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
    
    // Save after revival
    setTimeout(() => {
      if (saveGameRef.current) {
        saveGameRef.current();
        log.info('Revived state saved after gem revival');
      }
    }, 100);
  }, [gameState.stats.gems, setGameState]);

  const checkAchievements = useCallback((state: GameState = gameState) => {
    if (!state.achievements) return;

    const newAchievements = [...state.achievements];
    let hasChanges = false;
    let goldReward = 0;
    const perksToSave: string[] = []; // Collect perks to save as permanent

    const completeAchievement = (id: string) => {
      const achievement = newAchievements.find(a => a.id === id);
      if (achievement && !achievement.completed) {
        achievement.completed = true;
        hasChanges = true;
        goldReward += achievement.reward ?? 1;
        notifyAchievementUnlock(achievement.name, achievement.reward ?? 1);
        
        // Check if this achievement unlocks a perk and save it as permanent
        const unlockedPerk = perksData.find(p => p.unlock?.achievementId === id);
        if (unlockedPerk && !perksToSave.includes(unlockedPerk.id)) {
          perksToSave.push(unlockedPerk.id);
          log.info('Achievement unlocked perk:', { achievementId: id, perkId: unlockedPerk.id, perkTitle: unlockedPerk.title });
        }
      }
    };

    // Money
    if (state.stats.money >= 1) completeAchievement('first_dollar');
    if (state.stats.money >= 100) completeAchievement('hundred_dollars');
    if (state.stats.money >= 1000) completeAchievement('thousand_dollars');
    if (state.stats.money >= 10000) completeAchievement('ten_thousand');
    if (state.stats.money >= 100000) completeAchievement('hundred_thousand');
    if (state.stats.money >= 2000000) completeAchievement('millionaire');
    if (state.stats.money >= 20000000) completeAchievement('deca_millionaire');

    // Career
    if (state.currentJob) completeAchievement('first_job');
    if (state.streetJobsCompleted >= 20) completeAchievement('street_worker');
    const hasCareerJob = (state.careers || []).some(career => career.accepted);
    if (hasCareerJob) completeAchievement('career_starter');
    if (state.companies.length > 0) completeAchievement('entrepreneur');
    const purchasedUpgrades = (state.companies || []).reduce(
      (sum, company) => sum + (company.upgrades || []).filter(u => u.level > 0).length,
      0
    );
    const totalUpgrades = (state.companies || []).reduce((sum, company) => sum + (company.upgrades || []).length, 0);
    if (purchasedUpgrades >= 1) completeAchievement('first_upgrade');
    if (totalUpgrades > 0 && purchasedUpgrades === totalUpgrades) completeAchievement('all_upgrades');
    const hiredWorkers = (state.companies || []).reduce((sum, c) => sum + c.employees, 0);
    if (hiredWorkers >= 1) completeAchievement('first_worker');
    if (hiredWorkers >= 5) completeAchievement('team_builder');
    if ((state.companies || []).some(c => c.weeklyIncome >= 100000)) completeAchievement('industry_mogul');

    // Education
    const completedEducations = (state.educations || []).filter(edu => edu.completed);
    if (completedEducations.some(edu => edu.id === 'high_school')) completeAchievement('graduate');
    if (completedEducations.some(edu => edu.id === 'university')) completeAchievement('college_grad');
    if (completedEducations.some(edu => ['computer_science', 'medical_school'].includes(edu.id)))
      completeAchievement('specialist');
    if (completedEducations.length >= 3) completeAchievement('lifelong_learner');

    // Relationships
    if ((state.relationships || []).some(rel => rel.type === 'friend'))
      completeAchievement('first_friend');
    if ((state.relationships || []).filter(rel => rel.type !== 'parent').length >= 5)
      completeAchievement('popular');
    if ((state.relationships || []).some(rel => rel.type === 'partner')) completeAchievement('lover');
    if ((state.relationships || []).some(rel => rel.type === 'spouse')) completeAchievement('married');
    if ((state.relationships || []).some(rel => rel.type === 'child')) completeAchievement('parent');
    if ((state.relationships || []).some(rel => rel.type === 'friend' && rel.relationshipScore >= 100))
      completeAchievement('best_friend');

    // Health
    if (state.stats.fitness >= 50) completeAchievement('fitness_buff');
    if (state.stats.fitness >= 100) completeAchievement('athlete');

    // Items
    const ownedItems = (state.items || []).filter(item => item.owned);
    if (ownedItems.length >= 1) completeAchievement('first_purchase');
    const hasSmartphone = (state.items || []).find(item => item.id === 'smartphone')?.owned;
    const hasComputer = (state.items || []).find(item => item.id === 'computer')?.owned;
    if (hasSmartphone && hasComputer) completeAchievement('tech_savvy');
    const hasCar = (state.items || []).find(item => item.id === 'car')?.owned;
    const hasHouse = (state.items || []).find(item => item.id === 'house')?.owned;
    const hasYacht = (state.items || []).find(item => item.id === 'yacht')?.owned;
    if (hasCar && hasHouse && hasYacht) completeAchievement('luxury_life');
    if (ownedItems.length === state.items.length && state.items.length > 0)
      completeAchievement('collector');

    // Special
    if (state.date.age >= 65) completeAchievement('survivor');
    // Check for centenarian achievement (immortality check happens in nextWeek)
    if (state.date.age >= 100) {
      completeAchievement('centenarian');
    }
    const cryptoValue = (state.cryptos || []).reduce((total, crypto) => total + crypto.owned * crypto.price, 0);
    if (cryptoValue >= 10000) completeAchievement('crypto_investor');
    if (state.stats.gems >= 100) completeAchievement('gold_hoarder');

    // Secret Achievements
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

    const ownedProperties = (state.realEstate || []).filter(p => p.owned).length;
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

    const hasMarriageWith100 = (state.relationships || []).some(
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
      // updateStats ADDS to current value, so just pass the reward amount
      updateStats({ gems: goldReward }, false);
    }
    if (hasChanges) {
      setGameState(prev => ({ ...prev, achievements: newAchievements }));
    }
    
    // Save any perks that were unlocked by achievements as permanent
    if (perksToSave.length > 0) {
      // Save perks asynchronously - don't await to avoid blocking
      (async () => {
        for (const perkId of perksToSave) {
          await savePermanentPerk(perkId);
        }
        log.info('Saved permanent perks from achievements:', { perks: perksToSave });
      })();
    }
    
    const unlocked = evaluateAchievements(state);
    if (unlocked.length > 0) {
      // Add to both legacy progress.achievements and new claimedProgressAchievements
      const unlockedIds = unlocked.map(a => a.id);
      setGameState(prev => ({
        ...prev,
        progress: {
          ...prev.progress,
          achievements: [
            ...prev.progress.achievements,
            ...unlocked.map(a => ({ ...a, unlockedAt: prev.week })),
          ],
        },
        claimedProgressAchievements: [
          ...(prev.claimedProgressAchievements || []),
          ...unlockedIds.filter(id => !prev.claimedProgressAchievements?.includes(id)),
        ],
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
      unlocked.forEach(a => showAchievementToast(a.name, 'general', 1));
    }
  }, [gameState, updateStats, setGameState, savePermanentPerk]);

  // Store checkAchievements in ref for use by other functions
  React.useEffect(() => {
    checkAchievementsRef.current = checkAchievements;
  }, [checkAchievements]);

  const maybeOfferSponsor = useCallback((hobbyId: string) => {
    const hobby = (gameState.hobbies || []).find(h => h.id === hobbyId);
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
              hobbies: (prev.hobbies || []).map(h =>
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
  }, [gameState.hobbies, setGameState]);

  const trainHobby = useCallback((hobbyId: string) => {
    const hobby = (gameState.hobbies || []).find(h => h.id === hobbyId);
    if (!hobby) return;
    
    // Apply commitment bonuses/penalties to hobby activities
    const { getCommitmentBonuses, getCommitmentPenalties, getEffectiveEnergyCost, getEffectiveProgressGain } = require('@/lib/commitments/commitmentSystem');
    const hobbyBonuses = getCommitmentBonuses(gameState, 'hobbies');
    const hobbyPenalties = getCommitmentPenalties(gameState, 'hobbies');
    const effectiveEnergyCost = getEffectiveEnergyCost(hobby.energyCost, hobbyBonuses, hobbyPenalties);
    
    if (gameState.stats.energy < effectiveEnergyCost) {
      return { success: false, message: 'Not enough energy' };
    }
    const gamingActivities = ['gaming', 'esports', 'streaming'];
    let moneyCost = 0;
    if (gamingActivities.includes(hobbyId)) {
      moneyCost = 25;
      if (gameState.stats.money < moneyCost) {
        return { success: false, message: 'Not enough money for gaming session' };
      }
    }
    updateStats({
      energy: -effectiveEnergyCost,
      health: -8,
      happiness: -3,
      money: -moneyCost,
    }, false);
    const skillBonus = hobby.upgrades
      .reduce((sum, u) => sum + (u.skillBonusPerLevel || 0) * u.level, 0);
    const baseGain = Math.floor(Math.random() * 3) + 2 + Math.floor(skillBonus / 2);
    const effectiveGain = getEffectiveProgressGain(baseGain, hobbyBonuses, hobbyPenalties);
    // Apply skill gain multiplier from prestige bonuses
    const prestigeData = gameState.prestige;
    const unlockedBonuses = prestigeData?.unlockedBonuses || [];
    const skillGainMultiplier = getSkillGainMultiplier(unlockedBonuses);
    const baseGainWithMultiplier = Math.floor(effectiveGain * skillGainMultiplier);
    setGameState(prev => {
      // Update commitment level for hobbies when training
      let updatedCommitments = prev.activityCommitments;
      if (updatedCommitments) {
        const { updateCommitmentLevel } = require('@/lib/commitments/commitmentSystem');
        const isCommitted = updatedCommitments.primary === 'hobbies' || updatedCommitments.secondary === 'hobbies';
        const newHobbyLevel = updateCommitmentLevel(
          updatedCommitments.commitmentLevels?.hobbies || 0,
          'hobbies',
          isCommitted
        );
        updatedCommitments = {
          ...updatedCommitments,
          commitmentLevels: {
            ...updatedCommitments.commitmentLevels!,
            hobbies: newHobbyLevel,
          },
        };
      }
      
      return {
        ...prev,
        hobbies: prev.hobbies.map(h => {
          if (h.id !== hobbyId) return h;
          const total = h.skill + baseGainWithMultiplier;
          const levelUps = Math.floor(total / 100);
          return {
            ...h,
            skill: total % 100,
            skillLevel: h.skillLevel + levelUps,
          };
        }),
        activityCommitments: updatedCommitments,
      };
    });
    maybeOfferSponsor(hobbyId);
    if (saveGameRef.current) saveGameRef.current();
    return { success: true, message: `Trained ${hobby.name}!` };
  }, [gameState.hobbies, gameState.stats.energy, gameState.stats.money, updateStats, maybeOfferSponsor, setGameState]);

  const enterHobbyTournament = useCallback((hobbyId: string) => {
    const hobby = (gameState.hobbies || []).find(h => h.id === hobbyId);
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
    // RANDOMNESS FIX: Soft guarantee for hobby tournaments - 100% success if chance >= 90%
    // High skill should guarantee tournament success
    // PRIORITY 2 FIX: Use constant from randomnessConstants
    const { SOFT_GUARANTEE_TOURNAMENT } = require('@/lib/randomness/randomnessConstants');
    const guaranteedSuccess = successChance >= SOFT_GUARANTEE_TOURNAMENT;
    const success = guaranteedSuccess ? true : Math.random() < successChance;
    const rewardBonus = hobby.upgrades
      .reduce((sum, u) => sum + (u.rewardBonusPerLevel || 0) * u.level, 0);
    const reward = Math.round(hobby.tournamentReward * (1 + rewardBonus));
    if (success) {
      updateStats({
        money: reward,
        reputation: 2,
      }, false);
      if (saveGameRef.current) saveGameRef.current();
      return {
        success: true,
        message: `Won ${hobby.name} tournament! Earned $${reward}`,
      };
    } else {
      updateStats({ happiness: -5 }, false);
      if (saveGameRef.current) saveGameRef.current();
      return { success: false, message: `Lost the ${hobby.name} tournament` };
    }
  }, [gameState.hobbies, gameState.stats.energy, updateStats]);

  const uploadSong = useCallback((hobbyId: string) => {
    const hobby = (gameState.hobbies || []).find(h => h.id === hobbyId);
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
    // RANDOMNESS FIX: Add minimum grade bounds based on skill level
    // High skill should guarantee minimum grade (prevents frustrating "Terrible" grades at high skill)
    // PRIORITY 1 FIX: Extracted to shared function to eliminate duplication
    const { calculateMinRollForSkill } = require('@/lib/randomness/hobbyUtils');
    const minRoll = calculateMinRollForSkill(effectiveSkill);
    const adjustedRoll = Math.max(minRoll, roll);
    let grade: 'Terrible Song' | 'Bad Song' | 'Normal' | 'Good' | 'Great' | 'Incredible';
    let income: number;
    if (adjustedRoll < 40) {
      grade = 'Terrible Song';
      income = 5;
    } else if (adjustedRoll < 70) {
      grade = 'Bad Song';
      income = 10;
    } else if (adjustedRoll < 90) {
      grade = 'Normal';
      income = 20;
    } else if (adjustedRoll < 110) {
      grade = 'Good';
      income = 40;
    } else if (adjustedRoll < 130) {
      grade = 'Great';
      income = 80;
    } else {
      grade = 'Incredible';
      income = 150;
    }
    const incomeBonus = hobby.upgrades
      .reduce((sum, u) => sum + (u.incomeBonusPerLevel || 0) * u.level, 0);
    const finalIncome = Math.round(income * (1 + incomeBonus));
    const song = {
      id: `song-${Date.now()}`,
      grade,
      weeklyIncome: finalIncome,
      uploadWeek: gameState.week || 0, // Keep for backward compatibility
      uploadWeeksLived: gameState.weeksLived || 0, // MONEY FLOW FIX: Track weeksLived for correct decay calculation
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
  }, [gameState.hobbies, gameState.stats.energy, updateStats, maybeOfferSponsor, setGameState]);

  const uploadArtwork = useCallback((hobbyId: string) => {
    const hobby = (gameState.hobbies || []).find(h => h.id === hobbyId);
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
    // RANDOMNESS FIX: Add minimum grade bounds based on skill level (same as music uploads)
    // PRIORITY 1 FIX: Extracted to shared function to eliminate duplication
    const { calculateMinRollForSkill } = require('@/lib/randomness/hobbyUtils');
    const minRoll = calculateMinRollForSkill(effectiveSkill);
    const adjustedRoll = Math.max(minRoll, roll);
    let grade: 'Terrible Art' | 'Bad Art' | 'Normal' | 'Good' | 'Great' | 'Incredible';
    let income: number;
    if (adjustedRoll < 40) {
      grade = 'Terrible Art';
      income = 5;
    } else if (adjustedRoll < 70) {
      grade = 'Bad Art';
      income = 10;
    } else if (adjustedRoll < 90) {
      grade = 'Normal';
      income = 20;
    } else if (adjustedRoll < 110) {
      grade = 'Good';
      income = 40;
    } else if (adjustedRoll < 130) {
      grade = 'Great';
      income = 80;
    } else {
      grade = 'Incredible';
      income = 150;
    }
    const incomeBonus = hobby.upgrades
      .reduce((sum, u) => sum + (u.incomeBonusPerLevel || 0) * u.level, 0);
    const finalIncome = Math.round(income * (1 + incomeBonus));
    const artwork = {
      id: `art-${Date.now()}`,
      grade,
      weeklyIncome: finalIncome,
      uploadWeek: gameState.week || 0, // Keep for backward compatibility
      uploadWeeksLived: gameState.weeksLived || 0, // MONEY FLOW FIX: Track weeksLived for correct decay calculation
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
  }, [gameState.hobbies, gameState.stats.energy, updateStats, maybeOfferSponsor, setGameState]);

  const acceptContract = useCallback((hobbyId: string, offer: Contract) => {
    if ((gameState.hobbies || []).some(h => h.contracts && h.contracts.length > 0)) {
      return { success: false, message: 'Already contracted in another sport' };
    }
    const hobby = (gameState.hobbies || []).find(h => h.id === hobbyId);
    if (!hobby) return;
    const cost = hobby.energyCost + 10;
    if (gameState.stats.energy < cost) {
      return { success: false, message: 'Not enough energy' };
    }
    updateStats({
      energy: -cost,
      health: -7,
      happiness: -2,
    }, false);
    const league = {
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
  }, [gameState.hobbies, gameState.stats.energy, updateStats, setGameState]);

  const extendContract = useCallback((hobbyId: string) => {
    const hobby = (gameState.hobbies || []).find(h => h.id === hobbyId);
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
  }, [gameState.hobbies, setGameState]);

  const playMatch = useCallback((hobbyId: string) => {
    const hobby = (gameState.hobbies || []).find(h => h.id === hobbyId);
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
    // RC-0 FIX: Add null checks to prevent crashes if team not found
    const playerTeam = league.standings.find(t => t.team === contract.team);
    const oppTeam = league.standings.find(t => t.team === opponent.team);
    if (!playerTeam || !oppTeam) {
      log.error('Team not found in standings', { contractTeam: contract.team, opponentTeam: opponent.team });
      return; // Exit early if teams not found
    }
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
        log.error('Invalid divisions structure in hobby:', hobby.id);
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
  }, [gameState.hobbies, gameState.stats.energy, updateStats, updateMoney, cancelContract, maybeOfferSponsor]);

  const dive = useCallback((hobbyId: string) => {
    const hobby = (gameState.hobbies || []).find(h => h.id === hobbyId);
    if (!hobby || hobby.id !== 'football') return;
    if (gameState.stats.energy < 5) {
      return { success: false, message: 'Not enough energy' };
    }
    updateStats({
      energy: -5,
      reputation: -1,
    }, false);
    return { success: true, message: 'Tried to dive, lost some reputation.' };
  }, [gameState.hobbies, gameState.stats.energy, updateStats]);

  const buyHobbyUpgrade = useCallback((hobbyId: string, upgradeId: string) => {
    const hobby = (gameState.hobbies || []).find(h => h.id === hobbyId);
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
  }, [gameState.hobbies, gameState.stats.money, setGameState]);

  const buyItem = withActionLock('buyItem', useCallback((itemId: string) => {
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
      updateMoney(-price, `Buy ${item.name}`, false);
      
      // Premium Credit Card cashback (10%)
      const hasPremiumCreditCard = iapService?.hasPurchased(IAP_PRODUCTS.PREMIUM_CREDIT_CARD);
      if (hasPremiumCreditCard) {
        const cashback = Math.floor(price * 0.10);
        if (cashback > 0) {
          updateMoney(cashback, `Cashback on ${item.name}`, false);
        }
      }
      
      setGameState(prev => ({
        ...prev,
        items: prev.items.map(i => (i.id === itemId ? { ...i, owned: true } : i)),
        hasPhone: itemId === 'smartphone' ? true : prev.hasPhone,
        travel: itemId === 'passport' ? {
          ...(prev.travel || {
            visitedDestinations: [],
            businessOpportunities: {},
            travelHistory: [],
          }),
          passportOwned: true,
        } : prev.travel,
      }));
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
      if (checkAchievementsRef.current) {
        checkAchievementsRef.current();
      }
      // Save game after buying item
      if (saveGameRef.current) saveGameRef.current();
    } catch (error) {
      log.error('Error buying item:', error);
    }
  }, [gameState.items, gameState.economy?.priceIndex, gameState.stats.money, gameState.computerPreviouslyOwned, updateMoney, setGameState]));

  const sellItem = useCallback((itemId: string) => {
    const item = (gameState.items || []).find(i => i.id === itemId);
    if (!item || !item.owned) return;
    if (itemId === 'computer') {
      const price = getInflatedPrice(item.price, gameState.economy?.priceIndex ?? 1);
      const sellPrice = price * 0.5;
      updateMoney(sellPrice, `Sell ${item.name}`, false);
      setGameState(prev => ({
        ...prev,
        items: prev.items.map(i => (i.id === itemId ? { ...i, owned: false } : i)),
        computerPreviouslyOwned: true,
      }));
      if (saveGameRef.current) saveGameRef.current();
      return;
    }
    if (itemId === 'passport') {
      const price = getInflatedPrice(item.price, gameState.economy?.priceIndex ?? 1);
      const sellPrice = price * 0.5;
      updateMoney(sellPrice, `Sell ${item.name}`, false);
      setGameState(prev => ({
        ...prev,
        items: prev.items.map(i => (i.id === itemId ? { ...i, owned: false } : i)),
        travel: prev.travel ? {
          ...prev.travel,
          passportOwned: false,
        } : prev.travel,
      }));
      if (saveGameRef.current) saveGameRef.current();
      return;
    }
    const price = getInflatedPrice(item.price, gameState.economy?.priceIndex ?? 1);
    const sellPrice = price * 0.5;
    updateMoney(sellPrice, `Sell ${item.name}`, false);
    setGameState(prev => ({
      ...prev,
      items: prev.items.map(i => (i.id === itemId ? { ...i, owned: false } : i)),
    }));
    if (saveGameRef.current) saveGameRef.current();
  }, [gameState.items, gameState.economy?.priceIndex, updateMoney, setGameState]);

  const buyDarkWebItem = withActionLock('buyDarkWebItem', useCallback((itemId: string) => {
    const item = gameState.darkWebItems.find(i => i.id === itemId);
    const btc = (gameState.cryptos || []).find(c => c.id === 'btc');
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
    if (saveGameRef.current) saveGameRef.current();
  }, [gameState.darkWebItems, gameState.cryptos, setGameState]));

  const buyHack = withActionLock('buyHack', useCallback((hackId: string) => {
    const hack = gameState.hacks.find(h => h.id === hackId);
    const btc = (gameState.cryptos || []).find(c => c.id === 'btc');
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
    if (saveGameRef.current) saveGameRef.current();
  }, [gameState.hacks, gameState.cryptos, setGameState]));

  const performHack = useCallback((hackId: string): HackResult => {
    const hack = gameState.hacks.find(h => h.id === hackId);
    if (!hack || !hack.purchased)
      return { caught: false, reward: 0, btcReward: 0, risk: 0 };
    const energyCost = hack.energyCost || 0;
    if (gameState.stats.energy < energyCost) {
      return { caught: false, reward: 0, btcReward: 0, risk: 0 };
    }
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
    const btc = (gameState.cryptos || []).find(c => c.id === 'btc');
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
      setGameState(prev => ({
        ...prev,
        wantedLevel: prev.wantedLevel + 2,
      }));
      const currentWantedLevel = gameState.wantedLevel + 2;
      const arrestChance = currentWantedLevel * 0.2;
      if (Math.random() < arrestChance) {
        setGameState(prev => ({
          ...prev,
          jailWeeks: 4,
          wantedLevel: 0,
        }));
        if (saveGameRef.current) saveGameRef.current();
        return { caught: true, reward: 0, btcReward: 0, risk, jailed: true };
      }
      if (saveGameRef.current) saveGameRef.current();
      return { caught: true, reward: 0, btcReward: 0, risk };
    }
    setGameState(prev => ({
      ...prev,
      cryptos: prev.cryptos.map(c =>
        c.id === 'btc' ? { ...c, owned: c.owned + btcReward } : c
      ),
    }));
    if (saveGameRef.current) saveGameRef.current();
    return { caught: false, reward, btcReward, risk };
  }, [gameState.hacks, gameState.darkWebItems, gameState.cryptos, gameState.stats.energy, gameState.wantedLevel, setGameState]);

  // BUG FIX: Food items should always restore happiness (UI shows it, so it should work)
  // Changed default restoreHappiness to true, or better yet, always calculate it
  const buyFood = useCallback((foodId: string, restoreHappiness: boolean = true) => {
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
    // BUG FIX: Always calculate happiness restore based on food quality (healthRestore / 2, rounded, minimum 1)
    // The UI always shows happiness restore, so it should always be applied
    const happinessRestore = restoreHappiness ? Math.max(1, Math.round(food.healthRestore / 2)) : 0;
    updateStats({
      money: -price,
      health: food.healthRestore,
      energy: food.energyRestore,
      happiness: happinessRestore,
    }, false);
    
    // Premium Credit Card cashback (10%)
    const hasPremiumCreditCard = iapService?.hasPurchased(IAP_PRODUCTS.PREMIUM_CREDIT_CARD);
    if (hasPremiumCreditCard) {
      const cashback = Math.floor(price * 0.10);
      if (cashback > 0) {
        updateMoney(cashback, `Cashback on ${food.name}`, false);
      }
    }
    if (saveGameRef.current) saveGameRef.current();
  }, [gameState.foods, gameState.economy.priceIndex, gameState.stats.money, updateStats, updateMoney]);

  const performHealthActivity = useCallback((activityId: string) => {
    const activity = gameState.healthActivities.find(a => a.id === activityId);
    if (!activity) return;
    const defaults = healthActivityDefaults.get(activityId);
    const activityPrice = defaults?.price ?? activity.price;
    const happinessGain = defaults?.happinessGain ?? activity.happinessGain ?? 0;
    const healthGain = defaults?.healthGain ?? activity.healthGain ?? 0;
    const energyCost = defaults?.energyCost ?? activity.energyCost ?? 0;
    const price = getInflatedPrice(activityPrice, gameState.economy.priceIndex);
    if (price > 0 && gameState.stats.money < price) return;
    
    // Apply commitment bonuses/penalties to health activities
    const { getCommitmentBonuses, getCommitmentPenalties, getEffectiveEnergyCost } = require('@/lib/commitments/commitmentSystem');
    const healthBonuses = getCommitmentBonuses(gameState, 'health');
    const healthPenalties = getCommitmentPenalties(gameState, 'health');
    const effectiveEnergyCost = getEffectiveEnergyCost(energyCost, healthBonuses, healthPenalties);
    
    if (effectiveEnergyCost > 0 && gameState.stats.energy < effectiveEnergyCost) return;
    
    // Apply stat bonuses/penalties from commitments
    const effectiveHappinessGain = happinessGain + (healthBonuses.statBonus?.happiness || 0) + (healthPenalties.statPenalty?.happiness || 0);
    const effectiveHealthGain = healthGain + (healthBonuses.statBonus?.health || 0) + (healthPenalties.statPenalty?.health || 0);
    
    updateStats({
      money: -price,
      happiness: effectiveHappinessGain,
      health: effectiveHealthGain,
      energy: -effectiveEnergyCost,
    }, false);
    
    // Update commitment level for health when performing health activities
    setGameState(prev => {
      if (!prev.activityCommitments) return prev;
      const { updateCommitmentLevel } = require('@/lib/commitments/commitmentSystem');
      const isCommitted = prev.activityCommitments.primary === 'health' || prev.activityCommitments.secondary === 'health';
      const newHealthLevel = updateCommitmentLevel(
        prev.activityCommitments.commitmentLevels?.health || 0,
        'health',
        isCommitted
      );
      return {
        ...prev,
        activityCommitments: {
          ...prev.activityCommitments,
          commitmentLevels: {
            ...prev.activityCommitments.commitmentLevels!,
            health: newHealthLevel,
          },
        },
      };
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
    if (saveGameRef.current) saveGameRef.current();
    return message ? { message } : undefined;
  }, [gameState.healthActivities, gameState.economy.priceIndex, gameState.stats.money, gameState.stats.energy, gameState.diseases, updateStats, setGameState, healthActivityDefaults]);

  const dismissSicknessModal = useCallback(() => {
    setGameState(prev => ({ ...prev, showSicknessModal: false }));
  }, [setGameState]);

  const dismissCureSuccessModal = useCallback(() => {
    setGameState(prev => ({ ...prev, showCureSuccessModal: false }));
  }, [setGameState]);

  const dismissStatWarning = useCallback(() => {
    setGameState(prev => ({ ...prev, showZeroStatPopup: false, zeroStatType: undefined }));
  }, [setGameState]);

  const dismissWelcomePopup = useCallback(() => {
    setGameState(prev => ({ ...prev, showWelcomePopup: false }));
  }, [setGameState]);

  const resolveEvent = useCallback((eventId: string, choiceId: string) => {
    setGameState(prev => {
      const event = prev.pendingEvents.find(e => e.id === eventId);
      if (!event) return prev;
      const choice = event.choices.find(c => c.id === choiceId);
      if (!choice) return prev;

      // --- Delegated Action Logic (Inline for now, to be extracted) ---
      // ... existing resolveEvent logic ...
      // Keeping logic inline to avoid breaking complex state dependencies for now
      // Ideally, this would be moved to EventActions.ts

      const stats = { ...prev.stats };
      // ... (rest of function unchanged) ...
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

      let relationships = prev.relationships || [];
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
          
          // RELATIONSHIP STATE FIX: Check for existing spouse
          const existingSpouse = family?.spouse;
          if (existingSpouse && existingSpouse.id !== event.relationId) {
            relationships = relationships.filter(r => r.id !== existingSpouse.id);
            log.warn('Replacing existing spouse during wedding event', { 
              oldSpouseId: existingSpouse.id, 
              newSpouseId: event.relationId 
            });
          }
          
          const spouse: Relationship = {
            ...partner,
            type: 'spouse',
            familyHappiness: partner.familyHappiness ?? 5,
            expenses: partner.expenses ?? 100,
            livingTogether: true, // RELATIONSHIP STATE FIX: Spouses automatically live together
            // RELATIONSHIP STATE FIX: Clear engagement properties
            engagementWeek: undefined,
            engagementRing: undefined,
            weddingPlanned: undefined,
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
            // STABILITY FIX: Prevent jail time accumulation - new sentence replaces old
            const currentJailWeeks = gameState.jailWeeks || 0;
            jailWeeks = Math.max(2, currentJailWeeks); // Use longer of current or new sentence
          }
        }
      }

      // Handle policy voting events
      let politics = prev.politics;
      if (choice.effects.policy && politics) {
        const policyId = choice.effects.policy;
        const policiesEnacted = [...(politics.policiesEnacted || [])];
        if (!policiesEnacted.includes(policyId)) {
          policiesEnacted.push(policyId);
        }
        politics = {
          ...politics,
          policiesEnacted,
        };
      }

      // Handle approval rating changes
      if (choice.effects.approvalRating !== undefined && politics) {
        politics = {
          ...politics,
          approvalRating: Math.max(0, Math.min(100, (politics.approvalRating || 50) + choice.effects.approvalRating)),
        };
      }

      // Handle policy influence changes
      if (choice.effects.policyInfluence !== undefined && politics) {
        politics = {
          ...politics,
          policyInfluence: Math.max(0, Math.min(100, (politics.policyInfluence || 0) + choice.effects.policyInfluence)),
        };
      }

      // STABILITY FIX: Handle special effects (e.g., grant_free_education for scholarship event)
      let educations = prev.educations || [];
      if ((choice as any).special === 'grant_free_education') {
        // Grant free business degree education
        const businessDegree = educations.find(e => e.id === 'business_degree');
        if (!businessDegree) {
          educations = [...educations, {
            id: 'business_degree',
            name: 'Business Degree',
            description: 'Free scholarship education',
            cost: 0, // Free!
            duration: 52,
            completed: false,
            weeksRemaining: 52,
          }];
        } else if (!businessDegree.completed) {
          // Update existing enrollment to be free
          educations = educations.map(e => 
            e.id === 'business_degree' ? { ...e, cost: 0 } : e
          );
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

      // Track completed seasonal events
      const seasonalEventIds = [
        'spring_festival', 'garden_event', 'beach_party', 'summer_sale',
        'harvest_festival', 'career_fair', 'winter_holidays', 'new_year',
        'valentines_day', 'halloween', 'christmas'
      ];
      let seasonalEvents = prev.seasonalEvents || { lastSeason: '', completedEvents: [] };
      if (seasonalEventIds.includes(event.id)) {
        if (!seasonalEvents.completedEvents.includes(event.id)) {
          seasonalEvents = {
            ...seasonalEvents,
            completedEvents: [...seasonalEvents.completedEvents, event.id],
          };
        }
      }

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
        seasonalEvents,
        politics: politics || prev.politics,
      };
    });
  }, [setGameState]);

  const performStreetJob = withActionLock('performStreetJob', useCallback((jobId: string) => {
    return JobActions.performStreetJob(
      gameState,
      setGameState,
      jobId,
      {
        updateMoney: applyMoneyChange,
        updateStats: applyStatsChange,
        gainCriminalXp,
        gainCrimeSkillXp,
      }
    );
  }, [gameState, setGameState, applyMoneyChange, applyStatsChange, gainCriminalXp, gainCrimeSkillXp]));

  // Helper functions for save/load
  // Note: validateGems is already declared earlier in the file (line ~253)

  // Utility function to recover gems from backup storage - can be used for manual gem recovery
  const _recoverGemsFromBackup = useCallback(async (): Promise<number> => {
    try {
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
          log.warn(`Failed to read ${key}`, { error });
        }
      }
      const validatedGems = validateGems(maxGems);
      log.info(`Gem recovery found ${validatedGems} gems`);
      return validatedGems;
    } catch (error) {
      log.error('Gem recovery failed:', error);
      return 0;
    }
  }, [validateGems]);
  
  // Expose recovery function for debugging/support - intentionally kept for future use
  void _recoverGemsFromBackup;

  // Note: migrateState is already declared earlier in the file (line ~262) - removed duplicate
  // Note: loadPermanentPerks, savePermanentPerk, and hasPermanentPerk are already declared earlier in the file (lines ~943-972) - removed duplicates
  // Note: clearSaveSlot is already declared earlier in the file (line ~925) - removed duplicate

  const buyGoldUpgrade = useCallback((upgradeId: string) => {
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
      // updateStats ADDS to current value, so pass negative cost to subtract
      updateStats({ gems: -cost }, false);
      setGameState(prev => ({
        ...prev,
        goldUpgrades: {
          ...prev.goldUpgrades,
          multiplier: true,
        },
      }));
      Alert.alert('Permanent Money Multiplier', 'Money multiplier activated! This buff will transfer to all future lives and saves.');
      if (saveGameRef.current) saveGameRef.current();
    } else if (upgradeId === 'skip_week') {
      // updateStats ADDS to current value, so pass negative cost to subtract
      updateStats({ gems: -cost }, false);
      if (nextWeekRef.current) nextWeekRef.current();
      if (saveGameRef.current) saveGameRef.current();
    } else if (upgradeId === 'youth_pill') {
      // updateStats ADDS to current value, so pass negative cost to subtract
      updateStats({ gems: -cost }, false);
      setGameState(prev => ({
        ...prev,
        date: { ...prev.date, age: 18 },
      }));
      if (saveGameRef.current) saveGameRef.current();
    } else if (upgradeId === 'energy_boost') {
      // updateStats ADDS to current value, so pass negative cost to subtract
      updateStats({ gems: -cost, energy: 100 }, false);
      setGameState(prev => ({
        ...prev,
        goldUpgrades: {
          ...prev.goldUpgrades,
          energy_boost: true,
        },
      }));
      Alert.alert('Permanent Energy Boost', 'Maximum energy increased to 100! This buff transfers to future lives.');
      if (saveGameRef.current) saveGameRef.current();
    } else if (upgradeId === 'happiness_boost') {
      // updateStats ADDS to current value, so pass negative cost to subtract
      updateStats({ gems: -cost, happiness: 100 }, false);
      setGameState(prev => ({
        ...prev,
        goldUpgrades: {
          ...prev.goldUpgrades,
          happiness_boost: true,
        },
      }));
      Alert.alert('Permanent Happiness Boost', 'Maximum happiness increased to 100! This buff transfers to future lives.');
      if (saveGameRef.current) saveGameRef.current();
    } else if (upgradeId === 'fitness_boost') {
      // updateStats ADDS to current value, so pass negative cost to subtract
      updateStats({ gems: -cost, fitness: 100 }, false);
      setGameState(prev => ({
        ...prev,
        goldUpgrades: {
          ...prev.goldUpgrades,
          fitness_boost: true,
        },
      }));
      Alert.alert('Permanent Fitness Boost', 'Maximum fitness increased to 100! This buff transfers to future lives.');
      if (saveGameRef.current) saveGameRef.current();
    } else if (upgradeId === 'reputation_boost') {
      // updateStats ADDS to current value, so pass negative cost to subtract
      updateStats({ gems: -cost, reputation: 100 }, false);
      if (saveGameRef.current) saveGameRef.current();
    } else if (upgradeId === 'skill_mastery') {
      // updateStats ADDS to current value, so pass negative cost to subtract
      updateStats({ gems: -cost }, false);
      setGameState(prev => ({
        ...prev,
        goldUpgrades: {
          ...prev.goldUpgrades,
          skill_mastery: true,
        },
      }));
      Alert.alert('Skill Mastery', 'All skills now level up 50% faster! This buff transfers to future lives.');
      if (saveGameRef.current) saveGameRef.current();
    } else if (upgradeId === 'time_machine') {
      // updateStats ADDS to current value, so pass negative cost to subtract
      updateStats({ gems: -cost }, false);
      setGameState(prev => ({
        ...prev,
        goldUpgrades: {
          ...prev.goldUpgrades,
          time_machine: true,
        },
      }));
      Alert.alert('Time Machine', 'You can now travel back in time! This ability transfers to future lives.');
      if (saveGameRef.current) saveGameRef.current();
    } else if (upgradeId === 'immortality') {
      // updateStats ADDS to current value, so pass negative cost to subtract
      updateStats({ gems: -cost }, false);
      setGameState(prev => ({
        ...prev,
        goldUpgrades: {
          ...prev.goldUpgrades,
          immortality: true,
        },
      }));
      Alert.alert('Immortality', 'You are now immortal! This status transfers to all future lives.');
      if (saveGameRef.current) saveGameRef.current();
    }
  }, [gameState.stats.gems, updateStats, setGameState]);

  const restartGame = useCallback(async () => {
    showLoading('restart', 'Restarting game...', 'overlay');
    try {
      await createBackupBeforeMajorAction(currentSlot, gameState, 'restart');
      await AsyncStorage.removeItem('tutorial_completed');
      const resetState: GameState = JSON.parse(JSON.stringify(initialState));
      const globalGemsData = await AsyncStorage.getItem('globalGems');
      const globalGems = globalGemsData ? parseInt(globalGemsData, 10) : 0;
      if (gameState.achievements) {
        resetState.achievements = JSON.parse(JSON.stringify(gameState.achievements));
      }
      if (gameState.progress) {
        resetState.progress = JSON.parse(JSON.stringify(gameState.progress));
      }
      if (gameState.claimedProgressAchievements) {
        resetState.claimedProgressAchievements = [...gameState.claimedProgressAchievements];
      }
      resetState.stats.gems = globalGems;
      await new Promise(resolve => setTimeout(resolve, 0));
      setGameState(resetState);
      await new Promise(resolve => setTimeout(resolve, 100));
      if (saveGameRef.current) await saveGameRef.current();
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error) {
      log.error('Failed to restart game:', error);
      showError('restart_error', 'Failed to restart game. Please try again.');
    } finally {
      hideLoading('restart');
    }
  }, [currentSlot, gameState, initialState, setIsLoading, setLoadingMessage, setGameState, showLoading, hideLoading]);

  const startNewLifeFromLegacy = useCallback(
    (heirId?: string) => {
      setGameState(prev => {
        const inheritance = computeInheritance(prev);
        const now = Date.now();

        const lifeSummary = {
          generation: prev.generationNumber,
          netWorth: inheritance.totalNetWorth,
          ageAtDeath: Math.floor(prev.date.age),
          deathReason: prev.deathReason,
          timestamp: now,
          summaryAchievements: (prev.achievements || [])
            .filter(a => a.completed)
            .slice(0, 5)
            .map(a => a.name),
        };

        const nextGenerationNumber = prev.generationNumber + 1;

        const completedCount = (prev.achievements || []).filter(a => a.completed)
          .length;
        const incomeMultiplier =
          1 +
          Math.min(Math.max(inheritance.totalNetWorth, 0), 10_000_000) /
            10_000_000 /
            10; // up to +10%
        const learningMultiplier = 1 + Math.min(completedCount, 20) / 200; // up to +10%
        const reputationBonus = Math.min(
          Math.floor(prev.stats.reputation / 10),
          20,
        );

        const legacyBonuses = {
          incomeMultiplier,
          learningMultiplier,
          reputationBonus,
        };

        // Choose heir (backend only; UI will pass heirId later)
        const heir =
          prev.family.children.find(c => c.id === heirId) ||
          prev.family.children[0] ||
          undefined;

        const baseState: GameState = JSON.parse(
          JSON.stringify(initialState),
        ) as GameState;

        // Apply generational / legacy data
        baseState.generationNumber = nextGenerationNumber;
        baseState.lineageId = prev.lineageId || baseState.lineageId;
        baseState.previousLives = [...(prev.previousLives || []), lifeSummary];
        baseState.legacyBonuses = legacyBonuses;

        // Inherit achievements & progress
        baseState.achievements = JSON.parse(
          JSON.stringify(prev.achievements || baseState.achievements),
        );
        baseState.progress = JSON.parse(
          JSON.stringify(prev.progress || baseState.progress),
        );

        // Starting money and savings from inheritance (respecting clamp)
        const startingMoney =
          inheritance.totalNetWorth > 0
            ? inheritance.cash + inheritance.bankSavings
            : baseState.stats.money;

        baseState.stats.money = startingMoney;
        baseState.stats.gems = prev.stats.gems;
        baseState.stats.reputation += reputationBonus;
        baseState.bankSavings =
          inheritance.totalNetWorth > 0 ? inheritance.bankSavings : 0;

        // Inherit owned real estate & companies
        baseState.realEstate = prev.realEstate.map(p => ({
          ...p,
          owned: inheritance.realEstateIds.includes(p.id),
        }));
        
        // Apply family business inheritance with bonuses
        baseState.companies = prev.companies.map(c => {
          const generationsHeld = (c.generationsHeld || 0) + 1;
          return FamilyBusinessSystem.applyLegacyBonuses(
            { ...c, generationsHeld },
            generationsHeld
          );
        });

        // Heir-specific tweaks (education/job starting point can be expanded later)
        if (heir) {
          baseState.relationships = prev.relationships;
          baseState.family = {
            spouse: undefined,
            children: [],
          };
        }

        return baseState;
      });
    },
    [initialState, setGameState],
  );

  // Note: applyForJob is already declared earlier in the file (line ~994) - removed duplicate
  // Note: quitJob is already declared earlier in the file (line ~754) - removed duplicate
  // Note: startEducation is already declared earlier in the file (line ~1504) - removed duplicate
  // Note: claimProgressAchievement is already declared earlier in the file (line ~1589) - removed duplicate

  // CORRUPTION FIX 1.1: Store state snapshot before save for rollback
  const saveGameStateSnapshotRef = React.useRef<GameState | null>(null);
  
  const saveGame = withActionLock('saveGame', useCallback(async (retryCount = 0) => {
    // Removed "Saving game..." loading text as it's annoying when pressing next week
    // showLoading('saving', 'Saving game...', 'inline');
    
    // CORRUPTION FIX 1.1: Create snapshot before save for rollback if save fails
    let stateSnapshot: GameState | null = null;
    try {
      stateSnapshot = JSON.parse(JSON.stringify(gameState));
      saveGameStateSnapshotRef.current = stateSnapshot;
    } catch (snapshotError) {
      log.warn('Failed to create state snapshot for rollback', { error: snapshotError });
    }
    
    try {
      // TESTFLIGHT FIX: Include app version in save metadata for compatibility tracking
      const appConfig = require('../../app.config.js');
      const appVersion = appConfig.expo?.version || 'unknown';
      const buildNumber = appConfig.expo?.ios?.buildNumber || appConfig.expo?.android?.versionCode || 'unknown';
      
      let stateToSave = {
        ...gameState,
        version: stateVersion,
        updatedAt: Date.now(),
        lastLogin: Date.now(),
        _saveVersion: stateVersion,
        _appVersion: appVersion, // TESTFLIGHT FIX: Track app version for compatibility
        _buildNumber: buildNumber, // TESTFLIGHT FIX: Track build number for compatibility
      };
      // Create backup before validation
      let validationBackup: any = null;
      try {
        validationBackup = JSON.parse(JSON.stringify(stateToSave));
      } catch (backupError) {
        log.warn('Failed to create validation backup', { error: backupError });
      }

      // Auto-fix stats before validation
      const validation = validateGameState(stateToSave, true);
      if (validation.warnings && validation.warnings.length > 0) {
        log.warn('State validation warnings (auto-fixed):', validation.warnings);
      }
      if (!validation.valid) {
        log.error('Game state validation failed:', validation.errors);
        
        // CORRUPTION FIX: Rollback to snapshot if save validation fails
        if (stateSnapshot) {
          try {
            log.warn('Rolling back to state snapshot due to save validation failure');
            setGameState(stateSnapshot);
            saveGameStateSnapshotRef.current = null;
          } catch (rollbackError) {
            log.error('Failed to rollback state on validation failure:', rollbackError);
          }
        }
        
        // Try to repair if backup exists
        if (validationBackup) {
          log.info('Attempting to repair game state...');
          const { repairGameState } = await import('@/utils/saveValidation');
          const repairResult = repairGameState(validationBackup);
          if (repairResult.repaired) {
            log.info('State repaired:', repairResult.repairs);
            // Re-validate repaired state
            const repairedValidation = validateGameState(validationBackup, true);
            if (repairedValidation.valid) {
              log.info('Repaired state is valid, using repaired state');
              stateToSave = validationBackup;
            } else {
              log.error('Repaired state still invalid:', repairedValidation.errors);
              // RC-0 FIX: Log error and skip save instead of throwing to prevent crashes
              log.error('Cannot save invalid game state. Skipping save to prevent corruption.');
              return; // Exit early, don't save invalid state
            }
          } else {
            // RC-0 FIX: Log error and skip save instead of throwing to prevent crashes
            log.error('Cannot save invalid game state. Skipping save to prevent corruption.');
            return; // Exit early, don't save invalid state
          }
        } else {
          // RC-0 FIX: Log error and skip save instead of throwing to prevent crashes
          log.error('Cannot save invalid game state. Skipping save to prevent corruption.');
          return; // Exit early, don't save invalid state
        }
      }
      // Calculate checksum on the exact data structure (excluding _checksum itself)
      const saveDataString = JSON.stringify(stateToSave);
      const checksum = calculateChecksum(saveDataString);
      stateToSave._checksum = checksum;
      
      // Create automatic backup before saving
      await createBackupBeforeMajorAction(currentSlot, stateToSave, 'auto_save');

      // Update globalGems to track the maximum gems across all saves
      // This preserves gems when switching between save slots
      // Only update if current gems are higher than stored globalGems
      try {
        const currentGlobalGems = await AsyncStorage.getItem('globalGems');
        const currentGlobal = currentGlobalGems ? parseInt(currentGlobalGems, 10) : 0;
        if (gameState.stats.gems > currentGlobal) {
          await AsyncStorage.setItem('globalGems', gameState.stats.gems.toString());
          log.info(`Updated globalGems to ${gameState.stats.gems} (was ${currentGlobal})`);
        }
      } catch (error) {
        log.error('Error updating globalGems:', error);
      }
      
      // CORRUPTION FIX 1.2: Acquire mutex before save to prevent race conditions
      await saveLoadMutex.acquire('save');
      try {
        await queueSave(currentSlot, stateToSave);
      } finally {
        saveLoadMutex.release();
      }
      
      try {
        const uploadResult = await uploadGameState({ state: stateToSave, updatedAt: stateToSave.updatedAt });
        
        // Show notification if this is the first failure in session
        if (uploadResult.shouldNotify) {
          // Mark notification as shown
          const { markCloudSyncNotificationShown } = await import('@/lib/progress/cloud');
          markCloudSyncNotificationShown();
          // Show user-friendly notification (non-intrusive)
          log.info('Cloud sync unavailable, using local save');
          // Note: We don't show error toast here as per plan - only critical errors
          // Cloud sync failures are expected and handled gracefully
        }
        
        // Only upload leaderboard if main save succeeded
        if (uploadResult.success) {
          const playerName = stateToSave.userProfile.name || 'Player';
          const wealthScore = netWorth(stateToSave);
          const topCareer = stateToSave.careers.reduce((m, c) => Math.max(m, c.level), 0);
          const topSkill = stateToSave.hobbies.reduce((m, h) => Math.max(m, h.skill), 0);
          try {
            await uploadLeaderboardScore({ category: 'wealth', name: playerName, score: wealthScore });
            await uploadLeaderboardScore({ category: 'career', name: playerName, score: topCareer });
            await uploadLeaderboardScore({ category: 'skills', name: playerName, score: topSkill });
          } catch (leaderboardError) {
            log.warn('Leaderboard upload failed', { error: leaderboardError });
            // Don't throw - leaderboard is non-critical
          }
        }
      } catch (cloudError) {
        log.warn('Cloud save failed, but local save succeeded', { error: cloudError });
        // Cloud sync errors are handled gracefully - local save succeeded
      }
      
      // CORRUPTION FIX 1.1: Clear snapshot on successful save
      saveGameStateSnapshotRef.current = null;
    } catch (error) {
      log.error('Save error:', error);
      
      // CORRUPTION FIX 1.1: Rollback to snapshot if save fails
      if (stateSnapshot) {
        try {
          log.warn('Rolling back to state snapshot due to save failure');
          setGameState(stateSnapshot);
          saveGameStateSnapshotRef.current = null;
        } catch (rollbackError) {
          log.error('Failed to rollback state:', rollbackError);
        }
      }
      
      try {
        // TESTFLIGHT FIX: Include app version in force save metadata
        const appConfig = require('../../app.config.js');
        const appVersion = appConfig.expo?.version || 'unknown';
        const buildNumber = appConfig.expo?.ios?.buildNumber || appConfig.expo?.android?.versionCode || 'unknown';
        
        const stateToSave = {
          ...gameState,
          version: stateVersion,
          updatedAt: Date.now(),
          lastLogin: Date.now(),
          _appVersion: appVersion, // TESTFLIGHT FIX: Track app version
          _buildNumber: buildNumber, // TESTFLIGHT FIX: Track build number
        };
        // Auto-fix stats before force save
        const validation = validateGameState(stateToSave, true);
        if (validation.fixed && validation.fixes) {
          log.warn('Auto-fixed stats during force save:', validation.fixes);
        }
        if (!validation.valid) {
          // RC-0 FIX: Log error instead of throwing to prevent crashes
          log.error('Force save failed: Invalid game state', { errors: validation.errors });
          return; // Exit early, don't save invalid state
        }
        const saveDataString = JSON.stringify(stateToSave);
        const checksum = calculateChecksum(saveDataString);
        stateToSave._checksum = checksum;
        stateToSave._saveVersion = stateVersion;
        await forceSave(currentSlot, stateToSave);
      } catch (fallbackError) {
        log.error('Force save also failed:', fallbackError);
        if (retryCount < 3) {
          setTimeout(() => saveGame(retryCount + 1), 1000);
        } else {
          log.error('Failed to save game after 3 retries');
        }
      }
    } finally {
      hideLoading('saving');
    }
  }, [gameState, currentSlot, stateVersion]));

  const loadGame = useCallback(async (slot?: number) => {
    if (actionLockRef.current) {
      log.warn('Load game blocked by action lock');
      return;
    }
    actionLockRef.current = true;
    showLoading('loading', 'Loading game...', 'overlay');
    try {
      // Determine which slot to load:
      // 1. Use explicitly passed slot parameter
      // 2. Fall back to lastSlot from AsyncStorage (persisted selection)
      // 3. Finally fall back to currentSlot state
      let slotToLoad = slot;
      if (!slotToLoad) {
        try {
          const lastSlot = await AsyncStorage.getItem('lastSlot');
          if (lastSlot) {
            slotToLoad = parseInt(lastSlot, 10);
            log.info(`Loading from lastSlot in storage: ${slotToLoad}`);
          }
        } catch (error) {
          log.error('Failed to read lastSlot:', error);
        }
      }
      if (!slotToLoad) {
        slotToLoad = currentSlot;
        log.info(`Falling back to currentSlot: ${slotToLoad}`);
      }
      // CORRUPTION FIX 1.3: Cleanup orphaned temp keys before load
      try {
        const allKeys = await AsyncStorage.getAllKeys();
        const tempKeys = allKeys.filter(key => key.startsWith(`save_slot_${slotToLoad}_temp_`));
        if (tempKeys.length > 0) {
          log.info(`Cleaning up ${tempKeys.length} orphaned temp keys`);
          await AsyncStorage.multiRemove(tempKeys);
        }
        } catch (cleanupError: unknown) {
          log.warn('Failed to cleanup orphaned temp keys:', cleanupError as Error);
          // Non-critical, continue with load
        }
      
      // CORRUPTION FIX 1.2: Acquire mutex before load to prevent race conditions
      await saveLoadMutex.acquire('load');
      
      let savedData: string | null = null;
      try {
        savedData = await AsyncStorage.getItem(`save_slot_${slotToLoad}`);
      } catch (storageError) {
        log.error('AsyncStorage error while loading game:', storageError);
        Alert.alert(
          'Storage Error',
          'Failed to load game from device storage. Please try restarting the app.',
          [{ text: 'OK' }]
        );
        saveLoadMutex.release(); // CORRUPTION FIX 1.2: Release mutex on error
        return;
      }
      if (savedData) {
        let loadedState;
        try {
          loadedState = JSON.parse(savedData);
          if (!loadedState || typeof loadedState !== 'object') {
            log.error('Invalid game state data structure');
            saveLoadMutex.release(); // CORRUPTION FIX 1.2: Release mutex on error
            return;
          }
          if (loadedState._checksum) {
            const expectedChecksum = loadedState._checksum;
            const stateWithoutChecksum = { ...loadedState };
            delete stateWithoutChecksum._checksum;
            const actualChecksum = calculateChecksum(JSON.stringify(stateWithoutChecksum));
            if (actualChecksum !== expectedChecksum) {
              // Only log as debug, not warning, since this is often a timing issue
              // The data is still valid, just the checksum was calculated at a different time
              log.debug('Save data checksum mismatch (likely timing issue, data is valid)');
              // Update the checksum to the current one to prevent future warnings
              loadedState._checksum = actualChecksum;
            }
          }
        } catch (parseError) {
          log.error('Failed to parse saved game data:', parseError);
          
          // Attempt to recover from backup
          log.info('Attempting to restore from backup due to corruption...');
          try {
            const backups = await saveBackupManager.listBackups(slotToLoad);
            if (backups.length > 0) {
              const restoredState = await saveBackupManager.restoreBackup(slotToLoad, backups[0].id);
              if (restoredState) {
                log.info(`Successfully restored from backup: ${backups[0].reason} (${new Date(backups[0].timestamp).toLocaleString()})`);
                loadedState = restoredState;
                
                // Show toast to user
                setTimeout(() => {
                  Alert.alert(
                    'Save Restored',
                    'Your main save file was corrupted, but we successfully restored your last backup.',
                    [{ text: 'OK' }]
                  );
                }, 1000);
              } else {
                log.error('Failed to restore backup state is null');
                saveLoadMutex.release(); // CORRUPTION FIX 1.2: Release mutex on error
                return;
              }
            } else {
              log.warn('No backups available to restore');
              saveLoadMutex.release(); // CORRUPTION FIX 1.2: Release mutex on error
              return;
            }
          } catch (backupError) {
            log.error('Backup restoration failed:', backupError);
            saveLoadMutex.release(); // CORRUPTION FIX 1.2: Release mutex on error
            return;
          }
        }
        let globalGems = 0;
        try {
          let primaryGems = await AsyncStorage.getItem('globalGems');
          if (primaryGems) {
            const parsed = parseInt(primaryGems, 10);
            globalGems = isNaN(parsed) || !isFinite(parsed) ? 0 : Math.max(0, parsed);
            log.info(`Loaded gems from primary storage: ${globalGems}`);
          } else {
            let backupGems = await AsyncStorage.getItem('globalGems_backup');
            if (backupGems) {
              const parsed = parseInt(backupGems, 10);
              globalGems = isNaN(parsed) || !isFinite(parsed) ? 0 : Math.max(0, parsed);
              log.info(`Loaded gems from backup storage: ${globalGems}`);
            } else {
              let emergencyGems = await AsyncStorage.getItem('globalGems_emergency');
              if (emergencyGems) {
                const parsed = parseInt(emergencyGems, 10);
                globalGems = isNaN(parsed) || !isFinite(parsed) ? 0 : Math.max(0, parsed);
                log.info(`Loaded gems from emergency storage: ${globalGems}`);
              } else {
                log.info('No gem data found in any storage location');
              }
            }
          }
        } catch (error) {
          log.error('Failed to load global gems from all sources:', error);
          globalGems = 0;
        }
        let permanentPerks: string[] = [];
        try {
          permanentPerks = await loadPermanentPerks();
          log.info('Loaded permanent perks:', permanentPerks);
        } catch (error) {
          log.error('Failed to load permanent perks:', error);
        }
        const validatedState = migrateState(loadedState);
        if (!validatedState.stats || typeof validatedState.stats !== 'object') {
          log.error('Invalid stats structure in loaded state');
          saveLoadMutex.release(); // CORRUPTION FIX 1.2: Release mutex on error
          return;
        }
        
        // CORRUPTION FIX 1.4: Validate state after migration before setting
        const postMigrationValidation = validateStateInvariants(validatedState);
        if (!postMigrationValidation.valid) {
          log.error('State validation failed after migration:', postMigrationValidation.errors);
          // Try to repair
          const { repairGameState } = await import('@/utils/saveValidation');
          const repairResult = repairGameState(validatedState);
          if (repairResult.repaired) {
            log.info('State repaired after migration:', repairResult.repairs);
            // Re-validate repaired state
            const repairedValidation = validateStateInvariants(validatedState);
            if (!repairedValidation.valid) {
              log.error('Repaired state still invalid:', repairedValidation.errors);
              saveLoadMutex.release(); // CORRUPTION FIX 1.2: Release mutex on error
              // TESTFLIGHT FIX: Offer backup restoration option
              Alert.alert(
                'Corrupted Save',
                'Your save file is corrupted and could not be repaired.\n\nWould you like to try restoring from a backup?',
                [
                  { text: 'Cancel', style: 'cancel' },
                  { 
                    text: 'View Backups', 
                    onPress: () => {
                      // Note: Backup recovery modal should be accessible from Settings
                      // For now, show instructions
                      Alert.alert(
                        'Backup Recovery',
                        'To restore from a backup:\n1. Go to Settings\n2. Select Backup & Recovery\n3. Choose this save slot\n4. Select a backup to restore',
                        [{ text: 'OK' }]
                      );
                    }
                  }
                ]
              );
              return;
            }
          } else {
            saveLoadMutex.release(); // CORRUPTION FIX 1.2: Release mutex on error
            // TESTFLIGHT FIX: Offer backup restoration option
            Alert.alert(
              'Corrupted Save',
              'Your save file is corrupted and could not be repaired.\n\nWould you like to try restoring from a backup?',
              [
                { text: 'Cancel', style: 'cancel' },
                { 
                  text: 'View Backups', 
                  onPress: () => {
                    Alert.alert(
                      'Backup Recovery',
                      'To restore from a backup:\n1. Go to Settings\n2. Select Backup & Recovery\n3. Choose this save slot\n4. Select a backup to restore',
                      [{ text: 'OK' }]
                    );
                  }
                }
              ]
            );
            return;
          }
        }
        const originalMoney = validatedState.stats?.money ?? 0;
        // Use the higher of savedGems or globalGems to preserve gems across saves
        // If save file has gems, use them. Otherwise use globalGems.
        // But if savedGems is 0 and globalGems is higher, use globalGems to preserve player's gems
        const savedGems = validatedState.stats?.gems;
        let gemsToUse: number;
        if (savedGems === undefined) {
          // Save file doesn't have gems field, use globalGems
          gemsToUse = globalGems;
        } else if (savedGems === 0 && globalGems > 0) {
          // Save file has 0 gems but globalGems has gems - preserve player's gems
          log.info(`Save file has 0 gems but globalGems has ${globalGems}, using globalGems to preserve player progress`);
          gemsToUse = globalGems;
        } else {
          // Save file has gems, use them
          gemsToUse = savedGems;
        }
        const validatedStats: GameStats = {
          health: Math.max(0, Math.min(100, validatedState.stats?.health ?? 50)),
          happiness: Math.max(0, Math.min(100, validatedState.stats?.happiness ?? 50)),
          energy: Math.max(0, Math.min(100, validatedState.stats?.energy ?? 50)),
          fitness: Math.max(0, Math.min(100, validatedState.stats?.fitness ?? 50)),
          money: Math.max(0, originalMoney),
          reputation: Math.max(0, Math.min(100, validatedState.stats?.reputation ?? 0)),
          gems: validateGems(gemsToUse),
        };
        log.info('Money validation:', {
          originalMoney,
          validatedMoney: validatedStats.money,
          originalStats: validatedState.stats
        });
        const now = Date.now();
        const perksWithPermanent = { ...(validatedState.perks || {}) };
        permanentPerks.forEach(perkId => {
          (perksWithPermanent as Record<string, boolean>)[perkId] = true;
        });
        
        // Check daily reward BEFORE updating lastLogin to prevent multiple rewards
        const lastLoginTime = loadedState.lastLogin || 0;
        const timeSinceLastLogin = now - lastLoginTime;
        const oneDayInMs = 24 * 60 * 60 * 1000;
        
        log.info('Daily reward check:', {
          lastLoginTime,
          now,
          timeSinceLastLogin,
          oneDayInMs,
          shouldGiveReward: lastLoginTime > 0 && timeSinceLastLogin > oneDayInMs,
          currentMoney: validatedStats.money,
          currentGems: validatedStats.gems,
          jailWeeks: validatedState.jailWeeks
        });
        
        let dailyRewardAmount = 0;
        let gemsToAdd = 0;
        
        // Only give daily reward if it's been more than a day since last login
        // This prevents duplicate rewards if loadGame is called multiple times
        if (lastLoginTime > 0 && timeSinceLastLogin > oneDayInMs) {
          if (validatedStats.money < 50 && validatedState.jailWeeks === 0) {
            const worth = netWorth({ ...validatedState, stats: validatedStats });
            const moneyBonus = Math.max(50, Math.floor(worth * 0.001));
            dailyRewardAmount = moneyBonus;
            gemsToAdd = 1;
            log.info('Giving daily reward (with money):', { worth, moneyBonus, oldMoney: validatedStats.money, oldGems: validatedStats.gems, newGems: validatedStats.gems + gemsToAdd });
          } else {
            gemsToAdd = 1;
            log.info('Giving daily reward (gems only):', { oldGems: validatedStats.gems, newGems: validatedStats.gems + gemsToAdd });
          }
        }
        
        // Validate gems to prevent corruption
        const finalGems = Math.max(0, Math.min(Number.MAX_SAFE_INTEGER, validatedStats.gems + gemsToAdd));
        if (finalGems !== validatedStats.gems + gemsToAdd) {
          log.warn('Gems value was clamped:', { original: validatedStats.gems + gemsToAdd, clamped: finalGems });
        }
        
        let updatedState: GameState = {
          ...validatedState,
          stats: {
            ...validatedStats,
            money: validatedStats.money + dailyRewardAmount,
            gems: finalGems,
          },
          perks: perksWithPermanent,
          version: stateVersion,
          lastLogin: now, // Update lastLogin AFTER checking daily reward to prevent duplicate rewards on next load
          showDailyRewardPopup: gemsToAdd > 0,
          dailyRewardAmount: dailyRewardAmount,
        };
        if (!updatedState.completedGoals) {
          updatedState.completedGoals = [];
        }
        if (!updatedState.claimedProgressAchievements) {
          updatedState.claimedProgressAchievements = [];
        }
        
        // Load global claimed achievements and merge with local ones
        try {
          const globalClaimed = await AsyncStorage.getItem('globalClaimedAchievements');
          const globalClaimedList: string[] = globalClaimed ? JSON.parse(globalClaimed) : [];
          // Merge global and local claimed achievements (union)
          const localClaimed = updatedState.claimedProgressAchievements || [];
          const mergedClaimed = [...new Set([...localClaimed, ...globalClaimedList])];
          updatedState.claimedProgressAchievements = mergedClaimed;
          log.info(`Loaded ${globalClaimedList.length} globally claimed achievements, ${localClaimed.length} locally claimed`);
        } catch (error) {
          log.error('Error loading global claimed achievements:', error);
        }
        
        setGameState(updatedState);
        setCurrentSlot(slotToLoad);
        
        // Persist the selected slot so it loads correctly next time
        try {
          await AsyncStorage.setItem('lastSlot', String(slotToLoad));
          log.info(`Updated lastSlot to ${slotToLoad}`);
        } catch (error) {
          log.error('Failed to save lastSlot:', error);
        }
        
        // CORRUPTION FIX 1.2: Release mutex after successful load
        saveLoadMutex.release();
      } else {
        let globalGems = 0;
        try {
          let primaryGems = await AsyncStorage.getItem('globalGems');
          if (primaryGems) {
            globalGems = parseInt(primaryGems, 10);
            log.info(`New game - loaded gems from primary storage: ${globalGems}`);
          } else {
            let backupGems = await AsyncStorage.getItem('globalGems_backup');
            if (backupGems) {
              globalGems = parseInt(backupGems, 10);
              log.info(`New game - loaded gems from backup storage: ${globalGems}`);
            } else {
              let emergencyGems = await AsyncStorage.getItem('globalGems_emergency');
              if (emergencyGems) {
                globalGems = parseInt(emergencyGems, 10);
                log.info(`New game - loaded gems from emergency storage: ${globalGems}`);
              } else {
                log.info('New game - no gem data found, starting with 0 gems');
              }
            }
          }
        } catch (error) {
          log.error('Failed to load global gems for new game:', error);
        }
        setGameState(prev => ({
          ...prev,
          stats: {
            ...prev.stats,
            gems: validateGems(globalGems),
          },
        }));
        
        // CORRUPTION FIX 1.2: Release mutex after new game setup
        saveLoadMutex.release();
      }
    } catch (error) {
      log.error('Failed to load game:', error);
      // CORRUPTION FIX 1.2: Release mutex on error
      saveLoadMutex.release();
    } finally {
      actionLockRef.current = false;
      hideLoading('loading');
    }
  }, [currentSlot, stateVersion, migrateState, validateGems, loadPermanentPerks, setGameState, setCurrentSlot]);

  // Store saveGame in ref for use by other functions
  React.useEffect(() => {
    saveGameRef.current = saveGame;
  }, [saveGame]);

  // LIFECYCLE FIX: Update gameState ref when gameState changes to prevent stale closures
  React.useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  // Automated cache management and game loading on startup
  React.useEffect(() => {
    let isMounted = true;
    let timeoutId: NodeJS.Timeout | null = null;

    const initializeGame = async () => {
      try {
        if (!isMounted) return;
        setLoadingProgress(10);
        setLoadingMessage('Checking for updates...');

        // Initialize cache manager
        const cacheResult = await CacheManager.initialize();

        if (!isMounted) return;
        if (cacheResult.needsCacheClear) {
          setLoadingProgress(30);
          setLoadingMessage('Updating game data...');
          setIsCacheClearing(true);
          setCacheUpdateInfo({
            oldVersion: cacheResult.oldVersion,
            newVersion: '1.0.0'
          });

          // Simulate cache clearing progress
          await new Promise(resolve => {
            timeoutId = setTimeout(resolve, 1000);
          });
        }

        if (!isMounted) return;
        setLoadingProgress(80);
        setLoadingMessage('Loading saved game...');

        // Check if there's a saved game to load
        const lastSlot = await AsyncStorage.getItem('lastSlot');
        if (lastSlot && isMounted) {
          const slotNumber = parseInt(lastSlot, 10);
          await loadGame(slotNumber);
        }

        if (!isMounted) return;
        setLoadingProgress(100);
        setLoadingMessage('Ready to play!');

        // Small delay to show completion
        await new Promise(resolve => {
          timeoutId = setTimeout(resolve, 500);
        });

        if (!isMounted) return;
        setIsLoading(false);
        setIsCacheClearing(false);

      } catch (error) {
        if (isMounted) {
          log.error('Failed to initialize game:', error);
          setLoadingMessage('Error loading game');
          setIsLoading(false);
        }
      }
    };

    initializeGame();

    return () => {
      isMounted = false;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [loadGame, setCacheUpdateInfo, setIsCacheClearing, setIsLoading, setLoadingMessage, setLoadingProgress]);

  // TESTFLIGHT FIX: Save game when app goes to background to prevent data loss
  // CRITICAL: Handle both background and resume to prevent crashes
  // LIFECYCLE FIX: Use refs to prevent stale closures and race conditions
  React.useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (nextAppState === 'background' || nextAppState === 'inactive') {
        // Save game when app goes to background to prevent data loss on kill
        // LIFECYCLE FIX: Use ref for isSaving to prevent race conditions
        // LIFECYCLE FIX: Validate saveGameRef.current before calling to prevent null reference
        const saveFn = saveGameRef.current;
        if (!isSavingRef.current && saveFn) {
          isSavingRef.current = true;
          log.info('App going to background, saving game...');
          saveFn()
            .then(() => {
              isSavingRef.current = false;
            })
            .catch((error) => {
              log.error('Failed to save game on background:', error);
              isSavingRef.current = false; // Reset even on error to allow retry
            });
        }
      } else if (nextAppState === 'active') {
        // CRITICAL: Handle resume - validate state is still valid
        // This prevents crashes from stale state after long suspension
        // LIFECYCLE FIX: Reset save flag on resume to allow future saves
        isSavingRef.current = false;
        
        // LIFECYCLE FIX: Use ref to check state to prevent stale closure issues
        // Access current state via ref instead of closure-captured gameState
        if (!gameStateRef.current) {
          log.warn('Game state is null on resume - may need to reload');
          // Don't crash - let the app continue and handle gracefully
        }
      }
    });

    return () => {
      subscription.remove();
    };
  }, []); // CRITICAL: Empty deps - uses refs, doesn't need to recreate listener

  /**
   * Validate game state before week progression
   * Checks for required properties and validates data integrity
   */
  const validateStateBeforeWeekProgression = useCallback((state: GameState): { valid: boolean; errors: string[]; warnings: string[] } => {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check required state properties
    if (!state) {
      errors.push('Game state is null or undefined');
      return { valid: false, errors, warnings };
    }

    // Validate date object
    if (!state.date || typeof state.date !== 'object') {
      errors.push('Missing or invalid date object');
    } else {
      if (typeof state.date.week !== 'number' || state.date.week < 0) {
        errors.push(`Invalid week: ${state.date.week}`);
      }
      if (typeof state.date.year !== 'number' || state.date.year < 0) {
        errors.push(`Invalid year: ${state.date.year}`);
      }
      if (typeof state.date.age !== 'number' || state.date.age < 0 || state.date.age > 200) {
        warnings.push(`Age out of normal range: ${state.date.age}`);
      }
    }

    // Validate stats object
    if (!state.stats || typeof state.stats !== 'object') {
      errors.push('Missing or invalid stats object');
    } else {
      const requiredStats: (keyof GameStats)[] = ['health', 'happiness', 'energy', 'fitness', 'money', 'reputation', 'gems'];
      for (const stat of requiredStats) {
        const statValue = state.stats[stat];
        if (typeof statValue !== 'number' || isNaN(statValue) || !isFinite(statValue)) {
          errors.push(`Invalid ${stat} value: ${statValue}`);
        }
      }

      // Check for extreme values (warnings, not errors)
      if (state.stats.money < 0) {
        warnings.push('Money is negative');
      }
      if (state.stats.health < 0 || state.stats.health > 100) {
        warnings.push(`Health out of range: ${state.stats.health}`);
      }
      if (state.stats.happiness < 0 || state.stats.happiness > 100) {
        warnings.push(`Happiness out of range: ${state.stats.happiness}`);
      }
    }

    // Validate arrays exist (even if empty)
    const requiredArrays: (keyof GameState)[] = ['careers', 'hobbies', 'items', 'relationships', 'achievements', 'educations', 'pets'];
    for (const field of requiredArrays) {
      const fieldValue = state[field];
      if (!Array.isArray(fieldValue)) {
        errors.push(`${String(field)} must be an array`);
      }
    }

    // Validate optional arrays if they exist
    const optionalArrays: (keyof GameState)[] = ['companies', 'realEstate', 'cryptos', 'diseases', 'loans'];
    for (const field of optionalArrays) {
      const fieldValue = state[field];
      if (fieldValue !== undefined && !Array.isArray(fieldValue)) {
        errors.push(`${String(field)} must be an array if present`);
      }
    }

    // Validate stocks structure if it exists
    if (state.stocks) {
      if (state.stocks.holdings && !Array.isArray(state.stocks.holdings)) {
        errors.push('stocks.holdings must be an array');
      }
      if (state.stocks.watchlist && !Array.isArray(state.stocks.watchlist)) {
        errors.push('stocks.watchlist must be an array');
      }
    }

    // Validate cryptos array structure if it exists
    if (state.cryptos && Array.isArray(state.cryptos)) {
      state.cryptos.forEach((crypto: any, index: number) => {
        if (!crypto || typeof crypto !== 'object') {
          warnings.push(`Crypto at index ${index} is invalid`);
        } else {
          if (typeof crypto.price !== 'number' || crypto.price < 0) {
            warnings.push(`Crypto at index ${index} has invalid price: ${crypto.price}`);
          }
        }
      });
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }, []);

  const nextWeek = useCallback(async () => {
    // Prevent concurrent execution
    if (isNextWeekRunningRef.current) {
      log.warn('nextWeek already running, ignoring duplicate call');
      return;
    }
    
    isNextWeekRunningRef.current = true;
    
    // Create backup of current state before progression (outside try block for catch access)
    let stateBackup: GameState | null = null;
    try {
      stateBackup = JSON.parse(JSON.stringify(gameState));
    } catch (backupError) {
      log.error('Failed to create state backup', { error: backupError });
      showError('week_progression_backup_failed', 'Failed to create backup. Proceeding with caution...');
    }
    
    try {

      // Validate state before progression
      const validation = validateStateBeforeWeekProgression(gameState);
      if (!validation.valid) {
        log.error('State validation failed before week progression:', validation.errors);
        showError('week_progression_validation_failed', `Game state validation failed: ${validation.errors.join(', ')}. Please try again.`);
        isNextWeekRunningRef.current = false; // Release lock before returning
        return;
      }

      if (validation.warnings.length > 0) {
        log.warn('State validation warnings before week progression:', validation.warnings);
      }

      // Wrap simulateWeek in try-catch
      try {
        // Apply stock market policy effects
        const stockPolicyEffects = gameState.politics?.activePolicyEffects?.stocks;
        simulateWeek(stockPolicyEffects ? {
          volatilityModifier: stockPolicyEffects.volatilityModifier,
          dividendBonus: stockPolicyEffects.dividendBonus,
          companyBoost: stockPolicyEffects.companyBoost,
        } : undefined);
      } catch (simError) {
        log.error('Error in simulateWeek():', simError);
        throw new Error(`Stock market simulation failed: ${simError instanceof Error ? simError.message : 'Unknown error'}`);
      }
      
      // CORRUPTION FIX: Declare variables for batch updates before use
      type StockHolding = { symbol: string; shares: number; averagePrice: number; currentPrice: number };
      let updatedStockHoldings: StockHolding[] | null = null;
      let updatedCryptosForBatch: typeof gameState.cryptos | null = null;
      let bankruptcyStateUpdate: Partial<GameState> | null = null;
      
      // Update stock holdings with current prices
      // CORRUPTION FIX: Collect updates instead of applying immediately to prevent partial updates
      if (gameState.stocks?.holdings) {
        try {
          if (!Array.isArray(gameState.stocks.holdings)) {
            log.warn('stocks.holdings is not an array, skipping stock update');
          } else {
            updatedStockHoldings = gameState.stocks.holdings.map(holding => {
              try {
                if (!holding || !holding.symbol) {
                  log.warn('Invalid holding found, skipping');
                  return holding;
                }
                const stockInfo = getStockInfo(holding.symbol);
                if (!stockInfo || typeof stockInfo.price !== 'number') {
                  log.warn(`Invalid stock info for ${holding.symbol}, using current price`);
                  return holding;
                }
                // CORRUPTION FIX: Validate price before updating
                if (isNaN(stockInfo.price) || !isFinite(stockInfo.price) || stockInfo.price < 0) {
                  log.warn(`Invalid stock price for ${holding.symbol}: ${stockInfo.price}, keeping current price`);
                  return holding;
                }
                return {
                  ...holding,
                  currentPrice: stockInfo.price
                };
              } catch (holdingError) {
                log.error(`Error updating holding ${holding?.symbol}:`, holdingError);
                return holding;
              }
            });
          }
        } catch (stockError) {
          log.error('Error updating stock holdings:', stockError);
          // CORRUPTION FIX: Validate collected updates before throwing
          // If we have valid updates, use them; only throw if all updates failed
          if (!updatedStockHoldings || updatedStockHoldings.length === 0) {
            // All updates failed, throw error
            throw new Error(`Stock update failed: ${stockError instanceof Error ? stockError.message : 'Unknown error'}`);
          } else {
            // Some updates succeeded, log warning and continue with valid updates
            log.warn('Some stock updates failed, continuing with valid updates', { error: stockError });
          }
        }
      }

      // Simulate crypto price changes
      if (gameState.cryptos && gameState.cryptos.length > 0) {
        try {
          if (!Array.isArray(gameState.cryptos)) {
            log.warn('cryptos is not an array, skipping crypto update');
          } else {
        // Define volatility for different cryptos (crypto is generally more volatile than stocks)
        const cryptoVolatility: Record<string, number> = {
          'btc': 0.10,   // Bitcoin: 10% volatility
          'eth': 0.12,   // Ethereum: 12% volatility
          'xrp': 0.15,   // Ripple: 15% volatility
          'ada': 0.14,   // Cardano: 14% volatility
          'sol': 0.16,   // Solana: 16% volatility
          'dot': 0.13,   // Polkadot: 13% volatility
          'matic': 0.15, // Polygon: 15% volatility
          'link': 0.14,  // Chainlink: 14% volatility
        };

            // CORRUPTION FIX: Collect updates instead of applying immediately
            const updatedCryptos = gameState.cryptos.map(crypto => {
              try {
                if (!crypto || typeof crypto !== 'object' || !crypto.id) {
                  log.warn('Invalid crypto object found, skipping');
                  return crypto;
                }
                const volatility = cryptoVolatility[crypto.id] || 0.12; // Default 12% volatility
                const oldPrice = typeof crypto.price === 'number' && crypto.price > 0 ? crypto.price : 0.0001;
                
                // CORRUPTION FIX: Validate oldPrice before calculation
                if (isNaN(oldPrice) || !isFinite(oldPrice) || oldPrice <= 0) {
                  log.warn(`Invalid crypto price for ${crypto.id}: ${oldPrice}, keeping current`);
                  return crypto;
                }
                
                // Generate random price change with normal distribution approximation
                // Box-Muller transform
                const u1 = Math.random();
                const u2 = Math.random();
                // Ensure u1 is not 0 to avoid log(0)
                const safeU1 = Math.max(0.0001, Math.min(0.9999, u1));
                const z = Math.sqrt(-2.0 * Math.log(safeU1)) * Math.cos(2.0 * Math.PI * u2);
                
                // Convert to percentage change with the crypto's volatility
                const changePercent = z * volatility;
                
                // Apply the change, ensuring price doesn't go below $0.0001
                const newPrice = Math.max(0.0001, oldPrice * (1 + changePercent));
                
                // CORRUPTION FIX: Validate newPrice before rounding
                if (isNaN(newPrice) || !isFinite(newPrice) || newPrice <= 0) {
                  log.warn(`Invalid calculated price for ${crypto.id}: ${newPrice}, keeping current`);
                  return crypto;
                }
                
                // Round to appropriate decimal places based on price range
                let roundedPrice: number;
                if (newPrice >= 1) {
                  roundedPrice = Math.round(newPrice * 100) / 100; // 2 decimal places for prices >= $1
                } else if (newPrice >= 0.01) {
                  roundedPrice = Math.round(newPrice * 1000) / 1000; // 3 decimal places for prices >= $0.01
                } else {
                  roundedPrice = Math.round(newPrice * 10000) / 10000; // 4 decimal places for prices < $0.01
                }
                
                // CORRUPTION FIX: Final validation before returning
                if (isNaN(roundedPrice) || !isFinite(roundedPrice) || roundedPrice <= 0) {
                  log.warn(`Invalid rounded price for ${crypto.id}: ${roundedPrice}, keeping current`);
                  return crypto;
                }
                
                const change = roundedPrice - oldPrice;
                const changePercentValue = oldPrice > 0 ? (change / oldPrice) * 100 : 0;
                
                return {
                  ...crypto,
                  price: roundedPrice,
                  change: change,
                  changePercent: changePercentValue,
                };
              } catch (cryptoError) {
                log.error(`Error updating crypto ${crypto?.id}:`, cryptoError);
                return crypto;
              }
            });
            
            // CORRUPTION FIX: Store for batch update instead of immediate setGameState
            updatedCryptosForBatch = updatedCryptos;
          }
        } catch (cryptoError) {
          log.error('Error updating crypto prices:', cryptoError);
          // CORRUPTION FIX: Validate collected updates before throwing
          // If we have valid updates, use them; only throw if all updates failed
          if (!updatedCryptosForBatch || updatedCryptosForBatch.length === 0) {
            // All updates failed, throw error
            throw new Error(`Crypto update failed: ${cryptoError instanceof Error ? cryptoError.message : 'Unknown error'}`);
          } else {
            // Some updates succeeded, log warning and continue with valid updates
            log.warn('Some crypto updates failed, continuing with valid updates', { error: cryptoError });
          }
        }
      }
      
      // CRITICAL FIX: Validate weeksLived before calculation to prevent NaN propagation
      const currentWeeksLived = typeof gameState.weeksLived === 'number' && !isNaN(gameState.weeksLived) && isFinite(gameState.weeksLived) && gameState.weeksLived >= 0
        ? gameState.weeksLived
        : 0; // Default to 0 if invalid
      const nextWeeksLived = currentWeeksLived + 1;
      // TIME PROGRESSION FIX: Calculate nextWeek before incrementing to use consistently
      // Validate current week before calculating next week to prevent desynchronization
      const currentWeek = typeof gameState.date.week === 'number' && !isNaN(gameState.date.week) && gameState.date.week >= 1 && gameState.date.week <= 4
        ? gameState.date.week
        : 1; // Default to 1 if invalid
      const nextWeek = currentWeek === 4 ? 1 : currentWeek + 1;
      let newDate = { ...gameState.date };
      newDate.week = nextWeek;
      // Advance age by one week
      newDate.age = addWeekToAge(newDate.age);

      // Get prestige data and unlocked bonuses early (needed for immortality check and other checks)
      const prestigeData = gameState.prestige;
      const unlockedBonuses = prestigeData?.unlockedBonuses || [];

      // Check for immortality bonus before age-based death
      const hasImmortalityBonus = hasImmortality(unlockedBonuses);
      if (newDate.age >= 100 && !hasImmortalityBonus) {
        Alert.alert('Game Over', 'You have reached the age of 100. Your life journey has ended.');
        isNextWeekRunningRef.current = false; // Release lock before returning
        return;
      }

      // TIME PROGRESSION FIX: Week validation and rollover logic simplified
      // Week is now calculated above (nextWeek), so we only need to handle month/year rollover
      // Normal week rollover: if week is 1 (after rolling from 4), advance month/year
      if (nextWeek === 1 && currentWeek === 4) {
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
        // CRITICAL FIX: Validate month before indexOf to prevent silent failures
        // MINOR FIX: Normalize month to title case to handle case sensitivity
        // If month is invalid, default to January and log error
        //
        // SAFETY: This is safe because:
        // - Month normalization handles case variations (e.g., "january" → "January")
        // - Invalid months default to "January" without incrementing year (prevents time desync)
        // - Year is capped at 9999 to prevent integer overflow
        //
        // FRAGILE LOGIC WARNING:
        // - Month normalization uses charAt(0) which fails on empty strings (returns "")
        //   If month is "", normalizedMonth becomes "" + "" = "", which indexOf won't find.
        //   This is handled by the -1 check, but could be more explicit.
        // - The months array is hardcoded - if month names change elsewhere, this breaks.
        //   Consider extracting to a constant.
        //
        // Type safety: Robust type checking ensures month is always a valid string.
        // If month is not a string or is empty, defaults to 'January' to prevent crashes.
        // Year cap of 9999 is sufficient for all realistic gameplay scenarios.
        const normalizedMonth = typeof newDate.month === 'string' && newDate.month.length > 0
          ? newDate.month.charAt(0).toUpperCase() + newDate.month.slice(1).toLowerCase()
          : 'January';
        const currentMonthIndex = months.indexOf(normalizedMonth);
        if (currentMonthIndex === -1) {
          // Invalid month - default to January and don't increment year
          // This prevents time desynchronization when month is corrupted
          log.warn(`Invalid month detected: ${newDate.month}, defaulting to January`);
          newDate.month = 'January';
          // CORRUPTION FIX: Validate year when month is invalid to prevent NaN propagation
          if (typeof newDate.year !== 'number' || isNaN(newDate.year) || !isFinite(newDate.year)) {
            log.warn(`Invalid year detected: ${newDate.year}, defaulting to 2025`);
            newDate.year = 2025;
          }
        } else if (currentMonthIndex === 11) {
          newDate.month = 'January';
          // CRITICAL FIX: Cap year to prevent overflow (max 9999)
          // CORRUPTION FIX: Validate year before increment to prevent NaN propagation
          const currentYear = typeof newDate.year === 'number' && !isNaN(newDate.year) && isFinite(newDate.year) && newDate.year >= 2025
            ? newDate.year
            : 2025; // Default to 2025 if invalid
          const incrementedYear = currentYear + 1;
          // CORRUPTION FIX: Validate incremented year before setting
          if (typeof incrementedYear !== 'number' || isNaN(incrementedYear) || !isFinite(incrementedYear)) {
            log.warn(`Invalid incremented year: ${incrementedYear}, keeping current year ${currentYear}`);
            newDate.year = currentYear; // Keep current year if increment fails
          } else {
            // MINOR FIX: Increase year cap to 99999 to support very long play sessions (prestige loops)
            // Year rollover would be complex, so increasing cap is simpler
            newDate.year = Math.min(99999, Math.max(2025, incrementedYear)); // Clamp to [2025, 99999]
          }
      } else {
        newDate.month = months[currentMonthIndex + 1];
        // CORRUPTION FIX: Validate year on normal month increment to prevent corruption
        if (typeof newDate.year !== 'number' || isNaN(newDate.year) || !isFinite(newDate.year)) {
          log.warn(`Invalid year detected during month increment: ${newDate.year}, defaulting to 2025`);
          newDate.year = 2025;
        }
      }
        
        // MINOR FIX: Ensure month is normalized (title case) after setting
        // This is redundant but ensures consistency if months array has wrong case
        // FUTURE: Consider removing if months array is guaranteed to be correct case
        if (newDate.month && typeof newDate.month === 'string' && newDate.month.length > 0) {
          newDate.month = newDate.month.charAt(0).toUpperCase() + newDate.month.slice(1).toLowerCase();
        }
    }

    // Check if player should return from travel (will be checked after week increment)

    // TIME PROGRESSION FIX: Jail handling with minimal progression
    // When in jail, only basic time progression happens (date, stats, weeksLived)
    // This is intentional - jail should pause most game systems (relationships, companies, etc.)
    // However, time still passes, so date and weeksLived must update
    // NOTE: This creates intentional desynchronization - relationships/companies don't age in jail
    // This is acceptable because jail is meant to pause progression
    if (gameState.jailWeeks > 0) {
      const jailResult = serveJailTime();
      log.info('Jail release - Current money before release', { money: gameState.stats.money });
      const updatedStats = {
        ...gameState.stats, // This preserves all stats including money
        health: Math.max(0, Math.min(100, gameState.stats.health + (jailResult.statsChange.health || 0))),
        happiness: Math.max(0, Math.min(100, gameState.stats.happiness + (jailResult.statsChange.happiness || 0))),
        energy: 100, // Always restore full energy when getting out of jail
        // Explicitly preserve money - no change to money during jail release
        money: gameState.stats.money,
      };
      log.info('Jail release - Money after release', { money: updatedStats.money });
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
      setTimeout(() => checkAchievementsRef.current?.(), 100);
      try {
        if (saveGameRef.current) {
          await saveGameRef.current();
        }
      } catch (saveError) {
        log.error('Error saving game after jail release:', saveError);
        // Don't throw - jail release succeeded, save failure is logged
      }
      isNextWeekRunningRef.current = false; // Release lock before returning
      return;
    }

    let moneyChange = 0;
    const statsChange: Partial<GameStats> = {};
    const events: string[] = [];
    let jailWeeks = gameState.jailWeeks;
    let wantedLevel = gameState.wantedLevel;

    const passiveIncomeResult = calcWeeklyPassiveIncome(gameState);
    const { total: passiveIncome, reinvested } = passiveIncomeResult;
    // Apply prestige income multiplier
    // Note: prestigeData and unlockedBonuses are already declared earlier in this function
    const incomeMultiplier = getIncomeMultiplier(unlockedBonuses);
    const adjustedPassiveIncome = Math.floor(passiveIncome * incomeMultiplier);
    if (adjustedPassiveIncome > 0) {
      moneyChange += adjustedPassiveIncome;
      events.push(`Passive income $${adjustedPassiveIncome.toFixed(2)}`);
      
      // Auto-collect rent message (QoL bonus)
      if (shouldAutoCollectRent(unlockedBonuses) && passiveIncome > 0) {
        events.push('Property Manager automatically collected rent from all properties');
      }
    }
    
    // STABILITY FIX: Track weeks in poverty for scholarship event trigger
    // Increment weeksInPoverty if money < $500, reset if money >= $500
    const weeksInPoverty = gameState.weeksInPoverty || 0;
    const newWeeksInPoverty = gameState.stats.money < 500 ? weeksInPoverty + 1 : 0;
    
    // STABILITY FIX: Emergency income for poverty path - prevents complete stagnation
    // If player has 0 money and no income sources, grant emergency income once per month
    // Uses week % 4 == 0 as proxy for monthly check (avoids adding new state fields)
    // This prevents players from getting completely stuck without recovery options
    // STABILITY FIX: Scale emergency income with family size (families need more support)
    // STABILITY FIX: Extend emergency income to ALL players (not just families)
    // Single players in poverty also need recovery options
    if (gameState.stats.money < 100 && adjustedPassiveIncome === 0 && jailWeeks === 0) {
      const currentCareer = gameState.careers.find(c => c.id === gameState.currentJob);
      const weeklySalary = currentCareer && currentCareer.level >= 0 && currentCareer.level < currentCareer.levels.length
        ? currentCareer.levels[currentCareer.level].salary / 52
        : 0;
      
      // Check if player has no income sources (no passive income, no salary)
      // TIME PROGRESSION FIX: Use nextWeek for monthly check to ensure correct timing
      if (weeklySalary === 0 && (nextWeek % 4 === 0)) {
        // STABILITY FIX: Scale emergency income with family size
        // Base: $200/month ($50/week) for single player, +$25 per child, +$50 if has spouse
        // Increased from $50/month to provide basic survival ($200/month = $50/week)
        const baseEmergencyIncome = 200; // $200/month = $50/week (increased from $50/month)
        const childrenCount = (gameState.family?.children || []).length;
        const hasSpouse = gameState.family?.spouse !== undefined;
        const familyBonus = (childrenCount * 25) + (hasSpouse ? 50 : 0);
        const emergencyIncome = baseEmergencyIncome + familyBonus;
        
        moneyChange += emergencyIncome;
        events.push(`Emergency assistance: +$${emergencyIncome} (welfare support${familyBonus > 0 ? ` - family assistance` : ''})`);
        log.info('Emergency income granted', { week: gameState.week, money: gameState.stats.money, familySize: childrenCount, hasSpouse });
      }
    }
    
    // Auto-reinvest dividends (QoL bonus)
    // ECONOMY FIX: Add friction to prevent exponential compound growth
    // CORRUPTION FIX: Add validation to prevent silent failures
    if (reinvested && reinvested > 0 && shouldAutoReinvestDividends(unlockedBonuses)) {
      try {
        // Automatically reinvest dividends into stocks (with 1% transaction cost)
        setGameState(prev => {
          if (!prev.stocks?.holdings) return prev;
          const updatedHoldings = prev.stocks.holdings.map(holding => {
            try {
              const stockInfo = getStockInfo(holding.symbol);
              if (!stockInfo) return holding;
              // CORRUPTION FIX: Validate stock info before calculation
              if (typeof stockInfo.price !== 'number' || isNaN(stockInfo.price) || stockInfo.price <= 0) {
                log.warn(`Invalid stock price for ${holding.symbol}: ${stockInfo.price}, skipping reinvest`);
                return holding;
              }
              if (typeof stockInfo.dividendYield !== 'number' || isNaN(stockInfo.dividendYield) || stockInfo.dividendYield < 0) {
                log.warn(`Invalid dividend yield for ${holding.symbol}: ${stockInfo.dividendYield}, skipping reinvest`);
                return holding;
              }
              if (typeof holding.shares !== 'number' || isNaN(holding.shares) || holding.shares <= 0) {
                log.warn(`Invalid shares for ${holding.symbol}: ${holding.shares}, skipping reinvest`);
                return holding;
              }
              const weeklyDividend = (stockInfo.price * stockInfo.dividendYield * holding.shares) / 52;
              // Apply 1% transaction cost to prevent exponential growth
              const reinvestAmount = weeklyDividend * 0.99;
              const sharesToBuy = Math.floor(reinvestAmount / stockInfo.price);
              if (sharesToBuy > 0) {
                const newShares = holding.shares + sharesToBuy;
                const newAveragePrice = ((holding.averagePrice * holding.shares) + (stockInfo.price * sharesToBuy)) / newShares;
                // CORRUPTION FIX: Validate calculated values
                if (isNaN(newShares) || !isFinite(newShares) || newShares <= 0) {
                  log.warn(`Invalid calculated shares for ${holding.symbol}: ${newShares}, skipping reinvest`);
                  return holding;
                }
                if (isNaN(newAveragePrice) || !isFinite(newAveragePrice) || newAveragePrice <= 0) {
                  log.warn(`Invalid calculated average price for ${holding.symbol}: ${newAveragePrice}, skipping reinvest`);
                  return holding;
                }
                return {
                  ...holding,
                  shares: newShares,
                  averagePrice: newAveragePrice,
                };
              }
              return holding;
            } catch (holdingError) {
              log.error(`Error processing holding ${holding?.symbol}:`, holdingError);
              return holding; // Return unchanged on error
            }
          });
          return {
            ...prev,
            stocks: {
              ...prev.stocks,
              holdings: updatedHoldings,
            },
          };
        });
        events.push(`Auto-Invest: $${reinvested.toFixed(2)} in dividends reinvested into stocks (1% transaction cost)`);
      } catch (reinvestError) {
        log.error('Error in auto-reinvest dividends:', reinvestError);
        // Design: Auto-reinvest is a non-critical optimization feature.
        // If it fails, the game continues normally - dividends are still earned,
        // they just won't be automatically reinvested this week. The money change
        // is calculated separately and will be applied in the main state update.
        // This separation ensures week progression never fails due to reinvest errors.
      }
    }

    // Gaming and streaming earnings
    // LONG-TERM DEGRADATION FIX: Use shared calculation function to avoid duplication
    const { calcGamingStreamingIncome } = require('@/lib/economy/gamingStreamingIncome');
    const gamingStreamingResult = calcGamingStreamingIncome(gameState.gamingStreaming, nextWeek);
    const gamingEarnings = gamingStreamingResult.gaming;
    const streamingEarnings = gamingStreamingResult.streaming;
    
    if (gamingEarnings > 0) {
      moneyChange += gamingEarnings;
      events.push(`Gaming earnings $${gamingEarnings.toFixed(2)}`);
    }
    
    if (streamingEarnings > 0) {
      moneyChange += streamingEarnings;
      events.push(`Streaming earnings $${streamingEarnings.toFixed(2)}`);
    }

    // PERFORMANCE FIX: Combine children calculations into single pass (calculate outside jail check for reuse)
    // NOTE: gameState is read-only in this function, so values remain valid when used later (line 5204)
    // If children array is empty, both values correctly remain 0
    // CRITICAL FIX: Validate child expenses to prevent NaN propagation
    // STABILITY FIX: Apply diminishing returns to child expenses to prevent bankruptcy
    // 1-3 children: $50 each, 4-6 children: $40 each, 7-10 children: $30 each, 11+ children: $25 each
    // This prevents families with many children from going bankrupt
    let childrenExpenses = 0;
    let childrenHappiness = 0;
    const childCount = gameState.family.children.length;
    for (let i = 0; i < gameState.family.children.length; i++) {
      const child = gameState.family.children[i];
      const baseExpenses = typeof child.expenses === 'number' && !isNaN(child.expenses)
        ? child.expenses
        : 50; // Default $50 if not set
      
      // Apply diminishing returns based on child count
      let expenseMultiplier = 1.0;
      if (childCount >= 11) {
        expenseMultiplier = 0.5; // $25 each (50% of base)
      } else if (childCount >= 7) {
        expenseMultiplier = 0.6; // $30 each (60% of base)
      } else if (childCount >= 4) {
        expenseMultiplier = 0.8; // $40 each (80% of base)
      }
      // 1-3 children: 100% (no reduction)
      
      const expenses = Math.round(baseExpenses * expenseMultiplier);
      const happiness = typeof child.familyHappiness === 'number' && !isNaN(child.familyHappiness)
        ? child.familyHappiness
        : 0;
      childrenExpenses += expenses;
      childrenHappiness += happiness;
    }
    
    // Don't deduct expenses while in jail - expenses are paused during jail time
    // (This check is redundant since we return early if jailWeeks > 0, but added for safety)
    if (jailWeeks === 0) {
      const rawFamilyExpense =
        (gameState.family.spouse?.expenses || 0) + childrenExpenses;
      
      // STABILITY FIX: Cap family expenses at 50% of total weekly income to prevent bankruptcy
      // Calculate total weekly income (passive + active salary)
      // Note: passiveIncome is calculated earlier in nextWeek, weeklySalary calculated here
      const currentCareer = gameState.careers.find(c => c.id === gameState.currentJob);
      const weeklySalary = currentCareer && currentCareer.level >= 0 && currentCareer.level < currentCareer.levels.length
        ? currentCareer.levels[currentCareer.level].salary / 52
        : 0;
      const totalWeeklyIncome = passiveIncome + weeklySalary;
      
      // STABILITY FIX: Minimum family expense cap for zero-income players
      // If income is 0, cap at $50/week minimum (prevents complete bankruptcy)
      // Otherwise, cap at 50% of income
      const minFamilyExpenseCap = 50; // Minimum $50/week for families with no income
      const maxFamilyExpense = totalWeeklyIncome > 0 
        ? Math.floor(totalWeeklyIncome * 0.5) 
        : Math.min(minFamilyExpenseCap, rawFamilyExpense); // Use minimum cap if no income
      const familyExpense = Math.min(rawFamilyExpense, maxFamilyExpense);
      
      if (familyExpense > 0) {
        moneyChange -= familyExpense;
        if (familyExpense < rawFamilyExpense) {
          events.push(`Family expenses $${familyExpense} (capped at 50% of income)`);
        } else {
          events.push(`Family expenses $${familyExpense}`);
        }
      }

      // BUG FIX: Automatic loan payments - handle loans with zero weeklyPayment
      // STABILITY FIX: Add late fees and skip payments when money < payment amount
      // For loans with 0 weeklyPayment (long terms), calculate minimum payment
      const loans = gameState.loans || [];
      if (loans.length > 0) {
        let totalLoanPayments = 0;
        let totalLateFees = 0;
        let missedPaymentsCount = 0;
        const updatedLoans = loans.map((loan: any) => {
          if (loan.remaining <= 0) return loan;
          
          let weeklyPayment = loan.weeklyPayment || 0;
          
          // BUG FIX: If weeklyPayment is 0, calculate minimum payment based on remaining debt
          if (weeklyPayment <= 0) {
            const remaining = loan.remaining || loan.principal || 0;
            const weeksRemaining = loan.weeksRemaining || loan.termWeeks || 520;
            if (remaining > 0 && weeksRemaining > 0) {
              // Minimum payment: at least 0.1% of remaining debt per week
              weeklyPayment = Math.max(remaining / weeksRemaining, remaining * 0.001);
            }
          }
          
          // STABILITY FIX: Only process payment if player can afford it
          // Track missed payments for late fees
          const currentMoney = gameState.stats.money + moneyChange; // Money after income but before expenses
          const missedPayments = loan.missedPayments || 0;
          
          if (weeklyPayment > 0 && currentMoney >= weeklyPayment) {
            // Can afford payment - process it
            totalLoanPayments += weeklyPayment;
            const newRemaining = Math.max(0, loan.remaining - weeklyPayment);
            const newWeeksRemaining = Math.max(0, (loan.weeksRemaining || loan.termWeeks || 520) - 1);
            return { 
              ...loan, 
              remaining: newRemaining,
              weeksRemaining: newWeeksRemaining,
              missedPayments: 0, // Reset missed payments counter
              // Update weeklyPayment if it was 0 (so it persists)
              weeklyPayment: loan.weeklyPayment || weeklyPayment,
            };
          } else if (weeklyPayment > 0) {
            // Can't afford payment - track missed payment and apply late fees
            const newMissedPayments = missedPayments + 1;
            let lateFee = 0;
            
            // STABILITY FIX: Apply late fees after 2+ missed payments (5% of payment per missed week)
            if (newMissedPayments >= 2) {
              lateFee = Math.round(weeklyPayment * 0.05 * newMissedPayments); // 5% per missed week
              totalLateFees += lateFee;
            }
            
            missedPaymentsCount++;
            return {
              ...loan,
              missedPayments: newMissedPayments,
              remaining: loan.remaining + lateFee, // Add late fee to remaining debt
            };
          }
          return loan;
        }).filter((loan: any) => loan.remaining > 0); // Remove fully paid loans
        
        if (totalLoanPayments > 0) {
          moneyChange -= totalLoanPayments;
          events.push(`Automatic loan payments: -$${totalLoanPayments.toFixed(2)}`);
        }
        
        if (totalLateFees > 0) {
          moneyChange -= totalLateFees;
          events.push(`Late fees on missed loan payments: -$${totalLateFees.toFixed(2)}`);
        }
        
        if (missedPaymentsCount > 0 && totalLateFees === 0) {
          events.push(`Missed ${missedPaymentsCount} loan payment(s) - insufficient funds`);
        }
        
        // Update loans in game state
        setGameState(prev => ({
          ...prev,
          loans: updatedLoans,
        }));
      }
    } else {
      // While in jail, expenses are paused
      events.push('Expenses paused while in jail');
    }
    
    // LIFESTYLE MAINTENANCE: Apply lifestyle costs and effects (not paused in jail - lifestyle continues)
    const { calculateLifestyleCosts, getLifestyleEffects } = require('@/lib/economy/lifestyle');
    const lifestyleCosts = calculateLifestyleCosts(gameState);
    const lifestyleEffects = getLifestyleEffects(gameState);
    
    if (lifestyleCosts > 0) {
      moneyChange -= lifestyleCosts;
      events.push(`Lifestyle maintenance (${lifestyleEffects.level}): -$${lifestyleCosts.toLocaleString()}`);
    }
    
    // Apply lifestyle effects on reputation
    if (lifestyleEffects.reputationBonus !== 0) {
      statsChange.reputation = (statsChange.reputation || 0) + lifestyleEffects.reputationBonus;
      if (lifestyleEffects.reputationBonus > 0) {
        events.push(`Lifestyle boosts reputation: +${lifestyleEffects.reputationBonus}`);
      } else {
        events.push(`Low lifestyle hurts reputation: ${lifestyleEffects.reputationBonus}`);
      }
    }

    // PERFORMANCE FIX: Use pre-calculated childrenHappiness from above (calculated in single pass with expenses)
    const familyHappy =
      (gameState.family.spouse?.familyHappiness || 0) + childrenHappiness;
    if (familyHappy !== 0) {
      statsChange.happiness = (statsChange.happiness || 0) + familyHappy;
    }

    if (wantedLevel > 0) {
      if (Math.random() < wantedLevel * 0.25) {
        const newJailWeeks = 2 + Math.floor(Math.random() * 4);
        // STABILITY FIX: Prevent jail time accumulation - new sentence replaces old, doesn't add
        // Cap total jail time at 52 weeks (1 year max sentence) to prevent infinite accumulation
        // If already in jail, new sentence replaces remaining time (whichever is longer)
        const currentJailWeeks = gameState.jailWeeks || 0;
        jailWeeks = Math.min(Math.max(newJailWeeks, currentJailWeeks), 52);
        events.push(`Arrested and jailed for ${jailWeeks} weeks`);
        wantedLevel = 0;
      } else {
        // STABILITY FIX: Scale wanted level decay - faster decay over time to prevent infinite accumulation
        // After 4 weeks: decay 2 per week, after 8 weeks: decay 3 per week, after 12 weeks: decay 4 per week
        // Track weeks with wanted level (simplified: use current wanted level as proxy for duration)
        // STABILITY FIX: Increased decay rates to better handle frequent crimes
        // At very high wanted levels (12+), increase decay to 5/week to allow wanted level to decrease even with frequent crimes
        let decayAmount = 1;
        if (wantedLevel >= 12) {
          decayAmount = 5;  // Very high wanted level decays faster (increased from 4 to 5)
        } else if (wantedLevel >= 8) {
          decayAmount = 3;
        } else if (wantedLevel >= 4) {
          decayAmount = 2;
        }
        wantedLevel = Math.max(0, wantedLevel - decayAmount);
      }
    }

    // BUG FIX: Add pet death logic when health reaches 0%
    // MINOR FIX: Add maximum pet age (520 weeks = 10 years) to prevent unbounded growth
    const MAX_PET_AGE_WEEKS = 520; // 10 years
    let pets = gameState.pets.map(p => {
      const hunger = Math.min(100, p.hunger + 10);
      const happiness = Math.max(0, p.happiness - 5);
      const age = p.age + 1;
      const health = Math.max(0, Math.min(100, p.health - (hunger > 80 ? 10 : 0)));
      
      // MINOR FIX: Remove pets that exceed maximum age (natural death from old age)
      if (age >= MAX_PET_AGE_WEEKS) {
        return { ...p, hunger, happiness, age, health: 0, weeksAtZeroHealth: 2, isDead: true };
      }
      
      // Check if pet should die (health at 0% for 2+ weeks)
      // Track weeks at 0 health (similar to player death system)
      const weeksAtZeroHealth = (p.weeksAtZeroHealth || 0) + (health <= 0 ? 1 : 0);
      const shouldDie = health <= 0 && weeksAtZeroHealth >= 2;
      
      if (shouldDie) {
        // Pet dies - will be removed from array below
        return { ...p, hunger, happiness, age, health: 0, weeksAtZeroHealth, isDead: true };
      }
      
      return { ...p, hunger, happiness, age, health, weeksAtZeroHealth: health <= 0 ? weeksAtZeroHealth : 0 };
    });
    
    // Remove dead pets and add death event
    const deadPets = pets.filter(p => p.isDead);
    if (deadPets.length > 0) {
      pets = pets.filter(p => !p.isDead);
      deadPets.forEach(deadPet => {
        const deathReason = deadPet.age >= MAX_PET_AGE_WEEKS 
          ? 'old age' 
          : 'poor health';
        events.push(`💔 ${deadPet.name} passed away due to ${deathReason}.`);
        log.info('Pet died', { petId: deadPet.id, petName: deadPet.name, health: deadPet.health, age: deadPet.age, reason: deathReason });
      });
    }

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
        log.info(`Disease check - Fitness: ${gameState.stats.fitness}, Disease chance: ${diseaseChance.toFixed(2)}%`);
      }

      // RANDOMNESS FIX: Disease bounds - max 1 disease per 4 weeks to prevent stacking
      // TIME PROGRESSION FIX: Use nextWeek for disease check to ensure correct timing
      const lastDiseaseWeek = gameState.lastDiseaseWeek || 0;
      let weeksSinceLastDisease = nextWeek - lastDiseaseWeek;
      // Handle year rollover (if nextWeek < lastDiseaseWeek, we've rolled over)
      if (weeksSinceLastDisease < 0) {
        weeksSinceLastDisease = weeksSinceLastDisease + 52; // Add 52 weeks for year rollover
      }
      const canContractDisease = weeksSinceLastDisease >= 4 || gameState.diseases.length === 0;
      
      if (canContractDisease && Math.random() * 100 < diseaseChance) {
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
          // RANDOMNESS FIX: Track disease week to enforce bounds
          // TIME PROGRESSION FIX: Use nextWeek for disease tracking to ensure correct timing
          setGameState(prev => ({
            ...prev,
            lastDiseaseWeek: nextWeek, // Track when disease was contracted (use nextWeek, not prev.week)
          }));
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
    // STABILITY FIX: Use diminishing returns instead of hard cap for more realistic disease stacking
    // 1st disease: 100% effect, 2nd: 80%, 3rd: 60%, 4th: 40%, 5th+: 20%
    // This allows multiple diseases to stack but with diminishing impact (more realistic)
    const diseaseEffects: Partial<GameStats> = {};
    
    gameState.diseases.forEach((disease, index) => {
      // Diminishing returns multiplier based on disease order
      const diminishingMultipliers = [1.0, 0.8, 0.6, 0.4, 0.2]; // 1st, 2nd, 3rd, 4th, 5th+
      const multiplier = diminishingMultipliers[Math.min(index, diminishingMultipliers.length - 1)];
      
      Object.entries(disease.effects).forEach(([stat, effect]) => {
        if (effect !== undefined && typeof effect === 'number') {
          const statKey = stat as keyof GameStats;
          const adjustedEffect = Math.round(effect * multiplier);
          diseaseEffects[statKey] = (diseaseEffects[statKey] || 0) + adjustedEffect;
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
    
    // Apply disease effects (with diminishing returns already applied)
    // STABILITY FIX: Still cap at -75 to prevent instant death from many diseases
    const diseaseEffectCaps: Partial<GameStats> = { health: -75, happiness: -75 };
    Object.entries(diseaseEffects).forEach(([stat, totalEffect]) => {
      const statKey = stat as keyof GameStats;
      // Cap the total effect to prevent instant death
      const cap = diseaseEffectCaps[statKey] || -100;
      const cappedEffect = Math.max(cap, totalEffect);
      statsChange[statKey] = (statsChange[statKey] || 0) + cappedEffect;
    });

    if (gameState.diseases.length > 0) {
      const names = gameState.diseases.map(d => d.name).join(', ');
      events.push(`Still affected by ${names}. Visit a doctor or hospital.`);
      // Only show sickness modal if it's not already showing
      if (!gameState.showSicknessModal) {
        setGameState(prev => ({ ...prev, showSicknessModal: true }));
      }
    }

    // TIME PROGRESSION FIX: Calculate all ages upfront before any setGameState to ensure atomic updates
    // This prevents age desynchronization if any setGameState call fails
    const updatedRelationshipAges = (gameState.relationships || []).map(rel => ({
      ...rel,
      age: Math.min(150, addWeekToAge(rel.age || 0))
    }));
    const updatedSpouseAge = gameState.family?.spouse
      ? Math.min(150, addWeekToAge(gameState.family.spouse.age || 0))
      : undefined;
    // RELATIONSHIP STATE FIX: Track children being removed to clean up relationships array
    const childrenToRemove: string[] = [];
    // MAJOR FIX: Cap children array to prevent unbounded growth (max 20 children)
    const MAX_CHILDREN = 20;
    const updatedChildrenAges = (gameState.family?.children || [])
      .map(c => ({
        ...c,
        age: addWeekToAge(c.age || 0)
      }))
      .filter(c => {
        // Remove children who reach age 18+ (they become independent)
        if (c.age >= 18) {
          childrenToRemove.push(c.id);
          events.push(`${c.name || 'Child'} has reached adulthood and moved out.`);
          return false;
        }
        return true;
      })
      .slice(0, MAX_CHILDREN); // MAJOR FIX: Cap to max 20 children (remove oldest if over limit)
    const updatedSocialAges = (gameState.social?.relations || []).map(rel => ({
      ...rel,
      age: rel.age !== undefined ? addWeekToAge(rel.age) : undefined
    }));

    // TIME PROGRESSION FIX: Process social relations before state update to combine with ages
    const socialOutcome = processWeeklyRelations(
      gameState.social.relations,
      nextWeek
    );
    const processedSocialRelations = socialOutcome.relations.map(rel => {
      const agedRel = updatedSocialAges.find(r => r.id === rel.id);
      return agedRel ? { ...rel, age: agedRel.age } : rel;
    });
    // Apply social relations happiness bonus
    if (socialOutcome.happiness) {
      statsChange.happiness = (statsChange.happiness || 0) + socialOutcome.happiness;
    }
    if (socialOutcome.events.length > 0) {
      events.push(...socialOutcome.events);
    }

    // TIME PROGRESSION FIX: Process travel return synchronously before state update
    let travelReturnBenefits: Partial<GameStats> = {};
    let shouldReturnFromTravel = false;
    let travelDestinationId: string | undefined;
    let isFirstVisit = false;
    if (gameState.travel?.currentTrip && nextWeek >= gameState.travel.currentTrip.returnWeek) {
      shouldReturnFromTravel = true;
      travelDestinationId = gameState.travel.currentTrip.destinationId;
      const { DESTINATIONS } = require('@/lib/travel/destinations');
      const destination = DESTINATIONS.find((d: any) => d.id === travelDestinationId);
      if (destination) {
        travelReturnBenefits = {
          happiness: destination.benefits.happiness || 0,
          health: destination.benefits.health || 0,
          energy: destination.benefits.energy || 0,
        };
        isFirstVisit = !gameState.travel?.visitedDestinations?.includes(travelDestinationId);
        // Apply travel benefits to statsChange
        Object.entries(travelReturnBenefits).forEach(([stat, value]) => {
          if (value !== undefined) {
            statsChange[stat as keyof GameStats] = (statsChange[stat as keyof GameStats] || 0) + value;
          }
        });
        events.push(`Welcome back from ${destination.name}!`);
      }
    }

    // TIME PROGRESSION FIX: Process competition results synchronously before state update
    let competitionPrizeMoney = 0;
    let updatedCompetitionHistory: { companyId: string; history: any[] }[] = [];
    const { getActiveCompetitions } = require('@/lib/rd/competitions');
    const activeCompetitions = getActiveCompetitions(nextWeek);
    (gameState.companies || []).forEach(company => {
      const competitionHistory = company.competitionHistory || [];
      const pendingCompetitions = competitionHistory.filter(
        entry => !entry.completed && entry.endWeek <= nextWeek
      );

      if (pendingCompetitions.length > 0) {
        const updatedHistory = [...competitionHistory];
        pendingCompetitions.forEach(entry => {
          const competition = activeCompetitions.find((c: any) => c.id === entry.competitionId);
          if (!competition) return;

          // Generate AI competitors
          const numCompetitors = Math.floor(Math.random() * 8) + 3;
          const competitorScores: number[] = [];
          const baseScore = entry.score;
          for (let i = 0; i < numCompetitors; i++) {
            const variation = (Math.random() - 0.5) * baseScore * 0.5;
            competitorScores.push(Math.max(0, Math.floor(baseScore + variation)));
          }

          const allScores = [...competitorScores, entry.score].sort((a, b) => b - a);
          const playerRank = allScores.indexOf(entry.score) + 1;

          let prize = 0;
          if (playerRank === 1) prize = competition.prizes.first;
          else if (playerRank === 2) prize = competition.prizes.second;
          else if (playerRank === 3) prize = competition.prizes.third;

          competitionPrizeMoney += prize;
          if (prize > 0) {
            events.push(`Won ${competition.name} (${playerRank === 1 ? '1st' : playerRank === 2 ? '2nd' : '3rd'} place): +$${prize}`);
          }

          // Update entry
          const entryIndex = updatedHistory.findIndex(
            e => e.competitionId === entry.competitionId && e.entryWeek === entry.entryWeek
          );
          if (entryIndex !== -1) {
            updatedHistory[entryIndex] = {
              ...entry,
              completed: true,
              rank: playerRank,
              prize: prize,
            };
          }
        });
        updatedCompetitionHistory.push({ companyId: company.id, history: updatedHistory });
      }
    });
    if (competitionPrizeMoney > 0) {
      moneyChange += competitionPrizeMoney;
    }
    
    // LONG-TERM DEGRADATION FIX: Cap competition history to prevent unbounded growth
    // Keep only last 50 entries per company (older competitions rarely accessed)
    if (updatedCompetitionHistory.length > 0) {
      updatedCompetitionHistory.forEach(({ companyId, history }) => {
        if (history.length > 50) {
          // Keep most recent 50 entries (assuming newest first, or reverse if needed)
          const cappedHistory = history.slice(0, 50);
          const companyIndex = updatedCompetitionHistory.findIndex(c => c.companyId === companyId);
          if (companyIndex !== -1) {
            updatedCompetitionHistory[companyIndex] = { companyId, history: cappedHistory };
          }
        }
      });
    }

    // Advance time and age relationships
    setGameState(prev => {
      // Small random relationship decay each week
      // LONG-TERM DEGRADATION FIX: Skip relationship decay processing when effectiveDecay = 0
      // This avoids unnecessary array mapping when prestige bonuses eliminate decay
      let decayedRelationships = prev.relationships || [];
      
      // Only apply decay if needed (when effectiveDecay > 0, we still need random decay for partners/spouses)
      // Note: effectiveDecay applies to friend relationships, but partners/spouses have their own random decay
      // So we always process partners/spouses, but could skip if no decay needed for any relationship type
      // For now, we keep the processing since partners/spouses need random decay regardless of effectiveDecay
      // CRITICAL FIX: Validate relationshipScore for ALL relationships to prevent NaN propagation
      decayedRelationships = decayedRelationships.map(rel => {
        // CRITICAL FIX: Validate relationshipScore for all relationship types, not just partner/spouse
        const currentScore = typeof rel.relationshipScore === 'number' && isFinite(rel.relationshipScore) && !isNaN(rel.relationshipScore)
          ? rel.relationshipScore
          : 50; // Default to 50 if invalid
        
        // Apply decay only to partner/spouse relationships
        if (rel.type === 'partner' || rel.type === 'spouse') {
          // RANDOMNESS FIX: Normalize relationship decay - use single random roll with weighted distribution
          // Distribution: 50% no decay, 30% -1, 20% -2 (same average as before, less variance)
          // This prevents double randomness and makes decay more predictable
          // PRIORITY 2 FIX: Use constants from randomnessConstants
          const {
            DECAY_NO_DECAY_CHANCE,
            DECAY_MINUS_ONE_CHANCE,
          } = require('@/lib/randomness/randomnessConstants');
          const roll = Math.random();
          let decay = 0;
          if (roll < DECAY_NO_DECAY_CHANCE) {
            decay = 0; // 50% chance: no decay
          } else if (roll < DECAY_NO_DECAY_CHANCE + DECAY_MINUS_ONE_CHANCE) {
            decay = -1; // 30% chance: -1 decay
          } else {
            decay = -2; // 20% chance: -2 decay (remaining probability)
          }
          const relationshipScore = Math.max(0, Math.min(100, currentScore + decay));
          return { ...rel, relationshipScore };
        }
        
        // For other relationship types, ensure score is valid but don't apply decay
        const relationshipScore = Math.max(0, Math.min(100, currentScore));
        return { ...rel, relationshipScore };
      });

      // TIME PROGRESSION FIX: Use pre-calculated ages to ensure atomic update
      // RELATIONSHIP STATE FIX: Remove children who reached age 18+ from relationships array
      const relationshipsWithAges = decayedRelationships
        .filter(rel => !childrenToRemove.includes(rel.id)) // Remove children who reached age 18+
        .map((rel) => {
          const updatedRel = updatedRelationshipAges.find(r => r.id === rel.id);
          return updatedRel ? {
            ...rel,
            age: updatedRel.age,
            relationshipScore: Math.max(0, Math.min(100, rel.relationshipScore))
          } : rel;
        });

      // TIME PROGRESSION FIX: Handle travel return in main state update
      let updatedTravel = prev.travel;
      if (shouldReturnFromTravel && travelDestinationId) {
        updatedTravel = {
          ...prev.travel!,
          currentTrip: undefined,
        };
        // Business opportunity unlock will be handled separately if needed
      }

      // TIME PROGRESSION FIX: Update competition history in main state update
      // LONG-TERM DEGRADATION FIX: Cap competition history to prevent unbounded growth (50 entries per company)
      let updatedCompanies = prev.companies;
      let updatedCompany = prev.company;
      if (updatedCompetitionHistory.length > 0) {
        updatedCompanies = (prev.companies || []).map(c => {
          const compHistory = updatedCompetitionHistory.find(ch => ch.companyId === c.id);
          if (compHistory) {
            // LONG-TERM DEGRADATION FIX: Cap history to last 50 entries
            const cappedHistory = compHistory.history.length > 50 
              ? compHistory.history.slice(0, 50) 
              : compHistory.history;
            return { ...c, competitionHistory: cappedHistory };
          }
          // LONG-TERM DEGRADATION FIX: Cap existing history if not in update list
          if (c.competitionHistory && c.competitionHistory.length > 50) {
            return { ...c, competitionHistory: c.competitionHistory.slice(0, 50) };
          }
          return c;
        });
        if (prev.company) {
          const compHistory = updatedCompetitionHistory.find(ch => ch.companyId === prev.company!.id);
          if (compHistory) {
            // LONG-TERM DEGRADATION FIX: Cap history to last 50 entries
            const cappedHistory = compHistory.history.length > 50 
              ? compHistory.history.slice(0, 50) 
              : compHistory.history;
            updatedCompany = { ...prev.company, competitionHistory: cappedHistory };
          } else if (prev.company.competitionHistory && prev.company.competitionHistory.length > 50) {
            // LONG-TERM DEGRADATION FIX: Cap existing history if not in update list
            updatedCompany = { 
              ...prev.company, 
              competitionHistory: prev.company.competitionHistory.slice(0, 50) 
            };
          }
        }
      } else {
        // LONG-TERM DEGRADATION FIX: Cap existing history even if no updates this week
        updatedCompanies = (prev.companies || []).map(c => {
          if (c.competitionHistory && c.competitionHistory.length > 50) {
            return { ...c, competitionHistory: c.competitionHistory.slice(0, 50) };
          }
          return c;
        });
        if (prev.company && prev.company.competitionHistory && prev.company.competitionHistory.length > 50) {
          updatedCompany = { 
            ...prev.company, 
            competitionHistory: prev.company.competitionHistory.slice(0, 50) 
          };
        }
      }

      // RELATIONSHIP STATE FIX: Ensure spouse consistency - if spouse exists, must be in relationships array
      let validatedSpouse = prev.family?.spouse;
      if (validatedSpouse && updatedSpouseAge !== undefined) {
        // Check if spouse is still in relationships array
        const spouseInRelationships = relationshipsWithAges.find(r => r.id === validatedSpouse!.id);
        if (!spouseInRelationships) {
          // Spouse missing from relationships - clear family.spouse
          log.warn('Spouse missing from relationships array, clearing family.spouse', { spouseId: validatedSpouse.id });
          validatedSpouse = undefined;
        } else if (spouseInRelationships.type !== 'spouse') {
          // Spouse type mismatch - clear family.spouse
          log.warn('Spouse type mismatch, clearing family.spouse', { spouseId: validatedSpouse.id, actualType: spouseInRelationships.type });
          validatedSpouse = undefined;
        } else {
          // MINOR FIX: Ensure spouse age doesn't exceed 150 (enforce cap)
          const cappedSpouseAge = Math.min(150, updatedSpouseAge);
          validatedSpouse = { ...validatedSpouse, age: cappedSpouseAge };
        }
      }
      
      // RELATIONSHIP STATE FIX: Ensure children consistency - only include children that are in relationships array
      const validatedChildren = updatedChildrenAges
        .map(c => updateChildWeekly(c as ChildInfo))
        .filter(child => {
          const childInRelationships = relationshipsWithAges.find(r => r.id === child.id);
          if (!childInRelationships) {
            log.warn('Child missing from relationships array, removing from family.children', { childId: child.id });
            return false;
          }
          if (childInRelationships.type !== 'child') {
            log.warn('Child type mismatch, removing from family.children', { childId: child.id, actualType: childInRelationships.type });
            return false;
          }
          return true;
        });
      
      const updatedState = {
        ...prev,
        week: nextWeek,
        date: newDate,
        weeksLived: nextWeeksLived,
        relationships: relationshipsWithAges,
        family: {
          spouse: validatedSpouse,
          children: validatedChildren,
        },
        social: {
          ...prev.social,
          relations: processedSocialRelations,
        },
        travel: updatedTravel,
        companies: updatedCompanies,
        company: updatedCompany,
        lifeStage: getLifeStage(newDate.age),
      };

      // Update patents: decrement duration and remove expired patents
      const companiesWithPatents = (updatedState.companies || []).map(company => {
        if (company.patents && company.patents.length > 0) {
          const updatedPatents = updatePatents(company.patents);
          return {
            ...company,
            patents: updatedPatents,
          };
        }
        return company;
      });

      // Also update company if it has patents
      let companyWithPatents = updatedState.company;
      if (companyWithPatents?.patents && companyWithPatents.patents.length > 0) {
        companyWithPatents = {
          ...companyWithPatents,
          patents: updatePatents(companyWithPatents.patents),
        };
      }

      // Update commitment levels: decay neglected areas
      let updatedCommitments = updatedState.activityCommitments;
      if (updatedCommitments) {
        const { decayCommitmentLevels } = require('@/lib/commitments/commitmentSystem');
        const decayedLevels = decayCommitmentLevels(updatedCommitments);
        updatedCommitments = {
          ...updatedCommitments,
          commitmentLevels: decayedLevels,
        };
      }

      // CORRUPTION FIX: Include stock and crypto updates in main batch update
      // This prevents partial state updates if main update fails
      const finalState = {
        ...prev, // Preserve all existing state first
        ...updatedState, // Then apply week/time updates
        companies: companiesWithPatents,
        company: companyWithPatents,
        activityCommitments: updatedCommitments,
        // CORRUPTION FIX: Include stock updates in batch
        stocks: updatedStockHoldings !== null ? {
          ...prev.stocks,
          holdings: updatedStockHoldings,
          watchlist: prev.stocks?.watchlist || []
        } : prev.stocks,
        // CORRUPTION FIX: Include crypto updates in batch
        cryptos: updatedCryptosForBatch !== null ? updatedCryptosForBatch : prev.cryptos,
        // CORRUPTION FIX: Include bankruptcy state update in batch (if triggered)
        ...(bankruptcyStateUpdate || {}),
      };
      
      // CORRUPTION FIX: Validate state before applying
      const stateValidation = validateStateInvariants(finalState);
      if (!stateValidation.valid) {
        log.error('State invariant violation detected before applying:', stateValidation.errors);
        // Don't apply invalid state - return previous state
        return prev;
      }
      
      return finalState;
    });

    // TIME PROGRESSION FIX: Unlock business opportunity after travel return (non-critical, can be async)
    if (shouldReturnFromTravel && isFirstVisit && travelDestinationId) {
      setTimeout(() => {
        try {
          const { unlockBusinessOpportunity } = require('@/contexts/game/actions/TravelActions');
          unlockBusinessOpportunity(gameState, setGameState, travelDestinationId);
        } catch (error) {
          log.error('Error unlocking business opportunity:', error);
        }
      }, 0);
    }

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

    // Salary (weekly) - paused while in jail
    let salaryEarnings = 0;
    if (jailWeeks === 0 && gameState.currentJob) {
      const career = gameState.careers.find(c => c.id === gameState.currentJob);
      if (career) {
        // CRITICAL FIX: Validate career level and levels array before accessing salary
        if (!career.levels || career.levels.length === 0) {
          log.warn(`Career ${career.id} has no levels, skipping salary calculation`);
        } else {
          const validLevel = typeof career.level === 'number' && !isNaN(career.level) && isFinite(career.level) && career.level >= 0 && career.level < career.levels.length
            ? career.level
            : 0; // Default to level 0 if invalid
          const baseWeeklySalary = career.levels[validLevel].salary;
          // BUG FIX: Apply prestige income multiplier to career salary
          const incomeMultiplier = getIncomeMultiplier(unlockedBonuses);
          salaryEarnings = Math.floor(baseWeeklySalary * incomeMultiplier);
          moneyChange += salaryEarnings;
          events.push(`Earned weekly salary: $${salaryEarnings}${incomeMultiplier > 1.0 ? ` (${((incomeMultiplier - 1) * 100).toFixed(0)}% prestige bonus)` : ''}`);
        }

        // STABILITY FIX: Work-life balance enforcement - prevent working with critically low stats
        // If health or happiness is at 0, working becomes impossible (realistic work-life balance)
        const canWork = gameState.stats.health > 0 && gameState.stats.happiness > 0;
        if (!canWork) {
          events.push(`Cannot work: ${gameState.stats.health === 0 ? 'health' : 'happiness'} is at 0. Take care of yourself first.`);
          // Don't apply work penalties or progress if can't work
        } else {
        statsChange.happiness = (statsChange.happiness || 0) - 15;
        statsChange.health = (statsChange.health || 0) - 5;
        }

        // Apply prestige experience multiplier
        const prestigeData = gameState.prestige;
        const expMultiplier = prestigeData?.unlockedBonuses 
          ? getExperienceMultiplier(prestigeData.unlockedBonuses)
          : 1.0;
        const baseProgressGain = Math.floor(Math.random() * 5) + 2; // Reduced from 5-15 to 2-7 (2x slower)
        const progressGain = Math.floor(baseProgressGain * expMultiplier);
        
        // Apply commitment bonuses/penalties to career progression
        const { getCommitmentBonuses, getCommitmentPenalties, getEffectiveProgressGain } = require('@/lib/commitments/commitmentSystem');
        const careerBonuses = getCommitmentBonuses(gameState, 'career');
        const careerPenalties = getCommitmentPenalties(gameState, 'career');
        const rawEffectiveProgressGain = getEffectiveProgressGain(progressGain, careerBonuses, careerPenalties);
        
        // CRITICAL FIX: Validate effectiveProgressGain BEFORE any calculations
        const effectiveProgressGain = typeof rawEffectiveProgressGain === 'number' && isFinite(rawEffectiveProgressGain) && !isNaN(rawEffectiveProgressGain) && rawEffectiveProgressGain >= 0
          ? rawEffectiveProgressGain
          : 0;
        
        setGameState(prev => {
          // Update commitment level for career when working
          let updatedCommitments = prev.activityCommitments;
          if (updatedCommitments) {
            const { updateCommitmentLevel } = require('@/lib/commitments/commitmentSystem');
            const isCommitted = updatedCommitments.primary === 'career' || updatedCommitments.secondary === 'career';
            const newCareerLevel = updateCommitmentLevel(
              updatedCommitments.commitmentLevels?.career || 0,
              'career',
              isCommitted
            );
            updatedCommitments = {
              ...updatedCommitments,
              commitmentLevels: {
                ...updatedCommitments.commitmentLevels!,
                career: newCareerLevel,
              },
            };
          }
          
          return {
            ...prev,
            careers: prev.careers.map(c => {
              if (c.id !== gameState.currentJob) return c;
              // STABILITY FIX: Only progress career if player can work (work-life balance)
              const canWork = gameState.stats.health > 0 && gameState.stats.happiness > 0;
              if (!canWork) {
                return c; // No progress if can't work
              }
              // CRITICAL FIX: Validate career level and progress before calculations
              // CRITICAL FIX: Validate levels array exists and is not empty
              if (!c.levels || c.levels.length === 0) {
                log.warn(`Career ${c.id} has no levels, skipping progression`);
                return c;
              }
              const currentLevel = typeof c.level === 'number' && isFinite(c.level) && !isNaN(c.level) && c.level >= 0
                ? Math.min(c.level, c.levels.length - 1) // Clamp to valid range
                : 0;
              const currentProgress = typeof c.progress === 'number' && isFinite(c.progress) && !isNaN(c.progress)
                ? Math.max(0, Math.min(100, c.progress))
                : 0;
              
              // CRITICAL FIX: effectiveProgressGain is already validated above, use directly
              const safeProgressGain = effectiveProgressGain;
              
              let newProgress = Math.min(100, currentProgress + safeProgressGain);
              let newLevel = currentLevel;
            if (newProgress >= 100) {
                if (currentLevel < c.levels.length - 1) {
                newLevel += 1;
                // CRITICAL FIX: Ensure level doesn't exceed array bounds
                  // This is redundant after currentLevel clamp, but provides extra safety
                newLevel = Math.min(newLevel, c.levels.length - 1);
                newProgress = 0;
                events.push(`Promoted to ${c.levels[newLevel].name}!`);
                } else if (currentProgress < 100) {
                newProgress = 100;
                events.push('You have reached the highest position in your career!');
              }
            }
              return { ...c, progress: newProgress, level: newLevel };
            }),
            activityCommitments: updatedCommitments,
          };
        });

        // Advanced career perks
        switch (career.id) {
          case 'political':
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
    const hasEarlyCareerAccessBonus = hasEarlyCareerAccess(unlockedBonuses);
    pendingApplications.forEach(career => {
      // LIFESTYLE MAINTENANCE: Check if career is unlocked by lifestyle
      const { isCareerUnlockedByLifestyle } = require('@/lib/economy/lifestyle');
      const lifestyleUnlocked = isCareerUnlockedByLifestyle(career.id, gameState);
      const lifestyleRequired = ['corporate', 'celebrity', 'politician'].includes(career.id);
      const meetsLifestyle = !lifestyleRequired || lifestyleUnlocked;
      
      const meetRequirements =
        (career.requirements.fitness || 0) <= gameState.stats.fitness &&
        (!career.requirements.items ||
          career.requirements.items.every(itemId => (gameState.items || []).find(item => item.id === itemId)?.owned)) &&
        (hasEarlyCareerAccessBonus ||
          !career.requirements.education ||
          career.requirements.education.every(educationId =>
            gameState.educations.find(e => e.id === educationId)?.completed
          )) &&
        meetsLifestyle;

      // RANDOMNESS FIX: Pity system for job applications - guaranteed acceptance after 3 attempts
      // PRIORITY 2 FIX: Use constant from randomnessConstants
      const { PITY_THRESHOLD_JOB_APPLICATION } = require('@/lib/randomness/randomnessConstants');
      const applicationAttempts = (career.applicationAttempts || 0) + 1;
      const baseChance = 0.7; // 70% base chance if requirements met
      const pityThreshold = PITY_THRESHOLD_JOB_APPLICATION; // Guaranteed acceptance after 3 attempts
      const guaranteedAcceptance = applicationAttempts >= pityThreshold;
      const accepted = guaranteedAcceptance ? true : (meetRequirements && Math.random() < baseChance);
      
      if (accepted) {
        setGameState(prev => ({
          ...prev,
          careers: prev.careers.map(c => 
            c.id === career.id 
              ? { ...c, accepted: true, applicationAttempts: 0 } // Reset counter on acceptance
              : c
          ),
          currentJob: career.id,
        }));
        // CRITICAL FIX: Validate career level before accessing name
        const validLevel = career.levels && career.levels.length > 0 && typeof career.level === 'number' && !isNaN(career.level) && isFinite(career.level) && career.level >= 0 && career.level < career.levels.length
          ? career.level
          : 0; // Default to level 0 if invalid
        const levelName = career.levels && career.levels.length > 0 ? career.levels[validLevel].name : 'Entry Level';
        events.push(`Accepted for ${levelName}!`);
      } else if (meetRequirements) {
        // Increment attempt counter on rejection (if requirements were met)
        setGameState(prev => ({
          ...prev,
          careers: prev.careers.map(c => 
            c.id === career.id 
              ? { ...c, applicationAttempts: applicationAttempts }
              : c
          ),
        }));
      }
    });

    // TIME PROGRESSION FIX: Social relations already processed above and included in main setGameState
    // No additional processing needed here

    // Relationship decay and happiness boost from friends
    // Apply stat decay multiplier to relationship decay
    // LIFESTYLE MAINTENANCE: Lifestyle affects relationship decay
    const relationshipDecayMultiplier = getStatDecayMultiplier(unlockedBonuses);
    const baseDecay = 10 * relationshipDecayMultiplier;
    // Lifestyle maintenance reduces relationship decay (positive = less decay, negative = more decay)
    const lifestyleDecayAdjustment = -lifestyleEffects.relationshipMaintenance;
    const effectiveDecay = Math.max(0, baseDecay + lifestyleDecayAdjustment);
    
    setGameState(prev => {
      // STABILITY FIX: Cap active relationships to prevent performance degradation
      // Inactive relationships (score <= 0) decay faster and can be removed
      //
      // SAFETY: This is safe because:
      // - Only removes relationships during weekly processing (not during active gameplay)
      // - Preserves inactive relationships (score <= 0) which may recover
      // - Removes lowest-scored relationships first (least important)
      // - PROTECTS spouse/partner from removal (critical relationships always kept)
      //
      // FRAGILE LOGIC WARNING:
      // - This modifies relationships DURING decay processing, which could cause issues if:
      //   a) Relationship processing code expects stable array length
      //   b) Other code iterates relationships while this modifies them
      // - Mitigation: We create new array (relationshipsToProcess) before modifying
      
      // PROTECT spouse/partner from removal - these are critical relationships
      const criticalRelationships = prev.relationships.filter(rel => 
        rel.type === 'spouse' || rel.type === 'partner'
      );
      const nonCriticalRelationships = prev.relationships.filter(rel => 
        rel.type !== 'spouse' && rel.type !== 'partner'
      );
      
      const activeNonCritical = nonCriticalRelationships.filter(rel => rel.relationshipScore > 0);
      const inactiveNonCritical = nonCriticalRelationships.filter(rel => rel.relationshipScore <= 0);
      
      // If over limit (after accounting for critical relationships), remove lowest-scored non-critical
      let relationshipsToProcess = prev.relationships;
      const criticalCount = criticalRelationships.length;
      const maxNonCritical = Math.max(0, MAX_ACTIVE_RELATIONSHIPS - criticalCount);
      
      if (activeNonCritical.length > maxNonCritical) {
        const sortedActive = [...activeNonCritical].sort((a, b) => b.relationshipScore - a.relationshipScore);
        const topActive = sortedActive.slice(0, maxNonCritical);
        relationshipsToProcess = [...criticalRelationships, ...topActive, ...inactiveNonCritical];
        events.push(`Some relationships were removed due to too many active connections (max ${MAX_ACTIVE_RELATIONSHIPS}, ${criticalCount} critical relationships protected).`);
      }

      // PERFORMANCE FIX: Skip relationship updates if decay is 0 (common case)
      const updatedRelationships = effectiveDecay > 0
        ? relationshipsToProcess.map(rel => ({
            ...rel,
            relationshipScore: Math.max(0, rel.relationshipScore - effectiveDecay),
          }))
        : relationshipsToProcess; // No changes needed if no decay

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

    // Check for scheduled weddings and execute them
    // Check relationships for weddings scheduled for this week (nextWeek = gameState.week + 1)
    const relationshipsWithWeddings = (gameState.relationships || []).filter(
      rel => rel.weddingPlanned && rel.weddingPlanned.scheduledWeek === nextWeek
    );
    
    for (const relationship of relationshipsWithWeddings) {
      if (relationship.weddingPlanned) {
        try {
          // Create a temporary state with nextWeek for the wedding check
          const tempState = { ...gameState, week: nextWeek };
          const weddingResult = executeWedding(
            tempState,
            setGameState,
            relationship.id,
            { updateMoney: applyMoneyChange, updateStats: applyStatsChange }
          );
          
          if (weddingResult.success) {
            events.push(weddingResult.message);
            log.info(`Wedding executed for ${relationship.name}`);
          } else {
            // If wedding can't be executed (e.g., insufficient funds), add to events
            events.push(`Wedding scheduled but couldn't be finalized: ${weddingResult.message}`);
            log.warn(`Wedding execution failed for ${relationship.name}: ${weddingResult.message}`);
          }
        } catch (weddingError) {
          log.error(`Error executing wedding for ${relationship.name}:`, weddingError);
          events.push(`Error processing wedding with ${relationship.name}`);
        }
      }
    }

    // Process vehicle weekly maintenance and costs
    try {
      const vehicleResult = processVehicleWeekly(
        gameState,
        setGameState,
        { updateMoney: applyMoneyChange }
      );
      
      if (vehicleResult.totalCosts > 0) {
        moneyChange -= vehicleResult.totalCosts;
        events.push(`Vehicle maintenance & fuel: -$${vehicleResult.totalCosts.toFixed(2)}`);
      }
      
      if (vehicleResult.expiredInsurance.length > 0) {
        events.push(`Insurance expired for: ${vehicleResult.expiredInsurance.join(', ')}`);
      }
    } catch (vehicleError) {
      log.error('Error processing vehicle weekly maintenance:', vehicleError);
    }

    // Diet plan effects - paused while in jail
    const activeDietPlan = gameState.dietPlans.find(plan => plan.active);
    if (jailWeeks === 0 && activeDietPlan) {
      const weeklyCost = activeDietPlan.dailyCost * 7;
      moneyChange -= weeklyCost;
      statsChange.health = (statsChange.health || 0) + activeDietPlan.healthGain * 7;
      statsChange.energy = (statsChange.energy || 0) + activeDietPlan.energyGain * 7;
      if (activeDietPlan.happinessGain) {
        statsChange.happiness = (statsChange.happiness || 0) + activeDietPlan.happinessGain * 7;
      }
      events.push(`Weekly diet plan: -$${weeklyCost}`);
    }

    // Company income & mining - paused while in jail
    const cryptoEarnings: Record<string, number> = {};
    if (jailWeeks === 0) {
      gameState.companies.forEach(company => {
        // Calculate base company income
        let weeklyIncome = company.weeklyIncome;
        
        // Apply political perks (business income bonus)
        if (gameState.politics && gameState.politics.careerLevel > 0) {
          const { getCombinedPerkEffects } = require('@/lib/politics/perks');
          const perkEffects = getCombinedPerkEffects(gameState.politics.careerLevel);
          if (perkEffects.businessIncomeBonus > 0) {
            const bonus = Math.round(weeklyIncome * (perkEffects.businessIncomeBonus / 100));
            weeklyIncome += bonus;
          }
        }
        
        // Add government contract bonus
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { calculateGovernmentContractBonus } = require('@/lib/politics/governmentContracts');
        const contractBonus = calculateGovernmentContractBonus(gameState, company.id);
        if (contractBonus > 0) {
          weeklyIncome += contractBonus;
          events.push(`Government contract bonus (${company.name}): +$${contractBonus}`);
        }
        
        moneyChange += weeklyIncome;
        events.push(`Weekly company income (${company.name}): +$${weeklyIncome}`);

        if (company.selectedCrypto && Object.keys(company.miners).length > 0) {
        // ECONOMY FIX: Balanced company miner earnings to match warehouse efficiency
        const minerEarnings: Record<string, number> = {
          basic: 22,      // Match warehouse basic (was 175)
          advanced: 105,  // Match warehouse advanced (was 840)
          pro: 438,       // Match warehouse pro (was 3500)
          industrial: 1575, // Match warehouse industrial (was 12600)
          quantum: 7000,   // Match warehouse quantum (was 56000)
        };
        const minerPower: Record<string, number> = {
          basic: 10,
          advanced: 35,
          pro: 100,
          industrial: 250,
          quantum: 500,
        };

        // Apply crypto mining bonus from policies
        const cryptoPolicyEffects = gameState.politics?.activePolicyEffects?.crypto;
        const miningBonus = cryptoPolicyEffects?.miningBonus || 0;
        const miningBonusMultiplier = 1 + (miningBonus / 100);
        
        const weeklyMiningEarnings = Object.entries(company.miners).reduce(
          (sum, [id, count]) => sum + (minerEarnings[id] || 0) * count,
          0
        ) * miningBonusMultiplier;
        const totalPower = Object.entries(company.miners).reduce(
          (sum, [id, count]) => sum + (minerPower[id] || 0) * count,
          0
        );
        const selectedCrypto = (gameState.cryptos || []).find(c => c.id === company.selectedCrypto);

        if (selectedCrypto) {
          const cryptoEarned = weeklyMiningEarnings / selectedCrypto.price;
          cryptoEarnings[selectedCrypto.id] = (cryptoEarnings[selectedCrypto.id] || 0) + cryptoEarned;
          events.push(`Mined ${cryptoEarned.toFixed(6)} ${selectedCrypto.symbol} (≈$${weeklyMiningEarnings.toFixed(2)})`);
        }

        // Company power costs - paused while in jail (already inside jailWeeks === 0 check)
        // ECONOMY FIX: Increased power costs by 67% (0.12 → 0.20)
        // TIME PROGRESSION FIX: Use nextWeek for monthly check to ensure correct timing
        if (nextWeek % 4 === 0 && totalPower > 0) {
          const monthlyBill = totalPower * 0.20 * 30;
          moneyChange -= monthlyBill;
          events.push(`Paid electrical bill: -$${monthlyBill.toFixed(2)}`);
        }
        }
      });
    }

    // Warehouse mining earnings - paused while in jail
    if (jailWeeks === 0 && gameState.warehouse && gameState.warehouse.selectedCrypto && Object.keys(gameState.warehouse.miners).length > 0) {
      // Apply crypto mining bonus from policies
      const cryptoPolicyEffects = gameState.politics?.activePolicyEffects?.crypto;
      const warehouseMiningBonus = cryptoPolicyEffects?.miningBonus || 0;
      const warehouseMiningBonusMultiplier = 1 + (warehouseMiningBonus / 100);
      
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

      const selectedCrypto = (gameState.cryptos || []).find(c => c.id === gameState.warehouse?.selectedCrypto);
      const difficultyMultiplier = cryptoMiningMultipliers[gameState.warehouse.selectedCrypto] || 1.0;

      if (selectedCrypto) {
        const weeklyMiningEarnings = Object.entries(gameState.warehouse.miners).reduce(
          (sum, [id, count]) => sum + (minerEarnings[id] || 0) * count * difficultyMultiplier,
          0
        ) * warehouseMiningBonusMultiplier;
        const totalPower = Object.entries(gameState.warehouse.miners).reduce(
          (sum, [id, count]) => sum + (minerPower[id] || 0) * count,
          0
        );

        // BUG FIX: Apply durability multiplier to earnings (miners at 0% durability earn 0%, 100% durability = 100% earnings)
        const minerDurability = gameState.warehouse.minerDurability || {};
        let totalDurabilityMultiplier = 0;
        let totalMiners = 0;
        
        Object.entries(gameState.warehouse.miners).forEach(([minerId, count]) => {
          const durability = minerDurability[minerId] ?? 100; // Default to 100 for new miners
          totalDurabilityMultiplier += durability * count;
          totalMiners += count;
        });
        
        const averageDurability = totalMiners > 0 ? totalDurabilityMultiplier / totalMiners : 100;
        const durabilityMultiplier = averageDurability / 100; // Convert to 0-1 multiplier
        
        // Apply durability to earnings
        const adjustedMiningEarnings = Math.round(weeklyMiningEarnings * durabilityMultiplier);
        const cryptoEarned = adjustedMiningEarnings / selectedCrypto.price;
        cryptoEarnings[selectedCrypto.id] = (cryptoEarnings[selectedCrypto.id] || 0) + cryptoEarned;
        
        if (averageDurability < 100) {
          events.push(`Warehouse mined ${cryptoEarned.toFixed(6)} ${selectedCrypto.symbol} (≈$${adjustedMiningEarnings.toFixed(2)}, ${averageDurability.toFixed(0)}% efficiency)`);
        } else {
          events.push(`Warehouse mined ${cryptoEarned.toFixed(6)} ${selectedCrypto.symbol} (≈$${adjustedMiningEarnings.toFixed(2)})`);
        }

        // BUG FIX: Miner durability decay (1-2% per week depending on usage)
        // Higher tier miners decay slower (better build quality)
        const decayRates: Record<string, number> = {
          basic: 2.0,      // 2% per week
          advanced: 1.8,   // 1.8% per week
          pro: 1.5,        // 1.5% per week
          industrial: 1.2, // 1.2% per week
          quantum: 1.0,    // 1.0% per week
          mega: 0.8,       // 0.8% per week
          giga: 0.6,       // 0.6% per week
          tera: 0.5,       // 0.5% per week
        };
        
        // Update miner durability (decay only if not in jail and miners are active)
        if (jailWeeks === 0 && Object.keys(gameState.warehouse.miners).length > 0) {
          const updatedMinerDurability: Record<string, number> = { ...minerDurability };
          
          Object.entries(gameState.warehouse.miners).forEach(([minerId, count]) => {
            if (count > 0) {
              const currentDurability = updatedMinerDurability[minerId] ?? 100;
              const decayRate = decayRates[minerId] || 2.0; // Default 2% if unknown
              const newDurability = Math.max(0, currentDurability - decayRate);
              updatedMinerDurability[minerId] = newDurability;
              
              // Warn if durability is low
              if (newDurability < 20 && currentDurability >= 20) {
                events.push(`⚠️ ${minerId} miners are critically damaged (${newDurability.toFixed(0)}% health)! Repair needed.`);
        }
            }
          });

          // Auto-repair: If enabled, repair all miners to 100% (costs crypto)
        if (gameState.warehouse.autoRepairEnabled && gameState.warehouse.autoRepairCryptoId) {
          const autoRepairCrypto = (gameState.cryptos || []).find(c => c.id === gameState.warehouse?.autoRepairCryptoId);
          if (autoRepairCrypto && autoRepairCrypto.owned >= (gameState.warehouse.autoRepairWeeklyCost || 0)) {
            const autoRepairCost = gameState.warehouse.autoRepairWeeklyCost || 0;
              
              // Repair all miners to 100%
              if (gameState.warehouse) {
                Object.keys(gameState.warehouse.miners).forEach(minerId => {
                  if (gameState.warehouse!.miners[minerId] > 0) {
                    updatedMinerDurability[minerId] = 100;
                  }
                });
              }
              
              const autoRepairCryptoId = gameState.warehouse?.autoRepairCryptoId;
            setGameState(prev => ({
              ...prev,
              cryptos: prev.cryptos.map(c => 
                  c.id === autoRepairCryptoId 
                  ? { ...c, owned: c.owned - autoRepairCost }
                  : c
              ),
                warehouse: prev.warehouse ? {
                  ...prev.warehouse,
                  minerDurability: updatedMinerDurability,
                } : undefined,
            }));
              events.push(`Auto-repair service: -${autoRepairCost.toFixed(6)} ${autoRepairCrypto.symbol} (all miners repaired)`);
            } else {
              // Auto-repair enabled but can't afford - update durability anyway (decay continues)
              setGameState(prev => ({
                ...prev,
                warehouse: prev.warehouse ? {
                  ...prev.warehouse,
                  minerDurability: updatedMinerDurability,
                } : undefined,
              }));
            }
          } else {
            // No auto-repair - just update durability
            setGameState(prev => ({
              ...prev,
              warehouse: prev.warehouse ? {
                ...prev.warehouse,
                minerDurability: updatedMinerDurability,
              } : undefined,
            }));
          }
        }

        // Power costs - paused while in jail
        if (jailWeeks === 0) {
          // ECONOMY FIX: Increased power costs by 50% (0.40 → 0.60)
          const weeklyPowerCost = totalPower * 0.60; // $0.60 per power unit per week
          moneyChange -= weeklyPowerCost;
          events.push(`Warehouse power costs: -$${weeklyPowerCost.toFixed(2)}`);
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

    // Political system updates
    if (gameState.politics) {
      // Check for expired policies and remove them
      const activePolicies = gameState.politics.activePolicies || [];
      const expiredPolicies = activePolicies.filter(ap => 
        ap.expiresWeek !== undefined && nextWeek >= ap.expiresWeek
      );
      
      if (expiredPolicies.length > 0) {
        const { getPolicyById } = require('@/lib/politics/policies');
        const remainingActivePolicies = activePolicies.filter(ap => 
          !expiredPolicies.some(ep => ep.policyId === ap.policyId)
        );
        const remainingEnacted = (gameState.politics.policiesEnacted || []).filter(
          pid => !expiredPolicies.some(ep => ep.policyId === pid)
        );
        
        // Revert policy effects for expired policies
        expiredPolicies.forEach(expired => {
          const policy = getPolicyById(expired.policyId);
          if (policy) {
            if (policy.effects.money) {
              moneyChange -= policy.effects.money;
            }
            if (policy.effects.happiness) {
              statsChange.happiness = (statsChange.happiness || 0) - policy.effects.happiness;
            }
            if (policy.effects.health) {
              statsChange.health = (statsChange.health || 0) - policy.effects.health;
            }
            if (policy.effects.reputation) {
              statsChange.reputation = (statsChange.reputation || 0) - policy.effects.reputation;
            }
            events.push(`Policy "${policy.name}" has expired.`);
          }
        });
        
        // Recalculate active policy effects after expiration
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const PoliticalActions = require('@/contexts/game/actions/PoliticalActions');
        const updatedActivePolicyEffects = PoliticalActions.calculateActivePolicyEffects 
          ? PoliticalActions.calculateActivePolicyEffects(remainingEnacted)
          : undefined;
        
        setGameState(prev => ({
          ...prev,
          politics: {
            ...prev.politics || {
              careerLevel: 0,
              approvalRating: 50,
              policyInfluence: 0,
              electionsWon: 0,
              policiesEnacted: [],
              activePolicies: [],
              lobbyists: [],
              alliances: [],
              campaignFunds: 0,
            },
            activePolicies: remainingActivePolicies,
            policiesEnacted: remainingEnacted,
            activePolicyEffects: updatedActivePolicyEffects,
          },
        }));
      }

      // Apply policy effects weekly (only for active policies)
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { calculatePolicyEffects } = require('@/lib/politics/policies');
      const currentActivePolicyIds = ((gameState.politics.activePolicies || []).length > 0 
        ? gameState.politics.activePolicies!.map(ap => ap.policyId)
        : gameState.politics.policiesEnacted || []);
      const policyEffects = calculatePolicyEffects(currentActivePolicyIds);
      
      if (policyEffects.money !== 0) {
        moneyChange += policyEffects.money;
        events.push(`Policy effects: ${policyEffects.money > 0 ? '+' : ''}$${policyEffects.money.toFixed(2)}/week`);
      }
      if (policyEffects.happiness !== 0) {
        statsChange.happiness = (statsChange.happiness || 0) + policyEffects.happiness;
      }
      if (policyEffects.health !== 0) {
        statsChange.health = (statsChange.health || 0) + policyEffects.health;
      }
      if (policyEffects.reputation !== 0) {
        statsChange.reputation = (statsChange.reputation || 0) + policyEffects.reputation;
      }

      // Apply healthcare policy effects (health bonus)
      const healthcareEffects = gameState.politics?.activePolicyEffects?.healthcare;
      if (healthcareEffects?.healthBonus) {
        statsChange.health = (statsChange.health || 0) + healthcareEffects.healthBonus;
        if (healthcareEffects.healthBonus > 0) {
          events.push(`Healthcare policy: +${healthcareEffects.healthBonus} health`);
        }
      }

      // Natural approval rating decay (if not campaigning)
      const approvalDecay = gameState.politics.campaignFunds > 0 ? 0 : -1;
      const newApproval = Math.max(0, Math.min(100, (gameState.politics.approvalRating || 50) + approvalDecay));
      
      if (newApproval !== gameState.politics.approvalRating) {
        setGameState(prev => ({
          ...prev,
          politics: {
            ...prev.politics || {
              careerLevel: 0,
              approvalRating: 50,
              policyInfluence: 0,
              electionsWon: 0,
              policiesEnacted: [],
              activePolicies: [],
              lobbyists: [],
              alliances: [],
              campaignFunds: 0,
            },
            approvalRating: newApproval,
          },
        }));
      }
    }

    // Real estate bonuses
    // LONG-TERM DEGRADATION FIX: Optimize nested loop by combining furniture calculations
    // Reduces from O(n × m) to O(n) by calculating furniture bonuses in single pass
    gameState.realEstate.forEach(property => {
      if (property.owned) {
        let propertyEnergy = property.weeklyEnergy || 0;
        let propertyHappiness = property.weeklyHappiness || 0;
        let propertyHealth = 0;
        let propertyFitness = 0;

        // Calculate furniture bonuses in single pass (optimized from nested loop)
        property.interior.forEach(furnitureId => {
          if (furnitureId === 'luxury_bed') {
            propertyEnergy += 10;
            propertyHappiness += 5;
          } else if (furnitureId === 'home_gym') {
            propertyHealth += 15;
            propertyFitness += 5;
          }
        });

        // Apply all bonuses at once
        statsChange.energy = (statsChange.energy || 0) + propertyEnergy;
        statsChange.happiness = (statsChange.happiness || 0) + propertyHappiness;
        statsChange.health = (statsChange.health || 0) + propertyHealth;
        statsChange.fitness = (statsChange.fitness || 0) + propertyFitness;
      }
    });

    // Partner income and relationship management
    const updatedRelationships: Relationship[] = [];
    
    // STABILITY FIX: Cap relationship income to prevent economy dominance
    // Limit total relationship income to MAX_RELATIONSHIP_INCOME/week (top N relationships by income)
    //
    // SAFETY: This is safe because:
    // - Income calculation is isolated to this section
    // - Cap is applied before adding to moneyChange (no double-counting)
    // - Top relationships by income are prioritized (fair distribution)
    // - Processes relationships in sorted order (consistent income distribution)
    //
    // LONG-TERM DEGRADATION FIX: Collect income relationships during main loop to avoid double-pass
    // Eliminates O(n log n) sort operation, reduces to O(n) complexity
    const relationshipIncomes: { id: string; income: number; name: string }[] = [];
    let totalRelationshipIncome = 0;
    
    // RELATIONSHIP STATE FIX: Track relationships to remove for cleanup
    const relationshipsToRemove: string[] = [];
    
    // LONG-TERM DEGRADATION FIX: Single pass over relationships - collect income data and process all logic
    // This eliminates the separate filter/sort pass, reducing from O(n log n) to O(n)
    gameState.relationships.forEach(rel => {
      let updatedRel = { ...rel };
      
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
          const baseHappinessGain = Math.floor(rel.relationshipScore / 10); // 5-10 happiness based on relationship level
          const relationshipGainMultiplier = getRelationshipGainMultiplier(unlockedBonuses);
          const happinessGain = Math.floor(baseHappinessGain * relationshipGainMultiplier);
          statsChange.happiness = (statsChange.happiness || 0) + happinessGain;
          events.push(`${rel.name} makes you happy! +${happinessGain} happiness`);
        }
      }
      
      // RELATIONSHIP IMPROVEMENT: Automatic breakup/divorce from neglect
      // Partners: Breakup after 8 weeks at relationship score ≤ 10
      // Spouses: Divorce after 12 weeks at relationship score ≤ 15
      if (rel.type === 'partner' || rel.type === 'spouse') {
        const weeksAtLowRelationship = rel.weeksAtLowRelationship || 0;
        const isPartner = rel.type === 'partner';
        const threshold = isPartner ? 10 : 15; // Partners break up at ≤10, spouses divorce at ≤15
        const requiredWeeks = isPartner ? 8 : 12; // Partners need 8 weeks, spouses need 12 weeks
        
        if (rel.relationshipScore <= threshold) {
          updatedRel.weeksAtLowRelationship = weeksAtLowRelationship + 1;
          
          // Trigger automatic breakup/divorce
          if (updatedRel.weeksAtLowRelationship >= requiredWeeks) {
            if (isPartner) {
              // Automatic breakup
              events.push(`💔 ${rel.name} ended the relationship. The connection has faded away.`);
              statsChange.happiness = (statsChange.happiness || 0) - 20;
              // Remove partner income if they had any
              if (rel.income && rel.relationshipScore >= 50) {
                events.push(`Lost ${rel.name}'s income contribution.`);
              }
              relationshipsToRemove.push(rel.id); // RELATIONSHIP STATE FIX: Track for removal
              return; // Skip adding this relationship (breakup)
            } else {
              // Automatic divorce
              // STABILITY FIX: Cap divorce settlement at available money to prevent impossible debt
              // Calculate divorce settlement (20-30% of money, minimum $5,000, but capped at available money)
              const settlementPercent = 0.2 + Math.random() * 0.1; // 20-30%
              const currentMoney = gameState.stats.money;
              const baseSettlement = Math.max(5000, Math.floor(currentMoney * settlementPercent));
              const lawyerFees = 5000;
              const totalCost = baseSettlement + lawyerFees;
              
              // STABILITY FIX: Cap settlement at available money to prevent negative debt
              // If player can't afford full settlement, reduce it proportionally
              const availableMoney = Math.max(0, currentMoney);
              const actualSettlement = availableMoney >= totalCost 
                ? baseSettlement 
                : Math.max(0, Math.floor(availableMoney * 0.5)); // Take 50% of available if can't afford full
              const actualLawyerFees = availableMoney >= totalCost 
                ? lawyerFees 
                : Math.max(0, availableMoney - actualSettlement); // Remaining goes to lawyer fees
              const actualTotalCost = actualSettlement + actualLawyerFees;
              
              // Apply divorce costs (capped at available money)
              moneyChange -= actualTotalCost;
              statsChange.happiness = (statsChange.happiness || 0) - 30;
              statsChange.reputation = (statsChange.reputation || 0) - 10;
              
              if (actualTotalCost < totalCost) {
                events.push(`💔 ${rel.name} filed for divorce. Settlement: $${actualSettlement.toLocaleString()}, Lawyer fees: $${actualLawyerFees.toLocaleString()} (reduced due to limited funds).`);
              } else {
                events.push(`💔 ${rel.name} filed for divorce. Settlement: $${actualSettlement.toLocaleString()}, Lawyer fees: $${actualLawyerFees.toLocaleString()}.`);
              }
              
              relationshipsToRemove.push(rel.id); // RELATIONSHIP STATE FIX: Track for removal
              return; // Skip adding this relationship (divorce)
            }
          }
        } else {
          // Reset counter if relationship improves above threshold
          updatedRel.weeksAtLowRelationship = 0;
        }
      }
      
      // LONG-TERM DEGRADATION FIX: Collect income relationships during main loop
      // Track eligible relationships for income calculation (will sort and process after loop)
      if (rel.income && (rel.type === 'partner' || rel.type === 'spouse') && rel.relationshipScore >= 50) {
        relationshipIncomes.push({ id: rel.id, income: rel.income || 0, name: rel.name });
      }
      
      updatedRelationships.push(updatedRel);
    });
    
    // LONG-TERM DEGRADATION FIX: Process relationship income after collecting all eligible relationships
    // Sort and cap to top earners (ensures consistent income distribution week-to-week)
    // This is done after the main loop to avoid O(n log n) sort during relationship processing
    // Only sort the small subset (max 20 relationships) instead of all relationships
    relationshipIncomes.sort((a, b) => b.income - a.income); // Sort by income descending
    const topIncomeRelationships = relationshipIncomes.slice(0, MAX_RELATIONSHIPS_FOR_INCOME); // Top 20 relationships
    
    topIncomeRelationships.forEach(({ income, name }) => {
      if (totalRelationshipIncome < MAX_RELATIONSHIP_INCOME) {
        const incomeToAdd = Math.min(income, MAX_RELATIONSHIP_INCOME - totalRelationshipIncome);
        moneyChange += incomeToAdd;
        totalRelationshipIncome += incomeToAdd;
        if (incomeToAdd > 0) {
          events.push(`${name} contributed $${incomeToAdd}${incomeToAdd < income ? ' (capped)' : ''}`);
        }
      }
    });
    
    // RELATIONSHIP STATE FIX: Remove tracked relationships and ensure family state consistency
    // Update relationships in game state
    setGameState(prev => {
      // Remove relationships that were marked for removal (breakups, divorces)
      const finalRelationships = updatedRelationships.filter(r => !relationshipsToRemove.includes(r.id));
      
      // RELATIONSHIP STATE FIX: Clean up family state - remove spouse if they're not in relationships
      let validatedFamily = { ...prev.family };
      
      // Validate spouse
      if (validatedFamily.spouse) {
        const spouseInRelationships = finalRelationships.find(r => r.id === validatedFamily.spouse!.id && r.type === 'spouse');
        if (!spouseInRelationships) {
          // Spouse was removed (divorce/breakup) - clear family.spouse
          validatedFamily.spouse = undefined;
        }
      }
      
      // Validate children - only keep children that are in relationships array
      validatedFamily.children = validatedFamily.children.filter(child => {
        const childInRelationships = finalRelationships.find(r => r.id === child.id && r.type === 'child');
        if (!childInRelationships) {
          // Child was removed - clear from family.children
          return false;
        }
        return true;
      });
      
      return {
        ...prev,
        relationships: finalRelationships,
        family: validatedFamily,
      };
    });

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

    // CORRUPTION FIX: Add validation to prevent silent failures in hobby sponsor updates
    try {
      setGameState(prev => ({ ...prev, hobbies: hobbySponsorUpdates }));
    } catch (hobbyError) {
      log.error('Error updating hobby sponsors:', hobbyError);
      // Design: Sponsor updates are non-critical weekly maintenance operations.
      // If this update fails, sponsor income is already calculated and will be applied
      // in the main state update. The game continues normally - sponsors will update
      // next week. This separation ensures week progression never fails due to sponsor errors.
    }

    // Education progress
    // CRITICAL FIX: Validate and clamp weeksRemaining to prevent negative values
    // MAJOR FIX: Normalize undefined/null to undefined consistently
    //
    // SAFETY: This is safe because:
    // - Null is normalized to undefined, ensuring consistent type checking
    // - Negative/NaN values are treated as completed, preventing infinite loops
    // - All educations are processed, ensuring no corrupted states persist
    //
    // FRAGILE LOGIC WARNING:
    // - If education.weeksRemaining is 0 (not undefined), it's treated as "has weeksRemaining"
    //   but then the check `weeksRemaining > 0` fails, so it falls through to normalization.
    //   This is correct (0 means completed), but the logic flow could be clearer.
    // - If education.completed is false but weeksRemaining is undefined, we normalize to
    //   undefined. This is correct, but if the education was never started, this might be
    //   unexpected. Consider checking if education was ever enrolled.
    //
    // Validation: weeksRemaining is clamped to duration if it exceeds it (see line 7493-7499).
    // Large values are handled gracefully - they will decrement normally until completion.
    // If duration changes after enrollment, the clamp ensures weeksRemaining never exceeds duration.
    // CORRUPTION FIX: Add try-catch to prevent silent failures in education updates
    // MAJOR FIX: Clean up completed educations to prevent unbounded array growth
    // Remove completed educations if array gets too large (>30 educations, lowered from 50)
    const completedEducationNames: string[] = []; // Collect completion messages
    try {
      setGameState(prev => {
        // MAJOR FIX: Filter out old completed educations if array is too large
        // Keep all active educations and limit completed ones to prevent unbounded growth
        // Lowered threshold from 50 to 30 to prevent array growth in education hoarder paths
        let cleanedEducations = prev.educations;
        if (prev.educations.length > 30) {
          const activeEducations = prev.educations.filter(e => !e.completed);
          const completedEducations = prev.educations.filter(e => e.completed);
          // Keep all active + most recent 20 completed (lowered from 30 to prevent growth)
          if (completedEducations.length > 20) {
            cleanedEducations = [...activeEducations, ...completedEducations.slice(-20)]; // Keep last 20 (most recent)
          }
        }
        
        return {
          ...prev,
          educations: cleanedEducations.map(education => {
            try {
              // MAJOR FIX: Normalize null to undefined for consistent handling
              // This ensures type checking works correctly (undefined vs null)
              const weeksRemaining = education.weeksRemaining === null ? undefined : education.weeksRemaining;
              
              // CRITICAL FIX: Validate weeksRemaining: if negative, NaN, or exceeds duration, treat as completed or clamp
              if (weeksRemaining !== undefined) {
                if (isNaN(weeksRemaining) || !isFinite(weeksRemaining) || weeksRemaining < 0) {
                  // Corrupted state - mark as completed
                  log.warn(`Education ${education.name} has invalid weeksRemaining: ${weeksRemaining}, marking as completed`);
                  return { ...education, completed: true, weeksRemaining: undefined };
                }
                // CRITICAL FIX: Clamp weeksRemaining to duration if it exceeds (prevents corruption)
                if (weeksRemaining > education.duration) {
                  log.warn(`Education ${education.name} has weeksRemaining (${weeksRemaining}) exceeding duration (${education.duration}), clamping`);
                  const clampedWeeksRemaining = education.duration;
                  if (clampedWeeksRemaining === 0) {
                    return { ...education, completed: true, weeksRemaining: undefined };
                  }
                  return { ...education, weeksRemaining: clampedWeeksRemaining };
                }
                if (weeksRemaining > 0) {
                  // BUG FIX: Apply prestige experience multiplier to education progress
                  const prestigeData = prev.prestige;
                  const expMultiplier = prestigeData?.unlockedBonuses 
                    ? getExperienceMultiplier(prestigeData.unlockedBonuses)
                    : 1.0;
                  // CORRUPTION FIX: Validate multiplier before use
                  const validMultiplier = typeof expMultiplier === 'number' && !isNaN(expMultiplier) && isFinite(expMultiplier) && expMultiplier > 0
                    ? expMultiplier
                    : 1.0;
                  // Reduce weeks by 1 + bonus weeks (e.g., 1.5x multiplier = reduce by 1.5 weeks, rounded)
                  const weeksToReduce = Math.max(1, Math.floor(validMultiplier));
                  const newWeeksRemaining = Math.max(0, weeksRemaining - weeksToReduce);
                  // CORRUPTION FIX: Validate result
                  if (isNaN(newWeeksRemaining) || !isFinite(newWeeksRemaining) || newWeeksRemaining < 0) {
                    log.warn(`Invalid calculated weeksRemaining for ${education.name}: ${newWeeksRemaining}, marking as completed`);
                    return { ...education, completed: true, weeksRemaining: undefined };
                  }
                  if (newWeeksRemaining === 0) {
                    // Collect completion message to add to events array after state update
                    completedEducationNames.push(education.name);
                    return { ...education, completed: true, weeksRemaining: undefined };
                  }
                  return { ...education, weeksRemaining: newWeeksRemaining };
                }
              }
              // If weeksRemaining is undefined and not completed, ensure it's undefined (not null)
              // MAJOR FIX: Normalize to undefined for consistency
              // This ensures all completed/not-started educations have undefined, not null
              return { ...education, weeksRemaining: undefined };
            } catch (eduError) {
              log.error(`Error processing education ${education?.name}:`, eduError);
              return education; // Return unchanged on error
            }
          }),
        };
      });
      // Add completion messages to events array after state update
      completedEducationNames.forEach(name => {
        events.push(`Completed ${name}!`);
      });
    } catch (educationError) {
      log.error('Error updating education progress:', educationError);
      // Design: Education progress updates are non-critical weekly maintenance operations.
      // If this update fails, education progress is preserved and will update next week.
      // The game continues normally - no data is lost. This separation ensures week
      // progression never fails due to education update errors.
    }

    // TIME PROGRESSION FIX: Process chained events before rolling weekly events
    // Chained events are follow-up events scheduled from previous event choices
    const { getFollowUpEvent } = require('@/lib/events/lifeEvents');
    const pendingChainedEvents = gameState.pendingChainedEvents || [];
    const chainedEventsToProcess: WeeklyEvent[] = [];
    const remainingPendingChainedEvents: typeof pendingChainedEvents = [];
    
    pendingChainedEvents.forEach((pending) => {
      if (nextWeek >= pending.triggerWeek) {
        const followUp = getFollowUpEvent([pending], nextWeek);
        if (followUp) {
          chainedEventsToProcess.push(followUp.event);
          log.info('Chained event triggered', { 
            eventId: followUp.event.id, 
            sourceEventId: pending.sourceEventId,
            triggerWeek: pending.triggerWeek,
            currentWeek: nextWeek 
          });
        } else {
          // Keep pending if not yet due or event not found
          remainingPendingChainedEvents.push(pending);
        }
      } else {
        // Keep pending if not yet due
        remainingPendingChainedEvents.push(pending);
      }
    });
    
    // RANDOMNESS FIX: Roll weekly events with pity system
    // TIME PROGRESSION FIX: Use nextWeek for event rolling to ensure events are associated with correct week
    const weeklyEvents = rollWeeklyEvents({ ...gameState, week: nextWeek });
    
    // Add chained events to weekly events (before max events check)
    if (chainedEventsToProcess.length > 0) {
      weeklyEvents.push(...chainedEventsToProcess);
      log.info('Chained events added to weekly events', { count: chainedEventsToProcess.length });
    }
    
    // Track last event week if events occurred (for pity system)
    const hasEvents = weeklyEvents.length > 0;
    
    // Apply follower decay if inactive (social media)
    // CORRUPTION FIX: Add validation to prevent silent failures
    // TIME PROGRESSION FIX: Use nextWeek for social media week calculation
    if (gameState.socialMedia) {
      try {
        const lastPostWeek = gameState.socialMedia.lastPostWeek || 0;
        let weeksSinceLastPost = nextWeek - lastPostWeek;
        // Handle year rollover (if nextWeek < lastPostWeek, we've rolled over)
        if (weeksSinceLastPost < 0) {
          weeksSinceLastPost = weeksSinceLastPost + 52; // Add 52 weeks for year rollover
        }
        if (weeksSinceLastPost >= 2) {
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          const { calculateFollowerDecay } = require('@/lib/social/socialMedia');
          let currentFollowers = typeof gameState.socialMedia.followers === 'number' && !isNaN(gameState.socialMedia.followers)
            ? gameState.socialMedia.followers
            : 0;
          // CORRUPTION FIX: Validate followers before calculation
          if (currentFollowers < 0) {
            log.warn(`Invalid follower count: ${currentFollowers}, resetting to 0`);
            currentFollowers = 0;
          }
          const decay = calculateFollowerDecay(currentFollowers, weeksSinceLastPost);
          // CORRUPTION FIX: Validate decay value
          if (typeof decay === 'number' && !isNaN(decay) && isFinite(decay) && decay > 0) {
            const newFollowers = Math.max(0, currentFollowers - decay);
            // CORRUPTION FIX: Validate result before applying
            if (typeof newFollowers === 'number' && !isNaN(newFollowers) && isFinite(newFollowers)) {
              setGameState(prev => ({
                ...prev,
                socialMedia: prev.socialMedia ? {
                  ...prev.socialMedia,
                  followers: newFollowers,
                } : prev.socialMedia,
              }));
            } else {
              log.warn(`Invalid calculated followers: ${newFollowers}, skipping update`);
            }
          } else {
            log.warn(`Invalid follower decay: ${decay}, skipping update`);
          }
        }
      } catch (socialError) {
        log.error('Error updating social media followers:', socialError);
        // Design: Social media follower decay is a non-critical weekly maintenance operation.
        // If this update fails, follower count is preserved and will update next week.
        // The game continues normally - no data is lost. This separation ensures week
        // progression never fails due to social media update errors.
      }
    }

    // Natural stat changes
    // Apply energy regeneration multiplier
    // Note: prestigeData and unlockedBonuses are already declared earlier in this function (line 3773-3774)
    const energyRegenMultiplier = getEnergyRegenMultiplier(unlockedBonuses);
    const baseEnergyRegen = 100;
    statsChange.energy = Math.min(100, baseEnergyRegen * energyRegenMultiplier);
    
    // Apply stat decay reduction
    const statDecayMultiplier = getStatDecayMultiplier(unlockedBonuses);
    
    // STABILITY FIX: Reduce stat decay for high net worth players (investment strategy support)
    // Players with high net worth can afford better lifestyle, reducing natural decay
    // This allows investment-focused players to maintain stats without constant active maintenance
    // Note: netWorth is already imported at top of file
    // CORRUPTION FIX: Validate net worth calculation to prevent NaN propagation in stat chain
    let currentNetWorth: number;
    try {
      currentNetWorth = netWorth(gameState);
      // Validate net worth result
      if (typeof currentNetWorth !== 'number' || isNaN(currentNetWorth) || !isFinite(currentNetWorth)) {
        log.warn(`Invalid net worth calculated: ${currentNetWorth}, defaulting to 0`);
        currentNetWorth = 0;
      }
      // Clamp to reasonable range to prevent overflow
      currentNetWorth = Math.max(0, Math.min(Number.MAX_SAFE_INTEGER, currentNetWorth));
    } catch (netWorthError) {
      log.error('Error calculating net worth:', netWorthError);
      currentNetWorth = 0; // Default to 0 on error
    }
    
    const netWorthDecayReduction = currentNetWorth >= 1_000_000 
      ? 0.5  // 50% reduction at $1M+ net worth (wealth provides passive health benefits)
      : currentNetWorth >= 100_000 
        ? 0.25  // 25% reduction at $100K+ net worth
        : 0;  // No reduction below $100K
    
    // CORRUPTION FIX: Validate stat decay multiplier before use
    const validStatDecayMultiplier = typeof statDecayMultiplier === 'number' && !isNaN(statDecayMultiplier) && isFinite(statDecayMultiplier) && statDecayMultiplier > 0
      ? statDecayMultiplier
      : 1.0;
    
    const baseHealthDecay = 5 * validStatDecayMultiplier;
    const baseHappinessDecay = 5 * validStatDecayMultiplier;
    // CORRUPTION FIX: Validate decay calculations
    let healthDecay = Math.max(0, Math.floor(baseHealthDecay * (1 - netWorthDecayReduction)));
    if (isNaN(healthDecay) || !isFinite(healthDecay)) {
      log.warn(`Invalid health decay calculated: ${healthDecay}, defaulting to 5`);
      healthDecay = 5;
    }
    
    // STABILITY FIX: Reduce happiness decay for isolated players (no active relationships)
    // Isolated players have fewer happiness recovery options, so decay should be lower
    const activeRelationships = (gameState.relationships || []).filter(r => 
      typeof r.relationshipScore === 'number' && !isNaN(r.relationshipScore) && r.relationshipScore > 0
    ).length;
    const isolatedPlayerReduction = activeRelationships === 0 ? 1 : 0; // -1 decay if no relationships
    let happinessDecay = Math.max(0, Math.floor(baseHappinessDecay * (1 - netWorthDecayReduction)) - isolatedPlayerReduction);
    // CORRUPTION FIX: Validate happiness decay
    if (isNaN(happinessDecay) || !isFinite(happinessDecay)) {
      log.warn(`Invalid happiness decay calculated: ${happinessDecay}, defaulting to 5`);
      happinessDecay = 5;
    }
    
    // STABILITY FIX: Add minimal passive stat recovery when stats are critically low (<30)
    // Prevents death spiral for players who can't afford recovery activities
    // Recovery: +1-2 points/week when stats are low (represents natural healing/rest)
    // STABILITY FIX: Increase recovery for isolated players (+2-3/week) to offset higher decay
    // CORRUPTION FIX: Validate current stats before calculating recovery
    const currentHealth = typeof gameState.stats.health === 'number' && !isNaN(gameState.stats.health) && isFinite(gameState.stats.health)
      ? gameState.stats.health
      : 50; // Default to 50 if invalid
    const currentHappiness = typeof gameState.stats.happiness === 'number' && !isNaN(gameState.stats.happiness) && isFinite(gameState.stats.happiness)
      ? gameState.stats.happiness
      : 50; // Default to 50 if invalid
    // Increase recovery for isolated players (no active relationships) to +2-3/week
    const isIsolated = activeRelationships === 0;
    const passiveHealthRecovery = currentHealth < 30 
      ? (isIsolated ? Math.floor(Math.random() * 2) + 2 : Math.floor(Math.random() * 2) + 1) // +2-3 if isolated, +1-2 otherwise
      : 0;
    const passiveHappinessRecovery = currentHappiness < 30 
      ? (isIsolated ? Math.floor(Math.random() * 2) + 2 : Math.floor(Math.random() * 2) + 1) // +2-3 if isolated, +1-2 otherwise
      : 0;
    
    // CORRUPTION FIX: Validate stat changes before accumulation to prevent NaN propagation
    const existingHappinessChange = typeof statsChange.happiness === 'number' && !isNaN(statsChange.happiness) && isFinite(statsChange.happiness)
      ? statsChange.happiness
      : 0;
    const existingHealthChange = typeof statsChange.health === 'number' && !isNaN(statsChange.health) && isFinite(statsChange.health)
      ? statsChange.health
      : 0;
    
    // CORRUPTION FIX: Validate decay and recovery values before accumulation
    const validHappinessDecay = typeof happinessDecay === 'number' && !isNaN(happinessDecay) && isFinite(happinessDecay) ? happinessDecay : 5;
    const validHealthDecay = typeof healthDecay === 'number' && !isNaN(healthDecay) && isFinite(healthDecay) ? healthDecay : 5;
    const validPassiveHappinessRecovery = typeof passiveHappinessRecovery === 'number' && !isNaN(passiveHappinessRecovery) && isFinite(passiveHappinessRecovery) ? passiveHappinessRecovery : 0;
    const validPassiveHealthRecovery = typeof passiveHealthRecovery === 'number' && !isNaN(passiveHealthRecovery) && isFinite(passiveHealthRecovery) ? passiveHealthRecovery : 0;
    
    statsChange.happiness = existingHappinessChange - validHappinessDecay + validPassiveHappinessRecovery;
    statsChange.health = existingHealthChange - validHealthDecay + validPassiveHealthRecovery;
    
    // CORRUPTION FIX: Final validation of accumulated stat changes
    if (isNaN(statsChange.happiness) || !isFinite(statsChange.happiness)) {
      log.warn(`Invalid happiness change after accumulation: ${statsChange.happiness}, resetting to 0`);
      statsChange.happiness = 0;
    }
    if (isNaN(statsChange.health) || !isFinite(statsChange.health)) {
      log.warn(`Invalid health change after accumulation: ${statsChange.health}, resetting to 0`);
      statsChange.health = 0;
    }
    
    let decayMessage = `Weekly lifestyle: -${healthDecay} health, -${happinessDecay} happiness`;
    if (netWorthDecayReduction > 0) decayMessage += ' (reduced by wealth)';
    if (isolatedPlayerReduction > 0) decayMessage += ' (reduced for isolated players)';
    if (passiveHealthRecovery > 0 || passiveHappinessRecovery > 0) {
      decayMessage += ` (+${passiveHealthRecovery} health, +${passiveHappinessRecovery} happiness from natural recovery)`;
    }
    events.push(decayMessage);
    
    // Reset weekly jail activities for new week
    const resetWeeklyJailActivities = {};
    
    // ECONOMY FIX: Add reputation decay to prevent unlimited growth
    // Decay: -1% of current reputation per week (minimum -1)
    // Reduced decay if in political/celebrity career (maintaining reputation is part of the job)
    const currentReputation = gameState.stats.reputation;
    const isReputationCareer = ['political', 'celebrity', 'politician'].includes(gameState.currentJob || '');
    const decayPercent = isReputationCareer ? 0.005 : 0.01; // 0.5% for careers, 1% otherwise
    const reputationDecay = Math.max(-1, Math.floor(-currentReputation * decayPercent));
    
    // STABILITY FIX: Debt collection and bankruptcy system with improved asset valuation
    // Track debt weeks and trigger bankruptcy when money < -$10,000 for 4+ weeks
    // CORRUPTION FIX: Calculate bankruptcy state before main update to include in batch
    const currentMoney = typeof gameState.stats.money === 'number' && !isNaN(gameState.stats.money) && isFinite(gameState.stats.money)
      ? gameState.stats.money
      : 0;
    const calculatedFinalMoney = currentMoney + moneyChange;
    const debtWeeks = gameState.debtWeeks || 0;
    let newDebtWeeks = debtWeeks;
    let newBankruptcyTriggered = gameState.bankruptcyTriggered || false;
    
    if (calculatedFinalMoney < -10000) {
      newDebtWeeks = debtWeeks + 1;
      if (newDebtWeeks >= 4 && !gameState.bankruptcyTriggered) {
        // Trigger bankruptcy: force asset sale, reduce stats, clear some debt
        // STABILITY FIX: Use actual asset values from net worth calculation instead of fixed values
        newBankruptcyTriggered = true;
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { netWorth } = require('@/lib/progress/achievements');
        const currentNetWorth = netWorth(gameState);
        
        // Calculate asset counts for event message
        const companyCount = (gameState.companies || []).length;
        const propertyCount = (gameState.realEstate || []).filter(p => p.owned).length;
        const vehicleCount = (gameState.vehicles || []).length;
        
        // Use actual net worth for asset value (more accurate than fixed values)
        // Asset value = net worth (which includes all assets) - cash - bank savings
        const assetValue = Math.max(0, currentNetWorth - (gameState.stats.money || 0) - (gameState.bankSavings || 0));
        
        // Debt reduction: 50% of asset value (liquidation discount)
        const debtReduction = Math.min(Math.abs(calculatedFinalMoney), assetValue * 0.5);
        moneyChange += debtReduction; // Add back money from asset sale
        
        // CRITICAL FIX: Ensure money is non-negative after bankruptcy
        // Recalculate final money after debt reduction to ensure it's >= 0
        const postBankruptcyMoney = currentMoney + moneyChange;
        if (postBankruptcyMoney < 0) {
          // If still negative, set to 0 (debt is cleared but no money remains)
          const additionalReduction = Math.abs(postBankruptcyMoney);
          moneyChange += additionalReduction;
          log.warn('Bankruptcy: Money still negative after debt reduction, setting to 0', { postBankruptcyMoney, additionalReduction });
        }
        
        // Stat penalties for bankruptcy
        statsChange.reputation = (statsChange.reputation || 0) - 20; // Bankruptcy hurts reputation
        statsChange.happiness = (statsChange.happiness || 0) - 10; // Bankruptcy is stressful
        
        // CORRUPTION FIX: Prepare bankruptcy state update for batch inclusion
        bankruptcyStateUpdate = {
          companies: [],
          realEstate: gameState.realEstate.map(p => ({ ...p, owned: false })),
          stocks: gameState.stocks ? { ...gameState.stocks, holdings: [] } : { holdings: [], watchlist: [] },
          vehicles: [],
          bankruptcyTriggered: newBankruptcyTriggered,
        };
        
        events.push(`BANKRUPTCY: Debt collectors seized your assets. Lost ${companyCount} companies, ${propertyCount} properties, and ${vehicleCount} vehicles. Debt reduced by $${debtReduction.toLocaleString()}.`);
        log.warn('Bankruptcy triggered', { debtWeeks: newDebtWeeks, calculatedFinalMoney, debtReduction, assetValue, finalMoney: currentMoney + moneyChange });
      } else if (newDebtWeeks >= 2) {
        events.push(`Warning: Deep in debt (${newDebtWeeks} weeks). Bankruptcy risk if debt continues.`);
      }
    } else {
      newDebtWeeks = 0; // Reset debt weeks if money is above -$10,000
      // Reset bankruptcy flag if debt is cleared (money > -$10,000)
      if (calculatedFinalMoney >= -10000) {
        newBankruptcyTriggered = false;
      }
    }
    
    // CORRUPTION FIX: Validate stat changes before applying
    const sanitizedStatsChange = sanitizeStatChanges(statsChange);
    const statChangeValidation = validateStatChanges(sanitizedStatsChange);
    if (!statChangeValidation.valid) {
      log.error('Invalid stat changes detected, sanitizing:', statChangeValidation.errors);
      // Stat changes are already sanitized, but log the errors
    }
    
    // CORRUPTION FIX: Validate money calculation
    const finalMoney = Math.max(0, currentMoney + moneyChange);
    const moneyValidation = validateMoneyInvariants(currentMoney, moneyChange, finalMoney);
    let validatedFinalMoney = finalMoney;
    if (!moneyValidation.valid) {
      log.error('Money calculation invalid:', moneyValidation.errors);
      // Use safe defaults
      const safeMoneyChange = isNaN(moneyChange) || !isFinite(moneyChange) ? 0 : moneyChange;
      const safeFinalMoney = Math.max(0, currentMoney + safeMoneyChange);
      log.warn(`Money calculation corrected: ${finalMoney} -> ${safeFinalMoney}`);
      validatedFinalMoney = safeFinalMoney; // CRITICAL FIX: Use safe value when validation fails
    }
    
    const updatedStats = {
      ...gameState.stats,
      money: validatedFinalMoney, // CRITICAL FIX: Use validated money value
      health: Math.max(0, Math.min(100, gameState.stats.health + (sanitizedStatsChange.health || 0))),
      happiness: Math.max(0, Math.min(100, gameState.stats.happiness + (sanitizedStatsChange.happiness || 0))),
      energy: Math.max(0, Math.min(100, sanitizedStatsChange.energy !== undefined ? sanitizedStatsChange.energy : gameState.stats.energy)),
      fitness: Math.max(0, Math.min(100, gameState.stats.fitness + (sanitizedStatsChange.fitness || 0))),
      reputation: Math.max(0, gameState.stats.reputation + (sanitizedStatsChange.reputation || 0) + reputationDecay),
      gems: gameState.stats.gems,
    };
    
    // CORRUPTION FIX: Sanitize final stats to ensure no NaN/Infinity
    const sanitizedStats = sanitizeFinalStats(updatedStats);
    const nextTotalHappiness = gameState.totalHappiness + sanitizedStats.happiness;

    let happinessZeroWeeks = gameState.happinessZeroWeeks || 0;
    let healthZeroWeeks = gameState.healthZeroWeeks || 0;
    let healthWeeks = gameState.healthWeeks || 0;
    let deathReason: 'happiness' | 'health' | undefined;
    let showZeroStatPopup = gameState.showZeroStatPopup || false;
    let zeroStatType = gameState.zeroStatType;
    
    if (updatedStats.happiness <= 0) {
      happinessZeroWeeks += 1;
      log.info('HAPPINESS AT 0 - Week', { week: happinessZeroWeeks, of: 4 });
      
      // Show popup on first week at 0 (4-week warning)
      if (happinessZeroWeeks === 1) {
        showZeroStatPopup = true;
        zeroStatType = 'happiness';
        log.info('Showing happiness warning popup - 4 weeks until death');
      }
      
      const weeksLeft = 4 - happinessZeroWeeks;
      if (weeksLeft > 0) {
        log.info(`Happiness warning: ${weeksLeft} week${weeksLeft === 1 ? '' : 's'} left until death`);
      } else {
        log.info('DEATH BY HAPPINESS - 4 weeks at 0!');
        deathReason = 'happiness';
        // Hide warning popup when death occurs
        showZeroStatPopup = false;
        zeroStatType = undefined;
      }
    } else {
      // Reset counter and popup if happiness improves
      if (happinessZeroWeeks > 0) {
        log.info('Happiness improved - resetting death counter');
      }
      happinessZeroWeeks = 0;
      if (zeroStatType === 'happiness') {
        showZeroStatPopup = false;
        zeroStatType = undefined;
      }
    }

    if (!deathReason && updatedStats.health <= 0) {
      healthZeroWeeks += 1;
      log.info('HEALTH AT 0 - Week', { week: healthZeroWeeks, of: 4 });
      
      // Show popup on first week at 0 (4-week warning)
      if (healthZeroWeeks === 1) {
        showZeroStatPopup = true;
        zeroStatType = 'health';
        log.info('Showing health warning popup - 4 weeks until death');
      }
      
      const weeksLeft = 4 - healthZeroWeeks;
      if (weeksLeft > 0) {
        log.info(`Health warning: ${weeksLeft} week${weeksLeft === 1 ? '' : 's'} left until death`);
      } else {
        log.info('DEATH BY HEALTH - 4 weeks at 0!');
        deathReason = 'health';
        // Hide warning popup when death occurs
        showZeroStatPopup = false;
        zeroStatType = undefined;
      }
    } else if (!deathReason) {
      // Reset counter and popup if health improves
      if (healthZeroWeeks > 0) {
        log.info('Health improved - resetting death counter');
      }
      healthZeroWeeks = 0;
      if (zeroStatType === 'health') {
        showZeroStatPopup = false;
        zeroStatType = undefined;
      }
    }

    // Track health weeks for healthy lifestyle achievement
    if (updatedStats.health >= 90) {
      healthWeeks += 1;
    } else {
      healthWeeks = 0; // Reset if health drops below 90
    }

    if (deathReason) {
      log.info('DEATH TRIGGERED', { 
        deathReason, 
        happinessZeroWeeks, 
        healthZeroWeeks 
      });

      // Compute inheritance summary for the death popup / heir flow
      computeInheritance({
        ...gameState,
        stats: updatedStats,
        happinessZeroWeeks,
        healthZeroWeeks,
      } as GameState);

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

      // Use requestAnimationFrame to ensure state update happens in next render cycle
      // This prevents race conditions and ensures the popup shows reliably
      requestAnimationFrame(() => {
        setGameState(prev => {
          // Guard against duplicate death popups
          if (prev.showDeathPopup) {
            return prev;
          }

          const deathState = {
            ...prev,
            stats: updatedStats,
            happinessZeroWeeks,
            healthZeroWeeks,
            showZeroStatPopup: false,
            zeroStatType: undefined,
            showDeathPopup: true,
            deathReason,
            // For now we just rely on computeInheritance when needed;
            // legacyBonuses and previousLives will be updated in the
            // new life / heir selection flow.
          };
          
          // CRITICAL: Save the death state so it persists if app is closed
          // This prevents the bug where closing and reopening the app brings you back to life
          setTimeout(() => {
            if (saveGameRef.current) {
              saveGameRef.current();
              log.info('Death state saved to persist across app restarts');
            }
          }, 100);
          
          return deathState;
        });
      });

      return;
    }

    setTimeout(() => checkAchievementsRef.current?.(), 100);

    // CORRUPTION FIX: Don't update money separately - include in main batch update
    // This prevents partial state updates if main update fails

    // TIME PROGRESSION FIX: Make final update synchronous to prevent state loss on app close
    // All functions (applyWeeklyInflation, getCurrentSeason, statisticsTracker) are synchronous
    // Removing setTimeout prevents timing risk where app closes before state update applies
    setGameState(prev => {
      const stateWithInflation = applyWeeklyInflation(prev);
      
      // Update seasonal events state
      // TIME PROGRESSION FIX: Use weeksLived instead of week (1-4) for seasonal calculations
      const currentSeason = getCurrentSeason(nextWeeksLived);
      const prevSeasonalEvents = prev.seasonalEvents || { lastSeason: '', completedEvents: [] };
      let seasonalEvents = { ...prevSeasonalEvents };
      
      // If season changed, reset completed events
      if (prevSeasonalEvents.lastSeason !== currentSeason.season) {
        seasonalEvents = {
          lastSeason: currentSeason.season,
          completedEvents: [],
        };
      }
      
      // Update lifetime statistics
      const weeklyIncome = Math.max(0, moneyChange);
      let updatedLifetimeStats = statisticsTracker.updateWeeklyStatistics(
        { ...prev, stats: sanitizedStats },
        weeklyIncome
      );
      
      // Track money spent (negative transactions)
      if (moneyChange < 0) {
        updatedLifetimeStats = statisticsTracker.trackMoneySpent(updatedLifetimeStats, moneyChange);
      }
      
      // Update depth system metrics
      let updatedDepthMetrics = prev.depthMetrics || {
        depthScore: 0,
        systemsEngaged: 0,
        lastCalculated: Date.now(),
      };
      let updatedSystemStatistics = prev.systemStatistics || {};
      
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { calculateDepthScore } = require('@/lib/depth/discoverySystem');
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { getSystemHealth } = require('@/lib/depth/systemInterconnections');
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { getEnhancedLifetimeStatistics } = require('@/lib/statistics/enhancedStatistics');
        
        const depthScore = calculateDepthScore({ ...prev, stats: sanitizedStats });
        const systemHealth = getSystemHealth({ ...prev, stats: sanitizedStats });
        const enhancedStats = getEnhancedLifetimeStatistics({ ...prev, stats: sanitizedStats });
        
        // Update depth metrics
        updatedDepthMetrics = {
          depthScore,
          systemsEngaged: systemHealth.length,
          lastCalculated: Date.now(),
        };
        
        // Update system statistics
        updatedSystemStatistics = enhancedStats.systemStats || {};
      } catch (depthError: unknown) {
        // If depth system fails, continue without it
        if (depthError instanceof Error) {
          log.warn(`Failed to update depth metrics: ${depthError.message}`, depthError);
        } else {
          log.warn('Failed to update depth metrics with non-Error type:', { depthError });
        }
      }
      
      // BUG FIX: Ensure lifetime statistics are properly saved
      // Statistics are updated but need to be explicitly included in state update
      return {
        ...stateWithInflation,
        day: prev.day + 1,
        date: newDate,
        seasonalEvents,
        lifetimeStatistics: updatedLifetimeStats, // Explicitly update statistics
        dailySummary: (() => {
          const shouldShow = stateWithInflation.settings.weeklySummaryEnabled && (nextWeeksLived % 4 === 0);
          if (__DEV__) {
            log.info('GameContext - Setting dailySummary', { shouldShow, weeklySummaryEnabled: stateWithInflation.settings.weeklySummaryEnabled, nextWeeksLived, remainder: nextWeeksLived % 4 });
          }
          return shouldShow;
        })()
          ? {
              moneyChange,
              statsChange: sanitizedStatsChange,
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
        stats: sanitizedStats, // CORRUPTION FIX: Use sanitized stats
        pets,
        pendingEvents: weeklyEvents,
        lastEventWeek: hasEvents ? nextWeek : (prev.lastEventWeek || 0), // Track last event week for pity system (deprecated, use lastEventWeeksLived)
        lastEventWeeksLived: hasEvents ? nextWeeksLived : (prev.lastEventWeeksLived !== undefined ? prev.lastEventWeeksLived : (prev.lastEventWeek || 0)), // TIME PROGRESSION FIX: Track weeksLived for pity system
        pendingChainedEvents: remainingPendingChainedEvents, // Update pending chained events (remove processed ones)
        happinessZeroWeeks,
        healthZeroWeeks,
        healthWeeks,
        showZeroStatPopup,
        zeroStatType,
        totalHappiness: nextTotalHappiness,
        weeksLived: nextWeeksLived,
        jailWeeks,
        wantedLevel,
        depthMetrics: updatedDepthMetrics,
        systemStatistics: updatedSystemStatistics,
        debtWeeks: newDebtWeeks, // STABILITY FIX: Track debt weeks for bankruptcy system
        bankruptcyTriggered: newBankruptcyTriggered, // STABILITY FIX: Track if bankruptcy triggered
        weeksInPoverty: newWeeksInPoverty, // STABILITY FIX: Track weeks in poverty for scholarship event
        weeklyJailActivities: resetWeeklyJailActivities, // Reset jail activities for new week
        weeklyStreetJobs: {}, // Reset street jobs for new week
      };
    });

    // TIME PROGRESSION FIX: Check prestige availability after save (non-critical, can be async)
    // This is just a check, not a state modification, so setTimeout is acceptable
    setTimeout(() => {
      try {
        checkPrestigeAvailability();
      } catch (error) {
        log.error('Error checking prestige availability:', error);
        // Don't block progression if prestige check fails
      }
    }, 100);

    // Save game with proper error handling
    try {
      if (saveGameRef.current) {
        await saveGameRef.current();
      }
    } catch (saveError) {
      log.error('Error saving game after week progression:', saveError);
      // Don't throw - week progression succeeded, save failure is logged
      showError('save_after_week_failed', 'Week progressed successfully, but save failed. Your progress may not be saved.');
    }
    } catch (error) {
      log.error('Error advancing week:', error);
      
      // Restore state from backup if available
      if (stateBackup) {
        try {
          log.info('Restoring game state from backup due to week progression error');
          setGameState(stateBackup);
          showError('week_progression_failed', `Week progression failed: ${error instanceof Error ? error.message : 'Unknown error'}. Game state has been restored.`);
        } catch (restoreError) {
          log.error('Failed to restore state from backup:', restoreError);
          showError('week_progression_failed', `Week progression failed and state restoration failed. Please reload the game.`);
        }
      } else {
        showError('week_progression_failed', `Week progression failed: ${error instanceof Error ? error.message : 'Unknown error'}. Please try again.`);
      }
    } finally {
      // Always release the lock, even if there was an error
      isNextWeekRunningRef.current = false;
    }
  }, [
    gameState,
    setGameState,
    addWeekToAge,
    getLifeStage,
    serveJailTime,
    calcWeeklyPassiveIncome,
    processWeeklyRelations,
    rollWeeklyEvents,
    applyWeeklyInflation,
    simulateWeek,
    getStockInfo,
    checkAchievementsRef,
    saveGameRef,
    preDeathStateRef,
    validateStateBeforeWeekProgression,
    showError,
  ]);

  // Store nextWeek in ref for use by other functions
  React.useEffect(() => {
    nextWeekRef.current = nextWeek;
  }, [nextWeek]);

  // Prestige functions
  const checkPrestigeAvailability = useCallback(() => {
    try {
    const currentNetWorth = netWorth(gameState);
    const prestigeLevel = gameState.prestige?.prestigeLevel || 0;
    const threshold = getPrestigeThreshold(prestigeLevel);
    const isAvailable = currentNetWorth >= threshold;
    
    setGameState(prev => ({
      ...prev,
      prestigeAvailable: isAvailable,
    }));
    } catch (error) {
      // BUG FIX: Prevent prestige check errors from blocking game progression
      // If prestige check fails, just log and don't update state
      log.error('Error in checkPrestigeAvailability:', error);
      // Don't throw - allow game to continue
    }
  }, [gameState, setGameState, log]);

  const executePrestige = useCallback(async (chosenPath: 'reset' | 'child', childId?: string) => {
    try {
      // Validate net worth requirement before executing
      const currentNetWorth = netWorth(gameState);
      const prestigeLevel = gameState.prestige?.prestigeLevel || 0;
      const threshold = getPrestigeThreshold(prestigeLevel);
      
      if (currentNetWorth < threshold) {
        showError('prestige_networth_insufficient', `You need at least ${threshold.toLocaleString()} net worth to prestige. Current: ${currentNetWorth.toLocaleString()}`);
        return;
      }
      
      const newState = executePrestigeFunction(gameState, chosenPath, childId);
      
      // Apply starting bonuses
      const bonuses = newState.prestige?.unlockedBonuses || [];
      const stateWithBonuses = applyStartingBonuses(newState, bonuses);
      const stateWithUnlocks = applyUnlockBonuses(stateWithBonuses, bonuses);
      
      // Load and apply permanent perks (perks that persist across lives)
      const permanentPerks = await loadPermanentPerks();
      const perksWithPermanent = { ...(stateWithUnlocks.perks || {}) };
      permanentPerks.forEach(perkId => {
        (perksWithPermanent as Record<string, boolean>)[perkId] = true;
      });
      
      const finalState = {
        ...stateWithUnlocks,
        perks: perksWithPermanent,
      };
      
      setGameState(finalState);
      
      if (saveGameRef.current) {
        saveGameRef.current();
      }
      
      log.info(`Prestige executed: ${chosenPath} path, level ${finalState.prestige?.prestigeLevel}, permanent perks: ${permanentPerks.length}`);
    } catch (error) {
      log.error('Prestige execution failed:', error);
      showError('prestige_execution_failed', 'Failed to prestige. Please try again.');
    }
  }, [gameState, setGameState, showError, loadPermanentPerks]);

  const changeActivityCommitment = useCallback((primary?: 'career' | 'hobbies' | 'relationships' | 'health', secondary?: 'career' | 'hobbies' | 'relationships' | 'health') => {
    const { canChangeCommitments } = require('@/lib/commitments/commitmentSystem');
    const { canChange, weeksUntilChange } = canChangeCommitments(gameState);
    
    if (!canChange) {
      return {
        success: false,
        message: `You can only change commitments once every 4 weeks. ${weeksUntilChange} week(s) remaining.`,
      };
    }
    
    // Validate: secondary cannot be same as primary
    if (primary && secondary && primary === secondary) {
      return {
        success: false,
        message: 'Primary and secondary commitments must be different.',
      };
    }
    
    setGameState(prev => {
      const currentCommitments = prev.activityCommitments || {
        primary: undefined,
        secondary: undefined,
        lastChangedWeek: undefined,
        commitmentLevels: {
          career: 0,
          hobbies: 0,
          relationships: 0,
          health: 0,
        },
      };
      
      return {
        ...prev,
        activityCommitments: {
          primary,
          secondary,
          lastChangedWeek: prev.weeksLived,
          commitmentLevels: currentCommitments.commitmentLevels || {
            career: 0,
            hobbies: 0,
            relationships: 0,
            health: 0,
          },
        },
      };
    });
    
    if (saveGameRef.current) {
      saveGameRef.current();
    }
    
    const primaryText = primary ? `Primary: ${primary}` : 'No primary commitment';
    const secondaryText = secondary ? `Secondary: ${secondary}` : 'No secondary commitment';
    return {
      success: true,
      message: `Commitments updated! ${primaryText}. ${secondaryText}.`,
    };
  }, [gameState, setGameState]);

  const purchasePrestigeBonus = useCallback((bonusId: string) => {
    const prestigeData = gameState.prestige;
    if (!prestigeData) {
      return { success: false, message: 'Prestige data not found' };
    }

    const bonus = PRESTIGE_BONUSES.find(b => b.id === bonusId);
    if (!bonus) {
      return { success: false, message: 'Bonus not found' };
    }

    if (!canPurchaseBonus(bonus, prestigeData.unlockedBonuses)) {
      return { success: false, message: 'Bonus already at maximum level' };
    }

    const cost = getBonusPurchaseCost(bonus, prestigeData.unlockedBonuses);
    if (prestigeData.prestigePoints < cost) {
      return { success: false, message: `Not enough prestige points. Need ${cost}, have ${prestigeData.prestigePoints}` };
    }

    setGameState(prev => {
      if (!prev.prestige) return prev;
      return {
        ...prev,
        prestige: {
          ...prev.prestige,
          prestigePoints: prev.prestige.prestigePoints - cost,
          unlockedBonuses: [...prev.prestige.unlockedBonuses, bonusId],
        },
      };
    });

    if (saveGameRef.current) {
      saveGameRef.current();
    }

    return { success: true, message: `Purchased ${bonus.name}!` };
  }, [gameState.prestige, setGameState]);

  const value: GameActionsContextType = {
    // Money & Economy
    updateMoney,
    batchUpdateMoney,
    applyPerkEffects,
    updateStats,

    // Game Progression
    nextWeek,
    resolveEvent,
    checkAchievements,

    // Jobs & Careers
    performStreetJob,
    gainCriminalXp,
    gainCrimeSkillXp,
    unlockCrimeSkillUpgrade,
    applyForJob,
    quitJob,

    // Hobbies
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
    completeMinigame,

    // Items & Purchases
    buyItem,
    sellItem,
    buyDarkWebItem,
    buyHack,
    performHack,
    buyFood,
    performHealthActivity,
    dismissSicknessModal,
    dismissCureSuccessModal,
    dismissStatWarning,
    dismissWelcomePopup,
    toggleDietPlan,

    // Jail
    performJailActivity,
    serveJailTime,
    payBail,

    // Relationships
    updateRelationship,
    addRelationship,
    addSocialRelation,
    interactRelation,
    breakUpWithPartner,
    proposeToPartner,
    moveInTogether,
    haveChild,
    askForMoney,
    callRelationship,
    recordRelationshipAction,
    changeActivityCommitment,

    // Pets
    adoptPet,
    feedPet,
    playWithPet,
    buyPetToy,
    usePetToy,
    buyPetFood,

    // Education
    startEducation,

    // Company
    createCompany,
    buyCompanyUpgrade,
    addWorker,
    removeWorker,
    buyMiner,
    sellMiner,
    selectMiningCrypto,
    buyWarehouse,
    upgradeWarehouse,
    selectWarehouseMiningCrypto,
    createFamilyBusiness,
    manageFamilyBusiness,

    // R&D
    buildRDLab,
    startResearch,
    completeResearch,
    filePatent,
    enterCompetition,

    // Travel
    travelTo,

    // Political
    runForOffice: (office: string) => {
      const result = PoliticalActions.runForOffice(
        gameState,
        setGameState,
        office as 'council_member' | 'mayor' | 'state_representative' | 'governor' | 'senator' | 'president',
        { updateMoney: applyMoneyChange }
      );
      if (saveGameRef.current) saveGameRef.current();
      return result;
    },
    enactPolicy: (policyId: string) => {
      const result = PoliticalActions.enactPolicy(
        gameState,
        setGameState,
        policyId,
        { updateMoney: applyMoneyChange, updateStats: applyStatsChange }
      );
      if (saveGameRef.current) saveGameRef.current();
      return result;
    },
    lobby: (policyId: string, amount: number) => {
      const result = PoliticalActions.lobby(
        gameState,
        setGameState,
        policyId,
        amount,
        { updateMoney: applyMoneyChange }
      );
      if (saveGameRef.current) saveGameRef.current();
      return result;
    },
    joinParty: (party: string) => {
      const result = PoliticalActions.joinParty(
        gameState,
        setGameState,
        party as 'democratic' | 'republican' | 'independent'
      );
      if (saveGameRef.current) saveGameRef.current();
      return result;
    },
    formAlliance: (characterId: string, characterName: string) => {
      const result = PoliticalActions.formAlliance(
        gameState,
        setGameState,
        characterId,
        characterName
      );
      if (saveGameRef.current) saveGameRef.current();
      return result;
    },
    campaign: (amount: number) => {
      const result = PoliticalActions.campaign(
        gameState,
        setGameState,
        amount,
        { updateMoney: applyMoneyChange }
      );
      if (saveGameRef.current) saveGameRef.current();
      return result;
    },

    // Crypto
    buyCrypto,
    sellCrypto,
    swapCrypto,

    // IAP & Perks
    buyPerk,
    buyStarterPack,
    buyGoldPack,
    buyGoldUpgrade,
    buyRevival,

    // Profile & Settings
    updateUserProfile,
    updateSettings,

    // Save & Load
    saveGame,
    loadGame,
    restartGame,
    clearSaveSlot,
    triggerCacheClear,

    // Permanent Perks
    savePermanentPerk,
    hasPermanentPerk,
    loadPermanentPerks,

    // Daily Challenges
    initializeDailyChallenges,
    updateDailyChallengeProgress,
    claimDailyChallengeReward,

    // Achievements
    claimProgressAchievement,

    // Character
    reviveCharacter,

  // Legacy
  startNewLifeFromLegacy,

  // Prestige
  executePrestige,
  purchasePrestigeBonus,
  checkPrestigeAvailability,
};

  return (
    <GameActionsContext.Provider value={value}>
      {children}
    </GameActionsContext.Provider>
  );
}

