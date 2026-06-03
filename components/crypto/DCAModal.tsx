import React, { useState, useEffect } from 'react';
import { View, Text, Modal, TouchableOpacity, TextInput, StyleSheet, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { X } from 'lucide-react-native';
import { BankAccount, Crypto } from '@/contexts/game/types';
import { responsiveFontSize, responsiveSpacing, responsiveBorderRadius, scale } from '@/utils/scaling';
import { getThemeColors, accent } from '@/lib/config/theme';

interface Props {
  visible: boolean;
  cryptos: Crypto[];
  accounts: BankAccount[];
  darkMode: boolean;
  onClose: () => void;
  onSubmit: (input: {
    cryptoId: string;
    amount: number;
    fromAccountId: string;
    cadence: 'weekly' | 'monthly';
  }) => void;
}

export default function DCAModal({ visible, cryptos, accounts, darkMode, onClose, onSubmit }: Props) {
  const theme = getThemeColors(darkMode);
  const [cryptoId, setCryptoId] = useState<string>(cryptos[0]?.id ?? '');
  const [amountText, setAmountText] = useState('');
  const [cadence, setCadence] = useState<'weekly' | 'monthly'>('weekly');
  const checkingAccounts = accounts.filter((a) => a.type === 'checking');
  const [accountId, setAccountId] = useState<string>(checkingAccounts[0]?.id ?? '');

  useEffect(() => {
    if (visible) {
      setCryptoId(cryptos[0]?.id ?? '');
      setAmountText('');
      setCadence('weekly');
      setAccountId(checkingAccounts[0]?.id ?? '');
    }
  }, [visible, cryptos, checkingAccounts]);

  const amount = parseFloat(amountText) || 0;
  const canSubmit = cryptoId && amount > 0 && accountId;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.backdrop}>
        <TouchableOpacity style={styles.backdropTouch} activeOpacity={1} onPress={onClose} />
        <View style={[styles.sheet, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={styles.headerRow}>
            <Text style={[styles.title, { color: theme.text }]}>Schedule DCA Buy</Text>
            <TouchableOpacity onPress={onClose} hitSlop={10}>
              <X size={scale(20)} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={{ gap: responsiveSpacing.md }}>
            <Text style={[styles.subtitle, { color: theme.textMuted }]}>
              Auto-buys debit from a bank account on a schedule. Stops once the source account runs dry.
            </Text>

            <View>
              <Text style={[styles.fieldLabel, { color: theme.textMuted }]}>Coin</Text>
              <View style={styles.chipRow}>
                {cryptos.map((c) => (
                  <Chip
                    key={c.id}
                    label={c.symbol}
                    active={cryptoId === c.id}
                    theme={theme}
                    onPress={() => setCryptoId(c.id)}
                  />
                ))}
              </View>
            </View>

            <View>
              <Text style={[styles.fieldLabel, { color: theme.textMuted }]}>Amount per buy (USD)</Text>
              <View style={[styles.fieldRow, { borderColor: theme.border }]}>
                <Text style={[styles.currency, { color: theme.textSecondary }]}>$</Text>
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
                  placeholder="100"
                  placeholderTextColor={theme.textMuted}
                  style={[styles.input, { color: theme.text }]}
                />
              </View>
            </View>

            <View>
              <Text style={[styles.fieldLabel, { color: theme.textMuted }]}>Cadence</Text>
              <View style={styles.chipRow}>
                <Chip label="Weekly" active={cadence === 'weekly'} theme={theme} onPress={() => setCadence('weekly')} />
                <Chip label="Monthly" active={cadence === 'monthly'} theme={theme} onPress={() => setCadence('monthly')} />
              </View>
            </View>

            <View>
              <Text style={[styles.fieldLabel, { color: theme.textMuted }]}>From account</Text>
              <View style={styles.chipRow}>
                {checkingAccounts.length === 0 ? (
                  <Text style={[styles.warning, { color: accent.danger }]}>
                    Open a checking account first.
                  </Text>
                ) : (
                  checkingAccounts.map((a) => (
                    <Chip
                      key={a.id}
                      label={`${a.name} ($${Math.round(a.balance).toLocaleString()})`}
                      active={accountId === a.id}
                      theme={theme}
                      onPress={() => setAccountId(a.id)}
                    />
                  ))
                )}
              </View>
            </View>
          </ScrollView>

          <TouchableOpacity
            disabled={!canSubmit}
            onPress={() => onSubmit({ cryptoId, amount, fromAccountId: accountId, cadence })}
            style={[styles.confirm, { backgroundColor: canSubmit ? accent.info : theme.border }]}
          >
            <Text style={styles.confirmText}>Schedule</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function Chip({
  label,
  active,
  theme,
  onPress,
}: {
  label: string;
  active: boolean;
  theme: ReturnType<typeof getThemeColors>;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[
        styles.chip,
        {
          borderColor: active ? accent.info : theme.border,
          backgroundColor: active ? accent.info : theme.surfaceElevated,
        },
      ]}
    >
      <Text style={[styles.chipText, { color: active ? 'white' : theme.text }]}>{label}</Text>
    </TouchableOpacity>
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
  title: { fontSize: responsiveFontSize.lg, fontWeight: '700' },
  subtitle: { fontSize: responsiveFontSize.sm },
  fieldLabel: {
    fontSize: responsiveFontSize.sm,
    fontWeight: '600',
    marginBottom: responsiveSpacing.xs,
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: responsiveBorderRadius.lg,
    paddingHorizontal: responsiveSpacing.md,
    gap: responsiveSpacing.xs,
  },
  currency: { fontSize: responsiveFontSize.lg, fontWeight: '700' },
  input: {
    flex: 1,
    fontSize: responsiveFontSize.lg,
    fontWeight: '700',
    paddingVertical: responsiveSpacing.md,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: responsiveSpacing.xs,
  },
  chip: {
    paddingHorizontal: responsiveSpacing.md,
    paddingVertical: responsiveSpacing.xs,
    borderRadius: responsiveBorderRadius.full,
    borderWidth: 1,
  },
  chipText: { fontSize: responsiveFontSize.sm, fontWeight: '600' },
  warning: { fontSize: responsiveFontSize.sm, fontWeight: '600' },
  confirm: {
    paddingVertical: responsiveSpacing.md,
    borderRadius: responsiveBorderRadius.lg,
    alignItems: 'center',
  },
  confirmText: { color: 'white', fontSize: responsiveFontSize.md, fontWeight: '700' },
});
