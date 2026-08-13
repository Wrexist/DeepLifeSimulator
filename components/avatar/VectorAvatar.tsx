/**
 * The avatar renderer.
 *
 * The FACE is illustrator-drawn modular art (avataaars via DiceBear) — see
 * `lib/avatar/style.ts`. The DEPTH is ours: a lit plate the art sits on.
 *
 * ── The 2.5D plate ────────────────────────────────────────────────────────
 * Four layers, back to front, all serving one key light at the upper left:
 *
 *   1. Contact shadow — cast below the disc, so it sits ON the surface rather
 *      than floating as a sticker.
 *   2. Lit plate      — a radial slate gradient, brightest toward the key.
 *   3. The art        — flat by design; the plate is what gives it weight.
 *   4. Gloss + rim    — a diagonal sweep and a hairline inner stroke.
 *
 * This treatment was prototyped in `scripts/generate-avatar-styles.mjs` long
 * before this component existed, and its one hard constraint is recorded here
 * because it is easy to trip over: it only works under FILLED art. Line-art
 * styles (lorelei, notionists, openPeeps) have transparent faces, so the plate
 * shows straight through them.
 *
 * ── Why the SVG is generated, not hand-drawn ──────────────────────────────
 * An earlier pass authored the facial geometry directly as bezier path data.
 * It looked amateur, because hand-typing coordinates is not how character art
 * gets made. `docs/avatar-art-direction-research.md` has the full reasoning
 * and the measured comparison of the alternatives.
 */
import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, RadialGradient, Stop, SvgXml } from 'react-native-svg';
import { createAvatar } from '@dicebear/core';
// Imported from its OWN package, not from `@dicebear/collection`. The
// collection is a barrel that re-exports all 30 styles (~6 MB on disk), and
// relying on the bundler to shake 29 of them out of a release build is not a
// bet worth taking. This pulls one 308 KB package.
import * as avataaars from '@dicebear/avataaars';
import { buildStyleOptions } from '@/lib/avatar/style';
import { addDepth, BLINK, frameArt, nextBlinkDelay } from '@/lib/avatar/depth';
import { applyChildProportions } from '@/lib/avatar/proportions';
import { ageEffects } from '@/lib/avatar/aging';
import { normalizeAvatar } from '@/lib/avatar/random';
import type { AvatarConfig, AvatarSex } from '@/lib/avatar/types';

export interface VectorAvatarProps {
  config: AvatarConfig;
  sex: AvatarSex;
  /** Drives greying, hair thinning and glasses likelihood. */
  age?: number;
  /** Rendered width and height in px. */
  size?: number;
  /** Draws the lit slate plate behind the art. */
  backdrop?: boolean;
  /** Clips the art to a circle. The plate is circular either way. */
  circular?: boolean;
  /**
   * Blink and breathe.
   *
   * OFF by default, and that is deliberate: a contacts list or a family tree
   * mounts dozens of avatars, and dozens of independent timers is a battery
   * and jank cost for motion nobody is looking at. Turn it on for the one
   * avatar a screen is ABOUT — the creator's hero, the identity card.
   */
  alive?: boolean;
}

/** The slate plate. Muted on purpose — the face is the subject, not the disc. */
const PLATE_LIGHT = '#465875';
const PLATE_DEEP = '#1A2334';

function VectorAvatarImpl({
  config,
  sex,
  age = 25,
  size = 120,
  backdrop = true,
  circular = true,
  alive = false,
}: VectorAvatarProps) {
  // Namespaces the injected gradient ids. Without this, two avatars on the web
  // target share one document scope and the second silently uses the first's
  // gradients.
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');

  const render = useMemo(() => {
    const safe = normalizeAvatar(config);
    const effects = ageEffects(age, sex);
    const options = buildStyleOptions(safe, sex, effects);
    // Proportions run on the RAW art, before framing: they move the art's own
    // layer groups, which `frameArt` then wraps as a whole.
    const build = (extra?: Record<string, unknown>) =>
      addDepth(
        frameArt(
          applyChildProportions(createAvatar(avataaars, { size, ...options, ...extra }).toString(), age)
        ),
        uid
      );
    return {
      open: build(),
      // Built once alongside the open frame rather than on each blink, so a
      // blink is a string swap and not a regeneration.
      closed: alive ? build({ eyes: ['closed'] }) : null,
    };
  }, [config, sex, age, size, alive, uid]);

  const [blinking, setBlinking] = useState(false);
  useEffect(() => {
    if (!alive) return;
    let openTimer: ReturnType<typeof setTimeout>;
    let closeTimer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      openTimer = setTimeout(() => {
        setBlinking(true);
        closeTimer = setTimeout(() => {
          setBlinking(false);
          schedule();
        }, BLINK.closedMs);
      }, nextBlinkDelay());
    };
    schedule();
    return () => {
      clearTimeout(openTimer);
      clearTimeout(closeTimer);
    };
  }, [alive]);

  // A slow breath. Native-driven, so it costs nothing on the JS thread.
  const breath = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!alive) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breath, { toValue: 1, duration: 1900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(breath, { toValue: 0, duration: 1900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [alive, breath]);

  const xml = blinking && render.closed ? render.closed : render.open;
  const radius = size / 2;
  const scale = breath.interpolate({ inputRange: [0, 1], outputRange: [1, 1.018] });

  return (
    <View style={[styles.root, { width: size, height: size }]}>
      {backdrop ? (
        <>
          {/* Contact shadow. Its own view because it has to fall OUTSIDE the
              disc — drawn inside, the circular clip would eat it. */}
          <View
            style={[
              styles.contact,
              {
                width: size * 0.82,
                height: size * 0.16,
                borderRadius: size * 0.41,
                bottom: -size * 0.03,
                left: size * 0.09,
              },
            ]}
          />
          <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
            <Defs>
              <RadialGradient id="avatarPlate" cx="33%" cy="25%" r="75%">
                <Stop offset="0" stopColor={PLATE_LIGHT} />
                <Stop offset="1" stopColor={PLATE_DEEP} />
              </RadialGradient>
            </Defs>
            <Circle cx={radius} cy={radius} r={radius} fill="url(#avatarPlate)" />
          </Svg>
        </>
      ) : null}

      <Animated.View
        style={[
          styles.art,
          circular ? { borderRadius: radius, overflow: 'hidden' } : null,
          alive ? { transform: [{ scale }] } : null,
        ]}
      >
        <SvgXml xml={xml} width={size} height={size} />
      </Animated.View>

      {backdrop ? (
        <Svg width={size} height={size} style={StyleSheet.absoluteFill} pointerEvents="none">
          <Defs>
            <LinearGradient id="avatarGloss" x1="0.15" y1="0" x2="0.85" y2="1">
              <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0.22" />
              <Stop offset="0.44" stopColor="#FFFFFF" stopOpacity="0" />
            </LinearGradient>
          </Defs>
          <Circle cx={radius} cy={radius} r={radius} fill="url(#avatarGloss)" />
          {/* Hairline rim, inset so the stroke lands inside the disc. */}
          <Circle
            cx={radius}
            cy={radius}
            r={radius - 1}
            fill="none"
            stroke="rgba(255,255,255,0.16)"
            strokeWidth={1.5}
          />
        </Svg>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  contact: {
    position: 'absolute',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  art: {
    ...StyleSheet.absoluteFillObject,
  },
});

/**
 * Memoized: the family tree and contacts list mount dozens of these at once,
 * and regenerating the SVG string on every parent render is the expensive part.
 */
const VectorAvatar = React.memo(VectorAvatarImpl);
VectorAvatar.displayName = 'VectorAvatar';

export default VectorAvatar;
