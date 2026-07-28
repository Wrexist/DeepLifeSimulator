/**
 * Re-renders the baked portrait when the character has aged past it.
 *
 * ## The inconsistency this closes
 *
 * `identity.portraitWeek` was written at creation and read by nothing, so a
 * built face was a snapshot of an eighteen-year-old that a seventy-year-old was
 * still wearing. The starter-portrait pool, meanwhile, ages on its own — it
 * picks a different image per age band — and the strip's own label promises
 * "Choose your face — it ages with you". One of the three systems kept that
 * promise and the other did not.
 *
 * ## Why it is a hidden canvas and not a pure function
 *
 * A portrait is a PNG snapshot of a GL framebuffer. Ageing it means rendering
 * the head again, and rendering needs a GL context, which only ever existed
 * inside the creator. So this mounts one — briefly, once, off-screen — captures,
 * writes, and unmounts. `FaceCanvas` disposes on unmount, which is not optional:
 * a leaked native GL context is a hard crash after a handful of them, not a slow
 * leak.
 *
 * Everything about it is designed to fail harmlessly, because it runs without
 * the player asking:
 *
 *   - one attempt per mount, so a device that cannot capture does not spin;
 *   - a failed capture keeps the existing portrait rather than blanking it;
 *   - nothing is written unless a real `data:` URI came back;
 *   - it renders nothing at all unless a stale BUILT portrait exists, so a
 *     character on a starter portrait never gets a GL context for this.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import FaceCanvas, { type FaceCanvasHandle } from './FaceCanvas';
import { useGameState } from '@/contexts/game/GameStateContext';
import { useGameActions } from '@/contexts/game/GameActionsContext';
import { applyFaceEdit, isPortraitStale } from '@/contexts/game/actions/IdentityActions';
import { normalizeIdentity } from '@/lib/identity';
import { FEATURE_FLAGS } from '@/lib/config/featureFlags';
import { logger } from '@/utils/logger';
import { scale } from '@/utils/scaling';

export default function PortraitRebaker(): React.JSX.Element | null {
  const { gameState, setGameState } = useGameState();
  const { saveGame } = useGameActions();
  const canvasRef = useRef<FaceCanvasHandle>(null);
  const [baking, setBaking] = useState(false);
  /** One attempt per mount — see the failure notes above. */
  const attemptedRef = useRef(false);

  const identity = gameState?.identity;
  const weeksLived = gameState?.weeksLived ?? 0;
  const age = gameState?.date?.age ?? 18;
  const stale = isPortraitStale(identity, weeksLived);

  useEffect(() => {
    if (stale && !attemptedRef.current) setBaking(true);
  }, [stale]);

  const onReady = useCallback(() => {
    if (attemptedRef.current) return;
    attemptedRef.current = true;
    void (async () => {
      let uri: string | null = null;
      try {
        // `capture()` waits for the scanned head before drawing, so this does
        // not race the GLB load and bake the procedural fallback instead.
        uri = (await canvasRef.current?.capture()) ?? null;
      } catch (err) {
        logger.warn('[PortraitRebaker] re-bake failed, keeping the old portrait', {
          error: String(err),
        });
      }
      if (uri) {
        // Against `prev`, not the captured `gameState`: this is asynchronous and
        // a week can tick while the GL context is warming up.
        setGameState((prev) =>
          applyFaceEdit(prev, normalizeIdentity(prev.identity).face, uri, prev.weeksLived ?? 0),
        );
        saveGame?.();
      }
      setBaking(false);
    })();
  }, [setGameState, saveGame]);

  if (!FEATURE_FLAGS.faceCreator3D || !baking || !identity) return null;

  return (
    <View style={styles.offscreen} pointerEvents="none" accessibilityElementsHidden>
      <FaceCanvas
        ref={canvasRef}
        genome={normalizeIdentity(identity).face}
        // THE POINT OF THE WHOLE COMPONENT: the head is built at the character's
        // CURRENT age, so `applyAging` puts the years on the face.
        age={age}
        body={identity.body}
        interactive={false}
        style={styles.canvas}
        onReady={onReady}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  // Off to the side rather than `opacity: 0` or `display: none`: the drawing
  // buffer has to be real for `takeSnapshotAsync` to read pixels out of it, and
  // a zero-sized or undisplayed GLView has nothing to read.
  offscreen: {
    position: 'absolute',
    left: -10000,
    top: 0,
    width: scale(240),
    height: scale(288),
  },
  canvas: { width: '100%', height: '100%' },
});
