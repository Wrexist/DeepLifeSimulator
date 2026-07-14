/**
 * Hobby Mastery (v21) — a self-contained weekly loop that refills the gap left
 * when the old hobbies were removed. Pick a pursuit, practice it each week
 * (costs energy, capped per week), earn XP, level up, and get a compounding
 * immediate reward plus a named perk. No weekly-tick surgery: the payoff is
 * delivered at practice time, so this system is fully isolated.
 *
 * v38 expansion: the catalog grew to 18 pursuits across eight themes (creative,
 * physical, intellectual, social, collecting, outdoor, culinary, musical/
 * wellness) and each pursuit now advances through five NAMED mastery tiers
 * (Novice → Amateur → Skilled → Expert → Master). Tiers are derived from the
 * existing 0..10 level — every pursuit participates automatically — and crossing
 * a tier boundary pays a one-time spike scaled by the tier reached. Additive and
 * save-safe: pursuits are keyed by id in `gameState.pursuits`, so new hobbies
 * simply appear at level 0 for old saves and existing progress is untouched.
 */
import type { GameState, PlayerPursuit } from '@/contexts/game/types';

export type PursuitStat = 'health' | 'happiness' | 'energy' | 'fitness' | 'money' | 'reputation';
export interface PursuitReward {
  stat: PursuitStat;
  amount: number;
}

/** Theme buckets for the catalog — surfaced in the UI and used by hobby events. */
export type PursuitCategory =
  | 'creative'
  | 'physical'
  | 'intellectual'
  | 'social'
  | 'collecting'
  | 'outdoor'
  | 'culinary'
  | 'musical'
  | 'wellness';

export interface PursuitDef {
  id: string;
  name: string;
  emoji: string;
  color: string;
  category: PursuitCategory;
  tagline: string;
  energyCost: number;
  weeklyCap: number;
  /** Immediate reward for one practice, scaling gently with current level. */
  reward: (level: number) => PursuitReward[];
  /** Human description of the mastery perk at a level. */
  perk: (level: number) => string;
}

export const PRACTICE_XP = 34; // ~3 practices per level
export const XP_PER_LEVEL = 100;
export const MAX_PURSUIT_LEVEL = 10;

/** Level from accumulated xp, capped. */
export function levelFromXp(xp: number): number {
  if (!xp || xp < 0) return 0;
  return Math.min(MAX_PURSUIT_LEVEL, Math.floor(xp / XP_PER_LEVEL));
}

/** XP into the current level (0..XP_PER_LEVEL) for progress bars. */
export function xpIntoLevel(xp: number): number {
  if (levelFromXp(xp) >= MAX_PURSUIT_LEVEL) return XP_PER_LEVEL;
  return (xp || 0) % XP_PER_LEVEL;
}

// ---------------------------------------------------------------------------
// Mastery tiers — named milestones layered on top of the 0..10 level. Every
// pursuit shares the same tier ladder, so all 18 participate for free. Tiers
// have monotonically increasing `minLevel` thresholds (escalating requirements)
// and crossing one pays an escalating spike (see `tierUpBonus`).
// ---------------------------------------------------------------------------

export interface MasteryTier {
  name: string;
  /** Inclusive level at which this tier begins. Strictly increasing across the list. */
  minLevel: number;
}

export const MASTERY_TIERS: MasteryTier[] = [
  { name: 'Novice', minLevel: 0 },
  { name: 'Amateur', minLevel: 2 },
  { name: 'Skilled', minLevel: 4 },
  { name: 'Expert', minLevel: 6 },
  { name: 'Master', minLevel: 9 },
];

/** Index into MASTERY_TIERS for a given level. */
export function tierIndexForLevel(level: number): number {
  let idx = 0;
  for (let i = 0; i < MASTERY_TIERS.length; i++) {
    if (level >= MASTERY_TIERS[i].minLevel) idx = i;
  }
  return idx;
}

/** The named mastery tier a pursuit is currently in. */
export function tierForLevel(level: number): MasteryTier {
  return MASTERY_TIERS[tierIndexForLevel(level)];
}

const r = (stat: PursuitStat, amount: number): PursuitReward => ({ stat, amount });

export const PURSUITS: PursuitDef[] = [
  {
    id: 'running',
    name: 'Running',
    emoji: '🏃',
    color: '#34D399',
    category: 'physical',
    tagline: 'Build endurance and stay in shape.',
    energyCost: 12,
    weeklyCap: 3,
    reward: (lvl) => [r('fitness', 3 + Math.floor(lvl / 2)), r('health', 1 + Math.floor(lvl / 3))],
    perk: (lvl) => `+${3 + Math.floor(lvl / 2)} Fitness & +${1 + Math.floor(lvl / 3)} Health per run`,
  },
  {
    id: 'guitar',
    name: 'Guitar',
    emoji: '🎸',
    color: '#A855F7',
    category: 'musical',
    tagline: 'Play for the joy of it.',
    energyCost: 10,
    weeklyCap: 3,
    reward: (lvl) => [r('happiness', 4 + Math.floor(lvl / 2))],
    perk: (lvl) => `+${4 + Math.floor(lvl / 2)} Happiness per session`,
  },
  {
    id: 'cooking',
    name: 'Cooking',
    emoji: '🍳',
    color: '#F59E0B',
    category: 'culinary',
    tagline: 'Eat well, spend less.',
    energyCost: 10,
    weeklyCap: 3,
    reward: (lvl) => [r('health', 2 + Math.floor(lvl / 3)), r('money', 8 + lvl * 3)],
    perk: (lvl) => `+${2 + Math.floor(lvl / 3)} Health & save $${8 + lvl * 3} per meal`,
  },
  {
    id: 'chess',
    name: 'Chess',
    emoji: '♟️',
    color: '#60A5FA',
    category: 'intellectual',
    tagline: 'Sharpen your mind.',
    energyCost: 8,
    weeklyCap: 3,
    reward: (lvl) => [r('reputation', 1 + Math.floor(lvl / 4)), r('happiness', 2)],
    perk: (lvl) => `+${1 + Math.floor(lvl / 4)} Reputation & +2 Happiness per match`,
  },
  {
    id: 'painting',
    name: 'Painting',
    emoji: '🎨',
    color: '#F472B6',
    category: 'creative',
    tagline: 'Express yourself.',
    energyCost: 10,
    weeklyCap: 3,
    reward: (lvl) => [r('happiness', 3 + Math.floor(lvl / 3)), r('reputation', 1 + Math.floor(lvl / 5))],
    perk: (lvl) => `+${3 + Math.floor(lvl / 3)} Happiness & +${1 + Math.floor(lvl / 5)} Reputation per piece`,
  },
  {
    id: 'coding',
    name: 'Coding',
    emoji: '💻',
    color: '#22D3EE',
    category: 'intellectual',
    tagline: 'Build side projects that pay.',
    energyCost: 14,
    weeklyCap: 3,
    reward: (lvl) => [r('money', 15 + lvl * 6), r('happiness', 1)],
    perk: (lvl) => `Earn $${15 + lvl * 6} & +1 Happiness per session`,
  },
  // ── v38 expansion ────────────────────────────────────────────────────────
  {
    id: 'photography',
    name: 'Photography',
    emoji: '📷',
    color: '#38BDF8',
    category: 'creative',
    tagline: 'Frame the world one shot at a time.',
    energyCost: 10,
    weeklyCap: 3,
    reward: (lvl) => [r('happiness', 3 + Math.floor(lvl / 3)), r('money', 4 + lvl * 2)],
    perk: (lvl) => `+${3 + Math.floor(lvl / 3)} Happiness & sell prints for $${4 + lvl * 2}`,
  },
  {
    id: 'gardening',
    name: 'Gardening',
    emoji: '🪴',
    color: '#4ADE80',
    category: 'outdoor',
    tagline: 'Grow something calming.',
    energyCost: 9,
    weeklyCap: 3,
    reward: (lvl) => [r('health', 2 + Math.floor(lvl / 3)), r('happiness', 2 + Math.floor(lvl / 3))],
    perk: (lvl) => `+${2 + Math.floor(lvl / 3)} Health & +${2 + Math.floor(lvl / 3)} Happiness per tend`,
  },
  {
    id: 'yoga',
    name: 'Yoga',
    emoji: '🧘',
    color: '#2DD4BF',
    category: 'wellness',
    tagline: 'Balance body and mind.',
    energyCost: 8,
    weeklyCap: 3,
    reward: (lvl) => [r('health', 2 + Math.floor(lvl / 3)), r('fitness', 2 + Math.floor(lvl / 3))],
    perk: (lvl) => `+${2 + Math.floor(lvl / 3)} Health & +${2 + Math.floor(lvl / 3)} Fitness per session`,
  },
  {
    id: 'reading',
    name: 'Reading',
    emoji: '📚',
    color: '#FBBF24',
    category: 'intellectual',
    tagline: 'Get lost in a good book.',
    energyCost: 7,
    weeklyCap: 3,
    reward: (lvl) => [r('happiness', 2), r('reputation', 1 + Math.floor(lvl / 4))],
    perk: (lvl) => `+2 Happiness & +${1 + Math.floor(lvl / 4)} Reputation per book`,
  },
  {
    id: 'cycling',
    name: 'Cycling',
    emoji: '🚴',
    color: '#F97316',
    category: 'outdoor',
    tagline: 'Chase the horizon.',
    energyCost: 12,
    weeklyCap: 3,
    reward: (lvl) => [r('fitness', 3 + Math.floor(lvl / 2)), r('happiness', 1 + Math.floor(lvl / 3))],
    perk: (lvl) => `+${3 + Math.floor(lvl / 2)} Fitness & +${1 + Math.floor(lvl / 3)} Happiness per ride`,
  },
  {
    id: 'baking',
    name: 'Baking',
    emoji: '🧁',
    color: '#FB7185',
    category: 'culinary',
    tagline: 'Treats worth sharing.',
    energyCost: 9,
    weeklyCap: 3,
    reward: (lvl) => [r('happiness', 3 + Math.floor(lvl / 3)), r('money', 6 + lvl * 2)],
    perk: (lvl) => `+${3 + Math.floor(lvl / 3)} Happiness & sell treats for $${6 + lvl * 2}`,
  },
  {
    id: 'dancing',
    name: 'Dancing',
    emoji: '💃',
    color: '#E879F9',
    category: 'physical',
    tagline: 'Move to the rhythm.',
    energyCost: 10,
    weeklyCap: 3,
    reward: (lvl) => [r('fitness', 2 + Math.floor(lvl / 3)), r('happiness', 3 + Math.floor(lvl / 3))],
    perk: (lvl) => `+${2 + Math.floor(lvl / 3)} Fitness & +${3 + Math.floor(lvl / 3)} Happiness per class`,
  },
  {
    id: 'writing',
    name: 'Writing',
    emoji: '✍️',
    color: '#94A3B8',
    category: 'creative',
    tagline: 'Put your thoughts on the page.',
    energyCost: 10,
    weeklyCap: 3,
    reward: (lvl) => [r('reputation', 1 + Math.floor(lvl / 4)), r('money', 6 + lvl * 3)],
    perk: (lvl) => `+${1 + Math.floor(lvl / 4)} Reputation & earn $${6 + lvl * 3} freelancing`,
  },
  {
    id: 'fishing',
    name: 'Fishing',
    emoji: '🎣',
    color: '#0EA5E9',
    category: 'outdoor',
    tagline: 'Unwind by the water.',
    energyCost: 8,
    weeklyCap: 3,
    reward: (lvl) => [r('happiness', 3 + Math.floor(lvl / 3)), r('health', 1 + Math.floor(lvl / 4))],
    perk: (lvl) => `+${3 + Math.floor(lvl / 3)} Happiness & +${1 + Math.floor(lvl / 4)} Health per trip`,
  },
  {
    id: 'collecting',
    name: 'Collecting',
    emoji: '🪙',
    color: '#EAB308',
    category: 'collecting',
    tagline: 'Curate rare finds.',
    energyCost: 7,
    weeklyCap: 2,
    reward: (lvl) => [r('reputation', 1 + Math.floor(lvl / 4)), r('money', 5 + lvl * 2)],
    perk: (lvl) => `+${1 + Math.floor(lvl / 4)} Reputation & collection worth $${5 + lvl * 2} more`,
  },
  {
    id: 'volunteering',
    name: 'Volunteering',
    emoji: '🤝',
    color: '#10B981',
    category: 'social',
    tagline: 'Give back to the community.',
    energyCost: 10,
    weeklyCap: 3,
    reward: (lvl) => [r('happiness', 3 + Math.floor(lvl / 3)), r('reputation', 2 + Math.floor(lvl / 3))],
    perk: (lvl) => `+${3 + Math.floor(lvl / 3)} Happiness & +${2 + Math.floor(lvl / 3)} Reputation per shift`,
  },
  {
    id: 'singing',
    name: 'Singing',
    emoji: '🎤',
    color: '#C084FC',
    category: 'musical',
    tagline: 'Find your voice.',
    energyCost: 9,
    weeklyCap: 3,
    reward: (lvl) => [r('happiness', 3 + Math.floor(lvl / 3)), r('reputation', 1 + Math.floor(lvl / 5))],
    perk: (lvl) => `+${3 + Math.floor(lvl / 3)} Happiness & +${1 + Math.floor(lvl / 5)} Reputation per set`,
  },
];

export function getPursuitDef(id: string): PursuitDef | undefined {
  return PURSUITS.find((p) => p.id === id);
}

export function getPlayerPursuit(state: GameState, id: string): PlayerPursuit {
  return state.pursuits?.[id] ?? { xp: 0, level: 0 };
}

/** Bonus stat delta granted the moment a pursuit reaches a new level. */
export function levelUpBonus(def: PursuitDef, newLevel: number): PursuitReward[] {
  // Double the per-practice reward at the new level as a "you leveled up" spike.
  return def.reward(newLevel).map((rw) => ({ stat: rw.stat, amount: rw.amount * 2 }));
}

/**
 * Bonus granted when a practice pushes a pursuit into a NEW mastery tier — the
 * headline benefit of each named tier. Reuses the pursuit's own reward shape so
 * the payoff stays thematically on-brand, and scales with the tier reached
 * (Amateur ×3, Skilled ×4, Expert ×5, Master ×6). Larger than a plain level-up
 * spike, so hitting a tier feels like a milestone; still one-time-per-tier and
 * gated behind ~30 practices to max, so it is not farmable.
 */
export function tierUpBonus(def: PursuitDef, newLevel: number, newTierIndex: number): PursuitReward[] {
  const mult = 2 + newTierIndex; // tierIndex 1..4 → ×3..×6
  return def.reward(newLevel).map((rw) => ({ stat: rw.stat, amount: rw.amount * mult }));
}
