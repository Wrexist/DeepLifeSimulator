/**
 * StatChangeIndicator Component
 * 
 * Shows floating "+5 Health" style animations when stats change.
 * Provides visual feedback to players about stat changes.
 */

import React, { useEffect, useRef, useState } from 'react';
import { Animated, Text, StyleSheet, View } from 'react-native';
import { scale, fontScale } from '@/utils/scaling';

export interface StatChange {
    id: string;
    stat: 'health' | 'happiness' | 'energy' | 'money' | 'gems' | 'fitness';
    amount: number;
    timestamp: number;
}

interface StatChangeIndicatorProps {
    changes: StatChange[];
    onAnimationComplete?: (id: string) => void;
}

const STAT_COLORS: Record<string, { positive: string; negative: string }> = {
    health: { positive: '#10B981', negative: '#EF4444' },
    happiness: { positive: '#F59E0B', negative: '#EF4444' },
    energy: { positive: '#3B82F6', negative: '#EF4444' },
    money: { positive: '#10B981', negative: '#EF4444' },
    gems: { positive: '#8B5CF6', negative: '#EF4444' },
    fitness: { positive: '#06B6D4', negative: '#EF4444' },
};

const STAT_LABELS: Record<string, string> = {
    health: 'Health',
    happiness: 'Happiness',
    energy: 'Energy',
    money: '$',
    gems: 'Gems',
    fitness: 'Fitness',
};

interface FloatingTextProps {
    change: StatChange;
    index: number;
    onComplete: (id: string) => void;
}

function FloatingText({ change, index, onComplete }: FloatingTextProps) {
    const opacity = useRef(new Animated.Value(0)).current;
    const translateY = useRef(new Animated.Value(0)).current;
    const scaleAnim = useRef(new Animated.Value(0.5)).current;

    useEffect(() => {
        // Stagger animations based on index
        const delay = index * 150;

        Animated.sequence([
            Animated.delay(delay),
            Animated.parallel([
                // Fade in
                Animated.timing(opacity, {
                    toValue: 1,
                    duration: 200,
                    useNativeDriver: true,
                }),
                // Pop in effect
                Animated.spring(scaleAnim, {
                    toValue: 1,
                    friction: 4,
                    tension: 100,
                    useNativeDriver: true,
                }),
            ]),
            // Hold for a moment
            Animated.delay(800),
            // Float up and fade out
            Animated.parallel([
                Animated.timing(opacity, {
                    toValue: 0,
                    duration: 400,
                    useNativeDriver: true,
                }),
                Animated.timing(translateY, {
                    toValue: -30,
                    duration: 400,
                    useNativeDriver: true,
                }),
            ]),
        ]).start(() => {
            onComplete(change.id);
        });
    }, [change.id, index, onComplete, opacity, scaleAnim, translateY]);

    const isPositive = change.amount > 0;
    const colors = STAT_COLORS[change.stat] || STAT_COLORS.health;
    const color = isPositive ? colors.positive : colors.negative;
    const prefix = isPositive ? '+' : '';
    const label = change.stat === 'money' ? '$' : ` ${STAT_LABELS[change.stat]}`;

    const displayText = change.stat === 'money'
        ? `${prefix}${label}${Math.abs(change.amount)}`
        : `${prefix}${change.amount}${label}`;

    return (
        <Animated.View
            style={[
                styles.floatingContainer,
                {
                    opacity,
                    transform: [
                        { translateY },
                        { scale: scaleAnim },
                    ],
                    top: index * 28,
                },
            ]}
        >
            <View style={[styles.pill, { backgroundColor: color }]}>
                <Text style={styles.floatingText}>{displayText}</Text>
            </View>
        </Animated.View>
    );
}

export function StatChangeIndicator({ changes, onAnimationComplete }: StatChangeIndicatorProps) {
    const [visibleChanges, setVisibleChanges] = useState<StatChange[]>([]);

    useEffect(() => {
        // Add new changes to visible list
        const newChanges = changes.filter(
            c => !visibleChanges.find(v => v.id === c.id)
        );

        if (newChanges.length > 0) {
            setVisibleChanges(prev => [...prev, ...newChanges].slice(-5)); // Keep max 5
        }
    }, [changes, visibleChanges]);

    const handleComplete = (id: string) => {
        setVisibleChanges(prev => prev.filter(c => c.id !== id));
        onAnimationComplete?.(id);
    };

    if (visibleChanges.length === 0) return null;

    return (
        <View style={styles.container} pointerEvents="none">
            {visibleChanges.map((change, index) => (
                <FloatingText
                    key={change.id}
                    change={change}
                    index={index}
                    onComplete={handleComplete}
                />
            ))}
        </View>
    );
}

/**
 * Hook to track stat changes and generate animations
 */
export function useStatChangeTracker() {
    const [changes, setChanges] = useState<StatChange[]>([]);
    const prevStats = useRef<Record<string, number>>({});

    const trackStatChange = (
        currentStats: Record<string, number>,
        statsToTrack: string[] = ['health', 'happiness', 'energy', 'money', 'gems', 'fitness']
    ) => {
        const newChanges: StatChange[] = [];

        for (const stat of statsToTrack) {
            const current = currentStats[stat];
            const prev = prevStats.current[stat];

            if (prev !== undefined && current !== prev) {
                const diff = current - prev;
                // Only show significant changes (ignore rounding errors)
                if (Math.abs(diff) >= 1) {
                    newChanges.push({
                        id: `${stat}-${Date.now()}-${Math.random()}`,
                        stat: stat as StatChange['stat'],
                        amount: Math.round(diff),
                        timestamp: Date.now(),
                    });
                }
            }
            prevStats.current[stat] = current;
        }

        if (newChanges.length > 0) {
            setChanges(prev => [...prev, ...newChanges].slice(-10));
        }
    };

    const clearChange = (id: string) => {
        setChanges(prev => prev.filter(c => c.id !== id));
    };

    const clearAllChanges = () => {
        setChanges([]);
    };

    return {
        changes,
        trackStatChange,
        clearChange,
        clearAllChanges,
    };
}

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        alignItems: 'center',
        zIndex: 1000,
        pointerEvents: 'none',
    },
    floatingContainer: {
        position: 'absolute',
        alignSelf: 'center',
    },
    pill: {
        paddingHorizontal: scale(12),
        paddingVertical: scale(4),
        borderRadius: scale(12),
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        elevation: 5,
    },
    floatingText: {
        color: '#FFFFFF',
        fontSize: fontScale(14),
        fontWeight: '700',
        textAlign: 'center',
        textShadowColor: 'rgba(0,0,0,0.3)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 2,
    },
});

export default StatChangeIndicator;
