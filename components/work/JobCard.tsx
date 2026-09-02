import React, { useState } from 'react';
import { Animated, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Lock } from 'lucide-react-native';
import BlurViewFallback from '@/components/fallbacks/BlurViewFallback';
import GradientButton from '@/components/ui/GradientButton';
import { hitSlopToMinTarget } from '@/utils/touchTargets';
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
  /** One saturated button per board: the lead card is 'primary', the rest tonal. */
  emphasis?: 'primary' | 'secondary';
}

/**
 * The 2026-09-01 UI audit counted up to 9 chips per card (~70-110 numbers per
 * scroll of the Work tab). Three is the cap; the rest sit behind a per-card
 * "+N more" toggle so nothing is deleted, just deferred. Callers order the
 * array by decision relevance (failing requirements first).
 */
const MAX_VISIBLE_CHIPS = 3;

const ACCENTS: Record<JobCardAccent, { reward: string; button: [string, string, string]; glow: string }> = {
  street: {
    reward: '#60A5FA',
    button: ['#60A5FA', '#3B82F6', '#1D4ED8'], // light top → deep bottom for depth
    glow: '#3B82F6',
  },
  career: {
    reward: '#34D399',
    button: ['#34D399', '#10B981', '#047857'],
    glow: '#10B981',
  },
  crime: {
    reward: '#F87171',
    button: ['#F87171', '#DC2626', '#991B1B'],
    glow: '#DC2626',
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
  emphasis = 'primary',
}: JobCardProps) {
  const palette = ACCENTS[accent];
  const buttonPalette = ACCENTS[buttonAccent ?? accent];
  const descLine = locked && lockReason ? lockReason : description;

  const [expanded, setExpanded] = useState(false);
  const hiddenCount = metadata.length - MAX_VISIBLE_CHIPS;
  const visibleMetadata = expanded || hiddenCount <= 0 ? metadata : metadata.slice(0, MAX_VISIBLE_CHIPS);

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
              {visibleMetadata.map((item, idx) => (
                <View key={idx} style={styles.metaCell}>
                  <View style={styles.metaIcon}>{item.icon}</View>
                  <Text style={[styles.metaText, { color: META_TONE[item.tone ?? 'default'] }]} numberOfLines={1}>
                    {item.value}
                  </Text>
                </View>
              ))}
              {hiddenCount > 0 ? (
                <TouchableOpacity
                  onPress={() => setExpanded((v) => !v)}
                  hitSlop={hitSlopToMinTarget(scale(20))}
                  accessibilityRole="button"
                  accessibilityLabel={expanded ? 'Show fewer details' : `Show ${hiddenCount} more details`}
                >
                  <Text style={styles.moreToggle}>{expanded ? 'Less' : `+${hiddenCount} more`}</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </>
        ) : null}

        <GradientButton
          label={buttonText}
          onPress={onPress}
          disabled={locked || !onPress}
          colors={buttonPalette.button}
          glow={buttonPalette.glow}
          style={styles.buttonSpacing}
          emphasis={emphasis}
        />

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
    alignItems: 'center',
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
  moreToggle: {
    fontSize: fontScale(12),
    fontWeight: '600',
    color: 'rgba(148, 197, 255, 0.9)',
  },
  buttonSpacing: {
    marginTop: verticalScale(4),
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
