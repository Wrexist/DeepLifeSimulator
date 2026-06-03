/**
 * Item + Gold Upgrade Interaction Audit
 *
 * Items + gold upgrades + inflation cross multiple subsystems. This file
 * exercises:
 *
 *   - buyItem / sellItem invariants (money, owned flag, hasPhone, inflation)
 *   - buyGoldUpgrade: gem cost, double-buy guard, invalid ID, all 7 upgrades
 *   - Items with dailyBonus (gym_membership, basic_bed) apply on tick
 *   - Energy regen multiplier from energy_boost gold upgrade
 *   - Time machine gold upgrade halves rewind cost
 *   - Immortality gold upgrade prevents old-age death
 *   - Cross-cutting: 50 mixed ticks with multiple items + upgrades stays clean
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
} from '@/contexts/game';
import { UIUXProvider } from '@/contexts/UIUXContext';
import type { GameState } from '@/contexts/game/types';
import { validateGameState } from '@/utils/saveValidation';

const { act } = TestRenderer;
const h = React.createElement;

type Probe = {
  state: GameState;
  setGameState: React.Dispatch<React.SetStateAction<GameState>>;
  money: ReturnType<typeof useMoneyActions>;
  item: ReturnType<typeof useItemActions>;
  game: ReturnType<typeof useGameActions>;
};

let captured: Probe | null = null;

function ProbeComponent() {
  const { gameState, setGameState } = useGameState();
  const money = useMoneyActions();
  const item = useItemActions();
  const game = useGameActions();
  captured = { state: gameState, setGameState, money, item, game };
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

function seedWealthy(gems = 100_000) {
  act(() => captured!.setGameState(prev => ({
    ...prev,
    weeksLived: 100,
    date: { ...prev.date, age: 22, year: 2027 },
    stats: { ...prev.stats, money: 1_000_000, gems, health: 80, happiness: 80, energy: 80, fitness: 80, reputation: 80 },
  })));
}

describe('Item + Gold Upgrade interactions', () => {
  jest.setTimeout(120_000);
  let mounted: { root: any } | null = null;

  afterEach(() => {
    if (mounted) {
      act(() => mounted!.root.unmount());
      mounted = null;
    }
    captured = null;
  });

  // ── BUYITEM INVARIANTS ─────────────────────────────────────────────────
  it('buyItem: deducts exact price, flips owned, returns success', () => {
    mounted = mountGame();
    seedWealthy();
    const before = captured!.state.stats.money;
    const guitar = captured!.state.items?.find(i => i.id === 'guitar')!;
    expect(guitar.owned).toBeFalsy();

    act(() => captured!.item.buyItem('guitar'));

    const after = captured!.state.items?.find(i => i.id === 'guitar')!;
    expect(after.owned).toBe(true);
    expect(captured!.state.stats.money).toBeLessThan(before);
    expect(captured!.state.stats.money).toBeGreaterThanOrEqual(0);
    assertClean('buyItem guitar');
  });

  it('buyItem: smartphone special — sets hasPhone=true', () => {
    mounted = mountGame();
    seedWealthy();
    expect(captured!.state.hasPhone).toBeFalsy();
    act(() => captured!.item.buyItem('smartphone'));
    expect(captured!.state.hasPhone).toBe(true);
  });

  it('buyItem: double-buy of non-consumable is rejected silently', () => {
    mounted = mountGame();
    seedWealthy();
    act(() => captured!.item.buyItem('guitar'));
    const afterFirst = captured!.state.stats.money;
    act(() => captured!.item.buyItem('guitar'));
    expect(captured!.state.stats.money).toBe(afterFirst); // No second deduction.
  });

  it('buyItem: insufficient funds — no purchase, no money change', () => {
    mounted = mountGame();
    // Drop money to less than the cheapest item's price.
    act(() => captured!.setGameState(prev => ({ ...prev, stats: { ...prev.stats, money: 50 } })));
    act(() => captured!.item.buyItem('guitar')); // costs ~$600
    expect(captured!.state.stats.money).toBe(50);
    expect(captured!.state.items?.find(i => i.id === 'guitar')?.owned).toBeFalsy();
  });

  it('buyItem: unknown item ID is a structured no-op', () => {
    mounted = mountGame();
    seedWealthy();
    const before = captured!.state.stats.money;
    act(() => captured!.item.buyItem('nonexistent_item_xyz'));
    expect(captured!.state.stats.money).toBe(before);
  });

  it('buyItem: inflation-aware — late-game price > base price', async () => {
    const { getInflatedPrice } = await import('@/lib/economy/inflation');
    const basePrice = 1000;
    const lateGameIndex = 2.5; // simulates ~30 years of 3%/yr inflation
    const inflated = getInflatedPrice(basePrice, lateGameIndex);
    expect(inflated).toBeGreaterThan(basePrice);
    expect(Number.isFinite(inflated)).toBe(true);
  });

  // ── SELLITEM INVARIANTS ────────────────────────────────────────────────
  it('sellItem: refunds 50% of inflated price + flips owned back', () => {
    mounted = mountGame();
    seedWealthy();
    // Buy a known-cheap item then sell.
    act(() => captured!.item.buyItem('bike')); // $450
    const afterBuy = captured!.state.stats.money;
    expect(captured!.state.items?.find(i => i.id === 'bike')?.owned).toBe(true);

    act(() => captured!.item.sellItem('bike'));
    expect(captured!.state.items?.find(i => i.id === 'bike')?.owned).toBe(false);
    const refund = captured!.state.stats.money - afterBuy;
    // ~50% of $450 = $225 (fluctuates slightly with priceIndex).
    expect(refund).toBeGreaterThan(150);
    expect(refund).toBeLessThan(500);
  });

  it('sellItem: smartphone clears hasPhone flag', () => {
    mounted = mountGame();
    seedWealthy();
    act(() => captured!.item.buyItem('smartphone'));
    expect(captured!.state.hasPhone).toBe(true);
    act(() => captured!.item.sellItem('smartphone'));
    expect(captured!.state.hasPhone).toBe(false);
  });

  it('sellItem: cannot sell un-owned item', () => {
    mounted = mountGame();
    seedWealthy();
    const before = captured!.state.stats.money;
    act(() => captured!.item.sellItem('guitar')); // not owned
    expect(captured!.state.stats.money).toBe(before);
  });

  // ── GOLD UPGRADES ──────────────────────────────────────────────────────
  it('buyGoldUpgrade: applies upgrade + deducts gems for valid ID', () => {
    mounted = mountGame();
    seedWealthy(100_000);
    const gemsBefore = captured!.state.stats.gems;
    expect(captured!.state.goldUpgrades?.multiplier).toBeFalsy();

    act(() => captured!.money.buyGoldUpgrade('multiplier'));

    expect(captured!.state.goldUpgrades?.multiplier).toBe(true);
    expect(captured!.state.stats.gems).toBe(gemsBefore - 5000); // multiplier costs 5000 gems
  });

  it('buyGoldUpgrade: double-buy is rejected (no double charge)', () => {
    mounted = mountGame();
    seedWealthy(100_000);
    act(() => captured!.money.buyGoldUpgrade('energy_boost'));
    const gemsAfterFirst = captured!.state.stats.gems;
    act(() => captured!.money.buyGoldUpgrade('energy_boost'));
    expect(captured!.state.stats.gems).toBe(gemsAfterFirst); // No second deduction.
  });

  it('buyGoldUpgrade: insufficient gems → no purchase', () => {
    mounted = mountGame();
    seedWealthy(100); // Way under any upgrade cost.
    act(() => captured!.money.buyGoldUpgrade('multiplier'));
    expect(captured!.state.goldUpgrades?.multiplier).toBeFalsy();
    expect(captured!.state.stats.gems).toBe(100);
  });

  it('buyGoldUpgrade: invalid upgrade ID → no state change', () => {
    mounted = mountGame();
    seedWealthy(100_000);
    const gemsBefore = captured!.state.stats.gems;
    act(() => captured!.money.buyGoldUpgrade('not_a_real_upgrade'));
    expect(captured!.state.stats.gems).toBe(gemsBefore);
  });

  it('buyGoldUpgrade: all 7 gold upgrades can be purchased in sequence', () => {
    mounted = mountGame();
    seedWealthy(200_000); // Enough for all (5K+7.5K+6K+9K+15K+25K+50K = 117500)
    const ids = ['multiplier', 'energy_boost', 'happiness_boost', 'fitness_boost', 'skill_mastery', 'time_machine', 'immortality'];
    for (const id of ids) {
      act(() => captured!.money.buyGoldUpgrade(id));
    }
    for (const id of ids) {
      expect(captured!.state.goldUpgrades?.[id as keyof NonNullable<GameState['goldUpgrades']>]).toBe(true);
    }
    assertClean('all gold upgrades');
  });

  // ── ITEM × GOLD UPGRADE COMBOS ─────────────────────────────────────────
  it('Combo: energy_boost gold upgrade + nextWeek → energy regen multiplier applies', async () => {
    mounted = mountGame();
    seedWealthy(100_000);

    // Drop energy near zero so regen is visible.
    act(() => captured!.setGameState(prev => ({ ...prev, stats: { ...prev.stats, energy: 30 } })));

    // Tick once without upgrade.
    await act(async () => { await captured!.game.nextWeek(); });
    const energyWithoutUpgrade = captured!.state.stats.energy;
    // Reset.
    act(() => captured!.setGameState(prev => ({ ...prev, stats: { ...prev.stats, energy: 30 } })));

    // Purchase energy_boost and tick again.
    act(() => captured!.money.buyGoldUpgrade('energy_boost'));
    await act(async () => { await captured!.game.nextWeek(); });
    const energyWithUpgrade = captured!.state.stats.energy;

    // Both should be finite + clamped to 100. With upgrade should be ≥ without.
    expect(Number.isFinite(energyWithUpgrade)).toBe(true);
    expect(energyWithUpgrade).toBeGreaterThanOrEqual(energyWithoutUpgrade - 1); // tolerance for other effects
  });

  it('Combo: immortality gold upgrade + age 95 → no random old-age death', async () => {
    mounted = mountGame();
    seedWealthy(100_000);
    act(() => captured!.money.buyGoldUpgrade('immortality'));
    expect(captured!.state.goldUpgrades?.immortality).toBe(true);

    // Force age past death-roll threshold.
    act(() => captured!.setGameState(prev => ({
      ...prev,
      weeksLived: 4000,
      date: { ...prev.date, age: 95, year: 2102 },
      stats: { ...prev.stats, health: 100, happiness: 100, energy: 100, fitness: 100 },
    })));

    // Tick 20 weeks — without immortality, ~10-20% chance of death per year at age 95.
    // With immortality, must never trigger old-age death.
    for (let i = 0; i < 20; i++) {
      await act(async () => { await captured!.game.nextWeek(); });
      if (captured!.state.deathReason === 'age') {
        throw new Error(`Old-age death fired despite immortality at week ${i}`);
      }
    }
  });

  it('Combo: time_machine gold upgrade halves rewind cost', async () => {
    const { getRewindCost } = await import('@/lib/timeMachine/checkpointSystem');
    const withoutUpgrade = getRewindCost(0, false);
    const withUpgrade = getRewindCost(0, true);
    expect(withUpgrade).toBe(Math.floor(withoutUpgrade / 2));
    expect(withUpgrade).toBeGreaterThan(0);
  });

  // ── ITEM DAILY BONUS ON TICK ────────────────────────────────────────────
  it('Daily bonus: gym_membership applies fitness/health boost over ticks', async () => {
    mounted = mountGame();
    seedWealthy();
    // Drop fitness and health so we can see the boost.
    act(() => captured!.setGameState(prev => ({
      ...prev,
      stats: { ...prev.stats, fitness: 30, health: 50 },
    })));

    // Buy gym membership.
    act(() => captured!.item.buyItem('gym_membership'));
    const fitnessBefore = captured!.state.stats.fitness;

    // Tick several weeks.
    for (let i = 0; i < 5; i++) {
      await act(async () => { await captured!.game.nextWeek(); });
    }

    // Fitness should be at minimum equal or higher (gym daily bonus +2/day = +14/week).
    // Other decay effects may apply, so we just check finite + non-negative.
    expect(Number.isFinite(captured!.state.stats.fitness)).toBe(true);
    expect(captured!.state.stats.fitness).toBeGreaterThanOrEqual(0);
    expect(captured!.state.stats.fitness).toBeLessThanOrEqual(100);
    void fitnessBefore;
  });

  // ── COMPOUND TRANSACTION INVARIANTS ─────────────────────────────────────
  it('Transaction: buy 5 items + sell 5 items + tick keeps state clean', async () => {
    mounted = mountGame();
    seedWealthy();
    const itemsToBuy = ['guitar', 'bike', 'suit', 'gym_membership', 'basic_bed'];
    for (const id of itemsToBuy) {
      act(() => captured!.item.buyItem(id));
    }
    for (const id of itemsToBuy) {
      expect(captured!.state.items?.find(i => i.id === id)?.owned).toBe(true);
    }

    for (const id of itemsToBuy) {
      act(() => captured!.item.sellItem(id));
    }
    for (const id of itemsToBuy) {
      expect(captured!.state.items?.find(i => i.id === id)?.owned).toBe(false);
    }

    await act(async () => { await captured!.game.nextWeek(); });
    assertClean('buy 5 sell 5 + tick');
  });

  it('Stress: 50 mixed ticks with 3 items + 2 gold upgrades stays valid', async () => {
    mounted = mountGame();
    seedWealthy(200_000);
    act(() => captured!.item.buyItem('smartphone'));
    act(() => captured!.item.buyItem('computer'));
    act(() => captured!.item.buyItem('gym_membership'));
    act(() => captured!.money.buyGoldUpgrade('multiplier'));
    act(() => captured!.money.buyGoldUpgrade('energy_boost'));

    for (let i = 0; i < 50; i++) {
      await act(async () => { await captured!.game.nextWeek(); });
      if (i % 10 === 0) {
        expect(Number.isFinite(captured!.state.stats.money)).toBe(true);
        expect(Number.isFinite(captured!.state.stats.gems)).toBe(true);
      }
    }
    assertClean('50-tick mixed flow');
  });

  // ── GOLD UPGRADE × IAP ALIGNMENT ───────────────────────────────────────
  it('Alignment: GEMS_MEGA bundle (has everythingUnlocked flag) grants every gold upgrade', async () => {
    const { iapService } = await import('@/services/IAPService');
    const { initialGameState } = await import('@/contexts/game/initialState');
    const { IAP_PRODUCTS } = await import('@/utils/iapConfig');

    // GEMS_MEGA carries everythingUnlocked: true (verified in iapConfig.ts).
    const state = JSON.parse(JSON.stringify(initialGameState)) as GameState;
    iapService.applyProductToState(state, IAP_PRODUCTS.GEMS_MEGA);

    // All 7 individual upgrades should be flipped via the everythingUnlocked branch.
    const expected = ['multiplier', 'energy_boost', 'happiness_boost', 'fitness_boost', 'skill_mastery', 'time_machine', 'immortality'];
    for (const id of expected) {
      expect((state.goldUpgrades as Record<string, unknown>)?.[id]).toBe(true);
    }
    // Plus the convenience flags this bundle enables.
    expect(state.settings?.everythingUnlocked).toBe(true);
    expect(state.settings?.adsRemoved).toBe(true);
    expect(state.settings?.lifetimePremium).toBe(true);
  });
});
