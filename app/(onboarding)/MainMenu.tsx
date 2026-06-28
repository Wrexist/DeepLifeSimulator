import React, { useCallback, useEffect, useRef, useState, lazy, Suspense } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { lazyAsyncStorage as AsyncStorage } from '@/utils/storageWrapper';
import { Play, Rocket, Save, Settings, Star } from 'lucide-react-native';
// SettingsModal eagerly pulls in DevToolsModal + several heavy modals. Nothing
// imports MainMenu (so this isn't a require cycle) — but a failed module-eval of
// that heavy graph in the production Hermes bytecode left MainMenu's own default
// export `undefined` ("Element type is invalid" when the navigator renders it).
// Lazy-load it so its graph is NOT part of MainMenu's module init; it only loads
// when the user actually opens Settings.
const SettingsModal = lazy(() => import('@/components/SettingsModal'));
import GlassActionButton from '@/components/onboarding/GlassActionButton';
import OnboardingScreenShell from '@/components/onboarding/OnboardingScreenShell';
import MainMenuHeader from '@/components/onboarding/MainMenuHeader';
import MainMenuTitle from '@/components/onboarding/MainMenuTitle';
import MainMenuStatsBar from '@/components/onboarding/MainMenuStatsBar';
// Leaf contexts (NOT the @/contexts/GameContext barrel): the barrel does
// `export * from './game'` which eagerly pulls the entire provider graph
// (GameProvider + all 9 contexts incl. the 4000-line GameActionsContext) into
// this screen's module init — a require cycle that left this screen's default
// export `undefined` in the production Hermes bundle ("Element type is invalid").
import { useGameActions } from '@/contexts/game/GameActionsContext';
import { useTranslation } from '@/hooks/useTranslation';
import { accent } from '@/lib/config/theme';
import {
  hasSaveStateShape,
  hasMeaningfulSaveData,
  findFirstEmptySlot,
  summarizeSaveForMenu,
  type MainMenuSaveSummary,
} from '@/src/features/onboarding/saveSlotHelpers';
import { useOnboarding } from '@/src/features/onboarding/OnboardingContext';
import { logOnboardingStepView } from '@/src/features/onboarding/onboardingAnalytics';
import { logger } from '@/utils/logger';
import { validateGameEntry } from '@/utils/gameEntryValidation';
import { responsiveSpacing, scale } from '@/utils/scaling';

const MAIN_MENU_BACKGROUNDS = [
  require('@/assets/images/Main_Menu.png'),
  require('@/assets/images/Main_Menu_2.png'),
  require('@/assets/images/Main_Menu_3.png'),
];

export default function MainMenu() {
  const log = logger.scope('MainMenu');
  const router = useRouter();
  const { loadGame } = useGameActions();
  const { setState: setOnboardingState } = useOnboarding();
  const { t } = useTranslation();
  const [hasSave, setHasSave] = useState(false);
  const [saveSummary, setSaveSummary] = useState<MainMenuSaveSummary | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [continuing, setContinuing] = useState(false);
  const continueInFlightRef = useRef(false);
  const [selectedBackground] = useState(
    () => MAIN_MENU_BACKGROUNDS[Math.floor(Math.random() * MAIN_MENU_BACKGROUNDS.length)]
  );

  useEffect(() => {
    logOnboardingStepView('MainMenu');
  }, []);

  const refreshHasSaveState = useCallback(async () => {
    const clear = () => {
      setHasSave(false);
      setSaveSummary(null);
    };
    try {
      const lastSlot = await AsyncStorage.getItem('lastSlot');
      if (!lastSlot) {
        clear();
        return;
      }

      const slotNumber = parseInt(lastSlot, 10);
      if (isNaN(slotNumber) || slotNumber < 1 || slotNumber > 3) {
        clear();
        return;
      }

      const { readSaveSlot, decodePersistedSaveEnvelope, shouldAllowUnsignedLegacySaves } = await import(
        '@/utils/saveValidation'
      );
      const allowLegacy = shouldAllowUnsignedLegacySaves();
      const saveData = await readSaveSlot(slotNumber, undefined, { allowLegacy });
      if (!saveData) {
        clear();
        return;
      }

      const decoded = decodePersistedSaveEnvelope(saveData, { allowLegacy });
      if (!decoded.valid || typeof decoded.data !== 'string') {
        clear();
        return;
      }

      const parsedGameState = JSON.parse(decoded.data);
      if (!hasSaveStateShape(parsedGameState)) {
        clear();
        return;
      }

      const meaningful = hasMeaningfulSaveData(parsedGameState);
      setHasSave(meaningful);
      setSaveSummary(meaningful ? summarizeSaveForMenu(parsedGameState) : null);
    } catch (error) {
      log.error('Error checking save state', error);
      clear();
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

  const continueGame = () => {
    if (continueInFlightRef.current) return;
    continueInFlightRef.current = true;
    setContinuing(true);
    // Defer the heavy loadGame() (JSON parse + validate + migrate) to the next
    // frame so the button's loading spinner paints before it blocks the JS thread.
    requestAnimationFrame(() => {
      void runContinue();
    });
  };

  const runContinue = async () => {
    let navigating = false;
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

      navigating = true;
      setTimeout(() => {
        log.info('Game entry validation passed, navigating to gameplay', {
          slot: slotNumber,
          version: loadedState.version,
        });
        router.replace('/(tabs)/home');
      }, 100);
    } catch (error) {
      log.error('Error in continueGame:', error);
      Alert.alert('Load Error', 'An error occurred while loading your game. Please try again or start a new game.', [
        { text: 'OK' },
      ]);
    } finally {
      // Release the guard; re-enable the button only if we're not navigating away
      // (on success we keep it disabled to avoid a setState-after-unmount warning).
      continueInFlightRef.current = false;
      if (!navigating) setContinuing(false);
    }
  };

  const startNew = async () => {
    try {
      // Always target the first EMPTY slot. Previously a new life inherited the
      // default slot (1) and could silently overwrite an existing save — tapping
      // "New Game" with a game already in slot 1 clobbered it with no warning.
      // Auto-picking the first free slot keeps brand-new players friction-free
      // (they land in slot 1) while protecting returning players' saves.
      const targetSlot = await findFirstEmptySlot();
      if (targetSlot === null) {
        Alert.alert(
          'All Save Slots Full',
          'You cannot create a new game because all 3 save slots are full. Please delete a save slot first to make room for a new game.',
          [{ text: 'OK' }]
        );
        return;
      }

      setOnboardingState((prev) => ({ ...prev, slot: targetSlot }));

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
        scrollable
        header={
          hasSave && saveSummary ? (
            <MainMenuHeader
              greeting={t('mainMenu.greeting')}
              name={saveSummary.name}
              level={saveSummary.level}
              xpProgress={saveSummary.xpProgress}
              xpCurrent={saveSummary.xpCurrent}
              xpMax={saveSummary.xpMax}
              gems={saveSummary.gems}
              onSettings={() => setShowSettings(true)}
            />
          ) : undefined
        }
      >
        <MainMenuTitle primary="DEEP" secondary="LIFE SIMULATOR" tagline={t('mainMenu.tagline')} />

        <View style={styles.menuSection}>
          {hasSave ? (
            <GlassActionButton
              highlighted
              accentColor={CARD_ACCENTS.continue}
              icon={<Play color={CARD_ACCENTS.continue} size={scale(24)} />}
              title={t('mainMenu.continue')}
              subtitle={t('mainMenu.continueSubtitle')}
              onPress={continueGame}
              loading={continuing}
            />
          ) : null}

          <GlassActionButton
            highlighted={!hasSave}
            accentColor={CARD_ACCENTS.newGame}
            icon={<Rocket color={CARD_ACCENTS.newGame} size={scale(24)} />}
            title={t('mainMenu.newGame')}
            subtitle={t('mainMenu.newGameSubtitle')}
            onPress={startNew}
          />

          <GlassActionButton
            accentColor={CARD_ACCENTS.saveSlots}
            icon={<Save color={CARD_ACCENTS.saveSlots} size={scale(24)} />}
            title={t('mainMenu.saveSlots')}
            subtitle={t('mainMenu.saveSlotsSubtitle')}
            onPress={() => router.push('/(onboarding)/SaveSlots')}
          />

          <GlassActionButton
            accentColor={CARD_ACCENTS.settings}
            icon={<Settings color={CARD_ACCENTS.settings} size={scale(24)} />}
            title={t('mainMenu.settings')}
            subtitle={t('mainMenu.settingsSubtitle')}
            onPress={() => setShowSettings(true)}
          />
        </View>

        {!hasSave ? (
          <GlassActionButton
            highlighted
            accentColor={accent.gold}
            icon={<Star color={accent.gold} size={scale(24)} />}
            title={t('mainMenu.ctaTitle')}
            subtitle={t('mainMenu.ctaSubtitle')}
            onPress={startNew}
          />
        ) : null}

        {hasSave && saveSummary ? (
          <MainMenuStatsBar
            day={saveSummary.day}
            happiness={saveSummary.happiness}
            skills={saveSummary.skills}
            cash={saveSummary.cash}
            labels={{
              day: t('mainMenu.statDay'),
              happiness: t('mainMenu.statHappiness'),
              skills: t('mainMenu.statSkills'),
              cash: t('mainMenu.statCash'),
            }}
          />
        ) : null}
      </OnboardingScreenShell>

      {showSettings && (
        <Suspense fallback={null}>
          <SettingsModal visible={showSettings} onClose={() => setShowSettings(false)} />
        </Suspense>
      )}
    </>
  );
}

/** Color-coded accents for each main-menu card (matches the mockup). */
const CARD_ACCENTS = {
  continue: '#34D399', // green
  newGame: '#60A5FA', // blue
  saveSlots: '#A855F7', // purple
  settings: '#2DD4BF', // teal
} as const;

const styles = StyleSheet.create({
  menuSection: {
    width: '100%',
    paddingBottom: responsiveSpacing.md,
  },
});
