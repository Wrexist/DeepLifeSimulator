import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Image, Dimensions, Animated, Easing, TextInput } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useOnboarding } from '@/src/features/onboarding/OnboardingContext';
import { generateRandomName } from '@/src/features/onboarding/nameData';
import { ArrowLeft, Shuffle } from 'lucide-react-native';
import { responsiveFontSize, responsivePadding, responsiveSpacing, scale, verticalScale } from '@/utils/scaling';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

export default function Customize() {
  const { state, setState } = useOnboarding();
  const router = useRouter();
  const [firstName, setFirstName] = useState(state.firstName || '');
  const [lastName, setLastName] = useState(state.lastName || '');
  const [sex, setSex] = useState(state.sex || 'random');
  const [sexuality, setSexuality] = useState(state.sexuality || 'straight');

  // Generate random name on first load if no names are set
  useEffect(() => {
    if (!firstName && !lastName) {
      const randomName = generateRandomName(sex);
      setFirstName(randomName.firstName);
      setLastName(randomName.lastName);
    }
  }, []);

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

  const generateRandomNameHandler = () => {
    const randomName = generateRandomName(sex);
    setFirstName(randomName.firstName);
    setLastName(randomName.lastName);
  };

  // Update name when sex changes if using random
  useEffect(() => {
    if (sex === 'random' && (firstName || lastName)) {
      const randomName = generateRandomName(sex);
      setFirstName(randomName.firstName);
      setLastName(randomName.lastName);
    }
  }, [sex]);

  const next = () => {
    setState(prev => ({ ...prev, firstName, lastName, sex, sexuality }));
    router.push('/(onboarding)/Perks');
  };

  const rotateInterpolate = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

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
          <Text style={styles.title}>Customize Character</Text>
          <View style={styles.placeholder} />
        </View>

        <ScrollView style={styles.scrollContainer} showsVerticalScrollIndicator={true}>
          <View style={styles.scrollContent}>
            {/* Hero section */}
            <View style={styles.heroSection}>
              <View style={styles.glassCard}>
                <View style={styles.glassOverlay} />
                <Text style={styles.heroTitle}>Define Your Identity</Text>
                <Text style={styles.heroSubtitle}>Choose your character's traits and preferences</Text>
              </View>
            </View>

            {/* Name selection */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Name</Text>
                <TouchableOpacity style={styles.randomNameButton} onPress={generateRandomNameHandler}>
                  <View style={styles.glassButton}>
                    <View style={styles.glassOverlay} />
                    <Shuffle size={16} color="#10B981" />
                    <Text style={styles.randomNameButtonText}>Random</Text>
                  </View>
                </TouchableOpacity>
              </View>
              <View style={styles.nameContainer}>
                <View style={styles.nameInputContainer}>
                  <Text style={styles.inputLabel}>First Name</Text>
                  <View style={styles.glassInput}>
                    <View style={styles.glassOverlay} />
                    <TextInput
                      style={styles.textInput}
                      placeholder="Enter first name"
                      placeholderTextColor="#6B7280"
                      value={firstName}
                      onChangeText={setFirstName}
                    />
                  </View>
                </View>
                <View style={styles.nameInputContainer}>
                  <Text style={styles.inputLabel}>Last Name</Text>
                  <View style={styles.glassInput}>
                    <View style={styles.glassOverlay} />
                    <TextInput
                      style={styles.textInput}
                      placeholder="Enter last name"
                      placeholderTextColor="#6B7280"
                      value={lastName}
                      onChangeText={setLastName}
                    />
                  </View>
                </View>
              </View>
            </View>

            {/* Sex selection */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Sex</Text>
              <View style={styles.sexOptionsContainer}>
                <TouchableOpacity
                  style={styles.sexOptionContainer}
                  onPress={() => setSex('male')}
                >
                  <View style={[styles.glassOptionCard, sex === 'male' && styles.glassOptionCardSelected]}>
                    <View style={styles.glassOverlay} />
                    <Image source={require('@/assets/images/Sex/Male.png')} style={styles.optionIcon} />
                    <Text style={styles.sexOptionText}>Male</Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.sexOptionContainer}
                  onPress={() => setSex('female')}
                >
                  <View style={[styles.glassOptionCard, sex === 'female' && styles.glassOptionCardSelected]}>
                    <View style={styles.glassOverlay} />
                    <Image source={require('@/assets/images/Sex/Female.png')} style={styles.optionIcon} />
                    <Text style={styles.sexOptionText}>Female</Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.sexOptionContainer}
                  onPress={() => setSex('random')}
                >
                  <View style={[styles.glassOptionCard, sex === 'random' && styles.glassOptionCardSelected]}>
                    <View style={styles.glassOverlay} />
                    <Image source={require('@/assets/images/Sex/Dice.png')} style={styles.optionIcon} />
                    <Text style={styles.sexOptionTextRandom}>Random</Text>
                  </View>
                </TouchableOpacity>
              </View>
            </View>

            {/* Sexuality selection */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Sexuality</Text>
              <View style={styles.sexualityOptionsContainer}>
                <TouchableOpacity
                  style={styles.sexualityOptionContainer}
                  onPress={() => setSexuality('straight')}
                >
                  <View style={[styles.glassOptionCard, sexuality === 'straight' && styles.glassOptionCardSelected]}>
                    <View style={styles.glassOverlay} />
                    <Text style={styles.sexualityOptionText}>Straight</Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.sexualityOptionContainer}
                  onPress={() => setSexuality('gay')}
                >
                  <View style={[styles.glassOptionCard, sexuality === 'gay' && styles.glassOptionCardSelected]}>
                    <View style={styles.glassOverlay} />
                    <Text style={styles.sexualityOptionText}>Gay</Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.sexualityOptionContainer}
                  onPress={() => setSexuality('bi')}
                >
                  <View style={[styles.glassOptionCard, sexuality === 'bi' && styles.glassOptionCardSelected]}>
                    <View style={styles.glassOverlay} />
                    <Text style={styles.sexualityOptionText}>Bisexual</Text>
                  </View>
                </TouchableOpacity>
              </View>
            </View>

            {/* Next button */}
            <TouchableOpacity style={styles.nextButton} onPress={next}>
              <View style={styles.glassButton}>
                <View style={styles.glassOverlay} />
                <Text style={styles.glassButtonTitle}>Continue</Text>
              </View>
            </TouchableOpacity>
          </View>
        </ScrollView>

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
    paddingHorizontal: responsivePadding.medium,
    paddingTop: responsiveSpacing.lg,
    paddingBottom: responsiveSpacing.lg,
  },
  title: {
    fontSize: responsiveFontSize.xl,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
    textAlign: 'center',
    flex: 1,
    paddingHorizontal: 8,
    maxWidth: '70%',
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
  section: {
    marginBottom: responsiveSpacing.xl,
    paddingHorizontal: responsivePadding.medium,
  },
  nameContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  nameInputContainer: {
    flex: 1,
  },
  inputLabel: {
    fontSize: responsiveFontSize.base,
    fontWeight: '600',
    color: '#E5E7EB',
    marginBottom: 10,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  inputBlur: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 12,
  },
  inputGradient: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderWidth: 0,
  },
  textInput: {
    fontSize: responsiveFontSize.lg,
    color: '#FFFFFF',
    padding: 0,
    fontWeight: '500',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: responsiveFontSize.xl,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
    marginBottom: responsiveSpacing.sm,
  },
  randomNameButton: {
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  randomNameButtonBlur: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  randomNameButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 6,
  },
  randomNameButtonText: {
    fontSize: responsiveFontSize.base,
    fontWeight: '600',
    color: '#10B981',
  },
  optionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  optionContainer: {
    flex: 1,
    minHeight: 100, // Ensure consistent height
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 12,
  },
  optionBlur: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  optionCard: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    minHeight: 100, // Match container height
  },
  optionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginBottom: 12,
  },
  optionText: {
    fontSize: responsiveFontSize.base, // Reduced from lg to base for better fit
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
    lineHeight: responsiveFontSize.base * 1.2, // Better line height for readability
    flexWrap: 'wrap', // Allow text wrapping if needed
  },
  // Sex-specific styles for consistent sizing
  sexOptionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  sexOptionContainer: {
    flex: 1,
    minHeight: 120, // Slightly taller for sex options with icons
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 12,
  },
  sexOptionCard: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    minHeight: 120, // Match container height
  },
  sexOptionText: {
    fontSize: responsiveFontSize.base,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
    lineHeight: responsiveFontSize.base * 1.2,
  },
  sexOptionTextRandom: {
    fontSize: responsiveFontSize.sm, // Smaller font for "Random"
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
    lineHeight: responsiveFontSize.sm * 1.2,
  },
  // Sexuality-specific styles for better text handling
  sexualityOptionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  sexualityOptionContainer: {
    flex: 1,
    minHeight: 80, // Reduced height to match card
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 12,
  },
  sexualityOptionCard: {
    padding: responsivePadding.small, // Reduced padding for better text fit
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    minHeight: 80, // Reduced height for less padding
  },
  sexualityOptionText: {
    fontSize: Math.min(responsiveFontSize.base, 14), // Smaller font for sexuality options
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
    lineHeight: Math.min(responsiveFontSize.base, 14) * 1.2, // Reduced line height for less padding
    flexWrap: 'wrap',
    maxWidth: '100%', // Ensure text doesn't overflow
    paddingVertical: responsivePadding.small, // Add small vertical padding for text
  },
  nextButton: {
    marginHorizontal: 20,
    marginBottom: 40,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 12,
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
    alignItems: 'center',
    justifyContent: 'center',
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
  glassButtonTitle: {
    fontSize: responsiveFontSize.xl,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
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
  glassInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 20,
    paddingVertical: 16,
    position: 'relative',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 12,
  },
  glassOptionCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 12,
    minHeight: 80,
  },
  glassOptionCardSelected: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderColor: 'rgba(16, 185, 129, 0.25)',
  },
});
