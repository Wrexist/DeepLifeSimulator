/**
 * The picture of a finished life that the death screen shares.
 *
 * It is never shown to the player: DeathPopup renders it off-screen and
 * `shareViewAsImage` (utils/shareImage.ts) captures it as a PNG. That is why
 * the sizes here are FIXED pixels rather than `scale()`: the card is an export
 * at a fixed 4:5 aspect (the shape Instagram, X and Discord previews crop to
 * least), captured at CARD_EXPORT_WIDTH whatever the device, so a phone and a
 * tablet share the same image.
 *
 * The link is printed on the card because Android's image share carries no
 * message text - the picture is all the reader gets. It names the share
 * landing page, which sends each reader to their own store.
 */
import React, { forwardRef } from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import type { ObituaryCard } from '@/lib/legacy/obituaryGenerator';

export const CARD_WIDTH = 360;
export const CARD_HEIGHT = 450;
export const CARD_EXPORT_WIDTH = 1080;

const C = {
  bg: '#0F172A',
  panel: '#172036',
  stroke: 'rgba(148,163,184,0.22)',
  ink: '#F1F5F9',
  muted: '#94A3B8',
  gold: '#FBBF24',
  violet: '#A78BFA',
};

/**
 * Fixed point sizes for a fixed-size export (see the header): fontScale() would
 * make the shared image depend on the sharer's device and accessibility text
 * size, which is exactly what the card must not do.
 */
const TYPE = {
  rip: 11,
  gen: 11,
  name: 32,
  age: 15,
  label: 10,
  money: 34,
  verdict: 13,
  fact: 14,
  cause: 12,
  brand: 13,
  link: 10.5,
} as const;

const LINK_LABEL = 'wrexist.github.io/DeepLifeSimulator/get';

interface Props {
  card: ObituaryCard;
}

const ObituaryShareCard = forwardRef<View, Props>(({ card }, ref) => (
  <View ref={ref} collapsable={false} style={styles.card}>
    <View style={styles.glowTop} />
    <View style={styles.glowBottom} />

    <View style={styles.header}>
      <Text style={styles.rip}>REST IN PEACE</Text>
      {card.generation > 1 ? <Text style={styles.gen}>Generation {card.generation}</Text> : null}
    </View>

    <View style={styles.identity}>
      <Text style={styles.name} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.6}>
        {card.name}
      </Text>
      <Text style={styles.age}>Died at {card.age}</Text>
    </View>

    <View style={styles.panel}>
      <Text style={styles.label}>NET WORTH</Text>
      <Text style={styles.money} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.5}>
        {card.netWorth}
      </Text>
      <Text style={styles.verdict}>{card.verdict}</Text>
    </View>

    <View style={styles.facts}>
      {(card.facts.length > 0 ? card.facts : ['Lived a quiet life']).map((fact) => (
        <Text key={fact} style={styles.fact} numberOfLines={1}>
          {'•  '}
          {fact.charAt(0).toUpperCase() + fact.slice(1)}
        </Text>
      ))}
      <Text style={styles.cause} numberOfLines={1}>Cause of death: {card.cause}</Text>
    </View>

    <View style={styles.footer}>
      <Image source={require('@/assets/images/icon.png')} style={styles.icon} />
      <View style={styles.footerText}>
        <Text style={styles.brand}>Deep Life Simulator</Text>
        <Text style={styles.link}>Live yours · {LINK_LABEL}</Text>
      </View>
    </View>
  </View>
));

ObituaryShareCard.displayName = 'ObituaryShareCard';

const styles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    backgroundColor: C.bg,
    borderRadius: 24,
    padding: 24,
    overflow: 'hidden',
    justifyContent: 'space-between',
  },
  glowTop: {
    position: 'absolute',
    top: -120,
    right: -80,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: 'rgba(139,92,246,0.28)',
  },
  glowBottom: {
    position: 'absolute',
    bottom: -140,
    left: -100,
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: 'rgba(99,102,241,0.22)',
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rip: { color: C.muted, fontSize: TYPE.rip, fontWeight: '600', letterSpacing: 2 },
  gen: { color: C.violet, fontSize: TYPE.gen, fontWeight: '600' },
  identity: { gap: 2 },
  name: { color: C.ink, fontSize: TYPE.name, fontWeight: '600' },
  age: { color: C.muted, fontSize: TYPE.age, fontWeight: '600' },
  panel: {
    backgroundColor: C.panel,
    borderWidth: 1,
    borderColor: C.stroke,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  label: { color: C.muted, fontSize: TYPE.label, fontWeight: '600', letterSpacing: 1.5 },
  money: { color: C.gold, fontSize: TYPE.money, fontWeight: '600', marginTop: 2 },
  verdict: { color: C.ink, fontSize: TYPE.verdict, fontWeight: '600', marginTop: 2 },
  facts: { gap: 5 },
  fact: { color: C.ink, fontSize: TYPE.fact },
  cause: { color: C.muted, fontSize: TYPE.cause, marginTop: 4 },
  footer: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  icon: { width: 34, height: 34, borderRadius: 8 },
  footerText: { flex: 1 },
  brand: { color: C.ink, fontSize: TYPE.brand, fontWeight: '600' },
  link: { color: C.muted, fontSize: TYPE.link },
});

export default ObituaryShareCard;
