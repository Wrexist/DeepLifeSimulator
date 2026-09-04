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

  // Industry-varied starting income - kept consistent with the canonical
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
 * Sale value quote: 50% of total (inflated) investment - company cost plus
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
    // Re-check against prev - a same-batch double-tap must not sell twice.
    if (!(prev.companies || []).some(c => c.id === companyId)) return prev;
    const companies = prev.companies.filter(c => c.id !== companyId);
    // Canonical credit path (MONEY_CEILING clamp + dailySummary tracking).
    // Abort outright if the credit is rejected - the company must never be
    // removed while the player receives nothing.
    const salePatch = applyMoneyDelta(prev, sellValue, 'Company sale');
    if (!salePatch) return prev;
    // Drop the sold company's Hustle overlay and count the exit - the
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

/**
 * The whole of `buyMiner`, as a PURE function of the state it is given.
 *
 * WP-A: `buyMiner` used to assign a `let result` from inside its updater and
 * return it afterwards. React only evaluates the FIRST functional update of a
 * batch eagerly, so a purchase that committed could still report the
 * initialiser - "Purchase Failed - Unknown error" over a miner the player owns
 * and was charged for. Same shape, same fix as `resolveBuyCompanyUpgrade`
 * (C-8): run it against the caller's snapshot for the OUTCOME, and again
 * against `prev` for the STATE, so nothing crosses the updater boundary.
 */
export function resolveBuyMiner(
  state: GameState,
  minerId: string,
  minerName: string,
  cost: number
): { state: GameState; success: boolean; message: string } {
  if (!state.warehouse) {
    return { state, success: false, message: 'You need a warehouse to buy miners' };
  }

  const currentMoney = typeof state.stats.money === 'number' && isFinite(state.stats.money) && state.stats.money >= 0
    ? state.stats.money
    : 0;

  if (currentMoney < cost) {
    return { state, success: false, message: 'Not enough money' };
  }

  // Check warehouse capacity
  const currentMiners = Object.values(state.warehouse.miners).reduce((sum, count) => sum + count, 0);
  const maxCapacity = 10 + (state.warehouse.level - 1) * 5;

  if (currentMiners >= maxCapacity) {
    return { state, success: false, message: 'Warehouse is full! Upgrade your warehouse to store more miners.' };
  }

  // Charge and grant in one step (§4.4). `applyMoneyDelta` re-checks
  // affordability and clamps, so a hand-written subtraction can never store a
  // negative balance.
  const spend = applyMoneyDelta(state, -cost, `Miner purchase: ${minerName}`);
  if (!spend) {
    return { state, success: false, message: 'Not enough money' };
  }

  return {
    success: true,
    message: `Successfully purchased ${minerName}!`,
    state: {
      ...state,
      ...spend,
      warehouse: {
        ...state.warehouse,
        miners: {
          ...state.warehouse.miners,
          [minerId]: (state.warehouse.miners[minerId] || 0) + 1,
        },
        minerDurability: {
          ...state.warehouse.minerDurability,
          [minerId]: 100,
        },
      },
    },
  };
}

export function buyMiner(
  gameState: GameState,
  setGameState: Dispatch<SetStateAction<GameState>>,
  minerId: string,
  minerName: string,
  cost: number
): { success: boolean; message?: string } {
  // Outcome from the snapshot; state from `prev`. Every gate is still
  // re-validated inside the updater, so two taps in one batch cannot both buy.
  const preview = resolveBuyMiner(gameState, minerId, minerName, cost);
  setGameState(prev => resolveBuyMiner(prev, minerId, minerName, cost).state);
  return { success: preview.success, message: preview.message };
}

/**
 * Buy a warehouse (required for mining operations)
 */
/**
 * The whole of `buyWarehouse`, as a PURE function of the state it is given -
 * same WP-A fix and same reasoning as `resolveBuyMiner` above. The price is
 * re-derived from whichever state it runs on, so the committed charge always
 * matches that state's `economy.priceIndex`.
 */
export function resolveBuyWarehouse(
  state: GameState
): { state: GameState; success: boolean; message: string } {
  if (state.warehouse) {
    return { state, success: false, message: 'You already have a warehouse' };
  }

  const baseCost = 50000;
  const priceIndex = typeof state.economy?.priceIndex === 'number' && isFinite(state.economy.priceIndex) && state.economy.priceIndex > 0
    ? state.economy.priceIndex
    : 1;

  const cost = getInflatedPrice(baseCost, priceIndex);
  const quoted = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cost);

  const currentMoney = typeof state.stats.money === 'number' && isFinite(state.stats.money) && state.stats.money >= 0
    ? state.stats.money
    : 0;

  if (currentMoney < cost) {
    return { state, success: false, message: `Not enough money. Warehouse costs ${quoted}` };
  }

  const spend = applyMoneyDelta(state, -cost, 'Warehouse purchase');
  if (!spend) {
    return { state, success: false, message: `Not enough money. Warehouse costs ${quoted}` };
  }

  return {
    success: true,
    message: 'Warehouse purchased successfully! You can now buy miners.',
    state: {
      ...state,
      ...spend,
      warehouse: {
        level: 1,
        miners: {},
        minerDurability: {},
      },
    },
  };
}

export function buyWarehouse(
  gameState: GameState,
  setGameState: Dispatch<SetStateAction<GameState>>
): { success: boolean; message?: string } {
  const preview = resolveBuyWarehouse(gameState);
  setGameState(prev => resolveBuyWarehouse(prev).state);
  return { success: preview.success, message: preview.message };
}

/**
 * Upgrade warehouse to increase capacity
 */
/**
 * The whole of `upgradeWarehouse`, as a PURE function of the state it is
 * given - the same shape as `resolveBuyMiner` / `resolveBuyWarehouse` above.
 * The cost is re-derived from whichever state it runs on, so a queued second
 * upgrade is billed at the real, higher price for the level it is actually
 * buying, and the max-10 ceiling holds under a same-batch double-tap.
 *
 * This used to be the file's last capture-across-updater site: it read a
 * `let result` assigned inside the updater, defended by a comment arguing the
 * refusal-by-default failure mode was the safer direction. True, but the
 * preview/commit pair needs no trade-off at all - the caller's outcome comes
 * from running the resolver on the snapshot, the committed state from running
 * it again on `prev`, and on the stale double-tap the prev-side run refuses on
 * its own evidence. Money now goes through `applyMoneyDelta` like the
 * siblings, so an overdraw is refused rather than hand-subtracted.
 */
export function resolveUpgradeWarehouse(
  state: GameState
): { state: GameState; success: boolean; message: string } {
  const wh = state.warehouse;
  if (!wh) {
    return { state, success: false, message: 'You need to buy a warehouse first' };
  }

  const maxLevel = 10;
  if (wh.level >= maxLevel) {
    return { state, success: false, message: 'Warehouse is already at maximum level' };
  }

  // Upgrade cost: $25,000 * level, inflation-adjusted.
  const baseCost = 25000;
  const priceIndex = typeof state.economy?.priceIndex === 'number' && isFinite(state.economy.priceIndex) && state.economy.priceIndex > 0
    ? state.economy.priceIndex
    : 1;
  const cost = getInflatedPrice(baseCost * wh.level, priceIndex);
  if (!isFinite(cost) || cost < 0) {
    return { state, success: false, message: 'Upgrade price is unavailable right now' };
  }
  const quoted = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cost);

  const spend = applyMoneyDelta(state, -cost, 'Warehouse upgrade');
  if (!spend) {
    return { state, success: false, message: `Not enough money. Upgrade costs ${quoted}` };
  }

  const newLevel = wh.level + 1;
  return {
    success: true,
    message: `Warehouse upgraded to level ${newLevel}! New capacity: ${10 + newLevel * 5} miners.`,
    state: {
      ...state,
      ...spend,
      warehouse: { ...wh, level: newLevel },
    },
  };
}

export function upgradeWarehouse(
  gameState: GameState,
  setGameState: Dispatch<SetStateAction<GameState>>
): { success: boolean; message?: string } {
  const preview = resolveUpgradeWarehouse(gameState);
  setGameState(prev => resolveUpgradeWarehouse(prev).state);
  return { success: preview.success, message: preview.message };
}

/**
 * Sell EVERY unit of one miner tier in a single transaction.
 *
 * PLAYER REPORT (BBQ, 2026-09-01): "Thanks for including a sell option on rigs.
 * (One at a time is not enough, needs a sell all option)". `sellMiner` sheds one
 * unit per confirm, so unwinding the 600-rig fleet that prompted the report is
 * 600 confirms.
 *
 * Written as a pure preview/commit resolver rather than the outer-guard shape
 * `sellMiner` still has, because that shape is what the C-9 ratchet
 * (`__tests__/refactor/updaterResultRatchet.test.ts`) exists to stop growing:
 * an unconditional success tail is only honest for the FIRST update of a React
 * batch. Running the same pure function on the snapshot and again on `prev`
 * means a stale double-tap refuses on its own evidence and pays once.
 *
 * Proceeds go through `applyMoneyDelta` for the same reason the sibling
 * resolvers do - a whole-tier sale is a large credit, and it must respect the
 * money ceiling instead of being hand-added onto `stats.money` (M-7).
 */
export function resolveSellAllMiners(
  state: GameState,
  minerId: string,
  minerName: string,
  purchasePrice: number,
): { state: GameState; success: boolean; message: string } {
  const wh = state.warehouse;
  if (!wh) {
    return { state, success: false, message: 'You need a warehouse to sell miners' };
  }

  const owned = wh.miners?.[minerId] ?? 0;
  const count = typeof owned === 'number' && isFinite(owned) && owned > 0 ? Math.floor(owned) : 0;
  if (count === 0) {
    return { state, success: false, message: `You don't own any ${minerName}s to sell` };
  }

  // Same 50% of the catalogue price per unit that `sellMiner` pays, so selling
  // the fleet in one tap can never beat (or lose to) selling it one at a time.
  const unitPrice = Math.floor((purchasePrice || 0) * 0.5);
  const proceeds = unitPrice * count;
  if (!isFinite(proceeds) || proceeds < 0) {
    return { state, success: false, message: 'Sale price is unavailable right now' };
  }

  const salePatch = applyMoneyDelta(state, proceeds, `Sold ${count} x ${minerName}`);
  if (!salePatch) {
    return { state, success: false, message: 'Could not credit the sale right now' };
  }

  // Drop the tier's key rather than writing 0: `minerDurability` and the yield
  // math both read the count with `|| 0`, and an absent tier is the same shape a
  // player who never bought one has.
  const miners = { ...(wh.miners ?? {}) };
  delete miners[minerId];
  const minerDurability = { ...(wh.minerDurability ?? {}) };
  delete minerDurability[minerId];

  return {
    success: true,
    message: `Sold all ${count} ${minerName}${count === 1 ? '' : 's'} for $${proceeds.toLocaleString()}.`,
    state: {
      ...state,
      ...salePatch,
      warehouse: { ...wh, miners, minerDurability },
    },
  };
}

export function sellAllMiners(
  gameState: GameState,
  setGameState: Dispatch<SetStateAction<GameState>>,
  minerId: string,
  minerName: string,
  purchasePrice: number,
): { success: boolean; message?: string } {
  const preview = resolveSellAllMiners(gameState, minerId, minerName, purchasePrice);
  setGameState(prev => resolveSellAllMiners(prev, minerId, minerName, purchasePrice).state);
  return { success: preview.success, message: preview.message };
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
