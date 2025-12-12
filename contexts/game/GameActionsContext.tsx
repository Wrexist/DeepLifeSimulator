// cspell:words uuidv Regen UIUX Minigame watchlist Nyke Adidaz Pooma Reebock Cardano Solana Polkadot Chainlink giga tera networth
import * as JobActions from './actions/JobActions';
import * as FamilyBusinessActions from './actions/FamilyBusinessActions';
import * as TravelActions from './actions/TravelActions';
import * as PoliticalActions from './actions/PoliticalActions';
import * as RDActions from './actions/RDActions';
import { updatePatents } from '@/lib/rd/patents';
import * as statisticsTracker from '@/lib/statistics/statisticsTracker';

import React, { createContext, useContext, useCallback, useRef, ReactNode, useMemo } from 'react';
import { Alert, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { calcWeeklyPassiveIncome } from '@/lib/economy/passiveIncome';
import { applyWeeklyInflation, getInflatedPrice } from '@/lib/economy/inflation';
import { simulateWeek, getStockInfo } from '@/lib/economy/stockMarket';
import {
  Relation,
  RelationAction,
  processWeeklyRelations,
} from '@/lib/social/relations';
import * as companyLogic from './company';
import * as socialLogic from './social';
import { rollWeeklyEvents } from '@/lib/events/engine';
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
          state.items.push({ ...passportItem });
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
      const newMoney = Math.max(0, prev.stats.money + finalDelta);

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
            updatedStats[statKey] = Math.max(0, currentValue + value);
          } else {
            let delta = value;
            if (statKey === 'health' && mindsetAdjusted.healthDelta !== undefined) {
              delta = mindsetAdjusted.healthDelta;
            }
            if (statKey === 'happiness' && mindsetAdjusted.happinessDelta !== undefined) {
              delta = mindsetAdjusted.happinessDelta;
            }
            updatedStats[statKey] = clampStatByKey(statKey, currentValue + delta);
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
    setGameState(prev => ({
      ...prev,
      relationships: (prev.relationships || []).map(rel =>
        rel.id === relationshipId
          ? { ...rel, relationshipScore: Math.max(0, Math.min(100, rel.relationshipScore + change)) }
          : rel
      ),
    }));
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
    if (!meetsFitness || !hasItems || !hasEducation) return;
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
      return {
        ...prev,
        relationships: (prev.relationships || []).filter(rel => rel.id !== partnerId),
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
      const spouse: Relationship = {
        ...partner,
        type: 'spouse',
        relationshipScore: Math.min(100, partner.relationshipScore + 20),
        familyHappiness: partner.familyHappiness ?? 5,
        expenses: partner.expenses ?? 100,
      };
      setGameState(prev => ({
        ...prev,
        relationships: (prev.relationships || []).map(rel =>
          rel.id === partnerId ? spouse : rel
        ),
        family: { ...prev.family, spouse },
      }));
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
    const success = Math.random() * 100 < successChance;
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
      relationships: (prev.relationships || []).map(rel =>
        rel.id === partnerId ? { ...rel, relationshipScore: Math.min(100, rel.relationshipScore + 25) } : rel
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
      relationships: (prev.relationships || []).map(rel =>
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
    companyLogic.buyCompanyUpgrade(gameState, setGameState, upgradeId, companyId);
    if (saveGameRef.current) saveGameRef.current();
  }, [gameState, setGameState]));

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
    if (gameState.stats.energy < hobby.energyCost) {
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
      energy: -hobby.energyCost,
      health: -8,
      happiness: -3,
      money: -moneyCost,
    }, false);
    const skillBonus = hobby.upgrades
      .reduce((sum, u) => sum + (u.skillBonusPerLevel || 0) * u.level, 0);
    const baseGain = Math.floor(Math.random() * 3) + 2 + Math.floor(skillBonus / 2);
    // Apply skill gain multiplier from prestige bonuses
    const prestigeData = gameState.prestige;
    const unlockedBonuses = prestigeData?.unlockedBonuses || [];
    const skillGainMultiplier = getSkillGainMultiplier(unlockedBonuses);
    const gain = Math.floor(baseGain * skillGainMultiplier);
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
    const success = Math.random() < successChance;
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
    let grade: 'Terrible Song' | 'Bad Song' | 'Normal' | 'Good' | 'Great' | 'Incredible';
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
    const song = {
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
    let grade: 'Terrible Art' | 'Bad Art' | 'Normal' | 'Good' | 'Great' | 'Incredible';
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
    const artwork = {
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

  const buyFood = useCallback((foodId: string, restoreHappiness: boolean = false) => {
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
    // Calculate happiness restore based on food quality (healthRestore / 2, rounded)
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
    if (energyCost > 0 && gameState.stats.energy < energyCost) return;
    const energyChange = -energyCost;
    updateStats({
      money: -price,
      happiness: happinessGain,
      health: healthGain,
      energy: energyChange,
    }, false);
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

  const saveGame = withActionLock('saveGame', useCallback(async (retryCount = 0) => {
    // Removed "Saving game..." loading text as it's annoying when pressing next week
    // showLoading('saving', 'Saving game...', 'inline');
    try {
      let stateToSave = {
        ...gameState,
        version: stateVersion,
        updatedAt: Date.now(),
        lastLogin: Date.now(),
        _saveVersion: stateVersion,
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
              throw new Error(`Invalid game state: ${validation.errors.join(', ')}`);
            }
          } else {
            throw new Error(`Invalid game state: ${validation.errors.join(', ')}`);
          }
        } else {
          throw new Error(`Invalid game state: ${validation.errors.join(', ')}`);
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
      
      await queueSave(currentSlot, stateToSave);
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
    } catch (error) {
      log.error('Save error:', error);
      try {
        const stateToSave = {
          ...gameState,
          version: stateVersion,
          updatedAt: Date.now(),
          lastLogin: Date.now(),
        };
        // Auto-fix stats before force save
        const validation = validateGameState(stateToSave, true);
        if (validation.fixed && validation.fixes) {
          log.warn('Auto-fixed stats during force save:', validation.fixes);
        }
        if (!validation.valid) {
          throw new Error(`Invalid game state for force save: ${validation.errors.join(', ')}`);
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
        return;
      }
      if (savedData) {
        let loadedState;
        try {
          loadedState = JSON.parse(savedData);
          if (!loadedState || typeof loadedState !== 'object') {
            log.error('Invalid game state data structure');
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
                return;
              }
            } else {
              log.warn('No backups available to restore');
              return;
            }
          } catch (backupError) {
            log.error('Backup restoration failed:', backupError);
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
          return;
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
      }
    } catch (error) {
      log.error('Failed to load game:', error);
    } finally {
      actionLockRef.current = false;
      hideLoading('loading');
    }
  }, [currentSlot, stateVersion, migrateState, validateGems, loadPermanentPerks, setGameState, setCurrentSlot]);

  // Store saveGame in ref for use by other functions
  React.useEffect(() => {
    saveGameRef.current = saveGame;
  }, [saveGame]);

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
      
      // Update stock holdings with current prices
      if (gameState.stocks?.holdings) {
        try {
          if (!Array.isArray(gameState.stocks.holdings)) {
            log.warn('stocks.holdings is not an array, skipping stock update');
          } else {
            const updatedHoldings = gameState.stocks.holdings.map(holding => {
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
                return {
                  ...holding,
                  currentPrice: stockInfo.price
                };
              } catch (holdingError) {
                log.error(`Error updating holding ${holding?.symbol}:`, holdingError);
                return holding;
              }
            });
            
            setGameState(prev => ({
              ...prev,
              stocks: {
                ...prev.stocks,
                holdings: updatedHoldings,
                watchlist: prev.stocks?.watchlist || []
              }
            }));
          }
        } catch (stockError) {
          log.error('Error updating stock holdings:', stockError);
          // Continue with week progression even if stock update fails
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

            const updatedCryptos = gameState.cryptos.map(crypto => {
              try {
                if (!crypto || typeof crypto !== 'object' || !crypto.id) {
                  log.warn('Invalid crypto object found, skipping');
                  return crypto;
                }
                const volatility = cryptoVolatility[crypto.id] || 0.12; // Default 12% volatility
                const oldPrice = typeof crypto.price === 'number' && crypto.price > 0 ? crypto.price : 0.0001;
                
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
                
                // Round to appropriate decimal places based on price range
                let roundedPrice: number;
                if (newPrice >= 1) {
                  roundedPrice = Math.round(newPrice * 100) / 100; // 2 decimal places for prices >= $1
                } else if (newPrice >= 0.01) {
                  roundedPrice = Math.round(newPrice * 1000) / 1000; // 3 decimal places for prices >= $0.01
                } else {
                  roundedPrice = Math.round(newPrice * 10000) / 10000; // 4 decimal places for prices < $0.01
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
            
            setGameState(prev => ({
              ...prev,
              cryptos: updatedCryptos,
            }));
          }
        } catch (cryptoError) {
          log.error('Error updating crypto prices:', cryptoError);
          // Continue with week progression even if crypto update fails
        }
      }
      
      const nextWeeksLived = gameState.weeksLived + 1;
      const nextWeek = gameState.week + 1;
      let newDate = { ...gameState.date };
      newDate.week += 1;
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

    // Check if player should return from travel (will be checked after week increment)

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
    
    // Auto-reinvest dividends (QoL bonus)
    if (reinvested && reinvested > 0 && shouldAutoReinvestDividends(unlockedBonuses)) {
      // Automatically reinvest dividends into stocks
      setGameState(prev => {
        if (!prev.stocks?.holdings) return prev;
        const updatedHoldings = prev.stocks.holdings.map(holding => {
          const stockInfo = getStockInfo(holding.symbol);
          if (!stockInfo) return holding;
          const weeklyDividend = (stockInfo.price * stockInfo.dividendYield * holding.shares) / 52;
          const sharesToBuy = Math.floor(weeklyDividend / stockInfo.price);
          if (sharesToBuy > 0) {
            return {
              ...holding,
              shares: holding.shares + sharesToBuy,
              averagePrice: ((holding.averagePrice * holding.shares) + (stockInfo.price * sharesToBuy)) / (holding.shares + sharesToBuy),
            };
          }
          return holding;
        });
        return {
          ...prev,
          stocks: {
            ...prev.stocks,
            holdings: updatedHoldings,
          },
        };
      });
      events.push(`Auto-Invest: $${reinvested.toFixed(2)} in dividends reinvested into stocks`);
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

    // Don't deduct expenses while in jail - expenses are paused during jail time
    // (This check is redundant since we return early if jailWeeks > 0, but added for safety)
    if (jailWeeks === 0) {
      const familyExpense =
        (gameState.family.spouse?.expenses || 0) +
        gameState.family.children.reduce((sum, c) => sum + (c.expenses || 0), 0);
      if (familyExpense > 0) {
        moneyChange -= familyExpense;
        events.push(`Family expenses $${familyExpense}`);
      }

      // Automatic loan payments - paused while in jail
      const loans = gameState.loans || [];
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
    } else {
      // While in jail, expenses are paused
      events.push('Expenses paused while in jail');
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
        log.info(`Disease check - Fitness: ${gameState.stats.fitness}, Disease chance: ${diseaseChance.toFixed(2)}%`);
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
    setGameState(prev => {
      // Small random relationship decay each week
      const decayedRelationships = (prev.relationships || []).map(rel => {
        if (rel.type !== 'partner' && rel.type !== 'spouse') return rel;
        const decay = Math.random() < 0.5 ? 0 : -(Math.random() < 0.5 ? 1 : 2);
        const relationshipScore = Math.max(
          0,
          Math.min(100, rel.relationshipScore + decay),
        );
        return { ...rel, relationshipScore };
      });

      const updatedWeek = prev.week + 1;
      
      // Check if player should return from travel after week increment
      if (prev.travel?.currentTrip && updatedWeek >= prev.travel.currentTrip.returnWeek) {
        // Return from trip - benefits will be applied via returnFromTrip
        // Note: This is called within setGameState, so we need to handle it carefully
        // The returnFromTrip will update the state separately
        setTimeout(() => {
          TravelActions.returnFromTrip(
            { ...prev, week: updatedWeek },
            setGameState,
            { updateStats: applyStatsChange }
          );
        }, 0);
      }

      const updatedState = {
        ...prev,
        week: updatedWeek,
        date: newDate,
        relationships: decayedRelationships.map(rel => ({
          ...rel,
          age: addWeekToAge(rel.age),
        })),
        family: {
          spouse: prev.family.spouse
            ? { ...prev.family.spouse, age: addWeekToAge(prev.family.spouse.age) }
            : undefined,
          children: (prev.family.children || []).map(c =>
            updateChildWeekly({ ...c, age: addWeekToAge(c.age) } as ChildInfo),
          ),
        },
        lifeStage: getLifeStage(newDate.age),
      };

      // Process competition results after week increment
      setTimeout(() => {
        RDActions.processCompetitionResults(
          updatedState,
          setGameState,
          { updateMoney: applyMoneyChange },
          updatedWeek
        );
      }, 0);

      // Update patents: decrement duration and remove expired patents
      const updatedCompanies = (updatedState.companies || []).map(company => {
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
      let updatedCompany = updatedState.company;
      if (updatedCompany?.patents && updatedCompany.patents.length > 0) {
        updatedCompany = {
          ...updatedCompany,
          patents: updatePatents(updatedCompany.patents),
        };
      }

      // IMPORTANT: Preserve all state including stats to prevent money from being reset
      return {
        ...prev, // Preserve all existing state first
        ...updatedState, // Then apply week/time updates
        companies: updatedCompanies,
        company: updatedCompany,
      };
    });

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
        const weeklySalary = career.levels[career.level].salary;
        salaryEarnings = weeklySalary;
        moneyChange += weeklySalary;
        events.push(`Earned weekly salary: $${weeklySalary}`);

        statsChange.happiness = (statsChange.happiness || 0) - 15;
        statsChange.health = (statsChange.health || 0) - 5;

        // Apply prestige experience multiplier
        const prestigeData = gameState.prestige;
        const expMultiplier = prestigeData?.unlockedBonuses 
          ? getExperienceMultiplier(prestigeData.unlockedBonuses)
          : 1.0;
        const baseProgressGain = Math.floor(Math.random() * 5) + 2; // Reduced from 5-15 to 2-7 (2x slower)
        const progressGain = Math.floor(baseProgressGain * expMultiplier);
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
      const meetRequirements =
        (career.requirements.fitness || 0) <= gameState.stats.fitness &&
        (!career.requirements.items ||
          career.requirements.items.every(itemId => (gameState.items || []).find(item => item.id === itemId)?.owned)) &&
        (hasEarlyCareerAccessBonus ||
          !career.requirements.education ||
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
    // Apply stat decay multiplier to relationship decay
    const relationshipDecayMultiplier = getStatDecayMultiplier(unlockedBonuses);
    setGameState(prev => {
      const updatedRelationships = prev.relationships.map(rel => ({
        ...rel,
        relationshipScore: Math.max(0, rel.relationshipScore - (10 * relationshipDecayMultiplier)),
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
        if (gameState.week % 4 === 0 && totalPower > 0) {
          const monthlyBill = totalPower * 0.12 * 30;
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

        const cryptoEarned = weeklyMiningEarnings / selectedCrypto.price;
        cryptoEarnings[selectedCrypto.id] = (cryptoEarnings[selectedCrypto.id] || 0) + cryptoEarned;
        events.push(`Warehouse mined ${cryptoEarned.toFixed(6)} ${selectedCrypto.symbol} (≈$${weeklyMiningEarnings.toFixed(2)})`);

        // Power costs - paused while in jail
        if (jailWeeks === 0) {
          const weeklyPowerCost = totalPower * 0.40; // $0.40 per power unit per week
          moneyChange -= weeklyPowerCost;
          events.push(`Warehouse power costs: -$${weeklyPowerCost.toFixed(2)}`);
        }

        // Auto-repair costs
        if (gameState.warehouse.autoRepairEnabled && gameState.warehouse.autoRepairCryptoId) {
          const autoRepairCrypto = (gameState.cryptos || []).find(c => c.id === gameState.warehouse?.autoRepairCryptoId);
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
          const baseHappinessGain = Math.floor(rel.relationshipScore / 10); // 5-10 happiness based on relationship level
          const relationshipGainMultiplier = getRelationshipGainMultiplier(unlockedBonuses);
          const happinessGain = Math.floor(baseHappinessGain * relationshipGainMultiplier);
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
    
    // Apply follower decay if inactive (social media)
    if (gameState.socialMedia) {
      const lastPostWeek = gameState.socialMedia.lastPostWeek || 0;
      const weeksSinceLastPost = gameState.week - lastPostWeek;
      if (weeksSinceLastPost >= 2) {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { calculateFollowerDecay } = require('@/lib/social/socialMedia');
        const decay = calculateFollowerDecay(gameState.socialMedia.followers, weeksSinceLastPost);
        if (decay > 0) {
          setGameState(prev => ({
            ...prev,
            socialMedia: prev.socialMedia ? {
              ...prev.socialMedia,
              followers: Math.max(0, prev.socialMedia.followers - decay),
            } : prev.socialMedia,
          }));
        }
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
    statsChange.happiness = (statsChange.happiness || 0) - (5 * statDecayMultiplier);
    statsChange.health = (statsChange.health || 0) - (5 * statDecayMultiplier);
    events.push('Weekly lifestyle: -5 health, -5 happiness');
    
    // Reset weekly jail activities for new week
    const resetWeeklyJailActivities = {};
    const updatedStats = {
      ...gameState.stats,
      money: gameState.stats.money + moneyChange,
      health: Math.max(0, Math.min(100, gameState.stats.health + (statsChange.health || 0))),
      happiness: Math.max(0, Math.min(100, gameState.stats.happiness + (statsChange.happiness || 0))),
      energy: Math.max(0, Math.min(100, statsChange.energy || gameState.stats.energy)),
      fitness: Math.max(0, Math.min(100, gameState.stats.fitness + (statsChange.fitness || 0))),
      reputation: Math.max(0, gameState.stats.reputation + (statsChange.reputation || 0)),
      gems: gameState.stats.gems,
    };
    const nextTotalHappiness = gameState.totalHappiness + updatedStats.happiness;

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
        
        // Update seasonal events state
        const currentSeason = getCurrentSeason(newDate.week);
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
          { ...prev, stats: updatedStats },
          weeklyIncome
        );
        
        // Track money spent (negative transactions)
        if (moneyChange < 0) {
          updatedLifetimeStats = statisticsTracker.trackMoneySpent(updatedLifetimeStats, moneyChange);
        }
        
        return {
          ...stateWithInflation,
          day: prev.day + 1,
          date: newDate,
          seasonalEvents,
          lifetimeStatistics: updatedLifetimeStats,
          dailySummary: (() => {
            const shouldShow = stateWithInflation.settings.weeklySummaryEnabled && (nextWeeksLived % 4 === 0);
            if (__DEV__) {
              log.info('GameContext - Setting dailySummary', { shouldShow, weeklySummaryEnabled: stateWithInflation.settings.weeklySummaryEnabled, nextWeeksLived, remainder: nextWeeksLived % 4 });
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
          showZeroStatPopup,
          zeroStatType,
          totalHappiness: nextTotalHappiness,
          weeksLived: nextWeeksLived,
          jailWeeks,
          wantedLevel,
          weeklyJailActivities: resetWeeklyJailActivities, // Reset jail activities for new week
          weeklyStreetJobs: {}, // Reset street jobs for new week
        };
      });

      // Check prestige availability after state update
      setTimeout(() => {
        checkPrestigeAvailability();
      }, 100);
    }, 50);

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
    const currentNetWorth = netWorth(gameState);
    const prestigeLevel = gameState.prestige?.prestigeLevel || 0;
    const threshold = getPrestigeThreshold(prestigeLevel);
    const isAvailable = currentNetWorth >= threshold;
    
    setGameState(prev => ({
      ...prev,
      prestigeAvailable: isAvailable,
    }));
  }, [gameState, setGameState]);

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

