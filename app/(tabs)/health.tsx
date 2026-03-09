import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useGame } from '@/contexts/GameContext';
import { HealthActivity } from '@/contexts/game/types';
import { Activity, Utensils, CircleCheck as CheckCircle, AlertTriangle, Heart } from 'lucide-react-native';
import { useTranslation } from '@/hooks/useTranslation';
import ErrorBoundary from '@/components/ErrorBoundary';
import { responsiveSpacing, responsiveFontSize, responsiveBorderRadius } from '@/utils/scaling';
import { initialGameState } from '@/contexts/game/initialState';

function HealthScreen() {
  return (
    <ErrorBoundary>
      <HealthScreenContent />
    </ErrorBoundary>
  );
}

function HealthScreenContent() {
  const { t } = useTranslation();
  const router = useRouter();
  const { gameState, performHealthActivity, toggleDietPlan, setGameState } = useGame();
  const { settings } = gameState;
  const [healthFeedback, setHealthFeedback] = useState<{ [key: string]: string }>({});

  // Merge health activities with initialState to ensure latest values are always displayed
  // This fixes the issue where saved games have old energy cost values
  const { mergedHealthActivities, needsStateSync } = useMemo(() => {
    const initialStateActivities = initialGameState.healthActivities || [];
    const savedActivities = gameState.healthActivities || [];

    // Create a map of latest values from initialState
    const latestValues = new Map<string, HealthActivity>();
    initialStateActivities.forEach(activity => {
      latestValues.set(activity.id, activity);
    });

    // Merge: use saved activity if it exists, but update with latest values from initialState
    const merged = savedActivities.map(savedActivity => {
      const latestActivity = latestValues.get(savedActivity.id);
      if (latestActivity) {
        return {
          ...savedActivity,
          happinessGain: latestActivity.happinessGain,
          healthGain: latestActivity.healthGain,
          energyCost: latestActivity.energyCost,
          price: latestActivity.price,
        };
      }
      return savedActivity;
    });

    // Check if state needs updating (without performing the side effect here)
    const needsUpdate = merged.some((activity, index) => {
      const saved = savedActivities[index];
      return !saved ||
        saved.happinessGain !== activity.happinessGain ||
        saved.healthGain !== activity.healthGain ||
        saved.energyCost !== activity.energyCost ||
        saved.price !== activity.price;
    });

    return { mergedHealthActivities: merged, needsStateSync: needsUpdate };
  }, [gameState.healthActivities]);

  // Sync merged values back to game state in a separate useEffect (not in useMemo)
  useEffect(() => {
    if (needsStateSync && mergedHealthActivities.length > 0) {
      setGameState(prevState => ({
        ...prevState,
        healthActivities: mergedHealthActivities,
      }));
    }
  }, [needsStateSync, mergedHealthActivities, setGameState]);

  // Prevent staying on health screen when in prison - redirect to work tab
  useEffect(() => {
    if (gameState.jailWeeks > 0) {
      router.replace('/(tabs)/work');
    }
  }, [gameState.jailWeeks, router]);

  const canAfford = (price: number) => gameState.stats.money >= price;
  const canPerformActivity = (activity: HealthActivity) => {
    const energyCost = activity.energyCost || 0;
    // Only check energy requirement if the activity costs energy (positive value)
    const hasEnoughEnergy = energyCost <= 0 || gameState.stats.energy >= energyCost;
    const hasEnoughMoney = gameState.stats.money >= activity.price;
    return hasEnoughMoney && hasEnoughEnergy;
  };
  const activeDietPlan = gameState.dietPlans.find(plan => plan.active);
  const currentDiseases = gameState.diseases || [];
  const hasDiseases = currentDiseases.length > 0;

  const handleHealthActivityPress = (activity: HealthActivity) => {
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
      <ScrollView style={[styles.content, settings.darkMode && styles.contentDark]} showsVerticalScrollIndicator={true}>
        <View style={styles.scrollContainer}>
          <View style={styles.scrollIndicator}>
            <View style={styles.scrollBar}>
              <View style={styles.scrollThumb} />
            </View>
          </View>
        </View>
        {/* Disease Status Section */}
        {hasDiseases && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <AlertTriangle size={24} color="#EF4444" />
              <Text style={[styles.sectionTitle, settings.darkMode && styles.sectionTitleDark]}>Current Health Conditions</Text>
            </View>
            <View style={[styles.diseaseStatusCard, settings.darkMode && styles.diseaseStatusCardDark]}>
              <Text style={[styles.diseaseStatusText, settings.darkMode && styles.diseaseStatusTextDark]}>
                You have {currentDiseases.length} active condition{currentDiseases.length !== 1 ? 's' : ''}:
              </Text>
              {currentDiseases.map((disease, index) => (
                <View key={index} style={styles.diseaseStatusItem}>
                  <Heart size={16} color={disease.severity === 'critical' ? '#DC2626' : disease.severity === 'serious' ? '#EF4444' : '#F59E0B'} />
                  <Text style={[styles.diseaseStatusName, settings.darkMode && styles.diseaseStatusNameDark]}>
                    {disease.name} ({disease.severity})
                  </Text>
                </View>
              ))}
              <Text style={[styles.diseaseStatusHint, settings.darkMode && styles.diseaseStatusHintDark]}>
                Visit a doctor or hospital to treat these conditions
              </Text>
            </View>
          </View>
        )}

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Activity size={24} color="#EF4444" />
            <Text style={[styles.sectionTitle, settings.darkMode && styles.sectionTitleDark]}>{t('health.healthActivities')}</Text>
          </View>
          <Text style={[styles.sectionDescription, settings.darkMode && styles.sectionDescriptionDark]}>
            {t('health.investMentalPhysical')}
          </Text>

          {mergedHealthActivities.filter(activity => activity.id !== 'vacation').map(activity => (
            <View key={activity.id} style={[styles.activityCard, settings.darkMode && styles.activityCardDark]}>
              <View style={styles.activityInfo}>
                <Text style={[styles.activityName, settings.darkMode && styles.activityNameDark]}>{activity.name}</Text>
                <Text style={[styles.activityDescription, settings.darkMode && styles.activityDescriptionDark]}>{activity.description}</Text>
                <Text style={styles.activityPrice}>${activity.price}</Text>

                <View style={styles.benefitsInfo}>
                  <Text style={[styles.benefitsTitle, settings.darkMode && styles.benefitsTitleDark]}>{t('health.benefits')}</Text>
                  <Text style={styles.benefitText}>+{activity.happinessGain} {t('game.happiness')}</Text>
                  {activity.healthGain && (
                    <Text style={styles.benefitText}>+{activity.healthGain} {t('game.health')}</Text>
                  )}
                  {typeof activity.energyCost === 'number' && activity.energyCost !== 0 && (
                    <Text style={activity.energyCost > 0 ? styles.costText : styles.benefitText}>
                      {activity.energyCost > 0
                        ? `-${activity.energyCost} Energy`
                        : `+${Math.abs(activity.energyCost)} Energy`}
                    </Text>
                  )}
                  {activity.id === 'doctor' && (
                    <Text style={styles.benefitText}>{t('health.chanceToCure')}</Text>
                  )}
                  {activity.id === 'hospital' && (
                    <Text style={styles.benefitText}>{t('health.curesAllHealthIssues')}</Text>
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
                    {t('health.do')}
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
            <Text style={[styles.sectionTitle, settings.darkMode && styles.sectionTitleDark]}>{t('health.dietPlans')}</Text>
          </View>
          <Text style={[styles.sectionDescription, settings.darkMode && styles.sectionDescriptionDark]}>
            {t('health.chooseAutomaticDaily')}
          </Text>

          {activeDietPlan && (
            <View style={[styles.activePlanCard, settings.darkMode && styles.activePlanCardDark]}>
              <Text style={[styles.activePlanTitle, settings.darkMode && styles.activePlanTitleDark]}>{t('health.activePlan')} {activeDietPlan.name}</Text>
              <Text style={[styles.activePlanCost, settings.darkMode && styles.activePlanCostDark]}>{t('health.weeklyCost')} ${activeDietPlan.dailyCost * 7}</Text>
            </View>
          )}

          {gameState.dietPlans.map(plan => (
            <View key={plan.id} style={[styles.dietCard, settings.darkMode && styles.dietCardDark]}>
              <View style={styles.dietInfo}>
                <Text style={[styles.dietName, settings.darkMode && styles.dietNameDark]}>{plan.name}</Text>
                <Text style={[styles.dietDescription, settings.darkMode && styles.dietDescriptionDark]}>{plan.description}</Text>
                <Text style={styles.dietCost}>{t('health.weeklyCost')} ${plan.dailyCost * 7}</Text>

                <View style={styles.benefitsInfo}>
                  <Text style={[styles.benefitsTitle, settings.darkMode && styles.benefitsTitleDark]}>{t('health.weeklyBenefits')}</Text>
                  <Text style={styles.benefitText}>+{plan.healthGain} {t('game.health')}</Text>
                  <Text style={styles.benefitText}>+{plan.energyGain} {t('game.energy')}</Text>
                  {plan.happinessGain && (
                    <Text style={styles.benefitText}>+{plan.happinessGain} {t('game.happiness')}</Text>
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
                  {plan.active ? t('health.active') : t('health.select')}
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
    backgroundColor: '#FAFBFC',
  },
  containerDark: {
    backgroundColor: '#111827',
  },
  content: {
    flex: 1,
    padding: responsiveSpacing.xl,
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
    fontSize: responsiveFontSize['2xl'],
    fontWeight: '800',
    color: '#0F172A',
    marginLeft: responsiveSpacing.md,
    letterSpacing: -0.5,
    // Light mode: subtle text shadow for emphasis
    textShadowColor: 'rgba(0,0,0,0.1)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  sectionTitleDark: {
    color: '#F9FAFB',
    textShadowColor: 'transparent',
    fontWeight: '700',
  },
  sectionDescription: {
    fontSize: responsiveFontSize.sm,
    color: '#64748B',
    marginBottom: responsiveSpacing.xl,
    lineHeight: responsiveFontSize.lg,
    fontWeight: '500',
  },
  sectionDescriptionDark: {
    color: '#D1D5DB',
    fontWeight: '400',
  },
  activityCard: {
    backgroundColor: '#FFFFFF',
    padding: responsiveSpacing.lg,
    borderRadius: responsiveBorderRadius.xl,
    marginBottom: responsiveSpacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    // Beautiful light mode shadows
    shadowColor: 'rgba(0,0,0,0.06)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 3,
    // Subtle border for definition
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.04)',
  },
  activityCardDark: {
    backgroundColor: '#374151',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 1,
    borderWidth: 0,
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
    boxShadow: '0px 2px 3px rgba(0, 0, 0, 0.1)',
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
  testButton: {
    backgroundColor: '#EF4444',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  testButtonDark: {
    backgroundColor: '#DC2626',
  },
  testButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  testButtonTextDark: {
    color: '#FFFFFF',
  },
  diseaseStatusCard: {
    backgroundColor: '#FEF2F2',
    padding: responsiveSpacing.md,
    borderRadius: responsiveBorderRadius.md,
    marginBottom: responsiveSpacing.md,
    borderLeftWidth: 4,
    borderLeftColor: '#EF4444',
  },
  diseaseStatusCardDark: {
    backgroundColor: '#7F1D1D',
    borderLeftColor: '#DC2626',
  },
  diseaseStatusText: {
    fontSize: responsiveFontSize.sm,
    color: '#DC2626',
    fontWeight: '600',
    marginBottom: responsiveSpacing.sm,
  },
  diseaseStatusTextDark: {
    color: '#FCA5A5',
  },
  diseaseStatusItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: responsiveSpacing.xs,
  },
  diseaseStatusName: {
    fontSize: responsiveFontSize.sm,
    color: '#991B1B',
    marginLeft: responsiveSpacing.xs,
    fontWeight: '500',
  },
  diseaseStatusNameDark: {
    color: '#FCA5A5',
  },
  diseaseStatusHint: {
    fontSize: responsiveFontSize.xs,
    color: '#991B1B',
    marginTop: responsiveSpacing.xs,
    fontStyle: 'italic',
  },
  diseaseStatusHintDark: {
    color: '#FCA5A5',
  },
});

export default React.memo(HealthScreen);