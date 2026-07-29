/**
 * The selfie route, start to finish: pick → process → reveal.
 *
 * Owns every piece of state the three screens share and, more importantly, the
 * IN-FLIGHT REQUEST. One `AbortController` lives here for the life of a run, so
 * backing out of the processing screen actually stops the upload rather than
 * leaving it to resolve onto an unmounted tree — which in this flow means the
 * reveal appearing over whatever the player navigated to instead.
 *
 * Progress is accumulated, never reset: `done` only grows, and `progress` only
 * moves forward. Providers report stages as they reach them, and a provider
 * that revisits a stage (a retry inside a poll loop, say) must not make the
 * checklist un-tick — a step that completes twice is normal, a step that
 * uncompletes reads as a failure.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { AlertCircle } from 'lucide-react-native';
import SelfieCapture from './SelfieCapture';
import AvatarProcessing from './AvatarProcessing';
import AvatarReveal from './AvatarReveal';
import { availableProviders, generateFromPhoto, plannedStages } from '@/services/avatar/AvatarService';
import { buildPhotoPortrait } from '@/services/avatar/photoPortrait';
import { AvatarError, type AvatarResult, type AvatarStage, type PhotoInput } from '@/services/avatar/types';
import { track } from '@/lib/analytics';
import { haptic } from '@/utils/haptics';
import { fontScale, scale } from '@/utils/scaling';
import type { BodyProfile, FaceGenome } from '@/lib/identity';

const C = {
  bg: '#070A10',
  card: '#121827',
  cardBorder: 'rgba(255, 255, 255, 0.08)',
  text: '#FFFFFF',
  sub: 'rgba(255, 255, 255, 0.65)',
  muted: 'rgba(255, 255, 255, 0.38)',
  accent: '#4C8DFF',
  danger: '#F87171',
};

/**
 * What to tell the player, per failure.
 *
 * Written so each one names a thing they can DO. "Something went wrong" is the
 * message that gets a feature uninstalled; "we couldn't find a face — try a
 * photo where you're looking at the camera" gets a second attempt.
 */
const MESSAGE: Record<AvatarError['code'], string> = {
  no_face: 'We couldn’t find a face in that photo. Try one where you’re looking straight at the camera.',
  multiple_faces: 'There’s more than one face in that photo. A solo shot works best.',
  too_dark: 'That photo is too dark to read. Somewhere with even light works much better.',
  obscured: 'Something’s covering the face — sunglasses, a hand or a mask. Try one without.',
  network: 'We couldn’t reach the scanning service. Check your connection and try again.',
  unauthorized: 'Face scanning is temporarily unavailable. You can still design your character by hand.',
  rate_limited: 'Face scanning is busy right now. Give it a minute and try again.',
  cancelled: 'Cancelled.',
  unsupported: 'This device can’t scan photos. You can still design every detail by hand.',
  unknown: 'That didn’t work. Try another photo?',
};

type Phase =
  | { name: 'capture' }
  | { name: 'processing'; photo: PhotoInput }
  | { name: 'reveal'; photo: PhotoInput; result: AvatarResult; portraitUri: string | null }
  | { name: 'error'; code: AvatarError['code'] };

export interface SelfieFlowProps {
  /** The face to refine — the player's current genome, not a blank one. */
  base: FaceGenome;
  age: number;
  body?: BodyProfile;
  /**
   * The face, and the portrait cut out of the photo — null when the cut-out
   * could not be made, which means "keep whatever portrait they already have".
   */
  onKeep: (genome: FaceGenome, portraitUri: string | null) => void;
  onExit: () => void;
}

export default function SelfieFlow({
  base,
  age,
  body,
  onKeep,
  onExit,
}: SelfieFlowProps): React.JSX.Element {
  const [phase, setPhase] = useState<Phase>({ name: 'capture' });
  const [progress, setProgress] = useState(0);
  const [done, setDone] = useState<AvatarStage[]>([]);
  const [busy, setBusy] = useState(false);
  const abort = useRef<AbortController | null>(null);
  const stages = useRef<readonly AvatarStage[]>(plannedStages());
  const providerLabel = availableProviders()[0]?.label;

  // Cancel on unmount. Without this the request outlives the screen.
  useEffect(() => () => abort.current?.abort(), []);

  const run = useCallback(
    async (photo: PhotoInput, faceOnly: boolean) => {
      abort.current?.abort();
      const controller = new AbortController();
      abort.current = controller;

      setProgress(0);
      setDone([]);
      setBusy(true);
      track('avatar_photo_started', { faceOnly, provider: providerLabel ?? 'none' });

      try {
        const result = await generateFromPhoto(photo, {
          base,
          faceOnly,
          signal: controller.signal,
          onProgress: ({ stage, progress: p }) => {
            // Monotonic in both. See the note at the top.
            setProgress((prev) => Math.max(prev, p));
            setDone((prev) => (prev.includes(stage) ? prev : [...prev, stage]));
          },
        });
        if (controller.signal.aborted) return;
        // Everything the run actually did, so a stage a provider finished
        // without announcing still ticks before the screen changes.
        setDone(result.performed);

        // THE PORTRAIT ITSELF, cut out of the photo. Deliberately after the
        // analysis rather than inside a provider: whichever provider ran, the
        // portrait is the player's own pixels, and a cloud vendor has no part
        // in it. It is also the one step that can fail without spoiling the
        // run — null here just means the character keeps the portrait they
        // have, so it is never allowed to throw the flow into its error state.
        const portraitUri = await buildPhotoPortrait(photo, { signal: controller.signal });
        if (controller.signal.aborted) return;
        track('avatar_photo_portrait', { made: portraitUri !== null });

        setProgress(1);
        haptic.success();
        setPhase({ name: 'reveal', photo, result, portraitUri });
      } catch (error) {
        if (controller.signal.aborted) return;
        const code = error instanceof AvatarError ? error.code : 'unknown';
        if (code === 'cancelled') return;
        track('avatar_photo_failed', { code });
        setPhase({ name: 'error', code });
      } finally {
        setBusy(false);
      }
    },
    [base, providerLabel],
  );

  const cancel = useCallback(() => {
    abort.current?.abort();
    abort.current = null;
    setBusy(false);
    setPhase({ name: 'capture' });
  }, []);

  if (phase.name === 'capture') {
    return (
      <SelfieCapture
        onPicked={(photo) => {
          setPhase({ name: 'processing', photo });
          void run(photo, false);
        }}
        onCancel={onExit}
      />
    );
  }

  if (phase.name === 'processing') {
    return (
      <AvatarProcessing
        stages={stages.current}
        done={done}
        progress={progress}
        providerLabel={providerLabel}
        onCancel={cancel}
      />
    );
  }

  if (phase.name === 'reveal') {
    const { photo, result, portraitUri } = phase;
    return (
      <AvatarReveal
        photoUri={photo.uri}
        portraitUri={portraitUri}
        result={result}
        age={age}
        body={body}
        busy={busy}
        onKeep={(genome) => {
          track('avatar_photo_kept', {
            provider: result.providerId,
            confidence: Math.round(result.confidence * 100),
            portrait: portraitUri !== null,
          });
          onKeep(genome, portraitUri);
        }}
        onRegenerate={() => {
          // faceOnly: the player may have kept the hair and colours from the
          // first pass, and a regenerate that resets them is one nobody presses
          // twice. Only the face shape is re-read.
          setPhase({ name: 'processing', photo });
          void run(photo, true);
        }}
        onStartOver={() => {
          track('avatar_photo_discarded', { provider: result.providerId });
          setPhase({ name: 'capture' });
        }}
      />
    );
  }

  return (
    <View style={styles.errorRoot}>
      <View style={styles.errorIcon}>
        <AlertCircle size={scale(26)} color={C.danger} />
      </View>
      <Text style={styles.errorTitle}>That photo didn’t work</Text>
      <Text style={styles.errorBody}>{MESSAGE[phase.code]}</Text>

      <TouchableOpacity
        style={styles.primary}
        onPress={() => setPhase({ name: 'capture' })}
        accessibilityRole="button"
        accessibilityLabel="Try another photo"
      >
        <Text style={styles.primaryText}>Try another photo</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.secondary}
        onPress={onExit}
        accessibilityRole="button"
        accessibilityLabel="Design by hand instead"
      >
        <Text style={styles.secondaryText}>Design by hand instead</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  errorRoot: { flex: 1, backgroundColor: C.bg, padding: scale(24), alignItems: 'center', justifyContent: 'center' },
  errorIcon: {
    width: scale(58),
    height: scale(58),
    borderRadius: scale(18),
    backgroundColor: 'rgba(248, 113, 113, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorTitle: {
    color: C.text,
    fontSize: fontScale(22),
    fontWeight: '800',
    marginTop: scale(16),
    textAlign: 'center',
  },
  errorBody: {
    color: C.sub,
    fontSize: fontScale(14),
    marginTop: scale(9),
    textAlign: 'center',
    lineHeight: fontScale(20),
  },
  primary: {
    alignSelf: 'stretch',
    alignItems: 'center',
    backgroundColor: C.accent,
    borderRadius: scale(15),
    paddingVertical: scale(15),
    marginTop: scale(26),
  },
  primaryText: { color: '#04121F', fontSize: fontScale(16), fontWeight: '800' },
  secondary: {
    alignSelf: 'stretch',
    alignItems: 'center',
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.cardBorder,
    borderRadius: scale(15),
    paddingVertical: scale(14),
    marginTop: scale(10),
  },
  secondaryText: { color: C.text, fontSize: fontScale(15), fontWeight: '700' },
});
