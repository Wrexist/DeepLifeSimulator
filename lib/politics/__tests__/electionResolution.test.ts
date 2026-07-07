/**
 * Politics election loop — the previously-missing resolution that turned the
 * whole feature from a locked door into a playable career.
 *
 * Covers:
 *  - runForOffice sets the 1-based office RANK on politics.careerLevel (Council=1,
 *    not 0) and marks the career accepted, so the office actually "sticks".
 *  - runPoliticsWeeklyTick resolves re-elections when the term ends: incumbents
 *    win with decent approval, and are voted out (careerLevel→0) with poor approval.
 */
import { runPoliticsWeeklyTick } from '../weeklyTick';
import { runForOffice } from '@/contexts/game/actions/PoliticalActions';
import { updateMoney } from '@/contexts/game/actions/MoneyActions';
import type { GameState, PoliticsState } from '@/contexts/game/types';

function basePolitics(over: Partial<PoliticsState> = {}): PoliticsState {
  return {
    careerLevel: 1, approvalRating: 60, policyInfluence: 0, electionsWon: 1,
    policiesEnacted: [], lobbyists: [], alliances: [], campaignFunds: 0,
    ...over,
  } as PoliticsState;
}

const tickInput = (politics: PoliticsState, currentWeek: number, roll: number) => ({
  politics, currentWeek, rollFor: (_: string) => roll,
});

describe('runPoliticsWeeklyTick — re-election', () => {
  it('does nothing before the term ends', () => {
    const r = runPoliticsWeeklyTick(tickInput(basePolitics({ nextElectionWeek: 100 }), 40, 0.99));
    expect(r.lostOffice).toBe(false);
    expect(r.politics.careerLevel).toBe(1);
    expect(r.politics.nextElectionWeek).toBe(100);
  });

  it('re-elects a decent-approval incumbent and reschedules the next election', () => {
    // approval 60 → chance ≈ 45 + 27 + tenure ≈ 73; roll 0.10 (10%) wins.
    const r = runPoliticsWeeklyTick(tickInput(basePolitics({ approvalRating: 60, nextElectionWeek: 52 }), 52, 0.10));
    expect(r.lostOffice).toBe(false);
    expect(r.politics.careerLevel).toBe(1);
    expect((r.politics.electionsWon ?? 0)).toBeGreaterThan(1);
    expect(r.politics.nextElectionWeek).toBeGreaterThan(52);
    expect(r.notifications.some(n => /Re-elected/i.test(n.title))).toBe(true);
  });

  it('votes out a low-approval incumbent (careerLevel → 0, office lost)', () => {
    // approval 10 → chance ≈ 45 + 4.5 + tenure ≈ 50; roll 0.95 (95%) loses.
    const r = runPoliticsWeeklyTick(tickInput(basePolitics({ approvalRating: 10, electionsWon: 0, nextElectionWeek: 52 }), 52, 0.95));
    expect(r.lostOffice).toBe(true);
    expect(r.politics.careerLevel).toBe(0);
    expect(r.politics.nextElectionWeek).toBeUndefined();
    expect(r.notifications.some(n => /Voted Out/i.test(n.title))).toBe(true);
  });

  it('a citizen (careerLevel 0) gets a quiet tick — no election', () => {
    const r = runPoliticsWeeklyTick(tickInput(basePolitics({ careerLevel: 0, nextElectionWeek: 10 }), 52, 0.01));
    expect(r.lostOffice).toBe(false);
    expect(r.politics.careerLevel).toBe(0);
  });
});

describe('runForOffice — office rank semantics', () => {
  function makeState(): GameState {
    return {
      weeksLived: 200,
      date: { age: 40 },
      stats: { money: 50_000, reputation: 60 },
      educations: [{ id: 'business_degree', completed: true }],
      careers: [],
      politics: basePolitics({ careerLevel: 0, electionsWon: 0 }),
    } as unknown as GameState;
  }

  it('winning Council sets careerLevel to rank 1 (not 0) and marks the career accepted', () => {
    let state = makeState();
    const setGameState = (u: any) => { state = typeof u === 'function' ? u(state) : u; };
    // Force a win by stubbing Math.random low via a high approval/reputation is
    // simpler: reputation 60 + approval 60 give a high success chance; retry a
    // few times to avoid the rare RNG loss making the test flaky.
    let won = false;
    for (let i = 0; i < 25 && !won; i++) {
      state = makeState();
      const res = runForOffice(state, setGameState, 'council_member', { updateMoney });
      won = res.success;
    }
    expect(won).toBe(true);
    expect(state.politics?.careerLevel).toBe(1); // rank, not index
    const career = (state.careers ?? []).find(c => c.id === 'political');
    expect(career?.accepted).toBe(true);
    expect(career?.level).toBe(0); // 0-based index for salary
    expect(state.politics?.nextElectionWeek).toBeGreaterThan(state.weeksLived ?? 0);
  });
});
