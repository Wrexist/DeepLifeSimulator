/**
 * A job taken before the first Next Week of an age-18 life is stamped
 * `startedWeeksLived: 0` (`JobActions` stamps `prev.weeksLived`, which is 0 for
 * that start). `getWeeksEmployed` used a truthiness check, so 0 read as "no
 * start recorded" and tenure stayed 0 forever: every tenure-gated workplace
 * event never fired for the tutorial's first job.
 */
import { careerEventTemplates } from '../careerEvents';
import { createTestGameState } from '@/__tests__/helpers/createTestGameState';

const officeParty = careerEventTemplates.find((t) => t.id === 'office_party')!;
const coworkerConflict = careerEventTemplates.find((t) => t.id === 'coworker_conflict')!;

function employed(startedWeeksLived: number | undefined, weeksLived: number) {
  return createTestGameState({
    currentJob: 'fast_food',
    weeksLived,
    careers: [
      {
        id: 'fast_food',
        accepted: true,
        level: 0,
        startedWeeksLived,
        levels: [{ name: 'Crew', salary: 100 }],
      } as never,
    ],
  });
}

describe('career tenure counts from week zero', () => {
  it('a job started at weeksLived 0 accrues tenure', () => {
    expect(officeParty.condition!(employed(0, 10))).toBe(true);
    expect(coworkerConflict.condition!(employed(0, 5))).toBe(true);
  });

  it('still waits for the tenure the event asks for', () => {
    expect(officeParty.condition!(employed(0, 7))).toBe(false);
  });

  it('treats a missing start as no tenure', () => {
    expect(officeParty.condition!(employed(undefined, 500))).toBe(false);
  });
});
