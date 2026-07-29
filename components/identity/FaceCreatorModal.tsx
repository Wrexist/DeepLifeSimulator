/**
 * The face creator in a full-screen modal.
 *
 * A thin shell whose real job is LIFECYCLE: the creator is unmounted entirely
 * while closed (`visible === false` renders nothing inside the Modal), so the
 * GL context is created on open and destroyed on close. A kept-alive canvas
 * would hold a native GL context for the whole session, and a few of those is a
 * crash rather than a slowdown.
 *
 * It is also the ROUTER for the two ways into a face:
 *
 *   entry ─┬─ selfie (DeepLife+) ─→ SelfieFlow ─→ studio, pre-filled
 *          └─ manual (free)  ─────────────────→ studio
 *
 * The studio is the same screen either way. A selfie scan does not open a
 * different editor — it opens the editor with the sliders already set, which is
 * the point: the player can then change anything, and nothing they learn about
 * the controls is wasted.
 *
 * `startAt` lets a caller skip the entry screen. Re-opening the creator to
 * tweak an existing face should not ask "photo or manual?" again; that question
 * belongs to the first run.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Modal, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X } from 'lucide-react-native';
import FaceStudio from './FaceStudio';
import type { FaceCanvasHandle } from './FaceCanvas';
import BecomeYourself from './BecomeYourself';
import SelfieFlow from './SelfieFlow';
import SubscriptionModal from '@/components/SubscriptionModal';
import { useDeepLifePlusUpsell } from '@/hooks/useDeepLifePlusUpsell';
import { isPhotoAvatarSupported } from '@/services/avatar/AvatarService';
import type { BodyProfile, FaceGenome } from '@/lib/identity';
import { getThemeColors, spacing } from '@/lib/config/theme';
import { fontScale, scale } from '@/utils/scaling';

export interface FaceCreatorModalProps {
  visible: boolean;
  genome: FaceGenome;
  onChange: (genome: FaceGenome) => void;
  onClose: () => void;
  /** Receives the baked portrait data URI (null when GL was unavailable). */
  onDone?: (portraitUri: string | null) => void;
  age?: number;
  body?: BodyProfile;
  sex?: string;
  title?: string;
  doneLabel?: string;
  /** Shown inside the canvas when GL is unavailable. */
  fallback?: React.ReactNode;
  /**
   * `'entry'` offers the selfie route first; `'studio'` goes straight to the
   * editor. Default `'entry'` for first-time creation, `'studio'` when
   * re-opening a face that already exists.
   */
  startAt?: 'entry' | 'studio';
}

export default function FaceCreatorModal({
  visible,
  genome,
  onChange,
  onClose,
  onDone,
  age = 18,
  body,
  sex = 'random',
  title = 'Build your face',
  doneLabel = 'Use this face',
  fallback,
  startAt = 'entry',
}: FaceCreatorModalProps): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const theme = getThemeColors(true);
  const upsell = useDeepLifePlusUpsell('face_creator');
  const [route, setRoute] = useState<'entry' | 'selfie' | 'studio'>(startAt);

  // Every open starts from the caller's chosen route. Without this, closing on
  // the reveal and re-opening drops the player back into a finished scan of a
  // photo they can no longer see.
  useEffect(() => {
    if (visible) setRoute(startAt);
  }, [visible, startAt]);

  const canvasRef = useRef<FaceCanvasHandle>(null);
  /**
   * The portrait cut out of the player's photo, when they came in that way.
   *
   * Kept here rather than pushed straight out because the selfie route lands in
   * the STUDIO, not out of the creator — so the photo portrait has to survive
   * until the player taps Done, and it has to WIN over the GL snapshot taken
   * then. A player who chose a photo and is then given a render of a 3D head
   * did not get what they asked for.
   */
  const photoPortraitRef = useRef<string | null>(null);
  // Cleared on every open, or a second visit through the manual route would
  // silently re-apply the previous run's photo.
  useEffect(() => { if (visible) photoPortraitRef.current = null; }, [visible]);
  // Done is asynchronous now, so a second tap before the first resolves would
  // capture twice and close twice. Invisible when the snapshot is fast, which
  // is the normal case; the guard is for when it is not.
  const capturingRef = useRef(false);

  const handleDone = useCallback(async () => {
    // SNAPSHOT THE HEAD THE PLAYER BUILT.
    //
    // This passed `null` unconditionally, under a comment saying the studio
    // "renders pre-rendered art rather than a live GL head". That stopped being
    // true when the preview went live — `FaceStudio`'s own docstring now opens
    // with "The preview is live" — and nothing updated this. So every slider
    // worked, the head responded, the player tapped Use this face, and the
    // portrait was thrown away. `identity.portraitUri` could never be set by
    // the shipping path at all.
    //
    // Capture failure is not an error case worth blocking on: `capture()`
    // resolves null when GL is unavailable or the snapshot is unusable, and
    // null simply means the character keeps the starter portrait, which always
    // renders. The creator still closes either way.
    if (capturingRef.current) return;
    capturingRef.current = true;
    let uri: string | null = photoPortraitRef.current;
    try {
      // The photo portrait wins, and the canvas is not even asked when there is
      // one — the snapshot costs a frame and a resize for a result that would
      // be discarded.
      if (!uri) uri = (await canvasRef.current?.capture()) ?? null;
    } catch {
      uri = null;
    } finally {
      capturingRef.current = false;
    }
    onDone?.(uri);
    onClose();
  }, [onDone, onClose]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} transparent={false}>
      {/* Mount the creator ONLY while visible — this is what makes the GL
          context's lifetime match the modal's. */}
      {visible ? (
        <View
          style={[
            styles.root,
            { backgroundColor: theme.background, paddingTop: insets.top, paddingBottom: insets.bottom },
          ]}
        >
          <View style={styles.header}>
            <TouchableOpacity
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close face creator"
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <X size={scale(22)} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>

          <View style={styles.body}>
            {route === 'entry' ? (
              <BecomeYourself
                hasPlus={upsell.active}
                photoSupported={isPhotoAvatarSupported()}
                onSelfie={() => setRoute('selfie')}
                onManual={() => setRoute('studio')}
                onUpsell={() => void upsell.present()}
              />
            ) : route === 'selfie' ? (
              <SelfieFlow
                base={genome}
                age={age}
                body={body}
                onKeep={(next, portraitUri) => {
                  photoPortraitRef.current = portraitUri;
                  // Write the scan through and land in the STUDIO, not straight
                  // out of the creator. The scan is a starting point; dropping
                  // the player back to the menu with a face they have not been
                  // shown how to change is how a good match still feels like
                  // something that happened TO them.
                  onChange(next);
                  setRoute('studio');
                }}
                onExit={() => setRoute('entry')}
              />
            ) : (
              <FaceStudio
                canvasRef={canvasRef}
                genome={genome}
                onChange={onChange}
                onDone={handleDone}
                age={age}
                sex={sex}
                step={2}
                totalSteps={4}
                title={title}
                doneLabel={doneLabel}
                body={body}
                fallback={fallback}
              />
            )}
          </View>
        </View>
      ) : null}

      {/* The app's own DeepLife+ paywall, opened from the selfie card. */}
      <SubscriptionModal visible={upsell.open} onClose={upsell.close} />
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  title: { fontSize: fontScale(18), fontWeight: '700' },
  body: { flex: 1 },
});
