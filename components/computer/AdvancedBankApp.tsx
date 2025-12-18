import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
  TextInput,
  Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { 
  ArrowLeft, 
  CreditCard, 
  TrendingUp, 
  DollarSign, 
  PiggyBank, 
  Shield, 
  Calculator,
  BarChart3,
  Wallet,
  Building,
  Users,
  Settings,
  X,
  Check,
  AlertCircle,
  Crown,
  Star
} from 'lucide-react-native';
import { useGame } from '@/contexts/GameContext';
import { Loan, RealEstate } from '@/contexts/game/types';
import { 
  responsivePadding, 
  responsiveFontSize, 
  responsiveSpacing, 
  responsiveBorderRadius,
  responsiveIconSize 
} from '@/utils/scaling';
import { iapService } from '@/services/IAPService';
import { IAP_PRODUCTS, getProductConfig } from '@/utils/iapConfig';
import { logger } from '@/utils/logger';
import { validateMoney } from '@/utils/validation';

interface AdvancedBankAppProps {
  onBack: () => void;
}

export default function AdvancedBankApp({ onBack }: AdvancedBankAppProps) {
  const { gameState, setGameState, buyGoldUpgrade, saveGame } = useGame();
  const { settings } = gameState;
  const [activeTab, setActiveTab] = useState('overview');
  const [showSettings, setShowSettings] = useState(false);
  const [showCreditCardModal, setShowCreditCardModal] = useState(false);
  const [showFinancialPlanningModal, setShowFinancialPlanningModal] = useState(false);
  const [showBusinessBankingModal, setShowBusinessBankingModal] = useState(false);
  const [showPrivateBankingModal, setShowPrivateBankingModal] = useState(false);
  const [showIAPModal, setShowIAPModal] = useState(false);
  const [currentIAP, setCurrentIAP] = useState('');
  const [showNewLoanModal, setShowNewLoanModal] = useState(false);
  const [showLoanDetailsModal, setShowLoanDetailsModal] = useState(false);
  const [selectedLoan, setSelectedLoan] = useState<Loan | null>(null);
  const [newLoanAmount, setNewLoanAmount] = useState('');
  const [newLoanTerm, setNewLoanTerm] = useState(64);
  const [newLoanType, setNewLoanType] = useState<'personal' | 'business'>('personal');
  const [repayAmount, setRepayAmount] = useState('');
  const [repaySource, setRepaySource] = useState<'cash' | 'savings'>('cash');
  const [loanAmountError, setLoanAmountError] = useState<string | undefined>();
  const [repayAmountError, setRepayAmountError] = useState<string | undefined>();
  const [savingsAmountError, setSavingsAmountError] = useState<string | undefined>();
  
  // Savings state
  const [savingsAmount, setSavingsAmount] = useState('');

  const money = gameState.stats.money || 0;
  const bankSavings = (gameState.bankSavings !== undefined && gameState.bankSavings !== null) ? gameState.bankSavings : 0;
  const creditScore = 750; // Simulated credit score
  const monthlyIncome = 5000; // Simulated monthly income

  // Banking state - these would be saved in game state in real implementation
  const [cashbackEarned, setCashbackEarned] = useState(0);
  
  // Use IAP service to check service status
  const hasCreditCard = iapService.hasPurchased(IAP_PRODUCTS.PREMIUM_CREDIT_CARD);
  const hasFinancialPlanning = iapService.hasPurchased(IAP_PRODUCTS.FINANCIAL_PLANNING);
  const hasBusinessAccount = iapService.hasPurchased(IAP_PRODUCTS.BUSINESS_BANKING);
  const hasPrivateBanking = iapService.hasPurchased(IAP_PRODUCTS.PRIVATE_BANKING);

  // Extract frequently used values
  const companies = gameState.companies || [];
  const loans = gameState.loans || [];
  const inflation = gameState.inflation || 0.02;
  const realEstate = gameState.realEstate || [];
  const stocksOwned = gameState.stocksOwned || {};
  const relationships = gameState.relationships || [];
  const hobbies = gameState.hobbies || [];
  const currentJob = gameState.currentJob;
  const careers = gameState.careers || [];
  
  // Check if user owns companies - memoized
  const hasCompanies = useMemo(() => companies.length > 0, [companies]);
  
  // Savings functions - memoized
  const handleSavingsAction = useCallback((action: 'deposit' | 'withdraw') => {
    const amount = parseFloat(savingsAmount);
    if (!amount || amount <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid amount greater than 0.');
      return;
    }

    if (action === 'deposit') {
      if (amount > money) {
        Alert.alert('Insufficient Funds', 'You don\'t have enough cash to deposit this amount.');
        return;
      }
      setGameState(prev => ({
        ...prev,
        stats: { ...prev.stats, money: prev.stats.money - amount },
        bankSavings: (prev.bankSavings || 0) + amount,
      }));
      saveGame();
      Alert.alert('Deposit Successful', `Successfully deposited ${formatMoney(amount)} to savings.`);
    } else {
      if (amount > bankSavings) {
        Alert.alert('Insufficient Funds', 'You don\'t have enough savings to withdraw this amount.');
        return;
      }
      setGameState(prev => ({
        ...prev,
        stats: { ...prev.stats, money: prev.stats.money + amount },
        bankSavings: (prev.bankSavings || 0) - amount,
      }));
      saveGame();
      Alert.alert('Withdrawal Successful', `Successfully withdrew ${formatMoney(amount)} from savings.`);
    }
    
    setSavingsAmount('');
  }, [savingsAmount, money, bankSavings, setGameState, saveGame]);

  const handleIAP = useCallback(async (serviceId: string) => {
    try {
      const result = await iapService.purchaseProduct(serviceId);
      if (result.success) {
        const config = getProductConfig(serviceId);
        Alert.alert('Purchase Successful!', `${config?.name || 'Service'} has been activated!`);
      } else {
        Alert.alert('Purchase Failed', result.message);
      }
    } catch (error) {
      Alert.alert('Purchase Error', 'Failed to complete purchase. Please try again.');
    }
  }, []);

  const handleCreditCard = useCallback(() => {
    if (!hasCreditCard) {
      handleIAP(IAP_PRODUCTS.PREMIUM_CREDIT_CARD);
    } else {
      Alert.alert('Premium Credit Card', `You have 10% cashback! Total earned: ${formatMoney(cashbackEarned)}`);
    }
  }, [hasCreditCard, cashbackEarned, handleIAP]);

  const handleFinancialPlanning = useCallback(() => {
    if (!hasFinancialPlanning) {
      handleIAP(IAP_PRODUCTS.FINANCIAL_PLANNING);
    } else {
      Alert.alert('Financial Planning', 'Your bank savings earn 15% interest! Expert advice included.');
    }
  }, [hasFinancialPlanning, handleIAP]);

  const handleBusinessBanking = useCallback(() => {
    if (!hasBusinessAccount) {
      handleIAP(IAP_PRODUCTS.BUSINESS_BANKING);
    } else if (!hasCompanies) {
      Alert.alert('No Companies', 'You need to own companies to use Business Banking services.');
    } else {
      setShowBusinessBankingModal(true);
    }
  }, [hasBusinessAccount, hasCompanies, handleIAP]);

  const handlePrivateBanking = useCallback(() => {
    if (!hasPrivateBanking) {
      handleIAP(IAP_PRODUCTS.PRIVATE_BANKING);
    } else {
      Alert.alert('Private Banking', 'VIP services active! You have access to 3% APR loans up to $200,000.');
    }
  }, [hasPrivateBanking, handleIAP]);

  const confirmIAP = () => {
    let serviceId = '';
    switch (currentIAP) {
      case 'creditCard':
        serviceId = IAP_PRODUCTS.PREMIUM_CREDIT_CARD;
        break;
      case 'financialPlanning':
        serviceId = IAP_PRODUCTS.FINANCIAL_PLANNING;
        break;
      case 'privateBanking':
        serviceId = IAP_PRODUCTS.PRIVATE_BANKING;
        break;
      case 'businessBanking':
        serviceId = IAP_PRODUCTS.BUSINESS_BANKING;
        break;
      default:
        Alert.alert('Error', 'Invalid service selected');
        return;
    }
    handleIAP(serviceId);
    setShowIAPModal(false);
  };

  const handleCompanyLoan = useCallback((companyId: string, amount: number) => {
    setGameState(prev => ({
      ...prev,
      companies: prev.companies.map(company => 
        company.id === companyId 
          ? { ...company, money: (company.money || 0) + amount }
          : company
      )
    }));
    setShowBusinessBankingModal(false);
    Alert.alert('Company Loan Approved!', `Your company received ${formatMoney(amount)}`);
  }, [setGameState]);

  const handleCompanyUpgrade = useCallback((_companyId: string, _upgradeId: string) => {
    // This would trigger a real IAP in production
    Alert.alert('Company Upgrade', 'This would open the App Store for purchase in the real app.');
  }, []);

  // Calculate company value including upgrades - memoized
  const calculateCompanyValue = useCallback((company: { weeklyIncome: number; upgrades?: CompanyUpgrade[] }) => {
    // Base company value (weekly income × 10)
    const baseValue = company.weeklyIncome * 10;
    
    // Add value of all purchased upgrades
    let upgradeValue = 0;
    if (company.upgrades) {
      company.upgrades.forEach((upgrade) => {
        if (upgrade.level > 0) {
          upgradeValue += upgrade.cost || 0;
        }
      });
    }
    
    return baseValue + upgradeValue;
  }, []);
  
  const calculateMarketAPR = useCallback((loanType: 'personal' | 'business' = 'personal') => {
    // Get political perks if player has political career
    let politicalInterestReduction = 0;
    if (gameState.politics && gameState.politics.careerLevel > 0) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { getCombinedPerkEffects } = require('@/lib/politics/perks');
      const perkEffects = getCombinedPerkEffects(gameState.politics.careerLevel);
      politicalInterestReduction = perkEffects.loanInterestReduction / 100; // Convert percentage to decimal
    }

    if (loanType === 'business') {
      // Business loans have lower interest rates
      const baseAPR = 0.04; // 4% base APR for business loans
      const inflationFactor = inflation * 1.5;
      const riskFactor = Math.min(0.03, loans.length * 0.005);
      const companyValue = companies.reduce((sum, company) => sum + calculateCompanyValue(company), 0);
      const companyFactor = companyValue > 100000 ? -0.01 : 0.01;
      
      const calculatedAPR = baseAPR + inflationFactor + riskFactor + companyFactor;
      // Apply political perk reduction
      const finalAPR = Math.max(0.01, calculatedAPR - politicalInterestReduction);
      return Math.max(0.01, Math.min(0.15, finalAPR));
    } else {
      // Personal loans have higher interest rates
      const baseAPR = 0.08; // 8% base APR for personal loans
      const inflationFactor = inflation * 2;
      const riskFactor = Math.min(0.05, loans.length * 0.01);
      const incomeFactor = monthlyIncome > 10000 ? -0.02 : 0.02;
      
      const calculatedAPR = baseAPR + inflationFactor + riskFactor + incomeFactor;
      // Apply political perk reduction
      const finalAPR = Math.max(0.01, calculatedAPR - politicalInterestReduction);
      return Math.max(0.01, Math.min(0.25, finalAPR));
    }
  }, [inflation, loans, companies, monthlyIncome, calculateCompanyValue, gameState.politics]);

  const marketAPR = useMemo(() => calculateMarketAPR(), [calculateMarketAPR]);

  const calculateLoanDetails = useCallback((amount: number, term: number, loanType: 'personal' | 'business' = 'personal') => {
    const apr = calculateMarketAPR(loanType);
    const weeklyRate = apr / 52;
    const totalPayments = term;
    
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
      interestRate: apr * 100,
    };
  }, [calculateMarketAPR]);

  // Calculate total weekly cash flow (income - expenses)
  const calculateWeeklyCashFlow = () => {
    let totalIncome = 0;
    let totalExpenses = 0;

    // Job income
    const currentCareer = gameState.careers.find(c => c.id === gameState.currentJob);
    if (currentCareer) {
      totalIncome += currentCareer.levels[currentCareer.level].salary / 52; // Convert annual to weekly
    }

    // Company income
    gameState.companies.forEach(company => {
      totalIncome += company.weeklyIncome;
    });

    // Real estate income
    gameState.realEstate.forEach(property => {
      if (property.owned && property.rent) {
        totalIncome += property.rent;
        if (property.upkeep) {
          totalExpenses += property.upkeep;
        }
      }
    });

    // Hobby income (songs, art, sponsors)
    gameState.hobbies.forEach(hobby => {
      if (hobby.songs) {
        hobby.songs.forEach(song => totalIncome += song.weeklyIncome);
      }
      if (hobby.artworks) {
        hobby.artworks.forEach(art => totalIncome += art.weeklyIncome);
      }
      if (hobby.sponsors) {
        hobby.sponsors.forEach(sponsor => totalIncome += sponsor.weeklyPay);
      }
    });

    // Stock dividends
    const holdings = gameState.stocksOwned || {};
    for (const [stockId, shares] of Object.entries(holdings)) {
      // This would need stock info to calculate dividends properly
      // For now, we'll skip this as it requires additional stock data
    }

    // Partner income
    gameState.relationships.forEach(rel => {
      if (rel.income && (rel.type === 'partner' || rel.type === 'spouse') && rel.relationshipScore >= 50) {
        totalIncome += rel.income;
      }
    });

    // Existing loan payments
    const existingLoans = gameState.loans || [];
    existingLoans.forEach((loan: Loan) => {
      totalExpenses += loan.weeklyPayment || 0;
    });

    return totalIncome - totalExpenses;
  };

  const takeNewLoan = () => {
    logger.debug('takeNewLoan called', { 
      newLoanAmount, 
      newLoanType, 
      companiesLength: gameState.companies?.length,
      companyValues: gameState.companies?.map(c => ({ id: c.id, name: c.name, value: calculateCompanyValue(c) }))
    });
    const amount = parseFloat(newLoanAmount);
    
    if (!amount || amount < 1000) {
      Alert.alert('Invalid Amount', 'Minimum loan amount is $1,000.');
      return;
    }
    
    // Calculate net worth (cash + savings + real estate + company value)
    const realEstateValue = (gameState.realEstate || []).reduce((sum: number, property: RealEstate) => sum + (property.price || 0), 0);
    const companyValue = (gameState.companies || []).reduce((sum, company) => sum + calculateCompanyValue(company), 0);
    const netWorth = money + bankSavings + realEstateValue + companyValue;
    
    // Calculate weekly cash flow
    const weeklyCashFlow = calculateWeeklyCashFlow();
    
    // Business loan eligibility check
    if (newLoanType === 'business') {
      logger.debug('Business loan check:', {
        hasCompanies: !!gameState.companies,
        companiesLength: gameState.companies?.length,
        companyValue,
      });
      
      if (!gameState.companies || gameState.companies.length === 0 || companyValue <= 0) {
        Alert.alert('Business Loan Denied', 'You must own a company to apply for business loans.');
        return;
      }
    }
    
    // Personal loan eligibility check - must have positive cash flow
    if (newLoanType === 'personal') {
      if (weeklyCashFlow <= 0) {
        Alert.alert('Personal Loan Denied', 'You must have positive weekly cash flow to qualify for personal loans.');
        return;
      }
    }
    
    // Personal loan: Based on net worth and cash flow, Business loan: 50% of company value
    let maxLoanAmount: number;
    if (newLoanType === 'personal') {
      // Personal loan: 30% of net worth, but limited by ability to pay (25% of weekly cash flow for 2 years)
      const netWorthBased = netWorth * 0.3;
      const cashFlowBased = weeklyCashFlow * 0.25 * 104; // 25% of weekly cash flow for 2 years (104 weeks)
      maxLoanAmount = Math.min(netWorthBased, cashFlowBased);
    } else {
      // Business loan: 50% of company value
      maxLoanAmount = Math.min(100000, companyValue * 0.5);
    }
    
    if (amount > maxLoanAmount) {
      Alert.alert('Loan Denied', `Maximum loan amount is ${formatMoney(Math.round(maxLoanAmount))}.`);
      return;
    }
    
    const loanDetails = calculateLoanDetails(amount, newLoanType);
    const apr = calculateMarketAPR(newLoanType);
    
    const newLoan = {
      id: `loan_${Date.now()}`,
      name: `${newLoanType.charAt(0).toUpperCase() + newLoanType.slice(1)} Loan - ${newLoanTerm}w`,
      principal: amount,
      remaining: amount,
      rateAPR: apr,
      termWeeks: newLoanTerm,
      weeklyPayment: loanDetails.weeklyPayment,
      startWeek: gameState.week,
      autoPay: true,
      type: newLoanType,
      weeksRemaining: newLoanTerm,
      interestRate: apr,
    };
    
    setGameState(prev => ({
      ...prev,
      stats: { ...prev.stats, money: prev.stats.money + amount },
      loans: [...(prev.loans || []), newLoan],
    }));
    
    setShowNewLoanModal(false);
    setNewLoanAmount('');
    Alert.alert('Loan Approved!', `You received ${formatMoney(amount)} at ${loanDetails.interestRate.toFixed(2)}% APR.`);
  };

  const repayLoan = (loanId: string, amount: number) => {
    const loan = loans.find((l: Loan) => l.id === loanId);
    if (!loan) return;
    
    const repayAmount = Math.min(amount, loan.remaining);
    const discount = amount === loan.remaining ? 0.05 : 0; // 5% early payoff discount
    const finalAmount = repayAmount * (1 - discount);
    
    if (repaySource === 'cash' && money < finalAmount) {
      Alert.alert('Insufficient Funds', 'Not enough cash for this payment.');
      return;
    }
    
    if (repaySource === 'savings' && bankSavings < finalAmount) {
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
    
    // Save game after loan payment
    saveGame();
    
    setRepayAmount('');
    setShowLoanDetailsModal(false);
    Alert.alert('Payment Successful', `Paid ${formatMoney(finalAmount)}${discount > 0 ? ` (${(discount * 100).toFixed(1)}% early payoff discount)` : ''}.`);
  };

  const formatMoney = (amount: number) => {
    const a = Math.floor(Math.abs(amount) || 0);
    const sign = amount < 0 ? '-' : '';
    
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
    
    return `$${sign}${formatted}`;
  };

  const getLoanTypeInfo = (type: string) => {
    const types = {
      personal: { name: 'Personal Loan', color: '#3B82F6' },
      business: { name: 'Business Loan', color: '#10B981' },
    };
    return types[type as keyof typeof types] || types.personal;
  };

  const renderOverview = () => (
    <View style={styles.tabContent}>
      <View style={styles.balanceCard}>
        <LinearGradient colors={['#4F46E5', '#6366F1']} style={styles.balanceGradient}>
          <Text style={styles.balanceLabel}>Total Net Worth</Text>
          <Text style={styles.balanceAmount}>{formatMoney(money + bankSavings)}</Text>
        </LinearGradient>
      </View>

      <View style={styles.statsGrid}>
        <View style={styles.statCard}>
          <DollarSign size={24} color="#10B981" />
          <Text style={[styles.statLabel, settings?.darkMode && styles.statLabelDark]}>Cash</Text>
          <Text style={styles.statValue}>{formatMoney(money)}</Text>
        </View>
        <View style={styles.statCard}>
          <PiggyBank size={24} color="#3B82F6" />
          <Text style={styles.statLabel}>Savings</Text>
          <Text style={styles.statValue}>{formatMoney(bankSavings)}</Text>
        </View>
        <View style={styles.statCard}>
          <CreditCard size={24} color="#8B5CF6" />
          <Text style={styles.statLabel}>Active Loans</Text>
          <Text style={styles.statValue}>{formatMoney((gameState.loans || []).reduce((sum: number, loan: Loan) => sum + (loan.remaining || 0), 0))}</Text>
        </View>
        <View style={styles.statCard}>
          <Shield size={24} color="#F59E0B" />
          <Text style={styles.statLabel}>Credit Score</Text>
          <Text style={styles.statValue}>{creditScore}</Text>
        </View>
      </View>

      {/* Loan Application Section */}
      <View style={styles.loanManagementSection}>
        <Text style={styles.loanManagementTitle}>Apply for New Loan</Text>
        <View style={styles.loanManagementCard}>
          <View style={styles.loanManagementHeader}>
            <CreditCard size={24} color="#3B82F6" />
            <Text style={styles.loanManagementSubtitle}>Quick Loan Application</Text>
          </View>
          
          {/* Loan Type Selection */}
          <View style={styles.loanTypeSelection}>
            <Text style={styles.inputLabel}>Loan Type</Text>
            <View style={styles.loanTypeGrid}>
              {[
                { id: 'personal', name: 'Personal', icon: CreditCard, color: '#3B82F6' },
                { id: 'business', name: 'Business', icon: TrendingUp, color: '#10B981' },
              ].map((type) => (
                <TouchableOpacity
                  key={type.id}
                  style={[
                    styles.loanTypeCard,
                    newLoanType === type.id && styles.loanTypeCardSelected,
                  ]}
                  onPress={() => setNewLoanType(type.id as 'personal' | 'business')}
                >
                  <type.icon size={20} color={newLoanType === type.id ? '#FFFFFF' : type.color} />
                  <Text style={[
                    styles.loanTypeName,
                    newLoanType === type.id && styles.loanTypeNameSelected,
                  ]}>
                    {type.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Loan Amount */}
          <View style={styles.loanAmountSection}>
            <Text style={styles.inputLabel}>Loan Amount</Text>
            <TextInput
              style={[styles.loanAmountInput, loanAmountError && styles.inputError]}
              value={newLoanAmount}
              onChangeText={(text) => {
                setNewLoanAmount(text);
                if (text) {
                  const maxAmount = Math.min(100000, (money + bankSavings) * 2);
                  const validation = validateMoney(text, 1000, maxAmount);
                  if (!validation.valid) {
                    setLoanAmountError(validation.error);
                  } else {
                    setLoanAmountError(undefined);
                  }
                } else {
                  setLoanAmountError(undefined);
                }
              }}
              placeholder="Enter amount"
              placeholderTextColor={settings?.darkMode ? "#FFFFFF" : "#6B7280"}
              keyboardType="numeric"
            />
            {loanAmountError && (
              <Text style={styles.errorText}>{loanAmountError}</Text>
            )}
            <Text style={[styles.loanAmountHint, settings?.darkMode && styles.loanAmountHintDark]}>
              Max: {(() => {
                const maxAmount = Math.min(100000, (money + bankSavings) * 2);
                return formatMoney(Math.round(maxAmount));
              })()}
            </Text>
          </View>

          {/* Term Selection */}
          <View style={styles.termSelection}>
            <Text style={styles.inputLabel}>Term Length</Text>
            <View style={styles.termGrid}>
              {[32, 64, 104, 156, 260, 520].map((term) => (
                <TouchableOpacity
                  key={term}
                  style={[
                    styles.termButton,
                    newLoanTerm === term && styles.termButtonSelected,
                  ]}
                  onPress={() => setNewLoanTerm(term)}
                >
                  <Text style={[
                    styles.termText,
                    newLoanTerm === term && styles.termTextSelected,
                  ]}>
                    {term}w
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Loan Details Preview */}
          {newLoanAmount && parseFloat(newLoanAmount) > 0 && (() => {
            const amount = parseFloat(newLoanAmount);
            const details = calculateLoanDetails(amount, newLoanTerm, newLoanType);
            return (
              <View style={styles.loanDetailsPreview}>
                <Text style={styles.loanDetailsTitle}>Loan Preview</Text>
                <View style={styles.loanDetailsRow}>
                  <Text style={[styles.loanDetailsLabel, settings?.darkMode && styles.loanDetailsLabelDark]}>Weekly Payment:</Text>
                  <Text style={styles.loanDetailsValue}>{formatMoney(details.weeklyPayment)}</Text>
                </View>
                <View style={styles.loanDetailsRow}>
                  <Text style={styles.loanDetailsLabel}>Total Interest:</Text>
                  <Text style={styles.loanDetailsValue}>{formatMoney(details.totalInterest)}</Text>
                </View>
                <View style={styles.loanDetailsRow}>
                  <Text style={styles.loanDetailsLabel}>Total Cost:</Text>
                  <Text style={styles.loanDetailsValue}>{formatMoney(details.totalCost)}</Text>
                </View>
              </View>
            );
          })()}

          {/* Apply Button */}
          <TouchableOpacity 
            style={styles.loanManagementButton}
            onPress={takeNewLoan}
            disabled={!newLoanAmount || parseFloat(newLoanAmount) <= 0}
          >
            <LinearGradient colors={['#3B82F6', '#1D4ED8']} style={styles.loanManagementButtonGradient}>
              <Text style={styles.loanManagementButtonText}>Apply for Loan</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.servicesStatus}>
        <Text style={styles.servicesTitle}>Active Premium Services</Text>
        <View style={styles.serviceStatusGrid}>
          <View style={[styles.serviceStatusCard, hasCreditCard && styles.serviceActiveCard]}>
            <View style={[styles.serviceIconContainer, hasCreditCard && styles.serviceActiveIcon]}>
              <Image 
                source={require('@/assets/images/iap/banking/premium_credit_card.png')} 
                style={styles.serviceImage} 
              />
            </View>
            <View style={styles.serviceInfo}>
              <Text style={[styles.serviceStatusText, settings?.darkMode && styles.serviceStatusTextDark, hasCreditCard && styles.serviceActiveText]}>
                Premium Credit Card
              </Text>
              {hasCreditCard ? (
                <Text style={styles.serviceBenefit}>10% Cashback Active</Text>
              ) : (
                <Text style={[styles.serviceInactive, settings?.darkMode && styles.serviceInactiveDark]}>$4.99 to unlock</Text>
              )}
            </View>
            {hasCreditCard && <View style={styles.activeIndicator} />}
          </View>
          
          <View style={[styles.serviceStatusCard, hasFinancialPlanning && styles.serviceActiveCard]}>
            <View style={[styles.serviceIconContainer, hasFinancialPlanning && styles.serviceActiveIcon]}>
              <Image 
                source={require('@/assets/images/iap/banking/financial_planning.png')} 
                style={styles.serviceImage} 
              />
            </View>
            <View style={styles.serviceInfo}>
              <Text style={[styles.serviceStatusText, settings?.darkMode && styles.serviceStatusTextDark, hasFinancialPlanning && styles.serviceActiveText]}>
                Financial Planning
              </Text>
              {hasFinancialPlanning ? (
                <Text style={styles.serviceBenefit}>15% Interest Active</Text>
              ) : (
                <Text style={[styles.serviceInactive, settings?.darkMode && styles.serviceInactiveDark]}>$2.99 to unlock</Text>
              )}
            </View>
            {hasFinancialPlanning && <View style={styles.activeIndicator} />}
          </View>
          
          <View style={[styles.serviceStatusCard, hasPrivateBanking && styles.serviceActiveCard]}>
            <View style={[styles.serviceIconContainer, hasPrivateBanking && styles.serviceActiveIcon]}>
              <Image 
                source={require('@/assets/images/iap/banking/private_banking.png')} 
                style={styles.serviceImage} 
              />
            </View>
            <View style={styles.serviceInfo}>
              <Text style={[styles.serviceStatusText, settings?.darkMode && styles.serviceStatusTextDark, hasPrivateBanking && styles.serviceActiveText]}>
                Private Banking
              </Text>
              {hasPrivateBanking ? (
                <Text style={styles.serviceBenefit}>3% APR Active</Text>
              ) : (
                <Text style={[styles.serviceInactive, settings?.darkMode && styles.serviceInactiveDark]}>$9.99 to unlock</Text>
              )}
            </View>
            {hasPrivateBanking && <View style={styles.activeIndicator} />}
          </View>
          
          <View style={[styles.serviceStatusCard, hasBusinessAccount && styles.serviceActiveCard]}>
            <View style={[styles.serviceIconContainer, hasBusinessAccount && styles.serviceActiveIcon]}>
              <Image 
                source={require('@/assets/images/iap/banking/business_banking.png')} 
                style={styles.serviceImage} 
              />
            </View>
            <View style={styles.serviceInfo}>
              <Text style={[styles.serviceStatusText, hasBusinessAccount && styles.serviceActiveText]}>
                Business Banking
              </Text>
              {hasBusinessAccount ? (
                <Text style={styles.serviceBenefit}>Company Loans Active</Text>
              ) : (
                <Text style={[styles.serviceInactive, settings?.darkMode && styles.serviceInactiveDark]}>$3.99 to unlock</Text>
              )}
            </View>
            {hasBusinessAccount && <View style={styles.activeIndicator} />}
          </View>
        </View>
      </View>
    </View>
  );

  const renderServices = () => (
    <View style={styles.tabContent}>
      <View style={styles.servicesGrid}>

        <TouchableOpacity style={styles.serviceCard} onPress={handleCreditCard}>
          <LinearGradient colors={['#8B5CF6', '#A78BFA']} style={styles.serviceGradient}>
            <View style={styles.serviceIconContainer}>
              <Image 
                source={require('@/assets/images/iap/banking/premium_credit_card.png')} 
                style={styles.serviceImage} 
              />
            </View>
            <Text style={styles.serviceTitle}>Premium Credit Card</Text>
            <Text style={styles.serviceDesc}>10% cashback rewards</Text>
            <Text style={[styles.serviceStatus, !hasCreditCard && settings?.darkMode && styles.serviceStatusDark]}>{hasCreditCard ? 'Active' : '$4.99'}</Text>
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity style={styles.serviceCard} onPress={handleFinancialPlanning}>
          <LinearGradient colors={['#F59E0B', '#FBBF24']} style={styles.serviceGradient}>
            <View style={styles.serviceIconContainer}>
              <Image 
                source={require('@/assets/images/iap/banking/financial_planning.png')} 
                style={styles.serviceImage} 
              />
            </View>
            <Text style={styles.serviceTitle}>Financial Planning</Text>
            <Text style={styles.serviceDesc}>15% interest on savings</Text>
            <Text style={[styles.serviceStatus, !hasFinancialPlanning && settings?.darkMode && styles.serviceStatusDark]}>{hasFinancialPlanning ? 'Active' : '$2.99'}</Text>
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity style={styles.serviceCard} onPress={handleBusinessBanking}>
          <LinearGradient colors={['#EF4444', '#F87171']} style={styles.serviceGradient}>
            <View style={styles.serviceIconContainer}>
              <Image 
                source={require('@/assets/images/iap/banking/business_banking.png')} 
                style={styles.serviceImage} 
              />
            </View>
            <Text style={styles.serviceTitle}>Business Banking</Text>
            <Text style={styles.serviceDesc}>
              {hasCompanies ? 'Company loans & upgrades' : 'Need companies first'}
            </Text>
            <Text style={[styles.serviceStatus, settings?.darkMode && styles.serviceStatusDark]}>{hasBusinessAccount ? 'Active' : '$3.99'}</Text>
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity style={styles.serviceCard} onPress={handlePrivateBanking}>
          <LinearGradient colors={['#06B6D4', '#22D3EE']} style={styles.serviceGradient}>
            <View style={styles.serviceIconContainer}>
              <Image 
                source={require('@/assets/images/iap/banking/private_banking.png')} 
                style={styles.serviceImage} 
              />
            </View>
            <Text style={styles.serviceTitle}>Private Banking</Text>
            <Text style={styles.serviceDesc}>VIP 3% APR loans</Text>
            <Text style={[styles.serviceStatus, settings?.darkMode && styles.serviceStatusDark]}>{hasPrivateBanking ? 'Active' : '$9.99'}</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderAnalytics = () => (
    <View style={styles.tabContent}>
      <View style={styles.analyticsCard}>
        <Text style={styles.analyticsTitle}>Financial Health Score</Text>
        <View style={styles.scoreContainer}>
          <Text style={styles.scoreValue}>85/100</Text>
          <Text style={[styles.scoreLabel, settings?.darkMode && styles.scoreLabelDark]}>Excellent</Text>
        </View>
        <Text style={[styles.analyticsDesc, settings?.darkMode && styles.analyticsDescDark]}>
          Your financial health is excellent! You have good savings, 
          a high credit score, and diversified income sources.
        </Text>
      </View>

      <View style={styles.analyticsCard}>
        <Text style={styles.analyticsTitle}>Monthly Budget Analysis</Text>
        <View style={styles.budgetItem}>
          <Text style={[styles.budgetLabel, settings?.darkMode && styles.budgetLabelDark]}>Income</Text>
          <Text style={styles.budgetValue}>{formatMoney(monthlyIncome)}</Text>
        </View>
        <View style={styles.budgetItem}>
          <Text style={styles.budgetLabel}>Expenses</Text>
          <Text style={styles.budgetValue}>{formatMoney(monthlyIncome * 0.6)}</Text>
        </View>
        <View style={styles.budgetItem}>
          <Text style={styles.budgetLabel}>Savings Rate</Text>
          <Text style={styles.budgetValue}>40%</Text>
        </View>
      </View>

      <View style={styles.analyticsCard}>
        <Text style={styles.analyticsTitle}>Loan Portfolio</Text>
        <View style={styles.budgetItem}>
          <Text style={styles.budgetLabel}>Total Outstanding</Text>
          <Text style={styles.budgetValue}>{formatMoney((gameState.loans || []).reduce((sum: number, loan: Loan) => sum + (loan.remaining || 0), 0))}</Text>
        </View>
        <View style={styles.budgetItem}>
          <Text style={styles.budgetLabel}>Active Loans</Text>
          <Text style={styles.budgetValue}>{(gameState.loans || []).length}</Text>
        </View>
        <View style={styles.budgetItem}>
          <Text style={styles.budgetLabel}>Average APR</Text>
          <Text style={styles.budgetValue}>
            {(gameState.loans || []).length > 0 
              ? `${((gameState.loans || []).reduce((sum: number, loan: Loan) => sum + (loan.rateAPR || 0), 0) / (gameState.loans || []).length * 100).toFixed(1)}%`
              : '0%'
            }
          </Text>
        </View>
      </View>

      {hasCreditCard && (
        <View style={styles.analyticsCard}>
          <Text style={styles.analyticsTitle}>Credit Card Rewards</Text>
          <View style={styles.budgetItem}>
            <Text style={styles.budgetLabel}>Cashback Rate</Text>
            <Text style={styles.budgetValue}>10%</Text>
          </View>
          <View style={styles.budgetItem}>
            <Text style={styles.budgetLabel}>Total Earned</Text>
            <Text style={styles.budgetValue}>{formatMoney(cashbackEarned)}</Text>
          </View>
        </View>
      )}
    </View>
  );

  const renderSavings = () => (
    <View style={styles.tabContent}>
      <View style={styles.balanceCard}>
        <LinearGradient colors={['#059669', '#10B981']} style={styles.balanceGradient}>
          <Text style={styles.balanceLabel}>Savings Account</Text>
          <Text style={styles.balanceAmount}>{formatMoney(bankSavings)}</Text>
          <Text style={styles.balanceAmount}>Earning 15% APR</Text>
        </LinearGradient>
      </View>

      <View style={styles.savingsStats}>
        <View style={styles.statCard}>
          <PiggyBank size={24} color="#059669" />
          <Text style={styles.statLabel}>Weekly Interest</Text>
          <Text style={styles.statValue}>{formatMoney((bankSavings * 0.15) / 52)}</Text>
        </View>
        <View style={styles.statCard}>
          <Wallet size={24} color="#F59E0B" />
          <Text style={styles.statLabel}>Available Cash</Text>
          <Text style={styles.statValue}>{formatMoney(money)}</Text>
        </View>
      </View>

      {/* Deposit Section */}
      <View style={styles.savingsActionCard}>
        <View style={styles.savingsActionHeader}>
          <PiggyBank size={24} color="#2563EB" />
          <Text style={styles.savingsActionTitle}>Deposit to Savings</Text>
        </View>
        <Text style={styles.savingsActionDesc}>
          Transfer money from your cash to savings account
        </Text>
        
        <View style={styles.savingsInputGroup}>
          <Text style={styles.inputLabel}>Amount</Text>
          <TextInput
            style={styles.savingsInput}
            value={savingsAmount}
            onChangeText={setSavingsAmount}
            placeholder="Enter amount"
            placeholderTextColor="#6B7280"
            keyboardType="numeric"
          />
          <Text style={[styles.savingsInputHint, settings?.darkMode && styles.savingsInputHintDark]}>
            Available Cash: {formatMoney(money)}
          </Text>
        </View>

        <TouchableOpacity 
          style={styles.savingsActionButton}
          onPress={() => handleSavingsAction('deposit')}
          disabled={!savingsAmount || parseFloat(savingsAmount) <= 0}
        >
          <LinearGradient colors={['#2563EB', '#1D4ED8']} style={styles.savingsActionButtonGradient}>
            <Text style={styles.savingsActionButtonText}>Deposit</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {/* Withdraw Section */}
      <View style={styles.savingsActionCard}>
        <View style={styles.savingsActionHeader}>
          <Wallet size={24} color="#F59E0B" />
          <Text style={styles.savingsActionTitle}>Withdraw from Savings</Text>
        </View>
        <Text style={styles.savingsActionDesc}>
          Transfer money from your savings to cash account
        </Text>
        
        <View style={styles.savingsInputGroup}>
          <Text style={styles.inputLabel}>Amount</Text>
          <TextInput
            style={styles.savingsInput}
            value={savingsAmount}
            onChangeText={setSavingsAmount}
            placeholder="Enter amount"
            placeholderTextColor="#6B7280"
            keyboardType="numeric"
          />
          <Text style={[styles.savingsInputHint, settings?.darkMode && styles.savingsInputHintDark]}>
            Available Savings: {formatMoney(bankSavings)}
          </Text>
        </View>

        <TouchableOpacity 
          style={styles.savingsActionButton}
          onPress={() => handleSavingsAction('withdraw')}
          disabled={!savingsAmount || parseFloat(savingsAmount) <= 0}
        >
          <LinearGradient colors={['#F59E0B', '#D97706']} style={styles.savingsActionButtonGradient}>
            <Text style={styles.savingsActionButtonText}>Withdraw</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>

      <View style={styles.savingsInfo}>
        <Text style={styles.savingsInfoTitle}>Savings Benefits</Text>
        <View style={styles.benefitsList}>
          <View style={styles.benefitItem}>
            <Check size={16} color="#10B981" />
            <Text style={styles.benefitText}>15% Annual Interest Rate</Text>
          </View>
          <View style={styles.benefitItem}>
            <Check size={16} color="#10B981" />
            <Text style={styles.benefitText}>Weekly Compound Interest</Text>
          </View>
          <View style={styles.benefitItem}>
            <Check size={16} color="#10B981" />
            <Text style={styles.benefitText}>No Fees or Penalties</Text>
          </View>
          <View style={styles.benefitItem}>
            <Check size={16} color="#10B981" />
            <Text style={styles.benefitText}>FDIC Insured</Text>
          </View>
        </View>
      </View>
    </View>
  );

  const renderSettings = () => (
    <View style={styles.tabContent}>
      <View style={styles.settingsCard}>
        <Text style={styles.settingsTitle}>Account Settings</Text>
        
        <View style={styles.settingItem}>
          <Text style={[styles.settingLabel, settings?.darkMode && styles.settingLabelDark]}>Auto-Save</Text>
          <TouchableOpacity style={styles.toggleButton}>
            <Text style={styles.toggleText}>ON</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.settingItem}>
          <Text style={styles.settingLabel}>Notifications</Text>
          <TouchableOpacity style={styles.toggleButton}>
            <Text style={styles.toggleText}>ON</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.settingItem}>
          <Text style={styles.settingLabel}>Two-Factor Auth</Text>
          <TouchableOpacity style={styles.toggleButton}>
            <Text style={styles.toggleText}>ON</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.settingsCard}>
        <Text style={styles.settingsTitle}>Security</Text>
        
        <TouchableOpacity style={styles.settingButton}>
          <Text style={styles.settingButtonText}>Change Password</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.settingButton}>
          <Text style={styles.settingButtonText}>Update Security Questions</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.settingButton}>
          <Text style={styles.settingButtonText}>View Login History</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <ArrowLeft size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Advanced Banking</Text>
        <TouchableOpacity style={styles.settingsButton} onPress={() => setShowSettings(true)}>
          <Settings size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'overview' && styles.activeTab]} 
          onPress={() => setActiveTab('overview')}
        >
          <Wallet size={20} color={activeTab === 'overview' ? '#4F46E5' : (settings?.darkMode ? '#FFFFFF' : '#6B7280')} />
          <Text style={[styles.tabText, activeTab === 'overview' ? styles.activeTabText : (settings?.darkMode ? styles.tabTextDark : null)]}>Overview</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'services' && styles.activeTab]} 
          onPress={() => setActiveTab('services')}
        >
          <CreditCard size={20} color={activeTab === 'services' ? '#4F46E5' : (settings?.darkMode ? '#FFFFFF' : '#6B7280')} />
          <Text style={[styles.tabText, activeTab === 'services' ? styles.activeTabText : (settings?.darkMode ? styles.tabTextDark : null)]}>Services</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'analytics' && styles.activeTab]} 
          onPress={() => setActiveTab('analytics')}
        >
          <BarChart3 size={20} color={activeTab === 'analytics' ? '#4F46E5' : (settings?.darkMode ? '#FFFFFF' : '#6B7280')} />
          <Text style={[styles.tabText, activeTab === 'analytics' ? styles.activeTabText : (settings?.darkMode ? styles.tabTextDark : null)]}>Analytics</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'savings' && styles.activeTab]} 
          onPress={() => setActiveTab('savings')}
        >
          <PiggyBank size={20} color={activeTab === 'savings' ? '#4F46E5' : (settings?.darkMode ? '#FFFFFF' : '#6B7280')} />
          <Text style={[styles.tabText, activeTab === 'savings' ? styles.activeTabText : (settings?.darkMode ? styles.tabTextDark : null)]}>Savings</Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      <ScrollView 
        style={styles.content} 
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={true}
      >
        {activeTab === 'overview' && renderOverview()}
        {activeTab === 'services' && renderServices()}
        {activeTab === 'analytics' && renderAnalytics()}
        {activeTab === 'savings' && renderSavings()}
      </ScrollView>

      {/* Settings Modal */}
      <Modal visible={showSettings} animationType="slide" transparent={true} onRequestClose={() => setShowSettings(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Settings</Text>
              <TouchableOpacity onPress={() => setShowSettings(false)}>
                <X size={24} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
            {renderSettings()}
          </View>
        </View>
      </Modal>

      {/* IAP Modal */}
      <Modal visible={showIAPModal} animationType="slide" transparent={true} onRequestClose={() => setShowIAPModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Premium Service</Text>
              <TouchableOpacity onPress={() => setShowIAPModal(false)}>
                <X size={24} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
            <View style={styles.modalBody}>
              {currentIAP === 'creditCard' && (
                <>
                  <Text style={styles.modalText}>Premium Credit Card - $4.99</Text>
                  <View style={styles.featureList}>
                    <Text style={[styles.featureItem, settings?.darkMode && styles.featureItemDark]}>• 10% cashback on all purchases</Text>
                    <Text style={styles.featureItem}>• No annual fee</Text>
                    <Text style={styles.featureItem}>• Travel insurance</Text>
                    <Text style={styles.featureItem}>• 24/7 customer support</Text>
                  </View>
                </>
              )}
              {currentIAP === 'financialPlanning' && (
                <>
                  <Text style={styles.modalText}>Financial Planning - $2.99</Text>
                  <View style={styles.featureList}>
                    <Text style={styles.featureItem}>• 15% interest on bank savings</Text>
                    <Text style={styles.featureItem}>• Expert financial advice</Text>
                    <Text style={styles.featureItem}>• Investment portfolio optimization</Text>
                    <Text style={styles.featureItem}>• Monthly financial reports</Text>
                  </View>
                </>
              )}
              {currentIAP === 'privateBanking' && (
                <>
                  <Text style={styles.modalText}>Private Banking - $9.99</Text>
                  <View style={styles.featureList}>
                    <Text style={styles.featureItem}>• 3% APR loans (vs 5.5%)</Text>
                    <Text style={styles.featureItem}>• Up to $200,000 loan limit</Text>
                    <Text style={styles.featureItem}>• Personal wealth manager</Text>
                    <Text style={styles.featureItem}>• Priority customer support</Text>
                  </View>
                </>
              )}
              {currentIAP === 'businessBanking' && (
                <>
                  <Text style={styles.modalText}>Business Banking - $3.99</Text>
                  <View style={styles.featureList}>
                    <Text style={styles.featureItem}>• Company loans</Text>
                    <Text style={styles.featureItem}>• Business account management</Text>
                    <Text style={styles.featureItem}>• Company upgrade purchases</Text>
                    <Text style={styles.featureItem}>• Dedicated business advisor</Text>
                  </View>
                </>
              )}
              <TouchableOpacity style={styles.confirmButton} onPress={confirmIAP}>
                <Text style={styles.confirmButtonText}>Purchase</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>


      {/* Business Banking Modal */}
      <Modal visible={showBusinessBankingModal} animationType="slide" transparent={true} onRequestClose={() => setShowBusinessBankingModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Business Banking</Text>
              <TouchableOpacity onPress={() => setShowBusinessBankingModal(false)}>
                <X size={24} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
            <View style={styles.modalBody}>
              <Text style={styles.modalText}>Your Companies:</Text>
              {gameState.companies?.map(company => (
                <View key={company.id} style={styles.companySection}>
                  <Text style={styles.companyName}>{company.name}</Text>
                  <Text style={[styles.companyMoney, settings?.darkMode && styles.companyMoneyDark]}>Cash: {formatMoney(company.money || 0)}</Text>
                  
                  <Text style={[styles.sectionTitle, settings?.darkMode && styles.sectionTitleDark]}>Company Loans:</Text>
                  <View style={styles.loanOptions}>
                    <TouchableOpacity style={styles.loanOption} onPress={() => handleCompanyLoan(company.id, 10000)}>
                      <Text style={styles.loanAmount}>$10,000</Text>
                      <Text style={[styles.loanRate, settings?.darkMode && styles.loanRateDark]}>4% APR</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.loanOption} onPress={() => handleCompanyLoan(company.id, 25000)}>
                      <Text style={styles.loanAmount}>$25,000</Text>
                      <Text style={[styles.loanRate, settings?.darkMode && styles.loanRateDark]}>4% APR</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.loanOption} onPress={() => handleCompanyLoan(company.id, 50000)}>
                      <Text style={styles.loanAmount}>$50,000</Text>
                      <Text style={[styles.loanRate, settings?.darkMode && styles.loanRateDark]}>4% APR</Text>
                    </TouchableOpacity>
                  </View>

                  <Text style={styles.sectionTitle}>Company Upgrades (IAP):</Text>
                  {company.upgrades?.map(upgrade => (
                    <TouchableOpacity 
                      key={upgrade.id} 
                      style={styles.upgradeOption}
                      onPress={() => handleCompanyUpgrade(company.id, upgrade.id)}
                    >
                      <Text style={styles.upgradeName}>{upgrade.name}</Text>
                      <Text style={styles.upgradePrice}>$0.99</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ))}
            </View>
          </View>
        </View>
      </Modal>


      {/* New Loan Modal */}
      <Modal visible={showNewLoanModal} animationType="slide" transparent={true} onRequestClose={() => setShowNewLoanModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.loanManagerModalContent}>
            <View style={styles.loanManagerHeader}>
              <Text style={styles.loanManagerTitle}>Apply for Loan</Text>
              <TouchableOpacity onPress={() => setShowNewLoanModal(false)}>
                <X size={24} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.loanManagerBody} showsVerticalScrollIndicator={false}>
              {/* Loan Type Selection */}
              <Text style={styles.inputLabel}>Loan Type</Text>
              <View style={styles.loanTypeGrid}>
                {[
                  { id: 'personal', name: 'Personal Loan', color: '#3B82F6' },
                  { id: 'business', name: 'Business Loan', color: '#10B981' },
                ].map((type) => {
                  const isBusinessLoan = type.id === 'business';
                  const isPersonalLoan = type.id === 'personal';
                  const hasCompany = gameState.companies && gameState.companies.length > 0 && (gameState.companies || []).reduce((sum, company) => sum + calculateCompanyValue(company), 0) > 0;
                  const hasPositiveCashFlow = calculateWeeklyCashFlow() > 0;
                  const isDisabled = (isBusinessLoan && !hasCompany) || (isPersonalLoan && !hasPositiveCashFlow);
                  
                  return (
                    <TouchableOpacity
                      key={type.id}
                      style={[
                        styles.loanTypeCard,
                        newLoanType === type.id && styles.loanTypeCardSelected,
                        isDisabled && styles.loanTypeCardDisabled,
                      ]}
                      onPress={() => !isDisabled && setNewLoanType(type.id as 'personal' | 'business')}
                      disabled={isDisabled}
                    >
                      <View style={[
                        styles.loanTypeIcon, 
                        { backgroundColor: isDisabled ? '#6B7280' : type.color }
                      ]}>
                        <CreditCard size={20} color="#FFFFFF" />
                      </View>
                      <Text style={[
                        styles.loanTypeName,
                        newLoanType === type.id && styles.loanTypeNameSelected,
                        isDisabled && styles.loanTypeNameDisabled,
                        isDisabled && settings?.darkMode && styles.loanTypeNameDisabledDark,
                      ]}>
                        {type.name}
                      </Text>
                      {(isBusinessLoan || isPersonalLoan) && (
                        <Text style={[styles.loanTypeRequirement, settings?.darkMode && styles.loanTypeRequirementDark]}>
                          {isBusinessLoan 
                            ? (hasCompany ? 'Company Required' : 'No Company')
                            : (hasPositiveCashFlow ? 'Positive Cash Flow' : 'Negative Cash Flow')
                          }
                        </Text>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Loan Amount */}
              <Text style={styles.inputLabel}>Loan Amount</Text>
              <TextInput
                style={styles.input}
                value={newLoanAmount}
                onChangeText={setNewLoanAmount}
                placeholder="Enter amount (min $1,000)"
                placeholderTextColor={settings?.darkMode ? "#FFFFFF" : "#6B7280"}
                keyboardType="numeric"
              />
              <Text style={[styles.maxLoanText, settings?.darkMode && styles.maxLoanTextDark]}>
                Max {newLoanType === 'personal' ? 'Personal' : 'Business'} Loan: {(() => {
                  const realEstateValue = (gameState.realEstate || []).reduce((sum: number, property: RealEstate) => sum + (property.price || 0), 0);
                  const companyValue = (gameState.companies || []).reduce((sum, company) => sum + calculateCompanyValue(company), 0);
                  const netWorth = money + bankSavings + realEstateValue + companyValue;
                  const weeklyCashFlow = calculateWeeklyCashFlow();
                  
                  let maxAmount: number;
                  if (newLoanType === 'personal') {
                    if (weeklyCashFlow <= 0) {
                      maxAmount = 0; // No loan if negative cash flow
                    } else {
                      const netWorthBased = netWorth * 0.3;
                      const cashFlowBased = weeklyCashFlow * 0.25 * 104; // 25% of weekly cash flow for 2 years
                      maxAmount = Math.min(netWorthBased, cashFlowBased);
                    }
                  } else {
                    maxAmount = Math.min(100000, companyValue * 0.5);
                  }
                  return formatMoney(Math.round(maxAmount));
                })()}
              </Text>

              {/* Term Selection */}
              <Text style={styles.inputLabel}>Term Length</Text>
              <View style={styles.termGrid}>
                {[32, 64, 104, 156].map((term) => (
                  <TouchableOpacity
                    key={term}
                    style={[
                      styles.termButton,
                      newLoanTerm === term && styles.termButtonSelected,
                    ]}
                    onPress={() => setNewLoanTerm(term)}
                  >
                    <Text style={[
                      styles.termText,
                      newLoanTerm === term && styles.termTextSelected,
                    ]}>
                      {term}w
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Loan Details */}
              {newLoanAmount && parseFloat(newLoanAmount) > 0 && (
                <View style={styles.loanDetailsCard}>
                  <Text style={styles.loanDetailsTitle}>Loan Details</Text>
                  {(() => {
                    const details = calculateLoanDetails(parseFloat(newLoanAmount), newLoanTerm, newLoanType);
                    return (
                      <>
                        <View style={styles.loanDetailsRow}>
                          <Text style={styles.loanDetailsLabel}>Interest Rate:</Text>
                          <Text style={styles.loanDetailsValue}>{details.interestRate.toFixed(2)}% APR</Text>
                        </View>
                        <View style={styles.loanDetailsRow}>
                          <Text style={[styles.loanDetailsLabel, settings?.darkMode && styles.loanDetailsLabelDark]}>Weekly Payment:</Text>
                          <Text style={styles.loanDetailsValue}>{formatMoney(details.weeklyPayment)}</Text>
                        </View>
                        <View style={styles.loanDetailsRow}>
                          <Text style={styles.loanDetailsLabel}>Total Interest:</Text>
                          <Text style={styles.loanDetailsValue}>{formatMoney(details.totalInterest)}</Text>
                        </View>
                        <View style={styles.loanDetailsRow}>
                          <Text style={styles.loanDetailsLabel}>Total Cost:</Text>
                          <Text style={styles.loanDetailsValue}>{formatMoney(details.totalCost)}</Text>
                        </View>
                      </>
                    );
                  })()}
                </View>
              )}
            </ScrollView>

            <View style={styles.loanManagerActions}>
              <TouchableOpacity
                style={[styles.loanManagerButton, styles.loanManagerButtonSecondary]}
                onPress={() => setShowNewLoanModal(false)}
              >
                <Text style={styles.loanManagerButtonTextSecondary}>Cancel</Text>
              </TouchableOpacity>
              {(() => {
                const amount = parseFloat(newLoanAmount);
                const hasValidAmount = newLoanAmount && amount >= 1000;
                const isBusinessLoan = newLoanType === 'business';
                const hasCompany = gameState.companies && gameState.companies.length > 0 && (gameState.companies || []).reduce((sum, company) => sum + calculateCompanyValue(company), 0) > 0;
                const hasPositiveCashFlow = calculateWeeklyCashFlow() > 0;
                const isDisabled = !hasValidAmount || (isBusinessLoan && !hasCompany) || (isBusinessLoan === false && !hasPositiveCashFlow);
                
                return (
                  <TouchableOpacity
                    style={[styles.loanManagerButton, styles.loanManagerButtonPrimary]}
                    onPress={takeNewLoan}
                    disabled={isDisabled}
                  >
                    <LinearGradient
                      colors={isDisabled ? ['#6B7280', '#4B5563'] : ['#10B981', '#059669']}
                      style={styles.loanManagerButtonGradient}
                    >
                      <Text style={[
                        styles.loanManagerButtonTextPrimary,
                        isDisabled && styles.loanManagerButtonTextDisabled
                      ]}>
                        {isDisabled 
                          ? (isBusinessLoan && !hasCompany ? 'Company Required' 
                            : !isBusinessLoan && !hasPositiveCashFlow ? 'Positive Cash Flow Required'
                            : 'Enter Valid Amount')
                          : 'Apply for Loan'
                        }
                      </Text>
                    </LinearGradient>
                  </TouchableOpacity>
                );
              })()}
            </View>
          </View>
        </View>
      </Modal>

      {/* Loan Details Modal */}
      <Modal visible={showLoanDetailsModal} animationType="slide" transparent={true} onRequestClose={() => setShowLoanDetailsModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.loanManagerModalContent}>
            <View style={styles.loanManagerHeader}>
              <Text style={styles.loanManagerTitle}>Loan Details</Text>
              <TouchableOpacity onPress={() => setShowLoanDetailsModal(false)}>
                <X size={24} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            {selectedLoan && (
              <ScrollView style={styles.loanManagerBody} showsVerticalScrollIndicator={false}>
                <View style={styles.loanDetailsCard}>
                  <View style={styles.loanDetailsRow}>
                    <Text style={styles.loanDetailsLabel}>Remaining Balance:</Text>
                    <Text style={styles.loanDetailsValue}>{formatMoney(selectedLoan.remaining)}</Text>
                  </View>
                  <View style={styles.loanDetailsRow}>
                    <Text style={[styles.loanDetailsLabel, settings?.darkMode && styles.loanDetailsLabelDark]}>Weekly Payment:</Text>
                    <Text style={styles.loanDetailsValue}>{formatMoney(selectedLoan.weeklyPayment)}</Text>
                  </View>
                  <View style={styles.loanDetailsRow}>
                    <Text style={styles.loanDetailsLabel}>Interest Rate:</Text>
                    <Text style={styles.loanDetailsValue}>{selectedLoan.rateAPR.toFixed(2)}% APR</Text>
                  </View>
                </View>

                {/* Repayment Options */}
                <Text style={styles.inputLabel}>Make Payment</Text>
                
                <View style={styles.repaySourceRow}>
                  <TouchableOpacity
                    style={[
                      styles.repaySourceButton,
                      repaySource === 'cash' && styles.repaySourceButtonSelected,
                    ]}
                    onPress={() => setRepaySource('cash')}
                  >
                    <Text style={[
                      styles.repaySourceText,
                      repaySource === 'cash' && styles.repaySourceTextSelected,
                    ]}>
                      From Cash
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.repaySourceButton,
                      repaySource === 'savings' && styles.repaySourceButtonSelected,
                    ]}
                    onPress={() => setRepaySource('savings')}
                  >
                    <Text style={[
                      styles.repaySourceText,
                      repaySource === 'savings' && styles.repaySourceTextSelected,
                    ]}>
                      From Savings
                    </Text>
                  </TouchableOpacity>
                </View>

                <TextInput
                  style={styles.input}
                  value={repayAmount}
                  onChangeText={setRepayAmount}
                  placeholder="Enter amount to pay"
                  placeholderTextColor={settings?.darkMode ? "#FFFFFF" : "#6B7280"}
                  keyboardType="numeric"
                />

                <View style={styles.quickPayButtons}>
                  <TouchableOpacity
                    style={styles.quickPayButton}
                    onPress={() => setRepayAmount(selectedLoan.weeklyPayment.toString())}
                  >
                    <Text style={styles.quickPayText}>Weekly Payment</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.quickPayButton}
                    onPress={() => setRepayAmount((selectedLoan.remaining * 0.25).toString())}
                  >
                    <Text style={styles.quickPayText}>25%</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.quickPayButton}
                    onPress={() => setRepayAmount(selectedLoan.remaining.toString())}
                  >
                    <Text style={styles.quickPayText}>Pay Off</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            )}

            <View style={styles.loanManagerActions}>
              <TouchableOpacity
                style={[styles.loanManagerButton, styles.loanManagerButtonSecondary]}
                onPress={() => setShowLoanDetailsModal(false)}
              >
                <Text style={styles.loanManagerButtonTextSecondary}>Close</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.loanManagerButton, styles.loanManagerButtonPrimary]}
                onPress={() => {
                  const amount = parseFloat(repayAmount);
                  if (amount > 0) {
                    repayLoan(selectedLoan!.id, amount);
                  }
                }}
                disabled={!repayAmount || parseFloat(repayAmount) <= 0}
              >
                <LinearGradient
                  colors={['#3B82F6', '#1D4ED8']}
                  style={styles.loanManagerButtonGradient}
                >
                  <Text style={styles.loanManagerButtonTextPrimary}>Make Payment</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: responsivePadding.vertical,
    paddingHorizontal: responsivePadding.horizontal,
    paddingBottom: responsiveSpacing.md,
    backgroundColor: '#1E293B',
  },
  headerTitle: {
    fontSize: responsiveFontSize.xl,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#374151',
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#374151',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: '#1E293B',
    paddingHorizontal: responsivePadding.horizontal,
    paddingBottom: responsiveSpacing.sm,
  },
  tab: {
    flex: 1,
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: responsiveSpacing.sm,
    marginHorizontal: responsiveSpacing.xs,
    borderRadius: responsiveBorderRadius.md,
  },
  activeTab: {
    backgroundColor: '#374151',
  },
  tabText: {
    marginLeft: responsiveSpacing.xs,
    fontSize: responsiveFontSize.sm,
    color: '#6B7280',
    fontWeight: '600',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 2,
  },
  activeTabText: {
    color: '#4F46E5',
  },
  tabTextDark: {
    marginLeft: responsiveSpacing.xs,
    fontSize: responsiveFontSize.sm,
    color: '#FFFFFF',
    fontWeight: '600',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 2,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: responsivePadding.horizontal,
    paddingTop: 20,
    paddingBottom: 40,
    flexGrow: 1,
    justifyContent: 'center',
  },
  tabContent: {
    paddingVertical: responsiveSpacing.lg,
  },
  balanceCard: {
    marginBottom: responsiveSpacing.lg,
  },
  balanceGradient: {
    padding: responsiveSpacing.lg,
    borderRadius: responsiveBorderRadius.xl,
    alignItems: 'center',
  },
  balanceLabel: {
    fontSize: responsiveFontSize.sm,
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: responsiveSpacing.xs,
  },
  balanceAmount: {
    fontSize: responsiveFontSize['3xl'],
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: responsiveSpacing.lg,
  },
  statCard: {
    width: '48%',
    backgroundColor: '#1E293B',
    padding: responsiveSpacing.md,
    borderRadius: responsiveBorderRadius.lg,
    marginBottom: responsiveSpacing.md,
    alignItems: 'center',
  },
  statLabel: {
    fontSize: responsiveFontSize.sm,
    color: '#6B7280',
    marginTop: responsiveSpacing.xs,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 2,
  },
  statLabelDark: {
    color: '#FFFFFF',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 2,
  },
  statValue: {
    fontSize: responsiveFontSize.lg,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginTop: responsiveSpacing.xs,
  },
  servicesStatus: {
    marginTop: responsiveSpacing.lg,
    padding: responsiveSpacing.lg,
    backgroundColor: '#1E293B',
    borderRadius: responsiveBorderRadius.lg,
    borderWidth: 1,
    borderColor: '#374151',
  },
  servicesTitle: {
    fontSize: responsiveFontSize.lg,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: responsiveSpacing.lg,
    textAlign: 'center',
  },
  serviceStatusGrid: {
    gap: responsiveSpacing.md,
  },
  serviceStatusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: responsiveSpacing.md,
    backgroundColor: '#263238',
    borderRadius: responsiveBorderRadius.md,
    borderWidth: 1,
    borderColor: '#374151',
    position: 'relative',
  },
  serviceActiveCard: {
    backgroundColor: '#1E3A2E',
    borderColor: '#10B981',
    borderWidth: 2,
  },
  serviceIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#374151',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: responsiveSpacing.md,
  },
  serviceActiveIcon: {
    backgroundColor: '#10B981',
  },
  serviceImage: {
    width: 32,
    height: 32,
    resizeMode: 'contain',
  },
  serviceInfo: {
    flex: 1,
  },
  serviceStatusText: {
    fontSize: responsiveFontSize.base,
    fontWeight: '600',
    color: '#9CA3AF',
    marginBottom: responsiveSpacing.xs,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 2,
  },
  serviceStatusTextDark: {
    color: '#FFFFFF',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 2,
  },
  serviceActiveText: {
    color: '#FFFFFF',
  },
  serviceBenefit: {
    fontSize: responsiveFontSize.sm,
    color: '#10B981',
    fontWeight: '500',
  },
  serviceInactive: {
    fontSize: responsiveFontSize.sm,
    color: '#6B7280',
    fontStyle: 'italic',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 2,
  },
  serviceInactiveDark: {
    fontSize: responsiveFontSize.sm,
    color: '#FFFFFF',
    fontStyle: 'italic',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 2,
  },
  activeIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981',
    position: 'absolute',
    top: responsiveSpacing.sm,
    right: responsiveSpacing.sm,
  },
  servicesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  serviceCard: {
    width: '48%',
    marginBottom: responsiveSpacing.md,
    borderRadius: responsiveBorderRadius.lg,
    overflow: 'hidden',
  },
  serviceGradient: {
    padding: responsiveSpacing.lg,
    alignItems: 'center',
    minHeight: 120,
    justifyContent: 'center',
  },
  serviceTitle: {
    fontSize: responsiveFontSize.base,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginTop: responsiveSpacing.sm,
    textAlign: 'center',
  },
  serviceDesc: {
    fontSize: responsiveFontSize.sm,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: responsiveSpacing.xs,
    textAlign: 'center',
  },
  serviceStatus: {
    fontSize: responsiveFontSize.sm,
    color: '#6B7280',
    marginTop: responsiveSpacing.sm,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 2,
  },
  serviceStatusDark: {
    fontSize: responsiveFontSize.sm,
    color: '#FFFFFF',
    marginTop: responsiveSpacing.sm,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 2,
  },
  analyticsCard: {
    backgroundColor: '#1E293B',
    padding: responsiveSpacing.lg,
    borderRadius: responsiveBorderRadius.lg,
    marginBottom: responsiveSpacing.md,
  },
  analyticsTitle: {
    fontSize: responsiveFontSize.lg,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: responsiveSpacing.md,
  },
  scoreContainer: {
    alignItems: 'center',
    marginBottom: responsiveSpacing.md,
  },
  scoreValue: {
    fontSize: responsiveFontSize['2xl'],
    fontWeight: 'bold',
    color: '#10B981',
  },
  scoreLabel: {
    fontSize: responsiveFontSize.sm,
    color: '#6B7280',
    marginTop: responsiveSpacing.xs,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 2,
  },
  scoreLabelDark: {
    color: '#FFFFFF',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 2,
  },
  analyticsDesc: {
    fontSize: responsiveFontSize.sm,
    color: '#9CA3AF',
    lineHeight: responsiveFontSize.sm * 1.4,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 2,
  },
  analyticsDescDark: {
    color: '#FFFFFF',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 2,
  },
  budgetItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: responsiveSpacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: '#374151',
  },
  budgetLabel: {
    fontSize: responsiveFontSize.base,
    color: '#9CA3AF',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 2,
  },
  budgetLabelDark: {
    color: '#FFFFFF',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 2,
  },
  budgetValue: {
    fontSize: responsiveFontSize.base,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  settingsCard: {
    backgroundColor: '#1E293B',
    padding: responsiveSpacing.lg,
    borderRadius: responsiveBorderRadius.lg,
    marginBottom: responsiveSpacing.md,
  },
  settingsTitle: {
    fontSize: responsiveFontSize.lg,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: responsiveSpacing.md,
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: responsiveSpacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: '#374151',
  },
  settingLabel: {
    fontSize: responsiveFontSize.base,
    color: '#9CA3AF',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 2,
  },
  settingLabelDark: {
    color: '#FFFFFF',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 2,
  },
  toggleButton: {
    width: 60,
    height: 30,
    backgroundColor: '#374151',
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
  },
  toggleText: {
    fontSize: responsiveFontSize.sm,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  settingButton: {
    backgroundColor: '#374151',
    paddingVertical: responsiveSpacing.sm,
    paddingHorizontal: responsiveSpacing.md,
    borderRadius: responsiveBorderRadius.md,
    alignItems: 'center',
    marginTop: responsiveSpacing.sm,
  },
  settingButtonText: {
    fontSize: responsiveFontSize.base,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '90%',
    backgroundColor: '#1E293B',
    borderRadius: responsiveBorderRadius.lg,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: responsiveSpacing.md,
    backgroundColor: '#374151',
  },
  modalTitle: {
    fontSize: responsiveFontSize.lg,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  modalBody: {
    padding: responsiveSpacing.md,
  },
  modalText: {
    fontSize: responsiveFontSize.base,
    color: '#9CA3AF',
    marginBottom: responsiveSpacing.sm,
  },
  loanOptions: {
    backgroundColor: '#263238',
    padding: responsiveSpacing.sm,
    borderRadius: responsiveBorderRadius.md,
  },
  loanOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: responsiveSpacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: '#374151',
  },
  loanAmount: {
    fontSize: responsiveFontSize.base,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  loanRate: {
    fontSize: responsiveFontSize.sm,
    color: '#6B7280',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 2,
  },
  loanRateDark: {
    color: '#FFFFFF',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 2,
  },
  featureList: {
    marginBottom: responsiveSpacing.sm,
  },
  featureItem: {
    fontSize: responsiveFontSize.sm,
    color: '#9CA3AF',
    marginBottom: responsiveSpacing.xs,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 2,
  },
  featureItemDark: {
    color: '#FFFFFF',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 2,
  },
  confirmButton: {
    backgroundColor: '#10B981',
    paddingVertical: responsiveSpacing.sm,
    paddingHorizontal: responsiveSpacing.md,
    borderRadius: responsiveBorderRadius.md,
    alignItems: 'center',
  },
  confirmButtonText: {
    fontSize: responsiveFontSize.base,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  companySection: {
    backgroundColor: '#263238',
    padding: responsiveSpacing.md,
    borderRadius: responsiveBorderRadius.md,
    marginBottom: responsiveSpacing.sm,
  },
  companyName: {
    fontSize: responsiveFontSize.base,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: responsiveSpacing.xs,
  },
  companyMoney: {
    fontSize: responsiveFontSize.base,
    color: '#9CA3AF',
    marginBottom: responsiveSpacing.sm,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 2,
  },
  companyMoneyDark: {
    color: '#FFFFFF',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 2,
  },
  sectionTitle: {
    fontSize: responsiveFontSize.sm,
    fontWeight: 'bold',
    color: '#9CA3AF',
    marginTop: responsiveSpacing.sm,
    marginBottom: responsiveSpacing.xs,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 2,
  },
  sectionTitleDark: {
    color: '#FFFFFF',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 2,
  },
  upgradeOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: responsiveSpacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: '#374151',
  },
  upgradeName: {
    fontSize: responsiveFontSize.sm,
    color: '#FFFFFF',
  },
  upgradePrice: {
    fontSize: responsiveFontSize.sm,
    color: '#10B981',
    fontWeight: 'bold',
  },
  loanManagementSection: {
    marginTop: responsiveSpacing.lg,
  },
  loanManagementTitle: {
    fontSize: responsiveFontSize.lg,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: responsiveSpacing.md,
  },
  loanManagementCard: {
    backgroundColor: '#1E293B',
    padding: responsiveSpacing.lg,
    borderRadius: responsiveBorderRadius.lg,
    borderWidth: 1,
    borderColor: '#374151',
  },
  loanManagementHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: responsiveSpacing.md,
    gap: responsiveSpacing.sm,
  },
  loanManagementSubtitle: {
    fontSize: responsiveFontSize.base,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  loanManagementDesc: {
    fontSize: responsiveFontSize.sm,
    color: '#9CA3AF',
    lineHeight: responsiveFontSize.sm * 1.4,
    marginBottom: responsiveSpacing.lg,
  },
  loanManagementButton: {
    borderRadius: responsiveBorderRadius.md,
    overflow: 'hidden',
  },
  loanManagementButtonGradient: {
    paddingVertical: responsiveSpacing.md,
    paddingHorizontal: responsiveSpacing.lg,
    alignItems: 'center',
  },
  loanManagementButtonText: {
    fontSize: responsiveFontSize.base,
    fontWeight: '600',
    color: '#FFFFFF',
  },

  // Loan Manager Modal Styles
  loanManagerModalContent: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    margin: 20,
    maxHeight: '90%',
    flex: 1,
  },
  loanManagerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  loanManagerHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  loanManagerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  loanManagerBody: {
    flex: 1,
    padding: 20,
  },
  loanManagerActions: {
    flexDirection: 'row',
    gap: 12,
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  loanManagerButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loanManagerButtonSecondary: {
    backgroundColor: '#374151',
  },
  loanManagerButtonPrimary: {
    // Gradient will be applied
  },
  loanManagerButtonGradient: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loanManagerButtonTextSecondary: {
    color: '#D1D5DB',
    fontSize: 16,
    fontWeight: '600',
  },
  loanManagerButtonTextPrimary: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  loanManagerButtonTextDisabled: {
    color: '#D1D5DB',
  },

  // Loan Summary Styles
  loanSummaryCard: {
    backgroundColor: '#0F172A',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  loanSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  loanSummaryItem: {
    alignItems: 'center',
    flex: 1,
  },
  loanSummaryLabel: {
    fontSize: 12,
    color: '#9CA3AF',
    marginBottom: 4,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 2,
  },
  loanSummaryLabelDark: {
    color: '#FFFFFF',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 2,
  },
  loanSummaryValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // New Loan Button
  newLoanButton: {
    marginBottom: 20,
  },
  newLoanButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
  },
  newLoanButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },

  // Active Loans Section
  activeLoansSection: {
    marginBottom: 20,
  },
  activeLoansTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  loanCard: {
    backgroundColor: '#0F172A',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  loanCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  loanTypeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  loanTypeIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loanName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  loanMeta: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 2,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 2,
  },
  loanMetaDark: {
    color: '#FFFFFF',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 2,
  },
  loanProgress: {
    marginBottom: 12,
  },
  progressBar: {
    height: 6,
    backgroundColor: '#374151',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 4,
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  progressText: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'right',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 2,
  },
  progressTextDark: {
    color: '#FFFFFF',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 2,
  },
  loanPayment: {
    // Additional styles if needed
  },
  paymentLabel: {
    fontSize: 14,
    color: '#D1D5DB',
  },

  // Empty State
  emptyLoansState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyLoansTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyLoansText: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 20,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 2,
  },
  emptyLoansTextDark: {
    color: '#FFFFFF',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 2,
  },

  // Input Styles
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#374151',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#FFFFFF',
    marginBottom: 8,
  },
  maxLoanText: {
    fontSize: 12,
    color: '#9CA3AF',
    marginBottom: 16,
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 2,
  },
  maxLoanTextDark: {
    color: '#FFFFFF',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 2,
  },

  // Loan Type Grid
  loanTypeGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  loanTypeCard: {
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#374151',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    flex: 1,
  },
  loanTypeCardSelected: {
    borderColor: '#3B82F6',
    backgroundColor: '#1E3A8A',
  },
  loanTypeCardDisabled: {
    borderColor: '#6B7280',
    backgroundColor: '#374151',
    opacity: 0.6,
  },
  loanTypeName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#D1D5DB',
    marginTop: 8,
    textAlign: 'center',
  },
  loanTypeNameSelected: {
    color: '#FFFFFF',
  },
  loanTypeNameDisabled: {
    color: '#9CA3AF',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 2,
  },
  loanTypeNameDisabledDark: {
    color: '#FFFFFF',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 2,
  },
  loanTypeRequirement: {
    fontSize: 10,
    color: '#9CA3AF',
    marginTop: 4,
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 2,
  },
  loanTypeRequirementDark: {
    color: '#FFFFFF',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 2,
  },

  // Term Grid
  termGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20,
  },
  termButton: {
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#374151',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
    minWidth: 60,
    alignItems: 'center',
  },
  termButtonSelected: {
    borderColor: '#3B82F6',
    backgroundColor: '#1E3A8A',
  },
  termText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#D1D5DB',
  },
  termTextSelected: {
    color: '#FFFFFF',
  },

  // Loan Details Card
  loanDetailsCard: {
    backgroundColor: '#0F172A',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  loanDetailsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  loanDetailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  loanDetailsLabel: {
    fontSize: 14,
    color: '#9CA3AF',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 2,
  },
  loanDetailsLabelDark: {
    color: '#FFFFFF',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 2,
  },
  loanDetailsValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },

  // New Loan Application Styles
  loanTypeSelection: {
    marginBottom: 20,
  },
  loanAmountSection: {
    marginBottom: 20,
  },
  loanAmountInput: {
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#374151',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#FFFFFF',
    marginBottom: 8,
  },
  loanAmountHint: {
    fontSize: 12,
    color: '#9CA3AF',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 2,
  },
  loanAmountHintDark: {
    color: '#FFFFFF',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 2,
  },
  termSelection: {
    marginBottom: 20,
  },
  loanDetailsPreview: {
    backgroundColor: '#0F172A',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },

  // Savings Action Styles
  savingsActionCard: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#374151',
  },
  savingsActionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 12,
  },
  savingsActionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  savingsActionDesc: {
    fontSize: 14,
    color: '#9CA3AF',
    marginBottom: 16,
    lineHeight: 20,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 2,
  },
  savingsActionDescDark: {
    color: '#FFFFFF',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 2,
  },
  savingsInputGroup: {
    marginBottom: 16,
  },
  savingsInput: {
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#374151',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#FFFFFF',
    marginBottom: 8,
  },
  savingsInputHint: {
    fontSize: 12,
    color: '#9CA3AF',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 2,
  },
  savingsInputHintDark: {
    color: '#FFFFFF',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 2,
  },
  savingsActionButton: {
    borderRadius: 8,
    overflow: 'hidden',
  },
  savingsActionButtonGradient: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  savingsActionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },

  // Repayment Source
  repaySourceRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  repaySourceButton: {
    flex: 1,
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#374151',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  repaySourceButtonSelected: {
    borderColor: '#3B82F6',
    backgroundColor: '#1E3A8A',
  },
  repaySourceText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#D1D5DB',
  },
  repaySourceTextSelected: {
    color: '#FFFFFF',
  },

  // Quick Pay Buttons
  quickPayButtons: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  quickPayButton: {
    flex: 1,
    backgroundColor: '#374151',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  quickPayText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#D1D5DB',
  },

  // Savings Styles
  savingsStats: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 24,
  },
  savingsActions: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 24,
  },
  savingsButton: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  savingsButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    paddingHorizontal: 24,
  },
  savingsButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  savingsInfo: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 16,
  },
  savingsInfoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  benefitsList: {
    gap: 8,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  benefitText: {
    fontSize: 14,
    color: '#D1D5DB',
  },
  balanceInfo: {
    gap: 8,
  },
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  balanceSubtext: {
    fontSize: 12,
    color: '#9CA3AF',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 2,
  },
  balanceSubtextDark: {
    color: '#FFFFFF',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 2,
  },
  inputError: {
    borderColor: '#EF4444',
    borderWidth: 2,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 12,
    marginTop: 4,
    marginLeft: 4,
  },
});
