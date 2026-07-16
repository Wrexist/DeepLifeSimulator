/**
 * LuxuryApp — desktop "Luxury & Collectibles" screen (premium redesign).
 *
 * An aspirational late-game cash sink hosted as a computer mini-app (same model
 * as RealEstateApp / GamingApp): browse an artwork-led catalog, buy with in-game
 * cash, and manage owned trophies (each has weekly upkeep + a happiness/prestige
 * benefit). This pass matches the game's redesign wave:
 *  - ARTWORK BANNER per item — a bundled Image (luxuryArt require map) with a
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
 * through the canonical applyMoneyDelta (stats.money only — never a mirrored bank
 * balance). This component never mutates money directly.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Modal,
  Animated,
  Easing,
} from 'react-native';
import {
  ArrowLeft,
  Crown,
  Gem,
  Trophy,
  Tag,
  X,
  Wallet,
  Heart,
  Award,
  ShoppingBag,
  ChevronRight,
  BadgeCheck,
  Info,
} from 'lucide-react-native';
import { useGame } from '@/contexts/GameContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ErrorBoundary from '@/components/ErrorBoundary';
import ConfirmDialog from '@/components/ConfirmDialog';
import LinearGradientFallback from '@/components/fallbacks/LinearGradientFallback';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import usePressableScale from '@/hooks/usePressableScale';
import { useTimerManager } from '@/hooks/useTimerManager';
import {
  responsiveFontSize,
  responsiveSpacing,
  responsiveBorderRadius,
  scale,
  getAppScreenBottomPadding,
} from '@/utils/scaling';
import { getThemeColors } from '@/lib/config/theme';
import { getGlassCard, getGlassIconContainer, getPlatformShadows } from '@/utils/glassmorphismStyles';
import { formatMoney } from '@/utils/moneyFormatting';
import { Z_INDEX } from '@/utils/zIndexConstants';
import {
  LUXURY_CATALOG,
  type LuxuryItem,
  getOwnedLuxuryItems,
  getTotalLuxuryResaleValue,
  getTotalLuxuryUpkeep,
  getTotalLuxuryValue,
  getTotalLuxuryPrestige,
  getLuxuryResaleValue,
  isLuxuryLifeComplete,
  LUXURY_LIFE_MIN_ITEMS,
  LUXURY_LIFE_VALUE_THRESHOLD,
} from '@/lib/luxury';
import { purchaseLuxuryItem, sellLuxuryItem } from '@/contexts/game/actions/LuxuryActions';
import { luxuryArtFor, luxuryTierVisual, LUXURY_ART_BASE } from '@/components/computer/luxury/luxuryArt';

const LinearGradient = LinearGradientFallback;

// Single blue identity accent for this app (Slate Glass semantic blue).
const IDENTITY = '#3B82F6';
const IDENTITY_LIGHT = '#60A5FA';
const IDENTITY_RGB = '59, 130, 246';
// Semantic colors preserved across the design wave: emerald = benefit/complete,
// amber = the cautionary (lossy but reversible) resale flow.
const EMERALD = '#10B981';
const AMBER = '#F59E0B';
const AMBER_SOFT = 'rgba(245, 158, 11, 0.14)';
const AMBER_BORDER = 'rgba(245, 158, 11, 0.4)';

// Entrance / press motion mirrors the shared house tokens (src/utils/animated
// MOTION): a 0.94→1 scale + short translateY reveal on an ease-out curve, kept
// under the 300ms UI budget. Easing is resolved defensively so environments
// without the native Easing module (the render-test RN mock) can't crash at load
// — the same guard the shared ConfirmDialog uses.
const ENTER_SCALE = 0.94;
const REVEAL_RISE = scale(10);
const STAGGER_STEP = 55;
const DURATION_BASE = 240;
const DURATION_FAST = 160;
const EASE_OUT = Easing?.bezier ? Easing.bezier(0.23, 1, 0.32, 1) : undefined;

type IconType = React.ComponentType<{ size?: number; color?: string }>;
type ThemeColors = ReturnType<typeof getThemeColors>;
type Tab = 'browse' | 'collection';

/**
 * Premium money display. The shared formatMoney is the single source of scale
 * (K/M/B/T/Q) + the app-wide abbreviation rule, but its zero-strip regex is
 * anchored to end-of-string, so the unit suffix defeats it and it emits e.g.
 * "$250.00K" — the exact ugly string in the owner's TestFlight complaint. Fixing
 * that shared util is out of scope for this redesign, so we delegate to it and
 * trim the cosmetic trailing zeros here → "$250K" / "$1.2M" / "$500M".
 */
function money(n: number): string {
  return formatMoney(n)
    .replace(/(\.\d*?)0+([KMBTQ])$/, '$1$2')
    .replace(/\.([KMBTQ])$/, '$1');
}

const clampUnit = (n: number): number => Math.max(0, Math.min(1, isFinite(n) ? n : 0));

/**
 * Staggered entrance wrapper — opacity + a short translateY rise, native-driven,
 * ease-out, no bounce. Honors the OS "Reduce Motion" setting by rendering static.
 */
function RevealItem({
  index,
  reduced,
  children,
}: {
  index: number;
  reduced: boolean;
  children: React.ReactNode;
}) {
  const progress = useRef(new Animated.Value(reduced ? 1 : 0)).current;

  useEffect(() => {
    if (reduced) {
      progress.setValue(1);
      return;
    }
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: DURATION_BASE,
      delay: index * STAGGER_STEP,
      easing: EASE_OUT,
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [index, reduced, progress]);

  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [REVEAL_RISE, 0] });
  const scaleIn = progress.interpolate({ inputRange: [0, 1], outputRange: [ENTER_SCALE, 1] });
  return (
    <Animated.View style={{ opacity: progress, transform: [{ translateY }, { scale: scaleIn }] }}>
      {children}
    </Animated.View>
  );
}

/**
 * Artwork banner — a bundled Image when present, otherwise a per-tier gradient
 * placeholder with the emoji rendered large + subtle (the graceful fallback).
 * Fills its (sized, overflow-clipped) parent; overlay chips are siblings.
 */
function ArtworkBanner({ item, emojiSize }: { item: LuxuryItem; emojiSize: number }) {
  const art = luxuryArtFor(item.id);
  const tv = luxuryTierVisual(item.tier);

  if (art) {
    return <Image source={art} style={styles.bannerFill} resizeMode="cover" />;
  }
  return (
    <View style={[styles.bannerFill, { backgroundColor: LUXURY_ART_BASE }]}>
      <LinearGradient
        pointerEvents="none"
        colors={tv.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View pointerEvents="none" style={[styles.bannerBlob, { backgroundColor: tv.accentSoft }]} />
      <View pointerEvents="none" style={styles.bannerEmojiWrap}>
        <Text style={[styles.bannerEmoji, { fontSize: emojiSize, textShadowColor: tv.accent }]}>
          {item.emoji}
        </Text>
      </View>
    </View>
  );
}

/** Small tinted chip: icon + value (upkeep / happiness / prestige). */
function StatChip({ Icon, color, bg, label }: { Icon: IconType; color: string; bg: string; label: string }) {
  return (
    <View style={[styles.statChip, { backgroundColor: bg }]}>
      <Icon size={scale(12)} color={color} />
      <Text style={[styles.statChipText, { color }]}>{label}</Text>
    </View>
  );
}

/** The upkeep / happiness / prestige chip trio shared by cards + the sheet. */
function ItemStatChips({ item, theme }: { item: LuxuryItem; theme: ThemeColors }) {
  return (
    <View style={styles.chipRow}>
      <StatChip
        Icon={Wallet}
        color={theme.textSecondary}
        bg={theme.surfaceElevated}
        label={`${money(item.weeklyUpkeep)}/wk`}
      />
      <StatChip Icon={Heart} color={EMERALD} bg="rgba(16, 185, 129, 0.12)" label={`+${item.happiness}`} />
      <StatChip Icon={Award} color={IDENTITY_LIGHT} bg={`rgba(${IDENTITY_RGB}, 0.12)`} label={`+${item.prestige}`} />
    </View>
  );
}

function SectionTitle({ theme, children }: { theme: ThemeColors; children: React.ReactNode }) {
  return <Text style={[styles.sectionTitle, { color: theme.text }]}>{children}</Text>;
}

/**
 * Catalog / collection card — artwork banner (tier chip + price/owned pill) over
 * a 2-line title, stat chips, and a footer with a Details affordance + a Buy or
 * Sell action. Module-level so its press + entrance animation stay stable across
 * parent re-renders (toast/sheet state changes).
 */
function LuxuryCard({
  item,
  index,
  isOwned,
  reduced,
  darkMode,
  theme,
  cash,
  onOpen,
  onBuy,
  onSell,
}: {
  item: LuxuryItem;
  index: number;
  isOwned: boolean;
  reduced: boolean;
  darkMode: boolean;
  theme: ThemeColors;
  cash: number;
  onOpen: (item: LuxuryItem) => void;
  onBuy: (item: LuxuryItem) => void;
  onSell: (item: LuxuryItem) => void;
}) {
  const tv = luxuryTierVisual(item.tier);
  const resale = getLuxuryResaleValue(item);
  const affordable = cash >= item.price;
  const press = usePressableScale({ scale: 0.97, haptic: false });

  return (
    <RevealItem index={index} reduced={reduced}>
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
              accessibilityLabel={`${item.name}, ${money(item.price)}${isOwned ? ', owned' : ''}. View details`}
            >
              <View style={[styles.bannerBox, { height: scale(132) }]}>
                <ArtworkBanner item={item} emojiSize={scale(54)} />
                <View style={[styles.tierChip, { backgroundColor: tv.accentSoft, borderColor: tv.accentBorder }]}>
                  <Text style={[styles.tierChipText, { color: tv.accent }]}>{tv.label}</Text>
                </View>
                {isOwned ? (
                  <View style={[styles.statePill, { backgroundColor: 'rgba(16, 185, 129, 0.92)' }]}>
                    <BadgeCheck size={scale(12)} color="#FFFFFF" />
                    <Text style={styles.statePillText}>Owned</Text>
                  </View>
                ) : (
                  <View style={styles.pricePill}>
                    <Text style={styles.pricePillText}>{money(item.price)}</Text>
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
                {isOwned && (
                  <Text style={[styles.cardResale, { color: theme.textMuted }]}>Resale {money(resale)}</Text>
                )}
                <ItemStatChips item={item} theme={theme} />
              </View>
            </TouchableOpacity>

            <View style={styles.cardFooter}>
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => onOpen(item)}
                style={[styles.ghostBtn, { borderColor: theme.border }]}
                accessibilityRole="button"
                accessibilityLabel={`View ${item.name} details`}
              >
                <Text style={[styles.ghostBtnText, { color: theme.textSecondary }]}>Details</Text>
              </TouchableOpacity>
              {isOwned ? (
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() => onSell(item)}
                  style={styles.sellBtn}
                  accessibilityRole="button"
                  accessibilityLabel={`Sell ${item.name} for ${money(resale)}`}
                >
                  <Tag size={scale(14)} color={AMBER} />
                  <Text style={styles.sellBtnText}>Sell {money(resale)}</Text>
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
                      ? `Buy ${item.name} for ${money(item.price)}`
                      : `${item.name} costs ${money(item.price)}, more than your cash`
                  }
                >
                  <ShoppingBag size={scale(14)} color={affordable ? '#FFFFFF' : theme.textMuted} />
                  <Text style={[styles.buyBtnText, { color: affordable ? '#FFFFFF' : theme.textMuted }]}>
                    {affordable ? 'Buy' : money(item.price)}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </press.AnimatedView>
    </RevealItem>
  );
}

interface LuxuryAppProps {
  onBack: () => void;
}

function LuxuryAppInner({ onBack }: LuxuryAppProps) {
  const { gameState, setGameState, saveGame } = useGame();
  const insets = useSafeAreaInsets();
  const timers = useTimerManager();
  const reducedMotion = useReducedMotion();
  const darkMode = !!gameState.settings?.darkMode;
  const theme = getThemeColors(darkMode);

  const [tab, setTab] = useState<Tab>('browse');
  const [sheetItem, setSheetItem] = useState<LuxuryItem | null>(null);
  const [pendingBuy, setPendingBuy] = useState<LuxuryItem | null>(null);
  const [pendingSell, setPendingSell] = useState<LuxuryItem | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const cash = gameState.stats?.money ?? 0;
  const ownedIds = gameState.luxuryItems;

  const owned = useMemo(() => getOwnedLuxuryItems(ownedIds), [ownedIds]);
  const ownedIdSet = useMemo(() => new Set(owned.map((i) => i.id)), [owned]);
  const browseList = useMemo(() => LUXURY_CATALOG.filter((i) => !ownedIdSet.has(i.id)), [ownedIdSet]);

  const collectionValue = useMemo(() => getTotalLuxuryResaleValue(ownedIds), [ownedIds]);
  const stickerValue = useMemo(() => getTotalLuxuryValue(ownedIds), [ownedIds]);
  const weeklyUpkeep = useMemo(() => getTotalLuxuryUpkeep(ownedIds), [ownedIds]);
  const totalPrestige = useMemo(() => getTotalLuxuryPrestige(ownedIds), [ownedIds]);
  const lifeComplete = useMemo(() => isLuxuryLifeComplete(ownedIds), [ownedIds]);

  // Bottom-sheet entrance: a short translateY rise (1 = closed/offset, 0 = open).
  const sheetAnim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!sheetItem) return;
    sheetAnim.setValue(reducedMotion ? 0 : 1);
    const animation = Animated.timing(sheetAnim, {
      toValue: 0,
      duration: reducedMotion ? DURATION_FAST : DURATION_BASE,
      easing: EASE_OUT,
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [sheetItem, reducedMotion, sheetAnim]);
  const sheetTranslate = sheetAnim.interpolate({ inputRange: [0, 1], outputRange: [0, scale(48)] });

  const queueSave = useCallback(() => {
    saveGame().catch(() => {});
  }, [saveGame]);

  const showToast = useCallback(
    (message: string) => {
      setToast(message);
      timers.setTimeout(() => setToast(null), 2600);
    },
    [timers],
  );

  // ── Buy / sell flow (routed through ConfirmDialog + LuxuryActions) ──────────

  const requestBuy = useCallback(
    (item: LuxuryItem) => {
      if (cash < item.price) {
        // Calm info toast (repo convention), never a red error.
        showToast(`You need ${money(item.price - cash)} more to acquire the ${item.name}.`);
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
      showToast(`Acquired the ${item.name}. ${item.emoji}`);
    } else {
      showToast(result.message);
    }
  }, [pendingBuy, gameState, setGameState, queueSave, showToast]);

  const confirmSell = useCallback(() => {
    const item = pendingSell;
    setPendingSell(null);
    if (!item) return;
    const result = sellLuxuryItem(gameState, setGameState, item.id);
    if (result.success) {
      queueSave();
      setSheetItem(null);
      showToast(`Sold the ${item.name} for ${money(getLuxuryResaleValue(item))}.`);
    } else {
      showToast(result.message);
    }
  }, [pendingSell, gameState, setGameState, queueSave, showToast]);

  // ── Stateless render helpers (called as functions — no remount churn) ───────

  // "Luxury Life" progress module — real progress computed from state/selectors.
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
          <LinearGradient
            pointerEvents="none"
            colors={
              lifeComplete
                ? ['rgba(16, 185, 129, 0.14)', 'rgba(16, 185, 129, 0.03)']
                : [`rgba(${IDENTITY_RGB}, 0.14)`, `rgba(${IDENTITY_RGB}, 0.03)`]
            }
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <View
            pointerEvents="none"
            style={[
              styles.heroBlob,
              { backgroundColor: lifeComplete ? 'rgba(16, 185, 129, 0.10)' : `rgba(${IDENTITY_RGB}, 0.10)` },
            ]}
          />
          {darkMode && <View pointerEvents="none" style={styles.heroHairline} />}

          <View style={styles.heroRow}>
            <View
              style={[
                getGlassIconContainer(darkMode, 44),
                {
                  backgroundColor: lifeComplete ? 'rgba(16, 185, 129, 0.15)' : `rgba(${IDENTITY_RGB}, 0.15)`,
                  borderColor: lifeComplete ? 'rgba(16, 185, 129, 0.3)' : `rgba(${IDENTITY_RGB}, 0.3)`,
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
              <Text style={[styles.heroSub, { color: theme.textMuted }]} numberOfLines={1}>
                {lifeComplete
                  ? 'A collection worth showing off.'
                  : `or ${money(stickerValue)} / ${money(LUXURY_LIFE_VALUE_THRESHOLD)} in trophies`}
              </Text>
            </View>
          </View>

          <View style={[styles.progressTrack, { backgroundColor: darkMode ? 'rgba(255,255,255,0.08)' : theme.surfaceElevated }]}>
            <View style={[styles.progressFill, { width: `${Math.max(3, frac * 100)}%`, backgroundColor: barColor }]} />
          </View>
        </View>
      </View>
    );
  };

  // Collection showcase summary — value / upkeep / prestige at a glance.
  const renderCollectionSummary = () => (
    <View
      style={[
        getGlassCard(darkMode, 10),
        styles.hero,
        { backgroundColor: theme.surface, borderColor: darkMode ? theme.glassBorder : theme.border },
      ]}
    >
      <View style={styles.heroInner}>
        <LinearGradient
          pointerEvents="none"
          colors={[`rgba(${IDENTITY_RGB}, 0.14)`, `rgba(${IDENTITY_RGB}, 0.03)`]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <View pointerEvents="none" style={[styles.heroBlob, { backgroundColor: `rgba(${IDENTITY_RGB}, 0.10)` }]} />
        {darkMode && <View pointerEvents="none" style={styles.heroHairline} />}

        <View style={styles.heroRow}>
          <View
            style={[
              getGlassIconContainer(darkMode, 44),
              { backgroundColor: `rgba(${IDENTITY_RGB}, 0.15)`, borderColor: `rgba(${IDENTITY_RGB}, 0.3)` },
            ]}
          >
            <Crown size={scale(22)} color={IDENTITY} />
          </View>
          <View style={styles.heroText}>
            <Text style={[styles.heroEyebrow, { color: theme.textMuted }]}>COLLECTION VALUE</Text>
            <Text style={[styles.heroValue, { color: theme.text }]} numberOfLines={1}>
              {money(collectionValue)}
            </Text>
            <Text style={[styles.heroSub, { color: theme.textMuted }]} numberOfLines={1}>
              {owned.length} {owned.length === 1 ? 'trophy' : 'trophies'} · resale value
            </Text>
          </View>
        </View>

        <View style={styles.miniStatRow}>
          <View style={styles.miniStat}>
            <Wallet size={scale(14)} color={theme.textMuted} />
            <Text style={[styles.miniStatValue, { color: theme.text }]}>{money(weeklyUpkeep)}</Text>
            <Text style={[styles.miniStatLabel, { color: theme.textMuted }]}>upkeep/wk</Text>
          </View>
          <View style={[styles.miniStatDivider, { backgroundColor: theme.border }]} />
          <View style={styles.miniStat}>
            <Award size={scale(14)} color={IDENTITY_LIGHT} />
            <Text style={[styles.miniStatValue, { color: theme.text }]}>+{totalPrestige}</Text>
            <Text style={[styles.miniStatLabel, { color: theme.textMuted }]}>prestige</Text>
          </View>
          <View style={[styles.miniStatDivider, { backgroundColor: theme.border }]} />
          <View style={styles.miniStat}>
            <Trophy size={scale(14)} color={EMERALD} />
            <Text style={[styles.miniStatValue, { color: theme.text }]}>{owned.length}</Text>
            <Text style={[styles.miniStatLabel, { color: theme.textMuted }]}>owned</Text>
          </View>
        </View>
      </View>
    </View>
  );

  // Item detail sheet (bottom sheet) — large artwork, full stats, cost of
  // ownership, and Buy/Sell. Only mounted when an item is selected.
  const renderSheet = () => {
    if (!sheetItem) return null;
    const item = sheetItem;
    const isOwned = ownedIdSet.has(item.id);
    const resale = getLuxuryResaleValue(item);
    const affordable = cash >= item.price;
    const tv = luxuryTierVisual(item.tier);

    return (
      <Modal transparent visible animationType="fade" onRequestClose={() => setSheetItem(null)}>
        <View style={[styles.sheetOverlay, { backgroundColor: theme.overlay }]}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => setSheetItem(null)}
            accessibilityRole="button"
            accessibilityLabel="Dismiss details"
          />
          <Animated.View
            style={[
              styles.sheet,
              getPlatformShadows(12, 0.35, -4, 24),
              { backgroundColor: theme.surface, borderColor: theme.border, transform: [{ translateY: sheetTranslate }] },
            ]}
          >
            <View style={[styles.sheetHandle, { backgroundColor: theme.borderStrong }]} />
            <TouchableOpacity
              onPress={() => setSheetItem(null)}
              style={[styles.sheetClose, { backgroundColor: theme.surfaceElevated }]}
              accessibilityRole="button"
              accessibilityLabel="Close"
              hitSlop={8}
            >
              <X size={scale(18)} color={theme.textSecondary} />
            </TouchableOpacity>

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: getAppScreenBottomPadding(insets.bottom), gap: responsiveSpacing.md }}
            >
              <View style={[styles.sheetHeroBox, { height: scale(190), borderColor: theme.border }]}>
                <ArtworkBanner item={item} emojiSize={scale(88)} />
                <View style={[styles.tierChip, { backgroundColor: tv.accentSoft, borderColor: tv.accentBorder }]}>
                  <Text style={[styles.tierChipText, { color: tv.accent }]}>{tv.label}</Text>
                </View>
                {isOwned ? (
                  <View style={[styles.statePill, { backgroundColor: 'rgba(16, 185, 129, 0.92)' }]}>
                    <BadgeCheck size={scale(12)} color="#FFFFFF" />
                    <Text style={styles.statePillText}>Owned</Text>
                  </View>
                ) : (
                  <View style={styles.detailPricePill}>
                    <Text style={styles.detailPriceText}>{money(item.price)}</Text>
                  </View>
                )}
              </View>

              <Text style={[styles.sheetTitle, { color: theme.text }]}>{item.name}</Text>
              <Text style={[styles.sheetDesc, { color: theme.textSecondary }]}>{item.description}</Text>

              <ItemStatChips item={item} theme={theme} />

              {/* Total cost of ownership. */}
              <View style={[styles.ownershipCard, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
                <View style={styles.ownershipRow}>
                  <Text style={[styles.ownershipLabel, { color: theme.textMuted }]}>Purchase price</Text>
                  <Text style={[styles.ownershipValue, { color: theme.text }]}>{money(item.price)}</Text>
                </View>
                <View style={styles.ownershipRow}>
                  <Text style={[styles.ownershipLabel, { color: theme.textMuted }]}>Weekly upkeep</Text>
                  <Text style={[styles.ownershipValue, { color: theme.text }]}>{money(item.weeklyUpkeep)}/wk</Text>
                </View>
                <View style={styles.ownershipRow}>
                  <Text style={[styles.ownershipLabel, { color: theme.textMuted }]}>Resale value</Text>
                  <Text style={[styles.ownershipValue, { color: theme.text }]}>{money(resale)}</Text>
                </View>
                <View style={[styles.ownershipRow, styles.ownershipTotalRow, { borderTopColor: theme.border }]}>
                  <Text style={[styles.ownershipLabel, { color: theme.textSecondary }]}>First-year cost</Text>
                  <Text style={[styles.ownershipValue, { color: theme.text }]}>
                    {money(item.price + item.weeklyUpkeep * 52)}
                  </Text>
                </View>
              </View>

              {isOwned ? (
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() => setPendingSell(item)}
                  style={[styles.sheetCta, { backgroundColor: AMBER_SOFT, borderColor: AMBER_BORDER }]}
                  accessibilityRole="button"
                  accessibilityLabel={`Sell ${item.name} for ${money(resale)}`}
                >
                  <Tag size={scale(16)} color={AMBER} />
                  <Text style={[styles.sheetCtaText, { color: AMBER }]}>Sell for {money(resale)}</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() => requestBuy(item)}
                  style={styles.sheetCtaWrap}
                  accessibilityRole="button"
                  accessibilityLabel={
                    affordable ? `Acquire ${item.name} for ${money(item.price)}` : `Not enough cash for ${item.name}`
                  }
                >
                  <LinearGradient
                    colors={affordable ? [IDENTITY, IDENTITY_LIGHT] : [theme.surfaceElevated, theme.surfaceElevated]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.sheetCtaFill}
                  >
                    <ShoppingBag size={scale(16)} color={affordable ? '#FFFFFF' : theme.textMuted} />
                    <Text style={[styles.sheetCtaText, { color: affordable ? '#FFFFFF' : theme.textMuted }]}>
                      {affordable ? `Acquire · ${money(item.price)}` : `Need ${money(item.price - cash)} more`}
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>
              )}
            </ScrollView>
          </Animated.View>
        </View>
      </Modal>
    );
  };

  // ── Screen ──────────────────────────────────────────────────────────────────

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      {/* Top bar */}
      <View style={styles.topBar}>
        <TouchableOpacity
          onPress={onBack}
          hitSlop={8}
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <ArrowLeft size={scale(22)} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.appTitle, { color: theme.text }]} numberOfLines={1}>
          Luxury & Collectibles
        </Text>
        <View
          style={[
            styles.cashChip,
            { backgroundColor: `rgba(${IDENTITY_RGB}, 0.14)`, borderColor: `rgba(${IDENTITY_RGB}, 0.3)` },
          ]}
        >
          <Text style={[styles.cashChipText, { color: IDENTITY_LIGHT }]}>{money(cash)}</Text>
        </View>
      </View>

      {/* Tabs */}
      <View style={[styles.tabBar, { borderColor: theme.border }]}>
        {(['browse', 'collection'] as Tab[]).map((t) => {
          const active = tab === t;
          const TabIcon = t === 'browse' ? ShoppingBag : Gem;
          return (
            <TouchableOpacity
              key={t}
              onPress={() => setTab(t)}
              style={[styles.tab, active && { borderBottomColor: IDENTITY }]}
              accessibilityRole="button"
              accessibilityLabel={t === 'browse' ? 'Browse catalog' : 'My collection'}
              accessibilityState={{ selected: active }}
            >
              <TabIcon size={scale(15)} color={active ? IDENTITY_LIGHT : theme.textMuted} />
              <Text style={[styles.tabText, { color: active ? IDENTITY_LIGHT : theme.textMuted }]}>
                {t === 'browse' ? 'Browse' : `Collection (${owned.length})`}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

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
            <SectionTitle theme={theme}>Acquire</SectionTitle>
            {browseList.length > 0 ? (
              browseList.map((item, i) => (
                <LuxuryCard
                  key={item.id}
                  item={item}
                  index={i}
                  isOwned={false}
                  reduced={reducedMotion}
                  darkMode={darkMode}
                  theme={theme}
                  cash={cash}
                  onOpen={setSheetItem}
                  onBuy={requestBuy}
                  onSell={setPendingSell}
                />
              ))
            ) : (
              <View style={[getGlassCard(darkMode, 6), styles.emptyCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <View style={[getGlassIconContainer(darkMode, 44), { backgroundColor: `rgba(${IDENTITY_RGB}, 0.15)`, borderColor: `rgba(${IDENTITY_RGB}, 0.3)` }]}>
                  <Crown size={scale(22)} color={IDENTITY} />
                </View>
                <Text style={[styles.emptyTitle, { color: theme.text }]}>You own the entire collection</Text>
                <Text style={[styles.emptyText, { color: theme.textMuted }]}>
                  Every trophy is yours. Head to your Collection to admire — or resell — what you&apos;ve amassed.
                </Text>
              </View>
            )}
          </>
        ) : owned.length > 0 ? (
          <>
            {renderCollectionSummary()}
            {renderLuxuryLife()}
            <SectionTitle theme={theme}>Your trophies</SectionTitle>
            {owned.map((item, i) => (
              <LuxuryCard
                key={item.id}
                item={item}
                index={i}
                isOwned
                reduced={reducedMotion}
                darkMode={darkMode}
                theme={theme}
                cash={cash}
                onOpen={setSheetItem}
                onBuy={requestBuy}
                onSell={setPendingSell}
              />
            ))}
          </>
        ) : (
          <View style={[getGlassCard(darkMode, 6), styles.emptyCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={[getGlassIconContainer(darkMode, 44), { backgroundColor: `rgba(${IDENTITY_RGB}, 0.15)`, borderColor: `rgba(${IDENTITY_RGB}, 0.3)` }]}>
              <Gem size={scale(22)} color={IDENTITY} />
            </View>
            <Text style={[styles.emptyTitle, { color: theme.text }]}>No trophies yet</Text>
            <Text style={[styles.emptyText, { color: theme.textMuted }]}>
              Your collection is empty. Browse the catalog to acquire your first collectible.
            </Text>
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => setTab('browse')}
              style={[styles.tintedBtn, { backgroundColor: `rgba(${IDENTITY_RGB}, 0.14)`, borderColor: `rgba(${IDENTITY_RGB}, 0.3)` }]}
              accessibilityRole="button"
              accessibilityLabel="Browse the catalog"
            >
              <ShoppingBag size={scale(14)} color={IDENTITY} />
              <Text style={[styles.tintedBtnText, { color: IDENTITY }]}>Browse catalog</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {renderSheet()}

      {toast ? (
        <View
          style={[
            styles.toast,
            getPlatformShadows(8, 0.2, 0, 16),
            { backgroundColor: theme.surface, borderColor: `rgba(${IDENTITY_RGB}, 0.3)`, bottom: getAppScreenBottomPadding(insets.bottom) },
          ]}
        >
          <Info size={scale(15)} color={IDENTITY_LIGHT} />
          <Text style={[styles.toastText, { color: theme.text }]}>{toast}</Text>
        </View>
      ) : null}

      {/* Purchase confirm — blue identity, celebratory. */}
      <ConfirmDialog
        visible={!!pendingBuy}
        type="default"
        title={pendingBuy ? `Acquire the ${pendingBuy.name}?` : ''}
        message={
          pendingBuy
            ? `${money(pendingBuy.price)} upfront, then ${money(pendingBuy.weeklyUpkeep)}/wk upkeep. You'll have ${money(Math.max(0, cash - pendingBuy.price))} left.`
            : ''
        }
        confirmText="Acquire"
        cancelText="Cancel"
        icon={<Crown size={scale(28)} color="#FFFFFF" strokeWidth={2.2} />}
        onConfirm={confirmBuy}
        onCancel={() => setPendingBuy(null)}
      />

      {/* Resale confirm — amber (cautionary, lossy but reversible), not the red
          destructive path. A sold trophy can be re-bought, so `warning` fits. */}
      <ConfirmDialog
        visible={!!pendingSell}
        type="warning"
        title={pendingSell ? `Sell the ${pendingSell.name}?` : ''}
        message={
          pendingSell
            ? `You'll get ${money(getLuxuryResaleValue(pendingSell))} back — ${Math.round((getLuxuryResaleValue(pendingSell) / pendingSell.price) * 100)}% of the ${money(pendingSell.price)} you paid.`
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
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: responsiveSpacing.md,
    paddingVertical: responsiveSpacing.sm,
    gap: responsiveSpacing.sm,
  },
  backBtn: {
    width: scale(40),
    height: scale(40),
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -responsiveSpacing.xs,
  },
  appTitle: { flex: 1, fontSize: responsiveFontSize.lg, fontWeight: '700' },
  cashChip: {
    paddingHorizontal: responsiveSpacing.sm,
    paddingVertical: 4,
    borderRadius: responsiveBorderRadius.full,
    borderWidth: 1,
  },
  cashChipText: { fontSize: responsiveFontSize.sm, fontWeight: '700', fontVariant: ['tabular-nums'] },

  // Tabs.
  tabBar: { flexDirection: 'row', borderBottomWidth: 1, marginHorizontal: responsiveSpacing.md },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: responsiveSpacing.sm,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabText: { fontSize: responsiveFontSize.sm, fontWeight: '600' },
  scroll: { flex: 1 },
  sectionTitle: { fontSize: responsiveFontSize.md, fontWeight: '700', letterSpacing: 0.2, marginTop: responsiveSpacing.xs },

  // Recipe B hero (progress module + collection summary).
  hero: { borderWidth: 1, borderRadius: responsiveBorderRadius['2xl'] },
  heroInner: {
    borderRadius: responsiveBorderRadius['2xl'],
    overflow: 'hidden',
    padding: responsiveSpacing.lg,
    gap: responsiveSpacing.md,
  },
  heroBlob: {
    position: 'absolute',
    top: -scale(48),
    right: -scale(36),
    width: scale(150),
    height: scale(150),
    borderRadius: scale(75),
  },
  heroHairline: { position: 'absolute', top: 0, left: 0, right: 0, height: 1, backgroundColor: 'rgba(255, 255, 255, 0.08)' },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: responsiveSpacing.md },
  heroText: { flex: 1 },
  heroEyebrow: { fontSize: responsiveFontSize.xs, fontWeight: '600', letterSpacing: 0.8 },
  heroValue: { fontSize: responsiveFontSize['2xl'], fontWeight: '800', marginTop: 2, fontVariant: ['tabular-nums'] },
  heroSub: { fontSize: responsiveFontSize.xs, marginTop: 4, fontVariant: ['tabular-nums'] },
  progressTrack: { height: scale(8), borderRadius: scale(4), overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: scale(4) },

  // Mini-stat strip (collection summary).
  miniStatRow: { flexDirection: 'row', alignItems: 'center' },
  miniStat: { flex: 1, alignItems: 'center', gap: 2 },
  miniStatDivider: { width: 1, height: scale(30) },
  miniStatValue: { fontSize: responsiveFontSize.md, fontWeight: '800', fontVariant: ['tabular-nums'] },
  miniStatLabel: { fontSize: responsiveFontSize.xs, fontWeight: '500' },

  // Catalog / collection card.
  card: { borderWidth: 1, borderRadius: responsiveBorderRadius.xl },
  cardInner: { borderRadius: responsiveBorderRadius.xl, overflow: 'hidden' },
  bannerBox: { width: '100%' },
  bannerFill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width: '100%', height: '100%' },
  bannerBlob: {
    position: 'absolute',
    top: -scale(30),
    right: -scale(24),
    width: scale(120),
    height: scale(120),
    borderRadius: scale(60),
  },
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
  tierChipText: { fontSize: responsiveFontSize.xs, fontWeight: '800', letterSpacing: 0.8 },
  pricePill: {
    position: 'absolute',
    left: scale(10),
    bottom: scale(10),
    paddingHorizontal: scale(10),
    paddingVertical: 5,
    borderRadius: responsiveBorderRadius.lg,
    backgroundColor: 'rgba(0, 0, 0, 0.62)',
  },
  pricePillText: { color: '#FFFFFF', fontSize: responsiveFontSize.lg, fontWeight: '800', fontVariant: ['tabular-nums'] },
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
  statePillText: { color: '#FFFFFF', fontSize: responsiveFontSize.xs, fontWeight: '800' },
  cardBody: { padding: responsiveSpacing.md, gap: responsiveSpacing.sm },
  cardTitleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: responsiveSpacing.xs },
  cardName: { flex: 1, fontSize: responsiveFontSize.md, fontWeight: '700', lineHeight: responsiveFontSize.md * 1.3 },
  cardResale: { fontSize: responsiveFontSize.xs, fontWeight: '600', marginTop: -2, fontVariant: ['tabular-nums'] },

  // Stat chips.
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: responsiveSpacing.xs },
  statChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: responsiveSpacing.sm,
    paddingVertical: 4,
    borderRadius: responsiveBorderRadius.full,
  },
  statChipText: { fontSize: responsiveFontSize.xs, fontWeight: '700', fontVariant: ['tabular-nums'] },

  // Card footer buttons.
  cardFooter: {
    flexDirection: 'row',
    gap: responsiveSpacing.sm,
    paddingHorizontal: responsiveSpacing.md,
    paddingBottom: responsiveSpacing.md,
  },
  ghostBtn: {
    minHeight: scale(38),
    paddingHorizontal: responsiveSpacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: responsiveBorderRadius.full,
    borderWidth: 1,
  },
  ghostBtnText: { fontWeight: '700', fontSize: responsiveFontSize.sm },
  buyBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: scale(38),
    borderRadius: responsiveBorderRadius.full,
  },
  buyBtnText: { fontSize: responsiveFontSize.sm, fontWeight: '800', fontVariant: ['tabular-nums'] },
  sellBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: scale(38),
    borderRadius: responsiveBorderRadius.full,
    backgroundColor: AMBER_SOFT,
    borderWidth: 1,
    borderColor: AMBER_BORDER,
  },
  sellBtnText: { color: AMBER, fontSize: responsiveFontSize.sm, fontWeight: '800', fontVariant: ['tabular-nums'] },

  // Empty states.
  emptyCard: {
    borderWidth: 1,
    borderRadius: responsiveBorderRadius.xl,
    paddingVertical: responsiveSpacing.lg,
    paddingHorizontal: responsiveSpacing.md,
    gap: responsiveSpacing.md,
    alignItems: 'center',
  },
  emptyTitle: { fontSize: responsiveFontSize.md, fontWeight: '700', textAlign: 'center' },
  emptyText: { fontSize: responsiveFontSize.sm, textAlign: 'center', lineHeight: responsiveFontSize.sm * 1.5 },
  tintedBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: scale(40),
    paddingHorizontal: responsiveSpacing.lg,
    borderRadius: responsiveBorderRadius.full,
    borderWidth: 1,
  },
  tintedBtnText: { fontWeight: '700', fontSize: responsiveFontSize.sm },

  // Detail sheet.
  sheetOverlay: { flex: 1, justifyContent: 'flex-end', zIndex: Z_INDEX.MODAL },
  sheet: {
    maxHeight: '88%',
    borderTopLeftRadius: scale(24),
    borderTopRightRadius: scale(24),
    borderWidth: 1,
    paddingHorizontal: responsiveSpacing.md,
    paddingTop: responsiveSpacing.sm,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: scale(40),
    height: scale(4),
    borderRadius: scale(2),
    marginBottom: responsiveSpacing.sm,
  },
  sheetClose: {
    position: 'absolute',
    top: responsiveSpacing.md,
    right: responsiveSpacing.md,
    width: scale(32),
    height: scale(32),
    borderRadius: scale(16),
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  sheetHeroBox: { width: '100%', borderRadius: responsiveBorderRadius.xl, borderWidth: 1, overflow: 'hidden' },
  sheetTitle: { fontSize: responsiveFontSize.xl, fontWeight: '800' },
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
  detailPriceText: { color: '#FFFFFF', fontSize: responsiveFontSize.xl, fontWeight: '800', fontVariant: ['tabular-nums'] },
  ownershipCard: { borderWidth: 1, borderRadius: responsiveBorderRadius.lg, padding: responsiveSpacing.md, gap: responsiveSpacing.sm },
  ownershipRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  ownershipTotalRow: { borderTopWidth: 1, paddingTop: responsiveSpacing.sm },
  ownershipLabel: { fontSize: responsiveFontSize.sm, fontWeight: '500' },
  ownershipValue: { fontSize: responsiveFontSize.sm, fontWeight: '800', fontVariant: ['tabular-nums'] },
  sheetCtaWrap: { borderRadius: responsiveBorderRadius.full, overflow: 'hidden', ...getPlatformShadows(5, 0.3, 2, 8) },
  sheetCtaFill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: responsiveSpacing.sm,
    paddingVertical: responsiveSpacing.md,
  },
  sheetCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: responsiveSpacing.sm,
    paddingVertical: responsiveSpacing.md,
    borderRadius: responsiveBorderRadius.full,
    borderWidth: 1,
  },
  sheetCtaText: { fontSize: responsiveFontSize.md, fontWeight: '800', fontVariant: ['tabular-nums'] },

  // Toast.
  toast: {
    position: 'absolute',
    left: responsiveSpacing.md,
    right: responsiveSpacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: responsiveSpacing.sm,
    paddingHorizontal: responsiveSpacing.md,
    paddingVertical: responsiveSpacing.sm,
    borderRadius: responsiveBorderRadius.lg,
    borderWidth: 1,
    zIndex: Z_INDEX.TOAST,
  },
  toastText: { flex: 1, fontSize: responsiveFontSize.sm, fontWeight: '600' },
});

export default function LuxuryApp(props: LuxuryAppProps) {
  return (
    <ErrorBoundary>
      <LuxuryAppInner {...props} />
    </ErrorBoundary>
  );
}
