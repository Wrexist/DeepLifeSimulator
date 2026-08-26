import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useGameSelector, shallowEqual } from '@/contexts/game/useGameSelector';
import { scale, fontScale, responsiveBorderRadius } from '@/utils/scaling';
import { getPlatformShadows } from '@/utils/glassmorphismStyles';
import BaseModal from '@/components/ui/BaseModal';
import { useTheme } from '@/hooks/useTheme';

interface GemsBreakdownModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function GemsBreakdownModal({ visible, onClose }: GemsBreakdownModalProps) {
  const stats = useGameSelector((s) => s.stats, shallowEqual);
  const { theme, isDark } = useTheme();
  const gems = stats?.gems ?? 0;

  return (
    <BaseModal visible={visible} onClose={onClose} title="Gems">
      {/* Current Gems */}
      <View style={[styles.totalCard, { backgroundColor: isDark ? '#334155' : '#F1F5F9' }]}>
        <Text style={[styles.totalLabel, { color: theme.textSecondary }]}>Current Gems</Text>
        <Text style={[styles.totalValue, { color: isDark ? '#818CF8' : '#6366F1' }]}>
          {gems.toLocaleString()}
        </Text>
      </View>

      {/* Info Card */}
      <View style={[styles.infoCard, { backgroundColor: isDark ? '#334155' : '#F1F5F9' }]}>
        <Text style={[styles.infoTitle, { color: theme.text }]}>
          About Gems
        </Text>
        {/* Every claim here must be TRUE of the code: gems live in this save
            slot's stats (they survive prestige within the slot, but each slot
            has its own balance), and the shop is a real source. An earlier
            version promised "persist across all save slots and game resets"
            and omitted purchases - both wrong. */}
        <Text style={[styles.infoText, { color: theme.textSecondary }]}>
          {'\u2022'} Gems are premium currency earned through achievements, challenges and daily claims - or bought in the shop{'\n'}
          {'\u2022'} Use gems to purchase permanent perks and special upgrades{'\n'}
          {'\u2022'} Gems belong to this save slot and carry over when you prestige into a new life{'\n'}
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
    ...getPlatformShadows(6, 0.25, 4, 14),
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
