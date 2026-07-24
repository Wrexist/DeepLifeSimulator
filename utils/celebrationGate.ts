/**
 * Celebration gate — "is a celebration currently owning the screen?"
 *
 * A one-flag registry so the review prompt can wait its turn. The timing rules
 * in `utils/reviewMoments.ts` already hold the store sheet back for a few
 * seconds of afterglow and until the game state looks calm, but GameState has
 * no idea a celebration MODAL is up: the promotion popup is local component
 * state on the Work screen. Without this the afterglow timer would elapse while
 * the celebration is still playing and the sheet would slam up on top of it —
 * the exact interruption the timing work exists to prevent.
 *
 * Counted rather than boolean so overlapping celebrations (a promotion that
 * also completes an ambition milestone) can't have the first one to close
 * re-open the gate while the second is still on screen.
 */

let openCelebrations = 0;

/** Call when a celebration surface appears. Pair with `endCelebration`. */
export function beginCelebration(): void {
  openCelebrations += 1;
}

/** Call when a celebration surface goes away. */
export function endCelebration(): void {
  openCelebrations = Math.max(0, openCelebrations - 1);
}

/** True while any celebration surface is on screen. */
export function isCelebrationOnScreen(): boolean {
  return openCelebrations > 0;
}

/** Test seam: force the gate back to closed. @internal */
export function __resetCelebrationGateForTests(): void {
  openCelebrations = 0;
}
