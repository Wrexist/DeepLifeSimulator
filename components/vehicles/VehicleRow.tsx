import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Car, Fuel, Wrench, Shield, Zap } from 'lucide-react-native';
import { Vehicle } from '@/contexts/game/types';
import { responsiveFontSize, responsiveSpacing, responsiveBorderRadius, scale } from '@/utils/scaling';
import { getThemeColors, accent } from '@/lib/config/theme';

interface Props {
  vehicle: Vehicle;
  /** Outstanding auto-loan balance, if financed. */
  loanRemaining?: number;
  isActive?: boolean;
  darkMode: boolean;
  onPress?: () => void;
}

function formatMoney(n: number): string {
  if (!isFinite(n)) return '$0';
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${n < 0 ? '-' : ''}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 10_000) return `${n < 0 ? '-' : ''}$${(abs / 1000).toFixed(1)}k`;
  return `$${Math.round(n).toLocaleString()}`;
}

export default function VehicleRow({ vehicle, loanRemaining, isActive, darkMode, onPress }: Props) {
  const theme = getThemeColors(darkMode);
  const cond = vehicle.condition ?? 100;
  const fuel = vehicle.fuelLevel ?? 100;
  const condColor = cond >= 70 ? accent.success : cond >= 40 ? accent.warning : accent.danger;
  const fuelColor = fuel >= 50 ? accent.success : fuel >= 20 ? accent.warning : accent.danger;
  const insuranceActive = vehicle.insurance?.active === true;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
      style={[styles.card, { backgroundColor: theme.surfaceElevated, borderColor: isActive ? accent.info : theme.border }]}
    >
      <View style={styles.headerRow}>
        <View style={[styles.iconBubble, { backgroundColor: isActive ? accent.info : theme.surface }]}>
          <Car size={scale(20)} color={isActive ? 'white' : theme.text} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.name, { color: theme.text }]} numberOfLines={1}>
            {vehicle.name}
          </Text>
          <Text style={[styles.sub, { color: theme.textMuted }]} numberOfLines={1}>
            {vehicle.type} · {vehicle.mileage.toLocaleString()} mi
            {vehicle.speedBonus > 0 ? ` · +${vehicle.speedBonus}% speed` : ''}
          </Text>
        </View>
        {isActive && (
          <View style={[styles.activeBadge, { backgroundColor: accent.info }]}>
            <Text style={styles.activeBadgeText}>Active</Text>
          </View>
        )}
      </View>

      <View style={styles.gaugesRow}>
        <Gauge icon={Wrench} color={condColor} label="Condition" value={Math.round(cond)} theme={theme} />
        <Gauge icon={Fuel} color={fuelColor} label="Fuel" value={Math.round(fuel)} theme={theme} />
      </View>

      <View style={styles.footRow}>
        {insuranceActive ? (
          <View style={styles.footChip}>
            <Shield size={scale(10)} color={accent.success} />
            <Text style={[styles.footText, { color: accent.success }]}>
              Insured {vehicle.insurance?.coveragePercent}%
            </Text>
          </View>
        ) : (
          <View style={styles.footChip}>
            <Shield size={scale(10)} color={accent.danger} />
            <Text style={[styles.footText, { color: accent.danger }]}>Uninsured</Text>
          </View>
        )}
        {loanRemaining != null && loanRemaining > 0 && (
          <View style={styles.footChip}>
            <Zap size={scale(10)} color={accent.warning} />
            <Text style={[styles.footText, { color: theme.textMuted }]}>
              Loan {formatMoney(loanRemaining)}
            </Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

function Gauge({
  icon: Icon,
  color,
  label,
  value,
  theme,
}: {
  icon: React.ComponentType<{ size: number; color: string }>;
  color: string;
  label: string;
  value: number;
  theme: ReturnType<typeof getThemeColors>;
}) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <View style={{ flex: 1, gap: 4 }}>
      <View style={styles.gaugeHeader}>
        <Icon size={scale(10)} color={color} />
        <Text style={[styles.gaugeLabel, { color: theme.textMuted }]}>
          {label} <Text style={{ color, fontWeight: '700' }}>{value}%</Text>
        </Text>
      </View>
      <View style={[styles.gaugeTrack, { backgroundColor: theme.border }]}>
        <View style={[styles.gaugeFill, { width: `${pct}%`, backgroundColor: color }]} />
      </View>
    </View>
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
  sub: { fontSize: responsiveFontSize.xs, marginTop: 2 },
  activeBadge: {
    paddingHorizontal: responsiveSpacing.xs,
    paddingVertical: 2,
    borderRadius: responsiveBorderRadius.sm,
  },
  activeBadgeText: { color: 'white', fontSize: responsiveFontSize.xs, fontWeight: '700' },
  gaugesRow: { flexDirection: 'row', gap: responsiveSpacing.md },
  gaugeHeader: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  gaugeLabel: { fontSize: responsiveFontSize.xs },
  gaugeTrack: {
    height: scale(4),
    borderRadius: responsiveBorderRadius.full,
    overflow: 'hidden',
  },
  gaugeFill: { height: '100%', borderRadius: responsiveBorderRadius.full },
  footRow: { flexDirection: 'row', flexWrap: 'wrap', gap: responsiveSpacing.xs },
  footChip: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  footText: { fontSize: responsiveFontSize.xs, fontWeight: '600' },
});
