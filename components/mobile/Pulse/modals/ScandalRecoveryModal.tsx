/**
 * ScandalRecoveryModal — three response options for an active scandal.
 *
 * Dismiss-disabled until a choice is made. Severity meter color-shifts
 * green / amber / red. Three cards: Apologize / Stay silent / Clean slate (gems).
 * If the scandal is a deepfake or cancel type, a fourth Lawsuit option appears.
 */
import React, { useCallback } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AlertTriangle, MessageCircleOff, MessagesSquare, Gem, Scale } from 'lucide-react-native';
import LinearGradientFallback from '@/components/fallbacks/LinearGradientFallback';
import { useGame } from '@/contexts/GameContext';
import { useTheme } from '@/hooks/useTheme';
import { scale, fontScale, responsiveSpacing } from '@/utils/scaling';
import { recoverFromScandal } from '@/contexts/game/actions/PulseActions';
import { Z_INDEX } from '@/utils/zIndexConstants';
import { PULSE_GRADIENT, PULSE_COLORS, PULSE_SCANDAL_HIGH, PULSE_SCANDAL_MID } from '../styles/pulseTheme';
import { pulseHaptics } from '../utils/pulseHaptics';
import type { PulseActiveScandal, PulseScandalResolution } from '@/contexts/game/types';

const LinearGradient = LinearGradientFallback;

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
    iconColor: '#6B7280',
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
  const { gameState, setGameState } = useGame();
  const { theme } = useTheme();

  const handleChoice = useCallback(
    (method: PulseScandalResolution) => {
      const result = recoverFromScandal(setGameState, gameState, method);
      if (result.success) {
        pulseHaptics.success();
        onDismiss();
      } else {
        pulseHaptics.error();
      }
    },
    [setGameState, gameState, onDismiss],
  );

  if (!visible || !scandal) return null;

  const sev = scandal.severity;
  const severityColor =
    sev >= 70 ? PULSE_COLORS.danger : sev >= 40 ? PULSE_COLORS.warning : PULSE_COLORS.success;
  const meterGradient =
    sev >= 70 ? PULSE_SCANDAL_HIGH : PULSE_SCANDAL_MID;

  const options: PulseScandalResolution[] = ['apology', 'silence', 'gems'];
  if (scandal.type === 'deepfake' || scandal.type === 'cancel') {
    options.push('lawsuit');
  }

  return (
    // No-op onRequestClose so the Android hardware back button doesn't dismiss
    // an active scandal — player must pick a response (per plan §2.3 dismiss-disabled).
    <Modal visible={visible} transparent animationType="slide" onRequestClose={() => { /* no-op */ }}>
      <View style={styles.backdrop}>
        <View style={[styles.sheet, { backgroundColor: theme.surface }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <AlertTriangle size={fontScale(20)} color={PULSE_COLORS.danger} />
            <Text style={[styles.title, { color: theme.text }]}>A scandal is brewing</Text>
          </View>
          <Text style={[styles.headline, { color: theme.textSecondary }]}>{scandal.headline}</Text>

          <View style={styles.severityRow}>
            <Text style={[styles.severityLabel, { color: theme.textSecondary }]}>Severity</Text>
            <Text style={[styles.severityValue, { color: severityColor }]}>{sev}/100</Text>
          </View>
          <View style={[styles.meterTrack, { backgroundColor: theme.border }]}>
            <LinearGradient
              colors={meterGradient as unknown as string[]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[styles.meterFill, { width: `${sev}%` }]}
            />
          </View>

          <Text style={[styles.subhead, { color: theme.text }]}>How will you respond?</Text>
          <ScrollView style={{ maxHeight: scale(380) }}>
            {options.map((opt) => {
              const meta = OPTION_BLURBS[opt];
              const Icon = meta.Icon;
              return (
                <Pressable
                  key={opt}
                  onPress={() => handleChoice(opt)}
                  accessibilityRole="button"
                  accessibilityLabel={meta.title}
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
          </ScrollView>

          <Text style={[styles.footnote, { color: theme.textMuted }]}>
            Choose a response to continue.
          </Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
    zIndex: Z_INDEX.MODAL,
  },
  sheet: {
    borderTopLeftRadius: scale(24),
    borderTopRightRadius: scale(24),
    padding: responsiveSpacing.lg,
    paddingBottom: responsiveSpacing.xl,
  },
  title: {
    fontSize: fontScale(20),
    fontWeight: '700',
  },
  headline: {
    fontSize: fontScale(13),
    marginTop: 4,
    marginBottom: responsiveSpacing.md,
  },
  severityRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: responsiveSpacing.md,
  },
  severityLabel: {
    fontSize: fontScale(12),
  },
  severityValue: {
    fontSize: fontScale(16),
    fontWeight: '700',
  },
  meterTrack: {
    width: '100%',
    height: scale(10),
    borderRadius: 999,
    overflow: 'hidden',
    marginTop: 6,
  },
  meterFill: {
    height: '100%',
    borderRadius: 999,
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
  optionEmoji: {
    fontSize: fontScale(20),
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
