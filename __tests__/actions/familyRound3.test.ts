/**
 * Four family systems that were quietly doing nothing.
 *
 * R3-F4 `lifetimeStatistics.totalRelationships` had NO writer.
 * `trackNewRelationship` exists but its only caller is a stress test, so the
 * "Social Network — form 25 total relationships in your lifetime" achievement
 * sat at 0/25 forever. The `??` chain in its progress spec never fell through
 * to `relationships.length`, because the field is PRESENT as 0 and 0 is not
 * nullish.
 *
 * R3-F5 the parenting "Bond" effects were inert twice over: every child was
 * created at `relationshipScore: 100`, which is `NURTURE_MAX`, so the +1 and +3
 * bumps clamped away on arrival — and the weekly family rebuild spread a
 * `Relationship` over the child, whose own `relationshipScore` then overwrote
 * whatever parenting had written.
 *
 * R3-F6 the wedding-plan 1-year expiry was unreachable: `weddingAge` was
 * computed inside a branch gated on `scheduledWeek === nextWeeksLived`, so it
 * was always 0, and the postpone path overwrote `scheduledWeek` so it could
 * never drift.
 *
 * R3-F8 `child.familyHappiness` has no writer, so every child contributed a
 * constant 2 to the headline Family Happiness number.
 * 2026-07-31 audit round 3.
 */
import fs from 'fs';
import path from 'path';
import { NEWBORN_BOND } from '@/lib/parenting/parentingLogic';
import { NURTURE_MAX } from '@/lib/parenting/catalog';
import { createWeddingPlan } from '@/lib/dating/weddingVenues';

const read = (rel: string): string =>
  fs.readFileSync(path.join(__dirname, '..', '..', rel), 'utf8');

describe('R3-F4 — lifetime relationships are counted', () => {
  const source = read('contexts/game/actions/weekly/applyLifetimeStatistics.ts');

  it('accumulates the weekly growth', () => {
    expect(source).toMatch(/totalRelationships:\s*\n?\s*\(ls\.totalRelationships \?\? 0\) \+ Math\.max\(0, relationshipGrowth\)/);
  });

  it('is monotonic — losing a relationship never decreases the lifetime total', () => {
    // `Math.max(0, …)` is what makes it a LIFETIME count rather than a current
    // headcount, which is what the achievement text promises.
    expect(source).toMatch(/Math\.max\(0, relationshipGrowth\)/);
  });

  it('the week loop passes the post-tick count', () => {
    expect(read('contexts/game/GameActionsContext.tsx')).toMatch(
      /nextRelationshipCount: processedRelationships\.length/,
    );
  });

  it('a caller that omits the count cannot corrupt the counter', () => {
    // The field is optional and falls back to the previous count, so the growth
    // term is 0 rather than negative.
    expect(source).toMatch(/nextRelationshipCount\?: number/);
    expect(source).toMatch(/input\.nextRelationshipCount \?\? \(input\.prevState\.relationships \?\? \[\]\)\.length/);
  });
});

describe('R3-F5 — parenting Bond actually moves', () => {
  it('a newborn starts below the clamp ceiling', () => {
    // The whole reason the +1/+3 actions were no-ops.
    expect(NEWBORN_BOND).toBeLessThan(NURTURE_MAX);
    expect(NEWBORN_BOND).toBeGreaterThan(0);
  });

  it('both child-creation sites use it instead of a hardcoded 100', () => {
    for (const rel of [
      'contexts/game/actions/weekly/applyPregnancyProgression.ts',
      'src/features/onboarding/gameStateBuilder.ts',
    ]) {
      const source = read(rel);
      expect(source).toMatch(/relationshipScore: NEWBORN_BOND/);
      expect(source).not.toMatch(/relationshipScore: 100,/);
    }
  });

  it('the weekly family rebuild no longer clobbers the Bond', () => {
    const source = read('contexts/game/GameActionsContext.tsx');

    // The Relationship's own score must be dropped from the spread, or every
    // parenting action is reverted on the next tick.
    expect(source).toMatch(/const \{ relationshipScore: _relScore, \.\.\.relWithoutBond \} = rel;/);
    expect(source).toMatch(/return \{\.\.\.existing, \.\.\.relWithoutBond \};/);
  });

  it('still seeds a NEW child from the relationship', () => {
    // The control: dropping the field for new children too would leave them
    // with no Bond at all.
    expect(read('contexts/game/GameActionsContext.tsx')).toMatch(
      /if \(!existing\) return \{\.\.\.rel, birthWeeksLived: nextWeeksLived \};/,
    );
  });
});

describe('R3-F6 — the wedding plan can expire', () => {
  it('records the original scheduled week at plan time', () => {
    const plan = createWeddingPlan('local_church', 'p1', 50, 300, {});

    // Narrowed rather than asserted: a null here would otherwise make the two
    // assertions below throw a confusing TypeError instead of naming the cause.
    if (!plan) throw new Error('createWeddingPlan returned null for a valid venue');

    expect(plan.originalScheduledWeek).toBe(300);
    expect(plan.scheduledWeek).toBe(300);
  });

  it('the tick measures age from the ORIGINAL date, not the rescheduled one', () => {
    const source = read('contexts/game/actions/weekly/applyScheduledWedding.ts');

    expect(source).toMatch(/rel\.weddingPlanned\.originalScheduledWeek \?\?/);
    // The old form compared against the value the enclosing gate had just
    // asserted equal to `nextWeeksLived`, making the age always 0.
    expect(source).not.toMatch(/const originalScheduled = rel\.weddingPlanned\.scheduledWeek \|\| nextWeeksLived;/);
  });

  it('postponement preserves the original date instead of erasing it', () => {
    const source = read('contexts/game/actions/weekly/applyScheduledWedding.ts');

    expect(source).toMatch(/scheduledWeek: nextWeeksLived \+ 4,\s*\n[\s\S]{0,220}?originalScheduledWeek: originalScheduled,/);
  });

  it('a legacy plan without the field falls back rather than expiring instantly', () => {
    // A save written before the field existed must not have its plan forfeited
    // retroactively on the next tick.
    expect(read('contexts/game/actions/weekly/applyScheduledWedding.ts')).toMatch(
      /originalScheduledWeek \?\? rel\.weddingPlanned\.scheduledWeek \?\? nextWeeksLived/,
    );
  });
});

describe('R3-F8 — Family Happiness reads the stat that is written', () => {
  it('prefers child.happiness over the writerless familyHappiness', () => {
    expect(read('components/FamilyTab.tsx')).toMatch(
      /child\.happiness \?\? child\.familyHappiness \?\? 50/,
    );
  });

  it('no longer reads familyHappiness first', () => {
    const code = read('components/FamilyTab.tsx')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/(^|[^:])\/\/.*$/gm, '$1');

    expect(code).not.toMatch(/\(child\.familyHappiness \|\| 50\)/);
  });
});
