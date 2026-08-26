/**
 * Losing office must NOT erase the record of the highest office ever held.
 *
 * WEEKLY AUDIT (2026-08-26): the voted-out / scandal-forced-resignation exit in
 * `GameActionsContext` reset the political career entry to
 * `{ accepted: false, applied: false, level: 0 }`. But `careers.political.level`
 * is the ONLY surviving record of peak rank (the tick zeroes `politics.careerLevel`,
 * and only the voluntary-retirement path stamps `retirement.officeLevel`). Zeroing
 * it collapsed every voted-out ex-official to rank 1 in `highestOfficeHeld`, so
 * `appointmentBlocker` barred a former Governor/President from the Ambassador,
 * Lobbyist, Cabinet Secretary and Board Seat posts - the exact appointments the
 * office-exit path exists to unlock ("the lobbying firm that hires you the week
 * you stand down"). The exit now keeps `level` at its peak.
 *
 * These tests pin the contract `highestOfficeHeld` relies on, and demonstrate
 * the regression the old `level: 0` reset produced.
 */
import { highestOfficeHeld } from '../lifeOperations';
import { appointmentBlocker, findAppointment } from '../appointments';
import { POLITICAL_CAREER } from '@/lib/careers/political';
import { createTestGameState } from '@/__tests__/helpers/createTestGameState';
import type { Career, PoliticsState } from '@/contexts/game/types';

// A former Governor (0-based ladder index 3 → rank 4) who has just been voted
// out: the career entry the exit leaves behind - accepted/applied cleared, but
// `level` PRESERVED (the fix). `politics.careerLevel` is 0 (salary stops).
function votedOutGovernorCareer(level = 3): Career {
  return { ...POLITICAL_CAREER, level, applied: false, accepted: false, progress: 0 };
}

function politicsAfterExit(over: Partial<PoliticsState> = {}): PoliticsState {
  return {
    careerLevel: 0, // zeroed by applyOfficeExit - salary is gated on this
    approvalRating: 40,
    policyInfluence: 0,
    electionsWon: 2, // won at least one election in their climb
    policiesEnacted: [],
    lobbyists: [],
    alliances: [],
    campaignFunds: 0,
    ...over,
  };
}

describe('highestOfficeHeld after being voted out', () => {
  it('reports the peak rank reached, not the zeroed sitting level', () => {
    const state = createTestGameState({
      careers: [votedOutGovernorCareer(3)],
      politics: politicsAfterExit(),
    });
    // Governor is ladder index 3 → 1-based rank 4.
    expect(highestOfficeHeld(state)).toBe(4);
  });

  it('would collapse to rank 1 if the exit zeroed `level` (the regression)', () => {
    const buggy = createTestGameState({
      careers: [{ ...votedOutGovernorCareer(3), level: 0 }],
      politics: politicsAfterExit(),
    });
    // electionsWon > 0 still counts them as ever-elected, but at rank 0+1 = 1.
    expect(highestOfficeHeld(buggy)).toBe(1);
  });
});

describe('appointment eligibility for a voted-out ex-Governor', () => {
  const state = createTestGameState({
    careers: [votedOutGovernorCareer(3)],
    politics: politicsAfterExit(),
    stats: { reputation: 90 },
  });
  const held = highestOfficeHeld(state);

  it.each([
    ['ambassador', 2],
    ['lobbyist', 2],
    ['cabinet_secretary', 3],
    ['board_seat', 3],
  ])('qualifies for %s (needs office rank %i)', (id) => {
    const blocker = appointmentBlocker(findAppointment(id), {
      highestOfficeHeld: held,
      inOffice: false,
      reputation: 90,
      party: 'independent',
      partySupport: 100,
    });
    // The office-rank requirement must not be the blocker (null = fully
    // eligible). cabinet_secretary also needs party+support, satisfied above;
    // the point under test is that office rank passes.
    expect(blocker ?? '').not.toMatch(/served as .* or above/);
  });

  it('is barred from those posts under the old `level: 0` reset', () => {
    const buggy = createTestGameState({
      careers: [{ ...votedOutGovernorCareer(3), level: 0 }],
      politics: politicsAfterExit(),
      stats: { reputation: 90 },
    });
    const blocker = appointmentBlocker(findAppointment('lobbyist'), {
      highestOfficeHeld: highestOfficeHeld(buggy),
      inOffice: false,
      reputation: 90,
    });
    expect(blocker).toMatch(/served as .* or above/);
  });
});
