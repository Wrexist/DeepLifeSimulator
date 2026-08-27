import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, ScrollView, Animated, Easing } from 'react-native';
import { useGameSelector, shallowEqual } from '@/contexts/game/useGameSelector';
import { useMoneyActions } from '@/contexts/game/MoneyActionsContext';
import { useGameActions } from '@/contexts/game/GameActionsContext';
import { safeSettings } from '@/utils/safeGameState';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { X, Gem, Sparkles, Star, TrendingUp, RefreshCw, AlertCircle, ChevronRight } from 'lucide-react-native';
import BlurViewFallback from '@/components/fallbacks/BlurViewFallback';
import Gradient from '@/components/ui/Gradient';
import { scale, fontScale, responsiveBorderRadius, responsiveSpacing, verticalScale } from '@/utils/scaling';
import { iapService } from '@/services/IAPService';
import LoadingSpinner from '@/components/LoadingSpinner';
import DeepLifePlusUpsell from '@/components/DeepLifePlusUpsell';
import DailyGemClaim from '@/components/DailyGemClaim';
import {
  memberUpgradeCost,
  DEEP_LIFE_PLUS_UPGRADE_DISCOUNT,
  hasDeepLifePlusEntitlement,
} from '@/lib/subscription/deepLifePlus';
import { activeGemPromo, formatPromoCountdown } from '@/lib/shop/gemPromo';
import OfferCenterModal from '@/components/OfferCenterModal';
import { currentOffer } from '@/lib/offers';
import { IAP_PRODUCTS, getProductConfig, getProductDisplayMeta } from '@/utils/iapConfig';
// One art map, shared with the Offer Center. These paths used to be inlined
// here, which was fine while this was the only surface that rendered a product.
import { IAP_ART } from '@/utils/iapArt';
import { logger } from '@/utils/logger';
import ShopItemCard, { ShopBadge, ShopAccent } from '@/components/shop/ShopItemCard';
import { GEM_UPGRADES, type GemUpgradeId } from '@/lib/config/gemUpgrades';
import { gameAlert } from '@/utils/gameAlert';
import AlertHost from '@/components/ui/AlertHost';
import { track } from '@/lib/analytics';

/**
 * Presentation-only companions to the gem-upgrade catalogue (M8). Artwork and
 * ribbons are UI decisions, so they stay here; every id/name/description/price
 * comes from `GEM_UPGRADES`, which the reducer reads too.
 */
const UPGRADE_ART: Record<GemUpgradeId, ReturnType<typeof require>> = {
  multiplier: require('@/assets/images/iap/upgrades/money_multiplier.webp'),
  energy_boost: require('@/assets/images/iap/upgrades/energy_boost.webp'),
  happiness_boost: require('@/assets/images/iap/upgrades/happiness_boost.webp'),
  fitness_boost: require('@/assets/images/iap/upgrades/fitness_boost.webp'),
  skill_mastery: require('@/assets/images/iap/upgrades/skill_mastery.webp'),
  time_machine: require('@/assets/images/iap/upgrades/time_machine.webp'),
  immortality: require('@/assets/images/iap/upgrades/immortality.webp'),
  tycoon: require('@/assets/images/iap/upgrades/money_multiplier.webp'),
  chronomaster: require('@/assets/images/iap/upgrades/time_machine.webp'),
};

const UPGRADE_RIBBON: Partial<Record<GemUpgradeId, string>> = {
  multiplier: 'Most Popular',
  immortality: 'Ultimate',
  tycoon: 'Prestige',
  chronomaster: 'Prestige',
};

const LinearGradient = Gradient;

// Entrance motion mirrors the shared house tokens (src/utils/animated MOTION):
// a short slide-up + fade on an ease-out curve, kept under the 300ms UI budget.
// Easing is resolved defensively so the render-test RN mock (no native Easing)
// can't crash at load - same pattern as components/ConfirmDialog.tsx.
const ENTER_TRANSLATE = 22;
const DURATION_BASE = 260;
const DURATION_FAST = 150;
const EASE_OUT = Easing?.bezier ? Easing.bezier(0.23, 1, 0.32, 1) : undefined;

// Truthful gem value badge (best gems-per-$) and the config-claimed popularity badge.
const BADGE_BEST = '#FBBF24';
const BADGE_POPULAR = '#A5B4FC';

type StoreTab = 'upgrades' | 'store' | 'perks' | 'gems';

interface GemShopModalProps {
  visible: boolean;
  onClose: () => void;
  /** Tab to land on when the store opens (deep-linked entry points pass this). */
  initialTab?: StoreTab;
  /**
   * Product whose purchase confirm should open as soon as the catalog is
   * ready (the death screen's Revival Pack row). Goes through the SAME
   * `handlePurchase` every Buy button uses - availability gating, localized
   * pricing and the transaction flow are unchanged.
   */
  initialPurchaseId?: string;
}

// Parse a USD price string ("$4.99") into a number. This is the CONFIG-USD
// anchor: a stable reference used for (a) the Best-Value ranking fallback and
// (b) the value line ONLY when no live store price is available (dev / store
// not configured), in which case the price shown on the card is also the config
// USD price, so a "$" ratio is consistent. The live, currency-honest ratio comes
// from storePriceInfo() below when the SDK exposes a real numeric price.
function usdToNumber(price?: string): number {
  const n = parseFloat(String(price ?? '').replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

// Compact symbols for the storefront currencies we can render inline; any other
// ISO 4217 code is shown verbatim (e.g. "per 1 SEK").
const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$', EUR: '€', GBP: '£', JPY: '¥', CAD: '$', AUD: '$',
  NZD: '$', CNY: '¥', INR: '₹', KRW: '₩', BRL: 'R$', RUB: '₽',
};

// Extract a NUMERIC price + ISO currency from a loaded store product, if the
// SDK actually exposed them. The legacy adapter (services/expoIapAdapter.ts)
// stringifies `price` for display, so a clean numeric is NOT guaranteed - return
// null unless we can read a finite, positive amount AND a currency code. When
// this returns a value the UI can label the ratio in the REAL storefront
// currency instead of a fabricated "$"; when it returns null the UI omits the
// per-currency ratio for a store-loaded product (a localized price may not be USD).
function storePriceInfo(product: any): { amount: number; currency: string } | null {
  if (!product) return null;
  const rawAmount =
    typeof product.priceAmount === 'number' ? product.priceAmount
    : typeof product.price === 'number' ? product.price
    : NaN;
  const currency =
    typeof product.currency === 'string' ? product.currency
    : typeof product.currencyCode === 'string' ? product.currencyCode
    : typeof product.priceCurrencyCode === 'string' ? product.priceCurrencyCode
    : '';
  if (!Number.isFinite(rawAmount) || rawAmount <= 0 || !currency) return null;
  return { amount: rawAmount, currency };
}

// "≈ 300 gems per €1" (known symbol) or "≈ 300 gems per 1 SEK" (ISO fallback).
function storeRatioLine(gems: number, amount: number, currency: string): string {
  const perUnit = Math.round(gems / amount).toLocaleString();
  const symbol = CURRENCY_SYMBOLS[currency];
  return symbol ? `≈ ${perUnit} gems per ${symbol}1` : `≈ ${perUnit} gems per 1 ${currency}`;
}

function GemShopModal({ visible, onClose, initialTab, initialPurchaseId }: GemShopModalProps) {
  const { buyGoldUpgrade } = useMoneyActions();
  const { saveGame } = useGameActions();
  const settings = useGameSelector((s) => safeSettings(s), shallowEqual);
  // MON-5: whether a Revival Pack CHARGE is currently banked. Distinct from
  // `settings.hasRevivalPack`, which records the purchase and never clears.
  const revivalCharged = useGameSelector((s) => s.revivalPack === true);
  const goldUpgrades = useGameSelector((s) => s.goldUpgrades);
  const perks = useGameSelector((s) => s.perks);
  const gems = useGameSelector((s) => s.stats?.gems ?? 0);

  const [tab, setTab] = useState<StoreTab>(initialTab ?? 'gems');
  // Scoped so ONLY the pressed product shows "Processing…" (not every button),
  // and Restore has its own state. `iapBusy` still locks all controls while any
  // operation is in flight so two purchases can't overlap.
  const [purchasingId, setPurchasingId] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(false);
  const iapBusy = purchasingId !== null || restoring;
  const [iapState, setIapState] = useState(() => iapService.getState());

  const reducedMotion = useReducedMotion();

  // Deep-linked entry points (death popup, out-of-gems bridges) retarget the
  // tab each time the store opens; manual tab taps while open are untouched.
  useEffect(() => {
    if (visible && initialTab) setTab(initialTab);
  }, [visible, initialTab]);

  // Reflect the store's live connection/catalog so buy buttons can degrade to a
  // clear "Store unavailable" state instead of failing on tap. Presentation only
  // - no transaction logic here; the app initializes IAP at startup.
  useEffect(() => {
    setIapState(iapService.getState());
    const unsubscribe = iapService.addListener((s) => setIapState(s));
    return unsubscribe;
  }, []);

  // Slide-up + fade entrance (respecting Reduce Motion).
  const progress = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!visible) {
      progress.setValue(0);
      return;
    }
    progress.setValue(reducedMotion ? 1 : 0);
    const anim = Animated.timing(progress, {
      toValue: 1,
      duration: reducedMotion ? DURATION_FAST : DURATION_BASE,
      easing: EASE_OUT,
      useNativeDriver: true,
    });
    anim.start();
    return () => anim.stop();
  }, [visible, reducedMotion, progress]);

  const sheetTranslate = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [verticalScale(ENTER_TRANSLATE), 0],
  });

  // True only when the store connected AND a non-empty catalog loaded - mirrors
  // iapService.isStoreAvailable(), but read from local state so the UI re-renders
  // when the catalog finishes loading.
  const storeReady = iapState.isConnected && iapState.products.length > 0;

  const productsById = useMemo(() => {
    const map = new Map<string, any>();
    for (const p of iapState.products) {
      if (p && p.productId) map.set(p.productId, p);
    }
    return map;
  }, [iapState.products]);

  // ── Funnel events: the consumable-IAP funnel used to begin at
  // `purchase_started`, so shop view → buy tap (its largest drop) was
  // unmeasurable. One view per open with the tab it opened to; one dismissal
  // with dwell + the tab the player LEFT from.
  //
  // Fired on MOUNT / UNMOUNT, not on a `visible` transition. The sole mount
  // site (contexts/GemStoreContext) renders `<GemShopModal visible ... />`
  // only while `openTab !== null` and unmounts it on close - `visible` is a
  // literal `true` that never flips, so a visible-keyed dismissal would never
  // fire. Empty deps also mean a deep-link retarget of `initialTab` on the
  // live instance cannot double-fire the view. `tabRef` (updated in its own
  // effect, never in render) carries the exit tab into the unmount cleanup.
  const shopOpenedAt = useRef(0);
  const tabRef = useRef(tab);
  useEffect(() => {
    tabRef.current = tab;
  }, [tab]);
  useEffect(() => {
    if (!visible) return;
    shopOpenedAt.current = Date.now();
    track('iap_shop_viewed', { tab: initialTab ?? 'gems', storeReady });
    return () => {
      if (shopOpenedAt.current === 0) return;
      track('iap_shop_dismissed', {
        tab: tabRef.current,
        dwellMs: Date.now() - shopOpenedAt.current,
      });
      shopOpenedAt.current = 0;
    };
    // Mount/unmount only: `initialTab` and `storeReady` are view-time
    // snapshots, deliberately not triggers.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Per-SKU availability: an IAP is buyable only if THIS product id actually
  // loaded from the store. `storeReady` (any product loaded) still drives the
  // global banner, but a mixed catalog - most SKUs loaded, one missing - must
  // not present a buyable button for the missing one on a config-price fallback.
  // Gem-SPEND upgrades (handleBuyUpgrade) are not IAPs and are never gated here.
  const isProductAvailable = (id: string): boolean => productsById.has(id);

  // Prefer the store SDK's localized price; fall back to the config USD price.
  const resolveDisplayPrice = (id: string): string => {
    const p = productsById.get(id);
    const localized = p?.displayPrice ?? p?.localizedPrice ?? p?.price;
    if (typeof localized === 'string' && localized.trim().length > 0) return localized;
    return getProductConfig(id)?.price ?? '';
  };

  // Currency-honest value line for a gem pack:
  //  • live store price (numeric + currency) → ratio in the REAL storefront currency
  //  • no store product loaded → the price shown is the config USD price, so a USD
  //    ratio is consistent with the card (dev / store-not-configured fallback)
  //  • store product present but no numeric price (localized-only) → OMIT, since a
  //    "$" ratio next to a possibly-non-USD localized price would mislead.
  const gemValueLine = (id: string, gems: number, perDollarConfig: number): string | undefined => {
    const product = productsById.get(id);
    const info = storePriceInfo(product);
    if (info) return storeRatioLine(gems, info.amount, info.currency);
    if (!product) {
      return perDollarConfig > 0 ? `≈ ${Math.round(perDollarConfig).toLocaleString()} gems / $1` : undefined;
    }
    return undefined;
  };

  // Real-money CTA label - the real price is unmistakable on every buy button.
  const buyLabel = (id: string, owned: boolean, displayPrice: string, available: boolean, ownedLabel?: string): string => {
    if (owned) return ownedLabel ?? 'Owned';
    if (!available) return 'Unavailable';
    if (purchasingId === id) return 'Processing…';
    return displayPrice ? `Buy · ${displayPrice}` : 'Buy';
  };

  const ctaA11y = (id: string, name: string, displayPrice: string, owned: boolean, available: boolean, ownedLabel?: string): string => {
    if (owned) return ownedLabel ? `${name}, ${ownedLabel.toLowerCase()}` : `${name}, already owned`;
    if (!available) return `${name}, unavailable`;
    if (purchasingId === id) return `Purchasing ${name}, please wait`;
    return `Buy ${name}${displayPrice ? ` for ${displayPrice}` : ''}`;
  };

  // The five-tier gem ladder with a per-pack gems-per-$ value (computed from the
  // REAL gemAmount / USD price). The truthfully-best gems-per-$ pack earns the
  // "Best Value" badge - not whatever the config's stale bestValue flag claims.
  const gemPacks = useMemo(() => {
    const base = [
      { id: IAP_PRODUCTS.GEMS_100, gems: 100, image: IAP_ART[IAP_PRODUCTS.GEMS_100] },
      { id: IAP_PRODUCTS.GEMS_500, gems: 500, image: IAP_ART[IAP_PRODUCTS.GEMS_500] },
      { id: IAP_PRODUCTS.GEMS_1000, gems: 1000, image: IAP_ART[IAP_PRODUCTS.GEMS_1000] },
      { id: IAP_PRODUCTS.GEMS_5000, gems: 5000, image: IAP_ART[IAP_PRODUCTS.GEMS_5000] },
      { id: IAP_PRODUCTS.GEMS_15000, gems: 15000, image: IAP_ART[IAP_PRODUCTS.GEMS_15000] },
      { id: IAP_PRODUCTS.GEMS_50000, gems: 50000, image: IAP_ART[IAP_PRODUCTS.GEMS_50000] },
    ];
    return base.map((p) => {
      const usd = usdToNumber(getProductConfig(p.id)?.price);
      return { ...p, perDollar: usd > 0 ? p.gems / usd : 0 };
    });
  }, []);

  // Best gems-per-money pack earns the badge. Relative ranking is CURRENCY-
  // INVARIANT: every SKU is sold in the same storefront currency, so whichever
  // pack gives the most gems per unit wins regardless of which currency that unit
  // is. We rank by the config USD ratio by default; when the store exposes a
  // numeric price for EVERY pack we rank by those live prices instead (still a
  // like-for-like comparison, same storefront currency).
  const bestGemId = useMemo(() => {
    const priced = gemPacks.map((p) => {
      const info = storePriceInfo(productsById.get(p.id));
      return { id: p.id, storeRatio: info ? p.gems / info.amount : null, configRatio: p.perDollar };
    });
    const allPriced = priced.length > 0 && priced.every((p) => p.storeRatio !== null);
    const ratioOf = (p: (typeof priced)[number]) =>
      allPriced && p.storeRatio !== null ? p.storeRatio : p.configRatio;
    return priced.reduce((best, p) => (ratioOf(p) > ratioOf(best) ? p : best), priced[0]).id;
  }, [gemPacks, productsById]);
  const bestGem = useMemo(
    () => gemPacks.find((p) => p.id === bestGemId) ?? gemPacks[gemPacks.length - 1],
    [gemPacks, bestGemId],
  );

  // Confirm step + purchase. Transaction logic is unchanged - presentation only.
  const handlePurchase = async (id: string, name: string, displayPrice: string) => {
    if (iapBusy) {
      gameAlert('Please Wait', 'Another purchase is in progress. Please wait for it to complete.');
      return;
    }
    // Refuse before touching iapService when THIS SKU didn't load - its price on
    // the card is a config fallback, not a real store price, so it isn't buyable.
    if (!isProductAvailable(id)) {
      gameAlert(
        'Item Unavailable',
        'This item isn’t available right now. Please check your connection and try again in a moment.',
      );
      return;
    }

    const priceText = displayPrice || resolveDisplayPrice(id);

    gameAlert(
      'Confirm Purchase',
      `Buy ${name}${priceText ? ` for ${priceText}` : ''}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: priceText ? `Buy ${priceText}` : 'Buy',
          onPress: async () => {
            setPurchasingId(id);
            try {
              logger.info(`Attempting to purchase: ${id} (${name})`);
              const result = await iapService.purchaseProduct(id);
              if (result.success) {
                // IAPService already applies benefits - do not re-apply here.
                //
                // A deep-linked buy (the death screen's Revival Pack row) came
                // here to get ONE thing. Leaving the player parked in the shop
                // afterwards makes them find their own way back to the screen
                // that sent them - and for a revive that screen is the one
                // with the button that spends it. So close the sheet, but only
                // once they have ACKNOWLEDGED the receipt: this sheet hosts
                // the alert (nested AlertHost), so unmounting it while the
                // message is still up would take the message with it.
                const returnAfter = id === initialPurchaseId;
                gameAlert(
                  'Purchase Successful!',
                  result.message || 'Purchase completed! Your items have been added to your account.',
                  returnAfter ? [{ text: 'OK', style: 'default', onPress: onClose }] : undefined,
                );
              } else {
                const errorMessage = result.message || 'Unable to complete purchase. Please try again.';
                if (!errorMessage.includes('cancelled')) {
                  gameAlert('Purchase Failed', errorMessage);
                }
              }
            } catch (error) {
              logger.error('Purchase error:', error);
              let errorMsg = 'An unexpected error occurred during purchase.';
              if (error instanceof Error) {
                errorMsg = error.message;
              }
              gameAlert('Error', `${errorMsg}\n\nPlease try again or contact support if the problem persists.`);
            } finally {
              setPurchasingId(null);
            }
          },
        },
      ],
    );
  };

  // Deep-linked purchase target (e.g. the death screen's Revival Pack row):
  // open the standard confirm for that SKU, exactly as if the player had
  // tapped its Buy button. Two gates before it fires. `storeReady`: a slow
  // catalog load must not turn a real product into a premature "Item
  // Unavailable" (and if the store never loads, the tab banner already
  // explains why nothing is buyable). `sheetShown` (the Modal's onShow, i.e.
  // presentation COMPLETE): the confirm is a Modal nested inside this sheet,
  // and iOS refuses a presentation from a view controller whose own
  // presentation is still animating - firing at mount would eat the dialog.
  // At most once per open; the modal unmounts on close, so a ref is the guard.
  const [sheetShown, setSheetShown] = useState(false);
  const autoPurchaseFiredRef = useRef(false);
  useEffect(() => {
    if (!visible || !initialPurchaseId || !storeReady || !sheetShown) return;
    if (autoPurchaseFiredRef.current) return;
    autoPurchaseFiredRef.current = true;
    const name = getProductConfig(initialPurchaseId)?.name ?? initialPurchaseId;
    void handlePurchase(initialPurchaseId, name, resolveDisplayPrice(initialPurchaseId));
    // handlePurchase/resolveDisplayPrice are stable-by-construction inline
    // helpers; the ref (not the dep list) is what makes this once-per-open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, initialPurchaseId, storeReady, sheetShown]);

  // Gem-spend upgrades (in-game currency, NOT an IAP).
  const handleBuyUpgrade = async (id: string, price: number) => {
    if (gems < price) {
      gameAlert('Insufficient Gems', 'You need more gems to purchase this upgrade.');
      return;
    }
    const isOwned = goldUpgrades?.[id as keyof typeof goldUpgrades];
    if (isOwned) {
      gameAlert('Already Owned', 'You already own this upgrade.');
      return;
    }
    // M8: only claim success when the reducer says it APPLIED. This used to
    // alert "Purchase Successful" unconditionally, because `buyGoldUpgrade`
    // returned void - so a refusal (already owned / too few gems, decided
    // against fresher state than the two gates above read) still told the
    // player their gems had bought something. `buyGoldUpgrade` surfaces the
    // specific reason itself via `showError`, so there is nothing to alert here
    // on refusal.
    if (!buyGoldUpgrade(id)) return;
    // The upgrade commits to game state synchronously here. Persisting can still
    // reject (disk/quota) - swallow it into a clear message rather than letting
    // it bubble as an unhandled rejection. Do NOT claim the purchase failed: the
    // state change stands, and the periodic autosave will retry the write.
    try {
      await saveGame();
      gameAlert('Purchase Successful', 'Your upgrade has been activated!');
    } catch (error) {
      logger.error('Failed to save after gem upgrade purchase:', error);
      gameAlert(
        'Purchase Successful',
        'Your upgrade has been activated. We couldn’t save just now, but it will be saved automatically in a moment.',
      );
    }
  };

  const handleRestorePurchases = async () => {
    if (iapBusy) {
      gameAlert('Please Wait', 'A purchase operation is already in progress.');
      return;
    }
    setRestoring(true);
    try {
      logger.info('Starting purchase restoration...');
      const { success, restoredCount } = await iapService.restorePurchases();
      if (success) {
        await iapService.loadPurchases();
        // Say HOW MANY. Reporting bare success on a restore that restored
        // nothing is what made a genuinely-empty restore indistinguishable from
        // a working one. 2026-07-30 audit MON-11.
        gameAlert(
          'Purchases Restored',
          `Restored ${restoredCount} purchase${restoredCount === 1 ? '' : 's'}.`,
          [{ text: 'OK', style: 'default' }],
        );
      } else {
        gameAlert(
          'Nothing To Restore',
          'No previous purchases were found for this Apple ID. If you bought something on another account, sign in to that one and try again.',
          [{ text: 'OK', style: 'default' }],
        );
      }
    } catch (error) {
      logger.error('Restore purchases error:', error);
      gameAlert('Restore Failed', 'Unable to restore purchases. Please try again or contact support.', [
        { text: 'OK', style: 'default' },
      ]);
    } finally {
      setRestoring(false);
    }
  };

  // ─── Card renderers ───

  const renderGemPackCard = (p: (typeof gemPacks)[number]) => {
    const config = getProductConfig(p.id);
    const displayPrice = resolveDisplayPrice(p.id);
    const available = isProductAvailable(p.id);
    const name = config?.name ?? `${p.gems.toLocaleString()} Gems`;
    const badges: ShopBadge[] = [];
    if (p.id === bestGemId) badges.push({ label: 'Best Value', color: BADGE_BEST });
    if (config?.popular === true) badges.push({ label: 'Most Popular', color: BADGE_POPULAR });
    // "Value climbs with the tier": honest +X% more gems-per-$ vs the smallest
    // pack, appended to the ratio line so bigger packs read as the better deal.
    const baseValueLine = gemValueLine(p.id, p.gems, p.perDollar);
    const smallestPerDollar = gemPacks[0]?.perDollar ?? 0;
    const bonusPct =
      smallestPerDollar > 0 && p.perDollar > smallestPerDollar
        ? Math.round((p.perDollar / smallestPerDollar - 1) * 100)
        : 0;
    const valueLine =
      baseValueLine && bonusPct >= 5 ? `${baseValueLine} · +${bonusPct}% more per $` : baseValueLine;
    return (
      <ShopItemCard
        key={p.id}
        accent="gems"
        image={p.image}
        title={name}
        description={`${p.gems.toLocaleString()} gems`}
        priceLabel={displayPrice}
        priceKind="money"
        valueLine={valueLine}
        badges={badges}
        buttonText={buyLabel(p.id, false, displayPrice, available)}
        accessibilityLabel={ctaA11y(p.id, name, displayPrice, false, available)}
        onPress={() => handlePurchase(p.id, name, displayPrice)}
        locked={!available || iapBusy}
      />
    );
  };

  const renderHero = (item: {
    id: string;
    accent: ShopAccent;
    image: any;
    title: string;
    description: string;
    features?: string[];
    valueLine?: string;
    badges?: ShopBadge[];
    owned: boolean;
    /** Replaces the word "Owned" on the CTA. See the Revival Pack entry. */
    ownedLabel?: string;
  }) => {
    const displayPrice = resolveDisplayPrice(item.id);
    const available = isProductAvailable(item.id);
    return (
      <ShopItemCard
        key={`hero-${item.id}`}
        variant="hero"
        accent={item.accent}
        image={item.image}
        title={item.title}
        description={item.description}
        features={item.features}
        valueLine={item.valueLine}
        priceLabel={displayPrice}
        priceKind="money"
        badges={item.badges}
        owned={item.owned}
        buttonText={buyLabel(item.id, item.owned, displayPrice, available, item.ownedLabel)}
        accessibilityLabel={ctaA11y(item.id, item.title, displayPrice, item.owned, available, item.ownedLabel)}
        onPress={() => handlePurchase(item.id, item.title, displayPrice)}
        locked={!available || iapBusy || item.owned}
      />
    );
  };

  const renderMoneyCard = (item: {
    id: string;
    accent: ShopAccent;
    image: any;
    title: string;
    owned?: boolean;
    badges?: ShopBadge[];
  }) => {
    const config = getProductConfig(item.id);
    const displayPrice = resolveDisplayPrice(item.id);
    const owned = item.owned === true;
    const available = isProductAvailable(item.id);
    return (
      <ShopItemCard
        key={item.id}
        accent={item.accent}
        image={item.image}
        title={item.title}
        description={config?.description ?? ''}
        features={getProductDisplayMeta(item.id).contents}
        priceLabel={displayPrice}
        priceKind="money"
        badges={item.badges}
        owned={owned}
        buttonText={buyLabel(item.id, owned, displayPrice, available)}
        accessibilityLabel={ctaA11y(item.id, item.title, displayPrice, owned, available)}
        onPress={() => handlePurchase(item.id, item.title, displayPrice)}
        locked={!available || iapBusy || owned}
      />
    );
  };

  const renderUpgradeCard = (item: {
    id: string;
    name: string;
    description: string;
    price: number;
    image: any;
    owned: boolean;
    featured?: string;
  }) => {
    // DeepLife+ members pay 20% less - same helper the reducer charges with.
    const cost = memberUpgradeCost(item.price, settings);
    const discounted = cost < item.price;
    const afford = gems >= cost;
    // Single badge only - the card reserves limited top-right space, so two
    // badges collide with the title. A featured tag (e.g. "Most Popular") leads
    // when present; otherwise "Permanent" reassures it's a one-time buy (and the
    // tab footnote already says every upgrade is permanent).
    const badges: ShopBadge[] = [
      item.featured
        ? { label: item.featured, color: BADGE_BEST }
        : { label: 'Permanent', color: BADGE_POPULAR },
    ];
    // Show the member saving honestly: discounted price + "was X · DeepLife+ 20% off".
    const valueLine = discounted
      ? `DeepLife+ · ${Math.round(DEEP_LIFE_PLUS_UPGRADE_DISCOUNT * 100)}% off (was ${item.price.toLocaleString()})`
      : undefined;
    const buttonText = item.owned ? 'Owned' : afford ? 'Redeem' : 'Not enough gems';
    return (
      <ShopItemCard
        key={item.id}
        accent="upgrades"
        image={item.image}
        title={item.name}
        description={item.description}
        priceLabel={cost.toLocaleString()}
        priceKind="gems"
        valueLine={valueLine}
        badges={badges}
        buttonText={buttonText}
        accessibilityLabel={
          item.owned
            ? `${item.name}, already owned`
            : `${item.name}, costs ${cost.toLocaleString()} gems`
        }
        onPress={() => handleBuyUpgrade(item.id, cost)}
        owned={item.owned}
        // `iapBusy` matches the IAP cards on this same screen: while a store
        // purchase or a Restore is in flight the whole shop is locked, so a gem
        // spend can't race an entitlement change mid-transaction.
        locked={(!afford && !item.owned) || iapBusy}
      />
    );
  };

  // ─── Data ───

  // Honest value line for the featured best-value gem hero (real currency when
  // the store exposes a numeric price; config-$ fallback only when unloaded).
  const bestGemValueLine = gemValueLine(bestGem.id, bestGem.gems, bestGem.perDollar);

  const featured = [
    {
      id: bestGem.id,
      accent: 'gems' as ShopAccent,
      image: bestGem.image,
      title: getProductConfig(bestGem.id)?.name ?? `${bestGem.gems.toLocaleString()} Gems`,
      description: `${bestGem.gems.toLocaleString()} gems - the best gem value in the store.`,
      valueLine: bestGemValueLine ? `Best value · ${bestGemValueLine}` : undefined,
      badges: [{ label: 'Best Value', color: BADGE_BEST }] as ShopBadge[],
      owned: false,
    },
    {
      id: IAP_PRODUCTS.REMOVE_ADS,
      accent: 'perks' as ShopAccent,
      image: IAP_ART[IAP_PRODUCTS.REMOVE_ADS],
      title: 'Remove Ads',
      description: getProductConfig(IAP_PRODUCTS.REMOVE_ADS)?.description ?? 'Ad-free gaming forever.',
      features: getProductDisplayMeta(IAP_PRODUCTS.REMOVE_ADS).contents,
      badges: [] as ShopBadge[],
      owned: settings?.adsRemoved === true,
    },
    {
      id: IAP_PRODUCTS.LIFETIME_PREMIUM,
      accent: 'packs' as ShopAccent,
      image: IAP_ART[IAP_PRODUCTS.LIFETIME_PREMIUM],
      title: 'Lifetime Premium',
      description: getProductConfig(IAP_PRODUCTS.LIFETIME_PREMIUM)?.description ?? 'No ads, all future updates.',
      features: getProductDisplayMeta(IAP_PRODUCTS.LIFETIME_PREMIUM).contents,
      badges: [] as ShopBadge[],
      owned: settings?.lifetimePremium === true,
    },
  ];

  const bundles = [
    {
      id: IAP_PRODUCTS.GEMS_STARTER,
      accent: 'packs' as ShopAccent,
      image: IAP_ART[IAP_PRODUCTS.GEMS_STARTER],
      title: 'Starter Pack',
      badges: getProductConfig(IAP_PRODUCTS.GEMS_STARTER)?.popular
        ? ([{ label: 'Most Popular', color: BADGE_POPULAR }] as ShopBadge[])
        : undefined,
    },
    {
      id: IAP_PRODUCTS.GEMS_PREMIUM,
      accent: 'packs' as ShopAccent,
      image: IAP_ART[IAP_PRODUCTS.GEMS_PREMIUM],
      title: 'Premium Pack',
      badges: getProductConfig(IAP_PRODUCTS.GEMS_PREMIUM)?.popular
        ? ([{ label: 'Most Popular', color: BADGE_POPULAR }] as ShopBadge[])
        : undefined,
    },
    {
      id: IAP_PRODUCTS.GEMS_ULTIMATE,
      accent: 'packs' as ShopAccent,
      image: IAP_ART[IAP_PRODUCTS.GEMS_ULTIMATE],
      title: 'Ultimate Pack',
      badges: undefined,
    },
    {
      id: IAP_PRODUCTS.GEMS_MEGA,
      accent: 'packs' as ShopAccent,
      image: IAP_ART[IAP_PRODUCTS.GEMS_MEGA],
      title: 'Mega Pack',
      badges: undefined,
    },
  ];

  const storeItems = [
    {
      id: IAP_PRODUCTS.YOUTH_PILL_SINGLE,
      accent: 'packs' as ShopAccent,
      image: IAP_ART[IAP_PRODUCTS.YOUTH_PILL_SINGLE],
      title: 'Youth Pill',
    },
    {
      id: IAP_PRODUCTS.YOUTH_PILL_PACK,
      accent: 'packs' as ShopAccent,
      image: IAP_ART[IAP_PRODUCTS.YOUTH_PILL_PACK],
      title: 'Youth Pill Pack (5×)',
    },
    {
      id: IAP_PRODUCTS.MONEY_BOOST,
      accent: 'packs' as ShopAccent,
      image: IAP_ART[IAP_PRODUCTS.MONEY_BOOST],
      title: 'Money Boost',
    },
    {
      id: IAP_PRODUCTS.SKILL_BOOST,
      accent: 'packs' as ShopAccent,
      image: IAP_ART[IAP_PRODUCTS.SKILL_BOOST],
      title: 'Skill Boost',
    },
  ];

  // All FOUR perks the bundle grants - `mindset` was missing, though the
  // Mindset row two entries below reads the very same field. A player who had
  // bought Work Pay Boost, Fast Learner and Good Credit individually saw the
  // $6.99 bundle labelled "Owned" with a greyed-out, untappable button, so the
  // store claimed they owned all perks when they did not, and the cheapest
  // route to Mindset could not be purchased. 2026-07-30 audit UX-2.
  const allPerksOwned = Boolean(
    perks?.workBoost && perks?.mindset && perks?.fastLearner && perks?.goodCredit,
  );
  const perkItems = [
    {
      id: IAP_PRODUCTS.UNLOCK_ALL_PERKS,
      accent: 'perks' as ShopAccent,
      image: IAP_ART[IAP_PRODUCTS.UNLOCK_ALL_PERKS],
      title: 'Unlock All Perks',
      owned: allPerksOwned,
      badges: [{ label: 'Best Value', color: BADGE_BEST }] as ShopBadge[],
    },
    {
      id: IAP_PRODUCTS.WORK_BOOST,
      accent: 'perks' as ShopAccent,
      image: IAP_ART[IAP_PRODUCTS.WORK_BOOST],
      title: 'Work Pay Boost',
      owned: perks?.workBoost === true,
    },
    {
      id: IAP_PRODUCTS.MINDSET,
      accent: 'perks' as ShopAccent,
      image: IAP_ART[IAP_PRODUCTS.MINDSET],
      title: 'Mindset',
      owned: perks?.mindset === true,
    },
    {
      id: IAP_PRODUCTS.FAST_LEARNER,
      accent: 'perks' as ShopAccent,
      image: IAP_ART[IAP_PRODUCTS.FAST_LEARNER],
      title: 'Fast Learner',
      owned: perks?.fastLearner === true,
    },
    {
      id: IAP_PRODUCTS.GOOD_CREDIT,
      accent: 'perks' as ShopAccent,
      image: IAP_ART[IAP_PRODUCTS.GOOD_CREDIT],
      title: 'Good Credit Score',
      owned: perks?.goodCredit === true,
    },
    {
      id: IAP_PRODUCTS.REMOVE_ADS,
      accent: 'perks' as ShopAccent,
      image: IAP_ART[IAP_PRODUCTS.REMOVE_ADS],
      title: 'Remove Ads',
      owned: settings?.adsRemoved === true,
    },
    {
      id: IAP_PRODUCTS.REVIVAL_PACK,
      accent: 'perks' as ShopAccent,
      image: IAP_ART[IAP_PRODUCTS.YOUTH_PILL_SINGLE],
      title: 'Revival Pack',
      owned: settings?.hasRevivalPack === true,
      // The pack is a NON-CONSUMABLE, so once bought it can never be bought
      // again - "Owned" is accurate but says nothing about whether a charge is
      // left. After the revive is spent that reads as though the player still
      // has one. "Ready" / "Used" tells the truth without pretending the
      // product can be repurchased.
      ownedLabel: revivalCharged ? 'Ready' : 'Used',
    },
    {
      id: IAP_PRODUCTS.LIFETIME_PREMIUM,
      accent: 'perks' as ShopAccent,
      image: IAP_ART[IAP_PRODUCTS.LIFETIME_PREMIUM],
      title: 'Lifetime Premium',
      owned: settings?.lifetimePremium === true,
    },
  ];

  // The four banking services. They have always had full fulfilment, restore
  // and prestige survival (lib/prestige/accountEntitlements.ts) - and, until
  // 2026-08-26, no purchase UI anywhere: ~$21 of shipped App Store catalog
  // that could not be bought. (Private Banking alone was reachable one
  // rotation week in twelve through the Offer Center.) Owned flags read the
  // same settings keys applyProductBenefitsToState writes; the Mega Pack's
  // "everything unlocked" also grants all four, so its owners see Owned here.
  // No dedicated art yet - ShopItemCard renders without a picture rather than
  // borrowing a misleading one (see utils/iapArt.ts).
  const bankingItems = [
    {
      id: IAP_PRODUCTS.PREMIUM_CREDIT_CARD,
      accent: 'perks' as ShopAccent,
      image: IAP_ART[IAP_PRODUCTS.PREMIUM_CREDIT_CARD],
      title: 'Premium Credit Card',
      owned: settings?.premiumCreditCard === true,
    },
    {
      id: IAP_PRODUCTS.FINANCIAL_PLANNING,
      accent: 'perks' as ShopAccent,
      image: IAP_ART[IAP_PRODUCTS.FINANCIAL_PLANNING],
      title: 'Financial Planning',
      owned: settings?.financialPlanning === true,
    },
    {
      id: IAP_PRODUCTS.BUSINESS_BANKING,
      accent: 'perks' as ShopAccent,
      image: IAP_ART[IAP_PRODUCTS.BUSINESS_BANKING],
      title: 'Business Banking',
      owned: settings?.businessBanking === true,
    },
    {
      id: IAP_PRODUCTS.PRIVATE_BANKING,
      accent: 'perks' as ShopAccent,
      image: IAP_ART[IAP_PRODUCTS.PRIVATE_BANKING],
      title: 'Private Banking',
      owned: settings?.privateBanking === true,
    },
  ];

  // M8: names, descriptions and prices come from the ONE catalogue in
  // `lib/config/gemUpgrades.ts`, which `MoneyActionsContext.buyGoldUpgrade`
  // also reads - so the price shown here and the price charged cannot drift.
  // Only genuinely presentational data (artwork, ribbons) is mapped in here.
  const upgrades = GEM_UPGRADES.map((u) => ({
    id: u.id,
    name: u.name,
    description: u.description,
    price: u.cost,
    image: UPGRADE_ART[u.id],
    owned: Boolean(goldUpgrades?.[u.id]),
    featured: UPGRADE_RIBBON[u.id],
  }));

  // "Short on gems?" bridge: if the player can't afford the cheapest upgrade they
  // don't already own (member price), offer a one-tap jump to the Gems tab.
  const cheapestUnownedUpgrade = upgrades
    .filter((u) => !u.owned)
    .reduce((min, u) => Math.min(min, memberUpgradeCost(u.price, settings)), Infinity);
  const shortOnGemsForUpgrades = Number.isFinite(cheapestUnownedUpgrade) && gems < cheapestUnownedUpgrade;

  // An honest limited-time promo (ships disabled - nothing renders until a real
  // store offer is configured; see lib/shop/gemPromo.ts).
  const gemPromo = activeGemPromo(new Date());
  const gemPromoCountdown = gemPromo ? formatPromoCountdown(new Date(), gemPromo.endsAtIso) : '';

  // The RECURRING weekly rotation, distinct from `gemPromo` above (which is the
  // manual, ships-disabled one-off - see the note in `lib/offers/types.ts`).
  // Only the offer's NAME is read here; every price lives inside the Offer
  // Center, where `resolveOfferPrice` can refuse to claim a discount it cannot
  // prove. A name is safe to render without a loaded store product; a price is
  // not.
  const [showOfferCenter, setShowOfferCenter] = useState(false);
  const weeklyOffer = currentOffer(new Date()).offer;

  // Starter offer: highlight the one-time Starter Pack to players who haven't
  // converted yet (no ads-removed / lifetime / DeepLife+). Reuses the existing
  // GEMS_STARTER SKU + its real store price - no new product needed.
  const showStarterOffer =
    !hasDeepLifePlusEntitlement(settings) &&
    settings?.adsRemoved !== true &&
    settings?.lifetimePremium !== true;
  const starterOffer = {
    id: IAP_PRODUCTS.GEMS_STARTER,
    accent: 'packs' as ShopAccent,
    image: IAP_ART[IAP_PRODUCTS.GEMS_STARTER],
    title: getProductConfig(IAP_PRODUCTS.GEMS_STARTER)?.name ?? 'Starter Pack',
    description:
      getProductConfig(IAP_PRODUCTS.GEMS_STARTER)?.description ??
      'A big gem head start - your best first buy.',
    features: getProductDisplayMeta(IAP_PRODUCTS.GEMS_STARTER).contents,
    badges: [{ label: 'Best First Buy', color: BADGE_BEST }] as ShopBadge[],
    owned: false,
  };

  const tabs: { id: StoreTab; label: string; icon: React.ComponentType<{ size?: number; color?: string }>; color: string }[] = [
    { id: 'gems', label: 'Gems', icon: Gem, color: '#6366F1' },
    { id: 'store', label: 'Featured', icon: Sparkles, color: '#8B5CF6' },
    { id: 'perks', label: 'Perks', icon: Star, color: '#F59E0B' },
    { id: 'upgrades', label: 'Upgrades', icon: TrendingUp, color: '#10B981' },
  ];

  const storeBanner = !storeReady ? (
    <View style={styles.banner}>
      <AlertCircle size={scale(15)} color={BADGE_BEST} />
      <Text style={styles.bannerText}>Store unavailable - check your connection and try again in a moment.</Text>
    </View>
  ) : null;

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
      onShow={() => setSheetShown(true)}
    >
      <View style={styles.overlay}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} accessibilityLabel="Close store">
          <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(2, 6, 23, 0.72)' }]} />
        </TouchableOpacity>

        <Animated.View style={[styles.sheet, { opacity: progress, transform: [{ translateY: sheetTranslate }] }]}>
          <BlurViewFallback intensity={40} tint="dark" style={StyleSheet.absoluteFill} />

          {/* Pull handle */}
          <View style={styles.handle} />

          {/* Header - title + prominent balance + close */}
          <View style={styles.headerRow}>
            <View style={styles.headerTitleCol}>
              <Text style={styles.title}>Store</Text>
              <Text style={styles.subtitle}>Gems, unlocks & bundles</Text>
            </View>
            <LinearGradient
              colors={['#6366F1', '#4F46E5']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.balancePill}
            >
              <Gem size={scale(14)} color="#F8FAFC" />
              <Text style={styles.balanceValue}>{gems.toLocaleString()}</Text>
              <Text style={styles.balanceLabel}>Gems</Text>
            </LinearGradient>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} accessibilityRole="button" accessibilityLabel="Close store">
              <X size={scale(18)} color="rgba(226, 232, 240, 0.7)" />
            </TouchableOpacity>
          </View>

          {/* Tabs */}
          <View style={styles.tabRow}>
            {tabs.map((tabItem) => {
              const Icon = tabItem.icon;
              const isSelected = tab === tabItem.id;
              return (
                <TouchableOpacity
                  key={tabItem.id}
                  onPress={() => setTab(tabItem.id)}
                  activeOpacity={0.8}
                  style={styles.tabBtn}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: isSelected }}
                  accessibilityLabel={`${tabItem.label} tab`}
                >
                  <View style={styles.tabContent}>
                    <Icon size={scale(13)} color={isSelected ? '#F8FAFC' : 'rgba(226, 232, 240, 0.55)'} />
                    <Text style={[styles.tabLabel, isSelected && styles.tabLabelActive]}>{tabItem.label}</Text>
                  </View>
                  {isSelected ? <View style={[styles.tabUnderline, { backgroundColor: tabItem.color }]} /> : null}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Content */}
          <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {/* DeepLife+ subscription upsell - pinned above every tab. Self-hides
                for members and opens the RevenueCat paywall (or the in-app one). */}
            <DeepLifePlusUpsell variant="banner" surface="gem_shop" />
            {/* Weekly rotation - an entry point, not an interruption. It states
                which offer is featured and nothing else; the player opens it if
                they want to.

                Shown on BOTH real-money tabs. It lived on `gems` alone at first,
                which put it one tab away from the shop's own front door: the HUD
                button calls `openStore('store')`, so the tab a player actually
                lands on is Featured. A weekly rotation nobody can find is not a
                rotation. Deliberately NOT on `perks`/`upgrades` - those spend
                gems the player already owns, and a real-money pack there is an
                interruption rather than an option. */}
            {(tab === 'gems' || tab === 'store') ? (
              <TouchableOpacity
                style={styles.offerCenterRow}
                onPress={() => setShowOfferCenter(true)}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel={`Open the offer center. This week: ${weeklyOffer.name}`}
              >
                <Sparkles size={scale(15)} color="#FBBF24" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.offerCenterTitle}>This week: {weeklyOffer.name}</Text>
                  <Text style={styles.offerCenterSub}>See the weekly rotation</Text>
                </View>
                <ChevronRight size={scale(16)} color="rgba(226, 232, 240, 0.5)" />
              </TouchableOpacity>
            ) : null}
            {tab === 'gems' ? (
              <>
                {/* Honest limited-time promo (only when a real store offer is live). */}
                {gemPromo ? (
                  <View style={styles.promoBanner}>
                    <Sparkles size={scale(16)} color="#FDE68A" />
                    <View style={styles.promoCopy}>
                      <Text style={styles.promoHeadline}>{gemPromo.headline}</Text>
                      {gemPromo.subtext ? <Text style={styles.promoSub}>{gemPromo.subtext}</Text> : null}
                      {gemPromoCountdown ? <Text style={styles.promoCountdown}>{gemPromoCountdown}</Text> : null}
                    </View>
                  </View>
                ) : null}

                {/* One-time Starter Pack highlight for players who haven't converted. */}
                {showStarterOffer ? (
                  <>
                    <Text style={styles.sectionLabel}>Starter offer</Text>
                    {renderHero(starterOffer)}
                  </>
                ) : null}

                {/* Free daily reward - shares its claim state with the identity
                    card, so a player can only claim once per day from either. */}
                <Text style={[styles.sectionLabel, showStarterOffer && styles.sectionLabelSpaced]}>Free daily reward</Text>
                {/* The shop sheet is always dark, so keep the claim's dark
                    styling even when the app is in light mode. */}
                <DailyGemClaim onDarkSurface />
                {storeBanner}
                <Text style={[styles.sectionLabel, styles.sectionLabelSpaced]}>Gem packs</Text>
                {gemPacks.map(renderGemPackCard)}
                <Text style={styles.footnote}>
                  Prices are your App Store region’s price, shown and charged at purchase.
                </Text>
              </>
            ) : null}

            {tab === 'store' ? (
              <>
                {storeBanner}
                <Text style={styles.sectionLabel}>Featured</Text>
                {featured.map(renderHero)}
                <Text style={styles.sectionLabel}>Bundles</Text>
                {bundles.map(renderMoneyCard)}
                <Text style={styles.sectionLabel}>Individual items</Text>
                {storeItems.map(renderMoneyCard)}
              </>
            ) : null}

            {tab === 'perks' ? (
              <>
                {storeBanner}
                {perkItems.map(renderMoneyCard)}
                <Text style={[styles.sectionLabel, styles.sectionLabelSpaced]}>Banking services</Text>
                {bankingItems.map(renderMoneyCard)}
              </>
            ) : null}

            {tab === 'upgrades' ? (
              <>
                <Text style={styles.footnote}>Permanent upgrades - bought with in-game gems.</Text>
                {shortOnGemsForUpgrades ? (
                  <TouchableOpacity
                    onPress={() => setTab('gems')}
                    activeOpacity={0.85}
                    style={styles.gemBridge}
                    accessibilityRole="button"
                    accessibilityLabel="Get more gems to unlock upgrades"
                  >
                    <Gem size={scale(15)} color="#A5B4FC" />
                    <Text style={styles.gemBridgeText}>Short on gems? Top up to unlock these upgrades</Text>
                    <ChevronRight size={scale(16)} color="#A5B4FC" />
                  </TouchableOpacity>
                ) : null}
                {upgrades.map(renderUpgradeCard)}
              </>
            ) : null}
          </ScrollView>

          {/* Footer - Restore Purchases */}
          <View style={styles.footer}>
            <TouchableOpacity
              onPress={handleRestorePurchases}
              disabled={iapBusy}
              activeOpacity={0.7}
              style={styles.restoreBtn}
              accessibilityRole="button"
              accessibilityLabel={restoring ? 'Restoring purchases' : 'Restore purchases'}
              accessibilityState={{ busy: restoring, disabled: iapBusy }}
            >
              {restoring ? (
                <LoadingSpinner visible size="small" color="rgba(226, 232, 240, 0.6)" variant="compact" />
              ) : (
                <RefreshCw size={scale(13)} color="rgba(226, 232, 240, 0.6)" />
              )}
              <Text style={styles.restoreText}>{restoring ? 'Restoring…' : 'Restore Purchases'}</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>

      {/* NESTED inside this presented Modal (the same iOS-safe nesting
          WhatsNewModal uses in SettingsModal) so it never stacks a sibling
          root Modal. */}
      <OfferCenterModal visible={showOfferCenter} onClose={() => setShowOfferCenter(false)} />
      {/* Same nesting for the in-game alerts: purchase confirms and results
          are raised via gameAlert while this sheet is presented, and the root
          AlertHost's sibling Modal cannot present over it on iOS. This nested
          host registers on top of the gameAlert stack while the shop is up. */}
      <AlertHost />
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    height: '88%',
    backgroundColor: 'rgba(9, 12, 22, 0.96)',
    borderTopLeftRadius: responsiveBorderRadius.xl,
    borderTopRightRadius: responsiveBorderRadius.xl,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    overflow: 'hidden',
  },
  handle: {
    alignSelf: 'center',
    width: scale(40),
    height: scale(4),
    borderRadius: scale(2),
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    marginTop: verticalScale(8),
    marginBottom: verticalScale(8),
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: responsiveSpacing.md,
    paddingBottom: verticalScale(12),
    gap: scale(10),
  },
  headerTitleCol: {
    flex: 1,
  },
  title: {
    fontSize: fontScale(22),
    fontWeight: '800',
    color: '#F8FAFC',
    letterSpacing: -0.4,
  },
  subtitle: {
    fontSize: fontScale(11.5),
    fontWeight: '600',
    color: 'rgba(226, 232, 240, 0.5)',
    marginTop: 2,
    letterSpacing: 0.1,
  },
  balancePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(5),
    paddingHorizontal: scale(12),
    paddingVertical: verticalScale(7),
    borderRadius: scale(999),
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.16)',
  },
  balanceValue: {
    fontSize: fontScale(15),
    fontWeight: '800',
    color: '#F8FAFC',
    letterSpacing: -0.2,
    fontVariant: ['tabular-nums'],
  },
  balanceLabel: {
    fontSize: fontScale(10),
    fontWeight: '700',
    color: 'rgba(248, 250, 252, 0.75)',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginLeft: scale(1),
  },
  closeBtn: {
    width: scale(32),
    height: scale(32),
    borderRadius: scale(16),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  tabRow: {
    flexDirection: 'row',
    paddingHorizontal: responsiveSpacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
  },
  tabBtn: {
    flex: 1,
    paddingVertical: verticalScale(10),
    alignItems: 'center',
  },
  tabContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(6),
  },
  tabLabel: {
    fontSize: fontScale(13),
    fontWeight: '600',
    color: 'rgba(226, 232, 240, 0.55)',
    letterSpacing: -0.1,
  },
  tabLabelActive: {
    color: '#F8FAFC',
    fontWeight: '700',
  },
  tabUnderline: {
    position: 'absolute',
    bottom: 0,
    left: '18%',
    right: '18%',
    height: 2,
    borderRadius: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: responsiveSpacing.md,
    paddingBottom: verticalScale(24),
  },
  sectionLabel: {
    fontSize: fontScale(12),
    fontWeight: '700',
    color: 'rgba(226, 232, 240, 0.6)',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: verticalScale(6),
    marginBottom: verticalScale(10),
  },
  sectionLabelSpaced: {
    marginTop: verticalScale(16),
  },
  offerCenterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(10),
    paddingHorizontal: scale(14),
    paddingVertical: verticalScale(11),
    borderRadius: responsiveBorderRadius.md,
    backgroundColor: 'rgba(251, 191, 36, 0.10)',
    // Hard Rule #7: all four sides, never a decorative one-sided stripe.
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(251, 191, 36, 0.4)',
    marginBottom: verticalScale(12),
  },
  offerCenterTitle: { color: '#F8FAFC', fontSize: fontScale(13), fontWeight: '700' },
  offerCenterSub: { color: 'rgba(226, 232, 240, 0.6)', fontSize: fontScale(10.5), marginTop: verticalScale(1) },
  promoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(10),
    paddingHorizontal: scale(14),
    paddingVertical: verticalScale(11),
    borderRadius: responsiveBorderRadius.md,
    backgroundColor: 'rgba(250, 204, 21, 0.12)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(250, 204, 21, 0.45)',
    marginBottom: verticalScale(12),
  },
  promoCopy: { flex: 1, gap: verticalScale(1) },
  promoHeadline: { fontSize: fontScale(13.5), fontWeight: '800', color: '#FDE68A', letterSpacing: 0.1 },
  promoSub: { fontSize: fontScale(11.5), fontWeight: '600', color: 'rgba(253, 230, 138, 0.8)' },
  promoCountdown: {
    fontSize: fontScale(11),
    fontWeight: '800',
    color: '#FBBF24',
    letterSpacing: 0.3,
    marginTop: verticalScale(1),
    fontVariant: ['tabular-nums'],
  },
  gemBridge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(10),
    paddingHorizontal: scale(14),
    paddingVertical: verticalScale(11),
    borderRadius: responsiveBorderRadius.md,
    backgroundColor: 'rgba(99, 102, 241, 0.12)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(129, 140, 248, 0.4)',
    marginBottom: verticalScale(12),
  },
  gemBridgeText: {
    flex: 1,
    fontSize: fontScale(12.5),
    fontWeight: '700',
    color: '#C7D2FE',
    letterSpacing: 0.1,
  },
  footnote: {
    fontSize: fontScale(11),
    fontWeight: '500',
    color: 'rgba(226, 232, 240, 0.45)',
    lineHeight: fontScale(16),
    marginTop: verticalScale(4),
    marginBottom: verticalScale(10),
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(8),
    paddingHorizontal: scale(12),
    paddingVertical: verticalScale(10),
    borderRadius: responsiveBorderRadius.md,
    backgroundColor: 'rgba(251, 191, 36, 0.1)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(251, 191, 36, 0.35)',
    marginBottom: verticalScale(12),
  },
  bannerText: {
    flex: 1,
    fontSize: fontScale(12),
    fontWeight: '600',
    color: '#FDE68A',
    lineHeight: fontScale(16),
  },
  footer: {
    paddingHorizontal: responsiveSpacing.md,
    paddingVertical: verticalScale(12),
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
  },
  restoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(8),
    paddingVertical: verticalScale(6),
    paddingHorizontal: scale(12),
  },
  restoreText: {
    fontSize: fontScale(12),
    fontWeight: '600',
    color: 'rgba(226, 232, 240, 0.65)',
    letterSpacing: 0.3,
  },
});

export default React.memo(GemShopModal);
