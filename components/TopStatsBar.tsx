// components/TopStatsBar.tsx
import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  useWindowDimensions,
  Easing,
} from 'react-native';
import {
  responsivePadding,
  responsiveFontSize,
  responsiveSpacing,
  responsiveBorderRadius,
  touchTargets,
  scale,
  isSmallDevice,
  isLargeDevice,
  isIPad,
  isAndroidXLarge,
} from '@/utils/scaling';
import { useGameState, useGameActions } from '@/contexts/GameContext';
import LinearGradientFallback from '@/components/fallbacks/LinearGradientFallback';
import AnimatedMoney from '@/components/ui/AnimatedMoney';
import { Z_INDEX } from '@/utils/zIndexConstants';
import {
  Heart,
  Smile,
  Zap,
  Wallet,
  PiggyBank,
  Gem,
  ShoppingCart,
  HelpCircle,
  Settings,
  ArrowRightCircle,
  Coffee,
  Apple,
  Dumbbell,
  Crown,
  ArrowUp,
  ArrowDown,
  AlertTriangle,
} from 'lucide-react-native';
import SettingsModal from './SettingsModal';
import GemShopModal from './GemShopModal';
import HelpModal from './HelpModal';
import PrestigeModal from './PrestigeModal';
import EnergyBreakdownModal from './EnergyBreakdownModal';
import HappinessBreakdownModal from './HappinessBreakdownModal';
import HealthBreakdownModal from './HealthBreakdownModal';
import MoneyBreakdownModal from './MoneyBreakdownModal';
import BankBreakdownModal from './BankBreakdownModal';
import GemsBreakdownModal from './GemsBreakdownModal';
import SicknessModal from './SicknessModal';
import SeasonalIndicator from './SeasonalIndicator';
import usePressableScale from '@/hooks/usePressableScale';
import { useFeedback } from '@/utils/feedbackSystem';
import { usePerformanceMonitor, useMemoryCleanup } from '@/utils/performanceOptimization';
import { getProgressAccessibilityProps, ACCESSIBILITY_HINTS } from '@/utils/accessibility';

const LinearGradient = LinearGradientFallback;

// Memoized TopStatsBar to prevent unnecessary re-renders
function TopStatsBarComponent() {
  // Use useGameState and useGameActions for disease modal control
  const { gameState, setGameState } = useGameState();

  // Extract only the values we need from gameState to reduce re-renders
  // React's useMemo will handle object reference equality automatically
  const stats = gameState?.stats;
  const settings = gameState?.settings;
  const bankSavings = gameState?.bankSavings ?? 0;
  const stocks = gameState?.stocks;
  const generationNumber = gameState?.generationNumber;
  const prestigeLevel = gameState?.prestige?.prestigeLevel ?? 0;
  const date = gameState?.date;
  const careers = gameState?.careers;
  const currentJob = gameState?.currentJob;
  const educations = gameState?.educations;
  const prestige = gameState?.prestige;
  const diseases = gameState?.diseases || [];
  const hasDiseases = diseases.length > 0;
  const hasCriticalDisease = diseases.some(d => d.severity === 'critical');
  const hasSeriousDisease = diseases.some(d => d.severity === 'serious');

  const showStatArrows = settings?.showStatArrows !== false; // Default to true

  const { success, buttonPress, haptic } = useFeedback(settings?.hapticFeedback ?? false);
  const { logRender } = usePerformanceMonitor();

  // Single modal state — only one modal open at a time, reduces re-renders
  type ModalName = 'settings' | 'gemShop' | 'help' | 'prestige' | 'energyBreakdown' | 'happinessBreakdown' | 'healthBreakdown' | 'moneyBreakdown' | 'bankBreakdown' | 'gemsBreakdown' | null;
  const [openModal, setOpenModal] = useState<ModalName>(null);
  const [showQuickActions, setShowQuickActions] = useState<string | null>(null);
  const closeModal = useCallback(() => setOpenModal(null), []);

  // Glow anims (JS driver) - memoized to prevent dependency changes
  const glowAnimations = useMemo(() => ({
    health: new Animated.Value(0),
    happiness: new Animated.Value(0),
    energy: new Animated.Value(0),
  }), []);

  // Stat anims (JS driver) - must be initialized before early return (Rules of Hooks)
  const animatedStats = useRef({
    health: new Animated.Value(gameState?.stats?.health ?? 0),
    happiness: new Animated.Value(gameState?.stats?.happiness ?? 0),
    energy: new Animated.Value(gameState?.stats?.energy ?? 0),
  }).current;

  const weekAnimations = useRef([
    new Animated.Value(1),
    new Animated.Value(1),
    new Animated.Value(1),
    new Animated.Value(1),
  ]).current;

  const { width } = useWindowDimensions();

  const getStatColor = (_stat: string, value: number) => {
    if (value >= 80) return '#059669'; // Beautiful emerald green
    if (value >= 60) return '#D97706'; // Warm amber
    if (value >= 40) return '#EA580C'; // Vibrant orange
    return '#DC2626'; // Deep red for critical
  };

  const getGlowColor = (_stat: string, value: number) => {
    if (value >= 80) return 'rgba(5, 150, 105, 0.3)';
    if (value >= 60) return 'rgba(217, 119, 6, 0.3)';
    if (value >= 40) return 'rgba(234, 88, 12, 0.3)';
    return 'rgba(220, 38, 38, 0.4)';
  };

  const shouldGlow = (value: number) => value >= 90 || value <= 20;

  const handleQuickAction = useCallback((action: string) => {
    buttonPress();
    setShowQuickActions(null);

    switch (action) {
      case 'eat':
        haptic('success');
        success('ðŸŽ You feel refreshed after eating something healthy!');
        break;
      case 'rest':
        haptic('success');
        success('😴 You feel more energized after taking a break!');
        break;
      case 'social':
        haptic('success');
        success('👥 Spending time with others lifts your mood!');
        break;
      case 'exercise':
        haptic('success');
        success('💪 You feel stronger and happier after working out!');
        break;
    }
  }, [buttonPress, haptic, success]);

  // Optimized stat colors with better memoization
  const statColors = useMemo(
    () => ({
      health: getStatColor('health', stats?.health ?? 0),
      happiness: getStatColor('happiness', stats?.happiness ?? 0),
      energy: getStatColor('energy', stats?.energy ?? 0),
    }),
    [stats?.health, stats?.happiness, stats?.energy]
  );

  const glowColors = useMemo(
    () => ({
      health: getGlowColor('health', stats?.health ?? 0),
      happiness: getGlowColor('happiness', stats?.happiness ?? 0),
      energy: getGlowColor('energy', stats?.energy ?? 0),
    }),
    [stats?.health, stats?.happiness, stats?.energy]
  );


  // Optimized animation effect with better performance
  // Throttle logRender to prevent excessive logging
  const lastLogTime = useRef(0);
  useEffect(() => {
    if (!stats) return;

    // Only log render every 500ms to reduce console spam
    const now = Date.now();
    if (now - lastLogTime.current > 500) {
      logRender('TopStatsBar');
      lastLogTime.current = now;
    }

    const to = (v: number) => Math.max(0, Math.min(100, v ?? 0));

    // Use requestAnimationFrame for smoother animations
    const animateStats = () => {
      // Stop any existing animations first to prevent conflicts
      animatedStats.health.stopAnimation();
      animatedStats.happiness.stopAnimation();
      animatedStats.energy.stopAnimation();

      // Use timing animations with native driver for better performance
      const healthAnimation = Animated.timing(animatedStats.health, {
        toValue: to(stats.health),
        duration: 300, // Reduced duration for snappier feel
        useNativeDriver: false, // Keep false for width animations
        easing: Easing.out(Easing.quad), // Smoother easing
      });

      const happinessAnimation = Animated.timing(animatedStats.happiness, {
        toValue: to(stats.happiness),
        duration: 300,
        useNativeDriver: false,
        easing: Easing.out(Easing.quad),
      });

      const energyAnimation = Animated.timing(animatedStats.energy, {
        toValue: to(stats.energy),
        duration: 300,
        useNativeDriver: false,
        easing: Easing.out(Easing.quad),
      });

      // Start all animations simultaneously to prevent stuttering
      Animated.parallel([
        healthAnimation,
        happinessAnimation,
        energyAnimation,
      ]).start();
    };

    const runGlow = (key: 'health' | 'happiness' | 'energy', value: number) => {
      if (shouldGlow(value)) {
        const glowLoop = Animated.loop(
          Animated.sequence([
            Animated.timing(glowAnimations[key], {
              toValue: 1,
              duration: 1200,
              useNativeDriver: false,
              easing: Easing.inOut(Easing.ease)
            }),
            Animated.timing(glowAnimations[key], {
              toValue: 0,
              duration: 1200,
              useNativeDriver: false,
              easing: Easing.inOut(Easing.ease)
            }),
          ])
        );
        glowLoop.start();
        return glowLoop;
      } else {
        const glowStop = Animated.timing(glowAnimations[key], {
          toValue: 0,
          duration: 300,
          useNativeDriver: false,
          easing: Easing.out(Easing.ease)
        });
        glowStop.start();
        return glowStop;
      }
    };

    // Use requestAnimationFrame for smoother updates
    const rafId = requestAnimationFrame(animateStats);

    const activeGlowAnimations = [
      runGlow('health', stats.health),
      runGlow('happiness', stats.happiness),
      runGlow('energy', stats.energy)
    ].filter(Boolean);

    // Cleanup function
    return () => {
      cancelAnimationFrame(rafId);
      animatedStats.health.stopAnimation();
      animatedStats.happiness.stopAnimation();
      animatedStats.energy.stopAnimation();
      activeGlowAnimations.forEach(anim => anim?.stop());
    };
  }, [stats?.health, stats?.happiness, stats?.energy, animatedStats, glowAnimations, logRender, stats]);

  // Calculate net change for each stat
  const statNetChanges = React.useMemo(() => {
    if (!stats || !gameState) return { health: 0, happiness: 0, energy: 0 };

    // Calculate natural decay
    const netWorth = (stats.money || 0) + (bankSavings || 0);
    const safeNetWorth = isFinite(netWorth) && netWorth > 0 ? netWorth : 1000;
    const wealthMultiplier = Math.max(0.5, Math.min(2.0, 100000 / Math.max(1000, safeNetWorth)));
    const statDecayRate = 4;
    const effectiveDecayRate = statDecayRate * wealthMultiplier;

    const activeEducations = (educations || []).filter(edu =>
      edu && !edu.completed && !edu.paused && edu.weeksRemaining && edu.weeksRemaining > 0
    );

    // Health net change
    let healthChange = -Math.round(effectiveDecayRate * 0.6); // Natural decay
    if (currentJob) {
      const career = careers?.find(c => c.id === currentJob && c.accepted);
      if (career) healthChange -= 2; // Career penalty
    }
    if (activeEducations.length > 0) {
      const numActiveEducations = activeEducations.length;
      const baseHealthPenalty = -3;
      const stressMultiplier = numActiveEducations === 1 ? 1.0 : numActiveEducations === 2 ? 1.3 : 1.6;
      healthChange += Math.round(baseHealthPenalty * numActiveEducations * stressMultiplier);
    }
    // Add diet plan health gain
    const activeDietPlan = (gameState.dietPlans || []).find(plan => plan && plan.active);
    if (activeDietPlan && activeDietPlan.healthGain > 0) {
      healthChange += activeDietPlan.healthGain;
    }

    // Happiness net change
    let happinessChange = -Math.round(effectiveDecayRate * 0.8); // Natural decay
    if (currentJob) {
      const career = careers?.find(c => c.id === currentJob && c.accepted);
      if (career) happinessChange -= 3; // Career penalty
    }
    if (activeEducations.length > 0) {
      const numActiveEducations = activeEducations.length;
      const baseHappinessPenalty = -6;
      const stressMultiplier = numActiveEducations === 1 ? 1.0 : numActiveEducations === 2 ? 1.3 : 1.6;
      happinessChange += Math.round(baseHappinessPenalty * numActiveEducations * stressMultiplier);
    }
    // Add diet plan happiness gain
    if (activeDietPlan && activeDietPlan.happinessGain && activeDietPlan.happinessGain > 0) {
      happinessChange += activeDietPlan.happinessGain;
    }
    // Add real estate happiness boost from current residence
    const currentResidence = (gameState.realEstate || []).find(p => {
      const hasStatus = 'status' in p && p.status === 'owner';
      const hasCurrentResidence = 'currentResidence' in p && p.currentResidence === true;
      return p.owned && hasStatus && hasCurrentResidence;
    });
    if (currentResidence && currentResidence.weeklyHappiness > 0) {
      happinessChange += currentResidence.weeklyHappiness;
    }

    // Energy net change
    let energyChange = 30; // Base regen
    const unlockedBonuses = prestige?.unlockedBonuses || [];
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { getEnergyRegenMultiplier } = require('@/lib/prestige/applyBonuses');
      const energyRegenMultiplier = getEnergyRegenMultiplier(unlockedBonuses);
      const safeEnergyRegenMultiplier = typeof energyRegenMultiplier === 'number' && isFinite(energyRegenMultiplier) && energyRegenMultiplier > 0 ? energyRegenMultiplier : 1.0;
      energyChange = Math.round(30 * safeEnergyRegenMultiplier);
    } catch {
      // Ignore if module not found
    }
    // Career energy cost is fixed at -5 per week (no energyCost in level definitions)
    if (currentJob) {
      const career = careers?.find(c => c.id === currentJob && c.accepted);
      if (career) {
        energyChange -= 5; // Fixed energy cost for working
      }
    }
    if (activeEducations.length > 0) {
      const numActiveEducations = activeEducations.length;
      const baseEnergyPenalty = -7;
      const stressMultiplier = numActiveEducations === 1 ? 1.0 : numActiveEducations === 2 ? 1.3 : 1.6;
      energyChange += Math.round(baseEnergyPenalty * numActiveEducations * stressMultiplier);
    }
    // Add diet plan energy gain
    if (activeDietPlan && activeDietPlan.energyGain > 0) {
      energyChange += activeDietPlan.energyGain;
    }
    // Add real estate energy boost from current residence
    if (currentResidence && currentResidence.weeklyEnergy > 0) {
      energyChange += currentResidence.weeklyEnergy;
    }

    return { health: healthChange, happiness: happinessChange, energy: energyChange };
  }, [stats, gameState, bankSavings, currentJob, careers, educations, prestige, gameState?.dietPlans, gameState?.realEstate, gameState?.date?.week]);

  const progressStats = React.useMemo(
    () => {
      if (!stats) return [];
      return [
        {
          key: 'health',
          icon: Heart,
          value: stats.health,
          color: statColors.health,
          gradient: ['#EF4444', '#F87171'] as [string, string],
          max: 100,
          netChange: statNetChanges.health,
          quickActions: [
            { icon: Apple, label: 'Eat Healthy', action: () => handleQuickAction('eat') },
            { icon: Coffee, label: 'Rest', action: () => handleQuickAction('rest') },
          ],
        },
        {
          key: 'happiness',
          icon: Smile,
          value: stats.happiness,
          color: '#F59E0B', // Yellow to match bar color
          gradient: ['#F59E0B', '#FBBF24'] as [string, string],
          max: 100,
          netChange: statNetChanges.happiness,
          quickActions: [
            { icon: Coffee, label: 'Socialize', action: () => handleQuickAction('social') },
            { icon: Dumbbell, label: 'Exercise', action: () => handleQuickAction('exercise') },
          ],
        },
        {
          key: 'energy',
          icon: Zap,
          value: stats.energy,
          color: '#3B82F6', // Blue to match bar color
          gradient: ['#3B82F6', '#60A5FA'] as [string, string],
          max: 100,
          netChange: statNetChanges.energy,
          quickActions: [
            { icon: Coffee, label: 'Rest', action: () => handleQuickAction('rest') },
            { icon: Apple, label: 'Eat', action: () => handleQuickAction('eat') },
          ],
        },
      ];
    },
    [stats, statColors, handleQuickAction, statNetChanges]
  );

  useEffect(() => {
    if (!gameState?.date?.week) return;
    const currentIndex = Math.min(3, Math.max(0, (gameState?.date?.week ?? 1) - 1));
    Animated.sequence([
      Animated.timing(weekAnimations[currentIndex], { toValue: 1.35, duration: 180, useNativeDriver: true }),
      Animated.timing(weekAnimations[currentIndex], { toValue: 1, duration: 180, useNativeDriver: true }),
    ]).start();
  }, [gameState?.date?.week, weekAnimations]);

  // Standardized breakpoint for small devices (covers iPhone SE and Android small devices)
  const SMALL_DEVICE_BREAKPOINT = 360;
  const isVerySmallDevice = isSmallDevice() && width < SMALL_DEVICE_BREAKPOINT;

  const getProgressBarWidth = () => {
    // Calculate available width for progress bars (accounting for padding, icons, and right section)
    const containerPadding = responsivePadding.horizontal * 1.2 * 2; // left + right padding
    const iconWidth = (isIPad() ? touchTargets.large : touchTargets.minimum) + responsiveSpacing.xs; // icon + margin
    // More conservative right section width calculation
    const rightSectionWidth = isIPad()
      ? scale(170)
      : (isVerySmallDevice
        ? scale(95)  // Reduced from 100 for better fit
        : scale(115));
    const rightSectionMargin = responsiveSpacing.lg;
    const availableWidth = width - containerPadding - iconWidth - rightSectionWidth - rightSectionMargin;

    if (isIPad()) return Math.min(360, Math.max(240, availableWidth * 0.9));
    if (isSmallDevice()) {
      // On very small devices, use a more conservative calculation
      if (width < SMALL_DEVICE_BREAKPOINT) {
        // Very conservative for small devices
        return Math.min(110, Math.max(70, availableWidth * 0.8)); // Reduced from 120/80
      }
      return Math.min(140, Math.max(100, availableWidth * 0.85)); // Reduced from 0.88
    }
    if (isLargeDevice()) return Math.min(200, Math.max(150, availableWidth * 0.9));
    return Math.min(160, Math.max(120, availableWidth * 0.85)); // Reduced from 0.88
  };
  const progressBarWidth = getProgressBarWidth();

  // Don't render if no game state or if we're in onboarding
  if (!gameState?.stats || !gameState?.userProfile) return null;

  const darkMode = !!settings?.darkMode;
  // Dynamic container padding for small devices - more conservative
  const containerPadding = isVerySmallDevice
    ? responsivePadding.horizontal * 0.7  // Reduced from 0.8
    : responsivePadding.horizontal * 1.2;
  const containerMinHeight = isIPad()
    ? scale(200)
    : (isVerySmallDevice ? scale(140) : scale(160));
  const containerStyle = [
    styles.container,
    darkMode && styles.containerDark,
    { paddingHorizontal: containerPadding, minHeight: containerMinHeight }
  ];
  const iconColor = darkMode ? '#E5E7EB' : '#111827';

  const controlButtonGradient: [string, string] = darkMode
    ? ['#1F2937', '#111827']
    : ['#FFFFFF', '#F3F4F6'];

  const formatGems = (amount: number) => {
    const a = Math.floor(amount || 0);
    // Always remove decimals in TopStatsBar for better readability
    if (a >= 1_000_000_000_000_000) {
      return `${Math.floor(a / 1_000_000_000_000_000)}Q`;
    }
    if (a >= 1_000_000_000_000) {
      return `${Math.floor(a / 1_000_000_000_000)}T`;
    }
    if (a >= 1_000_000_000) {
      return `${Math.floor(a / 1_000_000_000)}B`;
    }
    if (a >= 1_000_000) {
      return `${Math.floor(a / 1_000_000)}M`;
    }
    if (a > 10_000) {
      // Thousands (K) - only for numbers above 10,000
      return `${Math.floor(a / 1_000)}K`;
    }
    // Regular numbers (0-10,000) - show full number
    return a.toLocaleString();
  };

  // Calculate total stock value
  const calculateStockValue = () => {
    if (!stocks?.holdings) return 0;
    return stocks.holdings.reduce((total, holding) => {
      return total + (holding.shares * holding.currentPrice);
    }, 0);
  };

  // Calculate total savings including stock investments
  const totalSavings = bankSavings + calculateStockValue();

  const formatSavings = (amount: number) => {
    const a = Math.floor(amount || 0);
    // Always remove decimals in TopStatsBar for better readability
    if (a >= 1_000_000_000_000_000) {
      return `${Math.floor(a / 1_000_000_000_000_000)}Q`;
    }
    if (a >= 1_000_000_000_000) {
      return `${Math.floor(a / 1_000_000_000_000)}T`;
    }
    if (a >= 1_000_000_000) {
      return `${Math.floor(a / 1_000_000_000)}B`;
    }
    if (a >= 1_000_000) {
      return `${Math.floor(a / 1_000_000)}M`;
    }
    if (a > 10_000) {
      // Thousands (K) - only for numbers above 10,000
      return `${Math.floor(a / 1_000)}K`;
    }
    // Regular numbers (0-10,000) - show full number
    return a.toLocaleString();
  };

  return (
    <View style={containerStyle}>
      {/* Left: generation badge + controls + stats */}
      <View style={[styles.leftSection, { minWidth: 0 }]}>
        <View style={styles.generationRow}>
          <Text style={[styles.generationBadge, darkMode && styles.generationBadgeDark]}>
            Gen {generationNumber ?? 1}
          </Text>
          {(prestigeLevel > 0) && (
            <View style={styles.prestigeBadgeContainer}>
              <LinearGradient
                colors={['#FCD34D', '#F59E0B', '#D97706'] as const}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.prestigeBadge}
              >
                <Crown size={12} color="#FFFFFF" />
                <Text style={styles.prestigeBadgeText}>P{prestigeLevel}</Text>
              </LinearGradient>
            </View>
          )}
        </View>
        <View style={styles.leftIconRow}>
          <TouchableOpacity
            onPress={() => { buttonPress(); setOpenModal('gemShop'); }}
            style={[styles.iconButton, darkMode && styles.iconButtonDark]}
            activeOpacity={0.85}
            accessibilityLabel="Open Gem Shop"
            accessibilityRole="button"
            accessibilityHint="Tap to open the gem shop where you can purchase items with gems"
          >
            <LinearGradient colors={controlButtonGradient} style={styles.iconButtonGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
              <ShoppingCart size={22} color={iconColor} />
            </LinearGradient>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => { buttonPress(); setOpenModal('help'); }}
            style={[styles.iconButton, darkMode && styles.iconButtonDark]}
            activeOpacity={0.85}
            accessibilityLabel="Open Help Menu"
            accessibilityRole="button"
            accessibilityHint="Tap to open help and information about the game"
          >
            <LinearGradient colors={controlButtonGradient} style={styles.iconButtonGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
              <HelpCircle size={22} color={iconColor} />
            </LinearGradient>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => { buttonPress(); setOpenModal('settings'); }}
            style={[styles.iconButton, darkMode && styles.iconButtonDark]}
            activeOpacity={0.85}
            accessibilityLabel="Open Settings"
            accessibilityRole="button"
            accessibilityHint={ACCESSIBILITY_HINTS.BUTTONS.SETTINGS}
          >
            <LinearGradient colors={controlButtonGradient} style={styles.iconButtonGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
              <Settings size={22} color={iconColor} />
            </LinearGradient>
          </TouchableOpacity>
          <View style={[styles.iconButton, darkMode && styles.iconButtonDark]}>
            <SeasonalIndicator size={22} />
          </View>
        </View>

        {progressStats.map(({ key, icon: Icon, color, gradient, max, quickActions, value, netChange }) => {
          const val = animatedStats[key as 'health' | 'happiness' | 'energy'];
          const progressWidth = val.interpolate({
            inputRange: [0, max],
            outputRange: ['0%', '100%'],
            extrapolate: 'clamp',
            // Remove easing from interpolation as it can cause conflicts with the main animation
          });

          const statLabel = key === 'health' ? 'Health' : key === 'happiness' ? 'Happiness' : 'Energy';
          const accessibilityProps = getProgressAccessibilityProps({
            label: `${statLabel} level`,
            value: Math.round(value),
            max: max,
            hint: ACCESSIBILITY_HINTS.GAME_ELEMENTS[key.toUpperCase() as 'HEALTH' | 'HAPPINESS' | 'ENERGY'] || `${statLabel} level`,
          });

          return (
            <View key={key} style={styles.statRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                <TouchableOpacity
                  style={[styles.statTouchable, { flex: 1 }]}
                  onLongPress={() => setShowQuickActions(showQuickActions === key ? null : key)}
                  onPress={() => {
                    if (key === 'energy') {
                      setOpenModal('energyBreakdown');
                    } else if (key === 'happiness') {
                      setOpenModal('happinessBreakdown');
                    } else if (key === 'health') {
                      setOpenModal('healthBreakdown');
                    } else {
                      buttonPress();
                    }
                  }}
                  activeOpacity={0.7}
                  accessibilityLabel={accessibilityProps.accessibilityLabel}
                  accessibilityRole="button"
                  accessibilityHint={
                    key === 'energy'
                      ? `${accessibilityProps.accessibilityHint}. Tap to see energy breakdown. Long press to see quick actions.`
                      : key === 'happiness'
                        ? `${accessibilityProps.accessibilityHint}. Tap to see happiness breakdown. Long press to see quick actions.`
                        : key === 'health'
                          ? `${accessibilityProps.accessibilityHint}. Tap to see health breakdown. Long press to see quick actions.`
                          : `${accessibilityProps.accessibilityHint}. Long press to see quick actions.`
                  }
                >
                  <View style={styles.statRowContent}>
                    <View style={styles.statIconContainer}>
                      <Icon size={18} color={color} />
                    </View>

                    <View
                      style={[
                        styles.progressBarWrapper,
                        darkMode && styles.progressBarWrapperDark,
                        { width: progressBarWidth },
                      ]}
                      accessibilityRole="progressbar"
                      accessibilityValue={{
                        min: 0,
                        max: max,
                        now: Math.round(value),
                        text: `${Math.round(value)} out of ${max}`,
                      }}
                    >
                      <Animated.View
                        style={[
                          styles.progressFill,
                          darkMode && styles.progressFillDark,
                          { width: progressWidth },
                          shouldGlow(value) && {
                            shadowColor: glowColors[key as 'health' | 'happiness' | 'energy'],
                            shadowOffset: { width: 0, height: 0 },
                            shadowOpacity: glowAnimations[key as 'health' | 'happiness' | 'energy'].interpolate({
                              inputRange: [0, 1],
                              outputRange: [0, 1],
                            }),
                            shadowRadius: 8,
                            elevation: 8,
                          },
                        ]}
                      >
                        <LinearGradient
                          colors={gradient}
                          style={StyleSheet.absoluteFill}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 0 }}
                        />
                      </Animated.View>
                    </View>
                    {showStatArrows && netChange !== undefined && netChange !== 0 && (
                      <View style={styles.statArrowContainer}>
                        {netChange > 0 ? (
                          <ArrowUp size={scale(14)} color="#10B981" />
                        ) : (
                          <ArrowDown size={scale(14)} color="#EF4444" />
                        )}
                      </View>
                    )}
                    {/* Disease Indicator - Inside statRowContent, close to arrows */}
                    {key === 'health' && hasDiseases && (
                      <TouchableOpacity
                        style={[
                          styles.diseaseIndicator,
                          hasCriticalDisease && styles.diseaseIndicatorCritical,
                          hasSeriousDisease && !hasCriticalDisease && styles.diseaseIndicatorSerious,
                          { marginLeft: scale(2), zIndex: 10, elevation: 10 },
                        ]}
                        onPress={() => {
                          buttonPress();
                          // Manually trigger sickness modal by setting showSicknessModal to true
                          setGameState(prev => ({
                            ...prev,
                            showSicknessModal: true,
                          }));
                        }}
                        activeOpacity={0.7}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        accessibilityLabel={`${diseases.length} active disease${diseases.length !== 1 ? 's' : ''}`}
                        accessibilityRole="button"
                        accessibilityHint="Tap to view disease details"
                      >
                        <AlertTriangle
                          size={scale(12)}
                          color="#FFFFFF"
                        />
                        {diseases.length > 1 && (
                          <Text style={styles.diseaseIndicatorCount}>{diseases.length}</Text>
                        )}
                      </TouchableOpacity>
                    )}
                  </View>
                </TouchableOpacity>
              </View>

              {/* quick actions omitted for clarity; keep if you used them */}
              {showQuickActions === key && quickActions && (
                <View style={styles.quickActionsContainer}>
                  {quickActions.map((action, index) => (
                    <TouchableOpacity
                      key={index}
                      style={styles.quickActionButton}
                      onPress={action.action}
                      activeOpacity={0.7}
                      accessibilityLabel={action.label}
                      accessibilityRole="button"
                      accessibilityHint={`Quick action to improve ${statLabel.toLowerCase()}`}
                    >
                      <LinearGradient colors={['#3B82F6', '#1D4ED8'] as const} style={styles.quickActionGradient}>
                        <action.icon size={16} color="#FFFFFF" />
                        <Text style={styles.quickActionText}>{action.label}</Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          );
        })}

        {/* Money, Bank, Gems — NEW CHIP STYLES */}
        <View style={styles.moneyRow}>
          <View style={[styles.leftMoneySection, { flexWrap: isVerySmallDevice ? 'wrap' : 'nowrap' }]}>
            <TouchableOpacity
              onPress={() => {
                buttonPress();
                setOpenModal('moneyBreakdown');
              }}
              activeOpacity={0.7}
              accessibilityLabel={ACCESSIBILITY_HINTS.GAME_ELEMENTS.MONEY}
              accessibilityRole="button"
              accessibilityHint="Tap to see detailed cash balance"
            >
              <LinearGradient
                colors={['#16A34A', '#22C55E'] as const}
                style={[
                  styles.moneyChip,
                  isVerySmallDevice && {
                    paddingHorizontal: scale(6),  // Reduced from 8
                    minWidth: scale(55)  // Reduced from 60
                  }
                ]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Wallet size={14} color="#FFFFFF" style={styles.chipIcon} />
                <View style={styles.chipTextContainer}>
                  <AnimatedMoney
                    value={stats?.money ?? 0}
                    style={styles.chipText}
                    duration={300}
                  />
                </View>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                buttonPress();
                setOpenModal('bankBreakdown');
              }}
              activeOpacity={0.7}
              accessibilityLabel={`Total savings: ${formatSavings(totalSavings)}`}
              accessibilityRole="button"
              accessibilityHint="Tap to see detailed bank and investment breakdown"
            >
              <LinearGradient
                colors={['#F59E0B', '#FBBF24'] as const}
                style={[
                  styles.moneyChip,
                  isVerySmallDevice && {
                    paddingHorizontal: scale(6),  // Reduced from 8
                    minWidth: scale(55)  // Reduced from 60
                  }
                ]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <PiggyBank size={14} color="#FFFFFF" style={styles.chipIcon} />
                <View style={styles.chipTextContainer}>
                  <Text
                    style={styles.chipText}
                    numberOfLines={1}
                    adjustsFontSizeToFit={true}
                    minimumFontScale={0.7}
                  >
                    {formatSavings(totalSavings ?? 0)}
                  </Text>
                </View>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                buttonPress();
                setOpenModal('gemsBreakdown');
              }}
              activeOpacity={0.7}
              accessibilityLabel={`Gems: ${formatGems(stats?.gems ?? 0)}`}
              accessibilityRole="button"
              accessibilityHint="Tap to see detailed gem count"
            >
              <LinearGradient
                colors={['#6366F1', '#4F46E5']}
                style={[
                  styles.moneyChip,
                  isVerySmallDevice && {
                    paddingHorizontal: scale(6),  // Reduced from 8
                    minWidth: scale(55)  // Reduced from 60
                  }
                ]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Gem size={14} color="#FFFFFF" style={styles.chipIcon} />
                <View style={styles.chipTextContainer}>
                  <Text
                    style={styles.chipText}
                    numberOfLines={1}
                    adjustsFontSizeToFit={true}
                    minimumFontScale={0.7}
                  >
                    {formatGems(stats?.gems ?? 0)}
                  </Text>
                </View>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Right: date + next week */}
      <RightSide date={date} />
      {/* Modals — single openModal state controls visibility */}
      <SettingsModal visible={openModal === 'settings'} onClose={closeModal} />
      <GemShopModal visible={openModal === 'gemShop'} onClose={closeModal} />
      <HelpModal visible={openModal === 'help'} onClose={closeModal} />
      <EnergyBreakdownModal visible={openModal === 'energyBreakdown'} onClose={closeModal} />
      <HappinessBreakdownModal visible={openModal === 'happinessBreakdown'} onClose={closeModal} />
      <HealthBreakdownModal visible={openModal === 'healthBreakdown'} onClose={closeModal} />
      <MoneyBreakdownModal visible={openModal === 'moneyBreakdown'} onClose={closeModal} />
      <BankBreakdownModal visible={openModal === 'bankBreakdown'} onClose={closeModal} />
      <GemsBreakdownModal visible={openModal === 'gemsBreakdown'} onClose={closeModal} />
      <SicknessModal />
      <PrestigeModal
        visible={openModal === 'prestige'}
        onClose={closeModal}
      />
    </View>
  );
}

// Memoized RightSide component to prevent unnecessary re-renders
const RightSide = React.memo(function RightSide({ date }: { date?: { week?: number; year?: number; month?: string | number; age?: number } }) {
  // RightSide needs nextWeek action, so use both hooks
  // Hooks must be called unconditionally - if provider isn't ready, the error will be caught by ErrorBoundary
  const { gameState } = useGameState();
  const { nextWeek } = useGameActions();
  const { width } = useWindowDimensions();
  // Handle both iPhone Pro Max (428px+) and large Android devices (600px+)
  const isExtraLargeDevice = width > 428 || isAndroidXLarge(); // iPhone 15 Pro Max and large Android phones
  const { AnimatedView, animatedStyle, onPressIn, onPressOut } = usePressableScale();
  const settings = useMemo(() => gameState?.settings, [gameState?.settings]);
  const { buttonPress, haptic } = useFeedback(settings?.hapticFeedback ?? false);

  // All hooks must be called before any early returns (Rules of Hooks)
  const { addCleanup } = useMemoryCleanup();
  const [isAdvancingWeek, setIsAdvancingWeek] = useState(false);
  const spinValue = useRef(new Animated.Value(0)).current;
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const weekAnimations = useRef([
    new Animated.Value(1),
    new Animated.Value(1),
    new Animated.Value(1),
    new Animated.Value(1),
  ]).current;

  useEffect(() => {
    if (!date) return;
    const idx = Math.min(3, Math.max(0, (date.week ?? 1) - 1));
    Animated.sequence([
      Animated.timing(weekAnimations[idx], { toValue: 1.35, duration: 180, useNativeDriver: true }),
      Animated.timing(weekAnimations[idx], { toValue: 1, duration: 180, useNativeDriver: true }),
    ]).start();
  }, [date?.week, weekAnimations, date]);

  // Spinner animation for loading state
  useEffect(() => {
    if (isAdvancingWeek) {
      spinValue.setValue(0);
      Animated.loop(
        Animated.timing(spinValue, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        })
      ).start();
    } else {
      spinValue.setValue(0);
    }
  }, [isAdvancingWeek, spinValue]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, []);

  // Early return if date is not available (after all hooks)
  if (!date) {
    return <View style={styles.rightSection} />;
  }

  // Calculate responsive date box dimensions with better constraints
  // Use the same breakpoint as the main component
  const SMALL_DEVICE_BREAKPOINT = 360;
  const isVerySmallDevice = isSmallDevice() && width < SMALL_DEVICE_BREAKPOINT;

  const containerPadding = responsivePadding.horizontal * 1.2 * 2;
  // More conservative left section width to prevent overlap
  const leftSectionMinWidth = isVerySmallDevice
    ? width * 0.62  // Reduced from 0.65
    : width * 0.56; // Reduced from 0.58 to give right section more room on large devices
  const availableRightWidth = Math.max(
    scale(80),
    width - containerPadding - leftSectionMinWidth
  );

  // Handle extra large devices (iPhone 15 Pro Max, large Android phones) - limit date box size
  const maxDateBoxWidth = isIPad()
    ? scale(170)
    : isExtraLargeDevice
      ? scale(95) // Extra large phones (iPhone 17 Pro Max etc) — give date box enough room
      : isVerySmallDevice
        ? scale(85)  // Reduced from 90
        : scale(105); // Reduced from 110 to 105 for better fit

  const dateBoxWidthRaw = isIPad()
    ? scale(170)
    : isExtraLargeDevice
      ? Math.min(maxDateBoxWidth, Math.max(scale(75), availableRightWidth * 0.65)) // More conservative for large screens (reduced from 0.7)
      : isVerySmallDevice
        ? Math.min(scale(85), Math.max(scale(65), availableRightWidth * 0.85)) // More conservative
        : Math.min(maxDateBoxWidth, Math.max(scale(80), availableRightWidth * 0.8)); // Reduced from 0.85

  // Hard clamp to right column width to prevent overflow on wide/tall phones.
  const rightSectionMaxWidth = isVerySmallDevice
    ? width * 0.38  // Ensure it doesn't exceed available space
    : width * 0.44; // Increased from 0.42 to prevent overlap on large devices
  const rightSectionWidth = Math.max(
    scale(85),
    Math.min(rightSectionMaxWidth, availableRightWidth)
  );

  const dateBoxWidth = Math.min(dateBoxWidthRaw, rightSectionWidth);
  const dateBoxMaxWidth = Math.min(maxDateBoxWidth, rightSectionWidth);

  const dateBoxHeight = isIPad()
    ? scale(140)
    : isExtraLargeDevice
      ? scale(95) // Slightly smaller height for large screens
      : isVerySmallDevice
        ? scale(80) // Extra small height
        : isSmallDevice()
          ? scale(90)
          : scale(100);
  const dateBoxMinHeight = isIPad()
    ? scale(140)
    : isExtraLargeDevice
      ? scale(90)
      : (isVerySmallDevice ? scale(75) : scale(85));

  // Calculate responsive margin for right section
  const rightSectionMargin = isVerySmallDevice
    ? responsiveSpacing.sm  // Smaller margin on very small devices
    : responsiveSpacing.md;  // Medium margin otherwise

  return (
    <View style={[styles.rightSection, {
      marginLeft: rightSectionMargin,
      width: rightSectionWidth,
      maxWidth: rightSectionWidth
    }]}>
      <LinearGradient
        colors={['#60A5FA', '#3B82F6', '#2563EB']}
        style={[
          styles.dateOuter,
          {
            width: dateBoxWidth,
            maxWidth: dateBoxMaxWidth,
            height: dateBoxHeight,
            minHeight: dateBoxMinHeight,
          }
        ] as any}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={styles.dateInner}>
          <View style={styles.dateHeader}>
            <Text
              style={[
                styles.yearText,
                isExtraLargeDevice && {
                  fontSize: responsiveFontSize.base,
                  lineHeight: scale(18),
                }
              ]}
              numberOfLines={1}
            >{Math.floor(date?.year || 2025)}</Text>
          </View>
          <Text
            style={[
              styles.monthText,
              isExtraLargeDevice && {
                fontSize: responsiveFontSize.sm,
                lineHeight: scale(15),
              }
            ]}
            numberOfLines={1}
            adjustsFontSizeToFit={true}
            minimumFontScale={0.7}
          >
            {(() => {
              if (!date?.month) return 'Unknown';
              const monthNum = typeof date.month === 'number' ? date.month : parseInt(String(date.month), 10);
              if (isNaN(monthNum)) return String(date.month).replace(/\s*Week\s*\d+/i, '').replace(/\d+/g, '').trim() || 'Unknown';
              // Convert month number to month name (1-12)
              const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
              return monthNames[Math.max(0, Math.min(11, monthNum - 1))] || 'Unknown';
            })()}
          </Text>
          <Text style={[
            styles.ageText,
            isExtraLargeDevice && {
              fontSize: responsiveFontSize.xs,
              lineHeight: scale(13),
            }
          ]}>Age {Math.floor(date?.age || 0)}</Text>
          <View style={styles.weekDots}>
            {[1, 2, 3, 4].map((w, idx) => (
              <Animated.View
                key={w}
                style={[
                  styles.weekDot,
                  isExtraLargeDevice && {
                    width: scale(6),
                    height: scale(6),
                    borderRadius: scale(3),
                    marginHorizontal: 1.5,
                  },
                  { transform: [{ scale: weekAnimations[idx] }] }
                ]}
              />
            ))}
          </View>
        </View>
      </LinearGradient>

      <View style={styles.seasonalAndNextWeekContainer}>
        <View style={styles.nextWeekContainer}>
          <AnimatedView style={animatedStyle}>
            <TouchableOpacity
              onPress={() => {
                if (isAdvancingWeek) return;
                buttonPress();
                haptic('medium');
                setIsAdvancingWeek(true);
                nextWeek();
                // Reset loading state after a short delay with cleanup
                if (timeoutRef.current) {
                  clearTimeout(timeoutRef.current);
                }
                timeoutRef.current = setTimeout(() => {
                  setIsAdvancingWeek(false);
                  timeoutRef.current = null;
                }, 1000);
                addCleanup(() => {
                  if (timeoutRef.current) {
                    clearTimeout(timeoutRef.current);
                    timeoutRef.current = null;
                  }
                });
              }}
              onPressIn={onPressIn}
              onPressOut={onPressOut}
              activeOpacity={0.7}
              disabled={isAdvancingWeek}
              accessibilityLabel={isAdvancingWeek ? "Advancing to next week" : "Advance to next week"}
              accessibilityRole="button"
              accessibilityState={{ disabled: isAdvancingWeek }}
            >
              <LinearGradient colors={isAdvancingWeek ? ['#6B7280', '#9CA3AF'] as const : ['#16A34A', '#22C55E'] as const} style={styles.nextWeekButton} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                {isAdvancingWeek ? (
                  <Animated.View
                    style={{
                      transform: [
                        {
                          rotate: spinValue.interpolate({
                            inputRange: [0, 1],
                            outputRange: ['0deg', '360deg'],
                          }),
                        },
                      ],
                    }}
                  >
                    <ArrowRightCircle size={20} color="#FFFFFF" />
                  </Animated.View>
                ) : (
                  <ArrowRightCircle size={20} color="#FFFFFF" />
                )}
              </LinearGradient>
            </TouchableOpacity>
          </AnimatedView>
        </View>
      </View>
    </View>
  );
}, (prevProps, nextProps) => {
  // Custom comparison function for memoization
  // Only re-render if date properties actually changed
  return (
    prevProps.date?.week === nextProps.date?.week &&
    prevProps.date?.year === nextProps.date?.year &&
    prevProps.date?.month === nextProps.date?.month &&
    prevProps.date?.age === nextProps.date?.age
  );
});

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: responsivePadding.horizontal * 1.2,
    paddingVertical: responsiveSpacing.xs,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden', // Prevent overflow
    // Subtle bottom border for definition
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.04)',
    // Soft shadow for floating effect
    shadowColor: 'rgba(0,0,0,0.06)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 4,
    elevation: 2,
  },
  containerDark: {
    backgroundColor: '#0F172A',
    borderBottomWidth: 0,
    shadowColor: 'transparent',
    elevation: 0,
  },

  leftSection: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'flex-start',
    minWidth: 0, // Allow flex shrinking
    flexShrink: 1,
  },
  generationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: responsiveSpacing.xs * 0.5,
    gap: responsiveSpacing.xs,
  },
  generationBadge: {
    paddingHorizontal: responsiveSpacing.sm,
    paddingVertical: 2,
    borderRadius: responsiveBorderRadius.full,
    backgroundColor: 'rgba(59, 130, 246, 0.08)',
    color: '#1E40AF',
    fontSize: responsiveFontSize.xs,
    fontWeight: '600',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.15)',
    // Light mode: subtle shadow
    shadowColor: 'rgba(59, 130, 246, 0.2)',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 1,
    shadowRadius: 2,
  },
  generationBadgeDark: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    color: '#E5E7EB',
    borderWidth: 0,
    shadowColor: 'transparent',
  },
  prestigeBadgeContainer: {
    borderRadius: responsiveBorderRadius.full,
    overflow: 'hidden',
  },
  prestigeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: responsiveSpacing.sm,
    paddingVertical: 2,
    borderRadius: responsiveBorderRadius.full,
    gap: 4,
    backgroundColor: '#F59E0B',
    shadowColor: 'rgba(245, 158, 11, 0.4)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 6,
    elevation: 4,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
  },
  prestigeBadgeText: {
    fontSize: responsiveFontSize.xs,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  leftIconRow: { flexDirection: 'row', marginBottom: responsiveSpacing.xs },

  iconButton: {
    width: isIPad() ? touchTargets.large : touchTargets.minimum,
    height: isIPad() ? touchTargets.large : touchTargets.minimum,
    marginRight: responsiveSpacing.xs,
    borderRadius: (isIPad() ? touchTargets.large : touchTargets.minimum) / 2,
    overflow: 'hidden',
    backgroundColor: 'transparent',
  },
  iconButtonDark: {},
  iconButtonGradient: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: scale(2), // Minimal spacing to prevent collapsing but reduce dead space
    minHeight: scale(18), // Ensure minimum height to prevent collapsing
  },
  statArrowContainer: {
    marginLeft: scale(6),
    alignItems: 'center',
    justifyContent: 'center',
    width: scale(20),
  },
  diseaseIndicator: {
    backgroundColor: '#F59E0B',
    borderRadius: scale(10),
    paddingHorizontal: scale(6),
    paddingVertical: scale(2),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: scale(20),
    height: scale(18),
  },
  diseaseIndicatorSerious: {
    backgroundColor: '#EF4444',
  },
  diseaseIndicatorCritical: {
    backgroundColor: '#DC2626',
  },
  diseaseIndicatorCount: {
    fontSize: scale(10),
    fontWeight: '700',
    color: '#FFFFFF',
    marginLeft: scale(2),
  },

  // Progress bars
  progressBarWrapper: {
    height: isIPad() ? scale(24) : scale(16),
    backgroundColor: '#F1F5F9',
    borderRadius: responsiveBorderRadius.lg,
    marginLeft: responsiveSpacing.sm,
    overflow: 'hidden',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
    minWidth: scale(60), // Ensure minimum width to prevent collapsing
    flexShrink: 1, // Allow progress bars to yield space when layout is tight
    // Light mode: subtle inner shadow
    shadowColor: 'rgba(0,0,0,0.08)',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 1,
    shadowRadius: 2,
    elevation: 1,
  },
  progressBarWrapperDark: {
    backgroundColor: '#334155',
    borderWidth: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  progressFill: {
    height: '100%',
    borderRadius: responsiveBorderRadius.lg,
    backgroundColor: '#3B82F6',
    // Subtle glow effect
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  progressFillDark: {
    backgroundColor: '#3B82F6',
    shadowColor: 'transparent',
  },

  // --- NEW CHIP STYLES ---
  moneyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: responsiveSpacing.md,
    width: '100%',
  },
  leftMoneySection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: responsiveSpacing.sm,
    flexWrap: 'wrap', // Allow wrapping on small devices
    flexShrink: 1,
    maxWidth: '100%', // Add max width constraint to prevent overflow
  },
  moneyChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    height: 28,
    borderRadius: 999,          // true pill
    flexShrink: 1, // Changed from 0 to allow shrinking on very small screens
    minWidth: 60, // Reduced from 70
    overflow: 'hidden', // Prevent text overflow
    maxWidth: '100%', // Ensure chip doesn't exceed container
  },
  chipIcon: {
    marginRight: 6,
    flexShrink: 0, // Icon should never shrink
  },
  chipTextContainer: {
    flexShrink: 1, // Allow text container to shrink
    minWidth: 0, // Allow flex shrinking
    maxWidth: '100%', // Prevent overflow
  },
  chipText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: responsiveFontSize.sm,
    lineHeight: 18,
    flexShrink: 1, // Allow text to shrink if needed
  },

  // Right side
  rightSection: {
    alignItems: 'flex-end',
    flexShrink: 0, // Changed from 1 to prevent shrinking too much
    flexBasis: 'auto',
    minWidth: 0, // Allow flex shrinking
    marginLeft: responsiveSpacing.md, // Reduced from lg on small devices (will be overridden dynamically)
    marginTop: responsiveSpacing.md,
    // Max width will be set dynamically in component to prevent overflow
  },
  dateOuter: {
    padding: 2,
    borderRadius: responsiveBorderRadius.lg,
    marginBottom: responsiveSpacing.xs,
    flexShrink: 1,
  },
  dateInner: {
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: responsiveBorderRadius.md,
    backgroundColor: 'rgba(255,255,255,0.15)',
    height: '100%',
  },
  dateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 2,
  },
  yearText: {
    fontSize: responsiveFontSize.lg,
    fontWeight: '800',
    color: '#FFFFFF',
    lineHeight: 20,
  },
  monthText: {
    fontSize: responsiveFontSize.base,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    lineHeight: 18,
    marginTop: 2,
  },
  ageText: {
    fontSize: responsiveFontSize.sm,
    fontWeight: '700',
    color: '#FFFFFF',
    lineHeight: 16,
    marginTop: 2,
  },

  weekDots: {
    flexDirection: 'row',
    marginTop: 4,
    marginBottom: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  weekDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    marginHorizontal: 2,
    backgroundColor: 'rgba(255,255,255,0.9)'
  },

  seasonalAndNextWeekContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: responsiveSpacing.sm,
    marginTop: responsiveSpacing.xs,
  },
  nextWeekContainer: { alignItems: 'center' },
  nextWeekButton: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: responsiveBorderRadius.lg,
    width: 50, // Square button
    height: 50, // Square button
    // Light mode button shadow
    shadowColor: 'rgba(22, 163, 74, 0.3)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },

  statTouchable: { width: '100%' },
  statRowContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    flex: 1,
    minHeight: scale(18), // Ensure minimum height
  },
  statIconContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: responsiveSpacing.xs,
    flexShrink: 0, // Prevent icon from shrinking
  },

  quickActionsContainer: {
    position: 'absolute',
    top: 40,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    borderRadius: responsiveBorderRadius.md,
    padding: responsiveSpacing.sm,
    zIndex: Z_INDEX.DROPDOWN,
  },
  quickActionButton: {
    marginBottom: responsiveSpacing.xs,
  },
  quickActionGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: responsiveSpacing.sm,
    paddingVertical: responsiveSpacing.xs,
    borderRadius: responsiveBorderRadius.sm,
  },
  quickActionText: {
    color: '#FFFFFF',
    fontSize: responsiveFontSize.sm,
    fontWeight: '600',
    marginLeft: responsiveSpacing.xs,
  }
});

// Export memoized TopStatsBar - no props, so it will re-render on gameState changes
// but we've optimized it to only subscribe to specific gameState properties
export default React.memo(TopStatsBarComponent);
