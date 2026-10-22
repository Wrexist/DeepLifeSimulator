import { uiPalette , withAlpha } from '@/lib/config/theme';
/**
 * BoostModal - gem-spend confirmation for activating profile boost.
 *
 * 50 gems → 1 in-game week of boosted visibility / match-rate.
 * Shell is the shared `BaseModal` bottom sheet.
 */
import React, { useCallback } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Zap, Gem } from 'lucide-react-native';
import BaseModal from '@/components/ui/BaseModal';
import { useGame } from '@/contexts/GameContext';
import { useTheme } from '@/hooks/useTheme';

import { scale, fontScale, responsiveSpacing, touchTargets } from '@/utils/scaling';
import { activeBoostExpiresWeek, boostProfile } from '@/contexts/game/actions/SparkActions';
import { SPARK_COLORS } from '../styles/sparkTheme';
import { sparkHaptics } from '../utils/sparkHaptics';

const BOOST_COST = 50;

interface BoostModalProps {
  visible: boolean;
  onDismiss: () => void;
}

export default function BoostModal({ visible, onDismiss }: BoostModalProps) {
  const { gameState, setGameState, saveGame } = useGame();
  const { theme } = useTheme();
  const gems = gameState.stats?.gems ?? 0;
  const runningUntil = activeBoostExpiresWeek(gameState);
  const boostRunning = runningUntil !== null;
  const canAfford = gems >= BOOST_COST;
  const canBuy = canAfford && !boostRunning;
  const weeksLeft = boostRunning ? Math.max(1, runningUntil - (gameState.weeksLived ?? 0)) : 0;

  const handle = useCallback(() => {
    if (!canBuy) {
      sparkHaptics.error();
      return;
    }
    const r = boostProfile(setGameState, gameState);
    if (r.success) {
      sparkHaptics.boost();
      saveGame();
      onDismiss();
    } else {
      sparkHaptics.error();
    }
  }, [canBuy, setGameState, gameState, saveGame, onDismiss]);

  return (
    <BaseModal
      visible={visible}
      onClose={onDismiss}
      variant="bottom"
      title="Boost your profile"
      subtitle="Get seen first for the next week"
      scrollable={false}
    >
      <View style={[styles.heroBadge, { backgroundColor: withAlpha(SPARK_COLORS.accent, 0.16) }]}>
        <Zap size={scale(36)} color={SPARK_COLORS.accent} strokeWidth={2.4} fill={SPARK_COLORS.accent} />
      </View>

      <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
        Higher match rate, more &quot;liked you&quot; hits.
      </Text>

      <View style={[styles.costCard, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
        <Gem size={fontScale(18)} color={SPARK_COLORS.tierPlus} />
        <Text style={[styles.costValue, { color: theme.text }]}>{BOOST_COST}</Text>
        <Text style={[styles.costLabel, { color: theme.textSecondary }]}>gems</Text>
      </View>
      <Text style={[styles.balance, { color: canAfford ? theme.textSecondary : SPARK_COLORS.danger }]}>
        You have {gems.toLocaleString('en-US')} gems
      </Text>

      <Pressable
        onPress={handle}
        disabled={!canBuy}
        accessibilityRole="button"
        accessibilityLabel={boostRunning ? `Boost active for ${weeksLeft} more ${weeksLeft === 1 ? 'week' : 'weeks'}` : canAfford ? `Spend ${BOOST_COST} gems to boost` : 'Not enough gems'}
        accessibilityState={{ disabled: !canBuy }}
        style={[
          styles.cta,
          { backgroundColor: canBuy ? SPARK_COLORS.accent : theme.border },
          !canBuy && styles.ctaDisabled,
        ]}
      >
        {boostRunning ? (
          <Text style={styles.ctaText}>{`Boost active · ${weeksLeft} ${weeksLeft === 1 ? 'week' : 'weeks'} left`}</Text>
        ) : canAfford ? (
          <View style={styles.ctaRow}>
            <Text style={styles.ctaText}>{`Boost for ${BOOST_COST}`}</Text>
            <Gem size={fontScale(16)} color={uiPalette.white} />
          </View>
        ) : (
          <Text style={styles.ctaText}>Not enough gems</Text>
        )}
      </Pressable>
    </BaseModal>
  );
}

const styles = StyleSheet.create({
  heroBadge: {
    alignSelf: 'center',
    width: scale(72),
    height: scale(72),
    borderRadius: scale(36),
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: responsiveSpacing.md,
  },
  subtitle: {
    textAlign: 'center',
    fontSize: fontScale(13),
    marginTop: 4,
    marginBottom: responsiveSpacing.lg,
  },
  costCard: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    gap: 8,
    borderRadius: scale(14),
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: responsiveSpacing.md,
    marginBottom: responsiveSpacing.xs,
  },
  costValue: {
    fontSize: fontScale(28),
    fontWeight: '600',
  },
  costLabel: { fontSize: fontScale(13) },
  balance: {
    fontSize: fontScale(11),
    textAlign: 'center',
    marginBottom: responsiveSpacing.lg,
  },
  cta: {
    borderRadius: scale(14),
    overflow: 'hidden',
    minHeight: touchTargets.minimum,
    paddingVertical: responsiveSpacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaDisabled: { opacity: 0.6 },
  ctaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  ctaText: {
    color: uiPalette.white,
    fontSize: fontScale(15),
    fontWeight: '600',
  },
});
