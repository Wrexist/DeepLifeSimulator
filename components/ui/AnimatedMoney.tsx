import React from 'react';
import { Text, StyleSheet, TextStyle } from 'react-native';

interface AnimatedMoneyProps {
  value: number;
  /** @deprecated Retained for call-site compatibility; the value now snaps instantly. */
  duration?: number;
  style?: TextStyle;
  prefix?: string;
  suffix?: string;
  precision?: number;
  useNativeDriver?: boolean;
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
 * Money display that snaps INSTANTLY to the new value - no count-up animation.
 * Players expect money to change the moment an action applies it; the previous
 * 300ms–1000ms count made spends/earnings feel laggy, and re-installed an
 * Animated listener on every change (per-tick churn flagged in prior audits).
 * `duration`/`precision`/`useNativeDriver` are accepted but ignored for
 * call-site compatibility.
 */
export default function AnimatedMoney({
  value,
  style,
  prefix = '$',
  suffix = '',
}: AnimatedMoneyProps) {
  return (
    <Text maxFontSizeMultiplier={1.3}
      style={[styles.text, style]}
      numberOfLines={1}
      adjustsFontSizeToFit={true}
      minimumFontScale={0.7}
    >
      {prefix}
      {formatNumber(value)}
      {suffix}
    </Text>
  );
}

/** Backward-compatible alias; also renders instantly now. */
export function AnimatedMoneyNative({
  value,
  style,
  prefix = '$',
  suffix = '',
}: Omit<AnimatedMoneyProps, 'useNativeDriver'>) {
  return (
    <Text maxFontSizeMultiplier={1.3}
      style={[styles.text, style]}
      numberOfLines={1}
      adjustsFontSizeToFit={true}
      minimumFontScale={0.7}
    >
      {prefix}
      {formatNumber(value)}
      {suffix}
    </Text>
  );
}

const styles = StyleSheet.create({
  text: {
    fontWeight: '600',
    color: '#1E293B',
  },
});
