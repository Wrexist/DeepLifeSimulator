/**
 * The first-session surfaces measure weeks into THIS LIFE.
 *
 * `weeksLived` is ABSOLUTE and seeded from the starting age
 * (`computeWeeksLived` = `(age - 18) * 52`), so an age-25 character begins at
 * 364 and the age-40 scenario at 1,144. Every "has this player been here N
 * weeks yet" check written against the raw counter therefore resolves wrong for
 * seven of the eight shipped scenario ages — and it resolves wrong in BOTH
 * directions, which is why it keeps getting missed:
 *
 *   - a `>=` / `>` gate ("settled in enough for X") is pre-passed at birth, so
 *     the affordance appears immediately — banner ads in the first session, the
 *     no-job nudge on week one, the store-review sheet before any play;
 *   - a `<=` / `<` gate ("still brand new, show the tutorial") is pre-FAILED, so
 *     the affordance never appears at all — the welcome tutorial, the First Week
 *     Guide and the find-a-job CTA were dead for those scenarios.
 *
 * This is the fourth wave of the class (CLAUDE.md §4.2). The tests below cover
 * the behaviour; the source guard at the end is what stops a fifth.
 */
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import fs from 'fs';
import path from 'path';
import { weeksSinceLifeStart } from '@/utils/weekCounters';
import { weeksInThisLife } from '@/lib/progress/lifeChapters';
import { useContextualTip } from '@/components/ContextualTip';
import { createTestGameState } from '../helpers/createTestGameState';
import type { GameState } from '@/contexts/game/types';

const repoRoot = path.resolve(__dirname, '../..');
const read = (rel: string) => fs.readFileSync(path.join(repoRoot, rel), 'utf8');

describe('weeksSinceLifeStart - the primitive', () => {
  it('subtracts the baseline', () => {
    expect(weeksSinceLifeStart(364, 364)).toBe(0);
    expect(weeksSinceLifeStart(368, 364)).toBe(4);
    expect(weeksSinceLifeStart(1144, 1144)).toBe(0);
  });

  it('an age-18 life is unchanged - the baseline is 0', () => {
    expect(weeksSinceLifeStart(0, 0)).toBe(0);
    expect(weeksSinceLifeStart(7, 0)).toBe(7);
  });

  it('a pre-v43 save with no baseline keeps the behaviour it has today', () => {
    // The v43 carve-out: those saves cannot grow a `lifeStartWeek`, so falling
    // back to the absolute counter is the only answer that takes nothing away.
    expect(weeksSinceLifeStart(300, undefined)).toBe(300);
    expect(weeksSinceLifeStart(300, null)).toBe(300);
    expect(weeksSinceLifeStart(300, NaN)).toBe(300);
    expect(weeksSinceLifeStart(300, -5)).toBe(300);
  });

  it('never goes negative, and degrades a corrupt counter to 0', () => {
    // A baseline ahead of the counter is nonsense (a rewound save); 0 is the
    // safe answer — "brand new" — not a negative that would invert every gate.
    expect(weeksSinceLifeStart(10, 999)).toBe(0);
    expect(weeksSinceLifeStart(undefined, 0)).toBe(0);
    expect(weeksSinceLifeStart(NaN, 0)).toBe(0);
    expect(weeksSinceLifeStart(-3, 0)).toBe(0);
  });

  it('is exactly what `weeksInThisLife` computes from a state', () => {
    const state = createTestGameState({ weeksLived: 370, lifeStartWeek: 364 });
    expect(weeksInThisLife(state)).toBe(weeksSinceLifeStart(370, 364));
  });
});

describe('the no-job nudge waits for the player to actually be jobless a while', () => {
  const tipFor = (state: GameState): string | null => {
    let tip: string | null = null;
    function Harness() {
      ({ activeTip: tip } = useContextualTip(state) as { activeTip: string | null });
      return null;
    }
    act(() => {
      TestRenderer.create(<Harness />);
    });
    return tip;
  };

  /** Healthy on every other axis, so only the no-job condition can fire. */
  const jobless = (age: number, weeksPlayed: number): GameState => {
    const start = (age - 18) * 52;
    const base = createTestGameState();
    return createTestGameState({
      weeksLived: start + weeksPlayed,
      lifeStartWeek: start,
      currentJob: undefined,
      stats: { ...base.stats, health: 90, happiness: 90, energy: 90, money: 5_000 },
    });
  };

  it('never fires a no-job tip - FirstSessionCoach owns that message now', () => {
    // The 'no_job' tip was retired in the UI overhaul (phase 1): the coach
    // already teaches "get a job" from live game state, and three surfaces
    // repeating it on one screen was the audit's duplication finding. A
    // jobless-but-otherwise-healthy player must get NO contextual tip,
    // however long they have been jobless and whatever age they started at.
    expect(tipFor(jobless(25, 0))).toBeNull();
    expect(tipFor(jobless(25, 3))).toBeNull();
    expect(tipFor(jobless(18, 3))).toBeNull();
    expect(tipFor(jobless(25, 50))).toBeNull();
  });
});

/**
 * A source guard, not a style rule.
 *
 * Each of these files gates a first-session affordance on elapsed weeks. The
 * bug is not "the identifier `weeksLived` appears" — these files legitimately
 * read it for timestamps and deltas — it is a THRESHOLD comparison against a
 * literal, which is always asking a progress question. Re-introducing one is
 * the regression; the helpers make it a one-word fix.
 */
describe('the first-session gates do not compare the absolute counter to a literal', () => {
  const GATED_FILES = [
    'app/(tabs)/home.tsx',
    'components/ContextualTip.tsx',
    'components/BannerAd.tsx',
    'components/AchievementsProgress.tsx',
    'lib/analytics/AnalyticsTracker.tsx',
    'lib/progress/featureUnlocks.ts',
  ];

  // `weeksLived` (however it is unwrapped) compared to a numeric literal.
  const RAW_THRESHOLD =
    /weeksLived\b[^\n]{0,30}?(?:\|\|\s*0\s*\)|\?\?\s*0\s*\))?\s*(?:>=|<=|>|<)\s*\d/;

  it.each(GATED_FILES)('%s', (rel) => {
    const offenders = read(rel)
      .split('\n')
      .map((line, i) => ({ line, n: i + 1 }))
      // Prose explaining the trap quotes the broken form on purpose.
      .filter(({ line }) => !/^\s*(\/\/|\*|\/\*)/.test(line))
      // A comparison whose left side already went through the helper is the FIX,
      // not the bug.
      .filter(({ line }) => !line.includes('weeksSinceLifeStart('))
      .filter(({ line }) => RAW_THRESHOLD.test(line))
      .map(({ line, n }) => `${rel}:${n} ${line.trim()}`);

    expect(offenders).toEqual([]);
  });

  it('the guard would actually catch the bug (the control)', () => {
    expect(RAW_THRESHOLD.test('if (prestiged || weeksLived >= 120) return 5;')).toBe(true);
    expect(RAW_THRESHOLD.test('const isBrandNew = (gameState.weeksLived || 0) <= 5;')).toBe(true);
    expect(RAW_THRESHOLD.test('if ((s.weeksLived ?? 0) < 1) return null;')).toBe(true);
    // Deltas between two absolute stamps are correct and must stay allowed.
    expect(RAW_THRESHOLD.test('return weeksLived - dismissedAt < TIP_REDISPLAY_WEEKS;')).toBe(false);
    expect(RAW_THRESHOLD.test('const weeksThisLife = weeksInThisLife(gameState);')).toBe(false);
    expect(RAW_THRESHOLD.test('const weeksThisLife = num(weeksInThisLife(state));')).toBe(false);
  });
});
