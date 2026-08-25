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
  } from 'react-native';
import Gradient from '@/components/ui/Gradient';
import { isFeatureUnlocked, unlockRequirement } from '@/lib/progress/featureUnlocks';
import {
  Smartphone,
  Flame,
  Users,
  Activity,
  TrendingUp,
  CreditCard,
  GraduationCap,
  Building,
  PawPrint,
  Mail,
  Lock,
} from 'lucide-react-native';
import { useGame } from '@/contexts/GameContext';
import { useNavigation , useIsFocused } from '@react-navigation/native';
import { useTranslation } from '@/hooks/useTranslation';
import { useRouter } from 'expo-router';
import { useNavigationReady } from '@/hooks/useNavigationReady';

// REVERTED R6 lazy-loading: see comment in computer.tsx - same regression.
import DatingApp from '@/components/mobile/Spark/SparkApp';
import ContactsApp from '@/components/mobile/ContactsApp';
import MailApp from '@/components/mobile/Mail/MailApp';
import PulseApp from '@/components/mobile/Pulse/PulseApp';
import StocksApp from '@/components/mobile/StocksApp';
import BankApp from '@/components/mobile/BankApp';
import EducationApp from '@/components/mobile/EducationApp';
import CompanyApp from '@/components/mobile/Hustle/HustleApp';
import PetApp from '@/components/mobile/PetApp';

import {
  responsivePadding,
  responsiveFontSize,
  responsiveSpacing,
  responsiveBorderRadius,
  responsiveIconSize,
  isTablet,
  scale,
  fontScale,
  getTabBarSafePadding,
} from '@/utils/scaling';
import { getGlassAppCard } from '@/utils/glassmorphismStyles';
import { getAppIconAsset } from '@/components/ui/appIconAssets';
import { useTopStatsBarHeight } from '@/hooks/useTopStatsBarHeight';
import { useHardwareBack } from '@/hooks/useHardwareBack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { setFullscreenApp } from '@/utils/fullscreenAppStore';
import { usePerformanceMonitor } from '@/utils/performanceOptimization';
import { useFeedback } from '@/utils/feedbackSystem';

import ErrorBoundary from '@/components/ErrorBoundary';
import ScreenHeader from '@/components/ui/ScreenHeader';
import { ClaimableBadge } from '@/components/ClaimableBadge';
import { getAppBadgeCounts } from '@/lib/notifications/appBadges';
import EconomyEventBanner from '@/components/shared/EconomyEventBanner';
import { gameAlert } from '@/utils/gameAlert';
const LinearGradient = Gradient;

const { width: screenWidth } = Dimensions.get('window');

function MobileScreen() {
  return (
    <ErrorBoundary>
      <MobileScreenContent />
    </ErrorBoundary>
  );
}

export function MobileScreenContent({
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
  const { gameState } = useGame();
  const router = useRouter();
  // Redirects that run on this screen's first commit throw "Attempted to
  // navigate before mounting the Root Layout component" when this screen IS
  // the entry route (restored URL / deep link), which surfaces as the crash
  // screen. See hooks/useNavigationReady.ts.
  const navReady = useNavigationReady();
  const insets = useSafeAreaInsets();
  const topStatsBarHeight = useTopStatsBarHeight();
  const [activeApp, setActiveApp] = useState<string | null>(null);

  // Deep link - see the same block in computer.tsx. Clearing the param after
  // consuming it is what stops the app re-opening every time this tab regains
  // focus.
  useEffect(() => {
    if (!initialApp) return;
    setActiveApp(initialApp);
    onInitialAppConsumed?.();
  }, [initialApp, onInitialAppConsumed]);

  // Run in-phone apps full-screen (hide the game TopStatsBar + floating tab bar)
  // so they don't feel sandwiched. Reset on unmount so the chrome always returns.
  // Scoped to tab focus: with freezeOnBlur both tab screens stay mounted, so a
  // blurred tab must not clobber the focused tab's full-screen claim.
  const isFocused = useIsFocused();
  useEffect(() => {
    setFullscreenApp(isFocused && !!activeApp);
    return () => setFullscreenApp(false);
  }, [isFocused, activeApp]);

  // P3-3: dead scroll state - same pattern as work.tsx / market.tsx (P1-8).

  // Prevent staying on mobile screen when in prison - redirect to work tab.
  // Embedded (inside the Apps tab) the layout owns the jail redirect, so skip it.
  useEffect(() => {
    if (embedded || !navReady) return;
    if (gameState.jailWeeks > 0) {
      router.replace('/(tabs)/work');
    }
  }, [embedded, navReady, gameState.jailWeeks, router]);

  // R10-UX: once a computer is owned the layout hides the Mobile tab
  // (showMobileTab = ownsSmartphone && !ownsComputer), but expo-router keeps this
  // screen mounted until the user navigates - leaving them stranded on a tab
  // that's no longer in the bar. Mirror computer.tsx and redirect to home.
  // Embedded, the Apps tab chooses Computer-vs-Mobile by ownership, so this
  // stranding can't happen - skip the redirect to avoid fighting the parent.
  useEffect(() => {
    if (embedded || !navReady) return;
    const ownsComputer = (gameState.items || []).find(item => item.id === 'computer')?.owned;
    if (ownsComputer) {
      router.replace('/(tabs)/home');
    }
  }, [embedded, navReady, gameState.items, router]);
  
  const { settings } = gameState;
  const navigation = useNavigation<any>();
  const { buttonPress, haptic } = useFeedback();
  const { logRender } = usePerformanceMonitor();

  // Android hardware back exits the open sub-app rather than popping the tab
  // stack - see the matching comment in computer.tsx. Consumes the press only
  // while an app is open, so the grid keeps default navigator behaviour.
  useHardwareBack(
    useCallback(() => {
      if (!activeApp) return false;
      setActiveApp(null);
      return true;
    }, [activeApp])
  );

  // Reset to apps grid when the Mobile tab is pressed
  useEffect(() => {
    logRender('MobileScreen');
    const unsubscribe = navigation.addListener('tabPress', () => {
      setActiveApp(null);
    });
    return unsubscribe;
  }, [navigation, logRender]);

  // Memoize apps list - must be called before any early returns (Rules of Hooks)
  const appsList = useMemo(() => [
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
      name: t('mobile.contacts'),
      description: t('mobile.manageRelationships'),
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
      name: t('mobile.stocks'),
      description: t('mobile.tradeInvest'),
      icon: TrendingUp,
      gradient: ['#00B894', '#00CEC9'], // Green gradient to match stocks icon
      iconGradient: ['#00B894', '#00CEC9'],
      available: true,
    },
    {
      id: 'bank',
      name: t('mobile.bank'),
      description: t('mobile.manageFinances'),
      icon: CreditCard,
      gradient: ['#FD79A8', '#FDCB6E'], // Pink-orange gradient to match bank icon
      iconGradient: ['#FD79A8', '#FDCB6E'],
      available: true,
    },
    {
      id: 'education',
      name: t('mobile.education') || 'Education',
      description: t('mobile.learnNewSkills') || 'Learn new skills and advance',
      icon: GraduationCap,
      gradient: ['#00B894', '#00CEC9'], // Teal gradient for education
      iconGradient: ['#00B894', '#00CEC9'],
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
      id: 'pet',
      name: t('mobile.pets') || 'Pets',
      description: t('mobile.adoptPet') || 'Adopt and care for pets',
      icon: PawPrint,
      gradient: ['#D97706', '#CA8A04'], // Orange gradient for pets
      iconGradient: ['#D97706', '#CA8A04'],
      available: true,
    },
  ], [t]);

  // Per-app "needs attention" badge counts (unread matches, scandals, critical
  // pets, company alerts) - computed before any early return (Rules of Hooks).
  const appBadges = useMemo(
    () => getAppBadgeCounts(gameState),
    [gameState.sparkApp, gameState.socialMedia?.activeScandal, gameState.pets, gameState.companies],
  );

  if (!(gameState.items ?? []).find(item => item.id === 'smartphone')?.owned) {
    return (
      <LinearGradient
        colors={settings.darkMode ? ['#020617', '#020617'] : ['#FFFFFF', '#F8FAFC']}
        style={styles.container}
      >
        <View style={styles.noPhoneContainer}>
          <View style={styles.noPhoneIconContainer}>
            <Smartphone size={80} color={settings.darkMode ? '#64748B' : '#94A3B8'} />
          </View>
          <Text style={[styles.noPhoneTitle, settings.darkMode && styles.noPhoneTitleDark]}>
            {t('mobile.noPhoneAvailable')}
          </Text>
          <Text style={[styles.noPhoneMessage, settings.darkMode && styles.noPhoneMessageDark]}>
            {t('mobile.noPhoneMessage')}
          </Text>
          {/* Not a dead end: point straight at the surface that sells one. */}
          <TouchableOpacity
            style={styles.noDeviceCta}
            onPress={() => router.navigate({ pathname: '/(tabs)/life', params: { segment: 'shop', ts: String(Date.now()) } })}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Shop for a phone in the Market"
          >
            <Text style={styles.noDeviceCtaText}>Shop the Market</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>
    );
  }

  if (activeApp) {
    const apps = {
      tinder: DatingApp,
      contacts: ContactsApp,
      mail: MailApp,
      social: PulseApp,
      stocks: StocksApp,
      bank: BankApp,
      education: EducationApp,
      company: CompanyApp,
      // Alias - see the matching comment in computer.tsx. `paw` is the id the
      // desktop grid and MOBILE_APP_IDS use; both must resolve here too.
      pet: PetApp,
      paw: PetApp,
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
        <AppComponent onBack={() => {
          buttonPress();
          haptic('light');
          setActiveApp(null);
        }} />
      </View>
    );
  }

  const columns = isTablet() ? 3 : 2;
  // Must match the appsGrid style's `gap` (sm) - sizing cards for a larger gap
  // than the layout renders makes space-evenly redistribute the leftovers into
  // uneven, header-misaligned columns (computer.tsx already uses sm for both).
  const cardGap = responsiveSpacing.sm;
  const horizontalPad = responsivePadding.horizontal;
  const cardWidth = (screenWidth - horizontalPad * 2 - cardGap * (columns - 1)) / columns;

  return (
    <LinearGradient
      colors={settings.darkMode ? ['#020617', '#020617'] : ['#F0F4F8', '#E2E8F0', '#CBD5E1']}
      style={styles.container}
    >
      <ScreenHeader
        title={t('mobile.mobileApps')}
        subtitle="Everything on your phone"
        icon={<Smartphone size={scale(18)} color="#60A5FA" />}
        tint="#60A5FA"
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: getTabBarSafePadding(insets.bottom) }]}
        showsVerticalScrollIndicator={true}
      >
        {/* Macro economy strip - null in normal times. */}
        <EconomyEventBanner context="generic" />
        <View style={styles.appsGrid}>
          {/* PROGRESSIVE DISCLOSURE - mirrors the computer grid. A locked app
              stays visible, dimmed with a padlock, so the shape of the game is
              legible from week 1 and the grid does not reshuffle as things
              unlock. Tapping one explains itself; a dead tap reads as a bug. */}
          {appsList.map((app) => {
            const locked = !isFeatureUnlocked(gameState, `app:${app.id}`);
            const lockReason = unlockRequirement(gameState, `app:${app.id}`);
            return (
            <TouchableOpacity
              key={app.id}
              style={[styles.appCardGlass, { width: cardWidth }, locked && { opacity: 0.45 }]}
              onPress={() => {
                buttonPress();
                haptic('light');
                if (locked) {
                  gameAlert(app.name, lockReason || 'Not available yet.');
                  return;
                }
                setActiveApp(app.id);
              }}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel={locked ? `${app.name}, locked` : `Open ${app.name}`}
              accessibilityHint={
                locked
                  ? lockReason || 'Not available yet'
                  : (app.description ?? `Launch the ${app.name} app`)
              }
              accessibilityState={{ disabled: locked }}
            >
              <View style={[
                styles.appCardGlassInner,
                settings.darkMode && styles.appCardGlassInnerDark
              ]}>
                <View style={styles.appIconGlassContainer}>
                  {locked && (
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
                        <app.icon size={responsiveIconSize.lg} color="#FFFFFF" />
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: responsivePadding.horizontal,
    paddingBottom: responsiveSpacing.xl,
  },
  appsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-evenly',
    gap: responsiveSpacing.sm,
  },
  appCardGlass: {
    // Fixed height (not a square) so every card is identical and holds the icon
    // + 2-line name + 2-line description without the old overflow that pushed
    // icons past the top border and clipped the text.
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
    // Anchor content to the top so every icon aligns across the grid and can
    // never overflow the card's top edge.
    justifyContent: 'flex-start',
    alignItems: 'center',
  },
  appCardGlassInnerDark: {
    ...getGlassAppCard(true),
  },
  appIconGlassContainer: {
    marginBottom: responsiveSpacing.sm,
  },
  /** Padlock badge on a not-yet-unlocked app icon (mirrors computer.tsx). */
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
    width: responsiveIconSize['2xl'] + scale(8),
    height: responsiveIconSize['2xl'] + scale(8),
    borderRadius: (responsiveIconSize['2xl'] + scale(8)) * 0.235,
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
    width: responsiveIconSize['2xl'] + scale(8),
    height: responsiveIconSize['2xl'] + scale(8),
    borderRadius: (responsiveIconSize['2xl'] + scale(8)) / 2,
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
    width: responsiveIconSize['2xl'],
    height: responsiveIconSize['2xl'],
    borderRadius: responsiveIconSize['2xl'] / 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  appName: {
    fontSize: responsiveFontSize.sm,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: responsiveSpacing.xs,
    textAlign: 'center',
  },
  appNameDark: {
    color: '#FFFFFF',
  },
  appDescription: {
    fontSize: responsiveFontSize.xs,
    color: '#475569',
    textAlign: 'center',
    lineHeight: responsiveFontSize.xs * 1.4,
    fontWeight: '500',
  },
  appDescriptionDark: {
    color: 'rgba(255, 255, 255, 0.8)',
  },
  noPhoneContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: responsivePadding.xlarge,
  },
  noPhoneIconContainer: {
    marginBottom: responsiveSpacing.xl,
  },
  noPhoneTitle: {
    fontSize: responsiveFontSize['2xl'],
    fontWeight: 'bold',
    color: '#0F172A',
    marginBottom: responsiveSpacing.md,
    textAlign: 'center',
  },
  noPhoneTitleDark: {
    color: '#F8FAFC',
  },
  noPhoneMessage: {
    fontSize: responsiveFontSize.base,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: responsiveFontSize.base * 1.4,
  },
  noPhoneMessageDark: {
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
});

export default React.memo(MobileScreen);

