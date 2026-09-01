import React from 'react';
import { useGameSelector, shallowEqual } from '@/contexts/game/useGameSelector';
import StatBreakdownModal from '@/components/ui/StatBreakdownModal';
import { useTheme } from '@/hooks/useTheme';

interface GemsBreakdownModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function GemsBreakdownModal({ visible, onClose }: GemsBreakdownModalProps) {
  const stats = useGameSelector((s) => s.stats, shallowEqual);
  const { isDark } = useTheme();
  const gems = stats?.gems ?? 0;

  return (
    <StatBreakdownModal
      visible={visible}
      onClose={onClose}
      title="Gems"
      hero={{
        label: 'Current Gems',
        valueText: gems.toLocaleString(),
        valueColor: isDark ? '#818CF8' : '#6366F1',
        valueFontSize: 36,
      }}
      summary={{
        title: 'About Gems',
        // Every claim here must be TRUE of the code: gems live in this save
        // slot's stats (they survive prestige within the slot, but each slot
        // has its own balance), and the shop is a real source. An earlier
        // version promised "persist across all save slots and game resets"
        // and omitted purchases - both wrong.
        text: (
          <>
            {'\u2022'} Gems are premium currency earned through achievements, challenges and daily claims - or bought in the shop{'\n'}
            {'\u2022'} Use gems to purchase permanent perks and special upgrades{'\n'}
            {'\u2022'} Gems belong to this save slot and carry over when you prestige into a new life{'\n'}
            {'\u2022'} Gems can unlock powerful bonuses that last forever
          </>
        ),
      }}
    />
  );
}
