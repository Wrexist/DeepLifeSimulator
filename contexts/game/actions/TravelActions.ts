import { GameState, TravelState } from '../types';
import { logger } from '@/utils/logger';
import { trackBudgetSpend } from '@/lib/banking/operations';
import { updateMoney, applyMoneyDelta } from './MoneyActions';
import { updateStats, applyStatsDelta } from './StatsActions';
import { DESTINATIONS } from '@/lib/travel/destinations';
import { quoteTrip, buildTripReturnSummary, isTripReady } from '@/lib/travel/operations';
import { TravelEventDef } from '@/lib/travel/events';
import { quoteActivity } from '@/lib/travel/activities';
import { evaluateTravelMilestones, TravelMilestoneTier } from '@/lib/travel/milestones';
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
  // Kept for signature compatibility; the cost debit is now folded into the
  // guarded updater below instead of a separate updateMoney call.
  _deps: { updateMoney: typeof updateMoney; updateStats: typeof updateStats }
): TravelToResult => {
  const currentWeek = gameState.weeksLived || 0;
  const quote = quoteTrip(destinationId, gameState, currentWeek);
  if (!quote.ok) {
    if (quote.reason === 'unknown-destination') log.error(`Destination ${destinationId} not found`);
    return { success: false, message: quote.message };
  }

  const { destination, adjustedCost, adjustedDuration, returnWeek } = quote;

  // Single guarded updater folds the cost debit + trip booking, so a rapid
  // double-tap can't charge twice or double-book (mirrors the currentTrip
  // re-entry guard in returnFromTrip / purchasePassport).
  // `quoteTrip` above already refused an unknown destination, an in-progress
  // trip, a missing passport and every affordability case, so both rejections
  // inside are same-batch RACE guards for STATE, not the reported outcome.
  setGameState((prev) => {
    if (prev.travel?.currentTrip) return prev;
    // Debit through the canonical money path so the trip cost lands in
    // dailySummary.moneyChange (the daily/weekly money-change readout), matching
    // doTravelActivity. applyMoneyDelta also does the overdraft-reject + NaN-guard.
    const spend = applyMoneyDelta(prev, -adjustedCost, `Travel to ${destination.name}`);
    if (!spend) return prev;
    return {
      ...prev,
      ...spend,
      // Budget tab: trip bookings are entertainment spending.
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
    };
  });

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
  /** Passport milestone tiers newly crossed on THIS return (bounded one-offs). */
  milestonesEarned?: TravelMilestoneTier[];
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

  /**
   * ONE updater: clear the trip AND pay out everything it earned.
   *
   * ── Why this is one updater and not five ──────────────────────────────────
   *
   * This used to clear the trip in a guarded updater, set `let applied = true`
   * inside it, and then apply the stat totals, the event money, the passport
   * milestones and the milestone stamp through four SEPARATE dispatches gated
   * on reading that flag back.
   *
   * A capture is only readable for the FIRST functional update of a React batch
   * (`__tests__/refactor/updaterTimingContract.test.tsx`). On any deferred
   * dispatch the flag read `false` — so the queued clear-trip updater still ran
   * and ENDED THE TRIP, while every reward was skipped and the player was told
   * "You are not on a trip". Losing a whole trip's payoff is a much worse
   * failure than the wrong message that motivated the sweep it was found in.
   *
   * Folding them together also removes the exploit the flag was protecting
   * against, more directly than the flag did: a second same-batch tap finds no
   * matching `currentTrip` and returns `prev`, so the rewards cannot land twice
   * because they are the same object as the clear (CLAUDE.md §4.4).
   *
   * The milestone count is now derived from `prev` rather than the stale outer
   * snapshot, which is a correctness gain in its own right.
   */
  /**
   * The milestone set REPORTED to the caller, derived from the snapshot the
   * player acted on. `evaluateTravelMilestones` is pure, so the updater below
   * re-derives the same answer from `prev` for the state — outcome and state
   * from one function, never a variable read across the updater boundary.
   */
  const previewVisited = gameState.travel?.visitedDestinations || [];
  const previewMilestone = evaluateTravelMilestones(
    previewVisited.includes(destination.id) ? previewVisited.length : previewVisited.length + 1,
    gameState.travel?.passportMilestones
  );

  setGameState((prev) => {
    const cur = prev.travel?.currentTrip;
    if (!cur || cur.destinationId !== trip.destinationId || cur.startWeek !== trip.startWeek) {
      return prev; // trip already returned by a prior tap → no-op
    }
    const alreadyVisited = prev.travel?.visitedDestinations?.includes(destination.id) || false;

    // Passport milestones against the POST-return distinct-destination count.
    const postVisitedCount = (prev.travel?.visitedDestinations || []).length + (alreadyVisited ? 0 : 1);
    const milestone = evaluateTravelMilestones(postVisitedCount, prev.travel?.passportMilestones);

    // Stat totals (destination benefits + event deltas).
    // NOTE: happiness/energy here already include the folded stress-relief +
    // intelligence ("de-stress / broaden the mind") experience via
    // buildTripReturnSummary → deriveExperienceStats, so nothing is dropped.
    const statPatch = applyStatsDelta(prev, {
      happiness: totals.happinessDelta + (milestone.newlyEarned.length ? milestone.happiness : 0),
      health: totals.healthDelta,
      energy: totals.energyDelta,
      ...(totals.reputationDelta || milestone.reputation
        ? { reputation: (totals.reputationDelta ?? 0) + (milestone.newlyEarned.length ? milestone.reputation ?? 0 : 0) }
        : {}),
    });
    let next: GameState = { ...prev, ...statPatch };

    // Money delta from events (lost wallet, tourist trap, etc.). A refused
    // debit must not cost the player their trip, so it degrades to no money
    // change rather than rejecting the whole return.
    if (totals.moneyDelta !== 0) {
      const money = applyMoneyDelta(next, totals.moneyDelta, `Trip events: ${destination.name}`);
      if (money) next = { ...next, ...money };
    }

    return {
      ...next,
      travel: {
        ...prev.travel!,
        currentTrip: undefined,
        visitedDestinations: alreadyVisited
          ? prev.travel?.visitedDestinations || []
          : [...(prev.travel?.visitedDestinations || []), destination.id],
        passportMilestones: milestone.newlyEarned.length
          ? Array.from(new Set([
              ...(prev.travel?.passportMilestones || []),
              ...milestone.newlyEarned.map((t) => t.id),
            ]))
          : prev.travel?.passportMilestones,
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
  void deps; // rewards now fold through applyStatsDelta / applyMoneyDelta

  if (previewMilestone.newlyEarned.length > 0) {
    log.info(`Passport milestone(s) earned: ${previewMilestone.newlyEarned.map((t) => t.id).join(', ')}`);
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
    milestonesEarned: previewMilestone.newlyEarned,
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
  /**
   * Unused, and optional so tests need not fake it.
   *
   * This charges through `applyMoneyDelta` INSIDE the updater — the atomic
   * gate→debit→grant §4.4 requires — so it never needs the injected
   * `updateMoney`. The parameter is kept (renamed, like `_deps` above) rather
   * than deleted because `TravelApp` passes it and the sibling travel actions
   * that DO use their deps take it in the same position.
   */
  _deps?: { updateMoney: typeof updateMoney }
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
  /** Unused — charges atomically via `applyMoneyDelta`. See `purchasePassport`. */
  _deps?: { updateMoney: typeof updateMoney }
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

export interface TravelActivityResult {
  success: boolean;
  message: string;
  activityName?: string;
  souvenir?: string;
}

/**
 * Do an in-trip activity (sightseeing, cuisine, excursion, …). Charges the
 * money + energy cost and grants the bounded happiness/health/reputation lift,
 * marking the activity done for the rest of THIS trip (once-per-trip cooldown).
 *
 * Money-safe: the cash cost runs through `applyMoneyDelta` (overdraft-reject +
 * daily-summary + budget tracking) folded into the SAME guarded updater that
 * marks the activity done AND grants the stat effects, so a double-tap can
 * neither charge twice nor apply the reward twice — the second tap finds the
 * activity already in `activitiesDone` and returns `prev`. One transition, so
 * there is no flag to read back across the updater boundary.
 */
export const doTravelActivity = (
  gameState: GameState,
  setGameState: Dispatch<SetStateAction<GameState>>,
  activityId: string,
  deps: { updateStats: typeof updateStats; updateMoney?: typeof updateMoney }
): TravelActivityResult => {
  const quote = quoteActivity(activityId, gameState);
  if (!quote.ok) {
    return { success: false, message: quote.message };
  }
  const { activity, netEnergy } = quote;

  // `quoteActivity` above already refused a missing trip, the wrong
  // destination, an activity already done this trip, insufficient energy and an
  // unaffordable cost, so every rejection inside is a same-batch RACE guard.
  setGameState((prev) => {
    const trip = prev.travel?.currentTrip;
    if (!trip) return prev;
    // Re-check destination + cooldown + energy against fresh state.
    if (activity.destinationId && activity.destinationId !== trip.destinationId) return prev;
    const done = trip.activitiesDone ?? [];
    if (done.includes(activity.id)) return prev;
    const energy =
      typeof prev.stats?.energy === 'number' && isFinite(prev.stats.energy) ? prev.stats.energy : 0;
    if (energy < activity.energyCost) return prev;

    // Charge the cash cost atomically (canonical path). Zero-cost activities
    // skip the debit but still take the same code path so the money guard is
    // the single source of truth.
    let spend: Pick<GameState, 'stats' | 'dailySummary'> | null = null;
    if (activity.cost > 0) {
      spend = applyMoneyDelta(prev, -activity.cost, `Travel activity: ${activity.name}`);
      if (!spend) return prev; // unaffordable → reject atomically
    }

    // Stat rewards land in the SAME transition as the charge and the cooldown
    // stamp. They used to be a separate `deps.updateStats` dispatch gated on a
    // flag read back after this updater — so a deferred dispatch charged the
    // player, marked the activity done for the trip, and granted nothing.
    const withMoney: GameState = { ...prev, ...(spend || {}) };
    const statPatch = applyStatsDelta(withMoney, {
      ...(activity.effects.happiness ? { happiness: activity.effects.happiness } : {}),
      ...(activity.effects.health ? { health: activity.effects.health } : {}),
      ...(activity.effects.reputation ? { reputation: activity.effects.reputation } : {}),
      ...(netEnergy ? { energy: netEnergy } : {}),
    });

    return {
      ...prev,
      ...(spend || {}),
      ...statPatch,
      // Budget tab: in-trip activities are entertainment spending.
      banking:
        activity.cost > 0 && prev.banking?.budgetSpend
          ? trackBudgetSpend(prev.banking, prev.weeksLived || 0, 'entertainment', activity.cost)
          : prev.banking,
      travel: {
        ...prev.travel!,
        currentTrip: {
          ...trip,
          activitiesDone: [...done, activity.id],
        },
      },
    };
  });

  void deps; // stat rewards now fold through applyStatsDelta inside the updater

  log.info(`Did travel activity ${activity.id} (cost ${formatMoney(activity.cost)})`);
  return {
    success: true,
    message: `${activity.name} — ${activity.souvenir ?? 'a memory to keep.'}`,
    activityName: activity.name,
    souvenir: activity.souvenir,
  };
};
