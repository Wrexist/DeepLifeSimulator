import { responsiveSpacing as layoutSpace, responsiveBorderRadius as layoutRadius , scale, responsiveBorderRadius } from '@/utils/scaling';
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
import { colors, withAlpha } from '@/lib/config/theme';
import React from 'react';
import { View, StyleSheet } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';


/** The shared container style, for cards whose root must stay a touchable. */
export const cardStyle: ViewStyle = {
  // No horizontal margin: the feed's ScrollView already pads 16, and a card
  // margin on top of it gave every Card a 32pt gutter next to full-width
  // neighbours (IdentityCard, the coach) - the one card type on Home that
  // was visibly narrower than the rest. Education's Cards had been overriding
  // this to 0 for the same reason. Containers own the gutter; cards fill it.
  marginBottom: layoutSpace.compact,
  padding: layoutSpace.md,
  borderRadius: responsiveBorderRadius.lg,
  backgroundColor: colors.dark.surface,
  borderWidth: 1,
  // The neutral hairline - the one border color a feed card gets.
  borderColor: colors.dark.border,
  gap: layoutSpace.compact,
};

export function Card({
  style,
  children,
}: {
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
}) {
  // Feed cards use fixed navy text/art styling, including in legacy light-mode saves.
  // Adaptive callers pass their paired surface/text treatment through style.
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
        { backgroundColor: withAlpha(color, 0.13), borderColor: withAlpha(color, 0.4) },
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
    borderRadius: layoutRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
});

