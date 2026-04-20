/**
 * Company Actions
 */
import React from 'react';
import { GameState, Company, CompanyUpgrade } from '../types';
import { logger } from '@/utils/logger';
import { updateMoney } from './MoneyActions';
import { getInflatedPrice } from '@/lib/economy/inflation';

const log = logger.scope('CompanyActions');

export const createCompany = (
  gameState: GameState,
  setGameState: React.Dispatch<React.SetStateAction<GameState>>,
  companyType: string,
  deps: { updateMoney: typeof updateMoney }
) => {
  // Ensure companyType is a string
  if (typeof companyType !== 'string') {
    log.error('createCompany: companyType must be a string', { companyType });
    return { success: false, message: 'Invalid company type' };
  }

  const companyCosts = {
    factory: 50000,
    ai: 90000,
    restaurant: 130000,
    realestate: 200000,
    bank: 2000000,
  } as const;

  const baseCost = companyCosts[companyType as keyof typeof companyCosts];
  if (!baseCost) {
    return { success: false, message: 'Unknown company type' };
  }

  // CRITICAL: Validate priceIndex before calculation
  const priceIndex = typeof gameState.economy?.priceIndex === 'number' && isFinite(gameState.economy.priceIndex) && gameState.economy.priceIndex > 0 ? gameState.economy.priceIndex : 1;
  const cost = getInflatedPrice(baseCost, priceIndex);
  
  // CRITICAL: Validate cost before comparison
  if (!isFinite(cost) || cost < 0) {
    log.error(`Invalid cost calculated for company ${companyType}: ${cost}`, { baseCost, priceIndex });
    return { success: false, message: 'Invalid company cost' };
  }
  
  // CRITICAL: Validate money before comparison
  const currentMoney = typeof gameState.stats.money === 'number' && isFinite(gameState.stats.money) && gameState.stats.money >= 0 ? gameState.stats.money : 0;
  
  if (currentMoney < cost) {
    return { success: false, message: 'Insufficient funds' };
  }

  if ((gameState.companies || []).find(c => c.id === companyType)) {
    return { success: false, message: 'You already own this company type' };
  }

  const hasEntrepreneurshipEducation = (gameState.educations || []).find(
    e => e.id === 'entrepreneurship'
  )?.completed;
  
  if (!hasEntrepreneurshipEducation) {
    return { success: false, message: 'You need to complete Entrepreneurship Course first!' };
  }

  // Logic moved from company.ts but adapted for split architecture
  const workerConfigs = {
    factory: { salary: 500 },
    ai: { salary: 2000 },
    restaurant: { salary: 400 },
    realestate: { salary: 1500 },
    bank: { salary: 5000 },
  } as const;

  const workerConfig = workerConfigs[companyType as keyof typeof workerConfigs];

  // Safe string operations - ensure companyType is not empty
  const safeCompanyType = companyType || 'company';
  const capitalizedType = safeCompanyType.length > 0
    ? safeCompanyType.charAt(0).toUpperCase() + safeCompanyType.slice(1)
    : 'Company';
  
  const newCompany: Company = {
    id: companyType,
    name: `My ${capitalizedType}`,
    type: companyType as Company['type'],
    weeklyIncome: 2000,
    baseWeeklyIncome: 2000,
    upgrades: [], // Start with no upgrades
    employees: 0,
    workerSalary: workerConfig.salary,
    workerMultiplier: 1.1,
    marketingLevel: 1,
    miners: {},
    warehouseLevel: 0,
  };

  // Atomic: deduct money and add company in a single state update to prevent race conditions
  setGameState(prev => {
    const prevMoney = prev.stats?.money ?? 0;
    if (prevMoney < cost) return prev; // Re-check affordability against fresh state
    return {
      ...prev,
      companies: [...(prev.companies || []), newCompany],
      company: prev.company ?? newCompany,
      stats: {
        ...prev.stats,
        money: prevMoney - cost,
      },
    };
  });

  return { success: true, companyId: newCompany.id };
};

export const buyCompanyUpgrade = (
  gameState: GameState,
  setGameState: Dispatch<SetStateAction<GameState>>,
  upgradeId: string,
  deps: { updateMoney: typeof updateMoney },
  companyId?: string
): { success: boolean; message: string } => {
  const targetId = companyId || gameState.company?.id;
  if (!targetId) {
    return { success: false, message: 'No company selected.' };
  }

  const companyIndex = (gameState.companies || []).findIndex(c => c.id === targetId);
  if (companyIndex === -1) {
    return { success: false, message: 'Company not found.' };
  }

  // Get the company's available upgrades
  const company = (gameState.companies || []).find(c => c.id === targetId);
  if (!company) {
    return { success: false, message: 'Company not found.' };
  }
  
  const companyType = company.type;
  
  // Define company upgrades locally
  const companyUpgrades: Record<string, any[]> = {
    factory: [
      { id: 'machinery', name: 'Better Machinery', description: 'Increase production efficiency', cost: 10000, weeklyIncomeBonus: 500, level: 1, maxLevel: 5 },
      { id: 'workers', name: 'More Workers', description: 'Hire additional staff', cost: 15000, weeklyIncomeBonus: 800, level: 1, maxLevel: 3 },
      { id: 'automation', name: 'Assembly Line', description: 'Automated production line', cost: 25000, weeklyIncomeBonus: 1200, level: 1, maxLevel: 4 },
      { id: 'quality_control', name: 'Quality Control', description: 'Advanced quality assurance', cost: 20000, weeklyIncomeBonus: 1000, level: 1, maxLevel: 3 },
      { id: 'warehouse', name: 'Smart Warehouse', description: 'Automated inventory management', cost: 30000, weeklyIncomeBonus: 1500, level: 1, maxLevel: 3 },
      { id: 'safety', name: 'Safety Systems', description: 'Workplace safety improvements', cost: 18000, weeklyIncomeBonus: 800, level: 1, maxLevel: 4 },
    ],
    ai: [
      { id: 'servers', name: 'Better Servers', description: 'Upgrade computing power', cost: 25000, weeklyIncomeBonus: 1200, level: 1, maxLevel: 4 },
      { id: 'algorithms', name: 'Advanced Algorithms', description: 'Improve AI capabilities', cost: 30000, weeklyIncomeBonus: 1500, level: 1, maxLevel: 3 },
      { id: 'gpu_cluster', name: 'GPU Cluster', description: 'Faster AI training', cost: 50000, weeklyIncomeBonus: 2500, level: 1, maxLevel: 3 },
      { id: 'data_center', name: 'Data Center', description: 'Scale operations', cost: 75000, weeklyIncomeBonus: 3500, level: 1, maxLevel: 2 },
      { id: 'ai_researchers', name: 'AI Researchers', description: 'Cutting-edge research team', cost: 40000, weeklyIncomeBonus: 2000, level: 1, maxLevel: 4 },
      { id: 'machine_learning', name: 'ML Platform', description: 'Machine learning infrastructure', cost: 60000, weeklyIncomeBonus: 3000, level: 1, maxLevel: 3 },
    ],
    restaurant: [
      { id: 'kitchen', name: 'Kitchen Upgrade', description: 'Modernize kitchen equipment', cost: 20000, weeklyIncomeBonus: 1000, level: 1, maxLevel: 4 },
      { id: 'staff', name: 'Professional Staff', description: 'Hire experienced chefs', cost: 18000, weeklyIncomeBonus: 900, level: 1, maxLevel: 3 },
      { id: 'delivery_service', name: 'Delivery Service', description: 'Expand customer reach', cost: 25000, weeklyIncomeBonus: 1200, level: 1, maxLevel: 3 },
      { id: 'michelin_chef', name: 'Michelin Chef', description: 'Premium dining experience', cost: 40000, weeklyIncomeBonus: 2000, level: 1, maxLevel: 2 },
      { id: 'interior_design', name: 'Interior Design', description: 'Upscale dining atmosphere', cost: 30000, weeklyIncomeBonus: 1500, level: 1, maxLevel: 3 },
      { id: 'wine_cellar', name: 'Wine Cellar', description: 'Premium wine selection', cost: 35000, weeklyIncomeBonus: 1800, level: 1, maxLevel: 2 },
    ],
    realestate: [
      { id: 'properties', name: 'More Properties', description: 'Expand property portfolio', cost: 50000, weeklyIncomeBonus: 2000, level: 1, maxLevel: 5 },
      { id: 'management', name: 'Property Management', description: 'Improve property management', cost: 30000, weeklyIncomeBonus: 1500, level: 1, maxLevel: 3 },
      { id: 'property_portfolio', name: 'Property Portfolio', description: 'More rental properties', cost: 75000, weeklyIncomeBonus: 3000, level: 1, maxLevel: 4 },
      { id: 'commercial_real_estate', name: 'Commercial Properties', description: 'Higher value investments', cost: 100000, weeklyIncomeBonus: 4000, level: 1, maxLevel: 3 },
      { id: 'property_management', name: 'Property Management', description: 'Professional management', cost: 40000, weeklyIncomeBonus: 2000, level: 1, maxLevel: 3 },
      { id: 'luxury_developments', name: 'Luxury Developments', description: 'High-end property development', cost: 150000, weeklyIncomeBonus: 6000, level: 1, maxLevel: 2 },
    ],
    bank: [
      { id: 'technology', name: 'Banking Technology', description: 'Upgrade banking systems', cost: 100000, weeklyIncomeBonus: 5000, level: 1, maxLevel: 4 },
      { id: 'services', name: 'Financial Services', description: 'Expand financial services', cost: 80000, weeklyIncomeBonus: 4000, level: 1, maxLevel: 3 },
      { id: 'investment_division', name: 'Investment Division', description: 'Wealth management services', cost: 200000, weeklyIncomeBonus: 10000, level: 1, maxLevel: 3 },
      { id: 'international_banking', name: 'International Banking', description: 'Global operations', cost: 300000, weeklyIncomeBonus: 15000, level: 1, maxLevel: 2 },
      { id: 'fintech_integration', name: 'FinTech Integration', description: 'Digital banking solutions', cost: 150000, weeklyIncomeBonus: 7500, level: 1, maxLevel: 3 },
      { id: 'private_banking', name: 'Private Banking', description: 'Exclusive client services', cost: 250000, weeklyIncomeBonus: 12000, level: 1, maxLevel: 2 },
    ],
  };
  
  const availableUpgrades = companyUpgrades[companyType] || [];
  const upgradeDefinition = availableUpgrades.find((u: { id: string }) => u.id === upgradeId);
  if (!upgradeDefinition) {
    return { success: false, message: 'Upgrade not found for this company type.' };
  }

  // Optimistic early checks against current state (fast-path rejection).
  // The real validation happens inside setGameState against prev (fresh) state.
  const existingUpgradeOuter = company.upgrades.find(u => u.id === upgradeId);
  const currentLevelOuter = existingUpgradeOuter?.level || 0;

  if (currentLevelOuter >= upgradeDefinition.maxLevel) {
    return { success: false, message: 'Upgrade is already at maximum level.' };
  }

  // Calculate cost based on current level (optimistic — recalculated inside updater)
  const costMultiplier = 1.5;
  const nextLevelCostOuter = currentLevelOuter === 0
    ? upgradeDefinition.cost
    : Math.round(upgradeDefinition.cost * Math.pow(costMultiplier, currentLevelOuter));

  // CRITICAL: Validate priceIndex before calculation
  const priceIndex = typeof gameState.economy?.priceIndex === 'number' && isFinite(gameState.economy.priceIndex) && gameState.economy.priceIndex > 0 ? gameState.economy.priceIndex : 1;
  const costOuter = getInflatedPrice(nextLevelCostOuter, priceIndex);

  // CRITICAL: Validate cost before comparison
  if (!isFinite(costOuter) || costOuter < 0) {
    log.error(`Invalid cost calculated for upgrade ${upgradeId}: ${costOuter}`, { nextLevelCost: nextLevelCostOuter, priceIndex });
    return { success: false, message: 'Invalid upgrade cost' };
  }

  // CRITICAL: Validate money before comparison
  const currentMoney = typeof gameState.stats.money === 'number' && isFinite(gameState.stats.money) && gameState.stats.money >= 0 ? gameState.stats.money : 0;

  if (currentMoney < costOuter) {
    return { success: false, message: `You need $${costOuter.toLocaleString()} to purchase this upgrade.` };
  }

  // Track whether the updater actually applied the upgrade (not stale/rejected)
  let appliedLevel = currentLevelOuter + 1;

  // Update company with upgrade — all level/cost/bonus reads from fresh prev state
  setGameState(prev => {
    const companies = [...(prev.companies || [])];
    const freshIndex = companies.findIndex(c => c.id === targetId);
    if (freshIndex === -1) return prev; // Company disappeared — bail out safely
    const companyToUpdate = companies[freshIndex];

    // STALE CLOSURE FIX: Read currentLevel from fresh prev state, not outer closure
    const freshExistingUpgrade = companyToUpdate.upgrades.find(u => u.id === upgradeId);
    const currentLevel = freshExistingUpgrade?.level || 0;

    // Re-validate max level against fresh state
    if (currentLevel >= upgradeDefinition.maxLevel) return prev;

    // Recalculate cost from fresh level
    const nextLevelCost = currentLevel === 0
      ? upgradeDefinition.cost
      : Math.round(upgradeDefinition.cost * Math.pow(costMultiplier, currentLevel));

    const freshPriceIndex = typeof prev.economy?.priceIndex === 'number' && isFinite(prev.economy.priceIndex) && prev.economy.priceIndex > 0 ? prev.economy.priceIndex : 1;
    const cost = getInflatedPrice(nextLevelCost, freshPriceIndex);

    if (!isFinite(cost) || cost < 0) return prev;

    // Atomic: check affordability against fresh state
    const prevMoney = prev.stats?.money ?? 0;
    if (prevMoney < cost) return prev;

    // ECONOMY FIX: Diminishing returns to upgrade ROI
    // Level 1: 100% bonus, Level 2: 90% bonus, Level 3: 80% bonus, etc.
    const levelPenalty = currentLevel * 0.1; // 10% reduction per level
    const bonusEfficiency = Math.max(0.5, 1 - levelPenalty); // Minimum 50% efficiency
    const baseBonus = upgradeDefinition.weeklyIncomeBonus;
    const bonus = Math.round(baseBonus * bonusEfficiency);

    // Update or add the upgrade using fresh state
    const updatedUpgrades = freshExistingUpgrade
      ? companyToUpdate.upgrades.map(u => u.id === upgradeId ? { ...u, level: u.level + 1 } : u)
      : [...companyToUpdate.upgrades, {
          id: upgradeId,
          name: upgradeDefinition.name,
          description: upgradeDefinition.description,
          cost: upgradeDefinition.cost,
          weeklyIncomeBonus: upgradeDefinition.weeklyIncomeBonus,
          level: 1,
          maxLevel: upgradeDefinition.maxLevel
        }];

    // ECONOMY FIX: Apply diminishing returns when calculating income with upgrades
    const employeeCount = companyToUpdate.employees;
    let incomeMultiplier: number;
    if (employeeCount <= 5) {
      incomeMultiplier = Math.pow(companyToUpdate.workerMultiplier, employeeCount);
    } else if (employeeCount <= 10) {
      incomeMultiplier = Math.pow(companyToUpdate.workerMultiplier, 5) * Math.pow(1.05, employeeCount - 5);
    } else if (employeeCount <= 20) {
      incomeMultiplier = Math.pow(companyToUpdate.workerMultiplier, 5) * Math.pow(1.05, 5) * Math.pow(1.02, employeeCount - 10);
    } else {
      incomeMultiplier = Math.pow(companyToUpdate.workerMultiplier, 5) * Math.pow(1.05, 5) * Math.pow(1.02, 10) * Math.pow(1.01, employeeCount - 20);
    }

    const updated: typeof companyToUpdate = {
      ...companyToUpdate,
      baseWeeklyIncome: companyToUpdate.baseWeeklyIncome + bonus,
      weeklyIncome: Math.round(
        (companyToUpdate.baseWeeklyIncome + bonus) * incomeMultiplier
      ),
      upgrades: updatedUpgrades,
    };
    companies[freshIndex] = updated;

    // Record the actual applied level for the return message
    appliedLevel = currentLevel + 1;

    return {
      ...prev,
      companies,
      company: prev.company?.id === targetId ? updated : prev.company,
      stats: {
        ...prev.stats,
        money: prevMoney - cost,
      },
    };
  });

  log.info(`Purchased upgrade ${upgradeDefinition.name} for company ${company.name}`);
  return {
    success: true,
    message: `Successfully purchased ${upgradeDefinition.name} (Level ${appliedLevel}/${upgradeDefinition.maxLevel})!`
  };
};


