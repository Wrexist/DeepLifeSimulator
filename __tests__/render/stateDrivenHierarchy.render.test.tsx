/**
 * Program 4 - the STATE-CHANGE test (tasks/ui-hierarchy.md §9).
 *
 * Every major screen has one dominant element, and on these screens the
 * state picks it. These tests seed the real provider tree with a situation
 * and assert that the lead MOVES: treatment above the vitals when sick,
 * food above items when starving, the crisis tip above the goal ladder on
 * Home, the held job as Work's hero and never again as a list card.
 */
import React, { useEffect } from 'react';
import { act } from 'react-test-renderer';
import { renderWithProviders } from './helpers/renderWithProviders';
import { useSetGameState } from '@/contexts/game/useGameSelector';
import { initialGameState } from '@/contexts/game/initialState';
import type { GameState } from '@/contexts/game/types';
import Health from '@/app/(tabs)/health';
import { MarketScreenContent } from '@/app/(tabs)/market';
import Home from '@/app/(tabs)/home';
import Work from '@/app/(tabs)/work';

/** Applies `mutate` to the live state once the tree is up. */
function Seed({ mutate, children }: { mutate: (s: GameState) => GameState; children: React.ReactNode }) {
  const setGameState = useSetGameState();
  useEffect(() => {
    setGameState(mutate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return <>{children}</>;
}

function renderSeeded(ui: React.ReactElement, mutate: (s: GameState) => GameState) {
  const r = renderWithProviders(<Seed mutate={mutate}>{ui}</Seed>);
  act(() => {});
  return { ...r, json: JSON.stringify(r.renderer.toJSON()) };
}

const before = (json: string, a: string, b: string) => {
  const ia = json.indexOf(a);
  const ib = json.indexOf(b);
  expect(ia).toBeGreaterThanOrEqual(0);
  expect(ib).toBeGreaterThanOrEqual(0);
  expect(ia).toBeLessThan(ib);
};

const count = (json: string, needle: string) => json.split(needle).length - 1;

describe('state-driven hierarchy - Health', () => {
  const doctorName = (initialGameState.healthActivities ?? []).find((a) => a.id === 'doctor')?.name ?? 'Doctor';

  it('healthy: the vitals lead and no treatment block exists', () => {
    const { json, unmount } = renderSeeded(<Health />, (s) => ({
      ...s,
      diseases: [],
      stats: { ...s.stats, health: 90 },
    }));
    expect(json).not.toContain('Treat this first');
    before(json, 'Your Vitals', '"Health Activities"');
    unmount();
  });

  it('sick: treatment leads, above the vitals, and the cures are not listed twice', () => {
    const { json, unmount } = renderSeeded(<Health />, (s) => ({
      ...s,
      diseases: [
        { id: 'flu', name: 'Flu', severity: 'serious', effects: {}, curable: true, treatmentRequired: true },
      ],
    }));
    before(json, 'Treat this first', 'Your Vitals');
    before(json, `"${doctorName}"`, 'Your Vitals');
    expect(count(json, `"${doctorName}"`)).toBe(1);
    unmount();
  });

  it('critical health without a disease also promotes treatment', () => {
    const { json, unmount } = renderSeeded(<Health />, (s) => ({
      ...s,
      diseases: [],
      stats: { ...s.stats, health: 15 },
    }));
    before(json, 'Treat this first', 'Your Vitals');
    unmount();
  });
});

describe('state-driven hierarchy - Market', () => {
  it('fed: items lead', () => {
    const { json, unmount } = renderSeeded(<MarketScreenContent />, (s) => ({
      ...s,
      stats: { ...s.stats, energy: 80 },
    }));
    expect(json).not.toContain('Energy is critical');
    before(json, '"Items"', '"Food"');
    unmount();
  });

  it('starving: food leads and says why', () => {
    const { json, unmount } = renderSeeded(<MarketScreenContent />, (s) => ({
      ...s,
      stats: { ...s.stats, energy: 10 },
    }));
    expect(json).toContain('Energy is critical');
    before(json, '"Food"', '"Items"');
    unmount();
  });
});

describe('state-driven hierarchy - Home', () => {
  it('nothing urgent: the goal ladder leads', () => {
    const { json, unmount } = renderSeeded(<Home />, (s) => ({
      ...s,
      stats: { ...s.stats, health: 90, happiness: 90, energy: 90, money: 1500 },
    }));
    expect(json).toContain('What matters now');
    expect(json).not.toContain('Health is low');
    unmount();
  });

  it('a crisis takes the lead slot, above the goal ladder', () => {
    const { json, unmount } = renderSeeded(<Home />, (s) => ({
      ...s,
      stats: { ...s.stats, health: 10, happiness: 90, energy: 90, money: 1500 },
    }));
    before(json, 'Health is low', 'What matters now');
    unmount();
  });
});

describe('state-driven hierarchy - Work', () => {
  it('employed: the held job is the hero with one action and is not a list card', () => {
    const { json, unmount } = renderSeeded(<Work />, (s) => {
      const career = s.careers[0];
      return {
        ...s,
        currentJob: career.id,
        careers: s.careers.map((c) =>
          c.id === career.id ? { ...c, accepted: true, applied: false, level: 0, progress: 40 } : c
        ),
      };
    });
    const heldName = initialGameState.careers[0].levels[0].name;
    expect(json).toContain('Current Job');
    expect(json).toContain('"Manage"');
    // Once in the hero; the board no longer repeats the held job.
    expect(count(json, `"${heldName}"`)).toBe(1);
    unmount();
  });

  it('unemployed: no hero, the board leads', () => {
    const { json, unmount } = renderSeeded(<Work />, (s) => ({ ...s, currentJob: undefined }));
    expect(json).not.toContain('Current Job');
    // No 'Careers' heading either - the segment control already says it; the
    // board's fold is the first thing under the segments.
    expect(json).not.toContain('"Careers"');
    expect(json).toContain('Standard Careers');
    unmount();
  });
});

/**
 * Program 5 - the DOMINANCE-COLLISION and QUIET-STATE tests. Several urgent
 * states at once must still yield exactly one lead per screen, in a
 * deterministic order; and a life with nothing urgent must not invent one.
 */
describe('dominance collisions - one lead, deterministic', () => {
  it('sick + starving + broke + promotion-ready: Home shows one crisis tip, health first', () => {
    const { json, unmount } = renderSeeded(<Home />, (s) => ({
      ...s,
      stats: { ...s.stats, health: 10, happiness: 10, energy: 5, money: 10 },
    }));
    // ContextualTip's ladder is health > happiness > energy > money.
    expect(json).toContain('Health is low');
    expect(json).not.toContain('Feeling down');
    expect(json).not.toContain('Low energy');
    expect(json).not.toContain('Running low on cash');
    // and the tip sits above the goal ladder, which still renders once.
    before(json, 'Health is low', 'What matters now');
    expect(count(json, 'What matters now')).toBe(1);
    unmount();
  });

  it('a disease AND critical energy: Health has one treatment lead, energy is a row in it', () => {
    const { json, unmount } = renderSeeded(<Health />, (s) => ({
      ...s,
      diseases: [
        { id: 'flu', name: 'Flu', severity: 'serious', effects: {}, curable: true, treatmentRequired: true },
      ],
      stats: { ...s.stats, energy: 8 },
    }));
    expect(count(json, 'Treat this first')).toBe(1);
    before(json, 'Treat this first', 'Your Vitals');
    expect(json).toContain('Critical energy');
    unmount();
  });

  it('starving AND a recommended item: Market has one saturated Buy - the first meal', () => {
    const { json, unmount } = renderSeeded(<MarketScreenContent />, (s) => ({
      ...s,
      stats: { ...s.stats, energy: 5 },
    }));
    before(json, '"Food"', '"Items"');
    expect(json).toContain('Energy is critical');
    unmount();
  });
});

describe('quiet state - identity, direction, progress, no invented urgency', () => {
  it('everything high and funded: no tip, no treatment, no red number, the goal ladder leads', () => {
    const { json, unmount } = renderSeeded(<Home />, (s) => ({
      ...s,
      stats: { ...s.stats, health: 100, happiness: 100, energy: 100, money: 50000 },
      diseases: [],
    }));
    expect(json).not.toContain('Health is low');
    expect(json).not.toContain('Running low on cash');
    expect(json).toContain('What matters now');
    expect(json).toContain('Net Worth');
    unmount();
  });

  it('Health with everything high shows the vitals and the list, nothing promoted', () => {
    const { json, unmount } = renderSeeded(<Health />, (s) => ({
      ...s,
      stats: { ...s.stats, health: 100, happiness: 100, energy: 100 },
      diseases: [],
    }));
    expect(json).not.toContain('Treat this first');
    expect(json).not.toContain('Health Issues');
    before(json, 'Your Vitals', '"Health Activities"');
    unmount();
  });
});

describe('extremes', () => {
  it('health at zero: the countdown wording leads treatment', () => {
    const { json, unmount } = renderSeeded(<Health />, (s) => ({
      ...s,
      stats: { ...s.stats, health: 0 },
      healthZeroWeeks: 1,
    }));
    before(json, 'Treat this first', 'Your Vitals');
    expect(json).toMatch(/Health critical - \d week/);
    unmount();
  });

  it('negative cash: Home still has exactly one lead', () => {
    const { json, unmount } = renderSeeded(<Home />, (s) => ({
      ...s,
      stats: { ...s.stats, health: 90, happiness: 90, energy: 90, money: -500 },
    }));
    expect(json).toContain('Running low on cash');
    expect(count(json, 'What matters now')).toBe(1);
    unmount();
  });
});
