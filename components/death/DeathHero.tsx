/**
 * The illustration at the top of the death screen.
 *
 * ## Why this is drawn and not an image
 *
 * The design calls for a painted gravestone — lit headstone, purple wisp, moss,
 * a flower, drifting embers. That asset does not exist yet, and Metro resolves
 * `require()` at BUILD time, so a component that reaches for a file which is
 * not there does not degrade, it fails to bundle. "Ship the layout now, add the
 * art later" is therefore not a thing you can do by leaving a require in place
 * and hoping.
 *
 * So the hero is composed from views: a headstone silhouette, a skull glyph, a
 * radial bloom behind it, a ground mound and scattered embers. It reads as the
 * intended image at the intended size, and it costs no download.
 *
 * When the painted asset lands, `source` takes it and the drawing steps aside —
 * one prop, no other change. The prompts for generating it are in
 * `docs/DEATH_SCREEN_ASSETS.md`.
 *
 * Nothing here is interactive and nothing reads game state; it is given a mood
 * and it draws. That keeps the most crash-sensitive screen in the game free of
 * one more thing that can throw.
 */

import React from 'react';
import { View, Image, StyleSheet, type ImageSourcePropType } from 'react-native';
import { Skull } from 'lucide-react-native';
import { scale } from '@/utils/scaling';

interface Props {
  /**
   * The painted illustration, once it exists. Omit and the drawn hero is used.
   * Wiring it is deliberately a single prop so adding the asset is a one-line
   * change in the screen rather than an edit in here.
   */
  source?: ImageSourcePropType;
  /** Height of the whole band. The screen sizes this to the device. */
  height: number;
  /** Drives the glow colour — a bleak life gets a colder light. */
  mood?: 'bleak' | 'poor' | 'fair' | 'good' | 'great';
}

const GLOW: Record<NonNullable<Props['mood']>, string> = {
  bleak: '#4C1D95',
  poor: '#5B21B6',
  fair: '#6D28D9',
  good: '#7C3AED',
  great: '#8B5CF6',
};

/** Embers, at fixed positions — a death screen must not roll dice to render. */
const EMBERS: { left: string; top: string; size: number; opacity: number }[] = [
  { left: '18%', top: '22%', size: 3, opacity: 0.5 },
  { left: '27%', top: '58%', size: 2, opacity: 0.35 },
  { left: '35%', top: '12%', size: 2, opacity: 0.45 },
  { left: '62%', top: '18%', size: 3, opacity: 0.55 },
  { left: '71%', top: '42%', size: 2, opacity: 0.4 },
  { left: '78%', top: '26%', size: 4, opacity: 0.6 },
  { left: '84%', top: '62%', size: 2, opacity: 0.3 },
  { left: '12%', top: '44%', size: 2, opacity: 0.3 },
];

function DeathHero({ source, height, mood = 'poor' }: Props) {
  const glow = GLOW[mood];
  const s = makeStyles(height, glow);

  if (source) {
    return (
      <View style={s.band}>
        <Image source={source} style={s.art} resizeMode="contain" />
      </View>
    );
  }

  const stoneHeight = height * 0.62;
  const stoneWidth = stoneHeight * 0.72;

  return (
    <View style={s.band} accessibilityRole="image" accessibilityLabel="A lit gravestone">
      {/* Bloom behind the stone. Three stacked circles rather than a gradient:
          RN's radial support is inconsistent across platforms and this reads
          the same everywhere. */}
      <View style={[s.bloom, { width: height * 1.1, height: height * 1.1, borderRadius: height }]} />
      <View style={[s.bloom, s.bloomMid, { width: height * 0.7, height: height * 0.7, borderRadius: height }]} />
      <View style={[s.bloom, s.bloomCore, { width: height * 0.38, height: height * 0.38, borderRadius: height }]} />

      {EMBERS.map((e, i) => (
        <View
          key={i}
          style={[
            s.ember,
            {
              left: e.left as never,
              top: e.top as never,
              width: scale(e.size),
              height: scale(e.size),
              borderRadius: scale(e.size),
              opacity: e.opacity,
            },
          ]}
        />
      ))}

      {/* The wisp — a soft column of light rising to the right of the stone. */}
      <View style={[s.wisp, { height: stoneHeight * 0.9, right: '26%' }]} />
      <View style={[s.wisp, s.wispInner, { height: stoneHeight * 0.6, right: '27.5%' }]} />

      {/* Headstone: a rounded-top slab. */}
      <View
        style={[
          s.stone,
          {
            width: stoneWidth,
            height: stoneHeight,
            borderTopLeftRadius: stoneWidth / 2,
            borderTopRightRadius: stoneWidth / 2,
          },
        ]}
      >
        <Skull size={stoneWidth * 0.42} color="#0B0F16" strokeWidth={1.6} />
      </View>

      {/* Ground mound the stone sits in. */}
      <View style={[s.mound, { width: height * 1.5, height: height * 0.34, borderTopLeftRadius: height, borderTopRightRadius: height }]} />
    </View>
  );
}

const makeStyles = (height: number, glow: string) =>
  StyleSheet.create({
    band: {
      width: '100%',
      height,
      alignItems: 'center',
      justifyContent: 'flex-end',
      overflow: 'hidden',
    },
    art: { width: '100%', height: '100%' },
    bloom: {
      position: 'absolute',
      bottom: -height * 0.28,
      backgroundColor: glow,
      opacity: 0.1,
    },
    bloomMid: { opacity: 0.14, bottom: -height * 0.1 },
    bloomCore: { opacity: 0.2, bottom: height * 0.06 },
    ember: { position: 'absolute', backgroundColor: '#C4B5FD' },
    wisp: {
      position: 'absolute',
      bottom: height * 0.22,
      width: scale(10),
      borderRadius: scale(10),
      backgroundColor: glow,
      opacity: 0.35,
    },
    wispInner: { width: scale(5), backgroundColor: '#DDD6FE', opacity: 0.5 },
    stone: {
      backgroundColor: '#3B4453',
      alignItems: 'center',
      justifyContent: 'center',
      paddingTop: '14%',
      marginBottom: height * 0.16,
      // Full four-sided border — Hard Rule #7 bans the one-sided kind, and a
      // slab needs its edge to read as carved rather than as a flat rectangle.
      borderWidth: 1,
      borderColor: '#4C5567',
    },
    mound: {
      position: 'absolute',
      bottom: 0,
      backgroundColor: '#161B24',
    },
  });

export default React.memo(DeathHero);
