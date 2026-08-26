/**
 * CollapsibleSection - a section header that folds its content away.
 *
 * The game's screens are long: Health stacks vitals, activities and diet
 * plans; Work stacks three career ladders; Home stacks up to twenty modules.
 * Everything was always open, so reaching the part you wanted meant scrolling
 * past the parts you didn't.
 *
 * Two properties make this more than a show/hide toggle:
 *
 * - A COLLAPSED SECTION CAN STILL SPEAK. `summary` renders in the header when
 *   the body is closed, so folding "Your Vitals" away leaves the four numbers
 *   on screen. Hiding information the player was relying on is how collapsible
 *   UI usually goes wrong.
 * - COLLAPSING UNMOUNTS. The body is not merely hidden, so a closed section
 *   costs nothing to render or re-render - on these screens that is a real
 *   saving, not a micro-optimisation.
 *
 * State is remembered per section id (`utils/sectionCollapse.ts`), so the
 * shape a player arranges survives leaving the screen and restarting the app.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { ChevronDown } from 'lucide-react-native';
import { useTheme } from '@/hooks/useTheme';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { fontScale, responsiveSpacing, scale, touchTargets } from '@/utils/scaling';
import { animation } from '@/lib/config/theme';
import { haptic } from '@/utils/haptics';
import {
  isSectionCollapsed,
  onSectionCollapseHydrated,
  setSectionCollapsed,
} from '@/utils/sectionCollapse';

interface CollapsibleSectionProps {
  /** Stable id - the key the open/closed state is remembered under. */
  id: string;
  title: string;
  /** Lucide icon element, already sized and coloured by the caller. */
  icon?: React.ReactNode;
  /** Tints the icon bubble. Decoration only; never the sole signal. */
  tint?: string;
  /**
   * Shown in the header WHILE COLLAPSED - the section's headline in one line
   * ("100 · 100 · 100"), so folding it away never hides what it was telling you.
   */
  summary?: React.ReactNode;
  /** Collapsed on first ever view. Defaults to open, matching prior behaviour. */
  defaultCollapsed?: boolean;
  /** Smaller header for sections nested inside a card. */
  compact?: boolean;
  style?: ViewStyle;
  children: React.ReactNode;
}

const FILL_ALPHA = '1F';
const BORDER_ALPHA = '59';

export default function CollapsibleSection({
  id,
  title,
  icon,
  tint,
  summary,
  defaultCollapsed = false,
  compact = false,
  style,
  children,
}: CollapsibleSectionProps) {
  const { theme } = useTheme();
  const reducedMotion = useReducedMotion();
  // Read the remembered state during the FIRST render, not in an effect - an
  // effect would paint the section open and then shut it.
  const [collapsed, setCollapsed] = useState(() => isSectionCollapsed(id, defaultCollapsed));

  const spin = useRef(new Animated.Value(collapsed ? 1 : 0)).current;
  const fade = useRef(new Animated.Value(1)).current;
  // True while applying a correction from storage rather than a player tap -
  // that one must not animate, or a cold start looks like the section shutting
  // itself for no reason.
  const settlingFromStorage = useRef(false);

  // If the stored values arrived after this rendered, adopt them now.
  useEffect(
    () =>
      onSectionCollapseHydrated(() => {
        const stored = isSectionCollapsed(id, defaultCollapsed);
        setCollapsed((prev) => {
          if (prev === stored) return prev;
          settlingFromStorage.current = true;
          return stored;
        });
      }),
    [id, defaultCollapsed]
  );

  useEffect(() => {
    const target = collapsed ? 1 : 0;
    if (reducedMotion || settlingFromStorage.current) {
      settlingFromStorage.current = false;
      spin.setValue(target);
      return;
    }
    const anim = Animated.timing(spin, {
      toValue: target,
      duration: animation.fast,
      useNativeDriver: true,
    });
    anim.start();
    return () => anim.stop();
  }, [collapsed, reducedMotion, spin]);

  // Content fades in on expand. There is no collapse animation on purpose:
  // the body unmounts, and animating something out of existence needs it kept
  // alive to animate, which is the cost this component exists to avoid.
  useEffect(() => {
    if (collapsed) return;
    if (reducedMotion) {
      fade.setValue(1);
      return;
    }
    fade.setValue(0);
    const anim = Animated.timing(fade, {
      toValue: 1,
      duration: animation.fast,
      useNativeDriver: true,
    });
    anim.start();
    return () => anim.stop();
  }, [collapsed, reducedMotion, fade]);

  const toggle = useCallback(() => {
    haptic.light();
    setCollapsed((prev) => {
      const next = !prev;
      setSectionCollapsed(id, next);
      return next;
    });
  }, [id]);

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '-90deg'] });

  return (
    <View style={[styles.section, style]}>
      <Pressable
        onPress={toggle}
        style={({ pressed }) => [
          styles.header,
          compact && styles.headerCompact,
          pressed && styles.headerPressed,
        ]}
        accessibilityRole="button"
        accessibilityLabel={title}
        accessibilityState={{ expanded: !collapsed }}
        accessibilityHint={collapsed ? 'Double tap to expand this section' : 'Double tap to collapse this section'}
        hitSlop={{ top: 4, bottom: 4, left: 0, right: 0 }}
      >
        {icon ? (
          <View
            style={[
              styles.iconBubble,
              compact && styles.iconBubbleCompact,
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

        <Text
          style={[
            compact ? styles.titleCompact : styles.title,
            { color: theme.text },
          ]}
          numberOfLines={1}
          maxFontSizeMultiplier={1.4}
        >
          {title}
        </Text>

        {/* Spacer keeps the chevron hard right whether or not a summary shows. */}
        <View style={styles.spacer} />

        {/* The summary only earns its place when the body is gone. */}
        {collapsed && summary ? (
          <View style={styles.summary}>
            {typeof summary === 'string' ? (
              <Text
                style={[styles.summaryText, { color: theme.textSecondary }]}
                numberOfLines={1}
                maxFontSizeMultiplier={1.3}
              >
                {summary}
              </Text>
            ) : (
              summary
            )}
          </View>
        ) : null}

        <Animated.View style={[styles.chevron, { transform: [{ rotate }] }]}>
          <ChevronDown size={scale(18)} color={theme.textMuted} />
        </Animated.View>
      </Pressable>

      {collapsed ? null : (
        <Animated.View style={{ opacity: fade }}>{children}</Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginBottom: responsiveSpacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(10),
    minHeight: touchTargets.minimum,
    paddingVertical: responsiveSpacing.xs,
    borderRadius: scale(10),
  },
  headerCompact: {
    minHeight: scale(38),
  },
  headerPressed: {
    opacity: 0.72,
  },
  iconBubble: {
    width: scale(34),
    height: scale(34),
    borderRadius: scale(10),
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBubbleCompact: {
    width: scale(28),
    height: scale(28),
    borderRadius: scale(8),
  },
  title: {
    fontSize: fontScale(17),
    fontWeight: '800',
    letterSpacing: -0.2,
    flexShrink: 1,
  },
  titleCompact: {
    fontSize: fontScale(13),
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    flexShrink: 1,
  },
  spacer: {
    flex: 1,
    minWidth: scale(8),
  },
  summary: {
    flexShrink: 1,
    maxWidth: '52%',
  },
  summaryText: {
    fontSize: fontScale(12.5),
    fontWeight: '600',
    textAlign: 'right',
  },
  chevron: {
    marginLeft: scale(4),
  },
});
