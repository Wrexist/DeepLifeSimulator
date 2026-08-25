/**
 * SectionGroup - a labelled band in a long feed.
 *
 * The Home feed stacks up to twenty modules at identical visual weight, so a
 * player scanning it has no way to tell "what changed this week" from "what I
 * am working toward" from "places to go". This groups them into named bands.
 *
 * The label is INFORMATION, not decoration: each band is a genuinely different
 * kind of content, and the name is what lets the eye skip to the one it wants.
 *
 * Every card in that feed self-nulls when it has nothing to say - which is a
 * good property, and the reason this component cannot simply render a heading.
 * A band whose children all returned null would show a title over empty space,
 * which is worse than no title. So the label appears only once the band has
 * actually laid out with height: correct in every case, at the cost of the
 * label arriving one frame after its content.
 */
import React, { useState } from 'react';
import { LayoutChangeEvent, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { fontScale, responsiveSpacing, scale } from '@/utils/scaling';

interface SectionGroupProps {
  label: string;
  children: React.ReactNode;
}

/** Below this the band is treated as empty (stray margins, hairlines). */
const EMPTY_HEIGHT = 4;

export default function SectionGroup({ label, children }: SectionGroupProps) {
  const { theme } = useTheme();
  const [hasContent, setHasContent] = useState(false);

  const onLayout = (event: LayoutChangeEvent) => {
    const next = event.nativeEvent.layout.height > EMPTY_HEIGHT;
    if (next !== hasContent) setHasContent(next);
  };

  return (
    <View style={styles.group}>
      {hasContent ? (
        <View style={styles.labelRow}>
          <Text
            style={[styles.label, { color: theme.textMuted }]}
            accessibilityRole="header"
            maxFontSizeMultiplier={1.4}
          >
            {label}
          </Text>
          <View style={[styles.rule, { backgroundColor: theme.border }]} />
        </View>
      ) : null}
      <View onLayout={onLayout}>{children}</View>
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
