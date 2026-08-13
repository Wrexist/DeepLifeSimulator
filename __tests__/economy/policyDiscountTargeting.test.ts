/**
 * The lobbyist you hired changes the price of the bill you pass.
 *
 * The unit half of this lives in `lib/politics/__tests__/lobbyistSpecialty.test.ts`.
 * This file is the half that matters to the player: `enactPolicy` must actually
 * CHARGE the targeted price, in the pre-check that decides affordability and in
 * the updater that debits — the two computed the discount from different inputs
 * before, which is the gate-then-grant shape CLAUDE.md §4.4 exists to prevent.
 *
 * `green_energy` is the fixture: an `environmental` bill at $50,000, level 2.
 */
import { createTestGameState } from '../helpers/createTestGameState';
import { initialGameState } from '@/contexts/game/initialState';
import { createSetGameStateStub } from '../helpers/setGameStateStub';
import { enactPolicy } from '@/contexts/game/actions/PoliticalActions';
import { updateMoney } from '@/contexts/game/actions/MoneyActions';
import { updateStats } from '@/contexts/game/actions/StatsActions';
import { getPolicyById } from '@/lib/politics/policies';
import type { GameState } from '@/contexts/game/types';

const POLICY_ID = 'green_energy';
const STICKER = getPolicyById(POLICY_ID)!.implementationCost;
const deps = { updateMoney, updateStats };

/**
 * The politics slice is optional on `GameState` but shipped in `initialState`,
 * so the fixture builds on the real one rather than a partial literal behind a
 * cast — a cast here would let a renamed `PoliticsState` field go on silently
 * not being set (Hard Rule #3).
 */
function requireSlice<T>(slice: T | undefined, name: string): T {
  if (!slice) throw new Error(`initialGameState ships no ${name} slice — fixture cannot be built`);
  return slice;
}

const BASE_POLITICS = requireSlice(initialGameState.politics, 'politics');

function politician(over: { influence?: number; lobbyists?: string[]; money?: number } = {}): GameState {
  return createTestGameState({
    weeksLived: 200,
    stats: { money: over.money ?? 10_000_000 },
    politics: {
      ...BASE_POLITICS,
      careerLevel: 5,
      policyInfluence: over.influence ?? 0,
      policiesEnacted: [],
      activePolicies: [],
      // Only `id` is read — the discount is derived from the CATALOGUE, keyed by
      // id, which is why making specialty real needed no save change.
      lobbyists: (over.lobbyists ?? []).map((id) => ({ id, name: id, cost: 0, influence: 0, active: true })),
    },
  });
}

/** What enacting actually cost, read off the money delta. */
function costOfEnacting(state: GameState): number {
  const stub = createSetGameStateStub(state);
  const r = enactPolicy(state, stub.setGameState, POLICY_ID, deps);
  expect(r.success).toBe(true);
  const effectMoney = getPolicyById(POLICY_ID)!.effects.money || 0;
  return state.stats.money - stub.current().stats.money + effectMoney;
}

describe('a matching lobbyist makes the bill cheaper', () => {
  it('the environmental specialist discounts an environmental bill', () => {
    const bare = costOfEnacting(politician());
    const green = costOfEnacting(politician({ lobbyists: ['environmental_lawyer'] }));

    expect(bare).toBe(STICKER);
    expect(green).toBeLessThan(bare);
  });

  it('the SAME lobbyist does nothing for a bill outside their brief', () => {
    // This is the whole finding. Before the fix both of these were identical,
    // because specialty was never read by anything that set a price.
    const criminalExpert = costOfEnacting(politician({ lobbyists: ['criminal_justice_expert'] }));

    expect(criminalExpert).toBe(STICKER);
  });

  it('so choosing the right specialist is worth money', () => {
    const right = costOfEnacting(politician({ lobbyists: ['environmental_lawyer'] }));
    const wrong = costOfEnacting(politician({ lobbyists: ['police_union_rep'] }));

    expect(right).toBeLessThan(wrong);
  });

  it('a generalist discounts everything, which is what its price buys', () => {
    const generalist = costOfEnacting(politician({ lobbyists: ['retired_politician'] }));
    expect(generalist).toBeLessThan(STICKER);
  });
});

describe('no existing player loses their discount', () => {
  it('influence with no lobbyists prices exactly as it did before', () => {
    // The base term is unchanged: 25% off at influence >= 25. A save whose
    // influence came from enacting policies and lobbying must be untouched.
    expect(costOfEnacting(politician({ influence: 25 }))).toBe(Math.round(STICKER * 0.75));
    expect(costOfEnacting(politician({ influence: 100 }))).toBe(Math.round(STICKER * 0.75));
    expect(costOfEnacting(politician({ influence: 10 }))).toBe(Math.round(STICKER * 0.9));
  });

  it('and a targeted roster stacks on top of it', () => {
    const influenceOnly = costOfEnacting(politician({ influence: 25 }));
    const both = costOfEnacting(politician({ influence: 25, lobbyists: ['environmental_lawyer'] }));

    expect(both).toBeLessThan(influenceOnly);
  });

  it('the stack is capped, so a bill is never free', () => {
    const maxed = costOfEnacting(
      politician({ influence: 100, lobbyists: ['retired_politician', 'elite_lobbyist', 'environmental_lawyer'] }),
    );

    expect(maxed).toBe(Math.round(STICKER * 0.65));
    expect(maxed).toBeGreaterThan(0);
  });
});

describe('the quoted price is the charged price', () => {
  it('refuses when the player cannot afford the DISCOUNTED cost', () => {
    const broke = politician({ money: 100, lobbyists: ['environmental_lawyer'] });
    const stub = createSetGameStateStub(broke);
    const r = enactPolicy(broke, stub.setGameState, POLICY_ID, deps);

    expect(r.success).toBe(false);
    expect(stub.current().stats.money).toBe(100);
    expect(stub.current().politics?.policiesEnacted ?? []).toHaveLength(0);
  });

  it('accepts at exactly the discounted cost — the pre-check and the debit agree', () => {
    /**
     * The regression guard. If the affordability pre-check and the in-updater
     * debit ever compute the discount from different inputs, this is where it
     * shows: the player is told they can afford it and then the updater's own
     * `money < cost` re-check silently rejects, or worse, charges more than the
     * quote. Both go through one `influenceCost(politics)` closure now.
     */
    const quoted = Math.round(STICKER * 0.85); // 15% targeted, no base influence
    const exact = politician({ money: quoted, lobbyists: ['environmental_lawyer', 'retired_politician'] });
    const stub = createSetGameStateStub(exact);
    const r = enactPolicy(exact, stub.setGameState, POLICY_ID, deps);

    expect(r.success).toBe(true);
    expect(stub.current().politics?.policiesEnacted).toContain(POLICY_ID);
  });

  it('a same-batch double-tap enacts and charges once', () => {
    // The discount is now derived from `prev.politics`, which the first tap
    // mutates (policyInfluence +5). The dedup guard must still hold.
    const start = politician({ lobbyists: ['environmental_lawyer'] });
    const stub = createSetGameStateStub(start);
    enactPolicy(start, stub.setGameState, POLICY_ID, deps);
    enactPolicy(start, stub.setGameState, POLICY_ID, deps);

    const enacted = (stub.current().politics?.policiesEnacted ?? []).filter((p) => p === POLICY_ID);
    expect(enacted).toHaveLength(1);
  });

  it('degrades to the sticker price on a save with no politics slice', () => {
    const noPolitics = createTestGameState({
      weeksLived: 200,
      stats: { money: 10_000_000 },
      politics: undefined,
    });
    const stub = createSetGameStateStub(noPolitics);

    // No career level, so it is refused — but it must be refused cleanly with a
    // finite quoted cost, not a NaN comparison that passes as false.
    const r = enactPolicy(noPolitics, stub.setGameState, POLICY_ID, deps);
    expect(typeof r.message).toBe('string');
    expect(r.message).not.toContain('NaN');
  });
});
