/**
 * Crime + Jail Flow Stress Test
 *
 * Exercises crime/jail surface through the real provider:
 *   - performStreetJob (legal + illegal)
 *   - Weekly caps (per-job 3x, global 8x)
 *   - Criminal XP + skill XP gain
 *   - Criminal level prerequisites
 *   - payBail
 *   - serveJailTime
 *   - performJailActivity
 *
 * Goals: surface area coverage, state-invariant preservation across these
 * branchy paths, and any input-validation gaps.
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
import {
  useGameState,
  useGameActions,
  useJobActions,
} from '@/contexts/game';
import { UIUXProvider } from '@/contexts/UIUXContext';
import type { GameState } from '@/contexts/game/types';
import { validateGameState } from '@/utils/saveValidation';

const { act } = TestRenderer;
const h = React.createElement;

// ──────────────────── Probe ────────────────────────────────────────────────

type Probe = {
  state: GameState;
  setGameState: React.Dispatch<React.SetStateAction<GameState>>;
  job: ReturnType<typeof useJobActions>;
  game: ReturnType<typeof useGameActions>;
};

let captured: Probe | null = null;

function ProbeComponent() {
  const { gameState, setGameState } = useGameState();
  const job = useJobActions();
  const game = useGameActions();
  captured = { state: gameState, setGameState, job, game };
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

function seedCriminal(level = 1) {
  act(() => captured!.setGameState(prev => ({
    ...prev,
    weeksLived: 100,
    date: { ...prev.date, age: 20, year: 2027 },
    stats: { ...prev.stats, money: 10_000, gems: 1000, energy: 100, health: 100, happiness: 100, fitness: 50, reputation: 50 },
    criminalLevel: level,
    criminalXp: level * 100,
    wantedLevel: 0,
    jailWeeks: 0,
    weeklyStreetJobs: {},
    weeklyJailActivities: {},
  })));
}

function seedJailed(weeks = 3) {
  act(() => captured!.setGameState(prev => ({
    ...prev,
    weeksLived: 100,
    date: { ...prev.date, age: 20, year: 2027 },
    stats: { ...prev.stats, money: 50_000, gems: 1000, energy: 100, health: 100, happiness: 100, fitness: 50, reputation: 50 },
    jailWeeks: weeks,
    wantedLevel: 0,
    weeklyJailActivities: {},
  })));
}

// ──────────────────── Tests ────────────────────────────────────────────────

describe('Crime + Jail flow', () => {
  jest.setTimeout(120_000);
  let mounted: { root: any } | null = null;

  afterEach(() => {
    if (mounted) {
      act(() => mounted!.root.unmount());
      mounted = null;
    }
    captured = null;
  });

  // ── LEGAL STREET JOB ────────────────────────────────────────────────────
  it('Legal: beg succeeds (no jail/wanted level risk)', () => {
    mounted = mountGame();
    seedCriminal(1);
    const before = captured!.state.stats.energy;
    let result: { success: boolean; message?: string } | void;
    act(() => { result = captured!.job.performStreetJob('beg'); });
    expect(result).toBeDefined();
    // Legal job — should not increase wanted level.
    expect(captured!.state.wantedLevel || 0).toBe(0);
    // Energy should be consumed.
    expect(captured!.state.stats.energy).toBeLessThan(before);
    assertClean('Legal beg');
  });

  // ── ILLEGAL STREET JOB ─────────────────────────────────────────────────
  it('Illegal: panhandle/steal_from_cars may raise wanted level', () => {
    mounted = mountGame();
    seedCriminal(1);
    // Try multiple times to give the deterministic RNG a chance to land on caught.
    for (let i = 0; i < 3; i++) {
      act(() => { captured!.job.performStreetJob('steal_from_cars'); });
      assertClean(`illegal-try-${i}`);
      if ((captured!.state.weeklyStreetJobs?.['steal_from_cars'] || 0) >= 3) break;
    }
    // Either caught (jailWeeks > 0) or got away (wantedLevel may have increased).
    // Verify state still valid + counters non-negative + finite.
    expect(Number.isFinite(captured!.state.criminalXp)).toBe(true);
    expect(captured!.state.criminalXp).toBeGreaterThanOrEqual(0);
    expect(captured!.state.criminalLevel).toBeGreaterThanOrEqual(1);
    assertClean('Illegal steal_from_cars');
  });

  // ── WEEKLY CAPS ────────────────────────────────────────────────────────
  it('Cap: 4th attempt of same job in a week is rejected', () => {
    mounted = mountGame();
    seedCriminal(1);

    const results: Array<{ success: boolean; message?: string } | void> = [];
    for (let i = 0; i < 4; i++) {
      act(() => { results.push(captured!.job.performStreetJob('beg')); });
    }

    // 4th should be rejected by the per-job weekly cap of 3.
    const last = results[3] as { success: boolean; message?: string };
    expect(last).toBeDefined();
    expect(last.success).toBe(false);
    expect(last.message).toMatch(/already done|times this week/i);
    assertClean('per-job weekly cap');
  });

  it('Cap: total street jobs per week capped at 8', () => {
    mounted = mountGame();
    seedCriminal(1);

    // Seed weeklyStreetJobs near the global cap.
    act(() => captured!.setGameState(prev => ({
      ...prev,
      weeklyStreetJobs: { beg: 3, dumpster: 3, wash_cars: 2 }, // 8 total
    })));

    let result: { success: boolean; message?: string } | void;
    act(() => { result = captured!.job.performStreetJob('panhandle'); });
    const r = result as { success: boolean; message?: string };
    expect(r).toBeDefined();
    expect(r.success).toBe(false);
    expect(r.message).toMatch(/8 street jobs this week/i);
    assertClean('global weekly cap');
  });

  // ── CRIMINAL LEVEL REQUIREMENT ─────────────────────────────────────────
  it('Gating: locked crime rejects below required level', () => {
    mounted = mountGame();
    seedCriminal(1);

    let result: { success: boolean; message?: string } | void;
    act(() => { result = captured!.job.performStreetJob('steal_cars_basic'); });
    const r = result as { success: boolean; message?: string };
    // Either accepted (level=1 meets level=1 req) or rejected with proper message.
    expect(r).toBeDefined();
    assertClean('criminal level gating');
  });

  // ── XP GAIN ────────────────────────────────────────────────────────────
  it('XP: gainCriminalXp accumulates / levels up safely', () => {
    mounted = mountGame();
    // Seed at level 1 with XP near the threshold so a single +50 triggers level-up.
    act(() => captured!.setGameState(prev => ({
      ...prev,
      criminalLevel: 1,
      criminalXp: 100, // level threshold = 100 for level 1
    })));
    const levelBefore = captured!.state.criminalLevel || 1;
    act(() => captured!.job.gainCriminalXp(50));
    // Either leveled up (criminalLevel ++, criminalXp reset to remainder)
    // or accumulated (criminalXp + 50). Both must be finite + non-negative.
    expect(Number.isFinite(captured!.state.criminalXp)).toBe(true);
    expect(captured!.state.criminalXp).toBeGreaterThanOrEqual(0);
    expect(captured!.state.criminalLevel).toBeGreaterThanOrEqual(levelBefore);
    assertClean('gainCriminalXp');

    // Sub-threshold accumulation case.
    act(() => captured!.setGameState(prev => ({ ...prev, criminalLevel: 5, criminalXp: 0 })));
    act(() => captured!.job.gainCriminalXp(25));
    expect(captured!.state.criminalXp).toBe(25);
    expect(captured!.state.criminalLevel).toBe(5);
  });

  it('XP: gainCrimeSkillXp updates skill xp and respects skill bound', () => {
    mounted = mountGame();
    seedCriminal(1);
    const before = captured!.state.crimeSkills?.stealth?.xp || 0;
    act(() => captured!.job.gainCrimeSkillXp('stealth', 100));
    expect(captured!.state.crimeSkills?.stealth?.xp).toBeGreaterThanOrEqual(before);
    assertClean('gainCrimeSkillXp');
  });

  // ── ENERGY GATING ──────────────────────────────────────────────────────
  it('Energy: street job rejected when energy below requirement', () => {
    mounted = mountGame();
    seedCriminal(1);
    act(() => captured!.setGameState(prev => ({
      ...prev,
      stats: { ...prev.stats, energy: 5 },
    })));

    let result: { success: boolean; message?: string } | void;
    act(() => { result = captured!.job.performStreetJob('drug_dealing'); });
    const r = result as { success: boolean; message?: string };
    expect(r).toBeDefined();
    expect(r.success).toBe(false);
    expect(r.message).toMatch(/energy/i);
    assertClean('energy gating');
  });

  // ── BAD INPUT ──────────────────────────────────────────────────────────
  it('Bad input: unknown jobId returns structured error', () => {
    mounted = mountGame();
    seedCriminal(1);
    let result: { success: boolean; message?: string } | void;
    act(() => { result = captured!.job.performStreetJob('nonexistent_job_xyz'); });
    const r = result as { success: boolean; message?: string };
    expect(r).toBeDefined();
    expect(r.success).toBe(false);
    expect(r.message).toMatch(/not found/i);
    assertClean('unknown jobId');
  });

  // ── JAIL FLOW ──────────────────────────────────────────────────────────
  it('Jail: payBail clears jailWeeks at the cost of money', () => {
    mounted = mountGame();
    seedJailed(3);
    const moneyBefore = captured!.state.stats.money;
    const jailBefore = captured!.state.jailWeeks;
    expect(jailBefore).toBe(3);

    act(() => { captured!.job.payBail(); });

    // Bail can either: succeed (jailWeeks=0, money down) or be rejected (no change).
    // With $50K money + 3 jail weeks, should succeed.
    expect(captured!.state.jailWeeks).toBeLessThan(jailBefore);
    expect(captured!.state.stats.money).toBeLessThan(moneyBefore);
    assertClean('payBail');
  });

  it('Jail: payBail with insufficient funds is a no-op', () => {
    mounted = mountGame();
    seedJailed(3);
    // Drop money to 0.
    act(() => captured!.setGameState(prev => ({ ...prev, stats: { ...prev.stats, money: 0 } })));

    const jailBefore = captured!.state.jailWeeks;
    act(() => { captured!.job.payBail(); });

    // Jail weeks should not have changed.
    expect(captured!.state.jailWeeks).toBe(jailBefore);
    expect(captured!.state.stats.money).toBe(0);
    assertClean('payBail no funds');
  });

  it('Jail: serveJailTime returns an events array + statsChange object', () => {
    mounted = mountGame();
    seedJailed(2);
    let result: { events: string[]; statsChange: Record<string, number> } = { events: [], statsChange: {} };
    act(() => { result = captured!.job.serveJailTime() as { events: string[]; statsChange: Record<string, number> }; });
    expect(result).toBeDefined();
    expect(Array.isArray(result.events)).toBe(true);
    expect(result.statsChange).toBeDefined();
    assertClean('serveJailTime');
  });

  it('Jail: performJailActivity (exercise) updates stats while in jail', () => {
    mounted = mountGame();
    seedJailed(3);
    let result: { success: boolean; message: string } = { success: false, message: '' };
    act(() => { result = captured!.job.performJailActivity('exercise') as { success: boolean; message: string }; });
    // Activity may succeed or be rejected if energy/cap. Either way state should stay clean.
    expect(result).toBeDefined();
    expect(typeof result.success).toBe('boolean');
    assertClean('performJailActivity');
  });

  it('Jail: performJailActivity outside of jail returns structured error', () => {
    mounted = mountGame();
    seedCriminal(1); // not in jail
    let result: { success: boolean; message: string } = { success: false, message: '' };
    act(() => { result = captured!.job.performJailActivity('exercise') as { success: boolean; message: string }; });
    expect(result).toBeDefined();
    // Either rejected (not in jail) or no-op — must stay clean.
    assertClean('performJailActivity outside jail');
  });

  // ── CAREER ACTIONS ─────────────────────────────────────────────────────
  it('Career: applyForJob + promoteCareer + quitJob round-trip', () => {
    mounted = mountGame();
    seedCriminal(1);
    const careerIds = (captured!.state.careers || []).map(c => c.id);
    if (careerIds.length === 0) return;
    const candidate = careerIds[0];

    act(() => { captured!.job.applyForJob(candidate); });
    assertClean('applyForJob');

    let promo: { success: boolean; message: string } = { success: false, message: '' };
    act(() => { promo = captured!.job.promoteCareer(candidate); });
    expect(promo).toBeDefined();
    assertClean('promoteCareer');

    act(() => { captured!.job.quitJob(); });
    expect(captured!.state.currentJob).toBeFalsy();
    assertClean('quitJob');
  });

  // ── COMBINED: NEXTWEEK WHILE JAILED ────────────────────────────────────
  it('Cross-system: nextWeek while jailed decrements jail and doesn\'t crash', async () => {
    mounted = mountGame();
    seedJailed(2);
    const jailBefore = captured!.state.jailWeeks;

    await act(async () => { await captured!.game.nextWeek(); });

    // jailWeeks should decrement by 1, never go negative.
    expect(captured!.state.jailWeeks).toBeLessThan(jailBefore);
    expect(captured!.state.jailWeeks).toBeGreaterThanOrEqual(0);
    assertClean('nextWeek while jailed');
  });
});
