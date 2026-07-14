/**
 * Social & Relationship Actions
 */
import React from 'react';
import { GameState } from '../types';
import { clampRelationshipScore } from '@/utils/stateValidation';
import { applyRelationshipGain } from '@/lib/skillTrees/lifeSkillEffects';

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
    // Life Skills: Charisma / Social Master boost positive relationship gains.
    adjustedChange = applyRelationshipGain(prev, adjustedChange);

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

// NOTE: `interactRelation` was retired here. It was a dead action (zero
// non-test callers) whose weekly recency-stamping is now owned by the live
// Contacts flow — `ContactsActions.recordInteraction` (Call / Hang Out / Ask)
// and the DatingActions date/gift updaters. Keeping a second, unused writer of
// `lastInteractionWeek` made the recency source of truth ambiguous.
