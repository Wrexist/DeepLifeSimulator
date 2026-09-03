/**
 * The goal catalogue.
 *
 * Every entry is derived from state the game already tracks. Nothing here is
 * stored, so a goal appears and disappears purely as a consequence of play —
 * there is no claim flag to double-spend and no field to migrate.
 *
 * Two rules hold for every entry, both asserted in `__tests__/goalCatalogue.test.ts`:
 *
 *  1. `isEligible` must be true for at least one state where `measure` is
 *     complete. This is the exact invariant the deleted `utils/goalSystem.ts`
 *     violated on all six of its goals — it gated visibility on the negation of
 *     completion, so the completed state was unreachable and the reward was
 *     dead code.
 *  2. `measure().target` is always > 0, so `current / target` can never divide
 *     by zero and produce a NaN progress bar.
 */
import type { GameState } from '@/contexts/game/types';
import { netWorth } from '@/lib/progress/achievements';
import { financialIndependence } from '@/lib/statistics/fireTracker';
import { weeksInThisLife } from '@/lib/progress/lifeChapters';
import { visibleContracts, getContractProgress } from '@/lib/legacy/contracts';
import { lifeQuality } from '@/lib/legacy/lifeQuality';
import { getNextCollectionTarget, getCompletedCollections } from '@/lib/luxury/collections';
import { EDUCATION_PROGRAMS } from '@/lib/education/programs';
import { isEntryTierCareer } from '@/lib/careers/jobMarket';
import { unlockTier } from '@/lib/progress/featureUnlocks';

import type { GoalDefinition } from './types';
import { playstyleEmphasis, investedValue, strongRelationshipCount } from './playstyle';

/** Liquid cash + bank. The "can I actually spend this" number, which is what a
 *  savings goal should measure — net worth counts illiquid property. */
const liquid = (s: GameState): number => (s.stats?.money ?? 0) + (s.bankSavings ?? 0);

const ownedProperties = (s: GameState): number =>
  (s.realEstate ?? []).filter((r) => r?.owned).length;

const money = (n: number): string =>
  n >= 1_000_000
    ? `$${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M`
    : n >= 1_000
      ? `$${Math.round(n / 1_000)}k`
      : `$${Math.round(n)}`;

const moneyPair = (current: number, target: number): string =>
  `${money(Math.max(0, current))} / ${money(target)}`;

const countPair = (current: number, target: number): string =>
  `${Math.max(0, Math.round(current))} / ${Math.round(target)}`;

/**
 * The savings ladder. One definition, six rungs - a player who banks $1k is
 * shown $5k next, not the same goal with a tick on it. `activeRung` picks the
 * lowest rung not yet reached, so the ladder can never recommend a target the
 * player is already past (the failure mode that makes a goal card feel stale).
 */
const SAVINGS_RUNGS = [1_000, 5_000, 25_000, 100_000, 500_000, 1_000_000];

/** The cheapest programme that costs money - the first rung off an entry ladder. */
const cheapestPaidProgrammeCost = (): number =>
  EDUCATION_PROGRAMS.reduce(
    (best, p) => (p.cost > 0 && p.cost < best ? p.cost : best),
    Number.POSITIVE_INFINITY,
  );

const activeSavingsRung = (s: GameState): number =>
  SAVINGS_RUNGS.find((r) => liquid(s) < r) ?? SAVINGS_RUNGS[SAVINGS_RUNGS.length - 1];

// $25M and $50M added 2026-08-25: the ladder used to jump 10M -> 100M, which
// is the exact band the economy audit found goes quiet (chapters end at $10M,
// Legacy Contracts resume at $100M). A dream you cannot see yourself
// approaching is not a dream - the same finding as tasks/lessons.md 2026-08-19.
const NET_WORTH_RUNGS = [100_000, 1_000_000, 10_000_000, 25_000_000, 50_000_000, 100_000_000];

const activeNetWorthRung = (s: GameState): number =>
  NET_WORTH_RUNGS.find((r) => netWorth(s) < r) ?? NET_WORTH_RUNGS[NET_WORTH_RUNGS.length - 1];

/**
 * The portfolio ladder for the investor lane, same shape as SAVINGS_RUNGS:
 * the lowest rung not yet reached, so the target always moves ahead of the
 * player rather than ticking off behind them.
 */
const PORTFOLIO_RUNGS = [10_000, 50_000, 250_000, 1_000_000];

const activePortfolioRung = (s: GameState): number =>
  PORTFOLIO_RUNGS.find((r) => investedValue(s) < r) ?? PORTFOLIO_RUNGS[PORTFOLIO_RUNGS.length - 1];

/**
 * Playstyle weighting (2026-08-25 retention pass). Every priority below used
 * to be a constant literal, so a founder, a landlord and a careerist saw
 * identical SOON/DREAM goals in identical order. `playstyleEmphasis` is 0..1
 * per lane and the coefficients are small (≤30), so it REORDERS within a
 * horizon and never buries anything: NOW priorities (arrears 200, health 120+)
 * are untouched and no goal's base priority is reduced.
 */
const emphasis = (s: GameState) => playstyleEmphasis(s);

export const GOAL_CATALOGUE: GoalDefinition[] = [
  // ── NOW - actionable inside one or two weeks ──────────────────────────────
  {
    id: 'now_get_hired',
    horizon: 'now',
    title: 'Get hired',
    rationale: 'A steady wage is what every other plan is funded by.',
    route: '/(tabs)/work',
    isEligible: (s) => !s.currentJob,
    // Measured in APPLICATIONS SENT, not in "do you have a job".
    //
    // The obvious measure - `currentJob ? 1 : 0` - is pinned at 0 across the
    // entire region where the goal is visible, because the goal stops being
    // eligible the instant it would read 1. That is the deleted goal system's
    // defect exactly: a bar that cannot move while you are looking at it.
    // Applications in flight is a number that actually rises as the player
    // works on this, and it reaches the target on the week they are accepted.
    measure: (s) => {
      const applied = (s.careers ?? []).filter((c) => c?.applied && !c?.accepted).length;
      return { current: Math.min(3, applied), target: 3 };
    },
    priority: () => 100,
    format: (c, t) =>
      c <= 0 ? 'No applications sent' : `${Math.round(c)} / ${Math.round(t)} applications out`,
    achievementLevel: (s) => (s.currentJob ? 1 : 0),
  },
  {
    id: 'now_bank_savings',
    horizon: 'now',
    title: 'Build a cash buffer',
    rationale: 'Cash on hand is what lets you say yes to an opportunity.',
    route: '/(tabs)/life?segment=shop',
    isEligible: (s) => liquid(s) < SAVINGS_RUNGS[SAVINGS_RUNGS.length - 1],
    measure: (s) => ({ current: liquid(s), target: activeSavingsRung(s) }),
    // Falls behind a job hunt but ahead of everything else early on.
    priority: (s) => (s.currentJob ? 80 : 40),
    format: moneyPair,
    // Rungs PASSED, so banking the first $1,000 registers even though the
    // goal stays on screen with a higher target.
    achievementLevel: (s) => SAVINGS_RUNGS.filter((r) => liquid(s) >= r).length,
  },
  {
    id: 'now_recover_health',
    horizon: 'now',
    title: 'Get your health back up',
    rationale: 'Low health drags every stat and shortens the life you are building.',
    route: '/(tabs)/life?segment=health',
    isEligible: (s) => (s.stats?.health ?? 100) < 60,
    measure: (s) => ({ current: s.stats?.health ?? 0, target: 60 }),
    // Outranks money: a life that ends early banks nothing.
    priority: (s) => 120 + Math.max(0, 60 - (s.stats?.health ?? 60)),
    format: (c, t) => `${Math.round(c)} / ${Math.round(t)} health`,
    achievementLevel: (s) => ((s.stats?.health ?? 0) >= 60 ? 1 : 0),
  },
  {
    id: 'now_lift_happiness',
    horizon: 'now',
    title: 'Do something you enjoy',
    rationale: 'Unhappy weeks compound - the longer it sits low, the more it costs.',
    route: '/(tabs)/life',
    isEligible: (s) => (s.stats?.happiness ?? 100) < 45,
    measure: (s) => ({ current: s.stats?.happiness ?? 0, target: 45 }),
    priority: (s) => 90 + Math.max(0, 45 - (s.stats?.happiness ?? 45)),
    format: (c, t) => `${Math.round(c)} / ${Math.round(t)} happiness`,
    achievementLevel: (s) => ((s.stats?.happiness ?? 0) >= 45 ? 1 : 0),
  },
  {
    id: 'now_clear_arrears',
    horizon: 'now',
    title: 'Clear your overdue bills',
    rationale: 'Arrears keep growing until they are paid - this is the one debt that never waits.',
    route: '/(tabs)/life?segment=shop',
    isEligible: (s) => (s.overdueBalance ?? 0) > 0,
    // Measured as "how much of the arrears you can already cover", so the bar
    // fills as cash accumulates rather than sitting at zero until the moment it
    // is paid off and the goal vanishes.
    measure: (s) => ({
      current: Math.min(liquid(s), s.overdueBalance ?? 0),
      target: Math.max(1, s.overdueBalance ?? 0),
    }),
    // The highest priority in the catalogue. Arrears are the money axis's only
    // real failure state (v31) and every other goal is worse while they run.
    priority: () => 200,
    format: moneyPair,
    achievementLevel: (s) => ((s.overdueBalance ?? 0) <= 0 ? 1 : 0),
  },

  // ── SOON - a handful of weeks of deliberate play ──────────────────────────
  {
    id: 'soon_promotion',
    horizon: 'soon',
    title: 'Earn your next promotion',
    rationale: 'Each rung raises the salary that funds everything else.',
    route: '/(tabs)/work',
    isEligible: (s) => {
      const c = (s.careers ?? []).find((x) => x?.id === s.currentJob);
      return !!c && c.level < (c.levels?.length ?? 1) - 1;
    },
    measure: (s) => {
      const c = (s.careers ?? []).find((x) => x?.id === s.currentJob);
      return { current: Math.max(0, Math.min(100, c?.progress ?? 0)), target: 100 };
    },
    priority: (s) => 90 + 15 * emphasis(s).career,
    format: (c, t) => `${Math.round(c)}% / ${Math.round(t)}%`,
    achievementLevel: (s) => {
      const c = (s.careers ?? []).find((x) => x?.id === s.currentJob);
      return c ? c.level : 0;
    },
  },
  {
    id: 'soon_get_qualified',
    horizon: 'soon',
    title: 'Get qualified',
    rationale: 'Every entry ladder tops out around $200/wk; a certificate opens ladders that pay four times that.',
    route: '/(tabs)/apps',
    // Master Program 10 (2026-09-03): the measured entry-tier life. A janitor
    // reaches the ceiling ($200/wk) by week ~80 and then banks ~$120/wk with
    // nothing on the home feed pointing anywhere: $17k at week 100, $52k at
    // week 250, tier 3, no rung in sight. The cheapest certificate ($12k) was
    // affordable from week ~20 - the chapter bundles and windfalls pay for it -
    // but the Education app only ever recommended FINISHING a degree, never
    // starting one. This is the missing SOON goal: eligible once the app is
    // open (tier 2), for a player on an entry ladder with no qualification
    // started or earned, measured against the cheapest paid programme so the
    // bar moves with every week of saving.
    isEligible: (s) =>
      unlockTier(s) >= 2 &&
      !!s.currentJob &&
      isEntryTierCareer(s.currentJob) &&
      !(s.educations ?? []).some(
        (e) => e && (e.completed || (e.weeksRemaining ?? 0) > 0),
      ),
    measure: (s) => ({ current: liquid(s), target: cheapestPaidProgrammeCost() }),
    priority: (s) => 70 + 15 * emphasis(s).career,
    format: moneyPair,
    achievementLevel: (s) => (s.educations ?? []).filter((e) => e?.completed).length,
  },
  {
    id: 'soon_finish_studies',
    horizon: 'soon',
    title: 'Finish your degree',
    rationale: 'Qualifications unlock the careers that are closed to you now.',
    route: '/(tabs)/life',
    isEligible: (s) =>
      (s.educations ?? []).some((e) => e && !e.completed && (e.weeksRemaining ?? 0) > 0),
    measure: (s) => {
      const e = (s.educations ?? []).find(
        (x) => x && !x.completed && (x.weeksRemaining ?? 0) > 0,
      );
      const total = Math.max(1, e?.duration ?? 1);
      const remaining = Math.max(0, e?.weeksRemaining ?? 0);
      return { current: Math.max(0, total - remaining), target: total };
    },
    priority: () => 95,
    format: (c, t) => `${Math.round(t - c)} weeks left`,
    achievementLevel: (s) => (s.educations ?? []).filter((e) => e?.completed).length,
  },
  {
    id: 'soon_first_property',
    horizon: 'soon',
    title: 'Buy your first property',
    rationale: 'Owning beats renting - it appreciates instead of vanishing.',
    route: '/(tabs)/life?segment=shop',
    isEligible: (s) => ownedProperties(s) === 0,
    // Progress against the cheapest listing, so the bar means "how close is the
    // down payment" rather than an abstract wealth number.
    measure: (s) => {
      const cheapest = (s.realEstate ?? [])
        .filter((r) => r && !r.owned && (r.price ?? 0) > 0)
        .reduce((min, r) => Math.min(min, r.price), Number.POSITIVE_INFINITY);
      const target = Number.isFinite(cheapest) ? cheapest : 50_000;
      return { current: liquid(s), target };
    },
    priority: () => 70,
    format: moneyPair,
    achievementLevel: (s) => ownedProperties(s),
  },
  {
    id: 'soon_start_business',
    horizon: 'soon',
    title: 'Start a business',
    rationale: 'A company earns while you are doing something else.',
    route: '/(tabs)/work',
    isEligible: (s) => (s.companies ?? []).length === 0 && liquid(s) >= 5_000,
    measure: (s) => ({ current: liquid(s), target: 25_000 }),
    priority: () => 60,
    // No business emphasis term here on purpose: eligibility requires ZERO
    // companies, so the signal that would boost it cannot exist yet.
    format: moneyPair,
    achievementLevel: (s) => (s.companies ?? []).length,
  },
  {
    id: 'soon_find_partner',
    horizon: 'soon',
    title: 'Find someone',
    rationale: 'A partner changes the shape of the life, not just the numbers.',
    route: '/(tabs)/apps',
    isEligible: (s) => !s.family?.spouse && weeksInThisLife(s) >= 8,
    // Measured on the CLOSEST relationship, for the same reason the job hunt is
    // measured in applications: "are you married" is pinned at 0 for the whole
    // eligible region, while a relationship score climbs as the player invests.
    measure: (s) => {
      const best = (s.relationships ?? [])
        .filter((r) => r && (r.type === 'partner' || r.type === 'friend'))
        .reduce((max, r) => Math.max(max, r.relationshipScore ?? 0), 0);
      return { current: Math.max(0, Math.min(100, best)), target: 100 };
    },
    priority: (s) => 50 + 25 * emphasis(s).social,
    format: (c) =>
      c <= 0 ? 'Nobody special yet' : `Closest relationship at ${Math.round(c)}%`,
    achievementLevel: (s) => (s.family?.spouse ? 1 : 0),
  },

  // ── DREAM - the thing the whole life is pointed at ────────────────────────
  {
    id: 'dream_net_worth',
    horizon: 'dream',
    title: 'Reach a fortune',
    rationale: 'The number that decides how the story is remembered.',
    route: '/(tabs)/life?segment=stats',
    isEligible: (s) => netWorth(s) < NET_WORTH_RUNGS[NET_WORTH_RUNGS.length - 1],
    measure: (s) => ({ current: netWorth(s), target: activeNetWorthRung(s) }),
    priority: () => 60,
    format: moneyPair,
    achievementLevel: (s) => NET_WORTH_RUNGS.filter((r) => netWorth(s) >= r).length,
  },
  {
    id: 'dream_property_empire',
    horizon: 'dream',
    title: 'Build a property portfolio',
    rationale: 'Five doors is the point where rent stops being pocket money.',
    route: '/(tabs)/life?segment=shop',
    isEligible: (s) => ownedProperties(s) >= 1 && ownedProperties(s) < 5,
    measure: (s) => ({ current: ownedProperties(s), target: 5 }),
    priority: (s) => 70 + 15 * emphasis(s).investor,
    format: countPair,
    achievementLevel: (s) => ownedProperties(s),
  },
  {
    id: 'dream_dynasty',
    horizon: 'dream',
    title: 'Leave a dynasty',
    rationale: 'Prestige carries your legacy into the next life instead of ending it.',
    route: '/(tabs)/life?segment=stats',
    // Only once the player is genuinely in range - offering prestige to a
    // week-3 character is noise, and the repo already holds the preview card
    // back on the same principle.
    isEligible: (s) => netWorth(s) >= 1_000_000,
    measure: (s) => ({ current: netWorth(s), target: 100_000_000 }),
    priority: () => 80,
    format: moneyPair,
    achievementLevel: (s) => s.prestige?.prestigeLevel ?? 0,
  },
  {
    id: 'dream_financial_independence',
    horizon: 'dream',
    title: 'Make the money work for you',
    rationale: 'When your assets out-earn your bills, working becomes a choice.',
    route: '/(tabs)/apps',
    // Only once there is something to measure - offering "live off your assets"
    // to a character with no assets is noise, the dream_dynasty rule.
    isEligible: (s) => {
      const fi = financialIndependence(s);
      return fi.passiveWeekly > 0 && !fi.achieved;
    },
    measure: (s) => {
      const fi = financialIndependence(s);
      return { current: fi.passiveWeekly, target: fi.expensesWeekly };
    },
    priority: (s) => 75 + 15 * emphasis(s).investor,
    format: moneyPair,
    achievementLevel: (s) => (financialIndependence(s).achieved ? 1 : 0),
  },
  {
    id: 'dream_family',
    horizon: 'dream',
    title: 'Raise a family',
    rationale: 'Children inherit your traits - and eventually your fortune.',
    route: '/(tabs)/life',
    isEligible: (s) => (s.family?.children ?? []).length < 2,
    measure: (s) => ({ current: (s.family?.children ?? []).length, target: 2 }),
    priority: (s) => (s.family?.spouse ? 65 : 30) + 15 * emphasis(s).social,
    format: countPair,
    achievementLevel: (s) => (s.family?.children ?? []).length,
  },

  // ── DREAM depth (2026-08-24). The audit's finding: NOW/SOON were well fed
  // while DREAM had four definitions and collapsed late-game onto contracts
  // "surfaced nowhere in the app". These three widen it - and one of them is
  // deliberately not about money at all. ──────────────────────────────────
  {
    id: 'dream_business_empire',
    horizon: 'dream',
    title: 'Build a business empire',
    rationale: 'One company is a job you own. Five is an empire.',
    route: '/(tabs)/apps',
    isEligible: (s) => (s.companies ?? []).length >= 1 && (s.companies ?? []).length < 5,
    measure: (s) => ({ current: (s.companies ?? []).length, target: 5 }),
    priority: (s) => 68 + 20 * emphasis(s).business,
    format: countPair,
    achievementLevel: (s) => (s.companies ?? []).length,
  },
  {
    id: 'dream_legacy_contracts',
    horizon: 'dream',
    title: 'Fulfil the Legacy Contracts',
    rationale: 'Goals that span lives - the longest game the dynasty plays.',
    route: '/(tabs)/life?segment=stats',
    // Only once the multi-life game has begun; offering contracts to a first
    // life that has never prestiged is noise.
    isEligible: (s) => {
      if ((s.prestige?.totalPrestiges ?? 0) < 1) return false;
      const contracts = visibleContracts(s);
      return (s.legacyContracts?.claimedIds ?? []).length < contracts.length;
    },
    measure: (s) => ({
      current: (s.legacyContracts?.claimedIds ?? []).length,
      target: Math.max(1, visibleContracts(s).length),
    }),
    priority: () => 75,
    format: countPair,
    achievementLevel: (s) =>
      visibleContracts(s).filter((c) => getContractProgress(s, c).complete).length,
  },
  {
    id: 'dream_life_quality',
    horizon: 'dream',
    title: 'A life well lived',
    rationale: 'The score the obituary keeps - wealth is only a fifth of it.',
    route: '/(tabs)/life',
    // From the second year on: the score needs some life behind it to mean
    // anything, and it is the one DREAM that no pile of money can buy alone.
    isEligible: (s) => weeksInThisLife(s) >= 52 && lifeQuality(s).score < 80,
    measure: (s) => ({ current: lifeQuality(s).score, target: 80 }),
    priority: () => 55,
    format: (c, t) => `${Math.round(c)} / ${t} life quality`,
    achievementLevel: (s) => Math.floor(lifeQuality(s).score / 20),
  },

  // ── Playstyle lanes (2026-08-25 retention pass). Three goals so the
  // investor, the social player and the collector each have a lane that speaks
  // their language — before this, SOON offered them a promotion, a property
  // and a business regardless of how they actually played. Each reuses a
  // derived "next target" the codebase already computed with no goal-engine
  // consumer (the audit's finding on `getNextCollectionTarget`). ─────────────
  {
    id: 'soon_grow_portfolio',
    horizon: 'soon',
    title: 'Grow your portfolio',
    rationale: 'Markets compound while a salary only repeats.',
    route: '/(tabs)/apps',
    // Only once the player has CHOSEN to invest — offering a portfolio ladder
    // to someone with no holdings is the dream_dynasty noise rule.
    isEligible: (s) =>
      investedValue(s) > 0 && investedValue(s) < PORTFOLIO_RUNGS[PORTFOLIO_RUNGS.length - 1],
    measure: (s) => ({ current: investedValue(s), target: activePortfolioRung(s) }),
    priority: (s) => 60 + 30 * emphasis(s).investor,
    format: moneyPair,
    achievementLevel: (s) => PORTFOLIO_RUNGS.filter((r) => investedValue(s) >= r).length,
  },
  {
    id: 'soon_deepen_friendships',
    horizon: 'soon',
    title: 'Deepen your friendships',
    rationale: 'Three real friendships carry a life further than thirty contacts.',
    route: '/(tabs)/life',
    isEligible: (s) =>
      weeksInThisLife(s) >= 8 &&
      (s.relationships ?? []).length >= 1 &&
      strongRelationshipCount(s) < 3,
    measure: (s) => ({ current: strongRelationshipCount(s), target: 3 }),
    priority: (s) => 45 + 30 * emphasis(s).social,
    format: (c, t) => `${Math.round(c)} / ${Math.round(t)} close bonds`,
    achievementLevel: (s) => strongRelationshipCount(s),
  },
  {
    id: 'dream_luxury_collection',
    horizon: 'dream',
    title: 'Complete a collection',
    rationale: 'A finished set is a statement no single purchase makes.',
    route: '/(tabs)/apps',
    // Only for a player who has started collecting; the first luxury purchase
    // is its own decision, not a goal we assign.
    isEligible: (s) =>
      (s.luxuryItems ?? []).length >= 1 && getNextCollectionTarget(s.luxuryItems) !== undefined,
    measure: (s) => {
      const next = getNextCollectionTarget(s.luxuryItems);
      return { current: next?.owned ?? 0, target: Math.max(1, next?.total ?? 1) };
    },
    priority: (s) => 50 + 4 * Math.min(5, (s.luxuryItems ?? []).length),
    format: countPair,
    achievementLevel: (s) => getCompletedCollections(s.luxuryItems).length,
  },
];
