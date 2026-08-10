/**
 * First-session coach — one action at a time, driven by what the life IS.
 *
 * ── What a new player used to meet ────────────────────────────────────────
 * Driven end to end against the shipped web build, a brand-new player's first
 * screen was a profile card (avatar, name, "Unemployed") and their first three
 * taps produced: health 100 → 93 → 86 → 80, happiness 100 → 90 → 79 → 69, and
 * money unchanged at $1,500. Nothing else. No income, no event, no reward, no
 * recap — the weekly summary sheet is gated on something "meaningful" having
 * happened, and for an unemployed week nothing does.
 *
 * So the core loop, as first presented, was "tap to watch numbers fall". The
 * one hint that would have fixed it — "You don't have a job! Visit Work tab" —
 * sat below the fold, and `FirstWeekGuide` never rendered at all.
 *
 * ── What this does instead ────────────────────────────────────────────────
 * Standard FTUE guidance is show-don't-tell: put the player in the core loop
 * and let them feel the fantasy before asking them to learn anything. So this
 * is not a tips list. It shows exactly ONE next action, derived from live game
 * state, and it walks the player through the first real loop:
 *
 *     no job  →  "Find your first job"      (opens the Work tab)
 *     hired   →  "Live a week and get paid" (points at the advance button)
 *     paid    →  "You earned $N this week"  (the payoff, then it retires)
 *
 * Deriving each step from state rather than from a step counter matters: the
 * coach can never ask for something already done, can never get out of sync
 * with the save, and needs no progress of its own to persist. A player who
 * finds the Work tab unaided simply sees the next step instead.
 *
 * ── Animation ─────────────────────────────────────────────────────────────
 * There is no Reanimated, Moti or Lottie in this project (there is a MotiStub,
 * so it was removed on purpose), and adding a native animation dependency
 * before a launch is not a trade worth making. Everything here is RN `Animated`
 * on opacity and transform ONLY, so `useNativeDriver` holds and the card cannot
 * stutter behind the JS work a week tick does on the same frame.
 *
 * Reduced motion is a hard branch to the end state — not a shorter duration.
 * A vestibular trigger is not fixed by making it faster.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Briefcase, ArrowRight, PartyPopper, CalendarCheck } from 'lucide-react-native';
import { useGameSelector, shallowEqual } from '@/contexts/game/useGameSelector';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { getThemeColors, accent } from '@/lib/config/theme';
import { scale, fontScale, responsiveSpacing } from '@/utils/scaling';
import { lazyAsyncStorage as AsyncStorage } from '@/utils/storageWrapper';
import { haptic } from '@/utils/haptics';
import { formatMoney } from '@/utils/moneyFormatting';

const COACH_DONE_KEY = '@deep_life_first_session_coach_done';
const COACH_BASELINE_KEY = '@deep_life_first_session_coach_baseline';

/**
 * How many weeks the coach stays available, counted FROM WHEN IT FIRST APPEARED
 * — not from `weeksLived`.
 *
 * ── The bug this constant caused, and the trap behind it ─────────────────
 * The first version compared `weeksLived > 8` directly. `weeksLived` is the
 * ABSOLUTE life counter (CLAUDE.md §4.2), and a character created at age 20
 * starts at **104**. So the cap was already exceeded before the first frame and
 * the coach retired without ever rendering — invisible in the running app while
 * every unit test passed, because the tests fed it the small numbers I assumed.
 *
 * `FirstWeekGuide` carries a comment saying precisely this ("`currentWeek` is
 * the absolute weeksLived, which is 0 for age-18 starts and 100+ for older
 * starts"). It was read during this work and not applied.
 *
 * Storing a baseline makes the window mean "eight weeks after we started
 * helping", which is what was intended and is correct for any starting age.
 */
const MAX_COACH_WEEKS = 8;

type CoachStep = 'find-work' | 'advance' | 'paid' | null;

export default function FirstSessionCoach() {
  const router = useRouter();
  const reduced = useReducedMotion();

  const currentJob = useGameSelector((s) => s?.currentJob, shallowEqual);
  const weeksLived = useGameSelector((s) => s?.weeksLived ?? 0);
  const incomeEarned = useGameSelector((s) => s?.weekResult?.incomeEarned ?? 0);
  const darkMode = useGameSelector((s) => s?.settings?.darkMode !== false);

  /**
   * Starts VISIBLE and is only ever hidden by an explicit stored 'true'.
   *
   * The first version started at `null` ("unknown") and rendered nothing until
   * storage answered. That is backwards, and it shipped broken: the coach was
   * invisible in the running app because any hitch in resolving the storage
   * promise left the state at `null` forever — and `null` meant hide. A gate
   * whose failure mode is "the new-player guidance never appears" is the wrong
   * way round, whatever the comment above it claims.
   *
   * Optimistic is safe here because the step logic below ALSO requires
   * `weeksLived <= MAX_COACH_WEEKS`, so a long-running save can never show this
   * regardless of what storage says. The only exposure is a brief card on a
   * save under eight weeks old whose flag has not loaded yet — a far better
   * failure than never guiding anyone.
   */
  const [dismissed, setDismissed] = useState(false);
  /** `weeksLived` when this coach first appeared. Null until read/written. */
  const [baseline, setBaseline] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem(COACH_DONE_KEY)
      .then((v) => { if (alive && v === 'true') setDismissed(true); })
      // A storage failure must not hide the one thing telling a new player what
      // to do, so this deliberately does NOT hide on error.
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  // Anchor the window on first sight rather than on the absolute clock.
  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem(COACH_BASELINE_KEY)
      .then((v) => {
        if (!alive) return;
        const stored = v === null ? NaN : Number(v);
        if (Number.isFinite(stored)) { setBaseline(stored); return; }
        setBaseline(weeksLived);
        AsyncStorage.setItem(COACH_BASELINE_KEY, String(weeksLived)).catch(() => {});
      })
      // Unreadable baseline → treat now as the start. Erring toward showing.
      .catch(() => { if (alive) setBaseline(weeksLived); });
    return () => { alive = false; };
    // Intentionally mount-only: the baseline is a one-time anchor, and
    // depending on `weeksLived` would re-anchor it every single week.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const step: CoachStep = useMemo(() => {
    if (dismissed) return null;
    // Counted from first sight, never from the absolute clock — see
    // MAX_COACH_WEEKS. A null baseline means "not anchored yet", which must not
    // hide the card.
    if (baseline !== null && weeksLived - baseline > MAX_COACH_WEEKS) return null;
    if (incomeEarned > 0) return 'paid';
    if (!currentJob) return 'find-work';
    return 'advance';
  }, [dismissed, baseline, weeksLived, incomeEarned, currentJob]);

  const retire = useCallback(() => {
    setDismissed(true);
    AsyncStorage.setItem(COACH_DONE_KEY, 'true').catch(() => {
      // Non-critical: it reappears next launch, which is far better than a
      // storage error blocking the UI.
    });
  }, []);

  // ── Entrance: slide up + fade, once per step ────────────────────────────
  const enter = useRef(new Animated.Value(reduced ? 1 : 0)).current;
  useEffect(() => {
    if (!step) return;
    if (reduced) { enter.setValue(1); return; }
    enter.setValue(0);
    const a = Animated.timing(enter, {
      toValue: 1,
      duration: 420,
      easing: Easing.bezier(0.16, 1, 0.3, 1),
      useNativeDriver: true,
    });
    a.start();
    return () => a.stop();
  }, [step, reduced, enter]);

  // ── Attention pulse on the call to action ───────────────────────────────
  // A slow 1.0 → 1.04 breath, not a bounce. The point is to be findable in
  // peripheral vision, not to demand a tap — a card that jumps reads as an ad.
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!step || step === 'paid' || reduced) { pulse.setValue(0); return; }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1100, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 1100, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [step, reduced, pulse]);

  const onAction = useCallback(() => {
    haptic.light();
    if (step === 'find-work') {
      router.push('/(tabs)/work');
      return;
    }
    if (step === 'paid') {
      haptic.success();
      retire();
    }
    // 'advance' has no action of its own — the advance button is the action,
    // and pointing at it is the whole job. Tapping the card just acknowledges.
    if (step === 'advance') retire();
  }, [step, router, retire]);

  if (!step) return null;

  const c = getThemeColors(darkMode);
  const translateY = enter.interpolate({ inputRange: [0, 1], outputRange: [26, 0] });
  const pulseScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.04] });

  const copy = {
    'find-work': {
      Icon: Briefcase,
      tone: accent.info,
      title: 'You need work',
      body: 'No job means no money coming in. Pick one up in the Work tab.',
      cta: 'Find a job',
    },
    advance: {
      Icon: CalendarCheck,
      tone: accent.success,
      title: 'Hired. Now live a week',
      body: 'Tap the green arrow up top. Your wage lands at the end of the week.',
      cta: 'Got it',
    },
    paid: {
      Icon: PartyPopper,
      tone: accent.gold,
      title: `You earned ${formatMoney(incomeEarned)}`,
      body: "That's the loop: work, live a week, get paid. The rest is yours.",
      cta: 'Start playing',
    },
  }[step];

  const { Icon, tone, title, body, cta } = copy;

  return (
    <Animated.View style={[styles.wrap, { opacity: enter, transform: [{ translateY }] }]}>
      <View style={[styles.card, { backgroundColor: c.surfaceElevated, borderColor: tone }]}>
        <View style={styles.row}>
          <View style={[styles.badge, { backgroundColor: tone + '22', borderColor: tone + '55' }]}>
            <Icon size={scale(18)} color={tone} />
          </View>
          <View style={styles.textCol}>
            <Text style={[styles.title, { color: c.text }]}>{title}</Text>
            <Text style={[styles.body, { color: c.textSecondary }]}>{body}</Text>
          </View>
        </View>

        <Animated.View style={{ transform: [{ scale: pulseScale }] }}>
          <TouchableOpacity
            onPress={onAction}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={cta}
            style={[styles.cta, { backgroundColor: tone }]}
          >
            <Text style={styles.ctaText}>{cta}</Text>
            <ArrowRight size={scale(16)} color="#FFFFFF" />
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // In-flow, not absolute. Pinned to `bottom: 0` it rendered behind the tab
  // bar and was invisible to the player it exists for — found by screenshot,
  // not by reasoning about the layout.
  wrap: {
    marginBottom: responsiveSpacing.md,
  },
  card: {
    borderRadius: scale(16),
    borderWidth: 1,
    padding: responsiveSpacing.md,
    gap: scale(12),
    // Lifts it off the screen behind without a coloured stripe (Hard Rule #7).
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: scale(18),
    shadowOffset: { width: 0, height: scale(8) },
    elevation: 8,
  },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: scale(12) },
  badge: {
    width: scale(38),
    height: scale(38),
    borderRadius: scale(19),
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textCol: { flex: 1, gap: scale(3) },
  title: { fontSize: fontScale(15), fontWeight: '700' },
  body: { fontSize: fontScale(13), lineHeight: fontScale(18) },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: scale(8),
    paddingVertical: scale(11),
    borderRadius: scale(12),
  },
  ctaText: { color: '#FFFFFF', fontSize: fontScale(15), fontWeight: '700' },
});
