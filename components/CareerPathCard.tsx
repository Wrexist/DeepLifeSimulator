/**
 * CareerPathCard Component
 * 
 * Displays an overview of career progression paths with requirements,
 * salaries, and promotion opportunities.
 */

import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import {
    Briefcase,
    ChevronRight,
    ChevronDown,
    Lock,
    TrendingUp,
    GraduationCap,
    Dumbbell,
    Award,
} from 'lucide-react-native';
import { useGame } from '@/contexts/GameContext';
import { GameState, Career, Education, Item } from '@/contexts/game/types';
import { fontScale, responsiveSpacing, responsiveBorderRadius } from '@/utils/scaling';
import LinearGradientFallback from '@/components/fallbacks/LinearGradientFallback';


// Helper to format career ID into display name
const formatCareerName = (id: string): string => {
    return id.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
};

interface CareerPathCardProps {
    onCareerSelect?: (careerId: string) => void;
    compact?: boolean;
}

// Career tier colors and labels
const CAREER_TIERS = {
    entry: { label: 'Entry Level', color: '#6B7280', bgColor: '#6B728020' },
    mid: { label: 'Mid Career', color: '#3B82F6', bgColor: '#3B82F620' },
    senior: { label: 'Senior', color: '#8B5CF6', bgColor: '#8B5CF620' },
    executive: { label: 'Executive', color: '#F59E0B', bgColor: '#F59E0B20' },
};

function getCareerTier(level: number, totalLevels: number): keyof typeof CAREER_TIERS {
    const progress = level / totalLevels;
    if (progress < 0.25) return 'entry';
    if (progress < 0.5) return 'mid';
    if (progress < 0.75) return 'senior';
    return 'executive';
}

function RequirementBadge({
    met,
    label,
    icon: Icon
}: {
    met: boolean;
    label: string;
    icon: React.ComponentType<any>;
}) {
    return (
        <View style={[
            styles.requirementBadge,
            { backgroundColor: met ? '#10B98120' : '#EF444420' }
        ]}>
            <Icon size={12} color={met ? '#10B981' : '#EF4444'} />
            <Text style={[
                styles.requirementText,
                { color: met ? '#10B981' : '#EF4444' }
            ]}>
                {label}
            </Text>
        </View>
    );
}

function CareerItem({
    career,
    isExpanded,
    onToggle,
    onSelect,
    gameState,
}: {
    career: Career;
    isExpanded: boolean;
    onToggle: () => void;
    onSelect?: () => void;
    gameState: GameState;
}) {
    const currentLevel = (career.levels && career.levels[career.level]) || (career.levels && career.levels[0]);
    const nextLevel = career.levels && career.levels[career.level + 1];
    const tier = getCareerTier(career.level, career.levels ? career.levels.length : 1);
    const tierInfo = CAREER_TIERS[tier];

    const isCurrentJob = gameState.currentJob === career.id && career.accepted;
    const canPromote = career.accepted && career.progress >= 100 && nextLevel;

    // Check requirements met
    const requirements = career.requirements || {};
    const meetsEducation = !requirements.education || requirements.education.length === 0 ||
        (gameState.educations || []).some((e: Education) =>
            requirements.education?.includes(e.id) && e.completed
        );
    const meetsFitness = !requirements.fitness ||
        (gameState.stats.fitness || 0) >= requirements.fitness;
    const meetsItem = !requirements.items || requirements.items.length === 0 ||
        requirements.items.every(itemId =>
            (gameState.items || []).some((i: Item) => i.id === itemId && i.owned)
        );

    const meetsAllRequirements = meetsEducation && meetsFitness && meetsItem;
    const careerDisplayName = formatCareerName(career.id);

    return (
        <View style={[
            styles.careerCard,
            isCurrentJob && styles.currentCareerCard,
        ]}>
            {/* Header Row */}
            <TouchableOpacity
                style={styles.careerHeader}
                onPress={onToggle}
                activeOpacity={0.7}
            >
                <View style={styles.careerHeaderLeft}>
                    <View style={[styles.tierBadge, { backgroundColor: tierInfo.bgColor }]}>
                        <Text style={[styles.tierLabel, { color: tierInfo.color }]}>
                            {tierInfo.label}
                        </Text>
                    </View>
                    <Text style={styles.careerName}>{careerDisplayName}</Text>
                    {isCurrentJob && (
                        <View style={styles.currentBadge}>
                            <Text style={styles.currentBadgeText}>Current</Text>
                        </View>
                    )}
                </View>
                <View style={styles.careerHeaderRight}>
                    <Text style={styles.salaryText}>${currentLevel?.salary}/wk</Text>
                    {isExpanded ? (
                        <ChevronDown size={18} color="#9CA3AF" />
                    ) : (
                        <ChevronRight size={18} color="#9CA3AF" />
                    )}
                </View>
            </TouchableOpacity>

            {/* Expanded Content */}
            {isExpanded && (
                <View style={styles.careerDetails}>
                    {/* Progress / Level Info */}
                    <View style={styles.levelInfo}>
                        <Text style={styles.levelLabel}>
                            Level {career.level + 1} of {career.levels?.length || 0}: {currentLevel?.name}
                        </Text>
                        {career.accepted && (
                            <View style={styles.progressContainer}>
                                <View style={styles.progressBar}>
                                    <View
                                        style={[
                                            styles.progressFill,
                                            { width: `${career.progress}%` }
                                        ]}
                                    />
                                </View>
                                <Text style={styles.progressText}>{Math.round(career.progress)}%</Text>
                            </View>
                        )}
                    </View>

                    {/* Requirements */}
                    {career.requirements && !career.accepted && (
                        <View style={styles.requirementsSection}>
                            <Text style={styles.sectionLabel}>Requirements:</Text>
                            <View style={styles.requirementsList}>
                                {requirements.education && requirements.education.length > 0 && (
                                    <RequirementBadge
                                        met={meetsEducation}
                                        label="Education"
                                        icon={GraduationCap}
                                    />
                                )}
                                {requirements.fitness && (
                                    <RequirementBadge
                                        met={meetsFitness}
                                        label={`${requirements.fitness} Fitness`}
                                        icon={Dumbbell}
                                    />
                                )}
                                {requirements.items && (requirements.items.length || 0) > 0 && (
                                    <RequirementBadge
                                        met={meetsItem}
                                        label="Item Required"
                                        icon={Briefcase}
                                    />
                                )}
                            </View>
                        </View>
                    )}

                    {/* Level Progression Tree */}
                    <View style={styles.levelsSection}>
                        <Text style={styles.sectionLabel}>Career Path:</Text>
                        <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            style={styles.levelsList}
                        >
                            {(career.levels || []).map((level, idx) => {
                                const isCompleted = idx < career.level;
                                const isCurrent = idx === career.level;
                                const isLocked = idx > career.level + 1;

                                return (
                                    <View key={idx} style={styles.levelNode}>
                                        <View style={[
                                            styles.levelDot,
                                            isCompleted && styles.levelDotCompleted,
                                            isCurrent && styles.levelDotCurrent,
                                            isLocked && styles.levelDotLocked,
                                        ]}>
                                            {isCompleted ? (
                                                <Award size={12} color="#FFFFFF" />
                                            ) : isLocked ? (
                                                <Lock size={10} color="#6B7280" />
                                            ) : (
                                                <Text style={styles.levelNumber}>{idx + 1}</Text>
                                            )}
                                        </View>
                                        <Text style={[
                                            styles.levelName,
                                            isCurrent && styles.levelNameCurrent,
                                            isLocked && styles.levelNameLocked,
                                        ]} numberOfLines={1}>
                                            {level.name}
                                        </Text>
                                        <Text style={styles.levelSalary}>${level.salary}</Text>
                                        {idx < (career.levels?.length || 0) - 1 && (
                                            <View style={styles.levelConnector} />
                                        )}
                                    </View>
                                );
                            })}
                        </ScrollView>
                    </View>

                    {/* Promotion Available */}
                    {canPromote && (
                        <View style={styles.promotionBanner}>
                            <TrendingUp size={16} color="#10B981" />
                            <Text style={styles.promotionText}>
                                Promotion available to {nextLevel?.name}! (+${nextLevel?.salary - currentLevel?.salary}/wk)
                            </Text>
                        </View>
                    )}

                    {/* Action Button */}
                    {!career.accepted && meetsAllRequirements && (
                        <TouchableOpacity
                            style={styles.applyButton}
                            onPress={onSelect}
                            activeOpacity={0.7}
                        >
                            <Text style={styles.applyButtonText}>Apply for Position</Text>
                        </TouchableOpacity>
                    )}

                    {!career.accepted && !meetsAllRequirements && (
                        <View style={styles.lockedMessage}>
                            <Lock size={14} color="#9CA3AF" />
                            <Text style={styles.lockedText}>Meet requirements to apply</Text>
                        </View>
                    )}
                </View>
            )}
        </View>
    );
}

function CareerPathCard({ onCareerSelect, compact = false }: CareerPathCardProps) {
    const { gameState } = useGame();
    const [expandedCareerId, setExpandedCareerId] = useState<string | null>(
        gameState.currentJob || null
    );

    const careers = useMemo(() => {
        return (gameState.careers || []).filter((c: Career) => c && c.levels && c.levels.length > 0);
    }, [gameState.careers]);

    const currentCareer = useMemo(() => {
        return careers.find((c: Career) => c.id === gameState.currentJob && c.accepted);
    }, [careers, gameState.currentJob]);

    if (compact && currentCareer) {
        const currentLevel = currentCareer.levels && (currentCareer.levels[currentCareer.level] || currentCareer.levels[0]);
        const nextLevel = currentCareer.levels && currentCareer.levels[currentCareer.level + 1];
        const canPromote = currentCareer.progress >= 100 && nextLevel;
        const careerDisplayName = formatCareerName(currentCareer.id);

        return (
            <View style={styles.compactContainer}>
                <View style={styles.compactHeader}>
                    <Briefcase size={18} color="#3B82F6" />
                    <Text style={styles.compactTitle}>{careerDisplayName}</Text>
                    {canPromote && (
                        <View style={styles.promoteBadge}>
                            <TrendingUp size={10} color="#10B981" />
                        </View>
                    )}
                </View>
                <View style={styles.compactDetails}>
                    <Text style={styles.compactLevel}>{currentLevel?.name}</Text>
                    <Text style={styles.compactSalary}>${currentLevel?.salary}/wk</Text>
                </View>
                <View style={styles.compactProgress}>
                    <View style={styles.compactProgressBar}>
                        <View
                            style={[
                                styles.compactProgressFill,
                                { width: `${currentCareer.progress}%` }
                            ]}
                        />
                    </View>
                    <Text style={styles.compactProgressText}>
                        {canPromote ? 'Promotion Ready!' : `${Math.round(currentCareer.progress)}%`}
                    </Text>
                </View>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Briefcase size={20} color="#3B82F6" />
                <Text style={styles.headerTitle}>Career Paths</Text>
                <Text style={styles.headerSubtitle}>
                    {currentCareer ? '1 active' : 'None active'}
                </Text>
            </View>

            <View style={styles.careersList}>
                {careers.slice(0, compact ? 3 : undefined).map((career: Career) => (
                    <CareerItem
                        key={career.id}
                        career={career}
                        isExpanded={expandedCareerId === career.id}
                        onToggle={() => setExpandedCareerId(
                            expandedCareerId === career.id ? null : career.id
                        )}
                        onSelect={() => onCareerSelect?.(career.id)}
                        gameState={gameState}
                    />
                ))}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        margin: responsiveSpacing.lg,
        marginBottom: responsiveSpacing.md,
        backgroundColor: '#1F2937',
        borderRadius: responsiveBorderRadius.xl,
        padding: responsiveSpacing.lg,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        elevation: 2,
    },
    compactContainer: {
        backgroundColor: '#1F2937',
        borderRadius: responsiveBorderRadius.lg,
        padding: responsiveSpacing.md,
        marginVertical: responsiveSpacing.sm,
    },
    compactHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 6,
    },
    compactTitle: {
        fontSize: fontScale(14),
        fontWeight: '600',
        color: '#F9FAFB',
        marginLeft: 8,
        flex: 1,
    },
    promoteBadge: {
        backgroundColor: '#10B98120',
        padding: 4,
        borderRadius: 8,
    },
    compactDetails: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 6,
    },
    compactLevel: {
        fontSize: fontScale(12),
        color: '#9CA3AF',
    },
    compactSalary: {
        fontSize: fontScale(12),
        fontWeight: '600',
        color: '#10B981',
    },
    compactProgress: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    compactProgressBar: {
        flex: 1,
        height: 4,
        backgroundColor: '#374151',
        borderRadius: 2,
        overflow: 'hidden',
    },
    compactProgressFill: {
        height: '100%',
        backgroundColor: '#3B82F6',
        borderRadius: 2,
    },
    compactProgressText: {
        fontSize: fontScale(10),
        color: '#9CA3AF',
        marginLeft: 8,
        minWidth: 50,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: responsiveSpacing.md,
    },
    headerTitle: {
        fontSize: fontScale(16),
        fontWeight: '700',
        color: '#F9FAFB',
        marginLeft: responsiveSpacing.sm,
        flex: 1,
    },
    headerSubtitle: {
        fontSize: fontScale(12),
        color: '#9CA3AF',
    },
    careersList: {
        gap: responsiveSpacing.sm,
    },
    careerCard: {
        backgroundColor: '#374151',
        borderRadius: responsiveBorderRadius.lg,
        overflow: 'hidden',
    },
    currentCareerCard: {
        borderLeftWidth: 4,
        borderLeftColor: '#10B981',
    },
    careerHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: responsiveSpacing.md,
    },
    careerHeaderLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        flexWrap: 'wrap',
        gap: 6,
    },
    careerHeaderRight: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    tierBadge: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 8,
    },
    tierLabel: {
        fontSize: fontScale(10),
        fontWeight: '600',
    },
    careerName: {
        fontSize: fontScale(14),
        fontWeight: '600',
        color: '#F9FAFB',
    },
    currentBadge: {
        backgroundColor: '#10B98130',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 6,
    },
    currentBadgeText: {
        fontSize: fontScale(9),
        fontWeight: '600',
        color: '#10B981',
    },
    salaryText: {
        fontSize: fontScale(13),
        fontWeight: '600',
        color: '#10B981',
        marginRight: 8,
    },
    careerDetails: {
        padding: responsiveSpacing.md,
        paddingTop: 0,
        borderTopWidth: 1,
        borderTopColor: '#4B5563',
    },
    levelInfo: {
        marginTop: responsiveSpacing.sm,
    },
    levelLabel: {
        fontSize: fontScale(12),
        color: '#D1D5DB',
        marginBottom: 6,
    },
    progressContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    progressBar: {
        flex: 1,
        height: 6,
        backgroundColor: '#4B5563',
        borderRadius: 3,
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        backgroundColor: '#3B82F6',
        borderRadius: 3,
    },
    progressText: {
        fontSize: fontScale(11),
        fontWeight: '600',
        color: '#D1D5DB',
        marginLeft: 8,
        minWidth: 36,
    },
    requirementsSection: {
        marginTop: responsiveSpacing.sm,
    },
    sectionLabel: {
        fontSize: fontScale(11),
        fontWeight: '600',
        color: '#9CA3AF',
        marginBottom: 6,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    requirementsList: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
    },
    requirementBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
    },
    requirementText: {
        fontSize: fontScale(10),
        fontWeight: '500',
        marginLeft: 4,
    },
    levelsSection: {
        marginTop: responsiveSpacing.md,
    },
    levelsList: {
        marginTop: 8,
    },
    levelNode: {
        alignItems: 'center',
        marginRight: 24,
        position: 'relative',
    },
    levelDot: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: '#4B5563',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 4,
    },
    levelDotCompleted: {
        backgroundColor: '#10B981',
    },
    levelDotCurrent: {
        backgroundColor: '#3B82F6',
        borderWidth: 2,
        borderColor: '#60A5FA',
    },
    levelDotLocked: {
        backgroundColor: '#374151',
        borderWidth: 1,
        borderColor: '#4B5563',
    },
    levelNumber: {
        fontSize: fontScale(10),
        fontWeight: '700',
        color: '#FFFFFF',
    },
    levelName: {
        fontSize: fontScale(10),
        color: '#D1D5DB',
        textAlign: 'center',
        maxWidth: 70,
    },
    levelNameCurrent: {
        color: '#60A5FA',
        fontWeight: '600',
    },
    levelNameLocked: {
        color: '#6B7280',
    },
    levelSalary: {
        fontSize: fontScale(9),
        color: '#9CA3AF',
        marginTop: 2,
    },
    levelConnector: {
        position: 'absolute',
        left: 28,
        top: 14,
        width: 24,
        height: 2,
        backgroundColor: '#4B5563',
    },
    promotionBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#10B98120',
        padding: responsiveSpacing.sm,
        borderRadius: 8,
        marginTop: responsiveSpacing.md,
    },
    promotionText: {
        fontSize: fontScale(12),
        color: '#10B981',
        fontWeight: '600',
        marginLeft: 8,
        flex: 1,
    },
    applyButton: {
        backgroundColor: '#3B82F6',
        padding: responsiveSpacing.sm,
        borderRadius: 8,
        alignItems: 'center',
        marginTop: responsiveSpacing.md,
    },
    applyButtonText: {
        fontSize: fontScale(13),
        fontWeight: '600',
        color: '#FFFFFF',
    },
    lockedMessage: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: responsiveSpacing.sm,
        marginTop: responsiveSpacing.sm,
    },
    lockedText: {
        fontSize: fontScale(12),
        color: '#9CA3AF',
        marginLeft: 6,
    },
});

const MemoizedCareerPathCard = React.memo(CareerPathCard);
export { MemoizedCareerPathCard as CareerPathCard };
export default MemoizedCareerPathCard;
