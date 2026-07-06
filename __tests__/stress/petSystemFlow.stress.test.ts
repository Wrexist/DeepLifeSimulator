/**
 * Pet System Lifecycle Audit
 *
 * Pets age, get hungry, get sick, and can die — many state transitions per
 * tick that interact with the player's happiness. This audit verifies:
 *
 *   - Pet aging: +1 week per nextWeek
 *   - Hunger increases (+8/wk), capped at 100
 *   - Happiness decays when hunger > 60
 *   - Health decays when hunger > 80
 *   - Sick pets lose health each week
 *   - Death triggers at 3+ weeks of zero health
 *   - Natural death triggers when age >= lifespan
 *   - Player happiness drops -20 on new pet death (but only ONCE per pet)
 *   - Dead pets are skipped in subsequent ticks (no further mutations)
 *   - Lifespan varies by pet type (turtle 30y, fish 5y, etc.)
 *   - Stat clamping: every pet stat stays in [0, 100]
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
import type { GameState, Pet } from '@/contexts/game/types';
import { validateGameState } from '@/utils/saveValidation';
import { PET_LIFESPANS, WEEKS_PER_YEAR } from '@/lib/config/gameConstants';

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

function seedPet(pet: Partial<Pet> & { id: string; name: string; type: string }) {
  const fullPet: Pet = {
    age: 0, hunger: 30, happiness: 70, health: 100, isDead: false, isSick: false,
    ...pet,
  };
  act(() => captured!.setGameState(prev => ({
    ...prev,
    weeksLived: 100,
    date: { ...prev.date, age: 25, year: 2030 },
    stats: { ...prev.stats, money: 100_000, gems: 1000, health: 100, happiness: 100, energy: 100, fitness: 80, reputation: 50 },
    pets: [...(prev.pets || []), fullPet],
  })));
}

function getPet(id: string): Pet | undefined {
  return (captured!.state.pets || []).find(p => p.id === id);
}

describe('Pet system lifecycle', () => {
  jest.setTimeout(180_000);
  let mounted: { root: any } | null = null;

  afterEach(() => {
    if (mounted) {
      act(() => mounted!.root.unmount());
      mounted = null;
    }
    captured = null;
  });

  // ── AGING ──────────────────────────────────────────────────────────────
  it('Aging: pet age increases by 1 per nextWeek', async () => {
    mounted = mountGame();
    seedPet({ id: 'p1', name: 'Rex', type: 'dog', age: 50 });
    await tick();
    expect(getPet('p1')!.age).toBe(51);
    await tick();
    expect(getPet('p1')!.age).toBe(52);
  });

  // ── HUNGER (FULLNESS) PROGRESSION ──────────────────────────────────────
  // hunger = fullness/satiety (100 = full, 0 = starving). Decays weekly; the
  // player feeds to top it back up.
  it('Fullness: decreases by 8 per week, floored at 0', async () => {
    mounted = mountGame();
    seedPet({ id: 'p1', name: 'Rex', type: 'dog', age: 50, hunger: 50 });
    await tick();
    expect(getPet('p1')!.hunger).toBe(42);
    await tick();
    expect(getPet('p1')!.hunger).toBe(34);

    // Floor at 0.
    act(() => captured!.setGameState(prev => ({
      ...prev,
      pets: prev.pets?.map(p => p.id === 'p1' ? { ...p, hunger: 4 } : p),
    })));
    await tick();
    expect(getPet('p1')!.hunger).toBe(0); // 4 - 8 → clamped to 0
  });

  // ── HAPPINESS DECAY WHEN GETTING HUNGRY ────────────────────────────────
  it('Happiness: decays -5 when fullness < 40', async () => {
    mounted = mountGame();
    seedPet({ id: 'p1', name: 'Rex', type: 'dog', age: 50, hunger: 35, happiness: 80 });
    await tick();
    // fullness becomes 27 (<40). happiness drops by 5.
    expect(getPet('p1')!.happiness).toBe(75);
  });

  it('Happiness: does NOT decay when fullness stays >= 40', async () => {
    mounted = mountGame();
    seedPet({ id: 'p1', name: 'Rex', type: 'dog', age: 50, hunger: 60, happiness: 80 });
    await tick();
    // fullness becomes 52 (>=40). happiness unchanged.
    expect(getPet('p1')!.happiness).toBe(80);
  });

  // ── HEALTH DECAY WHEN STARVING ─────────────────────────────────────────
  it('Health: decays at least 3 when fullness < 20 (starving)', async () => {
    mounted = mountGame();
    seedPet({ id: 'p1', name: 'Rex', type: 'dog', age: 50, hunger: 25, health: 90 });
    await tick();
    const p = getPet('p1')!;
    // fullness becomes 17 (<20) → -3 from starvation.
    // The deterministic sickness roll MAY also fire (~2%/tick) — if so, also
    // -10 onset + -5 sick-decay. Either way: health dropped by at least 3.
    expect(p.health).toBeLessThanOrEqual(87);
    expect(p.health).toBeGreaterThanOrEqual(0);
    expect(p.hunger).toBeLessThan(20);
  });

  it('Health: stays clamped to [0, 100] under extreme starvation', async () => {
    mounted = mountGame();
    seedPet({ id: 'starver', name: 'Sad', type: 'dog', age: 50, hunger: 100, health: 5 });
    for (let i = 0; i < 5; i++) await tick();
    const p = getPet('starver');
    expect(p!.health).toBeGreaterThanOrEqual(0);
    expect(p!.health).toBeLessThanOrEqual(100);
    expect(p!.hunger).toBeLessThanOrEqual(100);
    expect(Number.isFinite(p!.health)).toBe(true);
  });

  // ── SICKNESS ───────────────────────────────────────────────────────────
  it('Sickness: a pre-set sick pet loses 5 health per week', async () => {
    mounted = mountGame();
    seedPet({ id: 'sick_pet', name: 'Ill', type: 'dog', age: 50, hunger: 40, health: 60, isSick: true, sickness: 'cold' });
    const healthBefore = getPet('sick_pet')!.health;
    await tick();
    // -5 from sickness; no additional decay because hunger is 48 (<60).
    expect(getPet('sick_pet')!.health).toBe(healthBefore - 5);
  });

  // ── BUG-FIX REGRESSION: sickness must NOT heal a dying pet ─────────────
  // Previously `(newPet.health || 50) - 10` set health to 40 when the deterministic
  // sickness roll fired on a 0-health pet, accidentally rescuing dying pets and
  // breaking the death-progression test. Fixed by using `?? 50` instead.
  it('BUG-FIX: a 0-health pet never accidentally heals when sickness rolls', async () => {
    mounted = mountGame();
    // Try several week values to give the deterministic RNG many chances to
    // roll sickness on a 0-health pet. Before the fix, ANY week where the
    // sickness roll fired would heal the pet to 40 health.
    for (let week = 100; week < 130; week++) {
      act(() => captured!.setGameState(prev => ({
        ...prev,
        weeksLived: week,
        pets: [{
          id: 'p',
          name: 'P',
          type: 'dog',
          age: 50,
          hunger: 50,
          happiness: 50,
          health: 0,
          isDead: false,
          isSick: false,
          weeksAtZeroHealth: 0,
        } as Pet],
      })));
      await tick();
      const p = getPet('p')!;
      // After the fix, sickness onset on a 0-health pet sets health to max(0, 0-10) = 0,
      // NOT 40. So health must stay 0 (or drop further from sick-decay).
      expect(p.health).toBe(0);
    }
  });

  // ── DEATH TRIGGER ──────────────────────────────────────────────────────
  it('Death: pet at 0 health for 3 weeks becomes dead', async () => {
    mounted = mountGame();
    seedPet({ id: 'dying', name: 'Wisp', type: 'dog', age: 50, hunger: 50, health: 0, weeksAtZeroHealth: 0 });

    // Tick 1: weeksAtZeroHealth = 1, not dead.
    await tick();
    let p = getPet('dying');
    expect(p!.isDead).toBeFalsy();
    expect(p!.weeksAtZeroHealth).toBe(1);

    // Tick 2: weeksAtZeroHealth = 2, not dead.
    await tick();
    p = getPet('dying');
    expect(p!.isDead).toBeFalsy();
    expect(p!.weeksAtZeroHealth).toBe(2);

    // Tick 3: weeksAtZeroHealth = 3, dead.
    await tick();
    p = getPet('dying');
    expect(p!.isDead).toBe(true);
  });

  // ── DEAD PET IS SKIPPED ────────────────────────────────────────────────
  it('Dead pet: subsequent ticks do not mutate dead pet stats', async () => {
    mounted = mountGame();
    seedPet({ id: 'rip', name: 'Rip', type: 'dog', age: 100, hunger: 50, health: 50, isDead: true });
    const before = JSON.stringify(getPet('rip'));
    await tick();
    await tick();
    expect(JSON.stringify(getPet('rip'))).toBe(before);
  });

  // ── PLAYER HAPPINESS PENALTY ───────────────────────────────────────────
  it('Player happiness: -20 on new pet death (single event)', async () => {
    mounted = mountGame();
    seedPet({ id: 'doomed', name: 'Doomed', type: 'dog', age: 50, hunger: 50, health: 0, weeksAtZeroHealth: 2 });
    const playerHappinessBefore = captured!.state.stats.happiness;

    // Next tick: weeksAtZeroHealth becomes 3 → death → player happiness -20.
    await tick();

    expect(getPet('doomed')!.isDead).toBe(true);
    // Player happiness should have dropped (other effects may apply too).
    expect(captured!.state.stats.happiness).toBeLessThan(playerHappinessBefore);
    // It should have dropped at most 30 (20 from pet death + a few from weekly decay).
    expect(playerHappinessBefore - captured!.state.stats.happiness).toBeLessThan(40);
  });

  it('Player happiness: NO further drop on subsequent ticks for already-dead pet', async () => {
    mounted = mountGame();
    seedPet({ id: 'old_rip', name: 'OldRip', type: 'dog', age: 100, hunger: 50, health: 50, isDead: true });
    const before = captured!.state.stats.happiness;

    // Tick a few times — happiness may decay from other sources but pet death should NOT contribute -20 again.
    await tick();
    const after = captured!.state.stats.happiness;
    // At most natural weekly decay (~2), not -20.
    expect(before - after).toBeLessThan(15);
  });

  // ── NATURAL DEATH FROM OLD AGE ─────────────────────────────────────────
  it('Natural death: pet age >= lifespan triggers death', async () => {
    mounted = mountGame();
    const fishLifespanWeeks = (PET_LIFESPANS.fish || 5) * WEEKS_PER_YEAR;
    // Seed a fish just past its lifespan.
    seedPet({ id: 'goldie', name: 'Goldie', type: 'fish', age: fishLifespanWeeks - 1, hunger: 30, health: 100 });
    expect(getPet('goldie')!.isDead).toBeFalsy();

    await tick();
    // After tick, age is fishLifespanWeeks → triggers natural death.
    expect(getPet('goldie')!.isDead).toBe(true);
  });

  // ── LIFESPAN VARIES BY TYPE ────────────────────────────────────────────
  it('Lifespan: turtle (30y) significantly longer than fish (5y)', () => {
    expect(PET_LIFESPANS.turtle).toBeGreaterThan(PET_LIFESPANS.fish);
    expect((PET_LIFESPANS.turtle || 0) * WEEKS_PER_YEAR).toBeGreaterThan((PET_LIFESPANS.fish || 0) * WEEKS_PER_YEAR);
  });

  it('Lifespan: unknown pet type defaults to ~10 years', async () => {
    mounted = mountGame();
    // 'alien' isn't in PET_LIFESPANS — defaults to 10 years per the code (line 2057).
    const defaultLifespanWeeks = 10 * WEEKS_PER_YEAR;
    seedPet({ id: 'alien_pet', name: 'Zorp', type: 'alien' as never, age: defaultLifespanWeeks - 1, hunger: 30, health: 100 });
    await tick();
    expect(getPet('alien_pet')!.isDead).toBe(true);
  });

  // ── MULTI-PET PROCESSING ───────────────────────────────────────────────
  it('Multi-pet: each pet processes independently', async () => {
    mounted = mountGame();
    act(() => captured!.setGameState(prev => ({
      ...prev,
      weeksLived: 100,
      stats: { ...prev.stats, money: 100_000, gems: 1000, happiness: 100 },
      pets: [
        { id: 'a', name: 'A', type: 'dog', age: 50, hunger: 30, happiness: 70, health: 100, isDead: false } as Pet,
        { id: 'b', name: 'B', type: 'cat', age: 50, hunger: 65, happiness: 70, health: 100, isDead: false } as Pet,
        { id: 'c', name: 'C', type: 'fish', age: 50, hunger: 30, happiness: 70, health: 100, isDead: true } as Pet,
      ],
    })));

    await tick();

    const a = getPet('a');
    const b = getPet('b');
    const c = getPet('c');

    // A: fullness 30 → 22 (<40, happiness -5)
    expect(a!.age).toBe(51);
    expect(a!.hunger).toBe(22);
    expect(a!.happiness).toBe(65);

    // B: fullness 65 → 57 (>=40, no happiness loss)
    expect(b!.age).toBe(51);
    expect(b!.hunger).toBe(57);
    expect(b!.happiness).toBe(70);

    // C: dead — unchanged.
    expect(c!.age).toBe(50);
    expect(c!.hunger).toBe(30);
    expect(c!.isDead).toBe(true);
    assertClean('multi-pet');
  });

  // ── STAT INVARIANTS UNDER LONG RUN ─────────────────────────────────────
  it('Long run: 30 ticks with 3 pets keeps every pet stat in [0, 100]', async () => {
    mounted = mountGame();
    act(() => captured!.setGameState(prev => ({
      ...prev,
      weeksLived: 100,
      stats: { ...prev.stats, money: 1_000_000, gems: 1000 },
      pets: [
        { id: 'long1', name: 'A', type: 'dog', age: 100, hunger: 40, happiness: 70, health: 80, isDead: false } as Pet,
        { id: 'long2', name: 'B', type: 'cat', age: 100, hunger: 50, happiness: 60, health: 70, isDead: false } as Pet,
        { id: 'long3', name: 'C', type: 'rabbit', age: 100, hunger: 30, happiness: 80, health: 90, isDead: false } as Pet,
      ],
    })));

    for (let i = 0; i < 30; i++) {
      await tick();
      for (const p of captured!.state.pets || []) {
        expect(p.hunger).toBeGreaterThanOrEqual(0);
        expect(p.hunger).toBeLessThanOrEqual(100);
        expect(p.happiness).toBeGreaterThanOrEqual(0);
        expect(p.happiness).toBeLessThanOrEqual(100);
        expect(p.health).toBeGreaterThanOrEqual(0);
        expect(p.health).toBeLessThanOrEqual(100);
        expect(Number.isFinite(p.age)).toBe(true);
      }
    }
    assertClean('30-tick multi-pet');
  });

  // ── EMPTY PETS ARRAY ───────────────────────────────────────────────────
  it('Defensive: no pets → tick runs cleanly', async () => {
    mounted = mountGame();
    act(() => captured!.setGameState(prev => ({ ...prev, pets: [] })));
    await tick();
    expect(captured!.state.pets).toEqual([]);
    assertClean('no pets tick');
  });

  // ── SAVE PIPELINE ──────────────────────────────────────────────────────
  it('Save round-trip: pet state preserved through createSaveData/parseSaveData', async () => {
    mounted = mountGame();
    seedPet({ id: 'savable', name: 'Saved', type: 'cat', age: 100, hunger: 45, happiness: 80, health: 90 });
    const { createSaveData, parseSaveData } = await import('@/utils/saveValidation');
    const { STATE_VERSION } = await import('@/contexts/game/initialState');
    const env = createSaveData(captured!.state, STATE_VERSION);
    const parsed = parseSaveData(env.data, env.checksum, env.signature, env.hmac);
    expect(parsed.valid).toBe(true);
    const restored = parsed.state!.pets?.find(p => p.id === 'savable');
    expect(restored).toBeDefined();
    expect(restored!.age).toBe(100);
    expect(restored!.hunger).toBe(45);
    expect(restored!.happiness).toBe(80);
    expect(restored!.health).toBe(90);
  });
});
