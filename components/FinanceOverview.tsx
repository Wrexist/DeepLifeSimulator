/**
 * Finance Overview Component
 * 
 * Comprehensive financial dashboard with visualizations, trends, and projections
 */
import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
} from 'react-native';
import LinearGradientFallback from '@/components/fallbacks/LinearGradientFallback';
const LinearGradient = LinearGradientFallback;
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Wallet,
  PiggyBank,
  CreditCard,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
  AlertTriangle,
  CheckCircle,
  Building2,
} from 'lucide-react-native';
import { useGame } from '@/contexts/GameContext';
import { calcWeeklyPassiveIncome } from '@/lib/economy/passiveIncome';
import { calcWeeklyExpenses } from '@/lib/economy/expenses';
import { getWeeklyInflationRate } from '@/lib/economy/inflation';
import { scale, fontScale } from '@/utils/scaling';
import { WEEKS_PER_YEAR } from '@/lib/config/gameConstants';

const { width: screenWidth } = Dimensions.get('window');

interface LoanSummary {
  principal?: number;
  remaining?: number;
  weeklyPayment: number;
}

interface FinanceOverviewProps {
  compact?: boolean;
  onExpand?: () => void;
}

export default function FinanceOverview({ compact = false, onExpand }: FinanceOverviewProps) {
  const { gameState } = useGame();
  const { settings } = gameState;
  
  // Calculate financial data
  const passive = calcWeeklyPassiveIncome(gameState);
  const expenses = calcWeeklyExpenses(gameState as typeof gameState & { loans?: LoanSummary[] });
  const loans = ((gameState as typeof gameState & { loans?: LoanSummary[] }).loans) || [];
  const totalLoanDebt = loans.reduce((sum, l) => sum + (l.remaining ?? l.principal ?? 0), 0);
  const weeklyLoanPayments = loans.reduce((sum, l) => sum + (l.weeklyPayment || 0), 0);
  const inflation = getWeeklyInflationRate(gameState) * 100;

  // Calculate net worth
  const netWorth = useMemo(() => {
    let total = gameState.stats.money;
    // Add bank savings
    total += gameState.bankSavings || 0;
    // Add real estate values
    (gameState.realEstates || []).forEach(re => {
      if (re.owned) {
        total += re.price || 0;
      }
    });
    // Add vehicle values
    (gameState.vehicles || []).forEach(v => {
      if (v.owned) {
        total += (v.price * (v.condition / 100)) || 0;
      }
    });
    // Add company values
    (gameState.companies || []).forEach(c => {
      total += (c.weeklyIncome * WEEKS_PER_YEAR) || 0; // Rough valuation
    });
    // Subtract loans
    total -= totalLoanDebt;
    return total;
  }, [gameState.stats.money, gameState.bankSavings, gameState.realEstates, gameState.vehicles, gameState.companies, totalLoanDebt]);

  // Calculate weekly cash flow
  const weeklyCashFlow = useMemo(() => {
    const income = passive.total + (gameState.salary || 0);
    const outflow = expenses.total + weeklyLoanPayments;
    return income - outflow;
  }, [passive.total, gameState.salary, expenses.total, weeklyLoanPayments]);

  // Calculate savings rate
  const savingsRate = useMemo(() => {
    const income = passive.total + (gameState.salary || 0);
    if (income <= 0) return 0;
    return Math.max(0, (weeklyCashFlow / income) * 100);
  }, [passive.total, gameState.salary, weeklyCashFlow]);

  // Financial health score (0-100)
  const financialHealth = useMemo(() => {
    let score = 50; // Base score
    
    // Positive factors
    if (netWorth > 0) score += 10;
    if (netWorth > 100000) score += 5;
    if (netWorth > 1000000) score += 5;
    if (weeklyCashFlow > 0) score += 10;
    if (savingsRate > 20) score += 5;
    if (savingsRate > 50) score += 5;
    if (gameState.bankSavings && gameState.bankSavings > expenses.total * 12) score += 5; // 3 months emergency fund
    
    // Negative factors
    if (netWorth < 0) score -= 20;
    if (weeklyCashFlow < 0) score -= 15;
    if (totalLoanDebt > netWorth) score -= 10;
    if (expenses.total > passive.total + (gameState.salary || 0)) score -= 10;
    
    return Math.max(0, Math.min(100, score));
  }, [netWorth, weeklyCashFlow, savingsRate, totalLoanDebt, expenses.total, passive.total, gameState.salary, gameState.bankSavings]);

  // Format money with suffixes [[memory:8959604]]
  const formatMoney = (amount: number): string => {
    const absAmount = Math.abs(amount);
    const sign = amount < 0 ? '-' : '';
    
    if (absAmount >= 1_000_000_000_000_000) {
      return `${sign}$${(absAmount / 1_000_000_000_000_000).toFixed(2)}Q`;
    } else if (absAmount >= 1_000_000_000_000) {
      return `${sign}$${(absAmount / 1_000_000_000_000).toFixed(2)}T`;
    } else if (absAmount >= 1_000_000_000) {
      return `${sign}$${(absAmount / 1_000_000_000).toFixed(2)}B`;
    } else if (absAmount >= 1_000_000) {
      return `${sign}$${(absAmount / 1_000_000).toFixed(2)}M`;
    } else if (absAmount > 10_000) {
      // Thousands (K) - only for numbers above 10,000
      return `${sign}$${(absAmount / 1_000).toFixed(2)}K`;
    }
    // Regular numbers (0-10,000) - show full number
    return `${sign}$${Math.floor(absAmount).toLocaleString()}`;
  };

  const getHealthColor = (score: number) => {
    if (score >= 80) return '#10B981';
    if (score >= 60) return '#F59E0B';
    if (score >= 40) return '#EF4444';
    return '#DC2626';
  };

  const getHealthLabel = (score: number) => {
    if (score >= 80) return 'Excellent';
    if (score >= 60) return 'Good';
    if (score >= 40) return 'Fair';
    return 'Poor';
  };

  // Simple bar chart component
  const renderMiniBar = (value: number, max: number, color: string, label: string) => {
    const percentage = Math.min(100, (Math.abs(value) / Math.max(max, 1)) * 100);
    
    return (
      <View style={styles.miniBarContainer}>
        <View style={styles.miniBarLabel}>
          <Text style={[styles.miniBarLabelText, settings.darkMode && styles.textMuted]}>
            {label}
          </Text>
          <Text style={[styles.miniBarValueText, { color }]}>
            {formatMoney(value)}
          </Text>
        </View>
        <View style={[styles.miniBarTrack, settings.darkMode && styles.miniBarTrackDark]}>
          <View
            style={[
              styles.miniBarFill,
              { width: `${percentage}%`, backgroundColor: color },
            ]}
          />
        </View>
      </View>
    );
  };

  // Compact view for dashboard
  if (compact) {
    return (
      <TouchableOpacity onPress={onExpand}>
        <View style={[styles.compactContainer, settings.darkMode && styles.containerDark]}>
          <View style={styles.compactHeader}>
            <BarChart3 size={18} color={settings.darkMode ? '#60A5FA' : '#3B82F6'} />
            <Text style={[styles.compactTitle, settings.darkMode && styles.textDark]}>
              Finances
            </Text>
            <View style={[styles.healthBadge, { backgroundColor: `${getHealthColor(financialHealth)}20` }]}>
              <View style={[styles.healthDot, { backgroundColor: getHealthColor(financialHealth) }]} />
              <Text style={[styles.healthBadgeText, { color: getHealthColor(financialHealth) }]}>
                {getHealthLabel(financialHealth)}
              </Text>
            </View>
          </View>
          <View style={styles.compactStats}>
            <View style={styles.compactStat}>
              <Text style={[styles.compactStatLabel, settings.darkMode && styles.textMuted]}>Net Worth</Text>
              <Text style={[styles.compactStatValue, { color: netWorth >= 0 ? '#10B981' : '#EF4444' }]}>
                {formatMoney(netWorth)}
              </Text>
            </View>
            <View style={styles.compactDivider} />
            <View style={styles.compactStat}>
              <Text style={[styles.compactStatLabel, settings.darkMode && styles.textMuted]}>Cash Flow</Text>
              <View style={styles.compactStatRow}>
                {weeklyCashFlow >= 0 ? (
                  <ArrowUpRight size={14} color="#10B981" />
                ) : (
                  <ArrowDownRight size={14} color="#EF4444" />
                )}
                <Text style={[styles.compactStatValue, { color: weeklyCashFlow >= 0 ? '#10B981' : '#EF4444' }]}>
                  {formatMoney(weeklyCashFlow)}/wk
                </Text>
              </View>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  }

  // Full view
  return (
    <View style={[styles.container, settings.darkMode && styles.containerDark]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <BarChart3 size={24} color={settings.darkMode ? '#60A5FA' : '#3B82F6'} />
          <Text style={[styles.title, settings.darkMode && styles.textDark]}>
            Financial Overview
          </Text>
        </View>
        <View style={[styles.healthBadgeLarge, { backgroundColor: `${getHealthColor(financialHealth)}20` }]}>
          {financialHealth >= 60 ? (
            <CheckCircle size={16} color={getHealthColor(financialHealth)} />
          ) : (
            <AlertTriangle size={16} color={getHealthColor(financialHealth)} />
          )}
          <Text style={[styles.healthBadgeLargeText, { color: getHealthColor(financialHealth) }]}>
            {financialHealth}% {getHealthLabel(financialHealth)}
          </Text>
        </View>
      </View>

      {/* Net Worth Card */}
      <LinearGradient
        colors={netWorth >= 0 ? ['#10B981', '#059669'] : ['#EF4444', '#DC2626']}
        style={styles.netWorthCard}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={styles.netWorthContent}>
          <Text style={styles.netWorthLabel}>Total Net Worth</Text>
          <Text style={styles.netWorthValue}>{formatMoney(netWorth)}</Text>
          <View style={styles.netWorthTrend}>
            {weeklyCashFlow >= 0 ? (
              <TrendingUp size={16} color="#FFF" />
            ) : (
              <TrendingDown size={16} color="#FFF" />
            )}
            <Text style={styles.netWorthTrendText}>
              {weeklyCashFlow >= 0 ? '+' : ''}{formatMoney(weeklyCashFlow)}/week
            </Text>
          </View>
        </View>
        <View style={styles.netWorthIcon}>
          <Wallet size={40} color="rgba(255,255,255,0.3)" />
        </View>
      </LinearGradient>

      {/* Quick Stats Grid */}
      <View style={styles.statsGrid}>
        <View style={[styles.statCard, settings.darkMode && styles.statCardDark]}>
          <DollarSign size={20} color="#10B981" />
          <Text style={[styles.statCardValue, settings.darkMode && styles.textDark]}>
            {formatMoney(gameState.stats.money)}
          </Text>
          <Text style={[styles.statCardLabel, settings.darkMode && styles.textMuted]}>Cash</Text>
        </View>
        
        <View style={[styles.statCard, settings.darkMode && styles.statCardDark]}>
          <PiggyBank size={20} color="#3B82F6" />
          <Text style={[styles.statCardValue, settings.darkMode && styles.textDark]}>
            {formatMoney(gameState.bankSavings || 0)}
          </Text>
          <Text style={[styles.statCardLabel, settings.darkMode && styles.textMuted]}>Savings</Text>
        </View>
        
        <View style={[styles.statCard, settings.darkMode && styles.statCardDark]}>
          <CreditCard size={20} color="#EF4444" />
          <Text style={[styles.statCardValue, settings.darkMode && styles.textDark]}>
            {formatMoney(totalLoanDebt)}
          </Text>
          <Text style={[styles.statCardLabel, settings.darkMode && styles.textMuted]}>Debt</Text>
        </View>
        
        <View style={[styles.statCard, settings.darkMode && styles.statCardDark]}>
          <Building2 size={20} color="#8B5CF6" />
          <Text style={[styles.statCardValue, settings.darkMode && styles.textDark]}>
            {(gameState.realEstates || []).filter(r => r.owned).length}
          </Text>
          <Text style={[styles.statCardLabel, settings.darkMode && styles.textMuted]}>Properties</Text>
        </View>
      </View>

      {/* Income vs Expenses */}
      <View style={[styles.section, settings.darkMode && styles.sectionDark]}>
        <Text style={[styles.sectionTitle, settings.darkMode && styles.textDark]}>
          Weekly Cash Flow
        </Text>
        
        {renderMiniBar(
          passive.total + (gameState.salary || 0),
          Math.max(passive.total + (gameState.salary || 0), expenses.total),
          '#10B981',
          'Income'
        )}
        
        {renderMiniBar(
          expenses.total + weeklyLoanPayments,
          Math.max(passive.total + (gameState.salary || 0), expenses.total + weeklyLoanPayments),
          '#EF4444',
          'Expenses'
        )}
        
        <View style={styles.cashFlowSummary}>
          <Text style={[styles.cashFlowLabel, settings.darkMode && styles.textMuted]}>
            Net Weekly Cash Flow
          </Text>
          <View style={styles.cashFlowValue}>
            {weeklyCashFlow >= 0 ? (
              <ArrowUpRight size={18} color="#10B981" />
            ) : (
              <ArrowDownRight size={18} color="#EF4444" />
            )}
            <Text style={[
              styles.cashFlowAmount,
              { color: weeklyCashFlow >= 0 ? '#10B981' : '#EF4444' }
            ]}>
              {formatMoney(weeklyCashFlow)}
            </Text>
          </View>
        </View>
      </View>

      {/* Key Metrics */}
      <View style={[styles.metricsRow, settings.darkMode && styles.sectionDark]}>
        <View style={styles.metric}>
          <Text style={[styles.metricLabel, settings.darkMode && styles.textMuted]}>
            Savings Rate
          </Text>
          <Text style={[
            styles.metricValue,
            { color: savingsRate >= 20 ? '#10B981' : savingsRate >= 10 ? '#F59E0B' : '#EF4444' }
          ]}>
            {savingsRate.toFixed(1)}%
          </Text>
        </View>
        
        <View style={styles.metricDivider} />
        
        <View style={styles.metric}>
          <Text style={[styles.metricLabel, settings.darkMode && styles.textMuted]}>
            Inflation
          </Text>
          <Text style={[styles.metricValue, { color: inflation > 5 ? '#EF4444' : '#10B981' }]}>
            {inflation.toFixed(2)}%
          </Text>
        </View>
        
        <View style={styles.metricDivider} />
        
        <View style={styles.metric}>
          <Text style={[styles.metricLabel, settings.darkMode && styles.textMuted]}>
            Loan Payments
          </Text>
          <Text style={[styles.metricValue, settings.darkMode && styles.textDark]}>
            {formatMoney(weeklyLoanPayments)}/wk
          </Text>
        </View>
      </View>

      {/* Projections */}
      <View style={[styles.projectionCard, settings.darkMode && styles.projectionCardDark]}>
        <Text style={[styles.projectionTitle, settings.darkMode && styles.textDark]}>
          ðŸ“Š 1-Year Projection
        </Text>
        <View style={styles.projectionGrid}>
          <View style={styles.projectionItem}>
            <Text style={[styles.projectionLabel, settings.darkMode && styles.textMuted]}>
              Est. Net Worth
            </Text>
            <Text style={[styles.projectionValue, { color: netWorth + (weeklyCashFlow * WEEKS_PER_YEAR) >= netWorth ? '#10B981' : '#EF4444' }]}>
              {formatMoney(netWorth + (weeklyCashFlow * WEEKS_PER_YEAR))}
            </Text>
          </View>
          <View style={styles.projectionItem}>
            <Text style={[styles.projectionLabel, settings.darkMode && styles.textMuted]}>
              Est. Savings
            </Text>
            <Text style={[styles.projectionValue, settings.darkMode && styles.textDark]}>
              {formatMoney((gameState.bankSavings || 0) + (weeklyCashFlow > 0 ? weeklyCashFlow * WEEKS_PER_YEAR * 0.5 : 0))}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: scale(16),
    padding: scale(16),
    marginHorizontal: scale(16),
    marginBottom: scale(16),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  containerDark: {
    backgroundColor: '#1F2937',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: scale(16),
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: {
    fontSize: fontScale(18),
    fontWeight: 'bold',
    color: '#111827',
    marginLeft: scale(10),
  },
  healthBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: scale(8),
    paddingVertical: scale(4),
    borderRadius: scale(12),
  },
  healthDot: {
    width: scale(6),
    height: scale(6),
    borderRadius: scale(3),
    marginRight: scale(4),
  },
  healthBadgeText: {
    fontSize: fontScale(11),
    fontWeight: '600',
  },
  healthBadgeLarge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: scale(10),
    paddingVertical: scale(6),
    borderRadius: scale(12),
  },
  healthBadgeLargeText: {
    fontSize: fontScale(12),
    fontWeight: '600',
    marginLeft: scale(6),
  },
  netWorthCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: scale(16),
    borderRadius: scale(12),
    marginBottom: scale(16),
  },
  netWorthContent: {},
  netWorthLabel: {
    fontSize: fontScale(12),
    color: 'rgba(255,255,255,0.8)',
    marginBottom: scale(4),
  },
  netWorthValue: {
    fontSize: fontScale(28),
    fontWeight: 'bold',
    color: '#FFF',
  },
  netWorthTrend: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: scale(8),
  },
  netWorthTrendText: {
    fontSize: fontScale(13),
    color: '#FFF',
    marginLeft: scale(4),
  },
  netWorthIcon: {
    opacity: 0.5,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: scale(-4),
    marginBottom: scale(16),
  },
  statCard: {
    width: '23%',
    backgroundColor: '#F9FAFB',
    borderRadius: scale(10),
    padding: scale(10),
    alignItems: 'center',
    margin: scale(4),
  },
  statCardDark: {
    backgroundColor: '#374151',
  },
  statCardValue: {
    fontSize: fontScale(14),
    fontWeight: 'bold',
    color: '#111827',
    marginTop: scale(6),
  },
  statCardLabel: {
    fontSize: fontScale(10),
    color: '#6B7280',
    marginTop: scale(2),
    textAlign: 'center',
  },
  section: {
    backgroundColor: '#F9FAFB',
    borderRadius: scale(12),
    padding: scale(14),
    marginBottom: scale(12),
  },
  sectionDark: {
    backgroundColor: '#374151',
  },
  sectionTitle: {
    fontSize: fontScale(14),
    fontWeight: '600',
    color: '#111827',
    marginBottom: scale(12),
  },
  miniBarContainer: {
    marginBottom: scale(10),
  },
  miniBarLabel: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: scale(4),
  },
  miniBarLabelText: {
    fontSize: fontScale(12),
    color: '#6B7280',
  },
  miniBarValueText: {
    fontSize: fontScale(12),
    fontWeight: '600',
  },
  miniBarTrack: {
    height: scale(8),
    backgroundColor: '#E5E7EB',
    borderRadius: scale(4),
    overflow: 'hidden',
  },
  miniBarTrackDark: {
    backgroundColor: '#4B5563',
  },
  miniBarFill: {
    height: '100%',
    borderRadius: scale(4),
  },
  cashFlowSummary: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: scale(8),
    paddingTop: scale(10),
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  cashFlowLabel: {
    fontSize: fontScale(13),
    color: '#6B7280',
  },
  cashFlowValue: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cashFlowAmount: {
    fontSize: fontScale(16),
    fontWeight: 'bold',
    marginLeft: scale(4),
  },
  metricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: scale(12),
    padding: scale(14),
    marginBottom: scale(12),
  },
  metric: {
    flex: 1,
    alignItems: 'center',
  },
  metricLabel: {
    fontSize: fontScale(11),
    color: '#6B7280',
    marginBottom: scale(4),
  },
  metricValue: {
    fontSize: fontScale(15),
    fontWeight: 'bold',
  },
  metricDivider: {
    width: 1,
    height: scale(30),
    backgroundColor: '#E5E7EB',
    marginHorizontal: scale(8),
  },
  projectionCard: {
    backgroundColor: '#F0F9FF',
    borderRadius: scale(12),
    padding: scale(14),
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  projectionCardDark: {
    backgroundColor: '#1E3A5F',
    borderColor: '#3B82F6',
  },
  projectionTitle: {
    fontSize: fontScale(14),
    fontWeight: '600',
    color: '#111827',
    marginBottom: scale(10),
  },
  projectionGrid: {
    flexDirection: 'row',
  },
  projectionItem: {
    flex: 1,
  },
  projectionLabel: {
    fontSize: fontScale(11),
    color: '#6B7280',
    marginBottom: scale(4),
  },
  projectionValue: {
    fontSize: fontScale(16),
    fontWeight: 'bold',
  },
  // Compact styles
  compactContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: scale(12),
    padding: scale(12),
    marginHorizontal: scale(16),
    marginBottom: scale(12),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  compactHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: scale(10),
  },
  compactTitle: {
    fontSize: fontScale(14),
    fontWeight: '600',
    color: '#111827',
    marginLeft: scale(8),
    flex: 1,
  },
  compactStats: {
    flexDirection: 'row',
  },
  compactStat: {
    flex: 1,
  },
  compactStatLabel: {
    fontSize: fontScale(11),
    color: '#6B7280',
    marginBottom: scale(2),
  },
  compactStatValue: {
    fontSize: fontScale(15),
    fontWeight: 'bold',
  },
  compactStatRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  compactDivider: {
    width: 1,
    backgroundColor: '#E5E7EB',
    marginHorizontal: scale(12),
  },
  textDark: {
    color: '#F9FAFB',
  },
  textMuted: {
    color: '#9CA3AF',
  },
});

