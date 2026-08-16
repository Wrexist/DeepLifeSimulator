/**
 * Vehicle Actions
 * 
 * Handles all vehicle-related state changes including:
 * - Purchasing/selling vehicles
 * - Getting driver's license
 * - Refueling and repairs
 * - Insurance management
 * - Weekly vehicle maintenance processing
 */

import { GameState, Vehicle, VehicleInsurance } from '../types';
import { getActiveRental, getRentalPlan } from '@/lib/vehicles/scooterRental';
import { PILOT_LICENSE, isAircraftVehicleId } from '@/lib/vehicles/aircraft';
import { rejectIfBlocked } from './_guards';
import { logger } from '@/utils/logger';
import { trackBudgetSpend , quoteLoan } from '@/lib/banking/operations';
import { updateMoney, applyMoneyDelta } from './MoneyActions';
import { updateStats } from './StatsActions';
import {
  VEHICLE_TEMPLATES,
  DRIVERS_LICENSE,
  createVehicleFromTemplate,
  calculateVehicleSellPrice,
  calculateRepairCost,
  calculateFuelCost,
  getInsurancePlan,
  calculateAccidentDamage,
  AccidentSeverity,
} from '@/lib/vehicles/vehicles';
import type { Dispatch, SetStateAction } from 'react';

// ---------------------------------------------------------------------------
// VehicleApp Remake 8: Auto-loan financing via the banking system.
// ---------------------------------------------------------------------------

import {
  AutoDownTier,
  AutoTerm,
  AUTO_TERM_WEEKS,
  autoPreflight,
  originateAuto,
} from '@/lib/vehicles/auto';
import { calculatePeriodicPayment } from '@/lib/banking/amortization';
import { politicsAprReduction, POLITICS_LOAN_APR_FLOOR, debtProgress } from './LoanActions';
import type { Loan } from '../types';

const log = logger.scope('VehicleActions');

/**
 * Get driver's license
 */
export const getDriversLicense = (
  gameState: GameState,
  setGameState: Dispatch<SetStateAction<GameState>>,
  deps: { updateMoney: typeof updateMoney }
): { success: boolean; message: string } => {
  // Check if already has license
  if (gameState.hasDriversLicense) {
    return { success: false, message: 'You already have a driver\'s license!' };
  }

  // Check age requirement
  if (gameState.date.age < DRIVERS_LICENSE.minAge) {
    return { success: false, message: `You must be at least ${DRIVERS_LICENSE.minAge} years old to get a driver's license.` };
  }

  // Check if can afford
  if (gameState.stats.money < DRIVERS_LICENSE.cost) {
    return { success: false, message: `You need $${DRIVERS_LICENSE.cost.toLocaleString()} to get a driver's license.` };
  }

  // Atomic: merge money deduction + license grant into single update
  setGameState(prev => {
    // R4-X5: re-check "not already licensed" and affordability against `prev`.
    // Both gates above read the stale outer snapshot and the debit floored at
    // 0, so a double tap bought the same licence twice. CLAUDE.md §4.4.
    if (prev.hasDriversLicense) return prev;
    if ((prev.stats?.money ?? 0) < DRIVERS_LICENSE.cost) return prev;

    return {
      ...prev,
      stats: {
        ...prev.stats,
        money: prev.stats.money - DRIVERS_LICENSE.cost,
      },
      hasDriversLicense: true,
    };
  });

  log.info('Player obtained driver\'s license');
  return { success: true, message: 'Congratulations! You now have a driver\'s license!' };
};

/**
 * Purchase a vehicle — the outcome and the state, as ONE pure function of the
 * state handed to it.
 *
 * Written as a resolver called twice (once against the caller's snapshot for
 * the report, once against `prev` for the state) rather than gating outside and
 * mutating inside. Two defects made that necessary:
 *
 *  1. Every gate (licence, reputation, affordability, already-owned) read the
 *     stale render-time snapshot and the updater re-checked NOTHING, so two
 *     taps in one React batch pushed TWO garage entries. Both shared an id —
 *     `createVehicleFromTemplate` stamps `id: template.id` — and `sellVehicle`
 *     filters by id, so selling removed BOTH copies while crediting ONE sale
 *     price.
 *  2. The debit floored at zero (`Math.max(0, prevMoney - vehiclePrice)`), so
 *     the second tap handed over a car and silently forgave the shortfall —
 *     the gate → grant class of CLAUDE.md §4.4.
 *
 * Vehicle ids stay equal to the template id on purpose: the whole vehicle
 * system keys on that identity (the already-own gate, `sellVehicle`'s
 * `VEHICLE_TEMPLATES` price lookup, auto loans via `loan.vehicleId`, insurance,
 * weekly processing). One-per-template IS the design; the ownership re-check is
 * what enforces it, and unique ids would break every one of those lookups for
 * no additional safety.
 *
 * Nothing crosses the updater boundary — the capture shape that
 * `__tests__/refactor/updaterResultRatchet.test.ts` exists to keep out, and
 * that a previous VehicleActions conversion had to be reverted for.
 */
const resolvePurchaseVehicle = (
  state: GameState,
  vehicleId: string
): { result: { success: boolean; message: string }; next: GameState } => {
  const reject = (message: string) => ({ result: { success: false, message }, next: state });

  // Find vehicle template
  const template = VEHICLE_TEMPLATES.find(v => v.id === vehicleId);
  if (!template) {
    return reject('Vehicle not found.');
  }

  // Licence gate. Aircraft need a PILOT licence — a driving licence is neither
  // sufficient nor required to own a helicopter, and gating the aircraft ladder
  // behind its own qualification is what makes it feel earned.
  if (isAircraftVehicleId(vehicleId)) {
    if (!state.hasPilotLicense) {
      return reject('You need a pilot\'s license to buy an aircraft.');
    }
  } else if (!state.hasDriversLicense) {
    return reject('You need a driver\'s license to purchase a vehicle!');
  }

  // CRITICAL: Validate template price before comparison
  const vehiclePrice = typeof template.price === 'number' && isFinite(template.price) && template.price >= 0 ? template.price : 0;
  if (vehiclePrice === 0) {
    return reject('Invalid vehicle price');
  }

  // Check reputation requirement
  const requiredReputation = typeof template.requiredReputation === 'number' && isFinite(template.requiredReputation) && template.requiredReputation >= 0 ? template.requiredReputation : 0;
  const currentReputation = typeof state.stats.reputation === 'number' && isFinite(state.stats.reputation) && state.stats.reputation >= 0 ? state.stats.reputation : 0;
  if (requiredReputation > 0 && currentReputation < requiredReputation) {
    return reject(`You need ${requiredReputation} reputation to purchase this vehicle.`);
  }

  // Check if already owns this vehicle. Against `prev` this is also the
  // same-batch duplicate guard.
  if ((state.vehicles || []).some(v => v.id === vehicleId)) {
    return reject('You already own this vehicle!');
  }

  // CRITICAL: Validate money before comparison. Refuse, never clamp.
  const currentMoney = typeof state.stats.money === 'number' && isFinite(state.stats.money) && state.stats.money >= 0 ? state.stats.money : 0;
  if (currentMoney < vehiclePrice) {
    return reject(`You need $${vehiclePrice.toLocaleString()} to purchase this vehicle.`);
  }

  const newVehicle = createVehicleFromTemplate(template, state.weeksLived || 0);
  const newMoney = currentMoney - vehiclePrice;
  const moneyChange = newMoney - currentMoney;

  const vehicles = [...(state.vehicles || []), newVehicle];
  // Set as active if it's the first vehicle
  const activeVehicleId = state.activeVehicleId || newVehicle.id;

  // Update daily summary
  let dailySummary = state.dailySummary;
  if (dailySummary) {
    dailySummary = {
      ...dailySummary,
      moneyChange: (dailySummary.moneyChange || 0) + moneyChange,
      totalMoneySpent: (dailySummary.totalMoneySpent || 0) + Math.max(0, -moneyChange),
      statsChange: { ...(dailySummary.statsChange || {}) },
      events: [...(dailySummary.events || [])],
    };
  }

  // Budget tab: vehicle purchases are transport spending.
  const banking = state.banking?.budgetSpend
    ? trackBudgetSpend(state.banking, state.weeksLived ?? 0, 'transport', vehiclePrice)
    : state.banking;

  return {
    result: { success: true, message: `Congratulations! You are now the proud owner of a ${template.name}!` },
    next: {
      ...state,
      banking,
      stats: {
        ...state.stats,
        money: newMoney,
        reputation: template.reputationBonus > 0
          ? Math.min(100, (state.stats.reputation || 0) + template.reputationBonus)
          : (state.stats.reputation || 0),
      },
      vehicles,
      activeVehicleId,
      dailySummary,
    },
  };
};

export const purchaseVehicle = (
  gameState: GameState,
  setGameState: Dispatch<SetStateAction<GameState>>,
  vehicleId: string,
  /** Unused — the resolver above applies the charge atomically. Optional so callers need not fake it. */
  _deps?: { updateMoney: typeof updateMoney; updateStats: typeof updateStats }
): { success: boolean; message: string } => {
  // Outcome from the caller's snapshot: what the player can be told.
  const preview = resolvePurchaseVehicle(gameState, vehicleId);
  if (!preview.result.success) {
    log.warn(`Vehicle purchase refused (${vehicleId}): ${preview.result.message}`);
    return preview.result;
  }

  // State from `prev`: the authority. Re-runs every gate, so a second tap in
  // the same batch is refused and `prev` is returned unchanged.
  setGameState(prev => resolvePurchaseVehicle(prev, vehicleId).next);

  log.info(`Player purchased vehicle: ${vehicleId}`);
  return preview.result;
};

/**
 * Sell a vehicle
 */
export const sellVehicle = (
  gameState: GameState,
  setGameState: Dispatch<SetStateAction<GameState>>,
  vehicleId: string,
  deps: { updateMoney: typeof updateMoney; updateStats: typeof updateStats }
): { success: boolean; message: string; sellPrice?: number } => {
  const vehicle = (gameState.vehicles || []).find(v => v.id === vehicleId);
  if (!vehicle) {
    return { success: false, message: 'Vehicle not found in your garage.' };
  }

  const sellPrice = calculateVehicleSellPrice(vehicle);

  // Atomic: merge money gain + vehicle removal + reputation loss into single update
  const template = VEHICLE_TEMPLATES.find(t => t.id === vehicleId);
  const repLoss = (template && template.reputationBonus > 0)
    ? -Math.floor(template.reputationBonus / 2)
    : 0;

  setGameState(prev => {
    // H-9: re-check ownership against `prev`. Without this, two rapid taps both
    // read the vehicle from the stale `gameState`, and each updater adds
    // `sellPrice` again (the second `.filter` is a harmless no-op) — duplicating
    // the sale proceeds per extra tap. If the vehicle is already gone this batch,
    // the sale already happened: return prev unchanged.
    if (!(prev.vehicles || []).some(v => v.id === vehicleId)) return prev;

    const vehicles = (prev.vehicles || []).filter(v => v.id !== vehicleId);
    const activeVehicleId = prev.activeVehicleId === vehicleId
      ? (vehicles.length > 0 ? vehicles[0].id : undefined)
      : prev.activeVehicleId;

    // Pay off any outstanding auto loan for this vehicle from the proceeds and
    // remove it, so a sold-but-financed car doesn't keep auto-paying forever
    // against a vehicle the player no longer owns. Mirrors sellOwnedProperty.
    const vehicleLoan = (prev.loans || []).find(l => l.vehicleId === vehicleId);
    const rem = vehicleLoan?.remaining;
    const loanPayoff = typeof rem === 'number' && isFinite(rem) && rem > 0 ? rem : 0;
    // Underwater sale: proceeds can't cover the auto loan. Keep the loan as a
    // deficiency balance (reduced to the uncovered remainder) instead of erasing
    // negative equity for $0 — deleting the loan while clamping cash at 0 let a
    // player shed a compounded auto loan for free.
    const residualDebt = Math.max(0, loanPayoff - sellPrice);
    const cashDelta = sellPrice - Math.min(sellPrice, loanPayoff); // surplus after the loan (>= 0)
    const newLoans = !vehicleLoan
      ? prev.loans
      : residualDebt > 0
        ? (prev.loans || []).map(l =>
            l.id === vehicleLoan.id
              ? // The collateral is gone: drop the vehicleId link so the deficiency
                // is an unsecured personal debt. Keeping it would collide with a
                // future purchase of the same vehicle (loan lookups match by
                // vehicleId), letting the new car pay down the stale deficiency
                // while its real loan goes untracked.
                { ...l, remaining: residualDebt, vehicleId: undefined }
              : l
          )
        : (prev.loans || []).filter(l => l.id !== vehicleLoan.id);

    return {
      ...prev,
      stats: {
        ...prev.stats,
        money: Math.max(
          0,
          (typeof prev.stats.money === 'number' && isFinite(prev.stats.money) ? prev.stats.money : 0) +
            cashDelta
        ),
        reputation: Math.max(0, (prev.stats.reputation || 0) + repLoss),
      },
      vehicles,
      activeVehicleId,
      loans: newLoans,
    };
  });

  log.info(`Player sold vehicle: ${vehicle.name} for $${sellPrice}`);
  return { success: true, message: `Sold ${vehicle.name} for $${sellPrice.toLocaleString()}!`, sellPrice };
};

/**
 * Refuel a vehicle
 */
export const refuelVehicle = (
  gameState: GameState,
  setGameState: Dispatch<SetStateAction<GameState>>,
  vehicleId: string,
  /**
   * Unused, and optional so callers need not fake it.
   *
   * NOTE there is no amount/litres parameter — refuelling always fills to 100,
   * priced by `calculateFuelCost`. Several stress tests called this as
   * `refuelVehicle(state, set, id, 100, deps)`, so the phantom `100` landed in
   * this slot and the real deps became an ignored fifth argument. Harmless only
   * because nothing here reads it.
   */
  _deps?: { updateMoney: typeof updateMoney }
): { success: boolean; message: string } => {
  const vehicle = (gameState.vehicles || []).find(v => v.id === vehicleId);
  if (!vehicle) {
    return { success: false, message: 'Vehicle not found.' };
  }

  if (vehicle.fuelLevel >= 100) {
    return { success: false, message: 'Fuel tank is already full!' };
  }

  const fuelCost = calculateFuelCost(vehicle);

  if (gameState.stats.money < fuelCost) {
    return { success: false, message: `You need $${fuelCost.toLocaleString()} to fill up.` };
  }

  // Atomic: merge fuel cost + fuel level update into single update
  setGameState(prev => {
    /**
     * R4-X5: re-check the tank and the wallet against `prev`.
     *
     * Both gates above read the stale outer `gameState`, and the debit used
     * `Math.max(0, …)`, which FLOORS instead of rejecting. `VehicleCard`'s
     * Refuel button has no in-flight guard, so two taps in one React batch both
     * passed: the second refilled an already-full tank and charged for it, and
     * on a thin wallet the clamp zeroed the player's cash rather than declining.
     * CLAUDE.md §4.4.
     */
    const prevVehicle = (prev.vehicles || []).find(v => v.id === vehicleId);
    if (!prevVehicle || prevVehicle.fuelLevel >= 100) return prev;
    if ((prev.stats?.money ?? 0) < fuelCost) return prev;

    return {
      ...prev,
      // Budget tab: fuel is transport spending.
      banking: prev.banking?.budgetSpend
        ? trackBudgetSpend(prev.banking, prev.weeksLived ?? 0, 'transport', fuelCost)
        : prev.banking,
      stats: {
        ...prev.stats,
        money: prev.stats.money - fuelCost,
      },
      vehicles: (prev.vehicles || []).map(v =>
        v.id === vehicleId ? { ...v, fuelLevel: 100 } : v
      ),
    };
  });

  log.info(`Player refueled vehicle: ${vehicle.name}`);
  return { success: true, message: `Filled up ${vehicle.name} for $${fuelCost.toLocaleString()}!` };
};

/**
 * Repair a vehicle
 */
export const repairVehicle = (
  gameState: GameState,
  setGameState: Dispatch<SetStateAction<GameState>>,
  vehicleId: string,
  deps: { updateMoney: typeof updateMoney }
): { success: boolean; message: string } => {
  const vehicle = (gameState.vehicles || []).find(v => v.id === vehicleId);
  if (!vehicle) {
    return { success: false, message: 'Vehicle not found.' };
  }

  if (vehicle.condition >= 100) {
    return { success: false, message: 'Vehicle is already in perfect condition!' };
  }

  let repairCost = calculateRepairCost(vehicle);

  // Apply insurance coverage
  if (vehicle.insurance?.active) {
    const coverage = vehicle.insurance.coveragePercent / 100;
    repairCost = Math.floor(repairCost * (1 - coverage));
  }

  if (gameState.stats.money < repairCost) {
    return { success: false, message: `You need $${repairCost.toLocaleString()} to repair this vehicle.` };
  }

  // Atomic: merge repair cost + condition update into single update
  setGameState(prev => {
    // R4-X5, same shape as `refuelVehicle`: the condition and money gates read
    // the stale outer snapshot and the debit floored at 0. A double tap paid
    // twice to repair an already-perfect vehicle. CLAUDE.md §4.4.
    const prevVehicle = (prev.vehicles || []).find(v => v.id === vehicleId);
    if (!prevVehicle || prevVehicle.condition >= 100) return prev;
    if ((prev.stats?.money ?? 0) < repairCost) return prev;

    return {
      ...prev,
      // Budget tab: repairs are transport spending.
      banking: prev.banking?.budgetSpend
        ? trackBudgetSpend(prev.banking, prev.weeksLived ?? 0, 'transport', repairCost)
        : prev.banking,
      stats: {
        ...prev.stats,
        money: prev.stats.money - repairCost,
      },
      vehicles: (prev.vehicles || []).map(v =>
        v.id === vehicleId ? { ...v, condition: 100, lastServiceWeek: prev.weeksLived || 0 } : v
      ),
    };
  });

  log.info(`Player repaired vehicle: ${vehicle.name}`);
  return { success: true, message: `Repaired ${vehicle.name} for $${repairCost.toLocaleString()}!` };
};

/**
 * Purchase insurance for a vehicle
 */
export const purchaseInsurance = (
  gameState: GameState,
  setGameState: Dispatch<SetStateAction<GameState>>,
  vehicleId: string,
  insuranceType: VehicleInsurance['type'],
  deps: { updateMoney: typeof updateMoney }
): { success: boolean; message: string } => {
  const vehicle = (gameState.vehicles || []).find(v => v.id === vehicleId);
  if (!vehicle) {
    return { success: false, message: 'Vehicle not found.' };
  }

  if (!insuranceType) {
    return { success: false, message: 'Insurance type is required.' };
  }

  const plan = getInsurancePlan(insuranceType);
  if (!plan || plan.monthlyCost === undefined) {
    return { success: false, message: 'Insurance plan not found.' };
  }

  // CRITICAL: Validate monthlyCost before calculation
  const monthlyCost = typeof plan.monthlyCost === 'number' && isFinite(plan.monthlyCost) && plan.monthlyCost >= 0 ? plan.monthlyCost : 0;
  if (monthlyCost === 0) {
    return { success: false, message: 'Invalid insurance plan cost' };
  }
  
  // Calculate 6-month premium (26 weeks)
  const premiumCost = monthlyCost * 6; // 6 months upfront
  
  // CRITICAL: Validate result before comparison
  if (!isFinite(premiumCost) || premiumCost < 0) {
    log.error(`Invalid premium cost calculated: ${premiumCost}`, { monthlyCost });
    return { success: false, message: 'Invalid insurance cost calculation' };
  }
  
  // CRITICAL: Validate money before comparison
  const currentMoney = typeof gameState.stats.money === 'number' && isFinite(gameState.stats.money) && gameState.stats.money >= 0 ? gameState.stats.money : 0;
  
  if (currentMoney < premiumCost) {
    return { success: false, message: `You need $${premiumCost.toLocaleString()} for 6 months of ${insuranceType} insurance.` };
  }

  // Safe string operations - ensure insuranceType is not empty
  const safeInsuranceType = insuranceType || 'insurance';
  const capitalizedType = safeInsuranceType.length > 0
    ? safeInsuranceType.charAt(0).toUpperCase() + safeInsuranceType.slice(1)
    : 'Insurance';
  
  // Atomic: merge insurance cost + insurance creation into single update
  // Reject buying over an active, unexpired policy — the old path silently
  // overwrote it, discarding the remaining prepaid premium with no refund.
  const existingPolicy = vehicle.insurance;
  const nowWeek = gameState.weeksLived ?? 0;
  if (existingPolicy?.active && (existingPolicy.expiresWeek ?? 0) > nowWeek) {
    return { success: false, message: 'This vehicle already has an active policy. Cancel it first (you get a prorated refund).' };
  }

  setGameState(prev => {
    const currentWeeksLived = typeof prev.weeksLived === 'number' && !isNaN(prev.weeksLived) && isFinite(prev.weeksLived) && prev.weeksLived >= 0 ? prev.weeksLived : 0;

    // Atomic re-checks against prev: policy still absent AND funds still
    // sufficient (the old Math.max(0, ...) clamp let a same-batch double-tap
    // charge a second premium the player couldn't afford).
    const prevVehicle = (prev.vehicles || []).find(v => v.id === vehicleId);
    if (!prevVehicle) return prev;
    if (prevVehicle.insurance?.active && (prevVehicle.insurance.expiresWeek ?? 0) > currentWeeksLived) return prev;
    if ((prev.stats?.money ?? 0) < premiumCost) return prev;

    const insurance: VehicleInsurance = {
      id: `${vehicleId}_${insuranceType}`,
      type: insuranceType,
      monthlyCost: monthlyCost,
      coveragePercent: plan.coveragePercent,
      active: true,
      expiresWeek: currentWeeksLived + 26, // 6 months (~26 weeks)
    };

    return {
      ...prev,
      // Budget tab: insurance premium (6 months upfront) is transport spending.
      banking: prev.banking?.budgetSpend
        ? trackBudgetSpend(prev.banking, currentWeeksLived, 'transport', premiumCost)
        : prev.banking,
      stats: {
        ...prev.stats,
        money: prev.stats.money - premiumCost,
      },
      vehicles: (prev.vehicles || []).map(v =>
        v.id === vehicleId ? { ...v, insurance } : v
      ),
    };
  });

  log.info(`Player purchased ${insuranceType} insurance for: ${vehicle.name}`);
  
  return { success: true, message: `${capitalizedType} insurance active for 6 months!` };
};

/**
 * Cancel insurance for a vehicle
 */
export const cancelInsurance = (
  gameState: GameState,
  setGameState: Dispatch<SetStateAction<GameState>>,
  vehicleId: string
): { success: boolean; message: string } => {
  const vehicle = (gameState.vehicles || []).find(v => v.id === vehicleId);
  if (!vehicle) {
    return { success: false, message: 'Vehicle not found.' };
  }

  if (!vehicle.insurance) {
    return { success: false, message: 'This vehicle has no insurance.' };
  }

  // R5-D: prorate the refund based on weeks remaining on the policy. The
  // previous "no refund" behavior turned insurance into a single-claim rental
  // exploit: buy 6 months for $X, force an accident (or just wait for one),
  // get the repair discount, then cancel and walk away from the rest of the
  // premium. A pro-rata refund — minus a $25 administrative fee — removes
  // the cancel-after-claim arbitrage without punishing legitimate cancels.
  const currentWeek = gameState.weeksLived ?? 0;
  // H-3 refund-printer fix: prorate against the ACTUAL premium paid and the
  // ACTUAL policy term, not a 4-week month. The premium is `monthlyCost * 6`
  // charged for a 26-week term (see purchaseInsurance), so a "month" here is
  // 26/6 ≈ 4.33 weeks. The previous formula divided weeksRemaining by 4, which
  // refunded up to 26/4 = 6.5 months of premium for a 6-month policy — so a
  // buy-then-immediately-cancel netted +$25..+$175 per cycle, repeatable. By
  // prorating `premiumPaid * remaining/term` and clamping to `premiumPaid`, the
  // refund can never exceed what was paid: cancelling only ever costs the $25
  // admin fee.
  const POLICY_TERM_WEEKS = 26; // matches the 6-month term set at purchase
  // Pure refund proration — also used INSIDE the updater against `prev` so a
  // same-batch double-cancel can't credit the refund twice (the first tap clears
  // `insurance`, the second sees it gone and returns prev). Mirrors the H-9
  // ownership re-check on sellVehicle.
  const computeRefund = (ins: VehicleInsurance, weeksLived: number): number => {
    const expires = ins.expiresWeek ?? weeksLived;
    const monthly = typeof ins.monthlyCost === 'number' && isFinite(ins.monthlyCost)
      ? ins.monthlyCost
      : 0;
    const premium = monthly * 6;
    const remaining = Math.min(POLICY_TERM_WEEKS, Math.max(0, expires - weeksLived));
    // 25 admin fee minimum; refund is the unused fraction of the premium paid.
    const raw = Math.floor(premium * (remaining / POLICY_TERM_WEEKS)) - 25;
    return Math.max(0, Math.min(premium, raw));
  };
  // Best-effort value for the user-facing message (recomputed authoritatively in
  // the updater below from `prev`).
  const refund = computeRefund(vehicle.insurance, currentWeek);
  setGameState(prev => {
    const prevVehicle = (prev.vehicles || []).find(v => v.id === vehicleId);
    if (!prevVehicle?.insurance) return prev; // already cancelled this batch

    const prevRefund = computeRefund(prevVehicle.insurance, prev.weeksLived ?? 0);
    return {
      ...prev,
      vehicles: (prev.vehicles || []).map(v =>
        v.id === vehicleId ? { ...v, insurance: undefined } : v
      ),
      stats: { ...prev.stats, money: Math.max(0, (prev.stats?.money ?? 0) + prevRefund) },
    };
  });

  log.info(`Player cancelled insurance for: ${vehicle.name} (refund $${refund})`);
  return {
    success: true,
    message: refund > 0
      ? `Insurance cancelled for ${vehicle.name}. Refund: $${refund.toLocaleString()} (pro-rata, less $25 admin fee).`
      : `Insurance cancelled for ${vehicle.name}. No refund — policy was already near expiry.`,
  };
};

/**
 * Set active vehicle
 */
export const setActiveVehicle = (
  gameState: GameState,
  setGameState: Dispatch<SetStateAction<GameState>>,
  vehicleId: string
): { success: boolean; message: string } => {
  const vehicle = (gameState.vehicles || []).find(v => v.id === vehicleId);
  if (!vehicle) {
    return { success: false, message: 'Vehicle not found.' };
  }

  setGameState(prev => ({
    ...prev,
    activeVehicleId: vehicleId,
  }));

  log.info(`Player set active vehicle: ${vehicle.name}`);
  return { success: true, message: `Now driving: ${vehicle.name}` };
};

/**
 * Process vehicle accident
 */
export const processAccident = (
  gameState: GameState,
  setGameState: Dispatch<SetStateAction<GameState>>,
  vehicleId: string,
  severity: AccidentSeverity,
  deps: { updateStats: typeof updateStats }
): { success: boolean; message: string; damage: number; healthLoss: number } => {
  const vehicle = (gameState.vehicles || []).find(v => v.id === vehicleId);
  if (!vehicle) {
    return { success: false, message: 'Vehicle not found.', damage: 0, healthLoss: 0 };
  }

  const damage = calculateAccidentDamage(severity);
  const newCondition = Math.max(0, vehicle.condition - damage);

  // Health damage based on severity (fallback 10 for unknown severity)
  const healthLoss = {
    minor: 5 + Math.floor(Math.random() * 5),
    moderate: 15 + Math.floor(Math.random() * 10),
    severe: 30 + Math.floor(Math.random() * 20),
    total: 50 + Math.floor(Math.random() * 30),
  }[severity] ?? 10;

  // Atomic: merge health damage + vehicle condition into single update
  setGameState(prev => {
    const newHealth = Math.max(0, Math.min(100, (prev.stats.health || 0) - healthLoss));

    if (severity === 'total') {
      // Total loss - remove vehicle
      const vehicles = (prev.vehicles || []).filter(v => v.id !== vehicleId);
      const activeVehicleId = prev.activeVehicleId === vehicleId
        ? (vehicles.length > 0 ? vehicles[0].id : undefined)
        : prev.activeVehicleId;

      return {
        ...prev,
        stats: { ...prev.stats, health: newHealth },
        vehicles,
        activeVehicleId,
      };
    } else {
      // Apply damage
      return {
        ...prev,
        stats: { ...prev.stats, health: newHealth },
        vehicles: (prev.vehicles || []).map(v =>
          v.id === vehicleId ? { ...v, condition: newCondition } : v
        ),
      };
    }
  });

  const messages = {
    minor: `Minor fender bender! ${vehicle.name} took ${damage}% damage.`,
    moderate: `Significant collision! ${vehicle.name} took ${damage}% damage.`,
    severe: `Serious accident! ${vehicle.name} took ${damage}% damage.`,
    total: `${vehicle.name} was totaled in the accident! The vehicle is a total loss.`,
  };

  log.info(`Vehicle accident: ${severity} - ${vehicle.name}`);
  return { success: true, message: messages[severity], damage, healthLoss };
};

/**
 * Process weekly vehicle maintenance.
 *
 * @deprecated SUPERSEDED — do NOT wire this into the weekly tick. The live
 * weekly path is `applyVehiclesForWeek` (contexts/game/actions/weekly/applyVehicles.ts),
 * wired in GameActionsContext.nextWeek(). This standalone updater duplicates the
 * maintenance/fuel/mileage/condition/insurance-expiry logic; calling it in the
 * same tick would double-charge upkeep. It is retained only because the vehicle
 * stress suite still exercises it directly; it must not be re-added to the tick.
 */
/**
 * @deprecated SUPERSEDED — do not wire this into the week loop.
 *
 * The live weekly vehicle tick is `applyVehiclesForWeek`
 * (`contexts/game/actions/weekly/applyVehicles.ts`). This is its pre-WeekContext
 * ancestor, and it has NO production caller — only its own stress tests, which
 * is precisely what let it rot unnoticed while looking maintained.
 *
 * It is kept because those tests still exercise real fuel/mileage/condition
 * arithmetic, but it has DIVERGED from the shipped economy in two ways that
 * make re-adopting it a regression:
 *
 *   · It charges with `Math.max(0, money - cost)`, silently forgiving what the
 *     player cannot pay. The live path routes shortfalls through
 *     `chargeOrDefer` into `overdueBalance` (v31 arrears), so mandatory costs
 *     have a failure state.
 *   · It has none of the accidents.ts model the live reducer uses.
 *
 * Its one behaviour the live path was MISSING — expiring a lapsed insurance
 * policy — has been moved into `applyVehiclesForWeek`. Before that move, a
 * single six-month premium bought permanent coverage.
 */
export const processVehicleWeekly = (
  gameState: GameState,
  setGameState: Dispatch<SetStateAction<GameState>>,
): { totalCosts: number; expiredInsurance: string[] } => {
  // CRITICAL: Validate vehicles array exists
  const vehicles = Array.isArray(gameState.vehicles) ? gameState.vehicles : [];
  if (vehicles.length === 0) {
    return { totalCosts: 0, expiredInsurance: [] };
  }

  // Pre-roll random values outside updater for React StrictMode safety
  const vehRolls = {
    fuelUsed: Array.from({ length: 10 }, () => Math.floor(Math.random() * 10)),
    mileageExtra: Array.from({ length: 10 }, () => Math.floor(Math.random() * 100)),
    wear: Array.from({ length: 10 }, () => 1 + Math.floor(Math.random() * 2)),
  };

  /**
   * NO PRODUCTION CALLER as of 2026-08-15 — the live weekly path is
   * `contexts/game/actions/weekly/applyVehicles.ts`, whose own comment calls
   * this "the pre-WeekContext version". Only the stress/insurance suites reach
   * it, and they drive `setGameState` with a synchronous stub.
   *
   * That matters because the two values below ARE the cross-updater capture
   * this repo spent 2026-08-15 removing everywhere else: assigned inside the
   * updater, read after it, and therefore only reliable for the FIRST
   * functional update of a React batch. It is left as-is deliberately — there
   * is no player-facing path to get wrong — but if you ever wire this into the
   * tick, derive the result from a pure helper first, the way
   * `computeStakingClaim` does in MiningActions.
   */
  let resultTotalCosts = 0;
  const resultExpiredInsurance: string[] = [];

  // Process vehicles inside updater to use fresh prev.vehicles (avoids stale closure)
  setGameState(prev => {
    const prevVehicles = Array.isArray(prev.vehicles) ? prev.vehicles : [];
    const currentWeeksLived = typeof prev.weeksLived === 'number' && !isNaN(prev.weeksLived) && isFinite(prev.weeksLived) && prev.weeksLived >= 0
      ? prev.weeksLived
      : 0;
    let totalCosts = 0;

    const updatedVehicles = prevVehicles.map((vehicle, vIdx) => {
      if (!vehicle) return vehicle;
      const updatedVehicle = { ...vehicle };

      // Fuel consumption
      const fuelLevel = typeof vehicle.fuelLevel === 'number' && isFinite(vehicle.fuelLevel) && vehicle.fuelLevel >= 0 && vehicle.fuelLevel <= 100 ? vehicle.fuelLevel : 100;
      const fuelUsed = Math.min(fuelLevel, 15 + (vehRolls.fuelUsed[vIdx] || 0));
      updatedVehicle.fuelLevel = Math.max(0, fuelLevel - fuelUsed);

      // Maintenance cost
      const maintenanceCost = typeof vehicle.weeklyMaintenanceCost === 'number' && isFinite(vehicle.weeklyMaintenanceCost) && vehicle.weeklyMaintenanceCost >= 0 ? vehicle.weeklyMaintenanceCost : 0;
      if (maintenanceCost > 0) totalCosts += maintenanceCost;

      // Fuel cost & mileage for active vehicle
      if (prev.activeVehicleId === vehicle.id) {
        const fuelCost = typeof vehicle.weeklyFuelCost === 'number' && isFinite(vehicle.weeklyFuelCost) && vehicle.weeklyFuelCost >= 0 ? vehicle.weeklyFuelCost : 0;
        if (fuelCost > 0) totalCosts += fuelCost;
        const currentMileage = typeof vehicle.mileage === 'number' && isFinite(vehicle.mileage) && vehicle.mileage >= 0 ? vehicle.mileage : 0;
        updatedVehicle.mileage = currentMileage + 200 + (vehRolls.mileageExtra[vIdx] || 0);
      }

      // Natural wear
      const currentCondition = typeof vehicle.condition === 'number' && isFinite(vehicle.condition) && vehicle.condition >= 0 && vehicle.condition <= 100 ? vehicle.condition : 100;
      updatedVehicle.condition = Math.max(0, currentCondition - (vehRolls.wear[vIdx] || 1));

      // Insurance expiry
      if (vehicle.insurance?.active) {
        const expiresWeek = typeof vehicle.insurance.expiresWeek === 'number' && !isNaN(vehicle.insurance.expiresWeek) && isFinite(vehicle.insurance.expiresWeek) ? vehicle.insurance.expiresWeek : 0;
        if (expiresWeek > 0 && currentWeeksLived >= expiresWeek) {
          const vehicleName = typeof vehicle.name === 'string' && vehicle.name.length > 0 ? vehicle.name : 'Unknown Vehicle';
          resultExpiredInsurance.push(vehicleName);
          updatedVehicle.insurance = { ...vehicle.insurance, active: false };
        }
      }

      return updatedVehicle;
    });

    const safeTotalCosts = isFinite(totalCosts) && totalCosts > 0 ? totalCosts : 0;
    resultTotalCosts = safeTotalCosts;

    return {
      ...prev,
      vehicles: updatedVehicles,
      stats: {
        ...prev.stats,
        money: Math.max(0, prev.stats.money - safeTotalCosts),
      },
    };
  });

  if (resultExpiredInsurance.length > 0) {
    log.info(`Insurance expired for: ${resultExpiredInsurance.join(', ')}`);
  }

  return { totalCosts: resultTotalCosts, expiredInsurance: resultExpiredInsurance };
};

const newLoanId = (): string =>
  `loan-auto-${Math.floor(Math.random() * 1e9).toString(36)}`;

/**
 * Quote the cost of buying a vehicle with an auto loan. Read-only.
 */
export function quoteVehiclePurchase(
  state: GameState,
  templateId: string,
  tier: AutoDownTier,
  term: AutoTerm,
  weeklyIncome: number
): {
  rejected: boolean;
  reason?: string;
  price?: number;
  downPaymentUSD?: number;
  loanPrincipal?: number;
  offeredAPR?: number;
  weeklyPayment?: number;
  totalCost?: number;
} {
  const template = VEHICLE_TEMPLATES.find((v) => v.id === templateId);
  if (!template) return { rejected: true, reason: 'Vehicle not found' };

  const cash = state.stats?.money ?? 0;
  // Vehicle templates don't carry a year — treat them all as current-model-year for LTV.
  const currentYear = (state.date?.year as number | undefined) ?? 2025;
  const vehicleYear = currentYear;
  const orig = originateAuto({
    price: template.price,
    tier,
    term,
    availableCash: cash,
    vehicleYear,
    currentYear,
  });
  const preflightErr = autoPreflight({
    price: template.price,
    tier,
    term,
    availableCash: cash,
    vehicleYear,
    currentYear,
  });
  if (preflightErr) return { rejected: true, reason: preflightErr };

  if (tier === 'cash') {
    return {
      rejected: false,
      price: template.price,
      downPaymentUSD: orig.downPaymentUSD,
      loanPrincipal: 0,
      offeredAPR: 0,
      weeklyPayment: 0,
      totalCost: orig.downPaymentUSD,
    };
  }

  const banking = state.banking;
  if (!banking) return { rejected: true, reason: 'Banking not initialized' };
  const quote = quoteLoan(banking, state.loans ?? [], {
    principal: orig.loanPrincipal,
    termWeeks: orig.termWeeks,
    type: 'auto',
    weeklyIncome,
    aprReduction: politicsAprReduction(state),
    // R3-M2 completion: this quote site was missed. Without the floor a
    // high-office player financed a car at the 2.5% hard minimum while a CD
    // pays 5.5% — the exact borrow-low/save-high carry
    // `lib/banking/rateEnvironment.ts` caps deposits to prevent.
    aprFloor: politicsAprReduction(state) > 0 ? POLITICS_LOAN_APR_FLOOR : undefined,
  });
  if (quote.rejected) return { rejected: true, reason: quote.reason };
  // The floor has to survive `orig.aprAdjustment` too, or the vehicle-specific
  // adjustment walks the rate straight back under it.
  const autoAprFloor = politicsAprReduction(state) > 0 ? POLITICS_LOAN_APR_FLOOR : 0.025;
  const adjustedAPR = Math.max(autoAprFloor, quote.offeredAPR + orig.aprAdjustment);
  const weekly = calculatePeriodicPayment(orig.loanPrincipal, adjustedAPR, orig.termWeeks);

  return {
    rejected: false,
    price: template.price,
    downPaymentUSD: orig.downPaymentUSD,
    loanPrincipal: orig.loanPrincipal,
    offeredAPR: adjustedAPR,
    weeklyPayment: weekly,
    totalCost: orig.downPaymentUSD + weekly * orig.termWeeks,
  };
}

/**
 * Buy a vehicle with the given down-payment tier + loan term. Creates a Loan
 * (type='auto') in the banking system, debits the down payment, and adds the
 * vehicle to gameState.vehicles.
 */
/** What the player is asking to buy, and how they are financing it. */
type BuyVehicleSpec = {
  templateId: string;
  tier: AutoDownTier;
  term: AutoTerm;
  weeklyIncome: number;
};

export const purchaseVehicleWithAutoLoan = (
  gameState: GameState,
  setGameState: Dispatch<SetStateAction<GameState>>,
  spec: BuyVehicleSpec
): { success: boolean; message: string } => {
  const preview = resolveBuyVehicle(gameState, spec);
  if (!preview.next) return preview.result;
  setGameState((prev) => resolveBuyVehicle(prev, spec).next ?? prev);
  return preview.result;
};

/**
 * PURE-ENOUGH: what does buying `spec` do to `state`?
 *
 * `next: null` means refuse. Called once against the caller's snapshot for the
 * outcome and once against `prev` for the state. `newLoanId()` inside is the
 * one impure step and is harmless: the preview's `next` is discarded, so only
 * the COMMIT's loan id is ever stored.
 *
 * ── Why (2026-08-15) ──────────────────────────────────────────────────────
 *
 * This used to hold `let result = { success: false, message: 'Purchase failed' }`
 * assigned from inside the updater and returned after the dispatch. A capture
 * is only readable for the FIRST functional update of a React batch, so a
 * deferred dispatch showed "Purchase failed" for a car the player had bought
 * and paid a down payment on. It is also the exact pattern whose adoption
 * across the other nine `VehicleActions` functions was REVERTED in an earlier
 * round when a stress test caught a successful refuel reporting failure — the
 * evidence was there, and this one was left carrying it.
 */
function resolveBuyVehicle(
  state: GameState,
  spec: BuyVehicleSpec
): { result: { success: boolean; message: string }; next: GameState | null } {
  {
    if (!state.hasDriversLicense) {
      return { result: { success: false, message: "You need a driver's license to purchase a vehicle!" }, next: null };
    }
    const template = VEHICLE_TEMPLATES.find((v) => v.id === spec.templateId);
    if (!template) {
      return { result: { success: false, message: 'Vehicle template not found' }, next: null };
    }
    if ((state.vehicles ?? []).some((v) => v.id === spec.templateId)) {
      return { result: { success: false, message: 'You already own this vehicle!' }, next: null };
    }
    const quote = quoteVehiclePurchase(state, spec.templateId, spec.tier, spec.term, spec.weeklyIncome);
    if (quote.rejected) {
      return { result: { success: false, message: quote.reason ?? 'Rejected' }, next: null };
    }

    const cash = state.stats?.money ?? 0;
    const downPayment = quote.downPaymentUSD ?? 0;
    // Route the down-payment debit through the canonical money helper
    // (MONEY_CEILING clamp + NaN/overdraft guard) instead of writing stats.money
    // directly — a corrupt (NaN) balance now rejects the purchase rather than
    // writing NaN money. The amount charged is unchanged.
    const spend = applyMoneyDelta(state, -downPayment, `Vehicle down payment: ${template.name}`);
    if (!spend) {
      return { result: { success: false, message: `You need $${Math.round(downPayment).toLocaleString()} down — you have $${Math.round(cash).toLocaleString()}.` }, next: null };
    }

    let updatedLoans = state.loans ?? [];
    if (spec.tier !== 'cash' && (quote.loanPrincipal ?? 0) > 0) {
      const loan: Loan = {
        id: newLoanId(),
        name: `Auto Loan: ${template.name}`,
        // Link the loan to its vehicle by id (createVehicleFromTemplate sets the
        // new vehicle's id to template.id === spec.templateId). The UI matches on
        // this instead of a fragile name substring.
        vehicleId: spec.templateId,
        principal: quote.loanPrincipal!,
        remaining: quote.loanPrincipal!,
        rateAPR: quote.offeredAPR!,
        originalAPR: quote.offeredAPR!,
        interestRate: quote.offeredAPR!,
        termWeeks: AUTO_TERM_WEEKS[spec.term],
        weeksRemaining: AUTO_TERM_WEEKS[spec.term],
        weeklyPayment: quote.weeklyPayment!,
        startWeek: state.weeksLived,
        autoPay: true,
        type: 'auto',
        onTimePayments: 0,
        latePayments: 0,
      };
      updatedLoans = [...updatedLoans, loan];
      log.info(
        `Auto loan: $${(quote.loanPrincipal ?? 0).toLocaleString()} @ ${((quote.offeredAPR ?? 0) * 100).toFixed(2)}% APR over ${AUTO_TERM_WEEKS[spec.term]}w`
      );
    }

    const newVehicle = createVehicleFromTemplate(template, state.weeksLived || 0);
    const vehicles = [...(state.vehicles ?? []), newVehicle];
    const activeVehicleId = state.activeVehicleId ?? newVehicle.id;

    // Budget tab: the down payment leaves cash today → transport spending.
    // The financed remainder is NOT recorded here; its weekly repayments are
    // tracked as 'debt' by the loan-payment path.
    const banking = state.banking?.budgetSpend
      ? trackBudgetSpend(state.banking, state.weeksLived ?? 0, 'transport', quote.downPaymentUSD ?? 0)
      : state.banking;

    // Grant the dealer-card / spec-grid "+X rep" once at purchase. The UI buys
    // exclusively through THIS path (BuyVehicleModal → purchaseVehicleWithAutoLoan),
    // so without this the advertised reputationBonus was never applied — only the
    // legacy, UI-unused purchaseVehicle granted it. Capped at 100 (Math.min); the
    // weekly tick's separate +1/wk nudge (capped at reputationBonus*3) is unchanged.
    const snapshotReputation = typeof state.stats?.reputation === 'number' && isFinite(state.stats.reputation)
      ? state.stats.reputation
      : 0;
    const grantedReputation = template.reputationBonus > 0
      ? Math.min(100, snapshotReputation + template.reputationBonus)
      : snapshotReputation;

    return {
      result: {
        success: true,
        message:
          spec.tier === 'cash'
            ? `Bought ${template.name} for $${template.price.toLocaleString()}`
            : `Financed ${template.name} — $${(quote.downPaymentUSD ?? 0).toLocaleString()} down, $${Math.round(quote.weeklyPayment ?? 0)}/wk`,
      },
      next: {
        ...state,
        ...spend,
        banking,
        stats: { ...spend.stats, reputation: grantedReputation },
        vehicles,
        activeVehicleId,
        loans: updatedLoans,
        // An auto loan is debt. See `debtProgress`.
        ...debtProgress(state, updatedLoans.length > (state.loans ?? []).length),
      },
    };
  }
}


// ---------------------------------------------------------------------------
// Scooter / moped rentals — the first rung of the transport ladder
// ---------------------------------------------------------------------------
//
// Deliberately NOT routed through purchaseVehicle: that path demands a driver's
// licence and rejects a zero price. Both are correct for cars and wrong here —
// needing no licence is exactly why a rented scooter is the option a broke
// 18-year-old can reach, and the "price" of a rental is its weekly fee, not a
// sticker price.
//
// The rental is stored as an ordinary Vehicle whose `weeklyMaintenanceCost` is
// the weekly fee, so the existing weekly vehicle tick bills it, lapses it when
// the player can't pay, and reports it in the weekly finance breakdown with no
// new code and no new GameState field.

/**
 * Start a scooter/moped rental. Charges the signup fee up front; the weekly fee
 * is collected by the ordinary vehicle weekly tick from here on.
 */
export const startScooterRental = (
  gameState: GameState,
  setGameState: Dispatch<SetStateAction<GameState>>,
  planId: string
): { success: boolean; message: string } => {
  const blocked = rejectIfBlocked(gameState);
  if (blocked) return blocked;

  const plan = getRentalPlan(planId);
  if (!plan) {
    log.error(`Rental plan ${planId} not found`);
    return { success: false, message: 'That rental is not available.' };
  }

  const existing = getActiveRental(gameState);
  if (existing) {
    return {
      success: false,
      message: `You're already on the ${existing.plan.name}. End it first to switch.`,
    };
  }

  const money = typeof gameState.stats?.money === 'number' && isFinite(gameState.stats.money)
    ? gameState.stats.money
    : 0;
  if (money < plan.signupFee) {
    return { success: false, message: `You need $${plan.signupFee} to sign up.` };
  }

  setGameState(prev => {
    // Re-check against `prev` so a double-tap can't sign up twice and charge
    // the fee twice (same guard shape as purchaseVehicle/sellVehicle).
    if (getActiveRental(prev)) return prev;

    const credit = applyMoneyDelta(prev, -plan.signupFee, `${plan.name} signup`);
    if (!credit) return prev;

    const rental: Vehicle = {
      id: plan.id,
      name: plan.name,
      // 'bicycle' is the closest existing type; a rental is not a car and must
      // never be picked up by car-only logic (insurance, accidents, licences).
      type: 'bicycle',
      brand: 'Rental',
      model: plan.name,
      year: (prev.date?.year ?? 2000),
      price: 0,
      condition: 100,
      fuelLevel: 100,
      fuelCapacity: 0,
      fuelEfficiency: 0,
      mileage: 0,
      // THE rental fee. Billed weekly by the existing vehicle tick.
      weeklyMaintenanceCost: plan.weeklyPrice,
      weeklyFuelCost: 0,
      maxSpeed: plan.tier === 'moped' ? 30 : 15,
      owned: true,
      reputationBonus: 0,
      speedBonus: plan.tier === 'moped' ? 6 : 3,
    };

    return {
      ...prev,
      ...credit,
      vehicles: [...(prev.vehicles || []), rental],
    };
  });

  log.info(`Started rental: ${plan.id}`);
  return {
    success: true,
    message: `${plan.name} active — $${plan.weeklyPrice}/wk. Delivery work is open to you now.`,
  };
};

/**
 * End the active rental. No resale value — you never owned it. That asymmetry
 * against selling a bike is the whole cost of renting, and it is what makes
 * buying the upgrade feel earned.
 */
export const endScooterRental = (
  gameState: GameState,
  setGameState: Dispatch<SetStateAction<GameState>>
): { success: boolean; message: string } => {
  const active = getActiveRental(gameState);
  if (!active) {
    return { success: false, message: 'You have no rental to end.' };
  }

  setGameState(prev => {
    const stillActive = getActiveRental(prev);
    if (!stillActive) return prev;
    const vehicles = (prev.vehicles || []).filter(v => v.id !== stillActive.vehicle.id);
    return {
      ...prev,
      vehicles,
      activeVehicleId: prev.activeVehicleId === stillActive.vehicle.id
        ? (vehicles.length > 0 ? vehicles[0].id : undefined)
        : prev.activeVehicleId,
    };
  });

  log.info(`Ended rental: ${active.plan.id}`);
  return {
    success: true,
    message: `${active.plan.name} ended. No more weekly charge.`,
  };
};


/**
 * Get a pilot's licence. Mirrors `getDriversLicense`: age gate, cash gate,
 * atomic grant. Required before any aircraft can be purchased.
 */
export const getPilotLicense = (
  gameState: GameState,
  setGameState: Dispatch<SetStateAction<GameState>>
): { success: boolean; message: string } => {
  if (gameState.hasPilotLicense) {
    return { success: false, message: 'You already have a pilot\'s license!' };
  }
  if ((gameState.date?.age ?? 0) < PILOT_LICENSE.minAge) {
    return {
      success: false,
      message: `You must be at least ${PILOT_LICENSE.minAge} to train for a pilot's license.`,
    };
  }
  const money = typeof gameState.stats?.money === 'number' && isFinite(gameState.stats.money)
    ? gameState.stats.money
    : 0;
  if (money < PILOT_LICENSE.cost) {
    return {
      success: false,
      message: `Flight training costs $${PILOT_LICENSE.cost.toLocaleString()}.`,
    };
  }

  setGameState(prev => {
    // Re-check against fresh state so a double-tap can't charge twice.
    if (prev.hasPilotLicense) return prev;
    const spend = applyMoneyDelta(prev, -PILOT_LICENSE.cost, 'Pilot license training');
    if (!spend) return prev;
    return { ...prev, ...spend, hasPilotLicense: true };
  });

  log.info('Player obtained pilot license');
  return { success: true, message: 'Licensed to fly. The sky just got a lot smaller.' };
};
