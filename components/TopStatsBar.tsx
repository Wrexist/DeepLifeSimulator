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
  responsiveIconSize,
  touchTargets,
  scale,
  verticalScale,
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
  Crown,
  Coffee,
  Apple,
  Dumbbell,
} from 'lucide-react-native';
import SettingsModal from './SettingsModal';
import GemShopModal from './GemShopModal';
import HelpModal from './HelpModal';
// import PremiumStore from '@/components/PremiumStore';
import usePressableScale from '@/hooks/usePressableScale';

export default function TopStatsBar() {
  const { gameState, nextWeek } = useGame();
  const { triggerButtonPress } = useHapticFeedback();
  if (!gameState?.stats) return null;

  const { stats, settings, bankSavings = 0 } = gameState;
  const [showSettings, setShowSettings] = useState(false);
  const [showGemShop, setShowGemShop] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  // const [showPremiumStore, setShowPremiumStore] = useState(false);

  // Enhanced features state
  const [showQuickActions, setShowQuickActions] = useState<string | null>(null);
  const [glowAnimations, setGlowAnimations] = useState({
    health: new Animated.Value(0),
    happiness: new Animated.Value(0),
    energy: new Animated.Value(0)
  });

  // Animated values
  const animatedStats = useRef({
    health: new Animated.Value(stats.health),
    happiness: new Animated.Value(stats.happiness),
    energy: new Animated.Value(stats.energy),
  }).current;

  // Enhanced functionality functions
  const getStatColor = (stat: string, value: number) => {
    if (stat === 'health') return '#EF4444'; // Always red for health icon
    if (value >= 80) return '#10B981'; // Green
    if (value >= 60) return '#F59E0B'; // Yellow
    if (value >= 40) return '#EF4444'; // Red
    return '#DC2626'; // Dark Red
  };

  const getGlowColor = (stat: string, value: number) => {
    if (stat === 'health') return 'rgba(239, 68, 68, 0.3)'; // Always red glow for health
    if (value >= 80) return 'rgba(16, 185, 129, 0.3)'; // Green glow
    if (value >= 60) return 'rgba(245, 158, 11, 0.3)'; // Yellow glow
    if (value >= 40) return 'rgba(239, 68, 68, 0.3)'; // Red glow
    return 'rgba(220, 38, 38, 0.4)'; // Dark red glow
  };

  const shouldGlow = (value: number) => value >= 90 || value <= 20;

  const getQuickActions = (stat: string) => {
    switch (stat) {
      case 'health':
        return [
          { icon: Apple, label: 'Eat Healthy', action: () => handleQuickAction('eat') },
          { icon: Coffee, label: 'Rest', action: () => handleQuickAction('rest') }
        ];
      case 'energy':
        return [
          { icon: Coffee, label: 'Rest', action: () => handleQuickAction('rest') },
          { icon: Apple, label: 'Eat', action: () => handleQuickAction('eat') }
        ];
      case 'happiness':
        return [
          { icon: Coffee, label: 'Socialize', action: () => handleQuickAction('social') },
          { icon: Dumbbell, label: 'Exercise', action: () => handleQuickAction('exercise') }
        ];
      default:
        return [];
    }
  };

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

  // Memoize expensive color calculations
  const statColors = React.useMemo(() => ({
    health: getStatColor('health', stats.health),
    happiness: getStatColor('happiness', stats.happiness),
    energy: getStatColor('energy', stats.energy),
  }), [stats.health, stats.happiness, stats.energy]);

  const glowColors = React.useMemo(() => ({
    health: getGlowColor('health', stats.health),
    happiness: getGlowColor('happiness', stats.happiness),
    energy: getGlowColor('energy', stats.energy),
  }), [stats.health, stats.happiness, stats.energy]);

  useEffect(() => {
    let isMounted = true;
    const to = (v: number) => Math.max(0, Math.min(100, v ?? 0));
    
    if (isMounted) {
      // Enhanced animations
      const healthAnimation = Animated.timing(animatedStats.health, { 
        toValue: to(stats.health), 
        duration: 300, 
        useNativeDriver: true  // ✅ now safe (we use transform: scaleX)
      });
      const happinessAnimation = Animated.timing(animatedStats.happiness, { 
        toValue: to(stats.happiness), 
        duration: 300, 
        useNativeDriver: true 
      });
      const energyAnimation = Animated.timing(animatedStats.energy, { 
        toValue: to(stats.energy), 
        duration: 300, 
        useNativeDriver: true 
      });
      
      // Glow animations for high/low values
      // ⛑ shadowOpacity is not supported by native driver → must be false
      const createGlowAnimation = (statKey: 'health' | 'happiness' | 'energy') => {
        const value = stats[statKey];
        if (shouldGlow(value)) {
          return Animated.loop(
            Animated.sequence([
              Animated.timing(glowAnimations[statKey], {
                toValue: 1,
                duration: 1000,
                useNativeDriver: false, // ⬅️ changed
              }),
              Animated.timing(glowAnimations[statKey], {
                toValue: 0,
                duration: 1000,
                useNativeDriver: false, // ⬅️ changed
              }),
            ])
          );
        } else {
          return Animated.timing(glowAnimations[statKey], {
            toValue: 0,
            duration: 500,
            useNativeDriver: false, // ⬅️ changed
          });
        }
      };

      healthAnimation.start();
      happinessAnimation.start();
      energyAnimation.start();
      
      createGlowAnimation('health').start();
      createGlowAnimation('happiness').start();
      createGlowAnimation('energy').start();
    }
    
    return () => {
      isMounted = false;
    };
  }, [stats.health, stats.happiness, stats.energy, glowAnimations]);

  // Enhanced data rows with new features (memoized for performance)
  const progressStats = React.useMemo(() => [
    {
      key: 'health',
      icon: Heart,
      value: stats.health,
      change: 0,
      color: statColors.health,
      gradient: ['#EF4444', '#F87171'] as [string, string],
      max: 100,
      moneyIcon: Wallet,
      moneyValue: stats.money,
      moneyGradient: ['#16A34A', '#4ADE80'] as [string, string],
      quickActions: getQuickActions('health'),
    },
    {
      key: 'happiness',
      icon: Smile,
      value: stats.happiness,
      change: 0,
      color: '#F59E0B',
      gradient: ['#F59E0B', '#FBBF24'] as [string, string],
      max: 100,
      moneyIcon: PiggyBank,
      moneyValue: bankSavings,
      moneyGradient: ['#F59E0B', '#FBBF24'] as [string, string],
      quickActions: getQuickActions('happiness'),
    },
    {
      key: 'energy',
      icon: Zap,
      value: stats.energy,
      change: 0,
      color: '#3B82F6',
      gradient: ['#3B82F6', '#60A5FA'] as [string, string],
      max: 100,
      quickActions: getQuickActions('energy'),
      moneyIcon: Gem,
      moneyValue: stats.gems,
      moneyGradient: ['#3B82F6', '#60A5FA'] as [string, string],
    },
  ], [stats, bankSavings, statColors]);

  // Week indicator animation
  const weekAnimations = useRef([
    new Animated.Value(1),
    new Animated.Value(1),
    new Animated.Value(1),
    new Animated.Value(1),
  ]).current;

  useEffect(() => {
    const currentIndex = Math.min(3, Math.max(0, (gameState?.date?.week ?? 1) - 1));
    Animated.sequence([
      Animated.timing(weekAnimations[currentIndex], { toValue: 1.35, duration: 180, useNativeDriver: true }),
      Animated.timing(weekAnimations[currentIndex], { toValue: 1, duration: 180, useNativeDriver: true }),
    ]).start();
  }, [gameState?.date?.week]);

  const { width } = useWindowDimensions();
  // Adjust progress bar width based on device type
  const getProgressBarWidth = () => {
    if (isSmallDevice()) {
      return Math.min(150, Math.max(110, width * 0.42));
    } else if (isLargeDevice()) {
      return Math.min(200, Math.max(150, width * 0.46));
    }
    return Math.min(180, Math.max(130, width * 0.44));
  };

  const progressBarWidth = getProgressBarWidth();

  const { AnimatedView, animatedStyle, onPressIn, onPressOut, onHaptic } = usePressableScale();

  // Theme-dependent styles
  const darkMode = !!settings?.darkMode;
  const containerStyle = [styles.container, darkMode && styles.containerDark];

  const iconColor = darkMode ? '#E5E7EB' : '#111827';
  const infoTextStyle = [styles.infoText, darkMode && styles.infoTextDark];

  const controlButtonGradient: [string, string] = darkMode
    ? ['#1F2937', '#111827']
    : ['#FFFFFF', '#F3F4F6'];

  const formatMoney = (amount: number) => {
    const a = Math.floor(amount || 0);
    if (a >= 1_000_000_000_000_000) return `${(a / 1_000_000_000_000_000).toFixed(2)}Q`;
    if (a >= 1_000_000_000_000) return `${(a / 1_000_000_000_000).toFixed(2)}T`;
    if (a >= 1_000_000_000) return `${(a / 1_000_000_000).toFixed(2)}B`;
    if (a >= 1_000_000) return `${(a / 1_000_000).toFixed(2)}M`;
    if (a >= 1_000) return `${(a / 1_000).toFixed(2)}K`;
    return `${a}`;
  };

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

        {/* Enhanced Stats rows with new features */}
        {progressStats.map(
          ({ key, icon: Icon, color, gradient, max, quickActions, value }) => {

            // ✅ NEW: drive fill with scaleX (0..1) instead of width %
            const scaleX = animatedStats[key as 'health' | 'happiness' | 'energy'].interpolate({
              inputRange: [0, max],
              outputRange: [0, 1],
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
                  {/* Icon and progress bar on same line */}
                  <View style={styles.statRowContent}>
                    <View style={styles.statIconContainer}>
                      <Icon size={18} color={color} />
                    </View>
                    
                    {/* Progress bar with glow */}
                    <View style={[styles.progressBarWrapper, darkMode && styles.progressBarWrapperDark, { width: progressBarWidth }]}>
                      <Animated.View
                        style={[
                          styles.progressFill,
                          darkMode && styles.progressFillDark,
                          {
                            width: '100%',               // base width
                            transform: [{ scaleX }],     // ← animate scaleX instead of width
                          },
                          shouldGlow(value) && {
                            shadowColor: glowColors[key as 'health' | 'happiness' | 'energy'],
                            shadowOffset: { width: 0, height: 0 },
                            // shadowOpacity bound to Animated.Value → must run with nativeDriver:false (handled above)
                            shadowOpacity: glowAnimations[key as 'health' | 'happiness' | 'energy'].interpolate({
                              inputRange: [0, 1],
                              outputRange: [0, 1],
                            }),
                            shadowRadius: 8,
                            elevation: 8,
                          }
                        ]}
                      >
                        <LinearGradient colors={gradient} style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} />
                      </Animated.View>
                    </View>
                  </View>
                </TouchableOpacity>

                {/* Quick Actions Menu */}
                {showQuickActions === key && quickActions && (
                  <View style={styles.quickActionsContainer}>
                    {quickActions.map((action, index) => (
                      <TouchableOpacity
                        key={index}
                        style={styles.quickActionButton}
                        onPress={action.action}
                        activeOpacity={0.7}
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
          }
        )}

        {/* Money, Bank, Gems row */}
        <View style={styles.moneyRow}>
          {/* Left side - Money, Bank, and Gems */}
          <View style={styles.leftMoneySection}>
            <LinearGradient colors={['#16A34A', '#22C55E']} style={styles.moneyGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
              <Wallet size={14} color="#FFFFFF" />
              <AnimatedMoney
                value={stats.money}
                style={[styles.moneyText, darkMode && styles.moneyTextDark]}
                duration={800}
              />
            </LinearGradient>

            <LinearGradient colors={['#F59E0B', '#FCD34D']} style={styles.moneyGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
              <PiggyBank size={14} color="#FFFFFF" />
              <AnimatedMoney
                value={bankSavings}
                style={[styles.moneyText, darkMode && styles.moneyTextDark]}
                duration={800}
              />
            </LinearGradient>

            <LinearGradient colors={['#3B82F6', '#4F46E5']} style={styles.moneyGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
              <Gem size={14} color="#FFFFFF" style={styles.gemIcon} />
              <Text style={[styles.moneyText, styles.gemsText, darkMode && styles.moneyTextDark]}>
                {formatGems(stats.gems)}
              </Text>
            </LinearGradient>
          </View>
        </View>
      </View>

      {/* Right: Premium store button and date */}
      <View style={styles.rightSection}>
        {/* Premium Store Button - positioned above date */}
        {/* <View style={styles.premiumButtonContainer}>
          <TouchableOpacity 
            onPress={() => setShowPremiumStore(true)} 
            style={[styles.rightIconButton, darkMode && styles.iconButtonDark]} 
            activeOpacity={0.85}
          >
            <LinearGradient colors={['#FFD700', '#FFA500']} style={styles.iconButtonGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
              <Crown size={22} color="#FFFFFF" />
            </LinearGradient>
          </TouchableOpacity>
        </View> */}
        
        {/* Date - back to original position */}
        <LinearGradient colors={['#60A5FA', '#3B82F6', '#2563EB']} style={styles.dateOuter} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
          <View style={[styles.dateInner, darkMode && styles.dateInnerDark]}>
            <Text style={[styles.yearText, darkMode && styles.yearTextDark]}>{gameState.date.year}</Text>
            <Text style={[styles.monthText, darkMode && styles.monthTextDark]}>{gameState.date.month}</Text>
            <Text style={[styles.ageText, darkMode && styles.ageTextDark]}>Age {Math.floor(gameState.date.age)}</Text>
            <View style={styles.weekDots}>
              {[1, 2, 3, 4].map((w, idx) => (
                <Animated.View
                  key={w}
                  style={[
                    styles.weekDot,
                    {
                      backgroundColor:
                        gameState.date.week >= w 
                          ? (darkMode ? 'rgba(255,255,255,0.98)' : 'rgba(255,255,255,0.95)')
                          : (darkMode ? 'rgba(255,255,255,0.45)' : 'rgba(255,255,255,0.35)'),
                      transform: [{ scale: weekAnimations[idx] }],
                    },
                  ]}
                />
              ))}
            </View>
          </View>
        </LinearGradient>

        {/* Next Week Button - positioned under date */}
        <View style={styles.nextWeekContainer}>
          <AnimatedView style={animatedStyle}>
            <TouchableOpacity
              onPress={() => {
                onHaptic();
                nextWeek();
              }}
              onPressIn={onPressIn}
              onPressOut={onPressOut}
              activeOpacity={0.7}
            >
              <LinearGradient colors={['#16A34A', '#22C55E']} style={styles.nextWeekButton} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                <ArrowRightCircle size={16} color="#FFFFFF" />
                <Text style={[styles.nextWeekText, darkMode && styles.nextWeekTextDark]}>Next Week</Text>
              </LinearGradient>
            </TouchableOpacity>
          </AnimatedView>
        </View>
      </View>

      {/* Modals */}
      <SettingsModal visible={showSettings} onClose={() => setShowSettings(false)} />
      <GemShopModal visible={showGemShop} onClose={() => setShowGemShop(false)} />
      <HelpModal visible={showHelp} onClose={() => setShowHelp(false)} />
      {/* <PremiumStore visible={showPremiumStore} onClose={() => setShowPremiumStore(false)} /> */}
    </View>
  );
}

const styles = StyleSheet.create({
  /* Header container — vit i ljust läge, mörk i dark mode */
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: responsivePadding.horizontal,
    paddingVertical: responsiveSpacing.xs,
    backgroundColor: '#FFFFFF',
  },
  containerDark: {
    backgroundColor: '#0F172A',
  },

  /* Left side */
  leftSection: { flex: 1, flexDirection: 'column', alignItems: 'flex-start' },
  leftIconRow: { flexDirection: 'row', marginBottom: responsiveSpacing.xs },

  /* Control buttons */
  iconButton: {
    width: touchTargets.minimum,
    height: touchTargets.minimum,
    marginRight: responsiveSpacing.md,
    borderRadius: touchTargets.minimum / 2,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 5,
    elevation: 6,
    backgroundColor: 'transparent',
  },
  rightIconButton: {
    width: touchTargets.minimum,
    height: touchTargets.minimum,
    borderRadius: touchTargets.minimum / 2,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 5,
    elevation: 6,
    backgroundColor: 'transparent',
  },
  premiumButtonContainer: {
    position: 'absolute',
    top: -scale(40),
    right: 0,
    zIndex: 10,
  },
  iconButtonDark: { shadowOpacity: 0.35 },
  iconButtonGradient: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  /* Stats rows */
  statRow: { flexDirection: 'row', alignItems: 'center', marginBottom: responsiveSpacing.xs },
  
  /* Money, Bank, Gems row */
  moneyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: responsiveSpacing.md,
    paddingHorizontal: responsiveSpacing.sm,
    width: '100%',
  },
  leftMoneySection: {
    flexDirection: 'row',
    gap: responsiveSpacing.sm,
  },

  /* Bars (siffror borttagna) */
  progressBarWrapper: {
    height: scale(16),
    backgroundColor: '#E5E7EB',
    borderRadius: responsiveBorderRadius.md,
    marginLeft: responsiveSpacing.sm,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 4,
    justifyContent: 'center',
  },
  progressBarWrapperDark: { 
    backgroundColor: '#374151',
    shadowOpacity: 0.4,
  },
  progressFill: { height: '100%', borderRadius: responsiveBorderRadius.md },
  progressFillDark: { 
    shadowOpacity: 0.6,
    elevation: 6,
  },

  /* Money chip */
  moneyGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: responsiveSpacing.xs,
    paddingVertical: responsiveSpacing.xs,
    borderRadius: responsiveBorderRadius.lg,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 3,
    elevation: 3,
    minWidth: isSmallDevice() ? scale(55) : scale(60),
    marginLeft: -scale(4),
  },
  gemsGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: responsiveSpacing.xs,
    paddingVertical: responsiveSpacing.xs,
    borderRadius: responsiveBorderRadius.lg,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 3,
    elevation: 3,
    minWidth: isSmallDevice() ? scale(50) : scale(55),
    marginLeft: responsiveSpacing.xs,
  },
  gemsText: {
    textAlign: 'center',
  },
  gemIcon: { marginRight: 3 },
  moneyText: { 
    fontWeight: '600', 
    marginLeft: 3, 
    fontSize: responsiveFontSize.sm, 
    color: '#FFFFFF',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1,
  },
  moneyTextDark: {
    textShadowColor: 'rgba(0, 0, 0, 0.4)',
    textShadowRadius: 1,
  },

  /* Right side */
  rightSection: { 
    alignItems: 'flex-end', 
    flexShrink: 0, 
    marginLeft: responsiveSpacing.lg, 
    marginTop: 0,
  },
  dateOuter: {
    padding: 2,
    borderRadius: responsiveBorderRadius.lg,
    shadowColor: '#60A5FA',
    shadowOpacity: 0.45,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 7,
    elevation: 6,
    marginBottom: responsiveSpacing.xs,
    height: scale(90),
    width: scale(110),
  },
  dateInner: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: scale(10),
    paddingVertical: responsiveSpacing.xs,
    borderRadius: responsiveBorderRadius.md,
    backgroundColor: 'rgba(255,255,255,0.18)',
    height: '100%',
  },
  dateInnerDark: {
    backgroundColor: 'rgba(255,255,255,0.25)',
  },

  infoText: { color: '#111827', fontWeight: '600' },
  infoTextDark: { color: '#F9FAFB' },
  yearText: { 
    fontSize: responsiveFontSize.xl, 
    fontWeight: '800', 
    color: '#FFFFFF',
    textShadowColor: 'rgba(0, 0, 0, 0.95)',
    textShadowOffset: { width: -1, height: -1 },
    textShadowRadius: 0,
  },
  yearTextDark: {
    textShadowColor: 'rgba(0, 0, 0, 0.98)',
    textShadowRadius: 1,
  },
  monthText: { 
    fontSize: responsiveFontSize.lg, 
    fontWeight: '700', 
    color: '#FFFFFF',
    textShadowColor: 'rgba(0, 0, 0, 0.95)',
    textShadowOffset: { width: -1, height: -1 },
    textShadowRadius: 0,
  },
  monthTextDark: {
    textShadowColor: 'rgba(0, 0, 0, 0.98)',
    textShadowRadius: 1,
  },
  ageText: { 
    fontSize: responsiveFontSize.lg, 
    fontWeight: '700', 
    color: '#FFFFFF',
    textShadowColor: 'rgba(0, 0, 0, 0.95)',
    textShadowOffset: { width: -1, height: -1 },
    textShadowRadius: 0,
  },
  ageTextDark: {
    textShadowColor: 'rgba(0, 0, 0, 0.98)',
    textShadowRadius: 1,
  },

  weekDots: { flexDirection: 'row', marginTop: responsiveSpacing.xs, marginBottom: 2 },
  weekDot: { width: scale(8), height: scale(8), borderRadius: scale(4), marginHorizontal: 2 },

  /* Next Week Button */
  nextWeekContainer: {
    alignItems: 'center',
    marginTop: responsiveSpacing.sm,
  },
  nextWeekButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: scale(16),
    paddingVertical: responsiveSpacing.sm,
    borderRadius: responsiveBorderRadius.lg,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 3,
    elevation: 3,
    overflow: 'hidden',
    minWidth: isSmallDevice() ? scale(100) : scale(110),
  },
  nextWeekText: { 
    color: '#FFFFFF', 
    marginLeft: 3, 
    fontWeight: '600', 
    fontSize: responsiveFontSize.sm,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1,
  },
  nextWeekTextDark: {
    textShadowColor: 'rgba(0, 0, 0, 0.4)',
    textShadowRadius: 1,
  },

  /* Enhanced Features Styles */
  statTouchable: {
    width: '100%',
  },
  statRowContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  statIconContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
    marginRight: responsiveSpacing.xs,
  },
  quickActionsContainer: {
    position: 'absolute',
    top: scale(40),
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    borderRadius: responsiveBorderRadius.md,
    padding: responsiveSpacing.sm,
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 8,
    zIndex: 1000,
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
  },
});
