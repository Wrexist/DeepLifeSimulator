/**
 * The tick's ambition payout: the `wasDue` gate and the wording it produces.
 *
 * `grantAmbitionPayout` (the pure reducer underneath) is well covered in
 * `lib/ambitions/__tests__`, and that coverage is what made this file look
 * unnecessary — but the two things this wrapper adds are exactly the things the
 * reducer's tests cannot see (2026-08-16 audit L17):
 *
 *  1. `wasDue` is read from the state BEFORE the reducer runs. If it were read
 *     after — from the reducer's own output, which sets `ambitionRewardClaimed`
 *     — `granted` would be false on the paying week and true on none, and the
 *     player would be paid the largest reward in the game in silence. The
 *     reducer would pass all of its own tests either way.
 *  2. The notification is the ONLY thing that tells the player it happened, and
 *     it deliberately omits prestige points when the save has no prestige
 *     record, because that portion of the payoff is not credited then. A
 *     message promising points the state never received is a support ticket.
 *
 * `applyAmbitionPayout` is pure — no setGameState, no wall-clock, no rolls — so
 * it is driven directly rather than through the tick (hence no `zeroPreRolls`
 * here; there is nothing random to pin).
 */
import { applyAmbitionPayout } from '../applyAmbitionPayout';
import { createTestGameState } from '@/__tests__/helpers/createTestGameState';
import { LIFE_AMBITIONS } from '@/lib/ambitions/catalog';
import type { GameState } from '@/contexts/game/types';

const AMBITION = LIFE_AMBITIONS[0];
const ALL_MILESTONES = AMBITION.milestones.map((m) => m.id);

/** A life that has reached every milestone of `AMBITION` and not been paid. */
function stateWithCompletedAmbition(overrides: Partial<GameState> = {}): GameState {
  const base = createTestGameState();
  return {
    ...base,
    ambitionId: AMBITION.id,
    // Milestones are STICKY: anything persisted here counts as reached, so the
    // gate is exercised without having to build a $25M business empire.
    ambitionCompletedMilestones: [...ALL_MILESTONES],
    ambitionRewardClaimed: false,
    prestige: base.prestige ? { ...base.prestige, claimedAmbitions: [] } : base.prestige,
    ...overrides,
  };
}

describe('applyAmbitionPayout', () => {
  it('does nothing for a life with no chosen ambition', () => {
    const state = { ...createTestGameState(), ambitionId: undefined };
    const result = applyAmbitionPayout({ state });
    expect(result.state).toBeNull();
    expect(result.granted).toBe(false);
    expect(result.notifications).toHaveLength(0);
  });

  it('stages milestone progress without paying when the ambition is unfinished', () => {
    const base = createTestGameState();
    const state: GameState = {
      ...base,
      ambitionId: AMBITION.id,
      ambitionCompletedMilestones: [],
      ambitionRewardClaimed: false,
    };
    const result = applyAmbitionPayout({ state });
    expect(result.granted).toBe(false);
    expect(result.notifications).toHaveLength(0);
    // Whatever it does to staged progress, it must not move money.
    if (result.state) {
      expect(result.state.stats.money).toBe(state.stats.money);
      expect(result.state.ambitionRewardClaimed).toBeFalsy();
    }
  });

  it('fires exactly once on the week the ambition comes due', () => {
    const state = stateWithCompletedAmbition();
    const moneyBefore = state.stats.money;
    const gemsBefore = state.stats.gems ?? 0;

    const first = applyAmbitionPayout({ state });

    expect(first.granted).toBe(true);
    expect(first.state).not.toBeNull();
    const paid = first.state!;
    expect(paid.stats.money).toBe(moneyBefore + (AMBITION.payoff.money ?? 0));
    expect(paid.stats.gems ?? 0).toBe(gemsBefore + (AMBITION.payoff.gems ?? 0));
    expect(paid.ambitionRewardClaimed).toBe(true);
  });

  it('does not fire again on the following week', () => {
    const first = applyAmbitionPayout({ state: stateWithCompletedAmbition() });
    expect(first.state).not.toBeNull();
    const paid = first.state!;
    const moneyAfterPayout = paid.stats.money;

    const second = applyAmbitionPayout({ state: paid });

    expect(second.granted).toBe(false);
    expect(second.notifications).toHaveLength(0);
    // Whether it returns `null` (nothing changed) or a state, the money must not move.
    expect((second.state ?? paid).stats.money).toBe(moneyAfterPayout);
  });

  it('refuses an ambition already claimed in a PREVIOUS life', () => {
    const base = stateWithCompletedAmbition();
    if (!base.prestige) throw new Error('createTestGameState must carry a prestige record');
    const state: GameState = {
      ...base,
      prestige: { ...base.prestige, claimedAmbitions: [AMBITION.id] },
    };
    const result = applyAmbitionPayout({ state });
    expect(result.granted).toBe(false);
    expect(result.notifications).toHaveLength(0);
    expect((result.state ?? state).stats.money).toBe(state.stats.money);
  });

  it('announces the payout with the ambition name and a stable, dedupable id', () => {
    const result = applyAmbitionPayout({ state: stateWithCompletedAmbition() });

    expect(result.notifications).toHaveLength(1);
    const note = result.notifications[0];
    // The flush dedupes by id, so a StrictMode double-invoke must not produce
    // two distinguishable toasts.
    expect(note.id).toBe(`ambition-fulfilled-${AMBITION.id}`);
    expect(note.title).toContain(AMBITION.name);
    expect(note.title).toContain(AMBITION.emoji);
    expect(note.message).toContain('gems');
    expect(note.message).toContain('prestige points');
  });

  it('does not promise prestige points to a save with no prestige record', () => {
    // The points genuinely are not credited without a prestige record, so the
    // message must not claim them.
    const state = stateWithCompletedAmbition({ prestige: undefined });
    const result = applyAmbitionPayout({ state });

    expect(result.granted).toBe(true);
    expect(result.notifications).toHaveLength(1);
    expect(result.notifications[0].message).not.toContain('prestige points');
  });
});
