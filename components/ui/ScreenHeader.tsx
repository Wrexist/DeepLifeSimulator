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
import { fontScale, responsiveSpacing, scale } from '@/utils/scaling';

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

/** Alpha suffixes for the bubble fill and its hairline, as 8-digit hex. */
const FILL_ALPHA = '1F'; // ~12%
const BORDER_ALPHA = '59'; // ~35%

export default function ScreenHeader({
  title,
  subtitle,
  icon,
  tint,
  right,
  style,
}: ScreenHeaderProps) {
  const { theme } = useTheme();

  return (
    <View style={[styles.header, style]}>
      {icon ? (
        <View
          style={[
            styles.iconBubble,
            {
              backgroundColor: tint ? `${tint}${FILL_ALPHA}` : theme.surfaceElevated,
              borderColor: tint ? `${tint}${BORDER_ALPHA}` : theme.border,
            },
          ]}
          accessibilityElementsHidden
          importantForAccessibility="no"
        >
          {icon}
        </View>
      ) : null}
      <View style={styles.textWrap}>
        <Text
          style={[styles.title, { color: theme.text }]}
          numberOfLines={1}
          maxFontSizeMultiplier={1.5}
          accessibilityRole="header"
        >
          {title}
        </Text>
        {subtitle ? (
          <Text
            style={[styles.subtitle, { color: theme.textSecondary }]}
            numberOfLines={1}
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
    gap: scale(12),
    paddingHorizontal: responsiveSpacing.lg,
    paddingTop: responsiveSpacing.md,
    paddingBottom: responsiveSpacing.sm,
  },
  iconBubble: {
    width: scale(38),
    height: scale(38),
    borderRadius: scale(11),
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textWrap: {
    flex: 1,
  },
  title: {
    fontSize: fontScale(22),
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  subtitle: {
    fontSize: fontScale(12.5),
    marginTop: scale(1),
  },
  right: {
    marginLeft: 'auto',
  },
});
