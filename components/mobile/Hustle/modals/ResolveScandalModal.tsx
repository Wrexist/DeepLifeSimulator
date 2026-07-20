/**
 * ResolveScandalModal — 5 response cards for an active brand scandal.
 *
 * Apology / Recall / Lawsuit / Cover up / Restructure each have unique
 * cost+reputation+severity-drop profiles. Calls resolveScandal action.
 */
import React, { useCallback, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { X, AlertTriangle, MessagesSquare, Undo2, Scale, EyeOff, Building2 } from 'lucide-react-native';
import LinearGradientFallback from '@/components/fallbacks/LinearGradientFallback';
import { useGame } from '@/contexts/GameContext';
import { useTheme } from '@/hooks/useTheme';
import { scale, fontScale, responsiveSpacing, touchTargets } from '@/utils/scaling';
import { Z_INDEX } from '@/utils/zIndexConstants';
import { resolveScandal } from '@/contexts/game/actions/HustleActions';
import { HUSTLE_COLORS } from '../styles/hustleTheme';
import { hustleHaptics } from '../utils/hustleHaptics';
import type { HustleScandalResolution } from '@/contexts/game/types';

const LinearGradient = LinearGradientFallback;

type OptionMeta = {
  id: HustleScandalResolution;
  Icon: React.ComponentType<{ size: number; color: string }>;
  iconColor: string;
  title: string;
  cost: string;
  /** Numeric cost for affordability gating — must match resolveScandal's table. */
  costValue: number;
  effect: string;
};

const OPTIONS: OptionMeta[] = [
  { id: 'apology', Icon: MessagesSquare, iconColor: '#3B82F6', title: 'Public apology', cost: 'Free', costValue: 0, effect: '+2 rep · severity drops faster' },
  { id: 'recall', Icon: Undo2, iconColor: '#0EA5E9', title: 'Product recall', cost: '$50,000', costValue: 50_000, effect: '+4 rep · 40 severity drop' },
  { id: 'lawsuit', Icon: Scale, iconColor: '#F59E0B', title: 'Lawsuit', cost: '$100,000', costValue: 100_000, effect: '-3 rep · 50 severity drop' },
  { id: 'cover_up', Icon: EyeOff, iconColor: '#94A3B8', title: 'Cover up', cost: '$25,000', costValue: 25_000, effect: '-1 rep · 30% resurge risk' },
  { id: 'restructure', Icon: Building2, iconColor: '#10B981', title: 'Restructure', cost: '$200,000', costValue: 200_000, effect: '+8 rep · 70 severity drop' },
];

interface ResolveScandalModalProps {
  visible: boolean;
  companyId: string;
  onDismiss: () => void;
}

export default function ResolveScandalModal({ visible, companyId, onDismiss }: ResolveScandalModalProps) {
  const { gameState, setGameState, saveGame } = useGame();
  const { theme } = useTheme();
  const overlay = gameState.hustleApp?.companies?.[companyId];
  const scandal = overlay?.activeScandal;
  const cash = gameState.stats?.money ?? 0;
  // Failure feedback — every sibling Hustle modal surfaces a resultMsg on a
  // failed action; this one used to answer an unaffordable tap with only a buzz.
  const [resultMsg, setResultMsg] = useState<string | null>(null);

  const handleChoice = useCallback((method: HustleScandalResolution) => {
    const r = resolveScandal(setGameState, gameState, companyId, method);
    if (r.success) {
      hustleHaptics.success();
      saveGame?.();
      onDismiss();
    } else {
      hustleHaptics.error();
      setResultMsg(r.message);
    }
  }, [setGameState, gameState, companyId, onDismiss, saveGame]);

  if (!visible || !scandal) return null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onDismiss}>
      <View style={styles.backdrop}>
        <View style={[styles.sheet, { backgroundColor: theme.surface }]}>
          <View style={styles.header}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
              <AlertTriangle size={fontScale(20)} color={HUSTLE_COLORS.danger} />
              <Text style={[styles.title, { color: theme.text }]}>Crisis at the company</Text>
            </View>
            <Pressable onPress={onDismiss} accessibilityRole="button" accessibilityLabel="Close" hitSlop={8} style={styles.iconBtn}>
              <X size={fontScale(20)} color={theme.text} />
            </Pressable>
          </View>

          <Text style={[styles.headline, { color: theme.textSecondary }]}>{scandal.headline}</Text>

          <View style={[styles.severityRow, { backgroundColor: theme.surfaceElevated }]}>
            <Text style={[styles.severityLabel, { color: theme.textSecondary }]}>Severity</Text>
            <Text style={[styles.severityValue, { color: HUSTLE_COLORS.danger }]}>
              {scandal.severity}/100
            </Text>
          </View>

          <Text style={[styles.subhead, { color: theme.text }]}>Choose a response</Text>
          <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: scale(380) }}>
            {OPTIONS.map((opt) => {
              const Icon = opt.Icon;
              const unaffordable = opt.costValue > cash;
              return (
                <Pressable
                  key={opt.id}
                  onPress={() => handleChoice(opt.id)}
                  disabled={unaffordable}
                  accessibilityRole="button"
                  accessibilityLabel={opt.title}
                  accessibilityState={{ disabled: unaffordable }}
                  style={({ pressed }) => [
                    styles.optionCard,
                    { backgroundColor: theme.surfaceElevated, borderColor: theme.border, opacity: unaffordable ? 0.5 : pressed ? 0.85 : 1 },
                  ]}
                >
                  <Icon size={fontScale(20)} color={opt.iconColor} />
                  <View style={styles.optionText}>
                    <Text style={[styles.optionTitle, { color: theme.text }]}>{opt.title}</Text>
                    <Text style={[styles.optionEffect, { color: theme.textSecondary }]}>{opt.effect}</Text>
                  </View>
                  <Text style={[styles.optionCost, { color: unaffordable ? HUSTLE_COLORS.danger : theme.text }]}>{opt.cost}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
          {resultMsg ? (
            <Text style={[styles.resultMsg, { color: theme.textSecondary }]}>{resultMsg}</Text>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  resultMsg: {
    fontSize: fontScale(12),
    fontWeight: '600',
    textAlign: 'center',
    marginTop: responsiveSpacing.sm,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'flex-end',
    zIndex: Z_INDEX.MODAL,
  },
  sheet: {
    borderTopLeftRadius: scale(24),
    borderTopRightRadius: scale(24),
    padding: responsiveSpacing.lg,
    paddingBottom: responsiveSpacing.xl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: responsiveSpacing.sm,
  },
  title: {
    fontSize: fontScale(18),
    fontWeight: '800',
  },
  iconBtn: {
    width: touchTargets.minimum,
    height: touchTargets.minimum,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headline: {
    fontSize: fontScale(13),
    marginBottom: responsiveSpacing.md,
  },
  severityRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: responsiveSpacing.md,
    paddingVertical: responsiveSpacing.sm,
    borderRadius: scale(10),
    marginBottom: responsiveSpacing.md,
  },
  severityLabel: { fontSize: fontScale(12) },
  severityValue: {
    fontSize: fontScale(16),
    fontWeight: '800',
  },
  subhead: {
    fontSize: fontScale(15),
    fontWeight: '700',
    marginBottom: responsiveSpacing.sm,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: responsiveSpacing.sm,
    padding: responsiveSpacing.md,
    borderRadius: scale(12),
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: responsiveSpacing.sm,
  },
  optionEmoji: { fontSize: fontScale(22) },
  optionText: { flex: 1 },
  optionTitle: { fontSize: fontScale(13), fontWeight: '700' },
  optionEffect: { fontSize: fontScale(11), marginTop: 2 },
  optionCost: {
    fontSize: fontScale(13),
    fontWeight: '700',
  },
});
