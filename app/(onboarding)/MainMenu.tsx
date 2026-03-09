import React, { useCallback, useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Play, Plus, Save, Settings } from 'lucide-react-native';
import SettingsModal from '@/components/SettingsModal';
import GlassActionButton from '@/components/onboarding/GlassActionButton';
import OnboardingScreenShell from '@/components/onboarding/OnboardingScreenShell';
import { useGame } from '@/contexts/GameContext';
import { useTranslation } from '@/hooks/useTranslation';
import { getOnboardingTheme } from '@/lib/config/onboardingTheme';
import { logger } from '@/utils/logger';
import { validateGameEntry } from '@/utils/gameEntryValidation';
import { fontScale, responsiveBorderRadius, responsiveSpacing, scale, verticalScale } from '@/utils/scaling';

type SaveSlotSnapshot = {
  weeksLived?: number;
  stats?: { money?: number };
  userProfile?: { firstName?: string; lastName?: string };
  achievements?: { completed?: boolean }[];
  relationships?: unknown[];
  items?: { owned?: boolean }[];
};

const MAIN_MENU_BACKGROUNDS = [
  require('@/assets/images/Main_Menu.png'),
  require('@/assets/images/Main_Menu_2.png'),
  require('@/assets/images/Main_Menu_3.png'),
];

const hasSaveStateShape = (state: unknown): state is SaveSlotSnapshot => {
  if (!state || typeof state !== 'object') return false;
  const candidate = state as Record<string, unknown>;
  return (
    typeof candidate.userProfile === 'object' &&
    candidate.userProfile !== null &&
    typeof candidate.stats === 'object' &&
    candidate.stats !== null
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

export default function MainMenu() {
  const log = logger.scope('MainMenu');
  const router = useRouter();
  const { loadGame, gameState } = useGame();
  const { t } = useTranslation();
  const [hasSave, setHasSave] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [selectedBackground] = useState(
    () => MAIN_MENU_BACKGROUNDS[Math.floor(Math.random() * MAIN_MENU_BACKGROUNDS.length)]
  );

  const isDarkMode = Boolean(gameState?.settings?.darkMode);
  const onboardingTheme = getOnboardingTheme(isDarkMode);

  const refreshHasSaveState = useCallback(async () => {
    try {
      const lastSlot = await AsyncStorage.getItem('lastSlot');
      if (!lastSlot) {
        setHasSave(false);
        return;
      }

      const slotNumber = parseInt(lastSlot, 10);
      if (isNaN(slotNumber) || slotNumber < 1 || slotNumber > 3) {
        setHasSave(false);
        return;
      }

      const { readSaveSlot, decodePersistedSaveEnvelope, shouldAllowUnsignedLegacySaves } = await import(
        '@/utils/saveValidation'
      );
      const allowLegacy = shouldAllowUnsignedLegacySaves();
      const saveData = await readSaveSlot(slotNumber, undefined, { allowLegacy });
      if (!saveData) {
        setHasSave(false);
        return;
      }

      const decoded = decodePersistedSaveEnvelope(saveData, { allowLegacy });
      if (!decoded.valid || typeof decoded.data !== 'string') {
        setHasSave(false);
        return;
      }

      const parsedGameState = JSON.parse(decoded.data);
      if (!hasSaveStateShape(parsedGameState)) {
        setHasSave(false);
        return;
      }

      setHasSave(hasMeaningfulSaveData(parsedGameState));
    } catch (error) {
      log.error('Error checking save state', error);
      setHasSave(false);
    }
  }, [log]);

  useEffect(() => {
    void refreshHasSaveState();
  }, [refreshHasSaveState]);

  useFocusEffect(
    useCallback(() => {
      void refreshHasSaveState();
    }, [refreshHasSaveState])
  );

  const continueGame = async () => {
    try {
      const lastSlot = await AsyncStorage.getItem('lastSlot');
      if (!lastSlot) {
        log.error('No lastSlot found when trying to continue');
        Alert.alert('No Save Found', 'No save game found. Please start a new game.', [{ text: 'OK' }]);
        return;
      }

      const slotNumber = parseInt(lastSlot, 10);
      if (isNaN(slotNumber) || slotNumber < 1 || slotNumber > 3) {
        log.error('Invalid lastSlot value:', lastSlot);
        Alert.alert(
          'Invalid Save Slot',
          'The save slot information is invalid. Please select a save slot from the Save Slots menu.',
          [{ text: 'OK' }]
        );
        return;
      }

      let loadedState;
      try {
        loadedState = await loadGame(slotNumber);
      } catch (loadError) {
        log.error('loadGame threw an error:', loadError);
        Alert.alert('Load Error', 'An error occurred while loading your game. Please try again or start a new game.', [
          { text: 'OK' },
        ]);
        return;
      }

      if (!loadedState) {
        log.error('loadGame returned null - no save data found');
        Alert.alert('No Save Found', 'No save data found. Please try loading from Save Slots or start a new game.', [
          { text: 'OK' },
        ]);
        return;
      }

      const validation = validateGameEntry(loadedState);
      if (!validation.canEnter) {
        log.error('Game entry validation failed', {
          reason: validation.reason,
          errors: validation.errors,
          warnings: validation.warnings,
          versionCompatible: validation.versionCompatible,
          stateComplete: validation.stateComplete,
          slot: slotNumber,
          version: loadedState.version,
        });

        if (!validation.versionCompatible) {
          const versionError =
            validation.errors.find((e) => e.includes('version')) ||
            `This save is from version ${loadedState.version || 'unknown'}, which is incompatible with the current game version.`;
          Alert.alert('Version Incompatible', `${versionError}\n\nPlease update the game or start a new game.`, [
            { text: 'OK' },
          ]);
        } else if (!validation.stateComplete) {
          Alert.alert(
            'Incomplete Save',
            validation.errors[0] ||
              'Your save file is incomplete and cannot be loaded. Please try loading from a backup or start a new game.',
            [{ text: 'OK' }]
          );
        } else {
          Alert.alert(
            'Invalid Save',
            validation.errors[0] ||
              'Your save file is invalid and cannot be loaded. Please try loading from a backup or start a new game.',
            [{ text: 'OK' }]
          );
        }
        return;
      }

      if (validation.warnings.length > 0) {
        log.warn('Game entry validation warnings', {
          warnings: validation.warnings,
          slot: slotNumber,
        });
      }

      setTimeout(() => {
        log.info('Game entry validation passed, navigating to gameplay', {
          slot: slotNumber,
          version: loadedState.version,
        });
        router.replace('/(tabs)');
      }, 100);
    } catch (error) {
      log.error('Error in continueGame:', error);
      Alert.alert('Load Error', 'An error occurred while loading your game. Please try again or start a new game.', [
        { text: 'OK' },
      ]);
    }
  };

  const checkIfAllSlotsFull = async (): Promise<boolean> => {
    try {
      const { readSaveSlot, decodePersistedSaveEnvelope, shouldAllowUnsignedLegacySaves } = await import(
        '@/utils/saveValidation'
      );
      const allowLegacy = shouldAllowUnsignedLegacySaves();
      let fullSlots = 0;
      for (let i = 1; i <= 3; i++) {
        const data = await readSaveSlot(i, undefined, { allowLegacy });
        if (data) {
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
      }
      return fullSlots >= 3;
    } catch (error) {
      log.error('Error checking save slots:', error);
      return false;
    }
  };

  const startNew = async () => {
    try {
      const allSlotsFull = await checkIfAllSlotsFull();
      if (allSlotsFull) {
        Alert.alert(
          'All Save Slots Full',
          'You cannot create a new game because all 3 save slots are full. Please delete a save slot first to make room for a new game.',
          [{ text: 'OK' }]
        );
        return;
      }

      if (router && typeof router.push === 'function') {
        router.push('/(onboarding)/Scenarios');
      } else {
        log.error('Router not available for navigation');
        Alert.alert('Navigation Error', 'Unable to start a new game. Please try again.', [{ text: 'OK' }]);
      }
    } catch (error) {
      log.error('Error starting new game:', error);
      Alert.alert('Error', 'An error occurred while starting a new game. Please try again.', [{ text: 'OK' }]);
    }
  };

  return (
    <>
      <OnboardingScreenShell
        backgroundSource={selectedBackground}
        footer={
          <View style={[styles.footerPill, { borderColor: onboardingTheme.glassBorder }]}>
            <Text style={[styles.footerText, { color: onboardingTheme.subtitle }]}>
              {hasSave ? 'Saved progress detected' : 'Create your first life story'}
            </Text>
          </View>
        }
      >
        <View
          style={[
            styles.heroCard,
            {
              borderColor: onboardingTheme.glassBorder,
              backgroundColor: isDarkMode ? 'rgba(15, 23, 42, 0.42)' : 'rgba(255, 255, 255, 0.36)',
            },
          ]}
        >
          <View style={[styles.heroHighlight, { backgroundColor: onboardingTheme.glassHighlight }]} />
          <Text style={[styles.eyebrow, { color: onboardingTheme.eyebrow }]}>DEEP LIFE SIMULATOR</Text>
          <Text style={[styles.heroTitle, { color: onboardingTheme.title }]}>Build a life worth remembering</Text>
          <Text style={[styles.heroSubtitle, { color: onboardingTheme.subtitle }]}>
            {hasSave
              ? 'Continue your journey instantly, or create a brand-new path with fresh choices.'
              : 'Start a new life in minutes with guided setup and polished onboarding.'}
          </Text>
        </View>

        <View style={styles.menuSection}>
          {hasSave ? (
            <GlassActionButton
              highlighted
              icon={<Play color={onboardingTheme.title} size={scale(24)} />}
              title={t('mainMenu.continue')}
              subtitle={t('mainMenu.continueSubtitle')}
              onPress={continueGame}
            />
          ) : null}

          <GlassActionButton
            highlighted={!hasSave}
            icon={<Plus color={onboardingTheme.title} size={scale(24)} />}
            title={t('mainMenu.newGame')}
            subtitle={t('mainMenu.newGameSubtitle')}
            onPress={startNew}
          />

          <GlassActionButton
            icon={<Save color={onboardingTheme.title} size={scale(24)} />}
            title={t('mainMenu.saveSlots')}
            subtitle={t('mainMenu.saveSlotsSubtitle')}
            onPress={() => router.push('/(onboarding)/SaveSlots')}
          />

          <GlassActionButton
            icon={<Settings color={onboardingTheme.title} size={scale(24)} />}
            title={t('mainMenu.settings')}
            subtitle={t('mainMenu.settingsSubtitle')}
            onPress={() => setShowSettings(true)}
          />
        </View>
      </OnboardingScreenShell>

      <SettingsModal visible={showSettings} onClose={() => setShowSettings(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  heroCard: {
    borderRadius: responsiveBorderRadius['2xl'],
    borderWidth: 1.2,
    overflow: 'hidden',
    marginBottom: responsiveSpacing.lg,
    paddingVertical: verticalScale(18),
    paddingHorizontal: responsiveSpacing.lg,
  },
  heroHighlight: {
    position: 'absolute',
    left: scale(14),
    right: scale(14),
    top: 0,
    height: verticalScale(1),
  },
  eyebrow: {
    fontSize: fontScale(11),
    fontWeight: '700',
    letterSpacing: 1.2,
    marginBottom: verticalScale(8),
  },
  heroTitle: {
    fontSize: fontScale(28),
    fontWeight: '800',
    lineHeight: fontScale(32),
    marginBottom: verticalScale(8),
  },
  heroSubtitle: {
    fontSize: fontScale(13),
    fontWeight: '500',
    lineHeight: fontScale(18),
  },
  menuSection: {
    width: '100%',
    paddingBottom: responsiveSpacing.md,
  },
  footerPill: {
    borderWidth: 1,
    borderRadius: responsiveBorderRadius.full,
    backgroundColor: 'rgba(15, 23, 42, 0.3)',
    paddingHorizontal: responsiveSpacing.md,
    paddingVertical: verticalScale(6),
  },
  footerText: {
    fontSize: fontScale(11),
    fontWeight: '600',
  },
});
