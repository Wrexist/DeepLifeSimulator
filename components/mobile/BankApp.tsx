/**
 * BankApp — mobile (phone-style) banking screen.
 *
 * Remake (STATE_VERSION 14). Slim mobile counterpart to AdvancedBankApp.
 *
 * Apple-Wallet DNA: accounts render as a stacked deck of full-width card faces
 * (per-type flat tint) instead of uniform rows, and tapping a card — or the
 * credit gauge — pushes a presentational detail page (local useState routing,
 * no new game mechanics) that surfaces state the flat list never showed
 * (account age, min balance, autopay draws, credit-score breakdown + trend +
 * inquiries). All banking flows still run through the shared `components/banking/*`
 * + `lib/banking/*` primitives and modals — no logic duplication.
 */

import React, { useState, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import Svg, { Polyline } from 'react-native-svg';
import {
  ArrowLeft,
  Wallet,
  PiggyBank,
  TrendingUp,
  TrendingDown,
  LineChart,
  Plus,
  Coins,
  Receipt,
  Calendar,
  Clock,
  Percent,
  Lock,
  FileText,
  ChevronRight,
  Gift,
} from 'lucide-react-native';
import { useGame } from '@/contexts/GameContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ErrorBoundary from '@/components/ErrorBoundary';
import { responsiveFontSize, responsiveSpacing, responsiveBorderRadius, scale, touchTargets, getAppScreenBottomPadding } from '@/utils/scaling';
import { getThemeColors, accent } from '@/lib/config/theme';
import { getGlassCard, getGlassButton, getGlassIconContainer, getPlatformShadows } from '@/utils/glassmorphismStyles';
import LinearGradientFallback from '@/components/fallbacks/LinearGradientFallback';
import { initialGameState } from '@/contexts/game/initialState';
import { MIRRORED_ACCOUNT_IDS } from '@/lib/banking/operations';

import CreditScoreGauge from '@/components/banking/CreditScoreGauge';
import AccountRow, { accountPalette, accountTypeLabel } from '@/components/banking/AccountRow';
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
import { updateMoney } from '@/contexts/game/actions/MoneyActions';
import WatchAdRewardButton from '@/components/WatchAdRewardButton';
import { weeklyCareerSalary } from '@/lib/careers/weeklySalary';

const LinearGradient = LinearGradientFallback;

interface BankAppProps {
  onBack: () => void;
}

/** Local list→detail routing (presentational only — reads existing state). */
type BankSubView = { kind: 'account'; id: string } | { kind: 'credit' } | null;

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

/** 0–100 breakdown score → traffic-light tint (green healthy … red weak). */
function scoreColor(v: number): string {
  if (v >= 75) return accent.success;
  if (v >= 50) return '#eab308';
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
  const [contributeGoalId, setContributeGoalId] = useState<string | null>(null);
  // R3-M5: goal money used to be unrecoverable — contributing was a one-way door.
  const [withdrawGoalId, setWithdrawGoalId] = useState<string | null>(null);
  const [prepayLoanId, setPrepayLoanId] = useState<string | null>(null);
  const [payCardId, setPayCardId] = useState<string | null>(null);

  const cash = gameState.stats?.money ?? 0;
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
    for (const co of (gameState.companies ?? []) as any[]) income += co.weeklyIncome ?? 0;
    return income;
  }, [gameState.careers, gameState.currentJob, gameState.companies]);

  const queueSave = useCallback(() => {
    saveGame().catch(() => {});
  }, [saveGame]);

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

  // ───────────────────────────── Header (nav-safe on every screen) ──────────
  const renderHeader = (title: string, opts?: { back?: () => void; right?: React.ReactNode }) => (
    <View style={styles.topBar}>
      <TouchableOpacity
        onPress={opts?.back ?? onBack}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="Back"
        style={styles.backBtn}
      >
        <ArrowLeft size={scale(22)} color={theme.text} />
      </TouchableOpacity>
      <Text style={[styles.appTitle, { color: theme.text }]} numberOfLines={1}>{title}</Text>
      <View style={styles.headerRight}>{opts?.right}</View>
    </View>
  );

  // ───────────────────────────── Account detail page ───────────────────────
  const renderAccountDetail = (account: BankAccount) => {
    const pal = accountPalette(account.type);
    const isMirrored = MIRRORED_ACCOUNT_IDS.has(account.id);
    const isLocked = account.lockUntilWeek != null && gameState.weeksLived < account.lockUntilWeek;
    const ageWeeks = Math.max(0, gameState.weeksLived - account.openedWeek);
    const ageLabel = ageWeeks >= 52 ? `${(ageWeeks / 52).toFixed(1)}y · ${ageWeeks}w` : `${ageWeeks}w`;
    const relatedBills = banking.billPayRules.filter((b) => b.fromAccountId === account.id);

    return (
      <>
        {renderHeader(account.name, {
          back: () => setSubView(null),
          right: (
            <View style={[styles.typeDot, { backgroundColor: `rgba(${pal.rgb}, 0.18)`, borderColor: `rgba(${pal.rgb}, 0.32)` }]}>
              <Wallet size={scale(14)} color={pal.hex} />
            </View>
          ),
        })}
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
              <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: `rgba(${pal.rgb}, ${darkMode ? 0.14 : 0.1})` }]} />
              <View
                pointerEvents="none"
                style={{ position: 'absolute', top: -scale(40), right: -scale(30), width: scale(150), height: scale(150), borderRadius: scale(75), backgroundColor: `rgba(${pal.rgb}, 0.10)` }}
              />
              {darkMode && <View pointerEvents="none" style={styles.heroHairline} />}
              <Text style={[styles.heroEyebrow, { color: theme.textMuted }]}>{accountTypeLabel(account.type).toUpperCase()}</Text>
              <Text style={[styles.detailBalance, { color: theme.text }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.5}>
                {formatMoneyExact(account.balance)}
              </Text>
              <View style={styles.detailChipRow}>
                {account.baseAPR > 0 && (
                  <View style={[styles.aprChipLg, { backgroundColor: `rgba(${pal.rgb}, 0.15)`, borderColor: `rgba(${pal.rgb}, 0.30)` }]}>
                    <TrendingUp size={scale(11)} color={pal.hex} />
                    <Text style={[styles.aprTextLg, { color: pal.hex }]}>{(account.baseAPR * 100).toFixed(2)}% APR</Text>
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

          {/* Actions — one loud CTA (Deposit) for non-mirrored accounts */}
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

          {/* Facts grid (surfaces openedWeek / age / minBalance, grouped in one card) */}
          <Text style={[styles.sectionTitle, styles.detailSectionTitle, { color: theme.text }]}>Account details</Text>
          <View style={[getGlassCard(darkMode, 6), styles.groupCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={styles.factsGrid}>
              <FactCell theme={theme} icon={Wallet} tint={pal.hex} label="Type" value={accountTypeLabel(account.type)} />
              <FactCell theme={theme} icon={Percent} label="Interest APR" value={`${(account.baseAPR * 100).toFixed(2)}%`} />
              <FactCell theme={theme} icon={Coins} label="Balance" value={formatMoneyExact(account.balance)} />
              <FactCell theme={theme} icon={Calendar} label="Opened" value={`Week ${account.openedWeek}`} />
              <FactCell theme={theme} icon={Clock} label="Age" value={ageLabel} />
              <FactCell theme={theme} icon={PiggyBank} label="Min balance" value={account.minBalance ? formatMoneyExact(account.minBalance) : 'None'} />
            </View>
          </View>

          {/* Autopay drawing from this account — activity-style rows */}
          <Text style={[styles.sectionTitle, styles.detailSectionTitle, { color: theme.text }]}>Auto-pay from this account</Text>
          {relatedBills.length === 0 ? (
            <EmptyText theme={theme} darkMode={darkMode}>No auto-pay rules draw from this account.</EmptyText>
          ) : (
            <View style={[getGlassCard(darkMode, 6), styles.groupCard, { backgroundColor: theme.surface, borderColor: theme.border, gap: 0 }]}>
              {relatedBills.map((bill, i) => {
                const due = bill.nextDueWeek - gameState.weeksLived;
                const dueText = due <= 0 ? 'Due now' : due === 1 ? 'Due next week' : `Due in ${due} weeks`;
                return (
                  <View key={bill.id} style={[styles.activityRow, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border }]}>
                    <View style={[getGlassIconContainer(darkMode, 34), { backgroundColor: 'rgba(59, 130, 246, 0.15)', borderWidth: 1, borderColor: 'rgba(59, 130, 246, 0.30)' }]}>
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

          {/* Score trend (real history — no fabricated arrays) */}
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

          {/* Component breakdown — surfaces all five weighted factors */}
          <Text style={[styles.sectionTitle, styles.detailSectionTitle, { color: theme.text }]}>What&apos;s driving your score</Text>
          <View style={[getGlassCard(darkMode, 6), styles.groupCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            {BREAKDOWN_META.map((m, i) => {
              const v = Math.max(0, Math.min(100, cs.componentBreakdown[m.key] ?? 0));
              return (
                <View key={m.key} style={[styles.bdRow, i > 0 && { marginTop: responsiveSpacing.sm }]}>
                  <View style={styles.bdHead}>
                    <Text style={[styles.bdLabel, { color: theme.text }]} numberOfLines={1}>{m.label}</Text>
                    <View style={[styles.weightChip, { backgroundColor: theme.surfaceElevated }]}>
                      <Text style={[styles.weightText, { color: theme.textMuted }]}>{m.weight}% weight</Text>
                    </View>
                    <Text style={[styles.bdValue, { color: scoreColor(v) }]}>{Math.round(v)}</Text>
                  </View>
                  <View style={[styles.bdTrack, { backgroundColor: theme.surfaceElevated }]}>
                    <View style={[styles.bdFill, { width: `${v}%`, backgroundColor: scoreColor(v) }]} />
                  </View>
                </View>
              );
            })}
          </View>

          {/* Recent inquiries */}
          <View style={styles.sectionHeaderRow}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Recent inquiries</Text>
            <Text style={[styles.sectionMeta, { color: theme.textMuted }]}>Updated wk {cs.lastUpdatedWeek}</Text>
          </View>
          {inquiries.length === 0 ? (
            <EmptyText theme={theme} darkMode={darkMode}>No recent credit inquiries. A clean file keeps this factor high.</EmptyText>
          ) : (
            <View style={[getGlassCard(darkMode, 6), styles.groupCard, { backgroundColor: theme.surface, borderColor: theme.border, gap: 0 }]}>
              {inquiries.map((inq, i) => {
                const ago = gameState.weeksLived - inq.weeksLived;
                const agoText = ago <= 0 ? 'this week' : ago === 1 ? '1 week ago' : `${ago} weeks ago`;
                return (
                  <View key={`${inq.weeksLived}-${i}`} style={[styles.activityRow, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border }]}>
                    <View style={[getGlassIconContainer(darkMode, 34), { backgroundColor: 'rgba(59, 130, 246, 0.15)', borderWidth: 1, borderColor: 'rgba(59, 130, 246, 0.30)' }]}>
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
      {renderHeader('Bank', {
        right: (
          <TouchableOpacity
            onPress={() => setSubView({ kind: 'credit' })}
            accessibilityRole="button"
            accessibilityLabel={`Credit score ${banking.creditScore.score}, view report`}
            style={[styles.scoreChip, { backgroundColor: 'rgba(59, 130, 246, 0.14)', borderColor: 'rgba(59, 130, 246, 0.30)' }]}
          >
            <Text style={[styles.scoreChipText, { color: theme.text }]}>{banking.creditScore.score}</Text>
            <ChevronRight size={scale(13)} color={theme.textMuted} />
          </TouchableOpacity>
        ),
      })}

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
        <View
          style={[
            getGlassCard(darkMode, 12),
            { backgroundColor: theme.surface, borderColor: darkMode ? theme.glassBorder : theme.border, borderWidth: 1, borderRadius: responsiveBorderRadius['2xl'] },
          ]}
        >
          <View style={styles.heroInner}>
            <View
              pointerEvents="none"
              style={{ position: 'absolute', top: -scale(48), right: -scale(36), width: scale(150), height: scale(150), borderRadius: scale(75), backgroundColor: 'rgba(59, 130, 246, 0.10)' }}
            />
            {darkMode && <View pointerEvents="none" style={styles.heroHairline} />}
            <Text style={[styles.heroEyebrow, { color: theme.textMuted }]}>OVERVIEW</Text>
            <View style={styles.statRow}>
              <Stat theme={theme} icon={Wallet} label="Cash" value={formatMoney(cash)} />
              <Stat theme={theme} icon={PiggyBank} label="Bank" value={formatMoney(totalBank)} />
              <Stat theme={theme} icon={LineChart} label="Invested" value={formatMoney(investedValue)} />
              <Stat theme={theme} icon={TrendingUp} label="Debt" value={formatMoney(totalDebt)} negative={totalDebt > 0} />
            </View>
            {/* Dense ledger strip — fields the flat overview never surfaced */}
            <View style={styles.ledgerRow}>
              <LedgerChip theme={theme} icon={Coins} label="Income" value={`${formatMoney(weeklyIncome)}/wk`} color={accent.success} />
              <LedgerChip theme={theme} icon={TrendingUp} label="Earned" value={formatMoney(banking.totalInterestEarned)} color={accent.success} />
              <LedgerChip theme={theme} icon={TrendingDown} label="Paid" value={formatMoney(banking.totalInterestPaid)} color={accent.danger} />
              <LedgerChip theme={theme} icon={Receipt} label="Late fees" value={formatMoney(banking.totalLateFeesPaid)} color={accent.warning} />
              {banking.taxDueThisYear > 0 && (
                <LedgerChip theme={theme} icon={Calendar} label="Tax due" value={formatMoney(banking.taxDueThisYear)} color={accent.warning} />
              )}
            </View>
          </View>
        </View>

        {/* Credit summary — whole block taps to the report (visible affordance) */}
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => setSubView({ kind: 'credit' })}
          accessibilityRole="button"
          accessibilityLabel="View full credit report"
          style={{ gap: responsiveSpacing.sm }}
        >
          <CreditScoreGauge score={banking.creditScore.score} band={banking.creditScore.band} darkMode={darkMode} compact />
          <View style={[styles.reportCta, { backgroundColor: 'rgba(59, 130, 246, 0.14)', borderColor: 'rgba(59, 130, 246, 0.30)' }]}>
            <FileText size={scale(14)} color={accent.info} />
            <Text style={[styles.reportCtaText, { color: accent.info }]}>View full credit report</Text>
            <ChevronRight size={scale(15)} color={accent.info} />
          </View>
        </TouchableOpacity>

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
          colors={['#34D399', '#059669']}
          icon={Gift}
          disabled={!adBonusReady}
          disabledLabel="Available next week"
          // No modal on success: the pill flips to its claimed state, the button
          // fires its own success haptic, and the wallet updates in place — a
          // confirmation dialog for a small bonus is interruption, not feedback.
          onReward={() => { claimAdCashBonus(setGameState, gameState); }}
          onGranted={queueSave}
        />

        <SectionHeader
          theme={theme}
          title="Accounts"
          meta={`${banking.accounts.length} ${banking.accounts.length === 1 ? 'account' : 'accounts'} · tap for details`}
          onAdd={() => setShowOpenAccount(true)}
          addLabel="Open"
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

        <SectionHeader theme={theme} title="Loans" onAdd={() => setShowLoanQuote(true)} addLabel="Apply" />
        {(gameState.loans ?? []).length === 0 ? (
          <EmptyText theme={theme} darkMode={darkMode}>No active loans.</EmptyText>
        ) : (
          (gameState.loans ?? []).map((loan) => (
            <LoanRow key={loan.id} loan={loan} darkMode={darkMode} onPress={() => setPrepayLoanId(loan.id)} />
          ))
        )}

        <SectionHeader theme={theme} title="Credit Cards" onAdd={() => setShowApplyCard(true)} addLabel="Apply" />
        {banking.creditCards.length === 0 ? (
          <EmptyText theme={theme} darkMode={darkMode}>No cards yet.</EmptyText>
        ) : (
          banking.creditCards.map((c) => (
            <CreditCardRow key={c.id} card={c} darkMode={darkMode} onPress={() => setPayCardId(c.id)} />
          ))
        )}

        <SectionHeader theme={theme} title="Savings Goals" onAdd={() =>
            Alert.alert('What are you saving for?', undefined, [
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
            ])
          } addLabel="New" />
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

        <SectionHeader theme={theme} title="Auto-Pay" onAdd={() => setShowAddBill(true)} addLabel="Add" />
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
      </ScrollView>
    </>
  );

  const detailAccount =
    subView?.kind === 'account' ? banking.accounts.find((a) => a.id === subView.id) ?? null : null;

  return (
    <View style={[styles.root, { backgroundColor: theme.background, paddingTop: 0 }]}>
      {subView?.kind === 'credit'
        ? renderCreditDetail()
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
    <View style={styles.statCell}>
      <View style={styles.statTop}>
        <Icon size={scale(14)} color={negative ? accent.danger : accent.info} />
        <Text style={[styles.statLabel, { color: theme.textMuted }]}>{label}</Text>
      </View>
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

function LedgerChip({
  theme,
  icon: Icon,
  label,
  value,
  color,
}: {
  theme: ReturnType<typeof getThemeColors>;
  icon: React.ComponentType<{ size: number; color: string }>;
  label: string;
  value: string;
  color: string;
}) {
  return (
    <View style={[styles.ledgerChip, { backgroundColor: theme.surfaceElevated }]}>
      <Icon size={scale(12)} color={color} />
      <Text style={[styles.ledgerLabel, { color: theme.textMuted }]} numberOfLines={1}>{label}</Text>
      <Text style={[styles.ledgerValue, { color: theme.text }]} numberOfLines={1}>{value}</Text>
    </View>
  );
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

function SectionHeader({
  theme,
  title,
  meta,
  onAdd,
  addLabel,
}: {
  theme: ReturnType<typeof getThemeColors>;
  title: string;
  meta?: string;
  onAdd?: () => void;
  addLabel?: string;
}) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionHeaderText}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>{title}</Text>
        {meta && <Text style={[styles.sectionMeta, { color: theme.textMuted }]} numberOfLines={1}>{meta}</Text>}
      </View>
      {onAdd && (
        <TouchableOpacity onPress={onAdd} accessibilityRole="button" accessibilityLabel={addLabel ?? 'Add'} style={styles.addChip}>
          <Plus size={scale(12)} color={accent.info} />
          <Text style={styles.addChipText}>{addLabel ?? 'Add'}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

function EmptyText({
  theme,
  darkMode,
  children,
}: {
  theme: ReturnType<typeof getThemeColors>;
  darkMode: boolean;
  children: React.ReactNode;
}) {
  // Give empty sections a card so they share the same rhythm as populated ones
  // instead of floating as bare text between elevated rows.
  return (
    <View style={[getGlassCard(darkMode, 6), styles.emptyCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <Text style={[styles.emptyText, { color: theme.textMuted }]}>{children}</Text>
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
  headerRight: { minWidth: scale(40), alignItems: 'flex-end', justifyContent: 'center' },
  typeDot: {
    width: scale(30),
    height: scale(30),
    borderRadius: scale(15),
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  scoreChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingLeft: responsiveSpacing.sm,
    paddingRight: responsiveSpacing.xs,
    paddingVertical: 4,
    borderRadius: responsiveBorderRadius.full,
    borderWidth: 1,
  },
  scoreChipText: { fontSize: responsiveFontSize.sm, fontWeight: '700', fontVariant: ['tabular-nums'] },
  heroInner: {
    borderRadius: responsiveBorderRadius['2xl'],
    overflow: 'hidden',
    padding: responsiveSpacing.lg,
  },
  heroHairline: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  heroEyebrow: {
    fontSize: responsiveFontSize.xs,
    fontWeight: '600',
    letterSpacing: 0.8,
    marginBottom: responsiveSpacing.sm,
  },
  statRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: responsiveSpacing.sm,
  },
  statCell: {
    // Keep the 2-per-row wrap: money labels like "$1,234,567" don't fit at ~95pt (3-up).
    flexBasis: '48%',
    flexGrow: 1,
    gap: scale(4),
  },
  statTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: responsiveSpacing.xs,
  },
  statLabel: { fontSize: responsiveFontSize.xs, fontWeight: '600' },
  statValue: { fontSize: responsiveFontSize.lg, fontWeight: '800', fontVariant: ['tabular-nums'] },
  ledgerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: responsiveSpacing.xs,
    marginTop: responsiveSpacing.md,
  },
  ledgerChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: responsiveSpacing.sm,
    paddingVertical: 5,
    borderRadius: responsiveBorderRadius.full,
  },
  ledgerLabel: { fontSize: responsiveFontSize.xs, fontWeight: '600' },
  ledgerValue: { fontSize: responsiveFontSize.xs, fontWeight: '800', fontVariant: ['tabular-nums'] },
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
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: responsiveSpacing.md,
    gap: responsiveSpacing.sm,
  },
  sectionHeaderText: { flex: 1 },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: responsiveSpacing.sm,
    gap: responsiveSpacing.sm,
  },
  sectionTitle: {
    fontSize: responsiveFontSize.md,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  detailSectionTitle: {
    marginTop: responsiveSpacing.xs,
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

  // ── Detail: hero card face ─────────────────────────────────────────────────
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

  // ── Detail: primary CTA + secondary actions ────────────────────────────────
  ctaShadow: {
    borderRadius: responsiveBorderRadius.full,
  },
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

  // ── Detail: grouped cards (facts / activity / breakdown) ───────────────────
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
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: responsiveSpacing.sm,
    paddingVertical: responsiveSpacing.sm,
  },
  activityLabel: { fontSize: responsiveFontSize.sm, fontWeight: '700' },
  activityMeta: { fontSize: responsiveFontSize.xs, marginTop: 1, fontVariant: ['tabular-nums'] },
  activityAmount: { fontSize: responsiveFontSize.md, fontWeight: '800', fontVariant: ['tabular-nums'] },

  // ── Credit detail: sparkline + breakdown ───────────────────────────────────
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
  bdRow: { gap: responsiveSpacing.xs },
  bdHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: responsiveSpacing.sm,
  },
  bdLabel: { flex: 1, fontSize: responsiveFontSize.sm, fontWeight: '600' },
  weightChip: {
    paddingHorizontal: responsiveSpacing.xs,
    paddingVertical: 2,
    borderRadius: responsiveBorderRadius.sm,
  },
  weightText: { fontSize: responsiveFontSize.xs, fontWeight: '600', fontVariant: ['tabular-nums'] },
  bdValue: { fontSize: responsiveFontSize.md, fontWeight: '800', fontVariant: ['tabular-nums'], minWidth: scale(26), textAlign: 'right' },
  bdTrack: {
    height: scale(6),
    borderRadius: responsiveBorderRadius.full,
    overflow: 'hidden',
  },
  bdFill: {
    height: '100%',
    borderRadius: responsiveBorderRadius.full,
  },
});
