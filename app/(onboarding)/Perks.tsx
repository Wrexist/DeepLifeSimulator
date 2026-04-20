import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
  Dimensions,
  Animated,
  Easing,
  Platform,
  Alert,
} from 'react-native';
import LinearGradientFallback from '@/components/fallbacks/LinearGradientFallback';
const LinearGradient = LinearGradientFallback;
import BlurViewFallback from '@/components/fallbacks/BlurViewFallback';
const BlurView = BlurViewFallback;
import { useRouter, useNavigation } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { perks } from '@/src/features/onboarding/perksData';
import { useOnboarding } from '@/src/features/onboarding/OnboardingContext';
import { useGame, initialGameState, STATE_VERSION } from '@/contexts/GameContext';
import { type MindsetId, type MindsetTrait, MINDSET_TRAITS } from '@/lib/mindset/config';
import {
  Lock,
  Check,
  ArrowLeft,
  ArrowRight,
  Gift,
  Brain,
  Info,
  Star,
} from 'lucide-react-native';

import OnboardingStepBar from '@/components/onboarding/OnboardingStepBar';
import { useOnboardingFlowGuard } from '@/hooks/useOnboardingFlowGuard';

// Extracted modules
import { buildNewGameState } from '@/src/features/onboarding/gameStateBuilder';
import {
  sortPerksByUnlockStatus,
  isPerkLocked,
  isPerkPermanent,
  getPerkBenefits,
  getStatColor,
} from '@/src/features/onboarding/perksFlow';
import {
  validateOnboardingInputs,
  initializeAndSaveGame,
} from '@/src/features/onboarding/gameInitializer';
import {
  logOnboardingStepView,
  logOnboardingValidationError,
} from '@/src/features/onboarding/onboardingAnalytics';

type TabType = 'perks' | 'mindset';

const RECOMMENDED_MINDSETS = ['optimist', 'frugal', 'riskAverse'];
import {
  responsiveFontSize,
  responsivePadding,
  responsiveSpacing,
  scale,
} from '@/utils/scaling';
import { formatMoney } from '@/utils/moneyFormatting';
import { haptic } from '@/utils/haptics';
import { logger } from '@/utils/logger';
import { validateOnboardingState, applySafeDefaults } from '@/utils/onboardingValidation';
import { validateGameEntry } from '@/utils/gameEntryValidation';
import { forceSave } from '@/utils/saveQueue';
import { createBackupFromState } from '@/utils/saveBackup';
import { isSaveSigningConfigError } from '@/utils/saveValidation';
import { IAPService } from '@/services/IAPService';

const { width: screenWidth } = Dimensions.get('window');
const NATIVE_OK = Platform.OS !== 'web';
const log = logger.scope('Perks');

// Lazy-loaded lucide icons for stat display (avoids importing all at top level)
const getStatIcon = (stat: string) => {
  switch (stat) {
    case 'happiness':
      return require('lucide-react-native').Heart;
    case 'health':
      return require('lucide-react-native').Shield;
    case 'energy':
      return require('lucide-react-native').Zap;
    case 'fitness':
      return require('lucide-react-native').TrendingUp;
    case 'reputation':
      return require('lucide-react-native').Users;
    case 'money':
    case 'Starting Money':
      return require('lucide-react-native').DollarSign;
    case 'Income Boost':
      return require('lucide-react-native').TrendingUp;
    default:
      return require('lucide-react-native').TrendingUp;
  }
};

export default function Perks() {
  const { state, setState } = useOnboarding();
  const { gameState, loadGame } = useGame();
  const router = useRouter();
  const navigation = useNavigation();
  useOnboardingFlowGuard('Perks');

  useEffect(() => {
    logOnboardingStepView('Perks');
  }, []);

  const insets = useSafeAreaInsets();
  const [selected, setSelected] = useState<string[]>(state.perks);
  const [permanentPerks, setPermanentPerks] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<TabType>('perks');
  const [selectedMindset, setSelectedMindset] = useState<MindsetId | null>(null);

  const handleBack = useCallback(() => {
    if (navigation.canGoBack()) {
      router.back();
    } else {
      router.replace('/(onboarding)/MainMenu');
    }
  }, [navigation, router]);

  // Load permanent perks on mount
  useEffect(() => {
    const loadPermanentPerks = async () => {
      try {
        const perks = await IAPService.loadPermanentPerks();
        setPermanentPerks(perks);
        if (perks.length > 0) log.info('Loaded permanent perks', { perks });
      } catch (error) {
        log.error('Error loading permanent perks:', error);
      }
    };
    loadPermanentPerks();
  }, []);

  // Sorted perks using extracted logic
  const sortedPerks = useMemo(
    () => sortPerksByUnlockStatus(perks, permanentPerks, gameState.achievements || []),
    [gameState.achievements, permanentPerks]
  );

  // Animations (transform/opacity only)
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;

  // Rotating background
  useEffect(() => {
    let isMounted = true;
    let rotateLoop: Animated.CompositeAnimation | null = null;
    try {
      rotateLoop = Animated.loop(
        Animated.timing(rotateAnim, {
          toValue: 1,
          duration: 30000,
          easing: Easing.linear,
          useNativeDriver: NATIVE_OK,
        })
      );
      if (isMounted && rotateLoop) rotateLoop.start();
    } catch (error) {
      log.error('Error starting rotate animation:', error);
    }
    return () => {
      isMounted = false;
      rotateLoop?.stop();
    };
  }, [rotateAnim]);

  // Fade in + slide up
  useEffect(() => {
    let isMounted = true;
    let parallel: Animated.CompositeAnimation | null = null;
    try {
      parallel = Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 1000,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: NATIVE_OK,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 1000,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: NATIVE_OK,
        }),
      ]);
      if (isMounted && parallel) parallel.start();
    } catch (error) {
      log.error('Error starting fade/slide animation:', error);
    }
    return () => {
      isMounted = false;
      parallel?.stop();
    };
  }, [fadeAnim, slideAnim]);

  const toggle = (id: string) => {
    haptic.selection();
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  };

  const start = async () => {
    haptic.heavy();
    log.info('Start button pressed', {
      selectedPerks: selected.length,
      selectedMindset,
      scenarioId: state.scenario?.id,
    });

    // Validate inputs using extracted module
    const inputCheck = validateOnboardingInputs({
      scenario: state.scenario,
      firstName: state.firstName,
      lastName: state.lastName,
      sex: state.sex,
      sexuality: state.sexuality,
    });
    if (!inputCheck.valid) {
      haptic.error();
      log.error(inputCheck.errorTitle!, { state });
      logOnboardingValidationError('Perks', inputCheck.errorTitle || 'input_invalid', {
        message: inputCheck.errorMessage,
      });
      Alert.alert(inputCheck.errorTitle!, inputCheck.errorMessage!, [{ text: 'OK' }]);
      return;
    }

    // Build game state using extracted module
    const newState = buildNewGameState({
      initialGameState,
      stateVersion: STATE_VERSION,
      firstName: state.firstName,
      lastName: state.lastName,
      sex: state.sex,
      sexuality: state.sexuality,
      scenario: {
        id: state.scenario!.id,
        start: state.scenario!.start,
      },
      challengeScenarioId: state.challengeScenarioId,
      selectedPerks: selected,
      permanentPerks,
      selectedMindset,
    });

    const slotToUse = state.slot || 1;
    const createBackupForOnboarding = async (
      slot: number,
      stateToSave: any,
      tag: string
    ): Promise<void> => {
      await createBackupFromState(slot, stateToSave, tag);
    };
    const forceSaveForOnboarding = async (
      slot: number,
      stateToSave: any
    ): Promise<void> => {
      await forceSave(slot, stateToSave);
    };

    // Initialize, save, load, and validate using extracted module
    const result = await initializeAndSaveGame(newState, slotToUse, {
      validateOnboardingState,
      applySafeDefaults,
      createBackupFromState: createBackupForOnboarding,
      forceSave: forceSaveForOnboarding,
      loadGame,
      validateGameEntry,
      isSaveSigningConfigError,
    });

    if (!result.success) {
      haptic.error();
      Alert.alert(result.errorTitle!, result.errorMessage!, [{ text: 'OK' }]);
      return;
    }

    haptic.success();
    setState((prev) => ({ ...prev, perks: selected }));
    setTimeout(() => {
      router.replace('/(tabs)');
    }, 100);
  };

  const rotateInterpolate = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <View style={styles.container}>
      {/* Animated background circles */}
      <Animated.View
        style={[
          styles.backgroundGradient1,
          { transform: [{ rotate: rotateInterpolate }] },
        ]}
      />
      <Animated.View
        style={[
          styles.backgroundGradient2,
          { transform: [{ rotate: rotateInterpolate }] },
        ]}
      />

      {/* Main content */}
      <Animated.View
        style={[
          styles.content,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
            paddingTop: 50 + insets.top,
          },
        ]}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity accessibilityLabel="Go back" onPress={handleBack} style={styles.backButton}>
            <View style={styles.glassButton}>
              <View style={styles.glassOverlay} />
              <View style={styles.glassIconContainer}>
                <ArrowLeft size={24} color="#FFFFFF" />
              </View>
            </View>
          </TouchableOpacity>
          <Text style={styles.title}>
            {activeTab === 'perks' ? 'Choose Perks' : 'Choose Mindset'}
          </Text>
          <TouchableOpacity
            accessibilityLabel="More information"
            onPress={() =>
              Alert.alert(
                activeTab === 'perks' ? 'Perks' : 'Mindset',
                activeTab === 'perks'
                  ? 'Select perks that will give you advantages in your new life. Choose as many as you want!'
                  : 'Select one mindset trait that will influence your gameplay with unique bonuses and penalties. This is optional.'
              )
            }
            style={styles.infoButton}
          >
            <View style={styles.glassButton}>
              <View style={styles.glassOverlay} />
              <View style={styles.glassIconContainer}>
                <Info size={20} color="#FFFFFF" />
              </View>
            </View>
          </TouchableOpacity>
        </View>

        <OnboardingStepBar currentStep={3} totalSteps={3} />

        <Text style={styles.guidanceText}>
          {activeTab === 'perks'
            ? 'Perks unlock through achievements. Skip this on your first game!'
            : 'Pick a mindset to shape how you play. This is optional.'}
        </Text>

        {/* Tab Selector */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'perks' && styles.tabActive]}
            onPress={() => { haptic.light(); setActiveTab('perks'); }}
          >
            <LinearGradient
              colors={
                activeTab === 'perks'
                  ? ['#10B981', '#059669']
                  : ['rgba(31, 41, 55, 0.8)', 'rgba(17, 24, 39, 0.8)']
              }
              style={styles.tabGradient}
            >
              <Gift
                size={18}
                color={activeTab === 'perks' ? '#FFFFFF' : '#9CA3AF'}
              />
              <Text
                style={[
                  styles.tabText,
                  activeTab === 'perks' && styles.tabTextActive,
                ]}
              >
                Perks
              </Text>
              {selected.length > 0 && (
                <View style={styles.tabBadge}>
                  <Text style={styles.tabBadgeText}>{selected.length}</Text>
                </View>
              )}
            </LinearGradient>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'mindset' && styles.tabActive]}
            onPress={() => { haptic.light(); setActiveTab('mindset'); }}
          >
            <LinearGradient
              colors={
                activeTab === 'mindset'
                  ? ['#8B5CF6', '#7C3AED']
                  : ['rgba(31, 41, 55, 0.8)', 'rgba(17, 24, 39, 0.8)']
              }
              style={styles.tabGradient}
            >
              <Brain
                size={18}
                color={activeTab === 'mindset' ? '#FFFFFF' : '#9CA3AF'}
              />
              <Text
                style={[
                  styles.tabText,
                  activeTab === 'mindset' && styles.tabTextActive,
                ]}
              >
                Mindset
              </Text>
              {selectedMindset && (
                <View style={[styles.tabBadge, { backgroundColor: '#8B5CF6' }]}>
                  <Text style={styles.tabBadgeText}>1</Text>
                </View>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.scrollContainer}
          contentContainerStyle={{ paddingTop: 8 }}
          showsVerticalScrollIndicator={true}
        >
          <View style={styles.scrollContent}>
            {activeTab === 'perks' ? (
              <View style={styles.perksContainer}>
                {sortedPerks.map((perk) => {
                  const isSelected = selected.includes(perk.id);
                  const perkIsPermanent = isPerkPermanent(
                    perk.id,
                    permanentPerks
                  );
                  const perkIsLocked = isPerkLocked(
                    perk,
                    permanentPerks,
                    gameState.achievements || []
                  );
                  const benefits = getPerkBenefits(perk);

                  return (
                    <TouchableOpacity
                      key={perk.id}
                      style={styles.perkContainer}
                      onPress={() =>
                        !perkIsLocked && !perkIsPermanent && toggle(perk.id)
                      }
                      disabled={perkIsLocked || perkIsPermanent}
                    >
                      <BlurView intensity={20} style={styles.perkBlur}>
                        <LinearGradient
                          colors={
                            perkIsPermanent
                              ? [
                                  'rgba(245, 158, 11, 0.3)',
                                  'rgba(217, 119, 6, 0.3)',
                                ]
                              : isSelected
                                ? [
                                    'rgba(16, 185, 129, 0.2)',
                                    'rgba(5, 150, 105, 0.2)',
                                  ]
                                : perkIsLocked
                                  ? [
                                      'rgba(75, 85, 99, 0.6)',
                                      'rgba(55, 65, 81, 0.6)',
                                    ]
                                  : [
                                      'rgba(31, 41, 55, 0.8)',
                                      'rgba(17, 24, 39, 0.8)',
                                    ]
                          }
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                          style={[
                            styles.perkCard,
                            perkIsLocked && styles.lockedPerkCard,
                            perkIsPermanent && styles.permanentPerkCard,
                          ]}
                        >
                          {perkIsPermanent && (
                            <View style={styles.permanentBadge}>
                              <Text style={styles.permanentBadgeText}>
                                ⭐ PERMANENT
                              </Text>
                            </View>
                          )}
                          <View style={styles.perkHeader}>
                            <View style={styles.iconSection}>
                              <View style={styles.iconContainer}>
                                <Image
                                  source={perk.icon}
                                  style={styles.perkIcon}
                                />
                              </View>
                              {perkIsLocked ? (
                                <View style={styles.statusIconContainer}>
                                  <Lock size={32} color="#6B7280" />
                                </View>
                              ) : perkIsPermanent ? (
                                <View style={styles.statusIconContainer}>
                                  <Check size={32} color="#F59E0B" />
                                </View>
                              ) : isSelected ? (
                                <View style={styles.statusIconContainer}>
                                  <Check size={32} color="#10B981" />
                                </View>
                              ) : null}
                            </View>

                            <View style={styles.perkInfo}>
                              <View style={styles.perkTitleRow}>
                                <Text
                                  style={[
                                    styles.perkTitle,
                                    perkIsLocked && styles.lockedPerkTitle,
                                  ]}
                                >
                                  {perk.title}
                                </Text>
                                <View style={styles.glassRarityBadge}>
                                  <View style={styles.glassOverlay} />
                                  <Text
                                    style={[
                                      styles.rarityText,
                                      {
                                        color:
                                          perk.rarity === 'Legendary'
                                            ? '#F59E0B'
                                            : perk.rarity === 'Epic'
                                              ? '#8B5CF6'
                                              : perk.rarity === 'Rare'
                                                ? '#3B82F6'
                                                : '#10B981',
                                      },
                                    ]}
                                  >
                                    {perk.rarity}
                                  </Text>
                                </View>
                              </View>

                              <Text
                                style={[
                                  styles.perkDescription,
                                  perkIsLocked && styles.lockedPerkDescription,
                                ]}
                              >
                                {perk.description}
                              </Text>
                              {perk.unlock && perkIsLocked && (
                                <Text style={styles.requirementText}>
                                  🔑 Requires achievement:{' '}
                                  {perk.unlock.achievementId}
                                </Text>
                              )}
                            </View>
                          </View>

                          {benefits.length > 0 && (
                            <View style={styles.benefitsContainer}>
                              {benefits.map((benefit, index) => {
                                const Icon = getStatIcon(benefit.stat);
                                const displayValue =
                                  benefit.type === 'start'
                                    ? `+${formatMoney(benefit.value)}`
                                    : benefit.type === 'income'
                                      ? `+${benefit.value}%`
                                      : `+${benefit.value}`;

                                const displayStat =
                                  benefit.stat === 'Starting Money'
                                    ? 'Starting Money'
                                    : benefit.stat === 'Income Boost'
                                      ? 'Income Boost'
                                      : benefit.stat;

                                return (
                                  <View
                                    key={index}
                                    style={styles.glassBenefitItem}
                                  >
                                    <View style={styles.glassOverlay} />
                                    <Icon
                                      size={16}
                                      color={getStatColor(benefit.stat)}
                                    />
                                    <Text
                                      style={[
                                        styles.benefitText,
                                        { color: getStatColor(benefit.stat) },
                                      ]}
                                    >
                                      {displayValue} {displayStat}
                                    </Text>
                                  </View>
                                );
                              })}
                            </View>
                          )}
                        </LinearGradient>
                      </BlurView>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ) : (
              <View style={styles.perksContainer}>
                {MINDSET_TRAITS.map((trait: MindsetTrait) => {
                  const isSelected = selectedMindset === trait.id;
                  const isRecommended = RECOMMENDED_MINDSETS.includes(trait.id);
                  return (
                    <TouchableOpacity
                      key={trait.id}
                      style={styles.perkContainer}
                      onPress={() =>
                        setSelectedMindset(isSelected ? null : trait.id)
                      }
                    >
                      <BlurView intensity={20} style={styles.perkBlur}>
                        <LinearGradient
                          colors={
                            isSelected
                              ? [
                                  'rgba(139, 92, 246, 0.3)',
                                  'rgba(124, 58, 237, 0.3)',
                                ]
                              : [
                                  'rgba(31, 41, 55, 0.8)',
                                  'rgba(17, 24, 39, 0.8)',
                                ]
                          }
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                          style={[
                            styles.perkCard,
                            isSelected && styles.mindsetCardSelected,
                          ]}
                        >
                          {isRecommended ? (
                            <View style={styles.recommendedBadge}>
                              <Star size={10} color="#FFFFFF" />
                              <Text style={styles.recommendedBadgeText}>RECOMMENDED</Text>
                            </View>
                          ) : null}
                          <View style={styles.perkHeader}>
                            <View style={styles.iconSection}>
                              <View
                                style={[
                                  styles.mindsetIconContainer,
                                  isSelected && styles.mindsetIconSelected,
                                ]}
                              >
                                <Image
                                  source={trait.icon}
                                  style={styles.mindsetIconImage}
                                  resizeMode="contain"
                                />
                              </View>
                              {isSelected && (
                                <View style={styles.statusIconContainer}>
                                  <Check size={24} color="#8B5CF6" />
                                </View>
                              )}
                            </View>
                            <View style={styles.perkInfo}>
                              <View style={styles.perkTitleRow}>
                                <Text
                                  style={[
                                    styles.perkTitle,
                                    isSelected && styles.mindsetNameSelected,
                                  ]}
                                >
                                  {trait.name}
                                </Text>
                                <View
                                  style={[
                                    styles.glassRarityBadge,
                                    {
                                      backgroundColor:
                                        trait.category === 'personality'
                                          ? 'rgba(139, 92, 246, 0.2)'
                                          : 'rgba(16, 185, 129, 0.2)',
                                    },
                                  ]}
                                >
                                  <View style={styles.glassOverlay} />
                                  <Text
                                    style={[
                                      styles.rarityText,
                                      {
                                        color:
                                          trait.category === 'personality'
                                            ? '#A78BFA'
                                            : '#34D399',
                                      },
                                    ]}
                                  >
                                    {trait.category === 'personality'
                                      ? 'Personality'
                                      : 'Financial'}
                                  </Text>
                                </View>
                              </View>
                              <Text
                                style={[
                                  styles.perkDescription,
                                  isSelected && styles.mindsetDescSelected,
                                ]}
                              >
                                {trait.description}
                              </Text>
                            </View>
                          </View>
                        </LinearGradient>
                      </BlurView>
                    </TouchableOpacity>
                  );
                })}

                {selectedMindset && (
                  <TouchableOpacity
                    style={styles.clearButton}
                    onPress={() => setSelectedMindset(null)}
                  >
                    <Text style={styles.clearButtonText}>
                      Clear Mindset Selection
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            <View
              style={[styles.bottomSpacing, { height: 140 + insets.bottom }]}
            />
          </View>
        </ScrollView>

        {/* Floating Start Button */}
        <View
          style={[
            styles.floatingButtonContainer,
            { bottom: 20 + insets.bottom },
          ]}
        >
          <TouchableOpacity
            onPress={start}
            style={styles.floatingButton}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={['#10B981', '#059669', '#047857']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.floatingGlassButton}
            >
              <View style={styles.buttonContent}>
                <Text style={styles.glassButtonTitle}>Start Your Life</Text>
                <View style={styles.glassIconContainer}>
                  <ArrowRight size={24} color="#FFFFFF" />
                </View>
              </View>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* Floating particles */}
        <View style={styles.particlesContainer}>
          {[...Array(8)].map((_, index) => (
            <Animated.View
              key={index}
              style={[
                styles.particle,
                {
                  left: `${Math.random() * 100}%`,
                  top: `${Math.random() * 100}%`,
                  transform: [{ rotate: rotateInterpolate }],
                },
              ]}
            />
          ))}
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
    overflow: 'hidden',
  },
  backgroundGradient1: {
    position: 'absolute',
    width: screenWidth * 2,
    height: screenWidth * 2,
    borderRadius: screenWidth,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    top: -screenWidth / 2,
    left: -screenWidth / 2,
  },
  backgroundGradient2: {
    position: 'absolute',
    width: screenWidth * 1.5,
    height: screenWidth * 1.5,
    borderRadius: screenWidth,
    backgroundColor: 'rgba(99, 102, 241, 0.05)',
    bottom: -screenWidth / 3,
    right: -screenWidth / 3,
  },
  content: { flex: 1 },
  guidanceText: {
    fontSize: responsiveFontSize.sm,
    fontWeight: '500',
    color: '#9CA3AF',
    textAlign: 'center',
    paddingHorizontal: responsivePadding.large,
    paddingBottom: responsiveSpacing.xs,
  },
  recommendedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    backgroundColor: 'rgba(16, 185, 129, 0.25)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginBottom: 8,
  },
  recommendedBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#34D399',
    letterSpacing: 0.5,
  },
  scrollContainer: { flex: 1 },
  scrollContent: { paddingBottom: 40 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: responsivePadding.large,
    paddingTop: responsiveSpacing.lg,
    paddingBottom: responsiveSpacing.lg,
  },
  backButton: {
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  infoButton: {
    borderRadius: 12,
    overflow: 'hidden',
  },

  title: {
    fontSize: responsiveFontSize['3xl'],
    fontWeight: 'bold',
    color: '#FFFFFF',
    ...Platform.select({
      web: { textShadow: '1px 1px 3px rgba(0, 0, 0, 0.5)' },
      ios: {
        textShadowColor: 'rgba(0, 0, 0, 0.5)',
        textShadowOffset: { width: 1, height: 1 },
        textShadowRadius: 3,
      },
      android: {
        textShadowColor: 'rgba(0, 0, 0, 0.5)',
        textShadowOffset: { width: 1, height: 1 },
        textShadowRadius: 3,
      },
    }),
    marginBottom: 8,
    textAlign: 'center',
    flex: 1,
  },

  perksContainer: {
    gap: responsiveSpacing.lg,
    paddingHorizontal: responsivePadding.large,
    paddingBottom: responsiveSpacing.lg,
  },
  perkContainer: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 12,
  },
  perkBlur: { borderRadius: 16, overflow: 'hidden' },
  perkCard: {
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },

  perkHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  iconSection: {
    alignItems: 'center',
    marginRight: 16,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 6,
  },
  statusIconContainer: {
    marginTop: 8,
    padding: 6,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 20,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  perkIcon: { width: 80, height: 80, borderRadius: 16, resizeMode: 'cover' },
  perkInfo: { flex: 1 },
  perkTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  perkTitle: {
    fontSize: responsiveFontSize.xl,
    fontWeight: 'bold',
    color: '#FFFFFF',
    flex: 1,
  },
  glassRarityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginLeft: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    position: 'relative',
    overflow: 'hidden',
  },
  rarityText: { fontSize: responsiveFontSize.xs, fontWeight: 'bold' },

  perkDescription: {
    fontSize: responsiveFontSize.base,
    color: '#D1D5DB',
    lineHeight: 20,
    marginBottom: 8,
  },
  lockedPerkCard: { opacity: 0.6 },
  lockedPerkTitle: { color: '#9CA3AF' },
  lockedPerkDescription: { color: '#9CA3AF' },

  permanentPerkCard: { borderWidth: 2, borderColor: '#F59E0B' },
  permanentBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(245, 158, 11, 0.9)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    zIndex: 10,
  },
  permanentBadgeText: {
    color: '#FFFFFF',
    fontSize: responsiveFontSize.xs,
    fontWeight: 'bold',
  },

  requirementText: {
    fontSize: responsiveFontSize.sm,
    color: '#6B7280',
    fontStyle: 'italic',
  },

  benefitsContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  benefitText: {
    fontSize: responsiveFontSize.sm,
    fontWeight: '600',
    marginLeft: 4,
  },

  glassBenefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    position: 'relative',
    overflow: 'hidden',
  },
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
  tabBadge: {
    backgroundColor: '#10B981',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  tabBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  mindsetCardSelected: {
    borderColor: 'rgba(139, 92, 246, 0.5)',
    borderWidth: 2,
  },
  mindsetIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 16,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mindsetIconSelected: {
    backgroundColor: 'transparent',
  },
  mindsetIconImage: {
    width: scale(80),
    height: scale(80),
  },
  mindsetNameSelected: {
    color: '#A78BFA',
  },
  mindsetDescSelected: {
    color: '#C4B5FD',
  },
  clearButton: {
    alignSelf: 'center',
    paddingVertical: 12,
    paddingHorizontal: 24,
    marginTop: responsiveSpacing.md,
  },
  clearButtonText: {
    fontSize: responsiveFontSize.base,
    color: '#9CA3AF',
    fontWeight: '500',
  },
  bottomSpacing: { height: 120 },

  floatingButtonContainer: {
    position: 'absolute',
    left: responsivePadding.horizontal,
    right: responsivePadding.horizontal,
    zIndex: 10,
  },
  floatingButton: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.6,
    shadowRadius: 20,
    elevation: 16,
  },
  floatingGlassButton: {
    width: '100%',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    position: 'relative',
    overflow: 'hidden',
    minHeight: 64,
    justifyContent: 'center',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 8,
  },

  particlesContainer: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    pointerEvents: 'none',
  },
  particle: {
    position: 'absolute',
    width: 4,
    height: 4,
    backgroundColor: 'rgba(59,130,246,0.3)',
    borderRadius: 2,
  },
  glassButton: {
    paddingVertical: 18,
    paddingHorizontal: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    position: 'relative',
    overflow: 'hidden',
  },
  glassButtonTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
    flex: 1,
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    width: '100%',
  },
  glassIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    shadowColor: '#FFFFFF',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    position: 'relative',
    overflow: 'hidden',
  },
  glassOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
  },
});
