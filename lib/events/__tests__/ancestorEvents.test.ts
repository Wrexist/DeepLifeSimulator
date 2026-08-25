/**
 * Ancestor events — the world remembering the player's own finished lives.
 *
 * Nothing in ~340 templates read `previousLives`, so a tenth generation met
 * the same world as a first character. This pack is the first content whose
 * text is written by the player's own history, which makes two properties
 * load-bearing: it must NEVER fire for a life with no ancestors, and it must
 * degrade rather than throw on a partial record off disk.
 */
import { createTestGameState } from '@/__tests__/helpers/createTestGameState';
import type { GameState } from '@/contexts/game/types';
import { ancestorEventTemplates } from '@/lib/events/ancestorEvents';
import { familyRecords } from '@/lib/legacy/records';

const life = (over: Record<string, unknown> = {}) => ({
  generation: 1,
  name: 'Ada Vance',
  netWorth: 4_200_000,
  ageAtDeath: 88,
  timestamp: 1,
  careerHistory: ['Shipping Magnate - 22 yrs'],
  ...over,
});

function withLives(count: number, over: Record<string, unknown> = {}): GameState {
  const lives = Array.from({ length: count }, (_, i) =>
    life({ generation: i + 1, name: `Gen${i + 1} Vance`, netWorth: (i + 1) * 1_000_000, ...over }),
  );
  return createTestGameState({ weeksLived: 500, lifeStartWeek: 0, previousLives: lives as never });
}

describe('the ancestor gate', () => {
  it('NOTHING in the pack is eligible in a first life', () => {
    for (const empty of [
      createTestGameState({ previousLives: [] }),
      createTestGameState({ previousLives: undefined }),
    ]) {
      for (const t of ancestorEventTemplates) {
        expect(t.condition?.(empty) ?? true).toBe(false);
      }
    }
  });

  it('opens up as the dynasty deepens', () => {
    const eligibleAt = (n: number) =>
      ancestorEventTemplates.filter((t) => t.condition?.(withLives(n)) ?? true).length;
    expect(eligibleAt(1)).toBeGreaterThan(0);
    expect(eligibleAt(3)).toBeGreaterThan(eligibleAt(1));
  });
});

describe('payloads', () => {
  it('name a real ancestor and are deterministic for a given week', () => {
    const state = withLives(3);
    for (const t of ancestorEventTemplates) {
      if (!(t.condition?.(state) ?? true)) continue;
      const first = t.generate(state);
      const second = t.generate(state);
      expect(second.description).toBe(first.description);
      expect(first.description.length).toBeGreaterThan(20);
      expect(first.choices.length).toBeGreaterThan(0);
      // Never leaks an undefined/empty substitution into player-facing copy.
      expect(first.description).not.toMatch(/undefined|NaN|\[object/);
    }
  });

  it('degrades to readable prose on a partial record rather than throwing', () => {
    // Records come off disk; a legacy or truncated entry has almost nothing.
    const bare = createTestGameState({
      weeksLived: 500,
      lifeStartWeek: 0,
      previousLives: [{ generation: 2 }, {}] as never,
    });
    for (const t of ancestorEventTemplates) {
      if (!(t.condition?.(bare) ?? true)) continue;
      const ev = t.generate(bare);
      expect(ev.description).not.toMatch(/undefined|NaN|\[object/);
    }
  });

  it('never throws on a malformed previousLives array', () => {
    const broken = createTestGameState({
      weeksLived: 500,
      lifeStartWeek: 0,
      previousLives: [null, undefined, { netWorth: Number.NaN }] as never,
    });
    for (const t of ancestorEventTemplates) {
      expect(() => {
        if (t.condition?.(broken) ?? true) t.generate(broken);
      }).not.toThrow();
    }
  });
});

describe('the record challenge quotes the records board', () => {
  it('names the same high-water life familyRecords ranks first', () => {
    const state = withLives(4);
    const template = ancestorEventTemplates.find((t) => t.id === 'ancestor_record_challenge')!;
    const richest = familyRecords(state).find((r) => r.id === 'richest');
    const ev = template.generate(state);
    // The board's holder is "Gen 4 · Gen4 Vance"; the event names the person.
    expect(richest?.bestHolder).toContain('Gen4 Vance');
    expect(ev.description).toContain('Gen4 Vance');
  });

  it('stays silent when no ancestor ever built anything', () => {
    const brokeLine = createTestGameState({
      weeksLived: 500,
      lifeStartWeek: 0,
      previousLives: [life({ netWorth: 0 })] as never,
    });
    const template = ancestorEventTemplates.find((t) => t.id === 'ancestor_record_challenge')!;
    expect(template.condition?.(brokeLine)).toBe(false);
  });
});

describe('fiction safety', () => {
  it('marks first-meeting beats oncePerLife so they cannot repeat', () => {
    for (const id of ['ancestor_letter', 'ancestor_graves']) {
      const t = ancestorEventTemplates.find((x) => x.id === id)!;
      expect(t.oncePerLife).toBe(true);
    }
  });

  it('every template id is unique and self-consistent with its payload', () => {
    const ids = ancestorEventTemplates.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    const state = withLives(3);
    for (const t of ancestorEventTemplates) {
      if (!(t.condition?.(state) ?? true)) continue;
      expect(t.generate(state).id).toBe(t.id);
    }
  });
});
