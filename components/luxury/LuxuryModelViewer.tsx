/**
 * Rotatable 3D viewer for a luxury item.
 *
 * Renders the procedural showcase model for a catalogue id, or `fallback` (the
 * item's existing flat artwork) when there is no model for that id or GL is
 * unavailable. It is safe to drop into any detail screen: worst case it shows
 * exactly what the screen showed before.
 *
 * ## Why the trophies deserve this
 *
 * A collection you can only see as a thumbnail is a list, not a collection. The
 * whole appeal of owning the hypercar or the stone is looking at it, and a
 * static JPEG in a card never delivered that. The models cost zero bytes of
 * download, so the only real cost is one GL context while the sheet is open —
 * and it is unmounted the moment it closes.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PanResponder, Platform, StyleSheet, View, type ViewStyle } from 'react-native';
import { logger } from '@/utils/logger';
import { buildLuxuryModel, type ProceduralModel } from '@/lib/luxury/models';
import type { ModelScene } from './gl/ModelRenderer';

export interface LuxuryModelViewerProps {
  /** Catalogue id, e.g. `museum_diamond`. */
  itemId: string;
  /** Shown when there is no 3D model or GL is unavailable. Usually the artwork. */
  fallback?: React.ReactNode;
  /** Idle turntable. On by default — a trophy should present itself. */
  autoRotate?: boolean;
  style?: ViewStyle;
}

/** Lazy native-module load, cached. Mirrors `FaceCanvas`. */
let glModule: typeof import('expo-gl') | null | undefined;
function loadGl(): typeof import('expo-gl') | null {
  if (glModule !== undefined) return glModule ?? null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    glModule = require('expo-gl');
  } catch (err) {
    logger.warn('[LuxuryModelViewer] expo-gl unavailable — showing flat artwork', { error: String(err) });
    glModule = null;
  }
  return glModule ?? null;
}

export default function LuxuryModelViewer({
  itemId,
  fallback = null,
  autoRotate = true,
  style,
}: LuxuryModelViewerProps): React.JSX.Element {
  const gl = loadGl();
  const [failed, setFailed] = useState(false);

  // Built once per item. Cheap (single-digit ms) but there is no reason to
  // rebuild it on every unrelated re-render.
  const model: ProceduralModel | null = useMemo(() => buildLuxuryModel(itemId), [itemId]);

  const sceneRef = useRef<ModelScene | null>(null);
  const frameRef = useRef<number | null>(null);
  const yawRef = useRef(0.6);
  const pitchRef = useRef(model?.defaultPitch ?? -0.2);
  const dragStart = useRef({ yaw: 0, pitch: 0 });
  const draggingRef = useRef(false);
  const dirtyRef = useRef(true);

  useEffect(() => {
    pitchRef.current = model?.defaultPitch ?? -0.2;
    dirtyRef.current = true;
    if (sceneRef.current && model) {
      try {
        sceneRef.current.update(model);
      } catch (err) {
        logger.error('[LuxuryModelViewer] failed to rebuild model', err);
      }
    }
  }, [model]);

  const onContextCreate = useCallback(
    async (context: WebGLRenderingContext & { drawingBufferWidth: number; drawingBufferHeight: number }) => {
      if (!model) return;
      try {
        // Imperative require so three.js is not pulled into the bundle graph of
        // every screen that merely lists luxury items.
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { createModelScene } = require('./gl/ModelRenderer') as typeof import('./gl/ModelRenderer');
        const scene = createModelScene(context, model);
        sceneRef.current = scene;
        scene.setRotation(yawRef.current, pitchRef.current);

        const loop = () => {
          const current = sceneRef.current;
          if (!current) return;
          // Auto-rotate pauses while the player is dragging, or the object
          // fights the finger.
          if (autoRotate && !draggingRef.current) {
            yawRef.current += 0.004;
            dirtyRef.current = true;
          }
          if (dirtyRef.current) {
            current.setRotation(yawRef.current, pitchRef.current);
            current.render();
            (context as unknown as { endFrameEXP: () => void }).endFrameEXP();
            dirtyRef.current = false;
          }
          frameRef.current = requestAnimationFrame(loop);
        };
        loop();
      } catch (err) {
        logger.error('[LuxuryModelViewer] GL init failed — showing flat artwork', err);
        setFailed(true);
      }
    },
    [model, autoRotate],
  );

  useEffect(() => () => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
    try { sceneRef.current?.dispose(); } catch { /* already gone */ }
    sceneRef.current = null;
  }, []);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
          draggingRef.current = true;
          dragStart.current = { yaw: yawRef.current, pitch: pitchRef.current };
        },
        onPanResponderMove: (_evt, gesture) => {
          yawRef.current = dragStart.current.yaw + gesture.dx * 0.011;
          pitchRef.current = dragStart.current.pitch + gesture.dy * 0.007;
          dirtyRef.current = true;
        },
        onPanResponderRelease: () => { draggingRef.current = false; },
        onPanResponderTerminate: () => { draggingRef.current = false; },
      }),
    [],
  );

  // No model for this item, no GL, or GL failed → the screen looks exactly as
  // it did before this component existed.
  if (!model || !gl || failed || Platform.OS === 'web') {
    return <View style={[styles.container, style]}>{fallback}</View>;
  }

  const { GLView } = gl;
  return (
    <View style={[styles.container, style]} {...panResponder.panHandlers}>
      <GLView style={StyleSheet.absoluteFill} onContextCreate={onContextCreate} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
});
