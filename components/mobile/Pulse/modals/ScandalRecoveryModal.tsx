/**
 * ScandalRecoveryModal - three response options for an active scandal.
 *
 * Dismiss-disabled until a choice is made. Severity meter color-shifts
 * green / amber / red. Three cards: Apologize / Stay silent / Clean slate (gems).
 * If the scandal is a deepfake or cancel type, a fourth Lawsuit option appears.
 */
import React, { useCallback } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AlertTriangle, MessageCircleOff, MessagesSquare, Gem, Scale } from 'lucide-react-native';
import BaseModal from '@/components/ui/BaseModal';
import ProgressBar from '@/components/ui/ProgressBar';
import { useGame } from '@/contexts/GameContext';
import { useTheme } from '@/hooks/useTheme';
import { scale, fontScale, responsiveSpacing } from '@/utils/scaling';
import { recoverFromScandal } from '@/contexts/game/actions/PulseActions';
import { PULSE_COLORS } from '../styles/pulseTheme';
import { pulseHaptics } from '../utils/pulseHaptics';
import type { PulseActiveScandal, PulseScandalResolution } from '@/contexts/game/types';

interface ScandalRecoveryModalProps {
  visible: boolean;
  scandal: PulseActiveScandal | null;
  onDismiss: () => void;
}

// Preview text describes what `recoverFromScandal` actually does in
// PulseActions.ts. Keep aligned if the action's profile constants change.
const OPTION_BLURBS: Record<
  PulseScandalResolution,
  { title: string; Icon: React.ComponentType<{ size: number; color: string }>; iconColor: string; preview: string }
> = {
  apology: {
    title: 'Apologize publicly',
    Icon: MessagesSquare,
    iconColor: '#3B82F6',
    preview: 'Severity drops 25/wk · small follower & reputation cost',
  },
  silence: {
    title: 'Stay silent',
    Icon: MessageCircleOff,
    iconColor: '#94A3B8',
    preview: 'No active recovery · weekly tick continues to chip away at severity',
  },
  gems: {
    title: 'Clean slate (500 gems)',
    Icon: Gem,
    iconColor: '#8B5CF6',
    preview: 'Instant scrub · scandal cleared, lifetime survivor count +1',
  },
  lawsuit: {
    title: 'Sue ($5,000)',
    Icon: Scale,
    iconColor: '#F59E0B',
    preview: 'Deepfake/cancel only · 70% wins clear it · loss leaves scandal active',
  },
};

export default function ScandalRecoveryModal({ visible, scandal, onDismiss }: ScandalRecoveryModalProps) {
  const { gameState, setGameState, saveGame } = useGame();
  const { theme } = useTheme();

  const handleChoice = useCallback(
    (method: PulseScandalResolution) => {
      const result = recoverFromScandal(setGameState, gameState, method);
      if (result.success) {
        pulseHaptics.success();
        // Persist the lawsuit fee / gem spend like every sibling mutation.
        setTimeout(() => { void saveGame?.(); }, 0);
        onDismiss();
      } else {
        pulseHaptics.error();
      }
    },
    [setGameState, gameState, saveGame, onDismiss],
  );

  if (!visible || !scandal) return null;

  const sev = scandal.severity;
  const severityColor =
    sev >= 70 ? PULSE_COLORS.danger : sev >= 40 ? PULSE_COLORS.warning : PULSE_COLORS.success;

  const options: PulseScandalResolution[] = ['apology', 'silence', 'gems'];
  if (scandal.type === 'deepfake' || scandal.type === 'cancel') {
    options.push('lawsuit');
  }

  return (
    // Dismiss-disabled (plan §2.3): `onClose` is a no-op and the close button is
    // hidden, so neither the Android back button nor a backdrop tap can escape
    // an active scandal - the player must pick a response.
    <BaseModal
      visible={visible}
      onClose={() => { /* dismiss-disabled - a response must be chosen */ }}
      hideCloseButton
      variant="bottom"
      title="A scandal is brewing"
      subtitle={scandal.headline}
      footer={
        <Text style={[styles.footnote, { color: theme.textMuted }]}>Choose a response to continue.</Text>
      }
    >
      <View style={styles.severityRow}>
        <View style={styles.severityLabelRow}>
          <AlertTriangle size={fontScale(16)} color={PULSE_COLORS.danger} />
          <Text style={[styles.severityLabel, { color: theme.textSecondary }]}>Severity</Text>
        </View>
        <Text style={[styles.severityValue, { color: severityColor }]}>{sev}/100</Text>
      </View>
      <ProgressBar value={sev / 100} color={severityColor} height={scale(10)} label="Scandal severity" />

      <Text style={[styles.subhead, { color: theme.text }]}>How will you respond?</Text>
      {options.map((opt) => {
        const meta = OPTION_BLURBS[opt];
        const Icon = meta.Icon;
        return (
          <Pressable
            key={opt}
            onPress={() => handleChoice(opt)}
            accessibilityRole="button"
            accessibilityLabel={`${meta.title}. ${meta.preview}`}
            style={({ pressed }) => [
              styles.optionCard,
              { backgroundColor: theme.surfaceElevated, borderColor: theme.border, opacity: pressed ? 0.85 : 1 },
            ]}
          >
            <View style={styles.optionHeader}>
              <Icon size={fontScale(18)} color={meta.iconColor} />
              <Text style={[styles.optionTitle, { color: theme.text }]}>{meta.title}</Text>
            </View>
            <Text style={[styles.optionPreview, { color: theme.textSecondary }]}>{meta.preview}</Text>
          </Pressable>
        );
      })}
    </BaseModal>
  );
}

// BaseModal bounds its own height and scrolls its body, which is what the
// hand-rolled sheet had to do by hand (maxHeight 90% + a flexShrink list) so a
// short screen could still reach the last option.
const styles = StyleSheet.create({
  severityRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  severityLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(6),
  },
  severityLabel: {
    fontSize: fontScale(12),
  },
  severityValue: {
    fontSize: fontScale(16),
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  subhead: {
    fontSize: fontScale(15),
    fontWeight: '600',
    marginTop: responsiveSpacing.lg,
    marginBottom: responsiveSpacing.sm,
  },
  optionCard: {
    borderRadius: scale(12),
    borderWidth: StyleSheet.hairlineWidth,
    padding: responsiveSpacing.md,
    marginBottom: responsiveSpacing.sm,
  },
  optionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: responsiveSpacing.sm,
  },
  optionTitle: {
    fontSize: fontScale(14),
    fontWeight: '600',
  },
  optionPreview: {
    fontSize: fontScale(11),
    marginTop: 6,
    marginLeft: scale(30),
  },
  footnote: {
    fontSize: fontScale(10),
    textAlign: 'center',
    marginTop: responsiveSpacing.md,
  },
});
