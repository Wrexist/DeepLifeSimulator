import AmountSlider from '@/components/ui/AmountSlider';
import { parseAmount } from '@/utils/parseAmount';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { formatMoney } from '@/utils/moneyFormatting';
import { X } from 'lucide-react-native';
import { Crypto, CryptoOrderSide, CryptoOrderType } from '@/contexts/game/types';
import { responsiveFontSize, responsiveSpacing, responsiveBorderRadius, scale } from '@/utils/scaling';
import { hitSlopToMinTarget, minTouchTargetStyle } from '@/utils/touchTargets';
import { getThemeColors, accent } from '@/lib/config/theme';

interface Props {
  visible: boolean;
  coin: Crypto | null;
  /** Player's cash available for buys. */
  cash: number;
  /** Commitments already checked by the canonical pending-order action. */
  reservedCash?: number;
  reservedUnits?: number;
  darkMode: boolean;
  onClose: () => void;
  onSubmit: (input: {
    side: CryptoOrderSide;
    type: CryptoOrderType;
    amount: number;
    limitPrice?: number;
    stopPrice?: number;
  }) => void;
}

function formatPrice(n: number): string {
  if (!isFinite(n) || n <= 0) return '-';
  if (n >= 1000) return `$${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
  if (n >= 1) return `$${n.toFixed(2)}`;
  return `$${n.toFixed(4)}`;
}

export default function PlaceOrderModal({ visible, coin, cash, reservedCash = 0, reservedUnits = 0, darkMode, onClose, onSubmit }: Props) {
  const theme = getThemeColors(darkMode);
  const reducedMotion = useReducedMotion();
  const [side, setSide] = useState<CryptoOrderSide>('buy');
  const [type, setType] = useState<CryptoOrderType>('market');
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
  const limitPrice = parseAmount(limitText) ?? 0;
  const stopPrice = parseAmount(stopText) ?? 0;
  const owned = coin?.owned ?? 0;
  const midPrice = coin?.price ?? 0;

  const availableCash = Math.max(0, cash - (type === 'market' ? 0 : reservedCash));
  const availableUnits = Math.max(0, owned - (type === 'market' ? 0 : reservedUnits));

  const valid = useMemo(() => {
    if (!coin || amount <= 0) return false;
    if (side === 'buy' && amount * (type === 'market' ? 1 : 1.01) > availableCash) return false;
    if (side === 'sell' && amount > availableUnits) return false;
    if (type === 'limit' && limitPrice <= 0) return false;
    if (type === 'stop' && stopPrice <= 0) return false;
    return true;
  }, [coin, amount, availableCash, availableUnits, side, type, limitPrice, stopPrice]);

  const amountUnit = side === 'buy' ? 'USD' : coin?.symbol ?? '';
  const estimatedCoins = side === 'buy' && midPrice > 0 ? amount / midPrice : 0;
  const estimatedUSD = side === 'sell' && midPrice > 0 ? amount * midPrice : 0;

  return (
    <Modal visible={visible} transparent animationType={reducedMotion ? 'none' : 'fade'} onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.backdrop}
      >
        <TouchableOpacity
          style={styles.backdropTouch}
          activeOpacity={1}
          onPress={onClose}
          importantForAccessibility="no"
          accessibilityElementsHidden
        />
        <View style={[styles.sheet, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={styles.headerRow}>
            <Text style={[styles.title, { color: theme.text }]}>
              Trade {coin?.symbol ?? ''}
            </Text>
            <TouchableOpacity onPress={onClose} hitSlop={hitSlopToMinTarget(scale(20))} style={minTouchTargetStyle} accessibilityRole="button" accessibilityLabel="Close">
              <X size={scale(20)} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={{ flexShrink: 1 }} keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: responsiveSpacing.md }}>
            <Text style={[styles.subtitle, { color: theme.textMuted }]}>
              Mid {formatPrice(midPrice)} · You own {owned.toFixed(4)} {coin?.symbol} · Cash {formatMoney(cash)}
            </Text>

            <SegRow
              theme={theme}
              options={[
                { key: 'buy', label: 'Buy', color: accent.success },
                { key: 'sell', label: 'Sell', color: accent.danger },
              ]}
              value={side}
              onChange={(v) => setSide(v as CryptoOrderSide)}
            />

            <SegRow
              theme={theme}
              options={[
                { key: 'market', label: 'Market' },
                { key: 'limit', label: 'Limit' },
                { key: 'stop', label: 'Stop' },
              ]}
              value={type}
              onChange={(v) => setType(v as CryptoOrderType)}
            />

            <Field theme={theme} label={`Amount (${amountUnit})`}>
              <AmountSlider value={amountText} onChangeText={setAmountText} accessibilityLabel={side === 'buy' ? 'Trade amount in dollars' : 'Units to sell'} maxAmount={side === 'buy' ? Math.floor(availableCash / (type === 'market' ? 1 : 1.01) * 100) / 100 : availableUnits} unit={side === 'buy' ? '$' : ''} precision={side === 'buy' ? 2 : 8} darkMode={darkMode} />
            </Field>

            {type === 'limit' && (
              <Field theme={theme} label="Limit price (USD)">
                <AmountSlider value={limitText} onChangeText={setLimitText} accessibilityLabel="Limit price in dollars" initialRange={Math.max(midPrice * 2, 1)} precision={8} darkMode={darkMode} />
              </Field>
            )}

            {type === 'stop' && (
              <Field theme={theme} label="Stop price (USD)">
                <AmountSlider value={stopText} onChangeText={setStopText} accessibilityLabel="Stop price in dollars" initialRange={Math.max(midPrice * 2, 1)} precision={8} darkMode={darkMode} />
              </Field>
            )}

            {side === 'buy' && estimatedCoins > 0 && (
              <Text style={[styles.estimate, { color: theme.textMuted }]}>
                ≈ {estimatedCoins.toFixed(6)} {coin?.symbol} at mid (excludes spread + slippage)
              </Text>
            )}
            {side === 'sell' && estimatedUSD > 0 && (
              <Text style={[styles.estimate, { color: theme.textMuted }]}>
                ≈ {formatPrice(estimatedUSD)} at mid (excludes spread + slippage)
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
                Check the amount, available funds or units, and a valid trigger price. Pending buys require a 1% cash buffer.
              </Text>
            )}
          </ScrollView>

          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={`${type === 'market' ? 'Execute' : 'Place'} ${side === 'buy' ? 'Buy' : 'Sell'}`}
            accessibilityState={{ disabled: !valid }}
            disabled={!valid}
            onPress={() => {
              if (!valid || !coin) return;
              onSubmit({
                side,
                type,
                amount,
                limitPrice: type === 'limit' ? limitPrice : undefined,
                stopPrice: type === 'stop' ? stopPrice : undefined,
              });
            }}
            style={[
              styles.confirm,
              {
                backgroundColor: valid ? (side === 'buy' ? accent.success : accent.danger) : theme.border,
              },
            ]}
          >
            <Text style={styles.confirmText}>
              {type === 'market' ? 'Execute' : 'Place'} {side === 'buy' ? 'Buy' : 'Sell'}
            </Text>
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
        const activeColor = o.color ?? accent.info;
        return (
          <TouchableOpacity
            key={o.key}
            accessibilityRole="radio"
            accessibilityLabel={o.label}
            accessibilityState={{ selected: active }}
            onPress={() => onChange(o.key)}
            style={[
              styles.seg,
              {
                borderColor: active ? activeColor : theme.border,
                backgroundColor: active ? activeColor : theme.surfaceElevated,
              },
            ]}
          >
            <Text style={[styles.segText, { color: active ? 'white' : theme.text }]}>
              {o.label}
            </Text>
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
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: responsiveFontSize.lg,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: responsiveFontSize.sm,
  },
  segRow: {
    flexDirection: 'row',
    gap: responsiveSpacing.xs,
  },
  seg: {
    minHeight: scale(44),
    justifyContent: 'center',
    flex: 1,
    paddingVertical: responsiveSpacing.sm,
    borderRadius: responsiveBorderRadius.lg,
    borderWidth: 1,
    alignItems: 'center',
  },
  segText: {
    fontSize: responsiveFontSize.sm,
    fontWeight: '700',
  },
  fieldLabel: {
    fontSize: responsiveFontSize.sm,
    fontWeight: '600',
    marginBottom: responsiveSpacing.xs,
  },
  fieldRow: {
    borderWidth: 1,
    borderRadius: responsiveBorderRadius.lg,
    paddingHorizontal: responsiveSpacing.md,
  },
  input: {
    fontSize: responsiveFontSize.lg,
    fontWeight: '700',
    paddingVertical: responsiveSpacing.md,
  },
  estimate: {
    fontSize: responsiveFontSize.xs,
    fontStyle: 'italic',
  },
  confirm: {
    paddingVertical: responsiveSpacing.md,
    borderRadius: responsiveBorderRadius.lg,
    alignItems: 'center',
  },
  confirmText: {
    color: 'white',
    fontSize: responsiveFontSize.md,
    fontWeight: '700',
  },
});
