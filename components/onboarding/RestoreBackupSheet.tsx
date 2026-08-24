/**
 * RestoreBackupSheet - the recovery surface the app never had.
 *
 * The backup machinery has always run: every save writes one, the double
 * buffer keeps two generations, and `restoreFromBackup` has existed for
 * months. None of it was reachable. `restoreFromBackup`, `createManualBackup`
 * and `listAllBackups` had zero call sites, and the one slot state literally
 * labelled "Recovery Needed" offered exactly one action: Delete. A player whose
 * save broke was shown a button that destroyed the last copy of it.
 * (2026-07-29 audit BRC-1.)
 *
 * This is deliberately a *restore point picker*, not a file list. Each entry
 * leads with who the character was and how far they got, because that is the
 * question the player is actually answering - "which one of these is my life?"
 * - and the storage details are noise at that moment.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Clock, History, RotateCcw, ShieldCheck, X } from 'lucide-react-native';
import Gradient from '@/components/ui/Gradient';
import { listBackups, restoreFromBackup, type BackupMetadata } from '@/utils/saveBackup';
import { formatMoney } from '@/utils/moneyFormatting';
import { logger } from '@/utils/logger';
import { Z_INDEX } from '@/utils/zIndexConstants';
import { fontScale, scale, verticalScale } from '@/utils/scaling';

const LinearGradient = Gradient;
const log = logger.scope('RestoreBackupSheet');

interface Props {
  visible: boolean;
  slot: number | null;
  onClose: () => void;
  /** Called after a restore lands, so the caller can reload its slot list. */
  onRestored: (slot: number) => void;
}

/**
 * Why this restore point exists, in the player's terms. The raw reasons are
 * storage vocabulary; a player choosing between five entries needs to know
 * which moment each one caught.
 */
const REASON_LABEL: Record<string, string> = {
  before_overwrite: 'Just before this slot was replaced',
  before_prestige: 'Just before prestige',
  before_restore: 'Just before an earlier restore',
  delete_save: 'Just before this slot was deleted',
  manual: 'Saved by you',
  corruption_recovery: 'Kept after a load problem',
  before_update: 'Kept before a game update',
  before_week: 'Start of a week',
  emergency_save: 'Emergency save',
  background_save: 'Saved when you left the app',
  app_resume: 'Saved when you returned',
  auto_save: 'Automatic save',
};

/** Restore points worth calling out - these are the deliberate ones. */
const HIGHLIGHTED_REASONS = new Set([
  'before_overwrite',
  'before_prestige',
  'before_restore',
  'delete_save',
  'manual',
]);

/** "3 hours ago" reads better than a timestamp when you are picking a moment. */
export function relativeTime(timestamp: number, now: number = Date.now()): string {
  const seconds = Math.max(0, Math.floor((now - timestamp) / 1000));
  if (seconds < 60) return 'moments ago';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`;
  const weeks = Math.floor(days / 7);
  return `${weeks} week${weeks === 1 ? '' : 's'} ago`;
}

/** One restore point's headline: who they were and how far they got. */
export function describeRestorePoint(meta: BackupMetadata): string {
  const info = meta.gameInfo;
  const name = info?.characterName?.trim() || 'Unnamed Character';
  const bits: string[] = [];
  if (typeof info?.age === 'number' && Number.isFinite(info.age)) bits.push(`Age ${Math.floor(info.age)}`);
  if (typeof info?.weeksLived === 'number' && Number.isFinite(info.weeksLived)) {
    bits.push(`${Math.floor(info.weeksLived)} weeks`);
  }
  if (typeof info?.money === 'number' && Number.isFinite(info.money)) bits.push(formatMoney(info.money));
  return bits.length > 0 ? `${name} · ${bits.join(' · ')}` : name;
}

function RestoreBackupSheet({ visible, slot, onClose, onRestored }: Props) {
  const [backups, setBackups] = useState<BackupMetadata[] | null>(null);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible || slot == null) {
      setBackups(null);
      setError(null);
      setRestoringId(null);
      return;
    }
    let cancelled = false;
    setBackups(null);
    setError(null);
    void listBackups(slot)
      .then((list) => {
        if (!cancelled) setBackups(list);
      })
      .catch((err) => {
        log.warn('Failed to list backups', { slot, error: err });
        if (!cancelled) {
          setBackups([]);
          setError('Could not read this slot’s restore points.');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [visible, slot]);

  const restore = useCallback(
    async (backupId: string) => {
      if (slot == null || restoringId) return;
      setRestoringId(backupId);
      setError(null);
      try {
        // 'recovery' intent: this is a player repairing their own save, so the
        // progression guards are skipped. They exist to stop an in-run rewind,
        // and applied here they would refuse exactly the restores that matter
        // (2026-07-29 audit BRC-6).
        const result = await restoreFromBackup(slot, backupId, 'recovery');
        if (!result.success) {
          setError(result.error || 'That restore point could not be loaded.');
          setRestoringId(null);
          return;
        }
        onRestored(slot);
        onClose();
      } catch (err) {
        log.error('Restore failed', err);
        setError('Something went wrong restoring that save.');
        setRestoringId(null);
      }
    },
    [slot, restoringId, onRestored, onClose],
  );

  const isLoading = backups === null;
  const isEmpty = backups !== null && backups.length === 0;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <View style={styles.headerIcon}>
              <LinearGradient colors={['#0EA5E9', '#38BDF8']} style={styles.headerIconFill}>
                <History size={scale(18)} color="#FFFFFF" />
              </LinearGradient>
            </View>
            <View style={styles.headerText}>
              <Text style={styles.title}>Restore Slot {slot ?? ''}</Text>
              <Text style={styles.subtitle}>Pick the moment you want to go back to.</Text>
            </View>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Close restore points"
              onPress={onClose}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              style={styles.close}
            >
              <X size={scale(18)} color="#94A3B8" />
            </TouchableOpacity>
          </View>

          {/* A restore is reversible - say so before they choose, not after. */}
          <View style={styles.reassurance}>
            <ShieldCheck size={scale(13)} color="#34D399" />
            <Text style={styles.reassuranceText}>
              Your current save is copied first, so you can come back here and undo this.
            </Text>
          </View>

          {isLoading ? (
            <View style={styles.stateBlock}>
              <ActivityIndicator color="#60A5FA" />
              <Text style={styles.stateText}>Looking for restore points…</Text>
            </View>
          ) : isEmpty ? (
            <View style={styles.stateBlock}>
              <Clock size={scale(22)} color="#475569" />
              <Text style={styles.stateText}>
                No restore points for this slot yet. They are created automatically as you play.
              </Text>
            </View>
          ) : (
            <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
              {backups!.map((meta) => {
                const highlighted = HIGHLIGHTED_REASONS.has(meta.reason);
                const busy = restoringId === meta.id;
                return (
                  <TouchableOpacity
                    key={meta.id}
                    accessibilityRole="button"
                    accessibilityLabel={`Restore ${describeRestorePoint(meta)}, ${relativeTime(meta.timestamp)}`}
                    activeOpacity={0.85}
                    disabled={!!restoringId}
                    onPress={() => void restore(meta.id)}
                    style={[styles.entry, highlighted && styles.entryHighlighted, busy && styles.entryBusy]}
                  >
                    <View style={styles.entryBody}>
                      <Text style={styles.entryTitle} numberOfLines={1}>
                        {describeRestorePoint(meta)}
                      </Text>
                      <Text style={styles.entryMeta} numberOfLines={1}>
                        {relativeTime(meta.timestamp)} · {REASON_LABEL[meta.reason] ?? 'Saved automatically'}
                      </Text>
                    </View>
                    {busy ? (
                      <ActivityIndicator color="#60A5FA" />
                    ) : (
                      <RotateCcw size={scale(16)} color={highlighted ? '#38BDF8' : '#64748B'} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}

          {error ? <Text style={styles.error}>{error}</Text> : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(2, 6, 23, 0.86)',
    justifyContent: 'center',
    paddingHorizontal: scale(20),
    zIndex: Z_INDEX.MODAL,
  },
  sheet: {
    backgroundColor: '#0B1220',
    borderRadius: scale(20),
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.18)',
    padding: scale(18),
    maxHeight: '78%',
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: scale(12) },
  headerIcon: { width: scale(38), height: scale(38), borderRadius: scale(12), overflow: 'hidden' },
  headerIconFill: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  headerText: { flex: 1 },
  title: { color: '#F8FAFC', fontSize: fontScale(17), fontWeight: '700' },
  subtitle: { color: '#94A3B8', fontSize: fontScale(12), marginTop: verticalScale(2) },
  close: { padding: scale(4) },
  reassurance: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(8),
    marginTop: verticalScale(14),
    paddingVertical: verticalScale(9),
    paddingHorizontal: scale(11),
    borderRadius: scale(11),
    backgroundColor: 'rgba(16, 185, 129, 0.10)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.22)',
  },
  reassuranceText: { flex: 1, color: '#A7F3D0', fontSize: fontScale(11), lineHeight: fontScale(15) },
  // `flexShrink: 1` pairs with the sheet's `maxHeight: '78%'` - RN defaults
  // flexShrink to 0, so without it a player with many backups scrolls nothing
  // and the entries past the cut are unreachable.
  list: { marginTop: verticalScale(12), flexShrink: 1 },
  listContent: { gap: verticalScale(8), paddingBottom: verticalScale(4) },
  entry: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(12),
    padding: scale(13),
    borderRadius: scale(13),
    backgroundColor: 'rgba(30, 41, 59, 0.55)',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.14)',
  },
  entryHighlighted: {
    backgroundColor: 'rgba(14, 165, 233, 0.10)',
    borderColor: 'rgba(56, 189, 248, 0.32)',
  },
  entryBusy: { opacity: 0.6 },
  entryBody: { flex: 1 },
  entryTitle: { color: '#E2E8F0', fontSize: fontScale(13), fontWeight: '600' },
  entryMeta: { color: '#94A3B8', fontSize: fontScale(11), marginTop: verticalScale(2) },
  stateBlock: {
    alignItems: 'center',
    gap: verticalScale(10),
    paddingVertical: verticalScale(30),
  },
  stateText: {
    color: '#94A3B8',
    fontSize: fontScale(12),
    textAlign: 'center',
    paddingHorizontal: scale(20),
    lineHeight: fontScale(17),
  },
  error: {
    marginTop: verticalScale(12),
    color: '#FCA5A5',
    fontSize: fontScale(12),
    textAlign: 'center',
  },
});

export default React.memo(RestoreBackupSheet);
