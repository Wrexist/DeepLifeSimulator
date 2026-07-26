/**
 * The face creator in a full-screen modal.
 *
 * A thin shell over `FaceCreator` whose real job is LIFECYCLE: the creator is
 * unmounted entirely while closed (`visible === false` renders nothing inside
 * the Modal), so the GL context is created on open and destroyed on close. A
 * kept-alive canvas would hold a native GL context for the whole session, and a
 * few of those is a crash rather than a slowdown.
 */

import React, { useCallback } from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X } from 'lucide-react-native';
import FaceStudio from './FaceStudio';
import type { BodyProfile, FaceGenome } from '@/lib/identity';
import { getThemeColors, radii, spacing } from '@/lib/config/theme';
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
}: FaceCreatorModalProps): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const theme = getThemeColors(true);

  const handleDone = useCallback(() => {
    // No baked portrait yet: the studio renders pre-rendered art rather than a
    // live GL head, so there is no framebuffer to snapshot. The layered
    // portrait pipeline will supply the stored image instead, and this stays
    // the single place that decides what gets persisted.
    onDone?.(null);
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
            <FaceStudio
              genome={genome}
              onChange={onChange}
              onDone={handleDone}
              age={age}
              sex={sex}
              step={2}
              totalSteps={4}
              title={title}
              doneLabel={doneLabel}
            />
          </View>
        </View>
      ) : null}
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
