import React, { useState, useCallback, useMemo } from 'react';
import { View,
  Text,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  ScrollView } from 'react-native';
import LinearGradientFallback from '@/components/fallbacks/LinearGradientFallback';
import { useGame, Loan } from '@/contexts/GameContext';
import { safeSettings, safeStats } from '@/utils/safeGameState';
import { useFeedback } from '@/utils/feedbackSystem';
import { WEEKS_PER_YEAR } from '@/lib/config/gameConstants';
import { styles } from '@/components/LoanManagerStyles';
import { formatMoney } from '@/utils/moneyFormatting';
import {
  CreditCard,
  TrendingUp,
  X,
  CheckCircle,
  AlertCircle,
  PiggyBank,
  Car,
} from 'lucide-react-native';
const LinearGradient = LinearGradientFallback;


const LOAN_TYPES = [
  { id: 'personal', name: 'Personal Loan', icon: CreditCard, color: '#3B82F6', maxTerm: 64, minAmount: 1000 },
  { id: 'business', name: 'Business Loan', icon: TrendingUp, color: '#10B981', maxTerm: 104, minAmount: 5000 },
  { id: 'mortgage', name: 'Mortgage', icon: PiggyBank, color: '#8B5CF6', maxTerm: 520, minAmount: 50000 },
  { id: 'auto', name: 'Auto Loan', icon: Car, color: '#F59E0B', maxTerm: 156, minAmount: 10000 },
];

const TERM_OPTIONS = [32, 64, 104, 156, 260, 520] as const;
const MAX_DEBT_TO_INCOME_RATIO = 0.4; // 40% of monthly income
const EARLY_PAYOFF_DISCOUNT = 0.05; // 5% discount for early payoff

function LoanManager() {
  const { gameState, setGameState, saveGame } = useGame();
  // R2-A: settings can be undefined during migration — guard.
  const { buttonPress, haptic, success } = useFeedback(safeSettings(gameState).hapticFeedback);
  const [showLoanModal, setShowLoanModal] = useState(false);
  const [showLoanDetails, setShowLoanDetails] = useState(false);
  const [selectedLoan, setSelectedLoan] = useState<Loan | null>(null);
  const [loanAmount, setLoanAmount] = useState('');
  const [selectedTerm, setSelectedTerm] = useState(64);
  const [selectedType, setSelectedType] = useState<'personal' | 'business' | 'mortgage' | 'auto'>('personal');
  const [repayAmount, setRepayAmount] = useState('');
  const [repaySource, setRepaySource] = useState<'cash' | 'savings'>('cash');

  // Get loans from game state
  const loans = useMemo(() => gameState.loans || [], [gameState.loans]);
  // R2-A: stats can be undefined during a mid-migration render.
  const cash = safeStats(gameState).money;
  const savings = gameState.bankSavings || 0;
  const weeklyIncome = useMemo(() => {
    // Calculate weekly income from various sources
    let income = 0;
    
    // Add job income from careers
    (gameState.careers || []).forEach(career => {
      if (career.level > 0 && career.levels && career.levels[career.level - 1]) {
        income += career.levels[career.level - 1].salary || 0;
      }
    });
    
    // Add business income
    (gameState.companies || []).forEach(company => {
      income += company.weeklyIncome || 0;
    });
    
    // Add rental income
    (gameState.realEstate || []).forEach(property => {
      if (property.owned) {
        income += property.rent || 0;
      }
    });
    
    return income;
  }, [gameState.careers, gameState.companies, gameState.realEstate]);

  // Calculate market APR based on economic conditions
  const marketAPR = useMemo(() => {
    const baseAPR = 0.08; // 8% base APR
    const inflationRate = gameState.economy?.inflationRateAnnual || 0.02;
    const inflationFactor = inflationRate * 2; // Inflation affects rates
    const riskFactor = Math.min(0.05, loans.length * 0.01); // More loans = higher risk
    const incomeFactor = weeklyIncome > 10000 ? -0.02 : 0.02; // Higher income = lower rates
    
    // Get political perks if player has political career
    let politicalInterestReduction = 0;
    if (gameState.politics && gameState.politics.careerLevel > 0) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { getCombinedPerkEffects } = require('@/lib/politics/perks');
      const perkEffects = getCombinedPerkEffects(gameState.politics.careerLevel);
      politicalInterestReduction = perkEffects.loanInterestReduction / 100; // Convert percentage to decimal
    }
    
    const calculatedAPR = baseAPR + inflationFactor + riskFactor + incomeFactor;
    // Apply political perk reduction
    const finalAPR = Math.max(0.01, calculatedAPR - politicalInterestReduction);
    return Math.max(0.01, Math.min(0.25, finalAPR));
  }, [gameState.economy?.inflationRateAnnual, loans.length, weeklyIncome, gameState.politics]);

  // Calculate loan eligibility
  const loanEligibility = useMemo(() => {
    const totalDebt = loans.reduce((sum, loan) => sum + loan.remaining, 0);
    const maxDebt = weeklyIncome * WEEKS_PER_YEAR * MAX_DEBT_TO_INCOME_RATIO; // 40% of annual income
    const availableCredit = Math.max(0, maxDebt - totalDebt);
    const maxLoanAmount = Math.min(availableCredit, (cash + savings) * 2); // Max 2x liquid assets
    
    return {
      maxLoanAmount,
      availableCredit,
      debtToIncomeRatio: totalDebt / (weeklyIncome * WEEKS_PER_YEAR),
      canBorrow: availableCredit > 1000,
    };
  }, [loans, weeklyIncome, cash, savings]);

  // Calculate loan details
  const loanDetails = useMemo(() => {
    const amount = parseFloat(loanAmount) || 0;
    const weeklyRate = marketAPR / WEEKS_PER_YEAR;
    const totalPayments = selectedTerm;
    
    // BUG FIX: Calculate weekly payment using more stable formula for long terms
    // For very long terms (520 weeks), use alternative formula to avoid precision issues
    let weeklyPayment = 0;
    
    if (amount > 0 && totalPayments > 0) {
      if (weeklyRate <= 0 || totalPayments > 400) {
        // For very long terms or zero interest, use simple division
        // Minimum payment ensures debt is paid down
        weeklyPayment = Math.max(amount / totalPayments, amount * 0.001); // At least 0.1% of principal per week
      } else {
        // Standard amortization formula: A = P * r / (1 - (1 + r)^-n)
        // This formula is more stable for long terms
        const r = weeklyRate;
        const n = totalPayments;
        const denom = 1 - Math.pow(1 + r, -n);
        
        if (denom > 0.0001) { // Avoid division by very small numbers
          weeklyPayment = (amount * r) / denom;
        } else {
          // Fallback for very small denominators (very long terms)
          weeklyPayment = Math.max(amount / totalPayments, amount * 0.001);
        }
        
        // Ensure minimum payment to prevent zero debt issue
        weeklyPayment = Math.max(weeklyPayment, amount * 0.001); // At least 0.1% of principal per week
      }
    }
    
    const totalCost = weeklyPayment * totalPayments;
    const totalInterest = totalCost - amount;
    
    return {
      weeklyPayment: isFinite(weeklyPayment) && weeklyPayment > 0 ? weeklyPayment : Math.max(amount / totalPayments, amount * 0.001),
      totalCost: isFinite(totalCost) ? totalCost : amount,
      totalInterest: isFinite(totalInterest) ? totalInterest : 0,
      interestRate: marketAPR * 100,
    };
  }, [loanAmount, selectedTerm, marketAPR]);

  // ANTI-EXPLOIT: Maximum concurrent loans and cooldown between applications
  const MAX_CONCURRENT_LOANS = 5;
  const LOAN_COOLDOWN_WEEKS = 4; // Minimum 4 weeks between loan applications

  const takeLoan = useCallback(() => {
    buttonPress();
    haptic('light');

    const amount = parseFloat(loanAmount);

    // Validate amount is a valid number
    if (!amount || isNaN(amount) || !isFinite(amount) || amount < 1000) {
      Alert.alert('Invalid Amount', 'Please enter a valid loan amount of at least $1,000.');
      return;
    }

    if (amount > loanEligibility.maxLoanAmount) {
      Alert.alert('Loan Denied', `Maximum loan amount is ${formatMoney(loanEligibility.maxLoanAmount)}.`);
      return;
    }

    // ANTI-EXPLOIT: Check concurrent loan cap
    const activeLoans = (gameState.loans || []).filter(l => l.remaining > 0);
    if (activeLoans.length >= MAX_CONCURRENT_LOANS) {
      Alert.alert('Loan Denied', `You already have ${MAX_CONCURRENT_LOANS} active loans. Pay off existing loans before applying for new ones.`);
      return;
    }

    // ANTI-EXPLOIT: Check cooldown since last loan application
    const currentWeeksLived = gameState.weeksLived || 0;
    const lastLoanWeek = activeLoans.reduce((max, loan) => {
      const startWeek = typeof loan.startWeek === 'number' ? loan.startWeek : 0;
      return Math.max(max, startWeek);
    }, 0);
    if (activeLoans.length > 0 && lastLoanWeek > 0 && (currentWeeksLived - lastLoanWeek) < LOAN_COOLDOWN_WEEKS) {
      const weeksToWait = LOAN_COOLDOWN_WEEKS - (currentWeeksLived - lastLoanWeek);
      Alert.alert('Loan Denied', `You must wait ${weeksToWait} more week(s) before applying for another loan.`);
      return;
    }

    const newLoan: Loan = {
      id: `loan_${Date.now()}`,
      name: `${LOAN_TYPES.find(t => t.id === selectedType)?.name} - ${selectedTerm}w`,
      principal: amount,
      remaining: amount,
      rateAPR: marketAPR,
      termWeeks: selectedTerm,
      weeklyPayment: loanDetails.weeklyPayment,
      startWeek: gameState.weeksLived || 0, // ANTI-EXPLOIT: Use absolute week counter, not cyclic state.week
      autoPay: true,
      type: selectedType,
      weeksRemaining: selectedTerm,
      interestRate: marketAPR,
    };

    setGameState(prev => ({
      ...prev,
      stats: { ...prev.stats, money: prev.stats.money + amount },
      loans: [...(prev.loans || []), newLoan],
    }));

    saveGame();
    setShowLoanModal(false);
    setLoanAmount('');
    success('Loan approved and funds transferred!');
    Alert.alert('Loan Approved!', `You received ${formatMoney(amount)} at ${loanDetails.interestRate.toFixed(2)}% APR.`);
  }, [loanAmount, loanEligibility.maxLoanAmount, selectedType, selectedTerm, marketAPR, loanDetails, gameState.week, gameState.weeksLived, gameState.loans, setGameState, saveGame, buttonPress, haptic, success]);

  const repayLoan = useCallback((loanId: string, amount: number) => {
    buttonPress();
    haptic('light');
    
    const loan = loans.find(l => l.id === loanId);
    if (!loan) return;
    
    const repayAmount = Math.min(amount, loan.remaining);
    const discount = amount === loan.remaining ? EARLY_PAYOFF_DISCOUNT : 0;
    const finalAmount = repayAmount * (1 - discount);
    
    if (repaySource === 'cash' && cash < finalAmount) {
      Alert.alert('Insufficient Funds', 'Not enough cash for this payment.');
      return;
    }
    
    if (repaySource === 'savings' && savings < finalAmount) {
      Alert.alert('Insufficient Funds', 'Not enough savings for this payment.');
      return;
    }
    
    setGameState(prev => {
      const updatedLoans = (prev.loans || []).map((l: Loan) => 
        l.id === loanId 
          ? { ...l, remaining: Math.max(0, l.remaining - repayAmount) }
          : l
      ).filter((l: Loan) => l.remaining > 0);
      
      return {
        ...prev,
        stats: { 
          ...prev.stats, 
          money: repaySource === 'cash' ? prev.stats.money - finalAmount : prev.stats.money 
        },
        bankSavings: repaySource === 'savings' ? (prev.bankSavings || 0) - finalAmount : prev.bankSavings,
        loans: updatedLoans,
      };
    });
    
    saveGame();
    setRepayAmount('');
    success('Payment processed successfully!');
    Alert.alert('Payment Successful', `Paid ${formatMoney(finalAmount)}${discount > 0 ? ` (${(discount * 100).toFixed(1)}% early payoff discount)` : ''}.`);
  }, [loans, repaySource, cash, savings, setGameState, saveGame, buttonPress, haptic, success]);

  const getLoanTypeInfo = (type: string) => LOAN_TYPES.find(t => t.id === type) || LOAN_TYPES[0];

  const containerStyle = [styles.container, gameState.settings.darkMode && styles.containerDark];
  const titleStyle = [styles.title, gameState.settings.darkMode && styles.titleDark];
  const cardStyle = [styles.card, gameState.settings.darkMode && styles.cardDark];

  return (
    <View style={containerStyle}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <CreditCard size={24} color={gameState.settings.darkMode ? '#F9FAFB' : '#1E293B'} />
          <Text style={titleStyle}>Loan Manager</Text>
        </View>
        <TouchableOpacity
          style={[styles.newLoanButton, gameState.settings.darkMode && styles.newLoanButtonDark]}
          onPress={() => {
            buttonPress();
            setShowLoanModal(!showLoanModal);
          }}
        >
          <Text style={[styles.newLoanButtonText, gameState.settings.darkMode && styles.newLoanButtonTextDark]}>
            {showLoanModal ? 'Cancel' : 'New Loan'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Loan Summary */}
      <View style={cardStyle}>
        <View style={styles.summaryRow}>
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryLabel, gameState.settings.darkMode && styles.summaryLabelDark]}>
              Total Debt
            </Text>
            <Text style={[styles.summaryValue, gameState.settings.darkMode && styles.summaryValueDark]}>
              {formatMoney(loans.reduce((sum, loan) => sum + loan.remaining, 0))}
            </Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryLabel, gameState.settings.darkMode && styles.summaryLabelDark]}>
              Available Credit
            </Text>
            <Text style={[styles.summaryValue, gameState.settings.darkMode && styles.summaryValueDark]}>
              {formatMoney(loanEligibility.availableCredit)}
            </Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryLabel, gameState.settings.darkMode && styles.summaryLabelDark]}>
              Market APR
            </Text>
            <Text style={[styles.summaryValue, gameState.settings.darkMode && styles.summaryValueDark]}>
              {marketAPR.toFixed(1)}%
            </Text>
          </View>
        </View>
      </View>

      {/* New Loan Form - Inline */}
      {showLoanModal && (
        <View style={cardStyle}>
          <Text style={[styles.sectionTitle, gameState.settings.darkMode && styles.sectionTitleDark]}>
            Apply for New Loan
          </Text>

          {/* Loan Type Selection */}
          <Text style={[styles.inputLabel, gameState.settings.darkMode && styles.inputLabelDark]}>
            Loan Type
          </Text>
          <View style={styles.loanTypeGrid}>
            {LOAN_TYPES.map((type) => (
              <TouchableOpacity
                key={type.id}
                style={[
                  styles.loanTypeCard,
                  selectedType === type.id && styles.loanTypeCardSelected,
                  gameState.settings.darkMode && styles.loanTypeCardDark,
                ]}
                onPress={() => {
                  buttonPress();
                  setSelectedType(type.id as 'personal' | 'business' | 'mortgage' | 'auto');
                }}
              >
                <type.icon size={20} color={selectedType === type.id ? '#FFFFFF' : type.color} />
                <Text style={[
                  styles.loanTypeName,
                  selectedType === type.id && styles.loanTypeNameSelected,
                  gameState.settings.darkMode && styles.loanTypeNameDark,
                ]}>
                  {type.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Loan Amount */}
          <Text style={[styles.inputLabel, gameState.settings.darkMode && styles.inputLabelDark]}>
            Loan Amount
          </Text>
          <TextInput
            style={[styles.input, gameState.settings?.darkMode && styles.inputDark]}
            value={loanAmount}
            onChangeText={setLoanAmount}
            placeholder={`Max: ${formatMoney(loanEligibility.maxLoanAmount)}`}
            placeholderTextColor="#94A3B8"
            keyboardType="numeric"
            // R3-F: numeric inputs should never autocorrect.
            autoCorrect={false}
            autoCapitalize="none"
            spellCheck={false}
            returnKeyType="done"
          />

          {/* Term Selection */}
          <Text style={[styles.inputLabel, gameState.settings.darkMode && styles.inputLabelDark]}>
            Term Length
          </Text>
          <View style={styles.termGrid}>
            {TERM_OPTIONS.map((term) => (
              <TouchableOpacity
                key={term}
                style={[
                  styles.termButton,
                  selectedTerm === term && styles.termButtonSelected,
                  gameState.settings.darkMode && styles.termButtonDark,
                ]}
                onPress={() => {
                  buttonPress();
                  setSelectedTerm(term);
                }}
              >
                <Text style={[
                  styles.termText,
                  selectedTerm === term && styles.termTextSelected,
                  gameState.settings.darkMode && styles.termTextDark,
                ]}>
                  {term}w
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Loan Details */}
          {loanDetails.weeklyPayment > 0 && (
            <View style={[styles.loanDetails, gameState.settings.darkMode && styles.loanDetailsDark]}>
              <Text style={[styles.detailsTitle, gameState.settings.darkMode && styles.detailsTitleDark]}>
                Loan Details
              </Text>
              <View style={styles.detailsRow}>
                <Text style={[styles.detailsLabel, gameState.settings.darkMode && styles.detailsLabelDark]}>
                  Weekly Payment:
                </Text>
                <Text style={[styles.detailsValue, gameState.settings.darkMode && styles.detailsValueDark]}>
                  {formatMoney(loanDetails.weeklyPayment)}
                </Text>
              </View>
              <View style={styles.detailsRow}>
                <Text style={[styles.detailsLabel, gameState.settings.darkMode && styles.detailsLabelDark]}>
                  Total Interest:
                </Text>
                <Text style={[styles.detailsValue, gameState.settings.darkMode && styles.detailsValueDark]}>
                  {formatMoney(loanDetails.totalInterest)}
                </Text>
              </View>
              <View style={styles.detailsRow}>
                <Text style={[styles.detailsLabel, gameState.settings.darkMode && styles.detailsLabelDark]}>
                  Total Cost:
                </Text>
                <Text style={[styles.detailsValue, gameState.settings.darkMode && styles.detailsValueDark]}>
                  {formatMoney(loanDetails.totalCost)}
                </Text>
              </View>
            </View>
          )}

          {/* Eligibility Warning */}
          {!loanEligibility.canBorrow && (
            <View style={styles.warningBox}>
              <AlertCircle size={20} color="#EF4444" />
              <Text style={styles.warningText}>
                You may not qualify for additional loans. Consider paying down existing debt first.
              </Text>
            </View>
          )}

          {/* Apply Button */}
          <TouchableOpacity
            style={[styles.modalButton, styles.modalButtonPrimary]}
            onPress={takeLoan}
            disabled={!loanEligibility.canBorrow || !loanAmount}
          >
            <LinearGradient
              colors={['#3B82F6', '#1D4ED8']}
              style={styles.modalButtonGradient}
            >
              <Text style={styles.modalButtonTextPrimary}>Apply for Loan</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      )}

      {/* Active Loans */}
      {loans.length > 0 ? (
        <View style={cardStyle}>
          <Text style={[styles.sectionTitle, gameState.settings.darkMode && styles.sectionTitleDark]}>
            Active Loans ({loans.length})
          </Text>
          {loans.map((loan) => {
            const typeInfo = getLoanTypeInfo(loan.type);
            const progress = 1 - (loan.remaining / loan.principal);
            
            return (
              <TouchableOpacity
                key={loan.id}
                style={[styles.loanItem, gameState.settings.darkMode && styles.loanItemDark]}
                onPress={() => {
                  buttonPress();
                  setSelectedLoan(loan);
                  setShowLoanDetails(true);
                }}
              >
                <View style={styles.loanHeader}>
                  <View style={styles.loanTypeInfo}>
                    <View style={[styles.loanTypeIcon, { backgroundColor: typeInfo.color }]}>
                      <typeInfo.icon size={16} color="#FFFFFF" />
                    </View>
                    <View>
                      <Text style={[styles.loanName, gameState.settings.darkMode && styles.loanNameDark]}>
                        {loan.name}
                      </Text>
                      <Text style={[styles.loanMeta, gameState.settings.darkMode && styles.loanMetaDark]}>
                        {loan.rateAPR.toFixed(1)}% APR • {loan.termWeeks}w term
                      </Text>
                    </View>
                  </View>
                  <Text style={[styles.loanAmount, gameState.settings.darkMode && styles.loanAmountDark]}>
                    {formatMoney(loan.remaining)}
                  </Text>
                </View>
                
                <View style={styles.loanProgress}>
                  <View style={[styles.progressBar, gameState.settings.darkMode && styles.progressBarDark]}>
                    <View 
                      style={[
                        styles.progressFill, 
                        { width: `${progress * 100}%`, backgroundColor: typeInfo.color }
                      ]} 
                    />
                  </View>
                  <Text style={[styles.progressText, gameState.settings.darkMode && styles.progressTextDark]}>
                    {Math.round(progress * 100)}% paid
                  </Text>
                </View>
                
                <View style={styles.loanPayment}>
                  <Text style={[styles.paymentLabel, gameState.settings.darkMode && styles.paymentLabelDark]}>
                    Weekly Payment: {formatMoney(loan.weeklyPayment)} (Auto-paid)
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      ) : (
        <View style={cardStyle}>
          <View style={styles.emptyState}>
            <CreditCard size={48} color="#94A3B8" />
            <Text style={[styles.emptyStateTitle, gameState.settings.darkMode && styles.emptyStateTitleDark]}>
              No Active Loans
            </Text>
            <Text style={[styles.emptyStateText, gameState.settings.darkMode && styles.emptyStateTextDark]}>
              Apply for a loan to access funds for investments, purchases, or emergencies.
            </Text>
          </View>
        </View>
      )}


      {/* Loan Details Modal */}
      <Modal visible={showLoanDetails} transparent animationType="slide" onRequestClose={() => setShowLoanDetails(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalContent, gameState.settings.darkMode && styles.modalContentDark]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, gameState.settings.darkMode && styles.modalTitleDark]}>
                Loan Details
              </Text>
              <TouchableOpacity onPress={() => setShowLoanDetails(false)}>
                <X size={24} color={gameState.settings.darkMode ? '#F9FAFB' : '#1E293B'} />
              </TouchableOpacity>
            </View>

            {selectedLoan && (
              <ScrollView style={styles.modalBody}>
                <View style={[styles.loanDetails, gameState.settings.darkMode && styles.loanDetailsDark]}>
                  <View style={styles.detailsRow}>
                    <Text style={[styles.detailsLabel, gameState.settings.darkMode && styles.detailsLabelDark]}>
                      Remaining Balance:
                    </Text>
                    <Text style={[styles.detailsValue, gameState.settings.darkMode && styles.detailsValueDark]}>
                      {formatMoney(selectedLoan.remaining)}
                    </Text>
                  </View>
                  <View style={styles.detailsRow}>
                    <Text style={[styles.detailsLabel, gameState.settings.darkMode && styles.detailsLabelDark]}>
                      Weekly Payment:
                    </Text>
                    <Text style={[styles.detailsValue, gameState.settings.darkMode && styles.detailsValueDark]}>
                      {formatMoney(selectedLoan.weeklyPayment)}
                    </Text>
                  </View>
                  <View style={styles.detailsRow}>
                    <Text style={[styles.detailsLabel, gameState.settings.darkMode && styles.detailsLabelDark]}>
                      Interest Rate:
                    </Text>
                    <Text style={[styles.detailsValue, gameState.settings.darkMode && styles.detailsValueDark]}>
                      {selectedLoan.rateAPR.toFixed(2)}% APR
                    </Text>
                  </View>
                </View>

                {/* Automatic Payment Notice */}
                <View style={[styles.autoPaymentNotice, gameState.settings.darkMode && styles.autoPaymentNoticeDark]}>
                  <CheckCircle size={20} color="#10B981" />
                  <Text style={[styles.autoPaymentText, gameState.settings.darkMode && styles.autoPaymentTextDark]}>
                    Automatic payments are enabled - ${formatMoney(selectedLoan.weeklyPayment)} is deducted from your cash each week
                  </Text>
                </View>

                {/* Optional Manual Repayment Options */}
                <Text style={[styles.inputLabel, gameState.settings.darkMode && styles.inputLabelDark]}>
                  Make Extra Payment (Optional)
                </Text>
                
                <View style={styles.repaySourceRow}>
                  <TouchableOpacity
                    style={[
                      styles.repaySourceButton,
                      repaySource === 'cash' && styles.repaySourceButtonSelected,
                      gameState.settings.darkMode && styles.repaySourceButtonDark,
                    ]}
                    onPress={() => {
                      buttonPress();
                      setRepaySource('cash');
                    }}
                  >
                    <Text style={[
                      styles.repaySourceText,
                      repaySource === 'cash' && styles.repaySourceTextSelected,
                      gameState.settings.darkMode && styles.repaySourceTextDark,
                    ]}>
                      From Cash
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.repaySourceButton,
                      repaySource === 'savings' && styles.repaySourceButtonSelected,
                      gameState.settings.darkMode && styles.repaySourceButtonDark,
                    ]}
                    onPress={() => {
                      buttonPress();
                      setRepaySource('savings');
                    }}
                  >
                    <Text style={[
                      styles.repaySourceText,
                      repaySource === 'savings' && styles.repaySourceTextSelected,
                      gameState.settings.darkMode && styles.repaySourceTextDark,
                    ]}>
                      From Savings
                    </Text>
                  </TouchableOpacity>
                </View>

                <TextInput
                  style={[styles.input, gameState.settings?.darkMode && styles.inputDark]}
                  value={repayAmount}
                  onChangeText={setRepayAmount}
                  placeholder="Enter amount to pay"
                  placeholderTextColor="#94A3B8"
                  keyboardType="numeric"
                  autoCorrect={false}
                  autoCapitalize="none"
                  spellCheck={false}
                  returnKeyType="done"
                />

                <View style={styles.quickPayButtons}>
                  <TouchableOpacity
                    style={[styles.quickPayButton, gameState.settings.darkMode && styles.quickPayButtonDark]}
                    onPress={() => {
                      buttonPress();
                      setRepayAmount((selectedLoan.weeklyPayment).toString());
                    }}
                  >
                    <Text style={[styles.quickPayText, gameState.settings.darkMode && styles.quickPayTextDark]}>
                      Weekly Payment
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.quickPayButton, gameState.settings.darkMode && styles.quickPayButtonDark]}
                    onPress={() => {
                      buttonPress();
                      setRepayAmount((selectedLoan.remaining * 0.25).toString());
                    }}
                  >
                    <Text style={[styles.quickPayText, gameState.settings.darkMode && styles.quickPayTextDark]}>
                      25%
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.quickPayButton, gameState.settings.darkMode && styles.quickPayButtonDark]}
                    onPress={() => {
                      buttonPress();
                      setRepayAmount(selectedLoan.remaining.toString());
                    }}
                  >
                    <Text style={[styles.quickPayText, gameState.settings.darkMode && styles.quickPayTextDark]}>
                      Pay Off
                    </Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            )}

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonSecondary]}
                onPress={() => setShowLoanDetails(false)}
              >
                <Text style={styles.modalButtonTextSecondary}>Close</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonPrimary]}
                onPress={() => {
                  const amount = parseFloat(repayAmount);
                  if (amount > 0 && !isNaN(amount) && isFinite(amount)) {
                    repayLoan(selectedLoan!.id, amount);
                    setShowLoanDetails(false);
                  } else {
                    Alert.alert('Invalid Amount', 'Please enter a valid repayment amount.');
                  }
                }}
                disabled={!repayAmount || parseFloat(repayAmount) <= 0 || isNaN(parseFloat(repayAmount))}
              >
                <LinearGradient
                  colors={['#10B981', '#059669']}
                  style={styles.modalButtonGradient}
                >
                  <Text style={styles.modalButtonTextPrimary}>Make Payment</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}


export default React.memo(LoanManager);

