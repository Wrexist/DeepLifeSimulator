import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useGame } from '@/contexts/GameContext';
import { HealthActivity } from '@/contexts/game/types';
import { Activity, Utensils, AlertTriangle, Heart, Zap, Smile, Dumbbell } from 'lucide-react-native';
import { useTranslation } from '@/hooks/useTranslation';
import ErrorBoundary from '@/components/ErrorBoundary';
import { fontScale, responsiveSpacing, responsiveBorderRadius, scale, verticalScale, getTabBarSafePadding } from '@/utils/scaling';
import { initialGameState } from '@/contexts/game/initialState';
import HealthCard, { HealthDelta } from '@/components/health/HealthCard';
import { useTimerManager } from '@/hooks/useTimerManager';

function HealthScreen() {
  return (
    <ErrorBoundary>
      <HealthScreenContent />
    </ErrorBoundary>
  );
}

function HealthScreenContent() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { gameState, performHealthActivity, toggleDietPlan, setGameState } = useGame();
  const { settings } = gameState;
  const [healthFeedback, setHealthFeedback] = useState<{ [key: string]: string }>({});
  // Auto-cleaned timers so the feedback-clear timeout can't setState after unmount.
  const timers = useTimerManager();

  // Merge health activities with initialState so saved games pick up the latest values.
  const { mergedHealthActivities, needsStateSync } = useMemo(() => {
    const initialStateActivities = initialGameState.healthActivities || [];
    const savedActivities = gameState.healthActivities || [];

    const latestValues = new Map<string, HealthActivity>();
    initialStateActivities.forEach(activity => {
      latestValues.set(activity.id, activity);
    });

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

  useEffect(() => {
    if (needsStateSync && mergedHealthActivities.length > 0) {
      setGameState(prevState => ({
        ...prevState,
        healthActivities: mergedHealthActivities,
      }));
    }
  }, [needsStateSync, mergedHealthActivities, setGameState]);

  // Block staying on the health tab while in prison.
  useEffect(() => {
    if (gameState.jailWeeks > 0) {
      router.replace('/(tabs)/work');
    }
  }, [gameState.jailWeeks, router]);

  // P1-6: every other tab guards stats with optional chaining; health was the
  // outlier and would throw if `stats` is briefly undefined on degraded state.
  const canAfford = (price: number) => (gameState.stats?.money ?? 0) >= price;
  const canPerformActivity = (activity: HealthActivity) => {
    const energyCost = activity.energyCost || 0;
    const hasEnoughEnergy = energyCost <= 0 || (gameState.stats?.energy ?? 0) >= energyCost;
    const hasEnoughMoney = (gameState.stats?.money ?? 0) >= activity.price;
    return hasEnoughMoney && hasEnoughEnergy;
  };

  const buildActivityDeltas = (activity: HealthActivity): HealthDelta[] => {
    const out: HealthDelta[] = [];
    if (activity.healthGain) out.push({ stat: 'health', delta: activity.healthGain });
    if (activity.happinessGain) out.push({ stat: 'happiness', delta: activity.happinessGain });
    if (typeof activity.energyCost === 'number' && activity.energyCost !== 0) {
      // energyCost positive means it costs energy; negative means it restores energy.
      out.push({ stat: 'energy', delta: -activity.energyCost });
    }
    return out;
  };

  const handleHealthActivityPress = (activity: HealthActivity) => {
    const result = performHealthActivity(activity.id);
    if (result) {
      setHealthFeedback({ [activity.id]: result.message });
      timers.setTimeout(() => {
        setHealthFeedback(prev => {
          const next = { ...prev };
          delete next[activity.id];
          return next;
        });
      }, 2800);
    }
  };

  const activeDietPlan = (gameState.dietPlans ?? []).find(plan => plan.active);
  const currentDiseases = gameState.diseases || [];
  const hasDiseases = currentDiseases.length > 0;

  // At-a-glance vitals — the health screen never showed the player's own stats.
  const stats = gameState.stats ?? { health: 0, energy: 0, happiness: 0, fitness: 0 };
  const vitals = [
    { key: 'health', label: t('game.health'), value: stats.health ?? 0, color: '#34D399', Icon: Heart },
    { key: 'energy', label: t('game.energy'), value: stats.energy ?? 0, color: '#60A5FA', Icon: Zap },
    { key: 'happiness', label: t('game.happiness'), value: stats.happiness ?? 0, color: '#FBBF24', Icon: Smile },
    { key: 'fitness', label: t('game.fitness'), value: stats.fitness ?? 0, color: '#A78BFA', Icon: Dumbbell },
  ];

  const sectionTitleStyle = [styles.sectionTitle, settings.darkMode && styles.sectionTitleDark];
  const sectionDescStyle = [styles.sectionDescription, settings.darkMode && styles.sectionDescriptionDark];

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.content}
        contentContainerStyle={[styles.contentInner, { paddingBottom: getTabBarSafePadding(insets.bottom) }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Vitals overview — current health/energy/happiness/fitness at a glance */}
        <View style={styles.vitalsCard}>
          <Text style={styles.vitalsTitle}>Your Vitals</Text>
          <View style={styles.vitalsList}>
            {vitals.map(v => {
              const pct = Math.max(0, Math.min(100, v.value));
              return (
                <View key={v.key} style={styles.vitalRow}>
                  <View style={[styles.vitalIcon, { borderColor: v.color + '66', backgroundColor: v.color + '1A' }]}>
                    <v.Icon size={scale(13)} color={v.color} />
                  </View>
                  <Text style={styles.vitalLabel}>{v.label}</Text>
                  <View style={styles.vitalBarBg}>
                    <View style={[styles.vitalBarFill, { width: `${pct}%`, backgroundColor: v.color }]} />
                  </View>
                  <Text style={styles.vitalValue}>{Math.round(v.value)}</Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* Disease status — quiet warning card, no left bar */}
        {hasDiseases && (
          <View style={styles.diseaseCard}>
            <View style={styles.diseaseHeader}>
              <View style={styles.diseaseIconWrap}>
                <AlertTriangle size={scale(15)} color="#F87171" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.diseaseTitle}>
                  {currentDiseases.length} active condition{currentDiseases.length !== 1 ? 's' : ''}
                </Text>
                <Text style={styles.diseaseHint}>Visit a doctor or hospital to treat.</Text>
              </View>
            </View>
            <View style={styles.diseaseList}>
              {currentDiseases.map((disease, index) => {
                const dotColor =
                  disease.severity === 'critical' ? '#DC2626'
                    : disease.severity === 'serious' ? '#EF4444'
                      : '#F59E0B';
                return (
                  <View key={disease.id ?? disease.name ?? index} style={styles.diseaseRow}>
                    <View style={[styles.diseaseDot, { backgroundColor: dotColor }]} />
                    <Heart size={scale(12)} color={dotColor} />
                    <Text style={styles.diseaseName}>{disease.name}</Text>
                    <Text style={styles.diseaseSeverity}>{disease.severity}</Text>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* Activities */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionIcon, { borderColor: 'rgba(248, 113, 113, 0.4)' }]}>
              <Activity size={scale(15)} color="#F87171" />
            </View>
            <Text style={sectionTitleStyle}>{t('health.healthActivities')}</Text>
          </View>
          <Text style={sectionDescStyle}>{t('health.investMentalPhysical')}</Text>

          {mergedHealthActivities
            .filter(activity => activity.id !== 'vacation')
            .map(activity => {
              const deltas = buildActivityDeltas(activity);
              const locked = !canPerformActivity(activity);
              const lockReason = !canAfford(activity.price)
                ? `Need $${activity.price}`
                : (activity.energyCost || 0) > 0 && (gameState.stats?.energy ?? 0) < (activity.energyCost || 0)
                  ? `Need ${activity.energyCost} energy`
                  : undefined;
              const isCureActivity = activity.id === 'doctor' || activity.id === 'hospital' || activity.id === 'experimental';
              const description = isCureActivity
                ? activity.id === 'doctor'
                  ? `${activity.description}  •  ${t('health.chanceToCure')}`
                  : activity.id === 'hospital'
                    ? `${activity.description}  •  ${t('health.curesAllHealthIssues')}`
                    // Experimental treatment is the ONLY cure for critical
                    // conditions (cancer/heart/stroke -- hospital excludes them);
                    // without this line a dying player has no signal it exists.
                    : `${activity.description}  •  Only treatment for critical conditions`
                : activity.description;

              return (
                <HealthCard
                  key={activity.id}
                  accent="vitality"
                  title={activity.name}
                  description={description}
                  priceLabel={activity.price > 0 ? `$${activity.price}` : 'Free'}
                  deltas={deltas}
                  buttonText={locked ? 'Locked' : t('health.do')}
                  onPress={() => handleHealthActivityPress(activity)}
                  locked={locked}
                  lockReason={lockReason}
                  feedback={healthFeedback[activity.id]}
                />
              );
            })}
        </View>

        {/* Diet plans */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionIcon, { borderColor: 'rgba(52, 211, 153, 0.4)' }]}>
              <Utensils size={scale(15)} color="#34D399" />
            </View>
            <Text style={sectionTitleStyle}>{t('health.dietPlans')}</Text>
          </View>
          <Text style={sectionDescStyle}>{t('health.chooseAutomaticDaily')}</Text>

          {(gameState.dietPlans ?? []).map(plan => {
            const weeklyCost = plan.dailyCost * 7;
            const deltas: HealthDelta[] = [
              { stat: 'health', delta: plan.healthGain },
              { stat: 'energy', delta: plan.energyGain },
              ...(plan.happinessGain ? [{ stat: 'happiness' as const, delta: plan.happinessGain }] : []),
            ];
            const locked = !plan.active && !canAfford(weeklyCost);
            const lockReason = locked ? `Need $${weeklyCost} / wk` : undefined;
            return (
              <HealthCard
                key={plan.id}
                accent="diet"
                title={plan.name}
                description={plan.description}
                priceLabel={`$${weeklyCost} / wk`}
                deltas={deltas}
                buttonText={plan.active ? t('health.active') : t('health.select')}
                onPress={() => toggleDietPlan(plan.id)}
                active={plan.active}
                locked={locked}
                lockReason={lockReason}
              />
            );
          })}

          {activeDietPlan ? (
            <Text style={styles.activeDietFooter}>
              {t('health.activePlan')} {activeDietPlan.name} · {t('health.weeklyCost')} ${activeDietPlan.dailyCost * 7}
            </Text>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#020617',
  },
  content: {
    flex: 1,
  },
  // Vitals overview
  vitalsCard: {
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    borderRadius: responsiveBorderRadius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    padding: responsiveSpacing.md,
    gap: verticalScale(12),
  },
  vitalsTitle: {
    fontSize: fontScale(13),
    fontWeight: '700',
    color: 'rgba(226, 232, 240, 0.6)',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  vitalsList: {
    gap: verticalScale(10),
  },
  vitalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(10),
  },
  vitalIcon: {
    width: scale(26),
    height: scale(26),
    borderRadius: scale(8),
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vitalLabel: {
    width: scale(66),
    fontSize: fontScale(12.5),
    fontWeight: '600',
    color: '#E2E8F0',
  },
  vitalBarBg: {
    flex: 1,
    height: scale(7),
    borderRadius: scale(4),
    backgroundColor: 'rgba(148, 163, 184, 0.18)',
    overflow: 'hidden',
  },
  vitalBarFill: {
    height: '100%',
    borderRadius: scale(4),
  },
  vitalValue: {
    width: scale(30),
    textAlign: 'right',
    fontSize: fontScale(13),
    fontWeight: '800',
    color: '#F8FAFC',
    fontVariant: ['tabular-nums'],
  },
  contentInner: {
    padding: responsiveSpacing.md,
    paddingBottom: verticalScale(40),
    gap: verticalScale(20),
  },
  section: {
    gap: verticalScale(10),
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(10),
    marginBottom: verticalScale(4),
  },
  sectionIcon: {
    width: scale(28),
    height: scale(28),
    borderRadius: scale(9),
    borderWidth: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    fontSize: fontScale(18),
    fontWeight: '700',
    color: '#F8FAFC',
    letterSpacing: -0.3,
  },
  sectionTitleDark: {
    color: '#F8FAFC',
  },
  sectionDescription: {
    fontSize: fontScale(12),
    color: 'rgba(226, 232, 240, 0.6)',
    lineHeight: fontScale(17),
    marginBottom: verticalScale(4),
  },
  sectionDescriptionDark: {
    color: 'rgba(226, 232, 240, 0.6)',
  },
  // Disease status card — quiet, no left bar.
  diseaseCard: {
    backgroundColor: 'rgba(248, 113, 113, 0.08)',
    borderRadius: responsiveBorderRadius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(248, 113, 113, 0.25)',
    padding: responsiveSpacing.md,
    gap: verticalScale(10),
  },
  diseaseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(10),
  },
  diseaseIconWrap: {
    width: scale(28),
    height: scale(28),
    borderRadius: scale(9),
    backgroundColor: 'rgba(248, 113, 113, 0.12)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(248, 113, 113, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  diseaseTitle: {
    fontSize: fontScale(14),
    fontWeight: '700',
    color: '#FCA5A5',
    letterSpacing: -0.2,
  },
  diseaseHint: {
    fontSize: fontScale(11),
    color: 'rgba(252, 165, 165, 0.7)',
    marginTop: 1,
  },
  diseaseList: {
    gap: verticalScale(6),
    paddingTop: verticalScale(4),
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(248, 113, 113, 0.2)',
  },
  diseaseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(8),
  },
  diseaseDot: {
    width: scale(5),
    height: scale(5),
    borderRadius: scale(3),
  },
  diseaseName: {
    flex: 1,
    fontSize: fontScale(13),
    fontWeight: '600',
    color: '#FCA5A5',
  },
  diseaseSeverity: {
    fontSize: fontScale(10),
    fontWeight: '700',
    color: 'rgba(252, 165, 165, 0.75)',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  activeDietFooter: {
    fontSize: fontScale(11),
    color: 'rgba(52, 211, 153, 0.75)',
    fontWeight: '600',
    textAlign: 'center',
    marginTop: verticalScale(4),
    fontVariant: ['tabular-nums'],
  },
});

export default React.memo(HealthScreen);
