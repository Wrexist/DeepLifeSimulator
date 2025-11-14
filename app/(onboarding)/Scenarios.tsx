import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Image, Dimensions, Animated, Easing } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { scenarios } from '@/src/features/onboarding/scenarioData';
import { useOnboarding } from '@/src/features/onboarding/OnboardingContext';
import { ArrowLeft, ArrowRight } from 'lucide-react-native';
import { responsiveFontSize, responsivePadding, responsiveSpacing, scale, verticalScale } from '@/utils/scaling';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

export default function Scenarios() {
  const { state, setState } = useOnboarding();
  const router = useRouter();
  const [selected, setSelected] = useState<string | null>(state.scenario?.id || null);

  // Animations
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;

  // Rotating background animation
  useEffect(() => {
    const rotateAnimation = Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 30000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    
    if (rotateAnimation) {
      rotateAnimation.start();
    }

    return () => {
      if (rotateAnimation) {
        rotateAnimation.stop();
      }
    };
  }, [rotateAnim]);

  // Fade in and slide up animation
  useEffect(() => {
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
    
    if (parallelAnimation) {
      parallelAnimation.start();
    }

    return () => {
      if (parallelAnimation) {
        parallelAnimation.stop();
      }
    };
  }, [fadeAnim, slideAnim]);

  const select = (id: string) => {
    setSelected(id);
    setState(prev => ({ ...prev, scenario: scenarios.find(s => s.id === id)! }));
  };

  const next = () => {
    if (selected) {
      router.push('/(onboarding)/Customize');
    }
  };

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
            transform: [{ translateY: slideAnim }]
          }
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
          <Text style={styles.title}>Choose Your Scenario</Text>
          <View style={styles.placeholder} />
        </View>

        <ScrollView style={styles.scrollContainer} showsVerticalScrollIndicator={true}>
          <View style={styles.scrollContent}>
            {/* Hero section */}
            <View style={styles.heroSection}>
              <View style={styles.glassCard}>
                <View style={styles.glassOverlay} />
                <Text style={styles.heroTitle}>Select Your Life Path</Text>
                <Text style={styles.heroSubtitle}>Choose a scenario that defines your starting point</Text>
              </View>
            </View>

            {/* Scenarios list */}
            <View style={styles.scenariosContainer}>
              {scenarios.map((scenario) => {
                const isSelected = selected === scenario.id;
                
                return (
                  <TouchableOpacity
                    key={scenario.id}
                    style={styles.scenarioContainer}
                    onPress={() => select(scenario.id)}
                  >
                    <BlurView intensity={20} style={styles.scenarioBlur}>
                      <LinearGradient
                        colors={isSelected ? ['rgba(16, 185, 129, 0.2)', 'rgba(5, 150, 105, 0.2)'] : ['rgba(31, 41, 55, 0.8)', 'rgba(17, 24, 39, 0.8)']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.scenarioCard}
                      >
                        <View style={styles.scenarioHeader}>
                          <View style={styles.iconContainer}>
                            <Image source={scenario.icon} style={styles.scenarioIcon} />
                          </View>
                          <View style={styles.scenarioInfo}>
                            <Text style={styles.scenarioTitle}>{scenario.title}</Text>
                            <Text style={styles.scenarioDescription}>{scenario.description}</Text>
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
                            <Text style={styles.statValue}>{scenario.start.age}</Text>
                          </View>
                          <View style={styles.glassStatItem}>
                            <View style={styles.glassOverlay} />
                            <Text style={styles.statLabel}>Cash</Text>
                            <Text style={styles.statValue}>${scenario.start.cash.toLocaleString()}</Text>
                          </View>
                          <View style={styles.glassStatItem}>
                            <View style={styles.glassOverlay} />
                            <Text style={styles.statLabel}>Study</Text>
                            <Text style={styles.statValue}>{scenario.start.education || 'None'}</Text>
                          </View>
                        </View>

                        {/* Items and Traits */}
                        {(scenario.start.items && scenario.start.items.length > 0) || (scenario.start.traits && scenario.start.traits.length > 0) ? (
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
            <View style={styles.bottomSpacing} />
          </View>
        </ScrollView>

        {/* Floating Continue Button */}
        <View style={styles.floatingButtonContainer}>
          <TouchableOpacity
            onPress={next}
            style={[styles.floatingButton, !selected && styles.floatingButtonDisabled]}
            disabled={!selected}
            activeOpacity={0.8}
          >
            <View style={styles.glassButton}>
              <View style={styles.glassOverlay} />
              <View style={styles.buttonContent}>
                <Text style={[styles.glassButtonTitle, !selected && styles.glassButtonTitleDisabled]}>
                  Continue
                </Text>
                <View style={styles.glassIconContainer}>
                  <ArrowRight size={20} color={selected ? "#FFFFFF" : "rgba(255, 255, 255, 0.5)"} />
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
    textAlign: 'center',
    flex: 1,
  },
  backButton: {
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 10,
  },
  glassButton: {
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
  },
  placeholder: {
    width: 48,
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
  scenarioTitle: {
    fontSize: responsiveFontSize.xl,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  scenarioDescription: {
    fontSize: responsiveFontSize.base,
    color: '#D1D5DB',
    lineHeight: 20,
  },
  selectedIndicator: {
    width: 32,
    height: 32,
    borderRadius: 16,
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
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
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
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 12,
  },
  floatingButtonDisabled: {
    opacity: 0.5,
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
  glassOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 16,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  glassButtonTitle: {
    fontSize: responsiveFontSize.xl,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  glassButtonTitleDisabled: {
    color: 'rgba(255, 255, 255, 0.5)',
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
});
