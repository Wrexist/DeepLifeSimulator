/**
 * Weekly-audit regression (H-8/H-9 same-batch double-tap): entering a hobby
 * tournament must be atomic. Before, `enterHobbyTournament` gated the once-per-
 * week cooldown on the stale render-time snapshot, then wrote the entry marker,
 * deducted energy, and paid the reward in THREE separate updaters with no
 * re-check. Two rapid same-batch taps both passed the stale gate and both paid
 * out (the deterministic roll is identical for both), printing an untaxed,
 * repeatable reward for one week's cooldown. The fix folds the cooldown
 * re-check, energy cost, entry marker, and reward into ONE atomic updater via
 * applyMoneyDelta — mirroring `trainHobby` and PetActions `enterCompetition`.
 */
import { enterHobbyTournament } from '@/contexts/game/actions/HobbyActions';
import { createTestGameState } from '../helpers/createTestGameState';
import type { GameState, Hobby } from '@/contexts/game/types';

const deps = {
  updateMoney: jest.fn() as never,
  updateStats: jest.fn() as never,
}; // signature-only; the atomic path no longer routes money/energy through deps

function makeBatchedSetState(
  initial: GameState
): { setState: React.Dispatch<React.SetStateAction<GameState>>; get: () => GameState } {
  let state = initial;
  const setState: React.Dispatch<React.SetStateAction<GameState>> = update => {
    state = typeof update === 'function' ? update(state) : update;
  };
  return { setState, get: () => state };
}

// skillLevel 14 → winChance = 30 + 14*5 = 100, and the deterministic roll is
// always in (0, 1), so roll*100 < 100 is ALWAYS true → a guaranteed win,
// independent of the lineage seed. Reward = 100 * (1 + 14*0.2) = 380.
function makeWinningHobby(overrides: Partial<Hobby> = {}): Hobby {
  return {
    id: 'guitar',
    name: 'Guitar',
    description: 'Shred',
    energyCost: 10,
    skill: 0,
    skillLevel: 14,
    tournamentReward: 100,
    upgrades: [],
    ...overrides,
  };
}

const EXPECTED_REWARD = 100 * (1 + 14 * 0.2); // 380

describe('Hobby tournament race regressions (weekly audit)', () => {
  it('two same-batch tournament entries pay the reward ONCE and deduct energy once', () => {
    const snapshot = createTestGameState({
      weeksLived: 10,
      stats: { money: 0, energy: 100 } as never,
      hobbies: [makeWinningHobby({ lastTournamentWeek: undefined })] as never,
    });
    const { setState, get } = makeBatchedSetState(snapshot);

    // Both calls receive the SAME stale snapshot — a same-batch double-tap.
    enterHobbyTournament(snapshot, setState, 'guitar', deps);
    enterHobbyTournament(snapshot, setState, 'guitar', deps);

    expect(get().stats.money).toBe(EXPECTED_REWARD); // paid once, not 760
    expect(get().stats.energy).toBe(80); // 20 spent once, not 40
    expect(get().hobbies[0].lastTournamentWeek).toBe(10); // entry marked
  });

  it('a single entry pays exactly the reward and marks the week', () => {
    const snapshot = createTestGameState({
      weeksLived: 7,
      stats: { money: 0, energy: 50 } as never,
      hobbies: [makeWinningHobby({ lastTournamentWeek: undefined })] as never,
    });
    const { setState, get } = makeBatchedSetState(snapshot);

    enterHobbyTournament(snapshot, setState, 'guitar', deps);

    expect(get().stats.money).toBe(EXPECTED_REWARD);
    expect(get().stats.energy).toBe(30);
    expect(get().hobbies[0].lastTournamentWeek).toBe(7);
  });

  it('re-entering the same week (already marked) pays nothing and spends no energy', () => {
    const snapshot = createTestGameState({
      weeksLived: 5,
      stats: { money: 0, energy: 100 } as never,
      hobbies: [makeWinningHobby({ lastTournamentWeek: 5 })] as never,
    });
    const { setState, get } = makeBatchedSetState(snapshot);

    const res = enterHobbyTournament(snapshot, setState, 'guitar', deps);

    expect(res.success).toBe(false);
    expect(get().stats.money).toBe(0);
    expect(get().stats.energy).toBe(100);
  });
});
