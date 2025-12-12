import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
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
import { useTopStatsBarHeight } from '@/hooks/useTopStatsBarHeight';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLazyComponent, usePerformanceMonitor } from '@/utils/performanceOptimization';
import { useFeedback } from '@/utils/feedbackSystem';
import { DesignSystem } from '@/utils/designSystem';

import ErrorBoundary from '@/components/ErrorBoundary';

const { width: screenWidth } = Dimensions.get('window');

export default function MobileScreen() {
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
      colors={settings.darkMode ? ['#1E3A8A', '#1F2937'] : ['#FFFFFF', '#F8FAFC']}
      style={styles.container}
    >
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Smartphone size={32} color={settings.darkMode ? '#F9FAFB' : '#111827'} />
          <Text style={[styles.headerTitle, settings.darkMode && styles.headerTitleDark]}>
            {t('mobile.mobileApps')}
          </Text>
        </View>
        <Text style={[styles.headerSubtitle, settings.darkMode && styles.headerSubtitleDark]}>
          {t('mobile.accessSmartphoneApplications')}
        </Text>
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
              style={[styles.appCard, { width: cardWidth }]}
              onPress={() => {
                buttonPress();
                haptic('light');
                setActiveApp(app.id);
              }}
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
                    <app.icon size={responsiveIconSize.lg} color="#FFFFFF" />
                  </LinearGradient>
                </View>
                <Text style={styles.appName}>{app.name}</Text>
                <Text style={styles.appDescription}>{app.description}</Text>
              </LinearGradient>
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
    padding: responsiveSpacing.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  appIconContainer: {
    marginBottom: responsiveSpacing.sm,
  },
  appIconGradient: {
    width: responsiveIconSize['2xl'],
    height: responsiveIconSize['2xl'],
    borderRadius: responsiveIconSize['2xl'] / 2,
    justifyContent: 'center',
    alignItems: 'center',
    boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.2)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  appName: {
    fontSize: responsiveFontSize.sm,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: responsiveSpacing.xs,
    textAlign: 'center',
    textShadow: '0px 1px 2px rgba(0, 0, 0, 0.2)',
  },
  appDescription: {
    fontSize: responsiveFontSize.xs,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
    lineHeight: responsiveFontSize.xs * 1.4,
    textShadow: '0px 1px 1px rgba(0, 0, 0, 0.2)',
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
