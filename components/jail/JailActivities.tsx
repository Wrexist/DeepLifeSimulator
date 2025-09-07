import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useGame } from '@/contexts/GameContext';
import { Zap, DollarSign, Heart, TrendingUp, Shield, AlertTriangle, BookOpen, Leaf, Wrench, Lock, Gavel, Users } from 'lucide-react-native';

export default function JailActivities() {
  const { gameState, performJailActivity } = useGame();
  const { jailActivities, jailWeeks, stats } = gameState;

  if (jailWeeks <= 0) {
    // No jail weeks, not rendering
    return null;
  }
  
  // Rendering jail activities

  const handlePress = (id: string) => {
    const result = performJailActivity(id);
    if (result) {
      // Enhanced popup with more details
      const title = result.success ? '✅ Success!' : '❌ Failed';
      const message = result.message;
      
      // Showing activity result alert
      Alert.alert(
        title,
        message,
        [{ text: 'OK', style: 'default' }],
        { cancelable: true }
      );
    } else {
      // No result returned from activity
    }
  };

  const getActivityIcon = (activityId: string) => {
    switch (activityId) {
      case 'prison_job': return DollarSign;
      case 'train_strength': return TrendingUp;
      case 'library_study': return BookOpen;
      case 'prison_garden': return Leaf;
      case 'prison_workshop': return Wrench;
      case 'attempt_escape': return Lock;
      case 'bribe_guard': return DollarSign;
      case 'legal_appeal': return Gavel;
      case 'good_behavior': return Shield;
      case 'prison_gang': return Users;
      default: return Zap;
    }
  };

  const getActivityColor = (activityId: string) => {
    switch (activityId) {
      case 'prison_job': return ['#10B981', '#34D399'];
      case 'train_strength': return ['#3B82F6', '#60A5FA'];
      case 'library_study': return ['#8B5CF6', '#A78BFA'];
      case 'prison_garden': return ['#059669', '#34D399'];
      case 'prison_workshop': return ['#F59E0B', '#FBBF24'];
      case 'attempt_escape': return ['#DC2626', '#F87171'];
      case 'bribe_guard': return ['#7C3AED', '#A78BFA'];
      case 'legal_appeal': return ['#1F2937', '#6B7280'];
      case 'good_behavior': return ['#059669', '#34D399'];
      case 'prison_gang': return ['#DC2626', '#F87171'];
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
    return true;
  };

  const darkMode = gameState.settings?.darkMode;

  return (
    <View style={styles.wrapper}>
      <LinearGradient
        colors={darkMode ? ['#374151', '#1F2937'] : ['#FFFFFF', '#F3F4F6']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.container}
      >
        <View style={styles.header}>
          <Text style={[styles.title, darkMode && styles.titleDark]}>Jail Activities</Text>
          <Text style={[styles.subtitle, darkMode && styles.subtitleDark]}>
            {jailWeeks} weeks remaining
          </Text>

        </View>

        <View style={styles.activitiesContainer}>
          {jailActivities.map(activity => {
            const Icon = getActivityIcon(activity.id);
            const colors = getActivityColor(activity.id);
            const canPerform = canPerformActivity(activity);

            return (
              <View key={activity.id} style={styles.activityWrapper}>
                <LinearGradient
                  colors={canPerform ? colors : ['#E5E7EB', '#D1D5DB'] as any}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.activityCard}
                >
                  <View style={styles.activityHeader}>
                    <Icon size={24} color={canPerform ? '#FFFFFF' : '#9CA3AF'} />
                    <Text style={[styles.activityName, !canPerform && styles.disabledText]}>
                      {activity.name}
                    </Text>
                    <View style={styles.energyCost}>
                      <Zap size={16} color={canPerform ? '#FFFFFF' : '#9CA3AF'} />
                      <Text style={[styles.energyText, !canPerform && styles.disabledText]}>
                        {activity.energyCost}
                      </Text>
                    </View>
                  </View>

                  <Text style={[styles.activityDescription, !canPerform && styles.disabledText]}>
                    {activity.description}
                  </Text>

                  <View style={styles.activityDetails}>
                    {activity.payment && (
                      <View style={styles.detailRow}>
                        <DollarSign size={16} color="#FFFFFF" />
                        <Text style={styles.detailText}>Earn ${activity.payment}</Text>
                      </View>
                    )}
                    {activity.sentenceReduction && (
                      <View style={styles.detailRow}>
                        <Shield size={16} color="#FFFFFF" />
                        <Text style={styles.detailText}>Reduce sentence by {activity.sentenceReduction} week(s)</Text>
                      </View>
                    )}
                    {activity.fitnessGain && (
                      <View style={styles.detailRow}>
                        <TrendingUp size={16} color="#FFFFFF" />
                        <Text style={styles.detailText}>+{activity.fitnessGain} Fitness</Text>
                      </View>
                    )}
                    {activity.healthGain && (
                      <View style={styles.detailRow}>
                        <Heart size={16} color="#FFFFFF" />
                        <Text style={styles.detailText}>+{activity.healthGain} Health</Text>
                      </View>
                    )}
                    {activity.happinessGain && (
                      <View style={styles.detailRow}>
                        <Text style={styles.detailText}>+{activity.happinessGain} Happiness</Text>
                      </View>
                    )}
                    {activity.cost && (
                      <View style={styles.detailRow}>
                        <DollarSign size={16} color="#FFFFFF" />
                        <Text style={styles.detailText}>Cost: ${activity.cost}</Text>
                      </View>
                    )}
                    {activity.successRate && (
                      <View style={styles.detailRow}>
                        <Text style={styles.detailText}>Success Rate: {Math.round(activity.successRate * 100)}%</Text>
                      </View>
                    )}
                    {activity.risk && (
                      <View style={styles.detailRow}>
                        <AlertTriangle size={16} color="#FCD34D" />
                        <Text style={styles.detailText}>Risk: {activity.risk}</Text>
                      </View>
                    )}
                  </View>

                  <TouchableOpacity
                    onPress={() => handlePress(activity.id)}
                    disabled={!canPerform}
                    style={[styles.performButton, !canPerform && styles.disabledButton]}
                  >
                    <Text style={[styles.performButtonText, !canPerform && styles.disabledText]}>
                      {!canPerform ? 'Cannot Perform' : 'Perform Activity'}
                    </Text>
                  </TouchableOpacity>
                </LinearGradient>
              </View>
            );
          })}
        </View>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
    borderRadius: 12,
    marginHorizontal: 16,
    marginTop: 16,
  },
  container: {
    padding: 16,
    borderRadius: 12,
  },
  header: {
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 4,
  },
  titleDark: {
    color: '#F9FAFB',
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
  },
  subtitleDark: {
    color: '#9CA3AF',
  },
  activitiesContainer: {
    // Removed maxHeight and ScrollView - now it's just a View
  },
  activityWrapper: {
    marginBottom: 16,
  },
  activityCard: {
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  activityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  activityName: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    marginLeft: 8,
  },
  energyCost: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  energyText: {
    fontSize: 14,
    color: '#FFFFFF',
    marginLeft: 4,
    fontWeight: '500',
  },
  activityDescription: {
    fontSize: 14,
    color: '#FFFFFF',
    opacity: 0.95,
    marginBottom: 16,
    lineHeight: 20,
  },
  activityDetails: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  detailText: {
    fontSize: 13,
    color: '#FFFFFF',
    marginLeft: 6,
    fontWeight: '500',
  },
  performButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  disabledButton: {
    backgroundColor: 'rgba(156, 163, 175, 0.3)',
    borderColor: 'rgba(156, 163, 175, 0.3)',
  },
  performButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  disabledText: {
    color: '#9CA3AF',
  },

});

