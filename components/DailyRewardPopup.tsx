import React, { useEffect, useRef } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import {
 Gift,
 DollarSign,
 Gem,
 Calendar,
 Zap,
} from 'lucide-react-native';
import { useGameState } from '@/contexts/game';
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

 const isMountedRef = useRef(true);
 const claimInProgressRef = useRef(false);

 useEffect(() => {
 isMountedRef.current = true;
 return () => { isMountedRef.current = false; };
 }, []);

 useEffect(() => {
 if (visible) claimInProgressRef.current = false;
 }, [visible]);

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
 Animated.parallel([
 Animated.timing(scaleAnim, { toValue: 0.96, duration: 160, useNativeDriver: true }),
 Animated.timing(fadeAnim, { toValue: 0, duration: 160, useNativeDriver: true }),
 ]).start(() => {
 if (isMountedRef.current) onClose();
 });
 };

 const palette = isDarkMode
 ? {
 backdrop: 'rgba(0, 0, 0, 0.65)',
 sheet: '#0F172A',
 border: 'rgba(255,255,255,0.06)',
 title: '#F9FAFB',
 subtitle: '#94A3B8',
 infoBg: 'rgba(255,255,255,0.04)',
 infoText: '#D1D5DB',
 }
: {
 backdrop: 'rgba(15, 23, 42, 0.55)',
 sheet: '#FFFFFF',
 border: 'rgba(15,23,42,0.06)',
 title: '#0F172A',
 subtitle: '#64748B',
 infoBg: '#F1F5F9',
 infoText: '#475569',
 };

 return (
 <Modal visible={visible} transparent animationType="none" onRequestClose={handleClaim}>
 <View style={[styles.overlay, { backgroundColor: palette.backdrop }]}>
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
 <Gift size={scale(28)} color="#FFFFFF" strokeWidth={2.4} />
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
 <Text style={[styles.rewardLabel, { color: palette.subtitle }]}>Gem</Text>
 <Text style={[styles.rewardAmount, { color: palette.title }]}>+1</Text>
 </View>

 {safeRewardAmount > 0 && (
 <View style={[styles.rewardRow, { borderColor: palette.border, backgroundColor: palette.infoBg }]}>
 <View style={[styles.rewardIcon, { backgroundColor: 'rgba(16, 185, 129, 0.15)' }]}>
 <DollarSign size={scale(20)} color="#10B981" strokeWidth={2.4} />
 </View>
 <Text style={[styles.rewardLabel, { color: palette.subtitle }]}>Money bonus</Text>
 <Text style={[styles.rewardAmount, { color: palette.title }]}>
 ${safeRewardAmount.toLocaleString()}
 </Text>
 </View>
 )}
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

 <TouchableOpacity
 style={styles.claimButton}
 onPress={handleClaim}
 activeOpacity={0.88}
 accessibilityRole="button"
 accessibilityLabel="Claim daily reward"
 >
 <Text style={styles.claimButtonText}>Claim Reward</Text>
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
 claimButton: {
 backgroundColor: '#8B5CF6',
 borderRadius: responsiveBorderRadius.lg,
 paddingVertical: responsiveSpacing.md,
 alignItems: 'center',
 },
 claimButtonText: {
 color: '#FFFFFF',
 fontSize: responsiveFontSize.base,
 fontWeight: '700',
 letterSpacing: 0.3,
 },
});
