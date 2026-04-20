import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Image,
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
import { GameState } from '@/contexts/game/types';
import { PiggyBank, Wallet, ArrowLeft, Info, CreditCard, TrendingUp, Crown, CheckCircle, Building } from 'lucide-react-native';
import LinearGradientFallback from '@/components/fallbacks/LinearGradientFallback';
const LinearGradient = LinearGradientFallback;
import { iapService } from '@/services/IAPService';
import { IAP_PRODUCTS, getProductConfig } from '@/utils/iapConfig';
import { useFeedback } from '@/utils/feedbackSystem';
import {
  SAVINGS_APR_BASE,
  SAVINGS_APR_FINANCIAL_PLANNING,
} from '@/lib/economy/constants';
import { WEEKS_PER_YEAR } from '@/lib/config/gameConstants';
import { getMarketAPRForGameWeek } from '@/utils/bankMarketAPR';

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
const SAVINGS_APR = SAVINGS_APR_BASE;
const PREMIUM_SAVINGS_APR = SAVINGS_APR_FINANCIAL_PLANNING;
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
type TabKey = 'savings' | 'loans' | 'services';
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
  weeklyPayment?: number; // For game loop auto-payment compatibility
  missedPayments: number;
  autoPay?: boolean;   // logically always true; kept for compatibility
  type?: 'personal' | 'business' | 'mortgage' | 'auto';
  weeksRemaining?: number;
  interestRate?: number;
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
  } else if (a > 10_000) {
    // Thousands (K) - only for numbers above 10,000
    formatted = `${(a / 1_000).toFixed(2)}K`;
  } else {
    // Regular numbers (0-10,000) - show full number
    formatted = a.toLocaleString();
  }
  
  // Remove trailing zeros and decimal point if not needed
  formatted = formatted.replace(/\.00$/, '').replace(/\.0$/, '');
  
  return `${sign}${formatted}`;
}
function amortizedInstallment(principal: number, weeklyRate: number, termWeeks: number): number {
  if (termWeeks <= 0) return principal; // safety
  if (weeklyRate <= 0) return Math.max(principal / termWeeks, principal * 0.001); // At least 0.1% per week
  
  // BUG FIX: Use more stable formula for long terms to prevent zero payments
  // A = P * r / (1 - (1 + r)^-n)
  const r = weeklyRate;
  const n = termWeeks;
  const denom = 1 - Math.pow(1 + r, -n);
  
  if (denom === 0 || denom < 0.0001) {
    // Fallback for very small denominators (very long terms)
    return Math.max(principal / termWeeks, principal * 0.001); // At least 0.1% per week
  }
  
  const payment = principal * (r / denom);
  
  // BUG FIX: Ensure minimum payment to prevent zero debt issue
  // At least 0.1% of principal per week ensures debt is paid down
  return Math.max(payment, principal * 0.001);
}

/* =========================
   COMPONENT
   ========================= */
interface BankAppProps {
  onBack: () => void;
}

export default function BankApp({ onBack }: BankAppProps) {
  const { gameState, setGameState, saveGame } = useGame();
  
  // All hooks must be called before any early returns
  const [activeTab, setActiveTab] = useState<TabKey>('savings');
  const [savings, setSavings] = useState<number>(0);
  const [amount, setAmount] = useState<string>('');
  const [infoOpen, setInfoOpen] = useState(false);
  const [loanAmount, setLoanAmount] = useState<string>('10000');
  const [selectedTerm, setSelectedTerm] = useState<typeof TERM_OPTIONS[number]>(TERM_OPTIONS[0]);
  const [repaySource, setRepaySource] = useState<RepaySource>('cash');
  const [iapState, setIapState] = useState(iapService.getState());
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [selectedService, setSelectedService] = useState<string | null>(null);
  
  // Get settings with fallback
  const settings = gameState?.settings || { hapticFeedback: false };
  const { buttonPress, haptic, success } = useFeedback(settings.hapticFeedback);

  // From state (safe to access even if undefined)
  const cash = gameState?.stats?.money ?? 0;
  const initialSavings = gameState?.bankSavings ?? 0;
  const loans: Loan[] = gameState?.loans ?? [];
  const investments: Array<{ symbol: string; shares: number; averagePrice: number; currentPrice: number; value?: number; price?: number }> = gameState?.stocks?.holdings ?? [];

  // Update savings when initialSavings changes
  useEffect(() => {
    if (gameState?.bankSavings !== undefined) {
      setSavings(gameState.bankSavings);
    }
  }, [gameState?.bankSavings]);

  // Initialize IAP service
  useEffect(() => {
    const unsubscribe = iapService.addListener(setIapState);
    iapService.initialize();
    return unsubscribe;
  }, []);

  // Helper functions for IAP services
  const hasService = useCallback((serviceId: string) => {
    return iapService.hasPurchased(serviceId);
  }, []);

  const getServiceConfig = useCallback((serviceId: string) => {
    return getProductConfig(serviceId);
  }, []);

  // All computed values (using safe defaults)
  const totalDebt = useMemo(() => (loans || []).reduce((sum, l) => sum + (l.remaining || 0), 0), [loans]);
  const investmentsValue = useMemo(() => {
    return (investments || []).reduce((s: number, it: { value?: number; shares?: number; currentPrice?: number; price?: number }) => {
      const value = typeof it?.value === 'number'
        ? it.value
        : (Number(it?.shares) || 0) * (Number(it?.currentPrice ?? it?.price ?? 0) || 0);
      return s + (value || 0);
    }, 0);
  }, [investments]);
  const computedNetWorth = useMemo(
    () => cash + savings + investmentsValue - totalDebt,
    [cash, savings, investmentsValue, totalDebt]
  );
  const singleLoanCap = useMemo(
    () => Math.max(MIN_LOAN_FLOOR, Math.floor(computedNetWorth * LOAN_CAP_NET_WORTH_RATIO)),
    [computedNetWorth]
  );
  const totalFunds = useMemo(() => cash + savings, [cash, savings]);
  const maxTotalDebt = useMemo(() => Math.floor(totalFunds * MAX_DEBT_TO_FUNDS), [totalFunds]);
  const currentSavingsAPR = useMemo(() => {
    return hasService(IAP_PRODUCTS.FINANCIAL_PLANNING) ? PREMIUM_SAVINGS_APR : SAVINGS_APR;
  }, [hasService]);
  const weeklySavingsInterest = useMemo(() => (savings * currentSavingsAPR) / WEEKS_PER_YEAR, [savings, currentSavingsAPR]);
  const weeklyInterestRate = useMemo(() => (currentSavingsAPR / WEEKS_PER_YEAR) * 100, [currentSavingsAPR]);
  const weeklySavingsText = useMemo(
    () => `+${formatMoney(weeklySavingsInterest)} / w (${weeklyInterestRate.toFixed(2)}%)`,
    [weeklySavingsInterest, weeklyInterestRate]
  );
  const marketAPR = useMemo(
    () => getMarketAPRForGameWeek(gameState?.weeksLived, gameState?.week),
    [gameState?.weeksLived, gameState?.week]
  );
  const marketAPRPercent = useMemo(() => `${(marketAPR * 100).toFixed(2)}%`, [marketAPR]);
  const approxCost32 = useMemo(() => {
    const amt = Math.floor(toNumberSafe(loanAmount));
    if (amt <= 0) return 0;
    return amortizedInstallment(amt, marketAPR / WEEKS_PER_YEAR, 32);
  }, [loanAmount, marketAPR]);
  const approxCost64 = useMemo(() => {
    const amt = Math.floor(toNumberSafe(loanAmount));
    if (amt <= 0) return 0;
    return amortizedInstallment(amt, marketAPR / WEEKS_PER_YEAR, 64);
  }, [loanAmount, marketAPR]);
  const totalLoansRemaining = useMemo(
    () => (loans || []).reduce((sum, l) => sum + (l.remaining || 0), 0),
    [loans]
  );
  const formattedCash = useMemo(() => formatMoney(cash), [cash]);
  const formattedSavings = useMemo(() => formatMoney(savings), [savings]);

  // All callbacks
  const commitCashAndSavings = useCallback(
    (nextCash: number, nextSavings: number) => {
      if (!setGameState || !saveGame) return;
      setGameState((prev: GameState) => ({
        ...prev,
        stats: { ...prev.stats, money: clampNonNeg(nextCash) },
        bankSavings: clampNonNeg(nextSavings),
      }));
      saveGame();
    },
    [setGameState, saveGame]
  );

  const onDeposit = useCallback(() => {
    if (!gameState || !setGameState || !saveGame) return;
    const v = Math.floor(toNumberSafe(amount));
    if (v <= 0) return Alert.alert('Invalid amount', 'Enter an amount greater than 0.');
    if (v > cash) return Alert.alert('Not enough cash', "You don&apos;t have that much cash.");
    const nextCash = cash - v;
    const nextSavings = savings + v;
    setSavings(nextSavings);
    commitCashAndSavings(nextCash, nextSavings);
    setAmount('');
    Keyboard.dismiss();
  }, [amount, cash, savings, commitCashAndSavings, gameState, setGameState, saveGame]);

  const onWithdraw = useCallback(() => {
    if (!gameState || !setGameState || !saveGame) return;
    const v = Math.floor(toNumberSafe(amount));
    if (v <= 0) return Alert.alert('Invalid amount', 'Enter an amount greater than 0.');
    if (v > savings) return Alert.alert('Not enough savings', "You don&apos;t have that much in savings.");
    const nextCash = cash + v;
    const nextSavings = savings - v;
    setSavings(nextSavings);
    commitCashAndSavings(nextCash, nextSavings);
    setAmount('');
    Keyboard.dismiss();
  }, [amount, cash, savings, commitCashAndSavings, gameState, setGameState, saveGame]);

  const takeLoan = useCallback(() => {
    if (!gameState || !setGameState || !saveGame) return;
    buttonPress();
    haptic('light');
    
    const amt = Math.floor(toNumberSafe(loanAmount));
    if (amt <= 0) {
      Alert.alert('Invalid amount', 'Loan amount must be > 0.');
      return;
    }

    const privateBankingMultiplier = hasService(IAP_PRODUCTS.PRIVATE_BANKING) ? 1.5 : 1;
    const adjustedLoanCap = Math.floor(singleLoanCap * privateBankingMultiplier);
    const adjustedMaxDebt = Math.floor(maxTotalDebt * privateBankingMultiplier);
    
    if (amt > adjustedLoanCap) {
      Alert.alert(
        'Loan declined',
        `Amount exceeds your single-loan cap (${formatMoney(adjustedLoanCap)} $).`
      );
      return;
    }
    if (totalDebt + amt > adjustedMaxDebt) {
      Alert.alert(
        'Loan declined',
        `Total debt would exceed your limit (${formatMoney(adjustedMaxDebt)} $).`
      );
      return;
    }

    const baseAPR = getMarketAPRForGameWeek(gameState.weeksLived, gameState.week);
    const privateBankingDiscount = hasService(IAP_PRODUCTS.PRIVATE_BANKING) ? (baseAPR - 0.03) : 0;
    
    let politicalInterestReduction = 0;
    if (gameState.politics && gameState.politics.careerLevel > 0) {
      const { getCombinedPerkEffects } = require('@/lib/politics/perks');
      const perkEffects = getCombinedPerkEffects(gameState.politics.careerLevel);
      politicalInterestReduction = perkEffects.loanInterestReduction / 100;
    }
    
    const apr = Math.max(0.01, baseAPR - privateBankingDiscount - politicalInterestReduction);
    const weeklyRate = apr / WEEKS_PER_YEAR;
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
      startWeek: gameState.weeksLived ?? 0,
      installment,
      weeklyPayment: installment,
      missedPayments: 0,
      autoPay: true,
      type: 'personal' as const,
      weeksRemaining: termW,
      interestRate: apr,
    };

    const nextCash = cash + amt;
    setGameState((prev: GameState) => ({
      ...prev,
      stats: { ...prev.stats, money: clampNonNeg(nextCash) },
      loans: [...(prev.loans ?? []), newLoan],
    }));
    saveGame();

    success('Loan approved and funds transferred!');
    setLoanAmount('10000');
    Keyboard.dismiss();
  }, [
    loanAmount,
    singleLoanCap,
    maxTotalDebt,
    totalDebt,
    selectedTerm,
    loans,
    cash,
    gameState,
    setGameState,
    saveGame,
    hasService,
    buttonPress,
    haptic,
    success,
  ]);

  // Helper function for repay calculations (not a hook)
  const repayFromChosenSourceHelper = useCallback((target: number, source: RepaySource): {
    nextCash: number;
    nextSavings: number;
    paid: number;
  } => {
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
  }, [cash, savings]);

  const repayPercent = useCallback(
    (loanId: string, pct: number) => {
      if (!gameState || !setGameState || !saveGame) return;
      const idx = loans.findIndex((l) => l.id === loanId);
      if (idx === -1) return;

      const ln = loans[idx];
      if (ln.remaining <= 0) return;

      const target = Math.ceil(ln.remaining * pct);
      const { nextCash, nextSavings, paid } = repayFromChosenSourceHelper(target, repaySource);
      if (paid <= 0) {
        Alert.alert(
          'Not enough funds',
          `You don&apos;t have enough ${repaySource === 'cash' ? 'cash' : 'bank savings'} to pay this.`
        );
        return;
      }

      const newRemaining = Math.max(0, ln.remaining - paid);
      const updated = [...loans];
      updated[idx] = { ...ln, remaining: newRemaining };

      const filtered = updated.filter((l) => (l.remaining || 0) > 0);

      setGameState((prev: GameState) => ({
        ...prev,
        stats: { ...prev.stats, money: clampNonNeg(nextCash) },
        bankSavings: clampNonNeg(nextSavings),
        loans: filtered,
      }));
      saveGame();
      setSavings(clampNonNeg(nextSavings));
    },
    [loans, repaySource, setGameState, saveGame, gameState, repayFromChosenSourceHelper]
  );

  const repayFull = useCallback(
    (loanId: string) => {
      if (!gameState || !setGameState || !saveGame) return;
      const idx = loans.findIndex((l) => l.id === loanId);
      if (idx === -1) return;
      const ln = loans[idx];
      if (ln.remaining <= 0) return;

      const discounted = Math.ceil(ln.remaining * (1 - EARLY_FULL_PAY_DISCOUNT));
      const { nextCash, nextSavings, paid } = repayFromChosenSourceHelper(discounted, repaySource);
      if (paid < discounted) {
        Alert.alert(
          'Not enough funds',
          `You need ${formatMoney(discounted)} $ in ${repaySource === 'cash' ? 'cash' : 'bank savings'} to fully repay after discount.`
        );
        return;
      }

      const updated = [...loans];
      updated[idx] = { ...ln, remaining: 0 };

      const filtered = updated.filter((l) => (l.remaining || 0) > 0);

      setGameState((prev: GameState) => ({
        ...prev,
        stats: { ...prev.stats, money: clampNonNeg(nextCash) },
        bankSavings: clampNonNeg(nextSavings),
        loans: filtered,
      }));
      saveGame();
      setSavings(clampNonNeg(nextSavings));
    },
    [loans, repaySource, setGameState, saveGame, gameState, repayFromChosenSourceHelper]
  );


  // Early return after all hooks
  if (!gameState || !setGameState || !saveGame) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>Loading bank data…</Text>
      </View>
    );
  }

  // Helper functions (non-hooks, can be after early return)
  const handleServicePurchase = async (serviceId: string) => {
    buttonPress();
    haptic('light');
    try {
      const result = await iapService.purchaseProduct(serviceId);
      if (result.success) {
        success('Service activated successfully!');
        setShowPurchaseModal(false);
        setSelectedService(null);
        setIapState(iapService.getState());
      } else {
        Alert.alert('Purchase Failed', result.message);
      }
    } catch (error) {
      Alert.alert('Purchase Error', 'Failed to purchase service. Please try again.');
    }
  };

  const openServiceModal = (serviceId: string) => {
    buttonPress();
    haptic('light');
    setSelectedService(serviceId);
    setShowPurchaseModal(true);
  };

  // Helper function (non-hook, can be after early return)
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

  /* ---------- RENDER ---------- */
  return (
    <View style={[styles.container, settings?.darkMode && styles.containerDark]}>
      <ScrollView 
        contentContainerStyle={styles.scrollContent} 
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={true}
      >
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
            <Text style={styles.balanceValue}>{formattedCash} $</Text>
          </View>

          <View style={[styles.balanceCard, settings?.darkMode && styles.balanceCardDark]}>
            <View style={[styles.balanceIconWrap, styles.purpleBg]}>
              <PiggyBank size={18} color="#FFFFFF" />
            </View>
            <Text style={styles.balanceLabel}>Savings</Text>
            <Text style={styles.balanceValue}>{formattedSavings} $</Text>
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
            onPress={() => {
              buttonPress();
              setActiveTab('savings');
            }}
          >
            <PiggyBank size={20} color={activeTab === 'savings' ? '#FFFFFF' : (settings?.darkMode ? '#FFFFFF' : '#6B7280')} />
            <Text style={[styles.tabText, activeTab === 'savings' ? styles.tabTextActive : (settings?.darkMode ? styles.tabTextInactiveDark : styles.tabTextInactive)]}>
              Savings
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tab, activeTab === 'loans' && styles.activeTab]}
            onPress={() => {
              buttonPress();
              setActiveTab('loans');
            }}
          >
            <CreditCard size={20} color={activeTab === 'loans' ? '#FFFFFF' : (settings?.darkMode ? '#FFFFFF' : '#6B7280')} />
            <Text style={[styles.tabText, activeTab === 'loans' ? styles.tabTextActive : (settings?.darkMode ? styles.tabTextInactiveDark : styles.tabTextInactive)]}>
              Loans
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tab, activeTab === 'services' && styles.activeTab]}
            onPress={() => {
              buttonPress();
              setActiveTab('services');
            }}
          >
            <Crown size={20} color={activeTab === 'services' ? '#FFFFFF' : (settings?.darkMode ? '#FFFFFF' : '#6B7280')} />
            <Text style={[styles.tabText, activeTab === 'services' ? styles.tabTextActive : (settings?.darkMode ? styles.tabTextInactiveDark : styles.tabTextInactive)]}>
              Services
            </Text>
          </TouchableOpacity>
        </View>
        {/* Savings */}
        {activeTab === 'savings' && (
          <>
            <View style={[styles.card, settings?.darkMode && styles.cardDark]}>
              <Text style={styles.section}>Deposit / Withdraw</Text>
              <TextInput
                value={amount}
                onChangeText={setAmount}
                placeholder="Amount"
                placeholderTextColor={settings?.darkMode ? "#FFFFFF" : "#9CA3AF"}
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

            {/* Interest Rate Info Card */}
            <View style={[styles.card, styles.interestCard, settings?.darkMode && styles.interestCardDark]}>
              <View style={styles.interestHeader}>
                <TrendingUp size={18} color="#34D399" />
                <Text style={[styles.interestTitle, settings?.darkMode && styles.interestTitleDark]}>Savings Interest</Text>
              </View>
              <View style={styles.interestDetails}>
                <View style={styles.interestRow}>
                  <Text style={[styles.interestLabel, settings?.darkMode && styles.interestLabelDark]}>Annual Rate (APR):</Text>
                  <Text style={styles.interestValue}>{(currentSavingsAPR * 100).toFixed(1)}%</Text>
                </View>
                <View style={styles.interestRow}>
                  <Text style={[styles.interestLabel, settings?.darkMode && styles.interestLabelDark]}>Weekly Rate:</Text>
                  <Text style={styles.interestValue}>{weeklyInterestRate.toFixed(2)}%</Text>
                </View>
                <View style={styles.interestRow}>
                  <Text style={[styles.interestLabel, settings?.darkMode && styles.interestLabelDark]}>Weekly Earnings:</Text>
                  <Text style={[styles.interestValue, styles.interestEarnings]}>+{formatMoney(weeklySavingsInterest)} $</Text>
                </View>
              </View>
              <Text style={[styles.interestNote, settings?.darkMode && styles.interestNoteDark]}>
                Interest is automatically added to your savings each week.
              </Text>
            </View>

            {/* Financial Planning Benefits */}
            {hasService(IAP_PRODUCTS.FINANCIAL_PLANNING) && (
              <View style={[styles.card, styles.premiumCard, settings?.darkMode && styles.cardDark]}>
                <View style={styles.premiumHeader}>
                  <Crown size={20} color="#FFD700" />
                  <Text style={styles.premiumTitle}>Financial Planning Active</Text>
                </View>
                <Text style={styles.premiumText}>
                  You&apos;re earning {(currentSavingsAPR * 100).toFixed(0)}% APR on savings (double interest!)
                </Text>
              </View>
            )}
          </>
        )}

        {/* Loans */}
        {activeTab === 'loans' && (
          <>
            {/* Apply for New Loan */}
            <View style={[styles.card, settings?.darkMode && styles.cardDark]}>
              <Text style={styles.section}>Apply for New Loan</Text>
              
              <TextInput
                value={loanAmount}
                onChangeText={setLoanAmount}
                placeholder="Loan amount"
                placeholderTextColor={settings?.darkMode ? "#FFFFFF" : "#9CA3AF"}
                keyboardType="numeric"
                style={styles.input}
                returnKeyType="done"
              />
              
              <View style={styles.termSelector}>
                <Text style={styles.termLabel}>Term:</Text>
                {TERM_OPTIONS.map((term) => (
                  <TouchableOpacity
                    key={term}
                    style={[
                      styles.termButton,
                      selectedTerm === term && styles.termButtonActive
                    ]}
                    onPress={() => {
                      buttonPress();
                      setSelectedTerm(term);
                    }}
                  >
                    <Text style={[
                      styles.termButtonText,
                      settings?.darkMode && styles.termButtonTextDark,
                      selectedTerm === term && styles.termButtonTextActive
                    ]}>
                      {term} weeks
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.loanInfo}>
                <Text style={styles.loanInfoText}>
                  Max loan: {formatMoney(singleLoanCap * (hasService(IAP_PRODUCTS.PRIVATE_BANKING) ? 1.5 : 1))} $
                </Text>
                <Text style={styles.loanInfoText}>
                  APR: {(hasService(IAP_PRODUCTS.PRIVATE_BANKING) ? 3 : marketAPR * 100).toFixed(2)}%
                </Text>
                <Text style={styles.loanInfoText}>
                  Weekly payment: ~{formatMoney(approxCost32)} $
                </Text>
              </View>

              <TouchableOpacity 
                style={[styles.btnPrimary, styles.loanButton]} 
                onPress={takeLoan}
              >
                <Text style={styles.btnText}>Apply for Loan</Text>
              </TouchableOpacity>
            </View>

            {/* Current Loans */}
            {loans.length > 0 && (
              <View style={[styles.card, settings?.darkMode && styles.cardDark]}>
                <Text style={styles.section}>Current Loans</Text>
                {loans.map((loan) => (
                  <View key={loan.id} style={styles.loanItem}>
                    <View style={styles.loanHeader}>
                      <Text style={styles.loanName}>{loan.name}</Text>
                      <Text style={styles.loanRemaining}>{formatMoney(loan.remaining)} $</Text>
                    </View>
                    <View style={styles.loanMetaRow}>
                      <Text style={styles.metaText}>APR: {(loan.rateAPR * 100).toFixed(2)}%</Text>
                      <Text style={styles.metaText}>Weekly: {formatMoney(loan.installment)} $</Text>
                      <Text style={styles.metaText}>Term: {loan.termWeeks} weeks</Text>
                    </View>
                    <View style={styles.loanActions}>
                      <TouchableOpacity 
                        style={styles.loanActionButton}
                        onPress={() => {
                          buttonPress();
                          repayPercent(loan.id, 0.15);
                        }}
                      >
                        <Text style={[styles.loanActionText, settings?.darkMode && styles.loanActionTextDark]}>Pay 15%</Text>
                      </TouchableOpacity>
                      <TouchableOpacity 
                        style={styles.loanActionButton}
                        onPress={() => {
                          buttonPress();
                          repayPercent(loan.id, 0.5);
                        }}
                      >
                        <Text style={[styles.loanActionText, settings?.darkMode && styles.loanActionTextDark]}>Pay 50%</Text>
                      </TouchableOpacity>
                      <TouchableOpacity 
                        style={[styles.loanActionButton, styles.loanActionButtonPrimary]}
                        onPress={() => {
                          buttonPress();
                          repayFull(loan.id);
                        }}
                      >
                        <Text style={[styles.loanActionText, styles.loanActionTextPrimary]}>Pay Full</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </>
        )}

        {/* Services */}
        {activeTab === 'services' && (
          <>
            <View style={[styles.card, settings?.darkMode && styles.cardDark]}>
              <Text style={styles.section}>Premium Banking Services</Text>
              <Text style={[styles.servicesDescription, settings?.darkMode && styles.servicesDescriptionDark]}>
                Unlock exclusive banking features and benefits
              </Text>
            </View>

            {/* IAP Error Display */}
            {iapState.error && (
              <View style={[styles.card, styles.errorCard, settings?.darkMode && styles.cardDark]}>
                <View style={styles.errorHeader}>
                  <Info size={20} color="#F59E0B" />
                  <Text style={[styles.errorTitle, settings?.darkMode && styles.errorTitleDark]}>
                    In-App Purchases
                  </Text>
                </View>
                <Text style={[styles.errorMessage, settings?.darkMode && styles.errorMessageDark]}>
                  {iapState.error}
                </Text>
                <Text style={[styles.errorSubtext, settings?.darkMode && styles.errorSubtextDark]}>
                  To test purchases, create a development build instead of using Expo Go.
                </Text>
              </View>
            )}

            {/* Premium Banking Services */}
            <View style={[styles.card, settings?.darkMode && styles.cardDark]}>
              <Text style={styles.section}>Premium Banking Services</Text>
              <Text style={[styles.servicesDescription, settings?.darkMode && styles.servicesDescriptionDark]}>
                Exclusive services available on both mobile and computer banking apps
              </Text>
            </View>

            {/* Premium Credit Card Service */}
            <View style={[styles.card, settings?.darkMode && styles.cardDark]}>
              <View style={styles.serviceHeader}>
                <View style={styles.serviceIconContainer}>
                  <Image 
                    source={require('@/assets/images/iap/banking/premium_credit_card.png')} 
                    style={styles.serviceImage} 
                  />
                </View>
                <View style={styles.serviceInfo}>
                  <Text style={styles.serviceName}>Premium Credit Card</Text>
                  <Text style={[styles.servicePrice, settings?.darkMode && styles.servicePriceDark]}>$4.99</Text>
                </View>
                <View style={styles.serviceStatus}>
                  {hasService(IAP_PRODUCTS.PREMIUM_CREDIT_CARD) ? (
                    <View style={styles.activeBadge}>
                      <CheckCircle size={16} color="#10B981" />
                      <Text style={styles.activeText}>Active</Text>
                    </View>
                  ) : (
                    <TouchableOpacity 
                      style={styles.purchaseButton}
                      onPress={() => openServiceModal(IAP_PRODUCTS.PREMIUM_CREDIT_CARD)}
                    >
                      <Text style={styles.purchaseButtonText}>Purchase</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
              <Text style={[styles.serviceDescription, settings?.darkMode && styles.serviceDescriptionDark]}>
                10% cashback on all purchases, no annual fee
              </Text>
            </View>

            {/* Financial Planning Service */}
            <View style={[styles.card, settings?.darkMode && styles.cardDark]}>
              <View style={styles.serviceHeader}>
                <View style={styles.serviceIconContainer}>
                  <Image 
                    source={require('@/assets/images/iap/banking/financial_planning.png')} 
                    style={styles.serviceImage} 
                  />
                </View>
                <View style={styles.serviceInfo}>
                  <Text style={styles.serviceName}>Financial Planning</Text>
                  <Text style={[styles.servicePrice, settings?.darkMode && styles.servicePriceDark]}>$2.99</Text>
                </View>
                <View style={styles.serviceStatus}>
                  {hasService(IAP_PRODUCTS.FINANCIAL_PLANNING) ? (
                    <View style={styles.activeBadge}>
                      <CheckCircle size={16} color="#10B981" />
                      <Text style={styles.activeText}>Active</Text>
                    </View>
                  ) : (
                    <TouchableOpacity 
                      style={styles.purchaseButton}
                      onPress={() => openServiceModal(IAP_PRODUCTS.FINANCIAL_PLANNING)}
                    >
                      <Text style={styles.purchaseButtonText}>Purchase</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
              <Text style={[styles.serviceDescription, settings?.darkMode && styles.serviceDescriptionDark]}>
                15% interest on bank savings, expert financial advice
              </Text>
            </View>

            {/* Business Banking Service */}
            <View style={[styles.card, settings?.darkMode && styles.cardDark]}>
              <View style={styles.serviceHeader}>
                <View style={styles.serviceIconContainer}>
                  <Image 
                    source={require('@/assets/images/iap/banking/business_banking.png')} 
                    style={styles.serviceImage} 
                  />
                </View>
                <View style={styles.serviceInfo}>
                  <Text style={styles.serviceName}>Business Banking</Text>
                  <Text style={[styles.servicePrice, settings?.darkMode && styles.servicePriceDark]}>$3.99</Text>
                </View>
                <View style={styles.serviceStatus}>
                  {hasService(IAP_PRODUCTS.BUSINESS_BANKING) ? (
                    <View style={styles.activeBadge}>
                      <CheckCircle size={16} color="#10B981" />
                      <Text style={styles.activeText}>Active</Text>
                    </View>
                  ) : (
                    <TouchableOpacity 
                      style={styles.purchaseButton}
                      onPress={() => openServiceModal(IAP_PRODUCTS.BUSINESS_BANKING)}
                    >
                      <Text style={styles.purchaseButtonText}>Purchase</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
              <Text style={[styles.serviceDescription, settings?.darkMode && styles.serviceDescriptionDark]}>
                Company loans, business account management, upgrades
              </Text>
            </View>

            {/* Private Banking Service */}
            <View style={[styles.card, settings?.darkMode && styles.cardDark]}>
              <View style={styles.serviceHeader}>
                <View style={styles.serviceIconContainer}>
                  <Image 
                    source={require('@/assets/images/iap/banking/private_banking.png')} 
                    style={styles.serviceImage} 
                  />
                </View>
                <View style={styles.serviceInfo}>
                  <Text style={styles.serviceName}>Private Banking</Text>
                  <Text style={[styles.servicePrice, settings?.darkMode && styles.servicePriceDark]}>$9.99</Text>
                </View>
                <View style={styles.serviceStatus}>
                  {hasService(IAP_PRODUCTS.PRIVATE_BANKING) ? (
                    <View style={styles.activeBadge}>
                      <CheckCircle size={16} color="#10B981" />
                      <Text style={styles.activeText}>Active</Text>
                    </View>
                  ) : (
                    <TouchableOpacity 
                      style={styles.purchaseButton}
                      onPress={() => openServiceModal(IAP_PRODUCTS.PRIVATE_BANKING)}
                    >
                      <Text style={styles.purchaseButtonText}>Purchase</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
              <Text style={[styles.serviceDescription, settings?.darkMode && styles.serviceDescriptionDark]}>
                VIP 3% APR loans, personal wealth manager, priority support
              </Text>
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

      {/* Service Purchase Modal */}
      <Modal visible={showPurchaseModal} transparent animationType="fade" onRequestClose={() => setShowPurchaseModal(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, settings?.darkMode && styles.modalCardDark]}>
            {selectedService && (
              <>
                <Text style={styles.modalTitle}>
                  {getServiceConfig(selectedService)?.name}
                </Text>
                <Text style={styles.modalText}>
                  {getServiceConfig(selectedService)?.description}
                </Text>
                
                <View style={styles.featuresList}>
                  {getServiceConfig(selectedService)?.features?.map((feature, index) => (
                    <View key={index} style={styles.featureItem}>
                      <CheckCircle size={16} color="#10B981" />
                      <Text style={styles.featureText}>{feature}</Text>
                    </View>
                  ))}
                </View>

                <View style={styles.modalActions}>
                  <TouchableOpacity 
                    style={styles.modalBtnSecondary} 
                    onPress={() => setShowPurchaseModal(false)}
                  >
                    <Text style={[styles.modalBtnSecondaryText, settings?.darkMode && styles.modalBtnSecondaryTextDark]}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={styles.modalBtn} 
                    onPress={() => handleServicePurchase(selectedService)}
                  >
                    <Text style={styles.modalBtnText}>
                      Purchase - {getServiceConfig(selectedService)?.price}
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
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
    width: 36, height: 36, borderRadius: responsiveBorderRadius.sm, backgroundColor: '#1A1D29',
    alignItems: 'center', justifyContent: 'center',
  },
  infoButton: {
    width: 36, height: 36, borderRadius: responsiveBorderRadius.sm, backgroundColor: '#1A1D29',
    alignItems: 'center', justifyContent: 'center',
  },

  balanceRow: { flexDirection: 'row', gap: responsiveSpacing.md, padding: responsiveSpacing.lg },
  balanceCard: { flex: 1, backgroundColor: '#0F1220', borderRadius: responsiveBorderRadius.md, padding: responsiveSpacing.md, borderColor: '#23283B', borderWidth: 0.5 },
  balanceCardDark: { backgroundColor: '#0F1220' },
  balanceIconWrap: {
    width: 28, height: 28, borderRadius: responsiveBorderRadius.sm, backgroundColor: '#1A1D29',
    alignItems: 'center', justifyContent: 'center', marginBottom: 6,
  },
  purpleBg: { backgroundColor: '#5B21B6' },
  balanceLabel: { color: '#9FA4B3', fontSize: responsiveFontSize.sm },
  balanceValue: { color: '#FFFFFF', fontSize: responsiveFontSize['2xl'], fontWeight: '600', marginTop: responsiveSpacing.xs },
  smallRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
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
  tabTextInactive: { 
    color: '#6B7280',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 2,
  },
  tabTextInactiveDark: { 
    color: '#FFFFFF',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 2,
  },

  scrollContent: { padding: responsiveSpacing.lg, paddingBottom: responsiveSpacing['2xl'] },
  card: { backgroundColor: '#0F1220', borderRadius: responsiveBorderRadius.md, padding: responsiveSpacing.md, marginBottom: responsiveSpacing.sm, borderWidth: 0.5, borderColor: '#23283B' },
  cardDark: { backgroundColor: '#0F1220' },
  section: { color: '#FFFFFF', fontSize: responsiveFontSize.base, fontWeight: '600', marginBottom: responsiveSpacing.sm },
  input: {
    backgroundColor: '#101426', borderRadius: responsiveBorderRadius.md, paddingHorizontal: responsiveSpacing.md, paddingVertical: responsiveSpacing.md,
    color: '#E7EAF2', borderWidth: 1, borderColor: '#2A2D3A', marginBottom: responsiveSpacing.md, flex: 1,
  },
  inputLabel: { 
    color: '#9CA3AF', 
    fontSize: responsiveFontSize.sm, 
    marginBottom: scale(6),
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 2,
  },
  inputLabelDark: { 
    color: '#FFFFFF',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 2,
  },
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
  termTextInactive: { 
    color: '#9CA3AF',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 2,
  },
  termTextInactiveDark: { 
    color: '#FFFFFF',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 2,
  },

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

  // New loan styles
  termSelector: { flexDirection: 'row', alignItems: 'center', marginVertical: responsiveSpacing.md, gap: responsiveSpacing.sm },
  termLabel: { color: '#E7EAF2', fontSize: responsiveFontSize.base, fontWeight: '500', marginRight: responsiveSpacing.sm },
  termButton: { paddingHorizontal: responsiveSpacing.md, paddingVertical: responsiveSpacing.sm, borderRadius: responsiveBorderRadius.md, borderWidth: 1, borderColor: '#374151' },
  termButtonActive: { backgroundColor: '#3B82F6', borderColor: '#3B82F6' },
  termButtonText: { 
    color: '#9CA3AF', 
    fontSize: responsiveFontSize.sm,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 2,
  },
  termButtonTextDark: { 
    color: '#FFFFFF',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 2,
  },
  termButtonTextActive: { color: '#FFFFFF' },
  loanInfo: { backgroundColor: '#1F2937', padding: responsiveSpacing.md, borderRadius: responsiveBorderRadius.md, marginVertical: responsiveSpacing.md },
  loanInfoText: { color: '#D1D5DB', fontSize: responsiveFontSize.sm, marginBottom: responsiveSpacing.xs },
  loanButton: { marginTop: responsiveSpacing.md },
  loanActions: { flexDirection: 'row', gap: responsiveSpacing.sm, marginTop: responsiveSpacing.sm },
  loanActionButton: { flex: 1, paddingVertical: responsiveSpacing.sm, paddingHorizontal: responsiveSpacing.md, borderRadius: responsiveBorderRadius.md, borderWidth: 1, borderColor: '#374151', alignItems: 'center' },
  loanActionButtonPrimary: { backgroundColor: '#10B981', borderColor: '#10B981' },
  loanActionText: { 
    color: '#9CA3AF', 
    fontSize: responsiveFontSize.sm, 
    fontWeight: '500',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 2,
  },
  loanActionTextDark: { 
    color: '#FFFFFF',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 2,
  },
  loanActionTextPrimary: { color: '#FFFFFF' },

  // Premium banking styles
  premiumCard: { backgroundColor: '#1F2937', borderColor: '#FFD700', borderWidth: 1 },
  premiumHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: responsiveSpacing.sm, gap: responsiveSpacing.sm },
  premiumTitle: { color: '#FFD700', fontSize: responsiveFontSize.base, fontWeight: '600' },
  premiumText: { color: '#D1D5DB', fontSize: responsiveFontSize.sm },

  // Interest card styles
  interestCard: { backgroundColor: '#F0FDF4', borderColor: '#34D399', borderWidth: 1 },
  interestCardDark: { backgroundColor: '#064E3B' },
  interestHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: responsiveSpacing.md, gap: responsiveSpacing.sm },
  interestTitle: { color: '#065F46', fontSize: responsiveFontSize.base, fontWeight: '600' },
  interestTitleDark: { color: '#34D399' },
  interestDetails: { marginBottom: responsiveSpacing.sm },
  interestRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: responsiveSpacing.xs },
  interestLabel: { color: '#374151', fontSize: responsiveFontSize.sm },
  interestLabelDark: { color: '#D1D5DB' },
  interestValue: { color: '#059669', fontSize: responsiveFontSize.sm, fontWeight: '700' },
  interestEarnings: { color: '#10B981' },
  interestNote: { color: '#6B7280', fontSize: responsiveFontSize.xs, fontStyle: 'italic', marginTop: responsiveSpacing.xs },
  interestNoteDark: { color: '#9CA3AF' },

  // Services styles
  servicesDescription: { 
    color: '#9CA3AF', 
    fontSize: responsiveFontSize.sm, 
    marginTop: responsiveSpacing.sm,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 2,
  },
  servicesDescriptionDark: { 
    color: '#FFFFFF',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 2,
  },
  serviceHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: responsiveSpacing.md },
  serviceIconContainer: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#1F2937', alignItems: 'center', justifyContent: 'center', marginRight: responsiveSpacing.md },
  serviceImage: { width: 32, height: 32, resizeMode: 'contain' },
  serviceInfo: { flex: 1 },
  serviceName: { color: '#FFFFFF', fontSize: responsiveFontSize.base, fontWeight: '600', marginBottom: responsiveSpacing.xs },
  servicePrice: { color: '#10B981', fontSize: responsiveFontSize.base, fontWeight: '600' },
  servicePriceDark: { color: '#FFFFFF', fontSize: responsiveFontSize.base, fontWeight: '600' },
  serviceStatus: { alignItems: 'flex-end' },
  activeBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#10B981', paddingHorizontal: responsiveSpacing.sm, paddingVertical: responsiveSpacing.xs, borderRadius: responsiveBorderRadius.md, gap: responsiveSpacing.xs },
  activeText: { color: '#FFFFFF', fontSize: responsiveFontSize.sm, fontWeight: '500' },
  purchaseButton: { backgroundColor: '#3B82F6', paddingHorizontal: responsiveSpacing.md, paddingVertical: responsiveSpacing.sm, borderRadius: responsiveBorderRadius.md },
  purchaseButtonText: { color: '#FFFFFF', fontSize: responsiveFontSize.sm, fontWeight: '500' },
  serviceDescription: { 
    color: '#9CA3AF', 
    fontSize: responsiveFontSize.sm, 
    lineHeight: 20,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 2,
  },
  serviceDescriptionDark: { 
    color: '#FFFFFF',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 2,
  },

  // Modal styles
  modalActions: { flexDirection: 'row', gap: responsiveSpacing.md, marginTop: responsiveSpacing.lg },
  modalBtnSecondary: { flex: 1, paddingVertical: responsiveSpacing.md, paddingHorizontal: responsiveSpacing.lg, borderRadius: responsiveBorderRadius.md, borderWidth: 1, borderColor: '#374151', alignItems: 'center' },
  modalBtnSecondaryText: { 
    color: '#9CA3AF', 
    fontSize: responsiveFontSize.base, 
    fontWeight: '500',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 2,
  },
  modalBtnSecondaryTextDark: { 
    color: '#FFFFFF',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 2,
  },
  featuresList: { marginVertical: responsiveSpacing.md },
  featureItem: { flexDirection: 'row', alignItems: 'center', marginBottom: responsiveSpacing.sm, gap: responsiveSpacing.sm },
  featureText: { color: '#D1D5DB', fontSize: responsiveFontSize.sm, flex: 1 },

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

  // IAP Error Styles
  errorCard: {
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderColor: '#F59E0B',
    borderWidth: 1,
  },
  errorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: responsiveSpacing.sm,
    gap: responsiveSpacing.sm,
  },
  errorTitle: {
    fontSize: responsiveFontSize.base,
    fontWeight: '600',
    color: '#F59E0B',
  },
  errorTitleDark: {
    color: '#F59E0B',
  },
  errorMessage: {
    fontSize: responsiveFontSize.sm,
    color: '#374151',
    lineHeight: 20,
    marginBottom: responsiveSpacing.sm,
  },
  errorMessageDark: {
    color: '#D1D5DB',
  },
  errorSubtext: {
    fontSize: responsiveFontSize.xs,
    color: '#6B7280',
    fontStyle: 'italic',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 2,
  },
  errorSubtextDark: {
    color: '#FFFFFF',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 2,
  },
});
