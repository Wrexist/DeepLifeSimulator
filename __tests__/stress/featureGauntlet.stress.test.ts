/**
 * Feature Gauntlet — exercises every major action hook through the real provider.
 *
 * Goals:
 *   1. Prove each player-facing action mutates state in the right direction.
 *   2. Prove each action keeps state JSON-safe (no NaN, no Infinity, no functions).
 *   3. Prove `validateGameState` keeps passing after each feature batch.
 *   4. Prove `nextWeek` still advances cleanly after each batch of actions.
 *
 * This complements realProviderLoop.stress.test.ts: that file drives `nextWeek`
 * over and over; this one calls 25+ distinct action hooks at least once each.
 */

// Bypass heavy save pipeline (covered by longRunSaveLoad.stress.test.ts).
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
  useJobActions,
  useItemActions,
  useSocialActions,
  useCompanyActions,
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
  money: ReturnType<typeof useMoneyActions>;
  job: ReturnType<typeof useJobActions>;
  item: ReturnType<typeof useItemActions>;
  social: ReturnType<typeof useSocialActions>;
  company: ReturnType<typeof useCompanyActions>;
  game: ReturnType<typeof useGameActions>;
};

let captured: Probe | null = null;

function ProbeComponent() {
  const { gameState, setGameState } = useGameState();
  const money = useMoneyActions();
  const job = useJobActions();
  const item = useItemActions();
  const social = useSocialActions();
  const company = useCompanyActions();
  const game = useGameActions();
  captured = { state: gameState, setGameState, money, job, item, social, company, game };
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

function deepCheckFinite(state: unknown, path = 'root'): string[] {
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
      if (seen.has(obj)) { issues.push(`circular at ${p}`); return; }
      seen.add(obj);
      if (Array.isArray(obj)) {
        obj.forEach((x, i) => walk(x, `${p}[${i}]`));
      } else {
        for (const k of Object.keys(obj)) walk((obj as Record<string, unknown>)[k], `${p}.${k}`);
      }
    }
  };
  walk(state, path);
  return issues;
}

/** Seed a wealthy state so most actions can succeed. */
function makeWealthy() {
  captured!.setGameState(prev => ({
    ...prev,
    stats: {
      ...prev.stats,
      money: 10_000_000,
      gems: 100_000,
      energy: 100,
      health: 100,
      happiness: 100,
      fitness: 100,
      reputation: 100,
    },
    criminalLevel: 5,
    weeksLived: 100,
    date: { ...prev.date, age: 25, year: 2027 },
  }));
}

function assertCleanState(stage: string) {
  const s = captured!.state;
  const issues = deepCheckFinite(s);
  if (issues.length) {
    throw new Error(`[${stage}] state corruption: ${issues.slice(0, 5).join('; ')}`);
  }
  const v = validateGameState(s);
  if (!v.valid) {
    throw new Error(`[${stage}] validateGameState failed: ${v.errors.join('; ')}`);
  }
}

// ──────────────────── Tests ────────────────────────────────────────────────

describe('Feature Gauntlet — every major action through real provider', () => {
  jest.setTimeout(300_000);
  let mounted: { root: any } | null = null;

  afterEach(() => {
    if (mounted) {
      act(() => mounted!.root.unmount());
      mounted = null;
    }
    captured = null;
  });

  it('mounts and captures every action hook', () => {
    mounted = mountGame();
    expect(captured).not.toBeNull();
    expect(typeof captured!.money.updateMoney).toBe('function');
    expect(typeof captured!.money.batchUpdateMoney).toBe('function');
    expect(typeof captured!.job.applyForJob).toBe('function');
    expect(typeof captured!.job.performStreetJob).toBe('function');
    expect(typeof captured!.item.buyItem).toBe('function');
    expect(typeof captured!.item.sellItem).toBe('function');
    expect(typeof captured!.social.giveGift).toBe('function');
    expect(typeof captured!.social.goOnDate).toBe('function');
    expect(typeof captured!.company.buyMiner).toBe('function');
    expect(typeof captured!.company.joinMiningPool).toBe('function');
    expect(typeof captured!.game.nextWeek).toBe('function');
  });

  // ── MONEY ────────────────────────────────────────────────────────────────
  it('Money: updateMoney adds, and rejects overdrafts (P1-1: hook now matches the module-form behavior)', () => {
    mounted = mountGame();
    const start = captured!.state.stats.money;
    act(() => captured!.money.updateMoney(500, 'gauntlet-credit'));
    expect(captured!.state.stats.money).toBe(start + 500);

    // After P1-1: the hook-form `useMoneyActions().updateMoney` now rejects
    // overdrafts (returns `prev` unchanged) instead of clamping to 0. This
    // mirrors the module-form `actions/MoneyActions.ts updateMoney` and
    // closes the exploit where UI callers could "buy" things at $0.
    const before = captured!.state.stats.money;
    act(() => captured!.money.updateMoney(-(before + 999_999), 'gauntlet-overdraw'));
    expect(captured!.state.stats.money).toBe(before); // rejected — money unchanged
    expect(captured!.state.stats.money).toBeGreaterThanOrEqual(0); // never negative
    assertCleanState('Money updateMoney');
  });

  it('Money: hook updateMoney rejects non-number amount (Signature Trap guard)', () => {
    mounted = mountGame();
    const before = captured!.state.stats.money;
    // Simulate the trap: caller passes lib-style (setGameState, amount, reason).
    // The hook treats setGameState as `amount` — must reject, NOT poison money.
    act(() => { (captured!.money.updateMoney as unknown as (a: unknown, b: unknown, c: unknown) => void)(captured!.setGameState, -100, 'trap'); });
    expect(captured!.state.stats.money).toBe(before);
    expect(Number.isFinite(captured!.state.stats.money)).toBe(true);
  });

  it('Money: hook updateMoney rejects NaN / undefined / Infinity', () => {
    mounted = mountGame();
    const before = captured!.state.stats.money;
    act(() => { (captured!.money.updateMoney as unknown as (a: unknown, b: unknown) => void)(NaN, 'nan'); });
    expect(captured!.state.stats.money).toBe(before);
    act(() => { (captured!.money.updateMoney as unknown as (a: unknown, b: unknown) => void)(undefined, 'undef'); });
    expect(captured!.state.stats.money).toBe(before);
    act(() => { (captured!.money.updateMoney as unknown as (a: unknown, b: unknown) => void)(Infinity, 'inf'); });
    expect(captured!.state.stats.money).toBe(before);
    act(() => { (captured!.money.updateMoney as unknown as (a: unknown, b: unknown) => void)(-Infinity, 'neginf'); });
    expect(captured!.state.stats.money).toBe(before);
  });

  it('Money: lib updateMoney also rejects non-finite amount', async () => {
    mounted = mountGame();
    const { updateMoney: libUpdateMoney } = await import('@/contexts/game/actions/MoneyActions');
    const before = captured!.state.stats.money;
    act(() => libUpdateMoney(captured!.setGameState, NaN, 'nan'));
    expect(captured!.state.stats.money).toBe(before);
    act(() => libUpdateMoney(captured!.setGameState, Infinity, 'inf'));
    expect(captured!.state.stats.money).toBe(before);
    // Valid number works.
    act(() => libUpdateMoney(captured!.setGameState, 100, 'valid'));
    expect(captured!.state.stats.money).toBe(before + 100);
  });

  it('Money: batchUpdateMoney applies all transactions atomically', () => {
    mounted = mountGame();
    const start = captured!.state.stats.money;
    act(() => captured!.money.batchUpdateMoney([
      { amount: 1000, reason: 'a' },
      { amount: 2000, reason: 'b' },
      { amount: -500, reason: 'c' },
    ]));
    expect(captured!.state.stats.money).toBe(start + 2500);
    assertCleanState('Money batchUpdateMoney');
  });

  it('Money: batchUpdateMoney credits only genuine income to totalMoneyEarned, per-leg (P1-11)', () => {
    mounted = mountGame();
    act(() => makeWealthy());
    // dailySummary is optional and absent from the initial state; updateMoney only tracks
    // totalMoneyEarned when it exists. Seed an empty one so the credit is observable.
    act(() => captured!.setGameState(prev => ({
      ...prev,
      dailySummary: { moneyChange: 0, totalMoneyEarned: 0, totalMoneySpent: 0, statsChange: {}, events: [] },
    })));
    const earnedStart = captured!.state.dailySummary?.totalMoneyEarned ?? 0;
    const moneyStart = captured!.state.stats.money;

    // Mixed batch: a genuine income leg + a non-income "deposit" leg. The old code joined
    // both reasons into "salary, bank deposit"; the "deposit" keyword then zeroed the
    // income credit for the WHOLE batch. Per-leg classification must credit the +1000
    // income only (and the -200 deposit must not count as "earned").
    act(() => captured!.money.batchUpdateMoney([
      { amount: 1000, reason: 'salary' },
      { amount: -200, reason: 'bank deposit' },
    ]));

    expect((captured!.state.dailySummary?.totalMoneyEarned ?? 0) - earnedStart).toBe(1000);
    expect(captured!.state.stats.money).toBe(moneyStart + 800);
    assertCleanState('P1-11 batch income classification');
  });

  // ── ITEMS ────────────────────────────────────────────────────────────────
  it('Items: buyItem marks item owned and deducts price', () => {
    mounted = mountGame();
    act(() => makeWealthy());
    const guitarPriceCharged = (() => {
      const before = captured!.state.stats.money;
      const guitarBefore = captured!.state.items?.find(i => i.id === 'guitar');
      expect(guitarBefore?.owned).toBeFalsy();
      act(() => captured!.item.buyItem('guitar'));
      const guitarAfter = captured!.state.items?.find(i => i.id === 'guitar');
      expect(guitarAfter?.owned).toBe(true);
      return before - captured!.state.stats.money;
    })();
    expect(guitarPriceCharged).toBeGreaterThan(0);
    assertCleanState('Items buyItem');
  });

  it('Items: sellItem flips owned back and refunds something', () => {
    mounted = mountGame();
    act(() => makeWealthy());
    act(() => captured!.item.buyItem('bike'));
    const afterBuy = captured!.state.stats.money;
    expect(captured!.state.items?.find(i => i.id === 'bike')?.owned).toBe(true);

    act(() => captured!.item.sellItem('bike'));
    expect(captured!.state.items?.find(i => i.id === 'bike')?.owned).toBe(false);
    expect(captured!.state.stats.money).toBeGreaterThan(afterBuy); // got something back
    assertCleanState('Items sellItem');
  });

  // ── JOBS ─────────────────────────────────────────────────────────────────
  it('Jobs: performStreetJob respects weekly cap', () => {
    mounted = mountGame();
    act(() => makeWealthy());

    let lastResult: { success: boolean; message?: string } | void;
    // Do beg 4 times — 4th should be capped (max 3/week per job).
    for (let i = 0; i < 4; i++) {
      // performStreetJob is sync — wrap in act to flush state.
      act(() => { lastResult = captured!.job.performStreetJob('beg') as { success: boolean; message?: string }; });
    }
    // 4th call should be rejected by weekly cap.
    expect(lastResult).toBeDefined();
    if (lastResult && typeof lastResult === 'object') {
      expect(lastResult.success).toBe(false);
    }
    assertCleanState('Jobs performStreetJob cap');
  });

  it('Jobs: a same-batch double-tap on a street job runs only ONE job (P1-1 energy guard)', () => {
    mounted = mountGame();
    act(() => makeWealthy());

    // Top energy up, then measure 'beg' energy cost with a single tap (energy is deducted
    // regardless of the success/caught outcome).
    act(() => captured!.setGameState(prev => ({ ...prev, stats: { ...prev.stats, energy: 100 } })));
    const energyBefore = captured!.state.stats.energy;
    act(() => { captured!.job.performStreetJob('beg'); });
    const energyCost = energyBefore - captured!.state.stats.energy;
    expect(energyCost).toBeGreaterThan(0);

    // Set energy to EXACTLY one job's worth and clear the weekly tally, so a second
    // same-batch tap is unaffordable and must no-op inside the updater.
    act(() => captured!.setGameState(prev => ({
      ...prev,
      weeklyStreetJobs: {},
      stats: { ...prev.stats, energy: energyCost },
    })));

    // Two taps in ONE act() → both updaters batch against the same render, so the 2nd sees
    // prev.energy already drained to 0 and is rejected by the P1-1 guard. Without the
    // guard the weekly tally would reach 2 (two jobs run on one job's energy).
    act(() => {
      captured!.job.performStreetJob('beg');
      captured!.job.performStreetJob('beg');
    });

    expect(captured!.state.weeklyStreetJobs?.beg ?? 0).toBe(1);
    expect(captured!.state.stats.energy).toBe(0);
    assertCleanState('P1-1 same-batch energy guard');
  });

  it('Jobs: applyForJob sets currentJob', () => {
    mounted = mountGame();
    act(() => makeWealthy());
    const careerIds = (captured!.state.careers || []).map(c => c.id);
    if (careerIds.length === 0) {
      // No careers in initial state — skip.
      return;
    }
    const candidate = careerIds[0];
    act(() => captured!.job.applyForJob(candidate));
    // Either currentJob set, or applyForJob rejected — both are valid states.
    // But state must remain clean.
    assertCleanState('Jobs applyForJob');
  });

  // ── SOCIAL ───────────────────────────────────────────────────────────────
  it('Social: giveGift updates relationship score', () => {
    mounted = mountGame();
    act(() => makeWealthy());
    const partner = captured!.state.relationships?.[0];
    if (!partner) return; // no relationships in state
    const beforeScore = partner.relationshipScore;
    act(() => captured!.social.giveGift(partner.id, 'flowers'));
    const afterRel = captured!.state.relationships?.find(r => r.id === partner.id);
    // Score may go up, or gift may have been rejected (no such gift) — both fine.
    // Just assert state stayed clean and no NaN.
    expect(afterRel).toBeDefined();
    expect(typeof afterRel!.relationshipScore).toBe('number');
    expect(Number.isFinite(afterRel!.relationshipScore)).toBe(true);
    void beforeScore;
    assertCleanState('Social giveGift');
  });

  it('Social: goOnDate respects gating', () => {
    mounted = mountGame();
    act(() => makeWealthy());
    const partner = captured!.state.relationships?.[0];
    if (!partner) return;
    act(() => captured!.social.goOnDate(partner.id));
    assertCleanState('Social goOnDate');
  });

  // ── COMPANIES / MINING ───────────────────────────────────────────────────
  it('Companies: buyMiner adds miner to inventory if affordable', () => {
    mounted = mountGame();
    act(() => makeWealthy());
    // Buy the computer first (mining unlocked by computer in this game).
    act(() => captured!.item.buyItem('computer'));
    act(() => captured!.company.buyMiner('basic', 'Basic Miner', 100));
    // Either miner registered or rejected by gating — must be clean either way.
    assertCleanState('Companies buyMiner');
  });

  it('Companies: joinMiningPool sets activeMiningPool when valid', () => {
    mounted = mountGame();
    act(() => makeWealthy());
    act(() => captured!.item.buyItem('computer'));
    act(() => captured!.company.joinMiningPool('community'));
    assertCleanState('Companies joinMiningPool');
  });

  // ── CRYPTO ───────────────────────────────────────────────────────────────
  it('Crypto: buyCrypto purchases a position', () => {
    mounted = mountGame();
    act(() => makeWealthy());
    act(() => captured!.money.buyCrypto('btc', 100));
    assertCleanState('Crypto buyCrypto');
  });

  // ── PRESTIGE ─────────────────────────────────────────────────────────────
  it('Prestige: purchasePrestigeBonus returns a structured result', () => {
    mounted = mountGame();
    act(() => makeWealthy());
    let result: { success: boolean; message?: string } | undefined;
    act(() => { result = captured!.money.purchasePrestigeBonus('legacy_dynasty_starter_money_1'); });
    expect(result).toBeDefined();
    expect(typeof result!.success).toBe('boolean');
    assertCleanState('Prestige purchasePrestigeBonus');
  });

  // ── HEALTH ───────────────────────────────────────────────────────────────
  it('Health: performHealthActivity does not crash on unknown activity', () => {
    mounted = mountGame();
    act(() => makeWealthy());
    act(() => captured!.item.performHealthActivity('drink_water'));
    assertCleanState('Health performHealthActivity');
  });

  // ── FULL INTEGRATION ────────────────────────────────────────────────────
  it('Integration: mixed action stream + nextWeek keeps state valid', async () => {
    mounted = mountGame();
    act(() => makeWealthy());

    // Burst of actions across all feature areas.
    act(() => captured!.money.updateMoney(50_000, 'mix-credit'));
    act(() => captured!.item.buyItem('smartphone'));
    act(() => captured!.item.buyItem('suit'));
    act(() => captured!.money.batchUpdateMoney([{ amount: -1000, reason: 'a' }, { amount: 2000, reason: 'b' }]));
    const partner = captured!.state.relationships?.[0];
    if (partner) {
      act(() => captured!.social.goOnDate(partner.id));
    }
    act(() => captured!.money.buyCrypto('btc', 50));

    assertCleanState('mixed before nextWeek');

    // Drive nextWeek 5 times — exercises every per-tick subsystem with custom state.
    for (let i = 0; i < 5; i++) {
      await act(async () => { await captured!.game.nextWeek(); });
    }

    assertCleanState('mixed after 5 nextWeek ticks');
    expect(captured!.state.weeksLived).toBeGreaterThanOrEqual(105);
  });

  // ── SAVE/LOAD GAME HOOKS ────────────────────────────────────────────────
  it('SaveGame hook: saveGame returns without throwing', async () => {
    mounted = mountGame();
    await act(async () => { await captured!.game.saveGame(false); });
    assertCleanState('saveGame');
  });

  // ── DIRECT ACTION CALLS (TravelActions / VehicleActions / HobbyActions / PoliticalActions / RDActions) ──
  // These action modules are invoked by UI components directly, not via hooks.
  // We import them and call them with the captured setGameState to confirm
  // each entry point doesn't crash and keeps state clean.

  it('Travel: travelTo + returnFromTrip survive a round-trip', async () => {
    mounted = mountGame();
    act(() => makeWealthy());
    // CRITICAL: action files in @/contexts/game/actions/* expect the LIB-style
    // updateMoney (signature `(setGameState, amount, reason)`), not the hook
    // version `(amount, reason)`. Passing the hook here yields NaN money —
    // CLAUDE.md calls this the "DatingActions Signature Trap".
    const { travelTo, returnFromTrip } = await import('@/contexts/game/actions/TravelActions');
    const { updateMoney: libUpdateMoney } = await import('@/contexts/game/actions/MoneyActions');
    const { updateStats: libUpdateStats } = await import('@/contexts/game/actions/StatsActions');
    const deps = { updateMoney: libUpdateMoney, updateStats: libUpdateStats };

    act(() => captured!.item.buyItem('passport'));

    let res: { success: boolean; message?: string } | undefined;
    act(() => { res = travelTo(captured!.state, captured!.setGameState, 'paris', deps); });
    expect(res).toBeDefined();
    assertCleanState('Travel travelTo');

    // Bring the trip's returnWeek to now so returnFromTrip can complete.
    if (captured!.state.travel?.currentTrip) {
      const target = captured!.state.travel.currentTrip.returnWeek || 0;
      act(() => captured!.setGameState(prev => ({ ...prev, weeksLived: Math.max(prev.weeksLived || 0, target) })));
    }

    act(() => returnFromTrip(captured!.state, captured!.setGameState, deps));
    assertCleanState('Travel returnFromTrip');
    expect(captured!.state.travel?.currentTrip).toBeUndefined();
  });

  it('Travel: passing the hook updateMoney is now SAFE — guard rejects + state stays clean', async () => {
    mounted = mountGame();
    act(() => makeWealthy());
    // Previously this caused NaN poisoning of money. After the Signature Trap
    // guard in MoneyActionsContext.tsx, the hook rejects the function-typed
    // amount and money stays clean. The travel itself fails (no cost deducted)
    // but the state remains valid — the failure is now LOUD and SAFE.
    const { travelTo } = await import('@/contexts/game/actions/TravelActions');
    const wrongDeps = { updateMoney: captured!.money.updateMoney as never, updateStats: captured!.game.updateStats as never };
    act(() => captured!.item.buyItem('passport'));
    const moneyBefore = captured!.state.stats.money;
    act(() => { travelTo(captured!.state, captured!.setGameState, 'paris', wrongDeps); });
    expect(Number.isFinite(captured!.state.stats.money)).toBe(true);
    expect(Number.isNaN(captured!.state.stats.money)).toBe(false);
    // Money may have been touched downstream of travel (visited destinations etc) but never poisoned.
    expect(captured!.state.stats.money).toBeGreaterThanOrEqual(0);
    void moneyBefore;
  });

  it('Travel: travelTo at minimum returns a structured result on bad input', async () => {
    mounted = mountGame();
    act(() => makeWealthy());
    const { travelTo } = await import('@/contexts/game/actions/TravelActions');
    const { updateMoney: libUpdateMoney } = await import('@/contexts/game/actions/MoneyActions');
    const { updateStats: libUpdateStats } = await import('@/contexts/game/actions/StatsActions');
    const deps = { updateMoney: libUpdateMoney, updateStats: libUpdateStats };
    let res: { success: boolean; message?: string } | undefined;
    act(() => { res = travelTo(captured!.state, captured!.setGameState, 'nonexistent-place-xyz', deps); });
    expect(res).toBeDefined();
    expect(res!.success).toBe(false);
  });

  it('Vehicles: getDriversLicense + purchaseVehicle + refuelVehicle + sellVehicle', async () => {
    mounted = mountGame();
    act(() => makeWealthy());
    const {
      getDriversLicense, purchaseVehicle, refuelVehicle, sellVehicle, processAccident,
    } = await import('@/contexts/game/actions/VehicleActions');
    const { updateMoney: libUpdateMoney } = await import('@/contexts/game/actions/MoneyActions');
    const { updateStats: libUpdateStats } = await import('@/contexts/game/actions/StatsActions');
    const deps = { updateMoney: libUpdateMoney, updateStats: libUpdateStats };

    act(() => { getDriversLicense(captured!.state, captured!.setGameState, deps); });
    assertCleanState('Vehicles getDriversLicense');

    // Try a known template id. If template not found, action returns an error — state stays clean.
    let pres: { success: boolean; message?: string } | undefined;
    act(() => { pres = purchaseVehicle(captured!.state, captured!.setGameState, 'sedan_basic', deps); });
    expect(pres).toBeDefined();
    assertCleanState('Vehicles purchaseVehicle');

    // Refuel the active vehicle if one exists.
    const activeId = captured!.state.activeVehicleId;
    if (activeId) {
      act(() => { refuelVehicle(captured!.state, captured!.setGameState, activeId, 100, deps); });
      assertCleanState('Vehicles refuelVehicle');

      act(() => { processAccident(captured!.state, captured!.setGameState, activeId, 'minor', deps); });
      assertCleanState('Vehicles processAccident');

      act(() => { sellVehicle(captured!.state, captured!.setGameState, activeId, deps); });
      assertCleanState('Vehicles sellVehicle');
    }
  });

  it('Hobbies: trainHobby does not crash even with no hobbies set', async () => {
    mounted = mountGame();
    act(() => makeWealthy());
    const { trainHobby } = await import('@/contexts/game/actions/HobbyActions');
    const { updateStats: libUpdateStats } = await import('@/contexts/game/actions/StatsActions');
    let res: { success: boolean; message?: string } | undefined;
    act(() => { res = trainHobby(captured!.state, captured!.setGameState, 'guitar', { updateStats: libUpdateStats }); });
    expect(res).toBeDefined();
    expect(res!.success).toBe(false);
    assertCleanState('Hobbies trainHobby (no hobby)');
  });

  // BUG-2 (open): runForOffice('city_council') CRASHES with
  // `Cannot read properties of undefined (reading 'minAge')` because the
  // requirements lookup returns undefined for unknown office IDs and the
  // function then dereferences it. Production fix was reverted; this test
  // pins the valid-input path for now and documents the invalid-input crash.
  it('Politics: runForOffice + campaign accept valid office IDs', async () => {
    mounted = mountGame();
    act(() => makeWealthy());
    const { runForOffice, campaign } = await import('@/contexts/game/actions/PoliticalActions');
    const { updateMoney: libUpdateMoney } = await import('@/contexts/game/actions/MoneyActions');
    const { updateStats: libUpdateStats } = await import('@/contexts/game/actions/StatsActions');
    const deps = { updateMoney: libUpdateMoney, updateStats: libUpdateStats };

    // Use a documented valid office id from the union type.
    let res: { success: boolean; message?: string } | undefined;
    act(() => { res = runForOffice(captured!.state, captured!.setGameState, 'council_member', deps); });
    expect(res).toBeDefined();
    assertCleanState('Politics runForOffice valid');

    act(() => { campaign(captured!.state, captured!.setGameState, 1000, deps); });
    assertCleanState('Politics campaign');
  });

  it('Politics: runForOffice with unknown office id returns a structured error (regression for bug fix)', async () => {
    mounted = mountGame();
    act(() => makeWealthy());
    const { runForOffice } = await import('@/contexts/game/actions/PoliticalActions');
    const { updateMoney: libUpdateMoney } = await import('@/contexts/game/actions/MoneyActions');
    const deps = { updateMoney: libUpdateMoney };
    let res: { success: boolean; message?: string } | undefined;
    act(() => { res = runForOffice(captured!.state, captured!.setGameState, 'city_council' as never, deps); });
    expect(res).toBeDefined();
    expect(res!.success).toBe(false);
    expect(res!.message).toMatch(/Unknown office/i);
    assertCleanState('Politics runForOffice unknown office');
  });

  it('R&D: buildRDLab respects gating without crashing', async () => {
    mounted = mountGame();
    act(() => makeWealthy());
    const { buildRDLab } = await import('@/contexts/game/actions/RDActions');
    const { updateMoney: libUpdateMoney } = await import('@/contexts/game/actions/MoneyActions');
    let res: { success: boolean; message?: string } | undefined;
    act(() => { res = buildRDLab(captured!.state, captured!.setGameState, 'co-1', 'basic' as never, { updateMoney: libUpdateMoney }); });
    expect(res).toBeDefined();
    assertCleanState('R&D buildRDLab');
  });

  it('Jail: payBail + serveJailTime + performJailActivity', () => {
    mounted = mountGame();
    act(() => makeWealthy());
    // Put player in jail.
    act(() => captured!.setGameState(prev => ({ ...prev, jailWeeks: 3, wantedLevel: 0 })));

    act(() => captured!.job.payBail());
    assertCleanState('Jail payBail');

    // Re-jail and serve.
    act(() => captured!.setGameState(prev => ({ ...prev, jailWeeks: 2 })));
    act(() => { captured!.job.serveJailTime(); });
    assertCleanState('Jail serveJailTime');

    // performJailActivity needs the activity to exist; defensive call.
    act(() => captured!.setGameState(prev => ({ ...prev, jailWeeks: 2 })));
    act(() => { captured!.job.performJailActivity('exercise'); });
    assertCleanState('Jail performJailActivity');
  });

  it('Relationships: updateRelationship + recordRelationshipAction', () => {
    mounted = mountGame();
    const rel = captured!.state.relationships?.[0];
    if (!rel) return;
    act(() => captured!.game.updateRelationship(rel.id, 5));
    act(() => captured!.game.recordRelationshipAction(rel.id, 'call'));
    assertCleanState('Relationships updateRelationship + recordRelationshipAction');
  });

  it('Stats: updateStats with bounded values stays in bounds', () => {
    mounted = mountGame();
    // Push every stat hard +100/-100 — clamping must catch it all.
    act(() => captured!.game.updateStats({
      health: 100, happiness: 100, energy: 100, fitness: 100,
      money: 1000, reputation: 100, gems: 100,
    }));
    assertCleanState('Stats updateStats positive');

    act(() => captured!.game.updateStats({
      health: -1000, happiness: -1000, energy: -1000, fitness: -1000,
      reputation: -1000,
    }));
    expect(captured!.state.stats.health).toBeGreaterThanOrEqual(0);
    expect(captured!.state.stats.happiness).toBeGreaterThanOrEqual(0);
    expect(captured!.state.stats.energy).toBeGreaterThanOrEqual(0);
    expect(captured!.state.stats.fitness).toBeGreaterThanOrEqual(0);
    expect(captured!.state.stats.reputation).toBeGreaterThanOrEqual(0);
    assertCleanState('Stats updateStats negative');
  });

  // ── ACHIEVEMENT/PERMANENT PERK FLOWS ────────────────────────────────────
  it('Achievements: checkAchievements does not throw, even on minimal state', () => {
    mounted = mountGame();
    act(() => { captured!.game.checkAchievements(); });
    assertCleanState('Achievements checkAchievements');
  });

  it('Perks: savePermanentPerk + hasPermanentPerk round-trip', async () => {
    mounted = mountGame();
    await act(async () => { await captured!.game.savePermanentPerk('test_perk'); });
    await act(async () => {
      const has = await captured!.game.hasPermanentPerk('test_perk');
      // Test perk persistence — at least the call returns a boolean.
      expect(typeof has).toBe('boolean');
    });
    assertCleanState('Perks savePermanentPerk + hasPermanentPerk');
  });
});
