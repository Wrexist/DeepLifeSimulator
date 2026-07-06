/**
 * Hobby Mastery (v21) — a self-contained weekly loop that refills the gap left
 * when the old hobbies were removed. Pick a pursuit, practice it each week
 * (costs energy, capped per week), earn XP, level up, and get a compounding
 * immediate reward plus a named perk. No weekly-tick surgery: the payoff is
 * delivered at practice time, so this system is fully isolated.
 */
import type { GameState, PlayerPursuit } from '@/contexts/game/types';

export type PursuitStat = 'health' | 'happiness' | 'energy' | 'fitness' | 'money' | 'reputation';
export interface PursuitReward {
  stat: PursuitStat;
  amount: number;
}

export interface PursuitDef {
  id: string;
  name: string;
  emoji: string;
  color: string;
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

const r = (stat: PursuitStat, amount: number): PursuitReward => ({ stat, amount });

export const PURSUITS: PursuitDef[] = [
  {
    id: 'running',
    name: 'Running',
    emoji: '🏃',
    color: '#34D399',
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
    tagline: 'Build side projects that pay.',
    energyCost: 14,
    weeklyCap: 3,
    reward: (lvl) => [r('money', 15 + lvl * 6), r('happiness', 1)],
    perk: (lvl) => `Earn $${15 + lvl * 6} & +1 Happiness per session`,
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
