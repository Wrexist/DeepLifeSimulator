/**
 * LuxuryApp - desktop "Luxury & Collectibles" screen (premium redesign).
 *
 * An aspirational late-game cash sink hosted as a computer mini-app (same model
 * as RealEstateApp / GamingApp): browse an artwork-led catalog, buy with in-game
 * cash, and manage owned trophies (each has weekly upkeep + a happiness/prestige
 * benefit). This pass matches the game's redesign wave:
 *  - ARTWORK BANNER per item - a bundled Image (luxuryArt require map) with a
 *    graceful per-tier gradient placeholder (the emoji, large + subtle) until the
 *    real art is imported. Full names fit (2-line title, price off the title row).
 *  - Tiers made visual (ENTRY / PREMIUM / ELITE / ULTRA tinted chips).
 *  - A DETAIL SHEET (tap a card) with the full stats + cost-of-ownership + buy/sell.
 *  - A COLLECTION showcase (value / upkeep / prestige summary) + the resale flow.
 *  - The "Luxury Life" goal turned into a real progress module.
 *  - Buy/sell route through the shared ConfirmDialog; shortfalls are a calm toast.
 *  - Staggered card entrances + press feedback, honouring Reduce Motion.
 *
 * Cash safety: buy/sell dispatch LuxuryActions, which route every cash move
 * through the canonical applyMoneyDelta (stats.money only - never a mirrored bank
 * balance). This component never mutates money directly.
 */

import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
} from 'react-native';
import {
  Crown,
  Gem,
  Trophy,
  Tag,
  Wallet,
  Award,
  ShoppingBag,
  ChevronRight,
  BadgeCheck,
} from 'lucide-react-native';
import { useGame } from '@/contexts/GameContext';
import type { LuxuryHolding } from '@/contexts/game/types';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ErrorBoundary from '@/components/ErrorBoundary';
import ConfirmDialog from '@/components/ConfirmDialog';
import usePressableScale from '@/hooks/usePressableScale';
import { useTimerManager } from '@/hooks/useTimerManager';
import {
  responsiveFontSize,
  responsiveSpacing,
  responsiveBorderRadius,
  scale,
  touchTargets,
  getAppScreenBottomPadding,
} from '@/utils/scaling';
import { getThemeColors, accent, withAlpha } from '@/lib/config/theme';
import { getGlassCard, getGlassIconContainer } from '@/utils/glassmorphismStyles';
import { formatMoney } from '@/utils/moneyFormatting';
import { logger } from '@/utils/logger';
import { useToast } from '@/contexts/ToastContext';
import AppHeader, { CashChip } from '@/components/ui/AppHeader';
import SegmentedControl from '@/components/ui/SegmentedControl';
import StatStrip from '@/components/ui/StatStrip';
import SectionTitle from '@/components/ui/SectionTitle';
import CollapsibleSection from '@/components/ui/CollapsibleSection';
import ProgressBar from '@/components/ui/ProgressBar';
import Chip from '@/components/ui/Chip';
import EmptyState from '@/components/ui/EmptyState';
import BaseModal from '@/components/ui/BaseModal';
import {
  LUXURY_CATALOG,
  type LuxuryItem,
  getOwnedLuxuryItems,
  getTotalLuxuryMarketValue,
  getTotalLuxuryUpkeep,
  getTotalLuxuryValue,
  getTotalLuxuryPrestige,
  getLuxuryHoldingValue,
  getCondition,
  getItemPremium,
  getExpectedWeeklyLoss,
  getRestoreCost,
  CONDITION_POOR,
  isLuxuryLifeComplete,
  getAllCollectionProgress,
  getLuxuryTitle,
  LUXURY_LIFE_MIN_ITEMS,
  LUXURY_LIFE_VALUE_THRESHOLD,
  verbsForItem,
  getVerbAvailability,
  isHostingVenue,
  getGuestList,
  getHostingAvailability,
  quoteEvent,
  EVENT_TIERS,
} from '@/lib/luxury';
import {
  hostLuxuryEvent,
  performLuxuryVerb,
  purchaseLuxuryItem,
  restoreLuxuryItem,
  sellLuxuryItem,
  setLuxuryInsurance,
} from '@/contexts/game/actions/LuxuryActions';
import { luxuryArtFor, luxuryTierVisual } from '@/components/computer/luxury/luxuryArt';

// One identity accent for this app - the shared semantic blue, tinted through
// `withAlpha`. Emerald = benefit/complete, amber = the cautionary (lossy but
// reversible) resale flow; both come from the shared accent scale too.
const IDENTITY = accent.info;
const EMERALD = accent.success;
const AMBER = accent.warning;

type IconType = React.ComponentType<{ size?: number; color?: string }>;
type ThemeColors = ReturnType<typeof getThemeColors>;
type Tab = 'browse' | 'collection';

const TABS: { key: Tab; label: string; icon: IconType }[] = [
  { key: 'browse', label: 'Browse', icon: ShoppingBag },
  { key: 'collection', label: 'Collection', icon: Gem },
];

const clampUnit = (n: number): number => Math.max(0, Math.min(1, isFinite(n) ? n : 0));

/**
 * Artwork banner - a bundled Image when present, otherwise a flat per-tier wash
 * with the item's emoji as the art. Fills its (sized, overflow-clipped) parent;
 * overlay chips are siblings.
 */
function ArtworkBanner({ item, emojiSize }: { item: LuxuryItem; emojiSize: number }) {
  const art = luxuryArtFor(item.id);
  const tv = luxuryTierVisual(item.tier);

  if (art) {
    return <Image source={art} style={styles.bannerFill} resizeMode="cover" />;
  }
  return (
    <View style={[styles.bannerFill, { backgroundColor: tv.placeholder }]}>
      <View pointerEvents="none" style={styles.bannerEmojiWrap}>
        <Text style={[styles.bannerEmoji, { fontSize: emojiSize }]}>{item.emoji}</Text>
      </View>
    </View>
  );
}

/** The two chips a buyer decides on: what it costs weekly, what it is worth in prestige. */
function ItemStatChips({ item }: { item: LuxuryItem }) {
  return (
    <View style={styles.chipRow}>
      <Chip icon={<Wallet size={scale(12)} color={AMBER} />} label={`${formatMoney(item.weeklyUpkeep)}/wk`} tint={AMBER} />
      <Chip icon={<Award size={scale(12)} color={IDENTITY} />} label={`+${item.prestige} prestige`} tint={IDENTITY} />
    </View>
  );
}

/**
 * Catalog / collection card - artwork banner (tier chip + price/owned pill) over
 * a 2-line title, two stat chips, and ONE action: Buy or Sell. The card body is
 * the affordance that opens the detail sheet, so a separate "Details" button was
 * a second control for something the whole card already did. Module-level so its
 * press animation stays stable across parent re-renders.
 */
function LuxuryCard({
  item,
  isOwned,
  darkMode,
  theme,
  cash,
  holding,
  onOpen,
  onBuy,
  onSell,
}: {
  item: LuxuryItem;
  isOwned: boolean;
  darkMode: boolean;
  theme: ThemeColors;
  cash: number;
  /** This player's holding for the item, so the card quotes the real resale. */
  holding?: LuxuryHolding;
  onOpen: (item: LuxuryItem) => void;
  onBuy: (item: LuxuryItem) => void;
  onSell: (item: LuxuryItem) => void;
}) {
  const tv = luxuryTierVisual(item.tier);
  const resale = getLuxuryHoldingValue(item, holding);
  const affordable = cash >= item.price;
  const press = usePressableScale({ scale: 0.97, haptic: false });

  return (
    <press.AnimatedView style={press.animatedStyle}>
        <View
          style={[getGlassCard(darkMode, 6), styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}
        >
          <View style={styles.cardInner}>
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={() => onOpen(item)}
              onPressIn={press.onPressIn}
              onPressOut={press.onPressOut}
              accessibilityRole="button"
              accessibilityLabel={`${item.name}, ${formatMoney(item.price)}${isOwned ? ', owned' : ''}. View details`}
            >
              <View style={[styles.bannerBox, { height: scale(132) }]}>
                <ArtworkBanner item={item} emojiSize={scale(54)} />
                <View style={[styles.tierChip, { backgroundColor: tv.accentSoft, borderColor: tv.accentBorder }]}>
                  <Text style={[styles.tierChipText, { color: tv.accent }]}>{tv.label}</Text>
                </View>
                {isOwned ? (
                  <View style={[styles.statePill, { backgroundColor: withAlpha(EMERALD, 0.92) }]}>
                    <BadgeCheck size={scale(12)} color="#FFFFFF" />
                    <Text style={styles.statePillText}>Owned</Text>
                  </View>
                ) : (
                  <View style={styles.pricePill}>
                    <Text style={styles.pricePillText}>{formatMoney(item.price)}</Text>
                  </View>
                )}
              </View>

              <View style={styles.cardBody}>
                <View style={styles.cardTitleRow}>
                  <Text style={[styles.cardName, { color: theme.text }]} numberOfLines={2}>
                    {item.name}
                  </Text>
                  <ChevronRight size={scale(16)} color={theme.textMuted} />
                </View>
                <Text style={[styles.cardResale, { color: theme.textMuted }]} numberOfLines={1}>
                  {isOwned ? `Resale ${formatMoney(resale)} · ` : ''}+{item.happiness} happiness
                </Text>
                <ItemStatChips item={item} />
              </View>
            </TouchableOpacity>

            <View style={styles.cardFooter}>
              {isOwned ? (
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() => onSell(item)}
                  style={styles.sellBtn}
                  accessibilityRole="button"
                  accessibilityLabel={`Sell ${item.name} for ${formatMoney(resale)}`}
                >
                  <Tag size={scale(14)} color={AMBER} />
                  <Text style={styles.sellBtnText}>Sell {formatMoney(resale)}</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() => onBuy(item)}
                  style={[
                    styles.buyBtn,
                    affordable ? { backgroundColor: IDENTITY } : { backgroundColor: theme.surfaceElevated },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={
                    affordable
                      ? `Buy ${item.name} for ${formatMoney(item.price)}`
                      : `${item.name} costs ${formatMoney(item.price)}, more than your cash`
                  }
                >
                  <ShoppingBag size={scale(14)} color={affordable ? '#FFFFFF' : theme.textMuted} />
                  <Text style={[styles.buyBtnText, { color: affordable ? '#FFFFFF' : theme.textMuted }]}>
                    Buy {formatMoney(item.price)}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
    </press.AnimatedView>
  );
}

interface LuxuryAppProps {
  onBack: () => void;
}

function LuxuryAppInner({ onBack }: LuxuryAppProps) {
  const { gameState, setGameState, saveGame } = useGame();
  const insets = useSafeAreaInsets();
  const timers = useTimerManager();
  const darkMode = !!gameState.settings?.darkMode;
  const theme = getThemeColors(darkMode);

  // Land on what the player OWNS once they own anything - the Garage rule.
  // Hard-wired to the shop, a collector with twelve trophies was greeted by a
  // catalogue of things to buy under a thin progress bar (Program 4).
  const [tab, setTab] = useState<Tab>(() =>
    (gameState.luxuryItems?.length ?? 0) > 0 ? 'collection' : 'browse'
  );
  const [sheetItem, setSheetItem] = useState<LuxuryItem | null>(null);
  const [pendingBuy, setPendingBuy] = useState<LuxuryItem | null>(null);
  const [pendingSell, setPendingSell] = useState<LuxuryItem | null>(null);

  // Normalize like the action layer: NaN money would render "Need $0 more" and
  // Infinity would pass every affordability check, so clamp to a finite,
  // non-negative figure before any comparison consumes it.
  const rawCash = gameState.stats?.money;
  const cash = typeof rawCash === 'number' && Number.isFinite(rawCash) ? Math.max(0, rawCash) : 0;
  const ownedIds = gameState.luxuryItems;

  const owned = useMemo(() => getOwnedLuxuryItems(ownedIds), [ownedIds]);
  const ownedIdSet = useMemo(() => new Set(owned.map((i) => i.id)), [owned]);
  const browseList = useMemo(() => LUXURY_CATALOG.filter((i) => !ownedIdSet.has(i.id)), [ownedIdSet]);

  // Holdings-aware: the headline collection value must match what the items
  // would actually sell for, and what net worth counts them at.
  const collectionValue = useMemo(
    () => getTotalLuxuryMarketValue(ownedIds, gameState.luxuryHoldings),
    [ownedIds, gameState.luxuryHoldings],
  );
  const stickerValue = useMemo(() => getTotalLuxuryValue(ownedIds), [ownedIds]);
  const weeklyUpkeep = useMemo(() => getTotalLuxuryUpkeep(ownedIds), [ownedIds]);
  const totalPrestige = useMemo(() => getTotalLuxuryPrestige(ownedIds), [ownedIds]);
  const lifeComplete = useMemo(() => isLuxuryLifeComplete(ownedIds), [ownedIds]);

  const queueSave = useCallback(() => {
    // A failed post-transaction save must not be invisible - surface it in
    // diagnostics even though the UI flow continues either way.
    saveGame().catch((error) => {
      logger.error('[LUXURY] Failed to save after transaction:', error);
    });
  }, [saveGame]);

  // The app-wide toast host (ToastContext) replaces the hand-rolled banner +
  // timer this screen used to own.
  const { showInfo } = useToast();
  const showToast = useCallback((message: string) => showInfo(message), [showInfo]);

  // ── Buy / sell flow (routed through ConfirmDialog + LuxuryActions) ──────────

  // The item sheet is a BaseModal (an RN Modal underneath), and ConfirmDialog is
  // another Modal. Opening the confirm while the sheet is still mounted can leave
  // the sheet's backdrop intercepting touches on iOS (the same stacked-modal
  // hazard the rewarded-ad flow works around), so the timer stays: sheet CTAs
  // stash the intent, dismiss the sheet, and promote the intent to a
  // ConfirmDialog once the native teardown has had time to settle. BaseModal
  // exposes no `onDismiss`, so the tracked timeout is now the only settler -
  // `settleSheetConfirm` is idempotent either way.
  const afterSheetConfirm = useRef<{ kind: 'buy' | 'sell'; item: LuxuryItem } | null>(null);
  const settleSheetConfirm = useCallback(() => {
    const next = afterSheetConfirm.current;
    afterSheetConfirm.current = null;
    if (!next) return;
    if (next.kind === 'buy') setPendingBuy(next.item);
    else setPendingSell(next.item);
  }, []);
  const requestFromSheet = useCallback(
    (kind: 'buy' | 'sell', item: LuxuryItem) => {
      if (kind === 'buy' && cash < item.price) {
        // Calm info toast (repo convention), never a red error.
        showToast(`You need ${formatMoney(item.price - cash)} more to buy the ${item.name}.`);
        return;
      }
      afterSheetConfirm.current = { kind, item };
      setSheetItem(null);
      timers.setTimeout(settleSheetConfirm, 450);
    },
    [cash, showToast, timers, settleSheetConfirm],
  );

  const requestBuy = useCallback(
    (item: LuxuryItem) => {
      if (cash < item.price) {
        // Calm info toast (repo convention), never a red error.
        showToast(`You need ${formatMoney(item.price - cash)} more to buy the ${item.name}.`);
        return;
      }
      setPendingBuy(item);
    },
    [cash, showToast],
  );

  const confirmBuy = useCallback(() => {
    const item = pendingBuy;
    setPendingBuy(null);
    if (!item) return;
    const result = purchaseLuxuryItem(gameState, setGameState, item.id);
    if (result.success) {
      queueSave();
      setSheetItem(null);
      showToast(`Bought the ${item.name}.`);
    } else {
      showToast(result.message);
    }
  }, [pendingBuy, gameState, setGameState, queueSave, showToast]);

  /** Run a luxury verb - race the horse, book a track day, loan the diamond. */
  const runVerb = useCallback(
    (verbId: string) => {
      const result = performLuxuryVerb(gameState, setGameState, verbId);
      // The outcome message IS the feedback - a win, a crash, a loan confirmed.
      showToast(result.message);
      if (result.success) queueSave();
    },
    [gameState, setGameState, queueSave, showToast],
  );

  /**
   * Insure / un-insure, and restore. These actions shipped with the Phase-5 risk
   * system and had ZERO call sites anywhere in the app, so the weekly incident
   * roll was one-way value destruction with no counterplay - the player could
   * watch a collection degrade and had no button to do anything about it.
   * 2026-07-28 audit reach-2.
   */
  const runInsure = useCallback(
    (itemId: string, insured: boolean) => {
      const result = setLuxuryInsurance(gameState, setGameState, itemId, insured);
      showToast(result.message);
      if (result.success) queueSave();
    },
    [gameState, setGameState, queueSave, showToast],
  );

  const runRestore = useCallback(
    (itemId: string) => {
      const result = restoreLuxuryItem(gameState, setGameState, itemId);
      showToast(result.message);
      if (result.success) queueSave();
    },
    [gameState, setGameState, queueSave, showToast],
  );

  /** Throw something at a venue you own. */
  const runHost = useCallback(
    (itemId: string, tier: string) => {
      const result = hostLuxuryEvent(gameState, setGameState, itemId, tier);
      showToast(result.message);
      if (result.success) queueSave();
    },
    [gameState, setGameState, queueSave, showToast],
  );

  const confirmSell = useCallback(() => {
    const item = pendingSell;
    setPendingSell(null);
    if (!item) return;
    const result = sellLuxuryItem(gameState, setGameState, item.id);
    if (result.success) {
      queueSave();
      setSheetItem(null);
      // The action returns the amount it actually paid (re-priced inside its
      // updater), so quote that instead of recomputing a second answer here.
      showToast(result.message);
    } else {
      showToast(result.message);
    }
  }, [pendingSell, gameState, setGameState, queueSave, showToast]);

  // ── Stateless render helpers (called as functions - no remount churn) ───────

  // "Luxury Life" progress module - real progress computed from state/selectors.
  const renderLuxuryLife = () => {
    const itemFrac = clampUnit(owned.length / LUXURY_LIFE_MIN_ITEMS);
    const valueFrac = clampUnit(stickerValue / LUXURY_LIFE_VALUE_THRESHOLD);
    const frac = lifeComplete ? 1 : Math.max(itemFrac, valueFrac);
    const barColor = lifeComplete ? EMERALD : IDENTITY;
    return (
      <View
        style={[
          getGlassCard(darkMode, 10),
          styles.hero,
          { backgroundColor: theme.surface, borderColor: darkMode ? theme.glassBorder : theme.border },
        ]}
      >
        <View style={styles.heroInner}>
          <View style={styles.heroRow}>
            <View
              style={[
                getGlassIconContainer(darkMode, 44),
                {
                  backgroundColor: withAlpha(barColor, 0.15),
                  borderColor: withAlpha(barColor, 0.3),
                },
              ]}
            >
              {lifeComplete ? <BadgeCheck size={scale(22)} color={EMERALD} /> : <Trophy size={scale(22)} color={IDENTITY} />}
            </View>
            <View style={styles.heroText}>
              <Text style={[styles.heroEyebrow, { color: theme.textMuted }]}>LUXURY LIFE</Text>
              <Text style={[styles.heroValue, { color: theme.text }]} numberOfLines={1}>
                {lifeComplete ? 'Achieved' : `${owned.length} / ${LUXURY_LIFE_MIN_ITEMS} collectibles`}
              </Text>
              {lifeComplete ? null : (
                <Text style={[styles.heroSub, { color: theme.textMuted }]} numberOfLines={1}>
                  or {formatMoney(stickerValue)} / {formatMoney(LUXURY_LIFE_VALUE_THRESHOLD)} in trophies
                </Text>
              )}
            </View>
          </View>

          <ProgressBar value={frac} color={barColor} label={`Luxury Life ${Math.round(frac * 100)} percent`} />
        </View>
      </View>
    );
  };

  /**
   * Collection showcase - ONE card. It used to stack two heroes (Luxury Life
   * progress + a collection summary) and seven set rows above the first trophy,
   * so the thing the tab is named after was three screens down. The three
   * numbers stay; the sets fold, and the fold's summary still says how many
   * are complete.
   */
  const renderCollectionSummary = () => {
    const progress = getAllCollectionProgress(gameState.luxuryItems);
    const title = getLuxuryTitle(gameState.luxuryItems);
    const completeCount = progress.filter((p) => p.complete).length;

    return (
      <View
        style={[
          getGlassCard(darkMode, 6),
          styles.summaryCard,
          { backgroundColor: theme.surface, borderColor: theme.border },
        ]}
      >
        <SectionTitle title="Collection" subtitle={title ?? undefined} />
        <StatStrip
          items={[
            { label: 'Collection value', value: formatMoney(collectionValue) },
            { label: 'Upkeep/wk', value: formatMoney(weeklyUpkeep), tint: AMBER },
            { label: 'Owned', value: `${owned.length}/${LUXURY_LIFE_MIN_ITEMS}`, sub: `+${totalPrestige} prestige` },
          ]}
        />

        <CollapsibleSection
          id="luxury-collections"
          title="Collections"
          compact
          defaultCollapsed
          summary={`${completeCount} of ${progress.length} complete`}
        >
          <View style={styles.setList}>
            {progress.map((p) => (
              <View key={p.collection.id} style={styles.setRow}>
                <View style={styles.setHead}>
                  <Text style={styles.setEmoji}>{p.collection.emoji}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.setName, { color: theme.text }]} numberOfLines={1}>
                      {p.collection.name}
                    </Text>
                    <Text style={[styles.setDesc, { color: theme.textMuted }]} numberOfLines={2}>
                      {p.complete ? `Complete - you are ${p.collection.title}.` : p.collection.description}
                    </Text>
                  </View>
                  <Text style={[styles.setCount, { color: p.complete ? EMERALD : theme.textMuted }]}>
                    {p.owned}/{p.total}
                  </Text>
                </View>
                <ProgressBar
                  value={p.total > 0 ? clampUnit(p.owned / p.total) : 0}
                  color={p.complete ? EMERALD : IDENTITY}
                  label={`${p.collection.name} ${p.owned} of ${p.total}`}
                />
              </View>
            ))}
          </View>
        </CollapsibleSection>
      </View>
    );
  };

  // Item detail sheet (bottom sheet) - large artwork, full stats, cost of
  // ownership, and Buy/Sell. Only mounted when an item is selected.
  const renderSheet = () => {
    if (!sheetItem) return null;
    const item = sheetItem;
    const isOwned = ownedIdSet.has(item.id);
    const resale = getLuxuryHoldingValue(item, gameState.luxuryHoldings?.[item.id]);
    const affordable = cash >= item.price;
    const tv = luxuryTierVisual(item.tier);

    const cta = isOwned ? (
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => requestFromSheet('sell', item)}
        style={[styles.sheetCta, { backgroundColor: withAlpha(AMBER, 0.14), borderColor: withAlpha(AMBER, 0.4) }]}
        accessibilityRole="button"
        accessibilityLabel={`Sell ${item.name} for ${formatMoney(resale)}`}
      >
        <Tag size={scale(16)} color={AMBER} />
        <Text style={[styles.sheetCtaText, { color: AMBER }]}>Sell {formatMoney(resale)}</Text>
      </TouchableOpacity>
    ) : (
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => requestFromSheet('buy', item)}
        style={[styles.sheetCta, affordable ? { backgroundColor: IDENTITY, borderColor: IDENTITY } : { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}
        accessibilityRole="button"
        accessibilityLabel={
          affordable ? `Buy ${item.name} for ${formatMoney(item.price)}` : `Not enough cash for ${item.name}`
        }
      >
        <ShoppingBag size={scale(16)} color={affordable ? '#FFFFFF' : theme.textMuted} />
        <Text style={[styles.sheetCtaText, { color: affordable ? '#FFFFFF' : theme.textMuted }]}>
          {affordable ? `Buy ${formatMoney(item.price)}` : `Need ${formatMoney(item.price - cash)} more`}
        </Text>
      </TouchableOpacity>
    );

    return (
      <BaseModal
        visible
        onClose={() => setSheetItem(null)}
        title={item.name}
        variant="bottom"
        scrollable
        footer={cta}
      >
        <View style={styles.sheetBody}>
              <View style={[styles.sheetHeroBox, { height: scale(190), borderColor: theme.border }]}>
                <ArtworkBanner item={item} emojiSize={scale(88)} />
                <View style={[styles.tierChip, { backgroundColor: tv.accentSoft, borderColor: tv.accentBorder }]}>
                  <Text style={[styles.tierChipText, { color: tv.accent }]}>{tv.label}</Text>
                </View>
                {isOwned ? (
                  <View style={[styles.statePill, { backgroundColor: withAlpha(EMERALD, 0.92) }]}>
                    <BadgeCheck size={scale(12)} color="#FFFFFF" />
                    <Text style={styles.statePillText}>Owned</Text>
                  </View>
                ) : (
                  <View style={styles.detailPricePill}>
                    <Text style={styles.detailPriceText}>{formatMoney(item.price)}</Text>
                  </View>
                )}
              </View>

              <Text style={[styles.sheetDesc, { color: theme.textSecondary }]}>{item.description}</Text>

              <ItemStatChips item={item} />

              {/* Total cost of ownership. */}
              <View style={[styles.ownershipCard, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
                <View style={styles.ownershipRow}>
                  <Text style={[styles.ownershipLabel, { color: theme.textMuted }]}>Purchase price</Text>
                  <Text style={[styles.ownershipValue, { color: theme.text }]}>{formatMoney(item.price)}</Text>
                </View>
                <View style={styles.ownershipRow}>
                  <Text style={[styles.ownershipLabel, { color: theme.textMuted }]}>Weekly upkeep</Text>
                  <Text style={[styles.ownershipValue, { color: theme.text }]}>{formatMoney(item.weeklyUpkeep)}/wk</Text>
                </View>
                <View style={styles.ownershipRow}>
                  <Text style={[styles.ownershipLabel, { color: theme.textMuted }]}>Resale value</Text>
                  <Text style={[styles.ownershipValue, { color: theme.text }]}>{formatMoney(resale)}</Text>
                </View>
                <View style={[styles.ownershipRow, styles.ownershipTotalRow, { borderTopColor: theme.border }]}>
                  <Text style={[styles.ownershipLabel, { color: theme.textSecondary }]}>First-year cost</Text>
                  <Text style={[styles.ownershipValue, { color: theme.text }]}>
                    {formatMoney(item.price + item.weeklyUpkeep * 52)}
                  </Text>
                </View>
              </View>

              {/* VERBS - the things you can DO with it. A trophy that can only
                  be bought and sold is the least interactive object in the game
                  despite being the most expensive. Shown only when owned. */}
              {/* HOSTING - the collection becomes a social life. The rest of
                  what you own decides who turns up, so a broader collection is
                  a better room and every unrelated trophy improves every party. */}
              {isOwned && isHostingVenue(item.id) ? (
                <View style={[styles.ownershipCard, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
                  <Text style={[styles.verbLabel, { color: theme.text }]}>Entertain</Text>
                  <Text style={[styles.verbDesc, { color: theme.textMuted }]}>
                    {getGuestList(gameState).summary}
                  </Text>
                  {EVENT_TIERS.map((spec) => {
                    const quote = quoteEvent(gameState, item.id, spec.tier);
                    const availability = getHostingAvailability(gameState, item.id, spec.tier);
                    if (!quote) return null;
                    return (
                      <TouchableOpacity
                        key={spec.tier}
                        activeOpacity={availability.available ? 0.85 : 1}
                        disabled={!availability.available}
                        onPress={() => runHost(item.id, spec.tier)}
                        style={[styles.verbRow, !availability.available && styles.verbRowDisabled]}
                        accessibilityRole="button"
                        accessibilityLabel={`${spec.label} for ${formatMoney(quote.cost)}`}
                      >
                        <View style={styles.verbInfo}>
                          <Text style={[styles.verbLabel, { color: theme.text }]}>{spec.label}</Text>
                          <Text style={[styles.verbDesc, { color: theme.textMuted }]} numberOfLines={2}>
                            {availability.available
                              ? `+${quote.reputation} reputation · ${quote.guestsReached} guests`
                              : availability.reason}
                          </Text>
                        </View>
                        <Text
                          style={[
                            styles.verbCta,
                            { color: availability.available ? EMERALD : theme.textMuted },
                          ]}
                        >
                          {formatMoney(quote.cost)}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ) : null}

              {/* CARE - condition, insurance and restoration. The weekly risk
                  roll can damage or destroy an item; this is where the player
                  answers it. Without these controls the risk system was pure
                  loss with no decision attached (reach-2). */}
              {isOwned ? (() => {
                const holding = gameState.luxuryHoldings?.[item.id];
                const condition = getCondition(holding);
                const insured = holding?.insured === true;
                const premium = getItemPremium(item, holding);
                const expectedLoss = getExpectedWeeklyLoss(item, holding);
                const restoreCost = getRestoreCost(item, holding);
                const conditionColor =
                  condition < CONDITION_POOR ? AMBER : condition < 90 ? theme.text : EMERALD;
                return (
                  <View style={[styles.ownershipCard, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
                    <View style={styles.ownershipRow}>
                      <Text style={[styles.ownershipLabel, { color: theme.textMuted }]}>Condition</Text>
                      <Text style={[styles.ownershipValue, { color: conditionColor }]}>
                        {Math.round(condition)}%
                      </Text>
                    </View>

                    <TouchableOpacity
                      activeOpacity={0.85}
                      onPress={() => runInsure(item.id, !insured)}
                      style={styles.verbRow}
                      accessibilityRole="button"
                      accessibilityLabel={insured ? `Cancel insurance on ${item.name}` : `Insure ${item.name}`}
                    >
                      <View style={styles.verbInfo}>
                        <Text style={[styles.verbLabel, { color: theme.text }]}>
                          {insured ? 'Cancel insurance' : 'Insure it'}
                        </Text>
                        <Text style={[styles.verbDesc, { color: theme.textMuted }]} numberOfLines={2}>
                          {insured
                            ? `Costing ${formatMoney(premium)}/wk. Claims cover all but the deductible.`
                            : `${formatMoney(premium)}/wk against an average ${formatMoney(expectedLoss)}/wk of risk.`}
                        </Text>
                      </View>
                      <Text style={[styles.verbCta, { color: insured ? AMBER : EMERALD }]}>
                        {insured ? 'Stop' : formatMoney(premium)}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      activeOpacity={restoreCost > 0 ? 0.85 : 1}
                      disabled={restoreCost <= 0}
                      onPress={() => runRestore(item.id)}
                      style={[styles.verbRow, restoreCost <= 0 && styles.verbRowDisabled]}
                      accessibilityRole="button"
                      accessibilityLabel={
                        restoreCost > 0 ? `Repair ${item.name} for ${formatMoney(restoreCost)}` : `${item.name} needs no repair`
                      }
                    >
                      <View style={styles.verbInfo}>
                        <Text style={[styles.verbLabel, { color: theme.text }]}>Repair</Text>
                        <Text style={[styles.verbDesc, { color: theme.textMuted }]} numberOfLines={2}>
                          {restoreCost > 0
                            ? 'Bring it back to pristine. Condition is part of what it sells for.'
                            : 'Already in perfect condition.'}
                        </Text>
                      </View>
                      <Text style={[styles.verbCta, { color: restoreCost > 0 ? EMERALD : theme.textMuted }]}>
                        {restoreCost > 0 ? formatMoney(restoreCost) : '-'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                );
              })() : null}

              {isOwned && verbsForItem(item.id).length > 0 ? (
                <View style={[styles.ownershipCard, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
                  {verbsForItem(item.id).map((verb) => {
                    const availability = getVerbAvailability(verb, gameState);
                    return (
                      <TouchableOpacity
                        key={verb.id}
                        activeOpacity={availability.available ? 0.85 : 1}
                        disabled={!availability.available}
                        onPress={() => runVerb(verb.id)}
                        style={[styles.verbRow, !availability.available && styles.verbRowDisabled]}
                        accessibilityRole="button"
                        accessibilityLabel={verb.label}
                      >
                        <View style={styles.verbInfo}>
                          <Text style={[styles.verbLabel, { color: theme.text }]}>{verb.label}</Text>
                          <Text style={[styles.verbDesc, { color: theme.textMuted }]} numberOfLines={2}>
                            {availability.available ? verb.description : availability.reason}
                          </Text>
                        </View>
                        <Text
                          style={[
                            styles.verbCta,
                            { color: availability.available ? EMERALD : theme.textMuted },
                          ]}
                        >
                          {verb.cost > 0 ? formatMoney(verb.cost) : 'Go'}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ) : null}

        </View>
      </BaseModal>
    );
  };

  // ── Screen ──────────────────────────────────────────────────────────────────

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <AppHeader
        title="Luxury & Collectibles"
        onBack={onBack}
        right={<CashChip value={formatMoney(cash)} tint={IDENTITY} />}
      />

      <SegmentedControl
        segments={TABS.map((t) => ({
          key: t.key,
          label: t.key === 'collection' ? `Collection (${owned.length})` : t.label,
          icon: t.icon,
        }))}
        value={tab}
        onChange={setTab}
        activeColor={IDENTITY}
        style={styles.tabs}
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{
          padding: responsiveSpacing.md,
          paddingBottom: getAppScreenBottomPadding(insets.bottom),
          gap: responsiveSpacing.md,
        }}
        showsVerticalScrollIndicator={false}
      >
        {tab === 'browse' ? (
          <>
            {renderLuxuryLife()}
            <SectionTitle title="Buy" />
            {browseList.length > 0 ? (
              browseList.map((item) => (
                <LuxuryCard
                  key={item.id}
                  item={item}
                  isOwned={false}
                  darkMode={darkMode}
                  theme={theme}
                  cash={cash}
                  holding={gameState.luxuryHoldings?.[item.id]}
                  onOpen={setSheetItem}
                  onBuy={requestBuy}
                  onSell={setPendingSell}
                />
              ))
            ) : (
              <EmptyState
                icon={<Crown size={scale(26)} color={IDENTITY} />}
                observation="You own every item in the catalog."
                nudge="Your Collection tab is where you manage or resell them."
                ctaLabel="Open collection"
                onCtaPress={() => setTab('collection')}
              />
            )}
          </>
        ) : owned.length > 0 ? (
          <>
            {renderCollectionSummary()}
            <SectionTitle title="Your trophies" />
            {owned.map((item) => (
              <LuxuryCard
                key={item.id}
                item={item}
                isOwned
                darkMode={darkMode}
                theme={theme}
                cash={cash}
                holding={gameState.luxuryHoldings?.[item.id]}
                onOpen={setSheetItem}
                onBuy={requestBuy}
                onSell={setPendingSell}
              />
            ))}
          </>
        ) : (
          <EmptyState
            icon={<Gem size={scale(26)} color={IDENTITY} />}
            observation="No trophies yet."
            nudge="A collectible pays happiness and prestige every week you own it."
            ctaLabel="Browse catalog"
            onCtaPress={() => setTab('browse')}
          />
        )}
      </ScrollView>

      {renderSheet()}

      {/* Purchase confirm - blue identity, celebratory. */}
      <ConfirmDialog
        visible={!!pendingBuy}
        type="default"
        title={pendingBuy ? `Buy the ${pendingBuy.name}?` : ''}
        message={
          pendingBuy
            ? `${formatMoney(pendingBuy.price)} upfront, then ${formatMoney(pendingBuy.weeklyUpkeep)}/wk upkeep. You'll have ${formatMoney(Math.max(0, cash - pendingBuy.price))} left.`
            : ''
        }
        confirmText="Buy"
        cancelText="Cancel"
        icon={<Crown size={scale(28)} color="#FFFFFF" strokeWidth={2.2} />}
        onConfirm={confirmBuy}
        onCancel={() => setPendingBuy(null)}
      />

      {/* Resale confirm - amber (cautionary, lossy but reversible), not the red
          destructive path. A sold trophy can be re-bought, so `warning` fits. */}
      <ConfirmDialog
        visible={!!pendingSell}
        type="warning"
        title={pendingSell ? `Sell the ${pendingSell.name}?` : ''}
        message={
          pendingSell
            ? `You'll get ${formatMoney(getLuxuryHoldingValue(pendingSell, gameState.luxuryHoldings?.[pendingSell.id]))} back - ${Math.round((getLuxuryHoldingValue(pendingSell, gameState.luxuryHoldings?.[pendingSell.id]) / pendingSell.price) * 100)}% of the ${formatMoney(pendingSell.price)} you paid.`
            : ''
        }
        confirmText="Sell"
        cancelText="Keep"
        onConfirm={confirmSell}
        onCancel={() => setPendingSell(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  tabs: { marginHorizontal: responsiveSpacing.md, marginBottom: responsiveSpacing.sm },
  summaryCard: { borderWidth: 1, borderRadius: responsiveBorderRadius.xl, padding: responsiveSpacing.md, gap: responsiveSpacing.sm },
  setList: { gap: responsiveSpacing.sm, paddingTop: responsiveSpacing.xs },
  sheetBody: { gap: responsiveSpacing.md },

  // Tabs.
  scroll: { flex: 1 },

  // Recipe B hero (progress module + collection summary).
  hero: { borderWidth: 1, borderRadius: responsiveBorderRadius['2xl'] },
  heroInner: {
    borderRadius: responsiveBorderRadius['2xl'],
    overflow: 'hidden',
    padding: responsiveSpacing.lg,
    gap: responsiveSpacing.md,
  },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: responsiveSpacing.md },
  heroText: { flex: 1 },
  heroEyebrow: { fontSize: responsiveFontSize.xs, fontWeight: '600', letterSpacing: 0.8 },
  heroValue: { fontSize: responsiveFontSize['2xl'], fontWeight: '700', marginTop: 2, fontVariant: ['tabular-nums'] },
  heroSub: { fontSize: responsiveFontSize.xs, marginTop: 4, fontVariant: ['tabular-nums'] },
  setRow: { gap: responsiveSpacing.xs },
  setHead: { flexDirection: 'row', alignItems: 'center', gap: responsiveSpacing.sm },
  setEmoji: { fontSize: responsiveFontSize.xl },
  setName: { fontSize: responsiveFontSize.md, fontWeight: '600' },
  setDesc: { fontSize: responsiveFontSize.sm, marginTop: scale(2) },
  setCount: { fontSize: responsiveFontSize.md, fontWeight: '600', fontVariant: ['tabular-nums'] },

  // Mini-stat strip (collection summary).

  // Catalog / collection card.
  card: { borderWidth: 1, borderRadius: responsiveBorderRadius.xl },
  cardInner: { borderRadius: responsiveBorderRadius.xl, overflow: 'hidden' },
  bannerBox: { width: '100%' },
  bannerFill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width: '100%', height: '100%' },
  bannerEmojiWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  bannerEmoji: { opacity: 0.9, textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 18 },
  tierChip: {
    position: 'absolute',
    top: scale(10),
    left: scale(10),
    paddingHorizontal: scale(8),
    paddingVertical: 3,
    borderRadius: responsiveBorderRadius.full,
    borderWidth: 1,
  },
  tierChipText: { fontSize: responsiveFontSize.xs, fontWeight: '600', letterSpacing: 0.8 },
  pricePill: {
    position: 'absolute',
    left: scale(10),
    bottom: scale(10),
    paddingHorizontal: scale(10),
    paddingVertical: 5,
    borderRadius: responsiveBorderRadius.lg,
    backgroundColor: 'rgba(0, 0, 0, 0.62)',
  },
  pricePillText: { color: '#FFFFFF', fontSize: responsiveFontSize.lg, fontWeight: '600', fontVariant: ['tabular-nums'] },
  statePill: {
    position: 'absolute',
    left: scale(10),
    bottom: scale(10),
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: scale(9),
    paddingVertical: 4,
    borderRadius: responsiveBorderRadius.full,
  },
  statePillText: { color: '#FFFFFF', fontSize: responsiveFontSize.xs, fontWeight: '600' },
  cardBody: { padding: responsiveSpacing.md, gap: responsiveSpacing.sm },
  cardTitleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: responsiveSpacing.xs },
  cardName: { flex: 1, fontSize: responsiveFontSize.md, fontWeight: '600', lineHeight: responsiveFontSize.md * 1.3 },
  cardResale: { fontSize: responsiveFontSize.xs, fontWeight: '600', marginTop: -2, fontVariant: ['tabular-nums'] },

  // Stat chips.
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: responsiveSpacing.xs },

  // Card footer buttons.
  cardFooter: {
    flexDirection: 'row',
    gap: responsiveSpacing.sm,
    paddingHorizontal: responsiveSpacing.md,
    paddingBottom: responsiveSpacing.md,
  },
  buyBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: touchTargets.minimum,
    borderRadius: responsiveBorderRadius.full,
  },
  buyBtnText: { fontSize: responsiveFontSize.sm, fontWeight: '600', fontVariant: ['tabular-nums'] },
  sellBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: touchTargets.minimum,
    borderRadius: responsiveBorderRadius.full,
    backgroundColor: withAlpha(AMBER, 0.14),
    borderWidth: 1,
    borderColor: withAlpha(AMBER, 0.4),
  },
  sellBtnText: { color: AMBER, fontSize: responsiveFontSize.sm, fontWeight: '600', fontVariant: ['tabular-nums'] },

  // Empty states.

  // Detail sheet.
  sheetHeroBox: { width: '100%', borderRadius: responsiveBorderRadius.xl, borderWidth: 1, overflow: 'hidden' },
  sheetDesc: { fontSize: responsiveFontSize.sm, lineHeight: responsiveFontSize.sm * 1.5, marginTop: -responsiveSpacing.xs },
  detailPricePill: {
    position: 'absolute',
    left: scale(12),
    bottom: scale(12),
    paddingHorizontal: scale(12),
    paddingVertical: 6,
    borderRadius: responsiveBorderRadius.lg,
    backgroundColor: 'rgba(0, 0, 0, 0.62)',
  },
  detailPriceText: { color: '#FFFFFF', fontSize: responsiveFontSize.xl, fontWeight: '600', fontVariant: ['tabular-nums'] },
  ownershipCard: { borderWidth: 1, borderRadius: responsiveBorderRadius.lg, padding: responsiveSpacing.md, gap: responsiveSpacing.sm },
  verbRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(10),
    paddingVertical: scale(6),
    minHeight: touchTargets.minimum,
  },
  verbRowDisabled: { opacity: 0.5 },
  verbInfo: { flex: 1 },
  verbLabel: { fontSize: responsiveFontSize.base, fontWeight: '600' },
  verbDesc: { fontSize: responsiveFontSize.sm, fontWeight: '600', marginTop: scale(2) },
  verbCta: { fontSize: responsiveFontSize.base, fontWeight: '600' },
  ownershipRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  ownershipTotalRow: { borderTopWidth: 1, paddingTop: responsiveSpacing.sm },
  ownershipLabel: { fontSize: responsiveFontSize.sm, fontWeight: '500' },
  ownershipValue: { fontSize: responsiveFontSize.sm, fontWeight: '600', fontVariant: ['tabular-nums'] },
  sheetCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: responsiveSpacing.sm,
    paddingVertical: responsiveSpacing.md,
    borderRadius: responsiveBorderRadius.full,
    borderWidth: 1,
  },
  sheetCtaText: { fontSize: responsiveFontSize.md, fontWeight: '600', fontVariant: ['tabular-nums'] },

  // Toast.
});

export default function LuxuryApp(props: LuxuryAppProps) {
  return (
    <ErrorBoundary>
      <LuxuryAppInner {...props} />
    </ErrorBoundary>
  );
}
