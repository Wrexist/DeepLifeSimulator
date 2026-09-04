/**
 * Housing, through the REAL weekly tick.
 *
 * ── Why this exists as a tick test rather than a unit test ────────────────
 *
 * `applyHousingWellbeing` was already covered in isolation, and it was right:
 * it returned `-4` happiness for a homeless week and the unit test asserted it.
 * The tick then dropped that value on the floor, because the consumer several
 * hundred lines downstream still read `if (housingHappinessBonus > 0)` — a
 * guard that was harmless while the value was an owned-residence bonus and
 * became a silent bug the moment it turned signed.
 *
 * A unit test on the reducer cannot see a downstream guard. Health and energy
 * were unaffected (the reducer writes those straight into `newStats`), so the
 * failure was confined to exactly the stat no isolated test could observe.
 * These run the provider's real `nextWeek` and read what actually landed.
 *
 * ── One tick per mount, deliberately ──────────────────────────────────────
 *
 * `nextWeek` is async and holds an anti-mash guard (`nextWeekInProgressRef`)
 * that it clears after an await. Inside a synchronous `act()` that continuation
 * never runs, so a SECOND `nextWeek()` on the same mount returns immediately
 * and does nothing. Two measurements sharing a mount would therefore compare a
 * real week against a week that never happened — which reads as "the effect is
 * zero" rather than as a broken test. Every measurement below gets its own
 * provider, and asserts the week actually advanced before reading anything.
 */

/* eslint-disable import/first --
 * `jest.mock` goes above the imports, matching every other stress suite here
 * (crimeJailFlow, achievementsFlow, deathRevivePrestige). The factory is
 * hoisted either way, but keeping the mock visibly first is the convention the
 * file inherits, and six `import/first` warnings for it is not a trade. */

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
import type { GameState, GameStats } from '@/contexts/game/types';
import { HOMELESS_PENALTY, RENTAL_TIERS } from '@/lib/realEstate/rentals';

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

/** A settled, unemployed, debt-free character, so housing is what moves. */
const START_WEEK = 100;
// Energy sits at 40, not 60: the weekly regen is +30, so a 60 start puts the
// RENTED case at 101 and clamps it to 100 — which silently ate one point of the
// gap and made the ladder's own numbers look wrong. Every stat here has to
// finish the week clear of both 0 and 100 for the deltas to mean anything.
const BASE_STATS = { money: 50_000, health: 60, happiness: 60, energy: 40, fitness: 50 };

interface Measured {
  before: GameStats;
  after: GameStats;
  overdueBalance: number;
  rental: GameState['rental'];
}

/**
 * Mount a fresh game, seed it, run exactly ONE real week, and report the stats
 * either side of it.
 */
function oneWeekWith(overrides: Partial<GameState>): Measured {
  captured = null;
  let root: { unmount: () => void } | undefined;
  act(() => {
    root = TestRenderer.create(
      h(UIUXProvider as never, null, h(GameProvider as never, null, h(ProbeComponent))),
    );
  });
  try {
    act(() => captured!.setGameState((prev) => ({
      ...prev,
      weeksLived: START_WEEK,
      date: { ...prev.date, age: 25, year: 2032 },
      stats: { ...prev.stats, ...BASE_STATS },
      currentJob: undefined,
      careers: [],
      educations: [],
      dietPlans: [],
      loans: [],
      realEstate: [],
      overdueBalance: 0,
      rental: undefined,
      ...overrides,
    })));

    const before = { ...captured!.state.stats };
    act(() => { captured!.game.nextWeek(); });
    const state = captured!.state;

    // The guard above makes a silent no-op the likeliest failure mode, so prove
    // the week actually happened before reading anything off it.
    expect(state.weeksLived).toBe(START_WEEK + 1);

    return {
      before,
      after: { ...state.stats },
      overdueBalance: state.overdueBalance ?? 0,
      rental: state.rental,
    };
  } finally {
    act(() => root?.unmount());
  }
}

const drop = (m: Measured, stat: 'health' | 'happiness' | 'energy') =>
  m.before[stat] - m.after[stat];
const happinessDrop = (m: Measured) => drop(m, 'happiness');
const moneySpent = (m: Measured) => m.before.money - m.after.money;

describe('the homeless penalty lands on every stat it claims', () => {
  it('costs exactly the ladder gap on ALL THREE stats, happiness included', () => {
    // Measured against an otherwise identical week in the cheapest room, so
    // natural decay — which moves happiness on its own, and would let a much
    // weaker assertion pass with the bug in place — cancels out. What is left
    // is the housing term: the penalty avoided plus the tier's own bonus.
    const tier = RENTAL_TIERS[0];
    const homeless = oneWeekWith({});
    const rented = oneWeekWith({ rental: { tierId: tier.id, startedWeek: 1 } });

    // Happiness is the one that regressed: it travels through a named variable
    // and a downstream fold, where health and energy are written directly.
    // Precision 2, not 6, and only on happiness. Program 14 made a happiness
    // GAIN worth less the happier a life already is, so the homeless and rented
    // weeks are scaled by slightly different multipliers (they sit at different
    // happiness levels by construction) and the gap comes out at 4.9987 rather
    // than exactly 5. Health and energy carry no such curve and stay exact
    // below. The assertion still catches the regression it was written for:
    // that was a whole missing housing term, not a thousandth of a point.
    expect(happinessDrop(homeless) - happinessDrop(rented)).toBeCloseTo(
      Math.abs(HOMELESS_PENALTY.happiness) + tier.happiness,
      2,
    );
    expect(drop(homeless, 'health') - drop(rented, 'health')).toBeCloseTo(
      Math.abs(HOMELESS_PENALTY.health) + tier.health,
      6,
    );
    expect(drop(homeless, 'energy') - drop(rented, 'energy')).toBeCloseTo(
      Math.abs(HOMELESS_PENALTY.energy) + tier.energy,
      6,
    );
  });

  it('never drives happiness below zero', () => {
    const m = oneWeekWith({ stats: { ...BASE_STATS, happiness: 1 } as GameStats });
    expect(m.after.happiness).toBeGreaterThanOrEqual(0);
    expect(Number.isFinite(m.after.happiness)).toBe(true);
  });
});

describe('a rental is charged, and charged once', () => {
  const TIER = RENTAL_TIERS[2];

  it('does not bill the week the tenancy was signed', () => {
    // `resolveRentHome` takes the first week at signing, so the tick that
    // carries the player out of that week must not take it again.
    const signing = oneWeekWith({ rental: { tierId: TIER.id, startedWeek: START_WEEK } });
    const ordinary = oneWeekWith({ rental: { tierId: TIER.id, startedWeek: 20 } });

    expect(moneySpent(ordinary) - moneySpent(signing)).toBe(TIER.weeklyRent);
    expect(moneySpent(signing)).toBe(0);
  });

  it('leaves the tenancy in place for a solvent renter', () => {
    const m = oneWeekWith({ rental: { tierId: TIER.id, startedWeek: 20 } });
    expect(m.rental?.tierId).toBe(TIER.id);
    expect(m.rental?.missedWeeks).toBeFalsy();
    expect(m.overdueBalance).toBe(0);
  });
});
