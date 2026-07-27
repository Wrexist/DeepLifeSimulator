/**
 * The portrait must be of the head the character actually has.
 *
 * The procedural head is drawn immediately on every open of the creator so the
 * canvas is never blank, and the scanned head swaps in once ~1 MB of glTF has
 * parsed. The portrait is snapshotted from that same canvas on Done. Without the
 * wait, a player who tapped through inside the parse window got a portrait of
 * the procedural head written into their save permanently, while the creator and
 * every later view showed the scanned one.
 *
 * I shipped that fix untested first time, on the argument that exercising it
 * needed a GL context and an `expo-gl` snapshot. That was true of the version
 * buried in the component and stopped being true once the ordering moved into a
 * function whose arguments are the seams.
 */
import { captureWhenReady } from '../gl/captureWhenReady';

/** A promise plus its resolver, so a test can decide when the head arrives. */
function deferred(): { promise: Promise<void>; resolve: () => void; reject: (e: unknown) => void } {
  let resolve!: () => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<void>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

/** A bound that never elapses, so only `ready` can win the race. */
const never = () => ({ promise: new Promise<void>(() => {}), cancel: () => {} });

describe('captureWhenReady', () => {
  it('does not draw until the head has arrived', async () => {
    const gate = deferred();
    const order: string[] = [];
    const scene = { ready: gate.promise, render: () => order.push('render') };

    const capture = captureWhenReady(scene, async () => { order.push('snapshot'); return 'uri'; },
      { wait: never });

    // Let every already-resolved microtask run. Nothing should have drawn.
    await Promise.resolve();
    await Promise.resolve();
    expect(order).toEqual([]);

    gate.resolve();
    await expect(capture).resolves.toBe('uri');
    expect(order).toEqual(['render', 'snapshot']);
  });

  it('draws before snapshotting, so the frame is not stale', async () => {
    // `takeSnapshotAsync` reads the current framebuffer, so a snapshot taken
    // before the draw returns whatever was on screen before the last edit.
    const order: string[] = [];
    await captureWhenReady(
      { ready: Promise.resolve(), render: () => order.push('render') },
      async () => { order.push('snapshot'); return 1; },
    );
    expect(order).toEqual(['render', 'snapshot']);
  });

  it('goes ahead anyway if the head never arrives', async () => {
    // A portrait of the wrong head beats no portrait, and the Done button
    // should not be bet on a promise settling.
    const order: string[] = [];
    const result = await captureWhenReady(
      { ready: new Promise<void>(() => {}), render: () => order.push('render') },
      async () => 'fallback',
      { wait: () => ({ promise: Promise.resolve(), cancel: () => {} }) },
    );
    expect(result).toBe('fallback');
    expect(order).toEqual(['render']);
  });

  it('survives a rejected ready instead of taking Done down with it', async () => {
    const gate = deferred();
    gate.reject(new Error('asset exploded'));
    await expect(
      captureWhenReady({ ready: gate.promise, render: () => {} }, async () => 'ok', { wait: never }),
    ).resolves.toBe('ok');
  });

  it('does not draw into a canvas the player has left', async () => {
    // The wait is up to four seconds; a player can close the screen inside it,
    // and rendering into a disposed scene is a crash rather than a blank.
    let drew = false;
    const result = await captureWhenReady(
      { ready: Promise.resolve(), render: () => { drew = true; } },
      async () => 'uri',
      { stillAlive: () => false },
    );
    expect(result).toBeNull();
    expect(drew).toBe(false);
  });
});
