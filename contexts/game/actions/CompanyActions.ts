/**
 * Company Actions
 */
import React from 'react';
import { GameState, Company } from '../types';
import { COMPANY_UPGRADES, COMPANY_UPGRADE_COST_MULTIPLIER, COMPANY_STARTING_INCOME } from '../companyUpgradeCatalog';
import {
  isPrestigeFeatureUnlocked,
  prestigeUnlockRequirement,
} from '@/lib/progress/featureUnlocks';
import {
  countCompaniesOfType,
  nextCompanyId,
  subsidiaryCost,
  subsidiaryName,
  canFoundAnother,
  MAX_PER_COMPANY_TYPE,
} from '@/lib/business/subsidiaries';
import { logger } from '@/utils/logger';
import { updateMoney } from './MoneyActions';
import { getInflatedPrice } from '@/lib/economy/inflation';
import { formatMoney } from '@/utils/moneyFormatting';
import { createDefaultCompanyOverlay } from '@/lib/business/hustleLogic';
import { hasEarlyCompanyAccess } from '@/lib/prestige/applyUnlocks';
import { isPlayerJailed } from './_guards';

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

  // Can't found a company from a jail cell.
  if (isPlayerJailed(gameState)) {
    return { success: false, message: "You can't start a company from a jail cell." };
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
  // Conglomerate: a subsidiary of a type already owned costs 2.5x the last.
  // This cannot inflate income — company income is capped PER COMPANY by
  // `companyIncomeCap` in passiveIncome ($200k/wk base + $5k per employee),
  // which the maxed originals already sit at — so every company past that
  // point is pure SINK, which is what the late-game economy lacks.
  const ownedOfType = countCompaniesOfType(gameState.companies, companyType);
  const cost = getInflatedPrice(subsidiaryCost(baseCost, ownedOfType), priceIndex);
  
  // CRITICAL: Validate cost before comparison
  if (!isFinite(cost) || cost < 0) {
    log.error(`Invalid cost calculated for company ${companyType}: ${cost}`, { baseCost, priceIndex });
    return { success: false, message: 'Invalid company cost' };
  }
  
  // CRITICAL: Validate money before comparison
  const currentMoney = typeof gameState.stats.money === 'number' && isFinite(gameState.stats.money) && gameState.stats.money >= 0 ? gameState.stats.money : 0;
  
  if (currentMoney < cost) {
    const shortfall = cost - currentMoney;
    return {
      success: false,
      message: `Need ${formatMoney(cost)} to start this company - you have ${formatMoney(currentMoney)} (${formatMoney(shortfall)} short).`,
    };
  }

  // Prestige gate: a SECOND company of a type is conglomerate play, and is the
  // first concrete answer this game has ever had to "why prestige again?".
  // Only bites on subsidiaries - the first of each type is untouched, so
  // nothing an existing player can already do is taken away.
  if (ownedOfType > 0 && !isPrestigeFeatureUnlocked(gameState, 'feature:conglomerate')) {
    return {
      success: false,
      message: prestigeUnlockRequirement(gameState, 'feature:conglomerate'),
    };
  }

  if (!canFoundAnother(gameState.companies, companyType)) {
    return {
      success: false,
      message: `You already run ${MAX_PER_COMPANY_TYPE} of these. That is the limit.`,
    };
  }

  const hasEntrepreneurshipEducation = (gameState.educations || []).find(
    e => e.id === 'entrepreneurship'
  )?.completed;
  // Mirror company.ts: the "Early Company Access" prestige bonus bypasses the
  // education gate. Without this, an early-access player could tap "Found …" in
  // the UI (which offers it) and hit a dead-end "complete Entrepreneurship" error.
  const hasEarlyAccess = hasEarlyCompanyAccess(gameState.prestige?.unlockedBonuses || []);

  if (!hasEarlyAccess && !hasEntrepreneurshipEducation) {
    return { success: false, message: 'You need to complete Entrepreneurship Course first! (Or unlock Early Company Access prestige bonus)' };
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
  
  // Industry-varied starting income (see COMPANY_STARTING_INCOME docs).
  const startingIncome = COMPANY_STARTING_INCOME[companyType] ?? 2000;

  const newCompany: Company = {
    // First of a type keeps the bare type id, exactly as before, so every
    // existing save's companies/upgrades/overlays keep resolving and no
    // migration is needed. Only the second onward are suffixed.
    id: nextCompanyId(gameState.companies, companyType),
    name: subsidiaryName(`My ${capitalizedType}`, ownedOfType),
    type: companyType as Company['type'],
    weeklyIncome: startingIncome,
    baseWeeklyIncome: startingIncome,
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
    // Re-check ownership against FRESH state so a double-tap can't found (and
    // charge) twice - and so we never double-increment totalCompaniesFounded.
    if ((prev.companies || []).some(c => c && c.id === newCompany.id)) return prev;
    // And re-check the PER-TYPE CAP against `prev`, not the stale outer read.
    // `ownedOfType`, the id and the escalating price were all computed outside
    // this updater; if another founding landed in the same batch the count has
    // moved, and without this a third bank could be founded at the second's
    // price. §4.4: re-check the gate against `prev` and return it unchanged to
    // reject.
    if (!canFoundAnother(prev.companies, companyType)) return prev;

    // Seed a Hustle overlay for the new company + increment the "Founded"
    // milestone. Without this the weekly tick skips overlay-less companies
    // (`if (!prevOverlay) continue`) - a fresh company would get no brand
    // drift, market-share evolution, scandals or acquisition offers until the
    // player happened to open a Hustle modal (lazy ensureOverlay). The
    // milestone tile also stayed pinned at 0. Additive + defensive.
    const weeksLived = prev.weeksLived ?? 0;
    const baseHustle = prev.hustleApp ?? {
      companies: {},
      lifetimeStats: {
        totalCompaniesFounded: 0, totalCompaniesSold: 0, totalIPOsLaunched: 0,
        totalAcquisitionsCompleted: 0, totalScandalsSurvived: 0, totalCampaignsRun: 0,
        totalNamedHires: 0, totalFires: 0,
        peakBrandScore: 0, peakMarketShare: 0, peakSharePrice: 0,
      },
    };
    const nextHustle = {
      ...baseHustle,
      companies: {
        ...baseHustle.companies,
        // Preserve an existing overlay if one somehow exists (never clobber).
        [newCompany.id]:
          baseHustle.companies?.[newCompany.id] ?? createDefaultCompanyOverlay(newCompany.id, weeksLived),
      },
      lifetimeStats: {
        ...baseHustle.lifetimeStats,
        totalCompaniesFounded: (baseHustle.lifetimeStats?.totalCompaniesFounded ?? 0) + 1,
      },
    };

    return {
      ...prev,
      companies: [...(prev.companies || []), newCompany],
      company: prev.company ?? newCompany,
      hustleApp: nextHustle,
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
  setGameState: React.Dispatch<React.SetStateAction<GameState>>,
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
  const companyUpgrades = COMPANY_UPGRADES;
  
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

  // Calculate cost based on current level (optimistic - recalculated inside updater)
  const costMultiplier = COMPANY_UPGRADE_COST_MULTIPLIER;
  const nextLevelCostOuter = currentLevelOuter === 0
    ? upgradeDefinition.cost
    : Math.round(upgradeDefinition.cost * Math.pow(costMultiplier, currentLevelOuter));

  // CRITICAL: Validate priceIndex before calculation
  const priceIndex = typeof gameState.economy?.priceIndex === 'number' && isFinite(gameState.economy.priceIndex) && gameState.economy.priceIndex > 0 ? gameState.economy.priceIndex : 1;
  // Business Banking IAP: 15% off all company upgrade purchases.
  const businessBankingDiscount = gameState.settings?.businessBanking ? 0.15 : 0;
  const costOuter = Math.round(getInflatedPrice(nextLevelCostOuter, priceIndex) * (1 - businessBankingDiscount));

  // CRITICAL: Validate cost before comparison
  if (!isFinite(costOuter) || costOuter < 0) {
    log.error(`Invalid cost calculated for upgrade ${upgradeId}: ${costOuter}`, { nextLevelCost: nextLevelCostOuter, priceIndex });
    return { success: false, message: 'Invalid upgrade cost' };
  }

  // CRITICAL: Validate money before comparison
  const currentMoney = typeof gameState.stats.money === 'number' && isFinite(gameState.stats.money) && gameState.stats.money >= 0 ? gameState.stats.money : 0;

  if (currentMoney < costOuter) {
    return { success: false, message: `Need ${formatMoney(costOuter)} for this upgrade - you have ${formatMoney(gameState.stats.money)} (${formatMoney(costOuter - gameState.stats.money)} short).` };
  }

  const preview = resolveBuyCompanyUpgrade(gameState, targetId, upgradeId, upgradeDefinition);
  if (!preview.next) return preview.result;
  setGameState((prev) => resolveBuyCompanyUpgrade(prev, targetId, upgradeId, upgradeDefinition).next ?? prev);
  log.info(`Purchased upgrade ${upgradeDefinition.name} for company ${company.name}`);
  return preview.result;
};

/**
 * PURE: what does buying `upgradeId` for `targetId` do to `state`?
 *
 * `next: null` means refuse. Called once against the caller's snapshot for the
 * outcome and once against `prev` for the state - every level, cost and bonus
 * read stays a read of the state it is given, which is what the original
 * "STALE CLOSURE FIX" comments were protecting.
 *
 * ── Why (2026-08-15) ──────────────────────────────────────────────────────
 *
 * This is C-8, the function the whole read-out-of-updater ratchet was named
 * after. It was first fixed by writing the outcome into a `let result` from
 * inside the updater - "so an updater that React discards, or never runs,
 * reports a rejection rather than a phantom purchase". That trades one wrong
 * answer for another: React runs only the FIRST functional update of a batch
 * eagerly, so a deferred dispatch reported "Could not purchase the upgrade."
 * for an upgrade that had been bought and charged. A pure reducer answers both
 * questions from the same code without a variable crossing the boundary.
 */
function resolveBuyCompanyUpgrade(
  state: GameState,
  targetId: string,
  upgradeId: string,
  upgradeDefinition: { name: string; description: string; cost: number; weeklyIncomeBonus: number; maxLevel: number }
): { result: { success: boolean; message: string }; next: GameState | null } {
  {
    const companies = [...(state.companies || [])];
    const freshIndex = companies.findIndex(c => c.id === targetId);
    if (freshIndex === -1) {
      // Company disappeared - bail out safely
      return { result: { success: false, message: 'Company not found.' }, next: null };
    }
    const companyToUpdate = companies[freshIndex];

    // STALE CLOSURE FIX: Read currentLevel from fresh prev state, not outer closure
    const freshExistingUpgrade = companyToUpdate.upgrades.find(u => u.id === upgradeId);
    const currentLevel = freshExistingUpgrade?.level || 0;

    // Re-validate max level against fresh state. This is the path a double-tap
    // takes: the first tap lands, the second finds the upgrade already maxed.
    if (currentLevel >= upgradeDefinition.maxLevel) {
      return { result: { success: false, message: 'Upgrade is already at maximum level.' }, next: null };
    }

    // Recalculate cost from fresh level
    const nextLevelCost = currentLevel === 0
      ? upgradeDefinition.cost
      : Math.round(upgradeDefinition.cost * Math.pow(COMPANY_UPGRADE_COST_MULTIPLIER, currentLevel));

    const freshPriceIndex = typeof state.economy?.priceIndex === 'number' && isFinite(state.economy.priceIndex) && state.economy.priceIndex > 0 ? state.economy.priceIndex : 1;
    // Business Banking IAP: 15% off (read from fresh state).
    const innerDiscount = state.settings?.businessBanking ? 0.15 : 0;
    const cost = Math.round(getInflatedPrice(nextLevelCost, freshPriceIndex) * (1 - innerDiscount));

    if (!isFinite(cost) || cost < 0) {
      return { result: { success: false, message: 'Invalid upgrade cost' }, next: null };
    }

    // Atomic: check affordability against fresh state
    const prevMoney = state.stats?.money ?? 0;
    if (prevMoney < cost) {
      return {
        result: {
          success: false,
          message: `Need ${formatMoney(cost)} for this upgrade - you have ${formatMoney(prevMoney)} (${formatMoney(cost - prevMoney)} short).`,
        },
        next: null,
      };
    }

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

    return {
      result: {
        success: true,
        message: `Successfully purchased ${upgradeDefinition.name} (Level ${currentLevel + 1}/${upgradeDefinition.maxLevel})!`,
      },
      next: {
        ...state,
        companies,
        company: state.company?.id === targetId ? updated : state.company,
        stats: {
          ...state.stats,
          money: prevMoney - cost,
        },
      },
    };
  }
}


