/**
 * Merit-scholarship GPA basis — 2026-08-25 economy audit.
 *
 * High School costs $0 and its GPA is freely farmable to 4.0, and
 * meritRate(4.0) = 80% off any later programme — so the free diploma quietly
 * discounted the $180k PhD to $36k, collapsing the education-cost axis.
 * `meritGpa` (the basis the enrolment quote now reads) counts PAID programmes
 * only; `highestGpa` is unchanged and still drives the hiring multiplier.
 */
import { highestGpa, meritGpa } from '../gpa';
import { meritRate } from '../scholarships';

const freeHS = { id: 'high_school', cost: 0, gpa: 4.0, completed: true };
const paidDegree = { id: 'business_degree', cost: 48_000, gpa: 3.2, completed: true };

describe('meritGpa', () => {
  it('ignores zero-cost programmes (the free High-School GPA farm)', () => {
    expect(meritGpa([freeHS])).toBe(0);
    expect(meritRate(meritGpa([freeHS]))).toBe(0);
  });

  it('counts paid programmes at their real GPA', () => {
    expect(meritGpa([freeHS, paidDegree])).toBe(3.2);
  });

  it('leaves the hiring basis (highestGpa) untouched', () => {
    expect(highestGpa([freeHS, paidDegree])).toBe(4.0);
  });

  it('is defensive against absent/garbage records', () => {
    expect(meritGpa([])).toBe(0);
    expect(meritGpa([{ id: 'x', cost: NaN as unknown as number, gpa: 4 } as never])).toBe(0);
  });
});
