import { createTestGameState } from '../../../__tests__/helpers/createTestGameState';
import {
  earnedCapstones,
  capstoneLegacyBonus,
  MAX_CAPSTONE_LEGACY_POINTS,
} from '@/lib/legacy/lifeCapstone';
import { applyDeathRibbon } from '@/contexts/game/actions/weekly/applyDeathRibbon';
import type { GameState } from '@/contexts/game/types';

/**
 * MP13: a completed non-wealth path pays legacy points into the next life, so a
 * family/career/community life is not just a word on a ribbon.
 */
const familyLife = (): GameState => {
  const s = createTestGameState();
  s.family = {
    ...(s.family ?? {}),
    spouse: { id: 'sp', name: 'Alex' },
    children: [{ id: 'c1' }, { id: 'c2' }, { id: 'c3' }],
  } as never;
  return s;
};

const careerLife = (): GameState => {
  const s = createTestGameState();
  s.careers = [{ id: 'tech', level: 5, accepted: true, levels: [], applied: true }] as never;
  return s;
};

const communityLife = (): GameState => {
  const s = createTestGameState();
  s.karma = { score: 65 } as never;
  s.relationships = Array.from({ length: 8 }, (_, i) => ({ id: `r${i}`, type: 'friend' })) as never;
  return s;
};

describe('MP13 non-wealth capstones', () => {
  it('recognises each path on its own evidence', () => {
    expect(earnedCapstones(familyLife()).map((c) => c.id)).toContain('capstone_family');
    expect(earnedCapstones(careerLife()).map((c) => c.id)).toContain('capstone_career');
    expect(earnedCapstones(communityLife()).map((c) => c.id)).toContain('capstone_community');
  });

  it('does not award a family capstone for children alone, or an ordinary life at all', () => {
    const noSpouse = createTestGameState();
    noSpouse.family = {
      ...(noSpouse.family ?? {}),
      spouse: undefined,
      children: [{ id: 'c1' }, { id: 'c2' }, { id: 'c3' }],
    } as never;
    expect(earnedCapstones(noSpouse)).toHaveLength(0);
    expect(capstoneLegacyBonus(createTestGameState())).toBe(0);
  });

  it('caps the legacy points one death can pay', () => {
    const both = familyLife();
    both.karma = { score: 65 } as never;
    both.relationships = Array.from({ length: 8 }, (_, i) => ({ id: `r${i}`, type: 'friend' })) as never;
    both.careers = [{ id: 'tech', level: 5, accepted: true, levels: [], applied: true }] as never;
    expect(capstoneLegacyBonus(both)).toBe(MAX_CAPSTONE_LEGACY_POINTS);
  });

  it('pays the bonus on the death tick and only then', () => {
    const life = familyLife();
    const dead = applyDeathRibbon({
      prevState: life,
      newStats: life.stats,
      nextWeeksLived: life.weeksLived,
      newShowDeathPopup: true,
    });
    expect(dead.legacyBonus).toBeGreaterThan(0);
    expect(dead.partial.ribbonCollection).toBeDefined();

    const alive = applyDeathRibbon({
      prevState: life,
      newStats: life.stats,
      nextWeeksLived: life.weeksLived,
      newShowDeathPopup: false,
    });
    expect(alive.legacyBonus).toBe(0);
    expect(alive.partial).toEqual({});
  });
});
