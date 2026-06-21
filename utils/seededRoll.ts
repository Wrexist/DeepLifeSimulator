/**
 * Deterministic [0,1) roll keyed by an arbitrary string and seeded by the
 * absolute week (`weeksLived`).
 *
 * The weekly subsystem ticks (crypto, dark-web, politics, stocks) are written to
 * be reproducible when handed a seeded `rollFor(key)` — their own docs say so.
 * But the call sites passed `() => Math.random()`, which has two problems:
 *   1. React 19 invokes the `setGameState` updater twice in StrictMode (and may
 *      run it speculatively under concurrent rendering); each invocation drew
 *      different random numbers, so the committed outcome was whichever render
 *      React happened to keep — internally inconsistent with the codebase's
 *      pre-roll determinism architecture.
 *   2. Outcomes weren't reproducible from the save seed (no save-scum integrity).
 *
 * This helper restores determinism: the same week + same key always yields the
 * same roll, while distinct keys stay independent and well-distributed. Every
 * `rollFor` key in those ticks is unique per logical draw (namespaced by coin /
 * vendor / sector / loop index), so keying on the string is collision-free.
 */
function hashStringToSeed(weeksLived: number, key: string): number {
  // FNV-1a over the key, folded into the week seed.
  let h = ((weeksLived | 0) ^ 0x811c9dc5) >>> 0;
  for (let i = 0; i < key.length; i++) {
    h = Math.imul(h ^ key.charCodeAt(i), 0x01000193) >>> 0;
  }
  return h >>> 0;
}

export function makeWeeklyRoll(weeksLived: number): (key: string) => number {
  return (key: string) => {
    // mulberry32 finalizer on the per-key seed for good avalanche / uniformity.
    let a = hashStringToSeed(weeksLived, key);
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
