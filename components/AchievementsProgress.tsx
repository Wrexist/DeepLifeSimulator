/**
 * AchievementsProgress Component
 * 
 * Enhanced achievements display with category filters, rarity indicators,
 * and secret achievement hints
 */
import React, { useMemo, useState } from 'react';
import { Platform, View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  ScrollView } from 'react-native';
import Gradient from '@/components/ui/Gradient';
import BlurViewFallback from '@/components/fallbacks/BlurViewFallback';
import { useGameActions } from '@/contexts/GameContext';
import { useGameSelector, shallowEqual } from '@/contexts/game/useGameSelector';
import {
  Trophy,
  Gem,
  Sparkles,
  Filter,
  Star,
  Lock,
  Eye,
  EyeOff,
  Briefcase,
  Heart,
  DollarSign,
  Plane,
  Users,
  Crown,
  Medal,
  Activity,
  Skull,
} from 'lucide-react-native';
import { useAchievements } from '@/hooks/useAchievements';
import usePressableScale from '@/hooks/usePressableScale';
import { weeksSinceLifeStart } from '@/utils/weekCounters';
import {
  responsiveFontSize,
  responsiveSpacing,
  responsiveBorderRadius,
  responsiveIconSize,
  scale,
  verticalScale,
  fontScale,
} from '@/utils/scaling';
const LinearGradient = Gradient;
const BlurView = BlurViewFallback;

type AchievementCategory = 'all' | 'career' | 'wealth' | 'social' | 'travel' | 'family' | 'health' | 'crime' | 'special';
type RarityType = 'common' | 'rare' | 'epic' | 'legendary';

interface CategoryInfo {
  id: AchievementCategory;
  label: string;
  icon: any;
  color: string;
}

const CATEGORIES: CategoryInfo[] = [
  { id: 'all', label: 'All', icon: Trophy, color: '#6366F1' },
  { id: 'career', label: 'Career', icon: Briefcase, color: '#3B82F6' },
  { id: 'wealth', label: 'Wealth', icon: DollarSign, color: '#10B981' },
  { id: 'social', label: 'Social', icon: Users, color: '#EC4899' },
  { id: 'travel', label: 'Travel', icon: Plane, color: '#8B5CF6' },
  { id: 'family', label: 'Family', icon: Heart, color: '#F59E0B' },
  { id: 'health', label: 'Health', icon: Activity, color: '#14B8A6' },
  { id: 'crime', label: 'Crime', icon: Skull, color: '#F97316' },
  { id: 'special', label: 'Special', icon: Star, color: '#EF4444' },
];

const RARITY_CONFIG: Record<RarityType, { label: string; color: string; bgColor: string }> = {
  common: { label: 'Common', color: '#64748B', bgColor: 'rgba(107, 114, 128, 0.15)' },
  rare: { label: 'Rare', color: '#3B82F6', bgColor: 'rgba(59, 130, 246, 0.15)' },
  epic: { label: 'Epic', color: '#8B5CF6', bgColor: 'rgba(139, 92, 246, 0.15)' },
  legendary: { label: 'Legendary', color: '#F59E0B', bgColor: 'rgba(245, 158, 11, 0.15)' },
};

// Helper to determine achievement category from title/description and group
function getCategoryFromAchievement(title: string, description: string, group?: string): AchievementCategory {
  const combined = (title + ' ' + description).toLowerCase();

  // Check group field first for accurate routing
  if (group) {
    const g = group.toLowerCase();
    if (g === 'travel') return 'travel';
    if (g === 'health' || g === 'fitness' || g === 'happiness' || g === 'fun_all_nighter') return 'health';
    if (g === 'crime' || g === 'street') return 'crime';
    if (g === 'career' || g === 'company' || g === 'workforce' || g === 'education' || g === 'politics') return 'career';
    if (g === 'relationship' || g === 'family') return 'family';
    if (g === 'social' || g === 'reputation') return 'social';
    if (g === 'wealth' || g === 'savings' || g === 'networth' || g === 'financial' || g === 'gold' || g === 'real_estate' || g === 'crypto_value' || g === 'crypto_portfolio' || g === 'fun_crypto') return 'wealth';
    if (g === 'prestige' || g === 'milestone' || g === 'longevity' || g === 'collector') return 'special';
  }

  // Fallback: keyword matching on text
  if (combined.includes('job') || combined.includes('work') || combined.includes('career') || combined.includes('promot') || combined.includes('salary') || combined.includes('hired') || combined.includes('perform') || combined.includes('election') || combined.includes('politi')) {
    return 'career';
  }
  if (combined.includes('money') || combined.includes('wealth') || combined.includes('rich') || combined.includes('million') || combined.includes('billion') || combined.includes('net worth') || combined.includes('savings') || combined.includes('debt')) {
    return 'wealth';
  }
  if (combined.includes('health') || combined.includes('fitness') || combined.includes('disease') || combined.includes('vaccin') || combined.includes('cure')) {
    return 'health';
  }
  if (combined.includes('crime') || combined.includes('jail') || combined.includes('prison') || combined.includes('wanted') || combined.includes('hack') || combined.includes('escape') || combined.includes('criminal')) {
    return 'crime';
  }
  if (combined.includes('travel') || combined.includes('visit') || combined.includes('destination') || combined.includes('passport') || combined.includes('trip') || combined.includes('voyage') || combined.includes('flight')) {
    return 'travel';
  }
  if (combined.includes('friend') || combined.includes('relationship') || combined.includes('social') || combined.includes('follower') || combined.includes('match') || combined.includes('dating')) {
    return 'social';
  }
  if (combined.includes('family') || combined.includes('child') || combined.includes('marry') || combined.includes('married') || combined.includes('spouse') || combined.includes('generation') || combined.includes('heir')) {
    return 'family';
  }
  if (combined.includes('secret') || combined.includes('hidden') || combined.includes('special')) {
    return 'special';
  }
  return 'all';
}

// Helper to determine rarity from achievement
function getRarityFromAchievement(goldReward: number, stackIndex: number, stackSize: number): RarityType {
  if (goldReward >= 500 || stackIndex >= 4) return 'legendary';
  if (goldReward >= 200 || stackIndex >= 3) return 'epic';
  if (goldReward >= 100 || stackIndex >= 2) return 'rare';
  return 'common';
}

interface ClaimRewardButtonProps {
  onPress: () => void;
  disabled?: boolean;
}

// Extracted so the shared press hook can live here: this button renders inside
// the achievements .map() below, where calling usePressableScale() inline would
// break the Rules of Hooks. Mirrors the repo's canonical press recipe (see
// TopStatsBar's RightSide) - wrap the TouchableOpacity in the hook's
// AnimatedView + animatedStyle and forward onPressIn/onPressOut. The gradient/
// blur content is unchanged, so the idle button stays pixel-identical.
function ClaimRewardButton({ onPress, disabled }: ClaimRewardButtonProps) {
  const { AnimatedView, animatedStyle, onPressIn, onPressOut } = usePressableScale({ scale: 0.96 });
  return (
    <AnimatedView style={animatedStyle}>
      <TouchableOpacity
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        disabled={disabled}
      >
        <BlurView intensity={20} style={styles.claimButtonBlur}>
          <LinearGradient
            colors={['#6366F1', '#4F46E5']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.claimButton}
          >
            <Sparkles size={16} color="#FFFFFF" style={styles.claimIcon} />
            <Text style={styles.claimText}>Claim Reward</Text>
          </LinearGradient>
        </BlurView>
      </TouchableOpacity>
    </AnimatedView>
  );
}

export default function AchievementsProgress() {
  const { claimProgressAchievement } = useGameActions();
  // R-perf: subscribe only to the slices this card reads (was the whole monolith
  // via useGame(), which re-rendered it on every tick). darkMode/achievementUnlocks/
  // weeksLived change rarely, so it now stays put during routine stat decay ticks.
  const settings = useGameSelector((s) => s?.settings, shallowEqual);
  const weeksLived = useGameSelector((s) => s?.weeksLived);
  const lifeStartWeek = useGameSelector((s) => s?.lifeStartWeek);
  const achievementUnlocks = useGameSelector((s) => s?.achievementUnlocks);
  const darkMode = settings?.darkMode;
  const { achievements } = useAchievements();
  const [sort, setSort] = useState<'progress' | 'title' | 'rarity'>('progress');
  const [selectedCategory, setSelectedCategory] = useState<AchievementCategory>('all');
  const [showSecret, setShowSecret] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  // Add category and rarity to achievements
  const categorizedAchievements = useMemo(() => {
    return achievements.map(a => ({
      ...a,
      category: getCategoryFromAchievement(a.title, a.description || '', a.group),
      rarity: getRarityFromAchievement(a.goldReward, a.stackIndex, a.stackSize),
      isSecret: a.title.toLowerCase().includes('secret') || a.group === 'secret' || ('hidden' in a && (a as { hidden?: boolean }).hidden === true),
    }));
  }, [achievements]);

  // Filter achievements
  const filteredAchievements = useMemo(() => {
    let filtered = categorizedAchievements;

    // Filter by category
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(a => a.category === selectedCategory);
    }

    // Filter secret achievements
    if (!showSecret) {
      filtered = filtered.filter(a => !a.isSecret || a.progress > 0);
    }

    return filtered;
  }, [categorizedAchievements, selectedCategory, showSecret]);

  // ENGAGEMENT: for the first 12 weeks, bias the not-started list to show
  // beginner-tier achievements first. Otherwise a brand-new player sees a wall
  // of $1B-cash targets at the top and feels the game is unwinnable.
  // Weeks into THIS life. The absolute `weeksLived` is seeded from the starting
  // age, so this bias never applied to any scenario starting past 18 - the
  // players it was written for. CLAUDE.md §4.2.
  const isEarlyGame = weeksSinceLifeStart(weeksLived, lifeStartWeek) <= 12;

  // Sort achievements - show completed ones first, then by sort option
  const sortedAchievements = useMemo(() => {
    return [...filteredAchievements].sort((a, b) => {
      // Always show completed/claimed achievements first, then in-progress, then not started
      const aCompleted = a.claimed || a.progress >= 1;
      const bCompleted = b.claimed || b.progress >= 1;
      const aInProgress = a.progress > 0 && a.progress < 1;
      const bInProgress = b.progress > 0 && b.progress < 1;

      // Completed achievements first
      if (aCompleted && !bCompleted) return -1;
      if (!aCompleted && bCompleted) return 1;

      // Within completed, sort by completion time (claimed first, then by progress)
      if (aCompleted && bCompleted) {
        if (a.claimed && !b.claimed) return -1;
        if (!a.claimed && b.claimed) return 1;
        if (sort === 'progress') {
          return b.progress - a.progress;
        }
      }

      // In-progress achievements next
      if (aInProgress && !bInProgress) return -1;
      if (!aInProgress && bInProgress) return 1;

      // Early-game bias: float beginner-tier achievements ahead of others.
      if (isEarlyGame) {
        const aIsBeginner = a.group === 'beginner';
        const bIsBeginner = b.group === 'beginner';
        if (aIsBeginner && !bIsBeginner) return -1;
        if (!aIsBeginner && bIsBeginner) return 1;
      }

      // Then apply the selected sort
      if (sort === 'progress') {
        return b.progress - a.progress;
      }
      if (sort === 'title') {
        return a.title.localeCompare(b.title);
      }
      if (sort === 'rarity') {
        const rarityOrder = { legendary: 4, epic: 3, rare: 2, common: 1 };
        return rarityOrder[b.rarity] - rarityOrder[a.rarity];
      }
      return 0;
    });
  }, [filteredAchievements, sort, isEarlyGame]);

  // Stats
  const stats = useMemo(() => {
    const byCategory: Record<string, { total: number; completed: number }> = {};
    categorizedAchievements.forEach(a => {
      if (!byCategory[a.category]) {
        byCategory[a.category] = { total: 0, completed: 0 };
      }
      byCategory[a.category].total++;
      if (a.progress >= 1) {
        byCategory[a.category].completed++;
      }
    });
    
    return {
      total: categorizedAchievements.length,
      inProgress: categorizedAchievements.filter(a => a.progress > 0 && a.progress < 1).length,
      completed: categorizedAchievements.filter(a => a.progress >= 1).length,
      byCategory,
    };
  }, [categorizedAchievements]);

  const getCategoryInfo = (categoryId: AchievementCategory): CategoryInfo => {
    return CATEGORIES.find(c => c.id === categoryId) || CATEGORIES[0];
  };

  const getRarityIcon = (rarity: RarityType) => {
    switch (rarity) {
      case 'legendary':
        return Crown;
      case 'epic':
        return Star;
      case 'rare':
        return Medal;
      default:
        return Trophy;
    }
  };

  return (
    <View style={[styles.container, darkMode && styles.containerDark]}>
      {/* Enhanced header with gradient background */}
      <BlurView intensity={20} style={styles.headerBlur}>
        <LinearGradient
          colors={darkMode ? ['rgba(99, 102, 241, 0.1)', 'rgba(79, 70, 229, 0.1)'] : ['rgba(99, 102, 241, 0.05)', 'rgba(79, 70, 229, 0.05)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.headerGradient}
        >
          <View style={styles.header}>
            <View style={styles.trophyContainer}>
              <LinearGradient
                colors={['#FBBF24', '#F59E0B']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.trophyGradient}
              >
                <Trophy size={responsiveIconSize.lg} color="#FFFFFF" />
              </LinearGradient>
              <Sparkles size={12} color="#6366F1" style={styles.sparkleIcon} />
            </View>
            <View style={styles.headerTextContainer}>
              <Text style={[styles.title, darkMode && styles.titleDark]}>
                Achievements
              </Text>
              <Text style={[styles.statsText, darkMode && styles.statsTextDark]}>
                {stats.completed} / {stats.total} completed • {stats.inProgress} in progress
              </Text>
            </View>
          </View>
        </LinearGradient>
      </BlurView>

      {/* Controls Row */}
      <View style={styles.controls}>
        <TouchableOpacity
          onPress={() => setShowFilters(!showFilters)}
          style={[styles.filterToggle, showFilters && styles.filterToggleActive]}
        >
          <Filter size={scale(16)} color={showFilters ? '#FFF' : (darkMode ? '#94A3B8' : '#64748B')} />
          <Text style={[
            styles.filterToggleText,
            showFilters && styles.filterToggleTextActive,
            darkMode && styles.controlTextDark,
          ]}>
            Filters
          </Text>
        </TouchableOpacity>

        <View style={styles.sortControls}>
          {(['progress', 'rarity', 'title'] as const).map((s) => (
            <TouchableOpacity
              key={s}
              onPress={() => setSort(s)}
              style={[styles.sortButton, sort === s && styles.sortButtonActive]}
            >
              <Text style={[
                styles.sortButtonText,
                sort === s && styles.sortButtonTextActive,
                darkMode && styles.controlTextDark,
              ]}>
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Category Filters */}
      {showFilters && (
        <View style={styles.filtersContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoriesScroll}>
            {CATEGORIES.map(category => {
              const CategoryIcon = category.icon;
              const isActive = selectedCategory === category.id;
              const categoryStats = stats.byCategory[category.id];
              const count = category.id === 'all' ? stats.total : (categoryStats?.total || 0);

              return (
                <TouchableOpacity
                  key={category.id}
                  style={[
                    styles.categoryChip,
                    isActive && { backgroundColor: category.color },
                    !isActive && darkMode && styles.categoryChipDark,
                  ]}
                  onPress={() => setSelectedCategory(category.id)}
                >
                  <CategoryIcon size={scale(14)} color={isActive ? '#FFF' : category.color} />
                  <Text style={[
                    styles.categoryChipText,
                    isActive && styles.categoryChipTextActive,
                    !isActive && darkMode && styles.categoryChipTextDark,
                  ]}>
                    {category.label} ({count})
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Secret Toggle */}
          <TouchableOpacity
            style={[styles.secretToggle, darkMode && styles.secretToggleDark]}
            onPress={() => setShowSecret(!showSecret)}
          >
            {showSecret ? (
              <Eye size={scale(14)} color="#F59E0B" />
            ) : (
              <EyeOff size={scale(14)} color={darkMode ? '#64748B' : '#94A3B8'} />
            )}
            <Text style={[
              styles.secretToggleText,
              showSecret && styles.secretToggleTextActive,
              darkMode && styles.secretToggleTextDark,
            ]}>
              {showSecret ? 'Hide Secrets' : 'Show Secret Hints'}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Achievements List */}
      <View>
        {sortedAchievements.length === 0 && (
          <View style={styles.emptyState}>
            <Trophy size={scale(40)} color={darkMode ? '#475569' : '#CBD5E1'} />
            <Text style={[styles.empty, darkMode && styles.cardDescDark]}>
              No achievements found in this category.
            </Text>
          </View>
        )}
        {sortedAchievements.map(a => {
          // Calculate display progress (capped at 1.0 for visual bar)
          const displayProgress = Math.min(1, a.progress);
          // Use raw progress for claim detection (allows > 1.0)
          // Add small epsilon (0.0001) to handle floating point precision issues
          const canClaim = a.progress >= 0.9999 && !a.claimed;
          const categoryInfo = getCategoryInfo(a.category);
          const rarityConfig = RARITY_CONFIG[a.rarity];
          const RarityIcon = getRarityIcon(a.rarity);
          const CategoryIcon = categoryInfo.icon;

          // Determine if achievement is completed (claimed or progress >= 1)
          const isCompleted = a.claimed || a.progress >= 1;
          
          return (
            <View 
              key={a.id} 
              style={[
                styles.card, 
                darkMode && styles.cardDark,
                isCompleted && styles.cardCompleted
              ]}
            >
              <View style={styles.cardHeader}>
                {a.icon ? (
                  <Image source={a.icon} style={styles.achievementIcon} />
                ) : (
                  <View style={[styles.categoryIconContainer, { backgroundColor: `${categoryInfo.color}20` }]}>
                    <CategoryIcon size={scale(18)} color={categoryInfo.color} />
                  </View>
                )}
                <View style={styles.cardTitleContainer}>
                  <Text style={[styles.cardTitle, darkMode && styles.cardTitleDark]}>
                    {a.isSecret && a.progress === 0 ? '???' : a.title}
                  </Text>
                  {a.isSecret && (
                    <View style={styles.secretBadge}>
                      <Lock size={scale(10)} color="#F59E0B" />
                      <Text style={styles.secretBadgeText}>Secret</Text>
                    </View>
                  )}
                </View>
                <View style={styles.headerRight}>
                  <Text style={styles.stackText}>{`${a.stackIndex + 1}/${a.stackSize}`}</Text>
                  {a.goldReward > 0 && (
                    <View style={styles.reward}>
                      <LinearGradient
                        colors={['#6366F1', '#4F46E5']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.gemContainer}
                      >
                        <Gem size={responsiveIconSize.sm} color="#FFFFFF" />
                      </LinearGradient>
                      <Text style={[styles.rewardText, { color: '#6366F1' }]}>{a.goldReward}</Text>
                    </View>
                  )}
                </View>
              </View>

              {/* Rarity Indicator - Moved below header to prevent blocking */}
              <View style={[styles.rarityBadge, { backgroundColor: rarityConfig.bgColor }]}>
                <RarityIcon size={scale(10)} color={rarityConfig.color} />
                <Text style={[styles.rarityText, { color: rarityConfig.color }]}>
                  {rarityConfig.label}
                </Text>
              </View>

              <Text style={[styles.cardDesc, darkMode && styles.cardDescDark]}>
                {a.isSecret && a.progress === 0 ? 'Complete hidden requirements to unlock this secret achievement!' : a.description}
              </Text>

              {a.nextTitle && (
                <Text style={[styles.nextText, darkMode && styles.cardDescDark]}>
                  Next: {a.nextTitle}
                </Text>
              )}

              {a.claimed ? (
                <View style={styles.progressContainer}>
                  <View style={styles.claimedBadge}>
                    <Sparkles size={14} color="#10B981" />
                    <Text style={styles.claimedText}>Claimed</Text>
                  </View>
                  {/* Narrative context: when was this achievement unlocked? */}
                  {achievementUnlocks?.[a.id] && (
                    <Text style={[styles.narrativeText, darkMode && styles.narrativeTextDark]}>
                      Unlocked at age {achievementUnlocks[a.id].age} ({achievementUnlocks[a.id].year})
                      {achievementUnlocks[a.id].money > 0
                        ? ` with $${achievementUnlocks[a.id].money.toLocaleString()}`
                        : ''}
                    </Text>
                  )}
                </View>
              ) : canClaim ? (
                <ClaimRewardButton
                  onPress={() => {
                    try {
                      if (claimProgressAchievement) {
                        claimProgressAchievement(a.id, a.goldReward);
                      }
                    } catch (error) {
                      // Achievement claim failed silently
                    }
                  }}
                />
              ) : (
                <View style={styles.progressContainer}>
                  <View style={styles.progressBar}>
                    <View style={[styles.progressFill, { width: `${displayProgress * 100}%` }]}>
                      <LinearGradient
                        colors={[categoryInfo.color, `${categoryInfo.color}CC`]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={StyleSheet.absoluteFill}
                      />
                    </View>
                    <View style={styles.progressGlow} />
                  </View>
                  <Text style={[styles.progressPercent, darkMode && styles.progressPercentDark]}>
                    {Math.min(100, Math.round(a.progress * 100))}%
                  </Text>
                </View>
              )}
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: verticalScale(20),
    backgroundColor: '#1E293B',
    borderRadius: responsiveBorderRadius.lg,
    padding: responsiveSpacing.lg,
    ...Platform.select({
      web: { boxShadow: '0px 8px 16px rgba(99, 102, 241, 0.15)' } as any,
      default: {
        shadowColor: '#6366F1',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.15,
        shadowRadius: 16,
      },
    }),
    elevation: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  containerDark: {
    backgroundColor: '#1E293B',
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  headerBlur: {
    borderRadius: responsiveBorderRadius.md,
    overflow: 'hidden',
    marginBottom: responsiveSpacing.md,
  },
  headerGradient: {
    padding: responsiveSpacing.md,
    borderRadius: responsiveBorderRadius.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTextContainer: {
    flex: 1,
    marginLeft: responsiveSpacing.sm,
  },
  trophyContainer: {
    position: 'relative',
    marginRight: responsiveSpacing.sm,
  },
  trophyGradient: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      web: { boxShadow: '0px 4px 8px rgba(251, 191, 36, 0.3)' } as any,
      default: {
        shadowColor: '#FBBF24',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
    }),
    elevation: 6,
  },
  sparkleIcon: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 2,
  },
  title: {
    fontSize: responsiveFontSize.lg,
    fontWeight: '600',
    color: '#F8FAFC',
  },
  titleDark: {
    color: '#F8FAFC',
  },
  statsText: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },
  statsTextDark: {
    color: '#94A3B8',
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: responsiveSpacing.md,
  },
  filterToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  filterToggleActive: {
    backgroundColor: '#6366F1',
  },
  filterToggleText: {
    fontSize: fontScale(13),
    color: '#94A3B8',
    fontWeight: '500',
  },
  filterToggleTextActive: {
    color: '#FFFFFF',
  },
  sortControls: {
    flexDirection: 'row',
    gap: scale(4),
  },
  sortButton: {
    paddingHorizontal: scale(10),
    paddingVertical: scale(6),
    borderRadius: scale(12),
  },
  sortButtonActive: {
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
  },
  sortButtonText: {
    fontSize: fontScale(12),
    color: '#94A3B8',
  },
  sortButtonTextActive: {
    color: '#6366F1',
    fontWeight: '600',
  },
  controlTextDark: {
    color: '#94A3B8',
  },
  filtersContainer: {
    marginBottom: responsiveSpacing.md,
  },
  categoriesScroll: {
    paddingVertical: scale(8),
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: scale(12),
    paddingVertical: scale(8),
    borderRadius: scale(20),
    marginRight: scale(8),
    gap: scale(6),
  },
  categoryChipDark: {
    backgroundColor: '#334155',
  },
  categoryChipText: {
    fontSize: fontScale(12),
    fontWeight: '500',
    color: '#CBD5E1',
  },
  categoryChipTextActive: {
    color: '#FFFFFF',
  },
  categoryChipTextDark: {
    color: '#CBD5E1',
  },
  secretToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(6),
    paddingTop: scale(10),
    paddingBottom: scale(4),
  },
  secretToggleDark: {},
  secretToggleText: {
    fontSize: fontScale(12),
    color: '#64748B',
  },
  secretToggleTextActive: {
    color: '#F59E0B',
  },
  secretToggleTextDark: {
    color: '#64748B',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: scale(40),
    gap: scale(12),
  },
  empty: {
    textAlign: 'center',
    color: '#64748B',
  },
  card: {
    marginBottom: responsiveSpacing.md,
    padding: responsiveSpacing.md,
    borderRadius: responsiveBorderRadius.md,
    backgroundColor: '#334155',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    ...Platform.select({
      web: { boxShadow: '0px 4px 8px rgba(99, 102, 241, 0.1)' } as any,
      default: {
        shadowColor: '#6366F1',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
    }),
    elevation: 4,
    position: 'relative',
    overflow: 'hidden',
  },
  cardDark: {
    backgroundColor: '#334155',
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  cardCompleted: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderColor: 'rgba(255, 255, 255, 0.3)',
    opacity: 0.9,
  },
  rarityBadge: {
    position: 'absolute',
    top: scale(8),
    right: scale(8),
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(4),
    paddingHorizontal: scale(8),
    paddingVertical: scale(3),
    borderRadius: scale(10),
    zIndex: 10, // Ensure it's above other elements
    maxWidth: scale(100), // Prevent overflow
  },
  rarityText: {
    fontSize: fontScale(10),
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: scale(8),
    paddingRight: scale(70),
    marginTop: scale(8), // Add space for rarity badge
  },
  categoryIconContainer: {
    width: scale(36),
    height: scale(36),
    borderRadius: scale(10),
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: responsiveSpacing.sm,
  },
  cardTitleContainer: {
    flex: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'absolute',
    right: 0,
    top: 0,
    gap: scale(4), // Add gap between stack text and reward
  },
  achievementIcon: {
    width: responsiveIconSize.lg,
    height: responsiveIconSize.lg,
    marginRight: responsiveSpacing.sm,
  },
  cardTitle: {
    fontSize: responsiveFontSize.base,
    fontWeight: '600',
    color: '#F8FAFC',
  },
  cardTitleDark: {
    color: '#F8FAFC',
  },
  secretBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(4),
    marginTop: scale(4),
  },
  secretBadgeText: {
    fontSize: fontScale(10),
    color: '#F59E0B',
    fontWeight: '500',
  },
  reward: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  gemContainer: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      web: { boxShadow: '0px 2px 4px rgba(99, 102, 241, 0.3)' } as any,
      default: {
        shadowColor: '#6366F1',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
      },
    }),
    elevation: 3,
  },
  rewardText: {
    marginLeft: responsiveSpacing.xs,
    color: '#6366F1',
    fontWeight: '600',
    fontSize: responsiveFontSize.sm,
  },
  stackText: {
    marginRight: responsiveSpacing.sm,
    color: '#94A3B8',
    fontSize: responsiveFontSize.sm,
  },
  cardDesc: {
    fontSize: responsiveFontSize.sm,
    color: '#CBD5E1',
    marginBottom: responsiveSpacing.sm,
    lineHeight: fontScale(18),
  },
  cardDescDark: {
    color: '#CBD5E1',
  },
  nextText: {
    fontSize: responsiveFontSize.sm,
    color: '#64748B',
    marginBottom: responsiveSpacing.xs,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(10),
  },
  progressBar: {
    flex: 1,
    height: scale(10),
    backgroundColor: '#475569',
    borderRadius: responsiveBorderRadius.sm,
    overflow: 'hidden',
    shadowColor: '#6366F1',
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 3,
    position: 'relative',
  },
  progressFill: {
    height: '100%',
    borderRadius: responsiveBorderRadius.sm,
    overflow: 'hidden',
  },
  progressGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: responsiveBorderRadius.sm,
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    shadowColor: '#6366F1',
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 8,
  },
  progressPercent: {
    fontSize: fontScale(12),
    fontWeight: '600',
    color: '#94A3B8',
    minWidth: scale(40),
    textAlign: 'right',
  },
  progressPercentDark: {
    color: '#94A3B8',
  },
  claimedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: scale(6),
    paddingVertical: scale(8),
    paddingHorizontal: responsiveSpacing.md,
    borderRadius: responsiveBorderRadius.md,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  claimedText: {
    fontWeight: '600',
    color: '#10B981',
    fontSize: responsiveFontSize.base,
  },
  narrativeText: {
    fontSize: responsiveFontSize.xs,
    color: '#64748B',
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 4,
  },
  narrativeTextDark: {
    color: '#94A3B8',
  },
  claimButtonBlur: {
    borderRadius: responsiveBorderRadius.md,
    overflow: 'hidden',
    marginTop: responsiveSpacing.xs,
  },
  claimButton: {
    paddingVertical: scale(8),
    paddingHorizontal: responsiveSpacing.md,
    borderRadius: responsiveBorderRadius.md,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    shadowColor: '#6366F1',
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 6,
  },
  claimIcon: {
    marginRight: responsiveSpacing.xs,
  },
  claimText: {
    fontWeight: '600',
    color: '#FFFFFF',
    fontSize: responsiveFontSize.base,
  },
});

