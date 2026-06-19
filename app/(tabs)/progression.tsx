import React, { useState } from 'react';
import { Platform, View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useGame } from '@/contexts/GameContext';
import { Trophy, Target, Star, TrendingUp, Award, Crown, Zap, BarChart3, Bell, BookOpen, Brain } from 'lucide-react-native';
import ProgressOverview from '@/components/ProgressOverview';
import Journal from '@/components/Journal';
import EnhancedDataVisualization from '@/components/EnhancedDataVisualization';
import SmartNotificationCenter from '@/components/SmartNotificationCenter';
import PrestigeStatsCard from '@/components/PrestigeStatsCard';
import PrestigeHistoryModal from '@/components/PrestigeHistoryModal';
import PrestigeShopModal from '@/components/PrestigeShopModal';
import ActivityCommitmentModal from '@/components/ActivityCommitmentModal';
import ErrorBoundary from '@/components/ErrorBoundary';
import LifeStoryModal from '@/components/LifeStoryModal';
import SkillTreeModal from '@/components/SkillTreeModal';
import LegacyPassModal from '@/components/LegacyPassModal';
import SubscriptionModal from '@/components/SubscriptionModal';
import { getClaimableCount } from '@/lib/legacyPass/legacyPass';
import EmptyState from '@/components/ui/EmptyState';

function ProgressionScreen() {
  return (
    <ErrorBoundary>
      <ProgressionScreenContent />
    </ErrorBoundary>
  );
}

function ProgressionScreenContent() {
  const { gameState, checkAchievements } = useGame();
  const { settings } = gameState;
  const legacyClaimable = getClaimableCount(gameState.legacyPass);
  // Screen defaults to dark unless darkMode is explicitly false.
  const isDark = settings?.darkMode !== false;
  const [showDataVisualization, setShowDataVisualization] = useState(false);
  const [showSmartNotifications, setShowSmartNotifications] = useState(false);
  const [showPrestigeHistory, setShowPrestigeHistory] = useState(false);
  const [showPrestigeShop, setShowPrestigeShop] = useState(false);
  const [showCommitments, setShowCommitments] = useState(false);
  const [showLifeStory, setShowLifeStory] = useState(false);
  const [showSkillTree, setShowSkillTree] = useState(false);
  const [showLegacyPass, setShowLegacyPass] = useState(false);
  const [showSubscription, setShowSubscription] = useState(false);

  // P2-7: depend on PRIMITIVES, not object/array references. Under the current
  // provider, `gameState.stats`/`relationships`/`items` get a fresh identity on
  // every save (every stat-decay tick), so the object deps re-ran the full
  // achievement sweep many times per second while this tab was open.
  const achievementSignal = [
    gameState.stats?.money,
    gameState.stats?.happiness,
    gameState.stats?.health,
    gameState.relationships?.length,
    gameState.items?.length,
    gameState.educations?.length,
    gameState.company?.id,
    gameState.weeksLived,
  ].join('|');
  React.useEffect(() => {
    checkAchievements();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [achievementSignal]);

  const achievements = (gameState.achievements || []).filter(a => a.category !== 'secret');
  const categories = ['money', 'career', 'education', 'relationships', 'health', 'items', 'special'];

  const completedAchievements = achievements.filter(a => a.completed).length;
  const totalAchievements = achievements.length;

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'money': return { icon: TrendingUp, color: '#10B981' };
      case 'career': return { icon: Trophy, color: '#F59E0B' };
      case 'education': return { icon: Star, color: '#8B5CF6' };
      case 'relationships': return { icon: Award, color: '#EF4444' };
      case 'health': return { icon: Zap, color: '#06B6D4' };
      case 'items': return { icon: Target, color: '#3B82F6' };
      case 'special': return { icon: Crown, color: '#7C2D12' };
      default: return { icon: Trophy, color: settings?.darkMode ? '#FFFFFF' : '#6B7280' };
    }
  };
  return (
    <View style={[styles.container, settings?.darkMode !== false && styles.containerDark]}>
      <ScrollView style={styles.content} showsVerticalScrollIndicator={true}>
        <View style={styles.header}>
          <Trophy size={32} color="#F59E0B" />
          <Text style={[styles.title, settings?.darkMode !== false && styles.titleDark]}>Your Progress</Text>
        </View>

        {/* Prestige Section */}
        {gameState.prestige && gameState.prestige.prestigeLevel > 0 && (
          <PrestigeStatsCard
            onPress={() => setShowPrestigeHistory(true)}
            onShopPress={() => setShowPrestigeShop(true)}
          />
        )}

        {/* Enhanced Features Section */}
        <View style={[styles.enhancedFeaturesSection, settings?.darkMode !== false && styles.enhancedFeaturesSectionDark]}>
          <Text style={[styles.sectionTitle, isDark && styles.sectionTitleDark]}>Enhanced Features</Text>
          <View style={styles.featureButtons}>
            <TouchableOpacity
              style={[styles.featureButton, isDark && styles.featureButtonDark]}
              onPress={() => setShowDataVisualization(true)}
            >
              <BarChart3 size={24} color="#3B82F6" />
              <Text style={[styles.featureButtonText, isDark && styles.featureButtonTextDark]}>Data Analytics</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.featureButton, isDark && styles.featureButtonDark]}
              onPress={() => setShowSmartNotifications(true)}
            >
              <Bell size={24} color="#10B981" />
              <Text style={[styles.featureButtonText, isDark && styles.featureButtonTextDark]}>Smart Notifications</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.featureButton, isDark && styles.featureButtonDark]}
              onPress={() => setShowCommitments(true)}
            >
              <Target size={24} color="#F59E0B" />
              <Text style={[styles.featureButtonText, isDark && styles.featureButtonTextDark]}>Activity Commitments</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.featureButton, isDark && styles.featureButtonDark]}
              onPress={() => setShowLifeStory(true)}
            >
              <BookOpen size={24} color="#8B5CF6" />
              <Text style={[styles.featureButtonText, isDark && styles.featureButtonTextDark]}>My Life Story</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.featureButton, isDark && styles.featureButtonDark]}
              onPress={() => setShowSkillTree(true)}
            >
              <Brain size={24} color="#10B981" />
              <Text style={[styles.featureButtonText, isDark && styles.featureButtonTextDark]}>Life Skills</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.featureButton, isDark && styles.featureButtonDark]}
              onPress={() => setShowLegacyPass(true)}
            >
              <Crown size={24} color="#F59E0B" />
              <Text style={[styles.featureButtonText, isDark && styles.featureButtonTextDark]}>Legacy Pass</Text>
              {legacyClaimable > 0 && (
                <View style={styles.claimBadge}>
                  <Text style={styles.claimBadgeText}>{legacyClaimable > 99 ? '99+' : legacyClaimable}</Text>
                </View>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.featureButton, isDark && styles.featureButtonDark]}
              onPress={() => setShowSubscription(true)}
            >
              <Star size={24} color="#F59E0B" />
              <Text style={[styles.featureButtonText, isDark && styles.featureButtonTextDark]}>DeepLife+</Text>
            </TouchableOpacity>
          </View>
        </View>

        <ProgressOverview />
        <Journal />

        {/* Hobbies removed - minigames section no longer available */}

        <View style={[styles.overallProgress, settings?.darkMode !== false && styles.overallProgressDark]}>
          <Text style={[styles.progressTitle, isDark && styles.progressTitleDark]}>Overall Achievement Progress</Text>
          <View style={styles.progressStats}>
            <Text style={styles.progressText}>
              {completedAchievements} / {totalAchievements} Completed
            </Text>
            <Text style={styles.progressPercent}>
              {totalAchievements > 0 ? Math.round((completedAchievements / totalAchievements) * 100) : 0}%
            </Text>
          </View>
          <View style={styles.progressBar}>
            <View
              style={[
                styles.progressFill,
                { width: `${totalAchievements > 0 ? (completedAchievements / totalAchievements) * 100 : 0}%` }
              ]}
            />
          </View>
        </View>

        <View style={styles.achievementsSection}>
          <Text style={styles.sectionTitle}>Achievements ({completedAchievements}/{totalAchievements})</Text>

          {achievements.length === 0 ? (
            <EmptyState
              icon="🏆"
              title="No Achievements Yet"
              description="Keep playing and complete challenges to earn achievements."
              darkMode={settings?.darkMode !== false}
            />
          ) : (
            categories.map(category => {
              const categoryAchievements = achievements.filter(a => a.category === category);
              const categoryCompleted = categoryAchievements.filter(a => a.completed).length;
              const { icon: CategoryIcon, color } = getCategoryIcon(category);

              return (
                <View key={category} style={styles.categorySection}>
                  <View style={styles.categoryHeader}>
                    <CategoryIcon size={20} color={color} />
                    <Text style={styles.categoryTitle}>
                      {category.charAt(0).toUpperCase() + category.slice(1)} ({categoryCompleted}/{categoryAchievements.length})
                    </Text>
                  </View>

                  {categoryAchievements.map(achievement => (
                    <View key={achievement.id} style={styles.achievementCard}>
                      <View style={styles.achievementIcon}>
                        {achievement.completed ? (
                          <Star size={20} color="#F59E0B" fill="#F59E0B" />
                        ) : (
                          <Target size={20} color="#9CA3AF" />
                        )}
                      </View>
                      <View style={styles.achievementInfo}>
                        <Text style={[
                          styles.achievementName,
                          achievement.completed && styles.completedAchievement,
                          settings?.darkMode && !achievement.completed && { color: '#FFFFFF' }
                        ]}>
                          {achievement.name}
                        </Text>
                        <Text style={[styles.achievementDescription, settings?.darkMode && styles.achievementDescriptionDark]}>
                          {achievement.description}
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              );
            })
          )}
        </View>

        {/* Hobbies removed - minigames section no longer available */}

        <View style={styles.statsSection}>
          <Text style={styles.sectionTitle}>Life Stats</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <TrendingUp size={20} color="#3B82F6" />
              <Text style={styles.statValue}>{Math.floor(gameState.date?.age ?? 18)}</Text>
              <Text style={[styles.statLabel, settings?.darkMode && styles.statLabelDark]}>Age</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{gameState.weeksLived}</Text>
              <Text style={styles.statLabel}>Weeks Lived</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{(gameState.relationships || []).length}</Text>
              <Text style={styles.statLabel}>Relationships</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{(gameState.items || []).filter(i => i.owned).length}</Text>
              <Text style={styles.statLabel}>Items Owned</Text>
            </View>
          </View>
        </View>
      </ScrollView>
      
      {/* Enhanced Components */}
        {showDataVisualization && (
          <EnhancedDataVisualization darkMode={gameState.settings?.darkMode} compact={false} />
        )}
        <SmartNotificationCenter visible={showSmartNotifications} onClose={() => setShowSmartNotifications(false)} />
        <ActivityCommitmentModal visible={showCommitments} onClose={() => setShowCommitments(false)} />
        <LifeStoryModal visible={showLifeStory} onClose={() => setShowLifeStory(false)} />
        <SkillTreeModal visible={showSkillTree} onClose={() => setShowSkillTree(false)} />
        <LegacyPassModal
          visible={showLegacyPass}
          onClose={() => setShowLegacyPass(false)}
          onSubscribe={() => {
            setShowLegacyPass(false);
            setShowSubscription(true);
          }}
        />
        <SubscriptionModal visible={showSubscription} onClose={() => setShowSubscription(false)} />
        <PrestigeHistoryModal visible={showPrestigeHistory} onClose={() => setShowPrestigeHistory(false)} />
        <PrestigeShopModal visible={showPrestigeShop} onClose={() => setShowPrestigeShop(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  containerDark: {
    backgroundColor: '#0F172A',
  },
  // R10-UX: dark-mode card surfaces. The screen defaults to dark
  // (darkMode !== false), but these two cards were hardcoded white — jarring
  // bright panels on the #0F172A background.
  overallProgressDark: {
    backgroundColor: '#1E293B',
  },
  enhancedFeaturesSectionDark: {
    backgroundColor: '#1E293B',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 30,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1F2937',
    marginLeft: 12,
  },
  titleDark: {
    color: '#F9FAFB',
  },
  overallProgress: {
    backgroundColor: '#FFFFFF',
    padding: 24,
    borderRadius: 16,
    marginBottom: 30,
    boxShadow: '0px 4px 8px rgba(0, 0, 0, 0.1)',
    ...Platform.select({
      web: { boxShadow: '0px 4px 8px rgba(0, 0, 0, 0.1)' } as any,
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
    }),
    elevation: 3,
  },
  progressTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 15,
  },
  progressStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  progressText: {
    fontSize: 16,
    color: '#6B7280',
    ...Platform.select({
      web: { textShadow: '-1px 1px 2px rgba(0, 0, 0, 0.75)' } as any,
      default: {
        textShadowColor: 'rgba(0, 0, 0, 0.75)',
        textShadowOffset: { width: -1, height: 1 },
        textShadowRadius: 2,
      },
    }),
  },
  progressTextDark: {
    color: '#FFFFFF',
    ...Platform.select({
      web: { textShadow: '-1px 1px 2px rgba(0, 0, 0, 0.75)' } as any,
      default: {
        textShadowColor: 'rgba(0, 0, 0, 0.75)',
        textShadowOffset: { width: -1, height: 1 },
        textShadowRadius: 2,
      },
    }),
  },
  progressPercent: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#F59E0B',
  },
  progressBar: {
    height: 8,
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#F59E0B',
    borderRadius: 4,
  },
  achievementsSection: {
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 20,
  },
  categorySection: {
    marginBottom: 25,
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  categoryTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    marginLeft: 8,
  },
  achievementCard: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    boxShadow: '0px 2px 3px rgba(0, 0, 0, 0.1)',
    ...Platform.select({
      web: { boxShadow: '0px 2px 3px rgba(0, 0, 0, 0.1)' } as any,
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
      },
    }),
    elevation: 2,
  },
  achievementIcon: {
    marginRight: 12,
  },
  achievementInfo: {
    flex: 1,
  },
  achievementName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 2,
    ...Platform.select({
      web: { textShadow: '-1px 1px 2px rgba(0, 0, 0, 0.75)' } as any,
      default: {
        textShadowColor: 'rgba(0, 0, 0, 0.75)',
        textShadowOffset: { width: -1, height: 1 },
        textShadowRadius: 2,
      },
    }),
  },
  completedAchievement: {
    color: '#1F2937',
  },
  achievementDescription: {
    fontSize: 13,
    color: '#9CA3AF',
    lineHeight: 16,
  },
  achievementDescriptionDark: {
    color: '#6B7280',
  },
  statsSection: {
    marginBottom: 30,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  statCard: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderRadius: 12,
    width: '48%',
    minHeight: 110,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    boxShadow: '0px 2px 3px rgba(0, 0, 0, 0.1)',
    ...Platform.select({
      web: { boxShadow: '0px 2px 3px rgba(0, 0, 0, 0.1)' } as any,
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
      },
    }),
    elevation: 2,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#3B82F6',
    marginTop: 8,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
    ...Platform.select({
      web: { textShadow: '-1px 1px 2px rgba(0, 0, 0, 0.75)' } as any,
      default: {
        textShadowColor: 'rgba(0, 0, 0, 0.75)',
        textShadowOffset: { width: -1, height: 1 },
        textShadowRadius: 2,
      },
    }),
  },
  statLabelDark: {
    color: '#FFFFFF',
    ...Platform.select({
      web: { textShadow: '-1px 1px 2px rgba(0, 0, 0, 0.75)' } as any,
      default: {
        textShadowColor: 'rgba(0, 0, 0, 0.75)',
        textShadowOffset: { width: -1, height: 1 },
        textShadowRadius: 2,
      },
    }),
  },
  minigamesSection: {
    marginBottom: 30,
  },
  minigameButton: {
    padding: 12,
    backgroundColor: '#E5E7EB',
    borderRadius: 8,
    marginBottom: 10,
    alignItems: 'center',
  },
  enhancedFeaturesSection: {
    margin: 16,
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.1)',
    elevation: 2,
    ...Platform.select({
      web: { boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.1)' } as any,
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
    }),
  },
  featureButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 12,
  },
  featureButton: {
    flex: 1,
    minWidth: '45%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 12,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 8,
  },
  claimBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 5,
    borderRadius: 10,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
  },
  claimBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  featureButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    textAlign: 'center',
  },
  // R10-UX: dark-mode text/button variants so the now-dark cards stay legible.
  progressTitleDark: { color: '#F1F5F9' },
  sectionTitleDark: { color: '#F1F5F9' },
  featureButtonDark: { backgroundColor: '#0F172A', borderColor: '#334155' },
  featureButtonTextDark: { color: '#E2E8F0' },
});

export default React.memo(ProgressionScreen);