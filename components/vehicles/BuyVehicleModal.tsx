import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { X, Car, AlertCircle } from 'lucide-react-native';
import { GameState } from '@/contexts/game/types';
import { quoteVehiclePurchase } from '@/contexts/game/actions/VehicleActions';
import { AutoDownTier, AutoTerm, AUTO_DOWN_FRACTIONS } from '@/lib/vehicles/auto';
import { responsiveFontSize, responsiveSpacing, responsiveBorderRadius, scale } from '@/utils/scaling';
import { getThemeColors, accent } from '@/lib/config/theme';

interface Template {
  id: string;
  name: string;
  price: number;
  description?: string;
}

interface Props {
  visible: boolean;
  template: Template | null;
  gameState: GameState;
  weeklyIncome: number;
  darkMode: boolean;
  onClose: () => void;
  onConfirm: (tier: AutoDownTier, term: AutoTerm) => void;
}

const TIER_LABEL: Record<AutoDownTier, string> = {
  low: '10% down',
  standard: '20% down',
  high: '50% down',
  cash: 'Pay cash',
};

const TERM_LABEL: Record<AutoTerm, string> = {
  '3y': '3-year',
  '5y': '5-year',
  '7y': '7-year',
};

function formatMoney(n: number): string {
  if (!isFinite(n)) return '$0';
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  return `$${Math.round(n).toLocaleString()}`;
}

export default function BuyVehicleModal({ visible, template, gameState, weeklyIncome, darkMode, onClose, onConfirm }: Props) {
  const theme = getThemeColors(darkMode);
  const [tier, setTier] = useState<AutoDownTier>('standard');
  const [term, setTerm] = useState<AutoTerm>('5y');

  useEffect(() => {
    if (visible) {
      setTier('standard');
      setTerm('5y');
    }
  }, [visible]);

  const quote = useMemo(
    () => (template ? quoteVehiclePurchase(gameState, template.id, tier, term, weeklyIncome) : null),
    [gameState, template, tier, term, weeklyIncome]
  );

  if (!template) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <TouchableOpacity style={styles.backdropTouch} activeOpacity={1} onPress={onClose} />
        <View style={[styles.sheet, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={styles.headerRow}>
            <View style={[styles.iconBubble, { backgroundColor: accent.info }]}>
              <Car size={scale(20)} color="white" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.title, { color: theme.text }]}>{template.name}</Text>
              <Text style={[styles.subtitle, { color: theme.textMuted }]}>{formatMoney(template.price)}</Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={10}>
              <X size={scale(20)} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={{ gap: responsiveSpacing.md }}>
            {template.description && (
              <Text style={[styles.body, { color: theme.textSecondary }]}>{template.description}</Text>
            )}

            <View>
              <Text style={[styles.fieldLabel, { color: theme.textMuted }]}>Down payment</Text>
              <View style={styles.chipRow}>
                {(Object.keys(AUTO_DOWN_FRACTIONS) as AutoDownTier[]).map((t) => (
                  <TouchableOpacity
                    key={t}
                    onPress={() => setTier(t)}
                    style={[
                      styles.chip,
                      { borderColor: tier === t ? accent.info : theme.border, backgroundColor: tier === t ? accent.info : theme.surfaceElevated },
                    ]}
                  >
                    <Text style={[styles.chipText, { color: tier === t ? 'white' : theme.text }]}>{TIER_LABEL[t]}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {tier !== 'cash' && (
              <View>
                <Text style={[styles.fieldLabel, { color: theme.textMuted }]}>Term</Text>
                <View style={styles.chipRow}>
                  {(['3y', '5y', '7y'] as AutoTerm[]).map((tt) => (
                    <TouchableOpacity
                      key={tt}
                      onPress={() => setTerm(tt)}
                      style={[
                        styles.chip,
                        { borderColor: term === tt ? accent.info : theme.border, backgroundColor: term === tt ? accent.info : theme.surfaceElevated },
                      ]}
                    >
                      <Text style={[styles.chipText, { color: term === tt ? 'white' : theme.text }]}>{TERM_LABEL[tt]}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {quote && quote.rejected && (
              <View style={[styles.errorRow, { backgroundColor: 'rgba(239,68,68,0.1)' }]}>
                <AlertCircle size={scale(14)} color={accent.danger} />
                <Text style={[styles.errorText, { color: accent.danger }]}>{quote.reason}</Text>
              </View>
            )}

            {quote && !quote.rejected && (
              <View style={[styles.quoteCard, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
                <Row theme={theme} label="Down payment" value={formatMoney(quote.downPaymentUSD ?? 0)} highlight />
                {(quote.loanPrincipal ?? 0) > 0 && (
                  <>
                    <Row theme={theme} label="Financed" value={formatMoney(quote.loanPrincipal ?? 0)} />
                    <Row theme={theme} label="APR" value={`${((quote.offeredAPR ?? 0) * 100).toFixed(2)}%`} />
                    <Row theme={theme} label="Weekly payment" value={formatMoney(quote.weeklyPayment ?? 0)} />
                    <Row theme={theme} label="Total cost over term" value={formatMoney(quote.totalCost ?? 0)} />
                  </>
                )}
              </View>
            )}
          </ScrollView>

          <TouchableOpacity
            disabled={!quote || quote.rejected}
            onPress={() => onConfirm(tier, term)}
            style={[styles.confirm, { backgroundColor: quote && !quote.rejected ? accent.info : theme.border }]}
          >
            <Text style={styles.confirmText}>
              {tier === 'cash' ? 'Buy with Cash' : 'Sign Auto Loan'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

function Row({
  theme,
  label,
  value,
  highlight,
}: {
  theme: ReturnType<typeof getThemeColors>;
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, { color: theme.textMuted }]}>{label}</Text>
      <Text
        style={[
          styles.rowValue,
          { color: highlight ? theme.text : theme.textSecondary, fontWeight: highlight ? '800' : '600' },
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: responsiveSpacing.lg,
  },
  backdropTouch: { ...StyleSheet.absoluteFillObject },
  sheet: {
    borderRadius: responsiveBorderRadius.xl,
    borderWidth: 1,
    padding: responsiveSpacing.lg,
    gap: responsiveSpacing.md,
    maxHeight: '90%',
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: responsiveSpacing.sm },
  iconBubble: {
    width: scale(40),
    height: scale(40),
    borderRadius: scale(20),
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: responsiveFontSize.lg, fontWeight: '700' },
  subtitle: { fontSize: responsiveFontSize.sm, marginTop: 2 },
  body: { fontSize: responsiveFontSize.sm },
  fieldLabel: { fontSize: responsiveFontSize.sm, fontWeight: '600', marginBottom: responsiveSpacing.xs },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: responsiveSpacing.xs },
  chip: {
    paddingHorizontal: responsiveSpacing.md,
    paddingVertical: responsiveSpacing.xs,
    borderRadius: responsiveBorderRadius.full,
    borderWidth: 1,
  },
  chipText: { fontSize: responsiveFontSize.sm, fontWeight: '700' },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: responsiveSpacing.xs,
    padding: responsiveSpacing.md,
    borderRadius: responsiveBorderRadius.lg,
  },
  errorText: { flex: 1, fontSize: responsiveFontSize.sm, fontWeight: '600' },
  quoteCard: {
    padding: responsiveSpacing.md,
    borderRadius: responsiveBorderRadius.lg,
    borderWidth: 1,
    gap: 4,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  rowLabel: { fontSize: responsiveFontSize.sm },
  rowValue: { fontSize: responsiveFontSize.sm },
  confirm: {
    paddingVertical: responsiveSpacing.md,
    borderRadius: responsiveBorderRadius.lg,
    alignItems: 'center',
  },
  confirmText: { color: 'white', fontSize: responsiveFontSize.md, fontWeight: '700' },
});
