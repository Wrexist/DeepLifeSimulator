/**
 * Inline deposit / withdraw for an account detail page.
 *
 * Replaces a pair of buttons that each opened a separate modal. Moving money in
 * and out is the ONLY reason most players open an account, so making it the
 * thing already on screen — rather than two taps and a keyboard behind a CTA —
 * is the difference between the screen being a form and being a control.
 *
 * Anatomy, top to bottom:
 *   1. Direction segmented control (Deposit / Withdraw) — one panel, not two.
 *   2. The amount, large, with the source balance under it so the ceiling is
 *      always visible rather than discovered by hitting a rejection.
 *   3. A drag slider across the full available range.
 *   4. Percentage chips (10 / 25 / 50 / Max) for the amounts people actually
 *      pick, which are proportions rather than round numbers.
 *   5. One confirm button, tinted to the direction and disabled at zero.
 *
 * The slider is hand-rolled: the project has no slider dependency, and adding
 * one for a single control would pull a native module into a codebase whose
 * release builds are deliberately thin (CLAUDE.md §4.6).
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, PanResponder, LayoutChangeEvent } from 'react-native';
import { ArrowDownToLine, ArrowUpFromLine } from 'lucide-react-native';
import { responsiveFontSize, responsiveSpacing, responsiveBorderRadius, scale } from '@/utils/scaling';
import { getThemeColors, accent } from '@/lib/config/theme';
import { getGlassCard, getPlatformShadows } from '@/utils/glassmorphismStyles';
import { formatMoney } from '@/utils/moneyFormatting';

export type TransferDirection = 'deposit' | 'withdraw';

interface Props {
  /** Cash the player is holding — the ceiling for a deposit. */
  cashAvailable: number;
  /** The account's balance — the ceiling for a withdrawal. */
  accountBalance: number;
  /** Accent for the account type, so the panel matches its card. */
  tint: string;
  darkMode: boolean;
  /** Withdrawals are refused while a CD is locked; deposits still allowed. */
  withdrawDisabled?: boolean;
  withdrawDisabledReason?: string;
  onSubmit: (direction: TransferDirection, amount: number) => void;
}

/** Thumb diameter — needed by the geometry as well as the style. */
const THUMB = scale(22);

const PERCENTS = [0.1, 0.25, 0.5, 1] as const;
const percentLabel = (p: number) => (p === 1 ? 'Max' : `${Math.round(p * 100)}%`);

/** Round to a clean step so the slider never lands on $3,417.63. */
function niceStep(value: number, max: number): number {
  if (!isFinite(value) || value <= 0) return 0;
  if (value >= max) return Math.floor(max);
  const step = max >= 1_000_000 ? 1000 : max >= 100_000 ? 100 : max >= 10_000 ? 10 : 1;
  return Math.min(Math.floor(max), Math.round(value / step) * step);
}

export default function AccountTransferPanel({
  cashAvailable,
  accountBalance,
  tint,
  darkMode,
  withdrawDisabled = false,
  withdrawDisabledReason,
  onSubmit,
}: Props) {
  const theme = getThemeColors(darkMode);
  const [direction, setDirection] = useState<TransferDirection>('deposit');
  const [amount, setAmount] = useState(0);
  const [trackWidth, setTrackWidth] = useState(0);

  const safe = (n: number) => (typeof n === 'number' && isFinite(n) && n > 0 ? n : 0);
  const max = direction === 'deposit' ? safe(cashAvailable) : safe(accountBalance);

  // Refs, because the PanResponder is created once and would otherwise close
  // over the first render's values forever.
  //
  // Written in an EFFECT, not during render: React 19 may replay or discard a
  // render, and a mutation from a render that never commits would leak into the
  // PanResponder's closure. Gestures only happen after commit, so the values are
  // always current by the time they are read.
  const maxRef = useRef(max);
  const widthRef = useRef(trackWidth);
  useEffect(() => {
    maxRef.current = max;
    widthRef.current = trackWidth;
  }, [max, trackWidth]);

  /**
   * Map a touch x to an amount over the THUMB'S travel, not the raw track
   * width. The thumb is a fixed-size circle: if it travelled the full width it
   * would hang half off each end, and the value under the finger would drift
   * from the value under the thumb by half a thumb at both extremes.
   */
  const setFromX = useCallback((x: number) => {
    const w = widthRef.current;
    const travel = w - THUMB;
    if (travel <= 0) return;
    const ratio = Math.max(0, Math.min(1, (x - THUMB / 2) / travel));
    setAmount(niceStep(ratio * maxRef.current, maxRef.current));
  }, []);

  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (e) => setFromX(e.nativeEvent.locationX),
        onPanResponderMove: (e) => setFromX(e.nativeEvent.locationX),
      }),
    [setFromX],
  );

  // Both handlers go to child components (the track `View`, the segment
  // `TouchableOpacity`s), so a fresh identity per render is a wasted re-render
  // on every keystroke of the slider. State setters are stable, so both close
  // over nothing that changes and take an empty dependency list.
  const onTrackLayout = useCallback(
    (e: LayoutChangeEvent) => setTrackWidth(e.nativeEvent.layout.width),
    [],
  );

  const switchTo = useCallback((next: TransferDirection) => {
    setDirection(next);
    setAmount(0); // never carry an amount across a direction change
  }, []);

  const pct = max > 0 ? Math.max(0, Math.min(1, amount / max)) : 0;
  // Thumb travel is the track minus its own width, so it never overhangs.
  const thumbLeft = Math.max(0, pct * Math.max(0, trackWidth - THUMB));
  const isDeposit = direction === 'deposit';
  const blocked = !isDeposit && withdrawDisabled;
  const canSubmit = amount > 0 && amount <= max && !blocked;
  const sourceLabel = isDeposit
    ? `Cash on hand ${formatMoney(safe(cashAvailable))}`
    : `In this account ${formatMoney(safe(accountBalance))}`;

  return (
    <View
      style={[
        getGlassCard(darkMode, 8),
        styles.card,
        { backgroundColor: theme.surface, borderColor: theme.border, borderWidth: 1 },
      ]}
    >
      {/* 1 — direction */}
      <View style={[styles.segment, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
        {(['deposit', 'withdraw'] as const).map((d) => {
          const active = direction === d;
          const Icon = d === 'deposit' ? ArrowDownToLine : ArrowUpFromLine;
          return (
            <TouchableOpacity
              key={d}
              onPress={() => switchTo(d)}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              accessibilityLabel={d === 'deposit' ? 'Deposit money' : 'Withdraw money'}
              style={[
                styles.segmentBtn,
                active && { backgroundColor: `${tint}26`, borderColor: `${tint}59` },
                !active && { borderColor: 'transparent' },
              ]}
            >
              <Icon size={scale(14)} color={active ? tint : theme.textMuted} />
              <Text style={[styles.segmentText, { color: active ? tint : theme.textMuted }]}>
                {d === 'deposit' ? 'Deposit' : 'Withdraw'}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* 2 — amount + the ceiling it is measured against */}
      <View style={styles.readout}>
        <Text
          style={[styles.amount, { color: amount > 0 ? theme.text : theme.textMuted }]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.5}
          accessibilityLabel={`Amount ${formatMoney(amount)}`}
        >
          {formatMoney(amount)}
        </Text>
        <Text style={[styles.source, { color: theme.textSecondary }]} numberOfLines={1}>
          {sourceLabel}
        </Text>
      </View>

      {/* 3 — slider */}
      <View
        style={styles.trackHit}
        onLayout={onTrackLayout}
        {...pan.panHandlers}
        accessibilityRole="adjustable"
        accessibilityLabel={`${isDeposit ? 'Deposit' : 'Withdraw'} amount slider`}
        accessibilityValue={{ min: 0, max: Math.floor(max), now: Math.floor(amount) }}
        /**
         * `adjustable` PROMISES assistive tech an increment/decrement
         * affordance. Declaring the role without these handlers hands a
         * screen-reader user a control announced as adjustable that cannot be
         * adjusted — worse than announcing nothing, because it names an
         * interaction that does not exist.
         *
         * 10% per step, so ten actions traverse the range — the drag gesture's
         * precision is not reachable one step at a time and pretending otherwise
         * just makes the control tedious. Values run through the same `niceStep`
         * rounding the chips use, so a stepped amount reads as a clean figure
         * rather than $3,847.13, and the functional `setAmount` means a rapid
         * sequence of steps cannot read a stale amount from this closure.
         */
        accessibilityActions={[
          { name: 'increment', label: 'Increase amount' },
          { name: 'decrement', label: 'Decrease amount' },
        ]}
        onAccessibilityAction={(event) => {
          if (max <= 0) return;
          const step = Math.max(1, Math.round(max * 0.1)); // 10% steps
          if (event.nativeEvent.actionName === 'increment') {
            setAmount((prev) => niceStep(Math.min(max, prev + step), max));
          } else if (event.nativeEvent.actionName === 'decrement') {
            setAmount((prev) => niceStep(Math.max(0, prev - step), max));
          }
        }}
      >
        <View style={[styles.track, { backgroundColor: theme.surfaceElevated }]}>
          {/* Fill reaches the thumb's CENTRE, so the bar and the circle agree at
              both ends instead of the fill running out from under the thumb. */}
          <View
            style={[
              styles.fill,
              { width: thumbLeft + THUMB / 2, backgroundColor: tint },
            ]}
          />
        </View>
        <View
          pointerEvents="none"
          style={[
            styles.thumb,
            getPlatformShadows(4, 0.28, 2, 6),
            { left: thumbLeft, borderColor: tint, backgroundColor: theme.surface },
          ]}
        />
      </View>

      {/* 4 — proportions, which is how people actually decide */}
      <View style={styles.chipRow}>
        {PERCENTS.map((p) => {
          const value = niceStep(max * p, max);
          const disabled = max <= 0;
          return (
            <TouchableOpacity
              key={p}
              onPress={() => setAmount(value)}
              disabled={disabled}
              accessibilityRole="button"
              accessibilityLabel={`${percentLabel(p)} — ${formatMoney(value)}`}
              accessibilityState={{ disabled }}
              style={[
                styles.chip,
                { borderColor: theme.border, backgroundColor: theme.surfaceElevated },
                disabled && styles.chipDisabled,
              ]}
            >
              <Text style={[styles.chipText, { color: disabled ? theme.textMuted : theme.text }]}>
                {percentLabel(p)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* 5 — one confirm */}
      <TouchableOpacity
        onPress={() => {
          if (!canSubmit) return;
          onSubmit(direction, amount);
          setAmount(0);
        }}
        disabled={!canSubmit}
        accessibilityRole="button"
        accessibilityLabel={`${isDeposit ? 'Deposit' : 'Withdraw'} ${formatMoney(amount)}`}
        accessibilityState={{ disabled: !canSubmit }}
        style={[styles.cta, canSubmit ? getPlatformShadows(5, 0.3, 2, 8) : null]}
      >
        <View
          style={[
            styles.ctaInner,
            { backgroundColor: canSubmit ? tint : theme.surfaceElevated, borderColor: theme.border },
          ]}
        >
          <Text style={[styles.ctaText, { color: canSubmit ? '#FFFFFF' : theme.textMuted }]}>
            {blocked
              ? withdrawDisabledReason || 'Locked'
              : amount > 0
                ? `${isDeposit ? 'Deposit' : 'Withdraw'} ${formatMoney(amount)}`
                : `Choose an amount`}
          </Text>
        </View>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: responsiveBorderRadius['2xl'],
    padding: responsiveSpacing.md,
    gap: responsiveSpacing.md,
  },
  segment: {
    flexDirection: 'row',
    borderRadius: responsiveBorderRadius.lg,
    borderWidth: 1,
    padding: scale(3),
    gap: scale(3),
  },
  segmentBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: scale(6),
    paddingVertical: responsiveSpacing.sm,
    borderRadius: responsiveBorderRadius.md,
    borderWidth: 1,
  },
  segmentText: { fontSize: responsiveFontSize.sm, fontWeight: '700' },
  readout: { alignItems: 'center', gap: scale(2) },
  amount: { fontSize: responsiveFontSize['3xl'], fontWeight: '800', letterSpacing: -0.5 },
  source: { fontSize: responsiveFontSize.xs, fontWeight: '600' },
  // Generous vertical hit area around a thin visual track — the bar is 6px but
  // the finger target is not.
  trackHit: { height: scale(36), justifyContent: 'center' },
  track: { height: scale(6), borderRadius: scale(3), overflow: 'hidden' },
  fill: { height: '100%', borderRadius: scale(3) },
  thumb: {
    position: 'absolute',
    width: THUMB,
    height: THUMB,
    borderRadius: THUMB / 2,
    borderWidth: scale(3),
  },
  chipRow: { flexDirection: 'row', gap: scale(8) },
  chip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: responsiveSpacing.sm,
    borderRadius: responsiveBorderRadius.md,
    borderWidth: 1,
  },
  chipDisabled: { opacity: 0.45 },
  chipText: { fontSize: responsiveFontSize.sm, fontWeight: '700' },
  cta: { borderRadius: responsiveBorderRadius.lg, overflow: 'hidden' },
  ctaInner: {
    paddingVertical: responsiveSpacing.md,
    alignItems: 'center',
    borderRadius: responsiveBorderRadius.lg,
    borderWidth: 1,
  },
  ctaText: { fontSize: responsiveFontSize.base, fontWeight: '800' },
});
