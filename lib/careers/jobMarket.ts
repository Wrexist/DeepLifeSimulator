/**
 * Entry-level job market — the shape of the early career choice.
 *
 * THE PROBLEM THIS FIXES
 * ----------------------
 * Eight careers ship with `requirements: {}`, so at week 0 the player is handed
 * all eight at once and every one of them is takeable. They are presented
 * identically — a title, a description, and a weekly salary — so the only axis
 * the player can compare on is pay. That makes the "choice" arithmetic:
 *
 *     musician $25 · farmer $35 · chef $40 · fast food $50 · janitor $55
 *     truck driver $55 · retail $65 · electrician $80
 *
 * Nobody picks the $25 job when the $80 job is one tap away, so seven of the
 * eight cards are noise. Worse, the $25 musician is the BEST long-term choice
 * in the existing data (ceiling $1,000/wk against the electrician's $600) and
 * nothing on screen says so.
 *
 * THE FIX, IN THREE PARTS
 * -----------------------
 * 1. HIRING BARS. The best-paying entry jobs stop being free. A fresh character
 *    (fitness 10, reputation 0) cannot walk into the $80 electrician job — it
 *    wants Fitness 25. That turns the top of the board from a default into a
 *    short-term goal you can see and work toward, and it means the jobs you CAN
 *    take are all genuinely in contention with each other.
 *
 * 2. LEGIBLE TRADE-OFFS. Every job now states its ceiling, its weekly toll and
 *    how fast it climbs. "$25/wk, ceiling $1,000, fast" is a visibly different
 *    bet from "$80/wk, ceiling $600, steady" — the decision stops being which
 *    number is bigger and becomes what kind of life you want.
 *
 * 3. A CURATED BOARD. Instead of every opening forever, a handful are OPEN at
 *    any time and the board turns over every few weeks. The early screen stops
 *    being a wall of near-identical cards, and openings you passed on coming
 *    back later makes the world feel like it is running without you.
 *
 * Everything here is pure: no React, no GameState mutation, no RNG. The board
 * is derived deterministically from the week and a per-life seed, so it is
 * stable across re-renders and reloads — the same life always sees the same
 * board in the same week, and a reload never reshuffles the openings.
 */

import type { GameState } from '@/contexts/game/types';
import { fnv1a32 } from '@/utils/seededRoll';

/** How quickly promotion progress accrues, relative to the default rate. */
export type GrowthPace = 'slow' | 'steady' | 'fast';

export interface HiringBar {
  fitness?: number;
  reputation?: number;
  /** Minimum health — jobs that will not hire someone who cannot do the shift. */
  health?: number;
}

export interface EntryJobProfile {
  careerId: string;
  /** One line of character. Shown on the card so the job reads as a place, not a row. */
  vibe: string;
  /** What the job leads to, if you stay. Gives the ceiling a story. */
  path: string;
  /** Stat minimums to be HIRED. Empty means anyone can walk in. */
  hiringBar: HiringBar;
  /** What a week of this work costs. Negative numbers are drains. */
  weeklyToll: { energy: number; health?: number; happiness?: number };
  /** How fast the ladder climbs. */
  growth: GrowthPace;
}

/**
 * The eight starting careers, each given a reason to exist.
 *
 * Bars are set against a fresh character (fitness 10, reputation 0) so that:
 *  - three jobs are open to absolutely anyone on day one (the real starting
 *    choice, and they differ on ceiling/toll/growth rather than pay),
 *  - the rest are a few sessions of gym or a bit of reputation away — close
 *    enough to be a goal, far enough that the $80 job is not the default.
 */
export const ENTRY_JOB_PROFILES: readonly EntryJobProfile[] = [
  {
    careerId: 'musician',
    vibe: 'Busking for coins and uploading takes at 2am.',
    path: 'Session work → touring act → headliner',
    hiringBar: {},
    weeklyToll: { energy: -8, happiness: 4 },
    growth: 'fast',
  },
  {
    careerId: 'farmer',
    vibe: 'Up before dawn. The work is honest and it never ends.',
    path: 'Farmhand → operator → your own land',
    hiringBar: {},
    weeklyToll: { energy: -18, health: 1 },
    growth: 'slow',
  },
  {
    careerId: 'chef',
    vibe: 'Prep, service, clean, repeat. The burns stop hurting eventually.',
    path: 'Line cook → sous → head chef',
    hiringBar: {},
    weeklyToll: { energy: -14, happiness: -1 },
    growth: 'steady',
  },
  {
    careerId: 'fast_food',
    vibe: 'The fryer beeps. It never stops beeping.',
    path: 'Crew → shift lead → district manager',
    hiringBar: {},
    weeklyToll: { energy: -12, happiness: -3 },
    growth: 'slow',
  },
  {
    careerId: 'janitor',
    vibe: 'Empty halls, floor buffer, headphones in. Nobody bothers you.',
    path: 'Janitor → maintenance lead → facilities director',
    hiringBar: { health: 40 },
    weeklyToll: { energy: -15 },
    growth: 'slow',
  },
  {
    careerId: 'truck_driver',
    vibe: 'Sixteen hundred miles of nothing and a radio that barely works.',
    path: 'Regional runs → long haul → your own rig',
    hiringBar: { health: 55 },
    weeklyToll: { energy: -16, health: -2 },
    growth: 'steady',
  },
  {
    careerId: 'retail',
    vibe: 'A name badge, a headset, and a queue that never gets shorter.',
    path: 'Associate → supervisor → regional manager',
    hiringBar: { reputation: 5 },
    weeklyToll: { energy: -12, happiness: -2 },
    growth: 'steady',
  },
  {
    careerId: 'electrician',
    vibe: 'Crawlspaces, conduit, and a trade nobody can outsource.',
    path: 'Apprentice → journeyman → contractor',
    hiringBar: { fitness: 25 },
    weeklyToll: { energy: -17 },
    growth: 'steady',
  },
] as const;

/** How many openings the board shows at once. */
export const BOARD_SIZE = 4;
/** Weeks an opening stays on the board before the market turns over. */
export const BOARD_ROTATION_WEEKS = 8;

const PROFILE_BY_ID = new Map(ENTRY_JOB_PROFILES.map((p) => [p.careerId, p]));

export function getEntryJobProfile(careerId: string): EntryJobProfile | undefined {
  return PROFILE_BY_ID.get(careerId);
}

/** True when this career is part of the curated entry tier. */
export function isEntryTierCareer(careerId: string): boolean {
  return PROFILE_BY_ID.has(careerId);
}

const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

export interface HiringVerdict {
  /** Would they hire you right now? */
  eligible: boolean;
  /** Player-facing shortfalls, e.g. "Fitness 25 (you have 10)". */
  missing: string[];
}

/**
 * Would this employer take the player as they are?
 *
 * Reports EVERY shortfall rather than the first, so the card can show the whole
 * gap at once — "you need two more things" is actionable, "you need one more
 * thing" repeated three times is a guessing game.
 */
export function evaluateHiring(
  profile: EntryJobProfile | undefined,
  state: GameState | null | undefined
): HiringVerdict {
  if (!profile) return { eligible: true, missing: [] };
  const stats = state?.stats;
  const missing: string[] = [];

  const check = (label: string, need: number | undefined, have: number) => {
    if (typeof need === 'number' && have < need) {
      missing.push(`${label} ${need} (you have ${Math.floor(have)})`);
    }
  };

  check('Fitness', profile.hiringBar.fitness, num(stats?.fitness));
  check('Reputation', profile.hiringBar.reputation, num(stats?.reputation));
  check('Health', profile.hiringBar.health, num(stats?.health));

  return { eligible: missing.length === 0, missing };
}

/**
 * Stable 32-bit hash. Used instead of an RNG so the board is a pure function of
 * (life seed, week block) — no stored state, no reshuffle on reload, and the
 * same life always sees the same market.
 */
function hash(input: string): number {
  // FNV-1a body moved to the shared `fnv1a32` (audit H7c) — bit-identical to
  // the hand-rolled loop that was here, so no board reshuffles.
  return fnv1a32(input);
}

/**
 * A per-life seed. Two characters in the same week see different boards, which
 * is what stops the opening rotation from feeling like a fixed script.
 *
 * Both inputs are fixed at character creation and never change during a life,
 * which is what makes the board stable: anything that drifts (money, week,
 * stats) would reshuffle the openings underneath the player mid-decision.
 * Pre-RNG-log saves fall back to the name alone, and a nameless state to the
 * week rotation only — degraded, never broken.
 */
function lifeSeed(state: GameState | null | undefined): string {
  const seed = num(state?.rngCommitLog?.seed);
  const firstName = typeof state?.userProfile?.firstName === 'string' ? state.userProfile.firstName : '';
  return `${seed}|${firstName}`;
}

export interface BoardOpening {
  careerId: string;
  profile: EntryJobProfile;
  verdict: HiringVerdict;
}

/**
 * The openings currently on the board.
 *
 * Rules:
 *  - `BOARD_SIZE` openings, rotating every `BOARD_ROTATION_WEEKS`.
 *  - At least one opening the player QUALIFIES for is always present. Without
 *    this guarantee a low-stat character could face a board of four jobs that
 *    all reject them, which is not a hard choice — it is a dead end.
 *  - Careers the player already works, has applied to, or has been accepted
 *    into are never filtered out by the board; the caller keeps showing those.
 */
export function getJobBoard(state: GameState | null | undefined): BoardOpening[] {
  const openings = ENTRY_JOB_PROFILES.map((profile) => ({
    careerId: profile.careerId,
    profile,
    verdict: evaluateHiring(profile, state),
  }));

  const week = num(state?.weeksLived);
  const block = Math.floor(week / BOARD_ROTATION_WEEKS);
  const seed = `${lifeSeed(state)}|${block}`;

  // Deterministic shuffle: score each opening by a hash of (seed, careerId) and
  // sort. Stable for a given block, completely different in the next one.
  const ranked = [...openings].sort(
    (a, b) => hash(`${seed}|${a.careerId}`) - hash(`${seed}|${b.careerId}`)
  );

  const board = ranked.slice(0, BOARD_SIZE);

  // Guarantee an attainable option.
  if (!board.some((o) => o.verdict.eligible)) {
    const attainable = ranked.find((o) => o.verdict.eligible);
    if (attainable) board[board.length - 1] = attainable;
  }

  return board;
}

/** Weeks until the board turns over. Drives the "new openings in N weeks" line. */
export function weeksUntilBoardRefresh(state: GameState | null | undefined): number {
  const week = num(state?.weeksLived);
  const into = week % BOARD_ROTATION_WEEKS;
  return BOARD_ROTATION_WEEKS - into;
}

/** Top salary on a career's ladder — the number that makes a low entry wage a bet. */
export function careerCeiling(career: { levels?: { salary: number }[] } | undefined): number {
  const levels = career?.levels;
  if (!Array.isArray(levels) || levels.length === 0) return 0;
  return levels.reduce((max, l) => Math.max(max, num(l?.salary)), 0);
}

/** Short label for the growth pace, for the card. */
export function growthLabel(growth: GrowthPace): string {
  return growth === 'fast' ? 'Climbs fast' : growth === 'slow' ? 'Climbs slow' : 'Steady climb';
}
