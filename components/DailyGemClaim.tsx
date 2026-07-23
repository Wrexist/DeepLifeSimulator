/**
 * DailyGemClaim — the DeepLife+ members-only daily gem drop, shown on the
 * identity card.
 *
 *   • Active member → a Mon→Sun streak strip (green check = claimed, red cross =
 *     missed) plus a gold "Claim 500 gems" button (or a "claimed · back
 *     tomorrow" chip once today is done).
 *   • Non-member    → a teaser that opens the DeepLife+ paywall (doubles as an
 *     upsell).
 *
 * The reset boundary is the real UTC calendar day; the grant, day-stamp, and
 * claim-history live in the pure `claimDailyDeepLifePlusGems` reducer, so this
 * component only wires up state, save, and haptics.
 */
import React, { useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Gem, Crown, ChevronRight, Check, X } from 'lucide-react-native';
import { useGameSelector, shallowEqual, useSetGameState } from '@/contexts/game/useGameSelector';
import { useGameActions } from '@/contexts/game/GameActionsContext';
import { useDeepLifePlusUpsell } from '@/hooks/useDeepLifePlusUpsell';
import SubscriptionModal from '@/components/SubscriptionModal';
import { haptic } from '@/utils/haptics';
import { scale, fontScale } from '@/utils/scaling';
import {
  DEEP_LIFE_PLUS_DAILY_GEMS,
  utcDayKey,
  buildDeepLifePlusWeekStatus,
  type WeekDayCell,
} from '@/lib/subscription/deepLifePlus';
import { claimDailyDeepLifePlusGems } from '@/contexts/game/actions/SubscriptionActions';

// Fixed gold palette — intentionally NOT theme-driven, so the DeepLife+ surfaces
// keep their premium look in light and dark mode (same choice the paywall makes).
// Solid fills (no LinearGradient): the app's LinearGradient is the flat fallback
// — expo-linear-gradient crashes on New Arch — so it would render a solid colour
// here anyway. INK text on the gold button reads on any background.
const GOLD = '#FACC15';
const GOLD_SOFT = '#FDE68A';
const INK = '#1A1206';
const GREEN = '#22C55E';
const RED = '#EF4444';

/** Mon→Sun streak strip: green check for claimed days, red cross for missed. */
function WeekStrip({ cells }: { cells: WeekDayCell[] }) {
  return (
    <View style={styles.strip} accessibilityLabel="Daily gem claim streak this week">
      {cells.map((c, i) => (
        <View key={`${c.key}-${i}`} style={styles.stripCell}>
          <Text style={styles.stripLabel}>{c.label}</Text>
          <View style={[styles.dot, DOT_STYLE[c.status]]}>
            {c.status === 'claimed' ? (
              <Check size={scale(12)} color={INK} strokeWidth={3} />
            ) : c.status === 'missed' ? (
              <X size={scale(11)} color="#FFFFFF" strokeWidth={3} />
            ) : null}
          </View>
        </View>
      ))}
    </View>
  );
}

export default function DailyGemClaim() {
  const setGameState = useSetGameState();
  const { saveGame } = useGameActions();
  const { active, open, present, close } = useDeepLifePlusUpsell('daily_gems');
  const lastClaim = useGameSelector((s) => s.settings?.deepLifePlusLastGemClaim, shallowEqual);
  const claimDays = useGameSelector((s) => s.settings?.deepLifePlusGemClaimDays, shallowEqual);

  const todayKey = utcDayKey(new Date());
  const claimedToday = active && lastClaim === todayKey;
  const week = buildDeepLifePlusWeekStatus(claimDays, new Date());

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

  // ── Member: the weekly streak strip + claim / claimed state ──
  return (
    <View style={styles.wrap}>
      <WeekStrip cells={week} />
      {claimedToday ? (
        <View style={[styles.claim, styles.claimDone]} accessibilityRole="text">
          <Check size={fontScale(15)} color={GOLD_SOFT} />
          <Text style={styles.claimDoneText}>Daily gems claimed · back tomorrow</Text>
        </View>
      ) : (
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
      )}
    </View>
  );
}

const DOT_BASE = {
  width: scale(24),
  height: scale(24),
  borderRadius: scale(12),
  alignItems: 'center' as const,
  justifyContent: 'center' as const,
  borderWidth: 1.5,
};

const styles = StyleSheet.create({
  wrap: { marginTop: scale(10) },

  // Weekly streak strip
  strip: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: scale(8),
    paddingHorizontal: scale(4),
    marginBottom: scale(8),
    borderRadius: scale(14),
    backgroundColor: 'rgba(250, 204, 21, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(250, 204, 21, 0.20)',
  },
  stripCell: { alignItems: 'center', gap: scale(5), flex: 1 },
  stripLabel: { color: '#94A3B8', fontSize: fontScale(10), fontWeight: '800', letterSpacing: 0.3 },
  dot: DOT_BASE,

  // Claim button / chip
  claim: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(10),
    backgroundColor: GOLD,
    borderRadius: scale(14),
    paddingVertical: scale(11),
    paddingHorizontal: scale(14),
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

// Per-status dot appearance for the streak strip.
const DOT_STYLE: Record<WeekDayCell['status'], object> = {
  claimed: { backgroundColor: GREEN, borderColor: GREEN },
  missed: { backgroundColor: RED, borderColor: RED },
  today: { backgroundColor: 'rgba(250, 204, 21, 0.16)', borderColor: GOLD },
  future: { backgroundColor: 'transparent', borderColor: 'rgba(255,255,255,0.14)' },
  inactive: { backgroundColor: 'transparent', borderColor: 'rgba(255,255,255,0.07)' },
};
