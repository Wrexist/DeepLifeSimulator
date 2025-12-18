import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
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
} from 'lucide-react-native';
import { useGame } from '@/contexts/GameContext';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from '@/hooks/useTranslation';
import { useTutorialHighlight } from '@/contexts/TutorialHighlightContext';
import { useRouter } from 'expo-router';

// Import app components directly (no lazy loading)
import BitcoinMiningApp from '@/components/computer/BitcoinMiningApp';
import RealEstateApp from '@/components/computer/RealEstateApp';
import OnionApp from '@/components/computer/OnionApp';
import GamingApp from '@/components/computer/GamingApp';
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
import { useTopStatsBarHeight } from '@/hooks/useTopStatsBarHeight';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import ErrorBoundary from '@/components/ErrorBoundary';

const { width: screenWidth } = Dimensions.get('window');

export default function ComputerScreen() {
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

  // Prevent staying on computer screen when in prison - redirect to work tab
  useEffect(() => {
    if (gameState.jailWeeks > 0) {
      router.replace('/(tabs)/work');
    }
  }, [gameState.jailWeeks, router]);
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
    ['bitcoin', 'realestate', 'onion', 'gaming', 'travel', 'political', 'statistics', 'vehicle'].includes(app.id)
  ), [appsList]);
  
  const mobileApps = useMemo(() => appsList.filter(app => 
    ['tinder', 'contacts', 'social', 'stocks', 'bank', 'education', 'company', 'paw'].includes(app.id)
  ), [appsList]);
  
  // Get apps for current category
  const displayedApps = appCategory === 'desktop' ? desktopApps : mobileApps;

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
      colors={settings.darkMode ? ['#1E3A8A', '#1F2937'] : ['#FFFFFF', '#F8FAFC']}
      style={styles.container}
    >
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Monitor size={32} color={settings.darkMode ? '#F9FAFB' : '#111827'} />
          <Text style={[styles.headerTitle, settings.darkMode && styles.headerTitleDark]}>
            {t('computer.desktopApps')}
          </Text>
        </View>
        <Text style={[styles.headerSubtitle, settings.darkMode && styles.headerSubtitleDark]}>
          {t('computer.accessComputerApplications')}
        </Text>
      </View>

      {/* Category Tabs */}
      <View style={[
        styles.categoryTabsContainer,
        { borderBottomColor: settings.darkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)' }
      ]}>
        <TouchableOpacity
          style={[
            styles.categoryTab,
            appCategory === 'desktop' && styles.categoryTabActive,
          ]}
          onPress={() => setAppCategory('desktop')}
          activeOpacity={0.7}
        >
          <LinearGradient
            colors={appCategory === 'desktop' 
              ? (settings.darkMode ? ['#3B82F6', '#2563EB'] : ['#3B82F6', '#2563EB'])
              : (settings.darkMode ? ['#374151', '#4B5563'] : ['#E5E7EB', '#D1D5DB'])
            }
            style={styles.categoryTabGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            <Text style={[
              styles.categoryTabText,
              appCategory === 'desktop' && styles.categoryTabTextActive,
              settings.darkMode && styles.categoryTabTextDark,
            ]}>
              Desktop Apps
            </Text>
          </LinearGradient>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.categoryTab,
            appCategory === 'mobile' && styles.categoryTabActive,
          ]}
          onPress={() => setAppCategory('mobile')}
          activeOpacity={0.7}
        >
          <LinearGradient
            colors={appCategory === 'mobile'
              ? (settings.darkMode ? ['#3B82F6', '#2563EB'] : ['#3B82F6', '#2563EB'])
              : (settings.darkMode ? ['#374151', '#4B5563'] : ['#E5E7EB', '#D1D5DB'])
            }
            style={styles.categoryTabGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            <Text style={[
              styles.categoryTabText,
              appCategory === 'mobile' && styles.categoryTabTextActive,
              settings.darkMode && styles.categoryTabTextDark,
            ]}>
              Mobile Apps
            </Text>
          </LinearGradient>
        </TouchableOpacity>
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
                  styles.appCard, 
                  { width: cardWidth },
                  isHighlighted && styles.highlightedCard
                ]}
                onPress={() => setActiveApp(app.id)}
                activeOpacity={0.8}
              >
              <LinearGradient
                colors={app.gradient as [string, string]}
                style={styles.appCardGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <View style={styles.appIconContainer}>
                  <LinearGradient
                    colors={app.iconGradient as [string, string]}
                    style={styles.appIconGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  >
                    <app.icon size={responsiveIconSize.md} color="#FFFFFF" />
                  </LinearGradient>
                </View>
                <Text style={styles.appName}>{app.name}</Text>
                <Text style={styles.appDescription}>{app.description}</Text>
              </LinearGradient>
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
    paddingBottom: responsivePadding.vertical,
    paddingHorizontal: responsivePadding.horizontal,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: responsiveSpacing.sm,
  },
  headerTitle: {
    fontSize: responsiveFontSize['3xl'],
    fontWeight: 'bold',
    color: '#111827',
    marginLeft: responsiveSpacing.md,
  },
  headerTitleDark: {
    color: '#F9FAFB',
  },
  headerSubtitle: {
    fontSize: responsiveFontSize.lg,
    color: '#6B7280',
    marginLeft: responsiveSpacing.xl + responsiveSpacing.md,
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
  appCard: {
    aspectRatio: 1,
    borderRadius: responsiveBorderRadius.lg,
    boxShadow: '0px 2px 6px rgba(0, 0, 0, 0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
    overflow: 'hidden',
  },
  appCardGradient: {
    flex: 1,
    borderRadius: responsiveBorderRadius.lg,
    padding: responsiveSpacing.xs,
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingTop: responsiveSpacing.xs,
  },
  appIconContainer: {
    marginBottom: responsiveSpacing.xs,
  },
  appIconGradient: {
    width: responsiveIconSize.xl,
    height: responsiveIconSize.xl,
    borderRadius: responsiveIconSize.xl / 2,
    justifyContent: 'center',
    alignItems: 'center',
    boxShadow: '0px 1px 3px rgba(0, 0, 0, 0.15)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 2,
    marginTop: 0, // No top margin
    marginBottom: 0, // No bottom margin
  },
  appName: {
    fontSize: responsiveFontSize.xs,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: responsiveSpacing.xs / 2,
    textAlign: 'center',
    textShadow: '0px 1px 2px rgba(0, 0, 0, 0.2)',
  },
  appDescription: {
    fontSize: fontScale(9),
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
    lineHeight: fontScale(9) * 1.3,
    textShadow: '0px 1px 1px rgba(0, 0, 0, 0.2)',
    maxWidth: '90%', // Prevent text from overflowing
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
  highlightedCard: {
    boxShadow: '0px 0px 15px rgba(245, 158, 11, 1)',
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 15,
    elevation: 12,
    transform: [{ scale: 1.02 }],
  },
  categoryTabsContainer: {
    flexDirection: 'row',
    paddingHorizontal: responsivePadding.horizontal,
    paddingVertical: responsiveSpacing.sm,
    gap: responsiveSpacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  categoryTab: {
    flex: 1,
    borderRadius: responsiveBorderRadius.md,
    overflow: 'hidden',
  },
  categoryTabActive: {
    // Active state handled by gradient
  },
  categoryTabGradient: {
    paddingVertical: responsiveSpacing.sm,
    paddingHorizontal: responsiveSpacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryTabText: {
    fontSize: responsiveFontSize.sm,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  categoryTabTextActive: {
    color: '#FFFFFF',
  },
  categoryTabTextDark: {
    color: '#FFFFFF',
  },
});
