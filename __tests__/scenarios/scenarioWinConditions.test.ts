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
 * 2. Family Focused (60 gems) required achievement `family_man`. That id does
 *    not exist — its only occurrence in the entire repo was the condition
 *    itself. The catalogue has `get_married`, `first_child`, `family_builder`
 *    and `family_empire`.
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
  const achievementIds = new Set(achievements.map(a => a.id));

  it('has a non-trivial achievement catalogue (guards the check below)', () => {
    expect(achievementIds.size).toBeGreaterThan(20);
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

  it('does NOT score when level is stripped — the actual bug', () => {
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

describe('the prestige projection carries level through', () => {
  const fs = require('fs') as typeof import('fs');
  const path = require('path') as typeof import('path');

  it('maps careers with level, not just id and accepted', () => {
    const source = fs.readFileSync(
      path.join(__dirname, '..', '..', 'lib/prestige/prestigeExecution.ts'),
      'utf8',
    );

    expect(source).toMatch(/careers:\s*\(gameState\.careers \|\| \[\]\)\.map\(c => \(\{[\s\S]*?level: c\.level/);
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
    // Social Butterfly wants 10+ relationships of any kind — narrowing that
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
