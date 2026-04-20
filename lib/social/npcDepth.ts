/**
 * NPC Depth System — Makes NPCs feel alive
 *
 * Adds to existing relationships:
 *  - Personal goals that NPCs desire
 *  - Independent life events (promotions, setbacks, etc.)
 *  - Opinion tracking (trust, attraction, respect)
 *  - Remembered interactions (memories)
 *  - Gift preferences based on personality
 *  - Dynamic mood based on recent events
 */

import type { Relationship, NPCGoal, NPCOpinion, NPCMemory } from '@/contexts/game/types';
import { WEEKS_PER_YEAR } from '@/lib/config/gameConstants';

// ─── Personality → Gift Preferences Mapping ──────────────────────────────

const PERSONALITY_GIFT_MAP: Record<string, { likes: string[]; dislikes: string[] }> = {
  adventurous: { likes: ['trip', 'surprise'], dislikes: ['flowers'] },
  romantic: { likes: ['flowers', 'jewelry'], dislikes: [] },
  ambitious: { likes: ['luxury', 'jewelry'], dislikes: ['flowers'] },
  creative: { likes: ['surprise', 'flowers'], dislikes: ['jewelry'] },
  intellectual: { likes: ['surprise', 'trip'], dislikes: ['jewelry'] },
  caring: { likes: ['flowers', 'surprise'], dislikes: ['luxury'] },
  social: { likes: ['trip', 'flowers'], dislikes: [] },
  reserved: { likes: ['surprise', 'jewelry'], dislikes: ['trip'] },
  sporty: { likes: ['trip', 'surprise'], dislikes: ['jewelry'] },
  practical: { likes: ['luxury', 'surprise'], dislikes: ['flowers'] },
};

/**
 * Get gift preferences based on NPC personality.
 * Returns default middle-ground if personality unknown.
 */
export function getGiftPreferences(personality: string): { likes: string[]; dislikes: string[] } {
  const key = personality.toLowerCase().split(' ')[0]; // Take first word
  return PERSONALITY_GIFT_MAP[key] || { likes: ['surprise'], dislikes: [] };
}

/**
 * Check if an NPC enjoys a specific gift type.
 * Returns a multiplier: 1.5 for liked, 0.5 for disliked, 1.0 for neutral.
 */
export function getGiftMultiplier(relationship: Relationship, giftType: string): number {
  const likes = relationship.giftPreferences || getGiftPreferences(relationship.personality).likes;
  const dislikes = relationship.giftDislikes || getGiftPreferences(relationship.personality).dislikes;
  if (likes.includes(giftType)) return 1.5;
  if (dislikes.includes(giftType)) return 0.5;
  return 1.0;
}

// ─── NPC Goals ───────────────────────────────────────────────────────────

const GOAL_TEMPLATES: Omit<NPCGoal, 'fulfilled' | 'fulfilledWeek'>[] = [
  // Family goals
  { id: 'want_kids', label: 'Wants to have children', category: 'family' },
  { id: 'want_marriage', label: 'Dreams of getting married', category: 'family' },
  { id: 'family_dinner', label: 'Wants regular family time', category: 'family' },
  // Career goals
  { id: 'career_promotion', label: 'Wants a promotion at work', category: 'career' },
  { id: 'start_business', label: 'Dreams of starting a business', category: 'career' },
  { id: 'career_change', label: 'Considering a career change', category: 'career' },
  // Travel goals
  { id: 'travel_europe', label: 'Wants to travel to Europe', category: 'travel' },
  { id: 'travel_asia', label: 'Dreams of visiting Asia', category: 'travel' },
  { id: 'road_trip', label: 'Wants a road trip adventure', category: 'travel' },
  // Lifestyle goals
  { id: 'buy_house', label: 'Wants to buy a house', category: 'lifestyle' },
  { id: 'get_fit', label: 'Trying to get in shape', category: 'lifestyle' },
  { id: 'learn_hobby', label: 'Wants to pick up a new hobby', category: 'lifestyle' },
  // Relationship goals
  { id: 'more_dates', label: 'Wants more quality time together', category: 'relationship' },
  { id: 'meet_friends', label: 'Wants to meet your friends', category: 'relationship' },
  { id: 'deeper_connection', label: 'Craves a deeper emotional bond', category: 'relationship' },
];

/**
 * Generate 2-3 personal goals for a new NPC based on their type and personality.
 */
export function generateNPCGoals(type: Relationship['type'], _personality: string): NPCGoal[] {
  const pool = GOAL_TEMPLATES.filter(g => {
    // Children don't have career/travel/relationship goals
    if (type === 'child') return g.category === 'family' || g.category === 'lifestyle';
    // Friends don't have family goals as much
    if (type === 'friend') return g.category !== 'family' || g.id === 'family_dinner';
    return true;
  });

  const shuffled = pool.sort(() => Math.random() - 0.5);
  const count = 2 + (Math.random() < 0.5 ? 1 : 0); // 2-3 goals
  return shuffled.slice(0, count).map(g => ({ ...g, fulfilled: false }));
}

// ─── NPC Opinion System ──────────────────────────────────────────────────

/**
 * Create initial opinion scores based on relationship context.
 */
export function createInitialOpinion(type: Relationship['type'], relationshipScore: number): NPCOpinion {
  const base = Math.min(100, Math.max(0, relationshipScore));
  switch (type) {
    case 'spouse':
      return { trust: Math.min(100, base + 20), attraction: Math.min(100, base + 10), respect: base };
    case 'partner':
      return { trust: Math.round(base * 0.6), attraction: Math.round(base * 0.8), respect: Math.round(base * 0.5) };
    case 'friend':
      return { trust: Math.round(base * 0.7), attraction: 0, respect: Math.round(base * 0.6) };
    case 'child':
      return { trust: Math.min(100, base + 30), attraction: 0, respect: Math.round(base * 0.4) };
    case 'parent':
      return { trust: Math.round(base * 0.8), attraction: 0, respect: Math.min(100, base + 20) };
    default:
      return { trust: 30, attraction: 20, respect: 30 };
  }
}

/**
 * Update NPC opinion after an interaction.
 */
export function updateOpinion(
  opinion: NPCOpinion,
  event: 'date' | 'gift_liked' | 'gift_disliked' | 'helped' | 'ignored' | 'lied' | 'achieved' | 'married' | 'had_child'
): NPCOpinion {
  const changes: Record<string, Partial<NPCOpinion>> = {
    date: { trust: 2, attraction: 3, respect: 1 },
    gift_liked: { trust: 1, attraction: 4, respect: 1 },
    gift_disliked: { attraction: -2 },
    helped: { trust: 5, respect: 3 },
    ignored: { trust: -3, attraction: -2, respect: -1 },
    lied: { trust: -8, respect: -5 },
    achieved: { respect: 5, attraction: 2 },
    married: { trust: 10, attraction: 5, respect: 5 },
    had_child: { trust: 8, respect: 3 },
  };

  const delta = changes[event] || {};
  return {
    trust: clamp(opinion.trust + (delta.trust || 0)),
    attraction: clamp(opinion.attraction + (delta.attraction || 0)),
    respect: clamp(opinion.respect + (delta.respect || 0)),
  };
}

function clamp(v: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, v));
}

// ─── NPC Memories ────────────────────────────────────────────────────────

const MAX_MEMORIES = 20;

/**
 * Add a memory to an NPC. Keeps the most recent MAX_MEMORIES.
 */
export function addMemory(
  existing: NPCMemory[],
  memory: Omit<NPCMemory, 'id'>
): NPCMemory[] {
  const newMemory: NPCMemory = {
    ...memory,
    id: `mem_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
  };
  const updated = [...existing, newMemory];
  // Keep only most recent
  if (updated.length > MAX_MEMORIES) {
    return updated.slice(updated.length - MAX_MEMORIES);
  }
  return updated;
}

// ─── NPC Life Events (Weekly Processing) ─────────────────────────────────

export interface NPCLifeEvent {
  id: string;
  description: string;
  effects: {
    mood?: Relationship['npcMood'];
    incomeChange?: number;
    jobChange?: string;
    relationshipScoreChange?: number;
  };
  weight: number; // Probability weight
}

const NPC_LIFE_EVENTS: NPCLifeEvent[] = [
  // Positive events
  {
    id: 'got_promotion',
    description: '{name} got a promotion at work!',
    effects: { mood: 'happy', incomeChange: 200, relationshipScoreChange: 2 },
    weight: 8,
  },
  {
    id: 'bonus_at_work',
    description: '{name} received a bonus at work.',
    effects: { mood: 'happy', incomeChange: 100 },
    weight: 10,
  },
  {
    id: 'new_hobby',
    description: '{name} picked up a new hobby and seems happier.',
    effects: { mood: 'happy', relationshipScoreChange: 1 },
    weight: 12,
  },
  {
    id: 'reunited_friend',
    description: '{name} reconnected with an old friend.',
    effects: { mood: 'happy' },
    weight: 10,
  },
  // Neutral events
  {
    id: 'changed_hairstyle',
    description: '{name} got a new hairstyle.',
    effects: { mood: 'neutral' },
    weight: 15,
  },
  {
    id: 'started_diet',
    description: '{name} started a new diet.',
    effects: { mood: 'neutral' },
    weight: 8,
  },
  {
    id: 'binge_show',
    description: '{name} is obsessed with a new TV show.',
    effects: { mood: 'happy' },
    weight: 12,
  },
  // Negative events
  {
    id: 'got_sick',
    description: '{name} caught a cold and is feeling under the weather.',
    effects: { mood: 'sad', relationshipScoreChange: -1 },
    weight: 10,
  },
  {
    id: 'work_stress',
    description: '{name} has been stressed about work lately.',
    effects: { mood: 'stressed', relationshipScoreChange: -2 },
    weight: 12,
  },
  {
    id: 'lost_job',
    description: '{name} lost their job unexpectedly.',
    effects: { mood: 'sad', incomeChange: -500, jobChange: 'Unemployed', relationshipScoreChange: -3 },
    weight: 3,
  },
  {
    id: 'argument_friend',
    description: '{name} had a falling out with a friend.',
    effects: { mood: 'angry', relationshipScoreChange: -1 },
    weight: 6,
  },
  {
    id: 'car_trouble',
    description: '{name} is dealing with car trouble.',
    effects: { mood: 'stressed' },
    weight: 8,
  },
  {
    id: 'feeling_lonely',
    description: '{name} has been feeling a bit lonely.',
    effects: { mood: 'sad', relationshipScoreChange: -2 },
    weight: 5,
  },
];

/**
 * Roll a random NPC life event. Only triggers ~15% of weeks.
 * Returns null if no event occurs.
 */
export function rollNPCLifeEvent(relationship: Relationship): NPCLifeEvent | null {
  // 15% chance per NPC per week
  if (Math.random() > 0.15) return null;

  // Don't fire events for children under age 16
  if (relationship.type === 'child' && relationship.age < 16) return null;

  // Filter applicable events
  const applicableEvents = NPC_LIFE_EVENTS.filter(e => {
    // Children can't lose jobs or get promotions
    if (relationship.type === 'child' && (e.id === 'lost_job' || e.id === 'got_promotion' || e.id === 'bonus_at_work')) {
      return false;
    }
    return true;
  });

  // Weighted random selection
  const totalWeight = applicableEvents.reduce((sum, e) => sum + e.weight, 0);
  let roll = Math.random() * totalWeight;
  for (const event of applicableEvents) {
    roll -= event.weight;
    if (roll <= 0) return event;
  }
  return applicableEvents[applicableEvents.length - 1];
}

/**
 * Apply an NPC life event to a relationship, returning the updated relationship.
 */
export function applyNPCLifeEvent(
  relationship: Relationship,
  event: NPCLifeEvent,
  weeksLived: number,
): Relationship {
  const updated = { ...relationship };
  const effects = event.effects;

  if (effects.mood) {
    updated.npcMood = effects.mood;
  }
  if (effects.incomeChange) {
    updated.income = Math.max(0, (updated.income || 0) + effects.incomeChange);
  }
  if (effects.jobChange) {
    updated.job = effects.jobChange;
  }
  if (effects.relationshipScoreChange) {
    updated.relationshipScore = clamp(
      updated.relationshipScore + effects.relationshipScoreChange
    );
  }

  // Record event
  updated.lastLifeEvent = {
    event: event.description.replace('{name}', relationship.name),
    weeksLived,
  };

  // Add to memories
  updated.npcMemories = addMemory(
    updated.npcMemories || [],
    {
      type: 'life_event',
      description: event.description.replace('{name}', relationship.name),
      weeksLived,
      sentiment: effects.mood === 'happy' ? 'positive' : effects.mood === 'sad' || effects.mood === 'angry' ? 'negative' : 'neutral',
    }
  );

  return updated;
}

// ─── NPC Mood Decay ──────────────────────────────────────────────────────

/**
 * Mood naturally returns to neutral over time.
 * Call weekly — mood shifts toward 'neutral' after ~3 weeks.
 */
export function decayMood(currentMood: Relationship['npcMood']): Relationship['npcMood'] {
  if (!currentMood || currentMood === 'neutral') return 'neutral';
  // 33% chance per week to shift back to neutral
  if (Math.random() < 0.33) return 'neutral';
  return currentMood;
}

// ─── Weekly NPC Processing ───────────────────────────────────────────────

/**
 * Process all NPC relationship updates for one week.
 * Returns updated relationships array and notifications.
 */
export function processWeeklyNPCDepth(
  relationships: Relationship[],
  weeksLived: number,
): { relationships: Relationship[]; notifications: string[] } {
  const notifications: string[] = [];

  const updated = relationships.map(rel => {
    let r = { ...rel };

    // Initialize depth fields on first encounter
    if (!r.npcGoals) {
      r.npcGoals = generateNPCGoals(r.type, r.personality);
    }
    if (!r.npcOpinion) {
      r.npcOpinion = createInitialOpinion(r.type, r.relationshipScore);
    }
    if (!r.giftPreferences) {
      const prefs = getGiftPreferences(r.personality);
      r.giftPreferences = prefs.likes;
      r.giftDislikes = prefs.dislikes;
    }
    if (!r.npcMood) {
      r.npcMood = 'neutral';
    }
    if (!r.npcMemories) {
      r.npcMemories = [];
    }

    // Roll for life events
    const event = rollNPCLifeEvent(r);
    if (event) {
      r = applyNPCLifeEvent(r, event, weeksLived);
      notifications.push(event.description.replace('{name}', r.name));
    }

    // Decay mood toward neutral
    r.npcMood = decayMood(r.npcMood);

    // Age NPCs if they have age
    if (r.age && weeksLived % WEEKS_PER_YEAR === 0) {
      r.age = r.age + 1;
    }

    // Opinion passive decay — if no interaction this week, trust slowly declines
    if (r.npcOpinion && r.lastInteractionWeek !== weeksLived) {
      r.npcOpinion = {
        ...r.npcOpinion,
        trust: clamp(r.npcOpinion.trust - 0.5),
        attraction: clamp(r.npcOpinion.attraction - 0.3),
        // respect doesn't decay
      };
    }

    // Check goal fulfillment for spouses/partners
    if (r.npcGoals && (r.type === 'spouse' || r.type === 'partner')) {
      r.npcGoals = r.npcGoals.map(goal => {
        if (goal.fulfilled) return goal;
        // Auto-fulfill marriage goal when married
        if (goal.id === 'want_marriage' && r.type === 'spouse') {
          notifications.push(`${r.name} is thrilled — their dream of getting married came true!`);
          return { ...goal, fulfilled: true, fulfilledWeek: weeksLived };
        }
        return goal;
      });
    }

    return r;
  });

  return { relationships: updated, notifications };
}

// ─── Mood Emoji Helper ───────────────────────────────────────────────────

export function getMoodEmoji(mood: Relationship['npcMood']): string {
  switch (mood) {
    case 'happy': return '😊';
    case 'stressed': return '😰';
    case 'sad': return '😢';
    case 'angry': return '😠';
    case 'neutral':
    default: return '😐';
  }
}

export function getMoodLabel(mood: Relationship['npcMood']): string {
  switch (mood) {
    case 'happy': return 'Happy';
    case 'stressed': return 'Stressed';
    case 'sad': return 'Sad';
    case 'angry': return 'Angry';
    case 'neutral':
    default: return 'Neutral';
  }
}
