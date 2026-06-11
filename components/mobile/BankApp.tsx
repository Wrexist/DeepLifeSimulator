/**
 * BankApp — mobile (phone-style) banking screen.
 *
 * Remake (STATE_VERSION 14). Slim mobile counterpart to AdvancedBankApp:
 * single scrolling view with the most-used flows surfaced first
 * (overview → accounts → borrow → bills).
 *
 * Shares all primitives and modals with AdvancedBankApp under
 * `components/banking/*` and `lib/banking/*` — no logic duplication.
 */

import React, { useState, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import {
  ArrowLeft,
  Wallet,
  PiggyBank,
  TrendingUp,
  Plus,
} from 'lucide-react-native';
import { useGame } from '@/contexts/GameContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ErrorBoundary from '@/components/ErrorBoundary';
import { responsiveFontSize, responsiveSpacing, responsiveBorderRadius, scale } from '@/utils/scaling';
import { getThemeColors, accent } from '@/lib/config/theme';
import { initialGameState } from '@/contexts/game/initialState';

import CreditScoreGauge from '@/components/banking/CreditScoreGauge';
import AccountRow from '@/components/banking/AccountRow';
import LoanRow from '@/components/banking/LoanRow';
import CreditCardRow from '@/components/banking/CreditCardRow';
import BillPayRow from '@/components/banking/BillPayRow';
import SavingsGoalCard from '@/components/banking/SavingsGoalCard';
import AmountInputModal from '@/components/banking/AmountInputModal';
import OpenAccountModal from '@/components/banking/OpenAccountModal';
import LoanQuoteModal from '@/components/banking/LoanQuoteModal';
import ApplyCardModal from '@/components/banking/ApplyCardModal';
import AddBillModal from '@/components/banking/AddBillModal';

import { BankAccount, BudgetCategory, CreditCardTier, SavingsGoalCategory } from '@/contexts/game/types';
import {
  depositCashToAccount,
  withdrawCashFromAccount,
  openNewAccount,
  applyForCard,
  payDownCard,
  addBill,
  removeBill,
  contributeToSavingsGoal,
  createSavingsGoal,
} from '@/contexts/game/actions/BankingActions';
import { acceptLoan, prepayLoan } from '@/contexts/game/actions/LoanActions';

interface BankAppProps {
  onBack: () => void;
}

function formatMoney(n: number): string {
  if (!isFinite(n)) return '$0';
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${n < 0 ? '-' : ''}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 10_000) return `${n < 0 ? '-' : ''}$${(abs / 1000).toFixed(1)}k`;
  return `$${Math.round(n).toLocaleString()}`;
}

function BankAppInner({ onBack }: BankAppProps) {
  const { gameState, setGameState, saveGame } = useGame();
  const insets = useSafeAreaInsets();
  const darkMode = !!gameState.settings?.darkMode;
  const theme = getThemeColors(darkMode);
  const banking = gameState.banking ?? initialGameState.banking!;

  const [depositTarget, setDepositTarget] = useState<BankAccount | null>(null);
  const [withdrawTarget, setWithdrawTarget] = useState<BankAccount | null>(null);
  const [showOpenAccount, setShowOpenAccount] = useState(false);
  const [showLoanQuote, setShowLoanQuote] = useState(false);
  const [showApplyCard, setShowApplyCard] = useState(false);
  const [showAddBill, setShowAddBill] = useState(false);
  const [showAddGoal, setShowAddGoal] = useState(false);
  const [contributeGoalId, setContributeGoalId] = useState<string | null>(null);
  const [prepayLoanId, setPrepayLoanId] = useState<string | null>(null);
  const [payCardId, setPayCardId] = useState<string | null>(null);

  const cash = gameState.stats?.money ?? 0;
  const totalBank = banking.accounts.reduce((s, a) => s + a.balance, 0);
  const totalDebt =
    banking.creditCards.reduce((s, c) => s + c.balance, 0) +
    (gameState.loans ?? []).reduce((s, l) => s + l.remaining, 0);

  const weeklyIncome = useMemo(() => {
    let income = 0;
    const job = (gameState.careers ?? []).find((c: any) => c?.id === gameState.currentJob && c?.accepted);
    if (job?.levels && job.level != null) {
      const safeLevel = Math.max(0, Math.min(job.level, job.levels.length - 1));
      income += job.levels[safeLevel]?.salary ?? 0;
    }
    for (const co of (gameState.companies ?? []) as any[]) income += co.weeklyIncome ?? 0;
    return income;
  }, [gameState.careers, gameState.currentJob, gameState.companies]);

  const queueSave = useCallback(() => {
    saveGame().catch(() => {});
  }, [saveGame]);

  return (
    <View style={[styles.root, { backgroundColor: theme.background, paddingTop: 0 }]}>
      <View style={[styles.topBar, { borderBottomColor: theme.border }]}>
        <TouchableOpacity onPress={onBack} hitSlop={10} style={styles.backBtn}>
          <ArrowLeft size={scale(22)} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.appTitle, { color: theme.text }]}>Bank</Text>
        <View style={[styles.scoreChip, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
          <Text style={[styles.scoreChipText, { color: theme.text }]}>{banking.creditScore.score}</Text>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          padding: responsiveSpacing.md,
          paddingBottom: insets.bottom + responsiveSpacing['2xl'],
          gap: responsiveSpacing.md,
        }}
      >
        <CreditScoreGauge
          score={banking.creditScore.score}
          band={banking.creditScore.band}
          darkMode={darkMode}
          compact
        />

        <View style={styles.statRow}>
          <Stat theme={theme} icon={Wallet} label="Cash" value={formatMoney(cash)} />
          <Stat theme={theme} icon={PiggyBank} label="Bank" value={formatMoney(totalBank)} />
          <Stat theme={theme} icon={TrendingUp} label="Debt" value={formatMoney(totalDebt)} negative={totalDebt > 0} />
        </View>

        <SectionHeader theme={theme} title="Accounts" onAdd={() => setShowOpenAccount(true)} addLabel="Open" />
        {banking.accounts.map((acct) => (
          <AccountRow
            key={acct.id}
            account={acct}
            currentWeek={gameState.weeksLived}
            darkMode={darkMode}
            onPress={() => setDepositTarget(acct)}
          />
        ))}

        <SectionHeader theme={theme} title="Loans" onAdd={() => setShowLoanQuote(true)} addLabel="Apply" />
        {(gameState.loans ?? []).length === 0 ? (
          <EmptyText theme={theme}>No active loans.</EmptyText>
        ) : (
          (gameState.loans ?? []).map((loan) => (
            <LoanRow key={loan.id} loan={loan} darkMode={darkMode} onPress={() => setPrepayLoanId(loan.id)} />
          ))
        )}

        <SectionHeader theme={theme} title="Credit Cards" onAdd={() => setShowApplyCard(true)} addLabel="Apply" />
        {banking.creditCards.length === 0 ? (
          <EmptyText theme={theme}>No cards yet.</EmptyText>
        ) : (
          banking.creditCards.map((c) => (
            <CreditCardRow key={c.id} card={c} darkMode={darkMode} onPress={() => setPayCardId(c.id)} />
          ))
        )}

        <SectionHeader theme={theme} title="Savings Goals" onAdd={() => setShowAddGoal(true)} addLabel="New" />
        {banking.savingsGoals.length === 0 ? (
          <EmptyText theme={theme}>No goals yet.</EmptyText>
        ) : (
          banking.savingsGoals.map((g) => (
            <SavingsGoalCard
              key={g.id}
              goal={g}
              darkMode={darkMode}
              onContribute={() => setContributeGoalId(g.id)}
            />
          ))
        )}

        <SectionHeader theme={theme} title="Auto-Pay" onAdd={() => setShowAddBill(true)} addLabel="Add" />
        {banking.billPayRules.length === 0 ? (
          <EmptyText theme={theme}>No bills set up.</EmptyText>
        ) : (
          banking.billPayRules.map((rule) => (
            <BillPayRow
              key={rule.id}
              rule={rule}
              currentWeek={gameState.weeksLived}
              darkMode={darkMode}
              onDelete={() => {
                removeBill(setGameState, rule.id);
                queueSave();
              }}
            />
          ))
        )}
      </ScrollView>

      <AmountInputModal
        visible={!!depositTarget}
        title={`Deposit to ${depositTarget?.name ?? ''}`}
        subtitle={`Cash on hand: ${formatMoney(cash)}`}
        confirmLabel="Deposit"
        maxAmount={cash}
        presets={[100, 500, 1000]}
        darkMode={darkMode}
        onClose={() => setDepositTarget(null)}
        onConfirm={(amt) => {
          if (depositTarget) {
            depositCashToAccount(setGameState, depositTarget.id, amt);
            queueSave();
          }
          setDepositTarget(null);
        }}
      />

      <AmountInputModal
        visible={!!withdrawTarget}
        title={`Withdraw from ${withdrawTarget?.name ?? ''}`}
        subtitle={`Balance: ${formatMoney(withdrawTarget?.balance ?? 0)}`}
        confirmLabel="Withdraw"
        maxAmount={withdrawTarget?.balance ?? 0}
        presets={[100, 500, 1000]}
        darkMode={darkMode}
        onClose={() => setWithdrawTarget(null)}
        onConfirm={(amt) => {
          if (withdrawTarget) {
            withdrawCashFromAccount(setGameState, withdrawTarget.id, amt);
            queueSave();
          }
          setWithdrawTarget(null);
        }}
      />

      <OpenAccountModal
        visible={showOpenAccount}
        availableCash={cash}
        darkMode={darkMode}
        currentWeek={gameState.weeksLived}
        onClose={() => setShowOpenAccount(false)}
        onOpen={(spec) => {
          openNewAccount(setGameState, spec);
          queueSave();
          setShowOpenAccount(false);
        }}
      />

      <LoanQuoteModal
        visible={showLoanQuote}
        gameState={gameState}
        weeklyIncome={weeklyIncome}
        darkMode={darkMode}
        onClose={() => setShowLoanQuote(false)}
        onAccept={(spec) => {
          acceptLoan(setGameState, { ...spec, weeklyIncome });
          queueSave();
          setShowLoanQuote(false);
        }}
      />

      <ApplyCardModal
        visible={showApplyCard}
        creditScore={banking.creditScore.score}
        darkMode={darkMode}
        onClose={() => setShowApplyCard(false)}
        onApply={(tier: CreditCardTier, baseAPR: number) => {
          applyForCard(setGameState, tier, baseAPR);
          queueSave();
          setShowApplyCard(false);
        }}
      />

      <AddBillModal
        visible={showAddBill}
        accounts={banking.accounts}
        currentWeek={gameState.weeksLived}
        darkMode={darkMode}
        onClose={() => setShowAddBill(false)}
        onAdd={(rule: {
          label: string;
          category: BudgetCategory;
          amount: number;
          fromAccountId: string;
          cadence: 'weekly' | 'monthly';
          nextDueWeek: number;
          source: 'subscription' | 'utility' | 'manual';
        }) => {
          addBill(setGameState, rule);
          queueSave();
          setShowAddBill(false);
        }}
      />

      <AmountInputModal
        visible={showAddGoal}
        title="Set a savings goal"
        subtitle="How much do you want to save?"
        confirmLabel="Create Goal"
        presets={[1000, 5000, 25000]}
        darkMode={darkMode}
        onClose={() => setShowAddGoal(false)}
        onConfirm={(amt) => {
          createSavingsGoal(setGameState, {
            name: 'Savings Goal',
            targetAmount: amt,
            category: 'other' as SavingsGoalCategory,
          });
          queueSave();
          setShowAddGoal(false);
        }}
      />

      <AmountInputModal
        visible={!!contributeGoalId}
        title="Contribute to goal"
        subtitle={`Cash on hand: ${formatMoney(cash)}`}
        confirmLabel="Contribute"
        maxAmount={cash}
        presets={[50, 200, 500]}
        darkMode={darkMode}
        onClose={() => setContributeGoalId(null)}
        onConfirm={(amt) => {
          if (contributeGoalId) {
            contributeToSavingsGoal(setGameState, contributeGoalId, amt);
            queueSave();
          }
          setContributeGoalId(null);
        }}
      />

      <AmountInputModal
        visible={!!prepayLoanId}
        title="Prepay loan"
        subtitle="Pays down principal directly. No prepayment penalty."
        confirmLabel="Prepay"
        maxAmount={cash}
        presets={[100, 500, 1000]}
        darkMode={darkMode}
        onClose={() => setPrepayLoanId(null)}
        onConfirm={(amt) => {
          const checking = banking.accounts.find((a) => a.type === 'checking');
          if (prepayLoanId && checking) {
            prepayLoan(setGameState, prepayLoanId, checking.id, amt);
            queueSave();
          }
          setPrepayLoanId(null);
        }}
      />

      <AmountInputModal
        visible={!!payCardId}
        title="Pay credit card"
        subtitle={`Cash on hand: ${formatMoney(cash)}`}
        confirmLabel="Pay"
        maxAmount={cash}
        presets={[100, 500, 1000]}
        darkMode={darkMode}
        onClose={() => setPayCardId(null)}
        onConfirm={(amt) => {
          const checking = banking.accounts.find((a) => a.type === 'checking');
          if (payCardId && checking) {
            payDownCard(setGameState, payCardId, checking.id, amt);
            queueSave();
          }
          setPayCardId(null);
        }}
      />

      {/* Silence unused-var warning for setWithdrawTarget kept for symmetry with desktop. */}
      {false && <Text>{String(setWithdrawTarget)}</Text>}
    </View>
  );
}

function Stat({
  theme,
  icon: Icon,
  label,
  value,
  negative,
}: {
  theme: ReturnType<typeof getThemeColors>;
  icon: React.ComponentType<{ size: number; color: string }>;
  label: string;
  value: string;
  negative?: boolean;
}) {
  return (
    <View style={[styles.statCard, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
      <Icon size={scale(14)} color={theme.textMuted} />
      <Text style={[styles.statLabel, { color: theme.textMuted }]}>{label}</Text>
      <Text
        style={[styles.statValue, { color: negative ? accent.danger : theme.text }]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.65}
      >
        {value}
      </Text>
    </View>
  );
}

function SectionHeader({
  theme,
  title,
  onAdd,
  addLabel,
}: {
  theme: ReturnType<typeof getThemeColors>;
  title: string;
  onAdd?: () => void;
  addLabel?: string;
}) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={[styles.sectionTitle, { color: theme.text }]}>{title}</Text>
      {onAdd && (
        <TouchableOpacity onPress={onAdd} style={[styles.addBtn, { backgroundColor: accent.info }]}>
          <Plus size={scale(12)} color="white" />
          <Text style={styles.addBtnText}>{addLabel ?? 'Add'}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

function EmptyText({ theme, children }: { theme: ReturnType<typeof getThemeColors>; children: React.ReactNode }) {
  return <Text style={[styles.emptyText, { color: theme.textMuted }]}>{children}</Text>;
}

export default function BankApp(props: BankAppProps) {
  return (
    <ErrorBoundary>
      <BankAppInner {...props} />
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: responsiveSpacing.md,
    paddingVertical: responsiveSpacing.sm,
    borderBottomWidth: 1,
    gap: responsiveSpacing.sm,
  },
  backBtn: { padding: responsiveSpacing.xs },
  appTitle: { flex: 1, fontSize: responsiveFontSize.lg, fontWeight: '700' },
  scoreChip: {
    paddingHorizontal: responsiveSpacing.sm,
    paddingVertical: 4,
    borderRadius: responsiveBorderRadius.full,
    borderWidth: 1,
  },
  scoreChipText: { fontSize: responsiveFontSize.sm, fontWeight: '700' },
  statRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: responsiveSpacing.sm,
  },
  statCard: {
    // 2-per-row wrap: money labels like "$1,234,567" don't fit at ~95pt (3-up).
    flexBasis: '48%',
    flexGrow: 1,
    padding: responsiveSpacing.sm,
    borderRadius: responsiveBorderRadius.lg,
    borderWidth: 1,
    gap: 2,
  },
  statLabel: { fontSize: responsiveFontSize.xs, fontWeight: '600' },
  statValue: { fontSize: responsiveFontSize.md, fontWeight: '800' },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: responsiveSpacing.sm,
  },
  sectionTitle: {
    fontSize: responsiveFontSize.md,
    fontWeight: '700',
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: responsiveSpacing.sm,
    paddingVertical: responsiveSpacing.xs,
    borderRadius: responsiveBorderRadius.full,
  },
  addBtnText: { color: 'white', fontSize: responsiveFontSize.xs, fontWeight: '700' },
  emptyText: {
    fontSize: responsiveFontSize.sm,
    textAlign: 'center',
    paddingVertical: responsiveSpacing.md,
  },
});
