/**
 * Three ways a challenge scenario could not be won.
 *
 * These are scored once, at first prestige, in `prestigeExecution.ts` — so a
 * broken condition does not merely fail loudly, it quietly withholds the gems
 * for a run the player did complete. 2026-07-30 audit GL-4.
 *
 * 1. Political Dynasty (expert, 200 gems) checks "Become President" with
 *    `'level' in politicalCareer && politicalCareer.level >= 5`, but the
 *    prestige projection mapped careers to `{ id, accepted }` and dropped
 *    `level`. `'level' in ...` was false for every player, forever.
 * 2. Family Focused (60 gems) required achievement `family_man`, which exists
 *    nowhere. The first fix swapped it for `first_child` — a REAL id, but in
 *    the wrong catalogue, so the scenario stayed unwinnable and the test
 *    covering it passed by checking the wrong list. `prestigeExecution`
 *    projected `gameState.achievements`, the DEPRECATED array from
 *    `initialState.ts`, whose `.completed` flag has no writer in shipping code
 *    (`evaluateAchievements` is an explicit no-op stub). Every `achievement`
 *    win condition evaluated against an all-false list whichever id it named.
 *    The projection now derives from the live system.
 * 3. The opposite failure: `relationship` conditions narrowed on
 *    `condition.value === 'married'`, comparing a string to the NUMBER every
 *    condition actually carries. It never matched, so the filter counted all
 *    relationships and "Get married" / "Have at least 1 child" were satisfied
 *    by a single friend.
 */
import {
  SCENARIOS,
  checkScenarioWin,
  type Scenario,
} from '@/lib/scenarios/scenarioDefinitions';
import { achievements } from '@/src/features/onboarding/achievementsData';
import { getSatisfiedAchievementIds } from '@/lib/progress/earnedAchievements';
import { initialGameState } from '@/contexts/game/initialState';
import { createTestGameState } from '../helpers/createTestGameState';

type WinState = Parameters<typeof checkScenarioWin>[1];

function baseState(over: Partial<WinState> = {}): WinState {
  return {
    stats: { money: 0, reputation: 0 },
    age: 30,
    education: [],
    careers: [],
    relationships: [],
    achievements: [],
    companies: [],
    realEstate: [],
    weeksLived: 100,
    ...over,
  };
}

const scenario = (id: string): Scenario => {
  const found = SCENARIOS.find(s => s.id === id);
  if (!found) throw new Error(`scenario ${id} missing`);
  return found;
};

describe('every achievement a scenario requires actually exists', () => {
  // The LIVE catalogue - the one `getSatisfiedAchievementIds` searches. The
  // first version of this suite validated against it too, but the projection
  // fed the evaluator the deprecated `initialState.achievements` array, so
  // agreeing with this list proved nothing. The projection assertion below is
  // what ties the two together.
  const achievementIds = new Set(achievements.map(a => a.id));

  it('has a non-trivial achievement catalogue (guards the check below)', () => {
    expect(achievementIds.size).toBeGreaterThan(20);
  });

  it('is NOT the deprecated catalogue', () => {
    // `initialState.achievements` has `parent`, not `first_child`. If a future
    // edit points the projection back at it, this names the difference.
    const deprecated = new Set((initialGameState.achievements || []).map(a => a.id));
    expect(deprecated.has('first_child')).toBe(false);
    expect(achievementIds.has('first_child')).toBe(true);
  });

  it('names only real achievement ids in win conditions', () => {
    const referenced = SCENARIOS.flatMap(s =>
      s.winConditions
        .filter(c => c.type === 'achievement')
        .map(c => ({ scenario: s.id, id: String(c.value) })),
    );

    expect(referenced.length).toBeGreaterThan(0);
    const missing = referenced.filter(r => !achievementIds.has(r.id));
    expect(missing).toEqual([]);
  });
});

describe('Political Dynasty can be won', () => {
  const politicalDynasty = scenario('political_dynasty');

  it('scores a president with iconic reputation', () => {
    const result = checkScenarioWin(
      politicalDynasty,
      baseState({
        stats: { money: 0, reputation: 95 },
        careers: [{ id: 'political', accepted: true, level: 5 }],
      }),
    );

    expect(result.won).toBe(true);
  });

  it('does NOT score a mid-ladder politician', () => {
    // The control: without it, a condition that always passed would satisfy
    // the case above just as well.
    const result = checkScenarioWin(
      politicalDynasty,
      baseState({
        stats: { money: 0, reputation: 95 },
        careers: [{ id: 'political', accepted: true, level: 3 }],
      }),
    );

    expect(result.won).toBe(false);
  });

  it('does NOT score when level is stripped - the actual bug', () => {
    // This is exactly the shape `prestigeExecution` used to project. It must
    // stay unwinnable so the assertion above is really testing the projection.
    const result = checkScenarioWin(
      politicalDynasty,
      baseState({
        stats: { money: 0, reputation: 95 },
        careers: [{ id: 'political', accepted: true }],
      }),
    );

    expect(result.won).toBe(false);
  });
});

describe('the projection reads the LIVE achievement system', () => {
  it('reports an achievement whose condition the player has actually met', () => {
    // `first_child` is a counter achievement over the player's children. Build a
    // state that satisfies it and check the projection sees it - this is the
    // assertion that was missing, and its absence is why swapping one dead id
    // for another looked like a fix.
    const withChild = createTestGameState({
      family: { children: [{ id: 'c1', name: 'Kid', age: 2 }] },
    } as never);

    expect(getSatisfiedAchievementIds(withChild)).toContain('first_child');
  });

  it('does NOT report it for a childless player', () => {
    // The control. Without it, a projection returning every id would pass above.
    expect(getSatisfiedAchievementIds(createTestGameState())).not.toContain('first_child');
  });

  it('counts a CLAIMED achievement even if state no longer satisfies it', () => {
    const claimed = createTestGameState({
      claimedProgressAchievements: ['first_child'],
    } as never);

    expect(getSatisfiedAchievementIds(claimed)).toContain('first_child');
  });

  // The projection was extracted to lib/scenarios/progress.ts (2026-08-25
  // retention pass) so the live ScenarioChallengeCard and the prestige payout
  // read ONE mapping. The three hard-won projection fixes are asserted against
  // the shared module's source, plus one assertion that prestigeExecution
  // actually routes through it — otherwise a re-inlined divergent projection
  // would pass all three.
  const fs = require('fs') as typeof import('fs');
  const path = require('path') as typeof import('path');
  const projectionSource = () =>
    fs.readFileSync(path.join(__dirname, '..', '..', 'lib/scenarios/progress.ts'), 'utf8');
  const prestigeSource = () =>
    fs.readFileSync(path.join(__dirname, '..', '..', 'lib/prestige/prestigeExecution.ts'), 'utf8');

  it('the shared projection derives from the live system, not the deprecated array', () => {
    const source = projectionSource();
    expect(source).toMatch(/achievements: getSatisfiedAchievementIds\(gameState\)/);
    expect(source).not.toMatch(/achievements: \(gameState\.achievements \|\| \[\]\)\.map/);
  });

  it('passes bank balances through for the net-worth scenarios', () => {
    // The evaluator always read `bankSavings`; the wrapper's type omitted it so
    // nothing could pass it, and savings counted as $0 toward five scenarios.
    expect(projectionSource()).toMatch(/bankSavings:/);
    expect(projectionSource()).toMatch(/nonMirrorDeposits/);
  });

  it('prestigeExecution routes through the shared projection', () => {
    const source = prestigeSource();
    expect(source).toMatch(/projectScenarioState\(gameState\)/);
    // A re-inlined projection is the drift this extraction closed.
    expect(source).not.toMatch(/achievements: getSatisfiedAchievementIds/);
  });
});

describe('the prestige projection carries level through', () => {
  const fs = require('fs') as typeof import('fs');
  const path = require('path') as typeof import('path');

  it('maps careers with level, not just id and accepted', () => {
    const source = fs.readFileSync(
      path.join(__dirname, '..', '..', 'lib/scenarios/progress.ts'),
      'utf8',
    );

    expect(source).toMatch(/careers:\s*\(gameState\.careers \|\| \[\]\)\.map\(\(c\) => \(\{[\s\S]*?level: c\.level/);
  });
});

describe('Family Focused can be won', () => {
  const familyFocused = scenario('family_focused');

  it('scores a married player with a first child', () => {
    const result = checkScenarioWin(
      familyFocused,
      baseState({
        relationships: [{ type: 'spouse' }, { type: 'child' }],
        achievements: [{ id: 'first_child', completed: true }],
      }),
    );

    expect(result.won).toBe(true);
  });

  it('does NOT score without the achievement', () => {
    const result = checkScenarioWin(
      familyFocused,
      baseState({
        relationships: [{ type: 'spouse' }],
        achievements: [{ id: 'first_child', completed: false }],
      }),
    );

    expect(result.won).toBe(false);
  });
});

describe('a relationship condition counts the right relationships', () => {
  const familyFocused = scenario('family_focused');
  const singleParent = scenario('single_parent');

  it('does not accept one friend as a marriage', () => {
    const result = checkScenarioWin(
      familyFocused,
      baseState({
        relationships: [{ type: 'friend' }],
        achievements: [{ id: 'first_child', completed: true }],
      }),
    );

    expect(result.won).toBe(false);
    expect(result.unmetConditions.map(c => c.description)).toContain('Get married');
  });

  it('does not accept one friend as a child', () => {
    const unmet = checkScenarioWin(
      singleParent,
      baseState({ relationships: [{ type: 'friend' }] }),
    ).unmetConditions.map(c => c.description);

    expect(unmet).toContain('Have at least 1 child');
  });

  it('still counts ALL relationships where no type is named', () => {
    // Social Butterfly wants 10+ relationships of any kind - narrowing that
    // one would be the opposite regression.
    const socialButterfly = scenario('social_butterfly');
    const result = checkScenarioWin(
      socialButterfly,
      baseState({
        stats: { money: 0, reputation: 85 },
        relationships: Array.from({ length: 10 }, () => ({ type: 'friend' })),
      }),
    );

    expect(result.won).toBe(true);
  });
});
