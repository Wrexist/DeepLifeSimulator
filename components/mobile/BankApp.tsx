import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Keyboard,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  responsivePadding,
  responsiveFontSize,
  responsiveSpacing,
  responsiveBorderRadius,
  responsiveIconSize,
  scale,
  verticalScale,
} from '@/utils/scaling';
import { useGame } from '@/contexts/GameContext';
import { PiggyBank, Wallet, ArrowLeft, Info } from 'lucide-react-native';

// Prefer expo-router for navigation; gracefully fall back if unavailable.
let useRouterHook:
  | undefined
  | (() => { back: () => void; replace: (p: string) => void; canGoBack?: () => boolean });
try {
   
  const mod = require('expo-router');
  useRouterHook = mod?.useRouter;
} catch {
  useRouterHook = undefined;
}

/* =========================
   CONFIG
   ========================= */
const SAVINGS_APR = 0.15;                 // 15% APR on savings
const MISSED_PAYMENT_PENALTY = 0.01;      // +1% on remaining if a weekly payment is missed
const EARLY_FULL_PAY_DISCOUNT = 0.03;     // 3% discount when fully repaying a loan
const MAX_DEBT_TO_FUNDS = 5;              // Total debt cap = 5 × (cash + savings)
const LOAN_CAP_NET_WORTH_RATIO = 0.15;    // Single loan cap = 15% of net worth
const MIN_LOAN_FLOOR = 1000;              // Minimum loan
const TERM_OPTIONS = [32, 64] as const;   // Allowed terms (weeks)
const HOME_MOBILE_ROUTE = '/(mobile)/apps';
const HOME_COMPUTER_ROUTE = '/(computer)/apps';
const HOME_FALLBACK = '/(tabs)/home';

/* =========================
   TYPES
   ========================= */
type Numberish = number | string;
type TabKey = 'savings';
type RepaySource = 'cash' | 'bank'; // manual repayment source

type Loan = {
  id: string;
  name: string;
  principal: number;
  remaining: number;
  rateAPR: number;     // e.g. 0.08 for 8% APR (fixed per-loan)
  weeklyRate: number;  // rateAPR / 52
  termWeeks: number;
  startWeek: number;
  installment: number; // amortized weekly payment
  missedPayments: number;
  autoPay?: boolean;   // logically always true; kept for compatibility
};

/* =========================
   UTILS
   ========================= */
function toNumberSafe(v: Numberish): number {
  const n = typeof v === 'string' ? v.replace(',', '.').trim() : v;
  const parsed = Number(n);
  return Number.isFinite(parsed) ? parsed : 0;
}
function clampNonNeg(n: number) {
  return Math.max(0, Math.round(n));
}
function formatMoney(n: number): string {
  const a = Math.floor(Math.abs(n) || 0);
  const sign = n < 0 ? '-' : '';
  
  let formatted: string;
  
  if (a >= 1_000_000_000_000_000) {
    // Quadrillions (Q)
    formatted = `${(a / 1_000_000_000_000_000).toFixed(2)}Q`;
  } else if (a >= 1_000_000_000_000) {
    // Trillions (T)
    formatted = `${(a / 1_000_000_000_000).toFixed(2)}T`;
  } else if (a >= 1_000_000_000) {
    // Billions (B)
    formatted = `${(a / 1_000_000_000).toFixed(2)}B`;
  } else if (a >= 1_000_000) {
    // Millions (M)
    formatted = `${(a / 1_000_000).toFixed(2)}M`;
  } else if (a >= 1_000) {
    // Thousands (K)
    formatted = `${(a / 1_000).toFixed(2)}K`;
  } else {
    // Regular numbers
    formatted = a.toString();
  }
  
  // Remove trailing zeros and decimal point if not needed
  formatted = formatted.replace(/\.00$/, '').replace(/\.0$/, '');
  
  return `${sign}${formatted}`;
}
function amortizedInstallment(principal: number, weeklyRate: number, termWeeks: number): number {
  if (termWeeks <= 0) return principal; // safety
  if (weeklyRate <= 0) return principal / termWeeks;
  // A = P * r / (1 - (1 + r)^-n)
  const r = weeklyRate;
  const n = termWeeks;
  const denom = 1 - Math.pow(1 + r, -n);
  if (denom === 0) return principal / termWeeks;
  return principal * (r / denom);
}

// Pseudo market-driven APR (deterministic by week). Smooth oscillation between 6% and 14%.
function getMarketAPR(week: number | undefined): number {
  const w = typeof week === 'number' ? week : 0;
  const base = 0.10;      // 10% center
  const amp = 0.04;       // +/- 4% → 6%..14%
  const apr = base + amp * Math.sin(w * 0.35) * Math.cos(w * 0.17 + 1.2);
  return Math.max(0.06, Math.min(0.14, apr));
}

/* =========================
   COMPONENT
   ========================= */
interface BankAppProps {
  onBack: () => void;
}

export default function BankApp({ onBack }: BankAppProps) {
  const { gameState, setGameState, saveGame } = useGame();
  const router = useRouterHook ? useRouterHook() : undefined;

  if (!gameState || !setGameState || !saveGame) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>Loading bank data…</Text>
      </View>
    );
  }

  const { settings } = gameState;
  const [activeTab, setActiveTab] = useState<TabKey>('savings');

  // From state
  const cash = gameState.stats?.money ?? 0;
  const initialSavings = gameState.bankSavings ?? 0;
  const loans: Loan[] = (gameState.loans ?? []) as any[];
  const investments = gameState.stocks?.holdings ?? []; // link with Stocks app


  // Local state
  const [savings, setSavings] = useState<number>(initialSavings);
  const [amount, setAmount] = useState<string>('');
  const [infoOpen, setInfoOpen] = useState(false);

  // Loan UI
  const [loanAmount, setLoanAmount] = useState<string>('10000');
  const [selectedTerm, setSelectedTerm] = useState<typeof TERM_OPTIONS[number]>(TERM_OPTIONS[0]);
  const [repaySource, setRepaySource] = useState<RepaySource>('cash'); // NEW: switch pay-from source

  useEffect(() => {
    setSavings(initialSavings);
  }, [initialSavings]);

  /* ---------- Net worth & caps ---------- */
  const totalDebt = useMemo(() => loans.reduce((sum, l) => sum + (l.remaining || 0), 0), [loans]);

  const investmentsValue = useMemo(() => {
    // If holdings objects have {shares, currentPrice} or {value}, handle both
    return (investments || []).reduce((s: number, it: any) => {
      const value =
        typeof it?.value === 'number'
          ? it.value
          : (Number(it?.shares) || 0) * (Number(it?.currentPrice ?? it?.price ?? 0) || 0);
      return s + (value || 0);
    }, 0);
  }, [investments]);



  const computedNetWorth = useMemo(
    () => cash + savings + investmentsValue - totalDebt,
    [cash, savings, investmentsValue, totalDebt]
  );

  // Single-loan cap: 15% of net worth (floored to MIN_LOAN_FLOOR)
  const singleLoanCap = useMemo(
    () => Math.max(MIN_LOAN_FLOOR, Math.floor(computedNetWorth * LOAN_CAP_NET_WORTH_RATIO)),
    [computedNetWorth]
  );

  // Total debt cap vs available funds (cash + savings)
  const totalFunds = cash + savings;
  const maxTotalDebt = useMemo(() => Math.floor(totalFunds * MAX_DEBT_TO_FUNDS), [totalFunds]);

  /* ---------- Shared helpers ---------- */
  const commitCashAndSavings = useCallback(
    (nextCash: number, nextSavings: number) => {
      setGameState((prev: any) => ({
        ...prev,
        stats: { ...prev.stats, money: clampNonNeg(nextCash) },
        bankSavings: clampNonNeg(nextSavings),
      }));
      saveGame();
    },
    [setGameState, saveGame]
  );

  const setLoansGlobal = useCallback(
    (nextLoans: Loan[]) => {
      // Remove fully paid loans automatically
      const filtered = nextLoans.filter((l) => (l.remaining || 0) > 0);
      setGameState((prev: any) => ({ ...prev, bankLoans: filtered }));
      saveGame();
    },
    [setGameState, saveGame]
  );



  const formattedCash = useMemo(() => formatMoney(cash), [cash]);
  const formattedSavings = useMemo(() => formatMoney(savings), [savings]);

  /* ---------- Savings actions ---------- */
  const onDeposit = useCallback(() => {
    const v = Math.floor(toNumberSafe(amount));
    if (v <= 0) return Alert.alert('Invalid amount', 'Enter an amount greater than 0.');
    if (v > cash) return Alert.alert('Not enough cash', "You don't have that much cash.");

    const nextCash = cash - v;
    const nextSavings = savings + v;
    setSavings(nextSavings);
    commitCashAndSavings(nextCash, nextSavings);
    setAmount('');
    Keyboard.dismiss();
  }, [amount, cash, savings, commitCashAndSavings]);

  const onWithdraw = useCallback(() => {
    const v = Math.floor(toNumberSafe(amount));
    if (v <= 0) return Alert.alert('Invalid amount', 'Enter an amount greater than 0.');
    if (v > savings) return Alert.alert('Not enough savings', "You don't have that much in savings.");

    const nextCash = cash + v;
    const nextSavings = savings - v;
    setSavings(nextSavings);
    commitCashAndSavings(nextCash, nextSavings);
    setAmount('');
    Keyboard.dismiss();
  }, [amount, cash, savings, commitCashAndSavings]);


  /* ---------- Weekly interest: Savings ---------- */
  const lastSavingsWeek = useRef<number>(gameState.week);
  const weeklySavingsInterest = useMemo(() => (savings * SAVINGS_APR) / 52, [savings]);

  /* ---------- Weekly accrual for Loans ---------- */

  useEffect(() => {
    // Savings weekly accrual
    if (gameState.week > (lastSavingsWeek.current ?? -1)) {
      lastSavingsWeek.current = gameState.week;
      setSavings((prev) => {
        if (prev <= 0) return prev;
        const interest = (prev * SAVINGS_APR) / 52;
        const newSavings = prev + interest;
        setGameState((p: any) => ({ ...p, bankSavings: newSavings }));
        saveGame();
        return newSavings;
      });
    }

    // Note: Automatic loan payments are handled by the main game loop in GameContext
    // This ensures consistent payment processing and avoids duplicate deductions
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState.week]);

  /* ---------- Take Loan (with caps & market APR) ---------- */
  const takeLoan = useCallback(() => {
    const amt = Math.floor(toNumberSafe(loanAmount));
    if (amt <= 0) return Alert.alert('Invalid amount', 'Loan amount must be > 0.');

    if (amt > singleLoanCap) {
      return Alert.alert(
        'Loan declined',
        `Amount exceeds your single-loan cap (${formatMoney(singleLoanCap)} kr).`
      );
    }
    if (totalDebt + amt > maxTotalDebt) {
      return Alert.alert(
        'Loan declined',
        `Total debt would exceed your limit (${formatMoney(maxTotalDebt)} kr).`
      );
    }

    const apr = getMarketAPR(gameState.week);
    const weeklyRate = apr / 52;
    const termW = selectedTerm;
    const installment = amortizedInstallment(amt, weeklyRate, termW);

    const newLoan: Loan = {
      id: `loan_${Date.now()}`,
      name: `Loan ${(loans?.length || 0) + 1}`,
      principal: amt,
      remaining: amt,
      rateAPR: apr,
      weeklyRate,
      termWeeks: termW,
      startWeek: gameState.week ?? 0,
      installment,
      missedPayments: 0,
      autoPay: true,
    };

    const nextCash = cash + amt;
    setGameState((prev: any) => ({
      ...prev,
      stats: { ...prev.stats, money: clampNonNeg(nextCash) },
      bankLoans: [...(prev.bankLoans ?? []), newLoan],
    }));
    saveGame();

    // reset only amount
    setLoanAmount('10000');
    Keyboard.dismiss();
  }, [
    loanAmount,
    singleLoanCap,
    totalDebt,
    maxTotalDebt,
    selectedTerm,
    loans,
    cash,
    gameState.week,
    setGameState,
    saveGame,
  ]);

  /* ---------- Manual Repay (Pay 15%, 50%, or Full w/ discount) ---------- */
  function repayFromChosenSource(target: number, source: RepaySource): {
    nextCash: number;
    nextSavings: number;
    paid: number;
  } {
    let nextCash = cash;
    let nextSavings = savings;
    const need = Math.max(0, Math.floor(target));
    if (need <= 0) return { nextCash, nextSavings, paid: 0 };

    if (source === 'cash') {
      const pay = Math.min(need, nextCash);
      nextCash -= pay;
      return { nextCash, nextSavings, paid: pay };
    } else {
      const pay = Math.min(need, nextSavings);
      nextSavings -= pay;
      return { nextCash, nextSavings, paid: pay };
    }
  }

  const repayPercent = useCallback(
    (loanId: string, pct: number) => {
      const idx = loans.findIndex((l) => l.id === loanId);
      if (idx === -1) return;

      const ln = loans[idx];
      if (ln.remaining <= 0) return;

      const target = Math.ceil(ln.remaining * pct);
      const { nextCash, nextSavings, paid } = repayFromChosenSource(target, repaySource);
      if (paid <= 0) {
        Alert.alert(
          'Not enough funds',
          `You don't have enough ${repaySource === 'cash' ? 'cash' : 'bank savings'} to pay this.`
        );
        return;
      }

      const newRemaining = Math.max(0, ln.remaining - paid);
      const updated = [...loans];
      updated[idx] = { ...ln, remaining: newRemaining };

      // remove fully paid
      const filtered = updated.filter((l) => (l.remaining || 0) > 0);

      setGameState((prev: any) => ({
        ...prev,
        stats: { ...prev.stats, money: clampNonNeg(nextCash) },
        bankSavings: clampNonNeg(nextSavings),
        bankLoans: filtered,
      }));
      saveGame();
      setSavings(clampNonNeg(nextSavings));
    },
    [loans, repaySource, cash, savings, setGameState, saveGame]
  );

  const repayFull = useCallback(
    (loanId: string) => {
      const idx = loans.findIndex((l) => l.id === loanId);
      if (idx === -1) return;
      const ln = loans[idx];
      if (ln.remaining <= 0) return;

      const discounted = Math.ceil(ln.remaining * (1 - EARLY_FULL_PAY_DISCOUNT));
      const { nextCash, nextSavings, paid } = repayFromChosenSource(discounted, repaySource);
      if (paid < discounted) {
        Alert.alert(
          'Not enough funds',
          `You need ${formatMoney(discounted)} kr in ${repaySource === 'cash' ? 'cash' : 'bank savings'} to fully repay after discount.`
        );
        return;
      }

      const updated = [...loans];
      updated[idx] = { ...ln, remaining: 0 };

      // remove fully paid
      const filtered = updated.filter((l) => (l.remaining || 0) > 0);

      setGameState((prev: any) => ({
        ...prev,
        stats: { ...prev.stats, money: clampNonNeg(nextCash) },
        bankSavings: clampNonNeg(nextSavings),
        bankLoans: filtered,
      }));
      saveGame();
      setSavings(clampNonNeg(nextSavings));
    },
    [loans, repaySource, cash, savings, setGameState, saveGame]
  );

  /* ---------- Derived UI bits ---------- */
  const weeklySavingsText = useMemo(
    () => `+${formatMoney(weeklySavingsInterest)} / w`,
    [weeklySavingsInterest]
  );

  const marketAPR = useMemo(() => getMarketAPR(gameState.week), [gameState.week]);
  const marketAPRPercent = useMemo(() => `${(marketAPR * 100).toFixed(2)}%`, [marketAPR]);

  const approxCost32 = useMemo(() => {
    const amt = Math.floor(toNumberSafe(loanAmount));
    if (amt <= 0) return 0;
    return amortizedInstallment(amt, marketAPR / 52, 32);
  }, [loanAmount, marketAPR]);

  const approxCost64 = useMemo(() => {
    const amt = Math.floor(toNumberSafe(loanAmount));
    if (amt <= 0) return 0;
    return amortizedInstallment(amt, marketAPR / 52, 64);
  }, [loanAmount, marketAPR]);

  const totalLoansRemaining = useMemo(
    () => loans.reduce((sum, l) => sum + (l.remaining || 0), 0),
    [loans]
  );

  /* ---------- RENDER ---------- */
  return (
    <View style={[styles.container, settings?.darkMode && styles.containerDark]}>
      <View style={[styles.header, settings?.darkMode && styles.headerDark]}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <ArrowLeft size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Bank</Text>
        <TouchableOpacity onPress={() => setInfoOpen(true)} style={styles.infoButton}>
          <Info size={22} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      <View style={styles.balanceRow}>
        <View style={[styles.balanceCard, settings?.darkMode && styles.balanceCardDark]}>
          <View style={styles.balanceIconWrap}>
            <Wallet size={18} color="#FFFFFF" />
          </View>
          <Text style={styles.balanceLabel}>Cash</Text>
          <Text style={styles.balanceValue}>{formattedCash} kr</Text>
        </View>

        <View style={[styles.balanceCard, settings?.darkMode && styles.balanceCardDark]}>
          <View style={[styles.balanceIconWrap, styles.purpleBg]}>
            <PiggyBank size={18} color="#FFFFFF" />
          </View>
          <Text style={styles.balanceLabel}>Savings</Text>
          <Text style={styles.balanceValue}>{formattedSavings} kr</Text>
          <View style={styles.smallRow}>
            <PiggyBank size={14} color="#34D399" />
            <Text style={styles.smallGreen}>{weeklySavingsText}</Text>
          </View>
        </View>
      </View>

      {/* Tabs */}
      <View style={[styles.tabContainer, settings?.darkMode && styles.tabContainerDark]}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'savings' && styles.activeTab]}
          onPress={() => setActiveTab('savings')}
        >
          <PiggyBank size={20} color={activeTab === 'savings' ? '#FFFFFF' : '#6B7280'} />
          <Text style={[styles.tabText, activeTab === 'savings' ? styles.tabTextActive : styles.tabTextInactive]}>
            Savings
          </Text>
        </TouchableOpacity>



      </View>

      <ScrollView 
        contentContainerStyle={styles.scrollContent} 
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={true}
      >
        {/* Savings */}
        {activeTab === 'savings' && (
          <>
            <View style={[styles.card, settings?.darkMode && styles.cardDark]}>
              <Text style={styles.section}>Deposit / Withdraw</Text>
              <TextInput
                value={amount}
                onChangeText={setAmount}
                placeholder="Amount"
                placeholderTextColor="#9CA3AF"
                keyboardType="numeric"
                style={styles.input}
                returnKeyType="done"
              />
              <View style={styles.row}>
                <TouchableOpacity style={styles.btnPrimary} onPress={onDeposit}>
                  <Text style={styles.btnText}>Deposit</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.btnSecondary} onPress={onWithdraw}>
                  <Text style={styles.btnText}>Withdraw</Text>
                </TouchableOpacity>
              </View>
            </View>

          </>
        )}




        <View style={{ height: 80 }} />
      </ScrollView>

      {/* Info modal */}
      <Modal visible={infoOpen} transparent animationType="fade" onRequestClose={() => setInfoOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, settings?.darkMode && styles.modalCardDark]}>
            <Text style={styles.modalTitle}>About savings & loans</Text>
            <Text style={styles.modalText}>
              Savings earn {Math.round(SAVINGS_APR * 100)}% APR, compounded weekly.{"\n"}
              Loans use a market-driven APR and accrue weekly interest at APR/52.{"\n"}
              ⚡ AUTOMATIC PAYMENTS: Your weekly loan payments are automatically deducted from your cash each week - no manual action needed!{"\n"}
              Optional: You can also make extra payments of 15%, 50%, or the full remaining balance anytime. Full payoff includes an early repayment discount of {Math.round(EARLY_FULL_PAY_DISCOUNT * 100)}%.{"\n"}
              Loan caps: Single loan ≤ 15% of net worth; total debt ≤ {MAX_DEBT_TO_FUNDS}× (cash + savings).
            </Text>
            <TouchableOpacity style={styles.modalBtn} onPress={() => setInfoOpen(false)}>
              <Text style={styles.modalBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

/* =========================
   STYLES
   ========================= */
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B0C10' },
  containerDark: { backgroundColor: '#0B0C10' },
  center: { flex: 1, padding: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0B0C10' },
  muted: { color: '#9FA4B3', fontSize: 14 },

  header: {
    paddingTop: 16, paddingHorizontal: 16, paddingBottom: 10,
    backgroundColor: '#11131A', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderBottomColor: '#1F2230', borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerDark: { backgroundColor: '#11131A' },
  headerTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
  backButton: {
    width: scale(36), height: scale(36), borderRadius: responsiveBorderRadius.sm, backgroundColor: '#1A1D29',
    alignItems: 'center', justifyContent: 'center',
  },
  infoButton: {
    width: scale(36), height: scale(36), borderRadius: responsiveBorderRadius.sm, backgroundColor: '#1A1D29',
    alignItems: 'center', justifyContent: 'center',
  },

  balanceRow: { flexDirection: 'row', gap: responsiveSpacing.md, padding: responsiveSpacing.lg },
  balanceCard: { flex: 1, backgroundColor: '#0F1220', borderRadius: responsiveBorderRadius.md, padding: responsiveSpacing.md, borderColor: '#23283B', borderWidth: 0.5 },
  balanceCardDark: { backgroundColor: '#0F1220' },
  balanceIconWrap: {
    width: scale(28), height: scale(28), borderRadius: responsiveBorderRadius.sm, backgroundColor: '#1A1D29',
    alignItems: 'center', justifyContent: 'center', marginBottom: scale(6),
  },
  purpleBg: { backgroundColor: '#5B21B6' },
  balanceLabel: { color: '#9FA4B3', fontSize: responsiveFontSize.sm },
  balanceValue: { color: '#FFFFFF', fontSize: responsiveFontSize['2xl'], fontWeight: '600', marginTop: responsiveSpacing.xs },
  smallRow: { flexDirection: 'row', alignItems: 'center', gap: scale(6), marginTop: scale(6) },
  smallGreen: { color: '#34D399', fontSize: responsiveFontSize.sm, fontWeight: '600' },

  tabContainer: {
    marginHorizontal: responsiveSpacing.lg, backgroundColor: '#0F1220', borderRadius: responsiveBorderRadius.sm, borderColor: '#23283B', borderWidth: 0.5,
    flexDirection: 'row', padding: scale(8), gap: scale(8),
  },
  tabContainerDark: { backgroundColor: '#0F1220' },
  tab: {
    flex: 1, height: scale(48), borderRadius: responsiveBorderRadius.sm, backgroundColor: '#101426',
    alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: responsiveSpacing.xs,
  },
  activeTab: { backgroundColor: '#1E293B' },
  tabText: { fontSize: responsiveFontSize.sm, fontWeight: '600' },
  tabTextActive: { color: '#FFFFFF' },
  tabTextInactive: { color: '#6B7280' },

  scrollContent: { padding: responsiveSpacing.lg, paddingBottom: responsiveSpacing['2xl'] },
  card: { backgroundColor: '#0F1220', borderRadius: responsiveBorderRadius.md, padding: responsiveSpacing.md, marginBottom: responsiveSpacing.sm, borderWidth: 0.5, borderColor: '#23283B' },
  cardDark: { backgroundColor: '#0F1220' },
  section: { color: '#FFFFFF', fontSize: responsiveFontSize.base, fontWeight: '600', marginBottom: responsiveSpacing.sm },
  input: {
    backgroundColor: '#101426', borderRadius: responsiveBorderRadius.md, paddingHorizontal: responsiveSpacing.md, paddingVertical: responsiveSpacing.md,
    color: '#E7EAF2', borderWidth: 1, borderColor: '#2A2D3A', marginBottom: responsiveSpacing.md, flex: 1,
  },
  inputLabel: { color: '#9CA3AF', fontSize: responsiveFontSize.sm, marginBottom: scale(6) },
  fakeInput: {
    backgroundColor: '#101426', borderRadius: responsiveBorderRadius.md, paddingHorizontal: responsiveSpacing.md, paddingVertical: responsiveSpacing.md,
    borderWidth: 1, borderColor: '#2A2D3A', justifyContent: 'center', marginBottom: responsiveSpacing.md, height: scale(44),
  },
  fakeInputText: { color: '#E7EAF2', fontSize: responsiveFontSize.base, fontWeight: '700' },
  row: { flexDirection: 'row', gap: responsiveSpacing.md },

  grid2: { flexDirection: 'row', gap: responsiveSpacing.md },
  gridItem: { flex: 1 },

  termBtn: {
    flex: 1, borderRadius: responsiveBorderRadius.sm, backgroundColor: '#101426', borderWidth: 1, borderColor: '#2A2D3A',
    paddingVertical: responsiveSpacing.sm, alignItems: 'center', justifyContent: 'center',
  },
  termBtnActive: { backgroundColor: '#1E293B', borderColor: '#3B82F6' },
  termText: { fontSize: responsiveFontSize.base, fontWeight: '700' },
  termTextActive: { color: '#FFFFFF' },
  termTextInactive: { color: '#9CA3AF' },

  btnPrimary: {
    flex: 1, backgroundColor: '#2563EB', borderRadius: responsiveBorderRadius.sm, paddingVertical: responsiveSpacing.sm,
    alignItems: 'center', justifyContent: 'center',
  },
  btnSecondary: {
    flex: 1, backgroundColor: '#059669', borderRadius: responsiveBorderRadius.sm, paddingVertical: responsiveSpacing.sm,
    alignItems: 'center', justifyContent: 'center',
  },
  btnText: { color: '#FFFFFF', fontWeight: '600' },

  itemRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: responsiveSpacing.sm },
  itemLeft: { color: '#E7EAF2', fontSize: responsiveFontSize.sm, fontWeight: '500' },
  itemRight: { color: '#9FA4B3', fontSize: responsiveFontSize.base },

  loanItem: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#23283B', paddingTop: responsiveSpacing.md, marginTop: responsiveSpacing.md },
  loanHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: responsiveSpacing.xs },
  loanName: { color: '#FFFFFF', fontSize: responsiveFontSize.base, fontWeight: '600' },
  loanRemaining: { color: '#E7EAF2', fontSize: responsiveFontSize.base, fontWeight: '600' },
  loanMetaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: responsiveSpacing.md, marginTop: responsiveSpacing.xs, marginBottom: responsiveSpacing.md },
  metaText: { color: '#9FA4B3', fontSize: responsiveFontSize.sm },
  summaryRow: { marginTop: responsiveSpacing.sm },

  modalBackdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center', padding: responsiveSpacing.lg,
  },
  modalCard: {
    width: '100%', maxWidth: scale(420), backgroundColor: '#121527', borderRadius: responsiveBorderRadius.xl, padding: responsiveSpacing.lg,
    borderColor: '#23283B', borderWidth: 1,
  },
  modalCardDark: { backgroundColor: '#121527' },
  modalTitle: { color: '#FFFFFF', fontSize: responsiveFontSize.lg, fontWeight: '600', marginBottom: responsiveSpacing.sm },
  modalText: { color: '#C7CBDA', fontSize: responsiveFontSize.base, lineHeight: 20, marginBottom: responsiveSpacing.lg },
  modalBtn: { alignSelf: 'flex-end', backgroundColor: '#2563EB', borderRadius: responsiveBorderRadius.sm, paddingVertical: responsiveSpacing.sm, paddingHorizontal: responsiveSpacing.md },
  modalBtnText: { color: '#FFFFFF', fontWeight: '600' },
});
