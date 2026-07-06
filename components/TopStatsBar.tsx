// components/TopStatsBar.tsx
import React, { useState, useRef, useEffect, useMemo, useCallback, Suspense } from 'react';
import { View,
 Text,
 StyleSheet,
 TouchableOpacity,
 Animated,
 useWindowDimensions,
 Easing } from 'react-native';
import {
 responsivePadding,
 responsiveFontSize,
 responsiveSpacing,
 touchTargets,
 scale,
 isSmallDevice,
 isLargeDevice,
 isIPad,
 isAndroidXLarge,
} from '@/utils/scaling';
import { useGameActions } from '@/contexts/GameContext';
import { useGameSelector, useSetGameState, shallowEqual } from '@/contexts/game/useGameSelector';
import LinearGradientFallback from '@/components/fallbacks/LinearGradientFallback';
import AnimatedMoney from '@/components/ui/AnimatedMoney';
import { styles } from '@/components/TopStatsBarStyles';
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
// Rarely-opened modals — lazy-loaded and only mounted when open, so they no
// longer sit permanently mounted with visible={false} (which kept their trees
// built on every TopStatsBar render).
const SettingsModal = React.lazy(() => import('./SettingsModal'));
const GemShopModal = React.lazy(() => import('./GemShopModal'));
const HelpModal = React.lazy(() => import('./HelpModal'));
const PrestigeModal = React.lazy(() => import('./PrestigeModal'));
const EnergyBreakdownModal = React.lazy(() => import('./EnergyBreakdownModal'));
const HappinessBreakdownModal = React.lazy(() => import('./HappinessBreakdownModal'));
const HealthBreakdownModal = React.lazy(() => import('./HealthBreakdownModal'));
const MoneyBreakdownModal = React.lazy(() => import('./MoneyBreakdownModal'));
const BankBreakdownModal = React.lazy(() => import('./BankBreakdownModal'));
const GemsBreakdownModal = React.lazy(() => import('./GemsBreakdownModal'));
// SicknessModal is rendered once at the root in app/_layout.tsx — no second mount here.
import { getEnergyRegenMultiplier } from '@/lib/prestige/applyBonuses';
import SeasonalIndicator from './SeasonalIndicator';
import usePressableScale from '@/hooks/usePressableScale';
import { useFeedback } from '@/utils/feedbackSystem';
import { usePerformanceMonitor, useMemoryCleanup } from '@/utils/performanceOptimization';
import { getProgressAccessibilityProps, ACCESSIBILITY_HINTS } from '@/utils/accessibility';

const LinearGradient = LinearGradientFallback;

// Memoized TopStatsBar to prevent unnecessary re-renders
function TopStatsBarComponent() {
 // Sprint 2: select only the slices this bar reads — it no longer re-renders
 // on changes to unrelated state (loans, companies, social feeds, ...).
 const setGameState = useSetGameState();
 const stats = useGameSelector((s) => s?.stats, shallowEqual);
 const settings = useGameSelector((s) => s?.settings, shallowEqual);
 const bankSavings = useGameSelector((s) => s?.bankSavings ?? 0);
 const stocks = useGameSelector((s) => s?.stocks);
 const generationNumber = useGameSelector((s) => s?.generationNumber);
 const prestige = useGameSelector((s) => s?.prestige);
 const prestigeLevel = prestige?.prestigeLevel ?? 0;
 const date = useGameSelector((s) => s?.date, shallowEqual);
 const careers = useGameSelector((s) => s?.careers);
 const currentJob = useGameSelector((s) => s?.currentJob);
 const educations = useGameSelector((s) => s?.educations);
 const dietPlans = useGameSelector((s) => s?.dietPlans);
 const realEstate = useGameSelector((s) => s?.realEstate);
 const userProfile = useGameSelector((s) => s?.userProfile);
 const diseases = useGameSelector((s) => s?.diseases) || [];
 const hasDiseases = diseases.length > 0;
 const hasCriticalDisease = diseases.some(d => d.severity === 'critical');
 const hasSeriousDisease = diseases.some(d => d.severity === 'serious');

 const showStatArrows = settings?.showStatArrows!== false; // Default to true

 const { success, info, buttonPress, haptic } = useFeedback(settings?.hapticFeedback ?? false);
 const { logRender } = usePerformanceMonitor();

 // Single modal state — only one modal open at a time, reduces re-renders
 type ModalName = 'settings'|'gemShop'|'help'|'prestige'|'energyBreakdown'|'happinessBreakdown'|'healthBreakdown'|'moneyBreakdown'|'bankBreakdown'|'gemsBreakdown'| null;
 const [openModal, setOpenModal] = useState<ModalName>(null);
 const [showQuickActions, setShowQuickActions] = useState<string | null>(null);
 const closeModal = useCallback(() => setOpenModal(null), []);

 // Glow anims (native driver) - drives a native opacity overlay; memoized so
 // the value identities stay stable across renders.
 const glowAnimations = useMemo(() => ({
 health: new Animated.Value(0),
 happiness: new Animated.Value(0),
 energy: new Animated.Value(0),
 }), []);

 // Stat anims (JS driver) - must be initialized before early return (Rules of Hooks)
 const animatedStats = useRef({
 health: new Animated.Value(stats?.health ?? 0),
 happiness: new Animated.Value(stats?.happiness ?? 0),
 energy: new Animated.Value(stats?.energy ?? 0),
 }).current;

 const weekAnimations = useRef([
 new Animated.Value(1),
 new Animated.Value(1),
 new Animated.Value(1),
 new Animated.Value(1),
 ]).current;

 const { width } = useWindowDimensions();

 const getStatColor = (_stat: string, value: number) => {
 if (value >= 80) return'#059669'; // Beautiful emerald green
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

 const clamp = (v: number) => Math.max(0, Math.min(100, v));
 // Each action is a self-limiting trade (spends a resource) so none is a
 // free, spammable win — and, crucially, they actually change stats now.
 const apply = (
 deltas: Partial<{ health: number; happiness: number; energy: number; fitness: number; money: number }>,
 msg: string,
 ) => {
 setGameState(prev => {
 const st = prev.stats;
 return {
 ...prev,
 stats: {
 ...st,
 health: deltas.health != null ? clamp((st.health ?? 0) + deltas.health) : st.health,
 happiness: deltas.happiness != null ? clamp((st.happiness ?? 0) + deltas.happiness) : st.happiness,
 energy: deltas.energy != null ? clamp((st.energy ?? 0) + deltas.energy) : st.energy,
 fitness: deltas.fitness != null ? clamp((st.fitness ?? 0) + deltas.fitness) : st.fitness,
 money: deltas.money != null ? Math.max(0, (st.money ?? 0) + deltas.money) : st.money,
 },
 };
 });
 haptic('success');
 success(msg);
 };

 const s = stats ?? { money: 0, energy: 0 };
 switch (action) {
 case 'eat':
 if ((s.money ?? 0) < 12) { haptic('warning'); info('Need $12 to grab a healthy meal.'); return; }
 apply({ money: -12, health: 7, happiness: 4 }, 'Healthy meal — +7 health, +4 happiness.');
 break;
 case 'rest':
 apply({ happiness: -5, energy: 14 }, 'You rest up — +14 energy (−5 happiness).');
 break;
 case 'social':
 if ((s.energy ?? 0) < 8) { haptic('warning'); info('Too tired to socialize right now.'); return; }
 apply({ energy: -8, happiness: 10 }, 'Good company — +10 happiness.');
 break;
 case 'exercise':
 if ((s.energy ?? 0) < 12) { haptic('warning'); info('Too tired to work out right now.'); return; }
 apply({ energy: -12, fitness: 6, health: 5 }, 'Great workout — +6 fitness, +5 health.');
 break;
 }
 }, [buttonPress, haptic, success, info, setGameState, stats]);

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
 duration: 0, // Instant snap — stat drain/gain shows the moment state changes
 useNativeDriver: false, // Keep false for width animations
 easing: Easing.out(Easing.quad), // Smoother easing
 });

 const happinessAnimation = Animated.timing(animatedStats.happiness, {
 toValue: to(stats.happiness),
 duration: 0,
 useNativeDriver: false,
 easing: Easing.out(Easing.quad),
 });

 const energyAnimation = Animated.timing(animatedStats.energy, {
 toValue: to(stats.energy),
 duration: 0,
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

 const runGlow = (key: 'health'|'happiness'|'energy', value: number) => {
 // R-perf: native driver. The glow value now drives ONLY a native-compatible
 // `opacity` overlay (see progressFill below), so this continuous loop runs on
 // the UI thread and no longer touches the JS thread every frame — it stopped
 // janking the already-busy post-tick window.
 if (shouldGlow(value)) {
 // NOISE: pulse a few cycles as an attention cue, then rest. The old
 // unbounded loop kept the HUD pulsing for as long as the stat stayed
 // low — which early-game is basically always.
 const glowLoop = Animated.loop(
 Animated.sequence([
 Animated.timing(glowAnimations[key], {
 toValue: 1,
 duration: 1200,
 useNativeDriver: true,
 easing: Easing.inOut(Easing.ease)
 }),
 Animated.timing(glowAnimations[key], {
 toValue: 0,
 duration: 1200,
 useNativeDriver: true,
 easing: Easing.inOut(Easing.ease)
 }),
 ]),
 { iterations: 3 }
 );
 glowLoop.start();
 return glowLoop;
 } else {
 const glowStop = Animated.timing(glowAnimations[key], {
 toValue: 0,
 duration: 300,
 useNativeDriver: true,
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
 // P1-5: drop `stats` (object identity changes every save under the new
 // GameStateProvider behaviour) — primitive deps suffice. `animatedStats` and
 // `glowAnimations` are stable refs from useRef.
 }, [stats?.health, stats?.happiness, stats?.energy]);

 // Calculate net change for each stat
 // R10-perf: derive the primitive signals the memo actually depends on. These
 // are cheap single-pass scans; depending on them (instead of the careers/
 // educations/dietPlans/realEstate ARRAYS, which get a new identity every decay
 // tick) means the heavier memo body — including the prestige require() and the
 // rounding math — only recomputes when a value that matters actually changes.
 const currentCareerAccepted = !!careers?.find(c => c.id === currentJob && c.accepted);
 const activeEducationCount = (educations || []).filter(edu =>
 edu &&!edu.completed &&!edu.paused && edu.weeksRemaining && edu.weeksRemaining > 0
 ).length;
 const activeDietPlanSig = (() => {
 const p = (dietPlans || []).find(plan => plan && plan.active);
 return p ? `${p.healthGain ?? 0}|${p.happinessGain ?? 0}|${p.energyGain ?? 0}`: '';
 })();
 const residenceSig = (() => {
 const r = (realEstate || []).find(p => {
 const hasStatus = 'status'in p && p.status ==='owner';
 const hasCurrentResidence = 'currentResidence'in p && p.currentResidence === true;
 return p.owned && hasStatus && hasCurrentResidence;
 });
 return r ? `${r.weeklyHappiness ?? 0}|${r.weeklyEnergy ?? 0}`: '';
 })();

 const statNetChanges = React.useMemo(() => {
 if (!stats) return { health: 0, happiness: 0, energy: 0 };

 // Calculate natural decay
 const netWorth = (stats.money || 0) + (bankSavings || 0);
 const safeNetWorth = isFinite(netWorth) && netWorth > 0 ? netWorth: 1000;
 const wealthMultiplier = Math.max(0.5, Math.min(2.0, 100000 / Math.max(1000, safeNetWorth)));
 const statDecayRate = 4;
 const effectiveDecayRate = statDecayRate * wealthMultiplier;

 const activeEducations = (educations || []).filter(edu =>
 edu &&!edu.completed &&!edu.paused && edu.weeksRemaining && edu.weeksRemaining > 0
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
 const stressMultiplier = numActiveEducations === 1 ? 1.0: numActiveEducations === 2 ? 1.3: 1.6;
 healthChange += Math.round(baseHealthPenalty * numActiveEducations * stressMultiplier);
 }
 // Add diet plan health gain
 const activeDietPlan = (dietPlans || []).find(plan => plan && plan.active);
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
 const stressMultiplier = numActiveEducations === 1 ? 1.0: numActiveEducations === 2 ? 1.3: 1.6;
 happinessChange += Math.round(baseHappinessPenalty * numActiveEducations * stressMultiplier);
 }
 // Add diet plan happiness gain
 if (activeDietPlan && activeDietPlan.happinessGain && activeDietPlan.happinessGain > 0) {
 happinessChange += activeDietPlan.happinessGain;
 }
 // Add real estate happiness boost from current residence
 const currentResidence = (realEstate || []).find(p => {
 const hasStatus = 'status'in p && p.status ==='owner';
 const hasCurrentResidence = 'currentResidence'in p && p.currentResidence === true;
 return p.owned && hasStatus && hasCurrentResidence;
 });
 if (currentResidence && currentResidence.weeklyHappiness > 0) {
 happinessChange += currentResidence.weeklyHappiness;
 }

 // Energy net change
 let energyChange = 30; // Base regen
 const unlockedBonuses = prestige?.unlockedBonuses || [];
 {
 // Top-level ES import (was an inline require() that ran every render).
 const energyRegenMultiplier = getEnergyRegenMultiplier(unlockedBonuses);
 const safeEnergyRegenMultiplier = typeof energyRegenMultiplier ==='number'&& isFinite(energyRegenMultiplier) && energyRegenMultiplier > 0 ? energyRegenMultiplier: 1.0;
 energyChange = Math.round(30 * safeEnergyRegenMultiplier);
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
 const stressMultiplier = numActiveEducations === 1 ? 1.0: numActiveEducations === 2 ? 1.3: 1.6;
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
 // P1-5: depend on specific primitives instead of the whole `stats`/`gameState`
 // objects. With the GameStateProvider identity short-circuit (P0-1) these
 // objects only change when something actually changed, but heavy memos like
 // this still benefit from primitive-only deps.
   // eslint-disable-next-line react-hooks/exhaustive-deps
 }, [stats?.health, stats?.happiness, stats?.energy, stats?.money, bankSavings, currentJob, currentCareerAccepted, activeEducationCount, prestige?.unlockedBonuses, activeDietPlanSig, residenceSig]);

 const progressStats = React.useMemo(
 () => {
 if (!stats) return [];
 return [
 {
 key:'health',
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
 // P2: depend on the primitive stat VALUES (and the already-memoized derived
 // objects) rather than the whole `stats` object, whose identity changes every
 // tick — this list rebuild only matters when a displayed value changes.
 [stats?.health, stats?.happiness, stats?.energy, statColors, handleQuickAction, statNetChanges]
 );

 useEffect(() => {
 if (!date?.week) return;
 const currentIndex = Math.min(3, Math.max(0, (date?.week ?? 1) - 1));
 Animated.sequence([
 Animated.timing(weekAnimations[currentIndex], { toValue: 1.35, duration: 180, useNativeDriver: true }),
 Animated.timing(weekAnimations[currentIndex], { toValue: 1, duration: 180, useNativeDriver: true }),
 ]).start();
 }, [date?.week, weekAnimations]);

 // Standardized breakpoint for small devices (covers iPhone SE and Android small devices)
 const SMALL_DEVICE_BREAKPOINT = 360;
 const isVerySmallDevice = isSmallDevice() && width < SMALL_DEVICE_BREAKPOINT;

 const getProgressBarWidth = () => {
 // Calculate available width for progress bars (accounting for padding, icons, and right section)
 const containerPadding = responsivePadding.horizontal * 1.2 * 2; // left + right padding
 const iconWidth = (isIPad() ? touchTargets.large: touchTargets.minimum) + responsiveSpacing.xs; // icon + margin
 // More conservative right section width calculation
 const rightSectionWidth = isIPad()
 ? scale(170)
: (isVerySmallDevice
 ? scale(95) // Reduced from 100 for better fit
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
 if (!stats ||!userProfile) return null;

 const darkMode =!!settings?.darkMode;
 // Dynamic container padding for small devices - more conservative
 const containerPadding = isVerySmallDevice
 ? responsivePadding.horizontal * 0.7 // Reduced from 0.8
: responsivePadding.horizontal * 1.2;
 const containerMinHeight = isIPad()
 ? scale(200)
: (isVerySmallDevice ? scale(140): scale(160));
 const containerStyle = [
 styles.container,
 darkMode && styles.containerDark,
 { paddingHorizontal: containerPadding, minHeight: containerMinHeight }
 ];
 const iconColor = darkMode ? '#E5E7EB': '#111827';

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
 // L-1: guard against a NaN/Infinity currentPrice (corrupt save) propagating
 // into total → "NaN" displayed for total savings.
 const value = holding.shares * holding.currentPrice;
 return total + (Number.isFinite(value) ? value : 0);
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
 <Crown size={12} color="#FFFFFF"/>
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
 const val = animatedStats[key as'health'|'happiness'|'energy'];
 const progressWidth = val.interpolate({
 inputRange: [0, max],
 outputRange: ['0%', '100%'],
 extrapolate: 'clamp',
 // Remove easing from interpolation as it can cause conflicts with the main animation
 });

 const statLabel = key === 'health'?'Health': key === 'happiness'?'Happiness': 'Energy';
 const accessibilityProps = getProgressAccessibilityProps({
 label: `${statLabel} level`,
 value: Math.round(value),
 max: max,
 hint: ACCESSIBILITY_HINTS.GAME_ELEMENTS[key.toUpperCase() as 'HEALTH'|'HAPPINESS'|'ENERGY'] || `${statLabel} level`,
 });

 return (
 <View key={key} style={styles.statRow}>
 <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
 <TouchableOpacity
 style={[styles.statTouchable, { flex: 1 }]}
 onLongPress={() => setShowQuickActions(showQuickActions === key ? null: key)}
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
 accessibilityRole="button"accessibilityHint={
 key ==='energy'?`${accessibilityProps.accessibilityHint}. Tap to see energy breakdown. Long press to see quick actions.`: key ==='happiness'?`${accessibilityProps.accessibilityHint}. Tap to see happiness breakdown. Long press to see quick actions.`: key ==='health'?`${accessibilityProps.accessibilityHint}. Tap to see health breakdown. Long press to see quick actions.`:`${accessibilityProps.accessibilityHint}. Long press to see quick actions.`}
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
 text:`${Math.round(value)} out of ${max}`,
 }}
 >
 <Animated.View
 style={[
 styles.progressFill,
 darkMode && styles.progressFillDark,
 { width: progressWidth },
 ]}
 >
 <LinearGradient
 colors={gradient}
 style={StyleSheet.absoluteFill}
 start={{ x: 0, y: 0 }}
 end={{ x: 1, y: 0 }}
 />
 {/* R-perf: low-stat glow PULSE rendered as a native-driven opacity wash
 (mirrors the LinearGradient child above). Previously an animated
 shadowOpacity on the JS driver, which churned the JS thread every
 frame and janked the busy post-tick window. progressFill keeps its
 own static shadow for the base halo, so only the pulse moved here. */}
 {shouldGlow(value) && (
 <Animated.View
 pointerEvents="none"
 style={[
 StyleSheet.absoluteFill,
 {
 backgroundColor: glowColors[key as 'health'|'happiness'|'energy'],
 opacity: glowAnimations[key as 'health'|'happiness'|'energy'].interpolate({
 inputRange: [0, 1],
 outputRange: [0, 0.35],
 }),
 },
 ]}
 />
 )}
 </Animated.View>
 </View>
 {showStatArrows && netChange!== undefined && netChange!== 0 && (
 <View style={styles.statArrowContainer}>
 {netChange > 0 ? (
 <ArrowUp size={scale(14)} color="#10B981"/>
 ): (
 <ArrowDown size={scale(14)} color="#EF4444" />
 )}
 </View>
 )}
 {/* Disease Indicator - Inside statRowContent, close to arrows */}
 {key ==='health'&& hasDiseases && (
 <TouchableOpacity
 style={[
 styles.diseaseIndicator,
 hasCriticalDisease && styles.diseaseIndicatorCritical,
 hasSeriousDisease &&!hasCriticalDisease && styles.diseaseIndicatorSerious,
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
 accessibilityLabel={`${diseases.length} active disease${diseases.length!== 1 ?'s': ''}`}
 accessibilityRole="button"accessibilityHint="Tap to view disease details"
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
 <LinearGradient colors={['#3B82F6','#1D4ED8'] as const} style={styles.quickActionGradient}>
 <action.icon size={16} color="#FFFFFF"/>
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
 <View style={[styles.leftMoneySection, { flexWrap: isVerySmallDevice ?'wrap': 'nowrap'}]}>
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
 colors={['#16A34A','#22C55E'] as const}
 style={[
 styles.moneyChip,
 isVerySmallDevice && {
 paddingHorizontal: scale(6), // Reduced from 8
 minWidth: scale(55) // Reduced from 60
 }
 ]}
 start={{ x: 0, y: 0 }}
 end={{ x: 1, y: 1 }}
 >
 <Wallet size={14} color="#FFFFFF"style={styles.chipIcon} />
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
 colors={['#F59E0B','#FBBF24'] as const}
 style={[
 styles.moneyChip,
 isVerySmallDevice && {
 paddingHorizontal: scale(6), // Reduced from 8
 minWidth: scale(55) // Reduced from 60
 }
 ]}
 start={{ x: 0, y: 0 }}
 end={{ x: 1, y: 1 }}
 >
 <PiggyBank size={14} color="#FFFFFF"style={styles.chipIcon} />
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
 colors={['#6366F1','#4F46E5']}
 style={[
 styles.moneyChip,
 isVerySmallDevice && {
 paddingHorizontal: scale(6), // Reduced from 8
 minWidth: scale(55) // Reduced from 60
 }
 ]}
 start={{ x: 0, y: 0 }}
 end={{ x: 1, y: 1 }}
 >
 <Gem size={14} color="#FFFFFF"style={styles.chipIcon} />
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
 {/* Modals — single openModal state controls visibility. Each is lazy and
     only mounted while open, then wrapped in Suspense so the chunk can load. */}
 {openModal && (
 <Suspense fallback={null}>
 {openModal === 'settings' && <SettingsModal visible onClose={closeModal} />}
 {openModal === 'gemShop' && <GemShopModal visible onClose={closeModal} />}
 {openModal === 'help' && <HelpModal visible onClose={closeModal} />}
 {openModal === 'energyBreakdown' && <EnergyBreakdownModal visible onClose={closeModal} />}
 {openModal === 'happinessBreakdown' && <HappinessBreakdownModal visible onClose={closeModal} />}
 {openModal === 'healthBreakdown' && <HealthBreakdownModal visible onClose={closeModal} />}
 {openModal === 'moneyBreakdown' && <MoneyBreakdownModal visible onClose={closeModal} />}
 {openModal === 'bankBreakdown' && <BankBreakdownModal visible onClose={closeModal} />}
 {openModal === 'gemsBreakdown' && <GemsBreakdownModal visible onClose={closeModal} />}
 {openModal === 'prestige' && <PrestigeModal visible onClose={closeModal} />}
 </Suspense>
 )}
 </View>
 );
}

// Memoized RightSide component to prevent unnecessary re-renders
const RightSide = React.memo(function RightSide({ date }: { date?: { week?: number; year?: number; month?: string | number; age?: number } }) {
 // RightSide needs nextWeek action, so use both hooks
 // Hooks must be called unconditionally - if provider isn't ready, the error will be caught by ErrorBoundary
 const { nextWeek } = useGameActions();
 const { width } = useWindowDimensions();
 // Handle both iPhone Pro Max (428px+) and large Android devices (600px+)
 const isExtraLargeDevice = width > 428 || isAndroidXLarge(); // iPhone 15 Pro Max and large Android phones
 const { AnimatedView, animatedStyle, onPressIn, onPressOut } = usePressableScale();
 const settings = useGameSelector((s) => s?.settings, shallowEqual);
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
 // P1-5: drop `date` (object identity changes every save); `weekAnimations`
 // is a stable useRef.current array — only need `date?.week` for the effect.
 }, [date?.week]);

 // Spinner animation for loading state.
 // R2-I: capture the loop handle and stop it on cleanup. The previous version
 // created an anonymous `Animated.loop(...)` and never called `.stop()`, so
 // every `isAdvancingWeek` toggle stacked another native-driver loop.
 useEffect(() => {
 if (!isAdvancingWeek) {
 spinValue.setValue(0);
 return;
 }
 spinValue.setValue(0);
 const spinLoop = Animated.loop(
 Animated.timing(spinValue, {
 toValue: 1,
 duration: 1000,
 useNativeDriver: true,
 })
 );
 spinLoop.start();
 return () => {
 spinLoop.stop();
 };
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
 ? width * 0.62 // Reduced from 0.65
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
 ? scale(85) // Reduced from 90
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
 ? width * 0.38 // Ensure it doesn't exceed available space
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
: (isVerySmallDevice ? scale(75): scale(85));

 // Calculate responsive margin for right section
 const rightSectionMargin = isVerySmallDevice
 ? responsiveSpacing.sm // Smaller margin on very small devices
: responsiveSpacing.md; // Medium margin otherwise

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
 const monthNum = typeof date.month === 'number'? date.month: parseInt(String(date.month), 10);
 if (isNaN(monthNum)) return String(date.month).replace(/\s*Week\s*\d+/i,'').replace(/\d+/g, '').trim() || 'Unknown';
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
 // Clear any prior safety timer before arming a new one.
 if (timeoutRef.current) {
 clearTimeout(timeoutRef.current);
 timeoutRef.current = null;
 }
 // Safety cap: if the tick somehow never settles, re-enable the button so it
 // can't get stuck disabled. Cleared in the finally below on normal completion.
 timeoutRef.current = setTimeout(() => {
 setIsAdvancingWeek(false);
 timeoutRef.current = null;
 }, 5000);
 // Defer the heavy synchronous nextWeek() work to the next frame so React
 // commits the greyed/spinner (disabled) state and PAINTS it before the tick
 // blocks the JS thread — the press registers instantly instead of feeling
 // frozen. Clearing isAdvancingWeek on real completion (await) keeps the
 // spinner honest: a brief flash for fast ticks, a real spin for slow ones.
 const rafId = requestAnimationFrame(() => {
 void (async () => {
 try {
 await nextWeek();
 } finally {
 if (timeoutRef.current) {
 clearTimeout(timeoutRef.current);
 timeoutRef.current = null;
 }
 setIsAdvancingWeek(false);
 }
 })();
 });
 addCleanup(() => {
 cancelAnimationFrame(rafId);
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
 accessibilityLabel={isAdvancingWeek ? "Advancing to next week": "Advance to next week"}
 accessibilityRole="button"accessibilityState={{ disabled: isAdvancingWeek }}
 >
 <LinearGradient colors={isAdvancingWeek ? ['#6B7280','#9CA3AF'] as const: ['#16A34A', '#22C55E'] as const} style={styles.nextWeekButton} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
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
 <ArrowRightCircle size={20} color="#FFFFFF"/>
 </Animated.View>
 ): (
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


// Export memoized TopStatsBar - no props, so it will re-render on gameState changes
// but we've optimized it to only subscribe to specific gameState properties
export default React.memo(TopStatsBarComponent);
