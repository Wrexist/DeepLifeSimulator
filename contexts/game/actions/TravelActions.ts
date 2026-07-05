import { GameState, TravelState } from '../types';
import { logger } from '@/utils/logger';
import { trackBudgetSpend } from '@/lib/banking/operations';
import { updateMoney, applyMoneyDelta } from './MoneyActions';
import { updateStats } from './StatsActions';
import { DESTINATIONS } from '@/lib/travel/destinations';
import { quoteTrip, buildTripReturnSummary, isTripReady } from '@/lib/travel/operations';
import { TravelEventDef } from '@/lib/travel/events';
import { formatMoney } from '@/utils/moneyFormatting';
import type { Dispatch, SetStateAction } from 'react';

const log = logger.scope('TravelActions');

/** Cap travel history at write time (matches the save-prune cap) to bound growth. */
const TRAVEL_HISTORY_CAP = 100;

/** Deterministic per-trip RNG — same trip + week always rolls the same events. */
function makeTripRoller(seedKey: string): (key: string) => number {
  const hash = (s: string): number => {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  };
  return (suffix: string) => {
    const v = hash(`${seedKey}::${suffix}`);
    return (v % 1_000_000) / 1_000_000;
  };
}

export interface TravelToResult {
  success: boolean;
  message: string;
  adjustedCost?: number;
  adjustedDuration?: number;
}

export const travelTo = (
  gameState: GameState,
  setGameState: Dispatch<SetStateAction<GameState>>,
  destinationId: string,
  deps: { updateMoney: typeof updateMoney; updateStats: typeof updateStats }
): TravelToResult => {
  const currentWeek = gameState.weeksLived || 0;
  const quote = quoteTrip(destinationId, gameState, currentWeek);
  if (!quote.ok) {
    if (quote.reason === 'unknown-destination') log.error(`Destination ${destinationId} not found`);
    return { success: false, message: quote.message };
  }

  const { destination, adjustedCost, adjustedDuration, returnWeek } = quote;

  deps.updateMoney(setGameState, -adjustedCost, `Travel to ${destination.name}`);

  setGameState((prev) => ({
    ...prev,
    // Budget tab: trip bookings are entertainment spending (cost was deducted
    // by the updateMoney call above).
    banking: prev.banking?.budgetSpend
      ? trackBudgetSpend(prev.banking, prev.weeksLived || 0, 'entertainment', adjustedCost)
      : prev.banking,
    travel: {
      ...prev.travel,
      currentTrip: {
        destinationId: destination.id,
        returnWeek,
        startWeek: prev.weeksLived || 0,
      },
      visitedDestinations: prev.travel?.visitedDestinations || [],
      passportOwned: prev.travel?.passportOwned || false,
      travelHistory: [
        ...(prev.travel?.travelHistory || []),
        {
          destinationId: destination.id,
          week: prev.weeksLived || 0,
          year: prev.date.year,
        },
      ].slice(-TRAVEL_HISTORY_CAP),
      businessOpportunities: prev.travel?.businessOpportunities || {},
    } as TravelState,
  }));

  log.info(`Traveled to ${destination.name}, returning week ${returnWeek} (cost ${formatMoney(adjustedCost)})`);
  return {
    success: true,
    message: `Enjoyed your trip to ${destination.name}! You'll return in ${adjustedDuration} week(s).`,
    adjustedCost,
    adjustedDuration,
  };
};

export interface TripReturnResult {
  success: boolean;
  message: string;
  events?: TravelEventDef[];
  destinationName?: string;
}

export const returnFromTrip = (
  gameState: GameState,
  setGameState: Dispatch<SetStateAction<GameState>>,
  deps: { updateStats: typeof updateStats; updateMoney?: typeof updateMoney }
): TripReturnResult => {
  if (!gameState.travel?.currentTrip) {
    return { success: false, message: 'You are not on a trip' };
  }

  const currentAbsoluteWeek = gameState.weeksLived || 0;
  const readiness = isTripReady(gameState.travel.currentTrip, currentAbsoluteWeek);
  if (!readiness.ready) {
    return {
      success: false,
      message: `You're still traveling! Return in ${readiness.weeksRemaining} week(s).`,
    };
  }

  const trip = gameState.travel.currentTrip;
  const roller = makeTripRoller(`${trip.destinationId}:${trip.startWeek}`);
  const summary = buildTripReturnSummary(gameState, roller);
  if (!summary) {
    log.error(`Destination ${trip.destinationId} not found`);
    return { success: false, message: 'Destination not found' };
  }

  const { destination, events, totals, firstVisit } = summary;

  // ANTI-EXPLOIT: clear the trip FIRST, guarded against fresh state, and only
  // apply the stat/money rewards if THIS call actually ended the trip. The
  // readiness check above reads the stale snapshot, so two "Return" taps in one
  // batch both passed it and both applied the (additive) stat + money rewards.
  // By clearing inside the updater with a presence check, a second same-batch
  // tap finds no currentTrip and becomes a no-op (applied stays false).
  let applied = false;
  setGameState((prev) => {
    const cur = prev.travel?.currentTrip;
    if (!cur || cur.destinationId !== trip.destinationId || cur.startWeek !== trip.startWeek) {
      return prev; // trip already returned by a prior tap → no-op
    }
    applied = true;
    const alreadyVisited = prev.travel?.visitedDestinations?.includes(destination.id) || false;
    return {
      ...prev,
      travel: {
        ...prev.travel!,
        currentTrip: undefined,
        visitedDestinations: alreadyVisited
          ? prev.travel?.visitedDestinations || []
          : [...(prev.travel?.visitedDestinations || []), destination.id],
      },
      lifetimeStatistics:
        prev.lifetimeStatistics && !alreadyVisited
          ? {
              ...prev.lifetimeStatistics,
              totalTravelDestinations: (prev.lifetimeStatistics.totalTravelDestinations ?? 0) + 1,
            }
          : prev.lifetimeStatistics,
    };
  });

  if (!applied) {
    return { success: false, message: 'You are not on a trip' };
  }

  // Apply stat totals (destination benefits + event deltas) — only once.
  deps.updateStats(setGameState, {
    happiness: totals.happinessDelta,
    health: totals.healthDelta,
    energy: totals.energyDelta,
    ...(totals.reputationDelta ? { reputation: totals.reputationDelta } : {}),
  });

  // Apply money delta from events (lost wallet, tourist trap, etc.)
  if (totals.moneyDelta !== 0 && deps.updateMoney) {
    deps.updateMoney(setGameState, totals.moneyDelta, `Trip events: ${destination.name}`);
  }

  if (firstVisit) {
    unlockBusinessOpportunity(gameState, setGameState, destination.id);
  }

  log.info(`Returned from ${destination.name} with ${events.length} event(s)`);
  return {
    success: true,
    message: `Welcome back from ${destination.name}!`,
    events,
    destinationName: destination.name,
  };
};

export const unlockBusinessOpportunity = (
  _gameState: GameState,
  setGameState: Dispatch<SetStateAction<GameState>>,
  destinationId: string
) => {
  const destination = DESTINATIONS.find((d) => d.id === destinationId);
  if (!destination) {
    return { success: false, message: 'Destination not found' };
  }

  const opportunityId = `business_${destinationId}`;
  const MAX_BUSINESS_OPPORTUNITY_WEEKLY_INCOME = 2000;
  const rawIncome = destination.cost * 0.05;
  const baseIncome = Math.min(MAX_BUSINESS_OPPORTUNITY_WEEKLY_INCOME, rawIncome);

  setGameState((prev) => ({
    ...prev,
    travel: {
      ...(prev.travel || {
        visitedDestinations: [],
        passportOwned: false,
        businessOpportunities: {},
        travelHistory: [],
      }),
      businessOpportunities: {
        ...prev.travel?.businessOpportunities,
        [opportunityId]: {
          id: opportunityId,
          destinationId,
          name: `${destination.name} Business Opportunity`,
          description: `Invest in a business opportunity in ${destination.name}`,
          cost: destination.cost * 2,
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

  const passportItem = gameState.items?.find((i) => i.id === 'passport');
  if (gameState.travel?.passportOwned || passportItem?.owned) {
    return { success: false, message: 'You already own a passport' };
  }

  if (gameState.stats.money < passportCost) {
    return {
      success: false,
      message: `Passport costs ${formatMoney(passportCost)} — you have ${formatMoney(gameState.stats.money)} (${formatMoney(passportCost - gameState.stats.money)} short).`,
    };
  }

  // Atomic gate→debit→grant: re-check ownership + funds against prev so a
  // same-batch double-tap can't charge $500 twice for one passport.
  setGameState((prev) => {
    const prevPassportItem = prev.items?.find((i) => i.id === 'passport');
    if (prev.travel?.passportOwned || prevPassportItem?.owned) return prev;
    const spend = applyMoneyDelta(prev, -passportCost, 'Passport purchase');
    if (!spend) return prev;
    return {
      ...prev,
      ...spend,
      travel: {
        ...(prev.travel || {
          visitedDestinations: [],
          businessOpportunities: {},
          travelHistory: [],
        }),
        passportOwned: true,
      },
    };
  });

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

  // Atomic gate→debit→grant: re-check invested + funds against prev so a
  // same-batch double-tap can't charge the investment cost twice.
  setGameState((prev) => {
    const prevOpp = prev.travel?.businessOpportunities?.[opportunityId];
    if (!prevOpp || !prevOpp.unlocked || prevOpp.invested) return prev;
    const spend = applyMoneyDelta(prev, -prevOpp.cost, `Invest in ${prevOpp.name}`);
    if (!spend) return prev;
    return {
      ...prev,
      ...spend,
      travel: {
        ...prev.travel!,
        businessOpportunities: {
          ...(prev.travel?.businessOpportunities || {}),
          [opportunityId]: {
            ...prevOpp,
            invested: true,
          },
        },
      },
    };
  });

  log.info(`Invested in business opportunity: ${opportunity.name}`);
  return {
    success: true,
    message: `Successfully invested $${opportunity.cost.toLocaleString()} in ${opportunity.name}! You will earn $${opportunity.weeklyIncome.toLocaleString()} per week.`,
  };
};
