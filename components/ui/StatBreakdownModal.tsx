/**
 * StatBreakdownModal - the shared chassis for the HUD stat breakdown modals
 * (Energy / Health / Happiness / Bank / Money / Gems).
 *
 * Those six modals shipped byte-identical stylesheets and the same JSX shape:
 * hero "total" card -> income section -> drain section -> "How X Works"
 * summary. This component owns that template ONCE; each modal keeps only its
 * data derivation and copy, and hands the result over as plain props.
 *
 * Purely presentational - no game-state access here. Built on BaseModal so the
 * chrome (overlay, header, close button, theming) stays consistent with every
 * other modal in the app.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { TrendingDown, TrendingUp } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import { scale, fontScale, responsiveBorderRadius } from '@/utils/scaling';
import { getPlatformShadows } from '@/utils/glassmorphismStyles';
import BaseModal from '@/components/ui/BaseModal';
import { useTheme } from '@/hooks/useTheme';

export interface StatBreakdownHero {
  label: string;
  /** Already-formatted headline value ("72 / 100", "$1.2M", "1,250"). */
  valueText: string;
  /** Overrides the default theme text colour (e.g. amber for Bank, green for Cash). */
  valueColor?: string;
  /** Font scale for the headline value. Default 28 (Gems uses 36). */
  valueFontSize?: number;
  /**
   * Lines under the headline. `emphasis` renders the larger/bolder style the
   * money modals use for the exact-currency line; plain lines render the small
   * "Projected Next Week" style.
   */
  subLines?: { text: string; emphasis?: boolean }[];
  /** The coloured "+3.0 Energy" / "-2.0 Health" net-change line. */
  netChange?: { text: string; positive: boolean };
}

export interface StatBreakdownEntry {
  label: string;
  /** Already-formatted value ("+30", "-7", "$1,234"). */
  valueText: string;
  /**
   * Colours the value green (true) / red (false). Leave undefined for the
   * default theme text colour (Bank's neutral balances).
   */
  positive?: boolean;
  icon: LucideIcon;
  /** Icon-container tint; also the icon colour unless `iconColor` overrides it. */
  color: string;
  /** Tint just the glyph (Bank's stock rows: green chip, red glyph on a loss). */
  iconColor?: string;
  /** One or more small description lines under the label. */
  description?: string | string[];
  /** Small green/red line under the value (Bank's gain/loss). */
  subValue?: { text: string; positive: boolean };
  /** Monospace footnote under the whole row (Bank's exact-currency line). */
  monoFootnote?: string;
}

export interface StatBreakdownSection {
  title: string;
  /**
   * 'income' -> TrendingUp header icon (green #10B981)
   * 'drain'  -> TrendingDown header icon (red #EF4444)
   * 'neutral' (default when `icon` is given) -> the supplied icon/colour.
   */
  kind?: 'income' | 'drain' | 'neutral';
  /** Header icon for 'neutral' sections (e.g. Bank's PiggyBank). */
  icon?: LucideIcon;
  iconColor?: string;
  entries: StatBreakdownEntry[];
}

interface StatBreakdownModalProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  hero: StatBreakdownHero;
  sections?: StatBreakdownSection[];
  /** The "How X Works" / "About X" card at the bottom. */
  summary?: { title: string; text: React.ReactNode };
  /** Anything a specific modal needs beyond the template; rendered between sections and summary. */
  children?: React.ReactNode;
}

export default function StatBreakdownModal({
  visible,
  onClose,
  title,
  hero,
  sections,
  summary,
  children,
}: StatBreakdownModalProps) {
  const { theme, isDark } = useTheme();

  const cardBg = isDark ? '#334155' : '#F1F5F9';
  const itemBg = isDark ? '#334155' : '#F8FAFC';
  const itemBorder = isDark ? '#475569' : '#E2E8F0';

  const renderSectionIcon = (section: StatBreakdownSection) => {
    if (section.kind === 'income') {
      return <TrendingUp size={scale(18)} color="#10B981" />;
    }
    if (section.kind === 'drain') {
      return <TrendingDown size={scale(18)} color="#EF4444" />;
    }
    if (section.icon) {
      const Icon = section.icon;
      return <Icon size={scale(18)} color={section.iconColor ?? theme.text} />;
    }
    return null;
  };

  return (
    <BaseModal visible={visible} onClose={onClose} title={title}>
      {/* Hero "total" card */}
      <View style={[styles.totalCard, { backgroundColor: cardBg }]}>
        <Text style={[styles.totalLabel, { color: theme.textSecondary }]}>{hero.label}</Text>
        <Text
          style={[
            styles.totalValue,
            hero.valueFontSize != null && { fontSize: fontScale(hero.valueFontSize) },
            { color: hero.valueColor ?? theme.text },
          ]}
        >
          {hero.valueText}
        </Text>
        {((hero.subLines && hero.subLines.length > 0) || hero.netChange) && (
          <View style={styles.totalBreakdown}>
            {(hero.subLines ?? []).map((line, index) => (
              <Text
                key={index}
                style={[
                  line.emphasis ? styles.exactValue : styles.totalBreakdownText,
                  { color: theme.textSecondary },
                ]}
              >
                {line.text}
              </Text>
            ))}
            {hero.netChange && (
              <Text
                style={[
                  styles.netChangeText,
                  hero.netChange.positive ? styles.netChangePositive : styles.netChangeNegative,
                ]}
              >
                {hero.netChange.text}
              </Text>
            )}
          </View>
        )}
      </View>

      {/* Sections */}
      {(sections ?? []).map((section, sectionIndex) => (
        <View key={sectionIndex} style={styles.section}>
          <View style={styles.sectionHeader}>
            {renderSectionIcon(section)}
            <Text style={[styles.sectionTitle, { color: theme.text }]}>{section.title}</Text>
          </View>

          {section.entries.map((entry, index) => {
            const Icon = entry.icon;
            const descriptions =
              entry.description == null
                ? []
                : Array.isArray(entry.description)
                  ? entry.description
                  : [entry.description];
            const valueStyle =
              entry.positive == null
                ? { color: theme.text }
                : entry.positive
                  ? styles.positiveValue
                  : styles.negativeValue;

            return (
              <View
                key={index}
                style={[styles.itemCard, { backgroundColor: itemBg, borderColor: itemBorder }]}
              >
                <View style={styles.itemHeader}>
                  <View style={[styles.itemIconContainer, { backgroundColor: `${entry.color}20` }]}>
                    <Icon size={scale(16)} color={entry.iconColor ?? entry.color} />
                  </View>
                  <View style={styles.itemInfo}>
                    <Text style={[styles.itemLabel, { color: theme.text }]}>{entry.label}</Text>
                    {descriptions.map((description, descriptionIndex) => (
                      <Text
                        key={descriptionIndex}
                        style={[styles.itemDescription, { color: theme.textSecondary }]}
                      >
                        {description}
                      </Text>
                    ))}
                  </View>
                  {entry.subValue ? (
                    <View style={styles.itemValueContainer}>
                      <Text style={[styles.itemValue, styles.itemValueStacked, valueStyle]}>
                        {entry.valueText}
                      </Text>
                      <Text
                        style={[
                          styles.subValueText,
                          entry.subValue.positive ? styles.positiveValue : styles.negativeValue,
                        ]}
                      >
                        {entry.subValue.text}
                      </Text>
                    </View>
                  ) : (
                    <Text style={[styles.itemValue, valueStyle]}>{entry.valueText}</Text>
                  )}
                </View>
                {entry.monoFootnote != null && (
                  <Text style={[styles.monoFootnote, { color: theme.textSecondary }]}>
                    {entry.monoFootnote}
                  </Text>
                )}
              </View>
            );
          })}
        </View>
      ))}

      {children}

      {/* Summary */}
      {summary && (
        <View style={[styles.summaryCard, { backgroundColor: cardBg }]}>
          <Text style={[styles.summaryTitle, { color: theme.text }]}>{summary.title}</Text>
          <Text style={[styles.summaryText, { color: theme.textSecondary }]}>{summary.text}</Text>
        </View>
      )}
    </BaseModal>
  );
}

const styles = StyleSheet.create({
  totalCard: {
    padding: scale(16),
    borderRadius: responsiveBorderRadius.md,
    marginBottom: scale(14),
    ...getPlatformShadows(6, 0.25, 4, 14),
  },
  totalLabel: {
    fontSize: fontScale(13),
    fontWeight: '600',
    marginBottom: scale(6),
  },
  totalValue: {
    fontSize: fontScale(28),
    fontWeight: '800',
    marginBottom: scale(8),
  },
  totalBreakdown: {
    gap: scale(3),
  },
  totalBreakdownText: {
    fontSize: fontScale(12),
  },
  // The emphasized exact-currency line the money modals show under the headline
  exactValue: {
    fontSize: fontScale(15),
    fontWeight: '600',
  },
  netChangeText: {
    fontSize: fontScale(14),
    fontWeight: '600',
    marginTop: scale(4),
  },
  netChangePositive: {
    color: '#10B981',
  },
  netChangeNegative: {
    color: '#EF4444',
  },
  section: {
    marginBottom: scale(14),
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(6),
    marginBottom: scale(8),
  },
  sectionTitle: {
    fontSize: fontScale(15),
    fontWeight: '700',
  },
  itemCard: {
    padding: scale(12),
    borderRadius: responsiveBorderRadius.md,
    marginBottom: scale(8),
    borderWidth: 1,
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(10),
  },
  itemIconContainer: {
    width: scale(36),
    height: scale(36),
    borderRadius: scale(18),
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemInfo: {
    flex: 1,
  },
  itemLabel: {
    fontSize: fontScale(14),
    fontWeight: '600',
    marginBottom: scale(3),
  },
  itemDescription: {
    fontSize: fontScale(12),
    lineHeight: fontScale(16),
  },
  itemValueContainer: {
    alignItems: 'flex-end',
  },
  itemValue: {
    fontSize: fontScale(16),
    fontWeight: '700',
  },
  // When a sub-value (gain/loss) stacks under the value, the value picks up
  // the small gap Bank used between the two lines.
  itemValueStacked: {
    marginBottom: scale(3),
  },
  subValueText: {
    fontSize: fontScale(12),
    fontWeight: '600',
  },
  positiveValue: {
    color: '#10B981',
  },
  negativeValue: {
    color: '#EF4444',
  },
  monoFootnote: {
    fontSize: fontScale(12),
    marginTop: scale(6),
    fontFamily: 'monospace',
  },
  summaryCard: {
    padding: scale(14),
    borderRadius: responsiveBorderRadius.md,
  },
  summaryTitle: {
    fontSize: fontScale(15),
    fontWeight: '700',
    marginBottom: scale(8),
  },
  summaryText: {
    fontSize: fontScale(12),
    lineHeight: fontScale(16),
  },
});
