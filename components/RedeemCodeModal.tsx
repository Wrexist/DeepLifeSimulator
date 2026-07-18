import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  StyleSheet,
  Keyboard,
  ActivityIndicator,
} from 'react-native';
import { Gift, X, CheckCircle, AlertCircle } from 'lucide-react-native';
// Leaf contexts, not the @/contexts/GameContext barrel (avoids the production
// require-cycle) — same import shape SettingsModal's existing flows use.
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
  throttled: 'Too many attempts — wait a minute and try again.',
  error: "Couldn't save your claim. Please try again in a moment.",
};

/**
 * "Redeem Code" sheet. Rendered NESTED inside SettingsModal's already-presented
 * Modal tree (mirrors the DevToolsModal nesting) — never a sibling root-level
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

  // Fresh slate each time the sheet opens.
  useEffect(() => {
    if (visible) {
      setValue('');
      setStatus('idle');
      setSuccessLabel('');
    }
  }, [visible]);

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
    //      (permanent perks survive new lives / other slots). Idempotent.
    await persistRedeemedPerkEntitlements(reward);
    // (c) macrotask yield — saveGame reads a post-commit ref synced in a passive
    //     effect, so it lags the commit by one cycle.
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    // (d) persist DURABLY: force-save (the same path real IAP purchases use).
    //     saveGame resolves true only after the write is verified on disk — a
    //     plain saveGame() merely queues and swallows failures, which would let
    //     us finalize a claim whose reward was never persisted.
    let saved = false;
    try {
      saved = await saveGame(true);
    } catch (err) {
      logger.warn('Redeem claim save threw; leaving pending for reconcile', { error: err });
    }
    if (saved) {
      // (e) finalize only on confirmed durable success.
      await finalizeRedeemClaim(hash);
    } else {
      // NOT finalized — the pending marker + the home reconciler complete the
      // grant on next launch (the designed recovery). The reward is already in
      // memory, so the player keeps playing with it either way.
      logger.warn('Redeem claim save not confirmed; will reconcile next launch');
    }
    setSuccessLabel(rewardLabel(reward));
    setStatus('success');
  };

  const message =
    status === 'idle' || status === 'submitting' || status === 'success'
      ? null
      : STATUS_MESSAGE[status];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
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
              <View style={styles.successIcon}>
                <CheckCircle size={40} color="#10B981" />
              </View>
              <Text style={styles.successTitle}>Reward unlocked!</Text>
              <View style={styles.rewardPill}>
                <Text style={styles.rewardPillText}>{successLabel}</Text>
              </View>
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={onClose}
                accessibilityRole="button"
                accessibilityLabel="Done"
                testID="redeem-done"
              >
                <Text style={styles.primaryButtonText}>Done</Text>
              </TouchableOpacity>
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
  successTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#F9FAFB',
    marginBottom: 12,
  },
  rewardPill: {
    backgroundColor: 'rgba(59, 130, 246, 0.16)',
    borderColor: 'rgba(96, 165, 250, 0.35)',
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 18,
  },
  rewardPillText: {
    color: '#BFDBFE',
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
});

export default React.memo(RedeemCodeModal);
