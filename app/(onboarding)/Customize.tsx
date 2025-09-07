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
            <LinearGradient
              colors={['rgba(55, 65, 81, 0.3)', 'rgba(31, 41, 55, 0.3)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.backButtonGradient}
            >
              <ArrowLeft size={24} color="#FFFFFF" />
            </LinearGradient>
          </TouchableOpacity>
          <Text style={styles.title}>Customize Character</Text>
          <View style={styles.placeholder} />
        </View>

        <ScrollView style={styles.scrollContainer} showsVerticalScrollIndicator={false}>
          <View style={styles.scrollContent}>
            {/* Hero section */}
            <View style={styles.heroSection}>
              <Text style={styles.heroTitle}>Define Your Identity</Text>
              <Text style={styles.heroSubtitle}>Choose your character's traits and preferences</Text>
            </View>

            {/* Name selection */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Name</Text>
                <TouchableOpacity style={styles.randomNameButton} onPress={generateRandomNameHandler}>
                  <BlurView intensity={20} style={styles.randomNameButtonBlur}>
                    <LinearGradient
                      colors={['rgba(16, 185, 129, 0.3)', 'rgba(5, 150, 105, 0.3)']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.randomNameButtonGradient}
                    >
                      <Shuffle size={16} color="#10B981" />
                      <Text style={styles.randomNameButtonText}>Random</Text>
                    </LinearGradient>
                  </BlurView>
                </TouchableOpacity>
              </View>
              <View style={styles.nameContainer}>
                <View style={styles.nameInputContainer}>
                  <Text style={styles.inputLabel}>First Name</Text>
                  <BlurView intensity={20} style={styles.inputBlur}>
                    <LinearGradient
                      colors={['rgba(31, 41, 55, 0.9)', 'rgba(17, 24, 39, 0.9)']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.inputGradient}
                    >
                      <TextInput
                        style={styles.textInput}
                        placeholder="Enter first name"
                        placeholderTextColor="#6B7280"
                        value={firstName}
                        onChangeText={setFirstName}
                      />
                    </LinearGradient>
                  </BlurView>
                </View>
                <View style={styles.nameInputContainer}>
                  <Text style={styles.inputLabel}>Last Name</Text>
                  <BlurView intensity={20} style={styles.inputBlur}>
                    <LinearGradient
                      colors={['rgba(31, 41, 55, 0.9)', 'rgba(17, 24, 39, 0.9)']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.inputGradient}
                    >
                      <TextInput
                        style={styles.textInput}
                        placeholder="Enter last name"
                        placeholderTextColor="#6B7280"
                        value={lastName}
                        onChangeText={setLastName}
                      />
                    </LinearGradient>
                  </BlurView>
                </View>
              </View>
            </View>

            {/* Sex selection */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Sex</Text>
              <View style={styles.optionsContainer}>
                <TouchableOpacity
                  style={styles.optionContainer}
                  onPress={() => setSex('male')}
                >
                  <BlurView intensity={20} style={styles.optionBlur}>
                    <LinearGradient
                      colors={sex === 'male' ? ['rgba(16, 185, 129, 0.2)', 'rgba(5, 150, 105, 0.2)'] : ['rgba(31, 41, 55, 0.8)', 'rgba(17, 24, 39, 0.8)']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.optionCard}
                    >
                      <Image source={require('@/assets/images/Sex/Male.png')} style={styles.optionIcon} />
                      <Text style={styles.optionText}>Male</Text>
                    </LinearGradient>
                  </BlurView>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.optionContainer}
                  onPress={() => setSex('female')}
                >
                  <BlurView intensity={20} style={styles.optionBlur}>
                    <LinearGradient
                      colors={sex === 'female' ? ['rgba(16, 185, 129, 0.2)', 'rgba(5, 150, 105, 0.2)'] : ['rgba(31, 41, 55, 0.8)', 'rgba(17, 24, 39, 0.8)']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.optionCard}
                    >
                      <Image source={require('@/assets/images/Sex/Female.png')} style={styles.optionIcon} />
                      <Text style={styles.optionText}>Female</Text>
                    </LinearGradient>
                  </BlurView>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.optionContainer}
                  onPress={() => setSex('random')}
                >
                  <BlurView intensity={20} style={styles.optionBlur}>
                    <LinearGradient
                      colors={sex === 'random' ? ['rgba(16, 185, 129, 0.2)', 'rgba(5, 150, 105, 0.2)'] : ['rgba(31, 41, 55, 0.8)', 'rgba(17, 24, 39, 0.8)']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.optionCard}
                    >
                      <Image source={require('@/assets/images/Sex/Dice.png')} style={styles.optionIcon} />
                      <Text style={styles.optionText}>Random</Text>
                    </LinearGradient>
                  </BlurView>
                </TouchableOpacity>
              </View>
            </View>

            {/* Sexuality selection */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Sexuality</Text>
              <View style={styles.optionsContainer}>
                <TouchableOpacity
                  style={styles.optionContainer}
                  onPress={() => setSexuality('straight')}
                >
                  <BlurView intensity={20} style={styles.optionBlur}>
                    <LinearGradient
                      colors={sexuality === 'straight' ? ['rgba(16, 185, 129, 0.2)', 'rgba(5, 150, 105, 0.2)'] : ['rgba(31, 41, 55, 0.8)', 'rgba(17, 24, 39, 0.8)']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.optionCard}
                    >
                      <Text style={styles.optionText}>Straight</Text>
                    </LinearGradient>
                  </BlurView>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.optionContainer}
                  onPress={() => setSexuality('gay')}
                >
                  <BlurView intensity={20} style={styles.optionBlur}>
                    <LinearGradient
                      colors={sexuality === 'gay' ? ['rgba(16, 185, 129, 0.2)', 'rgba(5, 150, 105, 0.2)'] : ['rgba(31, 41, 55, 0.8)', 'rgba(17, 24, 39, 0.8)']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.optionCard}
                    >
                      <Text style={styles.optionText}>Gay</Text>
                    </LinearGradient>
                  </BlurView>
                </TouchableOpacity>

                                 <TouchableOpacity
                   style={styles.optionContainer}
                   onPress={() => setSexuality('bi')}
                 >
                   <BlurView intensity={20} style={styles.optionBlur}>
                     <LinearGradient
                       colors={sexuality === 'bi' ? ['rgba(16, 185, 129, 0.2)', 'rgba(5, 150, 105, 0.2)'] : ['rgba(31, 41, 55, 0.8)', 'rgba(17, 24, 39, 0.8)']}
                       start={{ x: 0, y: 0 }}
                       end={{ x: 1, y: 1 }}
                       style={styles.optionCard}
                     >
                       <Text style={styles.optionText}>Bisexual</Text>
                     </LinearGradient>
                   </BlurView>
                 </TouchableOpacity>
              </View>
            </View>

            {/* Next button */}
            <TouchableOpacity style={styles.nextButton} onPress={next}>
              <BlurView intensity={20} style={styles.nextButtonBlur}>
                <LinearGradient
                  colors={['rgba(16, 185, 129, 0.7)', 'rgba(5, 150, 105, 0.7)']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.nextButtonGradient}
                >
                  <Text style={styles.nextButtonText}>Continue</Text>
                </LinearGradient>
              </BlurView>
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
    marginBottom: responsiveSpacing['2xl'],
    paddingHorizontal: responsivePadding.large,
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
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  optionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginBottom: 12,
  },
  optionText: {
    fontSize: responsiveFontSize.lg,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
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
    fontSize: responsiveFontSize.xl,
    fontWeight: 'bold',
    color: '#FFFFFF',
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
