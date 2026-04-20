import { hasSaveStateShape, hasMeaningfulSaveData } from '@/src/features/onboarding/saveSlotHelpers';

describe('hasSaveStateShape', () => {
  it('returns true for valid save shape with userProfile, stats, and date', () => {
    const state = {
      userProfile: { firstName: 'John', lastName: 'Doe' },
      stats: { money: 5000 },
      date: { age: 25, month: 'Jan' },
    };
    expect(hasSaveStateShape(state)).toBe(true);
  });

  it('returns false for null', () => {
    expect(hasSaveStateShape(null)).toBe(false);
  });

  it('returns false for undefined', () => {
    expect(hasSaveStateShape(undefined)).toBe(false);
  });

  it('returns false for non-object', () => {
    expect(hasSaveStateShape('string')).toBe(false);
    expect(hasSaveStateShape(42)).toBe(false);
  });

  it('returns false when userProfile is missing', () => {
    expect(hasSaveStateShape({ stats: { money: 0 }, date: { age: 18 } })).toBe(false);
  });

  it('returns false when stats is missing', () => {
    expect(hasSaveStateShape({ userProfile: { firstName: 'A' }, date: { age: 18 } })).toBe(false);
  });

  it('returns false when date is missing', () => {
    expect(hasSaveStateShape({ userProfile: { firstName: 'A' }, stats: { money: 0 } })).toBe(false);
  });

  it('returns false when userProfile is null', () => {
    expect(hasSaveStateShape({ userProfile: null, stats: {}, date: {} })).toBe(false);
  });

  it('returns false when stats is null', () => {
    expect(hasSaveStateShape({ userProfile: {}, stats: null, date: {} })).toBe(false);
  });

  it('returns false when date is null', () => {
    expect(hasSaveStateShape({ userProfile: {}, stats: {}, date: null })).toBe(false);
  });
});

describe('hasMeaningfulSaveData', () => {
  it('returns true when weeksLived is positive', () => {
    const state = { weeksLived: 10, userProfile: {} };
    expect(hasMeaningfulSaveData(state)).toBe(true);
  });

  it('returns true when money is positive', () => {
    const state = { stats: { money: 500 }, userProfile: {} };
    expect(hasMeaningfulSaveData(state)).toBe(true);
  });

  it('returns true when a completed achievement exists', () => {
    const state = { achievements: [{ completed: true }], userProfile: {} };
    expect(hasMeaningfulSaveData(state)).toBe(true);
  });

  it('returns true when relationships exist', () => {
    const state = { relationships: [{ name: 'Mom' }], userProfile: {} };
    expect(hasMeaningfulSaveData(state)).toBe(true);
  });

  it('returns true when owned items exist', () => {
    const state = { items: [{ owned: true }], userProfile: {} };
    expect(hasMeaningfulSaveData(state)).toBe(true);
  });

  it('returns true when firstName is set', () => {
    const state = { userProfile: { firstName: 'Jane' } };
    expect(hasMeaningfulSaveData(state)).toBe(true);
  });

  it('returns true when lastName is set', () => {
    const state = { userProfile: { lastName: 'Doe' } };
    expect(hasMeaningfulSaveData(state)).toBe(true);
  });

  it('returns false for empty state', () => {
    const state = { weeksLived: 0, stats: { money: 0 }, userProfile: {} };
    expect(hasMeaningfulSaveData(state)).toBe(false);
  });

  it('returns false when achievements exist but none completed', () => {
    const state = { achievements: [{ completed: false }], userProfile: {} };
    expect(hasMeaningfulSaveData(state)).toBe(false);
  });

  it('returns false when items exist but none owned', () => {
    const state = { items: [{ owned: false }], userProfile: {} };
    expect(hasMeaningfulSaveData(state)).toBe(false);
  });

  it('returns false for empty arrays', () => {
    const state = { relationships: [], achievements: [], items: [], userProfile: {} };
    expect(hasMeaningfulSaveData(state)).toBe(false);
  });
});
