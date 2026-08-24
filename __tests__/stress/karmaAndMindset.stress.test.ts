/**
 * Karma + Mindset Audit
 *
 * Both systems sit underneath major action paths (street jobs, dating,
 * spending) and apply silent multipliers to outcomes. If a tier ordering
 * is wrong or a multiplier returns NaN, gameplay drifts in a way players
 * can't see in logs. Coverage:
 *
 *   - Karma score + dimensions clamped to [-100, 100]
 *   - History capped at MAX_HISTORY = 50
 *   - Per-action karma delta clamped to [-20, 20] regardless of input
 *   - Overall score = average of dimensions
 *   - Karma tier transitions (saint / virtuous / good / neutral / etc.) at correct boundaries
 *   - getKarmaModifiers returns finite values for every karma combination
 *   - REGRESSION: crimeSuccessBonus order — the 0.25 (extreme) tier reachable
 *   - applyMindsetEffects: every trait clears + applies feedback without NaN
 *   - applyMindsetEffects with empty traits: passthrough
 *   - applyMindsetEffects with all 11 traits stacked: state stays finite
 */

import {
  INITIAL_KARMA,
  applyKarmaChange,
  getKarmaTier,
  getKarmaLabel,
  getKarmaColor,
  getKarmaModifiers,
  KARMA_ACTIONS,
} from '@/lib/karma/karmaSystem';
import {
  PERSONALITY_TRAITS,
  FINANCIAL_TRAITS,
  MINDSET_TRAITS,
  applyMindsetEffects,
} from '@/lib/mindset/config';
import type { GameState } from '@/contexts/game/types';
import { initialGameState } from '@/contexts/game/initialState';

function makeState(over: Partial<GameState> = {}): GameState {
  return { ...structuredClone(initialGameState), ...over };
}

function deepCheck(state: unknown): string[] {
  const issues: string[] = [];
  const seen = new WeakSet();
  const walk = (v: unknown, p: string) => {
    if (v === null || v === undefined) return;
    if (typeof v === 'number') {
      if (Number.isNaN(v)) issues.push(`NaN at ${p}`);
      if (!Number.isFinite(v)) issues.push(`Infinity at ${p}`);
      return;
    }
    if (typeof v === 'object') {
      const obj = v as object;
      if (seen.has(obj)) return;
      seen.add(obj);
      if (Array.isArray(obj)) obj.forEach((x, i) => walk(x, `${p}[${i}]`));
      else for (const k of Object.keys(obj)) walk((obj as Record<string, unknown>)[k], `${p}.${k}`);
    }
  };
  walk(state, 'root');
  return issues;
}

describe('Karma audit', () => {
  // ── DEFAULT ────────────────────────────────────────────────────────────
  it('INITIAL_KARMA: score=0, all dimensions=0, empty history', () => {
    expect(INITIAL_KARMA.score).toBe(0);
    expect(INITIAL_KARMA.dimensions.generosity).toBe(0);
    expect(INITIAL_KARMA.dimensions.honesty).toBe(0);
    expect(INITIAL_KARMA.dimensions.violence).toBe(0);
    expect(INITIAL_KARMA.dimensions.loyalty).toBe(0);
    expect(INITIAL_KARMA.dimensions.ambition).toBe(0);
    expect(INITIAL_KARMA.history).toEqual([]);
  });

  // ── applyKarmaChange ───────────────────────────────────────────────────
  it('applyKarmaChange: clamps single change to [-20, 20]', () => {
    let k = INITIAL_KARMA;
    k = applyKarmaChange(k, 'generosity', 1000, 'huge', 1);
    expect(k.dimensions.generosity).toBe(20); // 1000 clamped to 20

    k = applyKarmaChange(k, 'generosity', -1000, 'huge negative', 2);
    // 20 + clamp(-1000, -20, 20) = 20 + -20 = 0
    expect(k.dimensions.generosity).toBe(0);
  });

  it('applyKarmaChange: dimension stays in [-100, 100] across many changes', () => {
    let k = INITIAL_KARMA;
    for (let i = 0; i < 50; i++) {
      k = applyKarmaChange(k, 'honesty', 20, 'spam', i);
    }
    expect(k.dimensions.honesty).toBe(100);
    expect(k.score).toBeLessThanOrEqual(100);

    for (let i = 0; i < 50; i++) {
      k = applyKarmaChange(k, 'honesty', -20, 'spam down', i);
    }
    expect(k.dimensions.honesty).toBe(-100);
    expect(k.score).toBeGreaterThanOrEqual(-100);
  });

  it('applyKarmaChange: overall score is average of dimensions (rounded)', () => {
    let k = INITIAL_KARMA;
    k = applyKarmaChange(k, 'generosity', 20, 'g', 1); // gen=20
    k = applyKarmaChange(k, 'honesty', 20, 'h', 2); // hon=20
    // 4 other dimensions still 0: avg = (20+20+0+0+0)/5 = 8
    expect(k.score).toBe(8);
  });

  it('applyKarmaChange: history capped at MAX_HISTORY=50', () => {
    let k = INITIAL_KARMA;
    for (let i = 0; i < 100; i++) {
      k = applyKarmaChange(k, 'generosity', 1, `event ${i}`, i);
    }
    expect(k.history.length).toBe(50);
    // Most recent kept.
    expect(k.history[k.history.length - 1].reason).toBe('event 99');
  });

  it('applyKarmaChange: does not mutate input', () => {
    const before = JSON.parse(JSON.stringify(INITIAL_KARMA));
    applyKarmaChange(INITIAL_KARMA, 'honesty', 5, 'test', 1);
    expect(JSON.parse(JSON.stringify(INITIAL_KARMA))).toEqual(before);
  });

  // ── TIER BOUNDARIES ────────────────────────────────────────────────────
  it('getKarmaTier: boundaries at -75/-40/-15/+15/+40/+75', () => {
    expect(getKarmaTier(100)).toBe('saint');
    expect(getKarmaTier(75)).toBe('saint');
    expect(getKarmaTier(74)).toBe('virtuous');
    expect(getKarmaTier(40)).toBe('virtuous');
    expect(getKarmaTier(39)).toBe('good');
    expect(getKarmaTier(15)).toBe('good');
    expect(getKarmaTier(14)).toBe('neutral');
    expect(getKarmaTier(0)).toBe('neutral');
    expect(getKarmaTier(-15)).toBe('neutral');
    expect(getKarmaTier(-16)).toBe('questionable');
    expect(getKarmaTier(-40)).toBe('questionable');
    expect(getKarmaTier(-41)).toBe('corrupt');
    expect(getKarmaTier(-75)).toBe('corrupt');
    expect(getKarmaTier(-76)).toBe('ruthless');
    expect(getKarmaTier(-100)).toBe('ruthless');
  });

  it('getKarmaLabel + getKarmaColor: return string for every tier', () => {
    const tiers = ['saint', 'virtuous', 'good', 'neutral', 'questionable', 'corrupt', 'ruthless'] as const;
    for (const t of tiers) {
      expect(typeof getKarmaLabel(t)).toBe('string');
      expect(typeof getKarmaColor(t)).toBe('string');
    }
  });

  // ── getKarmaModifiers ──────────────────────────────────────────────────
  it('getKarmaModifiers: returns finite values for every karma score (sweep)', () => {
    for (let score = -100; score <= 100; score += 10) {
      let k = { ...INITIAL_KARMA, score };
      // Also vary violence dimension for crime bonus path.
      k = { ...k, dimensions: { ...k.dimensions, violence: score } };
      const m = getKarmaModifiers(k);
      expect(Number.isFinite(m.npcTrustMultiplier)).toBe(true);
      expect(Number.isFinite(m.crimeSuccessBonus)).toBe(true);
      expect(Number.isFinite(m.politicalApprovalModifier)).toBe(true);
      expect(Number.isFinite(m.reputationMultiplier)).toBe(true);
      expect(typeof m.canAccessHonestCareers).toBe('boolean');
      expect(typeof m.canAccessCorruptCareers).toBe('boolean');
    }
  });

  // ── BUG-FIX REGRESSION: crimeSuccessBonus ordering ─────────────────────
  it('BUG-FIX: crimeSuccessBonus 0.25 tier reachable at violence < -60', () => {
    // BEFORE FIX: order was `violence < -30 ? 0.15 : violence < -60 ? 0.25 : 0`
    // → first ternary always matched for any value below -60, so 0.25 was
    //   unreachable. Now the more-extreme bound is checked first.
    const veryRuthless = { ...INITIAL_KARMA, dimensions: { ...INITIAL_KARMA.dimensions, violence: -80 } };
    expect(getKarmaModifiers(veryRuthless).crimeSuccessBonus).toBe(0.25);

    const moderatelyRuthless = { ...INITIAL_KARMA, dimensions: { ...INITIAL_KARMA.dimensions, violence: -40 } };
    expect(getKarmaModifiers(moderatelyRuthless).crimeSuccessBonus).toBe(0.15);

    const neutral = { ...INITIAL_KARMA, dimensions: { ...INITIAL_KARMA.dimensions, violence: 0 } };
    expect(getKarmaModifiers(neutral).crimeSuccessBonus).toBe(0);
  });

  it('crimeSuccessBonus: monotonic - more negative violence → equal-or-greater bonus', () => {
    let lastBonus = 0;
    for (let v = 0; v >= -100; v -= 5) {
      const k = { ...INITIAL_KARMA, dimensions: { ...INITIAL_KARMA.dimensions, violence: v } };
      const bonus = getKarmaModifiers(k).crimeSuccessBonus;
      expect(bonus).toBeGreaterThanOrEqual(lastBonus);
      lastBonus = bonus;
    }
  });

  it('npcTrustMultiplier: saint > virtuous > good > neutral > questionable > corrupt > ruthless', () => {
    const mul = (score: number) => getKarmaModifiers({ ...INITIAL_KARMA, score }).npcTrustMultiplier;
    expect(mul(100)).toBeGreaterThan(mul(50));   // saint > virtuous
    expect(mul(50)).toBeGreaterThan(mul(20));    // virtuous > good
    expect(mul(20)).toBeGreaterThan(mul(0));     // good > neutral
    expect(mul(0)).toBeGreaterThan(mul(-20));    // neutral > questionable
    expect(mul(-20)).toBeGreaterThan(mul(-50));  // questionable > corrupt
    expect(mul(-50)).toBeGreaterThan(mul(-90));  // corrupt > ruthless
  });

  it('canAccessHonestCareers: gated on honesty > -30', () => {
    const lowHonesty = { ...INITIAL_KARMA, dimensions: { ...INITIAL_KARMA.dimensions, honesty: -50 } };
    expect(getKarmaModifiers(lowHonesty).canAccessHonestCareers).toBe(false);
    const midHonesty = { ...INITIAL_KARMA, dimensions: { ...INITIAL_KARMA.dimensions, honesty: 0 } };
    expect(getKarmaModifiers(midHonesty).canAccessHonestCareers).toBe(true);
  });

  it('canAccessCorruptCareers: gated on violence < -20', () => {
    const peaceful = { ...INITIAL_KARMA, dimensions: { ...INITIAL_KARMA.dimensions, violence: 0 } };
    expect(getKarmaModifiers(peaceful).canAccessCorruptCareers).toBe(false);
    const violent = { ...INITIAL_KARMA, dimensions: { ...INITIAL_KARMA.dimensions, violence: -30 } };
    expect(getKarmaModifiers(violent).canAccessCorruptCareers).toBe(true);
  });

  // ── KARMA_ACTIONS catalog ──────────────────────────────────────────────
  it('KARMA_ACTIONS: every entry has dimension, amount, reason', () => {
    const entries = Object.values(KARMA_ACTIONS);
    expect(entries.length).toBeGreaterThan(0);
    for (const e of entries) {
      expect(['generosity', 'honesty', 'violence', 'loyalty', 'ambition']).toContain(e.dimension);
      expect(typeof e.amount).toBe('number');
      expect(Number.isFinite(e.amount)).toBe(true);
      expect(Math.abs(e.amount)).toBeLessThanOrEqual(20); // pre-clamped
      expect(typeof e.reason).toBe('string');
      expect(e.reason.length).toBeGreaterThan(0);
    }
  });
});

describe('Mindset audit', () => {
  // ── CATALOG ────────────────────────────────────────────────────────────
  it('MINDSET_TRAITS: combines personality + financial, no duplicate ids', () => {
    expect(MINDSET_TRAITS.length).toBe(PERSONALITY_TRAITS.length + FINANCIAL_TRAITS.length);
    const ids = new Set<string>();
    for (const t of MINDSET_TRAITS) {
      expect(typeof t.id).toBe('string');
      expect(typeof t.name).toBe('string');
      expect(['personality', 'financial']).toContain(t.category);
      expect(ids.has(t.id)).toBe(false);
      ids.add(t.id);
    }
  });

  // ── applyMindsetEffects ────────────────────────────────────────────────
  it('applyMindsetEffects: no active traits → passthrough', () => {
    const state = makeState({ mindset: undefined });
    const result = applyMindsetEffects(state, { moneyDelta: 100, happinessDelta: 5 });
    expect(result.moneyDelta).toBe(100);
    expect(result.happinessDelta).toBe(5);
  });

  it('applyMindsetEffects: empty traits array → passthrough', () => {
    const state = makeState({ mindset: { traits: [], activeTraitId: undefined } as never });
    const result = applyMindsetEffects(state, { moneyDelta: 100 });
    expect(result.moneyDelta).toBe(100);
  });

  it('applyMindsetEffects: frugal - positive income gets 1.1x', () => {
    const state = makeState({ mindset: { traits: ['frugal'], activeTraitId: 'frugal' } as never });
    const result = applyMindsetEffects(state, { moneyDelta: 1000 });
    expect(result.moneyDelta).toBeCloseTo(1100, 0);
  });

  it('applyMindsetEffects: workaholic - positive income +10%, but -1 health and -1 happiness', () => {
    const state = makeState({ mindset: { traits: ['workaholic'], activeTraitId: 'workaholic' } as never });
    const result = applyMindsetEffects(state, { moneyDelta: 500, healthDelta: 0, happinessDelta: 0 });
    expect(result.moneyDelta).toBeCloseTo(550, 0);
    expect(result.healthDelta).toBe(-1);
    expect(result.happinessDelta).toBe(-1);
  });

  it('applyMindsetEffects: riskAverse - reduces both gains and losses', () => {
    const state = makeState({ mindset: { traits: ['riskAverse'], activeTraitId: 'riskAverse' } as never });
    const gainResult = applyMindsetEffects(state, { moneyDelta: 1000 });
    expect(gainResult.moneyDelta).toBeCloseTo(950, 0);
    const lossResult = applyMindsetEffects(state, { moneyDelta: -1000 });
    expect(Math.abs(lossResult.moneyDelta!)).toBeCloseTo(850, 0);
  });

  it('applyMindsetEffects: gambler - randomly varies ±20% of moneyDelta', () => {
    const state = makeState({ mindset: { traits: ['gambler'], activeTraitId: 'gambler' } as never });
    // Run many trials to bracket the random range.
    let min = Infinity;
    let max = -Infinity;
    for (let i = 0; i < 200; i++) {
      const r = applyMindsetEffects(state, { moneyDelta: 1000 });
      if (r.moneyDelta! < min) min = r.moneyDelta!;
      if (r.moneyDelta! > max) max = r.moneyDelta!;
    }
    expect(min).toBeGreaterThan(750);  // > -20% from 1000
    expect(max).toBeLessThan(1250);    // < +20% from 1000
    // Both directions sampled.
    expect(min).toBeLessThan(1000);
    expect(max).toBeGreaterThan(1000);
  });

  it('applyMindsetEffects: all 11 traits stacked produce finite output', () => {
    const allTraits = MINDSET_TRAITS.map(t => t.id);
    const state = makeState({ mindset: { traits: allTraits, activeTraitId: allTraits[0] } as never });
    const result = applyMindsetEffects(state, { moneyDelta: 1000, healthDelta: 0, happinessDelta: 0 });
    expect(Number.isFinite(result.moneyDelta!)).toBe(true);
    expect(Number.isFinite(result.healthDelta!)).toBe(true);
    expect(Number.isFinite(result.happinessDelta!)).toBe(true);
  });

  it('applyMindsetEffects: applies effects to negative moneyDelta correctly', () => {
    const state = makeState({ mindset: { traits: ['socialite'], activeTraitId: 'socialite' } as never });
    const result = applyMindsetEffects(state, { moneyDelta: -500 });
    // Socialite spends 10% more on social activities (more negative).
    expect(result.moneyDelta).toBeLessThan(-500);
    expect(Math.abs(result.moneyDelta!)).toBeCloseTo(550, 0);
  });

  it('applyMindsetEffects: 0 deltas produce 0 deltas (no spurious adjustments)', () => {
    const state = makeState({ mindset: { traits: ['frugal'], activeTraitId: 'frugal' } as never });
    const result = applyMindsetEffects(state, { moneyDelta: 0, happinessDelta: 0, healthDelta: 0 });
    expect(result.moneyDelta).toBe(0);
  });

  // ── STATE SAFETY ───────────────────────────────────────────────────────
  it('applyMindsetEffects: 100 random deltas keep result finite', () => {
    const allTraits = MINDSET_TRAITS.map(t => t.id);
    const state = makeState({ mindset: { traits: allTraits, activeTraitId: allTraits[0] } as never });
    for (let i = 0; i < 100; i++) {
      const moneyDelta = (Math.random() - 0.5) * 100_000;
      const result = applyMindsetEffects(state, { moneyDelta });
      const issues = deepCheck(result);
      expect(issues).toEqual([]);
    }
  });
});

describe('Karma + Mindset cross-system', () => {
  // ── KARMA_ACTIONS REACHABILITY ─────────────────────────────────────────
  it('Every KARMA_ACTIONS entry can be applied without producing NaN/Infinity', () => {
    let k = INITIAL_KARMA;
    let week = 1;
    for (const action of Object.values(KARMA_ACTIONS)) {
      k = applyKarmaChange(k, action.dimension, action.amount, action.reason, week++);
      const issues = deepCheck(k);
      expect(issues).toEqual([]);
    }
  });

  // ── EXTREME CHAINING ────────────────────────────────────────────────────
  it('500 random karma changes keep state JSON-safe and in [-100, 100]', () => {
    let k = INITIAL_KARMA;
    const dimensions: (keyof typeof k.dimensions)[] = ['generosity', 'honesty', 'violence', 'loyalty', 'ambition'];
    for (let i = 0; i < 500; i++) {
      const d = dimensions[i % dimensions.length];
      const amt = (Math.random() - 0.5) * 100; // ±50 input (clamped to ±20)
      k = applyKarmaChange(k, d, amt, `r${i}`, i);
    }
    for (const v of Object.values(k.dimensions)) {
      expect(v).toBeGreaterThanOrEqual(-100);
      expect(v).toBeLessThanOrEqual(100);
    }
    expect(k.score).toBeGreaterThanOrEqual(-100);
    expect(k.score).toBeLessThanOrEqual(100);
    expect(k.history.length).toBeLessThanOrEqual(50);
    expect(deepCheck(k)).toEqual([]);
  });
});
