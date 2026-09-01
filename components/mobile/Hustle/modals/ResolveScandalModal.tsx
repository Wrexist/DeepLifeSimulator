/**
 * ResolveScandalModal - 5 response cards for an active brand scandal.
 *
 * Apology / Recall / Lawsuit / Cover up / Restructure each have unique
 * cost+reputation+severity-drop profiles. Calls resolveScandal action.
 */
import React, { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MessagesSquare, Undo2, Scale, EyeOff, Building2 } from 'lucide-react-native';
import BaseModal from '@/components/ui/BaseModal';
import SectionTitle from '@/components/ui/SectionTitle';
import { useGame } from '@/contexts/GameContext';
import { useTheme } from '@/hooks/useTheme';
import { accent } from '@/lib/config/theme';
import { scale, fontScale, responsiveSpacing, touchTargets } from '@/utils/scaling';
import { resolveScandal } from '@/contexts/game/actions/HustleActions';
import { HUSTLE_COLORS } from '../styles/hustleTheme';
import { hustleHaptics } from '../utils/hustleHaptics';
import type { HustleScandalResolution } from '@/contexts/game/types';

type OptionMeta = {
  id: HustleScandalResolution;
  Icon: React.ComponentType<{ size: number; color: string }>;
  iconColor: string;
  title: string;
  cost: string;
  /** Numeric cost for affordability gating - must match resolveScandal's table. */
  costValue: number;
  effect: string;
};

const OPTIONS: OptionMeta[] = [
  { id: 'apology', Icon: MessagesSquare, iconColor: accent.info, title: 'Public apology', cost: 'Free', costValue: 0, effect: '+2 rep · severity drops faster' },
  { id: 'recall', Icon: Undo2, iconColor: accent.info, title: 'Product recall', cost: '$50,000', costValue: 50_000, effect: '+4 rep · 40 severity drop' },
  { id: 'lawsuit', Icon: Scale, iconColor: accent.warning, title: 'Lawsuit', cost: '$100,000', costValue: 100_000, effect: '-3 rep · 50 severity drop' },
  { id: 'cover_up', Icon: EyeOff, iconColor: accent.muted, title: 'Cover up', cost: '$25,000', costValue: 25_000, effect: '-1 rep · 30% resurge risk' },
  { id: 'restructure', Icon: Building2, iconColor: accent.success, title: 'Restructure', cost: '$200,000', costValue: 200_000, effect: '+8 rep · 70 severity drop' },
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
  // Failure feedback - every sibling Hustle modal surfaces a resultMsg on a
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
    <BaseModal
      visible={visible}
      onClose={onDismiss}
      variant="bottom"
      title="Crisis at the company"
      subtitle={scandal.headline}
    >
      <View>
          <View style={[styles.severityRow, { backgroundColor: theme.surfaceElevated }]}>
            <Text style={[styles.severityLabel, { color: theme.textSecondary }]}>Severity</Text>
            <Text style={[styles.severityValue, { color: HUSTLE_COLORS.danger }]}>
              {scandal.severity}/100
            </Text>
          </View>

          <SectionTitle title="Choose a response" />
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
          {resultMsg ? (
            <Text style={[styles.resultMsg, { color: theme.textSecondary }]}>{resultMsg}</Text>
          ) : null}
      </View>
    </BaseModal>
  );
}

const styles = StyleSheet.create({
  resultMsg: {
    fontSize: fontScale(12),
    fontWeight: '500',
    textAlign: 'center',
    marginTop: responsiveSpacing.sm,
  },
  severityRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: responsiveSpacing.md,
    paddingVertical: responsiveSpacing.sm,
    borderRadius: scale(10),
  },
  severityLabel: { fontSize: fontScale(12) },
  severityValue: {
    fontSize: fontScale(16),
    fontWeight: '600',
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: responsiveSpacing.sm,
    padding: responsiveSpacing.md,
    borderRadius: scale(12),
    borderWidth: StyleSheet.hairlineWidth,
    minHeight: touchTargets.minimum,
    marginBottom: responsiveSpacing.sm,
  },
  optionText: { flex: 1 },
  optionTitle: { fontSize: fontScale(13), fontWeight: '600' },
  optionEffect: { fontSize: fontScale(11), marginTop: 2 },
  optionCost: {
    fontSize: fontScale(13),
    fontWeight: '600',
  },
});
