/**
 * Every choice whose effects are ROLLED at generation time must be marked
 * `outcomeHidden`, or the event screen previews the answer. Checked on the
 * templates the 2026-09-25 audit found spoiled, across many weeks so both
 * sides of each roll are seen.
 */
import { eventTemplates } from '../engine';
import { careerEventTemplates } from '../careerEvents';
import { createTestGameState } from '@/__tests__/helpers/createTestGameState';

const all = [...eventTemplates, ...careerEventTemplates];
const byId = (id: string) => all.find((t) => t.id === id)!;

describe('rolled outcomes are not previewed', () => {
  it.each([
    ['investment_tip', ['invest_big', 'invest_small']],
    ['speeding_ticket', ['contest']],
    ['parking_ticket', ['ignore']],
  ])('%s marks its gambles', (id, choiceIds) => {
    const template = byId(id);
    expect(template).toBeDefined();
    const state = createTestGameState({
      stats: { money: 100_000 },
      vehicles: [{ id: 'car', name: 'Car' } as never],
      activeVehicleId: 'car',
    });
    const event = template.generate(state);
    for (const cid of choiceIds) {
      expect(event.choices.find((c) => c.id === cid)?.outcomeHidden).toBe(true);
    }
  });
});
