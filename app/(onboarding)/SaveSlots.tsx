import React, { useState, useRef, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Dimensions, Animated, Easing, Platform, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useOnboarding } from '@/src/features/onboarding/OnboardingContext';
import { useGame } from '@/contexts/GameContext';
import { logger } from '@/utils/logger';
import { ArrowLeft, Save, Trash2, Play } from 'lucide-react-native';
import { responsiveFontSize, responsivePadding, responsiveSpacing, scale, verticalScale } from '@/utils/scaling';
import { formatMoney } from '@/utils/moneyFormatting';
import ConfirmDialog from '@/components/ConfirmDialog';
import { createBackupBeforeMajorAction } from '@/utils/saveBackup';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

export default function SaveSlots() {
  const log = logger.scope('SaveSlots');
  const { state, setState } = useOnboarding();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { loadGame } = useGame();
  const [slots, setSlots] = useState<any[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<number | null>(state.slot || null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<number | null>(null);

  // Animations
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;

  // Rotating background animation
  useEffect(() => {
    let isMounted = true;
    let rotateAnimation: Animated.CompositeAnimation | null = null;
    
    try {
      rotateAnimation = Animated.loop(
        Animated.timing(rotateAnim, {
          toValue: 1,
          duration: 30000,
          easing: Easing.linear,
          useNativeDriver: Platform.OS !== 'web',
        })
      );
      
      if (isMounted && rotateAnimation) {
        rotateAnimation.start();
      }
    } catch (error) {
      log.error('Error starting rotate animation', error);
    }

    return () => {
      isMounted = false;
      if (rotateAnimation) {
        try {
          rotateAnimation.stop();
        } catch (error) {
          log.error('Error stopping rotate animation', error);
        }
      }
    };
  }, [rotateAnim]);

  // Fade in and slide up animation
  useEffect(() => {
    let isMounted = true;
    let parallelAnimation: Animated.CompositeAnimation | null = null;
    
    try {
      parallelAnimation = Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 1000,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 1000,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: Platform.OS !== 'web',
        }),
      ]);
      
      if (isMounted && parallelAnimation) {
        parallelAnimation.start();
      }
    } catch (error) {
      log.error('Error starting fade/slide animation', error);
    }

    return () => {
      isMounted = false;
      if (parallelAnimation) {
        try {
          parallelAnimation.stop();
        } catch (error) {
          log.error('Error stopping fade/slide animation', error);
        }
      }
    };
  }, [fadeAnim, slideAnim]);

  const loadSlots = useCallback(async () => {
    const slotData = [];
    for (let i = 1; i <= 3; i++) {
      try {
        let data: string | null = null;
        
        try {
          data = await AsyncStorage.getItem(`save_slot_${i}`);
        } catch (storageError) {
          log.error(`AsyncStorage error loading slot ${i}:`, storageError);
          slotData.push({ id: i, hasData: false, error: true });
          continue;
        }
        
        if (data) {
          try {
            const parsed = JSON.parse(data);
            if (parsed && typeof parsed === 'object') {
              slotData.push({
                ...parsed,
                id: i,
                hasData: true,
              });
            }
          } catch (parseError) {
            log.error(`Failed to parse save slot ${i}:`, parseError);
            slotData.push({
              id: i,
              hasData: false,
            });
          }
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
  }, [log]);

  useEffect(() => {
    loadSlots();
  }, [loadSlots]);

  useFocusEffect(
    useCallback(() => {
      loadSlots();
    }, [loadSlots])
  );

  const checkIfAllSlotsFull = async (): Promise<boolean> => {
    try {
      let fullSlots = 0;
      for (let i = 1; i <= 3; i++) {
        const data = await AsyncStorage.getItem(`save_slot_${i}`);
        if (data) {
          try {
            const parsed = JSON.parse(data);
            // Check if slot has actual game data (not just empty object)
            if (parsed && typeof parsed === 'object') {
              // Consider slot full if it has meaningful game data
              const hasGameData = parsed.weeksLived > 0 ||
                                 parsed.stats?.money > 0 ||
                                 (parsed.achievements && parsed.achievements.some((a: any) => a?.completed)) ||
                                 (parsed.relationships && parsed.relationships.length > 0) ||
                                 (parsed.items && parsed.items.some((item: any) => item?.owned));
              if (hasGameData) {
                fullSlots++;
              }
            }
          } catch {
            // If parsing fails, consider slot as potentially full/corrupted
            fullSlots++;
          }
        }
      }
      return fullSlots >= 3;
    } catch (error) {
      log.error('Error checking save slots:', error);
      return false; // Allow new game if check fails
    }
  };

  const selectSlot = async (slotId: number) => {
    setSelectedSlot(slotId);
    setState(prev => ({ ...prev, slot: slotId }));
    
    // Check if slot is empty (no save data)
    const slot = slots.find(s => s.id === slotId);
    if (!slot || !slot.hasData) {
      // Check if all slots are full before allowing new game
      const allSlotsFull = await checkIfAllSlotsFull();
      if (allSlotsFull) {
        Alert.alert(
          'All Save Slots Full',
          'You cannot create a new game because all 3 save slots are full. Please delete a save slot first to make room for a new game.',
          [{ text: 'OK' }]
        );
        // Reset selection if all slots are full
        setSelectedSlot(null);
        setState(prev => ({ ...prev, slot: 0 }));
        return;
      }
      // Navigate to Scenarios for new game
      router.push('/(onboarding)/Scenarios');
    } else {
      // Load the existing save and navigate to game
      await loadGame(slotId);
      router.push('/(tabs)');
    }
  };

  const deleteSlot = async (slotId: number) => {
    try {
      // Get the save data to back it up before deletion
      const saveData = await AsyncStorage.getItem(`save_slot_${slotId}`);
      if (saveData) {
        try {
          const gameState = JSON.parse(saveData);
          // Create backup before deleting
          await createBackupBeforeMajorAction(slotId, gameState, 'delete_save');
        } catch (error) {
          log.error('Failed to backup save before deletion:', error);
        }
      }
      
      await AsyncStorage.removeItem(`save_slot_${slotId}`);
      await loadSlots();
      if (selectedSlot === slotId) {
        setSelectedSlot(null);
        setState(prev => ({ ...prev, slot: 0 }));
      }
      setShowDeleteConfirm(null);
    } catch (error) {
      log.error('Error deleting slot:', error);
    }
  };

  const continueToGame = () => {
    if (selectedSlot) {
      router.push('/(tabs)');
    }
  };

  const startNewGame = async () => {
    const allSlotsFull = await checkIfAllSlotsFull();
    if (allSlotsFull) {
      Alert.alert(
        'All Save Slots Full',
        'You cannot create a new game because all 3 save slots are full. Please delete a save slot first to make room for a new game.',
        [{ text: 'OK' }]
      );
      return;
    }
    router.push('/(onboarding)/Scenarios');
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
            transform: [{ translateY: slideAnim }],
            paddingTop: 50 + insets.top,
          }
        ]}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.push('/(onboarding)/MainMenu')} style={styles.backButton}>
            <View style={styles.glassButton}>
              <View style={styles.glassOverlay} />
              <View style={styles.glassIconContainer}>
                <ArrowLeft size={24} color="#FFFFFF" />
              </View>
            </View>
          </TouchableOpacity>
          <Text style={styles.title}>Save Slots</Text>
          <View style={styles.placeholder} />
        </View>

        <ScrollView 
          style={styles.scrollContainer} 
          contentContainerStyle={{ paddingTop: insets.top }}
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.scrollContent, { paddingBottom: 160 + insets.bottom }]}>
            {/* Hero section */}
            <View style={styles.heroSection}>
              <View style={styles.glassCard}>
                <View style={styles.glassOverlay} />
                <Text style={styles.heroTitle}>Choose Your Save Slot</Text>
                <Text style={styles.heroSubtitle}>Select a slot to continue your journey or start fresh</Text>
              </View>
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
                    <View style={[styles.glassSlotCard, isSelected && styles.glassSlotCardSelected]}>
                      <View style={styles.glassOverlay} />
                        <View style={styles.slotHeader}>
                          <View style={styles.glassIconContainer}>
                            <View style={styles.glassOverlay} />
                            <Save size={32} color="#FFFFFF" />
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
                            <View style={styles.glassSelectedIndicator}>
                              <View style={styles.glassOverlay} />
                              <Text style={styles.selectedText}>✓</Text>
                            </View>
                          )}
                        </View>

                        {isOccupied && (
                          <View style={styles.slotStats}>
                            <View style={styles.glassStatItem}>
                              <View style={styles.glassOverlay} />
                              <Text style={styles.statLabel}>Money</Text>
                              <Text style={styles.statValue}>{formatMoney(slot.stats?.money || 0)}</Text>
                            </View>
                            <View style={styles.glassStatItem}>
                              <View style={styles.glassOverlay} />
                              <Text style={styles.statLabel}>Age</Text>
                              <Text style={styles.statValue}>{Math.ceil(slot.date?.age || 0)}</Text>
                            </View>
                            <View style={styles.glassStatItem}>
                              <View style={styles.glassOverlay} />
                              <Text style={styles.statLabel}>Month</Text>
                              <Text style={styles.statValue}>{slot.date?.month || 'Unknown'}</Text>
                            </View>
                          </View>
                        )}

                        <View style={styles.slotActions}>
                          {isOccupied && (
                            <TouchableOpacity
                              style={styles.glassDeleteButton}
                              onPress={() => setShowDeleteConfirm(slot.id)}
                              accessibilityLabel="Delete save slot"
                              accessibilityRole="button"
                            >
                              <View style={styles.glassOverlay} />
                              <Trash2 size={16} color="#EF4444" />
                              <Text style={styles.deleteButtonText}>Delete</Text>
                            </TouchableOpacity>
                          )}
                        </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Bottom spacing for floating button */}
            <View style={[styles.bottomSpacing, { height: 140 + insets.bottom }]} />
          </View>
        </ScrollView>

        {/* Floating Action Button */}
        {selectedSlot && (
          <View style={[styles.floatingButtonContainer, { bottom: 20 + insets.bottom }]}>
            {slots.find(s => s.id === selectedSlot)?.hasData ? (
              <TouchableOpacity style={styles.floatingButton} onPress={continueToGame} activeOpacity={0.8}>
                <LinearGradient
                  colors={['#10B981', '#059669', '#047857']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.floatingGlassButton}
                >
                  <View style={styles.buttonContent}>
                    <Text style={styles.glassButtonTitle}>Continue Game</Text>
                    <View style={styles.glassIconContainer}>
                      <Play size={24} color="#FFFFFF" />
                    </View>
                  </View>
                </LinearGradient>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={styles.floatingButton} onPress={startNewGame} activeOpacity={0.8}>
                <LinearGradient
                  colors={['#10B981', '#059669', '#047857']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.floatingGlassButton}
                >
                  <View style={styles.buttonContent}>
                    <Text style={styles.glassButtonTitle}>Start New Game</Text>
                    <View style={styles.glassIconContainer}>
                      <Play size={24} color="#FFFFFF" />
                    </View>
                  </View>
                </LinearGradient>
              </TouchableOpacity>
            )}
          </View>
        )}

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

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        visible={showDeleteConfirm !== null}
        title="Delete Save?"
        message="Are you sure you want to delete this save? This action cannot be undone, but a backup will be created."
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={() => {
          if (showDeleteConfirm !== null) {
            deleteSlot(showDeleteConfirm);
          }
        }}
        onCancel={() => setShowDeleteConfirm(null)}
        type="error"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
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
    ...Platform.select({
      web: { textShadow: '1px 1px 3px rgba(0, 0, 0, 0.5)' },
      ios: {
        textShadowColor: 'rgba(0, 0, 0, 0.5)',
        textShadowOffset: { width: 1, height: 1 },
        textShadowRadius: 3,
      },
      android: {
        textShadowColor: 'rgba(0, 0, 0, 0.5)',
        textShadowOffset: { width: 1, height: 1 },
        textShadowRadius: 3,
      },
    }),
  },
  backButton: {
    borderRadius: 12,
    overflow: 'hidden',
    boxShadow: '0px 4px 8px rgba(0, 0, 0, 0.3)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  glassButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    position: 'relative',
    overflow: 'hidden',
    minHeight: 60,
    justifyContent: 'center',
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
    ...Platform.select({
      web: { textShadow: '1px 1px 2px rgba(0, 0, 0, 0.5)' },
      ios: {
        textShadowColor: 'rgba(0, 0, 0, 0.5)',
        textShadowOffset: { width: 1, height: 1 },
        textShadowRadius: 2,
      },
      android: {
        textShadowColor: 'rgba(0, 0, 0, 0.5)',
        textShadowOffset: { width: 1, height: 1 },
        textShadowRadius: 2,
      },
    }),
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
  glassSlotCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    padding: 20,
    position: 'relative',
    overflow: 'hidden',
  },
  glassSlotCardSelected: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderColor: 'rgba(16, 185, 129, 0.25)',
  },
  slotHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
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
  glassSelectedIndicator: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
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
    flexShrink: 1,
    textAlign: 'center',
  },
  slotActions: {
    alignItems: 'flex-end',
  },
  glassDeleteButton: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.25)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    position: 'relative',
    overflow: 'hidden',
  },
  deleteButtonText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#EF4444',
    marginLeft: 4,
  },
  bottomSpacing: {
    height: 120, // Space for floating button
  },
  floatingButtonContainer: {
    position: 'absolute',
    left: responsivePadding.horizontal,
    right: responsivePadding.horizontal,
    zIndex: 10,
  },
  floatingButton: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.6,
    shadowRadius: 20,
    elevation: 16,
  },
  floatingGlassButton: {
    width: '100%',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    position: 'relative',
    overflow: 'hidden',
    minHeight: 64,
    justifyContent: 'center',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 8,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    width: '100%',
  },
  glassButtonTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
    flex: 1,
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
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

