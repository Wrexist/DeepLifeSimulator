import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MotiView, MotiText } from '@/components/anim/MotiStub';
import {
  Trophy,
  DollarSign,
  Briefcase,
  GraduationCap,
  Heart,
  Activity,
  Package,
  Star,
  Lock,
  Search,
  Filter,
  ChevronDown,
  Check,
  Clock,
  Sparkles,
  Award,
  X,
} from 'lucide-react-native';
import { useGame } from '@/contexts/GameContext';
import { scale, fontScale } from '@/utils/scaling';
import { Achievement } from '@/contexts/game/types';

interface ProgressOverviewProps {
  compact?: boolean;
}

type SortOption = 'recent' | 'category' | 'alphabetical' | 'completed';

const ACHIEVEMENT_CATEGORIES = [
  { id: 'all', label: 'All', icon: Trophy, color: '#F59E0B', gradient: ['#F59E0B', '#D97706'] },
  { id: 'money', label: 'Wealth', icon: DollarSign, color: '#10B981', gradient: ['#10B981', '#059669'] },
  { id: 'career', label: 'Career', icon: Briefcase, color: '#3B82F6', gradient: ['#3B82F6', '#2563EB'] },
  { id: 'education', label: 'Education', icon: GraduationCap, color: '#8B5CF6', gradient: ['#8B5CF6', '#7C3AED'] },
  { id: 'relationships', label: 'Social', icon: Heart, color: '#EF4444', gradient: ['#EF4444', '#DC2626'] },
  { id: 'health', label: 'Health', icon: Activity, color: '#06B6D4', gradient: ['#06B6D4', '#0891B2'] },
  { id: 'items', label: 'Items', icon: Package, color: '#F97316', gradient: ['#F97316', '#EA580C'] },
  { id: 'special', label: 'Special', icon: Star, color: '#A855F7', gradient: ['#A855F7', '#9333EA'] },
  { id: 'secret', label: 'Secret', icon: Lock, color: '#6B7280', gradient: ['#6B7280', '#4B5563'] },
];

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'recent', label: 'Recently Unlocked' },
  { value: 'category', label: 'By Category' },
  { value: 'alphabetical', label: 'Alphabetical' },
  { value: 'completed', label: 'Completed First' },
];

export default function ProgressOverview({ compact = false }: ProgressOverviewProps) {
  const { gameState } = useGame();
  const { settings } = gameState;
  const darkMode = settings?.darkMode ?? false;

  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOption, setSortOption] = useState<SortOption>('recent');
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  const [showCompletedOnly, setShowCompletedOnly] = useState(false);

  // Get all achievements from game state
  const allAchievements = useMemo(() => {
    return gameState.achievements || [];
  }, [gameState.achievements]);

  // Get unlocked achievements with timestamps
  const unlockedMap = useMemo(() => {
    const map = new Map<string, number>();
    (gameState.progress?.achievements || []).forEach(ach => {
      if (ach.unlockedAt !== undefined) {
        map.set(ach.id, ach.unlockedAt);
      }
    });
    return map;
  }, [gameState.progress?.achievements]);

  // Filter and sort achievements
  const filteredAchievements = useMemo(() => {
    let filtered = allAchievements;

    // Filter by category
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(ach => ach.category === selectedCategory);
    }

    // Filter by completion status
    if (showCompletedOnly) {
      filtered = filtered.filter(ach => ach.completed);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(ach => {
        const name = ach.category === 'secret' && !ach.completed ? (ach.secretName || '???') : ach.name;
        const desc = ach.category === 'secret' && !ach.completed ? (ach.secretDescription || '???') : ach.description;
        return name.toLowerCase().includes(query) || desc.toLowerCase().includes(query);
      });
    }

    // Sort achievements
    switch (sortOption) {
      case 'recent':
        filtered = [...filtered].sort((a, b) => {
          const aUnlocked = unlockedMap.get(a.id) ?? -1;
          const bUnlocked = unlockedMap.get(b.id) ?? -1;
          if (a.completed && !b.completed) return -1;
          if (!a.completed && b.completed) return 1;
          return bUnlocked - aUnlocked;
        });
        break;
      case 'category':
        const categoryOrder = ACHIEVEMENT_CATEGORIES.map(c => c.id);
        filtered = [...filtered].sort((a, b) => {
          return categoryOrder.indexOf(a.category) - categoryOrder.indexOf(b.category);
        });
        break;
      case 'alphabetical':
        filtered = [...filtered].sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'completed':
        filtered = [...filtered].sort((a, b) => {
          if (a.completed && !b.completed) return -1;
          if (!a.completed && b.completed) return 1;
          return 0;
        });
        break;
    }

    return filtered;
  }, [allAchievements, selectedCategory, searchQuery, sortOption, showCompletedOnly, unlockedMap]);

  // Calculate statistics
  const stats = useMemo(() => {
    const total = allAchievements.filter(a => a.category !== 'secret').length;
    const completed = allAchievements.filter(a => a.completed && a.category !== 'secret').length;
    const secretTotal = allAchievements.filter(a => a.category === 'secret').length;
    const secretCompleted = allAchievements.filter(a => a.completed && a.category === 'secret').length;
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { total, completed, secretTotal, secretCompleted, percentage };
  }, [allAchievements]);

  // Get category info
  const getCategoryInfo = useCallback((categoryId: string) => {
    return ACHIEVEMENT_CATEGORIES.find(c => c.id === categoryId) || ACHIEVEMENT_CATEGORIES[0];
  }, []);

  // Render category filter chips
  const renderCategoryFilters = () => (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.categoryScrollView}
      contentContainerStyle={styles.categoryContainer}
    >
      {ACHIEVEMENT_CATEGORIES.map(category => {
        const isSelected = selectedCategory === category.id;
        const IconComponent = category.icon;
        const count = category.id === 'all'
          ? allAchievements.length
          : allAchievements.filter(a => a.category === category.id).length;

        return (
          <TouchableOpacity
            key={category.id}
            onPress={() => setSelectedCategory(category.id)}
            style={[
              styles.categoryChip,
              isSelected && { backgroundColor: category.color },
              !isSelected && darkMode && styles.categoryChipDark,
            ]}
          >
            <IconComponent
              size={scale(14)}
              color={isSelected ? '#FFFFFF' : (darkMode ? '#9CA3AF' : '#6B7280')}
            />
            <Text
              style={[
                styles.categoryChipText,
                isSelected && styles.categoryChipTextSelected,
                !isSelected && darkMode && styles.categoryChipTextDark,
              ]}
            >
              {category.label}
            </Text>
            <View
              style={[
                styles.categoryCountBadge,
                isSelected && styles.categoryCountBadgeSelected,
                darkMode && !isSelected && styles.categoryCountBadgeDark,
              ]}
            >
              <Text
                style={[
                  styles.categoryCountText,
                  isSelected && styles.categoryCountTextSelected,
                ]}
              >
                {count}
              </Text>
            </View>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );

  // Render achievement card
  const renderAchievementCard = (achievement: Achievement, index: number) => {
    const categoryInfo = getCategoryInfo(achievement.category);
    const IconComponent = categoryInfo.icon;
    const isCompleted = achievement.completed;
    const unlockedAt = unlockedMap.get(achievement.id);
    const isSecret = achievement.category === 'secret';

    const displayName = isSecret && !isCompleted ? (achievement.secretName || '???') : achievement.name;
    const displayDesc = isSecret && !isCompleted ? (achievement.secretDescription || 'Complete secret objectives to unlock') : achievement.description;

    return (
      <MotiView
        key={achievement.id}
        from={{ opacity: 0, translateY: 20 }}
        animate={{ opacity: 1, translateY: 0 }}
        transition={{ type: 'timing', duration: 300, delay: index * 50 }}
      >
        <TouchableOpacity
          activeOpacity={0.7}
          style={[
            styles.achievementCard,
            darkMode && styles.achievementCardDark,
            !isCompleted && styles.achievementCardLocked,
          ]}
        >
          <LinearGradient
            colors={isCompleted ? categoryInfo.gradient as [string, string] : (darkMode ? ['#374151', '#1F2937'] : ['#F3F4F6', '#E5E7EB']) as [string, string]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.achievementIconContainer}
          >
            {isCompleted ? (
              <IconComponent size={scale(24)} color="#FFFFFF" />
            ) : (
              <Lock size={scale(24)} color={darkMode ? '#6B7280' : '#9CA3AF'} />
            )}
          </LinearGradient>

          <View style={styles.achievementContent}>
            <View style={styles.achievementHeader}>
              <Text
                style={[
                  styles.achievementName,
                  darkMode && styles.achievementNameDark,
                  !isCompleted && styles.achievementNameLocked,
                ]}
                numberOfLines={1}
              >
                {displayName}
              </Text>
              {isCompleted && (
                <View style={styles.completedBadge}>
                  <Check size={scale(12)} color="#FFFFFF" />
                </View>
              )}
            </View>

            <Text
              style={[
                styles.achievementDescription,
                darkMode && styles.achievementDescriptionDark,
                !isCompleted && styles.achievementDescriptionLocked,
              ]}
              numberOfLines={2}
            >
              {displayDesc}
            </Text>

            <View style={styles.achievementFooter}>
              <View style={[styles.categoryTag, { backgroundColor: categoryInfo.color + '20' }]}>
                <Text style={[styles.categoryTagText, { color: categoryInfo.color }]}>
                  {categoryInfo.label}
                </Text>
              </View>

              {unlockedAt !== undefined && (
                <View style={styles.unlockedAtContainer}>
                  <Clock size={scale(12)} color={darkMode ? '#6B7280' : '#9CA3AF'} />
                  <Text style={[styles.unlockedAtText, darkMode && styles.unlockedAtTextDark]}>
                    Week {unlockedAt}
                  </Text>
                </View>
              )}

              {achievement.reward && isCompleted && (
                <View style={styles.rewardContainer}>
                  <Sparkles size={scale(12)} color="#F59E0B" />
                  <Text style={styles.rewardText}>${achievement.reward.toLocaleString()}</Text>
                </View>
              )}
            </View>
          </View>
        </TouchableOpacity>
      </MotiView>
    );
  };

  // Render empty state
  const renderEmptyState = () => (
    <View style={[styles.emptyState, darkMode && styles.emptyStateDark]}>
      <Award size={scale(48)} color={darkMode ? '#4B5563' : '#9CA3AF'} />
      <Text style={[styles.emptyStateTitle, darkMode && styles.emptyStateTitleDark]}>
        {searchQuery ? 'No Achievements Found' : 'No Achievements Yet'}
      </Text>
      <Text style={[styles.emptyStateSubtitle, darkMode && styles.emptyStateSubtitleDark]}>
        {searchQuery
          ? 'Try adjusting your search or filters'
          : 'Complete activities to earn achievements!'
        }
      </Text>
    </View>
  );

  // Compact mode renders a simpler view
  if (compact) {
    return (
      <View style={[styles.compactContainer, darkMode && styles.compactContainerDark]}>
        <View style={styles.compactHeader}>
          <Trophy size={scale(20)} color="#F59E0B" />
          <Text style={[styles.compactTitle, darkMode && styles.compactTitleDark]}>
            Achievements
          </Text>
          <Text style={[styles.compactStats, darkMode && styles.compactStatsDark]}>
            {stats.completed}/{stats.total}
          </Text>
        </View>
        <View style={styles.compactProgressContainer}>
          <View style={[styles.compactProgressBar, darkMode && styles.compactProgressBarDark]}>
            <View
              style={[styles.compactProgressFill, { width: `${stats.percentage}%` }]}
            />
          </View>
          <Text style={[styles.compactPercentage, darkMode && styles.compactPercentageDark]}>
            {stats.percentage}%
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, darkMode && styles.containerDark]}>
      {/* Header with stats */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Trophy size={scale(24)} color="#F59E0B" />
          <Text style={[styles.title, darkMode && styles.titleDark]}>Achievements</Text>
        </View>
        <View style={styles.statsContainer}>
          <Text style={[styles.statsText, darkMode && styles.statsTextDark]}>
            {stats.completed}/{stats.total}
          </Text>
          <View style={[styles.progressBarSmall, darkMode && styles.progressBarSmallDark]}>
            <MotiView
              animate={{ width: `${stats.percentage}%` }}
              transition={{ type: 'timing', duration: 500 }}
              style={styles.progressFillSmall}
            />
          </View>
        </View>
      </View>

      {/* Overall progress bar */}
      <View style={styles.overallProgressContainer}>
        <View style={[styles.progressBar, darkMode && styles.progressBarDark]}>
          <MotiView
            animate={{ width: `${stats.percentage}%` }}
            transition={{ type: 'spring', damping: 15 }}
            style={styles.progressFill}
          />
        </View>
        <Text style={[styles.progressPercentage, darkMode && styles.progressPercentageDark]}>
          {stats.percentage}% Complete
        </Text>
      </View>

      {/* Search and filter bar */}
      <View style={styles.searchFilterRow}>
        <View style={[styles.searchContainer, darkMode && styles.searchContainerDark]}>
          <Search size={scale(16)} color={darkMode ? '#6B7280' : '#9CA3AF'} />
          <TextInput
            style={[styles.searchInput, darkMode && styles.searchInputDark]}
            placeholder="Search achievements..."
            placeholderTextColor={darkMode ? '#6B7280' : '#9CA3AF'}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <X size={scale(16)} color={darkMode ? '#6B7280' : '#9CA3AF'} />
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity
          style={[styles.sortButton, darkMode && styles.sortButtonDark]}
          onPress={() => setShowSortDropdown(!showSortDropdown)}
        >
          <Filter size={scale(16)} color={darkMode ? '#9CA3AF' : '#6B7280'} />
          <ChevronDown size={scale(14)} color={darkMode ? '#9CA3AF' : '#6B7280'} />
        </TouchableOpacity>
      </View>

      {/* Sort dropdown */}
      {showSortDropdown && (
        <MotiView
          from={{ opacity: 0, translateY: -10 }}
          animate={{ opacity: 1, translateY: 0 }}
          style={[styles.sortDropdown, darkMode && styles.sortDropdownDark]}
        >
          {SORT_OPTIONS.map(option => (
            <TouchableOpacity
              key={option.value}
              style={[
                styles.sortOption,
                sortOption === option.value && styles.sortOptionSelected,
                darkMode && sortOption === option.value && styles.sortOptionSelectedDark,
              ]}
              onPress={() => {
                setSortOption(option.value);
                setShowSortDropdown(false);
              }}
            >
              <Text
                style={[
                  styles.sortOptionText,
                  darkMode && styles.sortOptionTextDark,
                  sortOption === option.value && styles.sortOptionTextSelected,
                ]}
              >
                {option.label}
              </Text>
              {sortOption === option.value && (
                <Check size={scale(14)} color="#F59E0B" />
              )}
            </TouchableOpacity>
          ))}

          <View style={[styles.sortDivider, darkMode && styles.sortDividerDark]} />

          <TouchableOpacity
            style={[
              styles.sortOption,
              showCompletedOnly && styles.sortOptionSelected,
              darkMode && showCompletedOnly && styles.sortOptionSelectedDark,
            ]}
            onPress={() => setShowCompletedOnly(!showCompletedOnly)}
          >
            <Text
              style={[
                styles.sortOptionText,
                darkMode && styles.sortOptionTextDark,
                showCompletedOnly && styles.sortOptionTextSelected,
              ]}
            >
              Completed Only
            </Text>
            {showCompletedOnly && (
              <Check size={scale(14)} color="#F59E0B" />
            )}
          </TouchableOpacity>
        </MotiView>
      )}

      {/* Category filters */}
      {renderCategoryFilters()}

      {/* Secret achievements count */}
      {stats.secretCompleted > 0 && (
        <View style={[styles.secretBanner, darkMode && styles.secretBannerDark]}>
          <Lock size={scale(14)} color="#A855F7" />
          <Text style={styles.secretBannerText}>
            {stats.secretCompleted}/{stats.secretTotal} Secret Achievements Unlocked
          </Text>
        </View>
      )}

      {/* Achievement list */}
      <ScrollView
        style={styles.achievementList}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.achievementListContent}
      >
        {filteredAchievements.length === 0 ? (
          renderEmptyState()
        ) : (
          filteredAchievements.map((achievement, index) =>
            renderAchievementCard(achievement, index)
          )
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: scale(16),
    padding: scale(16),
    marginBottom: scale(20),
  },
  containerDark: {
    backgroundColor: '#1F2937',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: scale(12),
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(8),
  },
  title: {
    fontSize: fontScale(20),
    fontWeight: '700',
    color: '#111827',
  },
  titleDark: {
    color: '#F9FAFB',
  },
  statsContainer: {
    alignItems: 'flex-end',
  },
  statsText: {
    fontSize: fontScale(14),
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: scale(4),
  },
  statsTextDark: {
    color: '#9CA3AF',
  },
  progressBarSmall: {
    width: scale(60),
    height: scale(4),
    backgroundColor: '#E5E7EB',
    borderRadius: scale(2),
    overflow: 'hidden',
  },
  progressBarSmallDark: {
    backgroundColor: '#374151',
  },
  progressFillSmall: {
    height: '100%',
    backgroundColor: '#F59E0B',
    borderRadius: scale(2),
  },
  overallProgressContainer: {
    marginBottom: scale(16),
  },
  progressBar: {
    height: scale(8),
    backgroundColor: '#E5E7EB',
    borderRadius: scale(4),
    overflow: 'hidden',
    marginBottom: scale(6),
  },
  progressBarDark: {
    backgroundColor: '#374151',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#F59E0B',
    borderRadius: scale(4),
  },
  progressPercentage: {
    fontSize: fontScale(12),
    color: '#6B7280',
    textAlign: 'right',
  },
  progressPercentageDark: {
    color: '#9CA3AF',
  },
  searchFilterRow: {
    flexDirection: 'row',
    gap: scale(8),
    marginBottom: scale(12),
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: scale(10),
    paddingHorizontal: scale(12),
    gap: scale(8),
  },
  searchContainerDark: {
    backgroundColor: '#374151',
  },
  searchInput: {
    flex: 1,
    height: scale(40),
    fontSize: fontScale(14),
    color: '#111827',
  },
  searchInputDark: {
    color: '#F9FAFB',
  },
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: scale(10),
    paddingHorizontal: scale(12),
    gap: scale(4),
    height: scale(40),
  },
  sortButtonDark: {
    backgroundColor: '#374151',
  },
  sortDropdown: {
    position: 'absolute',
    top: scale(140),
    right: scale(16),
    backgroundColor: '#FFFFFF',
    borderRadius: scale(12),
    padding: scale(8),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    zIndex: 100,
    minWidth: scale(180),
  },
  sortDropdownDark: {
    backgroundColor: '#374151',
  },
  sortOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: scale(10),
    paddingHorizontal: scale(12),
    borderRadius: scale(8),
  },
  sortOptionSelected: {
    backgroundColor: '#FEF3C7',
  },
  sortOptionSelectedDark: {
    backgroundColor: '#78350F',
  },
  sortOptionText: {
    fontSize: fontScale(14),
    color: '#4B5563',
  },
  sortOptionTextDark: {
    color: '#D1D5DB',
  },
  sortOptionTextSelected: {
    color: '#92400E',
    fontWeight: '600',
  },
  sortDivider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: scale(4),
  },
  sortDividerDark: {
    backgroundColor: '#4B5563',
  },
  categoryScrollView: {
    marginBottom: scale(12),
  },
  categoryContainer: {
    flexDirection: 'row',
    gap: scale(8),
    paddingRight: scale(16),
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    paddingVertical: scale(8),
    paddingHorizontal: scale(12),
    borderRadius: scale(20),
    gap: scale(6),
  },
  categoryChipDark: {
    backgroundColor: '#374151',
  },
  categoryChipText: {
    fontSize: fontScale(12),
    fontWeight: '500',
    color: '#6B7280',
  },
  categoryChipTextSelected: {
    color: '#FFFFFF',
  },
  categoryChipTextDark: {
    color: '#9CA3AF',
  },
  categoryCountBadge: {
    backgroundColor: '#E5E7EB',
    paddingHorizontal: scale(6),
    paddingVertical: scale(2),
    borderRadius: scale(10),
  },
  categoryCountBadgeSelected: {
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  categoryCountBadgeDark: {
    backgroundColor: '#4B5563',
  },
  categoryCountText: {
    fontSize: fontScale(10),
    fontWeight: '600',
    color: '#6B7280',
  },
  categoryCountTextSelected: {
    color: '#FFFFFF',
  },
  secretBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(8),
    backgroundColor: '#F3E8FF',
    paddingVertical: scale(8),
    paddingHorizontal: scale(12),
    borderRadius: scale(8),
    marginBottom: scale(12),
  },
  secretBannerDark: {
    backgroundColor: '#581C87',
  },
  secretBannerText: {
    fontSize: fontScale(12),
    fontWeight: '500',
    color: '#7C3AED',
  },
  achievementList: {
    flex: 1,
  },
  achievementListContent: {
    paddingBottom: scale(16),
  },
  achievementCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: scale(12),
    padding: scale(12),
    marginBottom: scale(10),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  achievementCardDark: {
    backgroundColor: '#374151',
    borderColor: '#4B5563',
  },
  achievementCardLocked: {
    opacity: 0.7,
  },
  achievementIconContainer: {
    width: scale(52),
    height: scale(52),
    borderRadius: scale(12),
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: scale(12),
  },
  achievementContent: {
    flex: 1,
  },
  achievementHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: scale(4),
  },
  achievementName: {
    fontSize: fontScale(15),
    fontWeight: '600',
    color: '#111827',
    flex: 1,
  },
  achievementNameDark: {
    color: '#F9FAFB',
  },
  achievementNameLocked: {
    color: '#6B7280',
  },
  completedBadge: {
    backgroundColor: '#10B981',
    borderRadius: scale(10),
    padding: scale(4),
  },
  achievementDescription: {
    fontSize: fontScale(13),
    color: '#6B7280',
    lineHeight: fontScale(18),
    marginBottom: scale(8),
  },
  achievementDescriptionDark: {
    color: '#9CA3AF',
  },
  achievementDescriptionLocked: {
    fontStyle: 'italic',
  },
  achievementFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(8),
    flexWrap: 'wrap',
  },
  categoryTag: {
    paddingHorizontal: scale(8),
    paddingVertical: scale(3),
    borderRadius: scale(6),
  },
  categoryTagText: {
    fontSize: fontScale(11),
    fontWeight: '600',
  },
  unlockedAtContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(4),
  },
  unlockedAtText: {
    fontSize: fontScale(11),
    color: '#9CA3AF',
  },
  unlockedAtTextDark: {
    color: '#6B7280',
  },
  rewardContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(4),
  },
  rewardText: {
    fontSize: fontScale(11),
    fontWeight: '600',
    color: '#F59E0B',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: scale(40),
  },
  emptyStateDark: {},
  emptyStateTitle: {
    fontSize: fontScale(16),
    fontWeight: '600',
    color: '#111827',
    marginTop: scale(12),
  },
  emptyStateTitleDark: {
    color: '#F9FAFB',
  },
  emptyStateSubtitle: {
    fontSize: fontScale(14),
    color: '#6B7280',
    marginTop: scale(4),
    textAlign: 'center',
  },
  emptyStateSubtitleDark: {
    color: '#9CA3AF',
  },
  // Compact mode styles
  compactContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: scale(12),
    padding: scale(12),
    marginBottom: scale(12),
  },
  compactContainerDark: {
    backgroundColor: '#1F2937',
  },
  compactHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(8),
    marginBottom: scale(8),
  },
  compactTitle: {
    flex: 1,
    fontSize: fontScale(14),
    fontWeight: '600',
    color: '#111827',
  },
  compactTitleDark: {
    color: '#F9FAFB',
  },
  compactStats: {
    fontSize: fontScale(14),
    fontWeight: '600',
    color: '#F59E0B',
  },
  compactStatsDark: {
    color: '#F59E0B',
  },
  compactProgressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(8),
  },
  compactProgressBar: {
    flex: 1,
    height: scale(6),
    backgroundColor: '#E5E7EB',
    borderRadius: scale(3),
    overflow: 'hidden',
  },
  compactProgressBarDark: {
    backgroundColor: '#374151',
  },
  compactProgressFill: {
    height: '100%',
    backgroundColor: '#F59E0B',
    borderRadius: scale(3),
  },
  compactPercentage: {
    fontSize: fontScale(12),
    fontWeight: '600',
    color: '#6B7280',
    minWidth: scale(36),
    textAlign: 'right',
  },
  compactPercentageDark: {
    color: '#9CA3AF',
  },
});
