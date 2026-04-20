import { maleFirstNames, femaleFirstNames, lastNames, generateRandomName } from '@/src/features/onboarding/nameData';

describe('name arrays', () => {
  it('male first names have no duplicates', () => {
    const unique = new Set(maleFirstNames);
    expect(unique.size).toBe(maleFirstNames.length);
  });

  it('female first names have no duplicates', () => {
    const unique = new Set(femaleFirstNames);
    expect(unique.size).toBe(femaleFirstNames.length);
  });

  it('last names have no duplicates', () => {
    const unique = new Set(lastNames);
    expect(unique.size).toBe(lastNames.length);
  });

  it('male and female arrays have equal length', () => {
    expect(maleFirstNames.length).toBe(femaleFirstNames.length);
  });

  it('all arrays have at least 80 entries', () => {
    expect(maleFirstNames.length).toBeGreaterThanOrEqual(80);
    expect(femaleFirstNames.length).toBeGreaterThanOrEqual(80);
    expect(lastNames.length).toBeGreaterThanOrEqual(80);
  });
});

describe('generateRandomName', () => {
  it('returns a first and last name for male', () => {
    const result = generateRandomName('male');
    expect(result.firstName).toBeTruthy();
    expect(result.lastName).toBeTruthy();
    expect(maleFirstNames).toContain(result.firstName);
    expect(lastNames).toContain(result.lastName);
  });

  it('returns a first and last name for female', () => {
    const result = generateRandomName('female');
    expect(result.firstName).toBeTruthy();
    expect(result.lastName).toBeTruthy();
    expect(femaleFirstNames).toContain(result.firstName);
    expect(lastNames).toContain(result.lastName);
  });

  it('returns a valid name for random sex', () => {
    const result = generateRandomName('random');
    expect(result.firstName).toBeTruthy();
    expect(result.lastName).toBeTruthy();
    const allFirstNames = [...maleFirstNames, ...femaleFirstNames];
    expect(allFirstNames).toContain(result.firstName);
    expect(lastNames).toContain(result.lastName);
  });

  it('defaults to random when no argument given', () => {
    const result = generateRandomName();
    expect(result.firstName).toBeTruthy();
    expect(result.lastName).toBeTruthy();
  });
});
