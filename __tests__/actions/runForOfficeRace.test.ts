/**
 * Weekly-audit regression (2026-07-02): `runForOffice` must apply the election
 * reward AT MOST ONCE per election. Before, the age/reputation/money gates were
 * read from the stale outer `gameState` snapshot while the won-branch updater
 * credited `money - campaignCost + reward` with no idempotency re-check — so two
 * same-batch taps both passed the outer gates, both won the (up to $5M) reward,
 * and the player pocketed the bonus twice for one election. The fix re-checks
 * affordability and idempotency (`lastElectionWeek` + `careerLevel`) against
 * `prev` inside the updater, so a duplicate same-week tap no-ops.
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
    careers: [{ ...POLITICAL_CAREER, level: 0, progress: 0, applied: true, accepted: true }] as never,
    politics: {
      careerLevel: 0, approvalRating: 50, policyInfluence: 0, electionsWon: 0,
      policiesEnacted: [], lobbyists: [], alliances: [], campaignFunds: 0,
    } as never,
    karma: undefined as never,
  });
}

describe('runForOffice same-batch race regression (weekly audit 2026-07-02)', () => {
  let rand: jest.SpyInstance;
  beforeEach(() => { rand = jest.spyOn(Math, 'random').mockReturnValue(0); }); // roll 0 → guaranteed win
  afterEach(() => { rand.mockRestore(); });

  it('two same-batch taps award the election bonus ONCE', () => {
    const snapshot = candidateState(5000); // exactly one campaign
    const { setState, get } = makeBatchedSetState(snapshot);

    runForOffice(snapshot, setState, 'council_member', deps);
    runForOffice(snapshot, setState, 'council_member', deps); // stale snapshot → double-tap

    // one win: 5000 - 5000 + 10000 = 10000 (NOT 15000 from a double reward)
    expect(get().stats.money).toBe(10000);
    expect(get().politics?.electionsWon).toBe(1);
  });

  it('a single valid campaign still wins and pays the bonus', () => {
    const snapshot = candidateState(5000);
    const { setState, get } = makeBatchedSetState(snapshot);

    const res = runForOffice(snapshot, setState, 'council_member', deps);

    expect(res.success).toBe(true);
    expect(get().stats.money).toBe(10000);
    expect(get().politics?.careerLevel).toBe(0);
    expect(get().politics?.electionsWon).toBe(1);
  });
});
