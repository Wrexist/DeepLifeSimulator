import React, { useCallback, useEffect, useRef, useState, lazy, Suspense } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import LinearGradientFallback from '@/components/fallbacks/LinearGradientFallback';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { lazyAsyncStorage as AsyncStorage } from '@/utils/storageWrapper';
import { ChevronRight, Play, Plus, Save, Settings } from 'lucide-react-native';
// Leaf contexts (NOT the @/contexts/GameContext barrel): the barrel does
// `export * from './game'` which eagerly pulls the entire provider graph
// (GameProvider + all 9 contexts incl. the 4000-line GameActionsContext) into
// this screen's module init — a require cycle that left this screen's default
// export `undefined` in the production Hermes bundle ("Element type is invalid").
import { useGameActions } from '@/contexts/game/GameActionsContext';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { useTranslation } from '@/hooks/useTranslation';
import { hasSaveStateShape, hasMeaningfulSaveData, findFirstEmptySlot } from '@/src/features/onboarding/saveSlotHelpers';
import { useOnboarding } from '@/src/features/onboarding/OnboardingContext';
import { logOnboardingStepView } from '@/src/features/onboarding/onboardingAnalytics';
import { logger } from '@/utils/logger';
import { validateGameEntry } from '@/utils/gameEntryValidation';
import { getPlatformShadows } from '@/utils/glassmorphismStyles';
import { formatMoney } from '@/utils/moneyFormatting';
import { fontScale, responsiveBorderRadius, responsiveSpacing, scale, verticalScale } from '@/utils/scaling';
import { haptic } from '@/utils/haptics';

// SettingsModal eagerly pulls in DevToolsModal + several heavy modals. Nothing
// imports MainMenu (so this isn't a require cycle) — but a failed module-eval of
// that heavy graph in the production Hermes bytecode left MainMenu's own default
// export `undefined` ("Element type is invalid" when the navigator renders it).
// Lazy-load it so its graph is NOT part of MainMenu's module init; it only loads
// when the user actually opens Settings.
const SettingsModal = lazy(() => import('@/components/SettingsModal'));

// expo-linear-gradient is a TurboModule that has crashed on iOS 26. The rest of
// the app aliases this safe View-based fallback (home.tsx, TopStatsBar, …); the
// main menu is the FIRST screen, so a direct native import here could crash users
// before they ever reach the menu. Use the same fallback.
const LinearGradient = LinearGradientFallback;

// Near-black base matched to the in-game home screen (#020617) so the menu reads
// as one aesthetic with the game — not a lighter, generic pre-game panel. A soft
// blue glow at the top gives depth without a solid panel block.
const PAGE_BG = '#020617';
const TOP_GLOW = ['rgba(59, 130, 246, 0.12)', 'rgba(59, 130, 246, 0)'] as const;
const BOTTOM_SHADE = ['rgba(2, 6, 23, 0)', 'rgba(2, 6, 23, 0.6)'] as const;
// The game's primary-CTA gradient (shared with the onboarding floating button and
// the in-game "next week" button). Reused here so the primary action feels native.
const PRIMARY_GRADIENT = ['#60A5FA', '#3B82F6', '#2563EB'] as const;

interface SaveSummary {
  name: string;
  age: number;
  money: number;
}

/**
 * Staggered entrance wrapper — opacity + a short translateY rise, native-driven,
 * ease-out, no bounce. Honors the OS "Reduce Motion" setting by rendering static.
 */
function RevealItem({
  index,
  reduced,
  children,
}: {
  index: number;
  reduced: boolean;
  children: React.ReactNode;
}) {
  const progress = useRef(new Animated.Value(reduced ? 1 : 0)).current;

  useEffect(() => {
    if (reduced) {
      progress.setValue(1);
      return;
    }
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: 240,
      delay: index * 55,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [index, reduced, progress]);

  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [10, 0] });
  return <Animated.View style={{ opacity: progress, transform: [{ translateY }] }}>{children}</Animated.View>;
}

/**
 * Primary action card — the one high-emphasis choice (Continue when a save
 * exists, otherwise New Game). Blue gradient fill in the game's CTA style.
 */
function PrimaryActionCard({
  icon: Icon,
  title,
  subtitle,
  onPress,
  loading = false,
  badge,
}: {
  icon: React.ComponentType<{ size?: number; color?: string }>;
  title: string;
  subtitle: string;
  onPress: () => void;
  loading?: boolean;
  badge?: React.ReactNode;
}) {
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={subtitle}
      activeOpacity={0.9}
      disabled={loading}
      onPress={onPress}
      style={styles.primaryTouchable}
    >
      <LinearGradient colors={PRIMARY_GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.primaryCard}>
        <View style={styles.primaryIconChip}>
          {loading ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Icon size={scale(24)} color="#FFFFFF" />}
        </View>
        <View style={styles.primaryTextWrap}>
          {badge}
          <Text style={styles.primaryTitle} numberOfLines={1}>
            {loading ? 'Loading…' : title}
          </Text>
          <Text style={styles.primarySubtitle} numberOfLines={1}>
            {loading ? 'Please wait' : subtitle}
          </Text>
        </View>
        {loading ? null : <ChevronRight size={scale(22)} color="rgba(255, 255, 255, 0.9)" />}
      </LinearGradient>
    </TouchableOpacity>
  );
}

/** Secondary action card — dark surface + tinted icon chip. Clearly below the
 *  primary in emphasis, clearly above the quiet tertiary tiles. */
function SecondaryActionCard({
  icon: Icon,
  title,
  subtitle,
  onPress,
}: {
  icon: React.ComponentType<{ size?: number; color?: string }>;
  title: string;
  subtitle: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={subtitle}
      activeOpacity={0.85}
      onPress={onPress}
      style={styles.secondaryCard}
    >
      <View style={styles.secondaryIconChip}>
        <Icon size={scale(22)} color="#60A5FA" />
      </View>
      <View style={styles.secondaryTextWrap}>
        <Text style={styles.secondaryTitle} numberOfLines={1}>
          {title}
        </Text>
        <Text style={styles.secondarySubtitle} numberOfLines={1}>
          {subtitle}
        </Text>
      </View>
      <ChevronRight size={scale(20)} color="#64748B" />
    </TouchableOpacity>
  );
}

/** Quiet tertiary tile — the low-frequency utilities (Save Slots / Settings)
 *  sit side by side so they never compete with the two real choices above. */
function TertiaryTile({
  icon: Icon,
  label,
  onPress,
}: {
  icon: React.ComponentType<{ size?: number; color?: string }>;
  label: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={label}
      activeOpacity={0.85}
      onPress={onPress}
      style={styles.tertiaryTile}
    >
      <Icon size={scale(18)} color="#94A3B8" />
      <Text style={styles.tertiaryLabel} numberOfLines={1}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

export default function MainMenu() {
  const log = logger.scope('MainMenu');
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const { loadGame } = useGameActions();
  const { setState: setOnboardingState } = useOnboarding();
  const { t } = useTranslation();
  const [hasSave, setHasSave] = useState(false);
  const [saveSummary, setSaveSummary] = useState<SaveSummary | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [continuing, setContinuing] = useState(false);
  const continueInFlightRef = useRef(false);

  useEffect(() => {
    logOnboardingStepView('MainMenu');
  }, []);

  const refreshHasSaveState = useCallback(async () => {
    try {
      const lastSlot = await AsyncStorage.getItem('lastSlot');
      if (!lastSlot) {
        setHasSave(false);
        setSaveSummary(null);
        return;
      }

      const slotNumber = parseInt(lastSlot, 10);
      if (isNaN(slotNumber) || slotNumber < 1 || slotNumber > 3) {
        setHasSave(false);
        setSaveSummary(null);
        return;
      }

      const { readSaveSlot, decodePersistedSaveEnvelope, shouldAllowUnsignedLegacySaves } = await import(
        '@/utils/saveValidation'
      );
      const allowLegacy = shouldAllowUnsignedLegacySaves();
      const saveData = await readSaveSlot(slotNumber, undefined, { allowLegacy });
      if (!saveData) {
        setHasSave(false);
        setSaveSummary(null);
        return;
      }

      const decoded = decodePersistedSaveEnvelope(saveData, { allowLegacy });
      if (!decoded.valid || typeof decoded.data !== 'string') {
        setHasSave(false);
        setSaveSummary(null);
        return;
      }

      const parsedGameState = JSON.parse(decoded.data);
      if (!hasSaveStateShape(parsedGameState)) {
        setHasSave(false);
        setSaveSummary(null);
        return;
      }

      const meaningful = hasMeaningfulSaveData(parsedGameState);
      setHasSave(meaningful);
      if (meaningful) {
        // Surface a compact summary of the last life inside the Continue card so
        // it carries real context instead of a generic "Saved progress" pill.
        const name = `${parsedGameState.userProfile?.firstName || ''} ${parsedGameState.userProfile?.lastName || ''}`.trim();
        // Raw persisted JSON — the save-repair pipeline hasn't run here, so a
        // corrupt snapshot can carry NaN/Infinity/negative numbers. Clamp the
        // summary figures rather than rendering garbage on the Continue card.
        const rawAge = parsedGameState.date?.age;
        const rawMoney = parsedGameState.stats?.money;
        setSaveSummary({
          name,
          age: typeof rawAge === 'number' && Number.isFinite(rawAge) ? Math.max(0, Math.floor(rawAge)) : 0,
          money: typeof rawMoney === 'number' && Number.isFinite(rawMoney) ? Math.max(0, rawMoney) : 0,
        });
      } else {
        setSaveSummary(null);
      }
    } catch (error) {
      log.error('Error checking save state', error);
      setHasSave(false);
      setSaveSummary(null);
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

  // Compact one-line context for the Continue card (folds in the old floating
  // "Saved progress detected" pill).
  const continueSubtitle =
    saveSummary != null
      ? [saveSummary.name || 'Unnamed Character', `Age ${saveSummary.age}`, formatMoney(saveSummary.money)].join('  ·  ')
      : t('mainMenu.continueSubtitle');

  return (
    <>
      <View style={styles.root}>
        <LinearGradient pointerEvents="none" colors={TOP_GLOW} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }} style={styles.topGlow} />
        <LinearGradient pointerEvents="none" colors={BOTTOM_SHADE} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }} style={styles.bottomShade} />

        <View
          style={[
            styles.content,
            {
              paddingTop: insets.top + verticalScale(24),
              paddingBottom: insets.bottom + verticalScale(20),
            },
          ]}
        >
          {/* Brand block — crisp text on the dark base, no lighter panel. */}
          <RevealItem index={0} reduced={reduced}>
            <View style={styles.hero}>
              <Text style={styles.eyebrow}>LIVE A THOUSAND LIVES</Text>
              <Text style={styles.brandTop} numberOfLines={1} adjustsFontSizeToFit allowFontScaling={false}>
                DEEP LIFE
              </Text>
              <Text style={styles.brandBottom} numberOfLines={1} adjustsFontSizeToFit allowFontScaling={false}>
                SIMULATOR
              </Text>
            </View>
          </RevealItem>

          <View style={styles.spacer} />

          <View style={styles.menuSection}>
            {hasSave ? (
              <RevealItem index={1} reduced={reduced}>
                <PrimaryActionCard
                  icon={Play}
                  title={t('mainMenu.continue')}
                  subtitle={continueSubtitle}
                  onPress={continueGame}
                  loading={continuing}
                  badge={
                    <View style={styles.savedBadge}>
                      <View style={styles.savedDot} />
                      <Text style={styles.savedBadgeText}>SAVED PROGRESS</Text>
                    </View>
                  }
                />
              </RevealItem>
            ) : null}

            <RevealItem index={hasSave ? 2 : 1} reduced={reduced}>
              {hasSave ? (
                <SecondaryActionCard
                  icon={Plus}
                  title={t('mainMenu.newGame')}
                  subtitle={t('mainMenu.newGameSubtitle')}
                  onPress={startNew}
                />
              ) : (
                <PrimaryActionCard
                  icon={Plus}
                  title={t('mainMenu.newGame')}
                  subtitle={t('mainMenu.newGameSubtitle')}
                  onPress={startNew}
                />
              )}
            </RevealItem>

            <RevealItem index={hasSave ? 3 : 2} reduced={reduced}>
              <View style={styles.tertiaryRow}>
                <TertiaryTile
                  icon={Save}
                  label={t('mainMenu.saveSlots')}
                  onPress={() => {
                    haptic.light();
                    router.push('/(onboarding)/SaveSlots');
                  }}
                />
                <TertiaryTile
                  icon={Settings}
                  label={t('mainMenu.settings')}
                  onPress={() => {
                    haptic.light();
                    setShowSettings(true);
                  }}
                />
              </View>
            </RevealItem>
          </View>
        </View>
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
    backgroundColor: PAGE_BG,
  },
  topGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: verticalScale(340),
  },
  bottomShade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: verticalScale(240),
  },
  content: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: responsiveSpacing.lg,
  },
  hero: {
    alignItems: 'center',
    marginTop: verticalScale(40),
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

  // Primary action ------------------------------------------------------------
  primaryTouchable: {
    width: '100%',
    marginBottom: responsiveSpacing.md,
    borderRadius: responsiveBorderRadius.xl,
    ...getPlatformShadows(10, 0.35, 6, 18),
  },
  primaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: responsiveSpacing.md,
    borderRadius: responsiveBorderRadius.xl,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
    paddingVertical: verticalScale(18),
    paddingHorizontal: responsiveSpacing.lg,
  },
  primaryIconChip: {
    width: scale(48),
    height: scale(48),
    borderRadius: scale(14),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
  },
  primaryTextWrap: {
    flex: 1,
    justifyContent: 'center',
  },
  savedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(6),
    marginBottom: verticalScale(4),
  },
  savedDot: {
    width: scale(6),
    height: scale(6),
    borderRadius: scale(3),
    backgroundColor: '#6EE7B7',
  },
  savedBadgeText: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: fontScale(10),
    fontWeight: '700',
    letterSpacing: scale(1),
  },
  primaryTitle: {
    color: '#FFFFFF',
    fontSize: fontScale(20),
    fontWeight: '800',
    marginBottom: verticalScale(2),
  },
  primarySubtitle: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: fontScale(12.5),
    fontWeight: '500',
  },

  // Secondary action ----------------------------------------------------------
  secondaryCard: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: responsiveSpacing.md,
    marginBottom: responsiveSpacing.md,
    borderRadius: responsiveBorderRadius.xl,
    backgroundColor: 'rgba(30, 41, 59, 0.75)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    paddingVertical: verticalScale(15),
    paddingHorizontal: responsiveSpacing.lg,
    ...getPlatformShadows(6, 0.25, 4, 14),
  },
  secondaryIconChip: {
    width: scale(44),
    height: scale(44),
    borderRadius: scale(13),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(59, 130, 246, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.35)',
  },
  secondaryTextWrap: {
    flex: 1,
    justifyContent: 'center',
  },
  secondaryTitle: {
    color: '#F8FAFC',
    fontSize: fontScale(17),
    fontWeight: '700',
    marginBottom: verticalScale(2),
  },
  secondarySubtitle: {
    color: '#94A3B8',
    fontSize: fontScale(12),
    fontWeight: '500',
  },

  // Tertiary utilities --------------------------------------------------------
  tertiaryRow: {
    flexDirection: 'row',
    gap: responsiveSpacing.md,
  },
  tertiaryTile: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: scale(8),
    borderRadius: responsiveBorderRadius.lg,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    paddingVertical: verticalScale(14),
    paddingHorizontal: responsiveSpacing.md,
  },
  tertiaryLabel: {
    color: '#CBD5E1',
    fontSize: fontScale(13),
    fontWeight: '600',
  },
});
