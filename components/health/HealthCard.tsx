import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Gradient from '@/components/ui/Gradient';
import { Check, Heart } from 'lucide-react-native';
import { STAT_IDENTITY } from '@/lib/config/statIdentity';
// Aliased: this component's own prop is called `accent` (vitality / diet).
import { accent as themeAccent } from '@/lib/config/theme';
import BlurViewFallback from '@/components/fallbacks/BlurViewFallback';
import { fontScale, responsiveBorderRadius, responsiveSpacing, scale, verticalScale } from '@/utils/scaling';
// expo-linear-gradient is a TurboModule that has crashed on iOS 26 - use the safe fallback.
const LinearGradient = Gradient;

export type HealthStat = 'health' | 'happiness' | 'energy';

export interface HealthDelta {
  stat: HealthStat;
  /** Positive for gain, negative for cost. */
  delta: number;
}

export type HealthAccent = 'vitality' | 'diet';

interface HealthCardProps {
  title: string;
  description: string;
  /** Formatted price label, e.g. "$25" or "$45 / wk". */
  priceLabel: string;
  /** Stat deltas shown as inline chips. Skip zero-value entries before passing. */
  deltas: HealthDelta[];
  buttonText: string;
  onPress: () => void;
  accent?: HealthAccent;
  locked?: boolean;
  lockReason?: string;
  /** When true, render the active-state highlight (used for the chosen diet plan). */
  active?: boolean;
  /** Transient feedback line shown below the button. */
  feedback?: string;
  /** 'primary' is the one saturated button on the screen (the treatment lead);
   *  everything in a list is 'secondary' - tonal, a tier down. */
  emphasis?: 'primary' | 'secondary';
}

// One action accent for the screen (the info blue every primary action in
// the app uses). 'vitality' used to be the danger red - every "see a doctor"
// button read as "delete", and a free activity's price was painted like a
// failure - and 'diet' used the success green, which then also meant
// "selected". Red is danger, green is a gain; neither is a button.
const ACCENT: Record<HealthAccent, { reward: string; button: [string, string, string]; disabled: [string, string] }> = {
  vitality: {
    reward: '#E2E8F0',
    button: ['#60A5FA', '#3B82F6', '#1D4ED8'],
    disabled: ['#1E293B', '#0F172A'],
  },
  diet: {
    reward: '#E2E8F0',
    button: ['#60A5FA', '#3B82F6', '#1D4ED8'],
    disabled: ['#1E293B', '#0F172A'],
  },
};

// Identity from the one source (red heart, amber face, blue bolt) - these
// chips used to paint health green, the opposite of the HUD above them.
const STAT_META: Record<HealthStat, { Icon: typeof Heart; color: string; label: string }> = {
  health: { Icon: STAT_IDENTITY.health.Icon, color: STAT_IDENTITY.health.color, label: 'Health' },
  happiness: { Icon: STAT_IDENTITY.happiness.Icon, color: STAT_IDENTITY.happiness.color, label: 'Happiness' },
  energy: { Icon: STAT_IDENTITY.energy.Icon, color: STAT_IDENTITY.energy.color, label: 'Energy' },
};

export default function HealthCard({
  title,
  description,
  priceLabel,
  deltas,
  buttonText,
  onPress,
  accent = 'vitality',
  locked = false,
  lockReason,
  active = false,
  feedback,
  emphasis = 'secondary',
}: HealthCardProps) {
  const palette = ACCENT[accent];
  const buttonGradient: [string, string, ...string[]] = locked
    ? [palette.disabled[0], palette.disabled[1]]
    : [palette.button[0], palette.button[1], palette.button[2]];

  // "Alive" entrance for the feedback toast.
  const feedbackAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (feedback) {
      feedbackAnim.setValue(0);
      Animated.sequence([
        Animated.timing(feedbackAnim, {
          toValue: 1,
          duration: 220,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.delay(2200),
        Animated.timing(feedbackAnim, {
          toValue: 0,
          duration: 220,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [feedback, feedbackAnim]);

  return (
    <View
      style={[
        styles.card,
        active && styles.cardActive,
      ]}
    >
      <BlurViewFallback intensity={28} tint="dark" style={StyleSheet.absoluteFill} />

      {active ? (
        <View style={styles.activeStripe}>
          <View style={styles.activeDot} />
          <Text style={styles.activeLabel}>Active</Text>
        </View>
      ) : null}

      <View style={styles.body}>
        <View style={styles.headerRow}>
          <Text style={styles.title} numberOfLines={2}>{title}</Text>
          <Text
            style={[
              styles.price,
              { color: locked ? 'rgba(226, 232, 240, 0.45)' : priceLabel === 'Free' ? themeAccent.success : palette.reward },
            ]}
            numberOfLines={1}
          >
            {priceLabel}
          </Text>
        </View>

        {(locked && lockReason) || description ? (
          <Text style={styles.description} numberOfLines={3}>
            {locked && lockReason ? lockReason : description}
          </Text>
        ) : null}

        {deltas.length > 0 ? (
          <>
            <View style={styles.divider} />
            <View style={styles.statsRow}>
              {deltas.map(({ stat, delta }) => {
                const meta = STAT_META[stat];
                const positive = delta >= 0;
                const sign = positive ? '+' : '−';
                const magnitude = Math.abs(delta);
                return (
                  <View key={stat} style={styles.statCell}>
                    <View style={[styles.statIcon, { backgroundColor: meta.color + '18', borderColor: meta.color + '40' }]}>
                      <meta.Icon size={scale(12)} color={meta.color} />
                    </View>
                    <Text style={[styles.statValue, { color: positive ? '#E2E8F0' : 'rgba(248, 113, 113, 0.95)' }]}>
                      {sign}{magnitude}
                    </Text>
                    <Text style={styles.statLabel}>{meta.label}</Text>
                  </View>
                );
              })}
            </View>
          </>
        ) : null}

        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={buttonText}
          accessibilityState={{ disabled: locked }}
          activeOpacity={0.85}
          disabled={locked}
          onPress={onPress}
          style={styles.buttonWrap}
        >
          {emphasis === 'primary' && !locked && !active ? (
            <LinearGradient
              colors={buttonGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.button}
            >
              <Text style={styles.buttonText}>{buttonText}</Text>
            </LinearGradient>
          ) : (
            <View style={[styles.button, styles.buttonTonal, locked && styles.buttonTonalLocked]}>
              {active ? <Check size={scale(14)} color={palette.button[0]} style={{ marginRight: scale(6) }} /> : null}
              <Text style={[styles.buttonText, styles.buttonTextTonal, locked && styles.buttonTextLocked]}>{buttonText}</Text>
            </View>
          )}
        </TouchableOpacity>

        {feedback ? (
          <Animated.View
            style={[
              styles.feedback,
              {
                opacity: feedbackAnim,
                transform: [{
                  translateY: feedbackAnim.interpolate({ inputRange: [0, 1], outputRange: [verticalScale(6), 0] }),
                }],
              },
            ]}
          >
            <Text style={styles.feedbackText}>{feedback}</Text>
          </Animated.View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: verticalScale(10),
    borderRadius: responsiveBorderRadius.md,
    overflow: 'hidden',
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  cardActive: {
    borderColor: 'rgba(52, 211, 153, 0.45)',
  },
  activeStripe: {
    position: 'absolute',
    top: scale(10),
    right: scale(12),
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(5),
    paddingHorizontal: scale(8),
    paddingVertical: scale(3),
    borderRadius: scale(999),
    backgroundColor: 'rgba(52, 211, 153, 0.12)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(52, 211, 153, 0.4)',
    zIndex: 1,
  },
  activeDot: {
    width: scale(6),
    height: scale(6),
    borderRadius: scale(3),
    backgroundColor: '#34D399',
  },
  activeLabel: {
    fontSize: fontScale(10),
    fontWeight: '700',
    color: '#34D399',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  body: {
    padding: responsiveSpacing.md,
    gap: verticalScale(10),
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: scale(12),
    paddingRight: scale(60), // breathing room for the Active pill
  },
  title: {
    flex: 1,
    fontSize: fontScale(17),
    lineHeight: fontScale(22),
    fontWeight: '700',
    color: '#F8FAFC',
    letterSpacing: -0.2,
  },
  price: {
    fontSize: fontScale(15),
    fontWeight: '700',
    letterSpacing: -0.2,
    fontVariant: ['tabular-nums'],
  },
  description: {
    fontSize: fontScale(13),
    lineHeight: fontScale(18),
    color: 'rgba(226, 232, 240, 0.68)',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    marginVertical: verticalScale(2),
  },
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: scale(14),
    rowGap: verticalScale(8),
  },
  statCell: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(6),
  },
  statIcon: {
    width: scale(22),
    height: scale(22),
    borderRadius: scale(7),
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statValue: {
    fontSize: fontScale(13),
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.2,
  },
  statLabel: {
    fontSize: fontScale(11),
    fontWeight: '500',
    color: 'rgba(226, 232, 240, 0.55)',
  },
  buttonWrap: {
    marginTop: verticalScale(4),
    borderRadius: responsiveBorderRadius.sm,
    overflow: 'hidden',
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: verticalScale(11),
  },
  buttonTonal: {
    backgroundColor: 'rgba(96, 165, 250, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(96, 165, 250, 0.35)',
    borderRadius: responsiveBorderRadius.sm,
  },
  buttonTonalLocked: {
    backgroundColor: 'rgba(148, 163, 184, 0.08)',
    borderColor: 'rgba(148, 163, 184, 0.2)',
  },
  buttonTextTonal: {
    color: '#93C5FD',
    fontWeight: '600',
  },
  buttonText: {
    fontSize: fontScale(14),
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  buttonTextLocked: {
    color: 'rgba(226, 232, 240, 0.5)',
  },
  feedback: {
    alignSelf: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.88)',
    paddingHorizontal: scale(12),
    paddingVertical: verticalScale(6),
    borderRadius: responsiveBorderRadius.full,
    marginTop: verticalScale(2),
  },
  feedbackText: {
    fontSize: fontScale(12),
    fontWeight: '600',
    color: '#F8FAFC',
  },
});
