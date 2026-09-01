/**
 * BoostPostModal - gem-spend modal that supercharges a post.
 *
 * Triples viral roll chance on the targeted post and bumps engagement.
 * Dispatches `boostPostWithGems` from PulseActions; closes on success.
 */
import React, { useCallback } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Zap, Gem } from 'lucide-react-native';
import BaseModal from '@/components/ui/BaseModal';
import StatStrip from '@/components/ui/StatStrip';
import { useGame } from '@/contexts/GameContext';
import { useTheme } from '@/hooks/useTheme';
import { scale, fontScale, responsiveSpacing, touchTargets } from '@/utils/scaling';
import { boostPostWithGems } from '@/contexts/game/actions/PulseActions';
import { PULSE_COLORS } from '../styles/pulseTheme';
import { pulseHaptics } from '../utils/pulseHaptics';

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
      // Persist the gem spend like every sibling Pulse mutation - without
      // this a reload inside the 2-minute autosave window reverted it.
      setTimeout(() => { void saveGame?.(); }, 0);
      onDismiss();
    } else {
      pulseHaptics.error();
    }
  }, [postId, canAfford, setGameState, gameState, saveGame, onDismiss]);

  if (!visible) return null;

  return (
    <BaseModal
      visible={visible}
      onClose={onDismiss}
      variant="bottom"
      title="Boost this post"
      subtitle="Triples the viral chance and recomputes engagement at your tier ceiling."
      footer={
        <Pressable
          onPress={handleBoost}
          disabled={!canAfford}
          accessibilityRole="button"
          accessibilityState={{ disabled: !canAfford }}
          accessibilityLabel={canAfford ? `Spend ${GEM_COST} gems to boost` : 'Not enough gems'}
          style={[
            styles.cta,
            { backgroundColor: canAfford ? PULSE_COLORS.accent : theme.border },
            !canAfford && styles.ctaDisabled,
          ]}
        >
          <Gem size={fontScale(16)} color="#FFFFFF" />
          <Text style={styles.ctaText}>
            {canAfford ? `Spend ${GEM_COST} to boost` : 'Not enough gems'}
          </Text>
        </Pressable>
      }
    >
      <View style={[styles.badge, { backgroundColor: PULSE_COLORS.accent }]}>
        <Zap size={scale(28)} color="#FFFFFF" strokeWidth={2.4} />
      </View>

      <StatStrip
        items={[
          { label: 'Cost', value: `${GEM_COST.toLocaleString()} gems`, tint: PULSE_COLORS.verified },
          {
            label: 'Your balance',
            value: gems.toLocaleString(),
            tint: canAfford ? undefined : PULSE_COLORS.danger,
          },
        ]}
      />
    </BaseModal>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'center',
    width: scale(56),
    height: scale(56),
    borderRadius: scale(28),
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: responsiveSpacing.md,
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: scale(6),
    minHeight: touchTargets.minimum,
    borderRadius: scale(14),
    paddingVertical: responsiveSpacing.sm,
  },
  ctaDisabled: {
    opacity: 0.6,
  },
  ctaText: {
    color: '#FFFFFF',
    fontSize: fontScale(15),
    fontWeight: '600',
  },
});
