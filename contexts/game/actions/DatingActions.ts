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

const log = logger.scope('DatingActions');

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

  // Check if can afford
  if (gameState.stats.money < config.cost) {
    return { success: false, message: `You need $${config.cost} for this date.` };
  }

  // Check energy
  if (gameState.stats.energy < config.energy) {
    return { success: false, message: "You're too tired for a date." };
  }

  // Deduct cost
  deps.updateMoney(setGameState, -config.cost, `Date with ${partner.name}`);
  deps.updateStats(setGameState, { energy: -config.energy, happiness: config.happiness });

  // Update relationship
  setGameState(prev => ({
    ...prev,
    relationships: (prev.relationships || []).map(r =>
      r.id === partnerId
        ? {
            ...r,
            relationshipScore: Math.min(100, r.relationshipScore + config.relationshipBoost),
            datesCount: (r.datesCount || 0) + 1,
            lastDateWeek: prev.week,
          }
        : r
    ),
    lifeMilestones: [
      ...(prev.lifeMilestones || []),
      {
        id: `date_${prev.week}_${partnerId}`,
        type: 'first_date' as const,
        week: prev.week,
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

  if (gameState.stats.money < config.cost) {
    return { success: false, message: `You need $${config.cost} for this gift.` };
  }

  deps.updateMoney(setGameState, -config.cost, `Gift for ${partner.name}`);

  setGameState(prev => ({
    ...prev,
    relationships: (prev.relationships || []).map(r =>
      r.id === partnerId
        ? {
            ...r,
            relationshipScore: Math.min(100, r.relationshipScore + config.relationshipBoost),
            giftsReceived: (r.giftsReceived || 0) + 1,
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

  // Deduct cost
  deps.updateMoney(setGameState, -ring.price, `Engagement Ring: ${ring.name}`);

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
  const accepted = guaranteedSuccess ? true : Math.random() * 100 < successRate;

  if (accepted) {
    // Update partner to engaged
    setGameState(prev => ({
      ...prev,
      relationships: (prev.relationships || []).map(r =>
        r.id === partnerId
          ? {
              ...r,
              engagementWeek: prev.week,
              engagementRing: ring,
              relationshipScore: Math.min(100, r.relationshipScore + 15),
            }
          : r
      ),
      lifeMilestones: [
        ...(prev.lifeMilestones || []),
        {
          id: `engagement_${prev.week}_${partnerId}`,
          type: 'engagement' as const,
          week: prev.week,
          year: prev.date.year,
          partnerId,
          details: { ringId, ringName: ring.name },
        },
      ],
    }));

    deps.updateStats(setGameState, { happiness: 30 });
    log.info(`Proposal accepted by ${partner.name}`);
    return { success: true, message: `${partner.name} said YES! You're engaged!`, accepted: true };
  } else {
    // Proposal rejected
    setGameState(prev => ({
      ...prev,
      relationships: (prev.relationships || []).map(r =>
        r.id === partnerId
          ? { ...r, relationshipScore: Math.max(0, r.relationshipScore - 10) }
          : r
      ),
    }));

    deps.updateStats(setGameState, { happiness: -20 });
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

  const scheduledWeek = gameState.week + weeksFromNow;
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
      money: prev.stats.money - deposit,
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
  if (gameState.week < plan.scheduledWeek) {
    return { success: false, message: `The wedding isn't until week ${plan.scheduledWeek}.` };
  }

  // Pay remaining balance (75%)
  const remainingBalance = Math.floor(plan.budget * 0.75);
  if (gameState.stats.money < remainingBalance) {
    return { success: false, message: `You need $${remainingBalance.toLocaleString()} to finalize the wedding!` };
  }

  deps.updateMoney(setGameState, -remainingBalance, `Wedding at ${plan.venueName}`);

  // Calculate bonuses
  const happinessBonus = calculateWeddingHappinessBonus(plan);
  const reputationBonus = calculateWeddingReputationBonus(plan);

  deps.updateStats(setGameState, { happiness: happinessBonus, reputation: reputationBonus });

  // Convert partner to spouse
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
            marriageWeek: prev.week,
            anniversaryWeek: prev.week,
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
      relationships: updatedRelationships,
      family: {
        ...prev.family,
        spouse: spouse,
      },
      lifeMilestones: [
        ...(prev.lifeMilestones || []),
        {
          id: `wedding_${prev.week}_${partnerId}`,
          type: 'wedding' as const,
          week: prev.week,
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
 * File for divorce
 */
export const fileDivorce = (
  gameState: GameState,
  setGameState: Dispatch<SetStateAction<GameState>>,
  spouseId: string,
  deps: { updateMoney: typeof updateMoney; updateStats: typeof updateStats }
): { success: boolean; message: string; settlement?: number } => {
  const spouse = gameState.relationships?.find(r => r.id === spouseId && r.type === 'spouse');
  if (!spouse) {
    return { success: false, message: 'Spouse not found.' };
  }

  // Calculate divorce settlement (lose 30-50% of money)
  const settlementPercent = 0.3 + Math.random() * 0.2;
  const settlement = Math.floor(gameState.stats.money * settlementPercent);

  // Divorce cost (lawyer fees)
  const lawyerFees = 5000;

  if (gameState.stats.money < lawyerFees) {
    return { success: false, message: `You need $${lawyerFees.toLocaleString()} for lawyer fees.` };
  }

  deps.updateMoney(setGameState, -(settlement + lawyerFees), 'Divorce Settlement');
  deps.updateStats(setGameState, { happiness: -40, reputation: -10 });

  // Remove spouse
  setGameState(prev => {
    // RELATIONSHIP STATE FIX: Clear livingTogether before removing spouse (defensive programming)
    const relationships = (prev.relationships || []).map(r =>
      r.id === spouseId ? { ...r, livingTogether: false } : r
    ).filter(r => r.id !== spouseId);
    
    return {
      ...prev,
      relationships,
      family: {
        ...prev.family,
        spouse: undefined,
      },
    };
  });

  log.info(`Divorced ${spouse.name}, settlement: $${settlement}`);
  return { 
    success: true, 
    message: `Divorce finalized. Settlement paid: $${settlement.toLocaleString()}. Lawyer fees: $${lawyerFees.toLocaleString()}.`,
    settlement,
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
            relationshipScore: Math.max(0, r.relationshipScore - 20),
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

  // Check if this is the anniversary week (same week number, different year)
  const marriageWeek = spouse.marriageWeek || spouse.anniversaryWeek;
  const weeksMarried = gameState.week - marriageWeek;
  const yearsMarried = Math.floor(weeksMarried / 52);

  // Anniversary is every 52 weeks
  if (weeksMarried > 0 && weeksMarried % 52 === 0) {
    deps.updateStats(setGameState, { happiness: 10 + yearsMarried });
    
    setGameState(prev => ({
      ...prev,
      lifeMilestones: [
        ...(prev.lifeMilestones || []),
        {
          id: `anniversary_${prev.week}_${spouse.id}`,
          type: 'anniversary' as const,
          week: prev.week,
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

