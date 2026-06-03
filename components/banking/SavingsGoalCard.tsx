import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Target, Plus } from 'lucide-react-native';
import { SavingsGoal } from '@/contexts/game/types';
import { responsiveFontSize, responsiveSpacing, responsiveBorderRadius, scale } from '@/utils/scaling';
import { getThemeColors, accent } from '@/lib/config/theme';

interface Props {
 goal: SavingsGoal;
 darkMode: boolean;
 onContribute?: () => void;
}

function formatMoney(n: number): string {
 if (!isFinite(n)) return '$0';
 return `$${Math.round(n).toLocaleString()}`;
}

const CATEGORY_COLOR: Record<string, string> = {
 emergency: accent.danger,
 house: accent.info,
 vacation: '#06b6d4',
 retirement: '#a855f7',
 other: '#64748b',
};

export default function SavingsGoalCard({ goal, darkMode, onContribute }: Props) {
 const theme = getThemeColors(darkMode);
 const progress = goal.targetAmount > 0 ? goal.currentAmount / goal.targetAmount: 0;
 const pct = Math.max(0, Math.min(1, progress));
 const color = CATEGORY_COLOR[goal.category] ?? '#64748b';
 const complete = pct >= 1;

 return (
 <View style={[styles.card, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
 <View style={styles.headerRow}>
 <View style={[styles.iconBubble, { backgroundColor: color }]}>
 <Target size={scale(16)} color="white"/>
 </View>
 <View style={{ flex: 1 }}>
 <Text style={[styles.name, { color: theme.text }]} numberOfLines={1}>
 {goal.name}
 </Text>
 <Text style={[styles.sub, { color: theme.textMuted }]}>
 {formatMoney(goal.currentAmount)} of {formatMoney(goal.targetAmount)}
 </Text>
 </View>
 {onContribute &&!complete && (
 <TouchableOpacity onPress={onContribute} style={[styles.addBtn, { backgroundColor: color }]}>
 <Plus size={scale(14)} color="white" />
 </TouchableOpacity>
 )}
 </View>
 <View style={[styles.track, { backgroundColor: theme.border }]}>
 <View style={[styles.fill, { width:`${pct * 100}%`, backgroundColor: color }]} />
 </View>
 <Text style={[styles.pctText, { color: complete ? color: theme.textMuted }]}>
 {complete ? 'Goal reached!': `${Math.round(pct * 100)}% complete`}
 </Text>
 </View>
 );
}

const styles = StyleSheet.create({
 card: {
 padding: responsiveSpacing.md,
 borderRadius: responsiveBorderRadius.lg,
 borderWidth: 1,
 gap: responsiveSpacing.sm,
 },
 headerRow: {
 flexDirection: 'row',
 alignItems: 'center',
 gap: responsiveSpacing.sm,
 },
 iconBubble: {
 width: scale(32),
 height: scale(32),
 borderRadius: scale(16),
 alignItems: 'center',
 justifyContent: 'center',
 },
 name: {
 fontSize: responsiveFontSize.md,
 fontWeight: '700',
 },
 sub: {
 fontSize: responsiveFontSize.sm,
 marginTop: 2,
 },
 addBtn: {
 width: scale(28),
 height: scale(28),
 borderRadius: scale(14),
 alignItems: 'center',
 justifyContent: 'center',
 },
 track: {
 height: scale(6),
 borderRadius: responsiveBorderRadius.full,
 overflow: 'hidden',
 },
 fill: {
 height: '100%',
 borderRadius: responsiveBorderRadius.full,
 },
 pctText: {
 fontSize: responsiveFontSize.xs,
 fontWeight: '600',
 },
});
