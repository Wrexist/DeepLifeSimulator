/**
 * LIFE-16 (owner decision 2026-10-22): PhD needs a Master's, Medical School
 * and Law School need a Bachelor's. Before this a dropout could enrol straight
 * into a doctorate.
 */
import { quoteEnrollment, enrollInProgram } from '@/contexts/game/actions/EducationActions';
import { createTestGameState } from '@/__tests__/helpers/createTestGameState';
import {
  EDUCATION_PROGRAMS,
  EDUCATION_PREREQUISITES,
  getEducationProgram,
  unmetEducationPrerequisite,
} from '../programs';
import type { Education, GameState } from '@/contexts/game/types';

const done = (id: string): Education => {
  const p = getEducationProgram(id)!;
  return { id, name: p.name, description: p.description, cost: p.cost, duration: p.duration, completed: true };
};
const withEducations = (educations: Education[]) =>
  createTestGameState({ stats: { ...createTestGameState().stats, money: 1_000_000 }, educations });
const template = (id: string) => getEducationProgram(id)!;

describe('LIFE-16: education prerequisites', () => {
  it('every prerequisite names real programmes', () => {
    const ids = new Set(EDUCATION_PROGRAMS.map((p) => p.id));
    for (const [id, req] of Object.entries(EDUCATION_PREREQUISITES)) {
      expect(ids.has(id)).toBe(true);
      req.anyOf.forEach((r) => expect(ids.has(r)).toBe(true));
    }
  });

  it.each(['medical_school', 'law_school'])('%s needs a completed Bachelor\'s', (id) => {
    expect(quoteEnrollment(withEducations([]), template(id)).blockedReason).toBe("Requires a Bachelor's degree.");
    const enrolledOnly = { ...done('business_degree'), completed: false };
    expect(quoteEnrollment(withEducations([enrolledOnly]), template(id)).blockedReason).toBeDefined();
    expect(quoteEnrollment(withEducations([done('computer_science')]), template(id)).blockedReason).toBeUndefined();
  });

  it("PhD needs a Master's or an MBA; a Bachelor's is not enough", () => {
    expect(quoteEnrollment(withEducations([done('business_degree')]), template('phd')).blockedReason)
      .toMatch(/Master's/);
    expect(quoteEnrollment(withEducations([done('masters_degree')]), template('phd')).blockedReason).toBeUndefined();
    expect(quoteEnrollment(withEducations([done('mba')]), template('phd')).blockedReason).toBeUndefined();
  });

  it('programmes without a prerequisite stay open', () => {
    for (const p of EDUCATION_PROGRAMS) {
      if (EDUCATION_PREREQUISITES[p.id]) continue;
      expect(unmetEducationPrerequisite(p.id, [])).toBeUndefined();
    }
  });

  it('enrolInProgram refuses inside the updater, charging nothing', () => {
    let state: GameState = withEducations([]);
    const before = state;
    const t = template('medical_school');
    enrollInProgram(
      (u) => { state = typeof u === 'function' ? u(state) : u; },
      { templateId: t.id, name: t.name, description: t.description, cost: t.cost, duration: t.duration, mode: 'cash' },
    );
    expect(state).toBe(before);
  });
});
