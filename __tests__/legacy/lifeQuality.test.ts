/**
 * The Life Quality score.
 *
 * This number is printed at 22pt next to a face on the death screen, so the
 * bar it has to clear is not "does it compute" — it is "would a player who read
 * it and disagreed be right?". The tests are therefore mostly about ORDER and
 * about the specific wrong answers the easy implementations give:
 *
 *   - happiness at the final tick → a rich, accomplished character who died old
 *     with decayed stats scores near zero
 *   - net worth alone → the game is about money and says so
 *   - anything that can exceed 100 or go negative → the gauge draws a full
 *     circle or an empty one and looks broken either way
 */

import { createTestGameState } from '../helpers/createTestGameState';
import {
  LIFE_QUALITY_TARGETS,
  lifeQuality,
  type LifeQualityBand,
} from '@/lib/legacy/lifeQuality';
import { WEEKS_PER_YEAR } from '@/lib/config/gameConstants';
import type { GameState } from '@/contexts/game/types';

const T = LIFE_QUALITY_TARGETS;

const emptyLife = (): GameState => {
  const s = createTestGameState({ weeksLived: 2 * WEEKS_PER_YEAR });
  s.stats.money = 0;
  s.stats.health = 0;
  s.stats.happiness = 0;
  s.stats.fitness = 0;
  s.bankSavings = 0;
  s.claimedProgressAchievements = [];
  s.relationships = [];
  s.realEstate = [];
  s.educations = [];
  s.careers = [];
  s.family = { ...(s.family ?? {}), spouse: undefined, children: [] } as never;
  return s;
};

const fullLife = (): GameState => {
  const s = emptyLife();
  s.weeksLived = T.yearsLived * WEEKS_PER_YEAR;
  s.stats.money = T.netWorth;
  s.stats.health = 100;
  s.stats.happiness = 100;
  s.stats.fitness = 100;
  s.claimedProgressAchievements = Array.from({ length: T.achievements }, (_, i) => `a${i}`);
  s.relationships = Array.from({ length: T.relationships }, (_, i) => ({ id: `r${i}` })) as never;
  s.family = {
    ...(s.family ?? {}),
    spouse: { id: 'sp', name: 'Alex' },
    children: Array.from({ length: T.children }, (_, i) => ({ id: `c${i}` })),
  } as never;
  s.careers = [
    { id: 'tech', level: T.careerLevel - 1, accepted: true, levels: [], applied: true },
  ] as never;
  return s;
};

const band = (s: GameState, id: string): LifeQualityBand =>
  lifeQuality(s).bands.find((b) => b.id === id)!;

// ---------------------------------------------------------------------------

describe('the score stays inside the gauge', () => {
  it('is 0 for a life that did nothing', () => {
    expect(lifeQuality(emptyLife()).score).toBe(0);
  });

  it('is 100 for a life that hit every target', () => {
    expect(lifeQuality(fullLife()).score).toBe(100);
  });

  it('cannot exceed 100 however far past the targets a life goes', () => {
    // A gauge over 100 draws past its own end and reads as a bug.
    const s = fullLife();
    s.stats.money = T.netWorth * 500;
    s.weeksLived = 200 * WEEKS_PER_YEAR;
    s.claimedProgressAchievements = Array.from({ length: 900 }, (_, i) => `a${i}`);
    expect(lifeQuality(s).score).toBe(100);
  });

  it('cannot go negative on a corrupt save', () => {
    const s = emptyLife();
    s.stats.money = -999_999;
    s.stats.health = -50;
    expect(lifeQuality(s).score).toBe(0);
  });

  it('degrades to 0 rather than throwing on a null state', () => {
    expect(lifeQuality(null).score).toBe(0);
    expect(lifeQuality(undefined).verdict).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------

describe('it judges the LIFE, not the final tick', () => {
  it('scores a rich, accomplished old age well despite worn-out stats', () => {
    // The bug the easy version ships: `happiness` at death is the worst single
    // sample of a whole life. Someone who died of old age has decayed vitals by
    // definition, and telling them their life was 4% is simply wrong.
    const s = fullLife();
    s.stats.health = 3;
    s.stats.happiness = 2;
    s.stats.fitness = 1;

    expect(lifeQuality(s).score).toBeGreaterThan(80);
  });

  it('does not score an idle life highly just because it ended cheerful', () => {
    const s = emptyLife();
    s.stats.health = 100;
    s.stats.happiness = 100;
    s.stats.fitness = 100;

    // The condition band is worth 8 of 100 for exactly this reason.
    expect(lifeQuality(s).score).toBeLessThanOrEqual(10);
  });

  it('caps the vitals band so it cannot carry the score alone', () => {
    const s = emptyLife();
    s.stats.health = 100;
    s.stats.happiness = 100;
    s.stats.fitness = 100;
    expect(band(s, 'condition').earned).toBeLessThanOrEqual(1);
    expect(band(s, 'condition').weight).toBe(8);
  });
});

// ---------------------------------------------------------------------------

describe('money is worth a fifth, not the whole thing', () => {
  it('a billionaire who did nothing else scores below halfway', () => {
    // A life-quality score that money alone can max is a score saying the game
    // is about money. Wealth is the axis with the widest range and the most
    // direct purchase path, so it is deliberately capped low.
    const s = emptyLife();
    s.stats.money = 5_000_000_000;
    expect(lifeQuality(s).score).toBeLessThan(50);
  });

  it('counts savings, stocks and property, not just cash', () => {
    const cashOnly = emptyLife();
    cashOnly.stats.money = T.netWorth / 4;

    const spread = emptyLife();
    spread.stats.money = T.netWorth / 8;
    spread.bankSavings = T.netWorth / 8;

    expect(band(spread, 'wealth').earned).toBeCloseTo(band(cashOnly, 'wealth').earned, 5);
  });

  it('values a property at its live value, not zero', () => {
    // `RealEstate` has no `value` field — reading one scored every property at
    // nothing, which is a bug this repo has already shipped once in the ribbon
    // system's own net-worth helper.
    const s = emptyLife();
    s.realEstate = [{ id: 'h1', owned: true, currentValue: T.netWorth }] as never;
    expect(band(s, 'wealth').earned).toBe(1);
  });

  it('ignores a property that was sold', () => {
    const s = emptyLife();
    s.realEstate = [{ id: 'h1', owned: false, currentValue: T.netWorth }] as never;
    expect(band(s, 'wealth').earned).toBe(0);
  });
});

// ---------------------------------------------------------------------------

describe('the bands', () => {
  it('sum to exactly 100 points, so the score IS a percentage', () => {
    const total = lifeQuality(fullLife()).bands.reduce((n, b) => n + b.weight, 0);
    expect(total).toBe(100);
  });

  it('credits marriage even with no children', () => {
    const married = emptyLife();
    married.family = { ...(married.family ?? {}), spouse: { id: 'sp', name: 'Alex' }, children: [] } as never;
    expect(band(married, 'family').earned).toBeGreaterThan(0);
  });

  it('scores the career PEAK, not the job held at death', () => {
    // Someone who retired from a directorship should not be scored as
    // unemployed because they spent their last year fishing.
    const retired = emptyLife();
    retired.currentJob = undefined;
    retired.careers = [
      { id: 'tech', level: T.careerLevel - 1, accepted: true, levels: [], applied: true },
    ] as never;
    expect(band(retired, 'career').earned).toBe(1);
  });

  it('gives no career credit for a job merely applied to', () => {
    const s = emptyLife();
    s.careers = [
      { id: 'tech', level: 5, accepted: false, applied: true, levels: [] },
    ] as never;
    expect(band(s, 'career').earned).toBe(0);
  });
});

// ---------------------------------------------------------------------------

describe('the verdict and the face', () => {
  it('reads worse as the score falls, and never skips a band', () => {
    const moods = [0, 30, 50, 70, 90].map((target) => {
      const s = emptyLife();
      s.claimedProgressAchievements = Array.from(
        { length: Math.round((target / 100) * T.achievements * 4.5) },
        (_, i) => `a${i}`
      );
      return lifeQuality(s).mood;
    });
    expect(moods[0]).toBe('bleak');
    // Monotonic: the face never improves as the score drops.
    const order = ['bleak', 'poor', 'fair', 'good', 'great'];
    const indexes = moods.map((m) => order.indexOf(m));
    expect([...indexes].sort((a, b) => a - b)).toEqual(indexes);
  });

  it('always returns a verdict word, at every score', () => {
    for (let i = 0; i <= 100; i += 1) {
      const s = emptyLife();
      s.stats.money = (i / 100) * T.netWorth * 5;
      expect(lifeQuality(s).verdict).toBeTruthy();
    }
  });

  it('is deterministic — the same state always scores the same', () => {
    const s = fullLife();
    expect(lifeQuality(s)).toEqual(lifeQuality(s));
  });
});
