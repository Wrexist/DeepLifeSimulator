import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { Modal, View, Text, TouchableOpacity, Animated, ScrollView, Image, Alert, Share } from 'react-native';
import LinearGradientFallback from '@/components/fallbacks/LinearGradientFallback';
import { lazyAsyncStorage as AsyncStorage } from '@/utils/storageWrapper';
import { useRouter } from 'expo-router';
import { useGame } from '@/contexts/GameContext';
import { useGemStore } from '@/contexts/GemStoreContext';
import { safeSettings, safeStats, safeDate, safeUserProfile } from '@/utils/safeGameState';
import { Skull, Heart, RotateCcw, Brain, Check, Crown, Sparkles, TrendingUp, DollarSign, Users, Award, Briefcase, GraduationCap, Home, Building2, Trophy, Calendar, BookOpen, Share2, Gem } from 'lucide-react-native';
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
  // App-level IAP store launcher — used to bridge out of "not enough gems"
  // dead-ends (revive / rewind) without auto-opening or blocking the death flow.
  // `isStoreOpen` lets the death Modal SUPPRESS itself while the store's own RN
  // Modal is presented (stacked-modal safety), then re-present when it closes.
  const { openStore, isStoreOpen } = useGemStore();
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

  // ── Store bridge (stacked-modal safety) ────────────────────────────────────
  // The gem store is an app-root RN Modal. Opening it while THIS death Modal is
  // still presented is the exact iOS stacked-modal hazard this PR fixed for the
  // rewarded ad + LuxuryApp sheet. So we SUPPRESS the death Modal first
  // (visible → false via a local flag), let its native teardown settle, then
  // open the store from the Modal's onDismiss — with a tracked-timer fallback
  // for Android (no onDismiss). When the store closes, `isStoreOpen` flips false
  // and the death Modal re-presents automatically; its state lives in game state
  // (showDeathPopup), so re-showing is clean and loses nothing.
  const [storeBridging, setStoreBridging] = useState(false);
  const pendingStoreRef = useRef(false);
  const storeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flushPendingStore = useCallback(() => {
    if (!pendingStoreRef.current) return;
    pendingStoreRef.current = false;
    if (storeTimerRef.current) {
      clearTimeout(storeTimerRef.current);
      storeTimerRef.current = null;
    }
    openStore('gems');
  }, [openStore]);

  // Quiet bridge for the out-of-gems dead-ends: flip suppression + arm the
  // fallback so the death Modal dismisses, THEN the store opens. Never
  // auto-invoked — only fired by an explicit tap.
  const bridgeToStore = useCallback(() => {
    pendingStoreRef.current = true;
    setStoreBridging(true);
    if (storeTimerRef.current) clearTimeout(storeTimerRef.current);
    storeTimerRef.current = setTimeout(flushPendingStore, 600);
  }, [flushPendingStore]);

  const handleGetMoreGems = useCallback(() => bridgeToStore(), [bridgeToStore]);

  // Re-present the death Modal once the store closes. The bridge flag is cleared
  // only when the store is DOWN, so `visible` never flickers true mid-bridge.
  useEffect(() => {
    if (!isStoreOpen) setStoreBridging(false);
  }, [isStoreOpen]);

  // Cancel any pending fallback on unmount.
  useEffect(
    () => () => {
      if (storeTimerRef.current) clearTimeout(storeTimerRef.current);
      pendingStoreRef.current = false;
    },
    [],
  );

  const handleRewind = useCallback((checkpointId: string) => {
    try {
      const { rewindToCheckpoint, getRewindCost } = require('@/lib/timeMachine/checkpointSystem');
      const cost = getRewindCost(gameState.timeMachineUsesThisLife ?? 0, !!gameState.goldUpgrades?.time_machine);
      const gems = gameState.stats?.gems ?? 0;
      if (gems < cost) {
        Alert.alert(
          'Not Enough Gems',
          `You need ${cost.toLocaleString()} gems to rewind.`,
          [
            { text: 'Not now', style: 'cancel' },
            // Same pending+dismiss bridge as the revive path — the native Alert
            // dismisses on button press, then the death Modal suppresses and the
            // store opens once teardown settles.
            { text: 'Get Gems', onPress: () => bridgeToStore() },
          ]
        );
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
  }, [gameState, setGameState, saveGame, bridgeToStore]);

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
        // Clear the cached slot summary too so SaveSlots can't show the dead
        // character as a playable slot. AWAITED before the navigation below —
        // the next screen reads this cache, so the invalidation must land
        // first. Errors swallowed (must not block starting the new life).
        await import('@/utils/saveSlotMeta').then((m) => m.deleteSaveSlotMeta(currentSlot)).catch(() => {});
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

  const canAffordRevive = safeStats(gameState).gems >= REVIVE_GEM_COST;
  const canAffordRewind = (gameState.stats?.gems ?? 0) >= rewindCost;
  const canContinueLegacy = heirs.length > 0 && !!selectedHeirId;

  // Shared secondary action row (Read Story + Share) — appears in both footers.
  const secondaryActions = (
    <View style={styles.secondaryRow}>
      <TouchableOpacity
        style={styles.secondaryButton}
        onPress={handleShowLifeStory}
        activeOpacity={0.8}
      >
        <BookOpen size={16} color={c.text} />
        <Text style={styles.secondaryButtonText}>Read Story</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.secondaryButton}
        onPress={handleShareObituary}
        activeOpacity={0.8}
      >
        <Share2 size={16} color={c.text} />
        <Text style={styles.secondaryButtonText}>Share</Text>
      </TouchableOpacity>
    </View>
  );

  // Universal "fresh start" button — present on both pages so the player can
  // always move forward regardless of which tab they're on.
  const startNewLifeButton = (
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
  );

  return (
    <>
    <Modal
      visible={!isStoreOpen && !storeBridging}
      transparent
      animationType="fade"
      statusBarTranslucent={true}
      presentationStyle="overFullScreen"
      hardwareAccelerated={true}
      onDismiss={flushPendingStore}
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
          <LinearGradient
            colors={[c.background, c.surface, c.surfaceElevated]}
            style={styles.card}
          >
            {/* Compact identity strip — persistent across both pages */}
            <View style={styles.identityHeader}>
              <View style={styles.identityIcon}>
                <Skull size={26} color={c.text} />
              </View>
              <View style={styles.identityText}>
                <Text style={styles.identityTitle} numberOfLines={1}>
                  {deathTitle}
                </Text>
                <Text style={styles.identityName} numberOfLines={1}>
                  {safeUserProfile(gameState).name || 'Unknown Soul'}
                </Text>
                <Text style={styles.identityDetails} numberOfLines={1}>
                  Age {age} • {yearsLived > 0 ? `${yearsLived} yrs` : `${weeksLived} wks`} lived
                </Text>
              </View>
            </View>

            {/* TOP MENU BAR — segmented control switching between the two pages */}
            <View style={styles.topBar}>
              <View style={styles.segmented}>
                <TouchableOpacity
                  style={[styles.segment, activeTab === 'summary' && styles.segmentActive]}
                  onPress={handleSelectSummaryTab}
                  activeOpacity={0.8}
                >
                  <Sparkles size={15} color={activeTab === 'summary' ? '#FFF' : c.textSecondary} />
                  <Text style={[styles.segmentText, activeTab === 'summary' && styles.segmentTextActive]}>
                    Summary
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.segment, activeTab === 'legacy' && styles.segmentActive]}
                  onPress={handleSelectLegacyTab}
                  activeOpacity={0.8}
                >
                  <Crown size={15} color={activeTab === 'legacy' ? '#FFF' : c.textSecondary} />
                  <Text style={[styles.segmentText, activeTab === 'legacy' && styles.segmentTextActive]}>
                    Legacy
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* ───────────────────────────── SUMMARY PAGE ───────────────────────────── */}
            {activeTab === 'summary' && (
              <View style={styles.page}>
                <ScrollView
                  style={styles.scrollView}
                  contentContainerStyle={styles.scrollContent}
                  showsVerticalScrollIndicator={true}
                  nestedScrollEnabled={true}
                  bounces={true}
                >
                  {/* Cause of death + ribbon */}
                  <View style={styles.causeCard}>
                    <Text style={styles.causeSubtitle}>{deathSubtitle}</Text>
                    <Text style={styles.causeMessage}>{deathMessage}</Text>
                  </View>

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

                  {/* Life Summary Section */}
                  <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                      <Sparkles size={20} color={settings.darkMode ? accent.gold : accent.warning} />
                      <Text style={styles.sectionTitle}>Life Summary</Text>
                    </View>

                    <View style={styles.summaryCard}>
                      {/* Career */}
                      {currentJob && (
                        <View style={styles.summaryRow}>
                          <View style={[styles.summaryIconContainer, { backgroundColor: 'rgba(59, 130, 246, 0.1)' }]}>
                            <Briefcase size={18} color={accent.info} />
                          </View>
                          <View style={styles.summaryContent}>
                            <Text style={styles.summaryLabel}>Final Career</Text>
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
                            <Text style={styles.summaryLabel}>Education</Text>
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
                          <Text style={styles.summaryLabel}>Family</Text>
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
                            <Text style={styles.summaryLabel}>Properties Owned</Text>
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
                            <Text style={styles.summaryLabel}>Companies Owned</Text>
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
                            <Text style={styles.summaryLabel}>Achievements</Text>
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
                              <Text style={styles.achievementText}>{ach.name}</Text>
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
                      <Text style={styles.sectionTitle}>Life Statistics</Text>
                    </View>

                    <View style={styles.statsGrid}>
                      <View style={styles.statBox}>
                        <Text style={styles.statBoxLabel}>Weeks Lived</Text>
                        <Text style={styles.statBoxValue}>{weeksLived}</Text>
                      </View>

                      <View style={styles.statBox}>
                        <Text style={styles.statBoxLabel}>Relationships</Text>
                        <Text style={styles.statBoxValue}>{totalRelationships}</Text>
                      </View>

                      {careerLevel && (
                        <View style={styles.statBox}>
                          <Text style={styles.statBoxLabel}>Career Level</Text>
                          <Text style={styles.statBoxValue}>{careerLevel}</Text>
                        </View>
                      )}

                      <View style={styles.statBox}>
                        <Text style={styles.statBoxLabel}>Peak Net Worth</Text>
                        <Text style={styles.statBoxValue}>{formatMoney(maxNetWorth)}</Text>
                      </View>
                    </View>
                  </View>

                  {/* ENGAGEMENT: Prestige Points Preview — reframes death as investment */}
                  {(() => {
                    const prestigeLevel = gameState.prestige?.prestigeLevel || 0;
                    const earnedPoints = Math.floor(
                      (totalNetWorth / 10000) + (weeksLived / 5) + (totalAchievements * 20) + (prestigeLevel * 100)
                    );
                    const canBuySmallInheritance = earnedPoints >= 500;
                    const canBuyStatBoost = earnedPoints >= 1000;
                    const canBuyModestInheritance = earnedPoints >= 2000;
                    return earnedPoints > 0 ? (
                      <View style={styles.section}>
                        <View style={styles.sectionHeader}>
                          <Crown size={20} color={accent.warning} />
                          <Text style={styles.sectionTitle}>Prestige Points Earned</Text>
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
                </ScrollView>

                {/* Summary footer — revive / rewind THIS life, or start fresh */}
                <View style={styles.footer}>
                  <TouchableOpacity
                    style={[styles.actionButton, !canAffordRevive && styles.disabledButton]}
                    onPress={handleRevive}
                    disabled={!canAffordRevive}
                    activeOpacity={0.8}
                  >
                    <LinearGradient
                      colors={canAffordRevive ? [accent.success, '#059669'] : ['#94A3B8', '#6B7280']}
                      style={styles.buttonGradient}
                    >
                      <Heart size={18} color="#FFF" />
                      <Text style={styles.buttonText}>
                        Revive ({REVIVE_GEM_COST.toLocaleString()} Gems)
                      </Text>
                    </LinearGradient>
                  </TouchableOpacity>

                  {/* Quiet bridge when revive is unaffordable — the disabled button
                      stays honest; this only offers a path to buy gems. No urgency
                      copy, and the store is never opened automatically. */}
                  {!canAffordRevive && (
                    <View style={styles.secondaryRow}>
                      <TouchableOpacity
                        style={styles.secondaryButton}
                        onPress={handleGetMoreGems}
                        activeOpacity={0.8}
                        accessibilityRole="button"
                        accessibilityLabel="Get more gems in the shop"
                      >
                        <Gem size={16} color={c.text} />
                        <Text style={styles.secondaryButtonText}>Get more gems</Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  {/* Time Machine — Rewind to checkpoint (cheaper than revive) */}
                  {checkpoints.length > 0 && (
                    <View style={styles.rewindSection}>
                      <Text style={styles.rewindTitle}>
                        Rewind Time ({rewindCost.toLocaleString()} Gems)
                      </Text>
                      {checkpoints.slice().reverse().map((cp: any) => (
                        // Kept PRESSABLE even when unaffordable (still visually
                        // dimmed): a tap routes into handleRewind's existing
                        // "Not Enough Gems → Get Gems" branch, which bridges to
                        // the store. A `disabled` button would swallow that tap.
                        <TouchableOpacity
                          key={cp.id}
                          style={[styles.rewindChip, !canAffordRewind && styles.disabledButton]}
                          onPress={() => handleRewind(cp.id)}
                          activeOpacity={0.7}
                          accessibilityRole="button"
                          accessibilityHint={!canAffordRewind ? 'Not enough gems' : undefined}
                        >
                          <RotateCcw size={14} color={canAffordRewind ? accent.warning : c.textSecondary} />
                          <Text style={[styles.rewindChipText, !canAffordRewind && { color: c.textSecondary }]}>
                            {cp.label} (Age {cp.age})
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}

                  {startNewLifeButton}
                  {secondaryActions}
                </View>
              </View>
            )}

            {/* ───────────────────────────── LEGACY PAGE ───────────────────────────── */}
            {activeTab === 'legacy' && (
              <View style={styles.page}>
                <ScrollView
                  style={styles.scrollView}
                  contentContainerStyle={styles.scrollContent}
                  showsVerticalScrollIndicator={true}
                  nestedScrollEnabled={true}
                  bounces={true}
                >
                  {/* Inheritance Breakdown */}
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Inheritance Breakdown</Text>

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
                    <Text style={styles.sectionTitle}>Legacy Bonuses</Text>

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
                      <Text style={styles.sectionTitle}>Continue Legacy</Text>
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
                                    source={getCharacterImage(age, child.gender, child.id)}
                                    style={styles.childImage}
                                  />
                                  <View style={styles.childInfo}>
                                    <Text style={styles.childName}>{child.name}</Text>
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
                                    <Text style={styles.childNetWorthLabel}>Net Worth</Text>
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
                </ScrollView>

                {/* Legacy footer — continue the bloodline, or start fresh */}
                <View style={styles.footer}>
                  <TouchableOpacity
                    style={[styles.actionButton, !canContinueLegacy && styles.disabledButton]}
                    onPress={handleContinueLegacy}
                    disabled={!canContinueLegacy}
                    activeOpacity={0.8}
                  >
                    <LinearGradient
                      colors={!canContinueLegacy ? ['#94A3B8', '#6B7280'] : [theme.palette.primary, theme.palette.primaryDark]}
                      style={styles.buttonGradient}
                    >
                      <Crown size={18} color="#FFF" />
                      <Text style={styles.buttonText}>
                        {heirs.length === 0 ? 'No Children Available' : !selectedHeirId ? 'Select a Child First' : 'Continue Legacy'}
                      </Text>
                    </LinearGradient>
                  </TouchableOpacity>

                  {startNewLifeButton}
                  {secondaryActions}
                </View>
              </View>
            )}
          </LinearGradient>
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
