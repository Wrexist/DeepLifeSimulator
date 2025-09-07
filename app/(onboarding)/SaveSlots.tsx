import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Dimensions, Animated, Easing } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useOnboarding } from '@/src/features/onboarding/OnboardingContext';
import { ArrowLeft, Save, Trash2, Play } from 'lucide-react-native';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

export default function SaveSlots() {
  const { state, setState } = useOnboarding();
  const router = useRouter();
  const [slots, setSlots] = useState<any[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<number | null>(state.slot || null);

  // Animations
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;

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
    
    if (isMounted) {
      rotateAnimation.start();
    }

    return () => {
      isMounted = false;
      rotateAnimation.stop();
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
    
    if (isMounted) {
      parallelAnimation.start();
    }

    return () => {
      isMounted = false;
      parallelAnimation.stop();
    };
  }, [fadeAnim, slideAnim]);

  useEffect(() => {
    loadSlots();
  }, []);

  const loadSlots = async () => {
    const slotData = [];
    for (let i = 1; i <= 3; i++) {
      try {
        const data = await AsyncStorage.getItem(`save_slot_${i}`);
        if (data) {
          const parsed = JSON.parse(data);
          slotData.push({
            id: i,
            ...parsed,
            hasData: true,
          });
        } else {
          slotData.push({
            id: i,
            hasData: false,
          });
        }
      } catch (error) {
        slotData.push({
          id: i,
          hasData: false,
        });
      }
    }
    setSlots(slotData);
  };

  const selectSlot = (slotId: number) => {
    setSelectedSlot(slotId);
    setState(prev => ({ ...prev, slot: slotId }));
    
    // Check if slot is empty (no save data)
    const slot = slots.find(s => s.id === slotId);
    if (!slot || !slot.hasData) {
      // Navigate to Scenarios for new game
      router.push('/(onboarding)/Scenarios');
    }
  };

  const deleteSlot = async (slotId: number) => {
    try {
      await AsyncStorage.removeItem(`save_slot_${slotId}`);
      await loadSlots();
      if (selectedSlot === slotId) {
        setSelectedSlot(null);
        setState(prev => ({ ...prev, slot: 0 }));
      }
    } catch (error) {
      console.error('Error deleting slot:', error);
    }
  };

  const continueToGame = () => {
    if (selectedSlot) {
      router.push('/(tabs)');
    }
  };

  const startNewGame = () => {
    router.push('/(onboarding)/MainMenu');
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
          <TouchableOpacity onPress={() => router.push('/(onboarding)/MainMenu')} style={styles.backButton}>
            <LinearGradient
              colors={['rgba(55, 65, 81, 0.3)', 'rgba(31, 41, 55, 0.3)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.backButtonGradient}
            >
              <ArrowLeft size={24} color="#FFFFFF" />
            </LinearGradient>
          </TouchableOpacity>
          <Text style={styles.title}>Save Slots</Text>
          <View style={styles.placeholder} />
        </View>

        <ScrollView style={styles.scrollContainer} showsVerticalScrollIndicator={false}>
          <View style={styles.scrollContent}>
            {/* Hero section */}
            <View style={styles.heroSection}>
              <Text style={styles.heroTitle}>Choose Your Save Slot</Text>
              <Text style={styles.heroSubtitle}>Select a slot to continue your journey or start fresh</Text>
            </View>

            {/* Save slots */}
            <View style={styles.slotsContainer}>
              {slots.map((slot) => {
                const isSelected = selectedSlot === slot.id;
                const isOccupied = slot.hasData;
                
                return (
                  <TouchableOpacity
                    key={slot.id}
                    style={styles.slotContainer}
                    onPress={() => selectSlot(slot.id)}
                  >
                    <BlurView intensity={20} style={styles.slotBlur}>
                      <LinearGradient
                        colors={isSelected ? ['rgba(16, 185, 129, 0.2)', 'rgba(5, 150, 105, 0.2)'] : ['rgba(31, 41, 55, 0.8)', 'rgba(17, 24, 39, 0.8)']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.slotCard}
                      >
                        <View style={styles.slotHeader}>
                          <View style={styles.slotIconContainer}>
                            <LinearGradient
                              colors={['rgba(59, 130, 246, 0.2)', 'rgba(99, 102, 241, 0.2)']}
                              style={styles.slotIconGradient}
                            >
                              <Save size={32} color="#FFFFFF" />
                            </LinearGradient>
                          </View>
                          <View style={styles.slotInfo}>
                            <Text style={styles.slotTitle}>Slot {slot.id}</Text>
                            {isOccupied ? (
                              <Text style={styles.slotSubtitle}>
                                {slot.userProfile?.firstName} {slot.userProfile?.lastName} - Age {Math.ceil(slot.date?.age || 0)}
                              </Text>
                            ) : (
                              <Text style={styles.slotSubtitle}>Empty Slot</Text>
                            )}
                          </View>
                          {isSelected && (
                            <View style={styles.selectedIndicator}>
                              <LinearGradient
                                colors={['#10B981', '#059669']}
                                style={styles.selectedGradient}
                              >
                                <Text style={styles.selectedText}>✓</Text>
                              </LinearGradient>
                            </View>
                          )}
                        </View>

                        {isOccupied && (
                          <View style={styles.slotStats}>
                            <View style={styles.statItem}>
                              <Text style={styles.statLabel}>Money</Text>
                              <Text style={styles.statValue}>${slot.stats?.money?.toLocaleString() || 0}</Text>
                            </View>
                            <View style={styles.statItem}>
                              <Text style={styles.statLabel}>Age</Text>
                              <Text style={styles.statValue}>{Math.ceil(slot.date?.age || 0)}</Text>
                            </View>
                            <View style={styles.statItem}>
                              <Text style={styles.statLabel}>Week</Text>
                              <Text style={styles.statValue}>{slot.date?.week || 0}</Text>
                            </View>
                          </View>
                        )}

                        <View style={styles.slotActions}>
                          {isOccupied && (
                            <TouchableOpacity
                              style={styles.deleteButton}
                              onPress={() => deleteSlot(slot.id)}
                            >
                              <LinearGradient
                                colors={['rgba(239, 68, 68, 0.2)', 'rgba(220, 38, 38, 0.2)']}
                                style={styles.deleteButtonGradient}
                              >
                                <Trash2 size={16} color="#EF4444" />
                                <Text style={styles.deleteButtonText}>Delete</Text>
                              </LinearGradient>
                            </TouchableOpacity>
                          )}
                        </View>
                      </LinearGradient>
                    </BlurView>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Action buttons */}
            <View style={styles.actionButtons}>
              {selectedSlot && slots.find(s => s.id === selectedSlot)?.hasData ? (
                <TouchableOpacity style={styles.continueButton} onPress={continueToGame}>
                  <BlurView intensity={20} style={styles.continueButtonBlur}>
                    <LinearGradient
                      colors={['rgba(16, 185, 129, 0.7)', 'rgba(5, 150, 105, 0.7)']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.continueButtonGradient}
                    >
                      <Play size={24} color="#FFFFFF" />
                      <Text style={styles.continueButtonText}>Continue Game</Text>
                    </LinearGradient>
                  </BlurView>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={styles.newGameButton} onPress={startNewGame}>
                  <BlurView intensity={20} style={styles.newGameButtonBlur}>
                    <LinearGradient
                      colors={['rgba(59, 130, 246, 0.7)', 'rgba(99, 102, 241, 0.7)']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.newGameButtonGradient}
                    >
                      <Text style={styles.newGameButtonText}>Start New Game</Text>
                    </LinearGradient>
                  </BlurView>
                </TouchableOpacity>
              )}
            </View>
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
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
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
    paddingHorizontal: 20,
    marginBottom: 30,
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 8,
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  heroSubtitle: {
    fontSize: 16,
    color: '#94A3B8',
    textAlign: 'center',
    fontWeight: '500',
  },
  slotsContainer: {
    gap: 16,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  slotContainer: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 12,
  },
  slotBlur: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  slotCard: {
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  slotHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  slotIconContainer: {
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
  slotIconGradient: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  slotInfo: {
    flex: 1,
  },
  slotTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  slotSubtitle: {
    fontSize: 14,
    color: '#D1D5DB',
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
  slotStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
    marginBottom: 16,
  },
  statItem: {
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 12,
    color: '#9CA3AF',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  slotActions: {
    alignItems: 'flex-end',
  },
  deleteButton: {
    borderRadius: 8,
    overflow: 'hidden',
  },
  deleteButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  deleteButtonText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#EF4444',
    marginLeft: 4,
  },
  actionButtons: {
    paddingHorizontal: 20,
    marginBottom: 40,
  },
  continueButton: {
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 12,
  },
  continueButtonBlur: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  continueButtonGradient: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  continueButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginLeft: 8,
  },
  newGameButton: {
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 12,
  },
  newGameButtonBlur: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  newGameButtonGradient: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.3)',
  },
  newGameButtonText: {
    fontSize: 18,
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

