import React, { createContext, useContext, useCallback, ReactNode, useRef, useMemo } from 'react';
import * as ItemActions from './actions/ItemActions';
import { updateMoney as updateMoneyModule } from './actions/MoneyActions';
import { logger } from '@/utils/logger';
import { useSetGameState, useGameStateGetter } from './useGameSelector';
import { useMoneyActions } from './MoneyActionsContext';
import { useUIUX } from '@/contexts/UIUXContext';
import { HackResult } from './types';
import type { GameState } from './types';
import { clampStatByKey } from '@/utils/statUtils';
import { trackMoneySpent, getDefaultStatistics } from '@/lib/statistics/statisticsTracker';
import { applyChronicCare, DOCTOR_MANAGEMENT_WEEKS, HOSPITAL_MANAGEMENT_WEEKS } from '@/lib/diseases/chronicCare';
import { haptic } from '@/utils/haptics';
import { policyAdjustedActivityPrice } from '@/lib/politics/healthcarePerks';
import { satietyHint } from '@/lib/economy/foodSatiety';
import { resolveFoodPurchase } from '@/lib/economy/foodPurchase';
import { getCommitmentModifiers, recordCommitmentActivity } from '@/lib/commitments/commitmentSystem';

/**
 * What a food purchase actually did - the market toast reads THIS rather than
 * the catalogue values, so the satiety curve (v48) can never make the toast
 * advertise a restore the charge did not apply.
 */
export interface FoodPurchaseResult {
  success: boolean;
  applied?: { health: number; energy: number; happiness: number };
  /** Player-facing satiety state after this meal, or null at full strength. */
  hint?: string | null;
}

interface ItemActionsContextType {
  // Items & Purchases
  buyItem: (itemId: string) => void;
  sellItem: (itemId: string) => void;
  buyDarkWebItem: (itemId: string) => void;
  buyHack: (hackId: string) => void;
  performHack: (hackId: string) => HackResult;
  buyFood: (foodId: string) => FoodPurchaseResult;
  performHealthActivity: (activityId: string) => { message: string } | void;
  dismissSicknessModal: () => void;
  dismissCureSuccessModal: () => void;
  dismissStatWarning: () => void;
  dismissWelcomePopup: () => void;
  toggleDietPlan: (planId: string) => void;

  // Hobbies removed - no longer available
}

const ItemActionsContext = createContext<ItemActionsContextType | undefined>(undefined);

export function useItemActions() {
  const context = useContext(ItemActionsContext);
  if (!context) {
    throw new Error('useItemActions must be used within ItemActionsProvider');
  }
  return context;
}

interface ItemActionsProviderProps {
  children: ReactNode;
}

export function ItemActionsProvider({ children }: ItemActionsProviderProps) {
  const setGameState = useSetGameState();
  const { updateMoney } = useMoneyActions();
  const { showError } = useUIUX();
  // Track activities currently being processed to prevent double-clicks
  const processingActivities = useRef<Set<string>>(new Set());

  // M4: read the LIVE state on demand instead of mirroring it into a ref.
  // The old idiom (`useRef(gameState)` + a post-commit `useEffect`) forced this
  // provider to subscribe to the ENTIRE GameState purely to keep the ref fresh,
  // and still handed callbacks a snapshot that was one commit stale - the
  // staleness the gate->grant class (CLAUDE.md 4.4) exploits. `useGameStateGetter`
  // returns a stable getter over the same store, so callbacks stay stable, the
  // memoized context value keeps its identity, and the provider no longer
  // re-renders on every mutation. Reads are still OUTSIDE the updater, so the
  // authoritative re-check inside `setGameState(prev => ...)` stays mandatory.
  const getGameState = useGameStateGetter();

  // Items & Purchases Actions
  const buyItem = useCallback((itemId: string) => {
    const state = getGameState();
    if (!state) return;

    const result = ItemActions.buyItem(state, setGameState, itemId, { updateMoney: updateMoneyModule });
    if (result?.success) {
      haptic.medium(); // Item purchased
    } else {
      showError('Purchase Failed', result?.message || 'Could not purchase item');
    }
  }, [setGameState, updateMoney, showError]);

  const sellItem = useCallback((itemId: string) => {
    const state = getGameState();
    if (!state) return;

    const result = ItemActions.sellItem(state, setGameState, itemId, { updateMoney: updateMoneyModule });
    if (!result?.success) {
      showError('Sale Failed', result?.message || 'Could not sell item');
    }
  }, [setGameState, updateMoney, showError]);

  // Onion (dark-web) actions - were all stubs that logged and did nothing,
  // so the entire Onion tab was non-functional: buying items, buying
  // hacks, and performing hacks all silently no-op'd. Wire them through
  // the canonical state (cryptos[btc].owned for BTC, hacks[i].purchased
  // for ownership, jailWeeks for caught-while-hacking penalties).

  const buyDarkWebItem = useCallback((itemId: string) => {
    const state = getGameState();
    if (!state) return;

    const item = state.darkWebItems?.find(i => i.id === itemId);
    if (!item) {
      logger.error('Dark web item not found:', itemId);
      return;
    }
    if (item.owned) {
      showError('Already Owned', `You already own ${item.name}.`);
      return;
    }
    const btcOwned = state.cryptos?.find(c => c.id === 'btc')?.owned || 0;
    if (btcOwned < item.costBtc) {
      showError('Insufficient BTC', `You need ${item.costBtc} BTC to buy ${item.name}.`);
      return;
    }

    setGameState(prev => {
      if (prev.showDeathPopup) return prev; // E-2: no transactions once the player is dead.
      /**
       * Re-check affordability AND ownership against `prev`, not the outer
       * snapshot (CLAUDE.md §4.4).
       *
       * The outer guards above read `getGameState()`, which is the classic
       * gate-outside / grant-inside shape: two taps in one React batch both pass
       * the outer check, and the second charges BTC for an item already owned.
       * That never bit before because this function had no caller - the Gear tab
       * is the first, so the guard has to be real now.
       */
      const owned = (prev.darkWebItems || []).find(i => i.id === itemId);
      if (!owned || owned.owned) return prev;
      const btc = prev.cryptos?.find(c => c.id === 'btc')?.owned ?? 0;
      if (!isFinite(btc) || btc < item.costBtc) return prev;
      return {
        ...prev,
        cryptos: (prev.cryptos || []).map(c =>
          c.id === 'btc' ? { ...c, owned: c.owned - item.costBtc } : c
        ),
        darkWebItems: (prev.darkWebItems || []).map(i =>
          i.id === itemId ? { ...i, owned: true } : i
        ),
      };
    });
    logger.info('Dark web item purchased:', { itemId, name: item.name, costBtc: item.costBtc });
  }, [setGameState, showError]);

  const buyHack = useCallback((hackId: string) => {
    const state = getGameState();
    if (!state) return;

    const hack = state.hacks?.find(h => h.id === hackId);
    if (!hack) {
      logger.error('Hack not found:', hackId);
      return;
    }
    if (hack.purchased) {
      showError('Already Owned', `You already own ${hack.name}.`);
      return;
    }
    const btcOwned = state.cryptos?.find(c => c.id === 'btc')?.owned || 0;
    if (btcOwned < hack.costBtc) {
      showError('Insufficient BTC', `You need ${hack.costBtc} BTC to buy ${hack.name}.`);
      return;
    }

    setGameState(prev => ({
      ...prev,
      cryptos: (prev.cryptos || []).map(c =>
        c.id === 'btc' ? { ...c, owned: c.owned - hack.costBtc } : c
      ),
      hacks: (prev.hacks || []).map(h =>
        h.id === hackId ? { ...h, purchased: true } : h
      ),
    }));
    logger.info('Hack purchased:', { hackId, name: hack.name, costBtc: hack.costBtc });
  }, [setGameState, showError]);

  const performHack = useCallback((hackId: string): HackResult => {
    const state = getGameState();
    const empty: HackResult = { success: false, caught: false, reward: 0, btcReward: 0, risk: 0 };
    if (!state) return empty;

    const hack = state.hacks?.find(h => h.id === hackId);
    if (!hack || !hack.purchased) {
      logger.error('Hack not available:', { hackId, found: !!hack, purchased: hack?.purchased });
      return empty;
    }
    // Messaging gate, read from the committed snapshot. `getGameState()` returns
    // the last COMMITTED state, so inside a single React batch it is still the
    // PRE-batch state and two taps read identical energy. The authoritative
    // check is `canRunHack(prev)` inside each updater below.
    if ((state.stats.energy ?? 0) < hack.energyCost) {
      showError('Too Tired', `You need ${hack.energyCost} energy to run ${hack.name}.`);
      return empty;
    }

    /**
     * Can `prev` actually pay for this run? Checked against `prev`, never a ref.
     *
     * Without this the hack MINTED MONEY. Energy is written with
     * `Math.max(0, …)`, so a second tap in the same batch was charged nothing
     * and still paid out the full cash reward and the BTC - repeatable at zero
     * energy for as long as the taps landed in one batch. Rejecting leaves the
     * outer return value optimistic for that second tap, which is the same
     * trade the quick actions in TopStatsBar make and document: a toast for
     * something that correctly changed nothing beats a grant that should never
     * have happened.
     */
    const canRunHack = (prev: GameState) =>
      (prev.stats?.energy ?? 0) >= hack.energyCost
      && !!prev.hacks?.find(h => h.id === hackId)?.purchased;

    const ownedItems = (state.darkWebItems || []).filter(i => i.owned);
    const riskReduction = ownedItems.reduce((sum, i) => sum + (i.riskReduction || 0), 0);
    const rewardBonus = ownedItems.reduce((sum, i) => sum + (i.rewardBonus || 0), 0);
    const effectiveRisk = Math.max(0, hack.risk - riskReduction);

    const caught = Math.random() < effectiveRisk;

    if (caught) {
      setGameState(prev => {
        if (!canRunHack(prev)) return prev;
        return {
          ...prev,
          stats: { ...prev.stats, energy: Math.max(0, (prev.stats.energy ?? 0) - hack.energyCost) },
          jailWeeks: Math.min(52, (prev.jailWeeks ?? 0) + 4),
        };
      });
      logger.warn('Hack caught:', { hackId, risk: effectiveRisk });
      return { success: false, caught: true, reward: 0, btcReward: 0, risk: effectiveRisk, jailed: true };
    }

    // Reward: 80% cash, 20% BTC (deterministic split - rewardBonus adds to cash).
    const cashReward = Math.round(hack.reward * (1 + rewardBonus));
    const btcPrice = state.cryptos?.find(c => c.id === 'btc')?.price || 50000;
    const btcReward = btcPrice > 0 ? (hack.reward * 0.2) / btcPrice : 0;

    setGameState(prev => {
      if (!canRunHack(prev)) return prev;
      return {
        ...prev,
        stats: {
          ...prev.stats,
          money: (prev.stats.money ?? 0) + cashReward,
          energy: Math.max(0, (prev.stats.energy ?? 0) - hack.energyCost),
        },
        cryptos: (prev.cryptos || []).map(c =>
          c.id === 'btc' ? { ...c, owned: c.owned + btcReward } : c
        ),
      };
    });
    logger.info('Hack successful:', { hackId, cashReward, btcReward, risk: effectiveRisk });
    return { success: true, caught: false, reward: cashReward, btcReward, risk: effectiveRisk };
  }, [setGameState, showError]);

  /**
   * Buy a meal. F5 (inflated price at label, gate AND charge), SATIETY (v48 -
   * meals 1-3 full strength, 4-6 half, 7+ quarter, closing the uncapped
   * ~$1.60/point money->energy conversion) and the §4.4 atomicity all live in
   * ONE pure resolution, `resolveFoodPurchase` (lib/economy/foodPurchase.ts),
   * called on the snapshot for the preview the toast reports and again inside
   * the updater for the state that commits - the C-9 SOUND shape (the
   * `purchaseLifeSkill` exemplar), so no cross-updater capture exists and a
   * same-batch double tap is simply two meals, each gated and scaled against
   * the state it actually lands on.
   */
  const buyFood = useCallback((foodId: string): FoodPurchaseResult => {
    const state = getGameState();
    if (!state) return { success: false };

    const preview = resolveFoodPurchase(state, foodId);
    if (!preview.ok) {
      logger.warn('Food purchase refused:', { foodId, reason: preview.reason });
      return { success: false };
    }

    setGameState(prev => resolveFoodPurchase(prev, foodId).next);

    logger.info('Food purchase completed:', {
      foodId,
      price: preview.price,
      applied: preview.applied,
      purchasesThisWeek: preview.purchasesAfter,
    });
    return { success: true, applied: preview.applied, hint: satietyHint(preview.purchasesAfter) };
  }, [setGameState, getGameState]);

  const performHealthActivity = useCallback((activityId: string) => {
    const state = getGameState();
    if (!state) return;

    // Prevent double-clicks: if activity is already being processed, ignore
    if (processingActivities.current.has(activityId)) {
      logger.warn('Health activity already being processed:', { activityId });
      return { message: 'Activity is already in progress...' };
    }

    // Mark as processing immediately to prevent concurrent executions
    processingActivities.current.add(activityId);

    // Use functional update to check costs and apply effects atomically
    let result: { message: string } | undefined;

    // PRE-ROLLS: Extract random rolls outside updater for React StrictMode safety.
    // Pre-generate enough cure rolls for up to 10 diseases.
    const curePreRolls = Array.from({ length: 10 }, () => Math.random());

    setGameState(prevState => {
      const activity = prevState.healthActivities?.find(a => a.id === activityId);
      if (!activity) {
        processingActivities.current.delete(activityId);
        return prevState;
      }

      // Activities that count as a gym visit and refresh the gym-visit timer
      // (lastGymVisitWeek). The weekly tick reads that timer to scale fitness
      // decay, so performing one is worthwhile purely to reset the timer even
      // when its stat gains are fully clamped. Kept in sync with the reset below.
      const FITNESS_INCREASING_ACTIVITIES = ['walk', 'yoga', 'massage'];
      const resetsGymTimer = FITNESS_INCREASING_ACTIVITIES.includes(activityId) || !!activity.healthGain;

      // Zero-gain guard: for pure wellness activities (no disease-cure / vaccine
      // payoff), if every stat gain would clamp to zero the player gains nothing -
      // so don't debit money or energy. Medical activities (doctor/hospital/
      // experimental/vaccines) keep their value at max stats and are exempt.
      // Exception: a timer-resetting activity is still worth doing when the
      // gym-visit timer is stale (lastGymVisitWeek is behind the current week),
      // because it staves off accelerated fitness decay - so allow it then. Only
      // refuse when nothing at all would change: both gains clamp to zero AND the
      // timer is already current for this week.
      const MEDICAL_ACTIVITY_IDS = ['doctor', 'hospital', 'experimental', 'flu_shot', 'pneumonia_vaccine'];
      if (!MEDICAL_ACTIVITY_IDS.includes(activityId)) {
        // Normalize NaN/undefined stats to 0 before computing deltas: `NaN <= 0`
        // is false, so a corrupted stat would otherwise make the guard's answer
        // meaningless (and a 0 baseline yields positive deltas → the activity is
        // allowed to run and write back clamped, healed values).
        const hap = Number.isFinite(prevState.stats.happiness) ? prevState.stats.happiness : 0;
        const happinessDelta = clampStatByKey('happiness', hap + (activity.happinessGain || 0)) - hap;
        let healthDelta = 0;
        if (activity.healthGain) {
          const hp = Number.isFinite(prevState.stats.health) ? prevState.stats.health : 0;
          healthDelta = clampStatByKey('health', hp + activity.healthGain) - hp;
        }
        let fitnessDelta = 0;
        if (activity.fitnessGain) {
          const ft = Number.isFinite(prevState.stats.fitness) ? prevState.stats.fitness : 0;
          fitnessDelta = clampStatByKey('fitness', ft + activity.fitnessGain) - ft;
        }
        const gymTimerStale = (prevState.lastGymVisitWeek || 0) !== (prevState.weeksLived || 0);
        const wouldRefreshStaleTimer = resetsGymTimer && gymTimerStale;
        if (happinessDelta <= 0 && healthDelta <= 0 && fitnessDelta <= 0 && !wouldRefreshStaleTimer) {
          processingActivities.current.delete(activityId);
          result = { message: `You're already at peak wellness - ${activity.name} wouldn't change anything right now.` };
          return prevState;
        }
      }

      // GL-3: medical activities are discounted by enacted healthcare policy.
      // Computed from `prevState`, the same snapshot the affordability check
      // and the debit below both read, so the two can never disagree - and
      // `policyAdjustedActivityPrice` is the same function `health.tsx` uses
      // for its lock label, so the screen quotes what is actually charged.
      const chargedPrice = policyAdjustedActivityPrice(prevState, activityId, activity.price);

      // Check costs with latest state
      if (prevState.stats.money < chargedPrice) {
        processingActivities.current.delete(activityId);
        result = { message: 'Insufficient funds for this activity' };
        return prevState;
      }

      /**
       * C-1: the Commitment focus moves a health activity's energy cost.
       * `getEffectiveEnergyCost` was written for this and had no caller, so a
       * player whose primary focus was health was shown a discount they never
       * received - and one who had deprioritised health paid no surcharge.
       * Resolved from `prevState` so the gate and the debit below use the
       * same figure.
       */
      const energyCost = getCommitmentModifiers(prevState, 'health')
        .energyCost(activity.energyCost || 0);
      if (prevState.stats.energy < energyCost) {
        processingActivities.current.delete(activityId);
        result = { message: 'Not enough energy for this activity' };
        return prevState;
      }

      // All checks passed - apply effects atomically
      const updatedStats = { ...prevState.stats };
      const actualChanges: Partial<typeof updatedStats> = {};

      // Deduct money
      const currentMoney = typeof prevState.stats.money === 'number' && !isNaN(prevState.stats.money)
        ? prevState.stats.money
        : 0;
      const newMoney = Math.max(0, currentMoney - chargedPrice);
      updatedStats.money = newMoney;
      const moneyChange = newMoney - prevState.stats.money;

      // Deduct energy
      const currentEnergy = prevState.stats.energy;
      const newEnergy = clampStatByKey('energy', currentEnergy - energyCost);
      updatedStats.energy = newEnergy;
      actualChanges.energy = newEnergy - currentEnergy;

      // Add happiness
      const currentHappiness = prevState.stats.happiness;
      const newHappiness = clampStatByKey('happiness', currentHappiness + activity.happinessGain);
      updatedStats.happiness = newHappiness;
      actualChanges.happiness = newHappiness - currentHappiness;

      // Add health if applicable
      if (activity.healthGain) {
        const currentHealth = prevState.stats.health;
        const newHealth = clampStatByKey('health', currentHealth + activity.healthGain);
        updatedStats.health = newHealth;
        actualChanges.health = newHealth - currentHealth;
      }

      // Add fitness if applicable (Program 8: the walk and yoga build it).
      if (activity.fitnessGain) {
        const currentFitness = Number.isFinite(prevState.stats.fitness) ? prevState.stats.fitness : 0;
        const newFitness = clampStatByKey('fitness', currentFitness + activity.fitnessGain);
        updatedStats.fitness = newFitness;
        actualChanges.fitness = newFitness - currentFitness;
      }

      // Track gym visits: activities that improve fitness/health count as gym
      // visits and refresh the gym-visit timer the weekly tick reads for fitness
      // decay. `resetsGymTimer` is computed once above and reused here so the
      // guard's timer-staleness exception and this reset never drift apart.
      let updatedLastGymVisitWeek = prevState.lastGymVisitWeek;
      if (resetsGymTimer) {
        updatedLastGymVisitWeek = prevState.weeksLived || 0;
      }

      // Disease curing logic
      let updatedDiseases = [...(prevState.diseases || [])];
      const curedDiseases: string[] = [];
      let showCureSuccessModal = prevState.showCureSuccessModal;
      let updatedDiseaseHistory = prevState.diseaseHistory || {
        diseases: [],
        totalDiseases: 0,
        totalCured: 0,
        deathsFromDisease: 0,
      };
      let updatedImmunities = [...(prevState.diseaseImmunities || [])];
      // H3: vaccinations are a SEPARATE concept from disease immunities. Keeping
      // them in their own local (instead of overloading updatedImmunities) stops
      // the vaccine branch from clobbering cure-built immunities and vice-versa.
      let vaccinationsResult = prevState.vaccinations;

      // Validate diseases array
      if (!Array.isArray(updatedDiseases)) {
        updatedDiseases = [];
      }

      if (activityId === 'doctor') {
        // Doctor visit: 50% chance to cure each curable disease
        const diseasesToCheck = [...updatedDiseases];
        
        diseasesToCheck.forEach((disease, diseaseIdx) => {
          // Critical diseases need experimental treatment (matches the
          // SicknessModal guidance) - a routine doctor visit can't cure them.
          if (disease.curable && disease.severity !== 'critical') {
            // 50% cure chance (pre-rolled for StrictMode safety). Wrap the index
            // modulo the buffer length so a player carrying more than 10 curable
            // diseases doesn't read `undefined` (which `< 0.5` treats as false =
            // silent cure-immunity) - same buffer-overflow class as pet sickness.
            const cureRoll = curePreRolls[diseaseIdx % curePreRolls.length];
            if (cureRoll < 0.5) {
              // Disease cured
              curedDiseases.push(disease.name);
              updatedDiseases = updatedDiseases.filter(d => d.id !== disease.id);
              
              // Add immunity if applicable
              // eslint-disable-next-line @typescript-eslint/no-require-imports
              const { doesDiseaseGrantImmunity } = require('@/lib/diseases/immunitySystem');
              if (doesDiseaseGrantImmunity(disease.id)) {
                if (!updatedImmunities.includes(disease.id)) {
                  updatedImmunities = [...updatedImmunities, disease.id];
                }
              }
              
              // Update disease history
              updatedDiseaseHistory = {
                ...updatedDiseaseHistory,
                totalCured: updatedDiseaseHistory.totalCured + 1,
                diseases: updatedDiseaseHistory.diseases.map(d => 
                  d.id === disease.id && !d.curedWeek
                    ? { ...d, curedWeek: prevState.weeksLived || 0 }
                    : d
                ),
              };
            }
          }
        });
        
        // Chronic care: non-curable conditions can't be removed, but a doctor
        // visit puts them under management - the weekly tick halves their
        // symptoms and blocks worsening for the care window, and any
        // complication-compounded effects reset back to baseline.
        const doctorCare = applyChronicCare(
          updatedDiseases,
          prevState.weeksLived || 0,
          DOCTOR_MANAGEMENT_WEEKS,
        );
        updatedDiseases = doctorCare.diseases;
        const doctorManagedSuffix = doctorCare.managedNames.length > 0
          ? ` Under management for the next ${DOCTOR_MANAGEMENT_WEEKS} weeks (symptoms halved, no worsening): ${doctorCare.managedNames.join(', ')}.`
          : '';

        if (curedDiseases.length > 0) {
          showCureSuccessModal = true;
          result = {
            message: `Doctor visit successful! Cured: ${curedDiseases.join(', ')}.${doctorManagedSuffix}`
          };
        } else if (doctorCare.managedNames.length > 0) {
          result = {
            message: `Doctor visit complete.${doctorManagedSuffix}`
          };
        } else {
          result = {
            message: `Doctor visit completed, but no diseases were cured this time. The treatment wasn't effective.`
          };
        }
      } else if (activityId === 'hospital') {
        // Hospital stay: 100% cure for all curable diseases. Critical-tier
        // diseases (cancer, heart disease, stroke, organ/kidney failure) need
        // experimental treatment - was previously a cancer-only special case.
        const diseasesToCure = updatedDiseases.filter(d => d.curable && d.severity !== 'critical');
        const curedDiseaseIds = new Set<string>();
        
        // Process each disease to cure
        diseasesToCure.forEach((disease) => {
          curedDiseaseIds.add(disease.id);
          curedDiseases.push(disease.name);
          
          // Add immunity if applicable
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          const { doesDiseaseGrantImmunity } = require('@/lib/diseases/immunitySystem');
          if (doesDiseaseGrantImmunity(disease.id)) {
            if (!updatedImmunities.includes(disease.id)) {
              updatedImmunities = [...updatedImmunities, disease.id];
            }
          }
        });
        
        // Update disease history once for all cured diseases
        if (curedDiseaseIds.size > 0) {
          updatedDiseaseHistory = {
            ...updatedDiseaseHistory,
            totalCured: updatedDiseaseHistory.totalCured + curedDiseaseIds.size,
            diseases: updatedDiseaseHistory.diseases.map(d => 
              curedDiseaseIds.has(d.id) && !d.curedWeek
                ? { ...d, curedWeek: prevState.weeksLived || 0 }
                : d
            ),
          };
        }
        
        // Remove all cured diseases by ID (more reliable than filtering by property)
        updatedDiseases = updatedDiseases.filter(d => !curedDiseaseIds.has(d.id));

        // Chronic care: a hospital stay grants a longer management window than
        // a doctor visit (same mechanics - halved symptoms, no worsening,
        // compounded effects reset to baseline).
        const hospitalCare = applyChronicCare(
          updatedDiseases,
          prevState.weeksLived || 0,
          HOSPITAL_MANAGEMENT_WEEKS,
        );
        updatedDiseases = hospitalCare.diseases;
        const hospitalManagedSuffix = hospitalCare.managedNames.length > 0
          ? ` Under management for the next ${HOSPITAL_MANAGEMENT_WEEKS} weeks (symptoms halved, no worsening): ${hospitalCare.managedNames.join(', ')}.`
          : '';

        if (curedDiseases.length > 0) {
          showCureSuccessModal = true;
          result = {
            message: `Hospital stay successful! Cured: ${curedDiseases.join(', ')}.${hospitalManagedSuffix}`
          };
        } else if (hospitalCare.managedNames.length > 0) {
          result = {
            message: `Hospital stay complete.${hospitalManagedSuffix}`
          };
        } else {
          result = {
            message: `Hospital stay completed. No curable diseases to treat.`
          };
        }
      } else if (activityId === 'experimental') {
        // Experimental treatment: Can cure cancer and other critical diseases
        const criticalDiseases = updatedDiseases.filter(d => 
          d.severity === 'critical' && d.curable
        );
        criticalDiseases.forEach(disease => {
          curedDiseases.push(disease.name);
          
          // Update disease history
          updatedDiseaseHistory = {
            ...updatedDiseaseHistory,
            totalCured: updatedDiseaseHistory.totalCured + 1,
            diseases: updatedDiseaseHistory.diseases.map(d => 
              d.id === disease.id && !d.curedWeek
                ? { ...d, curedWeek: prevState.weeksLived || 0 }
                : d
            ),
          };
        });
        
        updatedDiseases = updatedDiseases.filter(d => 
          !(d.severity === 'critical' && d.curable)
        );
        
        if (curedDiseases.length > 0) {
          showCureSuccessModal = true;
          result = { 
            message: `Experimental treatment successful! Cured: ${curedDiseases.join(', ')}` 
          };
        } else {
          result = { 
            message: `${activity.name} completed successfully!` 
          };
        }
      } else if (activityId === 'flu_shot' || activityId === 'pneumonia_vaccine') {
        // Vaccinations: add to the vaccinations array only (NOT diseaseImmunities).
        const vaccinationId = activityId;
        const currentVaccinations = prevState.vaccinations || [];
        vaccinationsResult = currentVaccinations.includes(vaccinationId)
          ? currentVaccinations
          : [...currentVaccinations, vaccinationId];

        result = {
          message: `${activity.name} completed successfully! You're now protected against ${activityId === 'flu_shot' ? 'influenza' : 'pneumonia'}.` 
        };
      } else {
        // Other health activities don't cure diseases
        result = { message: `${activity.name} completed successfully!` };
      }

      // Update daily summary
      let dailySummary = prevState.dailySummary;
      if (dailySummary) {
        const existingStatsChange = dailySummary.statsChange || {};
        const mergedStatsChange = { ...existingStatsChange };
        
        Object.entries(actualChanges).forEach(([key, value]) => {
          const k = key as keyof typeof actualChanges;
          mergedStatsChange[k] = ((mergedStatsChange[k] as number) || 0) + (value || 0);
        });

        dailySummary = {
          ...dailySummary,
          moneyChange: (dailySummary.moneyChange || 0) + moneyChange,
          totalMoneySpent: (dailySummary.totalMoneySpent || 0) + Math.max(0, -moneyChange),
          statsChange: mergedStatsChange,
          // R2-B: cap to 50 events between weekly resets.
          events: (dailySummary.events || []).slice(-50),
        };
      }

      // Update lifetime statistics
      const currentLifetimeStats = prevState.lifetimeStatistics || getDefaultStatistics();
      const updatedLifetimeStats = trackMoneySpent(currentLifetimeStats, moneyChange);

      // Remove from processing set after state update
      setTimeout(() => {
        processingActivities.current.delete(activityId);
      }, 50);

      logger.info('Health activity completed:', {
        activityId,
        name: activity.name,
        price: activity.price,
        energyCost,
        happinessGain: activity.happinessGain,
        healthGain: activity.healthGain
      });

      // Only set default success message if result wasn't already set by specific activity logic
      if (!result) {
        result = { message: `${activity.name} completed successfully!` };
      }

      return {
        ...prevState,
        stats: updatedStats,
        dailySummary,
        lifetimeStatistics: updatedLifetimeStats,
        diseases: updatedDiseases,
        // THIS treatment's cures only - not the lifetime list.
        //
        // Player report: "When fixing a current ailment, all previous ailments
        // are mentioned." Curing one condition showed "CURED · 9" listing every
        // disease the character had ever recovered from, because this field
        // accumulated (`[...prev, ...new]`, deduped, capped at 30) and
        // `CureSuccessModal` renders all of it.
        //
        // Safe to narrow: that modal is the field's ONLY reader anywhere in the
        // app, and the lifetime tally already lives in
        // `diseaseHistory.totalCured`, which is updated just below. So no new
        // GameState field and no STATE_VERSION bump - an existing save simply
        // shows the correct short list on its next treatment.
        //
        // Still deduped: a single visit can cure the same-named condition from
        // two sources, and listing it twice reads as a bug of its own.
        curedDiseases: Array.from(new Set(curedDiseases)),
        showCureSuccessModal: showCureSuccessModal,
        // A cure restarts the generator's cooldown, like a natural recovery
        // does in the tick (Program 8): four clear weeks before the next roll.
        ...(curedDiseases.length > 0 ? { lastDiseaseWeek: prevState.weeksLived || 0 } : {}),
        diseaseHistory: updatedDiseaseHistory,
        diseaseImmunities: updatedImmunities,
        vaccinations: vaccinationsResult,
        lastGymVisitWeek: updatedLastGymVisitWeek,
        // C-1 (BBQ, 2026-08-31): performing a health activity raises the health
        // commitment level, the same way practising raises `hobbies`. Without
        // this the level could only ever decay, so the level half of the focus
        // bonus (a primary focus is +30% at level 0 and +50% at level 100) was
        // unreachable and the modal's bar never moved. Inside the same updater
        // as the charge, so a same-batch double tap cannot count twice.
        activityCommitments: recordCommitmentActivity(prevState.activityCommitments, 'health'),
      };
    });

    return result;
  }, [setGameState]);

  const dismissSicknessModal = useCallback(() => {
    setGameState(prevState => ({
      ...prevState,
      showSicknessModal: false,
    }));
  }, [setGameState]);

  const dismissCureSuccessModal = useCallback(() => {
    setGameState(prevState => ({
      ...prevState,
      showCureSuccessModal: false,
    }));
  }, [setGameState]);

  const dismissStatWarning = useCallback(() => {
    setGameState(prevState => ({
      ...prevState,
      showZeroStatPopup: false,
    }));
  }, [setGameState]);

  const dismissWelcomePopup = useCallback(() => {
    setGameState(prevState => ({
      ...prevState,
      showWelcomePopup: false,
    }));
  }, [setGameState]);

  const toggleDietPlan = useCallback((planId: string) => {
    const state = getGameState();
    if (!state) return;

    setGameState(prevState => {
      // Find the plan to toggle
      const planToToggle = (prevState.dietPlans || []).find(plan => plan.id === planId);
      if (!planToToggle) {
        logger.error(`Diet plan not found: ${planId}`);
        return prevState;
      }

      // If activating, check if player can afford the weekly cost
      const isCurrentlyActive = planToToggle.active;
      const weeklyCost = planToToggle.dailyCost * 7;
      
      if (!isCurrentlyActive) {
        // Activating: check if player can afford it
        const currentMoney = typeof prevState.stats.money === 'number' && !isNaN(prevState.stats.money)
          ? prevState.stats.money
          : 0;
        
        if (currentMoney < weeklyCost) {
          logger.warn(`Cannot activate diet plan ${planId}: insufficient funds. Need $${weeklyCost}, have $${currentMoney}`);
          return prevState;
        }

        // Deduct weekly cost when activating
        const newMoney = Math.max(0, currentMoney - weeklyCost);
        const moneyChange = newMoney - currentMoney;

        // Update daily summary
        let dailySummary = prevState.dailySummary;
        if (dailySummary) {
          dailySummary = {
            ...dailySummary,
            moneyChange: (dailySummary.moneyChange || 0) + moneyChange,
            totalMoneySpent: (dailySummary.totalMoneySpent || 0) + Math.max(0, -moneyChange),
            statsChange: { ...(dailySummary.statsChange || {}) },
            // R2-B: cap events at 50 between weekly resets.
            events: (dailySummary.events || []).slice(-50),
          };
        }

        // Update diet plans: activate this one, deactivate all others
        const updatedDietPlans = (prevState.dietPlans || []).map(plan => ({
          ...plan,
          active: plan.id === planId,
        }));

        logger.info(`Activated diet plan: ${planToToggle.name} (Weekly cost: $${weeklyCost})`);

        return {
          ...prevState,
          stats: {
            ...prevState.stats,
            money: newMoney,
          },
          dietPlans: updatedDietPlans,
          dailySummary,
        };
      } else {
        // Deactivating: just toggle off (no refund)
        const updatedDietPlans = (prevState.dietPlans || []).map(plan => ({
          ...plan,
          active: plan.id === planId ? false : plan.active,
        }));

        logger.info(`Deactivated diet plan: ${planToToggle.name}`);

        return {
          ...prevState,
          dietPlans: updatedDietPlans,
        };
      }
    });
  }, [setGameState]);

  // Hobbies removed - no longer available

  const value = useMemo<ItemActionsContextType>(() => ({
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
  }), [buyItem, sellItem, buyDarkWebItem, buyHack, performHack, buyFood, performHealthActivity, dismissSicknessModal, dismissCureSuccessModal, dismissStatWarning, dismissWelcomePopup, toggleDietPlan]);

  return (
    <ItemActionsContext.Provider value={value}>
      {children}
    </ItemActionsContext.Provider>
  );
}
