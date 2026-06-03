/**
 * Hobby Flow Audit
 *
 * Covers `trainHobby` and `enterHobbyTournament`. These actions:
 *   - take the LIB-style dep signature (Signature Trap risk)
 *   - have a weekly training cap (5/wk per hobby)
 *   - level up via a 100-XP-per-level threshold
 *   - have probabilistic tournaments using deterministic RNG
 *   - apply prestige + gold-upgrade multipliers
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
import type { GameState, Hobby } from '@/contexts/game/types';
import { validateGameState } from '@/utils/saveValidation';

const { act } = TestRenderer;
const h = React.createElement;

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
    if (typeof v === 'function') { issues.push(`function at ${p}`); return; }
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

function assertClean(stage: string) {
  const issues = deepCheck(captured!.state);
  if (issues.length) throw new Error(`[${stage}] corruption: ${issues.slice(0, 5).join('; ')}`);
  const v = validateGameState(captured!.state);
  if (!v.valid) throw new Error(`[${stage}] validateGameState: ${v.errors.join('; ')}`);
}

function makeHobby(over: Partial<Hobby> & { id: string; name: string }): Hobby {
  return {
    description: '',
    energyCost: 10,
    skill: 0,
    skillLevel: 0,
    tournamentReward: 500,
    upgrades: [],
    ...over,
  };
}

function seedWithHobby(hobby: Partial<Hobby> & { id: string; name: string }) {
  act(() => captured!.setGameState(prev => ({
    ...prev,
    weeksLived: 100,
    date: { ...prev.date, age: 22, year: 2027 },
    stats: { ...prev.stats, money: 10_000, gems: 100, energy: 100, happiness: 80, health: 80, fitness: 50, reputation: 50 },
    hobbies: [...(prev.hobbies || []).filter(h => h.id !== hobby.id), makeHobby(hobby)],
  })));
}

function getHobby(id: string): Hobby | undefined {
  return (captured!.state.hobbies || []).find(h => h.id === id);
}

describe('Hobby flow audit', () => {
  jest.setTimeout(120_000);
  let mounted: { root: any } | null = null;

  afterEach(() => {
    if (mounted) {
      act(() => mounted!.root.unmount());
      mounted = null;
    }
    captured = null;
  });

  // ── TRAINHOBBY ─────────────────────────────────────────────────────────
  it('trainHobby: with LIB deps applies energy/happiness changes + bumps skill', async () => {
    mounted = mountGame();
    seedWithHobby({ id: 'guitar', name: 'Guitar', energyCost: 10 });
    const { trainHobby } = await import('@/contexts/game/actions/HobbyActions');
    const { updateStats: libUpdateStats } = await import('@/contexts/game/actions/StatsActions');

    const energyBefore = captured!.state.stats.energy;
    const happinessBefore = captured!.state.stats.happiness;
    const skillBefore = getHobby('guitar')!.skill;

    let result: { success: boolean; message: string } = { success: false, message: '' };
    act(() => { result = trainHobby(captured!.state, captured!.setGameState, 'guitar', { updateStats: libUpdateStats }); });

    expect(result.success).toBe(true);
    expect(captured!.state.stats.energy).toBe(energyBefore - 10);
    expect(captured!.state.stats.happiness).toBe(happinessBefore + 2);
    expect(getHobby('guitar')!.skill).toBeGreaterThan(skillBefore);
    assertClean('trainHobby happy path');
  });

  it('trainHobby: unknown hobbyId → structured error', async () => {
    mounted = mountGame();
    const { trainHobby } = await import('@/contexts/game/actions/HobbyActions');
    const { updateStats: libUpdateStats } = await import('@/contexts/game/actions/StatsActions');

    let result: { success: boolean; message: string } = { success: false, message: '' };
    act(() => { result = trainHobby(captured!.state, captured!.setGameState, 'fake_hobby', { updateStats: libUpdateStats }); });
    expect(result.success).toBe(false);
    expect(result.message).toMatch(/not found/i);
  });

  it('trainHobby: insufficient energy → rejected', async () => {
    mounted = mountGame();
    seedWithHobby({ id: 'piano', name: 'Piano', energyCost: 50 });
    act(() => captured!.setGameState(prev => ({ ...prev, stats: { ...prev.stats, energy: 30 } })));

    const { trainHobby } = await import('@/contexts/game/actions/HobbyActions');
    const { updateStats: libUpdateStats } = await import('@/contexts/game/actions/StatsActions');

    let result: { success: boolean; message: string } = { success: false, message: '' };
    act(() => { result = trainHobby(captured!.state, captured!.setGameState, 'piano', { updateStats: libUpdateStats }); });
    expect(result.success).toBe(false);
    expect(result.message).toMatch(/energy/i);
    // Energy unchanged.
    expect(captured!.state.stats.energy).toBe(30);
  });

  it('trainHobby: 6th training in same week rejected (cap=5)', async () => {
    mounted = mountGame();
    seedWithHobby({ id: 'cycling', name: 'Cycling', energyCost: 5 });
    const { trainHobby } = await import('@/contexts/game/actions/HobbyActions');
    const { updateStats: libUpdateStats } = await import('@/contexts/game/actions/StatsActions');

    let last: { success: boolean; message: string } | undefined;
    for (let i = 0; i < 6; i++) {
      act(() => { last = trainHobby(captured!.state, captured!.setGameState, 'cycling', { updateStats: libUpdateStats }); });
    }
    expect(last!.success).toBe(false);
    expect(last!.message).toMatch(/this week/i);
    // trainsThisWeek should be exactly 5 (not 6).
    expect(getHobby('cycling')!.trainsThisWeek).toBe(5);
  });

  it('trainHobby: level-up at 100 skill resets skill bar', async () => {
    mounted = mountGame();
    // Pre-skill the hobby to 95 so first training triggers level up.
    seedWithHobby({ id: 'chess', name: 'Chess', energyCost: 5, skill: 95, skillLevel: 0 });
    const { trainHobby } = await import('@/contexts/game/actions/HobbyActions');
    const { updateStats: libUpdateStats } = await import('@/contexts/game/actions/StatsActions');

    act(() => { trainHobby(captured!.state, captured!.setGameState, 'chess', { updateStats: libUpdateStats }); });

    const h = getHobby('chess')!;
    expect(h.skillLevel).toBe(1);
    expect(h.skill).toBeLessThan(100); // reset to remainder
    expect(h.skill).toBeGreaterThanOrEqual(0);
  });

  it('trainHobby: skill never exceeds bounds (long run with reset)', async () => {
    mounted = mountGame();
    seedWithHobby({ id: 'painting', name: 'Painting', energyCost: 5, skill: 0, skillLevel: 0 });
    const { trainHobby } = await import('@/contexts/game/actions/HobbyActions');
    const { updateStats: libUpdateStats } = await import('@/contexts/game/actions/StatsActions');

    // Train 5 times this week, advance weeksLived to reset cap, repeat.
    for (let week = 0; week < 20; week++) {
      act(() => captured!.setGameState(prev => ({
        ...prev,
        weeksLived: 100 + week,
        stats: { ...prev.stats, energy: 100 },
      })));
      for (let i = 0; i < 5; i++) {
        act(() => { trainHobby(captured!.state, captured!.setGameState, 'painting', { updateStats: libUpdateStats }); });
      }
    }

    const h = getHobby('painting')!;
    expect(Number.isFinite(h.skill)).toBe(true);
    expect(Number.isFinite(h.skillLevel)).toBe(true);
    expect(h.skill).toBeGreaterThanOrEqual(0);
    expect(h.skillLevel).toBeGreaterThan(0);
    assertClean('long-run hobby');
  });

  // ── SIGNATURE TRAP REGRESSION ──────────────────────────────────────────
  it('trainHobby: passing the WRONG updateStats signature does not crash (Signature Trap regression)', async () => {
    mounted = mountGame();
    seedWithHobby({ id: 'yoga', name: 'Yoga', energyCost: 10 });

    const { trainHobby } = await import('@/contexts/game/actions/HobbyActions');
    // Pass HOOK-style updateStats: signature `(newStats, updateDailySummary)`,
    // not lib-style `(setGameState, newStats, updateDailySummary)`. This is
    // the "DatingActions Signature Trap" — production code that passes the
    // hook version here would invoke deps.updateStats(setGameState, {...})
    // which the hook treats as `newStats = setGameState (a function)`.
    const fakeHookStats: never = ((_a: never, _b: never) => undefined) as never;

    // Should not throw — defensive code at deps invocation should swallow.
    let threw = false;
    try {
      act(() => { trainHobby(captured!.state, captured!.setGameState, 'yoga', { updateStats: fakeHookStats }); });
    } catch {
      threw = true;
    }
    // Either it works defensively, or it returns a structured error. It should NOT throw uncaught.
    expect(threw).toBe(false);
    // State must stay clean.
    expect(Number.isFinite(captured!.state.stats.energy)).toBe(true);
    expect(captured!.state.stats.energy).toBeGreaterThanOrEqual(0);
    expect(captured!.state.stats.energy).toBeLessThanOrEqual(100);
  });

  // ── TOURNAMENT ─────────────────────────────────────────────────────────
  it('enterHobbyTournament: with LIB deps drains 20 energy + returns result', async () => {
    mounted = mountGame();
    seedWithHobby({ id: 'tennis', name: 'Tennis', tournamentReward: 1000, skillLevel: 5 });
    const { enterHobbyTournament } = await import('@/contexts/game/actions/HobbyActions');
    const { updateMoney: libUpdateMoney } = await import('@/contexts/game/actions/MoneyActions');
    const { updateStats: libUpdateStats } = await import('@/contexts/game/actions/StatsActions');

    const energyBefore = captured!.state.stats.energy;
    let result: { success: boolean; message: string } = { success: false, message: '' };
    act(() => { result = enterHobbyTournament(captured!.state, captured!.setGameState, 'tennis', { updateMoney: libUpdateMoney, updateStats: libUpdateStats }); });

    expect(result).toBeDefined();
    expect(typeof result.success).toBe('boolean');
    expect(typeof result.message).toBe('string');
    expect(captured!.state.stats.energy).toBe(energyBefore - 20);
    assertClean('tournament');
  });

  it('enterHobbyTournament: insufficient energy → rejected, no energy drained', async () => {
    mounted = mountGame();
    seedWithHobby({ id: 'boxing', name: 'Boxing', tournamentReward: 800 });
    act(() => captured!.setGameState(prev => ({ ...prev, stats: { ...prev.stats, energy: 15 } })));

    const { enterHobbyTournament } = await import('@/contexts/game/actions/HobbyActions');
    const { updateMoney: libUpdateMoney } = await import('@/contexts/game/actions/MoneyActions');
    const { updateStats: libUpdateStats } = await import('@/contexts/game/actions/StatsActions');

    let result: { success: boolean; message: string } = { success: false, message: '' };
    act(() => { result = enterHobbyTournament(captured!.state, captured!.setGameState, 'boxing', { updateMoney: libUpdateMoney, updateStats: libUpdateStats }); });
    expect(result.success).toBe(false);
    expect(result.message).toMatch(/energy/i);
    expect(captured!.state.stats.energy).toBe(15);
  });

  it('enterHobbyTournament: unknown hobby returns structured error', async () => {
    mounted = mountGame();
    const { enterHobbyTournament } = await import('@/contexts/game/actions/HobbyActions');
    const { updateMoney: libUpdateMoney } = await import('@/contexts/game/actions/MoneyActions');
    const { updateStats: libUpdateStats } = await import('@/contexts/game/actions/StatsActions');

    let result: { success: boolean; message: string } = { success: false, message: '' };
    act(() => { result = enterHobbyTournament(captured!.state, captured!.setGameState, 'imaginary', { updateMoney: libUpdateMoney, updateStats: libUpdateStats }); });
    expect(result.success).toBe(false);
    expect(result.message).toMatch(/not found/i);
  });

  it('enterHobbyTournament: win probability deterministic given weeksLived+hobbyId', async () => {
    mounted = mountGame();
    seedWithHobby({ id: 'darts', name: 'Darts', tournamentReward: 200, skillLevel: 10 });
    const { enterHobbyTournament } = await import('@/contexts/game/actions/HobbyActions');
    const { updateMoney: libUpdateMoney } = await import('@/contexts/game/actions/MoneyActions');
    const { updateStats: libUpdateStats } = await import('@/contexts/game/actions/StatsActions');

    // First run: get a result at week 100.
    let firstResult: { success: boolean; message: string } = { success: false, message: '' };
    act(() => { firstResult = enterHobbyTournament(captured!.state, captured!.setGameState, 'darts', { updateMoney: libUpdateMoney, updateStats: libUpdateStats }); });
    const firstWon = firstResult.success;

    // Reset state to same starting conditions and re-run — deterministic RNG should produce same outcome.
    seedWithHobby({ id: 'darts', name: 'Darts', tournamentReward: 200, skillLevel: 10 });
    let secondResult: { success: boolean; message: string } = { success: false, message: '' };
    act(() => { secondResult = enterHobbyTournament(captured!.state, captured!.setGameState, 'darts', { updateMoney: libUpdateMoney, updateStats: libUpdateStats }); });
    const secondWon = secondResult.success;

    expect(firstWon).toBe(secondWon);
  });

  it('enterHobbyTournament: high skillLevel biases toward winning over many trials', async () => {
    mounted = mountGame();
    const { enterHobbyTournament } = await import('@/contexts/game/actions/HobbyActions');
    const { updateMoney: libUpdateMoney } = await import('@/contexts/game/actions/MoneyActions');
    const { updateStats: libUpdateStats } = await import('@/contexts/game/actions/StatsActions');

    let wins = 0;
    const trials = 20;
    // Each trial uses a different week (so the deterministic RNG produces different rolls).
    for (let i = 0; i < trials; i++) {
      act(() => captured!.setGameState(prev => ({
        ...prev,
        weeksLived: 100 + i,
        stats: { ...prev.stats, energy: 100 },
        hobbies: [makeHobby({ id: 'pro', name: 'Pro', tournamentReward: 500, skillLevel: 14 })],
      })));
      let res: { success: boolean; message: string } = { success: false, message: '' };
      act(() => { res = enterHobbyTournament(captured!.state, captured!.setGameState, 'pro', { updateMoney: libUpdateMoney, updateStats: libUpdateStats }); });
      if (res.success) wins++;
    }
    // winChance = 30 + 14*5 = 100% → expect close to 100%.
    expect(wins).toBeGreaterThanOrEqual(trials - 2);
  });

  it('enterHobbyTournament: low skillLevel biases toward losing over many trials', async () => {
    mounted = mountGame();
    const { enterHobbyTournament } = await import('@/contexts/game/actions/HobbyActions');
    const { updateMoney: libUpdateMoney } = await import('@/contexts/game/actions/MoneyActions');
    const { updateStats: libUpdateStats } = await import('@/contexts/game/actions/StatsActions');

    let wins = 0;
    const trials = 30;
    for (let i = 0; i < trials; i++) {
      act(() => captured!.setGameState(prev => ({
        ...prev,
        weeksLived: 200 + i,
        stats: { ...prev.stats, energy: 100 },
        hobbies: [makeHobby({ id: 'newbie', name: 'Newbie', tournamentReward: 500, skillLevel: 0 })],
      })));
      let res: { success: boolean; message: string } = { success: false, message: '' };
      act(() => { res = enterHobbyTournament(captured!.state, captured!.setGameState, 'newbie', { updateMoney: libUpdateMoney, updateStats: libUpdateStats }); });
      if (res.success) wins++;
    }
    // winChance = 30 + 0*5 = 30% → expect roughly 6-12 wins over 30 trials.
    expect(wins).toBeLessThan(trials * 0.7);
  });

  it('enterHobbyTournament: reward scales with skillLevel', async () => {
    mounted = mountGame();
    const { enterHobbyTournament } = await import('@/contexts/game/actions/HobbyActions');
    const { updateMoney: libUpdateMoney } = await import('@/contexts/game/actions/MoneyActions');
    const { updateStats: libUpdateStats } = await import('@/contexts/game/actions/StatsActions');

    // Seed a guaranteed-win at high skillLevel.
    seedWithHobby({ id: 'champ', name: 'Champ', tournamentReward: 1000, skillLevel: 20 });
    const moneyBefore = captured!.state.stats.money;
    let res: { success: boolean; message: string } = { success: false, message: '' };
    act(() => { res = enterHobbyTournament(captured!.state, captured!.setGameState, 'champ', { updateMoney: libUpdateMoney, updateStats: libUpdateStats }); });

    if (res.success) {
      // reward = 1000 * (1 + 20*0.2) = 1000 * 5 = 5000
      expect(captured!.state.stats.money).toBe(moneyBefore + 5000);
    }
  });

  // ── INVARIANT ──────────────────────────────────────────────────────────
  it('Invariant: 50 alternating train+tournament cycles keep state clean', async () => {
    mounted = mountGame();
    seedWithHobby({ id: 'mixed', name: 'Mixed', energyCost: 5, tournamentReward: 200, skillLevel: 3 });
    const { trainHobby, enterHobbyTournament } = await import('@/contexts/game/actions/HobbyActions');
    const { updateStats: libUpdateStats } = await import('@/contexts/game/actions/StatsActions');
    const { updateMoney: libUpdateMoney } = await import('@/contexts/game/actions/MoneyActions');

    for (let i = 0; i < 25; i++) {
      // Advance week + reset energy so cap doesn't block.
      act(() => captured!.setGameState(prev => ({
        ...prev,
        weeksLived: 100 + i,
        stats: { ...prev.stats, energy: 100 },
      })));
      act(() => { trainHobby(captured!.state, captured!.setGameState, 'mixed', { updateStats: libUpdateStats }); });
      act(() => { enterHobbyTournament(captured!.state, captured!.setGameState, 'mixed', { updateMoney: libUpdateMoney, updateStats: libUpdateStats }); });
    }

    const h = getHobby('mixed');
    expect(Number.isFinite(h?.skill)).toBe(true);
    expect(Number.isFinite(h?.skillLevel)).toBe(true);
    assertClean('alternating cycles');
  });
});
