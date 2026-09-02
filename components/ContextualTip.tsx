/**
 * Contextual tips - a small inline banner on Home that fires when the player is
 * genuinely stuck (a vital critically low, broke, or a promotion waiting).
 *
 * Extracted from the retired FirstWeekGuide. The 'no_job' tip that used to live
 * here is gone: FirstSessionCoach already owns the "get a job" teaching moment
 * with live game-state gating, and this banner was the third surface repeating
 * it (the coach, the find-a-job CTA, and this) on one screen.
 */

import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { DollarSign, Heart, Sparkles, Trophy, X, Zap } from 'lucide-react-native';
import { fontScale, responsiveSpacing } from '@/utils/scaling';
import { CRITICAL_VITAL } from '@/lib/config/hierarchy';
import { STAT_IDENTITY } from '@/lib/config/statIdentity';
import { weeksSinceLifeStart } from '@/utils/weekCounters';

export type ContextualTipType =
    | 'low_health'
    | 'low_happiness'
    | 'low_energy'
    | 'low_money'
    | 'promotion_ready';

interface ContextualTipProps {
    type: ContextualTipType;
    onDismiss?: () => void;
}

export function ContextualTip({ type, onDismiss }: ContextualTipProps) {
    const tipContent = useMemo(() => {
        switch (type) {
            case 'low_health':
                return {
                    icon: Heart,
                    color: '#EF4444',
                    message: 'Health is low. A walk in Life → Health is free; food in the Market helps too.',
                    route: '/(tabs)/life?segment=health',
                };
            case 'low_happiness':
                return {
                    icon: Sparkles,
                    color: '#F59E0B',
                    // Was "Feeling down? Do activities you enjoy or socialize!" -
                    // no route, and the one free fix went unnamed while the
                    // character slid toward zero (Program 6 walkthrough).
                    message: 'Happiness is low. Meditation and a walk in Life → Health are free.',
                    route: '/(tabs)/life?segment=health',
                };
            case 'low_energy':
                return {
                    icon: Zap,
                    color: '#3B82F6',
                    message: 'Low energy. Each week restores some; food in Life → Market restores it now.',
                    route: '/(tabs)/life?segment=shop',
                };
            case 'low_money':
                return {
                    icon: DollarSign,
                    color: STAT_IDENTITY.money.color,
                    message: 'Running low on cash? Street jobs in the Work tab pay today.',
                    route: '/(tabs)/work',
                };
            case 'promotion_ready':
                return {
                    icon: Trophy,
                    color: '#F59E0B',
                    message: 'Promotion ready. Collect it in the Work tab.',
                    route: '/(tabs)/work',
                };
            default:
                return null;
        }
    }, [type]);

    const router = useRouter();

    if (!tipContent) return null;

    const Icon = tipContent.icon;
    const route = tipContent.route;

    // The tip is the lead of the Home feed when it fires (the ContextualTip
    // ladder outranks the goals), so it must DO something: tapping the text
    // opens the screen the copy names. The X stays a separate target.
    return (
        <View style={styles.tipContainer}>
            <TouchableOpacity
                style={styles.tipBody}
                onPress={() => router.push(`${route}${route.includes('?') ? '&' : '?'}ts=${Date.now()}` as never)}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel={tipContent.message}
                accessibilityHint="Opens the screen this tip names"
            >
                <View style={[styles.tipIcon, { backgroundColor: tipContent.color + '20' }]}>
                    <Icon size={14} color={tipContent.color} />
                </View>
                <Text style={styles.tipText}>{tipContent.message}</Text>
            </TouchableOpacity>
            <TouchableOpacity
                onPress={onDismiss}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                accessibilityRole="button"
                accessibilityLabel="Dismiss tip"
            >
                <X size={14} color="#64748B" />
            </TouchableOpacity>
        </View>
    );
}

/**
 * How long a dismissed tip stays dismissed, in game weeks.
 *
 * Dismissal used to be wiped on every week change, so a player sitting under $50
 * dismissed "Running low on cash?" and it returned on the very next Next Week -
 * forever. Tapping the X accomplished nothing, which is worse than having no X:
 * it teaches the player that the app ignores them. A tip whose condition is
 * still true is still worth re-raising eventually, so this is a cooldown rather
 * than a permanent mute.
 */
const TIP_REDISPLAY_WEEKS = 12;

export function useContextualTip(gameState: any) {
    // tip id -> the absolute week it was dismissed on.
    const [dismissedTips, setDismissedTips] = useState<Record<string, number>>({});

    // Extract specific values to avoid re-evaluating on every gameState object change
    const health = gameState?.stats?.health ?? 100;
    const happiness = gameState?.stats?.happiness ?? 100;
    const energy = gameState?.stats?.energy ?? 100;
    const money = gameState?.stats?.money ?? 0;
    const currentJob = gameState?.currentJob;
    const weeksLived = gameState?.weeksLived || 0;
    // Weeks into THIS life, for the "has the player had time to do X yet" gates.
    // `weeksLived` is absolute and seeded from the starting age, so an age-25
    // start reads 364 on frame one. The dismissal cooldown deliberately keeps
    // using the ABSOLUTE counter: it is a timestamp delta, not progress.
    // CLAUDE.md §4.2.
    const weeksThisLife = weeksSinceLifeStart(gameState?.weeksLived, gameState?.lifeStartWeek);
    const careers = gameState?.careers;
    // R10-perf: derive the one career-dependent signal as a primitive so the memo
    // below doesn't list the `careers` array (new identity every decay tick) and
    // `gameState.stats` (ditto) in its deps and recompute on every tick.
    const promotionReady = !!careers?.some(
        (c: any) => c.id === currentJob && c.accepted && c.progress >= 100
    );

    const activeTip = useMemo(() => {
        if (!gameState?.stats) return null;

        // A tip is suppressed while it is inside its dismissal cooldown.
        const suppressed = (id: string) => {
            const dismissedAt = dismissedTips[id];
            if (dismissedAt === undefined) return false;
            return weeksLived - dismissedAt < TIP_REDISPLAY_WEEKS;
        };

        // Check conditions in priority order
        // A vital tip fires on the shared CRITICAL band (lib/config/hierarchy),
        // the same line at which the HUD's number turns red and Home's lead
        // slot calls it a crisis - the three used to disagree (25 / 15 / 20).
        if (health <= CRITICAL_VITAL && !suppressed('low_health')) {
            return 'low_health';
        }
        if (happiness <= CRITICAL_VITAL && !suppressed('low_happiness')) {
            return 'low_happiness';
        }
        if (energy <= CRITICAL_VITAL && !suppressed('low_energy')) {
            return 'low_energy';
        }
        if (money < 50 && !suppressed('low_money')) {
            return 'low_money';
        }

        // Check for promotion ready
        if (promotionReady && !suppressed('promotion_ready')) {
            return 'promotion_ready';
        }

        return null;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [health, happiness, energy, money, currentJob, weeksLived, weeksThisLife, promotionReady, dismissedTips]);

    const dismissTip = (tipType: string) => {
        setDismissedTips(prev => ({ ...prev, [tipType]: weeksLived }));
    };

    return { activeTip, dismissTip };
}

const styles = StyleSheet.create({
    tipContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#1E293B',
        borderRadius: 12,
        padding: responsiveSpacing.sm,
        marginBottom: responsiveSpacing.sm,
    },
    tipBody: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        minHeight: 44,
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
        color: '#CBD5E1',
        lineHeight: fontScale(16),
    },
});
