/**
 * Nothing is complete before the first action, and nothing is unreachable.
 *
 *  - "Live a Life of Crime" > First Score read `criminalLevel > 0`, and every
 *    life starts at criminal level 1, so it was done (and locked in) at birth.
 *  - "Social Life" counted the two seeded parents.
 *  - "Triple Digits" / "Hustler" / "Four Figures" read the cash BALANCE, which
 *    most scenarios start above.
 *  - "Fully Vaccinated" wanted 5 vaccinations while only 2 exist.
 *  - Longevity badges read the drifting `date.age`.
 */
import { createTestGameState } from '../helpers/createTestGameState';
import { initialGameState } from '@/contexts/game/initialState';
import type { GameState } from '@/contexts/game/types';
import { achievements, VACCINE_IDS } from '@/src/features/onboarding/achievementsData';
import { LIFE_AMBITIONS } from '@/lib/ambitions/catalog';

function spec(id: string) {
  const a = achievements.find((x) => x.id === id);
  if (!a) throw new Error(`no achievement ${id}`);
  return a.progressSpec;
}

function isMet(id: string, gs: GameState): boolean {
  const p = spec(id);
  if (p.kind === 'boolean') return p.met(gs);
  if (p.kind === 'counter') return p.current(gs) >= p.goal;
  throw new Error(`unexpected spec kind for ${id}`);
}

const firstScore = () => {
  const crime = LIFE_AMBITIONS.find((a) => a.id === 'life_of_crime');
  const m = crime?.milestones.find((x) => x.id === 'cr_first_job');
  if (!m) throw new Error('First Score milestone missing');
  return m;
};

describe('Live a Life of Crime - First Score', () => {
  it('is not complete for a fresh life at the starting criminal level', () => {
    const s = createTestGameState({ criminalLevel: 1, criminalXp: 0, streetJobsCompleted: 0 });
    expect(firstScore().checkComplete(s)).toBe(false);
    expect(firstScore().checkProgress?.(s)).toBe(0);
  });

  it('completes on the first street job, or past the starting level', () => {
    expect(firstScore().checkComplete(createTestGameState({ streetJobsCompleted: 1 }))).toBe(true);
    expect(firstScore().checkComplete(createTestGameState({ criminalLevel: 2 }))).toBe(true);
  });
});

describe('beginner achievements are not pre-ticked', () => {
  it('Social Life ignores the seeded parents', () => {
    const base = createTestGameState();
    const parentsOnly: GameState = {
      ...base,
      relationships: (base.relationships ?? []).filter((r) => r.type === 'parent'),
    };
    expect(isMet('beginner_social_life', parentsOnly)).toBe(false);
  });

  it('the money tiers read money EARNED, not a $50,000 starting balance', () => {
    const base = createTestGameState({ stats: { money: 50_000 } });
    const trustFund: GameState = {
      ...base,
      lifetimeStatistics: { ...base.lifetimeStatistics!, totalMoneyEarned: 0 },
    };
    for (const id of ['beginner_triple_digits', 'beginner_hustler', 'beginner_four_figures']) {
      expect(isMet(id, trustFund)).toBe(false);
    }
    const earner: GameState = {
      ...trustFund,
      lifetimeStatistics: { ...trustFund.lifetimeStatistics!, totalMoneyEarned: 1_000 },
    };
    expect(isMet('beginner_four_figures', earner)).toBe(true);
  });
});

describe('Fully Vaccinated is reachable', () => {
  it('every vaccine id it counts is offered by the clinic', () => {
    const offered = new Set((initialGameState.healthActivities ?? []).map((a) => a.id));
    for (const id of VACCINE_IDS) expect(offered.has(id)).toBe(true);
  });

  it('is met by receiving every vaccine', () => {
    const s = createTestGameState({ vaccinations: [...VACCINE_IDS] });
    expect(isMet('health_vaccinated', s)).toBe(true);
  });
});

describe('longevity reads the true age', () => {
  it('reaches 50 on the week weeksLived says so, even when date.age lags', () => {
    const base = createTestGameState();
    const s = createTestGameState({
      weeksLived: 32 * 52,
      lifeStartWeek: 0,
      date: { ...base.date, age: 49.97 },
    });
    expect(isMet('longevity_50', s)).toBe(true);
  });
});
