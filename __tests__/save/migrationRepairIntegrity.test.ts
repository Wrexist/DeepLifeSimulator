/**
 * Migration and repair: say what happened, and don't undo what was right.
 *
 * MR-2 — `runMigrations` has a RETURN contract, and two of its three call sites
 * honour it. The primary load path read only `.migrationsApplied` / `.errors`
 * and kept its own `parsed`. Every registered migration happens to mutate in
 * place today, so it works — but a future migration written in the pure style
 * would have had its work silently dropped on the one path that matters most.
 *
 * MR-4 — a save from a NEWER build is refused on purpose (loading it would let
 * the next autosave overwrite it). The refusal returned a bare `null`, the same
 * value an empty slot returns, so the menu told a player holding an intact
 * newer save "No save data found — start a new game".
 *
 * MR-5 — the staking repair tested falsy rather than `undefined`, so a position
 * legitimately staked at absolute week 0 was "migrated" on every load, moving
 * its start and resetting its last-claim week.
 *
 * MR-6 — the invalid-hobby removal set no `repaired` flag. `repairGameState`
 * works on a clone that is written back only when that flag is true, so a load
 * whose only defect was a malformed hobby had the fix computed and discarded,
 * every single time.
 */
import { runMigrations, isSaveFromFutureError, SaveFromFutureError, SAVE_FROM_FUTURE_MESSAGE } from '@/utils/saveMigrations';
import { repairGameState } from '@/utils/saveValidation';
import { STATE_VERSION } from '@/contexts/game/initialState';

describe('a save from a newer build is refused legibly', () => {
  it('is flagged by runMigrations rather than silently downgraded', () => {
    const result = runMigrations({ version: STATE_VERSION + 5 });
    expect(result.versionFromFuture).toBe(true);
  });

  it('is distinguishable from every other failure', () => {
    const err = new SaveFromFutureError();

    expect(isSaveFromFutureError(err)).toBe(true);
    expect(isSaveFromFutureError(new Error('storage exploded'))).toBe(false);
    expect(isSaveFromFutureError(null)).toBe(false);
    expect(isSaveFromFutureError('a string')).toBe(false);
  });

  it('survives the dynamic-import boundary - the check is duck-typed', () => {
    // The load path imports saveMigrations lazily, so a class-identity check
    // could fail across a bundle split. A structurally equivalent object must
    // still be recognised.
    expect(isSaveFromFutureError({ isSaveFromFuture: true })).toBe(true);
  });

  it('tells the player what actually happened, and never to start a new game', () => {
    expect(SAVE_FROM_FUTURE_MESSAGE).toMatch(/newer version/i);
    expect(SAVE_FROM_FUTURE_MESSAGE).toMatch(/has not been changed/i);
    expect(SAVE_FROM_FUTURE_MESSAGE).not.toMatch(/new game/i);
    expect(SAVE_FROM_FUTURE_MESSAGE).not.toMatch(/no save data/i);
  });
});

describe('runMigrations returns the state it produced', () => {
  it('returns a usable state object the caller can adopt', () => {
    const result = runMigrations({ version: 2, weeksLived: 10 });

    expect(result.state).toBeTruthy();
    expect(typeof result.state).toBe('object');
    // The load path now adopts this rather than keeping its own reference, so
    // a migration written in the pure style cannot have its work dropped.
    expect((result.state as { version?: number }).version).toBe(STATE_VERSION);
  });
});

describe('repairGameState does not undo correct data', () => {
  it('leaves a staking position that legitimately started at absolute week 0', () => {
    const state = {
      version: STATE_VERSION,
      weeksLived: 40,
      warehouse: {
        stakingPositions: [
          { startWeek: 0, startAbsoluteWeek: 0, lastClaimAbsoluteWeek: 0, lockWeeks: 4 },
        ],
      },
    } as never as Parameters<typeof repairGameState>[0];

    // repairGameState writes its repaired clone back onto the caller's object
    // (and only when `repaired` is set), so assert on `state`, not the result.
    repairGameState(state);
    const pos = (state as never as { warehouse: { stakingPositions: { startAbsoluteWeek: number }[] } })
      .warehouse.stakingPositions[0];

    // Week 0 is a real absolute week. Testing falsy moved this every load.
    expect(pos.startAbsoluteWeek).toBe(0);
  });

  it('still migrates a genuinely legacy position that has no absolute week at all', () => {
    const state = {
      version: STATE_VERSION,
      weeksLived: 40,
      warehouse: { stakingPositions: [{ startWeek: 2, lockWeeks: 4 }] },
    } as never as Parameters<typeof repairGameState>[0];

    const result = repairGameState(state);
    const pos = (state as never as { warehouse: { stakingPositions: { startAbsoluteWeek?: number }[] } })
      .warehouse.stakingPositions[0];

    expect(typeof pos.startAbsoluteWeek).toBe('number');
    expect(result.repaired).toBe(true);
  });
});

describe('a repair that is computed must also be kept', () => {
  it('flags the removal of a malformed hobby, so the repaired clone is written back', () => {
    const state = {
      version: STATE_VERSION,
      hobbies: [{ id: 'chess', skill: 3 }, null, { skill: 1 }, 'nonsense'],
    } as never as Parameters<typeof repairGameState>[0];

    const result = repairGameState(state);

    // Without the flag, repairGameState drops its own clone and the caller
    // keeps the null entry — on every load, forever.
    expect(result.repaired).toBe(true);
    expect(result.repairs.join(' ')).toMatch(/invalid hobbies/i);

    const hobbies = (state as never as { hobbies: unknown[] }).hobbies;
    expect(hobbies).toHaveLength(1);
    expect((hobbies[0] as { id: string }).id).toBe('chess');
  });

  it('leaves a clean hobby list untouched', () => {
    const state = {
      version: STATE_VERSION,
      hobbies: [{ id: 'chess', skill: 3 }],
    } as never as Parameters<typeof repairGameState>[0];

    const result = repairGameState(state);
    expect(result.repairs.join(' ')).not.toMatch(/invalid hobbies/i);
    expect((state as never as { hobbies: unknown[] }).hobbies).toHaveLength(1);
  });
});
