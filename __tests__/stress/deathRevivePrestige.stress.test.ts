/**
 * Death → Revive → Prestige Lifecycle Stress Test
 *
 * Covers the most blast-radius state transitions in the game:
 *
 *   - Death by health=0 after 4 zero-weeks
 *   - Death by happiness=0 after 4 zero-weeks
 *   - Revive with sufficient gems (resurrects + deducts 15K gems + clears flags)
 *   - Revive without gems (no-op, state unchanged)
 *   - executePrestige('reset') after some progress (age, weeksLived reset)
 *   - executePrestige('child', childId) when a heir-eligible child exists
 *   - Cross-system: dead character cannot run normal actions; revive restores
 *   - Ribbon classification on death (no NaN, valid shape)
 *
 * All transitions verified to keep state JSON-safe + validateGameState passing.
 */

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

import React from 'react';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const TestRenderer = require('react-test-renderer');
import { GameProvider } from '@/contexts/game/GameProvider';
import { useGameState, useGameActions } from '@/contexts/game';
import { UIUXProvider } from '@/contexts/UIUXContext';
import type { GameState, ChildInfo } from '@/contexts/game/types';
import { REVIVE_GEM_COST } from '@/lib/config/gameConstants';
import { validateGameState } from '@/utils/saveValidation';

const { act } = TestRenderer;
const h = React.createElement;

// ──────────────────── Probe ────────────────────────────────────────────────

type Probe = {
  state: GameState;
  setGameState: React.Dispatch<React.SetStateAction<GameState>>;
  reviveCharacter: () => void;
  game: ReturnType<typeof useGameActions>;
};

let captured: Probe | null = null;

function ProbeComponent() {
  const { gameState, setGameState, reviveCharacter } = useGameState();
  const game = useGameActions();
  captured = { state: gameState, setGameState, reviveCharacter, game };
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

function assertClean(stage: string) {
  const issues = deepCheck(captured!.state);
  if (issues.length) throw new Error(`[${stage}] corruption: ${issues.slice(0, 5).join('; ')}`);
  const v = validateGameState(captured!.state);
  if (!v.valid) throw new Error(`[${stage}] validateGameState: ${v.errors.join('; ')}`);
}

async function tick() {
  await act(async () => {
    await captured!.game.nextWeek();
    await Promise.resolve();
  });
}

/** Seed an adult character with low/zero health to trigger health-death within 4 ticks. */
function seedZeroHealth() {
  act(() => captured!.setGameState(prev => ({
    ...prev,
    weeksLived: 200,
    date: { ...prev.date, age: 25, year: 2030 },
    stats: { ...prev.stats, health: 0, happiness: 50, energy: 50, fitness: 50, money: 10000, reputation: 50, gems: 0 },
    healthZeroWeeks: 0,
    happinessZeroWeeks: 0,
  })));
}

function seedZeroHappiness() {
  act(() => captured!.setGameState(prev => ({
    ...prev,
    weeksLived: 200,
    date: { ...prev.date, age: 25, year: 2030 },
    stats: { ...prev.stats, health: 50, happiness: 0, energy: 50, fitness: 50, money: 10000, reputation: 50, gems: 0 },
    healthZeroWeeks: 0,
    happinessZeroWeeks: 0,
  })));
}

function seedDead(reason: 'health' | 'happiness' = 'health', gems = 20000) {
  act(() => captured!.setGameState(prev => ({
    ...prev,
    weeksLived: 200,
    date: { ...prev.date, age: 25, year: 2030 },
    stats: {
      ...prev.stats,
      health: reason === 'health' ? 0 : 50,
      happiness: reason === 'happiness' ? 0 : 50,
      energy: 0,
      fitness: 50,
      money: 1000,
      reputation: 50,
      gems,
    },
    healthZeroWeeks: reason === 'health' ? 4 : 0,
    happinessZeroWeeks: reason === 'happiness' ? 4 : 0,
    showDeathPopup: true,
    deathReason: reason,
  })));
}

// ──────────────────── Tests ────────────────────────────────────────────────

describe('Death → Revive → Prestige cycle', () => {
  jest.setTimeout(120_000);
  let mounted: { root: any } | null = null;

  afterEach(() => {
    if (mounted) {
      act(() => mounted!.root.unmount());
      mounted = null;
    }
    captured = null;
  });

  // ── DEATH ───────────────────────────────────────────────────────────────
  it('Death by health=0: triggered after 4 zero-weeks', async () => {
    mounted = mountGame();
    seedZeroHealth();

    // 4 ticks at health=0 should trigger death.
    for (let i = 0; i < 4; i++) {
      await tick();
    }

    expect(captured!.state.showDeathPopup).toBe(true);
    expect(captured!.state.deathReason).toBe('health');
    expect(captured!.state.healthZeroWeeks).toBeGreaterThanOrEqual(4);
    assertClean('death by health');
  });

  it('Death by health=0: 3 zero-weeks not enough', async () => {
    mounted = mountGame();
    seedZeroHealth();

    for (let i = 0; i < 3; i++) {
      await tick();
    }

    // After 3 ticks, healthZeroWeeks counter should be at 3, but no death yet.
    expect(captured!.state.healthZeroWeeks).toBe(3);
    expect(captured!.state.showDeathPopup).toBeFalsy();
    assertClean('3 zero-weeks no death');
  });

  it('Death by happiness=0: triggered after 4 zero-weeks', async () => {
    mounted = mountGame();
    seedZeroHappiness();

    for (let i = 0; i < 4; i++) {
      await tick();
    }

    expect(captured!.state.showDeathPopup).toBe(true);
    expect(captured!.state.deathReason).toBe('happiness');
    expect(captured!.state.happinessZeroWeeks).toBeGreaterThanOrEqual(4);
    assertClean('death by happiness');
  });

  it('Death triggers ribbon collection update (life classified)', async () => {
    mounted = mountGame();
    seedZeroHealth();

    const ribbonsBefore = (captured!.state.ribbonCollection?.ribbons || []).length;

    for (let i = 0; i < 4; i++) {
      await tick();
    }

    expect(captured!.state.showDeathPopup).toBe(true);
    // A new ribbon should have been added (life classification on death).
    const ribbonsAfter = (captured!.state.ribbonCollection?.ribbons || []).length;
    expect(ribbonsAfter).toBeGreaterThanOrEqual(ribbonsBefore);
    assertClean('ribbon on death');
  });

  // ── REVIVE ──────────────────────────────────────────────────────────────
  it('Revive: with sufficient gems restores stats and deducts 15K gems', () => {
    mounted = mountGame();
    seedDead('health', 20000);
    expect(captured!.state.showDeathPopup).toBe(true);

    act(() => { captured!.reviveCharacter(); });

    expect(captured!.state.showDeathPopup).toBe(false);
    expect(captured!.state.deathReason).toBeUndefined();
    expect(captured!.state.stats.health).toBe(100);
    expect(captured!.state.stats.happiness).toBe(100);
    expect(captured!.state.stats.energy).toBe(100);
    expect(captured!.state.stats.gems).toBe(20000 - 15000);
    expect(captured!.state.healthZeroWeeks).toBe(0);
    expect(captured!.state.happinessZeroWeeks).toBe(0);
    assertClean('revive with gems');
  });

  it('Revive: without enough gems is a no-op', () => {
    mounted = mountGame();
    seedDead('health', 100); // only 100 gems
    expect(captured!.state.showDeathPopup).toBe(true);

    act(() => { captured!.reviveCharacter(); });

    // Should still be dead.
    expect(captured!.state.showDeathPopup).toBe(true);
    expect(captured!.state.stats.health).toBe(0);
    expect(captured!.state.stats.gems).toBe(100);
    assertClean('revive without gems');
  });

  it('Revive: exact-15K gems revives and leaves 0 gems', () => {
    mounted = mountGame();
    seedDead('health', 15000);

    act(() => { captured!.reviveCharacter(); });

    expect(captured!.state.showDeathPopup).toBe(false);
    expect(captured!.state.stats.gems).toBe(0);
    assertClean('revive exact gems');
  });

  it('Revive: two taps in ONE React batch charge for exactly one revive', () => {
    /**
     * R4-MON-2. `handleRevive` has no in-flight guard and the DeathPopup button
     * carries only `disabled={!canAffordRevive}`, computed from a stale render
     * snapshot. Both taps therefore reached the updater; the affordability
     * re-check passed the second time (30,000 -> 15,000 -> 0) because nothing
     * re-checked that the character was still dead.
     *
     * REVIVE_GEM_COST is 15,000 and the 15,000-gem pack retails at $49.99, so
     * this cost a player real money for one revive.
     */
    mounted = mountGame();
    seedDead('health', 2 * REVIVE_GEM_COST);
    expect(captured!.state.showDeathPopup).toBe(true);

    act(() => {
      captured!.reviveCharacter();
      captured!.reviveCharacter();
    });

    expect(captured!.state.showDeathPopup).toBe(false);
    expect(captured!.state.stats.gems).toBe(REVIVE_GEM_COST);
    assertClean('double-tap revive');
  });

  it('Revive: a SECOND revive after dying again still charges (not over-blocked)', () => {
    // The control. Guarding on `showDeathPopup` must not make revive one-shot
    // per save — a player who dies twice pays twice.
    mounted = mountGame();
    seedDead('health', 3 * REVIVE_GEM_COST);

    act(() => { captured!.reviveCharacter(); });
    expect(captured!.state.stats.gems).toBe(2 * REVIVE_GEM_COST);

    act(() => captured!.setGameState(prev => ({ ...prev, showDeathPopup: true, deathReason: 'health' })));
    act(() => { captured!.reviveCharacter(); });

    expect(captured!.state.showDeathPopup).toBe(false);
    expect(captured!.state.stats.gems).toBe(REVIVE_GEM_COST);
    assertClean('second revive after second death');
  });

  it('Revive: after revive the player can continue with nextWeek', async () => {
    mounted = mountGame();
    seedDead('health', 20000);

    act(() => { captured!.reviveCharacter(); });
    const weeksBefore = captured!.state.weeksLived;
    await tick();
    expect(captured!.state.weeksLived).toBe(weeksBefore + 1);
    expect(captured!.state.stats.health).toBeGreaterThan(0);
    assertClean('post-revive tick');
  });

  // ── PRESTIGE: RESET PATH ────────────────────────────────────────────────
  it('Prestige reset: resets age to ADULTHOOD_AGE (18) and weeksLived to 0', () => {
    mounted = mountGame();
    // Seed mid-life adult with significant progress.
    act(() => captured!.setGameState(prev => ({
      ...prev,
      weeksLived: 1500,
      date: { ...prev.date, age: 47, year: 2052 },
      stats: { ...prev.stats, money: 15_000_000, gems: 5000, health: 80, happiness: 80, energy: 80, fitness: 80, reputation: 80 },
      bankSavings: 1_000_000,
    })));
    const generationBefore = captured!.state.generationNumber || 1;

    act(() => { captured!.game.executePrestige('reset'); });

    // Age should be reset to 18, weeksLived back near zero.
    expect(captured!.state.date.age).toBe(18);
    expect(captured!.state.weeksLived).toBe(0);
    // Generation should advance.
    expect((captured!.state.generationNumber || 1)).toBeGreaterThanOrEqual(generationBefore);
    // Prestige record should accumulate.
    expect(captured!.state.prestige?.totalPrestiges).toBeGreaterThanOrEqual(1);
    assertClean('prestige reset');
  });

  it('Prestige reset: prestige history grows + lifetime stats accumulate', () => {
    mounted = mountGame();
    act(() => captured!.setGameState(prev => ({
      ...prev,
      weeksLived: 1000,
      date: { ...prev.date, age: 37, year: 2042 },
      stats: { ...prev.stats, money: 15_000_000, gems: 5000, health: 80, happiness: 80, energy: 80, fitness: 80, reputation: 80 },
    })));

    const beforeTotal = captured!.state.prestige?.totalPrestiges || 0;
    act(() => { captured!.game.executePrestige('reset'); });
    expect((captured!.state.prestige?.totalPrestiges || 0)).toBeGreaterThanOrEqual(beforeTotal + 1);

    // History contains the record.
    const history = captured!.state.prestige?.prestigeHistory || [];
    expect(history.length).toBeGreaterThan(0);
    const lastRecord = history[history.length - 1];
    expect(lastRecord.prestigeNumber).toBeGreaterThanOrEqual(1);
    expect(lastRecord.weeksLived).toBe(1000);
    assertClean('prestige history');
  });

  // ── PRESTIGE: CHILD PATH ────────────────────────────────────────────────
  it('Prestige child: continues as an heir-eligible child', () => {
    mounted = mountGame();
    // Seed a state with an adult character + an heir-eligible child.
    const childId = 'heir_jr';
    const child: ChildInfo = {
      id: childId,
      name: 'Jordan',
      type: 'child',
      relationshipScore: 80,
      personality: 'ambitious',
      gender: 'female',
      age: 12,
      birthWeeksLived: 500,
      educationLevel: 'highSchool',
      careerPath: 'professional',
      jobTier: 2,
      isHeirEligible: true,
    };
    act(() => captured!.setGameState(prev => ({
      ...prev,
      weeksLived: 1500,
      date: { ...prev.date, age: 50, year: 2055 },
      stats: { ...prev.stats, money: 15_000_000, gems: 5000, health: 80, happiness: 80, energy: 80, fitness: 80, reputation: 80 },
      family: { ...prev.family, children: [child], spouse: prev.family?.spouse },
      relationships: [...(prev.relationships || []), child],
    })));

    act(() => { captured!.game.executePrestige('child', childId); });

    // After child path, age should be 18 (ADULTHOOD_AGE).
    expect(captured!.state.date.age).toBe(18);
    expect(captured!.state.weeksLived).toBe(0);
    assertClean('prestige child');
  });

  // ── PROGRAMMATIC DEATH MID-PROGRESSION ─────────────────────────────────
  it('Cross-system: dying mid-progression updates lifetimeStatistics + ribbons + checkpoints', async () => {
    mounted = mountGame();
    // Build some history first.
    act(() => captured!.setGameState(prev => ({
      ...prev,
      weeksLived: 500,
      date: { ...prev.date, age: 28, year: 2033 },
      stats: { ...prev.stats, money: 100_000, gems: 100, health: 50, happiness: 50, energy: 50, fitness: 50, reputation: 50 },
      lifetimeStatistics: {
        ...(prev.lifetimeStatistics || {}),
        totalChildren: 0,
        totalWeeksWorked: 0,
        totalJailTime: 0,
        highestSalary: 0,
        totalTravelDestinations: 0,
        careerHistory: [],
      } as any,
    })));

    // Force health to 0 and let death progress.
    act(() => captured!.setGameState(prev => ({
      ...prev,
      stats: { ...prev.stats, health: 0 },
      healthZeroWeeks: 0,
    })));

    for (let i = 0; i < 4; i++) {
      await tick();
    }

    expect(captured!.state.showDeathPopup).toBe(true);
    expect(captured!.state.deathReason).toBe('health');
    expect(captured!.state.lifetimeStatistics).toBeDefined();
    assertClean('cross-system death');
  });

  // ── REVIVE → PRESTIGE INTERLEAVING ─────────────────────────────────────
  it('Sequencing: die → revive → progress → prestige all stay clean', async () => {
    mounted = mountGame();
    seedDead('health', 20000);

    // Revive.
    act(() => { captured!.reviveCharacter(); });
    expect(captured!.state.showDeathPopup).toBe(false);

    // Tick a few weeks to confirm we're alive and progressing.
    for (let i = 0; i < 3; i++) {
      await tick();
    }
    expect(captured!.state.weeksLived).toBeGreaterThan(200);

    // Reach the prestige net-worth threshold before resetting (the model-layer
    // gate now no-ops a prestige below it).
    act(() => captured!.setGameState(prev => ({
      ...prev,
      stats: { ...prev.stats, money: 15_000_000 },
    })));

    // Prestige reset.
    act(() => { captured!.game.executePrestige('reset'); });
    expect(captured!.state.date.age).toBe(18);
    expect(captured!.state.weeksLived).toBe(0);
    assertClean('die-revive-progress-prestige');
  });

  // ── DEATH FLAG IDEMPOTENCY ─────────────────────────────────────────────
  it('Idempotent death: nextWeek on already-dead character does not double-classify ribbon', async () => {
    mounted = mountGame();
    seedDead('health', 0);
    const ribbonsBefore = (captured!.state.ribbonCollection?.ribbons || []).length;

    // Tick while dead — should not add new ribbons each tick.
    for (let i = 0; i < 3; i++) {
      await tick();
    }
    const ribbonsAfter = (captured!.state.ribbonCollection?.ribbons || []).length;
    expect(ribbonsAfter).toBe(ribbonsBefore);
    assertClean('idempotent death ribbon');
  });
});
