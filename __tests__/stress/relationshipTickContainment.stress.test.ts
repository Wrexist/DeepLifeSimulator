/**
 * One malformed relationship must not freeze the whole relationship pass.
 *
 * ── The bug (M3, 2026-08-16 architecture audit) ───────────────────────────
 *
 * `GameActionsContext.tsx`'s weekly relationship pass wrapped the ENTIRE
 * `.map()` over `state.relationships` in a single try/catch. One entry that
 * threw therefore carried EVERY relationship over untouched — and since nothing
 * repairs the bad entry, it threw again the next week, and the week after that.
 * No pregnancies, no weddings, no child aging, no relationship health, silently,
 * for the rest of the life. §4.3's "a per-tick loop must not let one bad entry
 * abort the pass" applied inside the pass itself.
 *
 * Containment is now PER ENTRY: the failing relationship is returned unchanged
 * for that week, its partial contributions (newborns, popups, happiness
 * penalties) are rolled back, and its siblings still tick. The outer try/catch
 * stays as a backstop for a failure of the pass itself.
 *
 * ── How the throw is engineered ───────────────────────────────────────────
 *
 * By mocking `applyPregnancyProgression` — the FIRST subsystem the map callback
 * calls — to throw for one id and delegate to the real implementation for every
 * other. That is deliberate: injecting a booby-trapped relationship object (a
 * throwing property getter) would also blow up in the ~dozen unrelated blocks
 * further down the tick that read `relationships`, and the test would then be
 * measuring the outer updater's catch rather than the containment under test.
 */

import React from 'react';
// `@types/react-test-renderer` is installed, so a typed static import
// type-checks clean — no `require` needed (tasks/lessons.md, 2026-08-15).
import TestRenderer, { act } from 'react-test-renderer';
import { GameProvider } from '@/contexts/game/GameProvider';
import { useGameState, useGameActions } from '@/contexts/game';
import { UIUXProvider } from '@/contexts/UIUXContext';
import type { GameState, Relationship } from '@/contexts/game/types';

const BAD_ID = 'partner_malformed';

jest.mock('@/contexts/game/actions/weekly/applyPregnancyProgression', () => {
  const actual = jest.requireActual('@/contexts/game/actions/weekly/applyPregnancyProgression');
  return {
    ...actual,
    applyPregnancyProgression: (rel: { id?: string }, ctx: unknown) => {
      if (rel && rel.id === BAD_ID) {
        throw new TypeError("Cannot read properties of undefined (reading 'length')");
      }
      return actual.applyPregnancyProgression(rel, ctx);
    },
  };
});

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

const WEEKS_PER_YEAR = 52;

describe('Weekly relationship pass - per-entry failure containment (M3)', () => {
  jest.setTimeout(120_000);
  let mounted: { root: any } | null = null;

  afterEach(() => {
    if (mounted) {
      act(() => mounted!.root.unmount());
      mounted = null;
    }
    captured = null;
  });

  function seed() {
    act(() => {
      captured!.setGameState(prev => ({
        ...prev,
        weeksLived: 200,
        date: { ...prev.date, age: 25, year: 2030 },
        stats: { ...prev.stats, money: 500_000, health: 100, happiness: 90, energy: 100 },
        relationships: [
          {
            id: BAD_ID,
            name: 'Malformed',
            type: 'partner',
            relationshipScore: 80,
            personality: 'caring',
            gender: 'female',
            age: 26,
            datesCount: 10,
          } as Relationship,
          {
            id: 'child_ok',
            name: 'Sam',
            type: 'child',
            relationshipScore: 70,
            personality: 'Playful',
            gender: 'male',
            age: 5,
          } as Relationship,
          {
            id: 'child_ok_2',
            name: 'Robin',
            type: 'child',
            relationshipScore: 70,
            personality: 'Curious',
            gender: 'female',
            age: 8,
          } as Relationship,
        ],
      }));
    });
  }

  it('the other relationships still tick when one entry throws', async () => {
    mounted = mountGame();
    seed();

    const weeksBefore = captured!.state.weeksLived ?? 0;
    const childAgeBefore = captured!.state.relationships!.find(r => r.id === 'child_ok')!.age!;
    const child2AgeBefore = captured!.state.relationships!.find(r => r.id === 'child_ok_2')!.age!;

    await act(async () => { await captured!.game.nextWeek(); });

    // The tick itself still advanced — the bad entry did not roll the week back.
    expect(captured!.state.weeksLived).toBe(weeksBefore + 1);

    // Both healthy children aged, i.e. the pass did NOT bail after the throw.
    const childAfter = captured!.state.relationships!.find(r => r.id === 'child_ok')!;
    const child2After = captured!.state.relationships!.find(r => r.id === 'child_ok_2')!;
    expect(childAfter.age).toBeCloseTo(childAgeBefore + 1 / WEEKS_PER_YEAR, 6);
    expect(child2After.age).toBeCloseTo(child2AgeBefore + 1 / WEEKS_PER_YEAR, 6);

    // The malformed entry survives, carried over unchanged — not dropped, not
    // half-processed. Nothing repairs it, so it must stay safe to skip forever.
    const badAfter = captured!.state.relationships!.find(r => r.id === BAD_ID);
    expect(badAfter).toBeDefined();
    expect(badAfter!.name).toBe('Malformed');
  });

  it('stays contained week after week - the pass never freezes permanently', async () => {
    mounted = mountGame();
    seed();

    const childAgeBefore = captured!.state.relationships!.find(r => r.id === 'child_ok')!.age!;

    for (let i = 0; i < 3; i++) {
      await act(async () => { await captured!.game.nextWeek(); });
    }

    const childAfter = captured!.state.relationships!.find(r => r.id === 'child_ok')!;
    expect(childAfter.age).toBeCloseTo(childAgeBefore + 3 / WEEKS_PER_YEAR, 6);
    expect(captured!.state.relationships!.find(r => r.id === BAD_ID)).toBeDefined();
  });
});
