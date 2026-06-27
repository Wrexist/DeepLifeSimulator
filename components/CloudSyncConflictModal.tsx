/**
 * CloudSyncConflictModal — surfaces a cloud-vs-device save conflict so the
 * player chooses how to resolve it (replaces the old crude native Alert).
 *
 * Pure UI: it reads the pending conflict from the conflict bridge and reports
 * the choice back. All apply logic (migrate → repair → validate → setGameState)
 * lives in GameActionsContext, which awaits the bridge. Dismissing keeps the
 * local save (the safe, non-destructive default).
 *
 * Mount once, high in the tree (app/_layout.tsx). Renders null when idle.
 */
import React, { useSyncExternalStore } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Cloud, Smartphone, GitMerge } from 'lucide-react-native';
import {
  getPendingConflict,
  subscribePendingConflict,
  resolvePendingConflict,
} from '@/lib/cloudSync/conflictBridge';

function formatWhen(ts: number): string {
  if (!ts || !Number.isFinite(ts) || ts <= 0) return 'unknown time';
  try {
    const d = new Date(ts);
    return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  } catch {
    return 'unknown time';
  }
}

export default function CloudSyncConflictModal(): React.ReactElement | null {
  const conflict = useSyncExternalStore(
    subscribePendingConflict,
    getPendingConflict,
    getPendingConflict
  );

  if (!conflict) return null;

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      onRequestClose={() => resolvePendingConflict(null)}
    >
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>Cloud Sync Conflict</Text>
          <Text style={styles.subtitle}>
            This device and the cloud both have changes. Choose which save to keep —
            this won't delete the other until you sync again.
          </Text>

          <View style={styles.row}>
            <View style={styles.rowIcon}>
              <Smartphone size={20} color="#FBBF24" />
            </View>
            <View style={styles.rowText}>
              <Text style={styles.rowLabel}>This device</Text>
              <Text style={styles.rowMeta}>
                {`v${conflict.localVersion} · ${formatWhen(conflict.localTimestamp)}`}
              </Text>
            </View>
          </View>

          <View style={styles.row}>
            <View style={styles.rowIcon}>
              <Cloud size={20} color="#60A5FA" />
            </View>
            <View style={styles.rowText}>
              <Text style={styles.rowLabel}>Cloud</Text>
              <Text style={styles.rowMeta}>
                {`v${conflict.remoteVersion} · ${formatWhen(conflict.remoteTimestamp)}`}
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.btn, styles.btnPrimary]}
            accessibilityRole="button"
            accessibilityLabel="Keep this device's save"
            onPress={() => resolvePendingConflict('local')}
          >
            <Smartphone size={16} color="#1A1205" />
            <Text style={styles.btnPrimaryText}>Keep This Device</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.btn, styles.btnSecondary]}
            accessibilityRole="button"
            accessibilityLabel="Merge both saves"
            onPress={() => resolvePendingConflict('merge')}
          >
            <GitMerge size={16} color="#FBBF24" />
            <Text style={styles.btnSecondaryText}>Merge Both</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.btn, styles.btnGhost]}
            accessibilityRole="button"
            accessibilityLabel="Use the cloud save"
            onPress={() => resolvePendingConflict('remote')}
          >
            <Cloud size={16} color="#9CA3AF" />
            <Text style={styles.btnGhostText}>Use Cloud Version</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#16130F',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    padding: 22,
    gap: 12,
  },
  title: { fontSize: 19, fontWeight: '800', color: '#FFFFFF' },
  subtitle: { fontSize: 13, fontWeight: '500', color: '#9C948A', lineHeight: 18, marginBottom: 4 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
    borderRadius: 12,
    padding: 12,
  },
  rowIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: { flex: 1 },
  rowLabel: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },
  rowMeta: { fontSize: 12, fontWeight: '500', color: '#9C948A', marginTop: 2 },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 50,
    borderRadius: 14,
    marginTop: 2,
  },
  btnPrimary: { backgroundColor: '#FBBF24' },
  btnPrimaryText: { fontSize: 15, fontWeight: '800', color: '#1A1205' },
  btnSecondary: {
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.4)',
  },
  btnSecondaryText: { fontSize: 15, fontWeight: '700', color: '#FBBF24' },
  btnGhost: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  btnGhostText: { fontSize: 15, fontWeight: '700', color: '#D1D5DB' },
});
