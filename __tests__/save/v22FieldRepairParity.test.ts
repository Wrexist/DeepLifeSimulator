/**
 * Regression: migration/repair parity for the v22 Wave-A NESTED concrete defaults.
 *
 * Migration 22 backfills `banking.rateEnvironment`/`budgetTargets`,
 * `socialMedia.followerHistory`/`scandalRiskScore`,
 * `gamingStreaming.perkTier`/`lastMemberWeek`/`hypeStreak` and
 * `travel.passportMilestones` on the version ladder — but `repairGameState`
 * never mirrored them (CLAUDE.md save-format rule (b)). A partial save already
 * stamped at the current version (CloudSync merge / hand-edit) that is missing
 * one of these keys is healed by NEITHER path: the wholesale ladder skips it
 * (version already current) and repair had no branch for it.
 *
 * Filed by the 2026-07-22 weekly audit alongside the top-level
 * `realEstateActivity` gap, which was fixed then; these nested ones were filed
 * not fixed. Each case deletes a single field from an otherwise-current save and
 * asserts repair restores it.
 */
import { createTestGameState } from '../helpers/createTestGameState';
import { repairGameState } from '@/utils/saveValidation';

/** Deep-clone so deleting a NESTED field can't mutate the shared initial state. */
function partialSave(): Record<string, any> {
  return JSON.parse(JSON.stringify(createTestGameState()));
}

describe('repairGameState mirrors the v22 nested concrete defaults', () => {
  it('restores banking.rateEnvironment and banking.budgetTargets', () => {
    const state = partialSave();
    delete state.banking.rateEnvironment;
    delete state.banking.budgetTargets;

    const result = repairGameState(state);
    expect(result.repaired).toBe(true);
    expect(state.banking.rateEnvironment).toEqual({ depositMult: 1, loanDelta: 0 });
    expect(state.banking.budgetTargets).toEqual({});
  });

  it('restores the gamingStreaming creator counters', () => {
    const state = partialSave();
    delete state.gamingStreaming.perkTier;
    delete state.gamingStreaming.lastMemberWeek;
    delete state.gamingStreaming.hypeStreak;

    const result = repairGameState(state);
    expect(result.repaired).toBe(true);
    expect(state.gamingStreaming.perkTier).toBe(0);
    expect(state.gamingStreaming.lastMemberWeek).toBe(0);
    expect(state.gamingStreaming.hypeStreak).toBe(0);
  });

  it('normalizes a non-finite gamingStreaming counter (not just a missing one)', () => {
    const state = partialSave();
    state.gamingStreaming.hypeStreak = Number.NaN;

    repairGameState(state);
    expect(state.gamingStreaming.hypeStreak).toBe(0);
  });

  it('restores travel.passportMilestones', () => {
    const state = partialSave();
    delete state.travel.passportMilestones;

    const result = repairGameState(state);
    expect(result.repaired).toBe(true);
    expect(state.travel.passportMilestones).toEqual([]);
  });

  it('anchors a missing socialMedia.followerHistory with the current follower count', () => {
    const state = partialSave();
    state.weeksLived = 30;
    state.socialMedia.followers = 1234;
    delete state.socialMedia.followerHistory;

    const result = repairGameState(state);
    expect(result.repaired).toBe(true);
    expect(state.socialMedia.followerHistory).toEqual([{ week: 30, followers: 1234 }]);
  });

  it('re-applies the 52-point cap to an oversized follower history', () => {
    const state = partialSave();
    state.socialMedia.followerHistory = Array.from({ length: 80 }, (_, i) => ({
      week: i,
      followers: i,
    }));

    repairGameState(state);
    expect(state.socialMedia.followerHistory).toHaveLength(52);
    expect(state.socialMedia.followerHistory[51].week).toBe(79); // kept the newest
  });

  it('restores socialMedia.scandalRiskScore', () => {
    const state = partialSave();
    delete state.socialMedia.scandalRiskScore;

    const result = repairGameState(state);
    expect(result.repaired).toBe(true);
    expect(state.socialMedia.scandalRiskScore).toBe(0);
  });

  // Same rule-(b) class, found by the new audit-save V8 static parity check.
  it('restores wantedLevel (JobActions adds to it with no ?? 0 guard → NaN)', () => {
    const state = partialSave();
    delete state.wantedLevel;

    const result = repairGameState(state);
    expect(result.repaired).toBe(true);
    expect(state.wantedLevel).toBe(0);
    // The consumer shape that made this a real defect, not just a smell.
    expect(state.wantedLevel + 1).toBe(1);
  });

  it('restores the processedIAPTransactions dedupe ledger', () => {
    const state = partialSave();
    delete state.processedIAPTransactions;

    const result = repairGameState(state);
    expect(result.repaired).toBe(true);
    expect(state.processedIAPTransactions).toEqual([]);
  });

  it('restores the Hobby Mastery maps', () => {
    const state = partialSave();
    delete state.pursuits;
    delete state.weeklyPursuitPractice;

    const result = repairGameState(state);
    expect(result.repaired).toBe(true);
    expect(state.pursuits).toEqual({});
    expect(state.weeklyPursuitPractice).toEqual({});
  });

  it('restores legacyPass.ownedCosmetics on a partially-shaped legacyPass', () => {
    const state = partialSave();
    delete state.legacyPass.ownedCosmetics;
    repairGameState(state);
    expect(state.legacyPass.ownedCosmetics).toEqual([]);

    // An entirely-missing slice is rebuilt by the existing legacyPass repair,
    // which must also produce the cosmetics array.
    const noPass = partialSave();
    delete noPass.legacyPass;
    repairGameState(noPass);
    expect(noPass.legacyPass.ownedCosmetics).toEqual([]);
  });

  it('leaves a complete save untouched by these branches (idempotent)', () => {
    const state = partialSave();
    const before = JSON.stringify({
      banking: state.banking.rateEnvironment,
      budget: state.banking.budgetTargets,
      streaming: state.gamingStreaming,
      travel: state.travel.passportMilestones,
      history: state.socialMedia.followerHistory,
      risk: state.socialMedia.scandalRiskScore,
    });

    repairGameState(state);

    expect(JSON.stringify({
      banking: state.banking.rateEnvironment,
      budget: state.banking.budgetTargets,
      streaming: state.gamingStreaming,
      travel: state.travel.passportMilestones,
      history: state.socialMedia.followerHistory,
      risk: state.socialMedia.scandalRiskScore,
    })).toBe(before);
  });
});

/**
 * The repaired clone is written back onto the caller's object ONLY when
 * `repaired` is true. A backfill that sets a field but leaves the flag alone is
 * therefore computed and thrown away — the save reaches gameplay still missing
 * the field. Fourteen Spark/Pulse backfills had that shape (2026-07-28 audit
 * save-3), so a save missing e.g. `sparkApp.likedYou` was "repaired" on every
 * load and still crashed on every load.
 */
describe('repairGameState never discards a backfill it computed', () => {
  it.each([
    ['likedYou', []],
    ['catfishRecords', []],
    ['jealousyHistory', []],
    ['dismissedCatfishIds', []],
    ['reportedIds', []],
    ['swipeQuota', 30],
    ['swipesUsedThisWeek', 0],
    ['superLikesUsedThisWeek', 0],
  ])('flags the repair when sparkApp.%s is missing, so it survives write-back', (field, expected) => {
    const state = partialSave();
    delete state.sparkApp[field as string];

    const result = repairGameState(state);
    // The flag is the whole point: without it the caller keeps the broken object.
    expect(result.repaired).toBe(true);
    expect(state.sparkApp[field as string]).toEqual(expected);
  });

  it.each([
    ['activeJealousy'],
    ['boost'],
  ])('normalizes sparkApp.%s to null AND flags it', (field) => {
    const state = partialSave();
    delete state.sparkApp[field];

    const result = repairGameState(state);
    expect(result.repaired).toBe(true);
    expect(state.sparkApp[field]).toBeNull();
  });

  it.each([
    ['liveSession', null],
    ['lastViralBoostBySkill', {}],
    ['activeScandal', null],
  ])('flags the repair when socialMedia.%s is missing', (field, expected) => {
    const state = partialSave();
    delete state.socialMedia[field as string];

    const result = repairGameState(state);
    expect(result.repaired).toBe(true);
    expect(state.socialMedia[field as string]).toEqual(expected);
  });
});

describe('repairGameState backfills the fields that had no mirror at all', () => {
  it('restores socialMedia.activeBrandDeals (no migration, no repair before)', () => {
    const state = partialSave();
    delete state.socialMedia.activeBrandDeals;

    const result = repairGameState(state);
    expect(result.repaired).toBe(true);
    expect(state.socialMedia.activeBrandDeals).toEqual([]);
  });

  it('restores a missing crimeSkills container (the Work tab reads it bare)', () => {
    const state = partialSave();
    delete state.crimeSkills;

    const result = repairGameState(state);
    expect(result.repaired).toBe(true);
    // The shape the render path indexes into must be back.
    expect(state.crimeSkills.stealth.level).toBe(1);
    expect(state.crimeSkills.hacking.level).toBe(1);
    expect(state.crimeSkills.lockpicking.level).toBe(1);
  });

  it('fills individual missing skills without discarding the ones the player levelled', () => {
    const state = partialSave();
    state.crimeSkills = { stealth: { xp: 900, level: 7, upgrades: ['x'] } };

    const result = repairGameState(state);
    expect(result.repaired).toBe(true);
    expect(state.crimeSkills.stealth).toEqual({ xp: 900, level: 7, upgrades: ['x'] });
    expect(state.crimeSkills.hacking.level).toBe(1);
    expect(state.crimeSkills.lockpicking.level).toBe(1);
  });

  it('leaves a healthy save alone (none of these branches fire)', () => {
    const state = partialSave();
    const before = JSON.stringify({
      spark: state.sparkApp,
      social: state.socialMedia,
      crime: state.crimeSkills,
    });

    const result = repairGameState(state);

    expect(JSON.stringify({
      spark: state.sparkApp,
      social: state.socialMedia,
      crime: state.crimeSkills,
    })).toBe(before);
    // A healthy save must not trip any of the branches added here. (`repaired`
    // itself can still be true — the factory state has always been missing
    // `loans`, which an older repair backfills.)
    expect(result.repairs.filter((r) => /sparkApp|socialMedia|crimeSkills/.test(r))).toEqual([]);
  });
});
