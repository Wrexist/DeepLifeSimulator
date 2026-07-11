/**
 * DatingActions → Contacts recency stamp.
 *
 * A date or a gift is a real "contact" — goOnDate / giveGift now stamp
 * `lastInteractionWeek` and bump `weeklyInteractions` on the partner, so the
 * Contacts recency dot warms and the Attention tab clears for partners too
 * (previously only Call / Hang Out could have, and none did).
 */
import { goOnDate, giveGift } from '@/contexts/game/actions/DatingActions';
import { updateMoney } from '@/contexts/game/actions/MoneyActions';
import { updateStats } from '@/contexts/game/actions/StatsActions';
import { createTestGameState } from '@/__tests__/helpers/createTestGameState';
import type { GameState, Relationship } from '@/contexts/game/types';

const DEPS = { updateMoney, updateStats };

function harness(initial: GameState) {
  let current = initial;
  const setGameState = (updater: any) => {
    current = typeof updater === 'function' ? updater(current) : updater;
  };
  return { setGameState, getState: () => current };
}

function stateWithPartner(partner: Partial<Relationship> = {}): GameState {
  const s = createTestGameState({ weeksLived: 12 });
  s.stats = { ...s.stats, money: 50000, energy: 100 };
  s.relationships = [
    { id: 'p1', name: 'Alex', type: 'partner', relationshipScore: 70, datesCount: 5, personality: 'balanced', gender: 'female', age: 29, ...partner } as Relationship,
  ];
  return s;
}

describe('DatingActions stamp Contacts recency', () => {
  it('goOnDate stamps lastInteractionWeek and bumps weeklyInteractions', () => {
    const { setGameState, getState } = harness(stateWithPartner());
    const r = goOnDate(getState(), setGameState, 'p1', 'coffee', DEPS);
    expect(r.success).toBe(true);
    const rel = getState().relationships![0];
    expect(rel.lastInteractionWeek).toBe(12);
    expect(rel.weeklyInteractions).toBe(1);
  });

  it('giveGift stamps lastInteractionWeek and bumps weeklyInteractions', () => {
    const { setGameState, getState } = harness(stateWithPartner());
    const r = giveGift(getState(), setGameState, 'p1', 'flowers', DEPS);
    expect(r.success).toBe(true);
    const rel = getState().relationships![0];
    expect(rel.lastInteractionWeek).toBe(12);
    expect(rel.weeklyInteractions).toBe(1);
  });

  it('resets weeklyInteractions when the previous interaction was an earlier week', () => {
    const { setGameState, getState } = harness(
      stateWithPartner({ lastInteractionWeek: 9, weeklyInteractions: 4 })
    );
    goOnDate(getState(), setGameState, 'p1', 'coffee', DEPS);
    expect(getState().relationships![0].weeklyInteractions).toBe(1);
    expect(getState().relationships![0].lastInteractionWeek).toBe(12);
  });
});
