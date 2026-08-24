/**
 * Breaching a contract has to actually cost you.
 *
 * `breachBrandDeal` committed the breach inside the `setGameState` updater —
 * deal removed from `activeBrandDeals`, history row written, notification
 * pushed — and then charged the penalty AFTERWARDS via `updateMoney`.
 *
 * `updateMoney` is all-or-nothing: it returns `prev` unchanged when the debit
 * would take the balance negative. No partial charge, no debt, and no rollback
 * of the breach that had already landed. So a player who moved their cash into
 * a bank account first could breach every contract for free — keeping the 25%
 * signing bonus `acceptBrandDeal` pays up front — while the returned message
 * still read "Contract breached. -$X".
 *
 * The existing suite did not catch it because it only asserted `penalty > 0`
 * and the reputation drop; it never asserted that money moved. That is exactly
 * how this survived. 2026-07-30 audit ECON-R1-03.
 */
import { breachBrandDeal } from '@/contexts/game/actions/PulseActions';
import { createTestGameState } from '../helpers/createTestGameState';
import type { GameState } from '@/contexts/game/types';

const DEAL_ID = 'deal-1';

function withDeal(money: number, weeklyPayment = 5_000, expiresAt = 20): GameState {
  const base = createTestGameState();
  return createTestGameState({
    weeksLived: 10,
    stats: { ...base.stats, money, reputation: 60 },
    socialMedia: {
      ...(base.socialMedia ?? {}),
      followers: 50_000,
      activeBrandDeals: [
        {
          id: DEAL_ID,
          brandName: 'Nova Athletics',
          payment: 20_000,
          weeklyPayment,
          expiresAt,
        },
      ],
      brandInbox: { pending: [], declined: [], history: [] },
      notifications: [],
    } as never,
  });
}

/** Drive the reducer the way the app does and return the resulting state. */
function drive(state: GameState) {
  let current = state;
  const set = ((u: (prev: GameState) => GameState) => {
    current = typeof u === 'function' ? u(current) : u;
  }) as never;
  const result = breachBrandDeal(current, set, DEAL_ID);
  return { result, state: current };
}

const dealsOf = (s: GameState) => (s.socialMedia?.activeBrandDeals ?? []) as { id: string }[];

describe('a breach the player can afford', () => {
  it('actually debits the penalty - the assertion the old suite never made', () => {
    const before = withDeal(1_000_000);
    const { result, state } = drive(before);

    expect(result.success).toBe(true);
    expect(result.penalty).toBeGreaterThan(0);
    // The whole finding in one line.
    expect(state.stats.money).toBe(before.stats.money - result.penalty);
  });

  it('removes the deal and drops reputation', () => {
    const { state } = drive(withDeal(1_000_000));

    expect(dealsOf(state).some((d) => d.id === DEAL_ID)).toBe(false);
    expect(state.stats.reputation).toBe(50);
  });

  it('records the breach in the brand inbox history', () => {
    const { state } = drive(withDeal(1_000_000));
    const history = (state.socialMedia?.brandInbox?.history ?? []) as { id: string; result?: string }[];

    expect(history.some((h) => h.id === DEAL_ID && h.result === 'breached')).toBe(true);
  });
});

describe('a breach the player cannot afford', () => {
  it('is REFUSED rather than granted for free', () => {
    // The exploit shape: cash parked in a bank account, wallet nearly empty.
    const before = withDeal(50);
    const { result, state } = drive(before);

    expect(result.success).toBe(false);
    // Nothing may have moved.
    expect(state.stats.money).toBe(before.stats.money);
  });

  it('leaves the deal ACTIVE - the breach must not land without the charge', () => {
    const { state } = drive(withDeal(50));

    expect(dealsOf(state).some((d) => d.id === DEAL_ID)).toBe(true);
  });

  it('does not drop reputation for a breach that never happened', () => {
    const before = withDeal(50);
    const { state } = drive(before);

    expect(state.stats.reputation).toBe(before.stats.reputation);
  });

  it('writes no history row', () => {
    const { state } = drive(withDeal(50));
    const history = (state.socialMedia?.brandInbox?.history ?? []) as { id: string }[];

    expect(history.some((h) => h.id === DEAL_ID)).toBe(false);
  });

  it('tells the player why, and quotes the amount', () => {
    const { result } = drive(withDeal(50));

    expect(result.message).toMatch(/cannot afford/i);
    expect(result.penalty).toBeGreaterThan(0);
  });
});

describe('double-tap safety', () => {
  it('charges once when two taps read the same stale snapshot', () => {
    const before = withDeal(1_000_000);
    let current = before;
    const set = ((u: (prev: GameState) => GameState) => {
      current = u(current);
    }) as never;

    // Both taps hand the SAME stale snapshot — a double tap in one React batch.
    const first = breachBrandDeal(before, set, DEAL_ID);
    breachBrandDeal(before, set, DEAL_ID);

    // The second call finds no deal in `prev` and returns it unchanged.
    expect(current.stats.money).toBe(before.stats.money - first.penalty);
  });

  it('refuses a deal id that does not exist', () => {
    const before = withDeal(1_000_000);
    let current = before;
    const set = ((u: (prev: GameState) => GameState) => {
      current = u(current);
    }) as never;

    const result = breachBrandDeal(before, set, 'no-such-deal');

    expect(result.success).toBe(false);
    expect(current.stats.money).toBe(before.stats.money);
  });
});
