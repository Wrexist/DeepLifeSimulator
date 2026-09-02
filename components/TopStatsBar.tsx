// components/TopStatsBar.tsx
import React, { useState, useRef, useEffect, useMemo, useCallback, Suspense } from 'react';
import { View,
 Text,
 TouchableOpacity,
 Animated,
 useWindowDimensions,
 Easing } from 'react-native';
import {
 responsivePadding,
 responsiveFontSize,
 responsiveSpacing,
 scale,
 isSmallDevice,
 isIPad,
 isAndroidXLarge,
} from '@/utils/scaling';
import { useGameActions } from '@/contexts/GameContext';
import { useGameSelector, useSetGameState, shallowEqual } from '@/contexts/game/useGameSelector';
import type { GameState } from '@/contexts/game/types';
import { useGemStore } from '@/contexts/GemStoreContext';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { maybeShowInterstitialForWeek } from '@/lib/ads/interstitial';
import { weeksSinceLifeStart } from '@/utils/weekCounters';
import { STAT_IDENTITY } from '@/lib/config/statIdentity';
import { CRITICAL_VITAL } from '@/lib/config/hierarchy';
import AnimatedMoney from '@/components/ui/AnimatedMoney';
import GoldStoreButton from '@/components/ui/GoldStoreButton';
import ProgressRing from '@/components/ui/ProgressRing';
import { styles } from '@/components/TopStatsBarStyles';
import {
 Wallet,
 Gem,
 Plus,
 Settings,
 ArrowRightCircle,
 Coffee,
 Apple,
 Dumbbell,
 Crown,
 AlertTriangle,
} from 'lucide-react-native';
// SicknessModal is rendered once at the root in app/_layout.tsx - no second mount here.
import SeasonalIndicator from './SeasonalIndicator';
import usePressableScale from '@/hooks/usePressableScale';
import { useFeedback } from '@/utils/feedbackSystem';
import { usePerformanceMonitor, useMemoryCleanup } from '@/utils/performanceOptimization';
import { getProgressAccessibilityProps, ACCESSIBILITY_HINTS } from '@/utils/accessibility';
// Rarely-opened modals - lazy-loaded and only mounted when open, so they no
// longer sit permanently mounted with visible={false} (which kept their trees
// built on every TopStatsBar render).
const SettingsModal = React.lazy(() => import('./SettingsModal'));
// GemShopModal is no longer mounted here - the app-level GemStoreProvider
// (contexts/AppProviders.tsx) owns the single mount. This bar deep-links into
// it via useGemStore().openStore(...) so there is no double-mount.
// HelpModal moved into SettingsModal (Help & FAQ row) - the HUD lost its
// dedicated help circle in the phase-2 de-clutter.
const PrestigeModal = React.lazy(() => import('./PrestigeModal'));
const EnergyBreakdownModal = React.lazy(() => import('./EnergyBreakdownModal'));
const HappinessBreakdownModal = React.lazy(() => import('./HappinessBreakdownModal'));
const HealthBreakdownModal = React.lazy(() => import('./HealthBreakdownModal'));
const MoneyBreakdownModal = React.lazy(() => import('./MoneyBreakdownModal'));
const GemsBreakdownModal = React.lazy(() => import('./GemsBreakdownModal'));

// Memoized TopStatsBar to prevent unnecessary re-renders
function TopStatsBarComponent() {
 // Sprint 2: select only the slices this bar reads - it no longer re-renders
 // on changes to unrelated state (loans, companies, social feeds, ...).
 const setGameState = useSetGameState();
 // saveGame only - this hook's other members are not read here, and the actions
 // context does not carry a state subscription.
 const { saveGame } = useGameActions();
 const stats = useGameSelector((s) => s?.stats, shallowEqual);
 const settings = useGameSelector((s) => s?.settings, shallowEqual);
 const generationNumber = useGameSelector((s) => s?.generationNumber);
 const prestige = useGameSelector((s) => s?.prestige);
 const prestigeLevel = prestige?.prestigeLevel ?? 0;
 const date = useGameSelector((s) => s?.date, shallowEqual);
 // Needed by the quick-action week gate below.
 const weeksLived = useGameSelector((s) => s?.weeksLived ?? 0);
 const userProfile = useGameSelector((s) => s?.userProfile);
 const diseases = useGameSelector((s) => s?.diseases) || [];
 const hasDiseases = diseases.length > 0;
 const hasCriticalDisease = diseases.some(d => d.severity === 'critical');
 const hasSeriousDisease = diseases.some(d => d.severity === 'serious');


 const { success, info, buttonPress, haptic } = useFeedback();
 const { logRender } = usePerformanceMonitor();
 // App-level IAP store launcher (single mount lives in GemStoreProvider).
 const { openStore } = useGemStore();

 // Single modal state - only one modal open at a time, reduces re-renders
 type ModalName = 'settings'|'prestige'|'energyBreakdown'|'happinessBreakdown'|'healthBreakdown'|'moneyBreakdown'|'gemsBreakdown'| null;
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

 const { width } = useWindowDimensions();

 const getStatColor = (_stat: string, value: number) => {
 if (value >= 80) return'#059669'; // Beautiful emerald green
 if (value >= 60) return '#D97706'; // Warm amber
 if (value >= 40) return '#EA580C'; // Vibrant orange
 return '#DC2626'; // Deep red for critical
 };

 const shouldGlow = (value: number) => value >= 90 || value <= 20;

 const handleQuickAction = useCallback((action: string) => {
 buttonPress();
 setShowQuickActions(null);

 const clamp = (v: number) => Math.max(0, Math.min(100, v));

 // ONE USE PER ACTION PER GAME WEEK.
 //
 // The comment that used to sit here claimed each action was "a self-limiting
 // trade (spends a resource) so none is a free, spammable win". That was false:
 // `rest` had no gate of any kind, so rest -> social netted +6 energy and
 // +5 happiness per cycle, repeatable forever from the always-visible HUD, and
 // `exercise` then turned the free energy into free fitness and health. Energy
 // is the currency that gates street jobs, crime, health activities and
 // hobbies, so this was a general-purpose bypass of the whole weekly budget.
 // 2026-07-30 audit UX-R1-02.
 // `Number.isFinite`, not `typeof === 'number'`, and both sides normalized.
 // `NaN === NaN` is false, so a save carrying a NaN `weeksLived` - or a NaN
 // mark - made this return false unconditionally and reopened the very bypass
 // the gate exists to close. A non-finite value means "unknown week", which
 // must fall back to the gate being CLOSED for a mark that exists at all.
 const usedThisWeek = (prev: GameState, id: string): boolean => {
 const mark = prev?.settings?.quickActionWeeks?.[id];
 if (typeof mark !== 'number') return false;
 const week = prev?.weeksLived;
 if (!Number.isFinite(mark) || !Number.isFinite(week)) return true;
 return mark === week;
 };

 /** Can `prev` pay this action's cost? Checked against `prev`, never a snapshot. */
 const canPay = (
 prev: GameState,
 deltas: { money?: number; energy?: number },
 ): boolean => {
 const st = prev.stats ?? ({} as GameState['stats']);
 if (deltas.money != null && deltas.money < 0 && (st.money ?? 0) < -deltas.money) return false;
 if (deltas.energy != null && deltas.energy < 0 && (st.energy ?? 0) < -deltas.energy) return false;
 return true;
 };

 // One refusal path, so the two callers below cannot drift in wording or
 // haptic. (Review of this change flagged the duplication.)
 const refuseWeeklyGate = () => {
 haptic('warning');
 info('Already done that this week - come back next week.');
 };

 const apply = (
 deltas: Partial<{ health: number; happiness: number; energy: number; fitness: number; money: number }>,
 msg: string,
 ) => {
 setGameState(prev => {
 // Re-check against `prev`, not the captured selector value, so two taps
 // in the same React batch cannot both pass - the weekly gate AND the
 // cost. The cost matters on its own: `social` (−8 energy) and `exercise`
 // (−12 energy) are different actions, so the weekly gate lets both
 // through in one batch, and both would read the same stale 15 energy
 // from the selector snapshot and pass. Charging against `prev` refuses
 // the second instead of clamping the balance at 0 and granting anyway.
 if (usedThisWeek(prev, action) || !canPay(prev, deltas)) return prev;
 const st = prev.stats;
 return {
 ...prev,
 settings: {
 ...prev.settings,
 quickActionWeeks: { ...(prev.settings?.quickActionWeeks ?? {}), [action]: prev.weeksLived ?? 0 },
 },
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
 // Persist the grant AND the weekly marker. Without this the whole tick lives
 // only in memory until the 2-minute autosave, so a force-kill loses the
 // marker and re-arms the action for the same game week - the exact bypass
 // this gate exists to close. Deferred a macrotask because saveGame reads
 // gameStateRef.current, which is synced post-commit.
 setTimeout(() => { void saveGame?.(false); }, 0);
 };

 const s = stats ?? { money: 0, energy: 0 };
 // The gate the PLAYER is told about, checked against committed state.
 //
 // It used to also read a `refused` flag that the updater sets, which cannot
 // work: React is free to defer an updater past the point this callback
 // returns, so the flag was still `false` when it was read. Messaging is
 // driven from the committed snapshot instead, and the updater is purely
 // authoritative for state. The two can only disagree for two taps inside a
 // single React batch, where the worst case is an optimistic toast for a
 // second tap that correctly changed nothing - no grant, no exploit.
 if (usedThisWeek({ settings, weeksLived } as GameState, action)) {
 refuseWeeklyGate();
 return;
 }
 switch (action) {
 case 'eat':
 if ((s.money ?? 0) < 12) { haptic('warning'); info('Need $12 to grab a healthy meal.'); return; }
 apply({ money: -12, health: 7, happiness: 4 }, 'Healthy meal - +7 health, +4 happiness.');
 break;
 case 'rest':
 apply({ happiness: -5, energy: 14 }, 'You rest up - +14 energy (−5 happiness).');
 break;
 case 'social':
 if ((s.energy ?? 0) < 8) { haptic('warning'); info('Too tired to socialize right now.'); return; }
 apply({ energy: -8, happiness: 10 }, 'Good company - +10 happiness.');
 break;
 case 'exercise':
 if ((s.energy ?? 0) < 12) { haptic('warning'); info('Too tired to work out right now.'); return; }
 apply({ energy: -12, fitness: 6, health: 5 }, 'Great workout - +6 fitness, +5 health.');
 break;
 }
 }, [buttonPress, haptic, success, info, setGameState, stats, settings, weeksLived, saveGame]);

 // Optimized stat colors with better memoization
 const statColors = useMemo(
 () => ({
 health: getStatColor('health', stats?.health ?? 0),
 happiness: getStatColor('happiness', stats?.happiness ?? 0),
 energy: getStatColor('energy', stats?.energy ?? 0),
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
 duration: 0, // Instant snap - stat drain/gain shows the moment state changes
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
 // the UI thread and no longer touches the JS thread every frame - it stopped
 // janking the already-busy post-tick window.
 if (shouldGlow(value)) {
 // NOISE: pulse a few cycles as an attention cue, then rest. The old
 // unbounded loop kept the HUD pulsing for as long as the stat stayed
 // low - which early-game is basically always.
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
 // GameStateProvider behaviour) - primitive deps suffice. `animatedStats` and
 // `glowAnimations` are stable refs from useRef.
 }, [stats?.health, stats?.happiness, stats?.energy]);

 // The per-stat delta arrows and their ~90-line prediction memo are gone
 // (phase 2): they were three more numbers on a bar that already showed 13,
 // they required this component to subscribe to careers/educations/dietPlans/
 // realEstate/rental, and the SAME projection lives one tap away in each
 // vital's breakdown modal - which is where a number that needs explaining
 // belongs.

 const progressStats = React.useMemo(
 () => {
 if (!stats) return [];
 return [
 {
 key:'health',
 icon: STAT_IDENTITY.health.Icon,
 value: stats.health,
 // The RING colour still grades by value (green at 80+, red when critical);
 // the BAR carries the stat's identity colour, which is what the rest of the
 // app now matches (lib/config/statIdentity.ts).
 color: statColors.health,
 gradient: [STAT_IDENTITY.health.color, '#F87171'] as [string, string],
 max: 100,
 quickActions: [
 { icon: Apple, label: 'Eat Healthy', action: () => handleQuickAction('eat') },
 { icon: Coffee, label: 'Rest', action: () => handleQuickAction('rest') },
 ],
 },
 {
 key: 'happiness',
 icon: STAT_IDENTITY.happiness.Icon,
 value: stats.happiness,
 color: STAT_IDENTITY.happiness.color,
 gradient: [STAT_IDENTITY.happiness.color, '#FBBF24'] as [string, string],
 max: 100,
 quickActions: [
 { icon: Coffee, label: 'Socialize', action: () => handleQuickAction('social') },
 { icon: Dumbbell, label: 'Exercise', action: () => handleQuickAction('exercise') },
 ],
 },
 {
 key: 'energy',
 icon: STAT_IDENTITY.energy.Icon,
 value: stats.energy,
 color: STAT_IDENTITY.energy.color,
 gradient: [STAT_IDENTITY.energy.color, '#60A5FA'] as [string, string],
 max: 100,
 quickActions: [
 { icon: Coffee, label: 'Rest', action: () => handleQuickAction('rest') },
 { icon: Apple, label: 'Eat', action: () => handleQuickAction('eat') },
 ],
 },
 ];
 },
 // P2: depend on the primitive stat VALUES (and the already-memoized derived
 // objects) rather than the whole `stats` object, whose identity changes every
 // tick - this list rebuild only matters when a displayed value changes.
 [stats?.health, stats?.happiness, stats?.energy, statColors, handleQuickAction]
 );

 // Standardized breakpoint for small devices (covers iPhone SE and Android small devices)
 const SMALL_DEVICE_BREAKPOINT = 360;
 const isVerySmallDevice = isSmallDevice() && width < SMALL_DEVICE_BREAKPOINT;

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
 const iconColor = darkMode ? '#E2E8F0': '#0F172A';

 // Flat fill - these are 22px circles; the old two-stop gradient across them
 // was invisible and cost an SVG layer each on the always-mounted HUD.
 const controlButtonFill = darkMode ? '#1E293B' : '#FFFFFF';

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

 return (
 <View style={containerStyle}>
 {/* Left: generation badge + controls + stats */}
 <View style={[styles.leftSection, { minWidth: 0 }]}>
 <View style={styles.generationRow}>
 <Text maxFontSizeMultiplier={1.3} style={[styles.generationBadge, darkMode && styles.generationBadgeDark]}>
 Gen {generationNumber ?? 1}
 </Text>
 {(prestigeLevel > 0) && (
 <View style={styles.prestigeBadgeContainer}>
 <View style={styles.prestigeBadge}>
 <Crown size={12} color="#FFFFFF"/>
 <Text maxFontSizeMultiplier={1.3} style={styles.prestigeBadgeText}>P{prestigeLevel}</Text>
 </View>
 </View>
 )}
 </View>
 <View style={styles.leftIconRow}>
 {/* Same quiet circular button as Help/Settings beside it (the old big blue
     "Shop" pill dominated the HUD - owner feedback); the blue storefront
     glyph keeps it findable without shouting. */}
 {/* Gold, with a slow shine. It keeps the EXACT footprint of the grey
     Help/Settings circles beside it - the owner rejected an earlier large
     blue "Shop" pill for dominating the HUD, and this changes the finish,
     not the size. Motion honours reduced-motion and carries no badge or
     counter; see GoldStoreButton for the reasoning. */}
 <GoldStoreButton
 onPress={() => { buttonPress(); openStore('store'); }}
 buttonStyle={[styles.iconButton, darkMode && styles.iconButtonDark] as never}
 />
 <TouchableOpacity
 onPress={() => { buttonPress(); setOpenModal('settings'); }}
 style={[styles.iconButton, darkMode && styles.iconButtonDark]}
 activeOpacity={0.85}
 accessibilityLabel="Open Settings"
 accessibilityRole="button"
 accessibilityHint={ACCESSIBILITY_HINTS.BUTTONS.SETTINGS}
 >
 <View style={[styles.iconButtonGradient, { backgroundColor: controlButtonFill }]}>
 <Settings size={22} color={iconColor} />
 </View>
 </TouchableOpacity>
 <View style={[styles.iconButton, darkMode && styles.iconButtonDark]}>
 <SeasonalIndicator size={22} />
 </View>
 </View>

 <View style={styles.vitalsRingRow}>
 {progressStats.map(({ key, icon: Icon, gradient, max, quickActions, value }) => {
 const ringColor = gradient[0];
 const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;

 const statLabel = key === 'health'?'Health': key === 'happiness'?'Happiness': 'Energy';
 const accessibilityProps = getProgressAccessibilityProps({
 label: `${statLabel} level`,
 value: Math.round(value),
 max: max,
 hint: ACCESSIBILITY_HINTS.GAME_ELEMENTS[key.toUpperCase() as 'HEALTH'|'HAPPINESS'|'ENERGY'] || `${statLabel} level`,
 });

 return (
 <View key={key} style={styles.vitalRingCell}>
 <TouchableOpacity
 style={styles.vitalRingTouchable}
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
 accessibilityRole="button"
 accessibilityHint={
 key ==='energy'?`${accessibilityProps.accessibilityHint}. Tap to see energy breakdown. Long press to see quick actions.`: key ==='happiness'?`${accessibilityProps.accessibilityHint}. Tap to see happiness breakdown. Long press to see quick actions.`: key ==='health'?`${accessibilityProps.accessibilityHint}. Tap to see health breakdown. Long press to see quick actions.`:`${accessibilityProps.accessibilityHint}. Long press to see quick actions.`}
 >
 <View style={styles.vitalRingWrap}>
 <ProgressRing
 value={pct}
 size={40}
 strokeWidth={5}
 ambient={false}
 showPill={false}
 accentColor={ringColor}
 trackColor="rgba(148,163,184,0.18)"
 label={`${statLabel} level`}
 >
 <Icon size={16} color={ringColor} />
 </ProgressRing>
 {/* Disease badge - corner of the health ring */}
 {key ==='health'&& hasDiseases && (
 <TouchableOpacity
 style={[
 styles.vitalRingDisease,
 hasCriticalDisease && styles.diseaseIndicatorCritical,
 hasSeriousDisease &&!hasCriticalDisease && styles.diseaseIndicatorSerious,
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
 <AlertTriangle size={scale(9)} color="#FFFFFF" />
 </TouchableOpacity>
 )}
 </View>
 <View style={styles.vitalRingLabelRow}>
 <Text
 maxFontSizeMultiplier={1.3}
 style={[styles.vitalRingValue, value <= CRITICAL_VITAL && styles.vitalRingValueCritical]}
 >
 {Math.round(value)}
 </Text>
 {/* Visible long-press affordance. The quick actions (Rest / Eat /
 Exercise / Socialize) are the fastest way to fix a low vital - the
 exact thing the contextual tips nag about - but the only place the
 gesture was ever announced was `accessibilityHint`, i.e. VoiceOver
 users were told and sighted users were not. Tap opens the breakdown
 modal, so that is what everyone discovered instead. This dot is the
 smallest honest hint that there is more here; it hides while the
 row is open so it never reads as a state indicator. */}
 {quickActions && showQuickActions !== key && (
 <View style={styles.vitalRingMoreDot} />
 )}
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
 <View style={[styles.quickActionGradient, { backgroundColor: '#2563EB' }]}>
 <action.icon size={16} color="#FFFFFF"/>
 <Text maxFontSizeMultiplier={1.3} style={styles.quickActionText}>{action.label}</Text>
 </View>
 </TouchableOpacity>
 ))}
 </View>
 )}
 </View>
 );
 })}
 </View>

 {/* Money, Bank, Gems - NEW CHIP STYLES */}
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
 accessibilityHint="Tap to see your cash, savings and investments"
 >
 <View
 style={[
 styles.moneyChip,
 styles.moneyChipCash,
 isVerySmallDevice && {
 paddingHorizontal: scale(6),
 minWidth: scale(55)
 }
 ]}
 >
 <Wallet size={14} color={STAT_IDENTITY.money.color} style={styles.chipIcon} />
 <View style={styles.chipTextContainer}>
 <AnimatedMoney
 value={stats?.money ?? 0}
 style={styles.chipText}
 duration={300}
 />
 </View>
 </View>
 </TouchableOpacity>

 <TouchableOpacity
 onPress={() => {
 buttonPress();
 setOpenModal('gemsBreakdown');
 }}
 activeOpacity={0.7}
 accessibilityLabel={`Gems: ${formatGems(stats?.gems ?? 0)}`}
 accessibilityRole="button"
 accessibilityHint="Tap to see your gem breakdown. Use the plus button to buy gems."
 >
 <View
 style={[
 styles.moneyChip,
 styles.moneyChipQuiet,
 isVerySmallDevice && {
 paddingHorizontal: scale(6),
 minWidth: scale(55)
 }
 ]}
 >
 <Gem size={14} color="#A5B4FC" style={styles.chipIcon} />
 <View style={styles.chipTextContainer}>
 <Text maxFontSizeMultiplier={1.3}
 style={styles.chipText}
 numberOfLines={1}
 adjustsFontSizeToFit={true}
 minimumFontScale={0.7}
 >
 {formatGems(stats?.gems ?? 0)}
 </Text>
 </View>
 {/* The + is the ONE store affordance on the chip. Tap-on-chip used to open
     the STORE while every sibling chip's tap opened a breakdown - the only
     gesture inversion in the HUD, and a monetization tap wired to the
     primary gesture of a stat readout. Now: chip = breakdown, + = buy. */}
 <TouchableOpacity
 onPress={() => {
 buttonPress();
 openStore('gems');
 }}
 hitSlop={{ top: 8, bottom: 8, left: 4, right: 8 }}
 accessibilityLabel="Buy gems"
 accessibilityRole="button"
 accessibilityHint="Opens the gem store"
 style={styles.gemChipPlus}
 >
 <Plus size={12} color="#FFFFFF" />
 </TouchableOpacity>
 </View>
 </TouchableOpacity>
 </View>
 </View>
 </View>

  {/* Right: date + next week */}
 <RightSide date={date} />
 {/* Modals - single openModal state controls visibility. Each is lazy and
     only mounted while open, then wrapped in Suspense so the chunk can load. */}
 {openModal && (
 <Suspense fallback={null}>
 {openModal === 'settings' && <SettingsModal visible onClose={closeModal} />}
 {openModal === 'energyBreakdown' && <EnergyBreakdownModal visible onClose={closeModal} />}
 {openModal === 'happinessBreakdown' && <HappinessBreakdownModal visible onClose={closeModal} />}
 {openModal === 'healthBreakdown' && <HealthBreakdownModal visible onClose={closeModal} />}
 {openModal === 'moneyBreakdown' && <MoneyBreakdownModal visible onClose={closeModal} />}
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
 // For the interstitial breakpoint: current in-game week + whether ads are removed.
 const weeksLived = useGameSelector((s) => s?.weeksLived ?? 0);
 // The grace half of the gate measures weeks into THIS life (CLAUDE.md §4.2);
 // pre-v43 saves have no lifeStartWeek and fall back to the absolute counter.
 const lifeStartWeek = useGameSelector((s) => s?.lifeStartWeek);
 const adsRemoved = useGameSelector((s) => s?.settings?.adsRemoved === true);
 // A blocking result modal (death/wedding/jail) - or an auto-mounted
 // LifeMomentModal (app/(tabs)/_layout.tsx renders one whenever the tick sets
 // lifeMoments.pendingMoment) - must never get an interstitial on top of it (an
 // ad over an open RN Modal is the documented iOS freeze). The tick itself can
 // RAISE any of these in the SAME tick, so we read them via a ref the
 // external-store selector keeps current, then check it AFTER the tick: nextWeek()
 // awaits a macrotask past its own setGameState commit, so this component has
 // re-rendered and blockedRef.current reflects the just-ticked state by the call.
 const blockingModalActive = useGameSelector(
   (s) =>
     s?.showDeathPopup === true ||
     s?.showWeddingPopup === true ||
     (s?.jailWeeks ?? 0) > 0 ||
     !!s?.lifeMoments?.pendingMoment,
 );
 const blockedRef = useRef(blockingModalActive);
 blockedRef.current = blockingModalActive;
 const { buttonPress, haptic } = useFeedback();
 const reduced = useReducedMotion();

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
 // Reduced motion: skip the bounce entirely - the pip's color/state change is
 // the cue. This is the game's highest-frequency action, so the motion is kept
 // gentle (1→1.08→1) even when enabled.
 if (reduced) return;
 const idx = Math.min(3, Math.max(0, (date.week ?? 1) - 1));
 Animated.sequence([
 Animated.timing(weekAnimations[idx], { toValue: 1.08, duration: 140, useNativeDriver: true }),
 Animated.timing(weekAnimations[idx], { toValue: 1, duration: 140, useNativeDriver: true }),
 ]).start();
 // P1-5: drop `date` (object identity changes every save); `weekAnimations`
 // is a stable useRef.current array - only need `date?.week` for the effect.
 }, [date?.week, reduced]);

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
 ? scale(95) // Extra large phones (iPhone 17 Pro Max etc) - give date box enough room
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
 <View
 style={[
 styles.dateOuter,
 styles.dateOuterNeutral,
 {
 width: dateBoxWidth,
 maxWidth: dateBoxMaxWidth,
 height: dateBoxHeight,
 minHeight: dateBoxMinHeight,
 }
 ] as any}
 >
 <View style={styles.dateInner}>
 <View style={styles.dateHeader}>
 <Text maxFontSizeMultiplier={1.3}
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
 <Text maxFontSizeMultiplier={1.3}
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
 <Text maxFontSizeMultiplier={1.3} style={[
 styles.ageText,
 isExtraLargeDevice && {
 fontSize: responsiveFontSize.xs,
 lineHeight: scale(13),
 }
 ]}>Age {Math.floor(date?.age || 0)}</Text>
 <View style={styles.weekDots}>
 {[1, 2, 3, 4].map((w, idx) => {
 const currentWeek = Math.min(4, Math.max(1, Math.floor(date?.week ?? 1)));
 const isCurrent = w === currentWeek;
 const isPast = w < currentWeek;
 return (
 <Animated.View
 key={w}
 style={[
 styles.weekDot,
 isPast && styles.weekDotPast,
 isCurrent && styles.weekDotCurrent,
 !isPast && !isCurrent && styles.weekDotFuture,
 isExtraLargeDevice && styles.weekDotXL,
 { transform: [{ scale: weekAnimations[idx] }] },
 ]}
 />
 );
 })}
 </View>
 </View>
 </View>

 <View style={styles.seasonalAndNextWeekContainer}>
 <View style={styles.nextWeekContainer}>
 <AnimatedView style={animatedStyle}>
 <TouchableOpacity
 onPress={() => {
 if (isAdvancingWeek) return;
 // Snapshot the week now so we can detect a year boundary after the tick.
 const weeksBefore = weeksLived;
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
 // blocks the JS thread - the press registers instantly instead of feeling
 // frozen. Clearing isAdvancingWeek on real completion (await) keeps the
 // spinner honest: a brief flash for fast ticks, a real spin for slow ones.
 const rafId = requestAnimationFrame(() => {
 void (async () => {
 try {
 await nextWeek();
 // Natural breakpoint: if an in-game year just turned over, maybe show an
 // interstitial. Self-gated - a no-op when ads are removed, off, not
 // loaded, or within the frequency cap. `blocked` is read AFTER the tick so
 // a death/wedding/jail modal this tick raised suppresses the ad.
 void maybeShowInterstitialForWeek(weeksBefore + 1, {
 adsRemoved,
 blocked: blockedRef.current,
 weeksThisLife: weeksSinceLifeStart(weeksBefore + 1, lifeStartWeek),
 });
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
 accessibilityLabel={isAdvancingWeek ? 'Advancing to next week' : 'Advance to next week'}
 accessibilityRole="button"accessibilityState={{ disabled: isAdvancingWeek }}
 >
 {/* LABELED. This is the game's primary action and its highest-frequency
     tap, and it spent its whole life as an unlabeled 20px arrow in a
     circle - the audit's clearest "primary action buried" finding. A word
     plus the arrow, sized to the date box above it, at the same corner it
     has always lived in. Flat fill (the gradient said nothing). */}
 <View style={[styles.nextWeekButton, { width: dateBoxWidth, backgroundColor: isAdvancingWeek ? '#64748B' : '#16A34A' }]}>
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
 <ArrowRightCircle size={18} color="#FFFFFF"/>
 </Animated.View>
 ): (
 <ArrowRightCircle size={18} color="#FFFFFF" />
 )}
 <Text maxFontSizeMultiplier={1.2} numberOfLines={1} style={styles.nextWeekLabel}>
 Next week
 </Text>
 </View>
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
