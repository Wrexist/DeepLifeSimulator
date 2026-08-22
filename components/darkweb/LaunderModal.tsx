import React, { useState, useEffect } from 'react';
import { View, Text, Modal, ScrollView, TouchableOpacity, TextInput, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { X, Droplets } from 'lucide-react-native';
import { DarkWebMixerTier } from '@/contexts/game/types';
import { MIXER_TIERS, effectiveMixerParams, frontDiscount } from '@/lib/darkweb/laundering';
import { responsiveFontSize, responsiveSpacing, responsiveBorderRadius, scale } from '@/utils/scaling';
import { hitSlopToMinTarget, minTouchTargetStyle } from '@/utils/touchTargets';
import { getThemeColors, accent } from '@/lib/config/theme';

interface Props {
  visible: boolean;
  dirtyBtc: number;
  launderingSkillLevel: number;
  /** Number of restaurant + bank companies the player owns. Cuts fee + delay. */
  frontCount?: number;
  darkMode: boolean;
  onClose: () => void;
  onSubmit: (tier: DarkWebMixerTier, amountBtc: number) => void;
}

const TIER_COLOR: Record<DarkWebMixerTier, string> = {
  cheap: accent.warning,
  standard: accent.info,
  premium: '#a855f7',
};

const TIER_LABEL: Record<DarkWebMixerTier, string> = {
  cheap: 'Cheap',
  standard: 'Standard',
  premium: 'Premium',
};

export default function LaunderModal({ visible, dirtyBtc, launderingSkillLevel, frontCount = 0, darkMode, onClose, onSubmit }: Props) {
  const theme = getThemeColors(darkMode);
  const [tier, setTier] = useState<DarkWebMixerTier>('standard');
  const [amountText, setAmountText] = useState('');

  useEffect(() => {
    if (!visible) {
      setTier('standard');
      setAmountText('');
    }
  }, [visible]);

  const amount = parseFloat(amountText) || 0;
  const canSubmit = amount > 0 && amount <= dirtyBtc;
  const baseParams = MIXER_TIERS[tier];
  const effective = effectiveMixerParams(tier, launderingSkillLevel, frontCount);
  const front = frontDiscount(frontCount);
  const skillReduction = Math.min(launderingSkillLevel, 10) * 0.005;
  const effectiveFee = effective.feePct;
  const expectedOut = amount * (1 - effectiveFee);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.backdrop}
      >
        <TouchableOpacity
          style={styles.backdropTouch}
          activeOpacity={1}
          onPress={onClose}
          importantForAccessibility="no"
          accessibilityElementsHidden
        />
        <View style={[styles.sheet, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={styles.headerRow}>
            <Text style={[styles.title, { color: theme.text }]}>Launder Dirty BTC</Text>
            <TouchableOpacity onPress={onClose} hitSlop={hitSlopToMinTarget(scale(20))} style={minTouchTargetStyle} accessibilityRole="button" accessibilityLabel="Close">
              <X size={scale(20)} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>

          {/*
            The body scrolls; "Submit to Mixer" below it does not.

            This sheet had no scroller at all — header, tiers, amount field, a
            summary block that grows to four lines once fronts are owned, and
            the submit button, all in one column capped at `maxHeight: '90%'`.
            RN does not shrink children by default, so past that cap the
            overflow simply left the sheet, and the thing at the bottom of the
            column is the only control that does anything. The R4-A note on the
            amount input records this already happening once, via the Samsung
            autocorrect bar. Bounding the body instead of the whole column means
            neither a long summary nor a keyboard can take the button away.
          */}
          <ScrollView
            style={{ flexShrink: 1 }}
            contentContainerStyle={{ gap: responsiveSpacing.md }}
            keyboardShouldPersistTaps="handled"
          >
          <Text style={[styles.subtitle, { color: theme.textMuted }]}>
            Dirty wallet: <Text style={{ color: theme.text, fontWeight: '700' }}>{dirtyBtc.toFixed(4)} ₿</Text>
          </Text>

          <View>
            <Text style={[styles.fieldLabel, { color: theme.textMuted }]}>Mixer tier</Text>
            <View style={styles.tierRow}>
              {(Object.keys(MIXER_TIERS) as DarkWebMixerTier[]).map((t) => {
                const active = t === tier;
                const params = MIXER_TIERS[t];
                return (
                  <TouchableOpacity
                    key={t}
                    onPress={() => setTier(t)}
                    style={[
                      styles.tierCard,
                      {
                        borderColor: active ? TIER_COLOR[t] : theme.border,
                        backgroundColor: active ? TIER_COLOR[t] : theme.surfaceElevated,
                        borderWidth: active ? 2 : 1,
                      },
                    ]}
                  >
                    <Droplets size={scale(14)} color={active ? 'white' : TIER_COLOR[t]} />
                    <Text style={[styles.tierName, { color: active ? 'white' : theme.text }]}>
                      {TIER_LABEL[t]}
                    </Text>
                    <Text style={[styles.tierMeta, { color: active ? 'white' : theme.textMuted }]}>
                      {(params.feePct * 100).toFixed(0)}% fee · {params.delayWeeks}w
                    </Text>
                    <Text style={[styles.tierMeta, { color: active ? 'white' : theme.textMuted }]}>
                      {(params.failProbability * 100).toFixed(1)}% fail
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <View>
            <Text style={[styles.fieldLabel, { color: theme.textMuted }]}>Amount (BTC)</Text>
            <View style={[styles.fieldRow, { borderColor: theme.border }]}>
              <TextInput
                value={amountText}
                onChangeText={setAmountText}
                keyboardType="decimal-pad"
                  // R4-A: money input hygiene — autocorrect bar on Samsung One UI
                  // pushes Confirm off-screen on small devices.
                  autoCorrect={false}
                  autoCapitalize="none"
                  spellCheck={false}
                  returnKeyType="done"
                placeholder="0.0000"
                placeholderTextColor={theme.textMuted}
                style={[styles.input, { color: theme.text }]}
              />
              <TouchableOpacity onPress={() => setAmountText(String(dirtyBtc))} style={styles.maxBtn}>
                <Text style={[styles.maxText, { color: theme.textSecondary }]}>MAX</Text>
              </TouchableOpacity>
            </View>
          </View>

          {amount > 0 && (
            <View style={[styles.summary, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
              <Text style={[styles.summaryRow, { color: theme.textSecondary }]}>
                Sent in: {amount.toFixed(4)} ₿
              </Text>
              <Text style={[styles.summaryRow, { color: theme.textSecondary }]}>
                Effective fee: {(effectiveFee * 100).toFixed(2)}% (skill −{(skillReduction * 100).toFixed(1)}%
                {frontCount > 0 ? `, ${frontCount} front${frontCount === 1 ? '' : 's'} −${(front.feeReduction * 100).toFixed(1)}%` : ''})
              </Text>
              {frontCount > 0 && (
                <Text style={[styles.summaryRow, { color: theme.textSecondary }]}>
                  Delay: {effective.delayWeeks}w ({baseParams.delayWeeks}w base − {front.delayReductionWeeks}w via fronts)
                </Text>
              )}
              <Text style={[styles.summaryHighlight, { color: theme.text }]}>
                Expected out: {expectedOut.toFixed(4)} ₿
              </Text>
            </View>
          )}
          </ScrollView>

          <TouchableOpacity
            disabled={!canSubmit}
            onPress={() => onSubmit(tier, amount)}
            style={[styles.confirm, { backgroundColor: canSubmit ? accent.info : theme.border }]}
          >
            <Text style={styles.confirmText}>Submit to Mixer</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: responsiveSpacing.lg,
  },
  backdropTouch: { ...StyleSheet.absoluteFillObject },
  sheet: {
    borderRadius: responsiveBorderRadius.xl,
    borderWidth: 1,
    padding: responsiveSpacing.lg,
    gap: responsiveSpacing.md,
    maxHeight: '90%',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: { fontSize: responsiveFontSize.lg, fontWeight: '700' },
  subtitle: { fontSize: responsiveFontSize.sm },
  fieldLabel: {
    fontSize: responsiveFontSize.sm,
    fontWeight: '600',
    marginBottom: responsiveSpacing.xs,
  },
  tierRow: { flexDirection: 'row', gap: responsiveSpacing.xs },
  tierCard: {
    flex: 1,
    alignItems: 'center',
    padding: responsiveSpacing.sm,
    borderRadius: responsiveBorderRadius.lg,
    gap: 2,
  },
  tierName: { fontSize: responsiveFontSize.sm, fontWeight: '700' },
  tierMeta: { fontSize: responsiveFontSize.xs },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: responsiveBorderRadius.lg,
    paddingHorizontal: responsiveSpacing.md,
  },
  input: {
    flex: 1,
    fontSize: responsiveFontSize.lg,
    fontWeight: '700',
    paddingVertical: responsiveSpacing.md,
  },
  maxBtn: { paddingHorizontal: responsiveSpacing.xs },
  maxText: { fontSize: responsiveFontSize.xs, fontWeight: '700' },
  summary: {
    padding: responsiveSpacing.md,
    borderRadius: responsiveBorderRadius.lg,
    borderWidth: 1,
    gap: 4,
  },
  summaryRow: { fontSize: responsiveFontSize.sm },
  summaryHighlight: { fontSize: responsiveFontSize.md, fontWeight: '800', marginTop: responsiveSpacing.xs },
  confirm: {
    paddingVertical: responsiveSpacing.md,
    borderRadius: responsiveBorderRadius.lg,
    alignItems: 'center',
  },
  confirmText: { color: 'white', fontSize: responsiveFontSize.md, fontWeight: '700' },
});
