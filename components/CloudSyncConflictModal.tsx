/**
 * A-6: Cloud Sync Conflict Resolution Modal
 *
 * Shown when both the local device and cloud have diverged saves
 * (e.g., both played offline). Lets the user choose which version to keep.
 */
import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { AlertTriangle, Cloud, Smartphone } from 'lucide-react-native';
import type { SyncConflict, ConflictResolution } from '@/services/CloudSyncService';
import { scale, fontScale } from '@/utils/scaling';

interface CloudSyncConflictModalProps {
  visible: boolean;
  conflict: (SyncConflict & { remoteWeeksLived?: number; localWeeksLived?: number }) | null;
  darkMode?: boolean;
  onResolve: (resolution: ConflictResolution) => void;
}

function formatTimestamp(ts: number): string {
  if (!ts) return 'Unknown';
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return 'Unknown';
  }
}

export default function CloudSyncConflictModal({
  visible,
  conflict,
  darkMode = true,
  onResolve,
}: CloudSyncConflictModalProps) {
  if (!conflict) return null;

  const bg = darkMode ? '#1F2937' : '#FFFFFF';
  const textColor = darkMode ? '#F9FAFB' : '#111827';
  const mutedColor = darkMode ? '#9CA3AF' : '#6B7280';
  const cardBg = darkMode ? '#374151' : '#F3F4F6';

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={[styles.container, { backgroundColor: bg }]}>
          <View style={styles.header}>
            <AlertTriangle size={scale(28)} color="#F59E0B" />
            <Text style={[styles.title, { color: textColor }]}>Cloud Sync Conflict</Text>
          </View>

          <Text style={[styles.description, { color: mutedColor }]}>
            Both this device and the cloud have changes. Which version would you like to keep?
          </Text>

          {/* Local option */}
          <TouchableOpacity
            style={[styles.optionCard, { backgroundColor: cardBg, borderColor: '#3B82F6' }]}
            onPress={() => onResolve('local')}
          >
            <View style={styles.optionHeader}>
              <Smartphone size={scale(20)} color="#3B82F6" />
              <Text style={[styles.optionTitle, { color: textColor }]}>Keep This Device</Text>
            </View>
            <Text style={[styles.optionDetail, { color: mutedColor }]}>
              Last saved: {formatTimestamp(conflict.localTimestamp)}
            </Text>
          </TouchableOpacity>

          {/* Remote option */}
          <TouchableOpacity
            style={[styles.optionCard, { backgroundColor: cardBg, borderColor: '#8B5CF6' }]}
            onPress={() => onResolve('remote')}
          >
            <View style={styles.optionHeader}>
              <Cloud size={scale(20)} color="#8B5CF6" />
              <Text style={[styles.optionTitle, { color: textColor }]}>Keep Cloud Version</Text>
            </View>
            <Text style={[styles.optionDetail, { color: mutedColor }]}>
              Last saved: {formatTimestamp(conflict.remoteTimestamp)}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: scale(20),
  },
  container: {
    width: '100%',
    maxWidth: scale(360),
    borderRadius: scale(16),
    padding: scale(20),
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(10),
    marginBottom: scale(12),
  },
  title: {
    fontSize: fontScale(20),
    fontWeight: '700',
  },
  description: {
    fontSize: fontScale(14),
    lineHeight: fontScale(20),
    marginBottom: scale(16),
  },
  optionCard: {
    borderRadius: scale(12),
    padding: scale(16),
    marginBottom: scale(10),
    borderWidth: 2,
  },
  optionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(8),
    marginBottom: scale(4),
  },
  optionTitle: {
    fontSize: fontScale(16),
    fontWeight: '600',
  },
  optionDetail: {
    fontSize: fontScale(12),
    marginLeft: scale(28),
  },
});
