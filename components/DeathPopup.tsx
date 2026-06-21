import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { Modal, View, Text, TouchableOpacity, Animated, ScrollView, Image, Alert, Share } from 'react-native';
import LinearGradientFallback from '@/components/fallbacks/LinearGradientFallback';
import { lazyAsyncStorage as AsyncStorage } from '@/utils/storageWrapper';
import { useRouter } from 'expo-router';
import { useGame } from '@/contexts/GameContext';
import { safeSettings, safeStats, safeDate, safeUserProfile } from '@/utils/safeGameState';
import { Skull, Heart, RotateCcw, Brain, Check, Crown, Sparkles, TrendingUp, DollarSign, Users, Award, Briefcase, GraduationCap, Home, Building2, Trophy, Calendar, BookOpen, Share2 } from 'lucide-react-native';
import PrestigeModal from './PrestigeModal';
import { getCharacterImage } from '@/utils/characterImages';
import { HeirGenerator } from '@/lib/legacy/heirGeneration';
import { computeInheritance } from '@/lib/legacy/inheritance';
import { simulateChildrenToAdulthood } from '@/lib/legacy/childSimulation';
import { MindsetId } from '@/lib/mindset/config';
import { logger } from '@/utils/logger';
import { formatMoney } from '@/utils/moneyFormatting';
import { REVIVE_GEM_COST, WEEKS_PER_YEAR } from '@/lib/config/gameConstants';
import { getThemeColors, accent, colors as theme } from '@/lib/config/theme';
import LifeStoryModal from './LifeStoryModal';
import { createStyles } from '@/components/DeathPopupStyles';
const LinearGradient = LinearGradientFallback;

function DeathPopup() {
  const { gameState, setGameState, startNewLifeFromLegacy, reviveCharacter, currentSlot, saveGame } = useGame();
  const router = useRouter();
  // R2-A: death is the worst place to crash — onRequestClose is gated, so a
  // settings/stats/date NPE soft-locks the player. Pull through safe accessors.
  const settings = safeSettings(gameState);
  const date = safeDate(gameState);
  const { deathReason } = gameState;

  const [showLifeStory, setShowLifeStory] = useState(false);
  const [selectedHeirId, setSelectedHeirId] = useState<string | null>(null);
  const [selectedMindset] = useState<MindsetId | null>(
    (gameState.mindset?.activeTraitId as MindsetId | null) || null
  );
  const [showPrestigeModal, setShowPrestigeModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'summary' | 'legacy'>('summary');

  // Theme-aware styles + color tokens (lib/config/theme.ts). Rebuilt only when
  // the player toggles dark mode so colors stay centrally managed.
  const styles = useMemo(() => createStyles(settings.darkMode), [settings.darkMode]);
  const c = getThemeColors(settings.darkMode);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;

  // P1-6: depend on specific fields rather than the whole gameState object —
  // computeInheritance walks money + bank + properties + stocks, so the
  // recompute is expensive and we don't want it firing on every unrelated save.
  const inheritanceSummary = useMemo(() => {
    return computeInheritance(gameState);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    gameState.stats?.money,
    gameState.bankSavings,
    gameState.realEstate,
    gameState.stocks?.holdings,
    gameState.loans,
  ]);

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

  const checkpoints = useMemo(() => gameState.checkpoints ?? [], [gameState.checkpoints]);
  const rewindCost = useMemo(() => {
    try {
      const { getRewindCost } = require('@/lib/timeMachine/checkpointSystem');
      return getRewindCost(gameState.timeMachineUsesThisLife ?? 0, !!gameState.goldUpgrades?.time_machine);
    } catch {
      return 500;
    }
  }, [gameState.timeMachineUsesThisLife, gameState.goldUpgrades?.time_machine]);
  const lifeRibbon = useMemo(() => {
    try {
      const { classifyLife } = require('@/lib/legacy/ribbonSystem');
      return classifyLife(gameState);
    } catch {
      return null;
    }
  }, [gameState]);

  const handleContinueLegacy = useCallback(async () => {
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
  }, [selectedHeirId, selectedMindset, startNewLifeFromLegacy, setGameState, saveGame]);

  const handleRevive = useCallback(() => {
    const reviveCost = REVIVE_GEM_COST;
    if (safeStats(gameState).gems >= reviveCost) {
      reviveCharacter();
    }
  }, [gameState, reviveCharacter]);

  const handleRewind = useCallback((checkpointId: string) => {
    try {
      const { rewindToCheckpoint, getRewindCost } = require('@/lib/timeMachine/checkpointSystem');
      const cost = getRewindCost(gameState.timeMachineUsesThisLife ?? 0, !!gameState.goldUpgrades?.time_machine);
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
  }, [gameState, setGameState, saveGame]);

  const handleStartNewGame = useCallback(async () => {
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
  }, [setGameState, currentSlot, router]);

  const handleShareObituary = useCallback(async () => {
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
  }, [gameState]);

  // Memoized handlers for the tab bar + secondary actions (passed to children).
  const handleSelectSummaryTab = useCallback(() => setActiveTab('summary'), []);
  const handleSelectLegacyTab = useCallback(() => setActiveTab('legacy'), []);
  const handleShowLifeStory = useCallback(() => setShowLifeStory(true), []);
  const handleHideLifeStory = useCallback(() => setShowLifeStory(false), []);
  const handleHidePrestige = useCallback(() => setShowPrestigeModal(false), []);

  if (!gameState.showDeathPopup) return null;

  const age = Math.floor(date.age);
  const weeksLived = gameState.weeksLived || 0;
  const yearsLived = Math.floor(weeksLived / WEEKS_PER_YEAR);

  // Enhanced death messages
  const deathTitleMessages = {
    health: ['You Died', 'Your body could no longer carry on'],
    happiness: ['You Died', 'The weight of life became too much'],
    age: ['A Long Life', `${age} years well lived`],
    default: ['You Died', 'Your journey has come to an end'],
  };

  const deathTitle = deathReason === 'health'
    ? deathTitleMessages.health[0]
    : deathReason === 'happiness'
    ? deathTitleMessages.happiness[0]
    : deathReason === 'age'
    ? deathTitleMessages.age[0]
    : deathTitleMessages.default[0];

  const deathSubtitle = deathReason === 'health'
    ? deathTitleMessages.health[1]
    : deathReason === 'happiness'
    ? deathTitleMessages.happiness[1]
    : deathReason === 'age'
    ? deathTitleMessages.age[1]
    : deathTitleMessages.default[1];

  const deathMessage =
    deathReason === 'health'
      ? 'Your body finally gave out.'
      : deathReason === 'happiness'
      ? 'You lost the will to go on.'
      : deathReason === 'age'
      ? 'You passed away peacefully of natural causes.'
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
    ? gameState.careers?.find(job => job.id === gameState.currentJob) || gameState.streetJobs?.find(j => j.id === gameState.currentJob)
    : null;

  const ownedProperties = (gameState.realEstate || []).filter(p => p.owned);
  const ownedCompanies = gameState.companies || [];

  const spouse = gameState.family?.spouse;
  const children = gameState.family?.children || [];

  const totalNetWorth = inheritanceSummary.totalNetWorth;

  // Additional life statistics
  const lifetimeStats = gameState.prestige?.lifetimeStats;
  const totalRelationships = (gameState.relationships || []).length;
  const maxNetWorth = lifetimeStats?.maxNetWorth || totalNetWorth;

  // Calculate career level if available
  const careerLevel = currentJob && 'level' in currentJob && typeof currentJob.level === 'number'
    ? currentJob.level + 1
    : null;

  const canAffordRewind = (gameState.stats?.gems ?? 0) >= rewindCost;

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
          {(
            <LinearGradient
              colors={[c.background, c.surface, c.surfaceElevated]}
              style={styles.card}
            >
              {/* Fixed header — identity of the screen, shown on both tabs */}
              <View style={styles.fixedHeader}>
                <View style={styles.header}>
                  <View style={styles.iconContainer}>
                    <Skull size={40} color={c.text} />
                  </View>
                  <View style={styles.headerText}>
                    <Text style={styles.mainTitle}>
                      {deathTitle}
                    </Text>
                    <Text style={styles.subtitle}>
                      {deathSubtitle}
                    </Text>
                    <Text style={styles.nameText}>
                      {safeUserProfile(gameState).name || 'Unknown Soul'}
                    </Text>
                    <Text style={styles.details}>
                      Age {age} • {yearsLived > 0 ? `${yearsLived} years lived` : `${weeksLived} weeks lived`} • {deathMessage}
                    </Text>
                  </View>
                </View>

                {/* Life Ribbon */}
                {lifeRibbon && (
                  <View style={[styles.ribbonBanner, { borderColor: lifeRibbon.color }]}>
                    <View style={styles.ribbonTextContainer}>
                      <Text style={[styles.ribbonName, { color: lifeRibbon.color }]}>
                        {lifeRibbon.hidden && !gameState.ribbonCollection?.discoveredIds?.includes(lifeRibbon.id)
                          ? 'NEW RIBBON DISCOVERED!'
                          : lifeRibbon.name}
                      </Text>
                      <Text style={styles.ribbonDesc}>
                        {lifeRibbon.description}
                      </Text>
                    </View>
                  </View>
                )}
              </View>

              {/* Tab bar */}
              <View style={styles.tabRow}>
                <TouchableOpacity
                  style={styles.tabBtn}
                  onPress={handleSelectSummaryTab}
                  activeOpacity={0.7}
                >
                  <View style={styles.tabContent}>
                    <Sparkles size={15} color={activeTab === 'summary' ? c.text : c.textSecondary} />
                    <Text style={[styles.tabLabel, activeTab === 'summary' && styles.tabLabelActive]}>
                      Summary
                    </Text>
                  </View>
                  {activeTab === 'summary' && <View style={[styles.tabUnderline, { backgroundColor: theme.palette.fitness }]} />}
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.tabBtn}
                  onPress={handleSelectLegacyTab}
                  activeOpacity={0.7}
                >
                  <View style={styles.tabContent}>
                    <Crown size={15} color={activeTab === 'legacy' ? c.text : c.textSecondary} />
                    <Text style={[styles.tabLabel, activeTab === 'legacy' && styles.tabLabelActive]}>
                      Legacy
                    </Text>
                  </View>
                  {activeTab === 'legacy' && <View style={[styles.tabUnderline, { backgroundColor: theme.palette.primary }]} />}
                </TouchableOpacity>
              </View>

              <View style={styles.scrollContainer}>
                <ScrollView
                  style={styles.scrollView}
                  contentContainerStyle={styles.scrollContent}
                  showsVerticalScrollIndicator={true}
                  nestedScrollEnabled={true}
                  bounces={true}
                >
                {activeTab === 'summary' && (
                <>
                {/* Life Summary Section */}
                <View style={styles.section}>
                  <View style={styles.sectionHeader}>
                    <Sparkles size={20} color={settings.darkMode ? accent.gold : accent.warning} />
                    <Text style={styles.sectionTitle}>
                      Life Summary
                    </Text>
                  </View>

                  <View style={styles.summaryCard}>
                    {/* Career */}
                    {currentJob && (
                      <View style={styles.summaryRow}>
                        <View style={[styles.summaryIconContainer, { backgroundColor: 'rgba(59, 130, 246, 0.1)' }]}>
                          <Briefcase size={18} color={accent.info} />
                        </View>
                        <View style={styles.summaryContent}>
                          <Text style={styles.summaryLabel}>
                            Final Career
                          </Text>
                          <Text style={styles.summaryValue}>
                            {('name' in currentJob ? currentJob.name : currentJob.levels?.[currentJob.level]?.name) || 'Unknown'}
                          </Text>
                        </View>
                      </View>
                    )}

                    {/* Education */}
                    {highestEducation && (
                      <View style={styles.summaryRow}>
                        <View style={[styles.summaryIconContainer, { backgroundColor: 'rgba(139, 92, 246, 0.1)' }]}>
                          <GraduationCap size={18} color={theme.palette.fitness} />
                        </View>
                        <View style={styles.summaryContent}>
                          <Text style={styles.summaryLabel}>
                            Education
                          </Text>
                          <Text style={styles.summaryValue}>
                            {highestEducation.name || 'None'}
                          </Text>
                        </View>
                      </View>
                    )}

                    {/* Family */}
                    <View style={styles.summaryRow}>
                      <View style={[styles.summaryIconContainer, { backgroundColor: 'rgba(236, 72, 153, 0.1)' }]}>
                        <Users size={18} color={theme.palette.reputation} />
                      </View>
                      <View style={styles.summaryContent}>
                        <Text style={styles.summaryLabel}>
                          Family
                        </Text>
                        <Text style={styles.summaryValue}>
                          {spouse ? `Married to ${spouse.name}` : 'Single'} • {children.length} {children.length === 1 ? 'child' : 'children'}
                        </Text>
                      </View>
                    </View>

                    {/* Properties */}
                    {ownedProperties.length > 0 && (
                      <View style={styles.summaryRow}>
                        <View style={[styles.summaryIconContainer, { backgroundColor: 'rgba(16, 185, 129, 0.1)' }]}>
                          <Home size={18} color={accent.success} />
                        </View>
                        <View style={styles.summaryContent}>
                          <Text style={styles.summaryLabel}>
                            Properties Owned
                          </Text>
                          <Text style={styles.summaryValue}>
                            {ownedProperties.length} {ownedProperties.length === 1 ? 'property' : 'properties'}
                          </Text>
                        </View>
                      </View>
                    )}

                    {/* Companies */}
                    {ownedCompanies.length > 0 && (
                      <View style={styles.summaryRow}>
                        <View style={[styles.summaryIconContainer, { backgroundColor: 'rgba(245, 158, 11, 0.1)' }]}>
                          <Building2 size={18} color={accent.warning} />
                        </View>
                        <View style={styles.summaryContent}>
                          <Text style={styles.summaryLabel}>
                            Companies Owned
                          </Text>
                          <Text style={styles.summaryValue}>
                            {ownedCompanies.length} {ownedCompanies.length === 1 ? 'company' : 'companies'}
                          </Text>
                        </View>
                      </View>
                    )}

                    {/* Achievements */}
                    {totalAchievements > 0 && (
                      <View style={styles.summaryRow}>
                        <View style={[styles.summaryIconContainer, { backgroundColor: 'rgba(168, 85, 247, 0.1)' }]}>
                          <Trophy size={18} color={accent.purple} />
                        </View>
                        <View style={styles.summaryContent}>
                          <Text style={styles.summaryLabel}>
                            Achievements
                          </Text>
                          <Text style={styles.summaryValue}>
                            {totalAchievements} {totalAchievements === 1 ? 'achievement' : 'achievements'} unlocked
                          </Text>
                        </View>
                      </View>
                    )}

                    {/* Top Achievements */}
                    {topAchievements.length > 0 && (
                      <View style={styles.achievementsList}>
                        {topAchievements.map((ach, idx) => (
                          <View key={ach.id || idx} style={styles.achievementBadge}>
                            <Trophy size={12} color={accent.warning} />
                            <Text style={styles.achievementText}>
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
                  <View style={styles.statCard}>
                    <View style={[styles.statIconContainer, { backgroundColor: 'rgba(16, 185, 129, 0.1)' }]}>
                      <DollarSign size={20} color={accent.success} />
                    </View>
                    <View style={styles.statContent}>
                      <Text style={styles.statLabel}>Net Worth</Text>
                      <Text style={styles.statValue}>
                        {formatMoney(inheritanceSummary.totalNetWorth)}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.statCard}>
                    <View style={[styles.statIconContainer, { backgroundColor: 'rgba(139, 92, 246, 0.1)' }]}>
                      <Crown size={20} color={theme.palette.fitness} />
                    </View>
                    <View style={styles.statContent}>
                      <Text style={styles.statLabel}>Generation</Text>
                      <Text style={styles.statValue}>
                        {gameState.generationNumber || 1}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Life Statistics */}
                <View style={styles.section}>
                  <View style={styles.sectionHeader}>
                    <Calendar size={20} color={settings.darkMode ? theme.palette.fitness : theme.palette.primary} />
                    <Text style={styles.sectionTitle}>
                      Life Statistics
                    </Text>
                  </View>

                  <View style={styles.statsGrid}>
                    <View style={styles.statBox}>
                      <Text style={styles.statBoxLabel}>Weeks Lived</Text>
                      <Text style={styles.statBoxValue}>
                        {weeksLived}
                      </Text>
                    </View>

                    <View style={styles.statBox}>
                      <Text style={styles.statBoxLabel}>Relationships</Text>
                      <Text style={styles.statBoxValue}>
                        {totalRelationships}
                      </Text>
                    </View>

                    {careerLevel && (
                      <View style={styles.statBox}>
                        <Text style={styles.statBoxLabel}>Career Level</Text>
                        <Text style={styles.statBoxValue}>
                          {careerLevel}
                        </Text>
                      </View>
                    )}

                    <View style={styles.statBox}>
                      <Text style={styles.statBoxLabel}>Peak Net Worth</Text>
                      <Text style={styles.statBoxValue}>
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
                        <Crown size={20} color={accent.warning} />
                        <Text style={styles.sectionTitle}>
                          Prestige Points Earned
                        </Text>
                      </View>
                      <View style={styles.prestigePreviewCard}>
                        <Text style={styles.prestigePointsValue}>
                          {earnedPoints.toLocaleString()} pts
                        </Text>
                        <Text style={styles.prestigeHint}>
                          Use prestige points to start your next life stronger
                        </Text>
                        <View style={styles.prestigeBuyList}>
                          {canBuySmallInheritance && (
                            <View style={styles.prestigeBuyItem}>
                              <DollarSign size={14} color={accent.success} />
                              <Text style={styles.prestigeBuyText}>
                                +$10,000 starting money (500 pts)
                              </Text>
                            </View>
                          )}
                          {canBuyStatBoost && (
                            <View style={styles.prestigeBuyItem}>
                              <TrendingUp size={14} color={accent.info} />
                              <Text style={styles.prestigeBuyText}>
                                +5 to all starting stats (1,000 pts)
                              </Text>
                            </View>
                          )}
                          {canBuyModestInheritance && (
                            <View style={styles.prestigeBuyItem}>
                              <Sparkles size={14} color={accent.warning} />
                              <Text style={styles.prestigeBuyText}>
                                +$50,000 starting money (2,000 pts)
                              </Text>
                            </View>
                          )}
                        </View>
                      </View>
                    </View>
                  ) : null;
                })()}
                </>
                )}

                {activeTab === 'legacy' && (
                <>
                {/* Inheritance Breakdown */}
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>
                    Inheritance Breakdown
                  </Text>

                  <View style={styles.breakdownCard}>
                    <View style={styles.breakdownRow}>
                      <Text style={styles.breakdownLabel}>Cash</Text>
                      <Text style={styles.breakdownValue}>
                        {formatMoney(inheritanceSummary.cash)}
                      </Text>
                    </View>

                    <View style={styles.breakdownRow}>
                      <Text style={styles.breakdownLabel}>Savings</Text>
                      <Text style={styles.breakdownValue}>
                        {formatMoney(inheritanceSummary.bankSavings)}
                      </Text>
                    </View>

                    {inheritanceSummary.realEstateIds.length > 0 && (
                      <View style={styles.breakdownRow}>
                        <Text style={styles.breakdownLabel}>Properties</Text>
                        <Text style={styles.breakdownValue}>
                          {inheritanceSummary.realEstateIds.length}
                        </Text>
                      </View>
                    )}

                    {inheritanceSummary.companyIds.length > 0 && (
                      <View style={styles.breakdownRow}>
                        <Text style={styles.breakdownLabel}>Companies</Text>
                        <Text style={styles.breakdownValue}>
                          {inheritanceSummary.companyIds.length}
                        </Text>
                      </View>
                    )}

                    {inheritanceSummary.debts > 0 && (
                      <View style={styles.breakdownRow}>
                        <Text style={[styles.breakdownLabel, { color: accent.danger }]}>Debts</Text>
                        <Text style={[styles.breakdownValue, { color: accent.danger }]}>
                          -{formatMoney(inheritanceSummary.debts)}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>

                {/* Legacy Bonuses */}
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>
                    Legacy Bonuses
                  </Text>

                  <View style={styles.bonusesCard}>
                    <View style={styles.bonusItem}>
                      <View style={[styles.bonusIconContainer, { backgroundColor: 'rgba(16, 185, 129, 0.1)' }]}>
                        <TrendingUp size={16} color={accent.success} />
                      </View>
                      <View style={styles.bonusContent}>
                        <Text style={styles.bonusLabel}>Income</Text>
                        <Text style={styles.bonusValue}>
                          +{((inheritanceSummary.legacyBonuses.incomeMultiplier - 1) * 100).toFixed(1)}%
                        </Text>
                      </View>
                    </View>

                    <View style={styles.bonusItem}>
                      <View style={[styles.bonusIconContainer, { backgroundColor: 'rgba(139, 92, 246, 0.1)' }]}>
                        <Brain size={16} color={theme.palette.fitness} />
                      </View>
                      <View style={styles.bonusContent}>
                        <Text style={styles.bonusLabel}>Learning</Text>
                        <Text style={styles.bonusValue}>
                          +{((inheritanceSummary.legacyBonuses.learningMultiplier - 1) * 100).toFixed(1)}%
                        </Text>
                      </View>
                    </View>

                    <View style={styles.bonusItem}>
                      <View style={[styles.bonusIconContainer, { backgroundColor: 'rgba(59, 130, 246, 0.1)' }]}>
                        <Award size={16} color={accent.info} />
                      </View>
                      <View style={styles.bonusContent}>
                        <Text style={styles.bonusLabel}>Reputation</Text>
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
                    <Users size={20} color={theme.palette.reputation} />
                    <Text style={styles.sectionTitle}>
                      Continue Legacy
                    </Text>
                  </View>

                  {heirs.length > 0 ? (
                    <>
                      <Text style={styles.childrenNote}>
                        Select a child to continue your legacy. Children under 18 will be simulated to age 18.
                      </Text>
                      <View style={styles.childrenList}>
                        {heirs.map(({ child, inheritance, educationLevel, careerPath, savings, age }) => {
                          const isSelected = selectedHeirId === child.id;
                          const childTotalNetWorth = inheritance + savings;

                          return (
                            <TouchableOpacity
                              key={child.id}
                              style={[
                                styles.childCard,
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
                                  <Text style={styles.childName}>
                                    {child.name}
                                  </Text>
                                  <Text style={styles.childDetails}>
                                    Age {age} • {child.gender === 'male' ? 'Son' : 'Daughter'}
                                  </Text>
                                  {educationLevel && educationLevel !== 'none' && (
                                    <View style={styles.badgeContainer}>
                                      <View style={[styles.badge, { backgroundColor: 'rgba(59, 130, 246, 0.1)' }]}>
                                        <Text style={[styles.badgeText, { color: accent.info }]}>
                                          {educationLevel === 'university' ? 'University' :
                                           educationLevel === 'specialized' ? 'Specialized' : 'High School'}
                                        </Text>
                                      </View>
                                    </View>
                                  )}
                                  {careerPath && (
                                    <View style={styles.badgeContainer}>
                                      <View style={[styles.badge, { backgroundColor: 'rgba(139, 92, 246, 0.1)' }]}>
                                        <Text style={[styles.badgeText, { color: theme.palette.fitness }]}>
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
                                    <Check size={20} color={accent.success} />
                                  </View>
                                )}
                              </View>

                              <View style={styles.childNetWorthCard}>
                                <View style={styles.childNetWorthRow}>
                                  <DollarSign size={16} color={accent.success} />
                                  <Text style={styles.childNetWorthLabel}>
                                    Net Worth
                                  </Text>
                                  <Text style={styles.childNetWorthValue}>
                                    {formatMoney(childTotalNetWorth)}
                                  </Text>
                                </View>
                                {inheritance > 0 && (
                                  <Text style={styles.childInheritanceText}>
                                    Inheritance: {formatMoney(inheritance)}
                                  </Text>
                                )}
                                {savings > 0 && (
                                  <Text style={styles.childInheritanceText}>
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
                    <View style={styles.noChildrenCard}>
                      <Users size={32} color={c.textSecondary} />
                      <Text style={styles.noChildrenText}>
                        You have no children to continue your legacy.
                      </Text>
                    </View>
                  )}
                </View>
                </>
                )}
                </ScrollView>
              </View>

              {/* Actions */}
              <View style={styles.actions}>
                <TouchableOpacity
                  style={[styles.actionButton, styles.reviveButton, safeStats(gameState).gems < REVIVE_GEM_COST && styles.disabledButton]}
                  onPress={handleRevive}
                  disabled={safeStats(gameState).gems < REVIVE_GEM_COST}
                  activeOpacity={0.8}
                >
                  <LinearGradient
                    colors={safeStats(gameState).gems >= REVIVE_GEM_COST ? [accent.success, '#059669'] : ['#9CA3AF', '#6B7280']}
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
                    <Text style={styles.rewindTitle}>
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
                        <RotateCcw size={14} color={canAffordRewind ? accent.warning : c.textSecondary} />
                        <Text style={[styles.rewindChipText, !canAffordRewind && { color: c.textSecondary }]}>
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
                    colors={(heirs.length === 0 || !selectedHeirId) ? ['#9CA3AF', '#6B7280'] : [theme.palette.primary, theme.palette.primaryDark]}
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

                {/* Secondary actions — compact row */}
                <View style={styles.secondaryRow}>
                  <TouchableOpacity
                    style={styles.secondaryButton}
                    onPress={handleShowLifeStory}
                    activeOpacity={0.8}
                  >
                    <BookOpen size={16} color={c.text} />
                    <Text style={styles.secondaryButtonText}>
                      Read Story
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.secondaryButton}
                    onPress={handleShareObituary}
                    activeOpacity={0.8}
                  >
                    <Share2 size={16} color={c.text} />
                    <Text style={styles.secondaryButtonText}>
                      Share
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </LinearGradient>
          )}
        </Animated.View>
      </View>
    </Modal>
    <LifeStoryModal visible={showLifeStory} onClose={handleHideLifeStory} />
    <PrestigeModal
      visible={showPrestigeModal}
      onClose={handleHidePrestige}
    />
    </>
  );
}


export default React.memo(DeathPopup);
