import React, { useState, useEffect } from 'react';
import { View, Text, Modal, TouchableOpacity, TextInput, StyleSheet, ScrollView } from 'react-native';
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
    description: 'Highest APR. Locked for one year — no withdrawals.',
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
  /** Current weeksLived — used to set lockUntilWeek when opening a CD. */
  currentWeek: number;
}

export default function OpenAccountModal({ visible, availableCash, darkMode, onOpen, onClose, currentWeek }: Props) {
  const theme = getThemeColors(darkMode);
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

  const deposit = parseFloat(depositText) || 0;
  const canOpen =
    selected != null &&
    name.trim().length > 0 &&
    deposit >= selected.minDeposit &&
    deposit <= availableCash;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
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

          <ScrollView style={{ flexShrink: 1 }} contentContainerStyle={{ gap: responsiveSpacing.sm }}>
            {PRODUCTS.map((p) => {
              const active = selected?.type === p.type;
              const Icon = p.icon;
              return (
                <TouchableOpacity
                  key={p.type}
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
          </ScrollView>

          {selected && (
            <View style={{ gap: responsiveSpacing.sm }}>
              <View style={[styles.fieldRow, { borderColor: theme.border }]}>
                <Text style={[styles.fieldLabel, { color: theme.textMuted }]}>Name</Text>
                <TextInput
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
              <View style={[styles.fieldRow, { borderColor: theme.border }]}>
                <Text style={[styles.fieldLabel, { color: theme.textMuted }]}>Deposit</Text>
                <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>$</Text>
                <TextInput
                  value={depositText}
                  onChangeText={setDepositText}
                  keyboardType="decimal-pad"
                  // R4-A: money input hygiene — autocorrect bar on Samsung One UI
                  // pushes Confirm off-screen on small devices.
                  autoCorrect={false}
                  autoCapitalize="none"
                  spellCheck={false}
                  returnKeyType="done"
                  placeholder={String(selected.minDeposit)}
                  placeholderTextColor={theme.textMuted}
                  style={[styles.fieldInput, { color: theme.text }]}
                />
              </View>
              <Text style={[styles.meta, { color: theme.textMuted }]}>
                Available cash: {formatMoney(availableCash)}
              </Text>
            </View>
          )}

          <TouchableOpacity
            disabled={!canOpen}
            onPress={() => {
              if (!selected) return;
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
      </View>
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
  // button lands off the bottom of the SCREEN — and the sheet itself does not
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
