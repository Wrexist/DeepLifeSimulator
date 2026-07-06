/**
 * BitcoinMiningApp — desktop crypto trading + mining screen.
 *
 * Remake (STATE_VERSION 16). Replaces the 6,034-LOC eight-tab version with
 * three focused tabs:
 *
 *   - Trade: market regime banner + per-coin sparklines + place-order modal
 *     (market / limit / stop), open-order book, fill history.
 *   - Mine: owned miners, computed weekly earnings, simple buy flow per tier.
 *   - Portfolio: holdings table with P/L, average cost, DCA schedules.
 *
 * Price evolution + order matching + DCA execution happen in lib/crypto/weeklyTick.ts
 * (called from GameActionsContext.nextWeek). This file is just the view layer
 * dispatching CryptoTradingActions; no business logic lives here.
 */

import React, { useState, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import {
  ArrowLeft,
  TrendingUp,
  Hammer,
  Briefcase,
  Plus,
  Cpu,
  Bitcoin,
} from 'lucide-react-native';
import { useGame } from '@/contexts/GameContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ErrorBoundary from '@/components/ErrorBoundary';
import { Crypto, CryptoOrderSide, CryptoOrderType } from '@/contexts/game/types';
import { responsiveFontSize, responsiveSpacing, responsiveBorderRadius, scale, getTabBarSafePadding } from '@/utils/scaling';
import { getThemeColors, accent } from '@/lib/config/theme';
import { initialGameState } from '@/contexts/game/initialState';
import { MINER_PRICES } from '@/lib/economy/constants';

import EconomyEventBanner from '@/components/shared/EconomyEventBanner';
import CoinRow from '@/components/crypto/CoinRow';
import RegimeBanner from '@/components/crypto/RegimeBanner';
import OrderRow from '@/components/crypto/OrderRow';
import DCARuleRow from '@/components/crypto/DCARuleRow';
import PlaceOrderModal from '@/components/crypto/PlaceOrderModal';
import DCAModal from '@/components/crypto/DCAModal';

import {
  buyCryptoMarket,
  sellCryptoMarket,
  placeLimitOrder,
  placeStopOrder,
  cancelCryptoOrder,
  addCryptoDCA,
  removeCryptoDCA,
} from '@/contexts/game/actions/CryptoTradingActions';

interface BitcoinMiningAppProps {
  onBack: () => void;
}

type Tab = 'trade' | 'mine' | 'portfolio';

const TABS: { id: Tab; label: string; icon: React.ComponentType<{ size: number; color: string }> }[] = [
  { id: 'trade', label: 'Trade', icon: TrendingUp },
  { id: 'mine', label: 'Mine', icon: Hammer },
  { id: 'portfolio', label: 'Portfolio', icon: Briefcase },
];

// Values mirror warehouseMinerEarnings in lib/economy/passiveIncome.ts so the
// "estimated weekly yield" is accurate — and all 8 economy tiers are buyable
// (the top 3 were defined in the economy but missing from this UI).
const MINER_TIERS: { id: string; label: string; weeklyEarnings: number }[] = [
  { id: 'basic',      label: 'Basic Miner',      weeklyEarnings: 22 },
  { id: 'advanced',   label: 'Advanced Miner',   weeklyEarnings: 105 },
  { id: 'pro',        label: 'Pro Miner',        weeklyEarnings: 438 },
  { id: 'industrial', label: 'Industrial Miner', weeklyEarnings: 1575 },
  { id: 'quantum',    label: 'Quantum Miner',    weeklyEarnings: 7000 },
  { id: 'mega',       label: 'Mega Miner',       weeklyEarnings: 35000 },
  { id: 'giga',       label: 'Giga Miner',       weeklyEarnings: 140000 },
  { id: 'tera',       label: 'Tera Miner',       weeklyEarnings: 700000 },
];

function formatMoney(n: number): string {
  if (!isFinite(n)) return '$0';
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${n < 0 ? '-' : ''}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 10_000) return `${n < 0 ? '-' : ''}$${(abs / 1000).toFixed(1)}k`;
  return `$${Math.round(n).toLocaleString()}`;
}

function BitcoinMiningAppInner({ onBack }: BitcoinMiningAppProps) {
  const { gameState, setGameState, saveGame } = useGame();
  const insets = useSafeAreaInsets();
  const darkMode = !!gameState.settings?.darkMode;
  const theme = getThemeColors(darkMode);
  const market = gameState.cryptoMarket ?? initialGameState.cryptoMarket!;
  const banking = gameState.banking ?? initialGameState.banking;

  const [activeTab, setActiveTab] = useState<Tab>('trade');
  const [selectedCoinId, setSelectedCoinId] = useState<string>('btc');
  const [orderCoin, setOrderCoin] = useState<Crypto | null>(null);
  const [showDCA, setShowDCA] = useState(false);

  const cash = gameState.stats?.money ?? 0;
  // Old/migrated saves can lack the cryptos array — guard every read.
  const cryptos = gameState.cryptos ?? [];
  const selectedCoin = cryptos.find((c) => c.id === selectedCoinId);
  const selectedCoinMarket = market.coinMarkets[selectedCoinId];

  const queueSave = useCallback(() => {
    saveGame().catch(() => {});
  }, [saveGame]);

  // --- Portfolio derived values --------------------------------------------
  const portfolioTotalValue = useMemo(
    () => cryptos.reduce((sum, c) => sum + (c.owned ?? 0) * (c.price ?? 0), 0),
    [gameState.cryptos]
  );
  const portfolioCostBasis = useMemo(
    () =>
      Object.values(market.costBasis ?? {}).reduce(
        (sum, cb) => sum + (cb?.totalCost ?? 0),
        0
      ),
    [market.costBasis]
  );
  const portfolioUnrealizedPL = portfolioTotalValue - portfolioCostBasis;

  // --- Mining derived values -----------------------------------------------
  const ownedMiners = gameState.warehouse?.miners ?? {};
  const totalMiners = useMemo(
    () => Object.values(ownedMiners).reduce((sum, n) => sum + (n || 0), 0),
    [ownedMiners]
  );
  const estimatedWeeklyMiningEarnings = useMemo(() => {
    let total = 0;
    for (const tier of MINER_TIERS) {
      total += (ownedMiners[tier.id] ?? 0) * tier.weeklyEarnings;
    }
    return total;
  }, [ownedMiners]);

  // --- Handlers ------------------------------------------------------------
  const handlePlaceOrder = (input: {
    side: CryptoOrderSide;
    type: CryptoOrderType;
    amount: number;
    limitPrice?: number;
    stopPrice?: number;
  }) => {
    if (!orderCoin) return;
    if (input.type === 'market') {
      if (input.side === 'buy') buyCryptoMarket(setGameState, orderCoin.id, input.amount);
      else sellCryptoMarket(setGameState, orderCoin.id, input.amount);
    } else if (input.type === 'limit' && input.limitPrice != null) {
      placeLimitOrder(setGameState, orderCoin.id, input.side, input.amount, input.limitPrice);
    } else if (input.type === 'stop' && input.stopPrice != null) {
      placeStopOrder(setGameState, orderCoin.id, input.side, input.amount, input.stopPrice);
    }
    queueSave();
    setOrderCoin(null);
  };

  const handleBuyMiner = (tierId: string) => {
    const price = MINER_PRICES[tierId];
    if (price == null || cash < price) {
      Alert.alert('Insufficient funds', `Need ${formatMoney(price)} to buy this miner.`);
      return;
    }
    setGameState((prev) => {
      // Atomic gate: re-check affordability against prev. The old
      // Math.max(0, money - price) clamp let a same-batch double-tap grant a
      // second miner while only clamping money to 0 — a discounted-to-free
      // income asset.
      if ((prev.stats?.money ?? 0) < price) return prev;
      const w = prev.warehouse ?? {
        level: 1,
        miners: {},
        selectedCrypto: 'btc',
      };
      const miners = { ...(w.miners ?? {}) };
      miners[tierId] = (miners[tierId] ?? 0) + 1;
      return {
        ...prev,
        stats: { ...prev.stats, money: (prev.stats?.money ?? 0) - price },
        warehouse: { ...w, miners },
      };
    });
    queueSave();
  };

  // --- Render helpers ------------------------------------------------------
  const renderTrade = () => (
    <View style={{ gap: responsiveSpacing.md }}>
      <EconomyEventBanner context="crypto" />
      {selectedCoinMarket && (
        <RegimeBanner
          regime={selectedCoinMarket.regime}
          weeksRemaining={selectedCoinMarket.regimeWeeksRemaining}
          darkMode={darkMode}
        />
      )}

      <SectionTitle theme={theme}>Markets</SectionTitle>
      {cryptos.map((coin) => (
        <CoinRow
          key={coin.id}
          coin={coin}
          market={market.coinMarkets[coin.id]}
          darkMode={darkMode}
          showHoldings
          onPress={() => {
            setSelectedCoinId(coin.id);
            setOrderCoin(coin);
          }}
        />
      ))}

      <View style={styles.headerRow}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>Open Orders</Text>
        <Text style={[styles.subText, { color: theme.textMuted }]}>
          {market.openOrders.length} active
        </Text>
      </View>
      {market.openOrders.length === 0 ? (
        <EmptyText theme={theme}>
          No open orders. Tap a coin above to place a market, limit, or stop order.
        </EmptyText>
      ) : (
        market.openOrders.map((o) => (
          <OrderRow
            key={o.id}
            order={o}
            darkMode={darkMode}
            onCancel={() => {
              cancelCryptoOrder(setGameState, o.id);
              queueSave();
            }}
          />
        ))
      )}

      <SectionTitle theme={theme}>Recent Fills</SectionTitle>
      {market.orderHistory.length === 0 ? (
        <EmptyText theme={theme}>No fills yet.</EmptyText>
      ) : (
        market.orderHistory.slice(0, 5).map((o) => (
          <OrderRow key={o.id} order={o} darkMode={darkMode} />
        ))
      )}
    </View>
  );

  const renderMine = () => (
    <View style={{ gap: responsiveSpacing.md }}>
      <View style={[styles.heroCard, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
        <View style={[styles.heroIcon, { backgroundColor: accent.warning }]}>
          <Cpu size={scale(20)} color="white" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.heroLabel, { color: theme.textMuted }]}>Estimated weekly mining yield</Text>
          <Text style={[styles.heroValue, { color: theme.text }]}>{formatMoney(estimatedWeeklyMiningEarnings)}</Text>
          <Text style={[styles.subText, { color: theme.textMuted }]}>
            {totalMiners} miner{totalMiners === 1 ? '' : 's'} active · {(gameState.warehouse?.selectedCrypto ?? 'btc').toUpperCase()}
          </Text>
        </View>
      </View>

      <SectionTitle theme={theme}>Buy Miners</SectionTitle>
      {MINER_TIERS.map((tier) => {
        const owned = ownedMiners[tier.id] ?? 0;
        const price = MINER_PRICES[tier.id];
        const canAfford = cash >= price;
        return (
          <View
            key={tier.id}
            style={[styles.minerRow, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}
          >
            <View style={[styles.minerIcon, { backgroundColor: theme.surface }]}>
              <Bitcoin size={scale(16)} color={theme.text} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.minerName, { color: theme.text }]}>{tier.label}</Text>
              <Text style={[styles.subText, { color: theme.textMuted }]}>
                {formatMoney(tier.weeklyEarnings)}/wk · You own {owned}
              </Text>
            </View>
            <TouchableOpacity
              disabled={!canAfford}
              onPress={() => handleBuyMiner(tier.id)}
              style={[
                styles.buyBtn,
                { backgroundColor: canAfford ? accent.warning : theme.border },
              ]}
              accessibilityRole="button"
              accessibilityLabel={`Buy ${tier.label} miner for ${formatMoney(price)}`}
              accessibilityState={{ disabled: !canAfford }}
            >
              <Text style={styles.buyBtnText}>{formatMoney(price)}</Text>
            </TouchableOpacity>
          </View>
        );
      })}

      <SectionTitle theme={theme}>Selected Coin</SectionTitle>
      <View style={styles.chipRow}>
        {cryptos.map((c) => (
          <TouchableOpacity
            key={c.id}
            onPress={() => {
              setGameState((prev) => ({
                ...prev,
                warehouse: prev.warehouse
                  ? { ...prev.warehouse, selectedCrypto: c.id }
                  : { level: 1, miners: {}, selectedCrypto: c.id },
              }));
              queueSave();
            }}
            accessibilityRole="radio"
            accessibilityLabel={`Mine ${c.name ?? c.symbol ?? c.id}`}
            accessibilityState={{ selected: gameState.warehouse?.selectedCrypto === c.id }}
            style={[
              styles.chip,
              {
                borderColor: gameState.warehouse?.selectedCrypto === c.id ? accent.warning : theme.border,
                backgroundColor:
                  gameState.warehouse?.selectedCrypto === c.id ? accent.warning : theme.surfaceElevated,
              },
            ]}
          >
            <Text
              style={[
                styles.chipText,
                { color: gameState.warehouse?.selectedCrypto === c.id ? 'white' : theme.text },
              ]}
            >
              {c.symbol}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const renderPortfolio = () => {
    // Halving countdown: BTC halves every ~208 weeks (4 game years) of game time.
    // The reward-halving mechanism itself is deferred; this UI lights up the countdown.
    const HALVING_INTERVAL_WEEKS = 208;
    const lastHalving = market.lastHalvingWeek ?? 0;
    const nextHalvingWeek = lastHalving + HALVING_INTERVAL_WEEKS;
    const weeksToHalving = Math.max(0, nextHalvingWeek - gameState.weeksLived);

    // Dirty-BTC indicator: dirty BTC sits in the dark-web wallet; exchanges refuse it.
    const dirtyBtc = gameState.darkWeb?.dirtyBtc ?? 0;
    const btcCoin = cryptos.find((c) => c.id === 'btc');
    const dirtyBtcUSD = dirtyBtc * (btcCoin?.price ?? 0);

    return (
    <View style={{ gap: responsiveSpacing.md }}>
      <View style={[styles.heroCard, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
        <View style={[styles.heroIcon, { backgroundColor: accent.info }]}>
          <Briefcase size={scale(20)} color="white" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.heroLabel, { color: theme.textMuted }]}>Portfolio value</Text>
          <Text style={[styles.heroValue, { color: theme.text }]}>{formatMoney(portfolioTotalValue)}</Text>
          <Text style={[styles.subText, { color: portfolioUnrealizedPL >= 0 ? accent.success : accent.danger }]}>
            {portfolioUnrealizedPL >= 0 ? '+' : ''}
            {formatMoney(portfolioUnrealizedPL)} unrealized
          </Text>
        </View>
      </View>

      {dirtyBtc > 0 && (
        <View style={[styles.dirtyCard, { backgroundColor: theme.surfaceElevated, borderColor: accent.warning }]}>
          <Text style={[styles.dirtyTitle, { color: accent.warning }]}>
            ⚠️ {dirtyBtc.toFixed(4)} ₿ tainted ({formatMoney(dirtyBtcUSD)})
          </Text>
          <Text style={[styles.subText, { color: theme.textMuted }]}>
            Exchanges refuse dirty BTC. Launder it in the Onion app before it can be sold here.
          </Text>
        </View>
      )}

      <View style={[styles.dirtyCard, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
        <Text style={[styles.dirtyTitle, { color: theme.text }]}>
          ⛏️ Next halving in {weeksToHalving} {weeksToHalving === 1 ? 'week' : 'weeks'}
        </Text>
        <Text style={[styles.subText, { color: theme.textMuted }]}>
          BTC supply halves every ~4 years. Historically a bull-regime catalyst.
        </Text>
      </View>

      <View style={styles.statGrid}>
        <StatCard theme={theme} label="Cost basis" value={formatMoney(portfolioCostBasis)} />
        <StatCard
          theme={theme}
          label="Realized YTD"
          value={formatMoney(market.realizedGainsThisYear)}
          negative={market.realizedGainsThisYear < 0}
        />
        <StatCard
          theme={theme}
          label="Lifetime realized"
          value={formatMoney(market.totalRealizedGains)}
          negative={market.totalRealizedGains < 0}
        />
      </View>

      <SectionTitle theme={theme}>Holdings</SectionTitle>
      {cryptos.filter((c) => c.owned > 0).length === 0 ? (
        <EmptyText theme={theme}>You don&apos;t hold any crypto yet.</EmptyText>
      ) : (
        gameState.cryptos
          .filter((c) => c.owned > 0)
          .map((coin) => (
            <CoinRow
              key={coin.id}
              coin={coin}
              market={market.coinMarkets[coin.id]}
              darkMode={darkMode}
              showHoldings
              onPress={() => setOrderCoin(coin)}
            />
          ))
      )}

      <View style={styles.headerRow}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>DCA Schedules</Text>
        <TouchableOpacity
          onPress={() => setShowDCA(true)}
          style={[styles.addBtn, { backgroundColor: accent.info }]}
          accessibilityRole="button"
          accessibilityLabel="Schedule a new DCA crypto purchase"
        >
          <Plus size={scale(14)} color="white" />
          <Text style={styles.addBtnText}>Schedule</Text>
        </TouchableOpacity>
      </View>
      {market.dcaRules.length === 0 ? (
        <EmptyText theme={theme}>
          Schedule recurring buys from a bank account to dollar-cost average into a coin.
        </EmptyText>
      ) : (
        market.dcaRules.map((rule) => (
          <DCARuleRow
            key={rule.id}
            rule={rule}
            currentWeek={gameState.weeksLived}
            darkMode={darkMode}
            onDelete={() => {
              removeCryptoDCA(setGameState, rule.id);
              queueSave();
            }}
          />
        ))
      )}
    </View>
    );
  };

  return (
    <View style={[styles.root, { backgroundColor: theme.background, paddingTop: 0 }]}>
      <View style={[styles.topBar, { borderBottomColor: theme.border }]}>
        <TouchableOpacity
          onPress={onBack}
          hitSlop={10}
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel="Back to apps"
        >
          <ArrowLeft size={scale(22)} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.appTitle, { color: theme.text }]}>Crypto</Text>
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
              style={[styles.tab, active && { borderBottomColor: accent.warning }]}
              accessibilityRole="tab"
              accessibilityLabel={t.label}
              accessibilityState={{ selected: active }}
            >
              <Icon size={scale(16)} color={active ? accent.warning : theme.textMuted} />
              <Text style={[styles.tabText, { color: active ? accent.warning : theme.textMuted }]}>{t.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: responsiveSpacing.md, paddingBottom: getTabBarSafePadding(insets.bottom) }}
      >
        {activeTab === 'trade' && renderTrade()}
        {activeTab === 'mine' && renderMine()}
        {activeTab === 'portfolio' && renderPortfolio()}
      </ScrollView>

      <PlaceOrderModal
        visible={!!orderCoin}
        coin={orderCoin}
        cash={cash}
        darkMode={darkMode}
        onClose={() => setOrderCoin(null)}
        onSubmit={handlePlaceOrder}
      />

      <DCAModal
        visible={showDCA}
        cryptos={gameState.cryptos}
        accounts={banking?.accounts ?? []}
        darkMode={darkMode}
        onClose={() => setShowDCA(false)}
        onSubmit={(input) => {
          addCryptoDCA(setGameState, input);
          queueSave();
          setShowDCA(false);
        }}
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

function StatCard({
  label,
  value,
  theme,
  negative,
}: {
  label: string;
  value: string;
  theme: ReturnType<typeof getThemeColors>;
  negative?: boolean;
}) {
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

export default function BitcoinMiningApp(props: BitcoinMiningAppProps) {
  return (
    <ErrorBoundary>
      <BitcoinMiningAppInner {...props} />
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
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
  },
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
  sectionTitle: {
    fontSize: responsiveFontSize.md,
    fontWeight: '700',
    marginTop: responsiveSpacing.xs,
  },
  subText: {
    fontSize: responsiveFontSize.xs,
    marginTop: 2,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: responsiveSpacing.xs,
  },
  emptyText: {
    fontSize: responsiveFontSize.sm,
    textAlign: 'center',
    paddingVertical: responsiveSpacing.md,
  },
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
  minerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: responsiveSpacing.md,
    borderRadius: responsiveBorderRadius.lg,
    borderWidth: 1,
    gap: responsiveSpacing.sm,
  },
  minerIcon: {
    width: scale(32),
    height: scale(32),
    borderRadius: scale(16),
    alignItems: 'center',
    justifyContent: 'center',
  },
  minerName: { fontSize: responsiveFontSize.md, fontWeight: '700' },
  buyBtn: {
    paddingHorizontal: responsiveSpacing.md,
    paddingVertical: responsiveSpacing.xs,
    borderRadius: responsiveBorderRadius.full,
  },
  buyBtnText: { color: 'white', fontSize: responsiveFontSize.sm, fontWeight: '700' },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: responsiveSpacing.xs,
  },
  chip: {
    paddingHorizontal: responsiveSpacing.md,
    paddingVertical: responsiveSpacing.xs,
    borderRadius: responsiveBorderRadius.full,
    borderWidth: 1,
  },
  chipText: { fontSize: responsiveFontSize.sm, fontWeight: '700' },
  statGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: responsiveSpacing.sm,
  },
  statCard: {
    // Was minWidth: '30%' → forced 3-up, "Lifetime realized" label wrapped to
    // 2 lines and formatMoney values truncated. 46% wraps to 2-per-row.
    flexBasis: '46%',
    flexGrow: 1,
    minWidth: '46%',
    padding: responsiveSpacing.sm,
    borderRadius: responsiveBorderRadius.lg,
    borderWidth: 1,
    gap: 2,
  },
  statLabel: { fontSize: responsiveFontSize.xs, fontWeight: '600' },
  statValue: { fontSize: responsiveFontSize.md, fontWeight: '800' },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: responsiveSpacing.sm,
    paddingVertical: responsiveSpacing.xs,
    borderRadius: responsiveBorderRadius.full,
  },
  addBtnText: { color: 'white', fontSize: responsiveFontSize.xs, fontWeight: '700' },
  dirtyCard: {
    padding: responsiveSpacing.md,
    borderRadius: responsiveBorderRadius.lg,
    borderWidth: 1,
    gap: 4,
  },
  dirtyTitle: { fontSize: responsiveFontSize.sm, fontWeight: '700' },
});
