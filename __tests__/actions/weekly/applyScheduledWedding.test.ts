/**
 * Unit tests for the AUTO wedding-completion path (`applyScheduledWedding`).
 *
 * This is the path a player normally marries through — the weekly tick resolves
 * a scheduled wedding. It shares the spouse shape with the manual `executeWedding`
 * via the `buildSpouseRecord` factory. These tests assert the semantic output of
 * that shared shape directly on the live auto path (the subsystemEquivalence
 * suite covers it only as an opaque snapshot): the spouse must carry
 * `marriageWeek`/`anniversaryWeek`/`livingTogether` (so `checkAnniversary` can
 * fire) and must clear stale engagement fields.
 */
import { applyScheduledWedding } from '@/contexts/game/actions/weekly/applyScheduledWedding';
import type { WeekContext } from '@/contexts/game/actions/weekly/weekContext';
import type { Relationship } from '@/contexts/game/types';

function makeCtx(money: number, nextWeeksLived: number): WeekContext {
  // applyScheduledWedding only reads `newStats.money` and `nextWeeksLived`.
  return {
    newStats: { money } as WeekContext['newStats'],
    notifications: [],
    preRolls: {} as WeekContext['preRolls'],
    nextWeeksLived,
  };
}

function engagedRel(scheduledWeek: number): Relationship {
  return {
    id: 'lover_alex',
    name: 'Alex',
    // Engaged partners are `type: 'partner'` with engagementWeek set — there is
    // no 'fiance' member in the Relationship union. applyScheduledWedding only
    // branches on `type === 'spouse'`, so 'partner' is the correct pre-wedding type.
    type: 'partner',
    relationshipScore: 70,
    engagementWeek: 40,
    engagementRing: { id: 'ring_gold', name: 'Gold Band', cost: 1000 } as Relationship['engagementRing'],
    weddingPlanned: { venue: 'courthouse', budget: 8000, scheduledWeek, guestCount: 4 },
  } as unknown as Relationship;
}

describe('applyScheduledWedding — auto wedding-completion path', () => {
  it('sets marriageWeek/anniversaryWeek/livingTogether so anniversaries can fire', () => {
    const ctx = makeCtx(1_000_000, 52);
    const result = applyScheduledWedding(engagedRel(52), ctx);
    expect(result).not.toBeNull();
    const spouse = result!.rel;
    expect(spouse.type).toBe('spouse');
    // The core regression: these MUST be set (checkAnniversary reads them).
    expect(spouse.anniversaryWeek).toBe(52);
    expect(spouse.marriageWeek).toBe(52);
    expect(spouse.livingTogether).toBe(true);
    // Stale engagement state must be cleared once married.
    expect(spouse.weddingPlanned).toBeUndefined();
    expect(spouse.engagementWeek).toBeUndefined();
    expect(spouse.engagementRing).toBeUndefined();
    // family.spouse must mirror the married relationship.
    expect(result!.familySpouse?.id).toBe('lover_alex');
    // Remaining 75% of the $8000 budget is charged.
    expect(ctx.newStats.money).toBe(1_000_000 - 6000);
  });

  it('does not complete (or set timestamps) when the player cannot afford the balance', () => {
    const ctx = makeCtx(100, 52); // can't cover the $6000 remaining
    const result = applyScheduledWedding(engagedRel(52), ctx);
    expect(result).not.toBeNull();
    expect(result!.rel.type).not.toBe('spouse');
    expect(result!.rel.anniversaryWeek).toBeUndefined();
    expect(ctx.newStats.money).toBe(100); // not charged
  });
});
