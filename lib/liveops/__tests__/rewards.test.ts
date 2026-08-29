import {
  MAX_EVENT_VALUE_GEMS,
  REWARD_CAPS,
  WEEKLY_BUDGET_GEMS,
  bundleValueInGems,
  entriesInWindow,
  fitsBudget,
  spentInWindow,
  validateRewards,
} from '../rewards';

const NOW = Date.parse('2026-06-15T12:00:00Z');
const DAY = 24 * 60 * 60 * 1000;

describe('per-event caps', () => {
  it('accepts a reward at the cap and refuses one past it', () => {
    expect(validateRewards([{ kind: 'gems', amount: REWARD_CAPS.gems }])).toEqual([]);
    expect(validateRewards([{ kind: 'gems', amount: REWARD_CAPS.gems + 1 }])).toHaveLength(1);
  });

  it('refuses two entries of one currency, which would double its cap', () => {
    const problems = validateRewards([
      { kind: 'gems', amount: 300 },
      { kind: 'gems', amount: 300 },
    ]);
    expect(problems.some((p) => p.includes('duplicate'))).toBe(true);
  });

  it('caps the COMBINED value, so an event cannot max every currency at once', () => {
    const everything = [
      { kind: 'gems' as const, amount: REWARD_CAPS.gems },
      { kind: 'legacyPoints' as const, amount: REWARD_CAPS.legacyPoints },
      { kind: 'cash' as const, amount: REWARD_CAPS.cash },
    ];
    expect(bundleValueInGems(everything)).toBeGreaterThan(MAX_EVENT_VALUE_GEMS);
    expect(validateRewards(everything).some((p) => p.includes('total value'))).toBe(true);
  });

  it('refuses nonsense amounts rather than coercing them', () => {
    expect(validateRewards([{ kind: 'gems', amount: 0 }])).not.toEqual([]);
    expect(validateRewards([{ kind: 'gems', amount: -100 }])).not.toEqual([]);
    expect(validateRewards([{ kind: 'gems', amount: NaN }])).not.toEqual([]);
    expect(validateRewards([{ kind: 'gems', amount: 1.5 }])).not.toEqual([]);
  });

  it('refuses an unknown currency', () => {
    expect(validateRewards([{ kind: 'realMoney' as never, amount: 1 }])).not.toEqual([]);
  });

  it('refuses an event that pays nothing', () => {
    expect(validateRewards([])).toHaveLength(1);
  });

  it('prices CASH so it cannot dominate the budget', () => {
    // Flat and NOT net-worth-relative, on purpose: a relative reward compounds,
    // which is how the ad orb became a doubling machine before v35.
    const maxCash = bundleValueInGems([{ kind: 'cash', amount: REWARD_CAPS.cash }]);
    expect(maxCash).toBeLessThan(WEEKLY_BUDGET_GEMS / 2);
  });
});

describe('the rolling window', () => {
  it('keeps entries inside the last seven days and drops older ones', () => {
    const entries = [
      { at: NOW - 1 * DAY, value: 100 },
      { at: NOW - 8 * DAY, value: 500 },
    ];
    expect(entriesInWindow(entries, NOW)).toHaveLength(1);
    expect(spentInWindow(entries, NOW)).toBe(100);
  });

  it('KEEPS a future-stamped entry rather than refunding the budget', () => {
    // Dropping it would turn "move the clock forward, then back" into extra
    // payouts - the exploit shape five STATE_VERSION bumps exist to close.
    const entries = [{ at: NOW + 3 * DAY, value: 400 }];
    expect(spentInWindow(entries, NOW)).toBe(400);
  });

  it('ignores malformed entries instead of poisoning the total with NaN', () => {
    const entries = [
      { at: NaN, value: 100 },
      { at: NOW, value: NaN },
      { at: NOW, value: 50 },
    ];
    expect(Number.isFinite(spentInWindow(entries, NOW))).toBe(true);
    expect(spentInWindow(entries, NOW)).toBe(50);
  });
});

describe('fitsBudget', () => {
  it('allows a bundle that fits exactly', () => {
    const spent = [{ at: NOW, value: WEEKLY_BUDGET_GEMS - 200 }];
    expect(fitsBudget([{ kind: 'gems', amount: 200 }], spent, NOW)).toBe(true);
  });

  it('refuses one that overflows by a single gem', () => {
    const spent = [{ at: NOW, value: WEEKLY_BUDGET_GEMS - 200 }];
    expect(fitsBudget([{ kind: 'gems', amount: 201 }], spent, NOW)).toBe(false);
  });

  it('is all-or-nothing - it never reports a partial fit', () => {
    // Paying a fraction of an advertised number costs more trust than the gems
    // are worth, so the API has no way to express one.
    const spent = [{ at: NOW, value: WEEKLY_BUDGET_GEMS }];
    expect(fitsBudget([{ kind: 'gems', amount: 1 }], spent, NOW)).toBe(false);
  });
});
