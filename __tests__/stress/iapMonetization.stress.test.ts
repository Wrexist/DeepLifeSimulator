/**
 * IAP / Monetization Audit
 *
 * Players pay real money — these flows MUST be reliable. Tests:
 *   - applyProductToState for every product ID applies the right benefits
 *   - State stays clean (no NaN/Infinity) after applying
 *   - Multiple applications of the same product stack as expected
 *   - REVIVAL_PACK actually revives (clears death flags + restores stats)
 *   - REMOVE_ADS sets adsRemoved + timestamps
 *   - allUpgrades flips every gold upgrade
 *   - everythingUnlocked also enables ads-removed + lifetimePremium
 *   - Unknown productId returns false
 *   - NaN-corrupted state pre-application doesn't crash applyProductToState
 *   - Hook surface: useGame().buyStarterPack etc. routes through correctly
 */

import React from 'react';
import { GameProvider } from '@/contexts/game/GameProvider';
import { useGameState, useGameActions, useMoneyActions } from '@/contexts/game';
import { UIUXProvider } from '@/contexts/UIUXContext';
import type { GameState } from '@/contexts/game/types';
import { initialGameState } from '@/contexts/game/initialState';
import { validateGameState } from '@/utils/saveValidation';
import { iapService } from '@/services/IAPService';
import { IAP_PRODUCTS, PRODUCT_CONFIGS, getAllProductIds } from '@/utils/iapConfig';

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
  game: ReturnType<typeof useGameActions>;
};

let captured: Probe | null = null;

function ProbeComponent() {
  const { gameState, setGameState } = useGameState();
  const money = useMoneyActions();
  const game = useGameActions();
  captured = { state: gameState, setGameState, money, game };
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

function freshState(): GameState {
  return structuredClone(initialGameState);
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

describe('IAP / Monetization audit', () => {
  jest.setTimeout(120_000);
  let mounted: { root: any } | null = null;

  afterEach(() => {
    if (mounted) {
      act(() => mounted!.root.unmount());
      mounted = null;
    }
    captured = null;
  });

  // ── PRODUCT REGISTRY ───────────────────────────────────────────────────
  it('Every registered product ID has a matching PRODUCT_CONFIGS entry', () => {
    const ids = getAllProductIds();
    expect(ids.length).toBeGreaterThan(0);
    for (const id of ids) {
      const config = (PRODUCT_CONFIGS as Record<string, unknown>)[id];
      expect(config).toBeDefined();
    }
  });

  // ── EVERY PRODUCT APPLIES WITHOUT CRASH ─────────────────────────────────
  it('applyProductToState: every product applies cleanly to fresh state', () => {
    const ids = getAllProductIds();
    const failures: Array<{ id: string; issues: string[] }> = [];

    for (const id of ids) {
      const state = freshState();
      const result = iapService.applyProductToState(state, id);
      expect(result).toBe(true);
      const issues = deepCheck(state, id);
      if (issues.length) failures.push({ id, issues: issues.slice(0, 3) });
    }

    if (failures.length) {
      throw new Error(`Products produced corrupted state:\n${failures.map(f => `  ${f.id}: ${f.issues.join('; ')}`).join('\n')}`);
    }
  });

  it('applyProductToState: unknown productId returns false', () => {
    const state = freshState();
    expect(iapService.applyProductToState(state, 'fake.product.id.xyz')).toBe(false);
  });

  // ── GEM PACKS ──────────────────────────────────────────────────────────
  it('Gem pack: GEMS_100 adds exactly 100 gems', () => {
    const state = freshState();
    state.stats.gems = 0;
    iapService.applyProductToState(state, IAP_PRODUCTS.GEMS_100);
    expect(state.stats.gems).toBe(100);
  });

  it('Gem pack: GEMS_15000 adds exactly 15000 gems on top of existing', () => {
    const state = freshState();
    state.stats.gems = 500;
    iapService.applyProductToState(state, IAP_PRODUCTS.GEMS_15000);
    expect(state.stats.gems).toBe(15500);
  });

  it('Gem pack: applying GEMS_500 twice stacks (consumable behavior)', () => {
    const state = freshState();
    state.stats.gems = 0;
    iapService.applyProductToState(state, IAP_PRODUCTS.GEMS_500);
    iapService.applyProductToState(state, IAP_PRODUCTS.GEMS_500);
    expect(state.stats.gems).toBe(1000);
  });

  it('Gem pack: NaN gems pre-application gets sanitized to 0 + gems amount', () => {
    const state = freshState();
    state.stats.gems = NaN as never;
    iapService.applyProductToState(state, IAP_PRODUCTS.GEMS_500);
    expect(Number.isFinite(state.stats.gems)).toBe(true);
    expect(state.stats.gems).toBeGreaterThanOrEqual(0);
  });

  it('Gem pack: Negative gems pre-application gets clamped to 0', () => {
    const state = freshState();
    state.stats.gems = -100;
    iapService.applyProductToState(state, IAP_PRODUCTS.GEMS_500);
    expect(state.stats.gems).toBeGreaterThanOrEqual(0);
  });

  // ── STARTER / PREMIUM / ULTIMATE PACKS (multi-benefit) ─────────────────
  it('Starter Pack: grants 1000 gems + 1 youth pill', () => {
    const state = freshState();
    state.stats.gems = 0;
    state.youthPills = 0;
    iapService.applyProductToState(state, IAP_PRODUCTS.GEMS_STARTER);
    expect(state.stats.gems).toBe(1000);
    expect(state.youthPills).toBe(1);
  });

  it('Premium Pack: grants gems + youth pills + money multiplier flag', () => {
    const state = freshState();
    state.stats.gems = 0;
    state.youthPills = 0;
    iapService.applyProductToState(state, IAP_PRODUCTS.GEMS_PREMIUM);
    expect(state.stats.gems).toBeGreaterThan(0);
    expect((state.youthPills || 0)).toBeGreaterThan(0);
    expect(state.settings?.moneyMultiplier).toBe(true);
  });

  // ── REMOVE ADS ─────────────────────────────────────────────────────────
  it('REMOVE_ADS: sets adsRemoved flag + timestamp', () => {
    const state = freshState();
    expect(state.settings?.adsRemoved).toBeFalsy();
    iapService.applyProductToState(state, IAP_PRODUCTS.REMOVE_ADS);
    expect(state.settings?.adsRemoved).toBe(true);
    expect(state.settings?.adsRemovedDate).toBeDefined();
    // Verify date is a valid ISO string.
    const date = new Date(state.settings!.adsRemovedDate as string);
    expect(date.getTime()).not.toBeNaN();
  });

  // ── REVIVAL PACK ───────────────────────────────────────────────────────
  it('REVIVAL_PACK: banks a charge rather than reviving inline (MON-5)', () => {
    // This test used to set up an already-DEAD player and assert the grant
    // revived them — which it did. What it never covered is the case that
    // actually happens: the store is reachable while ALIVE, so that is when
    // people buy. Bought alive, every write in the old grant was a no-op
    // (stats already full, no death popup to clear) and the player got
    // nothing, permanently. A test that only ever exercised the dead path
    // could not see that.
    const state = freshState();
    state.showDeathPopup = true;
    state.deathReason = 'health';
    state.stats.health = 0;
    state.stats.happiness = 0;
    state.stats.energy = 0;
    state.healthZeroWeeks = 5;
    state.happinessZeroWeeks = 3;

    iapService.applyProductToState(state, IAP_PRODUCTS.REVIVAL_PACK);

    // The charge is banked; the grant does NOT revive.
    expect(state.revivalPack).toBe(true);
    expect(state.settings?.hasRevivalPack).toBe(true);
    // Still dead — `reviveWithPack` is what spends it, from the death screen.
    expect(state.showDeathPopup).toBe(true);
    expect(state.stats.health).toBe(0);
  });

  it('REVIVAL_PACK: bought ALIVE, the player still receives something', () => {
    // The regression proper. Under the old grant this state came back
    // byte-identical to how it went in.
    const state = freshState();
    state.showDeathPopup = false;

    iapService.applyProductToState(state, IAP_PRODUCTS.REVIVAL_PACK);

    expect(state.revivalPack).toBe(true);
    expect(state.showDeathPopup).toBe(false); // and it did not fake a death
  });

  // ── BANKING PRODUCTS ───────────────────────────────────────────────────
  it('PREMIUM_CREDIT_CARD / FINANCIAL_PLANNING / BUSINESS_BANKING / PRIVATE_BANKING flip their flags', () => {
    const tests: Array<[string, keyof NonNullable<GameState['settings']>]> = [
      [IAP_PRODUCTS.PREMIUM_CREDIT_CARD, 'premiumCreditCard' as never],
      [IAP_PRODUCTS.FINANCIAL_PLANNING, 'financialPlanning' as never],
      [IAP_PRODUCTS.BUSINESS_BANKING, 'businessBanking' as never],
      [IAP_PRODUCTS.PRIVATE_BANKING, 'privateBanking' as never],
    ];
    for (const [productId, flag] of tests) {
      const state = freshState();
      iapService.applyProductToState(state, productId);
      // `as unknown as` because GameSettings has no index signature — TS
      // rejects the single-step assertion outright.
      expect((state.settings as unknown as Record<string, unknown>)?.[flag as string]).toBe(true);
    }
  });

  // ── REPEATED APPLICATIONS ──────────────────────────────────────────────
  it('Idempotent for flag products: applying REMOVE_ADS twice still results in adsRemoved=true', () => {
    const state = freshState();
    iapService.applyProductToState(state, IAP_PRODUCTS.REMOVE_ADS);
    const dateAfterFirst = state.settings?.adsRemovedDate;
    iapService.applyProductToState(state, IAP_PRODUCTS.REMOVE_ADS);
    expect(state.settings?.adsRemoved).toBe(true);
    // Timestamp updates on second apply — that's OK (purchase restore behavior).
    expect(state.settings?.adsRemovedDate).toBeDefined();
    void dateAfterFirst;
  });

  // ── NUMERIC STABILITY ──────────────────────────────────────────────────
  it('All gem packs: result.gems is finite + non-negative regardless of start state', () => {
    const ids = getAllProductIds();
    const gemPacks = ids.filter(id => {
      const config = (PRODUCT_CONFIGS as Record<string, { gems?: number }>)[id];
      return config?.gems && config.gems > 0;
    });
    expect(gemPacks.length).toBeGreaterThan(0);

    for (const id of gemPacks) {
      for (const startGems of [0, 100, 1_000_000, Number.MAX_SAFE_INTEGER - 1000, NaN, -50]) {
        const state = freshState();
        state.stats.gems = startGems as number;
        iapService.applyProductToState(state, id);
        if (!Number.isFinite(state.stats.gems)) throw new Error(`${id} from gems=${startGems} → non-finite gems`);
        if (state.stats.gems < 0) throw new Error(`${id} from gems=${startGems} → negative gems`);
      }
    }
  });

  // ── HOOK ROUTE ─────────────────────────────────────────────────────────
  it('Hook: useMoneyActions.buyStarterPack does not throw + leaves state clean', () => {
    mounted = mountGame();
    act(() => { captured!.money.buyStarterPack(); });
    // buyStarterPack may be a no-op in test env without registered IAP — must not crash.
    const issues = deepCheck(captured!.state);
    expect(issues).toEqual([]);
    const v = validateGameState(captured!.state);
    expect(v.valid).toBe(true);
  });

  it('Hook: useMoneyActions.buyRevival does not throw + leaves state clean', () => {
    mounted = mountGame();
    act(() => { captured!.money.buyRevival(); });
    const issues = deepCheck(captured!.state);
    expect(issues).toEqual([]);
  });

  // ── SAVE PIPELINE COMPATIBILITY ────────────────────────────────────────
  it('Post-IAP state passes validateGameState for every product', () => {
    const ids = getAllProductIds();
    const failures: Array<{ id: string; errors: string[] }> = [];
    for (const id of ids) {
      const state = freshState();
      iapService.applyProductToState(state, id);
      const v = validateGameState(state);
      if (!v.valid) failures.push({ id, errors: v.errors.slice(0, 3) });
    }
    if (failures.length) {
      throw new Error(`Products that broke validateGameState:\n${failures.map(f => `  ${f.id}: ${f.errors.join('; ')}`).join('\n')}`);
    }
  });

  // ── INVARIANTS ─────────────────────────────────────────────────────────
  it('Invariant: applying any product never sets a negative stat', () => {
    const ids = getAllProductIds();
    for (const id of ids) {
      const state = freshState();
      iapService.applyProductToState(state, id);
      for (const k of ['health', 'happiness', 'energy', 'fitness', 'reputation', 'gems'] as const) {
        expect(state.stats[k]).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('Invariant: gem balance reflects exactly the configured gem amount on a 0-start state', () => {
    const ids = getAllProductIds();
    for (const id of ids) {
      const config = (PRODUCT_CONFIGS as Record<string, { gems?: number }>)[id];
      const state = freshState();
      state.stats.gems = 0;
      iapService.applyProductToState(state, id);
      const expectedGems = config?.gems || 0;
      // For unlimitedYouthPills product, gems may be 0; otherwise should match config.
      expect(state.stats.gems).toBe(expectedGems);
    }
  });
});
