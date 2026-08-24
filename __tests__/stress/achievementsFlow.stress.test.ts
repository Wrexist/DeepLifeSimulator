/**
 * Achievement / Progress audit
 *
 * The achievement system has 137 entries with custom `current()` / `met()`
 * accessors that touch every corner of GameState. A single accessor returning
 * NaN or throwing brings the whole eval down. This file:
 *
 *   - Calls every accessor on the canonical initialGameState (no crash)
 *   - Calls every accessor on a fat populated state (no NaN, no Infinity)
 *   - Verifies counter goals are positive numbers
 *   - Verifies boolean `met()` returns strict boolean
 *   - Tests claimProgressAchievement: gem grant + double-claim guard
 *   - Tests netWorth() over edge cases (zero, MAX_SAFE_INTEGER, NaN inputs)
 *   - Tests evaluateAchievements() doesn't double-report already-claimed
 *   - Cross-system: 50 nextWeek ticks with achievement counters live
 */

import React from 'react';
import { GameProvider } from '@/contexts/game/GameProvider';
import { useGameState, useGameActions } from '@/contexts/game';
import { UIUXProvider } from '@/contexts/UIUXContext';
import type { GameState, Relationship } from '@/contexts/game/types';
import { initialGameState } from '@/contexts/game/initialState';
import { netWorth, evaluateAchievements } from '@/lib/progress/achievements';
import { achievements } from '@/src/features/onboarding/achievementsData';
import { validateGameState } from '@/utils/saveValidation';
import { makeRealEstate } from '../helpers/makeRealEstate';

jest.mock('@/utils/saveQueue', () => ({
  saveQueue: {
    addToQueue: jest.fn().mockResolvedValue(undefined),
    forceSave: jest.fn().mockResolvedValue(undefined),
    flushQueue: jest.fn().mockResolvedValue(undefined),
    restoreOnStartup: jest.fn().mockResolvedValue(undefined),
    setToastCallback: jest.fn(),
    getStatus: jest.fn(() => ({ queueLength: 0, isProcessing: false })),
  },
  queueSave: jest.fn().mockResolvedValue(undefined),
  forceSave: jest.fn().mockResolvedValue(undefined),
}));
// eslint-disable-next-line @typescript-eslint/no-require-imports
const TestRenderer = require('react-test-renderer');

const { act } = TestRenderer;
const h = React.createElement;

// ──────────────────── Probe ────────────────────────────────────────────────

type Probe = {
  state: GameState;
  setGameState: React.Dispatch<React.SetStateAction<GameState>>;
  game: ReturnType<typeof useGameActions>;
};

let captured: Probe | null = null;

function ProbeComponent() {
  const { gameState, setGameState } = useGameState();
  const game = useGameActions();
  captured = { state: gameState, setGameState, game };
  return null;
}

function mountGame() {
  captured = null;
  let root: any;
  act(() => {
    root = TestRenderer.create(
      h(UIUXProvider as any, null, h(GameProvider as any, null, h(ProbeComponent)))
    );
  });
  return { root };
}

function freshState(): GameState {
  return structuredClone(initialGameState);
}

function deepCheck(state: unknown, path = 'root'): string[] {
  const issues: string[] = [];
  const seen = new WeakSet();
  const walk = (v: unknown, p: string) => {
    if (v === null || v === undefined) return;
    if (typeof v === 'number') {
      if (Number.isNaN(v)) issues.push(`NaN at ${p}`);
      if (!Number.isFinite(v)) issues.push(`Infinity at ${p}`);
      return;
    }
    if (typeof v === 'function') { issues.push(`function at ${p}`); return; }
    if (typeof v === 'object') {
      const obj = v as object;
      if (seen.has(obj)) return;
      seen.add(obj);
      if (Array.isArray(obj)) obj.forEach((x, i) => walk(x, `${p}[${i}]`));
      else for (const k of Object.keys(obj)) walk((obj as Record<string, unknown>)[k], `${p}.${k}`);
    }
  };
  walk(state, path);
  return issues;
}

/** Build a maximally populated state to stress every accessor. */
function fatState(): GameState {
  const s = freshState();
  s.stats = { ...s.stats, money: 50_000_000, gems: 100_000, health: 95, happiness: 90, energy: 85, fitness: 80, reputation: 75 };
  s.bankSavings = 10_000_000;
  s.weeksLived = 2500;
  s.date = { ...s.date, age: 65, year: 2070 };
  s.streetJobsCompleted = 50;
  s.criminalLevel = 5;
  s.criminalXp = 200;
  // `totalCrimesCommitted` lives on `lifetimeStatistics`, not the GameState root.
  // Writing it at the root did nothing at all - the "maximally populated" state
  // this helper promises was silently missing the field, so anything reading it
  // was exercised against 0. Found by type-checking the test tree for the first
  // time (2026-07-30 audit ARCH-2).
  s.lifetimeStatistics = { ...(s.lifetimeStatistics ?? {}), totalCrimesCommitted: 100 } as never;
  s.relationships = Array.from({ length: 15 }, (_, i) => ({
    id: `rel-${i}`, name: `Friend ${i}`, type: 'friend' as const,
    relationshipScore: 75 + (i % 25), personality: 'kind', gender: i % 2 ? 'male' : 'female' as const,
    age: 30 + i,
  } as Relationship));
  s.family = {
    ...s.family,
    children: Array.from({ length: 3 }, (_, i) => ({
      id: `child-${i}`, name: `Child ${i}`, type: 'child' as const,
      relationshipScore: 90, personality: 'playful', gender: 'female' as const, age: 10 + i,
    })) as never,
  };
  (s.items || []).forEach(item => { item.owned = true; });
  s.companies = [{
    id: 'co-1', type: 'ai' as never, name: 'AI Corp',
    employees: 100, money: 500_000, weeklyIncome: 50_000, baseWeeklyIncome: 30_000,
    upgrades: ['u1', 'u2'], workerSalary: 200, workerMultiplier: 1.5,
    marketingLevel: 5, miners: {}, warehouseLevel: 3,
  } as never];
  s.stocks = {
    holdings: [{ symbol: 'TECH', shares: 1000, averagePrice: 100, currentPrice: 200 }],
    watchlist: [],
  } as never;
  s.realEstate = [makeRealEstate({
    id: 'home', name: 'Home',
    price: 500_000, currentValue: 600_000,
    upkeep: 1000, purchasedWeek: 100, upgradeLevel: 2,
  })];
  return s;
}

// ──────────────────── Tests ────────────────────────────────────────────────


/**
 * Remove keys from a state the way a truncated or hand-edited save would, so
 * the accessors below face genuinely absent collections.
 *
 * Ten `delete (state as Record<string, unknown>).field` lines used to do this
 * inline. Two problems with that shape, beyond the ten casts: the assertion
 * `as Record<string, unknown>` is one TypeScript rejects outright (GameState
 * has no index signature), and - worse - a MISTYPED field name would delete
 * nothing at all, silently leaving the state intact while the test went on to
 * "prove" every accessor survives a stripping that never happened.
 *
 * `keyof GameState` makes a typo a compile error, and the single unavoidable
 * cast lives here rather than at each call.
 */
function stripFields(state: GameState, ...keys: (keyof GameState)[]): GameState {
  const bag = state as unknown as Record<string, unknown>;
  for (const key of keys) delete bag[key as string];
  return state;
}

describe('Achievement / Progress audit', () => {
  jest.setTimeout(120_000);
  let mounted: { root: any } | null = null;

  afterEach(() => {
    if (mounted) {
      act(() => mounted!.root.unmount());
      mounted = null;
    }
    captured = null;
  });

  // ── REGISTRY SANITY ────────────────────────────────────────────────────
  it('Registry: every achievement has id, title, description, progressSpec, goldReward', () => {
    expect(achievements.length).toBeGreaterThan(10);
    const ids = new Set<string>();
    for (const a of achievements) {
      expect(typeof a.id).toBe('string');
      expect(a.id.length).toBeGreaterThan(0);
      expect(typeof a.title).toBe('string');
      expect(typeof a.description).toBe('string');
      expect(a.progressSpec).toBeDefined();
      expect(['boolean', 'counter']).toContain(a.progressSpec.kind);
      expect(typeof a.goldReward).toBe('number');
      expect(a.goldReward).toBeGreaterThanOrEqual(0);

      // Counter achievements must have positive goal.
      if (a.progressSpec.kind === 'counter') {
        expect(a.progressSpec.goal).toBeGreaterThan(0);
        expect(Number.isFinite(a.progressSpec.goal)).toBe(true);
      }

      // No duplicate IDs.
      expect(ids.has(a.id)).toBe(false);
      ids.add(a.id);
    }
  });

  // ── ACCESSOR SAFETY: fresh state ───────────────────────────────────────
  it('All accessors handle a fresh state without throwing or returning NaN/Infinity', () => {
    const state = freshState();
    const failures: { id: string; error: string }[] = [];

    for (const a of achievements) {
      try {
        if (a.progressSpec.kind === 'counter') {
          const v = a.progressSpec.current(state);
          if (typeof v !== 'number') failures.push({ id: a.id, error: `current() returned ${typeof v}` });
          else if (!Number.isFinite(v)) failures.push({ id: a.id, error: `current()=${v} (non-finite)` });
        } else {
          const v = a.progressSpec.met(state);
          if (typeof v !== 'boolean') failures.push({ id: a.id, error: `met() returned ${typeof v}` });
        }
      } catch (e) {
        failures.push({ id: a.id, error: e instanceof Error ? e.message : String(e) });
      }
    }

    if (failures.length) {
      throw new Error(`Achievements that broke on fresh state:\n${failures.map(f => `  ${f.id}: ${f.error}`).join('\n')}`);
    }
  });

  // ── ACCESSOR SAFETY: fat state ─────────────────────────────────────────
  it('All accessors handle a fat populated state cleanly', () => {
    const state = fatState();
    const failures: { id: string; error: string }[] = [];

    for (const a of achievements) {
      try {
        if (a.progressSpec.kind === 'counter') {
          const v = a.progressSpec.current(state);
          if (!Number.isFinite(v) || Number.isNaN(v)) failures.push({ id: a.id, error: `current()=${v}` });
        } else {
          a.progressSpec.met(state);
        }
      } catch (e) {
        failures.push({ id: a.id, error: e instanceof Error ? e.message : String(e) });
      }
    }

    if (failures.length) {
      throw new Error(`Accessors broke on fat state:\n${failures.map(f => `  ${f.id}: ${f.error}`).join('\n')}`);
    }
  });

  // ── ACCESSOR SAFETY: null/undefined-laden state ────────────────────────
  it('All accessors survive a state where every optional collection is undefined', () => {
    // Defensively strip the fields most accessors guard against.
    const STRIPPED = [
      'relationships', 'items', 'companies', 'stocks', 'realEstate',
      'family', 'achievements', 'hobbies', 'careers', 'educations',
    ] as const;
    const state = stripFields(freshState(), ...STRIPPED);

    // The strip is the whole premise, so check it happened. Without this the
    // suite passes identically against a state that was never touched — which
    // is exactly what a mistyped key used to produce, silently.
    for (const key of STRIPPED) {
      expect(`${key}: ${key in (state as unknown as Record<string, unknown>)}`)
        .toBe(`${key}: false`);
    }

    const failures: { id: string; error: string }[] = [];
    for (const a of achievements) {
      try {
        if (a.progressSpec.kind === 'counter') {
          const v = a.progressSpec.current(state);
          if (!Number.isFinite(v) || Number.isNaN(v)) failures.push({ id: a.id, error: `current()=${v}` });
        } else {
          a.progressSpec.met(state);
        }
      } catch (e) {
        failures.push({ id: a.id, error: e instanceof Error ? e.message : String(e) });
      }
    }
    if (failures.length) {
      throw new Error(`Accessors broke on stripped state:\n${failures.map(f => `  ${f.id}: ${f.error}`).join('\n')}`);
    }
  });

  // ── NETWORTH FUNCTION ──────────────────────────────────────────────────
  it('netWorth: returns finite + non-negative for fresh state', () => {
    const v = netWorth(freshState());
    expect(Number.isFinite(v)).toBe(true);
    expect(v).toBeGreaterThanOrEqual(0);
  });

  it('netWorth: returns finite + non-negative for fat state', () => {
    const v = netWorth(fatState());
    expect(Number.isFinite(v)).toBe(true);
    expect(v).toBeGreaterThanOrEqual(0);
    expect(v).toBeLessThan(Number.MAX_SAFE_INTEGER);
  });

  it('netWorth: NaN inputs are sanitized (no NaN escape)', () => {
    const state = freshState();
    state.stats.money = NaN as never;
    state.bankSavings = NaN as never;
    const v = netWorth(state);
    expect(Number.isFinite(v)).toBe(true);
    expect(v).toBeGreaterThanOrEqual(0);
  });

  it('netWorth: extreme inputs near MAX_SAFE_INTEGER are clamped, not overflowed', () => {
    const state = freshState();
    state.stats.money = Number.MAX_SAFE_INTEGER;
    state.bankSavings = Number.MAX_SAFE_INTEGER;
    const v = netWorth(state);
    expect(Number.isFinite(v)).toBe(true);
    expect(v).toBeLessThanOrEqual(Number.MAX_SAFE_INTEGER);
    expect(v).toBeGreaterThanOrEqual(0);
  });

  // ── EVALUATE ACHIEVEMENTS ──────────────────────────────────────────────
  it('evaluateAchievements: returns an array even for fresh state', () => {
    const result = evaluateAchievements(freshState());
    expect(Array.isArray(result)).toBe(true);
  });

  it('evaluateAchievements: hides already-claimed achievements', () => {
    const state = freshState();
    // Force every legacy ID into claimed list.
    state.claimedProgressAchievements = ['first_million', 'debt_free', 'healthy_lifestyle', 'social_star', 'politician_legend', 'celebrity_icon', 'athletic_champion'];
    // Make the player a billionaire so first_million would otherwise fire.
    state.stats.money = 1_000_000_000;
    state.bankSavings = 0;
    const result = evaluateAchievements(state);
    // None of the explicitly-claimed legacy IDs should be returned.
    for (const a of result) {
      expect(state.claimedProgressAchievements).not.toContain(a.id);
    }
  });

  // ── CLAIM FLOW ─────────────────────────────────────────────────────────
  it('claimProgressAchievement: grants gold reward + records claim', async () => {
    mounted = mountGame();
    const gemsBefore = captured!.state.stats.gems || 0;
    const claimedBefore = (captured!.state.claimedProgressAchievements || []).length;
    await act(async () => { await captured!.game.claimProgressAchievement('beginner_first_gig', 10); });
    expect((captured!.state.claimedProgressAchievements || []).length).toBeGreaterThan(claimedBefore);
    expect(captured!.state.claimedProgressAchievements).toContain('beginner_first_gig');
    expect(captured!.state.stats.gems).toBe(gemsBefore + 10);
    expect(captured!.state.achievementUnlocks?.['beginner_first_gig']).toBeDefined();
  });

  it('claimProgressAchievement: double-claim is a no-op (no double gold)', async () => {
    mounted = mountGame();
    await act(async () => { await captured!.game.claimProgressAchievement('beginner_first_gig', 10); });
    const gemsAfterFirst = captured!.state.stats.gems || 0;

    // Second claim — must not re-grant.
    await act(async () => { await captured!.game.claimProgressAchievement('beginner_first_gig', 10); });
    expect(captured!.state.stats.gems).toBe(gemsAfterFirst);
    // Claimed list contains exactly one entry of the id.
    const count = (captured!.state.claimedProgressAchievements || []).filter(id => id === 'beginner_first_gig').length;
    expect(count).toBe(1);
  });

  it('claimProgressAchievement: lifetimeStatistics.totalAchievementsUnlocked increments', async () => {
    mounted = mountGame();
    const before = captured!.state.lifetimeStatistics?.totalAchievementsUnlocked ?? 0;
    await act(async () => { await captured!.game.claimProgressAchievement('beginner_triple_digits', 5); });
    expect((captured!.state.lifetimeStatistics?.totalAchievementsUnlocked ?? 0)).toBe(before + 1);
  });

  // ── CROSS-LIFE GEM-MINT GUARD (anti-farm regression) ────────────────────
  // Prestige clears the per-life claimedProgressAchievements but PRESERVES
  // stats.gems and prestige.claimedAchievementIds. The gem mint must be
  // one-time-EVER, keyed off the preserved cross-life set — otherwise every
  // prestige cycle re-mints the same achievement's gems.
  it('claimProgressAchievement: first-ever claim stamps prestige.claimedAchievementIds', async () => {
    mounted = mountGame();
    expect(captured!.state.prestige?.claimedAchievementIds || []).not.toContain('beginner_first_gig');
    await act(async () => { await captured!.game.claimProgressAchievement('beginner_first_gig', 10); });
    expect(captured!.state.prestige?.claimedAchievementIds || []).toContain('beginner_first_gig');
  });

  it('claimProgressAchievement: re-claim after prestige clears per-life claims does NOT re-mint gems', async () => {
    mounted = mountGame();
    // First claim in this life mints gems and stamps the cross-life set.
    await act(async () => { await captured!.game.claimProgressAchievement('beginner_first_gig', 10); });
    const gemsAfterFirst = captured!.state.stats.gems || 0;
    expect(captured!.state.prestige?.claimedAchievementIds || []).toContain('beginner_first_gig');

    // Simulate what prestige does: per-life claimedProgressAchievements is wiped,
    // but the preserved cross-life stamp (prestige.claimedAchievementIds) remains.
    act(() => {
      captured!.setGameState(prev => ({ ...prev, claimedProgressAchievements: [] }));
    });
    expect(captured!.state.claimedProgressAchievements).toEqual([]);

    // Re-claiming the SAME achievement records it per-life again (UI unchanged)
    // but must NOT mint gems a second time.
    await act(async () => { await captured!.game.claimProgressAchievement('beginner_first_gig', 10); });
    expect(captured!.state.stats.gems).toBe(gemsAfterFirst); // no re-mint
    expect(captured!.state.claimedProgressAchievements).toContain('beginner_first_gig');
  });

  // ── ACCESSORS PRODUCE EXPECTED VALUES ──────────────────────────────────
  it('Counter accessor: beginner_triple_digits goal = 100 fires when money >= 100', () => {
    const a = achievements.find(x => x.id === 'beginner_triple_digits')!;
    expect(a.progressSpec.kind).toBe('counter');
    const state = freshState();
    state.stats.money = 99;
    expect((a.progressSpec as { current: (gs: GameState) => number; goal: number }).current(state)).toBe(99);
    state.stats.money = 100;
    expect((a.progressSpec as { current: (gs: GameState) => number; goal: number }).current(state)).toBe(100);
  });

  it('Counter accessor: beginner_survivor fires at exactly 4 weeks lived', () => {
    const a = achievements.find(x => x.id === 'beginner_survivor')!;
    expect(a.progressSpec.kind).toBe('counter');
    const state = freshState();
    state.weeksLived = 4;
    expect((a.progressSpec as { current: (gs: GameState) => number; goal: number }).current(state)).toBeGreaterThanOrEqual(4);
  });

  it('Boolean accessor: beginner_connected fires when smartphone is owned', () => {
    const a = achievements.find(x => x.id === 'beginner_connected')!;
    expect(a.progressSpec.kind).toBe('boolean');
    const state = freshState();
    expect((a.progressSpec as { met: (gs: GameState) => boolean }).met(state)).toBe(false);
    state.items = state.items?.map(i => i.id === 'smartphone' ? { ...i, owned: true } : i);
    expect((a.progressSpec as { met: (gs: GameState) => boolean }).met(state)).toBe(true);
  });

  // ── CROSS-SYSTEM ───────────────────────────────────────────────────────
  it('Cross: 50 nextWeek ticks with achievement counters stay finite', async () => {
    mounted = mountGame();
    for (let i = 0; i < 50; i++) {
      await act(async () => { await captured!.game.nextWeek(); });
    }
    // Counter accessors should still return finite values on the live tickered state.
    const state = captured!.state;
    for (const a of achievements) {
      if (a.progressSpec.kind === 'counter') {
        const v = a.progressSpec.current(state);
        expect(Number.isFinite(v)).toBe(true);
        expect(v).toBeGreaterThanOrEqual(0);
      }
    }
    expect(validateGameState(state).valid).toBe(true);
  });

  // ── INVARIANT: ACHIEVEMENT UNLOCKS DON'T CORRUPT STATE ────────────────
  it('Invariant: claiming 5 achievements in a row keeps state JSON-safe', async () => {
    mounted = mountGame();
    const ids = ['beginner_first_gig', 'beginner_triple_digits', 'beginner_hustler', 'beginner_four_figures', 'beginner_survivor'];
    for (const id of ids) {
      await act(async () => { await captured!.game.claimProgressAchievement(id, 10); });
    }
    const issues = deepCheck(captured!.state);
    expect(issues).toEqual([]);
    expect((captured!.state.claimedProgressAchievements || []).length).toBeGreaterThanOrEqual(ids.length);
    // Each unique id appears at most once.
    const claimed = captured!.state.claimedProgressAchievements || [];
    expect(new Set(claimed).size).toBe(claimed.length);
  });
});
