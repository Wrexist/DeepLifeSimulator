/**
 * StatTooltip Component
 * 
 * Shows information about what each stat does when tapped.
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Pressable } from 'react-native';
import { Heart, Smile, Zap, DollarSign, Gem, Dumbbell, X, Info } from 'lucide-react-native';
import { scale, fontScale, responsiveSpacing, responsiveBorderRadius } from '@/utils/scaling';
import LinearGradientFallback from '@/components/fallbacks/LinearGradientFallback';

const LinearGradient = LinearGradientFallback;

export interface StatInfo {
    name: string;
    icon: React.ComponentType<any>;
    color: string;
    description: string;
    effects: string[];
    tips: string[];
    warning?: string;
}

export const STAT_INFO: Record<string, StatInfo> = {
    health: {
        name: 'Health',
        icon: Heart,
        color: '#EF4444',
        description: 'Your physical well-being. Keep it high to avoid diseases and death.',
        effects: [
            'Below 30: Risk of getting sick',
            'Below 20: Reduced work efficiency',
            'At 0: You have 4 weeks to recover or die',
        ],
        tips: [
            'Visit a doctor or hospital for healing',
            'Eat healthy food regularly',
            'Exercise to maintain fitness',
        ],
        warning: 'If health stays at 0 for 4 weeks, your character dies!',
    },
    happiness: {
        name: 'Happiness',
        icon: Smile,
        color: '#F59E0B',
        description: 'Your mental well-being and life satisfaction.',
        effects: [
            'High happiness: Better work performance',
            'Low happiness: Reduced income and motivation',
            'At 0: Risk of depression and death',
        ],
        tips: [
            'Spend time with friends and family',
            'Do hobbies and activities you enjoy',
            'Live in a nice home',
        ],
        warning: 'If happiness stays at 0 for 4 weeks, your character dies!',
    },
    energy: {
        name: 'Energy',
        icon: Zap,
        color: '#3B82F6',
        description: 'Your ability to perform activities. Regenerates each week.',
        effects: [
            'Activities cost energy',
            'Low energy: Cannot do some activities',
            'Regenerates 30+ energy per week',
        ],
        tips: [
            'Sleep and rest to recover faster',
            'Eat food for instant energy',
            'A good diet plan gives weekly energy',
        ],
    },
    money: {
        name: 'Cash',
        icon: DollarSign,
        color: '#10B981',
        description: 'Your liquid cash for immediate spending.',
        effects: [
            'Used for buying items and food',
            'Pays for activities and education',
            'Can be deposited in bank for interest',
        ],
        tips: [
            'Work jobs to earn money',
            'Invest in stocks or crypto',
            'Start a business for passive income',
        ],
    },
    gems: {
        name: 'Gems',
        icon: Gem,
        color: '#8B5CF6',
        description: 'Premium currency earned through achievements.',
        effects: [
            'Used in the Gem Shop for special items',
            'Cannot be bought with regular money',
            'Earned by completing goals and achievements',
        ],
        tips: [
            'Complete achievements to earn gems',
            'Check daily challenges for gem rewards',
            'Save gems for powerful prestige items',
        ],
    },
    fitness: {
        name: 'Fitness',
        icon: Dumbbell,
        color: '#06B6D4',
        description: 'Your physical fitness level from exercise.',
        effects: [
            'Higher fitness: Better health maintenance',
            'Some careers require high fitness',
            'Reduces disease risk',
        ],
        tips: [
            'Go to the gym regularly',
            'Exercise at home',
            'Stay active to maintain fitness',
        ],
    },
};

interface StatTooltipProps {
    stat: keyof typeof STAT_INFO;
    visible: boolean;
    onClose: () => void;
    currentValue?: number;
    darkMode?: boolean;
}

export function StatTooltip({ stat, visible, onClose, currentValue, darkMode = true }: StatTooltipProps) {
    const info = STAT_INFO[stat];

    if (!info || !visible) return null;

    const Icon = info.icon;
    const isLow = currentValue !== undefined && currentValue < 30;
    const isCritical = currentValue !== undefined && currentValue < 10;

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={onClose}
        >
            <Pressable style={styles.overlay} onPress={onClose}>
                <View style={styles.tooltipContainer}>
                    <LinearGradient
                        colors={darkMode ? ['#1F2937', '#111827'] : ['#FFFFFF', '#F9FAFB']}
                        style={styles.tooltip}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                    >
                        {/* Header */}
                        <View style={styles.header}>
                            <View style={[styles.iconCircle, { backgroundColor: info.color + '20' }]}>
                                <Icon size={24} color={info.color} />
                            </View>
                            <View style={styles.headerText}>
                                <Text style={[styles.statName, !darkMode && styles.statNameLight]}>
                                    {info.name}
                                </Text>
                                {currentValue !== undefined && (
                                    <Text style={[
                                        styles.currentValue,
                                        isCritical && styles.criticalValue,
                                        isLow && !isCritical && styles.lowValue,
                                    ]}>
                                        Current: {Math.round(currentValue)}%
                                    </Text>
                                )}
                            </View>
                            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                                <X size={18} color={darkMode ? '#9CA3AF' : '#6B7280'} />
                            </TouchableOpacity>
                        </View>

                        {/* Description */}
                        <Text style={[styles.description, !darkMode && styles.descriptionLight]}>
                            {info.description}
                        </Text>

                        {/* Warning for low stats */}
                        {info.warning && (isLow || stat === 'health' || stat === 'happiness') && (
                            <View style={styles.warningBox}>
                                <Text style={styles.warningText}>⚠️ {info.warning}</Text>
                            </View>
                        )}

                        {/* Effects */}
                        <View style={styles.section}>
                            <Text style={[styles.sectionTitle, !darkMode && styles.sectionTitleLight]}>
                                Effects
                            </Text>
                            {info.effects.map((effect, idx) => (
                                <View key={idx} style={styles.listItem}>
                                    <View style={[styles.listBullet, { backgroundColor: info.color }]} />
                                    <Text style={[styles.listText, !darkMode && styles.listTextLight]}>
                                        {effect}
                                    </Text>
                                </View>
                            ))}
                        </View>

                        {/* Tips */}
                        <View style={styles.section}>
                            <Text style={[styles.sectionTitle, !darkMode && styles.sectionTitleLight]}>
                                Tips to Improve
                            </Text>
                            {info.tips.map((tip, idx) => (
                                <View key={idx} style={styles.listItem}>
                                    <Text style={styles.tipBullet}>💡</Text>
                                    <Text style={[styles.listText, !darkMode && styles.listTextLight]}>
                                        {tip}
                                    </Text>
                                </View>
                            ))}
                        </View>

                        {/* Close Button */}
                        <TouchableOpacity style={styles.gotItButton} onPress={onClose}>
                            <Text style={styles.gotItButtonText}>Got It!</Text>
                        </TouchableOpacity>
                    </LinearGradient>
                </View>
            </Pressable>
        </Modal>
    );
}

/**
 * Info icon button that triggers tooltip
 */
interface StatInfoButtonProps {
    stat: keyof typeof STAT_INFO;
    size?: number;
    darkMode?: boolean;
    currentValue?: number;
}

export function StatInfoButton({ stat, size = 14, darkMode = true, currentValue }: StatInfoButtonProps) {
    const [showTooltip, setShowTooltip] = useState(false);

    return (
        <>
            <TouchableOpacity
                onPress={() => setShowTooltip(true)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                accessibilityLabel={`Info about ${STAT_INFO[stat]?.name || stat}`}
                accessibilityRole="button"
            >
                <Info size={size} color={darkMode ? '#6B7280' : '#9CA3AF'} />
            </TouchableOpacity>

            <StatTooltip
                stat={stat}
                visible={showTooltip}
                onClose={() => setShowTooltip(false)}
                currentValue={currentValue}
                darkMode={darkMode}
            />
        </>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: responsiveSpacing.xl,
    },
    tooltipContainer: {
        width: '100%',
        maxWidth: 360,
    },
    tooltip: {
        borderRadius: responsiveBorderRadius.xl,
        padding: responsiveSpacing.lg,
        borderWidth: 1,
        borderColor: '#374151',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: responsiveSpacing.md,
    },
    iconCircle: {
        width: 48,
        height: 48,
        borderRadius: 24,
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerText: {
        flex: 1,
        marginLeft: 12,
    },
    statName: {
        fontSize: fontScale(18),
        fontWeight: '700',
        color: '#F9FAFB',
    },
    statNameLight: {
        color: '#111827',
    },
    currentValue: {
        fontSize: fontScale(13),
        color: '#10B981',
        fontWeight: '600',
        marginTop: 2,
    },
    lowValue: {
        color: '#F59E0B',
    },
    criticalValue: {
        color: '#EF4444',
    },
    closeButton: {
        padding: 4,
    },
    description: {
        fontSize: fontScale(14),
        color: '#D1D5DB',
        lineHeight: 20,
        marginBottom: responsiveSpacing.md,
    },
    descriptionLight: {
        color: '#4B5563',
    },
    warningBox: {
        backgroundColor: '#EF444420',
        borderRadius: 8,
        padding: responsiveSpacing.sm,
        marginBottom: responsiveSpacing.md,
        borderLeftWidth: 3,
        borderLeftColor: '#EF4444',
    },
    warningText: {
        fontSize: fontScale(12),
        color: '#EF4444',
        fontWeight: '500',
    },
    section: {
        marginBottom: responsiveSpacing.md,
    },
    sectionTitle: {
        fontSize: fontScale(12),
        fontWeight: '700',
        color: '#9CA3AF',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: 8,
    },
    sectionTitleLight: {
        color: '#6B7280',
    },
    listItem: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginBottom: 6,
    },
    listBullet: {
        width: 6,
        height: 6,
        borderRadius: 3,
        marginTop: 6,
        marginRight: 10,
    },
    tipBullet: {
        fontSize: 12,
        marginRight: 8,
    },
    listText: {
        flex: 1,
        fontSize: fontScale(13),
        color: '#D1D5DB',
        lineHeight: 18,
    },
    listTextLight: {
        color: '#4B5563',
    },
    gotItButton: {
        backgroundColor: '#3B82F6',
        borderRadius: 8,
        paddingVertical: 12,
        alignItems: 'center',
        marginTop: responsiveSpacing.sm,
    },
    gotItButtonText: {
        fontSize: fontScale(14),
        fontWeight: '600',
        color: '#FFFFFF',
    },
});

export default StatTooltip;
