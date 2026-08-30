/**
 * LiveEventsCard - the front door for live events.
 *
 * WHAT IT DELIBERATELY IS NOT. Not a full-screen takeover, not a countdown on
 * everything, not a list of things the player has missed. A live-ops surface
 * that opens itself and starts a timer is how a game begins to feel like it is
 * begging (20, 41). This is a card that sits with the other cards and says what
 * is available; the player opens it or does not.
 *
 * WHAT IT SHOWS AND WHY THAT ORDER. `resolveHub` already drops `unavailable`
 * and `expired` and leads with `claimable`, so the first thing the player sees
 * is the thing they have finished and can take. A countdown appears only on an
 * event that is genuinely close to ending - an always-on timer is pressure, a
 * timer in the last two days is information.
 *
 * READ-MOSTLY. The only write is the claim, and it goes through the ONE atomic
 * updater (`applyLiveEventClaim`) inside `setGameState`, re-checking every gate
 * against `prev`. Nothing here computes eligibility or completion for the
 * purposes of paying - it renders what the resolver said and asks the reducer
 * to decide (CLAUDE.md 4.4).
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Check, Gem, Sparkles, Timer, Trophy } from 'lucide-react-native';
import { useGameStateGetter, useSetGameState } from '@/contexts/game/useGameSelector';
import { fontScale, scale, responsiveBorderRadius } from '@/utils/scaling';
import { useLiveOps } from '@/hooks/useLiveOps';
import { applyLiveEventClaim, applyLiveEventSeen } from '@/lib/liveops/claim';
import {
  trackClaimRefused,
  trackEventClaimed,
  trackEventOpened,
  trackEventShown,
} from '@/lib/liveops/analytics';
import type { ResolvedLiveEvent } from '@/lib/liveops/types';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * A deadline, shown only when it is close.
 *
 * Returns null for anything more than two days out. "Ends in 27 days" is not
 * information the player can act on; it is a countdown for its own sake, and a
 * surface covered in them reads as pressure rather than as an offer.
 */
export function urgencyLabel(msRemaining: number): string | null {
  if (!Number.isFinite(msRemaining) || msRemaining <= 0) return null;
  if (msRemaining > 2 * DAY_MS) return null;
  const hours = Math.ceil(msRemaining / (60 * 60 * 1000));
  if (hours <= 1) return 'Ends within the hour';
  if (hours < 24) return `Ends in ${hours} hours`;
  return 'Ends tomorrow';
}

/** Clamped 0..1 fraction for an objective's bar. */
export function objectiveFraction(current: number, target: number): number {
  if (!Number.isFinite(current) || !Number.isFinite(target) || target <= 0) return 0;
  return Math.max(0, Math.min(1, current / target));
}

/** "200 gems", "200 gems + $5,000" - what the card promises, from the definition. */
export function rewardLabel(event: ResolvedLiveEvent): string {
  return event.definition.rewards
    .map((r) => {
      if (r.kind === 'gems') return `${r.amount} gems`;
      if (r.kind === 'cash') return `$${r.amount.toLocaleString('en-US')}`;
      return `${r.amount} Legacy ${r.amount === 1 ? 'Point' : 'Points'}`;
    })
    .join(' + ');
}

function LiveEventsCard(): React.ReactElement | null {
  const setGameState = useSetGameState();
  const { events, weeksThisLife, context } = useLiveOps();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [refusal, setRefusal] = useState<string | null>(null);

  // Impressions. Fired for what actually rendered, on the ids that rendered -
  // the analytics layer collapses a re-render of the same impression, so this
  // measures "the player could see it" rather than "React ran".
  const shownKey = events.map((e) => `${e.definition.id}:${e.state}`).join(',');
  useEffect(() => {
    for (const event of events) trackEventShown(event.definition, event.state, 'home_card');
    // `events` is rebuilt on every resolve; the key is what actually changed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shownKey]);

  const onOpen = useCallback(
    (event: ResolvedLiveEvent) => {
      const next = expandedId === event.definition.id ? null : event.definition.id;
      setExpandedId(next);
      setRefusal(null);
      if (!next) return;

      trackEventOpened(event.definition, event.state, event.objectives.filter((o) => o.met).length);
      // Bookkeeping only - `applyLiveEventSeen` cannot reach a currency, and it
      // returns null when nothing changed so an unchanged state never re-renders.
      setGameState((prev) => {
        const patch = applyLiveEventSeen(prev, event.definition, weeksThisLife);
        return patch ? { ...prev, ...patch } : prev;
      });
    },
    [expandedId, setGameState, weeksThisLife],
  );

  const getState = useGameStateGetter();

  const onClaim = useCallback(
    (event: ResolvedLiveEvent) => {
      setRefusal(null);

      // REPORTING and PAYMENT are split, and the split is the point.
      //
      // The reducer is pure and must stay pure: a `setGameState` updater can be
      // invoked more than once for one logical update (React does exactly that
      // in StrictMode), so calling `track()` or `setRefusal()` from inside it
      // would double-fire analytics and set component state during the render
      // phase. Both are side effects in a reducer, which is the shape this
      // whole subsystem is written to avoid.
      //
      // So the decision is computed ONCE out here against a fresh snapshot,
      // purely to decide what to SAY, and then the authoritative claim runs
      // inside the updater against `prev`. The read out here is allowed to be
      // stale; the payment is not. If they ever disagree - a week ticking over
      // between the two - the updater wins and the worst case is a message
      // about an outcome that did not happen, never a payout that did not.
      const decision = applyLiveEventClaim(getState(), event.definition, context, Date.now());

      if (!decision.ok) {
        if (decision.reason === 'budget_exhausted') {
          setRefusal('You have collected a lot this week. This will be ready again shortly.');
        } else if (decision.reason === 'not_claimable') {
          setRefusal('This one is not ready to collect.');
        }
        // `already_claimed` is silent: the player double-tapped, and telling
        // them off for it would be worse than doing nothing.
        if (decision.reason !== 'already_claimed') {
          trackClaimRefused(event.definition, decision.reason);
        }
        return;
      }

      trackEventClaimed(event.definition, weeksThisLife);
      setGameState((prev) => {
        const result = applyLiveEventClaim(prev, event.definition, context, Date.now());
        return result.ok ? { ...prev, ...result.patch } : prev;
      });
    },
    [context, getState, setGameState, weeksThisLife],
  );

  const visible = useMemo(() => events.slice(0, 3), [events]);
  if (visible.length === 0) return null;

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Sparkles size={scale(14)} color="#38BDF8" />
        <Text style={styles.kicker}>HAPPENING NOW</Text>
      </View>

      {visible.map((event) => {
        const { definition, objectives, state } = event;
        const met = objectives.filter((o) => o.met).length;
        const expanded = expandedId === definition.id;
        const urgency = urgencyLabel(event.msRemaining);

        return (
          <Pressable
            key={definition.id}
            onPress={() => onOpen(event)}
            style={[styles.event, state === 'claimed' && styles.eventDone]}
            accessibilityRole="button"
            accessibilityLabel={`${definition.title}. ${met} of ${objectives.length} done.`}
          >
            <View style={styles.eventHeader}>
              <Text style={styles.emoji}>{definition.emoji || '✨'}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.title} numberOfLines={1}>
                  {definition.title}
                </Text>
                <Text style={styles.sub} numberOfLines={expanded ? 3 : 1}>
                  {expanded ? definition.brief : definition.summary}
                </Text>
              </View>
              {state === 'claimed' ? (
                <View style={styles.doneBadge}>
                  <Trophy size={scale(15)} color="#FBBF24" />
                </View>
              ) : (
                <View style={styles.rewardChip}>
                  <Gem size={scale(11)} color="#FBBF24" />
                  <Text style={styles.rewardChipText}>{rewardLabel(event)}</Text>
                </View>
              )}
            </View>

            {/* The countdown appears only in the last two days - see urgencyLabel. */}
            {urgency && state !== 'claimed' ? (
              <View style={styles.urgencyRow}>
                <Timer size={scale(11)} color="#FCA5A5" />
                <Text style={styles.urgencyText}>{urgency}</Text>
              </View>
            ) : null}

            {expanded ? (
              <View style={styles.list}>
                {objectives.map((objective) => (
                  <View key={objective.objectiveId} style={styles.row}>
                    <View style={[styles.bubble, objective.met && styles.bubbleDone]}>
                      {objective.met ? <Check size={scale(11)} color="#0F172A" /> : null}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text
                        style={[styles.rowTitle, objective.met && styles.rowTitleDone]}
                        numberOfLines={1}
                      >
                        {objective.label}
                      </Text>
                      {!objective.met ? (
                        <View style={styles.barBg}>
                          <View
                            style={[
                              styles.barFill,
                              {
                                width: `${Math.round(
                                  objectiveFraction(objective.current, objective.target) * 100,
                                )}%`,
                              },
                            ]}
                          />
                        </View>
                      ) : null}
                    </View>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={styles.progressLine}>
                {state === 'claimed' ? 'Collected' : `${met}/${objectives.length} done`}
              </Text>
            )}

            {state === 'claimable' ? (
              <Pressable
                onPress={() => onClaim(event)}
                style={styles.claimButton}
                accessibilityRole="button"
                accessibilityLabel={`Collect ${rewardLabel(event)}`}
              >
                <Text style={styles.claimText}>Collect {rewardLabel(event)}</Text>
              </Pressable>
            ) : null}

            {refusal && expanded ? <Text style={styles.refusal}>{refusal}</Text> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

// Full four-sided borders throughout - a one-sided coloured stripe is banned
// app-wide (Hard Rule 7) and RN curls it into a crescent against borderRadius.
const styles = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    borderRadius: responsiveBorderRadius.xl,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.25)',
    padding: scale(14),
    gap: scale(10),
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: scale(6) },
  kicker: {
    fontSize: fontScale(10),
    fontWeight: '800',
    letterSpacing: 1,
    color: '#38BDF8',
  },
  event: {
    backgroundColor: 'rgba(30, 41, 59, 0.6)',
    borderRadius: responsiveBorderRadius.lg,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.18)',
    padding: scale(11),
    gap: scale(8),
  },
  eventDone: { opacity: 0.72 },
  eventHeader: { flexDirection: 'row', alignItems: 'center', gap: scale(9) },
  emoji: { fontSize: fontScale(20) },
  title: { fontSize: fontScale(14), fontWeight: '700', color: '#F1F5F9' },
  sub: { fontSize: fontScale(11), color: '#94A3B8', marginTop: scale(1) },
  rewardChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(4),
    backgroundColor: 'rgba(251, 191, 36, 0.12)',
    borderRadius: responsiveBorderRadius.full,
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.3)',
    paddingHorizontal: scale(8),
    paddingVertical: scale(3),
  },
  rewardChipText: { fontSize: fontScale(10), fontWeight: '700', color: '#FBBF24' },
  doneBadge: {
    width: scale(28),
    height: scale(28),
    borderRadius: responsiveBorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(251, 191, 36, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.3)',
  },
  urgencyRow: { flexDirection: 'row', alignItems: 'center', gap: scale(4) },
  urgencyText: { fontSize: fontScale(10), fontWeight: '600', color: '#FCA5A5' },
  progressLine: { fontSize: fontScale(11), color: '#64748B', fontWeight: '600' },
  list: { gap: scale(7) },
  row: { flexDirection: 'row', alignItems: 'center', gap: scale(8) },
  bubble: {
    width: scale(18),
    height: scale(18),
    borderRadius: responsiveBorderRadius.full,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bubbleDone: { backgroundColor: '#4ADE80', borderColor: '#4ADE80' },
  rowTitle: { fontSize: fontScale(11.5), color: '#CBD5E1' },
  rowTitleDone: { color: '#64748B', textDecorationLine: 'line-through' },
  barBg: {
    height: scale(3),
    borderRadius: responsiveBorderRadius.full,
    backgroundColor: 'rgba(148, 163, 184, 0.2)',
    marginTop: scale(4),
    overflow: 'hidden',
  },
  barFill: { height: '100%', backgroundColor: '#38BDF8', borderRadius: responsiveBorderRadius.full },
  claimButton: {
    backgroundColor: '#22C55E',
    borderRadius: responsiveBorderRadius.md,
    borderWidth: 1,
    borderColor: '#16A34A',
    paddingVertical: scale(9),
    alignItems: 'center',
  },
  claimText: { fontSize: fontScale(13), fontWeight: '800', color: '#052E16' },
  refusal: { fontSize: fontScale(10.5), color: '#FCD34D' },
});

export default React.memo(LiveEventsCard);
