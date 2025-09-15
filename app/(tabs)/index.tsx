import React, { useEffect } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { useGame } from '@/contexts/GameContext';
import { useTutorial } from '@/contexts/UIUXContext';
import AchievementsProgress from '@/components/AchievementsProgress';
import WeeklyEventModal from '@/components/WeeklyEventModal';
import DailySummaryModal from '@/components/DailySummaryModal';
import IdentityCard from '@/components/IdentityCard';
import DeathPopup from '@/components/DeathPopup';
import ZeroStatPopup from '@/components/ZeroStatPopup';
import { getTutorialSteps } from '@/utils/tutorialData';
import { responsivePadding, verticalScale, responsiveFontSize, responsiveSpacing, scale, responsiveBorderRadius } from '@/utils/scaling';

export default function HomeScreen() {
  const { gameState, dismissWelcomePopup } = useGame();
  const { hasCompletedTutorial, startTutorial } = useTutorial();

  // Show tutorial for new users (replaces the old WelcomePopup)
  useEffect(() => {
    if (!hasCompletedTutorial && gameState.week === 1 && gameState.showWelcomePopup) {
      // Small delay to ensure the screen is fully loaded
      const timer = setTimeout(() => {
        dismissWelcomePopup(); // Dismiss the old welcome popup
        startTutorial(getTutorialSteps('game'));
      }, 1000);
      
      return () => clearTimeout(timer);
    }
  }, [hasCompletedTutorial, gameState.week, gameState.showWelcomePopup, startTutorial, dismissWelcomePopup]);

  return (
    <View style={[styles.container, gameState.settings.darkMode && styles.containerDark]}>
      <ScrollView style={styles.scrollContainer} showsVerticalScrollIndicator={true}>
        <IdentityCard />
        <AchievementsProgress />
      </ScrollView>


      {gameState.pendingEvents.length > 0 && <WeeklyEventModal />}
      <DailySummaryModal />
      {gameState.showZeroStatPopup && !gameState.dailySummary && <ZeroStatPopup />}
      {gameState.showDeathPopup && <DeathPopup />}
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
    paddingBottom: scale(100),
    paddingTop: verticalScale(20),
  },
  infoSection: {
    padding: responsivePadding.large,
  },
  sectionTitle: {
    fontSize: responsiveFontSize['2xl'],
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: responsiveSpacing.lg,
  },
  sectionTitleDark: {
    color: '#F9FAFB',
  },
  statusCard: {
    backgroundColor: '#FFFFFF',
    padding: responsiveSpacing.lg,
    borderRadius: responsiveBorderRadius.md,
    marginBottom: responsiveSpacing.md,
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
    fontSize: responsiveFontSize.lg,
    color: '#374151',
  },
  statusTextDark: {
    color: '#D1D5DB',
  },
});

export {};

