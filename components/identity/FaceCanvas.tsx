/**
 * Live 3D head canvas.
 *
 * Wraps `expo-gl` + `FaceRenderer`. This is the ONLY place in the app that ever
 * creates a GL context, which is the whole architecture in one sentence: live 3D
 * on the creator screen, a baked PNG everywhere else. A Spark stack or a Pulse
 * feed with dozens of live GL heads would not hold frame rate on any phone, and
 * every avatar surface in this app is a scrolling list.
 *
 * ## Degradation
 *
 * `expo-gl` is a native module, so it is lazy-required in a try/catch per the
 * project convention (DEV.md § Native modules). If it is missing — an OTA build
 * running older native code, a simulator with no GL, an unsupported driver — the
 * component renders `fallback` instead. It never throws, and it never renders
 * blank: a character always has a face.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, View, type ViewStyle } from 'react-native';
import { logger } from '@/utils/logger';
import { useSpinControls } from '@/components/luxury/useSpinControls';
import type { BodyProfile, FaceGenome } from '@/lib/identity';
import type { FaceScene } from './gl/FaceRenderer';
import { captureWhenReady } from './gl/captureWhenReady';

export interface FaceCanvasHandle {
  /**
   * Snapshot the current frame as a PNG data URI, for `identity.portraitUri`.
   * Resolves null when GL is unavailable or the snapshot fails.
   */
  capture(): Promise<string | null>;
}

/**
 * Longest edge of the stored portrait, and the hard ceiling on its size.
 *
 * The portrait ends up in an 80-point circular frame — 240 px on a 3x screen —
 * so 448 on the long edge is generous, and it turns a capture from hundreds of
 * kilobytes into tens. Applied as a SCALE FACTOR on both edges rather than a
 * fixed shape, because `FaceRenderer.resize` updates the camera aspect: a fixed
 * shape would reframe the head away from what the player was looking at.
 *
 * The byte cap is the part that matters. `identity.portraitUri` is written into
 * every save, saves are capped at 4 MB, and `pruneSaveData` only trims arrays —
 * so an oversized portrait is unprunable, survives both prune passes, and makes
 * `saveQueue` throw "Save data too large" forever after. 512 KB leaves the
 * portrait a rounding error against that cap even with five backups per slot.
 */
const PORTRAIT_MAX_EDGE = 448;
export const PORTRAIT_MAX_BYTES = 512 * 1024;

export interface FaceCanvasProps {
  genome: FaceGenome;
  age: number;
  body?: BodyProfile;
  /** Rendered when GL cannot be used. Never leave this empty. */
  fallback?: React.ReactNode;
  /** Lets the player spin the head. */
  interactive?: boolean;
  /** Slow idle turntable, for a hero/profile view. */
  autoRotate?: boolean;
  style?: ViewStyle;
  onReady?: () => void;
}

/** Lazy native-module load. Cached so the try/catch runs at most once. */
let glModule: typeof import('expo-gl') | null | undefined;
function loadGl(): typeof import('expo-gl') | null {
  if (glModule !== undefined) return glModule;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    glModule = require('expo-gl');
  } catch (err) {
    logger.warn('[FaceCanvas] expo-gl unavailable — falling back to a flat portrait', { error: String(err) });
    glModule = null;
  }
  return glModule ?? null;
}

function FaceCanvasInner(
  { genome, age, body, fallback = null, interactive = true, autoRotate = false, style, onReady }: FaceCanvasProps,
  ref: React.Ref<FaceCanvasHandle>,
): React.JSX.Element {
  const gl = loadGl();
  const [failed, setFailed] = useState(false);

  const sceneRef = useRef<FaceScene | null>(null);
  const glContextRef = useRef<unknown>(null);
  const frameRef = useRef<number | null>(null);
  // Written by the render loop, read by nothing else — a ref rather than state
  // so a 60 Hz loop never triggers a React render.
  const dirtyRef = useRef(true);

  // Shared with the luxury viewer so turning a head and turning a trophy feel
  // identical. Pitch is clamped tighter here: past ~0.5 rad the camera is
  // looking up the character's nose, and there is no geometry inside the head.
  const spin = useSpinControls({
    initialYaw: 0,
    initialPitch: 0,
    pitchLimit: 0.5,
    autoRotate: autoRotate ? 0.005 : 0,
  });
  const yawRef = spin.yaw;
  const pitchRef = spin.pitch;

  React.useImperativeHandle(ref, () => ({
    async capture() {
      const context = glContextRef.current;
      const glLib = loadGl();
      if (!context || !glLib || !sceneRef.current) return null;
      // BOUND THE PIXELS BEFORE READING THEM.
      //
      // `takeSnapshotAsync` captures the drawing buffer at its real size, which
      // on a 3x-density phone is around 1100x1300 — a PNG measured in hundreds
      // of kilobytes, base64'd into `identity.portraitUri`, and then written
      // into EVERY save.
      //
      // That is not a size annoyance, it is a way to brick a save file. Saves
      // are capped at `MAX_SAVE_SIZE` (4 MB) and `pruneSaveData` only trims
      // arrays — a portrait is unprunable — so a big enough one pushes the save
      // over the cap, survives both prune passes, and `saveQueue` throws
      // "Save data too large". The player then cannot save again. Backups make
      // it worse: five per slot against a 10 MB budget, all carrying the same
      // picture.
      //
      // The scene already knows how to resize, so the capture renders into a
      // portrait-sized buffer and restores the on-screen size straight after.
      // It costs one frame at a smaller resolution, at the moment the player
      // taps Done and the modal closes over it.
      const scene = sceneRef.current;
      const prevWidth = (context as { drawingBufferWidth?: number }).drawingBufferWidth ?? 0;
      const prevHeight = (context as { drawingBufferHeight?: number }).drawingBufferHeight ?? 0;
      try {
        // Scale BOTH edges by one factor rather than resizing to a fixed shape.
        // `resize` updates `camera.aspect`, so a fixed 384x448 would reframe the
        // head to a different aspect than the player was just looking at — and
        // on a narrower one it could clip the ears. Same aspect, fewer pixels,
        // identical framing.
        const longest = Math.max(prevWidth, prevHeight);
        if (longest > PORTRAIT_MAX_EDGE) {
          const k = PORTRAIT_MAX_EDGE / longest;
          scene.resize(Math.max(1, Math.round(prevWidth * k)), Math.max(1, Math.round(prevHeight * k)));
        }
        // Waits for the scanned head before drawing — see `captureWhenReady`.
        const snapshot = await captureWhenReady(
          sceneRef.current,
          () => glLib.GLView.takeSnapshotAsync(context as never, { format: 'png' }),
          { stillAlive: () => sceneRef.current !== null },
        );
        const uri = typeof snapshot?.uri === 'string' ? snapshot.uri : null;
        // Only a data URI is worth storing: a file:// path does not survive an
        // app reinstall, and a dead path renders as a permanently blank circle
        // with no way to recover. `normalizeIdentity` drops non-data URIs for
        // exactly this reason.
        if (!uri || !uri.startsWith('data:image')) return null;
        // Independent backstop. The resize above should keep this far under the
        // cap, but this runs on devices and drivers that cannot be tested here,
        // and the failure it guards against is unsaveable-forever. Dropping the
        // portrait costs the player their custom face on the card; keeping an
        // oversized one can cost them the run.
        if (uri.length > PORTRAIT_MAX_BYTES) {
          logger.warn('[FaceCanvas] portrait too large to store, keeping starter portrait', {
            bytes: uri.length,
            limit: PORTRAIT_MAX_BYTES,
          });
          return null;
        }
        return uri;
      } catch (err) {
        logger.warn('[FaceCanvas] portrait capture failed', { error: String(err) });
        return null;
      } finally {
        // Restore the on-screen size whatever happened, or the head stays
        // rendered at portrait resolution in a modal the player may reopen.
        if (prevWidth > 0 && prevHeight > 0 && sceneRef.current === scene) {
          try {
            scene.resize(prevWidth, prevHeight);
            scene.render();
          } catch {
            // A scene torn down mid-capture is the normal case here, not a fault.
          }
        }
      }
    },
  }), []);

  // Rebuild the head whenever the character changes. `update()` disposes the old
  // geometry before building the new one, so dragging a slider does not leak.
  useEffect(() => {
    if (!sceneRef.current) return;
    try {
      sceneRef.current.update({ genome, age, body });
      dirtyRef.current = true;
    } catch (err) {
      logger.error('[FaceCanvas] failed to rebuild head', err);
    }
  }, [genome, age, body]);

  const onContextCreate = useCallback(
    async (context: WebGLRenderingContext & { drawingBufferWidth: number; drawingBufferHeight: number }) => {
      try {
        // Required imperatively rather than imported: a static import of
        // FaceRenderer would pull three.js into the bundle graph of every screen
        // that merely renders a portrait.
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { createFaceScene } = require('./gl/FaceRenderer') as typeof import('./gl/FaceRenderer');
        const scene = createFaceScene(context, { genome, age, body }, {
          // The scanned head loads asynchronously and the loop only draws when
          // dirty, so without this the swap would not appear until the player
          // happened to move a slider.
          onInvalidate: () => { dirtyRef.current = true; },
        });
        sceneRef.current = scene;
        glContextRef.current = context;
        scene.setRotation(yawRef.current, pitchRef.current);

        const loop = () => {
          const current = sceneRef.current;
          if (!current) return;
          // Inertia first, then the idle turntable once at rest. Returns false
          // when nothing moved, so a still head costs no GPU time.
          if (spin.step()) dirtyRef.current = true;
          if (dirtyRef.current) {
            current.setRotation(yawRef.current, pitchRef.current);
            current.render();
            // expo-gl requires this to present the frame; without it nothing
            // reaches the screen even though three has drawn correctly.
            (context as unknown as { endFrameEXP: () => void }).endFrameEXP();
            dirtyRef.current = false;
          }
          frameRef.current = requestAnimationFrame(loop);
        };
        loop();
        onReady?.();
      } catch (err) {
        logger.error('[FaceCanvas] GL init failed — falling back', err);
        setFailed(true);
      }
    },
    [genome, age, body, spin, onReady],
  );

  useEffect(() => () => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
    // Dispose on unmount is not optional: a leaked native GL context is a hard
    // crash after a handful of creator visits, not a slow leak.
    try { sceneRef.current?.dispose(); } catch { /* already gone */ }
    sceneRef.current = null;
    glContextRef.current = null;
  }, []);

  // Web and any environment without the native module get the flat portrait.
  // expo-gl does ship a web build, but this app's web target is a preview
  // surface, and shipping three.js into it for that is not a trade worth making.
  if (!gl || failed || Platform.OS === 'web') {
    return <View style={[styles.container, style]}>{fallback}</View>;
  }

  const { GLView } = gl;
  return (
    <View style={[styles.container, style]} {...(interactive ? spin.panHandlers : {})}>
      <GLView style={StyleSheet.absoluteFill} onContextCreate={onContextCreate} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
});

export const FaceCanvas = React.forwardRef<FaceCanvasHandle, FaceCanvasProps>(FaceCanvasInner);
FaceCanvas.displayName = 'FaceCanvas';

export default FaceCanvas;
