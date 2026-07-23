/**
 * DailyGemClaim — the DeepLife+ members-only daily gem drop, shown on the
 * identity card.
 *
 *   • Active member, not claimed today → a gold "Claim 500 gems" button.
 *   • Active member, already claimed    → a calm "Claimed · back tomorrow" chip.
 *   • Non-member                        → a teaser that opens the DeepLife+
 *                                          paywall (so it doubles as an upsell).
 *
 * The reset boundary is the real UTC calendar day; the grant + day-stamp live in
 * the pure `claimDailyDeepLifePlusGems` reducer, so this component only wires up
 * state, save, and haptics.
 */
import React, { useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Gem, Crown, ChevronRight, Check } from 'lucide-react-native';
import { useGameSelector, shallowEqual, useSetGameState } from '@/contexts/game/useGameSelector';
import { useGameActions } from '@/contexts/game/GameActionsContext';
import { useDeepLifePlusUpsell } from '@/hooks/useDeepLifePlusUpsell';
import SubscriptionModal from '@/components/SubscriptionModal';
import { haptic } from '@/utils/haptics';
import { scale, fontScale } from '@/utils/scaling';
import {
  DEEP_LIFE_PLUS_DAILY_GEMS,
  utcDayKey,
} from '@/lib/subscription/deepLifePlus';
import { claimDailyDeepLifePlusGems } from '@/contexts/game/actions/SubscriptionActions';

const GOLD = '#FACC15';
const GOLD_SOFT = '#FDE68A';
const INK = '#1A1206';

export default function DailyGemClaim() {
  const setGameState = useSetGameState();
  const { saveGame } = useGameActions();
  const { active, open, present, close } = useDeepLifePlusUpsell('daily_gems');
  const lastClaim = useGameSelector((s) => s.settings?.deepLifePlusLastGemClaim, shallowEqual);

  const todayKey = utcDayKey(new Date());
  const claimedToday = active && lastClaim === todayKey;

  const onClaim = useCallback(() => {
    // Re-read "today" at claim time so a session open across midnight still
    // stamps the correct day.
    const key = utcDayKey(new Date());
    haptic.success();
    setGameState((prev) => claimDailyDeepLifePlusGems(prev, key));
    void saveGame?.(false);
  }, [setGameState, saveGame]);

  // ── Non-member: an upsell teaser that opens the paywall ──
  if (!active) {
    return (
      <>
        <TouchableOpacity
          onPress={present}
          activeOpacity={0.9}
          accessibilityRole="button"
          accessibilityLabel={`DeepLife Plus — claim ${DEEP_LIFE_PLUS_DAILY_GEMS} gems every day`}
          style={styles.teaser}
        >
          <View style={styles.iconWrapMuted}>
            <Crown size={scale(16)} color={GOLD} fill={GOLD} />
          </View>
          <Text style={styles.teaserText}>
            <Text style={styles.teaserBrand}>DeepLife+</Text> members claim{' '}
            {DEEP_LIFE_PLUS_DAILY_GEMS} gems every day
          </Text>
          <ChevronRight size={fontScale(16)} color={GOLD_SOFT} />
        </TouchableOpacity>
        <SubscriptionModal visible={open} onClose={close} />
      </>
    );
  }

  // ── Member, already claimed today ──
  if (claimedToday) {
    return (
      <View style={[styles.claim, styles.claimDone]} accessibilityRole="text">
        <Check size={fontScale(15)} color={GOLD_SOFT} />
        <Text style={styles.claimDoneText}>Daily gems claimed · back tomorrow</Text>
      </View>
    );
  }

  // ── Member, ready to claim ──
  return (
    <TouchableOpacity
      onPress={onClaim}
      activeOpacity={0.9}
      accessibilityRole="button"
      accessibilityLabel={`Claim your ${DEEP_LIFE_PLUS_DAILY_GEMS} daily gems`}
      style={styles.claim}
    >
      <View style={styles.iconWrap}>
        <Gem size={scale(16)} color={INK} fill={INK} />
      </View>
      <Text style={styles.claimText}>
        Claim your <Text style={styles.claimAmount}>{DEEP_LIFE_PLUS_DAILY_GEMS}</Text> daily gems
      </Text>
      <ChevronRight size={fontScale(16)} color={INK} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  claim: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(10),
    backgroundColor: GOLD,
    borderRadius: scale(14),
    paddingVertical: scale(11),
    paddingHorizontal: scale(14),
    marginTop: scale(10),
  },
  claimText: { flex: 1, color: INK, fontSize: fontScale(14), fontWeight: '800' },
  claimAmount: { fontWeight: '900' },
  iconWrap: {
    width: scale(28),
    height: scale(28),
    borderRadius: scale(14),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(26,18,6,0.14)',
  },
  claimDone: {
    backgroundColor: 'rgba(250, 204, 21, 0.10)',
    borderWidth: 1,
    borderColor: 'rgba(250, 204, 21, 0.35)',
    justifyContent: 'center',
  },
  claimDoneText: { color: GOLD_SOFT, fontSize: fontScale(12.5), fontWeight: '700' },

  teaser: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(10),
    marginTop: scale(10),
    paddingVertical: scale(10),
    paddingHorizontal: scale(14),
    borderRadius: scale(14),
    backgroundColor: 'rgba(250, 204, 21, 0.10)',
    borderWidth: 1,
    borderColor: 'rgba(250, 204, 21, 0.40)',
  },
  iconWrapMuted: {
    width: scale(28),
    height: scale(28),
    borderRadius: scale(14),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(250, 204, 21, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(250, 204, 21, 0.35)',
  },
  teaserText: { flex: 1, color: GOLD_SOFT, fontSize: fontScale(12.5), fontWeight: '700' },
  teaserBrand: { color: GOLD, fontWeight: '900' },
});
