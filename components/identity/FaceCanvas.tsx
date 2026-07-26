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

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PanResponder, Platform, StyleSheet, View, type ViewStyle } from 'react-native';
import { logger } from '@/utils/logger';
import type { BodyProfile, FaceGenome } from '@/lib/identity';
import type { FaceScene } from './gl/FaceRenderer';

export interface FaceCanvasHandle {
  /**
   * Snapshot the current frame as a PNG data URI, for `identity.portraitUri`.
   * Resolves null when GL is unavailable or the snapshot fails.
   */
  capture(): Promise<string | null>;
}

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
  const yawRef = useRef(0);
  const pitchRef = useRef(0);
  const dragStart = useRef({ yaw: 0, pitch: 0 });
  // Written by the render loop, read by nothing else — a ref rather than state
  // so a 60 Hz loop never triggers a React render.
  const dirtyRef = useRef(true);

  React.useImperativeHandle(ref, () => ({
    async capture() {
      const context = glContextRef.current;
      const glLib = loadGl();
      if (!context || !glLib || !sceneRef.current) return null;
      try {
        // Render once immediately so the snapshot cannot catch a stale frame
        // mid-edit — takeSnapshotAsync reads the current framebuffer.
        sceneRef.current.render();
        const snapshot = await glLib.GLView.takeSnapshotAsync(context as never, { format: 'png' });
        const uri = typeof snapshot?.uri === 'string' ? snapshot.uri : null;
        // Only a data URI is worth storing: a file:// path does not survive an
        // app reinstall, and a dead path renders as a permanently blank circle
        // with no way to recover. `normalizeIdentity` drops non-data URIs for
        // exactly this reason.
        return uri && uri.startsWith('data:image') ? uri : null;
      } catch (err) {
        logger.warn('[FaceCanvas] portrait capture failed', { error: String(err) });
        return null;
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
        const scene = createFaceScene(context, { genome, age, body });
        sceneRef.current = scene;
        glContextRef.current = context;
        scene.setRotation(yawRef.current, pitchRef.current);

        const loop = () => {
          const current = sceneRef.current;
          if (!current) return;
          if (autoRotate) {
            yawRef.current += 0.006;
            dirtyRef.current = true;
          }
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
    [genome, age, body, autoRotate, onReady],
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

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => interactive,
        onMoveShouldSetPanResponder: () => interactive,
        onPanResponderGrant: () => {
          dragStart.current = { yaw: yawRef.current, pitch: pitchRef.current };
        },
        onPanResponderMove: (_evt, gesture) => {
          yawRef.current = dragStart.current.yaw + gesture.dx * 0.01;
          pitchRef.current = dragStart.current.pitch + gesture.dy * 0.006;
          dirtyRef.current = true;
        },
      }),
    [interactive],
  );

  // Web and any environment without the native module get the flat portrait.
  // expo-gl does ship a web build, but this app's web target is a preview
  // surface, and shipping three.js into it for that is not a trade worth making.
  if (!gl || failed || Platform.OS === 'web') {
    return <View style={[styles.container, style]}>{fallback}</View>;
  }

  const { GLView } = gl;
  return (
    <View style={[styles.container, style]} {...(interactive ? panResponder.panHandlers : {})}>
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
