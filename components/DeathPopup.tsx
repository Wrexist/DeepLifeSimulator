import React, { useEffect, useRef, useState, useMemo } from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, Animated, Dimensions, ScrollView, Image, Alert, Share } from 'react-native';
import LinearGradientFallback from '@/components/fallbacks/LinearGradientFallback';
const LinearGradient = LinearGradientFallback;
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useGame } from '@/contexts/GameContext';
import { Skull, Heart, RotateCcw, Brain, Activity, Smile, Check, ArrowLeft, Crown, Sparkles, TrendingUp, DollarSign, Users, Award, Briefcase, GraduationCap, Home, Building2, Trophy, Calendar, MapPin, BookOpen, Share2 } from 'lucide-react-native';
import PrestigeModal from './PrestigeModal';
import { getCharacterImage } from '@/utils/characterImages';
import { HeirGenerator } from '@/lib/legacy/heirGeneration';
import { computeInheritance } from '@/lib/legacy/inheritance';
import { simulateChildrenToAdulthood } from '@/lib/legacy/childSimulation';
import { MINDSET_TRAITS, MindsetId } from '@/lib/mindset/config';
import { logger } from '@/utils/logger';
import { scale, fontScale } from '@/utils/scaling';
import { formatMoney } from '@/utils/moneyFormatting';
import { REVIVE_GEM_COST, WEEKS_PER_YEAR } from '@/lib/config/gameConstants';
import LifeStoryModal from './LifeStoryModal';

const { width, height } = Dimensions.get('window');

function DeathPopup() {
  const { gameState, setGameState, startNewLifeFromLegacy, reviveCharacter, currentSlot, saveGame } = useGame();
  const router = useRouter();
  const { settings, deathReason, date } = gameState;
  const showDeathPopup = gameState.showDeathPopup;
  
  const [showLifeStory, setShowLifeStory] = useState(false);
  const [selectedHeirId, setSelectedHeirId] = useState<string | null>(null);
  const [selectedMindset, setSelectedMindset] = useState<MindsetId | null>(
    (gameState.mindset?.activeTraitId as MindsetId | null) || null
  );
  const [showPrestigeModal, setShowPrestigeModal] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;

  const inheritanceSummary = useMemo(() => {
    return computeInheritance(gameState);
  }, [gameState]);

  const heirs = useMemo(() => {
    if (!gameState.family?.children || gameState.family.children.length === 0) return [];
    
    const simulatedChildren = simulateChildrenToAdulthood(gameState.family.children, gameState);
    
    return simulatedChildren.map((child: any) => {
      const result = HeirGenerator.generateHeir(
        child,
        gameState.activeTraits || [],
        (gameState.generationNumber || 1) + 1,
        gameState.lineageId ?? 'default_lineage',
        gameState.mindset?.activeTraitId ?? 'unknown_parent',
        gameState.family?.spouse?.id,
        []
      );
      
      const childInheritance = (() => {
        const totalNetWorth = inheritanceSummary.totalNetWorth;
        const baseInheritance = Math.floor(totalNetWorth * 0.1);
        
        let educationMultiplier = 1.0;
        if (child.educationLevel === 'university') {
          educationMultiplier = 1.2;
        } else if (child.educationLevel === 'specialized') {
          educationMultiplier = 1.3;
        }
        
        if (child.careerPath === 'professional' || child.careerPath === 'entrepreneur') {
          educationMultiplier += 0.1;
        }
        
        const inheritance = Math.floor(baseInheritance * educationMultiplier);
        return totalNetWorth < 100_000 
          ? Math.min(1_000_000, inheritance)
          : inheritance;
      })();
      
      return {
        id: child.id,
        name: child.name || 'Unknown',
        age: Math.max(18, Math.floor(child.age || 18)),
        traits: (result as any).traits || [],
        stats: (result as any).stats || {},
        preview: result,
        child: child,
        inheritance: childInheritance,
        educationLevel: child.educationLevel,
        careerPath: child.careerPath,
        savings: child.savings || 0,
      };
    });
  }, [gameState.family?.children, gameState.activeTraits, gameState.generationNumber, gameState.lineageId, gameState.mindset?.activeTraitId, inheritanceSummary]);

  useEffect(() => {
    const entranceAnim = Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
    ]);
    entranceAnim.start();

    return () => {
      entranceAnim.stop();
    };
  }, [fadeAnim, scaleAnim]);

  const handleContinueLegacy = async () => {
    if (!selectedHeirId) {
      Alert.alert('No Heir Selected', 'Please select a child to continue your legacy.');
      return;
    }

    try {
      startNewLifeFromLegacy(selectedHeirId);
      
      if (selectedMindset) {
        setGameState(prev => ({
          ...prev,
          mindset: {
            activeTraitId: selectedMindset,
            traits: [selectedMindset],
          },
        }));
      }
      
      setGameState(prev => ({
        ...prev,
        showDeathPopup: false,
        deathReason: undefined,
      }));
      setSelectedHeirId(null);
      
      await saveGame();
    } catch (error) {
      logger.error('Failed to start new life from legacy:', error);
      Alert.alert('Error', 'Failed to continue legacy. Please try again.');
      setGameState(prev => ({
        ...prev,
        showDeathPopup: true,
      }));
    }
  };

  const handleRevive = () => {
    const reviveCost = REVIVE_GEM_COST;
    if (gameState.stats.gems >= reviveCost) {
      reviveCharacter();
    }
  };

  const handleRewind = (checkpointId: string) => {
    try {
      const { rewindToCheckpoint, getRewindCost } = require('@/lib/timeMachine/checkpointSystem');
      const cost = getRewindCost(gameState.timeMachineUsesThisLife ?? 0);
      const gems = gameState.stats?.gems ?? 0;
      if (gems < cost) {
        Alert.alert('Not Enough Gems', `You need ${cost.toLocaleString()} gems to rewind.`);
        return;
      }
      Alert.alert(
        'Rewind Time',
        `Spend ${cost.toLocaleString()} gems to rewind? You'll lose all progress after this checkpoint.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Rewind',
            onPress: () => {
              const restored = rewindToCheckpoint(gameState, checkpointId);
              if (restored) {
                setGameState(() => restored);
                saveGame();
              } else {
                Alert.alert('Error', 'Failed to rewind. Checkpoint may be corrupted.');
              }
            },
          },
        ]
      );
    } catch (err) {
      logger.error('[TIME_MACHINE] Rewind failed:', err);
    }
  };

  const handleStartNewGame = async () => {
    try {
      setGameState(prev => ({
        ...prev,
        showDeathPopup: false,
        deathReason: undefined,
      }));
      
      if (currentSlot) {
        // CRASH FIX (A-1): Delete all double-buffer keys for this slot
        const { deleteSaveSlot } = await import('@/utils/saveValidation');
        await deleteSaveSlot(currentSlot);
        await AsyncStorage.removeItem('lastSlot');
      }
      
      router.replace('/(onboarding)/Scenarios');
    } catch (error) {
      if (__DEV__) {
        logger.error('Failed to start new game:', error);
      }
      setGameState(prev => ({
        ...prev,
        showDeathPopup: true,
      }));
    }
  };

  const handleShareObituary = async () => {
    try {
      const { generateObituary } = require('@/lib/legacy/obituaryGenerator');
      const obituary = generateObituary(gameState);
      await Share.share({
        message: obituary.shareText,
        title: obituary.headline,
      });
    } catch (err) {
      logger.error('Failed to share obituary:', err);
    }
  };

  if (!gameState.showDeathPopup) return null;

  const age = Math.floor(date.age);
  const weeksLived = gameState.weeksLived || 0;
  const yearsLived = Math.floor(weeksLived / WEEKS_PER_YEAR);
  
  // Enhanced death messages
  const deathTitleMessages = {
    health: ['You Died', 'Your body could no longer carry on'],
    happiness: ['You Died', 'The weight of life became too much'],
    default: ['You Died', 'Your journey has come to an end']
  };
  
  const deathTitle = deathReason === 'health' 
    ? deathTitleMessages.health[0]
    : deathReason === 'happiness'
    ? deathTitleMessages.happiness[0]
    : deathTitleMessages.default[0];
    
  const deathSubtitle = deathReason === 'health'
    ? deathTitleMessages.health[1]
    : deathReason === 'happiness'
    ? deathTitleMessages.happiness[1]
    : deathTitleMessages.default[1];
  
  const deathMessage =
    deathReason === 'health'
      ? 'Your body finally gave out.'
      : deathReason === 'happiness'
      ? 'You lost the will to go on.'
      : 'Your journey has ended.';

  // Calculate life summary statistics
  const completedAchievements = (gameState.achievements || []).filter(a => a.completed);
  const totalAchievements = completedAchievements.length;
  const topAchievements = completedAchievements.slice(0, 5);
  
  const completedEducation = (gameState.educations || []).filter(e => e.completed);
  const highestEducation = completedEducation.length > 0 
    ? completedEducation[completedEducation.length - 1]
    : null;
  
  const currentJob = gameState.currentJob 
    ? gameState.careers?.find(c => c.id === gameState.currentJob) || gameState.streetJobs?.find(j => j.id === gameState.currentJob)
    : null;
  
  const ownedProperties = (gameState.realEstate || []).filter(p => p.owned);
  const ownedCompanies = (gameState.companies || []).filter(c => c.owned);
  
  const spouse = gameState.family?.spouse;
  const children = gameState.family?.children || [];
  
  const totalNetWorth = inheritanceSummary.totalNetWorth;
  
  // Additional life statistics
  const lifetimeStats = gameState.prestige?.lifetimeStats;
  const totalRelationships = (gameState.relationships || []).length;
  const totalWeeksWorked = lifetimeStats?.totalWeeksLived || weeksLived;
  const totalMoneyEarned = lifetimeStats?.totalMoneyEarned || gameState.stats.money || 0;
  const maxNetWorth = lifetimeStats?.maxNetWorth || totalNetWorth;
  
  // Calculate career level if available
  const careerLevel = currentJob && 'level' in currentJob && typeof currentJob.level === 'number'
    ? currentJob.level + 1
    : null;

  // Time Machine checkpoints
  const checkpoints = useMemo(() => gameState.checkpoints ?? [], [gameState.checkpoints]);
  const rewindCost = useMemo(() => {
    try {
      const { getRewindCost } = require('@/lib/timeMachine/checkpointSystem');
      return getRewindCost(gameState.timeMachineUsesThisLife ?? 0);
    } catch { return 500; }
  }, [gameState.timeMachineUsesThisLife]);
  const canAffordRewind = (gameState.stats?.gems ?? 0) >= rewindCost;

  // Life Ribbon classification
  const lifeRibbon = useMemo(() => {
    try {
      const { classifyLife } = require('@/lib/legacy/ribbonSystem');
      return classifyLife(gameState);
    } catch {
      return null;
    }
  }, [gameState]);

  return (
    <>
    <Modal 
      visible={true} 
      transparent 
      animationType="fade"
      statusBarTranslucent={true}
      presentationStyle="overFullScreen"
      hardwareAccelerated={true}
    >
      <View style={styles.container}>
        <View style={styles.overlay} />

        <Animated.View
          style={[
            styles.content,
            {
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          {true ? (
            <LinearGradient
              colors={settings.darkMode ? ['#0F172A', '#1E293B', '#334155'] : ['#F8FAFC', '#FFFFFF', '#F1F5F9']}
              style={styles.card}
            >
              <View style={styles.scrollContainer}>
                <ScrollView 
                  style={styles.scrollView}
                  contentContainerStyle={styles.scrollContent}
                  showsVerticalScrollIndicator={true}
                  nestedScrollEnabled={true}
                  bounces={true}
                >
                {/* Header */}
                <View style={styles.header}>
                  <View style={[styles.iconContainer, settings.darkMode && styles.iconContainerDark]}>
                    <Skull size={40} color={settings.darkMode ? '#F9FAFB' : '#111827'} />
                  </View>
                  <View style={styles.headerText}>
                    <Text style={[styles.mainTitle, settings.darkMode && styles.mainTitleDark]}>
                      {deathTitle}
                    </Text>
                    <Text style={[styles.subtitle, settings.darkMode && styles.subtitleDark]}>
                      {deathSubtitle}
                    </Text>
                    <Text style={[styles.nameText, settings.darkMode && styles.nameTextDark]}>
                      {gameState.userProfile.name || 'Unknown Soul'}
                    </Text>
                    <Text style={[styles.details, settings.darkMode && styles.detailsDark]}>
                      Age {age} • {yearsLived > 0 ? `${yearsLived} years lived` : `${weeksLived} weeks lived`} • {deathMessage}
                    </Text>
                  </View>
                </View>

                {/* Life Ribbon */}
                {lifeRibbon && (
                  <View style={[styles.ribbonBanner, { borderColor: lifeRibbon.color }]}>
                    <Text style={styles.ribbonEmoji}>{lifeRibbon.emoji}</Text>
                    <View style={styles.ribbonTextContainer}>
                      <Text style={[styles.ribbonName, { color: lifeRibbon.color }]}>
                        {lifeRibbon.hidden && !gameState.ribbonCollection?.discoveredIds?.includes(lifeRibbon.id)
                          ? 'NEW RIBBON DISCOVERED!'
                          : lifeRibbon.name}
                      </Text>
                      <Text style={[styles.ribbonDesc, settings.darkMode && styles.summaryLabelDark]}>
                        {lifeRibbon.description}
                      </Text>
                    </View>
                  </View>
                )}

                {/* Life Summary Section */}
                <View style={styles.section}>
                  <View style={styles.sectionHeader}>
                    <Sparkles size={20} color={settings.darkMode ? '#FCD34D' : '#F59E0B'} />
                    <Text style={[styles.sectionTitle, settings.darkMode && styles.sectionTitleDark]}>
                      Life Summary
                    </Text>
                  </View>
                  
                  <View style={[styles.summaryCard, settings.darkMode && styles.summaryCardDark]}>
                    {/* Career */}
                    {currentJob && (
                      <View style={styles.summaryRow}>
                        <View style={[styles.summaryIconContainer, { backgroundColor: 'rgba(59, 130, 246, 0.1)' }]}>
                          <Briefcase size={18} color="#3B82F6" />
                        </View>
                        <View style={styles.summaryContent}>
                          <Text style={[styles.summaryLabel, settings.darkMode && styles.summaryLabelDark]}>
                            Final Career
                          </Text>
                          <Text style={[styles.summaryValue, settings.darkMode && styles.summaryValueDark]}>
                            {currentJob.name || 'Unknown'}
                          </Text>
                        </View>
                      </View>
                    )}

                    {/* Education */}
                    {highestEducation && (
                      <View style={styles.summaryRow}>
                        <View style={[styles.summaryIconContainer, { backgroundColor: 'rgba(139, 92, 246, 0.1)' }]}>
                          <GraduationCap size={18} color="#8B5CF6" />
                        </View>
                        <View style={styles.summaryContent}>
                          <Text style={[styles.summaryLabel, settings.darkMode && styles.summaryLabelDark]}>
                            Education
                          </Text>
                          <Text style={[styles.summaryValue, settings.darkMode && styles.summaryValueDark]}>
                            {highestEducation.name || 'None'}
                          </Text>
                        </View>
                      </View>
                    )}

                    {/* Family */}
                    <View style={styles.summaryRow}>
                      <View style={[styles.summaryIconContainer, { backgroundColor: 'rgba(236, 72, 153, 0.1)' }]}>
                        <Users size={18} color="#EC4899" />
                      </View>
                      <View style={styles.summaryContent}>
                        <Text style={[styles.summaryLabel, settings.darkMode && styles.summaryLabelDark]}>
                          Family
                        </Text>
                        <Text style={[styles.summaryValue, settings.darkMode && styles.summaryValueDark]}>
                          {spouse ? `Married to ${spouse.name}` : 'Single'} • {children.length} {children.length === 1 ? 'child' : 'children'}
                        </Text>
                      </View>
                    </View>

                    {/* Properties */}
                    {ownedProperties.length > 0 && (
                      <View style={styles.summaryRow}>
                        <View style={[styles.summaryIconContainer, { backgroundColor: 'rgba(16, 185, 129, 0.1)' }]}>
                          <Home size={18} color="#10B981" />
                        </View>
                        <View style={styles.summaryContent}>
                          <Text style={[styles.summaryLabel, settings.darkMode && styles.summaryLabelDark]}>
                            Properties Owned
                          </Text>
                          <Text style={[styles.summaryValue, settings.darkMode && styles.summaryValueDark]}>
                            {ownedProperties.length} {ownedProperties.length === 1 ? 'property' : 'properties'}
                          </Text>
                        </View>
                      </View>
                    )}

                    {/* Companies */}
                    {ownedCompanies.length > 0 && (
                      <View style={styles.summaryRow}>
                        <View style={[styles.summaryIconContainer, { backgroundColor: 'rgba(245, 158, 11, 0.1)' }]}>
                          <Building2 size={18} color="#F59E0B" />
                        </View>
                        <View style={styles.summaryContent}>
                          <Text style={[styles.summaryLabel, settings.darkMode && styles.summaryLabelDark]}>
                            Companies Owned
                          </Text>
                          <Text style={[styles.summaryValue, settings.darkMode && styles.summaryValueDark]}>
                            {ownedCompanies.length} {ownedCompanies.length === 1 ? 'company' : 'companies'}
                          </Text>
                        </View>
                      </View>
                    )}

                    {/* Achievements */}
                    {totalAchievements > 0 && (
                      <View style={styles.summaryRow}>
                        <View style={[styles.summaryIconContainer, { backgroundColor: 'rgba(168, 85, 247, 0.1)' }]}>
                          <Trophy size={18} color="#A855F7" />
                        </View>
                        <View style={styles.summaryContent}>
                          <Text style={[styles.summaryLabel, settings.darkMode && styles.summaryLabelDark]}>
                            Achievements
                          </Text>
                          <Text style={[styles.summaryValue, settings.darkMode && styles.summaryValueDark]}>
                            {totalAchievements} {totalAchievements === 1 ? 'achievement' : 'achievements'} unlocked
                          </Text>
                        </View>
                      </View>
                    )}

                    {/* Top Achievements */}
                    {topAchievements.length > 0 && (
                      <View style={styles.achievementsList}>
                        {topAchievements.map((ach, idx) => (
                          <View key={ach.id || idx} style={[styles.achievementBadge, settings.darkMode && styles.achievementBadgeDark]}>
                            <Trophy size={12} color="#F59E0B" />
                            <Text style={[styles.achievementText, settings.darkMode && styles.achievementTextDark]}>
                              {ach.name}
                            </Text>
                          </View>
                        ))}
                      </View>
                    )}
                  </View>
                </View>

                {/* Stats Cards */}
                <View style={styles.statsContainer}>
                  <View style={[styles.statCard, settings.darkMode && styles.statCardDark]}>
                    <View style={[styles.statIconContainer, { backgroundColor: 'rgba(16, 185, 129, 0.1)' }]}>
                      <DollarSign size={20} color="#10B981" />
                    </View>
                    <View style={styles.statContent}>
                      <Text style={[styles.statLabel, settings.darkMode && styles.statLabelDark]}>Net Worth</Text>
                      <Text style={[styles.statValue, settings.darkMode && styles.statValueDark]}>
                        {formatMoney(inheritanceSummary.totalNetWorth)}
                      </Text>
                    </View>
                  </View>

                  <View style={[styles.statCard, settings.darkMode && styles.statCardDark]}>
                    <View style={[styles.statIconContainer, { backgroundColor: 'rgba(139, 92, 246, 0.1)' }]}>
                      <Crown size={20} color="#8B5CF6" />
                    </View>
                    <View style={styles.statContent}>
                      <Text style={[styles.statLabel, settings.darkMode && styles.statLabelDark]}>Generation</Text>
                      <Text style={[styles.statValue, settings.darkMode && styles.statValueDark]}>
                        {gameState.generationNumber || 1}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Inheritance Breakdown */}
                <View style={styles.section}>
                  <Text style={[styles.sectionTitle, settings.darkMode && styles.sectionTitleDark]}>
                    Inheritance Breakdown
                  </Text>
                  
                  <View style={[styles.breakdownCard, settings.darkMode && styles.breakdownCardDark]}>
                    <View style={styles.breakdownRow}>
                      <Text style={[styles.breakdownLabel, settings.darkMode && styles.breakdownLabelDark]}>Cash</Text>
                      <Text style={[styles.breakdownValue, settings.darkMode && styles.breakdownValueDark]}>
                        {formatMoney(inheritanceSummary.cash)}
                      </Text>
                    </View>
                    
                    <View style={styles.breakdownRow}>
                      <Text style={[styles.breakdownLabel, settings.darkMode && styles.breakdownLabelDark]}>Savings</Text>
                      <Text style={[styles.breakdownValue, settings.darkMode && styles.breakdownValueDark]}>
                        {formatMoney(inheritanceSummary.bankSavings)}
                      </Text>
                    </View>
                    
                    {inheritanceSummary.realEstateIds.length > 0 && (
                      <View style={styles.breakdownRow}>
                        <Text style={[styles.breakdownLabel, settings.darkMode && styles.breakdownLabelDark]}>Properties</Text>
                        <Text style={[styles.breakdownValue, settings.darkMode && styles.breakdownValueDark]}>
                          {inheritanceSummary.realEstateIds.length}
                        </Text>
                      </View>
                    )}
                    
                    {inheritanceSummary.companyIds.length > 0 && (
                      <View style={styles.breakdownRow}>
                        <Text style={[styles.breakdownLabel, settings.darkMode && styles.breakdownLabelDark]}>Companies</Text>
                        <Text style={[styles.breakdownValue, settings.darkMode && styles.breakdownValueDark]}>
                          {inheritanceSummary.companyIds.length}
                        </Text>
                      </View>
                    )}
                    
                    {inheritanceSummary.debts > 0 && (
                      <View style={styles.breakdownRow}>
                        <Text style={[styles.breakdownLabel, { color: '#EF4444' }]}>Debts</Text>
                        <Text style={[styles.breakdownValue, { color: '#EF4444' }]}>
                          -{formatMoney(inheritanceSummary.debts)}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>

                {/* Life Statistics */}
                <View style={styles.section}>
                  <View style={styles.sectionHeader}>
                    <Calendar size={20} color={settings.darkMode ? '#8B5CF6' : '#6366F1'} />
                    <Text style={[styles.sectionTitle, settings.darkMode && styles.sectionTitleDark]}>
                      Life Statistics
                    </Text>
                  </View>
                  
                  <View style={[styles.statsGrid, settings.darkMode && styles.statsGridDark]}>
                    <View style={[styles.statBox, settings.darkMode && styles.statBoxDark]}>
                      <Text style={[styles.statBoxLabel, settings.darkMode && styles.statBoxLabelDark]}>Weeks Lived</Text>
                      <Text style={[styles.statBoxValue, settings.darkMode && styles.statBoxValueDark]}>
                        {weeksLived}
                      </Text>
                    </View>
                    
                    <View style={[styles.statBox, settings.darkMode && styles.statBoxDark]}>
                      <Text style={[styles.statBoxLabel, settings.darkMode && styles.statBoxLabelDark]}>Relationships</Text>
                      <Text style={[styles.statBoxValue, settings.darkMode && styles.statBoxValueDark]}>
                        {totalRelationships}
                      </Text>
                    </View>
                    
                    {careerLevel && (
                      <View style={[styles.statBox, settings.darkMode && styles.statBoxDark]}>
                        <Text style={[styles.statBoxLabel, settings.darkMode && styles.statBoxLabelDark]}>Career Level</Text>
                        <Text style={[styles.statBoxValue, settings.darkMode && styles.statBoxValueDark]}>
                          {careerLevel}
                        </Text>
                      </View>
                    )}
                    
                    <View style={[styles.statBox, settings.darkMode && styles.statBoxDark]}>
                      <Text style={[styles.statBoxLabel, settings.darkMode && styles.statBoxLabelDark]}>Peak Net Worth</Text>
                      <Text style={[styles.statBoxValue, settings.darkMode && styles.statBoxValueDark]}>
                        {formatMoney(maxNetWorth)}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* ENGAGEMENT: Prestige Points Preview — reframes death as investment */}
                {(() => {
                  const prestigeLevel = gameState.prestige?.prestigeLevel || 0;
                  const earnedPoints = Math.floor(
                    (totalNetWorth / 10000) + (weeksLived / 5) + (totalAchievements * 20) + (prestigeLevel * 100)
                  );
                  // Show what they could buy with earned points
                  const canBuySmallInheritance = earnedPoints >= 500;
                  const canBuyStatBoost = earnedPoints >= 1000;
                  const canBuyModestInheritance = earnedPoints >= 2000;
                  return earnedPoints > 0 ? (
                    <View style={styles.section}>
                      <View style={styles.sectionHeader}>
                        <Crown size={20} color="#F59E0B" />
                        <Text style={[styles.sectionTitle, settings.darkMode && styles.sectionTitleDark]}>
                          Prestige Points Earned
                        </Text>
                      </View>
                      <View style={[styles.prestigePreviewCard, settings.darkMode && styles.prestigePreviewCardDark]}>
                        <Text style={styles.prestigePointsValue}>
                          {earnedPoints.toLocaleString()} pts
                        </Text>
                        <Text style={[styles.prestigeHint, settings.darkMode && styles.prestigeHintDark]}>
                          Use prestige points to start your next life stronger
                        </Text>
                        <View style={styles.prestigeBuyList}>
                          {canBuySmallInheritance && (
                            <View style={styles.prestigeBuyItem}>
                              <DollarSign size={14} color="#10B981" />
                              <Text style={[styles.prestigeBuyText, settings.darkMode && styles.prestigeBuyTextDark]}>
                                +$10,000 starting money (500 pts)
                              </Text>
                            </View>
                          )}
                          {canBuyStatBoost && (
                            <View style={styles.prestigeBuyItem}>
                              <TrendingUp size={14} color="#3B82F6" />
                              <Text style={[styles.prestigeBuyText, settings.darkMode && styles.prestigeBuyTextDark]}>
                                +5 to all starting stats (1,000 pts)
                              </Text>
                            </View>
                          )}
                          {canBuyModestInheritance && (
                            <View style={styles.prestigeBuyItem}>
                              <Sparkles size={14} color="#F59E0B" />
                              <Text style={[styles.prestigeBuyText, settings.darkMode && styles.prestigeBuyTextDark]}>
                                +$50,000 starting money (2,000 pts)
                              </Text>
                            </View>
                          )}
                        </View>
                      </View>
                    </View>
                  ) : null;
                })()}

                {/* Legacy Bonuses */}
                <View style={styles.section}>
                  <Text style={[styles.sectionTitle, settings.darkMode && styles.sectionTitleDark]}>
                    Legacy Bonuses
                  </Text>
                  
                  <View style={[styles.bonusesCard, settings.darkMode && styles.bonusesCardDark]}>
                    <View style={styles.bonusItem}>
                      <View style={[styles.bonusIconContainer, { backgroundColor: 'rgba(16, 185, 129, 0.1)' }]}>
                        <TrendingUp size={16} color="#10B981" />
                      </View>
                      <View style={styles.bonusContent}>
                        <Text style={[styles.bonusLabel, settings.darkMode && styles.bonusLabelDark]}>Income</Text>
                        <Text style={styles.bonusValue}>
                          +{((inheritanceSummary.legacyBonuses.incomeMultiplier - 1) * 100).toFixed(1)}%
                        </Text>
                      </View>
                    </View>

                    <View style={styles.bonusItem}>
                      <View style={[styles.bonusIconContainer, { backgroundColor: 'rgba(139, 92, 246, 0.1)' }]}>
                        <Brain size={16} color="#8B5CF6" />
                      </View>
                      <View style={styles.bonusContent}>
                        <Text style={[styles.bonusLabel, settings.darkMode && styles.bonusLabelDark]}>Learning</Text>
                        <Text style={styles.bonusValue}>
                          +{((inheritanceSummary.legacyBonuses.learningMultiplier - 1) * 100).toFixed(1)}%
                        </Text>
                      </View>
                    </View>

                    <View style={styles.bonusItem}>
                      <View style={[styles.bonusIconContainer, { backgroundColor: 'rgba(59, 130, 246, 0.1)' }]}>
                        <Award size={16} color="#3B82F6" />
                      </View>
                      <View style={styles.bonusContent}>
                        <Text style={[styles.bonusLabel, settings.darkMode && styles.bonusLabelDark]}>Reputation</Text>
                        <Text style={styles.bonusValue}>
                          +{inheritanceSummary.legacyBonuses.reputationBonus}
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>

                {/* Children Selection */}
                <View style={styles.section}>
                  <View style={styles.sectionHeader}>
                    <Users size={20} color={settings.darkMode ? '#EC4899' : '#F43F5E'} />
                    <Text style={[styles.sectionTitle, settings.darkMode && styles.sectionTitleDark]}>
                      Continue Legacy
                    </Text>
                  </View>
                  
                  {heirs.length > 0 ? (
                    <>
                      <Text style={[styles.childrenNote, settings.darkMode && styles.childrenNoteDark]}>
                        Select a child to continue your legacy. Children under 18 will be simulated to age 18.
                      </Text>
                      <View style={styles.childrenList}>
                        {heirs.map(({ child, stats, traits, inheritance, educationLevel, careerPath, savings, age }) => {
                          const isSelected = selectedHeirId === child.id;
                          const totalNetWorth = inheritance + savings;
                          
                          return (
                            <TouchableOpacity
                              key={child.id}
                              style={[
                                styles.childCard,
                                settings.darkMode && styles.childCardDark,
                                isSelected && styles.childCardSelected
                              ]}
                              onPress={() => setSelectedHeirId(child.id)}
                              activeOpacity={0.8}
                            >
                              <View style={styles.childCardHeader}>
                                <Image
                                  source={getCharacterImage(age, child.gender)}
                                  style={styles.childImage}
                                />
                                <View style={styles.childInfo}>
                                  <Text style={[styles.childName, settings.darkMode && styles.childNameDark]}>
                                    {child.name}
                                  </Text>
                                  <Text style={[styles.childDetails, settings.darkMode && styles.childDetailsDark]}>
                                    Age {age} • {child.gender === 'male' ? 'Son' : 'Daughter'}
                                  </Text>
                                  {educationLevel && educationLevel !== 'none' && (
                                    <View style={styles.badgeContainer}>
                                      <View style={[styles.badge, { backgroundColor: 'rgba(59, 130, 246, 0.1)' }]}>
                                        <Text style={[styles.badgeText, { color: '#3B82F6' }]}>
                                          {educationLevel === 'university' ? 'University' : 
                                           educationLevel === 'specialized' ? 'Specialized' : 'High School'}
                                        </Text>
                                      </View>
                                    </View>
                                  )}
                                  {careerPath && (
                                    <View style={styles.badgeContainer}>
                                      <View style={[styles.badge, { backgroundColor: 'rgba(139, 92, 246, 0.1)' }]}>
                                        <Text style={[styles.badgeText, { color: '#8B5CF6' }]}>
                                          {careerPath === 'entrepreneur' ? 'Entrepreneur' :
                                           careerPath === 'professional' ? 'Professional' :
                                           careerPath === 'whiteCollar' ? 'White Collar' : 'Blue Collar'}
                                        </Text>
                                      </View>
                                    </View>
                                  )}
                                </View>
                                {isSelected && (
                                  <View style={styles.selectedBadge}>
                                    <Check size={20} color="#10B981" />
                                  </View>
                                )}
                              </View>

                              <View style={[styles.childNetWorthCard, settings.darkMode && styles.childNetWorthCardDark]}>
                                <View style={styles.childNetWorthRow}>
                                  <DollarSign size={16} color="#10B981" />
                                  <Text style={[styles.childNetWorthLabel, settings.darkMode && styles.childNetWorthLabelDark]}>
                                    Net Worth
                                  </Text>
                                  <Text style={styles.childNetWorthValue}>
                                    {formatMoney(totalNetWorth)}
                                  </Text>
                                </View>
                                {inheritance > 0 && (
                                  <Text style={[styles.childInheritanceText, settings.darkMode && styles.childInheritanceTextDark]}>
                                    Inheritance: {formatMoney(inheritance)}
                                  </Text>
                                )}
                                {savings > 0 && (
                                  <Text style={[styles.childInheritanceText, settings.darkMode && styles.childInheritanceTextDark]}>
                                    Savings: {formatMoney(savings)}
                                  </Text>
                                )}
                              </View>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </>
                  ) : (
                    <View style={[styles.noChildrenCard, settings.darkMode && styles.noChildrenCardDark]}>
                      <Users size={32} color={settings.darkMode ? '#9CA3AF' : '#6B7280'} />
                      <Text style={[styles.noChildrenText, settings.darkMode && styles.noChildrenTextDark]}>
                        You have no children to continue your legacy.
                      </Text>
                    </View>
                  )}
                </View>
                </ScrollView>
              </View>

              {/* Actions */}
              <View style={styles.actions}>
                <TouchableOpacity
                  style={[styles.actionButton, styles.reviveButton, gameState.stats.gems < REVIVE_GEM_COST && styles.disabledButton]}
                  onPress={handleRevive}
                  disabled={gameState.stats.gems < REVIVE_GEM_COST}
                  activeOpacity={0.8}
                >
                  <LinearGradient
                    colors={gameState.stats.gems >= REVIVE_GEM_COST ? ['#10B981', '#059669'] : ['#9CA3AF', '#6B7280']}
                    style={styles.buttonGradient}
                  >
                    <Heart size={18} color="#FFF" />
                    <Text style={styles.buttonText}>
                      Revive ({REVIVE_GEM_COST.toLocaleString()} Gems)
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>

                {/* Time Machine — Rewind to checkpoint (cheaper than revive) */}
                {checkpoints.length > 0 && (
                  <View style={styles.rewindSection}>
                    <Text style={[styles.rewindTitle, settings.darkMode && { color: '#F9FAFB' }]}>
                      Rewind Time ({rewindCost.toLocaleString()} Gems)
                    </Text>
                    {checkpoints.slice().reverse().map((cp: any) => (
                      <TouchableOpacity
                        key={cp.id}
                        style={[styles.rewindChip, !canAffordRewind && styles.disabledButton]}
                        onPress={() => handleRewind(cp.id)}
                        disabled={!canAffordRewind}
                        activeOpacity={0.7}
                      >
                        <RotateCcw size={14} color={canAffordRewind ? '#F59E0B' : '#9CA3AF'} />
                        <Text style={[styles.rewindChipText, !canAffordRewind && { color: '#9CA3AF' }]}>
                          {cp.label} (Age {cp.age})
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}

                <TouchableOpacity
                  style={[styles.actionButton, styles.continueButton, (heirs.length === 0 || !selectedHeirId) && styles.disabledButton]} 
                  onPress={handleContinueLegacy}
                  disabled={heirs.length === 0 || !selectedHeirId}
                  activeOpacity={0.8}
                >
                  <LinearGradient 
                    colors={(heirs.length === 0 || !selectedHeirId) ? ['#9CA3AF', '#6B7280'] : ['#6366F1', '#4F46E5']} 
                    style={styles.buttonGradient}
                  >
                    <Crown size={18} color="#FFF" />
                    <Text style={styles.buttonText}>
                      {heirs.length === 0 ? 'No Children Available' : !selectedHeirId ? 'Select a Child First' : 'Continue Legacy'}
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.actionButton, styles.newLifeButton]}
                  onPress={handleStartNewGame}
                  activeOpacity={0.8}
                >
                  <LinearGradient colors={['#8B5CF6', '#7C3AED']} style={styles.buttonGradient}>
                    <Sparkles size={18} color="#FFF" />
                    <Text style={styles.buttonText}>Start New Life</Text>
                  </LinearGradient>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.actionButton]}
                  onPress={() => setShowLifeStory(true)}
                  activeOpacity={0.8}
                >
                  <LinearGradient colors={['#6366F1', '#818CF8']} style={styles.buttonGradient}>
                    <BookOpen size={18} color="#FFF" />
                    <Text style={styles.buttonText}>Read Your Story</Text>
                  </LinearGradient>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.actionButton]}
                  onPress={handleShareObituary}
                  activeOpacity={0.8}
                >
                  <LinearGradient colors={['#EC4899', '#F472B6']} style={styles.buttonGradient}>
                    <Share2 size={18} color="#FFF" />
                    <Text style={styles.buttonText}>Share Obituary</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </LinearGradient>
          ) : (
            // HEIR SELECTION VIEW
            <LinearGradient
              colors={settings.darkMode ? ['#0F172A', '#1E293B', '#334155'] : ['#F8FAFC', '#FFFFFF', '#F1F5F9']}
              style={styles.card}
            >
              <View style={styles.heirHeader}>
                <TouchableOpacity 
                  style={styles.backButton}
                  onPress={() => setShowHeirSelection(false)}
                  activeOpacity={0.7}
                >
                  <ArrowLeft size={24} color={settings.darkMode ? '#F9FAFB' : '#111827'} />
                </TouchableOpacity>
                <View style={styles.headerContent}>
                  <View style={[styles.headerIconContainer, settings.darkMode && styles.headerIconContainerDark]}>
                    <Crown size={28} color={settings.darkMode ? '#FCD34D' : '#F59E0B'} />
                  </View>
                  <View>
                    <Text style={[styles.heirTitle, settings.darkMode && styles.heirTitleDark]}>
                      Choose Your Heir
                    </Text>
                    <Text style={[styles.heirSubtitle, settings.darkMode && styles.heirSubtitleDark]}>
                      Who will continue your legacy?
                    </Text>
                    <Text style={[styles.heirNote, settings.darkMode && styles.heirNoteDark]}>
                      Children under 18 will be simulated to age 18
                    </Text>
                  </View>
                </View>
              </View>

              <ScrollView 
                style={styles.heirScrollView}
                contentContainerStyle={styles.heirScrollContent}
                showsVerticalScrollIndicator={false}
              >
                {heirs.map(({ child, stats, traits, inheritance, educationLevel, careerPath, savings, age }) => {
                  const isSelected = selectedHeirId === child.id;
                  return (
                    <TouchableOpacity
                      key={child.id}
                      style={[
                        styles.heirCard,
                        settings.darkMode && styles.heirCardDark,
                        isSelected && styles.heirCardSelected
                      ]}
                      onPress={() => setSelectedHeirId(child.id)}
                      activeOpacity={0.8}
                    >
                      <View style={styles.heirCardHeader}>
                        <Image
                          source={getCharacterImage(age, child.gender)}
                          style={styles.heirImage}
                        />
                        <View style={styles.heirInfo}>
                          <Text style={[styles.heirName, settings.darkMode && styles.heirNameDark]}>
                            {child.name}
                          </Text>
                          <Text style={[styles.heirDetails, settings.darkMode && styles.heirDetailsDark]}>
                            Age {age} • {child.gender === 'male' ? 'Son' : 'Daughter'}
                          </Text>
                          {educationLevel && educationLevel !== 'none' && (
                            <View style={styles.badgeContainer}>
                              <View style={[styles.badge, { backgroundColor: 'rgba(59, 130, 246, 0.1)' }]}>
                                <Text style={[styles.badgeText, { color: '#3B82F6' }]}>
                                  {educationLevel === 'university' ? 'University' : 
                                   educationLevel === 'specialized' ? 'Specialized' : 'High School'}
                                </Text>
                              </View>
                            </View>
                          )}
                          {careerPath && (
                            <View style={styles.badgeContainer}>
                              <View style={[styles.badge, { backgroundColor: 'rgba(139, 92, 246, 0.1)' }]}>
                                <Text style={[styles.badgeText, { color: '#8B5CF6' }]}>
                                  {careerPath === 'entrepreneur' ? 'Entrepreneur' :
                                   careerPath === 'professional' ? 'Professional' :
                                   careerPath === 'whiteCollar' ? 'White Collar' : 'Blue Collar'}
                                </Text>
                              </View>
                            </View>
                          )}
                        </View>
                        {isSelected && (
                          <View style={styles.selectedBadge}>
                            <Check size={20} color="#10B981" />
                          </View>
                        )}
                      </View>

                      <View style={[styles.inheritanceCard, settings.darkMode && styles.inheritanceCardDark]}>
                        <View style={styles.inheritanceRow}>
                          <DollarSign size={16} color="#10B981" />
                          <Text style={[styles.inheritanceLabel, settings.darkMode && styles.inheritanceLabelDark]}>
                            Inheritance
                          </Text>
                          <Text style={styles.inheritanceValue}>
                            {formatMoney(inheritance)}
                          </Text>
                        </View>
                        {savings > 0 && (
                          <View style={styles.inheritanceRow}>
                            <Text style={[styles.savingsText, settings.darkMode && styles.savingsTextDark]}>
                              + {formatMoney(savings)} savings
                            </Text>
                          </View>
                        )}
                      </View>

                      <View style={styles.heirStatsRow}>
                        <View style={styles.heirStatItem}>
                          <Activity size={14} color="#EF4444" />
                          <Text style={[styles.heirStatValue, settings.darkMode && styles.heirStatValueDark]}>
                            {stats.health || 50}
                          </Text>
                        </View>
                        <View style={styles.heirStatItem}>
                          <Smile size={14} color="#F59E0B" />
                          <Text style={[styles.heirStatValue, settings.darkMode && styles.heirStatValueDark]}>
                            {stats.happiness || 50}
                          </Text>
                        </View>
                        <View style={styles.heirStatItem}>
                          <Brain size={14} color="#8B5CF6" />
                          <Text style={[styles.heirStatValue, settings.darkMode && styles.heirStatValueDark]}>
                            {(stats.reputation || 0) + Math.floor((stats.fitness || 0) / 2)}
                          </Text>
                        </View>
                      </View>

                      {traits && traits.length > 0 && (
                        <View style={styles.traitsContainer}>
                          {traits.map((t: any, idx: number) => (
                            <View key={t?.id || idx} style={[styles.traitBadge, { backgroundColor: 'rgba(59, 130, 246, 0.1)' }]}>
                              <Text style={[styles.traitText, { color: '#3B82F6' }]}>
                                {t?.name || 'Trait'}
                              </Text>
                            </View>
                          ))}
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {/* Mindset Selection */}
              <View style={styles.mindsetSection}>
                <View style={styles.mindsetHeader}>
                  <Brain size={18} color={settings.darkMode ? '#8B5CF6' : '#6366F1'} />
                  <Text style={[styles.mindsetTitle, settings.darkMode && styles.mindsetTitleDark]}>
                    Choose Mindset (Optional)
                  </Text>
                </View>
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
                        activeOpacity={0.8}
                      >
                        <Image source={trait.icon} style={styles.mindsetIcon} resizeMode="contain" />
                        <Text style={[
                          styles.mindsetOptionName,
                          settings.darkMode && styles.mindsetOptionNameDark,
                          isSelected && styles.mindsetOptionNameSelected
                        ]}>
                          {trait.name}
                        </Text>
                        {isSelected && (
                          <View style={styles.mindsetCheck}>
                            <Check size={14} color="#8B5CF6" />
                          </View>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>

              {/* Heir Actions */}
              <View style={styles.heirActions}>
                <TouchableOpacity
                  style={[styles.confirmButton, !selectedHeirId && styles.disabledButton]}
                  onPress={confirmHeirSelection}
                  disabled={!selectedHeirId}
                  activeOpacity={0.8}
                >
                  <LinearGradient
                    colors={selectedHeirId ? ['#6366F1', '#4F46E5'] : ['#9CA3AF', '#6B7280']}
                    style={styles.buttonGradient}
                  >
                    <Crown size={18} color="#FFF" />
                    <Text style={styles.buttonText}>Continue Legacy</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </LinearGradient>
          )}
        </Animated.View>
      </View>
    </Modal>
    <LifeStoryModal visible={showLifeStory} onClose={() => setShowLifeStory(false)} />
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
    zIndex: 10000,
  },
  overlay: {
    position: 'absolute',
    width: width,
    height: height,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
  },
  content: {
    width: width * 0.9,
    maxWidth: 420,
    maxHeight: height * 0.85,
  },
  card: {
    width: '100%',
    borderRadius: scale(24),
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 24,
    elevation: 12,
    maxHeight: height * 0.85,
    flexDirection: 'column',
  },
  scrollContainer: {
    maxHeight: height * 0.55,
    minHeight: scale(300),
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: scale(24),
    paddingBottom: scale(20),
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: scale(24),
  },
  iconContainer: {
    width: scale(64),
    height: scale(64),
    borderRadius: scale(32),
    backgroundColor: 'rgba(107, 114, 128, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: scale(16),
  },
  iconContainerDark: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  headerText: {
    flex: 1,
  },
  mainTitle: {
    fontSize: fontScale(36),
    fontWeight: '800',
    color: '#111827',
    marginBottom: scale(6),
    letterSpacing: -0.5,
  },
  mainTitleDark: {
    color: '#F9FAFB',
  },
  title: {
    fontSize: fontScale(32),
    fontWeight: '700',
    color: '#111827',
    marginBottom: scale(4),
    letterSpacing: -0.5,
  },
  titleDark: {
    color: '#F9FAFB',
  },
  subtitle: {
    fontSize: fontScale(16),
    fontWeight: '500',
    color: '#6B7280',
    marginBottom: scale(8),
    fontStyle: 'italic',
  },
  subtitleDark: {
    color: '#9CA3AF',
  },
  nameText: {
    fontSize: fontScale(22),
    fontWeight: '700',
    color: '#111827',
    marginBottom: scale(4),
  },
  nameTextDark: {
    color: '#F9FAFB',
  },
  details: {
    fontSize: fontScale(14),
    color: '#6B7280',
  },
  detailsDark: {
    color: '#9CA3AF',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(8),
    marginBottom: scale(12),
  },
  summaryCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    borderRadius: scale(16),
    padding: scale(16),
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.05)',
    gap: scale(12),
  },
  summaryCardDark: {
    backgroundColor: 'rgba(30, 41, 59, 0.4)',
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: scale(4),
  },
  summaryIconContainer: {
    width: scale(36),
    height: scale(36),
    borderRadius: scale(18),
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: scale(12),
  },
  summaryContent: {
    flex: 1,
  },
  summaryLabel: {
    fontSize: fontScale(12),
    color: '#6B7280',
    marginBottom: scale(2),
    fontWeight: '500',
  },
  summaryLabelDark: {
    color: '#9CA3AF',
  },
  summaryValue: {
    fontSize: fontScale(14),
    fontWeight: '600',
    color: '#111827',
  },
  summaryValueDark: {
    color: '#F9FAFB',
  },
  achievementsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: scale(6),
    marginTop: scale(8),
    paddingTop: scale(12),
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.05)',
  },
  achievementBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(4),
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    paddingHorizontal: scale(10),
    paddingVertical: scale(6),
    borderRadius: scale(8),
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.2)',
  },
  achievementBadgeDark: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderColor: 'rgba(245, 158, 11, 0.3)',
  },
  achievementText: {
    fontSize: fontScale(11),
    fontWeight: '600',
    color: '#92400E',
  },
  achievementTextDark: {
    color: '#FCD34D',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: scale(12),
    marginTop: scale(8),
  },
  statsGridDark: {},
  statBox: {
    flex: 1,
    minWidth: scale(100),
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    borderRadius: scale(12),
    padding: scale(12),
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.05)',
  },
  statBoxDark: {
    backgroundColor: 'rgba(30, 41, 59, 0.4)',
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  statBoxLabel: {
    fontSize: fontScale(11),
    color: '#6B7280',
    marginBottom: scale(4),
    fontWeight: '500',
    textAlign: 'center',
  },
  statBoxLabelDark: {
    color: '#9CA3AF',
  },
  statBoxValue: {
    fontSize: fontScale(16),
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
  },
  statBoxValueDark: {
    color: '#F9FAFB',
  },
  statsContainer: {
    flexDirection: 'row',
    gap: scale(12),
    marginBottom: scale(24),
  },
  statCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    padding: scale(16),
    borderRadius: scale(16),
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.05)',
  },
  statCardDark: {
    backgroundColor: 'rgba(30, 41, 59, 0.6)',
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  statIconContainer: {
    width: scale(40),
    height: scale(40),
    borderRadius: scale(20),
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: scale(12),
  },
  statContent: {
    flex: 1,
  },
  statLabel: {
    fontSize: fontScale(12),
    color: '#6B7280',
    marginBottom: scale(2),
  },
  statLabelDark: {
    color: '#9CA3AF',
  },
  statValue: {
    fontSize: fontScale(18),
    fontWeight: '700',
    color: '#111827',
  },
  statValueDark: {
    color: '#F9FAFB',
  },
  section: {
    marginBottom: scale(24),
  },
  sectionTitle: {
    fontSize: fontScale(20),
    fontWeight: '700',
    color: '#111827',
    marginBottom: scale(12),
  },
  sectionTitleDark: {
    color: '#F9FAFB',
  },
  breakdownCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    borderRadius: scale(16),
    padding: scale(16),
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.05)',
  },
  breakdownCardDark: {
    backgroundColor: 'rgba(30, 41, 59, 0.4)',
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: scale(8),
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.05)',
  },
  breakdownLabel: {
    fontSize: fontScale(14),
    color: '#6B7280',
    fontWeight: '500',
  },
  breakdownLabelDark: {
    color: '#9CA3AF',
  },
  breakdownValue: {
    fontSize: fontScale(14),
    fontWeight: '600',
    color: '#111827',
  },
  breakdownValueDark: {
    color: '#F9FAFB',
  },
  bonusesCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    borderRadius: scale(16),
    padding: scale(16),
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.05)',
    gap: scale(12),
  },
  bonusesCardDark: {
    backgroundColor: 'rgba(30, 41, 59, 0.4)',
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  bonusItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  bonusIconContainer: {
    width: scale(32),
    height: scale(32),
    borderRadius: scale(16),
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: scale(12),
  },
  bonusContent: {
    flex: 1,
  },
  bonusLabel: {
    fontSize: fontScale(12),
    color: '#6B7280',
    marginBottom: scale(2),
  },
  bonusLabelDark: {
    color: '#9CA3AF',
  },
  bonusValue: {
    fontSize: fontScale(16),
    fontWeight: '700',
    color: '#10B981',
  },
  actions: {
    padding: scale(20),
    paddingTop: scale(16),
    gap: scale(10),
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.08)',
  },
  actionButton: {
    borderRadius: scale(14),
    overflow: 'hidden',
  },
  buttonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: scale(16),
    gap: scale(8),
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: fontScale(16),
    fontWeight: '700',
  },
  reviveButton: {},
  iapButton: {},
  continueButton: {},
  newLifeButton: {},
  disabledButton: {
    opacity: 0.5,
  },
  // Children Selection Styles
  childrenNote: {
    fontSize: fontScale(12),
    color: '#6B7280',
    marginBottom: scale(12),
    fontStyle: 'italic',
    lineHeight: fontScale(16),
  },
  childrenNoteDark: {
    color: '#9CA3AF',
  },
  childrenList: {
    gap: scale(12),
  },
  childCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderRadius: scale(16),
    padding: scale(16),
    borderWidth: 2,
    borderColor: 'transparent',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  childCardDark: {
    backgroundColor: 'rgba(30, 41, 59, 0.6)',
  },
  childCardSelected: {
    borderColor: '#6366F1',
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
  },
  childCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: scale(12),
  },
  childImage: {
    width: scale(56),
    height: scale(56),
    borderRadius: scale(28),
    marginRight: scale(12),
  },
  childInfo: {
    flex: 1,
  },
  childName: {
    fontSize: fontScale(18),
    fontWeight: '700',
    color: '#111827',
    marginBottom: scale(4),
  },
  childNameDark: {
    color: '#F9FAFB',
  },
  childDetails: {
    fontSize: fontScale(13),
    color: '#6B7280',
    marginBottom: scale(6),
  },
  childDetailsDark: {
    color: '#9CA3AF',
  },
  childNetWorthCard: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderRadius: scale(12),
    padding: scale(12),
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.2)',
  },
  childNetWorthCardDark: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  childNetWorthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(8),
    marginBottom: scale(4),
  },
  childNetWorthLabel: {
    fontSize: fontScale(12),
    color: '#6B7280',
    flex: 1,
  },
  childNetWorthLabelDark: {
    color: '#9CA3AF',
  },
  childNetWorthValue: {
    fontSize: fontScale(18),
    fontWeight: '700',
    color: '#10B981',
  },
  childInheritanceText: {
    fontSize: fontScale(11),
    color: '#6B7280',
    marginTop: scale(4),
  },
  childInheritanceTextDark: {
    color: '#9CA3AF',
  },
  noChildrenCard: {
    backgroundColor: 'rgba(243, 244, 246, 0.8)',
    borderRadius: scale(16),
    padding: scale(24),
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.05)',
    borderStyle: 'dashed',
  },
  noChildrenCardDark: {
    backgroundColor: 'rgba(30, 41, 59, 0.4)',
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  noChildrenText: {
    fontSize: fontScale(14),
    color: '#6B7280',
    marginTop: scale(12),
    textAlign: 'center',
    fontStyle: 'italic',
  },
  noChildrenTextDark: {
    color: '#9CA3AF',
  },
  // Heir Selection Styles
  heirHeader: {
    padding: scale(20),
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.05)',
  },
  backButton: {
    marginBottom: scale(16),
    padding: scale(4),
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerIconContainer: {
    width: scale(48),
    height: scale(48),
    borderRadius: scale(24),
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: scale(12),
  },
  headerIconContainerDark: {
    backgroundColor: 'rgba(252, 211, 77, 0.15)',
  },
  heirTitle: {
    fontSize: fontScale(24),
    fontWeight: '700',
    color: '#111827',
    marginBottom: scale(4),
  },
  heirTitleDark: {
    color: '#F9FAFB',
  },
  heirSubtitle: {
    fontSize: fontScale(14),
    color: '#6B7280',
  },
  heirSubtitleDark: {
    color: '#9CA3AF',
  },
  heirNote: {
    fontSize: fontScale(11),
    color: '#6B7280',
    marginTop: scale(4),
    fontStyle: 'italic',
  },
  heirNoteDark: {
    color: '#9CA3AF',
  },
  heirScrollView: {
    flex: 1,
  },
  heirScrollContent: {
    padding: scale(20),
    paddingBottom: scale(16),
  },
  heirCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderRadius: scale(20),
    padding: scale(20),
    marginBottom: scale(16),
    borderWidth: 2,
    borderColor: 'transparent',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  heirCardDark: {
    backgroundColor: 'rgba(30, 41, 59, 0.6)',
  },
  heirCardSelected: {
    borderColor: '#6366F1',
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
  },
  heirCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: scale(16),
  },
  heirImage: {
    width: scale(64),
    height: scale(64),
    borderRadius: scale(32),
    marginRight: scale(16),
  },
  heirInfo: {
    flex: 1,
  },
  heirName: {
    fontSize: fontScale(20),
    fontWeight: '700',
    color: '#111827',
    marginBottom: scale(4),
  },
  heirNameDark: {
    color: '#F9FAFB',
  },
  heirDetails: {
    fontSize: fontScale(14),
    color: '#6B7280',
    marginBottom: scale(8),
  },
  heirDetailsDark: {
    color: '#9CA3AF',
  },
  badgeContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: scale(6),
    marginTop: scale(4),
  },
  badge: {
    paddingHorizontal: scale(10),
    paddingVertical: scale(4),
    borderRadius: scale(8),
  },
  badgeText: {
    fontSize: fontScale(11),
    fontWeight: '600',
  },
  selectedBadge: {
    width: scale(32),
    height: scale(32),
    borderRadius: scale(16),
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  inheritanceCard: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderRadius: scale(12),
    padding: scale(12),
    marginBottom: scale(16),
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.2)',
  },
  inheritanceCardDark: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  inheritanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(8),
  },
  inheritanceLabel: {
    fontSize: fontScale(12),
    color: '#6B7280',
    flex: 1,
  },
  inheritanceLabelDark: {
    color: '#9CA3AF',
  },
  inheritanceValue: {
    fontSize: fontScale(18),
    fontWeight: '700',
    color: '#10B981',
  },
  savingsText: {
    fontSize: fontScale(11),
    color: '#6B7280',
    marginTop: scale(4),
  },
  savingsTextDark: {
    color: '#9CA3AF',
  },
  heirStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: scale(12),
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.05)',
    marginBottom: scale(12),
  },
  heirStatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(6),
  },
  heirStatValue: {
    fontSize: fontScale(14),
    fontWeight: '600',
    color: '#374151',
  },
  heirStatValueDark: {
    color: '#D1D5DB',
  },
  traitsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: scale(6),
  },
  traitBadge: {
    paddingHorizontal: scale(10),
    paddingVertical: scale(4),
    borderRadius: scale(8),
  },
  traitText: {
    fontSize: fontScale(11),
    fontWeight: '600',
  },
  mindsetSection: {
    padding: scale(20),
    paddingTop: scale(16),
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.05)',
  },
  mindsetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(8),
    marginBottom: scale(12),
  },
  mindsetTitle: {
    fontSize: fontScale(16),
    fontWeight: '700',
    color: '#111827',
  },
  mindsetTitleDark: {
    color: '#F9FAFB',
  },
  mindsetScroll: {
    maxHeight: scale(120),
  },
  mindsetScrollContent: {
    gap: scale(8),
    paddingRight: scale(8),
  },
  mindsetOption: {
    minWidth: scale(120),
    padding: scale(12),
    borderRadius: scale(12),
    backgroundColor: 'rgba(243, 244, 246, 0.8)',
    borderWidth: 2,
    borderColor: 'transparent',
    alignItems: 'center',
    position: 'relative',
  },
  mindsetOptionDark: {
    backgroundColor: 'rgba(30, 41, 59, 0.6)',
  },
  mindsetOptionSelected: {
    borderColor: '#8B5CF6',
    backgroundColor: 'rgba(139, 92, 246, 0.1)',
  },
  mindsetIcon: {
    width: scale(40),
    height: scale(40),
    marginBottom: scale(8),
  },
  mindsetOptionName: {
    fontSize: fontScale(12),
    fontWeight: '600',
    color: '#111827',
  },
  mindsetOptionNameDark: {
    color: '#D1D5DB',
  },
  mindsetOptionNameSelected: {
    color: '#8B5CF6',
  },
  mindsetCheck: {
    position: 'absolute',
    top: scale(8),
    right: scale(8),
    width: scale(20),
    height: scale(20),
    borderRadius: scale(10),
    backgroundColor: '#8B5CF6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  heirActions: {
    padding: scale(20),
    paddingTop: scale(16),
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.05)',
  },
  confirmButton: {
    borderRadius: scale(14),
    overflow: 'hidden',
  },
  // Prestige preview styles
  prestigePreviewCard: {
    backgroundColor: 'rgba(245, 158, 11, 0.08)',
    borderRadius: scale(12),
    padding: scale(16),
    alignItems: 'center' as const,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.2)',
  },
  prestigePreviewCardDark: {
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderColor: 'rgba(245, 158, 11, 0.25)',
  },
  prestigePointsValue: {
    fontSize: fontScale(28),
    fontWeight: '800' as const,
    color: '#F59E0B',
    marginBottom: scale(4),
  },
  prestigeHint: {
    fontSize: fontScale(12),
    color: '#6B7280',
    textAlign: 'center' as const,
    marginBottom: scale(12),
  },
  prestigeHintDark: {
    color: '#9CA3AF',
  },
  prestigeBuyList: {
    width: '100%',
    gap: scale(8),
  },
  prestigeBuyItem: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: scale(8),
    paddingVertical: scale(4),
  },
  prestigeBuyText: {
    fontSize: fontScale(12),
    color: '#374151',
    flex: 1,
  },
  prestigeBuyTextDark: {
    color: '#D1D5DB',
  },
  ribbonBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: scale(14),
    marginHorizontal: scale(16),
    marginBottom: scale(12),
    borderRadius: scale(12),
    borderWidth: 2,
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  ribbonEmoji: {
    fontSize: fontScale(36),
    marginRight: scale(12),
  },
  ribbonTextContainer: {
    flex: 1,
  },
  ribbonName: {
    fontSize: fontScale(18),
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  ribbonDesc: {
    fontSize: fontScale(12),
    color: '#6B7280',
    marginTop: scale(2),
  },
  rewindSection: {
    marginTop: scale(8),
    padding: scale(12),
    backgroundColor: 'rgba(245, 158, 11, 0.08)',
    borderRadius: scale(10),
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.2)',
  },
  rewindTitle: {
    fontSize: fontScale(13),
    fontWeight: '700',
    color: '#F59E0B',
    textAlign: 'center',
    marginBottom: scale(8),
  },
  rewindChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(6),
    paddingVertical: scale(8),
    paddingHorizontal: scale(12),
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderRadius: scale(8),
    marginBottom: scale(4),
  },
  rewindChipText: {
    fontSize: fontScale(13),
    fontWeight: '600',
    color: '#F59E0B',
  },
});

export default React.memo(DeathPopup);
