/**
 * The first thing the player sees before they build a face.
 *
 * Two routes, and the choice matters more than it looks: a wall of sliders as
 * the opening move asks someone to do work before they have any reason to care,
 * while "put your own face in" is a promise they can picture. So the selfie card
 * is the hero and manual creation is the calm, always-available alternative —
 * never a consolation prize, because it is what most players will use and it is
 * the whole creator.
 *
 * ## Why the paywall is on the card and not behind it
 *
 * The lock is stated on the hero card before it is tapped. Tapping a card that
 * looks free and getting a paywall is the pattern players describe as a dark
 * pattern, and it converts worse than saying so up front — someone who taps a
 * card marked DeepLife+ has already decided to consider it.
 *
 * Manual creation stays entirely free. Nothing in the existing creator moved
 * behind the subscription; this screen adds a route, it does not gate one.
 */

import React, { useEffect } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Camera, ChevronRight, Crown, Palette, Sparkles } from 'lucide-react-native';
import { track } from '@/lib/analytics';
import { haptic } from '@/utils/haptics';
import { fontScale, scale } from '@/utils/scaling';

/** Shared with FaceStudio — see the palette note there for why it is local. */
const C = {
  bg: '#070A10',
  card: '#121827',
  cardBorder: 'rgba(255, 255, 255, 0.08)',
  text: '#FFFFFF',
  sub: 'rgba(255, 255, 255, 0.65)',
  muted: 'rgba(255, 255, 255, 0.38)',
  accent: '#4C8DFF',
  accentSoft: 'rgba(76, 141, 255, 0.14)',
  accentBorder: 'rgba(76, 141, 255, 0.45)',
  gold: '#FACC15',
  goldSoft: 'rgba(250, 204, 21, 0.12)',
  goldBorder: 'rgba(250, 204, 21, 0.40)',
};

export interface BecomeYourselfProps {
  /** True when the player owns DeepLife+ — decides lock vs. arrow on the hero. */
  hasPlus: boolean;
  /** False when no provider can run here; the hero explains rather than lies. */
  photoSupported: boolean;
  onSelfie: () => void;
  onManual: () => void;
  onUpsell: () => void;
}

export default function BecomeYourself({
  hasPlus,
  photoSupported,
  onSelfie,
  onManual,
  onUpsell,
}: BecomeYourselfProps): React.JSX.Element {
  useEffect(() => {
    track('avatar_entry_viewed', { hasPlus, photoSupported });
  }, [hasPlus, photoSupported]);

  const heroDisabled = !photoSupported;

  const pressHero = (): void => {
    haptic.light();
    if (heroDisabled) return;
    if (!hasPlus) {
      onUpsell();
      return;
    }
    onSelfie();
  };

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>DEEP LIFE SIMULATOR</Text>
        <Text style={styles.title}>Become yourself</Text>
        <Text style={styles.subtitle}>
          Create a realistic version of yourself in seconds.
        </Text>
      </View>

      <TouchableOpacity
        activeOpacity={0.85}
        onPress={pressHero}
        disabled={heroDisabled}
        accessibilityRole="button"
        accessibilityLabel={
          hasPlus
            ? 'Create from selfie'
            : 'Create from selfie, a DeepLife Plus feature'
        }
        accessibilityHint={
          heroDisabled
            ? 'Not available on this device'
            : hasPlus
              ? 'Opens the camera and photo library'
              : 'Opens the DeepLife Plus subscription options'
        }
        accessibilityState={{ disabled: heroDisabled }}
        style={[styles.hero, heroDisabled && styles.heroDisabled]}
      >
        <View style={styles.heroTop}>
          <View style={styles.heroIcon}>
            <Camera size={scale(24)} color={C.accent} />
          </View>
          {hasPlus ? (
            <View style={styles.plusChip}>
              <Sparkles size={scale(11)} color={C.gold} />
              <Text style={styles.plusChipText}>INCLUDED</Text>
            </View>
          ) : (
            <View style={styles.plusChip}>
              <Crown size={scale(11)} color={C.gold} />
              <Text style={styles.plusChipText}>DEEPLIFE+</Text>
            </View>
          )}
        </View>

        <Text style={styles.heroTitle}>Create from selfie</Text>
        <Text style={styles.heroBody}>
          {heroDisabled
            ? 'This device can’t read photos for face matching. Design your character by hand instead — every control is there.'
            : 'Take or choose a photo and we’ll measure your face, then build your character to match.'}
        </Text>

        {!heroDisabled ? (
          <View style={styles.heroCta}>
            <Text style={styles.heroCtaText}>
              {hasPlus ? 'Use a photo' : 'See DeepLife+'}
            </Text>
            <ChevronRight size={scale(17)} color={C.accent} />
          </View>
        ) : null}
      </TouchableOpacity>

      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => {
          haptic.light();
          onManual();
        }}
        accessibilityRole="button"
        accessibilityLabel="Create manually"
        accessibilityHint="Opens the full face editor"
        style={styles.secondary}
      >
        <View style={styles.secondaryIcon}>
          <Palette size={scale(20)} color={C.sub} />
        </View>
        <View style={styles.secondaryText}>
          <Text style={styles.secondaryTitle}>Create manually</Text>
          <Text style={styles.secondaryBody}>
            Design every detail from scratch. Always free.
          </Text>
        </View>
        <ChevronRight size={scale(18)} color={C.muted} />
      </TouchableOpacity>

      <Text style={styles.footnote}>
        Photos are used to measure your face and are never uploaded without a
        DeepLife+ scan you start yourself.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg, padding: scale(20), justifyContent: 'center' },
  header: { marginBottom: scale(28) },
  eyebrow: {
    color: C.accent,
    fontSize: fontScale(11),
    fontWeight: '800',
    letterSpacing: 1.6,
    marginBottom: scale(10),
  },
  title: { color: C.text, fontSize: fontScale(34), fontWeight: '800', letterSpacing: -0.8 },
  subtitle: { color: C.sub, fontSize: fontScale(15), marginTop: scale(8), lineHeight: fontScale(21) },

  hero: {
    backgroundColor: C.card,
    borderRadius: scale(22),
    borderWidth: 1,
    borderColor: C.accentBorder,
    padding: scale(20),
  },
  heroDisabled: { borderColor: C.cardBorder, opacity: 0.72 },
  heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heroIcon: {
    width: scale(46),
    height: scale(46),
    borderRadius: scale(14),
    backgroundColor: C.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  plusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(5),
    backgroundColor: C.goldSoft,
    borderWidth: 1,
    borderColor: C.goldBorder,
    borderRadius: 99,
    paddingHorizontal: scale(9),
    paddingVertical: scale(4),
  },
  plusChipText: { color: C.gold, fontSize: fontScale(10), fontWeight: '800', letterSpacing: 0.9 },
  heroTitle: {
    color: C.text,
    fontSize: fontScale(21),
    fontWeight: '800',
    marginTop: scale(16),
    letterSpacing: -0.3,
  },
  heroBody: { color: C.sub, fontSize: fontScale(14), marginTop: scale(7), lineHeight: fontScale(20) },
  heroCta: { flexDirection: 'row', alignItems: 'center', gap: scale(4), marginTop: scale(16) },
  heroCtaText: { color: C.accent, fontSize: fontScale(15), fontWeight: '700' },

  secondary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(14),
    backgroundColor: C.card,
    borderRadius: scale(18),
    borderWidth: 1,
    borderColor: C.cardBorder,
    padding: scale(16),
    marginTop: scale(12),
  },
  secondaryIcon: {
    width: scale(40),
    height: scale(40),
    borderRadius: scale(12),
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryText: { flex: 1 },
  secondaryTitle: { color: C.text, fontSize: fontScale(16), fontWeight: '700' },
  secondaryBody: { color: C.muted, fontSize: fontScale(13), marginTop: scale(3) },

  footnote: {
    color: C.muted,
    fontSize: fontScale(11),
    lineHeight: fontScale(16),
    marginTop: scale(20),
    textAlign: 'center',
  },
});
