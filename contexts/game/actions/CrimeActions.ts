/**
 * Crime / dark-web actions — thin React-aware wrappers around lib/darkweb/operations.
 *
 * Pattern mirrors BankingActions/CryptoTradingActions: pure helpers do the
 * math, these wrappers apply the side effects (cash delta, energy delta, BTC
 * delta) via setGameState.
 */

import React from 'react';
import { GameState, DarkWebMixerTier } from '../types';
import { logger } from '@/utils/logger';
import { listingItemId } from '@/lib/darkweb/marketplace';
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
  currentState: GameState,
  setGameState: React.Dispatch<React.SetStateAction<GameState>>,
  listingId: string
): { success: boolean; outcome?: 'success' | 'scam'; message: string } => {
  // P1-2: pre-roll outside the updater — React 19 StrictMode runs the updater
  // twice in dev; rolling Math.random() inside would produce a different
  // outcome on each invocation.
  const purchaseRoll = Math.random();

  // E-2: no transactions once the player is dead — reject in the pre-check so
  // setGameState is never even called (the updater keeps its own guard too).
  if (currentState.showDeathPopup) {
    return { success: false, message: 'Unavailable right now.' };
  }

  // Evaluate on the caller's snapshot so the outcome can be reported to the
  // UI (same pattern as runJobStage below) — a scam debits the full cost and
  // grants nothing, which used to happen with zero feedback.
  const snapshot = ensureDarkWeb(currentState);
  if (!snapshot.darkWeb) return { success: false, message: 'Dark web is unavailable.' };
  const snapListing = snapshot.darkWeb.listings.find((l) => l.id === listingId);
  if (!snapListing) return { success: false, message: 'Listing is no longer available.' };
  if (getBtcOwned(snapshot) < snapListing.costBtc) {
    return { success: false, message: `You need ${snapListing.costBtc.toFixed(4)} ₿ for this.` };
  }
  // A listing that would deliver something you already own is refused BEFORE any
  // BTC moves. Without this the purchase succeeds, charges full price and grants
  // nothing - which is the "piece of candy" complaint reappearing in a new place.
  const snapItemId = listingItemId(snapListing);
  if (snapItemId && (snapshot.darkWebItems || []).find((it) => it?.id === snapItemId)?.owned) {
    return { success: false, message: `You already own this.` };
  }
  const preview = attemptPurchase(snapshot.darkWeb, listingId, purchaseRoll);
  if (!preview.ok) return { success: false, message: preview.reason };

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

    /**
     * R3-C1 + R3-C10: a successful gear purchase actually DELIVERS something.
     *
     * Two findings closed by one wiring.
     *
     * C10: `attemptPurchase` removed the listing, moved reputation, added heat
     * and (pro/elite only) awarded opsec XP - but `DarkWebState` has no
     * purchased-items collection and nothing wrote the bought title anywhere,
     * while the caller still reported "Delivered. <title> is yours." On a
     * common-tier listing, which carries no `xpReward`, a successful purchase
     * yielded exactly +1 buyer rep and +2 heat for real BTC.
     *
     * C1: 18 of the 19 illegal street jobs gate on `darkWebRequirements` items
     * whose ONLY writer is `buyDarkWebItem` - a function with zero call sites
     * anywhere in the app. The `items` catalogue cannot cover them either
     * (it is guitar/bike/smartphone/computer/suit/bed/gym/passport). So the
     * entire illegal-crime ladder was permanently greyed out and `criminalXp`
     * could only come from the one unlocked job plus jail activities. The
     * repo's own stress test already worked around it by filtering to jobs with
     * no requirements.
     *
     * Gear and hacking-tool listings deliver the item the LISTING names, resolved
     * through `listingItemId` / `LISTING_TITLE_TO_ITEM_ID` in
     * `lib/darkweb/marketplace.ts`. (An earlier pass granted "the next unowned
     * entry in catalogue order", which delivered *an* item but never *the* item -
     * buying "Night Vision" handed over a "Special USB".) The other listing
     * categories - stolen accounts, carded items, fake IDs, services, data -
     * remain the pure reputation/heat plays they already are.
     */
    const deliveredId = listingItemId(listing);
    if (result.result.outcome === 'success' && deliveredId) {
      const items = stateAfterBtc.darkWebItems || [];
      const idx = items.findIndex((it) => it?.id === deliveredId);
      /**
       * ABORT, don't fall through.
       *
       * Already-owned is normally refused by the snapshot pre-check above, but
       * that reads the caller's `gameState`, so it cannot see a second tap
       * landing in the same React batch - which is the case this re-check exists
       * for. Falling through to the generic return would commit the BTC debit
       * and consume the listing while granting nothing: precisely the
       * "charged full price, got nothing" defect this whole block removes.
       */
      if (idx === -1 || items[idx]?.owned) return prev;
      const nextItems = [...items];
      nextItems[idx] = { ...nextItems[idx], owned: true };
      return { ...stateAfterBtc, darkWebItems: nextItems, darkWeb: result.result.dw };
    }

    return { ...stateAfterBtc, darkWeb: result.result.dw };
  });

  /**
   * Say what actually happened.
   *
   * This used to read "Delivered. <title> is yours." for EVERY category, but
   * only `gear` and `hackingTools` put anything in your inventory. The other
   * five - stolen accounts, carded items, fake IDs, services, data - move buyer
   * reputation and heat and nothing else, so the player was told they owned a
   * "New Identity Kit" that no system had ever heard of. That mismatch is what
   * a bug report looks like from the outside.
   *
   * Those five stay reputation/heat plays for now; giving them real payloads is
   * economy design, not a copy fix. The copy stops lying either way.
   *
   * Kept as a ternary rather than an early return purely to hold the diff to the
   * message text. Rewriting it as `if (scam) return …; return …;` changes
   * nothing behaviourally but newly exposes this function to the C-9 detector in
   * `__tests__/refactor/updaterResultRatchet.test.ts`, whose regex cannot see a
   * success return through a ternary. `buyMarketListing` does belong to that
   * class - benignly, since every inner `return prev` mirrors an outer guard
   * above - but surfacing it is ratchet work, not a copy fix, and it must not
   * ride in on this change. See the note in tasks/bbq-bug-report-2026-08-11.md.
   */
  return preview.result.outcome === 'scam'
    ? {
        success: true,
        outcome: 'scam',
        message: `Scammed. The vendor took your ${preview.result.spentBtc.toFixed(4)} ₿ and vanished.`,
      }
    : {
        success: true,
        outcome: 'success',
        message: listingItemId(snapListing)
          ? `Delivered. ${snapListing.title} is yours.`
          : `Deal done. ${snapListing.title} moved - buyer reputation up, heat up. Nothing to add to your kit.`,
      };
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
 *
 * Returns an outcome the caller must surface - a silently swallowed block or
 * failure reads as "the button does nothing" (bug report 2026-07-03).
 */
export const runJobStage = (
  currentState: GameState,
  setGameState: React.Dispatch<React.SetStateAction<GameState>>,
  jobId: string
): { success: boolean; outcome?: 'success' | 'fail' | 'completed' | 'expired'; message: string } => {
  // P1-2: pre-roll outside the updater (see buyMarketListing for rationale).
  const stageRoll = Math.random();

  // Evaluate on the caller's snapshot so the result can be reported to the UI.
  // The updater below re-runs the same pure logic with the same roll.
  const snapshot = ensureDarkWeb(currentState);
  if (!snapshot.darkWeb) return { success: false, message: 'Dark web is unavailable.' };
  const pre = attemptJobStage(snapshot.darkWeb, jobId, stageRoll, snapshot.weeksLived);
  if (!pre.ok) {
    log.warn(`Stage attempt failed: ${pre.reason}`);
    return { success: false, message: pre.reason };
  }
  // BUGFIX: gate on energy. Previously the cost was only subtracted (floored at
  // 0) AFTER the attempt, so a player at 0 energy could spam Run Stage for free.
  // attemptJobStage is pure (no state mutation), so bailing here is safe.
  const energy = snapshot.stats?.energy ?? 0;
  if (energy < pre.result.energyCost) {
    log.info(`Stage attempt blocked: need ${pre.result.energyCost} energy, have ${Math.round(energy)}`);
    return {
      success: false,
      message: `Not enough energy - this stage needs ${pre.result.energyCost} energy and you have ${Math.round(energy)}. Rest up and try again.`,
    };
  }

  setGameState((prev) => {
    const state = ensureDarkWeb(prev);
    if (!state.darkWeb) return prev;
    const r = attemptJobStage(state.darkWeb, jobId, stageRoll, state.weeksLived);
    if (!r.ok) return prev;
    const prevEnergy = state.stats?.energy ?? 0;
    if (prevEnergy < r.result.energyCost) return prev;
    return {
      ...state,
      stats: { ...state.stats, energy: Math.max(0, prevEnergy - r.result.energyCost) },
      darkWeb: r.result.dw,
    };
  });

  const { outcome, dirtyBtcEarned, dw } = pre.result;
  if (outcome === 'completed') {
    return {
      success: true,
      outcome,
      message: `Job complete! ${dirtyBtcEarned.toFixed(4)} ₿ landed in your dirty wallet - launder it before cashing out.`,
    };
  }
  if (outcome === 'fail') {
    const burned = dw.activeJobs.find((j) => j.id === jobId)?.status === 'failed';
    return {
      success: true,
      outcome,
      message: burned
        ? 'The stage failed one time too many - the job is burned and gone.'
        : 'The stage failed and your progress reset to stage 1. Too many failures will burn the job.',
    };
  }
  return { success: true, outcome, message: 'Stage complete - advanced to the next stage.' };
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
// New identity - late-game reset
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
    // and buying a new identity wiped the debt for almost nothing - repeatable
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

