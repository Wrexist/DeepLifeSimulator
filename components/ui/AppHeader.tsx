/**
 * AppHeader - the one top bar for every launcher-hosted app.
 *
 * The launcher renders each of the 19 phone/desktop apps full-screen with a
 * single `onBack` prop and nothing else, so every app had built its own
 * header: 24 hand-rolled copies of the same three slots (back arrow, title,
 * a trailing pill), under two sets of style keys (`topBar/backBtn/appTitle`
 * vs `header/headerBtn/headerTitle`), with the trailing cash chip unlabeled
 * for screen readers in most of them. This is that bar, once.
 *
 * Three slots, no more:
 *   - back: 44pt, labeled, `hitSlop` 8. The title beside it says where you
 *     are, so the arrow carries no text.
 *   - title: swaps to the sub-view's name when the app pushes one (the app
 *     passes the current name; this component holds no routing state).
 *   - right: a `HeaderChip` (cash, week, heat, followers) or any node.
 *
 * Deliberately NOT `ScreenHeader`: that is the tab-screen title block (icon
 * bubble + subtitle, no back), a different job. Nothing is forked - the two
 * share the type ladder and nothing else.
 */
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View, ViewStyle } from 'react-native';
import { ArrowLeft } from 'lucide-react-native';
import { useTheme } from '@/hooks/useTheme';
import { accent, withAlpha } from '@/lib/config/theme';
import { fontScale, responsiveBorderRadius, responsiveSpacing, scale, touchTargets } from '@/utils/scaling';

interface AppHeaderProps {
  title: string;
  onBack: () => void;
  /** Screen-reader label for the back control. Default "Back". */
  backLabel?: string;
  right?: React.ReactNode;
  /** Centre the title (Contacts/Hustle style). Default: leading, next to the arrow. */
  centered?: boolean;
  style?: ViewStyle;
}

export default function AppHeader({ title, onBack, backLabel = 'Back', right, centered = false, style }: AppHeaderProps) {
  const { theme } = useTheme();
  return (
    <View style={[styles.bar, style]}>
      <TouchableOpacity
        onPress={onBack}
        hitSlop={8}
        style={styles.back}
        accessibilityRole="button"
        accessibilityLabel={backLabel}
      >
        <ArrowLeft size={scale(22)} color={theme.text} />
      </TouchableOpacity>
      <Text
        style={[styles.title, { color: theme.text }, centered && styles.titleCentered]}
        numberOfLines={1}
        accessibilityRole="header"
      >
        {title}
      </Text>
      {/* A trailing slot that is always laid out keeps a centred title centred. */}
      <View style={styles.right}>{right ?? (centered ? <View style={styles.back} /> : null)}</View>
    </View>
  );
}

/**
 * HeaderChip - the trailing readout (cash balance, week, heat, followers).
 * Labeled for screen readers: a chip that reads "$12,400" visually must not
 * be silent to VoiceOver, which is what 6 of the hand-rolled copies were.
 * `tint` is a 6-digit accent; default is the neutral surface.
 */
export function HeaderChip({
  label,
  value,
  tint,
  icon,
  onPress,
}: {
  /** What the number is - "Cash", "Week", "Heat". Read to screen readers, not shown. */
  label: string;
  value: string;
  tint?: string;
  icon?: React.ReactNode;
  onPress?: () => void;
}) {
  const { theme } = useTheme();
  const fill = tint ? withAlpha(tint, 0.14) : theme.surfaceElevated;
  const rim = tint ? withAlpha(tint, 0.3) : theme.border;
  const body = (
    <>
      {icon}
      <Text style={[styles.chipText, { color: theme.text }]} numberOfLines={1}>
        {value}
      </Text>
    </>
  );
  if (onPress) {
    return (
      <TouchableOpacity
        onPress={onPress}
        hitSlop={6}
        style={[styles.chip, { backgroundColor: fill, borderColor: rim }]}
        accessibilityRole="button"
        accessibilityLabel={`${label} ${value}`}
      >
        {body}
      </TouchableOpacity>
    );
  }
  return (
    <View
      style={[styles.chip, { backgroundColor: fill, borderColor: rim }]}
      accessible
      accessibilityRole="text"
      accessibilityLabel={`${label} ${value}`}
    >
      {body}
    </View>
  );
}

/** The default cash readout; `accent.success` green unless the app has an identity tint. */
export function CashChip({ value, tint = accent.success, onPress }: { value: string; tint?: string; onPress?: () => void }) {
  return <HeaderChip label="Cash" value={value} tint={tint} onPress={onPress} />;
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: responsiveSpacing.sm,
    paddingVertical: responsiveSpacing.sm,
    gap: responsiveSpacing.xs,
  },
  back: {
    width: touchTargets.minimum,
    height: touchTargets.minimum,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flex: 1,
    fontSize: fontScale(18),
    fontWeight: '600',
    letterSpacing: 0.1,
  },
  titleCentered: {
    textAlign: 'center',
  },
  right: {
    minWidth: touchTargets.minimum,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(4),
    paddingHorizontal: scale(10),
    paddingVertical: scale(6),
    borderRadius: responsiveBorderRadius.full,
    borderWidth: 1,
    minHeight: scale(32),
  },
  chipText: {
    fontSize: fontScale(13),
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
});
