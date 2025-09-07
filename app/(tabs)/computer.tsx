import React, { useState, useEffect } from 'react';
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
  Gamepad2
} from 'lucide-react-native';
import { useGame } from '@/contexts/GameContext';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from '@/hooks/useTranslation';
import BitcoinMiningApp from '@/components/computer/BitcoinMiningApp';
import RealEstateApp from '@/components/computer/RealEstateApp';
import OnionApp from '@/components/computer/OnionApp';
import GamingApp from '@/components/computer/GamingApp';
import HinderApp from '@/components/mobile/TinderApp';
import ContactsApp from '@/components/mobile/ContactsApp';
import SocialApp from '@/components/mobile/SocialApp';
import StocksApp from '@/components/mobile/StocksApp';
import CompanyApp from '@/components/mobile/CompanyApp';
import PetApp from '@/components/mobile/PetApp';
import EducationApp from '@/components/mobile/EducationApp';
import AdvancedBankApp from '@/components/computer/AdvancedBankApp';
import { 
  responsivePadding, 
  responsiveFontSize, 
  responsiveSpacing, 
  responsiveBorderRadius, 
  responsiveIconSize,
  isSmallDevice,
  isLargeDevice,
  screenDimensions
} from '@/utils/scaling';

const { width: screenWidth } = Dimensions.get('window');

export default function ComputerScreen() {
  const { t } = useTranslation();
  const [activeApp, setActiveApp] = useState<string | null>(null);
  const { gameState } = useGame();
  const { settings } = gameState;
  const navigation = useNavigation<any>();

  // Reset to apps grid when the Computer tab is pressed
  useEffect(() => {
    const unsubscribe = navigation.addListener('tabPress', () => {
      setActiveApp(null);
    });
    return unsubscribe;
  }, [navigation]);

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
      tinder: HinderApp,
      contacts: ContactsApp,
      social: SocialApp,
      stocks: StocksApp,
      bank: AdvancedBankApp,
      education: EducationApp,
      company: CompanyApp,
      paw: PetApp,
      gaming: GamingApp,
    };

    const AppComponent = apps[activeApp as keyof typeof apps];
    return <AppComponent onBack={() => setActiveApp(null)} />;
  }

  const apps = [
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
  ];

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

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={true}>
        <View style={styles.appsGrid}>
          {apps.map((app) => (
            <TouchableOpacity
              key={app.id}
              style={[styles.appCard, { width: (screenWidth - responsivePadding.horizontal * 2 - responsiveSpacing.md) / 2 }]}
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
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingTop: responsiveSpacing.xs,
  },
  appIconContainer: {
    marginBottom: responsiveSpacing.xs,
  },
  appIconGradient: {
    width: responsiveIconSize['2xl'],
    height: responsiveIconSize['2xl'],
    borderRadius: responsiveIconSize['2xl'] / 2,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 2,
    marginTop: 0, // No top margin
    marginBottom: 0, // No bottom margin
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
    lineHeight: responsiveFontSize.xs * 1.3,
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
});