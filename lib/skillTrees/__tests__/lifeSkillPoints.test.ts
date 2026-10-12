/**
 * Skill points are a real second price for a Life Skill.
 *
 * The modal showed a points total that nothing ever spent (tester report,
 * 2026-10-10). Points now gate purchases alongside money, are derived rather
 * than stored, and never take away a skill an older save already owns.
 */
import {
  LIFE_SKILL_IDS,
  LIFE_SKILL_POINT_COST,
  lifeSkillPointsAvailable,
  lifeSkillPointsEarned,
  lifeSkillPointsSpent,
  purchaseLifeSkill,
} from '@/lib/skillTrees/lifeSkillEffects';
import { createTestGameState } from '@/__tests__/helpers/createTestGameState';

const withAge = (age: number, unlocked: string[] = [], money = 1_000_000) => {
  const s = createTestGameState({ unlockedLifeSkills: unlocked, educations: [], claimedProgressAchievements: [] });
  return { ...s, date: { ...s.date, age }, stats: { ...s.stats, money } };
};

describe('skill point prices', () => {
  it('prices every tree root 1, middles 2, capstone 3 - 8 a tree, 40 the board', () => {
    for (let i = 0; i < LIFE_SKILL_IDS.length; i += 4) {
      const [root, a, b, cap] = LIFE_SKILL_IDS.slice(i, i + 4);
      expect([LIFE_SKILL_POINT_COST[root], LIFE_SKILL_POINT_COST[a], LIFE_SKILL_POINT_COST[b], LIFE_SKILL_POINT_COST[cap]]).toEqual([1, 2, 2, 3]);
    }
    expect(LIFE_SKILL_IDS.reduce((sum, id) => sum + LIFE_SKILL_POINT_COST[id], 0)).toBe(40);
  });
});

describe('earned / spent / available', () => {
  it('earns 1 point per 5 years of age', () => {
    expect(lifeSkillPointsEarned(withAge(24))).toBe(4);
  });

  it('derives spent from what is unlocked, so nothing is stored', () => {
    const s = withAge(30, ['networking', 'leadership']);
    expect(lifeSkillPointsSpent(s)).toBe(3);
    expect(lifeSkillPointsAvailable(s)).toBe(3);
  });

  it('floors at 0 for a save that unlocked skills before points cost anything', () => {
    const s = withAge(20, ['networking', 'leadership', 'negotiation', 'executive']);
    expect(lifeSkillPointsAvailable(s)).toBe(0);
  });
});

describe('purchaseLifeSkill - the point gate', () => {
  it('refuses a skill the player cannot afford in points, charging nothing', () => {
    const s = withAge(5); // 1 point
    const r = purchaseLifeSkill(s, { id: 'leadership', cost: 100, levelRequired: 0, requires: [] });
    expect(r.purchased).toBe(false);
    expect(r.reason).toBe('insufficient-points');
    expect(r.state).toBe(s);
  });

  it('allows it once the points are there, and the spend is reflected immediately', () => {
    const s = withAge(15); // 3 points
    const r = purchaseLifeSkill(s, { id: 'networking', cost: 100, levelRequired: 0 });
    expect(r.purchased).toBe(true);
    expect(lifeSkillPointsAvailable(r.state)).toBe(2);
    // A second, same-batch purchase re-checks the NEW state: 2 left, capstone costs 3.
    const again = purchaseLifeSkill(r.state, { id: 'executive', cost: 100, levelRequired: 0 });
    expect(again.reason).toBe('insufficient-points');
  });

  it('never revokes a skill an older save already owns', () => {
    const s = withAge(20, ['networking', 'leadership', 'negotiation', 'executive']);
    const r = purchaseLifeSkill(s, { id: 'charisma', cost: 100, levelRequired: 0 });
    expect(r.purchased).toBe(false);
    expect(r.state.unlockedLifeSkills).toEqual(['networking', 'leadership', 'negotiation', 'executive']);
  });
});
