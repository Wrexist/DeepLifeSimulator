/**
 * StocksApp — mobile stock trading.
 *
 * Remake 6. Replaces the 1,550-LOC version with a 3-tab loop:
 *
 *   - Market: per-stock price card with sector tag, momentum tilt, dividend yield
 *   - Portfolio: holdings, cost basis, realized + unrealized gain, dividends
 *   - Orders: open limit / stop orders, recent fills
 *
 * New mechanics that ship with this remake (reusing the crypto-system pattern):
 *   - Limit / stop / market orders via lib/stocks/orderBook.ts
 *   - Sector rotation (6 sectors × strong/neutral/weak) via lib/stocks/sectors.ts
 *   - Quarterly dividends (every 13 weeks) via lib/stocks/dividends.ts
 *   - Order matching + dividend payout in the weekly tick
 */

import React, { useState, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { ArrowLeft, BarChart3, Briefcase, Clock, X } from 'lucide-react-native';
import { useGame } from '@/contexts/GameContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ErrorBoundary from '@/components/ErrorBoundary';
import { responsiveFontSize, responsiveSpacing, responsiveBorderRadius, scale, getAppScreenBottomPadding } from '@/utils/scaling';
import { getThemeColors, accent } from '@/lib/config/theme';
import EconomyEventBanner from '@/components/shared/EconomyEventBanner';
import StockRow from '@/components/stocks/StockRow';
import StockTradeModal from '@/components/stocks/StockTradeModal';
import { sectorForSymbol } from '@/lib/stocks/sectors';
import {
  buyStockMarket,
  sellStockMarket,
  placeStockLimitOrder,
  placeStockStopOrder,
  cancelStockOrder,
} from '@/contexts/game/actions/StockActions';

interface StocksAppProps {
  onBack: () => void;
}

type Tab = 'market' | 'portfolio' | 'orders';

const TABS: { id: Tab; label: string; icon: React.ComponentType<{ size: number; color: string }> }[] = [
  { id: 'market',    label: 'Market',    icon: BarChart3 },
  { id: 'portfolio', label: 'Portfolio', icon: Briefcase },
  { id: 'orders',    label: 'Orders',    icon: Clock },
];

function formatMoney(n: number): string {
  if (!isFinite(n)) return '$0';
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${n < 0 ? '-' : ''}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 10_000) return `${n < 0 ? '-' : ''}$${(abs / 1000).toFixed(1)}k`;
  return `$${Math.round(n).toLocaleString()}`;
}

function StocksAppInner({ onBack }: StocksAppProps) {
  const { gameState, setGameState, saveGame } = useGame();
  const insets = useSafeAreaInsets();
  const darkMode = !!gameState.settings?.darkMode;
  const theme = getThemeColors(darkMode);

  const stocks = gameState.stocks;
  const cash = gameState.stats?.money ?? 0;
  const holdings = stocks?.holdings ?? [];
  const watchlist = stocks?.watchlist ?? [];
  const openOrders = stocks?.openOrders ?? [];
  const orderHistory = stocks?.orderHistory ?? [];
  const sectorSnapshots = stocks?.sectorSnapshots ?? [];
  const realizedGains = stocks?.realizedGains ?? 0;
  const totalDividends = stocks?.totalDividends ?? 0;

  const [activeTab, setActiveTab] = useState<Tab>('market');
  const [tradeTarget, setTradeTarget] = useState<{ symbol: string; price: number } | null>(null);

  const marketData = useMemo(() => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { getAllStockSymbols, getStockInfo } = require('@/lib/economy/stockMarket');
      const symbols: string[] = getAllStockSymbols();
      return symbols.map((sym) => {
        const info = getStockInfo(sym);
        return { symbol: sym, price: info.price, dividendYield: info.dividendYield };
      });
    } catch {
      return [];
    }
  }, [gameState.weeksLived]);

  const sectorStateFor = useCallback(
    (symbol: string): 'strong' | 'neutral' | 'weak' => {
      const sector = sectorForSymbol(symbol);
      const snap = sectorSnapshots.find((s) => s.sector === sector);
      return (snap?.state ?? 'neutral') as 'strong' | 'neutral' | 'weak';
    },
    [sectorSnapshots]
  );

  const portfolioValue = useMemo(
    () => holdings.reduce((s, h) => s + h.shares * h.currentPrice, 0),
    [holdings]
  );
  const costBasis = useMemo(
    () => holdings.reduce((s, h) => s + h.shares * h.averagePrice, 0),
    [holdings]
  );
  const unrealized = portfolioValue - costBasis;

  const queueSave = useCallback(() => {
    saveGame().catch(() => {});
  }, [saveGame]);

  const handleTrade = useCallback(
    (input: { side: 'buy' | 'sell'; type: 'market' | 'limit' | 'stop'; amount: number; limitPrice?: number; stopPrice?: number }) => {
      if (!tradeTarget) return;
      const { symbol, price } = tradeTarget;
      if (input.type === 'market') {
        if (input.side === 'buy') buyStockMarket(setGameState, symbol, input.amount, price);
        else sellStockMarket(setGameState, symbol, input.amount, price);
      } else if (input.type === 'limit' && input.limitPrice != null) {
        placeStockLimitOrder(setGameState, symbol, input.side, input.amount, input.limitPrice);
      } else if (input.type === 'stop' && input.stopPrice != null) {
        placeStockStopOrder(setGameState, symbol, input.side, input.amount, input.stopPrice);
      }
      queueSave();
      setTradeTarget(null);
    },
    [tradeTarget, setGameState, queueSave]
  );

  // Week-over-week change per symbol. The engine walks every price weekly, but
  // the board used to render only the current quote — the most alive system in
  // the game looked frozen. lastWeekPrices is written by the weekly tick.
  const lastWeekPrices = stocks?.lastWeekPrices;
  const changeFor = useCallback(
    (symbol: string, price: number): number | undefined => {
      const prev = lastWeekPrices?.[symbol.toUpperCase()]?.price;
      if (typeof prev !== 'number' || !isFinite(prev) || prev <= 0 || !isFinite(price)) return undefined;
      return (price - prev) / prev;
    },
    [lastWeekPrices]
  );

  const renderMarket = () => (
    <View style={{ gap: responsiveSpacing.md }}>
      <EconomyEventBanner context="generic" />
      <SectionTitle theme={theme}>All Stocks</SectionTitle>
      {marketData.map((s) => {
        const holding = holdings.find((h) => h.symbol.toUpperCase() === s.symbol.toUpperCase());
        return (
          <StockRow
            key={s.symbol}
            symbol={s.symbol}
            price={s.price}
            changePct={changeFor(s.symbol, s.price)}
            dividendYield={s.dividendYield}
            shares={holding?.shares}
            averagePrice={holding?.averagePrice}
            sectorState={sectorStateFor(s.symbol)}
            darkMode={darkMode}
            onPress={() => setTradeTarget({ symbol: s.symbol, price: s.price })}
          />
        );
      })}
    </View>
  );

  const renderPortfolio = () => (
    <View style={{ gap: responsiveSpacing.md }}>
      <View style={[styles.heroCard, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
        <View style={[styles.heroIcon, { backgroundColor: accent.info }]}>
          <Briefcase size={scale(20)} color="white" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.heroLabel, { color: theme.textMuted }]}>Portfolio value</Text>
          <Text style={[styles.heroValue, { color: theme.text }]}>{formatMoney(portfolioValue)}</Text>
          <Text style={[styles.heroSub, { color: unrealized >= 0 ? accent.success : accent.danger }]}>
            {unrealized >= 0 ? '+' : ''}
            {formatMoney(unrealized)} unrealized
          </Text>
        </View>
      </View>

      <View style={styles.statGrid}>
        <StatCard theme={theme} label="Cost basis" value={formatMoney(costBasis)} />
        <StatCard theme={theme} label="Realized" value={formatMoney(realizedGains)} negative={realizedGains < 0} />
        <StatCard theme={theme} label="Dividends" value={formatMoney(totalDividends)} />
      </View>

      <SectionTitle theme={theme}>Holdings</SectionTitle>
      {holdings.length === 0 ? (
        <EmptyText theme={theme}>You don&apos;t hold any stocks yet.</EmptyText>
      ) : (
        holdings.map((h) => {
          const marketEntry = marketData.find((m) => m.symbol === h.symbol);
          return (
            <StockRow
              key={h.symbol}
              symbol={h.symbol}
              price={h.currentPrice}
              shares={h.shares}
              averagePrice={h.averagePrice}
              dividendYield={marketEntry?.dividendYield}
              sectorState={sectorStateFor(h.symbol)}
              darkMode={darkMode}
              onPress={() => setTradeTarget({ symbol: h.symbol, price: h.currentPrice })}
            />
          );
        })
      )}

      {watchlist.length > 0 && (
        <>
          <SectionTitle theme={theme}>Watchlist</SectionTitle>
          {watchlist.map((sym) => {
            const m = marketData.find((s) => s.symbol === sym);
            if (!m) return null;
            return (
              <StockRow
                key={sym}
                symbol={sym}
                price={m.price}
                dividendYield={m.dividendYield}
                sectorState={sectorStateFor(sym)}
                darkMode={darkMode}
                onPress={() => setTradeTarget({ symbol: sym, price: m.price })}
              />
            );
          })}
        </>
      )}
    </View>
  );

  const renderOrders = () => (
    <View style={{ gap: responsiveSpacing.md }}>
      <SectionTitle theme={theme}>Open Orders</SectionTitle>
      {openOrders.length === 0 ? (
        <EmptyText theme={theme}>No open orders.</EmptyText>
      ) : (
        openOrders.map((o) => (
          <View
            key={o.id}
            style={[styles.orderRow, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}
          >
            <View style={[styles.sideStripe, { backgroundColor: o.side === 'buy' ? accent.success : accent.danger }]} />
            <View style={{ flex: 1, padding: responsiveSpacing.sm }}>
              <Text style={[styles.orderTitle, { color: theme.text }]}>
                {o.side.toUpperCase()} {o.symbol} ({o.type})
              </Text>
              <Text style={[styles.orderMeta, { color: theme.textMuted }]}>
                {o.side === 'buy' ? formatMoney(o.amount) : `${o.amount} sh`}
                {o.limitPrice != null ? ` · limit ${formatMoney(o.limitPrice)}` : ''}
                {o.stopPrice != null ? ` · stop ${formatMoney(o.stopPrice)}` : ''}
                {' '} · w{o.placedWeek}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => {
                Alert.alert('Cancel order?', `${o.side} ${o.symbol}`, [
                  { text: 'Keep', style: 'cancel' },
                  {
                    text: 'Cancel',
                    style: 'destructive',
                    onPress: () => {
                      cancelStockOrder(setGameState, o.id);
                      queueSave();
                    },
                  },
                ]);
              }}
              style={styles.cancelBtn}
              hitSlop={10}
            >
              <X size={scale(16)} color={accent.danger} />
            </TouchableOpacity>
          </View>
        ))
      )}

      <SectionTitle theme={theme}>Recent Fills</SectionTitle>
      {orderHistory.length === 0 ? (
        <EmptyText theme={theme}>No fills yet.</EmptyText>
      ) : (
        orderHistory.slice(0, 8).map((o) => (
          <View
            key={o.id}
            style={[styles.orderRow, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}
          >
            <View style={[styles.sideStripe, { backgroundColor: o.side === 'buy' ? accent.success : accent.danger }]} />
            <View style={{ flex: 1, padding: responsiveSpacing.sm }}>
              <Text style={[styles.orderTitle, { color: theme.text }]}>
                {o.side.toUpperCase()} {o.symbol} · {o.status}
              </Text>
              <Text style={[styles.orderMeta, { color: theme.textMuted }]}>
                {o.filledPrice != null ? `Filled @ ${formatMoney(o.filledPrice)} · w${o.filledWeek}` : `w${o.placedWeek}`}
              </Text>
            </View>
          </View>
        ))
      )}
    </View>
  );

  return (
    <View style={[styles.root, { backgroundColor: theme.background, paddingTop: 0 }]}>
      <View style={[styles.topBar, { borderBottomColor: theme.border }]}>
        <TouchableOpacity onPress={onBack} hitSlop={10} style={styles.backBtn}>
          <ArrowLeft size={scale(22)} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.appTitle, { color: theme.text }]}>Stocks</Text>
        <View style={[styles.cashChip, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
          <Text style={[styles.cashChipText, { color: theme.text }]}>{formatMoney(cash)}</Text>
        </View>
      </View>

      <View style={[styles.tabBar, { borderBottomColor: theme.border }]}>
        {TABS.map((t) => {
          const active = activeTab === t.id;
          const Icon = t.icon;
          return (
            <TouchableOpacity
              key={t.id}
              onPress={() => setActiveTab(t.id)}
              style={[styles.tab, active && { borderBottomColor: accent.info }]}
            >
              <Icon size={scale(16)} color={active ? accent.info : theme.textMuted} />
              <Text style={[styles.tabText, { color: active ? accent.info : theme.textMuted }]}>{t.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <ScrollView
        style={{ flex: 1 }}
        // Clear the floating tab bar — a short padding left the bottom rows
        // (holdings / order cancel buttons) untappable underneath it.
        contentContainerStyle={{ padding: responsiveSpacing.md, paddingBottom: getAppScreenBottomPadding(insets.bottom) }}
      >
        {activeTab === 'market' && renderMarket()}
        {activeTab === 'portfolio' && renderPortfolio()}
        {activeTab === 'orders' && renderOrders()}
      </ScrollView>

      <StockTradeModal
        visible={!!tradeTarget}
        symbol={tradeTarget?.symbol ?? null}
        midPrice={tradeTarget?.price ?? 0}
        cash={cash}
        ownedShares={
          tradeTarget
            ? holdings.find((h) => h.symbol.toUpperCase() === tradeTarget.symbol.toUpperCase())?.shares ?? 0
            : 0
        }
        darkMode={darkMode}
        onClose={() => setTradeTarget(null)}
        onSubmit={handleTrade}
      />
    </View>
  );
}

function SectionTitle({ theme, children }: { theme: ReturnType<typeof getThemeColors>; children: React.ReactNode }) {
  return <Text style={[styles.sectionTitle, { color: theme.text }]}>{children}</Text>;
}

function EmptyText({ theme, children }: { theme: ReturnType<typeof getThemeColors>; children: React.ReactNode }) {
  return <Text style={[styles.emptyText, { color: theme.textMuted }]}>{children}</Text>;
}

function StatCard({ theme, label, value, negative }: { theme: ReturnType<typeof getThemeColors>; label: string; value: string; negative?: boolean }) {
  return (
    <View style={[styles.statCard, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
      <Text style={[styles.statLabel, { color: theme.textMuted }]}>{label}</Text>
      <Text
        style={[styles.statValue, { color: negative ? accent.danger : theme.text }]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.65}
      >
        {value}
      </Text>
    </View>
  );
}

export default function StocksApp(props: StocksAppProps) {
  return (
    <ErrorBoundary>
      <StocksAppInner {...props} />
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: responsiveSpacing.md,
    paddingVertical: responsiveSpacing.sm,
    borderBottomWidth: 1,
    gap: responsiveSpacing.sm,
  },
  backBtn: { padding: responsiveSpacing.xs },
  appTitle: { flex: 1, fontSize: responsiveFontSize.lg, fontWeight: '700' },
  cashChip: {
    paddingHorizontal: responsiveSpacing.sm,
    paddingVertical: 4,
    borderRadius: responsiveBorderRadius.full,
    borderWidth: 1,
  },
  cashChipText: { fontSize: responsiveFontSize.sm, fontWeight: '700' },
  tabBar: { flexDirection: 'row', borderBottomWidth: 1 },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: responsiveSpacing.sm,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabText: { fontSize: responsiveFontSize.sm, fontWeight: '600' },
  sectionTitle: { fontSize: responsiveFontSize.md, fontWeight: '700', marginTop: responsiveSpacing.xs },
  emptyText: { fontSize: responsiveFontSize.sm, textAlign: 'center', paddingVertical: responsiveSpacing.md },
  heroCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: responsiveSpacing.md,
    borderRadius: responsiveBorderRadius.lg,
    borderWidth: 1,
    gap: responsiveSpacing.sm,
  },
  heroIcon: {
    width: scale(40),
    height: scale(40),
    borderRadius: scale(20),
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroLabel: { fontSize: responsiveFontSize.xs, fontWeight: '600' },
  heroValue: { fontSize: responsiveFontSize['2xl'], fontWeight: '800' },
  heroSub: { fontSize: responsiveFontSize.xs, marginTop: 2 },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: responsiveSpacing.sm },
  statCard: {
    // 2-per-row wrap so formatMoney() values like "$1,234,567" don't get
    // truncated at ~115pt (3-up on a ~358pt phone).
    flexBasis: '48%',
    flexGrow: 1,
    padding: responsiveSpacing.sm,
    borderRadius: responsiveBorderRadius.lg,
    borderWidth: 1,
    gap: 2,
  },
  statLabel: { fontSize: responsiveFontSize.xs, fontWeight: '600' },
  statValue: { fontSize: responsiveFontSize.md, fontWeight: '800' },
  orderRow: {
    flexDirection: 'row',
    borderRadius: responsiveBorderRadius.lg,
    borderWidth: 1,
    overflow: 'hidden',
    alignItems: 'stretch',
  },
  sideStripe: { width: scale(4) },
  orderTitle: { fontSize: responsiveFontSize.sm, fontWeight: '700' },
  orderMeta: { fontSize: responsiveFontSize.xs, marginTop: 2 },
  cancelBtn: { justifyContent: 'center', paddingHorizontal: responsiveSpacing.sm },
});
