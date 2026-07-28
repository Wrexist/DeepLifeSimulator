/**
 * Who owns a drag that starts on a control inside a scrolling page.
 *
 * ## The failure this exists to stop
 *
 * A `PanResponder` with `onStartShouldSetPanResponder: () => true` takes EVERY
 * gesture that begins on its view, before any direction exists to judge — and
 * `onPanResponderTerminationRequest: () => false` then refuses to give it back.
 * Inside a vertical `ScrollView` that is not "the control is responsive", it is
 * "the page cannot be scrolled from anywhere the control happens to be".
 *
 * The face studio had this twice over. The 3D head sits at the top of the scroll
 * as the largest touch target on the screen, and six slider tracks span most of
 * the width below it. Between them they covered most of what a thumb can land
 * on, so the ordinary gesture — finger down, swipe up to see more — turned the
 * head a few degrees, or silently rewrote a morph, and moved the page nothing.
 *
 * Nobody reports that as a responder conflict. They report that the screen is
 * frozen, because the remedy they reach for (swipe again, harder, same place)
 * does exactly as little.
 *
 * The rule: a horizontal drag belongs to the control, everything else belongs to
 * the page. It is the convention every horizontal carousel inside a vertical
 * list already teaches, and it costs the control nothing, because both controls
 * that use it are driven horizontally anyway.
 *
 * ## Not every PanResponder wants this
 *
 * The app has four. The two that needed the rule use it; the other two claim on
 * touch down and are RIGHT to, because neither sits in a scrolling parent:
 *
 *   - `AvatarReveal` — the before/after split handle on the selfie reveal. It
 *     is in a fixed frame with no ScrollView anywhere above it, and a
 *     comparison handle that waits four points before moving reads as broken.
 *   - `SwipeScreen` — the Spark card deck. Already conditional on movement in
 *     EITHER axis, which is what a card that throws in four directions needs.
 *
 * Recorded because the obvious next move for someone reading the fix is to
 * apply it everywhere the old pattern appears. The pattern is not the defect —
 * the pattern inside a ScrollView is.
 */

/** Horizontal dominance required to take a drag from a scrolling parent. */
const CLAIM_BIAS = 1.15;
/** Ignore jitter — a stationary finger reports one or two points of movement. */
const CLAIM_MIN_DX = 4;

/**
 * True when this drag should be taken from the scrolling parent.
 *
 * A pure function so it can be tested directly: the alternative is asserting on
 * a `PanResponder`'s internals, which tests React Native rather than the rule.
 */
export function claimsHorizontalDrag(dx: number, dy: number): boolean {
  return Math.abs(dx) > CLAIM_MIN_DX && Math.abs(dx) > Math.abs(dy) * CLAIM_BIAS;
}
