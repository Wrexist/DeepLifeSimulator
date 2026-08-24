/**
 * The dynasty rank ladder — surfaced, and extended past where it stopped.
 *
 * `getDynastyTier` shipped with six ranks, a title and a description each, fed
 * by `dynastyStats` (persisted, and updated on every death) — and **zero
 * consumers anywhere in the app**. A working cross-life progression score no
 * player had ever seen. Same "built but unreachable" class as the legacy shop's
 * missing buy button and the automation engine's missing UI (that one was
 * deleted outright in 2026-08-06 rather than surfaced).
 *
 * Surfacing it exposed the second problem: the ladder capped at 1,000 while the
 * score is unbounded in practice (`totalGenerations` grows +1 per death
 * forever, and each heirloom adds `generationsHeld * 2`). A 50-generation
 * family sat at the top rank with nothing left to climb.
 */

import fs from 'fs';
import path from 'path';
import {
  DYNASTY_RANKS,
  getDynastyTier,
  getDynastyProgress,
  calculateDynastyScore,
} from '@/lib/legacy/dynasty';
import type { DynastyStats } from '@/contexts/game/types';

const baseStats = (over: Partial<DynastyStats> = {}): DynastyStats => ({
  totalGenerations: 0,
  totalWealth: 0,
  familyReputation: 0,
  heirlooms: [],
  familyAchievements: [],
  longestLivingMember: { name: '', age: 0 },
  wealthiestMember: { name: '', netWorth: 0 },
  totalChildrenAllGenerations: 0,
  dynastyFoundedYear: 2000,
  ...over,
});

describe('the rank ladder', () => {
  it('is ordered by ascending threshold', () => {
    for (let i = 1; i < DYNASTY_RANKS.length; i += 1) {
      expect(`${DYNASTY_RANKS[i].tier}:${DYNASTY_RANKS[i].minScore > DYNASTY_RANKS[i - 1].minScore}`)
        .toBe(`${DYNASTY_RANKS[i].tier}:true`);
    }
  });

  it('starts at zero, so every family has a rank', () => {
    expect(DYNASTY_RANKS[0].minScore).toBe(0);
    expect(getDynastyTier(baseStats()).tier).toBe('humble');
  });

  it('uses unique tiers and titles', () => {
    expect(new Set(DYNASTY_RANKS.map((r) => r.tier)).size).toBe(DYNASTY_RANKS.length);
    expect(new Set(DYNASTY_RANKS.map((r) => r.title)).size).toBe(DYNASTY_RANKS.length);
  });

  it('keeps the six original tiers, so nothing regresses for an existing save', () => {
    for (const tier of ['humble', 'emerging', 'established', 'notable', 'prestigious', 'legendary']) {
      expect(`${tier}:${DYNASTY_RANKS.some((r) => r.tier === tier)}`).toBe(`${tier}:true`);
    }
  });

  it('extends above the old cap of 1,000', () => {
    const top = DYNASTY_RANKS[DYNASTY_RANKS.length - 1];
    expect(top.minScore).toBeGreaterThan(1000);
  });

  it('returns the highest rank whose threshold is met', () => {
    for (const rank of DYNASTY_RANKS) {
      // A family scoring exactly the threshold holds that rank...
      const stats = baseStats({ familyReputation: rank.minScore });
      // ...unless a later rank shares the score, which the ordering test rules out.
      const expected = [...DYNASTY_RANKS].reverse().find((r) => rank.minScore >= r.minScore)!;
      expect(`${rank.tier}:${getDynastyTier(stats).tier}`).toBe(`${rank.tier}:${expected.tier}`);
    }
  });
});

describe('the score', () => {
  it('is zero for a family that has done nothing', () => {
    expect(calculateDynastyScore(baseStats())).toBe(0);
  });

  it('grows with generations, which is what makes it unbounded', () => {
    const ten = calculateDynastyScore(baseStats({ totalGenerations: 10 }));
    const fifty = calculateDynastyScore(baseStats({ totalGenerations: 50 }));
    expect(fifty).toBeGreaterThan(ten);
    expect(ten).toBe(100);
  });

  it('survives a partial or corrupt stats object rather than returning NaN', () => {
    // dynastyStats is optional on GameState, and an old save may be missing
    // arrays the original implementation called .forEach on directly.
    const partial = { totalGenerations: 3 } as unknown as DynastyStats;
    const score = calculateDynastyScore(partial);
    expect(Number.isFinite(score)).toBe(true);
    expect(score).toBe(30);
  });

  it('a long dynasty can actually reach the new top rank', () => {
    // Guards against thresholds picked as round numbers rather than against
    // the real growth curve. This is a deep-but-plausible family.
    const stats = baseStats({
      totalGenerations: 60,
      totalWealth: 2_000_000_000,
      familyReputation: 100,
      familyAchievements: new Array(60).fill('a'),
      longestLivingMember: { name: 'x', age: 95 },
      heirlooms: new Array(15).fill(null).map(() => ({
        rarity: 'legendary',
        generationsHeld: 30,
      })) as unknown as DynastyStats['heirlooms'],
    });
    const top = DYNASTY_RANKS[DYNASTY_RANKS.length - 1];
    expect(calculateDynastyScore(stats)).toBeGreaterThanOrEqual(top.minScore);
    expect(getDynastyTier(stats).tier).toBe(top.tier);
  });
});

describe('progress toward the next rank', () => {
  it('reports the next rank and a 0..1 position within the current band', () => {
    const first = DYNASTY_RANKS[0];
    const second = DYNASTY_RANKS[1];
    const midpoint = Math.floor((first.minScore + second.minScore) / 2);

    const p = getDynastyProgress(baseStats({ familyReputation: midpoint }));

    expect(p.rank.tier).toBe(first.tier);
    expect(p.next?.tier).toBe(second.tier);
    expect(p.progress).toBeGreaterThan(0.3);
    expect(p.progress).toBeLessThan(0.7);
  });

  it('never runs backwards when a new rank is entered', () => {
    // The bar resets into the NEW band rather than jumping - so progress is
    // always within [0,1] at every score, including exactly on a boundary.
    for (const rank of DYNASTY_RANKS) {
      const p = getDynastyProgress(baseStats({ familyReputation: rank.minScore }));
      expect(`${rank.tier}:${p.progress >= 0 && p.progress <= 1}`).toBe(`${rank.tier}:true`);
    }
  });

  it('sits at full with no next rank once the ladder is topped', () => {
    const top = DYNASTY_RANKS[DYNASTY_RANKS.length - 1];
    const p = getDynastyProgress(baseStats({ familyReputation: top.minScore + 5_000 }));

    expect(p.next).toBeUndefined();
    expect(p.progress).toBe(1);
  });
});

describe('the rank is REACHABLE from the app', () => {
  // The whole reason this work exists. A rank nobody can see is a badge in a
  // drawer - the third time this repo has shipped one.
  it('a screen renders it', () => {
    const source = fs.readFileSync(
      path.join(__dirname, '../../components/LegacyOverviewTab.tsx'),
      'utf8'
    );
    expect(source).toMatch(/getDynastyProgress/);
  });
});
