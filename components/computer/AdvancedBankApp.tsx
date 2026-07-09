/**
 * AdvancedBankApp — desktop banking screen.
 *
 * Remake (STATE_VERSION 14). Replaces the 3,295-LOC IAP-gated version with a
 * credit-score-driven banking sim:
 *   - Multi-account (checking, savings, HY savings, CDs, money market)
 *   - Credit score gauge with payment-history + utilization breakdown
 *   - Loans quoted from credit score (not hardcoded), with DTI gating
 *   - Credit cards gated by credit score (not by IAP)
 *   - Bill-pay rules with auto-debit + late-payment penalties
 *   - Savings goals
 *   - Budget breakdown by category
 *   - Net-worth aggregate across accounts + stocks + crypto + real estate
 *
 * State lives at `gameState.banking`; mutations go through BankingActions /
 * LoanActions. Weekly auto-pay, savings interest, and credit-score recompute
 * happen in lib/banking/weeklyTick.ts (called from GameActionsContext.nextWeek).
 */

import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import {
  ArrowLeft,
  Wallet,
  PiggyBank,
  CreditCard as CardIcon,
  Receipt,
  Target,
  BarChart3,
  Plus,
  TrendingUp,
} from 'lucide-react-native';
import { useGame } from '@/contexts/GameContext';
import { BankAccount, BudgetCategory, CreditCardTier, SavingsGoalCategory } from '@/contexts/game/types';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ErrorBoundary from '@/components/ErrorBoundary';
import { responsiveFontSize, responsiveSpacing, responsiveBorderRadius, scale, getTabBarSafePadding } from '@/utils/scaling';
import { getThemeColors, accent } from '@/lib/config/theme';
import { initialGameState } from '@/contexts/game/initialState';

import EconomyEventBanner from '@/components/shared/EconomyEventBanner';
import CreditScoreGauge from '@/components/banking/CreditScoreGauge';
import AccountRow from '@/components/banking/AccountRow';
import LoanRow from '@/components/banking/LoanRow';
import CreditCardRow from '@/components/banking/CreditCardRow';
import BillPayRow from '@/components/banking/BillPayRow';
import SavingsGoalCard from '@/components/banking/SavingsGoalCard';
import BudgetBreakdown from '@/components/banking/BudgetBreakdown';
import AmountInputModal from '@/components/banking/AmountInputModal';
import OpenAccountModal from '@/components/banking/OpenAccountModal';
import LoanQuoteModal from '@/components/banking/LoanQuoteModal';
import ApplyCardModal from '@/components/banking/ApplyCardModal';
import AddBillModal from '@/components/banking/AddBillModal';

import {
  depositCashToAccount,
  withdrawCashFromAccount,
  closeBankAccount,
  toggleBill,
  openNewAccount,
  applyForCard,
  payDownCard,
  addBill,
  removeBill,
  createSavingsGoal,
  contributeToSavingsGoal,
} from '@/contexts/game/actions/BankingActions';
import { acceptLoan, prepayLoan, refinanceLoan } from '@/contexts/game/actions/LoanActions';

type Tab = 'overview' | 'accounts' | 'borrow' | 'budget';

interface AdvancedBankAppProps {
  onBack: () => void;
}

const TABS: { id: Tab; label: string; icon: React.ComponentType<{ size: number; color: string }> }[] = [
  { id: 'overview', label: 'Overview', icon: BarChart3 },
  { id: 'accounts', label: 'Accounts', icon: Wallet },
  { id: 'borrow', label: 'Borrow', icon: CardIcon },
  { id: 'budget', label: 'Budget', icon: Receipt },
];

function formatMoney(n: number): string {
  if (!isFinite(n)) return '$0';
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${n < 0 ? '-' : ''}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 10_000) return `${n < 0 ? '-' : ''}$${(abs / 1000).toFixed(1)}k`;
  return `$${Math.round(n).toLocaleString()}`;
}

function AdvancedBankAppInner({ onBack }: AdvancedBankAppProps) {
  const { gameState, setGameState, saveGame } = useGame();
  const insets = useSafeAreaInsets();
  const darkMode = !!gameState.settings?.darkMode;
  const theme = getThemeColors(darkMode);
  const banking = gameState.banking ?? initialGameState.banking!;

  const [activeTab, setActiveTab] = useState<Tab>('overview');

  // --- Modals ---------------------------------------------------------------
  const [depositTarget, setDepositTarget] = useState<BankAccount | null>(null);
  const [withdrawTarget, setWithdrawTarget] = useState<BankAccount | null>(null);
  const [showOpenAccount, setShowOpenAccount] = useState(false);
  const [showLoanQuote, setShowLoanQuote] = useState(false);
  const [showApplyCard, setShowApplyCard] = useState(false);
  const [showAddBill, setShowAddBill] = useState(false);
  const [addGoalPick, setAddGoalPick] = useState<{ name: string; category: SavingsGoalCategory } | null>(null);
  const [contributeGoalId, setContributeGoalId] = useState<string | null>(null);
  const [prepayLoanId, setPrepayLoanId] = useState<string | null>(null);
  const [payCardId, setPayCardId] = useState<string | null>(null);

  // --- Derived values -------------------------------------------------------
  const cash = gameState.stats?.money ?? 0;
  const totalBank = banking.accounts.reduce((s, a) => s + a.balance, 0);
  const totalCardDebt = banking.creditCards.reduce((s, c) => s + c.balance, 0);
  const totalLoanDebt = (gameState.loans ?? []).reduce((s, l) => s + l.remaining, 0);

  // Net worth = cash + bank + stocks + crypto + real-estate equity - debts
  const netWorth = useMemo(() => {
    let nw = cash + totalBank - totalCardDebt - totalLoanDebt;
    const stocks = gameState.stocks?.holdings ?? [];
    for (const h of stocks) nw += h.shares * h.currentPrice;
    const cryptos = gameState.cryptos ?? [];
    for (const c of cryptos) nw += (c.owned ?? 0) * (c.price ?? 0);
    const re = gameState.realEstate ?? [];
    for (const p of re) {
      if (p.owned) nw += p.currentValue ?? p.price ?? 0;
    }
    return nw;
  }, [cash, totalBank, totalCardDebt, totalLoanDebt, gameState.stocks, gameState.cryptos, gameState.realEstate]);

  // Weekly income approximation for the loan quote DTI gate.
  const weeklyIncome = useMemo(() => {
    let income = 0;
    const job = (gameState.careers ?? []).find((c: any) => c?.id === gameState.currentJob && c?.accepted);
    if (job?.levels && job.level != null) {
      const safeLevel = Math.max(0, Math.min(job.level, job.levels.length - 1));
      income += job.levels[safeLevel]?.salary ?? 0;
    }
    for (const co of (gameState.companies ?? [])) income += co.weeklyIncome ?? 0;
    for (const rel of (gameState.relationships ?? [])) {
      if (rel?.income && (rel.type === 'partner' || rel.type === 'spouse') && rel.relationshipScore >= 50) {
        income += Math.round(rel.income * 0.25);
      }
    }
    return income;
  }, [gameState.careers, gameState.currentJob, gameState.companies, gameState.relationships]);

  const queueSave = useCallback(() => {
    saveGame().catch(() => {
      // Errors are surfaced via the existing logger; non-fatal in the UI.
    });
  }, [saveGame]);


  // Loan tap → choose Prepay or Refinance. Refinance re-prices the APR from
  // the CURRENT credit score (and adds a hard inquiry), so a player who has
  // built credit since taking the loan can cut their rate — this action
  // existed but was never wired to any button.
  const openLoanActions = useCallback((loan: { id: string; name?: string; type: string; rateAPR: number }) => {
    Alert.alert(
      loan.name || 'Loan',
      `Current rate: ${(loan.rateAPR * 100).toFixed(2)}% APR`,
      [
        { text: 'Prepay…', onPress: () => setPrepayLoanId(loan.id) },
        {
          text: 'Refinance',
          onPress: () => {
            Alert.alert(
              'Refinance term',
              'Re-price this loan at your current credit score. Adds a hard inquiry.',
              [
                { text: '1 year (52 wks)', onPress: () => { refinanceLoan(setGameState, loan.id, 52); queueSave(); } },
                { text: '2 years (104 wks)', onPress: () => { refinanceLoan(setGameState, loan.id, 104); queueSave(); } },
                { text: 'Cancel', style: 'cancel' },
              ]
            );
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  }, [setGameState, queueSave]);

  const confirmCloseAccount = useCallback(
    (acct: BankAccount) => {
      Alert.alert(
        'Close account?',
        `Close "${acct.name}"? Its balance of ${formatMoney(acct.balance)} will be returned to your cash.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Close Account',
            style: 'destructive',
            onPress: () => {
              closeBankAccount(setGameState, acct.id);
              queueSave();
            },
          },
        ]
      );
    },
    [setGameState, queueSave]
  );

  // --- Render helpers -------------------------------------------------------
  const renderOverview = () => {
    const checking = banking.accounts.find((a) => a.type === 'checking');

    return (
      <View style={{ gap: responsiveSpacing.md }}>
        <EconomyEventBanner context="banking" />
        <CreditScoreGauge score={banking.creditScore.score} band={banking.creditScore.band} darkMode={darkMode} />

        <View style={styles.statGrid}>
          <StatCard theme={theme} icon={Wallet} label="Cash" value={formatMoney(cash)} />
          <StatCard theme={theme} icon={PiggyBank} label="In bank" value={formatMoney(totalBank)} />
          <StatCard theme={theme} icon={TrendingUp} label="Net worth" value={formatMoney(netWorth)} />
          <StatCard theme={theme} icon={CardIcon} label="Total debt" value={formatMoney(totalCardDebt + totalLoanDebt)} negative={totalCardDebt + totalLoanDebt > 0} />
        </View>

        <SectionTitle theme={theme}>Accounts</SectionTitle>
        {banking.accounts.slice(0, 3).map((acct) => (
          <AccountRow key={acct.id} account={acct} currentWeek={gameState.weeksLived} darkMode={darkMode} />
        ))}
        {banking.accounts.length > 3 && (
          <TouchableOpacity onPress={() => setActiveTab('accounts')}>
            <Text style={[styles.linkText, { color: theme.textSecondary }]}>
              See all {banking.accounts.length} accounts →
            </Text>
          </TouchableOpacity>
        )}

        {checking && (gameState.loans ?? []).length > 0 && (
          <>
            <SectionTitle theme={theme}>Active loans</SectionTitle>
            {(gameState.loans ?? []).slice(0, 2).map((loan) => (
              <LoanRow key={loan.id} loan={loan} darkMode={darkMode} onPress={() => openLoanActions(loan)} />
            ))}
          </>
        )}

        <CreditScoreBreakdown theme={theme} breakdown={banking.creditScore.componentBreakdown} />
      </View>
    );
  };

  const renderAccounts = () => (
    <View style={{ gap: responsiveSpacing.md }}>
      <View style={styles.headerRow}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>Your Accounts</Text>
        <TouchableOpacity
          onPress={() => setShowOpenAccount(true)}
          style={[styles.addBtn, { backgroundColor: accent.info }]}
        >
          <Plus size={scale(14)} color="white" />
          <Text style={styles.addBtnText}>Open</Text>
        </TouchableOpacity>
      </View>
      {banking.accounts.map((acct) => (
        <AccountRow
          key={acct.id}
          account={acct}
          currentWeek={gameState.weeksLived}
          darkMode={darkMode}
          onPress={() => setDepositTarget(acct)}
          onWithdraw={() => setWithdrawTarget(acct)}
          onClose={() => confirmCloseAccount(acct)}
        />
      ))}

      <View style={styles.headerRow}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>Savings Goals</Text>
        <TouchableOpacity
          onPress={() => Alert.alert('What are you saving for?', undefined, [
              { text: 'Emergency Fund', onPress: () => setAddGoalPick({ name: 'Emergency Fund', category: 'emergency' }) },
              { text: 'House', onPress: () => setAddGoalPick({ name: 'House Fund', category: 'house' }) },
              {
                text: 'More…',
                onPress: () =>
                  Alert.alert('What are you saving for?', undefined, [
                    { text: 'Vacation', onPress: () => setAddGoalPick({ name: 'Vacation', category: 'vacation' }) },
                    { text: 'Retirement', onPress: () => setAddGoalPick({ name: 'Retirement', category: 'retirement' }) },
                    { text: 'Custom Goal', onPress: () => setAddGoalPick({ name: 'Custom Goal', category: 'other' }) },
                  ]),
              },
            ])}
          style={[styles.addBtn, { backgroundColor: accent.success }]}
        >
          <Plus size={scale(14)} color="white" />
          <Text style={styles.addBtnText}>New</Text>
        </TouchableOpacity>
      </View>
      {banking.savingsGoals.length === 0 ? (
        <Text style={[styles.emptyText, { color: theme.textMuted }]}>
          No savings goals yet. Set one to track progress toward an emergency fund, a down payment, or retirement.
        </Text>
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
    </View>
  );

  const renderBorrow = () => (
    <View style={{ gap: responsiveSpacing.md }}>
      <View style={styles.headerRow}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>Loans</Text>
        <TouchableOpacity
          onPress={() => setShowLoanQuote(true)}
          style={[styles.addBtn, { backgroundColor: accent.info }]}
        >
          <Plus size={scale(14)} color="white" />
          <Text style={styles.addBtnText}>Apply</Text>
        </TouchableOpacity>
      </View>
      {(gameState.loans ?? []).length === 0 ? (
        <Text style={[styles.emptyText, { color: theme.textMuted }]}>No active loans.</Text>
      ) : (
        (gameState.loans ?? []).map((loan) => (
          <LoanRow key={loan.id} loan={loan} darkMode={darkMode} onPress={() => openLoanActions(loan)} />
        ))
      )}

      <View style={styles.headerRow}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>Credit Cards</Text>
        <TouchableOpacity
          onPress={() => setShowApplyCard(true)}
          style={[styles.addBtn, { backgroundColor: accent.info }]}
        >
          <Plus size={scale(14)} color="white" />
          <Text style={styles.addBtnText}>Apply</Text>
        </TouchableOpacity>
      </View>
      {banking.creditCards.length === 0 ? (
        <Text style={[styles.emptyText, { color: theme.textMuted }]}>
          No cards yet. Apply for one to build credit history (eligibility depends on your score).
        </Text>
      ) : (
        banking.creditCards.map((c) => (
          <CreditCardRow key={c.id} card={c} darkMode={darkMode} onPress={() => setPayCardId(c.id)} />
        ))
      )}
    </View>
  );

  const renderBudget = () => (
    <View style={{ gap: responsiveSpacing.md }}>
      <SectionTitle theme={theme}>Recent Spending</SectionTitle>
      <BudgetBreakdown buckets={banking.budgetSpend} darkMode={darkMode} />

      <View style={styles.headerRow}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>Auto-Pay Rules</Text>
        <TouchableOpacity
          onPress={() => setShowAddBill(true)}
          style={[styles.addBtn, { backgroundColor: accent.info }]}
        >
          <Plus size={scale(14)} color="white" />
          <Text style={styles.addBtnText}>Add</Text>
        </TouchableOpacity>
      </View>
      {banking.billPayRules.length === 0 ? (
        <Text style={[styles.emptyText, { color: theme.textMuted }]}>
          No bills set up. Add a recurring rule and we&apos;ll auto-debit it each week from your chosen account.
        </Text>
      ) : (
        banking.billPayRules.map((rule) => (
          <BillPayRow
            key={rule.id}
            rule={rule}
            currentWeek={gameState.weeksLived}
            darkMode={darkMode}
            onToggle={() => {
              toggleBill(setGameState, rule.id);
              queueSave();
            }}
            onDelete={() => {
              removeBill(setGameState, rule.id);
              queueSave();
            }}
          />
        ))
      )}
    </View>
  );

  // --- Frame ---------------------------------------------------------------
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

      <View style={[styles.tabBar, { borderBottomColor: theme.border }]}>
        {TABS.map((t) => {
          const active = activeTab === t.id;
          const Icon = t.icon;
          return (
            <TouchableOpacity
              key={t.id}
              onPress={() => setActiveTab(t.id)}
              style={[styles.tab, active && { borderBottomColor: accent.info }]}
            >
              <Icon size={scale(16)} color={active ? accent.info : theme.textMuted} />
              <Text style={[styles.tabText, { color: active ? accent.info : theme.textMuted }]}>{t.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: responsiveSpacing.md, paddingBottom: getTabBarSafePadding(insets.bottom) }}
      >
        {activeTab === 'overview' && renderOverview()}
        {activeTab === 'accounts' && renderAccounts()}
        {activeTab === 'borrow' && renderBorrow()}
        {activeTab === 'budget' && renderBudget()}
      </ScrollView>

      {/* Modals -------------------------------------------------------------- */}
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

      {/* Goal creator: pick what you're saving for (named + categorized so the
          goals list is readable), then the target amount. */}
      <AmountInputModal
        visible={!!addGoalPick}
        title={addGoalPick ? `Goal: ${addGoalPick.name}` : 'Set a savings goal'}
        subtitle="How much do you want to save?"
        confirmLabel="Create Goal"
        presets={[1000, 5000, 25000]}
        darkMode={darkMode}
        onClose={() => setAddGoalPick(null)}
        onConfirm={(amt) => {
          if (addGoalPick) {
            createSavingsGoal(setGameState, {
              name: addGoalPick.name,
              targetAmount: amt,
              category: addGoalPick.category,
            });
            queueSave();
          }
          setAddGoalPick(null);
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
          } else if (prepayLoanId && !checking) {
            Alert.alert('No checking account', 'Open a checking account first — loan payments are drawn from checking.');
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
          } else if (payCardId && !checking) {
            Alert.alert('No checking account', 'Open a checking account first — card payments are drawn from checking.');
          }
          setPayCardId(null);
        }}
      />

    </View>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  theme,
  negative,
}: {
  icon: React.ComponentType<{ size: number; color: string }>;
  label: string;
  value: string;
  theme: ReturnType<typeof getThemeColors>;
  negative?: boolean;
}) {
  return (
    <View style={[styles.statCard, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
      <Icon size={scale(14)} color={theme.textMuted} />
      <Text style={[styles.statLabel, { color: theme.textMuted }]}>{label}</Text>
      <Text style={[styles.statValue, { color: negative ? accent.danger : theme.text }]}>{value}</Text>
    </View>
  );
}

function SectionTitle({ theme, children }: { theme: ReturnType<typeof getThemeColors>; children: React.ReactNode }) {
  return <Text style={[styles.sectionTitle, { color: theme.text }]}>{children}</Text>;
}

function CreditScoreBreakdown({
  theme,
  breakdown,
}: {
  theme: ReturnType<typeof getThemeColors>;
  breakdown: { paymentHistory: number; utilization: number; accountAge: number; creditMix: number; inquiries: number };
}) {
  const rows: { label: string; value: number; weight: string }[] = [
    { label: 'Payment history', value: breakdown.paymentHistory, weight: '35%' },
    { label: 'Credit utilization', value: breakdown.utilization, weight: '30%' },
    { label: 'Account age', value: breakdown.accountAge, weight: '15%' },
    { label: 'Credit mix', value: breakdown.creditMix, weight: '10%' },
    { label: 'Recent inquiries', value: breakdown.inquiries, weight: '10%' },
  ];
  return (
    <View style={[styles.breakdownCard, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
      <Text style={[styles.sectionTitle, { color: theme.text }]}>Score breakdown</Text>
      {rows.map((r) => (
        <View key={r.label} style={styles.breakdownRow}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.breakdownLabel, { color: theme.text }]}>
              {r.label} <Text style={{ color: theme.textMuted }}>· {r.weight}</Text>
            </Text>
            <View style={[styles.miniTrack, { backgroundColor: theme.border }]}>
              <View
                style={[
                  styles.miniFill,
                  {
                    width: `${Math.max(0, Math.min(100, r.value))}%`,
                    backgroundColor: r.value >= 70 ? accent.success : r.value >= 40 ? '#f59e0b' : accent.danger,
                  },
                ]}
              />
            </View>
          </View>
          <Text style={[styles.breakdownValue, { color: theme.text }]}>{Math.round(r.value)}</Text>
        </View>
      ))}
    </View>
  );
}

export default function AdvancedBankApp(props: AdvancedBankAppProps) {
  return (
    <ErrorBoundary>
      <AdvancedBankAppInner {...props} />
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
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: responsiveSpacing.sm,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabText: { fontSize: responsiveFontSize.sm, fontWeight: '600' },
  statGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: responsiveSpacing.sm,
  },
  statCard: {
    flex: 1,
    minWidth: '46%',
    padding: responsiveSpacing.md,
    borderRadius: responsiveBorderRadius.lg,
    borderWidth: 1,
    gap: 2,
  },
  statLabel: { fontSize: responsiveFontSize.xs, fontWeight: '600' },
  statValue: { fontSize: responsiveFontSize.lg, fontWeight: '800' },
  sectionTitle: {
    fontSize: responsiveFontSize.md,
    fontWeight: '700',
    marginTop: responsiveSpacing.xs,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: responsiveSpacing.xs,
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
    paddingVertical: responsiveSpacing.lg,
  },
  linkText: {
    fontSize: responsiveFontSize.sm,
    fontWeight: '600',
    textAlign: 'center',
    paddingVertical: responsiveSpacing.sm,
  },
  breakdownCard: {
    padding: responsiveSpacing.md,
    borderRadius: responsiveBorderRadius.lg,
    borderWidth: 1,
    gap: responsiveSpacing.sm,
  },
  breakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: responsiveSpacing.sm,
  },
  breakdownLabel: { fontSize: responsiveFontSize.sm, fontWeight: '600' },
  breakdownValue: { fontSize: responsiveFontSize.md, fontWeight: '700', minWidth: scale(28), textAlign: 'right' },
  miniTrack: {
    height: scale(4),
    borderRadius: responsiveBorderRadius.full,
    overflow: 'hidden',
    marginTop: 4,
  },
  miniFill: {
    height: '100%',
    borderRadius: responsiveBorderRadius.full,
  },
});
