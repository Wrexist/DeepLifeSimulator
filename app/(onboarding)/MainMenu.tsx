import React, { useCallback, useEffect, useMemo, useRef, useState, lazy, Suspense } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  Image,
  InteractionManager,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import Constants from 'expo-constants';
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
import { findFirstEmptySlot } from '@/src/features/onboarding/saveSlotHelpers';
import { readSaveSlotMeta, ensureSaveSlotMeta, type SaveSlotMeta } from '@/utils/saveSlotMeta';
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

// One flat, near-black base matched to the in-game home screen (#020617) so the
// menu reads as one aesthetic with the game. NO gradients: the app-wide
// LinearGradient fallback renders only the first color as a solid block (the
// native gradient TurboModule crashes on iOS 26), which turned the old "glow"
// into a hard seam and the CTA into a washed-out flat panel. Flat by design so
// it can never regress under that fallback.
const PAGE_BG = '#020617';

// Real installed app version, read the way the rest of the app does
// (utils/versionCheck.ts). Baked into expoConfig at build time — no fragile
// native call on this first screen. Falls back to the brand wordmark if absent.
const APP_VERSION = Constants.expoConfig?.version ?? null;

interface SaveSummary {
  name: string;
  age: number;
  money: number;
}

// Owner-generated background artwork (see docs/menu-background-prompts.md) —
// text-free, dark, composed for a quiet upper third. Metro needs literal
// require paths, so the set is static. One image per app launch, cycled in
// order via a tiny AsyncStorage counter; the flat #020617 base stays the
// instant first paint and the permanent fallback.
const MENU_BACKGROUNDS = [
  require('@/assets/images/Main_Menu/Mainmenu_1.png'),
  require('@/assets/images/Main_Menu/Mainmenu_2.png'),
  require('@/assets/images/Main_Menu/Mainmenu_4.png'),
  require('@/assets/images/Main_Menu/Mainmenu_5.png'),
] as const;
const MENU_BG_CYCLE_KEY = 'menu_bg_cycle_v1';

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
      duration: 200,
      delay: index * 45,
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
 * exists, otherwise New Game). Solid blue fill (no gradient — see PAGE_BG).
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
      <View style={styles.primaryCard}>
        <View style={styles.primaryIconChip}>
          {loading ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Icon size={scale(24)} color="#FFFFFF" />}
        </View>
        <View style={styles.primaryTextWrap}>
          {badge}
          <Text style={styles.primaryTitle} numberOfLines={1}>
            {loading ? 'Loading…' : title}
          </Text>
          <Text
            style={styles.primarySubtitle}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.75}
          >
            {loading ? 'Please wait' : subtitle}
          </Text>
        </View>
        {loading ? null : <ChevronRight size={scale(22)} color="rgba(255, 255, 255, 0.9)" />}
      </View>
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
  // Memoized so effects/callbacks that log can list it as a stable dependency.
  const log = useMemo(() => logger.scope('MainMenu'), []);
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
  // Guards setState after unmount for the deferred backfill below.
  const isMountedRef = useRef(true);
  // Handle for a scheduled one-time meta backfill so we can cancel it on blur.
  const backfillTaskRef = useRef<{ cancel: () => void } | null>(null);
  // Refresh generation: cancel() can't stop a backfill whose callback already
  // started, and this component stays mounted while blurred — so every refresh
  // (focus cycle) bumps this and async continuations from an older cycle check
  // it before touching state, ensuring a stale slot's result can never
  // overwrite the current Continue card.
  const refreshGenRef = useRef(0);
  // This launch's background (null until the cycle counter is read — the flat
  // base shows meanwhile, so first paint stays instant).
  const [bgIndex, setBgIndex] = useState<number | null>(null);
  const bgOpacity = useRef(new Animated.Value(0)).current;

  // Pick this launch's background and advance the cycle. Mount-only on purpose:
  // rotating on every focus would swap the artwork when returning from
  // SaveSlots/Settings, which reads as a glitch rather than variety.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      let index = 0;
      try {
        const raw = await AsyncStorage.getItem(MENU_BG_CYCLE_KEY);
        const n = raw != null ? parseInt(raw, 10) : 0;
        index = !Number.isNaN(n) && Number.isFinite(n) && n >= 0 ? n % MENU_BACKGROUNDS.length : 0;
      } catch (error) {
        log.warn('Failed to read menu background cycle (using first image)', { error });
        index = 0;
      }
      const nextValue = String((index + 1) % MENU_BACKGROUNDS.length);
      try {
        await AsyncStorage.setItem(MENU_BG_CYCLE_KEY, nextValue);
      } catch (error) {
        // Quota pressure: this key is a single digit, so clearing + rewriting it
        // is always safe. Anything else is non-critical — worst case the same
        // image shows again next launch.
        if (error instanceof Error && (error.name === 'QuotaExceededError' || error.message.includes('QuotaExceeded'))) {
          try {
            await AsyncStorage.removeItem(MENU_BG_CYCLE_KEY);
            await AsyncStorage.setItem(MENU_BG_CYCLE_KEY, nextValue);
          } catch (retryError) {
            log.warn('Failed to advance menu background cycle after quota cleanup', { error: retryError });
          }
        } else {
          log.warn('Failed to advance menu background cycle', { error });
        }
      }
      if (!cancelled) setBgIndex(index);
    })();
    return () => {
      cancelled = true;
    };
  }, [log]);

  const handleBgLoaded = useCallback(() => {
    if (reduced) {
      bgOpacity.setValue(1);
      return;
    }
    Animated.timing(bgOpacity, {
      toValue: 1,
      duration: 350,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [bgOpacity, reduced]);

  useEffect(() => {
    logOnboardingStepView('MainMenu');
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      backfillTaskRef.current?.cancel();
    };
  }, []);

  const applyMeta = useCallback((meta: SaveSlotMeta) => {
    if (!isMountedRef.current) return;
    setHasSave(true);
    // Name may be an empty string on a valid save — fall back at render time.
    setSaveSummary({ name: meta.name, age: meta.age, money: meta.money });
  }, []);

  const clearSave = useCallback(() => {
    if (!isMountedRef.current) return;
    setHasSave(false);
    setSaveSummary(null);
  }, []);

  const refreshHasSaveState = useCallback(async () => {
    const gen = ++refreshGenRef.current;
    const isCurrent = () => refreshGenRef.current === gen;
    try {
      const lastSlot = await AsyncStorage.getItem('lastSlot');
      if (!isCurrent()) return;
      if (!lastSlot) {
        clearSave();
        return;
      }

      const slotNumber = parseInt(lastSlot, 10);
      if (isNaN(slotNumber) || slotNumber < 1 || slotNumber > 3) {
        clearSave();
        return;
      }

      // Fast path: the per-slot summary cache is tiny — reading it never touches
      // the multi-MB blob, so the Continue card paints instantly.
      const meta = await readSaveSlotMeta(slotNumber);
      if (!isCurrent()) return;
      if (meta) {
        applyMeta(meta);
        return;
      }

      // Cold path (save written before this cache existed): defer the one-time
      // decode+parse backfill until AFTER interactions so it NEVER blocks first
      // paint or the entrance animations. Leave the current state untouched
      // meanwhile (initial state is already "no save", so nothing flashes).
      backfillTaskRef.current?.cancel();
      backfillTaskRef.current = InteractionManager.runAfterInteractions(() => {
        void (async () => {
          try {
            const backfilled = await ensureSaveSlotMeta(slotNumber);
            // Drop the result if the screen unmounted OR a newer focus cycle
            // started meanwhile (e.g. lastSlot changed via SaveSlots).
            if (!isMountedRef.current || !isCurrent()) return;
            if (backfilled) applyMeta(backfilled);
            else clearSave();
          } catch (error) {
            log.error('Deferred save-meta backfill failed', error);
          }
        })();
      });
    } catch (error) {
      log.error('Error checking save state', error);
      if (isCurrent()) clearSave();
    }
  }, [applyMeta, clearSave, log]);

  // useFocusEffect fires on the initial focus too, so it covers first mount —
  // no separate mount effect needed (a duplicate one used to run the heavy save
  // read TWICE on launch). Cancel any pending backfill when the screen blurs.
  useFocusEffect(
    useCallback(() => {
      void refreshHasSaveState();
      return () => {
        backfillTaskRef.current?.cancel();
      };
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
  // "Saved progress detected" pill). Tight separators so it fits one line.
  const continueSubtitle =
    saveSummary != null
      ? `${saveSummary.name || t('mainMenu.unnamed')} · ${saveSummary.age} ${t('mainMenu.years')} · ${formatMoney(saveSummary.money)}`
      : t('mainMenu.continueSubtitle');

  return (
    <>
      <View style={styles.root}>
        {/* This launch's background artwork, faded in over the flat base with a
            uniform dark scrim for text/card contrast. pointerEvents none — pure
            decoration; a single flat scrim (no gradients) so the fallback
            renderer can never reintroduce a seam. */}
        {bgIndex != null && (
          <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity: bgOpacity }]}>
            <Image
              source={MENU_BACKGROUNDS[bgIndex]}
              resizeMode="cover"
              style={StyleSheet.absoluteFill}
              onLoadEnd={handleBgLoaded}
              accessibilityIgnoresInvertColors
            />
            <View style={styles.bgScrim} />
          </Animated.View>
        )}
        <View
          style={[
            styles.content,
            {
              paddingTop: insets.top + verticalScale(24),
              paddingBottom: insets.bottom + verticalScale(20),
            },
          ]}
        >
          {/* Slight upward bias: 0.9 above / 1.1 below reads centered-but-lifted. */}
          <View style={styles.spacerTop} />

          {/* Brand block — crisp text on the flat dark base, no lighter panel. */}
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

          <View style={styles.heroGap} />

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

          <View style={styles.spacerBottom} />

          {/* Grounds the bottom edge so the lower margin reads intentional. */}
          <RevealItem index={hasSave ? 4 : 3} reduced={reduced}>
            <Text style={styles.footerCaption}>
              {APP_VERSION ? `v${APP_VERSION}` : 'DEEP LIFE SIMULATOR'}
            </Text>
          </RevealItem>
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
  // Uniform dark veil over the artwork so the title, cards, and labels keep
  // full contrast on every image. Deliberately ONE flat layer — a stepped or
  // gradient scrim would recreate the hard-seam bug this screen just escaped.
  bgScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(2, 6, 23, 0.52)',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: responsiveSpacing.lg,
  },
  // Two flex spacers with a slight upward bias frame the composition centrally
  // instead of pinning the title to the top and the actions to the bottom.
  spacerTop: {
    flex: 0.9,
    width: '100%',
  },
  spacerBottom: {
    flex: 1.1,
    width: '100%',
  },
  hero: {
    alignItems: 'center',
  },
  eyebrow: {
    color: '#60A5FA',
    fontSize: fontScale(12),
    fontWeight: '700',
    letterSpacing: scale(3),
    marginBottom: verticalScale(12),
  },
  // Poster-grade brand type WITHOUT bundling font files: Avenir Next Heavy
  // ships built into iOS — smooth, wide geometric curves at maximum weight,
  // the same language as the DeepLife key art (assets/images/Main_Menu*.png).
  // (Futura Condensed ExtraBold was tried first; its narrow angular forms read
  // harsh on-device.) Named PostScript families must not be paired with a
  // fontWeight, or iOS synthesizes a faux bold on top; Android falls back to
  // the previous system-font weights.
  brandTop: {
    color: '#F8FAFC',
    fontSize: fontScale(48),
    letterSpacing: scale(1),
    textAlign: 'center',
    ...Platform.select({
      ios: { fontFamily: 'AvenirNext-Heavy' },
      default: { fontWeight: '900' as const },
    }),
  },
  brandBottom: {
    color: '#94A3B8',
    fontSize: fontScale(21),
    letterSpacing: scale(8),
    textAlign: 'center',
    marginTop: verticalScale(4),
    ...Platform.select({
      ios: { fontFamily: 'AvenirNext-DemiBold' },
      default: { fontWeight: '600' as const },
    }),
  },
  heroGap: {
    height: verticalScale(44),
  },
  menuSection: {
    width: '100%',
    maxWidth: scale(440),
    alignSelf: 'center',
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
    borderColor: 'rgba(255, 255, 255, 0.22)',
    backgroundColor: '#3B82F6',
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
    backgroundColor: 'rgba(30, 41, 59, 0.9)',
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
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
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

  // Footer --------------------------------------------------------------------
  footerCaption: {
    color: 'rgba(148, 163, 184, 0.45)',
    fontSize: fontScale(10),
    fontWeight: '700',
    letterSpacing: scale(2),
    textAlign: 'center',
  },
});
