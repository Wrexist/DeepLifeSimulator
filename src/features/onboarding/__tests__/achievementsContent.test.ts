import { achievements, Achievement } from '../achievementsData';

/** Achievements added in the v23 new-content pass. */
const NEW_IDS = [
  'luxury_collector',
  'luxury_magnate',
  'hobby_master',
  'hobby_polymath',
  'career_summit',
  'ambition_fulfilled',
  'parenting_devoted',
  'parenting_heir',
  'retirement_retire',
  'retirement_nest_egg',
];

const byId = (id: string): Achievement => {
  const a = achievements.find((x) => x.id === id);
  if (!a) throw new Error(`achievement ${id} not found`);
  return a;
};

const met = (id: string, gs: any): boolean => {
  const spec = byId(id).progressSpec;
  if (spec.kind !== 'boolean') throw new Error(`${id} is not boolean`);
  return spec.met(gs);
};

const reaches = (id: string, gs: any): boolean => {
  const spec = byId(id).progressSpec;
  if (spec.kind !== 'counter') throw new Error(`${id} is not counter`);
  return spec.current(gs) >= spec.goal;
};

describe('achievements registry integrity', () => {
  it('has no duplicate ids across the whole registry', () => {
    const ids = achievements.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('includes every new-content achievement', () => {
    for (const id of NEW_IDS) expect(achievements.some((a) => a.id === id)).toBe(true);
  });

  it('keeps new-content gold rewards in-band', () => {
    for (const id of NEW_IDS) {
      const gold = byId(id).goldReward;
      expect(gold).toBeGreaterThanOrEqual(5); // global floor
      expect(gold).toBeLessThanOrEqual(300); // in-band with existing progression tiers
    }
  });

  it('every new predicate is null-safe (no throw / finite) on empty and stripped state', () => {
    const stripped: any = {};
    const partial: any = { stats: {}, family: {}, pursuits: {}, careers: [] };
    for (const id of NEW_IDS) {
      const spec = byId(id).progressSpec;
      for (const gs of [stripped, partial]) {
        if (spec.kind === 'boolean') {
          const v = spec.met(gs);
          expect(typeof v).toBe('boolean');
        } else {
          const v = spec.current(gs);
          expect(Number.isFinite(v)).toBe(true);
          expect(v).toBeGreaterThanOrEqual(0);
        }
      }
    }
  });
});

describe('luxury achievements', () => {
  it('luxury_collector fires at 5 owned collectibles', () => {
    expect(reaches('luxury_collector', {})).toBe(false);
    const gs = {
      luxuryItems: ['rare_watch_collection', 'museum_diamond', 'fine_art_collection', 'supercar', 'racehorse'],
    };
    expect(reaches('luxury_collector', gs)).toBe(true);
  });

  it('luxury_magnate fires at a $100M collection value', () => {
    expect(reaches('luxury_magnate', {})).toBe(false);
    // A single $120M trophy clears the $100M value bar (but not the 5-item count).
    const gs = { luxuryItems: ['private_island'] };
    expect(reaches('luxury_magnate', gs)).toBe(true);
    expect(reaches('luxury_collector', gs)).toBe(false);
  });
});

describe('hobby achievements', () => {
  it('hobby_master requires Master tier (level ≥ 9)', () => {
    expect(met('hobby_master', {})).toBe(false);
    expect(met('hobby_master', { pursuits: { chess: { xp: 0, level: 8 } } })).toBe(false);
    expect(met('hobby_master', { pursuits: { chess: { xp: 0, level: 9 } } })).toBe(true);
  });

  it('hobby_polymath counts distinct leveled hobbies', () => {
    expect(reaches('hobby_polymath', {})).toBe(false);
    const gs = {
      pursuits: {
        a: { level: 1 },
        b: { level: 1 },
        c: { level: 2 },
        d: { level: 5 },
        e: { level: 1 },
      },
    };
    expect(reaches('hobby_polymath', gs)).toBe(true);
  });
});

describe('career_summit', () => {
  it('needs the top rung of a six-level ladder', () => {
    expect(met('career_summit', {})).toBe(false);
    // Top of a 5-rung ladder does not count.
    expect(met('career_summit', { careers: [{ accepted: true, level: 4, levels: [1, 2, 3, 4, 5] }] })).toBe(false);
    // Six-rung ladder, but not at the top yet.
    expect(met('career_summit', { careers: [{ accepted: true, level: 4, levels: [1, 2, 3, 4, 5, 6] }] })).toBe(false);
    // Six-rung ladder at the top.
    expect(met('career_summit', { careers: [{ accepted: true, level: 5, levels: [1, 2, 3, 4, 5, 6] }] })).toBe(true);
  });
});

describe('ambition_fulfilled', () => {
  it('fires only once the ambition reward is claimed', () => {
    expect(met('ambition_fulfilled', {})).toBe(false);
    expect(met('ambition_fulfilled', { ambitionId: 'wealth', ambitionRewardClaimed: false })).toBe(false);
    expect(met('ambition_fulfilled', { ambitionRewardClaimed: true })).toBe(true);
  });
});

describe('parenting achievements', () => {
  it('parenting_devoted needs a 90+ nurture stat', () => {
    expect(met('parenting_devoted', {})).toBe(false);
    expect(met('parenting_devoted', { family: { children: [{}] } })).toBe(false); // defaults ~50
    expect(met('parenting_devoted', { family: { children: [{ discipline: 95 }] } })).toBe(true);
  });

  it('parenting_heir needs a strong, heir-eligible child', () => {
    expect(met('parenting_heir', {})).toBe(false);
    const strong = { intelligence: 90, health: 90, happiness: 90, discipline: 90, relationshipScore: 90 };
    expect(met('parenting_heir', { family: { children: [strong] } })).toBe(true);
    // A disinherited child never qualifies, however talented.
    expect(met('parenting_heir', { family: { children: [{ ...strong, isHeirEligible: false }] } })).toBe(false);
  });
});

describe('retirement achievements', () => {
  it('retirement_retire fires on retirement', () => {
    expect(met('retirement_retire', {})).toBe(false);
    expect(met('retirement_retire', { isRetired: true })).toBe(true);
  });

  it('retirement_nest_egg needs retirement AND a $10M net worth', () => {
    expect(met('retirement_nest_egg', { isRetired: false, stats: { money: 20_000_000 } })).toBe(false);
    expect(met('retirement_nest_egg', { isRetired: true, stats: { money: 100 } })).toBe(false);
    expect(met('retirement_nest_egg', { isRetired: true, stats: { money: 20_000_000 } })).toBe(true);
  });
});
