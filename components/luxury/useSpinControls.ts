/**
 * Drag-to-spin with inertia.
 *
 * Shared by the luxury viewer and the face creator, because "how does it feel to
 * turn the object" is the same question in both and answering it twice would let
 * the two drift apart.
 *
 * ## Why inertia matters more than it sounds
 *
 * Without it, the object stops dead the instant the finger lifts. That reads as
 * a slider being dragged, not an object being turned — the difference between a
 * control and a thing. A flick that keeps spinning and eases to rest is the
 * single cheapest way to make a 3D view feel expensive, and it costs one
 * velocity variable and a decay multiplier.
 *
 * The values below are tuned for a heavy, well-damped feel: a trophy should
 * carry momentum like an object with mass, not skid like a spinner.
 *
 * ## The gesture is claimed HORIZONTALLY, and that is not a detail
 *
 * Both consumers — the face creator's preview and the luxury viewer — sit at the
 * top of a vertical `ScrollView` that the player must scroll to reach every
 * control below. The object is also the largest touch target on those screens
 * and lands exactly where a thumb does.
 *
 * This used to claim the responder on TOUCH DOWN (`onStartShouldSetPanResponder:
 * () => true`) and refuse to release it. So the most natural gesture on the
 * screen — put a finger on the big picture, swipe up to see what is under it —
 * tilted the object a few degrees and moved the page zero pixels. The page read
 * as frozen, and the fix a player reaches for (swipe harder) does the same
 * nothing. Nobody would file that as "the 3D viewer steals scrolls"; they would
 * say the screen is broken.
 *
 * So a gesture has to DECLARE ITSELF horizontal before it is taken. Pitch is not
 * lost: once a drag is claimed, vertical movement inside that same gesture still
 * tilts, so turn-then-tilt works in one stroke. Only a pure vertical drag from
 * rest belongs to the page — which is the convention every horizontal carousel
 * inside a vertical list already teaches.
 */

import { useMemo, useRef } from 'react';
import { PanResponder, type PanResponderInstance } from 'react-native';

/** Horizontal dominance required to take a drag from a scrolling parent. */
const CLAIM_BIAS = 1.15;
/** Ignore jitter — a stationary finger has a dx of one or two points. */
const CLAIM_MIN_DX = 4;

/**
 * Should this drag turn the object, or scroll the page behind it?
 *
 * Exported to be tested directly: the alternative is asserting on a
 * `PanResponder`'s internals, which tests React Native rather than this rule.
 */
export function claimsGesture(dx: number, dy: number): boolean {
  return Math.abs(dx) > CLAIM_MIN_DX && Math.abs(dx) > Math.abs(dy) * CLAIM_BIAS;
}

/** Per-frame velocity decay. 0.94 ≈ coasts for ~1s after a firm flick. */
const FRICTION = 0.94;
/** Below this the spin is imperceptible; snap to rest so we can stop redrawing. */
const REST_EPSILON = 0.00025;
/** Caps a violent flick so the object cannot become a blur. */
const MAX_VELOCITY = 0.16;

export interface SpinState {
  yaw: { current: number };
  pitch: { current: number };
  dragging: { current: boolean };
  /** Advance inertia one frame. Returns true if anything moved. */
  step: () => boolean;
  panHandlers: PanResponderInstance['panHandlers'];
}

export interface SpinOptions {
  initialYaw?: number;
  initialPitch?: number;
  /** Radians of pitch allowed either side of centre. */
  pitchLimit?: number;
  /** Idle turntable speed, applied only while at rest and not dragging. */
  autoRotate?: number;
}

export function useSpinControls(options: SpinOptions = {}): SpinState {
  const {
    initialYaw = 0.6,
    initialPitch = -0.2,
    pitchLimit = 1.1,
    autoRotate = 0,
  } = options;

  const yaw = useRef(initialYaw);
  const pitch = useRef(initialPitch);
  const dragging = useRef(false);
  const velocity = useRef(0);
  const lastDx = useRef(0);
  /** Gesture offset at the moment the drag was claimed — see `onPanResponderGrant`. */
  const grab = useRef({ dx: 0, dy: 0 });
  const start = useRef({ yaw: initialYaw, pitch: initialPitch });

  const panHandlers = useMemo(
    () =>
      PanResponder.create({
        // NOT on touch down. Claiming there takes every gesture that starts on
        // the object, including the vertical swipe the player meant for the
        // page — and a tap does nothing here anyway, so nothing is given up.
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_evt, gesture) => claimsGesture(gesture.dx, gesture.dy),
        // Once a horizontal drag IS ours, keep it: without this the parent
        // ScrollView takes it back mid-turn and the object is unturnable inside
        // a scrolling sheet.
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: (_evt, gesture) => {
          dragging.current = true;
          velocity.current = 0;
          // The grant now arrives PART-WAY through the gesture — the drag had to
          // travel far enough to declare itself horizontal first — so `dx` is
          // already several points. Measuring from zero would snap the object
          // through that travel the instant it was claimed, a visible jump at
          // the start of every single turn.
          grab.current = { dx: gesture.dx, dy: gesture.dy };
          lastDx.current = gesture.dx;
          start.current = { yaw: yaw.current, pitch: pitch.current };
        },
        onPanResponderMove: (_evt, gesture) => {
          yaw.current = start.current.yaw + (gesture.dx - grab.current.dx) * 0.011;
          pitch.current = Math.max(
            -pitchLimit,
            Math.min(pitchLimit, start.current.pitch + (gesture.dy - grab.current.dy) * 0.007),
          );
          // Velocity from the FRAME delta, not the total gesture distance. Using
          // the total would make a long slow drag release like a hard flick.
          const frameDx = gesture.dx - lastDx.current;
          lastDx.current = gesture.dx;
          velocity.current = Math.max(-MAX_VELOCITY, Math.min(MAX_VELOCITY, frameDx * 0.011));
        },
        onPanResponderRelease: () => { dragging.current = false; },
        onPanResponderTerminate: () => { dragging.current = false; velocity.current = 0; },
      }).panHandlers,
    [pitchLimit],
  );

  const step = useMemo(
    () => (): boolean => {
      if (dragging.current) return true;
      if (Math.abs(velocity.current) > REST_EPSILON) {
        yaw.current += velocity.current;
        velocity.current *= FRICTION;
        return true;
      }
      velocity.current = 0;
      if (autoRotate !== 0) {
        yaw.current += autoRotate;
        return true;
      }
      return false;
    },
    [autoRotate],
  );

  return { yaw, pitch, dragging, step, panHandlers };
}
