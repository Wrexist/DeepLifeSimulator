/**
 * Social & Relationship Actions
 */
import React from 'react';
import { GameState, Relationship } from '../types';
import { logger } from '@/utils/logger';
import { updateStats } from './StatsActions';
import { clampRelationshipScore } from '@/utils/stateValidation';

const log = logger.scope('SocialActions');

export const updateRelationship = (
  setGameState: React.Dispatch<React.SetStateAction<GameState>>,
  relationshipId: string,
  change: number
) => {
  setGameState(prev => {
    // Karma affects relationship gain speed
    let adjustedChange = change;
    if (change > 0 && prev.karma) {
      const { getKarmaModifiers } = require('@/lib/karma/karmaSystem');
      const modifiers = getKarmaModifiers(prev.karma);
      adjustedChange = Math.round(change * modifiers.npcTrustMultiplier);
    }

    const relationships = (prev.relationships || []).map(r => {
      if (r.id === relationshipId) {
        return {
          ...r,
          relationshipScore: clampRelationshipScore(r.relationshipScore + adjustedChange),
        };
      }
      return r;
    });

    return { ...prev, relationships };
  });
};

// ANTI-EXPLOIT: Max interactions per relationship per week to prevent spam
const MAX_INTERACTIONS_PER_WEEK = 3;

// ANTI-EXPLOIT: Diminishing returns on repeated interactions within same week
const INTERACTION_SCORE_BY_COUNT = [5, 3, 1]; // 1st: +5, 2nd: +3, 3rd: +1

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

  // ANTI-EXPLOIT: Check weekly interaction count for this relationship
  const currentWeek = gameState.weeksLived || 0;
  const interactionCount = relation.weeklyInteractions || 0;
  const interactionWeek = relation.lastInteractionWeek || 0;
  // Reset count if we're in a new week
  const effectiveCount = interactionWeek === currentWeek ? interactionCount : 0;

  if (effectiveCount >= MAX_INTERACTIONS_PER_WEEK) {
    return { success: false, message: `You've already spent quality time with ${relation.name} this week. Try again next week!` };
  }

  // ANTI-EXPLOIT: Diminishing returns on score gain
  let scoreGain = INTERACTION_SCORE_BY_COUNT[Math.min(effectiveCount, INTERACTION_SCORE_BY_COUNT.length - 1)] || 1;
  const happinessGain = effectiveCount === 0 ? 5 : effectiveCount === 1 ? 3 : 1;

  // Karma affects relationship building speed
  if (gameState.karma) {
    const { getKarmaModifiers } = require('@/lib/karma/karmaSystem');
    const modifiers = getKarmaModifiers(gameState.karma);
    scoreGain = Math.max(1, Math.round(scoreGain * modifiers.npcTrustMultiplier));
  }

  deps.updateStats(setGameState, { energy: -10, happiness: happinessGain });

  // Update relationship score with diminishing returns AND track interaction count
  setGameState(prev => {
    const relationships = (prev.relationships || []).map(r => {
      if (r.id === relationId) {
        const prevCount = (r.lastInteractionWeek === currentWeek) ? (r.weeklyInteractions || 0) : 0;
        return {
          ...r,
          relationshipScore: clampRelationshipScore(r.relationshipScore + scoreGain),
          weeklyInteractions: prevCount + 1,
          lastInteractionWeek: currentWeek,
        };
      }
      return r;
    });
    return { ...prev, relationships };
  });

  return { success: true, message: `Interacted with ${relation.name} (+${scoreGain} relationship)` };
};


