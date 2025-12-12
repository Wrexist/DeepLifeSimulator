/**
 * Social & Relationship Actions
 */
import { GameState, Relationship } from '../types';
import { logger } from '@/utils/logger';
import { updateStats } from './StatsActions';

const log = logger.scope('SocialActions');

export const updateRelationship = (
  setGameState: React.Dispatch<React.SetStateAction<GameState>>,
  relationshipId: string,
  change: number
) => {
  setGameState(prev => {
    const relationships = (prev.relationships || []).map(r => {
      if (r.id === relationshipId) {
        return {
          ...r,
          relationshipScore: Math.max(0, Math.min(100, r.relationshipScore + change)),
        };
      }
      return r;
    });

    return { ...prev, relationships };
  });
};

export const interactRelation = (
  gameState: GameState,
  setGameState: React.Dispatch<React.SetStateAction<GameState>>,
  relationId: string,
  action: string,
  deps: { updateStats: typeof updateStats }
): { success: boolean; message: string } => {
  const relation = (gameState.relationships || []).find(r => r.id === relationId);
  if (!relation) return { success: false, message: 'Person not found' };

  if (gameState.stats.energy < 10) {
    return { success: false, message: 'Not enough energy' };
  }

  deps.updateStats(setGameState, { energy: -10, happiness: 5 });
  
  // Simple logic - specific actions would have different effects
  updateRelationship(setGameState, relationId, 5);

  return { success: true, message: `Interacted with ${relation.name}` };
};


