import { responsiveSpacing as layoutSpace, fontScale, responsiveSpacing, scale } from '@/utils/scaling';
/**
 * ScreenHeader - the one screen-title pattern.
 *
 * Five of nine tab screens shipped with no title at all, one had a plain
 * icon+title row, one had a better icon-bubble+title+subtitle block that was
 * SUPPRESSED in its main presentation, and Home had a bespoke week strip. A
 * player could not reliably tell where they were.
 *
 * This promotes the best of those (Progression's tinted icon bubble, title and
 * subtitle) into a shared primitive. `tint` colours the bubble so each screen
 * keeps an identity inside one consistent shape - the tint is decoration, never
 * the only signal, and the icon is hidden from screen readers because the title
 * beside it already says the same thing.
 *
 * `right` takes an optional trailing control (an info button, a filter).
 */
import React from 'react';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';
import { useTheme } from '@/hooks/useTheme';


interface ScreenHeaderProps {
  title: string;
  subtitle?: string;
  /** Lucide icon element, already sized and coloured by the caller. */
  icon?: React.ReactNode;
  /** Accent behind the icon bubble (e.g. accent.warning). */
  tint?: string;
  right?: React.ReactNode;
  style?: ViewStyle;
}

export default function ScreenHeader({
  title,
  subtitle,
  icon,
  right,
  style,
}: ScreenHeaderProps) {
  const { theme } = useTheme();

  return (
    <View style={[styles.header, style]}>
      {icon ? (
        <View
          style={styles.iconBubble}
          accessibilityElementsHidden
          importantForAccessibility="no"
        >
          {icon}
        </View>
      ) : null}
      <View style={styles.textWrap}>
        <Text
          style={[styles.title, { color: theme.text }]}
          numberOfLines={2}
          maxFontSizeMultiplier={1.5}
          accessibilityRole="header"
        >
          {title}
        </Text>
        {subtitle ? (
          <Text
            style={[styles.subtitle, { color: theme.textSecondary }]}
            numberOfLines={2}
            maxFontSizeMultiplier={1.5}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right ? <View style={styles.right}>{right}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: layoutSpace.compact,
    paddingHorizontal: responsiveSpacing.md,
    paddingTop: responsiveSpacing.md,
    paddingBottom: responsiveSpacing.sm,
  },
  iconBubble: {
    width: scale(24),
    height: scale(32),
    alignItems: 'center',
    justifyContent: 'center',
  },
  textWrap: {
    flex: 1,
  },
  // Tier 2, not tier 1: the screen's name is chrome. At 22/800 it was the
  // largest type on Work, Life and Progress - bigger than the job the player
  // holds or the goal they are on - so the least informative element on the
  // screen won the squint test every time (Program 4).
  title: {
    fontSize: fontScale(20),
    lineHeight: fontScale(24),
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  subtitle: {
    fontSize: fontScale(12),
    marginTop: layoutSpace.xs,
  },
  right: {
    marginLeft: 'auto',
  },
});
