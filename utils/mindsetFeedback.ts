import { GameState } from '@/contexts/game/types';
import { applyMindsetEffects, MindsetFeedback } from '@/lib/mindset/config';

/**
 * Get mindset feedback message for a stat change
 * This can be called from components to show mindset-related notifications
 */
export function getMindsetFeedback(
  gameState: GameState,
  moneyDelta: number = 0,
  healthDelta: number = 0,
  happinessDelta: number = 0
): MindsetFeedback | null {
  const result = applyMindsetEffects(gameState, {
    moneyDelta,
    healthDelta,
    happinessDelta,
  });
  
  return result.feedback || null;
}

