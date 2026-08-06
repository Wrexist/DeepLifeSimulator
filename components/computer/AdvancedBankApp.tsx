/**
 * AdvancedBankApp — "Bank Pro" desktop banking screen.
 *
 * Remake (STATE_VERSION 14). Credit-score-driven banking sim rendered with a
 * DESKTOP-BANKING skeleton — deliberately distinct from the phone BankApp's
 * Apple-Wallet card deck:
 *   - A columnar ACCOUNT STATEMENT masthead (Assets / Liabilities / Net worth
 *     side-by-side, divided by vertical rules) instead of a 2×2 stat hero.
 *   - Statement LEDGER sections (grouped cards with a table header + slim rows
 *     separated by hairlines) instead of one elevated card per row.
 *   - A net-worth COMPOSITION ledger that surfaces the stocks / crypto / real-
 *     estate the net-worth figure already sums but the old UI never showed.
 *   - Presentational list→detail sub-views (account statement page, full credit
 *     report page) via local useState routing — no new game mechanics.
 *
 * State lives at `gameState.banking`; mutations go through BankingActions /
 * LoanActions. Weekly auto-pay, savings interest, and credit-score recompute
 * happen in lib/banking/weeklyTick.ts (called from GameActionsContext.nextWeek).
 */

import React, { useState, useMemo, useCallback } from 'react';
import { displayedDepositAPR, depositAPRNote } from '@/lib/banking/displayRates';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import Svg, { Polyline } from 'react-native-svg';
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
  TrendingDown,
  ChevronRight,
  Shield,
  FileText,
  Coins,
  Percent,
  Calendar,
  Clock,
  Lock,
  Landmark,
  Building2,
  LineChart,
  ArrowLeftRight,
} from 'lucide-react-native';
import { useGame } from '@/contexts/GameContext';
import { BankAccount, BudgetCategory, CreditCardTier, SavingsGoalCategory } from '@/contexts/game/types';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ErrorBoundary from '@/components/ErrorBoundary';
import { responsiveFontSize, responsiveSpacing, responsiveBorderRadius, scale, touchTargets, getAppScreenBottomPadding } from '@/utils/scaling';
import { getThemeColors, accent } from '@/lib/config/theme';
import { getGlassCard, getGlassButton, getGlassIconContainer, getPlatformShadows } from '@/utils/glassmorphismStyles';
import LinearGradientFallback from '@/components/fallbacks/LinearGradientFallback';
import { initialGameState } from '@/contexts/game/initialState';
import { MIRRORED_ACCOUNT_IDS, computeStatementNetWorth } from '@/lib/banking/operations';

import EconomyEventBanner from '@/components/shared/EconomyEventBanner';
import CreditScoreGauge from '@/components/banking/CreditScoreGauge';
import AccountRow, { accountPalette, accountTypeLabel } from '@/components/banking/AccountRow';
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
  spendOnCard,
  redeemRewards,
  addBill,
  removeBill,
  createSavingsGoal,
  contributeToSavingsGoal,
  withdrawFromSavingsGoal,
  setBudgetTarget,
  transferBetweenOwnAccounts,
} from '@/contexts/game/actions/BankingActions';
import { acceptLoan, prepayLoan, refinanceLoan } from '@/contexts/game/actions/LoanActions';
import { weeklyCareerSalary } from '@/lib/careers/weeklySalary';
import { clampTaxMult, taxYearOf } from '@/lib/economy/taxLedger';
import { getLifeSkillModifiers } from '@/lib/skillTrees/lifeSkillEffects';
import TaxStatement from '@/components/banking/TaxStatement';

const LinearGradient = LinearGradientFallback;

type Tab = 'overview' | 'accounts' | 'borrow' | 'budget' | 'tax';

/** Local list→detail routing (presentational only — reads existing state). */
type SubView = { kind: 'account'; id: string } | { kind: 'credit' } | null;

interface AdvancedBankAppProps {
  onBack: () => void;
}

const TABS: { id: Tab; label: string; icon: React.ComponentType<{ size: number; color: string }> }[] = [
  { id: 'overview', label: 'Statement', icon: BarChart3 },
  { id: 'accounts', label: 'Accounts', icon: Wallet },
  { id: 'borrow', label: 'Borrow', icon: CardIcon },
  { id: 'budget', label: 'Budget', icon: Receipt },
  { id: 'tax', label: 'Tax', icon: Percent },
];

function formatMoney(n: number): string {
  if (!isFinite(n)) return '$0';
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${n < 0 ? '-' : ''}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 10_000) return `${n < 0 ? '-' : ''}$${(abs / 1000).toFixed(1)}k`;
  return `$${Math.round(n).toLocaleString()}`;
}

function formatMoneyExact(n: number): string {
  if (!isFinite(n)) return '$0';
  return `$${Math.round(n).toLocaleString()}`;
}

function accountGlyph(type: BankAccount['type']) {
  if (type === 'checking') return Wallet;
  if (type === 'cd' || type === 'moneyMarket') return Landmark;
  return PiggyBank;
}

function inquiryLabel(type: 'loan' | 'card' | 'mortgage'): string {
  if (type === 'loan') return 'Loan application';
  if (type === 'mortgage') return 'Mortgage application';
  return 'Credit card application';
}

function loanTypeLabel(type: string): string {
  switch (type) {
    case 'personal': return 'Personal';
    case 'auto': return 'Auto';
    case 'business': return 'Business';
    case 'mortgage': return 'Mortgage';
    default: return 'Loan';
  }
}

function AdvancedBankAppInner({ onBack }: AdvancedBankAppProps) {
  const { gameState, setGameState, saveGame } = useGame();
  const insets = useSafeAreaInsets();
  const darkMode = !!gameState.settings?.darkMode;
  const theme = getThemeColors(darkMode);
  const banking = gameState.banking ?? initialGameState.banking!;

  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [subView, setSubView] = useState<SubView>(null);
  const [sparkWidth, setSparkWidth] = useState(0);

  // --- Modals ---------------------------------------------------------------
  const [depositTarget, setDepositTarget] = useState<BankAccount | null>(null);
  const [withdrawTarget, setWithdrawTarget] = useState<BankAccount | null>(null);
  const [showOpenAccount, setShowOpenAccount] = useState(false);
  const [showLoanQuote, setShowLoanQuote] = useState(false);
  const [showApplyCard, setShowApplyCard] = useState(false);
  const [showAddBill, setShowAddBill] = useState(false);
  const [addGoalPick, setAddGoalPick] = useState<{ name: string; category: SavingsGoalCategory } | null>(null);
  // Second step of goal creation: the weekly auto-contribution.
  //
  // `applySavingsGoals` has swept `goal.autoContribute` every week since it
  // shipped — with a test suite proving asset conservation and idempotent
  // completion — but nothing could ever SET the field, so the sweep ran over
  // `undefined` forever. Collecting it is the whole fix; the machinery behind
  // it already works.
  const [autoGoalPick, setAutoGoalPick] = useState<
    { name: string; category: SavingsGoalCategory; targetAmount: number } | null
  >(null);
  const [contributeGoalId, setContributeGoalId] = useState<string | null>(null);
  // R3-M5: goal money used to be unrecoverable — contributing was a one-way door.
  const [withdrawGoalId, setWithdrawGoalId] = useState<string | null>(null);
  const [prepayLoanId, setPrepayLoanId] = useState<string | null>(null);
  const [payCardId, setPayCardId] = useState<string | null>(null);
  const [chargeCardId, setChargeCardId] = useState<string | null>(null);
  // v22 Wave A: computer-only budget cap picker + account transfer.
  const [budgetTargetCategory, setBudgetTargetCategory] = useState<BudgetCategory | null>(null);
  const [transferFromId, setTransferFromId] = useState<string | null>(null);
  const [transferToId, setTransferToId] = useState<string | null>(null);

  // --- Derived values -------------------------------------------------------
  const cash = gameState.stats?.money ?? 0;
  const totalBank = banking.accounts.reduce((s, a) => s + a.balance, 0);
  const totalCardDebt = banking.creditCards.reduce((s, c) => s + c.balance, 0);
  const loans = gameState.loans ?? [];
  const totalLoanDebt = loans.reduce((s, l) => s + l.remaining, 0);

  // Net-worth composition. The old UI showed only the aggregate; a desktop
  // statement itemises it — so break the figure into the same assets it already
  // sums (stocks, crypto, real estate) and expose each line.
  const parts = useMemo(() => {
    const stocks = (gameState.stocks?.holdings ?? []).reduce((s, h) => s + (h.shares ?? 0) * (h.currentPrice ?? 0), 0);
    const crypto = (gameState.cryptos ?? []).reduce((s, c) => s + (c.owned ?? 0) * (c.price ?? 0), 0);
    let re = 0;
    for (const p of (gameState.realEstate ?? [])) {
      if (p.owned) re += p.currentValue ?? p.price ?? 0;
    }
    // Mirror accounts (`checking-default`, `savings-default`) are 1:1 reflections
    // of the authoritative legacy fields — `stats.money` (=cash) and
    // `bankSavings`. Summing ALL accounts alongside `cash` double-counts the
    // checking mirror (and would rely on the savings mirror for bankSavings).
    // Count each authoritative pool once: cash + bankSavings + self-opened
    // (non-mirror) deposits.
    // Count each authoritative money pool once. Summing the raw account list
    // alongside `cash` double-counts the checking mirror (see
    // computeStatementNetWorth / MIRRORED_ACCOUNT_IDS).
    const nw = computeStatementNetWorth({
      cash,
      bankSavings: gameState.bankSavings ?? 0,
      accounts: banking.accounts,
      stocks,
      crypto,
      realEstate: re,
      cardDebt: totalCardDebt,
      loanDebt: totalLoanDebt,
    });
    return { stocks, crypto, re, bankDeposits: nw.bankDeposits, assets: nw.assets, liabilities: nw.liabilities, net: nw.net };
  }, [cash, banking.accounts, gameState.bankSavings, totalCardDebt, totalLoanDebt, gameState.stocks, gameState.cryptos, gameState.realEstate]);

  // Weekly income approximation for the loan quote DTI gate + statement activity.
  const weeklyIncome = useMemo(() => {
    let income = 0;
    // R3-M3: political salaries are ANNUAL; every other ladder is weekly. This
    // read them all as weekly, so an elected player's borrowing capacity was
    // inflated 52x at the DTI gate. One shared helper now encodes the rule.
    income += weeklyCareerSalary(gameState);
    for (const co of (gameState.companies ?? [])) income += co.weeklyIncome ?? 0;
    for (const rel of (gameState.relationships ?? [])) {
      if (rel?.income && (rel.type === 'partner' || rel.type === 'spouse') && rel.relationshipScore >= 50) {
        income += Math.round(rel.income * 0.25);
      }
    }
    return income;
  }, [gameState.careers, gameState.currentJob, gameState.companies, gameState.relationships]);

  // Tax Strategy discount. Same source the week loop reads, so the Tax tab
  // cannot claim a rate the tick does not charge.
  const taxMult = useMemo(
    () => clampTaxMult(getLifeSkillModifiers(gameState).taxMult),
    [gameState]
  );

  // Blended deposit APY (weighted by balance) — a fact the flat account list hid.
  const blendedAPY = totalBank > 0
    ? banking.accounts.reduce((s, a) => s + displayedDepositAPR(a.baseAPR, banking.rateEnvironment) * a.balance, 0) / totalBank
    : 0;

  const queueSave = useCallback(() => {
    saveGame().catch(() => {
      // Errors are surfaced via the existing logger; non-fatal in the UI.
    });
  }, [saveGame]);

  // Loan tap → choose Prepay or Refinance. Refinance re-prices the APR from the
  // CURRENT credit score (and adds a hard inquiry), so a player who has built
  // credit since taking the loan can cut their rate.
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
              setSubView(null);
            },
          },
        ]
      );
    },
    [setGameState, queueSave]
  );

  // v22 Wave A: self-opened accounts eligible for transfers (mirrored cash
  // accounts are read-only and rejected by the action).
  const transferableAccounts = useMemo(
    () => banking.accounts.filter((a) => !MIRRORED_ACCOUNT_IDS.has(a.id)),
    [banking.accounts]
  );

  // Transfer flow: pick a source, then a destination, then an amount (modal).
  // Uses Alert menus like the savings-goal picker to stay dependency-free.
  const startTransfer = useCallback(() => {
    const sources = transferableAccounts.filter((a) => a.balance > 0);
    if (sources.length === 0) {
      Alert.alert('Nothing to transfer', 'None of your accounts have a balance to move.');
      return;
    }
    Alert.alert('Transfer from…', undefined, [
      ...sources.map((a) => ({
        text: `${a.name} · ${formatMoney(a.balance)}`,
        onPress: () => {
          const dests = transferableAccounts.filter((d) => d.id !== a.id);
          if (dests.length === 0) {
            Alert.alert('No destination', 'Open a second account to transfer into.');
            return;
          }
          Alert.alert('Transfer to…', undefined, [
            ...dests.map((d) => ({
              text: `${d.name} · ${formatMoney(d.balance)}`,
              onPress: () => {
                setTransferFromId(a.id);
                setTransferToId(d.id);
              },
            })),
            { text: 'Cancel', style: 'cancel' as const },
          ]);
        },
      })),
      { text: 'Cancel', style: 'cancel' as const },
    ]);
  }, [transferableAccounts]);

  // ─────────────────────────── Header (nav-safe on every screen state) ───────
  const renderHeader = (title: string, opts?: { back?: () => void; right?: React.ReactNode }) => (
    <View style={styles.topBar}>
      <TouchableOpacity
        onPress={opts?.back ?? onBack}
        hitSlop={8}
        style={styles.backBtn}
        accessibilityRole="button"
        accessibilityLabel="Back"
      >
        <ArrowLeft size={scale(22)} color={theme.text} />
      </TouchableOpacity>
      <Text style={[styles.appTitle, { color: theme.text }]} numberOfLines={1}>{title}</Text>
      <View style={styles.headerRight}>{opts?.right}</View>
    </View>
  );

  const scoreChip = (
    <TouchableOpacity
      onPress={() => setSubView({ kind: 'credit' })}
      accessibilityRole="button"
      accessibilityLabel={`Credit score ${banking.creditScore?.score ?? 0}, view report`}
      style={[styles.scoreChip, { backgroundColor: 'rgba(59, 130, 246, 0.14)', borderColor: 'rgba(59, 130, 246, 0.30)' }]}
    >
      <Shield size={scale(12)} color={accent.info} />
      <Text style={[styles.scoreChipText, { color: theme.text }]}>{banking.creditScore?.score ?? 0}</Text>
      <ChevronRight size={scale(13)} color={theme.textMuted} />
    </TouchableOpacity>
  );

  // ─────────────────────────── Statement (overview) ──────────────────────────
  const renderStatement = () => {
    const compositionRows: { icon: React.ComponentType<{ size: number; color: string }>; tintHex: string; tintRGB: string; label: string; value: number; sign: 1 | -1 }[] = [
      { icon: Coins, tintHex: accent.info, tintRGB: '59, 130, 246', label: 'Cash on hand', value: cash, sign: 1 },
      { icon: PiggyBank, tintHex: accent.success, tintRGB: '16, 185, 129', label: `Bank deposits · ${banking.accounts.length} ${banking.accounts.length === 1 ? 'account' : 'accounts'}`, value: parts.bankDeposits, sign: 1 },
    ];
    if (parts.stocks > 0) compositionRows.push({ icon: LineChart, tintHex: '#a855f7', tintRGB: '168, 85, 247', label: 'Stock holdings', value: parts.stocks, sign: 1 });
    if (parts.crypto > 0) compositionRows.push({ icon: Coins, tintHex: accent.warning, tintRGB: '245, 158, 11', label: 'Crypto holdings', value: parts.crypto, sign: 1 });
    if (parts.re > 0) compositionRows.push({ icon: Building2, tintHex: '#06b6d4', tintRGB: '6, 182, 212', label: 'Real-estate value', value: parts.re, sign: 1 });
    if (totalCardDebt > 0) compositionRows.push({ icon: CardIcon, tintHex: accent.danger, tintRGB: '239, 68, 68', label: 'Credit-card debt', value: totalCardDebt, sign: -1 });
    if (totalLoanDebt > 0) compositionRows.push({ icon: Landmark, tintHex: accent.danger, tintRGB: '239, 68, 68', label: 'Loans outstanding', value: totalLoanDebt, sign: -1 });

    const activityRows: { icon: React.ComponentType<{ size: number; color: string }>; tintHex: string; tintRGB: string; label: string; value: string; valueColor: string }[] = [
      { icon: Coins, tintHex: accent.success, tintRGB: '16, 185, 129', label: 'Weekly income', value: `${formatMoney(weeklyIncome)}/wk`, valueColor: accent.success },
      { icon: TrendingUp, tintHex: accent.success, tintRGB: '16, 185, 129', label: 'Interest earned', value: `+${formatMoney(banking.totalInterestEarned)}`, valueColor: accent.success },
      { icon: TrendingDown, tintHex: accent.danger, tintRGB: '239, 68, 68', label: 'Interest paid', value: `-${formatMoney(banking.totalInterestPaid)}`, valueColor: accent.danger },
      { icon: Receipt, tintHex: accent.warning, tintRGB: '245, 158, 11', label: 'Late fees paid', value: `-${formatMoney(banking.totalLateFeesPaid)}`, valueColor: banking.totalLateFeesPaid > 0 ? accent.warning : theme.text },
    ];
    // Live at last: `taxDueThisYear` now has a writer (the week loop's tax
    // ledger), so this row is no longer permanently hidden behind its `> 0`
    // gate. Relabelled to what the number actually is — tax already PAID, not
    // a bill waiting to be settled.
    if (banking.taxDueThisYear > 0) {
      activityRows.push({ icon: Percent, tintHex: accent.warning, tintRGB: '245, 158, 11', label: 'Tax paid this year', value: `-${formatMoney(banking.taxDueThisYear)}`, valueColor: accent.warning });
    }
    // The Tax tab is the fifth of five — the one furthest from the thumb and
    // the easiest to never notice. The statement row that summarises it links
    // straight there, the same way the credit gauge links to the full report.
    const hasTaxToShow = banking.taxDueThisYear > 0;

    return (
      <View style={{ gap: responsiveSpacing.md }}>
        {/* Statement masthead — the ONE focal gradient of this screen (Recipe B),
            structured as side-by-side summary columns (desktop statement DNA). */}
        <View
          style={[
            getGlassCard(darkMode, 12),
            {
              backgroundColor: theme.surface,
              borderColor: darkMode ? theme.glassBorder : theme.border,
              borderWidth: 1,
              borderRadius: responsiveBorderRadius['2xl'],
            },
          ]}
        >
          <View style={styles.mastheadInner}>
            <View pointerEvents="none" style={styles.heroBlob} />
            {darkMode && <View pointerEvents="none" style={styles.heroHairline} />}

            <View style={styles.mastheadTop}>
              <View style={styles.mastheadTitleWrap}>
                <FileText size={scale(13)} color={accent.info} />
                <Text style={[styles.mastheadEyebrow, { color: theme.textMuted }]}>ACCOUNT STATEMENT</Text>
              </View>
              <View style={[styles.periodChip, { backgroundColor: theme.surfaceElevated }]}>
                <Calendar size={scale(11)} color={theme.textMuted} />
                <Text style={[styles.periodText, { color: theme.textSecondary }]}>Week {gameState.weeksLived}</Text>
              </View>
            </View>

            <View style={styles.summaryColumns}>
              <SummaryColumn theme={theme} label="ASSETS" value={formatMoney(parts.assets)} caption="cash · bank · holdings" />
              <View style={[styles.colDivider, { backgroundColor: theme.border }]} />
              <SummaryColumn
                theme={theme}
                label="LIABILITIES"
                value={formatMoney(parts.liabilities)}
                caption="cards · loans"
                valueColor={parts.liabilities > 0 ? accent.danger : theme.text}
              />
              <View style={[styles.colDivider, { backgroundColor: theme.border }]} />
              <SummaryColumn
                theme={theme}
                label="NET WORTH"
                value={formatMoney(parts.net)}
                caption="assets − liabilities"
                valueColor={parts.net < 0 ? accent.danger : theme.text}
                emphasize
              />
            </View>
          </View>
        </View>

        <EconomyEventBanner context="banking" />

        {/* Net-worth composition ledger — itemises the aggregate above and
            surfaces stocks / crypto / real estate the flat overview never showed. */}
        <SectionTitle theme={theme}>Net worth composition</SectionTitle>
        <StatementSection theme={theme} darkMode={darkMode} columns={['ITEM', 'VALUE']}>
          {compositionRows.map((r, i) => (
            <LedgerRow
              key={r.label}
              theme={theme}
              darkMode={darkMode}
              divider={i > 0}
              icon={r.icon}
              tintHex={r.tintHex}
              tintRGB={r.tintRGB}
              label={r.label}
              value={`${r.sign < 0 ? '-' : ''}${formatMoney(r.value)}`}
              valueColor={r.sign < 0 ? accent.danger : theme.text}
            />
          ))}
          <LedgerRow
            theme={theme}
            darkMode={darkMode}
            divider
            emphasize
            label="Net worth"
            value={formatMoney(parts.net)}
            valueColor={parts.net < 0 ? accent.danger : theme.text}
          />
        </StatementSection>

        {/* Activity summary — lifetime interest / fees / income the app never surfaced. */}
        <SectionTitle theme={theme}>Activity summary</SectionTitle>
        <StatementSection theme={theme} darkMode={darkMode}>
          {activityRows.map((r, i) => (
            <LedgerRow
              key={r.label}
              theme={theme}
              darkMode={darkMode}
              divider={i > 0}
              icon={r.icon}
              tintHex={r.tintHex}
              tintRGB={r.tintRGB}
              label={r.label}
              value={r.value}
              valueColor={r.valueColor}
            />
          ))}
        </StatementSection>
        {hasTaxToShow && (
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => setActiveTab('tax')}
            accessibilityRole="button"
            accessibilityLabel="View tax breakdown"
            style={[styles.reportCta, { backgroundColor: 'rgba(245, 158, 11, 0.14)', borderColor: 'rgba(245, 158, 11, 0.30)' }]}
          >
            <Percent size={scale(14)} color={accent.warning} />
            <Text style={[styles.reportCtaText, { color: accent.warning }]}>See where your tax goes</Text>
            <ChevronRight size={scale(15)} color={accent.warning} />
          </TouchableOpacity>
        )}

        {/* Credit standing — gauge stays; full report is one tap away. */}
        <SectionTitle theme={theme}>Credit standing</SectionTitle>
        <CreditScoreGauge score={banking.creditScore.score} band={banking.creditScore.band} darkMode={darkMode} compact />
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => setSubView({ kind: 'credit' })}
          accessibilityRole="button"
          accessibilityLabel="View full credit report"
          style={[styles.reportCta, { backgroundColor: 'rgba(59, 130, 246, 0.14)', borderColor: 'rgba(59, 130, 246, 0.30)' }]}
        >
          <FileText size={scale(14)} color={accent.info} />
          <Text style={[styles.reportCtaText, { color: accent.info }]}>View full credit report</Text>
          <ChevronRight size={scale(15)} color={accent.info} />
        </TouchableOpacity>

        {/* Accounts ledger — slim statement rows (NOT the phone's card deck), each
            taps through to a full account statement page. */}
        <SectionHeader theme={theme} title="Accounts" meta={`${banking.accounts.length} open · ${formatMoney(totalBank)} on deposit`} addLabel="Open" onAdd={() => setShowOpenAccount(true)} />
        <StatementSection theme={theme} darkMode={darkMode} columns={['ACCOUNT', 'BALANCE']}>
          {banking.accounts.map((acct, i) => {
            const pal = accountPalette(acct.type);
            const locked = acct.lockUntilWeek != null && gameState.weeksLived < acct.lockUntilWeek;
            const acctAPR = displayedDepositAPR(acct.baseAPR, banking.rateEnvironment);
            const sub = `${accountTypeLabel(acct.type)}${acct.baseAPR > 0 ? ` · ${(acctAPR * 100).toFixed(2)}% APR` : ''}${locked ? ' · Locked' : ''}`;
            return (
              <LedgerRow
                key={acct.id}
                theme={theme}
                darkMode={darkMode}
                divider={i > 0}
                icon={accountGlyph(acct.type)}
                tintHex={pal.hex}
                tintRGB={pal.rgb}
                label={acct.name}
                sub={sub}
                value={formatMoney(acct.balance)}
                chevron
                onPress={() => setSubView({ kind: 'account', id: acct.id })}
                accessibilityLabel={`${acct.name}, ${accountTypeLabel(acct.type)}, balance ${formatMoney(acct.balance)}. View statement`}
              />
            );
          })}
        </StatementSection>
        <TouchableOpacity
          onPress={() => setActiveTab('accounts')}
          accessibilityRole="button"
          accessibilityLabel="Manage accounts"
          style={[styles.manageChip, { borderColor: 'rgba(59, 130, 246, 0.30)', backgroundColor: 'rgba(59, 130, 246, 0.10)' }]}
        >
          <Wallet size={scale(13)} color={accent.info} />
          <Text style={[styles.manageChipText, { color: accent.info }]}>Manage accounts &amp; goals</Text>
          <ChevronRight size={scale(14)} color={accent.info} />
        </TouchableOpacity>

        {/* Active loans as slim statement rows (tap → prepay / refinance). */}
        {loans.length > 0 && (
          <>
            <SectionHeader theme={theme} title="Active loans" meta={`${loans.length} · ${formatMoney(totalLoanDebt)} owed`} addLabel="Apply" onAdd={() => setShowLoanQuote(true)} />
            <StatementSection theme={theme} darkMode={darkMode} columns={['LOAN', 'REMAINING']}>
              {loans.map((loan, i) => (
                <LedgerRow
                  key={loan.id}
                  theme={theme}
                  darkMode={darkMode}
                  divider={i > 0}
                  icon={Landmark}
                  tintHex={accent.info}
                  tintRGB="59, 130, 246"
                  label={loan.name || `${loanTypeLabel(loan.type)} loan`}
                  sub={`${loanTypeLabel(loan.type)} · ${(loan.rateAPR * 100).toFixed(2)}% APR · ${formatMoney(loan.weeklyPayment)}/wk · ${loan.weeksRemaining}w left`}
                  value={formatMoney(loan.remaining)}
                  chevron
                  onPress={() => openLoanActions(loan)}
                  accessibilityLabel={`${loan.name || loanTypeLabel(loan.type)}, ${formatMoney(loan.remaining)} remaining. Prepay or refinance`}
                />
              ))}
            </StatementSection>
          </>
        )}
      </View>
    );
  };

  // ─────────────────────────── Accounts tab ──────────────────────────────────
  const renderAccounts = () => {
    const goalsSaved = banking.savingsGoals.reduce((s, g) => s + g.currentAmount, 0);
    const goalsTarget = banking.savingsGoals.reduce((s, g) => s + g.targetAmount, 0);
    return (
      <View style={{ gap: responsiveSpacing.md }}>
        {/* Deposit summary strip — totals + blended APY the flat list hid. */}
        <View style={styles.summaryStrip}>
          <SummaryCell theme={theme} icon={PiggyBank} label="On deposit" value={formatMoney(totalBank)} tint={accent.success} />
          <SummaryCell theme={theme} icon={Wallet} label="Accounts" value={`${banking.accounts.length}`} tint={accent.info} />
          <SummaryCell theme={theme} icon={Percent} label="Blended APY" value={`${(blendedAPY * 100).toFixed(2)}%`} tint={accent.success} />
        </View>

        <SectionHeader theme={theme} title="Your Accounts" addLabel="Open" onAdd={() => setShowOpenAccount(true)} />
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
        {/* Account transfer — exposes the built-and-tested transferBetweenOwnAccounts.
            Only self-opened (non-mirrored) accounts can move money; ≥2 required. */}
        {transferableAccounts.length >= 2 && (
          <TouchableOpacity
            style={[styles.transferBtn, { borderColor: theme.border, backgroundColor: theme.surface }]}
            activeOpacity={0.7}
            onPress={startTransfer}
            accessibilityLabel="Transfer money between your accounts"
          >
            <ArrowLeftRight size={scale(16)} color={accent.info} />
            <Text style={[styles.transferBtnText, { color: theme.text }]}>Transfer between accounts</Text>
          </TouchableOpacity>
        )}

        <SectionHeader
          theme={theme}
          title="Savings Goals"
          icon={Target}
          meta={banking.savingsGoals.length > 0 ? `${formatMoney(goalsSaved)} of ${formatMoney(goalsTarget)} saved` : undefined}
          addLabel="New"
          onAdd={() => Alert.alert('What are you saving for?', undefined, [
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
        />
        {banking.savingsGoals.length === 0 ? (
          <EmptyCard theme={theme} darkMode={darkMode}>
            No savings goals yet. Set one to track progress toward an emergency fund, a down payment, or retirement.
          </EmptyCard>
        ) : (
          banking.savingsGoals.map((g) => (
            <SavingsGoalCard
              key={g.id}
              goal={g}
              darkMode={darkMode}
              onContribute={() => setContributeGoalId(g.id)}
              onWithdraw={() => setWithdrawGoalId(g.id)}
            />
          ))
        )}
      </View>
    );
  };

  // ─────────────────────────── Borrow tab ────────────────────────────────────
  const renderBorrow = () => {
    const totalLimit = banking.creditCards.reduce((s, c) => s + c.creditLimit, 0);
    const cardUtil = totalLimit > 0 ? totalCardDebt / totalLimit : 0;
    const weeklyLoanPmt = loans.reduce((s, l) => s + l.weeklyPayment, 0);
    const totalPendingRewards = banking.creditCards.reduce((s, c) => s + Math.max(0, c.pendingRewards ?? 0), 0);
    return (
      <View style={{ gap: responsiveSpacing.md }}>
        {/* Debt summary strip. */}
        <View style={styles.summaryStrip}>
          <SummaryCell theme={theme} icon={TrendingDown} label="Total debt" value={formatMoney(totalCardDebt + totalLoanDebt)} tint={accent.danger} valueColor={totalCardDebt + totalLoanDebt > 0 ? accent.danger : theme.text} />
          <SummaryCell theme={theme} icon={Landmark} label="Loan pmts" value={`${formatMoney(weeklyLoanPmt)}/wk`} tint={accent.info} />
          <SummaryCell theme={theme} icon={CardIcon} label="Card usage" value={`${Math.round(cardUtil * 100)}%`} tint={cardUtil > 0.7 ? accent.danger : accent.info} valueColor={cardUtil > 0.7 ? accent.danger : theme.text} />
        </View>

        <SectionHeader theme={theme} title="Loans" meta={loans.length > 0 ? `${loans.length} active` : undefined} addLabel="Apply" onAdd={() => setShowLoanQuote(true)} />
        {loans.length === 0 ? (
          <EmptyCard theme={theme} darkMode={darkMode}>No active loans.</EmptyCard>
        ) : (
          loans.map((loan) => (
            <LoanRow key={loan.id} loan={loan} darkMode={darkMode} onPress={() => openLoanActions(loan)} />
          ))
        )}

        {/* The living-card loop is wired: charge posts to the balance, paying it
            down accrues cashback, and Redeem banks that cashback as cash. Surface
            the accrued rewards pool in the header meta now that it can actually
            accrue. */}
        <SectionHeader
          theme={theme}
          title="Credit Cards"
          meta={
            banking.creditCards.length > 0
              ? `${banking.creditCards.length} active${totalPendingRewards > 0 ? ` · ${formatMoney(totalPendingRewards)} rewards` : ''}`
              : undefined
          }
          addLabel="Apply"
          onAdd={() => setShowApplyCard(true)}
        />
        {banking.creditCards.length === 0 ? (
          <EmptyCard theme={theme} darkMode={darkMode}>
            No cards yet. Apply for one to build credit history (eligibility depends on your score).
          </EmptyCard>
        ) : (
          banking.creditCards.map((c) => {
            const availableCredit = Math.max(0, (c.creditLimit ?? 0) - (c.balance ?? 0));
            const pending = Math.max(0, c.pendingRewards ?? 0);
            const hasBalance = (c.balance ?? 0) > 0;
            return (
              <View key={c.id} style={{ gap: responsiveSpacing.xs }}>
                <CreditCardRow card={c} darkMode={darkMode} onPress={() => setPayCardId(c.id)} />
                <View style={styles.detailSecondaryRow}>
                  <TouchableOpacity
                    onPress={() => setChargeCardId(c.id)}
                    disabled={availableCredit <= 0}
                    accessibilityRole="button"
                    accessibilityLabel={`Charge a purchase to ${c.name}`}
                    accessibilityState={{ disabled: availableCredit <= 0 }}
                    style={[getGlassButton(darkMode), styles.secondaryBtn, availableCredit <= 0 && styles.disabled]}
                  >
                    <Text style={[styles.secondaryText, { color: theme.text }]}>Charge</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setPayCardId(c.id)}
                    disabled={!hasBalance}
                    accessibilityRole="button"
                    accessibilityLabel={`Pay down ${c.name}`}
                    accessibilityState={{ disabled: !hasBalance }}
                    style={[getGlassButton(darkMode), styles.secondaryBtn, !hasBalance && styles.disabled]}
                  >
                    <Text style={[styles.secondaryText, { color: theme.text }]}>Pay</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => {
                      if (pending <= 0) return;
                      // redeemCardRewards caps a single redemption at $10,000.
                      const redeemed = Math.min(pending, 10_000);
                      redeemRewards(setGameState, c.id);
                      queueSave();
                      Alert.alert('Rewards redeemed', `${formatMoney(redeemed)} in cashback added to your cash.`);
                    }}
                    disabled={pending <= 0}
                    accessibilityRole="button"
                    accessibilityLabel={pending > 0 ? `Redeem ${formatMoney(pending)} in rewards from ${c.name}` : 'No rewards to redeem'}
                    accessibilityState={{ disabled: pending <= 0 }}
                    style={[getGlassButton(darkMode), styles.secondaryBtn, pending <= 0 && styles.disabled]}
                  >
                    <Text style={[styles.secondaryText, { color: pending > 0 ? accent.success : theme.text }]}>Redeem</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })
        )}
      </View>
    );
  };

  // ─────────────────────────── Budget tab ────────────────────────────────────
  const renderBudget = () => {
    const sortedBuckets = [...banking.budgetSpend].sort((a, b) => a.weeksLived - b.weeksLived);
    const weekTotals = sortedBuckets.slice(-8).map((b) => ({
      week: b.weeksLived,
      total: Object.values(b.byCategory).reduce((s, v) => s + (v ?? 0), 0),
    }));
    const barMax = weekTotals.reduce((m, w) => Math.max(m, w.total), 0);
    const last4Total = sortedBuckets.slice(-4).reduce((s, b) => s + Object.values(b.byCategory).reduce((t, v) => t + (v ?? 0), 0), 0);
    const weeksTracked = banking.budgetSpend.length;
    const weeklyAvg = weeksTracked > 0 ? last4Total / Math.min(4, weeksTracked) : 0;

    const enabledBills = banking.billPayRules.filter((r) => r.enabled);
    const weeklyBills = enabledBills.filter((r) => r.cadence === 'weekly').reduce((s, r) => s + r.amount, 0);
    const nextDue = enabledBills.length > 0 ? Math.min(...enabledBills.map((r) => r.nextDueWeek)) : null;
    const nextDueText = nextDue == null ? '—' : nextDue - gameState.weeksLived <= 0 ? 'Now' : `wk ${nextDue}`;

    return (
      <View style={{ gap: responsiveSpacing.md }}>
        <SectionTitle theme={theme}>Spending overview</SectionTitle>
        <View style={styles.summaryStrip}>
          <SummaryCell theme={theme} icon={Receipt} label="Last 4 wks" value={formatMoney(last4Total)} tint={accent.info} />
          <SummaryCell theme={theme} icon={Calendar} label="Weeks logged" value={`${weeksTracked}`} tint={accent.info} />
          <SummaryCell theme={theme} icon={TrendingUp} label="Weekly avg" value={formatMoney(weeklyAvg)} tint={accent.warning} />
        </View>

        {/* Weekly spend trend — real per-week totals from the budget ring buffer. */}
        {weekTotals.length >= 2 && (
          <View style={[getGlassCard(darkMode, 6), styles.trendCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={styles.trendHead}>
              <Text style={[styles.trendTitle, { color: theme.text }]}>Weekly spend</Text>
              <Text style={[styles.trendMeta, { color: theme.textMuted }]}>last {weekTotals.length} wks</Text>
            </View>
            <View style={styles.barChart}>
              {weekTotals.map((w, i) => (
                <View key={`${w.week}-${i}`} style={styles.barSlot}>
                  <View
                    style={[
                      styles.bar,
                      {
                        height: `${barMax > 0 ? Math.max(4, (w.total / barMax) * 100) : 4}%`,
                        backgroundColor: i === weekTotals.length - 1 ? accent.info : theme.surfaceElevated,
                      },
                    ]}
                  />
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Per-category allocation table (budget state → allocation bars).
            Weekly caps (computer-only): tap a row to set/clear a budget target;
            an over-cap category is flagged here and by a weekly overspend alert. */}
        <SectionTitle theme={theme}>By category</SectionTitle>
        <BudgetBreakdown
          buckets={banking.budgetSpend}
          darkMode={darkMode}
          targets={banking.budgetTargets}
          onSetTarget={(cat) => setBudgetTargetCategory(cat)}
        />

        <SectionHeader
          theme={theme}
          title="Auto-Pay Rules"
          meta={enabledBills.length > 0 ? `${enabledBills.length} on · ${formatMoney(weeklyBills)}/wk · next ${nextDueText}` : undefined}
          addLabel="Add"
          onAdd={() => setShowAddBill(true)}
        />
        {banking.billPayRules.length === 0 ? (
          <EmptyCard theme={theme} darkMode={darkMode}>
            No bills set up. Add a recurring rule and we&apos;ll auto-debit it each week from your chosen account.
          </EmptyCard>
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
  };

  // ────────────────────────────────── Tax ────────────────────────────────────
  //
  // There was no tax surface at all. Income tax is withheld weekly inside the
  // week loop and shown as one `Tax -$N` line in the weekly summary; the
  // brackets, the year-to-date total, the four OTHER taxes and the Tax Strategy
  // skill were entirely invisible. Players reasonably asked where to file — the
  // answer is "you never do", and nothing in the app said so.
  //
  // Read-only by design: this is a statement, not a mechanic. Everything here
  // comes from state the tick already writes.
  const renderTax = () => (
    <View style={{ gap: responsiveSpacing.md }}>
      <SectionTitle theme={theme}>Tax year {taxYearOf(gameState.weeksLived)}</SectionTitle>
      <TaxStatement
        banking={banking}
        weeksLived={gameState.weeksLived}
        weeklyIncome={weeklyIncome}
        taxMult={taxMult}
        darkMode={darkMode}
      />
    </View>
  );

  // ─────────────────────────── Account statement page ────────────────────────
  const renderAccountDetail = (account: BankAccount) => {
    const pal = accountPalette(account.type);
    const isMirrored = MIRRORED_ACCOUNT_IDS.has(account.id);
    const isLocked = account.lockUntilWeek != null && gameState.weeksLived < account.lockUntilWeek;
    const ageWeeks = Math.max(0, gameState.weeksLived - account.openedWeek);
    const ageLabel = ageWeeks >= 52 ? `${(ageWeeks / 52).toFixed(1)}y · ${ageWeeks}w` : `${ageWeeks}w`;
    const relatedBills = banking.billPayRules.filter((b) => b.fromAccountId === account.id);
    const Glyph = accountGlyph(account.type);

    return (
      <>
        {renderHeader(account.name, {
          back: () => setSubView(null),
          right: (
            <View style={[styles.typeDot, { backgroundColor: `rgba(${pal.rgb}, 0.18)`, borderColor: `rgba(${pal.rgb}, 0.32)` }]}>
              <Glyph size={scale(14)} color={pal.hex} />
            </View>
          ),
        })}
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: responsiveSpacing.md, paddingBottom: getAppScreenBottomPadding(insets.bottom), gap: responsiveSpacing.md }}
        >
          {/* Hero balance (per-type flat tint via a plain View — gradient budget
              is reserved for the Deposit CTA below). */}
          <View
            style={[
              getGlassCard(darkMode, 12),
              { backgroundColor: theme.surface, borderColor: darkMode ? theme.glassBorder : theme.border, borderWidth: 1, borderRadius: responsiveBorderRadius['2xl'] },
            ]}
          >
            <View style={styles.detailHeroInner}>
              <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: `rgba(${pal.rgb}, ${darkMode ? 0.14 : 0.1})` }]} />
              <View
                pointerEvents="none"
                style={{ position: 'absolute', top: -scale(40), right: -scale(30), width: scale(150), height: scale(150), borderRadius: scale(75), backgroundColor: `rgba(${pal.rgb}, 0.10)` }}
              />
              {darkMode && <View pointerEvents="none" style={styles.heroHairline} />}
              <Text style={[styles.mastheadEyebrow, { color: theme.textMuted }]}>{accountTypeLabel(account.type).toUpperCase()}</Text>
              <Text style={[styles.detailBalance, { color: theme.text }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.5}>
                {formatMoneyExact(account.balance)}
              </Text>
              <View style={styles.detailChipRow}>
                {account.baseAPR > 0 && (
                  <View style={[styles.aprChipLg, { backgroundColor: `rgba(${pal.rgb}, 0.15)`, borderColor: `rgba(${pal.rgb}, 0.30)` }]}>
                    <TrendingUp size={scale(11)} color={pal.hex} />
                    <Text style={[styles.aprTextLg, { color: pal.hex }]}>{(displayedDepositAPR(account.baseAPR, banking.rateEnvironment) * 100).toFixed(2)}% APR</Text>
                  </View>
                )}
                <View style={[styles.statusChip, { backgroundColor: isLocked ? 'rgba(245, 158, 11, 0.15)' : 'rgba(16, 185, 129, 0.15)', borderColor: isLocked ? 'rgba(245, 158, 11, 0.30)' : 'rgba(16, 185, 129, 0.30)' }]}>
                  <Lock size={scale(10)} color={isLocked ? accent.warning : accent.success} />
                  <Text style={[styles.statusText, { color: isLocked ? accent.warning : accent.success }]}>
                    {isLocked ? `Locked · wk ${account.lockUntilWeek}` : 'Active'}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* Actions — one loud CTA (Deposit); Withdraw / Close are quiet glass. */}
          {isMirrored ? (
            <View style={[getGlassCard(darkMode, 6), styles.roCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <Lock size={scale(14)} color={theme.textMuted} />
              <Text style={[styles.roCardText, { color: theme.textMuted }]}>
                This is a primary account that mirrors your cash — deposits, withdrawals and closing are handled automatically.
              </Text>
            </View>
          ) : (
            <View style={{ gap: responsiveSpacing.sm }}>
              <TouchableOpacity
                onPress={() => setDepositTarget(account)}
                accessibilityRole="button"
                accessibilityLabel={`Deposit to ${account.name}`}
                style={[styles.ctaShadow, getPlatformShadows(5, 0.3, 2, 8)]}
              >
                <View style={styles.ctaInner}>
                  <LinearGradient pointerEvents="none" colors={[pal.hex, pal.hex]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
                  <Coins size={scale(16)} color="#fff" />
                  <Text style={styles.ctaText}>Deposit</Text>
                </View>
              </TouchableOpacity>
              <View style={styles.detailSecondaryRow}>
                <TouchableOpacity
                  onPress={() => setWithdrawTarget(account)}
                  disabled={isLocked}
                  accessibilityRole="button"
                  accessibilityLabel={`Withdraw from ${account.name}`}
                  accessibilityState={{ disabled: isLocked }}
                  style={[getGlassButton(darkMode), styles.secondaryBtn, isLocked && styles.disabled]}
                >
                  <Text style={[styles.secondaryText, { color: theme.text }]}>Withdraw</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => confirmCloseAccount(account)}
                  disabled={isLocked}
                  accessibilityRole="button"
                  accessibilityLabel={`Close ${account.name}`}
                  accessibilityState={{ disabled: isLocked }}
                  style={[getGlassButton(darkMode), styles.secondaryBtn, isLocked && styles.disabled]}
                >
                  <Text style={[styles.secondaryText, { color: accent.danger }]}>Close account</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Facts grid — opened week / age / min balance the flat list hid. */}
          <Text style={[styles.sectionTitle, styles.detailSectionTitle, { color: theme.text }]}>Account details</Text>
          <View style={[getGlassCard(darkMode, 6), styles.groupCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={styles.factsGrid}>
              <FactCell theme={theme} icon={Glyph} tint={pal.hex} label="Type" value={accountTypeLabel(account.type)} />
              {/* Label carries the attribution: a rate moved by the economy must
                  say so, or a reduced number reads as the bank re-pricing and
                  the "yields drift down" event banner looks cosmetic. */}
              <FactCell
                theme={theme}
                icon={Percent}
                label={depositAPRNote(banking.rateEnvironment) ? `Interest APR · ${depositAPRNote(banking.rateEnvironment)}` : 'Interest APR'}
                value={`${(displayedDepositAPR(account.baseAPR, banking.rateEnvironment) * 100).toFixed(2)}%`}
              />
              <FactCell theme={theme} icon={Coins} label="Balance" value={formatMoneyExact(account.balance)} />
              <FactCell theme={theme} icon={Calendar} label="Opened" value={`Week ${account.openedWeek}`} />
              <FactCell theme={theme} icon={Clock} label="Age" value={ageLabel} />
              <FactCell theme={theme} icon={PiggyBank} label="Min balance" value={account.minBalance ? formatMoneyExact(account.minBalance) : 'None'} />
            </View>
          </View>

          {/* Auto-pay drawing from this account — statement activity rows. */}
          <Text style={[styles.sectionTitle, styles.detailSectionTitle, { color: theme.text }]}>Auto-pay from this account</Text>
          {relatedBills.length === 0 ? (
            <EmptyCard theme={theme} darkMode={darkMode}>No auto-pay rules draw from this account.</EmptyCard>
          ) : (
            <StatementSection theme={theme} darkMode={darkMode}>
              {relatedBills.map((bill, i) => {
                const due = bill.nextDueWeek - gameState.weeksLived;
                const dueText = due <= 0 ? 'Due now' : due === 1 ? 'Due next week' : `Due in ${due} weeks`;
                return (
                  <LedgerRow
                    key={bill.id}
                    theme={theme}
                    darkMode={darkMode}
                    divider={i > 0}
                    icon={Receipt}
                    tintHex={accent.info}
                    tintRGB="59, 130, 246"
                    label={bill.label}
                    sub={`${bill.cadence === 'weekly' ? 'Weekly' : 'Monthly'} · ${bill.enabled ? dueText : 'Paused'}${bill.missedCount > 0 ? ` · ${bill.missedCount} missed` : ''}`}
                    value={formatMoneyExact(bill.amount)}
                  />
                );
              })}
            </StatementSection>
          )}
        </ScrollView>
      </>
    );
  };

  // ─────────────────────────── Credit report page ────────────────────────────
  const renderCreditDetail = () => {
    const cs = banking.creditScore;
    const history = cs.history ?? [];
    const points = history.slice(-24).map((h) => h.score);
    const hasTrend = points.length >= 2;
    const delta = hasTrend ? points[points.length - 1] - points[0] : 0;
    const lo = hasTrend ? Math.min(...points) : cs.score;
    const hi = hasTrend ? Math.max(...points) : cs.score;
    const inquiries = (cs.inquiries ?? []).slice().reverse().slice(0, 8);

    return (
      <>
        {renderHeader('Credit Report', {
          back: () => setSubView(null),
          right: (
            <View style={[styles.typeDot, { backgroundColor: 'rgba(59, 130, 246, 0.16)', borderColor: 'rgba(59, 130, 246, 0.30)' }]}>
              <FileText size={scale(14)} color={accent.info} />
            </View>
          ),
        })}
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: responsiveSpacing.md, paddingBottom: getAppScreenBottomPadding(insets.bottom), gap: responsiveSpacing.md }}
        >
          <CreditScoreGauge score={cs.score} band={cs.band} darkMode={darkMode} />

          {/* Score trend — real history only, no fabricated arrays. */}
          <View style={styles.sectionHeaderRow}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Score trend</Text>
            {hasTrend && (
              <View style={[styles.deltaChip, { backgroundColor: delta >= 0 ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)' }]}>
                {delta >= 0 ? <TrendingUp size={scale(11)} color={accent.success} /> : <TrendingDown size={scale(11)} color={accent.danger} />}
                <Text style={[styles.deltaText, { color: delta >= 0 ? accent.success : accent.danger }]}>
                  {delta >= 0 ? '+' : ''}{delta} pts
                </Text>
              </View>
            )}
          </View>
          <View style={[getGlassCard(darkMode, 6), styles.groupCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            {hasTrend ? (
              <>
                <View style={styles.sparkWrap} onLayout={(e) => setSparkWidth(e.nativeEvent.layout.width)}>
                  {sparkWidth > 0 && (
                    <Svg width={sparkWidth} height={scale(56)}>
                      <Polyline
                        points={points
                          .map((v, i) => {
                            const x = (i / (points.length - 1)) * sparkWidth;
                            const range = hi - lo || 1;
                            const y = scale(3) + (1 - (v - lo) / range) * (scale(56) - scale(6));
                            return `${x.toFixed(1)},${y.toFixed(1)}`;
                          })
                          .join(' ')}
                        fill="none"
                        stroke={accent.info}
                        strokeWidth={scale(2)}
                        strokeLinejoin="round"
                        strokeLinecap="round"
                      />
                    </Svg>
                  )}
                </View>
                <View style={styles.sparkScale}>
                  <Text style={[styles.sparkScaleText, { color: theme.textMuted }]}>{lo}</Text>
                  <Text style={[styles.sparkScaleText, { color: theme.textMuted }]}>last {points.length} wks</Text>
                  <Text style={[styles.sparkScaleText, { color: theme.textMuted }]}>{hi}</Text>
                </View>
              </>
            ) : (
              <Text style={[styles.trendEmpty, { color: theme.textMuted }]}>
                Your score is {cs.score}. A trend line appears here as the score updates over the coming weeks.
              </Text>
            )}
          </View>

          {/* Weighted component breakdown (re-homed here from the overview). */}
          <Text style={[styles.sectionTitle, styles.detailSectionTitle, { color: theme.text }]}>What&apos;s driving your score</Text>
          <CreditScoreBreakdown theme={theme} darkMode={darkMode} breakdown={cs.componentBreakdown} />

          {/* Recent inquiries — surfaced from state for the first time. */}
          <View style={styles.sectionHeaderRow}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Recent inquiries</Text>
            <Text style={[styles.sectionMeta, { color: theme.textMuted }]}>Updated wk {cs.lastUpdatedWeek}</Text>
          </View>
          {inquiries.length === 0 ? (
            <EmptyCard theme={theme} darkMode={darkMode}>No recent credit inquiries. A clean file keeps this factor high.</EmptyCard>
          ) : (
            <StatementSection theme={theme} darkMode={darkMode}>
              {inquiries.map((inq, i) => {
                const ago = gameState.weeksLived - inq.weeksLived;
                const agoText = ago <= 0 ? 'this week' : ago === 1 ? '1 week ago' : `${ago} weeks ago`;
                return (
                  <LedgerRow
                    key={`${inq.weeksLived}-${i}`}
                    theme={theme}
                    darkMode={darkMode}
                    divider={i > 0}
                    icon={FileText}
                    tintHex={accent.info}
                    tintRGB="59, 130, 246"
                    label={inquiryLabel(inq.type)}
                    sub={`Week ${inq.weeksLived} · ${agoText}`}
                  />
                );
              })}
            </StatementSection>
          )}
        </ScrollView>
      </>
    );
  };

  // ─────────────────────────── Main (tabs) ───────────────────────────────────
  const renderMain = () => (
    <>
      {renderHeader('Bank Pro', { right: scoreChip })}

      <View style={[styles.tabBar, { borderBottomColor: theme.border }]}>
        {TABS.map((t) => {
          const active = activeTab === t.id;
          const Icon = t.icon;
          return (
            <TouchableOpacity
              key={t.id}
              onPress={() => setActiveTab(t.id)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={t.label}
              style={[styles.tab, active && { borderBottomColor: accent.info }]}
            >
              <Icon size={scale(17)} color={active ? accent.info : theme.textMuted} />
              <Text
                style={[styles.tabText, { color: active ? accent.info : theme.textMuted }]}
                numberOfLines={1}
              >
                {t.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: responsiveSpacing.md, paddingBottom: getAppScreenBottomPadding(insets.bottom) }}
      >
        {activeTab === 'overview' && renderStatement()}
        {activeTab === 'accounts' && renderAccounts()}
        {activeTab === 'borrow' && renderBorrow()}
        {activeTab === 'budget' && renderBudget()}
        {activeTab === 'tax' && renderTax()}
      </ScrollView>
    </>
  );

  const detailAccount =
    subView?.kind === 'account' ? banking.accounts.find((a) => a.id === subView.id) ?? null : null;

  // Charge-to-card modal derived values (used by the Charge AmountInputModal in
  // the frame below). Available credit caps the charge so it can't exceed the limit.
  const chargeCard = chargeCardId ? banking.creditCards.find((c) => c.id === chargeCardId) ?? null : null;
  const chargeAvailableCredit = chargeCard ? Math.max(0, (chargeCard.creditLimit ?? 0) - (chargeCard.balance ?? 0)) : 0;

  // --- Frame ---------------------------------------------------------------
  return (
    <View style={[styles.root, { backgroundColor: theme.background, paddingTop: 0 }]}>
      {subView?.kind === 'credit'
        ? renderCreditDetail()
        : detailAccount
          ? renderAccountDetail(detailAccount)
          : renderMain()}

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
          // Player report (1.4 bug-reports): "Can't create a new savings."
          // `openNewAccount` used to return void and this closed the sheet
          // regardless, so a rejection was indistinguishable from success —
          // the player tapped Open, the sheet closed, and no account appeared.
          const result = openNewAccount(setGameState, spec);
          if (!result.success) {
            Alert.alert('Could not open account', result.message);
            return;
          }
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
          // Hand off to the auto-contribute step rather than creating here, so
          // the goal is written once with its final shape.
          if (addGoalPick) {
            setAutoGoalPick({ ...addGoalPick, targetAmount: amt });
          }
          setAddGoalPick(null);
        }}
      />

      {/* Auto-contribute step. Closing without confirming creates the goal with
          no sweep — manual-only is a legitimate choice, so it must not require
          entering 0. */}
      <AmountInputModal
        visible={!!autoGoalPick}
        title="Save automatically?"
        subtitle={
          autoGoalPick
            ? `Move money toward "${autoGoalPick.name}" every week. Close to skip.`
            : ''
        }
        confirmLabel="Set weekly amount"
        presets={
          autoGoalPick
            ? [
                Math.max(10, Math.round(autoGoalPick.targetAmount / 52)),
                Math.max(25, Math.round(autoGoalPick.targetAmount / 26)),
                Math.max(50, Math.round(autoGoalPick.targetAmount / 12)),
              ]
            : [50, 100, 250]
        }
        darkMode={darkMode}
        onClose={() => {
          if (autoGoalPick) {
            createSavingsGoal(setGameState, {
              name: autoGoalPick.name,
              targetAmount: autoGoalPick.targetAmount,
              category: autoGoalPick.category,
            });
            queueSave();
          }
          setAutoGoalPick(null);
        }}
        onConfirm={(weekly) => {
          if (autoGoalPick) {
            createSavingsGoal(setGameState, {
              name: autoGoalPick.name,
              targetAmount: autoGoalPick.targetAmount,
              category: autoGoalPick.category,
              autoContribute: weekly,
            });
            queueSave();
          }
          setAutoGoalPick(null);
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
        visible={!!withdrawGoalId}
        title="Withdraw from goal"
        subtitle={`Saved: ${formatMoney(banking.savingsGoals.find((g) => g.id === withdrawGoalId)?.currentAmount ?? 0)}`}
        confirmLabel="Withdraw"
        maxAmount={banking.savingsGoals.find((g) => g.id === withdrawGoalId)?.currentAmount ?? 0}
        presets={[50, 200, 500]}
        darkMode={darkMode}
        onClose={() => setWithdrawGoalId(null)}
        onConfirm={(amt) => {
          if (withdrawGoalId) {
            withdrawFromSavingsGoal(setGameState, withdrawGoalId, amt);
            queueSave();
          }
          setWithdrawGoalId(null);
        }}
      />

      {/* v22 Wave A: set/clear a weekly budget cap for a category (computer-only,
          informational — the weekly tick raises an overspend alert). */}
      <AmountInputModal
        visible={!!budgetTargetCategory}
        title="Set weekly budget"
        subtitle={budgetTargetCategory ? `Weekly cap for ${budgetTargetCategory}. Enter 0 to clear.` : undefined}
        confirmLabel="Set cap"
        // "Enter 0 to clear" needs 0 to be confirmable (setBudgetTarget deletes
        // the cap when amount <= 0) — without this the promise was impossible.
        allowZero
        presets={[100, 250, 500, 1000]}
        darkMode={darkMode}
        onClose={() => setBudgetTargetCategory(null)}
        onConfirm={(amt) => {
          if (budgetTargetCategory) {
            setBudgetTarget(setGameState, budgetTargetCategory, amt);
            queueSave();
          }
          setBudgetTargetCategory(null);
        }}
      />

      {/* v22 Wave A: account-to-account transfer (exposes transferBetweenOwnAccounts). */}
      <AmountInputModal
        visible={!!(transferFromId && transferToId)}
        title="Transfer amount"
        subtitle={(() => {
          const from = banking.accounts.find((a) => a.id === transferFromId);
          const to = banking.accounts.find((a) => a.id === transferToId);
          return from && to ? `${from.name} → ${to.name} · Available ${formatMoney(from.balance)}` : undefined;
        })()}
        confirmLabel="Transfer"
        maxAmount={banking.accounts.find((a) => a.id === transferFromId)?.balance}
        presets={[100, 500, 1000]}
        darkMode={darkMode}
        onClose={() => { setTransferFromId(null); setTransferToId(null); }}
        onConfirm={(amt) => {
          if (transferFromId && transferToId) {
            transferBetweenOwnAccounts(setGameState, transferFromId, transferToId, amt);
            queueSave();
          }
          setTransferFromId(null);
          setTransferToId(null);
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

      {/* Charge a purchase to the card — grows the (interest-bearing) balance now
          with no cash movement; cashback then accrues when you pay the balance
          down (see chargeCreditCard / payCreditCard anti-exploit note). */}
      <AmountInputModal
        visible={!!chargeCardId}
        title="Charge to card"
        subtitle={
          chargeCard
            ? `Available credit: ${formatMoney(chargeAvailableCredit)}. Adds to your balance now — pay it down later to earn ${(chargeCard.rewardsRate * 100).toFixed(1)}% cashback.`
            : `Cash on hand: ${formatMoney(cash)}`
        }
        confirmLabel="Charge"
        maxAmount={chargeAvailableCredit}
        presets={[100, 500, 1000]}
        darkMode={darkMode}
        onClose={() => setChargeCardId(null)}
        onConfirm={(amt) => {
          if (chargeCardId) {
            spendOnCard(setGameState, chargeCardId, amt, 'Purchase');
            queueSave();
          }
          setChargeCardId(null);
        }}
      />
    </View>
  );
}

// ─────────────────────────── Presentational helpers ──────────────────────────

function SummaryColumn({
  theme,
  label,
  value,
  caption,
  valueColor,
  emphasize,
}: {
  theme: ReturnType<typeof getThemeColors>;
  label: string;
  value: string;
  caption?: string;
  valueColor?: string;
  emphasize?: boolean;
}) {
  return (
    <View style={styles.summaryCol}>
      <Text style={[styles.colLabel, { color: theme.textMuted }]} numberOfLines={1}>{label}</Text>
      <Text
        style={[emphasize ? styles.colValueEmph : styles.colValue, { color: valueColor ?? theme.text }]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.55}
      >
        {value}
      </Text>
      {caption && <Text style={[styles.colCaption, { color: theme.textMuted }]} numberOfLines={1}>{caption}</Text>}
    </View>
  );
}

function SummaryCell({
  theme,
  icon: Icon,
  label,
  value,
  tint,
  valueColor,
}: {
  theme: ReturnType<typeof getThemeColors>;
  icon: React.ComponentType<{ size: number; color: string }>;
  label: string;
  value: string;
  tint?: string;
  valueColor?: string;
}) {
  return (
    <View style={[styles.summaryCell, { backgroundColor: theme.surfaceElevated }]}>
      <View style={styles.summaryCellTop}>
        <Icon size={scale(12)} color={tint ?? theme.textMuted} />
        <Text style={[styles.summaryCellLabel, { color: theme.textMuted }]} numberOfLines={1}>{label}</Text>
      </View>
      <Text style={[styles.summaryCellValue, { color: valueColor ?? theme.text }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
        {value}
      </Text>
    </View>
  );
}

function StatementSection({
  theme,
  darkMode,
  columns,
  children,
}: {
  theme: ReturnType<typeof getThemeColors>;
  darkMode: boolean;
  columns?: [string, string];
  children: React.ReactNode;
}) {
  return (
    <View style={[getGlassCard(darkMode, 6), styles.ledgerCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      {columns && (
        <View style={[styles.ledgerHeader, { borderBottomColor: theme.border }]}>
          <Text style={[styles.colHeadText, { color: theme.textMuted }]}>{columns[0]}</Text>
          <Text style={[styles.colHeadText, { color: theme.textMuted }]}>{columns[1]}</Text>
        </View>
      )}
      {children}
    </View>
  );
}

function LedgerRow({
  theme,
  darkMode,
  divider,
  icon: Icon,
  tintHex,
  tintRGB,
  label,
  sub,
  value,
  valueColor,
  chevron,
  onPress,
  emphasize,
  accessibilityLabel,
}: {
  theme: ReturnType<typeof getThemeColors>;
  darkMode: boolean;
  divider?: boolean;
  icon?: React.ComponentType<{ size: number; color: string }>;
  tintHex?: string;
  tintRGB?: string;
  label: string;
  sub?: string;
  value?: string;
  valueColor?: string;
  chevron?: boolean;
  onPress?: () => void;
  emphasize?: boolean;
  accessibilityLabel?: string;
}) {
  const content = (
    <>
      {Icon && (
        <View style={[getGlassIconContainer(darkMode, 32), { backgroundColor: `rgba(${tintRGB ?? '59, 130, 246'}, 0.15)`, borderWidth: 1, borderColor: `rgba(${tintRGB ?? '59, 130, 246'}, 0.30)` }]}>
          <Icon size={scale(16)} color={tintHex ?? accent.info} />
        </View>
      )}
      <View style={styles.ledgerBody}>
        <Text style={[emphasize ? styles.ledgerTotalLabel : styles.ledgerLabel, { color: theme.text }]} numberOfLines={1}>{label}</Text>
        {sub && <Text style={[styles.ledgerSub, { color: theme.textMuted }]} numberOfLines={1}>{sub}</Text>}
      </View>
      {value != null && (
        <Text style={[emphasize ? styles.ledgerTotalValue : styles.ledgerValue, { color: valueColor ?? theme.text }]} numberOfLines={1}>{value}</Text>
      )}
      {chevron && <ChevronRight size={scale(16)} color={theme.textMuted} />}
    </>
  );

  const rowStyle = [
    styles.ledgerRow,
    divider && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border },
    emphasize && styles.ledgerTotalRow,
  ];

  if (onPress) {
    return (
      <TouchableOpacity activeOpacity={0.7} onPress={onPress} accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? label} style={rowStyle}>
        {content}
      </TouchableOpacity>
    );
  }
  return <View style={rowStyle}>{content}</View>;
}

function FactCell({
  theme,
  icon: Icon,
  label,
  value,
  tint,
}: {
  theme: ReturnType<typeof getThemeColors>;
  icon: React.ComponentType<{ size: number; color: string }>;
  label: string;
  value: string;
  tint?: string;
}) {
  return (
    <View style={[styles.factCell, { backgroundColor: theme.surfaceElevated }]}>
      <View style={styles.factHead}>
        <Icon size={scale(12)} color={tint ?? theme.textMuted} />
        <Text style={[styles.factLabel, { color: theme.textMuted }]} numberOfLines={1}>{label}</Text>
      </View>
      <Text style={[styles.factValue, { color: theme.text }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{value}</Text>
    </View>
  );
}

function SectionTitle({ theme, children }: { theme: ReturnType<typeof getThemeColors>; children: React.ReactNode }) {
  return <Text style={[styles.sectionTitle, { color: theme.text }]}>{children}</Text>;
}

function SectionHeader({
  theme,
  title,
  meta,
  icon: Icon,
  addLabel,
  onAdd,
}: {
  theme: ReturnType<typeof getThemeColors>;
  title: string;
  meta?: string;
  icon?: React.ComponentType<{ size: number; color: string }>;
  addLabel?: string;
  onAdd?: () => void;
}) {
  return (
    <View style={styles.headerRow}>
      <View style={styles.headerTitleWrap}>
        <View style={styles.headerTitleLine}>
          {Icon && <Icon size={scale(15)} color={accent.info} />}
          <Text style={[styles.sectionTitle, { color: theme.text }]}>{title}</Text>
        </View>
        {meta && <Text style={[styles.sectionMeta, { color: theme.textMuted }]} numberOfLines={1}>{meta}</Text>}
      </View>
      {onAdd && (
        <TouchableOpacity
          onPress={onAdd}
          style={styles.addChip}
          accessibilityRole="button"
          accessibilityLabel={addLabel}
        >
          <Plus size={scale(12)} color={accent.info} />
          <Text style={styles.addChipText}>{addLabel ?? 'Add'}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

function EmptyCard({
  theme,
  darkMode,
  children,
}: {
  theme: ReturnType<typeof getThemeColors>;
  darkMode: boolean;
  children: React.ReactNode;
}) {
  // Give empty sections the same Recipe A card so they share the rhythm of
  // populated rows instead of floating as bare text (content at 60% opacity).
  return (
    <View style={[getGlassCard(darkMode, 6), styles.emptyCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <Text style={[styles.emptyText, { color: theme.textMuted }]}>{children}</Text>
    </View>
  );
}

function CreditScoreBreakdown({
  theme,
  darkMode,
  breakdown,
}: {
  theme: ReturnType<typeof getThemeColors>;
  darkMode: boolean;
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
    <View style={[getGlassCard(darkMode, 6), styles.breakdownCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      {rows.map((r) => (
        <View key={r.label} style={styles.breakdownRow}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.breakdownLabel, { color: theme.text }]}>
              {r.label} <Text style={{ color: theme.textMuted }}>· {r.weight}</Text>
            </Text>
            <View style={[styles.miniTrack, { backgroundColor: theme.surfaceElevated }]}>
              <View
                style={[
                  styles.miniFill,
                  {
                    width: `${Math.max(0, Math.min(100, r.value))}%`,
                    backgroundColor: r.value >= 70 ? accent.success : r.value >= 40 ? accent.warning : accent.danger,
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
    gap: responsiveSpacing.sm,
  },
  backBtn: {
    minWidth: scale(40),
    minHeight: scale(40),
    alignItems: 'center',
    justifyContent: 'center',
  },
  appTitle: { flex: 1, fontSize: responsiveFontSize.lg, fontWeight: '700' },
  headerRight: { minHeight: scale(40), alignItems: 'flex-end', justifyContent: 'center' },
  scoreChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingLeft: responsiveSpacing.sm,
    paddingRight: responsiveSpacing.xs,
    paddingVertical: 4,
    borderRadius: responsiveBorderRadius.full,
    borderWidth: 1,
  },
  scoreChipText: { fontSize: responsiveFontSize.sm, fontWeight: '700', fontVariant: ['tabular-nums'] },
  typeDot: {
    width: scale(30),
    height: scale(30),
    borderRadius: scale(15),
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
  },
  // Icon STACKED over the label, not beside it.
  //
  // The row layout needed ~80pt per tab ("Statement" at 12pt bold, plus a 16pt
  // icon and its gap). Four tabs on a 375pt screen gave 94pt each and it just
  // fit; the fifth (Tax) cut that to 75pt and the longest label started
  // squeezing. Stacking drops the requirement to the label width alone, so all
  // five sit on an even grid with room to spare — and an even grid is most of
  // what "premium" means in a tab bar.
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: scale(3),
    paddingVertical: responsiveSpacing.sm,
    paddingHorizontal: scale(2),
    minHeight: touchTargets.minimum,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabText: { fontSize: responsiveFontSize.xs, fontWeight: '600', letterSpacing: 0.2 },

  // ── Statement masthead (Recipe B): shadow on outer, tints clipped inside ──
  mastheadInner: {
    borderRadius: responsiveBorderRadius['2xl'],
    overflow: 'hidden',
    padding: responsiveSpacing.lg,
  },
  heroBlob: {
    position: 'absolute',
    top: -scale(48),
    right: -scale(36),
    width: scale(150),
    height: scale(150),
    borderRadius: scale(75),
    backgroundColor: 'rgba(59, 130, 246, 0.10)',
  },
  heroHairline: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  mastheadTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: responsiveSpacing.sm,
    marginBottom: responsiveSpacing.md,
  },
  mastheadTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: responsiveSpacing.xs,
  },
  mastheadEyebrow: {
    fontSize: responsiveFontSize.xs,
    fontWeight: '600',
    letterSpacing: 0.8,
  },
  periodChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: responsiveSpacing.sm,
    paddingVertical: 3,
    borderRadius: responsiveBorderRadius.full,
  },
  periodText: { fontSize: responsiveFontSize.xs, fontWeight: '700', fontVariant: ['tabular-nums'] },
  summaryColumns: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  summaryCol: {
    flex: 1,
    gap: scale(3),
    paddingHorizontal: responsiveSpacing.xs,
  },
  colDivider: {
    width: 1,
    alignSelf: 'stretch',
    marginVertical: scale(2),
    opacity: 0.8,
  },
  colLabel: {
    fontSize: responsiveFontSize.xs,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  colValue: {
    fontSize: responsiveFontSize.xl,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  colValueEmph: {
    fontSize: responsiveFontSize['2xl'],
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  colCaption: {
    fontSize: scale(9),
    fontWeight: '500',
  },

  // ── Section titles / headers ──────────────────────────────────────────────
  sectionTitle: {
    fontSize: responsiveFontSize.md,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: responsiveSpacing.sm,
  },
  headerTitleWrap: { flex: 1 },
  headerTitleLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: responsiveSpacing.xs,
  },
  sectionMeta: {
    fontSize: responsiveFontSize.xs,
    marginTop: 1,
    fontVariant: ['tabular-nums'],
  },
  addChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: responsiveSpacing.sm,
    paddingVertical: responsiveSpacing.xs,
    borderRadius: responsiveBorderRadius.full,
    backgroundColor: 'rgba(59, 130, 246, 0.14)',
  },
  addChipText: { color: accent.info, fontSize: responsiveFontSize.xs, fontWeight: '700' },

  // ── Statement ledger cards + slim rows ────────────────────────────────────
  ledgerCard: {
    paddingHorizontal: responsiveSpacing.md,
    borderRadius: responsiveBorderRadius.xl,
    borderWidth: 1,
  },
  ledgerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: responsiveSpacing.sm,
    paddingBottom: responsiveSpacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  colHeadText: {
    fontSize: scale(9),
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  ledgerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: responsiveSpacing.sm,
    paddingVertical: responsiveSpacing.sm,
  },
  ledgerBody: { flex: 1 },
  ledgerLabel: { fontSize: responsiveFontSize.sm, fontWeight: '700' },
  ledgerSub: { fontSize: responsiveFontSize.xs, marginTop: 1, fontVariant: ['tabular-nums'] },
  ledgerValue: { fontSize: responsiveFontSize.md, fontWeight: '800', fontVariant: ['tabular-nums'] },
  ledgerTotalRow: {
    borderTopWidth: 1,
    marginTop: 2,
  },
  ledgerTotalLabel: { fontSize: responsiveFontSize.md, fontWeight: '800', letterSpacing: 0.2 },
  ledgerTotalValue: { fontSize: responsiveFontSize.lg, fontWeight: '800', fontVariant: ['tabular-nums'] },

  // ── Summary strips (accounts / borrow / budget) ───────────────────────────
  summaryStrip: {
    flexDirection: 'row',
    gap: responsiveSpacing.sm,
  },

  transferBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: responsiveSpacing.xs,
    borderWidth: 1,
    borderRadius: responsiveBorderRadius.lg,
    paddingVertical: responsiveSpacing.sm,
    minHeight: touchTargets.minimum,
  },
  transferBtnText: {
    fontSize: responsiveFontSize.sm,
    fontWeight: '700',
  },
  summaryCell: {
    flex: 1,
    borderRadius: responsiveBorderRadius.lg,
    padding: responsiveSpacing.sm,
    gap: scale(4),
  },
  summaryCellTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  summaryCellLabel: { fontSize: responsiveFontSize.xs, fontWeight: '600', flex: 1 },
  summaryCellValue: { fontSize: responsiveFontSize.md, fontWeight: '800', fontVariant: ['tabular-nums'] },

  // ── Weekly spend trend (Views, not SVG — crash-safe) ──────────────────────
  trendCard: {
    padding: responsiveSpacing.md,
    borderRadius: responsiveBorderRadius.xl,
    borderWidth: 1,
    gap: responsiveSpacing.sm,
  },
  trendHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  trendTitle: { fontSize: responsiveFontSize.sm, fontWeight: '700' },
  trendMeta: { fontSize: responsiveFontSize.xs, fontVariant: ['tabular-nums'] },
  barChart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: scale(4),
    height: scale(48),
  },
  barSlot: {
    flex: 1,
    height: '100%',
    justifyContent: 'flex-end',
  },
  bar: {
    width: '100%',
    borderRadius: responsiveBorderRadius.sm,
    minHeight: scale(3),
  },

  // ── Report CTA + manage link ──────────────────────────────────────────────
  reportCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: responsiveSpacing.xs,
    minHeight: scale(40),
    borderRadius: responsiveBorderRadius.full,
    borderWidth: 1,
  },
  reportCtaText: { fontSize: responsiveFontSize.sm, fontWeight: '700' },
  manageChip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: responsiveSpacing.xs,
    minHeight: scale(40),
    borderRadius: responsiveBorderRadius.full,
    borderWidth: 1,
  },
  manageChipText: { fontSize: responsiveFontSize.sm, fontWeight: '700' },

  // ── Empty state ───────────────────────────────────────────────────────────
  emptyCard: {
    borderRadius: responsiveBorderRadius.xl,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: responsiveSpacing.lg,
    paddingHorizontal: responsiveSpacing.md,
  },
  emptyText: {
    fontSize: responsiveFontSize.sm,
    textAlign: 'center',
    opacity: 0.7,
  },

  // ── Credit breakdown card ─────────────────────────────────────────────────
  breakdownCard: {
    padding: responsiveSpacing.md,
    borderRadius: responsiveBorderRadius.xl,
    borderWidth: 1,
    gap: responsiveSpacing.sm,
  },
  breakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: responsiveSpacing.sm,
  },
  breakdownLabel: { fontSize: responsiveFontSize.sm, fontWeight: '600' },
  breakdownValue: { fontSize: responsiveFontSize.md, fontWeight: '700', minWidth: scale(28), textAlign: 'right', fontVariant: ['tabular-nums'] },
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

  // ── Account detail: hero balance ──────────────────────────────────────────
  detailHeroInner: {
    borderRadius: responsiveBorderRadius['2xl'],
    overflow: 'hidden',
    padding: responsiveSpacing.lg,
    gap: responsiveSpacing.sm,
  },
  detailBalance: {
    fontSize: responsiveFontSize['4xl'],
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  detailChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: responsiveSpacing.xs,
  },
  aprChipLg: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: responsiveSpacing.sm,
    paddingVertical: 3,
    borderRadius: responsiveBorderRadius.full,
    borderWidth: 1,
  },
  aprTextLg: { fontSize: responsiveFontSize.xs, fontWeight: '700', fontVariant: ['tabular-nums'] },
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: responsiveSpacing.sm,
    paddingVertical: 3,
    borderRadius: responsiveBorderRadius.full,
    borderWidth: 1,
  },
  statusText: { fontSize: responsiveFontSize.xs, fontWeight: '700', fontVariant: ['tabular-nums'] },

  // ── Account detail: primary CTA + secondary actions ───────────────────────
  ctaShadow: { borderRadius: responsiveBorderRadius.full },
  ctaInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: responsiveSpacing.xs,
    minHeight: touchTargets.minimum,
    borderRadius: responsiveBorderRadius.full,
    overflow: 'hidden',
  },
  ctaText: { color: '#fff', fontSize: responsiveFontSize.md, fontWeight: '800' },
  detailSecondaryRow: {
    flexDirection: 'row',
    gap: responsiveSpacing.sm,
  },
  secondaryBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: touchTargets.minimum,
    borderRadius: responsiveBorderRadius.full,
  },
  secondaryText: { fontSize: responsiveFontSize.sm, fontWeight: '700' },
  disabled: { opacity: 0.4 },
  roCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: responsiveSpacing.sm,
    padding: responsiveSpacing.md,
    borderRadius: responsiveBorderRadius.xl,
    borderWidth: 1,
  },
  roCardText: { flex: 1, fontSize: responsiveFontSize.sm, lineHeight: responsiveFontSize.md * 1.35 },

  // ── Detail: grouped cards (facts) ─────────────────────────────────────────
  detailSectionTitle: { marginTop: responsiveSpacing.xs },
  groupCard: {
    padding: responsiveSpacing.md,
    borderRadius: responsiveBorderRadius.xl,
    borderWidth: 1,
    gap: responsiveSpacing.sm,
  },
  factsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: responsiveSpacing.sm,
  },
  factCell: {
    flexBasis: '47%',
    flexGrow: 1,
    borderRadius: responsiveBorderRadius.lg,
    padding: responsiveSpacing.sm,
    gap: scale(4),
  },
  factHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: responsiveSpacing.xs,
  },
  factLabel: { fontSize: responsiveFontSize.xs, fontWeight: '600', flex: 1 },
  factValue: { fontSize: responsiveFontSize.md, fontWeight: '800', fontVariant: ['tabular-nums'] },

  // ── Credit detail: sparkline + trend ──────────────────────────────────────
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: responsiveSpacing.sm,
  },
  deltaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: responsiveSpacing.sm,
    paddingVertical: 3,
    borderRadius: responsiveBorderRadius.full,
  },
  deltaText: { fontSize: responsiveFontSize.xs, fontWeight: '800', fontVariant: ['tabular-nums'] },
  sparkWrap: { width: '100%', height: scale(56) },
  sparkScale: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: responsiveSpacing.xs,
  },
  sparkScaleText: { fontSize: responsiveFontSize.xs, fontVariant: ['tabular-nums'] },
  trendEmpty: { fontSize: responsiveFontSize.sm, lineHeight: responsiveFontSize.md * 1.4 },
});
