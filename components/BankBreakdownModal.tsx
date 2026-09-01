import React, { useMemo } from 'react';
import { PiggyBank, TrendingUp } from 'lucide-react-native';
import { useGameSelector } from '@/contexts/game/useGameSelector';
import { formatMoney } from '@/utils/moneyFormatting';
import StatBreakdownModal from '@/components/ui/StatBreakdownModal';
import type { StatBreakdownSection } from '@/components/ui/StatBreakdownModal';
import { useTheme } from '@/hooks/useTheme';
import { nonMirrorDeposits, MIRRORED_ACCOUNT_IDS } from '@/lib/banking/operations';
import { accountTypeLabel } from '@/components/banking/AccountRow';

interface BankBreakdownModalProps {
  visible: boolean;
  onClose: () => void;
}

const exactUSD = (value: number) =>
  value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

export default function BankBreakdownModal({ visible, onClose }: BankBreakdownModalProps) {
  const bankSavings = useGameSelector((s) => s.bankSavings);
  // The accounts the player opened themselves. `nonMirrorDeposits` drops
  // checking-default / savings-default, which mirror `stats.money` /
  // `bankSavings` - the legacy pool is already counted as `savings` below.
  const accounts = useGameSelector((s) => s.banking?.accounts);
  const stocks = useGameSelector((s) => s.stocks);
  const weeksLived = useGameSelector((s) => s.weeksLived);
  const { isDark } = useTheme();

  const breakdown = useMemo(() => {
    const savings = bankSavings ?? 0;
    const selfOpened = (accounts ?? []).filter(
      (a) => a && !MIRRORED_ACCOUNT_IDS.has(a.id) && (a.balance ?? 0) > 0
    );
    const selfOpenedTotal = nonMirrorDeposits(accounts ?? []);

    // Calculate stock investments
    // CRITICAL: Get the latest stock prices to ensure sync with StocksApp
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getStockInfo } = require('@/lib/economy/stockMarket');

    const stockHoldings = stocks?.holdings || [];
    const stockItems = stockHoldings.map(holding => {
      // Always use the latest stock price from stockMarket (source of truth)
      const stockInfo = getStockInfo(holding.symbol);
      const currentPrice = stockInfo.price || holding.currentPrice || 0;

      return {
        symbol: holding.symbol,
        shares: holding.shares,
        averagePrice: holding.averagePrice,
        currentPrice: currentPrice,
        totalValue: holding.shares * currentPrice,
        gainLoss: (currentPrice - holding.averagePrice) * holding.shares,
        gainLossPercent: holding.averagePrice > 0
          ? ((currentPrice - holding.averagePrice) / holding.averagePrice) * 100
          : 0,
      };
    });

    const totalStockValue = stockItems.reduce((sum, item) => sum + item.totalValue, 0);
    // Must match the HUD chip's total exactly - the chip is what opens this
    // modal, so any term missing from one and present in the other reads as a
    // bug in whichever the player looks at second.
    const totalSavings = savings + selfOpenedTotal + totalStockValue;

    return {
      savings,
      selfOpened,
      selfOpenedTotal,
      stockItems,
      totalStockValue,
      totalSavings,
    };
  }, [bankSavings, accounts, stocks, weeksLived]); // Recalculate when week changes

  const sections: StatBreakdownSection[] = [
    {
      title: 'Bank Savings',
      kind: 'neutral',
      icon: PiggyBank,
      iconColor: '#F59E0B',
      entries: [
        {
          label: 'Savings Account',
          valueText: formatMoney(breakdown.savings),
          icon: PiggyBank,
          color: '#F59E0B',
          description: 'Money deposited in your bank account',
          monoFootnote: exactUSD(breakdown.savings),
        },
        // Accounts the player opened themselves. These carry a real balance and
        // a real APR, and were previously absent from both this list and the
        // total it rolls up to - so a funded high-yield account looked like it
        // had swallowed the money.
        ...breakdown.selfOpened.map((account) => ({
          label: account.name,
          valueText: formatMoney(account.balance),
          icon: PiggyBank,
          color: '#F59E0B',
          description:
            accountTypeLabel(account.type) +
            (account.baseAPR > 0 ? ` · ${(account.baseAPR * 100).toFixed(2)}% APR` : ''),
          monoFootnote: exactUSD(account.balance ?? 0),
        })),
      ],
    },
  ];

  if (breakdown.stockItems.length > 0) {
    sections.push({
      title: 'Stock Investments',
      kind: 'income',
      entries: breakdown.stockItems.map((item) => {
        const isPositive = item.gainLoss >= 0;
        return {
          label: item.symbol,
          valueText: formatMoney(item.totalValue),
          icon: TrendingUp,
          color: '#10B981',
          iconColor: isPositive ? '#10B981' : '#EF4444',
          description: [
            `${item.shares.toLocaleString()} shares @ ${formatMoney(item.currentPrice)} each`,
            `Avg: ${formatMoney(item.averagePrice)} | Current: ${formatMoney(item.currentPrice)}`,
          ],
          subValue: {
            text: `${isPositive ? '+' : ''}${formatMoney(item.gainLoss)} (${isPositive ? '+' : ''}${item.gainLossPercent.toFixed(2)}%)`,
            positive: isPositive,
          },
          monoFootnote: exactUSD(item.totalValue),
        };
      }),
    });
  }

  return (
    <StatBreakdownModal
      visible={visible}
      onClose={onClose}
      title="Bank & Investments"
      hero={{
        label: 'Total Savings',
        valueText: formatMoney(breakdown.totalSavings),
        valueColor: isDark ? '#FBBF24' : '#F59E0B',
        subLines: [{ text: exactUSD(breakdown.totalSavings), emphasis: true }],
      }}
      sections={sections}
      summary={{
        title: 'About Savings & Investments',
        text: (
          <>
            {'\u2022'} Bank savings are safe and secure{'\n'}
            {'\u2022'} Stock investments can gain or lose value{'\n'}
            {'\u2022'} Total savings = Bank savings + Your accounts + Stock investments{'\n'}
            {'\u2022'} Monitor your investments regularly{'\n'}
            {'\u2022'} Diversify your portfolio to reduce risk
          </>
        ),
      }}
    />
  );
}
