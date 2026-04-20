import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useGame } from '@/contexts/GameContext';
import { scale, fontScale, responsiveBorderRadius } from '@/utils/scaling';
import { getShadow } from '@/utils/shadow';
import BaseModal from '@/components/ui/BaseModal';
import { useTheme } from '@/hooks/useTheme';

interface GemsBreakdownModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function GemsBreakdownModal({ visible, onClose }: GemsBreakdownModalProps) {
  const { gameState } = useGame();
  const { stats } = gameState;
  const { theme, isDark } = useTheme();
  const gems = stats?.gems ?? 0;

  return (
    <BaseModal visible={visible} onClose={onClose} title="Gems">
      {/* Current Gems */}
      <View style={[styles.totalCard, { backgroundColor: isDark ? '#374151' : '#F3F4F6' }]}>
        <Text style={[styles.totalLabel, { color: theme.textSecondary }]}>Current Gems</Text>
        <Text style={[styles.totalValue, { color: isDark ? '#818CF8' : '#6366F1' }]}>
          {gems.toLocaleString()}
        </Text>
      </View>

      {/* Info Card */}
      <View style={[styles.infoCard, { backgroundColor: isDark ? '#374151' : '#F3F4F6' }]}>
        <Text style={[styles.infoTitle, { color: theme.text }]}>
          About Gems
        </Text>
        <Text style={[styles.infoText, { color: theme.textSecondary }]}>
          {'\u2022'} Gems are premium currency earned through achievements and challenges{'\n'}
          {'\u2022'} Use gems to purchase permanent perks and special upgrades{'\n'}
          {'\u2022'} Gems persist across all save slots and game resets{'\n'}
          {'\u2022'} Complete achievements and challenges to earn more gems{'\n'}
          {'\u2022'} Gems can unlock powerful bonuses that last forever
        </Text>
      </View>
    </BaseModal>
  );
}

const styles = StyleSheet.create({
  totalCard: {
    padding: scale(16),
    borderRadius: responsiveBorderRadius.md,
    marginBottom: scale(14),
    ...getShadow(2),
  },
  totalLabel: {
    fontSize: fontScale(13),
    fontWeight: '600',
    marginBottom: scale(6),
  },
  totalValue: {
    fontSize: fontScale(36),
    fontWeight: '800',
  },
  infoCard: {
    padding: scale(14),
    borderRadius: responsiveBorderRadius.md,
  },
  infoTitle: {
    fontSize: fontScale(15),
    fontWeight: '700',
    marginBottom: scale(8),
  },
  infoText: {
    fontSize: fontScale(12),
    lineHeight: fontScale(16),
  },
});
