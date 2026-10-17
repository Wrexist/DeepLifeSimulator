/**
 * The Dynasty Tree's purchases reach the heir - measured on the REAL heir
 * builders, not on the source text.
 *
 * ── What was broken (2026-10-17) ──────────────────────────────────────────
 *
 * `createChildGameState` applied the bought starting bonuses EARLY, onto the
 * fresh `initialGameState` clone - and then, ~300 lines later, overwrote
 * `stats.money` with the inheritance and spread `calculateChildStats` over
 * health / happiness / fitness / reputation. Every money, stat and reputation
 * upgrade was computed and then discarded. Two independent audits ran
 * `continueAsChild` and measured an heir holding all 19 upgrades (incl.
 * "starts with $100,000,000" and +75 reputation) start byte-identical to one
 * holding none.
 *
 * The old test for this regex-matched the source for the line that applied the
 * bonus, which is exactly why it passed: the line was there. It just ran before
 * the line that threw its result away. Every assertion below runs the real
 * `continueAsChild` / `executePrestige` and compares the heir it builds with
 * and without the purchases.
 *
 * The three "intelligence" nodes targeted a stat `GameStats` does not have, so
 * they were dead even when the rest worked. They now grant completed education
 * programmes (`educations`, a real field every career gate reads).
 */
import { createTestGameState } from '@/__tests__/helpers/createTestGameState';
import type { ChildInfo, GameState } from '@/contexts/game/types';
import { continueAsChild, executePrestige } from '@/lib/prestige/prestigeExecution';
import {
  LEGACY_UPGRADES,
  applyHeirStartingBonuses,
  heirStartingBonuses,
} from '@/lib/legacy/legacyShop';
import { EDUCATION_PROGRAMS } from '@/lib/education/programs';
import { netWorth } from '@/lib/progress/achievements';
import { getPrestigeThreshold } from '@/lib/prestige/prestigeTypes';

const ALL_IDS = LEGACY_UPGRADES.map((u) => u.id);

/** Sum of every money node in the tree - what "all upgrades" must add. */
const ALL_MONEY = LEGACY_UPGRADES.reduce(
  (sum, u) => sum + (u.effect.kind === 'money' ? u.effect.amount : 0),
  0,
);
const ALL_REPUTATION = LEGACY_UPGRADES.reduce(
  (sum, u) => sum + (u.effect.kind === 'reputation' ? u.effect.amount : 0),
  0,
);

function heirChild(): ChildInfo {
  return {
    id: 'heir1',
    name: 'Sam Tester',
    type: 'child',
    relationshipScore: 80,
    personality: 'curious',
    gender: 'female',
    age: 20,
    savings: 5_000,
  };
}

/** A dying parent with one adult heir, a real estate, and some reputation. */
function parentState(
  legacyUpgrades: string[],
  money = 2_000_000,
): GameState {
  const base = createTestGameState();
  return {
    ...base,
    weeksLived: 2_600,
    lifeStartWeek: 0,
    legacyPoints: 20_000,
    legacyUpgrades,
    stats: { ...base.stats, money, reputation: 40, health: 50, happiness: 50, fitness: 30 },
    family: { ...base.family, children: [heirChild()] },
  };
}

// The heir's base stats roll `Math.random` (calculateChildStats), so pin it -
// the comparison is "same life, with vs without the purchases", and an
// unpinned roll would make the two heirs differ for reasons that are not the
// shop's.
let randomSpy: jest.SpyInstance;
beforeEach(() => {
  randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0.5);
});
afterEach(() => {
  randomSpy.mockRestore();
});

describe('death -> heir (continueAsChild): the heir starts with what was bought', () => {
  const without = () => continueAsChild(parentState([]), 'heir1');
  const withAll = () => continueAsChild(parentState(ALL_IDS), 'heir1');

  it('money: every money node lands ON TOP of the inheritance, exactly once', () => {
    const a = without();
    const b = withAll();

    expect(ALL_MONEY).toBe(111_110_000);
    expect(b.stats.money - a.stats.money).toBe(ALL_MONEY);
  });

  it('one small node is measurable on its own (not lost in rounding)', () => {
    const a = without();
    const b = continueAsChild(parentState(['legacy_inheritance_small']), 'heir1');

    expect(b.stats.money - a.stats.money).toBe(10_000);
  });

  it('reputation: the Name branch lands, clamped at 100', () => {
    const a = without();
    const b = withAll();

    expect(ALL_REPUTATION).toBe(75);
    expect(b.stats.reputation).toBe(Math.min(100, a.stats.reputation + ALL_REPUTATION));
    expect(b.stats.reputation).toBeGreaterThan(a.stats.reputation);
  });

  it('health / fitness / happiness: the Blood and Craft nodes land, clamped at 100', () => {
    const a = without();
    const b = continueAsChild(
      parentState(['legacy_health', 'legacy_fitness', 'legacy_contentment']),
      'heir1',
    );

    expect(b.stats.health).toBe(Math.min(100, a.stats.health + 15));
    expect(b.stats.fitness).toBe(Math.min(100, a.stats.fitness + 15));
    expect(b.stats.happiness).toBe(Math.min(100, a.stats.happiness + 15));
    // The base heir is below the cap on every one, so each node is VISIBLE -
    // a clamp that ate the whole bonus would make this assertion vacuous.
    expect(a.stats.health).toBeLessThan(100);
    expect(a.stats.fitness).toBeLessThan(100);
    expect(a.stats.happiness).toBeLessThan(100);
  });

  it('the full tree never pushes a stat past 100', () => {
    const b = withAll();
    for (const key of ['health', 'happiness', 'fitness', 'reputation'] as const) {
      expect(`${key}:${b.stats[key] <= 100 && b.stats[key] >= 0}`).toBe(`${key}:true`);
    }
  });

  it('the Craft degrees are real completed programmes', () => {
    const a = without();
    const b = continueAsChild(
      parentState(['legacy_education', 'legacy_tutors', 'legacy_family_library']),
      'heir1',
    );
    const completed = (s: GameState) =>
      (s.educations ?? []).filter((e) => e.completed).map((e) => e.id).sort();

    expect(completed(a)).toEqual([]);
    expect(completed(b)).toEqual(['business_degree', 'high_school', 'masters_degree']);
    // No duplicates, nothing left mid-programme.
    expect(new Set((b.educations ?? []).map((e) => e.id)).size).toBe((b.educations ?? []).length);
    expect((b.educations ?? []).every((e) => e.weeksRemaining === undefined)).toBe(true);
  });

  it('the timed buffs run from the HEIR\'s start, not from week 0', () => {
    const b = continueAsChild(parentState(['legacy_name', 'legacy_heirloom_charm']), 'heir1');

    // A 20-year-old heir starts at weeksLived 104 (CLAUDE.md §4.2).
    expect(b.weeksLived).toBe(104);
    expect(b.legacyBuffs?.luckyCharm?.expiresWeeksLived).toBe(104 + 104);
    expect(b.legacyBuffs?.mentor).toBeUndefined();
  });

  it('an heir with nothing bought gets nothing extra (the control)', () => {
    const a = without();

    expect(a.legacyBuffs).toBeUndefined();
    expect(a.educations ?? []).toEqual([]);
  });

  it('is deterministic in the old state - building the heir twice cannot pay twice', () => {
    // The death -> heir flow runs `continueAsChild` inside a setGameState
    // updater, which React may invoke twice. The result must be a pure
    // function of the ended life.
    const old = parentState(ALL_IDS);
    const first = continueAsChild(old, 'heir1');
    const second = continueAsChild(old, 'heir1');

    expect(second.stats).toEqual(first.stats);
    expect(second.educations).toEqual(first.educations);
    expect(old.legacyUpgrades).toEqual(ALL_IDS);
  });

  it('carries the purchases forward, so the NEXT heir gets them too', () => {
    const b = withAll();

    expect(b.legacyUpgrades).toEqual(ALL_IDS);
    expect(b.legacyPoints).toBe(20_000);
  });
});

describe('prestige as an heir (executePrestige "child") gets the same start', () => {
  function rich(upgrades: string[]): GameState {
    const s = parentState(upgrades, 0);
    const threshold = getPrestigeThreshold(s.prestige?.prestigeLevel ?? 0);
    s.stats = { ...s.stats, money: threshold * 2 };
    expect(netWorth(s)).toBeGreaterThanOrEqual(threshold);
    return s;
  }

  it('money and reputation land on the prestige heir as well', () => {
    const a = executePrestige(rich([]), 'child', 'heir1');
    const b = executePrestige(rich(ALL_IDS), 'child', 'heir1');

    expect(b.stats.money - a.stats.money).toBe(ALL_MONEY);
    expect(b.stats.reputation).toBe(Math.min(100, a.stats.reputation + ALL_REPUTATION));
  });
});

describe('prestige RESET is the same character - the heir bonuses do not apply', () => {
  function rich(upgrades: string[]): GameState {
    const s = parentState(upgrades, 0);
    s.stats = { ...s.stats, money: getPrestigeThreshold(0) * 2 };
    return s;
  }

  it('starts identical with or without purchases, and keeps them for a future heir', () => {
    const a = executePrestige(rich([]), 'reset');
    const b = executePrestige(rich(ALL_IDS), 'reset');

    expect(b.stats).toEqual(a.stats);
    expect(b.educations).toEqual(a.educations);
    expect(b.legacyBuffs).toEqual(a.legacyBuffs);
    expect(b.legacyUpgrades).toEqual(ALL_IDS);
  });
});

describe("a Trial's handicap still wins over a bought head start", () => {
  it("Pauper's Vow zeroes the heir's cash even with the Wealth branch owned", () => {
    const s = parentState(ALL_IDS);
    s.dynasty = { trials: { active: [], pending: ['trial_pauper'] } };
    const b = continueAsChild(s, 'heir1');

    expect(b.stats.money).toBe(0);
  });
});

describe('malformed purchase lists and stats degrade safely', () => {
  it('unknown ids, duplicates and junk entries grant only the real ones, once', () => {
    const junk = [
      'legacy_inheritance_small',
      'legacy_inheritance_small',
      'not_a_real_upgrade',
      null,
      42,
      { id: 'legacy_dynasty_capital' },
    ] as unknown as string[];
    const a = continueAsChild(parentState([]), 'heir1');
    const b = continueAsChild(parentState(junk), 'heir1');

    expect(b.stats.money - a.stats.money).toBe(10_000);
  });

  it('a non-array legacyUpgrades grants nothing and does not throw', () => {
    for (const bad of [undefined, null, 'legacy_inheritance_small', { 0: 'legacy_name' }, 7]) {
      const s = parentState([]);
      (s as { legacyUpgrades?: unknown }).legacyUpgrades = bad;
      const a = continueAsChild(parentState([]), 'heir1');
      const b = continueAsChild(s, 'heir1');
      expect(`${JSON.stringify(bad)}:${b.stats.money === a.stats.money}`)
        .toBe(`${JSON.stringify(bad)}:true`);
    }
  });

  it('applyHeirStartingBonuses never writes NaN onto a corrupt heir', () => {
    const s = createTestGameState();
    s.stats = {
      ...s.stats,
      money: Number.NaN,
      reputation: Number.POSITIVE_INFINITY,
      health: Number.NaN,
      fitness: undefined as unknown as number,
      happiness: -40,
    };
    s.weeksLived = Number.NaN;
    s.educations = [null, { id: 'high_school' }] as unknown as GameState['educations'];

    const out = applyHeirStartingBonuses(s, ALL_IDS);

    for (const key of ['money', 'reputation', 'health', 'fitness', 'happiness'] as const) {
      expect(`${key}:${Number.isFinite(out.stats[key])}`).toBe(`${key}:true`);
    }
    expect(out.stats.money).toBe(ALL_MONEY);
    expect(out.stats.reputation).toBeLessThanOrEqual(100);
    expect(out.stats.happiness).toBeGreaterThanOrEqual(0);
    for (const buff of Object.values(out.legacyBuffs ?? {})) {
      expect(Number.isFinite(buff?.expiresWeeksLived)).toBe(true);
    }
    // The pre-existing partial high_school record is completed, not duplicated.
    const ids = (out.educations ?? []).filter(Boolean).map((e) => e.id);
    expect(ids.filter((id) => id === 'high_school')).toHaveLength(1);
  });

  it('does not mutate the state it was given', () => {
    const s = createTestGameState();
    const before = JSON.stringify(s);
    applyHeirStartingBonuses(s, ALL_IDS);

    expect(JSON.stringify(s)).toBe(before);
  });
});

describe('every node targets something the game actually has', () => {
  const realStats = Object.keys(createTestGameState().stats);
  const programIds = EDUCATION_PROGRAMS.map((p) => p.id);

  it('no stat node targets a stat GameStats does not have (the old "intelligence")', () => {
    for (const u of LEGACY_UPGRADES) {
      if (u.effect.kind !== 'stat') continue;
      expect(`${u.id}:${realStats.includes(u.effect.stat)}`).toBe(`${u.id}:true`);
    }
  });

  it('every education node names a real programme', () => {
    for (const u of LEGACY_UPGRADES) {
      if (u.effect.kind !== 'education') continue;
      expect(`${u.id}:${programIds.includes(u.effect.programId)}`).toBe(`${u.id}:true`);
    }
  });

  it('every node, bought alone, changes the heir (nothing in the tree is inert)', () => {
    const empty = applyHeirStartingBonuses(baseHeir(), []);
    for (const u of LEGACY_UPGRADES) {
      const owned = [u.id];
      const out = applyHeirStartingBonuses(baseHeir(), owned);
      const changed =
        JSON.stringify(out.stats) !== JSON.stringify(empty.stats) ||
        JSON.stringify(out.educations) !== JSON.stringify(empty.educations) ||
        JSON.stringify(out.legacyBuffs) !== JSON.stringify(empty.legacyBuffs);
      expect(`${u.id}:${changed}`).toBe(`${u.id}:true`);
    }
  });

  it('heirStartingBonuses lists the education grants by programme id', () => {
    const b = heirStartingBonuses(['legacy_education', 'legacy_tutors', 'legacy_family_library']);
    expect([...b.educations].sort()).toEqual(['business_degree', 'high_school', 'masters_degree']);
    expect(b.stats).toEqual({});
  });
});

/** A mid-range heir: every stat below the cap, so each node is visible. */
function baseHeir(): GameState {
  const s = createTestGameState();
  s.stats = { ...s.stats, money: 0, reputation: 10, health: 50, happiness: 50, fitness: 30 };
  s.weeksLived = 104;
  s.educations = [];
  s.legacyBuffs = undefined;
  return s;
}
