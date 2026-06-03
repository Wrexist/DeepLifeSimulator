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
    const energyAfter = Math.max(0, (state.stats?.energy ?? 0) - r.result.energyCost);
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
    const state = ensureDarkWeb(prev);
    if (!state.darkWeb) return prev;
    const btc = getBtcOwned(state);
    if (btc < NEW_IDENTITY_COST_BTC) {
      log.warn(`New identity rejected: need ${NEW_IDENTITY_COST_BTC} BTC, have ${btc}`);
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
    // R2-G: keep mortgage and auto loans tied to the underlying collateral
    // (the property/vehicle still exists with the new identity, so wiping the
    // debt would be a 0.5 BTC trick to clear million-dollar mortgages).
    // Personal/business loans were taken in the old name and can be dropped.
    const keptLoans = (state.loans ?? []).filter(
      (loan: { type?: string }) => loan?.type === 'mortgage' || loan?.type === 'auto'
    );
    const droppedCount = (state.loans ?? []).length - keptLoans.length;
    log.info(
      `New identity acquired. Heat → 0, buyer rep → 0, credit score → 580, ${state.darkWeb.activeJobs.length} jobs dropped, ${droppedCount} unsecured loans walked away from (${keptLoans.length} secured loans retained).`
    );
    return {
      ...setBtcOwned(state, btc - NEW_IDENTITY_COST_BTC),
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
