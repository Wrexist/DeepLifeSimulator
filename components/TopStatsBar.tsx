// components/TopStatsBar.tsx
import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  useWindowDimensions,
  Alert,
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
} from '@/utils/scaling';
import { useGame } from '@/contexts/GameContext';
import { LinearGradient } from 'expo-linear-gradient';
import AnimatedMoney from '@/components/ui/AnimatedMoney';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
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
} from 'lucide-react-native';
import SettingsModal from './SettingsModal';
import GemShopModal from './GemShopModal';
import HelpModal from './HelpModal';
import usePressableScale from '@/hooks/usePressableScale';

export default function TopStatsBar() {
  const { gameState, nextWeek } = useGame();
  const { triggerButtonPress } = useHapticFeedback();
  
  if (!gameState?.stats) return null;

  const { stats, settings, bankSavings = 0 } = gameState;
  const [showSettings, setShowSettings] = useState(false);
  const [showGemShop, setShowGemShop] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showQuickActions, setShowQuickActions] = useState<string | null>(null);

  // Glow anims (JS driver)
  const glowAnimations = {
    health: useRef(new Animated.Value(0)).current,
    happiness: useRef(new Animated.Value(0)).current,
    energy: useRef(new Animated.Value(0)).current,
  };

  // Stat anims (JS driver)
  const animatedStats = useRef({
    health: new Animated.Value(stats.health),
    happiness: new Animated.Value(stats.happiness),
    energy: new Animated.Value(stats.energy),
  }).current;

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

  const handleQuickAction = (action: string) => {
    triggerButtonPress();
    setShowQuickActions(null);
    switch (action) {
      case 'eat':
        Alert.alert('🍎 Quick Eat', 'You feel refreshed after eating something healthy!');
        break;
      case 'rest':
        Alert.alert('😴 Quick Rest', 'You feel more energized after taking a break!');
        break;
      case 'social':
        Alert.alert('👥 Socialize', 'Spending time with others lifts your mood!');
        break;
      case 'exercise':
        Alert.alert('💪 Exercise', 'You feel stronger and happier after working out!');
        break;
    }
  };

  const statColors = React.useMemo(
    () => ({
      health: getStatColor('health', stats.health),
      happiness: getStatColor('happiness', stats.happiness),
      energy: getStatColor('energy', stats.energy),
    }),
    [stats.health, stats.happiness, stats.energy]
  );

  const glowColors = React.useMemo(
    () => ({
      health: getGlowColor('health', stats.health),
      happiness: getGlowColor('happiness', stats.happiness),
      energy: getGlowColor('energy', stats.energy),
    }),
    [stats.health, stats.happiness, stats.energy]
  );

  useEffect(() => {
    const to = (v: number) => Math.max(0, Math.min(100, v ?? 0));

    Animated.timing(animatedStats.health, {
      toValue: to(stats.health),
      duration: 300,
      useNativeDriver: false,
    }).start();

    Animated.timing(animatedStats.happiness, {
      toValue: to(stats.happiness),
      duration: 300,
      useNativeDriver: false,
    }).start();

    Animated.timing(animatedStats.energy, {
      toValue: to(stats.energy),
      duration: 300,
      useNativeDriver: false,
    }).start();

    const runGlow = (key: 'health' | 'happiness' | 'energy', value: number) => {
      if (shouldGlow(value)) {
        Animated.loop(
          Animated.sequence([
            Animated.timing(glowAnimations[key], { toValue: 1, duration: 1000, useNativeDriver: false }),
            Animated.timing(glowAnimations[key], { toValue: 0, duration: 1000, useNativeDriver: false }),
          ])
        ).start();
      } else {
        Animated.timing(glowAnimations[key], { toValue: 0, duration: 500, useNativeDriver: false }).start();
      }
    };

    runGlow('health', stats.health);
    runGlow('happiness', stats.happiness);
    runGlow('energy', stats.energy);
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
    [stats, statColors]
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
    if (isSmallDevice()) return Math.min(150, Math.max(110, width * 0.42));
    if (isLargeDevice()) return Math.min(200, Math.max(150, width * 0.46));
    return Math.min(180, Math.max(130, width * 0.44));
  };
  const progressBarWidth = getProgressBarWidth();

  const { AnimatedView, animatedStyle, onPressIn, onPressOut, onHaptic } = usePressableScale();

  const darkMode = !!settings?.darkMode;
  const containerStyle = [styles.container, darkMode && styles.containerDark];
  const iconColor = darkMode ? '#E5E7EB' : '#111827';

  const controlButtonGradient: [string, string] = darkMode
    ? ['#1F2937', '#111827']
    : ['#FFFFFF', '#F3F4F6'];

  const formatGems = (amount: number) => {
    const a = Math.floor(amount || 0);
    if (a >= 1_000_000_000_000_000) return `${(a / 1_000_000_000_000_000).toFixed(2)}Q`;
    if (a >= 1_000_000_000_000) return `${(a / 1_000_000_000_000).toFixed(2)}T`;
    if (a >= 1_000_000_000) return `${(a / 1_000_000_000).toFixed(2)}B`;
    if (a >= 1_000_000) return `${(a / 1_000_000).toFixed(2)}M`;
    if (a >= 1_000) return `${(a / 1_000).toFixed(2)}K`;
    return `${a}`;
  };

  return (
    <View style={containerStyle}>
      {/* Left: controls + stats */}
      <View style={styles.leftSection}>
        <View style={styles.leftIconRow}>
          <TouchableOpacity onPress={() => { triggerButtonPress(); setShowGemShop(true); }} style={[styles.iconButton, darkMode && styles.iconButtonDark]} activeOpacity={0.85}>
            <LinearGradient colors={controlButtonGradient} style={styles.iconButtonGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
              <ShoppingCart size={22} color={iconColor} />
            </LinearGradient>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => { triggerButtonPress(); setShowHelp(true); }} style={[styles.iconButton, darkMode && styles.iconButtonDark]} activeOpacity={0.85}>
            <LinearGradient colors={controlButtonGradient} style={styles.iconButtonGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
              <HelpCircle size={22} color={iconColor} />
            </LinearGradient>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => { triggerButtonPress(); setShowSettings(true); }} style={[styles.iconButton, darkMode && styles.iconButtonDark]} activeOpacity={0.85}>
            <LinearGradient colors={controlButtonGradient} style={styles.iconButtonGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
              <Settings size={22} color={iconColor} />
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {progressStats.map(({ key, icon: Icon, color, gradient, max, quickActions, value }) => {
          const val = animatedStats[key as 'health' | 'happiness' | 'energy'];
          const progressWidth = val.interpolate({
            inputRange: [0, max],
            outputRange: ['0%', '100%'],
            extrapolate: 'clamp',
          });

          return (
            <View key={key} style={styles.statRow}>
              <TouchableOpacity
                style={styles.statTouchable}
                onLongPress={() => setShowQuickActions(showQuickActions === key ? null : key)}
                onPress={() => triggerButtonPress()}
                activeOpacity={0.7}
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
                    <TouchableOpacity key={index} style={styles.quickActionButton} onPress={action.action} activeOpacity={0.7}>
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
          <View style={styles.leftMoneySection}>
            <LinearGradient colors={['#16A34A', '#22C55E']} style={styles.moneyChip} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
              <Wallet size={14} color="#FFFFFF" style={styles.chipIcon} />
              <AnimatedMoney value={stats.money} style={styles.chipText} duration={300} />
            </LinearGradient>

            <LinearGradient colors={['#F59E0B', '#FBBF24']} style={styles.moneyChip} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
              <PiggyBank size={14} color="#FFFFFF" style={styles.chipIcon} />
              <AnimatedMoney value={bankSavings} style={styles.chipText} duration={300} />
            </LinearGradient>

            <LinearGradient colors={['#6366F1', '#4F46E5']} style={styles.moneyChip} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
              <Gem size={14} color="#FFFFFF" style={styles.chipIcon} />
              <Text style={styles.chipText}>{formatGems(stats.gems)}</Text>
            </LinearGradient>
          </View>
        </View>
      </View>

      {/* Right: date + next week */}
      <RightSide />
      {/* Modals */}
      <SettingsModal visible={showSettings} onClose={() => setShowSettings(false)} />
      <GemShopModal visible={showGemShop} onClose={() => setShowGemShop(false)} />
      <HelpModal visible={showHelp} onClose={() => setShowHelp(false)} />
    </View>
  );
}

function RightSide() {
  const { gameState, nextWeek } = useGame();
  const { AnimatedView, animatedStyle, onPressIn, onPressOut, onHaptic } = usePressableScale();
  const [isAdvancingWeek, setIsAdvancingWeek] = useState(false);

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

  return (
    <View style={styles.rightSection}>
      <LinearGradient colors={['#60A5FA', '#3B82F6', '#2563EB']} style={styles.dateOuter} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
        <View style={styles.dateInner}>
          <Text style={styles.yearText}>{gameState.date.year}</Text>
          <Text style={styles.monthText}>{gameState.date.month}</Text>
          <Text style={styles.ageText}>Age {Math.floor(gameState.date.age)}</Text>
          <View style={styles.weekDots}>
            {[1, 2, 3, 4].map((w, idx) => (
              <Animated.View key={w} style={[styles.weekDot, { transform: [{ scale: weekAnimations[idx] }] }]} />
            ))}
          </View>
        </View>
      </LinearGradient>

      <View style={styles.nextWeekContainer}>
        <AnimatedView style={animatedStyle}>
          <TouchableOpacity
            onPress={() => {
              if (isAdvancingWeek) return;
              onHaptic();
              setIsAdvancingWeek(true);
              nextWeek();
              // Reset loading state after a short delay
              setTimeout(() => setIsAdvancingWeek(false), 1000);
            }}
            onPressIn={onPressIn}
            onPressOut={onPressOut}
            activeOpacity={0.7}
            disabled={isAdvancingWeek}
          >
            <LinearGradient colors={isAdvancingWeek ? ['#6B7280', '#9CA3AF'] : ['#16A34A', '#22C55E']} style={styles.nextWeekButton} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
              <ArrowRightCircle size={16} color="#FFFFFF" />
              <Text style={styles.nextWeekText}>{isAdvancingWeek ? 'Processing...' : 'Next Week'}</Text>
            </LinearGradient>
          </TouchableOpacity>
        </AnimatedView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: responsivePadding.horizontal,
    paddingVertical: responsiveSpacing.xs,
    backgroundColor: '#0F172A', // matches your dark screenshot background
  },
  containerDark: { backgroundColor: '#0F172A' },

  leftSection: { flex: 1, flexDirection: 'column', alignItems: 'flex-start' },
  leftIconRow: { flexDirection: 'row', marginBottom: responsiveSpacing.xs },

  iconButton: {
    width: touchTargets.minimum,
    height: touchTargets.minimum,
    marginRight: responsiveSpacing.md,
    borderRadius: touchTargets.minimum / 2,
    overflow: 'hidden',
    backgroundColor: 'transparent',
  },
  iconButtonDark: {},
  iconButtonGradient: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  statRow: { flexDirection: 'row', alignItems: 'center', marginBottom: responsiveSpacing.xs },

  // Progress bars
  progressBarWrapper: {
    height: scale(16),
    backgroundColor: '#334155',
    borderRadius: responsiveBorderRadius.lg,
    marginLeft: responsiveSpacing.sm,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  progressBarWrapperDark: { backgroundColor: '#334155' },
  progressFill: { height: '100%', borderRadius: responsiveBorderRadius.lg },
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
  },
  moneyChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: scale(12),
    height: scale(28),
    borderRadius: 999,          // true pill
  },
  chipIcon: { marginRight: 6 },
  chipText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: responsiveFontSize.sm,
    lineHeight: scale(18),
  },

  // Right side
  rightSection: { alignItems: 'flex-end', flexShrink: 0, marginLeft: responsiveSpacing.lg, marginTop: 0 },
  dateOuter: { padding: 2, borderRadius: responsiveBorderRadius.lg, marginBottom: responsiveSpacing.xs, height: scale(90), width: scale(110) },
  dateInner: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: scale(10),
    paddingVertical: responsiveSpacing.xs,
    borderRadius: responsiveBorderRadius.md,
    backgroundColor: 'rgba(255,255,255,0.15)',
    height: '100%',
  },

  yearText: { fontSize: responsiveFontSize.xl, fontWeight: '800', color: '#FFFFFF' },
  monthText: { fontSize: responsiveFontSize.lg, fontWeight: '700', color: '#FFFFFF' },
  ageText: { fontSize: responsiveFontSize.lg, fontWeight: '700', color: '#FFFFFF' },

  weekDots: { flexDirection: 'row', marginTop: responsiveSpacing.xs, marginBottom: 2 },
  weekDot: { width: scale(8), height: scale(8), borderRadius: scale(4), marginHorizontal: 2, backgroundColor: 'rgba(255,255,255,0.9)' },

  nextWeekContainer: { alignItems: 'center', marginTop: responsiveSpacing.sm },
  nextWeekButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: scale(16),
    paddingVertical: responsiveSpacing.sm,
    borderRadius: responsiveBorderRadius.lg,
    minWidth: isSmallDevice() ? scale(100) : scale(110),
  },
  nextWeekText: { color: '#FFFFFF', marginLeft: 3, fontWeight: '600', fontSize: responsiveFontSize.sm },

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
