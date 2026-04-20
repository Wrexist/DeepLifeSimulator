import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  Alert,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import LinearGradientFallback from '@/components/fallbacks/LinearGradientFallback';
const LinearGradient = LinearGradientFallback;
import { 
  X, 
  Clock, 
  HardDrive, 
  RotateCcw, 
  Plus, 
  Trash2,
  User,
  DollarSign,
  Calendar,
  Archive,
  Shield,
  ChevronRight,
} from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { 
  saveBackupManager, 
  BackupMetadata, 
  BackupStorageInfo,
  createManualBackup,
  deleteBackup,
  getBackupStorageInfo,
} from '@/utils/saveBackup';
import { scale, fontScale } from '@/utils/scaling';
import { logger } from '@/utils/logger';
import { formatMoney } from '@/utils/moneyFormatting';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface BackupRecoveryModalProps {
  visible: boolean;
  onClose: () => void;
  slot: number;
  onRestoreComplete?: () => void;
}

// Badge colors for different backup types
const BADGE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  manual: { bg: 'rgba(59, 130, 246, 0.15)', text: '#3B82F6', border: 'rgba(59, 130, 246, 0.3)' },
  auto_save: { bg: 'rgba(16, 185, 129, 0.15)', text: '#10B981', border: 'rgba(16, 185, 129, 0.3)' },
  delete_save: { bg: 'rgba(245, 158, 11, 0.15)', text: '#F59E0B', border: 'rgba(245, 158, 11, 0.3)' },
  corruption_recovery: { bg: 'rgba(239, 68, 68, 0.15)', text: '#EF4444', border: 'rgba(239, 68, 68, 0.3)' },
  before_update: { bg: 'rgba(139, 92, 246, 0.15)', text: '#8B5CF6', border: 'rgba(139, 92, 246, 0.3)' },
  background_save: { bg: 'rgba(16, 185, 129, 0.15)', text: '#10B981', border: 'rgba(16, 185, 129, 0.3)' },
  app_resume: { bg: 'rgba(6, 182, 212, 0.15)', text: '#06B6D4', border: 'rgba(6, 182, 212, 0.3)' },
  emergency_save: { bg: 'rgba(239, 68, 68, 0.15)', text: '#EF4444', border: 'rgba(239, 68, 68, 0.3)' },
  before_week: { bg: 'rgba(168, 162, 158, 0.15)', text: '#A8A29E', border: 'rgba(168, 162, 158, 0.3)' },
};

export default function BackupRecoveryModal({ visible, onClose, slot, onRestoreComplete }: BackupRecoveryModalProps) {
  const log = logger.scope('BackupRecoveryModal');
  
  const [backups, setBackups] = useState<BackupMetadata[]>([]);
  const [storageInfo, setStorageInfo] = useState<BackupStorageInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [restoring, setRestoring] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  // Load backups and storage info when modal opens
  useEffect(() => {
    if (visible) {
      loadBackupsAndInfo();
    }
  }, [visible, slot]);

  const loadBackupsAndInfo = useCallback(async () => {
    try {
      setLoading(true);
      // IMPROVEMENT: Use Promise.allSettled to handle partial failures gracefully
      const results = await Promise.allSettled([
        saveBackupManager.listBackups(slot),
        getBackupStorageInfo(),
      ]);
      
      // Handle results - use defaults if any fail
      const backupList = results[0].status === 'fulfilled' ? results[0].value : [];
      const storage = results[1].status === 'fulfilled' ? results[1].value : { total: 0, used: 0, available: 0 };
      
      // Log any failures
      if (results[0].status === 'rejected') {
        log.warn('Failed to load backup list:', results[0].reason);
      }
      if (results[1].status === 'rejected') {
        log.warn('Failed to load storage info:', results[1].reason);
      }
      
      setBackups(backupList);
      setStorageInfo(storage);
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
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    
    return date.toLocaleDateString(undefined, {
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
      'auto_save': 'Auto',
      'background_save': 'Auto',
      'app_resume': 'Resume',
      'emergency_save': 'Emergency',
      'before_week': 'Weekly',
      'manual': 'Manual',
      'delete_save': 'Pre-Delete',
      'corruption_recovery': 'Recovery',
      'before_update': 'Pre-Update',
    };
    return labels[reason] || reason;
  }, []);

  const getBadgeColors = useCallback((reason: string) => {
    return BADGE_COLORS[reason] || BADGE_COLORS.auto_save;
  }, []);

  const handleCreateBackup = useCallback(async () => {
    try {
      setCreating(true);
      log.info(`Creating manual backup for slot ${slot}`);
      
      const result = await createManualBackup(slot);
      
      if (result.success) {
        Alert.alert('Backup Created', 'Your game has been backed up successfully.');
        await loadBackupsAndInfo();
      } else {
        Alert.alert('Backup Failed', result.error || 'Failed to create backup. Please try again.');
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to create backup. Please try again.';
      log.error('Failed to create backup', error);
      Alert.alert('Error', errorMessage);
    } finally {
      setCreating(false);
    }
  }, [slot, log, loadBackupsAndInfo]);

  const handleDeleteBackup = useCallback((backup: BackupMetadata) => {
    Alert.alert(
      'Delete Backup?',
      `Are you sure you want to delete this backup?\n\n${formatDate(backup.timestamp)}\n\nThis action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setDeleting(backup.id);
              const success = await deleteBackup(backup.id);
              if (success) {
                await loadBackupsAndInfo();
              } else {
                throw new Error('Delete failed');
              }
            } catch (error) {
              log.error('Failed to delete backup', error);
              Alert.alert('Error', 'Failed to delete backup. Please try again.');
            } finally {
              setDeleting(null);
            }
          },
        },
      ]
    );
  }, [formatDate, log, loadBackupsAndInfo]);

  const handleRestore = useCallback((backup: BackupMetadata) => {
    const gameInfo = backup.gameInfo;
    const infoText = gameInfo 
      ? `\n\nCharacter: ${gameInfo.characterName}\nAge: ${gameInfo.age}\nMoney: ${formatMoney(gameInfo.money)}`
      : '';
    
    Alert.alert(
      'Restore Backup?',
      `Restore this save?\n\n${formatDate(backup.timestamp)}${infoText}\n\nThis will replace your current game.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Restore',
          style: 'destructive',
          onPress: async () => {
            try {
              setRestoring(backup.id);
              log.info(`Restoring backup ${backup.id} for slot ${slot}`);
              
              // Create safety backup first (ignore errors)
              try {
                await createManualBackup(slot, 'Before restore');
              } catch (e) {
                log.warn('Could not create safety backup before restore');
              }
              
              const result = await saveBackupManager.restoreBackup(slot, backup.id);
              if (result.success) {
                Alert.alert(
                  'Backup Restored',
                  'Your game has been restored. Please reload the game.',
                  [{ 
                    text: 'OK', 
                    onPress: () => { 
                      setRestoring(null); 
                      onClose();
                      onRestoreComplete?.();
                    } 
                  }]
                );
              } else {
                Alert.alert('Restore Failed', result.error || 'Failed to restore backup.');
                setRestoring(null);
              }
            } catch (error: unknown) {
              const errorMessage = error instanceof Error ? error.message : 'Failed to restore backup.';
              log.error('Failed to restore backup', error);
              Alert.alert('Error', errorMessage);
              setRestoring(null);
            }
          },
        },
      ]
    );
  }, [slot, formatDate, log, onClose, onRestoreComplete]);

  const storagePercentage = storageInfo 
    ? Math.min(100, (storageInfo.totalSize / storageInfo.maxSize) * 100) 
    : 0;

  return (
    <Modal 
      visible={visible} 
      transparent 
      animationType="slide" 
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          <LinearGradient
            colors={['#1E293B', '#0F172A']}
            style={styles.modalGradient}
          >
            {/* Header */}
            <View style={styles.header}>
              <View style={styles.headerLeft}>
                <View style={styles.headerIcon}>
                  <HardDrive size={22} color="#FFFFFF" />
                </View>
                <View>
                  <Text style={styles.title}>Backup Manager</Text>
                  <Text style={styles.subtitle}>Slot {slot}</Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={onClose}
                style={styles.closeButton}
                disabled={restoring !== null || creating}
              >
                <X size={24} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            {/* Storage Info Bar */}
            {storageInfo && (
              <View style={styles.storageCard}>
                <View style={styles.storageRow}>
                  <Archive size={16} color="rgba(255, 255, 255, 0.6)" />
                  <Text style={styles.storageLabel}>Storage</Text>
                  <Text style={styles.storageValue}>
                    {formatSize(storageInfo.totalSize)} / {formatSize(storageInfo.maxSize)}
                  </Text>
                </View>
                <View style={styles.storageBarBg}>
                  <View 
                    style={[
                      styles.storageBarFill, 
                      { width: `${storagePercentage}%` },
                      storagePercentage > 80 && styles.storageBarWarning,
                    ]} 
                  />
                </View>
              </View>
            )}

            {/* Create Backup Button */}
            <TouchableOpacity
              style={[styles.createButton, (creating || restoring) && styles.buttonDisabled]}
              onPress={handleCreateBackup}
              disabled={creating || restoring !== null}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={creating ? ['#4B5563', '#374151'] : ['#3B82F6', '#2563EB']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.createButtonGradient}
              >
                {creating ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Plus size={20} color="#FFFFFF" />
                )}
                <Text style={styles.createButtonText}>
                  {creating ? 'Creating Backup...' : 'Create New Backup'}
                </Text>
              </LinearGradient>
            </TouchableOpacity>

            {/* Backup List */}
            <View style={styles.listHeader}>
              <Text style={styles.listTitle}>
                Available Backups ({backups.length})
              </Text>
            </View>

            <ScrollView 
              style={styles.scrollView}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
            >
              {loading ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color="#3B82F6" />
                  <Text style={styles.loadingText}>Loading backups...</Text>
                </View>
              ) : backups.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Shield size={56} color="rgba(255, 255, 255, 0.2)" />
                  <Text style={styles.emptyTitle}>No Backups Yet</Text>
                  <Text style={styles.emptyText}>
                    Create your first backup to protect your progress
                  </Text>
                </View>
              ) : (
                backups.map((backup) => {
                  const badgeColors = getBadgeColors(backup.reason);
                  const isProcessing = restoring === backup.id || deleting === backup.id;
                  
                  return (
                    <View key={backup.id} style={styles.backupCard}>
                      {/* Top row: Time and Badge */}
                      <View style={styles.backupTopRow}>
                        <View style={styles.backupTimeRow}>
                          <Clock size={14} color="rgba(255, 255, 255, 0.5)" />
                          <Text style={styles.backupTime}>{formatDate(backup.timestamp)}</Text>
                        </View>
                        <View style={[
                          styles.badge,
                          { backgroundColor: badgeColors.bg, borderColor: badgeColors.border }
                        ]}>
                          <Text style={[styles.badgeText, { color: badgeColors.text }]}>
                            {getReasonLabel(backup.reason)}
                          </Text>
                        </View>
                      </View>

                      {/* Game Info */}
                      {backup.gameInfo && (
                        <View style={styles.gameInfoContainer}>
                          <View style={styles.gameInfoItem}>
                            <User size={14} color="rgba(255, 255, 255, 0.4)" />
                            <Text style={styles.gameInfoText}>{backup.gameInfo.characterName}</Text>
                          </View>
                          <View style={styles.gameInfoItem}>
                            <Calendar size={14} color="rgba(255, 255, 255, 0.4)" />
                            <Text style={styles.gameInfoText}>Age {backup.gameInfo.age}</Text>
                          </View>
                          <View style={styles.gameInfoItem}>
                            <DollarSign size={14} color="rgba(255, 255, 255, 0.4)" />
                            <Text style={styles.gameInfoText}>{formatMoney(backup.gameInfo.money)}</Text>
                          </View>
                        </View>
                      )}

                      {/* Size */}
                      <Text style={styles.sizeText}>{formatSize(backup.size)}</Text>

                      {/* Action buttons */}
                      <View style={styles.actionRow}>
                        <TouchableOpacity
                          style={[styles.restoreBtn, isProcessing && styles.buttonDisabled]}
                          onPress={() => handleRestore(backup)}
                          disabled={restoring !== null || deleting !== null}
                        >
                          {restoring === backup.id ? (
                            <ActivityIndicator size="small" color="#FFFFFF" />
                          ) : (
                            <RotateCcw size={16} color="#FFFFFF" />
                          )}
                          <Text style={styles.restoreBtnText}>
                            {restoring === backup.id ? 'Restoring...' : 'Restore'}
                          </Text>
                          <ChevronRight size={16} color="rgba(255, 255, 255, 0.5)" />
                        </TouchableOpacity>
                        
                        <TouchableOpacity
                          style={[styles.deleteBtn, isProcessing && styles.buttonDisabled]}
                          onPress={() => handleDeleteBackup(backup)}
                          disabled={restoring !== null || deleting !== null}
                        >
                          {deleting === backup.id ? (
                            <ActivityIndicator size="small" color="#EF4444" />
                          ) : (
                            <Trash2 size={16} color="#EF4444" />
                          )}
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })
              )}
              
              {/* Bottom padding */}
              <View style={{ height: scale(20) }} />
            </ScrollView>

            {/* Footer */}
            <View style={styles.footer}>
              <Text style={styles.footerText}>
                Backups protect your progress from data loss
              </Text>
            </View>
          </LinearGradient>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    width: '100%',
    height: screenHeight * 0.85,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: 'hidden',
  },
  modalGradient: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 16,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  headerIcon: {
    width: scale(48),
    height: scale(48),
    borderRadius: scale(14),
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.3)',
  },
  title: {
    fontSize: fontScale(22),
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  subtitle: {
    fontSize: fontScale(14),
    color: 'rgba(255, 255, 255, 0.5)',
    marginTop: scale(2),
  },
  closeButton: {
    width: scale(44),
    height: scale(44),
    borderRadius: scale(22),
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  storageCard: {
    marginHorizontal: scale(20),
    marginBottom: scale(16),
    padding: scale(16),
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: scale(16),
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  storageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(10),
    marginBottom: scale(12),
  },
  storageLabel: {
    flex: 1,
    fontSize: fontScale(14),
    color: 'rgba(255, 255, 255, 0.6)',
    fontWeight: '500',
  },
  storageValue: {
    fontSize: fontScale(14),
    color: '#FFFFFF',
    fontWeight: '600',
  },
  storageBarBg: {
    height: scale(8),
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: scale(4),
    overflow: 'hidden',
  },
  storageBarFill: {
    height: '100%',
    backgroundColor: '#3B82F6',
    borderRadius: scale(4),
  },
  storageBarWarning: {
    backgroundColor: '#F59E0B',
  },
  createButton: {
    marginHorizontal: scale(20),
    marginBottom: scale(20),
    borderRadius: scale(16),
    overflow: 'hidden',
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  createButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: scale(18),
    gap: scale(10),
  },
  createButtonText: {
    fontSize: fontScale(17),
    fontWeight: '700',
    color: '#FFFFFF',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  listHeader: {
    paddingHorizontal: scale(20),
    marginBottom: scale(12),
  },
  listTitle: {
    fontSize: fontScale(16),
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.7)',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: scale(20),
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: scale(60),
    gap: scale(16),
  },
  loadingText: {
    fontSize: fontScale(16),
    color: 'rgba(255, 255, 255, 0.5)',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: scale(60),
    gap: scale(16),
  },
  emptyTitle: {
    fontSize: fontScale(20),
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.6)',
  },
  emptyText: {
    fontSize: fontScale(14),
    color: 'rgba(255, 255, 255, 0.4)',
    textAlign: 'center',
    paddingHorizontal: scale(30),
  },
  backupCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: scale(18),
    padding: scale(18),
    marginBottom: scale(14),
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  backupTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: scale(14),
  },
  backupTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(8),
  },
  backupTime: {
    fontSize: fontScale(16),
    fontWeight: '600',
    color: '#FFFFFF',
  },
  badge: {
    paddingHorizontal: scale(12),
    paddingVertical: scale(5),
    borderRadius: scale(10),
    borderWidth: 1,
  },
  badgeText: {
    fontSize: fontScale(12),
    fontWeight: '700',
  },
  gameInfoContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: scale(16),
    marginBottom: scale(12),
  },
  gameInfoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(6),
  },
  gameInfoText: {
    fontSize: fontScale(14),
    color: 'rgba(255, 255, 255, 0.65)',
    fontWeight: '500',
  },
  sizeText: {
    fontSize: fontScale(12),
    color: 'rgba(255, 255, 255, 0.4)',
    marginBottom: scale(14),
  },
  actionRow: {
    flexDirection: 'row',
    gap: scale(12),
  },
  restoreBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: scale(8),
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingVertical: scale(14),
    borderRadius: scale(14),
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  restoreBtnText: {
    flex: 1,
    fontSize: fontScale(15),
    fontWeight: '600',
    color: '#FFFFFF',
  },
  deleteBtn: {
    width: scale(52),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: scale(14),
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.2)',
  },
  footer: {
    paddingHorizontal: scale(20),
    paddingVertical: scale(16),
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  footerText: {
    fontSize: fontScale(13),
    color: 'rgba(255, 255, 255, 0.4)',
    textAlign: 'center',
  },
});


