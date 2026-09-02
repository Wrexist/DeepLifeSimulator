/**
 * BankApp - mobile (phone-style) banking screen.
 *
 * Remake (STATE_VERSION 14). Slim mobile counterpart to AdvancedBankApp.
 *
 * Apple-Wallet DNA: accounts render as a stacked deck of full-width card faces
 * (per-type flat tint) instead of uniform rows, and tapping a card - or the
 * credit gauge - pushes a presentational detail page (local useState routing,
 * no new game mechanics) that surfaces state the flat list never showed
 * (account age, min balance, autopay draws, credit-score breakdown + trend +
 * inquiries). All banking flows still run through the shared `components/banking/*`
 * + `lib/banking/*` primitives and modals - no logic duplication.
 */

import React, { useState, useMemo, useCallback } from 'react';
import { displayedDepositAPR, depositAPRNote } from '@/lib/banking/displayRates';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import Svg, { Polyline } from 'react-native-svg';
import {
  TrendingUp,
  TrendingDown,
  Receipt,
  Percent,
  Lock,
  FileText,
  ChevronRight,
  Gift,
  Landmark,
  CreditCard as CreditCardIcon,
  Target,
  CalendarClock,
} from 'lucide-react-native';
import { useGame } from '@/contexts/GameContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ErrorBoundary from '@/components/ErrorBoundary';
import { responsiveFontSize, responsiveSpacing, responsiveBorderRadius, scale, touchTargets, getAppScreenBottomPadding } from '@/utils/scaling';
import { getThemeColors, accent, withAlpha } from '@/lib/config/theme';
import { kicker, rhythm, tier1Title } from '@/lib/config/hierarchy';
import { getGlassCard, getGlassButton, getGlassIconContainer } from '@/utils/glassmorphismStyles';
import { initialGameState } from '@/contexts/game/initialState';
import { isReadOnlyMirror, canCloseAccount } from '@/lib/banking/operations';

import CreditScoreGauge from '@/components/banking/CreditScoreGauge';
import AccountRow, { accountPalette, accountTypeLabel } from '@/components/banking/AccountRow';
import LoanRow from '@/components/banking/LoanRow';
import CreditCardRow from '@/components/banking/CreditCardRow';
import BillPayRow from '@/components/banking/BillPayRow';
import SavingsGoalCard from '@/components/banking/SavingsGoalCard';
import AmountInputModal from '@/components/banking/AmountInputModal';
import AccountTransferPanel, { TransferDirection } from '@/components/banking/AccountTransferPanel';
import OpenAccountModal from '@/components/banking/OpenAccountModal';
import LoanQuoteModal from '@/components/banking/LoanQuoteModal';
import ApplyCardModal from '@/components/banking/ApplyCardModal';
import AddBillModal from '@/components/banking/AddBillModal';
import TaxStatement from '@/components/banking/TaxStatement';
import { clampTaxMult, taxYearOf } from '@/lib/economy/taxLedger';
import { companyIncomePaidWeekly } from '@/lib/economy/passiveIncome';
import { getLifeSkillModifiers } from '@/lib/skillTrees/lifeSkillEffects';

import { BankAccount, BillPayRule, BudgetCategory, CreditCardTier, Loan, SavingsGoalCategory } from '@/contexts/game/types';
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
  contributeToSavingsGoal,
  withdrawFromSavingsGoal,
  createSavingsGoal,
  claimAdCashBonus,
  getAdCashBonusAmount,
  canClaimAdCashBonus,
} from '@/contexts/game/actions/BankingActions';
import { acceptLoan, prepayLoan } from '@/contexts/game/actions/LoanActions';
import WatchAdRewardButton from '@/components/WatchAdRewardButton';
import { weeklyCareerSalary } from '@/lib/careers/weeklySalary';

import { formatMoney } from '@/utils/moneyFormatting';
import { gameAlert } from '@/utils/gameAlert';
import { EmptyCard as EmptyText } from '@/components/ui/EmptyState';
import AppHeader, { HeaderChip } from '@/components/ui/AppHeader';
import StatStrip from '@/components/ui/StatStrip';
import SectionTitle from '@/components/ui/SectionTitle';
import Chip from '@/components/ui/Chip';
import ProgressBar from '@/components/ui/ProgressBar';
import CollapsibleSection from '@/components/ui/CollapsibleSection';

interface BankAppProps {
  onBack: () => void;
}

/** Local list→detail routing (presentational only - reads existing state). */
type BankSubView = { kind: 'account'; id: string } | { kind: 'credit' } | { kind: 'tax' } | null;

function formatMoneyExact(n: number): string {
  if (!isFinite(n)) return '$0';
  return `$${Math.round(n).toLocaleString()}`;
}

/** 0–100 breakdown score → traffic-light tint (green healthy … red weak). */
function scoreColor(v: number): string {
  if (v >= 75) return accent.success;
  if (v >= 50) return accent.gold;
  if (v >= 30) return accent.warning;
  return accent.danger;
}

const BREAKDOWN_META: { key: 'paymentHistory' | 'utilization' | 'accountAge' | 'creditMix' | 'inquiries'; label: string; weight: number }[] = [
  { key: 'paymentHistory', label: 'Payment history', weight: 35 },
  { key: 'utilization', label: 'Credit utilization', weight: 30 },
  { key: 'accountAge', label: 'Account age', weight: 15 },
  { key: 'creditMix', label: 'Credit mix', weight: 10 },
  { key: 'inquiries', label: 'New inquiries', weight: 10 },
];

function inquiryLabel(type: 'loan' | 'card' | 'mortgage'): string {
  if (type === 'loan') return 'Loan application';
  if (type === 'mortgage') return 'Mortgage application';
  return 'Credit card application';
}

function BankAppInner({ onBack }: BankAppProps) {
  const { gameState, setGameState, saveGame } = useGame();
  const insets = useSafeAreaInsets();
  const darkMode = !!gameState.settings?.darkMode;
  const theme = getThemeColors(darkMode);
  const banking = gameState.banking ?? initialGameState.banking!;

  const [subView, setSubView] = useState<BankSubView>(null);
  const [sparkWidth, setSparkWidth] = useState(0);

  const [depositTarget, setDepositTarget] = useState<BankAccount | null>(null);
  const [withdrawTarget, setWithdrawTarget] = useState<BankAccount | null>(null);
  const [showOpenAccount, setShowOpenAccount] = useState(false);
  const [showLoanQuote, setShowLoanQuote] = useState(false);
  const [showApplyCard, setShowApplyCard] = useState(false);
  const [showAddBill, setShowAddBill] = useState(false);
  const [addGoalPick, setAddGoalPick] = useState<{ name: string; category: SavingsGoalCategory } | null>(null);
  // Second step of goal creation: the weekly auto-contribution. `applySavingsGoals`
  // has swept `goal.autoContribute` every week since it shipped, with tests
  // proving asset conservation - but nothing could ever SET it, so the sweep ran
  // over `undefined` forever. Mirrors the desktop Bank Pro flow.
  const [autoGoalPick, setAutoGoalPick] = useState<
    { name: string; category: SavingsGoalCategory; targetAmount: number } | null
  >(null);
  const [contributeGoalId, setContributeGoalId] = useState<string | null>(null);
  // R3-M5: goal money used to be unrecoverable - contributing was a one-way door.
  const [withdrawGoalId, setWithdrawGoalId] = useState<string | null>(null);
  const [prepayLoanId, setPrepayLoanId] = useState<string | null>(null);
  const [payCardId, setPayCardId] = useState<string | null>(null);

  const cash = gameState.stats?.money ?? 0;
  const loans = gameState.loans ?? [];
  // Rewarded-ad cash bonus: ~2% of current cash, floored at $50 and capped at
  // $5,000 (clean $10 steps) so it helps early and never breaks the economy.
  // Quoted from the same helper the action pays from, so the pill can never
  // advertise a number the grant does not honour.
  const adCashBonus = getAdCashBonusAmount(gameState);
  const adBonusReady = canClaimAdCashBonus(gameState);
  const totalBank = banking.accounts.reduce((s, a) => s + a.balance, 0);
  const totalDebt =
    banking.creditCards.reduce((s, c) => s + c.balance, 0) +
    (gameState.loans ?? []).reduce((s, l) => s + l.remaining, 0);

  /**
   * The one thing due NOW, if anything is - the Bank's lead slot. At most one,
   * by severity: an overdrawn account (money already gone) > a loan draw that
   * will miss this week > an auto-pay bill that is due. The predicates are the
   * ones the rows already read and the tick already applies, so the lead can
   * never name a problem the screen or the week loop would not.
   *
   * "Loan payment lands this week" is deliberately NOT "any loan": every live
   * loan amortises weekly, so a mortgage would lead the screen for thirty
   * years and the lead would never move. A draw leads when the tick's own miss
   * branch would take it (`applyLoanAutopay`: the payment exceeds the cash on
   * hand the strip shows) or when the row is already warning of a missed one.
   * A disabled bill is skipped: paused rules are not drawn, so "due" is moot.
   */
  const dueLead = useMemo<
    | { kind: 'account'; account: BankAccount }
    | { kind: 'loan'; loan: Loan }
    | { kind: 'bill'; rule: BillPayRule }
    | null
  >(() => {
    const overdrawn = banking.accounts.find((a) => a.balance < 0);
    if (overdrawn) return { kind: 'account', account: overdrawn };
    // `gameState.loans` rather than the `loans` alias: the alias's `?? []`
    // fallback is a new array every render, which would defeat this memo.
    const atRisk = (gameState.loans ?? []).find((l) => l.remaining > 0 && ((l.latePayments ?? 0) > 0 || l.weeklyPayment > cash));
    if (atRisk) return { kind: 'loan', loan: atRisk };
    const dueBill = banking.billPayRules.find((r) => r.enabled && r.nextDueWeek - gameState.weeksLived <= 0);
    if (dueBill) return { kind: 'bill', rule: dueBill };
    return null;
  }, [banking.accounts, banking.billPayRules, gameState.loans, cash, gameState.weeksLived]);

  // Cross-app tile: what the player has working in the market apps (Stocks +
  // Crypto holdings at current prices), so the Bank is the one money overview.
  const investedValue = useMemo(() => {
    const stocksValue = (gameState.stocks?.holdings ?? []).reduce(
      (s, h) => s + (h.shares ?? 0) * (h.currentPrice ?? 0), 0);
    const cryptoValue = (gameState.cryptos ?? []).reduce(
      (s, c) => s + (c.owned ?? 0) * (c.price ?? 0), 0);
    return stocksValue + cryptoValue;
  }, [gameState.stocks?.holdings, gameState.cryptos]);

  const weeklyIncome = useMemo(() => {
    let income = 0;
    // R3-M3: political salaries are ANNUAL; every other ladder is weekly. This
    // read them all as weekly, so an elected player's borrowing capacity was
    // inflated 52x at the DTI gate. One shared helper now encodes the rule.
    income += weeklyCareerSalary(gameState);
    // Same fix as AdvancedBankApp: the stored `weeklyIncome` is the base before
    // every step of the payout chain, so summing it overstated both this
    // headline and the DTI gate it feeds.
    income += companyIncomePaidWeekly(gameState);
    return income;
  }, [gameState.careers, gameState.currentJob, gameState.companies]);

  // Tax Strategy discount, read from the same source the week loop charges from
  // so the Tax page cannot quote a rate the tick does not apply.
  const taxMult = useMemo(
    () => clampTaxMult(getLifeSkillModifiers(gameState).taxMult),
    [gameState]
  );

  /**
   * The savings-goal category picker. Unchanged flow (the same three-way
   * `gameAlert` chain it always was) - lifted out of the section header only
   * so the header can be a one-line `Chip`.
   */
  const pickSavingsGoal = useCallback(() => {
    gameAlert('What are you saving for?', undefined, [
      { text: 'Emergency Fund', onPress: () => setAddGoalPick({ name: 'Emergency Fund', category: 'emergency' }) },
      { text: 'House', onPress: () => setAddGoalPick({ name: 'House Fund', category: 'house' }) },
      {
        text: 'More…',
        onPress: () =>
          gameAlert('What are you saving for?', undefined, [
            { text: 'Vacation', onPress: () => setAddGoalPick({ name: 'Vacation', category: 'vacation' }) },
            { text: 'Retirement', onPress: () => setAddGoalPick({ name: 'Retirement', category: 'retirement' }) },
            { text: 'Custom Goal', onPress: () => setAddGoalPick({ name: 'Custom Goal', category: 'other' }) },
          ]),
      },
    ]);
  }, []);

  const queueSave = useCallback(() => {
    saveGame().catch(() => {});
  }, [saveGame]);

  const confirmCloseAccount = useCallback(
    (acct: BankAccount) => {
      gameAlert(
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


  // ───────────────────────────── Account detail page ───────────────────────
  /**
   * Stable transfer handler for the account the detail view currently has open.
   *
   * `AccountTransferPanel` is a child component, so an inline arrow was a fresh
   * prop identity on every render - exactly what the panel's own memo work
   * exists to avoid. Keyed on the OPEN account id rather than curried by id: a
   * curried factory would still allocate per render and change nothing.
   */
  const openAccountId = subView?.kind === 'account' ? subView.id : null;
  const handleTransfer = useCallback(
    (dir: TransferDirection, amt: number) => {
      if (!openAccountId) return;
      if (dir === 'deposit') depositCashToAccount(setGameState, openAccountId, amt);
      else withdrawCashFromAccount(setGameState, openAccountId, amt);
      queueSave();
    },
    [setGameState, queueSave, openAccountId]
  );

  const renderAccountDetail = (account: BankAccount) => {
    const pal = accountPalette(account.type);
    // Only `checking-default` is read-only now. `savings-default` deposits and
    // withdraws through `bankSavings` - see LEGACY_SAVINGS_ACCOUNT_ID.
    const isMirrored =
      isReadOnlyMirror(account.id);
    const isLocked = account.lockUntilWeek != null && gameState.weeksLived < account.lockUntilWeek;
    const ageWeeks = Math.max(0, gameState.weeksLived - account.openedWeek);
    const ageLabel = ageWeeks >= 52 ? `${(ageWeeks / 52).toFixed(1)}y · ${ageWeeks}w` : `${ageWeeks}w`;
    const relatedBills = banking.billPayRules.filter((b) => b.fromAccountId === account.id);

    return (
      <>
        <AppHeader title={account.name} onBack={() => setSubView(null)} backLabel="Back to bank" />
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: responsiveSpacing.md, paddingBottom: getAppScreenBottomPadding(insets.bottom), gap: responsiveSpacing.md }}
        >
          {/* Hero card face */}
          <View
            style={[
              getGlassCard(darkMode, 12),
              { backgroundColor: theme.surface, borderColor: darkMode ? theme.glassBorder : theme.border, borderWidth: 1, borderRadius: responsiveBorderRadius['2xl'] },
            ]}
          >
            <View style={styles.detailHeroInner}>
              <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: withAlpha(pal.hex, darkMode ? 0.14 : 0.1) }]} />
              <Text style={[styles.heroEyebrow, { color: theme.textMuted }]}>{accountTypeLabel(account.type).toUpperCase()}</Text>
              <Text style={[styles.detailBalance, { color: theme.text }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.5}>
                {formatMoneyExact(account.balance)}
              </Text>
              <View style={styles.detailChipRow}>
                {account.baseAPR > 0 && (
                  <Chip
                    label={`${(displayedDepositAPR(account.baseAPR, banking.rateEnvironment) * 100).toFixed(2)}% APR`}
                    tint={pal.hex}
                    icon={<TrendingUp size={scale(11)} color={pal.hex} />}
                  />
                )}
                {/* Attribute a moved rate to the economy. Without this a reduced
                    number reads as the bank changing its offer, and the
                    "savings yields drift down" event banner looks cosmetic. */}
                {account.baseAPR > 0 && depositAPRNote(banking.rateEnvironment) ? (
                  <Chip label={depositAPRNote(banking.rateEnvironment) ?? ''} tint={pal.hex} />
                ) : null}
                <Chip
                  label={isLocked ? `Locked · wk ${account.lockUntilWeek}` : 'Active'}
                  tone={isLocked ? 'warning' : 'success'}
                  icon={<Lock size={scale(10)} color={isLocked ? accent.warning : accent.success} />}
                />
              </View>
            </View>
          </View>

          {/* Actions - one loud CTA (Deposit) for non-mirrored accounts */}
          {isMirrored ? (
            <View style={[getGlassCard(darkMode, 6), styles.roCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <Lock size={scale(14)} color={theme.textMuted} />
              <Text style={[styles.roCardText, { color: theme.textMuted }]}>
                This is a primary account that mirrors your cash - deposits, withdrawals and closing are handled automatically.
              </Text>
            </View>
          ) : (
            <View style={{ gap: responsiveSpacing.sm }}>
              {/* Moving money is the reason this screen gets opened, so it is
                  the control on the screen rather than two buttons that each
                  open a modal with a keyboard. Slider + percentage chips
                  because the amounts people pick are proportions ("half of it")
                  far more often than round numbers. */}
              <AccountTransferPanel
                cashAvailable={cash}
                accountBalance={account.balance}
                tint={pal.hex}
                darkMode={darkMode}
                withdrawDisabled={isLocked}
                withdrawDisabledReason={isLocked ? `Locked until week ${account.lockUntilWeek}` : undefined}
                onSubmit={handleTransfer}
              />
              {/* `closeAccount` refuses every id in MIRRORED_ACCOUNT_IDS
                  ("Your primary checking and savings accounts cannot be
                  closed"), so offering Close on the legacy savings account
                  renders a control that can only ever fail. `AccountRow`
                  already drops it for the same reason; this detail view is a
                  separate component and needed the same guard. Caught by
                  driving the real app, not by the suite. */}
              {canCloseAccount(account.id) && (
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
              )}
            </View>
          )}

          {/* Facts grid (surfaces openedWeek / age / minBalance, grouped in one card) */}
          <SectionTitle title="Account details" />
          <View style={[getGlassCard(darkMode, 6), styles.groupCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <StatStrip
              items={[
                { label: 'Type', value: accountTypeLabel(account.type), tint: pal.hex },
                {
                  label: 'Interest APR',
                  value: `${(displayedDepositAPR(account.baseAPR, banking.rateEnvironment) * 100).toFixed(2)}%`,
                  sub: depositAPRNote(banking.rateEnvironment) || undefined,
                },
                { label: 'Min balance', value: account.minBalance ? formatMoneyExact(account.minBalance) : 'None' },
              ]}
            />
            <StatStrip
              items={[
                { label: 'Balance', value: formatMoneyExact(account.balance) },
                { label: 'Opened', value: `Week ${account.openedWeek}` },
                { label: 'Age', value: ageLabel },
              ]}
            />
          </View>

          {/* Autopay drawing from this account - activity-style rows */}
          <SectionTitle title="Auto-pay from this account" />
          {relatedBills.length === 0 ? (
            <EmptyText theme={theme} darkMode={darkMode}>No auto-pay rules draw from this account.</EmptyText>
          ) : (
            <View style={[getGlassCard(darkMode, 6), styles.groupCard, { backgroundColor: theme.surface, borderColor: theme.border, gap: 0 }]}>
              {relatedBills.map((bill, i) => {
                const due = bill.nextDueWeek - gameState.weeksLived;
                const dueText = due <= 0 ? 'Due now' : due === 1 ? 'Due next week' : `Due in ${due} weeks`;
                return (
                  <View key={bill.id} style={[styles.activityRow, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border }]}>
                    <View style={[getGlassIconContainer(darkMode, 34), { backgroundColor: withAlpha(accent.info, 0.15), borderWidth: 1, borderColor: withAlpha(accent.info, 0.3) }]}>
                      <Receipt size={scale(16)} color={accent.info} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.activityLabel, { color: theme.text }]} numberOfLines={1}>{bill.label}</Text>
                      <Text style={[styles.activityMeta, { color: bill.enabled ? theme.textMuted : accent.warning }]} numberOfLines={1}>
                        {bill.cadence === 'weekly' ? 'Weekly' : 'Monthly'} · {bill.enabled ? dueText : 'Paused'}
                        {bill.missedCount > 0 ? ` · ${bill.missedCount} missed` : ''}
                      </Text>
                    </View>
                    <Text style={[styles.activityAmount, { color: theme.text }]}>{formatMoneyExact(bill.amount)}</Text>
                  </View>
                );
              })}
            </View>
          )}
        </ScrollView>
      </>
    );
  };

  // ───────────────────────────── Credit report page ────────────────────────
  // ─────────────────────────────── Tax page ──────────────────────────────────
  //
  // The tax surface shipped on the DESKTOP bank app only, so the whole system -
  // brackets, the year-to-date total, the four other taxes, the Tax Strategy
  // discount - was behind a $5,000 computer. A player crosses their first
  // bracket around week 10, long before they can buy one. Same trap renting was
  // in, same fix: put it where the early player already is.
  //
  // Renders the SAME `TaxStatement` the desktop tab does, so the two cannot
  // disagree about what the game charges.
  const renderTaxDetail = () => (
    <>
      <AppHeader
        title={`Tax · Year ${taxYearOf(gameState.weeksLived)}`}
        onBack={() => setSubView(null)}
        backLabel="Back to bank"
      />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: responsiveSpacing.md, paddingBottom: getAppScreenBottomPadding(insets.bottom), gap: responsiveSpacing.md }}
      >
        {/* The ledger the overview used to carry as five chips. It belongs with
            the tax statement: these are the year's money in and out, not a
            number anyone decides on from the landing screen. */}
        <SectionTitle title="Money in and out" />
        <View style={[getGlassCard(darkMode, 6), styles.groupCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <StatStrip
            items={[
              { label: 'Income', value: formatMoney(weeklyIncome), sub: 'per week', tint: accent.success },
              { label: 'Interest earned', value: formatMoney(banking.totalInterestEarned), tint: accent.success },
              { label: 'Interest paid', value: formatMoney(banking.totalInterestPaid), tint: accent.danger },
            ]}
          />
          <StatStrip
            items={[
              { label: 'Late fees', value: formatMoney(banking.totalLateFeesPaid), tint: accent.warning },
              // The number is tax already PAID this game year, not a bill
              // waiting to be settled.
              { label: 'Tax paid', value: formatMoney(banking.taxDueThisYear), tint: accent.warning },
            ]}
          />
        </View>

        <TaxStatement
          banking={banking}
          weeksLived={gameState.weeksLived}
          weeklyIncome={weeklyIncome}
          taxMult={taxMult}
          darkMode={darkMode}
        />
      </ScrollView>
    </>
  );

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
        <AppHeader title="Credit Report" onBack={() => setSubView(null)} backLabel="Back to bank" />
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: responsiveSpacing.md, paddingBottom: getAppScreenBottomPadding(insets.bottom), gap: responsiveSpacing.md }}
        >
          <CreditScoreGauge score={cs.score} band={cs.band} darkMode={darkMode} />

          {/* Score trend (real history - no fabricated arrays) */}
          <SectionTitle
            title="Score trend"
            right={
              hasTrend ? (
                <Chip
                  label={`${delta >= 0 ? '+' : ''}${delta} pts`}
                  tone={delta >= 0 ? 'success' : 'danger'}
                  icon={
                    delta >= 0 ? (
                      <TrendingUp size={scale(11)} color={accent.success} />
                    ) : (
                      <TrendingDown size={scale(11)} color={accent.danger} />
                    )
                  }
                />
              ) : undefined
            }
          />
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

          {/* Component breakdown - surfaces all five weighted factors */}
          <SectionTitle title="What's driving your score" />
          <View style={[getGlassCard(darkMode, 6), styles.groupCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            {BREAKDOWN_META.map((m, i) => {
              const v = Math.max(0, Math.min(100, cs.componentBreakdown[m.key] ?? 0));
              return (
                <View key={m.key} style={[styles.bdRow, i > 0 && { marginTop: responsiveSpacing.sm }]}>
                  <View style={styles.bdHead}>
                    <Text style={[styles.bdLabel, { color: theme.text }]} numberOfLines={1}>{m.label}</Text>
                    <Text style={[styles.weightText, { color: theme.textMuted }]}>{m.weight}% weight</Text>
                    <Text style={[styles.bdValue, { color: scoreColor(v) }]}>{Math.round(v)}</Text>
                  </View>
                  <ProgressBar value={v / 100} color={scoreColor(v)} label={m.label} />
                </View>
              );
            })}
          </View>

          {/* Recent inquiries */}
          <SectionTitle title="Recent inquiries" right={<Chip label={`Updated wk ${cs.lastUpdatedWeek}`} />} />
          {inquiries.length === 0 ? (
            <EmptyText theme={theme} darkMode={darkMode}>No recent credit inquiries. A clean file keeps this factor high.</EmptyText>
          ) : (
            <View style={[getGlassCard(darkMode, 6), styles.groupCard, { backgroundColor: theme.surface, borderColor: theme.border, gap: 0 }]}>
              {inquiries.map((inq, i) => {
                const ago = gameState.weeksLived - inq.weeksLived;
                const agoText = ago <= 0 ? 'this week' : ago === 1 ? '1 week ago' : `${ago} weeks ago`;
                return (
                  <View key={`${inq.weeksLived}-${i}`} style={[styles.activityRow, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border }]}>
                    <View style={[getGlassIconContainer(darkMode, 34), { backgroundColor: withAlpha(accent.info, 0.15), borderWidth: 1, borderColor: withAlpha(accent.info, 0.3) }]}>
                      <FileText size={scale(15)} color={accent.info} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.activityLabel, { color: theme.text }]} numberOfLines={1}>{inquiryLabel(inq.type)}</Text>
                      <Text style={[styles.activityMeta, { color: theme.textMuted }]}>Week {inq.weeksLived} · {agoText}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </ScrollView>
      </>
    );
  };

  // ───────────────────────────── Main list (Wallet deck) ───────────────────
  const renderMainList = () => (
    <>
      <AppHeader
        title="Bank"
        onBack={onBack}
        right={
          <HeaderChip
            label="Credit score"
            value={String(banking.creditScore.score)}
            tint={accent.info}
            onPress={() => setSubView({ kind: 'credit' })}
          />
        }
      />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          padding: responsiveSpacing.md,
          // Reserve space for the floating glass tab bar (cb5e306 sweep --
          // BankApp was the one sub-app still computing its own padding).
          paddingBottom: getAppScreenBottomPadding(insets.bottom),
          gap: responsiveSpacing.sm,
        }}
      >
        {/* The lead slot. Renders nothing when nothing is due, so the layout
            below is untouched for the player whose bank is quiet. The row is
            the SAME component with the SAME handlers as its section below -
            the lead adds position and a headline, never a new action. */}
        {dueLead && (
          <View
            style={[
              getGlassCard(darkMode, 12),
              styles.leadCard,
              { backgroundColor: theme.surface, borderColor: darkMode ? theme.glassBorder : theme.border },
            ]}
          >
            <View style={styles.leadInner}>
              <Text style={[styles.leadKicker, { color: theme.textMuted }]}>Due now</Text>
              {/* Semantic colour, not decoration: danger where money is already
                  gone or about to bounce, warning for a bill that is simply due. */}
              <Text
                style={[styles.leadTitle, { color: dueLead.kind === 'bill' ? accent.warning : accent.danger }]}
                numberOfLines={2}
                maxFontSizeMultiplier={1.3}
              >
                {dueLead.kind === 'account'
                  ? `${dueLead.account.name} is ${formatMoney(-dueLead.account.balance)} overdrawn`
                  : dueLead.kind === 'loan'
                    ? `${formatMoney(dueLead.loan.weeklyPayment)} loan payment ${(dueLead.loan.latePayments ?? 0) > 0 ? 'is behind' : 'will bounce'}`
                    : `${dueLead.rule.label} is due this week`}
              </Text>
              {dueLead.kind === 'account' ? (
                <AccountRow
                  account={dueLead.account}
                  currentWeek={gameState.weeksLived}
                  darkMode={darkMode}
                  variant="card"
                  onDetail={() => setSubView({ kind: 'account', id: dueLead.account.id })}
                  onPress={() => setDepositTarget(dueLead.account)}
                  onWithdraw={() => setWithdrawTarget(dueLead.account)}
                  onClose={() => confirmCloseAccount(dueLead.account)}
                />
              ) : dueLead.kind === 'loan' ? (
                <LoanRow loan={dueLead.loan} darkMode={darkMode} onPress={() => setPrepayLoanId(dueLead.loan.id)} />
              ) : (
                <BillPayRow
                  rule={dueLead.rule}
                  currentWeek={gameState.weeksLived}
                  darkMode={darkMode}
                  onToggle={() => {
                    toggleBill(setGameState, dueLead.rule.id);
                    queueSave();
                  }}
                  onDelete={() => {
                    removeBill(setGameState, dueLead.rule.id);
                    queueSave();
                  }}
                />
              )}
            </View>
          </View>
        )}

        {/* Three numbers, not nine. The five ledger chips that used to sit
            under this strip are the tax page's business; what is invested
            rides along as the Bank tile's second line. */}
        <View
          style={[
            getGlassCard(darkMode, 12),
            { backgroundColor: theme.surface, borderColor: darkMode ? theme.glassBorder : theme.border, borderWidth: 1, borderRadius: responsiveBorderRadius['2xl'] },
          ]}
        >
          <View style={styles.heroInner}>
            <StatStrip
              items={[
                { label: 'Cash', value: formatMoney(cash) },
                { label: 'Bank', value: formatMoney(totalBank), sub: `${formatMoney(investedValue)} invested` },
                { label: 'Debt', value: formatMoney(totalDebt), tint: totalDebt > 0 ? accent.danger : undefined },
              ]}
            />
          </View>
        </View>

        <SectionTitle
          title="Accounts"
          subtitle={`${banking.accounts.length} ${banking.accounts.length === 1 ? 'account' : 'accounts'} · tap for details`}
          right={<Chip label="Open" tone="info" onPress={() => setShowOpenAccount(true)} accessibilityLabel="Open an account" />}
        />
        {banking.accounts.map((acct) => (
          <AccountRow
            key={acct.id}
            account={acct}
            currentWeek={gameState.weeksLived}
            darkMode={darkMode}
            variant="card"
            onDetail={() => setSubView({ kind: 'account', id: acct.id })}
            onPress={() => setDepositTarget(acct)}
            onWithdraw={() => setWithdrawTarget(acct)}
            onClose={() => confirmCloseAccount(acct)}
          />
        ))}

        {/* The bank's weekly sponsored bonus. Hides itself when ads are removed.
            Gated to one claim per in-game week (econ-4): it was the only ad
            reward paying CASH and had no cooldown at all, so it could be watched
            on repeat for 2% of the balance a time. The cooldown is stated on the
            pill rather than discovered by tapping into a refusal. */}
        <WatchAdRewardButton
          label={adBonusReady ? 'Watch ad → cash bonus' : 'Sponsored bonus claimed'}
          sublabel={
            adBonusReady
              ? `+${formatMoney(adCashBonus)} to your wallet · once a week`
              : 'Your bank offers this once a week.'
          }
          icon={Gift}
          disabled={!adBonusReady}
          disabledLabel="Available next week"
          // No modal on success: the pill flips to its claimed state, the button
          // fires its own success haptic, and the wallet updates in place - a
          // confirmation dialog for a small bonus is interruption, not feedback.
          onReward={() => { claimAdCashBonus(setGameState, gameState); }}
          onGranted={queueSave}
        />

        {/* Tax breakdown - always offered, not gated on having paid any yet.
            A week-1 player who has paid nothing is exactly the one who benefits
            from seeing the bands before they cross one. */}
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => setSubView({ kind: 'tax' })}
          accessibilityRole="button"
          accessibilityLabel="View tax breakdown"
          style={[styles.linkRow, { borderColor: theme.border }]}
        >
          <Percent size={scale(15)} color={accent.warning} />
          <Text style={[styles.linkRowText, { color: theme.text }]}>
            {banking.taxDueThisYear > 0 ? 'See where your tax goes' : 'How tax works'}
          </Text>
          <ChevronRight size={scale(16)} color={theme.textMuted} />
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => setSubView({ kind: 'credit' })}
          accessibilityRole="button"
          accessibilityLabel="View full credit report"
          style={[styles.linkRow, { borderColor: theme.border }]}
        >
          <FileText size={scale(15)} color={accent.info} />
          <Text style={[styles.linkRowText, { color: theme.text }]}>View full credit report</Text>
          <ChevronRight size={scale(16)} color={theme.textMuted} />
        </TouchableOpacity>

        <CollapsibleSection
          id="bank-loans"
          title="Loans"
          icon={<Landmark size={scale(15)} color={accent.info} />}
          tint={accent.info}
          summary={loans.length === 0 ? 'None' : `${loans.length} · ${formatMoney(loans.reduce((s, l) => s + l.remaining, 0))} owed`}
          // Open when its row is the lead: the lead names the problem, the
          // section is where the whole ledger sits.
          defaultCollapsed={loans.length === 0 && dueLead?.kind !== 'loan'}
        >
          <Chip label="Apply" tone="info" size="md" onPress={() => setShowLoanQuote(true)} accessibilityLabel="Apply for a loan" style={styles.addChip} />
          {loans.length === 0 ? (
            <EmptyText theme={theme} darkMode={darkMode}>No active loans.</EmptyText>
          ) : (
            loans.map((loan) => (
              <LoanRow key={loan.id} loan={loan} darkMode={darkMode} onPress={() => setPrepayLoanId(loan.id)} />
            ))
          )}
        </CollapsibleSection>

        <CollapsibleSection
          id="bank-cards"
          title="Credit Cards"
          icon={<CreditCardIcon size={scale(15)} color={accent.purple} />}
          tint={accent.purple}
          summary={
            banking.creditCards.length === 0
              ? 'None'
              : `${banking.creditCards.length} · ${formatMoney(banking.creditCards.reduce((s, c) => s + c.balance, 0))} owed`
          }
          defaultCollapsed={banking.creditCards.length === 0}
        >
          <Chip label="Apply" tone="info" size="md" onPress={() => setShowApplyCard(true)} accessibilityLabel="Apply for a credit card" style={styles.addChip} />
          {banking.creditCards.length === 0 ? (
            <EmptyText theme={theme} darkMode={darkMode}>No cards yet.</EmptyText>
          ) : (
            banking.creditCards.map((c) => (
              <CreditCardRow key={c.id} card={c} darkMode={darkMode} onPress={() => setPayCardId(c.id)} />
            ))
          )}
        </CollapsibleSection>

        <CollapsibleSection
          id="bank-goals"
          title="Savings Goals"
          icon={<Target size={scale(15)} color={accent.success} />}
          tint={accent.success}
          summary={
            banking.savingsGoals.length === 0
              ? 'None'
              : `${banking.savingsGoals.length} · ${formatMoney(banking.savingsGoals.reduce((s, g) => s + g.currentAmount, 0))} saved`
          }
          defaultCollapsed={banking.savingsGoals.length === 0}
        >
          <Chip label="New" tone="info" size="md" onPress={pickSavingsGoal} accessibilityLabel="Create a savings goal" style={styles.addChip} />
          {banking.savingsGoals.length === 0 ? (
            <EmptyText theme={theme} darkMode={darkMode}>No goals yet.</EmptyText>
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
        </CollapsibleSection>

        <CollapsibleSection
          id="bank-autopay"
          title="Auto-Pay"
          icon={<CalendarClock size={scale(15)} color={accent.warning} />}
          tint={accent.warning}
          summary={banking.billPayRules.length === 0 ? 'None' : `${banking.billPayRules.length} set up`}
          defaultCollapsed={banking.billPayRules.length === 0 && dueLead?.kind !== 'bill'}
        >
          <Chip label="Add" tone="info" size="md" onPress={() => setShowAddBill(true)} accessibilityLabel="Add an auto-pay rule" style={styles.addChip} />
          {banking.billPayRules.length === 0 ? (
            <EmptyText theme={theme} darkMode={darkMode}>No bills set up.</EmptyText>
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
        </CollapsibleSection>
      </ScrollView>
    </>
  );

  const detailAccount =
    subView?.kind === 'account' ? banking.accounts.find((a) => a.id === subView.id) ?? null : null;

  return (
    <View style={[styles.root, { backgroundColor: theme.background, paddingTop: 0 }]}>
      {subView?.kind === 'credit'
        ? renderCreditDetail()
        : subView?.kind === 'tax'
          ? renderTaxDetail()
          : detailAccount
            ? renderAccountDetail(detailAccount)
            : renderMainList()}

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
          // Same as AdvancedBankApp: a rejection used to close the sheet
          // silently, so "Can't create a new savings" looked like nothing
          // happening at all.
          const result = openNewAccount(gameState, setGameState, spec);
          if (!result.success) {
            gameAlert('Could not open account', result.message);
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

      <AmountInputModal
        visible={!!addGoalPick}
        title={addGoalPick ? `Goal: ${addGoalPick.name}` : 'Set a savings goal'}
        subtitle="How much do you want to save?"
        confirmLabel="Create Goal"
        presets={[1000, 5000, 25000]}
        darkMode={darkMode}
        onClose={() => setAddGoalPick(null)}
        onConfirm={(amt) => {
          // Hand off to the auto-contribute step so the goal is written once
          // with its final shape.
          if (addGoalPick) {
            setAutoGoalPick({ ...addGoalPick, targetAmount: amt });
          }
          setAddGoalPick(null);
        }}
      />

      {/* Auto-contribute step. Closing without confirming creates the goal with
          no sweep - manual-only is a legitimate choice, so it must not require
          typing 0. */}
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
            gameAlert('No checking account', 'Open a checking account first - loan payments are drawn from checking.');
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
            gameAlert('No checking account', 'Open a checking account first - card payments are drawn from checking.');
          }
          setPayCardId(null);
        }}
      />
    </View>
  );
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
  heroInner: {
    borderRadius: responsiveBorderRadius['2xl'],
    overflow: 'hidden',
    padding: responsiveSpacing.md,
  },
  heroEyebrow: {
    fontSize: responsiveFontSize.xs,
    fontWeight: '600',
    letterSpacing: 0.8,
    marginBottom: responsiveSpacing.sm,
  },
  // The two report links that used to be tinted CTA banners above the account
  // deck. They are navigation, not offers, so they read as rows.
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: responsiveSpacing.sm,
    paddingHorizontal: responsiveSpacing.md,
    minHeight: touchTargets.minimum,
    borderRadius: responsiveBorderRadius.lg,
    borderWidth: 1,
  },
  linkRowText: { flex: 1, fontSize: responsiveFontSize.sm, fontWeight: '600' },
  addChip: { alignSelf: 'flex-start' },

  // The lead slot above the strip. `rhythm.major` below it is the hierarchy
  // change (the ScrollView's own `sm` gap adds to it); the rows inside keep
  // their own card faces, so the slot is a surface plus a headline, no more.
  leadCard: {
    borderWidth: 1,
    borderRadius: responsiveBorderRadius['2xl'],
    marginBottom: rhythm.major,
  },
  leadInner: {
    borderRadius: responsiveBorderRadius['2xl'],
    overflow: 'hidden',
    padding: responsiveSpacing.md,
    gap: responsiveSpacing.sm,
  },
  leadKicker: { ...kicker },
  leadTitle: { ...tier1Title },

  // ── Detail: hero card face ─────────────────────────────────────────────────
  detailHeroInner: {
    borderRadius: responsiveBorderRadius['2xl'],
    overflow: 'hidden',
    padding: responsiveSpacing.lg,
    gap: responsiveSpacing.sm,
  },
  detailBalance: {
    fontSize: responsiveFontSize['4xl'],
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  detailChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: responsiveSpacing.xs,
  },

  // ── Detail: secondary actions ──────────────────────────────────────────────
  secondaryBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: touchTargets.minimum,
    borderRadius: responsiveBorderRadius.full,
  },
  secondaryText: { fontSize: responsiveFontSize.sm, fontWeight: '600' },
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

  // ── Detail: grouped cards (facts / activity / breakdown) ───────────────────
  groupCard: {
    padding: responsiveSpacing.md,
    borderRadius: responsiveBorderRadius.xl,
    borderWidth: 1,
    gap: responsiveSpacing.sm,
  },
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: responsiveSpacing.sm,
    paddingVertical: responsiveSpacing.sm,
  },
  activityLabel: { fontSize: responsiveFontSize.sm, fontWeight: '600' },
  activityMeta: { fontSize: responsiveFontSize.xs, marginTop: 1, fontVariant: ['tabular-nums'] },
  activityAmount: { fontSize: responsiveFontSize.md, fontWeight: '600', fontVariant: ['tabular-nums'] },

  // ── Credit detail: sparkline + breakdown ───────────────────────────────────
  sparkWrap: { width: '100%', height: scale(56) },
  sparkScale: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: responsiveSpacing.xs,
  },
  sparkScaleText: { fontSize: responsiveFontSize.xs, fontVariant: ['tabular-nums'] },
  trendEmpty: { fontSize: responsiveFontSize.sm, lineHeight: responsiveFontSize.md * 1.4 },
  bdRow: { gap: responsiveSpacing.xs },
  bdHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: responsiveSpacing.sm,
  },
  bdLabel: { flex: 1, fontSize: responsiveFontSize.sm, fontWeight: '600' },
  weightText: { fontSize: responsiveFontSize.xs, fontWeight: '500', fontVariant: ['tabular-nums'] },
  bdValue: { fontSize: responsiveFontSize.md, fontWeight: '600', fontVariant: ['tabular-nums'], minWidth: scale(26), textAlign: 'right' },
});
