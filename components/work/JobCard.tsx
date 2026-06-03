import React from 'react';
import { Animated, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import LinearGradientFallback from '@/components/fallbacks/LinearGradientFallback';
import { Lock } from 'lucide-react-native';
import BlurViewFallback from '@/components/fallbacks/BlurViewFallback';
// expo-linear-gradient is a TurboModule that has crashed on iOS 26 — use the safe fallback.
const LinearGradient = LinearGradientFallback;
import { fontScale, responsiveBorderRadius, responsiveSpacing, scale, verticalScale } from '@/utils/scaling';

export type JobCardAccent = 'street' | 'career' | 'crime';

export interface JobCardMetadata {
  icon: React.ReactNode;
  value: string;
  tone?: 'default' | 'warn' | 'bad';
}

interface JobCardProps {
  title: string;
  description: string;
  reward: string;
  metadata: JobCardMetadata[];
  buttonText: string;
  onPress?: () => void;
  accent: JobCardAccent;
  /** Override only the button color (e.g., red Quit button on a green career card). */
  buttonAccent?: JobCardAccent;
  locked?: boolean;
  lockReason?: string;
  feedback?: string;
  feedbackOpacity?: Animated.Value;
  footer?: React.ReactNode;
}

const ACCENTS: Record<JobCardAccent, { reward: string; button: [string, string, string]; disabled: [string, string] }> = {
  street: {
    reward: '#60A5FA',
    button: ['#3B82F6', '#2563EB', '#1D4ED8'],
    disabled: ['#1F2937', '#111827'],
  },
  career: {
    reward: '#34D399',
    button: ['#10B981', '#059669', '#047857'],
    disabled: ['#1F2937', '#111827'],
  },
  crime: {
    reward: '#F87171',
    button: ['#DC2626', '#B91C1C', '#991B1B'],
    disabled: ['#1F2937', '#111827'],
  },
};

const META_TONE: Record<NonNullable<JobCardMetadata['tone']>, string> = {
  default: 'rgba(226, 232, 240, 0.78)',
  warn: 'rgba(251, 191, 36, 0.92)',
  bad: 'rgba(248, 113, 113, 0.92)',
};

export default function JobCard({
  title,
  description,
  reward,
  metadata,
  buttonText,
  onPress,
  accent,
  buttonAccent,
  locked = false,
  lockReason,
  feedback,
  feedbackOpacity,
  footer,
}: JobCardProps) {
  const palette = ACCENTS[accent];
  const buttonPalette = ACCENTS[buttonAccent ?? accent];
  const buttonGradient: [string, string, ...string[]] = locked
    ? [buttonPalette.disabled[0], buttonPalette.disabled[1]]
    : [buttonPalette.button[0], buttonPalette.button[1], buttonPalette.button[2]];
  const descLine = locked && lockReason ? lockReason : description;

  return (
    <View style={styles.card}>
      <BlurViewFallback intensity={28} tint="dark" style={StyleSheet.absoluteFill} />

      <View style={styles.body}>
        <View style={styles.headerRow}>
          <Text style={styles.title} numberOfLines={2}>
            {title}
          </Text>
          <View style={styles.rewardWrap}>
            {locked ? <Lock size={scale(13)} color="rgba(226, 232, 240, 0.55)" style={styles.lockIcon} /> : null}
            <Text style={[styles.reward, { color: locked ? 'rgba(226, 232, 240, 0.45)' : palette.reward }]} numberOfLines={1}>
              {reward}
            </Text>
          </View>
        </View>

        {descLine ? (
          <Text style={styles.description} numberOfLines={3}>
            {descLine}
          </Text>
        ) : null}

        {metadata.length > 0 ? (
          <>
            <View style={styles.divider} />
            <View style={styles.metaRow}>
              {metadata.map((item, idx) => (
                <View key={idx} style={styles.metaCell}>
                  <View style={styles.metaIcon}>{item.icon}</View>
                  <Text style={[styles.metaText, { color: META_TONE[item.tone ?? 'default'] }]} numberOfLines={1}>
                    {item.value}
                  </Text>
                </View>
              ))}
            </View>
          </>
        ) : null}

        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={buttonText}
          accessibilityState={{ disabled: locked }}
          activeOpacity={0.85}
          disabled={locked || !onPress}
          onPress={onPress}
          style={styles.buttonWrap}
        >
          <LinearGradient
            colors={buttonGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.button}
          >
            <Text style={[styles.buttonText, locked && styles.buttonTextLocked]}>
              {buttonText}
            </Text>
          </LinearGradient>
        </TouchableOpacity>

        {feedback ? (
          <Animated.View style={[styles.feedback, feedbackOpacity ? { opacity: feedbackOpacity } : undefined]}>
            <Text style={styles.feedbackText}>{feedback}</Text>
          </Animated.View>
        ) : null}

        {footer ? <View style={styles.footer}>{footer}</View> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: verticalScale(12),
    borderRadius: responsiveBorderRadius.md,
    overflow: 'hidden',
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.08)',
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
  },
  title: {
    flex: 1,
    fontSize: fontScale(17),
    lineHeight: fontScale(22),
    fontWeight: '700',
    color: '#F8FAFC',
    letterSpacing: -0.2,
  },
  rewardWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(4),
  },
  lockIcon: {
    marginTop: scale(1),
  },
  reward: {
    fontSize: fontScale(16),
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
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: scale(14),
    rowGap: verticalScale(6),
  },
  metaCell: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(5),
  },
  metaIcon: {
    width: scale(14),
    height: scale(14),
    alignItems: 'center',
    justifyContent: 'center',
  },
  metaText: {
    fontSize: fontScale(12),
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  buttonWrap: {
    marginTop: verticalScale(4),
    borderRadius: responsiveBorderRadius.sm,
    overflow: 'hidden',
  },
  button: {
    paddingVertical: verticalScale(11),
    alignItems: 'center',
    justifyContent: 'center',
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
  footer: {
    marginTop: verticalScale(2),
  },
});
