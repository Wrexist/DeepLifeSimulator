import { uiPalette } from '@/lib/config/theme';
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
import { boostPostWithGems, postBoostedThisWeek } from '@/contexts/game/actions/PulseActions';
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
  const alreadyBoosted = postId ? postBoostedThisWeek(gameState, postId) : false;
  const canAfford = gems >= GEM_COST;
  const canBuy = canAfford && !alreadyBoosted;

  const handleBoost = useCallback(() => {
    if (!postId || !canBuy) return;
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
  }, [postId, canBuy, setGameState, gameState, saveGame, onDismiss]);

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
          disabled={!canBuy}
          accessibilityRole="button"
          accessibilityState={{ disabled: !canBuy }}
          accessibilityLabel={alreadyBoosted ? 'Already boosted this week' : canAfford ? `Spend ${GEM_COST} gems to boost` : 'Not enough gems'}
          style={[
            styles.cta,
            { backgroundColor: canBuy ? PULSE_COLORS.accent : theme.border },
            !canBuy && styles.ctaDisabled,
          ]}
        >
          <Gem size={fontScale(16)} color={uiPalette.white} />
          <Text style={styles.ctaText}>
            {alreadyBoosted ? 'Boosted this week' : canAfford ? `Spend ${GEM_COST} to boost` : 'Not enough gems'}
          </Text>
        </Pressable>
      }
    >
      <View style={[styles.badge, { backgroundColor: PULSE_COLORS.accent }]}>
        <Zap size={scale(28)} color={uiPalette.white} strokeWidth={2.4} />
      </View>

      <StatStrip
        items={[
          { label: 'Cost', value: `${GEM_COST.toLocaleString('en-US')} gems`, tint: PULSE_COLORS.verified },
          {
            label: 'Your balance',
            value: gems.toLocaleString('en-US'),
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
    color: uiPalette.white,
    fontSize: fontScale(15),
    fontWeight: '600',
  },
});
