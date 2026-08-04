/**
 * A locked goal you can see is a goal. One you cannot see is nothing.
 *
 * The Work tab pre-filtered advanced careers through
 * `getUnlockedAdvancedCareers`, which returns only UNLOCKED entries — so the
 * very next line's `isLocked` check was always false, and the whole block that
 * formats "Education: masters_degree, mba / Experience: 260 weeks /
 * Reputation: 50+ / Net Worth: $500,000+" was unreachable dead code.
 *
 * A player who had unlocked none of them saw a single generic sentence. So the
 * five best careers in the game — CEO topping out at $24,000/wk, Investment
 * Banker, Surgeon, Research Scientist, Creative Director — were invisible, with
 * concrete checkable gates the player was never shown.
 *
 * Two are additionally gated on a CLAIMED achievement, and that requirement type
 * had no formatter branch at all, so it could never have been printed even if
 * the block had been reachable. 2026-07-30 audit GP-10.
 */
import {
  ADVANCED_CAREERS,
  isCareerUnlocked,
  getUnlockedAdvancedCareers,
} from '@/lib/careers/advancedCareers';

/** The gate input the Work tab builds. */
type Gate = Parameters<typeof isCareerUnlocked>[1];

const emptyGate = {
  education: [],
  claimedAchievements: [],
  stats: { reputation: 0, money: 0 },
  weeksLived: 0,
  netWorth: 0,
} as unknown as Gate;

const maxedGate = {
  education: [
    { id: 'masters_degree', completed: true },
    { id: 'mba', completed: true },
    { id: 'medical_degree', completed: true },
    { id: 'phd', completed: true },
    { id: 'law_degree', completed: true },
  ],
  claimedAchievements: ['scholar', 'social_celebrity'],
  stats: { reputation: 100, money: 100_000_000 },
  weeksLived: 3000,
  netWorth: 100_000_000,
} as unknown as Gate;

describe('the catalogue is worth showing', () => {
  it('has the elite careers the player should be able to see as goals', () => {
    expect(ADVANCED_CAREERS.length).toBeGreaterThanOrEqual(5);
    for (const career of ADVANCED_CAREERS) {
      expect(career.id).toBeTruthy();
      // `AdvancedCareer` has no `name` — the display title is the first level's
      // name. (The type-check of the test tree caught this; the assertion I
      // first wrote would have read `undefined` and passed on the `?? id`.)
      expect(career.levels.length).toBeGreaterThan(0);
      expect(career.levels[0].name).toBeTruthy();
    }
  });

  it('every career states requirements the UI can print', () => {
    // A career with no readable requirement would render a locked row with no
    // explanation, which is the state this fix exists to remove.
    for (const career of ADVANCED_CAREERS) {
      const req = career.unlockRequirements || career.requirements;
      expect(req).toBeTruthy();
      const printable =
        ('education' in req && req.education) ||
        ('experience' in req && req.experience) ||
        ('reputation' in req && req.reputation) ||
        ('netWorth' in req && req.netWorth) ||
        ('achievements' in req && req.achievements);
      expect(Boolean(printable)).toBe(true);
    }
  });
});

describe('locked really means locked, and unlocked really unlocks', () => {
  it('a brand-new player has none of them unlocked', () => {
    for (const career of ADVANCED_CAREERS) {
      expect(isCareerUnlocked(career, emptyGate)).toBe(false);
    }
    // Which is exactly why the old pre-filter rendered an empty list.
    expect(getUnlockedAdvancedCareers(emptyGate)).toHaveLength(0);
  });

  it('a maxed-out player unlocks them', () => {
    const unlocked = getUnlockedAdvancedCareers(maxedGate);
    expect(unlocked.length).toBeGreaterThan(0);
  });

  it('rendering the full catalogue still lets the UI distinguish the two', () => {
    // The Work tab now maps ADVANCED_CAREERS and computes isLocked per row.
    // The whole point is that the two sets differ for a new player.
    const lockedForNewPlayer = ADVANCED_CAREERS.filter((c) => !isCareerUnlocked(c, emptyGate));

    expect(lockedForNewPlayer).toHaveLength(ADVANCED_CAREERS.length);
    expect(getUnlockedAdvancedCareers(emptyGate).length).toBeLessThan(ADVANCED_CAREERS.length);
  });
});

describe('the achievement gate is printable', () => {
  it('at least one career is gated on a claimed achievement', () => {
    // This requirement type had no formatter branch, so it could never have
    // been shown to the player even once the block became reachable.
    const gated = ADVANCED_CAREERS.filter((c) => {
      const req = c.unlockRequirements || c.requirements;
      return 'achievements' in req && Array.isArray(req.achievements) && req.achievements.length > 0;
    });

    expect(gated.length).toBeGreaterThan(0);
  });

  it('an achievement-gated career stays locked without the claim', () => {
    const gated = ADVANCED_CAREERS.find((c) => {
      const req = c.unlockRequirements || c.requirements;
      return 'achievements' in req && Array.isArray(req.achievements) && req.achievements.length > 0;
    });
    expect(gated).toBeDefined();

    const withoutClaims = { ...(maxedGate as object), claimedAchievements: [] } as unknown as Gate;
    expect(isCareerUnlocked(gated!, withoutClaims)).toBe(false);
    expect(isCareerUnlocked(gated!, maxedGate)).toBe(true);
  });
});
