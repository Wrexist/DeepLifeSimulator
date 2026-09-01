/**
 * WeeklyChallengeCard - the front door for a system that had none.
 *
 * Twelve hand-authored themed challenges (4-6 objectives each) rotate every 4
 * game weeks, are re-evaluated on every tick, and pay 125-300 gems - 2,300 gems
 * and 600 Legacy-Pass XP across a full 48-week cycle. A repo-wide grep for
 * `weeklyChallenge` found hits only in the tick, the type, initialState and the
 * lib itself: NO screen or component read it. So the player was never shown
 * that a challenge existed, what its objectives were, how long was left before
 * it rotated, or that they had just earned 250 gems - the gem counter simply
 * jumped, with a `logger.info` as the only record.
 *
 * It was the single largest built-but-invisible system in the game.
 * 2026-07-30 audit GP-1.
 *
 * Deliberately read-only: the tick already owns evaluation and the grant, and
 * duplicating either here would risk a second payout. This surfaces what the
 * tick is already doing. Progress is computed from live state on render, the
 * same pattern `AmbitionCard` and `LifeChapterCard` use.
 */
import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Check, Gem, Swords, Timer, Trophy } from 'lucide-react-native';
import { useGameSelector } from '@/contexts/game/useGameSelector';
import { Card, IconBubble } from '@/components/ui/Card';
import {
  evaluateChallengeProgress,
  getWeeklyChallengeDefinition,
  ROTATION_GAME_WEEKS,
} from '@/lib/challenges/weeklyChallenges';
import { fontScale, scale } from '@/utils/scaling';
import type { GameState } from '@/contexts/game/types';

/** "2 weeks left" reads better than a raw week number. */
export function weeksLeftLabel(startedWeek: number | undefined, weeksLived: number): string {
  if (typeof startedWeek !== 'number' || !Number.isFinite(startedWeek)) return 'Rotates soon';
  const left = ROTATION_GAME_WEEKS - (weeksLived - startedWeek);
  if (left <= 0) return 'Rotates this week';
  return `${left} week${left === 1 ? '' : 's'} left`;
}

/** Clamped 0..1 fraction for an objective's bar. */
export function objectiveFraction(current: number, target: number): number {
  if (!Number.isFinite(current) || !Number.isFinite(target) || target <= 0) return 0;
  return Math.max(0, Math.min(1, current / target));
}

function WeeklyChallengeCard() {
  // Objectives read arbitrary state fields, so select the whole snapshot for
  // this one card - same approach as AmbitionCard / LifeChapterCard.
  const state = useGameSelector((s) => s) as GameState;

  const view = useMemo(() => {
    const challenge = state?.weeklyChallenge;
    if (!challenge?.challengeId) return null;

    const definition = getWeeklyChallengeDefinition(challenge.challengeId);
    if (!definition) return null;

    const objectives = evaluateChallengeProgress(challenge.challengeId, state);
    if (objectives.length === 0) return null;

    const met = objectives.filter((o) => o.completed).length;
    return {
      definition,
      objectives,
      met,
      total: objectives.length,
      claimed: !!challenge.rewardClaimed,
      weeksLeft: weeksLeftLabel(challenge.startedWeek, state.weeksLived ?? 0),
    };
  }, [state]);

  // Old saves and any life that has not ticked yet simply have no challenge.
  if (!view) return null;

  const { definition, objectives, met, total, claimed, weeksLeft } = view;
  const allMet = met === total;

  return (
    <Card style={claimed && styles.cardDone}>
      <View style={styles.header}>
        <IconBubble color="#F472B6">
          <Text style={styles.crestEmoji}>{definition.emoji || '🎯'}</Text>
        </IconBubble>
        <View style={{ flex: 1 }}>
          <View style={styles.titleRow}>
            <Swords size={scale(13)} color="#F472B6" />
            <Text style={styles.kicker}>WEEKLY CHALLENGE</Text>
          </View>
          <Text style={styles.title} numberOfLines={1}>
            {definition.name}
          </Text>
          <Text style={styles.sub}>
            {/* "Complete", not "Reward collected". `rewardClaimed` is also set
                when a challenge is minted already-satisfied (see
                getOrRotateWeeklyChallenge) - no gems are paid in that case, and
                claiming they were is a lie the player can check against their
                gem balance. This wording is true either way. */}
            {claimed ? 'Complete' : `${met}/${total} objectives`}
          </Text>
        </View>
        {claimed ? (
          <View style={styles.doneBadge}>
            <Trophy size={scale(16)} color="#FBBF24" />
          </View>
        ) : (
          <View style={styles.rewardChip}>
            <Gem size={scale(12)} color="#FBBF24" />
            <Text style={styles.rewardChipText}>{definition.reward}</Text>
          </View>
        )}
      </View>

      <View style={styles.list}>
        {objectives.map((o) => (
          <View key={o.id} style={styles.row}>
            <View style={[styles.checkBubble, o.completed && styles.checkBubbleDone]}>
              {o.completed ? <Check size={scale(12)} color="#0F172A" /> : null}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.rowTitle, o.completed && styles.rowTitleDone]} numberOfLines={1}>
                {o.description}
              </Text>
              {!o.completed && (
                <>
                  <View style={styles.barBg}>
                    <View
                      style={[
                        styles.barFill,
                        { width: `${Math.round(objectiveFraction(o.current, o.target) * 100)}%` },
                      ]}
                    />
                  </View>
                  {/* Show the numbers only where they mean something - a 1/1
                      boolean objective reads as noise. */}
                  {o.target > 1 && (
                    <Text style={styles.rowDesc} numberOfLines={1}>
                      {Math.floor(o.current)} / {o.target}
                    </Text>
                  )}
                </>
              )}
            </View>
          </View>
        ))}
      </View>

      <View style={styles.footer}>
        <Timer size={scale(13)} color="#94A3B8" />
        <Text style={styles.footerText}>
          {/* "Complete", not "gems collected" - same reason as the header. A
              challenge minted already-satisfied carries `rewardClaimed: true`
              with no gems paid, and this is the line the player would check
              against their balance. */}
          {claimed
            ? `Complete · ${weeksLeft}`
            : allMet
              ? `All objectives met - ${definition.reward} gems on the next week`
              : weeksLeft}
        </Text>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  // Container from components/ui/Card; crest from IconBubble. The amber
  // cardDone border is a STATE (challenge complete), not an identity hue.
  cardDone: { borderColor: 'rgba(251, 191, 36, 0.35)' },
  header: { flexDirection: 'row', alignItems: 'center', gap: scale(12) },
  crestEmoji: { fontSize: fontScale(20) },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: scale(5) },
  kicker: { color: '#F472B6', fontSize: fontScale(10), fontWeight: '800', letterSpacing: 0.6 },
  title: { color: '#F8FAFC', fontSize: fontScale(15), fontWeight: '700', marginTop: scale(1) },
  sub: { color: '#94A3B8', fontSize: fontScale(11), marginTop: scale(1) },
  doneBadge: {
    width: scale(30),
    height: scale(30),
    borderRadius: scale(10),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(251, 191, 36, 0.14)',
  },
  rewardChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(4),
    paddingHorizontal: scale(9),
    paddingVertical: scale(5),
    borderRadius: scale(9),
    backgroundColor: 'rgba(251, 191, 36, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.3)',
  },
  rewardChipText: { color: '#FBBF24', fontSize: fontScale(12), fontWeight: '800' },
  list: { gap: scale(9) },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: scale(10) },
  checkBubble: {
    width: scale(18),
    height: scale(18),
    borderRadius: scale(9),
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: scale(1),
  },
  checkBubbleDone: { backgroundColor: '#34D399', borderColor: '#34D399' },
  rowTitle: { color: '#E2E8F0', fontSize: fontScale(12.5), fontWeight: '600' },
  rowTitleDone: { color: '#94A3B8', textDecorationLine: 'line-through' },
  barBg: {
    height: scale(4),
    borderRadius: scale(2),
    backgroundColor: 'rgba(148, 163, 184, 0.2)',
    marginTop: scale(5),
    overflow: 'hidden',
  },
  barFill: { height: '100%', borderRadius: scale(2), backgroundColor: '#F472B6' },
  rowDesc: { color: '#94A3B8', fontSize: fontScale(10.5), marginTop: scale(3) },
  footer: { flexDirection: 'row', alignItems: 'center', gap: scale(7) },
  footerText: { flex: 1, color: '#94A3B8', fontSize: fontScale(11) },
});

export default React.memo(WeeklyChallengeCard);
