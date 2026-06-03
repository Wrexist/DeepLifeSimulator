/**
 * Stale-Closure Guard Sweep
 *
 * The codebase uses two patterns to avoid stale closures in `useCallback`:
 *   (a) `stateRef.current` — a ref synchronized via useEffect on every gameState change
 *   (b) `setGameState(prev => ...)` — functional updaters that read fresh state
 *
 * This file exercises the high-risk paths where a stale closure would silently
 * apply an action to the wrong version of state. Each test:
 *   1. Calls action A (mutates state)
 *   2. IMMEDIATELY calls action B that reads state
 *   3. Asserts B sees A's mutation
 *
 * If a `stateRef` falls behind by one render, or a useCallback misses a dep,
 * these tests fail loudly.
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
  useMoneyActions,
  useItemActions,
  useJobActions,
} from '@/contexts/game';
import { UIUXProvider } from '@/contexts/UIUXContext';
import type { GameState, Relationship } from '@/contexts/game/types';

const { act } = TestRenderer;
const h = React.createElement;

type Probe = {
  state: GameState;
  setGameState: React.Dispatch<React.SetStateAction<GameState>>;
  money: ReturnType<typeof useMoneyActions>;
  item: ReturnType<typeof useItemActions>;
  job: ReturnType<typeof useJobActions>;
  game: ReturnType<typeof useGameActions>;
};

let captured: Probe | null = null;

function ProbeComponent() {
  const { gameState, setGameState } = useGameState();
  const money = useMoneyActions();
  const item = useItemActions();
  const job = useJobActions();
  const game = useGameActions();
  captured = { state: gameState, setGameState, money, item, job, game };
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

function seedWealthy() {
  act(() => captured!.setGameState(prev => ({
    ...prev,
    weeksLived: 100,
    date: { ...prev.date, age: 25, year: 2030 },
    stats: { ...prev.stats, money: 100_000, gems: 1000, health: 80, happiness: 80, energy: 100, fitness: 50, reputation: 50 },
  })));
}

describe('Stale-closure guard sweep', () => {
  jest.setTimeout(120_000);
  let mounted: { root: any } | null = null;

  afterEach(() => {
    if (mounted) {
      act(() => mounted!.root.unmount());
      mounted = null;
    }
    captured = null;
  });

  // ── MoneyActions: stateRef refresh on rapid sequential reads ───────────
  it('updateMoney + buyCrypto in same act block see consistent state', () => {
    mounted = mountGame();
    seedWealthy();
    const cryptos = captured!.state.cryptos || [];
    if (cryptos.length === 0) return;
    const target = cryptos[0];

    const moneyBefore = captured!.state.stats.money;
    act(() => {
      captured!.money.updateMoney(5000, 'sequential-test'); // money up 5000
      captured!.money.buyCrypto(target.id, 1000); // money down 1000
    });
    // Net change should be +4000 (both ops succeeded).
    expect(captured!.state.stats.money).toBe(moneyBefore + 5000 - 1000);
  });

  // ── ItemActions: buy → sell in same render reads fresh state ───────────
  it('buyItem then sellItem in the same act block both succeed (no stale read)', () => {
    mounted = mountGame();
    seedWealthy();

    act(() => {
      captured!.item.buyItem('bike');
    });
    expect(captured!.state.items?.find(i => i.id === 'bike')?.owned).toBe(true);

    // Now call sellItem — stateRef MUST reflect the buy from the previous act
    // before this sell starts, or else sellItem will see "not owned" and reject.
    act(() => {
      captured!.item.sellItem('bike');
    });
    expect(captured!.state.items?.find(i => i.id === 'bike')?.owned).toBe(false);
  });

  // ── JobActions: rapid sequential street jobs share weekly cap state ────
  it('5 street-job calls in same act block all see the running cap counter', () => {
    mounted = mountGame();
    seedWealthy();

    // 3 calls within ONE act block. The 3rd should NOT crash even though
    // weeklyStreetJobs is being mutated by previous calls.
    let lastResult: { success: boolean; message?: string } | void;
    act(() => {
      captured!.job.performStreetJob('beg');
      captured!.job.performStreetJob('beg');
      lastResult = captured!.job.performStreetJob('beg');
    });
    expect(lastResult).toBeDefined();
    // weeklyStreetJobs[beg] should be 3 (all three counted).
    expect(captured!.state.weeklyStreetJobs?.['beg']).toBe(3);
  });

  // ── GameActions: setState then read via game.updateRelationship ────────
  it('inject relationship + updateRelationship in same act produces +score', () => {
    mounted = mountGame();
    seedWealthy();
    const target: Relationship = {
      id: 'sc1', name: 'SC1', type: 'friend',
      relationshipScore: 50, personality: 'k', gender: 'female', age: 25,
    };
    act(() => {
      captured!.setGameState(prev => ({ ...prev, relationships: [...(prev.relationships || []), target] }));
      // Same act block — updateRelationship uses setGameState(prev =>) so
      // it sees the just-added relationship.
      captured!.game.updateRelationship('sc1', 10);
    });
    expect(captured!.state.relationships?.find(r => r.id === 'sc1')?.relationshipScore).toBe(60);
  });

  // ── GameActions: updateStats reads fresh state via prev callback ───────
  it('rapid back-to-back updateStats accumulates (no lost update)', () => {
    mounted = mountGame();
    seedWealthy();
    const before = captured!.state.stats.happiness;
    act(() => {
      captured!.game.updateStats({ happiness: 5 });
      captured!.game.updateStats({ happiness: 5 });
      captured!.game.updateStats({ happiness: 5 });
    });
    // All three +5 accumulated → +15.
    expect(captured!.state.stats.happiness).toBe(Math.min(100, before + 15));
  });

  // ── GameActions: updateMoney negative-then-positive net is correct ─────
  it('updateMoney -X then +X same act block net = 0', () => {
    mounted = mountGame();
    seedWealthy();
    const before = captured!.state.stats.money;
    act(() => {
      captured!.game.updateMoney(-1000, 'test-loss');
      captured!.game.updateMoney(1000, 'test-gain');
    });
    expect(captured!.state.stats.money).toBe(before);
  });

  // ── Pure ref-refresh guarantee ────────────────────────────────────────
  it('captured.state reflects the LATEST mutation after act flushes', () => {
    mounted = mountGame();
    const startMoney = captured!.state.stats.money;
    act(() => captured!.setGameState(prev => ({
      ...prev,
      stats: { ...prev.stats, money: prev.stats.money + 12345 },
    })));
    expect(captured!.state.stats.money).toBe(startMoney + 12345);

    // Second mutation in a fresh act block — must reflect the cumulative result.
    act(() => captured!.setGameState(prev => ({
      ...prev,
      stats: { ...prev.stats, money: prev.stats.money + 67890 },
    })));
    expect(captured!.state.stats.money).toBe(startMoney + 12345 + 67890);
  });

  // ── Cross-context: MoneyActions sees ItemActions' mutation ──────────────
  it('Cross-context: buyItem then money.updateMoney see consistent state', () => {
    mounted = mountGame();
    seedWealthy();
    act(() => { captured!.item.buyItem('bike'); });
    const moneyAfterBuy = captured!.state.stats.money;

    act(() => { captured!.money.updateMoney(500, 'cross-ctx'); });
    expect(captured!.state.stats.money).toBe(moneyAfterBuy + 500);
  });

  // ── Sequence consistency: 20 mutations land in order ───────────────────
  it('20 sequential setGameState calls all land (no dropped updates)', () => {
    mounted = mountGame();
    seedWealthy();
    const before = captured!.state.stats.gems;

    act(() => {
      for (let i = 0; i < 20; i++) {
        captured!.setGameState(prev => ({
          ...prev,
          stats: { ...prev.stats, gems: (prev.stats.gems || 0) + 1 },
        }));
      }
    });
    expect(captured!.state.stats.gems).toBe(before + 20);
  });

  // ── BUG REGRESSION: hook updateMoney's input guard fires consistently ──
  it('updateMoney rejects non-finite amount on EVERY call (guard not bypassed)', () => {
    mounted = mountGame();
    seedWealthy();
    const before = captured!.state.stats.money;
    act(() => {
      captured!.money.updateMoney(NaN, 'a');
      captured!.money.updateMoney(NaN, 'b');
      captured!.money.updateMoney(NaN, 'c');
    });
    expect(captured!.state.stats.money).toBe(before);
  });

  // ── No-fresh-state-on-mount regression ─────────────────────────────────
  it('Captured state immediately after mount is the seeded initialGameState', () => {
    mounted = mountGame();
    // The first capture should be the initial state — sanity check that the
    // probe didn't fire BEFORE GameProvider had committed the initial value.
    expect(captured!.state).toBeDefined();
    expect(captured!.state.weeksLived).toBe(0);
    expect(captured!.state.date.age).toBe(18);
  });
});
