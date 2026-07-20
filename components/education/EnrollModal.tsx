import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { X, GraduationCap, AlertCircle, BookOpen, Check } from 'lucide-react-native';
import { GameState } from '@/contexts/game/types';
import { quoteEnrollment } from '@/contexts/game/actions/EducationActions';
import {
  getAvailableClasses,
  MAX_CLASSES_PER_SEMESTER,
  MIN_CLASSES_PER_SEMESTER,
  type ClassTemplate,
} from '@/lib/education/educationSystem';
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
  onConfirm: (mode: 'cash' | 'loan', classIds: string[]) => void;
}

/** Short label for a class's summed stat bonuses, e.g. "+4 rep · +1 happy". */
function bonusLabel(c: ClassTemplate): string {
  const parts: string[] = [];
  const b = c.statBonuses || {};
  const short: Record<string, string> = {
    reputation: 'rep', happiness: 'happy', health: 'health', fitness: 'fit', energy: 'energy',
  };
  for (const [k, v] of Object.entries(b)) {
    if (v) parts.push(`+${v} ${short[k] ?? k}`);
  }
  return parts.join(' · ');
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
  // Offered classes for this program (derived once per open — getAvailableClasses
  // shuffles, so we freeze it in state to keep the picker stable across renders).
  const [offered, setOffered] = useState<ClassTemplate[]>([]);
  const [selected, setSelected] = useState<string[]>([]);

  useEffect(() => {
    if (visible && template) {
      setMode('cash');
      setOffered(getAvailableClasses(template.id, []));
      setSelected([]);
    }
  }, [visible, template]);

  const quote = useMemo(
    () => (template ? quoteEnrollment(gameState, template) : null),
    [template, gameState]
  );

  const toggleClass = (id: string) => {
    setSelected((cur) => {
      if (cur.includes(id)) return cur.filter((c) => c !== id);
      if (cur.length >= MAX_CLASSES_PER_SEMESTER) return cur; // cap
      return [...cur, id];
    });
  };

  // Auto-pick fallback: if the player skips, seed the first few offered classes
  // so enrolment never blocks on the picker (goal-statement guardrail).
  const resolvedClassIds = (): string[] => {
    if (selected.length > 0) return selected;
    return offered.slice(0, Math.min(MAX_CLASSES_PER_SEMESTER, offered.length)).map((c) => c.id);
  };

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
                  <View style={styles.eligibilityRow}>
                    <GraduationCap size={scale(13)} color={accent.success} />
                    <Text style={[styles.eligibilityText, { color: accent.success }]}>
                      {quote.scholarship.eligibility === 'full'
                        ? 'Full ride — your GPA earned you this'
                        : quote.scholarship.eligibility === 'half'
                          ? 'Half-off — your record speaks for itself'
                          : 'Partial aid awarded'}
                    </Text>
                  </View>
                )}
              </View>
            )}

            {offered.length > 0 && (
              <View style={{ gap: responsiveSpacing.xs }}>
                <View style={styles.classHeaderRow}>
                  <BookOpen size={scale(14)} color={accent.info} />
                  <Text style={[styles.classHeader, { color: theme.text }]}>
                    Choose your classes
                  </Text>
                  <Text style={[styles.classCount, { color: theme.textMuted }]}>
                    {selected.length > 0
                      ? `${selected.length}/${MAX_CLASSES_PER_SEMESTER}`
                      : `pick ${MIN_CLASSES_PER_SEMESTER}-${MAX_CLASSES_PER_SEMESTER}`}
                  </Text>
                </View>
                {offered.map((c) => {
                  const on = selected.includes(c.id);
                  const atCap = !on && selected.length >= MAX_CLASSES_PER_SEMESTER;
                  return (
                    <TouchableOpacity
                      key={c.id}
                      onPress={() => toggleClass(c.id)}
                      disabled={atCap}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: on, disabled: atCap }}
                      accessibilityLabel={`${c.name}${on ? ', selected' : ''}`}
                      style={[
                        styles.classTile,
                        {
                          borderColor: on ? accent.info : theme.border,
                          backgroundColor: on ? 'rgba(59,130,246,0.10)' : theme.surfaceElevated,
                          opacity: atCap ? 0.45 : 1,
                        },
                      ]}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.classTitle, { color: theme.text }]} numberOfLines={1}>
                          {c.name}
                        </Text>
                        <Text style={[styles.classMeta, { color: theme.textMuted }]} numberOfLines={1}>
                          {c.category} · diff {c.difficulty}/3{bonusLabel(c) ? ` · ${bonusLabel(c)}` : ''}
                        </Text>
                      </View>
                      <View
                        style={[
                          styles.classCheck,
                          { borderColor: on ? accent.info : theme.border, backgroundColor: on ? accent.info : 'transparent' },
                        ]}
                      >
                        {on && <Check size={scale(12)} color="white" />}
                      </View>
                    </TouchableOpacity>
                  );
                })}
                <Text style={[styles.classHint, { color: theme.textMuted }]}>
                  Skip to auto-pick. Classes grant stat bonuses when you graduate.
                </Text>
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
            onPress={() => onConfirm(mode, resolvedClassIds())}
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
  eligibilityText: { fontSize: responsiveFontSize.xs, fontWeight: '700' },
  eligibilityRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 },
  classHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: responsiveSpacing.xs },
  classHeader: { flex: 1, fontSize: responsiveFontSize.sm, fontWeight: '700' },
  classCount: { fontSize: responsiveFontSize.xs, fontWeight: '600' },
  classTile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: responsiveSpacing.sm,
    padding: responsiveSpacing.md,
    borderRadius: responsiveBorderRadius.lg,
    borderWidth: 1,
  },
  classTitle: { fontSize: responsiveFontSize.sm, fontWeight: '600' },
  classMeta: { fontSize: responsiveFontSize.xs, marginTop: 2 },
  classCheck: {
    width: scale(20),
    height: scale(20),
    borderRadius: scale(6),
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  classHint: { fontSize: responsiveFontSize.xs, fontStyle: 'italic' },
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
