/**
 * LifeGoalsPanel - the perk catalogue and how close the player is to each one.
 *
 * ## Why this is a list of rows and not a list of cards
 *
 * It used to render one 160pt gradient card per perk, each carrying its own
 * progress bar and a "0 / 1 completed" counter. With 21 perks that is a
 * 3,400pt column in which barely one and a half entries are on screen at once,
 * and the player's actual question - *which of these have I got, and what is
 * the nearest one I have not?* - could not be answered without scrolling the
 * whole thing.
 *
 * Two things went, for the same reason. The per-card progress bar measured a
 * BINARY: a perk is unlocked by one achievement, so every bar in the list read
 * 0% or 100% and the ladder of "nearly there" it implied did not exist. And
 * the counter under it said the same thing a third time. Both are replaced by
 * one bar at the top that measures something real - how much of the catalogue
 * is unlocked - and a check mark on the rows that are.
 *
 * The sections are the structure: unlocked first (what you have earned), then
 * locked (what is left). That ordering is also what makes the list scannable
 * on a save with three perks and on a save with twenty.
 *
 * ## No nested ScrollView
 *
 * This panel renders INSIDE `SettingsModal`'s ScrollView. The previous version
 * mounted its own with `flex: 1`, which is the classic nested-scroll trap: the
 * inner view has no definite height to flex against, so it competes with the
 * parent for the gesture and reports a layout the parent cannot size around.
 * The parent already scrolls; this contributes rows.
 */

import React, { useMemo } from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { Target, Check, Lock } from 'lucide-react-native';
import { perks, type Perk } from '@/src/features/onboarding/perksData';
import { useGameSelector, shallowEqual } from '@/contexts/game/useGameSelector';
import { getSatisfiedAchievementIds } from '@/lib/progress/earnedAchievements';
import { safeSettings } from '@/utils/safeGameState';
import { responsivePadding, responsiveSpacing, scale, fontScale } from '@/utils/scaling';

/** Rarity is the one piece of colour on a row - it is the only thing on the
 *  card that varies per perk and means something at a glance. */
const RARITY_COLORS: Record<string, string> = {
  Common: '#94A3B8',
  Uncommon: '#34D399',
  Rare: '#60A5FA',
  Epic: '#A78BFA',
  Legendary: '#FBBF24',
};

function rarityColor(rarity: string): string {
  return RARITY_COLORS[rarity] ?? RARITY_COLORS.Common;
}

interface RowProps {
  perk: Perk;
  unlocked: boolean;
  darkMode: boolean;
}

function PerkRow({ perk, unlocked, darkMode }: RowProps) {
  const accent = rarityColor(perk.rarity);

  return (
    <View
      style={[
        styles.row,
        darkMode ? styles.rowDark : styles.rowLight,
        unlocked && styles.rowUnlocked,
      ]}
      accessibilityRole="summary"
      accessibilityLabel={`${perk.title}, ${unlocked ? 'unlocked' : 'locked'}. ${
        unlocked ? perk.description : perk.requirement
      }`}
    >
      <View style={[styles.iconBubble, { borderColor: `${accent}55` }]}>
        {typeof perk.icon === 'string' ? (
          <Text style={styles.iconGlyph}>{perk.icon}</Text>
        ) : (
          <Image source={perk.icon} style={styles.iconImage} resizeMode="contain" />
        )}
      </View>

      <View style={styles.rowBody}>
        <View style={styles.titleRow}>
          <Text
            style={[styles.title, darkMode ? styles.titleDark : styles.titleLight]}
            numberOfLines={1}
          >
            {perk.title}
          </Text>
          <Text style={[styles.rarity, { color: accent }]} numberOfLines={1}>
            {perk.rarity}
          </Text>
        </View>

        {/* Unlocked perks lead with what they DO - the requirement is history.
            Locked ones lead with the requirement, which is the actionable half. */}
        <Text
          style={[styles.detail, darkMode ? styles.detailDark : styles.detailLight]}
          numberOfLines={2}
        >
          {unlocked ? perk.description : perk.requirement}
        </Text>
      </View>

      <View style={[styles.statusPip, unlocked ? styles.statusPipDone : styles.statusPipLocked]}>
        {unlocked ? (
          <Check size={scale(12)} color="#10B981" strokeWidth={3} />
        ) : (
          <Lock size={scale(11)} color="#64748B" />
        )}
      </View>
    </View>
  );
}

export default function LifeGoalsPanel() {
  // The LIVE achievement system, not `s.achievements` - that array's `completed`
  // flag has no writer (`evaluateAchievements` is a no-op stub), so this panel
  // rendered every life goal at 0% forever. `getSatisfiedAchievementIds` returns
  // a superset of that all-false array, so a goal can only go from incomplete to
  // complete here, never the reverse.
  const earnedAchievementIds = useGameSelector(
    (s) => getSatisfiedAchievementIds(s),
    shallowEqual
  );
  const settings = useGameSelector((s) => safeSettings(s), shallowEqual);
  const darkMode = !!settings?.darkMode;

  const { unlocked, locked, pct } = useMemo(() => {
    const earned = new Set(earnedAchievementIds);
    const unlockedList: Perk[] = [];
    const lockedList: Perk[] = [];
    for (const perk of perks) {
      if (perk.unlock && earned.has(perk.unlock.achievementId)) unlockedList.push(perk);
      else lockedList.push(perk);
    }
    const total = perks.length;
    return {
      unlocked: unlockedList,
      locked: lockedList,
      pct: total > 0 ? Math.round((unlockedList.length / total) * 100) : 0,
    };
  }, [earnedAchievementIds]);

  return (
    <View style={styles.panel}>
      <View style={styles.header}>
        <View style={styles.headerIcon}>
          <Target size={scale(16)} color="#F59E0B" />
        </View>
        <View style={styles.headerText}>
          <Text style={[styles.headerTitle, darkMode ? styles.titleDark : styles.titleLight]}>
            Life Goals
          </Text>
          <Text style={[styles.headerSub, darkMode ? styles.detailDark : styles.detailLight]}>
            Earn perks that carry into your next life
          </Text>
        </View>
      </View>

      {/* The one progress bar that measures something that is not binary. */}
      <View style={[styles.summary, darkMode ? styles.rowDark : styles.rowLight]}>
        <View style={styles.summaryHead}>
          <Text style={[styles.summaryLabel, darkMode ? styles.detailDark : styles.detailLight]}>
            Perks unlocked
          </Text>
          <Text style={[styles.summaryValue, darkMode ? styles.titleDark : styles.titleLight]}>
            {unlocked.length} / {perks.length}
          </Text>
        </View>
        <View style={[styles.track, darkMode ? styles.trackDark : styles.trackLight]}>
          <View style={[styles.trackFill, { width: `${pct}%` }]} />
        </View>
      </View>

      {unlocked.length > 0 && (
        <>
          <Text style={styles.sectionLabel}>Unlocked · {unlocked.length}</Text>
          {unlocked.map((perk) => (
            <PerkRow key={perk.id} perk={perk} unlocked darkMode={darkMode} />
          ))}
        </>
      )}

      <Text style={styles.sectionLabel}>Locked · {locked.length}</Text>
      {locked.map((perk) => (
        <PerkRow key={perk.id} perk={perk} unlocked={false} darkMode={darkMode} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    paddingHorizontal: responsivePadding.large,
    paddingBottom: responsiveSpacing.lg,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(10),
    paddingTop: responsiveSpacing.sm,
    paddingBottom: responsiveSpacing.sm,
  },
  headerIcon: {
    width: scale(32),
    height: scale(32),
    borderRadius: scale(10),
    backgroundColor: 'rgba(245, 158, 11, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: { flex: 1, minWidth: 0 },
  headerTitle: { fontSize: fontScale(16), fontWeight: '800', letterSpacing: -0.2 },
  headerSub: { fontSize: fontScale(11), fontWeight: '500', marginTop: scale(1) },

  summary: {
    borderRadius: scale(12),
    borderWidth: 1,
    paddingHorizontal: scale(12),
    paddingVertical: scale(10),
    marginBottom: scale(4),
  },
  summaryHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: scale(7),
  },
  summaryLabel: {
    fontSize: fontScale(10.5),
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  summaryValue: { fontSize: fontScale(13), fontWeight: '800', fontVariant: ['tabular-nums'] },
  track: { height: scale(6), borderRadius: scale(3), overflow: 'hidden' },
  trackDark: { backgroundColor: 'rgba(148, 163, 184, 0.18)' },
  trackLight: { backgroundColor: 'rgba(15, 23, 42, 0.1)' },
  trackFill: { height: '100%', borderRadius: scale(3), backgroundColor: '#10B981' },

  sectionLabel: {
    fontSize: fontScale(10),
    fontWeight: '800',
    color: '#94A3B8',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: scale(14),
    marginBottom: scale(7),
  },

  /* Hard Rule #7: a full 1pt border on all four sides, never a one-sided
     accent stripe. Rarity is carried by the icon ring and the label instead. */
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(10),
    borderRadius: scale(12),
    borderWidth: 1,
    paddingHorizontal: scale(10),
    paddingVertical: scale(9),
    marginBottom: scale(7),
  },
  rowDark: { backgroundColor: 'rgba(30, 41, 59, 0.7)', borderColor: 'rgba(255, 255, 255, 0.08)' },
  rowLight: { backgroundColor: 'rgba(255, 255, 255, 0.92)', borderColor: 'rgba(15, 23, 42, 0.08)' },
  rowUnlocked: { borderColor: 'rgba(16, 185, 129, 0.38)' },

  iconBubble: {
    width: scale(40),
    height: scale(40),
    borderRadius: scale(12),
    borderWidth: 1,
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  iconImage: { width: scale(30), height: scale(30) },
  iconGlyph: { fontSize: scale(20) },

  rowBody: { flex: 1, minWidth: 0 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: scale(6) },
  title: { flex: 1, fontSize: fontScale(13.5), fontWeight: '700', letterSpacing: -0.2 },
  titleDark: { color: '#F8FAFC' },
  titleLight: { color: '#0F172A' },
  rarity: { fontSize: fontScale(9.5), fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },

  detail: { fontSize: fontScale(11), fontWeight: '500', lineHeight: fontScale(15), marginTop: scale(2) },
  detailDark: { color: '#94A3B8' },
  detailLight: { color: '#475569' },

  statusPip: {
    width: scale(22),
    height: scale(22),
    borderRadius: scale(11),
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  statusPipDone: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderColor: 'rgba(16, 185, 129, 0.4)',
  },
  statusPipLocked: {
    backgroundColor: 'rgba(100, 116, 139, 0.14)',
    borderColor: 'rgba(100, 116, 139, 0.3)',
  },
});
