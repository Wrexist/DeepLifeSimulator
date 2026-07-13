/**
 * Weekly-audit regression (2026-07-02): `runForOffice` must apply the election
 * reward AT MOST ONCE per election. Before, the age/reputation/money gates were
 * read from the stale outer `gameState` snapshot while the won-branch updater
 * credited `money - campaignCost + reward` with no idempotency re-check — so two
 * same-batch taps both passed the outer gates, both won the (up to $5M) reward,
 * and the player pocketed the bonus twice for one election. The fix re-checks
 * affordability and idempotency (`lastElectionAttemptWeek`) against `prev`
 * inside the updater, so a duplicate same-week tap no-ops.
 */
import { runForOffice } from '@/contexts/game/actions/PoliticalActions';
import { updateMoney } from '@/contexts/game/actions/MoneyActions';
import { POLITICAL_CAREER } from '@/lib/careers/political';
import { createTestGameState } from '../helpers/createTestGameState';
import type { GameState } from '@/contexts/game/types';

const deps = { updateMoney };

function makeBatchedSetState(initial: GameState) {
  let state = initial;
  const setState: React.Dispatch<React.SetStateAction<GameState>> = (update) => {
    state = typeof update === 'function' ? update(state) : update;
  };
  return { setState, get: () => state };
}

// council_member: minAge 25, minReputation 30, Business Degree. Reward $10k, cost $5k.
function candidateState(money: number): GameState {
  return createTestGameState({
    stats: { money, reputation: 60 } as never,
    date: { age: 40 } as never,
    educations: [{ id: 'business_degree', completed: true }] as never,
    // accepted:false — a first-time candidate who has not yet won the seat.
    // (A sitting Council Member re-running for council is now correctly blocked
    // as an office-already-held farm; this test exercises the same-batch race.)
    careers: [{ ...POLITICAL_CAREER, level: 0, progress: 0, applied: true, accepted: false }] as never,
    politics: {
      careerLevel: 0, approvalRating: 50, policyInfluence: 0, electionsWon: 0,
      policiesEnacted: [], lobbyists: [], alliances: [], campaignFunds: 0,
    } as never,
    karma: undefined as never,
  });
}

describe('runForOffice same-batch race regression (weekly audit 2026-07-02)', () => {
  let rand: jest.SpyInstance;
  beforeEach(() => { rand = jest.spyOn(Math, 'random'); });
  afterEach(() => { rand.mockRestore(); });

  it('two same-batch taps award the election bonus ONCE', () => {
    rand.mockReturnValue(0); // roll 0 → guaranteed win
    const snapshot = candidateState(5000); // exactly one campaign
    const { setState, get } = makeBatchedSetState(snapshot);

    runForOffice(snapshot, setState, 'council_member', deps);
    runForOffice(snapshot, setState, 'council_member', deps); // stale snapshot → double-tap

    // one win: 5000 - 5000 + 10000 = 10000 (NOT 15000 from a double reward)
    expect(get().stats.money).toBe(10000);
    expect(get().politics?.electionsWon).toBe(1);
  });

  it('two same-batch taps that both LOSE charge the campaign cost ONCE', () => {
    rand.mockReturnValue(0.99); // roll 99 → guaranteed loss (successChance ~77)
    const snapshot = candidateState(10000); // enough for TWO campaigns
    const { setState, get } = makeBatchedSetState(snapshot);

    runForOffice(snapshot, setState, 'council_member', deps);
    runForOffice(snapshot, setState, 'council_member', deps); // double-tap

    // charged once (10000 - 5000), NOT twice — the per-week attempt marker no-ops tap 2
    expect(get().stats.money).toBe(5000);
    expect(get().politics?.electionsWon ?? 0).toBe(0);
  });

  it('a win followed by an independently-rolled loss does not re-charge the winner', () => {
    // First tap wins (roll 0), second tap would lose (roll 99) — the attempt marker
    // set by the win must make the second tap no-op instead of charging a phantom loss.
    rand.mockReturnValueOnce(0).mockReturnValue(0.99);
    const snapshot = candidateState(10000);
    const { setState, get } = makeBatchedSetState(snapshot);

    runForOffice(snapshot, setState, 'council_member', deps);
    runForOffice(snapshot, setState, 'council_member', deps);

    // win only: 10000 - 5000 + 10000 = 15000; no extra loss-branch charge
    expect(get().stats.money).toBe(15000);
    expect(get().politics?.electionsWon).toBe(1);
  });

  it('a single valid campaign still wins and pays the bonus', () => {
    rand.mockReturnValue(0);
    const snapshot = candidateState(5000);
    const { setState, get } = makeBatchedSetState(snapshot);

    const res = runForOffice(snapshot, setState, 'council_member', deps);

    expect(res.success).toBe(true);
    expect(get().stats.money).toBe(10000);
    // Council Member is office RANK 1 (careerLevel is 1-based: 0=Citizen … 6=President).
    // This was previously 0, which mislabeled a winner as "Citizen" and left the
    // scandal engine + political events (all gated on careerLevel > 0) switched off.
    expect(get().politics?.careerLevel).toBe(1);
    expect(get().politics?.electionsWon).toBe(1);
  });
});
