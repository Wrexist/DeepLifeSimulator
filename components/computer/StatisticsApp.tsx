/**
 * Statistics & Analytics Dashboard
 * 
 * Comprehensive statistics app showing lifetime achievements, graphs, and analytics
 */
import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  ArrowLeft,
  BarChart3,
  TrendingUp,
  Briefcase,
  Heart,
  Trophy,
  Users,
  DollarSign,
  Building2,
  Home,
  Plane,
  AlertTriangle,
  Award,
  Target,
  Clock,
  Zap,
  Star,
  Crown,
  Network,
  Compass,
  Activity,
  Link,
} from 'lucide-react-native';
import { useGame } from '@/contexts/GameContext';
import { scale, fontScale } from '@/utils/scaling';
import {
  calculateNetWorth,
  formatStatMoney,
  formatStatNumber,
  getCareerSummary,
  getAchievementProgress,
} from '@/lib/statistics/statisticsTracker';
import { getEnhancedLifetimeStatistics } from '@/lib/statistics/enhancedStatistics';
import { getSystemHealth } from '@/lib/depth/systemInterconnections';
import { getDiscoveryProgress } from '@/lib/depth/discoverySystem';
import DiscoveryIndicator from '@/components/depth/DiscoveryIndicator';

const { width: screenWidth } = Dimensions.get('window');

interface StatisticsAppProps {
  onBack: () => void;
}

type TabType = 'overview' | 'career' | 'relationships' | 'achievements' | 'comparison' | 'systems' | 'interconnections' | 'discovery' | 'trends';

// Simple line chart component using View elements
const SimpleLineChart = ({ 
  data, 
  width, 
  height, 
  color,
  showGrid = true,
}: { 
  data: { week: number; value: number }[]; 
  width: number; 
  height: number;
  color: string;
  showGrid?: boolean;
}) => {
  if (data.length < 2) {
    return (
      <View style={[{ width, height }, styles.chartEmpty]}>
        <Text style={styles.chartEmptyText}>Not enough data yet</Text>
        <Text style={styles.chartEmptySubtext}>Keep playing to see your progress!</Text>
      </View>
    );
  }
  
  const maxValue = Math.max(...data.map(d => d.value), 1);
  const minValue = Math.min(...data.map(d => d.value), 0);
  const range = maxValue - minValue || 1;
  
  const points = data.map((d, i) => ({
    x: (i / (data.length - 1)) * (width - 20),
    y: height - 30 - ((d.value - minValue) / range) * (height - 50),
  }));
  
  return (
    <View style={{ width, height, position: 'relative' }}>
      {/* Grid lines */}
      {showGrid && [0, 0.25, 0.5, 0.75, 1].map((ratio, i) => (
        <View
          key={i}
          style={[
            styles.gridLine,
            { top: 10 + ratio * (height - 50) }
          ]}
        />
      ))}
      
      {/* Y-axis labels */}
      <Text style={[styles.chartLabel, { top: 5, left: 0 }]}>
        {formatStatMoney(maxValue)}
      </Text>
      <Text style={[styles.chartLabel, { top: height - 25, left: 0 }]}>
        {formatStatMoney(minValue)}
      </Text>
      
      {/* Data points */}
      {points.map((point, i) => (
        <View
          key={i}
          style={[
            styles.dataPoint,
            {
              left: 10 + point.x,
              top: point.y,
              backgroundColor: color,
            }
          ]}
        />
      ))}
      
      {/* Connect lines */}
      {points.slice(0, -1).map((point, i) => {
        const nextPoint = points[i + 1];
        const dx = nextPoint.x - point.x;
        const dy = nextPoint.y - point.y;
        const length = Math.sqrt(dx * dx + dy * dy);
        const angle = Math.atan2(dy, dx) * (180 / Math.PI);
        
        return (
          <View
            key={`line-${i}`}
            style={[
              styles.chartLine,
              {
                left: 10 + point.x + 4,
                top: point.y + 4,
                width: length,
                backgroundColor: color,
                transform: [{ rotate: `${angle}deg` }],
                transformOrigin: 'left center',
              }
            ]}
          />
        );
      })}
    </View>
  );
};

// Stat card component
const StatCard = ({ 
  icon: Icon, 
  label, 
  value, 
  color,
  subValue,
}: { 
  icon: React.ElementType;
  label: string; 
  value: string | number;
  color: string;
  subValue?: string;
}) => (
  <View style={styles.statCard}>
    <LinearGradient
      colors={['#1F2937', '#111827']}
      style={styles.statCardGradient}
    >
      <View style={[styles.statIconContainer, { backgroundColor: `${color}20` }]}>
        <Icon size={scale(20)} color={color} />
      </View>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
      {subValue && <Text style={styles.statSubValue}>{subValue}</Text>}
    </LinearGradient>
  </View>
);

// Progress bar component
const ProgressBar = ({ 
  progress, 
  color,
  label,
  showPercentage = true,
}: { 
  progress: number; 
  color: string;
  label?: string;
  showPercentage?: boolean;
}) => (
  <View style={styles.progressContainer}>
    {label && <Text style={styles.progressLabel}>{label}</Text>}
    <View style={styles.progressBarBg}>
      <LinearGradient
        colors={[color, `${color}CC`]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[styles.progressBarFill, { width: `${Math.min(100, progress)}%` }]}
      />
    </View>
    {showPercentage && (
      <Text style={styles.progressPercentage}>{Math.round(progress)}%</Text>
    )}
  </View>
);

export default function StatisticsApp({ onBack }: StatisticsAppProps) {
  const { gameState } = useGame();
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const { settings } = gameState;
  
  const stats = gameState.lifetimeStatistics || {
    totalMoneyEarned: 0,
    totalMoneySpent: 0,
    peakNetWorth: 0,
    peakNetWorthWeek: 0,
    totalWeeksWorked: 0,
    totalRelationships: 0,
    totalChildren: 0,
    totalCompaniesOwned: 0,
    totalPropertiesOwned: 0,
    totalCrimesCommitted: 0,
    totalJailTime: 0,
    totalTravelDestinations: 0,
    totalPostsMade: 0,
    totalViralPosts: 0,
    careerHistory: [],
    netWorthHistory: [],
    weeklyEarningsHistory: [],
    highestSalary: 0,
    totalHobbiesLearned: 0,
    totalAchievementsUnlocked: 0,
  };
  
  const currentNetWorth = useMemo(() => calculateNetWorth(gameState), [gameState]);
  const careerSummary = useMemo(() => getCareerSummary(stats), [stats]);
  const achievementProgress = useMemo(() => getAchievementProgress(gameState), [gameState]);
  
  const tabs: { id: TabType; label: string; icon: React.ElementType }[] = [
    { id: 'overview', label: 'Overview', icon: BarChart3 },
    { id: 'career', label: 'Career', icon: Briefcase },
    { id: 'relationships', label: 'Life', icon: Heart },
    { id: 'achievements', label: 'Achievements', icon: Trophy },
    { id: 'comparison', label: 'Ranking', icon: Crown },
    { id: 'systems', label: 'Systems', icon: Network },
    { id: 'interconnections', label: 'Connections', icon: Link },
    { id: 'discovery', label: 'Discovery', icon: Compass },
    { id: 'trends', label: 'Trends', icon: Activity },
  ];
  
  const renderOverviewTab = useCallback(() => (
    <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
      {/* Net Worth Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Net Worth</Text>
        <View style={styles.netWorthCard}>
          <LinearGradient
            colors={['#10B981', '#059669']}
            style={styles.netWorthGradient}
          >
            <Text style={styles.netWorthLabel}>Current Net Worth</Text>
            <Text style={styles.netWorthValue}>{formatStatMoney(currentNetWorth)}</Text>
            <View style={styles.netWorthStats}>
              <View style={styles.netWorthStat}>
                <TrendingUp size={scale(16)} color="#FFFFFF" />
                <Text style={styles.netWorthStatText}>
                  Peak: {formatStatMoney(stats.peakNetWorth)}
                </Text>
              </View>
              <View style={styles.netWorthStat}>
                <Clock size={scale(16)} color="#FFFFFF" />
                <Text style={styles.netWorthStatText}>
                  Week {stats.peakNetWorthWeek}
                </Text>
              </View>
            </View>
          </LinearGradient>
        </View>
        
        {/* Net Worth Chart */}
        <View style={styles.chartContainer}>
          <Text style={styles.chartTitle}>Net Worth Over Time</Text>
          <SimpleLineChart
            data={stats.netWorthHistory}
            width={screenWidth - scale(64)}
            height={scale(150)}
            color="#10B981"
          />
        </View>
      </View>
      
      {/* Money Flow Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Money Flow</Text>
        <View style={styles.statsGrid}>
          <StatCard
            icon={TrendingUp}
            label="Total Earned"
            value={formatStatMoney(stats.totalMoneyEarned)}
            color="#10B981"
          />
          <StatCard
            icon={DollarSign}
            label="Total Spent"
            value={formatStatMoney(stats.totalMoneySpent)}
            color="#EF4444"
          />
        </View>
      </View>
      
      {/* Quick Stats */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Life Statistics</Text>
        <View style={styles.statsGrid}>
          <StatCard
            icon={Building2}
            label="Companies"
            value={stats.totalCompaniesOwned}
            color="#8B5CF6"
          />
          <StatCard
            icon={Home}
            label="Properties"
            value={stats.totalPropertiesOwned}
            color="#F59E0B"
          />
          <StatCard
            icon={Plane}
            label="Destinations"
            value={stats.totalTravelDestinations}
            color="#3B82F6"
          />
          <StatCard
            icon={Users}
            label="Relationships"
            value={stats.totalRelationships}
            color="#EC4899"
          />
        </View>
      </View>
    </ScrollView>
  ), [currentNetWorth, stats]);
  
  const renderCareerTab = useCallback(() => (
    <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
      {/* Career Summary */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Career Summary</Text>
        <View style={styles.summaryCard}>
          <LinearGradient
            colors={['#1F2937', '#111827']}
            style={styles.summaryGradient}
          >
            <View style={styles.summaryRow}>
              <View style={styles.summaryItem}>
                <Briefcase size={scale(24)} color="#3B82F6" />
                <Text style={styles.summaryValue}>{careerSummary.totalJobs}</Text>
                <Text style={styles.summaryLabel}>Total Jobs</Text>
              </View>
              <View style={styles.summaryItem}>
                <Clock size={scale(24)} color="#10B981" />
                <Text style={styles.summaryValue}>{careerSummary.totalWeeks}</Text>
                <Text style={styles.summaryLabel}>Weeks Worked</Text>
              </View>
              <View style={styles.summaryItem}>
                <DollarSign size={scale(24)} color="#F59E0B" />
                <Text style={styles.summaryValue}>{formatStatMoney(careerSummary.totalEarnings)}</Text>
                <Text style={styles.summaryLabel}>Total Earnings</Text>
              </View>
            </View>
          </LinearGradient>
        </View>
      </View>
      
      {/* Earnings Chart */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Weekly Earnings</Text>
        <View style={styles.chartContainer}>
          <SimpleLineChart
            data={stats.weeklyEarningsHistory}
            width={screenWidth - scale(64)}
            height={scale(150)}
            color="#3B82F6"
          />
        </View>
      </View>
      
      {/* Career Highlights */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Career Highlights</Text>
        <View style={styles.highlightCard}>
          <LinearGradient
            colors={['#1F2937', '#111827']}
            style={styles.highlightGradient}
          >
            <View style={styles.highlightItem}>
              <Star size={scale(20)} color="#F59E0B" />
              <View style={styles.highlightText}>
                <Text style={styles.highlightLabel}>Highest Annual Salary</Text>
                <Text style={styles.highlightValue}>{formatStatMoney(stats.highestSalary)}</Text>
              </View>
            </View>
            {careerSummary.longestJob && (
              <View style={styles.highlightItem}>
                <Clock size={scale(20)} color="#10B981" />
                <View style={styles.highlightText}>
                  <Text style={styles.highlightLabel}>Longest Position</Text>
                  <Text style={styles.highlightValue}>
                    {careerSummary.longestJob.job} ({careerSummary.longestJob.weeks} weeks)
                  </Text>
                </View>
              </View>
            )}
            {careerSummary.highestPaying && (
              <View style={styles.highlightItem}>
                <Award size={scale(20)} color="#8B5CF6" />
                <View style={styles.highlightText}>
                  <Text style={styles.highlightLabel}>Most Lucrative Job</Text>
                  <Text style={styles.highlightValue}>
                    {careerSummary.highestPaying.job} ({formatStatMoney(careerSummary.highestPaying.earnings)})
                  </Text>
                </View>
              </View>
            )}
          </LinearGradient>
        </View>
      </View>
      
      {/* Career History */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Job History</Text>
        {stats.careerHistory.length === 0 ? (
          <View style={styles.emptyState}>
            <Briefcase size={scale(40)} color="#6B7280" />
            <Text style={styles.emptyStateText}>No job history yet</Text>
            <Text style={styles.emptyStateSubtext}>Start working to track your career!</Text>
          </View>
        ) : (
          stats.careerHistory.slice(-10).reverse().map((entry, index) => (
            <View key={index} style={styles.historyItem}>
              <View style={styles.historyDot} />
              <View style={styles.historyContent}>
                <Text style={styles.historyTitle}>{entry.job}</Text>
                <Text style={styles.historySubtitle}>
                  {entry.weeks} weeks • {formatStatMoney(entry.earnings)} earned
                </Text>
              </View>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  ), [careerSummary, stats]);
  
  const renderRelationshipsTab = useCallback(() => (
    <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
      {/* Life Stats */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Life & Social</Text>
        <View style={styles.statsGrid}>
          <StatCard
            icon={Users}
            label="Relationships"
            value={stats.totalRelationships}
            color="#EC4899"
          />
          <StatCard
            icon={Heart}
            label="Children"
            value={stats.totalChildren}
            color="#EF4444"
          />
          <StatCard
            icon={Zap}
            label="Posts Made"
            value={stats.totalPostsMade}
            color="#3B82F6"
          />
          <StatCard
            icon={Star}
            label="Viral Posts"
            value={stats.totalViralPosts}
            color="#F59E0B"
          />
        </View>
      </View>
      
      {/* Activities */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Activities & Hobbies</Text>
        <View style={styles.statsGrid}>
          <StatCard
            icon={Target}
            label="Hobbies Learned"
            value={stats.totalHobbiesLearned}
            color="#10B981"
          />
          <StatCard
            icon={Plane}
            label="Places Visited"
            value={stats.totalTravelDestinations}
            color="#8B5CF6"
          />
        </View>
      </View>
      
      {/* Criminal Record */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Criminal Record</Text>
        <View style={styles.statsGrid}>
          <StatCard
            icon={AlertTriangle}
            label="Crimes"
            value={stats.totalCrimesCommitted}
            color="#EF4444"
          />
          <StatCard
            icon={Clock}
            label="Jail Time"
            value={`${stats.totalJailTime} weeks`}
            color="#6B7280"
          />
        </View>
      </View>
    </ScrollView>
  ), [stats]);
  
  const renderAchievementsTab = useCallback(() => {
    const unlockedAchievements = (gameState.achievements || []).filter(a => a.unlocked);
    const lockedAchievements = (gameState.achievements || []).filter(a => !a.unlocked);
    
    return (
      <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
        {/* Progress Overview */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Achievement Progress</Text>
          <View style={styles.achievementProgress}>
            <LinearGradient
              colors={['#1F2937', '#111827']}
              style={styles.achievementProgressGradient}
            >
              <View style={styles.achievementProgressHeader}>
                <Trophy size={scale(32)} color="#F59E0B" />
                <View style={styles.achievementProgressText}>
                  <Text style={styles.achievementProgressValue}>
                    {achievementProgress.unlocked} / {achievementProgress.total}
                  </Text>
                  <Text style={styles.achievementProgressLabel}>Achievements Unlocked</Text>
                </View>
              </View>
              <ProgressBar
                progress={achievementProgress.percentage}
                color="#F59E0B"
                label=""
              />
            </LinearGradient>
          </View>
        </View>
        
        {/* Unlocked Achievements */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Unlocked ({unlockedAchievements.length})
          </Text>
          {unlockedAchievements.length === 0 ? (
            <View style={styles.emptyState}>
              <Trophy size={scale(40)} color="#6B7280" />
              <Text style={styles.emptyStateText}>No achievements yet</Text>
              <Text style={styles.emptyStateSubtext}>Keep playing to unlock achievements!</Text>
            </View>
          ) : (
            unlockedAchievements.slice(0, 20).map((achievement, index) => (
              <View key={index} style={styles.achievementItem}>
                <LinearGradient
                  colors={['#1F2937', '#111827']}
                  style={styles.achievementItemGradient}
                >
                  <View style={[styles.achievementIcon, { backgroundColor: '#F59E0B20' }]}>
                    <Trophy size={scale(20)} color="#F59E0B" />
                  </View>
                  <View style={styles.achievementContent}>
                    <Text style={styles.achievementName}>{achievement.name}</Text>
                    <Text style={styles.achievementDesc}>{achievement.description}</Text>
                  </View>
                  <View style={styles.achievementUnlocked}>
                    <Award size={scale(16)} color="#10B981" />
                  </View>
                </LinearGradient>
              </View>
            ))
          )}
        </View>
        
        {/* Locked Achievements Preview */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Locked ({lockedAchievements.length})
          </Text>
          {lockedAchievements.slice(0, 5).map((achievement, index) => (
            <View key={index} style={[styles.achievementItem, styles.achievementLocked]}>
              <LinearGradient
                colors={['#1F2937', '#0F172A']}
                style={styles.achievementItemGradient}
              >
                <View style={[styles.achievementIcon, { backgroundColor: '#6B728020' }]}>
                  <Trophy size={scale(20)} color="#6B7280" />
                </View>
                <View style={styles.achievementContent}>
                  <Text style={[styles.achievementName, { color: '#6B7280' }]}>
                    {achievement.secret ? '???' : achievement.name}
                  </Text>
                  <Text style={[styles.achievementDesc, { color: '#4B5563' }]}>
                    {achievement.secret ? 'Secret Achievement' : achievement.description}
                  </Text>
                </View>
              </LinearGradient>
            </View>
          ))}
        </View>
      </ScrollView>
    );
  }, [gameState.achievements, achievementProgress]);
  
  const renderComparisonTab = useCallback(() => {
    // Mock percentile rankings based on stats
    const calculatePercentile = (value: number, max: number) => {
      return Math.min(99, Math.round((value / max) * 100));
    };
    
    const rankings = [
      { 
        label: 'Net Worth', 
        percentile: calculatePercentile(currentNetWorth, 10000000),
        icon: DollarSign,
        color: '#10B981',
      },
      { 
        label: 'Career Success', 
        percentile: calculatePercentile(stats.totalWeeksWorked * 100 + careerSummary.totalEarnings / 1000, 100000),
        icon: Briefcase,
        color: '#3B82F6',
      },
      { 
        label: 'Social Life', 
        percentile: calculatePercentile(stats.totalRelationships * 10 + stats.totalPostsMade, 500),
        icon: Users,
        color: '#EC4899',
      },
      { 
        label: 'Achievements', 
        percentile: achievementProgress.percentage,
        icon: Trophy,
        color: '#F59E0B',
      },
      { 
        label: 'Properties', 
        percentile: calculatePercentile(stats.totalPropertiesOwned, 20),
        icon: Home,
        color: '#8B5CF6',
      },
      { 
        label: 'Travel', 
        percentile: calculatePercentile(stats.totalTravelDestinations, 15),
        icon: Plane,
        color: '#06B6D4',
      },
    ];
    
    return (
      <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Your Rankings</Text>
          <Text style={styles.sectionSubtitle}>See how you compare to other players</Text>
          
          {rankings.map((ranking, index) => {
            const Icon = ranking.icon;
            return (
              <View key={index} style={styles.rankingItem}>
                <LinearGradient
                  colors={['#1F2937', '#111827']}
                  style={styles.rankingGradient}
                >
                  <View style={styles.rankingHeader}>
                    <View style={[styles.rankingIcon, { backgroundColor: `${ranking.color}20` }]}>
                      <Icon size={scale(20)} color={ranking.color} />
                    </View>
                    <Text style={styles.rankingLabel}>{ranking.label}</Text>
                    <Text style={[styles.rankingPercentile, { color: ranking.color }]}>
                      Top {100 - ranking.percentile}%
                    </Text>
                  </View>
                  <ProgressBar
                    progress={ranking.percentile}
                    color={ranking.color}
                    showPercentage={false}
                  />
                </LinearGradient>
              </View>
            );
          })}
        </View>
        
        {/* Overall Score */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Overall Score</Text>
          <View style={styles.overallScore}>
            <LinearGradient
              colors={['#F59E0B', '#D97706']}
              style={styles.overallScoreGradient}
            >
              <Crown size={scale(40)} color="#FFFFFF" />
              <Text style={styles.overallScoreValue}>
                {Math.round(rankings.reduce((sum, r) => sum + r.percentile, 0) / rankings.length)}
              </Text>
              <Text style={styles.overallScoreLabel}>Player Score</Text>
            </LinearGradient>
          </View>
        </View>

        {/* Past Lives Comparison */}
        {gameState.pastLives && gameState.pastLives.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Past Lives Comparison</Text>
            <Text style={styles.sectionSubtitle}>Compare your current life to previous ones</Text>
            
            <View style={styles.pastLivesGrid}>
              <View style={[styles.pastLifeCard, styles.currentLifeCard]}>
                <LinearGradient
                  colors={['#10B981', '#059669']}
                  style={styles.pastLifeGradient}
                >
                  <Text style={styles.pastLifeLabel}>Current Life</Text>
                  <Text style={styles.pastLifeValue}>{formatStatMoney(currentNetWorth)}</Text>
                  <Text style={styles.pastLifeWeeks}>Week {gameState.week || 0}</Text>
                </LinearGradient>
              </View>

              {(gameState.pastLives || []).slice(-3).reverse().map((pastLife: any, index: number) => (
                <View key={index} style={styles.pastLifeCard}>
                  <LinearGradient
                    colors={['#1F2937', '#111827']}
                    style={styles.pastLifeGradient}
                  >
                    <Text style={styles.pastLifeLabel}>Life #{gameState.pastLives!.length - index}</Text>
                    <Text style={styles.pastLifeValue}>
                      {formatStatMoney(pastLife.finalNetWorth || pastLife.peakNetWorth || 0)}
                    </Text>
                    <Text style={styles.pastLifeWeeks}>
                      {pastLife.weeksLived || 0} weeks
                    </Text>
                  </LinearGradient>
                </View>
              ))}
            </View>

            {/* Improvement indicator */}
            {gameState.pastLives && gameState.pastLives.length > 0 && (
              <View style={styles.improvementCard}>
                <TrendingUp size={scale(20)} color={currentNetWorth > (gameState.pastLives[gameState.pastLives.length - 1]?.finalNetWorth || 0) ? '#10B981' : '#EF4444'} />
                <Text style={[
                  styles.improvementText,
                  { color: currentNetWorth > (gameState.pastLives[gameState.pastLives.length - 1]?.finalNetWorth || 0) ? '#10B981' : '#EF4444' }
                ]}>
                  {currentNetWorth > (gameState.pastLives[gameState.pastLives.length - 1]?.finalNetWorth || 0) 
                    ? 'Doing better than your last life!' 
                    : 'Keep going to surpass your last life!'}
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Export Statistics */}
        <View style={styles.section}>
          <TouchableOpacity 
            style={styles.exportButton}
            onPress={() => {
              const statsText = `
🎮 DeepLifeSim Statistics
━━━━━━━━━━━━━━━━━━━━
💰 Net Worth: ${formatStatMoney(currentNetWorth)}
📈 Peak: ${formatStatMoney(stats.peakNetWorth)}
💵 Total Earned: ${formatStatMoney(stats.totalMoneyEarned)}
💸 Total Spent: ${formatStatMoney(stats.totalMoneySpent)}
━━━━━━━━━━━━━━━━━━━━
🏢 Companies: ${stats.totalCompaniesOwned}
🏠 Properties: ${stats.totalPropertiesOwned}
✈️ Destinations: ${stats.totalTravelDestinations}
👥 Relationships: ${stats.totalRelationships}
🏆 Achievements: ${achievementProgress.unlocked}/${achievementProgress.total}
━━━━━━━━━━━━━━━━━━━━
Week ${gameState.week || 0}
              `.trim();
              
              // Copy to clipboard (simplified - in production would use Clipboard API)
              // Statistics text prepared for clipboard (would use Clipboard API in production)
              // Could add a toast notification here
            }}
          >
            <LinearGradient
              colors={['#6366F1', '#8B5CF6']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.exportButtonGradient}
            >
              <BarChart3 size={scale(18)} color="#FFFFFF" />
              <Text style={styles.exportButtonText}>Copy Statistics</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }, [currentNetWorth, stats, careerSummary, achievementProgress, gameState.pastLives, gameState.week]);
  
  const renderContent = useCallback(() => {
    switch (activeTab) {
      case 'overview':
        return renderOverviewTab();
      case 'career':
        return renderCareerTab();
      case 'relationships':
        return renderRelationshipsTab();
      case 'achievements':
        return renderAchievementsTab();
      case 'comparison':
        return renderComparisonTab();
      default:
        return renderOverviewTab();
    }
  }, [activeTab, renderOverviewTab, renderCareerTab, renderRelationshipsTab, renderAchievementsTab, renderComparisonTab]);
  
  return (
    <LinearGradient
      colors={settings.darkMode ? ['#0F172A', '#1E293B'] : ['#F8FAFC', '#E2E8F0']}
      style={styles.container}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <ArrowLeft size={scale(24)} color="#FFFFFF" />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <BarChart3 size={scale(24)} color="#10B981" />
          <Text style={styles.headerTitle}>Statistics</Text>
        </View>
        <View style={styles.headerRight} />
      </View>
      
      {/* Tab Bar */}
      <View style={styles.tabBar}>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabBarContent}
        >
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <TouchableOpacity
                key={tab.id}
                style={[styles.tab, isActive && styles.tabActive]}
                onPress={() => setActiveTab(tab.id)}
              >
                <Icon 
                  size={scale(18)} 
                  color={isActive ? '#10B981' : '#6B7280'} 
                />
                <Text style={[styles.tabText, isActive && styles.tabTextActive]}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
      
      {/* Content */}
      {renderContent()}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: scale(16),
    paddingTop: scale(12),
    paddingBottom: scale(12),
  },
  backButton: {
    width: scale(40),
    height: scale(40),
    borderRadius: scale(20),
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(8),
  },
  headerTitle: {
    fontSize: fontScale(20),
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  headerRight: {
    width: scale(40),
  },
  tabBar: {
    paddingHorizontal: scale(8),
    paddingBottom: scale(8),
  },
  tabBarContent: {
    flexDirection: 'row',
    gap: scale(8),
    paddingHorizontal: scale(8),
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(6),
    paddingHorizontal: scale(12),
    paddingVertical: scale(8),
    borderRadius: scale(20),
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  tabActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
  },
  tabText: {
    fontSize: fontScale(13),
    color: '#6B7280',
    fontWeight: '500',
  },
  tabTextActive: {
    color: '#10B981',
  },
  tabContent: {
    flex: 1,
    paddingHorizontal: scale(16),
  },
  section: {
    marginBottom: scale(24),
  },
  sectionTitle: {
    fontSize: fontScale(18),
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: scale(12),
  },
  sectionSubtitle: {
    fontSize: fontScale(14),
    color: '#9CA3AF',
    marginTop: scale(-8),
    marginBottom: scale(12),
  },
  netWorthCard: {
    borderRadius: scale(16),
    overflow: 'hidden',
    marginBottom: scale(16),
  },
  netWorthGradient: {
    padding: scale(20),
    alignItems: 'center',
  },
  netWorthLabel: {
    fontSize: fontScale(14),
    color: 'rgba(255,255,255,0.8)',
    marginBottom: scale(4),
  },
  netWorthValue: {
    fontSize: fontScale(32),
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: scale(12),
  },
  netWorthStats: {
    flexDirection: 'row',
    gap: scale(20),
  },
  netWorthStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(6),
  },
  netWorthStatText: {
    fontSize: fontScale(13),
    color: 'rgba(255,255,255,0.9)',
  },
  chartContainer: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: scale(12),
    padding: scale(16),
  },
  chartTitle: {
    fontSize: fontScale(14),
    color: '#9CA3AF',
    marginBottom: scale(12),
  },
  chartEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderRadius: scale(8),
  },
  chartEmptyText: {
    fontSize: fontScale(14),
    color: '#6B7280',
    marginBottom: scale(4),
  },
  chartEmptySubtext: {
    fontSize: fontScale(12),
    color: '#4B5563',
  },
  gridLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  chartLabel: {
    position: 'absolute',
    fontSize: fontScale(10),
    color: '#6B7280',
  },
  dataPoint: {
    position: 'absolute',
    width: scale(8),
    height: scale(8),
    borderRadius: scale(4),
  },
  chartLine: {
    position: 'absolute',
    height: 2,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: scale(12),
  },
  statCard: {
    width: (screenWidth - scale(44)) / 2,
    borderRadius: scale(12),
    overflow: 'hidden',
  },
  statCardGradient: {
    padding: scale(16),
    alignItems: 'center',
  },
  statIconContainer: {
    width: scale(40),
    height: scale(40),
    borderRadius: scale(20),
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: scale(8),
  },
  statLabel: {
    fontSize: fontScale(12),
    color: '#9CA3AF',
    marginBottom: scale(4),
  },
  statValue: {
    fontSize: fontScale(18),
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  statSubValue: {
    fontSize: fontScale(11),
    color: '#6B7280',
    marginTop: scale(2),
  },
  summaryCard: {
    borderRadius: scale(16),
    overflow: 'hidden',
  },
  summaryGradient: {
    padding: scale(20),
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  summaryItem: {
    alignItems: 'center',
  },
  summaryValue: {
    fontSize: fontScale(20),
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginTop: scale(8),
  },
  summaryLabel: {
    fontSize: fontScale(11),
    color: '#9CA3AF',
    marginTop: scale(4),
  },
  highlightCard: {
    borderRadius: scale(12),
    overflow: 'hidden',
  },
  highlightGradient: {
    padding: scale(16),
  },
  highlightItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(12),
    paddingVertical: scale(8),
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  highlightText: {
    flex: 1,
  },
  highlightLabel: {
    fontSize: fontScale(12),
    color: '#9CA3AF',
  },
  highlightValue: {
    fontSize: fontScale(14),
    color: '#FFFFFF',
    fontWeight: '500',
  },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: scale(12),
    paddingLeft: scale(12),
    borderLeftWidth: 2,
    borderLeftColor: 'rgba(59, 130, 246, 0.3)',
    marginLeft: scale(8),
  },
  historyDot: {
    width: scale(10),
    height: scale(10),
    borderRadius: scale(5),
    backgroundColor: '#3B82F6',
    position: 'absolute',
    left: scale(-6),
    top: scale(16),
  },
  historyContent: {
    flex: 1,
    marginLeft: scale(16),
  },
  historyTitle: {
    fontSize: fontScale(14),
    fontWeight: '600',
    color: '#FFFFFF',
  },
  historySubtitle: {
    fontSize: fontScale(12),
    color: '#9CA3AF',
    marginTop: scale(2),
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: scale(40),
  },
  emptyStateText: {
    fontSize: fontScale(16),
    color: '#6B7280',
    marginTop: scale(12),
  },
  emptyStateSubtext: {
    fontSize: fontScale(13),
    color: '#4B5563',
    marginTop: scale(4),
  },
  progressContainer: {
    marginTop: scale(8),
  },
  progressLabel: {
    fontSize: fontScale(12),
    color: '#9CA3AF',
    marginBottom: scale(6),
  },
  progressBarBg: {
    height: scale(8),
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: scale(4),
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: scale(4),
  },
  progressPercentage: {
    fontSize: fontScale(12),
    color: '#9CA3AF',
    marginTop: scale(4),
    textAlign: 'right',
  },
  achievementProgress: {
    borderRadius: scale(16),
    overflow: 'hidden',
  },
  achievementProgressGradient: {
    padding: scale(20),
  },
  achievementProgressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(16),
    marginBottom: scale(16),
  },
  achievementProgressText: {
    flex: 1,
  },
  achievementProgressValue: {
    fontSize: fontScale(24),
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  achievementProgressLabel: {
    fontSize: fontScale(13),
    color: '#9CA3AF',
  },
  achievementItem: {
    marginBottom: scale(8),
    borderRadius: scale(12),
    overflow: 'hidden',
  },
  achievementLocked: {
    opacity: 0.6,
  },
  achievementItemGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: scale(12),
    gap: scale(12),
  },
  achievementIcon: {
    width: scale(40),
    height: scale(40),
    borderRadius: scale(20),
    alignItems: 'center',
    justifyContent: 'center',
  },
  achievementContent: {
    flex: 1,
  },
  achievementName: {
    fontSize: fontScale(14),
    fontWeight: '600',
    color: '#FFFFFF',
  },
  achievementDesc: {
    fontSize: fontScale(12),
    color: '#9CA3AF',
    marginTop: scale(2),
  },
  achievementUnlocked: {
    width: scale(24),
    height: scale(24),
    borderRadius: scale(12),
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankingItem: {
    marginBottom: scale(12),
    borderRadius: scale(12),
    overflow: 'hidden',
  },
  rankingGradient: {
    padding: scale(16),
  },
  rankingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(12),
    marginBottom: scale(12),
  },
  rankingIcon: {
    width: scale(36),
    height: scale(36),
    borderRadius: scale(18),
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankingLabel: {
    flex: 1,
    fontSize: fontScale(14),
    fontWeight: '600',
    color: '#FFFFFF',
  },
  rankingPercentile: {
    fontSize: fontScale(14),
    fontWeight: 'bold',
  },
  overallScore: {
    borderRadius: scale(16),
    overflow: 'hidden',
  },
  overallScoreGradient: {
    padding: scale(32),
    alignItems: 'center',
  },
  overallScoreValue: {
    fontSize: fontScale(48),
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginTop: scale(12),
  },
  overallScoreLabel: {
    fontSize: fontScale(14),
    color: 'rgba(255,255,255,0.8)',
    marginTop: scale(4),
  },
  pastLivesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: scale(12),
    marginTop: scale(12),
  },
  pastLifeCard: {
    width: (screenWidth - scale(88)) / 2,
    borderRadius: scale(16),
    overflow: 'hidden',
  },
  currentLifeCard: {
    width: '100%',
  },
  pastLifeGradient: {
    padding: scale(16),
    alignItems: 'center',
  },
  pastLifeLabel: {
    fontSize: fontScale(12),
    color: 'rgba(255,255,255,0.7)',
    marginBottom: scale(4),
  },
  pastLifeValue: {
    fontSize: fontScale(18),
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  pastLifeWeeks: {
    fontSize: fontScale(11),
    color: 'rgba(255,255,255,0.6)',
    marginTop: scale(4),
  },
  improvementCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(8),
    backgroundColor: 'rgba(16,185,129,0.1)',
    padding: scale(12),
    borderRadius: scale(12),
    marginTop: scale(12),
  },
  improvementText: {
    fontSize: fontScale(14),
    fontWeight: '500',
    flex: 1,
  },
  exportButton: {
    borderRadius: scale(12),
    overflow: 'hidden',
  },
  exportButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: scale(8),
    paddingVertical: scale(14),
  },
  exportButtonText: {
    fontSize: fontScale(15),
    fontWeight: '600',
    color: '#FFFFFF',
  },
  systemHealthCard: {
    borderRadius: scale(12),
    overflow: 'hidden',
    marginBottom: scale(12),
  },
  systemHealthGradient: {
    padding: scale(16),
  },
  systemHealthHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: scale(8),
  },
  systemHealthName: {
    fontSize: fontScale(16),
    fontWeight: '600',
    color: '#FFFFFF',
    flex: 1,
  },
  systemHealthBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(4),
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: scale(8),
    paddingVertical: scale(4),
    borderRadius: scale(12),
  },
  systemHealthTrend: {
    fontSize: fontScale(11),
    color: '#FFFFFF',
    textTransform: 'capitalize',
  },
  systemHealthBar: {
    height: scale(8),
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: scale(4),
    overflow: 'hidden',
    marginBottom: scale(8),
  },
  systemHealthFill: {
    height: '100%',
    borderRadius: scale(4),
  },
  systemHealthValue: {
    fontSize: fontScale(14),
    fontWeight: '600',
    color: '#FFFFFF',
  },
  systemStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: scale(8),
    paddingTop: scale(8),
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  systemStatText: {
    fontSize: fontScale(11),
    color: 'rgba(255,255,255,0.7)',
  },
  interconnectionCard: {
    borderRadius: scale(12),
    overflow: 'hidden',
    marginBottom: scale(12),
  },
  interconnectionGradient: {
    padding: scale(16),
  },
  interconnectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(8),
    marginBottom: scale(8),
  },
  interconnectionSource: {
    fontSize: fontScale(14),
    fontWeight: '600',
    color: '#3B82F6',
  },
  interconnectionTarget: {
    fontSize: fontScale(14),
    fontWeight: '600',
    color: '#FFFFFF',
  },
  interconnectionDesc: {
    fontSize: fontScale(12),
    color: 'rgba(255,255,255,0.7)',
    lineHeight: fontScale(16),
  },
  sectionSubtitle: {
    fontSize: fontScale(12),
    color: '#9CA3AF',
    marginBottom: scale(16),
  },
});

