import { createTestGameState } from '@/__tests__/helpers/createTestGameState';
import type { GameState } from '@/contexts/game/types';
import { executePrestige, continueAsChild } from '@/lib/prestige/prestigeExecution';
import { getPrestigeThreshold } from '@/lib/prestige/prestigeTypes';
import { applyLiveEventClaim, applyLiveEventSeen } from '@/lib/liveops/claim';
import { instanceId } from '@/lib/liveops/schedule';
import type { LiveEventDefinition } from '@/lib/liveops/types';
import type { EligibilityContext } from '@/lib/liveops/eligibility';

const NOW = Date.parse('2026-09-08T12:00:00Z');
const context: EligibilityContext = {
  weeksThisLife: 0, totalPrestiges: 0, isSubscriber: false,
  daysAway: 0, installId: 'continuity-test',
};

function event(id: string, amount = 500): LiveEventDefinition {
  return {
    id, schemaVersion: 1, kind: 'challenge', title: 'Keep a reserve',
    summary: 'Keep some cash.', brief: 'Keep some cash.',
    startsAt: '2026-09-01T00:00:00Z', endsAt: '2026-10-01T00:00:00Z',
    objectives: [{ objectiveId: 'cash_on_hand', target: 1 }],
    rewards: [{ kind: 'gems', amount }],
  };
}

function parent(): GameState {
  const state = createTestGameState({
    stats: { money: getPrestigeThreshold(0) + 1_000_000 }, weeksLived: 2600,
  });
  state.family = { ...state.family, children: [{
    id: 'heir', name: 'Sam', type: 'child', relationshipScore: 80,
    personality: 'curious', age: 20, gender: 'female',
  }] };
  return state;
}

function claim(state: GameState, definition: LiveEventDefinition, now = NOW): GameState {
  const result = applyLiveEventClaim(state, definition, context, now);
  if (!result.ok) throw new Error(`Expected claim to succeed: ${result.reason}`);
  return { ...state, ...result.patch };
}

const transitions: [string, (state: GameState) => GameState][] = [
  ['prestige reset', (state) => executePrestige(state, 'reset')],
  ['prestige heir', (state) => executePrestige(state, 'child', 'heir')],
  ['death to heir', (state) => continueAsChild(state, 'heir')],
];

describe.each(transitions)('live-event continuity through %s', (_name, transition) => {
  it('keeps claims after transition and reload, refusing a second payout', () => {
    const definition = event('claimed_event');
    const paid = claim(parent(), definition);
    const seen = applyLiveEventSeen(paid, definition, 2600);
    const before = { ...paid, ...seen };
    const next = transition(before);
    expect(next).not.toBe(before);
    expect(next.liveOps?.claimedInstanceIds).toContain(instanceId(definition));
    expect(next.liveOps?.seenInstanceIds).toContain(instanceId(definition));
    expect(next.liveOps?.lastSeenWeek ?? {}).toEqual({});
    const reloaded: GameState = JSON.parse(JSON.stringify(next));
    expect(applyLiveEventClaim(reloaded, definition, context, NOW)).toEqual({
      ok: false, reason: 'already_claimed',
    });
    expect(before.liveOps?.lastSeenWeek?.claimed_event).toBe(2600);
  });

  it('keeps the weekly budget, including future entries on a clock rewind', () => {
    const paid = claim(parent(), event('first'));
    const next = transition(paid);
    expect(applyLiveEventClaim(next, event('second'), context, NOW)).toEqual({
      ok: false, reason: 'budget_exhausted',
    });
    expect(applyLiveEventClaim(next, event('second'), context, NOW - 86_400_000)).toEqual({
      ok: false, reason: 'budget_exhausted',
    });
    // A different event still pays when its full bundle fits the remaining budget.
    const affordable = claim(next, event('small', 100));
    expect(affordable.stats.gems).toBe(next.stats.gems + 100);
    // Expiry remains real elapsed time, not a life transition.
    expect(applyLiveEventClaim(next, event('second'), context, NOW + 8 * 86_400_000).ok).toBe(true);
  });

  it('copies nested records without mutating the ended life', () => {
    const paid = claim(parent(), event('first'));
    const snapshot = JSON.stringify(paid.liveOps);
    const next = transition(paid);
    expect(next.liveOps?.budget).toHaveLength(1);
    next.liveOps?.claimedInstanceIds?.push('new');
    if (next.liveOps?.budget?.[0]) next.liveOps.budget[0].value = 0;
    expect(JSON.stringify(paid.liveOps)).toBe(snapshot);
  });

  it('leaves liveOps absent for a lineage that has never used it', () => {
    const state = parent();
    delete state.liveOps;
    expect(transition(state).liveOps).toBeUndefined();
  });
});
