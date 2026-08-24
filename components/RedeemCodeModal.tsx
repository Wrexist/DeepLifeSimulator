import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  StyleSheet,
  Keyboard,
  ActivityIndicator,
  Animated,
  Easing,
} from 'react-native';
import { Gift, X, CheckCircle, AlertCircle } from 'lucide-react-native';
import ConfettiBurst from '@/components/ui/ConfettiBurst';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { haptic } from '@/utils/haptics';
import { playSound } from '@/utils/soundManager';
import { formatMoney } from '@/utils/moneyFormatting';
import { beginCelebration, endCelebration } from '@/utils/celebrationGate';
// Leaf contexts, not the @/contexts/GameContext barrel (avoids the production
// require-cycle) - same import shape SettingsModal's existing flows use.
import { useGameState } from '@/contexts/game/GameStateContext';
import { useGameActions } from '@/contexts/game/GameActionsContext';
import { logger } from '@/utils/logger';
import {
  normalizeRedeemCode,
  lookupRedeemCode,
  isCodeRedeemedOnDevice,
  beginRedeemClaim,
  finalizeRedeemClaim,
  applyRedeemReward,
  persistRedeemedPerkEntitlements,
  rewardLabel,
  canAttemptRedeem,
  recordRedeemAttempt,
} from '@/utils/redeemCodes';
import type { RedeemReward } from '@/utils/redeemCodes';

/** Cool blues + a mint accent - the sheet's own palette, not the promotion gold. */
const REDEEM_CONFETTI = ['#60A5FA', '#BFDBFE', '#34D399', '#A78BFA', '#F0F4FF'];

const COUNT_UP_MS = 900;

/**
 * Hard Rule #2 - read the union through an `in` guard, never a cast.
 * `RedeemReward` is `{ p: string } | { m: number }`; only the cash arm has an
 * amount worth counting up to.
 */
function hasCashAmount(reward: RedeemReward): reward is { m: number } {
  return 'm' in reward && typeof reward.m === 'number' && Number.isFinite(reward.m);
}

interface RedeemCodeModalProps {
  visible: boolean;
  onClose: () => void;
}

type RedeemStatus =
  | 'idle'
  | 'invalid'
  | 'already'
  | 'throttled'
  | 'error'
  | 'submitting'
  | 'success';

/** Group valid chars into DEEP-XXXX-XXXX-XXXX as the user types (16 core max). */
function formatCodeInput(raw: string): string {
  const core = raw.toUpperCase().replace(/[^A-Z2-9]/g, '').slice(0, 16);
  const groups: string[] = [];
  for (let i = 0; i < core.length; i += 4) {
    groups.push(core.slice(i, i + 4));
  }
  return groups.join('-');
}

const STATUS_MESSAGE: Record<Exclude<RedeemStatus, 'idle' | 'submitting' | 'success'>, string> = {
  invalid: "We don't recognize that code. Check it and try again.",
  already: 'This code has already been redeemed on this device.',
  throttled: 'Too many attempts - wait a minute and try again.',
  error: "Couldn't save your claim. Please try again in a moment.",
};

/**
 * Cash rewards count UP to their value rather than appearing at it.
 *
 * The promotion celebration already established why: the number is the thing
 * the player actually cares about, and watching it climb reads as an event
 * where reading it reads as a receipt. Ticking haptics ride the climb.
 *
 * Product rewards (gem packs, permanent perks) have no number to count, so they
 * just spring in - `amount` is null and the label renders as-is.
 */
function RewardValue({
  amount,
  label,
  animate,
}: {
  amount: number | null;
  label: string;
  animate: boolean;
}) {
  const [shown, setShown] = useState(() => (animate && amount != null ? 0 : amount));

  useEffect(() => {
    if (amount == null || !animate) {
      setShown(amount);
      return;
    }
    const started = Date.now();
    let raf: ReturnType<typeof setInterval> | null = null;
    let lastTick = 0;

    raf = setInterval(() => {
      const t = Math.min(1, (Date.now() - started) / COUNT_UP_MS);
      // Ease-out so it decelerates into the final number instead of stopping dead.
      const eased = 1 - Math.pow(1 - t, 3);
      setShown(Math.round(amount * eased));
      // A tick every ~8 frames - enough to feel the climb, not enough to buzz.
      const tick = Math.floor(t * 8);
      if (tick !== lastTick) {
        lastTick = tick;
        haptic.selection();
      }
      if (t >= 1 && raf) {
        clearInterval(raf);
        raf = null;
        setShown(amount);
      }
    }, 32);

    return () => {
      if (raf) clearInterval(raf);
    };
  }, [amount, animate]);

  return (
    <Text style={styles.rewardPillText}>
      {amount == null ? label : formatMoney(shown ?? amount)}
    </Text>
  );
}

/**
 * "Redeem Code" sheet. Rendered NESTED inside SettingsModal's already-presented
 * Modal tree (mirrors the DevToolsModal nesting) - never a sibling root-level
 * Modal, which would trip the iOS stacked-modal hazard.
 *
 * Success path order is load-bearing (repo convention): begin → one setGameState
 * grant → entitlement persistence → macrotask yield → saveGame(true) → finalize
 * ONLY when the force-save confirms durable success. Otherwise the marker stays
 * pending and the home reconciler completes the grant next launch.
 */
function RedeemCodeModal({ visible, onClose }: RedeemCodeModalProps) {
  const { gameState, setGameState } = useGameState();
  const { saveGame } = useGameActions();

  const [value, setValue] = useState('');
  const [status, setStatus] = useState<RedeemStatus>('idle');
  const [successLabel, setSuccessLabel] = useState('');
  const [successAmount, setSuccessAmount] = useState<number | null>(null);

  const reducedMotion = useReducedMotion();
  const celebrating = status === 'success';
  const animate = celebrating && !reducedMotion;

  // ── The staged reveal ────────────────────────────────────────────────────
  // Beats rather than all-at-once: a reveal that lands in stages reads as an
  // event, everything-at-once reads as a dialog. Same reasoning (and the same
  // vocabulary) as the promotion celebration.
  //
  //   0ms    badge springs in, ring blooms, confetti falls, success haptic
  //   180ms  "Reward unlocked!" rises
  //   340ms  the reward springs in and starts counting
  //   620ms  Done fades up - deliberately last, so the moment is not
  //          immediately dismissible before it has played
  //
  // With Reduce Motion on, all four land at their end state instantly and no
  // confetti mounts at all.
  const badge = useRef(new Animated.Value(0)).current;
  const headline = useRef(new Animated.Value(0)).current;
  const rewardAnim = useRef(new Animated.Value(0)).current;
  const done = useRef(new Animated.Value(0)).current;

  const runReveal = useCallback(() => {
    const stages: [Animated.Value, number][] = [
      [badge, 0], [headline, 180], [rewardAnim, 340], [done, 620],
    ];
    if (reducedMotion) {
      for (const [v] of stages) v.setValue(1);
      return;
    }
    for (const [v] of stages) v.setValue(0);
    Animated.parallel(
      stages.map(([v, delay], i) =>
        i === 0
          ? Animated.spring(v, { toValue: 1, friction: 5, tension: 160, useNativeDriver: true })
          : Animated.timing(v, {
              toValue: 1,
              duration: 260,
              delay,
              easing: Easing.out(Easing.cubic),
              useNativeDriver: true,
            }),
      ),
    ).start();
  }, [badge, headline, rewardAnim, done, reducedMotion]);

  // Fresh slate each time the sheet opens.
  useEffect(() => {
    if (visible) {
      setValue('');
      setStatus('idle');
      setSuccessLabel('');
      setSuccessAmount(null);
    }
  }, [visible]);

  // Fire the celebration when the success state arrives, and hold the
  // celebration gate while it is up so the review prompt waits its turn.
  useEffect(() => {
    if (!celebrating) return;
    beginCelebration();
    haptic.success();
    playSound('success');
    runReveal();
    return () => endCelebration();
  }, [celebrating, runReveal]);

  const normalized = normalizeRedeemCode(value);
  const shapeComplete = normalized.length === 16 && normalized.startsWith('DEEP');
  const isSubmitting = status === 'submitting';
  const canSubmit = shapeComplete && !isSubmitting;

  const handleChange = (text: string) => {
    setValue(formatCodeInput(text));
    // Clear any prior error the moment the player edits the field.
    if (status !== 'idle' && status !== 'submitting') setStatus('idle');
  };

  const handleRedeem = async () => {
    if (isSubmitting || !shapeComplete) return;
    Keyboard.dismiss();

    if (!canAttemptRedeem()) {
      setStatus('throttled');
      return;
    }
    recordRedeemAttempt();

    const match = lookupRedeemCode(value);
    if (!match) {
      setStatus('invalid');
      return;
    }
    const { hash, reward } = match;

    // Already redeemed? Device ledger OR the in-state flag.
    const inState =
      Array.isArray(gameState.redeemedCodeHashes) && gameState.redeemedCodeHashes.includes(hash);
    if (inState || (await isCodeRedeemedOnDevice(hash))) {
      setStatus('already');
      return;
    }

    setStatus('submitting');
    // (a) durably record the pending marker BEFORE granting anything.
    const begun = await beginRedeemClaim(hash, reward);
    if (!begun) {
      setStatus('error');
      return;
    }
    // (b) ONE state update grants the reward AND flags the hash atomically.
    setGameState((prev) => applyRedeemReward(prev, hash, reward));
    // (b2) the same cross-slot entitlement persistence a real purchase performs
    //      (permanent perks survive new lives / other slots). Idempotent -
    //      finalization below is gated on this succeeding too, so a transient
    //      failure keeps the claim pending and the launch reconciler retries.
    const entitlementsOk = await persistRedeemedPerkEntitlements(reward);
    // (c) macrotask yield - saveGame reads a post-commit ref synced in a passive
    //     effect, so it lags the commit by one cycle.
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    // (d) persist DURABLY: force-save (the same path real IAP purchases use).
    //     saveGame resolves true only after the write is verified on disk - a
    //     plain saveGame() merely queues and swallows failures, which would let
    //     us finalize a claim whose reward was never persisted.
    let saved = false;
    try {
      saved = await saveGame(true);
    } catch (err) {
      logger.warn('Redeem claim save threw; leaving pending for reconcile', { error: err });
    }
    if (saved && entitlementsOk) {
      // (e) finalize only when BOTH durability steps are confirmed: the
      //     force-save AND the cross-slot entitlement persistence.
      await finalizeRedeemClaim(hash);
    } else {
      // NOT finalized - the pending marker + the home reconciler complete the
      // claim on next launch (the designed recovery). The reward is already in
      // memory, so the player keeps playing with it either way.
      logger.warn('Redeem claim not fully durable; will reconcile next launch', {
        saved,
        entitlementsOk,
      });
    }
    setSuccessLabel(rewardLabel(reward));
    // Only a cash reward has a number to count up to; a product reward
    // (gem pack, permanent perk) shows its name.
    setSuccessAmount(hasCashAmount(reward) ? reward.m : null);
    setStatus('success');
  };

  const message =
    status === 'idle' || status === 'submitting' || status === 'success'
      ? null
      : STATUS_MESSAGE[status];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        {/* Confetti falls over the whole sheet, behind the card so it never
            covers the reward. Gated on Reduce Motion by `animate`. */}
        <ConfettiBurst play={animate} count={18} colors={REDEEM_CONFETTI} fallFraction={0.85} />
        <View style={styles.card}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.titleRow}>
              <View style={styles.iconChip}>
                <Gift size={18} color="#60A5FA" />
              </View>
              <Text style={styles.title}>Redeem Code</Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              style={styles.closeButton}
              accessibilityRole="button"
              accessibilityLabel="Close"
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <X size={18} color="#F9FAFB" />
            </TouchableOpacity>
          </View>

          {status === 'success' ? (
            <View style={styles.successBody}>
              <Animated.View
                style={[
                  styles.successIcon,
                  { opacity: badge, transform: [{ scale: badge }] },
                ]}
              >
                {/* Bloom ring - scales OUT past the badge and fades, so the
                    badge reads as landing rather than just appearing. */}
                <Animated.View
                  pointerEvents="none"
                  style={[
                    styles.successBloom,
                    {
                      opacity: badge.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0.9, 0.35, 0] }),
                      transform: [{ scale: badge.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1.7] }) }],
                    },
                  ]}
                />
                <CheckCircle size={40} color="#10B981" />
              </Animated.View>

              <Animated.Text
                style={[
                  styles.successTitle,
                  {
                    opacity: headline,
                    transform: [{ translateY: headline.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }],
                  },
                ]}
              >
                Reward unlocked!
              </Animated.Text>

              <Animated.View
                style={[
                  styles.rewardPill,
                  {
                    opacity: rewardAnim,
                    transform: [{ scale: rewardAnim.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }) }],
                  },
                ]}
              >
                <RewardValue amount={successAmount} label={successLabel} animate={animate} />
              </Animated.View>

              {/* Full width: `successBody` centres its children, and the button
                  carried no width of its own - so "Done" collapsed to a tiny
                  square around its label, while the same style rendered full
                  width in the input branch where the card stretches it. */}
              <Animated.View style={[styles.doneWrap, { opacity: done }]}>
                <TouchableOpacity
                  style={styles.primaryButton}
                  onPress={onClose}
                  accessibilityRole="button"
                  accessibilityLabel="Done"
                  testID="redeem-done"
                >
                  <Text style={styles.primaryButtonText}>Done</Text>
                </TouchableOpacity>
              </Animated.View>
            </View>
          ) : (
            <>
              <Text style={styles.subtitle}>
                Enter a promo code to claim your reward. Each code works once per device.
              </Text>

              <TextInput
                style={styles.input}
                value={value}
                onChangeText={handleChange}
                placeholder="DEEP-XXXX-XXXX-XXXX"
                placeholderTextColor="#64748B"
                autoCapitalize="characters"
                autoCorrect={false}
                autoComplete="off"
                spellCheck={false}
                maxLength={19}
                editable={!isSubmitting}
                accessibilityLabel="Redeem code"
                testID="redeem-code-input"
              />

              {message ? (
                <View style={styles.messageRow}>
                  <AlertCircle size={16} color="#F87171" />
                  <Text style={styles.messageText}>{message}</Text>
                </View>
              ) : null}

              <TouchableOpacity
                style={[styles.primaryButton, !canSubmit ? styles.primaryButtonDisabled : undefined]}
                onPress={handleRedeem}
                disabled={!canSubmit}
                accessibilityRole="button"
                accessibilityLabel="Redeem"
                accessibilityState={{ disabled: !canSubmit }}
                testID="redeem-submit"
              >
                {isSubmitting ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.primaryButtonText}>Redeem</Text>
                )}
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#1E293B',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconChip: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(96, 165, 250, 0.13)',
    borderWidth: 1,
    borderColor: 'rgba(96, 165, 250, 0.33)',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#F9FAFB',
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(148, 163, 184, 0.15)',
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    color: '#94A3B8',
    marginBottom: 16,
  },
  input: {
    borderWidth: 1,
    borderColor: '#3B82F6',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontSize: 18,
    letterSpacing: 2,
    textAlign: 'center',
    fontWeight: '700',
    backgroundColor: '#0F172A',
    color: '#F9FAFB',
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
  },
  messageText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    color: '#F87171',
  },
  primaryButton: {
    marginTop: 20,
    backgroundColor: '#3B82F6',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonDisabled: {
    opacity: 0.45,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 16,
    letterSpacing: 0.3,
  },
  successBody: {
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 4,
  },
  successIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.35)',
    marginBottom: 14,
  },
  successBloom: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 36,
    borderWidth: 2,
    borderColor: 'rgba(16, 185, 129, 0.55)',
  },
  successTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#F9FAFB',
    marginBottom: 14,
  },
  rewardPill: {
    backgroundColor: 'rgba(59, 130, 246, 0.16)',
    borderColor: 'rgba(96, 165, 250, 0.45)',
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 26,
  },
  rewardPillText: {
    color: '#DBEAFE',
    // The payoff line - it gets to be the biggest text in the sheet.
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: 0.5,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  // `successBody` centres its children, so the button needs its own width or it
  // shrinks to fit "Done". See the note at the call site.
  doneWrap: {
    alignSelf: 'stretch',
  },
});

export default React.memo(RedeemCodeModal);
