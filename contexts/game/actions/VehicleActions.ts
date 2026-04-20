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
import { logger } from '@/utils/logger';
import { updateMoney } from './MoneyActions';
import { updateStats } from './StatsActions';
import {
  VEHICLE_TEMPLATES,
  INSURANCE_PLANS,
  DRIVERS_LICENSE,
  VehicleTemplate,
  createVehicleFromTemplate,
  calculateVehicleSellPrice,
  calculateRepairCost,
  calculateFuelCost,
  getInsurancePlan,
  calculateAccidentDamage,
  AccidentSeverity,
} from '@/lib/vehicles/vehicles';
import type { Dispatch, SetStateAction } from 'react';

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
  setGameState(prev => ({
    ...prev,
    stats: {
      ...prev.stats,
      money: Math.max(0, prev.stats.money - DRIVERS_LICENSE.cost),
    },
    hasDriversLicense: true,
  }));

  log.info('Player obtained driver\'s license');
  return { success: true, message: 'Congratulations! You now have a driver\'s license!' };
};

/**
 * Purchase a vehicle
 */
export const purchaseVehicle = (
  gameState: GameState,
  setGameState: Dispatch<SetStateAction<GameState>>,
  vehicleId: string,
  deps: { updateMoney: typeof updateMoney; updateStats: typeof updateStats }
): { success: boolean; message: string } => {
  // Check if has driver's license
  if (!gameState.hasDriversLicense) {
    return { success: false, message: 'You need a driver\'s license to purchase a vehicle!' };
  }

  // Find vehicle template
  const template = VEHICLE_TEMPLATES.find(v => v.id === vehicleId);
  if (!template) {
    log.error(`Vehicle template ${vehicleId} not found`);
    return { success: false, message: 'Vehicle not found.' };
  }

  // CRITICAL: Validate template price before comparison
  const vehiclePrice = typeof template.price === 'number' && isFinite(template.price) && template.price >= 0 ? template.price : 0;
  if (vehiclePrice === 0) {
    log.error(`Invalid price for vehicle ${vehicleId}: ${template.price}`);
    return { success: false, message: 'Invalid vehicle price' };
  }

  // Check reputation requirement
  const requiredReputation = typeof template.requiredReputation === 'number' && isFinite(template.requiredReputation) && template.requiredReputation >= 0 ? template.requiredReputation : 0;
  const currentReputation = typeof gameState.stats.reputation === 'number' && isFinite(gameState.stats.reputation) && gameState.stats.reputation >= 0 ? gameState.stats.reputation : 0;
  if (requiredReputation > 0 && currentReputation < requiredReputation) {
    return { success: false, message: `You need ${requiredReputation} reputation to purchase this vehicle.` };
  }

  // CRITICAL: Validate money before comparison
  const currentMoney = typeof gameState.stats.money === 'number' && isFinite(gameState.stats.money) && gameState.stats.money >= 0 ? gameState.stats.money : 0;
  
  // Check if can afford
  if (currentMoney < vehiclePrice) {
    return { success: false, message: `You need $${vehiclePrice.toLocaleString()} to purchase this vehicle.` };
  }

  // Check if already owns this vehicle
  const existingVehicle = (gameState.vehicles || []).find(v => v.id === vehicleId);
  if (existingVehicle) {
    return { success: false, message: 'You already own this vehicle!' };
  }

  // Create vehicle and add to state
  const newVehicle = createVehicleFromTemplate(template, gameState.weeksLived || 0);

  // CRITICAL FIX: Combine money update and vehicle update into a single atomic state update
  // This prevents race conditions where the second setGameState might overwrite the money update
  setGameState(prev => {
    // Validate and calculate new money value
    const prevMoney = typeof prev.stats.money === 'number' && !isNaN(prev.stats.money) 
      ? prev.stats.money 
      : 0;
    const newMoney = Math.max(0, prevMoney - vehiclePrice);
    const moneyChange = newMoney - prevMoney;

    // Update vehicles
    const vehicles = [...(prev.vehicles || []), newVehicle];
    // Set as active if it's the first vehicle
    const activeVehicleId = prev.activeVehicleId || newVehicle.id;

    // Update daily summary
    let dailySummary = prev.dailySummary;
    if (dailySummary) {
      dailySummary = {
        ...dailySummary,
        moneyChange: (dailySummary.moneyChange || 0) + moneyChange,
        totalMoneySpent: (dailySummary.totalMoneySpent || 0) + Math.max(0, -moneyChange),
        statsChange: { ...(dailySummary.statsChange || {}) },
        events: [...(dailySummary.events || [])],
      };
    }

    // Log significant transactions
    if (Math.abs(moneyChange) > 1000) {
      log.info(`Vehicle purchase: ${moneyChange > 0 ? '+' : ''}${moneyChange} (Vehicle Purchase: ${template.name})`);
    }

    return {
      ...prev,
      stats: {
        ...prev.stats,
        money: newMoney,
        reputation: template.reputationBonus > 0
          ? Math.min(100, (prev.stats.reputation || 0) + template.reputationBonus)
          : (prev.stats.reputation || 0),
      },
      vehicles,
      activeVehicleId,
      dailySummary,
    };
  });

  log.info(`Player purchased vehicle: ${template.name}`);
  return { success: true, message: `Congratulations! You are now the proud owner of a ${template.name}!` };
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
    const vehicles = (prev.vehicles || []).filter(v => v.id !== vehicleId);
    const activeVehicleId = prev.activeVehicleId === vehicleId
      ? (vehicles.length > 0 ? vehicles[0].id : undefined)
      : prev.activeVehicleId;

    return {
      ...prev,
      stats: {
        ...prev.stats,
        money: prev.stats.money + sellPrice,
        reputation: Math.max(0, (prev.stats.reputation || 0) + repLoss),
      },
      vehicles,
      activeVehicleId,
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
  deps: { updateMoney: typeof updateMoney }
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
  setGameState(prev => ({
    ...prev,
    stats: {
      ...prev.stats,
      money: Math.max(0, prev.stats.money - fuelCost),
    },
    vehicles: (prev.vehicles || []).map(v =>
      v.id === vehicleId ? { ...v, fuelLevel: 100 } : v
    ),
  }));

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
  setGameState(prev => ({
    ...prev,
    stats: {
      ...prev.stats,
      money: Math.max(0, prev.stats.money - repairCost),
    },
    vehicles: (prev.vehicles || []).map(v =>
      v.id === vehicleId ? { ...v, condition: 100, lastServiceWeek: prev.weeksLived || 0 } : v
    ),
  }));

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
  setGameState(prev => {
    const currentWeeksLived = typeof prev.weeksLived === 'number' && !isNaN(prev.weeksLived) && isFinite(prev.weeksLived) && prev.weeksLived >= 0 ? prev.weeksLived : 0;

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
      stats: {
        ...prev.stats,
        money: Math.max(0, prev.stats.money - premiumCost),
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

  // Remove insurance (no refund for early cancellation)
  setGameState(prev => ({
    ...prev,
    vehicles: (prev.vehicles || []).map(v =>
      v.id === vehicleId ? { ...v, insurance: undefined } : v
    ),
  }));

  log.info(`Player cancelled insurance for: ${vehicle.name}`);
  return { success: true, message: `Insurance cancelled for ${vehicle.name}. No refund for early cancellation.` };
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
 * Process weekly vehicle maintenance
 * Called every week to deduct fuel/maintenance costs and check insurance expiry
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

  // NOTE: These are written from inside the updater to return results to callers.
  // Safe under StrictMode because both invocations produce identical values.
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

/**
 * Get total reputation bonus from all owned vehicles
 */
export const getTotalVehicleReputationBonus = (gameState: GameState): number => {
  const vehicles = gameState.vehicles || [];
  return vehicles.reduce((total, vehicle) => total + (vehicle.reputationBonus || 0), 0);
};

/**
 * Get active vehicle's speed bonus (travel time reduction)
 */
export const getActiveVehicleSpeedBonus = (gameState: GameState): number => {
  if (!gameState.activeVehicleId) return 0;
  const vehicle = (gameState.vehicles || []).find(v => v.id === gameState.activeVehicleId);
  if (!vehicle || vehicle.condition < 20 || vehicle.fuelLevel < 10) return 0; // Must be in usable condition
  return vehicle.speedBonus || 0;
};

