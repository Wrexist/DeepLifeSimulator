/**
 * The claim path, adversarially.
 *
 * These are the tests that matter most in the whole subsystem: this is the one
 * place live ops can pay out, and the repo's most repeated bug is a gate
 * checked outside the updater that a second tap in the same React batch walks
 * straight through.
 */
import { applyLiveEventClaim, applyLiveEventSeen } from '../claim';
import { WEEKLY_BUDGET_GEMS } from '../rewards';
import { instanceId } from '../schedule';
import type { LiveEventDefinition } from '../types';
import type { EligibilityContext } from '../eligibility';
import type { GameState } from '@/contexts/game/types';
import { createTestGameState } from '@/__tests__/helpers/createTestGameState';

const NOW = Date.parse('2026-06-15T12:00:00Z');

const context: EligibilityContext = {
  weeksThisLife: 40,
  totalPrestiges: 0,
  isSubscriber: false,
  daysAway: 0,
  installId: 'install-claim-test',
};

function event(overrides: Partial<LiveEventDefinition> = {}): LiveEventDefinition {
  return {
    id: 'test_event',
    schemaVersion: 1,
    kind: 'challenge',
    title: 'Test Event',
    summary: 'A test.',
    brief: 'A test event.',
    startsAt: '2026-06-01T00:00:00Z',
    endsAt: '2026-07-01T00:00:00Z',
    objectives: [{ objectiveId: 'reputation', target: 10 }],
    rewards: [{ kind: 'gems', amount: 200 }],
    ...overrides,
  };
}

/** A save that already satisfies the default objective. */
function completedState(overrides: Partial<GameState> = {}): GameState {
  const base = createTestGameState(overrides);
  return { ...base, stats: { ...base.stats, reputation: 50, gems: 0, money: 1000 } };
}

describe('the double-tap guard', () => {
  it('pays exactly once when the reducer runs twice on its own output', () => {
    // This is the batched double tap, reproduced faithfully: React invokes the
    // updater a second time with the state the FIRST invocation returned. A
    // gate read from a captured value instead of `prev` passes both times.
    const first = applyLiveEventClaim(completedState(), event(), context, NOW);
    expect(first.ok).toBe(true);
    if (!first.ok) return;

    const afterFirst = { ...completedState(), ...first.patch } as GameState;
    const second = applyLiveEventClaim(afterFirst, event(), context, NOW);

    expect(second).toEqual({ ok: false, reason: 'already_claimed' });
    expect(afterFirst.stats.gems).toBe(200);
  });

  it('pays once across an app restart mid-claim', () => {
    // The ledger is persisted, so a save written between the grant and the next
    // launch already carries the instance id.
    const first = applyLiveEventClaim(completedState(), event(), context, NOW);
    expect(first.ok).toBe(true);
    if (!first.ok) return;

    // Round-trip through JSON, as a save does.
    const reloaded = JSON.parse(
      JSON.stringify({ ...completedState(), ...first.patch }),
    ) as GameState;

    expect(applyLiveEventClaim(reloaded, event(), context, NOW)).toEqual({
      ok: false,
      reason: 'already_claimed',
    });
  });
});

describe('the clock', () => {
  it('a clock scrubbed BACK into an already-claimed window still refuses', () => {
    const first = applyLiveEventClaim(completedState(), event(), context, NOW);
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    const after = { ...completedState(), ...first.patch } as GameState;

    // Back to the very start of the window.
    const earlier = Date.parse('2026-06-01T00:00:01Z');
    expect(applyLiveEventClaim(after, event(), context, earlier)).toEqual({
      ok: false,
      reason: 'already_claimed',
    });
  });

  it('a clock scrubbed FORWARD cannot manufacture progress', () => {
    // Objectives read game state. Moving to the middle of the window with the
    // objective unmet is still not claimable, whatever the clock says.
    const base = createTestGameState();
    const unmet = { ...base, stats: { ...base.stats, reputation: 0 } } as GameState;
    expect(applyLiveEventClaim(unmet, event(), context, NOW)).toEqual({
      ok: false,
      reason: 'not_claimable',
    });
  });

  it('refuses before the window opens and after it closes', () => {
    const before = Date.parse('2026-05-31T23:59:59Z');
    const after = Date.parse('2026-07-01T00:00:01Z');
    expect(applyLiveEventClaim(completedState(), event(), context, before).ok).toBe(false);
    expect(applyLiveEventClaim(completedState(), event(), context, after).ok).toBe(false);
  });

  it('honours the grace period for a COMPLETED event, and only for one', () => {
    const graced = event({ claimGraceDays: 3 });
    const justAfter = Date.parse('2026-07-02T00:00:00Z');
    expect(applyLiveEventClaim(completedState(), graced, context, justAfter).ok).toBe(true);

    // Incomplete: the grace extends the CLAIM, never the work.
    const base = createTestGameState();
    const unmet = { ...base, stats: { ...base.stats, reputation: 0 } } as GameState;
    expect(applyLiveEventClaim(unmet, graced, context, justAfter)).toEqual({
      ok: false,
      reason: 'not_claimable',
    });
  });

  it('refuses an unreadable clock rather than paying', () => {
    expect(applyLiveEventClaim(completedState(), event(), context, NaN).ok).toBe(false);
  });
});

describe('the rolling budget', () => {
  it('refuses rather than paying a fraction of an advertised reward', () => {
    // All-or-nothing: quietly delivering less than the number the player was
    // shown costs more trust than the gems are worth.
    const spent = createTestGameState();
    const nearlyFull = {
      ...spent,
      stats: { ...spent.stats, reputation: 50 },
      liveOps: { budget: [{ at: NOW - 1000, value: WEEKLY_BUDGET_GEMS - 10 }] },
    } as GameState;

    expect(applyLiveEventClaim(nearlyFull, event(), context, NOW)).toEqual({
      ok: false,
      reason: 'budget_exhausted',
    });
  });

  it('pays once the window has rolled past the old spend', () => {
    const base = createTestGameState();
    const state = {
      ...base,
      stats: { ...base.stats, reputation: 50 },
      liveOps: { budget: [{ at: NOW - 8 * 24 * 60 * 60 * 1000, value: WEEKLY_BUDGET_GEMS }] },
    } as GameState;
    expect(applyLiveEventClaim(state, event(), context, NOW).ok).toBe(true);
  });

  it('a REWOUND clock does not refund the budget', () => {
    // Dropping future-stamped entries would turn a clock scrub into extra
    // payouts, which is the exploit shape the five clock-related STATE_VERSION
    // bumps exist to close.
    const base = createTestGameState();
    const state = {
      ...base,
      stats: { ...base.stats, reputation: 50 },
      liveOps: { budget: [{ at: NOW + 5 * 24 * 60 * 60 * 1000, value: WEEKLY_BUDGET_GEMS }] },
    } as GameState;
    expect(applyLiveEventClaim(state, event(), context, NOW)).toEqual({
      ok: false,
      reason: 'budget_exhausted',
    });
  });
});

describe('what a claim writes', () => {
  it('grants every currency in ONE patch alongside the ledger entry', () => {
    // There must be no interleaving in which a payout happens without being
    // recorded, so the currencies and the ledger move together or not at all.
    const multi = event({
      rewards: [
        { kind: 'gems', amount: 100 },
        { kind: 'cash', amount: 5000 },
        { kind: 'legacyPoints', amount: 1 },
      ],
    });
    const result = applyLiveEventClaim(completedState(), multi, context, NOW);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.patch.stats?.gems).toBe(100);
    expect(result.patch.stats?.money).toBe(6000);
    expect(result.patch.legacyPoints).toBe(1);
    expect(result.patch.liveOps?.claimedInstanceIds).toContain(instanceId(multi));
    expect(result.patch.liveOps?.budget).toHaveLength(1);
  });

  it('preserves the rest of stats rather than replacing the object', () => {
    // A patch that rebuilt `stats` from the reward alone would silently reset
    // health, energy and everything else the player has.
    const state = completedState();
    const result = applyLiveEventClaim(state, event(), context, NOW);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.patch.stats?.health).toBe(state.stats.health);
    expect(result.patch.stats?.reputation).toBe(state.stats.reputation);
  });

  it('respects the money ceiling', () => {
    // Overflow to Infinity makes validateGameState treat the save as critical
    // and RESET money to 0 on the next load - worse than capping.
    const base = completedState();
    const rich = { ...base, stats: { ...base.stats, money: Number.MAX_SAFE_INTEGER } } as GameState;
    const cash = event({ rewards: [{ kind: 'cash', amount: 25_000 }] });
    const result = applyLiveEventClaim(rich, cash, context, NOW);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(Number.isFinite(result.patch.stats?.money)).toBe(true);
    expect(result.patch.stats?.money).toBeLessThanOrEqual(Number.MAX_SAFE_INTEGER);
  });
});

describe('eligibility is re-checked inside the updater', () => {
  it('refuses an event the player is not eligible for', () => {
    const subscriberOnly = event({ eligibility: { requiresSubscription: true } });
    expect(applyLiveEventClaim(completedState(), subscriberOnly, context, NOW)).toEqual({
      ok: false,
      reason: 'not_claimable',
    });
  });
});

describe('robustness', () => {
  it('never throws on a malformed save', () => {
    for (const bad of [null, undefined, {}, { stats: null }]) {
      expect(() =>
        applyLiveEventClaim(bad as unknown as GameState, event(), context, NOW),
      ).not.toThrow();
    }
  });

  it('refuses an event whose objectives are all unreadable', () => {
    // Validation should have dropped it long before, so reaching here means it
    // bypassed validation - and an event with nothing readable must never be
    // vacuously complete.
    const broken = event({ objectives: [{ objectiveId: 'not_a_real_objective', target: 1 }] });
    expect(applyLiveEventClaim(completedState(), broken, context, NOW)).toEqual({
      ok: false,
      reason: 'not_claimable',
    });
  });
});

describe('applyLiveEventSeen', () => {
  it('records the open, and is a no-op the second time', () => {
    const state = completedState();
    const patch = applyLiveEventSeen(state, event(), 40);
    expect(patch?.liveOps?.seenInstanceIds).toContain(instanceId(event()));

    const after = { ...state, ...patch } as GameState;
    expect(applyLiveEventSeen(after, event(), 40)).toBeNull();
  });

  it('cannot touch any currency', () => {
    const patch = applyLiveEventSeen(completedState(), event(), 40);
    expect(patch).not.toBeNull();
    expect(Object.keys(patch!)).toEqual(['liveOps']);
  });
});

describe('the open-then-claim path (the one the UI actually performs)', () => {
  it('an event stays claimable after the player OPENS it', () => {
    // This was broken and every other test in this file missed it, because none
    // of them opened an event before claiming. Opening stamps
    // `lastSeenWeek[id] = weeksThisLife`, and the cooldown - meant to space out
    // a REPEAT appearance of a recurring id - then read `elapsed === 0` and
    // refused the instance in the player's hand. Open the card, read the brief,
    // tap Collect, get told no.
    const state = completedState();
    const opened = { ...state, ...applyLiveEventSeen(state, event(), 40) } as GameState;
    expect(applyLiveEventClaim(opened, event(), context, NOW).ok).toBe(true);
  });

  it('and the cooldown still holds back a LATER, unseen instance', () => {
    // The rule the cooldown exists for must survive the fix: a fresh run of the
    // same event id, which the player has not engaged with, is still spaced out.
    const laterRun = event({ startsAt: '2026-06-05T00:00:00Z', endsAt: '2026-07-05T00:00:00Z' });
    const base = completedState();
    const seenRecently = {
      ...base,
      liveOps: { lastSeenWeek: { test_event: 39 }, seenInstanceIds: [] },
    } as GameState;
    expect(applyLiveEventClaim(seenRecently, laterRun, context, NOW)).toEqual({
      ok: false,
      reason: 'not_claimable',
    });
  });
});
