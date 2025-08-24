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
import { useGame } from '@/contexts/GameContext';
import { PiggyBank, Wallet, ArrowLeft, Send, TrendingUp, Info } from 'lucide-react-native';

// Prefer expo-router for navigation; gracefully fall back if unavailable.
let useRouterHook:
  | undefined
  | (() => { back: () => void; replace: (p: string) => void; canGoBack?: () => boolean });
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const mod = require('expo-router');
  useRouterHook = mod?.useRouter;
} catch {
  useRouterHook = undefined;
}

/* =========================
   CONFIG
   ========================= */
const SAVINGS_APR = 0.02;                 // 2% APR on savings
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
type TabKey = 'savings' | 'loans' | 'investments';
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
  try {
    return new Intl.NumberFormat('en-SE').format(Math.round(n));
  } catch {
    return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  }
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
  const { gameState, setGameState, saveGame, goBack } = useGame();
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
  const loans: Loan[] = (gameState.bankLoans ?? []) as Loan[];
  const investments = gameState.stocks?.holdings ?? gameState.investments ?? []; // link with Stocks app


  // Local state
  const [savings, setSavings] = useState<number>(initialSavings);
  const [amount, setAmount] = useState<string>('');
  const [transferAmount, setTransferAmount] = useState<string>('');
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

  const onTransferToSavings = useCallback(() => {
    const v = Math.floor(toNumberSafe(transferAmount));
    if (v <= 0) return Alert.alert('Invalid amount', 'Enter an amount greater than 0.');
    if (v > cash) return Alert.alert('Not enough cash', "You don't have that much cash.");

    const nextCash = cash - v;
    const nextSavings = savings + v;
    setSavings(nextSavings);
    commitCashAndSavings(nextCash, nextSavings);
    setTransferAmount('');
    Keyboard.dismiss();
  }, [transferAmount, cash, savings, commitCashAndSavings]);

  const onTransferToCash = useCallback(() => {
    const v = Math.floor(toNumberSafe(transferAmount));
    if (v <= 0) return Alert.alert('Invalid amount', 'Enter an amount greater than 0.');
    if (v > savings) return Alert.alert('Not enough savings', "You don't have that much in savings.");

    const nextCash = cash + v;
    const nextSavings = savings - v;
    setSavings(nextSavings);
    commitCashAndSavings(nextCash, nextSavings);
    setTransferAmount('');
    Keyboard.dismiss();
  }, [transferAmount, cash, savings, commitCashAndSavings]);

  /* ---------- Weekly interest: Savings ---------- */
  const lastSavingsWeek = useRef<number>(gameState.week);
  const weeklySavingsInterest = useMemo(() => (savings * SAVINGS_APR) / 52, [savings]);

  /* ---------- Weekly accrual & auto-repayment for Loans ---------- */
  const lastLoansWeek = useRef<number>(gameState.week);

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

    // Loans weekly accrual + auto-repayment (always ON; cash → savings order)
    if (gameState.week > (lastLoansWeek.current ?? -1)) {
      lastLoansWeek.current = gameState.week;
      const currentLoans: Loan[] = (gameState.bankLoans ?? []) as Loan[];
      if (currentLoans.length > 0) {
        let nextCash = cash;
        let nextSavings = savings;

        const updated = currentLoans.map((ln) => {
          if (ln.remaining <= 0) return { ...ln, remaining: 0 };

          // 1) Weekly interest accrue
          const wr = ln.weeklyRate ?? ln.rateAPR / 52;
          let remaining = ln.remaining + ln.remaining * wr;

          // 2) Attempt amortized installment from Cash -> Savings
          const installment = Math.min(ln.installment || 0, remaining);
          if (installment > 0) {
            let toPay = installment;

            const fromCash = Math.min(toPay, nextCash);
            nextCash -= fromCash;
            toPay -= fromCash;

            if (toPay > 0) {
              const fromSavings = Math.min(toPay, nextSavings);
              nextSavings -= fromSavings;
              toPay -= fromSavings;
            }

            if (toPay <= 0) {
              // installment covered
              remaining -= installment;
            } else {
              // missed payment → penalty (not shown in UI per your request)
              remaining += remaining * MISSED_PAYMENT_PENALTY;
            }
          }

          return { ...ln, remaining: Math.max(0, remaining) };
        });

        // Remove fully paid loans
        const filtered = updated.filter((l) => (l.remaining || 0) > 0);

        setGameState((prev: any) => ({
          ...prev,
          stats: { ...prev.stats, money: clampNonNeg(nextCash) },
          bankSavings: clampNonNeg(nextSavings),
          bankLoans: filtered,
        }));
        saveGame();
        setSavings(clampNonNeg(nextSavings));
      }
    }
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
            <TrendingUp size={14} color="#34D399" />
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

        <TouchableOpacity
          style={[styles.tab, activeTab === 'loans' && styles.activeTab]}
          onPress={() => setActiveTab('loans')}
        >
          <Send size={20} color={activeTab === 'loans' ? '#FFFFFF' : '#6B7280'} />
          <Text style={[styles.tabText, activeTab === 'loans' ? styles.tabTextActive : styles.tabTextInactive]}>
            Loans
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'investments' && styles.activeTab]}
          onPress={() => setActiveTab('investments')}
        >
          <TrendingUp size={20} color={activeTab === 'investments' ? '#FFFFFF' : '#6B7280'} />
          <Text style={[styles.tabText, activeTab === 'investments' ? styles.tabTextActive : styles.tabTextInactive]}>
            Investments
          </Text>
        </TouchableOpacity>


      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
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

            <View style={[styles.card, settings?.darkMode && styles.cardDark]}>
              <Text style={styles.section}>Transfer</Text>
              <TextInput
                value={transferAmount}
                onChangeText={setTransferAmount}
                placeholder="Amount"
                placeholderTextColor="#9CA3AF"
                keyboardType="numeric"
                style={styles.input}
                returnKeyType="done"
              />
              <View style={styles.row}>
                <TouchableOpacity style={styles.btnPrimary} onPress={onTransferToSavings}>
                  <Text style={styles.btnText}>Cash → Savings</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.btnSecondary} onPress={onTransferToCash}>
                  <Text style={styles.btnText}>Savings → Cash</Text>
                </TouchableOpacity>
              </View>
            </View>
          </>
        )}

        {/* Loans */}
        {activeTab === 'loans' && (
          <>
            {/* Take a Loan (APR is market-determined, no APR input) */}
            <View style={[styles.card, settings?.darkMode && styles.cardDark]}>
              <Text style={styles.section}>Take a Loan</Text>

              <View style={styles.grid2}>
                <View style={styles.gridItem}>
                  <Text style={styles.inputLabel}>Amount (Cap ~ {formatMoney(singleLoanCap)} kr)</Text>
                  <TextInput
                    value={loanAmount}
                    onChangeText={setLoanAmount}
                    placeholder={`≤ ${formatMoney(singleLoanCap)}`}
                    placeholderTextColor="#9CA3AF"
                    keyboardType="numeric"
                    style={styles.input}
                    returnKeyType="done"
                  />
                </View>

                <View style={styles.gridItem}>
                  <Text style={styles.inputLabel}>Market APR</Text>
                  <View style={styles.fakeInput}>
                    <Text style={styles.fakeInputText}>{marketAPRPercent}</Text>
                  </View>
                </View>
              </View>

              <Text style={[styles.inputLabel, { marginTop: 6 }]}>Choose term</Text>
              <View style={styles.row}>
                {TERM_OPTIONS.map((w) => (
                  <TouchableOpacity
                    key={w}
                    style={[styles.termBtn, selectedTerm === w && styles.termBtnActive]}
                    onPress={() => setSelectedTerm(w)}
                  >
                    <Text
                      style={[
                        styles.termText,
                        selectedTerm === w ? styles.termTextActive : styles.termTextInactive,
                      ]}
                    >
                      {w} weeks
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={{ marginTop: 8 }}>
                <Text style={styles.muted}>
                  Approx cost/w: 32w ≈ {formatMoney(approxCost32)} kr • 64w ≈ {formatMoney(approxCost64)} kr
                </Text>
              </View>

              <View style={styles.summaryRow}>
                <Text style={styles.muted}>
                  Total outstanding: {formatMoney(totalLoansRemaining)} kr (limit ~ {formatMoney(maxTotalDebt)} kr)
                </Text>
              </View>

              <View style={{ marginTop: 10 }}>
                <TouchableOpacity style={styles.btnPrimary} onPress={takeLoan}>
                  <Text style={styles.btnText}>Take Loan</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Manual repay controls: source toggle + 15% / 50% / Full */}
            <View style={[styles.card, settings?.darkMode && styles.cardDark]}>
              <Text style={styles.section}>Repay Source</Text>
              <View style={styles.row}>
                <TouchableOpacity
                  style={[styles.termBtn, repaySource === 'cash' && styles.termBtnActive]}
                  onPress={() => setRepaySource('cash')}
                >
                  <Text
                    style={[
                      styles.termText,
                      repaySource === 'cash' ? styles.termTextActive : styles.termTextInactive,
                    ]}
                  >
                    Pay from Cash
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.termBtn, repaySource === 'bank' && styles.termBtnActive]}
                  onPress={() => setRepaySource('bank')}
                >
                  <Text
                    style={[
                      styles.termText,
                      repaySource === 'bank' ? styles.termTextActive : styles.termTextInactive,
                    ]}
                  >
                    Pay from Bank
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Loan list (auto-pay always on) with 15% / 50% / Full repay */}
            <View style={[styles.card, settings?.darkMode && styles.cardDark]}>
              <Text style={styles.section}>Your Loans</Text>
              {(loans.length === 0) ? (
                <Text style={styles.muted}>No active loans.</Text>
              ) : (
                loans.map((ln) => {
                  const aprPercent = (ln.rateAPR * 100).toFixed(2);
                  const costPerWeek = Math.min(ln.installment || 0, Math.ceil(ln.remaining)); // show installment as "cost / w"
                  return (
                    <View key={ln.id} style={styles.loanItem}>
                      <View style={styles.loanHeader}>
                        <Text style={styles.loanName}>{ln.name}</Text>
                        <Text style={styles.loanRemaining}>{formatMoney(ln.remaining)} kr</Text>
                      </View>

                      <View style={styles.loanMetaRow}>
                        <Text style={styles.metaText}>APR: {aprPercent}%</Text>
                        <Text style={styles.metaText}>cost / w: {formatMoney(costPerWeek)} kr</Text>
                        <Text style={styles.metaText}>Term: {ln.termWeeks} w</Text>
                      </View>

                      <View style={styles.row}>
                        <TouchableOpacity
                          style={styles.btnSecondary}
                          onPress={() => repayPercent(ln.id, 0.15)}
                        >
                          <Text style={styles.btnText}>Pay 15%</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.btnSecondary}
                          onPress={() => repayPercent(ln.id, 0.5)}
                        >
                          <Text style={styles.btnText}>Pay 50%</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.btnPrimary}
                          onPress={() => repayFull(ln.id)}
                        >
                          <Text style={styles.btnText}>
                            Pay Full (−{Math.round(EARLY_FULL_PAY_DISCOUNT * 100)}%)
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })
              )}
            </View>
          </>
        )}

        {/* Investments (linked with Stocks app holdings) */}
        {activeTab === 'investments' && (
          <View style={[styles.card, settings?.darkMode && styles.cardDark]}>
            <Text style={styles.section}>Portfolio (linked to Stocks)</Text>
            {(!investments || investments.length === 0) ? (
              <Text style={styles.muted}>No investments yet.</Text>
            ) : (
              investments.map((inv: any, idx: number) => {
                const name = inv.ticker || inv.name || `Asset ${idx + 1}`;
                const shares = Number(inv.shares ?? 0);
                const price = Number(inv.currentPrice ?? inv.price ?? 0);
                const value = inv.value ?? shares * price;
                return (
                  <View key={name + idx} style={styles.itemRow}>
                    <Text style={styles.itemLeft}>
                      {name} {shares ? `• ${shares} sh` : ''}
                    </Text>
                    <Text style={styles.itemRight}>{formatMoney(value || 0)} kr</Text>
                  </View>
                );
              })
            )}
          </View>
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
              Loans use a market-driven APR and accrue weekly interest at APR/52. Auto-pay is always on (Cash→Savings).{"\n"}
              You can also repay 15%, 50%, or the full remaining balance anytime. Full payoff includes an early repayment discount of {Math.round(EARLY_FULL_PAY_DISCOUNT * 100)}%.{"\n"}
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
  headerTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '800' },
  backButton: {
    width: 40, height: 40, borderRadius: 10, backgroundColor: '#1A1D29',
    alignItems: 'center', justifyContent: 'center',
  },
  infoButton: {
    width: 40, height: 40, borderRadius: 10, backgroundColor: '#1A1D29',
    alignItems: 'center', justifyContent: 'center',
  },

  balanceRow: { flexDirection: 'row', gap: 12, padding: 16 },
  balanceCard: { flex: 1, backgroundColor: '#0F1220', borderRadius: 14, padding: 14, borderColor: '#23283B', borderWidth: 1 },
  balanceCardDark: { backgroundColor: '#0F1220' },
  balanceIconWrap: {
    width: 28, height: 28, borderRadius: 6, backgroundColor: '#1A1D29',
    alignItems: 'center', justifyContent: 'center', marginBottom: 6,
  },
  purpleBg: { backgroundColor: '#5B21B6' },
  balanceLabel: { color: '#9FA4B3', fontSize: 12 },
  balanceValue: { color: '#FFFFFF', fontSize: 22, fontWeight: '800', marginTop: 4 },
  smallRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  smallGreen: { color: '#34D399', fontSize: 12, fontWeight: '700' },

  tabContainer: {
    marginHorizontal: 16, backgroundColor: '#0F1220', borderRadius: 12, borderColor: '#23283B', borderWidth: 1,
    flexDirection: 'row', padding: 6, gap: 6,
  },
  tabContainerDark: { backgroundColor: '#0F1220' },
  tab: {
    flex: 1, height: 40, borderRadius: 10, backgroundColor: '#101426',
    alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8,
  },
  activeTab: { backgroundColor: '#1E293B' },
  tabText: { fontSize: 13, fontWeight: '700' },
  tabTextActive: { color: '#FFFFFF' },
  tabTextInactive: { color: '#6B7280' },

  scrollContent: { padding: 16, paddingBottom: 24 },
  card: { backgroundColor: '#0F1220', borderRadius: 14, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: '#23283B' },
  cardDark: { backgroundColor: '#0F1220' },
  section: { color: '#FFFFFF', fontSize: 16, fontWeight: '800', marginBottom: 10 },
  input: {
    backgroundColor: '#101426', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10,
    color: '#E7EAF2', borderWidth: 1, borderColor: '#2A2D3A', marginBottom: 10, flex: 1,
  },
  inputLabel: { color: '#9CA3AF', fontSize: 12, marginBottom: 6 },
  fakeInput: {
    backgroundColor: '#101426', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 12,
    borderWidth: 1, borderColor: '#2A2D3A', justifyContent: 'center', marginBottom: 10, height: 44,
  },
  fakeInputText: { color: '#E7EAF2', fontSize: 14, fontWeight: '700' },
  row: { flexDirection: 'row', gap: 10 },

  grid2: { flexDirection: 'row', gap: 10 },
  gridItem: { flex: 1 },

  termBtn: {
    flex: 1, borderRadius: 10, backgroundColor: '#101426', borderWidth: 1, borderColor: '#2A2D3A',
    paddingVertical: 12, alignItems: 'center', justifyContent: 'center',
  },
  termBtnActive: { backgroundColor: '#1E293B', borderColor: '#3B82F6' },
  termText: { fontSize: 14, fontWeight: '700' },
  termTextActive: { color: '#FFFFFF' },
  termTextInactive: { color: '#9CA3AF' },

  btnPrimary: {
    flex: 1, backgroundColor: '#3B82F6', borderRadius: 10, paddingVertical: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  btnSecondary: {
    flex: 1, backgroundColor: '#10B981', borderRadius: 10, paddingVertical: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  btnText: { color: '#FFFFFF', fontWeight: '700' },

  itemRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 },
  itemLeft: { color: '#E7EAF2', fontSize: 14, fontWeight: '600' },
  itemRight: { color: '#9FA4B3', fontSize: 14 },

  loanItem: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#23283B', paddingTop: 10, marginTop: 10 },
  loanHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  loanName: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  loanRemaining: { color: '#E7EAF2', fontSize: 15, fontWeight: '700' },
  loanMetaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 4, marginBottom: 10 },
  metaText: { color: '#9FA4B3', fontSize: 12 },
  summaryRow: { marginTop: 8 },

  modalBackdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center', padding: 20,
  },
  modalCard: {
    width: '100%', maxWidth: 420, backgroundColor: '#121527', borderRadius: 16, padding: 16,
    borderColor: '#23283B', borderWidth: 1,
  },
  modalCardDark: { backgroundColor: '#121527' },
  modalTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '800', marginBottom: 8 },
  modalText: { color: '#C7CBDA', fontSize: 14, lineHeight: 20, marginBottom: 14 },
  modalBtn: { alignSelf: 'flex-end', backgroundColor: '#3B82F6', borderRadius: 10, paddingVertical: 10, paddingHorizontal: 16 },
  modalBtnText: { color: '#FFFFFF', fontWeight: '700' },
});
