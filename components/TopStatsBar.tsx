// components/TopStatsBar.tsx
import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  useWindowDimensions,
  Alert,
  Easing,
  Platform,
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
} from '@/utils/scaling';
import { useGame } from '@/contexts/GameContext';
import { LinearGradient } from 'expo-linear-gradient';
import AnimatedMoney from '@/components/ui/AnimatedMoney';
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
} from 'lucide-react-native';
import SettingsModal from './SettingsModal';
import GemShopModal from './GemShopModal';
import HelpModal from './HelpModal';
import PrestigeButton from './PrestigeButton';
import PrestigeModal from './PrestigeModal';
import SeasonalIndicator from './SeasonalIndicator';
import usePressableScale from '@/hooks/usePressableScale';
import { useFeedback } from '@/utils/feedbackSystem';
import { DesignSystem } from '@/utils/designSystem';
import { usePerformanceMonitor, useMemoryCleanup } from '@/utils/performanceOptimization';
import { getProgressAccessibilityProps, ACCESSIBILITY_HINTS } from '@/utils/accessibility';

export default function TopStatsBar() {
  const { gameState, nextWeek } = useGame();
  const { success, buttonPress, haptic } = useFeedback(gameState.settings.hapticFeedback);
  const { logRender } = usePerformanceMonitor();
  const { addCleanup } = useMemoryCleanup();
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // All hooks must be called before any early returns (Rules of Hooks)
  const [showSettings, setShowSettings] = useState(false);
  const [showGemShop, setShowGemShop] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showQuickActions, setShowQuickActions] = useState<string | null>(null);
  const [showPrestigeModal, setShowPrestigeModal] = useState(false);

  // Glow anims (JS driver)
  const glowAnimations = {
    health: useRef(new Animated.Value(0)).current,
    happiness: useRef(new Animated.Value(0)).current,
    energy: useRef(new Animated.Value(0)).current,
  };

  // Stat anims (JS driver) - must be initialized before early return (Rules of Hooks)
  const animatedStats = useRef({
    health: new Animated.Value(gameState?.stats?.health ?? 0),
    happiness: new Animated.Value(gameState?.stats?.happiness ?? 0),
    energy: new Animated.Value(gameState?.stats?.energy ?? 0),
  }).current;

  // Don't render if no game state or if we're in onboarding
  if (!gameState?.stats || !gameState?.userProfile) return null;

  const { stats, settings, bankSavings = 0, stocks, generationNumber } = gameState;

  const getStatColor = (stat: string, value: number) => {
    if (stat === 'health') return '#EF4444';
    if (value >= 80) return '#10B981';
    if (value >= 60) return '#F59E0B';
    if (value >= 40) return '#EF4444';
    return '#DC2626';
  };

  const getGlowColor = (stat: string, value: number) => {
    if (stat === 'health') return 'rgba(239, 68, 68, 0.3)';
    if (value >= 80) return 'rgba(16, 185, 129, 0.3)';
    if (value >= 60) return 'rgba(245, 158, 11, 0.3)';
    if (value >= 40) return 'rgba(239, 68, 68, 0.3)';
    return 'rgba(220, 38, 38, 0.4)';
  };

  const shouldGlow = (value: number) => value >= 90 || value <= 20;

  const handleQuickAction = useCallback((action: string) => {
    buttonPress();
    setShowQuickActions(null);
    
    switch (action) {
      case 'eat':
        haptic('success');
        success('🍎 You feel refreshed after eating something healthy!');
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
      health: getStatColor('health', stats.health),
      happiness: getStatColor('happiness', stats.happiness),
      energy: getStatColor('energy', stats.energy),
    }),
    [stats.health, stats.happiness, stats.energy]
  );

  const glowColors = useMemo(
    () => ({
      health: getGlowColor('health', stats.health),
      happiness: getGlowColor('happiness', stats.happiness),
      energy: getGlowColor('energy', stats.energy),
    }),
    [stats.health, stats.happiness, stats.energy]
  );

  // Memoized stat values for better performance
  const statValues = useMemo(
    () => ({
      health: Math.max(0, Math.min(100, stats.health ?? 0)),
      happiness: Math.max(0, Math.min(100, stats.happiness ?? 0)),
      energy: Math.max(0, Math.min(100, stats.energy ?? 0)),
    }),
    [stats.health, stats.happiness, stats.energy]
  );

  // Optimized animation effect with better performance
  useEffect(() => {
    logRender('TopStatsBar');
    
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

    // Use requestAnimationFrame for smoother updates
    const rafId = requestAnimationFrame(animateStats);
    
    return () => {
      cancelAnimationFrame(rafId);
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

    const activeGlowAnimations = [
      runGlow('health', stats.health),
      runGlow('happiness', stats.happiness),
      runGlow('energy', stats.energy)
    ].filter(Boolean);

    // Cleanup function
    return () => {
      healthAnimation.stop();
      happinessAnimation.stop();
      energyAnimation.stop();
      activeGlowAnimations.forEach(anim => anim?.stop());
    };
  }, [stats.health, stats.happiness, stats.energy, animatedStats, glowAnimations]);

  const progressStats = React.useMemo(
    () => [
      {
        key: 'health',
        icon: Heart,
        value: stats.health,
        color: statColors.health,
        gradient: ['#EF4444', '#F87171'] as [string, string],
        max: 100,
        quickActions: [
          { icon: Apple, label: 'Eat Healthy', action: () => handleQuickAction('eat') },
          { icon: Coffee, label: 'Rest', action: () => handleQuickAction('rest') },
        ],
      },
      {
        key: 'happiness',
        icon: Smile,
        value: stats.happiness,
        color: '#F59E0B',
        gradient: ['#F59E0B', '#FBBF24'] as [string, string],
        max: 100,
        quickActions: [
          { icon: Coffee, label: 'Socialize', action: () => handleQuickAction('social') },
          { icon: Dumbbell, label: 'Exercise', action: () => handleQuickAction('exercise') },
        ],
      },
      {
        key: 'energy',
        icon: Zap,
        value: stats.energy,
        color: '#3B82F6',
        gradient: ['#3B82F6', '#60A5FA'] as [string, string],
        max: 100,
        quickActions: [
          { icon: Coffee, label: 'Rest', action: () => handleQuickAction('rest') },
          { icon: Apple, label: 'Eat', action: () => handleQuickAction('eat') },
        ],
      },
    ],
    [stats.health, stats.happiness, stats.energy, statColors, handleQuickAction]
  );

  const weekAnimations = useRef([
    new Animated.Value(1),
    new Animated.Value(1),
    new Animated.Value(1),
    new Animated.Value(1),
  ]).current;

  useEffect(() => {
    const currentIndex = Math.min(3, Math.max(0, (gameState?.date?.week ?? 1) - 1));
    Animated.sequence([
      Animated.timing(weekAnimations[currentIndex], { toValue: 1.35, duration: 180, useNativeDriver: false }),
      Animated.timing(weekAnimations[currentIndex], { toValue: 1, duration: 180, useNativeDriver: false }),
    ]).start();
  }, [gameState?.date?.week, weekAnimations]);

  const { width } = useWindowDimensions();
  const getProgressBarWidth = () => {
    // Calculate available width for progress bars (accounting for padding, icons, and right section)
    const containerPadding = responsivePadding.horizontal * 1.2 * 2; // left + right padding
    const iconWidth = (isIPad() ? touchTargets.large : touchTargets.minimum) + responsiveSpacing.xs; // icon + margin
    const rightSectionWidth = isIPad() ? scale(170) : (isSmallDevice() && width < 340 ? scale(100) : scale(115));
    const rightSectionMargin = responsiveSpacing.lg;
    const availableWidth = width - containerPadding - iconWidth - rightSectionWidth - rightSectionMargin;
    
    if (isIPad()) return Math.min(360, Math.max(240, availableWidth * 0.9));
    if (isSmallDevice()) {
      // On very small devices, use a more conservative calculation
      if (width < 340) return Math.min(120, Math.max(80, availableWidth * 0.85));
      return Math.min(140, Math.max(100, availableWidth * 0.88));
    }
    if (isLargeDevice()) return Math.min(200, Math.max(150, availableWidth * 0.9));
    return Math.min(160, Math.max(120, availableWidth * 0.88));
  };
  const progressBarWidth = getProgressBarWidth();

  const { AnimatedView, animatedStyle, onPressIn, onPressOut, onHaptic } = usePressableScale();

  const darkMode = !!settings?.darkMode;
  // Dynamic container padding for small devices
  const containerPadding = isSmallDevice() && width < 340 
    ? responsivePadding.horizontal * 0.8 
    : responsivePadding.horizontal * 1.2;
  const containerMinHeight = isIPad() 
    ? scale(200) 
    : (isSmallDevice() && width < 340 ? scale(140) : scale(160));
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
    const showDecimals = settings.showDecimalsInStats;
    
    if (a >= 1_000_000_000_000_000) {
      return showDecimals ? `${(a / 1_000_000_000_000_000).toFixed(2)}Q` : `${Math.floor(a / 1_000_000_000_000_000)}Q`;
    }
    if (a >= 1_000_000_000_000) {
      return showDecimals ? `${(a / 1_000_000_000_000).toFixed(2)}T` : `${Math.floor(a / 1_000_000_000_000)}T`;
    }
    if (a >= 1_000_000_000) {
      return showDecimals ? `${(a / 1_000_000_000).toFixed(2)}B` : `${Math.floor(a / 1_000_000_000)}B`;
    }
    if (a >= 1_000_000) {
      return showDecimals ? `${(a / 1_000_000).toFixed(2)}M` : `${Math.floor(a / 1_000_000)}M`;
    }
    if (a >= 1_000) {
      return showDecimals ? `${(a / 1_000).toFixed(2)}K` : `${Math.floor(a / 1_000)}K`;
    }
    return `${a}`;
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
    const showDecimals = settings.showDecimalsInStats;
    
    if (a >= 1_000_000_000_000_000) {
      return showDecimals ? `${(a / 1_000_000_000_000_000).toFixed(2)}Q` : `${Math.floor(a / 1_000_000_000_000_000)}Q`;
    }
    if (a >= 1_000_000_000_000) {
      return showDecimals ? `${(a / 1_000_000_000_000).toFixed(2)}T` : `${Math.floor(a / 1_000_000_000_000)}T`;
    }
    if (a >= 1_000_000_000) {
      return showDecimals ? `${(a / 1_000_000_000).toFixed(2)}B` : `${Math.floor(a / 1_000_000_000)}B`;
    }
    if (a >= 1_000_000) {
      return showDecimals ? `${(a / 1_000_000).toFixed(2)}M` : `${Math.floor(a / 1_000_000)}M`;
    }
    if (a >= 1_000) {
      return showDecimals ? `${(a / 1_000).toFixed(2)}K` : `${Math.floor(a / 1_000)}K`;
    }
    return `${a}`;
  };

  return (
    <View style={containerStyle}>
      {/* Left: generation badge + controls + stats */}
      <View style={[styles.leftSection, { minWidth: 0 }]}>
        <View style={styles.generationRow}>
          <Text style={[styles.generationBadge, darkMode && styles.generationBadgeDark]}>
            Gen {generationNumber ?? 1}
          </Text>
          {gameState.prestige?.prestigeLevel > 0 && (
            <View style={styles.prestigeBadgeContainer}>
              <LinearGradient
                colors={['#FCD34D', '#F59E0B', '#D97706']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.prestigeBadge}
              >
                <Crown size={12} color="#FFFFFF" />
                <Text style={styles.prestigeBadgeText}>P{gameState.prestige.prestigeLevel}</Text>
              </LinearGradient>
            </View>
          )}
        </View>
        <View style={styles.leftIconRow}>
          <TouchableOpacity 
            onPress={() => { buttonPress(); setShowGemShop(true); }} 
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
            onPress={() => { buttonPress(); setShowHelp(true); }} 
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
            onPress={() => { buttonPress(); setShowSettings(true); }} 
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

        {progressStats.map(({ key, icon: Icon, color, gradient, max, quickActions, value }) => {
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
              <TouchableOpacity
                style={styles.statTouchable}
                onLongPress={() => setShowQuickActions(showQuickActions === key ? null : key)}
                onPress={() => buttonPress()}
                activeOpacity={0.7}
                {...accessibilityProps}
                accessibilityHint={`${accessibilityProps.accessibilityHint}. Long press to see quick actions.`}
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
                </View>
              </TouchableOpacity>

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
                      <LinearGradient colors={['#3B82F6', '#1D4ED8']} style={styles.quickActionGradient}>
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
          <View style={[styles.leftMoneySection, { flexWrap: isSmallDevice() && width < 360 ? 'wrap' : 'nowrap' }]}>
            <LinearGradient 
              colors={['#16A34A', '#22C55E']} 
              style={[
                styles.moneyChip,
                isSmallDevice() && width < 340 && { 
                  paddingHorizontal: scale(8), 
                  minWidth: scale(60) 
                }
              ]} 
              start={{ x: 0, y: 0 }} 
              end={{ x: 1, y: 1 }}
              accessibilityLabel={ACCESSIBILITY_HINTS.GAME_ELEMENTS.MONEY}
              accessibilityRole="text"
            >
              <Wallet size={14} color="#FFFFFF" style={styles.chipIcon} />
              <AnimatedMoney value={stats.money} style={styles.chipText} duration={300} />
            </LinearGradient>

            <LinearGradient 
              colors={['#F59E0B', '#FBBF24']} 
              style={[
                styles.moneyChip,
                isSmallDevice() && width < 340 && { 
                  paddingHorizontal: scale(8), 
                  minWidth: scale(60) 
                }
              ]} 
              start={{ x: 0, y: 0 }} 
              end={{ x: 1, y: 1 }}
              accessibilityLabel={`Total savings: ${formatSavings(totalSavings)}`}
              accessibilityRole="text"
            >
              <PiggyBank size={14} color="#FFFFFF" style={styles.chipIcon} />
              <Text style={styles.chipText}>{formatSavings(totalSavings)}</Text>
            </LinearGradient>

            <View>
              <LinearGradient 
                colors={['#6366F1', '#4F46E5']} 
                style={[
                  styles.moneyChip,
                  isSmallDevice() && width < 340 && { 
                    paddingHorizontal: scale(8), 
                    minWidth: scale(60) 
                  }
                ]} 
                start={{ x: 0, y: 0 }} 
                end={{ x: 1, y: 1 }}
                accessibilityLabel={`Gems: ${formatGems(stats.gems)}`}
                accessibilityRole="text"
              >
                <Gem size={14} color="#FFFFFF" style={styles.chipIcon} />
                <Text style={styles.chipText}>{formatGems(stats.gems)}</Text>
              </LinearGradient>
            </View>
          </View>
        </View>
      </View>

      {/* Right: date + next week */}
      <RightSide />
      {/* Modals */}
      <SettingsModal visible={showSettings} onClose={() => setShowSettings(false)} />
      <GemShopModal visible={showGemShop} onClose={() => setShowGemShop(false)} />
      <HelpModal visible={showHelp} onClose={() => setShowHelp(false)} />
      <PrestigeModal
        visible={showPrestigeModal}
        onClose={() => setShowPrestigeModal(false)}
      />
    </View>
  );
}

function RightSide() {
  const { gameState, nextWeek } = useGame();
  const { width } = useWindowDimensions();
  const { AnimatedView, animatedStyle, onPressIn, onPressOut, onHaptic } = usePressableScale();
  const { buttonPress, haptic } = useFeedback(gameState.settings.hapticFeedback);
  const { addCleanup } = useMemoryCleanup();
  const [isAdvancingWeek, setIsAdvancingWeek] = useState(false);
  const spinValue = useRef(new Animated.Value(0)).current;
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const weekAnimations = useRef([
    new Animated.Value(1),
    new Animated.Value(1),
    new Animated.Value(1),
    new Animated.Value(1),
  ]).current;

  useEffect(() => {
    const idx = Math.min(3, Math.max(0, (gameState?.date?.week ?? 1) - 1));
    Animated.sequence([
      Animated.timing(weekAnimations[idx], { toValue: 1.35, duration: 180, useNativeDriver: false }),
      Animated.timing(weekAnimations[idx], { toValue: 1, duration: 180, useNativeDriver: false }),
    ]).start();
  }, [gameState?.date?.week, weekAnimations]);

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

  // Calculate responsive date box dimensions with better constraints
  const containerPadding = responsivePadding.horizontal * 1.2 * 2;
  const leftSectionMinWidth = isSmallDevice() && width < 340 ? width * 0.65 : width * 0.6;
  const availableRightWidth = width - containerPadding - leftSectionMinWidth;
  
  const dateBoxWidth = isIPad() 
    ? scale(170) 
    : isSmallDevice() && width < 340
      ? Math.min(scale(90), Math.max(scale(70), availableRightWidth * 0.9)) // Extra small constraint
      : Math.min(scale(110), Math.max(scale(85), availableRightWidth * 0.95));
  const dateBoxMaxWidth = isIPad() 
    ? scale(170) 
    : isSmallDevice() && width < 340 
      ? scale(90) 
      : scale(110);
  const dateBoxHeight = isIPad() 
    ? scale(140) 
    : isSmallDevice() && width < 340
      ? scale(80) // Extra small height
      : isSmallDevice() 
        ? scale(90) 
        : scale(100);
  const dateBoxMinHeight = isIPad() ? scale(140) : (isSmallDevice() && width < 340 ? scale(75) : scale(85));

  return (
      <View style={styles.rightSection}>
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
          ]} 
          start={{ x: 0, y: 0 }} 
          end={{ x: 1, y: 1 }}
        >
          <View style={styles.dateInner}>
            <View style={styles.dateHeader}>
              <Text style={styles.yearText}>{Math.floor(gameState.date.year || 2025)}</Text>
            </View>
            <Text 
              style={styles.monthText}
              numberOfLines={1}
              adjustsFontSizeToFit={true}
              minimumFontScale={0.7}
            >
              {gameState.date.month}
            </Text>
            <Text style={styles.ageText}>Age {Math.floor(gameState.date.age)}</Text>
            <View style={styles.weekDots}>
              {[1, 2, 3, 4].map((w, idx) => (
                <Animated.View key={w} style={[styles.weekDot, { transform: [{ scale: weekAnimations[idx] }] }]} />
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
            <LinearGradient colors={isAdvancingWeek ? ['#6B7280', '#9CA3AF'] : ['#16A34A', '#22C55E']} style={styles.nextWeekButton} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
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
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: responsivePadding.horizontal * 1.2,
    paddingVertical: responsiveSpacing.xs,
    backgroundColor: '#0F172A', // matches your dark screenshot background
    overflow: 'hidden', // Prevent overflow
  },
  containerDark: { backgroundColor: '#0F172A' },

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
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    color: '#E5E7EB',
    fontSize: responsiveFontSize.xs,
    fontWeight: '600',
  },
  generationBadgeDark: {
    backgroundColor: 'rgba(15, 118, 110, 0.3)',
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
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 5,
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

  statRow: { flexDirection: 'row', alignItems: 'center', marginBottom: responsiveSpacing.xs },

  // Progress bars
  progressBarWrapper: {
    height: isIPad() ? scale(24) : scale(16),
    backgroundColor: '#334155',
    borderRadius: responsiveBorderRadius.lg,
    marginLeft: responsiveSpacing.sm,
    overflow: 'hidden',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        boxShadow: '0px 1px 2px rgba(0, 0, 0, 0.1)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
      },
      android: {
        elevation: 1,
      },
      web: {
        boxShadow: '0px 1px 2px rgba(0, 0, 0, 0.1)',
      },
      default: {
        boxShadow: '0px 1px 2px rgba(0, 0, 0, 0.1)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 1,
      },
    }),
  },
  progressBarWrapperDark: { backgroundColor: '#334155' },
  progressFill: { 
    height: '100%', 
    borderRadius: responsiveBorderRadius.lg,
    ...Platform.select({
      ios: {
        boxShadow: '0px 1px 3px rgba(0, 0, 0, 0.2)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.2,
        shadowRadius: 3,
      },
      android: {
        elevation: 2,
      },
      web: {
        boxShadow: '0px 1px 3px rgba(0, 0, 0, 0.2)',
      },
      default: {
        boxShadow: '0px 1px 3px rgba(0, 0, 0, 0.2)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.2,
        shadowRadius: 3,
        elevation: 2,
      },
    }),
  },
  progressFillDark: {},

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
  },
  moneyChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: isIPad() ? scale(18) : scale(12),
    height: isIPad() ? scale(36) : scale(28),
    borderRadius: 999,          // true pill
    flexShrink: 0, // Prevent chips from shrinking
    minWidth: isIPad() ? scale(80) : scale(70),
  },
  chipIcon: { marginRight: 6 },
  chipText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: isIPad() ? responsiveFontSize.lg : responsiveFontSize.sm,
    lineHeight: isIPad() ? scale(22) : scale(18),
  },

  // Right side
  rightSection: { 
    alignItems: 'flex-end', 
    flexShrink: 1,
    flexBasis: 'auto',
    minWidth: 0, // Allow flex shrinking
    marginLeft: responsiveSpacing.lg, 
    marginTop: responsiveSpacing.md,
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
    paddingHorizontal: scale(8),
    paddingVertical: scale(6),
    borderRadius: responsiveBorderRadius.md,
    backgroundColor: 'rgba(255,255,255,0.15)',
    height: '100%',
  },
  dateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: scale(2),
  },
  yearText: { 
    fontSize: isIPad() ? responsiveFontSize['2xl'] : responsiveFontSize.lg, 
    fontWeight: '800', 
    color: '#FFFFFF',
    lineHeight: isIPad() ? scale(28) : scale(20),
    numberOfLines: 1,
  },
  monthText: { 
    fontSize: isIPad() ? responsiveFontSize.lg : (isSmallDevice() ? responsiveFontSize.sm : responsiveFontSize.md), 
    fontWeight: '700', 
    color: '#FFFFFF',
    textAlign: 'center',
    lineHeight: isIPad() ? scale(24) : (isSmallDevice() ? scale(16) : scale(18)),
    marginTop: scale(2),
  },
  ageText: { 
    fontSize: isIPad() ? responsiveFontSize.lg : (isSmallDevice() ? responsiveFontSize.xs : responsiveFontSize.sm), 
    fontWeight: '700', 
    color: '#FFFFFF',
    lineHeight: isIPad() ? scale(22) : (isSmallDevice() ? scale(14) : scale(16)),
    marginTop: scale(2),
    numberOfLines: 1,
  },

  weekDots: { 
    flexDirection: 'row', 
    marginTop: scale(4), 
    marginBottom: scale(2),
    justifyContent: 'center',
    alignItems: 'center',
  },
  weekDot: { 
    width: isIPad() ? scale(10) : scale(7), 
    height: isIPad() ? scale(10) : scale(7), 
    borderRadius: isIPad() ? scale(5) : scale(3.5), 
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
    width: isIPad() ? scale(70) : scale(50), // Square button
    height: isIPad() ? scale(70) : scale(50), // Square button
    ...Platform.select({
      ios: {
        boxShadow: '0px 2px 4px rgba(22, 163, 74, 0.3)',
        shadowColor: '#16A34A',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
      web: {
        boxShadow: '0px 2px 4px rgba(22, 163, 74, 0.3)',
      },
      default: {
        boxShadow: '0px 2px 4px rgba(22, 163, 74, 0.3)',
        shadowColor: '#16A34A',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        elevation: 3,
      },
    }),
  },

  statTouchable: { width: '100%' },
  statRowContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start' },
  statIconContainer: { flexDirection: 'row', alignItems: 'center', marginRight: responsiveSpacing.xs },

  quickActionsContainer: {
    position: 'absolute',
    top: scale(40),
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    borderRadius: responsiveBorderRadius.md,
    padding: responsiveSpacing.sm,
    zIndex: 1000,
  },
  quickActionButton: { marginBottom: responsiveSpacing.xs },
  quickActionGradient: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: responsiveSpacing.sm, paddingVertical: responsiveSpacing.xs, borderRadius: responsiveBorderRadius.sm },
  quickActionText: { color: '#FFFFFF', fontSize: responsiveFontSize.sm, fontWeight: '600', marginLeft: responsiveSpacing.xs },
});
