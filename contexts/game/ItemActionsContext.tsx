import React, { createContext, useContext, useCallback, ReactNode, useRef, useMemo, useEffect } from 'react';
import * as ItemActions from './actions/ItemActions';
import * as StatsActions from './actions/StatsActions';
import { updateMoney as updateMoneyModule } from './actions/MoneyActions';
import { logger } from '@/utils/logger';
import { useGameState } from './GameStateContext';
import { useMoneyActions } from './MoneyActionsContext';
import { useUIUX } from '@/contexts/UIUXContext';
import { HackResult } from './types';
import { clampStatByKey } from '@/utils/statUtils';
import { trackMoneySpent, getDefaultStatistics } from '@/lib/statistics/statisticsTracker';
import { haptic } from '@/utils/haptics';

interface ItemActionsContextType {
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
  const { gameState, setGameState } = useGameState();
  const { updateMoney } = useMoneyActions();
  const { showError } = useUIUX();
  // Track activities currently being processed to prevent double-clicks
  const processingActivities = useRef<Set<string>>(new Set());

  // Ref keeps latest state for callbacks without adding gameState to deps
  const stateRef = useRef(gameState);
  useEffect(() => { stateRef.current = gameState; }, [gameState]);

  // Items & Purchases Actions
  const buyItem = useCallback((itemId: string) => {
    const state = stateRef.current;
    if (!state) return;

    const result = ItemActions.buyItem(state, setGameState, itemId, { updateMoney: updateMoneyModule });
    if (result?.success) {
      haptic.medium(); // Item purchased
    } else {
      showError('Purchase Failed', result?.message || 'Could not purchase item');
    }
  }, [setGameState, updateMoney, showError]);

  const sellItem = useCallback((itemId: string) => {
    const state = stateRef.current;
    if (!state) return;

    const result = ItemActions.sellItem(state, setGameState, itemId, { updateMoney: updateMoneyModule });
    if (!result?.success) {
      showError('Sale Failed', result?.message || 'Could not sell item');
    }
  }, [setGameState, updateMoney, showError]);

  // Onion (dark-web) actions — were all stubs that logged and did nothing,
  // so the entire Onion tab was non-functional: buying items, buying
  // hacks, and performing hacks all silently no-op'd. Wire them through
  // the canonical state (cryptos[btc].owned for BTC, hacks[i].purchased
  // for ownership, jailWeeks for caught-while-hacking penalties).

  const buyDarkWebItem = useCallback((itemId: string) => {
    const state = stateRef.current;
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

    setGameState(prev => ({
      ...prev,
      cryptos: (prev.cryptos || []).map(c =>
        c.id === 'btc' ? { ...c, owned: c.owned - item.costBtc } : c
      ),
      darkWebItems: (prev.darkWebItems || []).map(i =>
        i.id === itemId ? { ...i, owned: true } : i
      ),
    }));
    logger.info('Dark web item purchased:', { itemId, name: item.name, costBtc: item.costBtc });
  }, [setGameState, showError]);

  const buyHack = useCallback((hackId: string) => {
    const state = stateRef.current;
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
    const state = stateRef.current;
    const empty: HackResult = { success: false, caught: false, reward: 0, btcReward: 0, risk: 0 };
    if (!state) return empty;

    const hack = state.hacks?.find(h => h.id === hackId);
    if (!hack || !hack.purchased) {
      logger.error('Hack not available:', { hackId, found: !!hack, purchased: hack?.purchased });
      return empty;
    }
    if ((state.stats.energy ?? 0) < hack.energyCost) {
      showError('Too Tired', `You need ${hack.energyCost} energy to run ${hack.name}.`);
      return empty;
    }

    const ownedItems = (state.darkWebItems || []).filter(i => i.owned);
    const riskReduction = ownedItems.reduce((sum, i) => sum + (i.riskReduction || 0), 0);
    const rewardBonus = ownedItems.reduce((sum, i) => sum + (i.rewardBonus || 0), 0);
    const effectiveRisk = Math.max(0, hack.risk - riskReduction);

    const caught = Math.random() < effectiveRisk;

    if (caught) {
      setGameState(prev => ({
        ...prev,
        stats: { ...prev.stats, energy: Math.max(0, (prev.stats.energy ?? 0) - hack.energyCost) },
        jailWeeks: Math.min(52, (prev.jailWeeks ?? 0) + 4),
      }));
      logger.warn('Hack caught:', { hackId, risk: effectiveRisk });
      return { success: false, caught: true, reward: 0, btcReward: 0, risk: effectiveRisk, jailed: true };
    }

    // Reward: 80% cash, 20% BTC (deterministic split — rewardBonus adds to cash).
    const cashReward = Math.round(hack.reward * (1 + rewardBonus));
    const btcPrice = state.cryptos?.find(c => c.id === 'btc')?.price || 50000;
    const btcReward = btcPrice > 0 ? (hack.reward * 0.2) / btcPrice : 0;

    setGameState(prev => ({
      ...prev,
      stats: {
        ...prev.stats,
        money: (prev.stats.money ?? 0) + cashReward,
        energy: Math.max(0, (prev.stats.energy ?? 0) - hack.energyCost),
      },
      cryptos: (prev.cryptos || []).map(c =>
        c.id === 'btc' ? { ...c, owned: c.owned + btcReward } : c
      ),
    }));
    logger.info('Hack successful:', { hackId, cashReward, btcReward, risk: effectiveRisk });
    return { success: true, caught: false, reward: cashReward, btcReward, risk: effectiveRisk };
  }, [setGameState, showError]);

  const buyFood = useCallback((foodId: string) => {
    const state = stateRef.current;
    if (!state) return;

    const food = state.foods?.find(f => f.id === foodId);
    if (!food) {
      logger.error('Food not found:', foodId);
      return;
    }

    if (state.stats.money < food.price) {
      logger.error('Insufficient funds for food purchase:', { needed: food.price, have: state.stats.money });
      return;
    }

    // Calculate happiness restore (healthRestore / 2, minimum 1)
    const happinessRestore = Math.max(1, Math.round(food.healthRestore / 2));

    updateMoney(-food.price, `Food purchase: ${food.name}`);
    StatsActions.updateStats(setGameState, {
      health: food.healthRestore,
      energy: food.energyRestore,
      happiness: happinessRestore,
    });

    logger.info('Food purchase completed:', {
      foodId,
      name: food.name,
      price: food.price,
      healthGain: food.healthRestore,
      energyGain: food.energyRestore,
      happinessGain: happinessRestore
    });
  }, [updateMoney, setGameState]);

  const performHealthActivity = useCallback((activityId: string) => {
    const state = stateRef.current;
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

      // Check costs with latest state
      if (prevState.stats.money < activity.price) {
        processingActivities.current.delete(activityId);
        result = { message: 'Insufficient funds for this activity' };
        return prevState;
      }

      const energyCost = activity.energyCost || 0;
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
      const newMoney = Math.max(0, currentMoney - activity.price);
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

      // Track gym visits: activities that increase fitness count as gym visits
      // This includes activities like walk, yoga, and any activity that increases fitness
      const fitnessIncreasingActivities = ['walk', 'yoga', 'massage'];
      let updatedLastGymVisitWeek = prevState.lastGymVisitWeek;
      if (fitnessIncreasingActivities.includes(activityId) || activity.healthGain) {
        // Consider activities that improve health as gym-like activities
        // Also track when fitness actually increases (if we add fitnessGain to activities later)
        updatedLastGymVisitWeek = prevState.weeksLived || 0;
      }

      // Disease curing logic
      let updatedDiseases = [...(prevState.diseases || [])];
      const curedDiseases: string[] = [];
      let showCureSuccessModal = prevState.showCureSuccessModal;
      let updatedCuredDiseases = [...(prevState.curedDiseases || [])];
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
          if (disease.curable) {
            // 50% cure chance (pre-rolled for StrictMode safety). Wrap the index
            // modulo the buffer length so a player carrying more than 10 curable
            // diseases doesn't read `undefined` (which `< 0.5` treats as false =
            // silent cure-immunity) — same buffer-overflow class as pet sickness.
            const cureRoll = curePreRolls[diseaseIdx % curePreRolls.length];
            if (cureRoll < 0.5) {
              // Disease cured
              curedDiseases.push(disease.name);
              updatedCuredDiseases.push(disease.name);
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
        
        if (curedDiseases.length > 0) {
          showCureSuccessModal = true;
          result = { 
            message: `Doctor visit successful! Cured: ${curedDiseases.join(', ')}` 
          };
        } else {
          result = { 
            message: `Doctor visit completed, but no diseases were cured this time. The treatment wasn't effective.` 
          };
        }
      } else if (activityId === 'hospital') {
        // Hospital stay: 100% cure for all curable diseases (except cancer needs experimental)
        const diseasesToCure = updatedDiseases.filter(d => d.curable && d.id !== 'cancer');
        const curedDiseaseIds = new Set<string>();
        
        // Process each disease to cure
        diseasesToCure.forEach((disease) => {
          curedDiseaseIds.add(disease.id);
          curedDiseases.push(disease.name);
          updatedCuredDiseases.push(disease.name);
          
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
        
        if (curedDiseases.length > 0) {
          showCureSuccessModal = true;
          result = { 
            message: `Hospital stay successful! Cured: ${curedDiseases.join(', ')}` 
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
          updatedCuredDiseases.push(disease.name);
          
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
        // R2-B: dedupe + cap to 30. Without this the same disease cured
        // multiple times duplicates entries forever, and the CureSuccessModal
        // renders the full list.
        curedDiseases: Array.from(new Set(updatedCuredDiseases)).slice(-30),
        showCureSuccessModal: showCureSuccessModal,
        diseaseHistory: updatedDiseaseHistory,
        diseaseImmunities: updatedImmunities,
        vaccinations: vaccinationsResult,
        lastGymVisitWeek: updatedLastGymVisitWeek,
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
    const state = stateRef.current;
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
