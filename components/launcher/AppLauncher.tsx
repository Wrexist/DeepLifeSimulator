/**
 * AppLauncher - the ONE app grid + fullscreen sub-app host.
 *
 * `app/(tabs)/computer.tsx` and `app/(tabs)/mobile.tsx` were ~95% the same
 * screen: two catalogs, two lookup maps, two 200-line stylesheets, drifting
 * apart (different Bank gradients, a `paw`/`pet` id fork). Both are now thin
 * wrappers around this component - they keep only what genuinely differs:
 * device-ownership checks and their route redirects.
 *
 * Tile design deliberately carries LESS than it used to: the real app icon on
 * a neutral glass surface, the name, the lock/claim badges - no per-app
 * gradient and no two-line marketing description. Nineteen equally-shouty
 * tiles were ~3.5 screens of scrolling where nothing stood out; the icon and
 * name are what a launcher needs (ask any phone home screen).
 *
 * PROGRESSIVE DISCLOSURE, collapsed: a locked app used to sit inline, dimmed
 * to 0.45 - for a new player most of the grid was a wall of unusable cards.
 * Unlocked apps now render first and the locked ones fold into one
 * "Locked (N)" row per section that expands on tap. The teaching value stays
 * (every locked tile still shows its requirement); the wall goes.
 */
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  Platform,
  Image,
} from 'react-native';
import { useNavigation, useIsFocused } from '@react-navigation/native';
import { ChevronDown, ChevronUp, LayoutGrid, Lock, Smartphone } from 'lucide-react-native';

import { useGame } from '@/contexts/GameContext';
import { useTranslation } from '@/hooks/useTranslation';
import { useFeedback } from '@/utils/feedbackSystem';
import { isFeatureUnlocked, unlockRequirement } from '@/lib/progress/featureUnlocks';
import { getAppBadgeCounts } from '@/lib/notifications/appBadges';
import { trackFeatureUse } from '@/lib/analytics/featureAdoption';
import { featureForAppId } from '@/lib/analytics/featureRoutes';
import { gameAlert } from '@/utils/gameAlert';
import { setFullscreenApp } from '@/utils/fullscreenAppStore';
import { useHardwareBack } from '@/hooks/useHardwareBack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ErrorBoundary from '@/components/ErrorBoundary';
import {
  responsivePadding,
  responsiveFontSize,
  responsiveSpacing,
  responsiveBorderRadius,
  responsiveIconSize,
  scale,
  isTablet,
  getTabBarSafePadding,
} from '@/utils/scaling';
import { getGlassAppCard } from '@/utils/glassmorphismStyles';
import { getAppIconAsset } from '@/components/ui/appIconAssets';
import ScreenHeader from '@/components/ui/ScreenHeader';
import EconomyEventBanner from '@/components/shared/EconomyEventBanner';
import { ClaimableBadge } from '@/components/ClaimableBadge';
import { appsForHost, resolveAppComponent, type LauncherApp, type LauncherHost } from './appCatalog';

const { width: screenWidth } = Dimensions.get('window');

interface AppLauncherProps {
  host: LauncherHost;
  /** App id to open straight away - see the Apps tab's `?app=` deep link. */
  initialApp?: string;
  onInitialAppConsumed?: () => void;
}

/** A catalog entry decorated with this save's lock state. */
type DecoratedApp = LauncherApp & { locked: boolean; lockReason: string };

export default function AppLauncher({ host, initialApp, onInitialAppConsumed }: AppLauncherProps) {
  const { t } = useTranslation();
  const { gameState } = useGame();
  const { settings } = gameState;
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<{ addListener: (e: string, cb: () => void) => () => void }>();
  const { buttonPress } = useFeedback();
  const [activeApp, setActiveApp] = useState<string | null>(null);
  // Which sections have their locked shelf expanded (progressive disclosure).
  const [expandedLocked, setExpandedLocked] = useState<Record<string, boolean>>({});

  // Deep link: another screen asked for a specific app (e.g. the Family tab's
  // "Open the dating app"). Open it, then tell the parent to clear the param -
  // otherwise returning to this tab would re-open the app forever.
  useEffect(() => {
    if (!initialApp) return;
    setActiveApp(initialApp);
    onInitialAppConsumed?.();
  }, [initialApp, onInitialAppConsumed]);

  // Run sub-apps full-screen (hide the game TopStatsBar + floating tab bar) so
  // they don't feel sandwiched between the game chrome. Reset on unmount so the
  // chrome always returns even if the app is left abruptly. Scoped to tab
  // focus: with freezeOnBlur both tab screens stay mounted, so a blurred tab
  // must not clobber the focused tab's full-screen claim.
  const isFocused = useIsFocused();
  useEffect(() => {
    setFullscreenApp(isFocused && !!activeApp);
    return () => setFullscreenApp(false);
  }, [isFocused, activeApp]);

  // Feature adoption. The launcher grid is the one place every in-game app is
  // opened from, so mapping the id here measures all of them identically -
  // rather than twenty screens each remembering to call it. `featureForAppId`
  // returns null for unmeasured ids, and `trackFeatureUse` is a no-op unless
  // telemetry is enabled and consented.
  //
  // `weeksLived` is read through a ref so it is NOT a dependency: depending on
  // it would re-run the effect on every week advance and re-record adoption for
  // an app the player has not reopened.
  const weeksLivedRef = useRef(gameState?.weeksLived ?? 0);
  weeksLivedRef.current = gameState?.weeksLived ?? 0;
  useEffect(() => {
    const feature = featureForAppId(activeApp);
    if (feature) trackFeatureUse(feature, weeksLivedRef.current);
  }, [activeApp]);

  // Stable close handler, passed into every hosted app. `buttonPress` already
  // pairs the light haptic with the click sound, so it is the whole feedback.
  const handleCloseApp = useCallback(() => {
    buttonPress();
    setActiveApp(null);
  }, [buttonPress]);

  // Android hardware back must exit the SUB-APP, not the tab stack. While an
  // app is open the chrome is hidden, so the app's own back chevron was the
  // only way out and the system gesture popped the navigator instead - dumping
  // the player on Home while `activeApp` stayed set. Returning true consumes
  // the press only while an app is open.
  useHardwareBack(
    useCallback(() => {
      if (!activeApp) return false;
      handleCloseApp();
      return true;
    }, [activeApp, handleCloseApp])
  );

  // Reset to the grid when this launcher's tab is pressed again.
  useEffect(() => {
    const unsubscribe = navigation.addListener('tabPress', () => {
      setActiveApp(null);
    });
    return unsubscribe;
  }, [navigation]);

  /**
   * Sections with per-save lock state. On the computer host both halves render
   * as labelled sections - NOT a segmented toggle: buying a computer must not
   * move Bank and Stocks behind an extra tap (the retired toggle did exactly
   * that). Phone comes first because those are the everyday apps.
   */
  const appSections = useMemo(() => {
    const decorate = (apps: LauncherApp[]): DecoratedApp[] =>
      apps.map((app) => ({
        ...app,
        locked: !isFeatureUnlocked(gameState, `app:${app.id}`),
        lockReason: unlockRequirement(gameState, `app:${app.id}`),
      }));
    const hosted = appsForHost(host);
    const sections =
      host === 'computer'
        ? [
            { key: 'phone', title: 'Phone', apps: decorate(hosted.filter((a) => a.section === 'phone')) },
            { key: 'computer', title: 'Computer', apps: decorate(hosted.filter((a) => a.section === 'computer')) },
          ]
        : // The phone launcher is one ungrouped grid - there is no second
          // device to distinguish from, so a "Phone" heading would be noise.
          [{ key: 'phone', title: '', apps: decorate(hosted) }];
    return sections.filter((section) => section.apps.length > 0);
  }, [gameState, host]);

  // Per-app "needs attention" badge counts.
  const appBadges = useMemo(
    () => getAppBadgeCounts(gameState),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed to the exact state slices the badge math reads
    [gameState.sparkApp, gameState.socialMedia?.activeScandal, gameState.pets, gameState.companies, gameState.mail],
  );

  if (activeApp) {
    const AppComponent = resolveAppComponent(activeApp, host);
    // P2-15: a stale/unknown activeApp id would render `undefined` - an
    // "Element type is invalid" hard crash. Reset to the grid instead.
    if (!AppComponent) {
      setActiveApp(null);
      return null;
    }
    // Full-screen host: the game chrome is hidden while an app is open, so the
    // host supplies the top safe-area inset (notch) the TopStatsBar used to.
    return (
      <View style={{ flex: 1, paddingTop: insets.top, backgroundColor: settings.darkMode ? '#0F172A' : '#F8FAFC' }}>
        {/* One boundary for all 19 apps. Seven of them shipped without their
            own, so a throw in any of those took the whole Apps tab down with
            it; the ones that still wrap themselves simply nest, and the
            innermost boundary wins. */}
        <ErrorBoundary>
          <AppComponent onBack={handleCloseApp} />
        </ErrorBoundary>
      </View>
    );
  }

  // Responsive columns: the desktop grid is denser (3 phone / 4 tablet), the
  // phone grid roomier (2 / 3) - unchanged from the pre-merge screens.
  const columns = host === 'computer' ? (isTablet() ? 4 : 3) : isTablet() ? 3 : 2;
  const cardGap = responsiveSpacing.sm;
  const cardWidth = (screenWidth - responsivePadding.horizontal * 2 - cardGap * (columns - 1)) / columns;

  const renderTile = (app: DecoratedApp) => {
    const IconGlyph = app.icon;
    const iconAsset = getAppIconAsset(app.id);
    const name = app.nameKey ? t(app.nameKey) || app.name : app.name;
    return (
      <TouchableOpacity
        key={app.id}
        style={[styles.appCard, { width: cardWidth }]}
        onPress={() => {
          buttonPress();
          if (app.locked) {
            // Tapping a locked app explains itself rather than doing nothing -
            // a dead tap reads as a bug, not a gate.
            gameAlert(name, app.lockReason || 'Not available yet.');
            return;
          }
          setActiveApp(app.id);
        }}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel={app.locked ? `${name}, locked` : `Open ${name}`}
        accessibilityHint={app.locked ? app.lockReason || 'Not available yet' : `Launch the ${name} app`}
        accessibilityState={{ disabled: app.locked }}
      >
        <View style={[styles.appCardInner, settings.darkMode && styles.appCardInnerDark]}>
          <View style={styles.appIconContainer}>
            {/* Padlock badge - reads as locked before the card is tapped. */}
            {app.locked && (
              <View style={styles.appLockBadge}>
                <Lock size={scale(12)} color="#FFFFFF" />
              </View>
            )}
            {iconAsset ? (
              // The real app icon (full-bleed PNG) - the tile surface itself
              // stays neutral so the icon is the only voice on the card.
              <Image
                source={iconAsset}
                style={styles.appIconImage}
                resizeMode="cover"
                accessibilityIgnoresInvertColors
              />
            ) : (
              // No PNG yet: the Lucide glyph on a brand-tinted tile when the
              // app declares one (appCatalog.tint), else the neutral chip.
              <View
                style={[
                  styles.appIconFallback,
                  settings.darkMode && styles.appIconFallbackDark,
                  app.tint ? { backgroundColor: app.tint, borderColor: app.tint } : null,
                ]}
              >
                <IconGlyph
                  size={responsiveIconSize.lg}
                  color={app.tint ? '#FFFFFF' : settings.darkMode ? '#CBD5E1' : '#475569'}
                />
              </View>
            )}
          </View>
          <Text style={[styles.appName, settings.darkMode && styles.appNameDark]} numberOfLines={2}>
            {name}
          </Text>
          {/* Only the locked shelf carries a second line: the requirement is
              the one description worth a tile's space. */}
          {app.locked && !!app.lockReason && (
            <Text style={[styles.lockReason, settings.darkMode && styles.lockReasonDark]} numberOfLines={2}>
              {app.lockReason}
            </Text>
          )}
        </View>
        <ClaimableBadge count={appBadges[app.id] ?? 0} />
      </TouchableOpacity>
    );
  };

  const header =
    host === 'computer'
      ? {
          title: t('tabs.apps') || 'Apps',
          subtitle: 'Your phone and desktop software',
          icon: <LayoutGrid size={scale(18)} color="#60A5FA" />,
        }
      : {
          title: t('mobile.mobileApps'),
          subtitle: 'Everything on your phone',
          icon: <Smartphone size={scale(18)} color="#60A5FA" />,
        };

  return (
    <View style={[styles.container, settings.darkMode && styles.containerDark]}>
      <ScreenHeader title={header.title} subtitle={header.subtitle} icon={header.icon} tint="#60A5FA" />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: getTabBarSafePadding(insets.bottom) }]}
        showsVerticalScrollIndicator={true}
      >
        {/* Macro economy strip - visible where the money apps live; null in normal times. */}
        <EconomyEventBanner context="generic" />
        {appSections.map((section) => {
          const unlocked = section.apps.filter((app) => !app.locked);
          const locked = section.apps.filter((app) => app.locked);
          const expanded = !!expandedLocked[section.key];
          const ExpandChevron = expanded ? ChevronUp : ChevronDown;
          return (
            <View key={section.key} style={styles.appSection}>
              {!!section.title && (
                <Text style={[styles.appSectionTitle, settings.darkMode && styles.appSectionTitleDark]}>
                  {section.title}
                </Text>
              )}
              <View style={styles.appsGrid}>{unlocked.map(renderTile)}</View>
              {locked.length > 0 && (
                <>
                  <TouchableOpacity
                    style={[styles.lockedRow, settings.darkMode && styles.lockedRowDark]}
                    onPress={() => {
                      buttonPress();
                      setExpandedLocked((prev) => ({ ...prev, [section.key]: !prev[section.key] }));
                    }}
                    activeOpacity={0.8}
                    accessibilityRole="button"
                    accessibilityLabel={`Locked apps, ${locked.length}`}
                    accessibilityHint={expanded ? 'Collapse the locked apps' : 'Show the locked apps and how to unlock them'}
                    accessibilityState={{ expanded }}
                  >
                    <Lock size={scale(14)} color={settings.darkMode ? '#94A3B8' : '#64748B'} />
                    <Text style={[styles.lockedRowText, settings.darkMode && styles.lockedRowTextDark]}>
                      Locked ({locked.length})
                    </Text>
                    <ExpandChevron size={scale(16)} color={settings.darkMode ? '#94A3B8' : '#64748B'} />
                  </TouchableOpacity>
                  {expanded && <View style={styles.appsGrid}>{locked.map(renderTile)}</View>}
                </>
              )}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  // Flat backgrounds: the old three-stop page gradient (and a dark "gradient"
  // between two IDENTICAL colors) was decoration, and gradients are reserved
  // for meaning (see scripts/check-ui-ratchet.js).
  container: {
    flex: 1,
    backgroundColor: '#F0F4F8',
  },
  containerDark: {
    backgroundColor: '#020617',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: responsivePadding.horizontal,
    paddingBottom: responsiveSpacing.xl,
  },
  appSection: {
    gap: responsiveSpacing.sm,
    marginBottom: responsiveSpacing.md,
  },
  appSectionTitle: {
    fontSize: responsiveFontSize.sm,
    fontWeight: '600',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: '#64748B',
    paddingHorizontal: responsiveSpacing.xs,
  },
  appSectionTitleDark: {
    color: '#94A3B8',
  },
  appsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    gap: responsiveSpacing.sm,
  },
  appCard: {
    // Sized to its content, not to a fixed 112.
    //
    // The fixed height existed so a locked tile's requirement line had somewhere
    // to go, but it was paid by EVERY tile: with content anchored to the top, an
    // ordinary one-line app left ~a third of its card empty and the grid read as
    // a rendering fault (screenshot report, 2026-09-04). Cards on the same row
    // still match each other - a wrapped flex row stretches its items to the
    // line's height - so a locked tile grows its own row rather than padding all
    // of them. `minHeight` keeps a short name from collapsing into a stub.
    minHeight: scale(80),
    borderRadius: responsiveBorderRadius.xl,
    marginBottom: responsiveSpacing.sm,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: scale(4) },
        shadowOpacity: 0.12,
        shadowRadius: scale(10),
      },
      android: {
        elevation: 4,
      },
      web: {
        boxShadow: '0px 4px 14px rgba(0, 0, 0, 0.12)',
      },
    }),
  },
  appCardInner: {
    flex: 1,
    ...getGlassAppCard(false),
    padding: responsiveSpacing.sm,
    // Anchor content to the top so every icon sits at the same height across
    // the grid and can never overflow the card's top edge.
    justifyContent: 'flex-start',
    alignItems: 'center',
  },
  appCardInnerDark: {
    ...getGlassAppCard(true),
  },
  appIconContainer: {
    marginBottom: responsiveSpacing.xs,
  },
  /** Padlock badge on a not-yet-unlocked app icon. */
  appLockBadge: {
    position: 'absolute',
    top: -scale(2),
    right: -scale(2),
    zIndex: 1,
    width: scale(20),
    height: scale(20),
    borderRadius: scale(10),
    backgroundColor: 'rgba(15,23,42,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // The PNG app icon - a rounded square (iOS-style squircle) since the assets
  // are full-bleed app icons.
  appIconImage: {
    width: responsiveIconSize.xl + scale(8),
    height: responsiveIconSize.xl + scale(8),
    borderRadius: (responsiveIconSize.xl + scale(8)) * 0.235,
  },
  // Neutral glyph surface for apps with no PNG yet - same footprint as the
  // image so mixed rows stay aligned. Deliberately NOT a per-app gradient.
  appIconFallback: {
    width: responsiveIconSize.xl + scale(8),
    height: responsiveIconSize.xl + scale(8),
    borderRadius: (responsiveIconSize.xl + scale(8)) * 0.235,
    backgroundColor: 'rgba(100, 116, 139, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(100, 116, 139, 0.28)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  appIconFallbackDark: {
    backgroundColor: 'rgba(148, 163, 184, 0.14)',
    borderColor: 'rgba(148, 163, 184, 0.28)',
  },
  appName: {
    fontSize: responsiveFontSize.sm,
    fontWeight: '600',
    color: '#1E293B',
    textAlign: 'center',
  },
  appNameDark: {
    color: '#FFFFFF',
  },
  /** The unlock requirement, shown only on tiles inside the locked shelf. */
  lockReason: {
    fontSize: responsiveFontSize.xs,
    color: '#64748B',
    textAlign: 'center',
    marginTop: responsiveSpacing.xs / 2,
  },
  lockReasonDark: {
    color: '#94A3B8',
  },
  /** The collapsed "Locked (N)" disclosure row. */
  lockedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: responsiveSpacing.xs,
    minHeight: scale(44),
    borderRadius: responsiveBorderRadius.lg,
    borderWidth: 1,
    borderColor: 'rgba(100, 116, 139, 0.28)',
    backgroundColor: 'rgba(100, 116, 139, 0.08)',
  },
  lockedRowDark: {
    borderColor: 'rgba(148, 163, 184, 0.24)',
    backgroundColor: 'rgba(148, 163, 184, 0.08)',
  },
  lockedRowText: {
    fontSize: responsiveFontSize.sm,
    fontWeight: '600',
    color: '#64748B',
  },
  lockedRowTextDark: {
    color: '#94A3B8',
  },
});
