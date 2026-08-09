/**
 * Game mode picker — the pace of a life, chosen before it starts.
 *
 * Two modes, and the copy has to carry one idea above all: **the game itself is
 * identical**. Story mode is not a shallower simulation, an easy mode, or a
 * skip button — every week still runs in full, so the same bills land, the same
 * interest accrues and the same market moves. Only the number of weeks one tap
 * buys changes. Players who suspect a "fast mode" is cutting corners will avoid
 * it, so the card says so plainly rather than implying it with an icon.
 *
 * Classic is listed first and is what an unset value resolves to, because it is
 * the original game and the pace every existing save is already playing at.
 *
 * Styling note: full `borderWidth` on all four sides, never a one-sided colored
 * stripe — see Hard Rule #7 in CLAUDE.md.
 */

import React, { useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { CalendarDays, FastForward, Check } from 'lucide-react-native';
import type { GameMode } from '@/contexts/game/types';
import { resolveGameMode, STORY_MODE_WEEKS_PER_TAP } from '@/lib/gameMode/mode';
import { getThemeColors, accent } from '@/lib/config/theme';
import { scale, fontScale, responsiveSpacing } from '@/utils/scaling';

interface GameModePickerProps {
  /** Current selection. Undefined resolves to classic. */
  value: GameMode | undefined;
  onChange: (mode: GameMode) => void;
  darkMode?: boolean;
}

interface ModeOption {
  id: GameMode;
  title: string;
  tempo: string;
  blurb: string;
  Icon: typeof CalendarDays;
}

const MODES: ModeOption[] = [
  {
    id: 'classic',
    title: 'Classic',
    tempo: '1 tap = 1 week',
    blurb:
      'The original pace. Every week is yours to steer — watch the interest land, catch each bill, react as it happens.',
    Icon: CalendarDays,
  },
  {
    id: 'story',
    title: 'Story',
    tempo: `1 tap = ${STORY_MODE_WEEKS_PER_TAP} weeks`,
    blurb:
      'A year at a time, with a recap of everything that happened. The simulation is exactly the same — every week still runs in full.',
    Icon: FastForward,
  },
];

export function GameModePicker({ value, onChange, darkMode = true }: GameModePickerProps) {
  const c = getThemeColors(darkMode);
  // `getThemeColors` carries surfaces and text only; the selection colour comes
  // from the semantic accent palette, per CLAUDE.md §5.
  const selectedColor = accent.info;
  const active = resolveGameMode(value);

  const handlePress = useCallback((mode: GameMode) => () => onChange(mode), [onChange]);

  return (
    <View style={styles.wrap}>
      <Text style={[styles.heading, { color: c.text }]}>Choose your pace</Text>
      <Text style={[styles.sub, { color: c.textSecondary }]}>
        You can&apos;t change this later, so pick the one you want to live in.
      </Text>

      <View style={styles.options}>
        {MODES.map((mode) => {
          const selected = active === mode.id;
          const Icon = mode.Icon;
          return (
            <TouchableOpacity
              key={mode.id}
              onPress={handlePress(mode.id)}
              activeOpacity={0.85}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={`${mode.title} mode, ${mode.tempo}`}
              style={[
                styles.card,
                {
                  backgroundColor: selected ? selectedColor + '1A' : c.surface,
                  borderColor: selected ? selectedColor : c.border,
                },
              ]}
            >
              <View style={styles.cardHead}>
                <Icon size={scale(18)} color={selected ? selectedColor : c.textSecondary} />
                <Text style={[styles.cardTitle, { color: c.text }]}>{mode.title}</Text>
                {selected ? <Check size={scale(16)} color={selectedColor} /> : null}
              </View>
              <Text style={[styles.tempo, { color: selected ? selectedColor : c.textSecondary }]}>
                {mode.tempo}
              </Text>
              <Text style={[styles.blurb, { color: c.textSecondary }]}>{mode.blurb}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: responsiveSpacing.md,
    paddingTop: responsiveSpacing.sm,
    paddingBottom: responsiveSpacing.md,
    gap: responsiveSpacing.xs,
  },
  heading: {
    fontSize: fontScale(17),
    fontWeight: '700',
  },
  sub: {
    fontSize: fontScale(12.5),
    marginBottom: responsiveSpacing.xs,
  },
  options: {
    gap: responsiveSpacing.sm,
  },
  card: {
    borderWidth: 1,
    borderRadius: scale(12),
    padding: responsiveSpacing.md,
    gap: scale(4),
  },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(8),
  },
  cardTitle: {
    fontSize: fontScale(15.5),
    fontWeight: '700',
    flex: 1,
  },
  tempo: {
    fontSize: fontScale(12),
    fontWeight: '600',
  },
  blurb: {
    fontSize: fontScale(12.5),
    lineHeight: fontScale(17),
  },
});

export default GameModePicker;
