/**
 * JealousyModal - confrontation sheet that resolves an active jealousy event.
 *
 * Reads `sparkApp.activeJealousy`, renders the partner's accusation (copy driven
 * by trigger type + severity) and one button per available `SparkJealousyOutcome`,
 * then dispatches the already-built `resolveJealousy` action. Resolving the event
 * also un-sticks the tick's permanent-block bug (it only spawns a new event when
 * none is active).
 *
 * On-DNA: the shared `BaseModal` bottom sheet, same as BoostModal.
 */
import React, { useCallback } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { HeartCrack } from 'lucide-react-native';
import BaseModal from '@/components/ui/BaseModal';
import { useGame } from '@/contexts/GameContext';
import { useTheme } from '@/hooks/useTheme';
import { withAlpha } from '@/lib/config/theme';
import { scale, fontScale, responsiveSpacing } from '@/utils/scaling';
import { resolveJealousy } from '@/contexts/game/actions/SparkActions';
import { getJealousyFlavor, getJealousyChoices, pickJealousyAccusation } from '@/lib/dating/jealousyFlavor';
import type { SparkJealousyOutcome } from '@/contexts/game/types';
import { SPARK_COLORS } from '../styles/sparkTheme';
import { sparkHaptics } from '../utils/sparkHaptics';

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
    <BaseModal
      visible={visible}
      onClose={onDismiss}
      variant="bottom"
      title={flavor.title}
      subtitle={`${partnerName} · severity ${Math.round(event.severity)}`}
      scrollable={false}
    >
      <View style={[styles.heroBadge, { backgroundColor: withAlpha(SPARK_COLORS.accent, 0.16) }]}>
        <HeartCrack size={scale(34)} color={SPARK_COLORS.accent} strokeWidth={2.4} />
      </View>

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
    </BaseModal>
  );
}

const styles = StyleSheet.create({
  heroBadge: {
    alignSelf: 'center',
    width: scale(68),
    height: scale(68),
    borderRadius: scale(34),
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: responsiveSpacing.md,
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
    fontWeight: '600',
  },
  choiceHint: {
    fontSize: fontScale(12),
    marginTop: 2,
  },
});
