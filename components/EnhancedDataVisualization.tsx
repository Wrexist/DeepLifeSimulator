import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  ScrollView,
  Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import {
  TrendingUp,
  TrendingDown,
  BarChart3,
  PieChart,
  LineChart,
  Activity,
  Target,
  Award,
  Calendar,
  DollarSign,
  Users,
  Heart,
  Zap,
  Home,
  Briefcase,
  Star,
  ChevronRight,
  ChevronLeft,
  Filter,
  Download,
  Share,
} from 'lucide-react-native';
import { useGame } from '@/contexts/GameContext';
import { useFeedback } from '@/utils/feedbackSystem';
import { DesignSystem } from '@/utils/designSystem';

interface EnhancedDataVisualizationProps {
  darkMode?: boolean;
  compact?: boolean;
}

const { width } = Dimensions.get('window');

export default function EnhancedDataVisualization({
  darkMode = false,
  compact = false,
}: EnhancedDataVisualizationProps) {
  const { gameState } = useGame();
  const { buttonPress, haptic } = useFeedback(gameState?.settings?.hapticFeedback || false);
  
  const [selectedTimeframe, setSelectedTimeframe] = useState<'week' | 'month' | 'year' | 'all'>('month');
  const [selectedChart, setSelectedChart] = useState<'wealth' | 'stats' | 'progress' | 'social'>('wealth');
  const [showDetails, setShowDetails] = useState(false);

  // Animated values for charts
  const wealthAnim = useRef(new Animated.Value(0)).current;
  const statsAnim = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const socialAnim = useRef(new Animated.Value(0)).current;

  // Calculate data based on selected timeframe
  const chartData = useMemo(() => {
    const now = new Date();
    const timeframeData = {
      week: 7,
      month: 30,
      year: 365,
      all: gameState.weeksLived || 1,
    };

    const days = timeframeData[selectedTimeframe];
    
    // Generate mock historical data (in a real app, this would come from saved game state)
    const generateData = (baseValue: number, trend: number, volatility: number) => {
      const data = [];
      for (let i = 0; i < days; i++) {
        const randomFactor = (Math.random() - 0.5) * volatility;
        const trendFactor = (days - i) * trend / days;
        const value = Math.max(0, baseValue + trendFactor + randomFactor);
        data.push({
          day: i,
          value: Math.round(value),
          date: new Date(now.getTime() - (days - i) * 24 * 60 * 60 * 1000),
        });
      }
      return data;
    };

    return {
      wealth: generateData(gameState.stats?.money || 0, 1000, 500),
      health: generateData(gameState.stats?.health || 100, 0, 10),
      happiness: generateData(gameState.stats?.happiness || 100, 0, 10),
      energy: generateData(gameState.stats?.energy || 100, 0, 10),
      fitness: generateData(gameState.stats?.fitness || 10, 1, 2),
      reputation: generateData(gameState.stats?.reputation || 0, 2, 5),
    };
  }, [selectedTimeframe, gameState]);

  // Calculate current trends
  const trends = useMemo(() => {
    const calculateTrend = (data: any[]) => {
      if (data.length < 2) return 0;
      const first = data[0].value;
      const last = data[data.length - 1].value;
      return ((last - first) / first) * 100;
    };

    return {
      wealth: calculateTrend(chartData.wealth),
      health: calculateTrend(chartData.health),
      happiness: calculateTrend(chartData.happiness),
      energy: calculateTrend(chartData.energy),
      fitness: calculateTrend(chartData.fitness),
      reputation: calculateTrend(chartData.reputation),
    };
  }, [chartData]);

  // Animate charts when data changes
  useEffect(() => {
    const animateChart = (animValue: Animated.Value) => {
      Animated.timing(animValue, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: false,
      }).start();
    };

    animateChart(wealthAnim);
    animateChart(statsAnim);
    animateChart(progressAnim);
    animateChart(socialAnim);
  }, [selectedTimeframe, selectedChart]);

  const renderTimeframeSelector = () => (
    <View style={styles.timeframeSelector}>
      {(['week', 'month', 'year', 'all'] as const).map(timeframe => (
        <TouchableOpacity
          key={timeframe}
          onPress={() => {
            buttonPress();
            haptic('light');
            setSelectedTimeframe(timeframe);
          }}
          style={[
            styles.timeframeButton,
            selectedTimeframe === timeframe && styles.timeframeButtonActive,
          ]}
        >
          <Text style={[
            styles.timeframeButtonText,
            selectedTimeframe === timeframe && styles.timeframeButtonTextActive,
          ]}>
            {timeframe.charAt(0).toUpperCase() + timeframe.slice(1)}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderChartSelector = () => (
    <View style={styles.chartSelector}>
      {[
        { key: 'wealth', label: 'Wealth', icon: DollarSign, color: '#10B981' },
        { key: 'stats', label: 'Stats', icon: Activity, color: '#3B82F6' },
        { key: 'progress', label: 'Progress', icon: Target, color: '#F59E0B' },
        { key: 'social', label: 'Social', icon: Users, color: '#EF4444' },
      ].map(chart => (
        <TouchableOpacity
          key={chart.key}
          onPress={() => {
            buttonPress();
            haptic('light');
            setSelectedChart(chart.key as typeof selectedChart);
          }}
          style={[
            styles.chartButton,
            selectedChart === chart.key && styles.chartButtonActive,
          ]}
        >
          <chart.icon size={20} color={selectedChart === chart.key ? '#FFFFFF' : chart.color} />
          <Text style={[
            styles.chartButtonText,
            selectedChart === chart.key && styles.chartButtonTextActive,
          ]}>
            {chart.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderWealthChart = () => {
    const data = chartData.wealth;
    const maxValue = Math.max(...data.map(d => d.value));
    const minValue = Math.min(...data.map(d => d.value));
    const range = maxValue - minValue;

    return (
      <View style={styles.chartContainer}>
        <View style={styles.chartHeader}>
          <View style={styles.chartTitle}>
            <DollarSign size={24} color="#10B981" />
            <Text style={[styles.chartTitleText, darkMode && styles.chartTitleTextDark]}>
              Wealth Trend
            </Text>
          </View>
          <View style={styles.chartTrend}>
            <TrendingUp size={16} color={trends.wealth >= 0 ? '#10B981' : '#EF4444'} />
            <Text style={[
              styles.chartTrendText,
              { color: trends.wealth >= 0 ? '#10B981' : '#EF4444' }
            ]}>
              {trends.wealth >= 0 ? '+' : ''}{trends.wealth.toFixed(1)}%
            </Text>
          </View>
        </View>
        
        <View style={styles.chartArea}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.chartContent}>
              {data.map((point, index) => {
                const height = range > 0 ? ((point.value - minValue) / range) * 200 : 100;
                return (
                  <Animated.View
                    key={index}
                    style={[
                      styles.chartBar,
                      {
                        height: wealthAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0, height],
                        }),
                        backgroundColor: '#10B981',
                      },
                    ]}
                  />
                );
              })}
            </View>
          </ScrollView>
        </View>
        
        <View style={styles.chartStats}>
          <View style={styles.chartStat}>
            <Text style={[styles.chartStatLabel, darkMode && styles.chartStatLabelDark]}>
              Current
            </Text>
            <Text style={[styles.chartStatValue, darkMode && styles.chartStatValueDark]}>
              ${data[data.length - 1]?.value.toLocaleString() || 0}
            </Text>
          </View>
          <View style={styles.chartStat}>
            <Text style={[styles.chartStatLabel, darkMode && styles.chartStatLabelDark]}>
              Peak
            </Text>
            <Text style={[styles.chartStatValue, darkMode && styles.chartStatValueDark]}>
              ${maxValue.toLocaleString()}
            </Text>
          </View>
          <View style={styles.chartStat}>
            <Text style={[styles.chartStatLabel, darkMode && styles.chartStatLabelDark]}>
              Low
            </Text>
            <Text style={[styles.chartStatValue, darkMode && styles.chartStatValueDark]}>
              ${minValue.toLocaleString()}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  const renderStatsChart = () => {
    const stats = [
      { key: 'health', label: 'Health', color: '#EF4444', data: chartData.health },
      { key: 'happiness', label: 'Happiness', color: '#F59E0B', data: chartData.happiness },
      { key: 'energy', label: 'Energy', color: '#06B6D4', data: chartData.energy },
      { key: 'fitness', label: 'Fitness', color: '#8B5CF6', data: chartData.fitness },
    ];

    return (
      <View style={styles.chartContainer}>
        <View style={styles.chartHeader}>
          <View style={styles.chartTitle}>
            <Activity size={24} color="#3B82F6" />
            <Text style={[styles.chartTitleText, darkMode && styles.chartTitleTextDark]}>
              Stats Overview
            </Text>
          </View>
        </View>
        
        <View style={styles.statsGrid}>
          {stats.map(stat => {
            const currentValue = stat.data[stat.data.length - 1]?.value || 0;
            const trend = trends[stat.key as keyof typeof trends];
            
            return (
              <View key={stat.key} style={styles.statCard}>
                <View style={styles.statCardHeader}>
                  <View style={[styles.statIcon, { backgroundColor: stat.color + '20' }]}>
                    {stat.key === 'health' && <Heart size={16} color={stat.color} />}
                    {stat.key === 'happiness' && <Star size={16} color={stat.color} />}
                    {stat.key === 'energy' && <Zap size={16} color={stat.color} />}
                    {stat.key === 'fitness' && <Target size={16} color={stat.color} />}
                  </View>
                  <View style={styles.statTrend}>
                    {trend >= 0 ? (
                      <TrendingUp size={12} color="#10B981" />
                    ) : (
                      <TrendingDown size={12} color="#EF4444" />
                    )}
                    <Text style={[
                      styles.statTrendText,
                      { color: trend >= 0 ? '#10B981' : '#EF4444' }
                    ]}>
                      {Math.abs(trend).toFixed(1)}%
                    </Text>
                  </View>
                </View>
                <Text style={[styles.statValue, darkMode && styles.statValueDark]}>
                  {currentValue}
                </Text>
                <Text style={[styles.statLabel, darkMode && styles.statLabelDark]}>
                  {stat.label}
                </Text>
                <View style={styles.statProgressBar}>
                  <Animated.View
                    style={[
                      styles.statProgressFill,
                      {
                        width: statsAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: ['0%', `${Math.min(currentValue, 100)}%`],
                        }),
                        backgroundColor: stat.color,
                      },
                    ]}
                  />
                </View>
              </View>
            );
          })}
        </View>
      </View>
    );
  };

  const renderProgressChart = () => {
    const achievements = gameState.achievements || [];
    const completed = achievements.filter((a: any) => a.completed).length;
    const total = achievements.length;
    const completionRate = total > 0 ? (completed / total) * 100 : 0;

    const categories = [
      { name: 'Wealth', completed: 3, total: 6, color: '#10B981' },
      { name: 'Career', completed: 1, total: 4, color: '#F59E0B' },
      { name: 'Social', completed: 2, total: 5, color: '#EF4444' },
      { name: 'Health', completed: 1, total: 3, color: '#06B6D4' },
      { name: 'Family', completed: 0, total: 4, color: '#8B5CF6' },
    ];

    return (
      <View style={styles.chartContainer}>
        <View style={styles.chartHeader}>
          <View style={styles.chartTitle}>
            <Target size={24} color="#F59E0B" />
            <Text style={[styles.chartTitleText, darkMode && styles.chartTitleTextDark]}>
              Progress Overview
            </Text>
          </View>
          <View style={styles.chartTrend}>
            <Award size={16} color="#F59E0B" />
            <Text style={[styles.chartTrendText, { color: '#F59E0B' }]}>
              {completed}/{total}
            </Text>
          </View>
        </View>
        
        <View style={styles.progressOverview}>
          <View style={styles.progressCircle}>
            <Animated.View
              style={[
                styles.progressCircleFill,
                {
                  transform: [{
                    rotate: progressAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: ['0deg', `${completionRate * 3.6}deg`],
                    }),
                  }],
                },
              ]}
            />
            <Text style={[styles.progressPercentage, darkMode && styles.progressPercentageDark]}>
              {Math.round(completionRate)}%
            </Text>
          </View>
        </View>
        
        <View style={styles.categoriesList}>
          {categories.map(category => {
            const rate = (category.completed / category.total) * 100;
            return (
              <View key={category.name} style={styles.categoryItem}>
                <View style={styles.categoryInfo}>
                  <View style={[styles.categoryDot, { backgroundColor: category.color }]} />
                  <Text style={[styles.categoryName, darkMode && styles.categoryNameDark]}>
                    {category.name}
                  </Text>
                </View>
                <View style={styles.categoryProgress}>
                  <View style={[styles.categoryProgressBar, darkMode && styles.categoryProgressBarDark]}>
                    <Animated.View
                      style={[
                        styles.categoryProgressFill,
                        {
                          width: progressAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: ['0%', `${rate}%`],
                          }),
                          backgroundColor: category.color,
                        },
                      ]}
                    />
                  </View>
                  <Text style={[styles.categoryProgressText, darkMode && styles.categoryProgressTextDark]}>
                    {category.completed}/{category.total}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      </View>
    );
  };

  const renderSocialChart = () => {
    const relationships = gameState.relationships || [];
    const friends = relationships.filter((r: any) => r.type === 'friend').length;
    const family = relationships.filter((r: any) => r.type === 'child' || r.type === 'spouse').length;
    const colleagues = relationships.filter((r: any) => r.type === 'colleague').length;
    
    const socialData = [
      { label: 'Friends', value: friends, color: '#EF4444' },
      { label: 'Family', value: family, color: '#8B5CF6' },
      { label: 'Colleagues', value: colleagues, color: '#3B82F6' },
    ];

    const total = socialData.reduce((sum, item) => sum + item.value, 0);

    return (
      <View style={styles.chartContainer}>
        <View style={styles.chartHeader}>
          <View style={styles.chartTitle}>
            <Users size={24} color="#EF4444" />
            <Text style={[styles.chartTitleText, darkMode && styles.chartTitleTextDark]}>
              Social Network
            </Text>
          </View>
          <View style={styles.chartTrend}>
            <Users size={16} color="#EF4444" />
            <Text style={[styles.chartTrendText, { color: '#EF4444' }]}>
              {total} Total
            </Text>
          </View>
        </View>
        
        <View style={styles.socialChart}>
          <View style={styles.socialPie}>
            {socialData.map((item, index) => {
              const percentage = total > 0 ? (item.value / total) * 100 : 0;
              const angle = (percentage / 100) * 360;
              const startAngle = socialData.slice(0, index).reduce((sum, prev) => sum + (prev.value / total) * 360, 0);
              
              return (
                <Animated.View
                  key={item.label}
                  style={[
                    styles.socialPieSlice,
                    {
                      backgroundColor: item.color,
                      transform: [{
                        rotate: socialAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: ['0deg', `${startAngle}deg`],
                        }),
                      }],
                    },
                  ]}
                />
              );
            })}
          </View>
          
          <View style={styles.socialLegend}>
            {socialData.map(item => (
              <View key={item.label} style={styles.socialLegendItem}>
                <View style={[styles.socialLegendDot, { backgroundColor: item.color }]} />
                <Text style={[styles.socialLegendLabel, darkMode && styles.socialLegendLabelDark]}>
                  {item.label}
                </Text>
                <Text style={[styles.socialLegendValue, darkMode && styles.socialLegendValueDark]}>
                  {item.value}
                </Text>
              </View>
            ))}
          </View>
        </View>
      </View>
    );
  };

  const renderChart = () => {
    switch (selectedChart) {
      case 'wealth':
        return renderWealthChart();
      case 'stats':
        return renderStatsChart();
      case 'progress':
        return renderProgressChart();
      case 'social':
        return renderSocialChart();
      default:
        return renderWealthChart();
    }
  };

  if (compact) {
    return (
      <View style={styles.compactContainer}>
        {renderTimeframeSelector()}
        {renderChart()}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={darkMode ? ['#1F2937', '#111827'] : ['#F8FAFC', '#FFFFFF']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}
      >
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <BarChart3 size={28} color="#3B82F6" />
            <Text style={[styles.headerTitle, darkMode && styles.headerTitleDark]}>
              Data Analytics
            </Text>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity
              onPress={() => {
                buttonPress();
                haptic('light');
                setShowDetails(!showDetails);
              }}
              style={styles.headerButton}
            >
              <Filter size={20} color={darkMode ? '#FFFFFF' : '#374151'} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                buttonPress();
                haptic('light');
                // Export functionality
              }}
              style={styles.headerButton}
            >
              <Download size={20} color={darkMode ? '#FFFFFF' : '#374151'} />
            </TouchableOpacity>
          </View>
        </View>

        {renderTimeframeSelector()}
        {renderChartSelector()}
        {renderChart()}

        {showDetails && (
          <View style={[styles.detailsPanel, darkMode && styles.detailsPanelDark]}>
            <Text style={[styles.detailsTitle, darkMode && styles.detailsTitleDark]}>
              Chart Details
            </Text>
            <Text style={[styles.detailsText, darkMode && styles.detailsTextDark]}>
              This chart shows your {selectedChart} data over the selected {selectedTimeframe} period.
              Use the controls above to explore different timeframes and data types.
            </Text>
          </View>
        )}
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  compactContainer: {
    padding: 16,
  },
  gradient: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1F2937',
    marginLeft: 12,
  },
  headerTitleDark: {
    color: '#FFFFFF',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  headerButton: {
    padding: 8,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    borderRadius: 8,
  },
  timeframeSelector: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 16,
    gap: 8,
  },
  timeframeButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#F3F4F6',
    borderRadius: 20,
  },
  timeframeButtonActive: {
    backgroundColor: '#3B82F6',
  },
  timeframeButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  timeframeButtonTextActive: {
    color: '#FFFFFF',
  },
  chartSelector: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 16,
    gap: 8,
  },
  chartButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    gap: 8,
  },
  chartButtonActive: {
    backgroundColor: '#3B82F6',
  },
  chartButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  chartButtonTextActive: {
    color: '#FFFFFF',
  },
  chartContainer: {
    margin: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    boxShadow: '0px 4px 8px rgba(0, 0, 0, 0.1)',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  chartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  chartTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  chartTitleText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
  },
  chartTitleTextDark: {
    color: '#FFFFFF',
  },
  chartTrend: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  chartTrendText: {
    fontSize: 14,
    fontWeight: '500',
  },
  chartArea: {
    height: 200,
    marginBottom: 20,
  },
  chartContent: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: '100%',
    gap: 2,
  },
  chartBar: {
    width: 8,
    borderRadius: 4,
    minHeight: 4,
  },
  chartStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  chartStat: {
    alignItems: 'center',
  },
  chartStatLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
  },
  chartStatLabelDark: {
    color: '#9CA3AF',
  },
  chartStatValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  chartStatValueDark: {
    color: '#FFFFFF',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
  },
  statCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  statIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statTrend: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  statTrendText: {
    fontSize: 12,
    fontWeight: '500',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 4,
  },
  statValueDark: {
    color: '#FFFFFF',
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 8,
  },
  statLabelDark: {
    color: '#9CA3AF',
  },
  statProgressBar: {
    height: 4,
    backgroundColor: '#E5E7EB',
    borderRadius: 2,
  },
  statProgressFill: {
    height: '100%',
    borderRadius: 2,
  },
  progressOverview: {
    alignItems: 'center',
    marginBottom: 20,
  },
  progressCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  progressCircleFill: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    borderRadius: 60,
    backgroundColor: '#F59E0B',
    transformOrigin: 'center',
  },
  progressPercentage: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1F2937',
  },
  progressPercentageDark: {
    color: '#FFFFFF',
  },
  categoriesList: {
    gap: 12,
  },
  categoryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  categoryInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  categoryDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  categoryName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  categoryNameDark: {
    color: '#D1D5DB',
  },
  categoryProgress: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  categoryProgressBar: {
    width: 100,
    height: 4,
    backgroundColor: '#E5E7EB',
    borderRadius: 2,
  },
  categoryProgressBarDark: {
    backgroundColor: '#374151',
  },
  categoryProgressFill: {
    height: '100%',
    borderRadius: 2,
  },
  categoryProgressText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6B7280',
    minWidth: 30,
    textAlign: 'right',
  },
  categoryProgressTextDark: {
    color: '#9CA3AF',
  },
  socialChart: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
  },
  socialPie: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#F3F4F6',
    position: 'relative',
  },
  socialPieSlice: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    borderRadius: 60,
    transformOrigin: 'center',
  },
  socialLegend: {
    flex: 1,
    gap: 8,
  },
  socialLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  socialLegendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  socialLegendLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    flex: 1,
  },
  socialLegendLabelDark: {
    color: '#D1D5DB',
  },
  socialLegendValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
  },
  socialLegendValueDark: {
    color: '#FFFFFF',
  },
  detailsPanel: {
    margin: 20,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
  },
  detailsPanelDark: {
    backgroundColor: '#374151',
  },
  detailsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  detailsTitleDark: {
    color: '#D1D5DB',
  },
  detailsText: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
  },
  detailsTextDark: {
    color: '#9CA3AF',
  },
});
