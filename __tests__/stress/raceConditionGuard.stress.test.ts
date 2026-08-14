/**
 * Race-Condition / Anti-Exploit Guard Audit
 *
 * Players mash buttons. Real-world UX produces rapid double-tap / triple-tap
 * patterns where two action invocations can be in flight before React commits
 * any state change. This audit verifies the anti-exploit guards across the
 * codebase actually prevent the exploits they're designed to block:
 *
 *   - `nextWeekInProgressRef` blocks concurrent week advances
 *   - `resolvingEventsRef` Set blocks duplicate event resolutions
 *   - Atomic affordability check in `actions/MoneyActions.ts` blocks double-spend
 *   - Weekly caps (street jobs, gifts, dates, hobby training) survive rapid mash
 *   - Double-claim guard on `claimProgressAchievement` blocks double gold
 *   - IAP `applyProductToState` is idempotent for one-time flags
 */

import React from 'react';
import { GameProvider } from '@/contexts/game/GameProvider';
import {
  useGameState,
  useGameActions,
  useMoneyActions,
  useItemActions,
  useJobActions,
  useSocialActions,
} from '@/contexts/game';
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
  money: ReturnType<typeof useMoneyActions>;
  item: ReturnType<typeof useItemActions>;
  job: ReturnType<typeof useJobActions>;
  social: ReturnType<typeof useSocialActions>;
  game: ReturnType<typeof useGameActions>;
};

let captured: Probe | null = null;

function ProbeComponent() {
  const { gameState, setGameState } = useGameState();
  const money = useMoneyActions();
  const item = useItemActions();
  const job = useJobActions();
  const social = useSocialActions();
  const game = useGameActions();
  captured = { state: gameState, setGameState, money, item, job, social, game };
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
    stats: { ...prev.stats, money: 100_000, gems: 100_000, health: 80, happiness: 80, energy: 100, fitness: 50, reputation: 50 },
  })));
}

describe('Race-condition / anti-exploit guard audit', () => {
  jest.setTimeout(180_000);
  let mounted: { root: any } | null = null;

  afterEach(() => {
    if (mounted) {
      act(() => mounted!.root.unmount());
      mounted = null;
    }
    captured = null;
  });

  // ── nextWeek IN-PROGRESS GUARD ─────────────────────────────────────────
  it('nextWeek: two concurrent calls produce exactly ONE week advance', async () => {
    mounted = mountGame();
    const weeksBefore = captured!.state.weeksLived;

    // Fire two awaitable calls "simultaneously" — second should be blocked by
    // `nextWeekInProgressRef.current`.
    await act(async () => {
      const a = captured!.game.nextWeek();
      const b = captured!.game.nextWeek();
      await Promise.all([a, b]);
    });

    // Only ONE week should have advanced (the second call was no-op'd by the guard).
    expect(captured!.state.weeksLived).toBe(weeksBefore + 1);
  });

  it('nextWeek: 5 concurrent calls still advance exactly ONE week', async () => {
    mounted = mountGame();
    const weeksBefore = captured!.state.weeksLived;
    await act(async () => {
      await Promise.all([
        captured!.game.nextWeek(),
        captured!.game.nextWeek(),
        captured!.game.nextWeek(),
        captured!.game.nextWeek(),
        captured!.game.nextWeek(),
      ]);
    });
    expect(captured!.state.weeksLived).toBe(weeksBefore + 1);
  });

  // ── resolveEvent DUPLICATE GUARD ───────────────────────────────────────
  it('resolveEvent: rapid duplicate call applies effects exactly once', () => {
    mounted = mountGame();
    seedWealthy();
    act(() => captured!.setGameState(prev => ({
      ...prev,
      pendingEvents: [{
        id: 'dup_race_event',
        choices: [{ id: 'pay', effects: { money: 500 } }],
      }] as never,
    })));
    const moneyBefore = captured!.state.stats.money;

    // Three back-to-back calls in same act block.
    act(() => {
      captured!.game.resolveEvent('dup_race_event', 'pay');
      captured!.game.resolveEvent('dup_race_event', 'pay');
      captured!.game.resolveEvent('dup_race_event', 'pay');
    });

    // Money up by exactly 500 (not 1500).
    expect(captured!.state.stats.money).toBe(moneyBefore + 500);
    // Event removed from pendingEvents.
    expect((captured!.state.pendingEvents || []).find(e => e.id === 'dup_race_event')).toBeUndefined();
  });

  // ── PURCHASE DOUBLE-SPEND GUARD (actions/MoneyActions reject path) ─────
  it('Lib updateMoney: two near-simultaneous purchases of insufficient combined funds: one succeeds, one rejected', async () => {
    mounted = mountGame();
    // Money = exactly enough for one purchase but not two.
    act(() => captured!.setGameState(prev => ({
      ...prev,
      stats: { ...prev.stats, money: 600 }, // enough for ONE $500 purchase
    })));

    const { updateMoney: libUpdateMoney } = await import('@/contexts/game/actions/MoneyActions');

    act(() => {
      libUpdateMoney(captured!.setGameState, -500, 'purchase-A');
      libUpdateMoney(captured!.setGameState, -500, 'purchase-B'); // Should be rejected
    });

    // Money should be 100 (600 - 500 once), not -400 or 0 (clamped).
    expect(captured!.state.stats.money).toBe(100);
  });

  it('Lib updateMoney: 5 rapid purchases all draining same balance, only as many succeed as money allows', async () => {
    mounted = mountGame();
    act(() => captured!.setGameState(prev => ({
      ...prev,
      stats: { ...prev.stats, money: 1500 }, // enough for 3 of 5 purchases
    })));
    const { updateMoney: libUpdateMoney } = await import('@/contexts/game/actions/MoneyActions');

    act(() => {
      for (let i = 0; i < 5; i++) {
        libUpdateMoney(captured!.setGameState, -500, `purchase-${i}`);
      }
    });

    // 3 purchases × $500 = $1500 deducted → balance 0.
    // 4th and 5th should reject (would go negative).
    expect(captured!.state.stats.money).toBe(0);
  });

  // ── WEEKLY CAP UNDER MASH ──────────────────────────────────────────────
  // Two-mode test for street jobs:
  //  - Real rapid-tap (separate act blocks per call, like distinct touch events): cap must hold
  //  - Worst-case batched (all in ONE act block, like programmatic spam): cap may be bypassed
  it('Street jobs: separate-tap (real UX) — cap holds at 3', () => {
    mounted = mountGame();
    seedWealthy();
    act(() => captured!.setGameState(prev => ({ ...prev, weeklyStreetJobs: {} })));

    const results: Array<{ success: boolean; message?: string } | void> = [];
    // Each call in its OWN act block, simulating separate React event commits.
    for (let i = 0; i < 10; i++) {
      act(() => { results.push(captured!.job.performStreetJob('beg')); });
    }
    expect(captured!.state.weeklyStreetJobs?.['beg']).toBe(3);
    const rejected = results.filter(r => r && typeof r === 'object' && !r.success).length;
    expect(rejected).toBeGreaterThanOrEqual(7);
  });

  // ── FIXED: same-batch spam now blocked by inner setGameState cap check ──
  // Previously, the per-job and global caps were checked against the captured
  // gameState snapshot BEFORE setGameState, so N rapid same-batch calls all
  // passed the gate and the counter ended up at N (not capped).
  //
  // FIX: the cap check now also runs INSIDE setGameState(prev =>) so each
  // invocation sees the cumulative weeklyStreetJobs[jobId] from prior
  // same-batch invocations and returns prev unchanged when capped.
  it('FIXED: same-batch spam respects per-job cap (3) — inner setGameState guard', () => {
    mounted = mountGame();
    seedWealthy();
    act(() => captured!.setGameState(prev => ({ ...prev, weeklyStreetJobs: {} })));
    act(() => {
      for (let i = 0; i < 10; i++) {
        captured!.job.performStreetJob('beg');
      }
    });
    const count = captured!.state.weeklyStreetJobs?.['beg'] || 0;
    // Per-job cap = 3, even under same-batch spam.
    expect(count).toBe(3);
  });

  it('Gift: separate-tap (real UX) — gift cap holds at 2/week', async () => {
    mounted = mountGame();
    seedWealthy();
    const partner: Relationship = {
      id: 'gift_target', name: 'Gift Target', type: 'partner',
      relationshipScore: 80, personality: 'kind', gender: 'female', age: 25,
    };
    act(() => captured!.setGameState(prev => ({
      ...prev,
      relationships: [...(prev.relationships || []), partner],
    })));

    const { giveGift } = await import('@/contexts/game/actions/DatingActions');

    const results: Array<{ success: boolean; message?: string }> = [];
    // Separate act blocks per call so the stateRef refreshes between taps.
    for (let i = 0; i < 5; i++) {
      act(() => {
        results.push(giveGift(captured!.state, captured!.setGameState, 'gift_target', 'flowers'));
      });
    }
    expect(results.filter(r => r.success).length).toBe(2);
    expect(results.filter(r => !r.success).length).toBe(3);
    expect(captured!.state.relationships?.find(r => r.id === 'gift_target')?.giftsThisWeek).toBe(2);
  });

  // ── ACHIEVEMENT DOUBLE-CLAIM GUARD ─────────────────────────────────────
  it('claimProgressAchievement: separate-tap claims grant gold exactly once', async () => {
    mounted = mountGame();
    seedWealthy();
    const gemsBefore = captured!.state.stats.gems;

    // Separate act blocks: each tap commits before the next reads.
    for (let i = 0; i < 5; i++) {
      await act(async () => { await captured!.game.claimProgressAchievement('test_dup_ach', 100); });
    }

    expect(captured!.state.stats.gems).toBe(gemsBefore + 100);
    const count = (captured!.state.claimedProgressAchievements || []).filter(id => id === 'test_dup_ach').length;
    expect(count).toBe(1);
  });

  // ── PURCHASE DOUBLE-CLICK (Item buy) ───────────────────────────────────
  it('buyItem: separate-tap double-click does not double-charge', () => {
    mounted = mountGame();
    seedWealthy();
    const moneyBefore = captured!.state.stats.money;

    // Separate act blocks: 2nd tap sees updated stateRef → "already owned".
    act(() => { captured!.item.buyItem('guitar'); });
    act(() => { captured!.item.buyItem('guitar'); });

    expect(captured!.state.items?.find(i => i.id === 'guitar')?.owned).toBe(true);
    const charged = moneyBefore - captured!.state.stats.money;
    expect(charged).toBeGreaterThan(0);
    expect(charged).toBeLessThan(1000);
  });

  // ── GOLD UPGRADE DOUBLE-CLICK ──────────────────────────────────────────
  it('buyGoldUpgrade: separate-tap double-click does not double-charge gems', () => {
    mounted = mountGame();
    seedWealthy();
    const gemsBefore = captured!.state.stats.gems;

    // Separate act blocks: 2nd/3rd taps see updated stateRef → "already owned".
    act(() => { captured!.money.buyGoldUpgrade('multiplier'); });
    act(() => { captured!.money.buyGoldUpgrade('multiplier'); });
    act(() => { captured!.money.buyGoldUpgrade('multiplier'); });

    expect(captured!.state.goldUpgrades?.multiplier).toBe(true);
    expect(captured!.state.stats.gems).toBe(gemsBefore - 5000);
  });

  // ── REFUEL / REPAIR RACE ───────────────────────────────────────────────
  it('refuelVehicle: rapid double-click does not double-drain money', async () => {
    mounted = mountGame();
    seedWealthy();
    const { purchaseVehicle, refuelVehicle } = await import('@/contexts/game/actions/VehicleActions');
    const { updateMoney: libUpdateMoney } = await import('@/contexts/game/actions/MoneyActions');
    const { updateStats: libUpdateStats } = await import('@/contexts/game/actions/StatsActions');
    act(() => captured!.setGameState(prev => ({ ...prev, hasDriversLicense: true })));
    act(() => { purchaseVehicle(captured!.state, captured!.setGameState, 'economy_sedan', { updateMoney: libUpdateMoney, updateStats: libUpdateStats }); });
    const vid = captured!.state.vehicles![0].id;
    // Drain fuel partially.
    act(() => captured!.setGameState(prev => ({
      ...prev,
      vehicles: prev.vehicles?.map(v => v.id === vid ? { ...v, fuelLevel: 30 } : v),
    })));

    const moneyBefore = captured!.state.stats.money;

    act(() => {
      refuelVehicle(captured!.state, captured!.setGameState, vid);
      // Second call: vehicle now at fuelLevel=100, second refuel must reject.
      refuelVehicle(captured!.state, captured!.setGameState, vid);
    });

    expect(captured!.state.vehicles?.find(v => v.id === vid)?.fuelLevel).toBe(100);
    const drained = moneyBefore - captured!.state.stats.money;
    expect(drained).toBeGreaterThan(0);
    expect(drained).toBeLessThan(200); // one refuel cost only
  });

  // ── CROSS-SYSTEM RACE: BUY + EVENT IN PARALLEL ─────────────────────────
  it('Cross-system: rapid resolveEvent + updateMoney both apply consistently', () => {
    mounted = mountGame();
    seedWealthy();
    act(() => captured!.setGameState(prev => ({
      ...prev,
      pendingEvents: [{
        id: 'cross_race',
        choices: [{ id: 'go', effects: { money: 200 } }],
      }] as never,
    })));
    const moneyBefore = captured!.state.stats.money;

    act(() => {
      captured!.game.resolveEvent('cross_race', 'go');
      captured!.money.updateMoney(300, 'cross-race-credit');
    });

    expect(captured!.state.stats.money).toBe(moneyBefore + 200 + 300);
  });

  // ── INVARIANT: VALIDATION AFTER RAPID SEQUENCE ─────────────────────────
  it('Invariant: 50 rapid mixed actions keep state JSON-safe + validateGameState passing', () => {
    mounted = mountGame();
    seedWealthy();

    act(() => {
      for (let i = 0; i < 50; i++) {
        if (i % 5 === 0) captured!.money.updateMoney(10, `m-${i}`);
        else if (i % 5 === 1) captured!.game.updateStats({ happiness: 1 });
        else if (i % 5 === 2) captured!.item.buyItem('guitar'); // will be rejected after first
        else if (i % 5 === 3) captured!.game.updateRelationship('parent1', 0);
        else captured!.money.updateMoney(-5, `m-${i}-cost`);
      }
    });

    const v = validateGameState(captured!.state);
    expect(v.valid).toBe(true);
    // Stats stay in valid range.
    expect(captured!.state.stats.money).toBeGreaterThanOrEqual(0);
    expect(captured!.state.stats.happiness).toBeLessThanOrEqual(100);
  });

  // ── FIXED: same-batch double-claim achievement ─────────────────────────
  it('FIXED: same-batch claimProgressAchievement grants gold exactly once', async () => {
    mounted = mountGame();
    seedWealthy();
    const gemsBefore = captured!.state.stats.gems;

    // All 5 calls in ONE act block — the AUTHORITATIVE check inside
    // setGameState(prev =>) must reject claims 2-5.
    await act(async () => {
      await Promise.all([
        captured!.game.claimProgressAchievement('same_batch_ach', 100),
        captured!.game.claimProgressAchievement('same_batch_ach', 100),
        captured!.game.claimProgressAchievement('same_batch_ach', 100),
        captured!.game.claimProgressAchievement('same_batch_ach', 100),
        captured!.game.claimProgressAchievement('same_batch_ach', 100),
      ]);
    });

    expect(captured!.state.stats.gems).toBe(gemsBefore + 100);
    const claimedCount = (captured!.state.claimedProgressAchievements || []).filter(id => id === 'same_batch_ach').length;
    expect(claimedCount).toBe(1);
  });

  // ── FIXED: same-batch double-buy gold upgrade ─────────────────────────
  it('FIXED: same-batch buyGoldUpgrade only charges once', () => {
    mounted = mountGame();
    seedWealthy();
    const gemsBefore = captured!.state.stats.gems;
    act(() => {
      captured!.money.buyGoldUpgrade('multiplier');
      captured!.money.buyGoldUpgrade('multiplier');
      captured!.money.buyGoldUpgrade('multiplier');
    });
    expect(captured!.state.goldUpgrades?.multiplier).toBe(true);
    expect(captured!.state.stats.gems).toBe(gemsBefore - 5000); // single charge
  });

  // ── FIXED: same-batch double-buy item ─────────────────────────────────
  it('FIXED: same-batch buyItem only charges once', () => {
    mounted = mountGame();
    seedWealthy();
    const moneyBefore = captured!.state.stats.money;
    act(() => {
      captured!.item.buyItem('guitar');
      captured!.item.buyItem('guitar');
      captured!.item.buyItem('guitar');
    });
    expect(captured!.state.items?.find(i => i.id === 'guitar')?.owned).toBe(true);
    const charged = moneyBefore - captured!.state.stats.money;
    expect(charged).toBeGreaterThan(0);
    expect(charged).toBeLessThan(1000); // single guitar (~$600), not triple
  });

  // ── FIXED: same-batch gift weekly cap ─────────────────────────────────
  it('FIXED: same-batch giveGift caps at 2/week', async () => {
    mounted = mountGame();
    seedWealthy();
    const partner: Relationship = {
      id: 'same_batch_gift', name: 'SBG', type: 'partner',
      relationshipScore: 80, personality: 'kind', gender: 'female', age: 25,
    };
    act(() => captured!.setGameState(prev => ({
      ...prev,
      relationships: [...(prev.relationships || []), partner],
    })));

    const { giveGift } = await import('@/contexts/game/actions/DatingActions');
    act(() => {
      for (let i = 0; i < 5; i++) {
        giveGift(captured!.state, captured!.setGameState, 'same_batch_gift', 'flowers');
      }
    });
    expect(captured!.state.relationships?.find(r => r.id === 'same_batch_gift')?.giftsThisWeek).toBe(2);
  });

  // ── IAP IDEMPOTENCY ────────────────────────────────────────────────────
  it('IAP REMOVE_ADS: applying twice still results in adsRemoved=true (no toggle off)', async () => {
    const { iapService } = await import('@/services/IAPService');
    const { initialGameState } = await import('@/contexts/game/initialState');
    const { IAP_PRODUCTS } = await import('@/utils/iapConfig');

    const state = structuredClone(initialGameState);
    iapService.applyProductToState(state, IAP_PRODUCTS.REMOVE_ADS);
    iapService.applyProductToState(state, IAP_PRODUCTS.REMOVE_ADS);
    iapService.applyProductToState(state, IAP_PRODUCTS.REMOVE_ADS);
    expect(state.settings?.adsRemoved).toBe(true);
  });
});
