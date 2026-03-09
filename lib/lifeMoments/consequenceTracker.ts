import type { GameState } from '@/contexts/game/types';
import type { HiddenConsequence, ConsequenceState, ChoiceHistory } from './types';
import { logger } from '@/utils/logger';

const log = logger.scope('ConsequenceTracker');

/**
 * Initialize consequence state for new games or migrations
 * Called when consequenceState is undefined in GameState
 */
export function initializeConsequenceState(state: GameState): ConsequenceState {
  if (state.consequenceState) {
    return state.consequenceState;
  }
  
  return {
    consequences: [],
    choiceHistory: [],
    unlockedEvents: [],
    lockedEvents: [],
    relationshipFlags: {},
    hiddenTraits: [],
    eventWeightModifiers: {},
  };
}

/**
 * Apply a choice's hidden consequences
 * Called from resolveEvent after immediate effects are applied
 */
export function applyChoiceConsequences(
  state: GameState,
  eventId: string,
  choiceId: string,
  hiddenConsequences?: Array<Omit<HiddenConsequence, 'id' | 'eventId' | 'choiceId' | 'active' | 'weeksSinceCreated' | 'createdAt'>>,
  eventCategory?: 'regular' | 'seasonal' | 'economic' | 'personal_crisis'
): { newConsequences: HiddenConsequence[]; updatedState: Partial<ConsequenceState> } {
  const currentState = initializeConsequenceState(state);
  const currentConsequences = currentState.consequences || [];
  
  if (!hiddenConsequences || hiddenConsequences.length === 0) {
    // Still record choice in history even without consequences
    const newChoiceHistory: ChoiceHistory[] = [
      ...currentState.choiceHistory,
      {
        eventId,
        choiceId,
        week: state.week || 1,
        weeksLived: state.weeksLived || 0,
        age: state.date?.age || 18,
        timestamp: Date.now(),
        eventCategory,
      },
    ];
    
    return { 
      newConsequences: currentConsequences, 
      updatedState: { choiceHistory: newChoiceHistory },
    };
  }
  
  const newConsequences: HiddenConsequence[] = [];
  const updatedState: Partial<ConsequenceState> = {
    unlockedEvents: [...currentState.unlockedEvents],
    lockedEvents: [...currentState.lockedEvents],
    relationshipFlags: { ...currentState.relationshipFlags },
    hiddenTraits: [...currentState.hiddenTraits],
    eventWeightModifiers: { ...currentState.eventWeightModifiers },
  };
  
  hiddenConsequences.forEach(consequenceTemplate => {
    const newConsequence: HiddenConsequence = {
      id: `${eventId}_${choiceId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      eventId,
      choiceId,
      ...consequenceTemplate,
      active: consequenceTemplate.weeksUntilActive === undefined || consequenceTemplate.weeksUntilActive === 0,
      weeksSinceCreated: 0,
      createdAt: Date.now(),
    };
    
    newConsequences.push(newConsequence);
    
    // Apply immediate consequences
    if (newConsequence.active) {
      applyActiveConsequence(newConsequence, updatedState);
    }
  });
  
  // Record choice in history
  const newChoiceHistory: ChoiceHistory[] = [
    ...currentState.choiceHistory,
    {
      eventId,
      choiceId,
      week: state.week || 1,
      weeksLived: state.weeksLived || 0,
      age: state.date?.age || 18,
      timestamp: Date.now(),
      eventCategory,
    },
  ];
  
  return {
    newConsequences: [...currentConsequences, ...newConsequences],
    updatedState: {
      ...updatedState,
      choiceHistory: newChoiceHistory,
    },
  };
}

/**
 * Apply an active consequence to the state
 * Internal helper function
 */
function applyActiveConsequence(
  consequence: HiddenConsequence,
  state: Partial<ConsequenceState>
): void {
  switch (consequence.type) {
    case 'unlock_event':
      if (consequence.targetEventId && !state.unlockedEvents?.includes(consequence.targetEventId)) {
        state.unlockedEvents = [...(state.unlockedEvents || []), consequence.targetEventId];
        log.info(`Unlocked event: ${consequence.targetEventId}`);
      }
      break;
      
    case 'lock_event':
      if (consequence.targetEventId && !state.lockedEvents?.includes(consequence.targetEventId)) {
        state.lockedEvents = [...(state.lockedEvents || []), consequence.targetEventId];
        log.info(`Locked event: ${consequence.targetEventId}`);
      }
      break;
      
    case 'modify_weight':
      if (consequence.targetEventId && consequence.weightModifier !== undefined) {
        const currentModifier = state.eventWeightModifiers?.[consequence.targetEventId] || 0;
        state.eventWeightModifiers = {
          ...(state.eventWeightModifiers || {}),
          [consequence.targetEventId]: currentModifier + consequence.weightModifier,
        };
        log.info(`Modified weight for event ${consequence.targetEventId} by ${consequence.weightModifier}`);
      }
      break;
      
    case 'add_trait':
      if (consequence.traitId && !state.hiddenTraits?.includes(consequence.traitId)) {
        state.hiddenTraits = [...(state.hiddenTraits || []), consequence.traitId];
        log.info(`Added hidden trait: ${consequence.traitId}`);
      }
      break;
      
    case 'relationship_flag':
      if (consequence.relationshipId && consequence.relationshipFlag) {
        const relId = consequence.relationshipId;
        const flags = state.relationshipFlags?.[relId] || [];
        if (!flags.includes(consequence.relationshipFlag)) {
          state.relationshipFlags = {
            ...(state.relationshipFlags || {}),
            [relId]: [...flags, consequence.relationshipFlag],
          };
          log.info(`Added flag ${consequence.relationshipFlag} to relationship ${relId}`);
        }
      }
      break;
  }
}

/**
 * Process consequences that activate over time
 * Called from nextWeek function each week
 */
export function processConsequenceProgression(state: GameState): Partial<ConsequenceState> {
  const currentState = initializeConsequenceState(state);
  const consequences = currentState.consequences || [];
  
  const updatedConsequences = consequences.map(consequence => {
    if (consequence.active) return consequence;
    
    const newWeeksSince = consequence.weeksSinceCreated + 1;
    const shouldActivate = consequence.weeksUntilActive !== undefined && 
                          newWeeksSince >= consequence.weeksUntilActive;
    
    if (shouldActivate) {
      log.info(`Activating consequence ${consequence.id} after ${newWeeksSince} weeks`);
      return { ...consequence, active: true, weeksSinceCreated: newWeeksSince };
    }
    
    return { ...consequence, weeksSinceCreated: newWeeksSince };
  });
  
  // Apply newly activated consequences
  const newlyActive = updatedConsequences.filter(
    (c, i) => c.active && !consequences[i]?.active
  );
  
  const updatedState: Partial<ConsequenceState> = {
    ...currentState,
    consequences: updatedConsequences,
  };
  
  newlyActive.forEach(consequence => {
    applyActiveConsequence(consequence, updatedState);
    // Optionally show notification for activated consequences
    if (consequence.description) {
      log.info(`Consequence activated: ${consequence.description}`);
    }
  });
  
  return updatedState;
}

/**
 * Get memory context for an event based on past choices
 * Used to show "You remember..." messages in events
 */
export function getMemoryContext(
  state: GameState,
  currentEventId: string
): string | null {
  const consequenceState = initializeConsequenceState(state);
  const choiceHistory = consequenceState.choiceHistory || [];
  const memories = state.memories || [];
  
  // Find relevant past choices (same event or related events)
  const relevantChoices = choiceHistory.filter(choice => {
    return choice.eventId === currentEventId || 
           isEventRelated(choice.eventId, currentEventId);
  });
  
  if (relevantChoices.length === 0) return null;
  
  // Find memory related to this event
  const memory = memories.find(m => {
    if ('relatedEventId' in m && (m as any).relatedEventId === currentEventId) {
      return true;
    }
    return false;
  });
  
  if (memory) {
    return `You remember: ${memory.description || (memory as any).text}`;
  }
  
  return null;
}

/**
 * Check if two events are related (for memory context)
 * Simple heuristic: events with similar prefixes are related
 */
function isEventRelated(eventId1: string, eventId2: string): boolean {
  const prefix1 = eventId1.split('_')[0];
  const prefix2 = eventId2.split('_')[0];
  return prefix1 === prefix2;
}

