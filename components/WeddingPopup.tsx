import React, { useEffect, useRef } from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, Animated, Dimensions } from 'react-native';
import LinearGradientFallback from '@/components/fallbacks/LinearGradientFallback';
const LinearGradient = LinearGradientFallback;
import { useGame } from '@/contexts/GameContext';
import { Heart, Sparkles, Crown, PartyPopper, Rings } from 'lucide-react-native';
import { scale, fontScale, responsivePadding } from '@/utils/scaling';
import { getShadow } from '@/utils/shadow';

const { width, height } = Dimensions.get('window');

export default function WeddingPopup() {
  const { gameState, setGameState } = useGame();
  const { showWeddingPopup, weddingPartnerName } = gameState;

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const heartPulseAnim = useRef(new Animated.Value(1)).current;
  const sparkleAnim = useRef(new Animated.Value(0)).current;
  const confettiAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (showWeddingPopup) {
      // Start entrance animations
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 50,
          friction: 7,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 700,
          useNativeDriver: true,
        }),
      ]).start();

      // Heart pulse animation
      const heartLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(heartPulseAnim, {
            toValue: 1.3,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(heartPulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      );
      heartLoop.start();

      // Sparkle animation
      const sparkleLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(sparkleAnim, {
            toValue: 1,
            duration: 1500,
            useNativeDriver: true,
          }),
          Animated.timing(sparkleAnim, {
            toValue: 0.3,
            duration: 1500,
            useNativeDriver: true,
          }),
        ])
      );
      sparkleLoop.start();

      // Confetti animation
      const confettiLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(confettiAnim, {
            toValue: 1,
            duration: 2000,
            useNativeDriver: true,
          }),
          Animated.timing(confettiAnim, {
            toValue: 0,
            duration: 2000,
            useNativeDriver: true,
          }),
        ])
      );
      confettiLoop.start();

      return () => {
        heartLoop.stop();
        sparkleLoop.stop();
        confettiLoop.stop();
      };
    }
  }, [showWeddingPopup]);

  const closePopup = () => {
    // Animate out
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 0.8,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 50,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setGameState(prev => ({
        ...prev,
        showWeddingPopup: false,
        weddingPartnerName: undefined,
      }));
    });
  };

  if (!showWeddingPopup || !weddingPartnerName) return null;

  return (
    <Modal visible={showWeddingPopup} transparent animationType="none" onRequestClose={closePopup}>
      <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
        {/* Background sparkles */}
        <Animated.View style={[styles.sparklesContainer, { opacity: sparkleAnim }]}>
          {[...Array(30)].map((_, i) => (
            <Sparkles
              key={i}
              size={scale(10)}
              color="#FFD700"
              style={{
                position: 'absolute',
                left: Math.random() * width,
                top: Math.random() * height,
                transform: [{ rotate: `${Math.random() * 360}deg` }],
                opacity: 0.6 + Math.random() * 0.4,
              }}
            />
          ))}
        </Animated.View>

        {/* Confetti effect */}
        <Animated.View style={[styles.confettiContainer, { opacity: confettiAnim }]}>
          {[...Array(20)].map((_, i) => (
            <PartyPopper
              key={i}
              size={scale(16)}
              color={['#FF69B4', '#FF1493', '#FFD700', '#9370DB', '#FF6347'][i % 5]}
              style={{
                position: 'absolute',
                left: Math.random() * width,
                top: Math.random() * height,
                transform: [{ rotate: `${Math.random() * 360}deg` }],
              }}
            />
          ))}
        </Animated.View>

        <Animated.View
          style={[
            styles.container,
            {
              transform: [
                { scale: scaleAnim },
                { translateY: slideAnim },
              ],
            },
          ]}
        >
          <LinearGradient
            colors={['#FF69B4', '#FF1493', '#DC143C', '#C71585']}
            style={styles.gradientBackground}
          >
            {/* Header with animated heart */}
            <View style={styles.header}>
              <Animated.View style={{ transform: [{ scale: heartPulseAnim }] }}>
                <View style={styles.heartContainer}>
                  <Rings size={scale(50)} color="#FFD700" strokeWidth={2} />
                  <Heart 
                    size={scale(50)} 
                    color="#FFFFFF" 
                    fill="#FFFFFF" 
                    style={styles.heartIcon}
                  />
                </View>
              </Animated.View>
              <Text style={styles.title}>🎉 YOU'RE MARRIED! 🎉</Text>
            </View>

            {/* Main content */}
            <View style={styles.content}>
              <Text style={styles.message}>
                Congratulations! You and <Text style={styles.partnerName}>{weddingPartnerName}</Text> are now officially married!
              </Text>

              <View style={styles.celebrationBox}>
                <Text style={styles.celebrationText}>💒 Wedding Celebration 💒</Text>
                <Text style={styles.celebrationSubtext}>
                  Your special day has arrived! Time to celebrate your love story together.
                </Text>
              </View>

              <View style={styles.benefitsContainer}>
                <Text style={styles.benefitsTitle}>Wedding Rewards:</Text>
                <View style={styles.benefitItem}>
                  <Crown size={scale(22)} color="#FFD700" />
                  <Text style={styles.benefitText}>+20 Relationship Points</Text>
                </View>
                <View style={styles.benefitItem}>
                  <Heart size={scale(22)} color="#FF69B4" />
                  <Text style={styles.benefitText}>Spouse Status Unlocked</Text>
                </View>
                <View style={styles.benefitItem}>
                  <PartyPopper size={scale(22)} color="#9370DB" />
                  <Text style={styles.benefitText}>Happiness Boost</Text>
                </View>
              </View>

              <Text style={styles.congratulations}>
                May your love story be filled with joy, adventure, and happily ever after! 💕
              </Text>
            </View>

            {/* Continue button */}
            <TouchableOpacity style={styles.continueButton} onPress={closePopup}>
              <LinearGradient
                colors={['#FFD700', '#FFA500', '#FF8C00']}
                style={styles.buttonGradient}
              >
                <Text style={styles.buttonText}>Continue Your Love Story 💑</Text>
              </LinearGradient>
            </TouchableOpacity>
          </LinearGradient>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sparklesContainer: {
    ...StyleSheet.absoluteFillObject,
    pointerEvents: 'none',
  },
  confettiContainer: {
    ...StyleSheet.absoluteFillObject,
    pointerEvents: 'none',
  },
  container: {
    width: width * 0.9,
    maxWidth: scale(400),
    maxHeight: height * 0.85,
    borderRadius: scale(28),
    overflow: 'hidden',
    ...getShadow(40, '#FF69B4'),
  },
  gradientBackground: {
    padding: responsivePadding.large,
    alignItems: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: scale(24),
  },
  heartContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: scale(12),
  },
  heartIcon: {
    position: 'absolute',
  },
  title: {
    fontSize: fontScale(26),
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 4,
    letterSpacing: 0.5,
  },
  content: {
    alignItems: 'center',
    marginBottom: scale(24),
    width: '100%',
  },
  message: {
    fontSize: fontScale(18),
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: scale(20),
    lineHeight: fontScale(26),
    fontWeight: '500',
  },
  partnerName: {
    fontWeight: 'bold',
    color: '#FFD700',
    textDecorationLine: 'underline',
    fontSize: fontScale(20),
  },
  celebrationBox: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    borderRadius: scale(16),
    padding: scale(16),
    marginBottom: scale(20),
    width: '100%',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  celebrationText: {
    fontSize: fontScale(20),
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: scale(8),
  },
  celebrationSubtext: {
    fontSize: fontScale(14),
    color: '#FFFFFF',
    textAlign: 'center',
    opacity: 0.9,
    lineHeight: fontScale(20),
  },
  benefitsContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: scale(18),
    padding: scale(16),
    marginBottom: scale(20),
    width: '100%',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  benefitsTitle: {
    fontSize: fontScale(18),
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: scale(12),
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: scale(10),
    paddingVertical: scale(4),
  },
  benefitText: {
    fontSize: fontScale(15),
    color: '#FFFFFF',
    marginLeft: scale(12),
    flex: 1,
    fontWeight: '500',
  },
  congratulations: {
    fontSize: fontScale(16),
    color: '#FFFFFF',
    textAlign: 'center',
    fontStyle: 'italic',
    lineHeight: fontScale(24),
    opacity: 0.95,
  },
  continueButton: {
    width: '100%',
    borderRadius: scale(18),
    overflow: 'hidden',
    ...getShadow(15, '#FFD700'),
  },
  buttonGradient: {
    paddingVertical: scale(16),
    paddingHorizontal: responsivePadding.large,
    alignItems: 'center',
  },
  buttonText: {
    color: '#8B4513',
    fontSize: fontScale(17),
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
});
