import React, { useCallback, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, ScrollView, Dimensions } from 'react-native';
import { AlertCircle, CheckCircle, XCircle, Leaf, Sun, Snowflake, X, TrendingUp, TrendingDown, DollarSign, ArrowUp, ArrowDown } from 'lucide-react-native';
import type { EnhancedEventChoice, EventSpecial } from '@/lib/events/engine';
import { useGameState, useGameActions } from '@/contexts/GameContext';
import { getCurrentSeason } from '@/lib/events/seasonalEvents';
import { modalEvents } from '@/lib/events/routing';
import { getCurrentEconomicState } from '@/lib/events/economyEvents';
import { resolveEventMoney } from '@/lib/events/moneyScaling';
import { netWorth } from '@/lib/progress/achievements';
import type { GameState } from '@/contexts/game/types';
import { logger } from '@/utils/logger';
import { formatMoney } from '@/utils/moneyFormatting';

import BlurViewFallback from '@/components/fallbacks/BlurViewFallback';
import Gradient from '@/components/ui/Gradient';
import { getPlatformShadows } from '@/utils/glassmorphismStyles';
import { fontScale, responsiveBorderRadius, responsiveSpacing, scale, verticalScale } from '@/utils/scaling';

/**
 * What each `special` effect actually does to the player, in one badge. These
 * were completely invisible in the preview — a choice that fires the player
 * from their job read as a bare stat change (2026-08-24 audit).
 */
const SPECIAL_EFFECT_LABELS: Record<EventSpecial | '', { text: string; positive: boolean } | undefined> = {
 '': undefined,
 grant_free_education: { text: 'Free education', positive: true },
 add_disease: { text: 'You fall ill', positive: false },
 fire_from_job: { text: 'You lose your job', positive: false },
 add_career_warning: { text: 'Formal warning at work', positive: false },
};

/** Net worth for the money-preview scaling; a throw must not blank the modal. */
function safeNetWorth(state: GameState): number {
 try {
 return netWorth(state);
 } catch {
 return 0;
 }
}

const LinearGradient = Gradient;
const { height: screenHeight } = Dimensions.get('window');
const log = logger.scope('WeeklyEventModal');

export default function WeeklyEventModal() {
 const { gameState, setGameState } = useGameState();
 const { resolveEvent, saveGame } = useGameActions();

 // CRASH FIX: Safe array access - prevent crash if pendingEvents is empty/undefined.
 //
 // `modalEvents` rather than `pendingEvents[0]`: letter-shaped events are routed
 // to the mail app and must not also appear here. Reading the raw array would
 // show a jury summons in a blocking modal AND in the inbox, and the dismiss
 // below would then remove whichever event happened to be first.
 const modalQueue = modalEvents(gameState);
 const event = modalQueue.length > 0 ? modalQueue[0] : null;

 // Optional-chain `pets`: a save predating the field leaves it undefined, and
 // this modal mounts outside the home ErrorBoundary on any weekly event.
 const pet = event ? gameState.pets?.find(p => p.id === event.relationId): undefined;

 // Emergency dismiss function - clears the current event if something is wrong
 const handleEmergencyDismiss = useCallback(() => {
 log.warn('Emergency dismiss triggered for event:', { eventId: event?.id });
 // Remove BY ID, not by index. `slice(1)` assumed the visible event was
 // always `pendingEvents[0]`, which stopped being true the moment some events
 // were routed elsewhere — it would have dismissed a mail letter instead.
 setGameState(prev => ({
...prev,
 pendingEvents: (prev.pendingEvents ?? []).filter(e => e?.id !== event?.id),
 }));
 saveGame();
 }, [setGameState, saveGame, event?.id]);

 // Safe resolve handler with error catching
 const resolvingRef = useRef<Set<string>>(new Set());
 const handleResolveEvent = useCallback((eventId: string, choiceId: string) => {
 const resolutionKey = `${eventId}_${choiceId}`;

 // Prevent duplicate calls
 if (resolvingRef.current.has(resolutionKey)) {
 log.warn('Event resolution already in progress, skipping duplicate call', { eventId, choiceId });
 return;
 }

 resolvingRef.current.add(resolutionKey);

 try {
 log.info('Resolving event', { eventId, choiceId });
 resolveEvent(eventId, choiceId);

 // Remove from pending after a short delay to allow state update
 setTimeout(() => {
 resolvingRef.current.delete(resolutionKey);
 }, 100);
 } catch (error) {
 log.error('Error resolving event:', error);
 resolvingRef.current.delete(resolutionKey);
 // If resolve fails, dismiss the event to prevent being stuck
 handleEmergencyDismiss();
 }
 }, [resolveEvent, handleEmergencyDismiss]);

 if (!event) return null;

 // Validate event has choices
 if (!event.choices ||!Array.isArray(event.choices) || event.choices.length === 0) {
 log.error('Event has no valid choices, auto-dismissing:', event.id);
 // Auto-dismiss malformed events
 handleEmergencyDismiss();
 return null;
 }

 // Check if this is a seasonal event
 const seasonalEventIds = [
 'spring_festival', 'garden_event', 'beach_party', 'summer_sale',
 'harvest_festival', 'career_fair', 'winter_holidays', 'new_year',
 'valentines_day', 'halloween', 'christmas', 'easter_egg_hunt',
 'spring_cleaning', 'summer_music_festival', 'national_holiday',
 'thanksgiving_feast', 'black_friday_sale', 'new_years_resolution', 'winter_market'
 ];

 // Check if this is an economic event
 const economicEventIds = [
 'economic_recession', 'economic_boom', 'market_crash', 'inflation_spike', 'job_market_shift'
 ];
 const isEconomicEvent = economicEventIds.includes(event.id);

 // Check if this is a personal crisis event
 // Note: investment_opportunity / job_offer are classified 'good' in
 // getEventType() below, so they don't belong here (avoids dead overlap).
 const personalCrisisEventIds = [
 'medical_emergency', 'identity_theft',
 'relationship_crisis', 'legal_issue'
 ];
 const isPersonalCrisisEvent = personalCrisisEventIds.includes(event.id);

 const isSeasonalEvent = seasonalEventIds.includes(event.id);
 const seasonData = isSeasonalEvent ? getCurrentSeason(gameState.weeksLived || 0): null;

 // Determine event type for notification design
 // Green (good): seasonal events, economic boom, good events
 // Yellow (warning): personal crisis that aren't too bad, warnings
 // Red (bad): recession, market crash, medical emergency, etc.
 const getEventType = (): 'good' | 'warning' | 'bad' => {
 // Good events (green)
 if (isSeasonalEvent) return 'good';
 if (event.id === 'economic_boom') return 'good';
 if (event.id === 'lottery_win' || event.id === 'found_wallet' || event.id === 'charity_event' ||
 event.id === 'job_bonus' || event.id === 'investment_opportunity' || event.id === 'job_offer') {
 return 'good';
 }

 // Bad events (red)
 if (event.id === 'economic_recession' || event.id === 'market_crash' || event.id === 'inflation_spike') {
 return 'bad';
 }
 if (event.id === 'medical_emergency' || event.id === 'identity_theft' || event.id === 'legal_issue' ||
 event.id === 'burglary' || event.id === 'police_raid' || event.id === 'court_trial') {
 return 'bad';
 }

 // Warning events (yellow) - everything else
 return 'warning';
 };

 const eventType = getEventType();

 const getSeasonalTheme = () => {
 if (!seasonData) return null;

 switch (seasonData.season) {
 case 'spring':
 return {
 icon: Leaf,
 gradient: ['#10B981', '#059669'],
 headerGradient: ['#10B981', '#059669'],
 };
 case 'summer':
 return {
 icon: Sun,
 gradient: ['#F59E0B', '#D97706'],
 headerGradient: ['#F59E0B', '#D97706'],
 };
 case 'fall':
 return {
 icon: Leaf, // Using Leaf for fall (LeafFall doesn't exist in lucide-react-native)
 gradient: ['#EF4444', '#DC2626'],
 headerGradient: ['#EF4444', '#DC2626'],
 };
 case 'winter':
 return {
 icon: Snowflake,
 gradient: ['#3B82F6', '#2563EB'],
 headerGradient: ['#3B82F6', '#2563EB'],
 };
 }
 };

 const seasonalTheme = getSeasonalTheme();
 const SeasonalIcon = seasonalTheme?.icon;

 // Liquid-glass palette per event type. The accent color carries the MEANING
 // (green=good, amber=heads-up, red=bad) and appears only on the border, icon
 // chip and a soft top glow — never as a side stripe (DEV.md Hard Rule 7). The
 // card body is the game's dark frosted glass so it reads as one family with
 // the rest of the UI.
 const getNotificationStyle = () => {
 switch (eventType) {
 case 'good':
 return {
 accent: '#34D399',
 accentDeep: '#059669',
 icon: isSeasonalEvent && SeasonalIcon ? SeasonalIcon : CheckCircle,
 title: isSeasonalEvent ? 'Seasonal Event': 'Good News',
 };
 case 'warning':
 return {
 accent: '#FBBF24',
 accentDeep: '#D97706',
 // Friendly rounded icon — these are gameplay life events, not errors,
 // so no alarming warning triangle.
 icon: AlertCircle,
 title: isPersonalCrisisEvent ? 'Personal Crisis': 'Heads Up',
 };
 case 'bad':
 return {
 accent: '#F87171',
 accentDeep: '#DC2626',
 icon: XCircle,
 // Parallels "Good News"; these are serious life events, not app errors.
 title: isEconomicEvent ? 'Economic Event': 'Bad News',
 };
 }
 };

 const notificationStyle = getNotificationStyle();
 const NotificationIcon = notificationStyle.icon;
 const accent = notificationStyle.accent;
 const accentDeep = notificationStyle.accentDeep;

 return (
 <Modal visible transparent animationType="fade" onRequestClose={handleEmergencyDismiss}>
 <View style={styles.overlay}>
 <BlurViewFallback
 intensity={34}
 tint="dark"
 style={[styles.card, { borderColor: `${accent}66`, shadowColor: accent }]}
 >
 {/* Soft accent glow bleeding down from the top edge — the "light through
 glass" cue. Low alpha over the dark frosted body so it reads as a glow,
 not a band. */}
 <View style={[styles.accentGlow, { backgroundColor: `${accentDeep}1A` }]} pointerEvents="none" />
 {/* Thin glass highlight along the top edge (structural, not an accent stripe). */}
 <View style={styles.topHighlight} pointerEvents="none" />

 {/* Emergency close button in corner */}
 <TouchableOpacity
 style={styles.closeButton}
 onPress={handleEmergencyDismiss}
 hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
 accessibilityRole="button"
 accessibilityLabel="Dismiss"
 >
 <X size={scale(18)} color="rgba(226, 232, 240, 0.75)" />
 </TouchableOpacity>

 <ScrollView
 style={styles.scrollView}
 contentContainerStyle={styles.scrollContent}
 showsVerticalScrollIndicator={false}
 bounces={true}
 >
 <View style={styles.header}>
 <View style={[styles.iconCircle, { borderColor: `${accent}55`, backgroundColor: `${accent}1F` }]}>
 <NotificationIcon size={scale(22)} color={accent} />
 </View>
 <Text style={styles.notificationTitle}>
 {notificationStyle.title}
 </Text>
 </View>

 <Text style={styles.notificationDescription}>
 {event.description || 'An event has occurred.'}
 </Text>

 {/* Show economic event effects */}
 {isEconomicEvent && (() => {
 const econState = getCurrentEconomicState(gameState);
 if (econState && event.id!== 'economic_event_end') {
 // Calculate percentage changes correctly (multiplier - 1, then * 100)
 const incomeChangePercent = ((econState.modifiers.incomeMultiplier - 1) * 100);
 const volatilityChangePercent = ((econState.modifiers.stockVolatility - 1) * 100);
 const jobChangePercent = ((econState.modifiers.jobAvailability - 1) * 100);

 // Format with proper sign and no decimal places
 const incomeChange = incomeChangePercent >= 0
 ? `+${incomeChangePercent.toFixed(0)}`
: incomeChangePercent.toFixed(0);
 const volatilityChange = volatilityChangePercent >= 0
 ? `+${volatilityChangePercent.toFixed(0)}`
: volatilityChangePercent.toFixed(0);
 const jobChange = jobChangePercent >= 0
 ? `+${jobChangePercent.toFixed(0)}`
: jobChangePercent.toFixed(0);

 // Calculate weeks remaining: duration - (current week - start week)
 // When event first appears, weeksLived equals stateStartWeek, so weeksRemaining = duration
 // Each subsequent week, weeksRemaining decreases by 1
 const weeksInState = gameState.weeksLived - econState.stateStartWeek;
 const weeksRemaining = Math.max(0, econState.stateDuration - weeksInState);

 return (
 <View style={styles.infoPanel}>
 <Text style={styles.infoPanelTitle}>
 Economic Effects (Active for {weeksRemaining} more week{weeksRemaining!== 1 ? 's': ''}):
 </Text>
 <View style={styles.economicStats}>
 <View style={styles.economicStat}>
 <DollarSign size={scale(15)} color={incomeChangePercent < 0 ? '#F87171': '#34D399'} />
 <Text style={styles.economicStatText}>
 Income: {incomeChange}%
 </Text>
 </View>
 <View style={styles.economicStat}>
 <TrendingUp size={scale(15)} color="#FBBF24" />
 <Text style={styles.economicStatText}>
 Stock Volatility: {volatilityChange}%
 </Text>
 </View>
 <View style={styles.economicStat}>
 <TrendingDown size={scale(15)} color={jobChangePercent < 0 ? '#F87171': '#34D399'} />
 <Text style={styles.economicStatText}>
 Job Availability: {jobChange}%
 </Text>
 </View>
 </View>
 </View>
 );
 }
 return null;
 })()}

 {pet && (
 <View style={styles.petInfo}>
 <Text style={styles.petText}>
 {pet.name} — Hunger {pet.hunger} • Happiness {pet.happiness}
 </Text>
 </View>
 )}

 {/* Show choice effects preview.
     HONESTY (2026-08-24 audit): this panel used to spoil every money and
     stat delta while HIDING the effects that actually carry weight —
     relationship swings, karma, and the four `special` effects (a choice
     that ends the player's career previewed as a bare stat change). The
     consequential effects now show; the money figure also runs through
     the same wealth-scaling resolver the charge does, so a `moneyPct`
     event previews what it will really move. */}
 <View style={styles.infoPanel}>
 <Text style={styles.choiceEffectsTitle}>
 Choice Effects
 </Text>
 {event.choices.map((choice) => {
 const effects = choice.effects || {};
 const moneyChange = resolveEventMoney(effects, safeNetWorth(gameState));
 const statChanges = effects.stats || {};
 const relationshipChange = effects.relationship || 0;
 const specialLabel = SPECIAL_EFFECT_LABELS[choice.special ?? ''];
 const hasEffects =
 moneyChange!== 0 ||
 Object.keys(statChanges).length > 0 ||
 relationshipChange!== 0 ||
 !!effects.karma ||
 !!specialLabel;

 if (!hasEffects) return null;

 return (
 <View key={choice.id} style={styles.choiceEffect}>
 <Text style={styles.choiceEffectLabel}>
 {choice.text}
 </Text>
 <View style={styles.choiceEffectDetails}>
 {moneyChange!== 0 && (
 <View style={[styles.effectBadge, moneyChange > 0 ? styles.positiveBadge: styles.negativeBadge]}>
 <Text style={styles.effectBadgeText}>
 {moneyChange > 0 ? '+': ''}{formatMoney(moneyChange)}
 </Text>
 </View>
 )}
 {Object.entries(statChanges).map(([stat, change]) => (
 <View key={stat} style={[styles.effectBadge, (change as number) > 0 ? styles.positiveBadge: styles.negativeBadge]}>
 <Text style={styles.effectBadgeText}>
 {stat.charAt(0).toUpperCase() + stat.slice(1)} {(change as number) > 0 ? '+': ''}{change}
 </Text>
 </View>
 ))}
 {relationshipChange!== 0 && (
 <View style={[styles.effectBadge, relationshipChange > 0 ? styles.positiveBadge: styles.negativeBadge]}>
 <Text style={styles.effectBadgeText}>
 {`Relationship ${relationshipChange > 0 ? '+': ''}${relationshipChange}`}
 </Text>
 </View>
 )}
 {!!effects.karma && effects.karma.amount!== 0 && (
 <View style={[styles.effectBadge, effects.karma.amount > 0 ? styles.positiveBadge: styles.negativeBadge]}>
 <Text style={styles.effectBadgeText}>
 {`Karma (${effects.karma.dimension}) ${effects.karma.amount > 0 ? '+': ''}${effects.karma.amount}`}
 </Text>
 </View>
 )}
 {!!specialLabel && (
 <View style={[styles.effectBadge, specialLabel.positive ? styles.positiveBadge: styles.negativeBadge]}>
 <Text style={styles.effectBadgeText}>
 {specialLabel.text}
 </Text>
 </View>
 )}
 </View>
 </View>
 );
 })}
 </View>

 <View style={styles.choicesContainer}>
 {event.choices.map((choice, index) => {
 const enhancedChoice = choice as EnhancedEventChoice;
 const isPrimary = index === 0;

 return (
 <TouchableOpacity
 key={choice.id || `choice-${index}`}
 style={styles.choiceButton}
 onPress={() => handleResolveEvent(event.id, choice.id)}
 activeOpacity={0.85}
 accessibilityRole="button"
 accessibilityLabel={choice.text || 'Continue'}
 >
 {isPrimary ? (
 <LinearGradient
 colors={['#10B981', '#059669']}
 start={{ x: 0, y: 0 }}
 end={{ x: 1, y: 1 }}
 style={styles.choiceButtonContent}
 >
 {renderChoiceInner(choice, enhancedChoice, true)}
 </LinearGradient>
 ): (
 <View style={[styles.choiceButtonContent, styles.secondaryChoiceContent]}>
 {renderChoiceInner(choice, enhancedChoice, false)}
 </View>
 )}
 </TouchableOpacity>
 );
 })}
 </View>
 </ScrollView>
 </BlurViewFallback>
 </View>
 </Modal>
 );
}

/**
 * Choice button inner content — icon + label, plus the optional tradeoff and
 * emotional-impact readouts. Split out so the primary (gradient) and secondary
 * (glass) buttons share identical inner markup.
 */
function renderChoiceInner(
 choice: { text?: string },
 enhancedChoice: EnhancedEventChoice,
 isPrimary: boolean,
) {
 return (
 <>
 <View style={styles.choiceContent}>
 {isPrimary ? (
 <CheckCircle size={scale(19)} color="#FFFFFF" />
 ): (
 <XCircle size={scale(19)} color="rgba(148, 163, 184, 0.9)" />
 )}
 <Text style={[
 styles.choiceText,
 isPrimary ? styles.primaryChoiceText: styles.secondaryChoiceText
 ]}>
 {choice.text || 'Continue'}
 </Text>
 </View>

 {/* Tradeoff Display - shows gains and losses */}
 {enhancedChoice.tradeoffs && (
 <View style={styles.tradeoffContainer}>
 {enhancedChoice.tradeoffs.gain.length > 0 && (
 <View style={styles.gainContainer}>
 <Text style={styles.tradeoffLabel}>You gain:</Text>
 {enhancedChoice.tradeoffs.gain.map((gain, i) => (
 <View key={i} style={styles.tradeoffItem}>
 <ArrowUp size={scale(13)} color="#34D399" />
 <Text style={styles.gainText}>{gain.label}</Text>
 </View>
 ))}
 </View>
 )}

 {enhancedChoice.tradeoffs.lose.length > 0 && (
 <View style={styles.loseContainer}>
 <Text style={styles.tradeoffLabel}>You lose:</Text>
 {enhancedChoice.tradeoffs.lose.map((loss, i) => (
 <View key={i} style={styles.tradeoffItem}>
 <ArrowDown size={scale(13)} color="#F87171" />
 <Text style={styles.loseText}>{loss.label}</Text>
 </View>
 ))}
 </View>
 )}
 </View>
 )}

 {/* Emotional Impact Indicator */}
 {enhancedChoice.emotionalImpact && (
 <View style={styles.emotionalIndicator}>
 <Text style={styles.emotionalText}>
 {enhancedChoice.emotionalImpact === 'high' ? 'High Impact':
 enhancedChoice.emotionalImpact === 'medium' ? 'Medium Impact':
 'Low Impact'}
 </Text>
 </View>
 )}
 </>
 );
}

const styles = StyleSheet.create({
 overlay: {
 flex: 1,
 backgroundColor: 'rgba(2, 6, 23, 0.7)',
 justifyContent: 'center',
 alignItems: 'center',
 padding: responsiveSpacing.md,
 },
 card: {
 width: '100%',
 maxWidth: scale(400),
 maxHeight: screenHeight * 0.82,
 borderRadius: responsiveBorderRadius['2xl'],
 borderWidth: 1,
 overflow: 'hidden',
 // Solid frosted-dark body: real backdrop blur is disabled app-wide for
 // TurboModule crash-safety, so translucency is faked with a near-opaque dark
 // surface (legible over the dimmed game screen, on-brand with the game's
 // other glass panels). The slight transparency keeps a hint of depth.
 backgroundColor: 'rgba(17, 24, 39, 0.94)',
 // Soft drop shadow via the glassmorphism design-system helper (accent
 // shadowColor is applied inline on the card so the glow matches the event).
...getPlatformShadows(16, 0.35, 12, 28),
 elevation: 16,
 },
 accentGlow: {
 position: 'absolute',
 top: 0,
 left: 0,
 right: 0,
 height: verticalScale(96),
 },
 topHighlight: {
 position: 'absolute',
 top: 0,
 left: scale(20),
 right: scale(20),
 height: StyleSheet.hairlineWidth,
 backgroundColor: 'rgba(255, 255, 255, 0.25)',
 },
 closeButton: {
 position: 'absolute',
 top: scale(12),
 right: scale(12),
 zIndex: 10,
 width: scale(30),
 height: scale(30),
 alignItems: 'center',
 justifyContent: 'center',
 borderRadius: scale(15),
 backgroundColor: 'rgba(148, 163, 184, 0.14)',
 borderWidth: StyleSheet.hairlineWidth,
 borderColor: 'rgba(255, 255, 255, 0.12)',
 },
 scrollView: {
 width: '100%',
 flexGrow: 0,
 flexShrink: 1,
 },
 scrollContent: {
 padding: responsiveSpacing.lg,
 paddingTop: verticalScale(20),
 },
 header: {
 flexDirection: 'row',
 alignItems: 'center',
 marginBottom: verticalScale(14),
 gap: scale(12),
 paddingRight: scale(28),
 },
 iconCircle: {
 width: scale(44),
 height: scale(44),
 borderRadius: scale(22),
 borderWidth: 1,
 alignItems: 'center',
 justifyContent: 'center',
 },
 notificationTitle: {
 fontSize: fontScale(20),
 fontWeight: '800',
 color: '#F8FAFC',
 flex: 1,
 letterSpacing: -0.3,
 },
 notificationDescription: {
 fontSize: fontScale(15),
 color: 'rgba(226, 232, 240, 0.92)',
 textAlign: 'left',
 lineHeight: fontScale(22),
 marginBottom: verticalScale(18),
 },
 // Shared frosted sub-panel (economic effects + choice-effects preview).
 infoPanel: {
 backgroundColor: 'rgba(15, 23, 42, 0.55)',
 borderRadius: responsiveBorderRadius.lg,
 padding: responsiveSpacing.md,
 marginBottom: verticalScale(16),
 borderWidth: StyleSheet.hairlineWidth,
 borderColor: 'rgba(148, 163, 184, 0.22)',
 },
 infoPanelTitle: {
 fontSize: fontScale(14),
 fontWeight: '700',
 color: '#F8FAFC',
 marginBottom: verticalScale(8),
 },
 economicStats: {
 gap: verticalScale(6),
 },
 economicStat: {
 flexDirection: 'row',
 alignItems: 'center',
 gap: scale(8),
 },
 economicStatText: {
 fontSize: fontScale(13),
 color: 'rgba(226, 232, 240, 0.85)',
 },
 petInfo: {
 backgroundColor: 'rgba(15, 23, 42, 0.55)',
 borderRadius: responsiveBorderRadius.lg,
 padding: responsiveSpacing.md,
 marginBottom: verticalScale(16),
 borderWidth: StyleSheet.hairlineWidth,
 borderColor: 'rgba(148, 163, 184, 0.22)',
 },
 petText: {
 textAlign: 'center',
 color: 'rgba(226, 232, 240, 0.9)',
 fontSize: fontScale(14),
 },
 choiceEffectsTitle: {
 fontSize: fontScale(13),
 fontWeight: '700',
 color: 'rgba(226, 232, 240, 0.75)',
 marginBottom: verticalScale(12),
 letterSpacing: 0.6,
 textTransform: 'uppercase',
 },
 choiceEffect: {
 marginBottom: verticalScale(12),
 },
 choiceEffectLabel: {
 fontSize: fontScale(13),
 fontWeight: '600',
 color: 'rgba(226, 232, 240, 0.9)',
 marginBottom: verticalScale(8),
 },
 choiceEffectDetails: {
 flexDirection: 'row',
 flexWrap: 'wrap',
 gap: scale(8),
 },
 effectBadge: {
 paddingHorizontal: scale(12),
 paddingVertical: verticalScale(6),
 borderRadius: responsiveBorderRadius.md,
 minWidth: scale(58),
 alignItems: 'center',
 justifyContent: 'center',
 borderWidth: 1,
 },
 positiveBadge: {
 backgroundColor: 'rgba(16, 185, 129, 0.18)',
 borderColor: 'rgba(52, 211, 153, 0.55)',
 },
 negativeBadge: {
 backgroundColor: 'rgba(239, 68, 68, 0.18)',
 borderColor: 'rgba(248, 113, 113, 0.55)',
 },
 effectBadgeText: {
 fontSize: fontScale(14),
 fontWeight: '700',
 color: '#FFFFFF',
 },
 choicesContainer: {
 gap: verticalScale(12),
 },
 choiceButton: {
 borderRadius: responsiveBorderRadius.lg,
 overflow: 'hidden',
...getPlatformShadows(6, 0.2, 3, 8),
 elevation: 3,
 },
 choiceButtonContent: {
 paddingVertical: verticalScale(15),
 paddingHorizontal: responsiveSpacing.md,
 gap: verticalScale(8),
 },
 secondaryChoiceContent: {
 backgroundColor: 'rgba(148, 163, 184, 0.12)',
 borderWidth: StyleSheet.hairlineWidth,
 borderColor: 'rgba(148, 163, 184, 0.25)',
 borderRadius: responsiveBorderRadius.lg,
 },
 choiceContent: {
 flexDirection: 'row',
 alignItems: 'center',
 justifyContent: 'center',
 gap: scale(8),
 },
 choiceText: {
 fontSize: fontScale(16),
 fontWeight: '700',
 textAlign: 'center',
 flexShrink: 1,
 },
 primaryChoiceText: {
 color: '#FFFFFF',
 },
 secondaryChoiceText: {
 color: 'rgba(226, 232, 240, 0.92)',
 },
 tradeoffContainer: {
 marginTop: verticalScale(8),
 paddingTop: verticalScale(10),
 borderTopWidth: StyleSheet.hairlineWidth,
 borderTopColor: 'rgba(255, 255, 255, 0.14)',
 gap: verticalScale(8),
 },
 gainContainer: {
 gap: verticalScale(4),
 marginBottom: verticalScale(4),
 },
 loseContainer: {
 gap: verticalScale(4),
 },
 tradeoffLabel: {
 fontSize: fontScale(12),
 fontWeight: '600',
 color: 'rgba(226, 232, 240, 0.85)',
 marginBottom: verticalScale(4),
 },
 tradeoffItem: {
 flexDirection: 'row',
 alignItems: 'center',
 gap: scale(6),
 marginLeft: scale(4),
 },
 gainText: {
 fontSize: fontScale(12),
 color: '#34D399',
 fontWeight: '600',
 },
 loseText: {
 fontSize: fontScale(12),
 color: '#F87171',
 fontWeight: '600',
 },
 emotionalIndicator: {
 marginTop: verticalScale(8),
 paddingTop: verticalScale(8),
 borderTopWidth: StyleSheet.hairlineWidth,
 borderTopColor: 'rgba(255, 255, 255, 0.14)',
 },
 emotionalText: {
 fontSize: fontScale(11),
 color: 'rgba(148, 163, 184, 0.9)',
 textAlign: 'center',
 fontStyle: 'italic',
 },
});
