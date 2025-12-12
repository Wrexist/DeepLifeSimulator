import React, { useEffect, useState, lazy, Suspense } from 'react';
import { View, StyleSheet, ScrollView, Text, TouchableOpacity, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import LoadingSpinner from '@/components/LoadingSpinner';
import { useGame } from '@/contexts/GameContext';
import { useTutorial } from '@/contexts/UIUXContext';
import AchievementsProgress from '@/components/AchievementsProgress';
import IdentityCard from '@/components/IdentityCard';
import PrestigeButton from '@/components/PrestigeButton';
import PrestigeStatsCard from '@/components/PrestigeStatsCard';
import PrestigePreviewCard from '@/components/PrestigePreviewCard';
import PrestigeModal from '@/components/PrestigeModal';
import PrestigeShopModal from '@/components/PrestigeShopModal';
import PrestigeInfoModal from '@/components/PrestigeInfoModal';
import { getEnhancedTutorialSteps } from '@/utils/enhancedTutorialData';
import { responsivePadding, verticalScale, responsiveFontSize, responsiveSpacing, scale, responsiveBorderRadius } from '@/utils/scaling';
import { useTopStatsBarHeight } from '@/hooks/useTopStatsBarHeight';
import { Target, CheckCircle, Zap } from 'lucide-react-native';
import { getNextGoal, checkGoalCompletion, Goal, GoalReward } from '@/utils/goalSystem';
import { LinearGradient } from 'expo-linear-gradient';
import { generateDailyChallenges } from '@/utils/dailyChallenges';

// Lazy load heavy modals and popups
const WeeklyEventModal = lazy(() => import('@/components/WeeklyEventModal'));
const DailyRewardPopup = lazy(() => import('@/components/DailyRewardPopup'));
const WelcomeBackPopup = lazy(() => import('@/components/WelcomeBackPopup'));
const DailyChallengesModal = lazy(() => import('@/components/DailyChallengesModal'));
const GoalCompletionPopup = lazy(() => import('@/components/GoalCompletionPopup'));

const ModalFallback = () => (
  <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', minHeight: 200 }}>
    <LoadingSpinner visible size="large" color="#3B82F6" variant="compact" />
  </View>
);

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
  const insets = useSafeAreaInsets();
  const topStatsBarHeight = useTopStatsBarHeight();
  const { gameState, dismissWelcomePopup, setGameState } = useGame();
  const { hasCompletedTutorial, startTutorial } = useTutorial();
  const [showGoalCompletion, setShowGoalCompletion] = useState(false);
  const [completedGoal, setCompletedGoal] = useState<Goal | null>(null);
  const [nextGoal, setNextGoal] = useState<Goal | null>(null);
  const [showDailyChallenges, setShowDailyChallenges] = useState(false);
  const [showWelcomeBack, setShowWelcomeBack] = useState(false);
  const [showPrestigeModal, setShowPrestigeModal] = useState(false);
  const [showPrestigeShop, setShowPrestigeShop] = useState(false);
  const [showPrestigeInfo, setShowPrestigeInfo] = useState(false);

  const router = useRouter();

  // Prevent staying on home screen when in prison - redirect to work tab
  useEffect(() => {
    if (gameState.jailWeeks > 0) {
      router.replace('/(tabs)/work');
    }
  }, [gameState.jailWeeks, router]);

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
      // Dismiss welcome popup immediately to prevent overlap
      dismissWelcomePopup();
      
      // Small delay to ensure the screen is fully loaded before starting tutorial
      const timer = setTimeout(() => {
        startTutorial(getEnhancedTutorialSteps('game'));
      }, 500);
      
      return () => clearTimeout(timer);
    }
  }, [hasCompletedTutorial, gameState.week, gameState.showWelcomePopup, startTutorial, dismissWelcomePopup]);

  // Show welcome back popup for returning players (NOT for new players)
  useEffect(() => {
    // Only show for returning players, not new players (week === 1)
    if (gameState.week > 1 && gameState.weeksLived > 1 && gameState.lastLogin) {
      const lastLogin = gameState.lastLogin || Date.now();
      const hoursAway = (Date.now() - lastLogin) / (1000 * 60 * 60);
      
      // Show welcome back if away for more than 6 hours and not showing daily reward or tutorial
      if (hoursAway > 6 && !gameState.showDailyRewardPopup && !showWelcomeBack && hasCompletedTutorial) {
        // Delay to show after daily reward if it exists
        const timer = setTimeout(() => {
          setShowWelcomeBack(true);
        }, 500);
        
        return () => clearTimeout(timer);
      }
    }
  }, [gameState.lastLogin, gameState.weeksLived, gameState.week, gameState.showDailyRewardPopup, showWelcomeBack, hasCompletedTutorial]);

  return (
    <View style={[styles.container, gameState.settings.darkMode && styles.containerDark]}>
      <ScrollView 
        style={styles.scrollContainer} 
        contentContainerStyle={{ 
          paddingBottom: scale(100) + insets.bottom, 
          paddingTop: scale(8),
          paddingHorizontal: responsivePadding.horizontal,
        }}
        showsVerticalScrollIndicator={true}
      >
        <IdentityCard />
        
        {/* Prestige Button */}
        {gameState.prestigeAvailable && (
          <PrestigeButton onPress={() => setShowPrestigeModal(true)} />
        )}
        
        {/* Prestige Stats Card - Show if player has prestiged */}
        {gameState.prestige && gameState.prestige.prestigeLevel > 0 && (
          <PrestigeStatsCard
            onPress={() => setShowPrestigeModal(true)}
            onShopPress={() => setShowPrestigeShop(true)}
            onInfoPress={() => setShowPrestigeInfo(true)}
          />
        )}
        
        {/* Prestige Preview Card - Show if player hasn't prestiged yet */}
        {(!gameState.prestige || gameState.prestige.prestigeLevel === 0) && (
          <PrestigePreviewCard onPress={() => setShowPrestigeModal(true)} />
        )}
        
        {/* Next Goal Section */}
        <NextGoalCard />
        
        <AchievementsProgress />
      </ScrollView>


      {gameState.pendingEvents.length > 0 && (
        <Suspense fallback={null}>
          <WeeklyEventModal />
        </Suspense>
      )}
      <Suspense fallback={null}>
        <GoalCompletionPopup 
          visible={showGoalCompletion}
          completedGoal={completedGoal}
          nextGoal={nextGoal}
          onClose={() => setShowGoalCompletion(false)}
          darkMode={gameState.settings.darkMode}
        />
      </Suspense>
      <Suspense fallback={null}>
        <DailyRewardPopup
          visible={gameState.showDailyRewardPopup || false}
          rewardAmount={gameState.dailyRewardAmount || 0}
          onClose={() => setGameState(prev => ({ 
            ...prev, 
            showDailyRewardPopup: false,
            dailyRewardAmount: undefined,
          }))}
        />
      </Suspense>
      <Suspense fallback={null}>
        <WelcomeBackPopup
          visible={showWelcomeBack}
          onClose={() => setShowWelcomeBack(false)}
        />
      </Suspense>
      
      
      {/* Prestige Modals */}
      <PrestigeModal
        visible={showPrestigeModal}
        onClose={() => setShowPrestigeModal(false)}
      />
      <PrestigeShopModal
        visible={showPrestigeShop}
        onClose={() => setShowPrestigeShop(false)}
      />
      <PrestigeInfoModal
        visible={showPrestigeInfo}
        onClose={() => setShowPrestigeInfo(false)}
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
    flexGrow: 1,
    paddingHorizontal: responsivePadding.horizontal,
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
    boxShadow: '0px 2px 3px rgba(0, 0, 0, 0.1)',
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
    boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.1)',
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

