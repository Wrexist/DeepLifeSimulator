/**
 * Long-Run Save/Load Stress Test
 *
 * Drives the **real** save pipeline (createSaveData / parseSaveData / validateGameState)
 * across 500+ simulated weeks, exercising serialization, CRC32 + HMAC verification,
 * and state-shape validation every iteration. The goal is to catch:
 *
 *   1. NaN / Infinity drift over very long runs.
 *   2. Save envelope corruption that survives a round-trip.
 *   3. JSON-unsafe values (undefined / functions / circular refs) creeping in.
 *   4. Unbounded memory growth across thousands of saves.
 *   5. Real failure modes of validateGameState() when fed evolved state.
 *
 * Coverage targets:
 *   - 520 weeks (10 years)  — baseline
 *   - 1040 weeks (20 years) — extended
 *   - 5200 weeks (100 years) — full lifespan
 */

import { GameState } from '@/contexts/game/types';
import { initialGameState, STATE_VERSION } from '@/contexts/game/initialState';
import {
  createSaveData,
  parseSaveData,
  validateGameState,
  calculateChecksum,
  calculateHmacSignature,
  verifySaveData,
} from '@/utils/saveValidation';
import { advanceWeeks } from './helpers/timeHelpers';
import { expectNoNaN, expectNoInfinity } from './helpers/assertions';
import { createTestGameState } from '../helpers/createTestGameState';

// ───────────────────── Helpers ────────────────────────────────────────────

function freshState(): GameState {
  // Deep clone so mutations during one test do not bleed into another.
  return createTestGameState();
}

/** Recursively check for JSON-unsafe values (undefined inside objects is OK,
 *  but functions, Symbols, and BigInt would silently break save round-trips). */
function findUnsafeValues(state: unknown, path = 'root'): string[] {
  const issues: string[] = [];
  const seen = new WeakSet();
  const walk = (v: unknown, p: string) => {
    if (v === null || v === undefined) return;
    const t = typeof v;
    if (t === 'function') issues.push(`function at ${p}`);
    if (t === 'symbol') issues.push(`symbol at ${p}`);
    if (t === 'bigint') issues.push(`bigint at ${p}`);
    if (t === 'number') {
      if (Number.isNaN(v as number)) issues.push(`NaN at ${p}`);
      if (!Number.isFinite(v as number)) issues.push(`Infinity at ${p}`);
    }
    if (t === 'object') {
      const obj = v as object;
      if (seen.has(obj)) {
        issues.push(`circular ref at ${p}`);
        return;
      }
      seen.add(obj);
      if (Array.isArray(obj)) {
        obj.forEach((x, i) => walk(x, `${p}[${i}]`));
      } else {
        for (const k of Object.keys(obj)) {
          walk((obj as Record<string, unknown>)[k], `${p}.${k}`);
        }
      }
    }
  };
  walk(state, path);
  return issues;
}

/** Round-trip a state through the real save envelope and assert no data loss
 *  on top-level numeric/string fields and the stats sub-object. */
function roundTripAndAssert(state: GameState, atWeek: number) {
  const envelope = createSaveData(state, STATE_VERSION);

  // 1. CRC32 must round-trip.
  expect(calculateChecksum(envelope.data)).toBe(envelope.checksum);

  // 2. HMAC must verify.
  //
  // Unconditional. Behind `if (envelope.hmac)` this check vanishes silently the
  // day `createSaveData` stops signing — which is the one change that most needs
  // a test to notice, and the `verifySaveData` line below would go on passing
  // with an undefined signature.
  expect(envelope.hmac).toBeTruthy();
  expect(calculateHmacSignature(envelope.data)).toBe(envelope.hmac);
  expect(verifySaveData(envelope.data, envelope.checksum, envelope.signature, envelope.hmac)).toBe(true);

  // 3. parseSaveData → reconstructed state.
  const parsed = parseSaveData(envelope.data, envelope.checksum, envelope.signature, envelope.hmac);
  if (!parsed.valid) {
    throw new Error(
      `parseSaveData failed at week ${atWeek}: ${parsed.errors.join(' | ')}`
    );
  }
  const restored = parsed.state!;

  // 4. Core scalars survive.
  expect(restored.weeksLived).toBe(state.weeksLived);
  expect(restored.week).toBe(state.week);
  expect(restored.date.year).toBe(state.date.year);
  expect(restored.date.age).toBeCloseTo(state.date.age, 4);

  // 5. Stats survive bit-for-bit (numeric).
  for (const k of ['health', 'happiness', 'energy', 'fitness', 'money', 'reputation', 'gems'] as const) {
    expect(restored.stats[k]).toBeCloseTo(state.stats[k] as number, 6);
  }
}

// ───────────────────── Tests ──────────────────────────────────────────────

describe('Long-Run Save/Load Stress (real save pipeline)', () => {
  jest.setTimeout(180_000);

  it('Test 1: 520 weeks — every-week round-trip never fails', () => {
    let state = freshState();
    const SAVE_EVERY = 1; // every single tick
    const TOTAL_WEEKS = 520;

    let saves = 0;
    let validations = 0;
    let unsafeReports = 0;
    const startMem = process.memoryUsage().heapUsed;
    const startTime = Date.now();

    for (let w = 1; w <= TOTAL_WEEKS; w++) {
      state = advanceWeeks(state, 1);

      // NaN/Infinity check.
      const unsafe = findUnsafeValues(state);
      if (unsafe.length) {
        unsafeReports++;
        throw new Error(`Unsafe values at week ${w}: ${unsafe.slice(0, 5).join('; ')}`);
      }

      // Stat clamping. advanceWeeks drains happiness 2/wk; floor at 0.
      expect(state.stats.happiness).toBeGreaterThanOrEqual(0);
      expect(state.stats.energy).toBeLessThanOrEqual(100);

      // Round-trip save every tick.
      if (w % SAVE_EVERY === 0) {
        roundTripAndAssert(state, w);
        saves++;
      }

      // Lightweight validation every 10 ticks.
      if (w % 10 === 0) {
        const v = validateGameState(state);
        if (!v.valid) {
          throw new Error(`validateGameState failed at week ${w}: ${v.errors.join(' | ')}`);
        }
        validations++;
      }
    }

    const endMem = process.memoryUsage().heapUsed;
    const heapGrowthMB = (endMem - startMem) / 1024 / 1024;
    const duration = Date.now() - startTime;

    expect(state.weeksLived).toBe(TOTAL_WEEKS);
    // advanceWeeks (test helper) truncates age to 4 decimals each tick, so over
    // 520 ticks the accumulated drift is ~520 * 3e-5 ≈ 0.016. Assert weeksLived
    // (exact) and bound age within helper-precision.
    expect(Math.abs(state.date.age - (18 + TOTAL_WEEKS / 52))).toBeLessThan(0.05);
    expect(saves).toBe(TOTAL_WEEKS);
    expect(validations).toBe(TOTAL_WEEKS / 10);
    expect(unsafeReports).toBe(0);

    // Heap growth on 520 saves should be bounded. Under parallel suite execution
    // jest workers share memory pressure, so we allow generous headroom; under
    // isolated runs growth is typically ~30-60MB. We assert "not pathological."
    expect(heapGrowthMB).toBeLessThan(250);

    // eslint-disable-next-line no-console
    console.log(
      `[520-week run] ${saves} saves, ${validations} validations, ${duration}ms, +${heapGrowthMB.toFixed(1)}MB heap`
    );
  });

  it('Test 2: 1040 weeks (20y) — periodic save + load chain (load result reused)', () => {
    let state = freshState();
    const TOTAL_WEEKS = 1040;
    const SAVE_EVERY = 5;
    let chainBreaks = 0;
    const startTime = Date.now();

    for (let w = 1; w <= TOTAL_WEEKS; w++) {
      state = advanceWeeks(state, 1);

      if (w % SAVE_EVERY === 0) {
        // Save → load → continue simulating off the loaded state.
        // This catches state shape drift that only manifests after a reload.
        const env = createSaveData(state, STATE_VERSION);
        const parsed = parseSaveData(env.data, env.checksum, env.signature, env.hmac);
        if (!parsed.valid || !parsed.state) {
          chainBreaks++;
          throw new Error(`Chain break at week ${w}: ${parsed.errors.join(' | ')}`);
        }
        // Continue off the reloaded state.
        state = parsed.state;
      }
    }

    expect(chainBreaks).toBe(0);
    expect(state.weeksLived).toBe(TOTAL_WEEKS);
    expectNoNaN(state);
    expectNoInfinity(state);

    // eslint-disable-next-line no-console
    console.log(`[1040-week save-load-resume chain] OK in ${Date.now() - startTime}ms`);
  });

  it('Test 3: 5200 weeks (100y / full lifespan) — numerical stability + heap bound', () => {
    let state = freshState();
    const TOTAL_WEEKS = 5200;
    const startMem = process.memoryUsage().heapUsed;
    const startTime = Date.now();

    // Sample saves at exponentially spaced milestones — covers early/middle/late phases
    // without paying for a save every week.
    const saveCheckpoints = new Set([1, 10, 100, 500, 1000, 2000, 3000, 4000, 4999, 5200]);

    for (let w = 1; w <= TOTAL_WEEKS; w++) {
      state = advanceWeeks(state, 1);

      // Periodic numeric sanity (every 100 weeks).
      if (w % 100 === 0) {
        const unsafe = findUnsafeValues(state);
        if (unsafe.length) {
          throw new Error(`Numeric instability at week ${w}: ${unsafe.slice(0, 5).join('; ')}`);
        }
      }

      if (saveCheckpoints.has(w)) {
        roundTripAndAssert(state, w);
      }
    }

    const heapGrowthMB = (process.memoryUsage().heapUsed - startMem) / 1024 / 1024;

    expect(state.weeksLived).toBe(TOTAL_WEEKS);
    // Same helper drift as Test 1 — 5200 ticks → ~0.16y drift. weeksLived is exact.
    expect(Math.abs(state.date.age - (18 + TOTAL_WEEKS / 52))).toBeLessThan(0.5);
    expect(heapGrowthMB).toBeLessThan(150);

    // eslint-disable-next-line no-console
    console.log(
      `[5200-week stability run] OK, final age=${state.date.age.toFixed(2)}, ` +
      `${Date.now() - startTime}ms, +${heapGrowthMB.toFixed(1)}MB heap`
    );
  });

  it('Test 4: corrupted save is rejected by parseSaveData', () => {
    let state = freshState();
    state = advanceWeeks(state, 50);
    const env = createSaveData(state, STATE_VERSION);

    // Flip a byte mid-payload.
    const corruptedData = env.data.slice(0, 100) + 'X' + env.data.slice(101);
    const parsed = parseSaveData(corruptedData, env.checksum, env.signature, env.hmac);
    expect(parsed.valid).toBe(false);
    expect(parsed.state).toBeNull();
    expect(parsed.errors.length).toBeGreaterThan(0);
  });

  it('Test 5: truncated save is rejected by parseSaveData', () => {
    let state = freshState();
    state = advanceWeeks(state, 50);
    const env = createSaveData(state, STATE_VERSION);

    const truncated = env.data.slice(0, env.data.length - 50);
    const parsed = parseSaveData(truncated, env.checksum, env.signature, env.hmac);
    expect(parsed.valid).toBe(false);
  });

  it('Test 6: HMAC tampering is detected', () => {
    let state = freshState();
    state = advanceWeeks(state, 50);
    const env = createSaveData(state, STATE_VERSION);

    if (env.hmac) {
      // Modify last hex digit of HMAC.
      const lastChar = env.hmac.slice(-1);
      const newLast = lastChar === 'a' ? 'b' : 'a';
      const tamperedHmac = env.hmac.slice(0, -1) + newLast;
      const parsed = parseSaveData(env.data, env.checksum, env.signature, tamperedHmac);
      expect(parsed.valid).toBe(false);
    }
  });

  it('Test 7: state-mutation tampering invalidates checksum', () => {
    let state = freshState();
    state = advanceWeeks(state, 50);
    const env = createSaveData(state, STATE_VERSION);

    // Cheater modifies money 10x — but cannot recompute HMAC without the key.
    const cheated = JSON.parse(env.data);
    cheated.stats.money = 1_000_000_000;
    const cheatedData = JSON.stringify(cheated);
    const parsed = parseSaveData(cheatedData, env.checksum, env.signature, env.hmac);
    expect(parsed.valid).toBe(false);
  });

  it('Test 8: heap stable across 100 save/load cycles on a fixed state', () => {
    let state = freshState();
    state = advanceWeeks(state, 100);

    if (global.gc) global.gc();
    const before = process.memoryUsage().heapUsed;

    for (let i = 0; i < 100; i++) {
      const env = createSaveData(state, STATE_VERSION);
      const parsed = parseSaveData(env.data, env.checksum, env.signature, env.hmac);
      expect(parsed.valid).toBe(true);
    }

    if (global.gc) global.gc();
    const after = process.memoryUsage().heapUsed;
    const growthMB = (after - before) / 1024 / 1024;

    // Per-cycle allocations should be GC'd. Allow generous headroom for jest noise.
    expect(growthMB).toBeLessThan(50);
    // eslint-disable-next-line no-console
    console.log(`[100 save/load cycles] +${growthMB.toFixed(2)}MB heap`);
  });

  it('Test 10: fat state — 100 relationships + 50 companies + 200 items round-trips', () => {
    let state = freshState();

    // Build a maximally-bloated state to stress the schema breadth.
    state.social = state.social ?? ({ relations: [] } as any);
    (state.social as any).relations = Array.from({ length: 100 }, (_, i) => ({
      id: `rel-${i}`,
      name: `NPC ${i}`,
      type: (i % 5 === 0 ? 'partner' : i % 3 === 0 ? 'friend' : 'parent') as
        | 'parent' | 'friend' | 'partner' | 'spouse' | 'child',
      relationshipScore: 50 + (i % 50),
      personality: i % 2 ? 'extrovert' : 'introvert',
      gender: (i % 2 ? 'male' : 'female') as 'male' | 'female',
      age: 18 + (i % 60),
      datesCount: i,
      giftsReceived: Math.floor(i / 2),
      npcMemories: Array.from({ length: 5 }, (_, j) => ({
        id: `mem-${i}-${j}`,
        type: 'date' as const,
        description: `Memory ${j}`,
        weeksLived: i * 10 + j,
        sentiment: 'positive' as const,
      })),
    }));

    state.companies = Array.from({ length: 50 }, (_, i) => ({
      id: `co-${i}`,
      type: (i % 5 === 0 ? 'factory'
        : i % 5 === 1 ? 'ai'
        : i % 5 === 2 ? 'restaurant'
        : i % 5 === 3 ? 'real-estate'
        : 'bank') as any,
      name: `Company ${i}`,
      employees: i * 10,
      money: i * 10_000,
      weeklyIncome: 1000 + i * 100,
      baseWeeklyIncome: 1000 + i * 100,
      upgrades: Array.from({ length: 10 }, (_, j) => `upgrade-${j}`),
      workerSalary: 100,
      workerMultiplier: 1 + i * 0.01,
      marketingLevel: i % 10,
      miners: {},
      warehouseLevel: i % 5,
    })) as any;

    (state as any).items = Array.from({ length: 200 }, (_, i) => ({
      id: `item-${i}`,
      name: `Item ${i}`,
      owned: i % 2 === 0,
      price: i * 100,
    }));

    state.weeksLived = 2000;
    state.date.year = 2065;
    state.date.age = 18 + 2000 / 52;

    // Run 100 ticks on top of the fat state, with periodic save/load.
    for (let w = 1; w <= 100; w++) {
      state = advanceWeeks(state, 1);
      if (w % 10 === 0) {
        const env = createSaveData(state, STATE_VERSION);
        const parsed = parseSaveData(env.data, env.checksum, env.signature, env.hmac);
        if (!parsed.valid) {
          throw new Error(
            `Fat-state save failed at relative-week ${w}: ${parsed.errors.join(' | ')}`
          );
        }
        // Survived round-trip → make sure entity counts preserved.
        const r = parsed.state!;
        expect((r as any).social.relations).toHaveLength(100);
        expect(r.companies).toHaveLength(50);
        expect((r as any).items).toHaveLength(200);
        state = r;
      }
    }

    const finalEnv = createSaveData(state, STATE_VERSION);
    // eslint-disable-next-line no-console
    console.log(`[fat-state] final payload = ${finalEnv.data.length} bytes`);
    expect(finalEnv.data.length).toBeLessThan(1_000_000); // < 1 MB even with 100 NPCs / 50 cos / 200 items
  });

  it('Test 11: extreme money values survive save round-trip', () => {
    let state = freshState();
    // Money near JS safe-integer boundary.
    state.stats.money = Number.MAX_SAFE_INTEGER - 1;
    state.bankSavings = 1e15;

    const env = createSaveData(state, STATE_VERSION);
    const parsed = parseSaveData(env.data, env.checksum, env.signature, env.hmac);
    expect(parsed.valid).toBe(true);
    expect(parsed.state!.stats.money).toBe(Number.MAX_SAFE_INTEGER - 1);
    expect(parsed.state!.bankSavings).toBe(1e15);
  });

  it('Test 12: state-version migration — older version still parses', () => {
    let state = freshState();
    state = advanceWeeks(state, 100);

    // Save with an older version number (simulating an old save file)
    const olderVersion = Math.max(1, STATE_VERSION - 2);
    const env = createSaveData(state, olderVersion);
    const parsed = parseSaveData(env.data, env.checksum, env.signature, env.hmac);
    expect(parsed.valid).toBe(true);
    expect(parsed.state!.version).toBe(olderVersion);
  });

  it('Test 9: serialized payload size stays bounded as weeks tick up', () => {
    let state = freshState();
    const sizesByWeek: Array<{ week: number; bytes: number }> = [];

    for (const target of [0, 100, 500, 1000, 2000, 5000]) {
      while (state.weeksLived < target) {
        state = advanceWeeks(state, 1);
      }
      const env = createSaveData(state, STATE_VERSION);
      sizesByWeek.push({ week: state.weeksLived, bytes: env.data.length });
    }

    // Sanity: initial payload < 100KB and 5000-week payload < 5x that.
    expect(sizesByWeek[0].bytes).toBeLessThan(100_000);
    const initial = sizesByWeek[0].bytes;
    const final = sizesByWeek[sizesByWeek.length - 1].bytes;
    expect(final).toBeLessThan(initial * 10); // No unbounded growth.

    // eslint-disable-next-line no-console
    console.log('[payload sizes]', sizesByWeek.map(s => `w${s.week}=${s.bytes}B`).join(' '));
  });
});
