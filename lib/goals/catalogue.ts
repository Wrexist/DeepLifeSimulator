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
import { weeksInThisLife } from '@/lib/progress/lifeChapters';

import type { GoalDefinition } from './types';

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
 * The savings ladder. One definition, six rungs — a player who banks $1k is
 * shown $5k next, not the same goal with a tick on it. `activeRung` picks the
 * lowest rung not yet reached, so the ladder can never recommend a target the
 * player is already past (the failure mode that makes a goal card feel stale).
 */
const SAVINGS_RUNGS = [1_000, 5_000, 25_000, 100_000, 500_000, 1_000_000];

const activeSavingsRung = (s: GameState): number =>
  SAVINGS_RUNGS.find((r) => liquid(s) < r) ?? SAVINGS_RUNGS[SAVINGS_RUNGS.length - 1];

const NET_WORTH_RUNGS = [100_000, 1_000_000, 10_000_000, 100_000_000];

const activeNetWorthRung = (s: GameState): number =>
  NET_WORTH_RUNGS.find((r) => netWorth(s) < r) ?? NET_WORTH_RUNGS[NET_WORTH_RUNGS.length - 1];

export const GOAL_CATALOGUE: GoalDefinition[] = [
  // ── NOW — actionable inside one or two weeks ──────────────────────────────
  {
    id: 'now_get_hired',
    horizon: 'now',
    title: 'Get hired',
    rationale: 'A steady wage is what every other plan is funded by.',
    route: '/(tabs)/work',
    isEligible: (s) => !s.currentJob,
    // Measured in APPLICATIONS SENT, not in "do you have a job".
    //
    // The obvious measure — `currentJob ? 1 : 0` — is pinned at 0 across the
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
  },
  {
    id: 'now_bank_savings',
    horizon: 'now',
    title: 'Build a cash buffer',
    rationale: 'Cash on hand is what lets you say yes to an opportunity.',
    route: '/(tabs)/market',
    isEligible: (s) => liquid(s) < SAVINGS_RUNGS[SAVINGS_RUNGS.length - 1],
    measure: (s) => ({ current: liquid(s), target: activeSavingsRung(s) }),
    // Falls behind a job hunt but ahead of everything else early on.
    priority: (s) => (s.currentJob ? 80 : 40),
    format: moneyPair,
  },
  {
    id: 'now_recover_health',
    horizon: 'now',
    title: 'Get your health back up',
    rationale: 'Low health drags every stat and shortens the life you are building.',
    route: '/(tabs)/health',
    isEligible: (s) => (s.stats?.health ?? 100) < 60,
    measure: (s) => ({ current: s.stats?.health ?? 0, target: 60 }),
    // Outranks money: a life that ends early banks nothing.
    priority: (s) => 120 + Math.max(0, 60 - (s.stats?.health ?? 60)),
    format: (c, t) => `${Math.round(c)} / ${Math.round(t)} health`,
  },
  {
    id: 'now_lift_happiness',
    horizon: 'now',
    title: 'Do something you enjoy',
    rationale: 'Unhappy weeks compound — the longer it sits low, the more it costs.',
    route: '/(tabs)/life',
    isEligible: (s) => (s.stats?.happiness ?? 100) < 45,
    measure: (s) => ({ current: s.stats?.happiness ?? 0, target: 45 }),
    priority: (s) => 90 + Math.max(0, 45 - (s.stats?.happiness ?? 45)),
    format: (c, t) => `${Math.round(c)} / ${Math.round(t)} happiness`,
  },
  {
    id: 'now_clear_arrears',
    horizon: 'now',
    title: 'Clear your overdue bills',
    rationale: 'Arrears keep growing until they are paid — this is the one debt that never waits.',
    route: '/(tabs)/market',
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
  },

  // ── SOON — a handful of weeks of deliberate play ──────────────────────────
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
    priority: () => 90,
    format: (c, t) => `${Math.round(c)}% / ${Math.round(t)}%`,
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
  },
  {
    id: 'soon_first_property',
    horizon: 'soon',
    title: 'Buy your first property',
    rationale: 'Owning beats renting — it appreciates instead of vanishing.',
    route: '/(tabs)/market',
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
    format: moneyPair,
  },
  {
    id: 'soon_find_partner',
    horizon: 'soon',
    title: 'Find someone',
    rationale: 'A partner changes the shape of the life, not just the numbers.',
    route: '/(tabs)/mobile',
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
    priority: () => 50,
    format: (c) =>
      c <= 0 ? 'Nobody special yet' : `Closest relationship at ${Math.round(c)}%`,
  },

  // ── DREAM — the thing the whole life is pointed at ────────────────────────
  {
    id: 'dream_net_worth',
    horizon: 'dream',
    title: 'Reach a fortune',
    rationale: 'The number that decides how the story is remembered.',
    route: '/(tabs)/progression',
    isEligible: (s) => netWorth(s) < NET_WORTH_RUNGS[NET_WORTH_RUNGS.length - 1],
    measure: (s) => ({ current: netWorth(s), target: activeNetWorthRung(s) }),
    priority: () => 60,
    format: moneyPair,
  },
  {
    id: 'dream_property_empire',
    horizon: 'dream',
    title: 'Build a property portfolio',
    rationale: 'Five doors is the point where rent stops being pocket money.',
    route: '/(tabs)/market',
    isEligible: (s) => ownedProperties(s) >= 1 && ownedProperties(s) < 5,
    measure: (s) => ({ current: ownedProperties(s), target: 5 }),
    priority: () => 70,
    format: countPair,
  },
  {
    id: 'dream_dynasty',
    horizon: 'dream',
    title: 'Leave a dynasty',
    rationale: 'Prestige carries your legacy into the next life instead of ending it.',
    route: '/(tabs)/progression',
    // Only once the player is genuinely in range — offering prestige to a
    // week-3 character is noise, and the repo already holds the preview card
    // back on the same principle.
    isEligible: (s) => netWorth(s) >= 1_000_000,
    measure: (s) => ({ current: netWorth(s), target: 100_000_000 }),
    priority: () => 80,
    format: moneyPair,
  },
  {
    id: 'dream_family',
    horizon: 'dream',
    title: 'Raise a family',
    rationale: 'Children inherit your traits — and eventually your fortune.',
    route: '/(tabs)/life',
    isEligible: (s) => (s.family?.children ?? []).length < 2,
    measure: (s) => ({ current: (s.family?.children ?? []).length, target: 2 }),
    priority: (s) => (s.family?.spouse ? 65 : 30),
    format: countPair,
  },
];
