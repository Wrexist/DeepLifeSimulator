import { hubOrder, instanceId, isClaimable, msRemaining, resolveState, windowFor } from '../schedule';
import type { LiveEventDefinition, LiveEventState } from '../types';

const def = (o: Partial<LiveEventDefinition> = {}): LiveEventDefinition => ({
  id: 'e',
  schemaVersion: 1,
  kind: 'challenge',
  title: 't',
  summary: 's',
  brief: 'b',
  startsAt: '2026-06-01T00:00:00Z',
  endsAt: '2026-07-01T00:00:00Z',
  objectives: [{ objectiveId: 'reputation', target: 1 }],
  rewards: [{ kind: 'gems', amount: 100 }],
  ...o,
});

const at = (iso: string) => Date.parse(iso);
const state = (o: Partial<Parameters<typeof resolveState>[0]> = {}) =>
  resolveState({
    definition: def(),
    nowMs: at('2026-06-15T00:00:00Z'),
    complete: false,
    claimed: false,
    eligible: true,
    ...o,
  }).state;

describe('instanceId', () => {
  it('identifies one RUN, so a re-run is claimable again', () => {
    // The distinction the whole ledger rests on: an event that runs again next
    // season is a new instance, while re-entering the same window - the most a
    // clock scrub can achieve - finds the id already recorded.
    expect(instanceId(def())).toBe('e@2026-06-01T00:00:00Z');
    expect(instanceId(def({ startsAt: '2026-09-01T00:00:00Z' }))).not.toBe(instanceId(def()));
  });
});

describe('the state machine', () => {
  it('walks upcoming -> active -> claimable -> claimed', () => {
    expect(state({ nowMs: at('2026-05-01T00:00:00Z') })).toBe('upcoming');
    expect(state()).toBe('active');
    expect(state({ complete: true })).toBe('claimable');
    expect(state({ complete: true, claimed: true })).toBe('claimed');
  });

  it('expires an INCOMPLETE event once the window closes', () => {
    expect(state({ nowMs: at('2026-07-02T00:00:00Z') })).toBe('expired');
  });

  it('keeps a COMPLETE event claimable through the grace period only', () => {
    const graced = def({ claimGraceDays: 3 });
    const inGrace = { definition: graced, complete: true, claimed: false, eligible: true };
    expect(resolveState({ ...inGrace, nowMs: at('2026-07-02T00:00:00Z') }).state).toBe('claimable');
    expect(resolveState({ ...inGrace, nowMs: at('2026-07-05T00:00:00Z') }).state).toBe('expired');
  });

  it('`claimed` outranks everything, including an expired window', () => {
    // A hub that told a player they missed something they actually collected
    // would be wrong; worse, a machine that can LEAVE `claimed` is one that can
    // be argued back into paying.
    expect(state({ claimed: true, nowMs: at('2030-01-01T00:00:00Z') })).toBe('claimed');
    expect(state({ claimed: true, eligible: false })).toBe('claimed');
  });

  it('ineligible reads as unavailable, not as expired', () => {
    expect(state({ eligible: false })).toBe('unavailable');
  });

  it('degrades to unavailable on unparseable input rather than throwing', () => {
    expect(state({ definition: def({ endsAt: 'not a date' }) })).toBe('unavailable');
    expect(state({ definition: def({ endsAt: '2026-05-01T00:00:00Z' }) })).toBe('unavailable');
    expect(state({ nowMs: NaN })).toBe('unavailable');
  });

  it('only `claimable` may pay', () => {
    const states: LiveEventState[] = ['upcoming', 'active', 'claimed', 'expired', 'unavailable'];
    for (const s of states) expect(isClaimable(s)).toBe(false);
    expect(isClaimable('claimable')).toBe(true);
  });
});

describe('windows and countdowns', () => {
  it('adds the grace to the claim deadline but not to the window', () => {
    const w = windowFor(def({ claimGraceDays: 2 }))!;
    expect(w.endsAt).toBe(at('2026-07-01T00:00:00Z'));
    expect(w.claimUntil).toBe(w.endsAt + 2 * 24 * 60 * 60 * 1000);
  });

  it('reports zero remaining once the window has closed, never a negative', () => {
    expect(msRemaining(def(), at('2026-07-02T00:00:00Z'))).toBe(0);
    expect(msRemaining(def(), NaN)).toBe(0);
  });

  it('rejects a backwards or unparseable window', () => {
    expect(windowFor(def({ endsAt: '2026-05-01T00:00:00Z' }))).toBeNull();
    expect(windowFor(def({ startsAt: 'nonsense' }))).toBeNull();
  });
});

describe('hub order', () => {
  const row = (state: LiveEventState, id: string, priority = 0, ms = 1000) => ({
    state,
    definition: def({ id, priority }),
    msRemaining: ms,
  });

  it('puts what can be claimed now first', () => {
    const rows = [row('upcoming', 'c'), row('active', 'b'), row('claimable', 'a')];
    expect([...rows].sort(hubOrder).map((r) => r.definition.id)).toEqual(['a', 'b', 'c']);
  });

  it('breaks ties by priority, then deadline, then id - so it is stable', () => {
    // A hub whose order depends on however the definitions happened to be
    // merged reshuffles under the player between renders.
    const rows = [row('active', 'z', 5, 100), row('active', 'a', 5, 100), row('active', 'm', 9, 999)];
    expect([...rows].sort(hubOrder).map((r) => r.definition.id)).toEqual(['m', 'a', 'z']);
  });
});
