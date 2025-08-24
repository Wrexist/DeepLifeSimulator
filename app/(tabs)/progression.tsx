import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useGame } from '@/contexts/GameContext';
import { Trophy, Target, Star, TrendingUp, Award, Crown, Zap } from 'lucide-react-native';
import ProgressOverview from '@/components/ProgressOverview';
import Journal from '@/components/Journal';
import ClickerGame from '@/components/hobbies/ClickerGame';

export default function ProgressionScreen() {
  const { gameState, checkAchievements } = useGame();
  const [activeHobby, setActiveHobby] = useState<string | null>(null);

  React.useEffect(() => {
    checkAchievements();
  }, [
    gameState.stats,
    gameState.relationships,
    gameState.items,
    gameState.educations,
    gameState.company,
    checkAchievements,
  ]);

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
      default: return { icon: Trophy, color: '#6B7280' };
    }
  };
  return (
    <View style={styles.container}>
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Trophy size={32} color="#F59E0B" />
          <Text style={styles.title}>Your Progress</Text>
        </View>

        <ProgressOverview />
        <Journal />

        <View style={styles.minigamesSection}>
          <Text style={styles.sectionTitle}>Hobby Minigames</Text>
          {gameState.hobbies.map(h => (
            <TouchableOpacity key={h.id} style={styles.minigameButton} onPress={() => setActiveHobby(h.id)}>
              <Text>Play {h.name}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.overallProgress}>
          <Text style={styles.progressTitle}>Overall Achievement Progress</Text>
          <View style={styles.progressStats}>
            <Text style={styles.progressText}>
              {completedAchievements} / {totalAchievements} Completed
            </Text>
            <Text style={styles.progressPercent}>
              {Math.round((completedAchievements / totalAchievements) * 100)}%
            </Text>
          </View>
          <View style={styles.progressBar}>
            <View 
              style={[
                styles.progressFill, 
                { width: `${(completedAchievements / totalAchievements) * 100}%` }
              ]} 
            />
          </View>
        </View>

        <View style={styles.achievementsSection}>
          <Text style={styles.sectionTitle}>Achievements ({completedAchievements}/{totalAchievements})</Text>
          
          {categories.map(category => {
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
                        achievement.completed && styles.completedAchievement
                      ]}>
                        {achievement.name}
                      </Text>
                      <Text style={styles.achievementDescription}>
                        {achievement.description}
                      </Text>
                    </View>
                    {achievement.completed && (
                      <View style={styles.completedBadge}>
                        <Text style={styles.completedText}>✓</Text>
                      </View>
                    )}
                  </View>
                ))}
              </View>
            );
          })}
        </View>

        <View style={styles.minigamesSection}>
          <Text style={styles.sectionTitle}>Hobby Minigames</Text>
          {gameState.hobbies.map(h => (
            <TouchableOpacity key={h.id} style={styles.minigameButton} onPress={() => setActiveHobby(h.id)}>
              <Text>Play {h.name}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.statsSection}>
          <Text style={styles.sectionTitle}>Life Stats</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <TrendingUp size={20} color="#3B82F6" />
              <Text style={styles.statValue}>{Math.floor(gameState.date.age)}</Text>
              <Text style={styles.statLabel}>Age</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{gameState.week}</Text>
              <Text style={styles.statLabel}>Weeks Lived</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{gameState.relationships.length}</Text>
              <Text style={styles.statLabel}>Relationships</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{gameState.items.filter(i => i.owned).length}</Text>
              <Text style={styles.statLabel}>Items Owned</Text>
            </View>
          </View>
        </View>
      </ScrollView>
      <ClickerGame visible={!!activeHobby} hobbyId={activeHobby ?? ''} onClose={() => setActiveHobby(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
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
  overallProgress: {
    backgroundColor: '#FFFFFF',
    padding: 24,
    borderRadius: 16,
    marginBottom: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
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
  },
  completedAchievement: {
    color: '#1F2937',
  },
  achievementDescription: {
    fontSize: 13,
    color: '#9CA3AF',
    lineHeight: 16,
  },
  completedBadge: {
    backgroundColor: '#10B981',
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  completedText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
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
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
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
});