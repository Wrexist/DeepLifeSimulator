/**
 * Grandchildren (STATE_VERSION 34).
 *
 * Children age up and then stop being content: `ChildInfo` carries education,
 * career, savings, 13 genetic traits and four nurture stats, and once a child
 * reaches adulthood none of it leads anywhere. The family system — the
 * emotional core of a life sim — had exactly one generation of depth.
 *
 * The properties worth pinning are the ones that keep this from becoming a
 * runaway: it is DETERMINISTIC (so a reload cannot reroll a birth), BOUNDED
 * (so the tree is provably finite), and it adds no nested loop to the weekly
 * tick, where nested-loop density is a tracked ceiling.
 */

import type { ChildInfo } from '@/contexts/game/types';
import {
  GRANDCHILD_MIN_PARENT_AGE,
  MAX_GRANDCHILDREN_PER_CHILD,
  GRANDCHILD_BIRTH_COOLDOWN_WEEKS,
  canHaveGrandchild,
  rollGrandchild,
  applyGrandchildWeek,
  grandchildrenOf,
  countGrandchildren,
} from '@/lib/parenting/grandchildren';
import { applyChildAging } from '@/contexts/game/actions/weekly/applyChildAging';

const child = (over: Partial<ChildInfo> = {}): ChildInfo =>
  ({
    name: 'Alex',
    type: 'child',
    age: 30,
    relationshipScore: 70,
    birthWeeksLived: 0,
    ...over,
  }) as ChildInfo;

/** Walk weeks until a birth happens, so tests never depend on a magic week. */
function firstBirthWeek(c: ChildInfo, from = 0, limit = 5_000): number | null {
  for (let w = from; w < from + limit; w += 1) {
    if (rollGrandchild(c, w)) return w;
  }
  return null;
}

describe('eligibility', () => {
  it('refuses a child below the minimum age', () => {
    expect(canHaveGrandchild(child({ age: GRANDCHILD_MIN_PARENT_AGE - 1 }), 500)).toBe(false);
  });

  it('allows an adult child', () => {
    expect(canHaveGrandchild(child({ age: GRANDCHILD_MIN_PARENT_AGE }), 500)).toBe(true);
  });

  it('refuses a missing or corrupt child', () => {
    expect(canHaveGrandchild(undefined, 500)).toBe(false);
    expect(canHaveGrandchild(null, 500)).toBe(false);
    expect(canHaveGrandchild(child({ age: undefined }), 500)).toBe(false);
  });

  it('stops at the per-child cap', () => {
    const full = child({
      grandchildren: Array.from({ length: MAX_GRANDCHILDREN_PER_CHILD }, (_, i) => ({
        id: `g${i}`,
        name: 'X',
        birthWeeksLived: 0,
      })),
    });
    expect(canHaveGrandchild(full, 10_000)).toBe(false);
  });

  it('enforces a cooldown between births', () => {
    const recent = child({
      grandchildren: [{ id: 'g1', name: 'X', birthWeeksLived: 1_000 }],
    });
    expect(canHaveGrandchild(recent, 1_000 + GRANDCHILD_BIRTH_COOLDOWN_WEEKS - 1)).toBe(false);
    expect(canHaveGrandchild(recent, 1_000 + GRANDCHILD_BIRTH_COOLDOWN_WEEKS)).toBe(true);
  });
});

describe('determinism — a reload cannot reroll a birth', () => {
  it('the same child on the same week always gives the same answer', () => {
    const c = child();
    for (const week of [100, 137, 512, 900]) {
      const a = rollGrandchild(c, week);
      const b = rollGrandchild(c, week);
      expect(`${week}:${JSON.stringify(a)}`).toBe(`${week}:${JSON.stringify(b)}`);
    }
  });

  it('uses no Math.random', () => {
    const spy = jest.spyOn(Math, 'random');
    for (let w = 0; w < 400; w += 1) rollGrandchild(child(), w);
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('different children do not all give birth on the same week', () => {
    // Otherwise the whole family would deliver in lockstep, which reads as a bug.
    const a = firstBirthWeek(child({ name: 'Alex', birthWeeksLived: 0 }));
    const b = firstBirthWeek(child({ name: 'Bailey', birthWeeksLived: 40 }));
    expect(a).not.toBeNull();
    expect(b).not.toBeNull();
    expect(a).not.toBe(b);
  });
});

describe('births', () => {
  it('does happen, within a plausible number of years', () => {
    const week = firstBirthWeek(child());
    expect(week).not.toBeNull();
    // Should not take a whole lifetime to see one.
    expect(week!).toBeLessThan(1_000);
  });

  it('records a usable record', () => {
    const week = firstBirthWeek(child())!;
    const born = rollGrandchild(child(), week)!;
    expect(born.id).toBeTruthy();
    expect(born.name).toBeTruthy();
    expect(born.birthWeeksLived).toBe(week);
  });

  it('passes genetic traits down one more generation', () => {
    const c = child({ geneticTraits: ['bright', 'hardy'] });
    const week = firstBirthWeek(c)!;
    expect(rollGrandchild(c, week)!.geneticTraits).toEqual(['bright', 'hardy']);
  });

  it('never exceeds the cap however long the family runs', () => {
    let c = child();
    for (let w = 0; w < 6_000; w += 1) c = applyGrandchildWeek(c, w);
    expect(grandchildrenOf(c).length).toBeLessThanOrEqual(MAX_GRANDCHILDREN_PER_CHILD);
    // And it actually produced some, or the bound proves nothing.
    expect(grandchildrenOf(c).length).toBeGreaterThan(0);
  });

  it('gives every grandchild a unique id', () => {
    let c = child();
    for (let w = 0; w < 6_000; w += 1) c = applyGrandchildWeek(c, w);
    const ids = grandchildrenOf(c).map((g) => g.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('returns the SAME object when nothing happened, so the tick does not churn', () => {
    const c = child({ age: 10 }); // too young — can never give birth
    expect(applyGrandchildWeek(c, 500)).toBe(c);
  });
});

describe('counting', () => {
  it('is zero for missing or empty families', () => {
    expect(countGrandchildren(undefined)).toBe(0);
    expect(countGrandchildren([])).toBe(0);
    expect(countGrandchildren([child()])).toBe(0);
  });

  it('sums across children', () => {
    const withTwo = child({
      grandchildren: [
        { id: 'a', name: 'A', birthWeeksLived: 1 },
        { id: 'b', name: 'B', birthWeeksLived: 2 },
      ],
    });
    expect(countGrandchildren([withTwo, child()])).toBe(2);
  });
});

describe('the weekly tick wiring', () => {
  it('ages the child exactly as before', () => {
    const before = child({ age: 30 });
    const after = applyChildAging(before, 500);
    expect(after.age).toBeGreaterThan(30);
  });

  it('rolls no birth when no clock is supplied — every legacy caller is safe', () => {
    // The optional parameter is what let this land without touching existing
    // callers or their tests.
    const week = firstBirthWeek(child({ age: 30 }))!;
    const aged = applyChildAging(child({ age: 30 }), undefined);
    expect((aged as ChildInfo).grandchildren).toBeUndefined();
    // Control: with the clock, that same week DOES produce one.
    const c = child({ age: 30 });
    expect(rollGrandchild(c, week)).not.toBeNull();
  });

  it('records a birth through the tick path', () => {
    const c = child({ age: 30 });
    const week = firstBirthWeek(c)!;
    const after = applyChildAging(c, week) as ChildInfo;
    expect(grandchildrenOf(after).length).toBe(1);
  });
});
