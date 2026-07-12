/**
 * AchievementsModal — the full AchievementsProgress list in a scrollable
 * fullscreen sheet, opened from the Home summary card's "View all". Keeps every
 * bit of the achievements feature intact, just off the Home tab by default.
 */
import React from 'react';
import { Modal, View, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X } from 'lucide-react-native';
import AchievementsProgress from '@/components/AchievementsProgress';
import { scale } from '@/utils/scaling';

interface AchievementsModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function AchievementsModal({ visible, onClose }: AchievementsModalProps) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.topBar}>
          <TouchableOpacity
            onPress={onClose}
            style={styles.close}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityRole="button"
            accessibilityLabel="Close achievements"
          >
            <X size={scale(22)} color="#F8FAFC" />
          </TouchableOpacity>
        </View>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: insets.bottom + scale(40) }}
        >
          <AchievementsProgress />
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F172A' },
  topBar: { flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: scale(12), paddingBottom: scale(2) },
  close: { padding: scale(8) },
});
