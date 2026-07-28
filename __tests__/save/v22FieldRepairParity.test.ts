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
