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
import { Platform, StyleSheet, View, type ViewStyle } from 'react-native';
import LinearGradientFallback from '@/components/fallbacks/LinearGradientFallback';
import { logger } from '@/utils/logger';
import { useSpinControls } from './useSpinControls';
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
  const dirtyRef = useRef(true);

  const spin = useSpinControls({
    initialYaw: 0.6,
    initialPitch: model?.defaultPitch ?? -0.2,
    pitchLimit: 1.3,
    autoRotate: autoRotate ? 0.0032 : 0,
  });
  const yawRef = spin.yaw;
  const pitchRef = spin.pitch;

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
          // `step` advances inertia, then the idle turntable once at rest. It
          // returns false when nothing moved, which lets the loop skip the draw
          // entirely — a still object costs no GPU time.
          if (spin.step()) dirtyRef.current = true;
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
    [model, spin],
  );

  useEffect(() => () => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
    try { sceneRef.current?.dispose(); } catch { /* already gone */ }
    sceneRef.current = null;
  }, []);

  // No model for this item, no GL, or GL failed → the screen looks exactly as
  // it did before this component existed.
  if (!model || !gl || failed || Platform.OS === 'web') {
    return <View style={[styles.container, style]}>{fallback}</View>;
  }

  const { GLView } = gl;
  return (
    <View style={[styles.container, style]} {...spin.panHandlers}>
      {/* A soft radial pedestal behind the object. Product photography never
          shoots against flat black — the gradient gives the trophy a room to
          sit in, and stops the silhouette from dissolving into the sheet. */}
      <LinearGradientFallback
        pointerEvents="none"
        colors={['#1C2536', '#141A26', '#0B0F17']}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <GLView style={StyleSheet.absoluteFill} onContextCreate={onContextCreate} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
});
