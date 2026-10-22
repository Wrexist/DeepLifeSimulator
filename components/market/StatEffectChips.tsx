/**
 * StatEffectChips - the one way a Market card states what it does to your stats.
 *
 * Food cards used to print an undifferentiated stack of identical blue lines
 * ("+3 Health / +2 Energy / +2 Happiness"), which reads as body copy rather than
 * as an effect, and shares no visual language with the HUD the numbers land in.
 * Each stat now carries the identity the HUD gives it - Heart/red for health,
 * Zap/blue for energy, Smile/amber for happiness (the same hex values
 * `components/TopStatsBar.tsx` uses for those bars), plus Dumbbell/purple for
 * fitness, which only the gym grants.
 *
 * House rules: full 4-side borders (Hard Rule #7 - no one-sided accent stripes),
 * every dimension through `scale()` / `fontScale()`, and both themes handled via
 * the `darkMode` flag the Market screen already threads.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Dumbbell, Heart, Smile, Zap } from 'lucide-react-native';
import { fontScale, responsiveBorderRadius, scale } from '@/utils/scaling';
import { useTranslation } from '@/hooks/useTranslation';
import { colors } from '@/lib/config/theme';

export type StatEffectKey = 'health' | 'energy' | 'happiness' | 'fitness';

export interface StatEffect {
  key: StatEffectKey;
  /** Signed delta. Zero entries are dropped - a "+0 Health" chip is noise. */
  value: number;
}

interface StatMeta {
  color: string;
  /** Label colour on a dark card (lighter tint of `color`, >= 4.5:1). */
  textDark: string;
  labelKey: string;
  fallback: string;
  icon: React.ComponentType<{ size?: number; color?: string }>;
}

// Colors are the HUD's per-stat identity, not a second palette: health and
// energy match the gradient heads in TopStatsBar, happiness matches its bar.
const STAT_META: Record<StatEffectKey, StatMeta> = {
  // `textDark` is the lighter tint of the same hue for the chip LABEL on a dark
  // card: the saturated identity colour on its own 16% tint measured 3.9-4.2:1
  // at 11pt (fitness/energy/health). Icon and border keep the identity colour.
  health: { color: '#EF4444', textDark: '#F87171', labelKey: 'game.health', fallback: 'Health', icon: Heart },
  energy: { color: '#3B82F6', textDark: '#60A5FA', labelKey: 'game.energy', fallback: 'Energy', icon: Zap },
  happiness: { color: '#F59E0B', textDark: '#F59E0B', labelKey: 'game.happiness', fallback: 'Happiness', icon: Smile },
  fitness: { color: '#A855F7', textDark: '#C084FC', labelKey: 'game.fitness', fallback: 'Fitness', icon: Dumbbell },
};

function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

interface StatEffectChipsProps {
  effects: StatEffect[];
  darkMode?: boolean;
  /** Optional muted caption above the row, e.g. "Restores" or "Per week". */
  caption?: string;
}

export default function StatEffectChips({ effects, darkMode = false, caption }: StatEffectChipsProps) {
  const { t } = useTranslation();
  const shown = effects.filter((e) => Number.isFinite(e.value) && e.value !== 0);
  if (shown.length === 0) return null;

  return (
    <View style={styles.wrap}>
      {caption ? (
        <Text style={[styles.caption, darkMode ? styles.captionDark : styles.captionLight]}>{caption}</Text>
      ) : null}
      <View style={styles.row}>
        {shown.map((effect) => {
          const meta = STAT_META[effect.key];
          const Icon = meta.icon;
          // `t` echoes the key back when a language is missing the string, and
          // "game.health" on a chip is worse than the English word.
          const translated = t(meta.labelKey);
          const label = !translated || translated === meta.labelKey ? meta.fallback : translated;
          const sign = effect.value > 0 ? '+' : '';
          return (
            <View
              key={effect.key}
              style={[
                styles.chip,
                {
                  backgroundColor: hexToRgba(meta.color, darkMode ? 0.16 : 0.1),
                  // Full border on all four sides - Hard Rule #7.
                  borderColor: hexToRgba(meta.color, darkMode ? 0.4 : 0.3),
                },
              ]}
              accessibilityRole="text"
              accessibilityLabel={`${sign}${effect.value} ${label}`}
            >
              <Icon size={scale(11)} color={meta.color} />
              <Text style={[styles.chipText, { color: darkMode ? meta.textDark : meta.color }]} numberOfLines={1}>
                {sign}{effect.value} {label}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: scale(6),
    gap: scale(4),
  },
  caption: {
    fontSize: fontScale(10),
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: fontScale(0.5),
  },
  captionDark: {
    // Was a low-alpha gray at ~2.4-3.9:1; the token passes AA on dark cards.
    color: colors.dark.textMuted,
  },
  captionLight: {
    color: 'rgba(51, 65, 85, 0.55)',
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: scale(6),
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(4),
    paddingHorizontal: scale(8),
    paddingVertical: scale(3),
    borderRadius: responsiveBorderRadius.full,
    borderWidth: 1,
  },
  chipText: {
    fontSize: fontScale(11),
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
});
