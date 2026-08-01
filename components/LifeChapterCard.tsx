/**
 * LifeChapterCard — the front door for the Life Chapters spine.
 *
 * The chapter system (lib/progress/lifeChapters.ts) was fully built — chapters,
 * goals, progress, rewards — but had NO UI and never granted anything. This
 * card shows the active chapter's goals with live progress.
 *
 * It is now READ-ONLY. Chapter completion drives progressive disclosure
 * (`lib/progress/featureUnlocks.ts` reads `completedChapters`), so it cannot
 * depend on the player finding this card and tapping a button — the week tick
 * owns it, in `actions/weekly/applyChapterProgress.ts`, and grants the reward
 * with a notification naming what was unlocked.
 */
import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { BookOpen, Check, Gift } from 'lucide-react-native';
import { useGameSelector } from '@/contexts/game/useGameSelector';
import { getActiveChapter, getChapterProgress } from '@/lib/progress/lifeChapters';
import { fontScale, scale, responsiveBorderRadius } from '@/utils/scaling';
import type { GameState } from '@/contexts/game/types';

function LifeChapterCard() {
  // Chapter goals read arbitrary state fields, so select the whole snapshot for
  // this one card. It re-renders on state change but the computation is cheap.
  const state = useGameSelector((s) => s) as GameState;

  const chapterData = useMemo(() => {
    if (!state) return null;
    const chapter = getActiveChapter(state);
    if (!chapter) return null;
    return { chapter, progress: getChapterProgress(chapter, state) };
  }, [state]);

  if (!chapterData) return null;
  const { chapter, progress } = chapterData;
  const reward = {
    money: chapter.completionReward.money + chapter.perGoalReward.money * progress.totalGoals,
    gems: chapter.completionReward.gems + chapter.perGoalReward.gems * progress.totalGoals,
  };

  /**
   * The claim handler used to live here. It is GONE, not disabled: the week
   * tick now completes chapters and grants the reward
   * (`actions/weekly/applyChapterProgress.ts`), and leaving a second granting
   * path in the component would be one re-wire away from paying twice.
   */

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.iconBubble}>
          <BookOpen size={scale(18)} color="#A855F7" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.chapterTitle}>{chapter.title}: {chapter.subtitle}</Text>
          <Text style={styles.chapterSub}>
            {progress.completedGoals}/{progress.totalGoals} goals complete
          </Text>
        </View>
      </View>

      <View style={styles.goalList}>
        {progress.goals.map((g) => {
          const goalDef = chapter.goals.find((cg) => cg.id === g.id);
          return (
            <View key={g.id} style={styles.goalRow}>
              <View style={[styles.checkBubble, g.complete && styles.checkBubbleDone]}>
                {g.complete ? <Check size={scale(12)} color="#0F172A" /> : null}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.goalTitle, g.complete && styles.goalTitleDone]} numberOfLines={1}>
                  {g.title}
                </Text>
                {!g.complete && (
                  <View style={styles.barBg}>
                    <View style={[styles.barFill, { width: `${Math.round(g.progress * 100)}%` }]} />
                  </View>
                )}
                {!!goalDef?.description && g.complete === false && (
                  <Text style={styles.goalDesc} numberOfLines={1}>{goalDef.description}</Text>
                )}
              </View>
            </View>
          );
        })}
      </View>

      {/**
        * Progressive disclosure: the WEEK TICK now completes chapters and
        * grants the reward (`applyChapterProgress`). It has to — chapter
        * completions drive what the player can see, and gating that on finding
        * this card and tapping a button meant the unlock spine depended on a
        * screen they might never open.
        *
        * So this is a status line, not a button. It shows on the tick where
        * the goals are all met and the tick has not yet run; the reward
        * arrives on Next Week with a notification naming what it unlocked.
        */}
      {progress.isComplete ? (
        <View style={styles.claimBtn}>
          <Gift size={scale(15)} color="#0F172A" />
          <Text style={styles.claimText}>
            Complete! +${reward.money.toLocaleString()} · +{reward.gems} gems next week
          </Text>
        </View>
      ) : (
        <View style={styles.rewardHint}>
          <Gift size={scale(13)} color="#94A3B8" />
          <Text style={styles.rewardHintText}>
            Reward: ${reward.money.toLocaleString()} + {reward.gems} gems
          </Text>
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
    borderColor: 'rgba(168, 85, 247, 0.35)',
    gap: scale(12),
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: scale(10) },
  iconBubble: {
    width: scale(38), height: scale(38), borderRadius: scale(19),
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(168, 85, 247, 0.15)',
  },
  chapterTitle: { fontSize: fontScale(15), fontWeight: '700', color: '#F8FAFC' },
  chapterSub: { fontSize: fontScale(11.5), color: '#94A3B8', marginTop: scale(2) },
  goalList: { gap: scale(9) },
  goalRow: { flexDirection: 'row', alignItems: 'center', gap: scale(10) },
  checkBubble: {
    width: scale(20), height: scale(20), borderRadius: scale(10),
    borderWidth: 1.5, borderColor: 'rgba(148, 163, 184, 0.5)',
    alignItems: 'center', justifyContent: 'center',
  },
  checkBubbleDone: { backgroundColor: '#34D399', borderColor: '#34D399' },
  goalTitle: { fontSize: fontScale(13), fontWeight: '600', color: '#E2E8F0' },
  goalTitleDone: { color: '#34D399' },
  goalDesc: { fontSize: fontScale(10.5), color: '#94A3B8', marginTop: scale(1) },
  barBg: {
    height: scale(4), borderRadius: scale(2), marginTop: scale(4),
    backgroundColor: 'rgba(148, 163, 184, 0.2)', overflow: 'hidden',
  },
  barFill: { height: '100%', borderRadius: scale(2), backgroundColor: '#A855F7' },
  claimBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: scale(8),
    paddingVertical: scale(11), borderRadius: responsiveBorderRadius.md,
    backgroundColor: '#FBBF24',
  },
  claimText: { fontSize: fontScale(13.5), fontWeight: '800', color: '#0F172A' },
  rewardHint: { flexDirection: 'row', alignItems: 'center', gap: scale(6) },
  rewardHintText: { fontSize: fontScale(11.5), color: '#94A3B8', fontWeight: '600' },
});

export default React.memo(LifeChapterCard);
