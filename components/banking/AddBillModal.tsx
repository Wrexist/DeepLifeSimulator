import React, { useState, useEffect } from 'react';
import { View, Text, Modal, TouchableOpacity, TextInput, StyleSheet, ScrollView } from 'react-native';
import { X } from 'lucide-react-native';
import { BankAccount, BudgetCategory } from '@/contexts/game/types';
import { responsiveFontSize, responsiveSpacing, responsiveBorderRadius, scale } from '@/utils/scaling';
import { hitSlopToMinTarget, minTouchTargetStyle } from '@/utils/touchTargets';
import { getThemeColors, accent } from '@/lib/config/theme';

interface Props {
  visible: boolean;
  accounts: BankAccount[];
  currentWeek: number;
  darkMode: boolean;
  onAdd: (rule: {
    label: string;
    category: BudgetCategory;
    amount: number;
    fromAccountId: string;
    cadence: 'weekly' | 'monthly';
    nextDueWeek: number;
    source: 'subscription' | 'utility' | 'manual';
  }) => void;
  onClose: () => void;
}

const CATEGORIES: { id: BudgetCategory; label: string }[] = [
  { id: 'housing', label: 'Housing' },
  { id: 'food', label: 'Food' },
  { id: 'transport', label: 'Transport' },
  { id: 'health', label: 'Health' },
  { id: 'entertainment', label: 'Entertainment' },
  { id: 'lifestyle', label: 'Lifestyle' },
  { id: 'other', label: 'Other' },
];

export default function AddBillModal({ visible, accounts, currentWeek, darkMode, onAdd, onClose }: Props) {
  const theme = getThemeColors(darkMode);
  const [label, setLabel] = useState('');
  const [amountText, setAmountText] = useState('');
  const [category, setCategory] = useState<BudgetCategory>('lifestyle');
  const [cadence, setCadence] = useState<'weekly' | 'monthly'>('monthly');
  const [accountId, setAccountId] = useState<string>(accounts[0]?.id ?? '');

  useEffect(() => {
    if (!visible) {
      setLabel('');
      setAmountText('');
      setCategory('lifestyle');
      setCadence('monthly');
      setAccountId(accounts[0]?.id ?? '');
    }
  }, [visible, accounts]);

  const amount = parseFloat(amountText) || 0;
  const checkingAccounts = accounts.filter((a) => a.type === 'checking');
  const canAdd = label.trim().length > 0 && amount > 0 && accountId.length > 0;

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
            <Text style={[styles.title, { color: theme.text }]}>Add Bill</Text>
            <TouchableOpacity onPress={onClose} hitSlop={hitSlopToMinTarget(scale(20))} style={minTouchTargetStyle} accessibilityRole="button" accessibilityLabel="Close">
              <X size={scale(20)} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={{ flexShrink: 1 }} contentContainerStyle={{ gap: responsiveSpacing.md }}>
            <Field label="Label" theme={theme}>
              <TextInput
                value={label}
                onChangeText={setLabel}
                placeholder="Netflix, Gym, Phone…"
                placeholderTextColor={theme.textMuted}
                style={[styles.input, { color: theme.text }]}
              />
            </Field>

            <Field label="Amount" theme={theme}>
              <Text style={[styles.currency, { color: theme.textSecondary }]}>$</Text>
              <TextInput
                value={amountText}
                onChangeText={setAmountText}
                keyboardType="decimal-pad"
                  // R4-A: money input hygiene - autocorrect bar on Samsung One UI
                  // pushes Confirm off-screen on small devices.
                  autoCorrect={false}
                  autoCapitalize="none"
                  spellCheck={false}
                  returnKeyType="done"
                placeholder="50"
                placeholderTextColor={theme.textMuted}
                style={[styles.input, { color: theme.text }]}
              />
            </Field>

            <View>
              <Text style={[styles.fieldLabel, { color: theme.textMuted }]}>Category</Text>
              <View style={styles.chipRow}>
                {CATEGORIES.map((c) => (
                  <Chip
                    key={c.id}
                    label={c.label}
                    active={category === c.id}
                    theme={theme}
                    onPress={() => setCategory(c.id)}
                  />
                ))}
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
                {checkingAccounts.map((a) => (
                  <Chip
                    key={a.id}
                    label={`${a.name} ($${Math.round(a.balance).toLocaleString()})`}
                    active={accountId === a.id}
                    theme={theme}
                    onPress={() => setAccountId(a.id)}
                  />
                ))}
              </View>
            </View>
          </ScrollView>

          <TouchableOpacity
            disabled={!canAdd}
            onPress={() =>
              onAdd({
                label: label.trim(),
                category,
                amount,
                fromAccountId: accountId,
                cadence,
                nextDueWeek: currentWeek + (cadence === 'weekly' ? 1 : 4),
                source: 'subscription',
              })
            }
            style={[styles.confirm, { backgroundColor: canAdd ? accent.info : theme.border }]}
          >
            <Text style={styles.confirmText}>Add Bill</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

function Field({ label, theme, children }: { label: string; theme: ReturnType<typeof getThemeColors>; children: React.ReactNode }) {
  return (
    <View>
      <Text style={[styles.fieldLabel, { color: theme.textMuted }]}>{label}</Text>
      <View style={[styles.fieldRow, { borderColor: theme.border }]}>{children}</View>
    </View>
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
  backdropTouch: {
    ...StyleSheet.absoluteFillObject,
  },
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
    paddingVertical: responsiveSpacing.sm,
    gap: responsiveSpacing.xs,
  },
  input: {
    flex: 1,
    fontSize: responsiveFontSize.md,
    fontWeight: '600',
  },
  currency: {
    fontSize: responsiveFontSize.md,
    fontWeight: '700',
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
  chipText: {
    fontSize: responsiveFontSize.sm,
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
