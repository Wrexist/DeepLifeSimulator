import AmountSlider from '@/components/ui/AmountSlider';
import { parseAmount } from '@/utils/parseAmount';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { X } from 'lucide-react-native';
import { responsiveFontSize, responsiveSpacing, responsiveBorderRadius, scale, touchTargets } from '@/utils/scaling';
import { hitSlopToMinTarget, minTouchTargetStyle } from '@/utils/touchTargets';
import { getThemeColors, accent } from '@/lib/config/theme';
import { getGlassCard, getPlatformShadows } from '@/utils/glassmorphismStyles';
import Gradient from '@/components/ui/Gradient';
import { StockOrderSide, StockOrderType } from '@/lib/stocks/orderBook';

import { formatMoney } from '@/utils/moneyFormatting';

const LinearGradient = Gradient;

// 2% commission - MUST match STOCK_FEE in contexts/game/actions/StockActions.ts
// (buy validation here mirrors buyStockMarket's gross-cost check).
const STOCK_FEE = 0.02;

interface Props {
  visible: boolean;
  symbol: string | null;
  midPrice: number;
  /** Player cash on hand. */
  cash: number;
  /** Commitments already checked by the canonical pending-order action. */
  reservedCash?: number;
  reservedUnits?: number;
  /** Shares currently owned of this symbol. */
  ownedShares: number;
  darkMode: boolean;
  onClose: () => void;
  onSubmit: (input: {
    side: StockOrderSide;
    type: StockOrderType;
    amount: number;
    limitPrice?: number;
    stopPrice?: number;
  }) => void;
}

/**
 * Per-share PRICE - cents matter below $1k, so this stays separate from the
 * canonical `formatMoney` used for the cash/order-value figures below.
 */
function formatPrice(n: number): string {
  if (!isFinite(n)) return '$0';
  if (n >= 1000) return `$${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
  return `$${n.toFixed(2)}`;
}

export default function StockTradeModal({ visible, symbol, midPrice, cash, reservedCash = 0, reservedUnits = 0, ownedShares, darkMode, onClose, onSubmit }: Props) {
  const theme = getThemeColors(darkMode);
  const reducedMotion = useReducedMotion();
  const [side, setSide] = useState<StockOrderSide>('buy');
  const [type, setType] = useState<StockOrderType>('market');
  const [amountText, setAmountText] = useState('');
  const [limitText, setLimitText] = useState('');
  const [stopText, setStopText] = useState('');

  useEffect(() => {
    if (visible) {
      setSide('buy');
      setType('market');
      setAmountText('');
      setLimitText('');
      setStopText('');
    }
  }, [visible]);

  const amount = parseAmount(amountText) ?? 0;
  const limit = parseAmount(limitText) ?? 0;
  const stop = parseAmount(stopText) ?? 0;

  const availableCash = Math.max(0, cash - (type === 'market' ? 0 : reservedCash));
  const availableUnits = Math.max(0, ownedShares - (type === 'market' ? 0 : reservedUnits));

  const valid = useMemo(() => {
    if (!symbol || amount <= 0) return false;
    // Buys settle at amount × (1 + fee) in buyStockMarket - validate against
    // the same gross cost, or amounts in (cash/1.02, cash] enable Confirm but
    // get silently rejected by the action.
    if (side === 'buy' && amount * (1 + STOCK_FEE) > availableCash) return false;
    if (side === 'sell' && amount > availableUnits) return false;
    if (type === 'limit' && limit <= 0) return false;
    if (type === 'stop' && stop <= 0) return false;
    return true;
  }, [symbol, amount, availableCash, availableUnits, side, type, limit, stop]);

  const estimatedShares = side === 'buy' && midPrice > 0 ? amount / midPrice : 0;
  const estimatedUSD = side === 'sell' && midPrice > 0 ? amount * midPrice : 0;

  return (
    <Modal visible={visible} transparent animationType={reducedMotion ? 'none' : 'fade'} onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.backdrop}>
        <TouchableOpacity
          style={styles.backdropTouch}
          activeOpacity={1}
          onPress={onClose}
          importantForAccessibility="no"
          accessibilityElementsHidden
        />
        <View style={[getGlassCard(darkMode, 12), styles.sheet, { backgroundColor: theme.surface, borderColor: darkMode ? theme.glassBorder : theme.border }]}>
          <View style={styles.headerRow}>
            <Text style={[styles.title, { color: theme.text }]}>Trade {symbol}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={hitSlopToMinTarget(scale(20))} style={minTouchTargetStyle} accessibilityRole="button" accessibilityLabel="Close">
              <X size={scale(20)} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={{ flexShrink: 1 }} keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: responsiveSpacing.md }}>
            <Text style={[styles.subtitle, { color: theme.textMuted }]}>
              Mid {formatPrice(midPrice)} · You own {ownedShares.toFixed(2)} sh · Cash {formatMoney(cash)}
            </Text>

            <SegRow
              theme={theme}
              options={[
                { key: 'buy', label: 'Buy', color: accent.success },
                { key: 'sell', label: 'Sell', color: accent.danger },
              ]}
              value={side}
              onChange={(v) => setSide(v as StockOrderSide)}
            />

            <SegRow
              theme={theme}
              options={[
                { key: 'market', label: 'Market' },
                { key: 'limit', label: 'Limit' },
                { key: 'stop', label: 'Stop' },
              ]}
              value={type}
              onChange={(v) => setType(v as StockOrderType)}
            />

            <Field theme={theme} label={side === 'buy' ? 'Amount (USD)' : 'Shares'}>
              <AmountSlider value={amountText} onChangeText={setAmountText} accessibilityLabel={side === 'buy' ? 'Trade amount in dollars' : 'Units to sell'} maxAmount={side === 'buy' ? Math.floor(availableCash / 1.02 * 100) / 100 : availableUnits} unit={side === 'buy' ? '$' : ''} precision={side === 'buy' ? 2 : 8} darkMode={darkMode} />
            </Field>

            {type === 'limit' && (
              <Field theme={theme} label="Limit price (USD)">
                <AmountSlider value={limitText} onChangeText={setLimitText} accessibilityLabel="Limit price in dollars" initialRange={Math.max(midPrice * 2, 1)} darkMode={darkMode} />
              </Field>
            )}

            {type === 'stop' && (
              <Field theme={theme} label="Stop price (USD)">
                <AmountSlider value={stopText} onChangeText={setStopText} accessibilityLabel="Stop price in dollars" initialRange={Math.max(midPrice * 2, 1)} darkMode={darkMode} />
              </Field>
            )}

            {side === 'buy' && estimatedShares > 0 && (
              <Text style={[styles.estimate, { color: theme.textMuted }]}>
                ≈ {estimatedShares.toFixed(2)} shares at mid (excludes 2% commission, spread, slippage)
              </Text>
            )}
            {side === 'sell' && estimatedUSD > 0 && (
              <Text style={[styles.estimate, { color: theme.textMuted }]}>
                ≈ {formatMoney(estimatedUSD)} at mid (excludes 2% commission, spread, slippage)
              </Text>
            )}
            {amountText.trim() !== '' && parseAmount(amountText) === null && (
              <Text accessibilityRole="alert" style={[styles.estimate, { color: accent.danger }]}>Enter a complete amount, such as 1,000.50.</Text>
            )}
            {type !== 'market' && (
              <Text style={[styles.estimate, { color: theme.textSecondary }]}>
                Checked each week. {side === 'buy' ? `$${availableCash.toLocaleString('en-US', { maximumFractionDigits: 2 })} cash available after existing orders.` : `${availableUnits.toLocaleString('en-US', { maximumFractionDigits: 8 })} units available after existing orders.`}
              </Text>
            )}
            {amount > 0 && !valid && (
              <Text accessibilityRole="alert" style={[styles.estimate, { color: accent.danger }]}>
                Check the amount, available funds or units, and a valid trigger price. Buys require 2% commission.
              </Text>
            )}
          </ScrollView>

          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={`${type === 'market' ? 'Execute' : 'Place'} ${side === 'buy' ? 'Buy' : 'Sell'}`}
            accessibilityState={{ disabled: !valid }}
            disabled={!valid}
            activeOpacity={0.7}
            onPress={() => {
              if (!valid || !symbol) return;
              onSubmit({
                side,
                type,
                amount,
                limitPrice: type === 'limit' ? limit : undefined,
                stopPrice: type === 'stop' ? stop : undefined,
              });
            }}
            style={[styles.confirm, valid && getPlatformShadows(5, 0.3, 2, 8)]}
          >
            <LinearGradient
              colors={valid ? [accent.purple, '#9333EA'] : [theme.surfaceElevated, theme.surfaceElevated]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.confirmFill}
            >
              <Text style={[styles.confirmText, { color: valid ? 'white' : theme.textMuted }]}>
                {type === 'market' ? 'Execute' : 'Place'} {side === 'buy' ? 'Buy' : 'Sell'}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function SegRow({
  theme,
  options,
  value,
  onChange,
}: {
  theme: ReturnType<typeof getThemeColors>;
  options: { key: string; label: string; color?: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <View style={styles.segRow}>
      {options.map((o) => {
        const active = o.key === value;
        const activeColor = o.color ?? accent.purple;
        return (
          <TouchableOpacity
            key={o.key}
            accessibilityRole="radio"
            accessibilityLabel={o.label}
            accessibilityState={{ selected: active }}
            onPress={() => onChange(o.key)}
            style={[
              styles.seg,
              active
                ? { backgroundColor: `${activeColor}24`, borderColor: `${activeColor}59` }
                : { backgroundColor: theme.surfaceElevated, borderColor: theme.border },
            ]}
          >
            <Text style={[styles.segText, { color: active ? activeColor : theme.textSecondary }]}>{o.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function Field({ theme, label, children }: { theme: ReturnType<typeof getThemeColors>; label: string; children: React.ReactNode }) {
  return (
    <View>
      <Text style={[styles.fieldLabel, { color: theme.textMuted }]}>{label}</Text>
      <View style={[styles.fieldRow, { borderColor: theme.border }]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: responsiveSpacing.lg },
  backdropTouch: { ...StyleSheet.absoluteFillObject },
  sheet: { borderRadius: responsiveBorderRadius['2xl'], borderWidth: 1, padding: responsiveSpacing.lg, gap: responsiveSpacing.md, maxHeight: '90%' },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: responsiveFontSize.lg, fontWeight: '700' },
  subtitle: { fontSize: responsiveFontSize.sm },
  segRow: { flexDirection: 'row', gap: responsiveSpacing.xs },
  seg: { minHeight: scale(44), justifyContent: 'center', flex: 1, paddingVertical: responsiveSpacing.sm, borderRadius: responsiveBorderRadius.lg, borderWidth: 1, alignItems: 'center' },
  segText: { fontSize: responsiveFontSize.sm, fontWeight: '700' },
  fieldLabel: { fontSize: responsiveFontSize.sm, fontWeight: '600', marginBottom: responsiveSpacing.xs },
  fieldRow: { borderWidth: 1, borderRadius: responsiveBorderRadius.lg, paddingHorizontal: responsiveSpacing.md },
  input: { fontSize: responsiveFontSize.lg, fontWeight: '700', paddingVertical: responsiveSpacing.md },
  estimate: { fontSize: responsiveFontSize.xs, fontStyle: 'italic' },
  confirm: { borderRadius: responsiveBorderRadius.full },
  confirmFill: {
    borderRadius: responsiveBorderRadius.full,
    minHeight: touchTargets.minimum,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: responsiveSpacing.md,
  },
  confirmText: { fontSize: responsiveFontSize.md, fontWeight: '700' },
});
