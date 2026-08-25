import React, { createContext, useContext, useCallback, ReactNode, useMemo } from 'react';
import { Alert, Platform } from 'react-native';
import { simulateWeek, getStockInfo } from '@/lib/economy/stockMarket';
import { MAX_ACTIVE_RELATIONSHIPS, MAX_RELATIONSHIP_INCOME, MAX_RELATIONSHIPS_FOR_INCOME } from '@/lib/economy/balanceConstants';
import { validateStats, clampStatByKey } from '@/utils/statUtils';
import { logger } from '@/utils/logger';
import { isIncomeReason, MONEY_CEILING } from './actions/MoneyActions';
import { getBonusPurchaseCost, canPurchaseBonus, isInertBonus, PRESTIGE_BONUSES } from '@/lib/prestige/prestigeBonuses';
import { purchaseLegacyUpgrade } from '@/lib/legacy/legacyShop';
import { claimContract } from '@/lib/legacy/contracts';
import { storeInVault, removeFromVault } from '@/lib/dynasty/vault';
import { claimEndowment } from '@/lib/dynasty/endowment';
import { addPendingTrial, removePendingTrial } from '@/lib/dynasty/trials';
import { buySeatWing } from '@/lib/dynasty/seat';
import { validateMoneyInvariants } from '@/utils/stateInvariants';
import { applyUnlockBonuses, hasEarlyCareerAccess } from '@/lib/prestige/applyUnlocks';
import { shouldAutoReinvestDividends } from '@/lib/prestige/applyQOLBonuses';
import { useSetGameState, useGameStateGetter } from './useGameSelector';
import { useGameUI } from './GameUIContext';
import { useUIUX } from '@/contexts/UIUXContext';
import {
  GameState,
} from './types';
import { haptic } from '@/utils/haptics';
import { trackMoneyEarned, trackMoneySpent, getDefaultStatistics } from '@/lib/statistics/statisticsTracker';
import { memberUpgradeCost } from '@/lib/subscription/deepLifePlus';
import { getGemUpgrade } from '@/lib/config/gemUpgrades';

interface MoneyActionsContextType {
  // Money & Economy
  updateMoney: (amount: number, reason: string, updateDailySummary?: boolean) => void;
  batchUpdateMoney: (transactions: {amount: number, reason: string}[]) => void;

  // IAP & Perks
  /** Returns true only when the purchase was actually applied (M8). */
  buyGoldUpgrade: (upgradeId: string) => boolean;

  // Crypto
  buyCrypto: (cryptoId: string, amount: number) => void;
  sellCrypto: (cryptoId: string, amount: number) => void;
  swapCrypto: (fromCryptoId: string, toCryptoId: string, amount: number) => void;

  // Prestige
  purchasePrestigeBonus: (bonusId: string) => { success: boolean; message?: string };
  /** C-11: spend legacy points on the heir's starting position. */
  purchaseLegacyUpgrade: (upgradeId: string) => { success: boolean; message: string };
  claimLegacyContract: (contractId: string) => { success: boolean; message: string };

  // The Dynasty - prestige tiers 2-5. All five share one shape: a PURE reducer
  // in `lib/dynasty/` run once for the report and again inside the updater, so
  // a double-tap in one React batch cannot pay twice (§4.4).
  /** Tier 2 - preserve a luxury piece across death, for a fee. */
  storeInDynastyVault: (itemId: string) => { success: boolean; message: string };
  removeFromDynastyVault: (itemId: string) => { success: boolean; message: string };
  /** Tier 3 - convert money into Legacy Points, once per tranche, forever. */
  claimDynastyEndowment: (trancheId: string) => { success: boolean; message: string };
  /** Tier 4 - swear (or withdraw) a handicap for the next life. */
  swearDynastyTrial: (trialId: string) => { success: boolean; message: string };
  withdrawDynastyTrial: (trialId: string) => { success: boolean; message: string };
  /** Tier 5 - build a wing of the Dynasty Seat. */
  buyDynastySeatWing: (wingId: string) => { success: boolean; message: string };
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
  const setGameState = useSetGameState();
  const { setIsLoading, setLoadingProgress, setLoadingMessage } = useGameUI();
  const { showError } = useUIUX();

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

  // Money & Economy Actions
  const updateMoney = useCallback((amount: number, reason: string, updateDailySummary = true) => {
    // ANTI-TRAP: reject non-finite amount before touching state. Catches the
    // "DatingActions Signature Trap" - a caller passing the lib-style
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
          // P1-4: only count genuine income toward "earned" - exclude bank
          // withdrawals / asset sales / loans so the daily "earn $X" gem
          // challenges can't be farmed by shuffling existing money.
          totalMoneyEarned:
            (newState.dailySummary.totalMoneyEarned || 0) + (amount > 0 && isIncomeReason(reason) ? amount : 0),
          totalMoneySpent: (newState.dailySummary.totalMoneySpent || 0) + Math.max(0, -amount),
        };
      }

      // Track statistics. Positive deltas count toward lifetime EARNED only for
      // genuine income (same isIncomeReason gate the dailySummary line above
      // uses) - a withdrawal / asset sale / loan is existing money moving, and
      // `totalMoneyEarned` feeds Chapter 1's "Earn $X" goal and the Legacy
      // Contract metrics, so shuffling money must not tick them (2026-08-25
      // economy audit; the P1-4 dailySummary fix half-landed and left this
      // sibling counting every positive delta).
      const currentStats = prevState.lifetimeStatistics || getDefaultStatistics();
      let updatedStats = currentStats;

      if (amount > 0 && isIncomeReason(reason)) {
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
    // and testing NON_INCOME_REASON against the result is all-or-nothing - a single
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
    // money-adding leg first - so the two updateMoney calls can never half-commit (a leg only trips
    // updateMoney's overdraft guard when the net itself overdraws, which we've already rejected).
    const currentMoney = getGameState()?.stats?.money ?? 0;
    if (currentMoney + incomeTotal + nonIncomeTotal < -0.01) {
      logger.warn(
        `[batchUpdateMoney] Rejected: insufficient funds. Has ${currentMoney}, net ${incomeTotal + nonIncomeTotal}.`
      );
      return;
    }
    const legs: { amount: number; reason: string }[] = [];
    if (incomeTotal !== 0) legs.push({ amount: incomeTotal, reason: incomeReasons.join(', ') });
    if (nonIncomeTotal !== 0) legs.push({ amount: nonIncomeTotal, reason: nonIncomeReasons.join(', ') });
    legs.sort((a, b) => b.amount - a.amount); // money-adding leg first
    for (const leg of legs) updateMoney(leg.amount, leg.reason);
  }, [updateMoney]);

  /*
   * DELETED 2026-08-23: `applyPerkEffects`. It branched on
   * `goldUpgrades.work_boost` / `.fast_learner` / `.mindset` - three ids that
   * exist in no catalogue and that nothing ever writes - and it had ZERO call
   * sites: the perks it appeared to wire are actually consumed in
   * `weeklySalary.ts`, `applyCareerProgress`, `applyEducationProgression` and
   * `applyIncome`. A plausible-looking second wiring for effects the first
   * wiring already applies is exactly how double-application bugs start.
   * `buyStarterPack` / `buyGoldPack` / `buyRevival` went with it: log-only
   * stubs named after three real SKUs (the real grants flow through
   * `IAPService.applyProductBenefitsToState`), so a future caller wiring a
   * purchase button to one would ship a paid no-op.
   */

  /**
   * Buy a gem upgrade. Returns TRUE only when the purchase was actually applied.
   *
   * M8: this used to return `void`, so `GemShopModal` alerted "Purchase
   * Successful" for every tap - including a tap it had just refused for an
   * invalid id, an already-owned upgrade, or too few gems. No gems were ever
   * lost (the updater below is atomic and re-checks against `prev`), but the
   * player was told a paid-currency purchase landed when it had not.
   *
   * The result is reported from a PREVIEW of the same pure decision function
   * on the committed snapshot - never from a variable assigned inside the
   * updater, which CLAUDE.md §4.1 says is not reliably visible outside it.
   * Same shape as `SkillTreeModal.commitUnlock`. Residual, and identical to
   * that reference: two taps in ONE React batch both preview against the same
   * pre-batch snapshot, so the second reports success while the updater
   * correctly refuses it. The authority remains the updater - nothing is
   * double-charged.
   */
  const buyGoldUpgrade = useCallback((upgradeId: string): boolean => {
    /** Pure: can this state buy this upgrade, and if not, why not? */
    const decide = (state: GameState | null | undefined) => {
      const upgrade = getGemUpgrade(upgradeId);
      if (!upgrade) {
        return { ok: false as const, title: 'Invalid Upgrade', message: `Upgrade ${upgradeId} not found.` };
      }
      if (!state) {
        return { ok: false as const, title: 'Not Ready', message: 'Your game is still loading. Try again in a moment.' };
      }
      if (state.goldUpgrades?.[upgradeId]) {
        return { ok: false as const, title: 'Already Owned', message: `You already own ${upgrade.name}.` };
      }
      // Price this player actually pays (DeepLife+ discount applied), re-derived
      // from whichever state we are deciding against so the discount can't be
      // dodged by a mid-batch entitlement change.
      const cost = memberUpgradeCost(upgrade.cost, state.settings);
      if ((state.stats?.gems || 0) < cost) {
        return {
          ok: false as const,
          title: 'Insufficient Gems',
          message: `You need ${cost.toLocaleString()} gems to purchase ${upgrade.name}.`,
        };
      }
      return { ok: true as const, upgrade, cost };
    };

    const preview = decide(getGameState());
    if (!preview.ok) {
      if (!getGemUpgrade(upgradeId)) logger.error('Invalid upgrade ID:', upgradeId);
      showError(preview.title, preview.message);
      return false;
    }

    // ANTI-EXPLOIT: re-decide against `prev` so two rapid clicks in the SAME
    // React batch don't both pass the preview above and double-deduct gems /
    // set the flag twice. The preview is for the UI; THIS is the authority.
    setGameState(prevState => {
      const verdict = decide(prevState);
      if (!verdict.ok) return prevState;
      return {
        ...prevState,
        stats: {
          ...prevState.stats,
          gems: (prevState.stats?.gems || 0) - verdict.cost,
        },
        goldUpgrades: {
          ...prevState.goldUpgrades,
          [upgradeId]: true,
        },
      };
    });

    logger.info('Gold upgrade purchased:', { upgradeId, name: preview.upgrade.name, cost: preview.cost });
    return true;
  }, [setGameState, showError, getGameState]);

  // Crypto Actions
  const buyCrypto = useCallback((cryptoId: string, amount: number) => {
    const state = getGameState();
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
       * Affordability was checked against the stale `getGameState()` and this
       * updater floored with `Math.max(0, …)` while crediting the coins
       * unconditionally - the "goods granted, money zeroed out" pattern
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
    const state = getGameState();
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
      // Clamp the credit like every other money path (`updateMoney` /
      // `applyMoneyDelta` / `batchUpdateMoney` all cap at MONEY_CEILING). This
      // line wrote `prev.stats.money + saleValue` raw, so a large enough sale
      // could push the balance past Number.MAX_SAFE_INTEGER, where integer
      // arithmetic stops being exact and later debits silently no-op.
      const newMoney = Math.min(MONEY_CEILING, prev.stats.money + saleValue);
      // A sale converts an existing asset to cash - NOT lifetime income
      // (isIncomeReason excludes "sold"); the shipping crypto UI's path
      // (CryptoTradingActions → applyMoneyDelta 'Sold …') never counted it,
      // so this dev-only path must not either (2026-08-25 economy audit).
      const updatedStats = prev.lifetimeStatistics || getDefaultStatistics();

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
    const state = getGameState();
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
    setGameState(prev => {
      /**
       * R3-M10: reject, do not floor.
       *
       * Ownership was checked against the stale `getGameState()` and this
       * updater floored the debit with `Math.max(0, …)` while crediting
       * `toAmount` unconditionally - the gate → grant shape CLAUDE.md §4.4
       * names as the repo's most repeated bug class, here as a straight COIN
       * DUPLICATOR: two swaps in one React batch could only take the holding
       * once (the floor absorbs the rest) but paid out the destination coin
       * twice.
       *
       * Not player-reachable today (the only non-test callers are `TestRunner`
       * behind the `__DEV__` devtools gate; the shipping crypto UI uses the
       * correctly-atomic `CryptoTradingActions`), but these sit on the public
       * MoneyActions context surface with no warning, so any future UI wiring
       * them would ship a coin printer.
       *
       * The destination amount is re-derived from `prev` so the swap rate is
       * the one the committed state actually pays for.
       */
      const prevFrom = prev.cryptos?.find(c => c.id === fromCryptoId);
      const prevTo = prev.cryptos?.find(c => c.id === toCryptoId);
      if (!prevFrom || !prevTo) return prev;
      if ((prevFrom.owned || 0) < amount) return prev;

      const prevFromValue = amount * prevFrom.price;
      const prevToAmount = prevFromValue / prevTo.price;
      if (!isFinite(prevFromValue) || !isFinite(prevToAmount) || prevFromValue <= 0 || prevToAmount <= 0) {
        return prev;
      }

      return {
        ...prev,
        cryptos: prev.cryptos?.map(c => {
          if (c.id === fromCryptoId) {
            return { ...c, owned: (c.owned || 0) - amount };
          } else if (c.id === toCryptoId) {
            return { ...c, owned: (c.owned || 0) + prevToAmount };
          }
          return c;
        }) || prev.cryptos,
      };
    });

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
   * Written as a PURE reducer called twice - once against the current state
   * for the report, once against `prev` for the state - rather than capturing
   * the outcome inside the updater and reading it after. That capture is only
   * reliable for the first update in a React batch
   * (`__tests__/refactor/updaterTimingContract.test.tsx`), and it is what
   * forced the VehicleActions revert. `purchaseLegacyUpgrade` is idempotent on
   * the id, so running it twice cannot double-charge: owning the id is what
   * costs the points.
   */
  const purchaseLegacyUpgradeAction = useCallback((upgradeId: string): { success: boolean; message: string } => {
    const state = getGameState();
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
   * idempotent - owning the claimed id is what blocks a second run - so it is
   * safe to run once for the report and again inside the updater. The points
   * are added in the SAME updater that records the claim, so a double-tap in
   * one React batch cannot pay twice (§4.4).
   */
  const claimLegacyContractAction = useCallback((contractId: string): { success: boolean; message: string } => {
    const state = getGameState();
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

  // ── The Dynasty: prestige tiers 2-5 ────────────────────────────────────────
  //
  // Five actions, one shape, copied deliberately from
  // `purchaseLegacyUpgradeAction` above: the reducer in `lib/dynasty/` is PURE
  // and idempotent on its id, so it is run once against `getGameState()` for
  // the caller's report and again against `prev` inside the updater. Where
  // money is involved the debit lands in the SAME updater that records the
  // purchase, and the reducer re-checks affordability against `prev`, so a
  // double-tap inside one React batch cannot pay twice or grant twice (§4.4).
  //
  // Each reducer also re-checks its own prestige-tier gate, so no caller - a
  // deep link, a devtool, a future screen - can reach a capability the save has
  // not earned.

  /** Tier 2 - preserve a luxury piece across death, for a preservation fee. */
  const storeInDynastyVaultAction = useCallback((itemId: string): { success: boolean; message: string } => {
    const state = getGameState();
    if (!state) return { success: false, message: 'Game state not available' };

    const preview = storeInVault(state, itemId);
    if (!preview.success) return preview;

    setGameState(prev => {
      const applied = storeInVault(prev, itemId);
      if (!applied.success || !applied.dynasty) return prev;
      const currentStats = prev.lifetimeStatistics || getDefaultStatistics();
      return {
        ...prev,
        stats: { ...prev.stats, money: (prev.stats?.money ?? 0) - applied.cost },
        dynasty: applied.dynasty,
        lifetimeStatistics: trackMoneySpent(currentStats, -applied.cost),
      };
    });

    return preview;
  }, [setGameState]);

  const removeFromDynastyVaultAction = useCallback((itemId: string): { success: boolean; message: string } => {
    const state = getGameState();
    if (!state) return { success: false, message: 'Game state not available' };

    const preview = removeFromVault(state, itemId);
    if (!preview.success) return preview;

    setGameState(prev => {
      const applied = removeFromVault(prev, itemId);
      if (!applied.success || !applied.dynasty) return prev;
      return { ...prev, dynasty: applied.dynasty };
    });

    return preview;
  }, [setGameState]);

  /** Tier 3 - money into Legacy Points, once per tranche, forever. */
  const claimDynastyEndowmentAction = useCallback((trancheId: string): { success: boolean; message: string } => {
    const state = getGameState();
    if (!state) return { success: false, message: 'Game state not available' };

    const preview = claimEndowment(state, trancheId);
    if (!preview.success) return preview;

    setGameState(prev => {
      const applied = claimEndowment(prev, trancheId);
      if (!applied.success || !applied.dynasty) return prev;
      const currentStats = prev.lifetimeStatistics || getDefaultStatistics();
      return {
        ...prev,
        stats: { ...prev.stats, money: (prev.stats?.money ?? 0) - applied.cost },
        dynasty: applied.dynasty,
        legacyPoints: (prev.legacyPoints ?? 0) + applied.points,
        lifetimeStatistics: trackMoneySpent(currentStats, -applied.cost),
      };
    });

    return preview;
  }, [setGameState]);

  /** Tier 4 - swear a handicap for the next life. Costs nothing until it starts. */
  const swearDynastyTrialAction = useCallback((trialId: string): { success: boolean; message: string } => {
    const state = getGameState();
    if (!state) return { success: false, message: 'Game state not available' };

    const preview = addPendingTrial(state, trialId);
    if (!preview.success) return preview;

    setGameState(prev => {
      const applied = addPendingTrial(prev, trialId);
      if (!applied.success || !applied.dynasty) return prev;
      return { ...prev, dynasty: applied.dynasty };
    });

    return preview;
  }, [setGameState]);

  const withdrawDynastyTrialAction = useCallback((trialId: string): { success: boolean; message: string } => {
    const state = getGameState();
    if (!state) return { success: false, message: 'Game state not available' };

    const preview = removePendingTrial(state, trialId);
    if (!preview.success) return preview;

    setGameState(prev => {
      const applied = removePendingTrial(prev, trialId);
      if (!applied.success || !applied.dynasty) return prev;
      return { ...prev, dynasty: applied.dynasty };
    });

    return preview;
  }, [setGameState]);

  /** Tier 5 - build a wing of the Dynasty Seat. The one thing money outlives. */
  const buyDynastySeatWingAction = useCallback((wingId: string): { success: boolean; message: string } => {
    const state = getGameState();
    if (!state) return { success: false, message: 'Game state not available' };

    const preview = buySeatWing(state, wingId);
    if (!preview.success) return preview;

    setGameState(prev => {
      const applied = buySeatWing(prev, wingId);
      if (!applied.success || !applied.dynasty) return prev;
      const currentStats = prev.lifetimeStatistics || getDefaultStatistics();
      return {
        ...prev,
        stats: { ...prev.stats, money: (prev.stats?.money ?? 0) - applied.cost },
        dynasty: applied.dynasty,
        lifetimeStatistics: trackMoneySpent(currentStats, -applied.cost),
      };
    });

    return preview;
  }, [setGameState]);

  const purchasePrestigeBonus = useCallback((bonusId: string): { success: boolean; message?: string } => {
    const state = getGameState();
    if (!state?.prestige) {
      return { success: false, message: 'Prestige system not available' };
    }

    const bonus = PRESTIGE_BONUSES.find(b => b.id === bonusId);
    if (!bonus) {
      return { success: false, message: 'Bonus not found' };
    }
    // R4-X2. The shop no longer renders the inert automation bonuses, but this
    // action resolves from the RAW catalogue - so without this the id could
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
      // this, two rapid taps both passed the stale guard and both applied -
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
    buyGoldUpgrade,
    buyCrypto,
    sellCrypto,
    swapCrypto,
    purchasePrestigeBonus,
    purchaseLegacyUpgrade: purchaseLegacyUpgradeAction,
    claimLegacyContract: claimLegacyContractAction,
    storeInDynastyVault: storeInDynastyVaultAction,
    removeFromDynastyVault: removeFromDynastyVaultAction,
    claimDynastyEndowment: claimDynastyEndowmentAction,
    swearDynastyTrial: swearDynastyTrialAction,
    withdrawDynastyTrial: withdrawDynastyTrialAction,
    buyDynastySeatWing: buyDynastySeatWingAction,
  }), [updateMoney, batchUpdateMoney, buyGoldUpgrade, buyCrypto, sellCrypto, swapCrypto, purchasePrestigeBonus, purchaseLegacyUpgradeAction, claimLegacyContractAction, storeInDynastyVaultAction, removeFromDynastyVaultAction, claimDynastyEndowmentAction, swearDynastyTrialAction, withdrawDynastyTrialAction, buyDynastySeatWingAction]);

  return (
    <MoneyActionsContext.Provider value={value}>
      {children}
    </MoneyActionsContext.Provider>
  );
}
