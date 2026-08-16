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

/** FNV-1a offset basis (2166136261) and prime (16777619). */
const FNV_OFFSET_BASIS = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

/**
 * FNV-1a over a string, returned as an UNSIGNED 32-bit integer.
 *
 * THE one copy. Five hand-rolled duplicates of this exact loop existed
 * (`lib/social/pulseTick.ts`, `lib/economy/stockMarket.ts`,
 * `lib/careers/jobMarket.ts`, `lib/randomness/deterministicRng.ts` and this
 * file), each re-deriving the same offset basis, the same prime and the same
 * `Math.imul` mixing step — every one of them feeding a roll that is baked into
 * a save. Consolidated here by the 2026-08-16 audit (H7c) after checking that
 * the loops are bit-identical, so no downstream roll moved.
 *
 * `seedBasis` replaces the offset basis for callers that fold something into
 * the seed before hashing (this module folds the absolute week). The intra-loop
 * `>>> 0` is a no-op on the result: `^` and `Math.imul` both read only the low
 * 32 bits, so the copies that omitted it computed the same value.
 *
 * NOTE: the sixth copy, `lib/parenting/grandchildren.ts`, is deliberately NOT
 * routed through here — it returns `Math.abs(signed)`, not `>>> 0`, which is a
 * DIFFERENT number for half of all inputs. See the comment there.
 */
export function fnv1a32(input: string, seedBasis: number = FNV_OFFSET_BASIS): number {
  let h = seedBasis >>> 0;
  for (let i = 0; i < input.length; i++) {
    h = Math.imul(h ^ input.charCodeAt(i), FNV_PRIME) >>> 0;
  }
  return h >>> 0;
}

/**
 * mulberry32 — a small, fast, well-distributed PRNG stream from a 32-bit seed.
 * The single copy; `lib/economy/stockMarket.ts` had an identical one.
 */
export function mulberry32(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashStringToSeed(weeksLived: number, key: string): number {
  // FNV-1a over the key, folded into the week seed.
  return fnv1a32(key, (weeksLived | 0) ^ FNV_OFFSET_BASIS);
}

export function makeWeeklyRoll(weeksLived: number): (key: string) => number {
  return (key: string) => {
    // mulberry32 finalizer on the per-key seed for good avalanche / uniformity.
    // One step of the stream — identical arithmetic to the previous inline copy.
    return mulberry32(hashStringToSeed(weeksLived, key))();
  };
}
