/**
 * The ordering rule for taking a portrait: wait for the scanned head, then draw,
 * then snapshot.
 *
 * ## Why it is a function and not four lines in the component
 *
 * The rule is real logic with three failure modes, and testing it inside
 * `FaceCanvas` would mean faking `expo-gl` — at which point the test is mostly
 * about the fake. Here the arguments ARE the seams, so the ordering can be
 * asserted with three trivial stubs and no native module in sight.
 *
 * ## What the rule is for
 *
 * The procedural head is drawn immediately on every open of the creator so the
 * canvas is never blank, and the scanned head swaps in once ~1 MB of glTF has
 * parsed. The portrait is snapshotted from that same canvas when the player taps
 * Done. Without the wait, a player who tapped through inside the parse window
 * got a portrait of the procedural head written into their save permanently,
 * while the creator and every later view showed the scanned one.
 */

export interface CaptureTarget {
  /** Settles when the scanned head is in place, or when loading it has failed. */
  ready: Promise<void>;
  /** Draw the current frame. `takeSnapshotAsync` reads the framebuffer. */
  render(): void;
}

export interface CaptureOptions {
  /**
   * How long to wait for `ready` before going ahead anyway.
   *
   * A portrait of the wrong head beats no portrait, and the Done button should
   * not be bet on a promise settling.
   */
  timeoutMs?: number;
  /**
   * False once the canvas has gone — the player can leave the screen during the
   * wait, and rendering into a disposed scene is a crash rather than a blank.
   */
  stillAlive?: () => boolean;
  /**
   * The bound, as a promise that can be CANCELLED.
   *
   * A plain `(ms) => Promise` was the first shape and it leaked: `Promise.race`
   * abandons the loser but the timer keeps running, so every capture left a
   * four-second timer pending. Jest refused to exit, which is how it surfaced —
   * on a device it is a stray wakeup per portrait rather than a bug, but the
   * seam may as well be the right shape.
   */
  wait?: (ms: number) => { promise: Promise<void>; cancel(): void };
}

/**
 * Wait for the head, draw, and snapshot. Resolves null if the canvas went away
 * while waiting.
 */
export async function captureWhenReady<T>(
  scene: CaptureTarget,
  snapshot: () => Promise<T>,
  options: CaptureOptions = {},
): Promise<T | null> {
  const {
    timeoutMs = 4000,
    stillAlive,
    wait = (ms: number) => {
      let handle: ReturnType<typeof setTimeout>;
      const promise = new Promise<void>((resolve) => { handle = setTimeout(resolve, ms); });
      return { promise, cancel: () => clearTimeout(handle) };
    },
  } = options;

  const bound = wait(timeoutMs);
  try {
    // `ready` is documented never to reject, but a rejection here would take the
    // Done button down with it, so it is caught rather than trusted.
    await Promise.race([scene.ready.catch(() => undefined), bound.promise]);
  } finally {
    bound.cancel();
  }
  if (stillAlive && !stillAlive()) return null;

  // Draw immediately before reading: the snapshot reads the current framebuffer,
  // so without this it can catch a frame from before the last edit.
  scene.render();
  return snapshot();
}
