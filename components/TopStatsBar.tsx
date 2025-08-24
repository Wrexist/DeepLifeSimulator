import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  useWindowDimensions,
} from 'react-native';
import { useGame } from '@/contexts/GameContext';
import { LinearGradient } from 'expo-linear-gradient';
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
} from 'lucide-react-native';
import SettingsModal from './SettingsModal';
import GemShopModal from './GemShopModal';
import HelpModal from './HelpModal';
import usePressableScale from '@/hooks/usePressableScale';

export default function TopStatsBar() {
  const { gameState, nextWeek } = useGame();
  if (!gameState?.stats) return null;

  const { stats, settings, bankSavings = 0 } = gameState;
  const [showSettings, setShowSettings] = useState(false);
  const [showGemShop, setShowGemShop] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  // Animated values
  const animatedStats = useRef({
    health: new Animated.Value(stats.health),
    happiness: new Animated.Value(stats.happiness),
    energy: new Animated.Value(stats.energy),
  }).current;

  useEffect(() => {
    const to = (v: number) => Math.max(0, Math.min(100, v ?? 0));
    Animated.timing(animatedStats.health, { toValue: to(stats.health), duration: 250, useNativeDriver: false }).start();
    Animated.timing(animatedStats.happiness, { toValue: to(stats.happiness), duration: 250, useNativeDriver: false }).start();
    Animated.timing(animatedStats.energy, { toValue: to(stats.energy), duration: 250, useNativeDriver: false }).start();
  }, [stats.health, stats.happiness, stats.energy]);

  // Data rows
  const progressStats = [
    {
      key: 'health',
      icon: Heart,
      value: stats.health,
      change: stats.healthChange ?? 0, // använd om du vill, men vi visar det inte i baren längre
      color: '#EF4444',
      gradient: ['#EF4444', '#F87171'],
      max: 100,
      moneyIcon: Wallet,
      moneyValue: stats.money,
      moneyGradient: ['#16A34A', '#4ADE80'],
    },
    {
      key: 'happiness',
      icon: Smile,
      value: stats.happiness,
      change: stats.happinessChange ?? 0,
      color: '#F59E0B',
      gradient: ['#F59E0B', '#FBBF24'],
      max: 100,
      moneyIcon: PiggyBank,
      moneyValue: bankSavings,
      moneyGradient: ['#F59E0B', '#FBBF24'],
    },
    {
      key: 'energy',
      icon: Zap,
      value: stats.energy,
      change: stats.energyChange ?? 0,
      color: '#3B82F6',
      gradient: ['#3B82F6', '#60A5FA'],
      max: 100,
      moneyIcon: Gem,
      moneyValue: stats.gems,
      moneyGradient: ['#3B82F6', '#60A5FA'],
    },
  ];

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
  const progressBarWidth = Math.min(180, Math.max(130, width * 0.44));

  const { AnimatedView, animatedStyle, onPressIn, onPressOut, onHaptic } = usePressableScale();

  // Theme-dependent styles
  const darkMode = !!settings?.darkMode;
  const containerStyle = [styles.container, darkMode && styles.containerDark];

  const iconColor = darkMode ? '#E5E7EB' : '#111827';
  const infoTextStyle = [styles.infoText, darkMode && styles.infoTextDark];

  const controlButtonGradient = darkMode
    ? (['#1F2937', '#111827'] as [string, string]) // mörka i dark mode
    : (['#FFFFFF', '#F3F4F6'] as [string, string]);

  const formatMoney = (amount: number) => {
    const a = Math.floor(amount || 0);
    if (a >= 1_000_000) return `${(a / 1_000_000).toFixed(1)}M`;
    if (a >= 1_000) return `${(a / 1_000).toFixed(1)}K`;
    return `${a}`;
  };

  const formatGems = (amount: number) => {
    const a = Math.floor(amount || 0);
    if (a >= 1_000_000) return `${(a / 1_000_000).toFixed(1)}M`;
    if (a >= 1_000) return `${(a / 1_000).toFixed(1)}K`;
    return `${a}`;
  };

  return (
    <View style={containerStyle}>
      {/* Left: controls + stats */}
      <View style={styles.leftSection}>
        <View style={styles.leftIconRow}>
          <TouchableOpacity onPress={() => setShowGemShop(true)} style={[styles.iconButton, darkMode && styles.iconButtonDark]} activeOpacity={0.85}>
            <LinearGradient colors={controlButtonGradient} style={styles.iconButtonGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
              <ShoppingCart size={22} color={iconColor} />
            </LinearGradient>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setShowHelp(true)} style={[styles.iconButton, darkMode && styles.iconButtonDark]} activeOpacity={0.85}>
            <LinearGradient colors={controlButtonGradient} style={styles.iconButtonGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
              <HelpCircle size={22} color={iconColor} />
            </LinearGradient>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setShowSettings(true)} style={[styles.iconButton, darkMode && styles.iconButtonDark]} activeOpacity={0.85}>
            <LinearGradient colors={controlButtonGradient} style={styles.iconButtonGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
              <Settings size={22} color={iconColor} />
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {progressStats.map(
          ({ key, icon: Icon, color, gradient, max, moneyIcon: MoneyIcon, moneyValue, moneyGradient }) => (
            <View key={key} style={styles.statMoneyRow}>
              {/* Stat row */}
              <View style={styles.statRow}>
                <Icon size={20} color={color} />
                <View style={[styles.progressBarWrapper, darkMode && styles.progressBarWrapperDark, { width: progressBarWidth }]}>
                  <Animated.View
                    style={[
                      styles.progressFill,
                      {
                        width: animatedStats[key as 'health' | 'happiness' | 'energy'].interpolate({
                          inputRange: [0, max],
                          outputRange: ['0%', '100%'],
                        }),
                      },
                    ]}
                  >
                    <LinearGradient colors={gradient} style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} />
                  </Animated.View>
                  {/* OBS: siffrorna i baren är borttagna */}
                </View>
              </View>

              {/* Money chip */}
              <View style={styles.moneyRow}>
                <LinearGradient colors={moneyGradient} style={styles.moneyGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                  <MoneyIcon size={18} color="#FFFFFF" />
                  <Text style={styles.moneyText}>
                    {key === 'energy' ? formatGems(moneyValue) : `$${formatMoney(moneyValue)}`}
                  </Text>
                </LinearGradient>
              </View>
            </View>
          )
        )}
      </View>

      {/* Right: date + next week */}
      <View style={styles.rightSection}>
        <LinearGradient colors={['#60A5FA', '#3B82F6', '#2563EB']} style={styles.dateOuter} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
          <View style={styles.dateInner}>
            <Text style={[infoTextStyle, styles.yearText]}>{gameState.date.year}</Text>
            <Text style={[infoTextStyle, styles.monthText]}>{gameState.date.month}</Text>
            <Text style={[infoTextStyle, styles.ageText]}>Age {Math.floor(gameState.date.age)}</Text>
            <View style={styles.weekDots}>
              {[1, 2, 3, 4].map((w, idx) => (
                <Animated.View
                  key={w}
                  style={[
                    styles.weekDot,
                    {
                      backgroundColor:
                        gameState.date.week >= w ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.35)',
                      transform: [{ scale: weekAnimations[idx] }],
                    },
                  ]}
                />
              ))}
            </View>
          </View>
        </LinearGradient>

        <AnimatedView style={animatedStyle}>
          <TouchableOpacity
            onPress={() => {
              onHaptic();
              nextWeek();
            }}
            onPressIn={onPressIn}
            onPressOut={onPressOut}
            activeOpacity={0.9}
          >
            <LinearGradient colors={['#16A34A', '#4ADE80']} style={styles.nextWeekButton} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
              <ArrowRightCircle size={20} color="#FFFFFF" />
              <Text style={styles.nextWeekText}>Next Week</Text>
            </LinearGradient>
          </TouchableOpacity>
        </AnimatedView>
      </View>

      {/* Modals */}
      <SettingsModal visible={showSettings} onClose={() => setShowSettings(false)} />
      <GemShopModal visible={showGemShop} onClose={() => setShowGemShop(false)} />
      <HelpModal visible={showHelp} onClose={() => setShowHelp(false)} />
    </View>
  );
}

const TOUCH = 44;

const styles = StyleSheet.create({
  /* Header container — vit i ljust läge, mörk i dark mode */
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 3,
    elevation: 2,
  },
  containerDark: {
    backgroundColor: '#0F172A',
    shadowOpacity: 0.12,
  },

  /* Left side */
  leftSection: { flex: 1, flexDirection: 'column', alignItems: 'flex-start' },
  leftIconRow: { flexDirection: 'row', marginBottom: 12 },

  /* Control buttons */
  iconButton: {
    width: TOUCH,
    height: TOUCH,
    marginRight: 12,
    borderRadius: TOUCH / 2,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 5,
    elevation: 6,
    backgroundColor: 'transparent',
  },
  iconButtonDark: { shadowOpacity: 0.35 },
  iconButtonGradient: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  /* Progress & money rows */
  statMoneyRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  statRow: { flexDirection: 'row', alignItems: 'center', marginRight: 18, flex: 1 },

  /* Bars (siffror borttagna) */
  progressBarWrapper: {
    height: 16,
    backgroundColor: '#E5E7EB',
    borderRadius: 8,
    marginLeft: 8,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 4,
    justifyContent: 'center',
  },
  progressBarWrapperDark: { backgroundColor: '#374151' },
  progressFill: { height: '100%', borderRadius: 8 },

  /* Money chip */
  moneyRow: { flexDirection: 'row', alignItems: 'center' },
  moneyGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 5,
    elevation: 6,
  },
  moneyText: { 
    fontWeight: '700', 
    marginLeft: 6, 
    fontSize: 15, 
    color: '#FFFFFF',
    textShadowColor: 'rgba(0, 0, 0, 0.95)',
    textShadowOffset: { width: -1, height: -1 },
    textShadowRadius: 0,
  },

  /* Right side */
  rightSection: { alignItems: 'flex-end', flexShrink: 0, marginLeft: 16 },
  dateOuter: {
    padding: 2,
    borderRadius: 14,
    shadowColor: '#60A5FA',
    shadowOpacity: 0.45,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 7,
    elevation: 6,
    marginBottom: 12,
  },
  dateInner: {
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },

  infoText: { color: '#111827', fontWeight: '600' },
  infoTextDark: { color: '#F9FAFB' },
  yearText: { 
    fontSize: 18, 
    fontWeight: '800', 
    color: '#FFFFFF',
    textShadowColor: 'rgba(0, 0, 0, 0.95)',
    textShadowOffset: { width: -1, height: -1 },
    textShadowRadius: 0,
  },
  monthText: { 
    fontSize: 15, 
    fontWeight: '700', 
    color: '#FFFFFF',
    textShadowColor: 'rgba(0, 0, 0, 0.95)',
    textShadowOffset: { width: -1, height: -1 },
    textShadowRadius: 0,
  },
  ageText: { 
    fontSize: 15, 
    fontWeight: '700', 
    color: '#FFFFFF',
    textShadowColor: 'rgba(0, 0, 0, 0.95)',
    textShadowOffset: { width: -1, height: -1 },
    textShadowRadius: 0,
  },

  weekDots: { flexDirection: 'row', marginTop: 4, marginBottom: 2 },
  weekDot: { width: 8, height: 8, borderRadius: 4, marginHorizontal: 2 },

  /* CTA */
  nextWeekButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    marginTop: 10,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 6,
    elevation: 6,
    overflow: 'hidden',
  },
  nextWeekText: { 
    color: '#FFFFFF', 
    marginLeft: 6, 
    fontWeight: '700', 
    fontSize: 16,
    textShadowColor: 'rgba(0, 0, 0, 0.95)',
    textShadowOffset: { width: -1, height: -1 },
    textShadowRadius: 0,
  },
});
