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
import { isEntryTierCareer } from '../jobMarket';

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

  // ── ECO-6 (2026-10-22): every catalogue entry, not a hand-picked list ──────
  //
  // The tests above named 7 ungated and 8 gated careers, so when the ungated
  // ladders were raised nobody noticed the masters tier fall below them:
  // therapist and vet topped at $850, architect at $1,300, and the fitness-
  // gated military/firefighter sat under the free chef. These walk the whole
  // catalogue so a ladder added or retuned later is checked by construction.

  type Req = NonNullable<Career['requirements']>;
  const reqOf = (c: Career): Req => c.requirements ?? {};
  const hasEducation = (c: Career) => {
    const r = reqOf(c);
    return 'education' in r && Array.isArray(r.education) && r.education.length > 0;
  };
  const hasStatOrItemGate = (c: Career) => {
    const r = reqOf(c);
    return (
      ('items' in r && Array.isArray(r.items) && r.items.length > 0) ||
      ('fitness' in r && typeof r.fitness === 'number' && r.fitness > 0) ||
      ('reputation' in r && typeof r.reputation === 'number' && r.reputation > 0)
    );
  };
  /**
   * Free to walk into. The musician is the one deliberate exception (best
   * ceiling in the tier, paid for in tenure - pinned by its own test above).
   */
  const FREE = INITIAL_CAREERS.filter((c) => !hasEducation(c) && !hasStatOrItemGate(c) && c.id !== 'musician');
  const top = (c: Career) => c.levels[c.levels.length - 1].salary;
  const bestFree = Math.max(...FREE.map(top));

  it('every education-gated ladder in the catalogue out-earns every free one', () => {
    expect(FREE.length).toBeGreaterThanOrEqual(7);
    const gated = INITIAL_CAREERS.filter(hasEducation);
    expect(gated.length).toBeGreaterThanOrEqual(15);
    expect(gated.filter((c) => top(c) <= bestFree).map((c) => `${c.id} ${top(c)}`)).toEqual([]);
  });

  it('every item- or stat-gated ladder out-earns every free one too', () => {
    // military (fitness 50) and firefighter (fitness 55) sat at $500/$550,
    // below the free chef's $805: a gym bar that bought a pay cut.
    const gated = INITIAL_CAREERS.filter((c) => !hasEducation(c) && hasStatOrItemGate(c));
    expect(gated.map((c) => c.id)).toEqual(expect.arrayContaining(['military', 'firefighter', 'real_estate_agent']));
    expect(gated.filter((c) => top(c) <= bestFree).map((c) => `${c.id} ${top(c)}`)).toEqual([]);
  });

  it('the $90k masters tier out-earns every ladder that needs no degree but a phone or a laptop', () => {
    const itemOnly = INITIAL_CAREERS.filter((c) => !hasEducation(c) && hasStatOrItemGate(c) && !('fitness' in reqOf(c)) && !('reputation' in reqOf(c)));
    const bestItemOnly = Math.max(...itemOnly.map(top));
    const masters = INITIAL_CAREERS.filter((c) => {
      const r = reqOf(c);
      return 'education' in r && Array.isArray(r.education) && r.education.includes('masters_degree');
    });
    expect(masters.map((c) => c.id)).toEqual(expect.arrayContaining(['therapist', 'veterinarian', 'architect']));
    expect(masters.filter((c) => top(c) <= bestItemOnly).map((c) => `${c.id} ${top(c)}`)).toEqual([]);
    expect(ceiling('therapist')).toBe(1600);
    expect(ceiling('veterinarian')).toBe(1600);
    expect(byId('therapist').levels[0].salary).toBe(250);
    expect(byId('veterinarian').levels[0].salary).toBe(250);
    expect(byId('architect').levels[0].salary).toBe(350);
    expect(ceiling('architect')).toBe(2200);
  });

  it('no two careers behind the SAME requirements where one pays at least as much on every rung', () => {
    // Same gate, worse ladder = a career nobody should ever take. Journalist
    // vs pilot (both a business degree) was exactly this: the pilot paid at
    // least as much on all six rungs. The entry tier is excluded here: its
    // ladders are told apart by hiring bar, weekly toll and pace as well as
    // pay, and `jobMarket.test.ts` checks dominance on all of those at once.
    const nonEntry = INITIAL_CAREERS.filter((c) => !isEntryTierCareer(c.id));
    const key = (c: Career) => JSON.stringify(reqOf(c), Object.keys(reqOf(c)).sort());
    const dominated: string[] = [];
    for (const a of nonEntry) {
      for (const b of nonEntry) {
        if (a.id === b.id || key(a) !== key(b) || a.levels.length !== b.levels.length) continue;
        if (a.levels.every((lvl, i) => lvl.salary >= b.levels[i].salary)) dominated.push(`${a.id} >= ${b.id}`);
      }
    }
    expect(dominated).toEqual([]);
  });

  it('and it no longer claims offices you can only win at an election', () => {
    const names = byId('politician').levels.map((l) => l.name.toLowerCase());
    for (const office of ['mayor', 'governor', 'city council member']) {
      expect(names).not.toContain(office);
    }
  });
});
