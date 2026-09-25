/**
 * A repair run outside a `setGameState` updater must reach React as a NEW
 * object and must never mutate the committed one.
 *
 * The week-progression and health-check branches used to call
 * `repairGameState(committedState)`, which writes its result back onto its
 * input - so the committed object was fixed in place, the updater's second
 * repair found nothing left to fix and returned `prev`, React was never
 * notified, and every selector kept showing the corrupt values.
 */
import { repairedCommit, repairGameState } from '@/utils/saveValidation';
import { createTestGameState } from '../helpers/createTestGameState';

/** A state repairGameState is known to fix (it backfills a missing `loans`). */
function corrupt() {
  const s = createTestGameState({ lastEventWeeksLived: 0 });
  delete (s as { loans?: unknown }).loans;
  return s;
}

function healthy() {
  return createTestGameState({ loans: [], lastEventWeeksLived: 0 });
}

describe('repairedCommit', () => {
  it('commits the repaired clone and leaves the committed object untouched', () => {
    const committed = corrupt();
    const clone = { ...committed };
    expect(repairGameState(clone).repaired).toBe(true);

    const next = repairedCommit(committed, committed, clone);
    expect(next).toBe(clone);
    expect(next).not.toBe(committed);
    expect(committed.loans).toBeUndefined();
    expect(Array.isArray(next.loans)).toBe(true);
  });

  it('repairs a newer state on a clone when the state has moved on', () => {
    const committed = corrupt();
    const clone = { ...committed };
    repairGameState(clone);
    const newer = corrupt();

    const next = repairedCommit(newer, committed, clone);
    expect(next).not.toBe(newer);
    expect(next).not.toBe(clone);
    expect(Array.isArray(next.loans)).toBe(true);
    expect(newer.loans).toBeUndefined();
  });

  it('returns prev unchanged when the newer state needs nothing', () => {
    const committed = corrupt();
    const clone = { ...committed };
    repairGameState(clone);
    const fine = healthy();
    expect(repairGameState({ ...fine }).repaired).toBe(false);
    expect(repairedCommit(fine, committed, clone)).toBe(fine);
  });
});
