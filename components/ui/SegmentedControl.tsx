/**
 * SegmentedControl - the one shared tab/segment control for the app's in-screen
 * tab bars (Market, Work, Computer). Dark-glass container, tinted active
 * segment, muted inactive text. Replaces three near-identical hand-rolled bars.
 *
 * Each segment may carry an optional `icon` (leading) and an optional
 * `accessory` (a sibling rendered next to the touchable, outside the tap target
 * so it doesn't switch tabs). No caller uses `accessory` today: Market did, with
 * a per-tab InfoButton, and four "?" badges in a four-segment row both competed
 * with the labels and squeezed them to truncation. Market now renders ONE info
 * button beside the whole control. Prefer that shape; per-segment accessories
 * only pay off when the segments genuinely differ in what they offer.
 */
import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View, ViewStyle } from 'react-native';
import { Lock } from 'lucide-react-native';
import { accent } from '@/lib/config/theme';
import { fontScale, scale, responsiveBorderRadius, responsiveSpacing } from '@/utils/scaling';

export interface Segment<T extends string> {
  key: T;
  label: string;
  icon?: React.ComponentType<{ size?: number; color?: string }>;
  /** Rendered beside the touchable (outside the tap target), e.g. an InfoButton. */
  accessory?: React.ReactNode;
  /**
   * Progressive disclosure: render dimmed with a padlock and route taps to
   * `onLockedPress` instead of `onChange`. Optional and default-off, so every
   * existing caller is unaffected.
   *
   * Locked, not hidden - the segment stays in place so the control does not
   * reflow as things unlock and the player can see what is coming.
   */
  locked?: boolean;
  /** Shown when a locked segment is tapped. A dead tap reads as a bug. */
  lockReason?: string;
}

interface SegmentedControlProps<T extends string> {
  segments: Segment<T>[];
  value: T;
  onChange: (key: T) => void;
  /**
   * Tapping a `locked` segment. Without this a locked tap does nothing at all,
   * which is exactly the dead tap the padlock exists to avoid.
   */
  onLockedPress?: (key: T, reason: string) => void;
  /** Active tint + icon color. Default: theme info blue. */
  activeColor?: string;
  style?: ViewStyle;
  /**
   * Subordinate variant - flatter background, shorter tabs, smaller text. Use
   * when this control is nested UNDER a primary segmented control (e.g. Market's
   * Items/Food/Gym inside the Life tab's Health/Shop/Stats) so the two levels
   * read as a hierarchy instead of two identical stacked bars.
   */
  compact?: boolean;
  /**
   * Horizontal-scroll variant for apps with more than four segments (a
   * five-tab bank, a six-tab shop). Segments keep their natural width instead
   * of sharing the row, so labels never truncate at 360pt. Prefer fewer tabs;
   * reach for this only when the count is fixed by the domain.
   */
  scrollable?: boolean;
}

const MUTED = 'rgba(226, 232, 240, 0.45)';
const ACTIVE_TEXT = '#F8FAFC';

export default function SegmentedControl<T extends string>({
  segments,
  value,
  onChange,
  onLockedPress,
  activeColor = accent.info,
  style,
  compact = false,
  scrollable = false,
}: SegmentedControlProps<T>) {
  const body = segments.map((seg) => {
        // A locked segment can never also be the active one in practice - the
        // unlock tier only ever rises - but if it somehow were, "locked" wins
        // so the player is never left tapping an inert highlighted tab.
        const locked = seg.locked === true;
        const active = !locked && seg.key === value;
        const Icon = locked ? Lock : seg.icon;
        return (
          <View key={seg.key} style={[styles.slot, scrollable && styles.slotScroll]}>
            <TouchableOpacity
              style={[
                styles.tab,
                compact && styles.tabCompact,
                scrollable && styles.tabScroll,
                active && { backgroundColor: activeColor + '2E' },
                locked && styles.tabLocked,
              ]}
              onPress={() => (locked ? onLockedPress?.(seg.key, seg.lockReason || '') : onChange(seg.key))}
              activeOpacity={0.85}
              accessibilityRole="tab"
              // `disabled` is added only when locked rather than always passed
              // as a boolean, so an unlocked segment's props stay byte-identical
              // to what the three pre-existing callers already rendered.
              accessibilityState={locked ? { selected: active, disabled: true } : { selected: active }}
              accessibilityLabel={locked ? `${seg.label}, locked. ${seg.lockReason || ''}`.trim() : seg.label}
            >
              {Icon ? <Icon size={compact ? scale(14) : scale(16)} color={active ? activeColor : MUTED} /> : null}
              <Text style={[styles.text, compact && styles.textCompact, { color: active ? ACTIVE_TEXT : MUTED }]} numberOfLines={1}>
                {seg.label}
              </Text>
            </TouchableOpacity>
            {seg.accessory}
          </View>
        );
      });
  if (scrollable) {
    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        // `styles.scrollSelf` LAST-but-one so a caller's `style` can still win.
        //
        // React Native's ScrollView carries `flexGrow: 1, flexShrink: 1` in its
        // own base style. As a direct child of a screen's flex column that makes
        // a HORIZONTAL tab bar claim a share of the leftover vertical space and
        // inflate to hundreds of points tall - Bank Pro rendered its five tabs
        // floating in the middle of an empty box half the viewport high
        // (screenshot report, 2026-09-04). The non-scrollable branch is a plain
        // View and was never affected, which is why only the two `scrollable`
        // callers (Bank Pro, LuxuryApp) showed it.
        style={[styles.container, compact && styles.containerCompact, styles.scrollSelf, style]}
        contentContainerStyle={styles.scrollContent}
        accessibilityRole="tablist"
      >
        {body}
      </ScrollView>
    );
  }
  return (
    <View style={[styles.container, compact && styles.containerCompact, style]} accessibilityRole="tablist">
      {body}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    borderRadius: responsiveBorderRadius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    padding: scale(4),
    gap: scale(4),
  },
  // Subordinate (nested) look: flatter fill, tighter padding, no rim.
  containerCompact: {
    backgroundColor: 'rgba(15, 23, 42, 0.32)',
    borderColor: 'transparent',
    padding: scale(3),
    gap: scale(3),
  },
  /**
   * Hold the horizontal control to its content height. See the note at the
   * `scrollable` branch: without this the ScrollView's inherited `flexGrow: 1`
   * lets a tab bar swallow half a screen.
   */
  scrollSelf: {
    flexGrow: 0,
    flexShrink: 0,
  },
  scrollContent: {
    flexDirection: 'row',
    gap: scale(4),
    paddingRight: scale(4),
  },
  slotScroll: {
    flex: 0,
  },
  tabScroll: {
    paddingHorizontal: scale(12),
  },
  slot: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: scale(6),
    paddingVertical: responsiveSpacing.sm,
    borderRadius: responsiveBorderRadius.sm,
    minHeight: scale(40),
  },
  tabCompact: {
    gap: scale(5),
    paddingVertical: responsiveSpacing.xs,
    minHeight: scale(32),
  },
  // Matches the dimming the app grids use for locked entries.
  tabLocked: {
    opacity: 0.45,
  },
  text: {
    fontSize: fontScale(12.5),
    fontWeight: '600',
  },
  textCompact: {
    fontSize: fontScale(11.5),
  },
});
