/**
 * Repeating an action must not bury the screen it happened on.
 *
 * Three taps on the market's Buy button pushed three byte-identical "Ate
 * Instant Ramen. Completely full..." pills, filling the cap of three and
 * covering the HUD - hiding the very stats the meal had just changed
 * (screenshot report, 2026-09-04).
 */
import {
  enqueueToast,
  toastDisplayMessage,
  MAX_VISIBLE_TOASTS,
  type QueuedToast,
} from '@/utils/toastQueue';

const toast = (over: Partial<QueuedToast> = {}): QueuedToast => ({
  id: `id-${Math.random()}`,
  message: 'Ate Instant Ramen.',
  type: 'success',
  position: 'top',
  count: 1,
  ...over,
});

describe('enqueueToast', () => {
  it('appends a first toast', () => {
    const q = enqueueToast([], toast());
    expect(q).toHaveLength(1);
    expect(q[0].count).toBe(1);
  });

  it('collapses a repeat instead of stacking a second pill', () => {
    let q = enqueueToast([], toast());
    q = enqueueToast(q, toast());
    q = enqueueToast(q, toast());
    expect(q).toHaveLength(1);
    expect(q[0].count).toBe(3);
  });

  it('takes the new id on a repeat, so the dismissal timer restarts', () => {
    const first = toast({ id: 'first' });
    const second = toast({ id: 'second' });
    const q = enqueueToast(enqueueToast([], first), second);
    // Same pill, new identity - remounting is what resets the countdown, so
    // the second tap's toast does not expire on the first tap's clock.
    expect(q[0].id).toBe('second');
  });

  it('keeps different tiers apart even when the text matches', () => {
    const q = enqueueToast(
      enqueueToast([], toast({ type: 'success' })),
      toast({ type: 'error' })
    );
    expect(q).toHaveLength(2);
  });

  it('keeps different positions apart', () => {
    const q = enqueueToast(
      enqueueToast([], toast({ position: 'top' })),
      toast({ position: 'bottom' })
    );
    expect(q).toHaveLength(2);
  });

  it('collapses a repeat that is not the newest entry', () => {
    let q = enqueueToast([], toast({ message: 'A' }));
    q = enqueueToast(q, toast({ message: 'B' }));
    q = enqueueToast(q, toast({ message: 'A' }));
    expect(q).toHaveLength(2);
    expect(q[0].message).toBe('A');
    expect(q[0].count).toBe(2);
    expect(q[1].count).toBe(1);
  });

  it('caps distinct toasts at MAX_VISIBLE_TOASTS, keeping the newest', () => {
    let q: QueuedToast[] = [];
    for (const m of ['A', 'B', 'C', 'D']) q = enqueueToast(q, toast({ message: m }));
    expect(q).toHaveLength(MAX_VISIBLE_TOASTS);
    expect(q.map((t) => t.message)).toEqual(['B', 'C', 'D']);
  });

  it('a repeat at the cap does not evict anything', () => {
    let q: QueuedToast[] = [];
    for (const m of ['A', 'B', 'C']) q = enqueueToast(q, toast({ message: m }));
    q = enqueueToast(q, toast({ message: 'A' }));
    expect(q.map((t) => t.message)).toEqual(['A', 'B', 'C']);
    expect(q[0].count).toBe(2);
  });

  it('never mutates the queue it was given', () => {
    const first = toast();
    const before = [first];
    const frozen = JSON.stringify(before);
    enqueueToast(before, toast());
    expect(JSON.stringify(before)).toBe(frozen);
  });
});

describe('toastDisplayMessage', () => {
  it('is the bare message until it repeats', () => {
    expect(toastDisplayMessage({ message: 'Saved', count: 1 })).toBe('Saved');
  });

  it('carries a tally once collapsed', () => {
    expect(toastDisplayMessage({ message: 'Saved', count: 3 })).toContain('x3');
  });
});
