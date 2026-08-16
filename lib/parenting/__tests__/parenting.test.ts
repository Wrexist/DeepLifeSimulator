/**
 * Parenting action loop — unit tests.
 *
 * Covers:
 *  1. Catalog integrity + age-band gating.
 *  2. Effect application: stat rises, caps at 100, cooldown enforced, weekly
 *     cap enforced, affordability (money + energy), purity, money/energy deltas.
 *  3. Raised nurture stats measurably improve the heir / prestige-child outcome
 *     (childSimulation education, childStats starting stats, HeirGenerator preview,
 *     and inheritance via education).
 */
import type { ChildInfo, GameState } from '@/contexts/game/types';
import {
  PARENTING_ACTIONS,
  MAX_PARENTING_ACTIONS_PER_WEEK,
  NURTURE_MAX,
  AGE_BANDS,
  getAgeBand,
  getActionsForAge,
  getActionById,
  getNurtureStat,
  getNurtureQuality,
  canPerformParentingAction,
  applyParentingAction,
  type NurtureStatKey,
  type ParentingAgeBand,
} from '@/lib/parenting';
import { simulateChildToAge } from '@/lib/legacy/childSimulation';
import { calculateChildStats, calculateChildInheritance } from '@/lib/prestige/childStats';
import { HeirGenerator } from '@/lib/legacy/heirGeneration';
import { createTestGameState, type TestGameStateOverrides } from '@/__tests__/helpers/createTestGameState';

// ── factories ─────────────────────────────────────────────────────────────
function makeChild(overrides: Partial<ChildInfo> = {}): ChildInfo {
  return {
    id: 'kid-1',
    name: 'Test Child',
    type: 'child',
    relationshipScore: 50,
    personality: 'Curious',
    gender: 'female',
    age: 4,
    ...overrides,
  };
}

function makeParent(overrides: TestGameStateOverrides = {}): GameState {
  const { stats, ...rest } = overrides;
  return createTestGameState({
    bankSavings: 0,
    weeksLived: 100,
    lineageId: 'test-lineage',
    generationNumber: 1,
    ...rest,
    stats: { health: 60, happiness: 60, energy: 60, fitness: 60, money: 200_000, reputation: 60, gems: 0, ...(stats ?? {}) },
  });
}

const VALID_BANDS: ParentingAgeBand[] = ['baby', 'toddler', 'child', 'teen'];
const VALID_EFFECT_KEYS: NurtureStatKey[] = ['intelligence', 'health', 'happiness', 'discipline', 'relationship'];

// ═══════════════════════════════════════════════════════════════════════════
// 1. Catalog integrity + age-band gating
// ═══════════════════════════════════════════════════════════════════════════
describe('parenting catalog integrity', () => {
  it('has unique ids', () => {
    const ids = PARENTING_ACTIONS.map(a => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every action is well-formed (bands, costs, cooldown, effects, icon)', () => {
    for (const a of PARENTING_ACTIONS) {
      expect(a.label.length).toBeGreaterThan(0);
      expect(a.description.length).toBeGreaterThan(0);
      expect(a.bands.length).toBeGreaterThan(0);
      a.bands.forEach(b => expect(VALID_BANDS).toContain(b));
      expect(a.moneyCost).toBeGreaterThanOrEqual(0);
      expect(a.energyCost).toBeGreaterThanOrEqual(0);
      expect(a.cooldownWeeks).toBeGreaterThanOrEqual(1);
      expect(Object.keys(a.effects).length).toBeGreaterThan(0);
      (Object.entries(a.effects) as [NurtureStatKey, number][]).forEach(([k, v]) => {
        expect(VALID_EFFECT_KEYS).toContain(k);
        expect(typeof v).toBe('number');
        // Effects are modest — no single action moves a stat by more than 4.
        expect(Math.abs(v)).toBeLessThanOrEqual(4);
      });
      expect(typeof a.icon).toBe('string');
      expect(a.icon.length).toBeGreaterThan(0);
    }
  });

  it('covers all four age bands', () => {
    const covered = new Set(PARENTING_ACTIONS.flatMap(a => a.bands));
    VALID_BANDS.forEach(b => expect(covered.has(b)).toBe(true));
  });
});

describe('age-band gating', () => {
  it('maps ages to the correct band', () => {
    expect(getAgeBand(0)).toBe('baby');
    expect(getAgeBand(2)).toBe('baby');
    expect(getAgeBand(3)).toBe('toddler');
    expect(getAgeBand(5)).toBe('toddler');
    expect(getAgeBand(6)).toBe('child');
    expect(getAgeBand(12)).toBe('child');
    expect(getAgeBand(13)).toBe('teen');
    expect(getAgeBand(18)).toBe('teen');
    // Fractional ages (aging is 1/52 per week) floor into the band.
    expect(getAgeBand(2.9)).toBe('baby');
    expect(getAgeBand(12.5)).toBe('child');
  });

  it('returns null once grown or for invalid ages', () => {
    expect(getAgeBand(19)).toBeNull();
    expect(getAgeBand(40)).toBeNull();
    expect(getAgeBand(-1)).toBeNull();
    expect(getAgeBand(undefined)).toBeNull();
    expect(getAgeBand(NaN)).toBeNull();
  });

  it('getActionsForAge returns only band-appropriate actions', () => {
    const babyActions = getActionsForAge(1);
    expect(babyActions.length).toBeGreaterThan(0);
    babyActions.forEach(a => expect(a.bands).toContain('baby'));
    // A baby cannot be given driving lessons (teen-only).
    expect(babyActions.find(a => a.id === 'driving_lessons')).toBeUndefined();

    const teenActions = getActionsForAge(15);
    expect(teenActions.find(a => a.id === 'driving_lessons')).toBeDefined();
    // A teen is past baby playtime.
    expect(teenActions.find(a => a.id === 'playtime')).toBeUndefined();

    // Grown children have no actions.
    expect(getActionsForAge(20)).toHaveLength(0);
  });

  it('rejects an action performed outside its age band', () => {
    const baby = makeChild({ age: 1 });
    // driving_lessons is teen-only.
    const res = canPerformParentingAction(baby, 'driving_lessons', 100, 100_000, 100);
    expect(res.ok).toBe(false);
    expect(res.reason).toBe('wrong-age');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 2. Effect application
// ═══════════════════════════════════════════════════════════════════════════
describe('parenting effect application', () => {
  it('raises the targeted nurture stats and does not mutate the input', () => {
    const child = makeChild({ age: 4, intelligence: 50 });
    const before = JSON.parse(JSON.stringify(child));
    // preschool_activity: intelligence +2, discipline +1 (toddler)
    const out = applyParentingAction(child, 'preschool_activity', 100, 100_000, 100);
    expect(out.ok).toBe(true);
    expect(out.child!.intelligence).toBe(52);
    expect(out.child!.discipline).toBe(51); // was default 50 → +1
    // input untouched (purity)
    expect(child).toEqual(before);
  });

  it('folds the relationship effect into relationshipScore (the bond)', () => {
    const child = makeChild({ age: 8, relationshipScore: 40 });
    // teach_values: discipline +2, relationship +1
    const out = applyParentingAction(child, 'teach_values', 100, 100_000, 100);
    expect(out.ok).toBe(true);
    expect(out.child!.relationshipScore).toBe(41);
  });

  it('caps nurture stats at 100', () => {
    const child = makeChild({ age: 4, intelligence: NURTURE_MAX - 1 });
    const out = applyParentingAction(child, 'preschool_activity', 100, 100_000, 100);
    expect(out.ok).toBe(true);
    expect(out.child!.intelligence).toBe(NURTURE_MAX); // 99 + 2 clamped to 100
  });

  it('returns negative money and energy deltas equal to the action cost', () => {
    const child = makeChild({ age: 10 });
    // family_trip: money 1500, energy 8
    const out = applyParentingAction(child, 'family_trip', 100, 100_000, 100);
    expect(out.ok).toBe(true);
    expect(out.moneyDelta).toBe(-1500);
    expect(out.energyDelta).toBe(-8);
  });

  it('enforces the per-action cooldown', () => {
    let child = makeChild({ age: 4 });
    // preschool_activity has a 3-week cooldown.
    const first = applyParentingAction(child, 'preschool_activity', 100, 100_000, 100);
    expect(first.ok).toBe(true);
    child = first.child!;

    // Same week → on cooldown.
    const second = applyParentingAction(child, 'preschool_activity', 100, 100_000, 100);
    expect(second.ok).toBe(false);
    expect(second.reason).toBe('cooldown');

    // Still on cooldown at week 102 (< 100 + 3).
    expect(applyParentingAction(child, 'preschool_activity', 102, 100_000, 100).reason).toBe('cooldown');

    // Available again at week 103.
    const later = applyParentingAction(child, 'preschool_activity', 103, 100_000, 100);
    expect(later.ok).toBe(true);
  });

  it('enforces the weekly action cap per child', () => {
    let child = makeChild({ age: 8 });
    // Distinct child actions so cooldown doesn't interfere: help_homework,
    // sports_club, music_lessons, teach_values are all child-band.
    const seq = ['help_homework', 'sports_club', 'music_lessons', 'teach_values'];
    let performed = 0;
    for (const id of seq) {
      const out = applyParentingAction(child, id, 100, 100_000, 100);
      if (out.ok) {
        child = out.child!;
        performed += 1;
      } else {
        expect(out.reason).toBe('weekly-cap');
      }
    }
    expect(performed).toBe(MAX_PARENTING_ACTIONS_PER_WEEK);
    expect(child.parenting!.actionsThisWeek).toBe(MAX_PARENTING_ACTIONS_PER_WEEK);

    // A fresh week resets the cap.
    const nextWeek = applyParentingAction(child, 'teach_values', 101, 100_000, 100);
    expect(nextWeek.ok).toBe(true);
    expect(nextWeek.child!.parenting!.actionsThisWeek).toBe(1);
  });

  it('rejects unaffordable actions and applies no effect', () => {
    const child = makeChild({ age: 15 });
    // fund_tutoring costs $500.
    const poor = applyParentingAction(child, 'fund_tutoring', 100, 100, 100);
    expect(poor.ok).toBe(false);
    expect(poor.reason).toBe('insufficient-money');
    expect(poor.child).toBeUndefined();
    expect(poor.moneyDelta).toBeUndefined();

    // heart_to_heart costs 6 energy.
    const tired = applyParentingAction(child, 'heart_to_heart', 100, 100_000, 3);
    expect(tired.ok).toBe(false);
    expect(tired.reason).toBe('insufficient-energy');
  });

  it('getNurtureStat defaults to 50 for un-nurtured children and reads relationshipScore for the bond', () => {
    const child = makeChild({ relationshipScore: 77 });
    expect(getNurtureStat(child, 'intelligence')).toBe(50);
    expect(getNurtureStat(child, 'health')).toBe(50);
    expect(getNurtureStat(child, 'relationship')).toBe(77);
    expect(getNurtureQuality(child)).toBe(Math.round((50 + 50 + 50 + 50 + 77) / 5));
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 3. Raised nurture stats improve the heir / prestige-child outcome
// ═══════════════════════════════════════════════════════════════════════════
describe('nurture → heir / prestige-child pipeline', () => {
  const tierRank: Record<string, number> = { none: 0, highSchool: 1, university: 2, specialized: 3 };

  it('childSimulation: better-nurtured children reach better education (monotonic, and strictly better for some seeds)', () => {
    const lowNurture = { intelligence: 5, discipline: 5 };
    const highNurture = { intelligence: 100, discipline: 100 };

    let highSum = 0;
    let lowSum = 0;
    let foundStrictFlip = false;

    for (let week = 0; week <= 40; week++) {
      const parent = makeParent({ weeksLived: week, stats: { ...makeParent().stats, money: 200_000 } });
      const low = simulateChildToAge(makeChild({ id: 'kid-x', age: 0, ...lowNurture }), parent, 18);
      const high = simulateChildToAge(makeChild({ id: 'kid-x', age: 0, ...highNurture }), parent, 18);

      const lr = tierRank[low.educationLevel || 'none'];
      const hr = tierRank[high.educationLevel || 'none'];
      // Monotonic: a better-nurtured child is never worse-educated at the same seed.
      expect(hr).toBeGreaterThanOrEqual(lr);
      highSum += hr;
      lowSum += lr;
      if (hr > lr) foundStrictFlip = true;
    }

    // Nurture makes an aggregate, and at least one concrete, difference.
    expect(highSum).toBeGreaterThan(lowSum);
    expect(foundStrictFlip).toBe(true);
  });

  it('childSimulation: nurture stats survive the growth simulation', () => {
    const parent = makeParent();
    const grown = simulateChildToAge(makeChild({ id: 'kid-x', age: 0, intelligence: 90, happiness: 80 }), parent, 18);
    expect(grown.intelligence).toBe(90);
    expect(grown.happiness).toBe(80);
    expect(grown.age).toBe(18);
  });

  it('calculateChildStats: higher nurture yields higher starting stats', () => {
    const randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0.5);
    try {
      const parent = makeParent();
      const prestige = { prestigeLevel: 0 } as any;
      const low = calculateChildStats(
        makeChild({ age: 18, health: 5, happiness: 5, discipline: 5 }),
        parent,
        prestige,
      );
      const high = calculateChildStats(
        makeChild({ age: 18, health: 100, happiness: 100, discipline: 100 }),
        parent,
        prestige,
      );
      expect(high.health!).toBeGreaterThan(low.health!);
      expect(high.happiness!).toBeGreaterThan(low.happiness!);
      expect(high.reputation!).toBeGreaterThan(low.reputation!);
      expect(high.fitness!).toBeGreaterThanOrEqual(low.fitness!);
      // All within valid bounds.
      Object.values(high).forEach(v => {
        if (typeof v === 'number') expect(v).toBeLessThanOrEqual(100);
      });
    } finally {
      randomSpy.mockRestore();
    }
  });

  it('HeirGenerator: higher nurture yields a stronger heir preview', () => {
    // 0.99 → no genetic traits inherited, so the nurture-adjusted base is what
    // we observe (isolates the nurture contribution).
    const randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0.99);
    try {
      const low = HeirGenerator.generateHeir(
        makeChild({ id: 'h', age: 18, health: 5, happiness: 5, discipline: 5 }),
        [], 2, 'lineage', 'parent', undefined, [],
      );
      const high = HeirGenerator.generateHeir(
        makeChild({ id: 'h', age: 18, health: 100, happiness: 100, discipline: 100 }),
        [], 2, 'lineage', 'parent', undefined, [],
      );
      expect(high.startingStats.health).toBeGreaterThan(low.startingStats.health);
      expect(high.startingStats.happiness).toBeGreaterThan(low.startingStats.happiness);
      expect(high.startingStats.reputation).toBeGreaterThan(low.startingStats.reputation);
    } finally {
      randomSpy.mockRestore();
    }
  });

  it('inheritance: the education a nurtured child reaches increases their inheritance', () => {
    const netWorth = 1_000_000;
    const highSchoolChild = makeChild({ age: 18, educationLevel: 'highSchool' });
    const specializedChild = makeChild({ age: 18, educationLevel: 'specialized', careerPath: 'professional' });
    const base = calculateChildInheritance(netWorth, highSchoolChild);
    const boosted = calculateChildInheritance(netWorth, specializedChild);
    expect(boosted).toBeGreaterThan(base);
  });
});
