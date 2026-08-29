import { DEBUG_BUFFER_SIZE, clearDebugEvents, getDebugEventCounts, getDebugEvents, recordDebugEvent } from '../debugBuffer';

const record = (name: string) => recordDebugEvent({ name, ts: new Date().toISOString(), sessionId: 's' });

/**
 * `__DEV__` is a global in this app, and the buffer is gated on it at WRITE
 * time. These tests drive it directly so both halves of the contract are
 * pinned: it records in development, and a production build retains nothing.
 */
declare const globalThis: { __DEV__?: boolean } & typeof global;

describe('debug buffer', () => {
  const original = globalThis.__DEV__;
  beforeEach(() => {
    globalThis.__DEV__ = true;
    clearDebugEvents();
  });
  afterAll(() => {
    globalThis.__DEV__ = original;
  });

  it('records events in order', () => {
    record('session_start');
    record('week_advanced');
    expect(getDebugEvents().map((e) => e.name)).toEqual(['session_start', 'week_advanced']);
  });

  it('is a bounded ring — a long session cannot grow it', () => {
    for (let i = 0; i < DEBUG_BUFFER_SIZE + 25; i++) record(`e${i}`);
    const events = getDebugEvents();
    expect(events).toHaveLength(DEBUG_BUFFER_SIZE);
    // Oldest dropped first, so the most recent activity is what you inspect.
    expect(events[events.length - 1].name).toBe(`e${DEBUG_BUFFER_SIZE + 24}`);
  });

  it('counts by name — the fastest read of "did my instrumentation fire"', () => {
    record('week_advanced');
    record('week_advanced');
    record('death');
    expect(getDebugEventCounts()).toEqual({ week_advanced: 2, death: 1 });
  });

  it('reports an un-fired event by ABSENCE, which is the finding', () => {
    record('week_advanced');
    expect(getDebugEventCounts().paywall_viewed).toBeUndefined();
  });

  it('retains NOTHING outside __DEV__', () => {
    // A production build must neither hold player events in memory nor expose
    // an inspection surface to anyone who reaches the debug menu.
    globalThis.__DEV__ = false;
    record('purchase_succeeded');
    expect(getDebugEvents()).toHaveLength(0);
  });
});
