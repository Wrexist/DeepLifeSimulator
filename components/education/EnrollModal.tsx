import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { X, GraduationCap, AlertCircle } from 'lucide-react-native';
import { GameState } from '@/contexts/game/types';
import { quoteEnrollment } from '@/contexts/game/actions/EducationActions';
import { responsiveFontSize, responsiveSpacing, responsiveBorderRadius, scale } from '@/utils/scaling';
import { getThemeColors, accent } from '@/lib/config/theme';

export interface EnrollTemplate {
  id: string;
  name: string;
  description: string;
  cost: number;
  duration: number;
}

interface Props {
  visible: boolean;
  template: EnrollTemplate | null;
  gameState: GameState;
  darkMode: boolean;
  onClose: () => void;
  onConfirm: (mode: 'cash' | 'loan') => void;
}

function formatMoney(n: number): string {
  if (!isFinite(n)) return '$0';
  const abs = Math.abs(n);
  if (abs >= 10_000) return `${n < 0 ? '-' : ''}$${(abs / 1000).toFixed(1)}k`;
  return `$${Math.round(n).toLocaleString()}`;
}

export default function EnrollModal({ visible, template, gameState, darkMode, onClose, onConfirm }: Props) {
  const theme = getThemeColors(darkMode);
  const [mode, setMode] = useState<'cash' | 'loan'>('cash');

  useEffect(() => {
    if (visible) setMode('cash');
  }, [visible]);

  const quote = useMemo(
    () => (template ? quoteEnrollment(gameState, template) : null),
    [template, gameState]
  );

  if (!template) return null;

  const canCash = quote ? quote.canAffordCash : false;
  const canLoan = quote ? quote.netCost > 0 : false;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <TouchableOpacity style={styles.backdropTouch} activeOpacity={1} onPress={onClose} />
        <View style={[styles.sheet, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={styles.headerRow}>
            <View style={[styles.iconBubble, { backgroundColor: accent.info }]}>
              <GraduationCap size={scale(20)} color="white" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.title, { color: theme.text }]}>{template.name}</Text>
              <Text style={[styles.subtitle, { color: theme.textMuted }]}>
                {formatMoney(template.cost)} · {template.duration}w
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={10}>
              <X size={scale(20)} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={{ gap: responsiveSpacing.md }}>
            <Text style={[styles.body, { color: theme.textSecondary }]}>{template.description}</Text>

            {quote && (
              <View style={[styles.quoteCard, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
                <Row theme={theme} label="Tuition" value={formatMoney(quote.cost)} />
                {quote.scholarship.totalUSD > 0 && (
                  <Row
                    theme={theme}
                    label="Scholarship aid"
                    value={`−${formatMoney(quote.scholarship.totalUSD)}`}
                    accentColor={accent.success}
                  />
                )}
                <Row
                  theme={theme}
                  label="Net cost"
                  value={formatMoney(quote.netCost)}
                  highlight
                />
                {quote.weeksReductionFromPolitics > 0 && (
                  <Row
                    theme={theme}
                    label="Politics fast-track"
                    value={`−${quote.weeksReductionFromPolitics}w`}
                    accentColor={accent.purple}
                  />
                )}
                {quote.scholarship.eligibility !== 'none' && (
                  <Text style={[styles.eligibilityText, { color: accent.success }]}>
                    {quote.scholarship.eligibility === 'full'
                      ? '🎓 Full ride — your GPA earned you this'
                      : quote.scholarship.eligibility === 'half'
                        ? '🎓 Half-off — your record speaks for itself'
                        : '🎓 Partial aid awarded'}
                  </Text>
                )}
              </View>
            )}

            <View style={styles.segRow}>
              <TouchableOpacity
                onPress={() => setMode('cash')}
                disabled={!canCash}
                style={[
                  styles.segBtn,
                  {
                    borderColor: mode === 'cash' && canCash ? accent.success : theme.border,
                    backgroundColor: mode === 'cash' && canCash ? accent.success : theme.surfaceElevated,
                    opacity: canCash ? 1 : 0.45,
                  },
                ]}
              >
                <Text style={[styles.segText, { color: mode === 'cash' && canCash ? 'white' : theme.text }]}>
                  Pay cash
                </Text>
                <Text style={[styles.segSub, { color: mode === 'cash' && canCash ? 'white' : theme.textMuted }]}>
                  Cash on hand: {formatMoney(quote?.cash ?? 0)}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setMode('loan')}
                disabled={!canLoan}
                style={[
                  styles.segBtn,
                  {
                    borderColor: mode === 'loan' && canLoan ? accent.info : theme.border,
                    backgroundColor: mode === 'loan' && canLoan ? accent.info : theme.surfaceElevated,
                    opacity: canLoan ? 1 : 0.45,
                  },
                ]}
              >
                <Text style={[styles.segText, { color: mode === 'loan' && canLoan ? 'white' : theme.text }]}>
                  Student loan
                </Text>
                <Text style={[styles.segSub, { color: mode === 'loan' && canLoan ? 'white' : theme.textMuted }]}>
                  10-year, ~6% APR
                </Text>
              </TouchableOpacity>
            </View>

            {!canCash && mode === 'cash' && quote && (
              <View style={[styles.errorRow, { backgroundColor: 'rgba(239,68,68,0.1)' }]}>
                <AlertCircle size={scale(14)} color={accent.danger} />
                <Text style={[styles.errorText, { color: accent.danger }]}>
                  Need {formatMoney(quote.netCost - quote.cash)} more cash to enroll.
                </Text>
              </View>
            )}
          </ScrollView>

          <TouchableOpacity
            disabled={mode === 'cash' ? !canCash : !canLoan}
            onPress={() => onConfirm(mode)}
            style={[
              styles.confirm,
              {
                backgroundColor:
                  (mode === 'cash' ? canCash : canLoan) ? (mode === 'cash' ? accent.success : accent.info) : theme.border,
              },
            ]}
          >
            <Text style={styles.confirmText}>
              {mode === 'cash' ? `Pay ${formatMoney(quote?.netCost ?? 0)}` : 'Sign Student Loan'}
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
  accentColor,
}: {
  theme: ReturnType<typeof getThemeColors>;
  label: string;
  value: string;
  highlight?: boolean;
  accentColor?: string;
}) {
  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, { color: theme.textMuted }]}>{label}</Text>
      <Text
        style={[
          styles.rowValue,
          {
            color: accentColor ?? (highlight ? theme.text : theme.textSecondary),
            fontWeight: highlight ? '800' : '600',
          },
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
  quoteCard: {
    padding: responsiveSpacing.md,
    borderRadius: responsiveBorderRadius.lg,
    borderWidth: 1,
    gap: 4,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  rowLabel: { fontSize: responsiveFontSize.sm },
  rowValue: { fontSize: responsiveFontSize.sm },
  eligibilityText: { fontSize: responsiveFontSize.xs, fontWeight: '700', marginTop: 4 },
  segRow: { flexDirection: 'row', gap: responsiveSpacing.xs },
  segBtn: {
    flex: 1,
    padding: responsiveSpacing.md,
    borderRadius: responsiveBorderRadius.lg,
    borderWidth: 1,
    alignItems: 'center',
  },
  segText: { fontSize: responsiveFontSize.sm, fontWeight: '700' },
  segSub: { fontSize: responsiveFontSize.xs, marginTop: 2 },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: responsiveSpacing.xs,
    padding: responsiveSpacing.md,
    borderRadius: responsiveBorderRadius.lg,
  },
  errorText: { flex: 1, fontSize: responsiveFontSize.sm, fontWeight: '600' },
  confirm: {
    paddingVertical: responsiveSpacing.md,
    borderRadius: responsiveBorderRadius.lg,
    alignItems: 'center',
  },
  confirmText: { color: 'white', fontSize: responsiveFontSize.md, fontWeight: '700' },
});
