/**
 * JealousyModal - confrontation sheet that resolves an active jealousy event.
 *
 * Reads `sparkApp.activeJealousy`, renders the partner's accusation (copy driven
 * by trigger type + severity) and one button per available `SparkJealousyOutcome`,
 * then dispatches the already-built `resolveJealousy` action. Resolving the event
 * also un-sticks the tick's permanent-block bug (it only spawns a new event when
 * none is active).
 *
 * On-DNA: same bottom-sheet shell as BoostModal.
 */
import React, { useCallback } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { X, HeartCrack } from 'lucide-react-native';
import Gradient from '@/components/ui/Gradient';
import { useGame } from '@/contexts/GameContext';
import { useTheme } from '@/hooks/useTheme';
import { scale, fontScale, responsiveSpacing, touchTargets } from '@/utils/scaling';
import { Z_INDEX } from '@/utils/zIndexConstants';
import { resolveJealousy } from '@/contexts/game/actions/SparkActions';
import { getJealousyFlavor, getJealousyChoices, pickJealousyAccusation } from '@/lib/dating/jealousyFlavor';
import type { SparkJealousyOutcome } from '@/contexts/game/types';
import { SPARK_GRADIENT, SPARK_COLORS } from '../styles/sparkTheme';
import { sparkHaptics } from '../utils/sparkHaptics';

const LinearGradient = Gradient;

interface JealousyModalProps {
  visible: boolean;
  onDismiss: () => void;
}

export default function JealousyModal({ visible, onDismiss }: JealousyModalProps) {
  const { gameState, setGameState, saveGame } = useGame();
  const { theme } = useTheme();

  const event = gameState.sparkApp?.activeJealousy ?? null;
  const partner = gameState.relationships?.find((r) => r.id === event?.partnerId);
  const partnerName = partner?.name ?? 'Your partner';

  // Pick the accusation ONCE per event (Math.random inside) so it stays stable
  // across re-renders instead of re-rolling on every render. Keyed on the event
  // id + severity + partner so a fresh event (or a name change) picks anew.
  const accusation = React.useMemo(
    () =>
      pickJealousyAccusation(event?.triggerType ?? 'spotted_swiping', {
        partnerName,
        severity: event?.severity ?? 0,
      }),
    // `event` identity keys the pick to each distinct jealousy event; partnerName
    // is interpolated into the line. (Both are read inside the memo.)
    [event, partnerName],
  );

  const handleChoice = useCallback(
    (outcome: SparkJealousyOutcome) => {
      const r = resolveJealousy(setGameState, gameState, outcome);
      if (r.success) {
        sparkHaptics.warning();
        saveGame();
      } else {
        sparkHaptics.error();
      }
      onDismiss();
    },
    [setGameState, gameState, saveGame, onDismiss],
  );

  if (!visible || !event) return null;

  const flavor = getJealousyFlavor(event.triggerType);
  const choices = getJealousyChoices(event.severity);

  const toneColor = (tone: 'neutral' | 'soft' | 'destructive') =>
    tone === 'destructive' ? SPARK_COLORS.danger : theme.text;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onDismiss}>
      <View style={styles.backdrop}>
        <View style={[styles.sheet, { backgroundColor: theme.surface }]}>
          <View style={styles.header}>
            <Pressable
              onPress={onDismiss}
              accessibilityRole="button"
              accessibilityLabel="Deal with this later"
              hitSlop={8}
              style={styles.closeBtn}
            >
              <X size={fontScale(22)} color={theme.text} />
            </Pressable>
          </View>

          <LinearGradient
            colors={SPARK_GRADIENT as unknown as string[]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroBadge}
          >
            <HeartCrack size={scale(34)} color="#FFFFFF" strokeWidth={2.4} />
          </LinearGradient>

          <Text style={[styles.title, { color: theme.text }]}>{flavor.title}</Text>
          <Text style={[styles.partnerLine, { color: SPARK_COLORS.accent }]}>
            {partnerName} · severity {Math.round(event.severity)}
          </Text>
          <Text style={[styles.accusation, { color: theme.textSecondary }]}>{accusation}</Text>

          <View style={styles.choices}>
            {choices.map((c) => (
              <Pressable
                key={c.outcome}
                onPress={() => handleChoice(c.outcome)}
                accessibilityRole="button"
                accessibilityLabel={`${c.label}. ${c.hint}`}
                style={({ pressed }) => [
                  styles.choiceRow,
                  {
                    backgroundColor: theme.surfaceElevated,
                    borderColor: c.tone === 'destructive' ? SPARK_COLORS.danger : theme.border,
                    opacity: pressed ? 0.85 : 1,
                  },
                ]}
              >
                <View style={styles.choiceBody}>
                  <Text style={[styles.choiceLabel, { color: toneColor(c.tone) }]}>{c.label}</Text>
                  <Text style={[styles.choiceHint, { color: theme.textMuted }]}>{c.hint}</Text>
                </View>
              </Pressable>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
    zIndex: Z_INDEX.MODAL,
  },
  sheet: {
    borderTopLeftRadius: scale(24),
    borderTopRightRadius: scale(24),
    padding: responsiveSpacing.lg,
    paddingBottom: responsiveSpacing.xl,
  },
  header: { flexDirection: 'row', justifyContent: 'flex-end' },
  closeBtn: {
    width: touchTargets.minimum,
    height: touchTargets.minimum,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroBadge: {
    alignSelf: 'center',
    width: scale(68),
    height: scale(68),
    borderRadius: scale(34),
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: responsiveSpacing.md,
  },
  title: {
    textAlign: 'center',
    fontSize: fontScale(22),
    fontWeight: '700',
  },
  partnerLine: {
    textAlign: 'center',
    fontSize: fontScale(12),
    fontWeight: '700',
    marginTop: 4,
  },
  accusation: {
    textAlign: 'center',
    fontSize: fontScale(14),
    fontStyle: 'italic',
    marginTop: responsiveSpacing.sm,
    marginBottom: responsiveSpacing.lg,
    lineHeight: fontScale(20),
  },
  choices: {
    gap: responsiveSpacing.sm,
  },
  choiceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: scale(14),
    borderWidth: 1,
    paddingVertical: responsiveSpacing.md,
    paddingHorizontal: responsiveSpacing.md,
  },
  choiceBody: { flex: 1 },
  choiceLabel: {
    fontSize: fontScale(15),
    fontWeight: '700',
  },
  choiceHint: {
    fontSize: fontScale(12),
    marginTop: 2,
  },
});
