/**
 * Item & Purchase Actions
 */
import React from 'react';
import { GameState, HackResult } from '../types';
import { logger } from '@/utils/logger';
import { updateMoney } from './MoneyActions';
import { getInflatedPrice } from '@/lib/economy/inflation';

const log = logger.scope('ItemActions');

export const buyItem = (
  gameState: GameState,
  setGameState: React.Dispatch<React.SetStateAction<GameState>>,
  itemId: string,
  deps: { updateMoney: typeof updateMoney }
) => {
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
    return { success: false, message: 'Not enough money' }; // Not enough money
  }

  // CRITICAL FIX: Combine money update and item update into a single atomic state update
  // This prevents race conditions where the second setGameState might overwrite the money update
  setGameState(prev => {
    // Validate and calculate new money value
    const prevMoney = typeof prev.stats.money === 'number' && !isNaN(prev.stats.money) 
      ? prev.stats.money 
      : 0;
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

    return {
      ...prev,
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
  const hack = (gameState.hacks || []).find(h => h.id === hackId);
  
  if (!hack || !hack.purchased) {
    return { caught: false, reward: 0, btcReward: 0, risk: 0, success: false };
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
  
  // Atomic: merge energy, wanted level, and reward into single update
  setGameState(prev => ({
    ...prev,
    stats: {
      ...prev.stats,
      energy: Math.max(0, prev.stats.energy - energyCost),
      money: (success && reward > 0) ? prev.stats.money + reward : prev.stats.money,
    },
    wantedLevel: detected ? prev.wantedLevel + 1 : prev.wantedLevel,
  }));

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
        totalMoneyEarned: (dailySummary.totalMoneyEarned || 0) + moneyChange,
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


