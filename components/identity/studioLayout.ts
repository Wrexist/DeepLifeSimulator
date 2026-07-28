/**
 * How big the face studio's preview is, and what fits inside it.
 *
 * ## Why this is arithmetic in a module and not two numbers in a component
 *
 * The action rail — Randomize, Undo, Compare, Reset — is absolutely positioned
 * INSIDE the preview frame. The frame's height is derived from the window, so it
 * shrinks on a short phone, and the rail does not shrink with it: the fourth
 * control simply falls off the bottom edge. Reset is the one a player reaches
 * for after a slider goes wrong, so losing it is losing the recovery path.
 *
 * That has now been got wrong twice, both times by guessing:
 *
 *   1. The frame was `scale(330)` — a HEIGHT computed from `scale()`, which is
 *      width-based. Fixing it to a fraction of the window shrank the frame and
 *      clipped the rail for the first time.
 *   2. The fix for THAT was a guessed threshold (`frameHeight < 300`) with a
 *      guessed compact size. It was verified against a screenshot harness whose
 *      rail labels were plain 9px text — but the app's labels are pills with
 *      padding, about twice as tall. The harness said it fit. On a 667pt phone
 *      it does not: the tightened rail needs 289pt inside a 253pt frame.
 *
 * So the rule stops being a threshold somebody chose and becomes the height the
 * rail actually occupies, compared against the height it actually has. The
 * screenshot harness imports this file rather than mirroring it, which is what
 * stops the instrument from disagreeing with the app a third time.
 *
 * Everything here is in UNSCALED design points. The caller multiplies by the
 * device's `scale()` factor, because the rail scales with width while the frame
 * is derived from height — the two can pull apart on a wide short screen, and
 * that is exactly where a fixed threshold breaks.
 */

/** Four controls: Randomize, Undo, Compare, Reset. */
const CONTROLS = 4;
/** `styles.actions` top offset. */
const TOP = 14;
/** Breathing room under the last label, so it is not flush with the frame edge. */
const BOTTOM = 10;
/**
 * Height of one label pill: `marginTop: 5`, a ~13pt line at `fontScale(10.5)`,
 * and `paddingVertical: 2.5` twice. The 5pt of padding is the part the old
 * harness left out, which is how a rail that does not fit looked like one that
 * did.
 */
const LABEL = 23;

export interface RailLayout {
  /** Button diameter, unscaled. */
  button: number;
  /** Vertical gap between controls, unscaled. */
  gap: number;
  /** Whether the text label under each control is drawn. */
  labels: boolean;
  /** Total unscaled height this tier occupies inside the frame. */
  height: number;
}

function tier(button: number, gap: number, labels: boolean): RailLayout {
  return {
    button,
    gap,
    labels,
    height: TOP + CONTROLS * (button + (labels ? LABEL : 0)) + (CONTROLS - 1) * gap + BOTTOM,
  };
}

/**
 * Ordered best-first. Each step gives up the least valuable thing left:
 * size before labels, and labels before any control.
 *
 * Dropping the labels is the last concession and it is still the right one — an
 * unlabelled dice icon is usable and mostly guessable, while a clipped Reset is
 * neither visible nor reachable. Nothing is lost to a screen reader either: the
 * `accessibilityLabel` on each button is independent of the drawn text.
 */
const TIERS: readonly RailLayout[] = [
  tier(46, 14, true),
  tier(38, 7, true),
  tier(38, 7, false),
];

/**
 * The largest rail that fits in `frameHeight`.
 *
 * `scaleFactor` is the device's `scale()` multiplier (`scale(100) / 100`), since
 * the rail's dimensions are scaled and the frame's height is not.
 */
export function railLayout(frameHeight: number, scaleFactor = 1): RailLayout {
  for (const candidate of TIERS) {
    if (candidate.height * scaleFactor <= frameHeight) return candidate;
  }
  // Smaller than the smallest tier: take it anyway. Overflowing by a few points
  // with all four controls present beats dropping one.
  return TIERS[TIERS.length - 1];
}

/**
 * Preview height for a given window height.
 *
 * 38% of the window, clamped. On a 667pt phone the header, the sticky footer and
 * the safe areas leave about 417pt, so the clamp is what keeps roughly two
 * control rows under the head — enough to show the screen is editable without
 * shrinking the head to a thumbnail on a large phone.
 */
export function frameHeightFor(windowHeight: number): number {
  return Math.round(Math.min(Math.max(windowHeight * 0.38, 230), 360));
}
