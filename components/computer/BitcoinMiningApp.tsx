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
import { responsiveFontSize, responsiveSpacing, responsiveBorderRadius, scale, getAppScreenBottomPadding } from '@/utils/scaling';
import { getThemeColors, accent } from '@/lib/config/theme';
import { getGlassCard, getGlassIconContainer, getGlassCategoryTabsContainer } from '@/utils/glassmorphismStyles';
import LinearGradientFallback from '@/components/fallbacks/LinearGradientFallback';
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

const LinearGradient = LinearGradientFallback;

// Identity accent for the Crypto app — amber #F59E0B (rgb 245,158,11).
// Solid (accent.warning === #F59E0B) is reserved for small CTAs / badges /
// glyphs; every larger surface gets a translucent amber tint (Slate Glass).
const amber = {
  solid: accent.warning,               // #F59E0B — small CTAs / badges / glyphs
  wash: 'rgba(245,158,11,0.14)',       // hero tint wash (renders flat)
  washFade: 'rgba(245,158,11,0.03)',   // trailing stop (future-proofing)
  blob: 'rgba(245,158,11,0.10)',       // hero glow blob
  bubble: 'rgba(245,158,11,0.15)',     // Recipe C icon-bubble fill
  rim: 'rgba(245,158,11,0.30)',        // Recipe C rim / chip rim / cash-chip rim
  chip: 'rgba(245,158,11,0.16)',       // active tab / selected chip / buy chip
  chipSoft: 'rgba(245,158,11,0.14)',   // section add-chip / cash-chip fill
} as const;

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
    <View style={{ gap: responsiveSpacing.lg }}>
      {/* Trade's mandated color moment is the EconomyEventBanner + RegimeBanner,
          so this tab intentionally carries NO Recipe B hero (one focal accent). */}
      <EconomyEventBanner context="crypto" />
      {selectedCoinMarket && (
        <RegimeBanner
          regime={selectedCoinMarket.regime}
          weeksRemaining={selectedCoinMarket.regimeWeeksRemaining}
          darkMode={darkMode}
        />
      )}

      <View style={{ gap: responsiveSpacing.sm }}>
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
      </View>

      <View style={{ gap: responsiveSpacing.sm }}>
        <View style={styles.headerRow}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Open Orders</Text>
          <Text style={[styles.subText, { color: theme.textMuted }]}>
            {(market.openOrders ?? []).length} active
          </Text>
        </View>
        {(market.openOrders ?? []).length === 0 ? (
          <EmptyText theme={theme} darkMode={darkMode}>
            No open orders. Tap a coin above to place a market, limit, or stop order.
          </EmptyText>
        ) : (
          (market.openOrders ?? []).map((o) => (
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
      </View>

      <View style={{ gap: responsiveSpacing.sm }}>
        <SectionTitle theme={theme}>Recent Fills</SectionTitle>
        {(market.orderHistory ?? []).length === 0 ? (
          <EmptyText theme={theme} darkMode={darkMode}>No fills yet.</EmptyText>
        ) : (
          (market.orderHistory ?? []).slice(0, 5).map((o) => (
            <OrderRow key={o.id} order={o} darkMode={darkMode} />
          ))
        )}
      </View>
    </View>
  );

  const renderMine = () => (
    <View style={{ gap: responsiveSpacing.lg }}>
      {/* Recipe B hero — the mining-rig headline (ONE focal amber surface). */}
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
          <LinearGradient
            pointerEvents="none"
            colors={[amber.wash, amber.washFade]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <View pointerEvents="none" style={styles.heroBlob} />
          {darkMode && <View pointerEvents="none" style={styles.heroHairline} />}
          <View style={styles.heroContent}>
            <View
              style={[
                getGlassIconContainer(darkMode, 44),
                { backgroundColor: amber.bubble, borderWidth: 1, borderColor: amber.rim },
              ]}
            >
              <Cpu size={scale(22)} color={amber.solid} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.heroEyebrow, { color: theme.textMuted }]}>WEEKLY MINING YIELD</Text>
              <Text style={[styles.heroValue, { color: theme.text }]}>{formatMoney(estimatedWeeklyMiningEarnings)}</Text>
              <Text style={[styles.heroSub, { color: theme.textMuted }]}>
                {totalMiners} miner{totalMiners === 1 ? '' : 's'} active · {(gameState.warehouse?.selectedCrypto ?? 'btc').toUpperCase()}
              </Text>
            </View>
          </View>
        </View>
      </View>

      <View style={{ gap: responsiveSpacing.sm }}>
        <SectionTitle theme={theme}>Buy Miners</SectionTitle>
        {MINER_TIERS.map((tier) => {
          const owned = ownedMiners[tier.id] ?? 0;
          const price = MINER_PRICES[tier.id];
          const canAfford = cash >= price;
          return (
            <View
              key={tier.id}
              style={[getGlassCard(darkMode, 6), styles.minerRow, { backgroundColor: theme.surface, borderColor: theme.border }]}
            >
              <View
                style={[
                  getGlassIconContainer(darkMode, 36),
                  { backgroundColor: amber.bubble, borderWidth: 1, borderColor: amber.rim },
                ]}
              >
                <Bitcoin size={scale(18)} color={amber.solid} />
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
                  { backgroundColor: canAfford ? amber.chip : theme.surfaceElevated },
                ]}
                accessibilityRole="button"
                accessibilityLabel={`Buy ${tier.label} miner for ${formatMoney(price)}`}
                accessibilityState={{ disabled: !canAfford }}
              >
                <Text style={[styles.buyBtnText, { color: canAfford ? amber.solid : theme.textMuted }]}>
                  {formatMoney(price)}
                </Text>
              </TouchableOpacity>
            </View>
          );
        })}
      </View>

      <View style={{ gap: responsiveSpacing.sm }}>
        <SectionTitle theme={theme}>Selected Coin</SectionTitle>
        <View style={styles.chipRow}>
          {cryptos.map((c) => {
            const selected = gameState.warehouse?.selectedCrypto === c.id;
            return (
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
                accessibilityState={{ selected }}
                style={[
                  styles.chip,
                  selected
                    ? { backgroundColor: amber.chip, borderColor: amber.rim }
                    : { backgroundColor: theme.surfaceElevated, borderColor: theme.border },
                ]}
              >
                <Text style={[styles.chipText, { color: selected ? amber.solid : theme.textSecondary }]}>
                  {c.symbol}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
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
    <View style={{ gap: responsiveSpacing.lg }}>
      {/* Recipe B hero — the BTC / portfolio balance headline (ONE focal amber). */}
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
          <LinearGradient
            pointerEvents="none"
            colors={[amber.wash, amber.washFade]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <View pointerEvents="none" style={styles.heroBlob} />
          {darkMode && <View pointerEvents="none" style={styles.heroHairline} />}
          <View style={styles.heroContent}>
            <View
              style={[
                getGlassIconContainer(darkMode, 44),
                { backgroundColor: amber.bubble, borderWidth: 1, borderColor: amber.rim },
              ]}
            >
              <Briefcase size={scale(22)} color={amber.solid} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.heroEyebrow, { color: theme.textMuted }]}>PORTFOLIO VALUE</Text>
              <Text style={[styles.heroValue, { color: theme.text }]}>{formatMoney(portfolioTotalValue)}</Text>
              <Text style={[styles.heroSub, { color: portfolioUnrealizedPL >= 0 ? accent.success : accent.danger }]}>
                {portfolioUnrealizedPL >= 0 ? '+' : ''}
                {formatMoney(portfolioUnrealizedPL)} unrealized
              </Text>
            </View>
          </View>
        </View>
      </View>

      {dirtyBtc > 0 && (
        <View style={[getGlassCard(darkMode, 6), styles.noticeCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={styles.noticeInner}>
            {/* thin amber caution stripe (≤4px accent — never a loud fill) */}
            <View pointerEvents="none" style={[styles.noticeStripe, { backgroundColor: amber.solid }]} />
            <View style={styles.noticeBody}>
              <Text style={[styles.dirtyTitle, { color: amber.solid }]}>
                ⚠️ {dirtyBtc.toFixed(4)} ₿ tainted ({formatMoney(dirtyBtcUSD)})
              </Text>
              <Text style={[styles.subText, { color: theme.textMuted }]}>
                Exchanges refuse dirty BTC. Launder it in the Onion app before it can be sold here.
              </Text>
            </View>
          </View>
        </View>
      )}

      <View style={[getGlassCard(darkMode, 6), styles.noticeCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <View style={styles.noticeBody}>
          <Text style={[styles.dirtyTitle, { color: theme.text }]}>
            ⛏️ Next halving in {weeksToHalving} {weeksToHalving === 1 ? 'week' : 'weeks'}
          </Text>
          <Text style={[styles.subText, { color: theme.textMuted }]}>
            BTC supply halves every ~4 years. Historically a bull-regime catalyst.
          </Text>
        </View>
      </View>

      <View style={styles.statGrid}>
        <StatCard theme={theme} darkMode={darkMode} label="Cost basis" value={formatMoney(portfolioCostBasis)} />
        <StatCard
          theme={theme}
          darkMode={darkMode}
          label="Realized YTD"
          value={formatMoney(market.realizedGainsThisYear)}
          negative={market.realizedGainsThisYear < 0}
        />
        <StatCard
          theme={theme}
          darkMode={darkMode}
          label="Lifetime realized"
          value={formatMoney(market.totalRealizedGains)}
          negative={market.totalRealizedGains < 0}
        />
      </View>

      <View style={{ gap: responsiveSpacing.sm }}>
        <SectionTitle theme={theme}>Holdings</SectionTitle>
        {cryptos.filter((c) => c.owned > 0).length === 0 ? (
          <EmptyText theme={theme} darkMode={darkMode}>You don&apos;t hold any crypto yet.</EmptyText>
        ) : (
          cryptos
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
      </View>

      <View style={{ gap: responsiveSpacing.sm }}>
        <View style={styles.headerRow}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>DCA Schedules</Text>
          <TouchableOpacity
            onPress={() => setShowDCA(true)}
            style={styles.addChip}
            accessibilityRole="button"
            accessibilityLabel="Schedule a new DCA crypto purchase"
          >
            <Plus size={scale(12)} color={amber.solid} />
            <Text style={styles.addChipText}>Schedule</Text>
          </TouchableOpacity>
        </View>
        {(market.dcaRules ?? []).length === 0 ? (
          <EmptyText theme={theme} darkMode={darkMode}>
            Schedule recurring buys from a bank account to dollar-cost average into a coin.
          </EmptyText>
        ) : (
          (market.dcaRules ?? []).map((rule) => (
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
    </View>
    );
  };

  return (
    <View style={[styles.root, { backgroundColor: theme.background, paddingTop: 0 }]}>
      <View style={styles.topBar}>
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
        <View style={[styles.cashChip, { backgroundColor: amber.chipSoft, borderColor: amber.rim }]}>
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
              style={[styles.tab, active && { backgroundColor: amber.chip }]}
              accessibilityRole="tab"
              accessibilityLabel={t.label}
              accessibilityState={{ selected: active }}
            >
              <Icon size={scale(16)} color={active ? amber.solid : theme.textMuted} />
              <Text style={[styles.tabText, { color: active ? amber.solid : theme.textMuted }]}>{t.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: responsiveSpacing.md, paddingBottom: getAppScreenBottomPadding(insets.bottom) }}
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

function EmptyText({ theme, darkMode, children }: { theme: ReturnType<typeof getThemeColors>; darkMode: boolean; children: React.ReactNode }) {
  // Give empty sections a card so they share the same rhythm as populated rows
  // instead of floating as bare text between elevated cards.
  return (
    <View style={[getGlassCard(darkMode, 6), styles.emptyCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <Text style={[styles.emptyText, { color: theme.textSecondary }]}>{children}</Text>
    </View>
  );
}

function StatCard({
  label,
  value,
  theme,
  darkMode,
  negative,
}: {
  label: string;
  value: string;
  theme: ReturnType<typeof getThemeColors>;
  darkMode: boolean;
  negative?: boolean;
}) {
  return (
    <View style={[getGlassCard(darkMode, 6), styles.statCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
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
  // Top bar drops its bottom border — the glass tab strip below anchors the
  // screen (Slate Glass §6).
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: responsiveSpacing.md,
    paddingVertical: responsiveSpacing.sm,
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
  cashChipText: { fontSize: responsiveFontSize.sm, fontWeight: '700', fontVariant: ['tabular-nums'] },
  // Segmented control (getGlassCategoryTabsContainer applied inline) sits
  // directly under the top bar and anchors the screen.
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
  sectionTitle: {
    fontSize: responsiveFontSize.md,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  subText: {
    fontSize: responsiveFontSize.xs,
    marginTop: 2,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  emptyText: {
    fontSize: responsiveFontSize.sm,
    textAlign: 'center',
    opacity: 0.6,
  },
  emptyCard: {
    borderRadius: responsiveBorderRadius.xl,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: responsiveSpacing.md,
    paddingHorizontal: responsiveSpacing.md,
  },
  // Recipe B hero anatomy: outer View carries shadow + radius + solid fill +
  // border (no clip); heroInner clips the tint wash / glow blob to the radius.
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
    backgroundColor: amber.blob,
  },
  heroHairline: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  heroContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: responsiveSpacing.md,
  },
  heroEyebrow: {
    fontSize: responsiveFontSize.xs,
    fontWeight: '600',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  heroValue: { fontSize: responsiveFontSize['3xl'], fontWeight: '800', fontVariant: ['tabular-nums'] },
  heroSub: { fontSize: responsiveFontSize.xs, marginTop: 2, fontVariant: ['tabular-nums'] },
  minerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: responsiveSpacing.md,
    borderRadius: responsiveBorderRadius.xl,
    borderWidth: 1,
    gap: responsiveSpacing.sm,
  },
  minerName: { fontSize: responsiveFontSize.md, fontWeight: '700' },
  buyBtn: {
    paddingHorizontal: responsiveSpacing.md,
    paddingVertical: responsiveSpacing.xs,
    borderRadius: responsiveBorderRadius.full,
  },
  buyBtnText: { fontSize: responsiveFontSize.sm, fontWeight: '700', fontVariant: ['tabular-nums'] },
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
    padding: responsiveSpacing.md,
    borderRadius: responsiveBorderRadius.xl,
    borderWidth: 1,
    gap: 2,
  },
  statLabel: { fontSize: responsiveFontSize.xs, fontWeight: '600' },
  statValue: { fontSize: responsiveFontSize.md, fontWeight: '800', fontVariant: ['tabular-nums'] },
  // Quiet tinted section add-chip (amber fill, amber label, no border) so the
  // screen keeps at most one loud CTA (Slate Glass §6).
  addChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: responsiveSpacing.sm,
    paddingVertical: responsiveSpacing.xs,
    borderRadius: responsiveBorderRadius.full,
    backgroundColor: amber.chipSoft,
  },
  addChipText: { color: amber.solid, fontSize: responsiveFontSize.xs, fontWeight: '700' },
  // Notice cards (tainted BTC / halving) — Recipe A. Outer carries shadow +
  // radius + fill + border; noticeInner clips the caution stripe to the radius.
  noticeCard: {
    borderRadius: responsiveBorderRadius.xl,
    borderWidth: 1,
  },
  noticeInner: {
    flexDirection: 'row',
    alignItems: 'stretch',
    borderRadius: responsiveBorderRadius.xl,
    overflow: 'hidden',
  },
  noticeStripe: { width: scale(4) },
  noticeBody: {
    flex: 1,
    padding: responsiveSpacing.md,
    gap: 4,
  },
  dirtyTitle: { fontSize: responsiveFontSize.sm, fontWeight: '700', fontVariant: ['tabular-nums'] },
});
