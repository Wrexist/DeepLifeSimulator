/**
 * ActiveGoalsCard Component
 * 
 * Displays up to 3 active goals from different categories with progress bars.
 * Supports the enhanced parallel goal system.
 */

import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Target, ChevronRight, Trophy, Star, Sparkles } from 'lucide-react-native';
import { useGameSelector, shallowEqual } from '@/contexts/game/useGameSelector';
import { getActiveGoals, getChallengeGoals, ENHANCED_GOAL_DEFINITIONS } from '@/utils/enhancedGoalSystem';
import { GOAL_CATEGORIES, type Goal, type GoalCategory } from '@/utils/goalSystem';
import { fontScale, responsiveSpacing, responsiveBorderRadius } from '@/utils/scaling';
import LinearGradientFallback from '@/components/fallbacks/LinearGradientFallback';

const LinearGradient = LinearGradientFallback;

interface ActiveGoalsCardProps {
    onGoalPress?: (goal: Goal) => void;
    compact?: boolean;
}

function GoalProgressBar({ progress, color }: { progress: number; color: string }) {
    return (
        <View style={styles.progressBarContainer}>
            <View style={styles.progressBarBg}>
                <View
                    style={[
                        styles.progressBarFill,
                        {
                            width: `${Math.min(100, Math.max(0, progress))}%`,
                            backgroundColor: color,
                        }
                    ]}
                />
            </View>
            <Text style={styles.progressText}>{Math.round(progress)}%</Text>
        </View>
    );
}

function GoalItem({ goal, onPress, isChallenge = false }: { goal: Goal; onPress?: () => void; isChallenge?: boolean }) {
    const categoryInfo = GOAL_CATEGORIES[goal.category as GoalCategory] || GOAL_CATEGORIES.finance;
    const RewardIcon = goal.reward.icon;

    return (
        <TouchableOpacity
            style={[styles.goalItem, isChallenge && styles.challengeGoalItem]}
            onPress={onPress}
            activeOpacity={0.7}
            accessibilityLabel={`Goal: ${goal.title}, ${Math.round(goal.progress)}% complete`}
            accessibilityRole="button"
        >
            <View style={styles.goalHeader}>
                <View style={[styles.categoryBadge, { backgroundColor: categoryInfo.color + '20' }]}>
                    <Text style={styles.categoryIcon}>{categoryInfo.icon}</Text>
                    <Text style={[styles.categoryLabel, { color: categoryInfo.color }]}>
                        {categoryInfo.name}
                    </Text>
                </View>
                {isChallenge && (
                    <View style={styles.challengeBadge}>
                        <Star size={10} color="#F59E0B" fill="#F59E0B" />
                        <Text style={styles.challengeLabel}>Challenge</Text>
                    </View>
                )}
            </View>

            <Text style={styles.goalTitle} numberOfLines={1}>{goal.title}</Text>
            <Text style={styles.goalDescription} numberOfLines={2}>{goal.description}</Text>

            <GoalProgressBar progress={goal.progress} color={categoryInfo.color} />

            <View style={styles.rewardRow}>
                <View style={[styles.rewardBadge, { backgroundColor: goal.reward.color + '15' }]}>
                    <RewardIcon size={12} color={goal.reward.color} />
                    <Text style={[styles.rewardText, { color: goal.reward.color }]}>
                        +{goal.reward.amount} {goal.reward.type === 'money' ? '$' : goal.reward.type}
                    </Text>
                </View>
                <ChevronRight size={16} color="#94A3B8" />
            </View>
        </TouchableOpacity>
    );
}

function ActiveGoalsCard({ onGoalPress, compact = false }: ActiveGoalsCardProps) {
    // R-perf: subscribe to only the slices this card derives goals from, so it
    // re-renders when goal-relevant state changes — not on every unrelated tick
    // (it previously read the whole monolith via useGame()). Selectors return
    // raw references only (no `|| []` inside a selector — that would defeat the
    // store's memoization); fallbacks are applied in the memos below.
    const stats = useGameSelector((s) => s?.stats, shallowEqual);
    const week = useGameSelector((s) => s?.week);
    const weeksLived = useGameSelector((s) => s?.weeksLived);
    const currentJob = useGameSelector((s) => s?.currentJob);
    const bankSavings = useGameSelector((s) => s?.bankSavings);
    const completedGoals = useGameSelector((s) => s?.completedGoals);
    const items = useGameSelector((s) => s?.items);
    const relationships = useGameSelector((s) => s?.relationships);
    const educations = useGameSelector((s) => s?.educations);
    const realEstate = useGameSelector((s) => s?.realEstate);
    const careers = useGameSelector((s) => s?.careers);
    const [showChallenges, setShowChallenges] = useState(false);

    // Get active goals using enhanced system
    const activeGoals = useMemo(() => {
        if (!stats) return [];
        return getActiveGoals({
            stats,
            week,
            weeksLived: weeksLived || 0,
            currentJob: currentJob || null,
            bankSavings: bankSavings || 0,
            completedGoals: completedGoals || [],
            items,
            relationships,
            educations,
            realEstate,
            careers,
            healthyWeeksStreak: 0, // Default value
        });
    }, [stats, week, weeksLived, currentJob, bankSavings, completedGoals, items, relationships, educations, realEstate, careers]);

    // Get challenge goals
    const challengeGoals = useMemo(() => {
        if (!stats) return [];
        return getChallengeGoals({
            stats,
            week,
            weeksLived: weeksLived || 0,
            currentJob: currentJob || null,
            bankSavings: bankSavings || 0,
            completedGoals: completedGoals || [],
            items,
            relationships,
            educations,
            realEstate,
            careers,
            healthyWeeksStreak: 0, // Default value
        });
    }, [stats, week, weeksLived, currentJob, bankSavings, completedGoals, items, relationships, educations, realEstate, careers]);

    const completedCount = (completedGoals || []).length;
    const totalGoals = ENHANCED_GOAL_DEFINITIONS.filter(g => !g.isOptional).length;

    if (activeGoals.length === 0 && challengeGoals.length === 0) {
        return (
            <View style={styles.container}>
                <View style={styles.headerRow}>
                    <Trophy size={20} color="#10B981" />
                    <Text style={styles.headerTitle}>All Goals Completed!</Text>
                </View>
                <Text style={styles.completedMessage}>
                    Amazing! You've achieved all available goals. Keep exploring and living your best life!
                </Text>
            </View>
        );
    }

    if (compact && activeGoals.length > 0) {
        // Compact mode: just show first goal
        const goal = activeGoals[0];
        const categoryInfo = GOAL_CATEGORIES[goal.category as GoalCategory] || GOAL_CATEGORIES.finance;

        return (
            <TouchableOpacity
                style={styles.compactContainer}
                onPress={() => onGoalPress?.(goal)}
                activeOpacity={0.7}
            >
                <View style={styles.compactContent}>
                    <Target size={18} color={categoryInfo.color} />
                    <View style={styles.compactTextContainer}>
                        <Text style={styles.compactTitle} numberOfLines={1}>{goal.title}</Text>
                        <View style={styles.compactProgressContainer}>
                            <View style={styles.compactProgressBg}>
                                <View
                                    style={[
                                        styles.compactProgressFill,
                                        { width: `${goal.progress}%`, backgroundColor: categoryInfo.color }
                                    ]}
                                />
                            </View>
                            <Text style={styles.compactProgressText}>{Math.round(goal.progress)}%</Text>
                        </View>
                    </View>
                    <ChevronRight size={18} color="#94A3B8" />
                </View>
            </TouchableOpacity>
        );
    }

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.headerRow}>
                <View style={styles.headerLeft}>
                    <Target size={18} color="rgba(226, 232, 240, 0.85)" />
                    <Text style={styles.headerTitle}>Active Goals</Text>
                </View>
                <View style={styles.headerRight}>
                    <Text style={styles.progressCounter}>
                        {completedCount}/{totalGoals} completed
                    </Text>
                </View>
            </View>

            {/* Active Goals List */}
            <View style={styles.goalsList}>
                {activeGoals.map(goal => (
                    <GoalItem
                        key={goal.id}
                        goal={goal}
                        onPress={() => onGoalPress?.(goal)}
                    />
                ))}
            </View>

            {/* Challenge Goals Toggle */}
            {challengeGoals.length > 0 && (
                <>
                    <TouchableOpacity
                        style={styles.challengeToggle}
                        onPress={() => setShowChallenges(!showChallenges)}
                        activeOpacity={0.7}
                    >
                        <Sparkles size={16} color="#F59E0B" />
                        <Text style={styles.challengeToggleText}>
                            {showChallenges ? 'Hide' : 'Show'} Challenge Goals ({challengeGoals.length})
                        </Text>
                        <ChevronRight
                            size={16}
                            color="#F59E0B"
                            style={{ transform: [{ rotate: showChallenges ? '90deg' : '0deg' }] }}
                        />
                    </TouchableOpacity>

                    {showChallenges && (
                        <View style={styles.goalsList}>
                            {challengeGoals.map(goal => (
                                <GoalItem
                                    key={goal.id}
                                    goal={goal}
                                    onPress={() => onGoalPress?.(goal)}
                                    isChallenge
                                />
                            ))}
                        </View>
                    )}
                </>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        marginVertical: responsiveSpacing.sm,
        padding: responsiveSpacing.md,
        backgroundColor: 'rgba(15, 23, 42, 0.55)',
        borderRadius: responsiveBorderRadius.md,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: 'rgba(255, 255, 255, 0.08)',
    },
    compactContainer: {
        marginVertical: responsiveSpacing.sm,
        padding: responsiveSpacing.md,
        backgroundColor: 'rgba(15, 23, 42, 0.55)',
        borderRadius: responsiveBorderRadius.md,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: 'rgba(255, 255, 255, 0.08)',
    },
    compactContent: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    compactTextContainer: {
        flex: 1,
        marginLeft: responsiveSpacing.sm,
        marginRight: responsiveSpacing.sm,
    },
    compactTitle: {
        fontSize: fontScale(14),
        fontWeight: '600',
        color: '#F9FAFB',
        marginBottom: 4,
    },
    compactProgressContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    compactProgressBg: {
        flex: 1,
        height: 4,
        backgroundColor: '#334155',
        borderRadius: 2,
        overflow: 'hidden',
    },
    compactProgressFill: {
        height: '100%',
        borderRadius: 2,
    },
    compactProgressText: {
        fontSize: fontScale(11),
        color: '#94A3B8',
        marginLeft: 6,
        minWidth: 32,
        textAlign: 'right',
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: responsiveSpacing.md,
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    headerRight: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: fontScale(16),
        fontWeight: '700',
        color: '#F8FAFC',
        letterSpacing: -0.2,
        marginLeft: responsiveSpacing.sm,
    },
    progressCounter: {
        fontSize: fontScale(11),
        color: 'rgba(226, 232, 240, 0.6)',
        fontWeight: '600',
        fontVariant: ['tabular-nums'],
    },
    completedMessage: {
        fontSize: fontScale(14),
        color: '#D1D5DB',
        lineHeight: 20,
    },
    goalsList: {
        gap: responsiveSpacing.sm,
    },
    goalItem: {
        backgroundColor: 'rgba(2, 6, 23, 0.45)',
        borderRadius: responsiveBorderRadius.md,
        padding: responsiveSpacing.md,
        marginBottom: responsiveSpacing.xs,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: 'rgba(255, 255, 255, 0.06)',
    },
    challengeGoalItem: {
        borderColor: 'rgba(245, 158, 11, 0.32)',
        backgroundColor: 'rgba(2, 6, 23, 0.45)',
    },
    goalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: responsiveSpacing.xs,
    },
    categoryBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 0,
        paddingVertical: 0,
        backgroundColor: 'transparent',
    },
    categoryIcon: {
        fontSize: 11,
        marginRight: 6,
        opacity: 0.85,
    },
    categoryLabel: {
        fontSize: fontScale(10),
        fontWeight: '700',
        textTransform: 'uppercase',
        letterSpacing: 0.7,
    },
    challengeBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'transparent',
        paddingHorizontal: 0,
        paddingVertical: 0,
        marginLeft: 10,
    },
    challengeLabel: {
        fontSize: fontScale(9),
        fontWeight: '600',
        color: '#F59E0B',
        marginLeft: 3,
        textTransform: 'uppercase',
    },
    goalTitle: {
        fontSize: fontScale(15),
        fontWeight: '700',
        color: '#F8FAFC',
        letterSpacing: -0.2,
        marginTop: 6,
        marginBottom: 2,
    },
    goalDescription: {
        fontSize: fontScale(12),
        color: 'rgba(226, 232, 240, 0.65)',
        marginBottom: responsiveSpacing.sm,
        lineHeight: 17,
    },
    progressBarContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: responsiveSpacing.sm,
    },
    progressBarBg: {
        flex: 1,
        height: 5,
        backgroundColor: 'rgba(255, 255, 255, 0.06)',
        borderRadius: 3,
        overflow: 'hidden',
    },
    progressBarFill: {
        height: '100%',
        borderRadius: 3,
    },
    progressText: {
        fontSize: fontScale(11),
        fontWeight: '700',
        color: 'rgba(226, 232, 240, 0.65)',
        marginLeft: 10,
        minWidth: 36,
        textAlign: 'right',
        fontVariant: ['tabular-nums'],
    },
    rewardRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    rewardBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        paddingHorizontal: 0,
        paddingVertical: 0,
        backgroundColor: 'transparent',
    },
    rewardText: {
        fontSize: fontScale(11),
        fontWeight: '700',
        fontVariant: ['tabular-nums'],
    },
    challengeToggle: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: responsiveSpacing.sm,
        marginTop: responsiveSpacing.sm,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: 'rgba(255, 255, 255, 0.08)',
    },
    challengeToggleText: {
        fontSize: fontScale(12),
        fontWeight: '600',
        color: '#F59E0B',
        marginHorizontal: 6,
    },
});

const MemoizedActiveGoalsCard = React.memo(ActiveGoalsCard);
export { MemoizedActiveGoalsCard as ActiveGoalsCard };
export default MemoizedActiveGoalsCard;
