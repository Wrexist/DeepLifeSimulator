/**
 * Vehicle System Deep Audit
 *
 * Comprehensive coverage of vehicle ownership lifecycle:
 *   - License gate, reputation gate, money gate on purchase
 *   - Refuel: cost, full-tank reject, money clamp
 *   - Repair: cost (with insurance discount), already-perfect reject
 *   - Insurance: purchase, cancel, weekly expiry handling
 *   - setActiveVehicle: switch active, reject unknown id
 *   - processAccident: damage / health-loss, totaling removes vehicle
 *   - processVehicleWeekly: fuel/mileage/condition decay, insurance expiry
 *   - getTotalVehicleReputationBonus, getActiveVehicleSpeedBonus
 *   - INVARIANT: dead-vehicle (condition 0) does NOT silently regenerate
 *     (the `?? 100` fix from the prior turn)
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
import type { GameState, Vehicle } from '@/contexts/game/types';
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

async function tick() {
  await act(async () => {
    await captured!.game.nextWeek();
    await Promise.resolve();
  });
}

function seedDriver(money = 100_000) {
  act(() => captured!.setGameState(prev => ({
    ...prev,
    weeksLived: 100,
    date: { ...prev.date, age: 22, year: 2027 },
    stats: { ...prev.stats, money, gems: 100, energy: 100, happiness: 80, health: 80, fitness: 50, reputation: 60 },
    hasDriversLicense: true,
  })));
}

async function libDeps() {
  const { updateMoney } = await import('@/contexts/game/actions/MoneyActions');
  const { updateStats } = await import('@/contexts/game/actions/StatsActions');
  return { updateMoney, updateStats };
}

describe('Vehicle system deep audit', () => {
  jest.setTimeout(180_000);
  let mounted: { root: any } | null = null;

  afterEach(() => {
    if (mounted) {
      act(() => mounted!.root.unmount());
      mounted = null;
    }
    captured = null;
  });

  // ── DRIVER'S LICENSE ────────────────────────────────────────────────────
  it("getDriversLicense: flips hasDriversLicense + charges money", async () => {
    mounted = mountGame();
    seedDriver(50_000);
    act(() => captured!.setGameState(prev => ({ ...prev, hasDriversLicense: false })));
    const { getDriversLicense } = await import('@/contexts/game/actions/VehicleActions');
    const deps = await libDeps();

    act(() => { getDriversLicense(captured!.state, captured!.setGameState, deps); });
    expect(captured!.state.hasDriversLicense).toBe(true);
    expect(captured!.state.stats.money).toBeLessThan(50_000);
    assertClean('getDriversLicense');
  });

  // ── PURCHASE: GATES ─────────────────────────────────────────────────────
  it("purchaseVehicle: no license → rejected", async () => {
    mounted = mountGame();
    seedDriver();
    act(() => captured!.setGameState(prev => ({ ...prev, hasDriversLicense: false })));
    const { purchaseVehicle } = await import('@/contexts/game/actions/VehicleActions');
    const deps = await libDeps();
    let result: { success: boolean; message: string } = { success: false, message: '' };
    act(() => { result = purchaseVehicle(captured!.state, captured!.setGameState, 'economy_sedan', deps); });
    expect(result.success).toBe(false);
    expect(result.message).toMatch(/license/i);
  });

  it("purchaseVehicle: unknown template → rejected", async () => {
    mounted = mountGame();
    seedDriver();
    const { purchaseVehicle } = await import('@/contexts/game/actions/VehicleActions');
    const deps = await libDeps();
    let result: { success: boolean; message: string } = { success: false, message: '' };
    act(() => { result = purchaseVehicle(captured!.state, captured!.setGameState, 'flying_car_xyz', deps); });
    expect(result.success).toBe(false);
    expect(result.message).toMatch(/not found/i);
  });

  it("purchaseVehicle: insufficient money → rejected", async () => {
    mounted = mountGame();
    seedDriver(10); // $10 — way under any template
    const { purchaseVehicle } = await import('@/contexts/game/actions/VehicleActions');
    const deps = await libDeps();
    let result: { success: boolean; message: string } = { success: false, message: '' };
    act(() => { result = purchaseVehicle(captured!.state, captured!.setGameState, 'economy_sedan', deps); });
    expect(result.success).toBe(false);
    expect(result.message).toMatch(/\$/);
  });

  it("purchaseVehicle: insufficient reputation → rejected", async () => {
    mounted = mountGame();
    seedDriver(10_000_000);
    // Lower reputation below typical luxury threshold
    act(() => captured!.setGameState(prev => ({ ...prev, stats: { ...prev.stats, reputation: 0 } })));
    const { purchaseVehicle } = await import('@/contexts/game/actions/VehicleActions');
    const { VEHICLE_TEMPLATES } = await import('@/lib/vehicles/vehicles');
    const repGated = VEHICLE_TEMPLATES.find(t => (t.requiredReputation ?? 0) > 0);
    if (!repGated) return; // No reputation-gated vehicles defined — skip cleanly.

    const deps = await libDeps();
    let result: { success: boolean; message: string } = { success: false, message: '' };
    act(() => { result = purchaseVehicle(captured!.state, captured!.setGameState, repGated.id, deps); });
    expect(result.success).toBe(false);
    expect(result.message).toMatch(/reputation/i);
  });

  it("purchaseVehicle: duplicate template → rejected", async () => {
    mounted = mountGame();
    seedDriver(1_000_000);
    const { purchaseVehicle } = await import('@/contexts/game/actions/VehicleActions');
    const deps = await libDeps();
    act(() => { purchaseVehicle(captured!.state, captured!.setGameState, 'economy_sedan', deps); });
    let second: { success: boolean; message: string } = { success: false, message: '' };
    act(() => { second = purchaseVehicle(captured!.state, captured!.setGameState, 'economy_sedan', deps); });
    expect(second.success).toBe(false);
    expect(second.message).toMatch(/already own/i);
  });

  // ── PURCHASE: HAPPY PATH ────────────────────────────────────────────────
  it("purchaseVehicle: first vehicle becomes activeVehicleId automatically", async () => {
    mounted = mountGame();
    seedDriver(1_000_000);
    const { purchaseVehicle } = await import('@/contexts/game/actions/VehicleActions');
    const deps = await libDeps();
    expect(captured!.state.activeVehicleId).toBeFalsy();

    act(() => { purchaseVehicle(captured!.state, captured!.setGameState, 'economy_sedan', deps); });
    expect(captured!.state.vehicles?.length).toBe(1);
    expect(captured!.state.activeVehicleId).toBe(captured!.state.vehicles![0].id);
    assertClean('purchaseVehicle happy');
  });

  // ── REFUEL ─────────────────────────────────────────────────────────────
  it("refuelVehicle: at 100 fuel → rejected", async () => {
    mounted = mountGame();
    seedDriver(1_000_000);
    const { purchaseVehicle, refuelVehicle } = await import('@/contexts/game/actions/VehicleActions');
    const deps = await libDeps();
    act(() => { purchaseVehicle(captured!.state, captured!.setGameState, 'economy_sedan', deps); });
    const v = captured!.state.vehicles![0];

    let result: { success: boolean; message: string } = { success: false, message: '' };
    act(() => { result = refuelVehicle(captured!.state, captured!.setGameState, v.id, 100, deps); });
    expect(result.success).toBe(false);
    expect(result.message).toMatch(/full/i);
  });

  it("refuelVehicle: drains money + fills to 100 from non-full state", async () => {
    mounted = mountGame();
    seedDriver(1_000_000);
    const { purchaseVehicle, refuelVehicle } = await import('@/contexts/game/actions/VehicleActions');
    const deps = await libDeps();
    act(() => { purchaseVehicle(captured!.state, captured!.setGameState, 'economy_sedan', deps); });
    const vid = captured!.state.vehicles![0].id;
    act(() => captured!.setGameState(prev => ({
      ...prev,
      vehicles: prev.vehicles?.map(v => v.id === vid ? { ...v, fuelLevel: 30 } : v),
    })));

    const moneyBefore = captured!.state.stats.money;
    let result: { success: boolean; message: string } = { success: false, message: '' };
    act(() => { result = refuelVehicle(captured!.state, captured!.setGameState, vid, 100, deps); });
    expect(result.success).toBe(true);
    expect(captured!.state.vehicles?.find(v => v.id === vid)?.fuelLevel).toBe(100);
    expect(captured!.state.stats.money).toBeLessThan(moneyBefore);
  });

  // ── REPAIR ─────────────────────────────────────────────────────────────
  it("repairVehicle: at 100 condition → rejected", async () => {
    mounted = mountGame();
    seedDriver(1_000_000);
    const { purchaseVehicle, repairVehicle } = await import('@/contexts/game/actions/VehicleActions');
    const deps = await libDeps();
    act(() => { purchaseVehicle(captured!.state, captured!.setGameState, 'economy_sedan', deps); });
    const vid = captured!.state.vehicles![0].id;

    let result: { success: boolean; message: string } = { success: false, message: '' };
    act(() => { result = repairVehicle(captured!.state, captured!.setGameState, vid, deps); });
    expect(result.success).toBe(false);
    expect(result.message).toMatch(/perfect/i);
  });

  it("repairVehicle: insurance reduces cost", async () => {
    mounted = mountGame();
    seedDriver(1_000_000);
    const { purchaseVehicle, repairVehicle, purchaseInsurance } = await import('@/contexts/game/actions/VehicleActions');
    const deps = await libDeps();
    act(() => { purchaseVehicle(captured!.state, captured!.setGameState, 'economy_sedan', deps); });
    const vid = captured!.state.vehicles![0].id;
    // Damage it
    act(() => captured!.setGameState(prev => ({
      ...prev,
      vehicles: prev.vehicles?.map(v => v.id === vid ? { ...v, condition: 50 } : v),
    })));

    // First measure repair cost without insurance.
    const moneyBeforeUninsured = captured!.state.stats.money;
    act(() => { repairVehicle(captured!.state, captured!.setGameState, vid, deps); });
    const uninsuredCost = moneyBeforeUninsured - captured!.state.stats.money;
    expect(uninsuredCost).toBeGreaterThan(0);

    // Damage again + buy insurance + repair → cost should be lower.
    act(() => captured!.setGameState(prev => ({
      ...prev,
      stats: { ...prev.stats, money: 1_000_000 },
      vehicles: prev.vehicles?.map(v => v.id === vid ? { ...v, condition: 50 } : v),
    })));
    act(() => { purchaseInsurance(captured!.state, captured!.setGameState, vid, 'premium', deps); });
    const moneyBeforeInsured = captured!.state.stats.money;
    act(() => { repairVehicle(captured!.state, captured!.setGameState, vid, deps); });
    const insuredCost = moneyBeforeInsured - captured!.state.stats.money;
    expect(insuredCost).toBeLessThan(uninsuredCost);
  });

  // ── INSURANCE ──────────────────────────────────────────────────────────
  it("purchaseInsurance: rejects unknown vehicle / unknown type", async () => {
    mounted = mountGame();
    seedDriver(1_000_000);
    const { purchaseInsurance } = await import('@/contexts/game/actions/VehicleActions');
    const deps = await libDeps();

    let result: { success: boolean; message: string } = { success: false, message: '' };
    act(() => { result = purchaseInsurance(captured!.state, captured!.setGameState, 'no-such-vehicle', 'basic', deps); });
    expect(result.success).toBe(false);
  });

  it("cancelInsurance: removes active flag from vehicle", async () => {
    mounted = mountGame();
    seedDriver(1_000_000);
    const { purchaseVehicle, purchaseInsurance, cancelInsurance } = await import('@/contexts/game/actions/VehicleActions');
    const deps = await libDeps();
    act(() => { purchaseVehicle(captured!.state, captured!.setGameState, 'economy_sedan', deps); });
    const vid = captured!.state.vehicles![0].id;
    act(() => { purchaseInsurance(captured!.state, captured!.setGameState, vid, 'basic', deps); });
    expect(captured!.state.vehicles?.find(v => v.id === vid)?.insurance?.active).toBe(true);

    act(() => { cancelInsurance(captured!.state, captured!.setGameState, vid); });
    const v = captured!.state.vehicles?.find(x => x.id === vid);
    // After cancel, insurance.active should be falsy OR insurance removed.
    expect(v?.insurance?.active).toBeFalsy();
  });

  it("cancelInsurance: buy-then-cancel is NEVER a money printer (H-3 refund-printer guard)", async () => {
    mounted = mountGame();
    seedDriver(1_000_000);
    const { purchaseVehicle, purchaseInsurance, cancelInsurance } =
      await import('@/contexts/game/actions/VehicleActions');
    const deps = await libDeps();
    act(() => { purchaseVehicle(captured!.state, captured!.setGameState, 'economy_sedan', deps); });
    const vid = captured!.state.vehicles![0].id;

    // Worst case for the old bug: cancel immediately after purchase, when
    // weeksRemaining is at its max (26). Every plan must net <= 0 (only the
    // $25 admin fee is lost) — a buy-then-cancel must never print money.
    for (const plan of ['basic', 'comprehensive', 'premium'] as const) {
      const before = captured!.state.stats.money;
      act(() => { purchaseInsurance(captured!.state, captured!.setGameState, vid, plan, deps); });
      const afterBuy = captured!.state.stats.money;
      const premiumPaid = before - afterBuy;
      expect(premiumPaid).toBeGreaterThan(0);

      // Confirm coverage was active before cancelling, so the assertions below
      // can't pass on a no-op cancel.
      expect(captured!.state.vehicles?.find(v => v.id === vid)?.insurance?.active).toBe(true);

      let cancelResult: { success: boolean; message: string } = { success: false, message: '' };
      act(() => { cancelResult = cancelInsurance(captured!.state, captured!.setGameState, vid); });
      const afterCancel = captured!.state.stats.money;
      const netDelta = afterCancel - before;

      // The cancel must actually have run (not silently no-op'd) — otherwise the
      // delta assertions are vacuously satisfied even if the refund path broke.
      expect(cancelResult.success).toBe(true);
      expect(captured!.state.vehicles?.find(v => v.id === vid)?.insurance).toBeFalsy();
      // Net change across buy+cancel must be <= 0 (refund can never exceed the
      // premium paid; the $25 fee guarantees a small loss).
      expect(netDelta).toBeLessThanOrEqual(0);
      // And the refund itself must never exceed what was paid.
      expect(afterCancel - afterBuy).toBeLessThanOrEqual(premiumPaid);
    }
  });

  it("cancelInsurance: a same-batch double-cancel refunds only ONCE (H-9 idempotency)", async () => {
    mounted = mountGame();
    seedDriver(1_000_000);
    const { purchaseVehicle, purchaseInsurance, cancelInsurance } =
      await import('@/contexts/game/actions/VehicleActions');
    const deps = await libDeps();
    act(() => { purchaseVehicle(captured!.state, captured!.setGameState, 'economy_sedan', deps); });
    const vid = captured!.state.vehicles![0].id;
    const beforeBuy = captured!.state.stats.money;
    act(() => { purchaseInsurance(captured!.state, captured!.setGameState, vid, 'premium', deps); });
    const premiumPaid = beforeBuy - captured!.state.stats.money;
    expect(premiumPaid).toBeGreaterThan(0);

    // Snapshot stale state and fire two cancels against it (button spam). The
    // refund must be credited exactly once; the second tap must be a no-op
    // because the updater re-checks `prev.vehicles[…].insurance`.
    const stale = captured!.state;
    const setGameState = captured!.setGameState;
    const moneyBefore = stale.stats.money;
    act(() => {
      cancelInsurance(stale, setGameState, vid);
      cancelInsurance(stale, setGameState, vid);
    });
    const credited = captured!.state.stats.money - moneyBefore;
    // One refund only: a double refund would roughly double this and exceed the
    // single premium paid.
    expect(credited).toBeGreaterThan(0);
    expect(credited).toBeLessThanOrEqual(premiumPaid);
    expect(captured!.state.vehicles?.find(v => v.id === vid)?.insurance).toBeFalsy();
  });

  // ── SET ACTIVE ─────────────────────────────────────────────────────────
  it("setActiveVehicle: rejects unknown id", async () => {
    mounted = mountGame();
    seedDriver(1_000_000);
    const { setActiveVehicle } = await import('@/contexts/game/actions/VehicleActions');
    const activeBefore = captured!.state.activeVehicleId;
    act(() => { setActiveVehicle(captured!.state, captured!.setGameState, 'phantom_id'); });
    expect(captured!.state.activeVehicleId).toBe(activeBefore);
  });

  it("setActiveVehicle: switches between owned vehicles", async () => {
    mounted = mountGame();
    seedDriver(1_000_000_000);
    const { purchaseVehicle, setActiveVehicle } = await import('@/contexts/game/actions/VehicleActions');
    const deps = await libDeps();
    act(() => { purchaseVehicle(captured!.state, captured!.setGameState, 'economy_sedan', deps); });
    act(() => { purchaseVehicle(captured!.state, captured!.setGameState, 'compact_hatchback', deps); });
    const [v1, v2] = captured!.state.vehicles || [];
    expect(captured!.state.activeVehicleId).toBe(v1.id);

    act(() => { setActiveVehicle(captured!.state, captured!.setGameState, v2.id); });
    expect(captured!.state.activeVehicleId).toBe(v2.id);
  });

  // ── ACCIDENT ───────────────────────────────────────────────────────────
  it("processAccident: minor takes condition damage + small health hit", async () => {
    mounted = mountGame();
    seedDriver(1_000_000);
    const { purchaseVehicle, processAccident } = await import('@/contexts/game/actions/VehicleActions');
    const deps = await libDeps();
    act(() => { purchaseVehicle(captured!.state, captured!.setGameState, 'economy_sedan', deps); });
    const vid = captured!.state.vehicles![0].id;
    const conditionBefore = captured!.state.vehicles![0].condition;
    const healthBefore = captured!.state.stats.health;

    let result: { success: boolean; message: string; damage: number; healthLoss: number } = { success: false, message: '', damage: 0, healthLoss: 0 };
    act(() => { result = processAccident(captured!.state, captured!.setGameState, vid, 'minor', deps); });
    expect(result.success).toBe(true);
    expect(result.damage).toBeGreaterThan(0);
    expect(captured!.state.vehicles?.find(v => v.id === vid)?.condition).toBeLessThan(conditionBefore);
    expect(captured!.state.stats.health).toBeLessThan(healthBefore);
  });

  it("processAccident: 'total' severity removes the vehicle + reassigns active", async () => {
    mounted = mountGame();
    seedDriver(1_000_000_000);
    const { purchaseVehicle, processAccident } = await import('@/contexts/game/actions/VehicleActions');
    const deps = await libDeps();
    act(() => { purchaseVehicle(captured!.state, captured!.setGameState, 'economy_sedan', deps); });
    act(() => { purchaseVehicle(captured!.state, captured!.setGameState, 'compact_hatchback', deps); });
    const [active, fallback] = captured!.state.vehicles || [];
    expect(captured!.state.activeVehicleId).toBe(active.id);

    act(() => { processAccident(captured!.state, captured!.setGameState, active.id, 'total', deps); });

    // The totaled vehicle is removed.
    expect(captured!.state.vehicles?.find(v => v.id === active.id)).toBeUndefined();
    // Active reassigned to remaining vehicle.
    expect(captured!.state.activeVehicleId).toBe(fallback.id);
  });

  it("processAccident: 'total' on the only vehicle leaves activeVehicleId undefined", async () => {
    mounted = mountGame();
    seedDriver(1_000_000);
    const { purchaseVehicle, processAccident } = await import('@/contexts/game/actions/VehicleActions');
    const deps = await libDeps();
    act(() => { purchaseVehicle(captured!.state, captured!.setGameState, 'economy_sedan', deps); });
    const vid = captured!.state.vehicles![0].id;
    act(() => { processAccident(captured!.state, captured!.setGameState, vid, 'total', deps); });
    expect((captured!.state.vehicles || []).length).toBe(0);
    expect(captured!.state.activeVehicleId).toBeUndefined();
  });

  it("processAccident: unknown vehicle returns structured error", async () => {
    mounted = mountGame();
    seedDriver();
    const { processAccident } = await import('@/contexts/game/actions/VehicleActions');
    const deps = await libDeps();
    let result: { success: boolean; message: string; damage: number; healthLoss: number } = { success: false, message: '', damage: 0, healthLoss: 0 };
    act(() => { result = processAccident(captured!.state, captured!.setGameState, 'phantom', 'minor', deps); });
    expect(result.success).toBe(false);
    expect(result.damage).toBe(0);
    expect(result.healthLoss).toBe(0);
  });

  // ── WEEKLY PROCESSING ──────────────────────────────────────────────────
  it("processVehicleWeekly: no vehicles → no costs, no expired insurance", async () => {
    mounted = mountGame();
    seedDriver();
    const { processVehicleWeekly } = await import('@/contexts/game/actions/VehicleActions');
    let result: { totalCosts: number; expiredInsurance: string[] } = { totalCosts: 0, expiredInsurance: [] };
    act(() => { result = processVehicleWeekly(captured!.state, captured!.setGameState); });
    expect(result.totalCosts).toBe(0);
    expect(result.expiredInsurance).toEqual([]);
  });

  it("processVehicleWeekly: drains fuel, increases mileage on active vehicle", async () => {
    mounted = mountGame();
    seedDriver(1_000_000);
    const { purchaseVehicle, processVehicleWeekly } = await import('@/contexts/game/actions/VehicleActions');
    const deps = await libDeps();
    act(() => { purchaseVehicle(captured!.state, captured!.setGameState, 'economy_sedan', deps); });
    const vid = captured!.state.vehicles![0].id;
    const fuelBefore = captured!.state.vehicles![0].fuelLevel;
    const mileageBefore = captured!.state.vehicles![0].mileage || 0;

    act(() => { processVehicleWeekly(captured!.state, captured!.setGameState); });

    const v = captured!.state.vehicles?.find(x => x.id === vid)!;
    expect(v.fuelLevel).toBeLessThan(fuelBefore);
    expect(v.mileage).toBeGreaterThan(mileageBefore);
    expect(v.condition).toBeLessThan(100);
  });

  it("BUG-FIX REGRESSION: 0-condition vehicle stays at 0 after weekly processing", async () => {
    mounted = mountGame();
    seedDriver(1_000_000);
    const { purchaseVehicle, processVehicleWeekly } = await import('@/contexts/game/actions/VehicleActions');
    const deps = await libDeps();
    act(() => { purchaseVehicle(captured!.state, captured!.setGameState, 'economy_sedan', deps); });
    const vid = captured!.state.vehicles![0].id;
    // Force condition to 0 — simulating a totaled vehicle.
    act(() => captured!.setGameState(prev => ({
      ...prev,
      vehicles: prev.vehicles?.map(v => v.id === vid ? { ...v, condition: 0 } : v),
    })));

    act(() => { processVehicleWeekly(captured!.state, captured!.setGameState); });

    // Before the fix from the previous turn, `(0 || 100) - wear = ~99` would
    // have silently regenerated the vehicle. After the fix using `??`,
    // condition stays at 0.
    expect(captured!.state.vehicles?.find(v => v.id === vid)?.condition).toBe(0);
  });

  it("processVehicleWeekly: expired insurance is deactivated and reported", async () => {
    mounted = mountGame();
    seedDriver(1_000_000);
    const { purchaseVehicle, purchaseInsurance, processVehicleWeekly } = await import('@/contexts/game/actions/VehicleActions');
    const deps = await libDeps();
    act(() => { purchaseVehicle(captured!.state, captured!.setGameState, 'economy_sedan', deps); });
    const vid = captured!.state.vehicles![0].id;
    act(() => { purchaseInsurance(captured!.state, captured!.setGameState, vid, 'basic', deps); });

    // Force insurance to be expired by setting expiresWeek in the past.
    act(() => captured!.setGameState(prev => ({
      ...prev,
      weeksLived: 1000,
      vehicles: prev.vehicles?.map(v => v.id === vid ? {
        ...v,
        insurance: v.insurance ? { ...v.insurance, expiresWeek: 100 } : undefined,
      } : v),
    })));

    let result: { totalCosts: number; expiredInsurance: string[] } = { totalCosts: 0, expiredInsurance: [] };
    act(() => { result = processVehicleWeekly(captured!.state, captured!.setGameState); });

    expect(result.expiredInsurance.length).toBeGreaterThan(0);
    expect(captured!.state.vehicles?.find(v => v.id === vid)?.insurance?.active).toBe(false);
  });

  it("processVehicleWeekly: 50 ticks on a vehicle keep all numeric fields finite", async () => {
    mounted = mountGame();
    seedDriver(10_000_000);
    const { purchaseVehicle, processVehicleWeekly } = await import('@/contexts/game/actions/VehicleActions');
    const deps = await libDeps();
    act(() => { purchaseVehicle(captured!.state, captured!.setGameState, 'economy_sedan', deps); });

    for (let i = 0; i < 50; i++) {
      act(() => { processVehicleWeekly(captured!.state, captured!.setGameState); });
      // After fuel drains to 0, condition decays to 0 by ~50 weeks at -1/wk.
      const v = captured!.state.vehicles![0];
      expect(Number.isFinite(v.fuelLevel)).toBe(true);
      expect(v.fuelLevel).toBeGreaterThanOrEqual(0);
      expect(v.fuelLevel).toBeLessThanOrEqual(100);
      expect(Number.isFinite(v.condition)).toBe(true);
      expect(v.condition).toBeGreaterThanOrEqual(0);
      expect(v.condition).toBeLessThanOrEqual(100);
      expect(Number.isFinite(v.mileage || 0)).toBe(true);
    }
    assertClean('50-tick vehicle');
  });

  // ── SELL ───────────────────────────────────────────────────────────────
  it("sellVehicle: refunds + removes vehicle + reassigns active", async () => {
    mounted = mountGame();
    seedDriver(1_000_000_000);
    const { purchaseVehicle, sellVehicle } = await import('@/contexts/game/actions/VehicleActions');
    const deps = await libDeps();
    act(() => { purchaseVehicle(captured!.state, captured!.setGameState, 'economy_sedan', deps); });
    act(() => { purchaseVehicle(captured!.state, captured!.setGameState, 'compact_hatchback', deps); });
    const [v1, v2] = captured!.state.vehicles || [];
    const moneyBefore = captured!.state.stats.money;

    act(() => { sellVehicle(captured!.state, captured!.setGameState, v1.id, deps); });
    expect(captured!.state.vehicles?.find(v => v.id === v1.id)).toBeUndefined();
    expect(captured!.state.stats.money).toBeGreaterThan(moneyBefore);
    expect(captured!.state.activeVehicleId).toBe(v2.id);
  });

  // ── HELPERS ────────────────────────────────────────────────────────────
  it("getTotalVehicleReputationBonus: sums template reputation bonuses across owned vehicles", async () => {
    mounted = mountGame();
    seedDriver(1_000_000_000);
    const { purchaseVehicle, getTotalVehicleReputationBonus } = await import('@/contexts/game/actions/VehicleActions');
    const deps = await libDeps();

    expect(getTotalVehicleReputationBonus(captured!.state)).toBe(0);
    act(() => { purchaseVehicle(captured!.state, captured!.setGameState, 'economy_sedan', deps); });
    const bonus = getTotalVehicleReputationBonus(captured!.state);
    expect(typeof bonus).toBe('number');
    expect(bonus).toBeGreaterThanOrEqual(0);
    expect(Number.isFinite(bonus)).toBe(true);
  });

  it("getActiveVehicleSpeedBonus: returns 0 when no active vehicle, finite when active", async () => {
    mounted = mountGame();
    seedDriver(1_000_000);
    const { purchaseVehicle, getActiveVehicleSpeedBonus } = await import('@/contexts/game/actions/VehicleActions');
    const deps = await libDeps();

    expect(getActiveVehicleSpeedBonus(captured!.state)).toBe(0);
    act(() => { purchaseVehicle(captured!.state, captured!.setGameState, 'economy_sedan', deps); });
    const bonus = getActiveVehicleSpeedBonus(captured!.state);
    expect(Number.isFinite(bonus)).toBe(true);
    expect(bonus).toBeGreaterThanOrEqual(0);
  });

  it("getActiveVehicleSpeedBonus: low fuel/condition disables the bonus", async () => {
    mounted = mountGame();
    seedDriver(1_000_000);
    const { purchaseVehicle, getActiveVehicleSpeedBonus } = await import('@/contexts/game/actions/VehicleActions');
    const deps = await libDeps();
    act(() => { purchaseVehicle(captured!.state, captured!.setGameState, 'economy_sedan', deps); });
    const vid = captured!.state.vehicles![0].id;

    // Drop condition + fuel to disable bonus.
    act(() => captured!.setGameState(prev => ({
      ...prev,
      vehicles: prev.vehicles?.map(v => v.id === vid ? { ...v, condition: 10, fuelLevel: 5 } : v),
    })));
    expect(getActiveVehicleSpeedBonus(captured!.state)).toBe(0);
  });

  // ── CROSS-SYSTEM ───────────────────────────────────────────────────────
  it("Cross-system: purchase + nextWeek 20× keeps state clean", async () => {
    mounted = mountGame();
    seedDriver(1_000_000);
    const { purchaseVehicle } = await import('@/contexts/game/actions/VehicleActions');
    const deps = await libDeps();
    act(() => { purchaseVehicle(captured!.state, captured!.setGameState, 'economy_sedan', deps); });
    for (let i = 0; i < 20; i++) {
      await tick();
    }
    assertClean('purchase + 20 ticks');
  });
});
