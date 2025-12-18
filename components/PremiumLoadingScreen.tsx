import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  Animated,
  Easing,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
// BlurView removed - TurboModule crash fix
// import { BlurView } from 'expo-blur';
import { 
  Zap, 
  Star, 
  TrendingUp, 
  Heart,
  Users,
  MessageCircle,
  CreditCard,
  Home,
  Globe,
  Bitcoin,
  Building,
  GraduationCap,
  PawPrint
} from 'lucide-react-native';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface PremiumLoadingScreenProps {
  progress: number; // 0 to 100
  message?: string;
  isCacheClearing?: boolean;
  oldVersion?: string;
  newVersion?: string;
}

export default function PremiumLoadingScreen({
  progress,
  message = 'Loading DeepLife Simulator...',
  isCacheClearing = false,
  oldVersion,
  newVersion,
}: PremiumLoadingScreenProps) {
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  // Rotating animation for the background elements
  useEffect(() => {
    const rotateAnimation = Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 20000,
        easing: Easing.linear,
        useNativeDriver: Platform.OS !== 'web',
      })
    );
    rotateAnimation.start();

    return () => rotateAnimation.stop();
  }, [rotateAnim]);

  // Fade in animation
  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 800,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  }, [fadeAnim]);

  // Progress animation
  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: progress,
      duration: 500,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false, // Must be false because this animates width property
    }).start();
  }, [progress, progressAnim]);

  const rotateInterpolate = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const featureIcons = [
    { icon: Heart, color: '#FF4757', label: 'Relationships' },
    { icon: TrendingUp, color: '#00B894', label: 'Trading' },
    { icon: Building, color: '#5F27CD', label: 'Business' },
    { icon: Bitcoin, color: '#FFD700', label: 'Crypto' },
    { icon: Home, color: '#00B894', label: 'Real Estate' },
    { icon: Globe, color: '#2D3748', label: 'Dark Web' },
  ];

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
      <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
        {/* Hero section */}
        <View style={styles.heroSection}>
          <Text style={styles.title}>DeepLife Simulator</Text>
          <Text style={styles.subtitle}>Your Ultimate Life Simulation Experience</Text>
        </View>

        {/* Loading progress section */}
        <View style={styles.progressSection}>
          <View style={styles.progressContainer}>
            <View style={styles.progressBackground}>
              <Animated.View
                style={[
                  styles.progressFill,
                  {
                    width: progressAnim.interpolate({
                      inputRange: [0, 100],
                      outputRange: ['0%', '100%'],
                    }),
                  },
                ]}
              />
            </View>
            <Text style={styles.progressText}>{Math.round(progress)}%</Text>
          </View>
          
          <Text style={styles.loadingMessage}>{message}</Text>
          
          {isCacheClearing && (
            <View style={styles.cacheUpdateCard}>
              <LinearGradient
                colors={['rgba(59, 130, 246, 0.1)', 'rgba(99, 102, 241, 0.1)']}
                style={styles.cacheCardGradient}
              >
                <Zap size={20} color="#3B82F6" />
                <Text style={styles.cacheUpdateText}>
                  Updating to version {newVersion}
                </Text>
                {oldVersion && (
                  <Text style={styles.cacheUpdateSubtext}>
                    From {oldVersion}
                  </Text>
                )}
              </LinearGradient>
            </View>
          )}
        </View>

        {/* Feature preview cards */}
        <View style={styles.featuresSection}>
          <Text style={styles.featuresTitle}>Experience Life Like Never Before</Text>
          <View style={styles.featuresGrid}>
            {featureIcons.map((feature, index) => (
              <Animated.View
                key={feature.label}
                style={[
                  styles.featureCard,
                  {
                    opacity: fadeAnim,
                    transform: [
                      {
                        translateY: fadeAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [50, 0],
                        }),
                      },
                    ],
                  },
                ]}
              >
                <LinearGradient
                  colors={[`${feature.color}20`, `${feature.color}10`]}
                  style={styles.featureGradient}
                >
                  <feature.icon size={24} color={feature.color} />
                  <Text style={styles.featureLabel}>{feature.label}</Text>
                </LinearGradient>
              </Animated.View>
            ))}
          </View>
        </View>

        {/* Floating particles */}
        <View style={styles.particlesContainer}>
          {[...Array(6)].map((_, index) => (
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
    justifyContent: 'center',
    alignItems: 'center',
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
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    width: '100%',
  },
  heroSection: {
    alignItems: 'center',
    marginBottom: 60,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 8,
    textShadow: '0px 2px 4px rgba(0, 0, 0, 0.5)',
  },
  subtitle: {
    fontSize: 16,
    color: '#94A3B8',
    textAlign: 'center',
    fontWeight: '500',
  },
  progressSection: {
    width: '100%',
    marginBottom: 60,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  progressBackground: {
    flex: 1,
    height: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 4,
    marginRight: 15,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#3B82F6',
    borderRadius: 4,
    boxShadow: '0px 2px 4px rgba(59, 130, 246, 0.5)',
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
  },
  progressText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
    minWidth: 45,
  },
  loadingMessage: {
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center',
    marginBottom: 20,
  },
  cacheUpdateCard: {
    marginTop: 10,
  },
  cacheCardGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.3)',
  },
  cacheUpdateText: {
    fontSize: 14,
    color: '#3B82F6',
    fontWeight: '600',
    marginLeft: 8,
  },
  cacheUpdateSubtext: {
    fontSize: 12,
    color: '#64748B',
    marginLeft: 8,
  },
  featuresSection: {
    width: '100%',
  },
  featuresTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 20,
  },
  featuresGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  featureCard: {
    width: '48%',
    marginBottom: 12,
  },
  featureGradient: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  featureLabel: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '600',
    marginTop: 8,
    textAlign: 'center',
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
