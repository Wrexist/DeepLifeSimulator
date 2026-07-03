/**
 * Weekly-audit regression (H-8/H-9 same-batch double-tap): entering an R&D
 * competition must be atomic. Before, `RDActions.enterCompetition` gated the
 * `alreadyEntered` / affordability checks on the stale render-time snapshot,
 * charged the entry fee via `deps.updateMoney` (dispatch #1), then appended the
 * history entry in a SEPARATE `setGameState` (dispatch #2) that never re-checked
 * the gate. Two rapid same-batch taps both passed the stale gate and both
 * appended a duplicate entry — and `processCompetitionResults` sums a prize PER
 * entry, so at resolution the duplicate paid out twice: a repeatable, untaxed
 * money printer. The fix folds the gate re-check, the entry fee (via
 * applyMoneyDelta) and the history append into ONE atomic updater keyed off
 * `prev`, mirroring PetActions/HobbyActions `enterCompetition`.
 */
import { enterCompetition } from '@/contexts/game/actions/RDActions';
import { createTestGameState } from '../helpers/createTestGameState';
import type { GameState } from '@/contexts/game/types';

const deps = { updateMoney: jest.fn() as never }; // signature-only; the atomic path uses applyMoneyDelta

function makeBatchedSetState(
  initial: GameState
): { setState: React.Dispatch<React.SetStateAction<GameState>>; get: () => GameState } {
  let state = initial;
  const setState: React.Dispatch<React.SetStateAction<GameState>> = update => {
    state = typeof update === 'function' ? update(state) : update;
  };
  return { setState, get: () => state };
}

// `quarterly_innovation`: entryCost 5000, requires minTechnologies >= 1, active
// for cycle-weeks 1..12. weeksLived 5 → cycleWeek 5 → active.
const COMPETITION_ID = 'quarterly_innovation';
const ENTRY_COST = 5000;

function makeCompany(overrides: Record<string, unknown> = {}) {
  return {
    id: 'co1',
    name: 'Test Co',
    type: 'tech',
    unlockedTechnologies: ['t1'],
    patents: [],
    competitionHistory: [],
    ...overrides,
  };
}

describe('R&D competition entry race regressions (weekly audit)', () => {
  it('two same-batch competition entries charge the fee ONCE and append ONE entry', () => {
    const snapshot = createTestGameState({
      weeksLived: 5,
      stats: { money: 10000 } as never,
      companies: [makeCompany()] as never,
    });
    const { setState, get } = makeBatchedSetState(snapshot);

    // Both calls receive the SAME stale snapshot — a same-batch double-tap.
    enterCompetition(snapshot, setState, 'co1', COMPETITION_ID, deps);
    enterCompetition(snapshot, setState, 'co1', COMPETITION_ID, deps);

    const co = get().companies!.find(c => c.id === 'co1')!;
    // Duplicate entry would double the eventual prize at resolution — must be 1.
    expect(co.competitionHistory!.filter(e => e.competitionId === COMPETITION_ID).length).toBe(1);
    expect(get().stats.money).toBe(10000 - ENTRY_COST); // charged once, not twice
  });

  it('a single entry charges the fee once and records the entry', () => {
    const snapshot = createTestGameState({
      weeksLived: 5,
      stats: { money: 10000 } as never,
      companies: [makeCompany()] as never,
    });
    const { setState, get } = makeBatchedSetState(snapshot);

    const res = enterCompetition(snapshot, setState, 'co1', COMPETITION_ID, deps);

    expect(res.success).toBe(true);
    const co = get().companies!.find(c => c.id === 'co1')!;
    expect(co.competitionHistory!.length).toBe(1);
    expect(get().stats.money).toBe(10000 - ENTRY_COST);
  });

  it('cannot enter without enough money (no negative balance, no entry)', () => {
    const snapshot = createTestGameState({
      weeksLived: 5,
      stats: { money: 100 } as never, // < 5000 entry fee
      companies: [makeCompany()] as never,
    });
    const { setState, get } = makeBatchedSetState(snapshot);

    const res = enterCompetition(snapshot, setState, 'co1', COMPETITION_ID, deps);

    expect(res.success).toBe(false);
    expect(get().stats.money).toBe(100);
    const co = get().companies!.find(c => c.id === 'co1')!;
    expect(co.competitionHistory!.length).toBe(0);
  });
});
