import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Home, MapPin, AlertTriangle, Wrench } from 'lucide-react-native';
import { RealEstate } from '@/contexts/game/types';
import { responsiveFontSize, responsiveSpacing, responsiveBorderRadius, scale } from '@/utils/scaling';
import { getThemeColors, accent } from '@/lib/config/theme';

interface Props {
  property: RealEstate;
  mortgageRemaining?: number;
  darkMode: boolean;
  onPress?: () => void;
  /** Show "owned" detail summary (rent mode / tenant / cycle). Defaults to false. */
  detailed?: boolean;
}

function formatMoney(n: number): string {
  if (!isFinite(n)) return '$0';
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (abs >= 10_000) return `$${(n / 1000).toFixed(1)}k`;
  return `$${Math.round(n).toLocaleString()}`;
}

const CYCLE_COLOR: Record<string, string> = {
  stable: accent.info,
  gentrifying: accent.purple,
  hot: accent.success,
  cooling: accent.warning,
};

const CYCLE_LABEL: Record<string, string> = {
  stable: 'Stable',
  gentrifying: 'Gentrifying',
  hot: 'Hot',
  cooling: 'Cooling',
};

const RENT_MODE_LABEL: Record<string, string> = {
  longTerm: 'Long-term lease',
  airbnb: 'Airbnb',
  commercial: 'Commercial',
};

export default function PropertyRow({ property, mortgageRemaining, darkMode, onPress, detailed = false }: Props) {
  const theme = getThemeColors(darkMode);
  const value = property.currentValue ?? property.price;
  const equity = property.owned ? Math.max(0, value - (mortgageRemaining ?? 0)) : 0;
  const condition = property.condition ?? (property.owned ? 90 : 100);
  const conditionColor = condition >= 70 ? accent.success : condition >= 40 ? accent.warning : accent.danger;
  const cycle = property.marketCycle ?? 'stable';

  return (
    <TouchableOpacity
      activeOpacity={onPress ? 0.7 : 1}
      onPress={onPress}
      style={[styles.card, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}
    >
      <View style={styles.headerRow}>
        <View style={[styles.iconBubble, { backgroundColor: theme.surface }]}>
          <Home size={scale(18)} color={theme.text} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.name, { color: theme.text }]} numberOfLines={1}>
            {property.name}
          </Text>
          <View style={styles.metaRow}>
            <MapPin size={scale(10)} color={theme.textMuted} />
            <Text style={[styles.metaText, { color: theme.textMuted }]} numberOfLines={1}>
              {property.neighborhood ?? property.id} ·{' '}
              <Text style={{ color: CYCLE_COLOR[cycle] }}>{CYCLE_LABEL[cycle]}</Text>
            </Text>
          </View>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={[styles.price, { color: theme.text }]}>{formatMoney(value)}</Text>
          {property.owned && (
            <Text style={[styles.equityText, { color: accent.success }]}>
              {formatMoney(equity)} equity
            </Text>
          )}
        </View>
      </View>

      {property.owned && (
        <View style={styles.statusRow}>
          {property.currentResidence && (
            <View style={[styles.badge, { backgroundColor: accent.info }]}>
              <Text style={styles.badgeText}>Residence</Text>
            </View>
          )}
          {property.status === 'rented' && property.rentMode && (
            <View style={[styles.badge, { backgroundColor: accent.success }]}>
              <Text style={styles.badgeText}>{RENT_MODE_LABEL[property.rentMode]}</Text>
            </View>
          )}
          {property.launderingFront && (
            <View style={[styles.badge, { backgroundColor: accent.purple }]}>
              <Text style={styles.badgeText}>Front</Text>
            </View>
          )}
          {property.mortgageId && (
            <View style={[styles.badge, { backgroundColor: theme.surface, borderColor: theme.border, borderWidth: 1 }]}>
              <Text style={[styles.badgeText, { color: theme.textSecondary }]}>
                Mortgage {formatMoney(mortgageRemaining ?? 0)}
              </Text>
            </View>
          )}
        </View>
      )}

      {detailed && property.owned && (
        <>
          <View style={styles.conditionRow}>
            <Wrench size={scale(12)} color={conditionColor} />
            <Text style={[styles.conditionText, { color: theme.textMuted }]}>
              Condition <Text style={{ color: conditionColor, fontWeight: '700' }}>{Math.round(condition)}%</Text>
            </Text>
            {condition < 40 && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                <AlertTriangle size={scale(10)} color={accent.danger} />
                <Text style={[styles.warnText, { color: accent.danger }]}>Needs maintenance</Text>
              </View>
            )}
          </View>
          {property.tenant && (
            <Text style={[styles.tenantText, { color: theme.textSecondary }]} numberOfLines={1}>
              Tenant: {property.tenant.name} · Satisfaction{' '}
              {Math.round(property.tenant.satisfaction)}% · ${Math.round(property.tenant.weeklyRent)}/wk
            </Text>
          )}
          {property.status === 'rented' && !property.tenant && (
            <Text style={[styles.tenantText, { color: accent.warning }]}>
              Vacant {property.weeksVacant ? `for ${property.weeksVacant} ${property.weeksVacant === 1 ? 'week' : 'weeks'}` : ''}
            </Text>
          )}
        </>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: responsiveSpacing.md,
    borderRadius: responsiveBorderRadius.lg,
    borderWidth: 1,
    gap: responsiveSpacing.sm,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: responsiveSpacing.sm,
  },
  iconBubble: {
    width: scale(40),
    height: scale(40),
    borderRadius: scale(20),
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: { fontSize: responsiveFontSize.md, fontWeight: '700' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  metaText: { fontSize: responsiveFontSize.xs },
  price: { fontSize: responsiveFontSize.md, fontWeight: '800' },
  equityText: { fontSize: responsiveFontSize.xs, fontWeight: '700', marginTop: 2 },
  statusRow: { flexDirection: 'row', flexWrap: 'wrap', gap: responsiveSpacing.xs },
  badge: {
    paddingHorizontal: responsiveSpacing.xs,
    paddingVertical: 2,
    borderRadius: responsiveBorderRadius.sm,
  },
  badgeText: { color: 'white', fontSize: responsiveFontSize.xs, fontWeight: '700' },
  conditionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: responsiveSpacing.xs,
  },
  conditionText: { fontSize: responsiveFontSize.xs },
  warnText: { fontSize: responsiveFontSize.xs, fontWeight: '700' },
  tenantText: { fontSize: responsiveFontSize.xs },
});
