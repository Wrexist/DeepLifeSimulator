import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, Text, TouchableOpacity } from 'react-native';
import { useGame } from '@/contexts/GameContext';
import { useTutorial } from '@/contexts/UIUXContext';
import AchievementsProgress from '@/components/AchievementsProgress';
import WeeklyEventModal from '@/components/WeeklyEventModal';
import DailySummaryModal from '@/components/DailySummaryModal';
import DailyRewardPopup from '@/components/DailyRewardPopup';
import DailyChallengesModal from '@/components/DailyChallengesModal';
import IdentityCard from '@/components/IdentityCard';
import DeathPopup from '@/components/DeathPopup';
import ZeroStatPopup from '@/components/ZeroStatPopup';
import GoalCompletionPopup from '@/components/GoalCompletionPopup';
import { getEnhancedTutorialSteps } from '@/utils/enhancedTutorialData';
import { responsivePadding, verticalScale, responsiveFontSize, responsiveSpacing, scale, responsiveBorderRadius } from '@/utils/scaling';
import { Target, CheckCircle, Zap } from 'lucide-react-native';
import { getNextGoal, checkGoalCompletion, Goal, GoalReward } from '@/utils/goalSystem';
import { LinearGradient } from 'expo-linear-gradient';
import { generateDailyChallenges } from '@/utils/dailyChallenges';

// Next Goal Card Component
function NextGoalCard() {
  const { gameState } = useGame();
  
  // Get the next goal using the goal system
  const goal = getNextGoal(gameState);
  
  if (!goal) {
    return (
      <View style={[styles.nextGoalCard, gameState.settings.darkMode && styles.nextGoalCardDark]}>
        <View style={styles.nextGoalHeader}>
          <Target size={20} color="#10B981" style={styles.nextGoalIcon} />
          <Text style={[styles.nextGoalTitle, gameState.settings.darkMode && styles.nextGoalTitleDark]}>
            All Goals Completed!
          </Text>
        </View>
        <Text style={[styles.nextGoalDescription, gameState.settings.darkMode && styles.nextGoalDescriptionDark]}>
          You've achieved all available goals. Keep exploring and living your best life!
        </Text>
      </View>
    );
  }

  const RewardIcon = goal.reward.icon;

  return (
    <View style={[styles.nextGoalCard, gameState.settings.darkMode && styles.nextGoalCardDark]}>
      <View style={styles.nextGoalHeader}>
        <Target size={20} color="#3B82F6" style={styles.nextGoalIcon} />
        <Text style={[styles.nextGoalTitle, gameState.settings.darkMode && styles.nextGoalTitleDark]}>
          Next Goal
        </Text>
      </View>
      
      <Text style={[styles.nextGoalDescription, gameState.settings.darkMode && styles.nextGoalDescriptionDark]}>
        {goal.description}
      </Text>
      
      <View style={styles.nextGoalProgress}>
        <Text style={[styles.nextGoalProgressText, gameState.settings.darkMode && styles.nextGoalProgressTextDark]}>
          {goal.title}
        </Text>
        <View style={[styles.nextGoalProgressBar, gameState.settings.darkMode && styles.nextGoalProgressBarDark]}>
          <View 
            style={[
              styles.nextGoalProgressFill, 
              { width: `${goal.progress}%` }
            ]} 
          />
        </View>
      </View>

      {/* Reward Preview */}
      <View style={styles.rewardPreview}>
        <RewardIcon size={16} color={goal.reward.color} />
        <Text style={[styles.rewardText, gameState.settings.darkMode && styles.rewardTextDark]}>
          Reward: +{goal.reward.amount} {goal.reward.type === 'money' ? '$' : 
            goal.reward.type === 'gems' ? 'gems' : goal.reward.type}
        </Text>
      </View>
    </View>
  );
}

export default function HomeScreen() {
  const { gameState, dismissWelcomePopup, setGameState } = useGame();
  const { hasCompletedTutorial, startTutorial } = useTutorial();
  const [showGoalCompletion, setShowGoalCompletion] = useState(false);
  const [completedGoal, setCompletedGoal] = useState<Goal | null>(null);
  const [nextGoal, setNextGoal] = useState<Goal | null>(null);
  const [showDailyChallenges, setShowDailyChallenges] = useState(false);

  // Calculate unclaimed challenges
  const getUnclaimedCount = () => {
    if (!gameState.dailyChallenges) return 0;
    const todaysChallenges = generateDailyChallenges();
    let count = 0;
    
    if (gameState.dailyChallenges.easy.progress >= todaysChallenges.easy.maxProgress && !gameState.dailyChallenges.easy.claimed) count++;
    if (gameState.dailyChallenges.medium.progress >= todaysChallenges.medium.maxProgress && !gameState.dailyChallenges.medium.claimed) count++;
    if (gameState.dailyChallenges.hard.progress >= todaysChallenges.hard.maxProgress && !gameState.dailyChallenges.hard.claimed) count++;
    
    return count;
  };

  const unclaimedCount = getUnclaimedCount();

  // Check for goal completion
  useEffect(() => {
    const { completedGoal: newCompletedGoal, nextGoal: newNextGoal } = checkGoalCompletion(gameState);
    
    if (newCompletedGoal && !showGoalCompletion) {
      setCompletedGoal(newCompletedGoal);
      setNextGoal(newNextGoal);
      setShowGoalCompletion(true);
      
      // Apply reward
      const reward = newCompletedGoal.reward;
      const newStats = { ...gameState.stats };
      
      switch (reward.type) {
        case 'money':
          newStats.money += reward.amount;
          break;
        case 'gems':
          newStats.gems += reward.amount;
          break;
        case 'happiness':
          newStats.happiness = Math.min(100, newStats.happiness + reward.amount);
          break;
        case 'energy':
          newStats.energy = Math.min(100, newStats.energy + reward.amount);
          break;
        case 'health':
          newStats.health = Math.min(100, newStats.health + reward.amount);
          break;
      }
      
      // Update game state with reward and mark goal as completed
      setGameState(prev => ({
        ...prev,
        stats: newStats,
        completedGoals: [...(prev.completedGoals || []), newCompletedGoal.id]
      }));
    }
  }, [gameState.stats, gameState.week, gameState.currentJob, gameState.bankSavings, gameState.completedGoals]);

  // Show tutorial for new users (replaces the old WelcomePopup)
  useEffect(() => {
    if (!hasCompletedTutorial && gameState.week === 1 && gameState.showWelcomePopup) {
      // Small delay to ensure the screen is fully loaded
      const timer = setTimeout(() => {
        dismissWelcomePopup(); // Dismiss the old welcome popup
        startTutorial(getEnhancedTutorialSteps('game')); // Start the old tutorial system
      }, 1000);
      
      return () => clearTimeout(timer);
    }
  }, [hasCompletedTutorial, gameState.week, gameState.showWelcomePopup, startTutorial, dismissWelcomePopup]);

  return (
    <View style={[styles.container, gameState.settings.darkMode && styles.containerDark]}>
      <ScrollView style={styles.scrollContainer} showsVerticalScrollIndicator={true}>
        <IdentityCard />
        
        {/* Next Goal Section */}
        <NextGoalCard />
        
        <AchievementsProgress />
      </ScrollView>


      {gameState.pendingEvents.length > 0 && <WeeklyEventModal />}
      <DailySummaryModal />
      {gameState.showZeroStatPopup && !gameState.dailySummary && <ZeroStatPopup />}
      {gameState.showDeathPopup && <DeathPopup />}
      <GoalCompletionPopup 
        visible={showGoalCompletion}
        completedGoal={completedGoal}
        nextGoal={nextGoal}
        onClose={() => setShowGoalCompletion(false)}
        darkMode={gameState.settings.darkMode}
      />
      <DailyRewardPopup
        visible={gameState.showDailyRewardPopup || false}
        rewardAmount={gameState.dailyRewardAmount || 0}
        onClose={() => setGameState(prev => ({ 
          ...prev, 
          showDailyRewardPopup: false,
          dailyRewardAmount: undefined,
        }))}
      />
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
  nextGoalCard: {
    margin: responsiveSpacing.lg,
    marginBottom: responsiveSpacing.md,
    padding: responsiveSpacing.lg,
    backgroundColor: '#FFFFFF',
    borderRadius: responsiveBorderRadius.lg,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    borderLeftWidth: 4,
    borderLeftColor: '#3B82F6',
  },
  nextGoalCardDark: {
    backgroundColor: '#1F2937',
    borderLeftColor: '#60A5FA',
  },
  nextGoalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: responsiveSpacing.sm,
  },
  nextGoalIcon: {
    marginRight: responsiveSpacing.sm,
  },
  nextGoalTitle: {
    fontSize: responsiveFontSize.lg,
    fontWeight: '600',
    color: '#1F2937',
  },
  nextGoalTitleDark: {
    color: '#F9FAFB',
  },
  nextGoalDescription: {
    fontSize: responsiveFontSize.sm,
    color: '#6B7280',
    lineHeight: 20,
    marginBottom: responsiveSpacing.sm,
  },
  nextGoalDescriptionDark: {
    color: '#9CA3AF',
  },
  nextGoalProgress: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  nextGoalProgressText: {
    fontSize: responsiveFontSize.sm,
    color: '#374151',
    fontWeight: '500',
  },
  nextGoalProgressTextDark: {
    color: '#D1D5DB',
  },
  nextGoalProgressBar: {
    flex: 1,
    height: 6,
    backgroundColor: '#E5E7EB',
    borderRadius: responsiveBorderRadius.sm,
    marginLeft: responsiveSpacing.md,
    overflow: 'hidden',
  },
  nextGoalProgressBarDark: {
    backgroundColor: '#4B5563',
  },
  nextGoalProgressFill: {
    height: '100%',
    backgroundColor: '#3B82F6',
    borderRadius: responsiveBorderRadius.sm,
  },
  rewardPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: responsiveSpacing.sm,
    padding: responsiveSpacing.sm,
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderRadius: responsiveBorderRadius.sm,
    borderLeftWidth: 3,
    borderLeftColor: '#F59E0B',
  },
  rewardText: {
    fontSize: responsiveFontSize.sm,
    fontWeight: '600',
    color: '#374151',
    marginLeft: responsiveSpacing.xs,
  },
  rewardTextDark: {
    color: '#D1D5DB',
  },
});

