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
import { runForOffice } from '@/contexts/game/actions/PoliticalActions';
import { createTestGameState } from '@/__tests__/helpers/createTestGameState';
import nodeFs from 'fs';
import nodePath from 'path';
import type { Dispatch, SetStateAction } from 'react';
import type { Career, GameState, PoliticsState } from '@/contexts/game/types';

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

/**
 * Losing office must not permanently bar you from the ballot.
 *
 * The sibling of the rule above: that one kept the RECORD of the highest office
 * held, this one keeps the ability to run again. `runForOffice` gates the upper
 * rungs on `minWeeksInPrevious` (Mayor 52, Governor 208, Senator/President
 * 260) measured by `weeksInCurrentLevel`, which is
 * `career.accepted ? weeksLived - startedWeeksLived : 0`. The exit sets
 * `accepted: false`, so for every voted-out ex-official that counter is pinned
 * at 0 and can never grow: the gate reads "you need 208 more weeks" forever.
 *
 * One lost re-election therefore ended the political track for good, while the
 * loss notification told the player to "win back the seat by running again".
 * The only re-entry was Council, the single office with no prerequisite, and
 * winning it writes `level: 0` — a full ladder reset.
 *
 * PLAYER REPORT (BBQ, 2026-08-21): "When going from State Representative to
 * Governor on the last day before you're able to promote it automatically puts
 * you back as a Citizen. I tried twice with same result. I had high approval on
 * both attempts." The seat is contested at exactly the tenure that unlocks the
 * next rung (state offices re-elect every 104 weeks; Governor needs 208), and
 * the election roll is seeded on the life and the week — so a reload reproduces
 * the same loss, which is why two attempts gave one answer.
 */
describe('a voted-out ex-official can stand for office again', () => {
  const noop = (() => {}) as unknown as Dispatch<SetStateAction<GameState>>;
  const deps = { updateMoney: (() => {}) as unknown as typeof import('@/contexts/game/actions/MoneyActions').updateMoney };

  /** A former State Representative (ladder index 2), voted out, with funds. */
  function votedOutStateRep(): GameState {
    return createTestGameState({
      careers: [{ ...POLITICAL_CAREER, level: 2, applied: false, accepted: false, progress: 0 }],
      politics: politicsAfterExit({ campaignFunds: 500_000, approvalRating: 70 }),
      stats: { reputation: 90, money: 500_000 },
      date: { age: 45 },
    } as never);
  }

  it('is not refused for tenure it can never accrue', () => {
    const res = runForOffice(votedOutStateRep(), noop, 'governor', deps);
    expect(res.message).not.toMatch(/more weeks in your current position/);
  });

  it('and is still refused a rung it never reached (the control)', () => {
    // Never held State Rep: the prerequisite-level gate must still bite, or the
    // fix would open the whole ladder to anyone who has ever left any office.
    const neverServed = createTestGameState({
      careers: [{ ...POLITICAL_CAREER, level: 0, applied: false, accepted: false, progress: 0 }],
      politics: politicsAfterExit({ campaignFunds: 500_000, approvalRating: 70 }),
      stats: { reputation: 90, money: 500_000 },
      date: { age: 45 },
    } as never);
    const res = runForOffice(neverServed, noop, 'governor', deps);
    expect(res.success).toBe(false);
    expect(res.message).toMatch(/must first serve as/);
  });

  it('a SITTING official still has to serve the time (the other control)', () => {
    // In office, one week in: the tenure gate is a real requirement here.
    const sitting = createTestGameState({
      careers: [{
        ...POLITICAL_CAREER, level: 2, applied: true, accepted: true,
        progress: 0, startedWeeksLived: 1_000,
      }],
      politics: politicsAfterExit({ careerLevel: 3, campaignFunds: 500_000, approvalRating: 70 }),
      stats: { reputation: 90, money: 500_000 },
      date: { age: 45 },
      weeksLived: 1_001,
    } as never);
    const res = runForOffice(sitting, noop, 'governor', deps);
    expect(res.success).toBe(false);
    expect(res.message).toMatch(/more weeks in your current position/);
  });
});

/**
 * A retired lobbyist is not a hired one.
 *
 * `applyOfficeExit` retires every lobbyist to `active: false` but keeps the
 * rows, and the hire guard tested ids only — so after any office exit every
 * lobbyist the player had ever engaged became permanently un-hireable, and the
 * catalogue dropped them too. `fireLobbyist` would have cleared the row but has
 * no call site anywhere in the app, so there was no way out from inside the
 * game. Reported 2026-08-21: "Lobbyist that are inactive from a previous
 * election remain inactive and cannot be re-hired."
 */
describe('lobbyists can be re-hired after an office exit', () => {
  it('the hire guards and the catalogue all test `active`, not just the id', () => {
    const read = (rel: string) =>
      nodeFs.readFileSync(nodePath.join(__dirname, '..', '..', '..', rel), 'utf8');

    const actions = read('contexts/game/actions/PoliticalActions.ts');
    // Outer guard and the same-batch recheck inside the updater must agree.
    expect(actions).toMatch(/some\(l => l\.id === lobbyistId && l\.active !== false\)/);
    expect(actions).toMatch(/some\(\(l\) => l\?\.id === newLobbyist\.id && l\?\.active !== false\)/);
    // Re-hiring replaces the retired row rather than appending a duplicate id.
    expect(actions).toMatch(/filter\(\(l\) => l\?\.id !== newLobbyist\.id\)/);

    // And the picker offers them again.
    expect(read('components/computer/PoliticalApp.tsx'))
      .toMatch(/lobbyists\.filter\(\(l\) => l\.active !== false\)\.map\(\(l\) => l\.id\)/);
  });
});
