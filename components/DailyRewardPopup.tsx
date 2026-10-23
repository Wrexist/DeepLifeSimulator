import { uiPalette } from '@/lib/config/theme';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import {
 Gift,
 Gem,
 Calendar,
 Zap,
 Play,
} from 'lucide-react-native';
import { useGameState } from '@/contexts/game';
import { useSetGameState, useGameStateGetter } from '@/contexts/game/useGameSelector';
import { useGameActions } from '@/contexts/game/GameActionsContext';
import { adsAvailable, areAdsRemoved, isGranted, runRewardedAd } from '@/lib/ads/rewardedAd';
import { applyDailyAdBonus, dailyAdBonusFor } from '@/lib/ads/dailyAdBonus';
import { AD_FREE_PERK_LABEL, dailyBonusOfferMode } from '@/lib/ads/orbGates';
import { safeSettings } from "@/utils/safeGameState";
import { scale, responsivePadding, responsiveBorderRadius, responsiveFontSize, responsiveSpacing } from '@/utils/scaling';
// Static import (2026-08-16 audit L2). This was a `require()` INSIDE the render
// body - re-resolved on every render, and typed `any`, so `DAILY_LOGIN_REWARDS`
// could have been renamed away and the `|| 50` fallback would have hidden it.
// `gameConstants` is a pure data module already imported statically all over the
// app, so there is nothing to defer.
import { DAILY_LOGIN_REWARDS } from '@/lib/config/gameConstants';

interface DailyRewardPopupProps {
 visible: boolean;
 /**
 * The GEMS credited by the grant in `home.tsx` - the one number this popup
 * exists to report. It used to render a hard-coded "Gem +1" and then this
 * amount under a "Money bonus" label with a dollar sign, so the first thing a
 * new player was told about their first reward was wrong twice over (the
 * grant is 25 gems and $0; the HUD floater beside it said "+25 Gems").
 * Program 6, consequence clarity: the popup reports exactly what was granted.
 */
 rewardAmount: number;
 onClose: () => void;
}

export default function DailyRewardPopup({ visible, rewardAmount, onClose }: DailyRewardPopupProps) {
 const { gameState } = useGameState();
 const settings = safeSettings(gameState); // R3-D
 const isDarkMode = settings?.darkMode || false;
 const loginStreak = gameState?.loginStreak || 1;
 const safeRewardAmount = typeof rewardAmount === 'number' && isFinite(rewardAmount) && rewardAmount >= 0 ? rewardAmount: 0;
 const nextDayReward = DAILY_LOGIN_REWARDS[loginStreak % DAILY_LOGIN_REWARDS.length] || 50;
 const setGameState = useSetGameState();
 const { saveGame } = useGameActions();
 const getGameState = useGameStateGetter();
 // Optional doubler (lib/ads/dailyAdBonus.ts). Offered when a real ad can be
 // shown, and - MON-5 - to a player who paid to remove ads as a direct grant
 // labelled as an ad-free perk, at the same 50-gem cap. Never in a build with
 // no ad SDK and no entitlement, where it would be free gems.
 const adBonus = dailyAdBonusFor(safeRewardAmount);
 const bonusMode = adBonus > 0 ? dailyBonusOfferMode(areAdsRemoved(gameState)) : null;
 // The Modal is hidden (not unmounted - home keeps the interruption slot) while
 // a fullscreen ad is up: an ad presented over an open RN Modal strands an
 // invisible touch-swallowing window on iOS (lib/ads/rewardedAd.ts).
 const [hiddenForAd, setHiddenForAd] = useState(false);
 const [adNote, setAdNote] = useState<string | null>(null);
 const dismissResolver = useRef<(() => void) | null>(null);

 const isMountedRef = useRef(true);
 const claimInProgressRef = useRef(false);

 useEffect(() => {
 isMountedRef.current = true;
 return () => { isMountedRef.current = false; };
 }, []);

 useEffect(() => {
 if (visible) claimInProgressRef.current = false;
 }, [visible]);

 // Resolves once the Modal has finished its native dismissal (iOS fires
 // onDismiss; Android does not), with a fallback so the flow never strands.
 const waitForDismissal = useCallback(() => new Promise<void>((resolve) => {
 let settled = false;
 const finish = () => {
 if (settled) return;
 settled = true;
 dismissResolver.current = null;
 resolve();
 };
 dismissResolver.current = finish;
 setTimeout(finish, 600);
 }), []);

 const handleWatchAd = async () => {
 if (claimInProgressRef.current) return;
 claimInProgressRef.current = true;
 setAdNote(null);
 const adsRemovedNow = areAdsRemoved(getGameState());
 // A real fullscreen ad must not present over the open Modal. The ad-free
 // perk shows no ad, so it grants in place (the same updater closes the popup).
 if (adsAvailable(adsRemovedNow)) {
 setHiddenForAd(true);
 await waitForDismissal();
 }
 const outcome = await runRewardedAd(() => {
 setGameState(applyDailyAdBonus);
 // A watched ad's reward must survive a force-quit inside the autosave window.
 void saveGame?.(false);
 }, {
 adsRemoved: adsRemovedNow,
 placement: 'daily_bonus',
 });
 if (!isMountedRef.current) return;
 // Granted: the same updater closed the popup, so home unmounts it.
 if (isGranted(outcome)) return;
 // No ad to show. The day's gems were credited before this popup opened, so
 // nothing is lost - bring the popup back with the plain Claim.
 claimInProgressRef.current = false;
 setAdNote(outcome === 'dismissed'
 ? 'The ad closed before the bonus was earned. Your daily gems are already in your wallet.'
 : 'No ad is available right now. Your daily gems are already in your wallet.');
 setHiddenForAd(false);
 };

 const scaleAnim = useRef(new Animated.Value(0.96)).current;
 const fadeAnim = useRef(new Animated.Value(0)).current;

 useEffect(() => {
 if (visible) {
 scaleAnim.setValue(0.96);
 fadeAnim.setValue(0);
 Animated.parallel([
 Animated.spring(scaleAnim, { toValue: 1, tension: 60, friction: 9, useNativeDriver: true }),
 Animated.timing(fadeAnim, { toValue: 1, duration: 220, useNativeDriver: true }),
 ]).start();
 }
 }, [visible, scaleAnim, fadeAnim]);

 const handleClaim = () => {
 if (claimInProgressRef.current) return;
 claimInProgressRef.current = true;
 // Exactly once, whichever arrives first: the animation's end callback or
 // the fallback timer. The latch above swallows every later tap and the
 // Android back gesture, so a dropped native-driver callback would otherwise
 // leave this full-screen Modal with no way out.
 let closed = false;
 const finish = () => {
 if (closed) return;
 closed = true;
 if (isMountedRef.current) onClose();
 };
 setTimeout(finish, 400);
 Animated.parallel([
 Animated.timing(scaleAnim, { toValue: 0.96, duration: 160, useNativeDriver: true }),
 Animated.timing(fadeAnim, { toValue: 0, duration: 160, useNativeDriver: true }),
 ]).start(finish);
 };

 const palette = isDarkMode
 ? {
 backdrop: 'rgba(0, 0, 0, 0.65)',
 sheet: uiPalette.navy,
 border: 'rgba(255,255,255,0.06)',
 title: uiPalette.paper,
 subtitle: uiPalette.muted,
 infoBg: 'rgba(255,255,255,0.04)',
 infoText: uiPalette.secondary,
 }
: {
 backdrop: 'rgba(15, 23, 42, 0.55)',
 sheet: uiPalette.white,
 border: 'rgba(15,23,42,0.06)',
 title: uiPalette.navy,
 subtitle: uiPalette.lightMuted,
 infoBg: uiPalette.lightSurface,
 infoText: uiPalette.lightSecondary,
 };

 return (
 <Modal
 visible={visible && !hiddenForAd}
 transparent
 animationType="none"
 onRequestClose={handleClaim}
 onDismiss={() => dismissResolver.current?.()}
 >
 <View style={[styles.overlay, { backgroundColor: palette.backdrop }]}>
 {/* Tapping outside closes it, like Android back. The gems are already
 credited, so nothing rides on the button; a modal that silently ate the
 player's 'Next week' taps behind it read as a frozen game (VIS-26). */}
 <TouchableOpacity
 style={StyleSheet.absoluteFill}
 activeOpacity={1}
 onPress={handleClaim}
 accessibilityLabel="Close daily reward"
 accessibilityRole="button"
 />
 <Animated.View
 style={[
 styles.sheet,
 {
 backgroundColor: palette.sheet,
 borderColor: palette.border,
 opacity: fadeAnim,
 transform: [{ scale: scaleAnim }],
 },
 ]}
 >
 <View style={styles.iconWrap}>
 <View style={styles.iconCircle}>
 <Gift size={scale(28)} color={uiPalette.white} strokeWidth={2.4} />
 </View>
 </View>

 <Text style={[styles.title, { color: palette.title }]}>Daily Reward</Text>
 <Text style={[styles.subtitle, { color: palette.subtitle }]}>
 Day {loginStreak} streak - keep it going!
 </Text>

 <View style={styles.rewards}>
 <View style={[styles.rewardRow, { borderColor: palette.border, backgroundColor: palette.infoBg }]}>
 <View style={[styles.rewardIcon, { backgroundColor: 'rgba(139, 92, 246, 0.15)' }]}>
 <Gem size={scale(20)} color="#8B5CF6" strokeWidth={2.4} />
 </View>
 <Text style={[styles.rewardLabel, { color: palette.subtitle }]}>Gems added</Text>
 <Text style={[styles.rewardAmount, { color: palette.title }]}>+{safeRewardAmount.toLocaleString('en-US')}</Text>
 </View>
 </View>

 <View style={[styles.infoBlock, { backgroundColor: palette.infoBg, borderColor: palette.border }]}>
 <View style={styles.infoRow}>
 <Calendar size={scale(14)} color={palette.subtitle} />
 <Text style={[styles.infoText, { color: palette.infoText }]}>
 Tomorrow: +{nextDayReward} gems (Day {loginStreak + 1})
 </Text>
 </View>
 <View style={styles.infoRow}>
 <Zap size={scale(14)} color={palette.subtitle} />
 <Text style={[styles.infoText, { color: palette.infoText }]}>
 {loginStreak >= 7 ? 'Max streak reached!': `${7 - loginStreak} days to max streak bonus`}
 </Text>
 </View>
 </View>

 {bonusMode && (
 <TouchableOpacity
 style={styles.adButton}
 onPress={() => { void handleWatchAd(); }}
 activeOpacity={0.88}
 accessibilityRole="button"
 accessibilityLabel={bonusMode === 'perk'
 ? `${AD_FREE_PERK_LABEL}: claim ${adBonus} more gems`
 : `Watch an ad for ${adBonus} more gems`}
 >
 {bonusMode === 'perk'
 ? <Gift size={scale(16)} color="#8B5CF6" strokeWidth={2.6} />
 : <Play size={scale(16)} color="#8B5CF6" strokeWidth={2.6} />}
 <Text style={styles.adButtonText}>
 {bonusMode === 'perk'
 ? `${AD_FREE_PERK_LABEL}: +${adBonus.toLocaleString('en-US')} more gems`
 : `Watch ad: +${adBonus.toLocaleString('en-US')} more gems`}
 </Text>
 </TouchableOpacity>
 )}
 {adNote && (
 <Text style={[styles.adNote, { color: palette.subtitle }]}>{adNote}</Text>
 )}

 <TouchableOpacity
 style={styles.claimButton}
 onPress={handleClaim}
 activeOpacity={0.88}
 accessibilityRole="button"
 // The day's gems are credited when the popup opens, so the button
 // closes rather than claims - 'Claim Reward' promised a grant that had
 // already happened (VIS-26).
 accessibilityLabel="Close daily reward. Your gems are already in your wallet"
 >
 <Text style={styles.claimButtonText}>Nice!</Text>
 </TouchableOpacity>
 </Animated.View>
 </View>
 </Modal>
 );
}

const styles = StyleSheet.create({
 overlay: {
 flex: 1,
 justifyContent: 'center',
 alignItems: 'center',
 padding: responsivePadding.horizontal,
 },
 sheet: {
 width: '100%',
 maxWidth: scale(360),
 borderRadius: responsiveBorderRadius.xl,
 borderWidth: 1,
 paddingHorizontal: responsiveSpacing.lg,
 paddingTop: responsiveSpacing.lg,
 paddingBottom: responsiveSpacing.md,
 alignItems: 'stretch',
 },
 iconWrap: {
 alignItems: 'center',
 marginBottom: responsiveSpacing.sm,
 },
 iconCircle: {
 width: scale(56),
 height: scale(56),
 borderRadius: scale(28),
 backgroundColor: '#8B5CF6',
 alignItems: 'center',
 justifyContent: 'center',
 },
 title: {
 fontSize: responsiveFontSize.xl,
 fontWeight: '700',
 textAlign: 'center',
 },
 subtitle: {
 fontSize: responsiveFontSize.sm,
 textAlign: 'center',
 marginTop: scale(2),
 marginBottom: responsiveSpacing.md,
 },
 rewards: {
 gap: responsiveSpacing.xs,
 marginBottom: responsiveSpacing.md,
 },
 rewardRow: {
 flexDirection: 'row',
 alignItems: 'center',
 paddingHorizontal: responsiveSpacing.md,
 paddingVertical: responsiveSpacing.sm,
 borderRadius: responsiveBorderRadius.lg,
 borderWidth: 1,
 gap: responsiveSpacing.sm,
 },
 rewardIcon: {
 width: scale(34),
 height: scale(34),
 borderRadius: scale(17),
 alignItems: 'center',
 justifyContent: 'center',
 },
 rewardLabel: {
 flex: 1,
 fontSize: responsiveFontSize.sm,
 fontWeight: '500',
 },
 rewardAmount: {
 fontSize: responsiveFontSize.lg,
 fontWeight: '800',
 letterSpacing: 0.2,
 },
 infoBlock: {
 borderRadius: responsiveBorderRadius.lg,
 borderWidth: 1,
 paddingHorizontal: responsiveSpacing.md,
 paddingVertical: responsiveSpacing.sm,
 gap: scale(6),
 marginBottom: responsiveSpacing.md,
 },
 infoRow: {
 flexDirection: 'row',
 alignItems: 'center',
 gap: responsiveSpacing.xs,
 },
 infoText: {
 flex: 1,
 fontSize: responsiveFontSize.xs,
 fontWeight: '500',
 },
 adButton: {
 flexDirection: 'row',
 alignItems: 'center',
 justifyContent: 'center',
 gap: responsiveSpacing.xs,
 borderWidth: 1,
 borderColor: '#8B5CF6',
 borderRadius: responsiveBorderRadius.lg,
 paddingVertical: responsiveSpacing.md,
 marginBottom: responsiveSpacing.sm,
 minHeight: scale(44),
 },
 adButtonText: {
 color: '#8B5CF6',
 fontSize: responsiveFontSize.base,
 fontWeight: '600',
 },
 adNote: {
 fontSize: responsiveFontSize.xs,
 textAlign: 'center',
 marginBottom: responsiveSpacing.sm,
 },
 claimButton: {
 backgroundColor: '#8B5CF6',
 borderRadius: responsiveBorderRadius.lg,
 paddingVertical: responsiveSpacing.md,
 alignItems: 'center',
 },
 claimButtonText: {
 color: uiPalette.white,
 fontSize: responsiveFontSize.base,
 fontWeight: '700',
 letterSpacing: 0.3,
 },
});
