import { applyYouthPill, YOUTH_PILL_AGE } from '@/lib/progress/youthPill';
import { createTestGameState } from '@/__tests__/helpers/createTestGameState';
import { getAge } from '@/lib/progress/lifeChapters';
import { isElder, getRetirementEligibility } from '@/lib/retirement/pension';

/**
 * CMP-10: the Youth Pill modal decremented with `Math.max(0, prev - 1)` and
 * reset the age unconditionally inside the updater, gating only on a selector
 * read outside it - so a same-batch double tap spent one pill and applied the
 * reset twice (the second for free on a 0 count). The re-check now lives in
 * the updater.
 */
describe('applyYouthPill', () => {
  it('spends one pill and resets the displayed age', () => {
    const base = createTestGameState();
    const prev = { ...base, youthPills: 2, date: { ...base.date, age: 64 } };
    const next = applyYouthPill(prev);
    expect(next.youthPills).toBe(1);
    expect(next.date.age).toBe(YOUTH_PILL_AGE);
  });

  it('refuses (returns prev unchanged) when there is no pill, so a double tap applies once', () => {
    const base = createTestGameState();
    const prev = { ...base, youthPills: 1, date: { ...base.date, age: 64 } };
    const once = applyYouthPill(prev);
    const twice = applyYouthPill(once);
    expect(twice).toBe(once);
    expect(twice.youthPills).toBe(0);

    const none = { ...base, youthPills: 0, date: { ...base.date, age: 64 } };
    expect(applyYouthPill(none)).toBe(none);
    expect(applyYouthPill(none).date.age).toBe(64);
  });
});

/**
 * CMP-11 (v57): the pill reset `date.age` only, while `getAge` - which the
 * Elder card, the pension, chapter age goals and the old-age events all read -
 * derives from `weeksLived` on every v43+ save. Home said 18 while the Elder
 * card beside it said 72 and offered retirement.
 */
describe('a Youth Pill makes every age reader agree (CMP-11)', () => {
  // A 72-year-old on a v43+ save: weeksLived seeded from age 18.
  const elder = () => {
    const base = createTestGameState();
    return {
      ...base,
      youthPills: 1,
      lifeStartWeek: 0,
      weeksLived: (72 - 18) * 52,
      date: { ...base.date, age: 72 },
    };
  };

  it('getAge reads 18 after the pill, the same as the HUD', () => {
    const before = elder();
    expect(getAge(before)).toBe(72);
    const after = applyYouthPill(before);
    expect(after.date.age).toBe(18);
    expect(getAge(after)).toBe(18);
    expect(after.ageOffsetWeeks).toBe(before.weeksLived);
  });

  it('the character ages normally from there', () => {
    const after = applyYouthPill(elder());
    const tenYearsOn = { ...after, weeksLived: after.weeksLived + 10 * 52 };
    expect(getAge(tenYearsOn)).toBe(28);
  });

  it('the Elder card and retirement read the same age: no retirement offer at 18', () => {
    const before = elder();
    expect(isElder(before)).toBe(true);
    const after = applyYouthPill(before);
    expect(isElder(after)).toBe(false);
    expect(getRetirementEligibility(after).canRetire).toBe(false);
    expect(getRetirementEligibility(after).age).toBe(18);
  });

  it('absent offset (every pre-v57 save) reads as 0, and a corrupt one cannot push the age below 18', () => {
    const plain = elder();
    expect(getAge(plain)).toBe(72);
    expect(getAge({ ...plain, ageOffsetWeeks: Number.NaN })).toBe(72);
    expect(getAge({ ...plain, ageOffsetWeeks: 10_000_000 })).toBe(18);
    expect(getAge({ ...plain, ageOffsetWeeks: -500 })).toBe(72);
  });

  it('a second pill resets to 18 from wherever the character is now', () => {
    const once = applyYouthPill(elder());
    const older = { ...once, youthPills: 1, weeksLived: once.weeksLived + 30 * 52 };
    expect(getAge(older)).toBe(48);
    const twice = applyYouthPill(older);
    expect(getAge(twice)).toBe(18);
  });
});
