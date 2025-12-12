import React, { useEffect, useRef, useState, useMemo } from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, Animated, Dimensions, ScrollView, Image, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useGame } from '@/contexts/GameContext';
import { iapService } from '@/services/IAPService';
import { IAP_PRODUCTS } from '@/utils/iapConfig';
import { Skull, Heart, RotateCcw, Brain, Activity, Smile, Check } from 'lucide-react-native';
import PrestigeModal from './PrestigeModal';
import { getCharacterImage } from '@/utils/characterImages';
import { HeirGenerator } from '@/lib/legacy/heirGeneration';
import { computeInheritance } from '@/lib/legacy/inheritance';
import { MINDSET_TRAITS, MindsetId } from '@/lib/mindset/config';
import { logger } from '@/utils/logger';

const { width, height } = Dimensions.get('window');

export default function DeathPopup() {
  const { gameState, setGameState, startNewLifeFromLegacy, reviveCharacter, currentSlot, saveGame } = useGame();
  const router = useRouter();
  const { settings, deathReason, date } = gameState;
  const week = gameState.week;
  const showDeathPopup = gameState.showDeathPopup;
  
  // All hooks must be called before any conditional returns
  const [showHeirSelection, setShowHeirSelection] = useState(false);
  const [selectedHeirId, setSelectedHeirId] = useState<string | null>(null);
  const [selectedMindset, setSelectedMindset] = useState<MindsetId | null>(
    (gameState.mindset?.activeTraitId as MindsetId | null) || null
  );
  const [showPrestigeModal, setShowPrestigeModal] = useState(false);
  const [iapLoading, setIapLoading] = useState(false);

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const glowAnim = useRef(new Animated.Value(0)).current;
  const sparkleAnim = useRef(new Animated.Value(0)).current;

  // Calculate inheritance and heir data (must be before early return)
  const inheritanceSummary = useMemo(() => {
    return computeInheritance(gameState);
  }, [gameState]);

  const heirs = useMemo(() => {
    if (!gameState.family?.children) return [];
    
    return gameState.family.children.map((child: any) => {
      // Preview the heir generation
      const result = HeirGenerator.generateHeir(
        child,
        gameState.activeTraits || [], // Player traits
        (gameState.generationNumber || 1) + 1,
        gameState.lineageId ?? 'default_lineage',
        gameState.mindset?.activeTraitId ?? 'unknown_parent',
        gameState.family?.spouse?.id,
        []
      );
      return {
        id: child.id,
        name: (result as any).name || child.name || 'Unknown',
        age: (result as any).age || child.age || 18,
        traits: (result as any).traits || [],
        stats: (result as any).stats || {},
        preview: result,
        child: child,
      };
    });
  }, [gameState.family?.children, gameState.activeTraits, gameState.generationNumber, gameState.lineageId, gameState.mindset?.activeTraitId, inheritanceSummary]);

  useEffect(() => {
    // Entrance animations
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 100,
        friction: 8,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start();

    // Glow animation loop
    const glowLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(glowAnim, {
          toValue: 0,
          duration: 2000,
          useNativeDriver: true,
        }),
      ])
    );
    glowLoop.start();

    // Sparkle animation loop
    const sparkleLoop = Animated.loop(
      Animated.timing(sparkleAnim, {
        toValue: 1,
        duration: 3000,
        useNativeDriver: true,
      })
    );
    sparkleLoop.start();

    // CRITICAL: Stop all animations on unmount to prevent memory leak
    return () => {
      glowLoop.stop();
      sparkleLoop.stop();
      fadeAnim.stopAnimation();
      scaleAnim.stopAnimation();
      slideAnim.stopAnimation();
    };
  }, [fadeAnim, glowAnim, scaleAnim, slideAnim, sparkleAnim]);

  const handleNewLife = async () => {
    const hasChildren = (gameState.family?.children || []).length > 0;
    if (hasChildren) {
      setShowHeirSelection(true);
    } else {
      // No children - delete save and navigate to scenarios
      await handleStartNewGame();
    }
  };

  const confirmHeirSelection = async () => {
    if (!selectedHeirId) {
      Alert.alert('No Heir Selected', 'Please select an heir to continue your legacy.');
      return;
    }

    try {
      // Start new life from legacy with selected heir
      startNewLifeFromLegacy(selectedHeirId);
      
      // Apply selected mindset if one was chosen
      if (selectedMindset) {
        setGameState(prev => ({
          ...prev,
          mindset: {
            activeTraitId: selectedMindset,
            traits: [selectedMindset],
          },
        }));
      }
      
      // Close death popup and heir selection modal
      setGameState(prev => ({
        ...prev,
        showDeathPopup: false,
        deathReason: undefined,
      }));
      setShowHeirSelection(false);
      setSelectedHeirId(null);
      
      // Save the new game state
      await saveGame();
      
      // Navigate to main game screen (or stay in current screen)
      // The game state has been updated, so the game should continue normally
    } catch (error) {
      logger.error('Failed to start new life from legacy:', error);
      Alert.alert('Error', 'Failed to continue legacy. Please try again.');
      // Re-show the death popup if there was an error
      setGameState(prev => ({
        ...prev,
        showDeathPopup: true,
      }));
    }
  };

  const handleRevive = () => {
    const reviveCost = 15000;
    if (gameState.stats.gems >= reviveCost) {
      reviveCharacter();
    }
  };

  const getReviveCost = () => {
    return 15000; // Base cost for revival
  };

  const handleIAPRevive = async () => {
    if (iapLoading) return;
    
    setIapLoading(true);
    
    try {
      const result = await iapService.purchaseProduct(IAP_PRODUCTS.REVIVE_SINGLE);
      
      if (result.success) {
        // Purchase successful - directly apply revival to game state
        // This is more reliable than depending on IAPService async storage updates
        setGameState(prev => ({
          ...prev,
          showDeathPopup: false,
          deathReason: undefined,
          stats: {
            ...prev.stats,
            health: 100,      // Full health
            happiness: 100,   // Full happiness
            energy: 100,      // Full energy
          },
          happinessZeroWeeks: 0,
          healthZeroWeeks: 0,
        }));
        
        // Save the revived state
        setTimeout(async () => {
          try {
            await saveGame();
            logger.info('Revived state saved after IAP purchase');
          } catch (saveError) {
            logger.error('Failed to save revived state:', saveError);
          }
        }, 100);
        
        Alert.alert(
          '🎉 Revived!', 
          'You have been revived with full health, happiness, and energy! Continue your journey.',
          [{ text: 'OK', style: 'default' }]
        );
      } else {
        // Don't show error for cancelled purchases
        if (!result.message?.toLowerCase().includes('cancel')) {
          Alert.alert('Purchase Failed', result.message || 'Unable to complete purchase. Please try again.');
        }
      }
    } catch (error) {
      logger.error('IAP purchase error:', error);
      Alert.alert('Error', 'An error occurred during purchase. Please try again.');
    } finally {
      setIapLoading(false);
    }
  };

  const handleStartNewGame = async () => {
    try {
      // Close the death popup first
      setGameState(prev => ({
        ...prev,
        showDeathPopup: false,
        deathReason: undefined,
      }));
      
      // Delete the current save slot
      if (currentSlot) {
        await AsyncStorage.removeItem(`save_slot_${currentSlot}`);
        await AsyncStorage.removeItem('lastSlot');
      }
      
      // Navigate to scenarios screen to start a new game
      router.replace('/(onboarding)/Scenarios');
    } catch (error) {
      if (__DEV__) {
        logger.error('Failed to start new game:', error);
      }
      // Re-show the death popup if there was an error
      setGameState(prev => ({
        ...prev,
        showDeathPopup: true,
      }));
    }
  };

  if (!gameState.showDeathPopup) return null;

  const age = Math.floor(date.age);
  const deathMessage =
    deathReason === 'health'
      ? 'Your body finally gave out.'
      : deathReason === 'happiness'
      ? 'You lost the will to go on.'
      : 'Your journey has ended.';

  // Interpolations
  const glowOpacity = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });

  // Note: sparkleTranslateY and sparkleOpacity are available for future sparkle effects
  // const sparkleTranslateY = sparkleAnim.interpolate({
  //   inputRange: [0, 1],
  //   outputRange: [0, -20],
  // });
  // const sparkleOpacity = sparkleAnim.interpolate({
  //   inputRange: [0, 0.5, 1],
  //   outputRange: [0, 1, 0],
  // });

  return (
    <>
    <Modal visible transparent animationType="none">
      <View style={styles.container}>
        {/* Dark Overlay Background */}
        <View style={styles.overlay} />

        <Animated.View
          style={[
            styles.content,
            {
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }, { translateY: slideAnim }],
            },
          ]}
        >
          {/* Main Death Content or Heir Selection */}
          {!showHeirSelection ? (
            <LinearGradient
              colors={settings.darkMode ? ['#1F2937', '#111827'] : ['#FFFFFF', '#F3F4F6']}
              style={styles.card}
            >
              <ScrollView 
                style={styles.cardScrollView}
                contentContainerStyle={styles.cardScrollContent}
                showsVerticalScrollIndicator={true}
                bounces={true}
                nestedScrollEnabled={true}
              >
                {/* Skull Icon with Glow */}
                <View style={styles.iconContainer}>
                  <Animated.View
                    style={[
                      styles.glowRing,
                      {
                        opacity: glowOpacity,
                        transform: [{ scale: pulseAnim }],
                      },
                    ]}
                  />
                  <Skull size={48} color={settings.darkMode ? '#9CA3AF' : '#4B5563'} />
                </View>

                <Text style={[styles.title, settings.darkMode && styles.textDark]}>R.I.P.</Text>
                <Text style={[styles.subtitle, settings.darkMode && styles.textDarkSecondary]}>
                  {gameState.userProfile.name || 'Unknown Soul'}
                </Text>
                <Text style={[styles.details, settings.darkMode && styles.textDarkSecondary]}>
                  Age {age} • {deathMessage}
                </Text>

                {/* Stats Summary */}
                <View style={styles.statsRow}>
                  <View style={styles.statItem}>
                    <Text style={[styles.statValue, settings.darkMode && styles.textDark]}>
                      ${(inheritanceSummary.totalNetWorth).toLocaleString()}
                    </Text>
                    <Text style={[styles.statLabel, settings.darkMode && styles.textDarkSecondary]}>Net Worth</Text>
                  </View>
                  <View style={styles.statItem}>
                    <Text style={[styles.statValue, settings.darkMode && styles.textDark]}>
                      {gameState.generationNumber || 1}
                    </Text>
                    <Text style={[styles.statLabel, settings.darkMode && styles.textDarkSecondary]}>Generation</Text>
                  </View>
                </View>

                {/* Enhanced Legacy Summary */}
                <View style={[styles.legacyDetails, settings.darkMode && styles.legacyDetailsDark]}>
                  <Text style={[styles.legacyDetailsTitle, settings.darkMode && styles.textDark]}>
                    Inheritance Breakdown
                  </Text>
                  
                  <View style={styles.legacyBreakdown}>
                    <View style={styles.legacyItem}>
                      <Text style={[styles.legacyItemLabel, settings.darkMode && styles.textDarkSecondary]}>Cash:</Text>
                      <Text style={[styles.legacyItemValue, settings.darkMode && styles.textDark]}>
                        ${inheritanceSummary.cash.toLocaleString()}
                      </Text>
                    </View>
                    
                    <View style={styles.legacyItem}>
                      <Text style={[styles.legacyItemLabel, settings.darkMode && styles.textDarkSecondary]}>Savings:</Text>
                      <Text style={[styles.legacyItemValue, settings.darkMode && styles.textDark]}>
                        ${inheritanceSummary.bankSavings.toLocaleString()}
                      </Text>
                    </View>
                    
                    {inheritanceSummary.realEstateIds.length > 0 && (
                      <View style={styles.legacyItem}>
                        <Text style={[styles.legacyItemLabel, settings.darkMode && styles.textDarkSecondary]}>
                          Properties:
                        </Text>
                        <Text style={[styles.legacyItemValue, settings.darkMode && styles.textDark]}>
                          {inheritanceSummary.realEstateIds.length} property{inheritanceSummary.realEstateIds.length !== 1 ? 'ies' : ''}
                        </Text>
                      </View>
                    )}
                    
                    {inheritanceSummary.companyIds.length > 0 && (
                      <View style={styles.legacyItem}>
                        <Text style={[styles.legacyItemLabel, settings.darkMode && styles.textDarkSecondary]}>
                          Companies:
                        </Text>
                        <Text style={[styles.legacyItemValue, settings.darkMode && styles.textDark]}>
                          {inheritanceSummary.companyIds.length} compan{inheritanceSummary.companyIds.length !== 1 ? 'ies' : 'y'}
                        </Text>
                      </View>
                    )}
                    
                    {inheritanceSummary.debts > 0 && (
                      <View style={styles.legacyItem}>
                        <Text style={[styles.legacyItemLabel, { color: '#EF4444' }]}>Debts:</Text>
                        <Text style={[styles.legacyItemValue, { color: '#EF4444' }]}>
                          -${inheritanceSummary.debts.toLocaleString()}
                        </Text>
                      </View>
                    )}
                  </View>

                  {/* Legacy Bonuses */}
                  <View style={[styles.legacyBonuses, settings.darkMode && styles.legacyBonusesDark]}>
                    <Text style={[styles.legacyDetailsTitle, settings.darkMode && styles.textDark]}>
                      Legacy Bonuses for Next Generation
                    </Text>
                    <View style={styles.legacyBreakdown}>
                      <View style={styles.legacyItem}>
                        <Text style={[styles.legacyItemLabel, settings.darkMode && styles.textDarkSecondary]}>
                          Income Multiplier:
                        </Text>
                        <Text style={[styles.legacyItemValue, { color: '#10B981' }]}>
                          +{((inheritanceSummary.legacyBonuses.incomeMultiplier - 1) * 100).toFixed(1)}%
                        </Text>
                      </View>
                      <View style={styles.legacyItem}>
                        <Text style={[styles.legacyItemLabel, settings.darkMode && styles.textDarkSecondary]}>
                          Learning Multiplier:
                        </Text>
                        <Text style={[styles.legacyItemValue, { color: '#10B981' }]}>
                          +{((inheritanceSummary.legacyBonuses.learningMultiplier - 1) * 100).toFixed(1)}%
                        </Text>
                      </View>
                      <View style={styles.legacyItem}>
                        <Text style={[styles.legacyItemLabel, settings.darkMode && styles.textDarkSecondary]}>
                          Reputation Bonus:
                        </Text>
                        <Text style={[styles.legacyItemValue, { color: '#10B981' }]}>
                          +{inheritanceSummary.legacyBonuses.reputationBonus}
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>
              </ScrollView>

              {/* Actions - Fixed at bottom */}
              <View style={styles.actions}>
                <TouchableOpacity
                  style={[styles.button, styles.reviveButton]}
                  onPress={handleRevive}
                  disabled={gameState.stats.gems < getReviveCost()}
                >
                  <LinearGradient
                    colors={gameState.stats.gems >= getReviveCost() ? ['#10B981', '#059669'] : ['#9CA3AF', '#6B7280']}
                    style={styles.gradientButton}
                  >
                    <Heart size={20} color="#FFF" style={{ marginRight: 8 }} />
                    <Text style={styles.buttonText}>
                      Revive ({getReviveCost().toLocaleString()} Gems)
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.button, styles.iapReviveButton]}
                  onPress={handleIAPRevive}
                  disabled={iapLoading}
                >
                  <LinearGradient
                    colors={iapLoading ? ['#9CA3AF', '#6B7280'] : ['#EF4444', '#DC2626']}
                    style={styles.gradientButton}
                  >
                    <Heart size={20} color="#FFF" style={{ marginRight: 8 }} />
                    <Text style={styles.buttonText}>
                      {iapLoading ? 'Processing...' : 'Revive ($1.99)'}
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>

                <TouchableOpacity style={[styles.button, styles.newLifeButton]} onPress={handleNewLife}>
                  <LinearGradient colors={['#3B82F6', '#2563EB']} style={styles.gradientButton}>
                    <RotateCcw size={20} color="#FFF" style={{ marginRight: 8 }} />
                    <Text style={styles.buttonText}>Start Next Generation</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </LinearGradient>
          ) : (
            // HEIR SELECTION VIEW
            <LinearGradient
              colors={settings.darkMode ? ['#1F2937', '#111827'] : ['#FFFFFF', '#F3F4F6']}
              style={styles.heirCard}
            >
              <View style={styles.heirHeader}>
                <Text style={[styles.heirTitle, settings.darkMode && styles.textDark]}>
                  Choose Your Heir
                </Text>
                <Text style={[styles.heirSubtitle, settings.darkMode && styles.textDarkSecondary]}>
                  Who will continue your legacy?
                </Text>
              </View>

              <ScrollView style={styles.heirList} showsVerticalScrollIndicator={false}>
                {heirs.map(({ child, stats, traits }) => {
                  const isSelected = selectedHeirId === child.id;
                  return (
                    <TouchableOpacity
                      key={child.id}
                      style={[
                        styles.heirItem,
                        settings.darkMode && styles.heirItemDark,
                        isSelected && styles.heirItemSelected
                      ]}
                      onPress={() => setSelectedHeirId(child.id)}
                    >
                      <View style={styles.heirInfo}>
                        <Image
                          source={getCharacterImage(child.age, child.gender)}
                          style={styles.heirImage}
                        />
                        <View style={styles.heirText}>
                          <Text style={[styles.heirName, settings.darkMode && styles.textDark]}>
                            {child.name}
                          </Text>
                          <Text style={[styles.heirDetails, settings.darkMode && styles.textDarkSecondary]}>
                            Age {child.age} • {child.gender === 'male' ? 'Son' : 'Daughter'}
                          </Text>
                        </View>
                      </View>

                      {/* Heir Stats Preview */}
                      <View style={styles.heirStats}>
                        <View style={styles.heirStat}>
                           <Activity size={14} color="#EF4444" />
                           <Text style={[styles.heirStatText, settings.darkMode && styles.textDark]}>
                             {stats.health}
                           </Text>
                        </View>
                        <View style={styles.heirStat}>
                           <Smile size={14} color="#F59E0B" />
                           <Text style={[styles.heirStatText, settings.darkMode && styles.textDark]}>
                             {stats.happiness}
                           </Text>
                        </View>
                        <View style={styles.heirStat}>
                           <Brain size={14} color="#8B5CF6" />
                           <Text style={[styles.heirStatText, settings.darkMode && styles.textDark]}>
                             {(stats.reputation || 0) + (stats.fitness || 0) / 2}
                           </Text>
                        </View>
                      </View>

                      {/* Traits Preview */}
                      {traits && traits.length > 0 && (
                        <View style={styles.heirTraits}>
                          {traits.map((t: any) => (
                            <View key={t?.id} style={styles.traitBadge}>
                              <Text style={styles.traitText}>{t?.name}</Text>
                            </View>
                          ))}
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {/* Mindset Selection */}
              <View style={styles.mindsetSelectionSection}>
                <View style={styles.mindsetSectionHeader}>
                  <Brain size={18} color={settings.darkMode ? '#8B5CF6' : '#6366F1'} />
                  <Text style={[styles.mindsetSectionTitle, settings.darkMode && styles.textDark]}>
                    Choose Mindset (Optional)
                  </Text>
                </View>
                <Text style={[styles.mindsetSectionSubtitle, settings.darkMode && styles.textDarkSecondary]}>
                  Select a mindset trait for your heir
                </Text>
                <ScrollView 
                  horizontal 
                  showsHorizontalScrollIndicator={false}
                  style={styles.mindsetScroll}
                  contentContainerStyle={styles.mindsetScrollContent}
                >
                  {MINDSET_TRAITS.map(trait => {
                    const isSelected = selectedMindset === trait.id;
                    return (
                      <TouchableOpacity
                        key={trait.id}
                        style={[
                          styles.mindsetOption,
                          settings.darkMode && styles.mindsetOptionDark,
                          isSelected && styles.mindsetOptionSelected
                        ]}
                        onPress={() => setSelectedMindset(isSelected ? null : trait.id)}
                      >
                        <Image source={trait.icon} style={styles.mindsetOptionImage} resizeMode="contain" />
                        <Text style={[
                          styles.mindsetOptionName,
                          settings.darkMode && styles.textDark,
                          isSelected && styles.mindsetOptionNameSelected
                        ]}>
                          {trait.name}
                        </Text>
                        <Text style={[
                          styles.mindsetOptionDesc,
                          settings.darkMode && styles.textDarkSecondary
                        ]} numberOfLines={2}>
                          {trait.description}
                        </Text>
                        {isSelected && (
                          <View style={styles.mindsetCheck}>
                            <Check size={16} color="#8B5CF6" />
                          </View>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>

              <View style={styles.heirActions}>
                <TouchableOpacity 
                  style={[styles.cancelButton]} 
                  onPress={() => setShowHeirSelection(false)}
                >
                  <Text style={[styles.cancelText, settings.darkMode && styles.textDarkSecondary]}>
                    Back
                  </Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[styles.confirmButton, !selectedHeirId && styles.disabledButton]}
                  onPress={confirmHeirSelection}
                  disabled={!selectedHeirId}
                >
                  <LinearGradient
                    colors={selectedHeirId ? ['#3B82F6', '#2563EB'] : ['#9CA3AF', '#6B7280']}
                    style={styles.gradientButton}
                  >
                    <Text style={styles.buttonText}>Continue Legacy</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </LinearGradient>
          )}
        </Animated.View>
      </View>
    </Modal>
    <PrestigeModal
      visible={showPrestigeModal}
      onClose={() => setShowPrestigeModal(false)}
    />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  overlay: {
    position: 'absolute',
    width: width,
    height: height,
    backgroundColor: 'rgba(0,0,0,0.8)',
  },
  content: {
    width: width * 0.9,
    maxWidth: 400,
    alignItems: 'center',
  },
  card: {
    width: '100%',
    maxHeight: height * 0.75,
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  cardScrollView: {
    flexGrow: 1,
    flexShrink: 1,
  },
  cardScrollContent: {
    alignItems: 'center',
    paddingBottom: 16,
  },
  heirCard: {
    width: '100%',
    height: height * 0.7,
    borderRadius: 24,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  iconContainer: {
    marginBottom: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glowRing: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#4B5563',
    marginBottom: 4,
  },
  details: {
    fontSize: 16,
    color: '#6B7280',
    marginBottom: 24,
    textAlign: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginBottom: 32,
    paddingHorizontal: 10,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: 4,
  },
  legacyDetails: {
    width: '100%',
    marginTop: 20,
    marginBottom: 20,
    padding: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.03)',
    borderRadius: 12,
  },
  legacyDetailsDark: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  legacyDetailsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 12,
  },
  legacyBreakdown: {
    gap: 8,
  },
  legacyItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  legacyItemLabel: {
    fontSize: 14,
    color: '#6B7280',
    flex: 1,
  },
  legacyItemValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  legacyBonuses: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.1)',
  },
  legacyBonusesDark: {
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  actions: {
    width: '100%',
    gap: 12,
  },
  button: {
    width: '100%',
    borderRadius: 12,
    overflow: 'hidden',
  },
  gradientButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  reviveButton: {
    marginBottom: 8,
  },
  iapReviveButton: {
    marginBottom: 8,
  },
  newLifeButton: {},
  textDark: {
    color: '#FFFFFF',
  },
  textDarkSecondary: {
    color: '#9CA3AF',
  },
  
  // Heir Styles
  heirHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  heirTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
  },
  heirSubtitle: {
    fontSize: 16,
    color: '#6B7280',
  },
  heirList: {
    flex: 1,
    width: '100%',
  },
  heirItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 12,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: 'transparent',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  heirItemDark: {
    backgroundColor: '#374151',
  },
  heirItemSelected: {
    borderColor: '#3B82F6',
    backgroundColor: '#EFF6FF',
  },
  heirInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  heirImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
  },
  heirText: {
    flex: 1,
  },
  heirName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
  },
  heirDetails: {
    fontSize: 14,
    color: '#6B7280',
  },
  heirStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
    marginBottom: 8,
  },
  heirStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  heirStatText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  heirTraits: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  traitBadge: {
    backgroundColor: '#DBEAFE',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  traitText: {
    fontSize: 10,
    color: '#1E40AF',
    fontWeight: '600',
  },
  heirActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
  },
  cancelButton: {
    padding: 12,
  },
  cancelText: {
    fontSize: 16,
    color: '#6B7280',
    fontWeight: '600',
  },
  confirmButton: {
    flex: 1,
    marginLeft: 20,
    borderRadius: 12,
    overflow: 'hidden',
  },
  disabledButton: {
    opacity: 0.5,
  },
  
  // Mindset Selection Styles
  mindsetSelectionSection: {
    marginTop: 20,
    marginBottom: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.1)',
  },
  mindsetSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  mindsetSectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#111827',
  },
  mindsetSectionSubtitle: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 12,
  },
  mindsetScroll: {
    maxHeight: 120,
  },
  mindsetScrollContent: {
    gap: 8,
    paddingRight: 8,
  },
  mindsetOption: {
    minWidth: 140,
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    borderWidth: 2,
    borderColor: 'transparent',
    position: 'relative',
    alignItems: 'center',
  },
  mindsetOptionImage: {
    width: 48,
    height: 48,
    marginBottom: 8,
  },
  mindsetOptionDark: {
    backgroundColor: '#374151',
  },
  mindsetOptionSelected: {
    borderColor: '#8B5CF6',
    backgroundColor: '#EDE9FE',
  },
  mindsetOptionName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  mindsetOptionNameSelected: {
    color: '#6366F1',
  },
  mindsetOptionDesc: {
    fontSize: 11,
    color: '#6B7280',
    lineHeight: 14,
  },
  mindsetCheck: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#8B5CF6',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
