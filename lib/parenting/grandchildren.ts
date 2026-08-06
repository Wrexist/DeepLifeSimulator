/**
 * Grandchildren — the generation after the one you raise.
 *
 * ## The gap
 *
 * Children age up and then simply stop being content. `ChildInfo` carries
 * education, career, savings, 13 genetic traits and four nurture stats — and
 * once a child reaches adulthood none of it leads anywhere. The family system,
 * which is the emotional core of a life sim, has exactly one generation of
 * depth below the player.
 *
 * ## Scope, deliberately bounded
 *
 * This models grandchildren as LIGHTWEIGHT records on the child, not as a
 * second full simulation. No NPC careers, no NPC marriages, no recursion past
 * one level. That is a design choice, not a shortcut:
 *
 *  - The weekly tick already walks children once (`applyChildAging`). Births are
 *    evaluated in that same pass, so this adds no nested loop — the perf audit
 *    tracks nested-loop density in the tick and it is a live ceiling.
 *  - A recursive family tree is the easiest place in this codebase to write an
 *    unbounded loop. `MAX_GRANDCHILDREN_PER_CHILD` makes the structure provably
 *    finite.
 *
 * ## Determinism
 *
 * Births are decided by a hash of the child's identity and the absolute week —
 * no `Math.random`. The same save on the same week always produces the same
 * outcome, so a reloaded save cannot be rerolled for a birth, and the tests can
 * assert real behaviour rather than mocking randomness.
 */

import type { ChildInfo } from '@/contexts/game/types';

/** Age at which a child may start a family of their own. */
export const GRANDCHILD_MIN_PARENT_AGE = 24;

/** Hard bound on the structure — keeps the family tree provably finite. */
export const MAX_GRANDCHILDREN_PER_CHILD = 3;

/** Minimum game weeks between births to the same child. */
export const GRANDCHILD_BIRTH_COOLDOWN_WEEKS = 104; // 2 years

/**
 * Roughly how often an eligible child has a baby, as a 1-in-N chance per week.
 * ~1.5% a week, so an eligible child averages a first grandchild inside a
 * couple of game years without it feeling scripted.
 */
const BIRTH_CHANCE_DENOMINATOR = 68;

export interface GrandchildInfo {
  /** Stable id — `${parentName}-gc-${n}`. */
  id: string;
  name: string;
  /** Absolute week (`weeksLived`) at which they were born. */
  birthWeeksLived: number;
  /** Traits inherited from the parent child, if any were recorded. */
  geneticTraits?: string[];
}

const FIRST_NAMES = [
  'Ada', 'Rowan', 'Iris', 'Milo', 'Nora', 'Ezra', 'Wren', 'Otto',
  'Juno', 'Silas', 'Maeve', 'Reid', 'Elowen', 'Cassian', 'Thea', 'Roan',
];

/**
 * Small deterministic hash. Not cryptographic — it only needs to be stable
 * across runs and well spread across its inputs.
 */
function hash(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

const asNumber = (v: unknown): number =>
  typeof v === 'number' && Number.isFinite(v) ? v : 0;

/** Grandchildren already recorded against this child. */
export function grandchildrenOf(child: ChildInfo | undefined | null): GrandchildInfo[] {
  const list = child?.grandchildren;
  return Array.isArray(list) ? list : [];
}

/**
 * Is this child eligible to have another child right now?
 *
 * Eligibility is deliberately separate from the roll, so a UI can explain why
 * nothing is happening ("too young", "recently had one") instead of the family
 * tree just sitting still.
 */
export function canHaveGrandchild(
  child: ChildInfo | undefined | null,
  weeksLived: number
): boolean {
  if (!child) return false;
  if (asNumber(child.age) < GRANDCHILD_MIN_PARENT_AGE) return false;

  const existing = grandchildrenOf(child);
  if (existing.length >= MAX_GRANDCHILDREN_PER_CHILD) return false;

  const lastBirth = existing.reduce(
    (latest, g) => Math.max(latest, asNumber(g.birthWeeksLived)),
    -Infinity
  );
  if (Number.isFinite(lastBirth)) {
    if (asNumber(weeksLived) - lastBirth < GRANDCHILD_BIRTH_COOLDOWN_WEEKS) return false;
  }
  return true;
}

/**
 * Decide whether a grandchild is born this week, and build the record if so.
 *
 * Pure and deterministic: same child + same week → same answer, always.
 * Returns null when nothing happens, which is the overwhelmingly common case.
 */
export function rollGrandchild(
  child: ChildInfo | undefined | null,
  weeksLived: number
): GrandchildInfo | null {
  if (!canHaveGrandchild(child, weeksLived)) return null;

  const week = Math.floor(asNumber(weeksLived));
  const identity = `${child!.name ?? 'child'}:${asNumber(child!.birthWeeksLived)}`;
  const roll = hash(`${identity}:${week}`) % BIRTH_CHANCE_DENOMINATOR;
  if (roll !== 0) return null;

  const index = grandchildrenOf(child).length;
  const nameSeed = hash(`${identity}:name:${index}:${week}`);
  return {
    id: `${identity}-gc-${index + 1}`,
    name: FIRST_NAMES[nameSeed % FIRST_NAMES.length],
    birthWeeksLived: week,
    // Traits pass down one more generation, which is what makes the 13 authored
    // genetic traits keep mattering instead of terminating at the heir.
    geneticTraits: Array.isArray(child!.geneticTraits) ? [...child!.geneticTraits] : undefined,
  };
}

/**
 * Apply a week of grandchild births to one child.
 *
 * Returns the SAME object reference when nothing happened, so an unchanged
 * family causes no state churn in the weekly tick.
 */
export function applyGrandchildWeek(child: ChildInfo, weeksLived: number): ChildInfo {
  const born = rollGrandchild(child, weeksLived);
  if (!born) return child;
  return { ...child, grandchildren: [...grandchildrenOf(child), born] };
}

/** Total living descendants below the children — a dynasty-score input. */
export function countGrandchildren(children: readonly ChildInfo[] | undefined | null): number {
  if (!Array.isArray(children)) return 0;
  return children.reduce((sum, c) => sum + grandchildrenOf(c).length, 0);
}
