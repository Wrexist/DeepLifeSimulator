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
 * ── THE OFFER, AND WHY IT IS HERE ─────────────────────────────────────────
 * Roughly half of all paid conversions in subscription apps happen on DAY 0, so
 * where the offer sits matters more than what it says. Until v2.7.0 there was no
 * good day-0 moment to put one: a life took 3,224 taps, so a new player had
 * experienced almost nothing by the time the first session ended, and an offer
 * shown then is asking someone to pay for a product they have not seen.
 *
 * Story Mode changed that. A first session now contains a whole year — income,
 * market, career, the lot — and the Year in Review is the moment the player
 * looks at what it produced. That is the first honest peak in the game's
 * history, which is why the offer is here and nowhere earlier.
 *
 * Three rules keep it an offer rather than nagging, and they mirror the ones
 * `utils/reviewMoments.ts` already applies to the rating prompt:
 *   1. Only after a year that went WELL. Pitching a subscription to someone
 *      who just lost money is how you earn a one-star review.
 *   2. Once per app session, latched at module scope so a cold start is the
 *      only thing that re-arms it.
 *   3. Inline in a sheet the player opened, never a popup over the game — it
 *      can be ignored by reading past it.
 *
 * Layout follows the sheet rule from tasks/lessons.md: the bound (`maxHeight`)
 * is on the sheet, `flexShrink: 1` is on the scrolling body, and the dismiss
 * button is a SIBLING below the body — never inside the scroller, or it becomes
 * unreachable on a long year.
 */

import React, { useEffect, useState } from 'react';
import { Modal, View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { TrendingUp, TrendingDown, Minus, CalendarCheck, Bell, Crown } from 'lucide-react-native';
import { useDeepLifePlusUpsell } from '@/hooks/useDeepLifePlusUpsell';
import SubscriptionModal from '@/components/SubscriptionModal';
import { DEEP_LIFE_PLUS_FREE_TRIAL_DAYS } from '@/lib/subscription/deepLifePlus';
import type { YearSummary } from '@/lib/gameMode/mode';
import { getThemeColors, accent } from '@/lib/config/theme';
import { scale, fontScale, responsiveSpacing } from '@/utils/scaling';
import { formatMoney } from '@/utils/moneyFormatting';
import { Z_INDEX } from '@/utils/zIndexConstants';

/**
 * Once-per-app-session latch for the offer. Module scope, so it resets on cold
 * start — exactly the lifetime wanted. A player who dismisses it should not see
 * it again while they keep playing.
 */
let offerShownThisSession = false;

/**
 * A year worth celebrating: net worth up, and up by enough to notice.
 *
 * Exported for the test suite — the thresholds here decide when a player is
 * asked for money, so they are worth pinning rather than eyeballing.
 */
export function wasAGoodYear(summary: YearSummary): boolean {
  if (summary.outcome !== 'year-complete') return false;
  if (summary.weeksAdvanced < 26) return false;
  // Relative, not absolute: +$500 is a triumph at week 10 and noise at week 900.
  const base = Math.max(1000, Math.abs(summary.netWorthBefore));
  return summary.netWorthDelta > 0 && summary.netWorthDelta / base >= 0.15;
}

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
  const { active: isMember, present: openPlus, open: plusOpen, close: closePlus } =
    useDeepLifePlusUpsell('year_in_review');

  // Re-evaluated whenever a NEW year is presented — not once on mount. This
  // component is rendered persistently by the HUD with `summary` null between
  // taps, so a mount-time decision would be made against no summary and the
  // offer would never appear.
  const [showOffer, setShowOffer] = useState(false);
  useEffect(() => {
    if (!visible || !summary || isMember || offerShownThisSession) {
      setShowOffer(false);
      return;
    }
    if (!wasAGoodYear(summary)) {
      setShowOffer(false);
      return;
    }
    // Latch only when it is actually going to be shown, so a bad year does not
    // silently consume the one offer this session gets.
    offerShownThisSession = true;
    setShowOffer(true);
  }, [visible, summary, isMember]);

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

            {showOffer && !isMember ? (
              <TouchableOpacity
                onPress={openPlus}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel={
                  DEEP_LIFE_PLUS_FREE_TRIAL_DAYS > 0
                    ? `DeepLife Plus, ${DEEP_LIFE_PLUS_FREE_TRIAL_DAYS}-day free trial`
                    : 'DeepLife Plus'
                }
                style={[styles.offer, { borderColor: accent.gold }]}
              >
                <Crown size={scale(16)} color={accent.gold} />
                <View style={styles.offerText}>
                  <Text style={[styles.offerTitle, { color: c.text }]}>
                    Good year. Make the next one count.
                  </Text>
                  <Text style={[styles.offerSub, { color: c.textSecondary }]}>
                    {DEEP_LIFE_PLUS_FREE_TRIAL_DAYS > 0
                      ? `DeepLife+ — ad-free, weekly gems. ${DEEP_LIFE_PLUS_FREE_TRIAL_DAYS} days free.`
                      : 'DeepLife+ — ad-free, weekly gems.'}
                  </Text>
                </View>
              </TouchableOpacity>
            ) : null}

            {/*
              The danger notice is the reason the year ended, so it says what to
              DO — a player handed back the wheel at 14 happiness needs an
              action, not a diagnosis. It outranks the decision notice in
              `summarizeYear`, so the two never stack.
            */}
            {summary.outcome === 'danger' ? (
              <View style={[styles.pending, { borderColor: accent.danger }]}>
                <Bell size={scale(14)} color={accent.danger} />
                <Text style={[styles.pendingText, { color: c.text }]}>
                  Your life is in trouble — the year stopped early. Rest, earn, or
                  see friends before living another.
                </Text>
              </View>
            ) : null}

            {/*
              Illness reads as a MOMENT, not a malfunction. The year handing
              back here is the mode working: an untreated disease costs about
              -2 happiness and -2 health every week for its whole course, and a
              batch is exactly the situation where nobody is watching. Naming
              the illness and the action turns the interruption into the reason
              the player tapped.
            */}
            {summary.outcome === 'illness' ? (
              <View style={[styles.pending, { borderColor: accent.warning }]}>
                <Bell size={scale(14)} color={accent.warning} />
                <Text style={[styles.pendingText, { color: c.text }]}>
                  {summary.illnessName
                    ? `You've come down with ${summary.illnessName.toLowerCase()}. Treat it in Health before it wears you down.`
                    : "You've fallen ill. Treat it in Health before it wears you down."}
                </Text>
              </View>
            ) : null}

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
      <SubscriptionModal visible={plusOpen} onClose={closePlus} />
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
  offer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(10),
    borderWidth: 1,
    borderRadius: scale(10),
    padding: responsiveSpacing.sm,
  },
  offerText: { flex: 1, gap: scale(2) },
  offerTitle: { fontSize: fontScale(13.5), fontWeight: '700' },
  offerSub: { fontSize: fontScale(12) },
  button: {
    borderRadius: scale(12),
    paddingVertical: responsiveSpacing.sm,
    alignItems: 'center',
  },
  buttonText: { color: '#FFFFFF', fontSize: fontScale(15), fontWeight: '700' },
});

export default YearInReviewModal;
