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
} from 'lucide-react-native';
import { useGame } from '@/contexts/GameContext';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from '@/hooks/useTranslation';
import { useTutorialHighlight } from '@/contexts/TutorialHighlightContext';
import { useRouter, useSegments } from 'expo-router';

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
import { useTopStatsBarHeight } from '@/hooks/useTopStatsBarHeight';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import ErrorBoundary from '@/components/ErrorBoundary';
import SegmentedControl from '@/components/ui/SegmentedControl';
import { ClaimableBadge } from '@/components/ClaimableBadge';
import { getAppBadgeCounts } from '@/lib/notifications/appBadges';
const LinearGradient = LinearGradientFallback;

const { width: screenWidth } = Dimensions.get('window');

function ComputerScreen() {
  return (
    <ErrorBoundary>
      <ComputerScreenContent />
    </ErrorBoundary>
  );
}

function ComputerScreenContent() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const topStatsBarHeight = useTopStatsBarHeight();
  const [activeApp, setActiveApp] = useState<string | null>(null);
  const [appCategory, setAppCategory] = useState<'desktop' | 'mobile'>('desktop');
  const { gameState } = useGame();
  const { highlightedItem } = useTutorialHighlight();
  const { settings } = gameState;
  const router = useRouter();
  const segments = useSegments();
  const currentRoute = segments.length > 0 ? segments[segments.length - 1] : null;

  // Prevent staying on computer screen when in prison - redirect to work tab
  useEffect(() => {
    if (gameState.jailWeeks > 0) {
      router.replace('/(tabs)/work');
    }
  }, [gameState.jailWeeks, router]);

  // Redirect away from computer screen if computer is sold
  useEffect(() => {
    const ownsComputer = (gameState.items || []).find(item => item.id === 'computer')?.owned;
    if (!ownsComputer && currentRoute === 'computer') {
      // Redirect to home tab if computer is sold
      router.replace('/(tabs)/home');
    }
  }, [gameState.items, router]);
  const navigation = useNavigation<any>();

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
      gradient: ['#F43F5E', '#FB923C'], // Rose → orange — Spark brand gradient
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
      gradient: ['#6366F1', '#06B6D4'], // Indigo → cyan — Hustle brand gradient
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
  ], [t]);

  // Separate apps into categories
  const desktopApps = useMemo(() => appsList.filter(app => 
    ['bitcoin', 'realestate', 'onion', 'gaming', 'streaming', 'travel', 'political', 'statistics', 'vehicle', 'company', 'education'].includes(app.id)
  ), [appsList]);
  
  const mobileApps = useMemo(() => appsList.filter(app => 
    ['tinder', 'contacts', 'social', 'stocks', 'bank', 'paw'].includes(app.id)
  ), [appsList]);
  
  // Get apps for current category - filter by available status
  const displayedApps = useMemo(() => {
    const apps = appCategory === 'desktop' ? desktopApps : mobileApps;
    return apps.filter(app => app.available !== false);
  }, [appCategory, desktopApps, mobileApps]);

  // Per-app "needs attention" badge counts — computed before any early return.
  const appBadges = useMemo(
    () => getAppBadgeCounts(gameState),
    [gameState.sparkApp, gameState.socialMedia?.activeScandal, gameState.pets, gameState.companies],
  );

  if (!(gameState.items || []).find(item => item.id === 'computer')?.owned) {
    return (
      <LinearGradient
        colors={settings.darkMode ? ['#1E3A8A', '#1F2937'] : ['#FFFFFF', '#F8FAFC']}
        style={styles.container}
      >
        <View style={styles.noComputerContainer}>
          <View style={styles.noComputerIconContainer}>
            <Monitor size={80} color={settings.darkMode ? '#6B7280' : '#9CA3AF'} />
          </View>
          <Text style={[styles.noComputerTitle, settings.darkMode && styles.noComputerTitleDark]}>
            {t('computer.noComputerAvailable')}
          </Text>
          <Text style={[styles.noComputerMessage, settings.darkMode && styles.noComputerMessageDark]}>
            {t('computer.noComputerMessage')}
          </Text>
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
      social: PulseApp,
      stocks: StocksApp,
      bank: AdvancedBankApp,
      education: EducationApp,
      company: CompanyApp,
      paw: PetApp,
      gaming: GamingApp,
      streaming: GamingStreamingApp,
      travel: TravelApp,
      political: PoliticalApp,
      statistics: StatisticsApp,
      vehicle: VehicleApp,
    };

    const AppComponent = apps[activeApp as keyof typeof apps];

    // P2-15: a stale/unknown activeApp id makes AppComponent undefined →
    // "Element type is invalid" hard crash. Reset to the grid instead.
    if (!AppComponent) {
      setActiveApp(null);
      return null;
    }

    return <AppComponent onBack={() => setActiveApp(null)} />;
  }

  // Mirror mobile.tsx's responsive column count so both app-grid tabs scale
  // identically on phones vs tablets. Computer keeps its denser default
  // (3 cols on phone, 4 on tablet) — mobile is 2 / 3.
  const columns = isTablet() ? 4 : 3;
  const cardGap = responsiveSpacing.sm;
  const horizontalPad = responsivePadding.horizontal;
  const cardWidth = (screenWidth - horizontalPad * 2 - cardGap * (columns - 1)) / columns;

  return (
    <LinearGradient
      colors={settings.darkMode ? ['#0F172A', '#1E293B', '#334155'] : ['#F0F4F8', '#E2E8F0', '#CBD5E1']}
      style={styles.container}
    >
      {/* Category segmented control */}
      <View style={styles.categoryTabsWrapper}>
        <SegmentedControl
          segments={[
            { key: 'desktop', label: 'Desktop Apps' },
            { key: 'mobile', label: 'Mobile Apps' },
          ]}
          value={appCategory}
          onChange={setAppCategory}
        />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: getTabBarSafePadding(insets.bottom) }]}
        showsVerticalScrollIndicator={true}
      >
        <View style={styles.appsGrid}>
          {displayedApps.map((app) => {
            const isHighlighted = highlightedItem === 'stock-app' && app.id === 'stocks';
            return (
              <TouchableOpacity
                key={app.id}
                style={[
                  styles.appCardGlass,
                  { width: cardWidth },
                  isHighlighted && styles.highlightedCardGlass
                ]}
                onPress={() => setActiveApp(app.id)}
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
                        <app.icon size={responsiveIconSize.md} color="#FFFFFF" />
                      </LinearGradient>
                    </View>
                  </View>
                  <Text style={[styles.appName, settings.darkMode && styles.appNameDark]}>
                    {app.name}
                  </Text>
                  <Text style={[styles.appDescription, settings.darkMode && styles.appDescriptionDark]}>
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
    aspectRatio: 1,
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
    justifyContent: 'center',
    alignItems: 'center',
  },
  appCardGlassInnerDark: {
    ...getGlassAppCard(true),
  },
  appIconGlassContainer: {
    marginBottom: responsiveSpacing.sm,
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
    color: '#1F2937',
    marginBottom: responsiveSpacing.xs / 2,
    textAlign: 'center',
  },
  appNameDark: {
    color: '#FFFFFF',
  },
  appDescription: {
    fontSize: fontScale(10.5),
    color: '#4B5563',
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
    color: '#111827',
    marginBottom: responsiveSpacing.md,
    textAlign: 'center',
  },
  noComputerTitleDark: {
    color: '#F9FAFB',
  },
  noComputerMessage: {
    fontSize: responsiveFontSize.base,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: responsiveFontSize.base * 1.4,
  },
  noComputerMessageDark: {
    color: '#9CA3AF',
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

