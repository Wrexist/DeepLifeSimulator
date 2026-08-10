import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, Modal, TouchableOpacity, TextInput, StyleSheet, ScrollView } from 'react-native';
import { X, AlertCircle } from 'lucide-react-native';
import { GameState, Loan } from '@/contexts/game/types';
import { getLoanQuote } from '@/contexts/game/actions/LoanActions';
import { responsiveFontSize, responsiveSpacing, responsiveBorderRadius, scale } from '@/utils/scaling';
import { hitSlopToMinTarget, minTouchTargetStyle } from '@/utils/touchTargets';
import { getThemeColors, accent } from '@/lib/config/theme';

interface Props {
  visible: boolean;
  gameState: GameState;
  /** Weekly take-home income (career + passive + partner). Caller computes this. */
  weeklyIncome: number;
  darkMode: boolean;
  onAccept: (spec: { principal: number; termWeeks: number; type: Loan['type']; name: string; depositAccountId: string }) => void;
  onClose: () => void;
}

const LOAN_TYPES: { type: Loan['type']; label: string }[] = [
  { type: 'personal', label: 'Personal' },
  { type: 'auto', label: 'Auto' },
  { type: 'business', label: 'Business' },
  { type: 'mortgage', label: 'Mortgage' },
];

const TERM_OPTIONS = [
  { weeks: 26, label: '6 mo' },
  { weeks: 52, label: '1 yr' },
  { weeks: 104, label: '2 yr' },
  { weeks: 260, label: '5 yr' },
];

function formatMoney(n: number): string {
  if (!isFinite(n)) return '$0';
  return `$${Math.round(n).toLocaleString()}`;
}

export default function LoanQuoteModal({ visible, gameState, weeklyIncome, darkMode, onAccept, onClose }: Props) {
  const theme = getThemeColors(darkMode);
  const [type, setType] = useState<Loan['type']>('personal');
  const [termWeeks, setTermWeeks] = useState<number>(52);
  const [principalText, setPrincipalText] = useState('');

  useEffect(() => {
    if (!visible) {
      setType('personal');
      setTermWeeks(52);
      setPrincipalText('');
    }
  }, [visible]);

  const principal = parseFloat(principalText) || 0;
  const checking = useMemo(
    () => gameState.banking?.accounts.find((a) => a.type === 'checking'),
    [gameState.banking]
  );

  const quote = useMemo(() => {
    if (principal <= 0) return null;
    return getLoanQuote(gameState, { principal, termWeeks, type, weeklyIncome });
  }, [gameState, principal, termWeeks, type, weeklyIncome]);

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
            <Text style={[styles.title, { color: theme.text }]}>Apply for a Loan</Text>
            <TouchableOpacity onPress={onClose} hitSlop={hitSlopToMinTarget(scale(20))} style={minTouchTargetStyle} accessibilityRole="button" accessibilityLabel="Close">
              <X size={scale(20)} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={{ flexShrink: 1 }} contentContainerStyle={{ gap: responsiveSpacing.md }}>
            <View>
              <Text style={[styles.fieldLabel, { color: theme.textMuted }]}>Type</Text>
              <View style={styles.chipRow}>
                {LOAN_TYPES.map((t) => (
                  <TouchableOpacity
                    key={t.type}
                    onPress={() => setType(t.type)}
                    style={[
                      styles.chip,
                      {
                        borderColor: type === t.type ? accent.info : theme.border,
                        backgroundColor: type === t.type ? accent.info : theme.surfaceElevated,
                      },
                    ]}
                  >
                    <Text style={[styles.chipText, { color: type === t.type ? 'white' : theme.text }]}>
                      {t.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View>
              <Text style={[styles.fieldLabel, { color: theme.textMuted }]}>Term</Text>
              <View style={styles.chipRow}>
                {TERM_OPTIONS.map((t) => (
                  <TouchableOpacity
                    key={t.weeks}
                    onPress={() => setTermWeeks(t.weeks)}
                    style={[
                      styles.chip,
                      {
                        borderColor: termWeeks === t.weeks ? accent.info : theme.border,
                        backgroundColor: termWeeks === t.weeks ? accent.info : theme.surfaceElevated,
                      },
                    ]}
                  >
                    <Text style={[styles.chipText, { color: termWeeks === t.weeks ? 'white' : theme.text }]}>
                      {t.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View>
              <Text style={[styles.fieldLabel, { color: theme.textMuted }]}>Principal</Text>
              <View style={[styles.inputWrap, { borderColor: theme.border }]}>
                <Text style={[styles.currency, { color: theme.textSecondary }]}>$</Text>
                <TextInput
                  value={principalText}
                  onChangeText={setPrincipalText}
                  keyboardType="decimal-pad"
                  // R4-A: money input hygiene — autocorrect bar on Samsung One UI
                  // pushes Confirm off-screen on small devices.
                  autoCorrect={false}
                  autoCapitalize="none"
                  spellCheck={false}
                  returnKeyType="done"
                  placeholder="5,000"
                  placeholderTextColor={theme.textMuted}
                  style={[styles.input, { color: theme.text }]}
                />
              </View>
            </View>

            {quote && quote.rejected && (
              <View style={styles.rejected}>
                <AlertCircle size={scale(14)} color={accent.danger} />
                <Text style={styles.rejectedText}>{quote.reason}</Text>
              </View>
            )}

            {quote && !quote.rejected && (
              <View style={[styles.quoteCard, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
                <Text style={[styles.quoteTitle, { color: theme.text }]}>Offer</Text>
                <QuoteRow theme={theme} label="APR" value={`${(quote.offeredAPR! * 100).toFixed(2)}%`} />
                <QuoteRow theme={theme} label="Weekly payment" value={formatMoney(quote.weeklyPayment!)} />
                <QuoteRow theme={theme} label="Total repaid" value={formatMoney(quote.totalRepaid!)} />
                <QuoteRow
                  theme={theme}
                  label="Interest"
                  value={formatMoney(quote.totalRepaid! - principal)}
                />
              </View>
            )}
          </ScrollView>

          <TouchableOpacity
            disabled={!quote || quote.rejected || !checking}
            onPress={() => {
              if (!quote || quote.rejected || !checking) return;
              onAccept({
                principal,
                termWeeks,
                type,
                name: `${LOAN_TYPES.find((t) => t.type === type)?.label} ${formatMoney(principal)}`,
                depositAccountId: checking.id,
              });
            }}
            style={[
              styles.confirm,
              { backgroundColor: quote && !quote.rejected && checking ? accent.info : theme.border },
            ]}
          >
            <Text style={styles.confirmText}>Accept Loan</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

function QuoteRow({ theme, label, value }: { theme: ReturnType<typeof getThemeColors>; label: string; value: string }) {
  return (
    <View style={styles.quoteRow}>
      <Text style={[styles.quoteLabel, { color: theme.textMuted }]}>{label}</Text>
      <Text style={[styles.quoteValue, { color: theme.text }]}>{value}</Text>
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
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: responsiveBorderRadius.lg,
    paddingHorizontal: responsiveSpacing.md,
  },
  currency: {
    fontSize: responsiveFontSize.xl,
    fontWeight: '700',
  },
  input: {
    flex: 1,
    fontSize: responsiveFontSize.xl,
    fontWeight: '700',
    paddingVertical: responsiveSpacing.md,
    paddingLeft: responsiveSpacing.xs,
  },
  rejected: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: responsiveSpacing.xs,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    padding: responsiveSpacing.md,
    borderRadius: responsiveBorderRadius.lg,
  },
  rejectedText: {
    flex: 1,
    fontSize: responsiveFontSize.sm,
    color: accent.danger,
    fontWeight: '600',
  },
  quoteCard: {
    padding: responsiveSpacing.md,
    borderRadius: responsiveBorderRadius.lg,
    borderWidth: 1,
    gap: responsiveSpacing.xs,
  },
  quoteTitle: {
    fontSize: responsiveFontSize.md,
    fontWeight: '700',
    marginBottom: responsiveSpacing.xs,
  },
  quoteRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  quoteLabel: {
    fontSize: responsiveFontSize.sm,
  },
  quoteValue: {
    fontSize: responsiveFontSize.sm,
    fontWeight: '700',
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
