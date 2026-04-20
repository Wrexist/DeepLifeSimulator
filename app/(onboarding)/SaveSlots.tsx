import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { Archive, Play, Trash2 } from 'lucide-react-native';
import BlurViewFallback from '@/components/fallbacks/BlurViewFallback';
const BlurView = BlurViewFallback;
import LinearGradientFallback from '@/components/fallbacks/LinearGradientFallback';
const LinearGradient = LinearGradientFallback;
import BackupRecoveryModal from '@/components/BackupRecoveryModal';
import ConfirmDialog from '@/components/ConfirmDialog';
import OnboardingScreenShellV2 from '@/components/onboarding/OnboardingScreenShellV2';
import OnboardingGlassHeader from '@/components/onboarding/OnboardingGlassHeader';
import OnboardingFloatingButton from '@/components/onboarding/OnboardingFloatingButton';
import { useGame } from '@/contexts/GameContext';
import { useOnboarding } from '@/src/features/onboarding/OnboardingContext';
import {
  type SaveSlotData,
  hasSaveStateShape,
  hasMeaningfulSaveData,
  checkIfAllSlotsFull,
} from '@/src/features/onboarding/saveSlotHelpers';
import { logOnboardingStepView } from '@/src/features/onboarding/onboardingAnalytics';
import { logger } from '@/utils/logger';
import { formatMoney } from '@/utils/moneyFormatting';
import { clearProtectedState, deleteAllBackupsForSlot, listBackups } from '@/utils/saveBackup';
import { validateGameEntry, validateSaveSlot } from '@/utils/gameEntryValidation';
import {
  fontScale,
  responsiveBorderRadius,
  responsiveFontSize,
  responsivePadding,
  responsiveSpacing,
  scale,
  verticalScale,
} from '@/utils/scaling';

export default function SaveSlots() {
  const log = logger.scope('SaveSlots');
  const router = useRouter();
  const navigation = useNavigation();
  const { state, setState } = useOnboarding();
  const { gameState, loadGame } = useGame();
  const [slots, setSlots] = useState<SaveSlotData[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<number | null>(state.slot || null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<number | null>(null);

  useEffect(() => {
    logOnboardingStepView('SaveSlots');
  }, []);

  const [showBackupManager, setShowBackupManager] = useState<number | null>(null);
  const [backupCounts, setBackupCounts] = useState<Record<number, number>>({});
  const [isBusy, setIsBusy] = useState(false);

  const selectedCard = useMemo(
    () => slots.find((slot) => slot.id === selectedSlot) ?? null,
    [selectedSlot, slots]
  );

  const loadSlots = useCallback(async () => {
    try {
      const { readSaveSlot, decodePersistedSaveEnvelope, shouldAllowUnsignedLegacySaves } = await import(
        '@/utils/saveValidation'
      );
      const allowLegacy = shouldAllowUnsignedLegacySaves();
      const slotData: SaveSlotData[] = [];

      for (let i = 1; i <= 3; i++) {
        let data: string | null = null;
        try {
          data = await readSaveSlot(i, undefined, { allowLegacy });
        } catch (storageError) {
          log.error(`Storage error loading slot ${i}`, storageError);
          slotData.push({ id: i, hasData: false, error: true });
          continue;
        }

        if (!data) {
          slotData.push({ id: i, hasData: false });
          continue;
        }

        try {
          const decoded = decodePersistedSaveEnvelope(data, { allowLegacy });
          if (!decoded.valid || typeof decoded.data !== 'string') {
            slotData.push({ id: i, hasData: false, error: true });
            continue;
          }

          const parsed = JSON.parse(decoded.data);
          if (hasSaveStateShape(parsed)) {
            slotData.push({
              ...parsed,
              id: i,
              hasData: hasMeaningfulSaveData(parsed),
            });
          } else {
            slotData.push({ id: i, hasData: false, error: true });
          }
        } catch (parseError) {
          log.error(`Failed parsing slot ${i}`, parseError);
          slotData.push({ id: i, hasData: false, error: true });
        }
      }

      setSlots(slotData);
    } catch (error) {
      log.error('Failed loading slots', error);
    }
  }, [log]);

  const loadBackupCounts = useCallback(async () => {
    const counts: Record<number, number> = {};
    for (let i = 1; i <= 3; i++) {
      try {
        const backups = await listBackups(i);
        counts[i] = backups.length;
      } catch {
        counts[i] = 0;
      }
    }
    setBackupCounts(counts);
  }, []);

  useEffect(() => {
    void loadSlots();
    void loadBackupCounts();
  }, [loadBackupCounts, loadSlots]);

  useFocusEffect(
    useCallback(() => {
      void loadSlots();
      void loadBackupCounts();
    }, [loadBackupCounts, loadSlots])
  );

  const selectSlot = (slotId: number) => {
    setSelectedSlot(slotId);
    setState((prev) => ({ ...prev, slot: slotId }));
  };

  const continueToGame = async () => {
    if (!selectedSlot || isBusy) return;

    const slot = slots.find((s) => s.id === selectedSlot);
    if (!slot || !slot.hasData) {
      await startNewGame();
      return;
    }

    setIsBusy(true);
    try {
      const slotValidation = await validateSaveSlot(selectedSlot);
      if (!slotValidation.valid) {
        const errorMessage =
          slotValidation.errors.find((e) => e.includes('version')) ||
          slotValidation.errors.find((e) => e.includes('corrupted')) ||
          slotValidation.errors[0] ||
          'This save file cannot be loaded.';

        Alert.alert('Save Unavailable', `${errorMessage}\n\nOpen backups for this slot?`, [
          { text: 'Cancel', style: 'cancel' },
          { text: 'View Backups', onPress: () => setShowBackupManager(selectedSlot) },
        ]);
        return;
      }

      const loadedState = await loadGame(selectedSlot);
      if (!loadedState) {
        Alert.alert('No Save Found', 'No save data found for this slot. Please select another slot.');
        return;
      }

      const validation = validateGameEntry(loadedState);
      if (!validation.canEnter) {
        Alert.alert('Invalid Save', validation.errors[0] || 'This save cannot be loaded right now.');
        return;
      }

      setTimeout(() => {
        router.push('/(tabs)');
      }, 80);
    } catch (error) {
      log.error('Error continuing game', error);
      Alert.alert('Load Error', 'An error occurred while loading your save. Please try again.');
    } finally {
      setIsBusy(false);
    }
  };

  const deleteSlot = async (slotId: number) => {
    try {
      const { deleteSaveSlot } = await import('@/utils/saveValidation');
      await deleteSaveSlot(slotId);
      await deleteAllBackupsForSlot(slotId);
      await clearProtectedState(slotId);

      if (selectedSlot === slotId) {
        setSelectedSlot(null);
        setState((prev) => ({ ...prev, slot: 0 }));
      }

      await loadSlots();
      await loadBackupCounts();
    } catch (error) {
      log.error('Failed deleting slot', error);
      Alert.alert('Delete Failed', 'Could not delete this slot. Please try again.');
    } finally {
      setShowDeleteConfirm(null);
    }
  };

  const startNewGame = useCallback(async () => {
    if (isBusy) return;

    if (selectedCard?.hasData) {
      Alert.alert('Slot Occupied', 'Please pick an empty slot to start a new game.');
      return;
    }

    setIsBusy(true);
    try {
      const allSlotsFull = await checkIfAllSlotsFull();
      if (allSlotsFull) {
        Alert.alert(
          'All Save Slots Full',
          'All 3 save slots are full. Delete one to create a new life.'
        );
        return;
      }

      router.push('/(onboarding)/Scenarios');
    } finally {
      setIsBusy(false);
    }
  }, [isBusy, router, selectedCard]);

  const primaryAction = async () => {
    if (!selectedSlot) {
      Alert.alert('Select A Slot', 'Choose a slot first to continue.');
      return;
    }
    if (selectedCard?.hasData) {
      await continueToGame();
      return;
    }
    await startNewGame();
  };

  return (
    <>
      <OnboardingScreenShellV2
        floatingButton={
          <OnboardingFloatingButton
            title={selectedCard?.hasData ? 'Continue Game' : 'Start New Game'}
            onPress={() => { void primaryAction(); }}
            disabled={!selectedSlot || isBusy}
            icon={<Play size={24} color="#FFFFFF" />}
          />
        }
      >
        <OnboardingGlassHeader
          title="Save Slots"
          onBack={() => {
            if (navigation.canGoBack()) {
              router.back();
            } else {
              router.push('/');
            }
          }}
          onInfo={() =>
            Alert.alert(
              'Save Slots',
              'Pick an empty slot for a new life or select an existing slot to continue.'
            )
          }
        />

        <ScrollView
          style={styles.scrollContainer}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={true}
        >
          {slots.map((slot) => {
            const isSelected = selectedSlot === slot.id;
            const statusText = slot.error ? 'Recovery Needed' : slot.hasData ? 'Playable' : 'Empty';
            const statusColor = slot.error ? '#F97316' : slot.hasData ? '#34D399' : '#9CA3AF';
            const fullName = `${slot.userProfile?.firstName || ''} ${slot.userProfile?.lastName || ''}`.trim();

            return (
              <TouchableOpacity key={slot.id} activeOpacity={0.9} onPress={() => selectSlot(slot.id)}>
                <View style={styles.cardContainer}>
                  <BlurView intensity={20} style={styles.cardBlur}>
                    <LinearGradient
                      colors={
                        isSelected
                          ? ['rgba(16, 185, 129, 0.2)', 'rgba(5, 150, 105, 0.2)']
                          : ['rgba(31, 41, 55, 0.8)', 'rgba(17, 24, 39, 0.8)']
                      }
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={[styles.card, isSelected && styles.cardSelected]}
                    >
                      <View style={styles.slotHeader}>
                        <Text style={styles.slotTitle}>Slot {slot.id}</Text>
                        <Text style={[styles.statusChip, { color: statusColor }]}>{statusText}</Text>
                      </View>

                      <Text style={styles.slotName}>
                        {slot.hasData ? fullName || 'Unnamed Character' : 'Start a new life here'}
                      </Text>

                      {slot.hasData ? (
                        <View style={styles.statsRow}>
                          <View style={styles.statBlock}>
                            <Text style={styles.statLabel}>Money</Text>
                            <Text style={styles.statValue}>
                              {formatMoney(slot.stats?.money || 0)}
                            </Text>
                          </View>
                          <View style={styles.statBlock}>
                            <Text style={styles.statLabel}>Age</Text>
                            <Text style={styles.statValue}>
                              {Math.ceil(slot.date?.age || 0)}
                            </Text>
                          </View>
                          <View style={styles.statBlock}>
                            <Text style={styles.statLabel}>Weeks</Text>
                            <Text style={styles.statValue}>{slot.weeksLived || 0}</Text>
                          </View>
                        </View>
                      ) : null}

                      {slot.hasData ? (
                        <View style={styles.slotActions}>
                          <TouchableOpacity
                            accessibilityRole="button"
                            onPress={() => setShowBackupManager(slot.id)}
                            style={styles.smallAction}
                          >
                            <Archive size={scale(14)} color="#60A5FA" />
                            <Text style={styles.smallActionText}>
                              Backups ({backupCounts[slot.id] || 0})
                            </Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            accessibilityRole="button"
                            onPress={() => setShowDeleteConfirm(slot.id)}
                            style={[styles.smallAction, styles.deleteAction]}
                          >
                            <Trash2 size={scale(14)} color="#F87171" />
                            <Text style={styles.deleteText}>Delete Slot</Text>
                          </TouchableOpacity>
                        </View>
                      ) : null}
                    </LinearGradient>
                  </BlurView>
                </View>
              </TouchableOpacity>
            );
          })}

          <View style={{ height: 140 }} />
        </ScrollView>
      </OnboardingScreenShellV2>

      <ConfirmDialog
        visible={showDeleteConfirm !== null}
        title="Delete Save Slot?"
        message="This removes the selected save and its backups. This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        destructive
        type="danger"
        onConfirm={() => {
          if (showDeleteConfirm !== null) {
            void deleteSlot(showDeleteConfirm);
          }
        }}
        onCancel={() => setShowDeleteConfirm(null)}
      />

      {showBackupManager !== null ? (
        <BackupRecoveryModal
          visible
          slot={showBackupManager}
          onClose={() => {
            setShowBackupManager(null);
            void loadBackupCounts();
          }}
          onRestoreComplete={() => {
            void loadSlots();
            void loadBackupCounts();
          }}
        />
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    gap: responsiveSpacing.lg,
    paddingHorizontal: responsivePadding.large,
    paddingTop: responsiveSpacing.sm,
    paddingBottom: responsiveSpacing.lg,
  },
  cardContainer: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 12,
  },
  cardBlur: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  card: {
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    gap: responsiveSpacing.sm,
  },
  cardSelected: {
    borderColor: 'rgba(16, 185, 129, 0.5)',
    borderWidth: 2,
  },
  slotHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  slotTitle: {
    fontSize: responsiveFontSize.xl,
    fontWeight: '800',
    color: '#FFFFFF',
    ...Platform.select({
      web: { textShadow: '1px 1px 3px rgba(0, 0, 0, 0.5)' } as any,
      default: {
        textShadowColor: 'rgba(0, 0, 0, 0.5)',
        textShadowOffset: { width: 1, height: 1 },
        textShadowRadius: 3,
      },
    }),
  },
  statusChip: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: responsiveBorderRadius.full,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    fontSize: fontScale(11),
    fontWeight: '700',
    overflow: 'hidden',
    paddingHorizontal: responsiveSpacing.sm,
    paddingVertical: verticalScale(4),
  },
  slotName: {
    fontSize: fontScale(13),
    fontWeight: '500',
    color: '#D1D5DB',
  },
  statsRow: {
    flexDirection: 'row',
    gap: responsiveSpacing.sm,
  },
  statBlock: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: responsiveBorderRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    flex: 1,
    paddingHorizontal: responsiveSpacing.sm,
    paddingVertical: verticalScale(8),
  },
  statLabel: {
    fontSize: fontScale(10),
    fontWeight: '600',
    color: '#9CA3AF',
    marginBottom: verticalScale(2),
  },
  statValue: {
    fontSize: fontScale(12),
    fontWeight: '800',
    color: '#FFFFFF',
  },
  slotActions: {
    flexDirection: 'row',
    gap: responsiveSpacing.sm,
  },
  smallAction: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: responsiveBorderRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    flex: 1,
    flexDirection: 'row',
    gap: responsiveSpacing.xs,
    justifyContent: 'center',
    paddingVertical: verticalScale(8),
  },
  smallActionText: {
    fontSize: fontScale(11),
    fontWeight: '700',
    color: '#60A5FA',
  },
  deleteAction: {
    borderColor: 'rgba(248, 113, 113, 0.3)',
  },
  deleteText: {
    color: '#F87171',
    fontSize: fontScale(11),
    fontWeight: '700',
  },
});
