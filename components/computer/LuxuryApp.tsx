/**
 * LuxuryApp — desktop "Luxury & Collectibles" screen.
 *
 * An aspirational late-game cash sink hosted as a computer mini-app (same model
 * as RealEstateApp / VehicleApp): browse a catalog, buy with in-game cash, and
 * manage owned trophies (each has weekly upkeep + a happiness/prestige benefit).
 *
 * Slate Glass conventions: getThemeColors(darkMode) surfaces (#0F172A/#1E293B/
 * #334155), a single blue identity accent (#3B82F6 / #60A5FA), elevation only via
 * getGlassCard/getPlatformShadows, semantic colors preserved, dark/light aware,
 * a11y labels + a back nav that never traps.
 *
 * Cash safety: buy/sell dispatch LuxuryActions, which route every cash move
 * through the canonical applyMoneyDelta (stats.money only — never a mirrored
 * bank balance). This component never mutates money directly.
 */

import React, { useState, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { ArrowLeft, Crown, Sparkles, Tag, Check } from 'lucide-react-native';
import { useGame } from '@/contexts/GameContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ErrorBoundary from '@/components/ErrorBoundary';
import {
  responsiveFontSize,
  responsiveSpacing,
  responsiveBorderRadius,
  scale,
  getAppScreenBottomPadding,
} from '@/utils/scaling';
import { getThemeColors } from '@/lib/config/theme';
import { getGlassCard, getGlassIconContainer } from '@/utils/glassmorphismStyles';
import { formatMoney } from '@/utils/moneyFormatting';
import {
  LUXURY_CATALOG,
  type LuxuryItem,
  getOwnedLuxuryItems,
  getTotalLuxuryResaleValue,
  getTotalLuxuryUpkeep,
  getLuxuryResaleValue,
  isLuxuryLifeComplete,
} from '@/lib/luxury';
import { purchaseLuxuryItem, sellLuxuryItem } from '@/contexts/game/actions/LuxuryActions';

// Single blue identity accent for this app (Slate Glass semantic blue).
const IDENTITY = '#3B82F6';
const IDENTITY_LIGHT = '#60A5FA';
const IDENTITY_RGB = '59, 130, 246';

interface LuxuryAppProps {
  onBack: () => void;
}

type Tab = 'browse' | 'collection';

function LuxuryAppInner({ onBack }: LuxuryAppProps) {
  const { gameState, setGameState, saveGame } = useGame();
  const insets = useSafeAreaInsets();
  const darkMode = !!gameState.settings?.darkMode;
  const theme = getThemeColors(darkMode);

  const [tab, setTab] = useState<Tab>('browse');

  const cash = gameState.stats?.money ?? 0;
  const ownedIds = gameState.luxuryItems;

  const owned = useMemo(() => getOwnedLuxuryItems(ownedIds), [ownedIds]);
  const ownedIdSet = useMemo(() => new Set(owned.map((i) => i.id)), [owned]);
  const browseList = useMemo(
    () => LUXURY_CATALOG.filter((i) => !ownedIdSet.has(i.id)),
    [ownedIdSet],
  );

  const collectionValue = useMemo(() => getTotalLuxuryResaleValue(ownedIds), [ownedIds]);
  const weeklyUpkeep = useMemo(() => getTotalLuxuryUpkeep(ownedIds), [ownedIds]);
  const lifeComplete = useMemo(() => isLuxuryLifeComplete(ownedIds), [ownedIds]);

  const queueSave = useCallback(() => {
    saveGame().catch(() => {});
  }, [saveGame]);

  const onBuy = useCallback(
    (item: LuxuryItem) => {
      const result = purchaseLuxuryItem(gameState, setGameState, item.id);
      Alert.alert(result.success ? `${item.emoji} Acquired!` : 'Purchase', result.message);
      if (result.success) queueSave();
    },
    [gameState, setGameState, queueSave],
  );

  const onSell = useCallback(
    (item: LuxuryItem) => {
      const refund = getLuxuryResaleValue(item);
      Alert.alert(
        `Sell ${item.name}?`,
        `You'll get ${formatMoney(refund)} back (${Math.round((refund / item.price) * 100)}% of what you paid).`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Sell',
            style: 'destructive',
            onPress: () => {
              const result = sellLuxuryItem(gameState, setGameState, item.id);
              Alert.alert('Sold', result.message);
              if (result.success) queueSave();
            },
          },
        ],
      );
    },
    [gameState, setGameState, queueSave],
  );

  const renderBrowseCard = (item: LuxuryItem) => {
    const affordable = cash >= item.price;
    return (
      <View
        key={item.id}
        style={[
          getGlassCard(darkMode, 6),
          styles.card,
          { backgroundColor: theme.surface, borderColor: theme.border },
        ]}
      >
        <View style={styles.cardHeader}>
          <View style={[getGlassIconContainer(darkMode, scale(44)), styles.emojiWrap]}>
            <Text style={styles.emoji}>{item.emoji}</Text>
          </View>
          <View style={styles.cardHeaderText}>
            <Text style={[styles.cardName, { color: theme.text }]} numberOfLines={1}>
              {item.name}
            </Text>
            <Text style={[styles.tierBadge, { color: IDENTITY_LIGHT }]}>
              {item.tier.toUpperCase()}
            </Text>
          </View>
          <Text style={[styles.price, { color: theme.text }]}>{formatMoney(item.price)}</Text>
        </View>

        <Text style={[styles.desc, { color: theme.textSecondary }]} numberOfLines={3}>
          {item.description}
        </Text>

        <View style={styles.metaRow}>
          <Text style={[styles.metaChip, { color: theme.textMuted }]}>
            {formatMoney(item.weeklyUpkeep)}/wk upkeep
          </Text>
          <Text style={[styles.metaChip, { color: '#10B981' }]}>+{item.happiness} happiness</Text>
          <Text style={[styles.metaChip, { color: IDENTITY_LIGHT }]}>+{item.prestige} prestige</Text>
        </View>

        <TouchableOpacity
          activeOpacity={0.85}
          disabled={!affordable}
          onPress={() => onBuy(item)}
          style={[
            styles.buyBtn,
            affordable
              ? { backgroundColor: IDENTITY }
              : { backgroundColor: theme.surfaceElevated, opacity: 0.6 },
          ]}
          accessibilityRole="button"
          accessibilityLabel={`Buy ${item.name} for ${formatMoney(item.price)}`}
          accessibilityState={{ disabled: !affordable }}
        >
          <Tag size={scale(15)} color={affordable ? '#FFFFFF' : theme.textMuted} />
          <Text style={[styles.buyBtnText, { color: affordable ? '#FFFFFF' : theme.textMuted }]}>
            {affordable ? 'Buy' : 'Not enough cash'}
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderOwnedCard = (item: LuxuryItem) => {
    const refund = getLuxuryResaleValue(item);
    return (
      <View
        key={item.id}
        style={[
          getGlassCard(darkMode, 6),
          styles.card,
          { backgroundColor: theme.surface, borderColor: theme.border },
        ]}
      >
        <View style={styles.cardHeader}>
          <View style={[getGlassIconContainer(darkMode, scale(44)), styles.emojiWrap]}>
            <Text style={styles.emoji}>{item.emoji}</Text>
          </View>
          <View style={styles.cardHeaderText}>
            <Text style={[styles.cardName, { color: theme.text }]} numberOfLines={1}>
              {item.name}
            </Text>
            <Text style={[styles.tierBadge, { color: IDENTITY_LIGHT }]}>OWNED</Text>
          </View>
          <Text style={[styles.price, { color: theme.textSecondary }]}>
            {formatMoney(refund)}
          </Text>
        </View>

        <View style={styles.metaRow}>
          <Text style={[styles.metaChip, { color: theme.textMuted }]}>
            {formatMoney(item.weeklyUpkeep)}/wk upkeep
          </Text>
          <Text style={[styles.metaChip, { color: '#10B981' }]}>+{item.happiness} happiness</Text>
          <Text style={[styles.metaChip, { color: IDENTITY_LIGHT }]}>+{item.prestige} prestige</Text>
        </View>

        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => onSell(item)}
          style={[styles.sellBtn, { borderColor: theme.borderStrong }]}
          accessibilityRole="button"
          accessibilityLabel={`Sell ${item.name} for ${formatMoney(refund)}`}
        >
          <Text style={[styles.sellBtnText, { color: theme.textSecondary }]}>
            Sell for {formatMoney(refund)}
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      {/* Top bar */}
      <View style={styles.topBar}>
        <TouchableOpacity
          onPress={onBack}
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
          <Text style={[styles.cashChipText, { color: IDENTITY_LIGHT }]}>{formatMoney(cash)}</Text>
        </View>
      </View>

      {/* Summary strip */}
      <View style={[styles.summaryStrip, { borderColor: theme.border }]}>
        <View style={styles.summaryCell}>
          <Crown size={scale(16)} color={IDENTITY_LIGHT} />
          <Text style={[styles.summaryValue, { color: theme.text }]}>{owned.length}</Text>
          <Text style={[styles.summaryLabel, { color: theme.textMuted }]}>owned</Text>
        </View>
        <View style={[styles.summaryDivider, { backgroundColor: theme.border }]} />
        <View style={styles.summaryCell}>
          <Text style={[styles.summaryValue, { color: theme.text }]}>{formatMoney(collectionValue)}</Text>
          <Text style={[styles.summaryLabel, { color: theme.textMuted }]}>resale value</Text>
        </View>
        <View style={[styles.summaryDivider, { backgroundColor: theme.border }]} />
        <View style={styles.summaryCell}>
          <Text style={[styles.summaryValue, { color: theme.text }]}>{formatMoney(weeklyUpkeep)}</Text>
          <Text style={[styles.summaryLabel, { color: theme.textMuted }]}>upkeep/wk</Text>
        </View>
      </View>

      {/* "Luxury Life" goal banner */}
      <View
        style={[
          styles.goalBanner,
          {
            backgroundColor: lifeComplete ? 'rgba(16, 185, 129, 0.12)' : `rgba(${IDENTITY_RGB}, 0.10)`,
            borderColor: lifeComplete ? 'rgba(16, 185, 129, 0.35)' : `rgba(${IDENTITY_RGB}, 0.25)`,
          },
        ]}
      >
        {lifeComplete ? (
          <Check size={scale(15)} color="#10B981" />
        ) : (
          <Sparkles size={scale(15)} color={IDENTITY_LIGHT} />
        )}
        <Text
          style={[
            styles.goalText,
            { color: lifeComplete ? '#10B981' : theme.textSecondary },
          ]}
        >
          {lifeComplete
            ? 'Luxury Life achieved — you\'ve built a real collection.'
            : 'Own 3 collectibles (or $25M in trophies) to reach the Luxury Life.'}
        </Text>
      </View>

      {/* Tabs */}
      <View style={[styles.tabBar, { borderColor: theme.border }]}>
        {(['browse', 'collection'] as Tab[]).map((t) => {
          const active = tab === t;
          return (
            <TouchableOpacity
              key={t}
              onPress={() => setTab(t)}
              style={[styles.tab, active && { borderBottomColor: IDENTITY }]}
              accessibilityRole="button"
              accessibilityLabel={t === 'browse' ? 'Browse catalog' : 'My collection'}
              accessibilityState={{ selected: active }}
            >
              <Text
                style={[
                  styles.tabText,
                  { color: active ? IDENTITY_LIGHT : theme.textMuted },
                ]}
              >
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
          gap: responsiveSpacing.sm,
        }}
        showsVerticalScrollIndicator={false}
      >
        {tab === 'browse' ? (
          browseList.length > 0 ? (
            browseList.map(renderBrowseCard)
          ) : (
            <Text style={[styles.emptyText, { color: theme.textMuted }]}>
              You own the entire collection. Nothing left to acquire!
            </Text>
          )
        ) : owned.length > 0 ? (
          owned.map(renderOwnedCard)
        ) : (
          <Text style={[styles.emptyText, { color: theme.textMuted }]}>
            No trophies yet. Head to Browse to start your collection.
          </Text>
        )}
      </ScrollView>
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
  summaryStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: responsiveSpacing.sm,
    marginHorizontal: responsiveSpacing.md,
    borderBottomWidth: 1,
  },
  summaryCell: { flex: 1, alignItems: 'center', gap: 2 },
  summaryDivider: { width: 1, height: scale(28) },
  summaryValue: { fontSize: responsiveFontSize.md, fontWeight: '700', fontVariant: ['tabular-nums'] },
  summaryLabel: { fontSize: responsiveFontSize.xs, fontWeight: '500' },
  goalBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: responsiveSpacing.xs,
    marginHorizontal: responsiveSpacing.md,
    marginTop: responsiveSpacing.sm,
    paddingHorizontal: responsiveSpacing.sm,
    paddingVertical: responsiveSpacing.xs,
    borderRadius: responsiveBorderRadius.md,
    borderWidth: 1,
  },
  goalText: { flex: 1, fontSize: responsiveFontSize.xs, fontWeight: '600' },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    marginTop: responsiveSpacing.sm,
    marginHorizontal: responsiveSpacing.md,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: responsiveSpacing.sm,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabText: { fontSize: responsiveFontSize.sm, fontWeight: '600' },
  scroll: { flex: 1 },
  card: {
    borderRadius: responsiveBorderRadius.lg,
    borderWidth: 1,
    padding: responsiveSpacing.md,
    gap: responsiveSpacing.sm,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: responsiveSpacing.sm },
  emojiWrap: { alignItems: 'center', justifyContent: 'center' },
  emoji: { fontSize: responsiveFontSize.xl },
  cardHeaderText: { flex: 1, gap: 2 },
  cardName: { fontSize: responsiveFontSize.md, fontWeight: '700' },
  tierBadge: { fontSize: responsiveFontSize.xs, fontWeight: '700', letterSpacing: 0.6 },
  price: { fontSize: responsiveFontSize.md, fontWeight: '700', fontVariant: ['tabular-nums'] },
  desc: { fontSize: responsiveFontSize.sm, lineHeight: responsiveFontSize.sm * 1.4 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: responsiveSpacing.sm },
  metaChip: { fontSize: responsiveFontSize.xs, fontWeight: '600' },
  buyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: responsiveSpacing.sm,
    borderRadius: responsiveBorderRadius.md,
  },
  buyBtnText: { fontSize: responsiveFontSize.sm, fontWeight: '700' },
  sellBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: responsiveSpacing.sm,
    borderRadius: responsiveBorderRadius.md,
    borderWidth: 1,
  },
  sellBtnText: { fontSize: responsiveFontSize.sm, fontWeight: '600' },
  emptyText: {
    textAlign: 'center',
    fontSize: responsiveFontSize.sm,
    marginTop: responsiveSpacing.xl,
    paddingHorizontal: responsiveSpacing.lg,
    lineHeight: responsiveFontSize.sm * 1.5,
  },
});

export default function LuxuryApp(props: LuxuryAppProps) {
  return (
    <ErrorBoundary>
      <LuxuryAppInner {...props} />
    </ErrorBoundary>
  );
}
