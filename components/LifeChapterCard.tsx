/**
 * LifeChapterCard - the front door for the Life Chapters spine.
 *
 * The chapter system (lib/progress/lifeChapters.ts) was fully built - chapters,
 * goals, progress, rewards - but had NO UI and never granted anything. This
 * card shows the active chapter's goals with live progress.
 *
 * It is now READ-ONLY. Chapter completion drives progressive disclosure
 * (`lib/progress/featureUnlocks.ts` reads `completedChapters`), so it cannot
 * depend on the player finding this card and tapping a button - the week tick
 * owns it, in `actions/weekly/applyChapterProgress.ts`, and grants the reward
 * with a notification naming what was unlocked.
 */
import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { BookOpen, Check, Gift } from 'lucide-react-native';
import { useGameSelector } from '@/contexts/game/useGameSelector';
import Card from '@/components/ui/Card';
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
    <Card>
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
        * grants the reward (`applyChapterProgress`). It has to - chapter
        * completions drive what the player can see, and gating that on finding
        * this card and tapping a button meant the unlock spine depended on a
        * screen they might never open.
        *
        * So this is a status line, not a button - and it has to LOOK like one.
        * It used to render as a solid amber full-width bar with bold dark text,
        * i.e. pixel-for-pixel the app's primary CTA, on a `View` with no
        * `onPress`. Players tapped it and nothing happened; a dead tap reads as
        * a bug, and it was reported as exactly that ("can't claim reward",
        * 2026-08-14). Adding the handler back is not the fix - that is the
        * second granting path the tick was built to remove. Looking like what
        * it is, is: a tinted status banner that says when the reward lands.
        */}
      {progress.isComplete ? (
        <View style={styles.completeBanner}>
          <Gift size={scale(15)} color="#FBBF24" />
          <Text style={styles.completeText}>
            All goals complete - +${reward.money.toLocaleString()} and +{reward.gems} gems
            arrive when you end the week.
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
    </Card>
  );
}

const styles = StyleSheet.create({
  // Container comes from components/ui/Card (one card, one border).
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
  // Status, not a call to action: tinted fill and a full 1px border on all four
  // sides (Hard Rule #7 bans one-sided accent bars), rather than the solid amber
  // fill + bold dark text the app's real buttons use. The amber tint is the same
  // `rgba(251, 191, 36, 0.15)` AmbitionCard uses for its own non-button badge,
  // directly below this card on the home screen.
  //
  // The COPY is `chapterTitle`'s `#F8FAFC`, not amber. The card paints its own
  // background at 0.75 alpha, so what sits behind the text depends on the page
  // under it: amber-on-tint measures ~7.6:1 over the dark home surface but
  // ~3.4:1 over a light one, under AA for text this size. The card's own text
  // colour clears 5:1 on both. Amber stays as the accent, on the icon and the
  // border, where a contrast floor does not apply.
  completeBanner: {
    flexDirection: 'row', alignItems: 'center', gap: scale(8),
    paddingVertical: scale(10), paddingHorizontal: scale(11),
    borderRadius: responsiveBorderRadius.md,
    backgroundColor: 'rgba(251, 191, 36, 0.15)',
    borderWidth: 1, borderColor: 'rgba(251, 191, 36, 0.4)',
  },
  completeText: { flex: 1, fontSize: fontScale(12.5), fontWeight: '700', color: '#F8FAFC' },
  rewardHint: { flexDirection: 'row', alignItems: 'center', gap: scale(6) },
  rewardHintText: { fontSize: fontScale(11.5), color: '#94A3B8', fontWeight: '600' },
});

export default React.memo(LifeChapterCard);
