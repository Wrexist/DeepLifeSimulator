/**
 * SubscriptionModal — the DeepLife+ premium paywall.
 *
 * A high-intent, conversion-optimized paywall: golden-crown hero, a truthful
 * value stack, an annual-default plan selector with per-week price framing, and
 * a free-trial-led CTA. Drives the purchase via `subscriptionService` and
 * applies in-game benefits via `applyDeepLifePlusBenefits` on success.
 *
 * Marketing choices (all App Store compliant — NO countdown timers, fake
 * scarcity, or strike-through "was" prices, per the app's review notes):
 *   • Annual plan pre-selected (higher LTV; users anchor to the default).
 *   • Free trial is the primary hook ("Start my 7-day free trial").
 *   • Yearly framed per-week ("just $0.96/week") — the strongest value cue.
 *   • Every listed benefit is one the game actually grants (kept truthful).
 */
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Animated,
  Easing,
  Platform,
  Linking,
} from 'react-native';
import { X, Crown, Check, Ban, Palette, Gem, ShieldCheck, TrendingUp, Headphones, ChevronRight, Sparkles, Gift } from 'lucide-react-native';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { useSetGameState } from '@/contexts/game/useGameSelector';
import { useGameActions } from '@/contexts/game/GameActionsContext';
import { scale, fontScale } from '@/utils/scaling';
import { subscriptionService } from '@/services/SubscriptionService';
import { revenueCatService } from '@/services/RevenueCatService';
import { track } from '@/lib/analytics';
import { logger } from '@/utils/logger';
import { applyDeepLifePlusBenefits } from '@/contexts/game/actions/SubscriptionActions';
import { PRIVACY_POLICY_URL, TERMS_OF_USE_URL } from '@/lib/config/appConfig';
import {
  DEEP_LIFE_PLUS_PLANS,
  DEEP_LIFE_PLUS_BENEFITS,
  DEEP_LIFE_PLUS_LIFETIME,
  DEEP_LIFE_PLUS_FREE_TRIAL_DAYS,
  yearlyPerWeek,
  yearlySavingsPercent,
  isDeepLifePlusActive,
  type DeepLifePlusPlan,
} from '@/lib/subscription/deepLifePlus';

interface Props {
  visible: boolean;
  onClose: () => void;
}

// Luxe dark + gold palette. Fixed (not theme-driven) so the paywall keeps its
// premium look in every theme. Flat colors only — the app's LinearGradient
// fallback renders just the first color, so we never rely on gradients.
const GOLD = '#FACC15';
const GOLD_SOFT = '#FDE68A';
const GOLD_DEEP = '#F59E0B';
const GOLD_TINT = 'rgba(250, 204, 21, 0.12)';
const GOLD_BORDER = 'rgba(250, 204, 21, 0.38)';
const SHEET_BG = '#0B1120';
const CARD_BG = '#111A2E';
const CARD_BORDER = 'rgba(255, 255, 255, 0.08)';
const TEXT = '#F8FAFC';
const TEXT_MUTED = '#94A3B8';
const TEXT_DIM = '#64748B';

const BENEFIT_ICON: Record<string, React.ComponentType<{ size?: number; color?: string }>> = {
  no_ads: Ban,
  daily_gems: Gift,
  income_boost: TrendingUp,
  legacy_premium: Crown,
  cosmetics: Palette,
  welcome_gems: Gem,
  vip_support: Headphones,
};

// Short right-aligned value chip per benefit (mockup-style). Honest labels only.
const BENEFIT_CHIP: Record<string, string> = {
  no_ads: 'AD-FREE',
  daily_gems: '250/DAY',
  income_boost: '+25%',
  legacy_premium: 'ALL ACCESS',
  cosmetics: 'EXCLUSIVE',
  welcome_gems: '+500',
  vip_support: 'VIP',
};

export default function SubscriptionModal({ visible, onClose }: Props) {
  const reducedMotion = useReducedMotion();
  const setGameState = useSetGameState();
  const { saveGame } = useGameActions();

  const yearlyPlan = useMemo(
    () => DEEP_LIFE_PLUS_PLANS.find((p) => p.period === 'yearly') ?? DEEP_LIFE_PLUS_PLANS[0],
    [],
  );
  // Annual pre-selected — the higher-LTV default that users anchor to.
  const [selected, setSelected] = useState<DeepLifePlusPlan>(yearlyPlan);
  const [lifetime, setLifetime] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const active = isDeepLifePlusActive();

  const trialDays = DEEP_LIFE_PLUS_FREE_TRIAL_DAYS;
  const perWeek = useMemo(() => yearlyPerWeek(), []);
  const savingsPct = useMemo(() => yearlySavingsPercent(), []);
  const trialEligible = !active && !lifetime && trialDays > 0;

  // Motion that makes the sheet feel alive: a slow gold pulse behind the crest,
  // twinkling hero sparkles, and a periodic light sweep across the CTA. All
  // native-driven and disabled under the OS "Reduce Motion" setting.
  const glow = useRef(new Animated.Value(0)).current;
  const sparkle = useRef(new Animated.Value(0)).current; // hero twinkle
  const shine = useRef(new Animated.Value(0)).current;    // CTA sweep
  useEffect(() => {
    if (!visible) return;
    if (reducedMotion) {
      glow.setValue(1);
      sparkle.setValue(0.6);
      shine.setValue(0);
      return;
    }
    const glowLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(glow, { toValue: 1, duration: 1400, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(glow, { toValue: 0.35, duration: 1400, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    const sparkleLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(sparkle, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(sparkle, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.delay(500),
      ]),
    );
    // A light band sweeps across the CTA every ~3.5s (premium "shine").
    const shineLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(shine, { toValue: 1, duration: 1050, easing: Easing.in(Easing.quad), useNativeDriver: true }),
        Animated.delay(2400),
      ]),
    );
    glowLoop.start();
    sparkleLoop.start();
    shineLoop.start();
    return () => {
      glowLoop.stop();
      sparkleLoop.stop();
      shineLoop.stop();
    };
  }, [visible, reducedMotion, glow, sparkle, shine]);

  useEffect(() => {
    if (visible) track('paywall_viewed', { surface: 'deeplife_plus', alreadyActive: active });
  }, [visible, active]);

  const handleSubscribe = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    setMessage(null);
    try {
      const productId = lifetime ? DEEP_LIFE_PLUS_LIFETIME.productId : selected.productId;
      track('paywall_cta_tapped', { surface: 'deeplife_plus', productId, trial: trialEligible });
      const res = await subscriptionService.purchasePremium(productId);
      if (res.success) {
        setGameState((prev) => applyDeepLifePlusBenefits(prev));
        void saveGame?.(false);
        setMessage(lifetime ? 'Premium unlocked forever — enjoy!' : 'DeepLife+ activated — welcome to the club!');
      } else {
        setMessage(res.message || 'Purchase could not be completed.');
      }
    } catch (error) {
      logger.error('[SubscriptionModal] purchase failed', { productId: selected.productId, error });
      setMessage('Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  }, [busy, lifetime, selected, trialEligible, setGameState, saveGame]);

  const handleRestore = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    setMessage(null);
    try {
      await subscriptionService.restoreSubscriptions();
      if (isDeepLifePlusActive()) {
        setGameState((prev) => applyDeepLifePlusBenefits(prev));
        void saveGame?.(false);
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
  }, [busy, setGameState, saveGame]);

  const handleManage = useCallback(() => {
    // Prefer RevenueCat's Customer Center (manage/cancel/restore/refund) when
    // available; otherwise open the platform's subscription-management page.
    if (revenueCatService.hasPaywallUI()) {
      void revenueCatService.presentCustomerCenter();
      return;
    }
    void subscriptionService.cancelSubscription(selected.productId);
  }, [selected]);

  const openLink = useCallback((url: string, what: string) => {
    Linking.openURL(url).catch((error) => {
      logger.error('[SubscriptionModal] failed to open link', { what, error });
      setMessage("Couldn't open this link. Please try again.");
    });
  }, []);
  const openTerms = useCallback(() => openLink(TERMS_OF_USE_URL, 'terms'), [openLink]);
  const openPrivacy = useCallback(() => openLink(PRIVACY_POLICY_URL, 'privacy'), [openLink]);

  const selectYearly = useCallback(() => { setLifetime(false); setSelected(yearlyPlan); }, [yearlyPlan]);
  const selectPlan = useCallback((plan: DeepLifePlusPlan) => { setLifetime(false); setSelected(plan); }, []);
  const selectLifetime = useCallback(() => setLifetime(true), []);

  const glowStyle = {
    opacity: glow,
    transform: [{ scale: glow.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1.15] }) }],
  };
  const sparkleAStyle = {
    opacity: sparkle,
    transform: [{ scale: sparkle.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1.1] }) }],
  };
  const sparkleBStyle = {
    opacity: sparkle.interpolate({ inputRange: [0, 1], outputRange: [1, 0.2] }),
    transform: [{ scale: sparkle.interpolate({ inputRange: [0, 1], outputRange: [1.1, 0.6] }) }],
  };
  const shineStyle = {
    opacity: shine.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 0.5, 0] }),
    transform: [
      { translateX: shine.interpolate({ inputRange: [0, 1], outputRange: [scale(-160), scale(420)] }) },
      { skewX: '-18deg' },
    ],
  };

  // Primary CTA copy — trial-led when eligible.
  const ctaTitle = active
    ? 'Manage subscription'
    : lifetime
      ? `Unlock Forever · ${DEEP_LIFE_PLUS_LIFETIME.price}`
      : trialEligible
        ? 'Start for $0.00 Today'
        : `Continue · ${selected.price} ${selected.unit}`;
  const ctaSub = active
    ? undefined
    : lifetime
      ? 'One-time payment · yours forever, never renews'
      : trialEligible
        ? `${trialDays} days free, then ${selected.price} ${selected.unit} · cancel anytime`
        : 'Cancel anytime';

  return (
    <Modal visible={visible} transparent animationType={reducedMotion ? 'fade' : 'slide'} onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          {/* Close */}
          <TouchableOpacity
            onPress={onClose}
            style={styles.closeBtn}
            accessibilityRole="button"
            accessibilityLabel="Close DeepLife Plus"
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <X size={scale(20)} color={TEXT_MUTED} />
          </TouchableOpacity>

          <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {/* Hero */}
            <View style={styles.hero}>
              <View style={styles.crownWrap}>
                <Animated.View style={[styles.crownGlow, glowStyle]} pointerEvents="none" />
                <Animated.View style={[styles.sparkleA, sparkleAStyle]} pointerEvents="none">
                  <Sparkles size={scale(15)} color={GOLD_SOFT} fill={GOLD_SOFT} />
                </Animated.View>
                <Animated.View style={[styles.sparkleB, sparkleBStyle]} pointerEvents="none">
                  <Sparkles size={scale(11)} color={GOLD_SOFT} fill={GOLD_SOFT} />
                </Animated.View>
                <View style={styles.crownChip}>
                  <Crown size={scale(34)} color={GOLD} fill={GOLD} />
                </View>
              </View>
              <Text style={styles.brand}>
                DeepLife<Text style={styles.brandPlus}>+</Text>
              </Text>
              <Text style={styles.tagline}>
                {active ? 'Your membership is active — thank you!' : 'Your best life, unlocked.'}
              </Text>
            </View>

            {/* Value stack */}
            <View style={styles.benefits}>
              {DEEP_LIFE_PLUS_BENEFITS.map((b) => {
                const Icon = BENEFIT_ICON[b.id] ?? Check;
                return (
                  <View key={b.id} style={styles.benefitRow}>
                    <View style={styles.benefitIcon}>
                      <Icon size={scale(18)} color={GOLD} />
                    </View>
                    <View style={styles.benefitText}>
                      <Text style={styles.benefitTitle}>{b.title}</Text>
                      <Text style={styles.benefitDesc}>{b.description}</Text>
                    </View>
                    {BENEFIT_CHIP[b.id] ? (
                      <View style={styles.benefitChip}>
                        <Text style={styles.benefitChipText}>{BENEFIT_CHIP[b.id]}</Text>
                      </View>
                    ) : null}
                  </View>
                );
              })}
            </View>

            {!active && (
              <>
                {/* Free-trial banner — the hook */}
                {trialEligible ? (
                  <View style={styles.trialBanner}>
                    <View style={styles.trialBannerBody}>
                      <Text style={styles.trialBannerTitle}>{trialDays} days risk-free</Text>
                      <Text style={styles.trialBannerSub}>
                        Try every perk. Love it or cancel — no charge.
                      </Text>
                    </View>
                    <View style={styles.riskSeal}>
                      <Text style={styles.riskSealPct}>100%</Text>
                      <Text style={styles.riskSealLabel}>RISK-FREE</Text>
                    </View>
                  </View>
                ) : null}

                {/* Plan selector — annual default */}
                <View style={styles.plansRow}>
                  {/* Annual */}
                  <TouchableOpacity
                    style={[styles.planCard, !lifetime && selected.period === 'yearly' && styles.planCardSelected]}
                    onPress={selectYearly}
                    activeOpacity={0.9}
                    accessibilityRole="button"
                    accessibilityLabel={`Annual plan, ${yearlyPlan.price} per year${savingsPct ? `, save ${savingsPct} percent` : ''}`}
                  >
                    {savingsPct ? (
                      <View style={styles.saveBadge}>
                        <Text style={styles.saveBadgeText}>SAVE {savingsPct}%</Text>
                      </View>
                    ) : null}
                    <Text style={styles.planPeriod}>Annual</Text>
                    <Text style={styles.planPrice}>{yearlyPlan.price}</Text>
                    <Text style={styles.planUnit}>per year</Text>
                    {perWeek ? <Text style={styles.planPerWeek}>just {perWeek}/week</Text> : null}
                  </TouchableOpacity>

                  {/* Monthly */}
                  {DEEP_LIFE_PLUS_PLANS.filter((p) => p.period === 'monthly').map((plan) => (
                    <TouchableOpacity
                      key={plan.period}
                      style={[styles.planCard, !lifetime && selected.period === 'monthly' && styles.planCardSelected]}
                      onPress={() => selectPlan(plan)}
                      activeOpacity={0.9}
                      accessibilityRole="button"
                      accessibilityLabel={`Monthly plan, ${plan.price} per month`}
                    >
                      <Text style={styles.planPeriod}>Monthly</Text>
                      <Text style={styles.planPrice}>{plan.price}</Text>
                      <Text style={styles.planUnit}>per month</Text>
                      <Text style={styles.planPerWeekMuted}>billed monthly</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Pay-once alternative */}
                <TouchableOpacity
                  style={[styles.lifetimeCard, lifetime && styles.lifetimeCardSelected]}
                  onPress={selectLifetime}
                  activeOpacity={0.9}
                  accessibilityRole="button"
                  accessibilityLabel={`Unlock forever, one-time ${DEEP_LIFE_PLUS_LIFETIME.price}`}
                >
                  <View style={styles.lifetimeLeft}>
                    <Text style={styles.lifetimeTitle}>Unlock forever</Text>
                    <Text style={styles.lifetimeSub}>Pay once · no subscription, never renews</Text>
                  </View>
                  <Text style={styles.lifetimePrice}>{DEEP_LIFE_PLUS_LIFETIME.price}</Text>
                </TouchableOpacity>
              </>
            )}

            {message ? <Text style={styles.message}>{message}</Text> : null}
          </ScrollView>

          {/* Primary CTA */}
          <TouchableOpacity
            style={[styles.cta, busy && styles.ctaDisabled]}
            onPress={active ? handleManage : handleSubscribe}
            disabled={busy}
            activeOpacity={0.9}
            accessibilityRole="button"
            accessibilityLabel={ctaTitle}
          >
            <Animated.View style={[styles.ctaShine, shineStyle]} pointerEvents="none" />
            {busy ? (
              <ActivityIndicator color="#1A1206" />
            ) : (
              <>
                <Text style={styles.ctaText}>{ctaTitle}</Text>
                {ctaSub ? <Text style={styles.ctaSub}>{ctaSub}</Text> : null}
                <View style={styles.ctaChevronWrap} pointerEvents="none">
                  <ChevronRight size={scale(22)} color="#1A1206" />
                </View>
              </>
            )}
          </TouchableOpacity>

          {/* Trust row */}
          {!active ? (
            <View style={styles.trustRow}>
              <View style={styles.trustItem}>
                <ShieldCheck size={scale(13)} color={TEXT_MUTED} />
                <Text style={styles.trustText}>Cancel anytime</Text>
              </View>
              <View style={styles.trustItem}>
                <Check size={scale(13)} color={TEXT_MUTED} />
                <Text style={styles.trustText}>No commitment</Text>
              </View>
              <View style={styles.trustItem}>
                <Check size={scale(13)} color={TEXT_MUTED} />
                <Text style={styles.trustText}>
                  {Platform.select({ ios: 'Secure via App Store', android: 'Secure via Google Play', default: 'Secure checkout' })}
                </Text>
              </View>
            </View>
          ) : null}

          {/* Footer links */}
          <View style={styles.footerRow}>
            <TouchableOpacity onPress={handleRestore} disabled={busy} accessibilityRole="button" accessibilityLabel="Restore purchases">
              <Text style={styles.footerLink}>Restore</Text>
            </TouchableOpacity>
            <Text style={styles.footerDivider}>·</Text>
            <TouchableOpacity onPress={handleManage} accessibilityRole="button" accessibilityLabel="Manage subscription">
              <Text style={styles.footerLink}>Manage</Text>
            </TouchableOpacity>
            {/* Apple requires a Terms (EULA) link on the paywall; the standard
                EULA is iOS-specific, so link it on iOS only. */}
            {Platform.OS === 'ios' ? (
              <>
                <Text style={styles.footerDivider}>·</Text>
                <TouchableOpacity onPress={openTerms} accessibilityRole="link" accessibilityLabel="Terms of Use">
                  <Text style={styles.footerLink}>Terms</Text>
                </TouchableOpacity>
              </>
            ) : null}
            <Text style={styles.footerDivider}>·</Text>
            <TouchableOpacity onPress={openPrivacy} accessibilityRole="link" accessibilityLabel="Privacy Policy">
              <Text style={styles.footerLink}>Privacy</Text>
            </TouchableOpacity>
          </View>

          {/* Compliant legal disclosure */}
          <Text style={styles.legal}>
            {active
              ? 'Manage or cancel anytime in your store account.'
              : lifetime
                ? 'One-time purchase. Yours forever — no subscription, never renews.'
                : trialEligible
                  ? `${trialDays}-day free trial, then ${selected.price} ${selected.unit}. Auto-renews until cancelled; cancel at least 24 hours before it renews to avoid charges. Manage in your store account.`
                  : `${selected.price} ${selected.unit}. Auto-renews until cancelled. Manage or cancel anytime in your store account.`}
          </Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.72)' },
  sheet: {
    maxHeight: '94%',
    backgroundColor: SHEET_BG,
    borderTopLeftRadius: scale(26),
    borderTopRightRadius: scale(26),
    borderWidth: 1,
    borderColor: GOLD_BORDER,
    paddingHorizontal: scale(18),
    paddingTop: scale(18),
    paddingBottom: scale(18),
  },
  closeBtn: {
    position: 'absolute',
    top: scale(14),
    right: scale(14),
    zIndex: 5,
    width: scale(34),
    height: scale(34),
    borderRadius: scale(17),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(148,163,184,0.14)',
  },
  // flexShrink lets the scroll area shrink within the maxHeight-clamped sheet so
  // the CTA + trust/footer below it stay pinned and visible while the content
  // (hero, 6 benefits, plans) scrolls internally.
  scroll: { flexShrink: 1 },
  scrollContent: { paddingBottom: scale(6) },

  // Hero
  hero: { alignItems: 'center', paddingTop: scale(8), paddingBottom: scale(14) },
  crownWrap: { alignItems: 'center', justifyContent: 'center', marginBottom: scale(12) },
  crownGlow: {
    position: 'absolute',
    width: scale(120),
    height: scale(120),
    borderRadius: scale(60),
    backgroundColor: 'rgba(250, 204, 21, 0.22)',
  },
  sparkleA: { position: 'absolute', top: scale(-2), right: scale(2) },
  sparkleB: { position: 'absolute', bottom: scale(4), left: scale(4) },
  crownChip: {
    width: scale(76),
    height: scale(76),
    borderRadius: scale(24),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: GOLD_TINT,
    borderWidth: 1.5,
    borderColor: GOLD_BORDER,
  },
  brand: { fontSize: fontScale(30), fontWeight: '900', color: TEXT, letterSpacing: 0.3 },
  brandPlus: { color: GOLD },
  tagline: { fontSize: fontScale(14), fontWeight: '600', color: TEXT_MUTED, marginTop: scale(4), textAlign: 'center' },

  // Benefits
  benefits: {
    backgroundColor: CARD_BG,
    borderRadius: scale(18),
    borderWidth: 1,
    borderColor: CARD_BORDER,
    padding: scale(14),
    marginBottom: scale(14),
  },
  benefitRow: { flexDirection: 'row', alignItems: 'center', gap: scale(12), paddingVertical: scale(7) },
  benefitIcon: {
    width: scale(38),
    height: scale(38),
    borderRadius: scale(12),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: GOLD_TINT,
    borderWidth: 1,
    borderColor: GOLD_BORDER,
  },
  benefitText: { flex: 1 },
  benefitTitle: { fontSize: fontScale(15), fontWeight: '800', color: TEXT },
  benefitDesc: { fontSize: fontScale(12.5), color: TEXT_MUTED, marginTop: scale(1) },
  benefitChip: {
    borderWidth: 1,
    borderColor: GOLD_BORDER,
    backgroundColor: GOLD_TINT,
    borderRadius: scale(9),
    paddingHorizontal: scale(9),
    paddingVertical: scale(5),
    marginLeft: scale(8),
  },
  benefitChipText: { color: GOLD_SOFT, fontSize: fontScale(11), fontWeight: '900', letterSpacing: 0.3 },

  // Trial banner
  trialBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(12),
    backgroundColor: GOLD_TINT,
    borderColor: GOLD_BORDER,
    borderWidth: 1,
    borderRadius: scale(16),
    paddingVertical: scale(12),
    paddingHorizontal: scale(14),
    marginBottom: scale(14),
  },
  trialBannerBody: { flex: 1 },
  trialBannerTitle: { fontSize: fontScale(17), fontWeight: '900', color: GOLD_SOFT },
  trialBannerSub: { fontSize: fontScale(12.5), color: TEXT_MUTED, marginTop: scale(3) },
  riskSeal: {
    width: scale(58),
    height: scale(58),
    borderRadius: scale(29),
    borderWidth: 1.5,
    borderColor: GOLD,
    backgroundColor: 'rgba(250,204,21,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  riskSealPct: { fontSize: fontScale(16), fontWeight: '900', color: GOLD_SOFT, lineHeight: fontScale(18) },
  riskSealLabel: { fontSize: fontScale(8), fontWeight: '900', color: GOLD_SOFT, letterSpacing: 0.4 },

  // Plans
  plansRow: { flexDirection: 'row', gap: scale(12), marginBottom: scale(12) },
  planCard: {
    flex: 1,
    backgroundColor: CARD_BG,
    borderRadius: scale(16),
    borderWidth: 1.5,
    borderColor: CARD_BORDER,
    paddingVertical: scale(16),
    paddingHorizontal: scale(10),
    alignItems: 'center',
  },
  planCardSelected: { borderColor: GOLD, backgroundColor: 'rgba(250,204,21,0.07)' },
  saveBadge: {
    position: 'absolute',
    top: -scale(10),
    backgroundColor: GOLD,
    borderRadius: scale(10),
    paddingHorizontal: scale(9),
    paddingVertical: scale(2),
  },
  saveBadgeText: { color: '#1A1206', fontSize: fontScale(10), fontWeight: '900', letterSpacing: 0.3 },
  planPeriod: { fontSize: fontScale(13), fontWeight: '700', color: TEXT_MUTED, marginTop: scale(2) },
  planPrice: { fontSize: fontScale(22), fontWeight: '900', color: TEXT, marginTop: scale(4) },
  planUnit: { fontSize: fontScale(11), color: TEXT_MUTED, marginTop: scale(1) },
  planPerWeek: { fontSize: fontScale(12), fontWeight: '800', color: GOLD_SOFT, marginTop: scale(6) },
  planPerWeekMuted: { fontSize: fontScale(11), color: TEXT_DIM, marginTop: scale(6) },

  // Lifetime
  lifetimeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CARD_BG,
    borderRadius: scale(16),
    borderWidth: 1.5,
    borderColor: CARD_BORDER,
    paddingVertical: scale(13),
    paddingHorizontal: scale(16),
  },
  lifetimeCardSelected: { borderColor: GOLD, backgroundColor: 'rgba(250,204,21,0.07)' },
  lifetimeLeft: { flex: 1 },
  lifetimeTitle: { fontSize: fontScale(15), fontWeight: '800', color: TEXT },
  lifetimeSub: { fontSize: fontScale(11.5), color: TEXT_MUTED, marginTop: scale(2) },
  lifetimePrice: { fontSize: fontScale(20), fontWeight: '900', color: GOLD_SOFT },

  message: { fontSize: fontScale(13), fontWeight: '700', color: TEXT, textAlign: 'center', marginTop: scale(12) },

  // CTA
  cta: {
    marginTop: scale(14),
    backgroundColor: GOLD,
    borderRadius: scale(16),
    paddingVertical: scale(13),
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    shadowColor: GOLD_DEEP,
    shadowOffset: { width: 0, height: scale(6) },
    shadowOpacity: 0.4,
    shadowRadius: scale(14),
    elevation: 8,
  },
  ctaShine: {
    position: 'absolute',
    top: -scale(20),
    bottom: -scale(20),
    width: scale(70),
    backgroundColor: 'rgba(255, 255, 255, 0.55)',
  },
  ctaDisabled: { opacity: 0.6 },
  ctaText: { color: '#1A1206', fontSize: fontScale(17), fontWeight: '900', letterSpacing: 0.2 },
  ctaSub: { color: 'rgba(26,18,6,0.72)', fontSize: fontScale(11.5), fontWeight: '700', marginTop: scale(2), textAlign: 'center', paddingHorizontal: scale(24) },
  ctaChevronWrap: { position: 'absolute', right: scale(16), top: 0, bottom: 0, justifyContent: 'center' },

  // Trust + footer
  trustRow: { flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', gap: scale(14), marginTop: scale(12) },
  trustItem: { flexDirection: 'row', alignItems: 'center', gap: scale(4) },
  trustText: { fontSize: fontScale(11.5), fontWeight: '600', color: TEXT_MUTED },
  footerRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: scale(8), marginTop: scale(12) },
  footerLink: { fontSize: fontScale(13), fontWeight: '700', color: TEXT_MUTED },
  footerDivider: { fontSize: fontScale(13), color: TEXT_DIM },
  legal: { fontSize: fontScale(10), lineHeight: fontScale(14), color: TEXT_DIM, textAlign: 'center', marginTop: scale(10) },
});
