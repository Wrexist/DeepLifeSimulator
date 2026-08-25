/**
 * A GATE has to buy something (2026-08-25 economy audit).
 *
 * The audit found the ladder tops ordered backwards against their entry cost:
 * a $48,000 business degree bought a $600/wk ceiling (teacher) while the FREE
 * musician reached $2,120 and a reputation-30 celebrity reached $4,600. Tuition
 * was the most expensive investment in the game and bought the worst ceiling,
 * so no degree-gated ladder was ever the rational pick and the education axis
 * of career choice was decorative.
 *
 * These tests pin the rule the rebalance established: what you had to pay or
 * qualify for must out-earn what you did not.
 */
import { INITIAL_CAREERS } from '../careerData';
import { EDUCATION_PROGRAMS } from '@/lib/education/programs';
import type { Career } from '@/contexts/game/types';
import { POLITICAL_CAREER } from '@/lib/careers/political';

const byId = (id: string): Career => {
  const c = INITIAL_CAREERS.find((x) => x.id === id);
  if (!c) throw new Error(`no career ${id}`);
  return c;
};
const ceiling = (id: string): number => {
  const levels = byId(id).levels;
  return levels[levels.length - 1].salary;
};
const tuition = (programId: string): number =>
  EDUCATION_PROGRAMS.find((p) => p.id === programId)?.cost ?? 0;

/** Careers anyone can walk into on day one. */
const UNGATED = ['fast_food', 'retail', 'janitor', 'farmer', 'chef', 'truck_driver', 'electrician'];

describe('the gate sets the ceiling', () => {
  it('every degree-gated ladder out-earns every ungated one', () => {
    const bestUngated = Math.max(...UNGATED.map(ceiling));
    for (const id of ['teacher', 'nurse', 'police', 'legal', 'accountant', 'bank', 'journalist', 'pilot']) {
      expect(ceiling(id)).toBeGreaterThan(bestUngated);
    }
  });

  it('a dearer programme opens a higher ceiling than a cheaper one', () => {
    // police_academy $12k < legal_studies $18k < business_degree $48k.
    expect(tuition('police_academy')).toBeLessThan(tuition('business_degree'));
    expect(ceiling('teacher')).toBeGreaterThan(ceiling('police'));
    expect(ceiling('nurse')).toBeGreaterThan(ceiling('police'));
  });

  it('the graduate tier still tops the cheap-degree tier', () => {
    // masters $90k / phd $180k must stay clearly ahead of the $48k ladders.
    for (const cheap of ['teacher', 'nurse', 'police', 'legal']) {
      expect(ceiling('software')).toBeGreaterThan(ceiling(cheap));
      expect(ceiling('doctor')).toBeGreaterThan(ceiling(cheap));
    }
  });

  it('the musician keeps the tier ceiling but pays for it in time', () => {
    // The bet stays available (best ceiling in the entry tier)...
    const bestOtherUngated = Math.max(...UNGATED.map(ceiling));
    expect(ceiling('musician')).toBeGreaterThan(bestOtherUngated);
    // ...but the top rungs are tenure-gated, which is what stops it being a
    // free lunch. Before this, the whole ladder had no experienceRequired.
    const gated = byId('musician').levels.filter((l) => (l.experienceRequired ?? 0) > 0);
    expect(gated.length).toBeGreaterThanOrEqual(3);
    // And the early rungs stay near minimum wage - the "worst wage" half of
    // the bet that the salary rescale had silently deleted.
    expect(byId('musician').levels[1].salary).toBeLessThan(150);
    expect(byId('musician').levels[2].salary).toBeLessThan(200);
  });

  it('the catalogue politician no longer out-earns the elected President', () => {
    // Two politician ladders coexist: this catalogue one (paid through payroll,
    // WITH the raise premium and boost stack) and the elections career, whose
    // President draws an annual figure / 52 with no premiums. The staffer used
    // to top at $3,400/wk against the President's ~$1,923 - the pretend job
    // out-earning the real one, with no election or scandal exposure.
    const presidentWeekly =
      POLITICAL_CAREER.levels[POLITICAL_CAREER.levels.length - 1].salary / 52;
    expect(ceiling('politician')).toBeLessThan(presidentWeekly);
  });

  it('and it no longer claims offices you can only win at an election', () => {
    const names = byId('politician').levels.map((l) => l.name.toLowerCase());
    for (const office of ['mayor', 'governor', 'city council member']) {
      expect(names).not.toContain(office);
    }
  });
});
