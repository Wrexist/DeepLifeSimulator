/**
 * VerifiedProUpsellModal — promotes the Pulse Verified Pro subscription.
 *
 * Lists the perks and a CTA that calls the existing IAP service. The IAP
 * fulfillment handler in services/IAPService.ts wires the SKU to
 * `subscribeVerifiedPro` (mirrored inline; see services/IAPService.ts).
 */
import React, { useCallback } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { X, Check, Crown } from 'lucide-react-native';
import LinearGradientFallback from '@/components/fallbacks/LinearGradientFallback';
import { useTheme } from '@/hooks/useTheme';
import { scale, fontScale, responsiveSpacing, touchTargets } from '@/utils/scaling';
import { Z_INDEX } from '@/utils/zIndexConstants';
import { PULSE_GRADIENT } from '../styles/pulseTheme';
import { pulseHaptics } from '../utils/pulseHaptics';

const LinearGradient = LinearGradientFallback;

const PERKS: { icon: string; title: string; subtitle: string }[] = [
  { icon: '✓', title: 'Blue checkmark', subtitle: 'Verified across every Pulse surface' },
  { icon: '↑', title: '+25% post boost', subtitle: 'More followers and revenue per post' },
  { icon: '📊', title: 'Advanced analytics', subtitle: 'See per-post performance trends' },
  { icon: '⊘', title: 'No ads in feed', subtitle: 'Cleaner browsing experience' },
  { icon: '⤢', title: 'Longer posts', subtitle: '500-character limit vs 280' },
];

interface VerifiedProUpsellModalProps {
  visible: boolean;
  onDismiss: () => void;
  /** Called when the user taps Subscribe. Caller wires to IAPService. */
  onSubscribe?: (plan: 'monthly' | 'yearly') => void;
}

export default function VerifiedProUpsellModal({
  visible, onDismiss, onSubscribe,
}: VerifiedProUpsellModalProps) {
  const { theme } = useTheme();

  const handleSubscribe = useCallback(
    (plan: 'monthly' | 'yearly') => {
      pulseHaptics.success();
      onSubscribe?.(plan);
    },
    [onSubscribe],
  );

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onDismiss}>
      <View style={styles.backdrop}>
        <View style={[styles.sheet, { backgroundColor: theme.surface }]}>
          <View style={styles.header}>
            <Pressable
              onPress={onDismiss}
              accessibilityRole="button"
              accessibilityLabel="Close"
              hitSlop={8}
              style={styles.closeBtn}
            >
              <X size={fontScale(22)} color={theme.text} />
            </Pressable>
          </View>

          <LinearGradient
            colors={PULSE_GRADIENT as unknown as string[]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroBadge}
          >
            <Crown size={scale(36)} color="#FFFFFF" strokeWidth={2.4} />
          </LinearGradient>

          <Text style={[styles.title, { color: theme.text }]}>Pulse Verified Pro</Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
            Unlock the blue check and creator perks.
          </Text>

          <View style={styles.perksList}>
            {PERKS.map((p) => (
              <View key={p.title} style={styles.perkRow}>
                <View style={[styles.perkIcon, { backgroundColor: theme.surfaceElevated }]}>
                  <Check size={fontScale(14)} color={PULSE_GRADIENT[0]} strokeWidth={3} />
                </View>
                <View style={styles.perkText}>
                  <Text style={[styles.perkTitle, { color: theme.text }]}>{p.title}</Text>
                  <Text style={[styles.perkSubtitle, { color: theme.textSecondary }]}>
                    {p.subtitle}
                  </Text>
                </View>
              </View>
            ))}
          </View>

          <View style={styles.ctaRow}>
            <Pressable
              onPress={() => handleSubscribe('monthly')}
              style={[styles.planBtn, { borderColor: theme.border }]}
              accessibilityRole="button"
              accessibilityLabel="Subscribe monthly $4.99"
            >
              <Text style={[styles.planLabel, { color: theme.text }]}>Monthly</Text>
              <Text style={[styles.planPrice, { color: theme.text }]}>$4.99</Text>
            </Pressable>
            <Pressable
              onPress={() => handleSubscribe('yearly')}
              accessibilityRole="button"
              accessibilityLabel="Subscribe yearly $49.99 — save 17%"
              style={styles.planBtnPrimary}
            >
              <LinearGradient
                colors={PULSE_GRADIENT as unknown as string[]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.planBtnPrimaryFill}
              >
                <Text style={styles.planLabelPrimary}>Yearly · Save 17%</Text>
                <Text style={styles.planPricePrimary}>$49.99</Text>
              </LinearGradient>
            </Pressable>
          </View>

          <Text style={[styles.legal, { color: theme.textMuted }]}>
            Auto-renews until cancelled. Manage in your App Store / Play Store account.
          </Text>
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
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  closeBtn: {
    width: touchTargets.minimum,
    height: touchTargets.minimum,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroBadge: {
    alignSelf: 'center',
    width: scale(72),
    height: scale(72),
    borderRadius: scale(36),
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: responsiveSpacing.md,
  },
  title: {
    textAlign: 'center',
    fontSize: fontScale(22),
    fontWeight: '700',
  },
  subtitle: {
    textAlign: 'center',
    fontSize: fontScale(13),
    marginTop: responsiveSpacing.xs,
    marginBottom: responsiveSpacing.lg,
  },
  perksList: {
    gap: responsiveSpacing.sm,
    marginBottom: responsiveSpacing.lg,
  },
  perkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: responsiveSpacing.sm,
  },
  perkIcon: {
    width: scale(28),
    height: scale(28),
    borderRadius: scale(14),
    alignItems: 'center',
    justifyContent: 'center',
  },
  perkText: {
    flex: 1,
  },
  perkTitle: {
    fontSize: fontScale(14),
    fontWeight: '600',
  },
  perkSubtitle: {
    fontSize: fontScale(11),
    marginTop: 2,
  },
  ctaRow: {
    flexDirection: 'row',
    gap: responsiveSpacing.sm,
    marginBottom: responsiveSpacing.md,
  },
  planBtn: {
    flex: 1,
    paddingVertical: responsiveSpacing.md,
    paddingHorizontal: responsiveSpacing.md,
    borderRadius: scale(14),
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
  },
  planLabel: {
    fontSize: fontScale(13),
    fontWeight: '500',
  },
  planPrice: {
    fontSize: fontScale(16),
    fontWeight: '700',
    marginTop: 2,
  },
  planBtnPrimary: {
    flex: 1.4,
    borderRadius: scale(14),
    overflow: 'hidden',
  },
  planBtnPrimaryFill: {
    paddingVertical: responsiveSpacing.md,
    paddingHorizontal: responsiveSpacing.md,
    alignItems: 'center',
  },
  planLabelPrimary: {
    color: '#FFFFFF',
    fontSize: fontScale(13),
    fontWeight: '600',
  },
  planPricePrimary: {
    color: '#FFFFFF',
    fontSize: fontScale(16),
    fontWeight: '700',
    marginTop: 2,
  },
  legal: {
    fontSize: fontScale(10),
    textAlign: 'center',
  },
});
