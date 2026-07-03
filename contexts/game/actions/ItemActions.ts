/**
 * Item & Purchase Actions
 */
import React from 'react';
import { GameState, HackResult } from '../types';
import { logger } from '@/utils/logger';
import { updateMoney } from './MoneyActions';
import { trackBudgetSpend } from '@/lib/banking/operations';
import { getInflatedPrice } from '@/lib/economy/inflation';
import { formatMoney } from '@/utils/moneyFormatting';
import { rejectIfBlocked } from './_guards';

const log = logger.scope('ItemActions');

export const buyItem = (
  gameState: GameState,
  setGameState: React.Dispatch<React.SetStateAction<GameState>>,
  itemId: string,
  deps: { updateMoney: typeof updateMoney }
) => {
  // P1-3: dead players can't shop.
  const blocked = rejectIfBlocked(gameState);
  if (blocked) return blocked;

  const item = (gameState.items || []).find(i => i.id === itemId);
  if (!item) {
    log.error(`Item not found: ${itemId}`);
    return { success: false, message: 'Item not found' };
  }

  if (item.owned && !item.consumable) {
    return { success: false, message: 'Already owned' }; // Already owned non-consumable
  }

  // CRITICAL: Validate price calculation to prevent NaN/Infinity
  const basePrice = typeof item.price === 'number' && isFinite(item.price) && item.price >= 0 ? item.price : 0;
  const priceIndex = typeof gameState.economy?.priceIndex === 'number' && isFinite(gameState.economy.priceIndex) && gameState.economy.priceIndex > 0 ? gameState.economy.priceIndex : 1;
  
  const price = getInflatedPrice(basePrice, priceIndex);
  
  // CRITICAL: Validate calculated price before comparison
  if (!isFinite(price) || price < 0) {
    log.error(`Invalid price calculated for item ${itemId}: ${price}`, { basePrice, priceIndex });
    return { success: false, message: 'Invalid item price' };
  }
  
  // CRITICAL: Validate money before comparison
  const currentMoney = typeof gameState.stats.money === 'number' && isFinite(gameState.stats.money) && gameState.stats.money >= 0 ? gameState.stats.money : 0;
  
  if (currentMoney < price) {
    const shortfall = price - currentMoney;
    return {
      success: false,
      message: `Need ${formatMoney(price)} — you have ${formatMoney(currentMoney)} (${formatMoney(shortfall)} short).`,
    };
  }

  // CRITICAL FIX: Combine money update and item update into a single atomic state update
  // This prevents race conditions where the second setGameState might overwrite the money update
  // ANTI-EXPLOIT: Re-check ownership + affordability inside the prev callback so
  // two rapid same-batch clicks don't both pass the outer gates above and
  // double-charge the player for one item.
  setGameState(prev => {
    const prevItem = (prev.items || []).find(i => i.id === itemId);
    if (prevItem?.owned && !prevItem?.consumable) {
      return prev; // already owned by an earlier same-batch buy
    }
    // Validate and calculate new money value
    const prevMoney = typeof prev.stats.money === 'number' && !isNaN(prev.stats.money)
      ? prev.stats.money
      : 0;
    if (prevMoney < price) {
      return prev; // not enough money (e.g. an earlier same-batch buy drained it)
    }
    const newMoney = Math.max(0, prevMoney - price);
    const moneyChange = newMoney - prevMoney;

    // Update items
    const updatedItems = (prev.items || []).map(i =>
      i.id === itemId ? { ...i, owned: true } : i
    );

    // Update daily summary
    let dailySummary = prev.dailySummary;
    if (dailySummary) {
      dailySummary = {
        ...dailySummary,
        moneyChange: (dailySummary.moneyChange || 0) + moneyChange,
        totalMoneySpent: (dailySummary.totalMoneySpent || 0) + Math.max(0, -moneyChange),
        statsChange: { ...(dailySummary.statsChange || {}) },
        events: [...(dailySummary.events || [])],
      };
    }

    // Log significant transactions
    if (Math.abs(moneyChange) > 1000) {
      log.info(`Item purchase: ${moneyChange > 0 ? '+' : ''}${moneyChange} (Bought item: ${item.name})`);
    }

    // Budget tab: record shop purchases as lifestyle spending. Done inside the
    // updater so a bailed-out purchase (already owned / can't afford) records nothing.
    const banking = prev.banking?.budgetSpend
      ? trackBudgetSpend(prev.banking, prev.weeksLived ?? 0, 'lifestyle', price)
      : prev.banking;

    return {
      ...prev,
      banking,
      stats: {
        ...prev.stats,
        money: newMoney, // Explicitly set the new money value
      },
      items: updatedItems,
      dailySummary,
      // Special case for phone
      hasPhone: itemId === 'smartphone' ? true : prev.hasPhone,
    };
  });
  
  return { success: true, message: `Purchased ${item.name}` };
};

export const performHack = (
  gameState: GameState,
  setGameState: React.Dispatch<React.SetStateAction<GameState>>,
  hackId: string,
  deps: { updateMoney: typeof updateMoney }
): HackResult => {
  const noop: HackResult = { caught: false, reward: 0, btcReward: 0, risk: 0, success: false };

  // P1-3 / H-10: dead or blocked players can't hack.
  if (rejectIfBlocked(gameState)) {
    return noop;
  }

  const hack = (gameState.hacks || []).find(h => h.id === hackId);

  if (!hack || !hack.purchased) {
    return noop;
  }

  // Energy check
  const energyCost = hack.energyCost || 10;
  if (gameState.stats.energy < energyCost) {
    return { caught: false, reward: 0, btcReward: 0, risk: 0, success: false };
  }

  // Calculate success/risk
  // Simplified logic - would use actual game formulas
  const baseSuccess = 60 + (gameState.crimeSkills.hacking?.level || 0) * 5;
  const success = Math.random() * 100 < baseSuccess;
  const detected = !success && Math.random() > 0.5;
  
  const reward = success ? hack.reward : 0;

  const currentWantedLevel = gameState.wantedLevel;
  
  // ANTI-EXPLOIT (H-10): re-check energy INSIDE the updater. Without this, two
  // rapid same-batch taps both pass the stale outer energy gate and apply the
  // reward twice off one energy reading (energy only floors at 0). The
  // success/detected rolls are intentionally computed OUTSIDE the updater so
  // React 19 StrictMode's double-invoke can't re-roll a different outcome.
  setGameState(prev => {
    if (prev.stats.energy < energyCost) {
      return prev; // an earlier same-batch hack already spent the energy
    }
    return {
      ...prev,
      stats: {
        ...prev.stats,
        energy: Math.max(0, prev.stats.energy - energyCost),
        money: (success && reward > 0) ? prev.stats.money + reward : prev.stats.money,
      },
      wantedLevel: detected ? prev.wantedLevel + 1 : prev.wantedLevel,
    };
  });

  return {
    success,
    caught: detected,
    reward,
    btcReward: 0,
    risk: hack.risk,
    jailed: detected && currentWantedLevel >= 5
  };
};

export const sellItem = (
  gameState: GameState,
  setGameState: React.Dispatch<React.SetStateAction<GameState>>,
  itemId: string,
  deps: { updateMoney: typeof updateMoney }
) => {
  // P1-3 / H-9: dead or blocked players can't sell.
  const blocked = rejectIfBlocked(gameState);
  if (blocked) return blocked;

  const item = (gameState.items || []).find(i => i.id === itemId);
  if (!item) {
    log.error(`Item not found: ${itemId}`);
    return { success: false, message: 'Item not found' };
  }

  if (!item.owned) {
    return { success: false, message: 'Item not owned' };
  }

  // CRITICAL: Validate price calculation to prevent NaN/Infinity
  const basePrice = typeof item.price === 'number' && isFinite(item.price) && item.price >= 0 ? item.price : 0;
  const priceIndex = typeof gameState.economy?.priceIndex === 'number' && isFinite(gameState.economy.priceIndex) && gameState.economy.priceIndex > 0 ? gameState.economy.priceIndex : 1;
  
  const sellPrice = getInflatedPrice(basePrice, priceIndex) * 0.5; // Sell for 50% of purchase price
  
  // CRITICAL: Validate calculated price before use
  if (!isFinite(sellPrice) || sellPrice < 0) {
    log.error(`Invalid sell price calculated for item ${itemId}: ${sellPrice}`, { basePrice, priceIndex });
    return { success: false, message: 'Invalid item sell price' };
  }

  // CRITICAL FIX: Combine money update and item update into a single atomic state update
  setGameState(prev => {
    // ANTI-EXPLOIT (H-9): re-check ownership INSIDE the updater. Without this,
    // two rapid same-batch Sell taps both read owned:true from the stale outer
    // snapshot and both credit sellPrice while the item flips to unowned once —
    // a repeatable money printer. Mirror the buyItem ownership re-check.
    const prevItem = (prev.items || []).find(i => i.id === itemId);
    if (!prevItem?.owned) {
      return prev; // already sold by an earlier same-batch tap
    }
    // Validate and calculate new money value
    const prevMoney = typeof prev.stats.money === 'number' && !isNaN(prev.stats.money)
      ? prev.stats.money 
      : 0;
    const newMoney = prevMoney + sellPrice;
    const moneyChange = sellPrice;

    // Update items - set owned to false
    const updatedItems = (prev.items || []).map(i => 
      i.id === itemId ? { ...i, owned: false } : i
    );

    // Update daily summary
    let dailySummary = prev.dailySummary;
    if (dailySummary) {
      dailySummary = {
        ...dailySummary,
        moneyChange: (dailySummary.moneyChange || 0) + moneyChange,
        // P1-4: selling an item converts an asset to cash — NOT income — so it
        // must not count toward the daily "earn $X" gem challenges.
        totalMoneyEarned: (dailySummary.totalMoneyEarned || 0),
        statsChange: { ...(dailySummary.statsChange || {}) },
        events: [...(dailySummary.events || [])],
      };
    }

    // Log significant transactions
    if (Math.abs(moneyChange) > 1000) {
      log.info(`Item sale: +${moneyChange} (Sold item: ${item.name})`);
    }

    return {
      ...prev,
      stats: {
        ...prev.stats,
        money: newMoney, // Explicitly set the new money value
      },
      items: updatedItems,
      dailySummary,
      // Special case for phone
      hasPhone: itemId === 'smartphone' ? false : prev.hasPhone,
    };
  });
  
  return { success: true, message: `Sold ${item.name}` };
};


