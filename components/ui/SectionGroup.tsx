/**
 * SectionGroup - a labelled, foldable band in a long feed.
 *
 * The Home feed stacks up to twenty modules at identical visual weight, so a
 * player scanning it has no way to tell "what changed this week" from "what I
 * am working toward" from "places to go". This groups them into named bands.
 *
 * The label is INFORMATION, not decoration: each band is a genuinely different
 * kind of content, and the name is what lets the eye skip to the one it wants.
 * A band can also be FOLDED AWAY (`collapsibleId`), which is the other half of
 * the answer to a long feed - naming bands lets you find one, collapsing them
 * lets you dismiss the ones you are not using today. State is remembered per
 * id (`utils/sectionCollapse.ts`).
 *
 * Every card in that feed self-nulls when it has nothing to say - which is a
 * good property, and the reason this cannot simply render a heading. A band
 * whose children all returned null would show a title over empty space. So the
 * label is gated on the band having actually laid out with height.
 *
 * That measurement only works while the band is OPEN (a closed band has no
 * children to measure). A closed band therefore always shows its label - it
 * has to, or there would be nothing left to tap to reopen it.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';
import { ChevronDown } from 'lucide-react-native';
import { useTheme } from '@/hooks/useTheme';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { fontScale, responsiveSpacing, scale } from '@/utils/scaling';
import { animation } from '@/lib/config/theme';
import { haptic } from '@/utils/haptics';
import {
  isSectionCollapsed,
  onSectionCollapseHydrated,
  setSectionCollapsed,
} from '@/utils/sectionCollapse';

interface SectionGroupProps {
  label: string;
  /** Set to make the band foldable; also the key its state is remembered under. */
  collapsibleId?: string;
  /** Collapsed on first ever view. Defaults to open. */
  defaultCollapsed?: boolean;
  children: React.ReactNode;
}

/** Below this the band is treated as empty (stray margins, hairlines). */
const EMPTY_HEIGHT = 4;

export default function SectionGroup({
  label,
  collapsibleId,
  defaultCollapsed = false,
  children,
}: SectionGroupProps) {
  const { theme } = useTheme();
  const reducedMotion = useReducedMotion();
  const [collapsed, setCollapsed] = useState(() =>
    collapsibleId ? isSectionCollapsed(collapsibleId, defaultCollapsed) : false
  );
  // Only meaningful while open; a closed band is assumed to have content.
  const [measuredContent, setMeasuredContent] = useState(false);

  // Adopt the stored value if it landed after this first rendered.
  useEffect(() => {
    if (!collapsibleId) return undefined;
    return onSectionCollapseHydrated(() => {
      const stored = isSectionCollapsed(collapsibleId, defaultCollapsed);
      setCollapsed((prev) => (prev === stored ? prev : stored));
    });
  }, [collapsibleId, defaultCollapsed]);

  const spin = useRef(new Animated.Value(collapsed ? 1 : 0)).current;
  useEffect(() => {
    if (!collapsibleId) return;
    const target = collapsed ? 1 : 0;
    if (reducedMotion) {
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
  }, [collapsed, collapsibleId, reducedMotion, spin]);

  const onLayout = (event: LayoutChangeEvent) => {
    // Ignore measurements taken while closed - the children are unmounted, so
    // a zero here says nothing about whether the band has content.
    if (collapsed) return;
    const next = event.nativeEvent.layout.height > EMPTY_HEIGHT;
    if (next !== measuredContent) setMeasuredContent(next);
  };

  const toggle = useCallback(() => {
    if (!collapsibleId) return;
    haptic.light();
    setCollapsed((prev) => {
      const next = !prev;
      setSectionCollapsed(collapsibleId, next);
      return next;
    });
  }, [collapsibleId]);

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '-90deg'] });
  const showLabel = collapsed || measuredContent;

  const labelContent = (
    <>
      <Text
        style={[styles.label, { color: theme.textMuted }]}
        accessibilityRole={collapsibleId ? undefined : 'header'}
        maxFontSizeMultiplier={1.4}
      >
        {label}
      </Text>
      <View style={[styles.rule, { backgroundColor: theme.border }]} />
      {collapsibleId ? (
        <Animated.View style={{ transform: [{ rotate }] }}>
          <ChevronDown size={scale(15)} color={theme.textMuted} />
        </Animated.View>
      ) : null}
    </>
  );

  return (
    <View style={styles.group}>
      {showLabel ? (
        collapsibleId ? (
          <Pressable
            onPress={toggle}
            style={({ pressed }) => [
              styles.labelRow,
              styles.labelRowTappable,
              pressed && styles.pressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel={label}
            accessibilityState={{ expanded: !collapsed }}
            accessibilityHint={
              collapsed ? 'Double tap to expand this section' : 'Double tap to collapse this section'
            }
            hitSlop={{ top: 6, bottom: 6, left: 0, right: 0 }}
          >
            {labelContent}
          </Pressable>
        ) : (
          <View style={styles.labelRow}>{labelContent}</View>
        )
      ) : null}
      {collapsed ? null : <View onLayout={onLayout}>{children}</View>}
    </View>
  );
}

const styles = StyleSheet.create({
  group: {
    marginTop: responsiveSpacing.sm,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(10),
    marginBottom: responsiveSpacing.xs,
    paddingHorizontal: scale(2),
  },
  labelRowTappable: {
    minHeight: scale(34),
  },
  pressed: {
    opacity: 0.7,
  },
  label: {
    fontSize: fontScale(11),
    fontWeight: '700',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  /** Hairline that carries the label's line across the feed's width. */
  rule: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
  },
});
