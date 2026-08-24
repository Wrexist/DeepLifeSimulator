import React, { useEffect, useRef } from 'react';
import { Platform, Modal, View, Text, StyleSheet, ScrollView, TouchableOpacity, Animated, Dimensions } from 'react-native';
import Gradient from '@/components/ui/Gradient';
import { useGame } from '@/contexts/GameContext';
import { Heart, Sparkles, Crown, PartyPopper, Gem as Rings } from 'lucide-react-native';
import { scale, fontScale, responsivePadding } from '@/utils/scaling';
import { getShadow } from '@/utils/shadow';
const LinearGradient = Gradient;

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

  // P2-2: keep refs to the running loops so the cleanup function always runs
  // (the previous version only registered cleanup inside the
  // `if (showWeddingPopup)` block - if the popup mounted and unmounted while
  // `showWeddingPopup` was false, the loops weren't cleaned up).
  const loopsRef = useRef<Animated.CompositeAnimation[]>([]);
  useEffect(() => {
    if (showWeddingPopup) {
      // Start entrance animations
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.spring(scaleAnim, { toValue: 1, tension: 50, friction: 7, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 0, duration: 700, useNativeDriver: true }),
      ]).start();

      const heartLoop = Animated.loop(Animated.sequence([
        Animated.timing(heartPulseAnim, { toValue: 1.3, duration: 1000, useNativeDriver: true }),
        Animated.timing(heartPulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
      ]));
      const sparkleLoop = Animated.loop(Animated.sequence([
        Animated.timing(sparkleAnim, { toValue: 1, duration: 1500, useNativeDriver: true }),
        Animated.timing(sparkleAnim, { toValue: 0.3, duration: 1500, useNativeDriver: true }),
      ]));
      const confettiLoop = Animated.loop(Animated.sequence([
        Animated.timing(confettiAnim, { toValue: 1, duration: 2000, useNativeDriver: true }),
        Animated.timing(confettiAnim, { toValue: 0, duration: 2000, useNativeDriver: true }),
      ]));
      heartLoop.start();
      sparkleLoop.start();
      confettiLoop.start();
      loopsRef.current = [heartLoop, sparkleLoop, confettiLoop];
    }
    // Unconditional cleanup - fires on unmount or when showWeddingPopup
    // toggles back to false.
    return () => {
      loopsRef.current.forEach(l => l.stop());
      loopsRef.current = [];
    };
  }, [showWeddingPopup, fadeAnim, scaleAnim, slideAnim, heartPulseAnim, sparkleAnim, confettiAnim]);

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
            {/* ── The scroll surface ───────────────────────────────────────
                Header + body live inside a shrinking scroller; the Continue
                button stays pinned below it as a sibling.

                The card is bounded (`maxHeight: height * 0.85`) and clips
                (`overflow: 'hidden'`), and this column - crest, congratulation
                line, celebration box, three reward rows, closing line, CTA -
                measures taller than that bound on a normal phone. With nothing
                scrollable, the overflow went off the bottom of the card and
                took the Continue button with it: the popup blocks every other
                surface, so a player whose button was clipped had no way out of
                it at all (the bug report screenshot ends at the closing line).

                `flexShrink: 1` rather than `flex: 1` is deliberate, and it is
                the same rule `ApplyCardModal` follows: `flex: 1` is flexBasis 0
                + grow with shrink still 0, so a footer taller than the
                left-over space takes ALL of it and the scroll area resolves to
                zero height - the DeathPopup failure. Shrink lets the scroller
                take whatever the pinned button leaves, at any screen size. */}
            <ScrollView
              style={styles.scrollArea}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={true}
              bounces={false}
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
                <Text style={styles.title}>YOU'RE MARRIED!</Text>
              </View>

              {/* Main content */}
              <View style={styles.content}>
                <Text style={styles.message}>
                  Congratulations! You and <Text style={styles.partnerName}>{weddingPartnerName}</Text> are now officially married!
                </Text>

                <View style={styles.celebrationBox}>
                  <Text style={styles.celebrationText}>Wedding Celebration</Text>
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
                  May your love story be filled with joy, adventure, and happily ever after.
                </Text>
              </View>
            </ScrollView>

            {/* Continue button - pinned OUTSIDE the scroller on purpose, so the
                one way to dismiss the popup is on screen the moment it opens
                and never scrolls away. */}
            <TouchableOpacity style={styles.continueButton} onPress={closePopup}>
              <LinearGradient
                colors={['#FFD700', '#FFA500', '#FF8C00']}
                style={styles.buttonGradient}
              >
                <Text style={styles.buttonText}>Continue Your Love Story</Text>
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
    // `stretch`, not `center`: a centred cross-axis would size the ScrollView
    // to its content width instead of the card's. The children that wanted
    // centring get it from `scrollContent` below.
    alignItems: 'stretch',
    // Lets the gradient give height back to the card's `maxHeight` bound
    // instead of growing past it and clipping the button away.
    flexShrink: 1,
  },
  scrollArea: {
    flexShrink: 1,
  },
  scrollContent: {
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
    ...Platform.select({
      web: { textShadow: '2px 2px 4px rgba(0, 0, 0, 0.5)' } as any,
      default: {
        textShadowColor: 'rgba(0, 0, 0, 0.5)',
        textShadowOffset: { width: 2, height: 2 },
        textShadowRadius: 4,
      },
    }),
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
