/**
 * BitcoinMiningApp - desktop crypto trading + mining dashboard.
 *
 * Mining-dashboard DNA (Slate Glass tokens intact):
 *   - Trade: market regime banner + per-coin sparkline rows + a coin DETAIL page
 *     (big SVG price-history line, spread, cost basis) that opens the place-order
 *     modal (market / limit / stop), open-order book, fill history.
 *   - Mine: a rig console hero with a HASHRATE gauge ring (react-native-svg
 *     ProgressRing, fill = fleet health), a mining-target picker, and rig
 *     HARDWARE cards with status-LED dots + durability bars that open a rig
 *     DETAIL page (per-model hashrate/repair-cost/durability + buy).
 *   - Portfolio: a WALLET hero (portfolio value + BTC balance + BTC price
 *     sparkline), tainted-BTC + halving notices, realized/basis stat grid,
 *     holdings rows (→ coin detail), DCA schedules.
 *
 * Price evolution + order matching + DCA execution happen in lib/crypto/weeklyTick.ts
 * (called from GameActionsContext.nextWeek). This file is just the view layer
 * dispatching CryptoTradingActions; no business logic / economy changes live here.
 * Hashrate figures are fixed per-model hardware specs (presentation only).
 */

import React, { useState, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, LayoutChangeEvent } from 'react-native';
import Svg, { Polyline, Path } from 'react-native-svg';
import {
  TrendingUp,
  TrendingDown,
  Hammer,
  Briefcase,
  Plus,
  Minus,
  Cpu,
  Bitcoin,
  Zap,
  Activity,
  AlertTriangle,
  Wrench,
  ChevronRight,
  Wallet,
  Rocket,
  Coins,
  Gauge,
} from 'lucide-react-native';
import { useGame } from '@/contexts/GameContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ErrorBoundary from '@/components/ErrorBoundary';
import { Crypto, CryptoOrderSide, CryptoOrderType } from '@/contexts/game/types';
import { responsiveFontSize, responsiveSpacing, responsiveBorderRadius, scale, getAppScreenBottomPadding, touchTargets } from '@/utils/scaling';
import { getThemeColors, accent, withAlpha } from '@/lib/config/theme';
import { getGlassCard, getGlassIconContainer, getPlatformShadows } from '@/utils/glassmorphismStyles';
import AppHeader, { CashChip } from '@/components/ui/AppHeader';
import Chip from '@/components/ui/Chip';
import KeyValueRow from '@/components/ui/KeyValueRow';
import ProgressBar from '@/components/ui/ProgressBar';
import SectionTitle from '@/components/ui/SectionTitle';
import SegmentedControl from '@/components/ui/SegmentedControl';
import StatStrip from '@/components/ui/StatStrip';
import ProgressRing from '@/components/ui/ProgressRing';
import { initialGameState } from '@/contexts/game/initialState';
import { MINER_PRICES } from '@/lib/economy/constants';
import { MINER_REPAIR_COSTS } from '@/contexts/game/actions/weekly/applyMiningWarehouse';
import { applyMoneyDelta } from '@/contexts/game/actions/MoneyActions';
import { estimateWeeklyMining, MINING_USD_CAP } from '@/lib/crypto/estimateWeeklyMining';
import {
  repairRig,
  setAutoRepair,
  buyMinerUpgrade,
  joinMiningPool,
  leaveMiningPool,
  stakeCrypto,
  claimStakingRewards,
  upgradeEnergySystem,
  upgradeAutomation,
  MINER_UPGRADE_DEFINITIONS,
  MINING_POOLS,
  ENERGY_TYPES,
} from '@/contexts/game/actions/MiningActions';
import { getInflatedPrice } from '@/lib/economy/inflation';
import { sellMiner } from '@/contexts/game/company';

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

import { formatMoneyCompact } from '@/utils/moneyFormatting';
import { gameAlert } from '@/utils/gameAlert';
import { EmptyCard as EmptyText } from '@/components/ui/EmptyState';

/**
 * The app's ONE identity tint, from the shared palette.
 *
 * This used to be a private seven-value object of hand-typed rgba literals -
 * one accent expressed at seven opacities that nothing else in the app could
 * match. `withAlpha(AMBER, x)` says the same thing once, against the same hex
 * every other converted app tints from.
 */
const AMBER = accent.amber;

interface BitcoinMiningAppProps {
  onBack: () => void;
}

type Tab = 'trade' | 'mine' | 'upgrades' | 'portfolio';
// Presentational sub-views (list -> detail) over EXISTING data. No new mechanics.
type SubView =
  | { kind: 'rig'; tierId: string }
  | { kind: 'coin'; coinId: string }
  | null;

const TABS: { id: Tab; label: string; icon: React.ComponentType<{ size?: number; color?: string }> }[] = [
  { id: 'trade', label: 'Trade', icon: TrendingUp },
  { id: 'mine', label: 'Mine', icon: Hammer },
  { id: 'upgrades', label: 'Upgrades', icon: Rocket },
  { id: 'portfolio', label: 'Portfolio', icon: Briefcase },
];

// Weekly staking reward rates by lock period - mirror stakeCrypto in MiningActions
// so the APY readout matches what the action actually stamps on a position.
const STAKING_RATES: Record<number, number> = { 1: 0.001, 2: 0.0015, 3: 0.002, 4: 0.0025 };

// Values mirror warehouseMinerEarnings in lib/economy/passiveIncome.ts so the
// "estimated weekly yield" is accurate - and all 8 economy tiers are buyable
// (the top 3 were defined in the economy but missing from this UI).
// `hashrate` (TH/s) is a fixed per-model hardware spec used only for display
// (a mining rig's headline number) - it is NOT game state and drives nothing.
const MINER_TIERS: { id: string; label: string; weeklyEarnings: number; hashrate: number }[] = [
  { id: 'basic',      label: 'Basic Miner',      weeklyEarnings: 22,     hashrate: 95 },
  { id: 'advanced',   label: 'Advanced Miner',   weeklyEarnings: 105,    hashrate: 420 },
  { id: 'pro',        label: 'Pro Miner',        weeklyEarnings: 438,    hashrate: 1750 },
  { id: 'industrial', label: 'Industrial Miner', weeklyEarnings: 1575,   hashrate: 6300 },
  { id: 'quantum',    label: 'Quantum Miner',    weeklyEarnings: 7000,   hashrate: 28000 },
  { id: 'mega',       label: 'Mega Miner',       weeklyEarnings: 35000,  hashrate: 140000 },
  { id: 'giga',       label: 'Giga Miner',       weeklyEarnings: 140000, hashrate: 560000 },
  { id: 'tera',       label: 'Tera Miner',       weeklyEarnings: 700000, hashrate: 2800000 },
];

function formatPrice(n: number): string {
  if (!isFinite(n) || n <= 0) return '-';
  if (n >= 1000) return `$${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
  if (n >= 1) return `$${n.toFixed(2)}`;
  return `$${n.toFixed(4)}`;
}

function formatCoin(n: number): string {
  if (!isFinite(n)) return '0';
  if (n >= 1000) return n.toLocaleString('en-US', { maximumFractionDigits: 2 });
  if (n >= 1) return n.toFixed(3);
  return n.toFixed(6);
}

function formatHashrate(th: number): string {
  if (!isFinite(th) || th <= 0) return '0 TH/s';
  if (th >= 1_000_000) return `${(th / 1_000_000).toFixed(2)} EH/s`;
  if (th >= 1_000) return `${(th / 1_000).toFixed(th >= 100_000 ? 0 : 1)} PH/s`;
  return `${Math.round(th)} TH/s`;
}

// Durability -> rig status band (drives the LED colour + label).
function healthBand(h: number): { color: string; label: string } {
  if (h >= 70) return { color: accent.success, label: 'Online' };
  if (h >= 40) return { color: accent.warning, label: 'Degrading' };
  return { color: accent.danger, label: 'Needs repair' };
}

function BitcoinMiningAppInner({ onBack }: BitcoinMiningAppProps) {
  const { gameState, setGameState, saveGame } = useGame();
  const insets = useSafeAreaInsets();
  const darkMode = !!gameState.settings?.darkMode;
  const theme = getThemeColors(darkMode);
  const market = gameState.cryptoMarket ?? initialGameState.cryptoMarket!;
  const banking = gameState.banking ?? initialGameState.banking;

  const [activeTab, setActiveTab] = useState<Tab>('trade');
  const [subView, setSubView] = useState<SubView>(null);
  const [selectedCoinId, setSelectedCoinId] = useState<string>('btc');
  const [orderCoin, setOrderCoin] = useState<Crypto | null>(null);
  const [showDCA, setShowDCA] = useState(false);
  // Upgrades tab local selection state (which rig tier to upgrade; staking picker).
  const [upgradeTierId, setUpgradeTierId] = useState<string>('basic');
  const [stakeCoinId, setStakeCoinId] = useState<string>('btc');
  const [stakeLockWeeks, setStakeLockWeeks] = useState<number>(1);

  const cash = gameState.stats?.money ?? 0;
  // Old/migrated saves can lack the cryptos array - guard every read.
  const cryptos = gameState.cryptos ?? [];
  const selectedCoinMarket = market.coinMarkets[selectedCoinId];
  // Inflation index - the enhanced-mining actions charge getInflatedPrice(cost),
  // so the Upgrades tab reads the same index to show/gate against the real price.
  const priceIndex =
    typeof gameState.economy?.priceIndex === 'number' && isFinite(gameState.economy.priceIndex) && gameState.economy.priceIndex > 0
      ? gameState.economy.priceIndex
      : 1;

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
  const minerDurability = gameState.warehouse?.minerDurability ?? {};
  const difficultyMultiplier = gameState.warehouse?.difficultyMultiplier ?? 1;
  const totalMiners = useMemo(
    () => Object.values(ownedMiners).reduce((sum, n) => sum + (n || 0), 0),
    [ownedMiners]
  );
  const totalHashrate = useMemo(() => {
    let total = 0;
    for (const tier of MINER_TIERS) {
      total += (ownedMiners[tier.id] ?? 0) * tier.hashrate;
    }
    return total;
  }, [ownedMiners]);
  // Fleet health = count-weighted average of owned miners' durability
  // (durability defaults to 100 for owned-but-not-yet-degraded miners).
  const fleetHealth = useMemo(() => {
    let units = 0;
    let sum = 0;
    for (const tier of MINER_TIERS) {
      const count = ownedMiners[tier.id] ?? 0;
      if (count > 0) {
        const dur = minerDurability[tier.id] ?? 100;
        sum += dur * count;
        units += count;
      }
    }
    return units > 0 ? sum / units : 0;
  }, [ownedMiners, minerDurability]);
  const fleetBand = healthBand(fleetHealth);

  // Mining target (the crypto warehouse miners mint) + its live market.
  const mineTargetId = gameState.warehouse?.selectedCrypto ?? 'btc';
  const mineTargetCoin = cryptos.find((c) => c.id === mineTargetId);
  const mineTargetMarket = market.coinMarkets[mineTargetId];

  // --- Honest per-coin mining estimate (shared estimator) ------------------
  // The old static $/wk assumed BTC at difficulty 1.0, so mining XRP showed the
  // same figure as BTC. `estimateWeeklyMining` is the single source of truth the
  // tick also uses, so switching the mining target / crossing a halving visibly
  // changes the projection (per-coin multiplier × 0.5^halving × price − electricity,
  // capped at $100K/wk).
  const halvingCount = market.halvingCount ?? 0;
  const warehouseForEstimate = gameState.warehouse;
  const mineEstimate = useMemo(
    () => estimateWeeklyMining(warehouseForEstimate, cryptos, mineTargetId, halvingCount),
    [warehouseForEstimate, gameState.cryptos, mineTargetId, halvingCount]
  );
  // Gross USD/wk the fleet would earn if it mined BTC instead - powers the
  // "vs BTC" hint so the player can see how much yield the target coin trades away.
  const btcEstimateUsd = useMemo(
    () => estimateWeeklyMining(warehouseForEstimate, cryptos, 'btc', halvingCount).usdPerWeek,
    [warehouseForEstimate, gameState.cryptos, halvingCount]
  );
  const vsBtcPct =
    mineTargetId !== 'btc' && btcEstimateUsd > 0
      ? Math.round((mineEstimate.usdPerWeek / btcEstimateUsd) * 100)
      : null;
  // Per-1-unit gross USD/wk for the SELECTED coin (rig cards). Linear in count
  // below the $100K cap, so it honestly reflects difficulty + halving + coin price.
  const perUnitYield = useCallback(
    (tierId: string): number => {
      const base = warehouseForEstimate ?? { level: 1, miners: {} };
      const synthetic = { ...base, miners: { [tierId]: 1 }, selectedCrypto: mineTargetId };
      return estimateWeeklyMining(synthetic, cryptos, mineTargetId, halvingCount).usdPerWeek;
    },
    [warehouseForEstimate, gameState.cryptos, mineTargetId, halvingCount]
  );
  // Actual-fleet gross USD/wk for one tier (rig detail) - applies the $100K cap.
  const fleetYieldForTier = useCallback(
    (tierId: string, count: number): number => {
      if (count <= 0) return 0;
      const base = warehouseForEstimate ?? { level: 1, miners: {} };
      const synthetic = { ...base, miners: { [tierId]: count }, selectedCrypto: mineTargetId };
      return estimateWeeklyMining(synthetic, cryptos, mineTargetId, halvingCount).usdPerWeek;
    },
    [warehouseForEstimate, gameState.cryptos, mineTargetId, halvingCount]
  );
  // Fleet gross output hard-caps at $100K/wk. Past the cap another rig adds cash
  // drain (price + electricity) but ZERO extra yield, so Buy must be disabled and
  // the marginal yield shown honestly (≈$0), not the uncapped per-unit figure.
  const fleetAtCap = mineEstimate.grossUsd >= MINING_USD_CAP;
  // Honest marginal USD/wk of adding ONE more of a tier to the CURRENT fleet -
  // below the cap this equals the linear per-unit yield; at the cap it collapses
  // to ~0 because the whole-fleet gross is already clamped.
  const marginalYield = useCallback(
    (tierId: string): number => {
      const base = warehouseForEstimate ?? { level: 1, miners: {} };
      const current = (base.miners as Record<string, number> | undefined)?.[tierId] ?? 0;
      const synthetic = {
        ...base,
        miners: { ...(base.miners ?? {}), [tierId]: current + 1 },
        selectedCrypto: mineTargetId,
      };
      const after = estimateWeeklyMining(synthetic, cryptos, mineTargetId, halvingCount).usdPerWeek;
      return Math.max(0, after - mineEstimate.usdPerWeek);
    },
    [warehouseForEstimate, gameState.cryptos, mineTargetId, halvingCount, mineEstimate.usdPerWeek]
  );

  // --- Handlers ------------------------------------------------------------
  const handleBack = () => {
    // Sub-views (rig / coin detail) pop back to their tab first; only the
    // top-level state exits the app. Back button renders on EVERY screen state.
    if (subView) {
      setSubView(null);
      return;
    }
    onBack();
  };

  const openCoin = (coinId: string) => {
    setSelectedCoinId(coinId);
    setSubView({ kind: 'coin', coinId });
  };

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
      gameAlert('Insufficient funds', `Need ${formatMoneyCompact(price)} to buy this miner.`);
      return;
    }
    setGameState((prev) => {
      // Atomic gate: re-check affordability against prev. The old
      // Math.max(0, money - price) clamp let a same-batch double-tap grant a
      // second miner while only clamping money to 0 - a discounted-to-free
      // income asset.
      if ((prev.stats?.money ?? 0) < price) return prev;
      const w = prev.warehouse ?? {
        level: 1,
        miners: {},
        selectedCrypto: 'btc',
      };
      const miners = { ...(w.miners ?? {}) };
      miners[tierId] = (miners[tierId] ?? 0) + 1;
      // Canonical debit (same guards the trading side uses - see
      // CryptoTradingActions applyMoneyDelta note).
      const minerPatch = applyMoneyDelta(prev, -price, 'Buy miner');
      if (!minerPatch) return prev;
      return {
        ...prev,
        ...minerPatch,
        warehouse: { ...w, miners },
      };
    });
    queueSave();
  };

  // PLAYER REPORT (BBQ, 2026-08-21): "Crypto: unable to remove/sell purchased
  // mines." The action layer had `sellMiner` all along - no screen ever called
  // it, so a rig could only ever be bought. Sell at half the CURRENT catalog
  // price (the same number the Buy button shows), confirmed before it fires.
  const handleSellMiner = (tierId: string, label: string) => {
    const price = MINER_PRICES[tierId];
    if (price == null) return;
    const owned = gameState.warehouse?.miners?.[tierId] ?? 0;
    if (owned <= 0) {
      gameAlert('Nothing to sell', `You don't own a ${label}.`);
      return;
    }
    const proceeds = Math.floor(price * 0.5);
    gameAlert('Sell rig', `Sell one ${label} for ${formatMoneyCompact(proceeds)}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sell',
        style: 'destructive',
        onPress: () => {
          const res = sellMiner(gameState, setGameState, tierId, label, price);
          gameAlert(res.success ? 'Rig sold' : 'Cannot sell', res.message ?? '');
          if (res.success) queueSave();
        },
      },
    ]);
  };

  const handleSelectMineTarget = (coinId: string) => {
    setGameState((prev) => ({
      ...prev,
      warehouse: prev.warehouse
        ? { ...prev.warehouse, selectedCrypto: coinId }
        : { level: 1, miners: {}, selectedCrypto: coinId },
    }));
    queueSave();
  };

  // Manual repair - restores one rig tier to 100% and debits the displayed USD
  // cost. The action re-checks affordability atomically (double-tap safe).
  const handleRepairRig = (tierId: string) => {
    const res = repairRig(gameState, setGameState, tierId);
    if (!res.success) {
      if (res.message) gameAlert('Repair', res.message);
      return;
    }
    queueSave();
  };

  // Auto-repair toggle - arms the already-implemented tick that repairs sub-50%
  // rigs each week, paid from the chosen crypto. Enabling needs a funding coin
  // (defaults to the current mining target).
  const autoRepairEnabled = !!gameState.warehouse?.autoRepairEnabled;
  const autoRepairCryptoId = gameState.warehouse?.autoRepairCryptoId ?? mineTargetId;

  // What auto-repair will actually do on the next tick, mirroring
  // `applyMiningWarehouse`: only rigs under 50%, paid cheapest-first out of the
  // funding coin's USD worth.
  const autoRepairStatus = React.useMemo(() => {
    const eligible = MINER_TIERS.filter(
      (t) => (ownedMiners[t.id] ?? 0) > 0 && (minerDurability[t.id] ?? 100) < 50,
    );
    const coin = cryptos.find((c) => c.id === autoRepairCryptoId);
    const owned = coin && isFinite(coin.owned) && coin.owned > 0 ? coin.owned : 0;
    const price = coin && isFinite(coin.price) && coin.price > 0 ? coin.price : 0;
    const budgetUsd = owned * price;

    if (eligible.length === 0) {
      return {
        ok: true,
        message: `Nothing to repair - no rig is under 50% health yet. Fleet is at ${fleetHealth}%.`,
      };
    }
    const bill = eligible.reduce((sum, t) => {
      const dur = minerDurability[t.id] ?? 100;
      return sum + (MINER_REPAIR_COSTS[t.id] || 0) * ((100 - dur) / 100) * (ownedMiners[t.id] ?? 0);
    }, 0);

    if (budgetUsd <= 0) {
      return {
        ok: false,
        message: `${eligible.length} rig${eligible.length > 1 ? 's' : ''} need repair (~$${Math.round(bill).toLocaleString()}), but you hold no ${autoRepairCryptoId.toUpperCase()} to pay with.`,
      };
    }
    if (budgetUsd < bill) {
      return {
        ok: false,
        message: `${eligible.length} rig${eligible.length > 1 ? 's' : ''} need ~$${Math.round(bill).toLocaleString()}; your ${autoRepairCryptoId.toUpperCase()} covers $${Math.round(budgetUsd).toLocaleString()}, so they will be partly repaired.`,
      };
    }
    return {
      ok: true,
      message: `${eligible.length} rig${eligible.length > 1 ? 's' : ''} will be fully repaired next week for ~$${Math.round(bill).toLocaleString()} in ${autoRepairCryptoId.toUpperCase()}.`,
    };
  }, [ownedMiners, minerDurability, cryptos, autoRepairCryptoId, fleetHealth]);
  const handleToggleAutoRepair = () => {
    const res = setAutoRepair(gameState, setGameState, {
      enabled: !autoRepairEnabled,
      cryptoId: autoRepairCryptoId,
    });
    if (!res.success) {
      if (res.message) gameAlert('Auto-repair', res.message);
      return;
    }
    queueSave();
  };
  const handleSelectAutoRepairCrypto = (coinId: string) => {
    const res = setAutoRepair(gameState, setGameState, { enabled: true, cryptoId: coinId });
    if (!res.success) {
      if (res.message) gameAlert('Auto-repair', res.message);
      return;
    }
    queueSave();
  };

  // --- Upgrades tab handlers (enhanced mining progression) -----------------
  // Each round-trips a real MiningActions call (atomic, double-tap-safe) then
  // defers a save (queueSave). Honest disabled states are enforced in the render.
  const handleBuyMinerUpgrade = (upgradeId: string, minerId: string) => {
    const res = buyMinerUpgrade(gameState, setGameState, upgradeId, minerId);
    if (!res.success) {
      if (res.message) gameAlert('Miner upgrade', res.message);
      return;
    }
    queueSave();
  };
  const handleJoinPool = (poolId: string) => {
    const res = joinMiningPool(gameState, setGameState, poolId);
    if (!res.success) {
      if (res.message) gameAlert('Mining pool', res.message);
      return;
    }
    queueSave();
  };
  const handleLeavePool = () => {
    const res = leaveMiningPool(gameState, setGameState);
    if (!res.success) {
      if (res.message) gameAlert('Mining pool', res.message);
      return;
    }
    queueSave();
  };
  // Takes the coin id from the caller: the Staking panel renders (and labels
  // the buttons with) `effectiveStakeCoinId` - which falls back to the first
  // coin the player actually owns - so staking must use that same id. Reading
  // the raw `stakeCoinId` state here staked its 'btc' default even when the
  // panel showed a different coin, failing with "Invalid stake amount" for
  // players who hold no BTC.
  const handleStake = (fraction: number, coinId: string) => {
    const coin = cryptos.find((c) => c.id === coinId);
    const owned = coin?.owned ?? 0;
    // Round to avoid a float overshoot ever exceeding `owned` (stakeCrypto rejects
    // amount > owned). 100% stakes the full balance; lower fractions a slice of it.
    const amount = fraction >= 1 ? owned : Math.min(owned, owned * fraction);
    const res = stakeCrypto(gameState, setGameState, coinId, amount, stakeLockWeeks);
    if (!res.success) {
      if (res.message) gameAlert('Staking', res.message);
      return;
    }
    queueSave();
  };
  const handleClaimStaking = () => {
    const res = claimStakingRewards(gameState, setGameState);
    if (res.message) gameAlert('Staking', res.message);
    if (res.success) queueSave();
  };
  const handleUpgradeEnergy = (energyType: 'solar' | 'wind' | 'hybrid') => {
    const res = upgradeEnergySystem(gameState, setGameState, energyType);
    if (!res.success) {
      if (res.message) gameAlert('Energy system', res.message);
      return;
    }
    queueSave();
  };
  const handleUpgradeAutomation = () => {
    const res = upgradeAutomation(gameState, setGameState);
    if (!res.success) {
      if (res.message) gameAlert('Automation', res.message);
      return;
    }
    queueSave();
  };

  // --- Render: TRADE -------------------------------------------------------
  const renderTrade = () => {
    const heldCount = cryptos.filter((c) => c.owned > 0).length;
    return (
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
          <SectionTitle
            title="Markets"
            right={<Text style={[styles.subText, { color: theme.textMuted }]}>{cryptos.length} coins · {heldCount} held</Text>}
          />
          {cryptos.map((coin) => (
            <CoinRow
              key={coin.id}
              coin={coin}
              market={market.coinMarkets[coin.id]}
              darkMode={darkMode}
              showHoldings
              onPress={() => openCoin(coin.id)}
            />
          ))}
        </View>

        <View style={{ gap: responsiveSpacing.sm }}>
          <SectionTitle
            title="Open Orders"
            right={<Text style={[styles.subText, { color: theme.textMuted }]}>{(market.openOrders ?? []).length} active</Text>}
          />
          {(market.openOrders ?? []).length === 0 ? (
            <EmptyText theme={theme} darkMode={darkMode}>
              No open orders. Tap a coin above to open its chart and place a market, limit, or stop order.
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
          <SectionTitle title="Recent Fills" />
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
  };

  // --- Render: MINE --------------------------------------------------------
  const renderMine = () => (
    <View style={{ gap: responsiveSpacing.lg }}>
      {/* Recipe B hero - the RIG CONSOLE: a hashrate gauge ring (fill = fleet
          health) beside the weekly-yield readout (ONE focal amber surface). */}
      <HeroCard darkMode={darkMode} theme={theme}>
        <View style={styles.heroContent}>
          <ProgressRing
            value={fleetHealth}
            size={94}
            strokeWidth={8}
            accentColor={AMBER}
            trackColor={darkMode ? 'rgba(148,163,184,0.18)' : 'rgba(100,116,139,0.20)'}
            surfaceColor={theme.surface}
            borderColor={theme.border}
            inkColor={theme.text}
            showPill={false}
            ambient={false}
            label={`Fleet health ${Math.round(fleetHealth)} percent, hashrate ${formatHashrate(totalHashrate)}`}
          >
            <View style={styles.ringCenter}>
              <Zap size={scale(15)} color={AMBER} />
              <Text
                style={[styles.ringHash, { color: theme.text }]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.6}
              >
                {formatHashrate(totalHashrate)}
              </Text>
              <Text style={[styles.ringUnit, { color: theme.textMuted }]}>HASHRATE</Text>
            </View>
          </ProgressRing>

          <View style={{ flex: 1 }}>
            <Text style={[styles.heroEyebrow, { color: theme.textMuted }]}>MINING YIELD</Text>
            <Text style={[styles.heroValue, { color: theme.text }]}>
              {formatMoneyCompact(mineEstimate.usdPerWeek)}
              <Text style={[styles.heroValueUnit, { color: theme.textMuted }]}>/wk</Text>
            </Text>
            <Text style={[styles.heroSub, { color: theme.textMuted }]}>
              {totalMiners} rig{totalMiners === 1 ? '' : 's'} online · mining {mineTargetId.toUpperCase()}
              {vsBtcPct != null ? ` · ${vsBtcPct}% of BTC` : ''}
            </Text>
            <View style={styles.pillRow}>
              <Chip
                label={`Difficulty ${difficultyMultiplier.toFixed(1)}×`}
                icon={<Activity size={scale(11)} color={theme.textMuted} />}
              />
              <Chip
                label={`Power ${formatMoneyCompact(mineEstimate.electricityUsd)}/wk`}
                icon={<Zap size={scale(11)} color={theme.textMuted} />}
              />
              <Chip
                label={totalMiners > 0 ? `${fleetBand.label} ${Math.round(fleetHealth)}%` : 'No rigs'}
                tint={totalMiners > 0 ? fleetBand.color : undefined}
              />
            </View>
          </View>
        </View>
      </HeroCard>

      {/* Mining target picker - keeps the existing selectedCrypto radio, now with
          a live readout of the coin miners are minting. */}
      <View style={{ gap: responsiveSpacing.sm }}>
        <SectionTitle title="Mining Target" />
        <Text style={[styles.mineCaption, { color: theme.textMuted }]}>
          Minting {mineTargetCoin?.name ?? mineTargetId.toUpperCase()}
          {mineTargetMarket ? ` · ${mineTargetMarket.regime} regime` : ''} · {formatPrice(mineTargetCoin?.price ?? 0)}
        </Text>
        <View style={styles.chipRow}>
          {cryptos.map((c) => (
            <Chip
              key={c.id}
              label={c.symbol}
              tint={AMBER}
              size="md"
              selected={mineTargetId === c.id}
              onPress={() => handleSelectMineTarget(c.id)}
              accessibilityLabel={`Mine ${c.name ?? c.symbol ?? c.id}`}
            />
          ))}
        </View>
      </View>

      {/* Auto-repair - arms the weekly tick that restores sub-50% rigs to 100%,
          paid from the chosen crypto. Turns durability from one-way decay into a
          managed resource. */}
      <View style={{ gap: responsiveSpacing.sm }}>
        <SectionTitle
          title="Auto-repair"
          right={
            <Chip
              label={autoRepairEnabled ? 'On' : 'Off'}
              icon={<Wrench size={scale(12)} color={autoRepairEnabled ? AMBER : theme.textMuted} />}
              tint={AMBER}
              selected={autoRepairEnabled}
              size="md"
              onPress={handleToggleAutoRepair}
              accessibilityLabel={`Weekly auto-repair, ${autoRepairEnabled ? 'on' : 'off'}`}
            />
          }
        />
        <Text style={[styles.mineCaption, { color: theme.textMuted }]}>
          {autoRepairEnabled
            ? `Each week, rigs below 50% health are repaired - cheapest first - for as much as your ${autoRepairCryptoId.toUpperCase()} balance covers.`
            : 'Rigs degrade 2–5% per week. Enable to auto-restore worn rigs from a crypto of your choice.'}
        </Text>
        {/*
          Player report: "Auto repair in the crypto page does not work."
          It does, but two things made it look broken and neither was visible:

            1. It only touches rigs UNDER 50% health. At 2-5% decay per week
               that is 10-25 weeks of arming the toggle and watching nothing
               happen.
            2. It is BUDGETED by the funding coin. With a zero balance of the
               selected crypto it silently repairs nothing - no message, no
               log, no difference from the feature being broken.

          The caption above also used to promise rigs were "restored to 100%",
          which is only true when the balance covers the full bill.

          So state, every week, exactly what will happen next tick.
        */}
        {autoRepairEnabled && (
          <Text style={[styles.mineCaption, { color: autoRepairStatus.ok ? theme.textMuted : AMBER }]}>
            {autoRepairStatus.message}
          </Text>
        )}
        {autoRepairEnabled && (
          <View style={styles.chipRow}>
            {cryptos.map((c) => (
              <Chip
                key={c.id}
                label={c.symbol}
                tint={AMBER}
                size="md"
                selected={autoRepairCryptoId === c.id}
                onPress={() => handleSelectAutoRepairCrypto(c.id)}
                accessibilityLabel={`Fund auto-repair with ${c.name ?? c.symbol ?? c.id}`}
              />
            ))}
          </View>
        )}
      </View>

      {/* Rig hardware cards - status LED + spec chips + durability bar. The card
          opens a rig DETAIL page; the Buy button keeps its exact handler. */}
      <View style={{ gap: responsiveSpacing.sm }}>
        <SectionTitle
            title="Rigs"
            right={<Text style={[styles.subText, { color: theme.textMuted }]}>{formatHashrate(totalHashrate)} total</Text>}
          />
        {MINER_TIERS.map((tier) => {
          const owned = ownedMiners[tier.id] ?? 0;
          const price = MINER_PRICES[tier.id];
          const buyDisabled = cash < price || fleetAtCap;
          // Honest marginal yield for this tier - collapses to ~$0 at the cap.
          const tierMarginal = marginalYield(tier.id);
          const dur = owned > 0 ? (minerDurability[tier.id] ?? 100) : 0;
          const band = healthBand(dur);
          const ledColor = owned > 0 ? band.color : theme.textMuted;
          return (
            <TouchableOpacity
              key={tier.id}
              activeOpacity={0.85}
              onPress={() => setSubView({ kind: 'rig', tierId: tier.id })}
              accessibilityRole="button"
              accessibilityLabel={`View ${tier.label} rig details`}
              style={[getGlassCard(darkMode, 6), styles.rigCard, { backgroundColor: theme.surface, borderColor: theme.border }]}
            >
              <View style={styles.rigHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.minerName, { color: theme.text }]}>{tier.label}</Text>
                  {/* The two spec pills (hashrate, per-unit yield) moved to the
                      rig detail page this row already opens - the list row is
                      the fleet's status, not its datasheet. */}
                  <Text style={[styles.rigStatus, { color: ledColor }]}>
                    {owned > 0
                      ? `${band.label} · ${Math.round(dur)}% health · ${formatMoneyCompact(tierMarginal)}/wk each`
                      : `Not deployed · ${formatHashrate(tier.hashrate)}`}
                  </Text>
                </View>
                <Chip label={`×${owned}`} tint={AMBER} selected={owned > 0} accessibilityLabel={`${owned} owned`} />
                <ChevronRight size={scale(16)} color={theme.textMuted} />
              </View>

              {owned > 0 && <ProgressBar value={dur / 100} color={band.color} label={`${tier.label} durability`} />}

              <TouchableOpacity
                disabled={buyDisabled}
                onPress={() => handleBuyMiner(tier.id)}
                style={[
                  styles.buyBtn,
                  { backgroundColor: buyDisabled ? theme.surfaceElevated : withAlpha(AMBER, 0.16) },
                ]}
                accessibilityRole="button"
                accessibilityLabel={
                  fleetAtCap
                    ? 'Fleet at $100K per week cap - buying adds no yield'
                    : `Buy ${tier.label} miner for ${formatMoneyCompact(price)}`
                }
                accessibilityState={{ disabled: buyDisabled }}
              >
                <Plus size={scale(13)} color={buyDisabled ? theme.textMuted : AMBER} />
                <Text style={[styles.buyBtnText, { color: buyDisabled ? theme.textMuted : AMBER }]}>
                  {fleetAtCap ? 'Fleet at $100K/wk cap' : `Buy · ${formatMoneyCompact(price)}`}
                </Text>
              </TouchableOpacity>

            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );

  // --- Render: UPGRADES (enhanced mining progression) ----------------------
  // Surfaces the four previously-orphaned MiningActions tracks: per-tier miner
  // upgrades, mining pools, staking, energy, and automation. Every button
  // round-trips a real action + queueSave with honest disabled states.
  const renderUpgrades = () => {
    const warehouse = gameState.warehouse;
    const ownedTiers = MINER_TIERS.filter((t) => (ownedMiners[t.id] ?? 0) > 0);
    const hasRigs = ownedTiers.length > 0;
    // Effective upgrade target tier - fall back to the first owned rig so the
    // picker never points at a tier the player doesn't own.
    const effectiveTierId = ownedTiers.some((t) => t.id === upgradeTierId)
      ? upgradeTierId
      : ownedTiers[0]?.id ?? 'basic';
    const upgradeDefs = Object.values(MINER_UPGRADE_DEFINITIONS).flat();
    const existingUpgrades = warehouse?.upgrades ?? [];
    const upgradeLevelFor = (upgradeId: string) =>
      existingUpgrades.find((u) => u.id === upgradeId && u.minerId === effectiveTierId)?.level ?? 0;
    // Mirrors buyMinerUpgrade's diminishing-cost curve + inflation, so the price
    // shown is exactly what will be charged.
    const upgradeNextCost = (baseCost: number, level: number) =>
      getInflatedPrice(level === 0 ? baseCost : Math.round(baseCost * Math.pow(1.5, level)), priceIndex);

    const activePoolId = warehouse?.activePool;

    const stakingPositions = warehouse?.stakingPositions ?? [];
    const stakeableCoins = cryptos.filter((c) => (c.owned ?? 0) > 0);
    const effectiveStakeCoinId = stakeableCoins.some((c) => c.id === stakeCoinId)
      ? stakeCoinId
      : stakeableCoins[0]?.id ?? 'btc';
    const stakeCoin = cryptos.find((c) => c.id === effectiveStakeCoinId);
    const stakeOwned = stakeCoin?.owned ?? 0;

    const currentEnergy = warehouse?.energyType ?? 'standard';

    const automationLevel = warehouse?.automationLevel ?? 0;
    const automationMaxed = automationLevel >= 5;
    const automationCost = getInflatedPrice(Math.round(25000 * Math.pow(1.8, automationLevel)), priceIndex);
    const automationDisabled = automationMaxed || cash < automationCost;

    return (
      <View style={{ gap: responsiveSpacing.lg }}>
        {/* Miner upgrades - per owned tier (efficiency / power / durability / cooling). */}
        <View style={{ gap: responsiveSpacing.sm }}>
          <SectionTitle
            title="Miner Upgrades"
            right={<Text style={[styles.subText, { color: theme.textMuted }]}>+yield · −power</Text>}
          />
          {!hasRigs ? (
            <EmptyText theme={theme} darkMode={darkMode}>
              Deploy a rig in the Mine tab first - upgrades boost the rigs you own.
            </EmptyText>
          ) : (
            <>
              <Text style={[styles.mineCaption, { color: theme.textMuted }]}>Upgrading fleet</Text>
              <View style={styles.chipRow}>
                {ownedTiers.map((t) => (
                  <Chip
                    key={t.id}
                    label={t.label}
                    tint={AMBER}
                    size="md"
                    selected={effectiveTierId === t.id}
                    onPress={() => setUpgradeTierId(t.id)}
                    accessibilityLabel={`Upgrade ${t.label}`}
                  />
                ))}
              </View>
              {upgradeDefs.map((def) => {
                const level = upgradeLevelFor(def.id);
                const maxed = level >= def.maxLevel;
                const cost = upgradeNextCost(def.baseCost, level);
                const disabled = maxed || cash < cost;
                return (
                  <View key={def.id} style={[getGlassCard(darkMode, 6), styles.rigCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                    <View style={styles.rigHeader}>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.minerName, { color: theme.text }]}>{def.name}</Text>
                        <Text style={[styles.rigStatus, { color: theme.textMuted }]}>{def.description}</Text>
                      </View>
                      <Chip label={`Lv ${level}/${def.maxLevel}`} tint={AMBER} selected={level > 0} />
                    </View>
                    <TouchableOpacity
                      disabled={disabled}
                      onPress={() => handleBuyMinerUpgrade(def.id, effectiveTierId)}
                      style={[styles.buyBtn, { backgroundColor: disabled ? theme.surfaceElevated : withAlpha(AMBER, 0.16) }]}
                      accessibilityRole="button"
                      accessibilityLabel={maxed ? `${def.name} at maximum level` : `Buy ${def.name} for ${formatMoneyCompact(cost)}`}
                      accessibilityState={{ disabled }}
                    >
                      <Plus size={scale(13)} color={disabled ? theme.textMuted : AMBER} />
                      <Text style={[styles.buyBtnText, { color: disabled ? theme.textMuted : AMBER }]}>
                        {maxed ? 'Maxed out' : cash < cost ? `Need ${formatMoneyCompact(cost)}` : `Upgrade · ${formatMoneyCompact(cost)}`}
                      </Text>
                    </TouchableOpacity>
                  </View>
                );
              })}
            </>
          )}
        </View>

        {/* Mining pools - join/leave, with bonus/fee/net shown honestly. */}
        <View style={{ gap: responsiveSpacing.sm }}>
          <SectionTitle
            title="Mining pools"
            right={
              activePoolId ? (
                <Chip
                  label="Leave pool"
                  tint={AMBER}
                  size="md"
                  onPress={handleLeavePool}
                  accessibilityLabel="Leave the active mining pool"
                />
              ) : undefined
            }
          />
          <Text style={[styles.mineCaption, { color: theme.textMuted }]}>
            Pools boost the coin you mine ({mineTargetId.toUpperCase()}). Net = bonus × (1 − fee); above 1.00× beats solo.
          </Text>
          {MINING_POOLS.map((pool) => {
            const net = pool.bonusMultiplier * (1 - pool.fee);
            const isActive = pool.id === activePoolId;
            const matches = pool.cryptoId === mineTargetId;
            const disabled = isActive || !matches;
            return (
              <View key={pool.id} style={[getGlassCard(darkMode, 6), styles.rigCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <View style={styles.rigHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.minerName, { color: theme.text }]}>{pool.name}</Text>
                    <Text style={[styles.rigStatus, { color: theme.textMuted }]}>for {pool.cryptoId.toUpperCase()}</Text>
                  </View>
                  {isActive ? <Chip label="Active" tone="success" /> : null}
                  <Chip label={`net ${net.toFixed(2)}×`} tone={net >= 1 ? 'success' : 'danger'} />
                </View>
                <View style={styles.specRow}>
                  <Chip label={`Bonus +${Math.round((pool.bonusMultiplier - 1) * 100)}%`} />
                  <Chip label={`Fee ${Math.round(pool.fee * 100)}%`} />
                </View>
                <TouchableOpacity
                  disabled={disabled}
                  onPress={() => handleJoinPool(pool.id)}
                  style={[styles.buyBtn, { backgroundColor: disabled ? theme.surfaceElevated : withAlpha(AMBER, 0.16) }]}
                  accessibilityRole="button"
                  accessibilityLabel={isActive ? `${pool.name} is your active pool` : `Join ${pool.name}`}
                  accessibilityState={{ disabled }}
                >
                  <Text style={[styles.buyBtnText, { color: disabled ? theme.textMuted : AMBER }]}>
                    {isActive ? 'Active pool' : matches ? 'Join pool' : `Mine ${pool.cryptoId.toUpperCase()} to join`}
                  </Text>
                </TouchableOpacity>
              </View>
            );
          })}
        </View>

        {/* Staking - lock crypto for weekly rewards; claim on maturity. */}
        <View style={{ gap: responsiveSpacing.sm }}>
          <SectionTitle
            title="Staking"
            right={
              stakingPositions.length > 0 ? (
                <Chip
                  label="Claim rewards"
                  icon={<Coins size={scale(12)} color={AMBER} />}
                  tint={AMBER}
                  size="md"
                  onPress={handleClaimStaking}
                  accessibilityLabel="Claim matured staking rewards"
                />
              ) : undefined
            }
          />
          <Text style={[styles.mineCaption, { color: theme.textMuted }]}>
            Lock crypto to earn weekly rewards. Longer locks pay more; principal returns at maturity.
          </Text>

          {stakingPositions.map((pos, i) => {
            const sym = cryptos.find((c) => c.id === pos.cryptoId)?.symbol ?? pos.cryptoId.toUpperCase();
            return (
              <Chip
                key={`${pos.cryptoId}-${i}`}
                label={`${formatCoin(pos.amount)} ${sym} · ${pos.lockWeeks}w · ${(pos.rewardRate * 100).toFixed(2)}%/wk`}
                style={styles.stakePosition}
              />
            );
          })}

          {stakeableCoins.length === 0 ? (
            <EmptyText theme={theme} darkMode={darkMode}>Buy some crypto in the Trade tab to stake it here.</EmptyText>
          ) : (
            <View style={[getGlassCard(darkMode, 6), styles.rigCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <Text style={[styles.mineCaption, { color: theme.textMuted }]}>Coin</Text>
              <View style={styles.chipRow}>
                {stakeableCoins.map((c) => (
                  <Chip
                    key={c.id}
                    label={c.symbol}
                    tint={AMBER}
                    size="md"
                    selected={effectiveStakeCoinId === c.id}
                    onPress={() => setStakeCoinId(c.id)}
                    accessibilityLabel={`Stake ${c.symbol}`}
                  />
                ))}
              </View>
              <Text style={[styles.mineCaption, { color: theme.textMuted }]}>Lock period</Text>
              <View style={styles.chipRow}>
                {[1, 2, 3, 4].map((wk) => (
                  <Chip
                    key={wk}
                    label={`${wk}w · ${(STAKING_RATES[wk] * 100).toFixed(2)}%`}
                    tint={AMBER}
                    size="md"
                    selected={stakeLockWeeks === wk}
                    onPress={() => setStakeLockWeeks(wk)}
                    accessibilityLabel={`${wk} week lock at ${(STAKING_RATES[wk] * 100).toFixed(2)} percent weekly`}
                  />
                ))}
              </View>
              <Text style={[styles.mineCaption, { color: theme.textMuted }]}>
                Holding {formatCoin(stakeOwned)} {stakeCoin?.symbol ?? ''}
              </Text>
              <View style={styles.specRow}>
                {([0.25, 0.5, 1] as const).map((f) => (
                  <TouchableOpacity
                    key={f}
                    disabled={stakeOwned <= 0}
                    onPress={() => handleStake(f, effectiveStakeCoinId)}
                    style={[styles.buyBtn, { flex: 1, backgroundColor: stakeOwned <= 0 ? theme.surfaceElevated : withAlpha(AMBER, 0.16) }]}
                    accessibilityRole="button"
                    accessibilityLabel={`Stake ${f === 1 ? 'the maximum' : `${f * 100} percent`} of ${stakeCoin?.symbol ?? 'holdings'}`}
                    accessibilityState={{ disabled: stakeOwned <= 0 }}
                  >
                    <Text style={[styles.buyBtnText, { color: stakeOwned <= 0 ? theme.textMuted : AMBER }]}>{f === 1 ? 'Max' : `${f * 100}%`}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}
        </View>

        {/* Energy system - one-time install cuts weekly power cost. */}
        <View style={{ gap: responsiveSpacing.sm }}>
          <SectionTitle title="Energy system" />
          <Text style={[styles.mineCaption, { color: theme.textMuted }]}>Cleaner energy cuts weekly power costs. One-time install.</Text>
          {(['solar', 'wind', 'hybrid'] as const).map((et) => {
            const energy = ENERGY_TYPES[et];
            const installed = currentEnergy === et;
            const cost = getInflatedPrice(energy.cost, priceIndex);
            const disabled = installed || cash < cost;
            return (
              <View key={et} style={[getGlassCard(darkMode, 6), styles.rigCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <View style={styles.rigHeader}>
                  <Zap size={scale(15)} color={installed ? accent.success : AMBER} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.minerName, { color: theme.text }]}>{energy.name}</Text>
                    <Text style={[styles.rigStatus, { color: theme.textMuted }]}>−{Math.round(energy.efficiency * 100)}% power cost</Text>
                  </View>
                  {installed ? <Chip label="Installed" tint={AMBER} selected /> : null}
                </View>
                <TouchableOpacity
                  disabled={disabled}
                  onPress={() => handleUpgradeEnergy(et)}
                  style={[styles.buyBtn, { backgroundColor: disabled ? theme.surfaceElevated : withAlpha(AMBER, 0.16) }]}
                  accessibilityRole="button"
                  accessibilityLabel={installed ? `${energy.name} already installed` : `Install ${energy.name} for ${formatMoneyCompact(cost)}`}
                  accessibilityState={{ disabled }}
                >
                  <Text style={[styles.buyBtnText, { color: disabled ? theme.textMuted : AMBER }]}>
                    {installed ? 'Installed' : cash < cost ? `Need ${formatMoneyCompact(cost)}` : `Install · ${formatMoneyCompact(cost)}`}
                  </Text>
                </TouchableOpacity>
              </View>
            );
          })}
        </View>

        {/* Automation - +2% fleet yield per level, up to 5. */}
        <View style={{ gap: responsiveSpacing.sm }}>
          <SectionTitle title="Automation" />
          <Text style={[styles.mineCaption, { color: theme.textMuted }]}>Each level adds +2% mining yield across the whole fleet.</Text>
          <View style={[getGlassCard(darkMode, 6), styles.rigCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={styles.rigHeader}>
              <Gauge size={scale(15)} color={AMBER} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.minerName, { color: theme.text }]}>Automation</Text>
                <Text style={[styles.rigStatus, { color: theme.textMuted }]}>+{automationLevel * 2}% fleet yield</Text>
              </View>
              <Chip label={`${automationLevel}/5`} tint={AMBER} selected />
            </View>
            <TouchableOpacity
              disabled={automationDisabled}
              onPress={handleUpgradeAutomation}
              style={[styles.buyBtn, { backgroundColor: automationDisabled ? theme.surfaceElevated : withAlpha(AMBER, 0.16) }]}
              accessibilityRole="button"
              accessibilityLabel={automationMaxed ? 'Automation at maximum level' : `Upgrade automation for ${formatMoneyCompact(automationCost)}`}
              accessibilityState={{ disabled: automationDisabled }}
            >
              <Plus size={scale(13)} color={automationDisabled ? theme.textMuted : AMBER} />
              <Text style={[styles.buyBtnText, { color: automationDisabled ? theme.textMuted : AMBER }]}>
                {automationMaxed ? 'Maxed out' : cash < automationCost ? `Need ${formatMoneyCompact(automationCost)}` : `Upgrade · ${formatMoneyCompact(automationCost)}`}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  // --- Render: PORTFOLIO ---------------------------------------------------
  const renderPortfolio = () => {
    // Halving countdown: BTC halves every ~208 weeks (4 game years) of game time.
    // The halving is fully wired: the crypto weekly tick fires it at 208w
    // (lib/crypto/weeklyTick.ts) and applyMiningCryptos scales the mined reward by
    // 0.5^halvingCount - this UI lights up the countdown to that event.
    const HALVING_INTERVAL_WEEKS = 208;
    const lastHalving = market.lastHalvingWeek ?? 0;
    const nextHalvingWeek = lastHalving + HALVING_INTERVAL_WEEKS;
    const weeksToHalving = Math.max(0, nextHalvingWeek - gameState.weeksLived);

    // Dirty-BTC indicator: dirty BTC sits in the dark-web wallet; exchanges refuse it.
    const dirtyBtc = gameState.darkWeb?.dirtyBtc ?? 0;
    const btcCoin = cryptos.find((c) => c.id === 'btc');
    const btcMarket = market.coinMarkets['btc'];
    const btcOwned = btcCoin?.owned ?? 0;
    const btcPrice = btcCoin?.price ?? 0;
    const btcChange = btcCoin?.changePercent ?? 0;
    const dirtyBtcUSD = dirtyBtc * btcPrice;
    const btcUp = btcChange >= 0;

    return (
    <View style={{ gap: responsiveSpacing.lg }}>
      {/* Recipe B hero - WALLET: portfolio value headline + BTC balance + a
          BTC price sparkline (ONE focal amber surface). */}
      <HeroCard darkMode={darkMode} theme={theme}>
        <View style={styles.heroContent}>
          <View
            style={[
              getGlassIconContainer(darkMode, 44),
              { backgroundColor: withAlpha(AMBER, 0.15), borderWidth: 1, borderColor: withAlpha(AMBER, 0.3) },
            ]}
          >
            <Wallet size={scale(22)} color={AMBER} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.heroEyebrow, { color: theme.textMuted }]}>PORTFOLIO VALUE</Text>
            <Text style={[styles.heroValue, { color: theme.text }]}>{formatMoneyCompact(portfolioTotalValue)}</Text>
            <Text style={[styles.heroSub, { color: portfolioUnrealizedPL >= 0 ? accent.success : accent.danger }]}>
              {portfolioUnrealizedPL >= 0 ? '+' : ''}
              {formatMoneyCompact(portfolioUnrealizedPL)} unrealized
            </Text>
          </View>
        </View>

        <View style={[styles.walletDivider, { backgroundColor: theme.border }]} />

        <View style={styles.btcRow}>
          <Bitcoin size={scale(15)} color={AMBER} />
          <Text style={[styles.btcLabel, { color: theme.text }]}>
            {formatCoin(btcOwned)} <Text style={{ color: theme.textMuted }}>BTC</Text>
          </Text>
          <Text style={[styles.btcValue, { color: theme.textMuted }]}>· {formatMoneyCompact(btcOwned * btcPrice)}</Text>
          <View style={{ flex: 1 }} />
          <Text style={[styles.btcPrice, { color: theme.text }]}>{formatPrice(btcPrice)}</Text>
          <Chip
            label={`${btcChange >= 0 ? '+' : ''}${btcChange.toFixed(2)}%`}
            tone={btcChange >= 0 ? 'success' : 'danger'}
            icon={
              btcChange >= 0
                ? <TrendingUp size={scale(11)} color={accent.success} />
                : <TrendingDown size={scale(11)} color={accent.danger} />
            }
          />
        </View>
        <Sparkline
          history={btcMarket?.priceHistory ?? []}
          height={scale(40)}
          color={btcUp ? accent.success : accent.danger}
          fillColor={btcUp ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)'}
        />
      </HeroCard>

      {dirtyBtc > 0 && (
        // Hard Rule #7: the caution accent was a scale(4) amber bar down the
        // left edge, clipped by borderRadius.xl + overflow:hidden. Its comment
        // argued it was fine because it was thin - the rule bans the shape, not
        // the thickness. Amber moves onto the full border, and the warning
        // headline inside is already amber.
        <View style={[getGlassCard(darkMode, 6), styles.noticeCard, { backgroundColor: theme.surface, borderColor: AMBER }]}>
          <View style={styles.noticeBody}>
            <View style={styles.noticeTitleRow}>
              <AlertTriangle size={scale(14)} color={AMBER} />
              <Text style={[styles.dirtyTitle, { color: AMBER }]}>
                {dirtyBtc.toFixed(4)} ₿ tainted ({formatMoneyCompact(dirtyBtcUSD)})
              </Text>
            </View>
            <Text style={[styles.subText, { color: theme.textMuted }]}>
              Exchanges refuse dirty BTC. Launder it in the Onion app before it can be sold here.
            </Text>
          </View>
        </View>
      )}

      <View style={[getGlassCard(darkMode, 6), styles.noticeCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <View style={styles.noticeBody}>
          <View style={styles.noticeTitleRow}>
            <Hammer size={scale(14)} color={theme.textMuted} />
            <Text style={[styles.dirtyTitle, { color: theme.text }]}>
              Next halving in {weeksToHalving} {weeksToHalving === 1 ? 'week' : 'weeks'}
            </Text>
          </View>
          <Text style={[styles.subText, { color: theme.textMuted }]}>
            BTC supply halves every ~4 years. Historically a bull-regime catalyst.
          </Text>
        </View>
      </View>

      <StatStrip
        items={[
          { label: 'Cost basis', value: formatMoneyCompact(portfolioCostBasis) },
          {
            label: 'Realized YTD',
            value: formatMoneyCompact(market.realizedGainsThisYear),
            tint: market.realizedGainsThisYear < 0 ? accent.danger : undefined,
          },
          {
            label: 'Lifetime realized',
            value: formatMoneyCompact(market.totalRealizedGains),
            tint: market.totalRealizedGains < 0 ? accent.danger : undefined,
          },
        ]}
      />

      <View style={{ gap: responsiveSpacing.sm }}>
        <SectionTitle title="Holdings" />
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
                onPress={() => openCoin(coin.id)}
              />
            ))
        )}
      </View>

      <View style={{ gap: responsiveSpacing.sm }}>
        <SectionTitle
          title="DCA schedules"
          right={
            <Chip
              label="Schedule"
              icon={<Plus size={scale(12)} color={AMBER} />}
              tint={AMBER}
              size="md"
              onPress={() => setShowDCA(true)}
              accessibilityLabel="Schedule a new DCA crypto purchase"
            />
          }
        />
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

  // --- Render: RIG DETAIL (sub-view) ---------------------------------------
  const renderRigDetail = (tierId: string) => {
    const tier = MINER_TIERS.find((t) => t.id === tierId);
    if (!tier) {
      return (
        <EmptyText theme={theme} darkMode={darkMode}>Rig not found. Tap Back to return.</EmptyText>
      );
    }
    const owned = ownedMiners[tier.id] ?? 0;
    const price = MINER_PRICES[tier.id];
    const canAfford = cash >= price;
    const dur = owned > 0 ? (minerDurability[tier.id] ?? 100) : 0;
    const band = healthBand(dur);
    const ledColor = owned > 0 ? band.color : theme.textMuted;
    // Fleet + per-unit yields now reflect the SELECTED mining coin (honest -
    // difficulty × halving × coin price × electricity), not the old BTC-at-1.0 static.
    const fleetYield = fleetYieldForTier(tier.id, owned);
    const unitYield = perUnitYield(tier.id);
    const fleetHash = owned * tier.hashrate;
    const repairFull = MINER_REPAIR_COSTS[tier.id] ?? 0;
    // Repair cost scales with damage + unit count (mirrors applyMiningWarehouse).
    const repairNow = owned > 0 ? repairFull * ((100 - dur) / 100) * owned : 0;
    const canRepair = owned > 0 && dur < 100 && repairNow > 0 && cash >= repairNow;

    return (
      <View style={{ gap: responsiveSpacing.lg }}>
        {/* Recipe B hero - the rig console for THIS model (durability ring). */}
        <HeroCard darkMode={darkMode} theme={theme}>
          <View style={styles.heroContent}>
            <ProgressRing
              value={owned > 0 ? dur : 0}
              size={92}
              strokeWidth={8}
              accentColor={owned > 0 ? band.color : theme.textMuted}
              trackColor={darkMode ? 'rgba(148,163,184,0.18)' : 'rgba(100,116,139,0.20)'}
              surfaceColor={theme.surface}
              borderColor={theme.border}
              inkColor={theme.text}
              ambient={false}
              label={`${tier.label} durability ${Math.round(dur)} percent`}
            >
              <View style={styles.ringCenter}>
                <Cpu size={scale(18)} color={owned > 0 ? band.color : theme.textMuted} />
                <Text style={[styles.ringHash, { color: theme.text }]}>×{owned}</Text>
              </View>
            </ProgressRing>
            <View style={{ flex: 1 }}>
              <Text style={[styles.heroEyebrow, { color: theme.textMuted }]}>Mining rig</Text>
              <Text style={[styles.heroValue, { color: theme.text }]}>{formatHashrate(tier.hashrate)}</Text>
              <Text style={[styles.heroSub, { color: ledColor }]}>
                {owned > 0 ? `${band.label} · ${Math.round(dur)}% health` : 'Not deployed'}
              </Text>
              <View style={styles.pillRow}>
                <Chip
                  label={`${formatMoneyCompact(unitYield)}/wk per unit`}
                  icon={<Zap size={scale(11)} color={theme.textMuted} />}
                  accessibilityLabel={`${formatMoneyCompact(unitYield)} per week in ${mineTargetId.toUpperCase()} per unit`}
                />
              </View>
            </View>
          </View>
        </HeroCard>

        {/* Four cards became three: unit price is the Buy button's own label. */}
        <StatStrip
          items={[
            { label: 'Owned', value: owned },
            { label: 'Fleet hashrate', value: formatHashrate(fleetHash) },
            { label: 'Fleet yield', value: `${formatMoneyCompact(fleetYield)}/wk` },
          ]}
        />

        <View style={{ gap: responsiveSpacing.sm }}>
          <SectionTitle title="Condition" />
          <View style={[getGlassCard(darkMode, 6), styles.conditionCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            {owned > 0 ? (
              <>
                <View style={styles.conditionRow}>
                  <Text style={[styles.conditionLabel, { color: theme.textMuted }]}>Durability</Text>
                  <Text style={[styles.conditionValue, { color: band.color }]}>{Math.round(dur)}%</Text>
                </View>
                <ProgressBar value={dur / 100} color={band.color} label="Durability" />
                <View style={styles.conditionRow}>
                  <View style={styles.conditionInline}>
                    <Activity size={scale(12)} color={theme.textMuted} />
                    <Text style={[styles.conditionLabel, { color: theme.textMuted }]}>Network difficulty</Text>
                  </View>
                  <Text style={[styles.conditionValue, { color: theme.text }]}>{difficultyMultiplier.toFixed(1)}×</Text>
                </View>
                {/* Repair CTA - the old "$X" readout is now an actionable inset
                    chip (single loud CTA reserved for Buy). Restores durability to
                    100% and debits the displayed cost. Disabled at full health. */}
                <TouchableOpacity
                  disabled={!canRepair}
                  onPress={() => handleRepairRig(tier.id)}
                  style={[
                    styles.buyBtn,
                    { backgroundColor: canRepair ? withAlpha(AMBER, 0.16) : theme.surfaceElevated, marginTop: responsiveSpacing.xs },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={`Repair ${tier.label} for ${formatMoneyCompact(repairNow)}`}
                  accessibilityState={{ disabled: !canRepair }}
                >
                  <Wrench size={scale(13)} color={canRepair ? AMBER : theme.textMuted} />
                  <Text style={[styles.buyBtnText, { color: canRepair ? AMBER : theme.textMuted }]}>
                    {dur >= 100
                      ? 'Fully repaired'
                      : cash < repairNow
                        ? `Repair · need ${formatMoneyCompact(repairNow)}`
                        : `Repair now · ${formatMoneyCompact(repairNow)}`}
                  </Text>
                </TouchableOpacity>
              </>
            ) : (
              <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                No units deployed. Rigs degrade 2–5% per week; keep durability up or yield drops.
                Full repair runs {formatMoneyCompact(repairFull)} per unit at 0%.
              </Text>
            )}
          </View>
        </View>

        <PrimaryCTA
          theme={theme}
          disabled={!canAfford || fleetAtCap}
          label={
            fleetAtCap
              ? 'Fleet at $100K/wk cap'
              : canAfford
                ? `Buy ${tier.label} · ${formatMoneyCompact(price)}`
                : `Need ${formatMoneyCompact(price)}`
          }
          accessibilityLabel={
            fleetAtCap
              ? 'Fleet at $100K per week cap - buying adds no yield'
              : `Buy ${tier.label} miner for ${formatMoneyCompact(price)}`
          }
          onPress={() => handleBuyMiner(tier.id)}
        />

        {/* Sell - the removal half of rig ownership (BBQ report). It used to sit
            beside Buy on every row of the Mine list, which put two money buttons
            on eight cards; it belongs on the page you open to manage one model.
            Same handler, same 50%-of-catalogue quote, same confirm. */}
        {owned > 0 ? (
          <TouchableOpacity
            onPress={() => handleSellMiner(tier.id, tier.label)}
            style={[styles.buyBtn, { backgroundColor: 'transparent', borderWidth: 1, borderColor: accent.danger }]}
            accessibilityRole="button"
            accessibilityLabel={`Sell one ${tier.label} for ${formatMoneyCompact(Math.floor(price * 0.5))}`}
          >
            <Minus size={scale(13)} color={accent.danger} />
            <Text style={[styles.buyBtnText, { color: accent.danger }]}>
              Sell · {formatMoneyCompact(Math.floor(price * 0.5))}
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>
    );
  };

  // --- Render: COIN DETAIL (sub-view) --------------------------------------
  const renderCoinDetail = (coinId: string) => {
    const coin = cryptos.find((c) => c.id === coinId);
    if (!coin) {
      return (
        <EmptyText theme={theme} darkMode={darkMode}>Coin not found. Tap Back to return.</EmptyText>
      );
    }
    const cm = market.coinMarkets[coinId];
    const cb = market.costBasis?.[coinId];
    const change = coin.changePercent ?? 0;
    const up = change >= 0;
    const ownedUsd = coin.owned * coin.price;
    const avgCost = cb && cb.totalShares > 0 ? cb.totalCost / cb.totalShares : 0;
    const unrealized = cb ? ownedUsd - cb.totalCost : 0;
    const history = cm?.priceHistory ?? [];

    return (
      <View style={{ gap: responsiveSpacing.lg }}>
        {/* Recipe B hero - the MARKET panel: price + full history line. */}
        <HeroCard darkMode={darkMode} theme={theme}>
          <View style={styles.coinHeroTop}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.heroEyebrow, { color: theme.textMuted }]}>
                {coin.symbol} · {coin.name}
              </Text>
              <Text style={[styles.heroValue, { color: theme.text }]}>{formatPrice(coin.price)}</Text>
            </View>
            <Chip
              label={`${change >= 0 ? '+' : ''}${change.toFixed(2)}%`}
              tone={change >= 0 ? 'success' : 'danger'}
              icon={
                change >= 0
                  ? <TrendingUp size={scale(11)} color={accent.success} />
                  : <TrendingDown size={scale(11)} color={accent.danger} />
              }
            />
          </View>
          <Sparkline
            history={history}
            height={scale(116)}
            color={up ? accent.success : accent.danger}
            fillColor={up ? 'rgba(16,185,129,0.14)' : 'rgba(239,68,68,0.14)'}
          />
        </HeroCard>

        {cm && (
          <RegimeBanner regime={cm.regime} weeksRemaining={cm.regimeWeeksRemaining} darkMode={darkMode} />
        )}

        {/* The three numbers a position is judged on. The other three (spread,
            position value, average cost) are reference figures, so they read as
            key/value rows rather than six competing cards. */}
        <StatStrip
          items={[
            {
              label: '24h change',
              value: `${change >= 0 ? '+' : ''}${change.toFixed(2)}%`,
              tint: change < 0 ? accent.danger : accent.success,
            },
            { label: 'Holdings', value: `${formatCoin(coin.owned)} ${coin.symbol}` },
            {
              label: 'Unrealized P/L',
              value: cb ? `${unrealized >= 0 ? '+' : ''}${formatMoneyCompact(unrealized)}` : '-',
              tint: cb ? (unrealized < 0 ? accent.danger : accent.success) : undefined,
            },
          ]}
        />

        <View style={[getGlassCard(darkMode, 6), styles.kvCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          {[
            { label: 'Bid/ask spread', value: cm ? `${(cm.bidAskSpread * 100).toFixed(2)}%` : '-' },
            { label: 'Position value', value: formatMoneyCompact(ownedUsd) },
            { label: 'Avg cost', value: avgCost > 0 ? formatPrice(avgCost) : '-' },
          ].map((row, i, all) => (
            <KeyValueRow key={row.label} label={row.label} value={row.value} divider={i < all.length - 1} />
          ))}
        </View>

        <PrimaryCTA
          theme={theme}
          label={`Place Order · ${coin.symbol}`}
          accessibilityLabel={`Place an order for ${coin.name}`}
          onPress={() => setOrderCoin(coin)}
        />
      </View>
    );
  };

  const detailTitle =
    subView?.kind === 'rig'
      ? (MINER_TIERS.find((t) => t.id === subView.tierId)?.label ?? 'Rig')
      : subView?.kind === 'coin'
        ? (cryptos.find((c) => c.id === subView.coinId)?.name ?? 'Coin')
        : 'Crypto';

  return (
    <View style={[styles.root, { backgroundColor: theme.background, paddingTop: 0 }]}>
      <AppHeader
        title={detailTitle}
        onBack={handleBack}
        backLabel={subView ? 'Back to Crypto' : 'Back'}
        right={<CashChip value={formatMoneyCompact(cash)} tint={AMBER} />}
      />

      {/* Tab strip only anchors the top-level views; detail pages are anchored by
          their own hero card. */}
      {!subView && (
        <SegmentedControl<Tab>
          segments={TABS.map((t) => ({ key: t.id, label: t.label, icon: t.icon }))}
          value={activeTab}
          onChange={setActiveTab}
          activeColor={AMBER}
          style={styles.tabBar}
        />
      )}

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: responsiveSpacing.md, paddingBottom: getAppScreenBottomPadding(insets.bottom) }}
      >
        {subView?.kind === 'rig'
          ? renderRigDetail(subView.tierId)
          : subView?.kind === 'coin'
            ? renderCoinDetail(subView.coinId)
            : activeTab === 'trade'
              ? renderTrade()
              : activeTab === 'mine'
                ? renderMine()
                : activeTab === 'upgrades'
                  ? renderUpgrades()
                  : renderPortfolio()}
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
        cryptos={cryptos}
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

// ---------------------------------------------------------------------------
// Presentational building blocks (composed locally; Slate Glass recipes).
// ---------------------------------------------------------------------------

/** Recipe B shell - outer carries shadow/radius/fill/border (no clip); inner
 *  clips the amber tint wash + glow blob + dark-only lit hairline. */
function HeroCard({ darkMode, theme, children }: { darkMode: boolean; theme: ReturnType<typeof getThemeColors>; children: React.ReactNode }) {
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
        {/* Was a LinearGradient from a 14% amber to a 3% amber - a wash whose
            two stops read as one flat tint on device. It is that flat tint. */}
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: withAlpha(AMBER, 0.08) }]} />
        <View pointerEvents="none" style={styles.heroBlob} />
        {darkMode && <View pointerEvents="none" style={styles.heroHairline} />}
        {children}
      </View>
    </View>
  );
}

/** SVG price sparkline. Uses REAL history only; a single point renders a flat
 *  baseline (never fabricates a history array). Width is measured on layout. */
function Sparkline({
  history,
  height,
  color,
  fillColor,
}: {
  history: { price: number }[];
  height: number;
  color: string;
  fillColor: string;
}) {
  const [w, setW] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => {
    const next = e.nativeEvent.layout.width;
    if (next > 0 && Math.abs(next - w) > 1) setW(next);
  };
  const prices = (history ?? []).map((p) => p.price).filter((n) => isFinite(n));
  const pad = 3;
  const h = Math.max(1, height);

  const min = prices.length ? Math.min(...prices) : 0;
  const max = prices.length ? Math.max(...prices) : 0;

  let body: React.ReactNode = null;
  if (w > 0) {
    if (prices.length < 2 || max === min) {
      // Real history has <2 points or no variation yet - a flat baseline
      // (never a fabricated history array).
      const y = (h / 2).toFixed(1);
      body = (
        <Svg width={w} height={h}>
          <Polyline points={`${pad},${y} ${(w - pad).toFixed(1)},${y}`} stroke={color} strokeWidth={2} fill="none" strokeOpacity={0.5} />
        </Svg>
      );
    } else {
      const range = max - min || 1;
      const n = prices.length;
      const xAt = (i: number) => pad + (i / (n - 1)) * (w - pad * 2);
      const yAt = (p: number) => pad + (1 - (p - min) / range) * (h - pad * 2);
      const pts = prices.map((p, i) => `${xAt(i).toFixed(1)},${yAt(p).toFixed(1)}`).join(' ');
      const areaD =
        `M ${xAt(0).toFixed(1)},${(h - pad).toFixed(1)} ` +
        prices.map((p, i) => `L ${xAt(i).toFixed(1)},${yAt(p).toFixed(1)} `).join('') +
        `L ${xAt(n - 1).toFixed(1)},${(h - pad).toFixed(1)} Z`;
      body = (
        <Svg width={w} height={h}>
          <Path d={areaD} fill={fillColor} />
          <Polyline points={pts} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        </Svg>
      );
    }
  }

  return (
    <View onLayout={onLayout} style={{ width: '100%', height: h }}>
      {body}
    </View>
  );
}

/** The screen's single loud CTA (Recipe D) - flat solid amber, dark ink. */
function PrimaryCTA({
  label,
  onPress,
  disabled,
  accessibilityLabel,
  theme,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  accessibilityLabel: string;
  theme: ReturnType<typeof getThemeColors>;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.85}
      style={[
        styles.cta,
        getPlatformShadows(5, 0.3, 2, 8),
        { backgroundColor: disabled ? theme.surfaceElevated : AMBER },
      ]}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: !!disabled }}
    >
      <Text style={[styles.ctaText, { color: disabled ? theme.textMuted : '#0F172A' }]}>{label}</Text>
    </TouchableOpacity>
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
  kvCard: {
    borderRadius: responsiveBorderRadius.xl,
    borderWidth: 1,
    paddingHorizontal: responsiveSpacing.md,
  },
  stakePosition: { alignSelf: 'flex-start' },
  noticeTitleRow: { flexDirection: 'row', alignItems: 'center', gap: scale(6) },
  // Segmented control (getGlassCategoryTabsContainer applied inline) sits
  // directly under the top bar and anchors the screen.
  tabBar: {
    flexDirection: 'row',
    gap: scale(4),
    marginHorizontal: responsiveSpacing.md,
    marginTop: responsiveSpacing.sm,
    marginBottom: responsiveSpacing.sm,
  },
  subText: {
    fontSize: responsiveFontSize.xs,
    marginTop: 2,
  },
  emptyText: {
    fontSize: responsiveFontSize.sm,
    textAlign: 'center',
    opacity: 0.6,
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
    backgroundColor: withAlpha(AMBER, 0.1),
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
  heroValue: { fontSize: responsiveFontSize['3xl'], fontWeight: '600', fontVariant: ['tabular-nums'] },
  heroValueUnit: { fontSize: responsiveFontSize.sm, fontWeight: '600' },
  heroSub: { fontSize: responsiveFontSize.xs, marginTop: 2, fontVariant: ['tabular-nums'] },
  // Gauge-ring center content (hashrate / owned count).
  ringCenter: { alignItems: 'center', justifyContent: 'center', maxWidth: scale(74), paddingHorizontal: scale(2) },
  ringHash: { fontSize: responsiveFontSize.sm, fontWeight: '600', fontVariant: ['tabular-nums'], marginTop: 2 },
  ringUnit: { fontSize: scale(7), fontWeight: '600', letterSpacing: 0.6, marginTop: 1 },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: scale(6),
    marginTop: responsiveSpacing.sm,
  },
  mineCaption: { fontSize: responsiveFontSize.xs, fontVariant: ['tabular-nums'] },
  // Rig hardware card.
  rigCard: {
    padding: responsiveSpacing.md,
    borderRadius: responsiveBorderRadius.xl,
    borderWidth: 1,
    gap: responsiveSpacing.sm,
  },
  rigHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: responsiveSpacing.sm,
  },
  rigStatus: { fontSize: responsiveFontSize.xs, fontWeight: '600', marginTop: 2, fontVariant: ['tabular-nums'] },
  specRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: scale(6),
  },
  minerName: { fontSize: responsiveFontSize.md, fontWeight: '600' },
  buyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    minHeight: touchTargets.minimum,
    paddingHorizontal: responsiveSpacing.md,
    paddingVertical: responsiveSpacing.xs,
    borderRadius: responsiveBorderRadius.full,
  },
  buyBtnText: { fontSize: responsiveFontSize.sm, fontWeight: '600', fontVariant: ['tabular-nums'] },
  // LED status dot.
  // Durability bar.
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: responsiveSpacing.xs,
  },
  // Wallet hero BTC row + sparkline.
  walletDivider: { height: 1, marginVertical: responsiveSpacing.md, opacity: 0.6 },
  btcRow: { flexDirection: 'row', alignItems: 'center', gap: scale(6), marginBottom: responsiveSpacing.sm },
  btcLabel: { fontSize: responsiveFontSize.sm, fontWeight: '600', fontVariant: ['tabular-nums'] },
  btcValue: { fontSize: responsiveFontSize.xs, fontVariant: ['tabular-nums'] },
  btcPrice: { fontSize: responsiveFontSize.sm, fontWeight: '600', fontVariant: ['tabular-nums'] },
  // Coin detail hero header.
  coinHeroTop: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: responsiveSpacing.md },
  // Rig detail condition card.
  conditionCard: {
    borderRadius: responsiveBorderRadius.xl,
    borderWidth: 1,
    padding: responsiveSpacing.md,
    gap: responsiveSpacing.sm,
  },
  conditionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  conditionInline: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  conditionLabel: { fontSize: responsiveFontSize.sm, fontWeight: '600' },
  conditionValue: { fontSize: responsiveFontSize.sm, fontWeight: '600', fontVariant: ['tabular-nums'] },
  // Loud primary CTA (one per detail screen).
  cta: {
    minHeight: touchTargets.minimum,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: responsiveBorderRadius.full,
    paddingHorizontal: responsiveSpacing.lg,
  },
  ctaText: { fontSize: responsiveFontSize.md, fontWeight: '600', fontVariant: ['tabular-nums'] },
  // Notice cards (tainted BTC / halving) - Recipe A. Outer carries shadow +
  // radius + fill + border; noticeInner clips the caution stripe to the radius.
  noticeCard: {
    borderRadius: responsiveBorderRadius.xl,
    borderWidth: 1,
  },
  noticeBody: {
    flex: 1,
    padding: responsiveSpacing.md,
    gap: 4,
  },
  dirtyTitle: { fontSize: responsiveFontSize.sm, fontWeight: '600', fontVariant: ['tabular-nums'] },
});
