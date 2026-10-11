import { uiPalette } from '@/lib/config/theme';
import { achievementArtwork } from '@/lib/config/achievementArtwork';
/**
 * AchievementsProgress Component
 * 
 * Enhanced achievements display with category filters, rarity indicators,
 * and secret achievement hints
 */
import React, { useMemo, useState } from 'react';
import { View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  ScrollView } from 'react-native';
import Gradient from '@/components/ui/Gradient';
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
  responsiveSpacing,
  responsiveBorderRadius,
  scale,
  fontScale,
} from '@/utils/scaling';
const LinearGradient = Gradient;

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
  common: { label: 'Common', color: uiPalette.lightMuted, bgColor: 'rgba(107, 114, 128, 0.15)' },
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
  if (combined.includes('cash') || combined.includes('money') || combined.includes('wealth') || combined.includes('rich') || combined.includes('million') || combined.includes('billion') || combined.includes('net worth') || combined.includes('savings') || combined.includes('debt')) {
    return 'wealth';
  }
  if (combined.includes('health') || combined.includes('fitness') || combined.includes('disease') || combined.includes('vaccin') || combined.includes('cure')) {
    return 'health';
  }
  if (combined.includes('crime') || combined.includes('jail') || combined.includes('prison') || combined.includes('wanted') || combined.includes('hack') || combined.includes('escape') || combined.includes('criminal')) {
    return 'crime';
  }
  if (combined.includes('travel') || combined.includes('visit') || combined.includes('destination') || combined.includes('passport') ||  /\btrip\b/.test(combined) || combined.includes('voyage') || combined.includes('flight')) {
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
// AnimatedView + animatedStyle and forward onPressIn/onPressOut.
function ClaimRewardButton({ onPress, disabled }: ClaimRewardButtonProps) {
  const { AnimatedView, animatedStyle, onPressIn, onPressOut } = usePressableScale({ scale: 0.96 });
  return (
    <AnimatedView style={animatedStyle}>
      <TouchableOpacity
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityState={{ disabled: !!disabled }}
        style={styles.claimButton}
      >
        <Sparkles size={16} color={uiPalette.navy} style={styles.claimIcon} />
        <Text style={styles.claimText}>Claim reward</Text>
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
      <View style={styles.header}>
        <Text style={styles.eyebrow}>YOUR LIFE, IN MILESTONES</Text>
        <Text accessibilityRole="header" style={styles.title}>Achievements</Text>
        <Text style={styles.statsText}>
          {stats.completed} of {stats.total} completed · {stats.inProgress} in progress
        </Text>
      </View>

      {/* Controls Row */}
      <View style={styles.controls}>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityState={{ expanded: showFilters }}
          aria-expanded={showFilters}
          onPress={() => setShowFilters(!showFilters)}
          style={[styles.filterToggle, showFilters && styles.filterToggleActive]}
        >
          <Filter size={scale(16)} color={showFilters ? uiPalette.white : (darkMode ? uiPalette.muted : uiPalette.lightMuted)} />
          <Text style={[
            styles.filterToggleText,
            darkMode && styles.controlTextDark,
            showFilters && styles.filterToggleTextActive,
          ]}>
            Filters
          </Text>
        </TouchableOpacity>

        <View style={styles.sortControls} accessibilityRole="radiogroup" accessibilityLabel="Sort achievements">
          {(['progress', 'rarity', 'title'] as const).map((s) => (
            <TouchableOpacity
              key={s}
              accessibilityRole="radio"
              accessibilityLabel={`Sort by ${s}`}
              accessibilityState={{ checked: sort === s }}
              aria-checked={sort === s}
              onPress={() => setSort(s)}
              style={[styles.sortButton, sort === s && styles.sortButtonActive]}
            >
              <Text style={[
                styles.sortButtonText,
                darkMode && styles.controlTextDark,
                sort === s && styles.sortButtonTextActive,
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
                  accessibilityRole="button"
                  accessibilityState={{ selected: isActive }}
                  aria-pressed={isActive}
                  style={[
                    styles.categoryChip,
                    isActive && styles.categoryChipActive,
                    !isActive && darkMode && styles.categoryChipDark,
                  ]}
                  onPress={() => setSelectedCategory(category.id)}
                >
                  <CategoryIcon size={scale(14)} color={isActive ? uiPalette.white : category.color} />
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
            accessibilityRole="switch"
            accessibilityState={{ checked: showSecret }}
            aria-checked={showSecret}
            style={[styles.secretToggle, darkMode && styles.secretToggleDark]}
            onPress={() => setShowSecret(!showSecret)}
          >
            {showSecret ? (
              <Eye size={scale(14)} color="#F59E0B" />
            ) : (
              <EyeOff size={scale(14)} color={darkMode ? uiPalette.lightMuted : uiPalette.muted} />
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
            <Trophy size={scale(40)} color={darkMode ? uiPalette.lightSecondary : uiPalette.secondary} />
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
          const categoryInfo = CATEGORIES.find(category => category.id === a.category) ?? CATEGORIES[0];
          const rarityConfig = RARITY_CONFIG[a.rarity];
          const individualArt = achievementArtwork[a.id];
          const artwork = individualArt || a.icon;
          const RarityIcon = getRarityIcon(a.rarity);

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
                {artwork ? (
                  <Image
                    source={artwork}
                    style={[styles.achievementIcon, !!individualArt && styles.individualArtwork]}
                    resizeMode="contain"
                    accessible={false}
                  />
                ) : (
                  <View style={styles.categoryIconContainer}>
                    <Trophy size={scale(24)} color={rarityConfig.color} />
                  </View>
                )}
                <View style={styles.cardTitleContainer}>
                  <Text style={styles.cardEyebrow}>{canClaim ? 'Ready to claim' : categoryInfo.label === 'All' ? 'Milestone' : categoryInfo.label}</Text>
                  <Text style={[styles.cardTitle, darkMode && styles.cardTitleDark]}>
                    {a.isSecret && a.progress === 0 ? '???' : a.title}
                  </Text>
                  {a.isSecret && (
                    <View style={styles.secretBadge}>
                      <Lock size={scale(10)} color={uiPalette.muted} />
                      <Text style={styles.secretBadgeText}>Secret</Text>
                    </View>
                  )}
                </View>
              </View>

              <View style={styles.metadata}>
                <View style={styles.rarityBadge}>
                  <RarityIcon size={scale(12)} color={rarityConfig.color} />
                  <Text style={styles.rarityText}>{rarityConfig.label}</Text>
                </View>
                {a.stackSize > 1 && <Text style={styles.stackText}>{`Tier ${a.stackIndex + 1} of ${a.stackSize}`}</Text>}
                {a.goldReward > 0 && (
                  <View style={styles.reward}>
                    <Gem size={scale(14)} color="#A5B4FC" />
                    <Text style={styles.rewardText}>{a.goldReward} gems</Text>
                  </View>
                )}
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
                        ? ` with $${achievementUnlocks[a.id].money.toLocaleString('en-US')}`
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
                    } catch {
                      // Achievement claim failed silently
                    }
                  }}
                />
              ) : (
                <View style={styles.progressContainer}>
                  <View style={styles.progressBar} accessibilityRole="progressbar" accessibilityLabel={`${a.title} progress`} accessibilityValue={{ min: 0, max: 100, now: Math.round(displayProgress * 100) }}>
                    <View style={[styles.progressFill, { width: `${displayProgress * 100}%` }]}>
                      <LinearGradient
                        colors={[categoryInfo.color, `${categoryInfo.color}CC`]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={StyleSheet.absoluteFill}
                      />
                    </View>
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
  container: { width: '100%', maxWidth: 680, alignSelf: 'center', paddingHorizontal: responsiveSpacing.md },
  containerDark: {},
  header: { paddingTop: scale(12), paddingBottom: scale(24), gap: scale(8) },
  eyebrow: { color: '#9BB8B5', fontSize: fontScale(10), fontWeight: '600', letterSpacing: 1.6 },
  title: { fontSize: fontScale(30), fontWeight: '600', letterSpacing: -0.8, color: uiPalette.paper },
  statsText: { fontSize: fontScale(13), color: uiPalette.muted, lineHeight: fontScale(20) },
  controls: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 8, marginBottom: responsiveSpacing.md },
  filterToggle: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: uiPalette.surface, paddingHorizontal: 12, borderRadius: 12 },
  filterToggleActive: { backgroundColor: '#294E50' },
  filterToggleText: { fontSize: fontScale(13), color: uiPalette.muted, fontWeight: '500' },
  filterToggleTextActive: { color: uiPalette.paper },
  sortControls: { flexDirection: 'row', flexWrap: 'wrap', gap: 2 },
  sortButton: { minHeight: 44, justifyContent: 'center', paddingHorizontal: scale(10), borderRadius: 12 },
  sortButtonActive: { backgroundColor: '#294E50' },
  sortButtonText: { fontSize: fontScale(12), color: uiPalette.muted },
  sortButtonTextActive: { color: uiPalette.paper, fontWeight: '600' },
  controlTextDark: { color: uiPalette.muted },
  filtersContainer: { marginBottom: responsiveSpacing.md },
  categoriesScroll: { paddingVertical: 4 },
  categoryChip: { minHeight: 44, flexDirection: 'row', alignItems: 'center', backgroundColor: uiPalette.surface, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, marginRight: 8, gap: 6 },
  categoryChipDark: { backgroundColor: uiPalette.surface },
  categoryChipActive: { backgroundColor: '#294E50' },
  categoryChipText: { fontSize: fontScale(12), fontWeight: '500', color: uiPalette.secondary },
  categoryChipTextActive: { color: uiPalette.paper },
  categoryChipTextDark: { color: uiPalette.secondary },
  secretToggle: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 6 },
  secretToggleDark: {},
  secretToggleText: { fontSize: fontScale(12), color: uiPalette.muted },
  secretToggleTextActive: { color: '#FBBF24' },
  secretToggleTextDark: { color: uiPalette.muted },
  emptyState: { alignItems: 'center', paddingVertical: 40, gap: 12 },
  empty: { textAlign: 'center', color: uiPalette.muted },
  card: { marginBottom: responsiveSpacing.md, padding: responsiveSpacing.md, borderRadius: responsiveBorderRadius.lg, backgroundColor: uiPalette.surface, borderWidth: 1, borderColor: uiPalette.raised },
  cardDark: {},
  cardCompleted: { borderColor: '#365A5C' },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: scale(14), gap: scale(12) },
  categoryIconContainer: { width: scale(64), height: scale(64), alignItems: 'center', justifyContent: 'center' },
  achievementIcon: { width: scale(64), height: scale(64) },
  individualArtwork: { width: scale(96), height: scale(96) },
  cardTitleContainer: { flex: 1, minWidth: 0, gap: scale(5) },
  cardEyebrow: { fontSize: fontScale(11), fontWeight: '600', color: '#A7C9C1' },
  cardTitle: { fontSize: fontScale(20), fontWeight: '600', color: uiPalette.paper, letterSpacing: -0.3 },
  cardTitleDark: { color: uiPalette.paper },
  metadata: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 12, rowGap: 8, marginBottom: scale(14), paddingBottom: scale(12), borderBottomWidth: 1, borderBottomColor: uiPalette.raised },
  rarityBadge: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  rarityText: { fontSize: fontScale(11), color: uiPalette.secondary, fontWeight: '500' },
  stackText: { color: uiPalette.muted, fontSize: fontScale(11) },
  reward: { flexDirection: 'row', alignItems: 'center', gap: 5, marginLeft: 'auto' },
  rewardText: { color: '#C7D2FE', fontWeight: '600', fontSize: fontScale(12) },
  secretBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  secretBadgeText: { fontSize: fontScale(10), color: uiPalette.muted },
  cardDesc: { fontSize: fontScale(14), color: uiPalette.secondary, marginBottom: scale(10), lineHeight: fontScale(21) },
  cardDescDark: { color: uiPalette.secondary },
  nextText: { fontSize: fontScale(12), color: uiPalette.muted, marginBottom: scale(14) },
  progressContainer: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10 },
  progressBar: { flex: 1, height: 6, backgroundColor: uiPalette.raised, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3, overflow: 'hidden' },
  progressPercent: { fontSize: fontScale(12), fontWeight: '600', color: uiPalette.muted, minWidth: 40, textAlign: 'right', fontVariant: ['tabular-nums'] },
  progressPercentDark: { color: uiPalette.muted },
  claimedBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8 },
  claimedText: { fontWeight: '600', color: '#8ED5B9', fontSize: fontScale(13) },
  narrativeText: { flexShrink: 1, fontSize: fontScale(12), color: uiPalette.muted },
  narrativeTextDark: { color: uiPalette.muted },
  claimButton: { minHeight: 48, paddingVertical: 12, paddingHorizontal: responsiveSpacing.md, borderRadius: responsiveBorderRadius.md, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', backgroundColor: uiPalette.paper, marginTop: 4 },
  claimIcon: { marginRight: 8 },
  claimText: { fontWeight: '600', color: uiPalette.navy, fontSize: fontScale(14) },
});
