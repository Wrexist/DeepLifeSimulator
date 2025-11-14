import React, { useState, useRef, useEffect, useMemo } from 'react';
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
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { perks } from '@/src/features/onboarding/perksData';
import { useOnboarding } from '@/src/features/onboarding/OnboardingContext';
import { useGame, initialGameState } from '@/contexts/GameContext';
import {
  Lock,
  Check,
  ArrowLeft,
  ArrowRight,
} from 'lucide-react-native';
import {
  responsiveFontSize,
  responsivePadding,
  responsiveSpacing,
  scale,
} from '@/utils/scaling';
import { formatMoney } from '@/utils/moneyFormatting';

const { width: screenWidth } = Dimensions.get('window');
const NATIVE_OK = Platform.OS !== 'web';

export default function Perks() {
  const { state, setState } = useOnboarding();
  const { gameState, loadGame } = useGame();
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>(state.perks);

  // Stable sorted perks list - unlocked perks first, then by rarity
  const sortedPerks = useMemo(() => {
    return perks.sort((a, b) => {
      const aUnlocked =
        !a.unlock ||
        (gameState.achievements || []).find(ach => ach.id === a.unlock?.achievementId)?.completed;
      const bUnlocked =
        !b.unlock ||
        (gameState.achievements || []).find(ach => ach.id === b.unlock?.achievementId)?.completed;

      // Unlocked perks first
      if (aUnlocked !== bUnlocked) return aUnlocked ? -1 : 1;

      // Then sort by rarity (Uncommon, Rare, Epic, Legendary)
      const rarityOrder = { Uncommon: 1, Rare: 2, Epic: 3, Legendary: 4 } as const;
      const aR = rarityOrder[a.rarity as keyof typeof rarityOrder] || 0;
      const bR = rarityOrder[b.rarity as keyof typeof rarityOrder] || 0;
      return aR - bR;
    });
  }, [gameState.achievements]);

  // Animations (transform/opacity only)
  const rotateAnim = useRef(new Animated.Value(0)).current;  // 0..1 → rotate
  const fadeAnim   = useRef(new Animated.Value(0)).current;  // 0..1 → opacity
  const slideAnim  = useRef(new Animated.Value(50)).current; // px → translateY

  // Rotating background
  useEffect(() => {
    const rotateLoop = Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 30000,
        easing: Easing.linear,
        useNativeDriver: NATIVE_OK,
      })
    );
    rotateLoop.start();
    return () => rotateLoop.stop();
  }, [rotateAnim]);

  // Fade in + slide up
  useEffect(() => {
    const parallel = Animated.parallel([
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
    parallel.start();
    return () => parallel.stop();
  }, [fadeAnim, slideAnim]);


  const toggle = (id: string) => {
    setSelected(prev => (prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]));
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
      basic_camera: 'camera',
      driver_license: 'driver_license',
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
      educations: initialGameState.educations.map(e => {
        const eduFromScenario = (scenario.start as any).education;
        if (!eduFromScenario) return e;
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
      items: initialGameState.items.map(i => {
        const mappedIds = scenarioItems.map(sid => itemIdMap[sid] || sid).filter(Boolean);
        if (mappedIds.includes(i.id)) return { ...i, owned: true };
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
          { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
        ]}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <View style={styles.glassButton}>
              <View style={styles.glassOverlay} />
              <View style={styles.glassIconContainer}>
                <ArrowLeft size={24} color="#FFFFFF" />
              </View>
            </View>
          </TouchableOpacity>
          <Text style={styles.title}>Choose Perks</Text>
          <View style={styles.backPlaceholder} />
        </View>

        <ScrollView style={styles.scrollContainer} showsVerticalScrollIndicator={true}>
          <View style={styles.scrollContent}>
            {/* Hero */}
            <View style={styles.heroSection}>
              <View style={styles.glassCard}>
                <View style={styles.glassOverlay} />
                <Text style={styles.heroTitle}>Choose Your Advantages</Text>
                <Text style={styles.heroSubtitle}>Select perks that will help you succeed</Text>
                <Text style={styles.heroSubtitle}>Choose as many perks as you want to start your journey</Text>
              </View>
            </View>

            {/* Perks list */}
            <View style={styles.perksContainer}>
              {sortedPerks.map(perk => {
                  const isSelected = selected.includes(perk.id);
                  const isLocked =
                    perk.unlock &&
                    !(gameState.achievements || []).find(ach => ach.id === perk.unlock?.achievementId)?.completed;

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
                          colors={
                            isSelected
                              ? ['rgba(16, 185, 129, 0.2)', 'rgba(5, 150, 105, 0.2)']
                              : isLocked
                              ? ['rgba(75, 85, 99, 0.6)', 'rgba(55, 65, 81, 0.6)']
                              : ['rgba(31, 41, 55, 0.8)', 'rgba(17, 24, 39, 0.8)']
                          }
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                          style={[styles.perkCard, isLocked && styles.lockedPerkCard]}
                        >
                          <View style={styles.perkHeader}>
                            <View style={styles.iconSection}>
                              <View style={styles.iconContainer}>
                                <Image source={perk.icon} style={styles.perkIcon} />
                              </View>
                              {isLocked ? (
                                <View style={styles.statusIconContainer}>
                                  <Lock size={32} color="#6B7280" />
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
                                  🔒 Requires achievement: {perk.unlock.achievementId}
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

            <View style={styles.bottomSpacing} />
          </View>
        </ScrollView>

        {/* Floating Start Button */}
        <View style={styles.floatingButtonContainer}>
          <TouchableOpacity onPress={start} style={styles.floatingButton} activeOpacity={0.8}>
            <View style={styles.glassButton}>
              <View style={styles.glassOverlay} />
              <View style={styles.buttonContent}>
                <Text style={styles.glassButtonTitle}>Start your life</Text>
                <View style={styles.glassIconContainer}>
                  <ArrowRight size={20} color="#FFFFFF" />
                </View>
              </View>
            </View>
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
    marginTop: -50,
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
  content: { flex: 1, paddingTop: 110 },
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
  backButtonGradient: {
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  backPlaceholder: { width: 48 },

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
  perkTitle: { fontSize: responsiveFontSize.xl, fontWeight: 'bold', color: '#FFFFFF', flex: 1 },
  rarityBadge: {
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, marginLeft: 8,
    borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  rarityText: { fontSize: responsiveFontSize.xs, fontWeight: 'bold' },

  perkDescription: { fontSize: responsiveFontSize.base, color: '#D1D5DB', lineHeight: 20, marginBottom: 8 },
  lockedPerkCard: { opacity: 0.6 },
  lockedPerkTitle: { color: '#9CA3AF' },
  lockedPerkDescription: { color: '#9CA3AF' },

  requirementText: { fontSize: responsiveFontSize.sm, color: '#6B7280', fontStyle: 'italic' },

  benefitsContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  benefitItem: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6,
    borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  benefitText: { fontSize: responsiveFontSize.sm, fontWeight: '600', marginLeft: 4 },

  bottomSpacing: { height: 120 },

  floatingButtonContainer: { position: 'absolute', bottom: 30, left: 20, right: 20, zIndex: 10 },
  floatingButton: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 12,
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
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  glassIconContainer: {
    width: 48,
    height: 48,
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
    position: 'relative',
    overflow: 'hidden',
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
  glassRarityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginLeft: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    position: 'relative',
    overflow: 'hidden',
  },
  glassBenefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    position: 'relative',
    overflow: 'hidden',
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  glassButtonTitle: {
    color: '#FFFFFF',
    fontSize: responsiveFontSize.xl,
    fontWeight: '700',
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
});
