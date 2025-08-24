import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useGame } from '@/contexts/GameContext';
import { Monitor, Bitcoin, Chrome as Home, Heart, Users, MessageCircle, TrendingUp, CreditCard, GraduationCap, Building, Smartphone, Globe } from 'lucide-react-native';
import BitcoinMiningApp from '@/components/computer/BitcoinMiningApp';
import RealEstateApp from '@/components/computer/RealEstateApp';
import OnionApp from '@/components/computer/OnionApp';
import HinderApp from '@/components/mobile/TinderApp';
import ContactsApp from '@/components/mobile/ContactsApp';
import SocialApp from '@/components/mobile/SocialApp';
import StocksApp from '@/components/mobile/StocksApp';
import BankApp from '@/components/mobile/BankApp';
import EducationApp from '@/components/mobile/EducationApp';
import CompanyApp from '@/components/mobile/CompanyApp';

export default function ComputerScreen() {
  const [activeApp, setActiveApp] = useState<string | null>(null);
  const { gameState } = useGame();
  const { settings } = gameState;

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
            No Computer Available
          </Text>
          <Text style={[styles.noComputerMessage, settings.darkMode && styles.noComputerMessageDark]}>
            You need to buy a computer to access desktop applications. Visit the Market tab to purchase one!
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
      bank: BankApp,
      education: EducationApp,
      company: CompanyApp,
    };

    const AppComponent = apps[activeApp as keyof typeof apps];
    return <AppComponent onBack={() => setActiveApp(null)} />;
  }

  const apps = [
    {
      id: 'bitcoin',
      name: 'Bitcoin Mining',
      description: 'Mine cryptocurrency',
      icon: Bitcoin,
      color: ['#F7931A', '#FFB366'],
      gradient: ['#FFF7E6', '#FFE5B3'],
    },
    {
      id: 'realestate',
      name: 'Real Estate',
      description: 'Buy and manage properties',
      icon: Home,
      color: ['#10B981', '#34D399'],
      gradient: ['#D1FAE5', '#A7F3D0'],
    },
    {
      id: 'onion',
      name: 'Dark Web',
      description: 'Access the deep web',
      icon: Globe,
      color: ['#1F2937', '#374151'],
      gradient: ['#F3F4F6', '#E5E7EB'],
    },
    {
          id: 'tinder',
    name: 'Hinder',
      description: 'Find love and relationships',
      icon: Heart,
      color: ['#EF4444', '#F87171'],
      gradient: ['#FEE2E2', '#FECACA'],
    },
    {
      id: 'contacts',
      name: 'Contacts',
      description: 'Manage your relationships',
      icon: Users,
      color: ['#3B82F6', '#60A5FA'],
      gradient: ['#DBEAFE', '#BFDBFE'],
    },
    {
      id: 'social',
      name: 'Social',
      description: 'Share your life online',
      icon: MessageCircle,
      color: ['#8B5CF6', '#A78BFA'],
      gradient: ['#EDE9FE', '#DDD6FE'],
    },
    {
      id: 'stocks',
      name: 'Stocks',
      description: 'Trade and invest',
      icon: TrendingUp,
      color: ['#10B981', '#34D399'],
      gradient: ['#D1FAE5', '#A7F3D0'],
    },
    {
      id: 'bank',
      name: 'Bank',
      description: 'Manage your finances',
      icon: CreditCard,
      color: ['#F59E0B', '#FBBF24'],
      gradient: ['#FEF3C7', '#FDE68A'],
    },
    {
      id: 'education',
      name: 'Education',
      description: 'Learn and grow',
      icon: GraduationCap,
      color: ['#06B6D4', '#22D3EE'],
      gradient: ['#CFFAFE', '#A5F3FC'],
    },
    {
      id: 'company',
      name: 'Company',
      description: 'Build your business',
      icon: Building,
      color: ['#7C3AED', '#A78BFA'],
      gradient: ['#EDE9FE', '#DDD6FE'],
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
            Desktop Apps
          </Text>
        </View>
        <Text style={[styles.headerSubtitle, settings.darkMode && styles.headerSubtitleDark]}>
          Access your professional tools
        </Text>
      </View>

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.appsGrid}>
          {apps.map((app) => (
            <TouchableOpacity
              key={app.id}
              style={styles.appCard}
              onPress={() => setActiveApp(app.id)}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={app.gradient}
                style={styles.appCardGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <View style={styles.appIconContainer}>
                  <LinearGradient
                    colors={app.color}
                    style={styles.appIconGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  >
                    <app.icon size={28} color="#FFFFFF" />
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
    paddingTop: 20,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#111827',
    marginLeft: 12,
  },
  headerTitleDark: {
    color: '#F9FAFB',
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#6B7280',
    marginLeft: 44,
  },
  headerSubtitleDark: {
    color: '#9CA3AF',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  appsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  appCard: {
    width: '30%',
    aspectRatio: 1,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  appCardGradient: {
    flex: 1,
    borderRadius: 16,
    padding: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  appIconContainer: {
    marginBottom: 12,
  },
  appIconGradient: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  appName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 2,
    textAlign: 'center',
  },
  appDescription: {
    fontSize: 10,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 12,
  },
  noComputerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  noComputerIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(156, 163, 175, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  noComputerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 12,
    textAlign: 'center',
  },
  noComputerTitleDark: {
    color: '#F9FAFB',
  },
  noComputerMessage: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 24,
  },
  noComputerMessageDark: {
    color: '#9CA3AF',
  },
});