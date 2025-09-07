import React, { useEffect, useState, useRef } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, Animated, Dimensions } from 'react-native';
import { Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Trophy, Star, Zap, X, Clock, Users, TrendingUp } from 'lucide-react-native';

interface Props {
  visible: boolean;
  onClose: () => void;
}

export default function LeaderboardModal({ visible, onClose }: Props) {
  const { width: screenWidth } = Dimensions.get('window');
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      // Start animations
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 600,
          useNativeDriver: Platform.OS !== 'web',
        }),
      ]).start();

      // Pulse animation
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.1,
            duration: 1500,
            useNativeDriver: Platform.OS !== 'web',
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1500,
            useNativeDriver: Platform.OS !== 'web',
          }),
        ])
      );
      pulse.start();

      // Rotation animation
      const rotate = Animated.loop(
        Animated.timing(rotateAnim, {
          toValue: 1,
          duration: 3000,
          useNativeDriver: Platform.OS !== 'web',
        })
      );
      rotate.start();
    } else {
      // Reset animations
      fadeAnim.setValue(0);
      slideAnim.setValue(50);
      pulseAnim.setValue(1);
      rotateAnim.setValue(0);
    }
  }, [visible]);

  const spin = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <Modal visible={visible} animationType="fade" onRequestClose={onClose}>
      <View style={styles.container}>
        <LinearGradient
          colors={['#1E293B', '#0F172A', '#020617']}
          style={styles.backgroundGradient}
        >
          {/* Close Button */}
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <X size={24} color="#FFFFFF" />
          </TouchableOpacity>

          {/* Main Content */}
          <Animated.View 
            style={[
              styles.content,
              {
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }],
              }
            ]}
          >
            {/* Trophy Icon with Pulse Animation */}
            <Animated.View style={[styles.trophyContainer, { transform: [{ scale: pulseAnim }] }]}>
              <LinearGradient
                colors={['#FFD700', '#FFA500', '#FF8C00']}
                style={styles.trophyGradient}
              >
                <Trophy size={60} color="#FFFFFF" />
              </LinearGradient>
            </Animated.View>

            {/* Rotating Stars */}
            <Animated.View style={[styles.starContainer, { transform: [{ rotate: spin }] }]}>
              <Star size={20} color="#FFD700" />
            </Animated.View>
            <Animated.View style={[styles.starContainer2, { transform: [{ rotate: spin }] }]}>
              <Star size={16} color="#FFA500" />
            </Animated.View>
            <Animated.View style={[styles.starContainer3, { transform: [{ rotate: spin }] }]}>
              <Star size={18} color="#FF8C00" />
            </Animated.View>

            {/* Title */}
            <Text style={styles.title}>Leaderboard</Text>
            
            {/* Coming Soon Badge */}
            <View style={styles.comingSoonContainer}>
              <LinearGradient
                colors={['#3B82F6', '#1D4ED8', '#1E40AF']}
                style={styles.comingSoonGradient}
              >
                <Clock size={20} color="#FFFFFF" />
                <Text style={styles.comingSoonText}>Coming Soon</Text>
              </LinearGradient>
            </View>

            {/* Description */}
            <Text style={styles.description}>
              Compete with players worldwide and climb the ranks!
            </Text>

            {/* Features Preview */}
            <View style={styles.featuresContainer}>
              <View style={styles.featureItem}>
                <LinearGradient colors={['#10B981', '#059669']} style={styles.featureIcon}>
                  <TrendingUp size={20} color="#FFFFFF" />
                </LinearGradient>
                <Text style={styles.featureText}>Global Rankings</Text>
              </View>
              
              <View style={styles.featureItem}>
                <LinearGradient colors={['#F59E0B', '#D97706']} style={styles.featureIcon}>
                  <Trophy size={20} color="#FFFFFF" />
                </LinearGradient>
                <Text style={styles.featureText}>Weekly Rewards</Text>
              </View>
              
              <View style={styles.featureItem}>
                <LinearGradient colors={['#8B5CF6', '#7C3AED']} style={styles.featureIcon}>
                  <Users size={20} color="#FFFFFF" />
                </LinearGradient>
                <Text style={styles.featureText}>Player Profiles</Text>
              </View>
            </View>

            {/* Notification Button */}
            <TouchableOpacity style={styles.notifyButton}>
              <LinearGradient
                colors={['#3B82F6', '#1D4ED8']}
                style={styles.notifyButtonGradient}
              >
                <Zap size={20} color="#FFFFFF" />
                <Text style={styles.notifyButtonText}>Get Notified</Text>
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>
        </LinearGradient>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  backgroundGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  closeButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 10,
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    maxWidth: 400,
  },
  trophyContainer: {
    marginBottom: 30,
  },
  trophyGradient: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#FFD700',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
  },
  starContainer: {
    position: 'absolute',
    top: 50,
    right: 60,
  },
  starContainer2: {
    position: 'absolute',
    top: 80,
    left: 40,
  },
  starContainer3: {
    position: 'absolute',
    top: 120,
    right: 30,
  },
  title: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 20,
    textAlign: 'center',
    textShadow: '0px 2px 4px rgba(0, 0, 0, 0.5)',
  },
  comingSoonContainer: {
    marginBottom: 30,
  },
  comingSoonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
    gap: 8,
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
  },
  comingSoonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  description: {
    fontSize: 16,
    color: '#E5E7EB',
    textAlign: 'center',
    marginBottom: 40,
    lineHeight: 24,
    paddingHorizontal: 20,
  },
  featuresContainer: {
    width: '100%',
    marginBottom: 40,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    paddingHorizontal: 20,
  },
  featureIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  featureText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  notifyButton: {
    width: '100%',
    maxWidth: 300,
  },
  notifyButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    gap: 10,
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  notifyButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
});
