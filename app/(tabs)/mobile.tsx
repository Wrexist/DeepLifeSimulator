import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Dimensions,
  Platform,
} from 'react-native';
import LinearGradientFallback from '@/components/fallbacks/LinearGradientFallback';
const LinearGradient = LinearGradientFallback;
import { 
  Smartphone, 
  ArrowLeft,
  Heart,
  Users,
  MessageCircle,
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

// Import mobile app components directly (no lazy loading)
import DatingApp from '@/components/mobile/TinderApp';
import ContactsApp from '@/components/mobile/ContactsApp';
import SocialApp from '@/components/mobile/SocialApp';
import StocksApp from '@/components/mobile/StocksApp';
import BankApp from '@/components/mobile/BankApp';
import EducationApp from '@/components/mobile/EducationApp';
import CompanyApp from '@/components/mobile/CompanyApp';
import PetApp from '@/components/mobile/PetApp';

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
  scale,
} from '@/utils/scaling';
import { 
  getGlassHeader, 
  getGlassIconContainer, 
  getGlassAppCard,
} from '@/utils/glassmorphismStyles';
import { useTopStatsBarHeight } from '@/hooks/useTopStatsBarHeight';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLazyComponent, usePerformanceMonitor } from '@/utils/performanceOptimization';
import { useFeedback } from '@/utils/feedbackSystem';
import { DesignSystem } from '@/utils/designSystem';

import ErrorBoundary from '@/components/ErrorBoundary';

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
  const [contentHeight, setContentHeight] = useState(1);
  const [visibleHeight, setVisibleHeight] = useState(1);
  const [scrollY, setScrollY] = useState(0);

  // Prevent staying on mobile screen when in prison - redirect to work tab
  useEffect(() => {
    if (gameState.jailWeeks > 0) {
      router.replace('/(tabs)/work');
    }
  }, [gameState.jailWeeks, router]);
  
  const { settings } = gameState;
  const navigation = useNavigation<any>();
  const { buttonPress, haptic } = useFeedback(gameState.settings.hapticFeedback);
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
      name: t('mobile.dating'),
      description: t('mobile.findLoveRelationships'),
      icon: Heart,
      gradient: ['#FF4757', '#FF3742'], // Red gradient to match heart icon
      iconGradient: ['#FF4757', '#FF3742'],
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
      name: t('mobile.social'),
      description: t('mobile.shareLifeOnline'),
      icon: MessageCircle,
      gradient: ['#5F27CD', '#341F97'], // Purple gradient to match social icon
      iconGradient: ['#5F27CD', '#341F97'],
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
      name: t('mobile.company') || 'Company',
      description: t('mobile.buildBusiness') || 'Build and manage your business',
      icon: Building,
      gradient: ['#5F27CD', '#341F97'], // Purple gradient for company
      iconGradient: ['#5F27CD', '#341F97'],
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

  if (!gameState.items.find(item => item.id === 'smartphone')?.owned) {
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
      social: SocialApp,
      stocks: StocksApp,
      bank: BankApp,
      education: EducationApp,
      company: CompanyApp,
      pet: PetApp,
    };

    const AppComponent = apps[activeApp as keyof typeof apps];
    return (
      <AppComponent onBack={() => {
        buttonPress();
        haptic('light');
        setActiveApp(null);
      }} />
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
        <View style={[styles.headerGlass, settings.darkMode && styles.headerGlassDark]}>
          <View style={styles.headerContent}>
            <View style={[styles.headerIconGlass, settings.darkMode && styles.headerIconGlassDark]}>
              <Smartphone size={32} color={settings.darkMode ? '#F9FAFB' : '#111827'} />
            </View>
            <View style={styles.headerTextContainer}>
              <Text style={[styles.headerTitle, settings.darkMode && styles.headerTitleDark]}>
                {t('mobile.mobileApps')}
              </Text>
              <Text style={[styles.headerSubtitle, settings.darkMode && styles.headerSubtitleDark]}>
                {t('mobile.accessSmartphoneApplications')}
              </Text>
            </View>
          </View>
        </View>
      </View>

      <ScrollView 
        style={styles.scrollView} 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={true}
      >
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
                <Text style={[styles.appName, settings.darkMode && styles.appNameDark]}>
                  {app.name}
                </Text>
                <Text style={[styles.appDescription, settings.darkMode && styles.appDescriptionDark]}>
                  {app.description}
                </Text>
              </View>
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

