/**
 * Item & Purchase Actions
 */
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

  const price = getInflatedPrice(item.price, gameState.economy.priceIndex);
  
  if (gameState.stats.money < price) {
    return { success: false, message: 'Not enough money' }; // Not enough money
  }

  deps.updateMoney(setGameState, -price, `Bought item: ${item.name}`);

  setGameState(prev => {
    const updatedItems = (prev.items || []).map(i => 
      i.id === itemId ? { ...i, owned: true } : i
    );

    // Apply item effects immediately if needed, or just mark owned
    // Specific item logic would go here (e.g. phone unlocks features)

    return {
      ...prev,
      items: updatedItems,
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
    return { success: false, message: 'Hack not available', reward: 0, risk: 0, detected: false };
  }

  // Energy check
  const energyCost = hack.energyCost || 10;
  if (gameState.stats.energy < energyCost) {
    return { success: false, message: 'Not enough energy', reward: 0, risk: 0, detected: false };
  }

  // Calculate success/risk
  // Simplified logic - would use actual game formulas
  const baseSuccess = 60 + (gameState.crimeSkills.hacking?.level || 0) * 5;
  const success = Math.random() * 100 < baseSuccess;
  const detected = !success && Math.random() > 0.5;
  
  const reward = success ? hack.reward : 0;

  setGameState(prev => ({
    ...prev,
    stats: {
      ...prev.stats,
      energy: Math.max(0, prev.stats.energy - energyCost),
    },
    wantedLevel: detected ? prev.wantedLevel + 1 : prev.wantedLevel,
  }));

  if (success && reward > 0) {
    deps.updateMoney(setGameState, reward, `Hack reward: ${hack.name}`);
  }

  return {
    success,
    message: success ? `Hacked successfully! +$${reward}` : (detected ? 'Hack failed! You were traced!' : 'Hack failed, but you remained anonymous'),
    reward,
    risk: hack.risk,
    detected
  };
};


