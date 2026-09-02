/**
 * Settings → Cloud backup → "Move to a new phone" / "I have a code".
 *
 * The account-free answer to "I got a new phone". A code is minted on the OLD
 * device and typed into the NEW one, which copies the saves across.
 *
 * A code is a BEARER CREDENTIAL - whoever reads it gets the save - so the copy
 * on screen says so plainly, and the server gives it 15 minutes and one use.
 * The code is rendered `selectable` rather than behind a copy button on
 * purpose: a clipboard button would mean another native dependency, and this
 * string is short enough to read across the room, which is the actual use case.
 *
 * Claiming COPIES rather than moves: the old phone keeps working and the two
 * diverge from that point. This is a backup transfer, not a live sync, and the
 * copy here says that too - a player who expects continuous mirroring would
 * otherwise discover the truth only after playing on both.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, Modal, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { claimTransferCode, mintTransferCode } from '@/lib/progress/cloud';
import { resolveDeviceId } from '@/utils/deviceIdentity';
import { fontScale, responsiveBorderRadius, responsiveSpacing, scale, verticalScale } from '@/utils/scaling';
import { hitSlopToMinTarget } from '@/utils/touchTargets';

export type TransferMode = 'show' | 'enter';

const CODE_LENGTH = 10;

interface Props {
  visible: boolean;
  mode: TransferMode;
  onClose: () => void;
  /** Fired after a successful claim so the caller can refresh its status line. */
  onClaimed?: (slots: number) => void;
}

export default function CloudTransferModal({ visible, mode, onClose, onClaimed }: Props) {
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState('');
  const [entered, setEntered] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  // Reset on every open: a code left on screen from a previous visit has very
  // likely expired, and showing a stale one is worse than showing none.
  useEffect(() => {
    if (!visible) return;
    setCode('');
    setEntered('');
    setMessage(null);
  }, [visible, mode]);

  const handleMint = useCallback(async () => {
    setBusy(true);
    setMessage(null);
    try {
      const userId = await resolveDeviceId();
      if (!userId) {
        setMessage('This device has no backup identity yet. Back up once, then try again.');
        return;
      }
      const result = await mintTransferCode(userId);
      if (result.success && result.code) setCode(result.code);
      else setMessage(result.error ?? 'Could not create a code.');
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    if (visible && mode === 'show' && !code && !busy && !message) void handleMint();
  }, [visible, mode, code, busy, message, handleMint]);

  const handleClaim = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    setMessage(null);
    try {
      const userId = await resolveDeviceId();
      if (!userId) {
        setMessage('This device has no backup identity yet.');
        return;
      }
      const result = await claimTransferCode(userId, entered);
      if (!result.success) {
        setMessage(result.error ?? 'Could not use that code.');
        return;
      }
      const slots = result.slots ?? 0;
      // 0 is a legitimate success: a code minted by a device that had not
      // backed up yet. Saying "restored 0 slots" would read as a failure, so
      // it gets its own sentence.
      setMessage(
        slots === 0
          ? 'That code worked, but the other device had no backup to copy.'
          : `Copied ${slots} save${slots === 1 ? '' : 's'}. Use "Restore from cloud" to load one.`
      );
      onClaimed?.(slots);
    } finally {
      setBusy(false);
    }
  }, [busy, entered, onClaimed]);

  const showing = mode === 'show';

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>{showing ? 'Move to a new phone' : 'Enter a transfer code'}</Text>

          {showing ? (
            <>
              <Text style={styles.body}>
                On your new phone, open Settings → Cloud backup → &quot;I have a code&quot; and type this in.
              </Text>
              {busy && !code ? (
                <ActivityIndicator color="#38BDF8" style={styles.spinner} />
              ) : code ? (
                <>
                  <Text selectable style={styles.code}>{code}</Text>
                  <Text style={styles.warning}>
                    Valid for 15 minutes, once. Anyone who has this code can copy your save - don&apos;t post it anywhere.
                  </Text>
                </>
              ) : null}
            </>
          ) : (
            <>
              <Text style={styles.body}>
                Type the code from your old phone. This copies its saves onto this device; the old phone keeps its own.
              </Text>
              <TextInput
                value={entered}
                onChangeText={(t) => setEntered(t.toUpperCase())}
                autoCapitalize="characters"
                autoCorrect={false}
                maxLength={CODE_LENGTH}
                placeholder="XXXXXXXXXX"
                placeholderTextColor="#475569"
                style={styles.input}
                accessibilityLabel="Transfer code from your old device"
              />
              <TouchableOpacity
                accessibilityRole="button"
                disabled={busy || entered.length !== CODE_LENGTH}
                onPress={() => void handleClaim()}
                style={[
                  styles.primary,
                  (busy || entered.length !== CODE_LENGTH) && styles.primaryDisabled,
                ]}
              >
                <Text style={styles.primaryText}>{busy ? 'Checking…' : 'Use this code'}</Text>
              </TouchableOpacity>
            </>
          )}

          {message ? <Text style={styles.message}>{message}</Text> : null}

          <TouchableOpacity
            accessibilityRole="button"
            onPress={onClose}
            style={styles.close}
            hitSlop={hitSlopToMinTarget(scale(30))}
          >
            <Text style={styles.closeText}>Done</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// Full four-sided borders only, never a one-sided accent stripe (Hard Rule #7).
const styles = StyleSheet.create({
  backdrop: {
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    flex: 1,
    justifyContent: 'center',
    padding: responsiveSpacing.lg,
  },
  card: {
    backgroundColor: '#0F172A',
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: responsiveBorderRadius.lg,
    borderWidth: 1,
    gap: verticalScale(8),
    padding: responsiveSpacing.lg,
    width: '100%',
  },
  title: { color: '#F8FAFC', fontSize: fontScale(16), fontWeight: '700' },
  body: { color: '#94A3B8', fontSize: fontScale(12) },
  spinner: { marginVertical: verticalScale(12) },
  code: {
    color: '#38BDF8',
    fontSize: fontScale(26),
    fontWeight: '800',
    letterSpacing: scale(3),
    marginVertical: verticalScale(8),
    textAlign: 'center',
  },
  warning: { color: '#FBBF24', fontSize: fontScale(11) },
  input: {
    backgroundColor: 'rgba(15, 23, 42, 0.9)',
    borderColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: responsiveBorderRadius.md,
    borderWidth: 1,
    color: '#F8FAFC',
    fontSize: fontScale(20),
    fontWeight: '700',
    letterSpacing: scale(2),
    marginTop: verticalScale(6),
    paddingHorizontal: responsiveSpacing.md,
    paddingVertical: verticalScale(10),
    textAlign: 'center',
  },
  primary: {
    alignItems: 'center',
    backgroundColor: '#0284C7',
    borderRadius: responsiveBorderRadius.md,
    marginTop: verticalScale(8),
    paddingVertical: verticalScale(10),
  },
  primaryDisabled: { opacity: 0.5 },
  primaryText: { color: '#F8FAFC', fontSize: fontScale(13), fontWeight: '700' },
  message: { color: '#CBD5F5', fontSize: fontScale(12), marginTop: verticalScale(4) },
  close: { alignItems: 'center', marginTop: verticalScale(8), paddingVertical: verticalScale(6) },
  closeText: { color: '#94A3B8', fontSize: fontScale(12), fontWeight: '700' },
});
