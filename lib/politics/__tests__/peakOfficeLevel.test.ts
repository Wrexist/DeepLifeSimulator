/**
 * S2 (owner decisions, 2026-10-23): winning a LOWER office must not erase the
 * record of the highest office held.
 *
 * `highestOfficeHeld` derived the peak from `careers.political.level`, which
 * the voted-out exit deliberately keeps - and which the NEXT election win
 * overwrites. A former Governor (rank 4) who won back a Council seat came out
 * as rank 1, and lost the ambassadorship, lobbying and board posts the
 * governorship had earned. v58 stores `politics.peakOfficeLevel`.
 */
import type { Dispatch, SetStateAction } from 'react';
import { highestOfficeHeld, nextPeakOfficeLevel } from '../lifeOperations';
import { appointmentBlocker, findAppointment } from '../appointments';
import { POLITICAL_CAREER } from '@/lib/careers/political';
import { runForOffice } from '@/contexts/game/actions/PoliticalActions';
import { createTestGameState } from '@/__tests__/helpers/createTestGameState';
import type { GameState, PoliticsState } from '@/contexts/game/types';

function politics(over: Partial<PoliticsState> = {}): PoliticsState {
  return {
    careerLevel: 0,
    approvalRating: 80,
    policyInfluence: 0,
    electionsWon: 3,
    policiesEnacted: [],
    lobbyists: [],
    alliances: [],
    campaignFunds: 500_000,
    ...over,
  };
}

/** A former Governor (ladder index 3, rank 4), voted out, at `weeksLived`. */
function formerGovernor(weeksLived: number, over: Partial<PoliticsState> = {}): GameState {
  return createTestGameState({
    careers: [{ ...POLITICAL_CAREER, level: 3, applied: false, accepted: false, progress: 0 }],
    politics: politics(over),
    stats: { reputation: 95, money: 5_000_000 },
    date: { age: 50 },
    educations: [{ id: 'business_degree', completed: true }],
    weeksLived,
  } as never);
}

/** Run for Council until the seeded roll wins, returning the committed state. */
function winCouncil(over: Partial<PoliticsState> = {}): GameState {
  const deps = { updateMoney: (() => {}) as unknown as typeof import('@/contexts/game/actions/MoneyActions').updateMoney };
  for (let w = 3_000; w < 3_400; w++) {
    const prev = formerGovernor(w, over);
    let next: GameState = prev;
    const set = ((action: SetStateAction<GameState>) => {
      next = typeof action === 'function' ? action(next) : action;
    }) as Dispatch<SetStateAction<GameState>>;
    const res = runForOffice(prev, set, 'council_member', deps);
    if (res.success) return next;
  }
  throw new Error('no winning Council roll found in 400 weeks');
}

describe('S2: a lower office does not overwrite the peak', () => {
  it('the precondition: a voted-out Governor reads as rank 4', () => {
    expect(highestOfficeHeld(formerGovernor(3_000))).toBe(4);
  });

  it('winning a Council seat keeps rank 4 (was 1)', () => {
    const after = winCouncil();
    // The win really did overwrite the career record...
    expect(after.careers.find((c) => c.id === 'political')?.level).toBe(0);
    expect(after.politics?.careerLevel).toBe(1);
    // ...and the stored peak is what still remembers the governorship.
    expect(after.politics?.peakOfficeLevel).toBe(4);
    expect(highestOfficeHeld(after)).toBe(4);
  });

  it('so the appointments the governorship earned stay open', () => {
    const after = winCouncil();
    const blocker = appointmentBlocker(findAppointment('board_seat'), {
      highestOfficeHeld: highestOfficeHeld(after),
      inOffice: false,
      reputation: 95,
    });
    expect(blocker ?? '').not.toMatch(/served as .* or above/);
  });

  it('a stored peak above the derivation still wins (an earlier, higher office)', () => {
    const after = winCouncil({ peakOfficeLevel: 6 });
    expect(after.politics?.peakOfficeLevel).toBe(6);
    expect(highestOfficeHeld(after)).toBe(6);
  });
});

describe('S2: absence resolves (pre-v58 saves)', () => {
  it('no stored peak reads exactly the old derivation', () => {
    const s = formerGovernor(3_000);
    expect(s.politics?.peakOfficeLevel).toBeUndefined();
    expect(highestOfficeHeld(s)).toBe(4);
  });

  it('the stamp folds the derivation in before the overwrite', () => {
    expect(nextPeakOfficeLevel(formerGovernor(3_000), 1)).toBe(4);
    expect(nextPeakOfficeLevel(formerGovernor(3_000), 6)).toBe(6);
  });

  it('a malformed stored value is ignored, not trusted', () => {
    const s = formerGovernor(3_000, { peakOfficeLevel: Number.NaN });
    expect(highestOfficeHeld(s)).toBe(4);
  });
});
