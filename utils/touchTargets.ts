/**
 * Minimum touch targets, in one place.
 *
 * PLAYER REPORT (1.4 bug-reports): "Entering the Life Skills UI - the X is
 * slightly hidden … The family UI X is also misaligned somewhere. This one is
 * actually hard to click sometimes."
 *
 * An accessibility pass over `components/` and `app/` measured the close
 * controls and found the same shape everywhere: a `scale()`d icon inside a
 * container with no minimum size, and — where a `hitSlop` existed at all — a
 * RAW numeric literal beside the scaled icon.
 *
 * That last detail is why the targets never reach 44pt on a phone. `scale()`
 * clamps at 1.3 on non-tablets, and no shipping iPhone reaches the clamp: a
 * 440pt Pro Max is 440/375 = 1.173, so `scale(20)` is 23. Pairing that with a
 * raw `hitSlop={10}` gives 23 + 20 = 43 — one point short, on the widest phone
 * Apple sells, and worse on every narrower one. Scaling the icon but not the
 * slop is the §5 raw-pixel rule producing a concrete miss.
 *
 * Measured before this: the Restart Game confirm's close was 24x24, the
 * delete-bill button 22x22, the family-tree close 34x34.
 */
import { scale } from './scaling';

/**
 * Apple HIG and Material both put the minimum at 44pt / 48dp. 44 is the
 * stricter of the two and the one iOS reviewers check.
 */
export const MIN_TOUCH_TARGET = 44;

/**
 * `hitSlop` that brings a rendered control up to {@link MIN_TOUCH_TARGET},
 * whatever the device scale.
 *
 * Pass the control's rendered size in the SAME units it is drawn in — i.e. the
 * already-scaled value. `closeButtonHitSlop(24)` on a `<X size={24}>` with no
 * padding returns 10 on a 375pt phone and shrinks as the icon grows, so the
 * total is always at least 44.
 *
 * Returns a uniform object rather than a number so a caller cannot accidentally
 * pass it where a raw number is expected and lose the scaling.
 */
export function hitSlopToMinTarget(
  renderedSize: number,
): { top: number; bottom: number; left: number; right: number } {
  const target = scale(MIN_TOUCH_TARGET);
  const deficit = Math.max(0, target - renderedSize);
  const slop = Math.ceil(deficit / 2);
  return { top: slop, bottom: slop, left: slop, right: slop };
}

/**
 * Style for a close (X) button: a real, scaled minimum box.
 *
 * Preferred over `hitSlop` where the layout allows it, because a sized box is
 * visible to the layout engine — a slop-only target still LOOKS tiny, which is
 * half of what the player reported ("slightly hidden", "misaligned").
 */
export const minTouchTargetStyle = {
  minWidth: scale(MIN_TOUCH_TARGET),
  minHeight: scale(MIN_TOUCH_TARGET),
  alignItems: 'center' as const,
  justifyContent: 'center' as const,
};

/**
 * The props every close button should carry.
 *
 * Bundled so a new modal cannot ship with the size but not the label, which is
 * how 51 close buttons ended up with neither. `accessibilityLabel` is what a
 * screen reader announces; without it VoiceOver focuses the control and says
 * nothing at all.
 */
export const CLOSE_BUTTON_A11Y = {
  accessibilityRole: 'button' as const,
  accessibilityLabel: 'Close',
};
