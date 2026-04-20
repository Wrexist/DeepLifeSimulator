import { GameState, TravelState } from '../types';
import { logger } from '@/utils/logger';
import { updateMoney } from './MoneyActions';
import { updateStats } from './StatsActions';
import { DESTINATIONS, TravelDestination } from '@/lib/travel/destinations';
import type { Dispatch, SetStateAction } from 'react';

const log = logger.scope('TravelActions');

export const travelTo = (
  gameState: GameState,
  setGameState: Dispatch<SetStateAction<GameState>>,
  destinationId: string,
  deps: { updateMoney: typeof updateMoney; updateStats: typeof updateStats }
) => {
  const destination = DESTINATIONS.find(d => d.id === destinationId);
  if (!destination) {
    log.error(`Destination ${destinationId} not found`);
    return { success: false, message: 'Destination not found' };
  }

  // Check if already on a trip
  if (gameState.travel?.currentTrip) {
    return { success: false, message: 'You are already on a trip!' };
  }

  // Check requirements
  if (destination.requirements) {
    if ('money' in destination.requirements && destination.requirements.money && gameState.stats.money < destination.requirements.money) {
      return { success: false, message: 'Insufficient funds for this destination' };
    }
    if ('happiness' in destination.requirements && destination.requirements.happiness && gameState.stats.happiness < destination.requirements.happiness) {
      return { success: false, message: 'You need higher happiness to visit this destination' };
    }
    if ('items' in destination.requirements && destination.requirements.items) {
      const hasPassport = destination.requirements.items.includes('passport');
      const passportItem = gameState.items?.find(i => i.id === 'passport');
      const ownsPassport = gameState.travel?.passportOwned || passportItem?.owned;
      if (hasPassport && !ownsPassport) {
        return { success: false, message: 'You need a passport to visit this destination' };
      }
    }
  }

  // Apply transportation policy effects (travel cost reduction)
  const transportPolicyEffects = gameState.politics?.activePolicyEffects?.transportation;
  const travelCostReduction = transportPolicyEffects?.travelCostReduction || 0;
  const adjustedCost = Math.max(0, Math.floor(destination.cost * (1 - travelCostReduction / 100)));

  if (gameState.stats.money < adjustedCost) {
    return { success: false, message: 'Insufficient funds' };
  }

  deps.updateMoney(setGameState, -adjustedCost, `Travel to ${destination.name}`);

  // Set current trip using absolute timeline (weeksLived) to avoid 1..4 week wrap bugs
  const absoluteWeek = gameState.weeksLived || 0;
  const returnWeek = absoluteWeek + destination.duration;
  setGameState(prev => ({
    ...prev,
    travel: {
      ...prev.travel,
      currentTrip: {
        destinationId: destination.id,
        returnWeek,
        startWeek: prev.weeksLived || 0,
      },
      visitedDestinations: prev.travel?.visitedDestinations || [],
      travelHistory: [
        ...(prev.travel?.travelHistory || []),
        {
          destinationId: destination.id,
          week: prev.weeksLived || 0,
          year: prev.date.year,
        },
      ],
      businessOpportunities: prev.travel?.businessOpportunities || {},
    } as TravelState,
  }));

  log.info(`Traveled to ${destination.name}, returning week ${returnWeek}`);
  return { success: true, message: `Enjoyed your trip to ${destination.name}! You'll return in ${destination.duration} week(s).` };
};

export const returnFromTrip = (
  gameState: GameState,
  setGameState: Dispatch<SetStateAction<GameState>>,
  deps: { updateStats: typeof updateStats }
) => {
  if (!gameState.travel?.currentTrip) {
    return { success: false, message: 'You are not on a trip' };
  }

  const currentTrip = gameState.travel.currentTrip;
  const destinationId = currentTrip.destinationId;
  const destination = DESTINATIONS.find(d => d.id === destinationId);
  if (!destination) {
    log.error(`Destination ${destinationId} not found`);
    return { success: false, message: 'Destination not found' };
  }

  // Enforce trip duration — cannot return early for full benefits
  const currentAbsoluteWeek = gameState.weeksLived || 0;
  const returnWeek = currentTrip.returnWeek || 0;
  // Migrate legacy returnWeek values (stored as week-of-month 1-4) to absolute
  const effectiveReturnWeek = returnWeek <= 8 && currentAbsoluteWeek > 8
    ? currentAbsoluteWeek // Legacy data: allow return immediately
    : returnWeek;
  if (currentAbsoluteWeek < effectiveReturnWeek) {
    const weeksRemaining = effectiveReturnWeek - currentAbsoluteWeek;
    return { success: false, message: `You're still traveling! Return in ${weeksRemaining} week(s).` };
  }

  // Apply benefits on return using functional update to get latest state
  deps.updateStats(setGameState, {
    happiness: destination.benefits.happiness,
    health: destination.benefits.health,
    energy: destination.benefits.energy,
    ...(destination.benefits.reputation ? { reputation: destination.benefits.reputation } : {}),
  });

  // Check if first visit and unlock business opportunity
  const isFirstVisit = !gameState.travel?.visitedDestinations?.includes(destination.id);

  // Clear current trip and conditionally unlock business opportunity
  setGameState(prev => {
    const alreadyVisited = prev.travel?.visitedDestinations?.includes(destination.id) || false;
    const newState = {
      ...prev,
      travel: {
        ...prev.travel!,
        currentTrip: undefined,
        visitedDestinations: alreadyVisited
          ? (prev.travel?.visitedDestinations || [])
          : [...(prev.travel?.visitedDestinations || []), destination.id],
      },
    };
    return newState;
  });

  // Unlock business opportunity after trip completion if first visit
  if (isFirstVisit) {
    unlockBusinessOpportunity(gameState, setGameState, destination.id);
  }

  log.info(`Returned from ${destination.name}`);
  return { success: true, message: `Welcome back from ${destination.name}!` };
};

export const unlockBusinessOpportunity = (
  gameState: GameState,
  setGameState: Dispatch<SetStateAction<GameState>>,
  destinationId: string
) => {
  const destination = DESTINATIONS.find(d => d.id === destinationId);
  if (!destination) {
    return { success: false, message: 'Destination not found' };
  }

  // Generate business opportunity based on destination
  const opportunityId = `business_${destinationId}`;
  // ANTI-EXPLOIT: Cap business opportunity income to prevent travel farming
  // Was 10% of destination cost/week with no cap (expensive destinations = massive passive income)
  const MAX_BUSINESS_OPPORTUNITY_WEEKLY_INCOME = 2000;
  const rawIncome = destination.cost * 0.05; // Reduced from 10% to 5% of travel cost
  const baseIncome = Math.min(MAX_BUSINESS_OPPORTUNITY_WEEKLY_INCOME, rawIncome);

  setGameState(prev => ({
    ...prev,
    travel: {
      ...prev.travel || {
        visitedDestinations: [],
        passportOwned: false,
        businessOpportunities: {},
        travelHistory: [],
      },
      businessOpportunities: {
        ...prev.travel?.businessOpportunities,
        [opportunityId]: {
          id: opportunityId,
          destinationId,
          name: `${destination.name} Business Opportunity`,
          description: `Invest in a business opportunity in ${destination.name}`,
          cost: destination.cost * 2, // Investment cost
          weeklyIncome: baseIncome,
          unlocked: true,
        },
      },
    },
  }));

  log.info(`Unlocked business opportunity for ${destination.name}`);
  return { success: true, message: `Business opportunity unlocked in ${destination.name}!` };
};

export const purchasePassport = (
  gameState: GameState,
  setGameState: Dispatch<SetStateAction<GameState>>,
  deps: { updateMoney: typeof updateMoney }
) => {
  const passportCost = 500;

  // Check if passport is already owned (either via items or travel state)
  const passportItem = gameState.items?.find(i => i.id === 'passport');
  if (gameState.travel?.passportOwned || passportItem?.owned) {
    return { success: false, message: 'You already own a passport' };
  }

  if (gameState.stats.money < passportCost) {
    return { success: false, message: 'Insufficient funds' };
  }

  deps.updateMoney(setGameState, -passportCost, 'Passport purchase');

  setGameState(prev => ({
    ...prev,
    travel: {
      ...prev.travel || {
        visitedDestinations: [],
        businessOpportunities: {},
        travelHistory: [],
      },
      passportOwned: true,
    },
  }));

  log.info('Passport purchased');
  return { success: true, message: 'Passport purchased! You can now travel internationally.' };
};

export const investInBusinessOpportunity = (
  gameState: GameState,
  setGameState: Dispatch<SetStateAction<GameState>>,
  opportunityId: string,
  deps: { updateMoney: typeof updateMoney }
) => {
  const travel = gameState.travel;
  if (!travel) {
    return { success: false, message: 'Travel state not found' };
  }

  const opportunity = travel.businessOpportunities?.[opportunityId];
  if (!opportunity) {
    return { success: false, message: 'Business opportunity not found' };
  }

  if (!opportunity.unlocked) {
    return { success: false, message: 'This business opportunity is not yet unlocked' };
  }

  if (opportunity.invested) {
    return { success: false, message: 'You have already invested in this opportunity' };
  }

  if (gameState.stats.money < opportunity.cost) {
    return { success: false, message: `You need $${opportunity.cost.toLocaleString()} to invest in this opportunity` };
  }

  // Deduct investment cost
  deps.updateMoney(setGameState, -opportunity.cost, `Invest in ${opportunity.name}`);

  // Mark as invested
  setGameState(prev => ({
    ...prev,
    travel: {
      ...prev.travel!,
      businessOpportunities: {
        ...prev.travel?.businessOpportunities || {},
        [opportunityId]: {
          ...opportunity,
          invested: true,
        },
      },
    },
  }));

  log.info(`Invested in business opportunity: ${opportunity.name}`);
  return { success: true, message: `Successfully invested $${opportunity.cost.toLocaleString()} in ${opportunity.name}! You will earn $${opportunity.weeklyIncome.toLocaleString()} per week.` };
};


