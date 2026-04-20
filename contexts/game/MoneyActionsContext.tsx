import React, { createContext, useContext, useCallback, ReactNode, useMemo, useRef, useEffect } from 'react';
import { Alert, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { safeAsyncStorage } from '@/utils/storageWrapper';
import { calcWeeklyPassiveIncome } from '@/lib/economy/passiveIncome';
import { applyWeeklyInflation, getInflatedPrice } from '@/lib/economy/inflation';
import { simulateWeek, getStockInfo } from '@/lib/economy/stockMarket';
import { MAX_ACTIVE_RELATIONSHIPS, MAX_RELATIONSHIP_INCOME, MAX_RELATIONSHIPS_FOR_INCOME } from '@/lib/economy/balanceConstants';
import { validateStats, clampStatByKey } from '@/utils/statUtils';
import { logger } from '@/utils/logger';
import { executePrestige as executePrestigeFunction } from '@/lib/prestige/prestigeExecution';
import { getPrestigeThreshold } from '@/lib/prestige/prestigeTypes';
import { getBonusPurchaseCost, canPurchaseBonus, PRESTIGE_BONUSES } from '@/lib/prestige/prestigeBonuses';
import { applyStartingBonuses , getIncomeMultiplier, getExperienceMultiplier, getEnergyRegenMultiplier, getStatDecayMultiplier, getSkillGainMultiplier, getRelationshipGainMultiplier, hasImmortality } from '@/lib/prestige/applyBonuses';
import { validateStatChanges, sanitizeStatChanges, sanitizeFinalStats, validateStateInvariants, validateMoneyInvariants } from '@/utils/stateInvariants';
import { applyUnlockBonuses, hasEarlyCareerAccess } from '@/lib/prestige/applyUnlocks';
import { shouldAutoCollectRent, shouldAutoReinvestDividends } from '@/lib/prestige/applyQOLBonuses';
import { useGameState } from './GameStateContext';
import { useGameData } from './GameDataContext';
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
import { haptic } from '@/utils/haptics';
import { applyMindsetEffects } from '@/lib/mindset/config';
import { computeInheritance } from '@/lib/legacy/inheritance';
import { FamilyBusinessSystem } from '@/lib/legacy/familyBusiness';
import { trackMoneyEarned, trackMoneySpent, getDefaultStatistics } from '@/lib/statistics/statisticsTracker';

interface MoneyActionsContextType {
  // Money & Economy
  updateMoney: (amount: number, reason: string, updateDailySummary?: boolean) => void;
  batchUpdateMoney: (transactions: {amount: number, reason: string}[]) => void;
  applyPerkEffects: (baseValue: number, perkType: string) => number;

  // IAP & Perks
  buyPerk: (perkId: string) => void;
  buyStarterPack: () => void;
  buyGoldPack: () => void;
  buyGoldUpgrade: (upgradeId: string) => void;
  buyRevival: () => void;

  // Crypto
  buyCrypto: (cryptoId: string, amount: number) => void;
  sellCrypto: (cryptoId: string, amount: number) => void;
  swapCrypto: (fromCryptoId: string, toCryptoId: string, amount: number) => void;

  // Prestige
  purchasePrestigeBonus: (bonusId: string) => { success: boolean; message?: string };
}

const MoneyActionsContext = createContext<MoneyActionsContextType | undefined>(undefined);

export function useMoneyActions() {
  const context = useContext(MoneyActionsContext);
  if (!context) {
    throw new Error('useMoneyActions must be used within MoneyActionsProvider');
  }
  return context;
}

interface MoneyActionsProviderProps {
  children: ReactNode;
}

export function MoneyActionsProvider({ children }: MoneyActionsProviderProps) {
  const { gameState, setGameState } = useGameState();
  const { initialState } = useGameData();
  const { setIsLoading, setLoadingProgress, setLoadingMessage } = useGameUI();
  const { showError } = useUIUX();

  // Ref keeps latest state for callbacks without adding gameState to deps.
  // This prevents callback recreation on every state change.
  const stateRef = useRef(gameState);
  useEffect(() => { stateRef.current = gameState; }, [gameState]);

  // Money & Economy Actions
  const updateMoney = useCallback((amount: number, reason: string, updateDailySummary = true) => {
    const now = Date.now();
    setGameState(prevState => {
      const newMoney = Math.max(0, prevState.stats.money + amount);
      const newState = {
        ...prevState,
        updatedAt: now,
        stats: {
          ...prevState.stats,
          money: newMoney,
        },
      };

      // Update daily summary if requested
      if (updateDailySummary && newState.dailySummary) {
        newState.dailySummary = {
          ...newState.dailySummary,
          totalMoneyEarned: newState.dailySummary.totalMoneyEarned + Math.max(0, amount),
          totalMoneySpent: newState.dailySummary.totalMoneySpent + Math.max(0, -amount),
        };
      }

      // Track statistics
      const currentStats = prevState.lifetimeStatistics || getDefaultStatistics();
      let updatedStats = currentStats;
      
      if (amount > 0) {
        updatedStats = trackMoneyEarned(currentStats, amount);
      } else if (amount < 0) {
        updatedStats = trackMoneySpent(currentStats, amount);
      }
      
      // Update lifetime statistics in state
      newState.lifetimeStatistics = updatedStats;

      // Validate money invariants with the correct argument contract.
      const invariantCheck = validateMoneyInvariants(prevState.stats.money, amount, newMoney);
      if (!invariantCheck.valid) {
        logger.warn('Money update violated invariants:', {
          amount,
          reason,
          newMoney,
          errors: invariantCheck.errors,
        });
      }

      return newState;
    });
  }, [setGameState]);

  const batchUpdateMoney = useCallback((transactions: {amount: number, reason: string}[]) => {
    let totalAmount = 0;
    const reasons: string[] = [];

    transactions.forEach(({ amount, reason }) => {
      totalAmount += amount;
      reasons.push(reason);
    });

    updateMoney(totalAmount, reasons.join(', '));
  }, [updateMoney]);

  const applyPerkEffects = useCallback((baseValue: number, perkType: string): number => {
    const state = stateRef.current;
    if (!state) return baseValue;

    let multiplier = 1;

    switch (perkType) {
      case 'income':
        if (state.goldUpgrades?.work_boost) multiplier *= 1.5;
        if (state.perks?.workBoost) multiplier *= 1.5;
        break;
      case 'experience':
        if (state.goldUpgrades?.fast_learner) multiplier *= 1.5;
        if (state.perks?.fastLearner) multiplier *= 1.5;
        break;
      case 'energy':
        if (state.goldUpgrades?.mindset) multiplier *= 1.5;
        if (state.perks?.mindset) multiplier *= 1.5;
        break;
      case 'relationship':
        // No current perk affects relationships
        break;
    }

    return Math.round(baseValue * multiplier);
  }, []);

  // IAP & Perks Actions
  const buyPerk = useCallback((perkId: string) => {
    const perk = perksData.find(p => p.id === perkId);
    if (!perk) {
      showError('Invalid Perk', `Perk ${perkId} not found`);
      return;
    }

    const state = stateRef.current;
    if (!state || state.stats.gems < perk.cost) {
      showError('Insufficient Gems', `You need ${perk.cost} gems to purchase this perk`);
      return;
    }

    haptic.success(); // Purchase confirmed
    setGameState(prevState => ({
      ...prevState,
      stats: {
        ...prevState.stats,
        gems: prevState.stats.gems - perk.cost,
      },
      perks: {
        ...prevState.perks,
        [perkId]: true,
      },
    }));

    logger.info('Perk purchased:', { perkId, cost: perk.cost });
  }, [setGameState, showError]);

  const buyStarterPack = useCallback(() => {
    // Implementation for starter pack purchase
    logger.info('Starter pack purchase initiated');
  }, []);

  const buyGoldPack = useCallback(() => {
    // Implementation for gold pack purchase
    logger.info('Gold pack purchase initiated');
  }, []);

  const buyGoldUpgrade = useCallback((upgradeId: string) => {
    const state = stateRef.current;
    if (!state) {
      logger.error('Cannot purchase upgrade: gameState is null');
      return;
    }

    // Define valid upgrade IDs and their gem costs (must match GemShopModal.tsx)
    const upgradeDefinitions: Record<string, { cost: number; name: string }> = {
      multiplier: { cost: 5000, name: 'Money Multiplier' },
      energy_boost: { cost: 7500, name: 'Energy Boost' },
      happiness_boost: { cost: 6000, name: 'Happiness Boost' },
      fitness_boost: { cost: 9000, name: 'Fitness Boost' },
      skill_mastery: { cost: 15000, name: 'Skill Mastery' },
      time_machine: { cost: 25000, name: 'Time Machine' },
      immortality: { cost: 50000, name: 'Immortality' },
    };

    const upgrade = upgradeDefinitions[upgradeId];
    if (!upgrade) {
      logger.error('Invalid upgrade ID:', upgradeId);
      showError('Invalid Upgrade', `Upgrade ${upgradeId} not found.`);
      return;
    }

    // Check if already owned
    if (state.goldUpgrades?.[upgradeId as keyof typeof state.goldUpgrades]) {
      showError('Already Owned', `You already own ${upgrade.name}.`);
      return;
    }

    // Check if user has enough gems
    const currentGems = state.stats?.gems || 0;
    if (currentGems < upgrade.cost) {
      showError('Insufficient Gems', `You need ${upgrade.cost} gems to purchase ${upgrade.name}.`);
      return;
    }

    // Apply the upgrade
    setGameState(prevState => ({
      ...prevState,
      stats: {
        ...prevState.stats,
        gems: prevState.stats.gems - upgrade.cost,
      },
      goldUpgrades: {
        ...prevState.goldUpgrades,
        [upgradeId]: true,
      },
    }));

    logger.info('Gold upgrade purchased:', { upgradeId, name: upgrade.name, cost: upgrade.cost });
  }, [setGameState, showError]);

  const buyRevival = useCallback(() => {
    // Implementation for revival purchase
    logger.info('Revival purchase initiated');
  }, []);

  // Crypto Actions
  const buyCrypto = useCallback((cryptoId: string, amount: number) => {
    const state = stateRef.current;
    if (!state) return;

    const crypto = state.cryptos?.find(c => c.id === cryptoId);
    if (!crypto) {
      logger.error('Crypto not found:', cryptoId);
      return;
    }

    if (amount <= 0) {
      logger.error('Invalid crypto purchase amount:', amount);
      return;
    }

    const currentMoney = state.stats?.money || 0;
    if (currentMoney < amount) {
      logger.error('Insufficient funds for crypto purchase:', { needed: amount, have: currentMoney });
      return;
    }

    const cryptoAmount = amount / crypto.price;
    if (!isFinite(cryptoAmount) || cryptoAmount <= 0) {
      logger.error('Invalid crypto amount calculation:', { amount, price: crypto.price, cryptoAmount });
      return;
    }

    haptic.medium(); // Crypto trade
    // Atomic update: money and crypto ownership in a single setGameState call
    const now = Date.now();
    setGameState(prev => {
      const newMoney = Math.max(0, prev.stats.money - amount);
      const currentStats = prev.lifetimeStatistics || getDefaultStatistics();
      const updatedStats = trackMoneySpent(currentStats, -amount);

      return {
        ...prev,
        updatedAt: now,
        stats: {
          ...prev.stats,
          money: newMoney,
        },
        cryptos: prev.cryptos?.map(c =>
          c.id === cryptoId
            ? { ...c, owned: (c.owned || 0) + cryptoAmount }
            : c
        ) || prev.cryptos,
        lifetimeStatistics: updatedStats,
      };
    });

    logger.info('Crypto purchase completed:', {
      cryptoId,
      symbol: crypto.symbol,
      amount,
      cryptoAmount,
      newOwned: (crypto.owned || 0) + cryptoAmount
    });
  }, [setGameState]);

  const sellCrypto = useCallback((cryptoId: string, amount: number) => {
    const state = stateRef.current;
    if (!state) return;

    const crypto = state.cryptos?.find(c => c.id === cryptoId);
    if (!crypto) {
      logger.error('Crypto not found:', cryptoId);
      return;
    }

    const ownedAmount = crypto.owned || 0;
    if (ownedAmount < amount) {
      logger.error('Insufficient crypto for sale:', { needed: amount, have: ownedAmount });
      return;
    }

    const saleValue = amount * crypto.price;
    if (!isFinite(saleValue) || saleValue <= 0) {
      logger.error('Invalid crypto sale calculation:', { amount, price: crypto.price, saleValue });
      return;
    }

    // Atomic update: money and crypto ownership in a single setGameState call
    const now = Date.now();
    setGameState(prev => {
      const newMoney = prev.stats.money + saleValue;
      const currentStats = prev.lifetimeStatistics || getDefaultStatistics();
      const updatedStats = trackMoneyEarned(currentStats, saleValue);

      return {
        ...prev,
        updatedAt: now,
        stats: {
          ...prev.stats,
          money: newMoney,
        },
        cryptos: prev.cryptos?.map(c =>
          c.id === cryptoId
            ? { ...c, owned: Math.max(0, (c.owned || 0) - amount) }
            : c
        ) || prev.cryptos,
        lifetimeStatistics: updatedStats,
      };
    });

    logger.info('Crypto sale completed:', {
      cryptoId,
      symbol: crypto.symbol,
      amount,
      saleValue,
      remainingOwned: Math.max(0, ownedAmount - amount)
    });
  }, [setGameState]);

  const swapCrypto = useCallback((fromCryptoId: string, toCryptoId: string, amount: number) => {
    const state = stateRef.current;
    if (!state) return;

    const fromCrypto = state.cryptos?.find(c => c.id === fromCryptoId);
    const toCrypto = state.cryptos?.find(c => c.id === toCryptoId);

    if (!fromCrypto || !toCrypto) {
      logger.error('Crypto not found for swap:', { fromCryptoId, toCryptoId });
      return;
    }

    const ownedAmount = fromCrypto.owned || 0;
    if (ownedAmount < amount) {
      logger.error('Insufficient crypto for swap:', { needed: amount, have: ownedAmount });
      return;
    }

    const fromValue = amount * fromCrypto.price;
    const toAmount = fromValue / toCrypto.price;

    if (!isFinite(fromValue) || !isFinite(toAmount) || fromValue <= 0 || toAmount <= 0) {
      logger.error('Invalid crypto swap calculation:', {
        amount,
        fromPrice: fromCrypto.price,
        toPrice: toCrypto.price,
        fromValue,
        toAmount
      });
      return;
    }

    // Update crypto ownership
    setGameState(prev => ({
      ...prev,
      cryptos: prev.cryptos?.map(c => {
        if (c.id === fromCryptoId) {
          return { ...c, owned: Math.max(0, (c.owned || 0) - amount) };
        } else if (c.id === toCryptoId) {
          return { ...c, owned: (c.owned || 0) + toAmount };
        }
        return c;
      }) || prev.cryptos,
    }));

    logger.info('Crypto swap completed:', {
      fromCryptoId,
      toCryptoId,
      fromSymbol: fromCrypto.symbol,
      toSymbol: toCrypto.symbol,
      amount,
      toAmount,
      fromValue,
      remainingFrom: Math.max(0, ownedAmount - amount),
      newTo: (toCrypto.owned || 0) + toAmount
    });
  }, [setGameState]);

  // Prestige Actions
  const purchasePrestigeBonus = useCallback((bonusId: string): { success: boolean; message?: string } => {
    const state = stateRef.current;
    if (!state?.prestige) {
      return { success: false, message: 'Prestige system not available' };
    }

    const bonus = PRESTIGE_BONUSES.find(b => b.id === bonusId);
    if (!bonus) {
      return { success: false, message: 'Bonus not found' };
    }

    const unlockedBonuses = state.prestige.unlockedBonuses || [];
    const prestigePoints = state.prestige.prestigePoints || 0;

    // Check if can purchase
    if (!canPurchaseBonus(bonus, unlockedBonuses)) {
      return { success: false, message: 'Bonus is at maximum level' };
    }

    // Get cost
    const cost = getBonusPurchaseCost(bonus, unlockedBonuses);
    if (prestigePoints < cost) {
      return { success: false, message: `Insufficient prestige points. Need ${cost}, have ${prestigePoints}` };
    }

    logger.info('[purchasePrestigeBonus] Purchasing:', { bonusId, cost, prestigePoints });
    haptic.success(); // Prestige bonus purchased

    // Purchase the bonus - use prevState callback to always get current state
    setGameState(prevState => {
      if (!prevState.prestige) {
        logger.error('[purchasePrestigeBonus] prevState.prestige is null');
        return prevState;
      }

      if (!prevState.stats) {
        logger.error('[purchasePrestigeBonus] prevState.stats is null/undefined!');
        return prevState;
      }

      // Use prevState.stats.money directly - React guarantees it's current inside the callback
      const updatedPrestige = {
        ...prevState.prestige,
        prestigePoints: prevState.prestige.prestigePoints - cost,
        unlockedBonuses: [...(prevState.prestige.unlockedBonuses || []), bonusId],
      };

      const newState: GameState = {
        ...prevState,
        prestige: updatedPrestige,
        // Stats are preserved via spread - money is not touched
      };

      logger.info('[purchasePrestigeBonus] After update:', {
        money: newState.stats.money,
        prestigePoints: newState.prestige.prestigePoints,
      });

      return newState;
    });

    logger.info('Prestige bonus purchased:', { bonusId, cost });
    return { success: true, message: `Purchased ${bonus.name}` };
  }, [setGameState]);

  const value = useMemo<MoneyActionsContextType>(() => ({
    updateMoney,
    batchUpdateMoney,
    applyPerkEffects,
    buyPerk,
    buyStarterPack,
    buyGoldPack,
    buyGoldUpgrade,
    buyRevival,
    buyCrypto,
    sellCrypto,
    swapCrypto,
    purchasePrestigeBonus,
  }), [updateMoney, batchUpdateMoney, applyPerkEffects, buyPerk, buyStarterPack, buyGoldPack, buyGoldUpgrade, buyRevival, buyCrypto, sellCrypto, swapCrypto, purchasePrestigeBonus]);

  return (
    <MoneyActionsContext.Provider value={value}>
      {children}
    </MoneyActionsContext.Provider>
  );
}
