/**
 * SubscriptionModal - the DeepLife+ premium paywall.
 *
 * Redesigned (2026-08-24) around one conversion rule: the player must see the
 * value proposition, the price, the plan and the CTA on ONE screen, with ONE
 * dominant action. The previous revision buried the plan selector below a
 * seven-row benefit list and a trial banner, so the single most important
 * conversion element - the price - often sat below the fold. Now:
 *
 *   • Small crest + "Make every life better." headline (2-second value prop).
 *   • FIVE primary benefits; welcome gems + VIP support fold into one quiet
 *     "Plus..." line so the list reads in a glance.
 *   • The plan selector (annual pre-selected, BEST VALUE badge) and the CTA are
 *     PINNED below the scroll area - the price is on screen in every state.
 *   • Gold is reserved for what matters: the brand mark, the selected plan and
 *     the CTA. Everything else is dark navy, white type and muted secondaries.
 *
 * Marketing choices (all App Store compliant - NO countdown timers, fake
 * scarcity, or strike-through "was" prices, per the app's review notes):
 *   • Annual plan pre-selected (higher LTV; users anchor to the default).
 *   • Free trial is the primary hook, but only where it is TRUE (see below).
 *   • Yearly framed per-week - the strongest value cue.
 *   • Every listed benefit is one the game actually grants (kept truthful).
 *
 * ── TWO THINGS THIS SCREEN IS NOT ALLOWED TO GUESS ──────────────────────────
 *
 * THE PRICE. Every figure here used to come from the static `SUBSCRIPTION_CONFIGS`
 * map ('$4.99' / '$49.99'), so a player on a non-US storefront read a US-dollar
 * price they would never be charged, and the derived "SAVE n%" and per-week
 * lines were computed from those same USD constants. Prices now come from the
 * store for THIS player (`useSubscriptionPrices`), and when the store has not
 * given us one the screen shows a placeholder and refuses to present a purchase
 * CTA rather than printing a number it cannot stand behind.
 *
 * THE TRIAL. The trial claim was shown whenever eligibility was not a definite
 * 'ineligible' - which is every Android user, every build without RevenueCat
 * keys, and every failed lookup. So a returning subscriber who had already spent
 * their trial was shown a "free" CTA and charged in full on tap.
 * `resolveTrialClaim` now separates a hard promise (store confirms the offer AND
 * this player's eligibility) from conditional copy that is true either way.
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
  Image,
  Platform,
  Linking,
  type ImageSourcePropType,
} from 'react-native';
import { X, Crown, Check, Ban, Palette, Gift, ShieldCheck, TrendingUp, ChevronRight } from 'lucide-react-native';
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
  DEEP_LIFE_PLUS_WELCOME_GEMS,
  isDeepLifePlusActive,
  type DeepLifePlusPlan,
} from '@/lib/subscription/deepLifePlus';
import {
  perWeekPrice,
  yearlySavingsPercent,
  storeFreeTrialDays,
  resolveTrialClaim,
  type PlanPrice,
} from '@/lib/subscription/planPricing';
import { useSubscriptionPrices, useOnceLatch } from '@/hooks/useSubscriptionPrices';

interface Props {
  visible: boolean;
  onClose: () => void;
}

// Luxe dark + gold palette. Fixed (not theme-driven) so the paywall keeps its
// premium look in every theme. Flat colors only - the app's LinearGradient
// fallback renders just the first color, so we never rely on gradients.
// Gold is deliberately scarce: brand mark, selected plan, BEST VALUE badge and
// the CTA. If everything is gold, nothing is.
const GOLD = '#FACC15';
const GOLD_SOFT = '#FDE68A';
const GOLD_DEEP = '#F59E0B';
const SHEET_BG = '#0B1120';
const CARD_BG = '#111A2E';
const CARD_BORDER = 'rgba(255, 255, 255, 0.08)';
const ICON_BG = 'rgba(255, 255, 255, 0.06)';
const TEXT = '#F8FAFC';
const TEXT_MUTED = '#94A3B8';
const TEXT_DIM = '#64748B';

const BENEFIT_ICON: Record<string, React.ComponentType<{ size?: number; color?: string }>> = {
  no_ads: Ban,
  daily_gems: Gift,
  income_boost: TrendingUp,
  legacy_premium: Crown,
  cosmetics: Palette,
};

// The five benefits that sell the membership in a glance. Welcome gems and VIP
// support are real perks but weak headliners - they collapse into the single
// "Plus..." line below the list so the stack stays scannable. All seven still
// appear on the post-purchase welcome panel, where completeness matters.
const PRIMARY_BENEFIT_IDS = ['no_ads', 'daily_gems', 'income_boost', 'legacy_premium', 'cosmetics'];

// The DeepLife+ crest - the illustrated gold crown on its dark gold-framed
// plate. The same file backs the avatar badge in `DeepLifePlusUpsell`, so the
// mark a player taps on the player card is the mark that greets them here.
// Rendered small on purpose: the headline sells, the crest just signs it.
const CREST_ART: ImageSourcePropType = require('@/assets/images/deeplife-plus-crest.webp');

const BENEFIT_ART: Record<string, ImageSourcePropType> = {
  no_ads: require('@/assets/images/iap/premium/remove_ads.webp'),
  income_boost: require('@/assets/images/iap/perks/work_pay_boost.webp'),
};

export default function SubscriptionModal({ visible, onClose }: Props) {
  const reducedMotion = useReducedMotion();
  const setGameState = useSetGameState();
  const { saveGame } = useGameActions();

  const yearlyPlan = useMemo(
    () => DEEP_LIFE_PLUS_PLANS.find((p) => p.period === 'yearly') ?? DEEP_LIFE_PLUS_PLANS[0],
    [],
  );
  const monthlyPlan = useMemo(
    () => DEEP_LIFE_PLUS_PLANS.find((p) => p.period === 'monthly'),
    [],
  );
  // Annual pre-selected - the higher-LTV default that users anchor to.
  const [selected, setSelected] = useState<DeepLifePlusPlan>(yearlyPlan);
  const [lifetime, setLifetime] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  // Set once the purchase completes, so the sheet can hand the player a welcome
  // instead of dropping them back on the sales pitch they just accepted.
  const [purchased, setPurchased] = useState<null | { lifetime: boolean }>(null);
  const active = isDeepLifePlusActive();

  // Store-confirmed intro-offer eligibility for the selected plan (checked below).
  const [introStatus, setIntroStatus] = useState<'eligible' | 'ineligible' | 'unknown'>('unknown');

  // ── Live, localized prices ────────────────────────────────────────────────
  const pricedIds = useMemo(
    () =>
      [yearlyPlan?.productId, monthlyPlan?.productId, DEEP_LIFE_PLUS_LIFETIME.productId].filter(
        (id): id is string => typeof id === 'string' && id.length > 0,
      ),
    [yearlyPlan, monthlyPlan],
  );
  const prices = useSubscriptionPrices(pricedIds, visible && !active);
  const yearlyPrice = prices.priceFor(yearlyPlan?.productId ?? '');
  const monthlyPrice = prices.priceFor(monthlyPlan?.productId ?? '');
  const lifetimePrice = prices.priceFor(DEEP_LIFE_PLUS_LIFETIME.productId);
  const selectedPrice = lifetime ? lifetimePrice : prices.priceFor(selected.productId);

  /**
   * What to print for a plan.
   *
   * `store-disabled` is the ONLY state that falls back to the config price: no
   * store exists in that build, so nothing can be charged and no wrong number
   * can lead to a wrong payment - it keeps the layout reviewable in Expo Go and
   * the web preview, with the CTA disabled (the same way GemShopModal degrades).
   * Every other state shows a placeholder, because there a purchase COULD still
   * be attempted and a stale USD figure would be a false price.
   */
  const priceLabel = useCallback(
    (resolved: PlanPrice, configPrice: string): string => {
      if (resolved.fromStore) return resolved.displayPrice;
      return prices.state === 'store-disabled' ? configPrice : '-';
    },
    [prices.state],
  );

  // Derived value framing - silent unless it can be computed from real,
  // same-currency store prices (see lib/subscription/planPricing.ts).
  const perWeek = useMemo(() => perWeekPrice(yearlyPrice), [yearlyPrice]);
  const savingsPct = useMemo(
    () => yearlySavingsPercent(monthlyPrice, yearlyPrice),
    [monthlyPrice, yearlyPrice],
  );

  // ── What we may claim about the free trial ────────────────────────────────
  // Two independent questions: does the PRODUCT carry a free-trial offer (the
  // store's product data), and may THIS player still use it (the per-user
  // eligibility check below). Only a yes to both earns the free-trial CTA;
  // a partial answer gets copy that holds either way.
  const trial = useMemo(() => {
    if (active || lifetime) return { claim: 'none' as const, days: 0 };
    const product = prices.productFor(selected.productId);
    return resolveTrialClaim({
      eligibility: introStatus,
      storeTrialDays: storeFreeTrialDays(product),
      configuredTrialDays: DEEP_LIFE_PLUS_FREE_TRIAL_DAYS,
    });
  }, [active, lifetime, prices, selected.productId, introStatus]);
  const trialDays = trial.days;
  const trialPromised = trial.claim === 'promise';
  const trialMentioned = trial.claim !== 'none';

  // Can the player actually buy right now? Gated on having a real price to show
  // them - presenting a purchase button beside a price we could not load is the
  // failure this whole screen was rebuilt to prevent.
  const canPurchase = selectedPrice.fromStore;

  // Motion, kept minimal on purpose: a slow gold pulse behind the crest and a
  // periodic light sweep across the CTA - the one element allowed to shout.
  // Native-driven and disabled under the OS "Reduce Motion" setting.
  const glow = useRef(new Animated.Value(0)).current;
  const shine = useRef(new Animated.Value(0)).current; // CTA sweep
  useEffect(() => {
    if (!visible) return;
    if (reducedMotion) {
      glow.setValue(1);
      shine.setValue(0);
      return;
    }
    const glowLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(glow, { toValue: 1, duration: 1400, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(glow, { toValue: 0.35, duration: 1400, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
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
    shineLoop.start();
    return () => {
      glowLoop.stop();
      shineLoop.stop();
    };
  }, [visible, reducedMotion, glow, shine]);

  // ── Funnel instrumentation ────────────────────────────────────────────────
  // `once` keeps the per-open events (viewed, intro offer shown) to one each per
  // presentation, so a re-render caused by a price landing cannot inflate them.
  const once = useOnceLatch();
  const openedAt = useRef<number>(0);
  const planTouched = useRef(false);

  useEffect(() => {
    if (!visible) {
      once.reset();
      planTouched.current = false;
      openedAt.current = 0;
      // Reset the post-purchase view, or reopening the paywall later would greet
      // the player with the same welcome panel instead of their member state.
      // Safe to do here: `handleClose` has already read `purchased` from its own
      // closure by this point, so the dismissal event stays correctly suppressed
      // for a session that ended in a purchase.
      setPurchased(null);
      setMessage(null);
      return;
    }
    openedAt.current = Date.now();
    if (once.fire('viewed')) {
      // `defaultProductId` = the pre-selected plan. `paywall_plan_selected`
      // fires only on a TAP, so without this the default's share of purchases
      // was invisible - most buyers never touch the selector.
      track('paywall_viewed', {
        surface: 'deeplife_plus',
        alreadyActive: active,
        defaultProductId: selected.productId,
      });
    }
  }, [visible, active, once, selected.productId]);

  // Record that a trial was actually PRESENTED, and in which form. Without this
  // the trial cannot be evaluated: a conditional mention and a hard promise
  // convert very differently, and the split between them is decided by store
  // data we do not otherwise log.
  useEffect(() => {
    if (!visible || trial.claim === 'none') return;
    if (!once.fire(`intro:${trial.claim}:${trialDays}`)) return;
    track('paywall_intro_offer_shown', {
      surface: 'deeplife_plus',
      claim: trial.claim,
      days: trialDays,
      productId: selected.productId,
    });
  }, [visible, trial.claim, trialDays, selected.productId, once]);

  /**
   * Report a dismissal with enough context to tell the two kinds apart: a player
   * who never touched a plan was not interested, while one who selected a plan
   * and then left was lost at the price or the terms. `dwellMs` separates both
   * from an accidental open.
   */
  const handleClose = useCallback(() => {
    if (openedAt.current > 0 && !purchased) {
      track('paywall_dismissed', {
        surface: 'deeplife_plus',
        dwellMs: Date.now() - openedAt.current,
        planTouched: planTouched.current,
        selectedProductId: lifetime ? DEEP_LIFE_PLUS_LIFETIME.productId : selected.productId,
        priceState: prices.state,
        trialClaim: trial.claim,
      });
    }
    onClose();
  }, [onClose, purchased, lifetime, selected.productId, prices.state, trial.claim]);

  // Re-check StoreKit/RevenueCat intro-offer eligibility for the selected plan
  // whenever the sheet opens or the plan changes. Best-effort: any failure
  // leaves 'unknown', which `resolveTrialClaim` downgrades to conditional copy
  // rather than a promise.
  useEffect(() => {
    if (!visible || active || lifetime) return;
    let cancelled = false;
    setIntroStatus('unknown'); // reset while re-checking the newly selected plan
    void revenueCatService.getIntroEligibility(selected.productId).then((status) => {
      if (!cancelled) setIntroStatus(status);
    });
    return () => {
      cancelled = true;
    };
  }, [visible, active, lifetime, selected.productId]);

  // A REF, not the `busy` state, is what actually closes the double-tap window.
  // `setBusy(true)` does not update `busy` until React re-renders, so two taps
  // landing in one batch would both read `busy === false` and both open a store
  // sheet - the same gate-then-act shape that has produced double-grant bugs in
  // this repo (CLAUDE.md §4.4). The ref flips synchronously, so the second tap
  // is refused before it can reach the store. `busy` is kept for the UI.
  const purchaseInFlight = useRef(false);

  const handleSubscribe = useCallback(async () => {
    if (purchaseInFlight.current || busy || !canPurchase) return;
    purchaseInFlight.current = true;
    setBusy(true);
    setMessage(null);
    try {
      const productId = lifetime ? DEEP_LIFE_PLUS_LIFETIME.productId : selected.productId;
      track('paywall_cta_tapped', {
        surface: 'deeplife_plus',
        productId,
        trialClaim: trial.claim,
        // The price the player was actually looking at when they committed -
        // the only way to reconcile the funnel against a storefront's real tiers.
        displayPrice: selectedPrice.displayPrice,
        currency: selectedPrice.currency,
      });
      // purchase_started / _succeeded / _cancelled / _failed are emitted centrally
      // by IAPService.purchaseProduct, so they are not repeated here.
      const res = await subscriptionService.purchasePremium(productId);
      if (res.success) {
        setGameState((prev) => applyDeepLifePlusBenefits(prev));
        void saveGame?.(false);
        // Distinct from purchase_succeeded: that says the store took the money,
        // this says the entitlement reached the save. A gap between the two is a
        // fulfilment bug that would otherwise only ever surface as a support email.
        track('premium_activated', {
          surface: 'deeplife_plus',
          productId,
          kind: lifetime ? 'lifetime' : selected.period,
        });
        setPurchased({ lifetime });
        setMessage(null);
      } else {
        setMessage(res.message || 'Purchase could not be completed.');
      }
    } catch (error) {
      logger.error('[SubscriptionModal] purchase failed', { productId: selected.productId, error });
      setMessage('Something went wrong. Please try again.');
    } finally {
      purchaseInFlight.current = false;
      setBusy(false);
    }
  }, [busy, canPurchase, lifetime, selected, trial.claim, selectedPrice, setGameState, saveGame]);

  const handleRestore = useCallback(async () => {
    if (purchaseInFlight.current || busy) return;
    purchaseInFlight.current = true; // shared latch: never restore mid-purchase
    setBusy(true);
    setMessage(null);
    track('restore_started', { surface: 'deeplife_plus' });
    try {
      await subscriptionService.restoreSubscriptions();
      if (isDeepLifePlusActive()) {
        setGameState((prev) => applyDeepLifePlusBenefits(prev));
        void saveGame?.(false);
        track('restore_succeeded', { surface: 'deeplife_plus' });
        setMessage('Subscription restored.');
      } else {
        // Not an error: a player with nothing to restore is the common case.
        // Tracked apart from a failure so a spike in genuine restore FAILURES -
        // the ones that cost a paying player their entitlement - stays visible.
        track('restore_failed', { surface: 'deeplife_plus', reason: 'nothing_to_restore' });
        setMessage('No active subscription found to restore.');
      }
    } catch (error) {
      logger.error('[SubscriptionModal] restore failed', { error });
      track('restore_failed', { surface: 'deeplife_plus', reason: 'error' });
      setMessage('Could not restore purchases. Please try again.');
    } finally {
      purchaseInFlight.current = false;
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

  // Plan selection is a funnel step in its own right: a player who switches to
  // monthly, or to the pay-once option, is telling us the default did not fit.
  const trackPlan = useCallback((productId: string, planKind: string) => {
    planTouched.current = true;
    track('paywall_plan_selected', { surface: 'deeplife_plus', productId, plan: planKind });
  }, []);
  const selectYearly = useCallback(() => {
    setLifetime(false);
    setSelected(yearlyPlan);
    trackPlan(yearlyPlan.productId, 'yearly');
  }, [yearlyPlan, trackPlan]);
  const selectPlan = useCallback((plan: DeepLifePlusPlan) => {
    setLifetime(false);
    setSelected(plan);
    trackPlan(plan.productId, plan.period);
  }, [trackPlan]);
  const selectLifetime = useCallback(() => {
    setLifetime(true);
    trackPlan(DEEP_LIFE_PLUS_LIFETIME.productId, 'lifetime');
  }, [trackPlan]);

  const glowStyle = {
    opacity: glow,
    transform: [{ scale: glow.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1.15] }) }],
  };
  const shineStyle = {
    opacity: shine.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 0.5, 0] }),
    transform: [
      { translateX: shine.interpolate({ inputRange: [0, 1], outputRange: [scale(-160), scale(420)] }) },
      { skewX: '-18deg' },
    ],
  };

  const primaryBenefits = DEEP_LIFE_PLUS_BENEFITS.filter((b) => PRIMARY_BENEFIT_IDS.includes(b.id));

  // ── Primary CTA ───────────────────────────────────────────────────────────
  // A four-state machine, because "we could not load the price" and "the store
  // is not present in this build" are different situations with different right
  // answers, and neither may end in a purchase button next to a made-up figure.
  //
  //   active          → Manage. No selling to an existing member.
  //   loading         → Disabled placeholder; the price is still arriving.
  //   store-disabled  → Disabled. Nothing here can charge anyone (Expo Go, web).
  //   unavailable     → RETRY, not a dead end: a store IS present, it just has
  //                     not answered, and the player must not be stuck.
  //   ready           → The real CTA, trial-led only where the trial is real.
  const selectedLabel = lifetime
    ? priceLabel(lifetimePrice, DEEP_LIFE_PLUS_LIFETIME.price)
    : priceLabel(selectedPrice, selected.price);
  const ctaMode: 'manage' | 'loading' | 'disabled' | 'retry' | 'buy' = active
    ? 'manage'
    : canPurchase
      ? 'buy'
      : prices.state === 'loading'
        ? 'loading'
        : prices.state === 'store-disabled'
          ? 'disabled'
          : 'retry';

  const ctaTitle =
    ctaMode === 'manage'
      ? 'Manage subscription'
      : ctaMode === 'loading'
        ? 'Loading plans…'
        : ctaMode === 'disabled'
          ? 'Store unavailable'
          : ctaMode === 'retry'
            ? 'Retry'
            : lifetime
              ? `Unlock Forever · ${selectedLabel}`
              // A free-trial headline is a hard promise about THIS player's next
              // charge, so it is reserved for a store-confirmed eligible trial.
              // Everyone else is shown the price they will actually be charged.
              : trialPromised
                ? `Start ${trialDays}-Day Free Trial`
                : `Continue · ${selectedLabel} ${selected.unit}`;

  const ctaSub =
    ctaMode === 'manage'
      ? undefined
      : ctaMode === 'loading'
        ? 'Fetching prices from the store'
        : ctaMode === 'disabled'
          ? 'Purchases are not available in this build'
          : ctaMode === 'retry'
            ? "We couldn't reach the store - tap to try again"
            : lifetime
              ? 'One-time payment · yours forever, never renews'
              : trialPromised
                ? `${trialDays} days free, then ${selectedLabel} ${selected.unit} · cancel anytime`
                : trialMentioned
                  // True whether or not this particular player still qualifies:
                  // it describes the OFFER, and the store decides who gets it.
                  ? `${selectedLabel} ${selected.unit} · includes a ${trialDays}-day free trial for new subscribers`
                  : 'Cancel anytime';

  const ctaDisabled = busy || ctaMode === 'loading' || ctaMode === 'disabled';
  const onCtaPress = ctaMode === 'manage'
    ? handleManage
    : ctaMode === 'retry'
      ? prices.reload
      : handleSubscribe;

  return (
    <Modal visible={visible} transparent animationType={reducedMotion ? 'fade' : 'slide'} onRequestClose={handleClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          {/* Close */}
          <TouchableOpacity
            onPress={handleClose}
            style={styles.closeBtn}
            accessibilityRole="button"
            accessibilityLabel="Close DeepLife Plus"
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <X size={scale(20)} color={TEXT_MUTED} />
          </TouchableOpacity>

          <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {/* Hero - the 2-second value proposition. The crest signs it small;
                the headline does the selling. */}
            <View style={styles.hero}>
              <View style={styles.crownWrap}>
                <Animated.View style={[styles.crownGlow, glowStyle]} pointerEvents="none" />
                <Image source={CREST_ART} style={styles.crest} resizeMode="contain" />
              </View>
              <Text style={styles.brand}>
                DeepLife<Text style={styles.brandPlus}>+</Text>
              </Text>
              <Text style={styles.tagline}>
                {purchased
                  ? "You're in. Here's everything you just unlocked."
                  : active
                    ? 'Your membership is active - thank you!'
                    : 'Make every life better.'}
              </Text>
            </View>

            {/* Value stack - five rows, one glance. */}
            <View style={styles.benefits}>
              {primaryBenefits.map((b, i) => {
                const Icon = BENEFIT_ICON[b.id] ?? Check;
                const Art = BENEFIT_ART[b.id];
                return (
                  <View key={b.id} style={[styles.benefitRow, i > 0 && styles.benefitRowDivider]}>
                    <View style={styles.benefitIcon}>
                      {Art ? (
                        <Image source={Art} style={styles.benefitArt} resizeMode="contain" />
                      ) : (
                        <Icon size={scale(15)} color={GOLD} />
                      )}
                    </View>
                    <View style={styles.benefitText}>
                      <Text style={styles.benefitTitle}>{b.title}</Text>
                      <Text style={styles.benefitDesc}>{b.description}</Text>
                    </View>
                  </View>
                );
              })}
            </View>

            {/* The rest of the value, in one quiet line - real perks, weak
                headliners. Kept truthful: both are granted on join. */}
            {!active && !purchased ? (
              <Text style={styles.plusLine}>
                Plus {DEEP_LIFE_PLUS_WELCOME_GEMS} welcome gems and VIP support when you join.
              </Text>
            ) : null}

            {/* Pay-once alternative - a secondary path, styled quiet. */}
            {!active && !purchased ? (
              <TouchableOpacity
                style={[styles.lifetimeCard, lifetime && styles.lifetimeCardSelected]}
                onPress={selectLifetime}
                activeOpacity={0.9}
                accessibilityRole="button"
                accessibilityLabel={`Unlock forever, one-time ${priceLabel(lifetimePrice, DEEP_LIFE_PLUS_LIFETIME.price)}`}
              >
                <View style={styles.lifetimeLeft}>
                  <Text style={styles.lifetimeTitle}>Prefer to pay once?</Text>
                  <Text style={styles.lifetimeSub}>Unlock forever · no subscription, never renews</Text>
                </View>
                <Text style={styles.lifetimePrice}>
                  {priceLabel(lifetimePrice, DEEP_LIFE_PLUS_LIFETIME.price)}
                </Text>
              </TouchableOpacity>
            ) : null}

            {/* ── The activation moment ──────────────────────────────────
                A purchase used to end with a one-line string under the plan
                selector the player had just accepted - no acknowledgement, no
                statement of what they now have, and nothing to do next. That is
                the moment a subscriber decides whether the charge was a good
                idea, and the first premium perk they actually USE is the best
                predictor of whether they renew.

                So: name what they unlocked, and point them at the fastest one to
                feel - the welcome gems are already in their balance, granted by
                `applyDeepLifePlusBenefits` in the same handler. */}
            {purchased ? (
              <View style={styles.welcome}>
                <Text style={styles.welcomeTitle}>
                  {purchased.lifetime ? 'Premium unlocked - forever' : 'Welcome to DeepLife+'}
                </Text>
                <Text style={styles.welcomeSub}>
                  Every perk below is live right now. Your welcome gems are already in your
                  balance.
                </Text>
                {DEEP_LIFE_PLUS_BENEFITS.map((b) => (
                  <View key={b.id} style={styles.welcomeRow}>
                    <Check size={scale(14)} color={GOLD} />
                    <Text style={styles.welcomeRowText}>{b.title}</Text>
                  </View>
                ))}
              </View>
            ) : null}

            {message ? <Text style={styles.message}>{message}</Text> : null}
          </ScrollView>

          {/* Plan selector - PINNED below the scroll so price + plan + CTA are
              on screen together in every state. Annual pre-selected. */}
          {!active && !purchased ? (
            <View style={styles.plansRow}>
              {/* Annual */}
              <TouchableOpacity
                style={[styles.planCard, !lifetime && selected.period === 'yearly' && styles.planCardSelected]}
                onPress={selectYearly}
                activeOpacity={0.9}
                accessibilityRole="button"
                accessibilityLabel={`Annual plan, best value, ${priceLabel(yearlyPrice, yearlyPlan.price)} per year${savingsPct ? `, save ${savingsPct} percent` : ''}`}
              >
                {/* "SAVE n%" only when provable from two real, same-currency
                    store prices - never from config USD. "BEST VALUE" is the
                    plan's own standing badge. */}
                <View style={styles.saveBadge}>
                  <Text style={styles.saveBadgeText}>
                    {savingsPct ? `BEST VALUE · SAVE ${savingsPct}%` : 'BEST VALUE'}
                  </Text>
                </View>
                <Text style={styles.planPeriod}>Annual</Text>
                <Text style={styles.planPrice} numberOfLines={1} adjustsFontSizeToFit>
                  {priceLabel(yearlyPrice, yearlyPlan.price)}
                </Text>
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
                  accessibilityLabel={`Monthly plan, ${priceLabel(monthlyPrice, plan.price)} per month`}
                >
                  <Text style={styles.planPeriod}>Monthly</Text>
                  <Text style={styles.planPrice} numberOfLines={1} adjustsFontSizeToFit>
                    {priceLabel(monthlyPrice, plan.price)}
                  </Text>
                  <Text style={styles.planUnit}>per month</Text>
                  <Text style={styles.planPerWeekMuted}>billed monthly</Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : null}

          {/* Primary CTA - the one element allowed to dominate. After a
              purchase it becomes the way OUT of the sheet, so a new subscriber
              is never left tapping a buy button for something they already own. */}
          <TouchableOpacity
            style={[styles.cta, (ctaDisabled || busy) && styles.ctaDisabled]}
            onPress={purchased ? handleClose : onCtaPress}
            disabled={!purchased && ctaDisabled}
            activeOpacity={0.9}
            accessibilityRole="button"
            accessibilityState={{ disabled: !purchased && ctaDisabled, busy }}
            accessibilityLabel={purchased ? 'Start playing with DeepLife Plus' : ctaTitle}
          >
            <Animated.View style={[styles.ctaShine, shineStyle]} pointerEvents="none" />
            {busy ? (
              <ActivityIndicator color="#1A1206" />
            ) : (
              <>
                <Text style={styles.ctaText}>{purchased ? 'Start playing' : ctaTitle}</Text>
                {purchased ? (
                  <Text style={styles.ctaSub}>Your perks are active from this week on</Text>
                ) : ctaSub ? (
                  <Text style={styles.ctaSub}>{ctaSub}</Text>
                ) : null}
                <View style={styles.ctaChevronWrap} pointerEvents="none">
                  <ChevronRight size={scale(20)} color="#1A1206" />
                </View>
              </>
            )}
          </TouchableOpacity>

          {/* Compact reassurance line */}
          {!active && !purchased ? (
            <View style={styles.trustRow}>
              <ShieldCheck size={scale(13)} color={TEXT_MUTED} />
              <Text style={styles.trustText}>
                Cancel anytime ·{' '}
                {Platform.select({ ios: 'Secure via App Store', android: 'Secure via Google Play', default: 'Secure payment' })}
              </Text>
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
            <Text style={styles.footerDivider}>·</Text>
            <TouchableOpacity onPress={openTerms} accessibilityRole="link" accessibilityLabel="Terms of Use">
              <Text style={styles.footerLink}>Terms of Use</Text>
            </TouchableOpacity>
            <Text style={styles.footerDivider}>·</Text>
            <TouchableOpacity onPress={openPrivacy} accessibilityRole="link" accessibilityLabel="Privacy Policy">
              <Text style={styles.footerLink}>Privacy</Text>
            </TouchableOpacity>
          </View>

          {/* ── Compliant legal disclosure ───────────────────────────────────
              Apple requires the recurring nature, the price and the billing
              period to be clear before purchase. The price quoted here is the
              SAME resolved store price shown on the plan card and the CTA -
              they read from one value, so the disclosure and the button can
              never quote different figures. When no price could be loaded the
              disclosure says so plainly instead of inventing one; the CTA is a
              retry in that state, so nothing can be bought on an unstated price. */}
          <Text style={styles.legal}>
            {purchased
              ? purchased.lifetime
                ? 'One-time purchase - no subscription, nothing renews.'
                : 'Your subscription renews automatically until cancelled. Manage or cancel anytime in your store account.'
              : active
                ? 'Manage or cancel anytime in your store account.'
                : lifetime
                  ? 'One-time purchase. Yours forever - no subscription, never renews.'
                  : prices.state === 'store-disabled'
                    // Prices ARE on screen in this state (the config fallback,
                    // shown only where nothing can be purchased), so claiming
                    // none loaded would contradict the cards right above.
                    ? 'Purchases are unavailable in this build. Prices shown are indicative - the store always shows your exact price and renewal terms before any charge.'
                    : !canPurchase
                      ? 'Prices could not be loaded from the store. Your exact price and renewal terms are always shown by the store before any charge.'
                      : trialPromised
                        ? `${trialDays}-day free trial, then ${selectedLabel} ${selected.unit}. Auto-renews until cancelled; cancel at least 24 hours before it renews to avoid charges. Manage in your store account.`
                        : trialMentioned
                          ? `${selectedLabel} ${selected.unit}, auto-renewing until cancelled. New subscribers may be eligible for a ${trialDays}-day free trial - the store confirms your exact terms before you are charged. Cancel at least 24 hours before renewal to avoid charges.`
                          : `${selectedLabel} ${selected.unit}. Auto-renews until cancelled. Manage or cancel anytime in your store account.`}
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
    borderColor: CARD_BORDER,
    paddingHorizontal: scale(18),
    paddingTop: scale(16),
    paddingBottom: scale(16),
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
  // the PINNED region below it (plan selector, CTA, trust, footer, legal) stays
  // visible while the content (hero, benefits, pay-once row) scrolls internally.
  // That pinning is the redesign's core conversion move: the price is on screen
  // in every state, on every device height.
  scroll: { flexShrink: 1 },
  scrollContent: { paddingBottom: scale(4) },

  // Hero. Crest deliberately small (~half its old 84pt) - it signs the
  // headline instead of pushing the price below the fold.
  hero: { alignItems: 'center', paddingTop: scale(6), paddingBottom: scale(12) },
  crownWrap: { alignItems: 'center', justifyContent: 'center', marginBottom: scale(8) },
  crownGlow: {
    position: 'absolute',
    width: scale(66),
    height: scale(66),
    borderRadius: scale(33),
    backgroundColor: 'rgba(250, 204, 21, 0.18)',
  },
  crest: {
    width: scale(46),
    height: scale(46),
  },
  brand: { fontSize: fontScale(30), fontWeight: '900', color: TEXT, letterSpacing: 0.3 },
  brandPlus: { color: GOLD },
  tagline: { fontSize: fontScale(15), fontWeight: '600', color: TEXT_MUTED, marginTop: scale(3), textAlign: 'center' },

  // Benefits - a quiet card: neutral icon plates, hairline dividers, no chips,
  // no gold borders. Gold appears only in the small icons themselves.
  benefits: {
    backgroundColor: CARD_BG,
    borderRadius: scale(18),
    borderWidth: 1,
    borderColor: CARD_BORDER,
    paddingVertical: scale(4),
    paddingHorizontal: scale(12),
    marginBottom: scale(10),
  },
  benefitRow: { flexDirection: 'row', alignItems: 'center', gap: scale(11), paddingVertical: scale(8) },
  benefitRowDivider: { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)' },
  benefitIcon: {
    width: scale(30),
    height: scale(30),
    borderRadius: scale(10),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: ICON_BG,
  },
  benefitArt: { width: scale(22), height: scale(22) },
  benefitText: { flex: 1 },
  benefitTitle: { fontSize: fontScale(14.5), fontWeight: '700', color: TEXT },
  benefitDesc: { fontSize: fontScale(12), color: TEXT_MUTED, marginTop: scale(1) },
  plusLine: {
    fontSize: fontScale(12),
    color: TEXT_MUTED,
    textAlign: 'center',
    marginBottom: scale(10),
  },

  // Pay-once row - present but quiet; the subscription is the primary path.
  lifetimeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CARD_BG,
    borderRadius: scale(14),
    borderWidth: 1,
    borderColor: CARD_BORDER,
    paddingVertical: scale(10),
    paddingHorizontal: scale(14),
  },
  lifetimeCardSelected: { borderColor: GOLD, backgroundColor: 'rgba(250,204,21,0.07)' },
  lifetimeLeft: { flex: 1 },
  lifetimeTitle: { fontSize: fontScale(13.5), fontWeight: '700', color: TEXT },
  lifetimeSub: { fontSize: fontScale(11), color: TEXT_MUTED, marginTop: scale(1) },
  lifetimePrice: { fontSize: fontScale(16), fontWeight: '800', color: TEXT },

  message: { fontSize: fontScale(13), fontWeight: '700', color: TEXT, textAlign: 'center', marginTop: scale(12) },

  // Activation moment. Full four-sided border (Hard Rule #7 - no one-sided
  // accent stripes anywhere in the app).
  welcome: {
    marginTop: scale(4),
    backgroundColor: 'rgba(250, 204, 21, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(250, 204, 21, 0.38)',
    borderRadius: scale(16),
    padding: scale(14),
  },
  welcomeTitle: {
    fontSize: fontScale(16),
    fontWeight: '900',
    color: GOLD,
    textAlign: 'center',
  },
  welcomeSub: {
    fontSize: fontScale(12),
    color: TEXT_MUTED,
    textAlign: 'center',
    marginTop: scale(4),
    marginBottom: scale(10),
    lineHeight: fontScale(17),
  },
  welcomeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(8),
    paddingVertical: scale(3),
  },
  welcomeRowText: {
    fontSize: fontScale(13),
    fontWeight: '700',
    color: TEXT,
    flexShrink: 1,
  },

  // Plans - pinned. The price is the largest number on the sheet.
  plansRow: { flexDirection: 'row', gap: scale(10), marginTop: scale(10) },
  planCard: {
    flex: 1,
    backgroundColor: CARD_BG,
    borderRadius: scale(16),
    borderWidth: 1.5,
    borderColor: CARD_BORDER,
    paddingTop: scale(14),
    paddingBottom: scale(12),
    paddingHorizontal: scale(8),
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
  planPeriod: { fontSize: fontScale(12.5), fontWeight: '700', color: TEXT_MUTED, marginTop: scale(2) },
  planPrice: { fontSize: fontScale(26), fontWeight: '900', color: TEXT, marginTop: scale(3) },
  planUnit: { fontSize: fontScale(11), color: TEXT_MUTED, marginTop: scale(1) },
  planPerWeek: { fontSize: fontScale(12), fontWeight: '800', color: GOLD_SOFT, marginTop: scale(5) },
  planPerWeekMuted: { fontSize: fontScale(11), color: TEXT_DIM, marginTop: scale(5) },

  // CTA - the strongest visual element on the sheet, by design.
  cta: {
    marginTop: scale(12),
    backgroundColor: GOLD,
    borderRadius: scale(16),
    paddingVertical: scale(15),
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
  // Symmetric horizontal padding keeps the centered title/subtitle clear of the
  // absolutely-positioned chevron on the right (which occupies ~scale(34) of edge
  // space) on every screen width, so they never overlap.
  ctaText: { color: '#1A1206', fontSize: fontScale(18), fontWeight: '900', letterSpacing: 0.2, textAlign: 'center', paddingHorizontal: scale(34) },
  ctaSub: { color: 'rgba(26,18,6,0.72)', fontSize: fontScale(11.5), fontWeight: '700', marginTop: scale(2), textAlign: 'center', paddingHorizontal: scale(38) },
  ctaChevronWrap: { position: 'absolute', right: scale(14), top: 0, bottom: 0, justifyContent: 'center' },

  // Trust + footer - one quiet reassurance line, then the required links.
  trustRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: scale(5), marginTop: scale(10) },
  trustText: { fontSize: fontScale(11.5), fontWeight: '600', color: TEXT_MUTED },
  // flexWrap + horizontal padding: on narrow phones the four links ("Restore ·
  // Manage · Terms of Use · Privacy") overflow a single 390pt row and clip at
  // the sheet edges - wrapping to a second centred line keeps every link
  // reachable (Apple reviewers tap these).
  footerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    gap: scale(8),
    paddingHorizontal: scale(6),
    marginTop: scale(8),
  },
  footerLink: { fontSize: fontScale(12.5), fontWeight: '700', color: TEXT_MUTED },
  footerDivider: { fontSize: fontScale(12.5), color: TEXT_DIM },
  legal: { fontSize: fontScale(10.5), lineHeight: fontScale(14.5), color: TEXT_DIM, textAlign: 'center', marginTop: scale(8) },
});
