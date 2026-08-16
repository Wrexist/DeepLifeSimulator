/**
 * Settings → "Cloud backup".
 *
 * Renders nothing at all unless the `cloudSave` flag is on (both
 * EXPO_PUBLIC_ENABLE_CLOUD_SAVE and EXPO_PUBLIC_CLOUD_SAVE_URL) — a row that
 * cannot do anything is worse than no row, because the player will try it.
 *
 * Restore is behind a confirm dialog: it replaces the game currently in
 * memory. The one case that is NOT a choice is a cloud copy that sits behind
 * the live game — `fetchCloudRestoreCandidate` refuses that outright and this
 * shows the refusal (`CLOUD_RESTORE_OLDER_MESSAGE`) rather than offering an
 * "overwrite anyway" escape hatch, which would only ever destroy progress.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { CloudUpload, CloudDownload } from 'lucide-react-native';
import ConfirmDialog from '@/components/ConfirmDialog';
import { useGameActions } from '@/contexts/game/GameActionsContext';
import {
  formatLastBackupLabel,
  getLastCloudBackupAt,
  isCloudBackupEnabled,
} from '@/services/cloudBackup';
import { fontScale, responsiveBorderRadius, responsiveSpacing, scale, verticalScale } from '@/utils/scaling';

export default function CloudBackupRow() {
  const { backUpToCloud, restoreFromCloud } = useGameActions();
  const enabled = isCloudBackupEnabled();
  const [lastBackupAt, setLastBackupAt] = useState<number | null>(null);
  const [busy, setBusy] = useState<'backup' | 'restore' | null>(null);
  const [confirmRestore, setConfirmRestore] = useState(false);

  const refreshStatus = useCallback(async () => {
    const at = await getLastCloudBackupAt();
    setLastBackupAt(at);
  }, []);

  useEffect(() => {
    if (!enabled) return;
    void refreshStatus();
  }, [enabled, refreshStatus]);

  const handleBackUp = useCallback(async () => {
    if (busy) return;
    setBusy('backup');
    try {
      const result = await backUpToCloud();
      await refreshStatus();
      Alert.alert(result.success ? 'Cloud Backup' : 'Backup Failed', result.message);
    } finally {
      setBusy(null);
    }
  }, [backUpToCloud, busy, refreshStatus]);

  const handleRestore = useCallback(async () => {
    if (busy) return;
    setBusy('restore');
    try {
      const outcome = await restoreFromCloud();
      // 'older' is the weeksLived-regression refusal — a real answer, not an
      // error, so it gets its own title and the explanatory message.
      const title =
        outcome.status === 'applied'
          ? 'Backup Restored'
          : outcome.status === 'older'
            ? 'Cloud Save Is Older'
            : 'Nothing Restored';
      Alert.alert(title, outcome.message);
    } finally {
      setBusy(null);
    }
  }, [busy, restoreFromCloud]);

  if (!enabled) return null;

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Cloud backup</Text>
      <Text style={styles.status}>{formatLastBackupLabel(lastBackupAt)}</Text>
      <Text style={styles.hint}>
        A copy of this device&apos;s save is kept in the cloud. It is tied to this device, not to an account.
      </Text>

      <View style={styles.actions}>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Back up this game to the cloud now"
          disabled={busy !== null}
          onPress={() => void handleBackUp()}
          style={[styles.action, busy !== null && styles.actionDisabled]}
        >
          <CloudUpload size={scale(14)} color="#38BDF8" />
          <Text style={styles.actionText}>{busy === 'backup' ? 'Backing up…' : 'Back up now'}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Restore this game from the cloud backup"
          disabled={busy !== null}
          onPress={() => setConfirmRestore(true)}
          style={[styles.action, busy !== null && styles.actionDisabled]}
        >
          <CloudDownload size={scale(14)} color="#FBBF24" />
          <Text style={[styles.actionText, styles.actionTextWarning]}>
            {busy === 'restore' ? 'Restoring…' : 'Restore from cloud'}
          </Text>
        </TouchableOpacity>
      </View>

      <ConfirmDialog
        visible={confirmRestore}
        title="Restore From Cloud?"
        message="This replaces the game you are playing right now with the cloud backup. It cannot be undone."
        confirmText="Restore"
        cancelText="Cancel"
        destructive
        type="danger"
        onConfirm={() => {
          setConfirmRestore(false);
          void handleRestore();
        }}
        onCancel={() => setConfirmRestore(false)}
      />
    </View>
  );
}

// Full four-sided border, never a one-sided accent stripe (CLAUDE.md Hard Rule #7).
const styles = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(31, 41, 55, 0.85)',
    borderRadius: responsiveBorderRadius.lg,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    gap: verticalScale(4),
    marginBottom: responsiveSpacing.md,
    padding: responsiveSpacing.md,
  },
  title: {
    color: '#F9FAFB',
    fontSize: fontScale(15),
    fontWeight: '700',
  },
  status: {
    color: '#94A3B8',
    fontSize: fontScale(12),
    fontWeight: '600',
  },
  hint: {
    color: '#64748B',
    fontSize: fontScale(11),
  },
  actions: {
    flexDirection: 'row',
    gap: scale(16),
    marginTop: verticalScale(6),
  },
  action: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: scale(6),
    paddingVertical: verticalScale(4),
  },
  actionDisabled: {
    opacity: 0.6,
  },
  actionText: {
    color: '#38BDF8',
    fontSize: fontScale(12),
    fontWeight: '700',
  },
  actionTextWarning: {
    color: '#FBBF24',
  },
});
