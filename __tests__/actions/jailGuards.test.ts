/**
 * Jail guards on active player actions.
 *
 * `isPlayerJailed` gates actions that make no sense from a cell — career
 * advancement / raise requests, founding a company, and active dating (going on
 * dates, proposing). It is deliberately SEPARATE from the death block
 * (`isPlayerBlocked` / `rejectIfBlocked`): a jailed-but-alive player is refused
 * these actions, while jail-native actions (serving time, paying bail, jail
 * activities) stay available and are only gated by the death block.
 */
import {
  isPlayerJailed,
  isPlayerBlocked,
  rejectIfBlocked,
} from '@/contexts/game/actions/_guards';
import { createCompany } from '@/contexts/game/actions/CompanyActions';
import { goOnDate, proposeMarriage } from '@/contexts/game/actions/DatingActions';
import { updateMoney } from '@/contexts/game/actions/MoneyActions';
import { updateStats } from '@/contexts/game/actions/StatsActions';
import { createTestGameState } from '@/__tests__/helpers/createTestGameState';
import type { GameState, Relationship } from '@/contexts/game/types';

const DEPS = { updateMoney, updateStats };
const noopSet = (() => {}) as React.Dispatch<React.SetStateAction<GameState>>;

function withPartner(overrides: Partial<GameState> = {}): GameState {
  const s = createTestGameState({ weeksLived: 5, ...overrides });
  s.stats = { ...s.stats, money: 5_000_000, energy: 100 };
  s.relationships = [
    { id: 'p1', name: 'Alex', type: 'partner', relationshipScore: 85, datesCount: 10 } as Relationship,
  ];
  return s;
}

describe('isPlayerJailed', () => {
  it('is true only when jailWeeks > 0', () => {
    expect(isPlayerJailed(createTestGameState({ jailWeeks: 0 }))).toBe(false);
    expect(isPlayerJailed(createTestGameState({ jailWeeks: 3 }))).toBe(true);
  });

  it('does not conflate incarceration with the death block', () => {
    const jailedAlive = createTestGameState({ jailWeeks: 4, showDeathPopup: false });
    expect(isPlayerJailed(jailedAlive)).toBe(true);
    expect(isPlayerBlocked(jailedAlive)).toBe(false); // jail is not a death block
    expect(rejectIfBlocked(jailedAlive)).toBeNull();
  });
});

describe('active actions refuse from a jail cell', () => {
  it('createCompany refuses while jailed (even fully funded + qualified)', () => {
    const state = createTestGameState({
      jailWeeks: 4,
      companies: [],
      educations: [
        { id: 'entrepreneurship', name: 'Entrepreneurship', description: '', cost: 0, duration: 0, completed: true },
      ],
    });
    state.stats = { ...state.stats, money: 5_000_000 };
    const res = createCompany(state, noopSet, 'factory', { updateMoney });
    expect(res.success).toBe(false);
    expect(res.message).toMatch(/jail/i);
  });

  it('goOnDate refuses while jailed', () => {
    const res = goOnDate(withPartner({ jailWeeks: 2 }), noopSet, 'p1', 'coffee', DEPS);
    expect(res.success).toBe(false);
    expect(res.message).toMatch(/jail/i);
  });

  it('proposeMarriage refuses while jailed (accepted:false)', () => {
    const res = proposeMarriage(withPartner({ jailWeeks: 1 }), noopSet, 'p1', 'simple_band', DEPS);
    expect(res.success).toBe(false);
    expect(res.accepted).toBe(false);
    expect(res.message).toMatch(/jail/i);
  });

  it('the same actions pass the jail gate when NOT jailed', () => {
    // goOnDate is the cleanest end-to-end control (no ring/score gating).
    const res = goOnDate(withPartner({ jailWeeks: 0 }), noopSet, 'p1', 'coffee', DEPS);
    expect(res.success).toBe(true);
  });
});
