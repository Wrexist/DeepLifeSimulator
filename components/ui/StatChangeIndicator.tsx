/**
 * StatChangeIndicator Component
 * 
 * Shows floating "+5 Health" style animations when stats change.
 * Provides visual feedback to players about stat changes.
 */

import React, { useEffect, useRef, useState } from 'react';
import { Platform, AccessibilityInfo, Animated, Text, StyleSheet, View } from 'react-native';
import { scale, fontScale } from '@/utils/scaling';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { Z_INDEX } from '@/utils/zIndexConstants';

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
    const reduced = useReducedMotion();
    const opacity = useRef(new Animated.Value(0)).current;
    const translateY = useRef(new Animated.Value(0)).current;
    const scaleAnim = useRef(new Animated.Value(0.9)).current;

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
                    friction: 7,
                    tension: 100,
                    useNativeDriver: true,
                }),
            ]),
            // Hold for a moment
            Animated.delay(800),
            // Fade out - and, unless reduced motion is on, float up as it goes.
            // Reduced motion keeps the fade but drops the upward drift.
            Animated.parallel([
                Animated.timing(opacity, {
                    toValue: 0,
                    duration: 400,
                    useNativeDriver: true,
                }),
                ...(reduced
                    ? []
                    : [
                          Animated.timing(translateY, {
                              toValue: -30,
                              duration: 400,
                              useNativeDriver: true,
                          }),
                      ]),
            ]),
        ]).start(() => {
            onComplete(change.id);
        });
    }, [change.id, index, onComplete, opacity, scaleAnim, translateY, reduced]);

    const isPositive = change.amount > 0;
    const colors = STAT_COLORS[change.stat] || STAT_COLORS.health;
    const color = isPositive ? colors.positive : colors.negative;
    const prefix = isPositive ? '+' : '';
    const label = change.stat === 'money' ? '$' : ` ${STAT_LABELS[change.stat]}`;

    const displayText = change.stat === 'money'
        ? `${prefix}${label}${Math.abs(change.amount)}`
        : `${prefix}${change.amount}${label}`;

    // The pills are the game's primary "something happened" channel and render
    // pointerEvents="none", so VoiceOver/TalkBack never reach them - announce
    // each one so screen-reader players get the same confirmation.
    useEffect(() => {
        const spoken = change.stat === 'money'
            ? `${isPositive ? 'Gained' : 'Lost'} $${Math.abs(change.amount)}`
            : `${isPositive ? 'Gained' : 'Lost'} ${Math.abs(change.amount)} ${STAT_LABELS[change.stat]}`;
        try {
            AccessibilityInfo.announceForAccessibility?.(spoken);
        } catch {
            // announcement is best-effort
        }
    }, [change.id, change.stat, change.amount, isPositive]);

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

// NOTE: a second `useStatChangeTracker` used to live here - a dead duplicate
// with the same name as the real one in `@/contexts/StatChangeContext` but
// different semantics (threshold 1, cap 10, manual invocation). It had zero
// callers and existed only to send a future reader to the wrong hook. Deleted.

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        alignItems: 'center',
        zIndex: Z_INDEX.TOAST,
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
        ...Platform.select({
          web: { boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.3)' } as any,
          default: {
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.3,
            shadowRadius: 4,
          },
        }),
        elevation: 5,
    },
    floatingText: {
        color: '#FFFFFF',
        fontSize: fontScale(14),
        fontWeight: '700',
        textAlign: 'center',
        ...Platform.select({
          web: { textShadow: '0px 1px 2px rgba(0,0,0,0.3)' } as any,
          default: {
            textShadowColor: 'rgba(0,0,0,0.3)',
            textShadowOffset: { width: 0, height: 1 },
            textShadowRadius: 2,
          },
        }),
    },
});

export default StatChangeIndicator;
