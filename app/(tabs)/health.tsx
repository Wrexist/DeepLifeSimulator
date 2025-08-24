import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useGame } from '@/contexts/GameContext';
import { Activity, Utensils, CircleCheck as CheckCircle } from 'lucide-react-native';

export default function HealthScreen() {
  const { gameState, performHealthActivity, toggleDietPlan } = useGame();
  const { settings } = gameState;
  const [healthFeedback, setHealthFeedback] = useState<{ [key: string]: string }>({});

  const canAfford = (price: number) => gameState.stats.money >= price;
  const canPerformActivity = (activity: any) => {
    const energyCost = activity.energyCost || 0;
    return gameState.stats.money >= activity.price && gameState.stats.energy >= energyCost;
  };
  const activeDietPlan = gameState.dietPlans.find(plan => plan.active);

  const handleHealthActivityPress = (activity: any) => {
    const result = performHealthActivity(activity.id);
    if (result) {
      setHealthFeedback({ [activity.id]: result.message });
      setTimeout(() => {
        setHealthFeedback(prev => {
          const newFeedback = { ...prev };
          delete newFeedback[activity.id];
          return newFeedback;
        });
      }, 3000);
    }
  };

  return (
    <View style={[styles.container, settings.darkMode && styles.containerDark]}>
      <ScrollView style={[styles.content, settings.darkMode && styles.contentDark]} showsVerticalScrollIndicator={false}>
        <View style={styles.scrollContainer}>
          <View style={styles.scrollIndicator}>
            <View style={styles.scrollBar}>
              <View style={styles.scrollThumb} />
            </View>
          </View>
        </View>
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Activity size={24} color="#EF4444" />
            <Text style={[styles.sectionTitle, settings.darkMode && styles.sectionTitleDark]}>Health Activities</Text>
          </View>
          <Text style={[styles.sectionDescription, settings.darkMode && styles.sectionDescriptionDark]}>
            Invest in your mental and physical wellbeing with various activities!
          </Text>

          {gameState.healthActivities.map(activity => (
            <View key={activity.id} style={[styles.activityCard, settings.darkMode && styles.activityCardDark]}>
              <View style={styles.activityInfo}>
                <Text style={[styles.activityName, settings.darkMode && styles.activityNameDark]}>{activity.name}</Text>
                <Text style={[styles.activityDescription, settings.darkMode && styles.activityDescriptionDark]}>{activity.description}</Text>
                <Text style={styles.activityPrice}>${activity.price}</Text>

                <View style={styles.benefitsInfo}>
                  <Text style={[styles.benefitsTitle, settings.darkMode && styles.benefitsTitleDark]}>Benefits:</Text>
                  <Text style={styles.benefitText}>+{activity.happinessGain} Happiness</Text>
                  {activity.healthGain && (
                    <Text style={styles.benefitText}>+{activity.healthGain} Health</Text>
                  )}
                  {typeof activity.energyCost === 'number' && activity.energyCost !== 0 && (
                    <Text style={activity.energyCost > 0 ? styles.costText : styles.benefitText}>
                      {activity.energyCost > 0
                        ? `-${activity.energyCost} Energy`
                        : `+${Math.abs(activity.energyCost)} Energy`}
                    </Text>
                  )}
                  {activity.id === 'doctor' && (
                    <Text style={styles.benefitText}>50% chance to cure all health issues</Text>
                  )}
                  {activity.id === 'hospital' && (
                    <Text style={styles.benefitText}>Cures all health issues except cancer</Text>
                  )}
                </View>
              </View>

              <View style={styles.activityButtonContainer}>
                <TouchableOpacity
                  style={[
                    styles.activityButton,
                    !canPerformActivity(activity) && styles.disabledButton
                  ]}
                  onPress={() => handleHealthActivityPress(activity)}
                  disabled={!canPerformActivity(activity)}
                >
                  <Text
                    style={[
                      styles.activityButtonText,
                      !canPerformActivity(activity) && styles.disabledButtonText
                    ]}
                  >
                    Do
                  </Text>
                </TouchableOpacity>
                {healthFeedback[activity.id] && (
                  <View style={styles.feedbackPopup}>
                    <Text style={styles.feedbackPopupText}>{healthFeedback[activity.id]}</Text>
                  </View>
                )}
              </View>
            </View>
          ))}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Utensils size={24} color="#10B981" />
            <Text style={[styles.sectionTitle, settings.darkMode && styles.sectionTitleDark]}>Diet Plans</Text>
          </View>
          <Text style={[styles.sectionDescription, settings.darkMode && styles.sectionDescriptionDark]}>
            Choose an automatic daily diet plan for passive health benefits!
          </Text>

          {activeDietPlan && (
            <View style={[styles.activePlanCard, settings.darkMode && styles.activePlanCardDark]}>
              <Text style={[styles.activePlanTitle, settings.darkMode && styles.activePlanTitleDark]}>Active Plan: {activeDietPlan.name}</Text>
              <Text style={[styles.activePlanCost, settings.darkMode && styles.activePlanCostDark]}>Weekly Cost: ${activeDietPlan.dailyCost * 7}</Text>
            </View>
          )}

          {gameState.dietPlans.map(plan => (
            <View key={plan.id} style={[styles.dietCard, settings.darkMode && styles.dietCardDark]}>
              <View style={styles.dietInfo}>
                <Text style={[styles.dietName, settings.darkMode && styles.dietNameDark]}>{plan.name}</Text>
                <Text style={[styles.dietDescription, settings.darkMode && styles.dietDescriptionDark]}>{plan.description}</Text>
                <Text style={styles.dietCost}>Weekly Cost: ${plan.dailyCost * 7}</Text>

                <View style={styles.benefitsInfo}>
                  <Text style={[styles.benefitsTitle, settings.darkMode && styles.benefitsTitleDark]}>Weekly Benefits:</Text>
                  <Text style={styles.benefitText}>+{plan.healthGain} Health</Text>
                  <Text style={styles.benefitText}>+{plan.energyGain} Energy</Text>
                  {plan.happinessGain && (
                    <Text style={styles.benefitText}>+{plan.happinessGain} Happiness</Text>
                  )}
                </View>
              </View>

              <TouchableOpacity
                style={[
                  styles.dietButton,
                  plan.active && styles.activeDietButton,
                  !canAfford(plan.dailyCost * 7) && !plan.active && styles.disabledButton
                ]}
                onPress={() => toggleDietPlan(plan.id)}
                disabled={!canAfford(plan.dailyCost * 7) && !plan.active}
              >
                {plan.active ? (
                  <CheckCircle size={16} color="#FFFFFF" />
                ) : null}
                <Text style={[
                  styles.dietButtonText,
                  plan.active && styles.activeDietButtonText,
                  !canAfford(plan.dailyCost * 7) && !plan.active && styles.disabledButtonText
                ]}>
                  {plan.active ? 'Active' : 'Select'}
                </Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  containerDark: {
    backgroundColor: '#111827',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  contentDark: {
    backgroundColor: '#111827',
  },
  section: {
    marginBottom: 30,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1F2937',
    marginLeft: 12,
  },
  sectionTitleDark: {
    color: '#F9FAFB',
  },
  sectionDescription: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 20,
    lineHeight: 20,
  },
  sectionDescriptionDark: {
    color: '#D1D5DB',
  },
  activityCard: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  activityCardDark: {
    backgroundColor: '#374151',
  },
  activityInfo: {
    flex: 1,
  },
  activityName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  activityNameDark: {
    color: '#F9FAFB',
  },
  activityDescription: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 6,
  },
  activityDescriptionDark: {
    color: '#D1D5DB',
  },
  activityPrice: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#EF4444',
    marginBottom: 8,
  },
  benefitsInfo: {
    marginTop: 4,
  },
  benefitsTitle: {
    fontSize: 11,
    fontWeight: '500',
    color: '#6B7280',
    marginBottom: 2,
  },
  benefitsTitleDark: {
    color: '#D1D5DB',
  },
  benefitText: {
    fontSize: 10,
    color: '#10B981',
    fontWeight: '500',
  },
  costText: {
    fontSize: 10,
    color: '#EF4444',
    fontWeight: '500',
  },
  activityButton: {
    backgroundColor: '#EF4444',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
  },
  disabledButton: {
    backgroundColor: '#E5E7EB',
  },
  activityButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  disabledButtonText: {
    color: '#9CA3AF',
  },
  activityButtonContainer: {
    alignItems: 'flex-end',
    minWidth: 80,
    position: 'relative',
  },
  feedbackPopup: {
    position: 'absolute',
    right: 0,
    bottom: '100%',
    marginBottom: 8,
    backgroundColor: '#3B82F6',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    zIndex: 1,
  },
  feedbackPopupText: {
    color: '#FFFFFF',
    fontSize: 10,
  },
  activePlanCard: {
    backgroundColor: '#F0FDF4',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#10B981',
  },
  activePlanCardDark: {
    backgroundColor: '#064E3B',
  },
  activePlanTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#10B981',
    marginBottom: 4,
  },
  activePlanTitleDark: {
    color: '#34D399',
  },
  activePlanCost: {
    fontSize: 14,
    color: '#059669',
  },
  activePlanCostDark: {
    color: '#6EE7B7',
  },
  dietCard: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  dietCardDark: {
    backgroundColor: '#374151',
  },
  dietInfo: {
    flex: 1,
  },
  dietName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  dietNameDark: {
    color: '#F9FAFB',
  },
  dietDescription: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 6,
  },
  dietDescriptionDark: {
    color: '#D1D5DB',
  },
  dietCost: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#F59E0B',
    marginBottom: 8,
  },
  dietButton: {
    backgroundColor: '#10B981',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    flexDirection: 'row',
    alignItems: 'center',
  },
  activeDietButton: {
    backgroundColor: '#059669',
  },
  dietButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  activeDietButtonText: {
    color: '#FFFFFF',
    marginLeft: 6,
  },
  diseaseSection: {
    backgroundColor: '#FEF2F2',
    padding: 20,
    borderRadius: 12,
    marginTop: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#EF4444',
  },
  diseaseTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#DC2626',
    marginBottom: 15,
  },
  treatmentButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3B82F6',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 10,
  },
  hospitalButton: {
    backgroundColor: '#10B981',
  },
  cancerButton: {
    backgroundColor: '#EF4444',
  },
  treatmentButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  scrollContainer: {
    position: 'absolute',
    right: 10,
    top: 20,
    bottom: 20,
    width: 4,
    zIndex: 1,
  },
  scrollIndicator: {
    flex: 1,
    justifyContent: 'center',
  },
  scrollBar: {
    width: 6,
    height: 60,
    backgroundColor: '#E5E7EB',
    borderRadius: 2,
  },
  scrollThumb: {
    width: 6,
    height: 30,
    backgroundColor: '#9CA3AF',
    borderRadius: 2,
  },
});