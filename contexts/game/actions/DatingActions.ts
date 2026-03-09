/**
 * Dating Actions
 * 
 * Handles romantic relationship progression including:
 * - Going on dates
 * - Giving gifts
 * - Proposals and engagement
 * - Wedding planning and execution
 * - Divorce
 */

import { GameState, Relationship, WeddingPlan, EngagementRing } from '../types';
import { logger } from '@/utils/logger';
import { updateMoney } from './MoneyActions';
import { updateStats } from './StatsActions';
import { clampRelationshipScore } from '@/utils/stateValidation';
import { commitDeterministicRolls, getDeterministicRoll } from '@/lib/randomness/deterministicRng';
import {
  ENGAGEMENT_RINGS,
  getEngagementRing,
  calculateProposalSuccessRate,
} from '@/lib/dating/engagementRings';
import {
  WEDDING_VENUES,
  getWeddingVenue,
  calculateWeddingCost,
  createWeddingPlan,
  calculateWeddingHappinessBonus,
  calculateWeddingReputationBonus,
} from '@/lib/dating/weddingVenues';
import type { Dispatch, SetStateAction } from 'react';
import { DIVORCE_LAWYER_BASE_FEE, WEEKS_PER_YEAR } from '@/lib/config/gameConstants';

const log = logger.scope('DatingActions');

const MIN_DIVORCE_CASH_BUFFER = 1000;
const FORCED_STOCK_LIQUIDATION_RATE = 0.97;
const FORCED_REAL_ESTATE_LIQUIDATION_RATE = 0.75;
const DIVORCE_DEBT_APR = 0.12;
const DIVORCE_DEBT_TERM_WEEKS = 104;

const safeNumber = (value: unknown, fallback = 0): number => {
  if (typeof value === 'number' && isFinite(value)) {
    return value;
  }
  return fallback;
};

const calculateDivorceNetWorth = (state: GameState): number => {
  let netWorth = safeNumber(state.stats?.money);
  netWorth += safeNumber(state.bankSavings);

  if (Array.isArray(state.stocks?.holdings)) {
    state.stocks.holdings.forEach(holding => {
      netWorth += safeNumber(holding.shares) * safeNumber(holding.currentPrice);
    });
  }

  if (Array.isArray(state.realEstate)) {
    state.realEstate.forEach(property => {
      if (!property?.owned) return;
      const currentValue = safeNumber(property.currentValue);
      const baseValue = safeNumber(property.price);
      netWorth += Math.max(0, currentValue || baseValue);
    });
  }

  if (Array.isArray(state.companies)) {
    state.companies.forEach(company => {
      netWorth += Math.max(0, safeNumber(company.weeklyIncome) * 10);
    });
  }

  return Math.max(0, netWorth);
};

const calculateForcedStockLiquidity = (state: GameState): number => {
  if (!Array.isArray(state.stocks?.holdings)) return 0;
  return state.stocks.holdings.reduce((total, holding) => {
    const gross = safeNumber(holding.shares) * safeNumber(holding.currentPrice);
    if (gross <= 0) return total;
    return total + Math.floor(gross * FORCED_STOCK_LIQUIDATION_RATE);
  }, 0);
};

const calculateForcedRealEstateLiquidity = (state: GameState): number => {
  if (!Array.isArray(state.realEstate)) return 0;
  return state.realEstate.reduce((total, property) => {
    if (!property?.owned) return total;
    const currentValue = safeNumber(property.currentValue);
    const baseValue = safeNumber(property.price);
    const liquidationBase = Math.max(0, currentValue || baseValue);
    if (liquidationBase <= 0) return total;
    return total + Math.floor(liquidationBase * FORCED_REAL_ESTATE_LIQUIDATION_RATE);
  }, 0);
};

/**
 * Go on a date with a partner
 */
export const goOnDate = (
  gameState: GameState,
  setGameState: Dispatch<SetStateAction<GameState>>,
  partnerId: string,
  dateType: 'casual' | 'coffee' | 'dinner' | 'romantic' | 'adventure' | 'luxury',
  deps: { updateMoney: typeof updateMoney; updateStats: typeof updateStats }
): { success: boolean; message: string } => {
  const partner = gameState.relationships?.find(r => r.id === partnerId && (r.type === 'partner' || r.type === 'spouse'));
  if (!partner) {
    return { success: false, message: 'Partner not found.' };
  }

  // Date costs and effects
  // STABILITY FIX: Added free "chat" option for players without money
  const dateConfigs = {
    chat: { cost: 0, happiness: 2, relationshipBoost: 1, energy: 5 },  // Free option for maintaining relationships
    casual: { cost: 50, happiness: 5, relationshipBoost: 3, energy: 10 },
    coffee: { cost: 30, happiness: 3, relationshipBoost: 2, energy: 5 },
    dinner: { cost: 150, happiness: 10, relationshipBoost: 5, energy: 15 },
    romantic: { cost: 300, happiness: 20, relationshipBoost: 8, energy: 20 },
    adventure: { cost: 500, happiness: 25, relationshipBoost: 10, energy: 30 },
    luxury: { cost: 500, happiness: 30, relationshipBoost: 12, energy: 25 },
  };

  const config = dateConfigs[dateType];

  // ANTI-EXPLOIT: Limit dates per week per partner (prevent free chat date spam)
  const MAX_DATES_PER_WEEK = 2;
  const currentWeeksLived = gameState.weeksLived || 0;
  const lastDateWeek = partner.lastDateWeek || 0;
  const datesThisWeek = lastDateWeek === currentWeeksLived ? (partner.datesThisWeek || 0) : 0;
  if (datesThisWeek >= MAX_DATES_PER_WEEK) {
    return { success: false, message: `You've already been on ${MAX_DATES_PER_WEEK} dates with ${partner.name} this week.` };
  }

  // Check if can afford
  if (gameState.stats.money < config.cost) {
    return { success: false, message: `You need $${config.cost} for this date.` };
  }

  // Check energy
  if (gameState.stats.energy < config.energy) {
    return { success: false, message: "You're too tired for a date." };
  }

  // Atomic update: deduct cost + update stats + update relationship in single setGameState
  setGameState(prev => ({
    ...prev,
    stats: {
      ...prev.stats,
      money: Math.max(0, (prev.stats.money || 0) - config.cost),
      energy: Math.max(0, Math.min(100, (prev.stats.energy || 0) - config.energy)),
      happiness: Math.max(0, Math.min(100, (prev.stats.happiness || 0) + config.happiness)),
    },
    relationships: (prev.relationships || []).map(r =>
      r.id === partnerId
        ? {
            ...r,
            relationshipScore: clampRelationshipScore(r.relationshipScore + config.relationshipBoost),
            datesCount: (r.datesCount || 0) + 1,
            lastDateWeek: prev.weeksLived || 0,
            // ANTI-EXPLOIT: Track dates this week to prevent spam (especially free chat dates)
            datesThisWeek: (r.lastDateWeek === (prev.weeksLived || 0) ? (r.datesThisWeek || 0) : 0) + 1,
          }
        : r
    ),
    // Only record first_date milestone if one doesn't already exist for this partner
    lifeMilestones: (prev.lifeMilestones || []).some(m => m.type === 'first_date' && m.partnerId === partnerId)
      ? prev.lifeMilestones
      : [
          ...(prev.lifeMilestones || []),
          {
            id: `date_${prev.weeksLived || 0}_${partnerId}`,
            type: 'first_date' as const,
            week: prev.weeksLived,
            year: prev.date.year,
            partnerId,
            details: { dateType },
          },
        ],
  }));

  log.info(`Date with ${partner.name} - type: ${dateType}`);
  return { success: true, message: `Had a wonderful ${dateType} date with ${partner.name}!` };
};

/**
 * Give a gift to a partner
 */
export const giveGift = (
  gameState: GameState,
  setGameState: Dispatch<SetStateAction<GameState>>,
  partnerId: string,
  giftType: 'flowers' | 'jewelry' | 'trip' | 'surprise' | 'luxury',
  deps: { updateMoney: typeof updateMoney; updateStats: typeof updateStats }
): { success: boolean; message: string } => {
  const partner = gameState.relationships?.find(r => r.id === partnerId && (r.type === 'partner' || r.type === 'spouse'));
  if (!partner) {
    return { success: false, message: 'Partner not found.' };
  }

  const giftConfigs = {
    flowers: { cost: 50, relationshipBoost: 2, message: 'flowers' },
    jewelry: { cost: 500, relationshipBoost: 8, message: 'beautiful jewelry' },
    trip: { cost: 2000, relationshipBoost: 15, message: 'a surprise trip' },
    surprise: { cost: 200, relationshipBoost: 5, message: 'a thoughtful surprise' },
    luxury: { cost: 2000, relationshipBoost: 15, message: 'a luxury gift' },
  };

  const config = giftConfigs[giftType];

  // ANTI-EXPLOIT: Limit gifts per week per partner to prevent relationship score farming
  const MAX_GIFTS_PER_WEEK = 2;
  const currentWeeksLived = gameState.weeksLived || 0;
  const lastGiftWeek = partner.lastGiftWeek || 0;
  const giftsThisWeek = lastGiftWeek === currentWeeksLived ? (partner.giftsThisWeek || 0) : 0;
  if (giftsThisWeek >= MAX_GIFTS_PER_WEEK) {
    return { success: false, message: `You've already given ${partner.name} ${MAX_GIFTS_PER_WEEK} gifts this week. Give them some space!` };
  }

  if (gameState.stats.money < config.cost) {
    return { success: false, message: `You need $${config.cost} for this gift.` };
  }

  // Atomic update: deduct cost + update relationship in single setGameState
  setGameState(prev => ({
    ...prev,
    stats: {
      ...prev.stats,
      money: Math.max(0, (prev.stats.money || 0) - config.cost),
    },
    relationships: (prev.relationships || []).map(r =>
      r.id === partnerId
        ? {
            ...r,
            relationshipScore: clampRelationshipScore(r.relationshipScore + config.relationshipBoost),
            giftsReceived: (r.giftsReceived || 0) + 1,
            // ANTI-EXPLOIT: Track weekly gift count
            giftsThisWeek: (r.lastGiftWeek === (prev.weeksLived || 0) ? (r.giftsThisWeek || 0) : 0) + 1,
            lastGiftWeek: prev.weeksLived || 0,
          }
        : r
    ),
  }));

  log.info(`Gift to ${partner.name} - type: ${giftType}`);
  return { success: true, message: `${partner.name} loved ${config.message}!` };
};

/**
 * Propose marriage to a partner
 */
export const proposeMarriage = (
  gameState: GameState,
  setGameState: Dispatch<SetStateAction<GameState>>,
  partnerId: string,
  ringId: string,
  deps: { updateMoney: typeof updateMoney; updateStats: typeof updateStats }
): { success: boolean; message: string; accepted: boolean } => {
  const partner = gameState.relationships?.find(r => r.id === partnerId && r.type === 'partner');
  if (!partner) {
    return { success: false, message: 'Partner not found.', accepted: false };
  }

  const ring = getEngagementRing(ringId);
  if (!ring) {
    return { success: false, message: 'Ring not found.', accepted: false };
  }

  // Check if can afford
  if (gameState.stats.money < ring.price) {
    return { success: false, message: `You need $${ring.price.toLocaleString()} for this ring.`, accepted: false };
  }

  // Check relationship score
  if (partner.relationshipScore < 60) {
    return { success: false, message: "Your relationship isn't strong enough yet. Keep building trust!", accepted: false };
  }

  // Calculate success rate
  const successRate = calculateProposalSuccessRate(
    partner.relationshipScore,
    ring,
    partner.datesCount || 0,
    partner.livingTogether || false
  );

  // RANDOMNESS FIX: Soft guarantee - if calculated rate is 95%+, guarantee success
  // This prevents frustrating failures at high relationship scores
  // PRIORITY 2 FIX: Use constant from randomnessConstants
  const { SOFT_GUARANTEE_PROPOSAL } = require('@/lib/randomness/randomnessConstants');
  const guaranteedSuccess = successRate >= SOFT_GUARANTEE_PROPOSAL;
  const proposalRollKey = `proposal:${gameState.weeksLived || 0}:${partnerId}:${ringId}:score:${Math.floor(partner.relationshipScore)}:dates:${partner.datesCount || 0}`;
  const proposalRoll = guaranteedSuccess ? null : getDeterministicRoll(gameState, proposalRollKey);
  const rngCommitKeys = guaranteedSuccess ? [] : [proposalRollKey];
  const accepted = guaranteedSuccess ? true : ((proposalRoll || 0) * 100 < successRate);

  if (accepted) {
    // Atomic update: deduct ring cost + update stats + update relationship + milestone
    setGameState(prev => {
      const nextRngCommitLog = commitDeterministicRolls(prev, rngCommitKeys, prev.weeksLived || 0);
      return {
        ...prev,
        stats: {
          ...prev.stats,
          money: Math.max(0, (prev.stats.money || 0) - ring.price),
          happiness: Math.max(0, Math.min(100, (prev.stats.happiness || 0) + 30)),
        },
        relationships: (prev.relationships || []).map(r =>
          r.id === partnerId
            ? {
                ...r,
                engagementWeek: prev.weeksLived || 0,
                engagementRing: ring,
                relationshipScore: clampRelationshipScore(r.relationshipScore + 15),
              }
            : r
        ),
        lifeMilestones: [
          ...(prev.lifeMilestones || []),
          {
            id: `engagement_${prev.weeksLived || 0}_${partnerId}`,
            type: 'engagement' as const,
            week: prev.weeksLived || 0,
            year: prev.date.year,
            partnerId,
            details: { ringId, ringName: ring.name },
          },
        ],
        rngCommitLog: nextRngCommitLog,
      };
    });

    log.info(`Proposal accepted by ${partner.name}`);
    return { success: true, message: `${partner.name} said YES! You're engaged!`, accepted: true };
  } else {
    // Atomic update: deduct ring cost + update stats + reduce relationship
    setGameState(prev => {
      const nextRngCommitLog = commitDeterministicRolls(prev, rngCommitKeys, prev.weeksLived || 0);
      return {
        ...prev,
        stats: {
          ...prev.stats,
          money: Math.max(0, (prev.stats.money || 0) - ring.price),
          happiness: Math.max(0, Math.min(100, (prev.stats.happiness || 0) - 20)),
        },
        relationships: (prev.relationships || []).map(r =>
          r.id === partnerId
            ? { ...r, relationshipScore: clampRelationshipScore(r.relationshipScore - 10) }
            : r
        ),
        rngCommitLog: nextRngCommitLog,
      };
    });

    log.info(`Proposal rejected by ${partner.name}`);
    return {
      success: true,
      message: `${partner.name} said they're not ready... The relationship needs more time.`,
      accepted: false
    };
  }
};

/**
 * Plan a wedding
 */
export const planWedding = (
  gameState: GameState,
  setGameState: Dispatch<SetStateAction<GameState>>,
  partnerId: string,
  venueId: string,
  guestCount: number,
  weeksFromNow: number,
  options: { catering?: boolean; photography?: boolean; music?: boolean; decorations?: boolean }
): { success: boolean; message: string; plan?: WeddingPlan } => {
  const partner = gameState.relationships?.find(r => r.id === partnerId && r.engagementWeek);
  if (!partner) {
    return { success: false, message: 'You must be engaged first!' };
  }

  if (partner.weddingPlanned) {
    return { success: false, message: 'A wedding is already planned!' };
  }

  const venue = getWeddingVenue(venueId);
  if (!venue) {
    return { success: false, message: 'Venue not found.' };
  }

  if (guestCount > venue.guestCapacity) {
    return { success: false, message: `This venue can only accommodate ${venue.guestCapacity} guests.` };
  }

  const scheduledWeek = (gameState.weeksLived || 0) + weeksFromNow;
  const plan = createWeddingPlan(venueId, partnerId, guestCount, scheduledWeek, options);

  if (!plan) {
    return { success: false, message: 'Could not create wedding plan.' };
  }

  // Check if can afford deposit (25% upfront)
  const deposit = Math.floor(plan.budget * 0.25);
  if (gameState.stats.money < deposit) {
    return { success: false, message: `You need $${deposit.toLocaleString()} for the deposit.` };
  }

  // Save wedding plan
  setGameState(prev => ({
    ...prev,
    relationships: (prev.relationships || []).map(r =>
      r.id === partnerId ? { ...r, weddingPlanned: plan } : r
    ),
    stats: {
      ...prev.stats,
      money: Math.max(0, (prev.stats.money || 0) - deposit),
    },
  }));

  log.info(`Wedding planned at ${venue.name} for week ${scheduledWeek}`);
  return { 
    success: true, 
    message: `Wedding planned for ${weeksFromNow} weeks from now at ${venue.name}! Deposit paid: $${deposit.toLocaleString()}`,
    plan,
  };
};

/**
 * Execute a wedding (convert engaged partner to spouse)
 */
export const executeWedding = (
  gameState: GameState,
  setGameState: Dispatch<SetStateAction<GameState>>,
  partnerId: string,
  deps: { updateMoney: typeof updateMoney; updateStats: typeof updateStats }
): { success: boolean; message: string } => {
  const partner = gameState.relationships?.find(r => r.id === partnerId && r.weddingPlanned);
  if (!partner || !partner.weddingPlanned) {
    return { success: false, message: 'No wedding planned!' };
  }

  const plan = partner.weddingPlanned;

  // Check if it's the scheduled week
  if ((gameState.weeksLived || 0) < plan.scheduledWeek) {
    return { success: false, message: `The wedding isn't until week ${plan.scheduledWeek}.` };
  }

  // Pay remaining balance (75%)
  const remainingBalance = Math.floor(plan.budget * 0.75);
  if (gameState.stats.money < remainingBalance) {
    return { success: false, message: `You need $${remainingBalance.toLocaleString()} to finalize the wedding!` };
  }

  // Calculate bonuses
  const happinessBonus = calculateWeddingHappinessBonus(plan);
  const reputationBonus = calculateWeddingReputationBonus(plan);

  // Atomic update: pay remaining balance + update stats + convert partner to spouse
  setGameState(prev => {
    // RELATIONSHIP STATE FIX: Remove existing spouse if different person (prevent duplicates)
    let relationships = prev.relationships || [];
    const existingSpouse = prev.family?.spouse;
    if (existingSpouse && existingSpouse.id !== partnerId) {
      relationships = relationships.filter(r => r.id !== existingSpouse.id);
      log.warn('Replacing existing spouse during wedding', { oldSpouseId: existingSpouse.id, newSpouseId: partnerId });
    }

    const updatedRelationships = relationships.map(r =>
      r.id === partnerId
        ? {
            ...r,
            type: 'spouse' as const,
            marriageWeek: prev.weeksLived || 0,
            anniversaryWeek: prev.weeksLived || 0,
            // RELATIONSHIP STATE FIX: Clear all engagement properties when becoming spouse
            engagementWeek: undefined,
            engagementRing: undefined,
            weddingPlanned: undefined,
            livingTogether: true, // RELATIONSHIP STATE FIX: Spouses automatically live together
          }
        : r
    );

    // Also set as family spouse
    const spouse = updatedRelationships.find(r => r.id === partnerId);

    return {
      ...prev,
      stats: {
        ...prev.stats,
        money: Math.max(0, (prev.stats.money || 0) - remainingBalance),
        happiness: Math.max(0, Math.min(100, (prev.stats.happiness || 0) + happinessBonus)),
        reputation: Math.max(0, Math.min(100, (prev.stats.reputation || 0) + reputationBonus)),
      },
      relationships: updatedRelationships,
      family: {
        ...prev.family,
        spouse: spouse,
      },
      lifeMilestones: [
        ...(prev.lifeMilestones || []),
        {
          id: `wedding_${prev.weeksLived || 0}_${partnerId}`,
          type: 'wedding' as const,
          week: prev.weeksLived || 0,
          year: prev.date.year,
          partnerId,
          details: {
            venueName: plan.venueName,
            guestCount: plan.guestCount,
            totalCost: plan.budget,
          },
        },
      ],
    };
  });

  log.info(`Wedding executed for ${partner.name}`);
  return { 
    success: true, 
    message: `Congratulations! You and ${partner.name} are now married! 💒` 
  };
};

/**
 * Calculate divorce costs without actually divorcing (for preview)
 */
export const calculateDivorceCosts = (gameState: GameState, spouseId: string): {
  netWorth: number;
  settlement: number;
  settlementPercent: number;
  lawyerFees: number;
  totalCost: number;
  moneyAfter: number;
  immediateLiquidity: number;
  projectedDebt: number;
} | null => {
  const spouse = gameState.relationships?.find(r => r.id === spouseId && r.type === 'spouse');
  if (!spouse) {
    return null;
  }

  const netWorth = calculateDivorceNetWorth(gameState);
  // Use a deterministic settlement percent based on spouse ID for consistency
  // This ensures preview matches actual divorce
  const spouseForCalc = gameState.relationships?.find(r => r.id === spouseId && r.type === 'spouse');
  const spouseHash = spouseForCalc ? spouseForCalc.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) : 0;
  const settlementRatio = 0.15 + ((spouseHash % 20) / 100); // 15-35% of net worth (deterministic)
  const settlement = Math.floor(netWorth * settlementRatio);
  const lawyerFees = DIVORCE_LAWYER_BASE_FEE;
  const liquidAssets = safeNumber(gameState.stats.money) + safeNumber(gameState.bankSavings);
  const forcedStockLiquidity = calculateForcedStockLiquidity(gameState);
  const forcedRealEstateLiquidity = calculateForcedRealEstateLiquidity(gameState);
  const immediateLiquidity = Math.max(
    0,
    liquidAssets + forcedStockLiquidity + forcedRealEstateLiquidity - MIN_DIVORCE_CASH_BUFFER
  );
  const totalCost = settlement + lawyerFees;
  const projectedDebt = Math.max(0, totalCost - immediateLiquidity);
  const immediatePaid = Math.min(totalCost, immediateLiquidity);
  const moneyAfter = Math.max(MIN_DIVORCE_CASH_BUFFER, liquidAssets + forcedStockLiquidity + forcedRealEstateLiquidity - immediatePaid);

  return {
    netWorth,
    settlement,
    settlementPercent: netWorth > 0 ? (settlement / netWorth) * 100 : 0,
    lawyerFees,
    totalCost,
    moneyAfter,
    immediateLiquidity,
    projectedDebt,
  };
};

/**
 * File for divorce
 */
export const fileDivorce = (
  gameState: GameState,
  setGameState: Dispatch<SetStateAction<GameState>>,
  spouseId: string,
  deps: { updateMoney: typeof updateMoney; updateStats: typeof updateStats },
  lawyerId?: string // Optional lawyer ID to fight the settlement
): { success: boolean; message: string; settlement?: number; lawyerResult?: any } => {
  const spouse = gameState.relationships?.find(r => r.id === spouseId && r.type === 'spouse');
  if (!spouse) {
    return { success: false, message: 'Spouse not found.' };
  }

  // ANTI-EXPLOIT: Divorce cooldown - prevent marry/divorce/remarry loop for stat/money manipulation
  const DIVORCE_COOLDOWN_WEEKS = 26; // 6 months cooldown
  const currentWeeksLived = gameState.weeksLived || 0;
  const lastDivorceWeek = gameState.lastDivorceWeek || 0;
  if (lastDivorceWeek > 0 && (currentWeeksLived - lastDivorceWeek) < DIVORCE_COOLDOWN_WEEKS) {
    const weeksToWait = DIVORCE_COOLDOWN_WEEKS - (currentWeeksLived - lastDivorceWeek);
    return { success: false, message: `You must wait ${weeksToWait} more weeks before filing for divorce again.` };
  }

  const netWorth = calculateDivorceNetWorth(gameState);
  const spouseHash = spouse.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const settlementRatio = 0.15 + ((spouseHash % 20) / 100);
  const baseSettlement = Math.floor(netWorth * settlementRatio);

  let lawyerResult: any = null;
  let settlementObligation = baseSettlement;
  let lawyerFees = 5000;
  let lawyerCost = 0;
  const rngCommitKeys: string[] = [];

  if (lawyerId) {
    const lawyerModule = require('@/lib/dating/divorceLawyers');
    const lawyer = lawyerModule.DIVORCE_LAWYERS.find((entry: any) => entry.id === lawyerId);
    if (lawyer) {
      const lawyerSuccessRollKey = `divorce_lawyer_success:${gameState.weeksLived || 0}:${spouseId}:${lawyerId}:${baseSettlement}`;
      const lawyerReductionRollKey = `divorce_lawyer_reduction:${gameState.weeksLived || 0}:${spouseId}:${lawyerId}:${baseSettlement}`;
      const lawyerSuccessRoll = getDeterministicRoll(gameState, lawyerSuccessRollKey);
      const lawyerReductionRoll = getDeterministicRoll(gameState, lawyerReductionRollKey);
      rngCommitKeys.push(lawyerSuccessRollKey, lawyerReductionRollKey);

      lawyerResult = lawyerModule.calculateLawyerOutcome(baseSettlement, lawyer, {
        successRoll: lawyerSuccessRoll,
        reductionRoll: lawyerReductionRoll,
      });
      settlementObligation = Math.max(0, Math.floor(safeNumber(lawyerResult?.reducedSettlement, baseSettlement)));
      lawyerCost = Math.max(0, Math.floor(safeNumber(lawyerResult?.lawyerCost, 0)));

      log.info(
        `[DIVORCE] Lawyer ${lawyer.name} ${lawyerResult?.success ? 'SUCCEEDED' : 'FAILED'}. ` +
        `Settlement: $${baseSettlement} -> $${settlementObligation}`
      );
    }
  }

  const totalObligation = settlementObligation + lawyerFees + lawyerCost;
  const quoteRollKey = `divorce_quote:${gameState.weeksLived || 0}:${spouseId}:${totalObligation}`;
  const quoteRoll = getDeterministicRoll(gameState, quoteRollKey);
  rngCommitKeys.push(quoteRollKey);

  let immediatePaymentApplied = 0;
  let divorceDebtCreated = 0;
  let forcedStockLiquidationPaid = 0;
  let forcedPropertyLiquidationPaid = 0;

  setGameState(prev => {
    const currentMoney = Math.max(0, safeNumber(prev.stats?.money));
    const currentSavings = Math.max(0, safeNumber(prev.bankSavings));

    const availableWithoutLiquidation = Math.max(0, currentMoney - MIN_DIVORCE_CASH_BUFFER) + currentSavings;
    let requiredFromAssetLiquidation = Math.max(0, totalObligation - availableWithoutLiquidation);

    const originalHoldings = Array.isArray(prev.stocks?.holdings) ? prev.stocks.holdings : [];
    const updatedHoldings: NonNullable<GameState['stocks']>['holdings'] = [];
    let stockLiquidationGained = 0;

    originalHoldings.forEach(holding => {
      const shares = Math.max(0, safeNumber(holding.shares));
      const currentPrice = Math.max(0, safeNumber(holding.currentPrice));
      const proceedsPerShare = currentPrice * FORCED_STOCK_LIQUIDATION_RATE;

      if (requiredFromAssetLiquidation <= 0 || shares <= 0 || proceedsPerShare <= 0) {
        updatedHoldings.push(holding);
        return;
      }

      const maxProceeds = shares * proceedsPerShare;
      if (maxProceeds <= requiredFromAssetLiquidation + 0.0001) {
        const realized = Math.floor(maxProceeds);
        stockLiquidationGained += realized;
        requiredFromAssetLiquidation = Math.max(0, requiredFromAssetLiquidation - realized);
        return;
      }

      const sharesToSell = Math.min(shares, Math.ceil(requiredFromAssetLiquidation / proceedsPerShare));
      const realized = Math.floor(sharesToSell * proceedsPerShare);
      if (realized <= 0) {
        updatedHoldings.push(holding);
        return;
      }

      stockLiquidationGained += realized;
      requiredFromAssetLiquidation = Math.max(0, requiredFromAssetLiquidation - realized);

      const remainingShares = Math.max(0, shares - sharesToSell);
      if (remainingShares > 0) {
        updatedHoldings.push({
          ...holding,
          shares: remainingShares,
        });
      }
    });

    let propertyLiquidationGained = 0;
    let updatedRealEstate = Array.isArray(prev.realEstate) ? [...prev.realEstate] : [];
    if (requiredFromAssetLiquidation > 0 && updatedRealEstate.length > 0) {
      const liquidationCandidates = updatedRealEstate
        .filter(property => property?.owned)
        .map(property => {
          const currentValue = safeNumber(property.currentValue);
          const baseValue = safeNumber(property.price);
          const liquidationBase = Math.max(0, currentValue || baseValue);
          const proceeds = Math.floor(liquidationBase * FORCED_REAL_ESTATE_LIQUIDATION_RATE);
          return { id: property.id, proceeds };
        })
        .filter(candidate => candidate.proceeds > 0)
        .sort((a, b) => b.proceeds - a.proceeds);

      const liquidatedPropertyIds = new Set<string>();
      liquidationCandidates.forEach(candidate => {
        if (requiredFromAssetLiquidation <= 0) return;
        liquidatedPropertyIds.add(candidate.id);
        propertyLiquidationGained += candidate.proceeds;
        requiredFromAssetLiquidation = Math.max(0, requiredFromAssetLiquidation - candidate.proceeds);
      });

      if (liquidatedPropertyIds.size > 0) {
        updatedRealEstate = updatedRealEstate.map(property => {
          if (!property?.owned || !liquidatedPropertyIds.has(property.id)) {
            return property;
          }

          const propertyAny = property as any;
          const { currentResidence: _ignoredCurrentResidence, ...withoutResidence } = propertyAny;
          return {
            ...withoutResidence,
            owned: false,
            status: 'vacant' as const,
            rent: 0,
            upkeep: 0,
            currentValue: safeNumber(property.price),
          };
        });
      }
    }

    let remainingObligation = totalObligation;
    let newMoney = currentMoney + stockLiquidationGained + propertyLiquidationGained;
    let newSavings = currentSavings;

    const fromMoney = Math.min(remainingObligation, Math.max(0, newMoney - MIN_DIVORCE_CASH_BUFFER));
    newMoney -= fromMoney;
    remainingObligation -= fromMoney;

    const fromSavings = Math.min(remainingObligation, Math.max(0, newSavings));
    newSavings -= fromSavings;
    remainingObligation -= fromSavings;

    const debtShortfall = Math.max(0, Math.ceil(remainingObligation));
    const immediatePayment = totalObligation - debtShortfall;

    const updatedLoans = [...(prev.loans || [])];
    if (debtShortfall > 0) {
      const weeklyPayment = Math.max(
        50,
        Math.round(
          Math.max(
            debtShortfall / DIVORCE_DEBT_TERM_WEEKS,
            debtShortfall * 0.005
          )
        )
      );
      updatedLoans.push({
        id: `divorce_loan_${spouseId}_${prev.weeksLived || 0}_${updatedLoans.length + 1}`,
        name: 'Divorce Settlement Debt',
        principal: debtShortfall,
        remaining: debtShortfall,
        rateAPR: DIVORCE_DEBT_APR,
        termWeeks: DIVORCE_DEBT_TERM_WEEKS,
        weeklyPayment,
        startWeek: prev.weeksLived || prev.week || 0,
        autoPay: true,
        type: 'personal',
        weeksRemaining: DIVORCE_DEBT_TERM_WEEKS,
        interestRate: DIVORCE_DEBT_APR,
      });
    }

    const updatedStats = { ...prev.stats };
    updatedStats.money = Math.max(0, newMoney);
    updatedStats.happiness = Math.max(0, Math.min(100, safeNumber(updatedStats.happiness) - 40));
    updatedStats.reputation = Math.max(0, Math.min(100, safeNumber(updatedStats.reputation) - 10));

    const dailySummary = {
      ...prev.dailySummary,
      moneyChange: (prev.dailySummary?.moneyChange || 0) - immediatePayment,
      statsChange: {
        ...(prev.dailySummary?.statsChange || {}),
        happiness: (prev.dailySummary?.statsChange?.happiness || 0) - 40,
        reputation: (prev.dailySummary?.statsChange?.reputation || 0) - 10,
      },
      events: prev.dailySummary?.events || [],
    };

    const relationships = (prev.relationships || [])
      .map(r => (r.id === spouseId ? { ...r, livingTogether: false } : r))
      .filter(r => r.id !== spouseId);

    const nextRngCommitLog = commitDeterministicRolls(prev, rngCommitKeys, prev.weeksLived || 0);

    immediatePaymentApplied = immediatePayment;
    divorceDebtCreated = debtShortfall;
    forcedStockLiquidationPaid = stockLiquidationGained;
    forcedPropertyLiquidationPaid = propertyLiquidationGained;

    return {
      ...prev,
      stats: updatedStats,
      bankSavings: Math.max(0, newSavings),
      stocks: prev.stocks
        ? {
            ...prev.stocks,
            holdings: updatedHoldings,
          }
        : prev.stocks,
      realEstate: updatedRealEstate,
      loans: updatedLoans,
      relationships,
      family: {
        ...prev.family,
        spouse: undefined,
      },
      // ANTI-EXPLOIT: Track divorce week for cooldown (prevent marry/divorce cycling)
      lastDivorceWeek: prev.weeksLived || 0,
      dailySummary,
      rngCommitLog: nextRngCommitLog,
    };
  });

  const funnyDivorceQuotes = [
    "'I thought till death do us part meant something.'",
    "'Congratulations, you won... the settlement bill.'",
    "'The prenup did not include emotional damages.'",
    "'You can keep the house, I kept the debt.'",
    "'Signed, sealed, billed.'",
    "'For better or worse definitely meant worse.'",
    "'Thanks for donating to the ex-spouse fund.'",
    "'Bank account: stressed. Lawyer: paid.'",
  ];
  const quoteIndex = Math.min(
    funnyDivorceQuotes.length - 1,
    Math.max(0, Math.floor(quoteRoll * funnyDivorceQuotes.length))
  );
  const randomQuote = funnyDivorceQuotes[quoteIndex];

  log.info(
    `Divorced ${spouse.name}, settlement: $${settlementObligation} ` +
    `(${(settlementRatio * 100).toFixed(1)}% of $${netWorth.toLocaleString()} net worth), ` +
    `immediate payment: $${Math.round(immediatePaymentApplied)}, debt: $${Math.round(divorceDebtCreated)}`
  );

  let message = `DIVORCE FINALIZED!\n\n${randomQuote}\n\n`;

  if (lawyerResult && lawyerResult.success) {
    message += `Your lawyer successfully reduced the settlement.\n`;
    message += `Original settlement: $${baseSettlement.toLocaleString()}\n`;
    message += `Reduced settlement: $${settlementObligation.toLocaleString()} (${safeNumber(lawyerResult.reductionPercent).toFixed(1)}% reduction)\n\n`;
  } else if (lawyerResult && !lawyerResult.success) {
    message += `Your lawyer failed to reduce the settlement.\n`;
    message += `Settlement: $${settlementObligation.toLocaleString()}\n\n`;
  } else {
    message += `Net worth settlement: $${settlementObligation.toLocaleString()} (${(settlementRatio * 100).toFixed(1)}% of your $${netWorth.toLocaleString()} net worth)\n\n`;
  }

  message += `Base lawyer fees: $${lawyerFees.toLocaleString()}\n`;
  if (lawyerCost > 0) {
    message += `Lawyer cost: $${lawyerCost.toLocaleString()}\n`;
  }
  if (forcedStockLiquidationPaid > 0) {
    message += `Forced stock liquidation: $${Math.round(forcedStockLiquidationPaid).toLocaleString()}\n`;
  }
  if (forcedPropertyLiquidationPaid > 0) {
    message += `Forced property liquidation: $${Math.round(forcedPropertyLiquidationPaid).toLocaleString()}\n`;
  }
  if (divorceDebtCreated > 0) {
    message += `Settlement debt created: $${Math.round(divorceDebtCreated).toLocaleString()} (auto-paid weekly)\n`;
  }
  message += `Total obligation: $${totalObligation.toLocaleString()}\n`;
  message += `Immediate payment: $${Math.round(immediatePaymentApplied).toLocaleString()}`;

  return {
    success: true,
    message,
    settlement: totalObligation,
    lawyerResult,
  };
};
/**
 * Cancel engagement
 */
export const cancelEngagement = (
  gameState: GameState,
  setGameState: Dispatch<SetStateAction<GameState>>,
  partnerId: string,
  deps: { updateStats: typeof updateStats }
): { success: boolean; message: string } => {
  const partner = gameState.relationships?.find(r => r.id === partnerId && r.engagementWeek);
  if (!partner) {
    return { success: false, message: 'Engagement not found.' };
  }

  deps.updateStats(setGameState, { happiness: -15 });

  // Revert to regular partner
  setGameState(prev => ({
    ...prev,
    relationships: (prev.relationships || []).map(r =>
      r.id === partnerId
        ? {
            ...r,
            engagementWeek: undefined,
            engagementRing: undefined,
            weddingPlanned: undefined,
            relationshipScore: clampRelationshipScore(r.relationshipScore - 20),
          }
        : r
    ),
  }));

  log.info(`Engagement cancelled with ${partner.name}`);
  return { success: true, message: `Engagement with ${partner.name} has been called off.` };
};

/**
 * Check if it's the anniversary week
 */
export const checkAnniversary = (
  gameState: GameState,
  setGameState: Dispatch<SetStateAction<GameState>>,
  deps: { updateStats: typeof updateStats }
): { isAnniversary: boolean; yearsMarried?: number } => {
  const spouse = gameState.relationships?.find(r => r.type === 'spouse');
  if (!spouse || !spouse.anniversaryWeek) {
    return { isAnniversary: false };
  }

  // Use absolute timeline (weeksLived) to avoid 1..4 week wrap bugs.
  const absoluteWeek = gameState.weeksLived || 0;
  let marriageWeek = spouse.marriageWeek ?? spouse.anniversaryWeek;
  if (typeof marriageWeek !== 'number' || !isFinite(marriageWeek)) {
    return { isAnniversary: false };
  }
  if (marriageWeek <= 4 && absoluteWeek > 4) {
    marriageWeek = Math.max(0, absoluteWeek - ((gameState.week - marriageWeek + 4) % 4));
  }

  const weeksMarried = Math.max(0, absoluteWeek - marriageWeek);
  const yearsMarried = Math.floor(weeksMarried / WEEKS_PER_YEAR);

  // Anniversary is every WEEKS_PER_YEAR weeks
  if (weeksMarried > 0 && weeksMarried % WEEKS_PER_YEAR === 0) {
    deps.updateStats(setGameState, { happiness: 10 + yearsMarried });
    
    setGameState(prev => ({
      ...prev,
      lifeMilestones: [
        ...(prev.lifeMilestones || []),
        {
          id: `anniversary_${prev.weeksLived || 0}_${spouse.id}`,
          type: 'anniversary' as const,
          week: prev.weeksLived || 0,
          year: prev.date.year,
          partnerId: spouse.id,
          details: { yearsMarried },
        },
      ],
    }));

    return { isAnniversary: true, yearsMarried };
  }

  return { isAnniversary: false };
};

/**
 * Get relationship status summary
 */
export const getRelationshipStatus = (relationship: Relationship): {
  status: 'dating' | 'engaged' | 'married';
  canPropose: boolean;
  canPlanWedding: boolean;
  canExecuteWedding: boolean;
} => {
  const isMarried = relationship.type === 'spouse';
  const isEngaged = Boolean(relationship.engagementWeek);
  const hasWeddingPlan = Boolean(relationship.weddingPlanned);

  return {
    status: isMarried ? 'married' : isEngaged ? 'engaged' : 'dating',
    canPropose: !isMarried && !isEngaged && relationship.relationshipScore >= 60,
    canPlanWedding: isEngaged && !hasWeddingPlan,
    canExecuteWedding: hasWeddingPlan,
  };
};

