/**
 * Gradient — a drop-in `LinearGradient` that actually renders a gradient.
 *
 * ## Why
 *
 * `expo-linear-gradient` is banned app-wide: direct imports hard-abort on iOS 26
 * TurboModule init (P0-7/P0-8, `tasks/critical-bugs-2026-05-29.md`). Every call
 * site was swapped to `LinearGradientFallback`, which takes `colors[0]` and
 * paints it as a flat background — a correct crash fix, and a silent visual
 * regression nobody swept up afterwards.
 *
 * The result: **113 `colors={[…]}` call sites, 75 of them passing two or more
 * DISTINCT colours**, every one rendering as a single flat slab. Hero cards,
 * the settings chrome, the HUD, the paywall, the jail screen — all designed as
 * gradients, all shipping flat.
 *
 * `react-native-svg` draws a real interpolated gradient, is already a direct
 * dependency, and is a different library from the crashing Expo module —
 * `GradientButton`, `ProgressRing` and `ImageScrim` all use it today. This wraps
 * it in the **exact prop signature of `LinearGradient`**, so fixing a call site
 * is a one-line import change with no other edit.
 *
 * ```diff
 * - import LinearGradientFallback from '@/components/fallbacks/LinearGradientFallback';
 * - const LinearGradient = LinearGradientFallback;
 * + import Gradient from '@/components/ui/Gradient';
 * + const LinearGradient = Gradient;
 * ```
 *
 * ## Anatomy
 *
 * Outer view carries the caller's style (so shadows keep working — never put
 * `overflow: 'hidden'` on a shadow view); an absolutely-positioned inner view
 * clips the SVG to the caller's `borderRadius`; children render above both.
 * Layout is untouched, because the painting layer is absolute.
 */

import React, { useMemo } from 'react';
import { View, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Defs, LinearGradient as SvgLinearGradient, Rect, Stop } from 'react-native-svg';

export interface GradientProps {
  /** Two or more colours. Hex, `rgb()`, `rgba()` and `transparent` all work. */
  colors?: readonly (string | number)[];
  /** Unit square, matching expo-linear-gradient. Defaults to a vertical fade. */
  start?: { x: number; y: number } | null;
  end?: { x: number; y: number } | null;
  /** Optional per-colour stops in 0–1. Defaults to an even spread. */
  locations?: readonly number[] | null;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
  pointerEvents?: ViewStyle['pointerEvents'];
  // Tolerate the extra props scattered across the existing call sites
  // (accessibility, testID, …) without forcing an edit at each one.
  [key: string]: unknown;
}

/** SVG needs colour and alpha separately, so `rgba()` has to be split. */
function splitColor(input: unknown): { color: string; opacity: number } {
  if (typeof input !== 'string') return { color: '#000000', opacity: 1 };
  const value = input.trim();

  if (value === 'transparent') return { color: '#000000', opacity: 0 };

  const rgba = value.match(
    /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/i
  );
  if (rgba) {
    const [, r, g, b, a] = rgba;
    return {
      color: `rgb(${Math.round(+r)}, ${Math.round(+g)}, ${Math.round(+b)})`,
      opacity: a === undefined ? 1 : Math.max(0, Math.min(1, Number(a))),
    };
  }

  // 8-digit hex carries alpha in the last pair; SVG stopColor does not read it.
  const hex8 = value.match(/^#([0-9a-f]{6})([0-9a-f]{2})$/i);
  if (hex8) {
    return { color: `#${hex8[1]}`, opacity: parseInt(hex8[2], 16) / 255 };
  }

  return { color: value, opacity: 1 };
}

/** Unique id per instance — SVG `<Defs>` ids share one namespace on web. */
let _gid = 0;

export default function Gradient({
  colors,
  start,
  end,
  locations,
  style,
  children,
  pointerEvents,
  ...rest
}: GradientProps) {
  const gid = useMemo(() => `grad-${(_gid += 1)}`, []);

  const stops = useMemo(() => {
    const list = Array.isArray(colors) ? colors.filter((c) => c != null) : [];
    if (list.length === 0) return [];
    // A single colour is a legitimate (if pointless) gradient — duplicate it so
    // the SVG still has two stops and paints a flat fill, matching the old
    // fallback exactly for those call sites.
    const source = list.length === 1 ? [list[0], list[0]] : list;
    const count = source.length;

    return source.map((c, i) => {
      const { color, opacity } = splitColor(c);
      const offset =
        Array.isArray(locations) && typeof locations[i] === 'number'
          ? Math.max(0, Math.min(1, locations[i] as number))
          : i / (count - 1);
      return { key: `${i}`, offset, color, opacity };
    });
  }, [colors, locations]);

  // expo-linear-gradient's default is top→bottom; keep that so a call site that
  // omits start/end looks the way its author expected.
  const x1 = start?.x ?? 0;
  const y1 = start?.y ?? 0;
  const x2 = end?.x ?? 0;
  const y2 = end?.y ?? 1;

  // Read the radius off the caller's style so the paint clips to the same
  // corners the old flat backgroundColor did.
  const flat = StyleSheet.flatten(style) as ViewStyle | undefined;
  const radius = typeof flat?.borderRadius === 'number' ? flat.borderRadius : 0;

  return (
    <View style={style} pointerEvents={pointerEvents} {...rest}>
      {stops.length > 0 && (
        <View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            radius > 0 && { borderRadius: radius },
            styles.clip,
          ]}
        >
          <Svg width="100%" height="100%" preserveAspectRatio="none" viewBox="0 0 1 1">
            <Defs>
              <SvgLinearGradient id={gid} x1={String(x1)} y1={String(y1)} x2={String(x2)} y2={String(y2)}>
                {stops.map((s) => (
                  <Stop key={s.key} offset={String(s.offset)} stopColor={s.color} stopOpacity={s.opacity} />
                ))}
              </SvgLinearGradient>
            </Defs>
            <Rect x="0" y="0" width="1" height="1" fill={`url(#${gid})`} />
          </Svg>
        </View>
      )}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  // On the INNER view only. The outer keeps the caller's shadow intact.
  clip: { overflow: 'hidden' },
});
