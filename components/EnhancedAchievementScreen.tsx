import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import {
  Trophy,
  Star,
  Filter,
  Search,
  X,
  TrendingUp,
  Award,
  Crown,
  Zap,
  Target,
  Clock,
  Gem,
  Users,
  Heart,
  Home,
  Coins,
  Briefcase,
  Baby,
  Bitcoin,
  Building,
  Sparkles,
  Eye,
  EyeOff,
  ChevronDown,
  ChevronUp,
} from 'lucide-react-native';
import { useGame } from '@/contexts/GameContext';
import { EnhancedAchievement, ACHIEVEMENT_CATEGORIES } from '@/utils/enhancedAchievements';
import EnhancedAchievementCard from './EnhancedAchievementCard';
import { useFeedback } from '@/utils/feedbackSystem';
import { DesignSystem } from '@/utils/designSystem';

interface EnhancedAchievementScreenProps {
  visible: boolean;
  onClose: () => void;
}

const { width } = Dimensions.get('window');

export default function EnhancedAchievementScreen({
  visible,
  onClose,
}: EnhancedAchievementScreenProps) {
  const { gameState, updateSettings } = useGame();
  const { buttonPress, haptic } = useFeedback(gameState?.settings?.hapticFeedback || false);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedRarity, setSelectedRarity] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [showCompleted, setShowCompleted] = useState(true);
  const [showHidden, setShowHidden] = useState(false);
  const [sortBy, setSortBy] = useState<'progress' | 'rarity' | 'difficulty' | 'name'>('progress');

  const achievements = useMemo(() => {
    let filtered = ENHANCED_ACHIEVEMENTS;

    // Filter by search query
    if (searchQuery) {
      filtered = filtered.filter(achievement =>
        achievement.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        achievement.description.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Filter by category
    if (selectedCategory) {
      filtered = filtered.filter(achievement => achievement.category === selectedCategory);
    }

    // Filter by rarity
    if (selectedRarity) {
      filtered = filtered.filter(achievement => achievement.rarity === selectedRarity);
    }

    // Filter by completion status
    if (!showCompleted) {
      filtered = filtered.filter(achievement => {
        const progress = calculateAchievementProgress(achievement, gameState);
        return progress < 1;
      });
    }

    // Filter hidden achievements
    if (!showHidden) {
      filtered = filtered.filter(achievement => !achievement.hidden);
    }

    // Sort achievements
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'progress':
          const progressA = calculateAchievementProgress(a, gameState);
          const progressB = calculateAchievementProgress(b, gameState);
          return progressB - progressA;
        case 'rarity':
          const rarityOrder = { common: 0, uncommon: 1, rare: 2, epic: 3, legendary: 4, mythic: 5 };
          return rarityOrder[b.rarity] - rarityOrder[a.rarity];
        case 'difficulty':
          return b.difficulty - a.difficulty;
        case 'name':
          return a.title.localeCompare(b.title);
        default:
          return 0;
      }
    });

    return filtered;
  }, [searchQuery, selectedCategory, selectedRarity, showCompleted, showHidden, sortBy, gameState]);

  const achievementStats = useMemo(() => {
    const total = ENHANCED_ACHIEVEMENTS.length;
    const completed = ENHANCED_ACHIEVEMENTS.filter(achievement => {
      const progress = calculateAchievementProgress(achievement, gameState);
      return progress >= 1;
    }).length;
    const claimed = gameState.achievementProgress?.filter((p: any) => p.claimed).length || 0;
    const totalGems = ENHANCED_ACHIEVEMENTS.reduce((sum, achievement) => sum + achievement.rewards.gems, 0);
    const earnedGems = ENHANCED_ACHIEVEMENTS.filter(achievement => {
      const progress = calculateAchievementProgress(achievement, gameState);
      return progress >= 1;
    }).reduce((sum, achievement) => sum + achievement.rewards.gems, 0);

    return {
      total,
      completed,
      claimed,
      totalGems,
      earnedGems,
      completionRate: total > 0 ? (completed / total) * 100 : 0,
    };
  }, [gameState]);

  const handleClaimAchievement = useCallback((achievementId: string) => {
    // Implementation for claiming achievements
    buttonPress();
    haptic('success');
    // Add logic to claim achievement and give rewards
  }, [buttonPress, haptic]);

  const handleGetHint = useCallback((achievementId: string) => {
    // Implementation for getting hints
    buttonPress();
    haptic('light');
    // Add logic to show hint (maybe cost gems)
  }, [buttonPress, haptic]);

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedCategory(null);
    setSelectedRarity(null);
    setShowCompleted(true);
    setShowHidden(false);
    setSortBy('progress');
  };

  const getCategoryIcon = (categoryId: string) => {
    switch (categoryId) {
      case 'wealth': return <Coins size={20} color="#10B981" />;
      case 'career': return <Briefcase size={20} color="#F59E0B" />;
      case 'social': return <Users size={20} color="#EF4444" />;
      case 'health': return <Heart size={20} color="#06B6D4" />;
      case 'family': return <Baby size={20} color="#8B5CF6" />;
      case 'crypto': return <Bitcoin size={20} color="#F97316" />;
      case 'real_estate': return <Home size={20} color="#84CC16" />;
      case 'special': return <Star size={20} color="#F59E0B" />;
      default: return <Trophy size={20} color="#6B7280" />;
    }
  };

  const getRarityIcon = (rarity: string) => {
    switch (rarity) {
      case 'common': return <Award size={16} color="#6B7280" />;
      case 'uncommon': return <Star size={16} color="#10B981" />;
      case 'rare': return <Zap size={16} color="#3B82F6" />;
      case 'epic': return <Crown size={16} color="#8B5CF6" />;
      case 'legendary': return <Trophy size={16} color="#F59E0B" />;
      case 'mythic': return <Sparkles size={16} color="#EF4444" />;
      default: return <Award size={16} color="#6B7280" />;
    }
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <LinearGradient
          colors={gameState.settings.darkMode ? ['#1F2937', '#111827'] : ['#F8FAFC', '#FFFFFF']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradient}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Trophy size={28} color="#F59E0B" />
              <Text style={[styles.headerTitle, gameState.settings.darkMode && styles.headerTitleDark]}>
                Achievements
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => {
                buttonPress();
                haptic('light');
                onClose();
              }}
              style={styles.closeButton}
            >
              <X size={24} color={gameState.settings.darkMode ? '#FFFFFF' : '#374151'} />
            </TouchableOpacity>
          </View>

          {/* Stats Overview */}
          <View style={styles.statsContainer}>
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={[styles.statValue, gameState.settings.darkMode && styles.statValueDark]}>
                  {achievementStats.completed}
                </Text>
                <Text style={[styles.statLabel, gameState.settings.darkMode && styles.statLabelDark]}>
                  Completed
                </Text>
              </View>
              <View style={styles.statItem}>
                <Text style={[styles.statValue, gameState.settings.darkMode && styles.statValueDark]}>
                  {achievementStats.claimed}
                </Text>
                <Text style={[styles.statLabel, gameState.settings.darkMode && styles.statLabelDark]}>
                  Claimed
                </Text>
              </View>
              <View style={styles.statItem}>
                <Text style={[styles.statValue, gameState.settings.darkMode && styles.statValueDark]}>
                  {achievementStats.earnedGems}
                </Text>
                <Text style={[styles.statLabel, gameState.settings.darkMode && styles.statLabelDark]}>
                  Gems Earned
                </Text>
              </View>
              <View style={styles.statItem}>
                <Text style={[styles.statValue, gameState.settings.darkMode && styles.statValueDark]}>
                  {Math.round(achievementStats.completionRate)}%
                </Text>
                <Text style={[styles.statLabel, gameState.settings.darkMode && styles.statLabelDark]}>
                  Complete
                </Text>
              </View>
            </View>
          </View>

          {/* Search and Filters */}
          <View style={styles.searchContainer}>
            <View style={styles.searchBar}>
              <Search size={20} color="#6B7280" />
              <TextInput
                style={[styles.searchInput, gameState.settings.darkMode && styles.searchInputDark]}
                placeholder="Search achievements..."
                placeholderTextColor={gameState.settings.darkMode ? '#9CA3AF' : '#6B7280'}
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
            </View>
            <TouchableOpacity
              onPress={() => {
                buttonPress();
                haptic('light');
                setShowFilters(!showFilters);
              }}
              style={styles.filterButton}
            >
              <Filter size={20} color="#6B7280" />
            </TouchableOpacity>
          </View>

          {/* Filters Panel */}
          {showFilters && (
            <View style={[styles.filtersPanel, gameState.settings.darkMode && styles.filtersPanelDark]}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.filtersContent}>
                  {/* Category Filter */}
                  <View style={styles.filterSection}>
                    <Text style={[styles.filterLabel, gameState.settings.darkMode && styles.filterLabelDark]}>
                      Category
                    </Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                      <View style={styles.filterOptions}>
                        <TouchableOpacity
                          onPress={() => setSelectedCategory(null)}
                          style={[
                            styles.filterOption,
                            !selectedCategory && styles.filterOptionActive,
                          ]}
                        >
                          <Text style={[
                            styles.filterOptionText,
                            !selectedCategory && styles.filterOptionTextActive,
                          ]}>
                            All
                          </Text>
                        </TouchableOpacity>
                        {ACHIEVEMENT_CATEGORIES.map(category => (
                          <TouchableOpacity
                            key={category.id}
                            onPress={() => setSelectedCategory(category.id)}
                            style={[
                              styles.filterOption,
                              selectedCategory === category.id && styles.filterOptionActive,
                            ]}
                          >
                            {getCategoryIcon(category.id)}
                            <Text style={[
                              styles.filterOptionText,
                              selectedCategory === category.id && styles.filterOptionTextActive,
                            ]}>
                              {category.name}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </ScrollView>
                  </View>

                  {/* Rarity Filter */}
                  <View style={styles.filterSection}>
                    <Text style={[styles.filterLabel, gameState.settings.darkMode && styles.filterLabelDark]}>
                      Rarity
                    </Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                      <View style={styles.filterOptions}>
                        <TouchableOpacity
                          onPress={() => setSelectedRarity(null)}
                          style={[
                            styles.filterOption,
                            !selectedRarity && styles.filterOptionActive,
                          ]}
                        >
                          <Text style={[
                            styles.filterOptionText,
                            !selectedRarity && styles.filterOptionTextActive,
                          ]}>
                            All
                          </Text>
                        </TouchableOpacity>
                        {['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'].map(rarity => (
                          <TouchableOpacity
                            key={rarity}
                            onPress={() => setSelectedRarity(rarity)}
                            style={[
                              styles.filterOption,
                              selectedRarity === rarity && styles.filterOptionActive,
                            ]}
                          >
                            {getRarityIcon(rarity)}
                            <Text style={[
                              styles.filterOptionText,
                              selectedRarity === rarity && styles.filterOptionTextActive,
                            ]}>
                              {rarity}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </ScrollView>
                  </View>

                  {/* Sort Options */}
                  <View style={styles.filterSection}>
                    <Text style={[styles.filterLabel, gameState.settings.darkMode && styles.filterLabelDark]}>
                      Sort By
                    </Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                      <View style={styles.filterOptions}>
                        {[
                          { key: 'progress', label: 'Progress' },
                          { key: 'rarity', label: 'Rarity' },
                          { key: 'difficulty', label: 'Difficulty' },
                          { key: 'name', label: 'Name' },
                        ].map(option => (
                          <TouchableOpacity
                            key={option.key}
                            onPress={() => setSortBy(option.key as any)}
                            style={[
                              styles.filterOption,
                              sortBy === option.key && styles.filterOptionActive,
                            ]}
                          >
                            <Text style={[
                              styles.filterOptionText,
                              sortBy === option.key && styles.filterOptionTextActive,
                            ]}>
                              {option.label}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </ScrollView>
                  </View>

                  {/* Toggle Options */}
                  <View style={styles.filterSection}>
                    <View style={styles.toggleOptions}>
                      <TouchableOpacity
                        onPress={() => setShowCompleted(!showCompleted)}
                        style={styles.toggleOption}
                      >
                        {showCompleted ? <Eye size={16} color="#10B981" /> : <EyeOff size={16} color="#6B7280" />}
                        <Text style={[styles.toggleText, gameState.settings.darkMode && styles.toggleTextDark]}>
                          Show Completed
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => setShowHidden(!showHidden)}
                        style={styles.toggleOption}
                      >
                        {showHidden ? <Eye size={16} color="#10B981" /> : <EyeOff size={16} color="#6B7280" />}
                        <Text style={[styles.toggleText, gameState.settings.darkMode && styles.toggleTextDark]}>
                          Show Hidden
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Clear Filters */}
                  <TouchableOpacity
                    onPress={clearFilters}
                    style={styles.clearFiltersButton}
                  >
                    <Text style={styles.clearFiltersText}>Clear All Filters</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </View>
          )}

          {/* Achievements List */}
          <ScrollView style={styles.achievementsList} showsVerticalScrollIndicator={false}>
            {achievements.length === 0 ? (
              <View style={styles.emptyState}>
                <Trophy size={48} color="#6B7280" />
                <Text style={[styles.emptyStateText, gameState.settings.darkMode && styles.emptyStateTextDark]}>
                  No achievements found
                </Text>
                <Text style={[styles.emptyStateSubtext, gameState.settings.darkMode && styles.emptyStateSubtextDark]}>
                  Try adjusting your filters or search terms
                </Text>
              </View>
            ) : (
              achievements.map(achievement => {
                const progress = calculateAchievementProgress(achievement, gameState);
                const achievementProgress = gameState.achievementProgress?.find((p: any) => p.id === achievement.id) || {
                  id: achievement.id,
                  progress: 0,
                  completed: false,
                  claimed: false,
                };

                return (
                  <EnhancedAchievementCard
                    key={achievement.id}
                    achievement={achievement}
                    progress={achievementProgress}
                    gameState={gameState}
                    onClaim={handleClaimAchievement}
                    onHint={handleGetHint}
                    darkMode={gameState.settings.darkMode}
                    compact={true}
                  />
                );
              })
            )}
          </ScrollView>
        </LinearGradient>
      </View>
    </Modal>
  );
}

// Helper function to calculate achievement progress
const calculateAchievementProgress = (achievement: EnhancedAchievement, gameState: any): number => {
  const { progressSpec } = achievement;
  
  switch (progressSpec.kind) {
    case 'boolean':
      return progressSpec.met(gameState) ? 1 : 0;
    case 'counter':
      const current = progressSpec.current(gameState);
      return Math.min(current / progressSpec.goal, 1);
    case 'streak':
      const streak = progressSpec.current(gameState);
      return Math.min(streak / progressSpec.goal, 1);
    case 'milestone':
      const value = progressSpec.current(gameState);
      const milestones = progressSpec.milestones;
      const currentMilestone = milestones.findIndex(m => value < m);
      if (currentMilestone === -1) return 1;
      const prevMilestone = currentMilestone === 0 ? 0 : milestones[currentMilestone - 1];
      const nextMilestone = milestones[currentMilestone];
      return (value - prevMilestone) / (nextMilestone - prevMilestone);
    default:
      return 0;
  }
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1F2937',
    marginLeft: 12,
  },
  headerTitleDark: {
    color: '#FFFFFF',
  },
  closeButton: {
    padding: 8,
  },
  statsContainer: {
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
  },
  statValueDark: {
    color: '#FFFFFF',
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  statLabelDark: {
    color: '#9CA3AF',
  },
  searchContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#1F2937',
    marginLeft: 8,
  },
  searchInputDark: {
    color: '#FFFFFF',
  },
  filterButton: {
    padding: 8,
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
  },
  filtersPanel: {
    backgroundColor: '#F9FAFB',
    marginHorizontal: 20,
    marginBottom: 16,
    borderRadius: 12,
    padding: 16,
  },
  filtersPanelDark: {
    backgroundColor: '#374151',
  },
  filtersContent: {
    minWidth: width - 40,
  },
  filterSection: {
    marginBottom: 16,
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  filterLabelDark: {
    color: '#D1D5DB',
  },
  filterOptions: {
    flexDirection: 'row',
    gap: 8,
  },
  filterOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#E5E7EB',
    borderRadius: 8,
    gap: 4,
  },
  filterOptionActive: {
    backgroundColor: '#3B82F6',
  },
  filterOptionText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#374151',
  },
  filterOptionTextActive: {
    color: '#FFFFFF',
  },
  toggleOptions: {
    flexDirection: 'row',
    gap: 16,
  },
  toggleOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  toggleText: {
    fontSize: 14,
    color: '#374151',
  },
  toggleTextDark: {
    color: '#D1D5DB',
  },
  clearFiltersButton: {
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#EF4444',
    borderRadius: 8,
  },
  clearFiltersText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#FFFFFF',
  },
  achievementsList: {
    flex: 1,
    paddingHorizontal: 20,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    marginTop: 16,
  },
  emptyStateTextDark: {
    color: '#D1D5DB',
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
    textAlign: 'center',
  },
  emptyStateSubtextDark: {
    color: '#9CA3AF',
  },
});
