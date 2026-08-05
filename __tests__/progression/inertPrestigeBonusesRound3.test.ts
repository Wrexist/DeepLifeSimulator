/**
 * Three more prestige purchases that did nothing. ~93,500 points between them.
 *
 * R3-P1 "Immortality" — 50,000 points, the most expensive item in the shop,
 * "Never die from old age". The old-age death roll read ONLY
 * `goldUpgrades.immortality`; `hasImmortality(unlockedBonuses)` existed and was
 * imported in two files without ever being invoked, and `PrestigeInfoModal`
 * called it solely to render its own description string. The comment above the
 * roll said "gold-upgrade OR perk", so the perk half was intended and simply
 * never wired, and `HelpModal` tells the player twice that the PRESTIGE bonus
 * grants it.
 *
 * R3-P2 "+25 points per maxed career" — `career.level` is 0-indexed and capped
 * at `levels.length - 1` everywhere else (`promotionGating` returns `max_level`
 * at exactly that point), so `level >= levels.length` was never true for a real
 * career. The bonus and `lifetimeStats.careersMaxed` were permanently 0, and
 * `PrestigeModal` hides the breakdown row on `careerBonus > 0`, so it silently
 * never appeared.
 *
 * R3-P3 "Social Master" (20,000) and "Reputation Builder" (3,500 x2) — both
 * feed `getRelationshipGainMultiplier`, whose only occurrences were its own
 * definition, an unused import, and the info modal rendering the percentage the
 * player was not getting. 2026-07-31 audit round 3.
 */
import { calculatePrestigePoints } from '@/lib/prestige/prestigePoints';
import { applyRelationshipGain } from '@/lib/skillTrees/lifeSkillEffects';
import { hasImmortality, getRelationshipGainMultiplier } from '@/lib/prestige/applyBonuses';
import { PRESTIGE_BONUSES } from '@/lib/prestige/prestigeBonuses';
import { createTestGameState } from '../helpers/createTestGameState';
import type { Career, GameState } from '@/contexts/game/types';

/** A complete `Career`. The two literals below carried 3 of its 8 required fields. */
function makeCareer(over: Partial<Career> = {}): Career {
  return {
    id: 'dev',
    levels: [{ name: 'Junior', salary: 1_000 }],
    level: 0,
    description: '',
    requirements: {} as Career['requirements'],
    progress: 0,
    applied: true,
    accepted: true,
    ...over,
  };
}

function withBonuses(ids: string[]): GameState {
  // `createTestGameState` always returns a complete `prestige`, so spread it
  // directly. The `?? {}` widened every required field to optional, which is
  // what forced the `as GameState` on the whole object.
  const base = createTestGameState();
  return { ...base, prestige: { ...base.prestige!, unlockedBonuses: ids } };
}

describe('R3-P1 — Immortality is honoured from the prestige shop', () => {
  it('is a real, purchasable shop entry (guards the rest)', () => {
    const entry = PRESTIGE_BONUSES.find((b) => b.id === 'immortality');
    expect(entry).toBeTruthy();
    expect(entry!.cost).toBe(50_000);
  });

  it('the predicate reports it when owned', () => {
    expect(hasImmortality(['immortality'])).toBe(true);
    expect(hasImmortality([])).toBe(false);
  });

  it('the death roll consults the prestige bonus, not just the gold upgrade', () => {
    const fs = require('fs') as typeof import('fs');
    const path = require('path') as typeof import('path');
    const source = fs.readFileSync(
      path.join(__dirname, '..', '..', 'contexts/game/GameActionsContext.tsx'),
      'utf8',
    );

    expect(source).toMatch(
      /const isImmortal =!!prevState\.goldUpgrades\?\.immortality \|\| hasImmortality\(unlockedBonuses\)/,
    );
  });
});

describe('R3-P2 — a maxed career is actually reachable', () => {
  const LEVELS = [
    { name: 'Junior', salary: 900 },
    { name: 'Mid', salary: 1_400 },
    { name: 'Senior', salary: 2_000 },
  ];

  function pointsFor(level: number): number {
    const state = withBonuses([]);
    const withCareer = {
      ...state,
      careers: [makeCareer({ level, levels: LEVELS })],
    };
    return calculatePrestigePoints(withCareer, 1_000_000, withCareer.prestige!, 'reset').total;
  }

  it('credits a career sitting on its TOP rung', () => {
    // Top rung is index 2 for a 3-level ladder — the value promotion caps at.
    expect(pointsFor(2)).toBeGreaterThan(pointsFor(1));
  });

  it('does not credit a mid-ladder career', () => {
    // The control: crediting everything would satisfy the case above too.
    expect(pointsFor(1)).toBe(pointsFor(0));
  });

  it('does NOT credit a career entry with no levels array', () => {
    // The mirror hazard the old `level >= 0` shape opened: a corrupt or legacy
    // career entry would have counted as maxed for free.
    const state = withBonuses([]);
    const broken = {
      ...state,
      // Deliberately malformed: `levels` REMOVED, which is the corruption under
      // test. Built from the real factory and then broken, so the break is one
      // named field rather than a whole hand-rolled object standing in for a
      // Career — the rest of the shape is still checked.
      careers: [{ ...makeCareer({ level: 0 }), levels: undefined as unknown as Career['levels'] }],
    };
    const empty = { ...state, careers: [] };

    expect(calculatePrestigePoints(broken, 1_000_000, state.prestige!, 'reset').total).toBe(
      calculatePrestigePoints(empty, 1_000_000, state.prestige!, 'reset').total,
    );
  });
});

describe('R3-P3 — the relationship multiplier reaches relationship gains', () => {
  it('the multiplier is above 1 when the bonuses are owned (guards the rest)', () => {
    expect(getRelationshipGainMultiplier(['social_master'])).toBeGreaterThan(1);
    expect(getRelationshipGainMultiplier([])).toBe(1);
  });

  it('raises a positive gain', () => {
    const plain = applyRelationshipGain(withBonuses([]), 10);
    const boosted = applyRelationshipGain(withBonuses(['social_master']), 10);

    expect(boosted).toBeGreaterThan(plain);
  });

  it('stacks the two purchases rather than taking the larger', () => {
    const one = applyRelationshipGain(withBonuses(['social_master']), 100);
    const both = applyRelationshipGain(
      withBonuses(['social_master', 'reputation_gain_multiplier']),
      100,
    );

    expect(both).toBeGreaterThan(one);
  });

  it('leaves a player with no bonuses untouched', () => {
    // The control in the other direction.
    expect(applyRelationshipGain(withBonuses([]), 10)).toBe(10);
  });

  it('never softens a LOSS — gains only, as documented', () => {
    expect(applyRelationshipGain(withBonuses(['social_master']), -20)).toBe(-20);
  });

  it('survives a corrupt bonus list without producing NaN', () => {
    // DELIBERATE-CORRUPTION. A test that proves the code survives garbage has
    // to be able to construct garbage: `null` is not assignable to `string[]`,
    // which is precisely what a truncated save carries.
    //
    // The marker is read by `scripts/audit/audit-save.cjs` so Hard Rule #3 stops
    // counting intentional fixtures as drift. This comment previously claimed
    // there were "two such casts, and the count floors at 2" — it went stale the
    // moment the rental corruption tests landed and made it four. A count that
    // climbs whenever someone writes a legitimate fixture is a warning people
    // learn to skim.
    const corrupt = { ...withBonuses([]), prestige: { unlockedBonuses: null } } as unknown as GameState;

    const out = applyRelationshipGain(corrupt, 10);
    expect(Number.isFinite(out)).toBe(true);
    expect(out).toBeGreaterThanOrEqual(10);
  });
});
