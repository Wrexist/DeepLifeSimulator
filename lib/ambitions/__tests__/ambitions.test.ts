/**
 * Life Ambitions — catalogue integrity, milestone evaluation, and one-time
 * payoff idempotency. Drives only the pure helpers in lib/ambitions, so it runs
 * without a React/app runtime.
 */

import { LIFE_AMBITIONS } from '../catalog';
import {
  getAmbitionById,
  getAmbitionCompletion,
  grantAmbitionPayout,
  reconcileReachedMilestones,
} from '../progress';
import type { GameState } from '@/contexts/game/types';

// A minimal state factory — the pure predicates only touch a handful of fields,
// each read null-safely, so a partial object cast to GameState is sufficient.
function makeState(overrides: Partial<GameState> = {}): GameState {
  return {
    stats: { money: 0, gems: 0, happiness: 0, reputation: 0 },
    ...overrides,
  } as unknown as GameState;
}

describe('ambitions — catalogue integrity', () => {
  it('has 6–8 ambitions with unique ids', () => {
    expect(LIFE_AMBITIONS.length).toBeGreaterThanOrEqual(6);
    expect(LIFE_AMBITIONS.length).toBeLessThanOrEqual(8);
    const ids = LIFE_AMBITIONS.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every ambition has presentation fields, a staged path, and a real payoff', () => {
    for (const a of LIFE_AMBITIONS) {
      // Presentation
      expect(typeof a.name).toBe('string');
      expect(a.name.length).toBeGreaterThan(0);
      expect(typeof a.emoji).toBe('string');
      expect(a.emoji.length).toBeGreaterThan(0);
      expect(a.tagline.length).toBeGreaterThan(0);
      expect(a.hint.length).toBeGreaterThan(0);
      expect(a.color).toMatch(/^#[0-9A-Fa-f]{6}$/);

      // Staged milestones — 3..5, unique ids, each a real predicate.
      expect(a.milestones.length).toBeGreaterThanOrEqual(3);
      expect(a.milestones.length).toBeLessThanOrEqual(5);
      const mids = a.milestones.map((m) => m.id);
      expect(new Set(mids).size).toBe(mids.length);
      for (const m of a.milestones) {
        expect(typeof m.checkComplete).toBe('function');
        expect(m.title.length).toBeGreaterThan(0);
        // Predicate must not throw on an empty-ish state.
        expect(() => m.checkComplete(makeState())).not.toThrow();
      }

      // Payoff routes through at least one real currency, and a badge label.
      const { payoff } = a;
      const total = (payoff.money ?? 0) + (payoff.gems ?? 0) + (payoff.prestigePoints ?? 0);
      expect(total).toBeGreaterThan(0);
      expect(typeof payoff.badge).toBe('string');
    }
  });

  it('milestone ids are globally unique across the whole catalogue', () => {
    const all = LIFE_AMBITIONS.flatMap((a) => a.milestones.map((m) => m.id));
    expect(new Set(all).size).toBe(all.length);
  });

  it('getAmbitionById resolves catalogue ids and rejects unknown/absent', () => {
    expect(getAmbitionById('true_love')?.id).toBe('true_love');
    expect(getAmbitionById('nope')).toBeUndefined();
    expect(getAmbitionById(undefined)).toBeUndefined();
  });
});

describe('ambitions — milestone progress evaluation', () => {
  it('returns null when no ambition is chosen (freeform / old saves)', () => {
    expect(getAmbitionCompletion(makeState())).toBeNull();
    expect(getAmbitionCompletion(makeState({ ambitionId: undefined }))).toBeNull();
  });

  it('scores a partial path correctly (1 of 4 for true_love)', () => {
    const state = makeState({
      ambitionId: 'true_love',
      relationships: [{ type: 'friend' }] as any,
      stats: { money: 0, gems: 0, happiness: 50, reputation: 0 } as any,
    });
    const c = getAmbitionCompletion(state)!;
    expect(c).not.toBeNull();
    expect(c.totalCount).toBe(4);
    expect(c.reachedCount).toBe(1); // only "make a connection"
    expect(c.allComplete).toBe(false);
    expect(c.readyToClaim).toBe(false);
    // The first milestone is the reached one.
    expect(c.milestones[0].complete).toBe(true);
    expect(c.milestones[3].complete).toBe(false);
  });

  it('marks the path complete when every milestone is satisfied', () => {
    const state = makeState({
      ambitionId: 'true_love',
      relationships: [{ type: 'romantic' }] as any,
      family: { spouse: { name: 'Sam' }, children: [] } as any,
      stats: { money: 0, gems: 0, happiness: 95, reputation: 0 } as any,
    });
    const c = getAmbitionCompletion(state)!;
    expect(c.reachedCount).toBe(4);
    expect(c.allComplete).toBe(true);
    expect(c.readyToClaim).toBe(true);
  });

  it('milestones are sticky — persisted progress survives a later stat dip', () => {
    // happiness was high (bliss reached) and got persisted, then dropped.
    const state = makeState({
      ambitionId: 'true_love',
      ambitionCompletedMilestones: ['tl_bliss'],
      family: { spouse: { name: 'Sam' }, children: [] } as any,
      stats: { money: 0, gems: 0, happiness: 10, reputation: 0 } as any,
    });
    const c = getAmbitionCompletion(state)!;
    const bliss = c.milestones.find((m) => m.id === 'tl_bliss')!;
    expect(bliss.complete).toBe(true); // stays reached despite happiness=10
  });

  it('reconcileReachedMilestones drops stale ids from other ambitions', () => {
    const state = makeState({
      ambitionId: 'true_love',
      ambitionCompletedMilestones: ['be_found', 'tl_friend'], // be_found belongs to a different ambition
      relationships: [{ type: 'friend' }] as any,
    });
    const reached = reconcileReachedMilestones(state);
    expect(reached).toContain('tl_friend');
    expect(reached).not.toContain('be_found');
  });
});

describe('ambitions — one-time payoff idempotency', () => {
  const completeTrueLoveState = () =>
    makeState({
      ambitionId: 'true_love',
      ambitionCompletedMilestones: [],
      ambitionRewardClaimed: false,
      relationships: [{ type: 'romantic' }] as any,
      family: { spouse: { name: 'Sam' }, children: [] } as any,
      stats: { money: 1000, gems: 5, happiness: 95, reputation: 0 } as any,
      prestige: { prestigePoints: 100 } as any,
    });

  it('grants the payoff exactly once and flips the claimed flag', () => {
    const s0 = completeTrueLoveState();
    const payoff = getAmbitionById('true_love')!.payoff;

    const s1 = grantAmbitionPayout(s0);
    expect(s1).not.toBe(s0);
    expect(s1.ambitionRewardClaimed).toBe(true);
    expect(s1.stats.money).toBe(1000 + (payoff.money ?? 0));
    expect(s1.stats.gems).toBe(5 + (payoff.gems ?? 0));
    expect(s1.prestige!.prestigePoints).toBe(100 + (payoff.prestigePoints ?? 0));
    // All milestones locked in.
    expect((s1.ambitionCompletedMilestones ?? []).length).toBe(4);

    // Second application must be a no-op — no double reward.
    const s2 = grantAmbitionPayout(s1);
    expect(s2.stats.money).toBe(s1.stats.money);
    expect(s2.stats.gems).toBe(s1.stats.gems);
    expect(s2.prestige!.prestigePoints).toBe(s1.prestige!.prestigePoints);
    expect(s2.ambitionRewardClaimed).toBe(true);
  });

  it('does not pay out an incomplete ambition, but still persists progress', () => {
    const state = makeState({
      ambitionId: 'true_love',
      relationships: [{ type: 'friend' }] as any, // only milestone 1
      stats: { money: 1000, gems: 5, happiness: 20, reputation: 0 } as any,
      prestige: { prestigePoints: 100 } as any,
    });
    const next = grantAmbitionPayout(state);
    expect(next.ambitionRewardClaimed).toBeFalsy();
    expect(next.stats.money).toBe(1000); // unchanged — no reward
    expect(next.stats.gems).toBe(5);
    expect(next.prestige!.prestigePoints).toBe(100);
    // But the reached milestone was locked in.
    expect(next.ambitionCompletedMilestones).toContain('tl_friend');
  });

  it('is safe when the state has no prestige record (grants money + gems, skips PP)', () => {
    const s0 = makeState({
      ambitionId: 'true_love',
      relationships: [{ type: 'romantic' }] as any,
      family: { spouse: { name: 'Sam' }, children: [] } as any,
      stats: { money: 0, gems: 0, happiness: 95, reputation: 0 } as any,
      // no prestige field
    });
    const s1 = grantAmbitionPayout(s0);
    const payoff = getAmbitionById('true_love')!.payoff;
    expect(s1.ambitionRewardClaimed).toBe(true);
    expect(s1.stats.money).toBe(payoff.money ?? 0);
    expect(s1.stats.gems).toBe(payoff.gems ?? 0);
    expect(s1.prestige).toBeUndefined();
  });
});
