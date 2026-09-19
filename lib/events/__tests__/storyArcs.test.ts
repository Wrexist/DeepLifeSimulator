import { eventTemplates } from '@/lib/events/engine';
import { followUpFromChoice } from '@/lib/events/lifeEvents';
import { createTestGameState } from '../../../__tests__/helpers/createTestGameState';
import type { GameState, Relationship } from '@/contexts/game/types';

/**
 * MP11: three connected story arcs. Each is a setup (weighted, oncePerLife)
 * with two viable responses, each scheduling a weight-0 sequel that narrates
 * the delayed consequence and offers the aftermath decision.
 */
const ARCS: { base: string; sequels: string[]; delay: number }[] = [
  {
    base: 'work_stretch_project',
    sequels: ['stretch_project_result', 'stretch_project_passed'],
    delay: 4,
  },
  {
    base: 'family_plan_talk',
    sequels: ['family_plan_followthrough', 'family_plan_wait'],
    delay: 6,
  },
  {
    base: 'side_project_offer',
    sequels: ['side_project_result', 'side_project_elsewhere'],
    delay: 5,
  },
];

const byId = new Map(eventTemplates.map((t) => [t.id, t]));

const partner: Relationship = {
  id: 'p1',
  name: 'Alex',
  type: 'partner',
  relationshipScore: 70,
  personality: 'friendly',
  gender: 'female',
  age: 30,
};

/** A state that satisfies each setup's own gate, so reachability is provable. */
function reachable(baseId: string): GameState {
  const state = createTestGameState({ weeksLived: 200 });
  if (baseId === 'work_stretch_project') {
    const job = state.careers.find((c) => c.id !== 'political');
    return { ...state, currentJob: job?.id ?? 'street_performer' };
  }
  if (baseId === 'family_plan_talk') {
    return { ...state, relationships: [partner] };
  }
  return { ...state, stats: { ...state.stats, money: 5_000 } };
}

describe('MP11 story arcs are registered and reachable', () => {
  it('registers each setup once, with present weight-0 sequels', () => {
    for (const arc of ARCS) {
      const base = byId.get(arc.base);
      expect(base).toBeDefined();
      expect(base!.oncePerLife).toBe(true);
      expect(typeof base!.weight).toBe('number');
      expect(base!.weight as number).toBeGreaterThan(0);
      // Eligibility is a real gate, and the archetype state satisfies it.
      expect(base!.condition?.(reachable(arc.base))).toBe(true);
      for (const id of arc.sequels) {
        const sequel = byId.get(id);
        expect(sequel).toBeDefined();
        expect(sequel!.weight).toBe(0);
      }
    }
  });

  it('offers exactly two responses, each scheduling a registered sequel', () => {
    for (const arc of ARCS) {
      const base = byId.get(arc.base)!;
      const event = base.generate(reachable(arc.base));
      expect(event.choices).toHaveLength(2);
      const scheduled = event.choices.map((c) => c.followUpEventId);
      expect(new Set(scheduled).size).toBe(2);
      for (const choice of event.choices) {
        expect(byId.has(choice.followUpEventId!)).toBe(true);
        const pending = followUpFromChoice(base.id, choice, 100);
        expect(pending).toMatchObject({
          eventId: choice.followUpEventId,
          sourceEventId: base.id,
          triggerWeek: 100 + arc.delay,
        });
      }
    }
  });

  it('is replay-stable: the same life generates the same sequel payload', () => {
    for (const arc of ARCS) {
      const state = reachable(arc.base);
      for (const id of arc.sequels) {
        const sequels = byId.get(id)!;
        expect(sequels.generate(state)).toEqual(sequels.generate(state));
      }
    }
  });
});
