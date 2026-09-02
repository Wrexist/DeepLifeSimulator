import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, TextStyle } from 'react-native';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { animation } from '@/lib/config/theme';

interface AnimatedMoneyProps {
  value: number;
  /** @deprecated Retained for call-site compatibility; the value never lags. */
  duration?: number;
  style?: TextStyle;
  prefix?: string;
  suffix?: string;
  precision?: number;
  useNativeDriver?: boolean;
  /** Opt out of the change emphasis (e.g. a static summary row). */
  emphasizeChange?: boolean;
}

function formatNumber(num: number): string {
  const a = Math.floor(Math.abs(num) || 0);
  const sign = num < 0 ? '-' : '';

  let formatted: string;
  if (a >= 1_000_000_000_000_000) {
    formatted = `${Math.floor(a / 1_000_000_000_000_000)}Q`;
  } else if (a >= 1_000_000_000_000) {
    formatted = `${Math.floor(a / 1_000_000_000_000)}T`;
  } else if (a >= 1_000_000_000) {
    formatted = `${Math.floor(a / 1_000_000_000)}B`;
  } else if (a >= 1_000_000) {
    formatted = `${Math.floor(a / 1_000_000)}M`;
  } else if (a > 10_000) {
    formatted = `${Math.floor(a / 1_000)}K`;
  } else {
    formatted = a.toLocaleString();
  }

  return `${sign}${formatted}`;
}

/**
 * Money display: the figure is ALWAYS instantly true, and a change is
 * emphasised rather than animated toward.
 *
 * This component used to count up over 300-1000ms. That was removed for two
 * good reasons, both preserved here: a count-up shows the player a number that
 * is WRONG for the length of the animation (money must read as correct the
 * moment an action applies it), and the old implementation re-installed an
 * Animated listener on every change, which is per-tick churn on the HUD.
 *
 * So the value still snaps. What was missing was any acknowledgement that it
 * moved at all - earning money, the core loop, changed a digit silently. The
 * emphasis is a short scale pop, driven by ONE Animated.Value on the native
 * driver with no listener attached.
 *
 * There is deliberately NO colour tint. A direction tint (up green, down red)
 * used to override the text colour for 650ms, and this component has exactly
 * one call site: the HUD's money chip, which sits on a GREEN gradient. So a
 * gain painted green text onto a green pill and the player could not read
 * their own balance for two thirds of a second - reported from TestFlight. The
 * tint had no surface where it was legible, so it is gone rather than
 * conditional: the text keeps whatever colour its caller sets (white on the
 * chip). Direction is already carried, legibly, by the toast and the
 * per-action result line. If this component ever lands on a neutral surface
 * where a tint would read, add it back deliberately - and check the contrast
 * against that surface first.
 */
function MoneyText({
  value,
  style,
  prefix = '$',
  suffix = '',
  emphasizeChange = true,
}: Omit<AnimatedMoneyProps, 'useNativeDriver'>) {
  const reducedMotion = useReducedMotion();
  const pop = useRef(new Animated.Value(1)).current;
  const prevValue = useRef(value);

  useEffect(() => {
    const previous = prevValue.current;
    prevValue.current = value;

    // Never emphasise the first paint - mounting is not a change.
    if (!emphasizeChange || previous === value) return;
    // Sub-dollar drift (interest ticks) is not worth a flash.
    if (Math.abs(value - previous) < 1) return;

    if (reducedMotion) return;
    pop.setValue(1);
    const anim = Animated.sequence([
      Animated.timing(pop, {
        toValue: 1.12,
        duration: animation.micro,
        useNativeDriver: true,
      }),
      Animated.spring(pop, {
        toValue: 1,
        ...animation.spring.gentle,
        useNativeDriver: true,
      }),
    ]);
    anim.start();
    return () => anim.stop();
  }, [value, emphasizeChange, reducedMotion, pop]);

  return (
    <Animated.Text
      maxFontSizeMultiplier={1.3}
      style={[
        styles.text,
        style,
        // Scale about the text's own box; the HUD lays these out in a row, so
        // a transform (not a layout property) keeps neighbours from shifting.
        { transform: [{ scale: pop }] },
      ]}
      numberOfLines={1}
      adjustsFontSizeToFit={true}
      minimumFontScale={0.7}
    >
      {prefix}
      {formatNumber(value)}
      {suffix}
    </Animated.Text>
  );
}

export default function AnimatedMoney(props: AnimatedMoneyProps) {
  return <MoneyText {...props} />;
}


const styles = StyleSheet.create({
  text: {
    fontWeight: '600',
    color: '#1E293B',
  },
});
