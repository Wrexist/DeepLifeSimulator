import React, { useCallback, useMemo, useState } from 'react';
import { Alert, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { Check, Gem, Play, Sparkles, Target } from 'lucide-react-native';
import GlassActionButton from '@/components/onboarding/GlassActionButton';
import GlassPanel from '@/components/onboarding/GlassPanel';
import OnboardingScreenShell from '@/components/onboarding/OnboardingScreenShell';
import OnboardingTopBar from '@/components/onboarding/OnboardingTopBar';
import { useGame } from '@/contexts/GameContext';
import {
  getDifficultyColor,
  getDifficultyLabel,
  SCENARIOS as CHALLENGE_SCENARIOS,
  Scenario as ChallengeScenarioDefinition,
} from '@/lib/scenarios/scenarioDefinitions';
import { getOnboardingTheme } from '@/lib/config/onboardingTheme';
import { scenarios as LIFE_PATH_SCENARIOS, Scenario as OnboardingScenario } from '@/src/features/onboarding/scenarioData';
import { useOnboarding } from '@/src/features/onboarding/OnboardingContext';
import { logger } from '@/utils/logger';
import { formatMoney } from '@/utils/moneyFormatting';
import {
  fontScale,
  responsiveBorderRadius,
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

const BACKGROUND = require('@/assets/images/Main_Menu_3.png');
const CHALLENGE_FALLBACK_ICON = require('@/assets/images/Scenarios/Street Hustler.png');

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

export default function Scenarios() {
  const log = logger.scope('Scenarios');
  const router = useRouter();
  const navigation = useNavigation();
  const { gameState } = useGame();
  const { state, setState } = useOnboarding();
  const [activeTab, setActiveTab] = useState<TabType>(state.challengeScenarioId ? 'challenges' : 'life_paths');
  const [selectedId, setSelectedId] = useState<string | null>(state.scenario?.id ?? null);

  const isDarkMode = Boolean(gameState?.settings?.darkMode);
  const theme = getOnboardingTheme(isDarkMode);

  const challengeScenarios = useMemo<ChallengeScenarioCard[]>(() => {
    if (!Array.isArray(CHALLENGE_SCENARIOS)) {
      log.warn('Challenge scenarios missing or invalid.');
      return [];
    }

    const safeDifficultyLabel =
      typeof getDifficultyLabel === 'function'
        ? getDifficultyLabel
        : (difficulty: string) =>
            difficulty ? difficulty.charAt(0).toUpperCase() + difficulty.slice(1) : 'Unknown';

    return CHALLENGE_SCENARIOS.map((challenge) => {
      const firstCondition = challenge.winConditions[0];
      const education = Array.isArray(challenge.startingConditions.education)
        ? challenge.startingConditions.education[0]
        : undefined;
      const startItems = Array.isArray(challenge.startingConditions.items) ? challenge.startingConditions.items : [];
      const challengeIcon = typeof challenge.icon === 'string' ? challenge.icon : undefined;

      return {
        id: challenge.id,
        title: challenge.name,
        difficulty: safeDifficultyLabel(challenge.difficulty),
        lifeGoal:
          firstCondition && typeof firstCondition.description === 'string'
            ? firstCondition.description
            : 'Complete the challenge',
        description: challenge.description,
        bonus: `Rewards: ${challenge.rewards?.gems ?? 0} gems`,
        start: {
          age: challenge.startingConditions.age ?? 18,
          cash: challenge.startingConditions.money ?? 0,
          education,
          items: startItems,
          traits: [],
        },
        icon: CHALLENGE_FALLBACK_ICON,
        isChallenge: true,
        difficultyKey: challenge.difficulty,
        iconEmoji: challengeIcon,
        rewardGems: challenge.rewards?.gems ?? 0,
      };
    });
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

    setSelectedId(selected.id);
    setState((prev) => ({
      ...prev,
      scenario: selected,
      challengeScenarioId: undefined,
    }));
  };

  const selectChallenge = (scenarioId: string) => {
    const selected = challengeScenarios.find((entry) => entry.id === scenarioId);
    if (!selected) {
      Alert.alert('Selection Error', 'This challenge could not be loaded. Please try another option.');
      return;
    }

    setSelectedId(selected.id);
    setState((prev) => ({
      ...prev,
      scenario: {
        id: selected.id,
        title: selected.title,
        difficulty: selected.difficulty,
        lifeGoal: selected.lifeGoal,
        description: selected.description,
        bonus: selected.bonus,
        start: selected.start,
        icon: CHALLENGE_FALLBACK_ICON,
      },
      challengeScenarioId: selected.id,
    }));
  };

  const continueToCustomize = () => {
    if (!selectedScenario) {
      Alert.alert('Pick A Scenario', 'Choose a life path or challenge before continuing.');
      return;
    }
    router.push('/(onboarding)/Customize');
  };

  return (
    <OnboardingScreenShell backgroundSource={BACKGROUND}>
      <OnboardingTopBar
        title="Choose Scenario"
        subtitle="Select your starting conditions for this life."
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

      <GlassPanel strong style={styles.heroPanel}>
        <Text style={[styles.heroTitle, { color: theme.title }]}>Set The Story Premise</Text>
        <Text style={[styles.heroSubtitle, { color: theme.subtitle }]}>
          {activeTab === 'life_paths'
            ? 'Classic starts for your next life run.'
            : 'Harder modes with challenge IDs and reward tracking.'}
        </Text>
      </GlassPanel>

      <GlassPanel style={styles.tabPanel}>
        <View style={styles.tabRow}>
          <TouchableOpacity
            accessibilityRole="button"
            onPress={() => setActiveTab('life_paths')}
            style={[
              styles.tabButton,
              activeTab === 'life_paths'
                ? { borderColor: 'rgba(52, 211, 153, 0.5)', backgroundColor: 'rgba(16, 185, 129, 0.22)' }
                : undefined,
            ]}
          >
            <Target color={theme.title} size={scale(16)} />
            <Text style={[styles.tabText, { color: theme.title }]}>Life Paths</Text>
          </TouchableOpacity>

          <TouchableOpacity
            accessibilityRole="button"
            onPress={() => setActiveTab('challenges')}
            style={[
              styles.tabButton,
              activeTab === 'challenges'
                ? { borderColor: 'rgba(248, 113, 113, 0.55)', backgroundColor: 'rgba(239, 68, 68, 0.22)' }
                : undefined,
            ]}
          >
            <Sparkles color={theme.title} size={scale(16)} />
            <Text style={[styles.tabText, { color: theme.title }]}>Challenges</Text>
          </TouchableOpacity>
        </View>
      </GlassPanel>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {currentScenarios.map((scenario) => {
          const isSelected = scenario.id === selectedId;
          const isChallenge = 'isChallenge' in scenario && scenario.isChallenge;
          const rewardGems = isChallenge ? scenario.rewardGems : 0;
          const difficultyBadgeColor = isChallenge
            ? (() => {
                try {
                  return typeof getDifficultyColor === 'function'
                    ? getDifficultyColor(scenario.difficultyKey)
                    : fallbackDifficultyColor(scenario.difficultyKey);
                } catch {
                  return fallbackDifficultyColor(scenario.difficultyKey);
                }
              })()
            : theme.glassBorder;

          return (
            <TouchableOpacity
              key={scenario.id}
              activeOpacity={0.92}
              onPress={() => {
                if (isChallenge) {
                  selectChallenge(scenario.id);
                  return;
                }
                selectLifePath(scenario.id);
              }}
            >
              <GlassPanel style={[styles.card, isSelected ? styles.cardSelected : undefined]}>
                <View style={styles.cardHeader}>
                  <Image source={scenario.icon} style={styles.cardImage} />
                  <View style={styles.cardTextWrap}>
                    <View style={styles.cardTitleRow}>
                      <Text style={[styles.cardTitle, { color: theme.title }]}>{scenario.title}</Text>
                      {isChallenge ? (
                        <Text style={[styles.difficultyChip, { backgroundColor: difficultyBadgeColor }]}>
                          {scenario.difficulty.toUpperCase()}
                        </Text>
                      ) : null}
                    </View>
                    <Text style={[styles.cardDescription, { color: theme.subtitle }]}>{scenario.description}</Text>
                    <Text style={[styles.goalText, { color: theme.accentText }]}>Goal: {scenario.lifeGoal}</Text>
                  </View>
                  {isSelected ? (
                    <View style={[styles.selectedDot, { borderColor: theme.glassBorder }]}>
                      <Check size={scale(14)} color={theme.title} />
                    </View>
                  ) : null}
                </View>

                <View style={styles.statsRow}>
                  <View style={styles.statCell}>
                    <Text style={[styles.statLabel, { color: theme.subtitle }]}>Age</Text>
                    <Text style={[styles.statValue, { color: theme.title }]}>{scenario.start.age}</Text>
                  </View>
                  <View style={styles.statCell}>
                    <Text style={[styles.statLabel, { color: theme.subtitle }]}>Cash</Text>
                    <Text style={[styles.statValue, { color: theme.title }]}>{formatMoney(scenario.start.cash)}</Text>
                  </View>
                  <View style={styles.statCell}>
                    <Text style={[styles.statLabel, { color: theme.subtitle }]}>Study</Text>
                    <Text style={[styles.statValue, { color: theme.title }]}>
                      {scenario.start.education || 'None'}
                    </Text>
                  </View>
                  {isChallenge ? (
                    <View style={styles.statCell}>
                      <Text style={[styles.statLabel, { color: theme.subtitle }]}>Reward</Text>
                      <View style={styles.rewardRow}>
                        <Gem size={scale(13)} color="#FBBF24" />
                        <Text style={[styles.rewardValue, { color: theme.title }]}>{rewardGems}</Text>
                      </View>
                    </View>
                  ) : null}
                </View>

                {(scenario.start.items?.length || scenario.start.traits?.length || (isChallenge && scenario.iconEmoji)) ? (
                  <View style={styles.tagsWrap}>
                    {isChallenge && scenario.iconEmoji ? (
                      <View style={styles.tag}>
                        <Text style={[styles.tagText, { color: theme.accentText }]}>{scenario.iconEmoji} Challenge</Text>
                      </View>
                    ) : null}
                    {scenario.start.items?.map((item) => (
                      <View key={`${scenario.id}-item-${item}`} style={styles.tag}>
                        <Text style={[styles.tagText, { color: theme.accentText }]}>
                          {getScenarioItemIcon(item)} {formatTokenLabel(item)}
                        </Text>
                      </View>
                    ))}
                    {scenario.start.traits?.map((trait) => (
                      <View key={`${scenario.id}-trait-${trait}`} style={styles.tag}>
                        <Text style={[styles.tagText, { color: theme.accentText }]}>TRAIT {formatTokenLabel(trait)}</Text>
                      </View>
                    ))}
                  </View>
                ) : null}
              </GlassPanel>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <GlassActionButton
        disabled={!selectedScenario}
        highlighted
        icon={<Play color={theme.title} size={scale(22)} />}
        onPress={continueToCustomize}
        subtitle={
          selectedScenario
            ? `Continue with ${selectedScenario.title}`
            : 'Select a life path or challenge to continue'
        }
        title="Continue To Identity"
      />
    </OnboardingScreenShell>
  );
}

const styles = StyleSheet.create({
  heroPanel: {
    marginBottom: responsiveSpacing.md,
  },
  heroTitle: {
    fontSize: fontScale(20),
    fontWeight: '800',
    marginBottom: verticalScale(4),
  },
  heroSubtitle: {
    fontSize: fontScale(12),
    fontWeight: '500',
    lineHeight: fontScale(16),
  },
  tabPanel: {
    marginBottom: responsiveSpacing.md,
    padding: responsiveSpacing.sm,
  },
  tabRow: {
    flexDirection: 'row',
    gap: responsiveSpacing.sm,
  },
  tabButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.22)',
    borderColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: responsiveBorderRadius.lg,
    borderWidth: 1,
    flex: 1,
    flexDirection: 'row',
    gap: responsiveSpacing.xs,
    justifyContent: 'center',
    paddingVertical: verticalScale(10),
  },
  tabText: {
    fontSize: fontScale(12),
    fontWeight: '700',
  },
  scrollContent: {
    gap: responsiveSpacing.md,
    paddingBottom: responsiveSpacing.md,
  },
  card: {
    gap: responsiveSpacing.sm,
  },
  cardSelected: {
    borderWidth: 1.7,
  },
  cardHeader: {
    flexDirection: 'row',
    gap: responsiveSpacing.sm,
  },
  cardImage: {
    borderRadius: responsiveBorderRadius.lg,
    height: scale(74),
    width: scale(74),
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
    fontSize: fontScale(17),
    fontWeight: '800',
  },
  difficultyChip: {
    borderRadius: responsiveBorderRadius.full,
    color: '#FFFFFF',
    fontSize: fontScale(9),
    fontWeight: '800',
    overflow: 'hidden',
    paddingHorizontal: responsiveSpacing.xs,
    paddingVertical: verticalScale(4),
  },
  cardDescription: {
    fontSize: fontScale(12),
    fontWeight: '500',
    lineHeight: fontScale(16),
    marginBottom: verticalScale(3),
  },
  goalText: {
    fontSize: fontScale(11),
    fontWeight: '700',
    lineHeight: fontScale(15),
  },
  selectedDot: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.13)',
    borderRadius: responsiveBorderRadius.full,
    borderWidth: 1,
    height: scale(24),
    justifyContent: 'center',
    width: scale(24),
  },
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: responsiveSpacing.xs,
  },
  statCell: {
    backgroundColor: 'rgba(15, 23, 42, 0.28)',
    borderRadius: responsiveBorderRadius.md,
    flex: 1,
    minWidth: scale(70),
    paddingHorizontal: responsiveSpacing.xs,
    paddingVertical: verticalScale(8),
  },
  statLabel: {
    fontSize: fontScale(10),
    fontWeight: '600',
    marginBottom: verticalScale(2),
  },
  statValue: {
    fontSize: fontScale(11),
    fontWeight: '800',
  },
  rewardRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: responsiveSpacing.xs,
  },
  rewardValue: {
    fontSize: fontScale(11),
    fontWeight: '800',
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
  },
});
