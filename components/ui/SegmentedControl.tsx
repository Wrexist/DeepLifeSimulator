import { responsiveSpacing as layoutSpace , fontScale, scale, responsiveBorderRadius, responsiveSpacing } from '@/utils/scaling';
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
import React, { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View, ViewStyle } from 'react-native';
import { ChevronLeft, ChevronRight, Lock } from 'lucide-react-native';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { useTheme } from '@/hooks/useTheme';
import { accent, withAlpha } from '@/lib/config/theme';


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
   * Horizontal scrolling for long labels or larger groups (Travel, Bank, Shop).
   * Segments keep natural widths; visible arrows appear only when they overflow.
   * Short fixed groups share the row and allow their text to wrap.
   */
  scrollable?: boolean;
}



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
  const { theme } = useTheme();
  const reducedMotion = useReducedMotion();
  const scrollRef = useRef<ScrollView>(null);
  const offset = useRef(0);
  const [scrollX, setScrollX] = useState(0);
  const [outerWidth, setOuterWidth] = useState(0);
  const [viewportWidth, setViewportWidth] = useState(0);
  const [contentWidth, setContentWidth] = useState(0);
  const [positions, setPositions] = useState<Record<string, { x: number; width: number }>>({});
  const overflow = outerWidth > 0 && contentWidth > outerWidth - layoutSpace.xs * 2 - 2;
  const maxScroll = Math.max(0, contentWidth - viewportWidth);
  const moveTo = (x: number) => {
    const next = Math.max(0, Math.min(maxScroll, x));
    offset.current = next;
    setScrollX(next);
    scrollRef.current?.scrollTo({ x: next, animated: !reducedMotion });
  };
  // Reveal external selections and keep the active label visible after resizing.
  // Manual scrolling is deliberately not a dependency: browsing other tabs must
  // not snap the strip back to the selected tab.
  useEffect(() => {
    const selected = positions[value];
    if (!scrollable || !selected || viewportWidth <= 0) return;
    let next = offset.current;
    if (selected.x < next) next = selected.x;
    else if (selected.x + selected.width > next + viewportWidth) next = selected.x + selected.width - viewportWidth;
    next = Math.max(0, Math.min(Math.max(0, contentWidth - viewportWidth), next));
    offset.current = next;
    setScrollX(next);
    scrollRef.current?.scrollTo({ x: next, animated: !reducedMotion });
  }, [value, positions, viewportWidth, contentWidth, scrollable, reducedMotion]);
  const MUTED = theme.textSecondary;
  const ACTIVE_TEXT = theme.text;
  const material = { backgroundColor: theme.surfaceInset, borderColor: theme.border };
  const body = segments.map((seg) => {
        // A locked segment can never also be the active one in practice - the
        // unlock tier only ever rises - but if it somehow were, "locked" wins
        // so the player is never left tapping an inert highlighted tab.
        const locked = seg.locked === true;
        const active = !locked && seg.key === value;
        const Icon = locked ? Lock : seg.icon;
        return (
          <View key={seg.key} style={[styles.slot, scrollable && styles.slotScroll]}
            onLayout={scrollable ? ({ nativeEvent: { layout } }) => setPositions(previous =>
              previous[seg.key]?.x === layout.x && previous[seg.key]?.width === layout.width
                ? previous : { ...previous, [seg.key]: { x: layout.x, width: layout.width } }) : undefined}>

            <TouchableOpacity
              style={[
                styles.tab,
                compact && styles.tabCompact,
                scrollable && styles.tabScroll,
                active && { backgroundColor: withAlpha(activeColor, 0.24) },
                locked && styles.tabLocked,
              ]}
              onPress={() => (locked ? onLockedPress?.(seg.key, seg.lockReason || '') : onChange(seg.key))}
              activeOpacity={0.85}
              accessibilityRole="tab"
              disabled={locked && !onLockedPress}
              accessibilityState={locked ? { selected: active, disabled: !onLockedPress } : { selected: active }}
              accessibilityHint={locked && onLockedPress ? 'Explains how to unlock this section' : undefined}
              accessibilityLabel={locked ? `${seg.label}, locked. ${seg.lockReason || ''}`.trim() : seg.label}
            >
              {Icon ? <Icon size={compact ? scale(14) : scale(16)} color={active ? activeColor : MUTED} /> : null}
              <Text style={[styles.text, compact && styles.textCompact, { color: active ? ACTIVE_TEXT : MUTED }]} >
                {seg.label}
              </Text>
            </TouchableOpacity>
            {seg.accessory}
          </View>
        );
      });
  if (scrollable) {
    return (
      <View style={[styles.container, material, compact && styles.containerCompact, styles.scrollSelf, style]}
        onLayout={({ nativeEvent }) => setOuterWidth(nativeEvent.layout.width)}>
        {overflow && <TouchableOpacity accessibilityRole="button" accessibilityLabel="Show previous tabs"
          accessibilityState={{ disabled: scrollX <= 1 }} disabled={scrollX <= 1}
          onPress={() => moveTo(offset.current - viewportWidth * 0.8)}
          style={[styles.scrollArrow, { backgroundColor: theme.surfaceInteractive }, scrollX <= 1 && styles.arrowDisabled]}>
          <ChevronLeft size={scale(18)} color={theme.text} />
        </TouchableOpacity>}
        <ScrollView ref={scrollRef} horizontal showsHorizontalScrollIndicator={false}
          style={styles.scrollViewport} contentContainerStyle={styles.scrollContent}
          onLayout={({ nativeEvent }) => setViewportWidth(nativeEvent.layout.width)}
          onContentSizeChange={width => setContentWidth(width)}
          onScroll={({ nativeEvent }) => { offset.current = nativeEvent.contentOffset.x; setScrollX(nativeEvent.contentOffset.x); }}
          scrollEventThrottle={16} accessibilityRole="tablist">
          {body}
        </ScrollView>
        {overflow && <TouchableOpacity accessibilityRole="button" accessibilityLabel="Show more tabs"
          accessibilityState={{ disabled: scrollX >= maxScroll - 1 }} disabled={scrollX >= maxScroll - 1}
          onPress={() => moveTo(offset.current + viewportWidth * 0.8)}
          style={[styles.scrollArrow, { backgroundColor: theme.surfaceInteractive }, scrollX >= maxScroll - 1 && styles.arrowDisabled]}>
          <ChevronRight size={scale(18)} color={theme.text} />
        </TouchableOpacity>}
      </View>
    );
  }
  return (
    <View style={[styles.container, material, compact && styles.containerCompact, style]} accessibilityRole="tablist">
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
    padding: layoutSpace.xs,
    gap: layoutSpace.xs,
  },
  // Subordinate (nested) look: flatter fill, tighter padding, no rim.
  containerCompact: {
    backgroundColor: 'rgba(15, 23, 42, 0.32)',
    borderColor: 'transparent',
    padding: layoutSpace.xs,
    gap: layoutSpace.xs,
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
  scrollViewport: { flex: 1, flexGrow: 1, flexShrink: 1 },
  scrollArrow: { width: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: responsiveBorderRadius.sm },
  arrowDisabled: { opacity: 0.35 },
  scrollContent: {
    flexDirection: 'row',
    gap: layoutSpace.xs,
    paddingRight: layoutSpace.xs,
  },
  /**
   * Content-width segments for the scrollable variant - in LONGHAND, because
   * `flex: 0` does not mean the same thing on both platforms.
   *
   * Yoga (iOS/Android) expands `flex: 0` to `flexBasis: auto`, so the slot
   * sizes to its content and the labels render at their natural width. React
   * Native Web expands it to `flex: 0 1 0%` - basis ZERO - so the slot computes
   * to 0px and every label collapses to the icon (measured: slot width 0,
   * label width 28). The scrollable bank tabs have therefore been unreadable on
   * the web preview target while looking correct on device, which is the worst
   * shape a layout bug can have: it only exists where nobody is looking at it.
   *
   * Spelling the three properties out is what the variant's docblock already
   * says it wants - "segments keep their natural width instead of sharing the
   * row" - and it means the same thing everywhere.
   */
  slotScroll: {
    flexGrow: 0,
    flexShrink: 0,
    flexBasis: 'auto',
  },
  tabScroll: {
    paddingHorizontal: layoutSpace.compact,
    // `styles.tab` sets `flex: 1` for the SHARED-row variant; a scrolling row
    // must not share, or the same basis-0% collapse applies one level down.
    flexGrow: 0,
    flexShrink: 0,
    flexBasis: 'auto',
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
    gap: layoutSpace.xs,
    paddingVertical: responsiveSpacing.sm,
    borderRadius: responsiveBorderRadius.sm,
    minHeight: Math.max(44, scale(40)),
  },
  tabCompact: {
    gap: layoutSpace.xs,
    paddingVertical: responsiveSpacing.xs,
    minHeight: Math.max(44, scale(40)),
  },
  // Matches the dimming the app grids use for locked entries.
  tabLocked: {
    opacity: 0.75,
  },
  text: {
    flexShrink: 1,
    textAlign: 'center',
    fontSize: fontScale(12),
    fontWeight: '600',
  },
  textCompact: {
    fontSize: fontScale(12),
  },
});
