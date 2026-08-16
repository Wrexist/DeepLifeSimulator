/**
 * RealEstate actions — buy with mortgage, sell, rent out, set Airbnb mode,
 * maintain, toggle laundering front. Bridges the banking loan system to
 * property ownership.
 */

import React from 'react';
import { GameState, Loan, RealEstate } from '../types';
import { logger } from '@/utils/logger';
import { applyMoneyDelta } from './MoneyActions';
import {
  DOWN_PAYMENT_FRACTIONS,
  DownPaymentTier,
  mortgagePreflight,
  MortgageTerm,
  originateMortgage,
  TERM_OPTIONS_WEEKS,
} from '@/lib/realEstate/mortgage';
import {
  addRoom as addRoomPure,
  endRental,
  findOwnedById,
  installDecor as installDecorPure,
  kickTenant,
  maintenanceCost,
  performMaintenance,
  sellProperty,
  setRentMode as setRentModePure,
  upgradeProperty as upgradePropertyPure,
} from '@/lib/realEstate/operations';
import {
  DECOR_ITEMS,
  ROOM_ADDITIONS,
  getUpgradeTier,
} from '@/lib/realEstate/housing';
import { RentMode } from '@/lib/realEstate/tenancy';
import { quoteLoan, trackBudgetSpend } from '@/lib/banking/operations';
import { politicsAprReduction, POLITICS_LOAN_APR_FLOOR, debtProgress } from './LoanActions';
import { calculatePeriodicPayment } from '@/lib/banking/amortization';

const log = logger.scope('RealEstateActions');

const newId = (prefix: string): string =>
  `${prefix}-${Math.floor(Math.random() * 1e9).toString(36)}`;

/**
 * Quote the cost of buying a property with the given down-payment tier + term.
 * Returns null on reject (with reason in the second value).
 */
export function quotePropertyPurchase(
  state: GameState,
  property: RealEstate,
  tier: DownPaymentTier,
  term: MortgageTerm,
  weeklyIncome: number
): {
  rejected: boolean;
  reason?: string;
  downPaymentUSD?: number;
  loanPrincipal?: number;
  offeredAPR?: number;
  weeklyPayment?: number;
  totalCost?: number;
} {
  const cash = state.stats?.money ?? 0;
  const orig = originateMortgage({
    purchasePrice: property.price,
    tier,
    term,
    availableCash: cash,
  });
  const preflightErr = mortgagePreflight({
    purchasePrice: property.price,
    tier,
    term,
    availableCash: cash,
  });
  if (preflightErr) return { rejected: true, reason: preflightErr };

  // Cash purchase: no loan, no APR.
  if (tier === 'cash') {
    return {
      rejected: false,
      downPaymentUSD: orig.downPaymentUSD,
      loanPrincipal: 0,
      offeredAPR: 0,
      weeklyPayment: 0,
      totalCost: orig.downPaymentUSD,
    };
  }

  const banking = state.banking;
  if (!banking) {
    return { rejected: true, reason: 'Banking not initialized' };
  }
  const quote = quoteLoan(banking, state.loans ?? [], {
    principal: orig.loanPrincipal,
    termWeeks: orig.termWeeks,
    type: 'mortgage',
    weeklyIncome,
    aprReduction: politicsAprReduction(state),
    aprFloor: politicsAprReduction(state) > 0 ? POLITICS_LOAN_APR_FLOOR : undefined,
  });
  if (quote.rejected) return { rejected: true, reason: quote.reason };

  // Adjust APR for PMI / high-down-payment discount.
  const adjustedAPR = Math.max(0.025, quote.offeredAPR + orig.aprAdjustment);
  const weekly = calculatePeriodicPayment(orig.loanPrincipal, adjustedAPR, orig.termWeeks);

  return {
    rejected: false,
    downPaymentUSD: orig.downPaymentUSD,
    loanPrincipal: orig.loanPrincipal,
    offeredAPR: adjustedAPR,
    weeklyPayment: weekly,
    totalCost: orig.downPaymentUSD + weekly * orig.termWeeks,
  };
}

/**
 * Buy a property with the given down-payment tier + mortgage term. Creates the
 * Loan, debits the down payment from cash, adds a new RealEstate entry (or
 * flips an existing unowned one to owned), and links the mortgageId.
 *
 * `propertySpec` accepts either:
 *  - a string `propertyId` referring to an existing unowned RealEstate in state, OR
 *  - a full catalog descriptor (id, name, price, ...) to create a fresh entry.
 */
/** What the player is asking to buy, and how they are financing it. */
type BuyPropertySpec = {
  /** Existing RealEstate descriptor — pass the full catalog item for new properties. */
  property: RealEstate;
  tier: DownPaymentTier;
  term: MortgageTerm;
  weeklyIncome: number;
  asResidence?: boolean;
};

export const buyPropertyWithMortgage = (
  gameState: GameState,
  setGameState: React.Dispatch<React.SetStateAction<GameState>>,
  spec: BuyPropertySpec
): { success: boolean; message: string } => {
  const preview = resolveBuyProperty(gameState, spec);
  if (!preview.next) return preview.result;
  setGameState((prev) => resolveBuyProperty(prev, spec).next ?? prev);
  return preview.result;
};

/**
 * PURE-ENOUGH: what does buying `spec` do to `state`?
 *
 * `next: null` means refuse. Called once against the caller's snapshot for the
 * outcome and once against `prev` for the state.
 *
 * `newId('mortgage')` inside is the one impure step, and it is harmless here:
 * the preview's `next` is discarded, so only the COMMIT's id is ever stored.
 *
 * ── Why (2026-08-15) ──────────────────────────────────────────────────────
 *
 * This used to hold `let result = { success: false, message: 'Purchase failed' }`,
 * assign it from inside the updater and return it after the dispatch. A capture
 * is only readable for the FIRST functional update of a React batch, so on any
 * deferred dispatch the UI showed "Purchase failed" for a property the player
 * had just bought and paid a down payment on.
 */
function resolveBuyProperty(
  state: GameState,
  spec: BuyPropertySpec
): { result: { success: boolean; message: string }; next: GameState | null } {
  {
    const catalog = spec.property;
    const existingIdx = (state.realEstate ?? []).findIndex((p) => p.id === catalog.id);
    const existing = existingIdx === -1 ? undefined : state.realEstate![existingIdx];
    if (existing && existing.owned) {
      log.warn(`Buy rejected: property already owned`);
      return { result: { success: false, message: 'You already own this property.' }, next: null };
    }
    // Use the catalog property for the quote (gives correct price even if not yet in state).
    const quote = quotePropertyPurchase(state, catalog, spec.tier, spec.term, spec.weeklyIncome);
    if (quote.rejected) {
      log.info(`Purchase rejected: ${quote.reason}`);
      return { result: { success: false, message: quote.reason ?? 'The lender rejected this purchase.' }, next: null };
    }
    const cash = state.stats?.money ?? 0;
    const downPayment = quote.downPaymentUSD ?? 0;
    // EXPLOIT FIX (M-7): previously the down payment was floored with Math.max(0,…)
    // and the purchase still went through, so a quote-vs-apply race (or float/int
    // drift) could buy a property for less than its stated down payment. Reject
    // instead of silently flooring.
    if (cash < downPayment) {
      log.info(`Purchase rejected: insufficient cash for down payment (need ${downPayment}, have ${cash})`);
      return { result: { success: false, message: `You need $${Math.round(downPayment).toLocaleString()} down — you have $${Math.round(cash).toLocaleString()}.` }, next: null };
    }
    // Route the down-payment debit through the canonical money helper
    // (MONEY_CEILING clamp + NaN/overdraft guard) instead of writing stats.money
    // directly — the amount is unchanged, but a corrupt (NaN) balance can no
    // longer slip a purchase through (`cash < downPayment` is false for NaN).
    const spend = applyMoneyDelta(state, -downPayment, `Property down payment: ${catalog.name}`);
    if (!spend) {
      log.info(`Purchase rejected by money guard: down ${downPayment}, cash ${cash}`);
      return { result: { success: false, message: `You need $${Math.round(downPayment).toLocaleString()} down — you have $${Math.round(cash).toLocaleString()}.` }, next: null };
    }

    // Create the Loan record if there's a mortgage.
    let updatedLoans = state.loans ?? [];
    let mortgageId: string | undefined;
    if (spec.tier !== 'cash' && (quote.loanPrincipal ?? 0) > 0) {
      mortgageId = newId('mortgage');
      const loan: Loan = {
        id: mortgageId,
        name: `Mortgage: ${catalog.name}`,
        principal: quote.loanPrincipal!,
        remaining: quote.loanPrincipal!,
        rateAPR: quote.offeredAPR!,
        originalAPR: quote.offeredAPR!,
        interestRate: quote.offeredAPR!,
        termWeeks: TERM_OPTIONS_WEEKS[spec.term],
        weeksRemaining: TERM_OPTIONS_WEEKS[spec.term],
        weeklyPayment: quote.weeklyPayment!,
        startWeek: state.weeksLived,
        autoPay: true,
        type: 'mortgage',
        onTimePayments: 0,
        latePayments: 0,
      };
      updatedLoans = [...updatedLoans, loan];
    }

    // Build the owned entry. If it existed (unowned), merge over it; otherwise append.
    const ownedEntry: RealEstate = {
      ...(existing ?? catalog),
      owned: true,
      status: spec.asResidence ? 'owner' : 'owner',
      purchasePrice: catalog.price,
      purchasedWeek: state.weeksLived,
      currentValue: catalog.price,
      condition: 90,
      currentResidence: spec.asResidence ?? false,
      mortgageId,
      neighborhood: existing?.neighborhood ?? catalog.id,
      marketCycle: 'stable',
      cycleWeeksRemaining: 26,
    };

    let updatedRealEstate: RealEstate[];
    if (existingIdx === -1) {
      updatedRealEstate = [...(state.realEstate ?? []), ownedEntry];
    } else {
      updatedRealEstate = (state.realEstate ?? []).map((p, i) => (i === existingIdx ? ownedEntry : p));
    }

    // If marking as primary residence, demote any prior residence.
    if (spec.asResidence) {
      updatedRealEstate = updatedRealEstate.map((p) =>
        p.id !== ownedEntry.id && p.currentResidence ? { ...p, currentResidence: false } : p
      );
    }

    log.info(
      `Bought ${catalog.name} for $${catalog.price.toLocaleString()} (down: $${(quote.downPaymentUSD ?? 0).toLocaleString()}, financed: $${(quote.loanPrincipal ?? 0).toLocaleString()})`
    );

    // Budget tab: the down payment leaves cash today → housing spending. The
    // mortgage principal is NOT recorded; its repayments are tracked as 'debt'.
    const banking = state.banking?.budgetSpend
      ? trackBudgetSpend(state.banking, state.weeksLived, 'housing', downPayment)
      : state.banking;

    return {
      result: {
        success: true,
        message: spec.tier === 'cash'
          ? `You bought ${catalog.name} outright for $${catalog.price.toLocaleString()}!`
          : `You bought ${catalog.name} — $${Math.round(downPayment).toLocaleString()} down, $${Math.round(quote.weeklyPayment ?? 0)}/wk mortgage.`,
      },
      next: {
        ...state,
        ...spend,
        banking,
        realEstate: updatedRealEstate,
        loans: updatedLoans,
        /**
         * `totalPropertiesOwned` had NO production writer — `trackNewProperty`
         * in `lib/statistics/statisticsTracker.ts` was only ever called from a
         * stress test. StatisticsApp's "Properties" counter therefore read a
         * permanent 0, and the `first-property` milestone (15 gems) was
         * unearnable. Incremented HERE, inside the same transition that flips
         * the property to `owned: true` and debits the down payment, so it
         * cannot drift from ownership (CLAUDE.md §4.4). Lifetime counter, so it
         * is never decremented on sale.
         */
        lifetimeStatistics: state.lifetimeStatistics
          ? {
              ...state.lifetimeStatistics,
              totalPropertiesOwned: (state.lifetimeStatistics.totalPropertiesOwned ?? 0) + 1,
            }
          : state.lifetimeStatistics,
        // A mortgage is debt. See `debtProgress`.
        ...debtProgress(state, updatedLoans.length > (state.loans ?? []).length),
      },
    };
  }
}

/**
 * Sell a property. Pays off any outstanding mortgage; remaining proceeds go to cash.
 */
export const sellOwnedProperty = (
  setGameState: React.Dispatch<React.SetStateAction<GameState>>,
  propertyId: string
) => {
  setGameState((prev) => {
    const property = (prev.realEstate ?? []).find((p) => p.id === propertyId && p.owned);
    if (!property) {
      log.warn(`Sell rejected: not owned`);
      return prev;
    }
    const mortgageRemaining = property.mortgageId
      ? ((prev.loans ?? []).find((l) => l.id === property.mortgageId)?.remaining ?? 0)
      : 0;
    const result = sellProperty(prev.realEstate ?? [], propertyId, mortgageRemaining);
    const cash = prev.stats?.money ?? 0;
    // Underwater ("short") sale: the proceeds didn't cover the mortgage. Keep the
    // loan as a deficiency balance (reduced to the uncovered remainder) rather
    // than discharging negative equity for $0 — deleting the loan outright let a
    // player erase a compounded mortgage for free.
    const newLoans = !result.releasedMortgageId
      ? prev.loans
      : result.residualDebt > 0
        ? (prev.loans ?? []).map((l) =>
            l.id === result.releasedMortgageId ? { ...l, remaining: result.residualDebt } : l
          )
        : (prev.loans ?? []).filter((l) => l.id !== result.releasedMortgageId);

    log.info(
      `Sold ${property.name}: proceeds $${result.saleProceeds.toLocaleString()}, mortgage paid off $${result.mortgagePayoff.toLocaleString()}, capital gain $${result.capitalGain.toLocaleString()}` +
        (result.residualDebt > 0
          ? `, deficiency balance remaining $${result.residualDebt.toLocaleString()}`
          : '')
    );

    // Canonical credit path — a big sale near the money cap must respect
    // MONEY_CEILING like every other credit (M-7 parity with the buy flow).
    // Abort if the credit is rejected: the property must never leave the
    // portfolio while the player receives nothing.
    const salePatch = applyMoneyDelta(prev, result.saleProceeds, `Property sale: ${property.name}`);
    if (!salePatch) {
      log.warn(`Sale aborted: invalid proceeds for ${property.name}`);
      return prev;
    }
    return {
      ...prev,
      ...salePatch,
      realEstate: result.properties,
      loans: newLoans,
    };
  });
};

/**
 * Switch a property's rental mode (longTerm / airbnb / commercial) at a chosen
 * weekly rent. Property must be owned and either vacant or already rented.
 */
export const setPropertyRentMode = (
  setGameState: React.Dispatch<React.SetStateAction<GameState>>,
  propertyId: string,
  mode: RentMode,
  weeklyRent: number
) => {
  setGameState((prev) => {
    const list = prev.realEstate ?? [];
    // Only the player's OWNED properties can be rented out (setRentModePure matched
    // any id), and rent can't be negative (would credit nothing / corrupt math).
    if (!findOwnedById(list, propertyId)) {
      log.warn(`Set rent mode rejected: ${propertyId} is not an owned property`);
      return prev;
    }
    let safeRent = Math.max(0, typeof weeklyRent === 'number' && isFinite(weeklyRent) ? weeklyRent : 0);
    // ANTI-EXPLOIT: cap player-set rent to a realistic multiple of the
    // property's value so it can't be set arbitrarily high. property.rent feeds
    // income projections (and historically the passive-income cash path), so an
    // unclamped value let a cheap property "earn" up to the $150k/wk cap. ~0.2%
    // of value per week (~10%/yr gross) × 2 headroom is a generous ceiling.
    const owned = findOwnedById(list, propertyId);
    const propValue = owned && typeof owned.price === 'number' && isFinite(owned.price) ? owned.price : 0;
    if (propValue > 0) {
      const rentCeiling = Math.ceil(propValue * 0.004); // ~0.4%/wk (~20%/yr) generous upper bound
      safeRent = Math.min(safeRent, rentCeiling);
    }
    const properties = setRentModePure(list, propertyId, mode, safeRent);
    return { ...prev, realEstate: properties };
  });
};

/** Stop renting out a property; convert back to owner-occupied. */
export const stopRenting = (
  setGameState: React.Dispatch<React.SetStateAction<GameState>>,
  propertyId: string
) => {
  setGameState((prev) => {
    return { ...prev, realEstate: endRental(prev.realEstate ?? [], propertyId) };
  });
};

/** Kick the current tenant out. They lose the lease; property becomes vacant. */
export const evictTenant = (
  setGameState: React.Dispatch<React.SetStateAction<GameState>>,
  propertyId: string
) => {
  setGameState((prev) => {
    return { ...prev, realEstate: kickTenant(prev.realEstate ?? [], propertyId) };
  });
};

/**
 * Pay for maintenance to restore property condition. Cost scales with value
 * and the damage gap.
 */
export const maintainProperty = (
  gameState: GameState,
  setGameState: React.Dispatch<React.SetStateAction<GameState>>,
  propertyId: string
): { success: boolean; message: string } => {
  /**
   * Both refusals used to be reachable ONLY inside the updater, and the
   * function returned `void` — so a player who could not afford maintenance
   * tapped the button and got complete silence, with a `log.warn` nobody sees.
   * These outer guards make the refusal reportable; the inner copies stay as
   * the same-batch race protection for state.
   */
  const owned = (gameState.realEstate ?? []).find((p) => p.id === propertyId && p.owned);
  if (!owned) {
    return { success: false, message: 'You must own this property to maintain it.' };
  }
  const quotedCost = maintenanceCost(owned);
  if ((gameState.stats?.money ?? 0) < quotedCost) {
    return {
      success: false,
      message: `Maintenance costs $${Math.round(quotedCost).toLocaleString()} — you have $${Math.round(gameState.stats?.money ?? 0).toLocaleString()}.`,
    };
  }

  setGameState((prev) => {
    const property = (prev.realEstate ?? []).find((p) => p.id === propertyId && p.owned);
    if (!property) return prev;
    const cost = maintenanceCost(property);
    const cash = prev.stats?.money ?? 0;
    if (cash < cost) {
      log.warn(`Maintenance rejected: need $${cost}, have $${cash}`);
      return prev;
    }
    const updated = performMaintenance(prev.realEstate ?? [], propertyId, prev.weeksLived);
    return {
      ...prev,
      // Budget tab: property maintenance is housing spending.
      banking: prev.banking?.budgetSpend
        ? trackBudgetSpend(prev.banking, prev.weeksLived, 'housing', cost)
        : prev.banking,
      ...(applyMoneyDelta(prev, -cost, 'Property maintenance') ?? { stats: { ...prev.stats, money: cash - cost } }),
      realEstate: updated,
    };
  });

  return {
    success: true,
    message: `Maintenance done — $${Math.round(quotedCost).toLocaleString()}.`,
  };
};

/**
 * PURE resolvers for the three "improve an owned property" actions.
 *
 * ── Why they exist (2026-08-15) ───────────────────────────────────────────
 *
 * All three used to hold `let result = { success: false }`, assign it from
 * inside their `setGameState` updater, and `return result` after the dispatch.
 * That read is only reliable for the FIRST functional update of a React batch
 * (`__tests__/refactor/updaterTimingContract.test.tsx`); on any deferred
 * dispatch it returned the initial "Install failed" / "Add-room failed" /
 * "Upgrade failed" placeholder for work that had in fact succeeded — the same
 * defect as the 2026-08-15 player report ($40.25M told they needed $10,000).
 *
 * These were the hardest members of the class because they took only
 * `setGameState`: with no state snapshot they could not answer their caller at
 * all except by reading across the updater boundary. Each now takes
 * `gameState`, and one pure function produces BOTH the outcome (from the
 * caller's snapshot) and the next state (from `prev`), so no cross-updater
 * variable exists to be stale.
 *
 * `next: null` means refuse — the updater returns `prev` unchanged, which is
 * also the same-batch race guard.
 */
type ImproveOutcome = { result: { success: boolean; message: string }; next: GameState | null };

function resolveInstallDecor(state: GameState, propertyId: string, decorId: string): ImproveOutcome {
  const property = (state.realEstate ?? []).find((p) => p.id === propertyId && p.owned);
  if (!property) {
    return { result: { success: false, message: 'You must own this property to improve it.' }, next: null };
  }
  const item = DECOR_ITEMS.find((d) => d.id === decorId);
  if (!item) {
    return { result: { success: false, message: 'Unknown decoration.' }, next: null };
  }
  if ((property.interior ?? []).includes(decorId)) {
    return { result: { success: false, message: `${item.name} is already installed here.` }, next: null };
  }
  const cash = state.stats?.money ?? 0;
  if (cash < item.cost) {
    return {
      result: { success: false, message: `You need $${item.cost.toLocaleString()} for the ${item.name}.` },
      next: null,
    };
  }
  return {
    result: { success: true, message: `Installed ${item.name} (+${item.happiness} comfort/wk when lived in).` },
    next: {
      ...state,
      banking: state.banking?.budgetSpend
        ? trackBudgetSpend(state.banking, state.weeksLived, 'housing', item.cost)
        : state.banking,
      ...(applyMoneyDelta(state, -item.cost, 'Property decor') ?? { stats: { ...state.stats, money: cash - item.cost } }),
      realEstate: installDecorPure(state.realEstate ?? [], propertyId, decorId),
    },
  };
}

function resolveAddRoom(state: GameState, propertyId: string, roomId: string): ImproveOutcome {
  const property = (state.realEstate ?? []).find((p) => p.id === propertyId && p.owned);
  if (!property) {
    return { result: { success: false, message: 'You must own this property to improve it.' }, next: null };
  }
  const room = ROOM_ADDITIONS.find((r) => r.id === roomId);
  if (!room) {
    return { result: { success: false, message: 'Unknown room.' }, next: null };
  }
  if ((property.rooms ?? []).includes(roomId)) {
    return { result: { success: false, message: `${room.name} has already been added here.` }, next: null };
  }
  const cash = state.stats?.money ?? 0;
  if (cash < room.cost) {
    return {
      result: { success: false, message: `You need $${room.cost.toLocaleString()} to add the ${room.name}.` },
      next: null,
    };
  }
  return {
    result: { success: true, message: `Added ${room.name} (+${room.happinessBonus} comfort/wk when lived in).` },
    next: {
      ...state,
      banking: state.banking?.budgetSpend
        ? trackBudgetSpend(state.banking, state.weeksLived, 'housing', room.cost)
        : state.banking,
      ...(applyMoneyDelta(state, -room.cost, 'Property room addition') ?? { stats: { ...state.stats, money: cash - room.cost } }),
      realEstate: addRoomPure(state.realEstate ?? [], propertyId, roomId),
    },
  };
}

function resolveUpgradeTier(state: GameState, propertyId: string): ImproveOutcome {
  const property = (state.realEstate ?? []).find((p) => p.id === propertyId && p.owned);
  if (!property) {
    return { result: { success: false, message: 'You must own this property to upgrade it.' }, next: null };
  }
  const nextTier = getUpgradeTier((property.upgradeLevel ?? 0) + 1);
  if (!nextTier) {
    return { result: { success: false, message: 'This property is already at the top upgrade tier.' }, next: null };
  }
  const cash = state.stats?.money ?? 0;
  if (cash < nextTier.cost) {
    return {
      result: { success: false, message: `You need $${nextTier.cost.toLocaleString()} to reach tier ${nextTier.level}.` },
      next: null,
    };
  }
  return {
    result: {
      success: true,
      message: `Upgraded ${property.name} to tier ${nextTier.level} (+$${nextTier.rentBonus}/wk rent when rented).`,
    },
    next: {
      ...state,
      banking: state.banking?.budgetSpend
        ? trackBudgetSpend(state.banking, state.weeksLived, 'housing', nextTier.cost)
        : state.banking,
      ...(applyMoneyDelta(state, -nextTier.cost, 'Property tier upgrade') ?? { stats: { ...state.stats, money: cash - nextTier.cost } }),
      realEstate: upgradePropertyPure(state.realEstate ?? [], propertyId, nextTier.level),
    },
  };
}

/**
 * Improve flow — install a decoration item into an owned property. Debits the
 * item cost, tracks 'housing' budget spend, and writes the EXISTING interior[]
 * field (which calculatePropertyHappiness / appreciatePropertyValue already
 * consume). Reads prev inside the updater, so a same-batch double-tap sees the
 * already-installed item (or the debited cash) and rejects — no double spend.
 */
export const installPropertyDecor = (
  gameState: GameState,
  setGameState: React.Dispatch<React.SetStateAction<GameState>>,
  propertyId: string,
  decorId: string
): { success: boolean; message: string } => {
  const preview = resolveInstallDecor(gameState, propertyId, decorId);
  if (!preview.next) return preview.result;
  setGameState((prev) => resolveInstallDecor(prev, propertyId, decorId).next ?? prev);
  log.info(`Installed decor ${decorId} in ${propertyId}`);
  return preview.result;
};

/**
 * Improve flow — add a room to an owned property. Debits the cost, tracks
 * 'housing' spend, and writes the EXISTING rooms[] field. Double-tap safe.
 */
export const addPropertyRoom = (
  gameState: GameState,
  setGameState: React.Dispatch<React.SetStateAction<GameState>>,
  propertyId: string,
  roomId: string
): { success: boolean; message: string } => {
  const preview = resolveAddRoom(gameState, propertyId, roomId);
  if (!preview.next) return preview.result;
  setGameState((prev) => resolveAddRoom(prev, propertyId, roomId).next ?? prev);
  log.info(`Added room ${roomId} to ${propertyId}`);
  return preview.result;
};

/**
 * Improve flow — bump a property to the next upgrade tier (max tier 3). Debits
 * the tier cost, tracks 'housing' spend, and writes the EXISTING upgradeLevel.
 * The tier's rent bonus flows through the weekly tenant-model rent (bounded,
 * only when the unit is actually tenanted). Double-tap safe.
 */
export const upgradePropertyTier = (
  gameState: GameState,
  setGameState: React.Dispatch<React.SetStateAction<GameState>>,
  propertyId: string
): { success: boolean; message: string } => {
  const preview = resolveUpgradeTier(gameState, propertyId);
  if (!preview.next) return preview.result;
  setGameState((prev) => resolveUpgradeTier(prev, propertyId).next ?? prev);
  log.info(`Upgraded property tier for ${propertyId}`);
  return preview.result;
};

/**
 * Toggle laundering-front status. When true, this property counts as a
 * dark-web laundering front via lib/darkweb (cuts mixer fee + delay).
 * Property must be commercial-mode to be eligible.
 */
export const toggleLaunderingFront = (
  setGameState: React.Dispatch<React.SetStateAction<GameState>>,
  propertyId: string
) => {
  setGameState((prev) => {
    const properties = (prev.realEstate ?? []).map((p) => {
      if (p.id !== propertyId) return p;
      if (p.rentMode !== 'commercial') {
        log.warn('Laundering front requires commercial rent mode');
        return p;
      }
      return { ...p, launderingFront: !p.launderingFront };
    });
    return { ...prev, realEstate: properties };
  });
};

// Re-exports for the UI
export { DOWN_PAYMENT_FRACTIONS, TERM_OPTIONS_WEEKS };
export type { DownPaymentTier, MortgageTerm };
