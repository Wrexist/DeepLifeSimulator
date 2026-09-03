/**
 * NPC Depth System — Makes NPCs feel alive
 *
 * Adds to existing relationships:
 * - Personal goals that NPCs desire
 * - Independent life events (promotions, setbacks, etc.)
 * - Opinion tracking (trust, attraction, respect)
 * - Remembered interactions (memories)
 * - Gift preferences based on personality
 * - Dynamic mood based on recent events
 */

import type { Relationship, NPCGoal, NPCOpinion, NPCMemory, NPCWant, NPCWantId } from '@/contexts/game/types';
import { WEEKS_PER_YEAR } from '@/lib/config/gameConstants';
import { makeWeeklyRoll } from '@/utils/seededRoll';

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
 // Take the first WORD (split on space). Was split('') which returns the first
 // CHARACTER, so no key ever matched and every NPC got the default preferences.
 const key = (personality || '').toLowerCase().split(' ')[0];
 // R3-F7: the fallback used to name `surprise`, a gift with NO call site
 // anywhere — ContactsApp renders exactly two gift buttons, `flowers` and
 // `jewelry`. 33 of the 51 dating profiles use a personality outside
 // PERSONALITY_GIFT_MAP (analytical, thoughtful, tech-savvy, passionate, …),
 // as does the starting Dad ('strict'), so for roughly two thirds of NPCs the
 // only gift they "liked" could not be bought and `getGiftMultiplier` returned
 // exactly 1.0 for both purchasable options — the personality gift system, and
 // its "adored / not their taste" flavour text, was dead for them. The default
 // now names a gift the player can actually give.
 return PERSONALITY_GIFT_MAP[key] || { likes: ['flowers'], dislikes: [] };
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
 memory: Omit<NPCMemory, 'id'>,
 /**
  * Optional deterministic id factory. The seeded weekly tick threads one in
  * (derived from the weekly roll) so reloads / StrictMode double-invoke produce
  * byte-identical memory ids. Live actions (Contacts/Dating) omit it and keep
  * the unique wall-clock + random id so concurrent user actions never collide.
  */
 makeId?: () => string
): NPCMemory[] {
 const newMemory: NPCMemory = {
 ...memory,
 id: makeId ? makeId() : `mem_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
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

/**
 * `incomeChange` is in the same unit as `Relationship.income`, which is an
 * ANNUAL salary (the 52 `DATING_PROFILES` rows it is copied from are annual
 * figures, and `householdPartnerIncome` divides by `WEEKS_PER_YEAR` to spend
 * it). These deltas were authored as +200 / +100 / -500 against a field whose
 * unit was ambiguous, which made "{name} got a promotion at work!" a raise of
 * $200 a YEAR. Rescaled so the number matches the sentence: a promotion is
 * +6,000, a bonus +2,500, and losing the job costs 20,000 of annual income —
 * which is a quarter-share of about $96 a week off the household, rather than
 * the $2.40 it was.
 */
const NPC_LIFE_EVENTS: NPCLifeEvent[] = [
 // Positive events
 {
 id: 'got_promotion',
 description: '{name} got a promotion at work!',
 effects: { mood: 'happy', incomeChange: 6000, relationshipScoreChange: 2 },
 weight: 8,
 },
 {
 id: 'bonus_at_work',
 description: '{name} received a bonus at work.',
 effects: { mood: 'happy', incomeChange: 2500 },
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
 effects: { mood: 'sad', incomeChange: -20000, jobChange: 'Unemployed', relationshipScoreChange: -3 },
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
export function rollNPCLifeEvent(
 relationship: Relationship,
 // Optional seeded roll (key → [0,1)). Passed from the weekly tick so the
 // background life event is deterministic / resume-safe (not save-scummable);
 // falls back to Math.random so existing callers + tests keep working.
 rng?: (key: string) => number,
): NPCLifeEvent | null {
 // 15% chance per NPC per week
 if ((rng ? rng('npc-life-gate') : Math.random()) > 0.15) return null;

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
 let roll = (rng ? rng('npc-life-pick') : Math.random()) * totalWeight;
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
 /** Deterministic memory-id factory threaded from the seeded weekly tick. */
 makeMemoryId?: () => string,
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
 },
 makeMemoryId,
 );

 return updated;
}

// ─── NPC Mood Decay ──────────────────────────────────────────────────────

/**
 * Mood naturally returns to neutral over time.
 * Call weekly - mood shifts toward 'neutral' after ~3 weeks.
 */
export function decayMood(currentMood: Relationship['npcMood'], roll?: number): Relationship['npcMood'] {
 if (!currentMood || currentMood === 'neutral') return 'neutral';
 // 33% chance per week to shift back to neutral. Optional seeded roll makes
 // this deterministic/resume-safe in the tick; falls back to Math.random.
 if ((typeof roll === 'number' ? roll : Math.random()) < 0.33) return 'neutral';
 return currentMood;
}

// ─── Mood ladder (deterministic transitions) ──────────────────────────────
// Ordered worst → best. `sourMood` / `brightenMood` step one rung and clamp at
// the ends, so mood only ever drifts one notch per event and can never fall off
// the ladder.
const MOOD_LADDER: NonNullable<Relationship['npcMood']>[] = [
 'angry', 'sad', 'stressed', 'neutral', 'happy',
];

export function brightenMood(mood: Relationship['npcMood']): NonNullable<Relationship['npcMood']> {
 const i = MOOD_LADDER.indexOf(mood ?? 'neutral');
 const idx = i < 0 ? MOOD_LADDER.indexOf('neutral') : i;
 return MOOD_LADDER[Math.min(MOOD_LADDER.length - 1, idx + 1)];
}

export function sourMood(mood: Relationship['npcMood']): NonNullable<Relationship['npcMood']> {
 const i = MOOD_LADDER.indexOf(mood ?? 'neutral');
 const idx = i < 0 ? MOOD_LADDER.indexOf('neutral') : i;
 return MOOD_LADDER[Math.max(0, idx - 1)];
}

/**
 * Deterministic weekly mood drift from CONTEXT (relationship score + neglect),
 * layered on top of the episodic life-event mood + `decayMood`. Neglect or a low
 * bond sours the mood a notch; an actively-tended, high-bond NPC brightens. The
 * `roll` is a seeded [0,1) (same week + same NPC → same drift) so a reload can't
 * be used to re-roll a mood.
 */
export const NEGLECT_MOOD_WEEKS = 6;

export function driftMoodFromContext(
 rel: Relationship,
 weeksLived: number,
 roll: number,
): Relationship['npcMood'] {
 const mood = rel.npcMood ?? 'neutral';
 const score = rel.relationshipScore ?? 0;
 const since = rel.lastInteractionWeek;
 const neglect = typeof since === 'number' ? Math.max(0, weeksLived - since) : 0;
 const neglected = neglect >= NEGLECT_MOOD_WEEKS;
 const tended = typeof since === 'number' && neglect <= 1;
 // Souring: neglect or a weak bond pulls the mood down ~40% of weeks.
 if ((neglected || score < 30) && roll < 0.4) return sourMood(mood);
 // Brightening: a well-tended, strong bond lifts the mood ~30% of weeks.
 if (tended && score >= 65 && roll >= 0.7) return brightenMood(mood);
 return mood;
}

// ─── NPC Wants (rotating, satisfiable short-term desires) ──────────────────

/** How many weeks a want stays current before it rotates. */
export const WANT_ROTATION_WEEKS = 4;

interface WantTemplate {
 label: string;
 /** Interaction action ids that satisfy this want. Empty = satisfied by leaving them alone. */
 satisfiedBy: string[];
 /** Relationship types this want can be assigned to. */
 types: Relationship['type'][];
}

const ALL_TYPES: Relationship['type'][] = ['parent', 'friend', 'partner', 'spouse', 'child'];

const WANT_TEMPLATES: Record<NPCWantId, WantTemplate> = {
 hear_from_you: { label: 'Wishes you would call more', satisfiedBy: ['call'], types: ALL_TYPES },
 quality_time: { label: 'Wants to spend time together', satisfiedBy: ['hangout', 'date'], types: ALL_TYPES },
 deep_talk: { label: 'Hoping for a real heart-to-heart', satisfiedBy: ['hangout', 'date'], types: ALL_TYPES },
 a_gift: { label: 'Would love a little gift', satisfiedBy: ['gift'], types: ['partner', 'spouse'] },
 meet_friends: { label: 'Wants to meet your friends', satisfiedBy: ['hangout', 'date'], types: ['partner', 'spouse', 'friend'] },
 space: { label: 'Could use a little space right now', satisfiedBy: [], types: ALL_TYPES },
};

/** Short phrase used inside memories/copy, e.g. "to spend time". */
const WANT_SHORT: Record<NPCWantId, string> = {
 hear_from_you: 'to hear from you',
 quality_time: 'to spend time together',
 deep_talk: 'a real conversation',
 a_gift: 'a little gift',
 meet_friends: 'to meet your friends',
 space: 'some space',
};

function wantPoolFor(type: Relationship['type']): NPCWantId[] {
 const ids = (Object.keys(WANT_TEMPLATES) as NPCWantId[]).filter(id => WANT_TEMPLATES[id].types.includes(type));
 return ids.length > 0 ? ids : ['quality_time'];
}

function cycleOf(weeksLived: number): number {
 return Math.floor(weeksLived / WANT_ROTATION_WEEKS);
}

/** Deterministically choose a want for (npc, cycle) - stable across reloads. */
export function pickWant(relId: string, cycle: number, type: Relationship['type']): NPCWantId {
 const pool = wantPoolFor(type);
 const roll = makeWeeklyRoll(cycle)(`want:${relId}`);
 return pool[Math.min(pool.length - 1, Math.floor(roll * pool.length))];
}

function makeWant(id: NPCWantId, weeksLived: number): NPCWant {
 return { id, label: WANT_TEMPLATES[id].label, since: weeksLived, satisfiedCount: 0 };
}

export function wantSatisfiedBy(want: NPCWant | undefined, action: string): boolean {
 if (!want) return false;
 return (WANT_TEMPLATES[want.id]?.satisfiedBy ?? []).includes(action);
}

/** Diminishing per-cycle reward for satisfying a want: 4, 2, 1, then 0. */
export function wantBonus(satisfiedCount: number): number {
 if (satisfiedCount <= 0) return 4;
 if (satisfiedCount === 1) return 2;
 if (satisfiedCount === 2) return 1;
 return 0;
}

/**
 * Apply a satisfying interaction to a want. Returns the (possibly) advanced want,
 * the bonus to add to the relationship-score delta, and whether it counted as a
 * meaningful satisfy (bonus > 0). Repeated satisfies in the same cycle diminish.
 */
export function applyWantProgress(
 want: NPCWant | undefined,
 action: string,
 _weeksLived: number,
): { want: NPCWant | undefined; bonus: number; satisfied: boolean } {
 if (!want || !wantSatisfiedBy(want, action)) return { want, bonus: 0, satisfied: false };
 const bonus = wantBonus(want.satisfiedCount);
 return {
 want: { ...want, satisfiedCount: want.satisfiedCount + 1 },
 bonus,
 satisfied: bonus > 0,
 };
}

/**
 * Initialise (first tick) or rotate (every WANT_ROTATION_WEEKS) an NPC's want.
 * On rotation of a "needy" want that was left entirely unmet AND ignored, applies
 * a small cost (sour mood, −2 bond, a negative memory + a notification). When a
 * "space" want is honoured (no interaction during its cycle) applies a small
 * reward. Deterministic - no Math.random.
 */
export function rotateWantIfDue(
 rel: Relationship,
 weeksLived: number,
 /** Deterministic memory-id factory threaded from the seeded weekly tick. */
 makeMemoryId?: () => string,
): { rel: Relationship; notification?: string } {
 const want = rel.npcWant;
 // First encounter - assign a want, no cost.
 if (!want) {
 return { rel: { ...rel, npcWant: makeWant(pickWant(rel.id, cycleOf(weeksLived), rel.type), weeksLived) } };
 }
 const age = weeksLived - want.since;
 if (age < WANT_ROTATION_WEEKS) return { rel };

 const interactedDuringCycle =
 typeof rel.lastInteractionWeek === 'number' && rel.lastInteractionWeek >= want.since;
 let next: Relationship = { ...rel };
 let notification: string | undefined;

 if (want.id === 'space') {
 // Honoured their space (left alone the whole cycle) → small reward.
 if (!interactedDuringCycle) {
 next.npcMood = brightenMood(next.npcMood);
 next.relationshipScore = clamp((next.relationshipScore ?? 0) + 1);
 next.npcMemories = addMemory(next.npcMemories ?? [], {
 type: 'kindness',
 description: `You gave ${rel.name} space when they needed it`,
 weeksLived,
 sentiment: 'positive',
 }, makeMemoryId);
 }
 } else if (want.satisfiedCount <= 0 && !interactedDuringCycle) {
 // A needy want, left entirely unmet AND ignored → a small, remembered slight.
 next.npcMood = sourMood(next.npcMood);
 next.relationshipScore = clamp((next.relationshipScore ?? 0) - 2);
 next.npcMemories = addMemory(next.npcMemories ?? [], {
 type: 'conflict',
 description: `You never made time when ${rel.name} wanted ${WANT_SHORT[want.id]}`,
 weeksLived,
 sentiment: 'negative',
 }, makeMemoryId);
 notification = `${rel.name} felt a little neglected lately.`;
 }

 // Assign the next cycle's want.
 next.npcWant = makeWant(pickWant(rel.id, cycleOf(weeksLived), rel.type), weeksLived);
 return { rel: next, notification };
}

// ─── Memory age-decay ─────────────────────────────────────────────────────

/** weeks a memory stays before it fades (in addition to the MAX_MEMORIES cap). */
export const MEMORY_TTL_WEEKS = 52;

/**
 * Drop memories older than `ttl` weeks, but always keep at least `keepMin` most
 * recent so an NPC is never left blank. Bounded: never grows the list.
 */
export function decayMemories(
 memories: NPCMemory[] | undefined,
 weeksLived: number,
 ttl: number = MEMORY_TTL_WEEKS,
 keepMin = 3,
): NPCMemory[] {
 const list = memories ?? [];
 if (list.length <= keepMin) return list;
 const recent = list.filter(m => weeksLived - m.weeksLived <= ttl);
 if (recent.length >= keepMin) return recent;
 return list.slice(list.length - keepMin);
}

// ─── Varied interaction resolution ────────────────────────────────────────

export interface InteractionOutcome {
 /** Relationship-score delta to apply (always ≥ 1 for these friendly actions). */
 scoreDelta: number;
 /** Mood after the interaction (may brighten when a want is satisfied). */
 npcMood: Relationship['npcMood'];
 /** Updated want if this interaction advanced it (else undefined → leave as-is). */
 npcWant?: NPCWant;
 /** A memory to record, if the interaction was notable. */
 memory?: Omit<NPCMemory, 'id'>;
 /** Player-facing result line. */
 message: string;
 /** Whether the interaction satisfied the NPC's current want. */
 wantSatisfied: boolean;
 tone: 'warm' | 'neutral' | 'cool';
}

const ACTION_LABEL: Record<string, string> = {
 call: 'called',
 hangout: 'spent time with them',
 date: 'took them out',
 gift: 'gave them a gift',
};

function pickFrom(arr: string[], roll: number): string {
 return arr[Math.min(arr.length - 1, Math.floor(roll * arr.length))];
}

/**
 * Resolve a lightweight relationship interaction (Call / Hang Out / …) into a
 * VARIED outcome: the score delta and the copy both shift with the NPC's mood,
 * their memory of you, and whether the action satisfies their current want.
 *
 * Deterministic: the flavour roll is seeded on (weeksLived, npc id, action), so
 * reloading and re-tapping yields the SAME result (no save-scum). With no depth
 * fields present (fresh contact / old save) the delta collapses to exactly
 * `baseBonus`, preserving the legacy flat-bonus behaviour.
 */
export function resolveInteraction(
 rel: Relationship,
 action: string,
 baseBonus: number,
 weeksLived: number,
): InteractionOutcome {
 const roll = makeWeeklyRoll(weeksLived)(`interact:${rel.id}:${action}`);
 const mood = rel.npcMood ?? 'neutral';
 const want = rel.npcWant;
 const name = rel.name;

 let delta = baseBonus;
 let tone: InteractionOutcome['tone'] = 'neutral';
 let wantSatisfied = false;
 let updatedWant: NPCWant | undefined;
 let memory: Omit<NPCMemory, 'id'> | undefined;
 let nextMood: Relationship['npcMood'] = mood;
 let message: string;

 // Recent emotional colour from memory (last ~8 weeks).
 const mems = rel.npcMemories ?? [];
 const recentNeg = mems.some(m => m.sentiment === 'negative' && weeksLived - m.weeksLived <= 8);
 const recentPos = mems.some(m => m.sentiment === 'positive' && weeksLived - m.weeksLived <= 8);

 if (want && wantSatisfiedBy(want, action)) {
 // Reading the room: this action is exactly what they wanted.
 const prog = applyWantProgress(want, action, weeksLived);
 updatedWant = prog.want;
 if (prog.satisfied) {
 wantSatisfied = true;
 delta += prog.bonus;
 tone = 'warm';
 nextMood = brightenMood(mood);
 memory = {
 type: 'kindness',
 description: `You ${ACTION_LABEL[action] ?? 'reached out'} when ${name} wanted ${WANT_SHORT[want.id]}`,
 weeksLived,
 sentiment: 'positive',
 };
 message = pickFrom([
 `${name} lit up - exactly what they needed right now.`,
 `You read ${name} perfectly. They loved it.`,
 `${name} felt truly seen. That meant a lot.`,
 ], roll);
 } else {
 // Want already indulged this cycle - still nice, but diminishing.
 tone = 'neutral';
 message = pickFrom([
 `${name} enjoyed it, though you've done this a lot lately.`,
 `Nice, but ${name} is a little spoiled for it this week.`,
 ], roll);
 }
 } else if (want && want.id === 'space' && (action === 'call' || action === 'hangout')) {
 // They wanted space; showing up is unwelcome - reduced, cool.
 delta = Math.max(1, Math.round(baseBonus * 0.5));
 tone = 'cool';
 message = pickFrom([
 `${name} clearly wanted some space. It was a little awkward.`,
 `${name} kept it short - they need room right now.`,
 ], roll);
 } else {
 // General interaction - colour by mood + memory.
 let moodMod = 0;
 if (mood === 'happy') { moodMod = 1; tone = 'warm'; }
 else if (mood === 'sad' || mood === 'angry') { moodMod = -1; tone = 'cool'; }
 else if (mood === 'stressed') { moodMod = 0; tone = recentNeg ? 'cool' : 'neutral'; }
 else { tone = recentPos ? 'warm' : recentNeg ? 'cool' : 'neutral'; }

 let memMod = 0;
 if (recentNeg && !recentPos) { memMod = -1; if (tone === 'warm') tone = 'neutral'; else tone = 'cool'; }

 delta = baseBonus + moodMod + memMod;

 if (tone === 'warm') {
 message = pickFrom([
 `${name} was in great spirits and glad you reached out.`,
 `${name} beamed the whole time.`,
 ], roll);
 } else if (tone === 'cool') {
 message = pickFrom([
 `${name} was distant and kept it short.`,
 `${name} seemed preoccupied and a little cold.`,
 recentNeg ? `${name} still hasn't quite forgotten the last time.` : `${name} wasn't very talkative.`,
 ], roll);
 } else {
 message = pickFrom([
 `A good, easy catch-up with ${name}.`,
 `${name} appreciated you thinking of them.`,
 ], roll);
 }
 }

 delta = Math.max(1, Math.round(delta));
 return {
 scoreDelta: delta,
 npcMood: nextMood,
 npcWant: updatedWant,
 memory,
 message: `${message} (+${delta})`,
 wantSatisfied,
 tone,
 };
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

 // Deterministic per-week roll stream (seeded on weeksLived) - the mood drift
 // + want rotation below are reproducible across reloads (no save-scum).
 const weeklyRoll = makeWeeklyRoll(weeksLived);

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

 // Roll for life events - seeded per NPC so it's deterministic/resume-safe.
 const event = rollNPCLifeEvent(r, (k) => weeklyRoll(`${k}:${r.id}`));
 if (event) {
 // Deterministic memory id from the weekly roll so reloads / StrictMode
 // double-invoke stay byte-identical (was Date.now()/Math.random()).
 const lifeEventMemId = `mem_${weeksLived}_${r.id}_${event.id}`;
 r = applyNPCLifeEvent(r, event, weeksLived, () => lifeEventMemId);
 notifications.push(event.description.replace('{name}', r.name));
 }

 // Decay mood toward neutral (episodic), then apply deterministic CONTEXT
 // drift (neglect / bond strength) so mood also tracks how you treat them.
 r.npcMood = decayMood(r.npcMood, weeklyRoll(`mood-decay:${r.id}`));
 r.npcMood = driftMoodFromContext(r, weeksLived, weeklyRoll(`mood-drift:${r.id}`));

 // Age NPCs if they have age - but NEVER children: applyChildAging already
 // advances every child +1/52 each week (continuous). Aging them here too (a
 // full +1 at each year boundary) double-aged kids, reaching adulthood/heir
 // eligibility in ~9 years instead of 18.
 if (r.type !== 'child' && r.age && weeksLived % WEEKS_PER_YEAR === 0) {
 r.age = r.age + 1;
 }

 // Opinion passive decay - if no interaction this week, trust slowly declines
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
 notifications.push(`${r.name} is thrilled - their dream of getting married came true!`);
 return { ...goal, fulfilled: true, fulfilledWeek: weeksLived };
 }
 return goal;
 });
 }

 // Rotate the current WANT (init on first encounter; every WANT_ROTATION_WEEKS
 // after). A needy want left unmet AND ignored costs a little bond + a memory;
 // honouring a "space" want is quietly rewarded.
 const wantResult = rotateWantIfDue(r, weeksLived, () => `mem_${weeksLived}_${r.id}_want`);
 r = wantResult.rel;
 if (wantResult.notification) notifications.push(wantResult.notification);

 // Age-decay memories (bounded - never grows; keeps at least the most recent few).
 r.npcMemories = decayMemories(r.npcMemories, weeksLived);

 return r;
 });

 return { relationships: updated, notifications };
}

// ─── Mood Emoji Helper ───────────────────────────────────────────────────

export function getMoodEmoji(mood: Relationship['npcMood']): string {
 switch (mood) {
 case 'happy': return '😊';
 case 'stressed': return '😰';
 case 'sad': return '😔';
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
