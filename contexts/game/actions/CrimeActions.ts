/**
 * Crime / dark-web actions — thin React-aware wrappers around lib/darkweb/operations.
 *
 * Pattern mirrors BankingActions/CryptoTradingActions: pure helpers do the
 * math, these wrappers apply the side effects (cash delta, energy delta, BTC
 * delta) via setGameState.
 */

import React from 'react';
import { GameState, DarkWebMixerTier, DarkWebSkillId } from '../types';
import { logger } from '@/utils/logger';
import { initialGameState } from '../initialState';
import {
  attemptJobStage,
  attemptPurchase,
  startJob as startJobPure,
  submitToMixer,
  withdrawCleanBtc,
} from '@/lib/darkweb/operations';

const log = logger.scope('CrimeActions');

function ensureDarkWeb(state: GameState): GameState {
  if (state.darkWeb) return state;
  return { ...state, darkWeb: initialGameState.darkWeb };
}

function getBtcOwned(state: GameState): number {
  const btc = state.cryptos.find((c) => c.id === 'btc');
  return btc?.owned ?? 0;
}

function setBtcOwned(state: GameState, owned: number): GameState {
  return {
    ...state,
    cryptos: state.cryptos.map((c) =>
      c.id === 'btc' ? { ...c, owned: Math.max(0, owned) } : c
    ),
  };
}

// ---------------------------------------------------------------------------
// Marketplace
// ---------------------------------------------------------------------------

/**
 * Buy a listing. Cost is debited from the player's BTC holdings. A scam
 * outcome still debits the BTC (you paid the vendor) but you don't get anything.
 */
export const buyMarketListing = (
  setGameState: React.Dispatch<React.SetStateAction<GameState>>,
  listingId: string
) => {
  // P1-2: pre-roll outside the updater — React 19 StrictMode runs the updater
  // twice in dev; rolling Math.random() inside would produce a different
  // outcome on each invocation.
  const purchaseRoll = Math.random();
  setGameState((prev) => {
    if (prev.showDeathPopup) return prev; // E-2: no transactions once the player is dead.
    const state = ensureDarkWeb(prev);
    if (!state.darkWeb) return prev;
    const listing = state.darkWeb.listings.find((l) => l.id === listingId);
    if (!listing) {
      log.warn(`Purchase failed: listing ${listingId} not found`);
      return prev;
    }
    const btc = getBtcOwned(state);
    if (btc < listing.costBtc) {
      log.warn(`Purchase failed: need ${listing.costBtc} BTC, have ${btc}`);
      return prev;
    }
    const result = attemptPurchase(state.darkWeb, listingId, purchaseRoll);
    if (!result.ok) {
      log.warn(`Purchase failed: ${result.reason}`);
      return prev;
    }
    const stateAfterBtc = setBtcOwned(state, btc - result.result.spentBtc);
    return { ...stateAfterBtc, darkWeb: result.result.dw };
  });
};

// ---------------------------------------------------------------------------
// Jobs
// ---------------------------------------------------------------------------

/** Start a new dark-web job. Adds to activeJobs if eligible. */
export const beginDarkWebJob = (
  setGameState: React.Dispatch<React.SetStateAction<GameState>>,
  templateId: string
) => {
  setGameState((prev) => {
    const state = ensureDarkWeb(prev);
    if (!state.darkWeb) return prev;
    const r = startJobPure(state.darkWeb, templateId, state.weeksLived);
    if (!r.ok) {
      log.info(`Cannot start job: ${r.reason}`);
      return prev;
    }
    return { ...state, darkWeb: r.dw };
  });
};

/**
 * Run the current stage of a job. Deducts energy on attempt; on completion,
 * the BTC payout lands in the dirty wallet (the player still has to launder it).
 */
export const runJobStage = (
  setGameState: React.Dispatch<React.SetStateAction<GameState>>,
  jobId: string
) => {
  // P1-2: pre-roll outside the updater (see buyMarketListing for rationale).
  const stageRoll = Math.random();
  setGameState((prev) => {
    const state = ensureDarkWeb(prev);
    if (!state.darkWeb) return prev;
    const r = attemptJobStage(state.darkWeb, jobId, stageRoll, state.weeksLived);
    if (!r.ok) {
      log.warn(`Stage attempt failed: ${r.reason}`);
      return prev;
    }
    // BUGFIX: gate on energy. Previously the cost was only subtracted (floored at
    // 0) AFTER the attempt, so a player at 0 energy could spam Run Stage for free.
    // attemptJobStage is pure (no state mutation), so bailing here is safe.
    const energy = state.stats?.energy ?? 0;
    if (energy < r.result.energyCost) {
      log.info(`Stage attempt blocked: need ${r.result.energyCost} energy, have ${Math.round(energy)}`);
      return prev;
    }
    const energyAfter = Math.max(0, energy - r.result.energyCost);
    return {
      ...state,
      stats: { ...state.stats, energy: energyAfter },
      darkWeb: r.result.dw,
    };
  });
};

// ---------------------------------------------------------------------------
// Laundering
// ---------------------------------------------------------------------------

/**
 * Count laundering fronts the player has access to.
 *
 *   - Companies: restaurants (cash-heavy) + banks (financial pipes) each contribute one.
 *   - Real estate: commercial-mode properties explicitly flagged as fronts each contribute one.
 *
 * Capped downstream at 4 fronts. Each front cuts mixer fee 0.5% and shortens delay by 1 week.
 */
export function countLaunderingFronts(state: GameState): number {
  const companies = state.companies ?? [];
  const companyFronts = companies.filter((c: any) => c?.type === 'restaurant' || c?.type === 'bank').length;
  const realEstate = state.realEstate ?? [];
  const realEstateFronts = realEstate.filter(
    (p) => p.owned && p.rentMode === 'commercial' && p.launderingFront === true
  ).length;
  return companyFronts + realEstateFronts;
}

export const submitMixerTransaction = (
  setGameState: React.Dispatch<React.SetStateAction<GameState>>,
  tier: DarkWebMixerTier,
  amountBtc: number
) => {
  setGameState((prev) => {
    if (prev.showDeathPopup) return prev; // E-2: no transactions once the player is dead.
    const state = ensureDarkWeb(prev);
    if (!state.darkWeb) return prev;
    const frontCount = countLaunderingFronts(state);
    const r = submitToMixer(state.darkWeb, tier, amountBtc, state.weeksLived, frontCount);
    if (!r.ok) {
      log.warn(`Mixer rejected: ${r.reason}`);
      return prev;
    }
    return { ...state, darkWeb: r.dw };
  });
};

/**
 * Move clean BTC from the dark-web wallet into the regular crypto holdings.
 * Caller normally restricts this to coins the player can then sell legitimately.
 */
export const cashOutCleanBtc = (
  setGameState: React.Dispatch<React.SetStateAction<GameState>>,
  amountBtc: number
) => {
  setGameState((prev) => {
    if (prev.showDeathPopup) return prev; // E-2: no transactions once the player is dead.
    const state = ensureDarkWeb(prev);
    if (!state.darkWeb) return prev;
    const r = withdrawCleanBtc(state.darkWeb, amountBtc);
    if (!r.ok) {
      log.warn(`Clean BTC withdrawal rejected: ${r.reason}`);
      return prev;
    }
    const btc = getBtcOwned(state);
    const stateAfter = setBtcOwned(state, btc + r.movedBtc);
    return { ...stateAfter, darkWeb: r.dw };
  });
};

// ---------------------------------------------------------------------------
// New identity — late-game reset
// ---------------------------------------------------------------------------

/** Price in BTC for a fresh identity package. Tuned high enough that this is a real choice. */
export const NEW_IDENTITY_COST_BTC = 0.5;

/**
 * Acquire a new identity. Trade-off:
 *   - Heat resets to 0.
 *   - Active jobs are dropped (can't carry them across personas).
 *   - Buyer reputation resets (you're a stranger again).
 *   - Credit score resets to a thin-file 580 + history cleared.
 *   - Open loans + credit cards close (old identity owed them, not you).
 *   - Costs NEW_IDENTITY_COST_BTC from your regular BTC wallet.
 */
export const acquireNewIdentity = (
  setGameState: React.Dispatch<React.SetStateAction<GameState>>
) => {
  setGameState((prev) => {
    if (prev.showDeathPopup) return prev; // E-2: no transactions once the player is dead.
    const state = ensureDarkWeb(prev);
    if (!state.darkWeb) return prev;
    const btc = getBtcOwned(state);

    // R2-G keeps mortgage/auto loans (still tied to collateral); personal/business
    // loans taken under the old name are discharged. EXPLOIT FIX (M-1): that used
    // to cost a flat 0.5 BTC, so maxing out unsecured loans, spending the cash,
    // and buying a new identity wiped the debt for almost nothing — repeatable
    // free money. Charge a settlement fee proportional to the discharged unsecured
    // principal (in BTC), so walking away from debt costs nearly as much as
    // repaying it. The base cost still covers a heat/rep reset when you owe little.
    const keptLoans = (state.loans ?? []).filter(
      (loan: { type?: string }) => loan?.type === 'mortgage' || loan?.type === 'auto'
    );
    const droppedLoans = (state.loans ?? []).filter(
      (loan: { type?: string }) => loan?.type !== 'mortgage' && loan?.type !== 'auto'
    );
    const dischargedPrincipal = droppedLoans.reduce((sum, l: { remaining?: number }) => {
      const r = typeof l?.remaining === 'number' && isFinite(l.remaining) ? Math.max(0, l.remaining) : 0;
      return sum + r;
    }, 0);
    const btcPrice = state.cryptos.find((c) => c.id === 'btc')?.price ?? 0;
    const DISCHARGE_FEE_RATE = 0.8; // pay 80% of walked-away debt in BTC
    const settlementFeeBtc = btcPrice > 0 ? (dischargedPrincipal * DISCHARGE_FEE_RATE) / btcPrice : 0;
    const totalCostBtc = NEW_IDENTITY_COST_BTC + settlementFeeBtc;

    if (btc < totalCostBtc) {
      log.warn(
        `New identity rejected: need ${totalCostBtc.toFixed(4)} BTC ` +
          `(base ${NEW_IDENTITY_COST_BTC} + ${settlementFeeBtc.toFixed(4)} debt settlement), have ${btc}`
      );
      return prev;
    }
    const newDarkWeb = {
      ...state.darkWeb,
      heat: 0,
      playerReputation: 0,
      activeJobs: [],
    };
    const newBanking = state.banking
      ? {
          ...state.banking,
          creditCards: [], // closed with the old identity
          creditScore: {
            ...state.banking.creditScore,
            score: 580,
            band: 'fair' as const,
            componentBreakdown: {
              paymentHistory: 50,
              utilization: 100, // no cards = clean utilization
              accountAge: 0,
              creditMix: 10,
              inquiries: 100,
            },
            history: [],
            inquiries: [],
            lastUpdatedWeek: state.weeksLived,
          },
        }
      : state.banking;
    log.info(
      `New identity acquired for ${totalCostBtc.toFixed(4)} BTC. Heat → 0, buyer rep → 0, credit score → 580, ${state.darkWeb.activeJobs.length} jobs dropped, ${droppedLoans.length} unsecured loans walked away from (${keptLoans.length} secured loans retained).`
    );
    return {
      ...setBtcOwned(state, btc - totalCostBtc),
      darkWeb: newDarkWeb,
      banking: newBanking,
      loans: keptLoans,
    };
  });
};

// ---------------------------------------------------------------------------
// Skill display helper — exported for the UI to look up current skill level
// without re-importing from lib.
// ---------------------------------------------------------------------------

export function getDarkWebSkillLevel(state: GameState, id: DarkWebSkillId): number {
  return state.darkWeb?.skills?.[id]?.level ?? 1;
}
