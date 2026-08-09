/**
 * Year in Review — what one story-mode tap did.
 *
 * WHY THIS EXISTS AT ALL
 * ----------------------
 * A story tap runs 52 weekly ticks with the per-week banners suppressed, because
 * 52 of them would either flood the screen or (with the fixed-id summary banner)
 * overwrite each other until only the last week survived. Suppressing them
 * without replacing them would make a whole year pass in silence, which is worse
 * than the noise. This is the replacement: one surface, at the natural
 * breakpoint, carrying the year rather than the week.
 *
 * The numbers come from `summarizeYear`, which joins the batch's "before"
 * snapshot to live state — see `lib/gameMode/mode.ts` for why the batch cannot
 * honestly report its own "after".
 *
 * NOT SHOWN ON DEATH. The death screen is the bigger moment and owns the
 * screen; stacking a recap on top of it would bury the obituary. The caller
 * checks `outcome === 'death'` and skips.
 *
 * Layout follows the sheet rule from tasks/lessons.md: the bound (`maxHeight`)
 * is on the sheet, `flexShrink: 1` is on the scrolling body, and the dismiss
 * button is a SIBLING below the body — never inside the scroller, or it becomes
 * unreachable on a long year.
 */

import React from 'react';
import { Modal, View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { TrendingUp, TrendingDown, Minus, CalendarCheck, Bell } from 'lucide-react-native';
import type { YearSummary } from '@/lib/gameMode/mode';
import { getThemeColors, accent } from '@/lib/config/theme';
import { scale, fontScale, responsiveSpacing } from '@/utils/scaling';
import { formatMoney } from '@/utils/moneyFormatting';
import { Z_INDEX } from '@/utils/zIndexConstants';

interface YearInReviewModalProps {
  visible: boolean;
  summary: YearSummary | null;
  onClose: () => void;
  darkMode?: boolean;
}

/** A signed money row: colour AND an arrow AND a sign, never colour alone. */
function DeltaRow({
  label,
  delta,
  after,
  darkMode,
}: {
  label: string;
  delta: number;
  after: number;
  darkMode: boolean;
}) {
  const c = getThemeColors(darkMode);
  const up = delta > 0;
  const flat = delta === 0;
  const color = flat ? c.textSecondary : up ? accent.success : accent.danger;
  const Icon = flat ? Minus : up ? TrendingUp : TrendingDown;

  return (
    <View style={[styles.row, { borderColor: c.border }]}>
      <Text style={[styles.rowLabel, { color: c.textSecondary }]}>{label}</Text>
      <View style={styles.rowRight}>
        <Icon size={scale(14)} color={color} />
        <Text style={[styles.rowDelta, { color }]}>
          {flat ? '±0' : `${up ? '+' : '−'}${formatMoney(Math.abs(delta))}`}
        </Text>
        <Text style={[styles.rowAfter, { color: c.text }]}>{formatMoney(after)}</Text>
      </View>
    </View>
  );
}

export function YearInReviewModal({
  visible,
  summary,
  onClose,
  darkMode = true,
}: YearInReviewModalProps) {
  const c = getThemeColors(darkMode);
  if (!summary) return null;

  const ageFrom = Math.floor(summary.ageBefore);
  const ageTo = Math.floor(summary.ageAfter);
  // A batch cut short by a decision may not have covered a whole year, so the
  // header states what actually happened rather than assuming twelve months.
  const partial = summary.weeksAdvanced > 0 && summary.weeksAdvanced < 52;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={[styles.backdrop, { backgroundColor: c.overlay }]}>
        <View style={[styles.sheet, { backgroundColor: c.surface, borderColor: c.border }]}>
          <View style={styles.header}>
            <CalendarCheck size={scale(20)} color={accent.info} />
            <View style={styles.headerText}>
              <Text style={[styles.title, { color: c.text }]}>
                {ageTo > ageFrom ? `Age ${ageFrom} → ${ageTo}` : `Age ${ageFrom}`}
              </Text>
              <Text style={[styles.subtitle, { color: c.textSecondary }]}>
                {summary.weeksAdvanced} {summary.weeksAdvanced === 1 ? 'week' : 'weeks'} lived
                {partial ? ' · cut short' : ''}
              </Text>
            </View>
          </View>

          <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
            <DeltaRow
              label="Cash"
              delta={summary.moneyDelta}
              after={summary.moneyAfter}
              darkMode={darkMode}
            />
            <DeltaRow
              label="Net worth"
              delta={summary.netWorthDelta}
              after={summary.netWorthAfter}
              darkMode={darkMode}
            />

            {summary.notes.length > 0 ? (
              <View style={styles.notes}>
                <Text style={[styles.notesHeading, { color: c.textSecondary }]}>
                  What happened
                </Text>
                {summary.notes.map((note, i) => (
                  <Text key={`${i}-${note}`} style={[styles.note, { color: c.text }]}>
                    • {note}
                  </Text>
                ))}
              </View>
            ) : (
              <Text style={[styles.quiet, { color: c.textSecondary }]}>A quiet year.</Text>
            )}

            {summary.outcome === 'decision' ? (
              <View style={[styles.pending, { borderColor: accent.warning }]}>
                <Bell size={scale(14)} color={accent.warning} />
                <Text style={[styles.pendingText, { color: c.text }]}>
                  Something needs your decision.
                </Text>
              </View>
            ) : null}
          </ScrollView>

          {/* Sibling of the body, never inside it — see the header note. */}
          <TouchableOpacity
            onPress={onClose}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Close year in review"
            style={[styles.button, { backgroundColor: accent.info }]}
          >
            <Text style={styles.buttonText}>Continue</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: responsiveSpacing.md,
    zIndex: Z_INDEX.MODAL,
  },
  sheet: {
    width: '100%',
    maxWidth: scale(420),
    maxHeight: '85%',
    borderWidth: 1,
    borderRadius: scale(16),
    padding: responsiveSpacing.md,
    gap: responsiveSpacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(10),
  },
  headerText: { flex: 1 },
  title: { fontSize: fontScale(19), fontWeight: '700' },
  subtitle: { fontSize: fontScale(12.5), marginTop: scale(2) },
  body: { flexShrink: 1 },
  bodyContent: { gap: responsiveSpacing.sm, paddingBottom: responsiveSpacing.xs },
  row: {
    borderWidth: 1,
    borderRadius: scale(10),
    paddingVertical: responsiveSpacing.sm,
    paddingHorizontal: responsiveSpacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: scale(8),
  },
  rowLabel: { fontSize: fontScale(13), fontWeight: '600' },
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: scale(6) },
  rowDelta: { fontSize: fontScale(13), fontWeight: '700' },
  rowAfter: { fontSize: fontScale(13), fontWeight: '600' },
  notes: { gap: scale(4), marginTop: scale(2) },
  notesHeading: {
    fontSize: fontScale(11),
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  note: { fontSize: fontScale(13), lineHeight: fontScale(19) },
  quiet: { fontSize: fontScale(13), fontStyle: 'italic' },
  pending: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(8),
    borderWidth: 1,
    borderRadius: scale(10),
    padding: responsiveSpacing.sm,
  },
  pendingText: { fontSize: fontScale(13), fontWeight: '600', flex: 1 },
  button: {
    borderRadius: scale(12),
    paddingVertical: responsiveSpacing.sm,
    alignItems: 'center',
  },
  buttonText: { color: '#FFFFFF', fontSize: fontScale(15), fontWeight: '700' },
});

export default YearInReviewModal;
