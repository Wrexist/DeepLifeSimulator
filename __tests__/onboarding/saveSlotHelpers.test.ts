import {
  hasSaveStateShape,
  hasMeaningfulSaveData,
  summarizeSaveForMenu,
} from '@/src/features/onboarding/saveSlotHelpers';

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

describe('summarizeSaveForMenu', () => {
  it('maps core stats from a populated save', () => {
    const summary = summarizeSaveForMenu({
      weeksLived: 100,
      stats: { money: 12450, happiness: 78, gems: 245 },
      date: { age: 24 },
      userProfile: { firstName: 'Alex' },
      unlockedLifeSkills: new Array(64).fill('skill'),
    });
    expect(summary.name).toBe('Alex');
    expect(summary.level).toBe(24); // level == age
    expect(summary.gems).toBe(245);
    expect(summary.happiness).toBe(78);
    expect(summary.skills).toBe(64);
    expect(summary.cash).toBe(12450);
    expect(summary.day).toBe(700); // weeksLived * 7
  });

  it('derives XP as progress through the current life-year', () => {
    // 100 weeks = 1 full year + 48 weeks into the second.
    const summary = summarizeSaveForMenu({ weeksLived: 100, userProfile: {}, stats: {}, date: { age: 19 } });
    expect(summary.xpCurrent).toBe(48);
    expect(summary.xpMax).toBe(52);
    expect(summary.xpProgress).toBeCloseTo(48 / 52);
  });

  it('falls back to full name, then career title, then "Player"', () => {
    expect(summarizeSaveForMenu({ userProfile: { firstName: 'Sam', lastName: 'Lee' } }).name).toBe('Sam Lee');
    expect(
      summarizeSaveForMenu({
        userProfile: {},
        career: { level: 2, levels: [{ name: 'Intern' }, { name: 'Analyst' }, { name: 'CEO' }] },
      }).name
    ).toBe('CEO');
    expect(summarizeSaveForMenu({ userProfile: {} }).name).toBe('Player');
  });

  it('is safe on an empty/degenerate save', () => {
    const summary = summarizeSaveForMenu({});
    expect(summary.name).toBe('Player');
    expect(summary.level).toBe(18); // default starting age
    expect(summary.gems).toBe(0);
    expect(summary.skills).toBe(0);
    expect(summary.cash).toBe(0);
    expect(summary.day).toBe(0);
    expect(summary.xpProgress).toBe(0);
  });
});
