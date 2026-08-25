/**
 * ScenarioChallengeCard - the run the player signed up for, finally visible.
 *
 * The 23 challenge scenarios carry authored win conditions and gem rewards,
 * evaluated in exactly one place: `executePrestige`, first prestige only. So a
 * player who chose "Rags to Riches" at onboarding played the whole life with
 * no view of the conditions, no progress, and no idea the reward existed —
 * the same built-but-invisible class as the weekly challenge before GP-1
 * (2026-08-25 retention audit).
 *
 * Deliberately read-only, the WeeklyChallengeCard contract: prestige owns the
 * grant, this only surfaces what it will pay. Both read the SAME projection
 * (`projectScenarioState`), so a condition shown met here is met at payout.
 * Renders null for lives without a challenge scenario and after the first
 * prestige (the payout is spent — advertising gems that can no longer be won
 * would be a lie).
 */
import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Check, Flag, Gem, Trophy } from 'lucide-react-native';
import { useGameSelector } from '@/contexts/game/useGameSelector';
import { getActiveScenarioProgress } from '@/lib/scenarios/progress';
import { getDifficultyColor, getDifficultyLabel } from '@/lib/scenarios/scenarioDefinitions';
import { fontScale, scale, responsiveBorderRadius } from '@/utils/scaling';
import type { GameState } from '@/contexts/game/types';

function ScenarioChallengeCard() {
  // Win conditions read money, careers, relationships, achievements, banking —
  // arbitrary state — so select the whole snapshot for this one card, the
  // WeeklyChallengeCard / AmbitionCard trade-off.
  const state = useGameSelector((s) => s) as GameState;
  const view = useMemo(() => getActiveScenarioProgress(state), [state]);

  if (!view) return null;

  const difficultyColor = getDifficultyColor(view.difficulty);

  return (
    <View style={[styles.card, view.complete && styles.cardDone]}>
      <View style={styles.header}>
        <View style={styles.crest}>
          <Text style={styles.crestEmoji}>{view.icon || '🏁'}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <View style={styles.titleRow}>
            <Flag size={scale(13)} color="#38BDF8" />
            <Text style={styles.kicker}>LIFE CHALLENGE</Text>
            <View style={[styles.difficultyChip, { borderColor: difficultyColor }]}>
              <Text style={[styles.difficultyText, { color: difficultyColor }]}>
                {getDifficultyLabel(view.difficulty).toUpperCase()}
              </Text>
            </View>
          </View>
          <Text style={styles.title} numberOfLines={1}>
            {view.name}
          </Text>
          <Text style={styles.sub}>
            {view.complete ? 'All conditions met' : `${view.metCount}/${view.total} conditions`}
          </Text>
        </View>
        {view.complete ? (
          <View style={styles.doneBadge}>
            <Trophy size={scale(16)} color="#FBBF24" />
          </View>
        ) : view.gems > 0 ? (
          <View style={styles.rewardChip}>
            <Gem size={scale(12)} color="#FBBF24" />
            <Text style={styles.rewardChipText}>{view.gems}</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.list}>
        {view.rows.map((row) => (
          <View key={row.description} style={styles.row}>
            <View style={[styles.checkBubble, row.met && styles.checkBubbleDone]}>
              {row.met ? <Check size={scale(12)} color="#0F172A" /> : null}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.rowTitle, row.met && styles.rowTitleDone]} numberOfLines={2}>
                {row.description}
              </Text>
              {!row.met && row.progress > 0 && (
                <View style={styles.barBg}>
                  <View
                    style={[styles.barFill, { width: `${Math.round(row.progress * 100)}%` }]}
                  />
                </View>
              )}
            </View>
          </View>
        ))}
      </View>

      <Text style={styles.footerText}>
        {/* Honest about WHEN it pays: the grant lives in executePrestige and
            fires on the first prestige only. */}
        {view.complete
          ? view.gems > 0
            ? `${view.gems} gems when you prestige`
            : 'Complete'
          : view.gems > 0
            ? `Pays ${view.gems} gems at your first prestige`
            : 'Scored at your first prestige'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: scale(16),
    marginBottom: scale(12),
    padding: scale(14),
    borderRadius: responsiveBorderRadius.lg,
    backgroundColor: 'rgba(30, 41, 59, 0.75)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.32)',
    gap: scale(12),
  },
  cardDone: { borderColor: 'rgba(251, 191, 36, 0.35)' },
  header: { flexDirection: 'row', alignItems: 'center', gap: scale(12) },
  crest: {
    width: scale(40),
    height: scale(40),
    borderRadius: scale(12),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(56, 189, 248, 0.13)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.4)',
  },
  crestEmoji: { fontSize: fontScale(20) },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: scale(5) },
  kicker: { color: '#38BDF8', fontSize: fontScale(10), fontWeight: '800', letterSpacing: 0.6 },
  difficultyChip: {
    paddingHorizontal: scale(6),
    paddingVertical: scale(1),
    borderRadius: scale(6),
    borderWidth: 1,
  },
  difficultyText: { fontSize: fontScale(8.5), fontWeight: '800', letterSpacing: 0.4 },
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
  barFill: { height: '100%', borderRadius: scale(2), backgroundColor: '#38BDF8' },
  footerText: { color: '#94A3B8', fontSize: fontScale(11) },
});

export default React.memo(ScenarioChallengeCard);
