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
const LinearGradient = LinearGradientFallback;
import { 
  Monitor, 
  ArrowLeft,
  Bitcoin,
  Home,
  Globe,
  Heart,
  Users,
  MessageCircle,
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

// Import app components directly (no lazy loading)
import BitcoinMiningApp from '@/components/computer/BitcoinMiningApp';
import RealEstateApp from '@/components/computer/RealEstateApp';
import OnionApp from '@/components/computer/OnionApp';
import GamingApp from '@/components/computer/GamingApp';
import GamingStreamingApp from '@/components/computer/GamingStreamingApp';
import DatingApp from '@/components/mobile/TinderApp';
import ContactsApp from '@/components/mobile/ContactsApp';
import SocialApp from '@/components/mobile/SocialApp';
import StocksApp from '@/components/mobile/StocksApp';
import CompanyApp from '@/components/mobile/CompanyApp';
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
  isSmallDevice,
  isLargeDevice,
  screenDimensions,
  isTablet,
  fontScale,
  scale,
} from '@/utils/scaling';
import { 
  getGlassHeader, 
  getGlassIconContainer, 
  getGlassCategoryTabsContainer,
  getGlassTab,
  getGlassAppCard,
} from '@/utils/glassmorphismStyles';
import { useTopStatsBarHeight } from '@/hooks/useTopStatsBarHeight';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import ErrorBoundary from '@/components/ErrorBoundary';

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
  const { highlightedItem, highlightMessage } = useTutorialHighlight();
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
    const ownsComputer = gameState.items.find(item => item.id === 'computer')?.owned;
    if (!ownsComputer && currentRoute === 'computer') {
      // Redirect to home tab if computer is sold
      router.replace('/(tabs)/');
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
      name: t('computer.hinder'),
      description: t('computer.findLoveRelationships'),
      icon: Heart,
      gradient: ['#FF4757', '#FF3742'], // Red gradient to match heart icon
      iconGradient: ['#FF4757', '#FF3742'],
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
      name: t('computer.social'),
      description: t('computer.shareLifeOnline'),
      icon: MessageCircle,
      gradient: ['#5F27CD', '#341F97'], // Purple gradient to match social icon
      iconGradient: ['#5F27CD', '#341F97'],
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
      name: t('computer.company'),
      description: t('computer.buildBusiness'),
      icon: Building,
      gradient: ['#5F27CD', '#341F97'], // Purple gradient to match company icon
      iconGradient: ['#5F27CD', '#341F97'],
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
      description: 'Manage your political career',
      icon: Vote,
      gradient: ['#DC2626', '#B91C1C'], // Red gradient for politics
      iconGradient: ['#DC2626', '#B91C1C'],
      available: gameState.careers.some(c => c.id === 'political' && c.accepted),
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
  ], [t, gameState.careers]);

  // Separate apps into categories
  const desktopApps = useMemo(() => appsList.filter(app => 
    ['bitcoin', 'realestate', 'onion', 'gaming', 'travel', 'political', 'statistics', 'vehicle', 'company', 'education'].includes(app.id)
  ), [appsList]);
  
  const mobileApps = useMemo(() => appsList.filter(app => 
    ['tinder', 'contacts', 'social', 'stocks', 'bank', 'paw'].includes(app.id)
  ), [appsList]);
  
  // Get apps for current category - filter by available status
  const displayedApps = useMemo(() => {
    const apps = appCategory === 'desktop' ? desktopApps : mobileApps;
    return apps.filter(app => app.available !== false);
  }, [appCategory, desktopApps, mobileApps]);

  if (!gameState.items.find(item => item.id === 'computer')?.owned) {
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
      social: SocialApp,
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
    
    return <AppComponent onBack={() => setActiveApp(null)} />;
  }

  const columns = 3;
  const cardGap = responsiveSpacing.sm;
  const horizontalPad = responsivePadding.horizontal;
  const cardWidth = (screenWidth - horizontalPad * 2 - cardGap * (columns - 1)) / columns;

  return (
    <LinearGradient
      colors={settings.darkMode ? ['#0F172A', '#1E293B', '#334155'] : ['#F0F4F8', '#E2E8F0', '#CBD5E1']}
      style={styles.container}
    >
      <View style={styles.header}>
        <View style={[styles.headerGlass, settings.darkMode && styles.headerGlassDark]}>
          <View style={styles.headerContent}>
            <View style={[styles.headerIconGlass, settings.darkMode && styles.headerIconGlassDark]}>
              <Monitor size={32} color={settings.darkMode ? '#F9FAFB' : '#111827'} />
            </View>
            <View style={styles.headerTextContainer}>
              <Text style={[styles.headerTitle, settings.darkMode && styles.headerTitleDark]}>
                {t('computer.desktopApps')}
              </Text>
              <Text style={[styles.headerSubtitle, settings.darkMode && styles.headerSubtitleDark]}>
                {t('computer.accessComputerApplications')}
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* Category Tabs - Glassmorphism */}
      <View style={styles.categoryTabsWrapper}>
        <View style={[styles.categoryTabsGlassContainer, settings.darkMode && styles.categoryTabsGlassContainerDark]}>
          <TouchableOpacity
            style={styles.categoryTabButton}
            onPress={() => setAppCategory('desktop')}
            activeOpacity={0.7}
          >
            {appCategory === 'desktop' ? (
              <LinearGradient
                colors={settings.darkMode ? ['#3B82F6', '#2563EB'] : ['#3B82F6', '#2563EB']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.categoryTabGlassActiveGradient}
              >
                <Text style={styles.categoryTabTextActive}>
                  Desktop Apps
                </Text>
              </LinearGradient>
            ) : (
              <View style={[
                styles.categoryTabGlass,
                settings.darkMode && styles.categoryTabGlassDark
              ]}>
                <Text style={[
                  styles.categoryTabText,
                  settings.darkMode && styles.categoryTabTextDark
                ]}>
                  Desktop Apps
                </Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.categoryTabButton}
            onPress={() => setAppCategory('mobile')}
            activeOpacity={0.7}
          >
            {appCategory === 'mobile' ? (
              <LinearGradient
                colors={settings.darkMode ? ['#3B82F6', '#2563EB'] : ['#3B82F6', '#2563EB']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.categoryTabGlassActiveGradient}
              >
                <Text style={styles.categoryTabTextActive}>
                  Mobile Apps
                </Text>
              </LinearGradient>
            ) : (
              <View style={[
                styles.categoryTabGlass,
                settings.darkMode && styles.categoryTabGlassDark
              ]}>
                <Text style={[
                  styles.categoryTabText,
                  settings.darkMode && styles.categoryTabTextDark
                ]}>
                  Mobile Apps
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView 
        style={styles.scrollView} 
        contentContainerStyle={styles.scrollContent}
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
  header: {
    paddingTop: responsivePadding.vertical,
    paddingBottom: responsiveSpacing.md,
    paddingHorizontal: responsivePadding.horizontal,
  },
  headerGlass: {
    ...getGlassHeader(false),
  },
  headerGlassDark: {
    ...getGlassHeader(true),
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: responsiveSpacing.md,
  },
  headerIconGlass: {
    ...getGlassIconContainer(false, 48),
  },
  headerIconGlassDark: {
    ...getGlassIconContainer(true, 48),
  },
  headerTextContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: responsiveFontSize['3xl'],
    fontWeight: '700',
    color: '#111827',
    marginBottom: scale(4),
    letterSpacing: -0.5,
  },
  headerTitleDark: {
    color: '#F9FAFB',
  },
  headerSubtitle: {
    fontSize: responsiveFontSize.sm,
    color: '#6B7280',
    fontWeight: '500',
  },
  headerSubtitleDark: {
    color: '#9CA3AF',
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
    fontSize: responsiveFontSize.xs,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: responsiveSpacing.xs / 2,
    textAlign: 'center',
  },
  appNameDark: {
    color: '#FFFFFF',
  },
  appDescription: {
    fontSize: fontScale(9),
    color: '#4B5563',
    textAlign: 'center',
    lineHeight: fontScale(9) * 1.4,
    fontWeight: '500',
    maxWidth: '90%',
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
    paddingBottom: responsiveSpacing.md,
  },
  categoryTabsGlassContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: responsiveBorderRadius.xl,
    padding: scale(4),
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    gap: scale(4),
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: scale(4) },
        shadowOpacity: 0.1,
        shadowRadius: scale(12),
      },
      android: {
        elevation: 4,
      },
      web: {
        boxShadow: '0px 4px 16px rgba(0, 0, 0, 0.1)',
      },
    }),
  },
  categoryTabsGlassContainerDark: {
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  categoryTabButton: {
    flex: 1,
    minHeight: scale(44),
  },
  categoryTabGlass: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.35)',
    borderRadius: responsiveBorderRadius.lg,
    paddingVertical: responsiveSpacing.md,
    paddingHorizontal: responsiveSpacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: scale(44),
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: scale(2) },
        shadowOpacity: 0.1,
        shadowRadius: scale(4),
      },
      android: {
        elevation: 2,
      },
      web: {
        boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.1)',
      },
    }),
  },
  categoryTabGlassDark: {
    backgroundColor: 'rgba(30, 41, 59, 0.5)',
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  categoryTabGlassActiveGradient: {
    borderRadius: responsiveBorderRadius.lg,
    paddingVertical: responsiveSpacing.md,
    paddingHorizontal: responsiveSpacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: scale(44),
    ...Platform.select({
      ios: {
        shadowColor: '#3B82F6',
        shadowOffset: { width: 0, height: scale(2) },
        shadowOpacity: 0.4,
        shadowRadius: scale(8),
      },
      android: {
        elevation: 6,
      },
      web: {
        boxShadow: '0px 2px 12px rgba(59, 130, 246, 0.4)',
      },
    }),
  },
  categoryTabText: {
    fontSize: responsiveFontSize.base,
    fontWeight: '600',
    color: '#374151',
    letterSpacing: 0.2,
  },
  categoryTabTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: responsiveFontSize.base,
    letterSpacing: 0.2,
  },
  categoryTabTextDark: {
    color: '#D1D5DB',
  },
});

export default React.memo(ComputerScreen);

