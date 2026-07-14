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
import { eventTemplates, type EventTemplate } from '@/lib/events/engine';
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

  it('a childhood event fires for a young child but not a teen, and vice-versa', () => {
    const child10 = createTestGameState({ date: { year: 2025, month: 'January', week: 1, age: 10 } });
    const teen15 = createTestGameState({ date: { year: 2025, month: 'January', week: 1, age: 15 } });
    const showAndTell = childhoodEventTemplates.find(t => t.id === 'child_show_and_tell')!;
    const firstCrush = childhoodEventTemplates.find(t => t.id === 'teen_first_crush')!;
    expect(showAndTell.condition!(child10)).toBe(true);
    expect(showAndTell.condition!(teen15)).toBe(false); // 15 is past the 5-12 child band
    expect(firstCrush.condition!(teen15)).toBe(true);
    expect(firstCrush.condition!(child10)).toBe(false); // 10 is below the 13-17 teen band
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
