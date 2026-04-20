/**
 * First Week Guide Component
 * 
 * Shows an overlay guide for new players during their first few weeks.
 * Provides progressive disclosure of game mechanics.
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Animated,
} from 'react-native';
import {
    X,
    ChevronRight,
    Target,
    Briefcase,
    ShoppingCart,
    Heart,
    Zap,
    DollarSign,
    Trophy,
    Sparkles,
} from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { scale, fontScale, responsiveSpacing, responsiveBorderRadius } from '@/utils/scaling';
import LinearGradientFallback from '@/components/fallbacks/LinearGradientFallback';

const LinearGradient = LinearGradientFallback;

const FIRST_WEEK_GUIDE_KEY = '@deep_life_first_week_guide_seen';

interface GuideStepReward {
    type: 'money' | 'gems' | 'energy';
    amount: number;
}

interface GuideStep {
    id: string;
    week: number;
    title: string;
    description: string;
    icon: React.ComponentType<any>;
    iconColor: string;
    action?: string;
    priority: 'high' | 'medium' | 'low';
    reward?: GuideStepReward;
}

const GUIDE_STEPS: GuideStep[] = [
    // Week 1 - Essentials
    {
        id: 'work_first',
        week: 1,
        title: 'Find Work',
        description: 'Street jobs pay 2-4x more than entry careers! Start with street jobs to build cash, then apply for a career later.',
        icon: Briefcase,
        iconColor: '#3B82F6',
        action: 'Go to Work Tab',
        priority: 'high',
        reward: { type: 'money', amount: 50 },
    },
    {
        id: 'manage_stats',
        week: 1,
        title: 'Watch Your Stats',
        description: 'Keep your Health, Happiness, and Energy above 30. If they hit 0, you have 4 weeks to recover!',
        icon: Heart,
        iconColor: '#EF4444',
        priority: 'high',
        reward: { type: 'energy', amount: 10 },
    },
    {
        id: 'buy_food',
        week: 1,
        title: 'Buy Food',
        description: 'Visit the Market to buy food when your Health or Energy gets low.',
        icon: ShoppingCart,
        iconColor: '#10B981',
        action: 'Visit Market',
        priority: 'medium',
        reward: { type: 'gems', amount: 5 },
    },

    // Week 2 - Growing
    {
        id: 'set_goals',
        week: 2,
        title: 'Check Your Goals',
        description: 'The home screen shows your active goals. Complete them for rewards!',
        icon: Target,
        iconColor: '#8B5CF6',
        priority: 'medium',
        reward: { type: 'money', amount: 100 },
    },
    {
        id: 'buy_phone',
        week: 2,
        title: 'Get a Smartphone',
        description: 'Buy a smartphone from the Market to unlock mobile apps like Banking and Social Media.',
        icon: DollarSign,
        iconColor: '#F59E0B',
        action: 'Buy Smartphone',
        priority: 'medium',
        reward: { type: 'gems', amount: 10 },
    },

    // Week 2 - Daily Challenges
    {
        id: 'daily_challenges',
        week: 2,
        title: 'Daily Challenges',
        description: 'Check the Challenges tab for daily tasks that reward gems! Complete all 3 daily challenges to build a streak multiplier.',
        icon: Sparkles,
        iconColor: '#F59E0B',
        priority: 'medium',
        reward: { type: 'gems', amount: 5 },
    },

    // Week 3 - Career
    {
        id: 'apply_career',
        week: 3,
        title: 'Apply for a Career',
        description: 'Street jobs are quick but careers pay better long-term. Apply for one!',
        icon: Trophy,
        iconColor: '#F59E0B',
        priority: 'medium',
        reward: { type: 'money', amount: 150 },
    },
    {
        id: 'energy_tip',
        week: 3,
        title: 'Energy Tip',
        description: 'Energy regenerates each week. Plan activities that cost energy wisely!',
        icon: Zap,
        iconColor: '#3B82F6',
        priority: 'low',
        reward: { type: 'energy', amount: 15 },
    },
];

interface FirstWeekGuideProps {
    currentWeek: number;
    onDismiss?: () => void;
    visible?: boolean;
}

export function FirstWeekGuide({ currentWeek, onDismiss, visible = true }: FirstWeekGuideProps) {
    const [hasSeenGuide, setHasSeenGuide] = useState<boolean | null>(null);
    const [currentStepIndex, setCurrentStepIndex] = useState(0);
    const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set());
    const fadeAnim = useState(new Animated.Value(0))[0];

    // Check if guide has been seen
    useEffect(() => {
        AsyncStorage.getItem(FIRST_WEEK_GUIDE_KEY).then(value => {
            setHasSeenGuide(value === 'true');
        });
    }, []);

    // Fade in animation
    useEffect(() => {
        if (hasSeenGuide === false && visible) {
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 300,
                useNativeDriver: true,
            }).start();
        }
    }, [hasSeenGuide, visible, fadeAnim]);

    // Get relevant steps for current week
    const relevantSteps = useMemo(() => {
        return GUIDE_STEPS.filter(step => step.week <= Math.min(currentWeek, 3));
    }, [currentWeek]);

    const handleDismiss = async () => {
        // Set local state first to immediately hide the guide (prevents stale UI)
        setHasSeenGuide(true);
        onDismiss?.();
        // Persist to AsyncStorage in background (non-blocking)
        try {
            await AsyncStorage.setItem(FIRST_WEEK_GUIDE_KEY, 'true');
        } catch {
            // Non-critical: guide will re-show on next launch, but won't freeze
        }
    };

    const handleStepComplete = (stepId: string) => {
        setCompletedSteps(prev => new Set([...prev, stepId]));
        if (currentStepIndex < relevantSteps.length - 1) {
            setCurrentStepIndex(currentStepIndex + 1);
        }
    };

    // Don't show if already seen or still loading
    if (hasSeenGuide !== false || !visible || currentWeek > 3) {
        return null;
    }

    const currentStep = relevantSteps[currentStepIndex];
    const Icon = currentStep?.icon || Target;

    return (
        <Animated.View pointerEvents="box-none" style={[styles.container, { opacity: fadeAnim }]}>
            <LinearGradient
                pointerEvents="box-none"
                colors={['#1F2937', '#111827']}
                style={styles.card}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
            >
                {/* Header */}
                <View style={styles.header}>
                    <View style={styles.headerLeft}>
                        <Sparkles size={18} color="#F59E0B" />
                        <Text style={styles.headerTitle}>First Week Guide</Text>
                    </View>
                    <TouchableOpacity
                        style={styles.closeButton}
                        onPress={handleDismiss}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                        <X size={18} color="#9CA3AF" />
                    </TouchableOpacity>
                </View>

                {/* Progress Dots */}
                <View style={styles.progressDots}>
                    {relevantSteps.map((step, idx) => (
                        <View
                            key={step.id}
                            style={[
                                styles.progressDot,
                                idx === currentStepIndex && styles.progressDotActive,
                                completedSteps.has(step.id) && styles.progressDotCompleted,
                            ]}
                        />
                    ))}
                </View>

                {/* Current Step */}
                {currentStep && (
                    <View style={styles.stepContent}>
                        <View style={[styles.iconCircle, { backgroundColor: currentStep.iconColor + '20' }]}>
                            <Icon size={24} color={currentStep.iconColor} />
                        </View>

                        <Text style={styles.stepTitle}>{currentStep.title}</Text>
                        <Text style={styles.stepDescription}>{currentStep.description}</Text>

                        {/* Priority Badge */}
                        {currentStep.priority === 'high' && (
                            <View style={styles.priorityBadge}>
                                <Text style={styles.priorityText}>⚡ Important First Step</Text>
                            </View>
                        )}
                    </View>
                )}

                {/* Navigation */}
                <View style={styles.navigation}>
                    <TouchableOpacity
                        style={styles.skipButton}
                        onPress={handleDismiss}
                    >
                        <Text style={styles.skipButtonText}>Skip Guide</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.nextButton}
                        onPress={() => {
                            if (currentStepIndex < relevantSteps.length - 1) {
                                handleStepComplete(currentStep.id);
                            } else {
                                handleDismiss();
                            }
                        }}
                    >
                        <Text style={styles.nextButtonText}>
                            {currentStepIndex < relevantSteps.length - 1 ? 'Next' : 'Got It!'}
                        </Text>
                        <ChevronRight size={16} color="#FFFFFF" />
                    </TouchableOpacity>
                </View>

                {/* Completion Counter */}
                <Text style={styles.stepCounter}>
                    {currentStepIndex + 1} of {relevantSteps.length} tips
                </Text>
            </LinearGradient>
        </Animated.View>
    );
}

/**
 * Contextual Tip Component
 * Shows a small tip banner when player is "stuck" or stats are low
 */
interface ContextualTipProps {
    type: 'low_health' | 'low_happiness' | 'low_energy' | 'no_job' | 'low_money' | 'promotion_ready';
    onDismiss?: () => void;
}

export function ContextualTip({ type, onDismiss }: ContextualTipProps) {
    const tipContent = useMemo(() => {
        switch (type) {
            case 'low_health':
                return {
                    icon: Heart,
                    color: '#EF4444',
                    message: 'Health is low! Visit the Health tab or buy food to recover.',
                };
            case 'low_happiness':
                return {
                    icon: Sparkles,
                    color: '#F59E0B',
                    message: 'Feeling down? Do activities you enjoy or socialize!',
                };
            case 'low_energy':
                return {
                    icon: Zap,
                    color: '#3B82F6',
                    message: 'Low energy! Rest or eat to recharge. Energy regenerates each week.',
                };
            case 'no_job':
                return {
                    icon: Briefcase,
                    color: '#8B5CF6',
                    message: "You don't have a job! Visit Work tab to find employment.",
                };
            case 'low_money':
                return {
                    icon: DollarSign,
                    color: '#10B981',
                    message: 'Running low on cash? Do some street jobs for quick money.',
                };
            case 'promotion_ready':
                return {
                    icon: Trophy,
                    color: '#F59E0B',
                    message: '🎉 Promotion available! Visit the Work tab to level up.',
                };
            default:
                return null;
        }
    }, [type]);

    if (!tipContent) return null;

    const Icon = tipContent.icon;

    return (
        <View style={[styles.tipContainer, { borderLeftColor: tipContent.color }]}>
            <View style={[styles.tipIcon, { backgroundColor: tipContent.color + '20' }]}>
                <Icon size={14} color={tipContent.color} />
            </View>
            <Text style={styles.tipText}>{tipContent.message}</Text>
            <TouchableOpacity onPress={onDismiss} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <X size={14} color="#6B7280" />
            </TouchableOpacity>
        </View>
    );
}

/**
 * Hook to determine which contextual tip to show based on game state
 */
export function useContextualTip(gameState: any) {
    const [dismissedTips, setDismissedTips] = useState<Set<string>>(new Set());

    // Extract specific values to avoid re-evaluating on every gameState object change
    const health = gameState?.stats?.health ?? 100;
    const happiness = gameState?.stats?.happiness ?? 100;
    const energy = gameState?.stats?.energy ?? 100;
    const money = gameState?.stats?.money ?? 0;
    const currentJob = gameState?.currentJob;
    const weeksLived = gameState?.weeksLived || 0;
    const careers = gameState?.careers;

    const activeTip = useMemo(() => {
        if (!gameState?.stats) return null;

        // Check conditions in priority order
        if (health < 25 && !dismissedTips.has('low_health')) {
            return 'low_health';
        }
        if (happiness < 25 && !dismissedTips.has('low_happiness')) {
            return 'low_happiness';
        }
        if (energy < 15 && !dismissedTips.has('low_energy')) {
            return 'low_energy';
        }
        if (!currentJob && weeksLived > 2 && !dismissedTips.has('no_job')) {
            return 'no_job';
        }
        if (money < 50 && !dismissedTips.has('low_money')) {
            return 'low_money';
        }

        // Check for promotion ready
        const career = careers?.find((c: any) =>
            c.id === currentJob && c.accepted && c.progress >= 100
        );
        if (career && !dismissedTips.has('promotion_ready')) {
            return 'promotion_ready';
        }

        return null;
    }, [health, happiness, energy, money, currentJob, weeksLived, careers, dismissedTips, gameState?.stats]);

    const dismissTip = (tipType: string) => {
        setDismissedTips(prev => new Set([...prev, tipType]));
    };

    // Reset dismissed tips when week changes (allows tips to re-show each week)
    useEffect(() => {
        setDismissedTips(new Set());
    }, [weeksLived]);

    return { activeTip, dismissTip };
}

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        bottom: scale(100),
        left: responsiveSpacing.lg,
        right: responsiveSpacing.lg,
        zIndex: 1000,
    },
    card: {
        borderRadius: responsiveBorderRadius.xl,
        padding: responsiveSpacing.lg,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
        borderWidth: 1,
        borderColor: '#374151',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: responsiveSpacing.md,
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: fontScale(14),
        fontWeight: '700',
        color: '#F9FAFB',
        marginLeft: 8,
    },
    closeButton: {
        padding: 4,
    },
    progressDots: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 6,
        marginBottom: responsiveSpacing.md,
    },
    progressDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#4B5563',
    },
    progressDotActive: {
        backgroundColor: '#F59E0B',
        width: 16,
    },
    progressDotCompleted: {
        backgroundColor: '#10B981',
    },
    stepContent: {
        alignItems: 'center',
        paddingVertical: responsiveSpacing.md,
    },
    iconCircle: {
        width: 56,
        height: 56,
        borderRadius: 28,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: responsiveSpacing.md,
    },
    stepTitle: {
        fontSize: fontScale(18),
        fontWeight: '700',
        color: '#F9FAFB',
        marginBottom: 8,
        textAlign: 'center',
    },
    stepDescription: {
        fontSize: fontScale(14),
        color: '#D1D5DB',
        textAlign: 'center',
        lineHeight: 20,
        paddingHorizontal: responsiveSpacing.sm,
    },
    priorityBadge: {
        backgroundColor: '#F59E0B20',
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 12,
        marginTop: responsiveSpacing.sm,
    },
    priorityText: {
        fontSize: fontScale(11),
        fontWeight: '600',
        color: '#F59E0B',
    },
    navigation: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: responsiveSpacing.md,
        paddingTop: responsiveSpacing.md,
        borderTopWidth: 1,
        borderTopColor: '#374151',
    },
    skipButton: {
        padding: 8,
    },
    skipButtonText: {
        fontSize: fontScale(13),
        color: '#9CA3AF',
    },
    nextButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#3B82F6',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 8,
    },
    nextButtonText: {
        fontSize: fontScale(14),
        fontWeight: '600',
        color: '#FFFFFF',
        marginRight: 4,
    },
    stepCounter: {
        fontSize: fontScale(11),
        color: '#6B7280',
        textAlign: 'center',
        marginTop: responsiveSpacing.sm,
    },
    // Contextual Tip Styles
    tipContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#1F2937',
        borderRadius: 8,
        padding: responsiveSpacing.sm,
        borderLeftWidth: 3,
        marginHorizontal: responsiveSpacing.lg,
        marginBottom: responsiveSpacing.sm,
    },
    tipIcon: {
        width: 28,
        height: 28,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 10,
    },
    tipText: {
        flex: 1,
        fontSize: fontScale(12),
        color: '#D1D5DB',
        lineHeight: 16,
    },
});

export default FirstWeekGuide;
