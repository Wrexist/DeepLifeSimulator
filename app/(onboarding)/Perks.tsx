import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Image, Dimensions, Animated, Easing, StatusBar } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { perks } from '@/src/features/onboarding/perksData';
import { useOnboarding } from '@/src/features/onboarding/OnboardingContext';
import { useGame, initialGameState } from '@/contexts/GameContext';
import { Lock, Check, Star, TrendingUp, Heart, Zap, DollarSign, Shield, Users, Trophy, Sparkles, ArrowLeft, ArrowRight } from 'lucide-react-native';
import { responsiveFontSize, responsivePadding, responsiveSpacing, scale, verticalScale } from '@/utils/scaling';
import { formatMoney } from '@/utils/moneyFormatting';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

export default function Perks() {
  const { state, setState } = useOnboarding();
  const { gameState, loadGame } = useGame();
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>(state.perks);

  // Animations
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Rotating background animation
  useEffect(() => {
    let isMounted = true;
    const rotateAnimation = Animated.loop(
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

    return () => {
      isMounted = false;
      if (rotateAnimation) {
        rotateAnimation.stop();
      }
    };
  }, [rotateAnim]);

  // Fade in and slide up animation
  useEffect(() => {
    let isMounted = true;
    const parallelAnimation = Animated.parallel([
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

    return () => {
      isMounted = false;
      if (parallelAnimation) {
        parallelAnimation.stop();
      }
    };
  }, [fadeAnim, slideAnim]);

  // Pulsing animation for the trophy
  useEffect(() => {
    const pulseAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.1,
          duration: 2000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 2000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    
    if (pulseAnimation) {
      pulseAnimation.start();
    }

    return () => {
      if (pulseAnimation) {
        pulseAnimation.stop();
      }
    };
  }, [pulseAnim]);

  const toggle = (id: string) => {
    setSelected(prev => {
      if (prev.includes(id)) return prev.filter(p => p !== id);
      return [...prev, id];
    });
  };

  const start = async () => {
    const scenario = state.scenario!;
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
      basic_camera: 'camera', // not present in items list; will be ignored gracefully
      driver_license: 'driver_license', // no direct item; ignored
    };

    const scenarioItems = scenario.start.items || [];

    const newState: any = {
      ...initialGameState,
      stats: {
        ...initialGameState.stats,
        money: scenario.start.cash + (selected.includes('legacy_builder') ? 5000 : 0),
        reputation: initialGameState.stats.reputation + (selected.includes('legacy_builder') ? 5 : 0),
        energy: initialGameState.stats.energy + (selected.includes('astute_planner') ? 10 : 0),
      },
      date: { ...initialGameState.date, age: scenario.start.age },
      // Apply starting education if provided
      educations: initialGameState.educations.map(e => {
        const eduFromScenario = (scenario.start as any).education;
        if (!eduFromScenario) return e;
        // education can be a string id or array of ids
        const wanted = Array.isArray(eduFromScenario) ? eduFromScenario : [eduFromScenario];
        if (wanted.includes(e.id)) {
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
      perks: selected.reduce((acc, id) => ({ ...acc, [id]: true }), {}),
      scenarioId: scenario.id,
      // Apply starting items as owned
      items: initialGameState.items.map(i => {
        const mappedIds = scenarioItems
          .map(sid => itemIdMap[sid] || sid)
          .filter(Boolean);
        if (mappedIds.includes(i.id)) {
          return { ...i, owned: true };
        }
        // special-case camera/driver_license that don't exist in items list
        return i;
      }),
    };
    const slotToUse = state.slot || 1;
    await AsyncStorage.setItem(`save_slot_${slotToUse}`, JSON.stringify({ ...newState, version: 5 }));
    await AsyncStorage.setItem('lastSlot', String(slotToUse));
    setState(prev => ({ ...prev, perks: selected }));
    await loadGame(slotToUse);
    router.replace('/(tabs)');
  };

  const getStatIcon = (stat: string) => {
    switch (stat) {
      case 'happiness': return Heart;
      case 'health': return Shield;
      case 'energy': return Zap;
      case 'fitness': return TrendingUp;
      case 'reputation': return Users;
      case 'money': return DollarSign;
      case 'Starting Money': return DollarSign;
      case 'Income Boost': return TrendingUp;
      default: return TrendingUp;
    }
  };

  const getStatColor = (stat: string) => {
    switch (stat) {
      case 'happiness': return '#EF4444';
      case 'health': return '#10B981';
      case 'energy': return '#F59E0B';
      case 'fitness': return '#3B82F6';
      case 'reputation': return '#8B5CF6';
      case 'money': return '#F7931A';
      case 'Starting Money': return '#F7931A';
      case 'Income Boost': return '#10B981';
      default: return '#6B7280';
    }
  };

  const rotateInterpolate = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });



  const renderBenefits = (perk: typeof perks[0]) => {
    const benefits: { stat: string; value: number; type: 'stat' | 'income' | 'start' }[] = [];
    
    // Add stat boosts
    if (perk.effects.statBoosts) {
      Object.entries(perk.effects.statBoosts).forEach(([stat, value]) => {
        if (stat === 'money') {
          benefits.push({ stat: 'Starting Money', value, type: 'start' });
        } else {
          benefits.push({ stat, value, type: 'stat' });
        }
      });
    }
    
    // Add income multiplier
    if (perk.effects.incomeMultiplier && perk.effects.incomeMultiplier > 1) {
      const percentage = Math.round((perk.effects.incomeMultiplier - 1) * 100);
      benefits.push({ stat: 'Income Boost', value: percentage, type: 'income' });
    }
    
    return benefits;
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
            transform: [{ translateY: slideAnim }]
          }
        ]}
      >


        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <LinearGradient
              colors={['rgba(55, 65, 81, 0.3)', 'rgba(31, 41, 55, 0.3)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.backButtonGradient}
            >
              <ArrowLeft size={24} color="#FFFFFF" />
            </LinearGradient>
          </TouchableOpacity>
          <Text style={styles.title}>Choose Perks</Text>
          <View style={styles.placeholder} />
        </View>

        <ScrollView style={styles.scrollContainer} showsVerticalScrollIndicator={false}>
          <View style={styles.scrollContent}>
            {/* Hero section */}
            <View style={styles.heroSection}>
              <View style={styles.trophyContainer}>
                <LinearGradient
                  colors={['#FFD700', '#FFA500']}
                  style={styles.trophyGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <Trophy size={40} color="#FFFFFF" />
                </LinearGradient>
              </View>
              <Text style={styles.heroTitle}>Choose Your Advantages</Text>
              <Text style={styles.heroSubtitle}>Select perks that will help you succeed</Text>
              <Text style={styles.heroSubtitle}>Choose as many perks as you want to start your journey</Text>
            </View>

            {/* Perks list */}
            <View style={styles.perksContainer}>
              {perks
                .sort((a, b) => {
                  // First sort by unlock status (unlocked first)
                  const aUnlocked = !a.unlock || (gameState.achievements || []).find(ach => ach.id === a.unlock?.achievementId)?.completed;
                  const bUnlocked = !b.unlock || (gameState.achievements || []).find(ach => ach.id === b.unlock?.achievementId)?.completed;
                  
                  if (aUnlocked !== bUnlocked) {
                    return aUnlocked ? -1 : 1;
                  }
                  
                  // Then sort by rarity (least rare first)
                  const rarityOrder = { 'Uncommon': 1, 'Rare': 2, 'Epic': 3, 'Legendary': 4 };
                  const aRarity = rarityOrder[a.rarity as keyof typeof rarityOrder] || 0;
                  const bRarity = rarityOrder[b.rarity as keyof typeof rarityOrder] || 0;
                  
                  return aRarity - bRarity;
                })
                .map((perk) => {
                  const isSelected = selected.includes(perk.id);
                  const isLocked = perk.unlock && !(gameState.achievements || []).find(ach => ach.id === perk.unlock?.achievementId)?.completed;
                  const benefits = renderBenefits(perk);
                                     const statKeys = Object.keys(perk.effects.statBoosts || {});
                   const primaryStat = statKeys.length > 0 ? statKeys[0] : 'happiness';
                  
                  return (
                    <TouchableOpacity
                      key={perk.id}
                      style={styles.perkContainer}
                      onPress={() => !isLocked && toggle(perk.id)}
                      disabled={isLocked}
                    >
                                           <BlurView intensity={20} style={styles.perkBlur}>
                       <LinearGradient
                         colors={isSelected ? ['rgba(16, 185, 129, 0.2)', 'rgba(5, 150, 105, 0.2)'] : isLocked ? ['rgba(75, 85, 99, 0.6)', 'rgba(55, 65, 81, 0.6)'] : ['rgba(31, 41, 55, 0.8)', 'rgba(17, 24, 39, 0.8)']}
                         start={{ x: 0, y: 0 }}
                         end={{ x: 1, y: 1 }}
                         style={[styles.perkCard, isLocked && styles.lockedPerkCard]}
                       >
                          <View style={styles.perkHeader}>
                            <View style={styles.iconContainer}>
                              <LinearGradient
                                colors={[`${getStatColor(primaryStat)}20`, `${getStatColor(primaryStat)}10`]}
                                style={styles.iconGradient}
                              >
                                <Image source={perk.icon} style={styles.perkIcon} />
                              </LinearGradient>
                            </View>
                                                       <View style={styles.perkInfo}>
                             <View style={styles.perkTitleRow}>
                               <Text style={[styles.perkTitle, isLocked && styles.lockedPerkTitle]}>{perk.title}</Text>
                               <View style={[styles.rarityBadge, { backgroundColor: perk.rarity === 'Legendary' ? 'rgba(245, 158, 11, 0.2)' : perk.rarity === 'Epic' ? 'rgba(139, 92, 246, 0.2)' : perk.rarity === 'Rare' ? 'rgba(59, 130, 246, 0.2)' : 'rgba(16, 185, 129, 0.2)' }]}>
                                 <Text style={[styles.rarityText, { color: perk.rarity === 'Legendary' ? '#F59E0B' : perk.rarity === 'Epic' ? '#8B5CF6' : perk.rarity === 'Rare' ? '#3B82F6' : '#10B981' }]}>
                                   {perk.rarity}
                                 </Text>
                               </View>
                             </View>
                             <Text style={[styles.perkDescription, isLocked && styles.lockedPerkDescription]}>{perk.description}</Text>
                             {perk.unlock && isLocked && (
                               <Text style={styles.requirementText}>
                                 🔒 Requires achievement: {perk.unlock.achievementId}
                               </Text>
                             )}
                           </View>
                            {isLocked ? (
                              <Lock size={20} color="#6B7280" />
                            ) : isSelected ? (
                              <Check size={20} color="#10B981" />
                            ) : null}
                          </View>

                          {benefits.length > 0 && (
                            <View style={styles.benefitsContainer}>
                              {benefits.map((benefit, index) => {
                                const Icon = getStatIcon(benefit.stat);
                                const displayValue = benefit.type === 'start' ? `+${formatMoney(benefit.value)}` : 
                                                   benefit.type === 'income' ? `+${benefit.value}%` : 
                                                   `+${benefit.value}`;
                                const displayStat = benefit.stat === 'Starting Money' ? 'Starting Money' :
                                                   benefit.stat === 'Income Boost' ? 'Income Boost' :
                                                   benefit.stat;
                                
                                return (
                                  <View key={index} style={styles.benefitItem}>
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

            

            {/* Bottom spacing for floating button */}
            <View style={styles.bottomSpacing} />
          </View>
        </ScrollView>

        {/* Floating Start Button */}
        <View style={styles.floatingButtonContainer}>
          <TouchableOpacity
            onPress={start}
            style={styles.floatingButton}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={['#10B981', '#059669']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.floatingButtonGradient}
            >
              <Text style={styles.floatingButtonText}>Start your life</Text>
              <ArrowRight size={20} color="#FFFFFF" />
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
    marginTop: -50, // Extend background to cover status bar
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
    paddingTop: 110, // Account for status bar
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
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
  backButtonGradient: {
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  placeholder: {
    width: 48,
  },
  bottomSpacing: {
    height: 120, // Space for floating button
  },
  floatingButtonContainer: {
    position: 'absolute',
    bottom: 30,
    left: 20,
    right: 20,
    zIndex: 10,
  },
  floatingButton: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 12,
  },
  floatingButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    paddingHorizontal: 24,
    gap: 12,
  },
  floatingButtonText: {
    color: '#FFFFFF',
    fontSize: responsiveFontSize.xl,
    fontWeight: '700',
    textAlign: 'center',
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
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
    marginBottom: 8,
    textAlign: 'center',
    flex: 1,
  },
  placeholder: {
    width: 48,
  },
  subtitle: {
    fontSize: responsiveFontSize.lg,
    color: '#E5E7EB',
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  heroSection: {
    alignItems: 'center',
    paddingHorizontal: responsivePadding.large,
    marginBottom: responsiveSpacing['2xl'],
    marginTop: responsiveSpacing.lg,
  },
  trophyContainer: {
    marginBottom: 20,
  },
  trophyGradient: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#FFD700',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 12,
  },
  heroTitle: {
    fontSize: responsiveFontSize['2xl'],
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 8,
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
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
  perkBlur: {
    borderRadius: 16,
    overflow: 'hidden',
  },
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
  iconContainer: {
    width: 60,
    height: 60,
    borderRadius: 12,
    overflow: 'hidden',
    marginRight: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  iconGradient: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  perkIcon: {
    width: 40,
    height: 40,
    borderRadius: 8,
  },
  perkInfo: {
    flex: 1,
  },
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
  rarityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginLeft: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  rarityText: {
    fontSize: responsiveFontSize.xs,
    fontWeight: 'bold',
  },
     perkDescription: {
     fontSize: responsiveFontSize.base,
     color: '#D1D5DB',
     lineHeight: 20,
     marginBottom: 8,
   },
   lockedPerkCard: {
     opacity: 0.6,
   },
   lockedPerkTitle: {
     color: '#9CA3AF',
   },
   lockedPerkDescription: {
     color: '#9CA3AF',
   },
  requirementText: {
    fontSize: responsiveFontSize.sm,
    color: '#6B7280',
    fontStyle: 'italic',
  },
  benefitsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  benefitText: {
    fontSize: responsiveFontSize.sm,
    fontWeight: '600',
    marginLeft: 4,
  },
  
  startButton: {
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
  startButtonBlur: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  startButtonGradient: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  startButtonText: {
    fontSize: responsiveFontSize.xl,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginLeft: 8,
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
});
