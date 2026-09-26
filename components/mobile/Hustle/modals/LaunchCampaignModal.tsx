import { uiPalette , withAlpha } from '@/lib/config/theme';
/**
 * LaunchCampaignModal - pick campaign kind + spend + duration.
 *
 * Five campaign kinds with different ROI / brand-lift / cost-floor profiles.
 * Live ROI preview updates as the player edits spend.
 */
import React, { useCallback, useState, useEffect, useRef } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Megaphone, Radio, Smartphone, Sparkles, Zap } from 'lucide-react-native';
import BaseModal from '@/components/ui/BaseModal';
import SectionTitle from '@/components/ui/SectionTitle';
import { useGame } from '@/contexts/GameContext';
import { useTheme } from '@/hooks/useTheme';

import { scale, fontScale, responsiveSpacing, touchTargets } from '@/utils/scaling';
import { launchCampaign, cancelCampaign, CAMPAIGN_ENERGY_COST } from '@/contexts/game/actions/HustleActions';
import { campaignCostFloor, projectCampaignROI } from '@/lib/business/hustleLogic';
import { HUSTLE_COLORS } from '../styles/hustleTheme';
import { hustleHaptics } from '../utils/hustleHaptics';
import { parseAmount } from '@/utils/parseAmount';
import type { HustleCampaignKind } from '@/contexts/game/types';

const KINDS: { id: HustleCampaignKind; name: string; icon: any; blurb: string }[] = [
  { id: 'social', name: 'Social Media', icon: Smartphone, blurb: 'Highest ROI per dollar, fast feedback' },
  { id: 'influencer', name: 'Influencer', icon: Sparkles, blurb: 'Strongest brand lift, premium cost' },
  { id: 'tv', name: 'TV', icon: Megaphone, blurb: 'Mass reach, slow ROI, high floor' },
  { id: 'billboard', name: 'Billboard', icon: Radio, blurb: 'Steady local awareness, moderate cost' },
  { id: 'guerrilla', name: 'Guerrilla', icon: Zap, blurb: 'High variance, cheap, viral upside' },
];

interface LaunchCampaignModalProps {
  visible: boolean;
  companyId: string;
  onDismiss: () => void;
}

export default function LaunchCampaignModal({ visible, companyId, onDismiss }: LaunchCampaignModalProps) {
  const { gameState, setGameState, saveGame } = useGame();
  const { theme } = useTheme();
  const [selectedKind, setSelectedKind] = useState<HustleCampaignKind | null>(null);
  const [spend, setSpend] = useState('');
  const [duration, setDuration] = useState('4');
  const [resultMsg, setResultMsg] = useState<string | null>(null);

  const [pendingId, setPendingId] = useState<string | null>(null);
  const launchPending = useRef(false);

  useEffect(() => {
    if (!pendingId) return;
    const committed = gameState.hustleApp?.companies?.[companyId]?.activeCampaigns.some(c => c.id === pendingId);
    if (committed) {
      hustleHaptics.success();
      void saveGame?.();
      setResultMsg('Campaign launched');
      setSelectedKind(null);
      setSpend('');
    } else {
      hustleHaptics.error();
      setResultMsg('Campaign was not launched. Check your company, cash and energy, then try again. Nothing was charged.');
    }
    launchPending.current = false;
    setPendingId(null);
  }, [pendingId, gameState, companyId, saveGame]);

  const company = (gameState.companies ?? []).find((c: any) => c.id === companyId);
  const overlay = gameState.hustleApp?.companies?.[companyId];
  const active = overlay?.activeCampaigns ?? [];

  const spendNum = parseAmount(spend) ?? 0;
  const durationNum = (/^\d+$/.test(duration) ? Number(duration) : 0);
  const projectedROI = selectedKind
    ? projectCampaignROI(selectedKind, spendNum, company?.weeklyIncome ?? 0)
    : 0;
  const floor = selectedKind ? campaignCostFloor(selectedKind) : 0;
  // Energy gates alongside cash (2026-08-24) - the disabled button and the
  // action's own refusal must agree on both.
  const canLaunch =
    !pendingId && Number.isSafeInteger(durationNum) && durationNum >= 1 &&
    selectedKind != null &&
    spendNum >= floor &&
    (gameState.stats?.money ?? 0) >= spendNum &&
    (gameState.stats?.energy ?? 0) >= CAMPAIGN_ENERGY_COST;

  const handleSelect = useCallback((k: HustleCampaignKind) => {
    hustleHaptics.tap();
    setSelectedKind(k);
    setSpend(String(campaignCostFloor(k) * 2));
    setResultMsg(null);
  }, []);

  const handleLaunch = useCallback(() => {
    if (!selectedKind || launchPending.current) return;
    launchPending.current = true;
    const r = launchCampaign(setGameState, gameState, companyId, selectedKind, spendNum, durationNum);
    if (r.status === 'queued' && r.campaignId) {
      setResultMsg(null);
      setPendingId(r.campaignId);
    } else {
      launchPending.current = false;
      hustleHaptics.error();
      setResultMsg(r.message);
    }
  }, [selectedKind, spendNum, durationNum, setGameState, gameState, companyId]);

  const handleCancel = useCallback((id: string) => {
    cancelCampaign(setGameState, companyId, id);
    hustleHaptics.tap();
    saveGame?.();
  }, [setGameState, companyId, saveGame]);

  if (!visible) return null;

  return (
    <BaseModal visible={visible} onClose={onDismiss} variant="bottom" title="Marketing campaigns">
      <View>
            {/* Active campaigns */}
            {active.length > 0 ? (
              <>
                <SectionTitle title="Running" />
                {active.map((c: any) => (
                  <View key={c.id} style={[styles.activeRow, { borderColor: theme.border }]}>
                    <View style={styles.activeText}>
                      <Text style={[styles.activeName, { color: theme.text }]}>
                        {c.kind} · ${c.spendPerWeek}/wk
                      </Text>
                      <Text style={[styles.activeMeta, { color: theme.textSecondary }]}>
                        ROI {c.projectedROI}× · {c.durationWeeks}wk total
                      </Text>
                    </View>
                    <Pressable
                      onPress={() => handleCancel(c.id)}
                      accessibilityRole="button"
                      accessibilityLabel="Cancel campaign"
                      style={[styles.cancelBtn, { borderColor: HUSTLE_COLORS.danger }]}
                    >
                      <Text style={[styles.cancelBtnText, { color: HUSTLE_COLORS.danger }]}>Cancel</Text>
                    </Pressable>
                  </View>
                ))}
              </>
            ) : null}

            {/* Picker */}
            <SectionTitle title="Launch new" />
            {KINDS.map((k) => {
              const Icon = k.icon;
              const isSelected = selectedKind === k.id;
              return (
                <Pressable
                  key={k.id}
                  onPress={() => handleSelect(k.id)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: isSelected }}
                  style={[
                    styles.kindCard,
                    {
                      backgroundColor: isSelected ? theme.surfaceElevated : theme.surface,
                      borderColor: isSelected ? HUSTLE_COLORS.accent : theme.border,
                      borderWidth: isSelected ? 2 : StyleSheet.hairlineWidth,
                    },
                  ]}
                >
                  <View style={[styles.kindIcon, { backgroundColor: withAlpha(HUSTLE_COLORS.accent, 0.13) }]}>
                    <Icon size={fontScale(18)} color={HUSTLE_COLORS.accent} />
                  </View>
                  <View style={styles.kindText}>
                    <Text style={[styles.kindName, { color: theme.text }]}>{k.name}</Text>
                    <Text style={[styles.kindBlurb, { color: theme.textSecondary }]}>{k.blurb}</Text>
                  </View>
                </Pressable>
              );
            })}

            {/* Spend composer */}
            {selectedKind ? (
              <View style={[styles.composer, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
                <View style={styles.composerField}>
                  <Text style={[styles.composerLabel, { color: theme.textSecondary }]}>Spend / week</Text>
                  <TextInput
                    value={spend}
                    onChangeText={(t) => { setSpend(t); setResultMsg(null); }}
                    keyboardType="numeric"
                    accessibilityLabel="Campaign spend per week in dollars"
                    placeholder={`min $${floor.toLocaleString()}`}
                    placeholderTextColor={theme.textMuted}
                    style={[styles.composerInput, { color: theme.text, borderColor: theme.border }]}
                  />
                </View>
                <View style={styles.composerField}>
                  <Text style={[styles.composerLabel, { color: theme.textSecondary }]}>Duration (weeks)</Text>
                  <TextInput
                    value={duration}
                    onChangeText={(t) => { setDuration(t); setResultMsg(null); }}
                    keyboardType="numeric"
                    accessibilityLabel="Campaign duration in weeks"
                    placeholder="4"
                    placeholderTextColor={theme.textMuted}
                    style={[styles.composerInput, { color: theme.text, borderColor: theme.border }]}
                  />
                </View>
                <Text style={[styles.composerROI, { color: projectedROI > 1 ? HUSTLE_COLORS.success : HUSTLE_COLORS.warning }]}>
                  Projected ROI: {projectedROI > 0 ? `${projectedROI}×` : 'Below cost floor'} · {CAMPAIGN_ENERGY_COST} energy
                </Text>
                <Pressable
                  onPress={handleLaunch}
                  disabled={!canLaunch}
                  accessibilityRole="button"
                  accessibilityLabel="Launch campaign"
                  accessibilityState={{ disabled: !canLaunch, busy: !!pendingId }}
                  style={[
                    styles.cta,
                    { backgroundColor: canLaunch ? HUSTLE_COLORS.accent : theme.border, opacity: canLaunch ? 1 : 0.6 },
                  ]}
                >
                  <Text style={styles.ctaText}>
                    {canLaunch ? `Launch · $${spendNum.toLocaleString()}` : pendingId ? 'Launching...' : 'Check spend, duration and energy'}
                  </Text>
                </Pressable>
              </View>
            ) : null}
            {resultMsg ? <Text accessibilityRole="alert" style={[styles.resultMsg, { color: theme.text }]}>{resultMsg}</Text> : null}
      </View>
    </BaseModal>
  );
}

const styles = StyleSheet.create({
  activeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: responsiveSpacing.sm,
    padding: responsiveSpacing.md,
    borderRadius: scale(12),
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: responsiveSpacing.sm,
  },
  activeText: { flex: 1 },
  activeName: { fontSize: fontScale(13), fontWeight: '600' },
  activeMeta: { fontSize: fontScale(11), marginTop: 2 },
  cancelBtn: {
    paddingHorizontal: responsiveSpacing.md,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    minHeight: touchTargets.minimum,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    fontSize: fontScale(11),
    fontWeight: '600',
  },
  kindCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: responsiveSpacing.sm,
    padding: responsiveSpacing.md,
    borderRadius: scale(12),
    marginBottom: responsiveSpacing.sm,
  },
  kindIcon: {
    width: scale(36),
    height: scale(36),
    borderRadius: scale(8),
    alignItems: 'center',
    justifyContent: 'center',
  },
  kindText: { flex: 1 },
  kindName: { fontSize: fontScale(13), fontWeight: '600' },
  kindBlurb: { fontSize: fontScale(11), marginTop: 2 },
  composer: {
    borderRadius: scale(14),
    borderWidth: StyleSheet.hairlineWidth,
    padding: responsiveSpacing.md,
    marginTop: responsiveSpacing.md,
    gap: responsiveSpacing.sm,
  },
  composerField: { gap: 4 },
  composerLabel: { fontSize: fontScale(11), fontWeight: '500' },
  composerInput: {
    borderWidth: 1,
    borderRadius: scale(10),
    paddingHorizontal: responsiveSpacing.sm,
    paddingVertical: responsiveSpacing.sm,
    minHeight: touchTargets.minimum,
    fontSize: fontScale(14),
  },
  composerROI: {
    fontSize: fontScale(12),
    fontWeight: '600',
  },
  cta: {
    borderRadius: scale(12),
    overflow: 'hidden',
    marginTop: responsiveSpacing.sm,
    paddingVertical: responsiveSpacing.md,
    minHeight: touchTargets.minimum,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: {
    color: uiPalette.white,
    fontSize: fontScale(15),
    fontWeight: '600',
  },
  resultMsg: {
    fontSize: fontScale(12),
    textAlign: 'center',
    marginTop: responsiveSpacing.xs,
  },
});
