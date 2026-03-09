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
import { WEEKS_PER_YEAR, WEEKS_PER_MONTH, ADULTHOOD_AGE } from '@/lib/config/gameConstants';
const LinearGradient = LinearGradientFallback;
import BlurViewFallback from '@/components/fallbacks/BlurViewFallback';
const BlurView = BlurViewFallback;
import { useRouter, useNavigation } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { perks } from '@/src/features/onboarding/perksData';
import { useOnboarding } from '@/src/features/onboarding/OnboardingContext';
import { useGame, initialGameState, STATE_VERSION } from '@/contexts/GameContext';
import { PERSONALITY_TRAITS, FINANCIAL_TRAITS, MindsetId, MindsetTrait, MINDSET_TRAITS } from '@/lib/mindset/config';
import {
  Lock,
  Check,
  ArrowLeft,
  ArrowRight,
  Gift,
  Brain,
  User,
  DollarSign,
  Info,
} from 'lucide-react-native';

type TabType = 'perks' | 'mindset';
import {
  responsiveFontSize,
  responsivePadding,
  responsiveSpacing,
  scale,
} from '@/utils/scaling';
import { formatMoney } from '@/utils/moneyFormatting';
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

export default function Perks() {
  const { state, setState } = useOnboarding();
  const { gameState, loadGame } = useGame();
  const router = useRouter();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const [selected, setSelected] = useState<string[]>(state.perks);
  const [permanentPerks, setPermanentPerks] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<TabType>('perks');
  const [selectedMindset, setSelectedMindset] = useState<MindsetId | null>(null);

  // Safe back navigation - goes to MainMenu if there's no screen to go back to
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
        if (perks.length > 0) {
          log.info('Loaded permanent perks', { perks });
        }
      } catch (error) {
        log.error('Error loading permanent perks:', error);
      }
    };
    loadPermanentPerks();
  }, []);
  
  log.debug('Perks screen mounted', { 
    platform: Platform.OS, 
    screenWidth, 
    insets: { top: insets.top, bottom: insets.bottom },
    selectedCount: selected.length 
  });

  // Stable sorted perks list - unlocked perks first, then by rarity
  const sortedPerks = useMemo(() => {
    return perks.sort((a, b) => {
      // A perk is unlocked if it has no unlock requirement, OR is permanent, OR its achievement is completed
      const aUnlocked =
        !a.unlock ||
        permanentPerks.includes(a.id) ||
        (gameState.achievements || []).find(ach => ach.id === a.unlock?.achievementId)?.completed;
      const bUnlocked =
        !b.unlock ||
        permanentPerks.includes(b.id) ||
        (gameState.achievements || []).find(ach => ach.id === b.unlock?.achievementId)?.completed;

      // Unlocked perks first
      if (aUnlocked !== bUnlocked) return aUnlocked ? -1 : 1;

      // Then sort by rarity (Uncommon, Rare, Epic, Legendary)
      const rarityOrder = { Uncommon: 1, Rare: 2, Epic: 3, Legendary: 4 } as const;
      const aR = rarityOrder[a.rarity as keyof typeof rarityOrder] || 0;
      const bR = rarityOrder[b.rarity as keyof typeof rarityOrder] || 0;
      return aR - bR;
    });
  }, [gameState.achievements, permanentPerks]);

  // Animations (transform/opacity only)
  const rotateAnim = useRef(new Animated.Value(0)).current;  // 0..1 → rotate
  const fadeAnim   = useRef(new Animated.Value(0)).current;  // 0..1 → opacity
  const slideAnim  = useRef(new Animated.Value(50)).current; // px → translateY

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
      
      if (isMounted && rotateLoop) {
        rotateLoop.start();
      }
    } catch (error) {
      log.error('Error starting rotate animation:', error);
    }
    
    return () => {
      isMounted = false;
      if (rotateLoop) {
        try {
          rotateLoop.stop();
        } catch (error) {
          log.error('Error stopping rotate animation:', error);
        }
      }
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
      
      if (isMounted && parallel) {
        parallel.start();
      }
    } catch (error) {
      log.error('Error starting fade/slide animation:', error);
    }
    
    return () => {
      isMounted = false;
      if (parallel) {
        try {
          parallel.stop();
        } catch (error) {
          log.error('Error stopping fade/slide animation:', error);
        }
      }
    };
  }, [fadeAnim, slideAnim]);


  const toggle = (id: string) => {
    setSelected(prev => (prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]));
  };

  const start = async () => {
    log.info('Start button pressed', { 
      selectedPerks: selected.length, 
      selectedMindset,
      scenarioId: state.scenario?.id 
    });
    
    // CRITICAL: Validate onboarding state before proceeding
    if (!state.scenario) {
      log.error('No scenario selected', { state });
      Alert.alert(
        'Missing Scenario',
        'Please select a scenario before starting your life.',
        [{ text: 'OK' }]
      );
      return;
    }
    
    // Validate character identity
    if (!state.firstName || !state.firstName.trim()) {
      log.error('Missing firstName', { state });
      Alert.alert(
        'Missing First Name',
        'Please enter a first name for your character.',
        [{ text: 'OK' }]
      );
      return;
    }
    
    if (!state.lastName || !state.lastName.trim()) {
      log.error('Missing lastName', { state });
      Alert.alert(
        'Missing Last Name',
        'Please enter a last name for your character.',
        [{ text: 'OK' }]
      );
      return;
    }
    
    if (!state.sex || !['male', 'female', 'random'].includes(state.sex)) {
      log.error('Invalid sex', { state });
      Alert.alert(
        'Invalid Character Sex',
        'Please select a valid character sex.',
        [{ text: 'OK' }]
      );
      return;
    }
    
    if (!state.sexuality || !['straight', 'gay', 'bi'].includes(state.sexuality)) {
      log.error('Invalid sexuality', { state });
      Alert.alert(
        'Invalid Sexuality',
        'Please select a valid sexuality.',
        [{ text: 'OK' }]
      );
      return;
    }
    
    const scenario = state.scenario;
    
    // CRITICAL: Validate scenario data structure before using
    if (!scenario || !scenario.start || typeof scenario.start !== 'object') {
      log.error('Invalid scenario structure', { scenario });
      Alert.alert(
        'Invalid Scenario',
        'The selected scenario is invalid. Please go back and select a different scenario.',
        [{ text: 'OK' }]
      );
      return;
    }
    
    // Validate scenario.start has required properties
    if (typeof scenario.start.age !== 'number' || scenario.start.age < 18 || scenario.start.age > 150) {
      log.error('Invalid scenario age', { age: scenario.start.age });
      Alert.alert(
        'Invalid Scenario',
        'The selected scenario has an invalid starting age. Please try again.',
        [{ text: 'OK' }]
      );
      return;
    }
    
    if (typeof scenario.start.cash !== 'number' || scenario.start.cash < 0) {
      log.error('Invalid scenario cash', { cash: scenario.start.cash });
      Alert.alert(
        'Invalid Scenario',
        'The selected scenario has invalid starting cash. Please try again.',
        [{ text: 'OK' }]
      );
      return;
    }
    
    const sex =
      state.sex === 'random'
        ? Math.random() < 0.5
          ? 'male'
          : 'female'
        : state.sex;

    const seekingGender =
      state.sexuality === 'straight'
        ? sex === 'male'
          ? 'female'
          : 'male'
        : state.sexuality === 'gay'
        ? sex
        : sex === 'male'
        ? 'female'
        : 'male';

    // Map scenario item ids to actual game item ids
    const itemIdMap: Record<string, string> = {
      smartphone: 'smartphone',
      computer: 'computer',
      business_suit: 'suit',
      suit: 'suit',
      gym_membership: 'gym_membership',
      bike: 'bike',
      basic_camera: 'camera',
      driver_license: 'driver_license',
    };

    const scenarioItems = scenario.start.items || [];

    // Calculate weeksLived based on starting age
    const startingAge = scenario.start.age;
    const weeksLived = Math.max(0, Math.floor((startingAge - ADULTHOOD_AGE) * WEEKS_PER_YEAR));
    
    const newState: any = {
      ...initialGameState,
      stats: {
        ...initialGameState.stats,
        money: scenario.start.cash + (selected.includes('legacy_builder') ? 5000 : 0),
        reputation: initialGameState.stats.reputation + (selected.includes('legacy_builder') ? 5 : 0),
        energy: initialGameState.stats.energy + (selected.includes('astute_planner') ? 10 : 0),
      },
      weeksLived, // Set weeksLived to match starting age
      week: ((weeksLived % WEEKS_PER_MONTH) + 1), // Week-of-month (1-4), NOT absolute week
      date: { ...initialGameState.date, age: scenario.start.age, week: (weeksLived % WEEKS_PER_YEAR) + 1 },
      educations: initialGameState.educations.map(e => {
        const eduFromScenario = (scenario.start as any).education;
        if (!eduFromScenario) return e;
        const wanted = Array.isArray(eduFromScenario) ? eduFromScenario : [eduFromScenario];
        // Map scenario education names to education IDs
        const educationMap: Record<string, string> = {
          'College': 'business_degree',
          // 'Dropout' means no completed education, so we don't map it to any education ID
        };
        const mappedWanted = wanted.map(w => educationMap[w] || w).filter(w => w !== 'Dropout');
        if (mappedWanted.length > 0 && mappedWanted.includes(e.id)) {
          return { ...e, completed: true, weeksRemaining: undefined };
        }
        return e;
      }),
      userProfile: {
        ...initialGameState.userProfile,
        firstName: state.firstName,
        lastName: state.lastName,
        sex,
        sexuality: state.sexuality,
        gender: sex,
        seekingGender,
      },
      perks: {
        // Include permanent perks (always available across lives)
        ...permanentPerks.reduce((acc, id) => ({ ...acc, [id]: true }), {}),
        // Include selected perks for this life
        ...selected.reduce((acc, id) => ({ ...acc, [id]: true }), {}),
      },
      mindset: selectedMindset ? {
        activeTraitId: selectedMindset,
        traits: [selectedMindset],
      } : undefined,
      scenarioId: scenario.id,
      // CRITICAL FIX: Store challengeScenarioId in game state if this is a challenge scenario
      // This allows the game to track challenge completion and award gems on prestige
      challengeScenarioId: state.challengeScenarioId,
      activeTraits: scenario.start.traits || [],
      // CRITICAL FIX: Define mappedIds outside map callback to fix scope issue
      // Map scenario item IDs to actual game item IDs
      items: (() => {
        const mappedIds = scenarioItems.map(sid => itemIdMap[sid] || sid).filter(Boolean);
        return initialGameState.items.map(i => {
          if (mappedIds.includes(i.id)) return { ...i, owned: true };
          return i;
        });
      })(),
      // Set hasPhone if smartphone is in items
      hasPhone: (() => {
        const mappedIds = scenarioItems.map(sid => itemIdMap[sid] || sid).filter(Boolean);
        return scenarioItems.includes('smartphone') || mappedIds.includes('smartphone');
      })(),
      // CRITICAL: Create child once and use in both family.children and relationships
      // This ensures the child appears in both the Family tab and Contacts app
      ...((): { family: any; relationships: any[] } => {
        const baseFamily = { ...initialGameState.family };
        const baseRelationships = [...(initialGameState.relationships || [])];
        
        // If scenario specifies noChildren, ensure children array is empty
        if (scenario.start.noChildren) {
          return {
            family: { ...baseFamily, children: [] },
            relationships: baseRelationships.filter(rel => rel.type !== 'child'),
          };
        }
        
        // If scenario specifies hasChild (like single_parent), create a child
        if ((scenario.start as any).hasChild) {
          const childAge = (scenario.start as any).childAge || 3;
          const childNames = ['Alex', 'Jordan', 'Taylor', 'Morgan', 'Casey', 'Riley', 'Avery', 'Quinn', 'Sage', 'River'];
          const childGenders: ('male' | 'female')[] = ['male', 'female'];
          const randomName = childNames[Math.floor(Math.random() * childNames.length)];
          const randomGender = childGenders[Math.floor(Math.random() * childGenders.length)];
          const randomPersonality = ['Playful', 'Curious', 'Energetic', 'Sweet', 'Adventurous'][Math.floor(Math.random() * 5)];
          const childId = `child_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          
          // CRITICAL: Create child object matching exactly how haveChild() creates it
          // This ensures it works identically to when you have a child with a partner
          const startingChild: any = {
            id: childId,
            name: randomName,
            type: 'child' as const,
            relationshipScore: 100, // Children start with perfect relationship
            personality: randomPersonality,
            gender: randomGender,
            age: childAge,
            datesCount: 0,
            // Additional ChildInfo properties (ChildInfo extends Relationship)
            educationLevel: 'none',
            careerPath: undefined,
            savings: 0,
          };
          
          // CRITICAL: Add to both family.children and relationships array
          // This matches exactly how haveChild() does it in SocialActionsContext.tsx
          // The same object is used in both places (ChildInfo extends Relationship)
          log.info('[SINGLE_PARENT] Creating child for single parent scenario', {
            childId: childId,
            childName: randomName,
            childAge: childAge,
            willAddToRelationships: true,
            willAddToFamily: true,
          });
          
          return {
            family: {
              ...baseFamily,
              children: [startingChild],
            },
            relationships: [...baseRelationships, startingChild],
          };
        }
        
        // Default: use initial state children (usually empty)
        return {
          family: baseFamily,
          relationships: baseRelationships,
        };
      })(),
      version: STATE_VERSION, // Use current state version
    };

    // CRITICAL: Validate the complete game state before saving
    const validation = validateOnboardingState(newState);
    
    if (!validation.valid) {
      log.error('Onboarding validation failed', {
        errors: validation.errors,
        warnings: validation.warnings,
        missingFields: validation.missingFields,
        invalidFields: validation.invalidFields,
      });
      
      // Try to apply safe defaults for missing fields
      const defaultsResult = applySafeDefaults(newState);
      
      // Re-validate after applying defaults
      const revalidation = validateOnboardingState(newState);
      
      if (!revalidation.valid) {
        // Still invalid after defaults - fail fast
        const errorMessage = [
          'Failed to create valid game state:',
          ...validation.errors.slice(0, 5), // Show first 5 errors
          validation.errors.length > 5 ? `... and ${validation.errors.length - 5} more errors` : '',
        ].filter(Boolean).join('\n');
        
        Alert.alert(
          'Game Creation Failed',
          errorMessage + '\n\nPlease try again or contact support if this persists.',
          [{ text: 'OK' }]
        );
        
        log.error('Game state validation failed even after applying defaults', {
          originalErrors: validation.errors,
          revalidationErrors: revalidation.errors,
          defaultsApplied: defaultsResult.defaults,
        });
        
        return;
      } else {
        log.warn('Applied defaults to fix validation issues', {
          defaultsApplied: defaultsResult.defaults,
          remainingWarnings: revalidation.warnings,
        });
      }
    } else if (validation.warnings.length > 0) {
      log.warn('Onboarding validation passed with warnings', {
        warnings: validation.warnings,
      });
    } else {
      log.info('Onboarding validation passed successfully');
    }
    
    const slotToUse = state.slot || 1;
    
    try {
      // Create backup before initial save (critical for recovery)
      await createBackupFromState(slotToUse, newState, 'before_onboarding').catch(err => {
        log.warn('Backup creation failed during onboarding (non-critical):', err);
      });
      
      // Use forceSave for initial save (immediate, but still uses atomic save)
      await forceSave(slotToUse, newState);
      
      log.info('Game state saved successfully', { slot: slotToUse });
      
      // DEBUG: Log child information if single parent scenario
      if ((scenario.start as any).hasChild) {
        const childInRelationships = newState.relationships?.find((r: any) => r.type === 'child');
        const childInFamily = newState.family?.children?.[0];
        log.info('[SINGLE_PARENT] Saved game state with child', {
          relationshipsCount: newState.relationships?.length || 0,
          childrenCount: newState.family?.children?.length || 0,
          childInRelationships: !!childInRelationships,
          childInFamily: !!childInFamily,
          childIdInRelationships: childInRelationships?.id,
          childIdInFamily: childInFamily?.id,
          childName: childInRelationships?.name || childInFamily?.name,
          relationshipTypes: newState.relationships?.map((r: any) => r.type) || [],
        });
        
        // CRITICAL: Verify child is in both arrays
        if (!childInRelationships) {
          log.error('[SINGLE_PARENT] ERROR: Child not found in relationships array!', {
            relationships: newState.relationships,
          });
        }
        if (!childInFamily) {
          log.error('[SINGLE_PARENT] ERROR: Child not found in family.children array!', {
            familyChildren: newState.family?.children,
          });
        }
      }
      
      setState(prev => ({ ...prev, perks: selected }));
      
      // ONBOARDING FIX: Load game - this updates the game state
      let loadedState;
      try {
        loadedState = await loadGame(slotToUse);
      } catch (loadError) {
        log.error('loadGame failed:', loadError);
        Alert.alert(
          'Load Failed',
          'Failed to load your game after saving. Please try again.',
          [{ text: 'OK' }]
        );
        return;
      }
      
      if (!loadedState) {
        log.error('loadGame returned null - save may not have been created properly');
        Alert.alert(
          'Load Failed',
          'Failed to load your game after saving. The save file may not have been created properly. Please try again.',
          [{ text: 'OK' }]
        );
        return;
      }
      
      // ONBOARDING FIX: Validate state before entering gameplay
      try {
        // CRITICAL: Validate state before entering gameplay
        const validation = validateGameEntry(loadedState);
          
          if (!validation.canEnter) {
            log.error('Game entry validation failed after onboarding', {
              reason: validation.reason,
              errors: validation.errors,
              warnings: validation.warnings,
            });

            // Show appropriate error message
            if (!validation.versionCompatible) {
              Alert.alert(
                'Version Incompatible',
                'The game state created is incompatible. Please try again.',
                [{ text: 'OK' }]
              );
            } else if (!validation.stateComplete) {
              Alert.alert(
                'Incomplete State',
                'The game state is incomplete. Please try again.',
                [{ text: 'OK' }]
              );
            } else {
              Alert.alert(
                'Invalid State',
                validation.errors[0] || 'The game state is invalid. Please try again.',
                [{ text: 'OK' }]
              );
            }
            return;
          }

          if (validation.warnings.length > 0) {
            log.warn('Game entry validation warnings after onboarding', validation.warnings);
          }

        // ONBOARDING FIX: Only navigate if validation passed
        log.info('Game entry validation passed after onboarding, navigating to gameplay');
        
        // Small delay to ensure state update has propagated
        setTimeout(() => {
          router.replace('/(tabs)');
        }, 100);
      } catch (validationError) {
        log.error('Error during post-load validation:', validationError);
        Alert.alert(
          'Validation Error',
          'An error occurred while validating your game. Please try again.',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      log.error('Failed to save game state', error);

      if (isSaveSigningConfigError(error)) {
        Alert.alert(
          'Build Configuration Error',
          'This app build is missing required save security configuration. Please update to the latest version.',
          [{ text: 'OK' }]
        );
        return;
      }

      Alert.alert(
        'Save Failed',
        'Failed to save your game. Please try again.',
        [{ text: 'OK' }]
      );
    }
  };

  const getStatIcon = (stat: string) => {
    switch (stat) {
      case 'happiness':   return require('lucide-react-native').Heart;
      case 'health':      return require('lucide-react-native').Shield;
      case 'energy':      return require('lucide-react-native').Zap;
      case 'fitness':     return require('lucide-react-native').TrendingUp;
      case 'reputation':  return require('lucide-react-native').Users;
      case 'money':
      case 'Starting Money':
        return require('lucide-react-native').DollarSign;
      case 'Income Boost': return require('lucide-react-native').TrendingUp;
      default:             return require('lucide-react-native').TrendingUp;
    }
  };

  const getStatColor = (stat: string) => {
    switch (stat) {
      case 'happiness':      return '#EF4444';
      case 'health':         return '#10B981';
      case 'energy':         return '#F59E0B';
      case 'fitness':        return '#3B82F6';
      case 'reputation':     return '#8B5CF6';
      case 'money':
      case 'Starting Money': return '#F7931A';
      case 'Income Boost':   return '#10B981';
      default:               return '#6B7280';
    }
  };

  const rotateInterpolate = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const renderBenefits = (perk: typeof perks[0]) => {
    const benefits: { stat: string; value: number; type: 'stat' | 'income' | 'start' }[] = [];

    if (perk.effects.statBoosts) {
      Object.entries(perk.effects.statBoosts).forEach(([stat, value]) => {
        if (stat === 'money') {
          benefits.push({ stat: 'Starting Money', value, type: 'start' });
        } else {
          benefits.push({ stat, value, type: 'stat' });
        }
      });
    }

    if (perk.effects.incomeMultiplier && perk.effects.incomeMultiplier > 1) {
      const percentage = Math.round((perk.effects.incomeMultiplier - 1) * 100);
      benefits.push({ stat: 'Income Boost', value: percentage, type: 'income' });
    }

    return benefits;
  };

  return (
    <View style={styles.container}>
      {/* Animated background circles */}
      <Animated.View style={[styles.backgroundGradient1, { transform: [{ rotate: rotateInterpolate }] }]} />
      <Animated.View style={[styles.backgroundGradient2, { transform: [{ rotate: rotateInterpolate }] }]} />

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
          <TouchableOpacity onPress={handleBack} style={styles.backButton}>
            <View style={styles.glassButton}>
              <View style={styles.glassOverlay} />
              <View style={styles.glassIconContainer}>
                <ArrowLeft size={24} color="#FFFFFF" />
              </View>
            </View>
          </TouchableOpacity>
          <Text style={styles.title}>{activeTab === 'perks' ? 'Choose Perks' : 'Choose Mindset'}</Text>
          <TouchableOpacity 
            onPress={() => Alert.alert(
              activeTab === 'perks' ? 'Perks' : 'Mindset',
              activeTab === 'perks' 
                ? 'Select perks that will give you advantages in your new life. Choose as many as you want!'
                : 'Select one mindset trait that will influence your gameplay with unique bonuses and penalties. This is optional.'
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

        {/* Tab Selector */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'perks' && styles.tabActive]}
            onPress={() => setActiveTab('perks')}
          >
            <LinearGradient
              colors={activeTab === 'perks' ? ['#10B981', '#059669'] : ['rgba(31, 41, 55, 0.8)', 'rgba(17, 24, 39, 0.8)']}
              style={styles.tabGradient}
            >
              <Gift size={18} color={activeTab === 'perks' ? '#FFFFFF' : '#9CA3AF'} />
              <Text style={[styles.tabText, activeTab === 'perks' && styles.tabTextActive]}>Perks</Text>
              {selected.length > 0 && (
                <View style={styles.tabBadge}>
                  <Text style={styles.tabBadgeText}>{selected.length}</Text>
                </View>
              )}
            </LinearGradient>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'mindset' && styles.tabActive]}
            onPress={() => setActiveTab('mindset')}
          >
            <LinearGradient
              colors={activeTab === 'mindset' ? ['#8B5CF6', '#7C3AED'] : ['rgba(31, 41, 55, 0.8)', 'rgba(17, 24, 39, 0.8)']}
              style={styles.tabGradient}
            >
              <Brain size={18} color={activeTab === 'mindset' ? '#FFFFFF' : '#9CA3AF'} />
              <Text style={[styles.tabText, activeTab === 'mindset' && styles.tabTextActive]}>Mindset</Text>
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
              <>
            {/* Perks list */}
            <View style={styles.perksContainer}>
              {sortedPerks.map(perk => {
                  const isSelected = selected.includes(perk.id);
                  const isPermanent = permanentPerks.includes(perk.id);
                  // A perk is locked if it has an unlock requirement AND is not permanent AND the achievement is not completed
                  const isLocked =
                    perk.unlock &&
                    !isPermanent &&
                    !(gameState.achievements || []).find(ach => ach.id === perk.unlock?.achievementId)?.completed;

                  const benefits = renderBenefits(perk);
                  const statKeys = Object.keys(perk.effects.statBoosts || {});
                  const primaryStat = statKeys.length > 0 ? statKeys[0] : 'happiness';

                  return (
                    <TouchableOpacity
                      key={perk.id}
                      style={styles.perkContainer}
                      onPress={() => !isLocked && !isPermanent && toggle(perk.id)}
                      disabled={isLocked || isPermanent}
                    >
                      <BlurView intensity={20} style={styles.perkBlur}>
                        <LinearGradient
                          colors={
                            isPermanent
                              ? ['rgba(245, 158, 11, 0.3)', 'rgba(217, 119, 6, 0.3)']
                              : isSelected
                              ? ['rgba(16, 185, 129, 0.2)', 'rgba(5, 150, 105, 0.2)']
                              : isLocked
                              ? ['rgba(75, 85, 99, 0.6)', 'rgba(55, 65, 81, 0.6)']
                              : ['rgba(31, 41, 55, 0.8)', 'rgba(17, 24, 39, 0.8)']
                          }
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                          style={[styles.perkCard, isLocked && styles.lockedPerkCard, isPermanent && styles.permanentPerkCard]}
                        >
                          {/* Permanent badge */}
                          {isPermanent && (
                            <View style={styles.permanentBadge}>
                              <Text style={styles.permanentBadgeText}>â­ PERMANENT</Text>
                            </View>
                          )}
                          <View style={styles.perkHeader}>
                            <View style={styles.iconSection}>
                              <View style={styles.iconContainer}>
                                <Image source={perk.icon} style={styles.perkIcon} />
                              </View>
                              {isLocked ? (
                                <View style={styles.statusIconContainer}>
                                  <Lock size={32} color="#6B7280" />
                                </View>
                              ) : isPermanent ? (
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
                                <Text style={[styles.perkTitle, isLocked && styles.lockedPerkTitle]}>
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

                              <Text style={[styles.perkDescription, isLocked && styles.lockedPerkDescription]}>
                                {perk.description}
                              </Text>
                              {perk.unlock && isLocked && (
                                <Text style={styles.requirementText}>
                                  🔑 Requires achievement: {perk.unlock.achievementId}
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
                                  <View key={index} style={styles.glassBenefitItem}>
                                    <View style={styles.glassOverlay} />
                                    <Icon size={16} color={getStatColor(benefit.stat)} />
                                    <Text style={[styles.benefitText, { color: getStatColor(benefit.stat) }]}>
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
              </>
            ) : (
              <>
                {/* Mindset list */}
                <View style={styles.perksContainer}>
                  {MINDSET_TRAITS.map((trait: MindsetTrait) => {
                    const isSelected = selectedMindset === trait.id;
                    return (
                      <TouchableOpacity
                        key={trait.id}
                        style={styles.perkContainer}
                        onPress={() => setSelectedMindset(isSelected ? null : trait.id)}
                      >
                        <BlurView intensity={20} style={styles.perkBlur}>
                          <LinearGradient
                            colors={
                              isSelected
                                ? ['rgba(139, 92, 246, 0.3)', 'rgba(124, 58, 237, 0.3)']
                                : ['rgba(31, 41, 55, 0.8)', 'rgba(17, 24, 39, 0.8)']
                            }
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={[styles.perkCard, isSelected && styles.mindsetCardSelected]}
                          >
                            <View style={styles.perkHeader}>
                              <View style={styles.iconSection}>
                                <View style={[styles.mindsetIconContainer, isSelected && styles.mindsetIconSelected]}>
                                  <Image source={trait.icon} style={styles.mindsetIconImage} resizeMode="contain" />
                                </View>
                              {isSelected && (
                                <View style={styles.statusIconContainer}>
                                  <Check size={24} color="#8B5CF6" />
                                </View>
                              )}
                            </View>
                              <View style={styles.perkInfo}>
                                <View style={styles.perkTitleRow}>
                                  <Text style={[styles.perkTitle, isSelected && styles.mindsetNameSelected]}>
                                    {trait.name}
                                  </Text>
                                  <View style={[styles.glassRarityBadge, { backgroundColor: trait.category === 'personality' ? 'rgba(139, 92, 246, 0.2)' : 'rgba(16, 185, 129, 0.2)' }]}>
                                    <View style={styles.glassOverlay} />
                                    <Text style={[styles.rarityText, { color: trait.category === 'personality' ? '#A78BFA' : '#34D399' }]}>
                                      {trait.category === 'personality' ? 'Personality' : 'Financial'}
                                    </Text>
                                  </View>
                                </View>
                                <Text style={[styles.perkDescription, isSelected && styles.mindsetDescSelected]}>
                              {trait.description}
                            </Text>
                              </View>
                            </View>
                          </LinearGradient>
                        </BlurView>
                      </TouchableOpacity>
                    );
                  })}

                  {/* Clear selection option */}
                  {selectedMindset && (
                    <TouchableOpacity
                      style={styles.clearButton}
                      onPress={() => setSelectedMindset(null)}
                    >
                      <Text style={styles.clearButtonText}>Clear Mindset Selection</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </>
            )}

            <View style={[styles.bottomSpacing, { height: 140 + insets.bottom }]} />
          </View>
        </ScrollView>

        {/* Floating Start Button */}
        <View style={[styles.floatingButtonContainer, { bottom: 20 + insets.bottom }]}>
          <TouchableOpacity onPress={start} style={styles.floatingButton} activeOpacity={0.8}>
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
    boxShadow: '0px 4px 8px rgba(0, 0, 0, 0.3)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  backButtonGradient: {
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  backPlaceholder: { width: 48 },
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

  subtitle: {
    fontSize: responsiveFontSize.lg,
    color: '#E5E7EB',
    textAlign: 'center',
    ...Platform.select({
      web: { textShadow: '1px 1px 2px rgba(0, 0, 0, 0.5)' },
      ios: {
        textShadowColor: 'rgba(0, 0, 0, 0.5)',
        textShadowOffset: { width: 1, height: 1 },
        textShadowRadius: 2,
      },
      android: {
        textShadowColor: 'rgba(0, 0, 0, 0.5)',
        textShadowOffset: { width: 1, height: 1 },
        textShadowRadius: 2,
      },
    }),
  },

  heroSection: {
    alignItems: 'center',
    paddingHorizontal: responsivePadding.large,
    marginBottom: responsiveSpacing['2xl'],
    marginTop: responsiveSpacing.lg,
  },
  heroTitle: {
    fontSize: responsiveFontSize['2xl'],
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 8,
    ...Platform.select({
      web: { textShadow: '1px 1px 2px rgba(0, 0, 0, 0.5)' },
      ios: {
        textShadowColor: 'rgba(0, 0, 0, 0.5)',
        textShadowOffset: { width: 1, height: 1 },
        textShadowRadius: 2,
      },
      android: {
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
  perkCard: { padding: 20, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.1)' },

  perkHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 16 },
  iconSection: {
    alignItems: 'center',
    marginRight: 16,
  },
  iconContainer: {
    width: 80, height: 80, borderRadius: 16, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.4, shadowRadius: 12, elevation: 6,
  },
  statusIconContainer: {
    marginTop: 8,
    padding: 6,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 20,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  iconGradient: {
    width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  perkIcon: { width: 80, height: 80, borderRadius: 16, resizeMode: 'cover' },
  perkInfo: { flex: 1 },
  perkTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  perkTitle: { fontSize: responsiveFontSize.xl, fontWeight: 'bold', color: '#FFFFFF', flex: 1, numberOfLines: 2, ellipsizeMode: 'tail' },
  rarityBadge: {
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, marginLeft: 8,
    borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  glassRarityBadge: {
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, marginLeft: 8,
    borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.1)',
    position: 'relative',
    overflow: 'hidden',
  },
  rarityText: { fontSize: responsiveFontSize.xs, fontWeight: 'bold' },

  perkDescription: { fontSize: responsiveFontSize.base, color: '#D1D5DB', lineHeight: 20, marginBottom: 8, numberOfLines: 3, ellipsizeMode: 'tail' },
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

  requirementText: { fontSize: responsiveFontSize.sm, color: '#6B7280', fontStyle: 'italic' },

  benefitsContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  benefitItem: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6,
    borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  benefitText: { fontSize: responsiveFontSize.sm, fontWeight: '600', marginLeft: 4, numberOfLines: 1, ellipsizeMode: 'tail' },

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
  // Tab styles
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
  // Mindset styles
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
    borderWidth: 0,
    borderColor: 'transparent',
  },
  mindsetIconSelected: {
    backgroundColor: 'transparent',
    borderColor: 'transparent',
  },
  mindsetIconText: {
    fontSize: 36,
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
    zIndex: 10 
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

  particlesContainer: { position: 'absolute', width: '100%', height: '100%', pointerEvents: 'none' },
  particle: { position: 'absolute', width: 4, height: 4, backgroundColor: 'rgba(59,130,246,0.3)', borderRadius: 2 },
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
