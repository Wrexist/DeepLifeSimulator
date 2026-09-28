import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Phone, Coffee, DollarSign, Handshake, Heart } from 'lucide-react-native';
import type { Relationship } from '@/contexts/game/types';
import { isFamilyRelationship, relationshipBondCost } from '@/contexts/game/actions/ContactsActions';
import { getThemeColors, accent } from '@/lib/config/theme';
import { formatMoney } from '@/utils/moneyFormatting';
import { responsiveSpacing as sp, responsiveBorderRadius as br, responsiveFontSize as fs, scale } from '@/utils/scaling';

export const CONTACT_INTERACTIONS = {
  call: { cost: 0, bonus: 3 },
  hangout: { cost: 30, bonus: 5 },
} as const;
export type PersonalContactAction = 'call' | 'hangout' | 'askmoney' | 'lendmoney' | 'bond';

interface Props {
  relationship: Relationship;
  money: number;
  week: number;
  darkMode: boolean;
  onAction: (action: PersonalContactAction) => void;
}

/** Decision copy only; the existing actions recheck all gates against latest state. */
export default function PersonalContactActions({ relationship: r, money, week, darkMode, onAction }: Props) {
  const theme = getThemeColors(darkMode);
  const bondCost = relationshipBondCost(r.relationshipScore ?? 0);
  const actions = [
    { key: 'call' as const, label: 'Call', Icon: Phone, cost: CONTACT_INTERACTIONS.call.cost,
      detail: 'Free catch-up. Bond gain varies with mood and memories.' },
    { key: 'hangout' as const, label: 'Hang out', Icon: Coffee, cost: CONTACT_INTERACTIONS.hangout.cost,
      detail: `${formatMoney(CONTACT_INTERACTIONS.hangout.cost)} now. Bond gain varies with mood and memories.` },
    { key: 'askmoney' as const, label: 'Ask to borrow', Icon: DollarSign, cost: 0,
      detail: (r.moneyRequestAttempts ?? 0) >= 5
        ? 'Guaranteed after repeated refusals. Lose up to 3 bond; repay the loan in Favors.'
        : 'They may refuse. Lose up to 3 bond if accepted, 5 if refused. Repay accepted loans in Favors.' },
    { key: 'lendmoney' as const, label: `Lend ${formatMoney(100)}`, Icon: Handshake, cost: 100,
      detail: 'Pay now; up to +2 bond. Collect the money from Favors.' },
    ...(!isFamilyRelationship(r) ? [{ key: 'bond' as const, label: 'Build bond', Icon: Heart, cost: bondCost,
      detail: `${formatMoney(bondCost)} now. Gain decreases as your bond approaches 100.` }] : []),
  ];
  return (
    <View style={styles.group}>
      <Text style={[styles.note, { color: theme.textSecondary }]}>No energy cost. Each action is available once per contact per week.</Text>
      {actions.map(({ key, label, Icon, cost, detail }) => {
        const reason = r.actions?.[key] === week ? 'Used this week. Available next week.'
          : key === 'bond' && (r.relationshipScore ?? 0) >= 100 ? 'Bond is already at 100.'
          : cost > 0 && money < cost ? `Need ${formatMoney(cost)} cash.` : undefined;
        return (
          <TouchableOpacity key={key} accessibilityRole="button"
            accessibilityLabel={`${label} with ${r.name}`}
            accessibilityHint={reason ?? detail}
            accessibilityState={{ disabled: !!reason }} disabled={!!reason}
            onPress={() => { if (!reason) onAction(key); }} activeOpacity={0.75}
            style={[styles.row, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
            <Icon size={scale(18)} color={reason ? theme.textMuted : accent.info} />
            <View style={styles.copy}>
              <Text style={[styles.title, { color: reason ? theme.textSecondary : theme.text }]}>{label}</Text>
              <Text style={[styles.detail, { color: theme.textSecondary }]}>{detail}</Text>
              {reason && <Text style={[styles.detail, { color: accent.warning }]}>{reason}</Text>}
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: sp.xs },
  note: { fontSize: fs.xs },
  row: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: sp.sm, padding: sp.sm, borderWidth: 1, borderRadius: br.md },
  copy: { flex: 1, gap: sp.xs },
  title: { fontSize: fs.sm, fontWeight: '600' },
  detail: { fontSize: fs.xs },
});
