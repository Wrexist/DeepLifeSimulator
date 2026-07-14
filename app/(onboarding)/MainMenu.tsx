import React, { useCallback, useEffect, useRef, useState, lazy, Suspense } from 'react';
import { Alert, Animated, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { lazyAsyncStorage as AsyncStorage } from '@/utils/storageWrapper';
import { Play, Plus, Save, Settings } from 'lucide-react-native';
import GlassActionButton from '@/components/onboarding/GlassActionButton';
// Leaf contexts (NOT the @/contexts/GameContext barrel): the barrel does
// `export * from './game'` which eagerly pulls the entire provider graph
// (GameProvider + all 9 contexts incl. the 4000-line GameActionsContext) into
// this screen's module init — a require cycle that left this screen's default
// export `undefined` in the production Hermes bundle ("Element type is invalid").
import { useGameSelector } from '@/contexts/game/useGameSelector';
import { useGameActions } from '@/contexts/game/GameActionsContext';
import { useOnboardingScreenAnimation } from '@/hooks/useOnboardingScreenAnimation';
import { useTranslation } from '@/hooks/useTranslation';
import { getOnboardingTheme } from '@/lib/config/onboardingTheme';
import { hasSaveStateShape, hasMeaningfulSaveData, findFirstEmptySlot } from '@/src/features/onboarding/saveSlotHelpers';
import { useOnboarding } from '@/src/features/onboarding/OnboardingContext';
import { logOnboardingStepView } from '@/src/features/onboarding/onboardingAnalytics';
import { logger } from '@/utils/logger';
import { validateGameEntry } from '@/utils/gameEntryValidation';
import { fontScale, responsiveBorderRadius, responsiveSpacing, scale, verticalScale } from '@/utils/scaling';
import { haptic } from '@/utils/haptics';

// SettingsModal eagerly pulls in DevToolsModal + several heavy modals. Nothing
// imports MainMenu (so this isn't a require cycle) — but a failed module-eval of
// that heavy graph in the production Hermes bytecode left MainMenu's own default
// export `undefined` ("Element type is invalid" when the navigator renders it).
// Lazy-load it so its graph is NOT part of MainMenu's module init; it only loads
// when the user actually opens Settings.
const SettingsModal = lazy(() => import('@/components/SettingsModal'));

// A clean, premium deep-slate backdrop rendered in code (no baked-in wordmark,
// scattered icons, or silhouette) — those lived in the old Main_Menu.png art and
// read as noisy + clipped the title on some screens. The title is now crisp text
// that auto-fits, so it never clips.
const BG_GRADIENT = ['#0A0F1C', '#0E1526', '#080B14'] as const;
const BEAM_GRADIENT = ['rgba(96,165,250,0.20)', 'rgba(96,165,250,0.04)', 'transparent'] as const;

export default function MainMenu() {
  const log = logger.scope('MainMenu');
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { opacity, translateY } = useOnboardingScreenAnimation();
  const { loadGame } = useGameActions();
  const { setState: setOnboardingState } = useOnboarding();
  const { t } = useTranslation();
  const [hasSave, setHasSave] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [continuing, setContinuing] = useState(false);
  const continueInFlightRef = useRef(false);

  useEffect(() => {
    logOnboardingStepView('MainMenu');
  }, []);

  const isDarkMode = useGameSelector((s) => Boolean(s?.settings?.darkMode));
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

  const continueGame = () => {
    haptic.light();
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
    haptic.light();
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
      <View style={styles.root}>
        <LinearGradient colors={BG_GRADIENT} style={StyleSheet.absoluteFill} />
        {/* Soft top spotlight for depth — replaces the old baked light beam. */}
        <LinearGradient
          pointerEvents="none"
          colors={BEAM_GRADIENT}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={styles.beam}
        />

        <Animated.View
          style={[
            styles.content,
            {
              opacity,
              transform: [{ translateY }],
              paddingTop: insets.top + verticalScale(24),
              paddingBottom: insets.bottom + verticalScale(16),
            },
          ]}
        >
          {/* Hero wordmark — crisp text so it can never clip like the baked art did. */}
          <View style={styles.hero}>
            <Text style={styles.eyebrow}>LIVE A THOUSAND LIVES</Text>
            <Text style={styles.brandTop} numberOfLines={1} adjustsFontSizeToFit allowFontScaling={false}>
              DEEP LIFE
            </Text>
            <Text style={styles.brandBottom} numberOfLines={1} adjustsFontSizeToFit allowFontScaling={false}>
              SIMULATOR
            </Text>
          </View>

          <View style={styles.spacer} />

          <View style={styles.menuSection}>
            {hasSave ? (
              <GlassActionButton
                highlighted
                icon={<Play color={onboardingTheme.title} size={scale(24)} />}
                title={t('mainMenu.continue')}
                subtitle={t('mainMenu.continueSubtitle')}
                onPress={continueGame}
                loading={continuing}
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
              onPress={() => {
                haptic.light();
                router.push('/(onboarding)/SaveSlots');
              }}
            />

            <GlassActionButton
              icon={<Settings color={onboardingTheme.title} size={scale(24)} />}
              title={t('mainMenu.settings')}
              subtitle={t('mainMenu.settingsSubtitle')}
              onPress={() => {
                haptic.light();
                setShowSettings(true);
              }}
            />
          </View>

          <View style={styles.footer}>
            <View style={styles.footerPill}>
              <View style={[styles.footerDot, { backgroundColor: hasSave ? '#34D399' : '#60A5FA' }]} />
              <Text style={styles.footerText}>
                {hasSave ? 'Saved progress detected' : 'Create your first life story'}
              </Text>
            </View>
          </View>
        </Animated.View>
      </View>

      {showSettings && (
        <Suspense fallback={null}>
          <SettingsModal visible={showSettings} onClose={() => setShowSettings(false)} />
        </Suspense>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#080B14',
  },
  beam: {
    position: 'absolute',
    top: 0,
    left: '10%',
    right: '10%',
    height: verticalScale(360),
  },
  content: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: responsiveSpacing.lg,
  },
  hero: {
    alignItems: 'center',
    marginTop: verticalScale(36),
  },
  eyebrow: {
    color: '#60A5FA',
    fontSize: fontScale(12),
    fontWeight: '700',
    letterSpacing: scale(3),
    marginBottom: verticalScale(12),
  },
  brandTop: {
    color: '#F8FAFC',
    fontSize: fontScale(46),
    fontWeight: '900',
    letterSpacing: scale(1),
    textAlign: 'center',
  },
  brandBottom: {
    color: '#94A3B8',
    fontSize: fontScale(22),
    fontWeight: '600',
    letterSpacing: scale(8),
    textAlign: 'center',
    marginTop: verticalScale(2),
  },
  spacer: {
    flex: 1,
    minHeight: verticalScale(24),
  },
  menuSection: {
    width: '100%',
  },
  footer: {
    marginTop: verticalScale(14),
    alignItems: 'center',
  },
  footerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(8),
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.25)',
    borderRadius: responsiveBorderRadius.full,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    paddingHorizontal: responsiveSpacing.md,
    paddingVertical: verticalScale(7),
  },
  footerDot: {
    width: scale(7),
    height: scale(7),
    borderRadius: scale(4),
  },
  footerText: {
    fontSize: fontScale(11),
    fontWeight: '600',
    color: '#94A3B8',
  },
});
