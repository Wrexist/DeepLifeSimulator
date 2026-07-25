/**
 * Hosting an event, end to end.
 *
 * The unit tests cover the quote maths; this drives the real action to prove it
 * touches the player's actual social graph — the only luxury action that does.
 */

import { hostLuxuryEvent } from '@/contexts/game/actions/LuxuryActions';
import { createTestGameState } from '../helpers/createTestGameState';
import { HOSTING_COOLDOWN_WEEKS, quoteEvent } from '@/lib/luxury';
import type { GameState, Relationship } from '@/contexts/game/types';

const rel = (id: string, score: number): Relationship =>
  ({ id, name: id, type: 'friend', relationshipScore: score }) as unknown as Relationship;

function hostState(overrides: Partial<GameState> = {}): GameState {
  return createTestGameState({
    weeksLived: 600,
    stats: { ...createTestGameState().stats, money: 100_000_000, happiness: 40, reputation: 20 },
    luxuryItems: ['private_island'],
    luxuryHoldings: {},
    relationships: [rel('a', 50), rel('b', 40), rel('c', 30)],
    ...overrides,
  });
}

function run(state: GameState, itemId: string, tier: string) {
  let current = state;
  const set = (u: (prev: GameState) => GameState) => {
    current = u(current);
  };
  const result = hostLuxuryEvent(current, set as never, itemId, tier);
  return { result, state: current };
}

describe('hostLuxuryEvent', () => {
  it('charges the cost and lifts reputation and happiness', () => {
    const before = hostState();
    const quote = quoteEvent(before, 'private_island', 'party')!;
    const { result, state } = run(before, 'private_island', 'party');

    expect(result.success).toBe(true);
    expect(state.stats.money).toBe(before.stats.money - quote.cost);
    expect(state.stats.reputation).toBe(before.stats.reputation + quote.reputation);
    expect(state.stats.happiness).toBe(before.stats.happiness + quote.happiness);
  });

  it('warms the relationships of everyone who came', () => {
    // The only luxury action that touches the social graph.
    const before = hostState();
    const { state } = run(before, 'private_island', 'party');

    const after = new Map(state.relationships.map((r) => [r.id, r.relationshipScore]));
    expect(after.get('a')!).toBeGreaterThan(50);
    expect(after.get('b')!).toBeGreaterThan(40);
  });

  it('does not warm anyone who was not invited', () => {
    // A private dinner seats two; the third friend was not there.
    const before = hostState();
    const { state } = run(before, 'private_island', 'dinner');
    const after = new Map(state.relationships.map((r) => [r.id, r.relationshipScore]));
    expect(after.get('c')).toBe(30);
  });

  it('never pushes a relationship past its ceiling', () => {
    const maxed = hostState({ relationships: [rel('a', 99)] });
    const { state } = run(maxed, 'private_island', 'gala');
    expect(state.relationships[0].relationshipScore).toBeLessThanOrEqual(100);
  });

  it('stamps the venue cooldown', () => {
    const { state } = run(hostState(), 'private_island', 'party');
    expect(state.luxuryHoldings!.private_island.lastHostedWeek).toBe(600);

    const second = run(state, 'private_island', 'party');
    expect(second.result.success).toBe(false);
    expect(second.result.message).toContain('host again');
  });

  it('frees the venue once the cooldown elapses', () => {
    const { state } = run(hostState(), 'private_island', 'party');
    const later = { ...state, weeksLived: 600 + HOSTING_COOLDOWN_WEEKS } as GameState;
    expect(run(later, 'private_island', 'party').result.success).toBe(true);
  });

  it('is atomic against a double-tap', () => {
    const start = hostState();
    const quote = quoteEvent(start, 'private_island', 'gala')!;
    let current = start;
    const set = (u: (prev: GameState) => GameState) => {
      current = u(current);
    };
    hostLuxuryEvent(start, set as never, 'private_island', 'gala');
    hostLuxuryEvent(start, set as never, 'private_island', 'gala'); // stale snapshot

    expect(current.stats.money).toBe(start.stats.money - quote.cost);
  });

  it('refuses a venue the player does not own', () => {
    const { result } = run(hostState({ luxuryItems: [] }), 'private_island', 'party');
    expect(result.success).toBe(false);
  });

  it('refuses when the money is not there', () => {
    const broke = hostState({ stats: { ...hostState().stats, money: 1_000 } });
    const { result, state } = run(broke, 'private_island', 'gala');
    expect(result.success).toBe(false);
    expect(state.stats.money).toBe(1_000);
  });

  it('survives a player with no relationships at all', () => {
    const alone = hostState({ relationships: [] });
    const { result } = run(alone, 'private_island', 'party');
    expect(result.success).toBe(true);
  });

  it('rewards a broader collection with a better night', () => {
    const plain = hostState({ luxuryItems: ['private_island'] });
    const connected = hostState({
      luxuryItems: ['private_island', 'racehorse', 'supercar', 'fine_art_collection'],
    });

    const plainRep = run(plain, 'private_island', 'gala').state.stats.reputation;
    const connectedRep = run(connected, 'private_island', 'gala').state.stats.reputation;

    expect(connectedRep).toBeGreaterThan(plainRep);
  });
});
