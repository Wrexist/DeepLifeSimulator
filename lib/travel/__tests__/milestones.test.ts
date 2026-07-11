import { evaluateTravelMilestones, TRAVEL_MILESTONE_TIERS } from '../milestones';

describe('evaluateTravelMilestones', () => {
  it('earns nothing below the first threshold', () => {
    const r = evaluateTravelMilestones(2, []);
    expect(r.newlyEarned).toEqual([]);
    expect(r.happiness).toBe(0);
    expect(r.reputation).toBe(0);
    expect(r.claimedAfter).toEqual([]);
  });

  it('earns the first tier exactly at its threshold', () => {
    const r = evaluateTravelMilestones(3, []);
    expect(r.newlyEarned.map((t) => t.id)).toEqual(['jetsetter']);
    expect(r.happiness).toBe(5);
    expect(r.reputation).toBe(0);
    expect(r.claimedAfter).toEqual(['jetsetter']);
  });

  it('earns every crossed tier at once and sums the bounded rewards', () => {
    const r = evaluateTravelMilestones(6, []);
    expect(r.newlyEarned.map((t) => t.id)).toEqual(['jetsetter', 'globetrotter']);
    expect(r.happiness).toBe(5 + 8);
    expect(r.reputation).toBe(0 + 3);
    expect(r.claimedAfter).toEqual(['jetsetter', 'globetrotter']);
  });

  it('never re-grants an already-claimed tier (idempotent)', () => {
    const r = evaluateTravelMilestones(6, ['jetsetter']);
    expect(r.newlyEarned.map((t) => t.id)).toEqual(['globetrotter']);
    expect(r.happiness).toBe(8);
    expect(r.reputation).toBe(3);
    expect(r.claimedAfter).toEqual(['jetsetter', 'globetrotter']);
  });

  it('grants nothing when all earned tiers are already claimed', () => {
    const r = evaluateTravelMilestones(3, ['jetsetter']);
    expect(r.newlyEarned).toEqual([]);
    expect(r.happiness).toBe(0);
    expect(r.claimedAfter).toEqual(['jetsetter']);
  });

  it('treats undefined claimed as empty', () => {
    const r = evaluateTravelMilestones(3, undefined);
    expect(r.newlyEarned.map((t) => t.id)).toEqual(['jetsetter']);
  });

  it('earns all four tiers at the top threshold', () => {
    const r = evaluateTravelMilestones(15, []);
    expect(r.newlyEarned).toHaveLength(TRAVEL_MILESTONE_TIERS.length);
    expect(r.claimedAfter).toEqual(TRAVEL_MILESTONE_TIERS.map((t) => t.id));
  });

  it('keeps every tier reward bounded (one-off, small)', () => {
    for (const t of TRAVEL_MILESTONE_TIERS) {
      expect(t.happiness).toBeGreaterThanOrEqual(0);
      expect(t.happiness).toBeLessThanOrEqual(15);
      expect(t.reputation).toBeGreaterThanOrEqual(0);
      expect(t.reputation).toBeLessThanOrEqual(10);
    }
  });

  it('lists tiers in ascending threshold order', () => {
    for (let i = 1; i < TRAVEL_MILESTONE_TIERS.length; i++) {
      expect(TRAVEL_MILESTONE_TIERS[i].threshold).toBeGreaterThan(TRAVEL_MILESTONE_TIERS[i - 1].threshold);
    }
  });
});
