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
 * ── Layout ────────────────────────────────────────────────────────────────
 * Each card reads left-to-right as: what it is (icon badge) → what it does
 * (title + tempo chip) → what that feels like (blurb) → whether it is chosen
 * (radio). The radio matters: two cards where selection is signalled only by a
 * border colour is a state a colourblind player has to infer, so the chosen one
 * carries an explicit filled check as well as the border and tint.
 *
 * The tempo — "1 tap = 1 week" vs "1 tap = up to 52 weeks" — is set as a chip
 * rather than body text because it is the single fact that decides the choice,
 * and it should survive someone skimming without reading a word of prose. The
 * "up to" is load-bearing: a story year ends when the life needs its player.
 *
 * Styling note: full `borderWidth` on all four sides, never a one-sided colored
 * stripe — see Hard Rule #7 in CLAUDE.md.
 */

import React, { useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { CalendarDays, FastForward, Check, Compass } from 'lucide-react-native';
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
    // NOT "1 tap = 52 weeks". That was the original promise and measurement
    // disproved it: a year runs until the life needs its player — an illness,
    // a danger line, a decision — so a quiet year is 52 weeks and an eventful
    // one is eleven. Promising the maximum and delivering the median is how a
    // working feature reads as broken.
    tempo: `1 tap = up to ${STORY_MODE_WEEKS_PER_TAP} weeks`,
    blurb:
      // Leads with the REAL mechanic rather than the maximum span. Measured, a
      // year runs 7-16 weeks far more often than 52, because it hands back the
      // moment something needs deciding. Selling "52" and delivering 11 makes a
      // working feature read as broken; selling "until your life needs you" and
      // delivering 11 is the feature doing exactly what it said.
      'Time runs on until your life needs you — an illness, a decision, a warning — then hands back with the story of what happened. The simulation is exactly the same; every week still runs in full.',
    Icon: FastForward,
  },
];

export function GameModePicker({ value, onChange, darkMode = true }: GameModePickerProps) {
  const c = getThemeColors(darkMode);
  // `getThemeColors` carries surfaces and text only; the selection colour comes
  // from the semantic accent palette, per CLAUDE.md §5.
  const hi = accent.info;
  const active = resolveGameMode(value);

  const handlePress = useCallback((mode: GameMode) => () => onChange(mode), [onChange]);

  return (
    <View style={styles.wrap}>
      {/* Separates the pace choice from the scenario list above it — they are
          two different decisions and were reading as one long column. */}
      <View style={[styles.divider, { backgroundColor: c.border }]} />

      <View style={styles.headerRow}>
        <View style={[styles.headerBadge, { backgroundColor: hi + '1F', borderColor: hi + '4D' }]}>
          <Compass size={scale(18)} color={hi} />
        </View>
        <View style={styles.headerText}>
          <Text style={[styles.heading, { color: c.text }]}>Choose your pace</Text>
          <Text style={[styles.sub, { color: c.textSecondary }]}>
            You can&apos;t change this later, so pick the one you want to live in.
          </Text>
        </View>
      </View>

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
              accessibilityLabel={`${mode.title} mode, ${mode.tempo}. ${mode.blurb}`}
              style={[
                styles.card,
                {
                  backgroundColor: selected ? hi + '14' : c.surface,
                  borderColor: selected ? hi : c.border,
                },
              ]}
            >
              <View
                style={[
                  styles.iconBadge,
                  {
                    backgroundColor: selected ? hi + '26' : c.surfaceElevated,
                    borderColor: selected ? hi + '59' : c.border,
                  },
                ]}
              >
                <Icon size={scale(22)} color={selected ? hi : c.textSecondary} />
              </View>

              <View style={styles.cardBody}>
                <View style={styles.titleRow}>
                  <Text style={[styles.cardTitle, { color: c.text }]}>{mode.title}</Text>
                  <View
                    style={[
                      styles.radio,
                      selected
                        ? { backgroundColor: hi, borderColor: hi }
                        : { borderColor: c.borderStrong },
                    ]}
                  >
                    {selected ? <Check size={scale(13)} color="#FFFFFF" strokeWidth={3} /> : null}
                  </View>
                </View>

                <View style={[styles.tempoChip, { backgroundColor: hi + '1F' }]}>
                  <Text style={[styles.tempoText, { color: hi }]}>{mode.tempo}</Text>
                </View>

                <Text style={[styles.blurb, { color: c.textSecondary }]}>{mode.blurb}</Text>
              </View>
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
    gap: responsiveSpacing.md,
  },
  divider: {
    height: 1,
    width: '100%',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(12),
  },
  headerBadge: {
    width: scale(40),
    height: scale(40),
    borderRadius: scale(20),
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: { flex: 1, gap: scale(3) },
  heading: {
    fontSize: fontScale(18),
    fontWeight: '700',
  },
  sub: {
    fontSize: fontScale(12.5),
    lineHeight: fontScale(17),
  },
  options: {
    gap: responsiveSpacing.sm,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: scale(14),
    borderWidth: 1,
    borderRadius: scale(16),
    padding: responsiveSpacing.md,
  },
  iconBadge: {
    width: scale(48),
    height: scale(48),
    borderRadius: scale(24),
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: { flex: 1, gap: scale(7) },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: scale(8),
  },
  cardTitle: {
    fontSize: fontScale(18),
    fontWeight: '700',
    flexShrink: 1,
  },
  radio: {
    width: scale(24),
    height: scale(24),
    borderRadius: scale(12),
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tempoChip: {
    alignSelf: 'flex-start',
    borderRadius: scale(8),
    paddingHorizontal: scale(10),
    paddingVertical: scale(4),
  },
  tempoText: {
    fontSize: fontScale(12.5),
    fontWeight: '700',
  },
  blurb: {
    fontSize: fontScale(12.5),
    lineHeight: fontScale(18),
  },
});

export default GameModePicker;
