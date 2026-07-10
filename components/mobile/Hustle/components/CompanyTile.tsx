/**
 * CompanyTile — dashboard card for a single company.
 *
 * Shows name, industry icon + colored gradient, weekly revenue, employee
 * count, brand health bar, and any active scandal chip. Tap → open detail.
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AlertTriangle, Briefcase, Building2, DollarSign, Factory, Utensils, Landmark } from 'lucide-react-native';
import { useTheme } from '@/hooks/useTheme';
import { scale, fontScale, responsiveSpacing, responsiveBorderRadius } from '@/utils/scaling';
import { getGlassCard } from '@/utils/glassmorphismStyles';
import { industryColor, HUSTLE_COLORS } from '../styles/hustleTheme';
import type { Company, HustleCompanyOverlay } from '@/contexts/game/types';

const INDUSTRY_ICON: Record<string, any> = {
  factory: Factory,
  ai: Briefcase,           // no Brain icon in lucide-react-native default exports across versions; Briefcase is safe
  restaurant: Utensils,
  realestate: Building2,
  bank: Landmark,
};

interface CompanyTileProps {
  company: Company;
  overlay: HustleCompanyOverlay | undefined;
  onPress: () => void;
}

export default function CompanyTile({ company, overlay, onPress }: CompanyTileProps) {
  const { theme, isDark } = useTheme();
  const Icon = INDUSTRY_ICON[company.type] ?? Building2;
  const color = industryColor(company.type);
  const brand = overlay?.brand?.score ?? 50;
  const scandal = overlay?.activeScandal;
  const isPublic = overlay?.ipo?.status === 'public';

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Open ${company.name}`}
      style={({ pressed }) => [
        getGlassCard(isDark, 6),
        styles.card,
        { backgroundColor: theme.surface, borderColor: theme.border, borderWidth: 1, opacity: pressed ? 0.85 : 1 },
      ]}
    >
      <View style={styles.headerRow}>
        <View style={[styles.iconSquare, { backgroundColor: color + '26', borderColor: color + '4D' }]}>
          <Icon size={fontScale(22)} color={color} strokeWidth={2.2} />
        </View>
        <View style={styles.headerText}>
          <Text style={[styles.name, { color: theme.text }]} numberOfLines={1}>
            {company.name}
          </Text>
          <Text style={[styles.industry, { color: theme.textSecondary }]}>
            {company.type.charAt(0).toUpperCase() + company.type.slice(1)} · {company.employees} employees
          </Text>
        </View>
        {isPublic ? (
          <View style={[styles.pubChip, { backgroundColor: HUSTLE_COLORS.accent + '26', borderColor: HUSTLE_COLORS.accent + '4D' }]}>
            <Text style={[styles.pubChipText, { color: HUSTLE_COLORS.accent }]}>PUBLIC</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.metricsRow}>
        <View style={styles.metric}>
          <Text style={[styles.metricLabel, { color: theme.textSecondary }]}>Weekly</Text>
          <Text style={[styles.metricValue, { color: HUSTLE_COLORS.success }]}>
            ${(company.weeklyIncome ?? 0).toLocaleString()}
          </Text>
        </View>
        <View style={styles.metric}>
          <Text style={[styles.metricLabel, { color: theme.textSecondary }]}>Brand</Text>
          <View style={styles.brandRow}>
            <Text style={[styles.metricValue, { color: theme.text }]}>{brand}</Text>
            <View style={[styles.brandBar, { backgroundColor: theme.surfaceElevated }]}>
              <View style={[styles.brandFill, { width: `${brand}%`, backgroundColor: HUSTLE_COLORS.accent }]} />
            </View>
          </View>
        </View>
        <View style={styles.metric}>
          <Text style={[styles.metricLabel, { color: theme.textSecondary }]}>Share</Text>
          <Text style={[styles.metricValue, { color: theme.text }]}>
            {(overlay?.marketSharePercent ?? 5).toFixed(1)}%
          </Text>
        </View>
      </View>

      {scandal ? (
        <View style={[styles.scandalChip, { backgroundColor: HUSTLE_COLORS.danger + '22', borderColor: HUSTLE_COLORS.danger }]}>
          <AlertTriangle size={fontScale(11)} color={HUSTLE_COLORS.danger} strokeWidth={2.4} />
          <Text style={[styles.scandalText, { color: HUSTLE_COLORS.danger }]} numberOfLines={1}>
            {scandal.headline}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: responsiveBorderRadius.xl,
    padding: responsiveSpacing.md,
    marginBottom: responsiveSpacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: responsiveSpacing.sm,
    marginBottom: responsiveSpacing.md,
  },
  iconSquare: {
    width: scale(44),
    height: scale(44),
    borderRadius: scale(10),
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: { flex: 1 },
  name: {
    fontSize: fontScale(15),
    fontWeight: '700',
  },
  industry: {
    fontSize: fontScale(11),
    marginTop: 2,
  },
  pubChip: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    borderWidth: 1,
  },
  pubChipText: {
    fontSize: fontScale(9),
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: responsiveSpacing.md,
  },
  metric: {
    flex: 1,
  },
  metricLabel: {
    fontSize: fontScale(10),
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 2,
  },
  metricValue: {
    fontSize: fontScale(14),
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  brandRow: {
    gap: 2,
  },
  brandBar: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  brandFill: {
    height: '100%',
  },
  scandalChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: responsiveSpacing.sm,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  scandalText: {
    fontSize: fontScale(11),
    fontWeight: '600',
    flexShrink: 1,
  },
});
