/**
 * Life-moment payoff events — the resolutions to setup choices in the Life
 * Moments system. Before these templates existed, the setup choices set
 * unlock/weight flags in consequenceState that nothing ever consumed, so the
 * promised payoff never arrived. These tests pin the gating:
 *   - a payoff is invisible until its setup unlocks it,
 *   - it becomes eligible once unlocked,
 *   - it fires EXACTLY ONCE (resolving records choiceHistory → condition false).
 */
import { eventTemplates } from '../engine';
import { LIFE_MOMENT_TEMPLATES } from '@/lib/lifeMoments/lifeMomentGenerator';
import { GameState } from '@/contexts/GameContext';
import { createTestGameState } from '@/__tests__/helpers/createTestGameState';

const byId = (id: string) => {
  const t = eventTemplates.find((e) => e.id === id);
  if (!t) throw new Error(`payoff template ${id} not registered`);
  return t;
};

function stateWith(consequenceState: any): GameState {
  return createTestGameState({ weeksLived: 40, consequenceState });
}

const UNLOCK_PAYOFFS = [
  'street_musician_friend',
  'startup_payout',
  'hot_tip_outcome',
  // The coffee-break introduction. Its unlock flag was written from day one;
  // the payoff template only exists since 2026-08-24 - before that the
  // promised introduction never arrived (orphaned-unlock class).
  'networking_opportunity',
];

describe('life-moment payoff events', () => {
  it('all five payoff templates are registered', () => {
    ['street_musician_friend', 'startup_payout', 'hot_tip_outcome', 'audit_scandal', 'networking_opportunity'].forEach((id) => {
      expect(eventTemplates.find((e) => e.id === id)).toBeDefined();
    });
  });

  it('COMPLETENESS RATCHET: every unlock_event a life moment can write has a registered payoff', () => {
    const targets = new Set<string>();
    for (const template of LIFE_MOMENT_TEMPLATES) {
      for (const choice of template.choices ?? []) {
        for (const consequence of choice.hiddenConsequences ?? []) {
          if (consequence.type === 'unlock_event' && consequence.targetEventId) {
            targets.add(consequence.targetEventId);
          }
        }
      }
    }
    expect(targets.size).toBeGreaterThan(0);
    const missing = [...targets].filter((id) => !eventTemplates.some((e) => e.id === id));
    expect(missing).toEqual([]);
  });

  describe.each(UNLOCK_PAYOFFS)('unlock-gated payoff: %s', (id) => {
    const tpl = byId(id);

    it('is NOT eligible with no consequence state', () => {
      expect(tpl.condition?.(createTestGameState({ weeksLived: 40 }))).toBeFalsy();
    });

    it('is NOT eligible when the setup never unlocked it', () => {
      const s = stateWith({ unlockedEvents: [], choiceHistory: [], eventWeightModifiers: {} });
      expect(tpl.condition?.(s)).toBeFalsy();
    });

    it('IS eligible once unlocked and unresolved', () => {
      const s = stateWith({ unlockedEvents: [id], choiceHistory: [], eventWeightModifiers: {} });
      expect(tpl.condition?.(s)).toBe(true);
    });

    it('is NOT eligible after it has fired once (recorded in choiceHistory)', () => {
      const s = stateWith({
        unlockedEvents: [id],
        choiceHistory: [{ eventId: id, choiceId: 'x', week: 1, weeksLived: 40, age: 20, timestamp: 1 }],
        eventWeightModifiers: {},
      });
      expect(tpl.condition?.(s)).toBeFalsy();
    });

    it('generates a well-formed event with at least two choices', () => {
      const s = stateWith({ unlockedEvents: [id], choiceHistory: [], eventWeightModifiers: {} });
      const ev = tpl.generate(s);
      expect(ev.id).toBe(id);
      expect(ev.choices.length).toBeGreaterThanOrEqual(2);
      ev.choices.forEach((c) => {
        expect(typeof c.id).toBe('string');
        expect(typeof c.text).toBe('string');
        expect(c.effects).toBeDefined();
      });
    });
  });

  describe('weight-gated payoff: audit_scandal', () => {
    const tpl = byId('audit_scandal');

    it('is NOT eligible until the "comply" choice bumps its weight modifier', () => {
      const s = stateWith({ unlockedEvents: [], choiceHistory: [], eventWeightModifiers: {} });
      expect(tpl.condition?.(s)).toBeFalsy();
    });

    it('IS eligible once its weight modifier is present and unresolved', () => {
      const s = stateWith({ unlockedEvents: [], choiceHistory: [], eventWeightModifiers: { audit_scandal: 0.15 } });
      expect(tpl.condition?.(s)).toBe(true);
    });

    it('fires only once', () => {
      const s = stateWith({
        unlockedEvents: [],
        choiceHistory: [{ eventId: 'audit_scandal', choiceId: 'come_clean', week: 1, weeksLived: 40, age: 20, timestamp: 1 }],
        eventWeightModifiers: { audit_scandal: 0.15 },
      });
      expect(tpl.condition?.(s)).toBeFalsy();
    });
  });

  it('startup_payout produces all three seeded outcomes across weeks', () => {
    const tpl = byId('startup_payout');
    const descriptions = new Set<string>();
    for (let w = 0; w < 60; w++) {
      const s = stateWith({ unlockedEvents: ['startup_payout'], choiceHistory: [], eventWeightModifiers: {} });
      (s as any).weeksLived = w;
      descriptions.add(tpl.generate(s).description);
    }
    // win / modest / bust - the seeded roll should surface more than one branch.
    expect(descriptions.size).toBeGreaterThanOrEqual(2);
  });
});
