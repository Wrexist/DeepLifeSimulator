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

  // Deduct cost
  deps.updateMoney(setGameState, -DRIVERS_LICENSE.cost, "Driver's License");

  // Update state
  setGameState(prev => ({
    ...prev,
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

  // Check reputation requirement
  if (template.requiredReputation && gameState.stats.reputation < template.requiredReputation) {
    return { success: false, message: `You need ${template.requiredReputation} reputation to purchase this vehicle.` };
  }

  // Check if can afford
  if (gameState.stats.money < template.price) {
    return { success: false, message: `You need $${template.price.toLocaleString()} to purchase this vehicle.` };
  }

  // Check if already owns this vehicle
  const existingVehicle = (gameState.vehicles || []).find(v => v.id === vehicleId);
  if (existingVehicle) {
    return { success: false, message: 'You already own this vehicle!' };
  }

  // Deduct cost
  deps.updateMoney(setGameState, -template.price, `Vehicle Purchase: ${template.name}`);

  // Create vehicle and add to state
  const newVehicle = createVehicleFromTemplate(template, gameState.week);

  setGameState(prev => {
    const vehicles = [...(prev.vehicles || []), newVehicle];
    // Set as active if it's the first vehicle
    const activeVehicleId = prev.activeVehicleId || newVehicle.id;
    
    return {
      ...prev,
      vehicles,
      activeVehicleId,
    };
  });

  // Apply reputation bonus
  if (template.reputationBonus > 0) {
    deps.updateStats(setGameState, { reputation: template.reputationBonus });
  }

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

  // Add money from sale
  deps.updateMoney(setGameState, sellPrice, `Vehicle Sale: ${vehicle.name}`);

  // Remove vehicle from state
  setGameState(prev => {
    const vehicles = (prev.vehicles || []).filter(v => v.id !== vehicleId);
    // If selling active vehicle, set new active to first vehicle or null
    const activeVehicleId = prev.activeVehicleId === vehicleId
      ? (vehicles.length > 0 ? vehicles[0].id : undefined)
      : prev.activeVehicleId;

    return {
      ...prev,
      vehicles,
      activeVehicleId,
    };
  });

  // Remove reputation bonus
  const template = VEHICLE_TEMPLATES.find(t => t.id === vehicleId);
  if (template && template.reputationBonus > 0) {
    deps.updateStats(setGameState, { reputation: -Math.floor(template.reputationBonus / 2) }); // Lose half the rep bonus
  }

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

  // Deduct cost
  deps.updateMoney(setGameState, -fuelCost, `Fuel: ${vehicle.name}`);

  // Update vehicle fuel level
  setGameState(prev => ({
    ...prev,
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

  // Deduct cost
  deps.updateMoney(setGameState, -repairCost, `Repair: ${vehicle.name}`);

  // Update vehicle condition
  setGameState(prev => ({
    ...prev,
    vehicles: (prev.vehicles || []).map(v =>
      v.id === vehicleId ? { ...v, condition: 100, lastServiceWeek: prev.week } : v
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

  const plan = getInsurancePlan(insuranceType);
  if (!plan) {
    return { success: false, message: 'Insurance plan not found.' };
  }

  // Calculate 6-month premium (26 weeks)
  const premiumCost = plan.monthlyCost * 6; // 6 months upfront
  
  if (gameState.stats.money < premiumCost) {
    return { success: false, message: `You need $${premiumCost.toLocaleString()} for 6 months of ${insuranceType} insurance.` };
  }

  // Deduct cost
  deps.updateMoney(setGameState, -premiumCost, `${insuranceType.charAt(0).toUpperCase() + insuranceType.slice(1)} Insurance: ${vehicle.name}`);

  // Create insurance
  const insurance: VehicleInsurance = {
    id: `${vehicleId}_${insuranceType}`,
    type: insuranceType,
    monthlyCost: plan.monthlyCost,
    coveragePercent: plan.coveragePercent,
    active: true,
    expiresWeek: gameState.week + 26, // 6 months
  };

  // Update vehicle with insurance
  setGameState(prev => ({
    ...prev,
    vehicles: (prev.vehicles || []).map(v =>
      v.id === vehicleId ? { ...v, insurance } : v
    ),
  }));

  log.info(`Player purchased ${insuranceType} insurance for: ${vehicle.name}`);
  return { success: true, message: `${insuranceType.charAt(0).toUpperCase() + insuranceType.slice(1)} insurance active for 6 months!` };
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
      v.id === vehicleId ? { ...v, insurance: null } : v
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

  // Health damage based on severity
  const healthLoss = {
    minor: 5 + Math.floor(Math.random() * 5),
    moderate: 15 + Math.floor(Math.random() * 10),
    severe: 30 + Math.floor(Math.random() * 20),
    total: 50 + Math.floor(Math.random() * 30),
  }[severity];

  // Apply health damage
  deps.updateStats(setGameState, { health: -healthLoss });

  // Update vehicle condition
  if (severity === 'total') {
    // Total loss - remove vehicle
    setGameState(prev => {
      const vehicles = (prev.vehicles || []).filter(v => v.id !== vehicleId);
      const activeVehicleId = prev.activeVehicleId === vehicleId
        ? (vehicles.length > 0 ? vehicles[0].id : undefined)
        : prev.activeVehicleId;

      return {
        ...prev,
        vehicles,
        activeVehicleId,
      };
    });
  } else {
    // Apply damage
    setGameState(prev => ({
      ...prev,
      vehicles: (prev.vehicles || []).map(v =>
        v.id === vehicleId ? { ...v, condition: newCondition } : v
      ),
    }));
  }

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
  deps: { updateMoney: typeof updateMoney }
): { totalCosts: number; expiredInsurance: string[] } => {
  const vehicles = gameState.vehicles || [];
  if (vehicles.length === 0) {
    return { totalCosts: 0, expiredInsurance: [] };
  }

  let totalCosts = 0;
  const expiredInsurance: string[] = [];
  const currentWeek = gameState.week;

  // Process each vehicle
  const updatedVehicles = vehicles.map(vehicle => {
    let updatedVehicle = { ...vehicle };

    // Deduct weekly fuel cost (based on usage)
    const fuelUsed = Math.min(vehicle.fuelLevel, 15 + Math.floor(Math.random() * 10)); // Use 15-25% fuel per week
    updatedVehicle.fuelLevel = Math.max(0, vehicle.fuelLevel - fuelUsed);

    // Add weekly maintenance cost
    totalCosts += vehicle.weeklyMaintenanceCost;

    // Add weekly fuel cost if using vehicle
    if (gameState.activeVehicleId === vehicle.id) {
      totalCosts += vehicle.weeklyFuelCost;
      // Add mileage
      updatedVehicle.mileage = (vehicle.mileage || 0) + 200 + Math.floor(Math.random() * 100);
    }

    // Natural wear: condition decreases 1-2% per week
    const wear = 1 + Math.floor(Math.random() * 2);
    updatedVehicle.condition = Math.max(0, vehicle.condition - wear);

    // Check insurance expiry
    if (vehicle.insurance?.active && currentWeek >= vehicle.insurance.expiresWeek) {
      expiredInsurance.push(vehicle.name);
      updatedVehicle.insurance = { ...vehicle.insurance, active: false };
    }

    return updatedVehicle;
  });

  // Deduct total costs
  if (totalCosts > 0) {
    deps.updateMoney(setGameState, -totalCosts, 'Vehicle Maintenance & Fuel');
  }

  // Update vehicles
  setGameState(prev => ({
    ...prev,
    vehicles: updatedVehicles,
  }));

  if (expiredInsurance.length > 0) {
    log.info(`Insurance expired for: ${expiredInsurance.join(', ')}`);
  }

  return { totalCosts, expiredInsurance };
};

/**
 * Get total reputation bonus from all owned vehicles
 */
export const getTotalVehicleReputationBonus = (gameState: GameState): number => {
  const vehicles = gameState.vehicles || [];
  return vehicles.reduce((total, vehicle) => total + vehicle.reputationBonus, 0);
};

/**
 * Get active vehicle's speed bonus (travel time reduction)
 */
export const getActiveVehicleSpeedBonus = (gameState: GameState): number => {
  if (!gameState.activeVehicleId) return 0;
  const vehicle = (gameState.vehicles || []).find(v => v.id === gameState.activeVehicleId);
  if (!vehicle || vehicle.condition < 20 || vehicle.fuelLevel < 10) return 0; // Must be in usable condition
  return vehicle.speedBonus;
};

