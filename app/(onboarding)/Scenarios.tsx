import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Platform, Alert, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { useHardwareBack } from '@/hooks/useHardwareBack';
import { Check, ChevronRight, Gem, Play, Sparkles, Star, Target } from 'lucide-react-native';
import LinearGradientFallback from '@/components/fallbacks/LinearGradientFallback';
import BlurViewFallback from '@/components/fallbacks/BlurViewFallback';
import OnboardingScreenShellV2 from '@/components/onboarding/OnboardingScreenShellV2';
import OnboardingGlassHeader from '@/components/onboarding/OnboardingGlassHeader';
import OnboardingFloatingButton from '@/components/onboarding/OnboardingFloatingButton';
import OnboardingStepBar from '@/components/onboarding/OnboardingStepBar';
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
  responsiveFontSize,
  responsivePadding,
  responsiveSpacing,
  scale,
  verticalScale,
} from '@/utils/scaling';
const LinearGradient = LinearGradientFallback;
const BlurView = BlurViewFallback;

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

// Display-only ordering so brand-new players see the gentlest starts first.
// (We sort a copy for rendering — the source `scenarios` array and every lookup
// by id are untouched.)
const LIFE_PATH_DIFFICULTY_RANK: Record<string, number> = {
  Easy: 0,
  Moderate: 1,
  Hard: 2,
};

const rankLifePath = (scenario: OnboardingScenario): number => {
  // Pin the recommended beginner path to the very top, then easiest-first.
  if (scenario.id === RECOMMENDED_SCENARIO_ID) return -1;
  return LIFE_PATH_DIFFICULTY_RANK[scenario.difficulty] ?? 99;
};

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
      return '#22C55E';
    case 'medium':
      return '#F59E0B';
    case 'hard':
      return '#EF4444';
    case 'expert':
      return '#EF4444';
    default:
      return '#6B7280';
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

interface ScenarioCardViewProps {
  scenario: ScenarioCard;
  isSelected: boolean;
  onSelect: (scenario: ScenarioCard) => void;
}

// R-perf: memoized so selecting a scenario only re-renders the affected cards
// instead of the whole list (each card is a BlurView + LinearGradient).
const ScenarioCardView = React.memo(function ScenarioCardView({
  scenario,
  isSelected,
  onSelect,
}: ScenarioCardViewProps) {
  const isChallenge = 'isChallenge' in scenario && scenario.isChallenge;
  const isRecommended = !isChallenge && scenario.id === RECOMMENDED_SCENARIO_ID;
  const rewardGems = isChallenge ? scenario.rewardGems : 0;
  const difficultyColor = isChallenge
    ? safeGetDifficultyColor(scenario.difficultyKey)
    : scenario.difficulty === 'Easy'
      ? '#22C55E'
      : scenario.difficulty === 'Moderate'
        ? '#F59E0B'
        : scenario.difficulty === 'Hard'
          ? '#EF4444'
          : '#9CA3AF';
  const educationLabel =
    scenario.start.education && scenario.start.education !== 'None'
      ? scenario.start.education
      : 'No school';
  const startItems = scenario.start.items ?? [];
  const startTraits = scenario.start.traits ?? [];
  const hasStartingKit = startItems.length > 0 || startTraits.length > 0;

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      style={styles.cardContainer}
      onPress={() => onSelect(scenario)}
    >
      <BlurView intensity={20} style={styles.cardBlur}>
        <LinearGradient
          colors={
            isSelected
              ? ['rgba(245, 158, 11, 0.16)', 'rgba(249, 115, 22, 0.12)']
              : ['rgba(24, 20, 16, 0.92)', 'rgba(16, 13, 10, 0.92)']
          }
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[
            styles.card,
            isRecommended && !isSelected && styles.cardRecommended,
            isSelected && styles.cardSelected,
          ]}
        >
          <View style={styles.cardRow}>
            <View style={styles.iconWrap}>
              <Image source={scenario.icon} style={styles.iconImage} resizeMode="cover" />
              {isRecommended ? (
                <View style={styles.recBadge}>
                  <Star size={scale(11)} color="#1A1205" fill="#1A1205" />
                </View>
              ) : null}
            </View>

            <View style={styles.cardBody}>
              <View style={styles.cardTitleRow}>
                <Text style={styles.cardTitle} numberOfLines={1}>
                  {scenario.title}
                </Text>
                <View style={styles.difficultyPill}>
                  <View style={[styles.difficultyDot, { backgroundColor: difficultyColor }]} />
                  <Text style={[styles.difficultyLabel, { color: difficultyColor }]}>
                    {scenario.difficulty}
                  </Text>
                </View>
              </View>

              <Text style={styles.cardDescription} numberOfLines={isSelected ? undefined : 1}>
                {scenario.description}
              </Text>

              <View style={styles.statLine}>
                <Text style={styles.statText} numberOfLines={1}>
                  Age {scenario.start.age}   ·   {formatMoney(scenario.start.cash)}   ·   {educationLabel}
                </Text>
                {isChallenge ? (
                  <View style={styles.rewardRow}>
                    <Gem size={scale(12)} color="#FBBF24" />
                    <Text style={styles.rewardValue}>{rewardGems}</Text>
                  </View>
                ) : null}
              </View>
            </View>

            <View style={styles.cardRight}>
              {isSelected ? (
                <View style={styles.selectedCheck}>
                  <Check size={scale(15)} color="#1A1205" />
                </View>
              ) : (
                <ChevronRight size={scale(20)} color="#5B554C" />
              )}
            </View>
          </View>

          {isSelected ? (
            <View style={styles.detail}>
              <Text style={styles.detailGoal}>Goal: {scenario.lifeGoal}</Text>
              {hasStartingKit ? (
                <View>
                  <Text style={styles.detailLabel}>Starts with</Text>
                  <View style={styles.detailChips}>
                    {startItems.map((item) => (
                      <View key={`${scenario.id}-item-${item}`} style={styles.chip}>
                        <Text style={styles.chipText}>{formatTokenLabel(item)}</Text>
                      </View>
                    ))}
                    {startTraits.map((trait) => (
                      <View key={`${scenario.id}-trait-${trait}`} style={styles.traitChip}>
                        <Text style={styles.traitChipText}>{formatTokenLabel(trait)}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              ) : null}
            </View>
          ) : null}
        </LinearGradient>
      </BlurView>
    </TouchableOpacity>
  );
});

export default function Scenarios() {
  const log = logger.scope('Scenarios');
  const router = useRouter();
  const navigation = useNavigation();
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

  // Easiest-first, recommended pinned to the top. Stable for equal ranks so the
  // original authored order is preserved within a difficulty tier.
  const sortedLifePaths = useMemo<OnboardingScenario[]>(
    () =>
      [...LIFE_PATH_SCENARIOS]
        .map((scenario, index) => ({ scenario, index }))
        .sort((a, b) => rankLifePath(a.scenario) - rankLifePath(b.scenario) || a.index - b.index)
        .map((entry) => entry.scenario),
    []
  );

  const currentScenarios: ScenarioCard[] = activeTab === 'life_paths' ? sortedLifePaths : challengeScenarios;

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

  // R3-C: Android hardware back → same handler as the on-screen back button.
  useHardwareBack(() => {
    handleBack();
    return true;
  });

  // R-perf: a single STABLE selection handler passed to the memoized scenario
  // cards. Takes the scenario object directly — each card is rendered from the
  // canonical list, so the old id-lookup + not-found Alert was redundant.
  const onSelectScenario = useCallback(
    (scenario: ScenarioCard) => {
      haptic.selection();
      setSelectedId(scenario.id);
      if ('isChallenge' in scenario && scenario.isChallenge) {
        setState((prev) =>
          applyChallengeSelectionToOnboardingState(prev, scenario, CHALLENGE_FALLBACK_ICON)
        );
      } else {
        setState((prev) => applyLifePathSelectionToOnboardingState(prev, scenario));
      }
    },
    [setState]
  );

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
        {activeTab === 'life_paths'
          ? 'Pick how your life begins. New here? Tap the highlighted "Recommended" path at the top.'
          : 'Challenges add tougher goals and gem rewards — best once you know the game.'}
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
                ? ['#FBBF24', '#F97316']
                : ['rgba(24, 20, 16, 0.85)', 'rgba(16, 13, 10, 0.85)']
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
                : ['rgba(24, 20, 16, 0.85)', 'rgba(16, 13, 10, 0.85)']
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
        {currentScenarios.map((scenario) => (
          <ScenarioCardView
            key={scenario.id}
            scenario={scenario}
            isSelected={scenario.id === selectedId}
            onSelect={onSelectScenario}
          />
        ))}

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
    ...Platform.select({
      web: { boxShadow: '0px 4px 8px rgba(245, 158, 11, 0.3)' } as any,
      default: {
        shadowColor: '#F59E0B',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
    }),
    elevation: 4,
  },
  tabActiveRed: {
    ...Platform.select({
      web: { boxShadow: '0px 4px 8px rgba(239, 68, 68, 0.3)' } as any,
      default: {
        shadowColor: '#EF4444',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
    }),
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
    ...Platform.select({
      web: { boxShadow: '0px 8px 16px rgba(0, 0, 0, 0.3)' } as any,
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 16,
      },
    }),
    elevation: 12,
  },
  cardBlur: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  card: {
    padding: scale(13),
    // Match the parent's rounded clip so the border doesn't get sliced off at
    // the corners (square border inside an overflow:hidden rounded box). Border
    // width is kept constant across states so collapsed rows stay the same
    // height; only the selected card grows (to reveal goal + starting items).
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    gap: verticalScale(11),
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(12),
  },
  cardRecommended: {
    borderColor: 'rgba(245, 158, 11, 0.45)',
  },
  cardSelected: {
    borderColor: '#F59E0B',
  },
  iconWrap: {
    width: scale(52),
    height: scale(52),
  },
  iconImage: {
    width: scale(52),
    height: scale(52),
    borderRadius: 13,
  },
  recBadge: {
    position: 'absolute',
    top: scale(-6),
    right: scale(-6),
    width: scale(20),
    height: scale(20),
    borderRadius: scale(10),
    backgroundColor: '#FBBF24',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#0B0A08',
  },
  cardBody: {
    flex: 1,
    gap: verticalScale(4),
  },
  cardTitleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: scale(8),
  },
  cardTitle: {
    flex: 1,
    fontSize: fontScale(16),
    fontWeight: '700',
    color: '#FFFFFF',
  },
  difficultyPill: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: scale(5),
  },
  difficultyDot: {
    width: scale(7),
    height: scale(7),
    borderRadius: scale(4),
  },
  difficultyLabel: {
    fontSize: fontScale(11),
    fontWeight: '700',
  },
  cardDescription: {
    fontSize: fontScale(12.5),
    fontWeight: '500',
    color: '#9C948A',
    lineHeight: fontScale(16),
  },
  statLine: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: scale(8),
  },
  statText: {
    flexShrink: 1,
    fontSize: fontScale(12),
    fontWeight: '600',
    color: '#C9C0B4',
  },
  rewardRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: scale(4),
  },
  rewardValue: {
    fontSize: fontScale(12),
    fontWeight: '800',
    color: '#FBBF24',
  },
  cardRight: {
    width: scale(28),
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  selectedCheck: {
    alignItems: 'center',
    backgroundColor: '#F59E0B',
    borderRadius: scale(13),
    height: scale(26),
    justifyContent: 'center',
    width: scale(26),
  },
  detail: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
    paddingTop: verticalScale(11),
    gap: verticalScale(10),
  },
  detailGoal: {
    fontSize: fontScale(12.5),
    fontWeight: '700',
    color: '#FBBF24',
    lineHeight: fontScale(17),
  },
  detailLabel: {
    fontSize: fontScale(10.5),
    fontWeight: '700',
    color: '#8E8578',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    marginBottom: verticalScale(6),
  },
  detailChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: scale(7),
  },
  chip: {
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderColor: 'rgba(245, 158, 11, 0.3)',
    borderWidth: 1,
    borderRadius: 9,
    paddingHorizontal: scale(9),
    paddingVertical: verticalScale(5),
  },
  chipText: {
    fontSize: fontScale(11),
    fontWeight: '600',
    color: '#FBBF24',
  },
  traitChip: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderColor: 'rgba(255, 255, 255, 0.14)',
    borderWidth: 1,
    borderRadius: 9,
    paddingHorizontal: scale(9),
    paddingVertical: verticalScale(5),
  },
  traitChipText: {
    fontSize: fontScale(11),
    fontWeight: '600',
    color: '#C9C0B4',
  },
});
