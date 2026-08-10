import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Platform, Alert, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View, type ImageSourcePropType } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { useHardwareBack } from '@/hooks/useHardwareBack';
import {
  Backpack,
  Bike,
  Check,
  Dumbbell,
  Gem,
  IdCard,
  Laptop,
  Play,
  Shirt,
  Smartphone,
  Sparkles,
  Star,
  Target,
} from 'lucide-react-native';
import Gradient from '@/components/ui/Gradient';
import BlurViewFallback from '@/components/fallbacks/BlurViewFallback';
import OnboardingScreenShellV2 from '@/components/onboarding/OnboardingScreenShellV2';
import OnboardingGlassHeader from '@/components/onboarding/OnboardingGlassHeader';
import OnboardingFloatingButton from '@/components/onboarding/OnboardingFloatingButton';
import OnboardingStepBar from '@/components/onboarding/OnboardingStepBar';
import ImageScrim from '@/components/ui/ImageScrim';
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
import { GameModePicker } from '@/components/onboarding/GameModePicker';
import type { GameMode } from '@/contexts/game/types';
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
const LinearGradient = Gradient;
const BlurView = BlurViewFallback;

type TabType = 'life_paths' | 'challenges';

interface ChallengeScenarioCard extends OnboardingScenario {
  isChallenge: true;
  difficultyKey: ChallengeScenarioDefinition['difficulty'];
  iconEmoji?: string;
  rewardGems: number;
}

type ScenarioCard = OnboardingScenario | ChallengeScenarioCard;

const CHALLENGE_FALLBACK_ICON = require('@/assets/images/Scenarios/Street Hustler.webp');

// Challenges have no artwork of their own, so reuse the existing Scenarios
// paintings that best fit each challenge's fantasy instead of showing the same
// Street Hustler fallback on every card. Keyed by CHALLENGE_SCENARIOS id.
const CHALLENGE_ICONS: Record<string, ImageSourcePropType> = {
  rags_to_riches: require('@/assets/images/Scenarios/Rags to Riches_final.webp'),
  academic_excellence: require('@/assets/images/Scenarios/Corporate Intern.webp'),
  social_butterfly: require('@/assets/images/Scenarios/Influencer Wannabe.webp'),
  entrepreneur: require('@/assets/images/Scenarios/Aspiring Entrepreneur.webp'),
  family_focused: require('@/assets/images/Scenarios/Single Parent_final.webp'),
  single_parent: require('@/assets/images/Scenarios/Single Parent_final.webp'),
  criminal_empire: require('@/assets/images/Scenarios/Street Hustler.webp'),
  political_dynasty: require('@/assets/images/Scenarios/Corporate Intern.webp'),
  tech_mogul: require('@/assets/images/Scenarios/Aspiring Entrepreneur.webp'),
  real_estate_tycoon: require('@/assets/images/Scenarios/Trust Fund Baby_final.webp'),
  speedrun: require('@/assets/images/Scenarios/Uber Driver.webp'),
  balanced_life: require('@/assets/images/Scenarios/Fitness Enthusiast.webp'),
  debt_escape: require('@/assets/images/Scenarios/Second Chance_final.webp'),
  fame_seeker: require('@/assets/images/Scenarios/Aspiring Streamer.webp'),
};

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
      return '#10B981';
    case 'medium':
      return '#3B82F6';
    case 'hard':
      return '#F59E0B';
    case 'expert':
      return '#EF4444';
    default:
      return '#94A3B8';
  }
};

// Starting-item chips use the same lucide icon set as the rest of the game UI
// (crisp line icons on the blue accent) instead of platform emoji, which render
// inconsistently and clash with the dark design.
const SCENARIO_ITEM_ICONS: Record<string, React.ComponentType<{ size?: number; color?: string }>> = {
  smartphone: Smartphone,
  driver_license: IdCard,
  business_suit: Shirt,
  suit: Shirt,
  gym_membership: Dumbbell,
  computer: Laptop,
  bike: Bike,
};

const getScenarioItemIcon = (itemId: string): React.ComponentType<{ size?: number; color?: string }> => {
  return SCENARIO_ITEM_ICONS[itemId] ?? Backpack;
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
  const difficultyBadgeColor = isChallenge
    ? safeGetDifficultyColor(scenario.difficultyKey)
    : '#94A3B8';
  const difficultyColor =
    scenario.difficulty === 'Easy'
      ? '#10B981'
      : scenario.difficulty === 'Moderate'
        ? '#3B82F6'
        : scenario.difficulty === 'Hard'
          ? '#F59E0B'
          : '#94A3B8';

  return (
    <TouchableOpacity
      activeOpacity={0.92}
      style={styles.cardContainer}
      onPress={() => onSelect(scenario)}
      accessibilityRole="button"
      accessibilityLabel={`${scenario.title}, ${scenario.difficulty} difficulty${isSelected ? ', selected' : ''}`}
    >
      <BlurView intensity={20} style={styles.cardBlur}>
        <LinearGradient
          colors={
            isSelected
              ? ['rgba(59, 130, 246,0.2)', 'rgba(37, 99, 235,0.2)']
              : ['rgba(30, 41, 59, 0.9)', 'rgba(15, 23, 42, 0.8)']
          }
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.card, isSelected && styles.cardSelected]}
        >
          {/* Hero artwork — the scenario's own painting, full-bleed, under a
              bottom FADE so the title and difficulty read cleanly without
              hiding the art. This used to be one flat 90%-opaque band across
              the bottom 55%, which blacked out over half of every painting
              behind a hard horizontal edge. */}
          <View style={styles.heroWrap}>
            <Image source={scenario.icon} style={styles.heroImage} resizeMode="cover" />
            <ImageScrim height={0.42} strength={0.72} />
            {isRecommended ? (
              <View style={styles.recommendedPill}>
                <Star size={11} color="#60A5FA" />
                <Text style={styles.recommendedPillText}>RECOMMENDED</Text>
              </View>
            ) : null}
            {isSelected ? (
              <View style={styles.selectedDot}>
                <Check size={scale(14)} color="#3B82F6" />
              </View>
            ) : null}
            <View style={styles.heroTitleRow}>
              <Text style={styles.cardTitle} numberOfLines={1}>
                {scenario.title}
              </Text>
              <View style={[styles.difficultyChip, { backgroundColor: isChallenge ? difficultyBadgeColor : difficultyColor }]}>
                <Text style={styles.difficultyText}>{scenario.difficulty.toUpperCase()}</Text>
              </View>
            </View>
          </View>

          <View style={styles.cardBody}>
            <Text style={styles.cardDescription} numberOfLines={2}>
              {scenario.description}
            </Text>
            <Text style={styles.goalText} numberOfLines={1}>
              Goal: {scenario.lifeGoal}
            </Text>

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
                <Text style={styles.statValue}>{scenario.start.education || 'None'}</Text>
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

            {scenario.start.items?.length ||
            scenario.start.traits?.length ||
            (isChallenge && scenario.iconEmoji) ? (
              <View style={styles.tagsWrap}>
                {isChallenge && scenario.iconEmoji ? (
                  <View style={styles.tag}>
                    <Text style={styles.tagText}>{scenario.iconEmoji} Challenge</Text>
                  </View>
                ) : null}
                {scenario.start.items?.map((item) => {
                  const ItemIcon = getScenarioItemIcon(item);
                  return (
                    <View key={`${scenario.id}-item-${item}`} style={styles.tag}>
                      <ItemIcon size={fontScale(12)} color="#60A5FA" />
                      <Text style={styles.tagText}>{formatTokenLabel(item)}</Text>
                    </View>
                  );
                })}
                {scenario.start.traits?.map((trait) => (
                  <View key={`${scenario.id}-trait-${trait}`} style={styles.tag}>
                    <Sparkles size={fontScale(12)} color="#60A5FA" />
                    <Text style={styles.tagText}>{formatTokenLabel(trait)}</Text>
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        </LinearGradient>
      </BlurView>
    </TouchableOpacity>
  );
});

// Module-scope so it is a STABLE reference. Creating it in the component body
// returned a fresh ScopedLogger every render, which invalidated the
// challengeScenarios `useMemo` (dep [log]) on every render and defeated the
// downstream ScenarioCardView memoization the Challenges tab relies on.
const log = logger.scope('Scenarios');

export default function Scenarios() {
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
        icon: CHALLENGE_ICONS[challengeId] ?? CHALLENGE_FALLBACK_ICON,
        isChallenge: true,
        difficultyKey,
        iconEmoji: challengeIcon,
        rewardGems,
      };
    }).filter((scenario): scenario is ChallengeScenarioCard => scenario !== null);
  }, []);

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

  const onSelectGameMode = useCallback(
    (mode: GameMode) => setState((prev) => ({ ...prev, gameMode: mode })),
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

      <OnboardingStepBar currentStep={1} totalSteps={4} />

      <Text style={styles.guidanceText}>
        {activeTab === 'life_paths'
          ? 'Pick how your life begins. New here? Tap the "Recommended" path at the top.'
          : 'Challenges add tougher goals and gem rewards — best once you know the game.'}
      </Text>

      {/* Tab Selector */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'life_paths' && styles.tabActive]}
          onPress={() => { haptic.light(); setActiveTab('life_paths'); }}
          accessibilityRole="tab"
          accessibilityState={{ selected: activeTab === 'life_paths' }}
          accessibilityLabel="Life Paths"
        >
          <LinearGradient
            colors={
              activeTab === 'life_paths'
                ? ['#3B82F6', '#2563EB']
                : ['rgba(30, 41, 59, 0.8)', 'rgba(15, 23, 42, 0.8)']
            }
            style={styles.tabGradient}
          >
            <Target size={18} color={activeTab === 'life_paths' ? '#FFFFFF' : '#94A3B8'} />
            <Text style={[styles.tabText, activeTab === 'life_paths' && styles.tabTextActive]}>
              Life Paths
            </Text>
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'challenges' && styles.tabActive]}
          onPress={() => { haptic.light(); setActiveTab('challenges'); }}
          accessibilityRole="tab"
          accessibilityState={{ selected: activeTab === 'challenges' }}
          accessibilityLabel="Challenges"
        >
          <LinearGradient
            colors={
              activeTab === 'challenges'
                ? ['#3B82F6', '#2563EB']
                : ['rgba(30, 41, 59, 0.8)', 'rgba(15, 23, 42, 0.8)']
            }
            style={styles.tabGradient}
          >
            <Sparkles size={18} color={activeTab === 'challenges' ? '#FFFFFF' : '#94A3B8'} />
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

        {/* Pace is orthogonal to which life you start, so it sits below the
            scenarios rather than competing with them for the first choice. It
            still has to be HERE, at the start of a run, because the mode is
            fixed for the life. */}
        <GameModePicker
          value={state.gameMode}
          onChange={onSelectGameMode}
        />

        {/* Clears the pinned "Continue" bar, AND leaves enough travel that the
            last section can be scrolled fully clear of the sticky tab row above.
            At 140 the pace picker was the final block, so max scroll still left
            its heading cut in half under the tabs — the section could never be
            read in full. */}
        <View style={{ height: 260 }} />
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
      web: { boxShadow: '0px 4px 8px rgba(59, 130, 246,0.3)' } as any,
      default: {
        shadowColor: '#3B82F6',
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
    color: '#94A3B8',
  },
  tabTextActive: {
    color: '#FFFFFF',
  },
  guidanceText: {
    fontSize: fontScale(13),
    fontWeight: '500',
    color: '#94A3B8',
    textAlign: 'center',
    paddingHorizontal: responsivePadding.large,
    paddingBottom: responsiveSpacing.xs,
  },
  recommendedPill: {
    position: 'absolute',
    top: 10,
    left: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(15, 23, 42, 0.78)',
    borderWidth: 1,
    borderColor: 'rgba(96, 165, 250, 0.6)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: responsiveBorderRadius.full,
  },
  recommendedPillText: {
    fontSize: fontScale(10),
    fontWeight: '800',
    color: '#60A5FA',
    letterSpacing: 0.6,
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
    // Hero image is full-bleed, so the card clips its children to the rounded
    // corners and the body supplies its own padding (no card-level padding).
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    overflow: 'hidden',
  },
  cardSelected: {
    borderColor: 'rgba(96, 165, 250, 0.85)',
    borderWidth: 2,
  },
  heroWrap: {
    position: 'relative',
    width: '100%',
    height: scale(150),
    backgroundColor: '#0F172A',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  // (the flat `heroScrim` band is gone — see ImageScrim in the hero above)
  heroTitleRow: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: responsiveSpacing.xs,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  cardBody: {
    padding: 16,
    gap: responsiveSpacing.sm,
  },
  cardTitle: {
    flex: 1,
    fontSize: responsiveFontSize.xl,
    fontWeight: '800',
    color: '#FFFFFF',
    textShadowColor: 'rgba(0, 0, 0, 0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
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
    color: '#CBD5E1',
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
    position: 'absolute',
    top: 10,
    right: 10,
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    borderRadius: 20,
    borderWidth: 2,
    borderColor: 'rgba(96, 165, 250, 0.85)',
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
    color: '#94A3B8',
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
    alignItems: 'center',
    flexDirection: 'row',
    gap: scale(5),
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: responsiveBorderRadius.full,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: responsiveSpacing.sm,
    paddingVertical: verticalScale(5),
  },
  tagText: {
    fontSize: fontScale(10),
    fontWeight: '700',
    color: '#60A5FA',
  },
});
