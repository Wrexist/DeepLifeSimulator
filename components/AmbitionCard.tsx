/**
 * AmbitionCard — the in-game front door for the Life Ambition chosen at
 * character creation.
 *
 * READ-ONLY. Milestone progress is evaluated from the live state on every render
 * via the pure helpers in lib/ambitions, and that is all this card does: it
 * neither persists progress nor grants the payoff.
 *
 * The week tick owns both (`contexts/game/actions/weekly/applyAmbitionPayout.ts`).
 * It used to be the other way round — this card held the ONLY call to
 * `grantAmbitionPayout` anywhere in the app, behind a button, so the largest
 * reward in the game ($60k–$300k + gems + prestige points) went unpaid for any
 * player who never scrolled to it, and prestiging without tapping it burned the
 * ambition for every future life. Leaving the button in place as a second
 * granting path would just be two ways for the same one-time payoff to disagree,
 * so it is gone.
 *
 * Renders nothing when the life has no chosen ambition (old saves + freeform
 * lives) — so it is safe on every existing save.
 */
import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Check, Gem, Star, Target, Trophy } from 'lucide-react-native';
import { useGameSelector } from '@/contexts/game/useGameSelector';
import { formatMoney } from '@/utils/moneyFormatting';
import { getAmbitionCompletion } from '@/lib/ambitions';
import { fontScale, scale, responsiveBorderRadius } from '@/utils/scaling';
import type { GameState } from '@/contexts/game/types';

function AmbitionCard() {
  // Ambition milestones read arbitrary state fields, so select the whole
  // snapshot for this one card (same approach as LifeChapterCard).
  const state = useGameSelector((s) => s) as GameState;

  const completion = useMemo(() => (state ? getAmbitionCompletion(state) : null), [state]);

  if (!completion) return null;
  const { ambition, milestones, reachedCount, totalCount, alreadyClaimed, readyToClaim } = completion;
  const { payoff } = ambition;

  const rewardParts: string[] = [];
  if (payoff.money) rewardParts.push(formatMoney(payoff.money));
  if (payoff.gems) rewardParts.push(`${payoff.gems} gems`);
  if (payoff.prestigePoints) rewardParts.push(`${payoff.prestigePoints} prestige`);
  const rewardLine = rewardParts.join(' · ');

  return (
    <View style={[styles.card, alreadyClaimed && styles.cardDone]}>
      <View style={styles.header}>
        <View style={[styles.crest, { backgroundColor: `${ambition.color}22`, borderColor: `${ambition.color}66` }]}>
          <Text style={styles.crestEmoji}>{ambition.emoji}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <View style={styles.titleRow}>
            <Target size={scale(13)} color="#60A5FA" />
            <Text style={styles.kicker}>LIFE AMBITION</Text>
          </View>
          <Text style={styles.title}>{ambition.name}</Text>
          <Text style={styles.sub}>
            {alreadyClaimed ? 'Fulfilled' : `${reachedCount}/${totalCount} milestones`}
          </Text>
        </View>
        {alreadyClaimed ? (
          <View style={styles.doneBadge}>
            <Trophy size={scale(16)} color="#FBBF24" />
          </View>
        ) : null}
      </View>

      <View style={styles.list}>
        {milestones.map((m) => (
          <View key={m.id} style={styles.row}>
            <View style={[styles.checkBubble, m.complete && styles.checkBubbleDone]}>
              {m.complete ? <Check size={scale(12)} color="#0F172A" /> : null}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.rowTitle, m.complete && styles.rowTitleDone]} numberOfLines={1}>
                {m.title}
              </Text>
              {!m.complete && (
                <>
                  <View style={styles.barBg}>
                    <View style={[styles.barFill, { width: `${Math.round(m.progress * 100)}%` }]} />
                  </View>
                  {!!m.description && (
                    <Text style={styles.rowDesc} numberOfLines={1}>
                      {m.description}
                    </Text>
                  )}
                </>
              )}
            </View>
          </View>
        ))}
      </View>

      {alreadyClaimed ? (
        <View style={styles.rewardHint}>
          <Trophy size={scale(13)} color="#FBBF24" />
          <Text style={styles.doneText}>Ambition fulfilled — reward claimed</Text>
        </View>
      ) : readyToClaim ? (
        // Every milestone is reached and the tick has not run yet. No button:
        // the payout lands on the next week advance without being asked for.
        <View style={styles.claimBanner}>
          <Trophy size={scale(15)} color="#0F172A" />
          <Text style={styles.claimText}>Fulfilled · {rewardLine} next week</Text>
        </View>
      ) : (
        <View style={styles.rewardHint}>
          <View style={styles.rewardChips}>
            {payoff.gems ? (
              <View style={styles.rewardChip}>
                <Gem size={scale(12)} color="#FBBF24" />
                <Text style={styles.rewardChipText}>{payoff.gems}</Text>
              </View>
            ) : null}
            {payoff.money ? (
              <View style={styles.rewardChip}>
                <Text style={styles.rewardChipText}>{formatMoney(payoff.money)}</Text>
              </View>
            ) : null}
            {payoff.prestigePoints ? (
              <View style={styles.rewardChip}>
                <Star size={scale(12)} color="#A855F7" />
                <Text style={styles.rewardChipText}>{payoff.prestigePoints}</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.rewardHintText}>on fulfilment</Text>
        </View>
      )}
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
    borderColor: 'rgba(59, 130, 246, 0.35)',
    gap: scale(12),
  },
  cardDone: {
    borderColor: 'rgba(251, 191, 36, 0.45)',
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: scale(10) },
  crest: {
    width: scale(44),
    height: scale(44),
    borderRadius: scale(12),
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  crestEmoji: { fontSize: fontScale(24) },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: scale(4) },
  kicker: { fontSize: fontScale(9.5), fontWeight: '800', color: '#60A5FA', letterSpacing: 0.6 },
  title: { fontSize: fontScale(15.5), fontWeight: '800', color: '#F8FAFC', marginTop: scale(1) },
  sub: { fontSize: fontScale(11.5), color: '#94A3B8', marginTop: scale(2) },
  doneBadge: {
    width: scale(34),
    height: scale(34),
    borderRadius: scale(17),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(251, 191, 36, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.5)',
  },
  list: { gap: scale(9) },
  row: { flexDirection: 'row', alignItems: 'center', gap: scale(10) },
  checkBubble: {
    width: scale(20),
    height: scale(20),
    borderRadius: scale(10),
    borderWidth: 1.5,
    borderColor: 'rgba(148, 163, 184, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkBubbleDone: { backgroundColor: '#34D399', borderColor: '#34D399' },
  rowTitle: { fontSize: fontScale(13), fontWeight: '600', color: '#E2E8F0' },
  rowTitleDone: { color: '#34D399' },
  rowDesc: { fontSize: fontScale(10.5), color: '#94A3B8', marginTop: scale(1) },
  barBg: {
    height: scale(4),
    borderRadius: scale(2),
    marginTop: scale(4),
    backgroundColor: 'rgba(148, 163, 184, 0.2)',
    overflow: 'hidden',
  },
  barFill: { height: '100%', borderRadius: scale(2), backgroundColor: '#3B82F6' },
  claimBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: scale(8),
    paddingVertical: scale(11),
    borderRadius: responsiveBorderRadius.md,
    backgroundColor: '#FBBF24',
  },
  claimText: { fontSize: fontScale(13), fontWeight: '800', color: '#0F172A' },
  rewardHint: { flexDirection: 'row', alignItems: 'center', gap: scale(8) },
  rewardChips: { flexDirection: 'row', alignItems: 'center', gap: scale(6), flexWrap: 'wrap' },
  rewardChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(4),
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: responsiveBorderRadius.full,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    paddingHorizontal: scale(8),
    paddingVertical: scale(3),
  },
  rewardChipText: { fontSize: fontScale(11), fontWeight: '800', color: '#F8FAFC' },
  rewardHintText: { fontSize: fontScale(11), color: '#94A3B8', fontWeight: '600' },
  doneText: { fontSize: fontScale(12), color: '#FBBF24', fontWeight: '700' },
});

export default React.memo(AmbitionCard);
