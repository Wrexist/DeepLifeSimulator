/**
 * The three TRANSITION steps of the funnel.
 *
 * These exist because a stateless resolver cannot emit them, and without them
 * the funnel could only answer shown -> opened -> claimed - leaving the two
 * questions live ops actually turns on unanswerable: how many players did the
 * work and were never paid, and how many had an event expire on them.
 */
import { observeLiveOpsFunnel, resetLiveOpsFunnel } from '../funnel';
import { instanceId } from '../schedule';
import type { LiveEventDefinition, LiveEventState, ResolvedLiveEvent } from '../types';

const mockTrack = jest.fn();
jest.mock('@/lib/analytics', () => ({ track: (...args: unknown[]) => mockTrack(...args) }));

const definition: LiveEventDefinition = {
  id: 'e',
  schemaVersion: 1,
  kind: 'challenge',
  title: 't',
  summary: 's',
  brief: 'b',
  startsAt: '2026-06-01T00:00:00Z',
  endsAt: '2026-07-01T00:00:00Z',
  objectives: [
    { objectiveId: 'reputation', target: 10 },
    { objectiveId: 'happiness', target: 10 },
  ],
  rewards: [{ kind: 'gems', amount: 100 }],
};

const resolved = (met: number, state: LiveEventState = 'active'): ResolvedLiveEvent => ({
  definition,
  state,
  objectives: [
    { objectiveId: 'reputation', label: 'a', current: 0, target: 10, met: met >= 1 },
    { objectiveId: 'happiness', label: 'b', current: 0, target: 10, met: met >= 2 },
  ],
  complete: met === 2,
  msRemaining: 1000,
});

const names = () => mockTrack.mock.calls.map(([n]) => n);

beforeEach(() => {
  resetLiveOpsFunnel();
  mockTrack.mockClear();
});

describe('progress', () => {
  it('emits when an objective becomes met, not on the first sighting', () => {
    // The first pass establishes the baseline; a player who arrives already
    // part-way has not progressed during this session.
    observeLiveOpsFunnel([resolved(1)], [], 40);
    expect(names()).not.toContain('live_event_progressed');

    observeLiveOpsFunnel([resolved(2)], [], 40);
    expect(names()).toContain('live_event_progressed');
  });

  it('does NOT re-emit when the player falls back and re-crosses the same bar', () => {
    // Cash is spent; an objective the player goes backwards on would otherwise
    // fill the funnel with progress that never happened.
    observeLiveOpsFunnel([resolved(1)], [], 40);
    observeLiveOpsFunnel([resolved(2)], [], 40);
    mockTrack.mockClear();

    observeLiveOpsFunnel([resolved(1)], [], 40);
    observeLiveOpsFunnel([resolved(2)], [], 40);
    expect(names()).not.toContain('live_event_progressed');
  });

  it('carries how far through the player is', () => {
    observeLiveOpsFunnel([resolved(0)], [], 40);
    observeLiveOpsFunnel([resolved(1)], [], 40);
    const call = mockTrack.mock.calls.find(([n]) => n === 'live_event_progressed');
    expect(call?.[1]).toEqual(expect.objectContaining({ metCount: 1, totalCount: 2 }));
  });
});

describe('completion', () => {
  it('emits once, however many times the hub re-resolves', () => {
    for (let i = 0; i < 5; i++) observeLiveOpsFunnel([resolved(2)], [], 40);
    expect(names().filter((n) => n === 'live_event_completed')).toHaveLength(1);
  });

  it('is separate from the claim, so "did the work, never paid" is measurable', () => {
    // The same reason purchase_succeeded and premium_activated are separate: a
    // gap between them is a bug, not a preference.
    observeLiveOpsFunnel([resolved(2)], [], 40);
    expect(names()).toContain('live_event_completed');
    expect(names()).not.toContain('live_event_claimed');
  });
});

describe('expiry', () => {
  it('emits for an unclaimed event whose window closed, with how far they got', () => {
    // The hub hides expired events from the player, so nothing else would ever
    // see one - this is the only place the biggest drop-off is measurable.
    observeLiveOpsFunnel([resolved(1, 'expired')], [], 40);
    const call = mockTrack.mock.calls.find(([n]) => n === 'live_event_expired');
    expect(call?.[1]).toEqual(expect.objectContaining({ metCount: 1, totalCount: 2 }));
  });

  it('does NOT count an expiry the player already claimed', () => {
    observeLiveOpsFunnel([resolved(2, 'expired')], [instanceId(definition)], 40);
    expect(names()).not.toContain('live_event_expired');
  });

  it('does NOT count an event the player was never offered', () => {
    // Counting an expiry against someone the event excluded would make the
    // drop-off mostly a measure of the audience it did not target.
    observeLiveOpsFunnel([resolved(0, 'unavailable')], [], 40);
    expect(names()).not.toContain('live_event_expired');
  });

  it('emits once per instance per session', () => {
    for (let i = 0; i < 4; i++) observeLiveOpsFunnel([resolved(1, 'expired')], [], 40);
    expect(names().filter((n) => n === 'live_event_expired')).toHaveLength(1);
  });
});

describe('robustness', () => {
  it('ignores an event with no readable objectives', () => {
    const empty = { ...resolved(0), objectives: [], complete: false };
    observeLiveOpsFunnel([empty], [], 40);
    expect(mockTrack).not.toHaveBeenCalled();
  });

  it('handles an empty resolution', () => {
    expect(() => observeLiveOpsFunnel([], [], 40)).not.toThrow();
  });
});
