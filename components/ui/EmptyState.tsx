/**
 * EmptyState - the app-wide empty-state primitive.
 *
 * One shared shape for "there is nothing here": an optional icon, a one-line
 * observation, an optional nudge explaining what the player can do about it,
 * and an optional CTA. The API mirrors the per-brand EmptyState components in
 * the Pulse/Spark/Hustle mini-apps (observation + nudge + children), which
 * keep their own illustrated identities; this version is for every general
 * surface - tab screens, lists, sections - which previously rendered either
 * bare text or nothing at all under a lonely section heading.
 *
 * Copy guidance: observation states the fact in the player's terms
 * ("You don't have a job yet"), nudge points forward ("Apply to a career
 * below to start earning"). Avoid database-speak ("No items").
 */
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { fontScale, responsiveSpacing, responsiveBorderRadius, scale } from '@/utils/scaling';
import { useTheme } from '@/hooks/useTheme';
import { accent } from '@/lib/config/theme';
import { haptic } from '@/utils/haptics';
import { getGlassCard } from '@/utils/glassmorphismStyles';

interface EmptyStateProps {
  /** Lucide icon element (already sized/colored by the caller), optional. */
  icon?: React.ReactNode;
  /** One line stating what's (not) here, in the player's terms. */
  observation: string;
  /** One line pointing forward: why it matters / what to do. */
  nudge?: string;
  /** Built-in CTA button. Rendered only when both label and handler are set. */
  ctaLabel?: string;
  onCtaPress?: () => void;
  /** Or bring your own CTA element instead. */
  children?: React.ReactNode;
  /** Compact variant for inside cards/sections (tighter padding, smaller icon bubble). */
  compact?: boolean;
}

export default function EmptyState({
  icon,
  observation,
  nudge,
  ctaLabel,
  onCtaPress,
  children,
  compact = false,
}: EmptyStateProps) {
  const { theme, isDark } = useTheme();

  return (
    <View style={[styles.container, compact && styles.containerCompact]}>
      {icon ? (
        <View
          style={[
            styles.iconBubble,
            compact && styles.iconBubbleCompact,
            {
              backgroundColor: isDark ? 'rgba(148, 163, 184, 0.08)' : 'rgba(100, 116, 139, 0.08)',
              borderColor: theme.border,
            },
          ]}
          accessibilityElementsHidden
          importantForAccessibility="no"
        >
          {icon}
        </View>
      ) : null}
      <Text style={[styles.observation, { color: theme.text }]}>{observation}</Text>
      {nudge ? <Text style={[styles.nudge, { color: theme.textSecondary }]}>{nudge}</Text> : null}
      {ctaLabel && onCtaPress ? (
        <TouchableOpacity
          style={[styles.cta, { borderColor: accent.info, backgroundColor: 'rgba(59, 130, 246, 0.1)' }]}
          onPress={() => {
            haptic.light();
            onCtaPress();
          }}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel={ctaLabel}
        >
          <Text style={[styles.ctaText, { color: accent.info }]}>{ctaLabel}</Text>
        </TouchableOpacity>
      ) : null}
      {children ? <View style={styles.ctaWrap}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: responsiveSpacing.lg,
    paddingVertical: responsiveSpacing.xl,
  },
  containerCompact: {
    paddingVertical: responsiveSpacing.md,
  },
  iconBubble: {
    width: scale(56),
    height: scale(56),
    borderRadius: responsiveBorderRadius.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: responsiveSpacing.md,
  },
  iconBubbleCompact: {
    width: scale(44),
    height: scale(44),
    marginBottom: responsiveSpacing.sm,
  },
  observation: {
    fontSize: fontScale(16),
    fontWeight: '600',
    textAlign: 'center',
  },
  nudge: {
    fontSize: fontScale(13),
    textAlign: 'center',
    marginTop: responsiveSpacing.xs,
    lineHeight: fontScale(18),
  },
  cta: {
    marginTop: responsiveSpacing.md,
    borderWidth: 1,
    borderRadius: responsiveBorderRadius.md,
    paddingVertical: responsiveSpacing.sm,
    paddingHorizontal: responsiveSpacing.lg,
    minHeight: scale(44),
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: {
    fontSize: fontScale(14),
    fontWeight: '700',
  },
  ctaWrap: {
    marginTop: responsiveSpacing.md,
  },
});

/**
 * EmptyCard - the compact "nothing here yet" card used inside the phone and
 * desktop mini-apps.
 *
 * Seven byte-identical copies of this ten-line component were defined locally
 * in PoliticalApp, RealEstateApp, VehicleApp, BitcoinMiningApp, StocksApp,
 * EducationApp and BankApp. Same glass card, same muted text, same reasoning
 * (an empty section keeps the rhythm of a populated one instead of floating as
 * bare text between elevated rows) - so it lives here once.
 *
 * The prop shape is unchanged from those copies, deliberately: every call site
 * already passes `theme` and `darkMode`, so adopting this is an import swap
 * with no call-site edits and nothing to get wrong.
 */
export function EmptyCard({
  theme,
  darkMode,
  children,
}: {
  theme: { surface: string; border: string; textMuted: string };
  darkMode: boolean;
  children: React.ReactNode;
}) {
  return (
    <View
      style={[
        getGlassCard(darkMode, 6),
        emptyCardStyles.card,
        { backgroundColor: theme.surface, borderColor: theme.border },
      ]}
    >
      <Text style={[emptyCardStyles.text, { color: theme.textMuted }]}>{children}</Text>
    </View>
  );
}

const emptyCardStyles = StyleSheet.create({
  card: {
    padding: responsiveSpacing.lg,
    borderRadius: responsiveBorderRadius.lg,
    borderWidth: 1,
    alignItems: 'center',
  },
  text: {
    fontSize: fontScale(13),
    textAlign: 'center',
    lineHeight: fontScale(18),
  },
});
