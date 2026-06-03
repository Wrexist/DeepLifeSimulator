import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, Modal, TouchableOpacity, TextInput, StyleSheet, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { X } from 'lucide-react-native';
import { responsiveFontSize, responsiveSpacing, responsiveBorderRadius, scale } from '@/utils/scaling';
import { getThemeColors, accent } from '@/lib/config/theme';
import { StockOrderSide, StockOrderType } from '@/lib/stocks/orderBook';

interface Props {
  visible: boolean;
  symbol: string | null;
  midPrice: number;
  /** Player cash on hand. */
  cash: number;
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

function formatMoney(n: number): string {
  if (!isFinite(n)) return '$0';
  if (n >= 1000) return `$${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
  return `$${n.toFixed(2)}`;
}

export default function StockTradeModal({ visible, symbol, midPrice, cash, ownedShares, darkMode, onClose, onSubmit }: Props) {
  const theme = getThemeColors(darkMode);
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

  const amount = parseFloat(amountText) || 0;
  const limit = parseFloat(limitText) || 0;
  const stop = parseFloat(stopText) || 0;

  const valid = useMemo(() => {
    if (!symbol || amount <= 0) return false;
    if (side === 'buy' && amount > cash) return false;
    if (side === 'sell' && amount > ownedShares) return false;
    if (type === 'limit' && limit <= 0) return false;
    if (type === 'stop' && stop <= 0) return false;
    return true;
  }, [symbol, amount, cash, ownedShares, side, type, limit, stop]);

  const estimatedShares = side === 'buy' && midPrice > 0 ? amount / midPrice : 0;
  const estimatedUSD = side === 'sell' && midPrice > 0 ? amount * midPrice : 0;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.backdrop}>
        <TouchableOpacity style={styles.backdropTouch} activeOpacity={1} onPress={onClose} />
        <View style={[styles.sheet, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={styles.headerRow}>
            <Text style={[styles.title, { color: theme.text }]}>Trade {symbol}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={10}>
              <X size={scale(20)} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={{ gap: responsiveSpacing.md }}>
            <Text style={[styles.subtitle, { color: theme.textMuted }]}>
              Mid {formatMoney(midPrice)} · You own {ownedShares.toFixed(2)} sh · Cash {formatMoney(cash)}
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
              <TextInput
                value={amountText}
                onChangeText={setAmountText}
                keyboardType="decimal-pad"
                  // R4-A: money input hygiene — autocorrect bar on Samsung One UI
                  // pushes Confirm off-screen on small devices.
                  autoCorrect={false}
                  autoCapitalize="none"
                  spellCheck={false}
                  returnKeyType="done"
                placeholder="0"
                placeholderTextColor={theme.textMuted}
                style={[styles.input, { color: theme.text }]}
              />
            </Field>

            {type === 'limit' && (
              <Field theme={theme} label="Limit price (USD)">
                <TextInput
                  value={limitText}
                  onChangeText={setLimitText}
                  keyboardType="decimal-pad"
                  // R4-A: money input hygiene — autocorrect bar on Samsung One UI
                  // pushes Confirm off-screen on small devices.
                  autoCorrect={false}
                  autoCapitalize="none"
                  spellCheck={false}
                  returnKeyType="done"
                  placeholder={midPrice.toFixed(2)}
                  placeholderTextColor={theme.textMuted}
                  style={[styles.input, { color: theme.text }]}
                />
              </Field>
            )}

            {type === 'stop' && (
              <Field theme={theme} label="Stop price (USD)">
                <TextInput
                  value={stopText}
                  onChangeText={setStopText}
                  keyboardType="decimal-pad"
                  // R4-A: money input hygiene — autocorrect bar on Samsung One UI
                  // pushes Confirm off-screen on small devices.
                  autoCorrect={false}
                  autoCapitalize="none"
                  spellCheck={false}
                  returnKeyType="done"
                  placeholder={midPrice.toFixed(2)}
                  placeholderTextColor={theme.textMuted}
                  style={[styles.input, { color: theme.text }]}
                />
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
          </ScrollView>

          <TouchableOpacity
            disabled={!valid}
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
            style={[
              styles.confirm,
              { backgroundColor: valid ? (side === 'buy' ? accent.success : accent.danger) : theme.border },
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
            onPress={() => onChange(o.key)}
            style={[
              styles.seg,
              { borderColor: active ? activeColor : theme.border, backgroundColor: active ? activeColor : theme.surfaceElevated },
            ]}
          >
            <Text style={[styles.segText, { color: active ? 'white' : theme.text }]}>{o.label}</Text>
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
  sheet: { borderRadius: responsiveBorderRadius.xl, borderWidth: 1, padding: responsiveSpacing.lg, gap: responsiveSpacing.md, maxHeight: '90%' },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: responsiveFontSize.lg, fontWeight: '700' },
  subtitle: { fontSize: responsiveFontSize.sm },
  segRow: { flexDirection: 'row', gap: responsiveSpacing.xs },
  seg: { flex: 1, paddingVertical: responsiveSpacing.sm, borderRadius: responsiveBorderRadius.lg, borderWidth: 1, alignItems: 'center' },
  segText: { fontSize: responsiveFontSize.sm, fontWeight: '700' },
  fieldLabel: { fontSize: responsiveFontSize.sm, fontWeight: '600', marginBottom: responsiveSpacing.xs },
  fieldRow: { borderWidth: 1, borderRadius: responsiveBorderRadius.lg, paddingHorizontal: responsiveSpacing.md },
  input: { fontSize: responsiveFontSize.lg, fontWeight: '700', paddingVertical: responsiveSpacing.md },
  estimate: { fontSize: responsiveFontSize.xs, fontStyle: 'italic' },
  confirm: { paddingVertical: responsiveSpacing.md, borderRadius: responsiveBorderRadius.lg, alignItems: 'center' },
  confirmText: { color: 'white', fontSize: responsiveFontSize.md, fontWeight: '700' },
});
