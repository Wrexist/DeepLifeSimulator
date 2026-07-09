import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  Platform,
} from 'react-native';
import LinearGradientFallback from '@/components/fallbacks/LinearGradientFallback';
import {
  Smartphone,
  Flame,
  Users,
  Activity,
  TrendingUp,
  CreditCard,
  GraduationCap,
  Building,
  PawPrint
} from 'lucide-react-native';
import { useGame } from '@/contexts/GameContext';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from '@/hooks/useTranslation';
import { useRouter } from 'expo-router';

// REVERTED R6 lazy-loading: see comment in computer.tsx — same regression.
import DatingApp from '@/components/mobile/Spark/SparkApp';
import ContactsApp from '@/components/mobile/ContactsApp';
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
  getTabBarSafePadding,
} from '@/utils/scaling';
import { getGlassAppCard } from '@/utils/glassmorphismStyles';
import { useTopStatsBarHeight } from '@/hooks/useTopStatsBarHeight';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { setFullscreenApp } from '@/utils/fullscreenAppStore';
import { usePerformanceMonitor } from '@/utils/performanceOptimization';
import { useFeedback } from '@/utils/feedbackSystem';

import ErrorBoundary from '@/components/ErrorBoundary';
import { ClaimableBadge } from '@/components/ClaimableBadge';
import { getAppBadgeCounts } from '@/lib/notifications/appBadges';
import EconomyEventBanner from '@/components/shared/EconomyEventBanner';
const LinearGradient = LinearGradientFallback;

const { width: screenWidth } = Dimensions.get('window');

function MobileScreen() {
  return (
    <ErrorBoundary>
      <MobileScreenContent />
    </ErrorBoundary>
  );
}

function MobileScreenContent() {
  const { t } = useTranslation();
  const { gameState } = useGame();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const topStatsBarHeight = useTopStatsBarHeight();
  const [activeApp, setActiveApp] = useState<string | null>(null);

  // Run in-phone apps full-screen (hide the game TopStatsBar + floating tab bar)
  // so they don't feel sandwiched. Reset on unmount so the chrome always returns.
  useEffect(() => {
    setFullscreenApp(!!activeApp);
    return () => setFullscreenApp(false);
  }, [activeApp]);

  // P3-3: dead scroll state — same pattern as work.tsx / market.tsx (P1-8).

  // Prevent staying on mobile screen when in prison - redirect to work tab
  useEffect(() => {
    if (gameState.jailWeeks > 0) {
      router.replace('/(tabs)/work');
    }
  }, [gameState.jailWeeks, router]);

  // R10-UX: once a computer is owned the layout hides the Mobile tab
  // (showMobileTab = ownsSmartphone && !ownsComputer), but expo-router keeps this
  // screen mounted until the user navigates — leaving them stranded on a tab
  // that's no longer in the bar. Mirror computer.tsx and redirect to home.
  useEffect(() => {
    const ownsComputer = (gameState.items || []).find(item => item.id === 'computer')?.owned;
    if (ownsComputer) {
      router.replace('/(tabs)/home');
    }
  }, [gameState.items, router]);
  
  const { settings } = gameState;
  const navigation = useNavigation<any>();
  const { buttonPress, haptic } = useFeedback(settings?.hapticFeedback ?? false);
  const { logRender } = usePerformanceMonitor();

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
      gradient: ['#F43F5E', '#FB923C'], // Rose → orange — Spark brand gradient
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
      id: 'social',
      name: 'Pulse',
      description: 'Feel the room',
      icon: Activity,
      gradient: ['#EC4899', '#6366F1'], // Magenta → indigo — Pulse brand gradient
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
      gradient: ['#6366F1', '#06B6D4'], // Indigo → cyan — Hustle brand gradient
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
  // pets, company alerts) — computed before any early return (Rules of Hooks).
  const appBadges = useMemo(
    () => getAppBadgeCounts(gameState),
    [gameState.sparkApp, gameState.socialMedia?.activeScandal, gameState.pets, gameState.companies],
  );

  if (!(gameState.items ?? []).find(item => item.id === 'smartphone')?.owned) {
    return (
      <LinearGradient
        colors={settings.darkMode ? ['#1E3A8A', '#1F2937'] : ['#FFFFFF', '#F8FAFC']}
        style={styles.container}
      >
        <View style={styles.noPhoneContainer}>
          <View style={styles.noPhoneIconContainer}>
            <Smartphone size={80} color={settings.darkMode ? '#6B7280' : '#9CA3AF'} />
          </View>
          <Text style={[styles.noPhoneTitle, settings.darkMode && styles.noPhoneTitleDark]}>
            {t('mobile.noPhoneAvailable')}
          </Text>
          <Text style={[styles.noPhoneMessage, settings.darkMode && styles.noPhoneMessageDark]}>
            {t('mobile.noPhoneMessage')}
          </Text>
        </View>
      </LinearGradient>
    );
  }

  if (activeApp) {
    const apps = {
      tinder: DatingApp,
      contacts: ContactsApp,
      social: PulseApp,
      stocks: StocksApp,
      bank: BankApp,
      education: EducationApp,
      company: CompanyApp,
      pet: PetApp,
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
      <View style={{ flex: 1, paddingTop: insets.top, backgroundColor: '#0F172A' }}>
        <AppComponent onBack={() => {
          buttonPress();
          haptic('light');
          setActiveApp(null);
        }} />
      </View>
    );
  }

  const columns = isTablet() ? 3 : 2;
  const cardGap = responsiveSpacing.md;
  const horizontalPad = responsivePadding.horizontal;
  const cardWidth = (screenWidth - horizontalPad * 2 - cardGap * (columns - 1)) / columns;

  return (
    <LinearGradient
      colors={settings.darkMode ? ['#0F172A', '#1E293B', '#334155'] : ['#F0F4F8', '#E2E8F0', '#CBD5E1']}
      style={styles.container}
    >
      <View style={styles.header}>
        <Smartphone size={scale(18)} color={settings.darkMode ? '#F9FAFB' : '#111827'} />
        <Text style={[styles.headerTitle, settings.darkMode && styles.headerTitleDark]}>
          {t('mobile.mobileApps')}
        </Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: getTabBarSafePadding(insets.bottom) }]}
        showsVerticalScrollIndicator={true}
      >
        {/* Macro economy strip — null in normal times. */}
        <EconomyEventBanner context="generic" />
        <View style={styles.appsGrid}>
          {appsList.map((app) => (
            <TouchableOpacity
              key={app.id}
              style={[styles.appCardGlass, { width: cardWidth }]}
              onPress={() => {
                buttonPress();
                haptic('light');
                setActiveApp(app.id);
              }}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel={`Open ${app.name}`}
              accessibilityHint={app.description ?? `Launch the ${app.name} app`}
            >
              <View style={[
                styles.appCardGlassInner,
                settings.darkMode && styles.appCardGlassInnerDark
              ]}>
                <View style={styles.appIconGlassContainer}>
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
          ))}
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
    backgroundColor: '#1F2937',
  },
  loadingText: {
    marginTop: responsiveSpacing.md,
    fontSize: responsiveFontSize.md,
    color: '#6B7280',
  },
  loadingTextDark: {
    color: '#D1D5DB',
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
    color: '#111827',
    letterSpacing: -0.5,
  },
  headerTitleDark: {
    color: '#F9FAFB',
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
    color: '#1F2937',
    marginBottom: responsiveSpacing.xs,
    textAlign: 'center',
  },
  appNameDark: {
    color: '#FFFFFF',
  },
  appDescription: {
    fontSize: responsiveFontSize.xs,
    color: '#4B5563',
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
    color: '#111827',
    marginBottom: responsiveSpacing.md,
    textAlign: 'center',
  },
  noPhoneTitleDark: {
    color: '#F9FAFB',
  },
  noPhoneMessage: {
    fontSize: responsiveFontSize.base,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: responsiveFontSize.base * 1.4,
  },
  noPhoneMessageDark: {
    color: '#9CA3AF',
  },
});

export default React.memo(MobileScreen);

