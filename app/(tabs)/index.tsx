import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { useGame } from '@/contexts/GameContext';
import WelcomePopup from '@/components/WelcomePopup';
import AchievementsProgress from '@/components/AchievementsProgress';
import WeeklyEventModal from '@/components/WeeklyEventModal';
import IdentityCard from '@/components/IdentityCard';
import TombstonePopup from '@/components/TombstonePopup';
import ZeroStatPopup from '@/components/ZeroStatPopup';

export default function HomeScreen() {
  const { gameState } = useGame();

  return (
    <View style={[styles.container, gameState.settings.darkMode && styles.containerDark]}>
      <ScrollView style={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        <IdentityCard />
        <AchievementsProgress />
      </ScrollView>

      {gameState.settings.notificationsEnabled && gameState.showWelcomePopup && <WelcomePopup />}
      {gameState.pendingEvents.length > 0 && <WeeklyEventModal />}
      {gameState.showZeroStatPopup && !gameState.dailySummary && <ZeroStatPopup />}
      {gameState.showDeathPopup && <TombstonePopup />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  containerDark: {
    backgroundColor: '#111827',
  },
  scrollContainer: {
    flex: 1,
    paddingBottom: 100,
    paddingTop: 20,
  },
  infoSection: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 15,
  },
  sectionTitleDark: {
    color: '#F9FAFB',
  },
  statusCard: {
    backgroundColor: '#FFFFFF',
    padding: 15,
    borderRadius: 12,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  statusCardDark: {
    backgroundColor: '#374151',
  },
  statusText: {
    fontSize: 16,
    color: '#374151',
  },
  statusTextDark: {
    color: '#D1D5DB',
  },
});

export {};

