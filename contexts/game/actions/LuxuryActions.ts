/**
 * Luxury & Collectibles actions — buy a trophy asset with cash, sell it back for
 * a resale fraction. Ownership is a list of catalog ids on `GameState.luxuryItems`.
 *
 * CASH SAFETY (money-sensitive):
 *  - Purchases deduct ONLY `stats.money`, via the canonical `applyMoneyDelta`
 *    helper (contexts/game/actions/MoneyActions.ts). That helper rejects
 *    overdrafts atomically and never mints money. We NEVER write a mirrored bank
 *    account balance (checking-default / savings-default), so there is no
 *    cash-mirror desync.
 *  - Charge + grant happen in the SAME `setGameState` updater (mirrors
 *    `purchaseVehicle`) so button-spam can't grant twice while charging once.
 *  - Selling routes the refund through `applyMoneyDelta` with a "sold" reason so
 *    it is not counted as earned income (see isIncomeReason in MoneyActions).
 */

import React from 'react';
import { GameState } from '../types';
import { logger } from '@/utils/logger';
import { applyMoneyDelta } from './MoneyActions';
import { trackBudgetSpend } from '@/lib/banking/operations';
import { commitDeterministicRoll, getDeterministicRoll } from '@/lib/randomness/deterministicRng';
import {
  createLuxuryProperty,
  getLuxuryItem,
  getLuxuryHoldingValue,
  isDevelopable,
  luxuryPropertyId,
  ownsLuxuryItem,
  getLuxuryVerb,
  getVerbAvailability,
  isOnLoan,
  resolveMuseumLoan,
  resolveRace,
  resolveTrackDay,
  getCondition,
  getRestoreCost,
  getHostingAvailability,
  pickAttendees,
  quoteEvent,
  resolveEvent,
  type LuxuryVerb,
  type VerbOutcome,
} from '@/lib/luxury';

const log = logger.scope('LuxuryActions');

export interface LuxuryActionResult {
  success: boolean;
  message: string;
}

/**
 * Buy a luxury item by catalog id. Deducts its price from stats.money and adds
 * the id to `luxuryItems`, atomically. Returns a user-facing result.
 */
export const purchaseLuxuryItem = (
  gameState: GameState,
  setGameState: React.Dispatch<React.SetStateAction<GameState>>,
  itemId: string,
): LuxuryActionResult => {
  const item = getLuxuryItem(itemId);
  if (!item) {
    log.error(`Luxury item ${itemId} not found`);
    return { success: false, message: 'Item not found.' };
  }

  // Already owned? (Collectibles are unique — you own one of each.)
  if (ownsLuxuryItem(gameState.luxuryItems, itemId)) {
    return { success: false, message: `You already own the ${item.name}.` };
  }

  // Affordability pre-check for the message. The authoritative guard is the
  // applyMoneyDelta overdraft-reject inside the updater below.
  const currentMoney =
    typeof gameState.stats?.money === 'number' && isFinite(gameState.stats.money) && gameState.stats.money >= 0
      ? gameState.stats.money
      : 0;
  if (currentMoney < item.price) {
    return {
      success: false,
      message: `You need $${item.price.toLocaleString()} to buy the ${item.name}.`,
    };
  }

  setGameState((prev) => {
    // Re-check ownership against fresh state so a double-tap can't buy twice.
    if (ownsLuxuryItem(prev.luxuryItems, itemId)) return prev;
    // Atomic charge (overdraft-safe, deducts only stats.money).
    const spend = applyMoneyDelta(prev, -item.price, `Bought luxury: ${item.name}`);
    if (!spend) return prev; // unaffordable → reject the whole update

    // Budget tab: trophy purchases are lifestyle spending (mirror-safe read).
    const banking = prev.banking?.budgetSpend
      ? trackBudgetSpend(prev.banking, prev.weeksLived ?? 0, 'lifestyle', item.price)
      : prev.banking;

    const weeksLived = prev.weeksLived ?? 0;

    // Developable items are LAND: mint a real RealEstate so the player inherits
    // the whole property stack (upgrades, rooms, decor, maintenance,
    // appreciation) instead of owning an inert line item. Guarded against a
    // duplicate id so a re-buy after selling can never mint twice.
    let realEstate = prev.realEstate;
    let propertyId: string | undefined;
    if (isDevelopable(item)) {
      const minted = createLuxuryProperty(item, weeksLived);
      if (minted) {
        const existing = (prev.realEstate || []).some((p) => p?.id === minted.id);
        realEstate = existing ? prev.realEstate : [...(prev.realEstate || []), minted];
        propertyId = minted.id;
      }
    }

    return {
      ...prev,
      ...spend,
      banking,
      realEstate,
      luxuryItems: [...(prev.luxuryItems || []), itemId],
      luxuryHoldings: {
        ...(prev.luxuryHoldings || {}),
        [itemId]: { acquiredWeek: weeksLived, ...(propertyId ? { propertyId } : {}) },
      },
    };
  });

  log.info(`Player purchased luxury: ${item.name} ($${item.price.toLocaleString()})`);
  return { success: true, message: `You are now the proud owner of a ${item.name}! ${item.emoji}` };
};

/**
 * Sell an owned luxury item for its resale fraction. Refund routes through
 * `applyMoneyDelta` (not counted as income) and the id is removed from
 * `luxuryItems`, atomically.
 */
export const sellLuxuryItem = (
  gameState: GameState,
  setGameState: React.Dispatch<React.SetStateAction<GameState>>,
  itemId: string,
): LuxuryActionResult => {
  const item = getLuxuryItem(itemId);
  if (!item) {
    return { success: false, message: 'Item not found.' };
  }
  if (!ownsLuxuryItem(gameState.luxuryItems, itemId)) {
    return { success: false, message: `You don't own the ${item.name}.` };
  }
  // An item on public display is not yours to sell out from under the museum.
  // This is the cost that makes the loan fee and reputation worth something.
  if (isOnLoan(gameState.luxuryHoldings?.[itemId], gameState.weeksLived)) {
    return { success: false, message: `The ${item.name} is on loan. You can't sell it until it comes back.` };
  }

  // What the item is actually worth NOW — appreciation and condition included,
  // the same figure net worth counts it at. It used to be a flat 60% of the
  // CATALOG price, which ignored both: selling a damaged or depreciated trophy
  // paid MORE than it was carrying in net worth, so the sale was a one-tap net
  // worth (and prestige-point) gain, and the whole risk system had no cash
  // consequence. 2026-07-28 audit econ-1.
  const quotedRefund = getLuxuryHoldingValue(item, gameState.luxuryHoldings?.[itemId]);

  // `quotedRefund` IS the reported figure. A `let paidRefund` used to be
  // reassigned from inside the updater; that read is only reliable for the
  // first functional update of a React batch, so the number shown flipped
  // between the quote and the committed value depending on batching order.
  // Reporting the quote is deterministic, and it is the figure the player was
  // looking at when they tapped.
  setGameState((prev) => {
    // Only pay out if it's actually still owned in fresh state.
    if (!ownsLuxuryItem(prev.luxuryItems, itemId)) return prev;
    // Re-price against `prev` for the same reason the ownership check is here:
    // the outer read is a render-time snapshot, and a tick in between can have
    // appreciated or damaged the item.
    const refund = getLuxuryHoldingValue(item, prev.luxuryHoldings?.[itemId]);
    // "sold" keyword keeps this out of totalMoneyEarned (see isIncomeReason).
    const credit = applyMoneyDelta(prev, refund, `Sold luxury: ${item.name}`);
    if (!credit) return prev;
    // Selling the land sells everything built on it. The minted property is
    // removed with the item — leaving an orphan property behind would keep
    // paying its upkeep and counting toward net worth for an island the player
    // no longer owns.
    const mintedId = luxuryPropertyId(itemId);
    const realEstate = isDevelopable(item)
      ? (prev.realEstate || []).filter((p) => p?.id !== mintedId)
      : prev.realEstate;

    const luxuryHoldings = { ...(prev.luxuryHoldings || {}) };
    delete luxuryHoldings[itemId];

    return {
      ...prev,
      ...credit,
      realEstate,
      luxuryItems: (prev.luxuryItems || []).filter((id) => id !== itemId),
      luxuryHoldings,
    };
  });

  log.info(`Player sold luxury: ${item.name} (+$${quotedRefund.toLocaleString()})`);
  return { success: true, message: `Sold your ${item.name} for $${quotedRefund.toLocaleString()}.` };
};


/**
 * Perform a luxury VERB — race the horse, book a track day, loan the diamond.
 *
 * The outcome comes from `getDeterministicRoll` keyed on the verb and the week,
 * so reloading the save and replaying the same week produces the same result.
 * Without that, every outcome would be rerollable by force-quitting.
 */
export const performLuxuryVerb = (
  gameState: GameState,
  setGameState: React.Dispatch<React.SetStateAction<GameState>>,
  verbId: string,
): LuxuryActionResult & { outcome?: VerbOutcome } => {
  const verb: LuxuryVerb | undefined = getLuxuryVerb(verbId);
  if (!verb) {
    log.error(`Luxury verb ${verbId} not found`);
    return { success: false, message: 'That is not something you can do.' };
  }

  const availability = getVerbAvailability(verb, gameState);
  if (!availability.available) {
    return { success: false, message: availability.reason ?? 'You cannot do that right now.' };
  }

  const item = getLuxuryItem(verb.itemId);
  const weeksLived = gameState.weeksLived ?? 0;
  const rollKey = `luxury-verb-${verb.id}-${weeksLived}`;
  const needsRoll = verb.id !== 'museum_loan';
  const roll = needsRoll ? getDeterministicRoll(gameState, rollKey) : 0;

  const outcome: VerbOutcome =
    verb.id === 'race_horse'
      ? resolveRace(roll, gameState.luxuryHoldings?.[verb.itemId])
      : verb.id === 'track_day'
        ? resolveTrackDay(roll)
        : resolveMuseumLoan(weeksLived);

  setGameState((prev) => {
    // Re-check against fresh state so a double-tap can't run the verb twice.
    if (!getVerbAvailability(verb, prev).available) return prev;

    // Entry fee + outcome money in ONE money movement, so a losing track day
    // can never overdraft past the guard.
    const netMoney = outcome.money - verb.cost;
    const moved = netMoney !== 0 ? applyMoneyDelta(prev, netMoney, `Luxury: ${verb.label}`) : null;
    if (netMoney !== 0 && !moved) return prev; // unaffordable → whole thing rejects

    const prevHolding = prev.luxuryHoldings?.[verb.itemId] ?? { acquiredWeek: weeksLived };
    const stats = { ...prev.stats, ...(moved?.stats ?? {}) };
    if (verb.energyCost > 0) {
      stats.energy = Math.max(0, (stats.energy ?? 0) - verb.energyCost);
    }
    if (outcome.happiness !== 0) {
      stats.happiness = Math.max(0, Math.min(100, (stats.happiness ?? 0) + outcome.happiness));
    }
    if (outcome.reputation !== 0) {
      stats.reputation = Math.max(0, Math.min(100, (stats.reputation ?? 0) + outcome.reputation));
    }

    return {
      ...prev,
      ...(moved ?? {}),
      stats,
      // Commit the roll so the same week can never be rerolled by reloading.
      // NOTE: this returns the LOG, not a state patch — it must be assigned to
      // `rngCommitLog`, never spread, or the log's own fields (seed, entries,
      // order) land on the state root.
      ...(needsRoll ? { rngCommitLog: commitDeterministicRoll(prev, rollKey, weeksLived) } : {}),
      luxuryHoldings: {
        ...(prev.luxuryHoldings || {}),
        [verb.itemId]: {
          ...prevHolding,
          ...(outcome.holdingPatch ?? {}),
          lastActionWeek: weeksLived,
        },
      },
    };
  });

  log.info(`Luxury verb ${verb.id}: ${outcome.good ? 'good' : 'bad'} outcome`);
  return {
    success: true,
    message: outcome.message,
    outcome,
  };
};

/** Re-export so the UI can label the item a verb belongs to. */
export const luxuryVerbItemName = (verbId: string): string | undefined =>
  getLuxuryItem(getLuxuryVerb(verbId)?.itemId ?? '')?.name;


/**
 * Host an event at a luxury venue — a dinner, a party, a charity gala.
 *
 * This is the first thing in the feature where owning two trophies is worth
 * more than owning them apart: the rest of the collection decides who turns up
 * (`getGuestList`), and a better room means more reputation and warmer
 * relationships. The party is also the only luxury action that touches the
 * player's actual social graph.
 */
export const hostLuxuryEvent = (
  gameState: GameState,
  setGameState: React.Dispatch<React.SetStateAction<GameState>>,
  itemId: string,
  tier: string,
): LuxuryActionResult => {
  const availability = getHostingAvailability(gameState, itemId, tier);
  if (!availability.available) {
    return { success: false, message: availability.reason ?? 'You cannot host that right now.' };
  }

  const quote = quoteEvent(gameState, itemId, tier);
  if (!quote) return { success: false, message: 'That is not a venue.' };

  const weeksLived = gameState.weeksLived ?? 0;
  const outcome = resolveEvent(quote, pickAttendees(gameState, quote.guestsReached));

  setGameState((prev) => {
    // Re-check against fresh state so a double-tap can't host twice.
    if (!getHostingAvailability(prev, itemId, tier).available) return prev;

    const spend = applyMoneyDelta(prev, -outcome.cost, `Hosted: ${quote.spec.label}`);
    if (!spend) return prev;

    const stats = { ...prev.stats, ...(spend.stats ?? {}) };
    stats.happiness = Math.max(0, Math.min(100, (stats.happiness ?? 0) + outcome.happiness));
    stats.reputation = Math.max(0, Math.min(100, (stats.reputation ?? 0) + outcome.reputation));

    // Warm everyone who came. Clamped to 100 so a run of parties can't push a
    // relationship past its ceiling.
    const attendees = new Set(outcome.attendeeIds);
    const relationships = attendees.size > 0
      ? (prev.relationships || []).map((r) =>
          r && attendees.has(r.id)
            ? {
                ...r,
                relationshipScore: Math.max(
                  0,
                  Math.min(100, (r.relationshipScore ?? 0) + outcome.relationshipGain),
                ),
              }
            : r,
        )
      : prev.relationships;

    return {
      ...prev,
      ...spend,
      stats,
      relationships,
      luxuryHoldings: {
        ...(prev.luxuryHoldings || {}),
        [itemId]: {
          ...(prev.luxuryHoldings?.[itemId] ?? { acquiredWeek: weeksLived }),
          lastHostedWeek: weeksLived,
        },
      },
    };
  });

  log.info(`Hosted ${tier} at ${itemId}`);
  return { success: true, message: outcome.message };
};


/**
 * Insure or un-insure an owned item.
 *
 * The premium is charged weekly by the luxury tick, so this action only flips
 * the flag — there is nothing to pay up front, and cancelling takes effect from
 * the next week. That mirrors how the vehicle insurance already behaves.
 */
export const setLuxuryInsurance = (
  gameState: GameState,
  setGameState: React.Dispatch<React.SetStateAction<GameState>>,
  itemId: string,
  insured: boolean,
): LuxuryActionResult => {
  const item = getLuxuryItem(itemId);
  if (!item) return { success: false, message: 'Item not found.' };
  if (!ownsLuxuryItem(gameState.luxuryItems, itemId)) {
    return { success: false, message: `You don't own the ${item.name}.` };
  }

  setGameState((prev) => {
    // Re-check ownership against fresh state, like every sibling luxury action.
    // The outer check reads a render-time snapshot; without this, insuring an
    // item sold in the same batch would mint a holding for something the player
    // no longer owns — and that holding would then be billed a premium weekly.
    if (!ownsLuxuryItem(prev.luxuryItems, itemId)) return prev;
    return {
      ...prev,
      luxuryHoldings: {
        ...(prev.luxuryHoldings || {}),
        [itemId]: {
          ...(prev.luxuryHoldings?.[itemId] ?? { acquiredWeek: prev.weeksLived ?? 0 }),
          insured,
        },
      },
    };
  });

  return {
    success: true,
    message: insured
      ? `${item.name} insured. The premium starts next week.`
      : `${item.name} is no longer insured. You are carrying the risk yourself.`,
  };
};

/**
 * Pay to restore a damaged item to pristine.
 *
 * Charged in full up front, unlike the weekly costs, because this is a job you
 * commission rather than a bill that arrives.
 */
export const restoreLuxuryItem = (
  gameState: GameState,
  setGameState: React.Dispatch<React.SetStateAction<GameState>>,
  itemId: string,
): LuxuryActionResult => {
  const item = getLuxuryItem(itemId);
  if (!item) return { success: false, message: 'Item not found.' };
  if (!ownsLuxuryItem(gameState.luxuryItems, itemId)) {
    return { success: false, message: `You don't own the ${item.name}.` };
  }

  const holding = gameState.luxuryHoldings?.[itemId];
  const cost = getRestoreCost(item, holding);
  if (cost <= 0) {
    return { success: false, message: `The ${item.name} is already in perfect condition.` };
  }
  if ((gameState.stats?.money ?? 0) < cost) {
    return { success: false, message: `Restoration would cost $${cost.toLocaleString()}.` };
  }

  setGameState((prev) => {
    // Re-check against fresh state so a double-tap can't charge twice.
    const fresh = prev.luxuryHoldings?.[itemId];
    if (getCondition(fresh) >= 100) return prev;
    const freshCost = getRestoreCost(item, fresh);
    const spend = applyMoneyDelta(prev, -freshCost, `Restored ${item.name}`);
    if (!spend) return prev;

    return {
      ...prev,
      ...spend,
      luxuryHoldings: {
        ...(prev.luxuryHoldings || {}),
        [itemId]: { ...(fresh ?? { acquiredWeek: prev.weeksLived ?? 0 }), condition: 100 },
      },
    };
  });

  return { success: true, message: `${item.name} restored for $${cost.toLocaleString()}.` };
};
