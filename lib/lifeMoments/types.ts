import type { GameStats } from '@/contexts/game/types';

/**
 * Hidden consequence from a player choice
 * These activate immediately or after a delay to affect future gameplay
 */
export interface HiddenConsequence {
  id: string;
  eventId: string; // Event that triggered it
  choiceId: string; // Choice that created it
  type: 'unlock_event' | 'lock_event' | 'modify_weight' | 'add_trait' | 'relationship_flag';
  targetEventId?: string; // Event to unlock/lock/modify
  weightModifier?: number; // How much to change event weight (-1 to 1, additive)
  traitId?: string; // Trait to add
  relationshipFlag?: string; // Flag for relationships
  relationshipId?: string; // Specific relationship if applicable
  weeksUntilActive?: number; // When this consequence activates (0 = immediate)
  active: boolean;
  weeksSinceCreated: number;
  description?: string; // Shown when consequence activates (for notifications)
  createdAt: number; // Timestamp
}

/**
 * History of player choices for memory context
 */
export interface ChoiceHistory {
  eventId: string;
  choiceId: string;
  week: number;
  weeksLived: number;
  age: number;
  timestamp: number;
  eventCategory?: 'regular' | 'seasonal' | 'economic' | 'personal_crisis'; // From existing event log
}

/**
 * Complete consequence state tracking
 */
export interface ConsequenceState {
  consequences: HiddenConsequence[];
  choiceHistory: ChoiceHistory[];
  unlockedEvents: string[]; // Event IDs that are unlocked (can appear)
  lockedEvents: string[]; // Event IDs that are locked (cannot appear)
  relationshipFlags: Record<string, string[]>; // relationshipId -> flags[]
  hiddenTraits: string[]; // Hidden traits from choices (affects gameplay)
  eventWeightModifiers: Record<string, number>; // eventId -> weight modifier (additive)
}

/**
 * Quick life moment decision (30-60 seconds)
 */
export interface LifeMoment {
  id: string;
  situation: string;
  choices: LifeMomentChoice[];
  category: 'social' | 'work' | 'health' | 'money' | 'random';
  timeLimit?: number; // Seconds (optional, for urgency)
  createdAt: number;
}

/**
 * Choice in a life moment
 */
export interface LifeMomentChoice {
  id: string;
  text: string;
  quickEffect: Array<{ stat: keyof GameStats | 'money'; amount: number; label: string }>;
  hiddenEffect?: string; // Description shown later when consequence activates
  hiddenConsequences?: Array<Omit<HiddenConsequence, 'id' | 'eventId' | 'choiceId' | 'active' | 'weeksSinceCreated' | 'createdAt'>>;
}

