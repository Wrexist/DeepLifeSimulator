import React, { useEffect, useRef, useMemo } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, Image, Animated, Dimensions, ScrollView } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useRouter } from 'expo-router';
import { useGame } from '@/contexts/GameContext';
import { Skull, Heart, Smile, DollarSign, Crown, Trophy, ArrowLeft, Zap, Sparkles, Star, Gem, TrendingUp, Home, Briefcase, Users } from 'lucide-react-native';
import { responsivePadding, responsiveFontSize, responsiveSpacing, responsiveBorderRadius, scale } from '@/utils/scaling';
import { perks } from '@/src/features/onboarding/perksData';
import { computeNetWorth, Asset, Liability } from '@/utils/netWorth';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

export default function DeathPopup() {
  const { gameState, setGameState, restartGame, reviveCharacter, currentSlot, buyRevival, clearSaveSlot } = useGame();
  const { settings, deathReason, stats, date, week } = gameState;
  const router = useRouter();
  
  // Safe data extraction with fallbacks
  const completed = gameState.achievements?.filter(a => a.completed) || [];
  const unlockedPerks = gameState.perks ? Object.keys(gameState.perks).filter(key => 
    gameState.perks && typeof gameState.perks === 'object' && key in gameState.perks && gameState.perks[key as keyof typeof gameState.perks]
  ) : [];
  
  // Safety check - if critical data is missing, don't render
  if (!gameState || !stats || !date || !settings) {
    console.error('DeathPopup: Missing critical game state data');
    return null;
  }

  // Calculate net worth
  const netWorthBreakdown = useMemo(() => {
    const assets: Asset[] = [
      { id: 'cash', type: 'cash', baseValue: gameState.stats.money },
      { id: 'savings', type: 'cash', baseValue: gameState.bankSavings || 0 },
    ];

    // Add owned items
    gameState.items
      .filter(i => i.owned)
      .forEach(item => assets.push({ id: item.id, type: 'collectible', baseValue: item.price }));

    // Add companies and their equipment
    gameState.companies.forEach(company => {
      assets.push({
        id: company.id,
        type: 'business',
        baseValue: 0,
        trailingWeeklyProfit: company.weeklyIncome,
        valuationMultiple: 10,
      });
    });

    // Add real estate
    gameState.realEstate
      .filter(p => p.owned)
      .forEach(p => {
        assets.push({
          id: p.id,
          type: 'property',
          baseValue: p.price,
        });
      });

    const liabilities: Liability[] = [];
    return computeNetWorth(assets, liabilities);
  }, [gameState]);

  // Get perk titles from IDs
  const getPerkTitles = (perkIds: string[]) => {
    return perkIds.map(id => {
      const perk = perks.find(p => p.id === id);
      return perk ? perk.title : id.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    });
  };

  // Calculate key life statistics
  const lifeStats = useMemo(() => {
    const totalWeeks = week;
    const totalDays = Math.floor(date.age * 52); // Rough estimate
    const relationships = gameState.relationships.length;
    const companies = gameState.companies.length;
    const properties = gameState.realEstate.filter(p => p.owned).length;
    const items = gameState.items.filter(i => i.owned).length;

    return {
      totalWeeks,
      totalDays,
      relationships,
      companies,
      properties,
      items,
    };
  }, [gameState, week, date]);

  // Money formatting utility
  const formatMoney = (amount: number) => {
    const a = Math.floor(amount || 0);
    if (a >= 1_000_000_000_000_000) return `$${(a / 1_000_000_000_000_000).toFixed(2)}Q`;
    if (a >= 1_000_000_000_000) return `$${(a / 1_000_000_000_000).toFixed(2)}T`;
    if (a >= 1_000_000_000) return `$${(a / 1_000_000_000).toFixed(2)}B`;
    if (a >= 1_000_000) return `$${(a / 1_000_000).toFixed(2)}M`;
    if (a >= 1_000) return `$${(a / 1_000).toFixed(2)}K`;
    return `$${a}`;
  };

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;
  const sparkleAnim = useRef(new Animated.Value(0)).current;

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
  }, []);

  const handleNewLife = async () => {
    try {
      console.log('Starting new life...');
      
      // Close the death popup first
      setGameState(prev => ({
        ...prev,
        showDeathPopup: false,
        deathReason: undefined,
      }));
      
      // Add a small delay to ensure state update
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Clear the current save slot completely using the dedicated function
      await clearSaveSlot(currentSlot);
      
      // Restart the game with preserved achievements and gems
      await restartGame();
      
      // Navigate to main menu
      router.replace('/(onboarding)/MainMenu');
    } catch (error) {
      console.error('Failed to start new life:', error);
      // Re-show the death popup if there was an error
      setGameState(prev => ({
        ...prev,
        showDeathPopup: true,
        deathReason: deathReason || 'health',
      }));
    }
  };

  const handleRevive = () => {
    const reviveCost = 500;
    if (gameState.stats.gems >= reviveCost) {
      reviveCharacter();
    }
  };

  const getReviveCost = () => {
    return 500; // Base cost for revival
  };

  const getGemsNeeded = () => {
    const cost = getReviveCost();
    const current = gameState.stats.gems;
    return Math.max(0, cost - current);
  };

  const handleIAPRevive = () => {
    // Use the IAP system to purchase revival
    buyRevival();
  };

  const getDeathMessage = () => {
    if (deathReason === 'happiness') {
      return {
        title: 'Death by Despair',
        subtitle: 'You remained unhappy for 4 weeks',
        description: 'Your spirit could no longer bear the weight of unhappiness. In the end, the darkness consumed you, leaving behind only memories of what could have been.',
        icon: Smile,
        gradient: ['#7C2D12', '#DC2626', '#EF4444'],
        glowColor: 'rgba(239, 68, 68, 0.3)',
        color: '#EF4444'
      };
    } else {
      return {
        title: 'Death by Illness',
        subtitle: 'You remained unhealthy for 4 weeks',
        description: 'Your body could no longer fight the battle against illness. The light of life has faded, but your legacy remains in the hearts of those you touched.',
        icon: Heart,
        gradient: ['#7C2D12', '#DC2626', '#EF4444'],
        glowColor: 'rgba(239, 68, 68, 0.3)',
        color: '#EF4444'
      };
    }
  };

  const deathInfo = getDeathMessage();
  const DeathIcon = deathInfo.icon;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={() => {
      // Prevent dismissal - user must choose an action (revive or new life)
    }}>
      <View style={styles.overlay}>
        {/* Animated background blur */}
        <BlurView intensity={20} style={styles.blurBackground} />
        
        {/* Animated floating particles */}
        <View style={styles.particlesContainer}>
          {[...Array(12)].map((_, index) => (
            <Animated.View
              key={index}
              style={[
                styles.particle,
                {
                  left: `${Math.random() * 100}%`,
                  top: `${Math.random() * 100}%`,
                  transform: [
                    {
                      rotate: sparkleAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: ['0deg', '360deg'],
                      }),
                    },
                    {
                      scale: sparkleAnim.interpolate({
                        inputRange: [0, 0.5, 1],
                        outputRange: [0.8, 1.2, 0.8],
                      }),
                    },
                  ],
                },
              ]}
            />
          ))}
        </View>

        <Animated.View
          style={[
            styles.animatedContainer,
            {
              opacity: fadeAnim,
              transform: [
                { scale: scaleAnim },
                { translateY: slideAnim },
              ],
            },
          ]}
        >
          <BlurView intensity={30} style={styles.containerBlur}>
            <View style={[styles.container, settings.darkMode && styles.containerDark]}>
              {/* Header with enhanced gradient and glow */}
              <View style={styles.headerContainer}>
                <Animated.View
                  style={[
                    styles.glowEffect,
                    {
                      opacity: glowAnim,
                      shadowColor: deathInfo.color,
                    },
                  ]}
                />
                <LinearGradient
                  colors={deathInfo.gradient as [string, string, ...string[]]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.header}
                >
                  <View style={styles.iconContainer}>
                    <Animated.View
                      style={[
                        styles.iconGlow,
                        {
                          opacity: glowAnim,
                          shadowColor: '#FFFFFF',
                        },
                      ]}
                    />
                    <DeathIcon size={scale(40)} color="#FFFFFF" strokeWidth={2.5} />
                    <Sparkles size={scale(16)} color="#FFFFFF" style={styles.sparkleIcon} />
                  </View>
                  <Text style={styles.title}>{deathInfo.title}</Text>
                  <Text style={styles.subtitle}>{deathInfo.subtitle}</Text>
                </LinearGradient>
              </View>

              {/* Content */}
              <View style={styles.content}>
                <Text style={[styles.description, settings.darkMode && styles.descriptionDark]}>
                  {deathInfo.description}
                </Text>

                {/* Action Buttons - Moved to top for immediate visibility */}
                <View style={styles.buttonContainer}>
                  {/* IAP Revival Button */}
                  <TouchableOpacity style={styles.iapReviveButton} onPress={handleIAPRevive} activeOpacity={0.8}>
                    <LinearGradient
                      colors={['#FFD700', '#FFA500', '#FF8C00']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.iapReviveButtonGradient}
                    >
                      <Gem size={scale(20)} color="#FFFFFF" />
                      <View style={styles.iapButtonContent}>
                        <Text style={styles.iapReviveButtonText}>Revive with Purchase</Text>
                        <Text style={styles.iapReviveButtonSubtext}>$2.99 • Instant Revival</Text>
                      </View>
                      <Star size={scale(16)} color="#FFFFFF" />
                    </LinearGradient>
                  </TouchableOpacity>

                  {/* Gem Revival Button */}
                  <TouchableOpacity style={styles.reviveButton} onPress={handleRevive} activeOpacity={0.8}>
                    <LinearGradient
                      colors={gameState.stats.gems >= getReviveCost() ? ['#10B981', '#34D399'] : ['#6B7280', '#9CA3AF']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.reviveButtonGradient}
                    >
                      <Zap size={scale(18)} color="#FFFFFF" />
                      <View style={styles.reviveButtonContent}>
                        <Text style={styles.reviveButtonText}>
                          {gameState.stats.gems >= getReviveCost() 
                            ? `Revive (${getReviveCost()} gems)` 
                            : `Need ${getGemsNeeded()} more gems`}
                        </Text>
                        <Text style={styles.reviveButtonSubtext}>
                          Current: {gameState.stats.gems} gems
                        </Text>
                      </View>
                    </LinearGradient>
                  </TouchableOpacity>

                  {/* New Life Button */}
                  <TouchableOpacity style={styles.newLifeButton} onPress={handleNewLife} activeOpacity={0.8}>
                    <LinearGradient
                      colors={['#3B82F6', '#1D4ED8']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.newLifeButtonGradient}
                    >
                      <ArrowLeft size={scale(18)} color="#FFFFFF" />
                      <Text style={styles.newLifeButtonText}>Start New Life</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Scrollable Life Details */}
              <ScrollView style={styles.scrollableContent} showsVerticalScrollIndicator={false}>
                {/* Life Summary */}
                <View style={[styles.summaryContainer, settings.darkMode && styles.summaryContainerDark]}>
                  <View style={styles.summaryHeader}>
                    <Trophy size={scale(20)} color={deathInfo.color} />
                    <Text style={[styles.summaryTitle, settings.darkMode && styles.summaryTitleDark]}>
                      Life Summary
                    </Text>
                  </View>
                  
                  <View style={styles.statsGrid}>
                    <View style={[styles.statItem, settings.darkMode && styles.statItemDark]}>
                      <Skull size={scale(16)} color="#6B7280" />
                      <Text style={[styles.statLabel, settings.darkMode && styles.statLabelDark]}>Age</Text>
                      <Text style={[styles.statValue, settings.darkMode && styles.statValueDark]}>
                        {Math.floor(date.age)}
                      </Text>
                    </View>
                    
                    <View style={[styles.statItem, settings.darkMode && styles.statItemDark]}>
                      <TrendingUp size={scale(16)} color="#8B5CF6" />
                      <Text style={[styles.statLabel, settings.darkMode && styles.statLabelDark]}>Net Worth</Text>
                      <Text style={[styles.statValue, settings.darkMode && styles.statValueDark]}>
                        {formatMoney(netWorthBreakdown.netWorth)}
                      </Text>
                    </View>
                    
                    <View style={[styles.statItem, settings.darkMode && styles.statItemDark]}>
                      <DollarSign size={scale(16)} color="#10B981" />
                      <Text style={[styles.statLabel, settings.darkMode && styles.statLabelDark]}>Cash</Text>
                      <Text style={[styles.statValue, settings.darkMode && styles.statValueDark]}>
                        {formatMoney(stats.money)}
                      </Text>
                    </View>
                    
                    <View style={[styles.statItem, settings.darkMode && styles.statItemDark]}>
                      <Heart size={scale(16)} color="#EF4444" />
                      <Text style={[styles.statLabel, settings.darkMode && styles.statLabelDark]}>Health</Text>
                      <Text style={[styles.statValue, settings.darkMode && styles.statValueDark]}>
                        {stats.health}
                      </Text>
                    </View>
                    
                    <View style={[styles.statItem, settings.darkMode && styles.statItemDark]}>
                      <Smile size={scale(16)} color="#F59E0B" />
                      <Text style={[styles.statLabel, settings.darkMode && styles.statLabelDark]}>Happiness</Text>
                      <Text style={[styles.statValue, settings.darkMode && styles.statValueDark]}>
                        {stats.happiness}
                      </Text>
                    </View>
                    
                    <View style={[styles.statItem, settings.darkMode && styles.statItemDark]}>
                      <Users size={scale(16)} color="#3B82F6" />
                      <Text style={[styles.statLabel, settings.darkMode && styles.statLabelDark]}>Relations</Text>
                      <Text style={[styles.statValue, settings.darkMode && styles.statValueDark]}>
                        {lifeStats.relationships}
                      </Text>
                    </View>
                  </View>

                  {/* Additional Life Statistics */}
                  <View style={[styles.additionalStats, settings.darkMode && styles.additionalStatsDark]}>
                    <Text style={[styles.additionalStatsTitle, settings.darkMode && styles.additionalStatsTitleDark]}>
                      Life Achievements
                    </Text>
                    <View style={styles.additionalStatsGrid}>
                      <View style={[styles.additionalStatItem, settings.darkMode && styles.additionalStatItemDark]}>
                        <Briefcase size={scale(14)} color="#10B981" />
                        <Text style={[styles.additionalStatLabel, settings.darkMode && styles.additionalStatLabelDark]}>Companies</Text>
                        <Text style={[styles.additionalStatValue, settings.darkMode && styles.additionalStatValueDark]}>
                          {lifeStats.companies}
                        </Text>
                      </View>
                      
                      <View style={[styles.additionalStatItem, settings.darkMode && styles.additionalStatItemDark]}>
                        <Home size={scale(14)} color="#F59E0B" />
                        <Text style={[styles.additionalStatLabel, settings.darkMode && styles.additionalStatLabelDark]}>Properties</Text>
                        <Text style={[styles.additionalStatValue, settings.darkMode && styles.additionalStatValueDark]}>
                          {lifeStats.properties}
                        </Text>
                      </View>
                      
                      <View style={[styles.additionalStatItem, settings.darkMode && styles.additionalStatItemDark]}>
                        <Trophy size={scale(14)} color="#8B5CF6" />
                        <Text style={[styles.additionalStatLabel, settings.darkMode && styles.additionalStatLabelDark]}>Items</Text>
                        <Text style={[styles.additionalStatValue, settings.darkMode && styles.additionalStatValueDark]}>
                          {lifeStats.items}
                        </Text>
                      </View>
                      
                      <View style={[styles.additionalStatItem, settings.darkMode && styles.additionalStatItemDark]}>
                        <Crown size={scale(14)} color="#EF4444" />
                        <Text style={[styles.additionalStatLabel, settings.darkMode && styles.additionalStatLabelDark]}>Weeks</Text>
                        <Text style={[styles.additionalStatValue, settings.darkMode && styles.additionalStatValueDark]}>
                          {lifeStats.totalWeeks}
                        </Text>
                      </View>
                    </View>
                  </View>

                  {unlockedPerks.length > 0 && (
                    <View style={styles.achievementsSection}>
                      <View style={styles.achievementsHeader}>
                        <Crown size={scale(18)} color="#F59E0B" />
                        <Text style={[styles.achievementsTitle, settings.darkMode && styles.achievementsTitleDark]}>
                          Unlocked Perks
                        </Text>
                      </View>
                      <Text style={[styles.achievementsList, settings.darkMode && styles.achievementsListDark]}>
                        {getPerkTitles(unlockedPerks).join(', ')}
                      </Text>
                    </View>
                  )}

                  {completed.length > 0 && (
                    <View style={styles.achievementsSection}>
                      <View style={styles.achievementsHeader}>
                        <Trophy size={scale(18)} color="#8B5CF6" />
                        <Text style={[styles.achievementsTitle, settings.darkMode && styles.achievementsTitleDark]}>
                          Life Goals Completed
                        </Text>
                      </View>
                      <Text style={[styles.achievementsList, settings.darkMode && styles.achievementsListDark]}>
                        {completed.map(a => a.name).join(', ')}
                      </Text>
                    </View>
                  )}
                </View>
              </ScrollView>
            </View>
          </BlurView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: screenWidth * 0.02,
  },
  blurBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  particlesContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    pointerEvents: 'none',
  },
  particle: {
    position: 'absolute',
    width: scale(4),
    height: scale(4),
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    borderRadius: scale(2),
  },
  animatedContainer: {
    maxWidth: screenWidth * 0.92,
    width: '100%',
    maxHeight: screenHeight * 0.85,
  },
  containerBlur: {
    borderRadius: responsiveBorderRadius.xl,
    overflow: 'hidden',
  },
  container: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: responsiveBorderRadius.xl,
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: scale(20) },
    shadowOpacity: 0.4,
    shadowRadius: scale(30),
    elevation: 25,
  },
  containerDark: {
    backgroundColor: 'rgba(31, 41, 55, 0.95)',
  },
  headerContainer: {
    position: 'relative',
  },
  glowEffect: {
    position: 'absolute',
    top: -scale(20),
    left: -scale(20),
    right: -scale(20),
    bottom: -scale(20),
    borderRadius: responsiveBorderRadius.xl,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: scale(30),
    elevation: 20,
  },
  header: {
    padding: screenWidth * 0.04,
    alignItems: 'center',
    borderTopLeftRadius: responsiveBorderRadius.xl,
    borderTopRightRadius: responsiveBorderRadius.xl,
    position: 'relative',
  },
  iconContainer: {
    width: screenWidth * 0.12,
    height: screenWidth * 0.12,
    borderRadius: screenWidth * 0.06,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: screenHeight * 0.015,
    position: 'relative',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.5)',
  },
  iconGlow: {
    position: 'absolute',
    width: screenWidth * 0.12,
    height: screenWidth * 0.12,
    borderRadius: screenWidth * 0.06,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: screenWidth * 0.04,
    elevation: 10,
  },
  sparkleIcon: {
    position: 'absolute',
    top: screenWidth * 0.02,
    right: screenWidth * 0.02,
  },
  title: {
    fontSize: responsiveFontSize['2xl'],
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: responsiveSpacing.sm,
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 4,
  },
  subtitle: {
    fontSize: responsiveFontSize.lg,
    color: 'rgba(255, 255, 255, 0.95)',
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  content: {
    padding: screenWidth * 0.03,
    flexShrink: 0,
  },
  scrollableContent: {
    flex: 1,
    paddingHorizontal: screenWidth * 0.03,
    paddingBottom: screenWidth * 0.03,
  },
  description: {
    fontSize: responsiveFontSize.base,
    color: '#4B5563',
    textAlign: 'center',
    lineHeight: responsiveFontSize.base * 1.4,
    marginBottom: screenHeight * 0.015,
    fontStyle: 'italic',
  },
  descriptionDark: {
    color: '#D1D5DB',
  },
  summaryContainer: {
    backgroundColor: 'rgba(249, 250, 251, 0.9)',
    borderRadius: responsiveBorderRadius.lg,
    padding: screenWidth * 0.03,
    marginBottom: screenHeight * 0.015,
    borderWidth: 1,
    borderColor: 'rgba(229, 231, 235, 0.5)',
  },
  summaryContainerDark: {
    backgroundColor: 'rgba(55, 65, 81, 0.9)',
    borderColor: 'rgba(75, 85, 99, 0.5)',
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: screenHeight * 0.01,
  },
  summaryTitle: {
    fontSize: responsiveFontSize.xl,
    fontWeight: 'bold',
    color: '#1F2937',
    marginLeft: responsiveSpacing.md,
  },
  summaryTitleDark: {
    color: '#F9FAFB',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: screenHeight * 0.01,
    gap: screenWidth * 0.015,
  },
  statItem: {
    width: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    padding: screenWidth * 0.02,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderRadius: responsiveBorderRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(229, 231, 235, 0.3)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statItemDark: {
    backgroundColor: 'rgba(31, 41, 55, 0.8)',
    borderColor: 'rgba(75, 85, 99, 0.3)',
  },
  statLabel: {
    fontSize: responsiveFontSize.sm,
    color: '#6B7280',
    marginLeft: responsiveSpacing.sm,
    flex: 1,
    fontWeight: '500',
  },
  statLabelDark: {
    color: '#9CA3AF',
  },
  statValue: {
    fontSize: responsiveFontSize.base,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  statValueDark: {
    color: '#F9FAFB',
  },
  achievementsSection: {
    marginBottom: screenHeight * 0.01,
  },
  achievementsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: responsiveSpacing.sm,
  },
  achievementsTitle: {
    fontSize: responsiveFontSize.lg,
    fontWeight: '600',
    color: '#1F2937',
    marginLeft: responsiveSpacing.sm,
  },
  achievementsTitleDark: {
    color: '#F9FAFB',
  },
  achievementsList: {
    fontSize: responsiveFontSize.base,
    color: '#6B7280',
    lineHeight: responsiveFontSize.base * 1.5,
  },
  achievementsListDark: {
    color: '#9CA3AF',
  },
  additionalStats: {
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    borderRadius: responsiveBorderRadius.md,
    padding: screenWidth * 0.025,
    marginBottom: screenHeight * 0.01,
    borderWidth: 1,
    borderColor: 'rgba(229, 231, 235, 0.3)',
  },
  additionalStatsDark: {
    backgroundColor: 'rgba(55, 65, 81, 0.7)',
    borderColor: 'rgba(75, 85, 99, 0.3)',
  },
  additionalStatsTitle: {
    fontSize: responsiveFontSize.sm,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: screenHeight * 0.008,
    textAlign: 'center',
  },
  additionalStatsTitleDark: {
    color: '#F9FAFB',
  },
  additionalStatsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: screenWidth * 0.01,
  },
  additionalStatItem: {
    width: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    padding: screenWidth * 0.015,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderRadius: responsiveBorderRadius.sm,
    borderWidth: 1,
    borderColor: 'rgba(229, 231, 235, 0.2)',
  },
  additionalStatItemDark: {
    backgroundColor: 'rgba(31, 41, 55, 0.8)',
    borderColor: 'rgba(75, 85, 99, 0.2)',
  },
  additionalStatLabel: {
    fontSize: responsiveFontSize.xs,
    color: '#6B7280',
    marginLeft: screenWidth * 0.01,
    flex: 1,
    fontWeight: '500',
  },
  additionalStatLabelDark: {
    color: '#9CA3AF',
  },
  additionalStatValue: {
    fontSize: responsiveFontSize.sm,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  additionalStatValueDark: {
    color: '#F9FAFB',
  },
  buttonContainer: {
    gap: screenHeight * 0.012,
    paddingTop: screenHeight * 0.01,
  },
  iapReviveButton: {
    borderRadius: responsiveBorderRadius.lg,
    overflow: 'hidden',
    shadowColor: '#FFD700',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 12,
  },
  iapReviveButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: screenHeight * 0.015,
    paddingHorizontal: screenWidth * 0.04,
    gap: screenWidth * 0.02,
  },
  iapButtonContent: {
    flex: 1,
    alignItems: 'center',
  },
  iapReviveButtonText: {
    color: '#FFFFFF',
    fontSize: responsiveFontSize.lg,
    fontWeight: 'bold',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  iapReviveButtonSubtext: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: responsiveFontSize.sm,
    marginTop: 2,
  },
  reviveButton: {
    borderRadius: responsiveBorderRadius.lg,
    overflow: 'hidden',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  reviveButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: screenHeight * 0.012,
    paddingHorizontal: screenWidth * 0.04,
    gap: screenWidth * 0.015,
  },
  reviveButtonContent: {
    flex: 1,
    alignItems: 'center',
  },
  reviveButtonText: {
    color: '#FFFFFF',
    fontSize: responsiveFontSize.lg,
    fontWeight: 'bold',
  },
  reviveButtonSubtext: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: responsiveFontSize.sm,
    marginTop: 2,
  },
  newLifeButton: {
    borderRadius: responsiveBorderRadius.lg,
    overflow: 'hidden',
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  newLifeButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: screenHeight * 0.012,
    paddingHorizontal: screenWidth * 0.04,
    gap: screenWidth * 0.015,
  },
  newLifeButtonText: {
    color: '#FFFFFF',
    fontSize: responsiveFontSize.lg,
    fontWeight: 'bold',
  },
});
