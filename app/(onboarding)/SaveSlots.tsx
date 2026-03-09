import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { Archive, Play, Trash2 } from 'lucide-react-native';
import BackupRecoveryModal from '@/components/BackupRecoveryModal';
import ConfirmDialog from '@/components/ConfirmDialog';
import GlassActionButton from '@/components/onboarding/GlassActionButton';
import GlassPanel from '@/components/onboarding/GlassPanel';
import OnboardingScreenShell from '@/components/onboarding/OnboardingScreenShell';
import OnboardingTopBar from '@/components/onboarding/OnboardingTopBar';
import { useGame } from '@/contexts/GameContext';
import { useOnboarding } from '@/src/features/onboarding/OnboardingContext';
import { getOnboardingTheme } from '@/lib/config/onboardingTheme';
import { logger } from '@/utils/logger';
import { formatMoney } from '@/utils/moneyFormatting';
import { clearProtectedState, deleteAllBackupsForSlot, listBackups } from '@/utils/saveBackup';
import { validateGameEntry, validateSaveSlot } from '@/utils/gameEntryValidation';
import {
  fontScale,
  responsiveBorderRadius,
  responsiveSpacing,
  scale,
  verticalScale,
} from '@/utils/scaling';

type SaveSlotSnapshot = {
  weeksLived?: number;
  stats?: { money?: number };
  date?: { age?: number; month?: string };
  userProfile?: { firstName?: string; lastName?: string };
  achievements?: { completed?: boolean }[];
  relationships?: unknown[];
  items?: { owned?: boolean }[];
};

interface SaveSlotData extends SaveSlotSnapshot {
  id: number;
  hasData: boolean;
  error?: boolean;
}

const BACKGROUND = require('@/assets/images/Main_Menu_2.png');

const hasSaveStateShape = (state: unknown): state is SaveSlotSnapshot => {
  if (!state || typeof state !== 'object') return false;
  const candidate = state as Record<string, unknown>;
  return (
    typeof candidate.userProfile === 'object' &&
    candidate.userProfile !== null &&
    typeof candidate.stats === 'object' &&
    candidate.stats !== null &&
    typeof candidate.date === 'object' &&
    candidate.date !== null
  );
};

const hasMeaningfulSaveData = (state: SaveSlotSnapshot): boolean => {
  return Boolean(
    (typeof state.weeksLived === 'number' && state.weeksLived > 0) ||
      (typeof state.stats?.money === 'number' && state.stats.money > 0) ||
      (Array.isArray(state.achievements) && state.achievements.some((a) => a?.completed)) ||
      (Array.isArray(state.relationships) && state.relationships.length > 0) ||
      (Array.isArray(state.items) && state.items.some((item) => item?.owned)) ||
      state.userProfile?.firstName ||
      state.userProfile?.lastName
  );
};

export default function SaveSlots() {
  const log = logger.scope('SaveSlots');
  const router = useRouter();
  const navigation = useNavigation();
  const { state, setState } = useOnboarding();
  const { gameState, loadGame } = useGame();
  const [slots, setSlots] = useState<SaveSlotData[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<number | null>(state.slot || null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<number | null>(null);
  const [showBackupManager, setShowBackupManager] = useState<number | null>(null);
  const [backupCounts, setBackupCounts] = useState<Record<number, number>>({});
  const [isBusy, setIsBusy] = useState(false);

  const isDarkMode = Boolean(gameState?.settings?.darkMode);
  const theme = getOnboardingTheme(isDarkMode);

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

  const checkIfAllSlotsFull = useCallback(async (): Promise<boolean> => {
    try {
      const { readSaveSlot, decodePersistedSaveEnvelope, shouldAllowUnsignedLegacySaves } = await import(
        '@/utils/saveValidation'
      );
      const allowLegacy = shouldAllowUnsignedLegacySaves();
      let fullSlots = 0;

      for (let i = 1; i <= 3; i++) {
        const data = await readSaveSlot(i, undefined, { allowLegacy });
        if (!data) continue;

        try {
          const decoded = decodePersistedSaveEnvelope(data, { allowLegacy });
          if (!decoded.valid || typeof decoded.data !== 'string') {
            fullSlots++;
            continue;
          }
          const parsed = JSON.parse(decoded.data);
          if (hasSaveStateShape(parsed) && hasMeaningfulSaveData(parsed)) {
            fullSlots++;
          }
        } catch {
          fullSlots++;
        }
      }

      return fullSlots >= 3;
    } catch (error) {
      log.error('Error checking full slots', error);
      return false;
    }
  }, [log]);

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
  }, [checkIfAllSlotsFull, isBusy, router, selectedCard]);

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
      <OnboardingScreenShell backgroundSource={BACKGROUND}>
        <OnboardingTopBar
          title="Save Slots"
          subtitle="Choose where your life story lives."
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

        <GlassPanel strong style={styles.heroPanel}>
          <Text style={[styles.heroTitle, { color: theme.title }]}>Smart Save Manager</Text>
          <Text style={[styles.heroSubtitle, { color: theme.subtitle }]}>
            Slot health, backups, and restore options are all available before you continue.
          </Text>
        </GlassPanel>

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {slots.map((slot) => {
            const isSelected = selectedSlot === slot.id;
            const statusText = slot.error ? 'Recovery Needed' : slot.hasData ? 'Playable' : 'Empty';
            const statusColor = slot.error ? '#F97316' : slot.hasData ? '#34D399' : theme.subtitle;
            const fullName = `${slot.userProfile?.firstName || ''} ${slot.userProfile?.lastName || ''}`.trim();

            return (
              <TouchableOpacity key={slot.id} activeOpacity={0.9} onPress={() => selectSlot(slot.id)}>
                <GlassPanel style={[styles.slotCard, isSelected ? styles.slotCardSelected : undefined]}>
                  <View style={styles.slotHeader}>
                    <Text style={[styles.slotTitle, { color: theme.title }]}>Slot {slot.id}</Text>
                    <Text style={[styles.statusChip, { color: statusColor }]}>{statusText}</Text>
                  </View>

                  <Text style={[styles.slotName, { color: theme.subtitle }]}>
                    {slot.hasData ? fullName || 'Unnamed Character' : 'Start a new life here'}
                  </Text>

                  {slot.hasData ? (
                    <View style={styles.statsRow}>
                      <View style={styles.statBlock}>
                        <Text style={[styles.statLabel, { color: theme.subtitle }]}>Money</Text>
                        <Text style={[styles.statValue, { color: theme.title }]}>
                          {formatMoney(slot.stats?.money || 0)}
                        </Text>
                      </View>
                      <View style={styles.statBlock}>
                        <Text style={[styles.statLabel, { color: theme.subtitle }]}>Age</Text>
                        <Text style={[styles.statValue, { color: theme.title }]}>
                          {Math.ceil(slot.date?.age || 0)}
                        </Text>
                      </View>
                      <View style={styles.statBlock}>
                        <Text style={[styles.statLabel, { color: theme.subtitle }]}>Weeks</Text>
                        <Text style={[styles.statValue, { color: theme.title }]}>{slot.weeksLived || 0}</Text>
                      </View>
                    </View>
                  ) : null}

                  {slot.hasData ? (
                    <View style={styles.slotActions}>
                      <TouchableOpacity
                        accessibilityRole="button"
                        onPress={() => setShowBackupManager(slot.id)}
                        style={[styles.smallAction, { borderColor: theme.glassBorder }]}
                      >
                        <Archive size={scale(14)} color={theme.accentText} />
                        <Text style={[styles.smallActionText, { color: theme.accentText }]}>
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
                </GlassPanel>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <GlassActionButton
          disabled={!selectedSlot || isBusy}
          highlighted
          icon={<Play color={theme.title} size={scale(22)} />}
          onPress={() => {
            void primaryAction();
          }}
          subtitle={
            !selectedSlot
              ? 'Select a slot first'
              : selectedCard?.hasData
                ? 'Validate and continue your current life'
                : 'Create a new life in this slot'
          }
          title={selectedCard?.hasData ? 'Continue Game' : 'Start New Game'}
        />
      </OnboardingScreenShell>

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
  heroPanel: {
    marginBottom: responsiveSpacing.md,
  },
  heroTitle: {
    fontSize: fontScale(20),
    fontWeight: '800',
    marginBottom: verticalScale(4),
  },
  heroSubtitle: {
    fontSize: fontScale(12),
    fontWeight: '500',
    lineHeight: fontScale(16),
  },
  scrollContent: {
    gap: responsiveSpacing.md,
    paddingBottom: responsiveSpacing.md,
  },
  slotCard: {
    paddingVertical: responsiveSpacing.md,
  },
  slotCardSelected: {
    borderWidth: 1.6,
  },
  slotHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: verticalScale(8),
  },
  slotTitle: {
    fontSize: fontScale(18),
    fontWeight: '800',
  },
  statusChip: {
    backgroundColor: 'rgba(15, 23, 42, 0.35)',
    borderRadius: responsiveBorderRadius.full,
    fontSize: fontScale(11),
    fontWeight: '700',
    overflow: 'hidden',
    paddingHorizontal: responsiveSpacing.sm,
    paddingVertical: verticalScale(4),
  },
  slotName: {
    fontSize: fontScale(13),
    fontWeight: '500',
    marginBottom: verticalScale(10),
  },
  statsRow: {
    flexDirection: 'row',
    gap: responsiveSpacing.sm,
    marginBottom: verticalScale(10),
  },
  statBlock: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: responsiveBorderRadius.md,
    flex: 1,
    paddingHorizontal: responsiveSpacing.sm,
    paddingVertical: verticalScale(8),
  },
  statLabel: {
    fontSize: fontScale(10),
    fontWeight: '600',
    marginBottom: verticalScale(2),
  },
  statValue: {
    fontSize: fontScale(12),
    fontWeight: '800',
  },
  slotActions: {
    flexDirection: 'row',
    gap: responsiveSpacing.sm,
  },
  smallAction: {
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.25)',
    borderRadius: responsiveBorderRadius.md,
    borderWidth: 1,
    flex: 1,
    flexDirection: 'row',
    gap: responsiveSpacing.xs,
    justifyContent: 'center',
    paddingVertical: verticalScale(8),
  },
  smallActionText: {
    fontSize: fontScale(11),
    fontWeight: '700',
  },
  deleteAction: {
    borderColor: 'rgba(248, 113, 113, 0.4)',
  },
  deleteText: {
    color: '#F87171',
    fontSize: fontScale(11),
    fontWeight: '700',
  },
});
