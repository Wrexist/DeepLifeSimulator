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

  /**
   * F-4: migration 22's Pet `ownedToys` → `toys` collapse is the one part of that
   * migration that MOVES data rather than defaulting it, and it had no repair
   * counterpart. A partial save already stamped at v22-or-later still carrying
   * `ownedToys` is skipped by the version ladder, and every reader has moved to
   * the canonical field (`PetActions` scores from `pet.toys ?? []`) — so those
   * toys are paid for and invisible.
   */
  it('collapses a legacy pet ownedToys array into toys', () => {
    const state = partialSave();
    state.pets = [
      { id: 'p1', name: 'Rex', toys: ['ball'], ownedToys: ['rope', 'bone'] },
    ];

    const result = repairGameState(state);

    expect(result.repaired).toBe(true);
    // Union, never a drop: the pre-existing toy survives alongside the moved ones.
    expect(state.pets[0].toys.sort()).toEqual(['ball', 'bone', 'rope']);
    expect(state.pets[0].ownedToys).toEqual([]);
  });

  it('dedupes a toy present in both arrays and keeps the rest of the pet intact', () => {
    const state = partialSave();
    state.pets = [
      { id: 'p1', name: 'Rex', happiness: 80, toys: ['ball'], ownedToys: ['ball', 'rope'] },
    ];

    repairGameState(state);

    expect(state.pets[0].toys.sort()).toEqual(['ball', 'rope']);
    expect(state.pets[0].happiness).toBe(80);
    expect(state.pets[0].name).toBe('Rex');
  });

  it('is idempotent - a second repair pass finds nothing left to collapse', () => {
    const state = partialSave();
    state.pets = [{ id: 'p1', toys: [], ownedToys: ['rope'] }];

    repairGameState(state);
    const afterFirst = JSON.stringify(state.pets);
    const second = repairGameState(state);

    expect(JSON.stringify(state.pets)).toBe(afterFirst);
    expect(second.repairs.filter((r) => /ownedToys/.test(r))).toEqual([]);
  });

  it('backfills a pet with no toys array at all, and skips already-clean pets', () => {
    const state = partialSave();
    state.pets = [
      { id: 'clean', toys: ['ball'] }, // already canonical → untouched
      { id: 'legacy' }, // neither array → gets an empty canonical `toys`
    ];

    const result = repairGameState(state);

    expect(result.repaired).toBe(true);
    expect(state.pets[0]).toEqual({ id: 'clean', toys: ['ball'] });
    expect(state.pets[1].toys).toEqual([]);
    // Only the one pet needed the collapse.
    expect(result.repairs).toContain('Collapsed legacy pet ownedToys into toys for 1 pet(s)');
  });

  it('leaves a malformed pet entry alone rather than throwing', () => {
    const state = partialSave();
    state.pets = [null, { id: 'p1', toys: ['ball'] }];

    expect(() => repairGameState(state)).not.toThrow();
    expect(state.pets[0]).toBeNull();
  });

  /**
   * F-3: `lastEventWeeksLived` has a v12 migration that seeds it from
   * `weeksLived`, but never had a repair mirror — the last v12 field without
   * one (`discoveredSecrets`, `ribbonCollection`, `checkpoints` and
   * `timeMachineUsesThisLife` all had theirs).
   */
  it('seeds a missing lastEventWeeksLived from weeksLived, exactly like migration 12', () => {
    const state = partialSave();
    state.weeksLived = 417;
    delete state.lastEventWeeksLived;

    const result = repairGameState(state);

    expect(result.repaired).toBe(true);
    // NOT 0: the pity system reads `weeksLived - lastEventWeeksLived`, so a 0 on
    // a character 417 weeks in would read as a 417-week drought and fire an
    // event immediately. `weeksLived` means "the drought starts now".
    expect(state.lastEventWeeksLived).toBe(417);
    expect(state.weeksLived - state.lastEventWeeksLived).toBe(0);
  });

  it('falls back to 0 when weeksLived is itself missing or corrupt', () => {
    const missing = partialSave();
    delete missing.weeksLived;
    delete missing.lastEventWeeksLived;
    repairGameState(missing);
    expect(missing.lastEventWeeksLived).toBe(0);

    const corrupt = partialSave();
    corrupt.weeksLived = Number.NaN;
    delete corrupt.lastEventWeeksLived;
    repairGameState(corrupt);
    expect(corrupt.lastEventWeeksLived).toBe(0);
  });

  it('normalizes a non-numeric lastEventWeeksLived and never overwrites a real one', () => {
    const corrupt = partialSave();
    corrupt.weeksLived = 100;
    corrupt.lastEventWeeksLived = Number.NaN;
    repairGameState(corrupt);
    expect(corrupt.lastEventWeeksLived).toBe(100);

    // A genuine marker is left exactly where the player's last event put it.
    const healthy = partialSave();
    healthy.weeksLived = 100;
    healthy.lastEventWeeksLived = 92;
    const result = repairGameState(healthy);
    expect(healthy.lastEventWeeksLived).toBe(92);
    expect(result.repairs.filter((r) => /lastEventWeeksLived/.test(r))).toEqual([]);
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
