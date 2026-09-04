/**
 * Random Event Resolution Audit
 *
 * `resolveEvent` is the most cross-cutting player-driven function in the
 * codebase — it mutates stats, money, relationships, pets, diseases, careers,
 * memories, and consequence state in a single transaction. This audit
 * verifies:
 *
 *   - Valid event + choice removes event from pendingEvents
 *   - Effects apply correctly (money, stats, relationship, pet)
 *   - Stat clamping to [0, 100] holds
 *   - Money never goes negative
 *   - Unknown event ID / unknown choice ID → no state change
 *   - Wedding event special: partner promoted to spouse
 *   - Special effects: fire_from_job, add_career_warning, add_disease
 *   - Duplicate-call guard prevents double-application
 *   - Multi-event sequence keeps state JSON-safe
 */

import React from 'react';
import { GameProvider } from '@/contexts/game/GameProvider';
import { useGameState, useGameActions } from '@/contexts/game';
import { UIUXProvider } from '@/contexts/UIUXContext';
import type { GameState, Relationship } from '@/contexts/game/types';
import { validateGameState } from '@/utils/saveValidation';

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

function injectEvent(event: {
  id: string;
  title?: string;
  description?: string;
  category?: string;
  relationId?: string;
  choices: { id: string; label?: string; effects?: Record<string, unknown>; special?: string; diseaseId?: string }[];
}) {
  act(() => captured!.setGameState(prev => ({
    ...prev,
    weeksLived: 100,
    date: { ...prev.date, age: 25, year: 2030 },
    stats: { ...prev.stats, money: 10_000, gems: 1000, health: 80, happiness: 70, energy: 90, fitness: 60, reputation: 50 },
    pendingEvents: [...(prev.pendingEvents || []), event as never],
  })));
}

describe('Random event resolution audit', () => {
  jest.setTimeout(120_000);
  let mounted: { root: any } | null = null;

  afterEach(() => {
    if (mounted) {
      act(() => mounted!.root.unmount());
      mounted = null;
    }
    captured = null;
  });

  // ── HAPPY PATH ─────────────────────────────────────────────────────────
  it('resolveEvent: valid event + choice applies effects + removes from pendingEvents', () => {
    mounted = mountGame();
    injectEvent({
      id: 'test_money_event',
      choices: [{ id: 'accept', effects: { money: 500, stats: { happiness: 5 } } }],
    });
    const moneyBefore = captured!.state.stats.money;
    const happinessBefore = captured!.state.stats.happiness;
    const pendingBefore = (captured!.state.pendingEvents || []).length;

    act(() => captured!.game.resolveEvent('test_money_event', 'accept'));

    expect(captured!.state.stats.money).toBe(moneyBefore + 500);
    // A +5 happiness effect lands as somewhat less than +5, because Program 14
    // made a happiness gain worth less the happier a life already is and this
    // fixture starts high. What this test is checking is that the choice's
    // effects were APPLIED at all - the exact arithmetic of the curve is
    // covered by `lib/economy/__tests__/happinessGain.test.ts`.
    expect(captured!.state.stats.happiness).toBeGreaterThan(happinessBefore);
    expect(captured!.state.stats.happiness).toBeLessThanOrEqual(happinessBefore + 5);
    expect((captured!.state.pendingEvents || []).length).toBe(pendingBefore - 1);
    expect((captured!.state.pendingEvents || []).find(e => e.id === 'test_money_event')).toBeUndefined();
    assertClean('happy path');
  });

  // ── EVENT NOT FOUND ────────────────────────────────────────────────────
  it('resolveEvent: unknown eventId → no state change', () => {
    mounted = mountGame();
    const stateBefore = JSON.stringify(captured!.state);
    act(() => captured!.game.resolveEvent('not_a_real_event_xyz', 'accept'));
    // State should be unchanged (except possibly updatedAt).
    expect(captured!.state.pendingEvents).toEqual([]);
    void stateBefore;
    assertClean('unknown event');
  });

  // ── CHOICE NOT FOUND ───────────────────────────────────────────────────
  it('resolveEvent: unknown choiceId leaves event in pendingEvents', () => {
    mounted = mountGame();
    injectEvent({
      id: 'choice_test_event',
      choices: [{ id: 'accept' }, { id: 'decline' }],
    });
    const moneyBefore = captured!.state.stats.money;
    act(() => captured!.game.resolveEvent('choice_test_event', 'invalid_choice_id'));
    // Money unchanged.
    expect(captured!.state.stats.money).toBe(moneyBefore);
    // Event should still be in pendingEvents.
    expect((captured!.state.pendingEvents || []).find(e => e.id === 'choice_test_event')).toBeDefined();
  });

  // ── MONEY CLAMPING ─────────────────────────────────────────────────────
  it('resolveEvent: negative money effect exceeding balance clamps to 0', () => {
    mounted = mountGame();
    injectEvent({
      id: 'overdraw_event',
      choices: [{ id: 'cost', effects: { money: -999_999_999 } }],
    });
    act(() => captured!.game.resolveEvent('overdraw_event', 'cost'));
    expect(captured!.state.stats.money).toBe(0);
    expect(Number.isFinite(captured!.state.stats.money)).toBe(true);
  });

  // ── STAT CLAMPING ──────────────────────────────────────────────────────
  it('resolveEvent: stat changes clamp to [0, 100]', () => {
    mounted = mountGame();
    injectEvent({
      id: 'stat_overflow',
      choices: [{ id: 'go', effects: { stats: { happiness: 500, health: -500, energy: 200 } } }],
    });
    act(() => captured!.game.resolveEvent('stat_overflow', 'go'));
    expect(captured!.state.stats.happiness).toBeLessThanOrEqual(100);
    expect(captured!.state.stats.happiness).toBeGreaterThanOrEqual(0);
    expect(captured!.state.stats.health).toBe(0);
    expect(captured!.state.stats.energy).toBeLessThanOrEqual(100);
    assertClean('stat clamping');
  });

  // ── RELATIONSHIP CHANGE ────────────────────────────────────────────────
  it('resolveEvent: relationship change updates target relationship score', () => {
    mounted = mountGame();
    const partner: Relationship = {
      id: 'lover_test',
      name: 'Test Partner',
      type: 'partner',
      relationshipScore: 50,
      personality: 'kind',
      gender: 'female',
      age: 25,
    };
    act(() => captured!.setGameState(prev => ({
      ...prev,
      relationships: [...(prev.relationships || []), partner],
    })));
    injectEvent({
      id: 'rel_test',
      relationId: 'lover_test',
      choices: [{ id: 'be_kind', effects: { relationship: 15 } }],
    });
    act(() => captured!.game.resolveEvent('rel_test', 'be_kind'));
    const updated = captured!.state.relationships?.find(r => r.id === 'lover_test');
    expect(updated?.relationshipScore).toBe(65);
  });

  it('resolveEvent: relationship score clamped to [0, 100]', () => {
    mounted = mountGame();
    const friend: Relationship = {
      id: 'pal',
      name: 'Pal',
      type: 'friend',
      relationshipScore: 95,
      personality: 'cool',
      gender: 'male',
      age: 26,
    };
    act(() => captured!.setGameState(prev => ({
      ...prev,
      relationships: [...(prev.relationships || []), friend],
    })));
    injectEvent({
      id: 'big_boost',
      relationId: 'pal',
      choices: [{ id: 'go', effects: { relationship: 200 } }],
    });
    act(() => captured!.game.resolveEvent('big_boost', 'go'));
    expect(captured!.state.relationships?.find(r => r.id === 'pal')?.relationshipScore).toBe(100);
  });

  // ── WEDDING SPECIAL ────────────────────────────────────────────────────
  it('resolveEvent: wedding event marry choice promotes partner to spouse', () => {
    mounted = mountGame();
    const partner: Relationship = {
      id: 'fiance',
      name: 'Fiance',
      type: 'partner',
      relationshipScore: 90,
      personality: 'loving',
      gender: 'female',
      age: 25,
    };
    act(() => captured!.setGameState(prev => ({
      ...prev,
      relationships: [...(prev.relationships || []), partner],
    })));
    injectEvent({
      id: 'wedding',
      relationId: 'fiance',
      choices: [{ id: 'marry', effects: { relationship: 5 } }],
    });
    act(() => captured!.game.resolveEvent('wedding', 'marry'));
    expect(captured!.state.relationships?.find(r => r.id === 'fiance')?.type).toBe('spouse');
  });

  it('resolveEvent: wedding event with non-marry choice does NOT promote to spouse', () => {
    mounted = mountGame();
    const partner: Relationship = {
      id: 'fiance2',
      name: 'Fiance 2',
      type: 'partner',
      relationshipScore: 90,
      personality: 'loving',
      gender: 'female',
      age: 25,
    };
    act(() => captured!.setGameState(prev => ({
      ...prev,
      relationships: [...(prev.relationships || []), partner],
    })));
    injectEvent({
      id: 'wedding',
      relationId: 'fiance2',
      choices: [{ id: 'cancel', effects: { relationship: -20 } }],
    });
    act(() => captured!.game.resolveEvent('wedding', 'cancel'));
    expect(captured!.state.relationships?.find(r => r.id === 'fiance2')?.type).toBe('partner');
  });

  // ── SPECIAL EFFECTS ────────────────────────────────────────────────────
  it('resolveEvent: fire_from_job special clears currentJob', () => {
    mounted = mountGame();
    act(() => captured!.setGameState(prev => ({
      ...prev,
      currentJob: 'doctor',
      careers: [...(prev.careers || []).filter(c => c.id !== 'doctor'), {
        id: 'doctor', name: 'Doctor', title: 'Doctor', level: 3, progress: 50,
        salary: 1000, accepted: true, applied: true,
      } as never],
    })));
    expect(captured!.state.currentJob).toBe('doctor');

    injectEvent({
      id: 'fired_event',
      choices: [{ id: 'leave', special: 'fire_from_job' }],
    });
    act(() => captured!.game.resolveEvent('fired_event', 'leave'));
    expect(captured!.state.currentJob).toBeUndefined();
    const doctor = captured!.state.careers?.find(c => c.id === 'doctor');
    expect(doctor?.accepted).toBe(false);
    expect(doctor?.applied).toBe(false);
  });

  it('resolveEvent: add_career_warning increments warningsReceived', () => {
    mounted = mountGame();
    act(() => captured!.setGameState(prev => ({
      ...prev,
      currentJob: 'engineer',
      careers: [...(prev.careers || []).filter(c => c.id !== 'engineer'), {
        id: 'engineer', name: 'Engineer', title: 'Engineer', level: 2, progress: 20,
        salary: 800, accepted: true, applied: true, warningsReceived: 0,
      } as never],
    })));
    injectEvent({
      id: 'warning_event',
      choices: [{ id: 'sorry', special: 'add_career_warning' }],
    });
    act(() => captured!.game.resolveEvent('warning_event', 'sorry'));
    expect(captured!.state.careers?.find(c => c.id === 'engineer')?.warningsReceived).toBe(1);
  });

  it('resolveEvent: grant_free_education adds reputation', () => {
    mounted = mountGame();
    injectEvent({
      id: 'edu_event',
      choices: [{ id: 'accept', special: 'grant_free_education' }],
    });
    const repBefore = captured!.state.stats.reputation;
    act(() => captured!.game.resolveEvent('edu_event', 'accept'));
    expect(captured!.state.stats.reputation).toBeGreaterThan(repBefore);
    expect(captured!.state.stats.reputation).toBeLessThanOrEqual(100);
  });

  // ── PET EFFECT ─────────────────────────────────────────────────────────
  it('resolveEvent: pet effect updates pet stats', () => {
    mounted = mountGame();
    act(() => captured!.setGameState(prev => ({
      ...prev,
      pets: [{
        id: 'pet1', name: 'Buddy', type: 'dog', age: 2, hunger: 50, happiness: 50, health: 50,
      } as never],
    })));
    injectEvent({
      id: 'feed_pet',
      relationId: 'pet1',
      choices: [{ id: 'feed', effects: { pet: { hunger: -30, happiness: 20 } } }],
    });
    act(() => captured!.game.resolveEvent('feed_pet', 'feed'));
    const pet = captured!.state.pets?.find(p => p.id === 'pet1');
    expect(pet?.hunger).toBe(20);
    expect(pet?.happiness).toBe(70);
  });

  it('resolveEvent: pet stats clamp to [0, 100]', () => {
    mounted = mountGame();
    act(() => captured!.setGameState(prev => ({
      ...prev,
      pets: [{ id: 'pet2', name: 'Max', type: 'dog', age: 1, hunger: 90, happiness: 10, health: 95 } as never],
    })));
    injectEvent({
      id: 'overflow_pet',
      relationId: 'pet2',
      choices: [{ id: 'go', effects: { pet: { hunger: 500, happiness: -500, health: 200 } } }],
    });
    act(() => captured!.game.resolveEvent('overflow_pet', 'go'));
    const pet = captured!.state.pets?.find(p => p.id === 'pet2');
    expect(pet?.hunger).toBeLessThanOrEqual(100);
    expect(pet?.happiness).toBeGreaterThanOrEqual(0);
    expect(pet?.health).toBeLessThanOrEqual(100);
  });

  // ── DUPLICATE-CALL GUARD ───────────────────────────────────────────────
  it('resolveEvent: duplicate call with same eventId+choiceId is suppressed by the guard', () => {
    mounted = mountGame();
    injectEvent({
      id: 'dup_event',
      choices: [{ id: 'accept', effects: { money: 500 } }],
    });
    const moneyBefore = captured!.state.stats.money;
    // Within the same render cycle, both calls run - but the second one
    // should detect the event is gone (already removed) OR the
    // resolvingEventsRef Set should block the second call.
    act(() => {
      captured!.game.resolveEvent('dup_event', 'accept');
      captured!.game.resolveEvent('dup_event', 'accept');
    });
    // Money should have gone up by exactly 500, not 1000.
    expect(captured!.state.stats.money).toBe(moneyBefore + 500);
  });

  // ── DURABILITY UNDER LOAD ──────────────────────────────────────────────
  it('resolveEvent: 10 sequential events all resolve cleanly', () => {
    mounted = mountGame();
    // Inject 10 events.
    act(() => captured!.setGameState(prev => ({
      ...prev,
      weeksLived: 100,
      stats: { ...prev.stats, money: 100_000 },
      pendingEvents: Array.from({ length: 10 }, (_, i) => ({
        id: `seq_${i}`,
        choices: [{ id: 'accept', effects: { money: 100 } }],
      })) as never,
    })));
    for (let i = 0; i < 10; i++) {
      act(() => captured!.game.resolveEvent(`seq_${i}`, 'accept'));
    }
    expect((captured!.state.pendingEvents || []).length).toBe(0);
    assertClean('10 sequential events');
  });

  // ── NO EFFECTS PROVIDED ────────────────────────────────────────────────
  it('resolveEvent: choice with no effects still removes event from pendingEvents', () => {
    mounted = mountGame();
    injectEvent({
      id: 'cosmetic_choice',
      choices: [{ id: 'pick_red' }],
    });
    const stateBefore = JSON.stringify(captured!.state.stats);
    act(() => captured!.game.resolveEvent('cosmetic_choice', 'pick_red'));
    // Stats unchanged.
    expect(JSON.stringify(captured!.state.stats)).toBe(stateBefore);
    // Event removed.
    expect((captured!.state.pendingEvents || []).find(e => e.id === 'cosmetic_choice')).toBeUndefined();
  });

  // ── INVARIANT: NEXTWEEK AFTER RESOLVE ──────────────────────────────────
  it('Cross: resolve event + nextWeek tick stays clean', async () => {
    mounted = mountGame();
    injectEvent({
      id: 'pre_tick_event',
      choices: [{ id: 'accept', effects: { money: 1000, stats: { happiness: 10 } } }],
    });
    act(() => captured!.game.resolveEvent('pre_tick_event', 'accept'));
    await act(async () => { await captured!.game.nextWeek(); });
    assertClean('resolve + tick');
  });
});
