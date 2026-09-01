/**
 * Card - THE home-feed card container. One card, one border.
 *
 * Nine feed cards used to share this container byte-for-byte except for the
 * borderColor, which cycled blue/purple/pink/sky/violet/yellow/white per card.
 * The hue encoded nothing - it just made the feed read as a rainbow - so the
 * container is unified on one neutral hairline. Meaning stays where it belongs:
 * each card's ACCENT color lives on its icon bubble, kicker text and inline
 * chips, never on the container border (and never as a one-sided accent bar -
 * Hard Rule #7 in CLAUDE.md bans those outright).
 *
 * A card may still override the border for a genuine STATE change (e.g. the
 * amber "complete" border AmbitionCard/WeeklyChallengeCard apply) by passing
 * `style` - that encodes something; a per-card identity hue does not.
 *
 * For a pressable card (a TouchableOpacity container), spread the exported
 * `cardStyle` onto the touchable instead of nesting a View.
 *
 * Named exports only, no default: exporting `Card` both ways made every
 * consumer's `import Card from` trip `import/no-named-as-default` - nine
 * lint warnings for one avoidable ambiguity.
 */
import React from 'react';
import { View, StyleSheet } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { scale, responsiveBorderRadius } from '@/utils/scaling';

/** The shared container style, for cards whose root must stay a touchable. */
export const cardStyle: ViewStyle = {
  marginHorizontal: scale(16),
  marginBottom: scale(12),
  padding: scale(14),
  borderRadius: responsiveBorderRadius.lg,
  backgroundColor: 'rgba(30, 41, 59, 0.75)',
  borderWidth: 1,
  // The neutral hairline - the one border color a feed card gets.
  borderColor: 'rgba(255, 255, 255, 0.08)',
  gap: scale(12),
};

export function Card({
  style,
  children,
}: {
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
}) {
  return <View style={[styles.card, style]}>{children}</View>;
}

/**
 * IconBubble - the shared 40×40 rounded icon chip ("crest") the feed cards
 * re-declared per card. Tints its background with the card's accent at ~13%
 * alpha and draws a full four-sided hairline in the same accent at ~40% -
 * exactly the treatment five of the feed cards already used. `color` must be
 * a 6-digit hex accent (e.g. '#F472B6'); the alpha is appended as hex.
 */
export function IconBubble({
  color,
  style,
  children,
}: {
  color: string;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
}) {
  return (
    <View
      style={[
        styles.iconBubble,
        { backgroundColor: `${color}21`, borderColor: `${color}66` },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: cardStyle,
  iconBubble: {
    width: scale(40),
    height: scale(40),
    borderRadius: scale(12),
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
});

