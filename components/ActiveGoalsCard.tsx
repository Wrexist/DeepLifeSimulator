/**
 * ActiveGoalsCard Component
 * 
 * Displays up to 3 active goals from different categories with progress bars.
 * Supports the enhanced parallel goal system.
 */

import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { Target, ChevronRight, Trophy, Star, Sparkles } from 'lucide-react-native';
import { useGame } from '@/contexts/GameContext';
import { getActiveGoals, getChallengeGoals, ENHANCED_GOAL_DEFINITIONS } from '@/utils/enhancedGoalSystem';
import { GOAL_CATEGORIES, type Goal, type GoalCategory } from '@/utils/goalSystem';
import { scale, fontScale, responsiveSpacing, responsiveBorderRadius, responsiveFontSize } from '@/utils/scaling';
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
                <ChevronRight size={16} color="#9CA3AF" />
            </View>
        </TouchableOpacity>
    );
}

function ActiveGoalsCard({ onGoalPress, compact = false }: ActiveGoalsCardProps) {
    const { gameState } = useGame();
    const [showChallenges, setShowChallenges] = useState(false);

    // Get active goals using enhanced system
    const activeGoals = useMemo(() => {
        if (!gameState) return [];
        return getActiveGoals({
            stats: gameState.stats,
            week: gameState.week,
            weeksLived: gameState.weeksLived || 0,
            currentJob: gameState.currentJob || null,
            bankSavings: gameState.bankSavings || 0,
            completedGoals: gameState.completedGoals || [],
            items: gameState.items,
            relationships: gameState.relationships,
            educations: gameState.educations,
            realEstate: gameState.realEstate,
            careers: gameState.careers,
            healthyWeeksStreak: 0, // Default value
        });
    }, [gameState]);

    // Get challenge goals
    const challengeGoals = useMemo(() => {
        if (!gameState) return [];
        return getChallengeGoals({
            stats: gameState.stats,
            week: gameState.week,
            weeksLived: gameState.weeksLived || 0,
            currentJob: gameState.currentJob || null,
            bankSavings: gameState.bankSavings || 0,
            completedGoals: gameState.completedGoals || [],
            items: gameState.items,
            relationships: gameState.relationships,
            educations: gameState.educations,
            realEstate: gameState.realEstate,
            careers: gameState.careers,
            healthyWeeksStreak: 0, // Default value
        });
    }, [gameState]);

    const completedCount = (gameState?.completedGoals || []).length;
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
                    <ChevronRight size={18} color="#9CA3AF" />
                </View>
            </TouchableOpacity>
        );
    }

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.headerRow}>
                <View style={styles.headerLeft}>
                    <Target size={20} color="#3B82F6" />
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
        margin: responsiveSpacing.lg,
        marginBottom: responsiveSpacing.md,
        padding: responsiveSpacing.lg,
        backgroundColor: '#1F2937',
        borderRadius: responsiveBorderRadius.xl,
        borderLeftWidth: 4,
        borderLeftColor: '#3B82F6',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        elevation: 2,
    },
    compactContainer: {
        margin: responsiveSpacing.lg,
        marginBottom: responsiveSpacing.md,
        padding: responsiveSpacing.md,
        backgroundColor: '#1F2937',
        borderRadius: responsiveBorderRadius.lg,
        borderLeftWidth: 3,
        borderLeftColor: '#3B82F6',
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
        backgroundColor: '#374151',
        borderRadius: 2,
        overflow: 'hidden',
    },
    compactProgressFill: {
        height: '100%',
        borderRadius: 2,
    },
    compactProgressText: {
        fontSize: fontScale(11),
        color: '#9CA3AF',
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
        color: '#F9FAFB',
        marginLeft: responsiveSpacing.sm,
    },
    progressCounter: {
        fontSize: fontScale(12),
        color: '#9CA3AF',
        fontWeight: '500',
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
        backgroundColor: '#374151',
        borderRadius: responsiveBorderRadius.lg,
        padding: responsiveSpacing.md,
        marginBottom: responsiveSpacing.xs,
    },
    challengeGoalItem: {
        borderWidth: 1,
        borderColor: '#F59E0B40',
        backgroundColor: '#374151',
    },
    goalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: responsiveSpacing.xs,
    },
    categoryBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 12,
    },
    categoryIcon: {
        fontSize: 12,
        marginRight: 4,
    },
    categoryLabel: {
        fontSize: fontScale(10),
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    challengeBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F59E0B20',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 8,
        marginLeft: 6,
    },
    challengeLabel: {
        fontSize: fontScale(9),
        fontWeight: '600',
        color: '#F59E0B',
        marginLeft: 3,
        textTransform: 'uppercase',
    },
    goalTitle: {
        fontSize: fontScale(14),
        fontWeight: '600',
        color: '#F9FAFB',
        marginBottom: 2,
    },
    goalDescription: {
        fontSize: fontScale(12),
        color: '#9CA3AF',
        marginBottom: responsiveSpacing.sm,
        lineHeight: 16,
    },
    progressBarContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: responsiveSpacing.sm,
    },
    progressBarBg: {
        flex: 1,
        height: 6,
        backgroundColor: '#4B5563',
        borderRadius: 3,
        overflow: 'hidden',
    },
    progressBarFill: {
        height: '100%',
        borderRadius: 3,
    },
    progressText: {
        fontSize: fontScale(11),
        fontWeight: '600',
        color: '#D1D5DB',
        marginLeft: 8,
        minWidth: 36,
        textAlign: 'right',
    },
    rewardRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    rewardBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 8,
    },
    rewardText: {
        fontSize: fontScale(11),
        fontWeight: '600',
        marginLeft: 4,
    },
    challengeToggle: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: responsiveSpacing.sm,
        marginTop: responsiveSpacing.sm,
        borderTopWidth: 1,
        borderTopColor: '#374151',
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
