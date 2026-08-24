import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Target, Plus, Minus } from 'lucide-react-native';
import { SavingsGoal } from '@/contexts/game/types';
import { responsiveFontSize, responsiveSpacing, responsiveBorderRadius, scale } from '@/utils/scaling';
import { hitSlopToMinTarget } from '@/utils/touchTargets';
import { getThemeColors, accent } from '@/lib/config/theme';
import { getGlassCard, getGlassIconContainer } from '@/utils/glassmorphismStyles';

import { formatMoney } from '@/utils/moneyFormatting';

interface Props {
  goal: SavingsGoal;
  darkMode: boolean;
  onContribute?: () => void;
  /**
   * R3-M5: contributing used to be a one-way door - the cash left `stats.money`
   * and nothing could get it back. The withdraw affordance has to be visible on
   * a COMPLETED goal too, which is where the money is most likely to be sitting.
   */
  onWithdraw?: () => void;
}

/** Visual size of the +/- circles; the hit slop below is derived from it. */
const BTN_SIZE = scale(28);

/**
 * The two circles are adjacent and only `responsiveSpacing.sm` apart, so the
 * SYMMETRIC slop `hitSlopToMinTarget` returns would make their hit rectangles
 * OVERLAP - and RN hit-tests the last-rendered child first, so a tap just right
 * of the minus would deposit instead of withdraw. These move real money in
 * opposite directions, which makes the overlap the one thing worth avoiding.
 *
 * So: take the helper's per-side figure as the requirement, cap the edge that
 * FACES the neighbour at half the gap between them, and push the remainder onto
 * the outward edge. The horizontal total is unchanged, so both buttons still
 * clear 44pt on both axes, and their hit areas meet without ever overlapping.
 */
const BASE_SLOP = hitSlopToMinTarget(BTN_SIZE);
const HIT_INNER = Math.min(BASE_SLOP.left, Math.floor(responsiveSpacing.sm / 2));
const HIT_OUTER = BASE_SLOP.left + BASE_SLOP.right - HIT_INNER;
/** Withdraw (−) sits left of deposit (+), so its inner edge is the right one. */
const WITHDRAW_HIT_SLOP = {
  top: BASE_SLOP.top,
  bottom: BASE_SLOP.bottom,
  left: HIT_OUTER,
  right: HIT_INNER,
};
const DEPOSIT_HIT_SLOP = {
  top: BASE_SLOP.top,
  bottom: BASE_SLOP.bottom,
  left: HIT_INNER,
  right: HIT_OUTER,
};

const CATEGORY_COLOR: Record<string, string> = {
  emergency: accent.danger,
  house: accent.info,
  vacation: '#06b6d4',
  retirement: '#a855f7',
  other: '#64748b',
};

// RGB triplets that mirror CATEGORY_COLOR - used for the Recipe C tinted bubble
// (15% fill / 30% rim) so the categorical hue survives while its volume drops.
const CATEGORY_RGB: Record<string, string> = {
  emergency: '239, 68, 68',
  house: '59, 130, 246',
  vacation: '6, 182, 212',
  retirement: '168, 85, 247',
  other: '100, 116, 139',
};

export default function SavingsGoalCard({ goal, darkMode, onContribute, onWithdraw }: Props) {
  const theme = getThemeColors(darkMode);
  const progress = goal.targetAmount > 0 ? goal.currentAmount / goal.targetAmount : 0;
  const pct = Math.max(0, Math.min(1, progress));
  const color = CATEGORY_COLOR[goal.category] ?? '#64748b';
  const rgb = CATEGORY_RGB[goal.category] ?? '100, 116, 139';
  const complete = pct >= 1;

  return (
    <View style={[getGlassCard(darkMode, 6), styles.card, { backgroundColor: theme.surface, borderColor: theme.border, borderWidth: 1, borderRadius: responsiveBorderRadius.xl }]}>
      <View style={styles.headerRow}>
        <View style={[getGlassIconContainer(darkMode, 32), { backgroundColor: `rgba(${rgb}, 0.15)`, borderWidth: 1, borderColor: `rgba(${rgb}, 0.30)` }]}>
          <Target size={scale(16)} color={color} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.name, { color: theme.text }]} numberOfLines={1}>
            {goal.name}
          </Text>
          <Text style={[styles.sub, { color: theme.textMuted }]}>
            {formatMoney(goal.currentAmount)} of {formatMoney(goal.targetAmount)}
          </Text>
        </View>
        {/*
          Two 28pt circles sitting side by side, both moving REAL money in
          opposite directions, with no hit slop and nothing for a screen reader
          to read out. The hit slops above grow each one to the repo's
          `MIN_TOUCH_TARGET` (44pt) without changing the visual size, and
          the labels name the goal so "Add to" is unambiguous when a screen has
          several cards.
        */}
        {onWithdraw && goal.currentAmount > 0 && (
          <TouchableOpacity
            onPress={onWithdraw}
            hitSlop={WITHDRAW_HIT_SLOP}
            accessibilityRole="button"
            accessibilityLabel={`Withdraw from ${goal.name}`}
            style={[styles.addBtn, { backgroundColor: `rgba(${rgb}, 0.15)`, borderColor: `rgba(${rgb}, 0.30)` }]}
          >
            <Minus size={scale(14)} color={color} />
          </TouchableOpacity>
        )}
        {onContribute && !complete && (
          <TouchableOpacity
            onPress={onContribute}
            hitSlop={DEPOSIT_HIT_SLOP}
            accessibilityRole="button"
            accessibilityLabel={`Add to ${goal.name}`}
            style={[styles.addBtn, { backgroundColor: `rgba(${rgb}, 0.15)`, borderColor: `rgba(${rgb}, 0.30)` }]}
          >
            <Plus size={scale(14)} color={color} />
          </TouchableOpacity>
        )}
      </View>
      <View style={[styles.track, { backgroundColor: theme.surfaceElevated }]}>
        <View style={[styles.fill, { width: `${pct * 100}%`, backgroundColor: color }]} />
      </View>
      <Text style={[styles.pctText, { color: complete ? color : theme.textMuted }]}>
        {complete ? 'Goal reached!' : `${Math.round(pct * 100)}% complete`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: responsiveSpacing.md,
    gap: responsiveSpacing.sm,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: responsiveSpacing.sm,
  },
  name: {
    fontSize: responsiveFontSize.md,
    fontWeight: '700',
  },
  sub: {
    fontSize: responsiveFontSize.sm,
    marginTop: 2,
    fontVariant: ['tabular-nums'],
  },
  addBtn: {
    width: BTN_SIZE,
    height: BTN_SIZE,
    borderRadius: BTN_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  track: {
    height: scale(6),
    borderRadius: responsiveBorderRadius.full,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: responsiveBorderRadius.full,
  },
  pctText: {
    fontSize: responsiveFontSize.xs,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
});
