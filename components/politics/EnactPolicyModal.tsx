/**
 * EnactPolicyModal — pick + enact a policy from the available catalog.
 *
 * R7 Phase 3-C: replaces the "use the legacy career flow" stub note in the
 * PoliticalApp Policies tab. Now there's an in-app surface to enact policies
 * directly. The `enactPolicy` action in PoliticalActions already exists —
 * this modal just adds the UI that drives it.
 *
 * Filters:
 *   - `getAvailablePolicies(careerLevel)` for level gating.
 *   - Excludes already-enacted policies.
 *   - Disables the Enact button when the player can't afford the
 *     implementation cost (kept visible so the player knows what to save for).
 *
 * Each row shows: name, type tag, approval-impact arrow, cost, short
 * description. Tapping expands the row to show the full description + the
 * Enact button.
 */
import React, { useMemo, useState } from 'react';
import { hitSlopToMinTarget, minTouchTargetStyle } from '@/utils/touchTargets';
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { X, TrendingUp, TrendingDown, Minus } from 'lucide-react-native';
import {
  responsiveFontSize,
  responsiveSpacing,
  responsiveBorderRadius,
  scale,
} from '@/utils/scaling';
import { getThemeColors, accent } from '@/lib/config/theme';
import { getAvailablePolicies } from '@/lib/politics/policies';
import type { Policy } from '@/lib/politics/policies';

interface Props {
  visible: boolean;
  darkMode: boolean;
  careerLevel: number;
  enactedIds: string[];
  cash: number;
  onClose: () => void;
  onEnact: (policyId: string) => void;
}

function formatMoney(n: number): string {
  if (!isFinite(n)) return '$0';
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${n < 0 ? '-' : ''}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 10_000) return `${n < 0 ? '-' : ''}$${(abs / 1000).toFixed(1)}k`;
  return `$${Math.round(n).toLocaleString()}`;
}

export default function EnactPolicyModal({
  visible,
  darkMode,
  careerLevel,
  enactedIds,
  cash,
  onClose,
  onEnact,
}: Props) {
  const theme = getThemeColors(darkMode);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const available = useMemo<Policy[]>(() => {
    const enactedSet = new Set(enactedIds);
    return getAvailablePolicies(careerLevel).filter((p) => !enactedSet.has(p.id));
  }, [careerLevel, enactedIds]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <TouchableOpacity style={StyleSheet.absoluteFillObject} activeOpacity={1} onPress={onClose} />
        <View style={[styles.sheet, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={styles.headerRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.title, { color: theme.text }]}>Enact a policy</Text>
              <Text style={[styles.subtitle, { color: theme.textMuted }]}>
                Office level: {careerLevel} · Cash: {formatMoney(cash)}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={hitSlopToMinTarget(scale(20))} style={minTouchTargetStyle} accessibilityRole="button" accessibilityLabel="Close">
              <X size={scale(20)} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>

          {available.length === 0 ? (
            <Text style={[styles.empty, { color: theme.textMuted }]}>
              {careerLevel === 0
                ? 'You need to run for office before you can enact policies.'
                : 'No new policies available at your current office level.'}
            </Text>
          ) : (
            <ScrollView
              style={styles.list}
              contentContainerStyle={{ gap: responsiveSpacing.sm }}
              showsVerticalScrollIndicator={false}
            >
              {available.map((policy) => {
                const expanded = expandedId === policy.id;
                const affordable = cash >= policy.implementationCost;
                return (
                  <PolicyRow
                    key={policy.id}
                    policy={policy}
                    expanded={expanded}
                    affordable={affordable}
                    darkMode={darkMode}
                    onToggle={() => setExpandedId(expanded ? null : policy.id)}
                    onEnact={() => {
                      onEnact(policy.id);
                      setExpandedId(null);
                    }}
                  />
                );
              })}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

function PolicyRow({
  policy, expanded, affordable, darkMode, onToggle, onEnact,
}: {
  policy: Policy;
  expanded: boolean;
  affordable: boolean;
  darkMode: boolean;
  onToggle: () => void;
  onEnact: () => void;
}) {
  const theme = getThemeColors(darkMode);
  const approvalColor =
    policy.approvalImpact > 0
      ? accent.success
      : policy.approvalImpact < 0
      ? accent.danger
      : theme.textMuted;
  const ApprovalIcon =
    policy.approvalImpact > 0 ? TrendingUp : policy.approvalImpact < 0 ? TrendingDown : Minus;

  return (
    <View
      style={[
        styles.row,
        {
          backgroundColor: theme.surfaceElevated,
          borderColor: expanded ? accent.info : theme.border,
        },
      ]}
    >
      <TouchableOpacity onPress={onToggle} activeOpacity={0.7} style={styles.rowHeader}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.policyName, { color: theme.text }]} numberOfLines={1}>
            {policy.name}
          </Text>
          <View style={styles.metaRow}>
            <View style={[styles.tag, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <Text style={[styles.tagText, { color: theme.textSecondary }]}>{policy.type}</Text>
            </View>
            <View style={styles.approvalRow}>
              <ApprovalIcon size={scale(12)} color={approvalColor} />
              <Text style={[styles.approvalText, { color: approvalColor }]}>
                {policy.approvalImpact > 0 ? '+' : ''}
                {policy.approvalImpact}
              </Text>
            </View>
            <Text style={[styles.costText, { color: affordable ? theme.text : accent.danger }]}>
              {formatMoney(policy.implementationCost)}
            </Text>
          </View>
        </View>
      </TouchableOpacity>

      {expanded ? (
        <View style={styles.detail}>
          <Text style={[styles.desc, { color: theme.textSecondary }]}>{policy.description}</Text>

          {/* Effect summary — only show effects that are non-zero. */}
          <View style={styles.effectsBlock}>
            {policy.effects.money ? (
              // Paid ONCE at enactment (enactPolicy), not weekly — label honestly.
              <Effect label="One-time cash" value={`${policy.effects.money > 0 ? '+' : ''}${formatMoney(policy.effects.money)}`} theme={theme} />
            ) : null}
            {policy.effects.happiness ? (
              <Effect label="Happiness" value={`${policy.effects.happiness > 0 ? '+' : ''}${policy.effects.happiness}`} theme={theme} />
            ) : null}
            {policy.effects.health ? (
              <Effect label="Health" value={`${policy.effects.health > 0 ? '+' : ''}${policy.effects.health}`} theme={theme} />
            ) : null}
            {policy.effects.reputation ? (
              <Effect label="Reputation" value={`${policy.effects.reputation > 0 ? '+' : ''}${policy.effects.reputation}`} theme={theme} />
            ) : null}
          </View>

          <TouchableOpacity
            disabled={!affordable}
            onPress={onEnact}
            style={[
              styles.enactBtn,
              { backgroundColor: affordable ? accent.info : theme.border },
            ]}
          >
            <Text style={styles.enactText}>
              {affordable ? 'Enact policy' : `Need ${formatMoney(policy.implementationCost)}`}
            </Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );
}

function Effect({ label, value, theme }: { label: string; value: string; theme: any }) {
  return (
    <View style={styles.effectRow}>
      <Text style={[styles.effectLabel, { color: theme.textMuted }]}>{label}</Text>
      <Text style={[styles.effectValue, { color: theme.text }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: responsiveSpacing.lg,
  },
  sheet: {
    borderRadius: responsiveBorderRadius.xl,
    borderWidth: 1,
    padding: responsiveSpacing.lg,
    gap: responsiveSpacing.md,
    maxHeight: '80%',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: responsiveFontSize.lg,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: responsiveFontSize.sm,
    marginTop: 2,
  },
  empty: {
    fontSize: responsiveFontSize.sm,
    paddingVertical: responsiveSpacing.md,
    textAlign: 'center',
  },
  list: {
    maxHeight: '90%',
  },
  row: {
    borderRadius: responsiveBorderRadius.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  rowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: responsiveSpacing.md,
    gap: responsiveSpacing.sm,
  },
  policyName: {
    fontSize: responsiveFontSize.md,
    fontWeight: '600',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  tag: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  tagText: {
    fontSize: responsiveFontSize.xs,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  approvalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  approvalText: {
    fontSize: responsiveFontSize.xs,
    fontWeight: '700',
  },
  costText: {
    fontSize: responsiveFontSize.sm,
    fontWeight: '700',
    marginLeft: 'auto',
  },
  detail: {
    paddingHorizontal: responsiveSpacing.md,
    paddingBottom: responsiveSpacing.md,
    gap: responsiveSpacing.sm,
  },
  desc: {
    fontSize: responsiveFontSize.sm,
    lineHeight: responsiveFontSize.sm * 1.4,
  },
  effectsBlock: {
    gap: 4,
  },
  effectRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  effectLabel: {
    fontSize: responsiveFontSize.xs,
  },
  effectValue: {
    fontSize: responsiveFontSize.xs,
    fontWeight: '600',
  },
  enactBtn: {
    paddingVertical: responsiveSpacing.sm,
    borderRadius: responsiveBorderRadius.md,
    alignItems: 'center',
    marginTop: 4,
  },
  enactText: {
    color: 'white',
    fontSize: responsiveFontSize.md,
    fontWeight: '700',
  },
});
