/**
 * How good a life was, as one number the player can argue with.
 *
 * ## Why this is not decoration
 *
 * The death screen shows this as a percentage next to a face. A number that
 * large and that final is one the player WILL check against the life they just
 * lived — "28%? I owned two houses" — so it has to be built from things that
 * actually happened, and it has to be explainable when they ask.
 *
 * That rules out the easy version. A gauge driven by `happiness` at the moment
 * of death would read 4% for a rich, accomplished character who died of old age
 * with their stats decayed, and 90% for someone who did nothing but sleep. The
 * final tick is the worst single sample of a whole life.
 *
 * ## The shape
 *
 * Seven weighted bands, each a 0..1 fraction of a target that a real,
 * unremarkable life falls short of and a good one clears. They read the SAME
 * signals `classifyLife` uses for ribbons, deliberately — two systems judging
 * one life by different evidence would produce a "LEGENDARY" ribbon over a 30%
 * gauge, and the player would be right to call that broken.
 *
 * Weights sum to 100. Wealth is capped hard and deliberately under-weighted
 * relative to its spread: money is the axis with the widest range and the most
 * direct purchase path, and a life-quality score that money alone can max is a
 * score that says the game is about money. It is worth a fifth.
 *
 * Deterministic and pure — same state in, same number out, no clock, no random.
 */

import type { GameState } from '@/contexts/game/types';
import { WEEKS_PER_YEAR } from '@/lib/config/gameConstants';

export interface LifeQualityBand {
  /** Stable id, for tests and for anything that wants to explain the score. */
  id: string;
  /** What the player would call this. */
  label: string;
  /** 0..1 — how much of this band was earned. */
  earned: number;
  /** Points this band contributes at `earned === 1`. */
  weight: number;
}

export interface LifeQuality {
  /** 0..100, rounded. What the gauge shows. */
  score: number;
  /** The verdict word under the arc. */
  verdict: string;
  /** Which face to draw: the score, bucketed. */
  mood: 'bleak' | 'poor' | 'fair' | 'good' | 'great';
  /** Every band with what it earned — the receipt, if anything wants to show it. */
  bands: LifeQualityBand[];
}

/** Clamp a raw value against a target into 0..1. */
function toward(value: number, target: number): number {
  if (!Number.isFinite(value) || !Number.isFinite(target) || target <= 0) return 0;
  return Math.max(0, Math.min(1, value / target));
}

function netWorth(s: GameState): number {
  const cash = s.stats?.money ?? 0;
  const bank = s.bankSavings ?? 0;
  const holdings = Array.isArray(s.stocks) ? s.stocks : (s.stocks?.holdings ?? []);
  const stocks = Array.isArray(holdings)
    ? holdings.reduce(
        (sum: number, st: { shares?: number; currentPrice?: number }) =>
          sum + (st?.shares ?? 0) * (st?.currentPrice ?? 0),
        0
      )
    : 0;
  // Matches `ribbonSystem.getNetWorth`: skip sold entries, use the live value.
  // `value` is not a field on RealEstate and reading it scored every property
  // at zero — the same mistake is easy to re-make here, so it is stated.
  const property = Array.isArray(s.realEstate)
    ? s.realEstate.reduce(
        (sum: number, r: { owned?: boolean; currentValue?: number; price?: number }) =>
          r?.owned === false ? sum : sum + (r?.currentValue ?? r?.price ?? 0),
        0
      )
    : 0;
  return cash + bank + stocks + property;
}

/**
 * Targets a good life clears and an unremarkable one does not.
 *
 * Exported so the tests assert against the same numbers the score uses rather
 * than against magic constants copied into the test file, which is how a
 * rebalance passes its own suite while changing every player's result.
 */
export const LIFE_QUALITY_TARGETS = {
  netWorth: 2_000_000,
  achievements: 25,
  relationships: 8,
  children: 3,
  careerLevel: 6,
  yearsLived: 60,
  /** Health + happiness + fitness, each out of 100. */
  vitalsTotal: 240,
} as const;

const VERDICTS: { min: number; verdict: string; mood: LifeQuality['mood'] }[] = [
  { min: 85, verdict: 'Extraordinary', mood: 'great' },
  { min: 65, verdict: 'Well lived', mood: 'good' },
  { min: 45, verdict: 'Respectable', mood: 'fair' },
  { min: 25, verdict: 'Unremarkable', mood: 'poor' },
  { min: 0, verdict: 'Squandered', mood: 'bleak' },
];

export function lifeQuality(state: GameState | null | undefined): LifeQuality {
  const s = (state ?? {}) as GameState;
  const T = LIFE_QUALITY_TARGETS;

  const achievements = Array.isArray(s.claimedProgressAchievements)
    ? s.claimedProgressAchievements.length
    : 0;
  const relationships = Array.isArray(s.relationships) ? s.relationships.length : 0;
  const children = Array.isArray(s.family?.children) ? s.family!.children.length : 0;
  const married = Boolean(s.family?.spouse);

  const careers = Array.isArray(s.careers) ? s.careers : [];
  // The highest rung reached in any career, not the current one: a player who
  // retired from a directorship should not score as unemployed because they
  // spent their last year fishing.
  const careerPeak = careers.reduce(
    (best, c) => (c?.accepted ? Math.max(best, (c.level ?? 0) + 1) : best),
    0
  );

  const completedEducation = (Array.isArray(s.educations) ? s.educations : []).filter(
    (e) => e?.completed
  ).length;

  const vitals =
    Math.max(0, s.stats?.health ?? 0) +
    Math.max(0, s.stats?.happiness ?? 0) +
    Math.max(0, s.stats?.fitness ?? 0);

  const years = Math.max(0, (s.weeksLived ?? 0) / WEEKS_PER_YEAR);

  const bands: LifeQualityBand[] = [
    {
      id: 'achievements',
      label: 'Achievements',
      earned: toward(achievements, T.achievements),
      weight: 22,
    },
    {
      id: 'wealth',
      label: 'Wealth',
      earned: toward(netWorth(s), T.netWorth),
      weight: 20,
    },
    {
      id: 'family',
      label: 'Family',
      // Marriage is worth as much as the first child, so a childless couple is
      // not scored as having no family at all.
      earned: Math.min(1, (married ? 0.4 : 0) + 0.6 * toward(children, T.children)),
      weight: 16,
    },
    {
      id: 'career',
      label: 'Career',
      earned: toward(careerPeak, T.careerLevel),
      weight: 14,
    },
    {
      id: 'people',
      label: 'Relationships',
      earned: toward(relationships, T.relationships),
      weight: 10,
    },
    {
      id: 'longevity',
      label: 'Years lived',
      earned: toward(years, T.yearsLived),
      weight: 10,
    },
    {
      id: 'condition',
      label: 'Health and spirit',
      // The only band the final tick feeds, and it is worth 8 of 100 for
      // exactly that reason — dying old with worn-out stats is what dying old
      // looks like, not a verdict on the life.
      earned: toward(vitals + completedEducation * 10, T.vitalsTotal),
      weight: 8,
    },
  ];

  const raw = bands.reduce((sum, b) => sum + b.earned * b.weight, 0);
  const score = Math.max(0, Math.min(100, Math.round(raw)));
  const band = VERDICTS.find((v) => score >= v.min) ?? VERDICTS[VERDICTS.length - 1];

  return { score, verdict: band.verdict, mood: band.mood, bands };
}
