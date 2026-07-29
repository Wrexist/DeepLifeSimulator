/**
 * The payoff, and the honest part.
 *
 * ## The headline is earned, not asserted
 *
 * "This looks like you" is only shown when the run actually measured a face —
 * when landmarks came back and the fit was confident. A colour-only match gets
 * "We matched your colouring", because a player who is told the AI captured
 * their face and then sees a generic head does not conclude the copy was
 * loose; they conclude the product is broken. `performed` and `confidence` come
 * from the service precisely so this screen can tell the difference.
 *
 * ## Compare, side by side
 *
 * A drag handle wipes between the original photo and the generated character.
 * This is the screen's real argument: likeness is a claim, and the player gets
 * to check it rather than take our word. It is also, deliberately, the place
 * where a poor match is most obvious — a feature that hides its own failures is
 * one nobody trusts the second time.
 */

import React, { useMemo, useRef, useState } from 'react';
import {
  Image,
  PanResponder,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Check, RefreshCw, Sparkles } from 'lucide-react-native';
import FaceCanvas from './FaceCanvas';
import { haptic } from '@/utils/haptics';
import { fontScale, scale } from '@/utils/scaling';
import type { BodyProfile, FaceGenome } from '@/lib/identity';
import type { AvatarResult } from '@/services/avatar/types';

const C = {
  bg: '#070A10',
  card: '#121827',
  cardBorder: 'rgba(255, 255, 255, 0.08)',
  frame: '#0B111C',
  text: '#FFFFFF',
  sub: 'rgba(255, 255, 255, 0.65)',
  muted: 'rgba(255, 255, 255, 0.38)',
  accent: '#4C8DFF',
  accentSoft: 'rgba(76, 141, 255, 0.14)',
};

export interface AvatarRevealProps {
  photoUri: string;
  /**
   * The portrait cut out of the photo, or null when one could not be made.
   *
   * Shown because it is what the player actually gets on their card — the 3D
   * head in the wipe is the model, not the picture. A reveal that shows only
   * the model and then puts something else on the card is the kind of surprise
   * that reads as a bug.
   */
  portraitUri?: string | null;
  result: AvatarResult;
  age: number;
  body?: BodyProfile;
  onKeep: (genome: FaceGenome) => void;
  onRegenerate: () => void;
  onStartOver: () => void;
  /** True while a regenerate is in flight, so the button can show it. */
  busy?: boolean;
}

export default function AvatarReveal({
  photoUri,
  portraitUri = null,
  result,
  age,
  body,
  onKeep,
  onRegenerate,
  onStartOver,
  busy = false,
}: AvatarRevealProps): React.JSX.Element {
  const [frame, setFrame] = useState({ width: 0, pageX: 0 });
  // Fraction of the frame showing the PHOTO, from the left edge.
  const [split, setSplit] = useState(0.5);
  const frameRef = useRef<View>(null);

  /**
   * The claim this run can support.
   *
   * `geometry` in `performed` means landmarks were found and the face was
   * actually measured; without it the run only read colours off the image.
   */
  const measuredFace = result.performed.includes('geometry');
  const strong = measuredFace && result.confidence >= 0.55;

  // A cut-out is not a claim about likeness — it IS the player. So when there is
  // one the headline can say so outright, and the caveats below it are only
  // about the 3D character, which is a separate promise.
  const headline = portraitUri
    ? 'That’s you'
    : strong
      ? 'This looks like you'
      : measuredFace
        ? 'Here’s your character'
        : 'We matched your colouring';

  const blurb = portraitUri
    ? 'Your portrait is your own photo with the background removed — that’s what shows on your character card. The 3D character below is matched to your colouring and is yours to shape.'
    : strong
      ? 'We measured your face and built your character to match. Every detail is yours to change.'
      : measuredFace
        ? 'The photo was a little hard to read, so some features are closer to average than others. Adjust anything below, or try another photo.'
        : 'This device matched your skin and hair from the photo, but couldn’t measure your face shape. Everything below is yours to shape by hand.';

  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: () => haptic.light(),
        onPanResponderMove: (e) => {
          if (frame.width <= 0) return;
          // pageX minus the frame's own page offset — NOT `locationX`, and not
          // the gesture's accumulated dx.
          //
          // `locationX` is relative to the touch TARGET, which inside this frame
          // is the GL canvas or the photo, not the frame itself: the handle
          // jumps the moment the finger crosses from one child to another.
          // Integrating dx drifts away from the finger over a long drag, which
          // is the bug the morph sliders had before they were anchored.
          const x = e.nativeEvent.pageX - frame.pageX;
          setSplit(Math.max(0, Math.min(1, x / frame.width)));
        },
      }),
    [frame],
  );

  return (
    <View style={styles.root}>
      <View style={styles.badge}>
        <Sparkles size={scale(13)} color={C.accent} />
        <Text style={styles.badgeText}>{strong ? 'MATCHED' : 'READY'}</Text>
      </View>

      <Text style={styles.title}>{headline}</Text>
      <Text style={styles.blurb}>{blurb}</Text>

      <View
        ref={frameRef}
        style={styles.frame}
        // measureInWindow, because the drag needs the frame's PAGE position and
        // onLayout only reports its position within its parent.
        onLayout={() =>
          frameRef.current?.measureInWindow((pageX, _y, width) => setFrame({ width, pageX }))
        }
        {...pan.panHandlers}
      >
        <FaceCanvas genome={result.genome} age={age} body={body} style={StyleSheet.absoluteFillObject} />

        {/* The photo, clipped to the left of the handle. */}
        <View style={[StyleSheet.absoluteFill, { width: `${split * 100}%`, overflow: 'hidden' }]}>
          {frame.width > 0 ? (
            <Image
              source={{ uri: photoUri }}
              style={{ width: frame.width, height: '100%' }}
              resizeMode="cover"
              accessibilityLabel="Your photo"
            />
          ) : null}
        </View>

        <View style={[styles.handle, { left: `${split * 100}%` }]} pointerEvents="none">
          <View style={styles.handleGrip} />
        </View>

        <Text style={[styles.frameLabel, styles.frameLabelLeft]}>PHOTO</Text>
        <Text style={[styles.frameLabel, styles.frameLabelRight]}>CHARACTER</Text>
      </View>

      {portraitUri ? (
        <View style={styles.portraitRow}>
          <Image
            source={{ uri: portraitUri }}
            style={styles.portrait}
            resizeMode="cover"
            accessibilityLabel="Your portrait, cut out of your photo"
          />
          <View style={styles.portraitCopy}>
            <Text style={styles.portraitTitle}>Your portrait</Text>
            <Text style={styles.portraitBody}>This is what appears on your character card.</Text>
          </View>
        </View>
      ) : null}

      <Text style={styles.hint}>Drag to compare</Text>

      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.primary}
          onPress={() => {
            haptic.success();
            onKeep(result.genome);
          }}
          accessibilityRole="button"
          accessibilityLabel="Use this face"
        >
          <Check size={scale(18)} color="#04121F" />
          <Text style={styles.primaryText}>Use this face</Text>
        </TouchableOpacity>

        <View style={styles.secondaryRow}>
          <TouchableOpacity
            style={[styles.secondary, busy && styles.busy]}
            onPress={onRegenerate}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel="Improve match"
            accessibilityHint="Re-reads your face and keeps your hair and colours"
            accessibilityState={{ disabled: busy }}
          >
            <RefreshCw size={scale(15)} color={C.text} />
            <Text style={styles.secondaryText}>{busy ? 'Working…' : 'Improve match'}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondary}
            onPress={onStartOver}
            accessibilityRole="button"
            accessibilityLabel="Use a different photo"
          >
            <Text style={styles.secondaryText}>Different photo</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg, padding: scale(20) },
  portraitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(12),
    marginTop: scale(12),
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.cardBorder,
    borderRadius: scale(14),
    padding: scale(10),
  },
  portrait: {
    width: scale(56),
    height: scale(56),
    borderRadius: scale(28),
    backgroundColor: C.frame,
  },
  portraitCopy: { flex: 1 },
  portraitTitle: { color: C.text, fontSize: fontScale(14), fontWeight: '700' },
  portraitBody: { color: C.sub, fontSize: fontScale(12), marginTop: scale(2) },
  badge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(5),
    backgroundColor: C.accentSoft,
    borderRadius: 99,
    paddingHorizontal: scale(10),
    paddingVertical: scale(5),
  },
  badgeText: { color: C.accent, fontSize: fontScale(10), fontWeight: '800', letterSpacing: 1.1 },
  title: { color: C.text, fontSize: fontScale(28), fontWeight: '800', marginTop: scale(12), letterSpacing: -0.6 },
  blurb: { color: C.sub, fontSize: fontScale(14), marginTop: scale(7), lineHeight: fontScale(20) },

  frame: {
    marginTop: scale(16),
    height: scale(340),
    borderRadius: scale(18),
    backgroundColor: C.frame,
    borderWidth: 1,
    borderColor: C.cardBorder,
    overflow: 'hidden',
  },
  handle: { position: 'absolute', top: 0, bottom: 0, width: scale(2), backgroundColor: '#FFFFFF', opacity: 0.9 },
  handleGrip: {
    position: 'absolute',
    top: '50%',
    left: scale(-15),
    width: scale(32),
    height: scale(32),
    borderRadius: scale(16),
    backgroundColor: '#FFFFFF',
    marginTop: scale(-16),
  },
  frameLabel: {
    position: 'absolute',
    top: scale(10),
    color: 'rgba(255,255,255,0.55)',
    fontSize: fontScale(10),
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  frameLabelLeft: { left: scale(12) },
  frameLabelRight: { right: scale(12) },
  hint: { color: C.muted, fontSize: fontScale(11.5), textAlign: 'center', marginTop: scale(8) },

  actions: { marginTop: 'auto', gap: scale(10) },
  primary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: scale(9),
    backgroundColor: C.accent,
    borderRadius: scale(15),
    paddingVertical: scale(15),
  },
  primaryText: { color: '#04121F', fontSize: fontScale(16), fontWeight: '800' },
  secondaryRow: { flexDirection: 'row', gap: scale(10) },
  secondary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: scale(7),
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.cardBorder,
    borderRadius: scale(14),
    paddingVertical: scale(13),
  },
  secondaryText: { color: C.text, fontSize: fontScale(14), fontWeight: '700' },
  busy: { opacity: 0.6 },
});
