import AmountSlider from '@/components/ui/AmountSlider';
import { parseAmount } from '@/utils/parseAmount';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import React, { useState, useEffect } from 'react';
import { View, Text, Modal, TouchableOpacity, TextInput, StyleSheet, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { X, PiggyBank, Lock, TrendingUp, Briefcase } from 'lucide-react-native';
import { BankAccountType } from '@/contexts/game/types';
import { responsiveFontSize, responsiveSpacing, responsiveBorderRadius, scale } from '@/utils/scaling';
import { hitSlopToMinTarget, minTouchTargetStyle } from '@/utils/touchTargets';
import { getThemeColors, accent } from '@/lib/config/theme';
import { formatMoney } from '@/utils/moneyFormatting';

interface AccountProduct {
  type: BankAccountType;
  name: string;
  description: string;
  baseAPR: number;
  /** Lock-up in weeks (0 = no lock). */
  lockWeeks: number;
  minDeposit: number;
  icon: React.ComponentType<{ size: number; color: string }>;
}

const PRODUCTS: AccountProduct[] = [
  {
    type: 'savings',
    name: 'Savings',
    description: 'Basic savings account. Modest APR, fully liquid.',
    baseAPR: 0.02,
    lockWeeks: 0,
    minDeposit: 0,
    icon: PiggyBank,
  },
  {
    type: 'highYieldSavings',
    name: 'High-Yield Savings',
    description: 'Higher APR, fully liquid. Requires $1,000 to open.',
    baseAPR: 0.045,
    lockWeeks: 0,
    minDeposit: 1000,
    icon: TrendingUp,
  },
  {
    type: 'cd',
    name: '52-Week CD',
    description: 'Highest APR. Locked for one year - no withdrawals.',
    baseAPR: 0.055,
    lockWeeks: 52,
    minDeposit: 500,
    icon: Lock,
  },
  {
    type: 'moneyMarket',
    name: 'Money Market',
    description: 'Liquid + check writing. Requires $2,500 minimum balance.',
    baseAPR: 0.035,
    lockWeeks: 0,
    minDeposit: 2500,
    icon: Briefcase,
  },
];

interface Props {
  visible: boolean;
  availableCash: number;
  darkMode: boolean;
  onOpen: (spec: {
    type: BankAccountType;
    name: string;
    initialDeposit: number;
    baseAPR: number;
    lockUntilWeek?: number;
    minBalance?: number;
  }) => void;
  onClose: () => void;
  /** Current weeksLived - used to set lockUntilWeek when opening a CD. */
  currentWeek: number;
}

export default function OpenAccountModal({ visible, availableCash, darkMode, onOpen, onClose, currentWeek }: Props) {
  const theme = getThemeColors(darkMode);
  const reducedMotion = useReducedMotion();
  const [selected, setSelected] = useState<AccountProduct | null>(null);
  const [name, setName] = useState('');
  const [depositText, setDepositText] = useState('');

  useEffect(() => {
    if (!visible) {
      setSelected(null);
      setName('');
      setDepositText('');
    }
  }, [visible]);

  const deposit = parseAmount(depositText);
  const canOpen =
    selected != null &&
    name.trim().length > 0 &&
    deposit !== null &&
    deposit >= selected.minDeposit &&
    deposit <= availableCash;

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
        <View style={[styles.sheet, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={styles.headerRow}>
            <Text style={[styles.title, { color: theme.text }]}>Open Account</Text>
            <TouchableOpacity onPress={onClose} hitSlop={hitSlopToMinTarget(scale(20))} style={minTouchTargetStyle} accessibilityRole="button" accessibilityLabel="Close">
              <X size={scale(20)} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView keyboardShouldPersistTaps="handled" style={{ flexShrink: 1 }} contentContainerStyle={{ gap: responsiveSpacing.sm }}>
            {PRODUCTS.map((p) => {
              const active = selected?.type === p.type;
              const Icon = p.icon;
              return (
                <TouchableOpacity
                  key={p.type}
                  accessibilityRole="radio"
                  accessibilityLabel={p.name}
                  accessibilityState={{ selected: active }}
                  onPress={() => {
                    setSelected(p);
                    if (!name) setName(p.name);
                  }}
                  style={[
                    styles.product,
                    {
                      backgroundColor: theme.surfaceElevated,
                      borderColor: active ? accent.info : theme.border,
                      borderWidth: active ? 2 : 1,
                    },
                  ]}
                >
                  <View style={[styles.icon, { backgroundColor: theme.surface }]}>
                    <Icon size={scale(18)} color={theme.text} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={styles.productHeader}>
                      <Text style={[styles.productName, { color: theme.text }]}>{p.name}</Text>
                      <Text style={styles.apr}>{(p.baseAPR * 100).toFixed(2)}% APR</Text>
                    </View>
                    <Text style={[styles.productDesc, { color: theme.textMuted }]}>{p.description}</Text>
                    <Text style={[styles.meta, { color: theme.textMuted }]}>
                      Min ${p.minDeposit.toLocaleString()}
                      {p.lockWeeks > 0 ? ` · Locked ${p.lockWeeks}w` : ''}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}

          {selected && (
            <View style={{ gap: responsiveSpacing.sm }}>
              <View style={[styles.fieldRow, { borderColor: theme.border }]}>
                <Text style={[styles.fieldLabel, { color: theme.textMuted }]}>Name</Text>
                <TextInput
                  accessibilityLabel="Account name"
                  value={name}
                  onChangeText={setName}
                  placeholder="Account name"
                  placeholderTextColor={theme.textMuted}
                  // Unbounded, and the label is rendered on every account row
                  // in the banking list afterwards.
                  maxLength={30}
                  style={[styles.fieldInput, { color: theme.text }]}
                />
              </View>
              <View style={{ gap: responsiveSpacing.xs }}>
                <Text style={[styles.fieldLabel, { color: theme.textMuted }]}>Opening deposit</Text>
                <AmountSlider value={depositText} onChangeText={setDepositText} accessibilityLabel="Opening deposit in dollars" maxAmount={availableCash} darkMode={darkMode} />
              </View>
              {depositText.trim() !== '' && deposit === null && (
                <Text accessibilityRole="alert" style={[styles.meta, { color: accent.danger }]}>Enter a valid amount, such as 1,000.50.</Text>
              )}
              <Text style={[styles.meta, { color: theme.textMuted }]}>
                Available cash: {formatMoney(availableCash)}
              </Text>
            </View>
          )}

          </ScrollView>
          {selected && deposit !== null && <Text style={[styles.meta, { color: theme.textSecondary }]}>{selected.name}: ${deposit.toLocaleString('en-US', { maximumFractionDigits: 2 })} deposit</Text>}
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Open account"
            accessibilityState={{ disabled: !canOpen }}
            disabled={!canOpen}
            onPress={() => {
              if (!canOpen || !selected || deposit === null) return;
              onOpen({
                type: selected.type,
                name: name.trim() || selected.name,
                initialDeposit: deposit,
                baseAPR: selected.baseAPR,
                lockUntilWeek: selected.lockWeeks > 0 ? currentWeek + selected.lockWeeks : undefined,
                minBalance: selected.type === 'moneyMarket' ? selected.minDeposit : undefined,
              });
            }}
            style={[styles.confirm, { backgroundColor: canOpen ? accent.info : theme.border }]}
          >
            <Text style={styles.confirmText}>Open Account</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: responsiveSpacing.lg,
  },
  backdropTouch: {
    ...StyleSheet.absoluteFillObject,
  },
  // `maxHeight` + `flexShrink` on the list below, together. A bottom sheet with
  // no height bound grows to fit its content, so on a short screen its footer
  // button lands off the bottom of the SCREEN - and the sheet itself does not
  // scroll, so nothing can reach it. Bounding the sheet is what gives the list
  // something to shrink within. Same fix as ApplyCardModal (2026-08-02).
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
  product: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: responsiveSpacing.sm,
    padding: responsiveSpacing.md,
    borderRadius: responsiveBorderRadius.lg,
  },
  icon: {
    width: scale(36),
    height: scale(36),
    borderRadius: scale(18),
    alignItems: 'center',
    justifyContent: 'center',
  },
  productHeader: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: responsiveSpacing.xs,
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  productName: {
    fontSize: responsiveFontSize.md,
    fontWeight: '700',
  },
  apr: {
    fontSize: responsiveFontSize.sm,
    color: accent.success,
    fontWeight: '700',
  },
  productDesc: {
    fontSize: responsiveFontSize.sm,
    marginTop: 2,
  },
  meta: {
    fontSize: responsiveFontSize.xs,
    marginTop: 2,
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: responsiveBorderRadius.lg,
    paddingHorizontal: responsiveSpacing.md,
    paddingVertical: responsiveSpacing.sm,
    gap: responsiveSpacing.xs,
  },
  fieldLabel: {
    fontSize: responsiveFontSize.sm,
    fontWeight: '600',
  },
  fieldInput: {
    flex: 1,
    fontSize: responsiveFontSize.md,
    fontWeight: '600',
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
