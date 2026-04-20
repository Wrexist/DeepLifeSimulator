import type { GameState } from '@/contexts/game/types';
import type { Memory } from '@/lib/legacy/memories';
import { generateMemoryId } from '@/lib/legacy/memories';

/**
 * Create a memory from a choice
 * Integrates with existing memory system
 */
export function createMemoryFromChoice(
  state: GameState,
  eventId: string,
  choiceId: string,
  memoryText: string
): Memory & { relatedEventId?: string; relatedChoiceId?: string } {
  return {
    id: generateMemoryId(state.generationNumber || 1, 'story'),
    title: 'Life Choice',
    description: memoryText,
    category: 'story',
    generation: state.generationNumber || 1,
    ancestorName: state.userProfile?.name || 'You',
    date: Date.now(),
    unlocked: true,
    tags: [eventId, choiceId],
    // Extended fields for memory context lookup
    relatedEventId: eventId,
    relatedChoiceId: choiceId,
  } as Memory & { relatedEventId?: string; relatedChoiceId?: string };
}

