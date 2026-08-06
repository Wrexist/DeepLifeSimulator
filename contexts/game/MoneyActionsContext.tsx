import React, { createContext, useContext, useCallback, ReactNode, useMemo, useRef, useEffect } from 'react';
import { Alert, Platform } from 'react-native';
import { simulateWeek, getStockInfo } from '@/lib/economy/stockMarket';
import { MAX_ACTIVE_RELATIONSHIPS, MAX_RELATIONSHIP_INCOME, MAX_RELATIONSHIPS_FOR_INCOME } from '@/lib/economy/balanceConstants';
import { validateStats, clampStatByKey } from '@/utils/statUtils';
import { logger } from '@/utils/logger';
import { isIncomeReason } from './actions/MoneyActions';
import { getBonusPurchaseCost, canPurchaseBonus, isInertBonus, PRESTIGE_BONUSES } from '@/lib/prestige/prestigeBonuses';
import { purchaseLegacyUpgrade } from '@/lib/legacy/legacyShop';
import { claimContract } from '@/lib/legacy/contracts';
import { applyStartingBonuses , getIncomeMultiplier, getExperienceMultiplier, getEnergyRegenMultiplier, getStatDecayMultiplier, getSkillGainMultiplier, getRelationshipGainMultiplier, hasImmortality } from '@/lib/prestige/applyBonuses';
import { validateMoneyInvariants } from '@/utils/stateInvariants';
import { applyUnlockBonuses, hasEarlyCareerAccess } from '@/lib/prestige/applyUnlocks';
import { shouldAutoCollectRent, shouldAutoReinvestDividends } from '@/lib/prestige/applyQOLBonuses';
import { useGameState } from './GameStateContext';
import { useGameUI } from './GameUIContext';
import { useUIUX } from '@/contexts/UIUXContext';
import {
  GameState,
} from './types';
import { haptic } from '@/utils/haptics';
import { trackMoneyEarned, trackMoneySpent, getDefaultStatistics } from '@/lib/statistics/statisticsTracker';
import { memberUpgradeCost } from '@/lib/subscription/deepLifePlus';

interface MoneyActionsContextType {
  // Money & Economy
  updateMoney: (amount: number, reason: string, updateDailySummary?: boolean) => void;
  batchUpdateMoney: (transactions: {amount: number, reason: string}[]) => void;
  applyPerkEffects: (baseValue: number, perkType: string) => number;

  // IAP & Perks
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
  /** C-11: spend legacy points on the heir's starting position. */
  purchaseLegacyUpgrade: (upgradeId: string) => { success: boolean; message: string };
  claimLegacyContract: (contractId: string) => { success: boolean; message: string };
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
  const { setIsLoading, setLoadingProgress, setLoadingMessage } = useGameUI();
  const { showError } = useUIUX();

  // Ref keeps latest state for callbacks without adding gameState to deps.
  // This prevents callback recreation on every state change.
  const stateRef = useRef(gameState);
  useEffect(() => { stateRef.current = gameState; }, [gameState]);

  // Money & Economy Actions
  const updateMoney = useCallback((amount: number, reason: string, updateDailySummary = true) => {
    // ANTI-TRAP: reject non-finite amount before touching state. Catches the
    // "DatingActions Signature Trap" — a caller passing the lib-style
    // (setGameState, amount, reason) into this hook treats setGameState as
    // `amount`, which is a function → arithmetic produces NaN and poisons
    // money. Failing fast here surfaces the bug at the call site instead.
    if (typeof amount !== 'number' || !Number.isFinite(amount)) {
      logger.error(`[updateMoney hook] Invalid amount=${typeof amount === 'function' ? '[function]' : String(amount)} reason="${reason}". Likely Signature Trap (called with lib-style first arg).`);
      return;
    }
    const now = Date.now();
    setGameState(prevState => {
      // P1-1: reject overdraws here just like the module-form updateMoney does
      // (MoneyActions.ts). Without this, UI callers can "buy" things at $0
      // because Math.max clamps the negative result to 0 without rejecting.
      if (amount < 0 && prevState.stats.money + amount < -0.01) {
        logger.warn(
          `[updateMoney hook] Rejected purchase: insufficient funds. Has: ${prevState.stats.money}, Needs: ${Math.abs(amount)}. Reason: ${reason}`
        );
        return prevState;
      }
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
          // P1-4: only count genuine income toward "earned" — exclude bank
          // withdrawals / asset sales / loans so the daily "earn $X" gem
          // challenges can't be farmed by shuffling existing money.
          totalMoneyEarned:
            (newState.dailySummary.totalMoneyEarned || 0) + (amount > 0 && isIncomeReason(reason) ? amount : 0),
          totalMoneySpent: (newState.dailySummary.totalMoneySpent || 0) + Math.max(0, -amount),
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
    // P1-11 (C-2): classify each leg individually. Joining ALL reasons into one string
    // and testing NON_INCOME_REASON against the result is all-or-nothing — a single
    // non-income keyword (e.g. "deposit") in any leg wrongly zeroes the income credit
    // for the entire batch. Split into an income group and a non-income group so
    // `totalMoneyEarned` only ever counts genuine income. Income is applied first so it
    // can fund a same-batch non-income outflow (preserving the old net-affordability
    // behaviour for the common income-then-fee case).
    let incomeTotal = 0;
    const incomeReasons: string[] = [];
    let nonIncomeTotal = 0;
    const nonIncomeReasons: string[] = [];

    transactions.forEach(({ amount, reason }) => {
      if (isIncomeReason(reason)) {
        incomeTotal += amount;
        incomeReasons.push(reason);
      } else {
        nonIncomeTotal += amount;
        nonIncomeReasons.push(reason);
      }
    });

    // Atomicity (CR): reject the WHOLE batch up-front when the NET is unaffordable, and apply the
    // money-adding leg first — so the two updateMoney calls can never half-commit (a leg only trips
    // updateMoney's overdraft guard when the net itself overdraws, which we've already rejected).
    const currentMoney = stateRef.current?.stats?.money ?? 0;
    if (currentMoney + incomeTotal + nonIncomeTotal < -0.01) {
      logger.warn(
        `[batchUpdateMoney] Rejected: insufficient funds. Has ${currentMoney}, net ${incomeTotal + nonIncomeTotal}.`
      );
      return;
    }
    const legs: Array<{ amount: number; reason: string }> = [];
    if (incomeTotal !== 0) legs.push({ amount: incomeTotal, reason: incomeReasons.join(', ') });
    if (nonIncomeTotal !== 0) legs.push({ amount: nonIncomeTotal, reason: nonIncomeReasons.join(', ') });
    legs.sort((a, b) => b.amount - a.amount); // money-adding leg first
    for (const leg of legs) updateMoney(leg.amount, leg.reason);
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

    // Define valid upgrade IDs and their BASE gem costs (must match GemShopModal.tsx).
    // DeepLife+ members pay 20% less — the discount is applied via memberUpgradeCost
    // below so this gate and the GemShopModal price can never disagree.
    const upgradeDefinitions: Record<string, { cost: number; name: string }> = {
      multiplier: { cost: 5000, name: 'Money Multiplier' },
      energy_boost: { cost: 7500, name: 'Energy Boost' },
      happiness_boost: { cost: 6000, name: 'Happiness Boost' },
      fitness_boost: { cost: 9000, name: 'Fitness Boost' },
      skill_mastery: { cost: 15000, name: 'Skill Mastery' },
      time_machine: { cost: 25000, name: 'Time Machine' },
      immortality: { cost: 50000, name: 'Immortality' },
      tycoon: { cost: 100000, name: 'Tycoon Empire' },
      chronomaster: { cost: 150000, name: 'Chronomaster' },
    };

    const upgrade = upgradeDefinitions[upgradeId];
    if (!upgrade) {
      logger.error('Invalid upgrade ID:', upgradeId);
      showError('Invalid Upgrade', `Upgrade ${upgradeId} not found.`);
      return;
    }

    // Price this player actually pays (DeepLife+ discount applied).
    const cost = memberUpgradeCost(upgrade.cost, state.settings);

    // Check if already owned
    if (state.goldUpgrades?.[upgradeId as keyof typeof state.goldUpgrades]) {
      showError('Already Owned', `You already own ${upgrade.name}.`);
      return;
    }

    // Check if user has enough gems
    const currentGems = state.stats?.gems || 0;
    if (currentGems < cost) {
      showError('Insufficient Gems', `You need ${cost.toLocaleString()} gems to purchase ${upgrade.name}.`);
      return;
    }

    // Apply the upgrade.
    // ANTI-EXPLOIT: Re-check inside setGameState(prev =>) so two rapid clicks
    // in the SAME React batch don't both pass the pre-update gate above and
    // double-deduct gems / set the flag twice. The outer check stays for fast
    // failure + user-visible error; the inner check is the authoritative one.
    setGameState(prevState => {
      if (prevState.goldUpgrades?.[upgradeId as keyof typeof prevState.goldUpgrades]) {
        return prevState; // already owned by an earlier same-batch claim
      }
      const prevGems = prevState.stats?.gems || 0;
      // Re-price inside the updater from the freshest settings so the discount
      // can't be dodged by a mid-batch entitlement change.
      const liveCost = memberUpgradeCost(upgrade.cost, prevState.settings);
      if (prevGems < liveCost) {
        return prevState; // not enough gems (e.g. a prior same-batch upgrade drained them)
      }
      return {
        ...prevState,
        stats: {
          ...prevState.stats,
          gems: prevGems - liveCost,
        },
        goldUpgrades: {
          ...prevState.goldUpgrades,
          [upgradeId]: true,
        },
      };
    });

    logger.info('Gold upgrade purchased:', { upgradeId, name: upgrade.name, cost });
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
      /**
       * R3-M10: reject, do not floor.
       *
       * Affordability was checked against the stale `stateRef.current` and this
       * updater floored with `Math.max(0, …)` while crediting the coins
       * unconditionally — the "goods granted, money zeroed out" pattern
       * CLAUDE.md §4.4 names as the repo's most repeated bug class. Not
       * player-reachable today (the only non-test callers are `TestRunner`
       * behind the `__DEV__` devtools gate; the shipping crypto UI uses the
       * correctly-atomic `CryptoTradingActions`), but these sit on the public
       * MoneyActions context surface with no warning, so any future UI wiring
       * them would ship a money printer.
       */
      if ((prev.stats?.money ?? 0) < amount) return prev;
      const newMoney = prev.stats.money - amount;
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
      // R3-M10: re-check the holding against `prev`. Two taps on a sell-all in
      // one React batch both read the same stale `stateRef` amount and each
      // credited `saleValue` for one lot of coins.
      const prevOwned = prev.cryptos?.find(c => c.id === cryptoId)?.owned ?? 0;
      if (prevOwned < amount) return prev;
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
  /**
   * C-11: the Legacy Points sink.
   *
   * Written as a PURE reducer called twice — once against the current state
   * for the report, once against `prev` for the state — rather than capturing
   * the outcome inside the updater and reading it after. That capture is only
   * reliable for the first update in a React batch
   * (`__tests__/refactor/updaterTimingContract.test.tsx`), and it is what
   * forced the VehicleActions revert. `purchaseLegacyUpgrade` is idempotent on
   * the id, so running it twice cannot double-charge: owning the id is what
   * costs the points.
   */
  const purchaseLegacyUpgradeAction = useCallback((upgradeId: string): { success: boolean; message: string } => {
    const state = stateRef.current;
    if (!state) return { success: false, message: 'Game state not available' };

    const preview = purchaseLegacyUpgrade(state.legacyPoints, state.legacyUpgrades, upgradeId);
    if (!preview.success) return preview;

    setGameState(prev => {
      // Re-run against fresh state so a same-batch double tap cannot buy twice.
      const applied = purchaseLegacyUpgrade(prev.legacyPoints, prev.legacyUpgrades, upgradeId);
      if (!applied.success || !applied.owned) return prev;
      return { ...prev, legacyUpgrades: applied.owned };
    });

    return preview;
  }, [setGameState]);

  /**
   * Claim a completed Legacy Contract for its Legacy Points.
   *
   * Same shape as purchaseLegacyUpgradeAction: the reducer is PURE and
   * idempotent — owning the claimed id is what blocks a second run — so it is
   * safe to run once for the report and again inside the updater. The points
   * are added in the SAME updater that records the claim, so a double-tap in
   * one React batch cannot pay twice (§4.4).
   */
  const claimLegacyContractAction = useCallback((contractId: string): { success: boolean; message: string } => {
    const state = stateRef.current;
    if (!state) return { success: false, message: 'Game state not available' };

    const preview = claimContract(state, contractId);
    if (!preview.success) return preview;

    setGameState(prev => {
      const applied = claimContract(prev, contractId);
      if (!applied.success || !applied.claimedIds) return prev;
      return {
        ...prev,
        legacyContracts: { claimedIds: applied.claimedIds },
        legacyPoints: (prev.legacyPoints ?? 0) + applied.reward,
      };
    });

    return preview;
  }, [setGameState]);

  const purchasePrestigeBonus = useCallback((bonusId: string): { success: boolean; message?: string } => {
    const state = stateRef.current;
    if (!state?.prestige) {
      return { success: false, message: 'Prestige system not available' };
    }

    const bonus = PRESTIGE_BONUSES.find(b => b.id === bonusId);
    if (!bonus) {
      return { success: false, message: 'Bonus not found' };
    }
    // R4-X2. The shop no longer renders the inert automation bonuses, but this
    // action resolves from the RAW catalogue — so without this the id could
    // still be bought through a stale render, a deep link, or the next caller
    // that forgets. Refusing here is what actually stops points being spent on
    // a system with no state slice and no UI.
    if (isInertBonus(bonusId)) {
      return { success: false, message: 'That bonus is not available yet.' };
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

      // ANTI-EXPLOIT: re-validate level + cost + affordability against FRESH
      // prevState (the outer checks read the lagging stateRef snapshot). Without
      // this, two rapid taps both passed the stale guard and both applied —
      // stacking a level-capped bonus past maxLevel, buying the next level at
      // the stale (cheaper) cost, and driving prestigePoints negative.
      const freshBonuses = prevState.prestige.unlockedBonuses || [];
      if (!canPurchaseBonus(bonus, freshBonuses)) return prevState;
      const freshCost = getBonusPurchaseCost(bonus, freshBonuses);
      const freshPoints = prevState.prestige.prestigePoints || 0;
      if (freshPoints < freshCost) return prevState;

      const updatedPrestige = {
        ...prevState.prestige,
        prestigePoints: Math.max(0, freshPoints - freshCost),
        unlockedBonuses: [...freshBonuses, bonusId],
      };

      const newState: GameState = {
        ...prevState,
        prestige: updatedPrestige,
        // Stats are preserved via spread - money is not touched
      };

      logger.info('[purchasePrestigeBonus] After update:', {
        money: newState.stats.money,
        prestigePoints: newState.prestige?.prestigePoints,
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
    buyStarterPack,
    buyGoldPack,
    buyGoldUpgrade,
    buyRevival,
    buyCrypto,
    sellCrypto,
    swapCrypto,
    purchasePrestigeBonus,
    purchaseLegacyUpgrade: purchaseLegacyUpgradeAction,
    claimLegacyContract: claimLegacyContractAction,
  }), [updateMoney, batchUpdateMoney, applyPerkEffects, buyStarterPack, buyGoldPack, buyGoldUpgrade, buyRevival, buyCrypto, sellCrypto, swapCrypto, purchasePrestigeBonus, purchaseLegacyUpgradeAction, claimLegacyContractAction]);

  return (
    <MoneyActionsContext.Provider value={value}>
      {children}
    </MoneyActionsContext.Provider>
  );
}
