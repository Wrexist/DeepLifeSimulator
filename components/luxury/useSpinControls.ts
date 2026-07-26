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
 */

import { useMemo, useRef } from 'react';
import { PanResponder, type PanResponderInstance } from 'react-native';

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
  const start = useRef({ yaw: initialYaw, pitch: initialPitch });

  const panHandlers = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        // Claim the gesture so a parent ScrollView cannot steal a horizontal
        // drag — without this the object is unturnable inside a scrolling sheet.
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: () => {
          dragging.current = true;
          velocity.current = 0;
          lastDx.current = 0;
          start.current = { yaw: yaw.current, pitch: pitch.current };
        },
        onPanResponderMove: (_evt, gesture) => {
          yaw.current = start.current.yaw + gesture.dx * 0.011;
          pitch.current = Math.max(
            -pitchLimit,
            Math.min(pitchLimit, start.current.pitch + gesture.dy * 0.007),
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
