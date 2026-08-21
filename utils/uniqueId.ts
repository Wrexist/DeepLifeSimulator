/**
 * Ids that cannot collide with each other.
 *
 * Four call sites minted ids as `` `${prefix}_${Date.now()}_${Math.floor(Math.random() * 1000)}` ``
 * — a millisecond plus one of a THOUSAND suffixes. Two of the same kind created
 * in the same millisecond collide with probability 1/1000, and the consequences
 * are not cosmetic:
 *
 *   - `buyPet` rejects a duplicate id inside its updater, deliberately, to stop
 *     a re-invoked updater appending the same pet twice. A collision between two
 *     GENUINE purchases hits that same guard: the second pet is silently
 *     dropped, no money is taken, and the caller still returns
 *     `{ success: true, message: 'Welcome Rex!' }`. The player is told they
 *     bought a pet they did not get.
 *   - videos, streams and live sessions append to history lists, so a collision
 *     puts two rows under one id, and every later
 *     `history.map(x => x.id === id ? … : x)` matches both.
 *
 * It is not theoretical: the pet case reproduced as a flaky failure in
 * `__tests__/economy/rdLabPetDoubleCharge.test.ts` — its "two separate taps DO
 * buy two pets" control drew a colliding suffix and got one pet.
 *
 * The fix is a per-session monotonic counter, so two ids minted in the same
 * millisecond differ by construction rather than by luck. Randomness is kept as
 * well, because the counter restarts at 0 on every app launch and the clock is
 * the only thing separating sessions.
 *
 * Format is deliberately unchanged in SHAPE (`prefix_<time>_<suffix>`): these
 * ids are stored in saves, and while nothing parses them today, keeping the
 * prefix means a `startsWith('pet_')` written tomorrow still works on old and
 * new ids alike.
 */

/**
 * Monotonic within a session. Wraps well before `Number.MAX_SAFE_INTEGER` so it
 * can never become non-finite, and a wrap would need ~9e15 ids in one session.
 */
let sequence = 0;

/** A fresh id that cannot equal another minted in this session. */
export function mintId(prefix: string): string {
  sequence += 1;
  if (!Number.isSafeInteger(sequence)) sequence = 1;
  const random = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${Date.now()}_${sequence.toString(36)}${random}`;
}

/**
 * A fresh id that also differs from every id already in `taken`.
 *
 * For the cases where a collision is silently DESTRUCTIVE rather than merely
 * confusing — `buyPet`, whose duplicate-id guard would drop the new pet. The
 * loop is bounded: `mintId` already cannot repeat within a session, so this can
 * only iterate when a previous session minted the same string, and one retry
 * changes both the counter and the random suffix.
 */
export function mintUniqueId(prefix: string, taken: Iterable<string | undefined | null>): string {
  const used = new Set<string>();
  for (const id of taken) {
    if (typeof id === 'string' && id.length > 0) used.add(id);
  }
  for (let attempt = 0; attempt < 8; attempt++) {
    const id = mintId(prefix);
    if (!used.has(id)) return id;
  }
  // Unreachable in practice; a distinct suffix rather than a throw, because
  // this runs on a purchase path where throwing would cost the player the item.
  return `${prefix}_${Date.now()}_${sequence.toString(36)}${Math.random().toString(36).slice(2, 12)}`;
}
