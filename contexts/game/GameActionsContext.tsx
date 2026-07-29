// cspell:words uuidv Regen UIUX Minigame watchlist Nyke Adidaz Pooma Reebock Cardano Solana Polkadot Chainlink giga tera networth
// NOTE: Actions have been split into focused context files to reduce bundle size and improve maintainability:
// - MoneyActionsContext: money, economy, IAP, crypto
// - JobActionsContext: jobs, careers, criminal activities, jail
// - ItemActionsContext: items, purchases, hobbies, food
// - SocialActionsContext: relationships, dating, family

import React, { createContext, useContext, useCallback, ReactNode, useRef, useEffect, useMemo } from 'react';
import { lazyAsyncStorage as AsyncStorage } from '@/utils/storageWrapper';
import { AppState, AppStateStatus } from 'react-native';
import { logger } from '@/utils/logger';
import { useGameState } from './GameStateContext';
import { useGameUI } from './GameUIContext';
import { useMoneyActions } from './MoneyActionsContext';
import { useUIUX } from '@/contexts/UIUXContext';
import { evaluateAchievements } from '@/lib/progress/achievements';
import { GameState, GameStats, Relationship, Disease } from './types';
import { getStatDecayMultiplier } from '@/lib/prestige/applyBonuses';
import { calcWeeklyPassiveIncome, getPoliticalWeeklySalary } from '@/lib/economy/passiveIncome';
import { tickProfiler } from '@/utils/tickProfiler';
import { simulateWeek, getStockPricesSnapshot } from '@/lib/economy/stockMarket';
import { processAutomationRules } from '@/lib/automation/automationEngine';
import { buyStockMarket } from '@/contexts/game/actions/StockActions';
import { isPristineUnstartedState, repairGameState, validateGameState } from '@/utils/saveValidation';
import { validateRelationshipState, repairRelationshipState } from '@/utils/relationshipValidation';
import { clampRelationshipScore } from '@/utils/stateValidation';
import { clampStatByKey } from '@/utils/statUtils';
import { initialGameState, STATE_VERSION } from './initialState';
import { fileDivorce } from './actions/DatingActions';
import { queueSave, forceSave } from '@/utils/saveQueue';
import { isWritableSlot } from '@/utils/slotNumber';
import { isSaveFromFutureError } from '@/utils/saveMigrations';
import { haptic } from '@/utils/haptics';
import { makeWeeklyRoll } from '@/utils/seededRoll';
import { createBackupFromState } from '@/utils/saveBackup';
import { saveLoadMutex } from '@/utils/saveLoadMutex';
import { executePrestige as executePrestigeFunction } from '@/lib/prestige/prestigeExecution';
import { PRESTIGE_ACHIEVEMENTS, type PrestigeAchievement } from '@/lib/prestige/prestigeAchievements';
import { awardLegacyPassXp } from './actions/LegacyPassActions';
import { LEGACY_PASS_XP, getCurrentSeasonId, getClaimableCount } from '@/lib/legacyPass/legacyPass';
import { track } from '@/lib/analytics';
import { updateMoney as updateMoneyAction, applyMoneyDelta, MONEY_CEILING } from './actions/MoneyActions';
import { updateStats as updateStatsAction } from './actions/StatsActions';
import { runWeeklyBankingTick } from '@/lib/banking/weeklyTick';
import { runCryptoWeeklyTick } from '@/lib/crypto/weeklyTick';
import { runDarkWebWeeklyTick } from '@/lib/darkweb/weeklyTick';
import { runPoliticsWeeklyTick } from '@/lib/politics/weeklyTick';
import { runStocksWeeklyTick } from '@/lib/stocks/weeklyTick';
// R3-A: hoist the modules previously `require()`'d inside the `nextWeek`
// updater. The per-call require() lookups were a constant overhead AND the
// wrapping try/catch blocks disabled JIT optimization for the entire ~1500-line
// updater function. With these as ES imports, the JIT can finally inline the
// updater and tests can mock via jest.mock(...) at the test setup layer.
import { getStockInfo, restoreStockPrices, getAllStockSymbols, adjustStockPrice } from '@/lib/economy/stockMarket';
import { accumulateDividendsThisYear } from '@/lib/stocks/dividends';
import { initializeConsequenceState, applyChoiceConsequences } from '@/lib/lifeMoments/consequenceTracker';
import { getEnergyRegenMultiplier } from '@/lib/prestige/applyBonuses';
import { getLifeSkillModifiers } from '@/lib/skillTrees/lifeSkillEffects';
import { processPulseWeeklyTick } from '@/lib/social/pulseTick';
import { processSparkWeeklyTick } from '@/lib/dating/sparkTick';
import { processHustleWeeklyTick } from '@/lib/business/hustleTick';
import { generateRandomDisease, generateSpecificDisease } from '@/lib/diseases/diseaseGenerator';
import { getOrRotateWeeklyChallenge, evaluateChallengeProgress, getWeeklyChallengeDefinition } from '@/lib/challenges/weeklyChallenges';
import { createMemoryFromChoice } from '@/lib/lifeMoments/memoryIntegration';
import { checkForChainedEvent, FOLLOW_UP_EVENTS } from '@/lib/events/lifeEvents';
import { advanceEventChain, healLatchedEventChain } from '@/lib/events/engine';
import type { WeeklyEvent } from '@/lib/events/engine';
import { applyKarmaChange, getKarmaModifiers, INITIAL_KARMA } from '@/lib/karma/karmaSystem';
import { applyRelationshipGain } from '@/lib/skillTrees/lifeSkillEffects';
import {
 MINER_PRICES,
 calculateIncomeTax,
} from '@/lib/economy/constants';
import {
 WEEKS_PER_YEAR,
 ADULTHOOD_AGE,
 PET_LIFESPANS,
 VEHICLE_WEEKLY_MILEAGE,
 VEHICLE_WEEKLY_CONDITION_DECAY,
 VEHICLE_ACCIDENT_BASE_CHANCE,
 VEHICLE_ACCIDENT_POOR_CONDITION_CHANCE,
} from '@/lib/config/gameConstants';
// R7 Phase 2 step 2.1: pre-tick helpers extracted from the inline updater.
// `calculateNetWorth`, `computeDecayInputs`, and `buildPreRolls` were
// previously defined here at lines 92-212 / 388-420 / 451-478. Moving them
// out shrinks `nextWeek()` (helps the JIT inline the smaller hot function)
// and lets the equivalence-test battery in __tests__/refactor lock in the
// current behavior. Byte-identical output verified by snapshot tests.
import {
  calculateNetWorth,
  computeDecayInputs,
  buildPreRolls,
} from './actions/weekly/preTick';
import {
  tickPetsForWeek,
  applyPetDeathSideEffects,
  applyPetLivingSideEffects,
  PET_WEEKLY_FOOD_COST,
} from './actions/weekly/applyPets';
import { applyVehiclesForWeek } from './actions/weekly/applyVehicles';
import { applyLuxuryItemsForWeek } from './actions/weekly/applyLuxuryItems';
import { applyIdentityForWeekFromState } from './actions/weekly/applyIdentity';
import { computePresence } from '@/lib/identity';
import { applySubscriptionsForWeek } from './actions/weekly/applySubscriptions';
import { isLuxuryLifeComplete } from '@/lib/luxury';
import { applyDiseasesForWeek } from './actions/weekly/applyDiseases';
import { computeWeeklyIncome } from './actions/weekly/applyIncome';
import { getRetirementIncomeWeekly } from '@/lib/retirement';
import { applyAutoReinvest } from './actions/weekly/applyAutoReinvest';
import { applyRentAndHousing } from './actions/weekly/applyRentAndHousing';
import { computeSavingsInterest } from './actions/weekly/applySavingsInterest';
import { applyLoanAutopay } from './actions/weekly/applyLoanAutopay';
import { applySavingsGoals } from './actions/weekly/applySavingsGoals';
import { applyContentMemberships } from './actions/weekly/applyContentMemberships';
import { creatorLevelFromExperience, creatorPerkTier } from '@/lib/content/creatorLevel';
import { expireFavors } from '@/lib/contacts/favors';
import { summarizeWeeklyFinance } from './actions/weekly/summarizeWeeklyFinance';
import { applyDietPlanForWeek } from './actions/weekly/applyDietPlan';
import { applyCareerSalaryAndPenalty } from './actions/weekly/applyCareerSalaryAndPenalty';
import { applyCareerApplications } from './actions/weekly/applyCareerApplications';
import { applyCareerProgress } from './actions/weekly/applyCareerProgress';
import { applyEducationStress } from './actions/weekly/applyEducationStress';
import { applyEducationProgression, needsEducationProgressionTick } from './actions/weekly/applyEducationProgression';
import { applyCrimeTick } from './actions/weekly/applyCrimeTick';
import { applyMiningCryptos } from './actions/weekly/applyMiningCryptos';
import { applyMiningWarehouse } from './actions/weekly/applyMiningWarehouse';
import { applyNPCDepthTick } from './actions/weekly/applyNPCDepthTick';
import { applyChildAging } from './actions/weekly/applyChildAging';
import { applyScheduledWedding } from './actions/weekly/applyScheduledWedding';
import { findCommittedPartner } from '@/lib/dating/relationshipGuards';
import { clearPromotedSparkMatch } from '@/lib/dating/sparkStats';
import { applyPregnancyProgression } from './actions/weekly/applyPregnancyProgression';
import { applyRelationshipHealth } from './actions/weekly/applyRelationshipHealth';
import { applyAnniversaries, type AnniversaryResult } from './actions/weekly/applyAnniversaries';
import { applyEconomicEvent } from './actions/weekly/applyEconomicEvent';
import { applyWeeklyEvents } from './actions/weekly/applyWeeklyEvents';
import { resolveFamilySpouse } from './actions/weekly/resolveFamilySpouse';
import { applyCliffhangerResolution } from './actions/weekly/applyCliffhangerResolution';
import { FEATURE_FLAGS } from '@/lib/config/featureFlags';
import { applyLifeMoment } from './actions/weekly/applyLifeMoment';
import { applyConsequenceProgression } from './actions/weekly/applyConsequenceProgression';
import { applyDeathRibbon } from './actions/weekly/applyDeathRibbon';
import { applyAutoCheckpoint } from './actions/weekly/applyAutoCheckpoint';
import { applyLifetimeStatistics } from './actions/weekly/applyLifetimeStatistics';
import { applyCliffhangerRoll } from './actions/weekly/applyCliffhangerRoll';
import type { WeekContext } from './actions/weekly/weekContext';

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
 // P3-11: always returns an object — the previous `| void` confused callers
 // that pattern-match on undefined.
 proposeToPartner: (partnerId: string) => { success: boolean; message: string };
 moveInTogether: (partnerId: string) => { success: boolean; message: string } | void;
 fileDivorce: (spouseId: string, lawyerId?: string) => { success: boolean; message: string; settlement?: number; lawyerResult?: any } | void;

 // Save & Load (core functionality)
 // saveGame resolves true only when the save actually happened: force=true →
 // the write completed and was verified on disk; force=false → the save was
 // queued. Resolves false on validation-abort or any caught save error (it
 // never rejects for those). Callers that must confirm durability — e.g.
 // exactly-once grant finalization — pass force=true and check the result.
 saveGame: (force?: boolean) => Promise<boolean>;
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
 const { gameState, setGameState, currentSlot, setCurrentSlot } = useGameState();
 const { setIsLoading, setLoadingProgress, setLoadingMessage } = useGameUI();
 const { updateMoney } = useMoneyActions();
 // NOTE: gameplay notifications use `showInfoBanner` (friendly, auto-dismissing) — not
 // `showWarning`, whose orange AlertTriangle banner never auto-dismissed and piled
 // up after week/job actions (the "old warning symbols" players were seeing).
 // `showWarning` is reserved for genuinely actionable problems.
 const { showError, showWarning, showInfoBanner } = useUIUX();

 // Refs for AppState listener (prevents stale closures)
 const gameStateRef = useRef<GameState | null>(null);
 const isSavingRef = useRef(false);
 const saveGameRef = useRef<((force?: boolean) => Promise<boolean>) | null>(null);

 // Save & Load Actions - MOVED BEFORE nextWeek TO FIX HOISTING
 const saveGame = useCallback(async (force: boolean = false): Promise<boolean> => {
 // Use ref to get current state (prevents stale closure)
 const currentState = gameStateRef.current;
 if (!currentState) {
 logger.warn('Cannot save: game state is null');
 return false;
 }
 // Never persist the pristine boot state (no scenario, no name). The
 // background/periodic autosave fires even while the user is still on the
 // main menu of a clean install; writing the untouched default created a
 // phantom "Unnamed Character" save in slot 1. Applies to forced saves too.
 if (isPristineUnstartedState(currentState)) {
 logger.debug('Skipping save: no life started yet (pristine initial state)');
 return false;
 }
 const saveMutexToken = await saveLoadMutex.acquire('save');
 try {
 // CRITICAL: Validate state before saving to prevent saving corrupted state.
 // R2-F: autoFix=false. The repair branch below runs explicitly when validation
 // fails, so the eager clone inside autoFix=true was a 30-80ms hitch on every
 // save (every 2 minutes by autosave + after every nextWeek).
 const validation = validateGameState(currentState, false);
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
 return result.repaired ? {...prev }: prev;
 });
 // Re-validate after repair
 const revalidation = validateGameState(gameStateRef.current, false);
 if (!revalidation.valid) {
 logger.error('[SAVE] State still invalid after repair, aborting save');
 showError('Save Error', 'Game state is corrupted and could not be repaired. Please reload your save.');
 return false;
 }
 } else {
 logger.error('[SAVE] State corruption detected and could not be repaired, aborting save');
 showError('Save Error', 'Game state is corrupted and could not be saved. Please reload your save.');
 return false;
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

 // Refuse rather than redirect. This used to coerce an unknown slot to 1 and
 // commit the write there — the one thing you must not do when you have just
 // established that you do not know where this save belongs.
 // 2026-07-29 audit SAVE-OW-6.
 if (!isWritableSlot(currentSlot)) {
 logger.error('[SAVE] Refusing to save: no valid slot is loaded', { currentSlot });
 return false;
 }
 const slotToUse = currentSlot;

 // Create backup before save (non-blocking)

 // P1-12: fire-and-forget the backup. The previous Promise.race "timeout"
 // didn't actually cancel the underlying write — it just stopped awaiting,
 // so a slow backup kept running and stacked up against the next autosave's
 // backup. Letting it run in the background avoids the stacked-IO pileup
 // that produced the ~10s freezes on slow devices.
 void createBackupFromState(slotToUse, stateToPersist, 'auto_save').catch((err) => {
 logger.warn('Backup creation failed (non-critical):', { error: err });
 });

 // Prepare game data with metadata (use captured state).
 //
 // P0-11: Do NOT blindly stamp `version: STATE_VERSION`. If the in-memory
 // state's version is lower (partial migration crashed mid-way, or a
 // legacy load that hasn't completed migration yet), stamping it as the
 // current STATE_VERSION makes the next loader skip all migrations and
 // leaves fields like state.darkWeb.heat undefined → crash on access.
 // Only stamp STATE_VERSION when the in-memory version is missing/older
 // than CURRENT — never downgrade from a future-state save either.
 const stateVersionField = (stateToPersist as { version?: unknown }).version;
 const inMemoryVersion = typeof stateVersionField === 'number' ? stateVersionField : 0;
 // P0-11 / C1: preserve ANY valid in-memory version (>= 1) — only stamp
 // STATE_VERSION when it's missing/invalid (0). The previous `>= STATE_VERSION`
 // check force-upgraded a half-migrated save (e.g. v15 after a mid-chain
 // migration failure) up to current, so the next load saw version === current,
 // skipped migrations 16-19, and later crashed on undefined nested fields
 // (state.darkWeb.heat, banking.creditScore). Keeping the low version lets
 // runMigrations re-run and self-heal. Future-version saves are still preserved
 // (never downgraded).
 const versionToWrite = inMemoryVersion >= 1 ? inMemoryVersion : STATE_VERSION;
 const gameData = {
...stateToPersist,
 lastSaved: new Date().toISOString(),
 updatedAt: Date.now(),
 version: versionToWrite,
 };

 // Use save queue (handles atomic save, retries, quota)
 if (force) {
 // C-1 (R8): saveGame already holds saveLoadMutex (acquired at the top of this
 // function). Tell forceSave NOT to re-acquire it — the mutex is non-reentrant,
 // so a nested acquire self-deadlocks until the 30s watchdog and then
 // double-releases, corrupting concurrent slot writes (this fires on every IAP).
 await forceSave(slotToUse, gameData, false);
 } else {
 await queueSave(slotToUse, gameData);
 }

 logger.info('Game save queued successfully', { slot: slotToUse });
 return true;
 } catch (error) {
 logger.error('Failed to queue save:', error);
 showError('Save Error', 'Failed to save game progress. Will retry automatically.');
 return false;
 } finally {
 saveLoadMutex.release(saveMutexToken);
 }
 }, [currentSlot, showError]);

 // ANTI-EXPLOIT: Guard against rapid nextWeek() calls (race condition)
 const nextWeekInProgressRef = useRef(false);

 // Core Game Progression Actions
 const nextWeek = useCallback(async () => {
 const gameState = gameStateRef.current;
 if (!gameState) return;
 // M-2 (R8): never advance a week while the death popup is up. The DeathPopup
 // modal normally blocks taps, but a programmatic call, automation, or an
 // AppState-resume race could otherwise tick a dead character (income, aging,
 // a new disease, even a second death-reason overwrite). Revival/prestige
 // clears showDeathPopup before resuming, so this only blocks the dead state.
 if (gameState.showDeathPopup) {
 logger.debug('[WEEK PROGRESSION] Skipped nextWeek: death popup is showing');
 return;
 }
 // ANTI-EXPLOIT: Prevent concurrent week advances from rapid button mashing
 if (nextWeekInProgressRef.current) return;
 nextWeekInProgressRef.current = true;

 haptic.medium(); // Tactile tick for week advance
 setIsLoading(true);
 setLoadingMessage('Progressing to next week...');
 setLoadingProgress(0);

 try {
 // R7 Phase 2 step 2.1: decay-input computation extracted to
 // ./actions/weekly/preTick.ts. Same inputs, same output, same logger
 // calls — verified by __tests__/refactor/subsystemEquivalence.test.ts.
 const prestigeMultiplier = getStatDecayMultiplier(gameState.prestige?.unlockedBonuses || []);
 const decayInputs = computeDecayInputs(gameState, {
   baseDecayRate: 4,
   prestigeMultiplier,
 });
 // `safeNetWorth` is referenced below in the lifetimeStatistics block.
 const { netWorth, safeNetWorth, effectiveDecayRate, graceFactor } = decayInputs;

 logger.info(`[WEEK PROGRESSION] Net worth: $${netWorth}, Decay rate: ${effectiveDecayRate}, Grace factor: ${graceFactor.toFixed(2)}, Prestige multiplier: ${prestigeMultiplier}`);

 // CRITICAL: Simulate stock market price changes for the week
 // ANTI-EXPLOIT: Pass weeksLived so seeded PRNG produces deterministic prices per week
 // This prevents save/reload manipulation of stock prices
 try {
 // Get policy effects if available
 const policyEffects = gameState.politics?.activePolicyEffects?.stocks;
 const currentWeeksLived = typeof gameState.weeksLived === 'number' ? gameState.weeksLived: 0;
 simulateWeek(policyEffects, currentWeeksLived);
 } catch (simError) {
 logger.error('[WEEK PROGRESSION] Stock market simulation failed:', simError);
 // Continue progression even if stock sim fails
 }

 // CRITICAL: Get updated stock prices after simulation.
 // R3-A: `getStockInfo` is now an ES import at top of file.

 // Track if death was triggered during state update
 let deathTriggered = false;
 let stateUpdateError: Error | null = null;
 // PERF (freeze fix): capture the exact post-tick state the updater computes so
 // the post-update validation/automation/save can use it WITHOUT waiting on the
 // gameStateRef (which only updates via a post-commit useEffect — the reason the
 // old code stalled a hard 50ms every Next Week).
 let postTickState: GameState | null = null;

 // PERF FIX: Collect notifications during week progression and flush them in a single
 // setTimeout afterward. Previously, each notification was its own setTimeout inside
 // setGameState, accumulating hundreds of pending callbacks over 5-10 minutes of play.
 const pendingNotifications: { id: string; message: string; title: string }[] = [];

 // PRE-ROLLS: R7 Phase 2 step 2.1 — extracted to ./actions/weekly/preTick.ts
 // (`buildPreRolls`). Every Math.random() and Date.now() that the updater
 // will consume is pre-rolled here, BEFORE setGameState, so React StrictMode
 // double-invocation produces identical results both times.
 const preRolls = buildPreRolls();
 // H-12 (R8): pre-roll the old-age death draw OUTSIDE the updater. A bare
 // Math.random() inside the setGameState updater is double-invoked by React 19
 // StrictMode (and any future concurrent re-render), so the player could "die"
 // on a discarded pass while the committed pass survived, or vice-versa.
 // Pre-rolling makes both invocations see the same outcome — matching the rest
 // of the buildPreRolls() determinism architecture.
 const oldAgeDeathRoll = Math.random();

 setGameState(prevState => {
 // CRITICAL: Wrap entire state update in try-catch to prevent silent failures
 try {
 tickProfiler.beginTick();

      const currentWeeksLived = typeof prevState.weeksLived === 'number' &&!isNaN(prevState.weeksLived) && prevState.weeksLived >= 0
 ? prevState.weeksLived
: 0;
 const nextWeeksLived = currentWeeksLived + 1;
 // Keep week as UI-only week-of-month. Absolute time is weeksLived.
 const nextWeek = ((nextWeeksLived % 4) + 1);

 const currentAge = typeof prevState.date?.age === 'number' &&!isNaN(prevState.date.age) && isFinite(prevState.date.age) && prevState.date.age >= 0
 ? prevState.date.age
: 18; // Default age
 const nextAge = currentAge + (1 / WEEKS_PER_YEAR);

 const currentYear = typeof prevState.date?.year === 'number' &&!isNaN(prevState.date.year) && isFinite(prevState.date.year) && prevState.date.year > 0
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
 // R7 Phase 2 step 2.8-A: consequence progression extracted into
 // ./actions/weekly/applyConsequenceProgression.ts. Same merge semantics
 // (initialize + spread progression diff), same try/catch fallback to
 // existing state or freshly-initialized state on throw.
 const mergedConsequenceState = applyConsequenceProgression(prevState).mergedConsequenceState;

 // Initialize lifeMoments if missing (use local var — never mutate prevState)
 const lifeMoments = prevState.lifeMoments ?? {
 lastMomentWeek: 0,
 momentsThisWeek: 0,
 totalMoments: 0,
 pendingMoment: undefined,
 };

 // Apply natural stat changes over time
 const currentMoney = typeof prevState.stats?.money === 'number' &&!isNaN(prevState.stats.money)
 ? prevState.stats.money
: 0;
 const newStats = {
...prevState.stats,
 money: currentMoney, // Ensure money starts with valid value
 };

 // No earned income while incarcerated: an active career (salary — zeroed in
 // applyCareerSalaryAndPenalty), an active-run company (profit), and Pulse
 // (social-media) weekly earnings are all withheld while jailed. Passive income —
 // rental income, bank interest, dividends, spouse income — continues untouched.
 const isJailed = (prevState.jailWeeks ?? 0) > 0;

 // R7 Phase 2 step 2.5b-i: `weeklyCtx` is hoisted ALL THE WAY UP here so
 // every subsequent reducer (career, diet, rent, disease, pet, vehicle)
 // shares the same instance. `newStats`, `pendingNotifications`, and
 // `preRolls` are stable references — mutations propagate naturally.
 // Life Skills tree modifiers (unlockedLifeSkills → bounded multipliers),
 // computed ONCE per tick and shared with every weekly reducer via weeklyCtx.
 // Neutral (all-1) for old saves / players who unlocked nothing.
 const lifeSkillMods = getLifeSkillModifiers(prevState);
 const weeklyCtx: WeekContext = {
   newStats,
   notifications: pendingNotifications,
   preRolls,
   nextWeeksLived,
   lifeSkillMods,
 };

 // Energy REGAINS when advancing weeks (like sleeping/resting)
 // BUG FIX: Apply prestige energy regen multiplier
 // CRITICAL FIX: Don't cap regen early - apply full regen, then penalties, then cap to 100
 // Base energy regained per week. Raised 30 → 40 so the early loop isn't
 // starved: street jobs cost 15-35 energy each, and at +30 a player could only
 // sustain ~1 job/week after week 1. +40 supports ~2 jobs/week, making the
 // grind feel steady rather than stalled (new-user fun audit).
 const baseEnergyRegen = 40; // Base regain per week
 const unlockedBonuses = prevState.prestige?.unlockedBonuses || [];
 // R3-A: `getEnergyRegenMultiplier` is an ES import now.
 const energyRegenMultiplier = getEnergyRegenMultiplier(unlockedBonuses);
 const safeEnergyRegenMultiplier = typeof energyRegenMultiplier === 'number' && isFinite(energyRegenMultiplier) && energyRegenMultiplier > 0 ? energyRegenMultiplier: 1.0;
 // Energy Boost gold upgrade: +50% energy regen. Was sold as
 // "Maximum energy increased to 100" — the max is already 100,
 // so the original framing did nothing. Reframe as a regen
 // boost (the cap stays 100, but you reach it 50% faster).
 const energyBoostBonus = prevState.goldUpgrades?.energy_boost ? 1.5: 1.0;
 // Life Skills: Stamina (+15% energy regen — reinterpreted from "+10 max energy"
 // since the energy ceiling is a hard 100). Bounded mult from the accessor.
 const staminaRegenMult = lifeSkillMods.energyRegenMult;
 const energyRegen = Math.round(baseEnergyRegen * safeEnergyRegenMultiplier * energyBoostBonus * staminaRegenMult); // Full regen amount (don't cap here)
 // Apply regen - allow it to go above 100 temporarily (will be capped after penalties)
 newStats.energy = (newStats.energy || 0) + energyRegen;

 // Apply weekly item bonuses (e.g., basic_bed +10 energy +5 happiness,
 // gym_membership +2 fitness +3 health). Items declare \`dailyBonus\`
 // but no tick had ever read it — buying the bed gave nothing.
 for (const item of (prevState.items || [])) {
 if (!item?.owned ||!item.dailyBonus) continue;
 for (const [statKey, delta] of Object.entries(item.dailyBonus)) {
 if (typeof delta!== 'number') continue;
 const current = (newStats as Record<string, number>)[statKey];
 if (typeof current === 'number') {
 (newStats as Record<string, number>)[statKey] = current + delta;
 }
 }
 }

 // Health and happiness decay over time if not maintained (increased decay rates).
 // Happiness Boost gold upgrade (was "Max increased to 100" — meaningless
 // since max is already 100): reframe as halving the natural happiness decay.
 const happinessDecayMul = prevState.goldUpgrades?.happiness_boost ? 0.5: 1.0;
 newStats.health = Math.max(0, (newStats.health || 0) - effectiveDecayRate * 0.6);
 newStats.happiness = Math.max(0, (newStats.happiness || 0) - effectiveDecayRate * 0.8 * happinessDecayMul);

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

 // Fitness Boost gold upgrade (same dead-IAP reframe as the other
 // boosts — halve the natural fitness decay).
 const fitnessDecayMul = prevState.goldUpgrades?.fitness_boost ? 0.5: 1.0;
 newStats.fitness = Math.max(0, (newStats.fitness || 0) - fitnessDecay * fitnessDecayMul);

 // R7 Phase 2 step 2.5b-i: career salary + penalty extracted into
 // ./actions/weekly/applyCareerSalaryAndPenalty.ts. Mutates
 // ctx.newStats.{happiness, health}; returns the three scalars
 // (salary, happiness penalty, health penalty) used downstream.
 const careerResult = applyCareerSalaryAndPenalty(prevState, weeklyCtx);
 const careerSalary = careerResult.careerSalary;
 const careerHappinessPenalty = careerResult.careerHappinessPenalty;
 const careerHealthPenalty = careerResult.careerHealthPenalty;

 // R7 Phase 2 step 2.5a: diet-plan effects extracted into
 // ./actions/weekly/applyDietPlan.ts. Mutates weeklyCtx.newStats
 // (health/energy/happiness/money) and returns the log message.
 //
 // R7 step 2.5b-i: `weeklyCtx` was further hoisted to just after newStats
 // creation so the career reducer above can use it too.
 // Capture the diet deduction so it can be threaded into the weekly cash
 // writeback below. applyDietPlanForWeek mutates newStats.money, but the
 // cashBeforeLoans expression recomputes cash from the ORIGINAL currentMoney
 // and overwrites newStats.money — so without this the diet cost was silently
 // discarded and the diet plan was effectively free.
 const moneyBeforeDiet = typeof newStats.money === 'number' && isFinite(newStats.money) ? newStats.money : 0;
 const dietResult = applyDietPlanForWeek(prevState.dietPlans, weeklyCtx);
 const dietWeeklyCost = Math.max(0, moneyBeforeDiet - (typeof newStats.money === 'number' && isFinite(newStats.money) ? newStats.money : 0));
 if (dietResult.logMessage) {
   logger.info(dietResult.logMessage);
 }

 // R7 Phase 2 step 2.5b-ii: pending career application processing extracted
 // into ./actions/weekly/applyCareerApplications.ts. Same find-first
 // semantics, same accept-after-N-weeks logic (N from preRolls), same
 // log message format. Pure function — no ctx mutation.
 const applicationResult = applyCareerApplications({
   prevCareers: prevState.careers,
   prevCurrentJob: prevState.currentJob,
   careerAcceptDelay: preRolls.careerAcceptDelay,
   prevIsRetired: prevState.isRetired,
   // Appearance at LOW weight here — see the `presence` doc on the input type.
   presence: prevState.identity
     ? computePresence({
         face: prevState.identity.face,
         body: prevState.identity.body,
         style: prevState.identity.style,
         age: prevState.date?.age ?? 25,
         confidence: prevState.stats?.happiness,
         reputation: prevState.stats?.reputation,
         health: prevState.stats?.health,
       }).total
     : undefined,
 });
 let updatedCareers = applicationResult.updatedCareers;
 let newCurrentJob = applicationResult.newCurrentJob;
 if (applicationResult.logMessage) {
   logger.info(applicationResult.logMessage);
 }

 // R7 Phase 2 step 2.5b-iii: career progress extracted into
 // ./actions/weekly/applyCareerProgress.ts. Same 5-factor multiplicative
 // formula (base × early × mentor × perf × mindset), same 100 cap.
 updatedCareers = applyCareerProgress({
   prevCareers: updatedCareers,
   currentJob: newCurrentJob,
   nextWeeksLived,
   newStats,
   legacyBuffs: prevState.legacyBuffs,
   goldMindset: Boolean(prevState.goldUpgrades?.mindset),
   perkMindset: Boolean(prevState.perks?.mindset),
   // Life Skills: Leadership (+10%) / Executive (+15%) promotion-progress speed.
   lifeSkillCareerProgressMult: lifeSkillMods.careerProgressMult,
 }).updatedCareers;

 // Progress enrolled educations automatically
 let pendingCampusEvent: string | undefined;
 let updatedEducations = prevState.educations || [];
 // FREE-EDUCATION FIX: applyEducationProgression deducts the weekly student-loan
 // payment from newStats.money, but the cashBeforeLoans expression below recomputes
 // spendable cash from the ORIGINAL currentMoney and overwrites newStats.money — so,
 // exactly like the diet cost, the loan payment was silently discarded (the loan
 // balance dropped every week while the player was never charged). Capture the amount
 // actually deducted here and thread it into cashBeforeLoans, mirroring dietWeeklyCost.
 let educationWeeklyCost = 0;

 // R7 Phase 2 step 2.5c-i: education stress penalties extracted into
 // ./actions/weekly/applyEducationStress.ts. Mutates ctx.newStats.{happiness,
 // health, energy} and returns the active count + log message. The
 // per-education map block below is still inline pending step 2.5c-ii.
 const educationStressResult = applyEducationStress(prevState.educations, weeklyCtx);
 if (educationStressResult.logMessage) {
   logger.info(educationStressResult.logMessage);
 }

 // GATE FIX: run the progression/graduation helper whenever ANY enrolled program
 // still needs a tick — INCLUDING one already at weeksRemaining <= 0. The Study
 // button (applyStudySession) leaves a finished program at 0 for the tick to
 // finalize; this gate PREVIOUSLY reused the education-STRESS active count
 // (`numActiveEducations`, weeksRemaining > 0), which excludes a 0-week program,
 // so a Study-finished education was never handed to the reducer and stranded at
 // 100% / 0w / "IN PROGRESS" forever — permanently locking company founding
 // (which reads `educations.find(...).completed`). Stress itself still correctly
 // uses the weeksRemaining > 0 count and is applied above regardless.
 if (updatedEducations.some(needsEducationProgressionTick)) {
 // R7 Phase 2 step 2.5c-ii: per-education weekly progression extracted
 // into ./actions/weekly/applyEducationProgression.ts. The helper owns
 // decrement + study-group bonus + student loan + exam + campus event +
 // completion logic. Same external-module calls (isExamWeek, runExam,
 // updateGPA, shouldTriggerCampusEvent). Returns updatedEducations +
 // pendingCampusEvent (last-fire-wins matching legacy behavior).
 // newStats === weeklyCtx.newStats, so the helper's student-loan deduction lands
 // on this same object; snapshot money on either side to recover the real charge.
 const moneyBeforeEducation = typeof newStats.money === 'number' && isFinite(newStats.money) ? newStats.money : 0;
 const progressionResult = applyEducationProgression({
   prevEducations: updatedEducations,
   nextWeeksLived,
   goldFastLearner: Boolean(prevState.goldUpgrades?.fast_learner),
   perkFastLearner: Boolean(prevState.perks?.fastLearner),
 }, weeklyCtx);
 updatedEducations = progressionResult.updatedEducations;
 educationWeeklyCost = Math.max(0, moneyBeforeEducation - (typeof newStats.money === 'number' && isFinite(newStats.money) ? newStats.money : 0));
 if (progressionResult.pendingCampusEvent) {
   pendingCampusEvent = progressionResult.pendingCampusEvent;
 }
 }

 // pendingCampusEvent is set above during education processing

 tickProfiler.mark('setup_stats_career_edu');

      // Pulse weekly tick (v13+): owns brand-deal expiry, impression
 // earnings, scandal cascade, follower decay, Pro renewal. Pre-v13
 // saves still get an empty result — passiveIncome.ts's legacy block
 // is the source of truth for them and is guarded by version<13.
 let pulseTickResult: ReturnType<typeof processPulseWeeklyTick> | null = null;
 try {
 // R3-A: `processPulseWeeklyTick` is an ES import. The try/catch is kept
 // because the tick itself can throw on malformed social-media state.
 pulseTickResult = processPulseWeeklyTick(prevState, nextWeeksLived, preRolls);
 } catch (pulseErr) {
 logger.error('[PULSE TICK] Failed:', pulseErr);
 }

 // Spark weekly tick (v15+): owns swipe quota reset, super-like reset,
 // boost expiry, premium renewal, jealousy event spawn, and "liked you"
 // buffer top-ups. Returns a fresh sparkApp that gets spread into the
 // final state below.
 let sparkTickResult: ReturnType<typeof processSparkWeeklyTick> | null = null;
 try {
 // R3-A: ES import.
 sparkTickResult = processSparkWeeklyTick(prevState, nextWeeksLived);
 } catch (sparkErr) {
 logger.error('[SPARK TICK] Failed:', sparkErr);
 }

 // Hustle weekly tick (v17+): owns campaign progression, brand drift,
 // scandal decay, hire morale, market share, acquisition offers, IPO
 // quarterly earnings. Returns a fresh hustleApp + cash delta from
 // campaign spend/lift and scandal drag.
 let hustleTickResult: ReturnType<typeof processHustleWeeklyTick> | null = null;
 try {
 // R3-A: ES import.
 hustleTickResult = processHustleWeeklyTick(prevState, nextWeeksLived);
 } catch (hustleErr) {
 logger.error('[HUSTLE TICK] Failed:', hustleErr);
 }

 // Calculate passive income.
 // excludeRealEstate: rent is paid for cash by the tenancy tick below
 // (applyRentAndHousing → housingRentalIncome). Including the legacy
 // property.rent stream here too double-paid rent and let an unbounded
 // player-set rent print money — so it's excluded from the cash total.
 const passiveIncomeResult = calcWeeklyPassiveIncome(prevState, { excludeRealEstate: true });
 let passiveIncome = passiveIncomeResult.total || 0;
 // No earned income while incarcerated: a jailed owner earns no company profit
 // this week. Companies carry no managed/passive-mode flag, so ALL company profit
 // is treated as active and skipped. Truly passive streams — dividends, bank
 // interest, spouse income (rental income is a separate cash path) — continue.
 // Remove the company stream's share of the (possibly soft-capped) total: when no
 // cap/multiplier is active the ratio is 1 and this subtracts the exact company
 // figure; when the total was scaled, it removes only the company's proportional
 // slice so dividends and the rest keep theirs.
 if (isJailed) {
   const pb = passiveIncomeResult.breakdown;
   // Streams that actually feed the weekly cash total (realEstate is excluded
   // above — it is paid separately by the tenancy tick), i.e. the pre-cap raw sum.
   const activePassiveSum = pb.stocks + pb.socialMedia + pb.patents + pb.businessOpportunities
     + pb.political + pb.cryptoMining + pb.companies + pb.gamingStreaming;
   const companyShare = activePassiveSum > 0
     ? Math.round(pb.companies * (passiveIncome / activePassiveSum))
     : 0;
   passiveIncome = Math.max(0, passiveIncome - companyShare);
 }

 // R7 Phase 2 step 2.4a: income totals aggregation extracted into
 // ./actions/weekly/applyIncome.ts. The helper composes partner income +
 // prestige multiplier + base total + beginner-luck bonus + money-multiplier
 // gold upgrade + onboarding-perk income bonuses. Byte-faithful to the
 // legacy inline code — verified by snapshot tests in __tests__/refactor.
 const weeksLivedNow = prevState.weeksLived || 0;
 // Retirement pension — 0 while working; the frozen weekly pension once retired.
 // Credited flat through the canonical income path below (no minting/amplifying).
 const retirementIncome = getRetirementIncomeWeekly(prevState);
 const incomeResult = computeWeeklyIncome({
   prevState,
   careerSalary,
   passiveIncome,
   // No earned income while incarcerated: withhold Pulse (social-media) weekly
   // earnings. The Pulse tick itself still runs (brand-deal expiry, follower
   // decay, Pro renewal) — only the earnings are gated out of income.
   pulseEarnings: isJailed ? 0 : (pulseTickResult?.pulseEarnings ?? 0),
   weeksLivedNow,
   unlockedBonuses,
   // Macro teeth: recession/crash/boom now moves the paycheck (was a dead field).
   economyIncomeMultiplier: prevState.economy?.economyEvents?.modifiers?.incomeMultiplier,
   retirementIncome,
 });
 const { partnerIncome, baseTotalIncome, totalIncome } = incomeResult;

 // R7 Phase 2 step 2.4b: auto-reinvest dividends extracted into
 // ./actions/weekly/applyAutoReinvest.ts. Same target-selection + purchase
 // logic, same NaN/Infinity guards, same logger.info on success. Empty
 // array convention preserved (downstream `reinvestedStocks.length > 0`
 // checks still work).
 const reinvestResult = applyAutoReinvest({
   prevHoldings: prevState.stocks?.holdings || [],
   reinvestedAmount: passiveIncomeResult.reinvested ?? 0,
   stockPickRoll: preRolls.stockPickRoll,
 });
 const reinvestedStocks = reinvestResult.reinvestedStocks;

 // R7 Phase 2 step 2.4c: rent + housing module + realEstate weekly tick
 // extracted into ./actions/weekly/applyRentAndHousing.ts. Same try/catch
 // silent-fallback behavior, same notification shapes, same module calls.
 //
 // DETERMINISM FIX: the real-estate tick (tenant lifecycle, Airbnb realized-rent
 // variance) was the last weekly subsystem still fed a live `() => Math.random()`,
 // unlike every sibling (crypto/darkweb/politics/stocks pass the seeded weeklyRoll).
 // That made tenant arrivals/departures and rent variance resume-unsafe and
 // inconsistent under React 19 StrictMode double-invoke. Pass the same seeded,
 // per-key `makeWeeklyRoll(nextWeeksLived)` stream the siblings use — the module
 // already namespaces its own keys, so outcomes are now reproducible from the save.
 //
 // R7 step 2.5a: `weeklyCtx` was further hoisted to the diet block above
 // so all reducers (diet, rent, disease, pet, vehicle) share one instance.
 const rentAndHousingResult = applyRentAndHousing(
   prevState.realEstate,
   nextWeeksLived,
   makeWeeklyRoll(nextWeeksLived),
   weeklyCtx,
   prevState.realEstateActivity,
 );
 const {
   weeklyRent,
   housingHappinessBonus,
   housingRentalIncome,
   housingUpkeep,
 } = rentAndHousingResult;
 let updatedRealEstate = rentAndHousingResult.updatedRealEstate;
 // v22 Wave A: persist the capped real-estate activity timeline (feeds the
 // RealEstateApp Activity tab). Sourced entirely from the real-estate weekly
 // module above; written alongside `realEstate` in the returned state below.
 const updatedRealEstateActivity = rentAndHousingResult.realEstateActivity;

 // R7 Phase 2 step 2.4d: savings interest extracted into
 // ./actions/weekly/applySavingsInterest.ts. Pure helper — same APR
 // gating, same soft-cap math, same Good Credit perk stack.
 const savingsResult = computeSavingsInterest({
   prevBankSavings: prevState.bankSavings,
   creditScore: prevState.banking?.creditScore?.score ?? 0,
   financialPlanning: prevState.settings?.financialPlanning === true,
   goldCreditUpgrade: Boolean(prevState.goldUpgrades?.good_credit),
   goodCreditPerk: Boolean(prevState.perks?.goodCredit),
 });
 const { savingsInterest, newBankSavings } = savingsResult;

 // Progressive income tax on weekly earnings.
 // Life Skills: Tax Strategy (-10% tax) scales the owed tax down (bounded mult).
 const incomeTax = Math.round(calculateIncomeTax(totalIncome) * lifeSkillMods.taxMult);

 // R7 Phase 2 step 2.4e: per-loan autopay extracted into
 // ./actions/weekly/applyLoanAutopay.ts. Pure helper threads cash through
 // explicit input/output instead of mutating a closure variable. Same APR
 // normalization (>1 = percent, else decimal), same weekly-rate math,
 // same bankruptcy-floor + breathing-room logic, same missed-payment
 // compounding penalty.
 const cashBeforeLoans = Math.max(0, currentMoney + totalIncome - incomeTax - weeklyRent + housingRentalIncome - housingUpkeep - dietWeeklyCost - educationWeeklyCost);
 const loanResult = applyLoanAutopay({
   prevLoans: prevState.loans,
   cashAvailable: cashBeforeLoans,
 });
 let cashAfterIncomeAndRent = loanResult.cashAfter;
 const totalLoanAutoPaid = loanResult.totalLoanAutoPaid;
 const totalLoanPenalty = loanResult.totalLoanPenalty;
 // v22 Wave A: interest actually serviced on the real loan-autopay path this
 // week — threaded into runWeeklyBankingTick so banking.totalInterestPaid stops
 // reading $0 (and the cross-system summary reflects real debt-service).
 const totalLoanInterest = loanResult.totalLoanInterest;
 const processedLoans = loanResult.processedLoans;

 // Add income to money (always update, even if 0, to ensure state updates)
 // Note: If auto-reinvest is active, reinvestedAmount is NOT added to money (it's used to buy stocks)
 // Deduct weekly rent for rented properties
 const newMoney = Math.max(0, cashAfterIncomeAndRent);
 newStats.money = newMoney;

 // R7 Phase 2 step 2.4f: finance summary log builder extracted to
 // ./actions/weekly/summarizeWeeklyFinance.ts. Same gating, same format.
 const financeSummary = summarizeWeeklyFinance({
   careerSalary, partnerIncome, passiveIncome, totalIncome,
   incomeTax, weeklyRent, totalLoanAutoPaid, totalLoanPenalty,
   savingsInterest, currentMoney, newMoney,
 });
 if (financeSummary.logMessage) {
   logger.info(financeSummary.logMessage);
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
 // Set when a scheduled wedding executes this tick — mirrored into
 // family.spouse below (same as executeWedding in DatingActions.ts).
 let newWeddingSpouse: Relationship | null = null;

 // Health tracking
 if (newStats.health <= 0) {
 newHealthZeroWeeks = (newHealthZeroWeeks || 0) + 1;
 // No zero-stat popup on week advance anymore — the health warning is
 // surfaced passively in the player card (IdentityCard "Health Issues")
 // instead of interrupting the Next Week flow. Death tracking continues.

 // Death after 4 weeks at zero
 if (newHealthZeroWeeks >= 4) {
 newShowDeathPopup = true;
 newDeathReason = 'health';
 // CRITICAL: Hide zero stat popup when death occurs
 newShowZeroStatPopup = false;
 newZeroStatType = undefined;
 deathTriggered = true; // Mark that death was triggered
 // NB: haptic fires once post-updater (see deathTriggered block) — calling it
 // here would double-buzz under React 19 StrictMode / discarded renders.
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
 // No zero-stat popup on week advance anymore — surfaced passively in the
 // player card (IdentityCard "Health Issues") instead. Death tracking continues.

 // Death after 4 weeks at zero
 if (newHappinessZeroWeeks >= 4) {
 newShowDeathPopup = true;
 newDeathReason = 'happiness';
 // CRITICAL: Hide zero stat popup when death occurs
 newShowZeroStatPopup = false;
 newZeroStatType = undefined;
 deathTriggered = true; // Mark that death was triggered
 // haptic fires once post-updater (see deathTriggered block) to avoid double-buzz.
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




 // Natural death from old age — escalating per-week chance after 80,
 // capped near-certain by 120. Immortality gold-upgrade or perk
 // skips the roll entirely (the IAP advertises "Never die of old
 // age" and now actually delivers on it).
 if (!deathTriggered && nextAge >= 80) {
 const isImmortal =!!prevState.goldUpgrades?.immortality;
 if (!isImmortal) {
 const yearsPast80 = nextAge - 80;
 // Quadratic ramp: ~6% annual at 90, ~24% at 100, ~95% at 120.
 // Life Skills: Vitality (slow aging) scales the annual death chance down
 // (agingMult ≤ 1, clamped). Never raises it; never fully immortalizes.
 const annualChance = Math.min(0.95, Math.pow(yearsPast80 / 40, 2) * 0.95) * lifeSkillMods.agingMult;
 const weeklyChance = 1 - Math.pow(1 - annualChance, 1 / WEEKS_PER_YEAR);
 if (oldAgeDeathRoll < weeklyChance) {
 newShowDeathPopup = true;
 newDeathReason = 'age';
 newShowZeroStatPopup = false;
 newZeroStatType = undefined;
 deathTriggered = true;
 // haptic fires once post-updater (see deathTriggered block) to avoid double-buzz.
 logger.warn(`[DEATH] Character died of old age at ${Math.floor(nextAge)}`);
 }
 }
 }

 // Process weddings, pregnancy, and relationship health
 let relationshipHappinessPenalty = 0;
 const newBornChildren: Relationship[] = [];
 let newShowBirthPopup = false;
 let birthMessage = '';
 // PERF-2: the relationship pass iterates a player-growable array and calls four
 // subsystems (pregnancy, wedding, health, NPC depth), and was the one such block
 // in the updater with no try/catch of its own — a throw on a malformed
 // relationship fell through to the outer catch, which returns prevState, so
 // `weeksLived` never advanced and Next Week failed that week. Wrapped like its
 // pets/vehicles/luxury siblings, with a self-healing carry-over fallback
 // (Array.isArray, not `?? []`: a truthy non-array is the exact throw case and
 // would otherwise re-throw every week). 2026-07-28 audit PERF-2.
 let processedRelationships: Relationship[] = [];
 try {
 processedRelationships = (prevState.relationships || []).map((rel, relIdx) => {
 if (!rel || typeof rel!== 'object') return rel;

 // R7 Phase 2 step 2.6-iii-D: pregnancy progression + birth extracted to
 // applyPregnancyProgression. Same birth math (5000 cost, +30 happiness,
 // +15 relationship), same late/mid pregnancy stat ramps, same childId
 // format and personality array.
 const pregResult = applyPregnancyProgression(rel, weeklyCtx);
 if (pregResult) {
 if (pregResult.newborn) {
 newBornChildren.push(pregResult.newborn);
 newShowBirthPopup = true;
 birthMessage = pregResult.birthMessage || '';
 }
 return pregResult.rel;
 }

 // A wedding scheduled to land while the player is incarcerated is deferred one
 // week (it re-triggers the first week after release). The engagement state
 // (weddingPlanned) is preserved intact — no charge, no spouse promotion, no
 // expiry — so there is zero softlock risk: pushing scheduledWeek to next week
 // keeps it clear of both the 1-year expiry and the stale-cleanup window.
 if (isJailed && rel.weddingPlanned && rel.weddingPlanned.scheduledWeek === nextWeeksLived) {
 return { ...rel, weddingPlanned: { ...rel.weddingPlanned, scheduledWeek: nextWeeksLived + 1 } };
 }

 // R7 Phase 2 step 2.6-iii-C: scheduled wedding extracted to
 // applyScheduledWedding. Same execute/postpone/expire/stale gates,
 // same anti-exploit math, same logger messages.
 const weddingResult = applyScheduledWedding(rel, weeklyCtx);
 if (weddingResult) {
 if (weddingResult.weddingPopup) {
 newShowWeddingPopup = true;
 newWeddingPartnerName = weddingResult.weddingPopup.partnerName;
 }
 if (weddingResult.familySpouse) {
 newWeddingSpouse = weddingResult.familySpouse;
 }
 return weddingResult.rel;
 }

 // R7 Phase 2 step 2.6-iii-B: child aging extracted to applyChildAging.
 if (rel.type === 'child') {
 return applyChildAging(rel);
 }

 // R7 Phase 2 step 2.6-iii-E: relationship health extracted to
 // applyRelationshipHealth. Same breakup/disappointed/healthy-reset/clamp
 // gates, same rolls, same notifications. happinessPenalty is accumulated
 // here (matching the legacy closure-variable pattern) and applied to
 // newStats AFTER the .map() below.
 const healthResult = applyRelationshipHealth(rel, relIdx, weeklyCtx);
 if (healthResult.happinessPenalty !== 0) {
 relationshipHappinessPenalty += healthResult.happinessPenalty;
 }
 return healthResult.rel;
 }).filter((rel): rel is Relationship => rel != null && typeof rel === 'object'); // Remove null/undefined/non-object relationships (breakups + corruption guard)

 // Add newborn children to relationships
 if (newBornChildren.length > 0) {
 processedRelationships.push(...newBornChildren);

 // Show birth notification
 if (newShowBirthPopup && birthMessage) {
 pendingNotifications.push({ id: 'birth-announcement', message: birthMessage, title: '👶 A Baby Is Born!' });
 }
 }

 // R7 Phase 2 step 2.6-iii-A: NPC depth tick extracted into
 // ./actions/weekly/applyNPCDepthTick.ts. Same processWeeklyNPCDepth call,
 // same 2-notification-per-week cap, same try/catch silent fallback when
 // the module fails to load (preserved for test environments).
 const npcDepthResult = applyNPCDepthTick({
   relationships: processedRelationships,
   weeksLived: nextWeeksLived,
 }, weeklyCtx);
 // The helper returns a fresh array; replace in place to preserve the
 // legacy mutation-of-the-same-reference contract the downstream blocks
 // depend on (they read `processedRelationships`, not a renamed variable).
 processedRelationships.length = 0;
 processedRelationships.push(...npcDepthResult.relationships);
 } catch (relErr) {
 logger.error('[RELATIONSHIP TICK] Failed:', relErr);
 // Carry the relationships over untouched and drop every partial output of
 // this pass, so a half-finished run can't birth a child, queue a birth
 // notification, or apply a partial happiness penalty.
 processedRelationships = Array.isArray(prevState.relationships) ? [...prevState.relationships] : [];
 newBornChildren.length = 0;
 newShowBirthPopup = false;
 birthMessage = '';
 relationshipHappinessPenalty = 0;
 }

 // Applied outside the try: a throw mid-pass resets the accumulator above, so
 // the player is never charged a partial week of relationship unhappiness.
 if (relationshipHappinessPenalty < 0) {
 newStats.happiness = Math.max(0, Math.min(100, newStats.happiness + relationshipHappinessPenalty));
 }

 // Marriage anniversary grant. Previously stranded in a ContactsApp useEffect
 // (fired only if Contacts was open on the exact anniversary week), so the
 // happiness bonus + milestone + Pulse post were silently missed otherwise. Now
 // it runs every tick for the married player regardless of screen — deterministic
 // (seed-free ids, preRolls.timestamp) and idempotent (one grant per year, via the
 // lifeMilestones guard inside the helper). Happiness folds in here; the milestone
 // and post fold into the final return below.
 // Defense-in-depth like the sibling subsystem ticks (pulse/spark/hustle):
 // a throw on malformed state (e.g. a null lifeMilestones entry in a
 // hand-edited save) skips this week's grant instead of aborting the tick.
 let anniversaryResult: AnniversaryResult = {
   isAnniversary: false, yearsMarried: 0, happinessBonus: 0, milestone: null, post: null,
 };
 try {
   anniversaryResult = applyAnniversaries({
     prevState,
     relationships: processedRelationships,
     nextWeeksLived,
     nextYear,
     timestamp: preRolls.timestamp,
   });
 } catch (anniversaryErr) {
   logger.error('[ANNIVERSARY TICK] Failed:', anniversaryErr);
 }
 if (anniversaryResult.happinessBonus > 0) {
   newStats.happiness = Math.max(0, Math.min(100, newStats.happiness + anniversaryResult.happinessBonus));
 }

 tickProfiler.mark('income_engagement_finance_family');

      // R7 Phase 2 step 2.6-i: wanted-level decay + police-encounter roll
 // extracted into ./actions/weekly/applyCrimeTick.ts. Same 5%-per-level
 // chance ramp, same 30% cap, same min(4, ceil/3) jail-weeks cap.
 const crimeResult = applyCrimeTick({
   prevWantedLevel: prevState.wantedLevel,
   prevJailWeeks: prevState.jailWeeks,
   policeEncounterRoll: preRolls.policeEncounter,
 }, weeklyCtx);
 const newWantedLevel = crimeResult.newWantedLevel;
 const policeEncounterJailWeeks = crimeResult.policeEncounterJailWeeks;

 // R7 Phase 2 step 2.6-ii-A: warehouse mining crypto earnings extracted
 // into ./actions/weekly/applyMiningCryptos.ts. Same 8-tier miner catalog,
 // same calculateMiningEarnings call, same BTC halving, same auto-repair
 // deduction (both earning-path and zero-earning-path).
 const updatedCryptos = applyMiningCryptos({
   prevWarehouse: prevState.warehouse,
   prevCryptos: prevState.cryptos || [],
   halvingCount: prevState.cryptoMarket?.halvingCount ?? 0,
   // Charge auto-repair on POST-degradation durability (same roll the warehouse
   // pass uses) so a miner crossing below 50% this tick isn't repaired for $0.
   minerDegradationRoll: preRolls.minerDegradation,
 }).updatedCryptos;

 // R7 Phase 2 step 2.6-ii-B: warehouse update extracted into
 // ./actions/weekly/applyMiningWarehouse.ts. Same difficulty / durability /
 // auto-repair logic. The legacy `lastDifficultyUpdate` cyclic-vs-absolute
 // migration is preserved verbatim.
 const updatedWarehouse = applyMiningWarehouse({
   prevWarehouse: prevState.warehouse,
   prevCryptos: prevState.cryptos || [],
   weeksLived: prevState.weeksLived || 0,
   minerDegradationRoll: preRolls.minerDegradation,
 }).updatedWarehouse;

 // Generate weekly events (economic, personal crisis, seasonal, regular).
 // R3-A: event-engine helpers are ES imports.

 // R7 Phase 2 step 2.7-A: economic event roll extracted into
 // ./actions/weekly/applyEconomicEvent.ts. Same shouldTrigger gate,
 // same merge into economyEvents, same try/catch swallow on failure.
 let updatedEconomy = applyEconomicEvent(prevState).updatedEconomy;

 // R7 Phase 2 step 2.7-B: weekly events generation + cap extracted into
 // ./actions/weekly/applyWeeklyEvents.ts. Same synthetic state build,
 // same try/catch swallow, same `generatedAtWeeksLived` stamping, same
 // MAX_PENDING_EVENTS=100 anti-bloat cap. `newEventCount` is the
 // count of events generated BEFORE stamping/capping — used by the pity
 // system to reset `lastEventWeeksLived` only on a tick that fired.
 const weeklyEventsResult = applyWeeklyEvents({
   prevState,
   updatedEconomy,
   nextWeeksLived,
   nextWeek,
 });
 let updatedPendingEvents = weeklyEventsResult.updatedPendingEvents;
 const newEventCount = weeklyEventsResult.newEventCount;

 // GL-1: clear an activeEventChain that can never advance again (see
 // healLatchedEventChain). Returns null — and changes nothing — unless the
 // save is actually latched.
 let healedEventChain: ReturnType<typeof healLatchedEventChain> = null;
 try {
   healedEventChain = healLatchedEventChain(prevState);
 } catch (chainErr) {
   logger.warn('[EVENT CHAIN] heal check failed', { error: String(chainErr) });
 }

 // R7 Phase 2 step 2.7-C: cliffhanger resolution extracted into
 // ./actions/weekly/applyCliffhangerResolution.ts. Same lookup, same
 // append with stamping, same try/catch swallow on missing/malformed
 // cliffhanger ids.
 updatedPendingEvents = applyCliffhangerResolution({
   prevState,
   pendingEventsAfterWeekly: updatedPendingEvents,
   nextWeeksLived,
 }).updatedPendingEvents;

 // #16: surface any DUE follow-up chained events (queued by resolveEvent into
 // pendingChainedEvents) into pendingEvents, and dequeue them. Previously the
 // consumer was never wired up, so all 8 follow-up chains never fired and the
 // queue grew unbounded. weeksLived (absolute) is the correct clock here.
 let updatedPendingChainedEvents = prevState.pendingChainedEvents;
 if (Array.isArray(prevState.pendingChainedEvents) && prevState.pendingChainedEvents.length > 0) {
 const dueFollowUps: WeeklyEvent[] = [];
 const stillPending: NonNullable<typeof prevState.pendingChainedEvents> = [];
 for (const pending of prevState.pendingChainedEvents) {
 const followUp = pending && pending.triggerWeek <= nextWeeksLived
 ? FOLLOW_UP_EVENTS[pending.eventId as keyof typeof FOLLOW_UP_EVENTS]
: undefined;
 if (followUp) {
 // FOLLOW_UP_EVENTS entries are WeeklyEvent-shaped (id/description/choices).
 dueFollowUps.push({...(followUp as WeeklyEvent), generatedAtWeeksLived: nextWeeksLived });
 } else if (pending && pending.triggerWeek > nextWeeksLived) {
 stillPending.push(pending);
 }
 // (a due entry with no matching FOLLOW_UP_EVENTS def is dropped — dequeued.)
 }
 if (dueFollowUps.length > 0) {
 // Reuse the same MAX_PENDING_EVENTS=100 anti-bloat cap applyWeeklyEvents uses.
 updatedPendingEvents = [...updatedPendingEvents,...dueFollowUps].slice(-100);
 }
 // Safety cap so a malformed queue can never grow without bound.
 updatedPendingChainedEvents = stillPending.length > 100 ? stillPending.slice(-100): stillPending;
 }

 // Weekly events now use a NON-BLOCKING inbox instead of an interrupting
 // auto-pop modal (that was the original complaint that got them disabled).
 // Events queue and the player opens them from a "decisions waiting" pill on
 // their own time — see app/(tabs)/_layout.tsx. Cap the visible inbox so it
 // reads as an inbox, not a firehose; chained follow-ups stay queued (already
 // capped above) so life-moment / cliffhanger ripples can still resolve.
 updatedPendingEvents = updatedPendingEvents.slice(-12);

 // R7 Phase 2 step 2.7-D: life moment generation extracted into
 // ./actions/weekly/applyLifeMoment.ts. Same generator call, same merge
 // semantics (preserve existing slice OR initialize when none), same
 // try/catch swallow.
 const updatedLifeMoments = applyLifeMoment({
   prevState,
   nextWeeksLived,
 }).updatedLifeMoments;

 // ============================================================
 // DISEASE SYSTEM — R7 Phase 2 step 2.3
 // ============================================================
 // Extracted into ./actions/weekly/applyDiseases.ts. The helper takes
 // pre-generated `newDisease` (the caller still calls the impure
 // `generateRandomDisease` and threads the result in) so the helper
 // itself is deterministic and snapshot-testable. ctx.newStats is
 // mutated for stat penalties exactly like the legacy inline code.
 //
 // R7 step 2.4c: `weeklyCtx` was further hoisted to the rent + housing
 // block above so it can be reused across all reducers (rent, disease,
 // pet, vehicle). Same object reference — mutations propagate.

 let preGeneratedDisease: Disease | null = null;
 try {
 const stateForDiseaseGeneration = {
...prevState,
 weeksLived: nextWeeksLived,
 week: nextWeek,
 stats: newStats,
 };
 preGeneratedDisease = generateRandomDisease(stateForDiseaseGeneration);
 } catch (error) {
 logger.error('Error generating disease:', error);
 // Continue without new disease if generation fails.
 }

 tickProfiler.mark('crime_events');

      // Wrapped in try/catch like every sibling subsystem tick (pulse/spark/
      // stocks/crypto/banking): an unhandled throw here falls through to the
      // outer updater catch, which returns prevState unchanged → weeksLived
      // never advances → a PERMANENT "Next Week" soft-lock. This tick gained
      // chronic-care logic recently; the real throw surface is a truthy
      // non-array `diseases` (CloudSync merge / hand-edit / interrupted
      // migration) hitting the `[...(prevDiseases || [])]` spread before the
      // helper's own array guard. On failure, carry the prior disease slices
      // forward so the rest of the week's progression still completes.
      let diseaseResult: ReturnType<typeof applyDiseasesForWeek>;
      try {
        diseaseResult = applyDiseasesForWeek({
   prevDiseases: prevState.diseases,
   prevDiseaseHistory: prevState.diseaseHistory,
   prevShowSicknessModal: prevState.showSicknessModal,
   prevLastDiseaseWeek: prevState.lastDiseaseWeek,
   newDisease: preGeneratedDisease,
 }, weeklyCtx);
      } catch (diseaseErr) {
        logger.error('[DISEASE TICK] Failed:', diseaseErr);
        diseaseResult = {
          // Self-heal a truthy non-array (the exact throw case) rather than
          // carrying it forward — `?? []` would keep the malformed value and
          // re-throw every week until reload.
          diseases: Array.isArray(prevState.diseases) ? prevState.diseases : [],
          diseaseHistory: prevState.diseaseHistory ?? {
            diseases: [], totalDiseases: 0, totalCured: 0, deathsFromDisease: 0,
          },
          showSicknessModal: false,
          lastDiseaseWeek: prevState.lastDiseaseWeek,
          deathTriggered: false,
          deathReason: undefined,
        };
      }
 let updatedDiseases = diseaseResult.diseases;
 let updatedDiseaseHistory = diseaseResult.diseaseHistory;
 let showSicknessModal = diseaseResult.showSicknessModal;
 let lastDiseaseWeek = diseaseResult.lastDiseaseWeek;
 if (diseaseResult.deathTriggered) {
 // M-1 (R8): set the outer `deathTriggered` flag too, so the post-updater
 // early-return fires for disease deaths (otherwise a freshly-dead player
 // still runs automation + an extra save this tick). Don't clobber a death
 // reason already set earlier this tick (e.g. old age fired first).
 if (!newShowDeathPopup) {
 newDeathReason = diseaseResult.deathReason;
 }
 newShowDeathPopup = true;
 deathTriggered = true;
 }

 // ============================================================
 // PET + VEHICLE WEEKLY PROCESSING — R7 Phase 2 step 2.2a-c
 // ============================================================
 // All extracted into ./actions/weekly/applyPets.ts + applyVehicles.ts.
 // The order is preserved: per-pet update (tickPetsForWeek) → pet death
 // side effects → vehicle tick → pet living side effects (bonus + food).
 // Vehicles run BETWEEN the two pet side-effect groups because they
 // mutate newStats.money — moving the food-cost block before vehicles
 // would change the intermediate-money observed during the tick.
 // Note: `weeklyCtx` was hoisted to the disease block above (R7 step 2.3).
 // Per-subsystem try/catch — one block each, matching the project invariant
 // ("their own try/catch"). A throw in any of these would otherwise reach the
 // outer updater catch → return prevState → permanent "Next Week" soft-lock.
 // Splitting them (rather than one shared try) is deliberate: pets, vehicles,
 // and luxury each mutate weeklyCtx.newStats.money in sequence, so a shared
 // catch that reverts a LATER subsystem's output while an EARLIER subsystem's
 // money/happiness mutation already landed would desync state vs. cash and
 // re-charge the player next week. Each block falls back only for itself.
 // Fallback defaults use Array.isArray so a truthy non-array (partial-save
 // corruption) self-heals this tick instead of re-throwing every week until
 // reload. Order and the success path are unchanged (byte-identical).
 let updatedPets: ReturnType<typeof tickPetsForWeek> = Array.isArray(prevState.pets) ? prevState.pets : [];
 try {
 updatedPets = tickPetsForWeek(prevState.pets, {
   petSickness: preRolls.petSickness,
   petSicknessType: preRolls.petSicknessType,
 });
 applyPetDeathSideEffects(prevState.pets, updatedPets, weeklyCtx);
 } catch (petErr) {
 logger.error('[PET TICK] Failed:', petErr);
 }

 let updatedVehicles: ReturnType<typeof applyVehiclesForWeek> = Array.isArray(prevState.vehicles) ? prevState.vehicles : [];
 try {
 updatedVehicles = applyVehiclesForWeek(prevState.vehicles, weeklyCtx);
 } catch (vehErr) {
 logger.error('[VEHICLE TICK] Failed:', vehErr);
 }
 // Luxury & Collectibles weekly tick — upkeep (mirror-safe cash deduction from
 // newStats.money) + happiness/prestige benefit. Runs here (after the line-770
 // money overwrite, before the stat clamp and before pulseRep reads reputation)
 // exactly like the vehicle tick above. See ./actions/weekly/applyLuxuryItems.ts.
 let luxuryCharged = 0;
 // Declared out here so the catch below leaves them at 0 — a failed luxury tick
 // must not report phantom income or costs in the recap.
 let luxuryYield = 0;
 let luxuryRiskCost = 0;
 let nextLuxuryHoldings: typeof prevState.luxuryHoldings = prevState.luxuryHoldings;
 let updatedAchievements: typeof prevState.achievements = prevState.achievements;
 try {
 const moneyBeforeLuxury = typeof newStats.money === 'number' && isFinite(newStats.money) ? Math.max(0, newStats.money) : 0;
 const luxuryWeek = applyLuxuryItemsForWeek(prevState.luxuryItems, weeklyCtx, prevState.luxuryHoldings);
 luxuryYield = luxuryWeek.yield;
 luxuryRiskCost = luxuryWeek.riskCost;
 // Appreciation moves net worth, not cash. Same reference when nothing drifted,
 // so a collection of pure trophies causes no state churn.
 nextLuxuryHoldings = luxuryWeek.holdings;
 // What upkeep ACTUALLY took out of the wallet, read from the money on both
 // sides of the call rather than inferred. The helper credits yield BEFORE
 // charging upkeep (crediting second would make going broke profitable), so the
 // old `Math.min(upkeep, moneyBefore)` under-reported a low-cash week: $10k cash
 // + $85k yield - $150k upkeep really charges $95k but was reported as $10k,
 // which also mis-sized the lifestyle budget row. 2026-07-28 audit recap-1.
 const moneyAfterLuxury = typeof newStats.money === 'number' && isFinite(newStats.money) ? Math.max(0, newStats.money) : 0;
 luxuryCharged = Math.max(0, moneyBeforeLuxury + luxuryYield - moneyAfterLuxury - luxuryRiskCost);
 // Un-orphan the legacy `luxury_life` achievement (rendered on the Progression
 // screen but never completed in normal play). Luxury ownership only changes via
 // purchase/sell, so evaluate against prevState.luxuryItems. Only remap the array
 // on the flip to complete — otherwise reuse the same reference (no churn).
 updatedAchievements =
 (isLuxuryLifeComplete(prevState.luxuryItems) &&
 (prevState.achievements || []).some((a) => a.id === 'luxury_life' && !a.completed))
 ? (prevState.achievements || []).map((a) =>
 a.id === 'luxury_life' ? { ...a, completed: true } : a)
 : prevState.achievements;
 } catch (luxErr) {
 logger.error('[LUXURY TICK] Failed:', luxErr);
 }

 // Identity & Body weekly tick — regimen resolution, body simulation, grooming
 // decay, and the grocery/wardrobe cost. Runs in the same slot as the vehicle
 // and luxury ticks (after the money writeback, before the stat clamp) so its
 // deductions land on real cash and its happiness/energy deltas get bounded by
 // the clamp below. See ./actions/weekly/applyIdentity.ts.
 let identityCharged = 0;
 let nextIdentity: typeof prevState.identity = prevState.identity;
 try {
 const identityWeek = applyIdentityForWeekFromState(prevState, weeklyCtx);
 nextIdentity = identityWeek.identity;
 identityCharged = identityWeek.spent;
 // Only surface the notable lines (a downgrade the player should know about, a
 // crossed threshold). Ordinary weeks return none, so this stays quiet.
 for (const note of identityWeek.notes) {
 weeklyCtx.notifications.push({
 id: `identity-${weeklyCtx.nextWeeksLived}-${weeklyCtx.notifications.length}`,
 title: 'Your Body',
 message: note,
 });
 }
 } catch (identityErr) {
 logger.error('[IDENTITY TICK] Failed:', identityErr);
 }

 let petFoodCharged = 0;
 try {
 const moneyBeforePetFood = typeof newStats.money === 'number' && isFinite(newStats.money) ? Math.max(0, newStats.money) : 0;
 applyPetLivingSideEffects(updatedPets, weeklyCtx);
 // Downstream week-result block reports `petFoodCost` as part of `totalExpenses`.
 // The helper applies the cost atomically (clamped to the money floor) but doesn't
 // return the magnitude — recompute the nominal here to match the legacy contract.
 // Cheap: `O(updatedPets.length)`.
 const petFoodCost = updatedPets.filter((p) => !p.isDead).length * PET_WEEKLY_FOOD_COST;
 // Actual amount charged after the money floor — the recap must report what left
 // the wallet, not the nominal (= nominal whenever the player could afford it).
 petFoodCharged = Math.min(petFoodCost, moneyBeforePetFood);
 } catch (foodErr) {
 logger.error('[PET FOOD TICK] Failed:', foodErr);
 }

 // Housing happiness bonus from current residence
 if (housingHappinessBonus > 0) {
 newStats.happiness = Math.min(100, newStats.happiness + housingHappinessBonus);
 }

 // CRITICAL: Cap stats to valid ranges (0-100) after all calculations.
 // Use isFinite, NOT `typeof === 'number'`: `typeof NaN === 'number'` is true and
 // `Math.max(0, Math.min(100, NaN))` stays NaN, so the bare typeof check let a NaN
 // stat survive the cap and show "NaN" in the UI until the next save/load repair.
 const clampStat0to100 = (v: number): number => (isFinite(v) ? Math.max(0, Math.min(100, v)) : 0);
 newStats.energy = clampStat0to100(newStats.energy);
 newStats.health = clampStat0to100(newStats.health);
 newStats.happiness = clampStat0to100(newStats.happiness);
 newStats.fitness = clampStat0to100(newStats.fitness);

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
 const luckyCharmBoost = luckyCharmActive ? 10: 0; // +10% chance with lucky charm
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
 const hoursSinceLastPlay = lastPlayTs > 0 ? (now - lastPlayTs) / (1000 * 60 * 60): 999;
 const streakContinues = hoursSinceLastPlay < 48;
 const newStreakCount = streakContinues ? (prevState.playStreak?.count || 0) + 1: 1;
 const streakBonusPercent = Math.min(newStreakCount * 2, 20); // +2% per streak, max +20%
 const streakBonusAmount = weeklyIncome > 0 ? Math.round(weeklyIncome * streakBonusPercent / 100): 0;
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
 // Legacy Pass XP to award if a weekly challenge reward is granted below. Folded
 // into the single final returned state object (we never call setGameState again).
 let weeklyChallengeXpToAward = 0;
 try {
 // R3-A: `getOrRotateWeeklyChallenge`/`evaluateChallengeProgress` are ES imports.
 // Build a temporary state snapshot for evaluation
 const evalState = {...prevState, stats: newStats, weeksLived: nextWeeksLived };

 // ── WEEKLY CHALLENGE: Rotation-week completion salvage ──
 // getOrRotateWeeklyChallenge replaces the challenge once ROTATION_GAME_WEEKS
 // have elapsed. If the player first satisfied EVERY objective of the OUTGOING
 // challenge on that exact rotation tick, the fresh challenge would overwrite it
 // before the completion/reward block ran and its 150-300 gem reward would be
 // lost. Evaluate + grant the outgoing challenge's reward here, BEFORE rotating.
 // Rotation is detected as a challengeId change (the incoming id always differs:
 // the rotation index advances by exactly one). Non-rotation ticks and the
 // legacy startedWeek-adopt case keep the same id → this block is a pure no-op,
 // so it can never double-grant with the block below.
 const outgoingChallenge = prevState.weeklyChallenge;
 updatedWeeklyChallenge = getOrRotateWeeklyChallenge(evalState);
 const rotatedAway =
 !!outgoingChallenge &&
!outgoingChallenge.rewardClaimed &&
 (!updatedWeeklyChallenge || updatedWeeklyChallenge.challengeId !== outgoingChallenge.challengeId);
 if (rotatedAway && outgoingChallenge) {
 const outProgress = evaluateChallengeProgress(outgoingChallenge.challengeId, evalState);
 const outCompleted = outProgress.length > 0 && outProgress.every((p: any) => p.completed ?? p.met);
 if (outCompleted) {
 const outDef = getWeeklyChallengeDefinition(outgoingChallenge.challengeId);
 const outGemReward = typeof outDef?.reward === 'number' && outDef.reward > 0 ? Math.floor(outDef.reward): 0;
 if (outGemReward > 0) {
 newStats.gems = (typeof newStats.gems === 'number' && isFinite(newStats.gems) ? newStats.gems: 0) + outGemReward;
 }
 weeklyChallengeXpToAward += LEGACY_PASS_XP.weeklyChallenge;
 logger.info(`[WEEKLY_CHALLENGE] Outgoing reward granted on rotation week: +${outGemReward} gems, +${LEGACY_PASS_XP.weeklyChallenge} Legacy Pass XP (${outgoingChallenge.challengeId})`);
 }
 }

 if (updatedWeeklyChallenge &&!updatedWeeklyChallenge.completed &&!updatedWeeklyChallenge.rewardClaimed) {
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
 // ── WEEKLY CHALLENGE: Grant reward on first completion (idempotent) ──
 // Fires exactly once: only when the challenge is now completed AND the reward
 // has not yet been claimed. `rewardClaimed` is persisted, so repeat ticks (and
 // future weeks before rotation) never double-grant. Grants the gem reward to
 // stats.gems and awards Legacy Pass XP via the final returned state.
 if (
 updatedWeeklyChallenge &&
 updatedWeeklyChallenge.completed &&
!updatedWeeklyChallenge.rewardClaimed
 ) {
 const def = getWeeklyChallengeDefinition(updatedWeeklyChallenge.challengeId);
 const gemReward = typeof def?.reward === 'number' && def.reward > 0 ? Math.floor(def.reward): 0;
 if (gemReward > 0) {
 newStats.gems = (typeof newStats.gems === 'number' && isFinite(newStats.gems) ? newStats.gems: 0) + gemReward;
 }
 weeklyChallengeXpToAward += LEGACY_PASS_XP.weeklyChallenge;
 updatedWeeklyChallenge = {...updatedWeeklyChallenge, rewardClaimed: true };
 logger.info(`[WEEKLY_CHALLENGE] Reward granted: +${gemReward} gems, +${weeklyChallengeXpToAward} Legacy Pass XP (${updatedWeeklyChallenge.challengeId})`);
 }
 } catch (wcErr) {
 logger.error('[WEEKLY_CHALLENGE] Progress update failed:', wcErr);
 }

 // Build week result for the result sheet. Pet food + luxury upkeep use the
 // ACTUAL charged amounts (the helpers floor their deduction at $0, so on a broke
 // week the nominal overstates what was really paid); every other component is
 // already the real figure (loan autopay tracks its actual payment). Equals the
 // old nominal sum on any week the player could afford these upkeeps.
 // BOTH SIDES OF A MERGE, and both were right. main added luxuryRiskCost
 // (insurance premiums + uninsured incident losses — real cash the luxury tick
 // already took out of the wallet, with no reader anywhere, so the recap
 // under-reported expenses by it: recap-1). This branch added identityCharged,
 // the grooming and procedure spending the identity tick takes the same way.
 // They are independent components of the same sum; keeping one would silently
 // reintroduce the other's bug.
 const totalExpenses = incomeTax + weeklyRent + totalLoanAutoPaid + petFoodCharged + housingUpkeep + luxuryCharged + luxuryRiskCost + identityCharged;
 const weekResult = {
 luckyBonus: luckyBonus > 0 ? luckyBonus: undefined,
 luckyMessage: luckyMessage || undefined,
 luckyTier,
 streakBonus: streakBonusAmount > 0 ? streakBonusAmount: undefined,
 // Luxury yield (charter fees, dividends, museum loan fees — up to six figures
 // a week late-game) is credited to the wallet by the luxury tick but was
 // missing from the recap entirely, so netChange never matched the money the
 // player actually gained. Added to the DISPLAY fields only: `totalIncome` is
 // computed far earlier and feeds calculateIncomeTax, so folding it in there
 // would retroactively tax the yield — a balance change, not a reporting fix.
 incomeEarned: totalIncome + luckyBonus + streakBonusAmount + luxuryYield,
 expensesPaid: Math.round(totalExpenses),
 netChange: Math.round(totalIncome + luckyBonus + streakBonusAmount + luxuryYield - totalExpenses),
 careerProgressPercent: (() => {
 const activeCareer = (updatedCareers || []).find((c: any) => c?.id === newCurrentJob && c?.accepted);
 return activeCareer?.progress || 0;
 })(),
 // Side-channel teaser set just below after the cliffhanger roll resolves.
 cliffhangerTeaser: undefined as string | undefined,
 };

 // R7 Phase 2 step 2.10: end-of-week cliffhanger roll extracted into
 // ./actions/weekly/applyCliffhangerRoll.ts. Same roll, same seed
 // (nextWeeksLived), same `setWeeksLived: nextWeeksLived + 1`, same
 // try/catch swallow. teaser surfaces here for the weekResult side-channel.
 const cliffRoll = applyCliffhangerRoll({ prevState, nextWeeksLived });
 const newPendingCliffhanger = cliffRoll.pendingCliffhanger;
 if (cliffRoll.teaser) {
   weekResult.cliffhangerTeaser = cliffRoll.teaser;
 }

 // Pulse tick effects fold into the final return: replace socialMedia,
 // apply reputationDelta (negative when scandals were active this tick).
 let pulseSocialMedia = pulseTickResult?.socialMedia ?? prevState.socialMedia;
 // Fold the deterministic anniversary auto-post into the post-pulse-tick feed
 // (immutable — clones socialMedia so prevState is never mutated).
 if (anniversaryResult.post && pulseSocialMedia) {
   pulseSocialMedia = {
     ...pulseSocialMedia,
     totalPosts: (pulseSocialMedia.totalPosts ?? 0) + 1,
     recentPosts: [anniversaryResult.post, ...(pulseSocialMedia.recentPosts ?? [])].slice(0, 50),
   };
 }
 const pulseRepAdjusted = pulseTickResult
 ? Math.max(0, (newStats.reputation ?? 50) + pulseTickResult.reputationDelta)
: newStats.reputation;

 // Spark tick: replace sparkApp with the tick's result (quota reset,
 // boost expiry, jealousy spawn). Surfaces tick notifications into the
 // pendingNotifications queue alongside everyone else.
 let sparkAppNext = sparkTickResult?.sparkApp ?? prevState.sparkApp;

 // In-game subscription auto-renew billing (Pulse Verified Pro + Spark
 // Premium). These are paid from cash — NOT real App Store IAPs — so the weekly
 // fee is debited from newStats.money here (mirror-safe: stats.money only) and
 // the subscription lapses (perks off) if the player can't afford the renewal.
 // Runs AFTER income/rent so it bills real post-income cash. Inert (byte-
 // identical) when no in-game subscription is active: totalCharged 0, both
 // *Changed flags false, no notifications, and the app objects pass through by
 // reference.
 // Wrapped like every other subsystem tick: the helper self-guards its inputs,
 // but an unguarded throw here (or in a future edit) would abort the whole
 // `nextWeek` updater and soft-lock "Next Week". On error, bill nothing and pass
 // both subscriptions through unchanged (carry-over — perks/money untouched).
 let subscriptionBilling: ReturnType<typeof applySubscriptionsForWeek> = {
   verifiedPro: pulseSocialMedia?.verifiedPro,
   sparkPremium: sparkAppNext?.premium,
   verifiedProChanged: false,
   sparkPremiumChanged: false,
   totalCharged: 0,
   notifications: [],
 };
 try {
   subscriptionBilling = applySubscriptionsForWeek({
     verifiedPro: pulseSocialMedia?.verifiedPro,
     sparkPremium: sparkAppNext?.premium,
     moneyAvailable: newStats.money,
     nextWeeksLived,
   });
 } catch (subErr) {
   logger.error('[SUBSCRIPTIONS TICK] failed:', subErr);
 }
 if (subscriptionBilling.totalCharged > 0) {
   newStats.money = Math.max(0, newStats.money - subscriptionBilling.totalCharged);
   // Fold the weekly subscription fee into the recap's expense/net totals so the
   // cash drop is accounted (was previously debited but invisible to the recap).
   // Guarded by totalCharged > 0 → exact no-op when no in-game sub is active, so
   // the seeded-tick equivalence snapshots stay byte-identical.
   const chargeRounded = Math.round(subscriptionBilling.totalCharged);
   weekResult.expensesPaid += chargeRounded;
   weekResult.netChange -= chargeRounded;
 }
 // Blue check is derived from an ACTIVE Verified Pro subscription — when a weekly
 // renewal lapses, clear userProfile.verified too. Only fires on a real lapse (an
 // active in-game sub that just went inactive), so it's a no-op for equivalence saves.
 let userProfileNext = prevState.userProfile;
 if (
   subscriptionBilling.verifiedProChanged &&
   subscriptionBilling.verifiedPro?.active !== true &&
   prevState.userProfile?.verified
 ) {
   userProfileNext = { ...prevState.userProfile, verified: false };
 }
 if (subscriptionBilling.verifiedProChanged && pulseSocialMedia) {
   pulseSocialMedia = { ...pulseSocialMedia, verifiedPro: subscriptionBilling.verifiedPro };
 }
 if (subscriptionBilling.sparkPremiumChanged && sparkAppNext && subscriptionBilling.sparkPremium) {
   sparkAppNext = { ...sparkAppNext, premium: subscriptionBilling.sparkPremium };
 }
 for (const [i, text] of subscriptionBilling.notifications.entries()) {
   pendingNotifications.push({
     id: `subscription-tick-${nextWeeksLived}-${i}`,
     title: 'Subscription',
     message: text,
   });
 }

 if (sparkTickResult?.notifications) {
 for (const [i, text] of sparkTickResult.notifications.entries()) {
 pendingNotifications.push({
 id: `spark-tick-${nextWeeksLived}-${i}`,
 title: 'Spark',
 message: text,
 });
 }
 }

 // Hustle tick effects: spread the fresh hustleApp into final state,
 // apply campaign spend / revenue lift / scandal drag to money.
 const hustleAppNext = hustleTickResult?.hustleApp ?? prevState.hustleApp;
 if (hustleTickResult && hustleTickResult.cashDelta!== 0) {
 newStats.money = Math.max(0, newStats.money + hustleTickResult.cashDelta);
 }

 // Crypto market tick (STATE_VERSION 16, BitcoinMiningApp remake).
 // Evolves regimes, walks prices, fills open limit/stop orders, runs due DCA
 // schedules (debited from bank accounts, not cash). The existing mining tick
 // above already folded mining earnings into `updatedCryptos`; this tick layers
 // price evolution and order execution on top.
 tickProfiler.mark('disease_pets_vehicles');

      // One seeded roll source for all subsystem ticks this week. Namespaced keys
 // (crypto.* / darkweb.* / politics.* / stock.*) keep the draws independent.
 const weeklyRoll = makeWeeklyRoll(nextWeeksLived);
 // Crypto tick wrapped like the other subsystem ticks (banking/stocks/politics):
 // an unguarded throw here aborts the whole nextWeek updater and soft-locks
 // "Next Week". The tick self-guards missing top-level slices, but a
 // present-but-null sub-field (e.g. a CloudSync-merged or hand-edited save with
 // `cryptoMarket.openOrders: null` / `coinMarkets: null`) can still throw. On
 // failure, carry the prior crypto/banking state forward so progression completes.
 let finalCryptos = updatedCryptos;
 let finalCryptoMarket = prevState.cryptoMarket ?? initialGameState.cryptoMarket!;
 let bankingAfterCrypto = prevState.banking ?? initialGameState.banking!;
 try {
 const cryptoTick = runCryptoWeeklyTick({
 market: prevState.cryptoMarket ?? initialGameState.cryptoMarket!,
 cryptos: updatedCryptos,
 banking: prevState.banking ?? initialGameState.banking!,
 cashIn: newStats.money,
 currentWeek: nextWeeksLived,
 economyState: prevState.economy?.economyEvents?.currentState,
 // Seeded by the absolute week so price walks / order fills are deterministic:
 // React 19 runs this updater twice (StrictMode / speculative renders), and a
 // live Math.random() made the two invocations disagree — React keeps whichever
 // it commits, so the outcome was effectively random per render. Seeding also
 // makes outcomes reproducible from the save (no save-scum drift).
 rollFor: weeklyRoll,
 });
 finalCryptos = cryptoTick.cryptos;
 finalCryptoMarket = cryptoTick.market;
 bankingAfterCrypto = cryptoTick.banking ?? prevState.banking ?? initialGameState.banking!;
 if (cryptoTick.cashDelta!== 0) {
 newStats.money = Math.max(0, newStats.money + cryptoTick.cashDelta);
 }
 for (const note of cryptoTick.notifications) {
 pendingNotifications.push({ id: note.id, title: note.title, message: note.message });
 }
 } catch (cryptoErr) {
 logger.error('[CRYPTO TICK] failed:', cryptoErr);
 }

 // Banking system tick (STATE_VERSION 14, AdvancedBankApp remake).
 // Mirrors the freshly computed cash/savings/loans into the new banking slice
 // and recomputes the credit score. While the legacy bankSavings/loans/stats.money
 // fields remain authoritative for the old UI, this keeps the new slice in sync
 // so the AdvancedBankApp rewrite (Phase C) reads consistent state.
 // Any user-added bill-pay rules also fire here; for existing players the rule
 // list is empty, so this is effectively a no-op until the new UI ships.
 // Wrapped in try/catch like the other subsystem ticks (pulse/spark/stocks):
 // this tick's crash surface grew (account-interest accrual + per-tick
 // budgetSpend tracking), and an unhandled throw here would abort the whole
 // week (soft-lock "Next Week"). On failure, preserve the prior banking slice
 // and processed loans so progression still completes.
 let bankingTick: ReturnType<typeof runWeeklyBankingTick>;
 try {
 bankingTick = runWeeklyBankingTick({
 banking: bankingAfterCrypto,
 prevLoans: prevState.loans ?? [],
 processedLoans,
 newBankSavings,
 newMoney: newStats.money,
 economyState: prevState.economy?.economyEvents?.currentState,
 currentWeek: nextWeeksLived,
 // v22 Wave A interest ledgers: legacy savings interest credited this week +
 // interest serviced on the real loan-autopay path. Feed the previously-$0
 // totalInterestEarned / totalInterestPaid chips and crossSystemSummary.
 savingsInterest,
 loanInterestPaid: totalLoanInterest,
 // Categorized weekly outflows already deducted from cash above — recorded
 // into banking.budgetSpend so the bank's Budget tab reflects real spending.
 // Bill-pay rules and manual loan payments track themselves; not repeated here.
 spendEvents: [
 { category: 'housing', amount: weeklyRent + housingUpkeep },
 { category: 'food', amount: dietWeeklyCost },
 { category: 'taxes', amount: incomeTax },
 { category: 'debt', amount: totalLoanAutoPaid },
 // Actual charged amounts (floored at $0 by the helpers), so the Budget tab
 // reflects real spending on a broke week — not the nominal sticker upkeep.
 { category: 'lifestyle', amount: petFoodCharged },
 // Luxury upkeep: actual amount applyLuxuryItemsForWeek deducted above (floored).
 { category: 'lifestyle', amount: luxuryCharged },
 // Groceries + wardrobe upkeep: actual amount applyIdentityForWeek deducted.
 { category: 'lifestyle', amount: identityCharged },
 // Vehicle running costs: same owned-vehicle sum applyVehiclesForWeek deducted.
 { category: 'transport', amount: (prevState.vehicles || []).reduce(
 (sum: number, v) => sum + (v?.owned ? ((v.weeklyMaintenanceCost || 0) + (v.weeklyFuelCost || 0)) : 0), 0) },
 // In-game subscription fee (Pulse Verified Pro / Spark Premium) — appended only
 // when a fee was actually charged this tick, so the spendEvents array (and thus
 // banking.budgetSpend) is byte-identical when no in-game sub is active.
 ...(subscriptionBilling.totalCharged > 0
 ? [{ category: 'lifestyle' as const, amount: subscriptionBilling.totalCharged }]
 : []),
 ],
 });
 } catch (bankingErr) {
 logger.error('[BANKING TICK] Failed:', bankingErr);
 bankingTick = {
 banking: bankingAfterCrypto,
 loansWithTrackers: processedLoans,
 notifications: [],
 lateFeesDeducted: 0,
 billsPaidFromCash: 0,
 };
 }
 if (bankingTick.lateFeesDeducted > 0) {
 newStats.money = Math.max(0, newStats.money - bankingTick.lateFeesDeducted);
 }
 // Bills paid from a mirrored (checking-default) account must hit real cash —
 // the mirror's balance is overwritten from stats.money every tick, so without
 // this a "paid" bill cost the player nothing (inverted bill-pay).
 if (bankingTick.billsPaidFromCash > 0) {
 newStats.money = Math.max(0, newStats.money - bankingTick.billsPaidFromCash);
 }
 for (const note of bankingTick.notifications) {
 pendingNotifications.push({ id: note.id, title: note.title, message: note.message });
 }

 // ── v22 Wave A shared weekly modules — wired here beside the banking tick,
 //    each behind a safe null-guard, folded into nextState like the sibling
 //    pure helpers above. Idempotent per week (no wall-clock; use nextWeeksLived).

 // (1) Channel memberships (YouVideo + Streamly, shared gamingStreaming slice):
 //     ≤5% of subs convert to paid members; revenue is capped ($75k/wk) and
 //     credited to cash + totalSubEarnings. Also unfreezes the creator "Lv N"
 //     badge by recomputing level/perkTier from accumulated experience.
 let nextGamingStreaming = prevState.gamingStreaming;
 if (nextGamingStreaming) {
 // Wrapped like every other subsystem tick: a throw here (e.g. a partial
 // gamingStreaming slice) must not abort the whole `nextWeek` updater. On
 // error, carry the prior streaming slice forward with no membership revenue.
 try {
 const membershipsResult = applyContentMemberships({
 gamingStreaming: nextGamingStreaming,
 currentWeek: nextWeeksLived,
 });
 nextGamingStreaming = membershipsResult.gamingStreaming;
 if (membershipsResult.cashDelta > 0) {
 newStats.money = Math.max(0, newStats.money + membershipsResult.cashDelta);
 logger.info(`[MEMBERSHIPS] +$${membershipsResult.cashDelta} (${membershipsResult.reason}, ${membershipsResult.paidMembers} members)`);
 }
 // Persist level from experience (shared creatorLevel) so the badge advances.
 if (nextGamingStreaming) {
 const lvl = creatorLevelFromExperience(nextGamingStreaming.experience ?? 0);
 nextGamingStreaming = { ...nextGamingStreaming, level: lvl, perkTier: creatorPerkTier(lvl) };
 }
 } catch (memErr) {
 logger.error('[MEMBERSHIPS TICK] failed:', memErr);
 nextGamingStreaming = prevState.gamingStreaming;
 }
 }

 // (2) Savings goals: sweep each goal's autoContribute FROM a real source
 //     (linked account or cash — assets conserved), cap at target, and grant a
 //     bounded once-only completion reward. Operates on the post-tick banking
 //     slice; the reward is the only new money and is tiny (≤min(1% target,$500)).
 let nextBankingSlice = bankingTick.banking;
 if (nextBankingSlice && Array.isArray(nextBankingSlice.savingsGoals) && nextBankingSlice.savingsGoals.length > 0) {
 // Wrapped like every other subsystem tick: a throw here must not abort the
 // whole `nextWeek` updater. On error, carry the banking slice + cash forward.
 try {
 const goalsResult = applySavingsGoals({
 banking: nextBankingSlice,
 cash: newStats.money,
 currentWeek: nextWeeksLived,
 });
 nextBankingSlice = goalsResult.banking ?? nextBankingSlice;
 newStats.money = Math.max(0, goalsResult.cash + goalsResult.rewardCash);
 if (goalsResult.happinessDelta > 0) {
 newStats.happiness = Math.max(0, Math.min(100, (newStats.happiness ?? 0) + goalsResult.happinessDelta));
 }
 for (const gid of goalsResult.completedGoalIds) {
 pendingNotifications.push({ id: `goal-complete-${gid}-${nextWeeksLived}`, title: '🎯 Savings Goal Reached', message: 'You hit a savings goal!' });
 }
 if (goalsResult.rewardCash > 0) {
 logger.info(`[SAVINGS GOALS] Completion reward +$${goalsResult.rewardCash}`);
 }
 } catch (goalsErr) {
 logger.error('[SAVINGS GOALS TICK] failed:', goalsErr);
 }
 }

 // (3) Favor ledger expiry — wires the previously-unwired contacts favor tick
 //     (tickFavors' pure core `expireFavors`) into the weekly orchestrator so
 //     lapsed IOUs/favors are marked expired. Pure; no-op when no ledger.
 //     Wrapped like every other subsystem tick: a present-but-partial ledger
 //     (CloudSync merge / hand-edit) with a missing `favors` array would throw
 //     inside `.map`, and an unguarded throw here aborts the whole `nextWeek`
 //     updater → "Next Week" soft-locks. Carry the prior ledger forward on error.
 let nextFavorLedger = prevState.favorLedger;
 try {
 nextFavorLedger = prevState.favorLedger
 ? expireFavors(prevState.favorLedger, nextWeeksLived)
 : prevState.favorLedger;
 } catch (favorErr) {
 logger.error('[FAVORS TICK] failed:', favorErr);
 }

 // Dark Web tick (STATE_VERSION 18, OnionApp remake).
 // Decays heat, refreshes marketplace listings, settles laundering, expires
 // overdue jobs, and rolls police events at high heat. Police outcomes are
 // folded into jailWeeks and cash/dirty-BTC deltas below.
 // Wrapped in try/catch like the sibling subsystem ticks: the tick only
 // normalizes some of its sub-arrays, so a present-but-null slice
 // (`darkWeb.vendors`/`skills`/`laundering` from a CloudSync-merged or
 // hand-edited save) could throw and abort the whole week. On failure, carry
 // the prior darkWeb slice forward with zeroed deltas so progression completes.
 let darkWebTick: ReturnType<typeof runDarkWebWeeklyTick> = {
 darkWeb: prevState.darkWeb ?? initialGameState.darkWeb!,
 jailWeeksAdded: 0,
 dirtyBtcSeized: 0,
 relationshipDeltas: [],
 notifications: [],
 };
 try {
 darkWebTick = runDarkWebWeeklyTick({
 darkWeb: prevState.darkWeb ?? initialGameState.darkWeb!,
 currentWeek: nextWeeksLived,
 relationships: processedRelationships,
 rollFor: weeklyRoll,
 inJail: (prevState.jailWeeks ?? 0) > 0,
 });
 } catch (dwErr) {
 logger.error('[DARKWEB TICK] failed:', dwErr);
 }

 tickProfiler.mark('crypto_banking_darkweb');

      // Stocks Remake 6 tick: sector rotation, quarterly dividends,
 // limit/stop order matching. Runs after the legacy simulateWeek so
 // prices are fresh; layers sector tilt on top, then matches orders.
 let stocksTickResult: ReturnType<typeof runStocksWeeklyTick> | null = null;
 try {
 // R3-A: stockMarket helpers are ES imports.
 const symbols: string[] = getAllStockSymbols();
 const prices: Record<string, number> = {};
 const yields: Record<string, number> = {};
 for (const sym of symbols) {
 const info = getStockInfo(sym);
 prices[sym] = info.price;
 yields[sym] = info.dividendYield;
 }
 const baseHoldings = (reinvestedStocks.length > 0 ? reinvestedStocks: (prevState.stocks?.holdings ?? []))
.filter((h: any) => h && typeof h === 'object' && h.symbol)
.map((h: any) => ({
 symbol: h.symbol,
 shares: h.shares,
 averagePrice: h.averagePrice,
 currentPrice: prices[h.symbol?.toUpperCase()] ?? h.currentPrice,
 }));
 stocksTickResult = runStocksWeeklyTick({
 holdings: baseHoldings,
 openOrders: prevState.stocks?.openOrders ?? [],
 orderHistory: prevState.stocks?.orderHistory ?? [],
 sectorSnapshots: prevState.stocks?.sectorSnapshots,
 yields,
 prices,
 currentWeek: nextWeeksLived,
 // Gate buy-order fills on actual cash (anti free-fill exploit).
 cashIn: newStats.money,
 // Macro teeth: a recession/crash/boom now drives a broad-market drift on
 // equities (crypto already reacts via forced regimes).
 economyState: prevState.economy?.economyEvents?.currentState,
 rollFor: weeklyRoll,
 });
 if (stocksTickResult.cashDelta!== 0) {
 newStats.money = Math.max(0, newStats.money + stocksTickResult.cashDelta);
 }
 // Persist the weekly sector tilt + macro drift into the AUTHORITATIVE module
 // price so the move reaches the market board, Movers sort, market-order fills,
 // and the savedMarketPrices snapshot below — and COMPOUNDS next week (the walk
 // starts from the moved price). Determinism is preserved: the factors are
 // seeded (weeklyRoll) and the moved price is what gets snapshotted/restored.
 // adjustStockPrice re-clamps to the same [0.01, $1M] band as the walk.
 for (const sym in stocksTickResult.priceFactors) {
 adjustStockPrice(sym, stocksTickResult.priceFactors[sym]);
 }
 for (const note of stocksTickResult.notifications) {
 pendingNotifications.push({ id: note.id, title: note.title, message: note.message });
 }
 } catch (stkErr) {
 logger.error('[STOCKS TICK] failed:', stkErr);
 }

 tickProfiler.mark('stocks');

      // Politics tick: scandal exposure (driven by dark-web heat + dirty PAC
 // money + karma), severity decay, approval drift. Cross-wires with
 // dark-web so corrupt careers stay risky.
 // RESILIENCE: this tick gained election-resolution surface this week, so like
 // its banking/stocks siblings it is wrapped in try/catch — a throw here must
 // NOT abort the whole `nextWeek` updater (which would soft-lock "Next Week").
 // On failure, politics carries over unchanged for the week.
 let nextPolitics = prevState.politics ?? {
 careerLevel: 0,
 approvalRating: 50,
 policyInfluence: 0,
 electionsWon: 0,
 policiesEnacted: [],
 lobbyists: [],
 alliances: [],
 campaignFunds: 0,
 };
 try {
 const politicsTick = runPoliticsWeeklyTick({
 politics: nextPolitics,
 darkWebHeat: darkWebTick.darkWeb.heat,
 karma: prevState.karma?.score ?? 0,
 contentiousPolicies: (prevState.politics?.policiesEnacted ?? []).length,
 currentWeek: nextWeeksLived,
 rollFor: weeklyRoll,
 });
 for (const note of politicsTick.notifications) {
 pendingNotifications.push({ id: note.id, title: note.title, message: note.message });
 }
 // Forced resignation OR lost re-election: drop careerLevel to 0 and clear the
 // election countdown. The political salary is gated on politics.careerLevel > 0
 // (lib/economy/passiveIncome.ts), so zeroing it here stops the paycheck. The
 // re-election-loss path in the tick already sets careerLevel:0; this also covers
 // the scandal-resignation flag.
 nextPolitics = politicsTick.politics;
 if (politicsTick.forcedResignation || politicsTick.lostOffice) {
 nextPolitics = {
...nextPolitics,
 careerLevel: 0,
 nextElectionWeek: undefined,
 };
 // Also reset the political career entry + currentJob so lifestyle costs and
 // the "in office?" UI stop treating a voted-out / resigned player as a sitting
 // official — zeroing politics.careerLevel alone left careers.political (read by
 // lifestyle.ts) and currentJob desynced.
 updatedCareers = updatedCareers.map(c =>
 c.id === 'political' ? {...c, accepted: false, applied: false, level: 0 }: c
 );
 if (newCurrentJob === 'political') newCurrentJob = undefined;
 }
 } catch (polErr) {
 logger.error('[POLITICS TICK] failed:', polErr);
 }
 for (const note of darkWebTick.notifications) {
 pendingNotifications.push({ id: note.id, title: note.title, message: note.message });
 }
 tickProfiler.mark('politics');
      tickProfiler.endTick();

      // Apply any relationship-discovery deltas to processedRelationships in-place
 // so the canonical return picks them up.
 if (darkWebTick.relationshipDeltas.length > 0) {
 const deltasById = new Map(darkWebTick.relationshipDeltas.map((d) => [d.id, d.delta]));
 for (let i = 0; i < processedRelationships.length; i++) {
 const rel = processedRelationships[i];
 const delta = rel ? deltasById.get(rel.id): undefined;
 if (rel && delta!= null) {
 processedRelationships[i] = {
...rel,
 relationshipScore: Math.max(0, Math.min(100, (rel.relationshipScore ?? 0) + delta)),
 };
 }
 }
 }

 const nextState: GameState = {
...prevState,
 // Legacy achievements array with `luxury_life` un-orphaned (same ref unless it
 // just flipped to complete — see updatedAchievements above).
 achievements: updatedAchievements,
 // Luxury holdings after this week's value drift (same ref when nothing moved).
 luxuryHoldings: nextLuxuryHoldings,
 // Identity after this week's body simulation and grooming decay.
 identity: nextIdentity,
 careers: updatedCareers,
 currentJob: newCurrentJob,
 educations: updatedEducations,
 week: nextWeek,
 weeksLived: nextWeeksLived,
 bankSavings: newBankSavings,
 loans: bankingTick.loansWithTrackers,
 banking: nextBankingSlice,
 // v22 Wave A: memberships payout + level/perkTier recompute; favor expiry.
 gamingStreaming: nextGamingStreaming,
 favorLedger: nextFavorLedger,
 darkWeb: darkWebTick.darkWeb,
 politics: nextPolitics,
 updatedAt: preRolls.timestamp,
 date: {
 week: nextWeek,
 age: nextAge,
 year: nextYear,
 month: nextMonth,
 },
 socialMedia: pulseSocialMedia,
 sparkApp: sparkAppNext,
 hustleApp: hustleAppNext,
 // Same reference as prevState.userProfile unless a Verified Pro renewal lapsed
 // this tick (then verified is cleared) — no-op for saves with no active sub.
 userProfile: userProfileNext,
 // Final NaN/Infinity guard on the unbounded fields: once money or reputation
 // goes NaN (a bad delta upstream), every later `Math.max(0, NaN + x)` stays NaN
 // and the UI shows "NaN" until the next save/load repair. isFinite catches it.
 stats: {
 ...newStats,
 money: isFinite(newStats.money) ? Math.min(MONEY_CEILING, newStats.money): 0,
 reputation: isFinite(pulseRepAdjusted) ? pulseRepAdjusted: (isFinite(newStats.reputation) ? newStats.reputation: 50),
 },
 // Death warning system tracking
 healthZeroWeeks: newHealthZeroWeeks,
 happinessZeroWeeks: newHappinessZeroWeeks,
 // Achievement-counter accumulators that the achievement system
 // reads via gs.healthWeeks (consecutive weeks at 90+ health,
 // reset when health dips below) and gs.totalHappiness (running
 // sum used for "average happiness" achievements). Both fields
 // were declared on GameState but nothing wrote to them.
 healthWeeks: newStats.health >= 90
 ? (prevState.healthWeeks || 0) + 1
: 0,
 totalHappiness: (prevState.totalHappiness || 0) + (newStats.happiness || 0),
 showZeroStatPopup: newShowZeroStatPopup,
 zeroStatType: newZeroStatType,
 showDeathPopup: newShowDeathPopup,
 deathReason: newDeathReason,
 // R7 Phase 2 step 2.8-B: death ribbon extracted into
 // ./actions/weekly/applyDeathRibbon.ts. Same edge detection
 // (newShowDeathPopup && !prevState.showDeathPopup), same classify +
 // collection-merge, same try/catch swallow.
...applyDeathRibbon({
   prevState,
   newStats,
   nextWeeksLived,
   newShowDeathPopup,
 }).partial,
 showWeddingPopup: newShowWeddingPopup,
 weddingPartnerName: newWeddingPartnerName,
 // CRITICAL: Cap energy to 0-100 after all calculations (regen + penalties)
 // Capping already performed on newStats object above before return statement

 // Reset weekly counters every time we advance a week
 // These counters track how many times each job/activity was done THIS week
 weeklyStreetJobs: {}, // Always reset when advancing week
 weeklyJailActivities: {}, // Always reset when advancing week
 weeklyStudySessions: {}, // Always reset when advancing week
 weeklyPursuitPractice: {}, // Hobby mastery: reset weekly practice caps
 // Decrease jail time by 1 week when advancing, or add police encounter jail time
 jailWeeks: (() => {
 // Base: either an encounter triggered, or decay the prior sentence.
 const base = policeEncounterJailWeeks > 0
 ? policeEncounterJailWeeks
: (prevState.jailWeeks > 0 ? Math.max(0, prevState.jailWeeks - 1): 0);
 // Add any darkWeb police-event sentence on top (cap at 52w).
 return Math.min(52, base + darkWebTick.jailWeeksAdded);
 })(),
 // Tally weeks spent in prison this life — the field was referenced
 // by achievementsData (10-weeks-served counter) but never written.
 totalPrisonWeeks: (prevState.totalPrisonWeeks ?? 0) + (prevState.jailWeeks > 0 ? 1: 0),
 // R7 Phase 2 step 2.9: lifetimeStatistics accumulator extracted into
 // ./actions/weekly/applyLifetimeStatistics.ts. Same 8 accumulators
 // (totalJailTime, totalChildren, totalWeeksWorked, highestSalary,
 // careerHistory, peakNetWorth, peakNetWorthWeek, netWorthHistory,
 // weeklyEarningsHistory), same 10-week sample interval, same 100-entry
 // cap, same passthrough when no lifetimeStatistics slice.
 lifetimeStatistics: applyLifetimeStatistics({
   prevState,
   newBornChildrenCount: newBornChildren.length,
   careerSalary,
   // Political office pay is owned by passiveIncome, so `careerSalary` is 0
   // while in office — without this the work accumulators (and therefore the
   // pension) never moved for a career politician. GL-3.
   politicalWeeklySalary: getPoliticalWeeklySalary(prevState),
   safeNetWorth,
   totalIncome,
   nextWeeksLived,
 }).updatedLifetimeStatistics,
 // Wanted level decay
 wantedLevel: newWantedLevel,
 // Stocks: prefer the Remake 6 tick result (includes sector tilt,
 // dividends, fills); fall back to legacy refresh if tick failed.
 stocks: stocksTickResult
 ? {
...(prevState.stocks ?? { watchlist: [] }),
 holdings: stocksTickResult.holdings,
 watchlist: prevState.stocks?.watchlist ?? [],
 realizedGains: (prevState.stocks?.realizedGains ?? 0) + stocksTickResult.realizedGains,
 savedMarketPrices: getStockPricesSnapshot(),
 // Keep last week's snapshot so the market board can show ▲/▼ weekly change.
 lastWeekPrices: prevState.stocks?.savedMarketPrices,
 openOrders: stocksTickResult.openOrders,
 orderHistory: stocksTickResult.orderHistory,
 sectorSnapshots: stocksTickResult.sectorSnapshots,
 totalDividends: (prevState.stocks?.totalDividends ?? 0) + stocksTickResult.dividendsUSD,
 // Honor the field's "resets at year boundary" contract (was accumulate-forever,
 // converging on lifetime totalDividends). Zeroes on the 52-week boundary,
 // mirroring crypto's realizedGainsThisYear reset.
 dividendsThisYear: accumulateDividendsThisYear(
 prevState.stocks?.dividendsThisYear ?? 0,
 stocksTickResult.dividendsUSD,
 nextWeeksLived,
 ),
 }
: (() => {
 const holdingsToUpdate = reinvestedStocks.length > 0 ? reinvestedStocks: prevState.stocks?.holdings || [];
 const validHoldings = holdingsToUpdate.filter(h => h && typeof h === 'object' && h.symbol);
 const updatedHoldings = validHoldings.map(holding => {
 const stockInfo = getStockInfo(holding.symbol.toUpperCase());
 return {
...holding,
 currentPrice: stockInfo.price > 0 ? stockInfo.price: holding.currentPrice,
 };
 });
 return {
 holdings: updatedHoldings,
 watchlist: prevState.stocks?.watchlist || [],
 realizedGains: prevState.stocks?.realizedGains || 0,
 savedMarketPrices: getStockPricesSnapshot(),
 lastWeekPrices: prevState.stocks?.savedMarketPrices,
 };
 })(),
 // Process weddings, pregnancy, and relationship health
 relationships: processedRelationships,
 // Rebuild family.children from the aged child relationships EVERY tick, plus a
 // spouse from a scheduled wedding executed this tick. Previously family.children
 // (what the Family UI + heir logic read) was only rebuilt on birth/wedding weeks
 // and copied the stale prevState list, so children showed "Age 0" forever and
 // never crossed the >=18 adult/heir boundary. processedRelationships already
 // holds every child (freshly aged via applyChildAging) plus any newborns pushed
 // this tick; merge by id to preserve extra family-only fields.
 family: (() => {
 const childRels = processedRelationships.filter((r) => r.type === 'child');
 const prevChildById = new Map((prevState.family?.children || []).map((c) => [c.id, c]));
 const children = childRels.map((rel) => {
 const existing = prevChildById.get(rel.id);
 return existing ? {...existing, ...rel }: {...rel, birthWeeksLived: nextWeeksLived };
 });
 return {
...prevState.family,
 // Re-derived, not carried: the health pass can end a marriage mid-tick and
 // this denormalized copy used to survive it (2026-07-28 audit GL-5).
 spouse: resolveFamilySpouse({
 prevSpouse: prevState.family?.spouse,
 relationships: processedRelationships,
 newWeddingSpouse: newWeddingSpouse ?? undefined,
 }),
 children,
 };
 })(),
 // Add birth milestone (+ any anniversary milestone raised this tick).
 // P0-12: store the absolute week so the LifeStoryModal timeline orders
 // correctly. `nextWeek` is the cyclic 1-4 UI value and made children
 // appear to all be born in the same handful of weeks.
 lifeMilestones: (() => {
 const base = newBornChildren.length > 0 ? [
...(prevState.lifeMilestones || []),
...newBornChildren.map(child => ({
 id: `child_birth_${nextWeeksLived}_${child.id}`,
 type: 'child_birth' as const,
 week: nextWeeksLived,
 year: nextYear,
 details: { childId: child.id, childName: child.name, gender: child.gender },
 })),
 ]: (prevState.lifeMilestones || []);
 const withAnniversary = anniversaryResult.milestone ? [...base, anniversaryResult.milestone] : base;
 // Cap like the sibling per-life collections (eventLog 500, memories 200):
 // milestones accumulate for a whole life and the array is copied every tick.
 return withAnniversary.length > 200 ? withAnniversary.slice(-200) : withAnniversary;
 })(),
 // Hobbies removed - no longer validating hobby skills
 hobbies: prevState.hobbies || [],
 // Add crypto from warehouse mining + post-trading-tick price evolution / order fills
 cryptos: finalCryptos,
 cryptoMarket: finalCryptoMarket,
 // Degrade miner durability over time
 warehouse: updatedWarehouse,
 // Add new weekly events to pendingEvents
 pendingEvents: updatedPendingEvents,
 // #16: persist the dequeued follow-up chain queue (due ones surfaced above).
 pendingChainedEvents: updatedPendingChainedEvents,
 // GL-1 self-heal: a save latched by the old off-by-one carries an
 // activeEventChain the engine can never advance, which also blocks every
 // future chain. `healedEventChain` is null on an ordinary tick, so this
 // spreads nothing and the output stays byte-identical.
...(healedEventChain ?? {}),
 // Update economy state
 economy: updatedEconomy,
 // Update last event week for pity system
 lastEventWeeksLived: newEventCount > 0 ? nextWeeksLived: prevState.lastEventWeeksLived,
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
 // Housing System — capped portfolio activity timeline (Activity tab feed).
 realEstateActivity: updatedRealEstateActivity,
 // Education System — campus events
...(pendingCampusEvent ? { pendingCampusEventEducationId: pendingCampusEvent }: {}),
 // Engagement Systems
 playStreak: updatedPlayStreak,
 weekResult,
 legacyPoints: newLegacyPoints,
 // Cliffhanger: clear if resolved, set if new one rolled
 pendingCliffhanger: newPendingCliffhanger,
 // Weekly themed challenge progress
 weeklyChallenge: updatedWeeklyChallenge,
 // Legacy Pass XP from a weekly-challenge completion this tick (0 = no-op).
 // awardLegacyPassXp touches ONLY legacyPass UNLESS it triggers a season
 // rollover that auto-collects unclaimed rewards (those land on stats/youthPills/
 // traits, which this fold would drop). So: only defer when a rollover would
 // actually LOSE earned-but-unclaimed rewards — then leave the pass for the
 // season reconciler to roll over with full collection. A fresh/empty pass (or
 // same-season pass) has nothing to lose, so we fold inline as normal.
 legacyPass: (
   weeklyChallengeXpToAward > 0 &&
   !(prevState.legacyPass &&
     prevState.legacyPass.seasonId !== getCurrentSeasonId(now) &&
     getClaimableCount(prevState.legacyPass) > 0)
 )
 ? awardLegacyPassXp(prevState, weeklyChallengeXpToAward, now).legacyPass
: prevState.legacyPass,
 // R7 Phase 2 step 2.8-C: auto checkpoint extracted into
 // ./actions/weekly/applyAutoCheckpoint.ts. Same year-boundary gate
 // (with `Age <N>` label), same pre-death snapshot using prevState
 // UNMODIFIED, same try/catch swallow.
...applyAutoCheckpoint({
   prevState,
   newStats,
   nextWeeksLived,
   newShowDeathPopup,
 }).partial,
 };

 // #6: a character who dies this week must not pocket the week's income.
 // Revert money to the pre-tick value so the persisted/displayed final state
 // (and the death popup's net worth) doesn't include a free final paycheck.
 if (newShowDeathPopup) {
 nextState.stats = {
...nextState.stats,
 money: typeof prevState.stats?.money === 'number' ? prevState.stats.money: nextState.stats.money,
 };
 // The week's money was reverted (no final paycheck on death), so the result
 // sheet must not advertise income/expenses it never actually applied. Mutating
 // the same `weekResult` object the return uses keeps the sheet honest.
 weekResult.incomeEarned = 0;
 weekResult.expensesPaid = 0;
 weekResult.netChange = 0;
 weekResult.luckyBonus = undefined;
 weekResult.streakBonus = undefined;
 }

 // PERF (freeze fix): expose the computed state to the post-update code below.
 postTickState = nextState;
 return nextState;
 } catch (error) {
 // CRITICAL: If state update fails, log error and return previous state
 stateUpdateError = error instanceof Error ? error: new Error(String(error));
 logger.error('[WEEK PROGRESSION] Error in setGameState callback:', stateUpdateError);
        // CR: close the profiling window on the error path too (idempotent via the started flag).
        tickProfiler.endTick();
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
 // R10-2: dedupe by id before flushing. The setGameState updater is pure but
 // React 19 StrictMode / concurrent rendering can invoke it twice, pushing each
 // notification into this outer array twice → duplicate toasts. Keep first per id.
 const seenIds = new Set<string>();
 const uniqueNotifications = pendingNotifications.filter((n) =>
 seenIds.has(n.id) ? false: (seenIds.add(n.id), true)
 );
 setTimeout(() => {
 // NOISE: if this tick killed the character, the DeathPopup owns the
 // screen — routine subsystem banners on top of it are pure clutter.
 // (deathTriggered is assigned by the updater, well before this 100ms
 // callback runs.)
 if (deathTriggered) return;
 // NOISE: a busy mid/late-game week can emit 5-10 subsystem messages
 // (crypto, banking, stocks, politics, relationships…). Showing each as
 // its own banner flooded the screen every "Next Week". Two or fewer
 // show as-is; more collapse into ONE "This week" summary banner (fixed
 // id, so consecutive weeks replace rather than stack).
 if (uniqueNotifications.length <= 2) {
 for (const n of uniqueNotifications) {
 showInfoBanner(n.id, n.message, n.title);
 }
 } else {
 const shown = uniqueNotifications.slice(0, 3);
 const more = uniqueNotifications.length - shown.length;
 const summary = shown.map(n => n.message).join('\n')
 + (more > 0 ? `\n+${more} more this week` : '');
 showInfoBanner('weekly-summary', summary, 'This week');
 }
 }, 100);
 }

 // (Removed) "Almost There!" milestone proximity hints — these fired a toast
 // every few weeks while the player saved toward a money threshold, which read
 // as nagging. Progress toward goals is already visible passively on the
 // dashboard (Active Goals card + the Last Week recap), so the nudge is gone.

 // Validate state after update to ensure no corruption. PERF: yield ONE
 // macrotask so React has processed the updater (which populates postTickState),
 // then use that captured state directly — no arbitrary 50ms stall every week.
 await new Promise(resolve => setTimeout(resolve, 0));
 const updatedState = postTickState ?? gameStateRef.current;
 if (updatedState) {
 // R2-F: pass autoFix=false. The previous `true` triggered an internal
 // `repairGameState` (which deep-clones ~200KB of GameState) on every
 // single week-advance, costing 30-80ms even when the state was valid.
 // The branch below already calls `repairGameState` explicitly when
 // validation fails — so the eager clone was pure waste.
 const validation = validateGameState(updatedState, false);
 if (!validation.valid) {
 logger.error('[WEEK PROGRESSION] State validation failed after update:', validation.errors);
 // Attempt repair
 const repairResult = repairGameState(updatedState);
 if (repairResult.repaired) {
 logger.warn('[WEEK PROGRESSION] Repaired corrupted state:', repairResult.repairs);
 // Update state with repaired version
 setGameState(prev => {
 const repaired = repairGameState(prev);
 return repaired.repaired ? {...prev }: prev; // repairGameState mutates in-place, spread to signal React
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
 // Fire the death buzz exactly once here — NOT inside the setGameState updater,
 // which React 19 runs twice in StrictMode and may run speculatively under
 // concurrent rendering (same double-fire class as the pendingNotifications dedup).
 haptic.error();
 setIsLoading(false);
 setLoadingMessage('');
 logger.warn('[DEATH] Death triggered - stopped loading immediately to show death popup');
 // Early return to prevent any further processing
 return;
 }

 // Normal completion - stop loading
 setIsLoading(false);

 // Process automation rules (if enabled). Prefer the captured post-tick state
 // (the ref may not have committed yet after dropping the 50ms wait).
 const currentState = postTickState ?? gameStateRef.current;
 if (currentState) {
 try {
 
 const executions = processAutomationRules(currentState);

 if (executions.length > 0) {
 // Calculate total money spent by successful automation actions
 const saveTransfer = executions
.filter(e => e.success && e.type === 'save')
.reduce((sum, e) => sum + e.actionsTaken
.filter(a => a.result === 'success')
.reduce((s, a) => s + (a.value || 0), 0), 0);

 // 'save' rules move cash into bank savings (net-worth-neutral) inside this
 // updater. 'invest' rules now perform REAL stock buys as well, but those run
 // through the canonical buyStockMarket action below — which owns the cash
 // debit — so this updater must NOT charge for them (doing so would DOUBLE-
 // charge). 'pay'/'renew' still record to history only; loans are already
 // serviced by the weekly loan tick.
 setGameState(prevState => {
 if (!prevState.automation) return prevState;

 const currentMoney = prevState.stats?.money || 0;
 // Never transfer more cash than the player actually has.
 const transfer = Math.max(0, Math.min(saveTransfer, currentMoney));

 const currentHistory = prevState.automation.executionHistory || [];
 // Strip the transient investOrders before persisting — it's apply-time wiring,
 // not history, and is executed exactly once below (never replayed from a save).
 const newHistory = [...currentHistory,...executions.map(e => ({...e, investOrders: undefined }))].slice(-50);

 if (transfer <= 0) {
 return {
...prevState,
 automation: {
...prevState.automation,
 executionHistory: newHistory,
 },
 };
 }

 return {
...prevState,
 stats: {
...prevState.stats,
 money: currentMoney - transfer,
 },
 bankSavings: (prevState.bankSavings || 0) + transfer,
 automation: {
...prevState.automation,
 executionHistory: newHistory,
 },
 };
 });

 // Execute the REAL stock purchases planned by 'invest' rules via the canonical
 // buy action. buyStockMarket owns the cash debit + 2% broker fee + affordability
 // check and writes ONLY stats.money (never a mirrored banking account). It
 // re-checks live cash on every call, so multiple orders share one running budget
 // and none can overspend; an unaffordable order is rejected (no fake fill).
 const plannedInvestOrders = executions
.filter(e => e.type === 'invest' && e.success)
.flatMap(e => e.investOrders ?? []);
 for (const order of plannedInvestOrders) {
 try {
 buyStockMarket(setGameState, order.symbol, order.amountUSD, order.midPrice);
 } catch (buyErr) {
 logger.warn('[AUTOMATION] Invest order failed:', { order, buyErr });
 }
 }

 logger.info(`[AUTOMATION] Executed ${executions.length} rules, saved $${saveTransfer}, invest orders: ${plannedInvestOrders.length}`);
 }
 } catch (error) {
 logger.error('[AUTOMATION] Failed to process automation rules:', error);
 // Don't block week progression if automation fails
 }
 }

 // Auto-save after week progression (non-blocking).
 // P1-15: surface storage-quota errors immediately to the user — the
 // underlying save queue retries 3× with cleanup, each one re-parsing every
 // backup, which can lock the JS thread for ~10s on near-full devices and
 // feels like a freeze.
 saveGame(false).catch(err => {
 logger.warn('Auto-save after nextWeek failed (will retry):', err);
 const msg = (err && typeof err === 'object' && 'message' in err) ? String((err as { message: unknown }).message ?? '') : String(err);
 if (msg.toLowerCase().includes('quota') && typeof showWarning === 'function') {
 showWarning('storage-quota', 'Your device is low on space — please clean up old saves in Settings.', 'Storage warning');
 }
 });
 } catch (error) {
 logger.error('Failed to progress to next week:', error);
 showError('Progression Error', 'Failed to advance to next week');
 setIsLoading(false);
 } finally {
 // ANTI-EXPLOIT: Release the week progression guard
 nextWeekInProgressRef.current = false;
 }
 }, [setGameState, setIsLoading, setLoadingMessage, setLoadingProgress, showError, showWarning, showInfoBanner, saveGame]);

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
 const updatedStats = {...prevState.stats };

 // Apply money change
 // P2-4: if a negative money cost can't be fully covered, the player shouldn't
 // get the choice's beneficial stat effects for free (the cost just clamped to
 // 0). Track affordability and skip the beneficial stat block below when broke.
 // (Event choices should also be gated to affordable-only in the UI.)
 let effectsAffordable = true;
 if (effects.money!== undefined) {
 const currentMoney = updatedStats.money || 0;
 if (effects.money < 0 && currentMoney + effects.money < 0) {
 effectsAffordable = false;
 }
 updatedStats.money = Math.max(0, currentMoney + effects.money);
 }

 // Apply stat changes
 if (effects.stats && effectsAffordable) {
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
 // Prefer the event's bound relationId. Several event templates
 // (personalCrises/enhancedEvents/cliffhangerEvents/seasonalEvents) specify a
 // relationship delta but never set relationId, which silently dropped the
 // effect after the player had already paid the choice's money/stat cost. Fall
 // back to the most relevant relationship: the spouse/partner if any, else the
 // highest-scored relationship.
 if (effects.relationship!== undefined) {
 let targetRelId = event.relationId;
 if (!targetRelId && updatedRelationships.length > 0) {
 const romantic = updatedRelationships.find(r => r.type === 'spouse' || r.type === 'partner');
 // Secondary fallback: highest-scored NON-FAMILY relationship. Excluding
 // child/parent stops an unbound (often romantic-context) delta from landing on
 // a newborn child (relationshipScore 100 would otherwise win the sort). Drop the
 // effect if nothing qualifies rather than mis-target a family member.
 const nonFamily = updatedRelationships.filter(r => r.type !== 'child' && r.type !== 'parent');
 const fallback = romantic
 ?? [...nonFamily].sort((a, b) => (b.relationshipScore ?? 50) - (a.relationshipScore ?? 50))[0];
 targetRelId = fallback?.id;
 }
 if (targetRelId) {
 updatedRelationships = updatedRelationships.map(rel => {
 if (rel.id === targetRelId) {
 const updated = {
...rel,
 relationshipScore: Math.max(0, Math.min(100, (rel.relationshipScore ?? 50) + effects.relationship!)),
 };
 // Wedding event: promote partner to spouse when player chooses 'marry'
 if (eventId === 'wedding' && choiceId === 'marry' && rel.type === 'partner') {
 (updated as Record<string, unknown>).type = 'spouse';
 // P1-2: clear any planned/engagement state so the weekly scheduled-wedding
 // tick doesn't later charge the 75% balance again for an already-married spouse.
 (updated as Record<string, unknown>).weddingPlanned = undefined;
 (updated as Record<string, unknown>).engagementWeek = undefined;
 logger.info(`[WEDDING] ${rel.name} changed from partner to spouse via event`);
 }
 return updated;
 }
 return rel;
 });
 }
 }

 // Apply pet changes
 let updatedPets = prevState.pets || [];
 if (effects.pet && event.relationId) {
 updatedPets = updatedPets.map(pet => {
 if (pet.id === event.relationId) {
 return {
...pet,
 hunger: Math.max(0, Math.min(100, (pet.hunger ?? 50) + (effects.pet!.hunger || 0))),
 happiness: Math.max(0, Math.min(100, (pet.happiness ?? 50) + (effects.pet!.happiness || 0))),
 health: Math.max(0, Math.min(100, (pet.health ?? 50) + (effects.pet!.health || 0))),
 };
 }
 return pet;
 });
 }

 // Handle special effects
 // IMMUTABILITY: copy the array — we `.push()` below, and aliasing
 // prevState.diseases would mutate the previous snapshot (StrictMode double-
 // invoke then sees the disease already present and silently skips it).
 let updatedDiseases = [...(prevState.diseases || [])];
 // Preserved as-is (never force-opened) — the health popup is opt-in only.
 const showSicknessModal = prevState.showSicknessModal;
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
 // R3-A: `generateSpecificDisease` is an ES import.
 const eventDisease = generateSpecificDisease(choice.diseaseId, prevState);

 if (eventDisease) {
 // Check if disease already exists
 const diseaseExists = updatedDiseases.some(d => d.id === eventDisease.id);
 if (!diseaseExists) {
 updatedDiseases.push(eventDisease);
 // Do NOT auto-open the health popup — health is surfaced passively on the
 // player card. (Kept the disease addition; only the interruption is gone.)

 // Update disease history (ANTI-BLOAT: cap to the most recent 50,
 // matching applyDiseasesForWeek so the event path can't grow unbounded).
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
 ].slice(-50),
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
 return {...c, accepted: false, applied: false, progress: 0, performance: undefined, warningsReceived: 0 };
 }
 return c;
 });
 logger.info('Player fired from job:', { job: prevState.currentJob });
 }

 if (choice.special === 'add_career_warning' && prevState.currentJob) {
 // Add a formal warning to the career
 updatedCareersFromEvent = (updatedCareersFromEvent || prevState.careers || []).map(c => {
 if (c.id === prevState.currentJob && c.accepted) {
 return {...c, warningsReceived: (c.warningsReceived || 0) + 1 };
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

 // Apply hidden consequences (NEW - enhances existing system).
 // R3-A: helpers are ES imports.
 const enhancedChoice = choice as import('@/lib/events/engine').EnhancedEventChoice;

 let updatedConsequenceState: any = undefined;
 let updatedMemories: any = undefined;

 if (enhancedChoice.hiddenConsequences && enhancedChoice.hiddenConsequences.length > 0) {
 // R3-A: `applyChoiceConsequences` is an ES import.
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
 // Still record choice in history even without hidden consequences.
 // R3-A: `applyChoiceConsequences` is an ES import.
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
 // Cap memories at the WRITE site (mirrors the eventLog cap below). The
 // save-time pruner only runs periodically; without a write cap this array
 // grows one entry per memory-creating choice for the whole life, and every
 // setGameState copy walks it — the primary driver of long-session heap
 // growth. 200 matches the save-time cap in saveQueue.pruneSaveData.
 const MEMORIES_CAP = 200;
 const memoryTail = prevState.memories || [];
 updatedMemories = memoryTail.length >= MEMORIES_CAP
   ? [...memoryTail.slice(-(MEMORIES_CAP - 1)), newMemory]
   : [...memoryTail, newMemory];
 }

 // Remove event from pendingEvents
 const updatedPendingEvents = [...(prevState.pendingEvents || [])];
 updatedPendingEvents.splice(eventIndex, 1);

 // Add to event log.
 // P0-12: `week` stores the absolute counter so chronological sorting works
 // (the legacy cyclic `prevState.week` value cycled 1-4 and made the timeline
 // collapse into four buckets).
 const eventLogEntry = {
 id: eventId,
 description: event.description,
 choice: choice.text,
 // Persist the stable choice id so multi-week event chains
 // (health_scare / business_opportunity / family_crisis) can branch on
 // `e.choiceId` rather than always falling through to the "ignored" path.
 choiceId: choice.id,
 week: prevState.weeksLived || 0,
 year: prevState.date?.year || 2025,
 weeksLived: prevState.weeksLived || 0,
 category: eventCategory,
 effects: {
 money: effects.money,
 stats: effects.stats,
 },
 };

 // R2-B: cap to 500 at the WRITE site, not just at save-time. The save-time
 // pruner only fires every 2 minutes; in the meantime every setGameState copy
 // walks the full array (O(N)). Without this cap a 30-min session sees the
 // eventLog grow to 300+ entries and the per-action copy starts to dominate
 // the JS thread.
 const EVENT_LOG_CAP = 500;
 const eventLogTail = prevState.eventLog || [];
 const updatedEventLog = eventLogTail.length >= EVENT_LOG_CAP
   ? [...eventLogTail.slice(-(EVENT_LOG_CAP - 1)), eventLogEntry]
   : [...eventLogTail, eventLogEntry];

 // Handle follow-up events or event chains.
 // P0-12 / state-mutation fix: build the next pendingChainedEvents list as a
 // local variable rather than mutating `prevState.pendingChainedEvents` directly.
 // React 19 StrictMode invokes the updater twice; mutating the previous-state
 // object means the second invocation sees the first invocation's mutation and
 // chained events double up.
 let finalPendingEvents = updatedPendingEvents;
 let updatedPendingChainedEvents: typeof prevState.pendingChainedEvents | undefined = prevState.pendingChainedEvents;
 try {
 // R3-A: `checkForChainedEvent` is an ES import.
 const chainedEvent = checkForChainedEvent(eventId, choiceId, prevState.weeksLived || 0);
 if (chainedEvent) {
 const pendingChains = prevState.pendingChainedEvents || [];
 updatedPendingChainedEvents = [...pendingChains, chainedEvent];
 logger.info('Chained event queued:', { eventId: chainedEvent.eventId, triggerWeek: chainedEvent.triggerWeek });
 }
 } catch (e) {
 logger.warn('Failed to check for chained events:', { error: e });
 }

 // Chain bookkeeping (advance / complete / start) lives in the pure
 // `advanceEventChain` helper so it is unit-testable — the GL-1 off-by-one
 // survived precisely because this decision was inline in a React callback
 // that no test could drive.
 const chainUpdate = advanceEventChain(
   { activeEventChain: prevState.activeEventChain, eventChains: prevState.eventChains },
   event,
   eventId,
 );
 const updatedActiveEventChain = chainUpdate.activeEventChain;
 const updatedEventChains = chainUpdate.eventChains;

 // Apply karma change if the choice has a karma effect
 let updatedKarma = prevState.karma;
 if (effects.karma) {
 // R3-A: karma helpers are ES imports.
 updatedKarma = applyKarmaChange(
 prevState.karma || INITIAL_KARMA,
 effects.karma.dimension,
 effects.karma.amount,
 effects.karma.reason,
 prevState.weeksLived || 0,
 );
 }

 // Politics event effects: approval rating + policy influence. These were
 // previously DROPPED — the resolver only applied money/stats/relationship/pet,
 // so every political event that promised an approval or influence swing did
 // nothing. Also catch legacy events that mistakenly nested `approvalRating`
 // inside `stats` (the stats loop skips it since it isn't a GameStats key).
 let updatedPolitics: GameState['politics'] | undefined;
 const approvalDelta = (effects.approvalRating ?? 0) + ((effects.stats as Record<string, number> | undefined)?.approvalRating ?? 0);
 const influenceDelta = effects.policyInfluence ?? 0;
 if ((approvalDelta !== 0 || influenceDelta !== 0) && prevState.politics && effectsAffordable) {
 updatedPolitics = {
...prevState.politics,
 approvalRating: Math.max(0, Math.min(100, (prevState.politics.approvalRating ?? 50) + approvalDelta)),
 policyInfluence: Math.max(0, Math.min(100, (prevState.politics.policyInfluence ?? 0) + influenceDelta)),
 };
 }

 // CRITICAL: Return complete state with all properties preserved
 // Use spread operator to ensure we don't lose any properties
 const newState: GameState = {
...prevState, // Preserve ALL existing properties
 stats: updatedStats, // Update stats
 relationships: updatedRelationships, // Update relationships if changed
 pets: updatedPets, // Update pets if changed
 pendingEvents: finalPendingEvents, // Remove resolved event
 pendingChainedEvents: updatedPendingChainedEvents, // P0-12: append chained event immutably
 eventLog: updatedEventLog, // Add to log
 activeEventChain: updatedActiveEventChain, // Update chain if needed
 eventChains: updatedEventChains, // Update chain history
...(updatedConsequenceState && { consequenceState: updatedConsequenceState }), // Add consequence state if updated
...(updatedMemories && { memories: updatedMemories }), // Add memories if created
...(updatedKarma && { karma: updatedKarma }), // Update karma if changed
...(updatedPolitics && { politics: updatedPolitics }), // Approval/influence event effects
 diseases: updatedDiseases, // Update diseases if event triggered one
 showSicknessModal: showSicknessModal, // Show modal if new disease
 diseaseHistory: updatedDiseaseHistory, // Update disease history
 // Career event effects (firing, warnings)
...(updatedCurrentJob!== prevState.currentJob && { currentJob: updatedCurrentJob }),
...(updatedCareersFromEvent!== prevState.careers && { careers: updatedCareersFromEvent }),
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
 // Pre-check via the captured snapshot so we can early-return on the
 // obvious "already claimed" case without committing a render. The
 // AUTHORITATIVE check is repeated INSIDE setGameState(prev =>) below to
 // guard against same-batch double-claim — without that inner check, two
 // rapid claims in one React batch both see the pre-update snapshot and
 // BOTH apply, double-granting gold (real-money equivalent).
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
 let applied = false;
 setGameState(prevState => {
 // AUTHORITATIVE same-batch guard: if a prior claim in this batch
 // already added the id, return prev unchanged.
 if ((prevState.claimedProgressAchievements || []).includes(achievementId)) {
 return prevState;
 }
 applied = true;
 const newClaimed = [...(prevState.claimedProgressAchievements || []), achievementId];

 // Cross-life, account-permanent guard on the GEM MINT.
 // claimedProgressAchievements is per-life and is wiped by prestige
 // (createResetGameState), so on its own it lets every achievement re-mint its
 // gems each prestige cycle. prestige.claimedAchievementIds is preserved across
 // prestige, so it is the authoritative "already minted ever" set: gems are
 // granted ONLY the first time an id is claimed across all lives. The per-life
 // set is still recorded (above) so existing per-life UI behavior is unchanged.
 const priorMinted = prevState.prestige?.claimedAchievementIds || [];
 const alreadyMintedEver = priorMinted.includes(achievementId);
 const gemsToMint = alreadyMintedEver ? 0 : goldReward;
 const newGems = (prevState.stats.gems || 0) + gemsToMint;
 const newPrestige = prevState.prestige
 ? {
...prevState.prestige,
 claimedAchievementIds: alreadyMintedEver
 ? priorMinted
: [...priorMinted, achievementId],
 }
: prevState.prestige;

 // Achievements are a Legacy Pass XP source (LEGACY_PASS_XP.achievement).
 return awardLegacyPassXp({
...prevState,
 claimedProgressAchievements: newClaimed,
...(newPrestige ? { prestige: newPrestige } : {}),
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
 // Mirror the unlock into lifetimeStatistics for the
 // StatisticsApp "Achievements Unlocked" tile.
 lifetimeStatistics: prevState.lifetimeStatistics
 ? {
...prevState.lifetimeStatistics,
 totalAchievementsUnlocked: (prevState.lifetimeStatistics.totalAchievementsUnlocked ?? 0) + 1,
 }
: prevState.lifetimeStatistics,
 }, LEGACY_PASS_XP.achievement);
 });

 // If the same-batch guard rejected this claim, skip the global storage
 // write so we don't persist a global-claim record for an unapplied claim.
 if (!applied) {
 logger.warn('Achievement claim suppressed by same-batch guard:', { achievementId });
 return;
 }

 track('achievement_unlocked', { achievementId });

 // Save global claim to AsyncStorage if it's a gold group achievement
 if (isGlobalClaim) {
 try {
 const globalClaimed = await AsyncStorage.getItem('globalClaimedAchievements');
 let globalClaimedList: string[] = [];

 if (globalClaimed) {
 try {
 const parsed = JSON.parse(globalClaimed);
 // CRITICAL: Validate that parsed result is an array
 globalClaimedList = Array.isArray(parsed) ? parsed: [];
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
 showError('Claim Error', error instanceof Error ? error.message: 'Failed to claim achievement');
 }
 }, [setGameState, showError]);

 // Core Stats Management
 const updateStats = useCallback((newStats: Partial<GameStats>, updateDailySummary = true) => {
 setGameState(prevState => {
 const updatedStats = {...prevState.stats };
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

 // Update daily summary if needed.
 // R4-H: clamp accumulated statsChange values so they don't grow unbounded
 // between dismissals. Stats themselves are already clamped to [0,100], so a
 // delta beyond ±1000 represents many weeks of accumulation without
 // dismissal — clamp it so the summary display stays sane.
 let dailySummary = prevState.dailySummary;
 if (updateDailySummary) {
 const existingStatsChange = prevState.dailySummary?.statsChange || {};
 const mergedStatsChange = {...existingStatsChange };
 const STATS_DELTA_CAP = 1000;

 Object.entries(actualChanges).forEach(([key, value]) => {
 const k = key as keyof GameStats;
 const next = (mergedStatsChange[k] || 0) + (value || 0);
 mergedStatsChange[k] = Math.max(-STATS_DELTA_CAP, Math.min(STATS_DELTA_CAP, next));
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
 // A-4 parity with loadGame: run version migrations BEFORE repair. A
 // cloud save from an OLDER app version (synced from a device that
 // hasn't updated) must be migrated, not just shape-repaired, or
 // current code crashes on the stale schema. Refuse a FUTURE-version save.
 let remote = conflict.remoteState;
 try {
 const { runMigrations } = await import('@/utils/saveMigrations');
 const migrationResult = runMigrations(remote);
 if (migrationResult.versionFromFuture) {
 logger.error('[CloudSync] Cloud save is from a newer app version — refusing to apply.');
 return;
 }
 remote = migrationResult.state;
 } catch (migErr) {
 logger.error('[CloudSync] Migration of cloud state failed (continuing with repair):', migErr);
 }
 // Validate and repair remote state before applying
 const repaired = repairGameState(remote);
 if (repaired.repaired) {
 logger.warn('[CloudSync] Remote state required repair:', repaired.repairs);
 }
 const validation = validateGameState(remote, true);
 if (!validation.valid) {
 logger.error('[CloudSync] Remote state failed validation after repair:', validation.errors);
 return;
 }
 setGameState(remote);
 logger.info('[CloudSync] User chose cloud version — migrated + state replaced (validated)');
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

 // P1-13: skip the periodic save if the save/load mutex is held — typically
 // means a `loadGame` is mid-flight. Without this guard, the autosave would
 // capture `gameStateRef.current` while it was still the pre-load value and
 // persist the wrong character into the freshly-loaded slot.
 if (currentState && saveFn && !isSavingRef.current && !saveLoadMutex.isHeld()) {
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
 } else if (currentState && saveFn && saveLoadMutex.isHeld()) {
 logger.debug('Periodic auto-save skipped: save/load mutex busy');
 }
 }, AUTO_SAVE_INTERVAL_MS);

 // CRITICAL: Periodic state health check to detect corruption during long sessions.
 // R2-F: autoFix=false here too — repair runs explicitly in the failure branch.
 // In production this should rarely trip; we don't want it deep-cloning state
 // every 10 minutes "just in case".
 const healthCheckIntervalId = setInterval(() => {
 const currentState = gameStateRef.current;
 if (currentState) {
 const validation = validateGameState(currentState, false);
 if (!validation.valid) {
 logger.error('[HEALTH CHECK] State corruption detected during gameplay:', validation.errors);
 // Attempt repair
 const repairResult = repairGameState(currentState);
 if (repairResult.repaired) {
 logger.warn('[HEALTH CHECK] Repaired corrupted state:', repairResult.repairs);
 // Update state with repaired version — spread to create new reference so React detects the change
 setGameState(prev => {
 const repaired = repairGameState(prev);
 return repaired.repaired ? {...prev }: prev;
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
 const loadMutexToken = await saveLoadMutex.acquire('load');
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
 const loadResult = await doubleBufferLoad(`save_slot_${slot}`, undefined, { allowLegacy });

 if (!loadResult.data) {
 logger.warn('No save data found for slot:', { slot });
 return null;
 }

 if (loadResult.migrated) {
 logger.info(`[LOAD_GAME] Migrated legacy save to double-buffer (source: ${loadResult.source})`);
 }
 if (loadResult.source!== 'none') {
 logger.debug(`[LOAD_GAME] Loaded from double-buffer source: ${loadResult.source}`);
 }

 const savedData = loadResult.data;

 // CRITICAL: Parse with error handling - corrupted JSON can crash the app
 // ANTI-EXPLOIT: Decode and verify canonical save envelope before parsing state
 let parsed: any;
 try {
 const decoded = decodePersistedSaveEnvelope(savedData, { allowLegacy });
 if (!decoded.valid || typeof decoded.data!== 'string') {
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
 if (!decodedBackup.valid || typeof decodedBackup.data!== 'string') {
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
 const { runMigrations, SaveFromFutureError } = await import('@/utils/saveMigrations');
 const migrationResult = runMigrations(parsed);
 if (migrationResult.migrationsApplied.length > 0) {
 logger.info('[LOAD_GAME] Applied save migrations:', migrationResult.migrationsApplied);
 }
 if (migrationResult.errors.length > 0) {
 logger.error('[LOAD_GAME] Migration errors:', migrationResult.errors);
 }
 if (migrationResult.versionFromFuture) {
 // P1-7: the save is from a NEWER app version. Loading it would merge a
 // downgraded shape over initialGameState, and the next autosave would then
 // overwrite the newer save permanently. Refuse to load so the save is
 // preserved intact until the user updates the app.
 logger.error('[LOAD_GAME] Save is from a newer app version — refusing to load to avoid overwriting it.');
 // Throw rather than return null. A bare null is the SAME value an empty
 // slot returns, so the menu told a player with a perfectly good newer save
 // "No save data found — start a new game" (2026-07-29 audit MR-4). The
 // refusal itself is correct; only the reporting was not.
 throw new SaveFromFutureError();
 }
 // MR-2: honour runMigrations' RETURN contract. Every registered migration
 // happens to mutate in place today, so `migrationResult.state === parsed` —
 // but the contract is the return value, and the two OTHER call sites already
 // read it. A future migration written in the pure style would have had its
 // work silently dropped on the primary load path alone.
 if (migrationResult.state && typeof migrationResult.state === 'object') {
 parsed = migrationResult.state;
 }
 } catch (migrationError) {
 if (isSaveFromFutureError(migrationError)) throw migrationError;
 logger.error('[LOAD_GAME] Migration system failed (non-fatal, continuing with repair):', migrationError);
 }

 // CRITICAL: Repair and validate state before setting it
 // This prevents corrupted state from being set, even temporarily
 const repairResult = repairGameState(parsed);
 if (repairResult.repaired) {
 logger.warn('Repaired corrupted state during load:', repairResult.repairs);
 }

 // Validate AND auto-fix the repaired state. P0-6: passing autoFix=true runs
 // autoFixStats, which now also resets non-finite (NaN/Infinity) core stats —
 // otherwise such a save loads as "valid" but is rejected at entry (unplayable).
 const validation = validateGameState(parsed, true);
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
 filtered[key] = (parsedValue!== null && parsedValue!== undefined) ? parsedValue: defaults[key];
 }
 return filtered as T;
 };

 // CRITICAL: Extract children from relationships first (before merging)
 // This ensures children created during onboarding are preserved
 const parsedRelationships = Array.isArray(parsed.relationships) ? parsed.relationships: [];
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
 const saveTxs = Array.isArray(parsed.processedIAPTransactions) ? parsed.processedIAPTransactions: [];
 if (saveTxs.length > 0) {
 const raw = await AsyncStorage.getItem('iap_processed_transactions');
 let globalTxs: string[] = [];
 if (raw) {
 try {
 const parsed2 = JSON.parse(raw);
 globalTxs = Array.isArray(parsed2) ? parsed2: [];
 } catch { /* corrupted, reset */ }
 }
 const merged = [...new Set([...globalTxs,...saveTxs])].slice(-2000);
 if (merged.length > globalTxs.length) {
 await AsyncStorage.setItem('iap_processed_transactions', JSON.stringify(merged));
 logger.info(`[LOAD_GAME] Merged ${merged.length - globalTxs.length} IAP transactions from save into global ledger`);
 }
 }
 } catch (iapMergeError) {
 logger.warn('[LOAD_GAME] Failed to merge IAP transactions (non-critical):', { error: iapMergeError });
 }

 // CRITICAL: Merge family - ensure children from both family.children and relationships are preserved
 let mergedFamily = parsed.family ? {...parsed.family }: {...initialGameState.family };
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
 stats: parsed.stats ? filterNullValues(parsed.stats, initialGameState.stats): initialGameState.stats,
 date: parsed.date ? filterNullValues(parsed.date, initialGameState.date): initialGameState.date,
 settings: parsed.settings ? filterNullValues(parsed.settings, initialGameState.settings): initialGameState.settings,
 // CRITICAL FIX: Ensure userProfile is properly merged and null values are filtered
 userProfile: parsed.userProfile ? filterNullValues(parsed.userProfile, initialGameState.userProfile): initialGameState.userProfile,
 };

 // CRITICAL: Override family and relationships AFTER all spreads to ensure our synced arrays are used
 safeState.family = mergedFamily;
 safeState.relationships = parsedRelationships.length > 0 ? parsedRelationships: (initialGameState.relationships || []);

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
 safeState.userProfile = {...initialGameState.userProfile };
 } else {
 // Ensure firstName and lastName exist and are non-empty
 if (!safeState.userProfile.firstName || safeState.userProfile.firstName.trim() === '') {
 // Try to extract from name if available
 if (safeState.userProfile.name && safeState.userProfile.name.trim()!== '') {
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
 // R3-A: `restoreStockPrices` is an ES import.
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
 if (safeState.settings?.hapticFeedback!== undefined) {
 const { setHapticsEnabled } = require('@/utils/haptics');
 setHapticsEnabled(safeState.settings.hapticFeedback);
 }

 // DATA-LOSS FIX: sync the in-memory active slot to the slot we just loaded.
 // Without this, `currentSlot` stayed stuck at its initial value (1) and every
 // subsequent saveGame/autosave/background-save wrote into slot 1, silently
 // overwriting it while the player thought they were on slot 2 or 3.
 // setCurrentSlot (setCurrentSlotSafe) also persists both `currentSlot` and
 // `lastSlot`; the direct writes below are kept for legacy readers that expect
 // the markers set synchronously on load.
 setCurrentSlot(slot);

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
 saveLoadMutex.release(loadMutexToken);
 }
 }, [setIsLoading, setLoadingMessage, showError, setGameState, setCurrentSlot]);

 // Relationship functions for Contacts app.
 //
 // A POSITIVE change is scaled by who the player has become: the charisma /
 // socialMaster life skills they bought, and their karma standing. Both
 // multipliers existed and were computed correctly, but their only consumer was
 // an unreachable module — so a player could buy the charisma node, watch the
 // description promise faster bonds, and get exactly nothing (2026-07-28 audit
 // PERF-5). This is the single relationship-gain path the Contacts app uses, so
 // wiring it here is what makes those purchases real.
 //
 // Losses are NEVER scaled: skills and good standing make you better at building
 // relationships, they do not soften a betrayal. `applyRelationshipGain` already
 // passes negatives through untouched; the karma multiplier is gated to match,
 // so a low-karma player is not punished twice on the way down.
 const updateRelationship = useCallback((relationshipId: string, change: number) => {
 setGameState(prev => {
 const scaled = change > 0
? applyRelationshipGain(prev, Math.round(change * getKarmaModifiers(prev.karma || INITIAL_KARMA).npcTrustMultiplier))
: change;
 const relationships = (prev.relationships || []).map(r => {
 if (r.id === relationshipId) {
 return {
...r,
 relationshipScore: clampRelationshipScore(r.relationshipScore + scaled),
 };
 }
 return r;
 });

 return {...prev, relationships };
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

 return {...prev, relationships };
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
 relationships: (prev.relationships || []).filter(r => r.id!== partnerId),
 // Clear the backing Spark match's `promoted` flag so the ex stops rendering
 // as your partner in Spark and can be re-dated later.
 sparkApp: clearPromotedSparkMatch(prev.sparkApp, partnerId),
 }));

 updateStats({ happiness: -20 });

 logger.info(`Broke up with partner: ${partner.name}`);
 return {
 success: true,
 message: `You broke up with ${partner.name}.`
 };
 }, [setGameState, updateStats]);

 // C-7: Use gameStateRef to prevent stale closure
 const proposeToPartner = useCallback((partnerId: string): { success: boolean; message: string } => {
 const currentState = gameStateRef.current;
 if (!currentState) return { success: false, message: 'Game not ready.' };

 const partner = currentState.relationships?.find(r => r.id === partnerId && r.type === 'partner');
 if (!partner) {
 logger.error('Partner not found for proposal:', partnerId);
 return { success: false, message: 'Partner not found.' };
 }

 if (partner.relationshipScore < 80) {
 return { success: false, message: 'Your relationship needs to be stronger before proposing.' };
 }

 // ANTI-BIGAMY: can't propose while committed (engaged / married / living
 // with) to someone else.
 const committedElsewhere = findCommittedPartner(currentState.relationships, partnerId);
 if (committedElsewhere) {
 return { success: false, message: `You are already with ${committedElsewhere.name}. You can't propose to ${partner.name}.` };
 }

 if (currentState.stats.money < 5000) {
 return { success: false, message: 'You need at least $5,000 for a proper proposal.' };
 }

 // P1-1: fold engagement + the $5,000 charge + the happiness bump into ONE atomic
 // updater. Previously engagement was set in one setGameState and the charge ran in
 // a separate hook updateMoney that could be rejected — engaging the player for free
 // — with no in-updater re-check of partner type / already-engaged.
 setGameState(prev => {
 const p = (prev.relationships || []).find(r => r.id === partnerId && r.type === 'partner');
 if (!p || p.engagementWeek != null) return prev; // partner gone or already engaged
 if (findCommittedPartner(prev.relationships, partnerId)) return prev; // ANTI-BIGAMY recheck (same-batch double-propose)
 const spend = applyMoneyDelta(prev, -5000, `Engagement ring for ${p.name}`);
 if (!spend) return prev; // unaffordable → no free engagement
 return {
...prev,
...spend,
 stats: { ...spend.stats, happiness: Math.max(0, Math.min(100, (prev.stats?.happiness ?? 0) + 15)) },
 relationships: (prev.relationships || []).map(r =>
 r.id === partnerId ? {...r, engagementWeek: prev.weeksLived || 0 }: r
 ),
 };
 });

 logger.info(`Proposed to partner: ${partner.name}`);
 return {
 success: true,
 message: ` You proposed to ${partner.name}! She's said YES!`
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

 // ANTI-BIGAMY: can't move in while committed (living with / engaged /
 // married) to someone else.
 const committedElsewhere = findCommittedPartner(currentState.relationships, partnerId);
 if (committedElsewhere) {
 return { success: false, message: `You are already with ${committedElsewhere.name}. You can't move in with ${partner.name}.` };
 }

 // Check if player owns (and has moved into) or rents any real estate property
 const hasProperty = (currentState.realEstate || []).some(property => {
 const status = 'status' in property ? property.status: undefined;

 // Check if player owns the property and has moved in
 // Status must be 'owner' (not 'rented' which means they rented it out)
 const ownsAndLivingIn = property.owned && status === 'owner';

 // Check if player rents the property (status is 'rented' and owned is false)
 // This means player is renting it, not that they rented it out to someone else
 const rentsProperty = status === 'rented' &&!property.owned;

 return ownsAndLivingIn || rentsProperty;
 });

 if (!hasProperty) {
 return {
 success: false,
 message: 'You need to own and move into a property, or rent a property before you can move in together. Purchase or rent one from the Real Estate app!'
 };
 }

 setGameState(prev => {
 // ANTI-BIGAMY recheck inside the updater — a same-batch double-tap must
 // not end up cohabiting with two people.
 if (findCommittedPartner(prev.relationships, partnerId)) return prev;
 return {
...prev,
 relationships: (prev.relationships || []).map(r =>
 r.id === partnerId ? {...r, livingTogether: true }: r
 ),
 };
 });

 updateStats({ happiness: 10 });

 logger.info(`Moved in with partner: ${partner.name}`);
 return {
 success: true,
 message: `You and ${partner.name} are now living together!`
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
 // executePrestige returns the ORIGINAL state when the attempt is rejected
 // (e.g. net worth below threshold). Only award the marquee Legacy Pass XP
 // (LEGACY_PASS_XP.prestige) when the prestige actually happened.
 const prestigedState = executePrestigeFunction(currentState, chosenPath, childId);
 if (prestigedState === currentState) {
 logger.warn('[executePrestige] Prestige rejected; skipping Legacy Pass XP grant');
 return;
 }
 const newGameState = awardLegacyPassXp(prestigedState, LEGACY_PASS_XP.prestige);
 setGameState(newGameState);
 logger.info(`[executePrestige] Prestige executed: path=${chosenPath}, childId=${childId || 'none'}`);

 // Surface any prestige achievements this prestige awarded. The award itself
 // already happened inside executePrestige (points + claimed store); here we
 // just diff the claimed store to announce them via the same friendly,
 // auto-dismissing info banner gameplay events use.
 const beforePrestigeAchievements = new Set(currentState.prestige?.claimedPrestigeAchievements ?? []);
 const newlyAwardedPrestigeAchievements = (newGameState.prestige?.claimedPrestigeAchievements ?? [])
 .filter(id => !beforePrestigeAchievements.has(id))
 .map(id => PRESTIGE_ACHIEVEMENTS.find(a => a.id === id))
 .filter((a): a is PrestigeAchievement => Boolean(a));
 if (newlyAwardedPrestigeAchievements.length > 0) {
 // Mirror the weekly-notify pattern: ≤2 show individually, more collapse into
 // one summary banner so a veteran's one-shot retroactive catch-up (many at
 // once) can't flood the screen.
 if (newlyAwardedPrestigeAchievements.length <= 2) {
 for (const a of newlyAwardedPrestigeAchievements) {
 showInfoBanner(
 `prestige-achievement-${a.id}`,
 `${a.name} — +${(a.reward?.prestigePoints ?? 0).toLocaleString()} prestige points`,
 'Prestige Achievement',
 );
 }
 } else {
 const totalPoints = newlyAwardedPrestigeAchievements.reduce(
 (sum, a) => sum + (a.reward?.prestigePoints ?? 0),
 0,
 );
 const names = newlyAwardedPrestigeAchievements.slice(0, 3).map(a => a.name).join(', ');
 const more = newlyAwardedPrestigeAchievements.length - 3;
 showInfoBanner(
 'prestige-achievements-summary',
 `${names}${more > 0 ? ` +${more} more` : ''}\n+${totalPoints.toLocaleString()} prestige points`,
 `${newlyAwardedPrestigeAchievements.length} Prestige Achievements`,
 );
 }
 }

 // Save after prestige — same rule: an unknown slot is not slot 1.
 if (!isWritableSlot(currentSlot)) {
 logger.error('[PRESTIGE] Refusing to save: no valid slot is loaded', { currentSlot });
 throw new Error('Cannot save your prestige: no save slot is loaded.');
 }
 const slotToUse = currentSlot;

 // Snapshot the pre-prestige life BEFORE the rebuilt state is written.
 // Prestige is the single most destructive thing a player can do on purpose —
 // it rebuilds the whole state — and it was the one destructive path with no
 // backup call at all, so a mis-tapped prestige was unrecoverable. Awaited so
 // the copy exists before the overwrite; 'before_prestige' is rotation-exempt,
 // so the next few autosaves cannot evict it. Non-blocking on failure: a
 // backup problem must not cost the player the prestige they earned.
 // 2026-07-29 audit BRC-4.
 // `executePrestige` is synchronous, so this is a promise the save below
 // CHAINS onto rather than a fire-and-forget — otherwise the queued write
 // could drain first and the snapshot would copy the post-prestige state.
 const prePrestigeSnapshot = import('@/utils/saveBackup')
 .then((m) => m.snapshotOutgoingSave(slotToUse, 'before_prestige'))
 .catch((snapshotError) => {
 logger.warn('[PRESTIGE] Pre-prestige snapshot failed (non-critical)', { error: snapshotError });
 return null;
 });

 // P0-11: never downgrade an already-migrated version (see saveGame for rationale).
 const prestigeStateVersion = (newGameState as { version?: unknown }).version;
 const inMemoryPrestigeVersion = typeof prestigeStateVersion === 'number' ? prestigeStateVersion : 0;
 const versionToWrite = inMemoryPrestigeVersion >= STATE_VERSION ? inMemoryPrestigeVersion : STATE_VERSION;
 const gameData = {
...newGameState,
 lastSaved: new Date().toISOString(),
 updatedAt: Date.now(),
 version: versionToWrite,
 };
 // Ordered after the snapshot so the backup captures the life being replaced.
 prePrestigeSnapshot
 .then(() => queueSave(slotToUse, gameData))
 .catch(err => {
 logger.error('[executePrestige] Failed to queue save:', err);
 });
 } catch (error) {
 logger.error('[executePrestige] Error:', error);
 showError('Prestige Error', 'Failed to execute prestige. Please try again.');
 }
 }, [setGameState, currentSlot, showError, showInfoBanner]);

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
