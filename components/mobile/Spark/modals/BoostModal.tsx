/**
 * BoostModal — gem-spend confirmation for activating profile boost.
 *
 * 50 gems → 1 in-game week of boosted visibility / match-rate.
 */
import React, { useCallback } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { X, Zap, Gem } from 'lucide-react-native';
import LinearGradientFallback from '@/components/fallbacks/LinearGradientFallback';
import { useGame } from '@/contexts/GameContext';
import { useTheme } from '@/hooks/useTheme';
import { scale, fontScale, responsiveSpacing, touchTargets } from '@/utils/scaling';
import { Z_INDEX } from '@/utils/zIndexConstants';
import { boostProfile } from '@/contexts/game/actions/SparkActions';
import { SPARK_GRADIENT, SPARK_COLORS } from '../styles/sparkTheme';
import { sparkHaptics } from '../utils/sparkHaptics';

const LinearGradient = LinearGradientFallback;
const BOOST_COST = 50;

interface BoostModalProps {
  visible: boolean;
  onDismiss: () => void;
}

export default function BoostModal({ visible, onDismiss }: BoostModalProps) {
  const { gameState, setGameState, saveGame } = useGame();
  const { theme } = useTheme();
  const gems = gameState.stats?.gems ?? 0;
  const canAfford = gems >= BOOST_COST;

  const handle = useCallback(() => {
    if (!canAfford) {
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
  }, [canAfford, setGameState, gameState, saveGame, onDismiss]);

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onDismiss}>
      <View style={styles.backdrop}>
        <View style={[styles.sheet, { backgroundColor: theme.surface }]}>
          <View style={styles.header}>
            <Pressable onPress={onDismiss} accessibilityRole="button" accessibilityLabel="Close" hitSlop={8} style={styles.closeBtn}>
              <X size={fontScale(22)} color={theme.text} />
            </Pressable>
          </View>

          <LinearGradient
            colors={SPARK_GRADIENT as unknown as string[]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroBadge}
          >
            <Zap size={scale(36)} color="#FFFFFF" strokeWidth={2.4} fill="#FFFFFF" />
          </LinearGradient>

          <Text style={[styles.title, { color: theme.text }]}>Boost your profile</Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
            Get seen first for the next week. Higher match rate, more "liked you" hits.
          </Text>

          <View style={[styles.costCard, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
            <Gem size={fontScale(18)} color={SPARK_COLORS.tierPlus} />
            <Text style={[styles.costValue, { color: theme.text }]}>{BOOST_COST}</Text>
            <Text style={[styles.costLabel, { color: theme.textSecondary }]}>gems</Text>
          </View>
          <Text style={[styles.balance, { color: canAfford ? theme.textSecondary : SPARK_COLORS.danger }]}>
            You have {gems.toLocaleString()} gems
          </Text>

          <Pressable
            onPress={handle}
            disabled={!canAfford}
            accessibilityRole="button"
            accessibilityLabel={canAfford ? `Spend ${BOOST_COST} gems to boost` : 'Not enough gems'}
            style={[styles.cta, !canAfford && styles.ctaDisabled]}
          >
            <LinearGradient
              colors={
                canAfford
                  ? (SPARK_GRADIENT as unknown as string[])
                  : [theme.border, theme.border]
              }
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.ctaFill}
            >
              {canAfford ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={styles.ctaText}>{`Boost for ${BOOST_COST}`}</Text>
                  <Gem size={fontScale(16)} color="#FFFFFF" />
                </View>
              ) : (
                <Text style={styles.ctaText}>Not enough gems</Text>
              )}
            </LinearGradient>
          </Pressable>
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
    width: scale(72),
    height: scale(72),
    borderRadius: scale(36),
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: responsiveSpacing.md,
  },
  title: {
    textAlign: 'center',
    fontSize: fontScale(22),
    fontWeight: '700',
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
    fontWeight: '700',
  },
  costLabel: { fontSize: fontScale(13) },
  balance: {
    fontSize: fontScale(11),
    textAlign: 'center',
    marginBottom: responsiveSpacing.lg,
  },
  cta: { borderRadius: scale(14), overflow: 'hidden' },
  ctaDisabled: { opacity: 0.6 },
  ctaFill: {
    paddingVertical: responsiveSpacing.md,
    alignItems: 'center',
  },
  ctaText: {
    color: '#FFFFFF',
    fontSize: fontScale(15),
    fontWeight: '700',
  },
});
