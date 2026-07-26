/**
 * Choosing the photo.
 *
 * Two buttons and a checklist. The checklist is the important part: every
 * requirement on it is one the fitter genuinely depends on, and showing them
 * BEFORE the picker is what turns "the AI is bad" into "ah, I was wearing
 * sunglasses". A failure the player can prevent is a much better failure than
 * one they can only retry.
 *
 * Each line says what it is for, because "face the camera" reads as fussy
 * house-keeping until you know the measurements are taken in the image plane
 * and a turned head shortens one side of the face.
 *
 * The system pickers do the camera work. A bespoke camera UI would mean a
 * second native dependency, our own permission handling and our own accessible
 * shutter — for a worse version of a screen every player already knows.
 */

import React, { useCallback, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Check, Image as ImageIcon, Camera as CameraIcon } from 'lucide-react-native';
import { haptic } from '@/utils/haptics';
import { fontScale, scale } from '@/utils/scaling';
import type { PhotoInput } from '@/services/avatar/types';

const C = {
  bg: '#070A10',
  card: '#121827',
  cardBorder: 'rgba(255, 255, 255, 0.08)',
  text: '#FFFFFF',
  sub: 'rgba(255, 255, 255, 0.65)',
  muted: 'rgba(255, 255, 255, 0.38)',
  accent: '#4C8DFF',
  accentSoft: 'rgba(76, 141, 255, 0.14)',
  danger: '#F87171',
};

const REQUIREMENTS: readonly { text: string; why: string }[] = [
  { text: 'Face the camera', why: 'a turned head shortens one side of the face' },
  { text: 'Even lighting', why: 'hard shadows hide the jawline' },
  { text: 'No sunglasses', why: 'the eye corners set eye size and spacing' },
  { text: 'Hair visible', why: 'we read your hair colour from the crown' },
  { text: 'Relaxed expression', why: 'a smile widens the mouth measurement' },
];

export interface SelfieCaptureProps {
  onPicked: (photo: PhotoInput) => void;
  onCancel: () => void;
}

export default function SelfieCapture({ onPicked, onCancel }: SelfieCaptureProps): React.JSX.Element {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pick = useCallback(
    async (source: 'camera' | 'library') => {
      haptic.light();
      setError(null);
      setBusy(true);
      try {
        const permission = source === 'camera'
          ? await ImagePicker.requestCameraPermissionsAsync()
          : await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) {
          setError(
            source === 'camera'
              ? 'Camera access is off. You can turn it on in Settings, or choose a photo from your library instead.'
              : 'Photo access is off. You can turn it on in Settings, or take a photo instead.',
          );
          return;
        }

        const options: ImagePicker.ImagePickerOptions = {
          mediaTypes: ['images'],
          allowsEditing: true,
          // Square, because the analysis assumes a roughly centred head and a
          // panorama with a face in one corner reads as no face at all.
          aspect: [1, 1],
          // 0.85 rather than 1: landmark accuracy is unaffected by mild JPEG
          // compression, and a 12 MP original is a slow upload on the connection
          // the player is already waiting on.
          quality: 0.85,
          exif: false,
        };
        const result = source === 'camera'
          ? await ImagePicker.launchCameraAsync({ ...options, cameraType: ImagePicker.CameraType.front })
          : await ImagePicker.launchImageLibraryAsync(options);

        if (result.canceled || !result.assets?.[0]) return;
        const asset = result.assets[0];
        onPicked({
          uri: asset.uri,
          width: asset.width ?? 0,
          height: asset.height ?? 0,
          mimeType: asset.mimeType,
        });
      } catch {
        setError('Something went wrong opening your photos. Try again?');
      } finally {
        setBusy(false);
      }
    },
    [onPicked],
  );

  return (
    <View style={styles.root}>
      <View>
        <Text style={styles.title}>Use a photo of yourself</Text>
        <Text style={styles.subtitle}>
          One clear, front-facing photo is all we need.
        </Text>
      </View>

      <View style={styles.checklist}>
        {REQUIREMENTS.map((r) => (
          <View key={r.text} style={styles.checkRow}>
            <View style={styles.checkIcon}>
              <Check size={scale(13)} color={C.accent} />
            </View>
            <Text style={styles.checkText}>
              {r.text}
              <Text style={styles.checkWhy}>{`  — ${r.why}`}</Text>
            </Text>
          </View>
        ))}
      </View>

      {error ? (
        <Text style={styles.error} accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}

      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.primary, busy && styles.busy]}
          onPress={() => void pick('camera')}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel="Take photo"
          accessibilityState={{ disabled: busy }}
        >
          {busy ? (
            <ActivityIndicator color="#04121F" />
          ) : (
            <>
              <CameraIcon size={scale(18)} color="#04121F" />
              <Text style={styles.primaryText}>Take photo</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.secondary, busy && styles.busy]}
          onPress={() => void pick('library')}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel="Choose from library"
          accessibilityState={{ disabled: busy }}
        >
          <ImageIcon size={scale(18)} color={C.text} />
          <Text style={styles.secondaryText}>Choose from library</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={onCancel}
          accessibilityRole="button"
          accessibilityLabel="Back"
          style={styles.cancel}
        >
          <Text style={styles.cancelText}>Back</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg, padding: scale(20), justifyContent: 'space-between' },
  title: { color: C.text, fontSize: fontScale(26), fontWeight: '800', letterSpacing: -0.5 },
  subtitle: { color: C.sub, fontSize: fontScale(14), marginTop: scale(7) },

  checklist: {
    backgroundColor: C.card,
    borderRadius: scale(18),
    borderWidth: 1,
    borderColor: C.cardBorder,
    padding: scale(16),
    gap: scale(13),
  },
  checkRow: { flexDirection: 'row', alignItems: 'flex-start', gap: scale(11) },
  checkIcon: {
    width: scale(22),
    height: scale(22),
    borderRadius: scale(7),
    backgroundColor: C.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: scale(1),
  },
  checkText: { flex: 1, color: C.text, fontSize: fontScale(14), fontWeight: '600', lineHeight: fontScale(19) },
  checkWhy: { color: C.muted, fontWeight: '400', fontSize: fontScale(12.5) },

  error: { color: C.danger, fontSize: fontScale(13), lineHeight: fontScale(18) },

  actions: { gap: scale(10) },
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
  secondary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: scale(9),
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.cardBorder,
    borderRadius: scale(15),
    paddingVertical: scale(15),
  },
  secondaryText: { color: C.text, fontSize: fontScale(15), fontWeight: '700' },
  busy: { opacity: 0.6 },
  cancel: { alignItems: 'center', paddingVertical: scale(10) },
  cancelText: { color: C.muted, fontSize: fontScale(14), fontWeight: '600' },
});
