/**
 * Company Actions
 */
import { GameState, Company, CompanyUpgrade } from '../types';
import { logger } from '@/utils/logger';
import { updateMoney } from './MoneyActions';
import { getInflatedPrice } from '@/lib/economy/inflation';
import type { Dispatch, SetStateAction } from 'react';

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

  const cost = getInflatedPrice(baseCost, gameState.economy.priceIndex);
  
  if (gameState.stats.money < cost) {
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

  const newCompany: Company = {
    id: companyType,
    name: `My ${companyType.charAt(0).toUpperCase() + companyType.slice(1)}`,
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

  deps.updateMoney(setGameState, -cost, `Started company: ${newCompany.name}`);

  setGameState(prev => ({
    ...prev,
    companies: [...(prev.companies || []), newCompany],
    company: prev.company ?? newCompany,
  }));

  return { success: true, companyId: newCompany.id };
};

export const buyCompanyUpgrade = (
  gameState: GameState,
  setGameState: Dispatch<SetStateAction<GameState>>,
  upgradeId: string,
  companyId?: string,
  deps: { updateMoney: typeof updateMoney }
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

  // Find existing upgrade or create new one
  const existingUpgrade = company.upgrades.find(u => u.id === upgradeId);
  const currentLevel = existingUpgrade?.level || 0;
  
  if (currentLevel >= upgradeDefinition.maxLevel) {
    return { success: false, message: 'Upgrade is already at maximum level.' };
  }

  // Calculate cost based on current level
  const costMultiplier = 1.5;
  // ECONOMY FIX: Add diminishing returns to upgrade ROI
  // Higher upgrade levels have reduced income bonus efficiency
  // Level 1: 100% bonus, Level 2: 90% bonus, Level 3: 80% bonus, etc.
  const levelPenalty = currentLevel * 0.1; // 10% reduction per level
  const bonusEfficiency = Math.max(0.5, 1 - levelPenalty); // Minimum 50% efficiency
  
  const nextLevelCost = currentLevel === 0 
    ? upgradeDefinition.cost 
    : Math.round(upgradeDefinition.cost * Math.pow(costMultiplier, currentLevel));
  
  const cost = getInflatedPrice(nextLevelCost, gameState.economy.priceIndex);
  
  if (gameState.stats.money < cost) {
    return { success: false, message: `You need $${cost.toLocaleString()} to purchase this upgrade.` };
  }

  // Calculate bonus for this level with diminishing returns
  const baseBonus = upgradeDefinition.weeklyIncomeBonus;
  const bonus = Math.round(baseBonus * bonusEfficiency);

  // Update company with upgrade
  setGameState(prev => {
    const companies = [...(prev.companies || [])];
    const companyToUpdate = companies[companyIndex];
    
    // Update or add the upgrade
    const updatedUpgrades = existingUpgrade 
      ? companyToUpdate.upgrades.map(u => u.id === upgradeId ? { ...u, level: u.level + 1 } : u)
      : [...companyToUpdate.upgrades, { id: upgradeId, level: 1, maxLevel: upgradeDefinition.maxLevel }];

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
    companies[companyIndex] = updated;

    return {
      ...prev,
      companies,
      company: prev.company?.id === targetId ? updated : prev.company,
    };
  });

  // Deduct money using updateMoney
  deps.updateMoney(setGameState, -cost, `Company Upgrade: ${upgradeDefinition.name}`);

  log.info(`Purchased upgrade ${upgradeDefinition.name} for company ${company.name}`);
  return { 
    success: true, 
    message: `Successfully purchased ${upgradeDefinition.name} (Level ${currentLevel + 1}/${upgradeDefinition.maxLevel})!` 
  };
};


