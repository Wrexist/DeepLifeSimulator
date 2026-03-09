import { applyRelationAction, Relation, RelationAction } from '@/lib/social/relations';
import type { GameState } from '../GameContext';
import type { Dispatch, SetStateAction } from 'react';

export function addSocialRelation(
  setGameState: Dispatch<SetStateAction<GameState>>,
  relation: Relation
): void {
  setGameState(prev => ({
    ...prev,
    social: { relations: [...prev.social.relations, relation] },
  }));
}

export function interactRelation(
  gameState: GameState,
  setGameState: Dispatch<SetStateAction<GameState>>,
  relationId: string,
  action: RelationAction
): { success: boolean; message: string } {
  const relation = gameState.social.relations.find(r => r.id === relationId);
  if (!relation) return { success: false, message: 'Relation not found' };

  const result = applyRelationAction(relation, action, gameState.weeksLived);
  setGameState(prev => ({
    ...prev,
    social: {
      relations: prev.social.relations.map(r =>
        r.id === relationId ? result.relation : r
      ),
    },
    stats: {
      ...prev.stats,
      happiness: Math.max(0, Math.min(100, prev.stats.happiness + result.happiness)),
    },
  }));
  return { success: true, message: `${action} with ${relation.name}` };
}
