/**
 * ElderCard - the late-game "Retirement / Elder" surface on the home feed.
 *
 * Appears once the player can retire (age ≥ 65, or age ≥ 45 with FIRE net worth),
 * is already elderly, or has retired. It hosts three things, all driven by the
 * pure lib/retirement module:
 *   • the Retire action (with a live pension projection) - before retiring,
 *   • the pension readout - after retiring,
 *   • age-gated elder activities (memoir, mentoring, grandchildren, bucket-list,
 *     volunteering, reconnecting) with cost/cooldown, and
 *   • a legacy-planning summary (net worth, estate to heirs, achievements, family)
 *     that previews the same numbers the death/legacy flow shows.
 *
 * Reuse-not-rebuild: money moves only through the canonical helpers inside the
 * pure reducers; nothing here mints money or touches a mirrored bank account.
 * Renders nothing for a normal working-age life - safe on every save.
 */
import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Armchair, Landmark, Trophy, Users, Clock, Sparkles } from 'lucide-react-native';
import { useGameSelector, useSetGameState } from '@/contexts/game/useGameSelector';
import Card from '@/components/ui/Card';
import { useGameActions } from '@/contexts/game/GameActionsContext';
import { useToast } from '@/contexts/ToastContext';
import { haptic } from '@/utils/haptics';
import { formatMoney } from '@/utils/moneyFormatting';
import { fontScale, scale, responsiveBorderRadius } from '@/utils/scaling';
import type { GameState } from '@/contexts/game/types';
import {
  RETIREMENT_AGE,
  getAge,
  isElder,
  isRetired as isRetiredFn,
  getRetirementEligibility,
  computePension,
  getRetirementIncomeWeekly,
  retirePlayer,
  getElderActivityStatuses,
  applyElderActivity,
  getElderLegacySummary,
  type ElderActivityRejectReason,
} from '@/lib/retirement';

const rejectMessage = (reason: ElderActivityRejectReason | undefined, weeksLeft: number): string => {
  switch (reason) {
    case 'cooldown':
      return `Come back in ${Math.max(1, Math.ceil(weeksLeft))} week${weeksLeft > 1 ? 's' : ''}.`;
    case 'insufficient-money':
      return "You can't afford that right now.";
    case 'requires-children':
      return 'You need grandchildren for that.';
    case 'not-elder':
      return `Available from age ${RETIREMENT_AGE}.`;
    default:
      return 'Not available right now.';
  }
};

function ElderCard() {
  // Retirement predicates read many state fields; select the whole snapshot for
  // this single card (same approach as AmbitionCard / LifeChapterCard).
  const state = useGameSelector((s) => s) as GameState;
  const setGameState = useSetGameState();
  const { saveGame } = useGameActions();
  const { showSuccess, showWarning } = useToast();

  const view = useMemo(() => {
    if (!state) return null;
    const retired = isRetiredFn(state);
    const elder = isElder(state);
    const eligibility = getRetirementEligibility(state);
    const show = retired || elder || eligibility.canRetire;
    if (!show) return null;
    return {
      retired,
      elder,
      eligibility,
      age: getAge(state),
      projectedPension: computePension(state).weekly,
      pensionWeekly: getRetirementIncomeWeekly(state),
      retiredAtAge: state.retiredAtAge,
      // Show activities for anyone RETIRED (FIRE path retires at 45) or elder -
      // not just 65+, which used to leave early retirees with empty years.
      activities: retired || elder ? getElderActivityStatuses(state) : [],
      legacy: getElderLegacySummary(state),
    };
  }, [state]);

  if (!view) return null;

  const doRetire = () => {
    haptic.success();
    // Decide success from the render snapshot (pure retirePlayer) rather than a
    // flag mutated inside the async state updater - React does not guarantee the
    // updater runs synchronously, so the flag could stay false on a successful
    // retire and skip the toast + immediate save.
    const preview = retirePlayer(state);
    setGameState((prev) => {
      const res = retirePlayer(prev);
      return res.ok ? res.state : prev;
    });
    if (preview.ok) {
      showSuccess('You have retired. Time for the chapter you earned.');
      void saveGame?.(false);
    }
  };

  const doActivity = (id: string) => {
    const status = view.activities.find((s) => s.activity.id === id);
    if (status && !status.available) {
      showWarning(rejectMessage(status.reason, status.cooldownWeeksLeft));
      return;
    }
    haptic.light();
    // Decide success + toast from the render snapshot (pure applyElderActivity),
    // not a flag mutated inside the async state updater (which React may defer,
    // leaving `ok` false on a successful activity - a false "Not available" warning
    // on an action that already charged + applied). Mirrors AmbitionCard.
    const preview = applyElderActivity(state, id);
    setGameState((prev) => {
      const res = applyElderActivity(prev, id);
      return res.ok ? res.state : prev;
    });
    if (preview.ok) {
      showSuccess((preview.activity && preview.activity.toast) || 'Done.');
      void saveGame?.(false);
    } else {
      showWarning('Not available right now.');
    }
  };

  const { legacy } = view;

  return (
    <Card>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.iconBubble}>
          <Armchair size={scale(18)} color="#FACC15" />
        </View>
        <View style={{ flex: 1 }}>
          <View style={styles.titleRow}>
            <Sparkles size={scale(12)} color="#FACC15" />
            <Text style={styles.kicker}>ELDER CHAPTER</Text>
          </View>
          <Text style={styles.title}>Retirement</Text>
          <Text style={styles.sub}>
            {view.retired
              ? `Retired at ${view.retiredAtAge ?? view.age} · now ${view.age}`
              : `Age ${view.age} · ${view.eligibility.viaFinancialIndependence ? 'Financially independent' : 'Eligible to retire'}`}
          </Text>
        </View>
      </View>

      {/* Retire CTA (before retirement) */}
      {!view.retired && view.eligibility.canRetire ? (
        <>
          <View style={styles.pensionRow}>
            <Landmark size={scale(14)} color="#94A3B8" />
            <Text style={styles.pensionText}>
              Projected pension <Text style={styles.pensionAmount}>{formatMoney(view.projectedPension)}/wk</Text>
            </Text>
          </View>
          <TouchableOpacity style={styles.retireBtn} onPress={doRetire} activeOpacity={0.85}>
            <Armchair size={scale(15)} color="#0F172A" />
            <Text style={styles.retireText}>Retire now</Text>
          </TouchableOpacity>
        </>
      ) : null}

      {/* Pension readout (after retirement) */}
      {view.retired ? (
        <View style={styles.pensionCard}>
          <Landmark size={scale(16)} color="#34D399" />
          <View style={{ flex: 1 }}>
            <Text style={styles.pensionCardLabel}>Weekly pension</Text>
            <Text style={styles.pensionCardValue}>{formatMoney(view.pensionWeekly)}/wk</Text>
          </View>
          <Text style={styles.pensionCardNote}>paid automatically</Text>
        </View>
      ) : null}

      {/* Elder activities (retired at any age, or 65+) */}
      {(view.retired || view.elder) && view.activities.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Ways to spend your years</Text>
          <View style={styles.activityList}>
            {view.activities.map((s) => {
              const a = s.activity;
              const disabled = !s.available;
              return (
                <TouchableOpacity
                  key={a.id}
                  style={[styles.activityRow, disabled && styles.activityRowDisabled]}
                  onPress={() => doActivity(a.id)}
                  activeOpacity={0.85}
                >
                  <View style={styles.activityEmojiBubble}>
                    <Text style={styles.activityEmoji}>{a.emoji}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.activityLabel} numberOfLines={1}>
                      {a.label}
                    </Text>
                    <Text style={styles.activityDesc} numberOfLines={1}>
                      {s.onCooldown
                        ? `Ready in ${Math.max(1, Math.ceil(s.cooldownWeeksLeft))}w`
                        : a.description}
                    </Text>
                  </View>
                  <View style={styles.activityMeta}>
                    {a.moneyCost > 0 ? (
                      <Text style={[styles.costChip, !s.affordable && styles.costChipBad]}>
                        {formatMoney(a.moneyCost)}
                      </Text>
                    ) : (
                      <Text style={styles.freeChip}>Free</Text>
                    )}
                    {s.onCooldown ? <Clock size={scale(12)} color="#94A3B8" /> : null}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      ) : null}

      {/* Legacy planning summary */}
      <View style={styles.section}>
        <View style={styles.legacyHead}>
          <Trophy size={scale(13)} color="#FACC15" />
          <Text style={styles.sectionTitle}>Your legacy so far</Text>
        </View>
        <View style={styles.legacyGrid}>
          <View style={styles.legacyStat}>
            <Text style={styles.legacyStatValue}>{formatMoney(legacy.netWorth)}</Text>
            <Text style={styles.legacyStatLabel}>Net worth</Text>
          </View>
          <View style={styles.legacyStat}>
            <Text style={styles.legacyStatValue}>{formatMoney(legacy.estateToHeirs)}</Text>
            <Text style={styles.legacyStatLabel}>Estate to heirs</Text>
          </View>
          <View style={styles.legacyStat}>
            <Text style={styles.legacyStatValue}>{legacy.achievementsCount}</Text>
            <Text style={styles.legacyStatLabel}>Achievements</Text>
          </View>
        </View>
        <View style={styles.legacyFamilyRow}>
          <Users size={scale(12)} color="#94A3B8" />
          <Text style={styles.legacyFamilyText} numberOfLines={1}>
            {legacy.spouseName ? `Married to ${legacy.spouseName}` : 'Single'}
            {' · '}
            {legacy.childrenCount} {legacy.childrenCount === 1 ? 'child' : 'children'}
            {legacy.primaryHeir ? ` · Heir: ${legacy.primaryHeir.name}` : ''}
          </Text>
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  // Container comes from components/ui/Card (one card, one border).
  header: { flexDirection: 'row', alignItems: 'center', gap: scale(10) },
  iconBubble: {
    width: scale(38),
    height: scale(38),
    borderRadius: scale(19),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(250, 204, 21, 0.15)',
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: scale(4) },
  kicker: { fontSize: fontScale(9.5), fontWeight: '800', color: '#FACC15', letterSpacing: 0.6 },
  title: { fontSize: fontScale(15.5), fontWeight: '800', color: '#F8FAFC', marginTop: scale(1) },
  sub: { fontSize: fontScale(11.5), color: '#94A3B8', marginTop: scale(2) },

  pensionRow: { flexDirection: 'row', alignItems: 'center', gap: scale(6) },
  pensionText: { fontSize: fontScale(12.5), color: '#E2E8F0', fontWeight: '600' },
  pensionAmount: { color: '#FACC15', fontWeight: '800' },
  retireBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: scale(8),
    paddingVertical: scale(11),
    borderRadius: responsiveBorderRadius.md,
    backgroundColor: '#FBBF24',
  },
  retireText: { fontSize: fontScale(13.5), fontWeight: '800', color: '#0F172A' },

  pensionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(10),
    padding: scale(11),
    borderRadius: responsiveBorderRadius.md,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.35)',
  },
  pensionCardLabel: { fontSize: fontScale(10.5), color: '#94A3B8', fontWeight: '600' },
  pensionCardValue: { fontSize: fontScale(15), color: '#34D399', fontWeight: '800', marginTop: scale(1) },
  pensionCardNote: { fontSize: fontScale(10), color: '#94A3B8', fontStyle: 'italic' },

  section: { gap: scale(8) },
  sectionTitle: { fontSize: fontScale(12), fontWeight: '700', color: '#CBD5E1' },
  legacyHead: { flexDirection: 'row', alignItems: 'center', gap: scale(6) },

  activityList: { gap: scale(8) },
  activityRow: { flexDirection: 'row', alignItems: 'center', gap: scale(10) },
  activityRowDisabled: { opacity: 0.5 },
  activityEmojiBubble: {
    width: scale(34),
    height: scale(34),
    borderRadius: scale(10),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(148, 163, 184, 0.12)',
  },
  activityEmoji: { fontSize: fontScale(17) },
  activityLabel: { fontSize: fontScale(13), fontWeight: '700', color: '#E2E8F0' },
  activityDesc: { fontSize: fontScale(10.5), color: '#94A3B8', marginTop: scale(1) },
  activityMeta: { flexDirection: 'row', alignItems: 'center', gap: scale(6) },
  costChip: { fontSize: fontScale(11), fontWeight: '800', color: '#FACC15' },
  costChipBad: { color: '#F87171' },
  freeChip: { fontSize: fontScale(10.5), fontWeight: '700', color: '#34D399' },

  legacyGrid: { flexDirection: 'row', gap: scale(8) },
  legacyStat: {
    flex: 1,
    paddingVertical: scale(8),
    paddingHorizontal: scale(6),
    borderRadius: responsiveBorderRadius.md,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
  },
  legacyStatValue: { fontSize: fontScale(12.5), fontWeight: '800', color: '#F8FAFC' },
  legacyStatLabel: { fontSize: fontScale(9.5), color: '#94A3B8', marginTop: scale(2), textAlign: 'center' },
  legacyFamilyRow: { flexDirection: 'row', alignItems: 'center', gap: scale(6) },
  legacyFamilyText: { flex: 1, fontSize: fontScale(11), color: '#CBD5E1', fontWeight: '600' },
});

export default React.memo(ElderCard);
