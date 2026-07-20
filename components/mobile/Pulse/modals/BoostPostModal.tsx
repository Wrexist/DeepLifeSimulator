/**
 * BoostPostModal — gem-spend modal that supercharges a post.
 *
 * Triples viral roll chance on the targeted post and bumps engagement.
 * Dispatches `boostPostWithGems` from PulseActions; closes on success.
 */
import React, { useCallback } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { X, Zap, Gem } from 'lucide-react-native';
import LinearGradientFallback from '@/components/fallbacks/LinearGradientFallback';
import { useGame } from '@/contexts/GameContext';
import { useTheme } from '@/hooks/useTheme';
import { scale, fontScale, responsiveSpacing, touchTargets } from '@/utils/scaling';
import { Z_INDEX } from '@/utils/zIndexConstants';
import { boostPostWithGems } from '@/contexts/game/actions/PulseActions';
import { PULSE_GRADIENT, PULSE_COLORS } from '../styles/pulseTheme';
import { pulseHaptics } from '../utils/pulseHaptics';

const LinearGradient = LinearGradientFallback;
const GEM_COST = 200;

interface BoostPostModalProps {
  visible: boolean;
  postId: string | null;
  onDismiss: () => void;
}

export default function BoostPostModal({ visible, postId, onDismiss }: BoostPostModalProps) {
  const { gameState, setGameState, saveGame } = useGame();
  const { theme } = useTheme();

  const gems = gameState.stats?.gems ?? 0;
  const canAfford = gems >= GEM_COST;

  const handleBoost = useCallback(() => {
    if (!postId || !canAfford) return;
    const result = boostPostWithGems(setGameState, gameState, postId, GEM_COST);
    if (result.success) {
      pulseHaptics.success();
      // Persist the gem spend like every sibling Pulse mutation — without
      // this a reload inside the 2-minute autosave window reverted it.
      setTimeout(() => { void saveGame?.(); }, 0);
      onDismiss();
    } else {
      pulseHaptics.error();
    }
  }, [postId, canAfford, setGameState, gameState, saveGame, onDismiss]);

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onDismiss}>
      <View style={styles.backdrop}>
        <View style={[styles.sheet, { backgroundColor: theme.surface }]}>
          <View style={styles.header}>
            <Pressable
              onPress={onDismiss}
              accessibilityRole="button"
              accessibilityLabel="Close"
              hitSlop={8}
              style={styles.closeBtn}
            >
              <X size={fontScale(22)} color={theme.text} />
            </Pressable>
          </View>

          <LinearGradient
            colors={PULSE_GRADIENT as unknown as string[]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroBadge}
          >
            <Zap size={scale(36)} color="#FFFFFF" strokeWidth={2.4} />
          </LinearGradient>

          <Text style={[styles.title, { color: theme.text }]}>Boost this post</Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
            Spend gems to triple the viral chance and recompute engagement at your tier ceiling.
          </Text>

          <View style={[styles.costCard, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
            <View style={styles.costRow}>
              <Gem size={fontScale(18)} color={PULSE_COLORS.verified} />
              <Text style={[styles.costValue, { color: theme.text }]}>{GEM_COST.toLocaleString()}</Text>
              <Text style={[styles.costLabel, { color: theme.textSecondary }]}>gems</Text>
            </View>
            <Text style={[styles.balance, { color: canAfford ? theme.textSecondary : PULSE_COLORS.danger }]}>
              You have {gems.toLocaleString()} gems
            </Text>
          </View>

          <Pressable
            onPress={handleBoost}
            disabled={!canAfford}
            accessibilityRole="button"
            accessibilityLabel={canAfford ? `Spend ${GEM_COST} gems to boost` : 'Not enough gems'}
            style={[styles.cta, !canAfford && styles.ctaDisabled]}
          >
            <LinearGradient
              colors={
                canAfford
                  ? (PULSE_GRADIENT as unknown as string[])
                  : [theme.border, theme.border]
              }
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.ctaFill}
            >
              {canAfford ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={styles.ctaText}>{`Spend ${GEM_COST}`}</Text>
                  <Gem size={fontScale(16)} color="#FFFFFF" />
                  <Text style={styles.ctaText}>to boost</Text>
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
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
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
    marginTop: responsiveSpacing.xs,
    marginBottom: responsiveSpacing.lg,
  },
  costCard: {
    borderRadius: scale(14),
    borderWidth: StyleSheet.hairlineWidth,
    padding: responsiveSpacing.md,
    alignItems: 'center',
    marginBottom: responsiveSpacing.lg,
  },
  costRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  costValue: {
    fontSize: fontScale(28),
    fontWeight: '700',
  },
  costLabel: {
    fontSize: fontScale(13),
  },
  balance: {
    fontSize: fontScale(11),
    marginTop: 4,
  },
  cta: {
    borderRadius: scale(14),
    overflow: 'hidden',
  },
  ctaDisabled: {
    opacity: 0.6,
  },
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
