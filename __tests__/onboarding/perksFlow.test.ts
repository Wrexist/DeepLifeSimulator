import {
  sortPerksByUnlockStatus,
  isPerkUnlocked,
  isPerkLocked,
  isPerkPermanent,
  getPerkBenefits,
  getStatColor,
  getStatIconName,
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

const achievements = [
  { id: 'ach_3', completed: true },
  { id: 'ach_1', completed: false },
];

// ---------------------------------------------------------------------------
// sortPerksByUnlockStatus
// ---------------------------------------------------------------------------

describe('sortPerksByUnlockStatus', () => {
  it('puts unlocked perks before locked perks', () => {
    const sorted = sortPerksByUnlockStatus([lockedPerk, unlockedPerk], [], achievements);
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
    const sorted = sortPerksByUnlockStatus([lockedPerk, permanentPerk], ['perm'], achievements);
    expect(sorted[0].id).toBe('perm');
  });

  it('treats completed achievements as unlocked', () => {
    const sorted = sortPerksByUnlockStatus([lockedPerk, completedPerk], [], achievements);
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
    expect(isPerkUnlocked(completedPerk, [], achievements)).toBe(true);
  });

  it('returns false when achievement is incomplete', () => {
    expect(isPerkUnlocked(lockedPerk, [], achievements)).toBe(false);
  });
});

describe('isPerkLocked', () => {
  it('is the inverse of isPerkUnlocked', () => {
    expect(isPerkLocked(unlockedPerk, [], [])).toBe(false);
    expect(isPerkLocked(lockedPerk, [], achievements)).toBe(true);
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
// getStatColor / getStatIconName
// ---------------------------------------------------------------------------

describe('getStatColor', () => {
  it('returns red for happiness', () => expect(getStatColor('happiness')).toBe('#EF4444'));
  it('returns green for health', () => expect(getStatColor('health')).toBe('#10B981'));
  it('returns gray for unknown', () => expect(getStatColor('unknown')).toBe('#6B7280'));
});

describe('getStatIconName', () => {
  it('returns Heart for happiness', () => expect(getStatIconName('happiness')).toBe('Heart'));
  it('returns Shield for health', () => expect(getStatIconName('health')).toBe('Shield'));
  it('returns DollarSign for money', () => expect(getStatIconName('money')).toBe('DollarSign'));
  it('returns TrendingUp for unknown', () => expect(getStatIconName('unknown')).toBe('TrendingUp'));
});
