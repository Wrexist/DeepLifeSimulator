import { nextSessionAction } from '@/lib/analytics/AnalyticsTracker';

describe('nextSessionAction — analytics session boundaries', () => {
  it('emits session_end (and flushes) when an active session goes to background', () => {
    expect(nextSessionAction(true, 'background')).toEqual({
      emit: 'session_end',
      flush: true,
    });
  });

  it('emits session_start (no flush) when returning to active with no live session', () => {
    expect(nextSessionAction(false, 'active')).toEqual({
      emit: 'session_start',
      flush: false,
    });
  });

  it('does NOT re-start a session on active while one is already live', () => {
    // The cold-start session_start is owned by app/_layout.tsx; an already-active
    // session must not double-fire on a redundant active edge.
    expect(nextSessionAction(true, 'active')).toEqual({ emit: null, flush: false });
  });

  it('treats transient inactive as flush-only, never a session boundary', () => {
    expect(nextSessionAction(true, 'inactive')).toEqual({ emit: null, flush: true });
    expect(nextSessionAction(false, 'inactive')).toEqual({ emit: null, flush: true });
  });

  it('does not double-end when already backgrounded (background → background)', () => {
    expect(nextSessionAction(false, 'background')).toEqual({ emit: null, flush: false });
  });

  it('survives the full iOS lifecycle including the transient inactive hop', () => {
    // active → inactive → background → inactive → active should produce exactly
    // one end (at background) and one start (at the resume active), proving the
    // inactive hop neither ends nor restarts the session.
    let active = true;
    const seq: ('active' | 'inactive' | 'background')[] = [
      'inactive', // app switcher peek
      'background', // backgrounded -> end
      'inactive', // returning, transient
      'active', // resumed -> start
    ];
    const emits: string[] = [];
    for (const next of seq) {
      const { emit } = nextSessionAction(active, next);
      if (emit === 'session_end') active = false;
      if (emit === 'session_start') active = true;
      if (emit) emits.push(emit);
    }
    expect(emits).toEqual(['session_end', 'session_start']);
  });
});
