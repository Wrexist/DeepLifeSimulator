/** Shared matte illustration renderer for portraits, editable faces and NPCs. */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, AppState, Easing, StyleSheet, View } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { colors } from '@/lib/config/theme';
import { createAvatar } from '@dicebear/core';
// Imported from its OWN package, not from `@dicebear/collection`. The
// collection is a barrel that re-exports all 30 styles (~6 MB on disk), and
// relying on the bundler to shake 29 of them out of a release build is not a
// bet worth taking. This pulls one 308 KB package.
import * as avataaars from '@dicebear/avataaars';
import { buildStyleOptions } from '@/lib/avatar/style';
import { ART_ZOOM, BLINK, frameArt, nextBlinkDelay } from '@/lib/avatar/depth';
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
  /** Draws the shared matte surface behind the art. */
  backdrop?: boolean;
  /** Uses a circular crop; otherwise a rounded square. */
  circular?: boolean;
  /**
   * Blink and breathe.
   *
   * OFF by default, and that is deliberate: a contacts list or a family tree
   * mounts dozens of avatars, and dozens of independent timers is a battery
   * and jank cost for motion nobody is looking at. Turn it on for the one
   * avatar a screen is ABOUT - the creator's hero, the identity card.
   */
  alive?: boolean;
  /**
   * How tightly the art is framed on the head. Defaults to `ART_ZOOM`, the
   * portrait framing every avatar in the game uses.
   *
   * Pulled back only by the appearance editor's OUTFIT previews. The default
   * framing centres the head, so a circular thumbnail shows a sliver of collar
   * and nothing else - four different outfits rendered as four identical
   * headshots, which is the exact "you cannot see what you are choosing"
   * problem that editor exists to fix. Everything else wants the portrait.
   */
  zoom?: number;
}

function VectorAvatarImpl({
  config,
  sex,
  age = 25,
  size = 120,
  backdrop = true,
  circular = true,
  alive = false,
  zoom = ART_ZOOM,
}: VectorAvatarProps) {
  const reducedMotion = useReducedMotion();
  const [active, setActive] = useState(AppState.currentState !== 'background' && AppState.currentState !== 'inactive');
  useEffect(() => {
    if (!alive) return;
    setActive(AppState.currentState !== 'background' && AppState.currentState !== 'inactive');
    const subscription = AppState.addEventListener('change', state => setActive(state === 'active'));
    return () => subscription.remove();
  }, [alive]);
  const animate = alive && !reducedMotion && active;

  const render = useMemo(() => {
    const safe = normalizeAvatar(config);
    const effects = ageEffects(age, sex);
    const options = buildStyleOptions(safe, sex, effects);
    // Proportions run on the RAW art, before framing: they move the art's own
    // layer groups, which `frameArt` then wraps as a whole.
    const build = (extra?: Record<string, unknown>) =>
      frameArt(
        applyChildProportions(createAvatar(avataaars, { size, ...options, ...extra }).toString(), age),
        zoom
      );
    return {
      open: build(),
      // Built once alongside the open frame rather than on each blink, so a
      // blink is a string swap and not a regeneration.
      closed: animate ? build({ eyes: ['closed'] }) : null,
    };
  }, [config, sex, age, size, animate, zoom]);

  const [blinking, setBlinking] = useState(false);
  useEffect(() => {
    setBlinking(false);
    if (!animate) return;
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
  }, [animate]);

  // A slow breath. Native-driven, so it costs nothing on the JS thread.
  const breath = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!animate) {
      breath.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breath, { toValue: 1, duration: 1900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(breath, { toValue: 0, duration: 1900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [animate, breath]);

  const xml = animate && blinking && render.closed ? render.closed : render.open;
  const radius = size / 2;
  const scale = breath.interpolate({ inputRange: [0, 1], outputRange: [1, 1.018] });

  return (
    <View style={[styles.root, {
      width: size, height: size,
      borderRadius: circular ? radius : size / 5,
      backgroundColor: backdrop ? colors.dark.surfaceElevated : 'transparent',
    }]}>
      <Animated.View style={[styles.art, animate ? { transform: [{ scale }] } : null]}>
        <SvgXml xml={xml} width={size} height={size} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
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
