// cspell:words realestate fintech
import { getInflatedPrice } from '@/lib/economy/inflation';
import { COMPANY_UPGRADES, COMPANY_UPGRADE_COST_MULTIPLIER, COMPANY_STARTING_INCOME } from './companyUpgradeCatalog';
import { hasEarlyCompanyAccess } from '@/lib/prestige/applyUnlocks';
import { logger } from '@/utils/logger';
import { applyMoneyDelta } from './actions/MoneyActions';
import type { GameState, Company, CompanyUpgrade } from './types';
import type { Dispatch, SetStateAction } from 'react';

export function createCompany(
  gameState: GameState,
  setGameState: Dispatch<SetStateAction<GameState>>,
  companyType: string
): { success: boolean; message?: string; companyId?: string } {
  // Ensure companyType is a string
  if (typeof companyType !== 'string') {
    logger.error('createCompany: companyType must be a string, received:', { type: typeof companyType, value: companyType });
    return { success: false, message: 'Invalid company type' };
  }
  const companyCosts = {
    factory: 50000,
    ai: 90000,
    restaurant: 130000,
    realestate: 200000,
    bank: 2000000,
  } as const;

  // Validate companyType against allowed types
  const validTypes = Object.keys(companyCosts);
  if (!validTypes.includes(companyType)) {
    logger.error('createCompany: invalid companyType:', { companyType, validTypes });
    return { success: false, message: `Invalid company type: ${companyType}` };
  }

  const baseCost = companyCosts[companyType as keyof typeof companyCosts];
  const cost = getInflatedPrice(baseCost, gameState.economy.priceIndex);
  if (gameState.stats.money < cost) {
    return { success: false, message: 'Insufficient funds' };
  }
  if ((gameState.companies || []).find(c => c.id === companyType)) {
    return { success: false, message: 'You already own this company type' };
  }

  const unlockedBonuses = gameState.prestige?.unlockedBonuses || [];
  const hasEarlyAccess = hasEarlyCompanyAccess(unlockedBonuses);
  
  const hasEntrepreneurshipEducation = (gameState.educations || []).find(
    e => e.id === 'entrepreneurship'
  )?.completed;
  if (!hasEarlyAccess && !hasEntrepreneurshipEducation) {
    return { success: false, message: 'You need to complete Entrepreneurship Course first! (Or unlock Early Company Access prestige bonus)' };
  }

  const companyUpgrades = COMPANY_UPGRADES;

  const workerConfigs = {
    factory: { salary: 500 },
    ai: { salary: 2000 },
    restaurant: { salary: 400 },
    realestate: { salary: 1500 },
    bank: { salary: 5000 },
  } as const;

  const workerConfig = workerConfigs[companyType as keyof typeof workerConfigs];

  // Industry-varied starting income — kept consistent with the canonical
  // CompanyActions.createCompany (see COMPANY_STARTING_INCOME docs).
  const startingIncome = COMPANY_STARTING_INCOME[companyType] ?? 2000;

  const newCompany: Company = {
    id: companyType,
    name: `My ${companyType.charAt(0).toUpperCase() + companyType.slice(1)}`,
    type: companyType as Company['type'],
    weeklyIncome: startingIncome,
    baseWeeklyIncome: startingIncome,
    upgrades: companyUpgrades[companyType] || [],
    employees: 0,
    workerSalary: workerConfig.salary,
    workerMultiplier: 1.1,
    marketingLevel: 1,
    miners: {},
    warehouseLevel: 0, // Start with 10 slots (0 level = 10 slots)
  };

  setGameState(prev => ({
    ...prev,
    companies: [...(prev.companies || []), newCompany],
    company: prev.company ?? newCompany,
    // Mirror into lifetimeStatistics (trackNewCompany was never called).
    lifetimeStatistics: prev.lifetimeStatistics
      ? {
          ...prev.lifetimeStatistics,
          totalCompaniesOwned: (prev.lifetimeStatistics.totalCompaniesOwned ?? 0) + 1,
        }
      : prev.lifetimeStatistics,
    stats: {
      ...prev.stats,
      money: prev.stats.money - cost,
    },
  }));
  return { success: true, companyId: newCompany.id };
}

export function buyCompanyUpgrade(
  gameState: GameState,
  setGameState: Dispatch<SetStateAction<GameState>>,
  upgradeId: string,
  companyId?: string
): void {
  const targetId = companyId || gameState.company?.id;
  if (!targetId) return;

  const companyIndex = (gameState.companies || []).findIndex(c => c.id === targetId);
  if (companyIndex === -1) return;

  // Get the company's available upgrades
  const company = (gameState.companies || []).find(c => c.id === targetId);
  if (!company) return;
  
  const companyType = company.type;
  
  // Define company upgrades locally
  const companyUpgrades = COMPANY_UPGRADES;
  
  const availableUpgrades = companyUpgrades[companyType] || [];
  const upgradeDefinition = availableUpgrades.find((u: { id: string }) => u.id === upgradeId);
  if (!upgradeDefinition) return;

  setGameState(prev => {
    const companies = [...prev.companies];
    const company = companies[companyIndex];
    
    // Find existing upgrade or create new one
    let existingUpgrade = company.upgrades.find(u => u.id === upgradeId);
    const currentLevel = existingUpgrade?.level || 0;
    
    if (currentLevel >= upgradeDefinition.maxLevel) return prev;

    // ECONOMY FIX: Add diminishing returns to upgrade ROI
    // Higher upgrade levels have reduced income bonus efficiency
    // Level 1: 100% bonus, Level 2: 90% bonus, Level 3: 80% bonus, etc.
    const levelPenalty = currentLevel * 0.1; // 10% reduction per level
    const bonusEfficiency = Math.max(0.5, 1 - levelPenalty); // Minimum 50% efficiency
    
    // Calculate cost based on current level (using a simple multiplier for now)
    const costMultiplier = COMPANY_UPGRADE_COST_MULTIPLIER; // shared catalog constant
    const nextLevelCost = currentLevel === 0 
      ? upgradeDefinition.cost 
      : Math.round(upgradeDefinition.cost * Math.pow(costMultiplier, currentLevel));
    
    // Business Banking IAP: 15% off all company upgrade purchases.
    const businessBankingDiscount = prev.settings?.businessBanking ? 0.15 : 0;
    const cost = Math.round(getInflatedPrice(nextLevelCost, prev.economy.priceIndex) * (1 - businessBankingDiscount));
    if (prev.stats.money < cost) return prev;

    // Calculate bonus for this level with diminishing returns
    const baseBonus = upgradeDefinition.weeklyIncomeBonus;
    const bonus = Math.round(baseBonus * bonusEfficiency);

    // Update or add the upgrade
    const updatedUpgrades = existingUpgrade 
      ? company.upgrades.map(u => u.id === upgradeId ? { ...u, level: u.level + 1 } : u)
      : [...company.upgrades, { id: upgradeId, level: 1, maxLevel: upgradeDefinition.maxLevel }];

    // ECONOMY FIX: Apply diminishing returns when calculating income with upgrades
    const employeeCount = company.employees;
    let incomeMultiplier: number;
    if (employeeCount <= 5) {
      incomeMultiplier = Math.pow(company.workerMultiplier, employeeCount);
    } else if (employeeCount <= 10) {
      incomeMultiplier = Math.pow(company.workerMultiplier, 5) * Math.pow(1.05, employeeCount - 5);
    } else if (employeeCount <= 20) {
      incomeMultiplier = Math.pow(company.workerMultiplier, 5) * Math.pow(1.05, 5) * Math.pow(1.02, employeeCount - 10);
    } else {
      incomeMultiplier = Math.pow(company.workerMultiplier, 5) * Math.pow(1.05, 5) * Math.pow(1.02, 10) * Math.pow(1.01, employeeCount - 20);
    }
    
    const updated: Company = {
      ...company,
      baseWeeklyIncome: company.baseWeeklyIncome + bonus,
      weeklyIncome: Math.round(
        (company.baseWeeklyIncome + bonus) * incomeMultiplier
      ),
      upgrades: updatedUpgrades as CompanyUpgrade[],
    };
    companies[companyIndex] = updated;

    return {
      ...prev,
      stats: { ...prev.stats, money: prev.stats.money - cost },
      companies,
      company: prev.company?.id === targetId ? updated : prev.company,
    };
  });
}

/**
 * Hard headcount cap per company. Matches the diminishing-returns table
 * (21+ uses the 1.01x floor multiplier) and the Hustle "STAFF_CAP" UI copy
 * (CompanyDetailScreen). Shared by addWorker and the Hustle named-hire
 * pipeline so neither path can grow a company's payroll unboundedly.
 */
export const MAX_COMPANY_EMPLOYEES = 30;

/**
 * Diminishing-returns income multiplier from headcount.
 * workerMultiplier (1.1x) each for employees 1-5, then 1.05x for 6-10,
 * 1.02x for 11-20, and 1.01x for 21+. Shared by addWorker/removeWorker and
 * the Hustle named-hire pipeline so both hiring paths scale income identically.
 */
export function companyIncomeMultiplier(workerMultiplier: number, employeeCount: number): number {
  const safeMult = isFinite(workerMultiplier) && workerMultiplier > 0 ? workerMultiplier : 1.1;
  const count = Math.max(0, Math.floor(isFinite(employeeCount) ? employeeCount : 0));
  if (count <= 5) return Math.pow(safeMult, count);
  if (count <= 10) return Math.pow(safeMult, 5) * Math.pow(1.05, count - 5);
  if (count <= 20) return Math.pow(safeMult, 5) * Math.pow(1.05, 5) * Math.pow(1.02, count - 10);
  return Math.pow(safeMult, 5) * Math.pow(1.05, 5) * Math.pow(1.02, 10) * Math.pow(1.01, count - 20);
}

export function addWorker(
  gameState: GameState,
  setGameState: Dispatch<SetStateAction<GameState>>,
  companyId?: string
): void {
  const targetId = companyId || gameState.company?.id;
  if (!targetId) return;

  const companyIndex = gameState.companies.findIndex(c => c.id === targetId);
  if (companyIndex === -1) return;

  setGameState(prev => {
    const companies = [...prev.companies];
    const company = companies[companyIndex];
    const { workerSalary, employees, baseWeeklyIncome, workerMultiplier } =
      company;
    // ECONOMY FIX: Removed hard cap at 10 employees - diminishing returns already prevent exponential scaling
    // Allow up to MAX_COMPANY_EMPLOYEES to match diminishing returns logic (21+ uses 1.01x multiplier)
    if (employees >= MAX_COMPANY_EMPLOYEES || prev.stats.money < workerSalary) return prev;

    // ECONOMY FIX: Add diminishing returns to prevent exponential scaling
    // Diminishing returns: 1.1x for first 5 employees, 1.05x for 6-10, 1.02x for 11-20, 1.01x for 21+
    const employeeCount = company.employees + 1;
    let effectiveMultiplier: number;
    if (employeeCount <= 5) {
      effectiveMultiplier = workerMultiplier; // 1.1x
    } else if (employeeCount <= 10) {
      effectiveMultiplier = 1.05; // Reduced from 1.1x
    } else if (employeeCount <= 20) {
      effectiveMultiplier = 1.02; // Further reduced
    } else {
      effectiveMultiplier = 1.01; // Minimal growth after 20 employees
    }
    
    // Calculate income with diminishing returns (shared helper)
    const incomeMultiplier = companyIncomeMultiplier(workerMultiplier, employeeCount);


    const updated: Company = {
      ...company,
      employees: company.employees + 1,
      weeklyIncome: Math.round(
        baseWeeklyIncome * incomeMultiplier
      ),
    };
    companies[companyIndex] = updated;

    return {
      ...prev,
      stats: { ...prev.stats, money: prev.stats.money - workerSalary },
      companies,
      company: prev.company?.id === targetId ? updated : prev.company,
    };
  });
}

export function removeWorker(
  gameState: GameState,
  setGameState: Dispatch<SetStateAction<GameState>>,
  companyId?: string
): void {
  const targetId = companyId || gameState.company?.id;
  if (!targetId) return;

  const companyIndex = gameState.companies.findIndex(c => c.id === targetId);
  if (companyIndex === -1) return;

  setGameState(prev => {
    const companies = [...prev.companies];
    const company = companies[companyIndex];
    if (company.employees <= 0) return prev;

    // ECONOMY FIX: Apply same diminishing returns when removing workers
    const employeeCount = company.employees - 1;
    const incomeMultiplier = companyIncomeMultiplier(company.workerMultiplier, employeeCount);


    const updated: Company = {
      ...company,
      employees: company.employees - 1,
      weeklyIncome: Math.round(
        company.baseWeeklyIncome * incomeMultiplier
      ),
    };
    companies[companyIndex] = updated;

    return {
      ...prev,
      companies,
      company: prev.company?.id === targetId ? updated : prev.company,
    };
  });
}


/**
 * Sale value quote: 50% of total (inflated) investment — company cost plus
 * every upgrade level purchased. Pure; used by both the confirm dialog and
 * sellCompany itself so the quoted and paid numbers can never diverge.
 */
export function quoteCompanySaleValue(gameState: GameState, companyId: string): number | null {
  const company = (gameState.companies || []).find(c => c.id === companyId);
  if (!company) return null;
  
  // Calculate total investment (company cost + all upgrade costs)
  const companyCosts = {
    factory: 50000,
    ai: 90000,
    restaurant: 130000,
    realestate: 200000,
    bank: 2000000,
  } as const;

  const baseCompanyCost = companyCosts[company.type as keyof typeof companyCosts] || 0;
  const inflatedCompanyCost = getInflatedPrice(baseCompanyCost, gameState.economy.priceIndex);
  
  // Calculate total upgrade costs using the same upgrade definitions as the upgrade system
  const companyUpgrades = COMPANY_UPGRADES;
  
  let totalUpgradeCost = 0;
  company.upgrades.forEach(upgrade => {
    const availableUpgrades = companyUpgrades[company.type] || [];
    const upgradeDef = availableUpgrades.find(u => u.id === upgrade.id);
    if (upgradeDef) {
      // Calculate cost for each level purchased
      for (let level = 1; level <= upgrade.level; level++) {
        const levelCost = level === 1 
          ? upgradeDef.cost 
          : Math.round(upgradeDef.cost * Math.pow(COMPANY_UPGRADE_COST_MULTIPLIER, level - 1));
        totalUpgradeCost += getInflatedPrice(levelCost, gameState.economy.priceIndex);
      }
    }
  });

  const totalInvestment = inflatedCompanyCost + totalUpgradeCost;
  return Math.round(totalInvestment * 0.5); // 50% of total investment
}

export function sellCompany(
  gameState: GameState,
  setGameState: Dispatch<SetStateAction<GameState>>,
  companyId: string
): { success: boolean; message?: string; sellValue?: number } {
  const sellValue = quoteCompanySaleValue(gameState, companyId);
  if (sellValue == null) {
    return { success: false, message: 'Company not found' };
  }

  setGameState(prev => {
    // Re-check against prev — a same-batch double-tap must not sell twice.
    if (!(prev.companies || []).some(c => c.id === companyId)) return prev;
    const companies = prev.companies.filter(c => c.id !== companyId);
    // Canonical credit path (MONEY_CEILING clamp + dailySummary tracking).
    // Abort outright if the credit is rejected — the company must never be
    // removed while the player receives nothing.
    const salePatch = applyMoneyDelta(prev, sellValue, 'Company sale');
    if (!salePatch) return prev;
    // Drop the sold company's Hustle overlay and count the exit — the
    // Dashboard 'Sold' milestone reads lifetimeStats.totalCompaniesSold.
    let hustleApp = prev.hustleApp;
    if (hustleApp) {
      const overlays = { ...hustleApp.companies };
      delete overlays[companyId];
      hustleApp = {
        ...hustleApp,
        companies: overlays,
        lifetimeStats: {
          ...hustleApp.lifetimeStats,
          totalCompaniesSold: (hustleApp.lifetimeStats?.totalCompaniesSold ?? 0) + 1,
        },
      };
    }
    return {
      ...prev,
      ...salePatch,
      companies,
      company: prev.company?.id === companyId ? undefined : prev.company,
      hustleApp,
    };
  });

  return { success: true, sellValue };
}

export function selectMiningCrypto(
  gameState: GameState,
  setGameState: Dispatch<SetStateAction<GameState>>,
  cryptoId: string,
  companyId?: string
): void {
  const targetId = companyId || gameState.company?.id;
  if (!targetId) return;

  const companyIndex = gameState.companies.findIndex(c => c.id === targetId);
  if (companyIndex === -1) return;
  const company = gameState.companies[companyIndex];

  setGameState(prev => {
    const companies = [...prev.companies];
    const updated: Company = { ...company, selectedCrypto: cryptoId };
    companies[companyIndex] = updated;
    return {
      ...prev,
      companies,
      company: prev.company?.id === targetId ? updated : prev.company,
    };
  });
}

export function buyMiner(
  gameState: GameState,
  setGameState: Dispatch<SetStateAction<GameState>>,
  minerId: string,
  minerName: string,
  cost: number
): { success: boolean; message?: string } {
  // Perform all validation and mutation inside a single functional update
  // to avoid race conditions with stale state
  let result: { success: boolean; message?: string } = { success: false, message: 'Unknown error' };

  setGameState(prev => {
    if (!prev.warehouse) {
      result = { success: false, message: 'You need a warehouse to buy miners' };
      return prev;
    }

    const currentMoney = typeof prev.stats.money === 'number' && isFinite(prev.stats.money) && prev.stats.money >= 0
      ? prev.stats.money
      : 0;

    if (currentMoney < cost) {
      result = { success: false, message: 'Not enough money' };
      return prev;
    }

    // Check warehouse capacity
    const currentMiners = Object.values(prev.warehouse.miners).reduce((sum, count) => sum + count, 0);
    const maxCapacity = 10 + (prev.warehouse.level - 1) * 5;

    if (currentMiners >= maxCapacity) {
      result = { success: false, message: 'Warehouse is full! Upgrade your warehouse to store more miners.' };
      return prev;
    }

    result = { success: true, message: `Successfully purchased ${minerName}!` };
    return {
      ...prev,
      warehouse: {
        ...prev.warehouse,
        miners: {
          ...prev.warehouse.miners,
          [minerId]: (prev.warehouse.miners[minerId] || 0) + 1,
        },
        minerDurability: {
          ...prev.warehouse.minerDurability,
          [minerId]: 100,
        },
      },
      stats: {
        ...prev.stats,
        money: prev.stats.money - cost,
      },
    };
  });

  return result;
}

/**
 * Buy a warehouse (required for mining operations)
 */
export function buyWarehouse(
  gameState: GameState,
  setGameState: Dispatch<SetStateAction<GameState>>
): { success: boolean; message?: string } {
  // Perform all validation and mutation inside a single functional update
  let result: { success: boolean; message?: string } = { success: false, message: 'Unknown error' };

  setGameState(prev => {
    if (prev.warehouse) {
      result = { success: false, message: 'You already have a warehouse' };
      return prev;
    }

    const baseCost = 50000;
    const priceIndex = typeof prev.economy?.priceIndex === 'number' && isFinite(prev.economy.priceIndex) && prev.economy.priceIndex > 0
      ? prev.economy.priceIndex
      : 1;

    const { getInflatedPrice } = require('@/lib/economy/inflation');
    const cost = getInflatedPrice(baseCost, priceIndex);

    const currentMoney = typeof prev.stats.money === 'number' && isFinite(prev.stats.money) && prev.stats.money >= 0
      ? prev.stats.money
      : 0;

    if (currentMoney < cost) {
      result = { success: false, message: `Not enough money. Warehouse costs ${new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cost)}` };
      return prev;
    }

    result = { success: true, message: 'Warehouse purchased successfully! You can now buy miners.' };
    return {
      ...prev,
      warehouse: {
        level: 1,
        miners: {},
        minerDurability: {},
      },
      stats: {
        ...prev.stats,
        money: prev.stats.money - cost,
      },
    };
  });

  return result;
}

/**
 * Upgrade warehouse to increase capacity
 */
export function upgradeWarehouse(
  gameState: GameState,
  setGameState: Dispatch<SetStateAction<GameState>>
): { success: boolean; message?: string } {
  // Check if has warehouse
  if (!gameState.warehouse) {
    return { success: false, message: 'You need to buy a warehouse first' };
  }

  // Max level is 10
  const maxLevel = 10;
  if (gameState.warehouse.level >= maxLevel) {
    return { success: false, message: 'Warehouse is already at maximum level' };
  }

  // Upgrade cost: $25,000 * level
  const baseCost = 25000;
  const priceIndex = typeof gameState.economy?.priceIndex === 'number' && isFinite(gameState.economy.priceIndex) && gameState.economy.priceIndex > 0
    ? gameState.economy.priceIndex
    : 1;
  
  const { getInflatedPrice } = require('@/lib/economy/inflation');
  const cost = getInflatedPrice(baseCost * gameState.warehouse.level, priceIndex);

  // Validate money
  const currentMoney = typeof gameState.stats.money === 'number' && isFinite(gameState.stats.money) && gameState.stats.money >= 0
    ? gameState.stats.money
    : 0;

  if (currentMoney < cost) {
    return { success: false, message: `Not enough money. Upgrade costs ${new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cost)}` };
  }

  // The upgrade itself, re-validated against FRESH `prev`.
  //
  // Everything above this point reads the caller's snapshot and exists to
  // produce the message. It cannot be the gate: two taps in the same React
  // batch see identical state and both pass, and this function used to apply
  // the level and the charge with no second look. That was three bugs at once —
  // the level rose twice (straight past the max-10 ceiling), the second upgrade
  // was billed at the STALE level's cheaper price, and `money` was written by
  // hand with no clamp, so an overdraw stored a NEGATIVE balance rather than
  // being refused.
  //
  // `buyWarehouse`, `buyMiner` and `sellMiner` in this same file all validate
  // inside their updater; this one was the outlier. Cost is recomputed from
  // `prev.warehouse.level` so a queued second upgrade pays the real, higher
  // price for the level it is actually buying.
  //
  // The OUTCOME is reported from inside the updater too, the same shape
  // `buyWarehouse` uses. Building the return value from `gameState` instead —
  // which is what this did first — meant a rejected second tap still answered
  // "Warehouse upgraded to level 3!", naming a level the player never reached
  // and a charge that never happened. Fixing the state without fixing the
  // message just moves the lie.
  //
  // The known cost of this shape (CLAUDE.md §4.1): React only evaluates an
  // updater eagerly when the fiber has no pending lanes, so under contention
  // `result` may still hold its initial value when it is read. That is the
  // right way round here. The initial value is a REFUSAL, so the failure mode
  // is "said no when it meant yes" — recoverable, the player taps again and the
  // state was correct throughout. The alternative failed the other way, and a
  // player told they bought something they did not is the worse outcome.
  let result: { success: boolean; message?: string } = {
    success: false,
    message: 'Upgrade could not be applied. Please try again.',
  };

  setGameState(prev => {
    const wh = prev.warehouse;
    if (!wh) {
      result = { success: false, message: 'You need to buy a warehouse first' };
      return prev;
    }
    if (wh.level >= maxLevel) {
      result = { success: false, message: 'Warehouse is already at maximum level' };
      return prev;
    }

    const prevIndex = typeof prev.economy?.priceIndex === 'number' && isFinite(prev.economy.priceIndex) && prev.economy.priceIndex > 0
      ? prev.economy.priceIndex
      : 1;
    const liveCost = getInflatedPrice(baseCost * wh.level, prevIndex);
    if (!isFinite(liveCost) || liveCost < 0) {
      result = { success: false, message: 'Upgrade price is unavailable right now' };
      return prev;
    }

    const money = typeof prev.stats.money === 'number' && isFinite(prev.stats.money) && prev.stats.money >= 0
      ? prev.stats.money
      : 0;
    if (money < liveCost) {
      result = {
        success: false,
        message: `Not enough money. Upgrade costs ${new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(liveCost)}`,
      };
      return prev;
    }

    // Quoted from the level actually being bought, not from the snapshot.
    const newLevel = wh.level + 1;
    result = {
      success: true,
      message: `Warehouse upgraded to level ${newLevel}! New capacity: ${10 + newLevel * 5} miners.`,
    };
    return {
      ...prev,
      warehouse: { ...wh, level: newLevel },
      stats: { ...prev.stats, money: money - liveCost },
    };
  });

  return result;
}

export function sellMiner(
  gameState: GameState,
  setGameState: Dispatch<SetStateAction<GameState>>,
  minerId: string,
  minerName: string,
  purchasePrice: number,
  companyId?: string
): { success: boolean; message?: string } {
  logger.debug('sellMiner in company.ts called:', { minerId, minerName, purchasePrice, companyId });
  logger.debug('Current warehouse:', gameState.warehouse);
  logger.debug('Current miners:', gameState.warehouse?.miners);
  
  if (!gameState.warehouse) {
    logger.debug('No warehouse found');
    return { success: false, message: 'You need a warehouse to sell miners' };
  }
  
  // Check ownership first using the passed gameState
  // We'll verify again in the setGameState callback to ensure we have the latest state
  const initialOwnedCount = gameState.warehouse.miners[minerId] || 0;
  logger.debug('Initial owned count for miner:', { minerId, initialOwnedCount });
  
  if (initialOwnedCount === 0) {
    return { success: false, message: `You don't own any ${minerName}s to sell` };
  }
  
  // Sell price is 50% of purchase price
  const sellPrice = Math.floor(purchasePrice * 0.5);
  
  // Update state using functional update to ensure we have the latest state
  setGameState(prev => {
    // Double-check in the callback to ensure we still have the miner
    if (!prev.warehouse) {
      logger.debug('No warehouse in setGameState callback');
      return prev;
    }
    
    const currentOwnedCount = prev.warehouse.miners[minerId] || 0;
    logger.debug('Current owned count in callback for miner:', { minerId, currentOwnedCount });
    
    if (currentOwnedCount === 0) {
      logger.debug('No miners to sell in callback');
      return prev;
    }
    
    const newCount = Math.max(0, currentOwnedCount - 1);
    logger.debug('Selling miner', { currentOwnedCount, newCount, sellPrice });
    
    return {
      ...prev,
      warehouse: {
        ...prev.warehouse,
        miners: {
          ...prev.warehouse.miners,
          [minerId]: newCount,
        },
      },
      stats: {
        ...prev.stats,
        money: prev.stats.money + sellPrice,
      },
    };
  });
  
  logger.debug('sellMiner returning success', { sellPrice });
  return { success: true, message: `Sold ${minerName} for ${sellPrice.toLocaleString()}!` };
}
