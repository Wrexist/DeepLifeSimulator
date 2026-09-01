import React from 'react';
import { useGameSelector, shallowEqual } from '@/contexts/game/useGameSelector';
import { formatMoney } from '@/utils/moneyFormatting';
import StatBreakdownModal from '@/components/ui/StatBreakdownModal';
import { useTheme } from '@/hooks/useTheme';

interface MoneyBreakdownModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function MoneyBreakdownModal({ visible, onClose }: MoneyBreakdownModalProps) {
  const stats = useGameSelector((s) => s.stats, shallowEqual);
  const { isDark } = useTheme();
  const money = stats?.money ?? 0;

  return (
    <StatBreakdownModal
      visible={visible}
      onClose={onClose}
      title="Cash Balance"
      hero={{
        label: 'Current Cash',
        valueText: formatMoney(money),
        valueColor: isDark ? '#22C55E' : '#16A34A',
        subLines: [
          {
            text: money.toLocaleString('en-US', {
              style: 'currency',
              currency: 'USD',
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            }),
            emphasis: true,
          },
        ],
      }}
      summary={{
        title: 'About Cash',
        text: (
          <>
            {'\u2022'} Cash is the money you have on hand{'\n'}
            {'\u2022'} Use cash to buy items, pay for activities, and make purchases{'\n'}
            {'\u2022'} You can deposit cash into your bank account for savings{'\n'}
            {'\u2022'} Cash doesn't earn interest - consider saving excess funds{'\n'}
            {'\u2022'} Keep some cash on hand for emergencies and daily expenses
          </>
        ),
      }}
    />
  );
}
