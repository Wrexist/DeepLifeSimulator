/**
 * What a bond is worth — Master Program 12.
 *
 * These pin the MODEL, not the numbers: that the wire runs both ways, that it
 * is capped so quantity cannot beat quality, that a child cannot be farmed for
 * it, and that a loner loses nothing they had.
 */
import { createTestGameState } from '../helpers/createTestGameState';
import type { GameState, Relationship } from '@/contexts/game/types';
import {
  BOND,
  bondTier,
  isCloseBond,
  closeCircle,
  closeCircleHappiness,
  bondHappinessSupport,
  CLOSE_BOND_HAPPINESS,
  TRUSTED_BOND_HAPPINESS,
  CONFIDANT_BOND_HAPPINESS,
  CLOSE_BOND_HAPPINESS_CAP,
} from '@/lib/social/closeness';
import {
  applyRelationshipHealth,
  NEGLECT_HAPPINESS_DRAG,
  NEGLECT_HAPPINESS_DRAG_CAP,
} from '@/contexts/game/actions/weekly/applyRelationshipHealth';
import { strongRelationshipCount } from '@/lib/goals/playstyle';
import type { WeekContext } from '@/contexts/game/actions/weekly/weekContext';
import { zeroPreRolls } from '../helpers/zeroPreRolls';
import { NEUTRAL_LIFE_SKILL_MODIFIERS } from '@/lib/skillTrees/lifeSkillEffects';

const rel = (over: Partial<Relationship> & { id: string }): Relationship => ({
  name: 'Someone',
  type: 'friend',
  relationshipScore: 50,
  personality: 'friendly',
  gender: 'female',
  age: 30,
  ...over,
});

function stateWith(rels: Relationship[]): GameState {
  return { ...createTestGameState(), relationships: rels };
}

function ctx(): WeekContext {
  // Typed as a real WeekContext (no cast): a new required field breaks
  // compilation here instead of going silently undefined (weekly audit).
  return {
    newStats: createTestGameState().stats,
    notifications: [],
    preRolls: zeroPreRolls(),
    nextWeeksLived: 100,
    lifeSkillMods: NEUTRAL_LIFE_SKILL_MODIFIERS,
  };
}

describe('the bands are one definition, shared', () => {
  it('names the tier a score sits in', () => {
    expect(bondTier(10)).toBe('estranged');
    expect(bondTier(BOND.known)).toBe('known');
    expect(bondTier(BOND.close)).toBe('close');
    expect(bondTier(BOND.trusted)).toBe('trusted');
    expect(bondTier(undefined)).toBe('estranged');
  });

  it('agrees with the predicate the goal engine already used', () => {
    // `strongRelationshipCount` owned 60 before this module existed. If the two
    // ever disagree, "close" means two things and the goal card stops matching
    // the happiness line.
    const s = stateWith([
      rel({ id: 'a', relationshipScore: BOND.close }),
      rel({ id: 'b', relationshipScore: BOND.close - 1 }),
    ]);
    expect(closeCircle(s)).toHaveLength(1);
    expect(strongRelationshipCount(s)).toBe(1);
  });

  it('a child is never in the circle — every newborn starts at 75', () => {
    const s = stateWith([
      rel({ id: 'kid', type: 'child', relationshipScore: 95 }),
      rel({ id: 'kid2', type: 'child', relationshipScore: 100 }),
    ]);
    expect(closeCircle(s)).toHaveLength(0);
    expect(closeCircleHappiness(s)).toBe(0);
  });

  it('but a parent is — a loner who calls their mother has somebody', () => {
    const s = stateWith([rel({ id: 'mum', type: 'parent', relationshipScore: 70 })]);
    expect(closeCircle(s)).toHaveLength(1);
    expect(isCloseBond(s.relationships![0])).toBe(true);
  });
});

describe('quantity cannot beat quality', () => {
  it('pays 1 per close bond', () => {
    expect(closeCircleHappiness(stateWith([rel({ id: 'a', relationshipScore: 60 })]))).toBe(
      CLOSE_BOND_HAPPINESS,
    );
  });

  it('caps at three, so the fiftieth acquaintance is worth what the fourth is', () => {
    const fifty = Array.from({ length: 50 }, (_, i) => rel({ id: `f${i}`, relationshipScore: 60 }));
    const three = fifty.slice(0, 3);
    expect(closeCircleHappiness(stateWith(three))).toBe(CLOSE_BOND_HAPPINESS_CAP);
    expect(closeCircleHappiness(stateWith(fifty))).toBe(CLOSE_BOND_HAPPINESS_CAP);
  });

  it('and fifty at 45 are worth nothing at all', () => {
    const fifty = Array.from({ length: 50 }, (_, i) => rel({ id: `f${i}`, relationshipScore: 45 }));
    expect(closeCircleHappiness(stateWith(fifty))).toBe(0);
  });

  it('never out-earns the decay it sits against', () => {
    // Natural decay is 4/week (lib/economy/statDecay.ts). A maxed circle must
    // not offset it, or the social life becomes the way to avoid living one.
    expect(CLOSE_BOND_HAPPINESS_CAP).toBeLessThan(4);
  });
});

describe('the wire runs both ways now', () => {
  it('mirrors the neglect drag exactly — same magnitude, same cap shape', () => {
    expect(CLOSE_BOND_HAPPINESS).toBe(Math.abs(NEGLECT_HAPPINESS_DRAG));
    expect(CLOSE_BOND_HAPPINESS_CAP).toBe(Math.abs(NEGLECT_HAPPINESS_DRAG_CAP));
  });

  it('a maintained friend contributes; a neglected one costs', () => {
    const close = applyRelationshipHealth(rel({ id: 'a', relationshipScore: 70 }), 0, ctx());
    expect(close.happinessSupport).toBe(CLOSE_BOND_HAPPINESS);
    expect(close.happinessPenalty).toBe(0);

    const gone = applyRelationshipHealth(rel({ id: 'b', relationshipScore: 10 }), 1, ctx());
    expect(gone.happinessSupport).toBe(0);
    expect(gone.happinessPenalty).toBe(NEGLECT_HAPPINESS_DRAG);
  });

  it('a known-but-not-close friend contributes nothing — 45 is not 60', () => {
    const known = applyRelationshipHealth(rel({ id: 'a', relationshipScore: BOND.known }), 0, ctx());
    expect(known.happinessSupport).toBe(0);
    expect(known.happinessPenalty).toBe(0);
  });

  it('a partner below 30 is not somebody in your corner', () => {
    const failing = applyRelationshipHealth(
      rel({ id: 'p', type: 'partner', relationshipScore: 20 }),
      0,
      ctx(),
    );
    expect(failing.happinessSupport).toBe(0);
  });

  it('and a healthy partner is - at the depth they are kept', () => {
    const close = applyRelationshipHealth(
      rel({ id: 'p', type: 'partner', relationshipScore: 70 }),
      0,
      ctx(),
    );
    expect(close.happinessSupport).toBe(CLOSE_BOND_HAPPINESS);

    const trusted = applyRelationshipHealth(
      rel({ id: 'p', type: 'partner', relationshipScore: 80 }),
      0,
      ctx(),
    );
    expect(trusted.happinessSupport).toBe(TRUSTED_BOND_HAPPINESS);

    const confidant = applyRelationshipHealth(
      rel({ id: 'p', type: 'partner', relationshipScore: 100 }),
      0,
      ctx(),
    );
    expect(confidant.happinessSupport).toBe(CONFIDANT_BOND_HAPPINESS);
  });

  it('a life with nobody is worth zero, not negative — the loner loses nothing', () => {
    const alone = stateWith([]);
    expect(closeCircleHappiness(alone)).toBe(0);
  });
});

describe('MP12: depth at the top of the ladder', () => {
  it('pays by band, so 60, 80 and 100 are three different things', () => {
    expect(bondHappinessSupport(59)).toBe(0);
    expect(bondHappinessSupport(60)).toBe(CLOSE_BOND_HAPPINESS);
    expect(bondHappinessSupport(79)).toBe(CLOSE_BOND_HAPPINESS);
    expect(bondHappinessSupport(80)).toBe(TRUSTED_BOND_HAPPINESS);
    expect(bondHappinessSupport(94)).toBe(TRUSTED_BOND_HAPPINESS);
    expect(bondHappinessSupport(95)).toBe(CONFIDANT_BOND_HAPPINESS);
    expect(bondHappinessSupport(100)).toBe(CONFIDANT_BOND_HAPPINESS);
    expect(bondHappinessSupport(undefined)).toBe(0);
  });

  it('names the confidant band', () => {
    expect(bondTier(94)).toBe('trusted');
    expect(bondTier(95)).toBe('confidant');
    expect(bondTier(100)).toBe('confidant');
  });

  it('lets one confidant reach the ceiling two trusted bonds need', () => {
    expect(closeCircleHappiness(stateWith([rel({ id: 'a', relationshipScore: 100 })]))).toBe(
      CLOSE_BOND_HAPPINESS_CAP,
    );
    expect(closeCircleHappiness(stateWith([rel({ id: 'a', relationshipScore: 80 })]))).toBe(
      TRUSTED_BOND_HAPPINESS,
    );
    expect(
      closeCircleHappiness(
        stateWith([
          rel({ id: 'a', relationshipScore: 80 }),
          rel({ id: 'b', relationshipScore: 85 }),
        ]),
      ),
    ).toBe(CLOSE_BOND_HAPPINESS_CAP);
  });

  it('still cannot out-earn decay - the ceiling is unchanged', () => {
    expect(CLOSE_BOND_HAPPINESS_CAP).toBeLessThan(4);
  });
});
