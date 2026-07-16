/**
 * Life-stage event packs — wiring, valid-shape, gating, and purity.
 *
 * Covers the four stage packs (childhood/teen, parent, midlife, senior) added on
 * top of the existing event engine. They must:
 *  - all be spread into the master `eventTemplates` pool (so they roll through
 *    the normal weighted + pity pipeline — no new engine),
 *  - use a VALID category and yield at least one well-formed choice,
 *  - gate strictly via `condition` so each only fires in its own life stage
 *    (a childhood event must NOT fire at 40, a parent event needs a child, a
 *    senior event needs age >= 65),
 *  - keep `generate()` pure: deterministic in shape and free of state mutation.
 */
import type { GameState, ChildInfo } from '@/contexts/game/types';
import { createTestGameState } from '@/__tests__/helpers/createTestGameState';
import { eventTemplates, rollWeeklyEvents, type EventTemplate } from '@/lib/events/engine';
import { childhoodEventTemplates } from '@/lib/events/childhoodEvents';
import { parentEventTemplates } from '@/lib/events/parentEvents';
import { midlifeEventTemplates } from '@/lib/events/midlifeEvents';
import { seniorEventTemplates } from '@/lib/events/seniorEvents';

const VALID_CATEGORIES = new Set(['economy', 'health', 'relationship', 'general']);

const allPacks: Record<string, EventTemplate[]> = {
  childhood: childhoodEventTemplates,
  parent: parentEventTemplates,
  midlife: midlifeEventTemplates,
  senior: seniorEventTemplates,
};

const packEvents = Object.values(allPacks).flat();

function makeChild(overrides: Partial<ChildInfo> & { id: string; age: number }): ChildInfo {
  return {
    name: `Child ${overrides.id}`,
    type: 'child',
    relationshipScore: 60,
    personality: 'cheerful',
    gender: 'female',
    ...overrides,
  };
}

/** A state that satisfies every pack's condition so generate() always has data. */
function richState(): GameState {
  return createTestGameState({
    date: { year: 2025, month: 'January', week: 1, age: 70 },
    isRetired: true,
    currentJob: 'engineer',
    family: {
      children: [
        makeChild({ id: 'c-baby', age: 1 }),
        makeChild({ id: 'c-kid', age: 8 }),
        makeChild({ id: 'c-teen', age: 15 }),
        makeChild({ id: 'c-grown', age: 24 }),
      ],
    },
  });
}

describe('life-stage packs — wiring', () => {
  it('every pack event is registered in the master event pool', () => {
    for (const t of packEvents) {
      expect(eventTemplates.some(e => e.id === t.id)).toBe(true);
    }
  });

  it('all event ids across the packs are unique (no duplicates / collisions)', () => {
    const ids = packEvents.map(t => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    // And none collide with a pre-existing engine template of the same id.
    const poolCounts = new Map<string, number>();
    for (const e of eventTemplates) poolCounts.set(e.id, (poolCounts.get(e.id) ?? 0) + 1);
    for (const id of ids) expect(poolCounts.get(id)).toBe(1);
  });

  it('provides ~24-32 stage events with a healthy per-pack count', () => {
    expect(packEvents.length).toBeGreaterThanOrEqual(24);
    expect(packEvents.length).toBeLessThanOrEqual(32);
    for (const pack of Object.values(allPacks)) {
      expect(pack.length).toBeGreaterThanOrEqual(6);
    }
  });
});

describe('life-stage packs — valid shape', () => {
  it('each event has a valid category, sane weight, and generates >=1 well-formed choice', () => {
    const state = richState();
    for (const t of packEvents) {
      expect(VALID_CATEGORIES.has(t.category)).toBe(true);
      const w = typeof t.weight === 'function' ? t.weight(state) : t.weight;
      expect(typeof w).toBe('number');
      expect(w).toBeGreaterThan(0);

      const ev = t.generate(state);
      expect(ev.id).toBe(t.id);
      expect(Array.isArray(ev.choices)).toBe(true);
      expect(ev.choices.length).toBeGreaterThanOrEqual(1);
      for (const c of ev.choices) {
        expect(typeof c.id).toBe('string');
        expect(typeof c.text).toBe('string');
        expect(typeof c.effects).toBe('object');
      }
    }
  });

  it('choice effects stay in-band: |money| <= 400 and every stat delta within +/-25', () => {
    const state = richState();
    for (const t of packEvents) {
      for (const c of t.generate(state).choices) {
        if (typeof c.effects.money === 'number') {
          expect(Math.abs(c.effects.money)).toBeLessThanOrEqual(400);
        }
        for (const v of Object.values(c.effects.stats ?? {})) {
          expect(Math.abs(v as number)).toBeLessThanOrEqual(25);
        }
      }
    }
  });
});

describe('life-stage packs — gating', () => {
  it('childhood/teen events do NOT fire at age 40', () => {
    const adult = createTestGameState({ date: { year: 2025, month: 'January', week: 1, age: 40 } });
    for (const t of childhoodEventTemplates) {
      expect(t.condition ? t.condition(adult) : true).toBe(false);
    }
  });

  it('the re-banded early-teen events fire in 13-17 (reachable from a 16-start) but not below 13', () => {
    // Fix 7: the five formerly-childhood (5-12) templates were unreachable — no
    // start scenario begins below 16. They are now banded 13-17, so a 16-year-old
    // start reaches them, while a (currently impossible) age-10 state does not.
    const child10 = createTestGameState({ date: { year: 2025, month: 'January', week: 1, age: 10 } });
    const teen15 = createTestGameState({ date: { year: 2025, month: 'January', week: 1, age: 15 } });
    const teen16 = createTestGameState({ date: { year: 2025, month: 'January', week: 1, age: 16 } });
    const rebanded = ['child_show_and_tell', 'child_playground_friend', 'child_discover_talent', 'child_first_allowance', 'child_family_trip'];
    for (const id of rebanded) {
      const t = childhoodEventTemplates.find(e => e.id === id)!;
      expect(t.condition!(teen15)).toBe(true);
      expect(t.condition!(teen16)).toBe(true); // lowest realistic young start reaches these
      expect(t.condition!(child10)).toBe(false); // below the 13-17 band
    }
    // The original teen beats still gate on 13-17 as before.
    const firstCrush = childhoodEventTemplates.find(t => t.id === 'teen_first_crush')!;
    expect(firstCrush.condition!(teen15)).toBe(true);
    expect(firstCrush.condition!(child10)).toBe(false);
  });

  it('every pack is tagged with its life-stage (Fix 6 weighting hook)', () => {
    const expectTag = (pack: EventTemplate[], tag: string) => {
      for (const t of pack) expect(t.lifeStageTag).toBe(tag);
    };
    expectTag(childhoodEventTemplates, 'teen');
    expectTag(parentEventTemplates, 'parent');
    expectTag(midlifeEventTemplates, 'midlife');
    expectTag(seniorEventTemplates, 'senior');
  });

  it('parent events require a child in the right age band and bind relationId to that child', () => {
    const childless = createTestGameState({
      date: { year: 2025, month: 'January', week: 1, age: 35 },
      family: { children: [] },
    });
    for (const t of parentEventTemplates) {
      expect(t.condition ? t.condition(childless) : true).toBe(false);
    }

    const schoolPlay = parentEventTemplates.find(t => t.id === 'parent_school_play')!;
    const withKid = createTestGameState({
      date: { year: 2025, month: 'January', week: 1, age: 35 },
      family: { children: [makeChild({ id: 'kid-1', age: 8 })] },
      weeksLived: 42,
    });
    expect(schoolPlay.condition!(withKid)).toBe(true);
    const ev = schoolPlay.generate(withKid);
    expect(ev.relationId).toBe('kid-1'); // relationship deltas route to the child
    // A child that's too old for this band must not make it eligible.
    const withTeen = createTestGameState({
      date: { year: 2025, month: 'January', week: 1, age: 45 },
      family: { children: [makeChild({ id: 'kid-2', age: 16 })] },
    });
    expect(schoolPlay.condition!(withTeen)).toBe(false);
  });

  it('midlife events fire only in the 50-64 band', () => {
    const reflection = midlifeEventTemplates.find(t => t.id === 'midlife_reflection')!;
    const at45 = createTestGameState({ date: { year: 2025, month: 'January', week: 1, age: 45 } });
    const at55 = createTestGameState({ date: { year: 2025, month: 'January', week: 1, age: 55 } });
    const at70 = createTestGameState({ date: { year: 2025, month: 'January', week: 1, age: 70 } });
    expect(reflection.condition!(at45)).toBe(false);
    expect(reflection.condition!(at55)).toBe(true);
    expect(reflection.condition!(at70)).toBe(false);
  });

  it('senior events require age >= 65 (and grandchildren need a child; retirement needs isRetired)', () => {
    const at50 = createTestGameState({ date: { year: 2025, month: 'January', week: 1, age: 50 } });
    const at70 = createTestGameState({ date: { year: 2025, month: 'January', week: 1, age: 70 } });
    const wisdom = seniorEventTemplates.find(t => t.id === 'senior_wisdom_moment')!;
    expect(wisdom.condition!(at50)).toBe(false);
    expect(wisdom.condition!(at70)).toBe(true);

    // Grandchild milestone: age 70 alone is not enough — needs a child.
    const grandkid = seniorEventTemplates.find(t => t.id === 'senior_grandchild_milestone')!;
    expect(grandkid.condition!(at70)).toBe(false);
    const at70WithChild = createTestGameState({
      date: { year: 2025, month: 'January', week: 1, age: 70 },
      family: { children: [makeChild({ id: 'gk', age: 40 })] },
    });
    expect(grandkid.condition!(at70WithChild)).toBe(true);

    // Retirement-days beat keys off isRetired, not raw age.
    const retired = seniorEventTemplates.find(t => t.id === 'senior_retirement_days')!;
    expect(retired.condition!(createTestGameState({ isRetired: false }))).toBe(false);
    expect(retired.condition!(createTestGameState({ isRetired: true }))).toBe(true);
  });
});

describe('life-stage packs — selection weighting (Fix 6)', () => {
  // A senior (65+, retired, no children) so ONLY the senior pack is eligible among
  // the life-stage packs (grandchild needs a child; parent/midlife/teen gated out).
  function seniorState(weeksLived: number): GameState {
    return createTestGameState({
      weeksLived,
      lastEventWeeksLived: weeksLived - 30, // long drought → pity forces an event
      date: { year: 2025, month: 'January', week: 1, age: 70 },
      isRetired: true,
      family: { children: [] },
      stats: { health: 70, happiness: 70, energy: 70, fitness: 50, money: 5000, reputation: 50, gems: 0 },
    });
  }

  it('an age-gated pack actually surfaces during its chapter under a fixed seed', () => {
    // Deterministic sweep of pity-forced weeks. Without the 3.5x boost, six 0.2-weight
    // senior beats are buried under the ~150-template generic pool and essentially
    // never fire; the boost gives them real, repeated airtime.
    let seniorFires = 0;
    let totalFires = 0;
    const seniorIds = new Set<string>();
    for (let i = 0; i < 240; i++) {
      const events = rollWeeklyEvents(seniorState(3000 + i));
      for (const e of events) {
        totalFires++;
        const base = e.id.split('-')[0];
        if (base.startsWith('senior_')) {
          seniorFires++;
          seniorIds.add(e.id);
        }
      }
    }
    expect(totalFires).toBeGreaterThan(0);
    // Senior beats claim a meaningful share of fired events (boost-dependent) and
    // multiple DISTINCT senior templates surface (not one fixed rotation).
    expect(seniorFires / totalFires).toBeGreaterThanOrEqual(0.15);
    expect(seniorIds.size).toBeGreaterThanOrEqual(3);
  });

  it('the boost does not fire a pack outside its chapter (adult sees no life-stage beats)', () => {
    // A plain 30-year-old with no children: no teen/parent/midlife/senior event is
    // eligible, so the tag/boost is inert and none can surface.
    const seen = new Set<string>();
    for (let i = 0; i < 120; i++) {
      const adult = createTestGameState({
        weeksLived: 3000 + i,
        lastEventWeeksLived: 3000 + i - 30,
        date: { year: 2025, month: 'January', week: 1, age: 30 },
        family: { children: [] },
        stats: { health: 70, happiness: 70, energy: 70, fitness: 50, money: 5000, reputation: 50, gems: 0 },
      });
      for (const e of rollWeeklyEvents(adult)) seen.add(e.id.split('-')[0]);
    }
    for (const id of seen) {
      expect(id.startsWith('senior_')).toBe(false);
      expect(id.startsWith('midlife_')).toBe(false);
      expect(id.startsWith('parent_')).toBe(false);
      expect(id.startsWith('teen_')).toBe(false);
      expect(id.startsWith('child_')).toBe(false);
    }
  });
});

describe('life-stage packs — generate() purity', () => {
  it('is deterministic in shape (same state -> identical event) and never throws', () => {
    const state = richState();
    for (const t of packEvents) {
      const a = t.generate(state);
      const b = t.generate(state);
      expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    }
  });

  it('does not mutate the game state it is passed', () => {
    const state = richState();
    const before = JSON.stringify(state);
    for (const t of packEvents) t.generate(state);
    expect(JSON.stringify(state)).toBe(before);
  });
});
