import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Image, Dimensions, Animated, Easing, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
// import { BlurView } from 'expo-blur'; // Removed - TurboModule crash fix
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter, useNavigation } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scenarios, Scenario } from '@/src/features/onboarding/scenarioData';
import { SCENARIOS as CHALLENGE_SCENARIOS, getDifficultyColor, getDifficultyLabel } from '@/lib/scenarios/scenarioDefinitions';
import { useOnboarding } from '@/src/features/onboarding/OnboardingContext';
import { ArrowLeft, ArrowRight, Play, Sparkles, Target, Info, Gem } from 'lucide-react-native';
import { Alert } from 'react-native';
import { responsiveFontSize, responsivePadding, responsiveSpacing, scale, verticalScale } from '@/utils/scaling';
import { logger } from '@/utils/logger';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
const log = logger.scope('Scenarios');

type TabType = 'life_paths' | 'challenges';

export default function Scenarios() {
  const { state, setState } = useOnboarding();
  const router = useRouter();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const [selected, setSelected] = useState<string | null>(state.scenario?.id || null);
  const [activeTab, setActiveTab] = useState<TabType>('life_paths');
  
  log.debug('Scenarios screen mounted', { 
    platform: Platform.OS, 
    screenWidth, 
    insets: { top: insets.top, bottom: insets.bottom }
  });

  // Convert challenge scenarios to the same format as life path scenarios
  // CRITICAL FIX: Handle missing properties and undefined functions to prevent crashes
  const challengeScenarios = useMemo(() => {
    // CRITICAL FIX: Validate CHALLENGE_SCENARIOS exists and is an array
    if (!CHALLENGE_SCENARIOS || !Array.isArray(CHALLENGE_SCENARIOS)) {
      log.warn('CHALLENGE_SCENARIOS is not available or not an array');
      return [];
    }
    
    // CRITICAL FIX: Validate getDifficultyLabel exists (should be fixed by adding to scenarioDefinitions.ts)
    const safeGetDifficultyLabel = typeof getDifficultyLabel === 'function' 
      ? getDifficultyLabel 
      : (difficulty: string) => {
          if (!difficulty || typeof difficulty !== 'string') {
            return 'Unknown';
          }
          return difficulty.charAt(0).toUpperCase() + difficulty.slice(1);
        };
    
    // CRITICAL FIX: Validate getDifficultyColor exists
    const safeGetDifficultyColor = typeof getDifficultyColor === 'function'
      ? getDifficultyColor
      : () => '#6B7280'; // Fallback gray color
    
    try {
      return CHALLENGE_SCENARIOS.map(cs => {
        // CRITICAL FIX: Validate cs is an object
        if (!cs || typeof cs !== 'object') {
          log.warn('Invalid scenario object found:', cs);
          return null;
        }
        
        // CRITICAL FIX: Handle missing properties gracefully
        // The Scenario interface uses startingConditions, not direct properties
        const startingConditions = (cs.startingConditions && typeof cs.startingConditions === 'object') 
          ? cs.startingConditions 
          : {};
        const rewards = (cs.rewards && typeof cs.rewards === 'object') 
          ? cs.rewards 
          : {};
        
        // CRITICAL FIX: Validate winConditions is an array before accessing
        const winConditions = Array.isArray(cs.winConditions) ? cs.winConditions : [];
        
        // Extract primary goal from winConditions (first condition description)
        const primaryGoalDescription = winConditions.length > 0 && winConditions[0] && typeof winConditions[0] === 'object'
          ? (winConditions[0].description || 'Complete the challenge')
          : 'Complete the challenge';
        
        // CRITICAL FIX: Validate difficulty before calling function
        const difficulty = (cs.difficulty && typeof cs.difficulty === 'string') 
          ? cs.difficulty 
          : 'unknown';
        
        // CRITICAL FIX: Validate education is an array before accessing [0]
        const education = Array.isArray(startingConditions.education) && startingConditions.education.length > 0
          ? startingConditions.education[0]
          : undefined;
        
        // CRITICAL FIX: Validate items is an array
        const items = Array.isArray(startingConditions.items) 
          ? startingConditions.items 
          : [];
        
        return {
          id: cs.id || 'unknown',
          title: cs.name || 'Unknown Scenario',
          difficulty: safeGetDifficultyLabel(difficulty),
          lifeGoal: primaryGoalDescription,
          description: cs.description || 'No description available',
          bonus: `Rewards: ${rewards.gems || 0} gems`,
          start: {
            age: typeof startingConditions.age === 'number' ? startingConditions.age : 18,
            cash: typeof startingConditions.money === 'number' ? startingConditions.money : 0,
            education: education,
            items: items,
            traits: [],
          },
          // CRITICAL FIX: Handle icon type mismatch - challenge scenarios have string icon paths,
          // but Scenario interface expects ImageSourcePropType. Use default icon for now.
          // TODO: Map challenge scenario icon strings to actual image resources if needed
          icon: require('@/assets/images/Scenarios/Street Hustler.png'), // Default icon for challenges
          isChallenge: true,
          challengeData: cs,
        };
      }).filter((scenario): scenario is NonNullable<typeof scenario> => scenario !== null);
    } catch (error) {
      log.error('Error mapping challenge scenarios:', error);
      return [];
    }
  }, []);

  // Safe back navigation - goes to MainMenu if there's no screen to go back to
  const handleBack = useCallback(() => {
    if (navigation.canGoBack()) {
      router.back();
    } else {
      // No screen to go back to (e.g., came from death popup)
      // Navigate to MainMenu instead
      router.replace('/(onboarding)/MainMenu');
    }
  }, [navigation, router]);

  // Animations
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;

  // Rotating background animation
  useEffect(() => {
    let isMounted = true;
    let rotateAnimation: Animated.CompositeAnimation | null = null;
    
    try {
      rotateAnimation = Animated.loop(
        Animated.timing(rotateAnim, {
          toValue: 1,
          duration: 30000,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      );
      
      if (isMounted && rotateAnimation) {
        rotateAnimation.start();
      }
    } catch (error) {
      log.error('Error starting rotate animation', error);
    }

    return () => {
      isMounted = false;
      if (rotateAnimation) {
        try {
          rotateAnimation.stop();
        } catch (error) {
          log.error('Error stopping rotate animation', error);
        }
      }
    };
  }, [rotateAnim]);

  // Fade in and slide up animation
  useEffect(() => {
    let isMounted = true;
    let parallelAnimation: Animated.CompositeAnimation | null = null;
    
    try {
      parallelAnimation = Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 1000,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 1000,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]);
      
      if (isMounted && parallelAnimation) {
        parallelAnimation.start();
      }
    } catch (error) {
      log.error('Error starting fade/slide animation', error);
    }

    return () => {
      isMounted = false;
      if (parallelAnimation) {
        try {
          parallelAnimation.stop();
        } catch (error) {
          log.error('Error stopping fade/slide animation', error);
        }
      }
    };
  }, [fadeAnim, slideAnim]);

  const select = (id: string, isChallenge: boolean = false) => {
    setSelected(id);
    if (isChallenge) {
      const challengeScenario = challengeScenarios.find(s => s.id === id);
      if (challengeScenario) {
        // Convert challenge scenario to the format expected by the game
        setState(prev => ({ 
          ...prev, 
          scenario: {
            id: challengeScenario.id,
            title: challengeScenario.title,
            difficulty: challengeScenario.difficulty,
            lifeGoal: challengeScenario.lifeGoal,
            description: challengeScenario.description,
            bonus: challengeScenario.bonus,
            start: challengeScenario.start,
            icon: require('@/assets/images/Scenarios/Street Hustler.png'), // Use a default icon for challenges
          },
          challengeScenarioId: challengeScenario.id, // Track this is a challenge
        }));
      }
    } else {
      // RC-0 FIX: Add null check to prevent crash if scenario not found
      const selectedScenario = scenarios.find(s => s.id === id);
      if (!selectedScenario) {
        log.error('Scenario not found', { scenarioId: id });
        Alert.alert('Error', 'Selected scenario not found. Please try again.');
        return;
      }
      setState(prev => ({ ...prev, scenario: selectedScenario, challengeScenarioId: undefined }));
    }
  };

  const next = () => {
    if (selected) {
      router.push('/(onboarding)/Customize');
    }
  };

  const currentScenarios = activeTab === 'life_paths' ? scenarios : challengeScenarios;

  const rotateInterpolate = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const getItemIcon = (item: string) => {
    switch (item) {
      case 'smartphone': return '📱';
      case 'driver_license': return '🚗';
      case 'business_suit': return '👔';
      case 'gym_membership': return '💪';
      case 'computer': return '💻';
      case 'basic_camera': return '📷';
      default: return '📦';
    }
  };

  const formatItemName = (item: string) => {
    switch (item) {
      case 'smartphone': return 'Smartphone';
      case 'driver_license': return 'Driver License';
      case 'business_suit': return 'Business Suit';
      case 'gym_membership': return 'Gym Membership';
      case 'computer': return 'Computer';
      case 'basic_camera': return 'Camera';
      default: return item.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }
  };

  const formatTraitName = (trait: string) => {
    switch (trait) {
      case 'fit': return 'Fit';
      case 'tough': return 'Tough';
      default: return trait.replace(/\b\w/g, l => l.toUpperCase());
    }
  };

  return (
    <View style={styles.container}>
      {/* Animated background gradients */}
      <Animated.View
        style={[
          styles.backgroundGradient1,
          {
            transform: [{ rotate: rotateInterpolate }],
          },
        ]}
      />
      <Animated.View
        style={[
          styles.backgroundGradient2,
          {
            transform: [{ rotate: rotateInterpolate }],
          },
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
            }
          ]}
        >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack} style={styles.backButton}>
            <View style={styles.glassButton}>
              <View style={styles.glassOverlay} />
              <View style={styles.glassIconContainer}>
                <ArrowLeft size={24} color="#FFFFFF" />
              </View>
            </View>
          </TouchableOpacity>
          <Text style={styles.title}>Choose Scenario</Text>
          <TouchableOpacity 
            onPress={() => Alert.alert(
              activeTab === 'life_paths' ? 'Life Paths' : 'Challenges',
              activeTab === 'life_paths' 
                ? 'Choose your starting life path. Each scenario gives you different starting conditions like age, money, and items.'
                : 'Challenge modes offer unique gameplay with special goals and rewards. Complete challenges and prestige for the first time to earn massive gem rewards! Gems are only awarded on your first prestige, so make sure to complete your challenge goals before prestiging.'
            )}
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

        <ScrollView 
          style={styles.scrollContainer} 
          contentContainerStyle={{ paddingTop: insets.top }}
          showsVerticalScrollIndicator={true}
        >
          <View style={[styles.scrollContent, { paddingBottom: 160 + insets.bottom }]}>
            {/* Tab Selector */}
            <View style={styles.tabContainer}>
              <TouchableOpacity
                style={[styles.tab, activeTab === 'life_paths' && styles.tabActive]}
                onPress={() => setActiveTab('life_paths')}
              >
                <LinearGradient
                  colors={activeTab === 'life_paths' ? ['#10B981', '#059669'] : ['rgba(31, 41, 55, 0.8)', 'rgba(17, 24, 39, 0.8)']}
                  style={styles.tabGradient}
                >
                  <Target size={18} color={activeTab === 'life_paths' ? '#FFFFFF' : '#9CA3AF'} />
                  <Text style={[styles.tabText, activeTab === 'life_paths' && styles.tabTextActive]}>Life Paths</Text>
                </LinearGradient>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tab, activeTab === 'challenges' && styles.tabActive]}
                onPress={() => setActiveTab('challenges')}
              >
                <LinearGradient
                  colors={activeTab === 'challenges' ? ['#EF4444', '#DC2626'] : ['rgba(31, 41, 55, 0.8)', 'rgba(17, 24, 39, 0.8)']}
                  style={styles.tabGradient}
                >
                  <Sparkles size={18} color={activeTab === 'challenges' ? '#FFFFFF' : '#9CA3AF'} />
                  <Text style={[styles.tabText, activeTab === 'challenges' && styles.tabTextActive]}>Challenges</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>

            {/* Scenarios list */}
            <View style={styles.scenariosContainer}>
              {currentScenarios.map((scenario: any) => {
                const isSelected = selected === scenario.id;
                const isChallenge = activeTab === 'challenges';
                
                return (
                  <TouchableOpacity
                    key={scenario.id}
                    style={styles.scenarioContainer}
                    onPress={() => select(scenario.id, isChallenge)}
                  >
                    <BlurView intensity={20} style={styles.scenarioBlur}>
                      <LinearGradient
                        colors={isSelected 
                          ? ['rgba(16, 185, 129, 0.2)', 'rgba(5, 150, 105, 0.2)'] 
                          : isChallenge 
                            ? ['rgba(239, 68, 68, 0.1)', 'rgba(220, 38, 38, 0.1)']
                            : ['rgba(31, 41, 55, 0.8)', 'rgba(17, 24, 39, 0.8)']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.scenarioCard}
                      >
                        <View style={styles.scenarioHeader}>
                          {scenario.icon && (
                            <View style={styles.iconContainer}>
                              <Image source={scenario.icon} style={styles.scenarioIcon} />
                            </View>
                          )}
                          <View style={styles.scenarioInfo}>
                            <View style={styles.titleRow}>
                              <Text style={styles.scenarioTitle}>{scenario.title || 'Unknown Scenario'}</Text>
                              {/* Difficulty Badge for Challenges */}
                              {isChallenge && scenario.challengeData && (
                                <View style={[styles.difficultyBadge, { 
                                  backgroundColor: (typeof getDifficultyColor === 'function' && scenario.challengeData.difficulty)
                                    ? getDifficultyColor(scenario.challengeData.difficulty) 
                                    : '#6B7280' // Fallback gray color
                                }]}>
                                  <Text style={styles.difficultyBadgeText}>
                                    {(scenario.difficulty || 'Unknown').toUpperCase()}
                                  </Text>
                                </View>
                              )}
                            </View>
                            <Text style={styles.scenarioDescription}>{scenario.description || 'No description available'}</Text>
                          </View>
                          {isSelected && (
                            <View style={styles.selectedIndicator}>
                              <View style={styles.glassIconContainer}>
                                <View style={styles.glassOverlay} />
                                <Text style={styles.selectedText}>✓</Text>
                              </View>
                            </View>
                          )}
                        </View>

                        <View style={styles.statsContainer}>
                          <View style={styles.glassStatItem}>
                            <View style={styles.glassOverlay} />
                            <Text style={styles.statLabel}>Age</Text>
                            <Text style={styles.statValue}>{scenario.start?.age ?? 18}</Text>
                          </View>
                          <View style={styles.glassStatItem}>
                            <View style={styles.glassOverlay} />
                            <Text style={styles.statLabel}>Cash</Text>
                            <Text style={styles.statValue}>${(scenario.start?.cash ?? 0).toLocaleString()}</Text>
                          </View>
                          <View style={styles.glassStatItem}>
                            <View style={styles.glassOverlay} />
                            <Text style={styles.statLabel}>Study</Text>
                            <Text style={styles.statValue}>{scenario.start?.education || 'None'}</Text>
                          </View>
                          {/* Gem Reward for Challenges */}
                          {isChallenge && scenario.challengeData && scenario.challengeData.rewards && (
                            <View style={[styles.glassStatItem, styles.gemRewardItem]}>
                              <View style={styles.glassOverlay} />
                              <Gem size={18} color="#FFD700" />
                              <View style={styles.gemRewardTextContainer}>
                                <Text style={styles.statLabel}>Reward</Text>
                                <Text style={[styles.statValue, styles.gemRewardValue]}>
                                  {scenario.challengeData.rewards.gems || 0} Gems
                                </Text>
                              </View>
                            </View>
                          )}
                        </View>

                        {/* Items and Traits */}
                        {(scenario.start?.items && scenario.start.items.length > 0) || (scenario.start?.traits && scenario.start.traits.length > 0) ? (
                          <View style={styles.itemsContainer}>
                            <Text style={styles.itemsTitle}>Starting Items & Traits</Text>
                            <View style={styles.itemsList}>
                              {scenario.start.items?.map((item, index) => (
                                <View key={index} style={styles.glassBadge}>
                                  <View style={styles.glassOverlay} />
                                  <Text style={styles.itemText}>{getItemIcon(item)} {formatItemName(item)}</Text>
                                </View>
                              ))}
                              {scenario.start.traits?.map((trait, index) => (
                                <View key={index} style={styles.glassTraitBadge}>
                                  <View style={styles.glassOverlay} />
                                  <Text style={styles.traitText}>⭐ {formatTraitName(trait)}</Text>
                                </View>
                              ))}
                            </View>
                          </View>
                        ) : null}
                      </LinearGradient>
                    </BlurView>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Bottom spacing for floating button */}
            <View style={[styles.bottomSpacing, { height: 140 + insets.bottom }]} />
          </View>
        </ScrollView>

        {/* Floating Continue Button */}
        {selected && (
          <View style={[styles.floatingButtonContainer, { bottom: 20 + insets.bottom }]}>
            <TouchableOpacity
              onPress={next}
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
                  <Text style={styles.glassButtonTitle}>Continue</Text>
                  <View style={styles.glassIconContainer}>
                    <Play size={24} color="#FFFFFF" />
                  </View>
                </View>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        )}

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
                  transform: [
                    {
                      rotate: rotateAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: ['0deg', '360deg'],
                      }),
                    },
                  ],
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
  content: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: responsivePadding.large,
    paddingTop: responsiveSpacing.lg,
    paddingBottom: responsiveSpacing.lg,
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
    textAlign: 'center',
    flex: 1,
  },
  backButton: {
    borderRadius: 12,
    overflow: 'hidden',
    boxShadow: '0px 6px 12px rgba(0, 0, 0, 0.4)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 10,
  },
  glassButton: {
    width: scale(48),
    height: scale(48),
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    position: 'relative',
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
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
  },
  placeholder: {
    width: scale(48),
  },
  infoButton: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  heroSection: {
    alignItems: 'center',
    paddingHorizontal: responsivePadding.large,
    marginBottom: responsiveSpacing['2xl'],
  },
  heroTitle: {
    fontSize: responsiveFontSize['2xl'],
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 8,
    ...Platform.select({
      web: { textShadow: '1px 1px 2px rgba(0, 0, 0, 0.5)' },
      default: {
        textShadowColor: 'rgba(0, 0, 0, 0.5)',
        textShadowOffset: { width: 1, height: 1 },
        textShadowRadius: 2,
      },
    }),
  },
  heroSubtitle: {
    fontSize: responsiveFontSize.lg,
    color: '#94A3B8',
    textAlign: 'center',
    fontWeight: '500',
  },
  scenariosContainer: {
    gap: responsiveSpacing.lg,
    paddingHorizontal: responsivePadding.large,
    paddingBottom: responsiveSpacing.lg,
  },
  scenarioContainer: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 12,
  },
  scenarioBlur: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  scenarioCard: {
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  scenarioHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 16,
    overflow: 'hidden',
    marginRight: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 6,
  },
  iconGradient: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  scenarioIcon: {
    width: 80,
    height: 80,
    borderRadius: 16,
    resizeMode: 'cover',
  },
  scenarioInfo: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    gap: 8,
    flexWrap: 'wrap',
  },
  scenarioTitle: {
    fontSize: responsiveFontSize.xl,
    fontWeight: 'bold',
    color: '#FFFFFF',
    flex: 1,
    numberOfLines: 2,
    ellipsizeMode: 'tail',
  },
  scenarioDescription: {
    fontSize: responsiveFontSize.base,
    color: '#D1D5DB',
    lineHeight: 20,
    numberOfLines: 3,
    ellipsizeMode: 'tail',
  },
  selectedIndicator: {
    width: scale(32),
    height: scale(32),
    borderRadius: scale(16),
    overflow: 'hidden',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  selectedGradient: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectedText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    flexWrap: 'wrap',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
    gap: 8,
  },
  statItem: {
    alignItems: 'center',
  },
  statLabel: {
    fontSize: responsiveFontSize.sm,
    color: '#9CA3AF',
    marginBottom: 4,
  },
  statValue: {
    fontSize: responsiveFontSize.base,
    fontWeight: 'bold',
    color: '#FFFFFF',
    numberOfLines: 1,
    ellipsizeMode: 'tail',
  },
  itemsContainer: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  itemsTitle: {
    fontSize: responsiveFontSize.base,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  itemsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  itemBadge: {
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.3)',
  },
  itemText: {
    fontSize: responsiveFontSize.sm,
    color: '#3B82F6',
    fontWeight: '600',
  },
  traitBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  traitText: {
    fontSize: responsiveFontSize.sm,
    color: '#10B981',
    fontWeight: '600',
  },
  nextButton: {
    marginHorizontal: 20,
    marginBottom: 40,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 12,
  },
  nextButtonDisabled: {
    opacity: 0.5,
  },
  nextButtonBlur: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  nextButtonGradient: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  nextButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  nextButtonTextDisabled: {
    color: '#9CA3AF',
  },
  bottomSpacing: {
    height: 120, // Space for floating button
  },
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
  floatingButtonDisabled: {
    opacity: 0.5,
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
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    width: '100%',
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
    backgroundColor: 'rgba(59, 130, 246, 0.3)',
    borderRadius: 2,
  },
  glassCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    padding: 24,
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 12,
  },
  glassStatItem: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    padding: 12,
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
    flex: 1,
    marginHorizontal: 4,
    minWidth: 80,
  },
  gemRewardItem: {
    backgroundColor: 'rgba(255, 215, 0, 0.2)',
    borderColor: 'rgba(255, 215, 0, 0.5)',
    borderWidth: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minWidth: 120,
  },
  gemRewardTextContainer: {
    alignItems: 'center',
    gap: 2,
  },
  gemRewardValue: {
    color: '#FFD700',
    fontWeight: '700',
    fontSize: responsiveFontSize.base + 1,
  },
  glassBadge: {
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.25)',
    position: 'relative',
    overflow: 'hidden',
  },
  glassTraitBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.25)',
    position: 'relative',
    overflow: 'hidden',
  },
  // Tab styles
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: responsivePadding.large,
    marginBottom: responsiveSpacing.lg,
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
  // Challenge styles
  difficultyBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  difficultyBadgeText: {
    fontSize: responsiveFontSize.xs,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  challengeIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  challengeIconText: {
    fontSize: 36,
  },
});
