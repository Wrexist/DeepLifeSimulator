import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { Check, Gem, Play, Sparkles, Star, Target } from 'lucide-react-native';
import LinearGradientFallback from '@/components/fallbacks/LinearGradientFallback';
const LinearGradient = LinearGradientFallback;
import BlurViewFallback from '@/components/fallbacks/BlurViewFallback';
const BlurView = BlurViewFallback;
import OnboardingScreenShellV2 from '@/components/onboarding/OnboardingScreenShellV2';
import OnboardingGlassHeader from '@/components/onboarding/OnboardingGlassHeader';
import OnboardingFloatingButton from '@/components/onboarding/OnboardingFloatingButton';
import OnboardingStepBar from '@/components/onboarding/OnboardingStepBar';
import { useGame } from '@/contexts/GameContext';
import {
  getDifficultyColor,
  getDifficultyLabel,
  SCENARIOS as CHALLENGE_SCENARIOS,
  Scenario as ChallengeScenarioDefinition,
} from '@/lib/scenarios/scenarioDefinitions';
import { scenarios as LIFE_PATH_SCENARIOS, Scenario as OnboardingScenario } from '@/src/features/onboarding/scenarioData';
import {
  applyChallengeSelectionToOnboardingState,
  applyLifePathSelectionToOnboardingState,
  canContinueFromScenarioSelection,
  getInitialScenarioTab,
} from '@/src/features/onboarding/scenariosFlow';
import { useOnboarding } from '@/src/features/onboarding/OnboardingContext';
import { logOnboardingStepView } from '@/src/features/onboarding/onboardingAnalytics';
import { logger } from '@/utils/logger';
import { haptic } from '@/utils/haptics';
import { formatMoney } from '@/utils/moneyFormatting';
import {
  fontScale,
  responsiveBorderRadius,
  responsiveFontSize,
  responsivePadding,
  responsiveSpacing,
  scale,
  verticalScale,
} from '@/utils/scaling';

type TabType = 'life_paths' | 'challenges';

interface ChallengeScenarioCard extends OnboardingScenario {
  isChallenge: true;
  difficultyKey: ChallengeScenarioDefinition['difficulty'];
  iconEmoji?: string;
  rewardGems: number;
}

type ScenarioCard = OnboardingScenario | ChallengeScenarioCard;

const CHALLENGE_FALLBACK_ICON = require('@/assets/images/Scenarios/Street Hustler.png');

const RECOMMENDED_SCENARIO_ID = 'food_courier';

const isChallengeDifficulty = (
  difficulty: unknown
): difficulty is ChallengeScenarioDefinition['difficulty'] => {
  return difficulty === 'easy' || difficulty === 'medium' || difficulty === 'hard' || difficulty === 'expert';
};

const fallbackDifficultyLabel = (difficulty: ChallengeScenarioDefinition['difficulty']): string => {
  switch (difficulty) {
    case 'easy':
      return 'Easy';
    case 'medium':
      return 'Medium';
    case 'hard':
      return 'Hard';
    case 'expert':
      return 'Expert';
    default:
      return 'Unknown';
  }
};

const fallbackDifficultyColor = (difficulty: ChallengeScenarioDefinition['difficulty']): string => {
  switch (difficulty) {
    case 'easy':
      return '#10B981';
    case 'medium':
      return '#3B82F6';
    case 'hard':
      return '#F59E0B';
    case 'expert':
      return '#EF4444';
    default:
      return '#6B7280';
  }
};

const getScenarioItemIcon = (itemId: string): string => {
  switch (itemId) {
    case 'smartphone':
      return 'PHONE';
    case 'driver_license':
      return 'CAR';
    case 'business_suit':
    case 'suit':
      return 'SUIT';
    case 'gym_membership':
      return 'FIT';
    case 'computer':
      return 'PC';
    case 'bike':
      return 'BIKE';
    default:
      return 'ITEM';
  }
};

const formatTokenLabel = (token: string): string => {
  return token.replace(/_/g, ' ').replace(/\b\w/g, (value) => value.toUpperCase());
};

const safeGetDifficultyLabel = (difficulty: ChallengeScenarioDefinition['difficulty']): string => {
  try {
    if (typeof getDifficultyLabel === 'function') {
      return getDifficultyLabel(difficulty);
    }
  } catch {
    // Fallback below.
  }
  return fallbackDifficultyLabel(difficulty);
};

const safeGetDifficultyColor = (difficulty: ChallengeScenarioDefinition['difficulty']): string => {
  try {
    if (typeof getDifficultyColor === 'function') {
      return getDifficultyColor(difficulty);
    }
  } catch {
    // Fallback below.
  }
  return fallbackDifficultyColor(difficulty);
};

export default function Scenarios() {
  const log = logger.scope('Scenarios');
  const router = useRouter();
  const navigation = useNavigation();
  const { gameState } = useGame();
  const { state, setState } = useOnboarding();
  const [activeTab, setActiveTab] = useState<TabType>(getInitialScenarioTab(state.challengeScenarioId));
  const [selectedId, setSelectedId] = useState<string | null>(state.scenario?.id ?? null);

  useEffect(() => {
    logOnboardingStepView('Scenarios');
  }, []);

  const challengeScenarios = useMemo<ChallengeScenarioCard[]>(() => {
    if (!Array.isArray(CHALLENGE_SCENARIOS)) {
      log.warn('Challenge scenarios missing or invalid.');
      return [];
    }

    return CHALLENGE_SCENARIOS.map((challenge, index): ChallengeScenarioCard | null => {
      if (!challenge || typeof challenge !== 'object') {
        log.warn('Skipping invalid challenge scenario entry.', { index });
        return null;
      }

      const difficultyKey = isChallengeDifficulty(challenge.difficulty) ? challenge.difficulty : 'medium';
      const startingConditions =
        challenge.startingConditions && typeof challenge.startingConditions === 'object'
          ? challenge.startingConditions
          : {};
      const firstCondition = Array.isArray(challenge.winConditions)
        ? challenge.winConditions.find((condition) => typeof condition?.description === 'string')
        : undefined;
      const educationList = Array.isArray(startingConditions.education)
        ? startingConditions.education.filter((entry): entry is string => typeof entry === 'string')
        : [];
      const startItems = Array.isArray(startingConditions.items)
        ? startingConditions.items.filter((entry): entry is string => typeof entry === 'string')
        : [];
      const challengeIcon = typeof challenge.icon === 'string' ? challenge.icon : undefined;
      const challengeId =
        typeof challenge.id === 'string' && challenge.id.trim().length > 0
          ? challenge.id
          : `challenge-${index + 1}`;
      const challengeTitle =
        typeof challenge.name === 'string' && challenge.name.trim().length > 0
          ? challenge.name
          : `Challenge ${index + 1}`;
      const description =
        typeof challenge.description === 'string' && challenge.description.trim().length > 0
          ? challenge.description
          : 'Complete this challenge to earn bonus rewards.';
      const rewardGems = typeof challenge.rewards?.gems === 'number' ? challenge.rewards.gems : 0;
      const startingEducation = educationList.length > 0 ? educationList[0] : undefined;

      return {
        id: challengeId,
        title: challengeTitle,
        difficulty: safeGetDifficultyLabel(difficultyKey),
        lifeGoal: firstCondition?.description || 'Complete the challenge',
        description,
        bonus: `Rewards: ${rewardGems} gems`,
        start: {
          age: typeof startingConditions.age === 'number' ? startingConditions.age : 18,
          cash: typeof startingConditions.money === 'number' ? startingConditions.money : 0,
          education: startingEducation,
          items: startItems,
          traits: [],
        },
        icon: CHALLENGE_FALLBACK_ICON,
        isChallenge: true,
        difficultyKey,
        iconEmoji: challengeIcon,
        rewardGems,
      };
    }).filter((scenario): scenario is ChallengeScenarioCard => scenario !== null);
  }, [log]);

  const currentScenarios: ScenarioCard[] = activeTab === 'life_paths' ? LIFE_PATH_SCENARIOS : challengeScenarios;

  const selectedScenario = useMemo(
    () => currentScenarios.find((scenario) => scenario.id === selectedId) ?? null,
    [currentScenarios, selectedId]
  );

  const handleBack = useCallback(() => {
    if (navigation.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/(onboarding)/MainMenu');
  }, [navigation, router]);

  const selectLifePath = (scenarioId: string) => {
    const selected = LIFE_PATH_SCENARIOS.find((entry) => entry.id === scenarioId);
    if (!selected) {
      Alert.alert('Selection Error', 'This life path could not be loaded. Please try another option.');
      return;
    }

    haptic.selection();
    setSelectedId(selected.id);
    setState((prev) => applyLifePathSelectionToOnboardingState(prev, selected));
  };

  const selectChallenge = (scenarioId: string) => {
    const selected = challengeScenarios.find((entry) => entry.id === scenarioId);
    if (!selected) {
      Alert.alert('Selection Error', 'This challenge could not be loaded. Please try another option.');
      return;
    }

    haptic.selection();
    setSelectedId(selected.id);
    setState((prev) => applyChallengeSelectionToOnboardingState(prev, selected, CHALLENGE_FALLBACK_ICON));
  };

  const continueToCustomize = () => {
    if (!canContinueFromScenarioSelection(selectedScenario)) {
      haptic.error();
      Alert.alert('Pick A Scenario', 'Choose a life path or challenge before continuing.');
      return;
    }
    haptic.medium();
    router.push('/(onboarding)/Customize');
  };

  return (
    <OnboardingScreenShellV2
      floatingButton={
        <OnboardingFloatingButton
          title="Continue To Identity"
          onPress={continueToCustomize}
          disabled={!selectedScenario}
          icon={<Play size={24} color="#FFFFFF" />}
        />
      }
    >
      <OnboardingGlassHeader
        title="Choose Scenario"
        onBack={handleBack}
        onInfo={() =>
          Alert.alert(
            activeTab === 'life_paths' ? 'Life Paths' : 'Challenges',
            activeTab === 'life_paths'
              ? 'Life Paths define your starting age, cash, and inventory.'
              : 'Challenges add special goals and first-prestige gem rewards.'
          )
        }
      />

      <OnboardingStepBar currentStep={1} totalSteps={3} />

      <Text style={styles.guidanceText}>
        Pick how your life begins. Easy paths are great for your first playthrough.
      </Text>

      {/* Tab Selector */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'life_paths' && styles.tabActive]}
          onPress={() => { haptic.light(); setActiveTab('life_paths'); }}
        >
          <LinearGradient
            colors={
              activeTab === 'life_paths'
                ? ['#10B981', '#059669']
                : ['rgba(31, 41, 55, 0.8)', 'rgba(17, 24, 39, 0.8)']
            }
            style={styles.tabGradient}
          >
            <Target size={18} color={activeTab === 'life_paths' ? '#FFFFFF' : '#9CA3AF'} />
            <Text style={[styles.tabText, activeTab === 'life_paths' && styles.tabTextActive]}>
              Life Paths
            </Text>
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'challenges' && styles.tabActiveRed]}
          onPress={() => { haptic.light(); setActiveTab('challenges'); }}
        >
          <LinearGradient
            colors={
              activeTab === 'challenges'
                ? ['#EF4444', '#DC2626']
                : ['rgba(31, 41, 55, 0.8)', 'rgba(17, 24, 39, 0.8)']
            }
            style={styles.tabGradient}
          >
            <Sparkles size={18} color={activeTab === 'challenges' ? '#FFFFFF' : '#9CA3AF'} />
            <Text style={[styles.tabText, activeTab === 'challenges' && styles.tabTextActive]}>
              Challenges
            </Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollContainer}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={true}
      >
        {currentScenarios.map((scenario) => {
          const isSelected = scenario.id === selectedId;
          const isChallenge = 'isChallenge' in scenario && scenario.isChallenge;
          const isRecommended = !isChallenge && scenario.id === RECOMMENDED_SCENARIO_ID;
          const rewardGems = isChallenge ? scenario.rewardGems : 0;
          const difficultyBadgeColor = isChallenge ? safeGetDifficultyColor(scenario.difficultyKey) : '#6B7280';
          const difficultyColor =
            scenario.difficulty === 'Easy' ? '#10B981' :
            scenario.difficulty === 'Moderate' ? '#3B82F6' :
            scenario.difficulty === 'Hard' ? '#F59E0B' : '#6B7280';

          return (
            <TouchableOpacity
              key={scenario.id}
              activeOpacity={0.92}
              style={styles.cardContainer}
              onPress={() => {
                if (isChallenge) {
                  selectChallenge(scenario.id);
                  return;
                }
                selectLifePath(scenario.id);
              }}
            >
              <BlurView intensity={20} style={styles.cardBlur}>
                <LinearGradient
                  colors={
                    isSelected
                      ? ['rgba(16, 185, 129, 0.2)', 'rgba(5, 150, 105, 0.2)']
                      : ['rgba(31, 41, 55, 0.8)', 'rgba(17, 24, 39, 0.8)']
                  }
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={[styles.card, isSelected && styles.cardSelected]}
                >
                  {isRecommended ? (
                    <View style={styles.recommendedBanner}>
                      <Star size={12} color="#FFFFFF" />
                      <Text style={styles.recommendedBannerText}>RECOMMENDED FOR BEGINNERS</Text>
                    </View>
                  ) : null}

                  <View style={styles.cardHeader}>
                    <Image source={scenario.icon} style={styles.cardImage} />
                    <View style={styles.cardTextWrap}>
                      <View style={styles.cardTitleRow}>
                        <Text style={styles.cardTitle}>{scenario.title}</Text>
                        {isChallenge ? (
                          <View style={[styles.difficultyChip, { backgroundColor: difficultyBadgeColor }]}>
                            <Text style={styles.difficultyText}>
                              {scenario.difficulty.toUpperCase()}
                            </Text>
                          </View>
                        ) : (
                          <View style={[styles.difficultyChip, { backgroundColor: difficultyColor }]}>
                            <Text style={styles.difficultyText}>
                              {scenario.difficulty.toUpperCase()}
                            </Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.cardDescription}>{scenario.description}</Text>
                      <Text style={styles.goalText}>Goal: {scenario.lifeGoal}</Text>
                    </View>
                    {isSelected ? (
                      <View style={styles.selectedDot}>
                        <Check size={scale(14)} color="#10B981" />
                      </View>
                    ) : null}
                  </View>

                  <View style={styles.statsRow}>
                    <View style={styles.statCell}>
                      <Text style={styles.statLabel}>Age</Text>
                      <Text style={styles.statValue}>{scenario.start.age}</Text>
                    </View>
                    <View style={styles.statCell}>
                      <Text style={styles.statLabel}>Cash</Text>
                      <Text style={styles.statValue}>{formatMoney(scenario.start.cash)}</Text>
                    </View>
                    <View style={styles.statCell}>
                      <Text style={styles.statLabel}>Study</Text>
                      <Text style={styles.statValue}>
                        {scenario.start.education || 'None'}
                      </Text>
                    </View>
                    {isChallenge ? (
                      <View style={styles.statCell}>
                        <Text style={styles.statLabel}>Reward</Text>
                        <View style={styles.rewardRow}>
                          <Gem size={scale(13)} color="#FBBF24" />
                          <Text style={styles.rewardValue}>{rewardGems}</Text>
                        </View>
                      </View>
                    ) : null}
                  </View>

                  {(scenario.start.items?.length || scenario.start.traits?.length || (isChallenge && scenario.iconEmoji)) ? (
                    <View style={styles.tagsWrap}>
                      {isChallenge && scenario.iconEmoji ? (
                        <View style={styles.tag}>
                          <Text style={styles.tagText}>{scenario.iconEmoji} Challenge</Text>
                        </View>
                      ) : null}
                      {scenario.start.items?.map((item) => (
                        <View key={`${scenario.id}-item-${item}`} style={styles.tag}>
                          <Text style={styles.tagText}>
                            {getScenarioItemIcon(item)} {formatTokenLabel(item)}
                          </Text>
                        </View>
                      ))}
                      {scenario.start.traits?.map((trait) => (
                        <View key={`${scenario.id}-trait-${trait}`} style={styles.tag}>
                          <Text style={styles.tagText}>TRAIT {formatTokenLabel(trait)}</Text>
                        </View>
                      ))}
                    </View>
                  ) : null}
                </LinearGradient>
              </BlurView>
            </TouchableOpacity>
          );
        })}

        <View style={{ height: 140 }} />
      </ScrollView>
    </OnboardingScreenShellV2>
  );
}

const styles = StyleSheet.create({
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: responsivePadding.large,
    paddingTop: responsiveSpacing.sm,
    paddingBottom: responsiveSpacing.md,
    gap: 12,
  },
  tab: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  tabActive: {
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  tabActiveRed: {
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  tabGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
  },
  tabText: {
    fontSize: responsiveFontSize.base,
    fontWeight: '600',
    color: '#9CA3AF',
  },
  tabTextActive: {
    color: '#FFFFFF',
  },
  guidanceText: {
    fontSize: fontScale(13),
    fontWeight: '500',
    color: '#9CA3AF',
    textAlign: 'center',
    paddingHorizontal: responsivePadding.large,
    paddingBottom: responsiveSpacing.xs,
  },
  recommendedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: 'rgba(16, 185, 129, 0.25)',
    paddingVertical: 6,
    marginBottom: 4,
  },
  recommendedBannerText: {
    fontSize: fontScale(10),
    fontWeight: '800',
    color: '#34D399',
    letterSpacing: 0.8,
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    gap: responsiveSpacing.lg,
    paddingHorizontal: responsivePadding.large,
    paddingTop: 8,
    paddingBottom: responsiveSpacing.lg,
  },
  cardContainer: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 12,
  },
  cardBlur: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  card: {
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    gap: responsiveSpacing.sm,
  },
  cardSelected: {
    borderColor: 'rgba(16, 185, 129, 0.5)',
    borderWidth: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    gap: responsiveSpacing.sm,
  },
  cardImage: {
    borderRadius: 16,
    height: scale(74),
    width: scale(74),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 6,
  },
  cardTextWrap: {
    flex: 1,
  },
  cardTitleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: responsiveSpacing.xs,
    marginBottom: verticalScale(4),
  },
  cardTitle: {
    flex: 1,
    fontSize: responsiveFontSize.xl,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  difficultyChip: {
    borderRadius: responsiveBorderRadius.full,
    overflow: 'hidden',
    paddingHorizontal: responsiveSpacing.xs,
    paddingVertical: verticalScale(4),
  },
  difficultyText: {
    color: '#FFFFFF',
    fontSize: fontScale(9),
    fontWeight: '800',
  },
  cardDescription: {
    fontSize: responsiveFontSize.base,
    fontWeight: '500',
    color: '#D1D5DB',
    lineHeight: fontScale(16),
    marginBottom: verticalScale(3),
  },
  goalText: {
    fontSize: fontScale(11),
    fontWeight: '700',
    color: '#60A5FA',
    lineHeight: fontScale(15),
  },
  selectedDot: {
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 20,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    height: scale(28),
    justifyContent: 'center',
    width: scale(28),
  },
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: responsiveSpacing.xs,
  },
  statCell: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: responsiveBorderRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    flex: 1,
    minWidth: scale(70),
    paddingHorizontal: responsiveSpacing.xs,
    paddingVertical: verticalScale(8),
  },
  statLabel: {
    fontSize: fontScale(10),
    fontWeight: '600',
    color: '#9CA3AF',
    marginBottom: verticalScale(2),
  },
  statValue: {
    fontSize: fontScale(11),
    fontWeight: '800',
    color: '#FFFFFF',
  },
  rewardRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: responsiveSpacing.xs,
  },
  rewardValue: {
    fontSize: fontScale(11),
    fontWeight: '800',
    color: '#FFFFFF',
  },
  tagsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: responsiveSpacing.xs,
  },
  tag: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: responsiveBorderRadius.full,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
    paddingHorizontal: responsiveSpacing.sm,
    paddingVertical: verticalScale(5),
  },
  tagText: {
    fontSize: fontScale(10),
    fontWeight: '700',
    color: '#60A5FA',
  },
});
