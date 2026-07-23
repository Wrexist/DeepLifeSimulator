import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView, Animated, Easing } from 'react-native';
import { useGameSelector, shallowEqual } from '@/contexts/game/useGameSelector';
import { useMoneyActions } from '@/contexts/game/MoneyActionsContext';
import { useGameActions } from '@/contexts/game/GameActionsContext';
import { safeSettings } from '@/utils/safeGameState';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { X, Gem, Sparkles, Star, TrendingUp, RefreshCw, AlertCircle, ChevronRight } from 'lucide-react-native';
import BlurViewFallback from '@/components/fallbacks/BlurViewFallback';
import LinearGradientFallback from '@/components/fallbacks/LinearGradientFallback';
import { scale, fontScale, responsiveBorderRadius, responsiveSpacing, verticalScale } from '@/utils/scaling';
import { iapService } from '@/services/IAPService';
import LoadingSpinner from '@/components/LoadingSpinner';
import DeepLifePlusUpsell from '@/components/DeepLifePlusUpsell';
import DailyGemClaim from '@/components/DailyGemClaim';
import { IAP_PRODUCTS, getProductConfig, getProductDisplayMeta } from '@/utils/iapConfig';
import { logger } from '@/utils/logger';
import ShopItemCard, { ShopBadge, ShopAccent } from '@/components/shop/ShopItemCard';

const LinearGradient = LinearGradientFallback;

// Entrance motion mirrors the shared house tokens (src/utils/animated MOTION):
// a short slide-up + fade on an ease-out curve, kept under the 300ms UI budget.
// Easing is resolved defensively so the render-test RN mock (no native Easing)
// can't crash at load — same pattern as components/ConfirmDialog.tsx.
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
// stringifies `price` for display, so a clean numeric is NOT guaranteed — return
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

function GemShopModal({ visible, onClose, initialTab }: GemShopModalProps) {
  const { buyGoldUpgrade } = useMoneyActions();
  const { saveGame } = useGameActions();
  const settings = useGameSelector((s) => safeSettings(s), shallowEqual);
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
  // — no transaction logic here; the app initializes IAP at startup.
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

  // True only when the store connected AND a non-empty catalog loaded — mirrors
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

  // Per-SKU availability: an IAP is buyable only if THIS product id actually
  // loaded from the store. `storeReady` (any product loaded) still drives the
  // global banner, but a mixed catalog — most SKUs loaded, one missing — must
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

  // Real-money CTA label — the real price is unmistakable on every buy button.
  const buyLabel = (id: string, owned: boolean, displayPrice: string, available: boolean): string => {
    if (owned) return 'Owned';
    if (!available) return 'Unavailable';
    if (purchasingId === id) return 'Processing…';
    return displayPrice ? `Buy · ${displayPrice}` : 'Buy';
  };

  const ctaA11y = (id: string, name: string, displayPrice: string, owned: boolean, available: boolean): string => {
    if (owned) return `${name}, already owned`;
    if (!available) return `${name}, unavailable`;
    if (purchasingId === id) return `Purchasing ${name}, please wait`;
    return `Buy ${name}${displayPrice ? ` for ${displayPrice}` : ''}`;
  };

  // The five-tier gem ladder with a per-pack gems-per-$ value (computed from the
  // REAL gemAmount / USD price). The truthfully-best gems-per-$ pack earns the
  // "Best Value" badge — not whatever the config's stale bestValue flag claims.
  const gemPacks = useMemo(() => {
    const base = [
      { id: IAP_PRODUCTS.GEMS_100, gems: 100, image: require('@/assets/images/iap/gems/gems_100.png') },
      { id: IAP_PRODUCTS.GEMS_500, gems: 500, image: require('@/assets/images/iap/gems/gems_500.png') },
      { id: IAP_PRODUCTS.GEMS_1000, gems: 1000, image: require('@/assets/images/iap/gems/gems_1000.png') },
      { id: IAP_PRODUCTS.GEMS_5000, gems: 5000, image: require('@/assets/images/iap/gems/gems_5000.png') },
      { id: IAP_PRODUCTS.GEMS_15000, gems: 15000, image: require('@/assets/images/iap/gems/gems_15000.png') },
      { id: IAP_PRODUCTS.GEMS_50000, gems: 50000, image: require('@/assets/images/iap/gems/gems_50000.png') },
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

  // Confirm step + purchase. Transaction logic is unchanged — presentation only.
  const handlePurchase = async (id: string, name: string, displayPrice: string) => {
    if (iapBusy) {
      Alert.alert('Please Wait', 'Another purchase is in progress. Please wait for it to complete.');
      return;
    }
    // Refuse before touching iapService when THIS SKU didn't load — its price on
    // the card is a config fallback, not a real store price, so it isn't buyable.
    if (!isProductAvailable(id)) {
      Alert.alert(
        'Item Unavailable',
        'This item isn’t available right now. Please check your connection and try again in a moment.',
      );
      return;
    }

    const priceText = displayPrice || resolveDisplayPrice(id);

    Alert.alert(
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
                // IAPService already applies benefits — do not re-apply here.
                Alert.alert(
                  'Purchase Successful!',
                  result.message || 'Purchase completed! Your items have been added to your account.',
                );
              } else {
                const errorMessage = result.message || 'Unable to complete purchase. Please try again.';
                if (!errorMessage.includes('cancelled')) {
                  Alert.alert('Purchase Failed', errorMessage);
                }
              }
            } catch (error) {
              logger.error('Purchase error:', error);
              let errorMsg = 'An unexpected error occurred during purchase.';
              if (error instanceof Error) {
                errorMsg = error.message;
              }
              Alert.alert('Error', `${errorMsg}\n\nPlease try again or contact support if the problem persists.`);
            } finally {
              setPurchasingId(null);
            }
          },
        },
      ],
    );
  };

  // Gem-spend upgrades (in-game currency, NOT an IAP).
  const handleBuyUpgrade = async (id: string, price: number) => {
    if (gems < price) {
      Alert.alert('Insufficient Gems', 'You need more gems to purchase this upgrade.');
      return;
    }
    const isOwned = goldUpgrades?.[id as keyof typeof goldUpgrades];
    if (isOwned) {
      Alert.alert('Already Owned', 'You already own this upgrade.');
      return;
    }
    // The upgrade commits to game state synchronously here. Persisting can still
    // reject (disk/quota) — swallow it into a clear message rather than letting
    // it bubble as an unhandled rejection. Do NOT claim the purchase failed: the
    // state change stands, and the periodic autosave will retry the write.
    buyGoldUpgrade(id);
    try {
      await saveGame();
      Alert.alert('Purchase Successful', 'Your upgrade has been activated!');
    } catch (error) {
      logger.error('Failed to save after gem upgrade purchase:', error);
      Alert.alert(
        'Purchase Successful',
        'Your upgrade has been activated. We couldn’t save just now, but it will be saved automatically in a moment.',
      );
    }
  };

  const handleRestorePurchases = async () => {
    if (iapBusy) {
      Alert.alert('Please Wait', 'A purchase operation is already in progress.');
      return;
    }
    setRestoring(true);
    try {
      logger.info('Starting purchase restoration...');
      const success = await iapService.restorePurchases();
      if (success) {
        await iapService.loadPurchases();
        Alert.alert('Purchases Restored', 'Your previous purchases have been restored successfully!', [
          { text: 'OK', style: 'default' },
        ]);
      } else {
        Alert.alert(
          'Could Not Restore',
          'Purchases could not be restored at this time. Make sure you are signed in to the App Store and try again.',
          [{ text: 'OK', style: 'default' }],
        );
      }
    } catch (error) {
      logger.error('Restore purchases error:', error);
      Alert.alert('Restore Failed', 'Unable to restore purchases. Please try again or contact support.', [
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
    const valueLine = gemValueLine(p.id, p.gems, p.perDollar);
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
        buttonText={buyLabel(item.id, item.owned, displayPrice, available)}
        accessibilityLabel={ctaA11y(item.id, item.title, displayPrice, item.owned, available)}
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
    const afford = gems >= item.price;
    // A featured tag (e.g. "Most Popular") leads; "Permanent" reassures it's a
    // one-time buy. ShopItemCard renders up to two badges.
    const badges: ShopBadge[] = [];
    if (item.featured) badges.push({ label: item.featured, color: BADGE_BEST });
    badges.push({ label: 'Permanent', color: BADGE_POPULAR });
    const buttonText = item.owned ? 'Owned' : afford ? 'Redeem' : 'Not enough gems';
    return (
      <ShopItemCard
        key={item.id}
        accent="upgrades"
        image={item.image}
        title={item.name}
        description={item.description}
        priceLabel={item.price.toLocaleString()}
        priceKind="gems"
        badges={badges}
        buttonText={buttonText}
        accessibilityLabel={
          item.owned
            ? `${item.name}, already owned`
            : `${item.name}, costs ${item.price.toLocaleString()} gems`
        }
        onPress={() => handleBuyUpgrade(item.id, item.price)}
        owned={item.owned}
        locked={!afford && !item.owned}
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
      description: `${bestGem.gems.toLocaleString()} gems — the best gem value in the store.`,
      valueLine: bestGemValueLine ? `Best value · ${bestGemValueLine}` : undefined,
      badges: [{ label: 'Best Value', color: BADGE_BEST }] as ShopBadge[],
      owned: false,
    },
    {
      id: IAP_PRODUCTS.REMOVE_ADS,
      accent: 'perks' as ShopAccent,
      image: require('@/assets/images/iap/premium/remove_ads.png'),
      title: 'Remove Ads',
      description: getProductConfig(IAP_PRODUCTS.REMOVE_ADS)?.description ?? 'Ad-free gaming forever.',
      features: getProductDisplayMeta(IAP_PRODUCTS.REMOVE_ADS).contents,
      badges: [] as ShopBadge[],
      owned: settings?.adsRemoved === true,
    },
    {
      id: IAP_PRODUCTS.LIFETIME_PREMIUM,
      accent: 'packs' as ShopAccent,
      image: require('@/assets/images/iap/items/lifetime_premium.png'),
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
      image: require('@/assets/images/iap/packs/starter_pack.png'),
      title: 'Starter Pack',
      badges: getProductConfig(IAP_PRODUCTS.GEMS_STARTER)?.popular
        ? ([{ label: 'Most Popular', color: BADGE_POPULAR }] as ShopBadge[])
        : undefined,
    },
    {
      id: IAP_PRODUCTS.GEMS_PREMIUM,
      accent: 'packs' as ShopAccent,
      image: require('@/assets/images/iap/packs/premium_pack.png'),
      title: 'Premium Pack',
      badges: getProductConfig(IAP_PRODUCTS.GEMS_PREMIUM)?.popular
        ? ([{ label: 'Most Popular', color: BADGE_POPULAR }] as ShopBadge[])
        : undefined,
    },
    {
      id: IAP_PRODUCTS.GEMS_ULTIMATE,
      accent: 'packs' as ShopAccent,
      image: require('@/assets/images/iap/packs/ultimate_pack.png'),
      title: 'Ultimate Pack',
      badges: undefined,
    },
    {
      id: IAP_PRODUCTS.GEMS_MEGA,
      accent: 'packs' as ShopAccent,
      image: require('@/assets/images/iap/packs/mega_pack.png'),
      title: 'Mega Pack',
      badges: undefined,
    },
  ];

  const storeItems = [
    {
      id: IAP_PRODUCTS.YOUTH_PILL_SINGLE,
      accent: 'packs' as ShopAccent,
      image: require('@/assets/images/iap/items/youth_pill_single.png'),
      title: 'Youth Pill',
    },
    {
      id: IAP_PRODUCTS.YOUTH_PILL_PACK,
      accent: 'packs' as ShopAccent,
      image: require('@/assets/images/iap/items/youth_pill_pack.png'),
      title: 'Youth Pill Pack (5×)',
    },
    {
      id: IAP_PRODUCTS.MONEY_BOOST,
      accent: 'packs' as ShopAccent,
      image: require('@/assets/images/iap/items/money_boost.png'),
      title: 'Money Boost',
    },
    {
      id: IAP_PRODUCTS.SKILL_BOOST,
      accent: 'packs' as ShopAccent,
      image: require('@/assets/images/iap/items/skill_boost.png'),
      title: 'Skill Boost',
    },
  ];

  const allPerksOwned = Boolean(perks?.workBoost && perks?.fastLearner && perks?.goodCredit);
  const perkItems = [
    {
      id: IAP_PRODUCTS.UNLOCK_ALL_PERKS,
      accent: 'perks' as ShopAccent,
      image: require('@/assets/images/iap/premium/unlock_all_perks.png'),
      title: 'Unlock All Perks',
      owned: allPerksOwned,
      badges: [{ label: 'Best Value', color: BADGE_BEST }] as ShopBadge[],
    },
    {
      id: IAP_PRODUCTS.WORK_BOOST,
      accent: 'perks' as ShopAccent,
      image: require('@/assets/images/iap/perks/work_pay_boost.png'),
      title: 'Work Pay Boost',
      owned: perks?.workBoost === true,
    },
    {
      id: IAP_PRODUCTS.MINDSET,
      accent: 'perks' as ShopAccent,
      image: require('@/assets/images/iap/perks/mindset.png'),
      title: 'Mindset',
      owned: perks?.mindset === true,
    },
    {
      id: IAP_PRODUCTS.FAST_LEARNER,
      accent: 'perks' as ShopAccent,
      image: require('@/assets/images/iap/perks/fast_learner.png'),
      title: 'Fast Learner',
      owned: perks?.fastLearner === true,
    },
    {
      id: IAP_PRODUCTS.GOOD_CREDIT,
      accent: 'perks' as ShopAccent,
      image: require('@/assets/images/iap/perks/good_credit_score.png'),
      title: 'Good Credit Score',
      owned: perks?.goodCredit === true,
    },
    {
      id: IAP_PRODUCTS.REMOVE_ADS,
      accent: 'perks' as ShopAccent,
      image: require('@/assets/images/iap/premium/remove_ads.png'),
      title: 'Remove Ads',
      owned: settings?.adsRemoved === true,
    },
    {
      id: IAP_PRODUCTS.REVIVAL_PACK,
      accent: 'perks' as ShopAccent,
      image: require('@/assets/images/iap/items/youth_pill_single.png'),
      title: 'Revival Pack',
      owned: settings?.hasRevivalPack === true,
    },
    {
      id: IAP_PRODUCTS.LIFETIME_PREMIUM,
      accent: 'perks' as ShopAccent,
      image: require('@/assets/images/iap/items/lifetime_premium.png'),
      title: 'Lifetime Premium',
      owned: settings?.lifetimePremium === true,
    },
  ];

  const upgrades = [
    {
      id: 'multiplier',
      name: 'Money Multiplier',
      description: 'All earnings increased by 50% forever',
      price: 5000,
      image: require('@/assets/images/iap/upgrades/money_multiplier.png'),
      owned: goldUpgrades?.multiplier || false,
      featured: 'Most Popular',
    },
    {
      id: 'energy_boost',
      name: 'Energy Boost',
      description: 'Energy regenerates 50% faster',
      price: 7500,
      image: require('@/assets/images/iap/upgrades/energy_boost.png'),
      owned: goldUpgrades?.energy_boost || false,
    },
    {
      id: 'happiness_boost',
      name: 'Happiness Boost',
      description: 'Happiness decays 50% slower',
      price: 6000,
      image: require('@/assets/images/iap/upgrades/happiness_boost.png'),
      owned: goldUpgrades?.happiness_boost || false,
    },
    {
      id: 'fitness_boost',
      name: 'Fitness Boost',
      description: 'Fitness decays 50% slower',
      price: 9000,
      image: require('@/assets/images/iap/upgrades/fitness_boost.png'),
      owned: goldUpgrades?.fitness_boost || false,
    },
    {
      id: 'skill_mastery',
      name: 'Skill Mastery',
      description: 'All skills level up 50% faster',
      price: 15000,
      image: require('@/assets/images/iap/upgrades/skill_mastery.png'),
      owned: goldUpgrades?.skill_mastery || false,
    },
    {
      id: 'time_machine',
      name: 'Time Machine',
      description: 'Time-rewind costs halved',
      price: 25000,
      image: require('@/assets/images/iap/upgrades/time_machine.png'),
      owned: goldUpgrades?.time_machine || false,
    },
    {
      id: 'immortality',
      name: 'Immortality',
      description: 'Never die of old age (skips age-80+ death rolls)',
      price: 50000,
      image: require('@/assets/images/iap/upgrades/immortality.png'),
      owned: goldUpgrades?.immortality || false,
      featured: 'Ultimate',
    },
  ];

  // "Short on gems?" bridge: if the player can't afford the cheapest upgrade they
  // don't already own, offer a one-tap jump to the Gems tab (the conversion path).
  const cheapestUnownedUpgrade = upgrades
    .filter((u) => !u.owned)
    .reduce((min, u) => Math.min(min, u.price), Infinity);
  const shortOnGemsForUpgrades = Number.isFinite(cheapestUnownedUpgrade) && gems < cheapestUnownedUpgrade;

  const tabs: { id: StoreTab; label: string; icon: React.ComponentType<{ size?: number; color?: string }>; color: string }[] = [
    { id: 'gems', label: 'Gems', icon: Gem, color: '#6366F1' },
    { id: 'store', label: 'Featured', icon: Sparkles, color: '#8B5CF6' },
    { id: 'perks', label: 'Perks', icon: Star, color: '#F59E0B' },
    { id: 'upgrades', label: 'Upgrades', icon: TrendingUp, color: '#10B981' },
  ];

  const storeBanner = !storeReady ? (
    <View style={styles.banner}>
      <AlertCircle size={scale(15)} color={BADGE_BEST} />
      <Text style={styles.bannerText}>Store unavailable — check your connection and try again in a moment.</Text>
    </View>
  ) : null;

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.overlay}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} accessibilityLabel="Close store">
          <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(2, 6, 23, 0.72)' }]} />
        </TouchableOpacity>

        <Animated.View style={[styles.sheet, { opacity: progress, transform: [{ translateY: sheetTranslate }] }]}>
          <BlurViewFallback intensity={40} tint="dark" style={StyleSheet.absoluteFill} />

          {/* Pull handle */}
          <View style={styles.handle} />

          {/* Header — title + prominent balance + close */}
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
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} accessibilityRole="button" accessibilityLabel="Close store">
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
            {/* DeepLife+ subscription upsell — pinned above every tab. Self-hides
                for members and opens the RevenueCat paywall (or the in-app one). */}
            <DeepLifePlusUpsell variant="banner" surface="gem_shop" />
            {tab === 'gems' ? (
              <>
                {/* Free daily reward — shares its claim state with the identity
                    card, so a player can only claim once per day from either. */}
                <Text style={styles.sectionLabel}>Free daily reward</Text>
                <DailyGemClaim />
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
              </>
            ) : null}

            {tab === 'upgrades' ? (
              <>
                <Text style={styles.footnote}>Permanent upgrades — bought with in-game gems.</Text>
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

          {/* Footer — Restore Purchases */}
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
