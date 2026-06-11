/**
 * RealEstate actions — buy with mortgage, sell, rent out, set Airbnb mode,
 * maintain, toggle laundering front. Bridges the banking loan system to
 * property ownership.
 */

import React from 'react';
import { GameState, Loan, RealEstate } from '../types';
import { logger } from '@/utils/logger';
import {
  DOWN_PAYMENT_FRACTIONS,
  DownPaymentTier,
  mortgagePreflight,
  MortgageTerm,
  originateMortgage,
  TERM_OPTIONS_WEEKS,
} from '@/lib/realEstate/mortgage';
import {
  endRental,
  kickTenant,
  maintenanceCost,
  performMaintenance,
  sellProperty,
  setRentMode as setRentModePure,
} from '@/lib/realEstate/operations';
import { RentMode } from '@/lib/realEstate/tenancy';
import { quoteLoan } from '@/lib/banking/operations';
import { politicsAprReduction } from './LoanActions';
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
export const buyPropertyWithMortgage = (
  setGameState: React.Dispatch<React.SetStateAction<GameState>>,
  spec: {
    /** Existing RealEstate descriptor — pass the full catalog item for new properties. */
    property: RealEstate;
    tier: DownPaymentTier;
    term: MortgageTerm;
    weeklyIncome: number;
    asResidence?: boolean;
  }
) => {
  setGameState((prev) => {
    const catalog = spec.property;
    const existingIdx = (prev.realEstate ?? []).findIndex((p) => p.id === catalog.id);
    const existing = existingIdx === -1 ? undefined : prev.realEstate![existingIdx];
    if (existing && existing.owned) {
      log.warn(`Buy rejected: property already owned`);
      return prev;
    }
    // Use the catalog property for the quote (gives correct price even if not yet in state).
    const quote = quotePropertyPurchase(prev, catalog, spec.tier, spec.term, spec.weeklyIncome);
    if (quote.rejected) {
      log.info(`Purchase rejected: ${quote.reason}`);
      return prev;
    }
    const cash = prev.stats?.money ?? 0;
    const downPayment = quote.downPaymentUSD ?? 0;
    // EXPLOIT FIX (M-7): previously the down payment was floored with Math.max(0,…)
    // and the purchase still went through, so a quote-vs-apply race (or float/int
    // drift) could buy a property for less than its stated down payment. Reject
    // instead of silently flooring.
    if (cash < downPayment) {
      log.info(`Purchase rejected: insufficient cash for down payment (need ${downPayment}, have ${cash})`);
      return prev;
    }
    const newMoney = cash - downPayment;

    // Create the Loan record if there's a mortgage.
    let updatedLoans = prev.loans ?? [];
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
        startWeek: prev.weeksLived,
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
      purchasedWeek: prev.weeksLived,
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
      updatedRealEstate = [...(prev.realEstate ?? []), ownedEntry];
    } else {
      updatedRealEstate = (prev.realEstate ?? []).map((p, i) => (i === existingIdx ? ownedEntry : p));
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

    return {
      ...prev,
      stats: { ...prev.stats, money: newMoney },
      realEstate: updatedRealEstate,
      loans: updatedLoans,
    };
  });
};

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
    const newLoans = result.releasedMortgageId
      ? (prev.loans ?? []).filter((l) => l.id !== result.releasedMortgageId)
      : prev.loans;

    log.info(
      `Sold ${property.name}: proceeds $${result.saleProceeds.toLocaleString()}, mortgage paid off $${result.mortgagePayoff.toLocaleString()}, capital gain $${result.capitalGain.toLocaleString()}`
    );

    return {
      ...prev,
      stats: { ...prev.stats, money: cash + result.saleProceeds },
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
    const properties = setRentModePure(prev.realEstate ?? [], propertyId, mode, weeklyRent);
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
  setGameState: React.Dispatch<React.SetStateAction<GameState>>,
  propertyId: string
) => {
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
      stats: { ...prev.stats, money: cash - cost },
      realEstate: updated,
    };
  });
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
