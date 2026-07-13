/**
 * Hobby Mastery catalog + mastery-tier integrity (v38 expansion).
 *
 * Guards the content: the catalog is well-formed (unique ids, valid shape,
 * balanced-ish rewards), the named mastery tiers have monotonically increasing
 * thresholds, and progression through a tier boundary pays the (bigger)
 * tier-up spike rather than the plain level-up spike.
 */
import { GameState } from '@/contexts/game/types';
import { createTestGameState } from '@/__tests__/helpers/createTestGameState';
import { practicePursuit } from '@/contexts/game/actions/PursuitActions';
import {
  PURSUITS,
  MASTERY_TIERS,
  PursuitCategory,
  PursuitStat,
  tierIndexForLevel,
  tierForLevel,
  levelFromXp,
  MAX_PURSUIT_LEVEL,
  PRACTICE_XP,
} from '@/lib/pursuits/pursuitMastery';

const VALID_STATS: PursuitStat[] = ['health', 'happiness', 'energy', 'fitness', 'money', 'reputation'];
const VALID_CATEGORIES: PursuitCategory[] = [
  'creative', 'physical', 'intellectual', 'social',
  'collecting', 'outdoor', 'culinary', 'musical', 'wellness',
];

function harness(initial: GameState) {
  const ref = { state: initial };
  const setGameState = ((u: GameState | ((p: GameState) => GameState)) => {
    ref.state = typeof u === 'function' ? u(ref.state) : u;
  }) as React.Dispatch<React.SetStateAction<GameState>>;
  return { ref, setGameState };
}

describe('pursuit catalog integrity', () => {
  it('offers at least 18 hobbies', () => {
    expect(PURSUITS.length).toBeGreaterThanOrEqual(18);
  });

  it('has unique ids', () => {
    const ids = PURSUITS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every hobby has a valid shape', () => {
    for (const p of PURSUITS) {
      expect(typeof p.id).toBe('string');
      expect(p.id.length).toBeGreaterThan(0);
      expect(typeof p.name).toBe('string');
      expect(typeof p.emoji).toBe('string');
      expect(p.emoji.length).toBeGreaterThan(0);
      expect(p.color).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(VALID_CATEGORIES).toContain(p.category);
      expect(typeof p.tagline).toBe('string');
      expect(p.energyCost).toBeGreaterThan(0);
      expect(p.weeklyCap).toBeGreaterThanOrEqual(1);
      expect(typeof p.perk(0)).toBe('string');
    }
  });

  it('every hobby reward is well-formed and modestly scaled at all levels', () => {
    for (const p of PURSUITS) {
      for (let lvl = 0; lvl <= MAX_PURSUIT_LEVEL; lvl++) {
        const rewards = p.reward(lvl);
        expect(Array.isArray(rewards)).toBe(true);
        expect(rewards.length).toBeGreaterThan(0);
        for (const rw of rewards) {
          expect(VALID_STATS).toContain(rw.stat);
          expect(rw.amount).toBeGreaterThan(0);
          // Balance guard: non-money stat rewards stay modest (rounded-life system,
          // not a power exploit). Money is allowed a larger band.
          if (rw.stat !== 'money') {
            expect(rw.amount).toBeLessThanOrEqual(12);
          } else {
            expect(rw.amount).toBeLessThanOrEqual(100);
          }
        }
      }
    }
  });

  it('spans a broad range of themes', () => {
    const cats = new Set(PURSUITS.map((p) => p.category));
    // At least six distinct themes represented across the roster.
    expect(cats.size).toBeGreaterThanOrEqual(6);
  });
});

describe('mastery tiers', () => {
  it('start at level 0 and have strictly increasing thresholds', () => {
    expect(MASTERY_TIERS.length).toBeGreaterThanOrEqual(3);
    expect(MASTERY_TIERS[0].minLevel).toBe(0);
    for (let i = 1; i < MASTERY_TIERS.length; i++) {
      expect(MASTERY_TIERS[i].minLevel).toBeGreaterThan(MASTERY_TIERS[i - 1].minLevel);
      expect(typeof MASTERY_TIERS[i].name).toBe('string');
    }
  });

  it('map levels to the correct tier', () => {
    // Novice at 0/1, Amateur at 2, ..., Master at the top level.
    expect(tierForLevel(0).name).toBe(MASTERY_TIERS[0].name);
    expect(tierForLevel(MAX_PURSUIT_LEVEL).name).toBe(MASTERY_TIERS[MASTERY_TIERS.length - 1].name);
    // tier index is monotonic non-decreasing in level
    let prev = 0;
    for (let lvl = 0; lvl <= MAX_PURSUIT_LEVEL; lvl++) {
      const idx = tierIndexForLevel(lvl);
      expect(idx).toBeGreaterThanOrEqual(prev);
      prev = idx;
    }
  });
});

describe('mastery progression via practice', () => {
  it('a within-tier level-up pays the plain (×2) level-up spike, not a tier-up', () => {
    // running level 0 → 1: both levels are in the Novice tier (idx 0), so no tier cross.
    const base = createTestGameState();
    const state = createTestGameState({
      stats: { ...base.stats, energy: 100, fitness: 0, health: 0 },
      pursuits: { running: { xp: 90, level: 0 } },
    });
    const { ref, setGameState } = harness(state);
    const res = practicePursuit(ref.state, setGameState, 'running');

    expect(res.leveledUp).toBe(true);
    expect(res.newLevel).toBe(1);
    expect(res.tierUp).toBeFalsy();
    // level-1 reward: fitness 3, health 1; plain level-up doubles it on top.
    // fitness = 3 (practice) + 6 (×2 spike) = 9; health = 1 + 2 = 3.
    expect(ref.state.stats.fitness).toBe(9);
    expect(ref.state.stats.health).toBe(3);
    expect(tierForLevel(ref.state.pursuits!.running.level).name).toBe('Novice');
  });

  it('crossing a tier boundary reports a tier-up and pays the bigger tier spike', () => {
    // running level 1 → 2 crosses Novice → Amateur (tier idx 0 → 1).
    const base = createTestGameState();
    const state = createTestGameState({
      stats: { ...base.stats, energy: 100, fitness: 0, health: 0 },
      pursuits: { running: { xp: 199, level: 1 } },
    });
    const { ref, setGameState } = harness(state);
    const res = practicePursuit(ref.state, setGameState, 'running');

    expect(res.leveledUp).toBe(true);
    expect(res.newLevel).toBe(levelFromXp(199 + PRACTICE_XP)); // 2
    expect(res.tierUp).toBe(true);
    expect(res.tierName).toBe('Amateur');
    // level-2 reward: fitness 4, health 1. Tier-up spike ×(2+tierIdx)=×3.
    // fitness = 4 (practice) + 12 (×3 spike) = 16; health = 1 + 3 = 4.
    expect(ref.state.stats.fitness).toBe(16);
    expect(ref.state.stats.health).toBe(4);
    expect(tierForLevel(ref.state.pursuits!.running.level).name).toBe('Amateur');
  });
});
