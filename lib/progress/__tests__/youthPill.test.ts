import { applyYouthPill, YOUTH_PILL_AGE } from '@/lib/progress/youthPill';
import { createTestGameState } from '@/__tests__/helpers/createTestGameState';

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
    const prev = { ...base, youthPills: 2, date: { ...base.date, age: 64 }, userProfile: { ...base.userProfile, age: 64 } };
    const next = applyYouthPill(prev);
    expect(next.youthPills).toBe(1);
    expect(next.date.age).toBe(YOUTH_PILL_AGE);
    expect(next.userProfile.age).toBe(YOUTH_PILL_AGE);
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
