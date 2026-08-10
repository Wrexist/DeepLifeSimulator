/**
 * Every onboarding perk was permanently locked.
 *
 * Two independent faults stacked:
 *
 * 1. `isPerkUnlocked` (and `LifeGoalsPanel`) read
 *    `gameState.achievements[].completed`. That array is the deprecated
 *    catalogue seeded in `initialState.ts`; its `completed` flag has no writer
 *    in shipping code, because `evaluateAchievements` is an explicit no-op stub
 *    and its only caller `checkAchievements` therefore does nothing. The sole
 *    exception is a one-off `luxury_life` flip in `GameActionsContext`.
 * 2. Every `unlock.achievementId` in `perksData.ts` named an id that does not
 *    exist in the live catalogue at all — so even had (1) been fixed, 17 of the
 *    20 perks would still have been ungrantable.
 *
 * Test 1 below is the guard that would have caught (2) on the day it landed: an
 * unlock requirement pointing at nothing is indistinguishable, at a glance, from
 * one pointing at something.
 */
import { perks } from '@/src/features/onboarding/perksData';
import {
  isPerkUnlocked,
  isPerkLocked,
  getPerkUnlockRequirementText,
  type PerkDefinition,
} from '@/src/features/onboarding/perksFlow';
import { achievements, isAchievementEarned } from '@/src/features/onboarding/achievementsData';
import { getSatisfiedAchievementIds } from '@/lib/progress/earnedAchievements';
import { createTestGameState } from '@/__tests__/helpers/createTestGameState';
import fs from 'fs';
import path from 'path';

const REPO = path.join(__dirname, '..', '..');
const liveIds = new Set(achievements.map((a) => a.id));

// ---------------------------------------------------------------------------
// 1. Every perk points at an achievement that actually exists
// ---------------------------------------------------------------------------

describe('perk unlock ids resolve to the live achievement catalogue', () => {
  it('has perks to check (guards against a vacuous suite)', () => {
    expect(perks.length).toBeGreaterThanOrEqual(20);
    expect(perks.filter((p) => p.unlock).length).toBeGreaterThanOrEqual(20);
  });

  it.each(perks.filter((p) => p.unlock).map((p) => [p.id, p.unlock!.achievementId]))(
    'perk %s → achievement %s exists',
    (_perkId, achievementId) => {
      expect(liveIds.has(achievementId)).toBe(true);
    }
  );

  it('names none of the dead ids the perks used to point at', () => {
    // The originals, verbatim. Any of these reappearing means the remap was
    // reverted onto a catalogue that does not exist.
    const dead = [
      'career_goals', 'generational_wealth', 'athlete', 'popular', 'college_grad',
      'millionaire', 'ten_thousand', 'centenarian', 'happy_life', 'wealth_collector',
      'filial_piety', 'life_of_crime', 'epic_lineage', 'tech_innovator',
      'crypto_magnate', 'media_mogul', 'spiritual_guru',
    ];
    const used = perks.map((p) => p.unlock?.achievementId).filter(Boolean);
    for (const id of dead) expect(used).not.toContain(id);
    // …and none of them is live, which is why they were dead.
    for (const id of dead) expect(liveIds.has(id)).toBe(false);
  });

  it('every perk requirement line resolves to a human title, never a raw slug', () => {
    for (const perk of perks) {
      if (!perk.unlock) continue;
      const text = getPerkUnlockRequirementText(perk as PerkDefinition);
      expect(text).toMatch(/^Requires: /);
      // The slug must NOT be what the player sees.
      expect(text).not.toContain(perk.unlock.achievementId);
      expect(text).not.toContain('undefined');
    }
  });

  it('renders a real title for a known perk', () => {
    const ironWill = perks.find((p) => p.id === 'iron_will')!;
    expect(getPerkUnlockRequirementText(ironWill as PerkDefinition)).toBe(
      'Requires: Fitness Deity'
    );
  });
});

// ---------------------------------------------------------------------------
// 2. The gate reads the live source, not the dead array
// ---------------------------------------------------------------------------

describe('the perk gate reads the live achievement system', () => {
  it('Perks.tsx selects getSatisfiedAchievementIds, not s.achievements', () => {
    const src = fs.readFileSync(path.join(REPO, 'app', '(onboarding)', 'Perks.tsx'), 'utf8');
    expect(src).toContain('getSatisfiedAchievementIds');
    expect(src).not.toMatch(/useGameSelector\(\(s\) => s\.achievements\)/);
  });

  it('LifeGoalsPanel selects getSatisfiedAchievementIds, not s.achievements', () => {
    const src = fs.readFileSync(
      path.join(REPO, 'components', 'settings', 'LifeGoalsPanel.tsx'),
      'utf8'
    );
    expect(src).toContain('getSatisfiedAchievementIds');
    expect(src).not.toMatch(/a\.id === perk\.unlock\?\.achievementId && a\.completed/);
  });

  it('perksFlow no longer inspects a `.completed` flag', () => {
    const src = fs.readFileSync(
      path.join(REPO, 'src', 'features', 'onboarding', 'perksFlow.ts'),
      'utf8'
    ).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    expect(src).not.toContain('.completed');
  });
});

// ---------------------------------------------------------------------------
// 3. A player who satisfied the achievement actually gets the perk
// ---------------------------------------------------------------------------

describe('a satisfied achievement grants its perk', () => {
  it('a fresh life has every achievement-gated perk locked (the baseline)', () => {
    const state = createTestGameState();
    const earned = getSatisfiedAchievementIds(state);
    const ironWill = perks.find((p) => p.id === 'iron_will')! as PerkDefinition;
    expect(earned).not.toContain('fitness_deity');
    expect(isPerkLocked(ironWill, [], earned)).toBe(true);
  });

  it('reaching 100 fitness satisfies fitness_deity and unlocks Iron Will', () => {
    const state = createTestGameState();
    state.stats.fitness = 100;

    expect(isAchievementEarned(state, 'fitness_deity')).toBe(true);
    const earned = getSatisfiedAchievementIds(state);
    expect(earned).toContain('fitness_deity');

    const ironWill = perks.find((p) => p.id === 'iron_will')! as PerkDefinition;
    expect(isPerkUnlocked(ironWill, [], earned)).toBe(true);
    expect(isPerkLocked(ironWill, [], earned)).toBe(false);
  });

  it('a CLAIMED achievement counts even if live state no longer satisfies it', () => {
    // The perk gate must survive a stat sliding back down after the badge was
    // collected — claimed ids are unioned in by getSatisfiedAchievementIds.
    const state = createTestGameState();
    state.stats.fitness = 10;
    state.claimedProgressAchievements = ['fitness_deity'];

    const earned = getSatisfiedAchievementIds(state);
    expect(earned).toContain('fitness_deity');
    const ironWill = perks.find((p) => p.id === 'iron_will')! as PerkDefinition;
    expect(isPerkUnlocked(ironWill, [], earned)).toBe(true);
  });

  it('only ever unlocks: the live source is a superset of the dead all-false array', () => {
    // The array it replaced contributed ZERO unlocked ids in shipping code, so
    // whatever getSatisfiedAchievementIds returns can only add unlocks. Proven
    // here on the shape that matters: no perk unlocked under the old gate
    // becomes locked under the new one.
    const state = createTestGameState();
    state.stats.fitness = 100;
    const earned = getSatisfiedAchievementIds(state);

    for (const perk of perks as PerkDefinition[]) {
      const wasUnlockedUnderDeadGate = !perk.unlock; // .completed was never true
      if (wasUnlockedUnderDeadGate) {
        expect(isPerkUnlocked(perk, [], earned)).toBe(true);
      }
    }

    // And a purchased permanent perk stays unlocked regardless of achievements.
    const anyGated = perks.find((p) => p.unlock)! as PerkDefinition;
    expect(isPerkUnlocked(anyGated, [anyGated.id], [])).toBe(true);
  });
});
