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
import { zeroPreRolls } from '@/__tests__/helpers/zeroPreRolls';

function makeCtx(money: number, nextWeeksLived: number): WeekContext {
  // applyScheduledWedding only reads `newStats.money` and `nextWeeksLived`.
  return {
    newStats: { money, health: 50, happiness: 50, energy: 50, fitness: 50, reputation: 50, gems: 0 },
    notifications: [],
    preRolls: zeroPreRolls(),
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
    // EngagementRing's money field is `price`; this literal said `cost`, a
    // field the type does not have, and omitted three that it requires. The
    // cast was hiding both. Nothing in the wedding subsystem reads the ring, so
    // it was inert — but an inert literal that lies about its shape is exactly
    // what stops mattering right up until something starts reading it.
    engagementRing: {
      id: 'ring_gold',
      name: 'Gold Band',
      price: 1000,
      qualityTier: 'elegant',
      acceptanceBonus: 10,
      description: 'A simple gold band.',
    },
    weddingPlanned: { venue: 'courthouse', budget: 8000, scheduledWeek, guestCount: 4 },
  } as unknown as Relationship;
}

describe('applyScheduledWedding - auto wedding-completion path', () => {
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

/**
 * PLAYER REPORT (BBQ, 2026-08-31): "Choosing to get engaged instead of moving in
 * together. This is also broken. The wedding is planned but never occurs.
 * Forever engaged. Can have kids. After about a year can re-plan the wedding and
 * it works as intended."
 *
 * That description matches this subsystem line for line: an unaffordable balance
 * slides the date four weeks, forever, until the one-year expiry clears the plan
 * and the player can re-plan. What made it read as broken rather than as an
 * unpaid bill is that every one of those outcomes was announced to `logger.info`
 * and to nobody else. The player is told at planning time that the wedding
 * "happens on its week"; the game then never mentions it again.
 */
describe('a wedding that does not happen tells the player why', () => {
  const balanceOf = (budget: number) => Math.floor(budget * 0.75);

  it('postponing says what was owed, what is on hand, and when it retries', () => {
    const ctx = makeCtx(100, 52);
    const result = applyScheduledWedding(engagedRel(52), ctx);

    expect(result!.rel.type).toBe('partner'); // still engaged, not married
    expect(result!.rel.weddingPlanned?.scheduledWeek).toBe(56); // +4 weeks
    expect(ctx.notifications).toHaveLength(1);
    const note = ctx.notifications[0];
    expect(note.title).toBe('Wedding Postponed');
    expect(note.message).toContain(balanceOf(8000).toLocaleString());
    expect(note.message).toContain('4 weeks');
    expect(note.message).toContain('Alex');
  });

  it('expiring says the deposit is gone and the engagement is not', () => {
    const rel = engagedRel(104);
    (rel.weddingPlanned as { originalScheduledWeek?: number }).originalScheduledWeek = 52;
    const ctx = makeCtx(0, 104);
    const result = applyScheduledWedding(rel, ctx);

    expect(result!.rel.weddingPlanned).toBeUndefined();
    expect(ctx.notifications).toHaveLength(1);
    expect(ctx.notifications[0].title).toBe('Wedding Called Off');
    expect(ctx.notifications[0].message).toContain('kept the deposit');
  });

  it('the stale-plan sweep is announced too', () => {
    // A plan whose date is more than a year in the past - e.g. carried through a
    // migration. It quietly vanished before.
    const ctx = makeCtx(1_000_000, 200);
    const result = applyScheduledWedding(engagedRel(52), ctx);

    expect(result!.rel.weddingPlanned).toBeUndefined();
    expect(ctx.notifications).toHaveLength(1);
    expect(ctx.notifications[0].title).toBe('Wedding Called Off');
  });

  it('a wedding that DOES happen raises the popup, not a notification', () => {
    const ctx = makeCtx(1_000_000, 52);
    const result = applyScheduledWedding(engagedRel(52), ctx);

    expect(result!.weddingPopup).toEqual({ partnerName: 'Alex' });
    expect(ctx.notifications).toHaveLength(0);
  });
});
