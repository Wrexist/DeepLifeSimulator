/**
 * WAVE A — EducationApp class system + semester progression.
 *
 * Pins the previously-dead education mechanics finished in Wave A:
 *   - `mapClassIdsToEnrolled`: deterministic id -> EducationClass mapping, capped
 *     at MAX_CLASSES_PER_SEMESTER, filtered to the program's `availableIn`.
 *   - `computeSemesterNumber`: progress-derived, idempotent, pause/complete-safe.
 *   - `calculateStudentLoan`: now shares the ONE amortization implementation.
 */
import {
  mapClassIdsToEnrolled,
  computeSemesterNumber,
  calculateStudentLoan,
  CLASS_TEMPLATES,
  MAX_CLASSES_PER_SEMESTER,
  SEMESTER_LENGTH_WEEKS,
} from '../educationSystem';
import { calculatePeriodicPayment } from '@/lib/banking/amortization';

describe('mapClassIdsToEnrolled', () => {
  it('maps valid ids offered by the program to EducationClass[] (completed:false)', () => {
    // business_degree offers e.g. intro_writing + corporate_finance.
    const out = mapClassIdsToEnrolled('business_degree', ['intro_writing', 'corporate_finance']);
    expect(out).toHaveLength(2);
    expect(out.map((c) => c.id).sort()).toEqual(['corporate_finance', 'intro_writing']);
    for (const c of out) {
      expect(c.completed).toBe(false);
      const tpl = CLASS_TEMPLATES.find((t) => t.id === c.id)!;
      expect(c.statBonuses).toEqual(tpl.statBonuses);
      expect(c.difficulty).toBe(tpl.difficulty);
    }
  });

  it('drops ids not offered by the program (availableIn filter)', () => {
    // organic_chemistry is medical_school/phd only — not business_degree.
    const out = mapClassIdsToEnrolled('business_degree', ['organic_chemistry', 'intro_writing']);
    expect(out.map((c) => c.id)).toEqual(['intro_writing']);
  });

  it('dedupes repeated ids', () => {
    const out = mapClassIdsToEnrolled('business_degree', ['intro_writing', 'intro_writing']);
    expect(out).toHaveLength(1);
  });

  it('caps at MAX_CLASSES_PER_SEMESTER even when more valid ids are passed', () => {
    const businessClasses = CLASS_TEMPLATES.filter((c) => c.availableIn.includes('business_degree')).map((c) => c.id);
    expect(businessClasses.length).toBeGreaterThan(MAX_CLASSES_PER_SEMESTER);
    const out = mapClassIdsToEnrolled('business_degree', businessClasses);
    expect(out).toHaveLength(MAX_CLASSES_PER_SEMESTER);
  });

  it('returns [] for empty / unknown input (old behaviour preserved)', () => {
    expect(mapClassIdsToEnrolled('business_degree', [])).toEqual([]);
    expect(mapClassIdsToEnrolled('not_a_program', ['intro_writing'])).toEqual([]);
  });

  it('is deterministic - same input yields identical output (StrictMode-safe)', () => {
    const a = mapClassIdsToEnrolled('law_school', ['constitutional_law', 'moot_court']);
    const b = mapClassIdsToEnrolled('law_school', ['constitutional_law', 'moot_court']);
    expect(a).toEqual(b);
  });
});

describe('computeSemesterNumber', () => {
  it('is 1 at the start of a program', () => {
    expect(computeSemesterNumber(104, 104)).toBe(1);
  });

  it('advances by one each SEMESTER_LENGTH_WEEKS of progress', () => {
    // 104-week program, 26-week semesters.
    expect(computeSemesterNumber(104, 104 - SEMESTER_LENGTH_WEEKS)).toBe(2); // 26 elapsed
    expect(computeSemesterNumber(104, 104 - 2 * SEMESTER_LENGTH_WEEKS)).toBe(3); // 52 elapsed
    expect(computeSemesterNumber(104, 104 - 3 * SEMESTER_LENGTH_WEEKS)).toBe(4); // 78 elapsed
  });

  it('freezes at the final semester on completion (never exceeds ceil(duration/26))', () => {
    // At weeksRemaining 0 the raw floor(104/26)+1 = 5, capped to ceil(104/26) = 4.
    expect(computeSemesterNumber(104, 0)).toBe(4);
  });

  it('is idempotent - the SAME weeksRemaining always yields the SAME semester', () => {
    const w = 50;
    expect(computeSemesterNumber(104, w)).toBe(computeSemesterNumber(104, w));
  });

  it('never returns below 1 and tolerates undefined weeksRemaining', () => {
    expect(computeSemesterNumber(52, undefined)).toBe(1);
    expect(computeSemesterNumber(1, 0)).toBe(1);
  });
});

describe('calculateStudentLoan (unified amortization)', () => {
  it('uses the shared calculatePeriodicPayment (ceil-rounded)', () => {
    const offer = calculateStudentLoan(50_000);
    const expected = Math.ceil(calculatePeriodicPayment(50_000, 0.045, 260));
    expect(offer.weeklyPayment).toBe(expected);
    expect(offer.amount).toBe(50_000);
    expect(offer.interestRate).toBeCloseTo(0.045, 5);
    expect(offer.termWeeks).toBe(260);
  });

  it('$0 tuition produces a $0 weekly payment (no NaN)', () => {
    const offer = calculateStudentLoan(0);
    expect(offer.weeklyPayment).toBe(0);
    expect(Number.isFinite(offer.weeklyPayment)).toBe(true);
  });

  it('total repaid stays between 1x and 2x principal', () => {
    const offer = calculateStudentLoan(50_000);
    const total = offer.weeklyPayment * offer.termWeeks;
    expect(total).toBeGreaterThan(offer.amount);
    expect(total).toBeLessThan(offer.amount * 2);
  });
});
