import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import LinearGradientFallback from '@/components/fallbacks/LinearGradientFallback';
const LinearGradient = LinearGradientFallback;
import { useGame } from '@/contexts/GameContext';
import { getInflatedPrice } from '@/lib/economy/inflation';
import { 
  Zap, 
  DollarSign, 
  Heart, 
  TrendingUp, 
  Shield, 
  AlertTriangle, 
  BookOpen, 
  Wrench, 
  Lock, 
  Gavel, 
  Clock,
  Calendar,
  BarChart3,
  X,
  Utensils,
  Brain,
  Dumbbell,
  Flower2,
  Smile
} from 'lucide-react-native';

interface JailScreenProps {
  onClose?: () => void;
}

export default function JailScreen({ onClose }: JailScreenProps) {
  const { gameState, performJailActivity, payBail, buyFood, updateStats } = useGame();
  const { jailActivities, jailWeeks, stats, foods, economy } = gameState;
  const [selectedActivity, setSelectedActivity] = useState<string | null>(null);
  const [activityCooldowns, setActivityCooldowns] = useState<Record<string, number>>({});
  const [currentTime, setCurrentTime] = useState(Date.now());

  // Update current time every second for real-time cooldown display
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const bailCost = jailWeeks * 500;

  const handlePayBail = () => {
    if (stats.money >= bailCost) {
      payBail();
      Alert.alert('Bail Posted', 'You have been released from jail!');
      if (onClose) onClose();
    } else {
      Alert.alert('Insufficient Funds', `You need $${bailCost} to post bail.`);
    }
  };

  const handleActivity = (activityId: string) => {
    const activity = jailActivities.find(a => a.id === activityId);
    if (!activity) return;
    
    // Check if already done this week
    const weeklyActivities = gameState.weeklyJailActivities || {};
    const currentWeek = gameState.date.week;
    const lastDoneWeek = weeklyActivities[activityId];
    if (lastDoneWeek === currentWeek) {
      Alert.alert(
        'Activity Already Done',
        `You've already completed "${activity.name}" this week. Advance to next week to do more activities.`,
        [{ text: 'OK' }]
      );
      return;
    }
    
    // Check energy
    if (stats.energy < activity.energyCost) {
      Alert.alert(
        'Not Enough Energy',
        `You need ${activity.energyCost} energy to perform this activity. You currently have ${stats.energy} energy.`
      );
      return;
    }
    
    // Check cost
    if (activity.cost && stats.money < activity.cost) {
      Alert.alert(
        'Insufficient Funds',
        `This activity costs $${activity.cost}. You currently have $${stats.money}.`
      );
      return;
    }
    
    // Check if requires minimum weeks remaining
    if (activity.requiresWeeks && jailWeeks < activity.requiresWeeks) {
      Alert.alert(
        'Requirement Not Met',
        `This activity requires at least ${activity.requiresWeeks} weeks remaining in jail. You have ${jailWeeks} weeks remaining.`
      );
      return;
    }
    
    // Check cooldown
    const cooldownTime = 2000;
    const lastUsed = activityCooldowns[activityId] || 0;
    if (currentTime - lastUsed < cooldownTime) {
      const remainingTime = Math.ceil((cooldownTime - (currentTime - lastUsed)) / 1000);
      Alert.alert('Cooldown', `Please wait ${remainingTime} second(s) before trying again.`);
      return;
    }

    // Check if this activity will complete the sentence
    if (activity.sentenceReduction && jailWeeks <= activity.sentenceReduction) {
      Alert.alert(
        'Final Activity',
        'This activity will complete your sentence and release you from jail!',
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Continue', 
            onPress: () => {
              setActivityCooldowns(prev => ({
                ...prev,
                [activityId]: currentTime
              }));
              const result = performJailActivity(activityId);
              if (result) {
                const title = result.success ? 'âœ… Activity Completed' : 'âŒ Activity Failed';
                Alert.alert(title, result.message);
              }
            }
          }
        ]
      );
      return;
    }

    // Set cooldown
    setActivityCooldowns(prev => ({
      ...prev,
      [activityId]: currentTime
    }));

    const result = performJailActivity(activityId);
    if (result) {
      const title = result.success ? 'âœ… Activity Completed' : 'âŒ Activity Failed';
      Alert.alert(title, result.message);
    }
  };

  const getActivityIcon = (activityId: string) => {
    switch (activityId) {
      case 'prison_job': return DollarSign;
      case 'library_study': return BookOpen;
      case 'prison_workshop': return Wrench;
      case 'legal_appeal': return Gavel;
      case 'good_behavior': return Shield;
      case 'prison_meditation': return Brain;
      case 'prison_exercise': return Dumbbell;
      case 'prison_yoga': return Flower2;
      default: return Zap;
    }
  };

  const getActivityColor = (activityId: string) => {
    switch (activityId) {
      case 'prison_job': return ['#10B981', '#34D399'];
      case 'library_study': return ['#8B5CF6', '#A78BFA'];
      case 'prison_workshop': return ['#F59E0B', '#FBBF24'];
      case 'legal_appeal': return ['#1F2937', '#6B7280'];
      case 'good_behavior': return ['#059669', '#34D399'];
      case 'prison_meditation': return ['#6366F1', '#818CF8'];
      case 'prison_exercise': return ['#EF4444', '#F87171'];
      case 'prison_yoga': return ['#EC4899', '#F472B6'];
      default: return ['#6B7280', '#9CA3AF'];
    }
  };

  const canPerformActivity = (activity: any) => {
    if (stats.energy < activity.energyCost) return false;
    if (activity.cost && stats.money < activity.cost) return false;
    if (activity.requiresEducation) {
      const hasEducation = gameState.educations.find(e => e.id === activity.requiresEducation)?.completed;
      if (!hasEducation) return false;
    }
    // Check if requires minimum weeks remaining in jail
    if (activity.requiresWeeks && jailWeeks < activity.requiresWeeks) return false;
    
    // Check if already done this week
    const weeklyActivities = gameState.weeklyJailActivities || {};
    const currentWeek = gameState.date.week;
    const lastDoneWeek = weeklyActivities[activity.id];
    if (lastDoneWeek === currentWeek) return false;
    
    // Check cooldown
    const cooldownTime = 2000; // 2 seconds cooldown
    const lastUsed = activityCooldowns[activity.id] || 0;
    if (currentTime - lastUsed < cooldownTime) return false;
    
    return true;
  };

  const isActivityOnCooldown = (activityId: string) => {
    const cooldownTime = 2000;
    const lastUsed = activityCooldowns[activityId] || 0;
    return currentTime - lastUsed < cooldownTime;
  };

  const getCooldownRemaining = (activityId: string) => {
    const cooldownTime = 2000;
    const lastUsed = activityCooldowns[activityId] || 0;
    const remaining = cooldownTime - (currentTime - lastUsed);
    return Math.ceil(remaining / 1000);
  };

  const isActivityDoneThisWeek = (activityId: string) => {
    const weeklyActivities = gameState.weeklyJailActivities || {};
    const currentWeek = gameState.date.week;
    const lastDoneWeek = weeklyActivities[activityId];
    return lastDoneWeek === currentWeek;
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#1F2937', '#111827']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.background}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Lock size={24} color="#EF4444" />
            <Text style={styles.headerTitle}>PRISON</Text>
          </View>
          {onClose && (
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <X size={20} color="#FFFFFF" />
            </TouchableOpacity>
          )}
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Prison Status */}
          <View style={styles.statusCard}>
            <LinearGradient
              colors={['#DC2626', '#EF4444']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.statusGradient}
            >
              <View style={styles.statusHeader}>
                <Calendar size={20} color="#FFFFFF" />
                <Text style={styles.statusTitle}>Sentence Status</Text>
              </View>
              <View style={styles.statusInfo}>
                <View style={styles.statusItem}>
                  <Clock size={16} color="#FFFFFF" />
                  <Text style={styles.statusText}>{jailWeeks} weeks remaining</Text>
                </View>
                <View style={styles.statusItem}>
                  <DollarSign size={16} color="#FFFFFF" />
                  <Text style={styles.statusText}>Bail: ${bailCost}</Text>
                </View>
              </View>
            </LinearGradient>
          </View>

          {/* Bail Section */}
          <View style={styles.bailCard}>
            <Text style={styles.sectionTitle}>Post Bail</Text>
            <Text style={styles.sectionDescription}>
              Pay ${bailCost} to be released immediately
            </Text>
            <TouchableOpacity
              onPress={handlePayBail}
              disabled={stats.money < bailCost}
              style={styles.bailButton}
            >
              <LinearGradient
                colors={stats.money < bailCost ? ['#6B7280', '#4B5563'] : ['#10B981', '#34D399']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.bailButtonGradient}
              >
                <Text style={styles.bailButtonText}>
                  {stats.money < bailCost ? 'Insufficient Funds' : `Pay Bail $${bailCost}`}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>

          {/* Prison Food Section */}
          <View style={styles.foodSection}>
            <View style={styles.foodSectionHeader}>
              <Utensils size={20} color="#F59E0B" />
              <Text style={styles.sectionTitle}>Prison Canteen</Text>
            </View>
            <Text style={styles.sectionDescription}>
              Buy food to restore health and happiness. Prices are 2x inflated in prison, and benefits are reduced.
            </Text>
            
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              style={styles.foodScrollView}
              contentContainerStyle={styles.foodScrollContent}
            >
              {foods.slice(0, 6).map(food => {
                // Prison food prices are 2x inflated (prison markup)
                const basePrice = getInflatedPrice(food.price, economy?.priceIndex || 1);
                const price = Math.round(basePrice * 2);
                const canAfford = stats.money >= price;
                // Prison food gives less happiness (only 25% of health restore, minimum 1)
                const happinessRestore = Math.max(1, Math.round(food.healthRestore * 0.25));
                // Prison food gives less health (75% of normal)
                const healthRestore = Math.round(food.healthRestore * 0.75);
                
                return (
                  <TouchableOpacity
                    key={food.id}
                    onPress={() => {
                      if (!canAfford) {
                        Alert.alert('Insufficient Funds', `You need $${price} to buy ${food.name}.`);
                        return;
                      }
                      // Use custom prison food handler with reduced benefits
                      const foodItem = foods.find(f => f.id === food.id);
                      if (foodItem) {
                        updateStats({
                          money: -price,
                          health: healthRestore,
                          energy: foodItem.energyRestore,
                          happiness: happinessRestore,
                        }, false);
                        Alert.alert(
                          'Food Purchased',
                          `You ate ${food.name}!\n+${healthRestore} Health\n+${happinessRestore} Happiness\n+${foodItem.energyRestore} Energy`
                        );
                      }
                    }}
                    disabled={!canAfford}
                    style={styles.foodCard}
                  >
                    <LinearGradient
                      colors={canAfford ? ['#1F2937', '#374151'] : ['#111827', '#1F2937']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.foodCardGradient}
                    >
                      <View style={styles.foodCardHeader}>
                        <Utensils size={16} color={canAfford ? '#F59E0B' : '#6B7280'} />
                        <Text style={[styles.foodPrice, !canAfford && styles.disabledText]}>
                          ${price}
                        </Text>
                      </View>
                      
                      <Text style={[styles.foodName, !canAfford && styles.disabledText]}>
                        {food.name}
                      </Text>
                      
                      <View style={styles.foodBenefits}>
                        <View style={styles.foodBenefitItem}>
                          <Heart size={12} color="#EF4444" />
                          <Text style={styles.foodBenefitText}>+{healthRestore}</Text>
                        </View>
                        <View style={styles.foodBenefitItem}>
                          <TrendingUp size={12} color="#10B981" />
                          <Text style={styles.foodBenefitText}>+{happinessRestore}</Text>
                        </View>
                        <View style={styles.foodBenefitItem}>
                          <Zap size={12} color="#FCD34D" />
                          <Text style={styles.foodBenefitText}>+{food.energyRestore}</Text>
                        </View>
                      </View>
                    </LinearGradient>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* Prison Activities */}
          <View style={styles.activitiesSection}>
            <Text style={styles.sectionTitle}>Prison Activities</Text>
            <Text style={styles.sectionDescription}>
              Each activity can be done once per week. Advance to next week to do more activities.
            </Text>

            <View style={styles.activitiesGrid}>
              {jailActivities.map(activity => {
                const Icon = getActivityIcon(activity.id);
                const colors = getActivityColor(activity.id);
                const canPerform = canPerformActivity(activity);
                const onCooldown = isActivityOnCooldown(activity.id);
                const doneThisWeek = isActivityDoneThisWeek(activity.id);

                return (
                  <TouchableOpacity
                    key={activity.id}
                    onPress={() => handleActivity(activity.id)}
                    style={styles.activityCard}
                  >
                    <LinearGradient
                      colors={canPerform && !onCooldown && !doneThisWeek ? (colors as [string, string]) : ['#374151', '#1F2937'] as [string, string]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.activityGradient}
                    >
                      <View style={styles.activityHeader}>
                        <Icon size={20} color={canPerform && !onCooldown && !doneThisWeek ? '#FFFFFF' : '#6B7280'} />
                        <View style={styles.energyCost}>
                          <Zap size={12} color={canPerform && !onCooldown && !doneThisWeek ? '#FFFFFF' : '#6B7280'} />
                          <Text style={[styles.energyText, (!canPerform || onCooldown || doneThisWeek) && styles.disabledText]}>
                            {activity.energyCost}
                          </Text>
                        </View>
                      </View>
                      
                      <Text style={[styles.activityName, (!canPerform || onCooldown || doneThisWeek) && styles.disabledText]}>
                        {activity.name}
                      </Text>
                      
                      <Text style={[styles.activityDescription, (!canPerform || onCooldown || doneThisWeek) && styles.disabledText]}>
                        {activity.description}
                      </Text>

                      {/* Cooldown indicator */}
                      {onCooldown && (
                        <View style={styles.cooldownIndicator}>
                          <Clock size={12} color="#FCD34D" />
                          <Text style={styles.cooldownText}>
                            {getCooldownRemaining(activity.id)}s
                          </Text>
                        </View>
                      )}

                      {/* Done this week indicator */}
                      {doneThisWeek && (
                        <View style={styles.doneThisWeekIndicator}>
                          <Calendar size={12} color="#10B981" />
                          <Text style={styles.doneThisWeekText}>
                            Done this week
                          </Text>
                        </View>
                      )}

                      <View style={styles.activityRewards}>
                        {activity.payment && (
                          <View style={styles.rewardItem}>
                            <DollarSign size={12} color="#FFFFFF" />
                            <Text style={styles.rewardText}>+${activity.payment}</Text>
                          </View>
                        )}
                        {activity.sentenceReduction && (
                          <View style={styles.rewardItem}>
                            <Shield size={12} color="#FFFFFF" />
                            <Text style={styles.rewardText}>-{activity.sentenceReduction}w</Text>
                          </View>
                        )}
                        {activity.fitnessGain && (
                          <View style={styles.rewardItem}>
                            <TrendingUp size={12} color="#FFFFFF" />
                            <Text style={styles.rewardText}>+{activity.fitnessGain}</Text>
                          </View>
                        )}
                        {activity.healthGain && (
                          <View style={styles.rewardItem}>
                            <Heart size={12} color="#FFFFFF" />
                            <Text style={styles.rewardText}>+{activity.healthGain} Health</Text>
                          </View>
                        )}
                        {activity.happinessGain && (
                          <View style={styles.rewardItem}>
                            <Smile size={12} color="#FFFFFF" />
                            <Text style={styles.rewardText}>+{activity.happinessGain} Happiness</Text>
                          </View>
                        )}
                      </View>

                      {activity.cost && (
                        <View style={styles.costIndicator}>
                          <Text style={styles.costText}>Cost: ${activity.cost}</Text>
                        </View>
                      )}
                    </LinearGradient>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Prison Stats */}
          <View style={styles.statsCard}>
            <Text style={styles.sectionTitle}>Prison Stats</Text>
            <View style={styles.statsGrid}>
              <View style={styles.statItem}>
                <BarChart3 size={16} color="#10B981" />
                <Text style={styles.statLabel}>Energy</Text>
                <Text style={styles.statValue}>{stats.energy}/100</Text>
              </View>
              <View style={styles.statItem}>
                <Heart size={16} color="#EF4444" />
                <Text style={styles.statLabel}>Health</Text>
                <Text style={styles.statValue}>{stats.health}/100</Text>
              </View>
              <View style={styles.statItem}>
                <TrendingUp size={16} color="#3B82F6" />
                <Text style={styles.statLabel}>Fitness</Text>
                <Text style={styles.statValue}>{stats.fitness}/100</Text>
              </View>
              <View style={styles.statItem}>
                <DollarSign size={16} color="#F59E0B" />
                <Text style={styles.statLabel}>Money</Text>
                <Text style={styles.statValue}>${stats.money.toLocaleString()}</Text>
              </View>
            </View>
          </View>
        </ScrollView>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  background: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#374151',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginLeft: 10,
  },
  closeButton: {
    padding: 8,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  statusCard: {
    marginTop: 20,
    borderRadius: 12,
    overflow: 'hidden',
  },
  statusGradient: {
    padding: 20,
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  statusTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginLeft: 10,
  },
  statusInfo: {
    gap: 10,
  },
  statusItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusText: {
    fontSize: 16,
    color: '#FFFFFF',
    marginLeft: 8,
  },
  bailCard: {
    backgroundColor: '#1F2937',
    borderRadius: 12,
    padding: 20,
    marginTop: 20,
    borderWidth: 1,
    borderColor: '#374151',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  sectionDescription: {
    fontSize: 14,
    color: '#9CA3AF',
    marginBottom: 15,
    lineHeight: 20,
  },
  bailButton: {
    borderRadius: 8,
    overflow: 'hidden',
  },
  bailButtonGradient: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  bailButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  activitiesSection: {
    marginTop: 20,
  },
  activitiesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginTop: 15,
  },
  activityCard: {
    width: '48%',
    marginBottom: 15,
    borderRadius: 12,
    overflow: 'hidden',
  },
  activityGradient: {
    padding: 15,
    minHeight: 140,
  },
  activityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  energyCost: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  energyText: {
    fontSize: 12,
    color: '#FFFFFF',
    marginLeft: 4,
  },
  activityName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 6,
  },
  activityDescription: {
    fontSize: 11,
    color: '#E5E7EB',
    marginBottom: 10,
    lineHeight: 14,
  },
  activityRewards: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 8,
  },
  rewardItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  rewardText: {
    fontSize: 10,
    color: '#FFFFFF',
    marginLeft: 2,
  },
  costIndicator: {
    position: 'absolute',
    bottom: 8,
    right: 8,
  },
  costText: {
    fontSize: 10,
    color: '#FCD34D',
    fontWeight: 'bold',
  },
  disabledText: {
    color: '#6B7280',
  },
  cooldownIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'absolute',
    bottom: 8,
    left: 8,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  cooldownText: {
    fontSize: 10,
    color: '#FCD34D',
    marginLeft: 4,
  },
  doneThisWeekIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'absolute',
    bottom: 8,
    left: 8,
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#10B981',
  },
  doneThisWeekText: {
    fontSize: 10,
    color: '#10B981',
    marginLeft: 4,
    fontWeight: 'bold',
  },
  statsCard: {
    backgroundColor: '#1F2937',
    borderRadius: 12,
    padding: 20,
    marginTop: 20,
    marginBottom: 30,
    borderWidth: 1,
    borderColor: '#374151',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginTop: 15,
  },
  statItem: {
    width: '48%',
    alignItems: 'center',
    paddingVertical: 12,
    backgroundColor: '#374151',
    borderRadius: 8,
    marginBottom: 10,
  },
  statLabel: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 4,
  },
  statValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginTop: 2,
  },
  foodSection: {
    marginTop: 20,
  },
  foodSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  foodScrollView: {
    marginTop: 15,
  },
  foodScrollContent: {
    paddingRight: 20,
  },
  foodCard: {
    width: 140,
    marginRight: 12,
    borderRadius: 12,
    overflow: 'hidden',
  },
  foodCardGradient: {
    padding: 12,
    minHeight: 120,
  },
  foodCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  foodPrice: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#F59E0B',
  },
  foodName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 10,
  },
  foodBenefits: {
    gap: 6,
  },
  foodBenefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
  },
  foodBenefitText: {
    fontSize: 11,
    color: '#FFFFFF',
    marginLeft: 4,
    fontWeight: '500',
  },
});

