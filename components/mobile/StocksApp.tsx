/**
 * StocksApp — mobile stock trading, Apple Stocks DNA.
 *
 * A 3-tab loop plus a per-symbol detail page:
 *
 *   - Market: market-pulse summary strip + tappable SECTOR ROTATION board
 *     (surfaces each sector's momentum + weeks-remaining) + a sortable/filterable
 *     grouped watchlist (one card, hairline-separated dense rows).
 *   - Portfolio: value hero with day-change chip + mini trend, a sector
 *     ALLOCATION bar, a 6-stat grid, then grouped holdings + watchlist.
 *   - Orders: open/filled/closed summary, grouped open orders (visible Cancel
 *     buttons), grouped recent fills with status chips.
 *   - Detail (list -> detail sub-view): big quote + trend, your position, market
 *     data (previous close, yield, est. dividends, sector momentum), Trade CTA.
 *
 * Mechanics are unchanged — this pass only presents more of the existing state.
 * Order matching, sector rotation and dividends still run in the weekly tick.
 */

import React, { useState, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { ArrowLeft, BarChart3, Briefcase, Clock, X, Star } from 'lucide-react-native';
import { useGame } from '@/contexts/GameContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ErrorBoundary from '@/components/ErrorBoundary';
import {
  responsiveFontSize,
  responsiveSpacing,
  responsiveBorderRadius,
  scale,
  responsiveWidth,
  touchTargets,
  getAppScreenBottomPadding,
} from '@/utils/scaling';
import { getThemeColors, accent } from '@/lib/config/theme';
import { getGlassCard, getGlassIconContainer, getGlassCategoryTabsContainer, getPlatformShadows } from '@/utils/glassmorphismStyles';
import Gradient from '@/components/ui/Gradient';
import EconomyEventBanner from '@/components/shared/EconomyEventBanner';
import StockRow, { Sparkline, ChangeChip, SECTOR_COLOR, SECTOR_LABEL } from '@/components/stocks/StockRow';
import StockTradeModal from '@/components/stocks/StockTradeModal';
import { sectorForSymbol, ALL_SECTORS, Sector } from '@/lib/stocks/sectors';
import { quarterlyDividend } from '@/lib/stocks/dividends';
import {
  buyStockMarket,
  sellStockMarket,
  placeStockLimitOrder,
  placeStockStopOrder,
  cancelStockOrder,
  toggleStockWatchlist,
} from '@/contexts/game/actions/StockActions';

const LinearGradient = Gradient;

type Theme = ReturnType<typeof getThemeColors>;

interface StocksAppProps {
  onBack: () => void;
}

type Tab = 'market' | 'portfolio' | 'orders';
type SortMode = 'symbol' | 'movers' | 'price';

interface OrderRecord {
  id: string;
  symbol: string;
  side: 'buy' | 'sell';
  type: 'market' | 'limit' | 'stop';
  amount: number;
  limitPrice?: number;
  stopPrice?: number;
  placedWeek: number;
  status: 'open' | 'filled' | 'cancelled' | 'expired';
  filledPrice?: number;
  filledWeek?: number;
}

const TABS: { id: Tab; label: string; icon: React.ComponentType<{ size: number; color: string }> }[] = [
  { id: 'market', label: 'Market', icon: BarChart3 },
  { id: 'portfolio', label: 'Portfolio', icon: Briefcase },
  { id: 'orders', label: 'Orders', icon: Clock },
];

/** Aggregate money — M/k abbreviations for portfolio-scale numbers. */
function formatMoney(n: number): string {
  if (!isFinite(n)) return '$0';
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${n < 0 ? '-' : ''}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 10_000) return `${n < 0 ? '-' : ''}$${(abs / 1000).toFixed(1)}k`;
  return `$${Math.round(n).toLocaleString()}`;
}

/** Per-share price — 2 decimals under $1k, whole dollars above. */
function formatPrice(n: number): string {
  if (!isFinite(n)) return '$0';
  if (n >= 1000) return `$${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
  return `$${n.toFixed(2)}`;
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
  const dividendsThisYear = stocks?.dividendsThisYear ?? 0;

  const [activeTab, setActiveTab] = useState<Tab>('market');
  const [tradeTarget, setTradeTarget] = useState<{ symbol: string; price: number } | null>(null);
  const [detailSymbol, setDetailSymbol] = useState<string | null>(null);
  const [sectorFilter, setSectorFilter] = useState<Sector | null>(null);
  const [sortMode, setSortMode] = useState<SortMode>('symbol');

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
      return [] as { symbol: string; price: number; dividendYield: number }[];
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

  const portfolioValue = useMemo(() => holdings.reduce((s, h) => s + h.shares * h.currentPrice, 0), [holdings]);
  const costBasis = useMemo(() => holdings.reduce((s, h) => s + h.shares * h.averagePrice, 0), [holdings]);
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

  // Week-over-week change per symbol. lastWeekPrices is written by the weekly tick.
  const lastWeekPrices = stocks?.lastWeekPrices;
  const changeFor = useCallback(
    (symbol: string, price: number): number | undefined => {
      const prev = lastWeekPrices?.[symbol.toUpperCase()]?.price;
      if (typeof prev !== 'number' || !isFinite(prev) || prev <= 0 || !isFinite(price)) return undefined;
      return (price - prev) / prev;
    },
    [lastWeekPrices]
  );

  const openDetail = useCallback((symbol: string) => setDetailSymbol(symbol), []);

  const watchedSet = useMemo(() => new Set(watchlist.map((s) => s.toUpperCase())), [watchlist]);
  const isWatched = useCallback((symbol: string) => watchedSet.has(symbol.toUpperCase()), [watchedSet]);
  const toggleWatch = useCallback(
    (symbol: string) => {
      toggleStockWatchlist(setGameState, symbol);
      queueSave();
    },
    [setGameState, queueSave]
  );

  // Portfolio week change (from last week's holding prices — real, not fabricated).
  const portfolioWeekChange = useMemo(
    () =>
      holdings.reduce((s, h) => {
        const prev = lastWeekPrices?.[h.symbol.toUpperCase()]?.price;
        if (typeof prev !== 'number' || !isFinite(prev)) return s;
        return s + h.shares * (h.currentPrice - prev);
      }, 0),
    [holdings, lastWeekPrices]
  );
  const portfolioWeekPct = portfolioValue - portfolioWeekChange > 0 ? portfolioWeekChange / (portfolioValue - portfolioWeekChange) : undefined;

  const marketStats = useMemo(() => {
    let up = 0;
    let down = 0;
    for (const s of marketData) {
      const c = changeFor(s.symbol, s.price);
      if (c != null && c > 0) up++;
      else if (c != null && c < 0) down++;
    }
    const owned = holdings.filter((h) => h.shares > 0).length;
    return { total: marketData.length, up, down, owned };
  }, [marketData, changeFor, holdings]);

  const sectorBoard = useMemo(
    () =>
      ALL_SECTORS.map((sec) => {
        const count = marketData.filter((s) => sectorForSymbol(s.symbol) === sec).length;
        const snap = sectorSnapshots.find((x) => x.sector === sec);
        return {
          sector: sec,
          count,
          state: (snap?.state ?? 'neutral') as 'strong' | 'neutral' | 'weak',
          weeks: snap?.weeksRemaining,
        };
      }),
    [marketData, sectorSnapshots]
  );

  const visibleMarket = useMemo(() => {
    let list = marketData.slice();
    if (sectorFilter) list = list.filter((s) => sectorForSymbol(s.symbol) === sectorFilter);
    if (sortMode === 'symbol') list.sort((a, b) => a.symbol.localeCompare(b.symbol));
    else if (sortMode === 'price') list.sort((a, b) => b.price - a.price);
    else list.sort((a, b) => Math.abs(changeFor(b.symbol, b.price) ?? 0) - Math.abs(changeFor(a.symbol, a.price) ?? 0));
    return list;
  }, [marketData, sectorFilter, sortMode, changeFor]);

  const watchItems = useMemo(
    () =>
      watchlist
        .map((sym) => marketData.find((s) => s.symbol === sym))
        .filter((m): m is { symbol: string; price: number; dividendYield: number } => !!m),
    [watchlist, marketData]
  );

  const allocation = useMemo(() => {
    if (portfolioValue <= 0) return [] as { symbol: string; value: number; sector: Sector }[];
    return holdings
      .map((h) => ({ symbol: h.symbol, value: h.shares * h.currentPrice, sector: sectorForSymbol(h.symbol) }))
      .filter((x) => x.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [holdings, portfolioValue]);

  // --- Renderers ----------------------------------------------------------

  const renderMarket = () => (
    <View style={{ gap: responsiveSpacing.lg }}>
      <EconomyEventBanner context="generic" />

      <SummaryStrip
        theme={theme}
        darkMode={darkMode}
        items={[
          { label: 'Listed', value: String(marketStats.total), color: theme.text },
          { label: 'Advancing', value: String(marketStats.up), color: accent.success },
          { label: 'Declining', value: String(marketStats.down), color: accent.danger },
          { label: 'You own', value: String(marketStats.owned), color: accent.purple },
        ]}
      />

      <View style={{ gap: responsiveSpacing.sm }}>
        <SectionTitle theme={theme}>Sector rotation</SectionTitle>
        <View style={styles.sectorGrid}>
          {sectorBoard.map((b) => (
            <SectorTile
              key={b.sector}
              theme={theme}
              darkMode={darkMode}
              data={b}
              active={sectorFilter === b.sector}
              onPress={() => setSectorFilter(sectorFilter === b.sector ? null : b.sector)}
            />
          ))}
        </View>
      </View>

      <View style={{ gap: responsiveSpacing.sm }}>
        <View style={styles.listHeader}>
          <SectionTitle theme={theme}>{sectorFilter ? `${SECTOR_LABEL[sectorFilter]} stocks` : 'All stocks'}</SectionTitle>
          {sectorFilter && (
            <TouchableOpacity
              onPress={() => setSectorFilter(null)}
              style={styles.clearChip}
              accessibilityRole="button"
              accessibilityLabel="Clear sector filter"
            >
              <X size={scale(12)} color={accent.purple} />
              <Text style={[styles.clearChipText, { color: accent.purple }]}>Clear</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.sortRow}>
          {(['symbol', 'movers', 'price'] as SortMode[]).map((m) => {
            const active = sortMode === m;
            return (
              <TouchableOpacity
                key={m}
                onPress={() => setSortMode(m)}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                style={[styles.sortChip, active ? { backgroundColor: 'rgba(168,85,247,0.16)' } : { backgroundColor: theme.surfaceElevated }]}
              >
                <Text style={[styles.sortChipText, { color: active ? accent.purple : theme.textMuted }]}>
                  {m === 'symbol' ? 'A–Z' : m === 'movers' ? 'Movers' : 'Price'}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {visibleMarket.length === 0 ? (
          <EmptyText theme={theme} darkMode={darkMode}>
            No stocks in this sector.
          </EmptyText>
        ) : (
          <GroupCard theme={theme} darkMode={darkMode}>
            {visibleMarket.map((s, i) => {
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
                  grouped
                  isLast={i === visibleMarket.length - 1}
                  onPress={() => openDetail(s.symbol)}
                  watched={isWatched(s.symbol)}
                  onToggleWatch={() => toggleWatch(s.symbol)}
                />
              );
            })}
          </GroupCard>
        )}
      </View>
    </View>
  );

  const renderPortfolio = () => (
    <View style={{ gap: responsiveSpacing.lg }}>
      {/* Recipe B hero — the ONE focal gradient surface of this tab (purple identity) */}
      <HeroCard theme={theme} darkMode={darkMode}>
        <View style={styles.heroTopRow}>
          <View
            style={[
              getGlassIconContainer(darkMode, 44),
              { backgroundColor: 'rgba(168,85,247,0.15)', borderWidth: 1, borderColor: 'rgba(168,85,247,0.30)' },
            ]}
          >
            <Briefcase size={scale(22)} color={accent.purple} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.heroLabel, { color: theme.textMuted }]}>Portfolio value</Text>
            <Text style={[styles.heroValue, { color: theme.text }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
              {formatMoney(portfolioValue)}
            </Text>
          </View>
        </View>

        <View style={styles.heroChips}>
          <View style={styles.heroChipGroup}>
            <ChangeChip changePct={portfolioWeekPct} darkMode={darkMode} size="md" />
            <Text style={[styles.heroChipLabel, { color: theme.textMuted }]}>
              {portfolioWeekChange >= 0 ? '+' : ''}
              {formatMoney(portfolioWeekChange)} this week
            </Text>
          </View>
          <Text style={[styles.heroUnrealized, { color: unrealized >= 0 ? accent.success : accent.danger }]} numberOfLines={1}>
            {unrealized >= 0 ? '+' : ''}
            {formatMoney(unrealized)}
            {costBasis > 0 ? ` · ${unrealized >= 0 ? '+' : ''}${((unrealized / costBasis) * 100).toFixed(1)}%` : ''} unrealized
          </Text>
        </View>

        {portfolioValue > 0 && (
          <Sparkline
            changePct={portfolioWeekPct}
            color={portfolioWeekChange >= 0 ? accent.success : accent.danger}
            width={responsiveWidth(64)}
            height={scale(40)}
          />
        )}
      </HeroCard>

      {allocation.length > 0 && (
        <View style={{ gap: responsiveSpacing.sm }}>
          <SectionTitle theme={theme}>Allocation</SectionTitle>
          <View style={[getGlassCard(darkMode, 6), styles.allocCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={styles.allocBar}>
              {allocation.map((a) => (
                <View key={a.symbol} style={{ width: `${Math.max(2, (a.value / portfolioValue) * 100)}%`, backgroundColor: SECTOR_COLOR[a.sector] }} />
              ))}
            </View>
            <View style={styles.allocLegend}>
              {allocation.slice(0, 4).map((a) => (
                <View key={a.symbol} style={styles.allocLegendItem}>
                  <View style={[styles.legendDot, { backgroundColor: SECTOR_COLOR[a.sector] }]} />
                  <Text style={[styles.legendText, { color: theme.textSecondary }]} numberOfLines={1}>
                    {a.symbol}
                  </Text>
                  <Text style={[styles.legendPct, { color: theme.textMuted }]}>{((a.value / portfolioValue) * 100).toFixed(0)}%</Text>
                </View>
              ))}
            </View>
          </View>
        </View>
      )}

      <View style={styles.statGrid}>
        <StatCard theme={theme} darkMode={darkMode} label="Cost basis" value={formatMoney(costBasis)} />
        <StatCard
          theme={theme}
          darkMode={darkMode}
          label="Unrealized"
          value={`${unrealized >= 0 ? '+' : ''}${formatMoney(unrealized)}`}
          negative={unrealized < 0}
          positive={unrealized > 0}
        />
        <StatCard theme={theme} darkMode={darkMode} label="Realized" value={formatMoney(realizedGains)} negative={realizedGains < 0} />
        <StatCard theme={theme} darkMode={darkMode} label="Dividends" value={formatMoney(totalDividends)} />
        <StatCard theme={theme} darkMode={darkMode} label="Div. this yr" value={formatMoney(dividendsThisYear)} />
        <StatCard theme={theme} darkMode={darkMode} label="Positions" value={String(holdings.filter((h) => h.shares > 0).length)} />
      </View>

      <View style={{ gap: responsiveSpacing.sm }}>
        <SectionTitle theme={theme}>Holdings</SectionTitle>
        {holdings.length === 0 ? (
          <EmptyText theme={theme} darkMode={darkMode}>
            You don&apos;t hold any stocks yet.
          </EmptyText>
        ) : (
          <GroupCard theme={theme} darkMode={darkMode}>
            {holdings.map((h, i) => {
              const m = marketData.find((x) => x.symbol === h.symbol);
              return (
                <StockRow
                  key={h.symbol}
                  symbol={h.symbol}
                  price={h.currentPrice}
                  changePct={changeFor(h.symbol, h.currentPrice)}
                  shares={h.shares}
                  averagePrice={h.averagePrice}
                  dividendYield={m?.dividendYield}
                  sectorState={sectorStateFor(h.symbol)}
                  darkMode={darkMode}
                  grouped
                  isLast={i === holdings.length - 1}
                  onPress={() => openDetail(h.symbol)}
                  watched={isWatched(h.symbol)}
                  onToggleWatch={() => toggleWatch(h.symbol)}
                />
              );
            })}
          </GroupCard>
        )}
      </View>

      {watchItems.length > 0 && (
        <View style={{ gap: responsiveSpacing.sm }}>
          <SectionTitle theme={theme}>Watchlist</SectionTitle>
          <GroupCard theme={theme} darkMode={darkMode}>
            {watchItems.map((m, i) => (
              <StockRow
                key={m.symbol}
                symbol={m.symbol}
                price={m.price}
                changePct={changeFor(m.symbol, m.price)}
                dividendYield={m.dividendYield}
                sectorState={sectorStateFor(m.symbol)}
                darkMode={darkMode}
                grouped
                isLast={i === watchItems.length - 1}
                onPress={() => openDetail(m.symbol)}
                watched={isWatched(m.symbol)}
                onToggleWatch={() => toggleWatch(m.symbol)}
              />
            ))}
          </GroupCard>
        </View>
      )}
    </View>
  );

  const renderOrders = () => {
    const filled = orderHistory.filter((o) => o.status === 'filled').length;
    const closed = orderHistory.filter((o) => o.status === 'cancelled' || o.status === 'expired').length;
    return (
      <View style={{ gap: responsiveSpacing.lg }}>
        <SummaryStrip
          theme={theme}
          darkMode={darkMode}
          items={[
            { label: 'Open', value: String(openOrders.length), color: accent.purple },
            { label: 'Filled', value: String(filled), color: accent.success },
            { label: 'Closed', value: String(closed), color: theme.textMuted },
          ]}
        />

        <View style={{ gap: responsiveSpacing.sm }}>
          <SectionTitle theme={theme}>Open orders</SectionTitle>
          {openOrders.length === 0 ? (
            <EmptyText theme={theme} darkMode={darkMode}>
              No open orders.
            </EmptyText>
          ) : (
            <GroupCard theme={theme} darkMode={darkMode}>
              {openOrders.map((o, i) => (
                <OrderRow
                  key={o.id}
                  theme={theme}
                  order={o}
                  isLast={i === openOrders.length - 1}
                  onCancel={() => {
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
                />
              ))}
            </GroupCard>
          )}
        </View>

        <View style={{ gap: responsiveSpacing.sm }}>
          <SectionTitle theme={theme}>Recent fills</SectionTitle>
          {orderHistory.length === 0 ? (
            <EmptyText theme={theme} darkMode={darkMode}>
              No fills yet.
            </EmptyText>
          ) : (
            <GroupCard theme={theme} darkMode={darkMode}>
              {orderHistory.slice(0, 12).map((o, i, arr) => (
                <OrderRow key={o.id} theme={theme} order={o} isLast={i === arr.length - 1} />
              ))}
            </GroupCard>
          )}
        </View>
      </View>
    );
  };

  const renderDetail = () => {
    const symbol = detailSymbol as string;
    const m = marketData.find((x) => x.symbol.toUpperCase() === symbol.toUpperCase());
    const holding = holdings.find((h) => h.symbol.toUpperCase() === symbol.toUpperCase());
    const price = m?.price ?? holding?.currentPrice ?? 0;
    const dividendYield = m?.dividendYield ?? 0;
    const changePct = changeFor(symbol, price);
    const sector = sectorForSymbol(symbol);
    const state = sectorStateFor(symbol);
    const snap = sectorSnapshots.find((s) => s.sector === sector);
    const weeks = snap?.weeksRemaining;
    // BUG FIX: previous close was reconstructed by dividing the live price by
    // (1 + changePct) — a lossy round-trip that drifts from the real prior price.
    // Read the authoritative value the weekly tick stored in lastWeekPrices;
    // fall back to the back-calc only when that snapshot is missing.
    const storedPrevClose = lastWeekPrices?.[symbol.toUpperCase()]?.price;
    const prevClose = typeof storedPrevClose === 'number' && isFinite(storedPrevClose) && storedPrevClose > 0
      ? storedPrevClose
      : (changePct != null && isFinite(changePct) && changePct > -1 ? price / (1 + changePct) : undefined);
    const shares = holding?.shares ?? 0;
    const avg = holding?.averagePrice ?? 0;
    const owned = shares > 0;
    const marketValue = shares * price;
    const positionCost = shares * avg;
    const positionPnl = marketValue - positionCost;
    const positionPnlPct = positionCost > 0 ? positionPnl / positionCost : undefined;
    const estQuarterly = quarterlyDividend(shares, price, dividendYield);
    const estAnnual = estQuarterly * 4;
    const up = (changePct ?? 0) > 0;
    const down = (changePct ?? 0) < 0;
    const sparkColor = up ? accent.success : down ? accent.danger : theme.textMuted;
    const momentum = state === 'strong' ? 'Sector strong' : state === 'weak' ? 'Sector weak' : 'Sector neutral';
    const watched = isWatched(symbol);

    const marketRows: { label: string; value: string; color?: string }[] = [
      { label: 'Last price', value: formatPrice(price) },
      ...(prevClose != null ? [{ label: 'Previous close', value: formatPrice(prevClose) }] : []),
      {
        label: 'Week change',
        value: changePct != null ? `${changePct >= 0 ? '+' : ''}${(changePct * 100).toFixed(2)}%` : '—',
        color: changePct != null ? (changePct > 0 ? accent.success : changePct < 0 ? accent.danger : theme.textMuted) : theme.textMuted,
      },
      { label: 'Dividend yield', value: dividendYield > 0 ? `${(dividendYield * 100).toFixed(2)}%` : 'None' },
      ...(owned && estAnnual > 0 ? [{ label: 'Est. annual income', value: formatMoney(estAnnual) }] : []),
      { label: 'Sector', value: `${SECTOR_LABEL[sector]} · ${state}` },
    ];

    const positionRows: { label: string; value: string; color?: string }[] = [
      { label: 'Shares', value: shares.toFixed(2) },
      { label: 'Avg cost', value: formatPrice(avg) },
      { label: 'Cost basis', value: formatMoney(positionCost) },
      { label: 'Market value', value: formatMoney(marketValue) },
      {
        label: 'Unrealized P/L',
        value: `${positionPnl >= 0 ? '+' : ''}${formatMoney(positionPnl)}${positionPnlPct != null ? ` · ${positionPnl >= 0 ? '+' : ''}${(positionPnlPct * 100).toFixed(1)}%` : ''}`,
        color: positionPnl >= 0 ? accent.success : accent.danger,
      },
      ...(estQuarterly > 0 ? [{ label: 'Est. quarterly dividend', value: formatMoney(estQuarterly) }] : []),
    ];

    return (
      <View style={{ flex: 1 }}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => setDetailSymbol(null)} hitSlop={8} style={styles.backBtn} accessibilityRole="button" accessibilityLabel="Back">
            <ArrowLeft size={scale(22)} color={theme.text} />
          </TouchableOpacity>
          <Text style={[styles.appTitle, { color: theme.text }]}>{symbol}</Text>
          <View style={[styles.cashChip, { backgroundColor: 'rgba(168,85,247,0.14)', borderColor: 'rgba(168,85,247,0.30)' }]}>
            <Text style={[styles.cashChipText, { color: theme.text }]}>{formatMoney(cash)}</Text>
          </View>
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: responsiveSpacing.md, paddingBottom: getAppScreenBottomPadding(insets.bottom), gap: responsiveSpacing.lg }}
        >
          <HeroCard theme={theme} darkMode={darkMode}>
            <Text style={[styles.heroLabel, { color: theme.textMuted }]}>
              {SECTOR_LABEL[sector]} · {momentum}
              {weeks != null && state !== 'neutral' ? ` · ${weeks}w left` : ''}
            </Text>
            <Text style={[styles.detailPrice, { color: theme.text }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
              {formatPrice(price)}
            </Text>
            <View style={styles.heroChipGroup}>
              <ChangeChip changePct={changePct} darkMode={darkMode} size="md" />
              <Text style={[styles.heroChipLabel, { color: theme.textMuted }]}>
                this week{prevClose != null ? ` · prev ${formatPrice(prevClose)}` : ''}
              </Text>
            </View>
            <Sparkline changePct={changePct} color={sparkColor} width={responsiveWidth(64)} height={scale(56)} strokeWidth={2.5} />
          </HeroCard>

          {owned && (
            <View style={{ gap: responsiveSpacing.sm }}>
              <SectionTitle theme={theme}>Your position</SectionTitle>
              <InfoCard theme={theme} darkMode={darkMode} rows={positionRows} />
            </View>
          )}

          <View style={{ gap: responsiveSpacing.sm }}>
            <SectionTitle theme={theme}>Market data</SectionTitle>
            <InfoCard theme={theme} darkMode={darkMode} rows={marketRows} />
          </View>

          <View style={styles.ctaRow}>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => toggleWatch(symbol)}
              style={[
                styles.watchPill,
                {
                  borderColor: watched ? 'rgba(245,158,11,0.55)' : theme.border,
                  backgroundColor: watched ? 'rgba(245,158,11,0.14)' : theme.surface,
                },
              ]}
              accessibilityRole="button"
              accessibilityState={{ selected: watched }}
              accessibilityLabel={watched ? `Remove ${symbol} from watchlist` : `Add ${symbol} to watchlist`}
            >
              <Star size={scale(16)} color={watched ? accent.warning : theme.textMuted} fill={watched ? accent.warning : 'transparent'} />
              <Text style={[styles.watchPillText, { color: watched ? accent.warning : theme.textSecondary }]}>
                {watched ? 'Watching' : 'Watch'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => setTradeTarget({ symbol, price })}
              style={[styles.tradeCta, styles.tradeCtaFlex, getPlatformShadows(5, 0.3, 2, 8)]}
              accessibilityRole="button"
              accessibilityLabel={`Trade ${symbol}`}
            >
              <LinearGradient colors={[accent.purple, '#9333EA']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.tradeCtaFill}>
                <Text style={styles.tradeCtaText}>{owned ? `Trade ${symbol} · ${shares.toFixed(2)} sh` : `Trade ${symbol}`}</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    );
  };

  return (
    <View style={[styles.root, { backgroundColor: theme.background, paddingTop: 0 }]}>
      {detailSymbol ? (
        renderDetail()
      ) : (
        <>
          <View style={styles.topBar}>
            <TouchableOpacity onPress={onBack} hitSlop={8} style={styles.backBtn} accessibilityRole="button" accessibilityLabel="Back">
              <ArrowLeft size={scale(22)} color={theme.text} />
            </TouchableOpacity>
            <Text style={[styles.appTitle, { color: theme.text }]}>Stocks</Text>
            <View style={[styles.cashChip, { backgroundColor: 'rgba(168,85,247,0.14)', borderColor: 'rgba(168,85,247,0.30)' }]}>
              <Text style={[styles.cashChipText, { color: theme.text }]}>{formatMoney(cash)}</Text>
            </View>
          </View>

          <View style={[styles.tabBar, getGlassCategoryTabsContainer(darkMode)]}>
            {TABS.map((t) => {
              const active = activeTab === t.id;
              const Icon = t.icon;
              return (
                <TouchableOpacity
                  key={t.id}
                  onPress={() => setActiveTab(t.id)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={t.label}
                  style={[styles.tab, active && { backgroundColor: 'rgba(168,85,247,0.16)' }]}
                >
                  <Icon size={scale(16)} color={active ? accent.purple : theme.textMuted} />
                  <Text style={[styles.tabText, { color: active ? accent.purple : theme.textMuted }]}>{t.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <ScrollView
            style={{ flex: 1 }}
            // Clear the floating tab bar so the bottom rows stay tappable.
            contentContainerStyle={{ padding: responsiveSpacing.md, paddingBottom: getAppScreenBottomPadding(insets.bottom) }}
          >
            {activeTab === 'market' && renderMarket()}
            {activeTab === 'portfolio' && renderPortfolio()}
            {activeTab === 'orders' && renderOrders()}
          </ScrollView>
        </>
      )}

      <StockTradeModal
        visible={!!tradeTarget}
        symbol={tradeTarget?.symbol ?? null}
        midPrice={tradeTarget?.price ?? 0}
        cash={cash}
        ownedShares={tradeTarget ? holdings.find((h) => h.symbol.toUpperCase() === tradeTarget.symbol.toUpperCase())?.shares ?? 0 : 0}
        darkMode={darkMode}
        onClose={() => setTradeTarget(null)}
        onSubmit={handleTrade}
      />
    </View>
  );
}

// --- Small presentational helpers -----------------------------------------

function SectionTitle({ theme, children }: { theme: Theme; children: React.ReactNode }) {
  return <Text style={[styles.sectionTitle, { color: theme.text }]}>{children}</Text>;
}

function EmptyText({ theme, darkMode, children }: { theme: Theme; darkMode: boolean; children: React.ReactNode }) {
  return (
    <View style={[getGlassCard(darkMode, 6), styles.emptyCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <Text style={[styles.emptyText, { color: theme.textSecondary }]}>{children}</Text>
    </View>
  );
}

function StatCard({
  theme,
  darkMode,
  label,
  value,
  negative,
  positive,
}: {
  theme: Theme;
  darkMode: boolean;
  label: string;
  value: string;
  negative?: boolean;
  positive?: boolean;
}) {
  const color = negative ? accent.danger : positive ? accent.success : theme.text;
  return (
    <View style={[getGlassCard(darkMode, 6), styles.statCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <Text style={[styles.statLabel, { color: theme.textMuted }]}>{label}</Text>
      <Text style={[styles.statValue, { color }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.65}>
        {value}
      </Text>
    </View>
  );
}

/** Recipe B hero shell — purple identity wash + glow blob + dark-only hairline. */
function HeroCard({ theme, darkMode, children }: { theme: Theme; darkMode: boolean; children: React.ReactNode }) {
  return (
    <View
      style={[
        getGlassCard(darkMode, 12),
        {
          backgroundColor: theme.surface,
          borderColor: darkMode ? theme.glassBorder : theme.border,
          borderWidth: 1,
          borderRadius: responsiveBorderRadius['2xl'],
        },
      ]}
    >
      <View style={styles.heroInner}>
        <View pointerEvents="none" style={styles.heroBlob} />
        {darkMode && <View pointerEvents="none" style={styles.heroHairline} />}
        <View style={{ gap: responsiveSpacing.sm }}>{children}</View>
      </View>
    </View>
  );
}

/** One grouped card wrapping hairline-separated rows (list-group pattern). */
function GroupCard({ theme, darkMode, children }: { theme: Theme; darkMode: boolean; children: React.ReactNode }) {
  return (
    <View style={[getGlassCard(darkMode, 6), styles.groupCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <View style={styles.groupClip}>{children}</View>
    </View>
  );
}

/** Label/value rows inside a grouped card — used by the detail sub-view. */
function InfoCard({ theme, darkMode, rows }: { theme: Theme; darkMode: boolean; rows: { label: string; value: string; color?: string }[] }) {
  return (
    <View style={[getGlassCard(darkMode, 6), styles.groupCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <View style={styles.groupClip}>
        {rows.map((r, i) => (
          <View
            key={r.label}
            style={[styles.infoRow, i < rows.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.border }]}
          >
            <Text style={[styles.infoLabel, { color: theme.textMuted }]}>{r.label}</Text>
            <Text style={[styles.infoValue, { color: r.color ?? theme.text }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
              {r.value}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

/** Dense horizontal stat bar with vertical hairline dividers. */
function SummaryStrip({ theme, darkMode, items }: { theme: Theme; darkMode: boolean; items: { label: string; value: string; color: string }[] }) {
  return (
    <View style={[getGlassCard(darkMode, 6), styles.summaryStrip, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      {items.map((it, i) => (
        <React.Fragment key={it.label}>
          {i > 0 && <View style={[styles.summaryDivider, { backgroundColor: theme.border }]} />}
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryValue, { color: it.color }]} numberOfLines={1}>
              {it.value}
            </Text>
            <Text style={[styles.summaryLabel, { color: theme.textMuted }]} numberOfLines={1}>
              {it.label}
            </Text>
          </View>
        </React.Fragment>
      ))}
    </View>
  );
}

/** Tappable sector-momentum tile — filters the market list by sector. */
function SectorTile({
  theme,
  darkMode,
  data,
  active,
  onPress,
}: {
  theme: Theme;
  darkMode: boolean;
  data: { sector: Sector; count: number; state: 'strong' | 'neutral' | 'weak'; weeks?: number };
  active: boolean;
  onPress: () => void;
}) {
  const stateColor = data.state === 'strong' ? accent.success : data.state === 'weak' ? accent.danger : theme.textMuted;
  const glyph = data.state === 'strong' ? '↑' : data.state === 'weak' ? '↓' : '•';
  const word = data.state === 'strong' ? 'Strong' : data.state === 'weak' ? 'Weak' : 'Neutral';
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={`${SECTOR_LABEL[data.sector]} sector, ${word}, ${data.count} stocks${
        data.weeks != null && data.state !== 'neutral' ? `, ${data.weeks} weeks left` : ''
      }`}
      style={[
        getGlassCard(darkMode, 6),
        styles.sectorTile,
        { backgroundColor: theme.surface, borderColor: active ? 'rgba(168,85,247,0.5)' : theme.border, borderWidth: active ? 1.5 : 1 },
      ]}
    >
      <View style={styles.sectorTileHead}>
        <View style={[styles.legendDot, { backgroundColor: SECTOR_COLOR[data.sector] }]} />
        <Text style={[styles.sectorTileName, { color: theme.text }]} numberOfLines={1}>
          {SECTOR_LABEL[data.sector]}
        </Text>
      </View>
      <Text style={[styles.sectorTileState, { color: stateColor }]}>
        {glyph} {word}
      </Text>
      <Text style={[styles.sectorTileMeta, { color: theme.textMuted }]} numberOfLines={1}>
        {data.count} stocks{data.weeks != null && data.state !== 'neutral' ? ` · ${data.weeks}w` : ''}
      </Text>
    </TouchableOpacity>
  );
}

/** Grouped order row (open orders show a Cancel button; fills show a status chip). */
function OrderRow({ theme, order, isLast, onCancel }: { theme: Theme; order: OrderRecord; isLast: boolean; onCancel?: () => void }) {
  const o = order;
  const sideColor = o.side === 'buy' ? accent.success : accent.danger;
  const statusColor = o.status === 'filled' ? accent.success : o.status === 'open' ? accent.purple : theme.textMuted;
  return (
    // Hard Rule #7: this row carried the buy/sell side as a scale(3) bar down
    // its left edge — a side accent bar, banned by name even though it is a
    // View rather than a border. The colour moves onto a faint row tint.
    //
    // Kept weak on purpose: the title below already reads "BUY AAPL" /
    // "SELL AAPL" in plain text, so the side is stated, not merely coloured.
    // The borderBottom stays — a neutral hairline row divider is one of the
    // rule's explicit structural exceptions.
    <View style={[
      styles.orderRow,
      { backgroundColor: `${sideColor}0F` },
      !isLast && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.border },
    ]}>
      <View style={styles.orderContent}>
        <View style={{ flex: 1 }}>
          <View style={styles.orderTitleRow}>
            <Text style={[styles.orderTitle, { color: theme.text }]} numberOfLines={1}>
              {o.side.toUpperCase()} {o.symbol}
            </Text>
            <View style={[styles.typeChip, { backgroundColor: theme.surfaceElevated }]}>
              <Text style={[styles.typeChipText, { color: theme.textSecondary }]}>{o.type}</Text>
            </View>
            {!onCancel && (
              <View style={[styles.statusChip, { backgroundColor: `${statusColor}22` }]}>
                <Text style={[styles.statusChipText, { color: statusColor }]}>{o.status}</Text>
              </View>
            )}
          </View>
          <Text style={[styles.orderMeta, { color: theme.textMuted }]} numberOfLines={1}>
            {o.side === 'buy' ? formatMoney(o.amount) : `${o.amount} sh`}
            {o.limitPrice != null ? ` · limit ${formatMoney(o.limitPrice)}` : ''}
            {o.stopPrice != null ? ` · stop ${formatMoney(o.stopPrice)}` : ''}
            {o.filledPrice != null ? ` · filled ${formatMoney(o.filledPrice)} · w${o.filledWeek}` : ` · placed w${o.placedWeek}`}
          </Text>
        </View>
        {onCancel && (
          <TouchableOpacity
            onPress={onCancel}
            style={[styles.cancelBtn, { borderColor: `${accent.danger}59` }]}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={`Cancel ${o.side} order for ${o.symbol}`}
          >
            <X size={scale(13)} color={accent.danger} />
            <Text style={[styles.cancelBtnText, { color: accent.danger }]}>Cancel</Text>
          </TouchableOpacity>
        )}
      </View>
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
    gap: responsiveSpacing.sm,
  },
  backBtn: { width: scale(40), height: scale(40), alignItems: 'center', justifyContent: 'center' },
  appTitle: { flex: 1, fontSize: responsiveFontSize.lg, fontWeight: '700' },
  cashChip: {
    paddingHorizontal: responsiveSpacing.sm,
    paddingVertical: 4,
    borderRadius: responsiveBorderRadius.full,
    borderWidth: 1,
  },
  cashChipText: { fontSize: responsiveFontSize.sm, fontWeight: '700', fontVariant: ['tabular-nums'] },
  // Segmented control directly under the top bar — it anchors the screen, so the top bar drops its bottom border.
  tabBar: {
    flexDirection: 'row',
    gap: scale(4),
    marginHorizontal: responsiveSpacing.md,
    marginTop: responsiveSpacing.sm,
    marginBottom: responsiveSpacing.sm,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: responsiveSpacing.sm,
    borderRadius: responsiveBorderRadius.lg,
  },
  tabText: { fontSize: responsiveFontSize.sm, fontWeight: '600' },
  sectionTitle: { fontSize: responsiveFontSize.md, fontWeight: '700', letterSpacing: 0.2 },
  emptyText: { fontSize: responsiveFontSize.sm, textAlign: 'center', opacity: 0.6 },
  emptyCard: {
    borderRadius: responsiveBorderRadius.xl,
    borderWidth: 1,
    paddingVertical: responsiveSpacing.md,
    paddingHorizontal: responsiveSpacing.md,
    alignItems: 'center',
  },

  // Hero (Recipe B)
  heroInner: {
    borderRadius: responsiveBorderRadius['2xl'],
    overflow: 'hidden',
    padding: responsiveSpacing.lg,
  },
  heroBlob: {
    position: 'absolute',
    top: -scale(48),
    right: -scale(36),
    width: scale(150),
    height: scale(150),
    borderRadius: scale(75),
    backgroundColor: 'rgba(168,85,247,0.10)',
  },
  heroHairline: { position: 'absolute', top: 0, left: 0, right: 0, height: 1, backgroundColor: 'rgba(255,255,255,0.08)' },
  heroTopRow: { flexDirection: 'row', alignItems: 'center', gap: responsiveSpacing.md },
  heroLabel: { fontSize: responsiveFontSize.xs, fontWeight: '600', letterSpacing: 0.8, textTransform: 'uppercase' },
  heroValue: { fontSize: responsiveFontSize['4xl'], fontWeight: '800', fontVariant: ['tabular-nums'] },
  detailPrice: { fontSize: responsiveFontSize['4xl'], fontWeight: '800', fontVariant: ['tabular-nums'] },
  heroChips: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: responsiveSpacing.xs },
  heroChipGroup: { flexDirection: 'row', alignItems: 'center', gap: responsiveSpacing.xs, flexShrink: 1 },
  heroChipLabel: { fontSize: responsiveFontSize.xs, flexShrink: 1 },
  heroUnrealized: { fontSize: responsiveFontSize.xs, fontWeight: '700', fontVariant: ['tabular-nums'] },

  // Allocation
  allocCard: { borderRadius: responsiveBorderRadius.xl, borderWidth: 1, padding: responsiveSpacing.md, gap: responsiveSpacing.sm },
  allocBar: { flexDirection: 'row', height: scale(12), borderRadius: responsiveBorderRadius.full, overflow: 'hidden' },
  allocLegend: { flexDirection: 'row', flexWrap: 'wrap', gap: responsiveSpacing.sm },
  allocLegendItem: { flexDirection: 'row', alignItems: 'center', gap: scale(4) },
  legendDot: { width: scale(8), height: scale(8), borderRadius: scale(4) },
  legendText: { fontSize: responsiveFontSize.xs, fontWeight: '700' },
  legendPct: { fontSize: responsiveFontSize.xs, fontVariant: ['tabular-nums'] },

  // Stat grid
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: responsiveSpacing.sm },
  statCard: {
    flexBasis: '48%',
    flexGrow: 1,
    padding: responsiveSpacing.md,
    borderRadius: responsiveBorderRadius.xl,
    borderWidth: 1,
    gap: 2,
  },
  statLabel: { fontSize: responsiveFontSize.xs, fontWeight: '600' },
  statValue: { fontSize: responsiveFontSize.md, fontWeight: '800', fontVariant: ['tabular-nums'] },

  // Grouped list card
  groupCard: { borderRadius: responsiveBorderRadius.xl, borderWidth: 1 },
  groupClip: { borderRadius: responsiveBorderRadius.xl, overflow: 'hidden' },

  // Market list controls
  listHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  clearChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(3),
    paddingHorizontal: responsiveSpacing.sm,
    minHeight: scale(36),
    borderRadius: responsiveBorderRadius.full,
    backgroundColor: 'rgba(168,85,247,0.14)',
  },
  clearChipText: { fontSize: responsiveFontSize.xs, fontWeight: '700' },
  sortRow: { flexDirection: 'row', gap: responsiveSpacing.xs },
  sortChip: { flex: 1, minHeight: scale(36), alignItems: 'center', justifyContent: 'center', borderRadius: responsiveBorderRadius.lg },
  sortChipText: { fontSize: responsiveFontSize.sm, fontWeight: '700' },

  // Sector board
  sectorGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: responsiveSpacing.sm },
  sectorTile: { flexBasis: '48%', flexGrow: 1, borderRadius: responsiveBorderRadius.xl, padding: responsiveSpacing.md, gap: scale(3) },
  sectorTileHead: { flexDirection: 'row', alignItems: 'center', gap: responsiveSpacing.xs },
  sectorTileName: { fontSize: responsiveFontSize.sm, fontWeight: '700', flexShrink: 1 },
  sectorTileState: { fontSize: responsiveFontSize.sm, fontWeight: '800' },
  sectorTileMeta: { fontSize: responsiveFontSize.xs },

  // Summary strip
  summaryStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: responsiveBorderRadius.xl,
    borderWidth: 1,
    paddingVertical: responsiveSpacing.md,
    paddingHorizontal: responsiveSpacing.sm,
  },
  summaryItem: { flex: 1, alignItems: 'center', gap: scale(2) },
  summaryValue: { fontSize: responsiveFontSize.lg, fontWeight: '800', fontVariant: ['tabular-nums'] },
  summaryLabel: { fontSize: responsiveFontSize.xs, fontWeight: '600' },
  summaryDivider: { width: StyleSheet.hairlineWidth, alignSelf: 'stretch', marginVertical: scale(2) },

  // Info rows (detail)
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: responsiveSpacing.md,
    paddingVertical: responsiveSpacing.sm,
    paddingHorizontal: responsiveSpacing.md,
  },
  infoLabel: { fontSize: responsiveFontSize.sm, flexShrink: 0 },
  infoValue: { fontSize: responsiveFontSize.sm, fontWeight: '700', fontVariant: ['tabular-nums'], flexShrink: 1, textAlign: 'right' },

  // Order rows. (The scale(3) `stripe` that lived here is gone — Hard Rule #7;
  // the side now shows as a faint row tint plus the existing BUY/SELL title.)
  orderRow: { flexDirection: 'row', alignItems: 'stretch' },
  orderContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: responsiveSpacing.sm,
    paddingVertical: responsiveSpacing.sm,
    paddingHorizontal: responsiveSpacing.md,
  },
  orderTitleRow: { flexDirection: 'row', alignItems: 'center', gap: responsiveSpacing.xs },
  orderTitle: { fontSize: responsiveFontSize.sm, fontWeight: '700', flexShrink: 1 },
  typeChip: { paddingHorizontal: responsiveSpacing.xs, paddingVertical: 1, borderRadius: responsiveBorderRadius.sm },
  typeChipText: { fontSize: responsiveFontSize.xs, fontWeight: '700', textTransform: 'capitalize' },
  statusChip: { paddingHorizontal: responsiveSpacing.xs, paddingVertical: 1, borderRadius: responsiveBorderRadius.sm },
  statusChipText: { fontSize: responsiveFontSize.xs, fontWeight: '700', textTransform: 'capitalize' },
  orderMeta: { fontSize: responsiveFontSize.xs, marginTop: 2 },
  cancelBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(3),
    paddingHorizontal: responsiveSpacing.sm,
    minHeight: scale(36),
    borderRadius: responsiveBorderRadius.lg,
    borderWidth: 1,
  },
  cancelBtnText: { fontSize: responsiveFontSize.xs, fontWeight: '700' },

  // Trade CTA (detail) + watch pill row
  ctaRow: { flexDirection: 'row', alignItems: 'stretch', gap: responsiveSpacing.sm },
  tradeCta: { borderRadius: responsiveBorderRadius.full },
  tradeCtaFlex: { flex: 1 },
  watchPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: scale(6),
    minHeight: touchTargets.minimum,
    paddingHorizontal: responsiveSpacing.md,
    borderRadius: responsiveBorderRadius.full,
    borderWidth: 1,
  },
  watchPillText: { fontSize: responsiveFontSize.sm, fontWeight: '700' },
  tradeCtaFill: {
    borderRadius: responsiveBorderRadius.full,
    minHeight: touchTargets.minimum,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: responsiveSpacing.md,
    paddingHorizontal: responsiveSpacing.lg,
  },
  tradeCtaText: { color: '#FFFFFF', fontSize: responsiveFontSize.md, fontWeight: '700' },
});
