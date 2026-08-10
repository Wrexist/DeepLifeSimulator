/**
 * LaunchCampaignModal — pick campaign kind + spend + duration.
 *
 * Five campaign kinds with different ROI / brand-lift / cost-floor profiles.
 * Live ROI preview updates as the player edits spend.
 */
import React, { useCallback, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Megaphone, Radio, Smartphone, Sparkles, X, Zap } from 'lucide-react-native';
import Gradient from '@/components/ui/Gradient';
import { useGame } from '@/contexts/GameContext';
import { useTheme } from '@/hooks/useTheme';
import { scale, fontScale, responsiveSpacing, touchTargets } from '@/utils/scaling';
import { Z_INDEX } from '@/utils/zIndexConstants';
import { launchCampaign, cancelCampaign } from '@/contexts/game/actions/HustleActions';
import { campaignCostFloor, projectCampaignROI } from '@/lib/business/hustleLogic';
import { HUSTLE_GRADIENT, HUSTLE_COLORS } from '../styles/hustleTheme';
import { hustleHaptics } from '../utils/hustleHaptics';
import type { HustleCampaignKind } from '@/contexts/game/types';

const LinearGradient = Gradient;

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

  const company = (gameState.companies ?? []).find((c: any) => c.id === companyId);
  const overlay = gameState.hustleApp?.companies?.[companyId];
  const active = overlay?.activeCampaigns ?? [];

  const spendNum = parseInt(spend || '0', 10);
  const durationNum = Math.max(1, parseInt(duration || '4', 10));
  const projectedROI = selectedKind
    ? projectCampaignROI(selectedKind, spendNum, company?.weeklyIncome ?? 0)
    : 0;
  const floor = selectedKind ? campaignCostFloor(selectedKind) : 0;
  const canLaunch = selectedKind != null && spendNum >= floor && (gameState.stats?.money ?? 0) >= spendNum;

  const handleSelect = useCallback((k: HustleCampaignKind) => {
    hustleHaptics.tap();
    setSelectedKind(k);
    setSpend(String(campaignCostFloor(k) * 2));
    setResultMsg(null);
  }, []);

  const handleLaunch = useCallback(() => {
    if (!selectedKind) return;
    const r = launchCampaign(setGameState, gameState, companyId, selectedKind, spendNum, durationNum);
    if (r.success) {
      hustleHaptics.success();
      saveGame?.();
      setResultMsg(r.message);
      setSelectedKind(null);
      setSpend('');
    } else {
      hustleHaptics.error();
      setResultMsg(r.message);
    }
  }, [selectedKind, spendNum, durationNum, setGameState, gameState, companyId, saveGame]);

  const handleCancel = useCallback((id: string) => {
    cancelCampaign(setGameState, companyId, id);
    hustleHaptics.tap();
    saveGame?.();
  }, [setGameState, companyId, saveGame]);

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onDismiss}>
      <View style={styles.backdrop}>
        <View style={[styles.sheet, { backgroundColor: theme.surface }]}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: theme.text }]}>Marketing campaigns</Text>
            <Pressable onPress={onDismiss} accessibilityRole="button" accessibilityLabel="Close" hitSlop={8} style={styles.iconBtn}>
              <X size={fontScale(20)} color={theme.text} />
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} style={{ flexShrink: 1 }}>
            {/* Active campaigns */}
            {active.length > 0 ? (
              <>
                <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>Running</Text>
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
            <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>Launch new</Text>
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
                      borderColor: isSelected ? HUSTLE_GRADIENT[0] : theme.border,
                      borderWidth: isSelected ? 2 : StyleSheet.hairlineWidth,
                    },
                  ]}
                >
                  <View style={[styles.kindIcon, { backgroundColor: HUSTLE_COLORS.accent + '22' }]}>
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
                    placeholder="4"
                    placeholderTextColor={theme.textMuted}
                    style={[styles.composerInput, { color: theme.text, borderColor: theme.border }]}
                  />
                </View>
                <Text style={[styles.composerROI, { color: projectedROI > 1 ? HUSTLE_COLORS.success : HUSTLE_COLORS.warning }]}>
                  Projected ROI: {projectedROI > 0 ? `${projectedROI}×` : 'Below cost floor'}
                </Text>
                <Pressable
                  onPress={handleLaunch}
                  disabled={!canLaunch}
                  accessibilityRole="button"
                  accessibilityLabel="Launch campaign"
                  style={[styles.cta, !canLaunch && styles.ctaDisabled]}
                >
                  <LinearGradient
                    colors={
                      canLaunch
                        ? (HUSTLE_GRADIENT as unknown as string[])
                        : [theme.border, theme.border]
                    }
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.ctaFill}
                  >
                    <Text style={styles.ctaText}>
                      {canLaunch ? `Launch · $${spendNum.toLocaleString()}` : 'Need more cash'}
                    </Text>
                  </LinearGradient>
                </Pressable>
                {resultMsg ? <Text style={[styles.resultMsg, { color: theme.text }]}>{resultMsg}</Text> : null}
              </View>
            ) : null}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
    zIndex: Z_INDEX.MODAL,
  },
  sheet: {
    borderTopLeftRadius: scale(24),
    borderTopRightRadius: scale(24),
    padding: responsiveSpacing.lg,
    paddingBottom: responsiveSpacing.xl,
    maxHeight: '92%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: responsiveSpacing.md,
  },
  title: {
    fontSize: fontScale(20),
    fontWeight: '800',
  },
  iconBtn: {
    width: touchTargets.minimum,
    height: touchTargets.minimum,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionLabel: {
    fontSize: fontScale(11),
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginTop: responsiveSpacing.md,
    marginBottom: responsiveSpacing.sm,
  },
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
  activeName: { fontSize: fontScale(13), fontWeight: '700' },
  activeMeta: { fontSize: fontScale(11), marginTop: 2 },
  cancelBtn: {
    paddingHorizontal: responsiveSpacing.md,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1.5,
  },
  cancelBtnText: {
    fontSize: fontScale(11),
    fontWeight: '700',
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
  kindName: { fontSize: fontScale(13), fontWeight: '700' },
  kindBlurb: { fontSize: fontScale(11), marginTop: 2 },
  composer: {
    borderRadius: scale(14),
    borderWidth: StyleSheet.hairlineWidth,
    padding: responsiveSpacing.md,
    marginTop: responsiveSpacing.md,
    gap: responsiveSpacing.sm,
  },
  composerField: { gap: 4 },
  composerLabel: { fontSize: fontScale(11), fontWeight: '600' },
  composerInput: {
    borderWidth: 1,
    borderRadius: scale(10),
    paddingHorizontal: responsiveSpacing.sm,
    paddingVertical: responsiveSpacing.sm,
    fontSize: fontScale(14),
  },
  composerROI: {
    fontSize: fontScale(12),
    fontWeight: '700',
  },
  cta: {
    borderRadius: scale(12),
    overflow: 'hidden',
    marginTop: responsiveSpacing.sm,
  },
  ctaDisabled: { opacity: 0.6 },
  ctaFill: {
    paddingVertical: responsiveSpacing.md,
    alignItems: 'center',
  },
  ctaText: {
    color: '#FFFFFF',
    fontSize: fontScale(15),
    fontWeight: '700',
  },
  resultMsg: {
    fontSize: fontScale(12),
    textAlign: 'center',
    marginTop: responsiveSpacing.xs,
  },
});
