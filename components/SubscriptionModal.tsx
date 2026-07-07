/**
 * SubscriptionModal — the DeepLife+ paywall.
 *
 * Lists the (truthful) benefits and the monthly / yearly plans, drives the
 * purchase via `subscriptionService`, and applies in-game benefits
 * (ad-free + welcome gems) via `applyDeepLifePlusBenefits` on success.
 * Also offers Restore and Manage (platform-controlled cancellation).
 */
import React, { useState, useEffect } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { X, Crown, Check } from 'lucide-react-native';
import { useTheme } from '@/hooks/useTheme';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { useSetGameState } from '@/contexts/game/useGameSelector';
import { useGameActions } from '@/contexts/game/GameActionsContext';
import { scale, fontScale, responsiveBorderRadius } from '@/utils/scaling';
import { accent, colors } from '@/lib/config/theme';
import { subscriptionService } from '@/services/SubscriptionService';
import { track } from '@/lib/analytics';
import { logger } from '@/utils/logger';
import { applyDeepLifePlusBenefits } from '@/contexts/game/actions/SubscriptionActions';
import {
  DEEP_LIFE_PLUS_PLANS,
  DEEP_LIFE_PLUS_BENEFITS,
  DEEP_LIFE_PLUS_LIFETIME,
  isDeepLifePlusActive,
  type DeepLifePlusPlan,
} from '@/lib/subscription/deepLifePlus';

interface Props {
  visible: boolean;
  onClose: () => void;
}

export default function SubscriptionModal({ visible, onClose }: Props) {
  const { theme } = useTheme();
  const reducedMotion = useReducedMotion();
  const setGameState = useSetGameState();
  const { saveGame } = useGameActions();
  const [selected, setSelected] = useState<DeepLifePlusPlan>(DEEP_LIFE_PLUS_PLANS[0]);
  // When true the player picked the one-time "unlock forever" option instead of
  // a subscription plan.
  const [lifetime, setLifetime] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const active = isDeepLifePlusActive();

  // Funnel: record paywall impressions (no-op unless telemetry is enabled).
  useEffect(() => {
    if (visible) track('paywall_viewed', { surface: 'deeplife_plus', alreadyActive: active });
  }, [visible, active]);

  const handleSubscribe = async () => {
    if (busy) return;
    setBusy(true);
    setMessage(null);
    try {
      const productId = lifetime ? DEEP_LIFE_PLUS_LIFETIME.productId : selected.productId;
      const res = await subscriptionService.purchasePremium(productId);
      if (res.success) {
        setGameState((prev) => applyDeepLifePlusBenefits(prev));
        void saveGame?.(false); // persist entitlement + welcome gems immediately
        setMessage(lifetime ? 'Premium unlocked forever — enjoy!' : 'DeepLife+ activated — enjoy ad-free play!');
      } else {
        setMessage(res.message || 'Purchase could not be completed.');
      }
    } catch (error) {
      logger.error('[SubscriptionModal] purchase failed', { productId: selected.productId, error });
      setMessage('Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const handleRestore = async () => {
    if (busy) return;
    setBusy(true);
    setMessage(null);
    try {
      await subscriptionService.restoreSubscriptions();
      if (isDeepLifePlusActive()) {
        setGameState((prev) => applyDeepLifePlusBenefits(prev));
        void saveGame?.(false); // persist restored entitlement immediately
        setMessage('Subscription restored.');
      } else {
        setMessage('No active subscription found to restore.');
      }
    } catch (error) {
      logger.error('[SubscriptionModal] restore failed', { error });
      setMessage('Could not restore purchases. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const handleManage = () => {
    void subscriptionService.cancelSubscription(selected.productId);
  };

  return (
    <Modal visible={visible} transparent animationType={reducedMotion ? 'fade' : 'slide'} onRequestClose={onClose}>
      <View style={[styles.overlay, { backgroundColor: theme.overlay }]}>
        <View style={[styles.sheet, { backgroundColor: theme.background, borderColor: theme.border }]}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.titleRow}>
              <Crown size={scale(22)} color={accent.warning} />
              <Text style={[styles.title, { color: theme.text }]}>DeepLife+</Text>
            </View>
            <TouchableOpacity onPress={onClose} accessibilityRole="button" accessibilityLabel="Close DeepLife Plus">
              <X size={scale(22)} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>

          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
            {active ? 'Your subscription is active. Thank you!' : 'Go premium and get more out of every life.'}
          </Text>

          <ScrollView contentContainerStyle={styles.scrollContent}>
            {/* Benefits */}
            <View style={[styles.benefitsBox, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              {DEEP_LIFE_PLUS_BENEFITS.map((b) => (
                <View key={b.id} style={styles.benefitRow}>
                  <Check size={scale(16)} color={accent.success} />
                  <View style={styles.benefitText}>
                    <Text style={[styles.benefitTitle, { color: theme.text }]}>{b.title}</Text>
                    <Text style={[styles.benefitDesc, { color: theme.textSecondary }]}>{b.description}</Text>
                  </View>
                </View>
              ))}
            </View>

            {/* Plans */}
            {!active && (
              <>
                <View style={styles.plansRow}>
                  {DEEP_LIFE_PLUS_PLANS.map((plan) => {
                    const isSel = !lifetime && plan.period === selected.period;
                    return (
                      <TouchableOpacity
                        key={plan.period}
                        style={[
                          styles.planCard,
                          { backgroundColor: theme.surface, borderColor: isSel ? colors.palette.primary : theme.border },
                          isSel && { borderWidth: 2 },
                        ]}
                        onPress={() => { setLifetime(false); setSelected(plan); }}
                        accessibilityRole="button"
                        accessibilityLabel={`${plan.period} plan, ${plan.price} ${plan.unit}`}
                      >
                        {plan.badge ? (
                          <View style={[styles.badge, { backgroundColor: accent.warning }]}>
                            <Text style={styles.badgeText}>{plan.badge}</Text>
                          </View>
                        ) : null}
                        <Text style={[styles.planPeriod, { color: theme.text }]}>
                          {plan.period === 'monthly' ? 'Monthly' : 'Yearly'}
                        </Text>
                        <Text style={[styles.planPrice, { color: colors.palette.primary }]}>{plan.price}</Text>
                        <Text style={[styles.planUnit, { color: theme.textSecondary }]}>{plan.unit}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* One-time alternative — pay once, no subscription. */}
                <View style={styles.orRow}>
                  <View style={[styles.orLine, { backgroundColor: theme.border }]} />
                  <Text style={[styles.orText, { color: theme.textMuted }]}>or pay once</Text>
                  <View style={[styles.orLine, { backgroundColor: theme.border }]} />
                </View>
                <TouchableOpacity
                  style={[
                    styles.lifetimeCard,
                    { backgroundColor: theme.surface, borderColor: lifetime ? colors.palette.primary : theme.border },
                    lifetime && { borderWidth: 2 },
                  ]}
                  onPress={() => setLifetime(true)}
                  accessibilityRole="button"
                  accessibilityLabel={`Unlock forever, one-time purchase, ${DEEP_LIFE_PLUS_LIFETIME.price}`}
                >
                  <View style={styles.lifetimeText}>
                    <Text style={[styles.lifetimeTitle, { color: theme.text }]}>Unlock forever</Text>
                    <Text style={[styles.lifetimeSub, { color: theme.textSecondary }]}>One-time · no subscription, never renews</Text>
                  </View>
                  <Text style={[styles.lifetimePrice, { color: colors.palette.primary }]}>{DEEP_LIFE_PLUS_LIFETIME.price}</Text>
                </TouchableOpacity>
              </>
            )}

            {message ? <Text style={[styles.message, { color: theme.text }]}>{message}</Text> : null}
          </ScrollView>

          {/* Actions */}
          {!active ? (
            <TouchableOpacity
              style={[styles.cta, { backgroundColor: colors.palette.primary }, busy && styles.ctaDisabled]}
              onPress={handleSubscribe}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel={lifetime
                ? `Unlock forever, ${DEEP_LIFE_PLUS_LIFETIME.price}`
                : `Subscribe ${selected.price} ${selected.unit}`}
            >
              {busy ? (
                <ActivityIndicator color={colors.palette.white} />
              ) : lifetime ? (
                <Text style={styles.ctaText}>Unlock forever · {DEEP_LIFE_PLUS_LIFETIME.price}</Text>
              ) : (
                <Text style={styles.ctaText}>Subscribe · {selected.price} {selected.unit}</Text>
              )}
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.cta, { backgroundColor: theme.surfaceElevated }]}
              onPress={handleManage}
              accessibilityRole="button"
              accessibilityLabel="Manage subscription"
            >
              <Text style={[styles.ctaText, { color: theme.text }]}>Manage subscription</Text>
            </TouchableOpacity>
          )}

          <View style={styles.footerRow}>
            <TouchableOpacity onPress={handleRestore} disabled={busy} accessibilityRole="button" accessibilityLabel="Restore purchases">
              <Text style={[styles.footerLink, { color: theme.textSecondary }]}>Restore</Text>
            </TouchableOpacity>
            <Text style={[styles.footerDivider, { color: theme.textMuted }]}>·</Text>
            <TouchableOpacity onPress={handleManage} accessibilityRole="button" accessibilityLabel="Manage subscription">
              <Text style={[styles.footerLink, { color: theme.textSecondary }]}>Manage</Text>
            </TouchableOpacity>
          </View>

          <Text style={[styles.legal, { color: theme.textMuted }]}>
            {lifetime
              ? 'One-time purchase. Yours forever — no subscription, never renews.'
              : 'Auto-renews until cancelled. Manage or cancel anytime in your store account.'}
          </Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    maxHeight: '88%',
    borderTopLeftRadius: responsiveBorderRadius['2xl'],
    borderTopRightRadius: responsiveBorderRadius['2xl'],
    borderWidth: 1,
    paddingHorizontal: scale(16),
    paddingTop: scale(14),
    paddingBottom: scale(20),
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: scale(8) },
  title: { fontSize: fontScale(22), fontWeight: '800' },
  subtitle: { fontSize: fontScale(13), marginTop: scale(4), marginBottom: scale(12) },
  scrollContent: { paddingBottom: scale(8) },
  benefitsBox: { borderWidth: 1, borderRadius: responsiveBorderRadius.lg, padding: scale(12), marginBottom: scale(14) },
  benefitRow: { flexDirection: 'row', alignItems: 'flex-start', gap: scale(10), marginBottom: scale(10) },
  benefitText: { flex: 1 },
  benefitTitle: { fontSize: fontScale(14), fontWeight: '700' },
  benefitDesc: { fontSize: fontScale(12), marginTop: scale(2) },
  plansRow: { flexDirection: 'row', gap: scale(12) },
  planCard: { flex: 1, borderWidth: 1, borderRadius: responsiveBorderRadius.lg, padding: scale(14), alignItems: 'center' },
  badge: { position: 'absolute', top: -scale(8), borderRadius: responsiveBorderRadius.full, paddingHorizontal: scale(8), paddingVertical: scale(2) },
  badgeText: { color: '#1A1A1A', fontSize: fontScale(10), fontWeight: '800' },
  planPeriod: { fontSize: fontScale(14), fontWeight: '700', marginTop: scale(4) },
  planPrice: { fontSize: fontScale(20), fontWeight: '800', marginTop: scale(6) },
  planUnit: { fontSize: fontScale(11), marginTop: scale(2) },
  orRow: { flexDirection: 'row', alignItems: 'center', gap: scale(10), marginTop: scale(14), marginBottom: scale(10) },
  orLine: { flex: 1, height: 1 },
  orText: { fontSize: fontScale(11), fontWeight: '700', letterSpacing: 0.3, textTransform: 'uppercase' },
  lifetimeCard: {
    flexDirection: 'row', alignItems: 'center', gap: scale(12),
    borderWidth: 1, borderRadius: responsiveBorderRadius.lg, padding: scale(14),
  },
  lifetimeText: { flex: 1 },
  lifetimeTitle: { fontSize: fontScale(15), fontWeight: '800' },
  lifetimeSub: { fontSize: fontScale(11.5), marginTop: scale(2) },
  lifetimePrice: { fontSize: fontScale(20), fontWeight: '800' },
  message: { fontSize: fontScale(13), fontWeight: '600', textAlign: 'center', marginTop: scale(12) },
  cta: { marginTop: scale(12), borderRadius: responsiveBorderRadius.lg, paddingVertical: scale(14), alignItems: 'center', justifyContent: 'center' },
  ctaDisabled: { opacity: 0.6 },
  ctaText: { color: '#FFFFFF', fontSize: fontScale(15), fontWeight: '800' },
  footerRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: scale(8), marginTop: scale(12) },
  footerLink: { fontSize: fontScale(13), fontWeight: '600' },
  footerDivider: { fontSize: fontScale(13) },
  legal: { fontSize: fontScale(10), textAlign: 'center', marginTop: scale(10) },
});
