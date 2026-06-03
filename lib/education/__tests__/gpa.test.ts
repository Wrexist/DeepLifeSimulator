import {
  clampGpa,
  gpaBand,
  gpaBandLabel,
  gpaLetter,
  highestGpa,
  jobOfferMultiplier,
} from '../gpa';

describe('clampGpa', () => {
  it('keeps values in [0, 4]', () => {
    expect(clampGpa(-1)).toBe(0);
    expect(clampGpa(2.5)).toBe(2.5);
    expect(clampGpa(5)).toBe(4);
  });
  it('handles NaN defensively', () => {
    expect(clampGpa(NaN)).toBe(0);
  });
});

describe('gpaBand', () => {
  it.each([
    [0.5, 'failing'],
    [1.5, 'atRisk'],
    [2.5, 'average'],
    [3.2, 'solid'],
    [3.6, 'honors'],
    [4.0, 'topOfClass'],
  ] as const)('maps %s to %s', (gpa, band) => {
    expect(gpaBand(gpa)).toBe(band);
  });
});

describe('gpaBandLabel', () => {
  it('humanizes band names', () => {
    expect(gpaBandLabel('atRisk')).toBe('At Risk');
    expect(gpaBandLabel('topOfClass')).toBe('Top of Class');
  });
});

describe('gpaLetter', () => {
  it.each([
    [4.0, 'A'],
    [3.6, 'A-'],
    [3.3, 'B+'],
    [3.0, 'B'],
    [2.8, 'B-'],
    [2.4, 'C+'],
    [2.0, 'C'],
    [1.6, 'C-'],
    [1.0, 'D'],
    [0.5, 'F'],
  ] as const)('returns %s for GPA %f', (gpa, letter) => {
    expect(gpaLetter(gpa)).toBe(letter);
  });
});

describe('jobOfferMultiplier', () => {
  it('penalizes below 2.0', () => {
    expect(jobOfferMultiplier(1.5)).toBeLessThan(1);
  });
  it('returns 1.0 at exactly 2.0', () => {
    expect(jobOfferMultiplier(2.0)).toBe(1);
  });
  it('grows with GPA', () => {
    expect(jobOfferMultiplier(3.0)).toBeGreaterThan(jobOfferMultiplier(2.5));
    expect(jobOfferMultiplier(4.0)).toBeGreaterThan(jobOfferMultiplier(3.5));
  });
  it('caps near +30% at 4.0', () => {
    expect(jobOfferMultiplier(4.0)).toBeCloseTo(1.30, 2);
  });
});

describe('highestGpa', () => {
  it('returns 0 for empty input', () => {
    expect(highestGpa([])).toBe(0);
  });
  it('returns the max GPA across educations', () => {
    expect(highestGpa([{ gpa: 2.5 }, { gpa: 3.8 }, { gpa: 3.0 }])).toBe(3.8);
  });
  it('ignores undefined GPAs', () => {
    expect(highestGpa([{ gpa: undefined }, { gpa: 3.2 }])).toBe(3.2);
  });
});
