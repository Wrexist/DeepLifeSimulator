import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  Platform,
  Image,
  Alert,
} from 'react-native';
import Gradient from '@/components/ui/Gradient';
import { isFeatureUnlocked, unlockRequirement } from '@/lib/progress/featureUnlocks';
import {
  Monitor,
  Bitcoin,
  Home,
  Globe,
  Flame,
  Users,
  Activity,
  TrendingUp,
  Building,
  PawPrint,
  GraduationCap,
  CreditCard,
  Gamepad2,
  Plane,
  Vote,
  BarChart3,
  Car,
  Video,
  Mail,
  Crown, Lock, LayoutGrid } from 'lucide-react-native';
import { useGame } from '@/contexts/GameContext';
import { useFeedback } from '@/utils/feedbackSystem';
import EconomyEventBanner from '@/components/shared/EconomyEventBanner';
import { useNavigation , useIsFocused } from '@react-navigation/native';
import { useTranslation } from '@/hooks/useTranslation';
import { useTutorialHighlight } from '@/contexts/TutorialHighlightContext';
import { useRouter, useSegments } from 'expo-router';
import { useNavigationReady } from '@/hooks/useNavigationReady';

// REVERTED R6 lazy-loading: in the production iOS bundle one of the lazy
// chunks resolved to `undefined` at router init, crashing the app with
// "Element type is invalid". React.lazy + Metro/Hermes dynamic-import is
// fragile under expo-router because the router scans every (tabs)/* file at
// boot and surfaces any default-export mismatch as a hard navigator crash.
// Restoring eager imports is the safe default; revisit lazy-loading via a
// per-screen smoke-tested approach (see round6 follow-up notes).
import BitcoinMiningApp from '@/components/computer/BitcoinMiningApp';
import RealEstateApp from '@/components/computer/RealEstateApp';
import OnionApp from '@/components/computer/OnionApp';
import GamingApp from '@/components/computer/GamingApp';
import GamingStreamingApp from '@/components/computer/GamingStreamingApp';
import DatingApp from '@/components/mobile/Spark/SparkApp';
import ContactsApp from '@/components/mobile/ContactsApp';
import MailApp from '@/components/mobile/Mail/MailApp';
import PulseApp from '@/components/mobile/Pulse/PulseApp';
import StocksApp from '@/components/mobile/StocksApp';
import CompanyApp from '@/components/mobile/Hustle/HustleApp';
import PetApp from '@/components/mobile/PetApp';
import EducationApp from '@/components/mobile/EducationApp';
import AdvancedBankApp from '@/components/computer/AdvancedBankApp';
import TravelApp from '@/components/computer/TravelApp';
import PoliticalApp from '@/components/computer/PoliticalApp';
import StatisticsApp from '@/components/computer/StatisticsApp';
import VehicleApp from '@/components/computer/VehicleApp';
import LuxuryApp from '@/components/computer/LuxuryApp';

import {
  responsivePadding,
  responsiveFontSize,
  responsiveSpacing,
  responsiveBorderRadius,
  responsiveIconSize,
  fontScale,
  scale,
  isTablet,
  getTabBarSafePadding,
} from '@/utils/scaling';
import { getGlassAppCard } from '@/utils/glassmorphismStyles';
import { getAppIconAsset } from '@/components/ui/appIconAssets';
import { useTopStatsBarHeight } from '@/hooks/useTopStatsBarHeight';
import { useHardwareBack } from '@/hooks/useHardwareBack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { setFullscreenApp } from '@/utils/fullscreenAppStore';

import ErrorBoundary from '@/components/ErrorBoundary';
import { ClaimableBadge } from '@/components/ClaimableBadge';
import { getAppBadgeCounts } from '@/lib/notifications/appBadges';
const LinearGradient = Gradient;

const { width: screenWidth } = Dimensions.get('window');

/**
 * Apps that belong to the PHONE half of the launcher.
 *
 * This was the membership list for a segmented toggle that hid one half at a
 * time. The toggle is gone - both halves now render as labelled sections, so
 * buying a computer no longer costs a tap on Bank, Stocks, Pulse, Spark,
 * Contacts and Pet. The list survives because the phone/computer distinction
 * is still worth showing; it just no longer hides anything.
 */
const MOBILE_APP_IDS = ['tinder', 'contacts', 'mail', 'social', 'stocks', 'bank', 'paw'];

function ComputerScreen() {
  return (
    <ErrorBoundary>
      <ComputerScreenContent />
    </ErrorBoundary>
  );
}

export function ComputerScreenContent({
  embedded = false,
  initialApp,
  onInitialAppConsumed,
}: {
  embedded?: boolean;
  /** App id to open straight away - see the Apps tab's `?app=` deep link. */
  initialApp?: string;
  onInitialAppConsumed?: () => void;
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const topStatsBarHeight = useTopStatsBarHeight();
  const [activeApp, setActiveApp] = useState<string | null>(null);

  // Deep link: another screen asked for a specific app (e.g. the Family tab's
  // "Open the dating app"). Open it, then tell the parent to clear the param -
  // otherwise returning to this tab would re-open the app forever.
  //
  // This used to also switch the grid's category so BACK landed somewhere
  // sensible. The grid no longer has categories (see `appSections` below), so
  // every app is already on screen behind whatever was opened.
  useEffect(() => {
    if (!initialApp) return;
    setActiveApp(initialApp);
    onInitialAppConsumed?.();
  }, [initialApp, onInitialAppConsumed]);

  // Run in-phone apps full-screen (hide the game TopStatsBar + floating tab bar)
  // so they don't feel sandwiched between the game chrome. Reset on unmount so
  // the chrome always returns even if the app is left abruptly.
  // Scoped to tab focus: with freezeOnBlur both tab screens stay mounted, so a
  // blurred tab must not clobber the focused tab's full-screen claim.
  const isFocused = useIsFocused();
  useEffect(() => {
    setFullscreenApp(isFocused && !!activeApp);
    return () => setFullscreenApp(false);
  }, [isFocused, activeApp]);
  const { gameState } = useGame();
  const { highlightedItem } = useTutorialHighlight();
  const { settings } = gameState;
  // Haptic parity with the phone grid - opening an app on mobile buzzed,
  // opening one on the computer was silent.
  const { buttonPress } = useFeedback(settings?.hapticFeedback ?? false);
  const router = useRouter();
  const segments = useSegments();
  const currentRoute = segments.length > 0 ? segments[segments.length - 1] : null;
  // Both redirects below run on this screen's first commit. When this screen IS
  // the entry route the root navigator does not exist yet and `router.replace`
  // throws "Attempted to navigate before mounting the Root Layout component",
  // which reaches the ErrorBoundary and shows the crash screen instead of the
  // redirect. Gating on the navigator defers them by one render. See
  // hooks/useNavigationReady.ts.
  const navReady = useNavigationReady();

  // Prevent staying on computer screen when in prison - redirect to work tab.
  // Embedded (inside the Apps tab) the layout owns the jail redirect, so skip it.
  useEffect(() => {
    if (embedded || !navReady) return;
    if (gameState.jailWeeks > 0) {
      router.replace('/(tabs)/work');
    }
  }, [embedded, navReady, gameState.jailWeeks, router]);

  // Redirect away from computer screen if computer is sold. Embedded, the Apps
  // tab already falls back to the phone launcher when the computer is gone, so
  // skip the redirect (currentRoute is 'apps', never 'computer', here anyway).
  useEffect(() => {
    if (embedded || !navReady) return;
    const ownsComputer = (gameState.items || []).find(item => item.id === 'computer')?.owned;
    if (!ownsComputer && currentRoute === 'computer') {
      // Redirect to home tab if computer is sold
      router.replace('/(tabs)/home');
    }
  }, [embedded, navReady, gameState.items, router, currentRoute]);
  const navigation = useNavigation<any>();

  // Stable close handler (passed into every hosted app) - same tap feedback
  // as the phone shell's close, and declared before the early returns below
  // per the Rules of Hooks.
  const handleCloseApp = useCallback(() => {
    buttonPress();
    setActiveApp(null);
  }, [buttonPress]);

  // Android hardware back must exit the SUB-APP, not the tab stack.
  // Opening an app calls setFullscreenApp(true), which hides both the
  // TopStatsBar and the tab bar - so the app's own back chevron was the only
  // way out, and the system gesture instead popped the navigator, dumping the
  // player on Home (or out of the app) while `activeApp` stayed set.
  // Returning true consumes the press only while an app is open.
  useHardwareBack(
    useCallback(() => {
      if (!activeApp) return false;
      handleCloseApp();
      return true;
    }, [activeApp, handleCloseApp])
  );

  // Reset to apps grid when the Computer tab is pressed
  useEffect(() => {
    const unsubscribe = navigation.addListener('tabPress', () => {
      setActiveApp(null);
    });
    return unsubscribe;
  }, [navigation]);

  // Memoize apps list - must be called before any early returns (Rules of Hooks)
  const appsList = useMemo(() => [
    {
      id: 'bitcoin',
      name: t('computer.crypto'),
      description: t('computer.mineCrypto'),
      icon: Bitcoin,
      gradient: ['#FFD700', '#FFA500'], // Gold-orange gradient to match Bitcoin icon
      iconGradient: ['#FFD700', '#FFA500'],
      available: true,
    },
    {
      id: 'realestate',
      name: t('computer.realEstate'),
      description: t('computer.buyManageProperties'),
      icon: Home,
      gradient: ['#00B894', '#00CEC9'], // Teal gradient to match home icon
      iconGradient: ['#00B894', '#00CEC9'],
      available: true,
    },
    {
      id: 'onion',
      name: t('computer.darkWeb'),
      description: t('computer.accessDeepWeb'),
      icon: Globe,
      gradient: ['#2D3748', '#4A5568'], // Dark gray gradient to match globe icon
      iconGradient: ['#2D3748', '#4A5568'],
      available: true,
    },
    {
      id: 'tinder',
      name: 'Spark',
      description: 'Find your match',
      icon: Flame,
      gradient: ['#F43F5E', '#FB923C'], // Rose → orange - Spark brand gradient
      iconGradient: ['#F43F5E', '#FB923C'],
      available: true,
    },
    {
      id: 'contacts',
      name: t('computer.contacts'),
      description: t('computer.manageRelationships'),
      icon: Users,
      gradient: ['#00D2D3', '#54A0FF'], // Teal-blue gradient to match contacts icon
      iconGradient: ['#00D2D3', '#54A0FF'],
      available: true,
    },
    {
      id: 'mail',
      name: 'DeepMail',
      description: 'Statements & receipts',
      icon: Mail,
      gradient: ['#EA4335', '#FBBC04'],
      iconGradient: ['#EA4335', '#FBBC04'],
      available: true,
    },
    {
      id: 'social',
      name: 'Pulse',
      description: 'Feel the room',
      icon: Activity,
      gradient: ['#EC4899', '#6366F1'], // Magenta → indigo - Pulse brand gradient
      iconGradient: ['#EC4899', '#6366F1'],
      available: true,
    },
    {
      id: 'stocks',
      name: t('computer.stocks'),
      description: t('computer.tradeInvest'),
      icon: TrendingUp,
      gradient: ['#00B894', '#00CEC9'], // Green gradient to match stocks icon
      iconGradient: ['#00B894', '#00CEC9'],
      available: true,
    },
    {
      id: 'bank',
      name: t('computer.bank'),
      description: t('computer.manageFinances'),
      icon: CreditCard,
      gradient: ['#3B82F6', '#60A5FA'], // Blue gradient to match bank icon
      iconGradient: ['#3B82F6', '#60A5FA'],
      available: true,
    },
    {
      id: 'company',
      name: 'Hustle',
      description: 'Build something',
      icon: Building,
      gradient: ['#6366F1', '#06B6D4'], // Indigo → cyan - Hustle brand gradient
      iconGradient: ['#6366F1', '#06B6D4'],
      available: true,
    },
    {
      id: 'education',
      name: t('computer.education'),
      description: t('computer.learnNewSkills'),
      icon: GraduationCap,
      gradient: ['#00B894', '#00CEC9'], // Teal gradient to match education icon
      iconGradient: ['#00B894', '#00CEC9'],
      available: true,
    },
    {
      id: 'gaming',
      name: 'YouVideo',
      description: 'Create videos and earn money',
      icon: Gamepad2,
      gradient: ['#8B5CF6', '#A855F7'], // Purple gradient for gaming
      iconGradient: ['#8B5CF6', '#A855F7'],
      available: true,
    },
    {
      id: 'streaming',
      name: 'Streaming',
      description: 'Stream live and grow your audience',
      icon: Video,
      gradient: ['#DC2626', '#EF4444'], // Red gradient for streaming
      iconGradient: ['#DC2626', '#EF4444'],
      available: true,
    },
    {
      id: 'paw',
      name: t('computer.pets'),
      description: t('computer.adoptPet'),
      icon: PawPrint,
      gradient: ['#D97706', '#CA8A04'], // Orange gradient to match pet icon
      iconGradient: ['#D97706', '#CA8A04'],
      available: true,
    },
    {
      id: 'travel',
      name: 'Travel',
      description: 'Book trips and explore the world',
      icon: Plane,
      gradient: ['#0EA5E9', '#0284C7'], // Sky blue gradient for travel
      iconGradient: ['#0EA5E9', '#0284C7'],
      available: true,
    },
    {
      id: 'political',
      name: 'Political Office',
      description: 'Run for office, campaign, and govern',
      icon: Vote,
      gradient: ['#DC2626', '#B91C1C'], // Red gradient for politics
      iconGradient: ['#DC2626', '#B91C1C'],
      // Always reachable: politics is a life path you enter FROM this app (Run
      // for Office). Gating it on already holding office made it a locked door
      // nobody could open. The Office tab enforces age/reputation/education.
      available: true,
    },
    {
      id: 'statistics',
      name: 'Statistics',
      description: 'View lifetime stats and analytics',
      icon: BarChart3,
      gradient: ['#10B981', '#059669'], // Green gradient for statistics
      iconGradient: ['#10B981', '#059669'],
      available: true,
    },
    {
      id: 'vehicle',
      name: 'Garage',
      description: 'Manage your vehicles and garage',
      icon: Car,
      gradient: ['#6366F1', '#8B5CF6'], // Indigo-purple gradient for vehicles
      iconGradient: ['#6366F1', '#8B5CF6'],
      available: true,
    },
    {
      id: 'luxury',
      name: 'Luxury',
      description: 'Buy luxury & collectibles',
      icon: Crown,
      gradient: ['#3B82F6', '#60A5FA'], // Blue accent for luxury
      iconGradient: ['#3B82F6', '#60A5FA'],
      available: true,
    },
  ], [t]);

  // Separate apps into categories
  const desktopApps = useMemo(() => appsList.filter(app => 
    ['bitcoin', 'realestate', 'onion', 'gaming', 'streaming', 'travel', 'political', 'statistics', 'vehicle', 'luxury', 'company', 'education'].includes(app.id)
  ), [appsList]);
  
  const mobileApps = useMemo(() => appsList.filter(app =>
    MOBILE_APP_IDS.includes(app.id)
  ), [appsList]);
  
  /**
   * Get apps for current category.
   *
   * PROGRESSIVE DISCLOSURE: a locked app stays in the grid, dimmed with a
   * padlock and its requirement, rather than disappearing. Hiding them would
   * be cleaner but makes the game look thin and reshuffles the grid every time
   * something unlocks; showing them teaches the shape of the game from week 1.
   * `available: false` still removes an app outright - that flag means "does
   * not exist for this save", which is a different thing from "not yet".
   */
  const decorate = useCallback(
    (apps: typeof appsList) =>
      apps
        .filter(app => app.available !== false)
        .map(app => ({
          ...app,
          locked: !isFeatureUnlocked(gameState, `app:${app.id}`),
          lockReason: unlockRequirement(gameState, `app:${app.id}`),
        })),
    [gameState]
  );

  /**
   * Every app, in two labelled sections - NOT behind a segmented toggle.
   *
   * Buying a computer used to make the launcher default to "Desktop Apps",
   * which pushed Bank, Stocks, Pulse, Spark, Contacts and Pet behind an extra
   * tap. So a $5,000 purchase ADDED a tap to six apps, two of which (Bank and
   * Stocks) are among the most-used in the game, and relocated them with no
   * explanation - the player's answer to "where did my bank go?" was to
   * rediscover a toggle.
   *
   * Sections keep the phone/computer mental model, which is worth keeping,
   * while costing nothing to read past. Phone comes first because those are
   * the everyday apps; the computer half is the specialist half.
   */
  const appSections = useMemo(
    () => [
      { key: 'phone', title: 'Phone', apps: decorate(mobileApps) },
      { key: 'computer', title: 'Computer', apps: decorate(desktopApps) },
    ].filter(section => section.apps.length > 0),
    [decorate, desktopApps, mobileApps]
  );

  // Per-app "needs attention" badge counts - computed before any early return.
  const appBadges = useMemo(
    () => getAppBadgeCounts(gameState),
    [gameState.sparkApp, gameState.socialMedia?.activeScandal, gameState.pets, gameState.companies],
  );

  if (!(gameState.items || []).find(item => item.id === 'computer')?.owned) {
    return (
      <LinearGradient
        colors={settings.darkMode ? ['#020617', '#020617'] : ['#FFFFFF', '#F8FAFC']}
        style={styles.container}
      >
        <View style={styles.noComputerContainer}>
          <View style={styles.noComputerIconContainer}>
            <Monitor size={80} color={settings.darkMode ? '#64748B' : '#94A3B8'} />
          </View>
          <Text style={[styles.noComputerTitle, settings.darkMode && styles.noComputerTitleDark]}>
            {t('computer.noComputerAvailable')}
          </Text>
          <Text style={[styles.noComputerMessage, settings.darkMode && styles.noComputerMessageDark]}>
            {t('computer.noComputerMessage')}
          </Text>
          {/* Not a dead end: point straight at the surface that sells one. */}
          <TouchableOpacity
            style={styles.noDeviceCta}
            onPress={() => router.push({ pathname: '/(tabs)/life', params: { segment: 'shop' } })}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Shop for a computer in the Market"
          >
            <Text style={styles.noDeviceCtaText}>Shop the Market</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>
    );
  }

  if (activeApp) {
    const apps = {
      bitcoin: BitcoinMiningApp,
      realestate: RealEstateApp,
      onion: OnionApp,
      tinder: DatingApp,
      contacts: ContactsApp,
      mail: MailApp,
      social: PulseApp,
      stocks: StocksApp,
      bank: AdvancedBankApp,
      education: EducationApp,
      company: CompanyApp,
      // The pet app is 'paw' on this grid and 'pet' on the phone grid - an
      // inconsistency the badge layer already has to paper over by setting
      // both. Accept either id in BOTH launchers so a `?app=` deep link can
      // never resolve to undefined and silently bounce back to the grid.
      paw: PetApp,
      pet: PetApp,
      gaming: GamingApp,
      streaming: GamingStreamingApp,
      travel: TravelApp,
      political: PoliticalApp,
      statistics: StatisticsApp,
      vehicle: VehicleApp,
      luxury: LuxuryApp,
    };

    const AppComponent = apps[activeApp as keyof typeof apps];

    // P2-15: a stale/unknown activeApp id makes AppComponent undefined →
    // "Element type is invalid" hard crash. Reset to the grid instead.
    if (!AppComponent) {
      setActiveApp(null);
      return null;
    }

    // Full-screen host: the game chrome is hidden while an app is open, so the
    // host supplies the top safe-area inset (notch) the TopStatsBar used to.
    return (
      <View style={{ flex: 1, paddingTop: insets.top, backgroundColor: settings.darkMode ? '#0F172A' : '#F8FAFC' }}>
        <AppComponent onBack={handleCloseApp} />
      </View>
    );
  }

  // Mirror mobile.tsx's responsive column count so both app-grid tabs scale
  // identically on phones vs tablets. Computer keeps its denser default
  // (3 cols on phone, 4 on tablet) - mobile is 2 / 3.
  const columns = isTablet() ? 4 : 3;
  const cardGap = responsiveSpacing.sm;
  const horizontalPad = responsivePadding.horizontal;
  const cardWidth = (screenWidth - horizontalPad * 2 - cardGap * (columns - 1)) / columns;

  return (
    <LinearGradient
      colors={settings.darkMode ? ['#020617', '#020617'] : ['#F0F4F8', '#E2E8F0', '#CBD5E1']}
      style={styles.container}
    >
      {/* Titled header - parity with mobile.tsx, which this launcher silently
          replaces the moment a computer is bought. Same tab, same chrome. */}
      <View style={styles.header}>
        <LayoutGrid size={scale(18)} color={settings.darkMode ? '#F8FAFC' : '#0F172A'} />
        <Text style={[styles.headerTitle, settings.darkMode && styles.headerTitleDark]}>
          {t('tabs.apps') || 'Apps'}
        </Text>
      </View>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: getTabBarSafePadding(insets.bottom) }]}
        showsVerticalScrollIndicator={true}
      >
        {/* Macro economy strip - visible where the money apps live; null in normal times. */}
        <EconomyEventBanner context="generic" />
        {appSections.map((section) => (
          <View key={section.key} style={styles.appSection}>
            <Text style={[styles.appSectionTitle, settings.darkMode && styles.appSectionTitleDark]}>
              {section.title}
            </Text>
            <View style={styles.appsGrid}>
              {section.apps.map((app) => {
              const isHighlighted = highlightedItem === 'stock-app' && app.id === 'stocks';
              return (
                <TouchableOpacity
                  key={app.id}
                  style={[
                    styles.appCardGlass,
                    { width: cardWidth },
                    isHighlighted && styles.highlightedCardGlass,
                    // Dim rather than hide - the card still teaches what exists.
                    app.locked && { opacity: 0.45 },
                  ]}
                  onPress={() => {
                    buttonPress();
                    if (app.locked) {
                      // Tapping a locked app explains itself rather than doing
                      // nothing - a dead tap reads as a bug, not a gate.
                      Alert.alert(app.name, app.lockReason || 'Not available yet.');
                      return;
                    }
                    setActiveApp(app.id);
                  }}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityLabel={app.locked ? `${app.name}, locked` : `Open ${app.name}`}
                  accessibilityHint={
                    app.locked
                      ? app.lockReason || 'Not available yet'
                      : (app.description ?? `Launch the ${app.name} app`)
                  }
                  accessibilityState={{ disabled: !!app.locked }}
                >
                  <View style={[
                    styles.appCardGlassInner,
                    settings.darkMode && styles.appCardGlassInnerDark
                  ]}>
                    <View style={styles.appIconGlassContainer}>
                      {/* Padlock badge - reads as locked before the card is
                          tapped, so the dim alone is not carrying the meaning
                          (dim also reads as "disabled" or just low contrast). */}
                      {app.locked && (
                        <View style={styles.appLockBadge}>
                          <Lock size={scale(12)} color="#FFFFFF" />
                        </View>
                      )}
                      {getAppIconAsset(app.id) ? (
                        // Custom designed icon (full-bleed PNG, gradient baked in).
                        <Image
                          source={getAppIconAsset(app.id)!}
                          style={styles.appIconImage}
                          resizeMode="cover"
                          accessibilityIgnoresInvertColors
                        />
                      ) : (
                        // Fallback: Lucide glyph on a gradient circle (unchanged).
                        <View style={[
                          styles.appIconGlass,
                          settings.darkMode && styles.appIconGlassDark
                        ]}>
                          <LinearGradient
                            colors={app.iconGradient as [string, string]}
                            style={styles.appIconGradientGlass}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                          >
                            <app.icon size={responsiveIconSize.md} color="#FFFFFF" />
                          </LinearGradient>
                        </View>
                      )}
                    </View>
                    <Text style={[styles.appName, settings.darkMode && styles.appNameDark]} numberOfLines={2}>
                      {app.name}
                    </Text>
                    <Text style={[styles.appDescription, settings.darkMode && styles.appDescriptionDark]} numberOfLines={2}>
                      {app.description}
                    </Text>
                  </View>
                  <ClaimableBadge count={appBadges[app.id] ?? 0} />
                </TouchableOpacity>
              );
            })}
            </View>
          </View>
        ))}
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
  },
  loadingContainerDark: {
    backgroundColor: '#1E293B',
  },
  loadingText: {
    marginTop: responsiveSpacing.md,
    fontSize: responsiveFontSize.md,
    color: '#64748B',
  },
  loadingTextDark: {
    color: '#CBD5E1',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(8),
    paddingTop: responsivePadding.vertical,
    paddingBottom: responsiveSpacing.sm,
    paddingHorizontal: responsivePadding.horizontal,
  },
  headerTitle: {
    fontSize: responsiveFontSize.xl,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.5,
  },
  headerTitleDark: {
    color: '#F8FAFC',
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
  },
  appSectionTitle: {
    fontSize: responsiveFontSize.sm,
    fontWeight: '700',
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
    justifyContent: 'space-evenly',
    gap: responsiveSpacing.sm,
  },
  appCardGlass: {
    // Fixed height (not a square aspectRatio) so every card is identical and tall
    // enough to hold the icon + 2-line name + 2-line description without the old
    // overflow that pushed icons past the top border and clipped the text.
    height: scale(150),
    borderRadius: responsiveBorderRadius.xl,
    marginBottom: responsiveSpacing.sm,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: scale(8) },
        shadowOpacity: 0.2,
        shadowRadius: scale(16),
      },
      android: {
        elevation: 8,
      },
      web: {
        boxShadow: '0px 8px 24px rgba(0, 0, 0, 0.2)',
      },
    }),
  },
  appCardGlassInner: {
    flex: 1,
    ...getGlassAppCard(false),
    padding: responsiveSpacing.md,
    // Anchor content to the top so every icon sits at the same height across the
    // grid (symmetry) and the icon can never overflow the card's top edge.
    justifyContent: 'flex-start',
    alignItems: 'center',
  },
  appCardGlassInnerDark: {
    ...getGlassAppCard(true),
  },
  appIconGlassContainer: {
    marginBottom: responsiveSpacing.sm,
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
  // Custom PNG icon - same footprint as the gradient circle, but a rounded
  // square (iOS-style squircle) since the assets are full-bleed app icons.
  appIconImage: {
    width: responsiveIconSize.xl + scale(8),
    height: responsiveIconSize.xl + scale(8),
    borderRadius: (responsiveIconSize.xl + scale(8)) * 0.235,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: scale(4) },
        shadowOpacity: 0.22,
        shadowRadius: scale(8),
      },
      android: {
        elevation: 5,
      },
      web: {
        boxShadow: '0px 4px 12px rgba(0, 0, 0, 0.24)',
      },
    }),
  },
  appIconGlass: {
    width: responsiveIconSize.xl + scale(8),
    height: responsiveIconSize.xl + scale(8),
    borderRadius: (responsiveIconSize.xl + scale(8)) / 2,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.4)',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: scale(4) },
        shadowOpacity: 0.2,
        shadowRadius: scale(8),
      },
      android: {
        elevation: 4,
      },
      web: {
        boxShadow: '0px 4px 12px rgba(0, 0, 0, 0.2)',
      },
    }),
  },
  appIconGlassDark: {
    backgroundColor: 'rgba(30, 41, 59, 0.3)',
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  appIconGradientGlass: {
    width: responsiveIconSize.xl,
    height: responsiveIconSize.xl,
    borderRadius: responsiveIconSize.xl / 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  appName: {
    fontSize: responsiveFontSize.sm,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: responsiveSpacing.xs / 2,
    textAlign: 'center',
  },
  appNameDark: {
    color: '#FFFFFF',
  },
  appDescription: {
    fontSize: fontScale(10.5),
    color: '#475569',
    textAlign: 'center',
    lineHeight: fontScale(10.5) * 1.35,
    fontWeight: '500',
    maxWidth: '95%',
  },
  appDescriptionDark: {
    color: 'rgba(255, 255, 255, 0.8)',
  },
  noComputerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: responsivePadding.xlarge,
  },
  noComputerIconContainer: {
    marginBottom: responsiveSpacing.xl,
  },
  noComputerTitle: {
    fontSize: responsiveFontSize['2xl'],
    fontWeight: 'bold',
    color: '#0F172A',
    marginBottom: responsiveSpacing.md,
    textAlign: 'center',
  },
  noComputerTitleDark: {
    color: '#F8FAFC',
  },
  noComputerMessage: {
    fontSize: responsiveFontSize.base,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: responsiveFontSize.base * 1.4,
  },
  noComputerMessageDark: {
    color: '#94A3B8',
  },
  noDeviceCta: {
    marginTop: scale(20),
    borderWidth: 1,
    borderColor: '#3B82F6',
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    borderRadius: scale(12),
    paddingVertical: scale(12),
    paddingHorizontal: scale(24),
    minHeight: scale(44),
    alignItems: 'center',
    justifyContent: 'center',
  },
  noDeviceCtaText: {
    color: '#3B82F6',
    fontSize: fontScale(14),
    fontWeight: '700',
  },
  highlightedCardGlass: {
    ...Platform.select({
      ios: {
        shadowColor: '#F59E0B',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.8,
        shadowRadius: scale(20),
      },
      android: {
        elevation: 12,
      },
      web: {
        boxShadow: '0px 0px 24px rgba(245, 158, 11, 0.8)',
      },
    }),
    transform: [{ scale: 1.05 }],
  },
  categoryTabsWrapper: {
    paddingHorizontal: responsivePadding.horizontal,
    paddingTop: responsivePadding.vertical,
    paddingBottom: responsiveSpacing.md,
  },
});

export default React.memo(ComputerScreen);

