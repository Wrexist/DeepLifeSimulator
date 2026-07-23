/**
 * DailyGemClaim — the daily gem drop shown on the identity card. Everyone can
 * claim once per UTC day; the amount is tiered (DeepLife+ members 250, free
 * players 20).
 *
 *   • Everyone     → a Mon→Sun streak strip (green check = claimed, red cross =
 *     missed) plus a gold "Claim N gems" button (or a "claimed · back tomorrow"
 *     chip once today is done).
 *   • Non-members  → additionally a nudge that opens the DeepLife+ paywall (get
 *     the bigger 250/day drop).
 *
 * The reset boundary is the real UTC calendar day; the grant, day-stamp, and
 * claim-history live in the pure `claimDailyGems` reducer, so this component
 * only wires up state, save, and haptics.
 *
 * Theme: solid-gold surfaces stay theme-independent (INK text reads anywhere);
 * the translucent-gold surfaces get a darker-amber light-mode variant so they
 * stay legible on a light identity card. Hosts with a permanently-dark
 * background pass `onDarkSurface` to keep the dark styling in light mode.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, Easing } from 'react-native';
import { Gem, Crown, ChevronRight, Check, X, Sparkles } from 'lucide-react-native';
import { useGameSelector, shallowEqual, useSetGameState } from '@/contexts/game/useGameSelector';
import { useGameActions } from '@/contexts/game/GameActionsContext';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { useDeepLifePlusUpsell } from '@/hooks/useDeepLifePlusUpsell';
import SubscriptionModal from '@/components/SubscriptionModal';
import { haptic } from '@/utils/haptics';
import { scale, fontScale } from '@/utils/scaling';
import {
  DEEP_LIFE_PLUS_DAILY_GEMS,
  DAILY_GEMS_BASE,
  dailyGemMemberMultiple,
  dailyGemExtraPerYear,
  utcDayKey,
  buildDeepLifePlusWeekStatus,
  isPerfectDeepLifePlusWeek,
  type WeekDayCell,
} from '@/lib/subscription/deepLifePlus';
import { claimDailyGems } from '@/contexts/game/actions/SubscriptionActions';

// Gold palette. The SOLID-gold surfaces (the claim button, the "perfect week"
// chip) carry INK text and read on ANY background, so they stay theme-independent
// on purpose — the premium look the paywall uses. The TRANSLUCENT-gold surfaces
// (the "claimed" chip, the upsell teaser, the strip's empty-day rings) are soft
// gold on a faint tint; those wash out on a LIGHT identity card, so they get a
// darker-amber light-mode variant (below) selected when the app is in light mode
// AND the component isn't on a permanently-dark surface (the gem-shop sheet).
// No LinearGradient: the app's is a flat fallback (expo-linear-gradient crashes
// on New Arch) — it would render the same solid colour, so it adds nothing here.
const GOLD = '#FACC15';
const GOLD_SOFT = '#FDE68A';
const INK = '#1A1206';
const GREEN = '#22C55E';
const RED = '#EF4444';
// Light-mode amber (readable on a light card): amber-800 text, amber-700 accents.
const AMBER_DEEP = '#92400E';
const AMBER_BRAND = '#B45309';

/**
 * One weekday dot. When `pop` is true (the day just claimed this session), the
 * dot springs in from a smaller scale and the check fades up — a clean, one-shot
 * "stamp" animation. Otherwise it renders static (no motion on card open).
 */
function DayDot({
  cell,
  dotStyle,
  pop,
  reducedMotion,
}: {
  cell: WeekDayCell;
  dotStyle: Record<WeekDayCell['status'], object>;
  pop: boolean;
  reducedMotion: boolean;
}) {
  const scaleV = useRef(new Animated.Value(1)).current;
  const iconV = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!pop || reducedMotion) return;
    scaleV.setValue(0.35);
    iconV.setValue(0);
    Animated.parallel([
      // Spring the ring in with a soft overshoot.
      Animated.spring(scaleV, { toValue: 1, friction: 5, tension: 170, useNativeDriver: true }),
      // Fade/scale the check in just behind the ring.
      Animated.timing(iconV, { toValue: 1, duration: 180, delay: 60, easing: Easing.out(Easing.quad), useNativeDriver: true }),
    ]).start();
  }, [pop, reducedMotion, scaleV, iconV]);

  return (
    <Animated.View style={[styles.dot, dotStyle[cell.status], { transform: [{ scale: scaleV }] }]}>
      {cell.status === 'claimed' ? (
        <Animated.View style={{ opacity: iconV, transform: [{ scale: iconV }] }}>
          <Check size={scale(12)} color={INK} strokeWidth={3} />
        </Animated.View>
      ) : cell.status === 'missed' ? (
        <X size={scale(11)} color="#FFFFFF" strokeWidth={3} />
      ) : null}
    </Animated.View>
  );
}

/** Mon→Sun streak strip: green check for claimed days, red cross for missed. */
function WeekStrip({
  cells,
  light,
  justClaimedKey,
  reducedMotion,
}: {
  cells: WeekDayCell[];
  light: boolean;
  justClaimedKey: string | null;
  reducedMotion: boolean;
}) {
  const dotStyle = light ? DOT_STYLE_LIGHT : DOT_STYLE;
  return (
    <View style={styles.strip} accessibilityLabel="Daily gem claim streak this week">
      {cells.map((c, i) => (
        <View key={`${c.key}-${i}`} style={styles.stripCell}>
          <Text style={styles.stripLabel}>{c.label}</Text>
          <DayDot
            cell={c}
            dotStyle={dotStyle}
            pop={c.status === 'claimed' && c.key === justClaimedKey}
            reducedMotion={reducedMotion}
          />
        </View>
      ))}
    </View>
  );
}

/**
 * @param onDarkSurface Force the dark styling regardless of the app theme — set
 * by hosts whose background is always dark (the gem-shop sheet). Left unset on
 * the identity card, which follows `settings.darkMode`.
 */
export default function DailyGemClaim({ onDarkSurface = false }: { onDarkSurface?: boolean }) {
  const setGameState = useSetGameState();
  const { saveGame } = useGameActions();
  const reducedMotion = useReducedMotion();
  const { active, open, present, close } = useDeepLifePlusUpsell('daily_gems');
  const lastClaim = useGameSelector((s) => s.settings?.deepLifePlusLastGemClaim, shallowEqual);
  const claimDays = useGameSelector((s) => s.settings?.deepLifePlusGemClaimDays, shallowEqual);
  const darkMode = useGameSelector((s) => s.settings?.darkMode);
  // Use the light-mode variants only when the app is explicitly in light mode and
  // this instance isn't pinned to a dark surface. (darkMode defaults to true.)
  const light = !onDarkSurface && darkMode === false;

  const todayKey = utcDayKey(new Date());
  const claimedToday = lastClaim === todayKey;
  const week = buildDeepLifePlusWeekStatus(claimDays, new Date());
  // Everyone gets a daily drop; the amount is tiered (members 250, free 20).
  const amount = active ? DEEP_LIFE_PLUS_DAILY_GEMS : DAILY_GEMS_BASE;
  // A completed Mon→Sun week pays a bonus daily drop (see claimDailyGems). When
  // today's claim closed out the week, celebrate it.
  const perfectWeek = claimedToday && isPerfectDeepLifePlusWeek(claimDays, new Date());

  // The day claimed in THIS session — drives the one-shot pop on the streak dot
  // and the claimed-chip entrance (so neither animates on a normal card open).
  const [justClaimedKey, setJustClaimedKey] = useState<string | null>(null);

  // Button press feedback: a subtle spring scale-down while held.
  const pressV = useRef(new Animated.Value(1)).current;
  const onPressIn = useCallback(() => {
    if (reducedMotion) return;
    Animated.spring(pressV, { toValue: 0.96, speed: 40, bounciness: 0, useNativeDriver: true }).start();
  }, [pressV, reducedMotion]);
  const onPressOut = useCallback(() => {
    if (reducedMotion) return;
    Animated.spring(pressV, { toValue: 1, speed: 30, bounciness: 8, useNativeDriver: true }).start();
  }, [pressV, reducedMotion]);

  // Claimed-chip entrance (fade + soft scale-up), played once when a claim lands.
  const chipV = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!justClaimedKey) return;
    if (reducedMotion) {
      chipV.setValue(1);
      return;
    }
    chipV.setValue(0);
    Animated.spring(chipV, { toValue: 1, friction: 6, tension: 150, useNativeDriver: true }).start();
  }, [justClaimedKey, reducedMotion, chipV]);
  const chipScale = chipV.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] });

  const onClaim = useCallback(() => {
    // Re-read "today" at claim time so a session open across midnight still
    // stamps the correct day.
    const key = utcDayKey(new Date());
    haptic.success();
    setGameState((prev) => claimDailyGems(prev, key));
    void saveGame?.(false);
    setJustClaimedKey(key);
  }, [setGameState, saveGame]);

  return (
    <View style={styles.wrap}>
      <WeekStrip cells={week} light={light} justClaimedKey={justClaimedKey} reducedMotion={reducedMotion} />

      {claimedToday && perfectWeek ? (
        <Animated.View
          style={[styles.claim, styles.claimPerfect, { opacity: chipV, transform: [{ scale: chipScale }] }]}
          accessibilityRole="text"
        >
          <Sparkles size={fontScale(15)} color={INK} />
          <Text style={styles.claimPerfectText}>Perfect week! Bonus gems claimed 🎉</Text>
        </Animated.View>
      ) : claimedToday ? (
        <Animated.View
          style={[
            styles.claim,
            styles.claimDone,
            light && styles.claimDoneLight,
            { opacity: chipV, transform: [{ scale: chipScale }] },
          ]}
          accessibilityRole="text"
        >
          <Check size={fontScale(15)} color={light ? AMBER_DEEP : GOLD_SOFT} />
          <Text style={[styles.claimDoneText, light && styles.claimDoneTextLight]}>
            Daily gems claimed · back tomorrow
          </Text>
        </Animated.View>
      ) : (
        <Animated.View style={{ transform: [{ scale: pressV }] }}>
          <TouchableOpacity
            onPress={onClaim}
            onPressIn={onPressIn}
            onPressOut={onPressOut}
            activeOpacity={0.9}
            accessibilityRole="button"
            accessibilityLabel={`Claim your ${amount} daily gems`}
            style={styles.claim}
          >
            <View style={styles.iconWrap}>
              <Gem size={scale(16)} color={INK} fill={INK} />
            </View>
            <Text style={styles.claimText}>
              Claim your <Text style={styles.claimAmount}>{amount}</Text> daily gems
            </Text>
            <ChevronRight size={fontScale(16)} color={INK} />
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* Non-members: sell the gap — 20/day vs the 250/day member drop. */}
      {!active ? (
        <>
          <TouchableOpacity
            onPress={present}
            activeOpacity={0.9}
            accessibilityRole="button"
            accessibilityLabel={`Upgrade to DeepLife Plus for ${DEEP_LIFE_PLUS_DAILY_GEMS} gems a day, ${dailyGemMemberMultiple()} times more than your ${DAILY_GEMS_BASE} a day`}
            style={[styles.teaser, light && styles.teaserLight]}
          >
            <View style={[styles.iconWrapMuted, light && styles.iconWrapMutedLight]}>
              <Crown size={scale(16)} color={light ? AMBER_BRAND : GOLD} fill={light ? AMBER_BRAND : GOLD} />
            </View>
            <View style={styles.teaserCopy}>
              <Text style={[styles.teaserText, light && styles.teaserTextLight]}>
                Unlock <Text style={[styles.teaserBrand, light && styles.teaserBrandLight]}>{DEEP_LIFE_PLUS_DAILY_GEMS}</Text> gems a day
                {' '}with <Text style={[styles.teaserBrand, light && styles.teaserBrandLight]}>DeepLife+</Text>
              </Text>
              <Text style={[styles.teaserSub, light && styles.teaserSubLight]}>
                {dailyGemMemberMultiple()}× your {DAILY_GEMS_BASE}/day ·{' '}
                {dailyGemExtraPerYear().toLocaleString()} more a year
              </Text>
            </View>
            <ChevronRight size={fontScale(16)} color={light ? AMBER_BRAND : GOLD_SOFT} />
          </TouchableOpacity>
          <SubscriptionModal visible={open} onClose={close} />
        </>
      ) : null}
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
  // Light-mode: darker amber tint + amber-800 text so it reads on a light card.
  claimDoneLight: { backgroundColor: 'rgba(180, 83, 9, 0.10)', borderColor: 'rgba(180, 83, 9, 0.35)' },
  claimDoneTextLight: { color: AMBER_DEEP },
  claimPerfect: { backgroundColor: GOLD_SOFT, justifyContent: 'center' },
  claimPerfectText: { color: INK, fontSize: fontScale(13), fontWeight: '900', letterSpacing: 0.1 },

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
  teaserCopy: { flex: 1, gap: scale(2) },
  teaserText: { color: GOLD_SOFT, fontSize: fontScale(12.5), fontWeight: '700' },
  teaserSub: { color: 'rgba(253, 230, 138, 0.72)', fontSize: fontScale(11), fontWeight: '700', letterSpacing: 0.2 },
  teaserBrand: { color: GOLD, fontWeight: '900' },
  // Light-mode teaser variants (darker amber for contrast on a light card).
  teaserLight: { backgroundColor: 'rgba(180, 83, 9, 0.10)', borderColor: 'rgba(180, 83, 9, 0.40)' },
  iconWrapMutedLight: { backgroundColor: 'rgba(180, 83, 9, 0.12)', borderColor: 'rgba(180, 83, 9, 0.35)' },
  teaserTextLight: { color: AMBER_DEEP },
  teaserSubLight: { color: 'rgba(146, 64, 14, 0.9)' },
  teaserBrandLight: { color: AMBER_BRAND },
});

// Per-status dot appearance for the streak strip (dark surface).
const DOT_STYLE: Record<WeekDayCell['status'], object> = {
  claimed: { backgroundColor: GREEN, borderColor: GREEN },
  missed: { backgroundColor: RED, borderColor: RED },
  today: { backgroundColor: 'rgba(250, 204, 21, 0.16)', borderColor: GOLD },
  future: { backgroundColor: 'transparent', borderColor: 'rgba(255,255,255,0.14)' },
  inactive: { backgroundColor: 'transparent', borderColor: 'rgba(255,255,255,0.07)' },
};

// Light-mode strip: the empty-day rings use dark translucent borders (the white
// ones above are invisible on a light card); claimed/missed/today keep their
// vivid fills, which read on any background.
const DOT_STYLE_LIGHT: Record<WeekDayCell['status'], object> = {
  claimed: { backgroundColor: GREEN, borderColor: GREEN },
  missed: { backgroundColor: RED, borderColor: RED },
  today: { backgroundColor: 'rgba(180, 83, 9, 0.14)', borderColor: AMBER_BRAND },
  future: { backgroundColor: 'transparent', borderColor: 'rgba(0,0,0,0.20)' },
  inactive: { backgroundColor: 'transparent', borderColor: 'rgba(0,0,0,0.10)' },
};
