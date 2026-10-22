/**
 * Medical School opens the Doctor career (economy audit ECO-7, 2026-10-21).
 *
 * The programme's catalog line has always read "Doctor track", but the doctor
 * ladder accepted only a PhD, so $150k and 180 weeks of medical school led to
 * no doctor job (its only other reader, surgeon, also wants 60 reputation).
 * Careers are stored by value in the save, so the route also has to reach
 * existing saves - `repairGameState` adopts catalog `educationAnyOf` ids.
 */
import { INITIAL_CAREERS } from '@/lib/careers/careerData';
import { checkCareerRequirements } from '@/lib/careers/careerRequirements';
import { EDUCATION_PROGRAMS } from '@/lib/education/programs';
import { repairGameState } from '@/utils/saveValidation';
import { createTestGameState } from '../helpers/createTestGameState';
import type { GameState } from '@/contexts/game/types';

function stateWith(educationIds: string[]): GameState {
  const s = createTestGameState({});
  s.educations = educationIds.map((id) => ({
    id, name: id, description: '', cost: 1, duration: 1, completed: true,
  }));
  return s;
}

const doctor = INITIAL_CAREERS.find((c) => c.id === 'doctor')!;

describe('doctor education routes', () => {
  it('the catalog still calls medical school the doctor track', () => {
    expect(EDUCATION_PROGRAMS.find((p) => p.id === 'medical_school')?.description).toMatch(/doctor/i);
  });

  it('medical school alone satisfies the doctor gate', () => {
    expect(checkCareerRequirements(doctor.requirements, stateWith(['medical_school'])).met).toBe(true);
  });

  it('the PhD route still works', () => {
    expect(checkCareerRequirements(doctor.requirements, stateWith(['phd'])).met).toBe(true);
  });

  it('neither degree -> still gated', () => {
    expect(checkCareerRequirements(doctor.requirements, stateWith(['business_degree'])).met).toBe(false);
  });
});

describe('an existing save gains the route on load', () => {
  it('repairGameState adds medical_school to a stored doctor career that lacks it', () => {
    const s = stateWith(['medical_school']);
    s.careers = s.careers.map((c) =>
      c.id === 'doctor' ? { ...c, requirements: { education: ['phd'] } } : c,
    );
    const stored = s.careers.find((c) => c.id === 'doctor')!;
    expect(checkCareerRequirements(stored.requirements, s).met).toBe(false);

    const result = repairGameState(s);
    expect(result.repaired).toBe(true);
    const repairedDoctor = s.careers.find((c) => c.id === 'doctor')!;
    expect(checkCareerRequirements(repairedDoctor.requirements, s).met).toBe(true);
  });

  it('is idempotent once the route is present', () => {
    const s = stateWith([]);
    repairGameState(s);
    const again = repairGameState(s);
    expect(again.repairs.some((r) => r.includes('education route'))).toBe(false);
  });
});
