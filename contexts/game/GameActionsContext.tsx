// cspell:words uuidv Regen UIUX Minigame watchlist Nyke Adidaz Pooma Reebock Cardano Solana Polkadot Chainlink giga tera networth
// NOTE: Actions have been split into focused context files to reduce bundle size and improve maintainability:
// - MoneyActionsContext: money, economy, IAP, crypto
// - JobActionsContext: jobs, careers, criminal activities, jail
// - ItemActionsContext: items, purchases, hobbies, food
// - SocialActionsContext: relationships, dating, family

import React, { createContext, useContext, useCallback, ReactNode, useRef, useEffect, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, AppStateStatus } from 'react-native';
import { logger } from '@/utils/logger';
import { useGameState } from './GameStateContext';
import { useGameData } from './GameDataContext';
import { useGameUI } from './GameUIContext';
import { useMoneyActions } from './MoneyActionsContext';
import { useUIUX } from '@/contexts/UIUXContext';
import { evaluateAchievements } from '@/lib/progress/achievements';
import { GameState, GameStats, Relationship, ChildInfo } from './types';
import { getStatDecayMultiplier } from '@/lib/prestige/applyBonuses';
import { calcWeeklyPassiveIncome } from '@/lib/economy/passiveIncome';
import { simulateWeek, getStockPricesSnapshot } from '@/lib/economy/stockMarket';
import { repairGameState, validateGameState } from '@/utils/saveValidation';
import { validateRelationshipState, repairRelationshipState } from '@/utils/relationshipValidation';
import { clampRelationshipScore } from '@/utils/stateValidation';
import { clampStatByKey } from '@/utils/statUtils';
import { initialGameState } from './initialState';
import { fileDivorce } from './actions/DatingActions';
import { queueSave, forceSave } from '@/utils/saveQueue';
import { haptic } from '@/utils/haptics';
import { createBackupFromState } from '@/utils/saveBackup';
import { saveLoadMutex } from '@/utils/saveLoadMutex';
import { executePrestige as executePrestigeFunction } from '@/lib/prestige/prestigeExecution';
import { updateMoney as updateMoneyAction } from './actions/MoneyActions';
import { updateStats as updateStatsAction } from './actions/StatsActions';
import {
  PLAYER_RENT_RATE_WEEKLY,
  SAVINGS_APR_BASE,
  SAVINGS_APR_FINANCIAL_PLANNING,
  LOAN_MISSED_PAYMENT_PENALTY,
  SAVINGS_BALANCE_SOFT_CAP,
  SAVINGS_CAP_EFFICIENCY,
  MINER_PRICES,
  calculateIncomeTax,
} from '@/lib/economy/constants';
import {
  WEEKS_PER_YEAR,
  ADULTHOOD_AGE,
  PREGNANCY_DURATION_WEEKS,
  BANKRUPTCY_FLOOR,
  PET_LIFESPANS,
  VEHICLE_WEEKLY_MILEAGE,
  VEHICLE_WEEKLY_CONDITION_DECAY,
  VEHICLE_ACCIDENT_BASE_CHANCE,
  VEHICLE_ACCIDENT_POOR_CONDITION_CHANCE,
} from '@/lib/config/gameConstants';

// Helper function to calculate net worth for stat decay
// CRITICAL: Validates all inputs to prevent NaN/Infinity propagation
function calculateNetWorth(gameState: GameState): number {
  try {
    // Validate and sanitize money
    const money = typeof gameState.stats?.money === 'number' && isFinite(gameState.stats.money)
      ? gameState.stats.money
      : 0;
    let netWorth = Math.max(0, money);

    // Add bank savings (validate)
    const bankSavings = typeof gameState.bankSavings === 'number' && isFinite(gameState.bankSavings)
      ? gameState.bankSavings
      : 0;
    netWorth += Math.max(0, bankSavings);

    // Add stock value (validate each holding)
    if (gameState.stocks?.holdings && Array.isArray(gameState.stocks.holdings)) {
      const stockValue = gameState.stocks.holdings.reduce((total, holding) => {
        if (!holding) return total;
        const shares = typeof holding.shares === 'number' && isFinite(holding.shares) && holding.shares >= 0
          ? holding.shares
          : 0;
        const price = typeof holding.currentPrice === 'number' && isFinite(holding.currentPrice) && holding.currentPrice >= 0
          ? holding.currentPrice
          : 0;
        const value = shares * price;
        // Prevent overflow
        return isFinite(value) ? total + value : total;
      }, 0);
      netWorth += Math.max(0, stockValue);
    }

    // Add property values (validate each property)
    if (gameState.realEstate && Array.isArray(gameState.realEstate)) {
      gameState.realEstate.forEach((property) => {
        if (property && typeof property.price === 'number' && isFinite(property.price) && property.price >= 0) {
          netWorth += property.price;
        }
      });
    }

    // Add vehicle values (validate each vehicle)
    if (gameState.vehicles && Array.isArray(gameState.vehicles)) {
      gameState.vehicles.forEach(vehicle => {
        if (vehicle && typeof vehicle.price === 'number' && isFinite(vehicle.price) && vehicle.price >= 0) {
          netWorth += vehicle.price;
        }
      });
    }

    // Add company values (based on weekly income valuation - standard is 10x weekly income)
    if (gameState.companies && Array.isArray(gameState.companies)) {
      gameState.companies.forEach((company) => {
        if (company && typeof company.weeklyIncome === 'number' && isFinite(company.weeklyIncome) && company.weeklyIncome > 0) {
          // Value companies at 10x weekly income (standard business valuation)
          const companyValue = company.weeklyIncome * 10;
          if (isFinite(companyValue)) {
            netWorth += companyValue;
          }
        }
      });
    }

    // Add warehouse value and miners
    if (gameState.warehouse) {
      const warehouseBaseValue = 50000; // Base warehouse cost
      const warehouseValue = warehouseBaseValue * (gameState.warehouse.level || 1);
      if (isFinite(warehouseValue)) {
        netWorth += warehouseValue;
      }

      // Add miner values in warehouse
      if (gameState.warehouse.miners) {
        Object.entries(gameState.warehouse.miners).forEach(([minerId, count]) => {
          const price = MINER_PRICES[minerId];
          if (price && typeof count === 'number' && count > 0 && isFinite(count)) {
            const minerValue = price * count;
            if (isFinite(minerValue)) {
              netWorth += minerValue;
            }
          }
        });
      }
    }

    // Add crypto holdings value
    if (gameState.cryptos && Array.isArray(gameState.cryptos)) {
      gameState.cryptos.forEach((crypto) => {
        if (crypto && typeof crypto.owned === 'number' && typeof crypto.price === 'number') {
          const owned = isFinite(crypto.owned) && crypto.owned > 0 ? crypto.owned : 0;
          const price = isFinite(crypto.price) && crypto.price > 0 ? crypto.price : 0;
          const cryptoValue = owned * price;
          if (isFinite(cryptoValue)) {
            netWorth += cryptoValue;
          }
        }
      });
    }

    // Add owned items value
    if (gameState.items && Array.isArray(gameState.items)) {
      gameState.items.forEach((item) => {
        if (item && item.owned && typeof item.price === 'number' && isFinite(item.price) && item.price >= 0) {
          netWorth += item.price;
        }
      });
    }

    // Final validation - ensure result is finite and non-negative
    const finalNetWorth = isFinite(netWorth) ? Math.max(0, netWorth) : 0;

    // Log warning if calculation produced invalid result
    if (!isFinite(netWorth) || netWorth < 0) {
      logger.warn('[calculateNetWorth] Invalid net worth calculated, using 0:', { netWorth, money, bankSavings });
    }

    return finalNetWorth;
  } catch (error) {
    logger.error('[calculateNetWorth] Error calculating net worth:', error);
    return 0; // Safe fallback
  }
}

interface GameActionsContextType {
  // Core Game Progression
  nextWeek: () => void;
  resolveEvent: (eventId: string, choiceId: string) => void;
  checkAchievements: (state?: GameState) => void;
  claimProgressAchievement: (achievementId: string, goldReward: number) => void;

  // Core Stats Management
  updateStats: (newStats: Partial<GameStats>, updateDailySummary?: boolean) => void;
  updateMoney: (amount: number, reason: string, updateDailySummary?: boolean) => void;

  // Relationship Management
  updateRelationship: (relationshipId: string, change: number) => void;
  recordRelationshipAction: (relationshipId: string, action: string) => void;
  breakUpWithPartner: (partnerId: string) => { success: boolean; message: string } | void;
  proposeToPartner: (partnerId: string) => { success: boolean; message: string } | void;
  moveInTogether: (partnerId: string) => { success: boolean; message: string } | void;
  fileDivorce: (spouseId: string, lawyerId?: string) => { success: boolean; message: string; settlement?: number; lawyerResult?: any } | void;

  // Save & Load (core functionality)
  saveGame: (force?: boolean) => Promise<void>;
  loadGame: (slot: number) => Promise<GameState | null>;

  // Permanent Perks
  savePermanentPerk: (perkId: string) => Promise<void>;
  hasPermanentPerk: (perkId: string) => Promise<boolean>;

  // Prestige
  executePrestige: (chosenPath: 'reset' | 'child', childId?: string) => void;
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

export function GameActionsProvider({ children }: GameActionsProviderProps) {
  const { gameState, setGameState, currentSlot } = useGameState();
  const { initialState } = useGameData();
  const { setIsLoading, setLoadingProgress, setLoadingMessage } = useGameUI();
  const { updateMoney } = useMoneyActions();
  const { showError, showWarning } = useUIUX();

  // Refs for AppState listener (prevents stale closures)
  const gameStateRef = useRef<GameState | null>(null);
  const isSavingRef = useRef(false);
  const saveGameRef = useRef<((force?: boolean) => Promise<void>) | null>(null);

  // Save & Load Actions - MOVED BEFORE nextWeek TO FIX HOISTING
  const saveGame = useCallback(async (force: boolean = false): Promise<void> => {
    // Use ref to get current state (prevents stale closure)
    const currentState = gameStateRef.current;
    if (!currentState) {
      logger.warn('Cannot save: game state is null');
      return;
    }
    await saveLoadMutex.acquire('save');
    try {
      // CRITICAL: Validate state before saving to prevent saving corrupted state
      const validation = validateGameState(currentState, true); // Auto-fix if possible
      if (!validation.valid) {
        logger.error('[SAVE] Cannot save: state validation failed:', validation.errors);
        // Attempt repair
        const repairResult = repairGameState(currentState);
        if (repairResult.repaired) {
          logger.warn('[SAVE] Repaired corrupted state before save:', repairResult.repairs);
          // Update state with repaired version before saving
          // repairGameState mutates in-place; spread to create new reference for React
          setGameState(prev => {
            const result = repairGameState(prev);
            return result.repaired ? { ...prev } : prev;
          });
          // Re-validate after repair
          const revalidation = validateGameState(gameStateRef.current, false);
          if (!revalidation.valid) {
            logger.error('[SAVE] State still invalid after repair, aborting save');
            showError('Save Error', 'Game state is corrupted and could not be repaired. Please reload your save.');
            return;
          }
        } else {
          logger.error('[SAVE] State corruption detected and could not be repaired, aborting save');
          showError('Save Error', 'Game state is corrupted and could not be saved. Please reload your save.');
          return;
        }
      }

      // Validate and repair relationship graph before persisting.
      const relationshipValidation = validateRelationshipState(currentState);
      const stateToPersist = relationshipValidation.isValid
        ? currentState
        : repairRelationshipState(currentState);
      if (!relationshipValidation.isValid) {
        logger.warn('[SAVE] Repaired relationship inconsistencies before save', {
          issues: relationshipValidation.issues,
        });
      }

      // Create backup before save (non-blocking)
      const slotToUse = (currentSlot >= 1 && currentSlot <= 3) ? currentSlot : 1;

      // Create backup before save (with timeout to prevent blocking)
      try {
        await Promise.race([
          createBackupFromState(slotToUse, stateToPersist, 'auto_save'),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Backup timeout')), 5000)
          )
        ]);
        logger.debug('Backup created successfully before save');
      } catch (err) {
        // Log warning but continue with save (backup failure is non-critical)
        logger.warn('Backup creation failed or timed out (non-critical):', { error: err });
      }

      // Prepare game data with metadata (use captured state)
      const gameData = {
        ...stateToPersist,
        lastSaved: new Date().toISOString(),
        updatedAt: Date.now(),
        version: initialState.version || 1,
      };

      // Use save queue (handles atomic save, retries, quota)
      if (force) {
        await forceSave(slotToUse, gameData);
      } else {
        await queueSave(slotToUse, gameData);
      }

      logger.info('Game save queued successfully', { slot: slotToUse });
    } catch (error) {
      logger.error('Failed to queue save:', error);
      showError('Save Error', 'Failed to save game progress. Will retry automatically.');
    } finally {
      saveLoadMutex.release();
    }
  }, [currentSlot, initialState.version, showError]);

  // ANTI-EXPLOIT: Guard against rapid nextWeek() calls (race condition)
  const nextWeekInProgressRef = useRef(false);

  // Core Game Progression Actions
  const nextWeek = useCallback(async () => {
    const gameState = gameStateRef.current;
    if (!gameState) return;
    // ANTI-EXPLOIT: Prevent concurrent week advances from rapid button mashing
    if (nextWeekInProgressRef.current) return;
    nextWeekInProgressRef.current = true;

    haptic.medium(); // Tactile tick for week advance
    setIsLoading(true);
    setLoadingMessage('Progressing to next week...');
    setLoadingProgress(0);

    try {
      // Calculate natural stat changes based on wealth and prestige bonuses
      const statDecayRate = 4; // Base decay rate
      const prestigeMultiplier = getStatDecayMultiplier(gameState.prestige?.unlockedBonuses || []);

      // Calculate effective decay rate (lower for wealthier players)
      // CRITICAL: Validate netWorth to prevent division by zero or NaN
      let netWorth = 1000;
      try {
        netWorth = calculateNetWorth(gameState);
      } catch (nwError) {
        logger.error('[WEEK PROGRESSION] Failed to calculate net worth:', nwError);
      }
      // Ensure netWorth is valid and > 0 to prevent division issues
      const safeNetWorth = isFinite(netWorth) && netWorth > 0 ? netWorth : 1000;
      // Division is safe: Math.max(1000, safeNetWorth) ensures denominator >= 1000
      const wealthMultiplier = Math.max(0.5, Math.min(2.0, 100000 / Math.max(1000, safeNetWorth)));
      // Validate multipliers before multiplication
      const safePrestigeMultiplier = isFinite(prestigeMultiplier) && prestigeMultiplier > 0 ? prestigeMultiplier : 1;
      let effectiveDecayRate = statDecayRate * wealthMultiplier * safePrestigeMultiplier;

      // ENGAGEMENT: Early game grace period — reduce stat decay weeks 0-8
      // This prevents new players from feeling punished before they understand the game
      const GRACE_PERIOD_WEEKS = 8;
      const currentWeeks = typeof gameState.weeksLived === 'number' ? gameState.weeksLived : 0;
      const graceFactor = Math.min(1.0, currentWeeks / GRACE_PERIOD_WEEKS);
      effectiveDecayRate = effectiveDecayRate * (0.25 + 0.75 * graceFactor);
      // Week 0: 25% decay, Week 4: 62.5% decay, Week 8+: 100% decay

      // Final validation of decay rate - use safe default if invalid
      if (!isFinite(effectiveDecayRate) || effectiveDecayRate < 0) {
        logger.error('[WEEK PROGRESSION] Invalid effectiveDecayRate calculated, using default:', { effectiveDecayRate, netWorth, wealthMultiplier, prestigeMultiplier });
        effectiveDecayRate = 4; // Safe default
      }

      logger.info(`[WEEK PROGRESSION] Net worth: $${netWorth}, Decay rate: ${effectiveDecayRate}, Grace factor: ${graceFactor.toFixed(2)}, Prestige multiplier: ${prestigeMultiplier}`);

      // CRITICAL: Simulate stock market price changes for the week
      // ANTI-EXPLOIT: Pass weeksLived so seeded PRNG produces deterministic prices per week
      // This prevents save/reload manipulation of stock prices
      try {
        // Get policy effects if available
        const policyEffects = gameState.politics?.activePolicyEffects?.stocks;
        const currentWeeksLived = typeof gameState.weeksLived === 'number' ? gameState.weeksLived : 0;
        simulateWeek(policyEffects, currentWeeksLived);
      } catch (simError) {
        logger.error('[WEEK PROGRESSION] Stock market simulation failed:', simError);
        // Continue progression even if stock sim fails
      }

      // CRITICAL: Get updated stock prices after simulation
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { getStockInfo } = require('@/lib/economy/stockMarket');

      // Track if death was triggered during state update
      let deathTriggered = false;
      let stateUpdateError: Error | null = null;

      // PERF FIX: Collect notifications during week progression and flush them in a single
      // setTimeout afterward. Previously, each notification was its own setTimeout inside
      // setGameState, accumulating hundreds of pending callbacks over 5-10 minutes of play.
      const pendingNotifications: Array<{ id: string; message: string; title: string }> = [];

      // PRE-ROLLS: Extract all Math.random() calls outside the updater so that
      // React StrictMode double-invocation produces identical results both times.
      const preRolls = {
        // Career application acceptance delay (1 or 2 weeks)
        careerAcceptDelay: Math.random() < 0.5 ? 1 : 2,
        // Auto-reinvest stock pick
        stockPickRoll: Math.random(),
        // Child birth
        childGender: Math.random() < 0.5 ? 'male' as const : 'female' as const,
        childIdSuffix: Math.random().toString(36).slice(2, 8),
        childPersonality: Math.floor(Math.random() * 5),
        // Relationship breakup/disappointment (one pair per relationship, max 20)
        relBreakup: Array.from({ length: 20 }, () => Math.random()),
        relDisappointed: Array.from({ length: 20 }, () => Math.random()),
        // Police encounter
        policeEncounter: Math.random(),
        // Miner durability degradation (2-5% per week)
        minerDegradation: 2 + Math.random() * 3,
        // Disease complications (one set per disease, max 20)
        diseaseComplication: Array.from({ length: 20 }, () => Math.random()),
        diseaseProgression: Array.from({ length: 20 }, () => Math.random()),
        // Pet sickness (one pair per pet, max 10)
        petSickness: Array.from({ length: 10 }, () => Math.random()),
        petSicknessType: Array.from({ length: 10 }, () => Math.random()),
        // Vehicle accidents (one pair per vehicle, max 10)
        vehicleAccident: Array.from({ length: 10 }, () => Math.random()),
        vehicleAccidentSeverity: Array.from({ length: 10 }, () => Math.random()),
        // Timestamps (Date.now() is impure under StrictMode double-invoke)
        timestamp: Date.now(),
      };

      setGameState(prevState => {
        // CRITICAL: Wrap entire state update in try-catch to prevent silent failures
        try {
          const currentWeeksLived = typeof prevState.weeksLived === 'number' && !isNaN(prevState.weeksLived) && prevState.weeksLived >= 0
            ? prevState.weeksLived
            : 0;
          const nextWeeksLived = currentWeeksLived + 1;
          // Keep week as UI-only week-of-month. Absolute time is weeksLived.
          const nextWeek = ((nextWeeksLived % 4) + 1);

          const currentAge = typeof prevState.date?.age === 'number' && !isNaN(prevState.date.age) && isFinite(prevState.date.age) && prevState.date.age >= 0
            ? prevState.date.age
            : 18; // Default age
          const nextAge = currentAge + (1 / WEEKS_PER_YEAR);

          const currentYear = typeof prevState.date?.year === 'number' && !isNaN(prevState.date.year) && isFinite(prevState.date.year) && prevState.date.year > 0
            ? prevState.date.year
            : 2025; // Default year
          const baseYear = currentYear - Math.floor(currentWeeksLived / WEEKS_PER_YEAR);
          const nextYear = baseYear + Math.floor(nextWeeksLived / WEEKS_PER_YEAR);

          // Convert month to number for calculation (handles both string and number formats)
          const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
          const getMonthNumber = (month: string | number): number => {
            if (typeof month === 'number') return month;
            const monthMap: Record<string, number> = {
              'January': 1, 'February': 2, 'March': 3, 'April': 4,
              'May': 5, 'June': 6, 'July': 7, 'August': 8,
              'September': 9, 'October': 10, 'November': 11, 'December': 12
            };
            return monthMap[month] || 1;
          };
          const currentMonthNum = getMonthNumber(prevState.date?.month || 'January');
          const weeksPerMonth = WEEKS_PER_YEAR / 12;
          const baseMonthIndex = currentMonthNum - 1 - Math.floor(currentWeeksLived / weeksPerMonth);
          const monthsElapsed = Math.floor(nextWeeksLived / weeksPerMonth);
          const nextMonthNum = ((((baseMonthIndex + monthsElapsed) % 12) + 12) % 12) + 1;
          const nextMonth = monthNames[nextMonthNum - 1] || 'January';
          // Process consequence progression (NEW - activates delayed consequences)
          const { processConsequenceProgression, initializeConsequenceState } = require('@/lib/lifeMoments/consequenceTracker');

          let mergedConsequenceState;
          try {
            const updatedConsequenceState = processConsequenceProgression(prevState);

            // Merge with existing consequence state
            const currentConsequenceState = initializeConsequenceState(prevState);
            mergedConsequenceState = {
              ...currentConsequenceState,
              ...updatedConsequenceState,
            };
          } catch (consequenceError) {
            logger.error('[WEEK PROGRESSION] Consequence progression failed:', consequenceError);
            mergedConsequenceState = prevState.consequenceState || initializeConsequenceState(prevState);
          }

          // Migrate old saves to new consequence system (NEW)
          if (!prevState.consequenceState) {
            // Already initialized above via initializeConsequenceState
          }

          // Initialize lifeMoments if missing (use local var — never mutate prevState)
          const lifeMoments = prevState.lifeMoments ?? {
            lastMomentWeek: 0,
            momentsThisWeek: 0,
            totalMoments: 0,
            pendingMoment: undefined,
          };

          // Apply natural stat changes over time
          const currentMoney = typeof prevState.stats?.money === 'number' && !isNaN(prevState.stats.money)
            ? prevState.stats.money
            : 0;
          const newStats = {
            ...prevState.stats,
            money: currentMoney, // Ensure money starts with valid value
          };

          // Energy REGAINS when advancing weeks (like sleeping/resting)
          // BUG FIX: Apply prestige energy regen multiplier
          // CRITICAL FIX: Don't cap regen early - apply full regen, then penalties, then cap to 100
          const baseEnergyRegen = 30; // Base regain per week
          const unlockedBonuses = prevState.prestige?.unlockedBonuses || [];
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          const { getEnergyRegenMultiplier } = require('@/lib/prestige/applyBonuses');
          const energyRegenMultiplier = getEnergyRegenMultiplier(unlockedBonuses);
          const safeEnergyRegenMultiplier = typeof energyRegenMultiplier === 'number' && isFinite(energyRegenMultiplier) && energyRegenMultiplier > 0 ? energyRegenMultiplier : 1.0;
          const energyRegen = Math.round(baseEnergyRegen * safeEnergyRegenMultiplier); // Full regen amount (don't cap here)
          // Apply regen - allow it to go above 100 temporarily (will be capped after penalties)
          newStats.energy = (newStats.energy || 0) + energyRegen;

          // Health and happiness decay over time if not maintained (increased decay rates)
          newStats.health = Math.max(0, (newStats.health || 0) - effectiveDecayRate * 0.6);
          newStats.happiness = Math.max(0, (newStats.happiness || 0) - effectiveDecayRate * 0.8);

          // Fitness decay: increases the longer you don't visit the gym
          const lastGymVisitWeek = prevState.lastGymVisitWeek || 0;
          const weeksSinceLastGym = nextWeeksLived - lastGymVisitWeek;

          // Base natural aging decay
          let fitnessDecay = effectiveDecayRate * 0.2;

          // Accelerated decay if not going to gym
          if (weeksSinceLastGym > 0) {
            // Decay increases with time away from gym
            // 1-2 weeks: 1.5x decay
            // 3-4 weeks: 2x decay
            // 5-8 weeks: 3x decay
            // 9+ weeks: 4x decay
            let decayMultiplier = 1.0;
            if (weeksSinceLastGym >= 9) {
              decayMultiplier = 4.0;
            } else if (weeksSinceLastGym >= 5) {
              decayMultiplier = 3.0;
            } else if (weeksSinceLastGym >= 3) {
              decayMultiplier = 2.0;
            } else if (weeksSinceLastGym >= 1) {
              decayMultiplier = 1.5;
            }
            fitnessDecay = effectiveDecayRate * 0.2 * decayMultiplier;
          }

          newStats.fitness = Math.max(0, (newStats.fitness || 0) - fitnessDecay);

          // Calculate career salary (weekly payment) and apply stat penalties
          let careerSalary = 0;
          let careerHappinessPenalty = 0;
          let careerHealthPenalty = 0;
          if (prevState.currentJob) {
            // CRITICAL: Validate careers array exists before using find
            const careers = Array.isArray(prevState.careers) ? prevState.careers : [];
            const currentCareer = careers.find(c => c && c.id === prevState.currentJob);
            if (currentCareer && currentCareer.accepted && currentCareer.levels && currentCareer.levels.length > 0) {
              // Ensure level is within bounds
              const safeLevel = Math.max(0, Math.min(currentCareer.level, currentCareer.levels.length - 1));
              const levelData = currentCareer.levels[safeLevel];
              if (levelData && typeof levelData.salary === 'number' && levelData.salary > 0) {
                // Salary is stored as weekly amount (e.g., 55 = $55/week)
                // Use it directly without conversion
                careerSalary = Math.round(levelData.salary);
                logger.info(`[WEEK PROGRESSION] Career salary: $${careerSalary}/week from ${levelData.name} (level ${safeLevel + 1})`);
              } else {
                logger.warn(`[WEEK PROGRESSION] Career ${prevState.currentJob} level ${safeLevel} has invalid salary: ${levelData?.salary}`);
              }

              // Apply career job stat penalties (careers have lighter penalties than street jobs)
              // Careers: -3 happiness, -2 health per week
              careerHappinessPenalty = -3;
              careerHealthPenalty = -2;
              logger.info(`[WEEK PROGRESSION] Career penalties: ${careerHappinessPenalty} happiness, ${careerHealthPenalty} health`);
            } else {
              if (!currentCareer) {
                logger.warn(`[WEEK PROGRESSION] Career ${prevState.currentJob} not found in careers list`);
              } else if (!currentCareer.accepted) {
                logger.warn(`[WEEK PROGRESSION] Career ${prevState.currentJob} is not accepted (applied: ${currentCareer.applied})`);
              } else if (!currentCareer.levels || currentCareer.levels.length === 0) {
                logger.warn(`[WEEK PROGRESSION] Career ${prevState.currentJob} has no levels`);
              }
            }
          } else {
            logger.info(`[WEEK PROGRESSION] No current job (currentJob: ${prevState.currentJob})`);
          }

          // Apply career job penalties to stats (in addition to natural decay)
          if (careerHappinessPenalty < 0) {
            newStats.happiness = Math.max(0, Math.min(100, newStats.happiness + careerHappinessPenalty));
          }
          if (careerHealthPenalty < 0) {
            newStats.health = Math.max(0, Math.min(100, newStats.health + careerHealthPenalty));
          }

          // Apply active diet plan effects (health, energy, happiness gains)
          const activeDietPlan = (prevState.dietPlans || []).find(plan => plan && plan.active);
          if (activeDietPlan) {
            // Apply health gain
            if (activeDietPlan.healthGain > 0) {
              newStats.health = Math.max(0, Math.min(100, newStats.health + activeDietPlan.healthGain));
            }
            // Apply energy gain
            if (activeDietPlan.energyGain > 0) {
              newStats.energy = Math.max(0, Math.min(100, newStats.energy + activeDietPlan.energyGain));
            }
            // Apply happiness gain (if applicable)
            if (activeDietPlan.happinessGain && activeDietPlan.happinessGain > 0) {
              newStats.happiness = Math.max(0, Math.min(100, newStats.happiness + activeDietPlan.happinessGain));
            }
            // Deduct weekly cost (dailyCost * 7)
            const weeklyCost = activeDietPlan.dailyCost * 7;
            const currentMoney = typeof newStats.money === 'number' && !isNaN(newStats.money) ? newStats.money : 0;
            newStats.money = Math.max(0, currentMoney - weeklyCost);

            logger.info(`[WEEK PROGRESSION] Active diet plan: ${activeDietPlan.name} - Health: +${activeDietPlan.healthGain}, Energy: +${activeDietPlan.energyGain}, Happiness: +${activeDietPlan.happinessGain || 0}, Cost: -$${weeklyCost}`);
          }

          // Process pending career applications (accept after 1-2 weeks)
          let updatedCareers = prevState.careers;
          let newCurrentJob = prevState.currentJob;

          // Check for pending applications and process them
          const pendingCareer = prevState.careers.find(c => c && c.applied && !c.accepted);
          if (pendingCareer && !prevState.currentJob) {
            // Track how long the application has been pending
            const weeksPending = (pendingCareer.applicationWeeksPending || 0) + 1;

            // Accept after 1-2 weeks (pre-rolled for StrictMode safety)
            const acceptAfterWeeks = preRolls.careerAcceptDelay;

            if (weeksPending >= acceptAfterWeeks) {
              // Accept the application
              updatedCareers = prevState.careers.map(c => {
                if (c.id === pendingCareer.id) {
                  return {
                    ...c,
                    accepted: true,
                    applicationWeeksPending: undefined, // Clear the counter
                  };
                }
                return c;
              });
              newCurrentJob = pendingCareer.id;
              logger.info(`[WEEK PROGRESSION] Career application accepted: ${pendingCareer.id} after ${weeksPending} weeks`);
            } else {
              // Still pending, increment counter
              updatedCareers = prevState.careers.map(c => {
                if (c.id === pendingCareer.id) {
                  return {
                    ...c,
                    applicationWeeksPending: weeksPending,
                  };
                }
                return c;
              });
            }
          }

          // Increase career progress for active career (modified by performance)
          if (newCurrentJob) {
            // Find the career again (currentCareer is out of scope here)
            const careers = Array.isArray(updatedCareers) ? updatedCareers : [];
            const activeCareer = careers.find(c => c && c.id === newCurrentJob && c.accepted);
            if (activeCareer) {
              // Calculate performance from current stats
              // eslint-disable-next-line @typescript-eslint/no-require-imports
              const { calculatePerformance: calcPerf } = require('@/lib/events/careerEvents');
              const performance = calcPerf(newStats);

              updatedCareers = updatedCareers.map(c => {
                if (c.id === newCurrentJob && c.accepted) {
                  // ENGAGEMENT: Early career acceleration — faster promotions in first career
                  const baseProgressRate = 5;
                  const weeksInCareer = (nextWeeksLived || 0) - (c.startedWeeksLived || 0);
                  // Mentor legacy buff: +50% career progress
                  const mentorBuff = prevState.legacyBuffs?.mentor &&
                    prevState.legacyBuffs.mentor.expiresWeeksLived > (nextWeeksLived || 0)
                    ? 1.5 : 1.0;
                  const earlyBoost = weeksInCareer < 20 ? 2.5 : weeksInCareer < 40 ? 1.5 : 1.0;
                  // Performance modifier: high perf boosts progress, low perf slows it
                  const perfModifier = performance >= 80 ? 1.3
                    : performance >= 50 ? 1.0
                    : performance >= 30 ? 0.7
                    : 0.3;
                  const progressRate = Math.round(baseProgressRate * earlyBoost * mentorBuff * perfModifier);
                  const newProgress = Math.min(100, (c.progress || 0) + progressRate);
                  return {
                    ...c,
                    startedWeeksLived: c.startedWeeksLived ?? (nextWeeksLived || 0),
                    progress: newProgress,
                    performance, // Store for event conditions and UI
                  };
                }
                return c;
              });
            }
          }

          // Progress enrolled educations automatically
          let pendingCampusEvent: string | undefined;
          let updatedEducations = prevState.educations || [];
          // Only count non-paused, active educations for stat drain
          const activeEducations = updatedEducations.filter(edu =>
            edu && !edu.completed && !edu.paused && edu.weeksRemaining && edu.weeksRemaining > 0
          );

          if (activeEducations.length > 0) {
            // Apply education stat penalties (studying is stressful)
            // Reduced penalties: each additional education adds less stress (more balanced)
            const numActiveEducations = activeEducations.length;
            const baseHappinessPenalty = -6; // Reduced from -8
            const baseHealthPenalty = -3; // Reduced from -5
            const baseEnergyPenalty = -7; // Reduced from -10

            // Reduced scaling: each additional education adds less stress
            // 1 education: base penalties
            // 2 educations: 1.3x penalties (moderately stressful)
            // 3+ educations: 1.6x penalties (stressful but manageable)
            const stressMultiplier = numActiveEducations === 1 ? 1.0 :
              numActiveEducations === 2 ? 1.3 :
                1.6;

            // Calculate penalties: base penalty per education, then apply multiplier
            // ANTI-EXPLOIT: Cap education penalties to prevent death spiral from enrolling in many educations
            const MAX_EDUCATION_HAPPINESS_PENALTY = -20;
            const MAX_EDUCATION_HEALTH_PENALTY = -10;
            const MAX_EDUCATION_ENERGY_PENALTY = -25;
            const educationHappinessPenalty = Math.max(MAX_EDUCATION_HAPPINESS_PENALTY, Math.round(baseHappinessPenalty * numActiveEducations * stressMultiplier));
            const educationHealthPenalty = Math.max(MAX_EDUCATION_HEALTH_PENALTY, Math.round(baseHealthPenalty * numActiveEducations * stressMultiplier));
            const educationEnergyPenalty = Math.max(MAX_EDUCATION_ENERGY_PENALTY, Math.round(baseEnergyPenalty * numActiveEducations * stressMultiplier));

            newStats.happiness = Math.max(0, Math.min(100, newStats.happiness + educationHappinessPenalty));
            newStats.health = Math.max(0, Math.min(100, newStats.health + educationHealthPenalty));
            // Apply education energy penalty (energy was already increased by regen above)
            newStats.energy = newStats.energy + educationEnergyPenalty;

            logger.info(`[WEEK PROGRESSION] Education penalties applied (${numActiveEducations} active, non-paused): ${educationHappinessPenalty} happiness, ${educationHealthPenalty} health, ${educationEnergyPenalty} energy`);

            // Progress each enrolled, non-paused education by 1 week
            updatedEducations = updatedEducations.map(edu => {
              if (edu && !edu.completed && !edu.paused && edu.weeksRemaining && edu.weeksRemaining > 0) {
                const newWeeksRemaining = Math.max(0, edu.weeksRemaining - 1);
                const isCompleted = newWeeksRemaining === 0;

                if (isCompleted) {
                  logger.info(`[WEEK PROGRESSION] Education completed: ${edu.name || edu.id}`);
                }

                const updatedEdu = {
                  ...edu,
                  weeksRemaining: newWeeksRemaining,
                  completed: isCompleted,
                };

                // Study group weekly bonuses
                if (edu.studyGroupActive) {
                  newStats.happiness = Math.min(100, newStats.happiness + 2);
                  newStats.energy = Math.max(0, newStats.energy - 3);
                }

                // Student loan weekly payment
                if (edu.studentLoan && edu.studentLoan.remaining > 0) {
                  const payment = Math.min(edu.studentLoan.weeklyPayment, edu.studentLoan.remaining);
                  newStats.money = Math.max(0, newStats.money - payment);
                  updatedEdu.studentLoan = {
                    ...edu.studentLoan,
                    remaining: Math.max(0, edu.studentLoan.remaining - payment),
                  };
                }

                // Exam check (every ~13 weeks)
                try {
                  const { isExamWeek, runExam } = require('@/lib/education/educationSystem');
                  if (isExamWeek(edu, nextWeeksLived)) {
                    const examResult = runExam(edu, newStats.energy, !!edu.studyGroupActive);
                    updatedEdu.lastExamWeek = nextWeeksLived;
                    updatedEdu.examsPassed = (edu.examsPassed || 0) + (examResult.passed ? 1 : 0);
                    updatedEdu.examsFailed = (edu.examsFailed || 0) + (examResult.passed ? 0 : 1);
                    const totalExams = (updatedEdu.examsPassed || 0) + (updatedEdu.examsFailed || 0);
                    const { updateGPA } = require('@/lib/education/educationSystem');
                    updatedEdu.gpa = updateGPA(edu.gpa || 2.5, totalExams, examResult.gpaChange);

                    // Apply exam stat effects
                    if (examResult.statChanges.happiness) {
                      newStats.happiness = Math.max(0, Math.min(100, newStats.happiness + examResult.statChanges.happiness));
                    }
                    if (examResult.statChanges.energy) {
                      newStats.energy = Math.max(0, Math.min(100, newStats.energy + examResult.statChanges.energy));
                    }
                    if (examResult.statChanges.reputation) {
                      newStats.reputation = Math.max(0, Math.min(100, newStats.reputation + examResult.statChanges.reputation));
                    }

                    pendingNotifications.push({ id: 'education-exam', message: `${examResult.grade} — ${examResult.message}`, title: `📝 Exam in ${edu.name}` });
                  }
                } catch (e) {
                  // Education system module may not exist in tests
                }

                // Campus event check (random, every 4-8 weeks)
                try {
                  const { shouldTriggerCampusEvent } = require('@/lib/education/educationSystem');
                  if (shouldTriggerCampusEvent(edu, nextWeeksLived)) {
                    updatedEdu.lastCampusEventWeek = nextWeeksLived;
                    // Campus events are handled via pending events in the UI
                    // Store a flag for the UI to pick up
                    pendingCampusEvent = edu.id;
                  }
                } catch (e) {
                  // Education system module may not exist in tests
                }

                // Apply class stat bonuses on completion
                if (isCompleted && edu.enrolledClasses) {
                  for (const cls of edu.enrolledClasses) {
                    if (cls.statBonuses) {
                      if (cls.statBonuses.health) newStats.health = Math.min(100, newStats.health + cls.statBonuses.health);
                      if (cls.statBonuses.happiness) newStats.happiness = Math.min(100, newStats.happiness + cls.statBonuses.happiness);
                      if (cls.statBonuses.energy) newStats.energy = Math.min(100, newStats.energy + cls.statBonuses.energy);
                      if (cls.statBonuses.fitness) newStats.fitness = Math.min(100, newStats.fitness + cls.statBonuses.fitness);
                      if (cls.statBonuses.reputation) newStats.reputation = Math.min(100, newStats.reputation + cls.statBonuses.reputation);
                    }
                  }
                  pendingNotifications.push({ id: 'education-complete', message: `GPA: ${(updatedEdu.gpa || 2.5).toFixed(1)} — Class bonuses applied!`, title: `🎓 ${edu.name} Completed!` });
                }

                return updatedEdu;
              }
              return edu;
            });
          }

          // pendingCampusEvent is set above during education processing

          // Calculate passive income
          const passiveIncomeResult = calcWeeklyPassiveIncome(prevState);
          const passiveIncome = passiveIncomeResult.total || 0;

          // Calculate partner/spouse income (recurring weekly income)
          // NERFED: Partner income is significantly reduced to prevent it from being overpowered
          let partnerIncome = 0;
          (prevState.relationships || []).forEach(rel => {
            if (rel && rel.income && (rel.type === 'partner' || rel.type === 'spouse') && rel.relationshipScore >= 50) {
              const safeIncome = typeof rel.income === 'number' && isFinite(rel.income) && rel.income >= 0 ? rel.income : 0;
              // Nerf: Only give 25% of partner's income (75% reduction)
              partnerIncome += Math.round(safeIncome * 0.25);
            }
          });

          // BUG FIX: Apply prestige income multiplier to total income
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          const { getIncomeMultiplier } = require('@/lib/prestige/applyBonuses');
          const incomeMultiplier = getIncomeMultiplier(unlockedBonuses);
          const safeIncomeMultiplier = typeof incomeMultiplier === 'number' && isFinite(incomeMultiplier) && incomeMultiplier > 0 ? incomeMultiplier : 1.0;

          // Total weekly income (before multiplier)
          let baseTotalIncome = careerSalary + passiveIncome + partnerIncome;

          // ENGAGEMENT: Beginner luck bonus — small random cash boost for first 20 weeks
          // Prevents the "going backwards" death spiral that kills retention in life sims
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          const { BEGINNER_LUCK_WEEKS, BEGINNER_LUCK_BASE_BONUS, BEGINNER_LUCK_RANDOM_MAX } = require('@/lib/config/gameConstants');
          const weeksLivedNow = prevState.weeksLived || 0;
          if (weeksLivedNow < BEGINNER_LUCK_WEEKS) {
            const luckSeed = weeksLivedNow * 777 + 42;
            const luckX = Math.sin(luckSeed) * 10000;
            const luckRoll = luckX - Math.floor(luckX);
            const luckBonus = BEGINNER_LUCK_BASE_BONUS + Math.floor(luckRoll * BEGINNER_LUCK_RANDOM_MAX);
            baseTotalIncome += luckBonus;
          }

          // Apply prestige income multiplier
          const totalIncome = Math.round(baseTotalIncome * safeIncomeMultiplier);

          // BUG FIX: Auto-reinvest dividends if enabled
          let reinvestedStocks: { symbol: string; shares: number; averagePrice: number; currentPrice: number }[] = [];
          if (passiveIncomeResult.reinvested && passiveIncomeResult.reinvested > 0) {
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            const { getStockInfo } = require('@/lib/economy/stockMarket');
            const holdings = prevState.stocks?.holdings || [];

            // Find the stock with the most shares (prefer reinvesting in existing holdings)
            let targetStock: { symbol: string; price: number } | null = null;

            // CRITICAL FIX: Filter holdings to ensure only valid objects are processed
            const validHoldings = holdings.filter(h => h && typeof h === 'object' && h.symbol);

            if (validHoldings.length > 0) {
              // Find the holding with the most shares
              const largestHolding = validHoldings.reduce((largest, h) =>
                (h.shares || 0) > (largest.shares || 0) ? h : largest
              );
              const stockInfo = getStockInfo(largestHolding.symbol.toUpperCase());
              if (stockInfo && stockInfo.price > 0) {
                targetStock = { symbol: largestHolding.symbol, price: stockInfo.price };
              }
            }

            // If no existing holdings, pick a random stock
            if (!targetStock) {
              // eslint-disable-next-line @typescript-eslint/no-require-imports
              const { getAllStocks } = require('@/lib/economy/stockMarket');
              const allStocks = getAllStocks();
              const stockEntries = Object.entries(allStocks);
              if (stockEntries.length > 0) {
                const [symbol, randomStock] = stockEntries[Math.floor(preRolls.stockPickRoll * stockEntries.length)];
                if (randomStock && typeof randomStock.price === 'number' && randomStock.price > 0) {
                  targetStock = { symbol, price: randomStock.price };
                }
              }
            }

            // Purchase stocks with reinvested amount
            if (targetStock && targetStock.price > 0) {
              const sharesToBuy = Math.floor(passiveIncomeResult.reinvested / targetStock.price);
              if (sharesToBuy > 0) {
                const existingHolding = holdings.find(h => h.symbol.toUpperCase() === targetStock!.symbol.toUpperCase());
                if (existingHolding) {
                  const totalShares = existingHolding.shares + sharesToBuy;
                  // ANTI-EXPLOIT: Guard against NaN/Infinity in average price calculation
                  const totalCost = (existingHolding.shares * existingHolding.averagePrice) + (sharesToBuy * targetStock.price);
                  const newAveragePrice = totalShares > 0 && isFinite(totalCost) ? totalCost / totalShares : targetStock.price;
                  const safeAveragePrice = isFinite(newAveragePrice) && newAveragePrice > 0 ? newAveragePrice : targetStock.price;
                  reinvestedStocks = holdings.map(h =>
                    h.symbol.toUpperCase() === targetStock!.symbol.toUpperCase()
                      ? { ...h, shares: totalShares, averagePrice: safeAveragePrice, currentPrice: targetStock!.price }
                      : h
                  );
                } else {
                  reinvestedStocks = [...holdings, {
                    symbol: targetStock.symbol.toUpperCase(),
                    shares: sharesToBuy,
                    averagePrice: targetStock.price,
                    currentPrice: targetStock.price,
                  }];
                }
                logger.info(`[AUTO-REINVEST] Purchased ${sharesToBuy} shares of ${targetStock.symbol} for $${passiveIncomeResult.reinvested}`);
              }
            }
          }

          // Calculate weekly rent for rented properties
          let weeklyRent = 0;
          (prevState.realEstate || []).forEach(property => {
            if ('status' in property && property.status === 'rented' && !property.owned) {
              const rent = Math.round(property.price * PLAYER_RENT_RATE_WEEKLY);
              weeklyRent += rent;
            }
          });

          // Housing & Decoration System — condition decay, value appreciation, happiness bonuses
          let updatedRealEstate = prevState.realEstate || [];
          let housingHappinessBonus = 0;
          let housingRentalIncome = 0;
          let housingUpkeep = 0;
          try {
            const housingModule = require('@/lib/realEstate/housing');
            const housingResult = housingModule.processWeeklyHousing(updatedRealEstate, nextWeeksLived);
            updatedRealEstate = housingResult.properties;
            housingHappinessBonus = housingResult.totalHappinessBonus;
            housingRentalIncome = housingResult.totalRentalIncome;
            housingUpkeep = housingResult.totalUpkeep;
            // Show property condition alerts
            if (housingResult.notifications.length > 0) {
              housingResult.notifications.forEach((msg: string) => {
                pendingNotifications.push({ id: 'housing-alert', message: msg, title: '🏠 Property Alert' });
              });
            }
          } catch (e) {
            // Housing module may not exist in tests
          }

          // Core simulation owns savings interest and loan autopay to avoid UI-driven drift/exploits.
          const savingsAPR = prevState.settings?.financialPlanning
            ? SAVINGS_APR_FINANCIAL_PLANNING
            : SAVINGS_APR_BASE;
          const currentSavings = typeof prevState.bankSavings === 'number' && isFinite(prevState.bankSavings)
            ? Math.max(0, prevState.bankSavings)
            : 0;
          // ANTI-EXPLOIT: Diminishing returns on savings interest above soft cap
          // Balance below cap earns full rate, balance above cap earns reduced rate
          let savingsInterest = 0;
          if (currentSavings > 0) {
            const belowCap = Math.min(currentSavings, SAVINGS_BALANCE_SOFT_CAP);
            const aboveCap = Math.max(0, currentSavings - SAVINGS_BALANCE_SOFT_CAP);
            savingsInterest = (belowCap * savingsAPR) / WEEKS_PER_YEAR + (aboveCap * savingsAPR * SAVINGS_CAP_EFFICIENCY) / WEEKS_PER_YEAR;
          }
          const newBankSavings = Math.max(0, currentSavings + savingsInterest);

          // Progressive income tax on weekly earnings
          const incomeTax = calculateIncomeTax(totalIncome);

          let cashAfterIncomeAndRent = Math.max(0, currentMoney + totalIncome - incomeTax - weeklyRent + housingRentalIncome - housingUpkeep);
          let totalLoanAutoPaid = 0;
          let totalLoanPenalty = 0;
          const processedLoans: NonNullable<GameState['loans']>[number][] = (prevState.loans || []).map(loan => {
            const remaining = typeof loan.remaining === 'number' && isFinite(loan.remaining)
              ? Math.max(0, loan.remaining)
              : 0;
            if (remaining <= 0) return null;

            const aprRaw = typeof loan.interestRate === 'number' && isFinite(loan.interestRate)
              ? loan.interestRate
              : 0;
            const aprDecimal = aprRaw > 1 ? aprRaw / 100 : Math.max(0, aprRaw);
            const weeklyRate = aprDecimal / WEEKS_PER_YEAR;
            const remainingWithInterest = Math.max(0, remaining * (1 + weeklyRate));

            const weeksRemaining = typeof loan.weeksRemaining === 'number' && isFinite(loan.weeksRemaining)
              ? Math.max(0, Math.floor(loan.weeksRemaining))
              : 0;
            const fallbackPayment = weeksRemaining > 0
              ? Math.max(remainingWithInterest / weeksRemaining, remainingWithInterest * 0.001)
              : remainingWithInterest;
            const configuredPayment = typeof loan.weeklyPayment === 'number' && isFinite(loan.weeklyPayment) && loan.weeklyPayment > 0
              ? loan.weeklyPayment
              : fallbackPayment;
            const paymentDue = Math.min(remainingWithInterest, Math.max(0, configuredPayment));

            // ANTI-EXPLOIT: Bankruptcy protection - don't auto-pay if it would drain cash below floor
            // Prevents soft-lock where player can't afford job applications or basic actions
            const canAffordPayment = paymentDue > 0 && cashAfterIncomeAndRent >= paymentDue
              && (cashAfterIncomeAndRent - paymentDue) >= BANKRUPTCY_FLOOR;
            // Allow payment even below floor if cash exceeds payment by 2x (player has breathing room)
            const forcePayment = paymentDue > 0 && cashAfterIncomeAndRent >= paymentDue * 2;
            if (canAffordPayment || forcePayment) {
              cashAfterIncomeAndRent -= paymentDue;
              totalLoanAutoPaid += paymentDue;
              return {
                ...loan,
                remaining: Math.max(0, remainingWithInterest - paymentDue),
                weeksRemaining: Math.max(0, weeksRemaining - 1),
              };
            }

            const penalizedRemaining = Math.max(
              0,
              remainingWithInterest * (1 + LOAN_MISSED_PAYMENT_PENALTY)
            );
            totalLoanPenalty += (penalizedRemaining - remainingWithInterest);
            return {
              ...loan,
              remaining: penalizedRemaining,
              weeksRemaining: Math.max(0, weeksRemaining - 1),
            };
          }).filter((loan): loan is NonNullable<GameState['loans']>[number] => Boolean(loan && loan.remaining > 0));

          // Add income to money (always update, even if 0, to ensure state updates)
          // Note: If auto-reinvest is active, reinvestedAmount is NOT added to money (it's used to buy stocks)
          // Deduct weekly rent for rented properties
          const newMoney = Math.max(0, cashAfterIncomeAndRent);
          newStats.money = newMoney;

          if (totalIncome > 0 || weeklyRent > 0 || totalLoanAutoPaid > 0 || totalLoanPenalty > 0 || savingsInterest > 0) {
            const incomeBreakdown = [
              `Career $${careerSalary}`,
              partnerIncome > 0 ? `Partner $${partnerIncome}` : null,
              `Passive $${passiveIncome}`,
              incomeTax > 0 ? `Tax -$${incomeTax}` : null,
              weeklyRent > 0 ? `Rent -$${weeklyRent}` : null,
              totalLoanAutoPaid > 0 ? `Loans -$${Math.round(totalLoanAutoPaid)}` : null,
              totalLoanPenalty > 0 ? `Loan penalty +$${Math.round(totalLoanPenalty)}` : null,
              savingsInterest > 0 ? `Savings interest +$${Math.round(savingsInterest)}` : null,
            ].filter(Boolean).join(' + ');
            logger.info(`[WEEK PROGRESSION] Weekly economy: ${incomeBreakdown}. Money: $${currentMoney} -> $${newMoney}`);
          }

          logger.info(`[WEEK PROGRESSION] Week advanced - Energy regained: +${energyRegen}, Health: ${prevState.stats?.health || 0} -> ${newStats.health}, Happiness: ${prevState.stats?.happiness || 0} -> ${newStats.happiness}, Money: $${currentMoney} -> $${newMoney} (+$${totalIncome})`);

          // Track zero weeks for health and happiness (death warning system)
          // Reset counters if stats are above 0, increment if at 0
          let newHealthZeroWeeks = prevState.healthZeroWeeks || 0;
          let newHappinessZeroWeeks = prevState.happinessZeroWeeks || 0;
          let newShowZeroStatPopup = prevState.showZeroStatPopup || false;
          let newZeroStatType = prevState.zeroStatType;
          let newShowDeathPopup = prevState.showDeathPopup || false;
          let newDeathReason = prevState.deathReason;
          let newShowWeddingPopup = prevState.showWeddingPopup || false;
          let newWeddingPartnerName = prevState.weddingPartnerName;

          // Health tracking
          if (newStats.health <= 0) {
            newHealthZeroWeeks = (newHealthZeroWeeks || 0) + 1;
            // Only show popup on first week and final warning (week 3) — less annoying
            if (newHealthZeroWeeks === 1 || newHealthZeroWeeks === 3) {
              newShowZeroStatPopup = true;
              newZeroStatType = 'health';
              haptic.warning();
            }

            // Death after 4 weeks at zero
            if (newHealthZeroWeeks >= 4) {
              newShowDeathPopup = true;
              newDeathReason = 'health';
              // CRITICAL: Hide zero stat popup when death occurs
              newShowZeroStatPopup = false;
              newZeroStatType = undefined;
              deathTriggered = true; // Mark that death was triggered
              haptic.error(); // Death — heavy error buzz
              logger.warn(`[DEATH] Character died from health reaching 0 for ${newHealthZeroWeeks} weeks`);
            }
          } else {
            // Reset counter if health is above 0
            if (newHealthZeroWeeks > 0) {
              newHealthZeroWeeks = 0;
              // Only hide popup if it was for health
              if (newZeroStatType === 'health') {
                newShowZeroStatPopup = false;
                newZeroStatType = undefined;
              }
            }
          }

          // Happiness tracking
          if (newStats.happiness <= 0) {
            newHappinessZeroWeeks = (newHappinessZeroWeeks || 0) + 1;
            // Only show popup on first week and final warning (week 3) — less annoying
            if (newHappinessZeroWeeks === 1 || newHappinessZeroWeeks === 3) {
              newShowZeroStatPopup = true;
              newZeroStatType = 'happiness';
              haptic.warning();
            }

            // Death after 4 weeks at zero
            if (newHappinessZeroWeeks >= 4) {
              newShowDeathPopup = true;
              newDeathReason = 'happiness';
              // CRITICAL: Hide zero stat popup when death occurs
              newShowZeroStatPopup = false;
              newZeroStatType = undefined;
              deathTriggered = true; // Mark that death was triggered
              haptic.error(); // Death — heavy error buzz
              logger.warn(`[DEATH] Character died from happiness reaching 0 for ${newHappinessZeroWeeks} weeks`);
            }
          } else {
            // Reset counter if happiness is above 0
            if (newHappinessZeroWeeks > 0) {
              newHappinessZeroWeeks = 0;
              // Only hide popup if it was for happiness
              if (newZeroStatType === 'happiness') {
                newShowZeroStatPopup = false;
                newZeroStatType = undefined;
              }
            }
          }




          // Process weddings, pregnancy, and relationship health
          let relationshipHappinessPenalty = 0;
          const newBornChildren: Relationship[] = [];
          let newShowBirthPopup = false;
          let birthMessage = '';
          const processedRelationships = (prevState.relationships || []).map((rel, relIdx) => {
            if (!rel || typeof rel !== 'object') return rel;

            // Process pregnancy progression for partners/spouses
            if ((rel.type === 'partner' || rel.type === 'spouse') && rel.isPregnant && rel.pregnancyStartWeek != null) {
              const pregnancyWeeks = nextWeeksLived - rel.pregnancyStartWeek;

              if (pregnancyWeeks >= PREGNANCY_DURATION_WEEKS) {
                // Birth! Create the child
                const childGender = rel.pregnancyChildGender || preRolls.childGender;
                const childName = rel.pregnancyChildName || (childGender === 'male' ? 'Baby' : 'Baby');
                const childId = `child_${preRolls.timestamp}_${preRolls.childIdSuffix}`;

                const newChild: Relationship = {
                  id: childId,
                  name: childName,
                  type: 'child',
                  relationshipScore: 100,
                  personality: ['Playful', 'Curious', 'Energetic', 'Sweet', 'Adventurous'][preRolls.childPersonality],
                  gender: childGender,
                  age: 0,
                  datesCount: 0,
                };
                (newChild as ChildInfo).birthWeeksLived = nextWeeksLived;

                newBornChildren.push(newChild);
                newStats.money = Math.max(0, newStats.money - 5000); // Hospital/birth costs
                newStats.happiness = Math.min(100, newStats.happiness + 30);
                newShowBirthPopup = true;
                birthMessage = `${rel.name} gave birth to a beautiful ${childGender === 'male' ? 'baby boy' : 'baby girl'} named ${childName}!`;

                logger.info(`[BIRTH] ${childName} (${childGender}) born to ${rel.name} at week ${nextWeeksLived}`);

                // Clear pregnancy state, boost relationship
                return {
                  ...rel,
                  isPregnant: undefined,
                  pregnancyStartWeek: undefined,
                  pregnancyChildGender: undefined,
                  pregnancyChildName: undefined,
                  relationshipScore: clampRelationshipScore(rel.relationshipScore + 15),
                };
              }

              // Pregnancy effects on stats (minor weekly effects)
              if (pregnancyWeeks >= 7) {
                // Late pregnancy: slight energy drain, happiness boost
                newStats.energy = Math.max(0, newStats.energy - 3);
              }
              if (pregnancyWeeks === 5) {
                // Mid-pregnancy: small happiness bump (excitement)
                newStats.happiness = Math.min(100, newStats.happiness + 2);
              }

              // Return unchanged (pregnancy continues)
              return rel;
            }

            // Check if wedding should happen this week
            if (rel.weddingPlanned && rel.weddingPlanned.scheduledWeek === nextWeeksLived) {
              // ANTI-EXPLOIT: Deduct remaining 75% of wedding budget on auto-execution
              // Prevents exploit where player plans wedding (pays 25% deposit) but gets married for free
              const weddingBudget = rel.weddingPlanned.budget || 0;
              const remainingBalance = Math.floor(weddingBudget * 0.75);
              if (newStats.money >= remainingBalance) {
                newStats.money -= remainingBalance;
                logger.info(`[WEDDING] Wedding happening for ${rel.name} in week ${nextWeeksLived}! Charged $${remainingBalance} remaining balance.`);
                newShowWeddingPopup = true;
                newWeddingPartnerName = rel.name;
                return {
                  ...rel,
                  type: 'spouse' as const,
                  weddingPlanned: undefined,
                  relationshipScore: clampRelationshipScore(rel.relationshipScore + 20),
                  weeksAtLowRelationship: 0,
                };
              } else {
                // Can't afford wedding - postpone by 4 weeks, but expire after WEEKS_PER_YEAR weeks from original date
                const originalScheduled = rel.weddingPlanned.scheduledWeek || nextWeeksLived;
                const weddingAge = nextWeeksLived - originalScheduled;
                if (weddingAge >= WEEKS_PER_YEAR) {
                  // ANTI-EXPLOIT: Wedding plan expires after 1 year - deposit forfeited
                  logger.info(`[WEDDING] Wedding plan for ${rel.name} expired after ${WEEKS_PER_YEAR} weeks. Deposit forfeited.`);
                  return { ...rel, weddingPlanned: undefined, relationshipScore: clampRelationshipScore(rel.relationshipScore - 15) };
                }
                logger.info(`[WEDDING] Can't afford wedding for ${rel.name} ($${remainingBalance} needed). Postponed 4 weeks.`);
                return { ...rel, weddingPlanned: { ...rel.weddingPlanned, scheduledWeek: nextWeeksLived + 4 } };
              }
            }
            // ANTI-EXPLOIT: Expire wedding plans older than 1 year even if not yet scheduled
            if (rel.weddingPlanned && rel.weddingPlanned.scheduledWeek && rel.weddingPlanned.scheduledWeek < nextWeeksLived - WEEKS_PER_YEAR) {
              logger.info(`[WEDDING] Stale wedding plan for ${rel.name} cleaned up.`);
              return { ...rel, weddingPlanned: undefined, relationshipScore: clampRelationshipScore(rel.relationshipScore - 10) };
            }

            // Age children
            if (rel.type === 'child') {
              return {
                ...rel,
                age: (rel.age || 0) + (1 / WEEKS_PER_YEAR), // Age by 1 year per WEEKS_PER_YEAR weeks
                relationshipScore: clampRelationshipScore(rel.relationshipScore),
              };
            }

            // Check relationship health for partners/spouses
            if ((rel.type === 'partner' || rel.type === 'spouse') && rel.relationshipScore < 30) {
              const weeksAtLow = (rel.weeksAtLowRelationship || 0) + 1;

              // After 2 weeks at low relationship, chance of breakup or disappointment
              if (weeksAtLow >= 2) {
                const breakupChance = Math.min(0.4, (30 - rel.relationshipScore) / 100); // Higher chance if relationship is lower
                const disappointedChance = 0.3; // 30% chance of disappointment

                if (preRolls.relBreakup[relIdx] < breakupChance) {
                  // Breakup happens
                  logger.info(`[RELATIONSHIP] ${rel.name} broke up due to low relationship (${rel.relationshipScore}%)`);

                  // Schedule notification
                  pendingNotifications.push({ id: 'relationship-breakup', message: `${rel.name} has ended the relationship. Your relationship score was too low (${rel.relationshipScore}%).`, title: '\uD83D\uDC94 Relationship Ended' });

                  // Track happiness penalty
                  relationshipHappinessPenalty -= 25;

                  // Remove relationship
                  return null; // Will be filtered out
                } else if (preRolls.relDisappointed[relIdx] < disappointedChance) {
                  // Partner is disappointed
                  logger.info(`[RELATIONSHIP] ${rel.name} is disappointed (${rel.relationshipScore}%)`);

                  // Schedule notification
                  pendingNotifications.push({ id: 'relationship-disappointed', message: `${rel.name} is disappointed with you. Your relationship is at ${rel.relationshipScore}%. Consider going on dates or giving gifts to improve it.`, title: '\uD83D\uDE14 Partner Disappointed' });

                  // Track happiness penalty
                  relationshipHappinessPenalty -= 10;

                  // Further decrease relationship score
                  return {
                    ...rel,
                    relationshipScore: clampRelationshipScore(rel.relationshipScore - 5),
                    weeksAtLowRelationship: weeksAtLow,
                  };
                }
              }

              // Track weeks at low relationship
              return {
                ...rel,
                weeksAtLowRelationship: weeksAtLow,
                relationshipScore: clampRelationshipScore(rel.relationshipScore),
              };
            }

            // Reset weeksAtLowRelationship if relationship is healthy
            if ((rel.type === 'partner' || rel.type === 'spouse') && rel.relationshipScore >= 30) {
              return {
                ...rel,
                weeksAtLowRelationship: 0,
                relationshipScore: clampRelationshipScore(rel.relationshipScore),
              };
            }

            return {
              ...rel,
              relationshipScore: clampRelationshipScore(rel.relationshipScore),
            };
          }).filter(rel => rel !== null); // Remove null relationships (breakups)

          // Add newborn children to relationships
          if (newBornChildren.length > 0) {
            processedRelationships.push(...newBornChildren);

            // Show birth notification
            if (newShowBirthPopup && birthMessage) {
              pendingNotifications.push({ id: 'birth-announcement', message: birthMessage, title: '👶 A Baby Is Born!' });
            }
          }

          // Apply relationship happiness penalties
          if (relationshipHappinessPenalty < 0) {
            newStats.happiness = Math.max(0, Math.min(100, newStats.happiness + relationshipHappinessPenalty));
          }

          // NPC Depth System — process life events, moods, opinions
          try {
            const npcDepth = require('@/lib/social/npcDepth');
            const npcResult = npcDepth.processWeeklyNPCDepth(processedRelationships, nextWeeksLived);
            // Replace relationships in-place
            processedRelationships.length = 0;
            processedRelationships.push(...npcResult.relationships);
            // Show NPC life event notifications (max 2 per week to avoid spam)
            if (npcResult.notifications.length > 0) {
              const toShow = npcResult.notifications.slice(0, 2);
              toShow.forEach((msg: string) => {
                pendingNotifications.push({ id: 'npc-life-event', message: msg, title: '💬 Life Update' });
              });
            }
          } catch (e) {
            // NPC depth module may not exist in tests
          }

          // Wanted level decay: -1 per week if not in jail, minimum 0
          let newWantedLevel = prevState.wantedLevel || 0;
          if (newWantedLevel > 0 && (prevState.jailWeeks || 0) <= 0) {
            newWantedLevel = Math.max(0, newWantedLevel - 1);
          }

          // Random police encounter if wanted level is high (outside jail)
          let policeEncounterJailWeeks = 0;
          if (newWantedLevel >= 5 && (prevState.jailWeeks || 0) <= 0) {
            const encounterChance = Math.min(0.30, (newWantedLevel - 4) * 0.05); // 5% per level above 4, cap 30%
            if (preRolls.policeEncounter < encounterChance) {
              policeEncounterJailWeeks = Math.min(4, Math.ceil(newWantedLevel / 3));
              newStats.happiness = Math.max(0, newStats.happiness - 15);
              const fine = Math.min(newStats.money, Math.round(newStats.money * 0.05));
              newStats.money = Math.max(0, newStats.money - fine);
              logger.info(`[POLICE] Random encounter! Wanted ${newWantedLevel}, jailed ${policeEncounterJailWeeks} weeks, fined $${fine}`);
              pendingNotifications.push({ id: 'police-encounter', message: `The police caught up with you! You've been fined $${fine.toLocaleString()} and sentenced to ${policeEncounterJailWeeks} week(s) in jail.`, title: 'Police Encounter' });
            }
          }

          // Calculate updated cryptos from warehouse mining
          const calculateUpdatedCryptos = () => {
            if (!prevState.warehouse || !prevState.warehouse.selectedCrypto) {
              return prevState.cryptos;
            }

            const selectedCryptoId = prevState.warehouse.selectedCrypto;
            const warehouse = prevState.warehouse;

            // Import mining calculation
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            const { calculateMiningEarnings } = require('@/contexts/game/actions/MiningActions');

            // Get miner data
            const MINERS_DATA = [
              { id: 'basic', weeklyEarnings: 22, powerConsumption: 10, owned: warehouse.miners?.basic || 0 },
              { id: 'advanced', weeklyEarnings: 105, powerConsumption: 35, owned: warehouse.miners?.advanced || 0 },
              { id: 'pro', weeklyEarnings: 438, powerConsumption: 100, owned: warehouse.miners?.pro || 0 },
              { id: 'industrial', weeklyEarnings: 1575, powerConsumption: 250, owned: warehouse.miners?.industrial || 0 },
              { id: 'quantum', weeklyEarnings: 7000, powerConsumption: 500, owned: warehouse.miners?.quantum || 0 },
              { id: 'mega', weeklyEarnings: 35000, powerConsumption: 2000, owned: warehouse.miners?.mega || 0 },
              { id: 'giga', weeklyEarnings: 140000, powerConsumption: 5000, owned: warehouse.miners?.giga || 0 },
              { id: 'tera', weeklyEarnings: 700000, powerConsumption: 15000, owned: warehouse.miners?.tera || 0 },
            ];

            const result = calculateMiningEarnings(
              warehouse,
              MINERS_DATA,
              selectedCryptoId,
              prevState.cryptos
            );

            if (result.cryptoEarned > 0) {
              // Add crypto to balance
              let updatedCryptos = prevState.cryptos.map(crypto => {
                if (crypto.id === selectedCryptoId) {
                  return {
                    ...crypto,
                    owned: crypto.owned + result.cryptoEarned,
                  };
                }
                return crypto;
              });

              // Deduct auto-repair cost if enabled
              if (prevState.warehouse?.autoRepairEnabled &&
                prevState.warehouse?.autoRepairCryptoId &&
                prevState.warehouse?.autoRepairWeeklyCost) {
                updatedCryptos = updatedCryptos.map(crypto => {
                  if (crypto.id === prevState.warehouse?.autoRepairCryptoId) {
                    const cost = prevState.warehouse?.autoRepairWeeklyCost || 0;
                    return {
                      ...crypto,
                      owned: Math.max(0, crypto.owned - cost),
                    };
                  }
                  return crypto;
                });
              }

              return updatedCryptos;
            }

            // Still deduct auto-repair even if no mining earnings
            if (prevState.warehouse?.autoRepairEnabled &&
              prevState.warehouse?.autoRepairCryptoId &&
              prevState.warehouse?.autoRepairWeeklyCost) {
              return prevState.cryptos.map(crypto => {
                if (prevState.warehouse && crypto.id === prevState.warehouse.autoRepairCryptoId) {
                  const cost = prevState.warehouse.autoRepairWeeklyCost || 0;
                  return {
                    ...crypto,
                    owned: Math.max(0, crypto.owned - cost),
                  };
                }
                return crypto;
              });
            }

            return prevState.cryptos;
          };
          const updatedCryptos = calculateUpdatedCryptos();

          // Calculate updated warehouse with miner durability degradation
          const calculateUpdatedWarehouse = () => {
            if (!prevState.warehouse) return prevState.warehouse;
            const warehouse = prevState.warehouse;
            if (!warehouse.miners || Object.keys(warehouse.miners).length === 0) {
              return warehouse;
            }

            const currentAbsoluteWeek = prevState.weeksLived || 0;
            const legacyLastUpdateWeek = warehouse.lastDifficultyUpdate || prevState.week;
            const migratedLastUpdate = Math.max(0, currentAbsoluteWeek - ((prevState.week - legacyLastUpdateWeek + 4) % 4));
            const lastDifficultyUpdateAbsoluteWeek = warehouse.lastDifficultyUpdateAbsoluteWeek ?? migratedLastUpdate;
            const shouldUpdateDifficulty = currentAbsoluteWeek - lastDifficultyUpdateAbsoluteWeek >= 10;
            const difficultyMultiplier = shouldUpdateDifficulty
              ? Math.min(2.0, (warehouse.difficultyMultiplier || 1.0) * 1.1)
              : (warehouse.difficultyMultiplier || 1.0);
            const nextDifficultyUpdateAbsoluteWeek = shouldUpdateDifficulty
              ? currentAbsoluteWeek
              : lastDifficultyUpdateAbsoluteWeek;

            // Degrade durability by 2-5% per week (random)
            const degradationRate = preRolls.minerDegradation; // 2-5% per week (pre-rolled)
            const updatedDurability: Record<string, number> = { ...warehouse.minerDurability };

            Object.keys(warehouse.miners).forEach(minerId => {
              const currentDurability = warehouse.minerDurability?.[minerId] ?? 100;
              const newDurability = Math.max(0, currentDurability - degradationRate);
              updatedDurability[minerId] = newDurability;
            });

            // Handle auto-repair if enabled
            if (warehouse.autoRepairEnabled && warehouse.autoRepairCryptoId && warehouse.autoRepairWeeklyCost) {
              const repairCrypto = prevState.cryptos.find(c => c.id === warehouse.autoRepairCryptoId);
              if (repairCrypto && repairCrypto.owned >= warehouse.autoRepairWeeklyCost) {
                // Auto-repair: repair all miners under 50% health
                const MINER_REPAIR_COSTS: Record<string, number> = {
                  basic: 125,
                  advanced: 500,
                  pro: 2000,
                  industrial: 6250,
                  quantum: 25000,
                  mega: 125000,
                  giga: 500000,
                  tera: 2500000,
                };

                let totalRepairCost = 0;
                Object.keys(warehouse.miners).forEach(minerId => {
                  const currentDurability = updatedDurability[minerId] ?? 100;
                  if (currentDurability < 50) {
                    const baseRepairCost = MINER_REPAIR_COSTS[minerId] || 0;
                    const healthToRestore = 100 - currentDurability;
                    const repairCost = (baseRepairCost * (healthToRestore / 100)) * (warehouse.miners[minerId] || 0);
                    totalRepairCost += repairCost;
                    updatedDurability[minerId] = 100; // Repair to 100%
                  }
                });

                // Convert repair cost to crypto (assuming $1 = 1 crypto unit for simplicity)
                // In reality, we should use the crypto price, but for now use the weekly cost
                if (totalRepairCost > 0 && repairCrypto.owned >= warehouse.autoRepairWeeklyCost) {
                  // Deduct the weekly cost (which covers repairs)
                  return {
                    ...warehouse,
                    minerDurability: updatedDurability,
                    difficultyMultiplier,
                    lastDifficultyUpdate: prevState.week,
                    lastDifficultyUpdateAbsoluteWeek: nextDifficultyUpdateAbsoluteWeek,
                  };
                }
              }
            }

            return {
              ...warehouse,
              minerDurability: updatedDurability,
              difficultyMultiplier,
              lastDifficultyUpdate: prevState.week,
              lastDifficultyUpdateAbsoluteWeek: nextDifficultyUpdateAbsoluteWeek,
            };
          };
          const updatedWarehouse = calculateUpdatedWarehouse();

          // Generate weekly events (economic, personal crisis, seasonal, regular)
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          const { rollWeeklyEvents } = require('@/lib/events/engine');
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          const { shouldTriggerEconomicEvent, generateEconomicEvent } = require('@/lib/events/economyEvents');

          // Process economic events first (they affect the state)
          let updatedEconomy = prevState.economy;
          try {
            if (shouldTriggerEconomicEvent(prevState)) {
              const newEconomicState = generateEconomicEvent(prevState);
              updatedEconomy = {
                ...prevState.economy,
                economyEvents: newEconomicState,
              };
            }
          } catch (error) {
            logger.error('[WEEK PROGRESSION] Economic event generation failed:', error);
          }

          // Generate all weekly events (includes economic event notifications, personal crises, seasonal, regular)
          // Pass updated state with new week info
          const stateForEventGeneration = {
            ...prevState,
            economy: updatedEconomy,
            weeksLived: nextWeeksLived,
            week: nextWeek,
          };

          let newEvents: any[] = [];
          try {
            newEvents = rollWeeklyEvents(stateForEventGeneration);
          } catch (eventError) {
            logger.error('[WEEK PROGRESSION] Event generation failed:', eventError);
            // Continue without new events
          }

          // Add new events to pendingEvents (existing events stay, new ones are added)
          // Stamp absolute week so persistence can safely retain unresolved events.
          const stampedNewEvents = newEvents.map((event: any) => ({
            ...event,
            generatedAtWeeksLived: nextWeeksLived,
          }));
          let updatedPendingEvents = [...(prevState.pendingEvents || []), ...stampedNewEvents];

          // ── CLIFFHANGER RESOLUTION: If a cliffhanger is pending, inject its resolve event ──
          if (prevState.pendingCliffhanger) {
            try {
              const { resolveCliffhanger } = require('@/lib/events/cliffhangerEvents');
              const resolveEvent = resolveCliffhanger(prevState.pendingCliffhanger.resolveEventId, {
                ...prevState,
                weeksLived: nextWeeksLived,
              });
              if (resolveEvent) {
                updatedPendingEvents = [...updatedPendingEvents, {
                  ...resolveEvent,
                  generatedAtWeeksLived: nextWeeksLived,
                }];
                logger.info(`[CLIFFHANGER] Resolved: ${prevState.pendingCliffhanger.resolveEventId}`);
              }
            } catch (cliffErr) {
              logger.error('[CLIFFHANGER] Resolution failed:', cliffErr);
            }
          }

          // Generate life moments (NEW)
          const { generateLifeMoment } = require('@/lib/lifeMoments/lifeMomentGenerator');

          let newLifeMoment;
          try {
            newLifeMoment = generateLifeMoment({
              ...prevState,
              weeksLived: nextWeeksLived,
            });
          } catch (momentError) {
            logger.error('[WEEK PROGRESSION] Life moment generation failed:', momentError);
          }

          let updatedLifeMoments = prevState.lifeMoments;
          if (newLifeMoment) {
            updatedLifeMoments = {
              ...(prevState.lifeMoments || {}),
              pendingMoment: newLifeMoment,
              lastMomentWeek: nextWeeksLived,
              momentsThisWeek: (prevState.lifeMoments?.momentsThisWeek || 0) + 1,
              totalMoments: (prevState.lifeMoments?.totalMoments || 0) + 1,
            };
          } else {
            // Preserve existing lifeMoments state but update lastMomentWeek if needed
            updatedLifeMoments = prevState.lifeMoments || {
              lastMomentWeek: 0,
              momentsThisWeek: 0,
              totalMoments: 0,
              pendingMoment: undefined,
            };
          }

          // Disease System: Generate random diseases and apply effects
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          const { generateRandomDisease } = require('@/lib/diseases/diseaseGenerator');

          let updatedDiseases = [...(prevState.diseases || [])];
          // Disease progression logic
          let diseaseDeathTriggered = false;
          let diseaseDeathReason: 'health' | undefined = undefined;
          let updatedDiseaseHistory = prevState.diseaseHistory || {
            diseases: [],
            totalDiseases: 0,
            totalCured: 0,
            deathsFromDisease: 0,
          };
          let showSicknessModal = prevState.showSicknessModal;
          let lastDiseaseWeek = prevState.lastDiseaseWeek;

          // Generate random disease if cooldown allows
          try {
            const stateForDiseaseGeneration = {
              ...prevState,
              weeksLived: nextWeeksLived,
              week: nextWeek,
              stats: newStats,
            };
            const newDisease = generateRandomDisease(stateForDiseaseGeneration);

            if (newDisease) {
              // Validate new disease before adding
              if (newDisease.id && newDisease.name && newDisease.severity) {
                updatedDiseases.push(newDisease);
                showSicknessModal = true;
                lastDiseaseWeek = nextWeeksLived;

                // Update disease history
                updatedDiseaseHistory = {
                  ...updatedDiseaseHistory,
                  diseases: [
                    ...updatedDiseaseHistory.diseases,
                    {
                      id: newDisease.id,
                      name: newDisease.name,
                      contractedWeek: nextWeeksLived,
                      severity: newDisease.severity,
                    },
                  ],
                  totalDiseases: updatedDiseaseHistory.totalDiseases + 1,
                };
              } else {
                logger.warn('Invalid disease generated, skipping:', newDisease);
              }
            }
          } catch (error) {
            logger.error('Error generating disease:', error);
            // Continue without new disease if generation fails
          }

          // Apply disease effects and progression
          const diseaseEffects: Partial<typeof newStats> = {};
          const diseasesToRemove: number[] = [];

          // Validate diseases array
          if (!Array.isArray(updatedDiseases)) {
            updatedDiseases = [];
          }

          updatedDiseases.forEach((disease, index) => {
            // Validate disease object
            if (!disease || typeof disease !== 'object' || !disease.id || !disease.name) {
              logger.warn('Invalid disease object found, skipping:', disease);
              diseasesToRemove.push(index);
              return;
            }
            // Apply stat penalties
            if (disease.effects) {
              Object.entries(disease.effects).forEach(([stat, value]) => {
                if (typeof value === 'number' && value < 0) {
                  const statKey = stat as keyof typeof newStats;
                  if (statKey in diseaseEffects) {
                    (diseaseEffects[statKey] as number) = ((diseaseEffects[statKey] as number) || 0) + value;
                  } else {
                    (diseaseEffects[statKey] as number) = value;
                  }
                }
              });
            }

            // Disease complications: Untreated diseases can worsen
            if (disease.treatmentRequired && !disease.curable) {
              // Chronic diseases that require treatment - check if worsening
              const complicationChance = 0.1; // 10% chance per week if untreated
              if (preRolls.diseaseComplication[index] < complicationChance) {
                // Disease worsens - increase effects
                const worsenedEffects = { ...disease.effects };
                Object.keys(worsenedEffects).forEach(stat => {
                  const statKey = stat as keyof typeof worsenedEffects;
                  if (typeof worsenedEffects[statKey] === 'number' && worsenedEffects[statKey]! < 0) {
                    (worsenedEffects[statKey] as number) = (worsenedEffects[statKey] as number) * 1.1; // 10% worse
                  }
                });
                updatedDiseases[index] = {
                  ...disease,
                  effects: worsenedEffects,
                };
              }
            } else if (disease.treatmentRequired && disease.curable) {
              // Curable diseases that require treatment - can worsen if not treated
              const weeksWithDisease = 'contractedWeek' in disease && typeof disease.contractedWeek === 'number'
                ? nextWeeksLived - disease.contractedWeek
                : 0;

              // Higher chance of worsening the longer it's untreated
              if (weeksWithDisease > 2) {
                const complicationChance = Math.min(0.15, weeksWithDisease * 0.05); // Up to 15% chance
                if (preRolls.diseaseComplication[index] < complicationChance) {
                  // Disease worsens - could progress to more severe
                  if (disease.severity === 'mild' && preRolls.diseaseProgression[index] < 0.3) {
                    // 30% chance to progress to serious
                    const worsenedEffects = { ...disease.effects };
                    Object.keys(worsenedEffects).forEach(stat => {
                      const statKey = stat as keyof typeof worsenedEffects;
                      if (typeof worsenedEffects[statKey] === 'number' && worsenedEffects[statKey]! < 0) {
                        (worsenedEffects[statKey] as number) = (worsenedEffects[statKey] as number) * 1.5; // 50% worse
                      }
                    });
                    updatedDiseases[index] = {
                      ...disease,
                      severity: 'serious',
                      effects: worsenedEffects,
                    };
                  } else {
                    // Just increase effects
                    const worsenedEffects = { ...disease.effects };
                    Object.keys(worsenedEffects).forEach(stat => {
                      const statKey = stat as keyof typeof worsenedEffects;
                      if (typeof worsenedEffects[statKey] === 'number' && worsenedEffects[statKey]! < 0) {
                        (worsenedEffects[statKey] as number) = (worsenedEffects[statKey] as number) * 1.2; // 20% worse
                      }
                    });
                    updatedDiseases[index] = {
                      ...disease,
                      effects: worsenedEffects,
                    };
                  }
                }
              }
            }

            // Handle death countdown
            if ('weeksUntilDeath' in disease && typeof disease.weeksUntilDeath === 'number') {
              const updatedWeeksUntilDeath = disease.weeksUntilDeath - 1;
              if (updatedWeeksUntilDeath <= 0) {
                // Death triggered
                diseaseDeathTriggered = true;
                diseaseDeathReason = 'health';
                updatedDiseaseHistory = {
                  ...updatedDiseaseHistory,
                  deathsFromDisease: updatedDiseaseHistory.deathsFromDisease + 1,
                };
              } else {
                // Update countdown
                updatedDiseases[index] = {
                  ...disease,
                  weeksUntilDeath: updatedWeeksUntilDeath,
                };
              }
            }

            // Handle natural recovery
            if ('naturalRecoveryWeeks' in disease && typeof disease.naturalRecoveryWeeks === 'number') {
              let recoveryWeeks = disease.naturalRecoveryWeeks - 1;

              // Faster recovery with good health/fitness
              if (newStats.health > 70) {
                recoveryWeeks -= 0.5; // Recover faster
              }
              if (newStats.fitness > 50) {
                recoveryWeeks -= 0.5;
              }

              if (recoveryWeeks <= 0) {
                // Disease naturally recovered
                diseasesToRemove.push(index);
                updatedDiseaseHistory = {
                  ...updatedDiseaseHistory,
                  totalCured: updatedDiseaseHistory.totalCured + 1,
                  diseases: updatedDiseaseHistory.diseases.map(d =>
                    d.id === disease.id && !d.curedWeek
                      ? { ...d, curedWeek: nextWeeksLived }
                      : d
                  ),
                };
              } else {
                updatedDiseases[index] = {
                  ...disease,
                  naturalRecoveryWeeks: Math.max(0, Math.ceil(recoveryWeeks)),
                };
              }
            }
          });

          // Remove naturally recovered diseases (in reverse order to maintain indices)
          diseasesToRemove.reverse().forEach(index => {
            updatedDiseases.splice(index, 1);
          });

          // Apply disease effects to stats
          Object.entries(diseaseEffects).forEach(([stat, value]) => {
            const statKey = stat as keyof typeof newStats;
            if (typeof value === 'number') {
              const currentValue = (newStats[statKey] as number) || 0;
              (newStats as Record<string, number>)[statKey] = Math.max(0, Math.min(100, currentValue + value));
            }
          });

          // Update death state if disease triggered death
          if (diseaseDeathTriggered) {
            newShowDeathPopup = true;
            newDeathReason = diseaseDeathReason;
          }

          // ============================================================
          // PET WEEKLY PROCESSING — aging, stat decay, death, bonuses
          // ============================================================
          // PET_LIFESPANS imported from @/lib/config/gameConstants
          const PET_WEEKLY_FOOD_COST = 15; // $15/week per pet for basic food
          let updatedPets = (prevState.pets || []).map((pet, petIdx) => {
            if (pet.isDead) return pet; // Skip dead pets

            const newPet = { ...pet };

            // Age: +1 week
            newPet.age = (newPet.age || 0) + 1;

            // Hunger increases (needs feeding) — +8 per week
            newPet.hunger = Math.min(100, (newPet.hunger || 0) + 8);

            // Happiness decays if hungry or neglected — -5 if hunger > 60
            if (newPet.hunger > 60) {
              newPet.happiness = Math.max(0, (newPet.happiness || 50) - 5);
            }

            // Health decays if very hungry — -3 if hunger > 80
            if (newPet.hunger > 80) {
              newPet.health = Math.max(0, (newPet.health || 50) - 3);
            }

            // Sickness chance: 2% per week, higher if health < 40
            if (!newPet.isSick && preRolls.petSickness[petIdx] < (newPet.health < 40 ? 0.06 : 0.02)) {
              const sicknesses = ['cold', 'infection', 'parasite', 'injury'];
              newPet.isSick = true;
              newPet.sickness = sicknesses[Math.floor(preRolls.petSicknessType[petIdx] * sicknesses.length)];
              newPet.health = Math.max(0, (newPet.health || 50) - 10);
            }

            // Sick pets lose health each week
            if (newPet.isSick) {
              newPet.health = Math.max(0, (newPet.health || 0) - 5);
            }

            // Death check: zero health for 3+ weeks, or exceeded lifespan
            const lifespanWeeks = (PET_LIFESPANS[newPet.type] || 10) * WEEKS_PER_YEAR;
            if (newPet.health <= 0) {
              newPet.weeksAtZeroHealth = (newPet.weeksAtZeroHealth || 0) + 1;
              if (newPet.weeksAtZeroHealth >= 3) {
                newPet.isDead = true;
              }
            } else {
              newPet.weeksAtZeroHealth = 0;
            }

            // Natural death from old age
            if (newPet.age >= lifespanWeeks) {
              newPet.isDead = true;
            }

            return newPet;
          });

          // Pet death notifications & player stat impact
          const newlyDeadPets = updatedPets.filter(p => p.isDead && !(prevState.pets || []).find(op => op.id === p.id)?.isDead);
          if (newlyDeadPets.length > 0) {
            newlyDeadPets.forEach(pet => {
              newStats.happiness = Math.max(0, newStats.happiness - 20);
              pendingNotifications.push({ id: `pet-death-${pet.id}`, message: `Your beloved ${pet.name} the ${pet.type} has passed away. Rest in peace.`, title: 'Pet Loss' });
            });
          }

          // ============================================================
          // VEHICLE WEEKLY PROCESSING — maintenance, fuel, condition, accidents
          // ============================================================
          let updatedVehicles = (prevState.vehicles || []).map((vehicle, vehIdx) => {
            if (!vehicle || !vehicle.owned) return vehicle;
            const v = { ...vehicle };

            // Deduct weekly maintenance + fuel cost
            const weeklyCost = (v.weeklyMaintenanceCost || 0) + (v.weeklyFuelCost || 0);
            newStats.money = Math.max(0, newStats.money - weeklyCost);

            // Condition degrades ~1% per week (driving wear)
            v.condition = Math.max(0, (v.condition || 100) - VEHICLE_WEEKLY_CONDITION_DECAY);

            // Mileage increases ~200 miles/week
            v.mileage = (v.mileage || 0) + VEHICLE_WEEKLY_MILEAGE;

            // Insurance: no weekly charge — premium is paid upfront in purchaseInsurance()

            // Accident chance: 1% per week, higher if condition < 30
            if (preRolls.vehicleAccident[vehIdx] < (v.condition < 30 ? VEHICLE_ACCIDENT_POOR_CONDITION_CHANCE : VEHICLE_ACCIDENT_BASE_CHANCE)) {
              const severities = ['minor', 'moderate', 'severe'] as const;
              const severity = severities[Math.floor(preRolls.vehicleAccidentSeverity[vehIdx] * severities.length)];
              const damage = severity === 'minor' ? 15 : severity === 'moderate' ? 30 : 60;
              v.condition = Math.max(0, v.condition - damage);

              // Player health impact
              const healthLoss = severity === 'minor' ? 3 : severity === 'moderate' ? 10 : 25;
              newStats.health = Math.max(0, newStats.health - healthLoss);

              // Repair cost (partially covered by insurance)
              const repairCost = Math.floor(v.price * damage * 0.001);
              const coveragePercent = v.insurance?.active ? (v.insurance.coveragePercent || 0) : 0;
              const outOfPocket = Math.floor(repairCost * (1 - coveragePercent / 100));
              newStats.money = Math.max(0, newStats.money - outOfPocket);

              pendingNotifications.push({ id: `vehicle-accident-${v.id}`, message: `Your ${v.name} was in a ${severity} accident! Condition: -${damage}%, Health: -${healthLoss}. Repair cost: $${outOfPocket.toLocaleString()}.`, title: 'Vehicle Accident' });
            }

            return v;
          });

          // Vehicle reputation: best owned vehicle gives a gentle rep nudge
          const vehicleRepBonus = Math.max(0, ...updatedVehicles.filter(v => v?.owned).map(v => v?.reputationBonus || 0));
          if (vehicleRepBonus > 0 && newStats.reputation < vehicleRepBonus * 3) {
            newStats.reputation = Math.min(100, newStats.reputation + 1);
          }

          // Pet bonuses to player: happy, healthy pets boost happiness +2 each
          const alivePets = updatedPets.filter(p => !p.isDead);
          const petHappinessBonus = alivePets.reduce((sum, p) =>
            (p.happiness || 0) > 50 && (p.health || 0) > 30 ? sum + 2 : sum, 0);
          if (petHappinessBonus > 0) {
            newStats.happiness = Math.min(100, newStats.happiness + petHappinessBonus);
          }

          // Pet food costs: deduct basic food per alive pet
          const petFoodCost = alivePets.length * PET_WEEKLY_FOOD_COST;
          if (petFoodCost > 0) {
            newStats.money = Math.max(0, newStats.money - petFoodCost);
          }

          // Housing happiness bonus from current residence
          if (housingHappinessBonus > 0) {
            newStats.happiness = Math.min(100, newStats.happiness + housingHappinessBonus);
          }

          // CRITICAL: Cap stats to valid ranges (0-100) after all calculations
          newStats.energy = Math.max(0, Math.min(100, typeof newStats.energy === 'number' ? newStats.energy : 0));
          newStats.health = Math.max(0, Math.min(100, typeof newStats.health === 'number' ? newStats.health : 0));
          newStats.happiness = Math.max(0, Math.min(100, typeof newStats.happiness === 'number' ? newStats.happiness : 0));
          newStats.fitness = Math.max(0, Math.min(100, typeof newStats.fitness === 'number' ? newStats.fitness : 0));

          // ── ENGAGEMENT: Lucky Bonus System (variable ratio reinforcement) ──
          // Unpredictable rewards on week advance create anticipation and excitement
          let luckyBonus = 0;
          let luckyMessage = '';
          let luckyTier: 'small' | 'medium' | 'rare' | undefined;
          const weeklyIncome = careerSalary + passiveIncome;
          if (weeklyIncome > 0) {
            // Use deterministic seed so luck is consistent per week (no save-scumming)
            const luckSeed = ((nextWeeksLived || 0) * 777 + 42) % 100;
            const luckyCharmActive = prevState.legacyBuffs?.luckyCharm &&
              prevState.legacyBuffs.luckyCharm.expiresWeeksLived > (nextWeeksLived || 0);
            const luckyCharmBoost = luckyCharmActive ? 10 : 0; // +10% chance with lucky charm
            if (luckSeed < 1 + luckyCharmBoost) {
              // 1% (or 11% with charm): Rare lucky bonus
              luckyBonus = Math.round(weeklyIncome * 10);
              luckyMessage = 'Incredible luck! A rare opportunity paid off big!';
              luckyTier = 'rare';
            } else if (luckSeed < 6 + luckyCharmBoost) {
              // 5% (or 15%): Medium lucky bonus
              luckyBonus = Math.round(weeklyIncome * 3);
              luckyMessage = 'Lucky week! An unexpected bonus came your way.';
              luckyTier = 'medium';
            } else if (luckSeed < 20 + luckyCharmBoost) {
              // 15% (or 25%): Small lucky bonus
              luckyBonus = Math.round(weeklyIncome * 0.5);
              luckyMessage = 'A small windfall this week!';
              luckyTier = 'small';
            }
          }
          if (luckyBonus > 0) {
            newStats.money = Math.max(0, newStats.money + luckyBonus);
          }

          // ── ENGAGEMENT: Play Streak System (loss aversion) ──
          // Track consecutive play sessions within 48h — streaks give income bonus
          const now = preRolls.timestamp;
          const lastPlayTs = prevState.playStreak?.lastPlayTimestamp || 0;
          const hoursSinceLastPlay = lastPlayTs > 0 ? (now - lastPlayTs) / (1000 * 60 * 60) : 999;
          const streakContinues = hoursSinceLastPlay < 48;
          const newStreakCount = streakContinues ? (prevState.playStreak?.count || 0) + 1 : 1;
          const streakBonusPercent = Math.min(newStreakCount * 2, 20); // +2% per streak, max +20%
          const streakBonusAmount = weeklyIncome > 0 ? Math.round(weeklyIncome * streakBonusPercent / 100) : 0;
          if (streakBonusAmount > 0) {
            newStats.money = Math.max(0, newStats.money + streakBonusAmount);
          }
          const updatedPlayStreak = {
            count: newStreakCount,
            lastPlayTimestamp: now,
            longestStreak: Math.max(newStreakCount, prevState.playStreak?.longestStreak || 0),
          };

          // ── ENGAGEMENT: Legacy Points (mini-prestige every 10 weeks) ──
          let newLegacyPoints = prevState.legacyPoints || 0;
          if ((nextWeeksLived || 0) > 0 && (nextWeeksLived || 0) % 10 === 0) {
            const pointsEarned = Math.floor((nextWeeksLived || 0) / 10) +
              (prevState.prestige?.prestigeLevel || 0) * 2;
            newLegacyPoints += pointsEarned;
            logger.info(`[ENGAGEMENT] Legacy Points earned: +${pointsEarned} (total: ${newLegacyPoints})`);
          }

          // ── WEEKLY CHALLENGE: Update progress ──
          let updatedWeeklyChallenge = prevState.weeklyChallenge;
          try {
            const { getOrRotateWeeklyChallenge, evaluateChallengeProgress } = require('@/lib/challenges/weeklyChallenges');
            // Build a temporary state snapshot for evaluation
            const evalState = { ...prevState, stats: newStats, weeksLived: nextWeeksLived };
            updatedWeeklyChallenge = getOrRotateWeeklyChallenge(evalState);
            if (updatedWeeklyChallenge && !updatedWeeklyChallenge.completed && !updatedWeeklyChallenge.rewardClaimed) {
              const progress = evaluateChallengeProgress(updatedWeeklyChallenge.challengeId, evalState);
              updatedWeeklyChallenge = {
                ...updatedWeeklyChallenge,
                progress: progress.map((p: any) => ({
                  objectiveId: p.id ?? p.objectiveId,
                  current: p.current ?? 0,
                  target: p.target ?? 0,
                  met: p.completed ?? p.met ?? false,
                })),
                completed: progress.every((p: any) => p.completed ?? p.met),
              };
            }
          } catch (wcErr) {
            logger.error('[WEEKLY_CHALLENGE] Progress update failed:', wcErr);
          }

          // Build week result for the result sheet
          const totalExpenses = incomeTax + weeklyRent + totalLoanAutoPaid + petFoodCost + housingUpkeep;
          const weekResult = {
            luckyBonus: luckyBonus > 0 ? luckyBonus : undefined,
            luckyMessage: luckyMessage || undefined,
            luckyTier,
            streakBonus: streakBonusAmount > 0 ? streakBonusAmount : undefined,
            incomeEarned: totalIncome + luckyBonus + streakBonusAmount,
            expensesPaid: Math.round(totalExpenses),
            netChange: Math.round(totalIncome + luckyBonus + streakBonusAmount - totalExpenses),
            careerProgressPercent: (() => {
              const activeCareer = (updatedCareers || []).find((c: any) => c?.id === newCurrentJob && c?.accepted);
              return activeCareer?.progress || 0;
            })(),
          };

          // ── CLIFFHANGER ROLL: ~12% chance to set a teaser for next week ──
          let newPendingCliffhanger = undefined;
          try {
            const { rollCliffhanger } = require('@/lib/events/cliffhangerEvents');
            const cliffResult = rollCliffhanger(
              { ...prevState, weeksLived: nextWeeksLived, pendingCliffhanger: prevState.pendingCliffhanger },
              nextWeeksLived
            );
            if (cliffResult) {
              newPendingCliffhanger = {
                teaser: cliffResult.teaser,
                resolveEventId: cliffResult.resolveEventId,
                setWeeksLived: nextWeeksLived + 1,
              };
              // Attach teaser to weekResult so the sheet can display it
              (weekResult as any).cliffhangerTeaser = cliffResult.teaser;
              logger.info(`[CLIFFHANGER] Set: "${cliffResult.teaser}"`);
            }
          } catch (cliffErr) {
            logger.error('[CLIFFHANGER] Roll failed:', cliffErr);
          }

          return {
            ...prevState,
            careers: updatedCareers,
            currentJob: newCurrentJob,
            educations: updatedEducations,
            week: nextWeek,
            weeksLived: nextWeeksLived,
            bankSavings: newBankSavings,
            loans: processedLoans,
            updatedAt: preRolls.timestamp,
            date: {
              week: nextWeek,
              age: nextAge,
              year: nextYear,
              month: nextMonth,
            },
            stats: newStats,
            // Death warning system tracking
            healthZeroWeeks: newHealthZeroWeeks,
            happinessZeroWeeks: newHappinessZeroWeeks,
            showZeroStatPopup: newShowZeroStatPopup,
            zeroStatType: newZeroStatType,
            showDeathPopup: newShowDeathPopup,
            deathReason: newDeathReason,
            // Ribbon: classify life and add to collection on death
            ...(newShowDeathPopup && !prevState.showDeathPopup ? (() => {
              try {
                const { classifyLife, addRibbonToCollection } = require('@/lib/legacy/ribbonSystem');
                const ribbon = classifyLife({ ...prevState, stats: newStats, weeksLived: nextWeeksLived });
                const updatedCollection = addRibbonToCollection(
                  prevState.ribbonCollection,
                  ribbon,
                  { ...prevState, stats: newStats, weeksLived: nextWeeksLived }
                );
                logger.info(`[RIBBON] Life classified as: ${ribbon.name} (${ribbon.emoji})`);
                return { ribbonCollection: updatedCollection };
              } catch (ribbonErr) {
                logger.error('[RIBBON] Classification failed:', ribbonErr);
                return {};
              }
            })() : {}),
            showWeddingPopup: newShowWeddingPopup,
            weddingPartnerName: newWeddingPartnerName,
            // CRITICAL: Cap energy to 0-100 after all calculations (regen + penalties)
            // Capping already performed on newStats object above before return statement

            // Reset weekly counters every time we advance a week
            // These counters track how many times each job/activity was done THIS week
            weeklyStreetJobs: {}, // Always reset when advancing week
            weeklyJailActivities: {}, // Always reset when advancing week
            // Decrease jail time by 1 week when advancing, or add police encounter jail time
            jailWeeks: policeEncounterJailWeeks > 0
              ? policeEncounterJailWeeks
              : (prevState.jailWeeks > 0 ? Math.max(0, prevState.jailWeeks - 1) : 0),
            // Wanted level decay
            wantedLevel: newWantedLevel,
            // BUG FIX: Apply auto-reinvest stock purchases
            // CRITICAL: Update all holdings' currentPrice to match updated stock prices after simulateWeek()
            stocks: (() => {
              const holdingsToUpdate = reinvestedStocks.length > 0 ? reinvestedStocks : prevState.stocks?.holdings || [];
              const validHoldings = holdingsToUpdate.filter(h => h && typeof h === 'object' && h.symbol);
              const updatedHoldings = validHoldings.map(holding => {
                const stockInfo = getStockInfo(holding.symbol.toUpperCase());
                // Sync currentPrice with the updated stock price from simulateWeek()
                return {
                  ...holding,
                  currentPrice: stockInfo.price > 0 ? stockInfo.price : holding.currentPrice,
                };
              });

              return {
                holdings: updatedHoldings,
                watchlist: prevState.stocks?.watchlist || [],
                realizedGains: prevState.stocks?.realizedGains || 0,
                savedMarketPrices: getStockPricesSnapshot(), // Persist market prices to prevent save/reload exploit
              };
            })(),
            // Process weddings, pregnancy, and relationship health
            relationships: processedRelationships,
            // Update family with newborn children
            family: newBornChildren.length > 0 ? {
              ...prevState.family,
              children: [
                ...(prevState.family?.children || []),
                ...newBornChildren.map(child => ({ ...child, birthWeeksLived: nextWeeksLived })),
              ],
            } : prevState.family,
            // Add birth milestone
            lifeMilestones: newBornChildren.length > 0 ? [
              ...(prevState.lifeMilestones || []),
              ...newBornChildren.map(child => ({
                id: `child_birth_${nextWeeksLived}_${child.id}`,
                type: 'child_birth' as const,
                week: nextWeek,
                year: nextYear,
                details: { childId: child.id, childName: child.name, gender: child.gender },
              })),
            ] : (prevState.lifeMilestones || []),
            // Hobbies removed - no longer validating hobby skills
            hobbies: prevState.hobbies || [],
            // Add crypto from warehouse mining
            cryptos: updatedCryptos,
            // Degrade miner durability over time
            warehouse: updatedWarehouse,
            // Add new weekly events to pendingEvents
            pendingEvents: updatedPendingEvents,
            // Update economy state
            economy: updatedEconomy,
            // Update last event week for pity system
            lastEventWeeksLived: newEvents.length > 0 ? nextWeeksLived : prevState.lastEventWeeksLived,
            // Life Moments & Consequence System (NEW)
            consequenceState: mergedConsequenceState,
            lifeMoments: updatedLifeMoments,
            // Disease System
            diseases: updatedDiseases,
            showSicknessModal: showSicknessModal,
            lastDiseaseWeek: lastDiseaseWeek,
            diseaseHistory: updatedDiseaseHistory,
            // Pet System — weekly aging, stat decay, death
            pets: updatedPets,
            // Vehicle System — maintenance, condition, accidents
            vehicles: updatedVehicles,
            // Housing System — updated properties with condition, value, etc.
            realEstate: updatedRealEstate,
            // Education System — campus events
            ...(pendingCampusEvent ? { pendingCampusEventEducationId: pendingCampusEvent } : {}),
            // Engagement Systems
            playStreak: updatedPlayStreak,
            weekResult,
            legacyPoints: newLegacyPoints,
            // Cliffhanger: clear if resolved, set if new one rolled
            pendingCliffhanger: newPendingCliffhanger,
            // Weekly themed challenge progress
            weeklyChallenge: updatedWeeklyChallenge,
            // Time Machine: auto-checkpoint every year + before death
            ...(() => {
              try {
                const { shouldAutoCheckpoint, createCheckpoint, addCheckpoint } = require('@/lib/timeMachine/checkpointSystem');
                let currentCheckpoints = prevState.checkpoints ?? [];

                // Auto-checkpoint every ~year (WEEKS_PER_YEAR weeks)
                if (shouldAutoCheckpoint(nextWeeksLived)) {
                  const yearAge = Math.floor(ADULTHOOD_AGE + nextWeeksLived / WEEKS_PER_YEAR);
                  const cp = createCheckpoint(
                    { ...prevState, stats: newStats, weeksLived: nextWeeksLived },
                    `Age ${yearAge}`
                  );
                  currentCheckpoints = addCheckpoint(currentCheckpoints, cp);
                }

                // Before-death checkpoint — snapshot the PREVIOUS week's state (before death-triggering decay)
                if (newShowDeathPopup && !prevState.showDeathPopup) {
                  const deathCp = createCheckpoint(
                    prevState,
                    'Before Death'
                  );
                  currentCheckpoints = addCheckpoint(currentCheckpoints, deathCp);
                }

                return { checkpoints: currentCheckpoints };
              } catch (cpErr) {
                logger.error('[TIME_MACHINE] Checkpoint error:', cpErr);
                return {};
              }
            })(),
          };
        } catch (error) {
          // CRITICAL: If state update fails, log error and return previous state
          stateUpdateError = error instanceof Error ? error : new Error(String(error));
          logger.error('[WEEK PROGRESSION] Error in setGameState callback:', stateUpdateError);
          // Return previous state unchanged to prevent corruption
          return prevState;
        }
      });

      setLoadingProgress(100);

      // CRITICAL: Check if state update failed
      if (stateUpdateError) {
        logger.error('[WEEK PROGRESSION] State update failed, aborting week progression:', stateUpdateError);
        setIsLoading(false);
        showError('Progression Error', 'Failed to update game state. Please try again.');
        return;
      }

      logger.info('Advanced to next week with stat decay applied');

      // PERF FIX: Flush batched notifications in a single timeout instead of N individual ones.
      // This reduces event loop pressure from ~10+ timeouts/week to exactly 1.
      if (pendingNotifications.length > 0) {
        setTimeout(() => {
          for (const n of pendingNotifications) {
            showWarning(n.id, n.message, n.title);
          }
        }, 100);
      }

      // ENGAGEMENT: Milestone proximity hints — "just one more week" pull
      // Shows a motivational notification when player is close to a milestone
      try {
        const { MILESTONE_MONEY_THRESHOLDS, MILESTONE_PROXIMITY_PERCENT } = require('@/lib/config/gameConstants');
        const currentState = gameStateRef.current;
        if (currentState) {
          const currentMoney = currentState.stats?.money || 0;
          for (const threshold of MILESTONE_MONEY_THRESHOLDS) {
            if (currentMoney < threshold && currentMoney >= threshold * (1 - MILESTONE_PROXIMITY_PERCENT)) {
              const remaining = threshold - currentMoney;
              const formatted = remaining >= 1000 ? `$${(remaining / 1000).toFixed(1)}k` : `$${remaining}`;
              setTimeout(() => {
                showWarning('milestone-hint', `${formatted} away from $${threshold >= 1000 ? (threshold / 1000).toLocaleString() + 'k' : threshold}!`, 'Almost There');
              }, 2000); // Delay so it shows after other notifications
              break; // Only show one hint per week
            }
          }
        }
      } catch (e) {
        // Non-critical — don't break week progression for milestone hints
      }

      // CRITICAL: Validate state after update to ensure no corruption
      // Use a small delay to ensure state has updated
      await new Promise(resolve => setTimeout(resolve, 50));
      const updatedState = gameStateRef.current;
      if (updatedState) {
        const validation = validateGameState(updatedState, true); // Auto-fix if possible
        if (!validation.valid) {
          logger.error('[WEEK PROGRESSION] State validation failed after update:', validation.errors);
          // Attempt repair
          const repairResult = repairGameState(updatedState);
          if (repairResult.repaired) {
            logger.warn('[WEEK PROGRESSION] Repaired corrupted state:', repairResult.repairs);
            // Update state with repaired version
            setGameState(prev => {
              const repaired = repairGameState(prev);
              return repaired.repaired ? { ...prev } : prev; // repairGameState mutates in-place, spread to signal React
            });
          } else {
            logger.error('[WEEK PROGRESSION] State corruption detected and could not be repaired');
            showError('State Error', 'Game state became corrupted. Please reload your save.');
            setIsLoading(false);
            return;
          }
        }
      }

      // A-3: Periodic relationship validation + repair (every 10 weeks) to catch children sync drift
      if (updatedState && (updatedState.weeksLived || 0) % 10 === 0) {
        try {
          const relValidation = validateRelationshipState(updatedState);
          if (!relValidation.isValid) {
            logger.warn('[WEEK PROGRESSION] Relationship state issues detected:', relValidation.issues);
            // Auto-repair children sync drift
            setGameState(prev => {
              const repairedState = repairRelationshipState(prev);
              return repairedState;
            });
            logger.info('[WEEK PROGRESSION] Applied relationship state repair');
          }
        } catch (relError) {
          // Non-fatal: relationship validation failure should never block gameplay
          logger.error('[WEEK PROGRESSION] Relationship validation error:', relError);
        }
      }

      // If death was triggered, stop loading immediately so death popup can show
      // CRITICAL: Stop loading synchronously to prevent blocking the death popup
      if (deathTriggered) {
        setIsLoading(false);
        setLoadingMessage('');
        logger.warn('[DEATH] Death triggered - stopped loading immediately to show death popup');
        // Early return to prevent any further processing
        return;
      }

      // Normal completion - stop loading
      setIsLoading(false);

      // Process automation rules (if enabled)
      const currentState = gameStateRef.current;
      if (currentState) {
        try {
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          const { processAutomationRules } = require('@/lib/automation/automationEngine');
          const executions = processAutomationRules(currentState);

          if (executions.length > 0) {
            // Calculate total money spent by successful automation actions
            const totalAutomationCost = executions
              .filter(e => e.success)
              .reduce((sum, e) => sum + e.actionsTaken
                .filter(a => a.result === 'success')
                .reduce((s, a) => s + (a.value || 0), 0), 0);

            // Update state with automation execution history AND apply money changes
            setGameState(prevState => {
              if (!prevState.automation) return prevState;

              const currentHistory = prevState.automation.executionHistory || [];
              const newHistory = [...currentHistory, ...executions].slice(-50);

              // Deduct automation costs from player money
              const currentMoney = prevState.stats?.money || 0;
              const newMoney = totalAutomationCost > 0
                ? Math.max(0, currentMoney - totalAutomationCost)
                : currentMoney;

              return {
                ...prevState,
                stats: {
                  ...prevState.stats,
                  money: newMoney,
                },
                automation: {
                  ...prevState.automation,
                  executionHistory: newHistory,
                },
              };
            });

            logger.info(`[AUTOMATION] Executed ${executions.length} rules, cost $${totalAutomationCost}`);
          }
        } catch (error) {
          logger.error('[AUTOMATION] Failed to process automation rules:', error);
          // Don't block week progression if automation fails
        }
      }

      // Auto-save after week progression (non-blocking)
      saveGame(false).catch(err => {
        logger.warn('Auto-save after nextWeek failed (will retry):', err);
      });
    } catch (error) {
      logger.error('Failed to progress to next week:', error);
      showError('Progression Error', 'Failed to advance to next week');
      setIsLoading(false);
    } finally {
      // ANTI-EXPLOIT: Release the week progression guard
      nextWeekInProgressRef.current = false;
    }
  }, [setGameState, setIsLoading, setLoadingMessage, setLoadingProgress, showError, showWarning, saveGame]);

  // Ref to track resolving events (prevent duplicates)
  const resolvingEventsRef = useRef<Set<string>>(new Set());

  const resolveEvent = useCallback((eventId: string, choiceId: string) => {
    if (!gameStateRef.current) return;

    haptic.light(); // Soft tap for event choice
    logger.info('Resolving event:', { eventId, choiceId });

    const resolutionKey = `${eventId}_${choiceId}`;

    // Prevent duplicate calls
    if (resolvingEventsRef.current.has(resolutionKey)) {
      logger.warn('Event already being resolved, skipping duplicate call:', { eventId, choiceId });
      return;
    }
    resolvingEventsRef.current.add(resolutionKey);

    setGameState(prevState => {
      try {
        // Find the event in pendingEvents
        const eventIndex = prevState.pendingEvents?.findIndex(e => e.id === eventId) ?? -1;
        if (eventIndex === -1) {
          logger.warn('Event not found in pendingEvents:', { eventId });
          resolvingEventsRef.current.delete(resolutionKey);
          return prevState;
        }

        const event = prevState.pendingEvents[eventIndex];

        // Find the choice
        const choice = event.choices?.find(c => c.id === choiceId);
        if (!choice) {
          logger.warn('Choice not found in event:', { eventId, choiceId });
          resolvingEventsRef.current.delete(resolutionKey);
          return prevState;
        }

        // Apply effects - CRITICAL: Preserve all state properties
        const effects = choice.effects || {};

        // Start with a deep copy of the state to preserve everything
        const updatedStats = { ...prevState.stats };

        // Apply money change
        if (effects.money !== undefined) {
          const currentMoney = updatedStats.money || 0;
          updatedStats.money = Math.max(0, currentMoney + effects.money);
        }

        // Apply stat changes
        if (effects.stats) {
          Object.entries(effects.stats).forEach(([key, value]) => {
            if (typeof value === 'number' && key in updatedStats) {
              const statKey = key as keyof typeof updatedStats;
              const currentVal = (updatedStats[statKey] as number) || 0;
              // Clamp stats to 0-100 range
              const newVal = Math.max(0, Math.min(100, currentVal + value));
              (updatedStats as Record<string, number>)[statKey] = newVal;
            }
          });
        }

        // Apply relationship change
        let updatedRelationships = prevState.relationships || [];
        if (effects.relationship !== undefined && event.relationId) {
          updatedRelationships = updatedRelationships.map(rel => {
            if (rel.id === event.relationId) {
              const updated = {
                ...rel,
                relationshipScore: Math.max(0, Math.min(100, (rel.relationshipScore || 50) + effects.relationship!)),
              };
              // Wedding event: promote partner to spouse when player chooses 'marry'
              if (eventId === 'wedding' && choiceId === 'marry' && rel.type === 'partner') {
                (updated as Record<string, unknown>).type = 'spouse';
                logger.info(`[WEDDING] ${rel.name} changed from partner to spouse via event`);
              }
              return updated;
            }
            return rel;
          });
        }

        // Apply pet changes
        let updatedPets = prevState.pets || [];
        if (effects.pet && event.relationId) {
          updatedPets = updatedPets.map(pet => {
            if (pet.id === event.relationId) {
              return {
                ...pet,
                hunger: Math.max(0, Math.min(100, (pet.hunger || 50) + (effects.pet!.hunger || 0))),
                happiness: Math.max(0, Math.min(100, (pet.happiness || 50) + (effects.pet!.happiness || 0))),
                health: Math.max(0, Math.min(100, (pet.health || 50) + (effects.pet!.health || 0))),
              };
            }
            return pet;
          });
        }

        // Handle special effects
        let updatedDiseases = prevState.diseases || [];
        let showSicknessModal = prevState.showSicknessModal;
        let updatedDiseaseHistory = prevState.diseaseHistory || {
          diseases: [],
          totalDiseases: 0,
          totalCured: 0,
          deathsFromDisease: 0,
        };

        if (choice.special) {
          // Handle special effects like 'grant_free_education'
          if (choice.special === 'grant_free_education') {
            // Grant the player a reputation bonus for education opportunity
            updatedStats.reputation = Math.min(100, (updatedStats.reputation || 0) + 10);
            logger.info('Free education bonus granted');
          }

          // Handle disease addition from events
          if (choice.special === 'add_disease' && 'diseaseId' in choice && typeof choice.diseaseId === 'string') {
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            const { generateSpecificDisease } = require('@/lib/diseases/diseaseGenerator');
            const eventDisease = generateSpecificDisease(choice.diseaseId, prevState);

            if (eventDisease) {
              // Check if disease already exists
              const diseaseExists = updatedDiseases.some(d => d.id === eventDisease.id);
              if (!diseaseExists) {
                updatedDiseases.push(eventDisease);
                showSicknessModal = true;

                // Update disease history
                updatedDiseaseHistory = {
                  ...updatedDiseaseHistory,
                  diseases: [
                    ...updatedDiseaseHistory.diseases,
                    {
                      id: eventDisease.id,
                      name: eventDisease.name,
                      contractedWeek: prevState.weeksLived || 0,
                      severity: eventDisease.severity,
                    },
                  ],
                  totalDiseases: updatedDiseaseHistory.totalDiseases + 1,
                };
              }
            }
          }
        }

        // Handle career special effects: fire_from_job, add_career_warning
        let updatedCurrentJob = prevState.currentJob;
        let updatedCareersFromEvent = prevState.careers;

        if (choice.special === 'fire_from_job' && prevState.currentJob) {
          // Fire the player from their current job
          updatedCurrentJob = undefined;
          // Reset the career's accepted/applied status so they can reapply later
          updatedCareersFromEvent = (prevState.careers || []).map(c => {
            if (c.id === prevState.currentJob) {
              return { ...c, accepted: false, applied: false, progress: 0, performance: undefined, warningsReceived: 0 };
            }
            return c;
          });
          logger.info('Player fired from job:', { job: prevState.currentJob });
        }

        if (choice.special === 'add_career_warning' && prevState.currentJob) {
          // Add a formal warning to the career
          updatedCareersFromEvent = (updatedCareersFromEvent || prevState.careers || []).map(c => {
            if (c.id === prevState.currentJob && c.accepted) {
              return { ...c, warningsReceived: (c.warningsReceived || 0) + 1 };
            }
            return c;
          });
          logger.info('Career warning added:', { job: prevState.currentJob });
        }

        // Determine event category (needed for consequence tracking)
        const seasonalEventIds = ['spring_festival', 'garden_event', 'beach_party', 'summer_sale', 'harvest_festival', 'career_fair', 'winter_holidays', 'new_year', 'valentines_day', 'halloween', 'christmas', 'easter_egg_hunt', 'spring_cleaning', 'summer_music_festival', 'national_holiday', 'thanksgiving_feast', 'black_friday_sale', 'new_years_resolution', 'winter_market'];
        const economicEventIds = ['economic_recession', 'economic_boom', 'market_crash', 'inflation_spike', 'job_market_shift', 'economic_event_end'];
        const personalCrisisEventIds = ['medical_emergency', 'identity_theft', 'investment_opportunity', 'job_offer', 'relationship_crisis', 'legal_issue'];

        let eventCategory: 'regular' | 'seasonal' | 'economic' | 'personal_crisis' = 'regular';
        if (seasonalEventIds.includes(eventId)) {
          eventCategory = 'seasonal';
        } else if (economicEventIds.includes(eventId)) {
          eventCategory = 'economic';
        } else if (personalCrisisEventIds.includes(eventId)) {
          eventCategory = 'personal_crisis';
        }

        // Apply hidden consequences (NEW - enhances existing system)
        const { initializeConsequenceState } = require('@/lib/lifeMoments/consequenceTracker');
        const { createMemoryFromChoice } = require('@/lib/lifeMoments/memoryIntegration');
        const enhancedChoice = choice as import('@/lib/events/engine').EnhancedEventChoice;

        let updatedConsequenceState: any = undefined;
        let updatedMemories: any = undefined;

        if (enhancedChoice.hiddenConsequences && enhancedChoice.hiddenConsequences.length > 0) {
          const { applyChoiceConsequences } = require('@/lib/lifeMoments/consequenceTracker');
          const consequenceResult = applyChoiceConsequences(
            prevState,
            eventId,
            choiceId,
            enhancedChoice.hiddenConsequences,
            eventCategory // Use the eventCategory determined above
          );

          // Merge consequence state with existing state
          const currentConsequenceState = initializeConsequenceState(prevState);
          updatedConsequenceState = {
            ...currentConsequenceState,
            ...consequenceResult.updatedState,
            consequences: consequenceResult.newConsequences,
            choiceHistory: consequenceResult.updatedState.choiceHistory || currentConsequenceState.choiceHistory,
          };
        } else {
          // Still record choice in history even without hidden consequences
          const { applyChoiceConsequences } = require('@/lib/lifeMoments/consequenceTracker');
          const consequenceResult = applyChoiceConsequences(
            prevState,
            eventId,
            choiceId,
            undefined,
            eventCategory
          );
          if (consequenceResult.updatedState.choiceHistory) {
            const currentConsequenceState = initializeConsequenceState(prevState);
            updatedConsequenceState = {
              ...currentConsequenceState,
              choiceHistory: consequenceResult.updatedState.choiceHistory,
            };
          }
        }

        // Create memory if specified (NEW - enhances existing system)
        if (enhancedChoice.createsMemory && enhancedChoice.memoryText) {
          const newMemory = createMemoryFromChoice(prevState, eventId, choiceId, enhancedChoice.memoryText);
          updatedMemories = [...(prevState.memories || []), newMemory];
        }

        // Remove event from pendingEvents
        const updatedPendingEvents = [...(prevState.pendingEvents || [])];
        updatedPendingEvents.splice(eventIndex, 1);

        // Add to event log
        const eventLogEntry = {
          id: eventId,
          description: event.description,
          choice: choice.text,
          week: prevState.week || 0,
          year: prevState.date?.year || 2025,
          weeksLived: prevState.weeksLived || 0,
          category: eventCategory,
          effects: {
            money: effects.money,
            stats: effects.stats,
          },
        };

        const updatedEventLog = [...(prevState.eventLog || []), eventLogEntry];

        // Handle follow-up events or event chains
        let finalPendingEvents = updatedPendingEvents;
        try {
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          const { checkForChainedEvent } = require('@/lib/events/lifeEvents');
          const chainedEvent = checkForChainedEvent(eventId, choiceId, prevState.weeksLived || 0);
          if (chainedEvent) {
            const pendingChains = prevState.pendingChainedEvents || [];
            (prevState as Record<string, unknown>).pendingChainedEvents = [...pendingChains, chainedEvent];
            logger.info('Chained event queued:', { eventId: chainedEvent.eventId, triggerWeek: chainedEvent.triggerWeek });
          }
        } catch (e) {
          logger.warn('Failed to check for chained events:', e);
        }

        // Update activeEventChain if this is part of a chain
        let updatedActiveEventChain = prevState.activeEventChain;
        let updatedEventChains = prevState.eventChains || [];
        if (event.chainId) {
          const currentChain = prevState.activeEventChain;
          if (currentChain && currentChain.chainId === event.chainId) {
            // Existing chain — advance or complete
            if (currentChain.currentStage < currentChain.totalStages - 1) {
              updatedActiveEventChain = {
                ...currentChain,
                eventId: eventId,
                currentStage: currentChain.currentStage + 1,
              };
            } else {
              // Chain complete — mark in history
              updatedActiveEventChain = undefined;
              updatedEventChains = [
                ...updatedEventChains,
                {
                  chainId: event.chainId,
                  currentStage: currentChain.totalStages - 1,
                  stages: [],
                  completed: true,
                },
              ];
            }
          } else if (!currentChain && event.chainStage === 0) {
            // Starting a NEW chain from stage 0
            updatedActiveEventChain = {
              chainId: event.chainId,
              eventId: eventId,
              currentStage: 0,
              totalStages: 3, // Default; chains determine this via their stages array
            };
          }
        }

        // Apply karma change if the choice has a karma effect
        let updatedKarma = prevState.karma;
        if (effects.karma) {
          const { applyKarmaChange, INITIAL_KARMA } = require('@/lib/karma/karmaSystem');
          updatedKarma = applyKarmaChange(
            prevState.karma || INITIAL_KARMA,
            effects.karma.dimension,
            effects.karma.amount,
            effects.karma.reason,
            prevState.weeksLived || 0,
          );
        }

        // CRITICAL: Return complete state with all properties preserved
        // Use spread operator to ensure we don't lose any properties
        const newState: GameState = {
          ...prevState, // Preserve ALL existing properties
          stats: updatedStats, // Update stats
          relationships: updatedRelationships, // Update relationships if changed
          pets: updatedPets, // Update pets if changed
          pendingEvents: finalPendingEvents, // Remove resolved event
          eventLog: updatedEventLog, // Add to log
          activeEventChain: updatedActiveEventChain, // Update chain if needed
          eventChains: updatedEventChains, // Update chain history
          ...(updatedConsequenceState && { consequenceState: updatedConsequenceState }), // Add consequence state if updated
          ...(updatedMemories && { memories: updatedMemories }), // Add memories if created
          ...(updatedKarma && { karma: updatedKarma }), // Update karma if changed
          diseases: updatedDiseases, // Update diseases if event triggered one
          showSicknessModal: showSicknessModal, // Show modal if new disease
          diseaseHistory: updatedDiseaseHistory, // Update disease history
          // Career event effects (firing, warnings)
          ...(updatedCurrentJob !== prevState.currentJob && { currentJob: updatedCurrentJob }),
          ...(updatedCareersFromEvent !== prevState.careers && { careers: updatedCareersFromEvent }),
        };

        // Clear the resolving flag after a delay
        setTimeout(() => {
          resolvingEventsRef.current.delete(resolutionKey);
        }, 500);

        logger.info('Event resolved successfully:', { eventId, choiceId, newStateWeek: newState.week, newStateWeeksLived: newState.weeksLived });

        return newState;
      } catch (error) {
        logger.error('Error resolving event:', { eventId, choiceId, error });
        resolvingEventsRef.current.delete(resolutionKey);
        // Return previous state unchanged on error
        return prevState;
      }
    });

    // Auto-save after event resolution (non-blocking)
    setTimeout(() => {
      saveGame(false).catch(err => {
        logger.warn('Auto-save after event resolution failed:', err);
      });
    }, 200);
  }, [setGameState, saveGame]);

  // C-7: Use gameStateRef as fallback to prevent stale closure
  const checkAchievements = useCallback((state?: GameState) => {
    const targetState = state || gameStateRef.current;
    if (!targetState) return;

    try {
      evaluateAchievements(targetState);
    } catch (error) {
      logger.error('Failed to check achievements:', error);
    }
  }, [setGameState]);

  // C-7: Use gameStateRef to prevent stale closure in async callback
  const claimProgressAchievement = useCallback(async (achievementId: string, goldReward: number) => {
    const currentState = gameStateRef.current;
    if (!currentState) {
      logger.error('Cannot claim achievement: gameState is null');
      return;
    }

    try {
      // Check if already claimed
      const claimed = currentState.claimedProgressAchievements || [];
      if (claimed.includes(achievementId)) {
        logger.warn('Achievement already claimed:', { achievementId });
        return;
      }

      // Determine if this is a global claim (gold group achievements)
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { achievements } = require('@/src/features/onboarding/achievementsData');
      const achievement = achievements.find((a: { id: string; group?: string }) => a.id === achievementId);
      // Safe string split - ensure achievementId is not empty
      const group = achievement?.group ?? (achievementId && achievementId.length > 0
        ? achievementId.split('_')[0]
        : 'unknown');
      const isGlobalClaim = group === 'gold';

      haptic.success(); // Achievement unlocked!
      // Update game state with achievement unlock context for narrative display
      const achievementTimestamp = Date.now();
      setGameState(prevState => {
        const newClaimed = [...(prevState.claimedProgressAchievements || []), achievementId];
        const newGems = (prevState.stats.gems || 0) + goldReward;

        return {
          ...prevState,
          claimedProgressAchievements: newClaimed,
          achievementUnlocks: {
            ...(prevState.achievementUnlocks || {}),
            [achievementId]: {
              unlockedAt: achievementTimestamp,
              age: Math.floor(prevState.date?.age || 18),
              weeksLived: prevState.weeksLived || 0,
              money: Math.round(prevState.stats.money || 0),
              year: Math.floor(prevState.date?.year || 2025),
            },
          },
          stats: {
            ...prevState.stats,
            gems: newGems,
          },
        };
      });

      // Save global claim to AsyncStorage if it's a gold group achievement
      if (isGlobalClaim) {
        try {
          const globalClaimed = await AsyncStorage.getItem('globalClaimedAchievements');
          let globalClaimedList: string[] = [];

          if (globalClaimed) {
            try {
              const parsed = JSON.parse(globalClaimed);
              // CRITICAL: Validate that parsed result is an array
              globalClaimedList = Array.isArray(parsed) ? parsed : [];
              if (!Array.isArray(parsed)) {
                logger.warn('globalClaimedAchievements was not an array, resetting to empty array');
              }
            } catch (parseError) {
              logger.error('Failed to parse globalClaimedAchievements, resetting to empty array:', parseError);
              globalClaimedList = [];
            }
          }

          if (!globalClaimedList.includes(achievementId)) {
            globalClaimedList.push(achievementId);
            await AsyncStorage.setItem('globalClaimedAchievements', JSON.stringify(globalClaimedList));
          }
        } catch (storageError) {
          logger.error('Failed to save global claim:', storageError);
        }
      }

      logger.info('Achievement claimed:', { achievementId, goldReward });
    } catch (error) {
      logger.error('Error claiming achievement:', error);
      showError('Claim Error', error instanceof Error ? error.message : 'Failed to claim achievement');
    }
  }, [setGameState, showError]);

  // Core Stats Management
  const updateStats = useCallback((newStats: Partial<GameStats>, updateDailySummary = true) => {
    setGameState(prevState => {
      const updatedStats = { ...prevState.stats };
      const actualChanges: Partial<GameStats> = {};

      // Update provided stats
      Object.entries(newStats).forEach(([key, value]) => {
        if (typeof value === 'number' && key in updatedStats) {
          const statKey = key as keyof GameStats;
          const currentVal = prevState.stats[statKey];
          const newVal = clampStatByKey(statKey, currentVal + value);
          updatedStats[statKey] = newVal as GameStats[keyof GameStats];
          actualChanges[statKey] = newVal - currentVal;
        }
      });

      // Update daily summary if needed
      let dailySummary = prevState.dailySummary;
      if (updateDailySummary) {
        const existingStatsChange = prevState.dailySummary?.statsChange || {};
        const mergedStatsChange = { ...existingStatsChange };

        Object.entries(actualChanges).forEach(([key, value]) => {
          const k = key as keyof GameStats;
          mergedStatsChange[k] = (mergedStatsChange[k] || 0) + (value || 0);
        });

        dailySummary = {
          ...prevState.dailySummary,
          moneyChange: prevState.dailySummary?.moneyChange || 0,
          statsChange: mergedStatsChange,
          events: prevState.dailySummary?.events || [],
        };
      }

      return {
        ...prevState,
        stats: updatedStats,
        dailySummary,
      };
    });
  }, [setGameState]);



  // Update refs when gameState or saveGame changes
  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  useEffect(() => {
    saveGameRef.current = saveGame;
  }, [saveGame]);

  // AppState listener for background saves
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (nextAppState === 'background' || nextAppState === 'inactive') {
        // Save on background/inactive
        const saveFn = saveGameRef.current;
        const currentState = gameStateRef.current;

        // CRASH FIX (B-5): Pause background services to save battery/CPU
        try {
          const { cloudSyncService } = require('@/services/CloudSyncService');
          cloudSyncService.pauseSync();
        } catch (e) {
          // Non-critical
        }

        // More atomic check-and-set
        if (saveFn && currentState) {
          // Check flag and set atomically
          if (isSavingRef.current) {
            logger.debug('Save already in progress, skipping background save');
            return;
          }

          isSavingRef.current = true;

          // Add timeout to prevent hanging
          const savePromise = saveFn(true); // Force save on background
          const timeoutPromise = new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Background save timeout after 10 seconds')), 10000)
          );

          Promise.race([savePromise, timeoutPromise])
            .then(async () => {
              // CRITICAL: Flush queue to ensure persistence before app can be killed
              try {
                const { saveQueue } = await import('@/utils/saveQueue');
                await saveQueue.flushQueue();
              } catch (flushError) {
                logger.warn('Failed to flush queue after background save (non-critical):', { error: flushError });
              }
              isSavingRef.current = false;
              logger.info('Background save completed');
            })
            .catch((error) => {
              logger.error('Failed to save game on background:', error);
              isSavingRef.current = false;
              // Don't show error to user - background saves are silent
            });
        }
      } else if (nextAppState === 'active') {
        // Reset saving flag on resume (with timeout safety)
        // If app was killed mid-save, flag might still be set
        const wasSaving = isSavingRef.current;
        isSavingRef.current = false;

        // If flag was set, add extra safety reset after delay
        if (wasSaving) {
          setTimeout(() => {
            isSavingRef.current = false; // Ensure it's reset
          }, 2000); // 2 second safety window
        }

        // CRASH FIX (B-5): Resume background services on foreground
        try {
          const { cloudSyncService } = require('@/services/CloudSyncService');
          cloudSyncService.resumeSync();

          // A-6: Register conflict callback to show native alert on sync conflict
          const { Alert } = require('react-native');
          cloudSyncService.setConflictCallback((conflict: any) => {
            Alert.alert(
              'Cloud Sync Conflict',
              'Both this device and the cloud have changes. Which version would you like to keep?',
              [
                {
                  text: 'Keep This Device',
                  onPress: () => {
                    // Local wins — next save will overwrite cloud
                    logger.info('[CloudSync] User chose to keep local version');
                  },
                },
                {
                  text: 'Keep Cloud Version',
                  style: 'destructive',
                  onPress: async () => {
                    try {
                      if (conflict.remoteState) {
                        // Validate and repair remote state before applying
                        const repaired = repairGameState(conflict.remoteState);
                        if (repaired.repaired) {
                          logger.warn('[CloudSync] Remote state required repair:', repaired.repairs);
                        }
                        const validation = validateGameState(conflict.remoteState, true);
                        if (!validation.valid) {
                          logger.error('[CloudSync] Remote state failed validation after repair:', validation.errors);
                          return;
                        }
                        setGameState(conflict.remoteState);
                        logger.info('[CloudSync] User chose cloud version — state replaced (validated)');
                      }
                    } catch (err) {
                      logger.error('[CloudSync] Failed to apply cloud state:', err);
                    }
                  },
                },
              ],
              { cancelable: false }
            );
          });
        } catch (e) {
          // Non-critical
        }

        // Validate state on resume
        if (!gameStateRef.current) {
          logger.warn('Game state is null on resume - may need to reload');
        }
      }
    });

    return () => {
      subscription.remove();
    };
  }, []); // Empty deps - uses refs

  // Restore queue on mount
  useEffect(() => {
    // Restore queue on mount
    import('@/utils/saveQueue').then(({ saveQueue }) => {
      saveQueue.restoreOnStartup().catch(err => {
        logger.warn('Failed to restore save queue on startup:', err);
      });
    });
  }, []);

  // Periodic auto-save and state health check during active gameplay
  useEffect(() => {
    // CRASH FIX (A-5): Reduced from 5 minutes to 2 minutes to minimize data loss on iOS kills
    const AUTO_SAVE_INTERVAL_MS = 2 * 60 * 1000; // 2 minutes
    // State health check every 10 minutes
    const HEALTH_CHECK_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes

    const saveIntervalId = setInterval(() => {
      const currentState = gameStateRef.current;
      const saveFn = saveGameRef.current;

      if (currentState && saveFn && !isSavingRef.current) {
        isSavingRef.current = true;
        saveFn(false) // Queue save (non-blocking)
          .then(() => {
            isSavingRef.current = false;
            logger.debug('Periodic auto-save completed');
          })
          .catch((error) => {
            logger.warn('Periodic auto-save failed (will retry):', error);
            isSavingRef.current = false;
          });
      }
    }, AUTO_SAVE_INTERVAL_MS);

    // CRITICAL: Periodic state health check to detect corruption during long sessions
    const healthCheckIntervalId = setInterval(() => {
      const currentState = gameStateRef.current;
      if (currentState) {
        const validation = validateGameState(currentState, true); // Auto-fix if possible
        if (!validation.valid) {
          logger.error('[HEALTH CHECK] State corruption detected during gameplay:', validation.errors);
          // Attempt repair
          const repairResult = repairGameState(currentState);
          if (repairResult.repaired) {
            logger.warn('[HEALTH CHECK] Repaired corrupted state:', repairResult.repairs);
            // Update state with repaired version — spread to create new reference so React detects the change
            setGameState(prev => {
              const repaired = repairGameState(prev);
              return repaired.repaired ? { ...prev } : prev;
            });
          } else {
            logger.error('[HEALTH CHECK] State corruption detected and could not be repaired');
            // Don't show error to user during gameplay - just log it
            // The next save will catch it and show error then
          }
        }
      }
    }, HEALTH_CHECK_INTERVAL_MS);

    return () => {
      clearInterval(saveIntervalId);
      clearInterval(healthCheckIntervalId);
    };
  }, []); // Empty deps - uses refs

  const loadGame = useCallback(async (slot: number): Promise<GameState | null> => {
    await saveLoadMutex.acquire('load');
    try {
      setLoadingMessage('Loading game...');
      setIsLoading(true);

      // CRASH FIX (A-1): Cleanup orphaned temp files and use double-buffer load
      try {
        const { cleanupDoubleBufferOrphans } = await import('@/utils/saveValidation');
        const cleaned = await cleanupDoubleBufferOrphans();
        if (cleaned > 0) {
          logger.debug(`Cleaned up ${cleaned} orphaned temp files on load`);
        }
      } catch (err) {
        logger.warn('Failed to cleanup temp files (non-critical):', { error: err });
      }

      // CRASH FIX (A-1): Use double-buffer load with automatic fallback
      const { doubleBufferLoad, decodePersistedSaveEnvelope, shouldAllowUnsignedLegacySaves } = await import('@/utils/saveValidation');
      const allowLegacy = shouldAllowUnsignedLegacySaves();
      const loadResult = await doubleBufferLoad(`save_slot_${slot}`, AsyncStorage, { allowLegacy });

      if (!loadResult.data) {
        logger.warn('No save data found for slot:', { slot });
        return null;
      }

      if (loadResult.migrated) {
        logger.info(`[LOAD_GAME] Migrated legacy save to double-buffer (source: ${loadResult.source})`);
      }
      if (loadResult.source !== 'none') {
        logger.debug(`[LOAD_GAME] Loaded from double-buffer source: ${loadResult.source}`);
      }

      const savedData = loadResult.data;

      // CRITICAL: Parse with error handling - corrupted JSON can crash the app
      // ANTI-EXPLOIT: Decode and verify canonical save envelope before parsing state
      let parsed: any;
      try {
        const decoded = decodePersistedSaveEnvelope(savedData, { allowLegacy });
        if (!decoded.valid || typeof decoded.data !== 'string') {
          logger.error('[LOAD_GAME] Save envelope verification failed', { slot, error: decoded.error });
          throw new Error(decoded.error || 'Save envelope verification failed');
        }

        parsed = JSON.parse(decoded.data);
      } catch (parseError) {
        logger.error(`Failed to parse save data for slot ${slot}:`, parseError);
        // Try to load from backup
        try {
          const { listBackups, loadBackup } = await import('@/utils/saveBackup');
          const backups = await listBackups(slot);
          if (backups.length > 0) {
            // Try to load the most recent backup
            const latestBackup = backups.sort((a, b) => b.timestamp - a.timestamp)[0];
            const backup = await loadBackup(latestBackup.id);
            if (backup) {
              try {
                const { decodePersistedSaveEnvelope, shouldAllowUnsignedLegacySaves } = require('@/utils/saveValidation');
                const decodedBackup = decodePersistedSaveEnvelope(backup.data, {
                  allowLegacy: shouldAllowUnsignedLegacySaves(),
                });
                if (!decodedBackup.valid || typeof decodedBackup.data !== 'string') {
                  throw new Error(decodedBackup.error || 'Backup envelope verification failed');
                }

                parsed = JSON.parse(decodedBackup.data);
                logger.warn(`Loaded from backup after parse failure: ${latestBackup.id}`);
              } catch (backupParseError) {
                logger.error('Backup also failed to parse:', backupParseError);
                throw new Error('Save data and backup are corrupted. Cannot load game.');
              }
            } else {
              throw new Error('Save data is corrupted and no valid backup found.');
            }
          } else {
            throw new Error('Save data is corrupted and no backups available.');
          }
        } catch (backupError) {
          logger.error('Failed to load from backup:', backupError);
          throw new Error('Save data is corrupted and cannot be loaded.');
        }
      }

      // A-4: Run version migrations BEFORE repair (migrations handle renames/restructures,
      // repair fills remaining defaults)
      try {
        const { runMigrations } = await import('@/utils/saveMigrations');
        const migrationResult = runMigrations(parsed);
        if (migrationResult.migrationsApplied.length > 0) {
          logger.info('[LOAD_GAME] Applied save migrations:', migrationResult.migrationsApplied);
        }
        if (migrationResult.errors.length > 0) {
          logger.error('[LOAD_GAME] Migration errors:', migrationResult.errors);
        }
      } catch (migrationError) {
        logger.error('[LOAD_GAME] Migration system failed (non-fatal, continuing with repair):', migrationError);
      }

      // CRITICAL: Repair and validate state before setting it
      // This prevents corrupted state from being set, even temporarily
      const repairResult = repairGameState(parsed);
      if (repairResult.repaired) {
        logger.warn('Repaired corrupted state during load:', repairResult.repairs);
      }

      // Validate the repaired state
      const validation = validateGameState(parsed, false);
      if (!validation.valid) {
        logger.error('Loaded state failed validation:', validation.errors);
        // Still set the state (callers will validate before navigation)
        // But log the errors for debugging
      }

      // Merge with initialGameState to ensure all required properties exist
      // CRITICAL: parsed values must override initial values to preserve save data
      // CRITICAL FIX: Filter out null values to prevent them from overriding defaults
      const filterNullValues = <T extends Record<string, any>>(obj: T, defaults: T): T => {
        const filtered: any = {};
        for (const key in defaults) {
          const parsedValue = obj?.[key];
          // Use parsed value if it's not null/undefined, otherwise use default
          filtered[key] = (parsedValue !== null && parsedValue !== undefined) ? parsedValue : defaults[key];
        }
        return filtered as T;
      };

      // CRITICAL: Extract children from relationships first (before merging)
      // This ensures children created during onboarding are preserved
      const parsedRelationships = Array.isArray(parsed.relationships) ? parsed.relationships : [];
      const childRelationships = parsedRelationships.filter((r: any) => r.type === 'child');

      // CRITICAL: Load permanent perks and apply them to game state
      let permanentPerks: string[] = [];
      try {
        const { IAPService } = await import('@/services/IAPService');
        permanentPerks = await IAPService.loadPermanentPerks();
        if (permanentPerks.length > 0) {
          logger.info('Loaded permanent perks:', permanentPerks);
        }
      } catch (error) {
        logger.warn('Failed to load permanent perks (non-critical):', { error });
      }

      // B-4: Merge processed IAP transactions from save into global ledger
      // This ensures restored saves don't lose their transaction history
      try {
        const saveTxs = Array.isArray(parsed.processedIAPTransactions) ? parsed.processedIAPTransactions : [];
        if (saveTxs.length > 0) {
          const raw = await AsyncStorage.getItem('iap_processed_transactions');
          let globalTxs: string[] = [];
          if (raw) {
            try {
              const parsed2 = JSON.parse(raw);
              globalTxs = Array.isArray(parsed2) ? parsed2 : [];
            } catch { /* corrupted, reset */ }
          }
          const merged = [...new Set([...globalTxs, ...saveTxs])].slice(-2000);
          if (merged.length > globalTxs.length) {
            await AsyncStorage.setItem('iap_processed_transactions', JSON.stringify(merged));
            logger.info(`[LOAD_GAME] Merged ${merged.length - globalTxs.length} IAP transactions from save into global ledger`);
          }
        }
      } catch (iapMergeError) {
        logger.warn('[LOAD_GAME] Failed to merge IAP transactions (non-critical):', iapMergeError);
      }

      // CRITICAL: Merge family - ensure children from both family.children and relationships are preserved
      let mergedFamily = parsed.family ? { ...parsed.family } : { ...initialGameState.family };
      let mergedChildren = Array.isArray(parsed.family?.children)
        ? [...parsed.family.children]
        : [];

      // CRITICAL: Sync children between family.children and relationships
      // Add any children from relationships that aren't already in family.children
      childRelationships.forEach((childRel: any) => {
        if (!mergedChildren.some((c: any) => c.id === childRel.id)) {
          mergedChildren.push(childRel);
          logger.info('[LOAD_GAME] Added child from relationships to family.children', {
            childId: childRel.id,
            childName: childRel.name
          });
        }
      });

      // CRITICAL: Ensure all children in family.children are also in relationships
      // Add any missing children to relationships array
      const relationshipIds = new Set(parsedRelationships.map((r: any) => r.id));
      mergedChildren.forEach((child: any) => {
        if (!relationshipIds.has(child.id)) {
          parsedRelationships.push(child);
          logger.info('[LOAD_GAME] Added child from family.children to relationships', {
            childId: child.id,
            childName: child.name
          });
        }
      });

      mergedFamily = {
        ...initialGameState.family,
        ...mergedFamily,
        children: mergedChildren,
      };

      // CRITICAL: Build safeState, ensuring relationships and family are set AFTER all spreads
      // This prevents parsed from overwriting our carefully synced arrays
      let safeState: GameState = {
        ...initialGameState,
        ...parsed,
        // Deep merge for nested objects - parsed values override initial values, but null values are filtered out
        stats: parsed.stats ? filterNullValues(parsed.stats, initialGameState.stats) : initialGameState.stats,
        date: parsed.date ? filterNullValues(parsed.date, initialGameState.date) : initialGameState.date,
        settings: parsed.settings ? filterNullValues(parsed.settings, initialGameState.settings) : initialGameState.settings,
        // CRITICAL FIX: Ensure userProfile is properly merged and null values are filtered
        userProfile: parsed.userProfile ? filterNullValues(parsed.userProfile, initialGameState.userProfile) : initialGameState.userProfile,
      };

      // CRITICAL: Override family and relationships AFTER all spreads to ensure our synced arrays are used
      safeState.family = mergedFamily;
      safeState.relationships = parsedRelationships.length > 0 ? parsedRelationships : (initialGameState.relationships || []);

      // Update item descriptions from initialGameState to ensure they're current
      if (Array.isArray(safeState.items) && Array.isArray(initialGameState.items)) {
        safeState.items = safeState.items.map(savedItem => {
          const initialItem = initialGameState.items.find(initItem => initItem.id === savedItem.id);
          if (initialItem && initialItem.description) {
            // Update description if it exists in initial state (preserves owned status and other properties)
            return {
              ...savedItem,
              description: initialItem.description,
            };
          }
          return savedItem;
        });
      }

      // CRITICAL FIX: Ensure userProfile has firstName and lastName (required for validation)
      // If missing or empty, use defaults from name or initial state
      if (!safeState.userProfile) {
        safeState.userProfile = { ...initialGameState.userProfile };
      } else {
        // Ensure firstName and lastName exist and are non-empty
        if (!safeState.userProfile.firstName || safeState.userProfile.firstName.trim() === '') {
          // Try to extract from name if available
          if (safeState.userProfile.name && safeState.userProfile.name.trim() !== '') {
            const nameParts = safeState.userProfile.name.trim().split(/\s+/);
            safeState.userProfile.firstName = nameParts[0] || 'Player';
            safeState.userProfile.lastName = nameParts.slice(1).join(' ') || 'Player';
          } else {
            safeState.userProfile.firstName = initialGameState.userProfile.firstName || 'Player';
            safeState.userProfile.lastName = initialGameState.userProfile.lastName || 'Player';
          }
        }
        if (!safeState.userProfile.lastName || safeState.userProfile.lastName.trim() === '') {
          safeState.userProfile.lastName = initialGameState.userProfile.lastName || 'Player';
        }
        // Ensure name is set if missing
        if (!safeState.userProfile.name || safeState.userProfile.name.trim() === '') {
          safeState.userProfile.name = `${safeState.userProfile.firstName} ${safeState.userProfile.lastName}`.trim() || 'Player';
        }
      }

      // CRITICAL: Apply permanent perks to game state
      if (permanentPerks.length > 0) {
        if (!safeState.perks) {
          safeState.perks = {};
        }
        permanentPerks.forEach(perkId => {
          if (perkId === 'workBoost') safeState.perks!.workBoost = true;
          if (perkId === 'mindset') safeState.perks!.mindset = true;
          if (perkId === 'fastLearner') safeState.perks!.fastLearner = true;
          if (perkId === 'goodCredit') safeState.perks!.goodCredit = true;
          if (perkId === 'unlockAllPerks') safeState.perks!.unlockAllPerks = true;
        });
        logger.info('Applied permanent perks to game state:', permanentPerks);
      }

      const relationshipValidation = validateRelationshipState(safeState);
      if (!relationshipValidation.isValid) {
        logger.warn('[LOAD_GAME] Relationship inconsistencies detected, repairing', {
          issues: relationshipValidation.issues,
        });
        safeState = repairRelationshipState(safeState);
      }

      // ANTI-EXPLOIT: Restore protected state from embedded data if AsyncStorage keys were deleted
      // This prevents death/jail reversal by deleting protected_state keys
      try {
        const { getProtectedState, updateProtectedState } = await import('@/utils/saveBackup');
        const existingProtected = await getProtectedState(slot);
        const embeddedProtected = (safeState as any)._embeddedProtectedState;
        if (!existingProtected && embeddedProtected) {
          // Protected state was deleted from AsyncStorage but exists in save data — restore it
          logger.warn('[LOAD_GAME] Protected state missing from AsyncStorage, restoring from embedded data');
          await updateProtectedState(slot, {
            ...safeState,
            // Merge embedded protected state values back
            showDeathPopup: embeddedProtected.isDead,
            deathReason: embeddedProtected.deathReason,
            jailWeeks: embeddedProtected.jailWeeksRemaining || 0,
            wantedLevel: embeddedProtected.highestWantedLevel || 0,
          });
        }
        // Clean up embedded data from runtime state (not needed in memory)
        delete (safeState as any)._embeddedProtectedState;
      } catch (err) {
        logger.warn('[LOAD_GAME] Failed to restore embedded protected state (non-critical):', { error: err });
      }

      // ANTI-EXPLOIT: Restore stock market prices from saved state to prevent
      // module-level prices from resetting to defaults on app restart
      try {
        const { restoreStockPrices } = require('@/lib/economy/stockMarket');
        const savedMarketPrices = safeState.stocks?.savedMarketPrices;
        if (savedMarketPrices && typeof savedMarketPrices === 'object') {
          restoreStockPrices(savedMarketPrices);
          logger.debug('[LOAD_GAME] Restored stock market prices from save');
        }
      } catch (err) {
        logger.warn('[LOAD_GAME] Failed to restore stock prices (non-critical):', { error: err });
      }

      // CRITICAL: Update the game state with the validated/repaired data
      setGameState(safeState);

      // Sync standalone haptic utility with loaded settings
      if (safeState.settings?.hapticFeedback !== undefined) {
        const { setHapticsEnabled } = require('@/utils/haptics');
        setHapticsEnabled(safeState.settings.hapticFeedback);
      }

      // Keep both slot markers in sync for legacy and new slot authority readers.
      await AsyncStorage.setItem('currentSlot', String(slot));
      await AsyncStorage.setItem('lastSlot', String(slot));

      logger.info('Game loaded successfully from slot:', { slot });

      // CRITICAL: Log child information if present (for debugging single parent scenario)
      if (safeState.family?.children && safeState.family.children.length > 0) {
        logger.info('[LOAD_GAME] Child found in family.children', {
          childrenCount: safeState.family.children.length,
          childIds: safeState.family.children.map(c => c.id),
        });
      }
      if (safeState.relationships && safeState.relationships.some(r => r.type === 'child')) {
        const childRelationships = safeState.relationships.filter(r => r.type === 'child');
        logger.info('[LOAD_GAME] Child found in relationships', {
          childCount: childRelationships.length,
          childIds: childRelationships.map(c => c.id),
        });
      } else {
        logger.warn('[LOAD_GAME] No child found in relationships array', {
          relationshipsCount: safeState.relationships?.length || 0,
          relationshipTypes: safeState.relationships?.map(r => r.type) || [],
        });
      }

      return safeState;
    } catch (error) {
      logger.error('Failed to load game:', error);
      showError('Load Error', 'Failed to load game progress');
      return null;
    } finally {
      setIsLoading(false);
      saveLoadMutex.release();
    }
  }, [setIsLoading, setLoadingMessage, showError, setGameState]);

  // Relationship functions for Contacts app
  const updateRelationship = useCallback((relationshipId: string, change: number) => {
    setGameState(prev => {
      const relationships = (prev.relationships || []).map(r => {
        if (r.id === relationshipId) {
          return {
            ...r,
            relationshipScore: clampRelationshipScore(r.relationshipScore + change),
          };
        }
        return r;
      });

      return { ...prev, relationships };
    });
  }, [setGameState]);

  const recordRelationshipAction = useCallback((relationshipId: string, action: string) => {
    setGameState(prev => {
      const relationships = (prev.relationships || []).map(r => {
        if (r.id === relationshipId) {
          const actions = r.actions || {};
          return {
            ...r,
            actions: {
              ...actions,
              [action]: prev.weeksLived || 0, // Record the absolute week this action was performed
            },
          };
        }
        return r;
      });

      return { ...prev, relationships };
    });
  }, [setGameState]);

  // Relationship Actions
  // C-7: Use gameStateRef to prevent stale closure
  const breakUpWithPartner = useCallback((partnerId: string) => {
    const currentState = gameStateRef.current;
    if (!currentState) return;

    const partner = currentState.relationships?.find(r => r.id === partnerId && r.type === 'partner');
    if (!partner) {
      logger.error('Partner not found for breakup:', partnerId);
      return { success: false, message: 'Partner not found.' };
    }

    setGameState(prev => ({
      ...prev,
      relationships: (prev.relationships || []).filter(r => r.id !== partnerId),
    }));

    updateStats({ happiness: -20 });

    logger.info(`Broke up with partner: ${partner.name}`);
    return {
      success: true,
      message: `You broke up with ${partner.name}. ðŸ'”`
    };
  }, [setGameState, updateStats]);

  // C-7: Use gameStateRef to prevent stale closure
  const proposeToPartner = useCallback((partnerId: string) => {
    const currentState = gameStateRef.current;
    if (!currentState) return;

    const partner = currentState.relationships?.find(r => r.id === partnerId && r.type === 'partner');
    if (!partner) {
      logger.error('Partner not found for proposal:', partnerId);
      return { success: false, message: 'Partner not found.' };
    }

    if (partner.relationshipScore < 80) {
      return { success: false, message: 'Your relationship needs to be stronger before proposing.' };
    }

    if (currentState.stats.money < 5000) {
      return { success: false, message: 'You need at least $5,000 for a proper proposal.' };
    }

    // Set engagement week
    setGameState(prev => ({
      ...prev,
      relationships: (prev.relationships || []).map(r =>
        r.id === partnerId ? { ...r, engagementWeek: prev.weeksLived || 0 } : r
      ),
    }));

    updateMoney(-5000, `Engagement ring for ${partner.name}`);
    updateStats({ happiness: 15 });

    logger.info(`Proposed to partner: ${partner.name}`);
    return {
      success: true,
      message: `ðŸ' You proposed to ${partner.name}! She's said YES! ðŸŽ‰`
    };
  }, [setGameState, updateMoney, updateStats]);

  // C-7: Use gameStateRef to prevent stale closure
  const moveInTogether = useCallback((partnerId: string) => {
    const currentState = gameStateRef.current;
    if (!currentState) return;

    const partner = currentState.relationships?.find(r => r.id === partnerId && r.type === 'partner');
    if (!partner) {
      logger.error('Partner not found for moving in:', partnerId);
      return { success: false, message: 'Partner not found.' };
    }

    if (partner.relationshipScore < 60) {
      return { success: false, message: 'Your relationship needs to be stronger before moving in together.' };
    }

    // Check if player owns (and has moved into) or rents any real estate property
    const hasProperty = (currentState.realEstate || []).some(property => {
      const status = 'status' in property ? property.status : undefined;

      // Check if player owns the property and has moved in
      // Status must be 'owner' (not 'rented' which means they rented it out)
      const ownsAndLivingIn = property.owned && status === 'owner';

      // Check if player rents the property (status is 'rented' and owned is false)
      // This means player is renting it, not that they rented it out to someone else
      const rentsProperty = status === 'rented' && !property.owned;

      return ownsAndLivingIn || rentsProperty;
    });

    if (!hasProperty) {
      return {
        success: false,
        message: 'You need to own and move into a property, or rent a property before you can move in together. Purchase or rent one from the Real Estate app!'
      };
    }

    setGameState(prev => ({
      ...prev,
      relationships: (prev.relationships || []).map(r =>
        r.id === partnerId ? { ...r, livingTogether: true } : r
      ),
    }));

    updateStats({ happiness: 10 });

    logger.info(`Moved in with partner: ${partner.name}`);
    return {
      success: true,
      message: `ðŸ  You and ${partner.name} are now living together!`
    };
  }, [setGameState, updateStats]);

  // C-7: Use gameStateRef to prevent stale closure
  const fileDivorceAction = useCallback((spouseId: string, lawyerId?: string) => {
    const currentState = gameStateRef.current;
    if (!currentState) return;
    return fileDivorce(currentState, setGameState, spouseId, {
      updateMoney: updateMoneyAction,
      updateStats: updateStatsAction
    }, lawyerId);
  }, [setGameState]);

  // Save a permanent perk to storage (cross-slot persistence)
  const savePermanentPerk = useCallback(async (perkId: string): Promise<void> => {
    try {
      const { IAPService } = await import('@/services/IAPService');
      await IAPService.savePermanentPerk(perkId);
    } catch (error) {
      logger.error(`Failed to save permanent perk ${perkId}:`, error);
      throw error;
    }
  }, []);

  // Check if a permanent perk exists
  const hasPermanentPerk = useCallback(async (perkId: string): Promise<boolean> => {
    try {
      const { IAPService } = await import('@/services/IAPService');
      return await IAPService.hasPermanentPerk(perkId);
    } catch (error) {
      logger.error(`Failed to check permanent perk ${perkId}:`, error);
      return false;
    }
  }, []);

  // Execute prestige - reset character based on chosen path
  // C-7: Use gameStateRef to prevent stale closure passing stale state to executePrestigeFunction
  const executePrestigeAction = useCallback((chosenPath: 'reset' | 'child', childId?: string) => {
    const currentState = gameStateRef.current;
    if (!currentState) {
      logger.error('[executePrestige] gameState is null');
      return;
    }

    try {
      haptic.heavy(); // Prestige — major life event
      const newGameState = executePrestigeFunction(currentState, chosenPath, childId);
      setGameState(newGameState);
      logger.info(`[executePrestige] Prestige executed: path=${chosenPath}, childId=${childId || 'none'}`);

      // Save after prestige
      const slotToUse = (currentSlot >= 1 && currentSlot <= 3) ? currentSlot : 1;
      const gameData = {
        ...newGameState,
        lastSaved: new Date().toISOString(),
        updatedAt: Date.now(),
        version: initialState.version || 1,
      };
      queueSave(slotToUse, gameData).catch(err => {
        logger.error('[executePrestige] Failed to queue save:', err);
      });
    } catch (error) {
      logger.error('[executePrestige] Error:', error);
      showError('Prestige Error', 'Failed to execute prestige. Please try again.');
    }
  }, [setGameState, currentSlot, initialState.version, showError]);

  const value = useMemo<GameActionsContextType>(() => ({
    nextWeek,
    resolveEvent,
    checkAchievements,
    claimProgressAchievement,
    updateStats,
    updateMoney,
    updateRelationship,
    recordRelationshipAction,
    breakUpWithPartner,
    proposeToPartner,
    moveInTogether,
    fileDivorce: fileDivorceAction,
    saveGame,
    loadGame,
    savePermanentPerk,
    hasPermanentPerk,
    executePrestige: executePrestigeAction,
  }), [nextWeek, resolveEvent, checkAchievements, claimProgressAchievement, updateStats, updateMoney, updateRelationship, recordRelationshipAction, breakUpWithPartner, proposeToPartner, moveInTogether, fileDivorceAction, saveGame, loadGame, savePermanentPerk, hasPermanentPerk, executePrestigeAction]);

  return (
    <GameActionsContext.Provider value={value}>
      {children}
    </GameActionsContext.Provider>
  );
}
