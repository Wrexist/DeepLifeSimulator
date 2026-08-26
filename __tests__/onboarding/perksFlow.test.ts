import {
  sortPerksByUnlockStatus,
  isPerkUnlocked,
  isPerkLocked,
  isPerkPermanent,
  getPerkBenefits,
  getStatColor,
  type PerkDefinition,
} from '@/src/features/onboarding/perksFlow';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const makePerk = (overrides: Partial<PerkDefinition> = {}): PerkDefinition => ({
  id: 'test_perk',
  title: 'Test Perk',
  description: 'A test perk',
  effects: {},
  rarity: 'Rare',
  requirement: 'Test requirement',
  icon: null,
  ...overrides,
});

const unlockedPerk = makePerk({ id: 'free', rarity: 'Uncommon' });
const lockedPerk = makePerk({ id: 'locked', rarity: 'Epic', unlock: { type: 'achievement', achievementId: 'ach_1' } });
const permanentPerk = makePerk({ id: 'perm', rarity: 'Legendary', unlock: { type: 'achievement', achievementId: 'ach_2' } });
const completedPerk = makePerk({ id: 'done', rarity: 'Rare', unlock: { type: 'achievement', achievementId: 'ach_3' } });

// The gate now takes the ids the player has actually EARNED, from
// `getSatisfiedAchievementIds`. `ach_1` is deliberately absent: unearned.
const earned = ['ach_3'];

// ---------------------------------------------------------------------------
// sortPerksByUnlockStatus
// ---------------------------------------------------------------------------

describe('sortPerksByUnlockStatus', () => {
  it('puts unlocked perks before locked perks', () => {
    const sorted = sortPerksByUnlockStatus([lockedPerk, unlockedPerk], [], earned);
    expect(sorted[0].id).toBe('free');
    expect(sorted[1].id).toBe('locked');
  });

  it('sorts by rarity within unlock groups', () => {
    const rare = makePerk({ id: 'r', rarity: 'Rare' });
    const epic = makePerk({ id: 'e', rarity: 'Epic' });
    const uncommon = makePerk({ id: 'u', rarity: 'Uncommon' });
    const sorted = sortPerksByUnlockStatus([epic, rare, uncommon], [], []);
    expect(sorted.map((p) => p.id)).toEqual(['u', 'r', 'e']);
  });

  it('treats permanent perks as unlocked', () => {
    const sorted = sortPerksByUnlockStatus([lockedPerk, permanentPerk], ['perm'], earned);
    expect(sorted[0].id).toBe('perm');
  });

  it('treats completed achievements as unlocked', () => {
    const sorted = sortPerksByUnlockStatus([lockedPerk, completedPerk], [], earned);
    expect(sorted[0].id).toBe('done');
  });
});

// ---------------------------------------------------------------------------
// isPerkUnlocked / isPerkLocked / isPerkPermanent
// ---------------------------------------------------------------------------

describe('isPerkUnlocked', () => {
  it('returns true when perk has no unlock requirement', () => {
    expect(isPerkUnlocked(unlockedPerk, [], [])).toBe(true);
  });

  it('returns true when perk is permanent', () => {
    expect(isPerkUnlocked(permanentPerk, ['perm'], [])).toBe(true);
  });

  it('returns true when achievement is completed', () => {
    expect(isPerkUnlocked(completedPerk, [], earned)).toBe(true);
  });

  it('returns false when achievement is incomplete', () => {
    expect(isPerkUnlocked(lockedPerk, [], earned)).toBe(false);
  });
});

describe('isPerkLocked', () => {
  it('is the inverse of isPerkUnlocked', () => {
    expect(isPerkLocked(unlockedPerk, [], [])).toBe(false);
    expect(isPerkLocked(lockedPerk, [], earned)).toBe(true);
  });
});

describe('isPerkPermanent', () => {
  it('returns true when perk ID is in permanent list', () => {
    expect(isPerkPermanent('perm', ['perm', 'other'])).toBe(true);
  });

  it('returns false when perk ID is not in permanent list', () => {
    expect(isPerkPermanent('free', ['perm'])).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// getPerkBenefits
// ---------------------------------------------------------------------------

describe('getPerkBenefits', () => {
  it('maps stat boosts to benefits', () => {
    const perk = makePerk({ effects: { statBoosts: { health: 20, energy: 10 } } });
    const benefits = getPerkBenefits(perk);
    expect(benefits).toEqual([
      { stat: 'health', value: 20, type: 'stat' },
      { stat: 'energy', value: 10, type: 'stat' },
    ]);
  });

  it('maps money boost to Starting Money type', () => {
    const perk = makePerk({ effects: { statBoosts: { money: 5000 } } });
    const benefits = getPerkBenefits(perk);
    expect(benefits).toEqual([{ stat: 'Starting Money', value: 5000, type: 'start' }]);
  });

  it('maps income multiplier to Income Boost', () => {
    const perk = makePerk({ effects: { incomeMultiplier: 1.07 } });
    const benefits = getPerkBenefits(perk);
    expect(benefits).toEqual([{ stat: 'Income Boost', value: 7, type: 'income' }]);
  });

  it('returns empty for no effects', () => {
    expect(getPerkBenefits(makePerk())).toEqual([]);
  });

  it('ignores income multiplier of 1 or less', () => {
    const perk = makePerk({ effects: { incomeMultiplier: 1.0 } });
    expect(getPerkBenefits(perk)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// getStatColor
// ---------------------------------------------------------------------------

describe('getStatColor', () => {
  // These read the HUD's pairings via lib/config/statIdentity (2026-08-25).
  // They used to assert this function's OWN table, which had happiness RED and
  // energy AMBER - the HUD's colours on the wrong stats, shown on the perk
  // cards seconds before the player meets the HUD itself.
  it('returns the HUD yellow for happiness', () => expect(getStatColor('happiness')).toBe('#F59E0B'));
  it('returns the HUD blue for energy', () => expect(getStatColor('energy')).toBe('#3B82F6'));
  it('returns the HUD red for health', () => expect(getStatColor('health')).toBe('#EF4444'));
  it('keeps the perk-card labels that are not stats', () => {
    expect(getStatColor('Starting Money')).toBe('#F7931A');
    expect(getStatColor('Income Boost')).toBe('#10B981');
  });
  it('falls back to grey for anything unknown', () =>
    // slate-500 - the app's one neutral ramp (the old value was Tailwind
    // gray-500, part of a second undocumented ramp normalized away 2026-08-25)
    expect(getStatColor('not_a_stat')).toBe('#64748B'));
});
