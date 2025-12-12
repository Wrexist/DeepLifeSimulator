import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  Alert,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { X, Clock, HardDrive, RotateCcw, AlertTriangle, CheckCircle } from 'lucide-react-native';
import { useGame } from '@/contexts/GameContext';
import { saveBackupManager, BackupMetadata } from '@/utils/saveBackup';
import { responsivePadding, responsiveFontSize, responsiveSpacing, responsiveBorderRadius, scale, verticalScale } from '@/utils/scaling';
import { logger } from '@/utils/logger';

interface BackupRecoveryModalProps {
  visible: boolean;
  onClose: () => void;
  slot: number;
}

export default function BackupRecoveryModal({ visible, onClose, slot }: BackupRecoveryModalProps) {
  const { gameState, loadGame } = useGame();
  const { settings } = gameState;
  const darkMode = settings.darkMode;
  const log = logger.scope('BackupRecoveryModal');
  
  const [backups, setBackups] = useState<BackupMetadata[]>([]);
  const [loading, setLoading] = useState(false);
  const [restoring, setRestoring] = useState<string | null>(null);

  // Load backups when modal opens
  useEffect(() => {
    if (visible) {
      loadBackups();
    }
  }, [visible, slot]);

  const loadBackups = useCallback(async () => {
    try {
      setLoading(true);
      const backupList = await saveBackupManager.listBackups(slot);
      setBackups(backupList);
      log.info(`Loaded ${backupList.length} backups for slot ${slot}`);
    } catch (error) {
      log.error('Failed to load backups', error);
      Alert.alert('Error', 'Failed to load backups. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [slot, log]);

  const formatDate = useCallback((timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }, []);

  const formatSize = useCallback((bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }, []);

  const getReasonLabel = useCallback((reason: string) => {
    const labels: Record<string, string> = {
      'auto_save': 'Auto Save',
      'background_save': 'Background Save',
      'app_resume': 'App Resume',
      'emergency_save': 'Emergency Save',
      'before_week': 'Before Week',
      'manual': 'Manual',
    };
    return labels[reason] || reason;
  }, []);

  const handleRestore = useCallback((backup: BackupMetadata) => {
    Alert.alert(
      'Restore Backup?',
      `Are you sure you want to restore from this backup?\n\nDate: ${formatDate(backup.timestamp)}\nReason: ${getReasonLabel(backup.reason)}\n\nThis will overwrite your current save.`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Restore',
          style: 'destructive',
          onPress: async () => {
            try {
              setRestoring(backup.id);
              log.info(`Restoring backup ${backup.id} for slot ${slot}`);
              
              const restored = await saveBackupManager.restoreBackup(slot, backup.id);
              if (restored) {
                // Reload the game with restored state
                await loadGame(slot);
                
                Alert.alert(
                  'Backup Restored',
                  'Your game has been restored from the backup successfully.',
                  [
                    {
                      text: 'OK',
                      onPress: () => {
                        setRestoring(null);
                        onClose();
                      },
                    },
                  ]
                );
                log.info('Backup restored successfully');
              } else {
                throw new Error('Restore failed');
              }
            } catch (error) {
              log.error('Failed to restore backup', error);
              Alert.alert(
                'Restore Failed',
                'Failed to restore from backup. Please try again.',
                [{ text: 'OK', onPress: () => setRestoring(null) }]
              );
            }
          },
        },
      ]
    );
  }, [slot, loadGame, formatDate, getReasonLabel, log, onClose]);

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <LinearGradient
          colors={darkMode ? ['#1F2937', '#111827'] : ['#FFFFFF', '#F8FAFC']}
          style={[styles.modal, darkMode && styles.modalDark]}
        >
          {/* Header */}
          <View style={[styles.header, darkMode && styles.headerDark]}>
            <View style={styles.headerLeft}>
              <HardDrive size={24} color={darkMode ? '#FFFFFF' : '#1F2937'} />
              <Text style={[styles.title, darkMode && styles.titleDark]}>
                Backup Recovery
              </Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              style={styles.closeButton}
              disabled={restoring !== null}
            >
              <X size={24} color={darkMode ? '#D1D5DB' : '#6B7280'} />
            </TouchableOpacity>
          </View>

          {/* Content */}
          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {loading ? (
              <View style={styles.emptyState}>
                <Text style={[styles.emptyText, darkMode && styles.emptyTextDark]}>
                  Loading backups...
                </Text>
              </View>
            ) : backups.length === 0 ? (
              <View style={styles.emptyState}>
                <AlertTriangle size={48} color={darkMode ? '#6B7280' : '#9CA3AF'} />
                <Text style={[styles.emptyText, darkMode && styles.emptyTextDark]}>
                  No backups available
                </Text>
                <Text style={[styles.emptySubtext, darkMode && styles.emptySubtextDark]}>
                  Backups are created automatically when you save your game.
                </Text>
              </View>
            ) : (
              <View style={styles.backupList}>
                <Text style={[styles.sectionTitle, darkMode && styles.sectionTitleDark]}>
                  Available Backups ({backups.length})
                </Text>
                {backups.map((backup) => (
                  <View
                    key={backup.id}
                    style={[styles.backupItem, darkMode && styles.backupItemDark]}
                  >
                    <View style={styles.backupHeader}>
                      <View style={styles.backupInfo}>
                        <Clock size={16} color={darkMode ? '#9CA3AF' : '#6B7280'} />
                        <Text style={[styles.backupDate, darkMode && styles.backupDateDark]}>
                          {formatDate(backup.timestamp)}
                        </Text>
                      </View>
                      <View style={styles.backupBadge}>
                        <Text style={styles.backupBadgeText}>
                          {getReasonLabel(backup.reason)}
                        </Text>
                      </View>
                    </View>
                    
                    <View style={styles.backupDetails}>
                      <Text style={[styles.backupSize, darkMode && styles.backupSizeDark]}>
                        Size: {formatSize(backup.size)}
                      </Text>
                    </View>

                    <TouchableOpacity
                      style={[
                        styles.restoreButton,
                        darkMode && styles.restoreButtonDark,
                        restoring === backup.id && styles.restoreButtonDisabled,
                      ]}
                      onPress={() => handleRestore(backup)}
                      disabled={restoring !== null}
                    >
                      {restoring === backup.id ? (
                        <Text style={styles.restoreButtonText}>Restoring...</Text>
                      ) : (
                        <>
                          <RotateCcw size={16} color="#FFFFFF" />
                          <Text style={styles.restoreButtonText}>Restore</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
          </ScrollView>

          {/* Footer */}
          <View style={[styles.footer, darkMode && styles.footerDark]}>
            <Text style={[styles.footerText, darkMode && styles.footerTextDark]}>
              Backups are automatically created when you save your game.
            </Text>
          </View>
        </LinearGradient>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: responsivePadding.horizontal,
  },
  modal: {
    backgroundColor: '#FFFFFF',
    borderRadius: responsiveBorderRadius.xl,
    width: '95%',
    maxWidth: scale(700),
    height: '90%',
    maxHeight: '95%',
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.25,
        shadowRadius: 20,
      },
      android: {
        elevation: 10,
      },
      web: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.25,
        shadowRadius: 20,
      },
    }),
  },
  modalDark: {
    backgroundColor: '#1F2937',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: responsiveSpacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerDark: {
    borderBottomColor: '#374151',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: responsiveSpacing.sm,
  },
  title: {
    fontSize: responsiveFontSize.xl,
    fontWeight: '700',
    color: '#1F2937',
  },
  titleDark: {
    color: '#FFFFFF',
  },
  closeButton: {
    padding: responsiveSpacing.xs,
  },
  content: {
    flex: 1,
    padding: responsiveSpacing.lg,
    minHeight: verticalScale(500),
    maxHeight: '100%',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: verticalScale(60),
    gap: responsiveSpacing.md,
  },
  emptyText: {
    fontSize: responsiveFontSize.lg,
    fontWeight: '600',
    color: '#6B7280',
    textAlign: 'center',
  },
  emptyTextDark: {
    color: '#9CA3AF',
  },
  emptySubtext: {
    fontSize: responsiveFontSize.base,
    color: '#9CA3AF',
    textAlign: 'center',
    paddingHorizontal: responsiveSpacing.lg,
  },
  emptySubtextDark: {
    color: '#6B7280',
  },
  backupList: {
    gap: responsiveSpacing.md,
  },
  sectionTitle: {
    fontSize: responsiveFontSize.base,
    fontWeight: '600',
    color: '#374151',
    marginBottom: responsiveSpacing.sm,
  },
  sectionTitleDark: {
    color: '#D1D5DB',
  },
  backupItem: {
    backgroundColor: '#F9FAFB',
    borderRadius: responsiveBorderRadius.md,
    padding: responsiveSpacing.md,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  backupItemDark: {
    backgroundColor: '#374151',
    borderColor: '#4B5563',
  },
  backupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: responsiveSpacing.sm,
  },
  backupInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: responsiveSpacing.xs,
    flex: 1,
  },
  backupDate: {
    fontSize: responsiveFontSize.base,
    fontWeight: '600',
    color: '#1F2937',
  },
  backupDateDark: {
    color: '#FFFFFF',
  },
  backupBadge: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: responsiveSpacing.sm,
    paddingVertical: scale(4),
    borderRadius: responsiveBorderRadius.sm,
  },
  backupBadgeText: {
    fontSize: responsiveFontSize.xs,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  backupDetails: {
    marginBottom: responsiveSpacing.md,
  },
  backupSize: {
    fontSize: responsiveFontSize.sm,
    color: '#6B7280',
  },
  backupSizeDark: {
    color: '#9CA3AF',
  },
  restoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: responsiveSpacing.xs,
    backgroundColor: '#10B981',
    paddingVertical: responsiveSpacing.sm,
    paddingHorizontal: responsiveSpacing.md,
    borderRadius: responsiveBorderRadius.md,
  },
  restoreButtonDark: {
    backgroundColor: '#059669',
  },
  restoreButtonDisabled: {
    opacity: 0.6,
  },
  restoreButtonText: {
    fontSize: responsiveFontSize.base,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  footer: {
    padding: responsiveSpacing.lg,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
  },
  footerDark: {
    borderTopColor: '#374151',
    backgroundColor: '#374151',
  },
  footerText: {
    fontSize: responsiveFontSize.xs,
    color: '#6B7280',
    textAlign: 'center',
  },
  footerTextDark: {
    color: '#9CA3AF',
  },
});

