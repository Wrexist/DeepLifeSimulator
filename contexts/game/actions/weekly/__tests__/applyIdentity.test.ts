/**
 * Identity & Body weekly tick — the adapter between GameState and the pure
 * simulation in `lib/identity`.
 *
 * The physiology itself is covered by `lib/identity/__tests__/body.test.ts`.
 * This file pins the WIRING: that money is charged and floored, that the gym
 * gate is read from the real item, that stat costs land on `ctx.newStats`, that
 * the legacy `stats.fitness` mirror tracks the simulation, and that the tick
 * never throws or writes a NaN into the save.
 */

import { applyIdentityForWeek, deriveStress, type IdentityWeekState } from '../applyIdentity';
import type { WeekContext } from '../weekContext';
import type { GameStats } from '@/contexts/game/types';
import { createIdentity, type Identity, type Regimen } from '@/lib/identity';

function stats(overrides: Partial<GameStats> = {}): GameStats {
  return {
    health: 100, happiness: 100, energy: 100, fitness: 50, money: 50_000, reputation: 50, gems: 0,
    ...overrides,
  };
}

function ctx(statOverrides: Partial<GameStats> = {}): WeekContext {
  return {
    newStats: stats(statOverrides),
    notifications: [],
    preRolls: {} as WeekContext['preRolls'],
    nextWeeksLived: 100,
  };
}

function state(overrides: Partial<IdentityWeekState> = {}, regimen?: Partial<Regimen>): IdentityWeekState {
  const identity: Identity = createIdentity('tick-test', 'male', 30);
  return {
    identity: regimen ? { ...identity, regimen: { ...identity.regimen, ...regimen } } : identity,
    date: { age: 30 },
    items: [{ id: 'gym_membership', owned: true }],
    ...overrides,
  };
}

describe('applyIdentityForWeek', () => {
  describe('guards', () => {
    it('no-ops on a save with no identity rather than inventing a body', () => {
      // Reconstructing a character mid-life would hand the player a stranger's
      // body on a random week. Staying inert until a load path repairs it is the
      // safe behavior.
      const c = ctx();
      const res = applyIdentityForWeek({ date: { age: 30 } }, c);
      expect(res.identity).toBeUndefined();
      expect(res.spent).toBe(0);
      expect(c.newStats.money).toBe(50_000);
    });

    it('never mutates the previous identity', () => {
      const s = state();
      const snapshot = JSON.parse(JSON.stringify(s.identity));
      applyIdentityForWeek(s, ctx());
      expect(s.identity).toEqual(snapshot);
    });

    it('survives hostile stats without writing NaN', () => {
      const c = ctx({ money: NaN, health: NaN, energy: NaN, happiness: NaN, fitness: NaN });
      const res = applyIdentityForWeek(state(), c);
      for (const v of Object.values(res.identity!.body)) {
        expect(Number.isFinite(v)).toBe(true);
      }
      expect(Number.isFinite(c.newStats.money)).toBe(true);
      expect(Number.isFinite(c.newStats.happiness)).toBe(true);
      expect(Number.isFinite(c.newStats.energy)).toBe(true);
    });

    it('survives a missing date and missing items', () => {
      const res = applyIdentityForWeek({ identity: createIdentity('x', 'female', 25) }, ctx());
      expect(res.identity).toBeDefined();
      expect(Number.isFinite(res.identity!.body.weightKg)).toBe(true);
    });
  });

  describe('money', () => {
    it('charges groceries plus wardrobe upkeep', () => {
      const c = ctx();
      const res = applyIdentityForWeek(state(), c);
      expect(res.spent).toBeGreaterThan(0);
      expect(c.newStats.money).toBe(50_000 - res.spent);
    });

    it('floors the charge at what the player actually has', () => {
      // Same contract as the luxury tick: a broke week charges less than the
      // sticker price rather than going negative.
      const c = ctx({ money: 30 });
      const res = applyIdentityForWeek(state(), c);
      expect(res.spent).toBe(30);
      expect(c.newStats.money).toBe(0);
    });

    it('never takes money below zero at any balance', () => {
      for (const money of [0, 1, 50, 109, 110, 111, 5000]) {
        const c = ctx({ money });
        applyIdentityForWeek(state(), c);
        expect(c.newStats.money).toBeGreaterThanOrEqual(0);
      }
    });

    it('charges more for bulking than for maintaining', () => {
      const bulk = ctx();
      const maintain = ctx();
      applyIdentityForWeek(state({}, { nutrition: 'bulk' }), bulk);
      applyIdentityForWeek(state({}, { nutrition: 'maintain' }), maintain);
      expect(bulk.newStats.money).toBeLessThan(maintain.newStats.money);
    });
  });

  describe('regimen wiring', () => {
    it('reads the gym gate from the real owned item', () => {
      const withGym = ctx();
      const withoutGym = ctx();
      applyIdentityForWeek(state({}, { training: 'intense' }), withGym);
      applyIdentityForWeek(
        state({ items: [{ id: 'gym_membership', owned: false }] }, { training: 'intense' }),
        withoutGym,
      );
      // No gym → downgraded to light → far less energy spent.
      expect(withoutGym.newStats.energy).toBeGreaterThan(withGym.newStats.energy);
    });

    it('surfaces a downgrade as a note the player can act on', () => {
      const res = applyIdentityForWeek(
        state({ items: [] }, { training: 'regular' }),
        ctx(),
      );
      expect(res.notes.join(' ')).toMatch(/gym membership/i);
    });

    it('is quiet on an unremarkable week', () => {
      expect(applyIdentityForWeek(state(), ctx()).notes).toEqual([]);
    });

    it('spends energy on training and happiness on cutting', () => {
      const trained = ctx();
      applyIdentityForWeek(state({}, { training: 'intense' }), trained);
      expect(trained.newStats.energy).toBeLessThan(100);

      const cutting = ctx();
      applyIdentityForWeek(state({}, { nutrition: 'cut' }), cutting);
      expect(cutting.newStats.happiness).toBeLessThan(100);
    });

    it('keeps stat mutations inside 0-100', () => {
      for (const training of ['none', 'light', 'regular', 'intense'] as const) {
        for (const nutrition of ['cut', 'maintain', 'bulk'] as const) {
          const c = ctx({ energy: 2, happiness: 1 });
          applyIdentityForWeek(state({}, { training, nutrition }), c);
          expect(c.newStats.energy).toBeGreaterThanOrEqual(0);
          expect(c.newStats.energy).toBeLessThanOrEqual(100);
          expect(c.newStats.happiness).toBeGreaterThanOrEqual(0);
          expect(c.newStats.happiness).toBeLessThanOrEqual(100);
        }
      }
    });
  });

  describe('legacy stats.fitness mirror', () => {
    it('drifts toward the simulated fitness instead of overwriting it', () => {
      // Other systems nudge stats.fitness too; stomping it every week would
      // silently erase them.
      const s = state({}, { training: 'intense' });
      const simulated = s.identity!.body.fitness;
      const c = ctx({ fitness: 0 });
      applyIdentityForWeek(s, c);
      expect(c.newStats.fitness).toBeGreaterThan(0);
      expect(c.newStats.fitness).toBeLessThan(simulated);
    });

    it('converges over many weeks of training', () => {
      let s = state({}, { training: 'intense' });
      let fitness = 0;
      for (let i = 0; i < 60; i++) {
        const c = ctx({ fitness });
        const res = applyIdentityForWeek(s, c);
        s = { ...s, identity: res.identity };
        fitness = c.newStats.fitness;
      }
      expect(fitness).toBeGreaterThan(50);
      expect(fitness).toBeLessThanOrEqual(100);
    });
  });

  describe('long-run stability', () => {
    it('stays finite and in range across a 3000-week life', () => {
      let s = state({}, { training: 'regular', nutrition: 'bulk' });
      for (let week = 0; week < 3000; week++) {
        const c = ctx({ money: week % 7 === 0 ? 0 : 50_000, energy: week % 5 === 0 ? 3 : 90 });
        const res = applyIdentityForWeek({ ...s, date: { age: 18 + week / 52 } }, c);
        s = { ...s, identity: res.identity };
        expect(Number.isFinite(res.identity!.body.weightKg)).toBe(true);
        expect(res.identity!.body.bodyFatPct).toBeGreaterThan(0);
        expect(res.identity!.style.grooming).toBeGreaterThanOrEqual(0);
        expect(c.newStats.money).toBeGreaterThanOrEqual(0);
      }
    });

    it('produces a visibly different body from training than from sitting still', () => {
      const run = (regimen: Partial<Regimen>) => {
        let s = state({}, regimen);
        for (let i = 0; i < 104; i++) {
          const res = applyIdentityForWeek(s, ctx());
          s = { ...s, identity: res.identity };
        }
        return s.identity!.body;
      };
      const trained = run({ training: 'regular', nutrition: 'bulk' });
      const idle = run({ training: 'none', nutrition: 'maintain' });
      expect(trained.muscle).toBeGreaterThan(idle.muscle + 10);
      expect(trained.fitness).toBeGreaterThan(idle.fitness);
    });
  });
});

describe('deriveStress', () => {
  it('is 0 when fully happy and rested, 100 when neither', () => {
    expect(deriveStress(100, 100)).toBe(0);
    expect(deriveStress(0, 0)).toBe(100);
  });

  it('weights unhappiness above tiredness', () => {
    expect(deriveStress(0, 100)).toBeGreaterThan(deriveStress(100, 0));
  });

  it('clamps hostile inputs into range', () => {
    for (const [h, e] of [[NaN, NaN], [999, -999], [-1, 1e9]]) {
      const v = deriveStress(h, e);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(100);
    }
  });
});
