import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Alert, ScrollView, Modal, KeyboardAvoidingView, Platform, Keyboard, TouchableWithoutFeedback } from 'react-native';
import LinearGradientFallback from '@/components/fallbacks/LinearGradientFallback';
const LinearGradient = LinearGradientFallback;
import { ArrowLeft, TrendingUp, TrendingDown, DollarSign, BarChart3, Plus, Minus, RefreshCw } from 'lucide-react-native';
import { useGame } from '@/contexts/GameContext';
import LoadingButton from '@/components/ui/LoadingButton';
import InfoButton from '@/components/ui/InfoButton';
import { SkeletonLoader, SkeletonList } from '@/components/ui/SkeletonLoader';
import EmptyState from '@/components/ui/EmptyState';
import { getStockInfo, getAllStockSymbols } from '@/lib/economy/stockMarket';
import { formatMoney } from '@/utils/moneyFormatting';

interface StocksAppProps {
  onBack: () => void;
}

interface Stock {
  symbol: string;
  name: string;
  currentPrice: number;
  change: number;
  changePercent: number;
  volume: number;
  marketCap: number;
  candlesticks: Candlestick[];
}

interface Candlestick {
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  date: string;
}

interface Holding {
  symbol: string;
  shares: number;
  averagePrice: number;
  currentPrice: number;
}

const mockStocks: Stock[] = [
  { 
    symbol: 'AAPL', 
    name: 'Apple Inc.', 
    currentPrice: 150.25, 
    change: 2.15, 
    changePercent: 1.45, 
    volume: 45000000, 
    marketCap: 2500000000000,
    candlesticks: [
      { open: 148.10, high: 151.20, low: 147.80, close: 150.25, volume: 45000000, date: '2024-01-15' },
      { open: 147.50, high: 149.80, low: 146.90, close: 148.10, volume: 42000000, date: '2024-01-14' },
      { open: 146.20, high: 148.50, low: 145.60, close: 147.50, volume: 38000000, date: '2024-01-13' },
      { open: 145.80, high: 147.20, low: 144.90, close: 146.20, volume: 35000000, date: '2024-01-12' },
      { open: 144.50, high: 146.10, low: 143.80, close: 145.80, volume: 32000000, date: '2024-01-11' },
    ]
  },
  { 
    symbol: 'GOOGL', 
    name: 'Alphabet Inc.', 
    currentPrice: 2750.80, 
    change: -15.20, 
    changePercent: -0.55, 
    volume: 18000000, 
    marketCap: 1850000000000,
    candlesticks: [
      { open: 2766.00, high: 2775.50, low: 2745.20, close: 2750.80, volume: 18000000, date: '2024-01-15' },
      { open: 2770.50, high: 2780.30, low: 2755.80, close: 2766.00, volume: 16500000, date: '2024-01-14' },
      { open: 2765.20, high: 2775.10, low: 2750.40, close: 2770.50, volume: 15000000, date: '2024-01-13' },
      { open: 2758.90, high: 2770.80, low: 2748.60, close: 2765.20, volume: 14000000, date: '2024-01-12' },
      { open: 2750.30, high: 2765.40, low: 2740.20, close: 2758.90, volume: 12500000, date: '2024-01-11' },
    ]
  },
  { 
    symbol: 'MSFT', 
    name: 'Microsoft Corp.', 
    currentPrice: 310.45, 
    change: 8.75, 
    changePercent: 2.90, 
    volume: 25000000, 
    marketCap: 2300000000000,
    candlesticks: [
      { open: 301.70, high: 312.80, low: 300.90, close: 310.45, volume: 25000000, date: '2024-01-15' },
      { open: 299.20, high: 303.50, low: 297.60, close: 301.70, volume: 22000000, date: '2024-01-14' },
      { open: 296.80, high: 300.20, low: 295.40, close: 299.20, volume: 20000000, date: '2024-01-13' },
      { open: 294.50, high: 297.90, low: 293.20, close: 296.80, volume: 18000000, date: '2024-01-12' },
      { open: 292.10, high: 295.60, low: 290.80, close: 294.50, volume: 16000000, date: '2024-01-11' },
    ]
  },
  { 
    symbol: 'TSLA', 
    name: 'Tesla Inc.', 
    currentPrice: 850.30, 
    change: 25.60, 
    changePercent: 3.10, 
    volume: 35000000, 
    marketCap: 850000000000,
    candlesticks: [
      { open: 824.70, high: 855.40, low: 820.30, close: 850.30, volume: 35000000, date: '2024-01-15' },
      { open: 815.20, high: 830.80, low: 810.50, close: 824.70, volume: 32000000, date: '2024-01-14' },
      { open: 808.90, high: 820.60, low: 805.20, close: 815.20, volume: 30000000, date: '2024-01-13' },
      { open: 800.50, high: 812.30, low: 798.40, close: 808.90, volume: 28000000, date: '2024-01-12' },
      { open: 795.20, high: 805.80, low: 792.60, close: 800.50, volume: 25000000, date: '2024-01-11' },
    ]
  },
  { 
    symbol: 'AMZN', 
    name: 'Amazon.com Inc.', 
    currentPrice: 3200.15, 
    change: -45.80, 
    changePercent: -1.41, 
    volume: 12000000, 
    marketCap: 1600000000000,
    candlesticks: [
      { open: 3245.95, high: 3255.60, low: 3190.20, close: 3200.15, volume: 12000000, date: '2024-01-15' },
      { open: 3260.30, high: 3270.80, low: 3235.40, close: 3245.95, volume: 11000000, date: '2024-01-14' },
      { open: 3275.60, high: 3285.20, low: 3250.80, close: 3260.30, volume: 10000000, date: '2024-01-13' },
      { open: 3280.90, high: 3290.50, low: 3265.30, close: 3275.60, volume: 9000000, date: '2024-01-12' },
      { open: 3295.20, high: 3305.80, low: 3280.60, close: 3280.90, volume: 8000000, date: '2024-01-11' },
    ]
  },
  { 
    symbol: 'NVDA', 
    name: 'NVIDIA Corp.', 
    currentPrice: 450.75, 
    change: 12.30, 
    changePercent: 2.80, 
    volume: 28000000, 
    marketCap: 1100000000000,
    candlesticks: [
      { open: 438.45, high: 455.80, low: 435.20, close: 450.75, volume: 28000000, date: '2024-01-15' },
      { open: 430.20, high: 442.60, low: 428.40, close: 438.45, volume: 25000000, date: '2024-01-14' },
      { open: 425.80, high: 435.20, low: 423.60, close: 430.20, volume: 23000000, date: '2024-01-13' },
      { open: 420.50, high: 428.90, low: 418.30, close: 425.80, volume: 21000000, date: '2024-01-12' },
      { open: 415.20, high: 423.60, low: 412.80, close: 420.50, volume: 19000000, date: '2024-01-11' },
    ]
  },
];

// Generate real stock data from game state
const generateRealStockData = (): Stock[] => {
  const stockSymbols = getAllStockSymbols();
  
  return stockSymbols.map(symbol => {
    const stockInfo = getStockInfo(symbol);
    const previousPrice = stockInfo.price * (1 + (Math.random() - 0.5) * 0.02); // Small variation for change calculation
    
    return {
      symbol,
      name: getStockName(symbol),
      currentPrice: stockInfo.price,
      change: stockInfo.price - previousPrice,
      changePercent: ((stockInfo.price - previousPrice) / previousPrice) * 100,
      volume: Math.floor(Math.random() * 10000000) + 1000000, // Random volume
      marketCap: stockInfo.price * (Math.floor(Math.random() * 1000000000) + 1000000000), // Random market cap
      candlesticks: generateCandlesticks(stockInfo.price),
    };
  });
};

// Helper function to get stock names
const getStockName = (symbol: string): string => {
  const names: Record<string, string> = {
    AAPL: 'Apple Inc.',
    GOOGL: 'Alphabet Inc.',
    MSFT: 'Microsoft Corp.',
    TSLA: 'Tesla Inc.',
    AMZN: 'Amazon.com Inc.',
    META: 'Meta Platforms Inc.',
    NVDA: 'NVIDIA Corp.',
    NFLX: 'Netflix Inc.',
    WMT: 'Walmart Inc.',
    JPM: 'JPMorgan Chase & Co.',
    JNJ: 'Johnson & Johnson',
    PG: 'Procter & Gamble Co.',
    KO: 'The Coca-Cola Co.',
    DIS: 'The Walt Disney Co.',
    V: 'Visa Inc.',
    MA: 'Mastercard Inc.',
    HD: 'The Home Depot Inc.',
    BA: 'The Boeing Co.',
    CAT: 'Caterpillar Inc.',
    IBM: 'International Business Machines Corp.',
  };
  return names[symbol] || `${symbol} Corp.`;
};

// Generate candlestick data
const generateCandlesticks = (currentPrice: number): Candlestick[] => {
  const candlesticks: Candlestick[] = [];
  let price = currentPrice;
  
  for (let i = 4; i >= 0; i--) {
    const open = price;
    const change = (Math.random() - 0.5) * 0.05; // 5% max change
    const close = open * (1 + change);
    const high = Math.max(open, close) * (1 + Math.random() * 0.02);
    const low = Math.min(open, close) * (1 - Math.random() * 0.02);
    
    candlesticks.push({
      open: Math.round(open * 100) / 100,
      high: Math.round(high * 100) / 100,
      low: Math.round(low * 100) / 100,
      close: Math.round(close * 100) / 100,
      volume: Math.floor(Math.random() * 50000000) + 10000000,
      date: new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    });
    
    price = close;
  }
  
  return candlesticks.reverse();
};

export default function StocksApp({ onBack }: StocksAppProps) {
  const { gameState, setGameState, saveGame } = useGame();
  const { settings } = gameState;
  const [activeTab, setActiveTab] = useState<'market' | 'portfolio' | 'watchlist'>('market');
  const [selectedStock, setSelectedStock] = useState<Stock | null>(null);
  const [shares, setShares] = useState('');
  const [showTradeModal, setShowTradeModal] = useState(false);
  const [tradeType, setTradeType] = useState<'buy' | 'sell'>('buy');
  const [isLoading, setIsLoading] = useState(false);
  const [inputMode, setInputMode] = useState<'shares' | 'money'>('shares');
  const [tradingLoading, setTradingLoading] = useState(false);

  // Ensure holdings are reactive to gameState changes
  const holdings: Holding[] = useMemo(() => gameState.stocks?.holdings || [], [gameState.stocks?.holdings]);
  const watchlist: string[] = useMemo(() => gameState.stocks?.watchlist || [], [gameState.stocks?.watchlist]);
  const realizedGains = useMemo(() => gameState.stocks?.realizedGains || 0, [gameState.stocks?.realizedGains]);
  const cash = gameState.stats?.money || 0;

  // Generate real stock data - this updates when week changes
  const stocks = useMemo(() => generateRealStockData(), [gameState.weeksLived]); // Re-generate when week changes
  
  // Portfolio value calculation - always use current stock prices, never fallback to holding.currentPrice
  const portfolioValue = useMemo(() => {
    return holdings.reduce((total, holding) => {
      const stock = stocks.find(s => s.symbol === holding.symbol);
      // Always use current stock price from the stocks array (which updates with week)
      // Only fallback to holding.currentPrice if stock not found (shouldn't happen)
      const currentPrice = stock?.currentPrice ?? holding.currentPrice ?? 0;
      return total + (holding.shares * currentPrice);
    }, 0);
  }, [holdings, stocks, gameState.weeksLived]); // Recalculate when week advances

  const totalInvested = useMemo(() => {
    return holdings.reduce((total, holding) => total + (holding.shares * holding.averagePrice), 0);
  }, [holdings]);

  // Total gain includes both unrealized gains (current holdings) and realized gains (sold shares)
  const unrealizedGain = useMemo(() => {
    return portfolioValue - totalInvested;
  }, [portfolioValue, totalInvested]);

  const totalGain = useMemo(() => {
    return unrealizedGain + realizedGains;
  }, [unrealizedGain, realizedGains]);

  const portfolioGainPercent = useMemo(() => {
    return totalInvested > 0 ? (unrealizedGain / totalInvested) * 100 : 0;
  }, [unrealizedGain, totalInvested]);

  const handleBuy = useCallback(async () => {
    if (!selectedStock || !shares || isNaN(Number(shares)) || Number(shares) <= 0) {
      Alert.alert('Invalid Input', `Please enter a valid ${inputMode === 'shares' ? 'number of shares' : 'amount of money'}.`);
      return;
    }

    setTradingLoading(true);
    try {
      // Simulate trading delay
      await new Promise(resolve => setTimeout(resolve, 800));

    let sharesToBuy: number;
    let totalCost: number;

    if (inputMode === 'shares') {
      sharesToBuy = Number(shares);
      totalCost = sharesToBuy * selectedStock.currentPrice;
    } else {
      totalCost = Number(shares);
      sharesToBuy = Math.floor(totalCost / selectedStock.currentPrice);
      
      if (sharesToBuy === 0) {
        Alert.alert('Invalid Amount', `You need at least ${formatMoney(selectedStock.currentPrice)} to buy 1 share.`);
        return;
      }
      
      // Recalculate total cost based on actual shares
      totalCost = sharesToBuy * selectedStock.currentPrice;
    }

    // ANTI-EXPLOIT: Apply 2% transaction fee on stock purchases (matches sell fee)
    const STOCK_BUY_FEE_RATE = 0.02;
    const buyCommission = Math.floor(totalCost * STOCK_BUY_FEE_RATE);
    const totalCostWithFee = totalCost + buyCommission;

    if (totalCostWithFee > cash) {
      Alert.alert('Insufficient Funds', `You need ${formatMoney(totalCostWithFee)} (includes ${formatMoney(buyCommission)} fee) but only have ${formatMoney(cash)}.`);
      return;
    }

    const existingHolding = holdings.find(h => h.symbol === selectedStock.symbol);
    let newHoldings: Holding[];

    if (existingHolding) {
      // Update existing holding
      const totalShares = existingHolding.shares + sharesToBuy;
      const totalCost = (existingHolding.shares * existingHolding.averagePrice) + (sharesToBuy * selectedStock.currentPrice);
      const newAveragePrice = totalCost / totalShares;

      newHoldings = holdings.map(h => 
        h.symbol === selectedStock.symbol 
          ? { ...h, shares: totalShares, averagePrice: newAveragePrice, currentPrice: selectedStock.currentPrice }
          : { ...h, currentPrice: stocks.find(s => s.symbol === h.symbol)?.currentPrice || h.currentPrice }
      );
    } else {
      // Add new holding
      newHoldings = [...holdings, {
        symbol: selectedStock.symbol,
        shares: sharesToBuy,
        averagePrice: selectedStock.currentPrice,
        currentPrice: selectedStock.currentPrice,
      }];
    }

    setGameState(prev => ({
      ...prev,
      updatedAt: Date.now(),
      stats: {
        ...prev.stats,
        money: Math.max(0, (prev.stats.money || 0) - totalCostWithFee),
      },
      stocks: { 
        holdings: newHoldings,
        watchlist: prev.stocks?.watchlist || [],
      },
    }));
    saveGame();

      Alert.alert('Purchase Successful', `Bought ${sharesToBuy} shares of ${selectedStock.symbol} for ${formatMoney(totalCostWithFee)} (${formatMoney(buyCommission)} fee).`);
      setShowTradeModal(false);
      setShares('');
      setSelectedStock(null);
    } catch (error) {
      Alert.alert('Trade Failed', 'Unable to complete the purchase. Please try again.');
    } finally {
      setTradingLoading(false);
    }
  }, [selectedStock, shares, inputMode, cash, holdings, setGameState, saveGame]);

  const handleSell = useCallback(() => {
    if (!selectedStock || !shares || isNaN(Number(shares)) || Number(shares) <= 0) {
      Alert.alert('Invalid Input', `Please enter a valid ${inputMode === 'shares' ? 'number of shares' : 'amount of money'}.`);
      return;
    }

    const existingHolding = holdings.find(h => h.symbol === selectedStock.symbol);
    if (!existingHolding) {
      Alert.alert('No Holdings', `You don't own any shares of ${selectedStock.symbol}.`);
      return;
    }

    let sharesToSell: number;
    let totalValue: number;

    if (inputMode === 'shares') {
      sharesToSell = Number(shares);
      if (existingHolding.shares < sharesToSell) {
        Alert.alert('Insufficient Shares', `You only have ${existingHolding.shares} shares of ${selectedStock.symbol}.`);
        return;
      }
      totalValue = sharesToSell * selectedStock.currentPrice;
    } else {
      totalValue = Number(shares);
      sharesToSell = Math.floor(totalValue / selectedStock.currentPrice);
      
      if (sharesToSell === 0) {
        Alert.alert('Invalid Amount', `You need at least ${formatMoney(selectedStock.currentPrice)} to sell 1 share.`);
        return;
      }
      
      if (existingHolding.shares < sharesToSell) {
        sharesToSell = existingHolding.shares; // Sell all available shares
        totalValue = sharesToSell * selectedStock.currentPrice;
      } else {
        totalValue = sharesToSell * selectedStock.currentPrice;
      }
    }

    const remainingShares = existingHolding.shares - sharesToSell;
    
    // ANTI-EXPLOIT: Apply 2% transaction fee on stock sales to prevent frictionless market timing
    const STOCK_TRANSACTION_FEE_RATE = 0.02;
    const transactionFee = Math.floor(totalValue * STOCK_TRANSACTION_FEE_RATE);
    const netProceeds = totalValue - transactionFee;

    // Calculate realized gain from this sale (based on net proceeds after fee)
    const costBasis = sharesToSell * existingHolding.averagePrice;
    const saleProceeds = netProceeds;
    const realizedGainFromSale = saleProceeds - costBasis;

    let newHoldings: Holding[];
    if (remainingShares > 0) {
      newHoldings = holdings.map(h => 
        h.symbol === selectedStock.symbol 
          ? { ...h, shares: remainingShares, currentPrice: selectedStock.currentPrice }
          : { ...h, currentPrice: stocks.find(s => s.symbol === h.symbol)?.currentPrice || h.currentPrice }
      );
    } else {
      newHoldings = holdings.filter(h => h.symbol !== selectedStock.symbol);
    }

    setGameState(prev => ({
      ...prev,
      updatedAt: Date.now(),
      stats: {
        ...prev.stats,
        money: (prev.stats.money || 0) + netProceeds,
      },
      stocks: { 
        holdings: newHoldings,
        watchlist: prev.stocks?.watchlist || [],
        realizedGains: (prev.stocks?.realizedGains || 0) + realizedGainFromSale,
      },
    }));
    saveGame();

    Alert.alert('Sale Successful', `Sold ${sharesToSell} shares of ${selectedStock.symbol} for ${formatMoney(netProceeds)} (${formatMoney(transactionFee)} fee).`);
    setShowTradeModal(false);
    setShares('');
    setSelectedStock(null);
  }, [selectedStock, shares, inputMode, holdings, stocks, setGameState, saveGame]);

  const toggleWatchlist = useCallback((symbol: string) => {
    const newWatchlist = watchlist.includes(symbol)
      ? watchlist.filter(s => s !== symbol)
      : [...watchlist, symbol];

         setGameState(prev => ({
       ...prev,
       updatedAt: Date.now(),
       stocks: { 
         holdings: prev.stocks?.holdings || [],
         watchlist: newWatchlist,
       },
     }));
    saveGame();
  }, [watchlist, setGameState, saveGame]);

  const openTradeModal = (stock: Stock, type: 'buy' | 'sell') => {
    setSelectedStock(stock);
    setTradeType(type);
    setShares('');
    setInputMode('shares'); // Reset to shares mode
    setShowTradeModal(true);
  };

  const handleMaxButton = () => {
    if (!selectedStock) return;

    if (tradeType === 'buy') {
      if (inputMode === 'shares') {
        const maxShares = Math.floor(cash / selectedStock.currentPrice);
        setShares(maxShares.toString());
      } else {
        setShares(cash.toString());
      }
    } else {
      // Sell mode
      const existingHolding = holdings.find(h => h.symbol === selectedStock.symbol);
      if (!existingHolding) return;

      if (inputMode === 'shares') {
        setShares(existingHolding.shares.toString());
      } else {
        const maxValue = existingHolding.shares * selectedStock.currentPrice;
        setShares(maxValue.toString());
      }
    }
  };

  const getHoldingShares = (symbol: string) => {
    const holding = holdings.find(h => h.symbol === symbol);
    return holding?.shares || 0;
  };

  const getHoldingValue = (symbol: string) => {
    const holding = holdings.find(h => h.symbol === symbol);
    const stock = stocks.find(s => s.symbol === symbol);
    return holding && stock ? holding.shares * stock.currentPrice : 0;
  };

  const darkMode = settings?.darkMode || false;

  return (
    <View style={[styles.container, darkMode && styles.containerDark]}>
      {/* Header */}
      <LinearGradient colors={darkMode ? ['#1F2937', '#111827'] as const : ['#FFFFFF', '#FAFBFC'] as const} style={[styles.header, darkMode && styles.headerDark]}>
        <TouchableOpacity style={[styles.backButton, darkMode && styles.backButtonDark]} onPress={onBack}>
          <ArrowLeft size={24} color={darkMode ? "#FFFFFF" : "#111827"} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, darkMode && styles.headerTitleDark]}>Stocks</Text>
        <InfoButton
          title="Stock Market Trading"
          content="Buy and sell stocks to grow your wealth! Stock prices fluctuate each week based on market conditions. Buy low, sell high to make profits. You can buy shares by quantity or by dollar amount. Higher stock prices mean more potential profit but also higher risk."
          size="small"
          darkMode={darkMode}
        />
      </LinearGradient>

      {/* Content */}
      <ScrollView 
        style={[styles.content, darkMode && styles.contentDark]} 
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={true}
      >
        {/* Portfolio Summary */}
        <View style={styles.summaryContainer}>
          <View style={[styles.summaryCard, darkMode && styles.summaryCardDark]}>
            <View style={styles.summaryRow}>
              <View style={styles.summaryItem}>
                <Text style={[styles.summaryLabel, darkMode && styles.summaryLabelDark]}>Portfolio Value</Text>
                <Text style={[styles.summaryValue, darkMode && styles.summaryValueDark]}>{formatMoney(portfolioValue)}</Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={[styles.summaryLabel, darkMode && styles.summaryLabelDark]}>Total Gain</Text>
                <Text style={[styles.summaryValue, totalGain >= 0 ? styles.positiveText : styles.negativeText]}>
                  {totalGain >= 0 ? '+' : ''}{formatMoney(totalGain)}
                </Text>
                <Text style={[styles.summarySubtext, darkMode && styles.summarySubtextDark, unrealizedGain >= 0 ? styles.positiveText : styles.negativeText]}>
                  {unrealizedGain >= 0 ? '+' : ''}{formatMoney(unrealizedGain)} unrealized
                  {realizedGains !== 0 && ` • ${realizedGains >= 0 ? '+' : ''}${formatMoney(realizedGains)} realized`}
                </Text>
              </View>
            </View>
            <View style={styles.summaryRow}>
              <View style={styles.summaryItem}>
                <Text style={[styles.summaryLabel, darkMode && styles.summaryLabelDark]}>Cash</Text>
                <Text style={[styles.summaryValue, darkMode && styles.summaryValueDark]}>{formatMoney(cash)}</Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={[styles.summaryLabel, darkMode && styles.summaryLabelDark]}>Holdings</Text>
                <Text style={[styles.summaryValue, darkMode && styles.summaryValueDark]}>{holdings.length}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Tabs */}
        <View style={[styles.tabContainer, darkMode && styles.tabContainerDark]}>
          <TouchableOpacity
            style={[styles.tab, darkMode && styles.tabDark, activeTab === 'market' && (darkMode ? styles.activeTabDark : styles.activeTab)]}
            onPress={() => setActiveTab('market')}
          >
            <BarChart3 size={20} color={activeTab === 'market' ? (darkMode ? '#FFFFFF' : '#111827') : (darkMode ? '#9CA3AF' : '#6B7280')} />
            <Text style={[styles.tabText, darkMode && styles.tabTextDark, activeTab === 'market' ? styles.tabTextActive : styles.tabTextInactive]}>
              Market
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, darkMode && styles.tabDark, activeTab === 'portfolio' && (darkMode ? styles.activeTabDark : styles.activeTab)]}
            onPress={() => setActiveTab('portfolio')}
          >
            <TrendingUp size={20} color={activeTab === 'portfolio' ? (darkMode ? '#FFFFFF' : '#111827') : (darkMode ? '#9CA3AF' : '#6B7280')} />
            <Text style={[styles.tabText, darkMode && styles.tabTextDark, activeTab === 'portfolio' ? styles.tabTextActive : styles.tabTextInactive]}>
              Portfolio
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, darkMode && styles.tabDark, activeTab === 'watchlist' && (darkMode ? styles.activeTabDark : styles.activeTab)]}
            onPress={() => setActiveTab('watchlist')}
          >
            <TrendingUp size={20} color={activeTab === 'watchlist' ? (darkMode ? '#FFFFFF' : '#111827') : (darkMode ? '#9CA3AF' : '#6B7280')} />
            <Text style={[styles.tabText, darkMode && styles.tabTextDark, activeTab === 'watchlist' ? styles.tabTextActive : styles.tabTextInactive]}>
              Watchlist
            </Text>
          </TouchableOpacity>
        </View>
        {activeTab === 'market' && (
          <View style={styles.stockList}>
            {stocks.map((stock) => (
              <View key={stock.symbol} style={[styles.stockCard, darkMode && styles.stockCardDark]}>
                <View style={styles.stockHeader}>
                  <View style={styles.stockInfo}>
                    <Text style={[styles.stockSymbol, darkMode && styles.stockSymbolDark]}>{stock.symbol}</Text>
                    <Text style={[styles.stockName, darkMode && styles.stockNameDark]}>{stock.name}</Text>
                    <Text style={[styles.holdingShares, darkMode && styles.holdingSharesDark]}>
                      {getHoldingShares(stock.symbol) > 0 ? `${getHoldingShares(stock.symbol)} shares owned` : 'Not owned'}
                    </Text>
                  </View>
                  <View style={styles.stockPrice}>
                    <Text style={[styles.priceText, darkMode && styles.priceTextDark]}>{formatMoney(stock.currentPrice)}</Text>
                    <Text style={[styles.changeText, stock.change >= 0 ? styles.positiveText : styles.negativeText]}>
                      {stock.change >= 0 ? '+' : ''}{formatMoney(stock.change)} ({stock.changePercent >= 0 ? '+' : ''}{stock.changePercent.toFixed(2)}%)
                    </Text>
                  </View>
                </View>
                <View style={styles.stockActions}>
                  <TouchableOpacity
                    style={[styles.actionButton, styles.actionButtonBuy]}
                    onPress={() => openTradeModal(stock, 'buy')}
                  >
                    <Plus size={16} color="#FFFFFF" />
                    <Text style={styles.actionButtonText}>Buy</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionButton, styles.actionButtonSell]}
                    onPress={() => openTradeModal(stock, 'sell')}
                  >
                    <Minus size={16} color="#FFFFFF" />
                    <Text style={styles.actionButtonText}>Sell</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.watchlistButton, darkMode && styles.watchlistButtonDark, watchlist.includes(stock.symbol) && styles.watchlistButtonActive]}
                    onPress={() => toggleWatchlist(stock.symbol)}
                  >
                    <Text style={[styles.watchlistButtonText, darkMode && styles.watchlistButtonTextDark, watchlist.includes(stock.symbol) && styles.watchlistButtonTextActive]}>
                      {watchlist.includes(stock.symbol) ? 'Watching' : 'Watch'}
                    </Text>
                  </TouchableOpacity>
                </View>

              </View>
            ))}
          </View>
        )}

        {activeTab === 'portfolio' && (
          <View style={styles.stockList}>
            {holdings.length === 0 ? (
              <EmptyState icon="📈" title="No Investments Yet" description="Start building your portfolio by buying stocks from the market." darkMode={settings?.darkMode ?? true} />
            ) : (
              holdings.map((holding) => {
                const stock = stocks.find(s => s.symbol === holding.symbol);
                if (!stock) return null;
                
                const currentValue = holding.shares * stock.currentPrice;
                const totalCost = holding.shares * holding.averagePrice;
                const gain = currentValue - totalCost;
                const gainPercent = (gain / totalCost) * 100;

                return (
                  <View key={holding.symbol} style={[styles.stockCard, darkMode && styles.stockCardDark]}>
                    <View style={styles.stockHeader}>
                      <View style={styles.stockInfo}>
                        <Text style={[styles.stockSymbol, darkMode && styles.stockSymbolDark]}>{holding.symbol}</Text>
                        <Text style={[styles.stockName, darkMode && styles.stockNameDark]}>{stock.name}</Text>
                        <Text style={[styles.holdingShares, darkMode && styles.holdingSharesDark]}>{holding.shares} shares @ {formatMoney(holding.averagePrice)}</Text>
                      </View>
                      <View style={styles.stockPrice}>
                        <Text style={[styles.priceText, darkMode && styles.priceTextDark]}>{formatMoney(currentValue)}</Text>
                        <Text style={[styles.changeText, gain >= 0 ? styles.positiveText : styles.negativeText]}>
                          {gain >= 0 ? '+' : ''}{formatMoney(gain)} ({gainPercent >= 0 ? '+' : ''}{gainPercent.toFixed(2)}%)
                        </Text>
                      </View>
                    </View>
                    <View style={styles.stockActions}>
                      <TouchableOpacity
                        style={[styles.actionButton, styles.actionButtonBuy]}
                        onPress={() => openTradeModal(stock, 'buy')}
                      >
                        <Plus size={16} color="#FFFFFF" />
                        <Text style={styles.actionButtonText}>Buy More</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.actionButton, styles.actionButtonSell]}
                        onPress={() => openTradeModal(stock, 'sell')}
                      >
                        <Minus size={16} color="#FFFFFF" />
                        <Text style={styles.actionButtonText}>Sell</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })
            )}
          </View>
        )}

        {activeTab === 'watchlist' && (
          <View style={styles.stockList}>
            {watchlist.length === 0 ? (
              <EmptyState icon="👀" title="No Watchlist Items" description="Add stocks to your watchlist to track their performance." darkMode={settings?.darkMode ?? true} />
            ) : (
              stocks
                .filter(stock => watchlist.includes(stock.symbol))
                .map((stock) => (
                  <View key={stock.symbol} style={[styles.stockCard, darkMode && styles.stockCardDark]}>
                    <View style={styles.stockHeader}>
                      <View style={styles.stockInfo}>
                        <Text style={[styles.stockSymbol, darkMode && styles.stockSymbolDark]}>{stock.symbol}</Text>
                        <Text style={[styles.stockName, darkMode && styles.stockNameDark]}>{stock.name}</Text>
                        <Text style={[styles.holdingShares, darkMode && styles.holdingSharesDark]}>
                          {getHoldingShares(stock.symbol) > 0 ? `${getHoldingShares(stock.symbol)} shares owned` : 'Not owned'}
                        </Text>
                      </View>
                      <View style={styles.stockPrice}>
                        <Text style={[styles.priceText, darkMode && styles.priceTextDark]}>{formatMoney(stock.currentPrice)}</Text>
                        <Text style={[styles.changeText, stock.change >= 0 ? styles.positiveText : styles.negativeText]}>
                          {stock.change >= 0 ? '+' : ''}{formatMoney(stock.change)} ({stock.changePercent >= 0 ? '+' : ''}{stock.changePercent.toFixed(2)}%)
                        </Text>
                      </View>
                    </View>
                    <View style={styles.stockActions}>
                      <TouchableOpacity
                        style={[styles.actionButton, styles.actionButtonBuy]}
                        onPress={() => openTradeModal(stock, 'buy')}
                      >
                        <Plus size={16} color="#FFFFFF" />
                        <Text style={styles.actionButtonText}>Buy</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.actionButton, styles.actionButtonSell]}
                        onPress={() => openTradeModal(stock, 'sell')}
                      >
                        <Minus size={16} color="#FFFFFF" />
                        <Text style={styles.actionButtonText}>Sell</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.watchlistButton, darkMode && styles.watchlistButtonDark, styles.watchlistButtonActive]}
                        onPress={() => toggleWatchlist(stock.symbol)}
                      >
                        <Text style={[styles.watchlistButtonText, darkMode && styles.watchlistButtonTextDark, styles.watchlistButtonTextActive]}>
                          Remove
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))
            )}
          </View>
        )}
      </ScrollView>

      {/* Trade Modal - Beautiful Redesign */}
      <Modal visible={showTradeModal} transparent animationType="fade">
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <KeyboardAvoidingView 
            style={styles.modalBackdrop}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
          >
            <TouchableWithoutFeedback onPress={() => {}}>
              <View style={[styles.modalCard, darkMode && styles.modalCardDark]}>
                <ScrollView 
                  contentContainerStyle={styles.modalScrollContent}
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator={true}
                  bounces={false}
                >
                  {/* Header */}
                  <View style={styles.modalHeader}>
                    <View style={styles.modalHeaderContent}>
                      <Text style={[styles.modalTitle, darkMode && styles.modalTitleDark]}>
                        {tradeType === 'buy' ? 'Buy' : 'Sell'} {selectedStock?.symbol}
                      </Text>
                      <Text style={[styles.modalSubtitle, darkMode && styles.modalSubtitleDark]}>
                        {selectedStock?.name}
                      </Text>
                    </View>
                    <TouchableOpacity 
                      style={[styles.modalCloseButton, darkMode && styles.modalCloseButtonDark]}
                      onPress={() => {
                        Keyboard.dismiss();
                        setShowTradeModal(false);
                      }}
                    >
                      <Text style={[styles.modalCloseText, darkMode && styles.modalCloseTextDark]}>×</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Price Display */}
                  <View style={[styles.modalPriceCard, darkMode && styles.modalPriceCardDark]}>
                    <Text style={[styles.modalPriceLabel, darkMode && styles.modalPriceLabelDark]}>Current Price</Text>
                    <Text style={[styles.modalPriceValue, darkMode && styles.modalPriceValueDark]}>
                      {formatMoney(selectedStock?.currentPrice || 0)}
                    </Text>
                    {tradeType === 'sell' && (() => {
                      const holding = holdings.find(h => h.symbol === selectedStock?.symbol);
                      if (!holding) return null;
                      const avgPrice = holding.averagePrice;
                      const priceDiff = (selectedStock?.currentPrice || 0) - avgPrice;
                      const priceDiffPercent = (priceDiff / avgPrice) * 100;
                      return (
                        <View style={styles.modalPriceInfo}>
                          <Text style={[styles.modalPriceInfoText, darkMode && styles.modalPriceInfoTextDark]}>
                            Avg: {formatMoney(avgPrice)} • 
                            <Text style={priceDiff >= 0 ? styles.positiveText : styles.negativeText}>
                              {' '}{priceDiff >= 0 ? '+' : ''}{priceDiffPercent.toFixed(2)}%
                            </Text>
                          </Text>
                        </View>
                      );
                    })()}
                  </View>

                  {/* Input Mode Toggle */}
                  <View style={[styles.inputModeContainer, darkMode && styles.inputModeContainerDark]}>
                    <TouchableOpacity
                      style={[styles.inputModeButton, darkMode && styles.inputModeButtonDark, inputMode === 'shares' && styles.inputModeButtonActive]}
                      onPress={() => setInputMode('shares')}
                    >
                      <Text style={[styles.inputModeText, darkMode && styles.inputModeTextDark, inputMode === 'shares' && styles.inputModeTextActive]}>
                        Shares
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.inputModeButton, darkMode && styles.inputModeButtonDark, inputMode === 'money' && styles.inputModeButtonActive]}
                      onPress={() => setInputMode('money')}
                    >
                      <Text style={[styles.inputModeText, darkMode && styles.inputModeTextDark, inputMode === 'money' && styles.inputModeTextActive]}>
                        Amount
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {/* Input Section */}
                  <View style={styles.modalInputSection}>
                    <View style={styles.inputRow}>
                      <View style={styles.inputContainer}>
                        <Text style={[styles.inputLabel, darkMode && styles.inputLabelDark]}>
                          {inputMode === 'shares' ? 'Number of Shares' : 'Amount'}
                        </Text>
                        <TextInput
                          style={[styles.modalInput, darkMode && styles.modalInputDark]}
                          value={shares}
                          onChangeText={setShares}
                          placeholder="0"
                          placeholderTextColor={darkMode ? "#6B7280" : "#9CA3AF"}
                          keyboardType="numeric"
                          returnKeyType="done"
                          onSubmitEditing={Keyboard.dismiss}
                        />
                      </View>
                      <TouchableOpacity 
                        style={[styles.maxButton, darkMode && styles.maxButtonDark]} 
                        onPress={handleMaxButton}
                      >
                        <Text style={styles.maxButtonText}>Max</Text>
                      </TouchableOpacity>
                    </View>
                    
                    {/* Calculation Display */}
                    {shares && !isNaN(Number(shares)) && Number(shares) > 0 && (
                      <View style={[styles.calculationCard, darkMode && styles.calculationCardDark]}>
                        {inputMode === 'shares' ? (
                          <>
                            <View style={styles.calculationRow}>
                              <Text style={[styles.calculationLabel, darkMode && styles.calculationLabelDark]}>Total Cost</Text>
                              <Text style={[styles.calculationValue, darkMode && styles.calculationValueDark]}>
                                {formatMoney(Number(shares) * (selectedStock?.currentPrice || 0))}
                              </Text>
                            </View>
                            {tradeType === 'buy' && Number(shares) * (selectedStock?.currentPrice || 0) > cash && (
                              <Text style={styles.insufficientFundsText}>
                                Insufficient funds. You have {formatMoney(cash)}.
                              </Text>
                            )}
                          </>
                        ) : (
                          <>
                            <View style={styles.calculationRow}>
                              <Text style={[styles.calculationLabel, darkMode && styles.calculationLabelDark]}>Shares</Text>
                              <Text style={[styles.calculationValue, darkMode && styles.calculationValueDark]}>
                                {Math.floor(Number(shares) / (selectedStock?.currentPrice || 1))}
                              </Text>
                            </View>
                            {tradeType === 'sell' && (() => {
                              const holding = holdings.find(h => h.symbol === selectedStock?.symbol);
                              const sharesToSell = Math.floor(Number(shares) / (selectedStock?.currentPrice || 1));
                              if (holding && sharesToSell > holding.shares) {
                                return (
                                  <Text style={styles.insufficientFundsText}>
                                    You only have {holding.shares} shares.
                                  </Text>
                                );
                              }
                              return null;
                            })()}
                          </>
                        )}
                      </View>
                    )}
                  </View>

                  {/* Action Buttons */}
                  <View style={styles.modalActions}>
                    <TouchableOpacity
                      style={[styles.modalCancelButton, darkMode && styles.modalCancelButtonDark]}
                      onPress={() => {
                        Keyboard.dismiss();
                        setShowTradeModal(false);
                      }}
                    >
                      <Text style={[styles.modalCancelText, darkMode && styles.modalCancelTextDark]}>Cancel</Text>
                    </TouchableOpacity>
                    <LoadingButton
                      onPress={tradeType === 'buy' ? handleBuy : handleSell}
                      title={tradeType === 'buy' ? 'Buy' : 'Sell'}
                      loading={tradingLoading}
                      variant={tradeType === 'buy' ? 'success' : 'danger'}
                      size="medium"
                      style={[styles.modalConfirmButton, tradeType === 'buy' ? styles.modalConfirmButtonBuy : styles.modalConfirmButtonSell]}
                      loadingText={tradeType === 'buy' ? 'Buying...' : 'Selling...'}
                    />
                  </View>
                </ScrollView>
              </View>
            </TouchableWithoutFeedback>
          </KeyboardAvoidingView>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  containerDark: {
    backgroundColor: '#0F172A',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 16,
    paddingHorizontal: 16,
    paddingBottom: 10,
    borderBottomColor: 'rgba(0,0,0,0.04)',
    borderBottomWidth: 1,
    shadowColor: 'rgba(0,0,0,0.06)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 4,
    elevation: 2,
  },
  headerDark: {
    backgroundColor: '#0F172A',
    borderBottomColor: 'rgba(255,255,255,0.1)',
    shadowColor: 'transparent',
    elevation: 0,
  },
  headerTitle: {
    color: '#111827',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  headerTitleDark: {
    color: '#FFFFFF',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButtonDark: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderColor: 'rgba(255,255,255,0.1)',
  },
  headerSpacer: {
    width: 40,
  },
  summaryContainer: {
    padding: 16,
  },
  summaryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    borderColor: 'rgba(0,0,0,0.06)',
    borderWidth: 1,
    shadowColor: 'rgba(0,0,0,0.04)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 4,
    elevation: 2,
  },
  summaryCardDark: {
    backgroundColor: '#1F2937',
    borderColor: '#374151',
    shadowColor: 'transparent',
    elevation: 0,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  summaryItem: {
    flex: 1,
  },
  summaryLabel: {
    color: '#6B7280',
    fontSize: 12,
    marginBottom: 4,
  },
  summaryLabelDark: {
    color: '#9CA3AF',
  },
  summaryValue: {
    color: '#111827',
    fontSize: 16,
    fontWeight: '700',
  },
  summaryValueDark: {
    color: '#FFFFFF',
  },
  summarySubtext: {
    color: '#6B7280',
    fontSize: 11,
    marginTop: 2,
  },
  summarySubtextDark: {
    color: '#9CA3AF',
  },
  positiveText: {
    color: '#10B981',
  },
  negativeText: {
    color: '#EF4444',
  },
  tabContainer: {
    marginHorizontal: 16,
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    borderColor: 'rgba(0,0,0,0.06)',
    borderWidth: 1,
    flexDirection: 'row',
    padding: 6,
    gap: 6,
    marginBottom: 16,
  },
  tabContainerDark: {
    backgroundColor: '#1F2937',
    borderColor: '#374151',
  },
  tab: {
    flex: 1,
    height: 50,
    borderRadius: 8,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  tabDark: {
    backgroundColor: 'transparent',
  },
  activeTab: {
    backgroundColor: '#FFFFFF',
    shadowColor: 'rgba(0,0,0,0.1)',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 1,
    shadowRadius: 2,
    elevation: 2,
  },
  activeTabDark: {
    backgroundColor: '#374151',
    shadowColor: 'rgba(0,0,0,0.3)',
  },
  tabText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#6B7280',
  },
  tabTextDark: {
    color: '#9CA3AF',
  },
  tabTextActive: {
    color: '#111827',
  },
  tabTextInactive: {
    color: '#6B7280',
  },
  content: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  contentDark: {
    backgroundColor: '#0F172A',
  },
  contentContainer: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  stockList: {
    gap: 12,
    paddingBottom: 20,
  },
  stockCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    borderColor: 'rgba(0,0,0,0.06)',
    borderWidth: 1,
    shadowColor: 'rgba(0,0,0,0.04)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 4,
    elevation: 2,
  },
  stockCardDark: {
    backgroundColor: '#1F2937',
    borderColor: '#374151',
    shadowColor: 'transparent',
    elevation: 0,
  },
  stockHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  stockInfo: {
    flex: 1,
  },
  stockSymbol: {
    color: '#111827',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 2,
  },
  stockSymbolDark: {
    color: '#FFFFFF',
  },
  stockName: {
    color: '#6B7280',
    fontSize: 14,
    marginBottom: 4,
  },
  stockNameDark: {
    color: '#D1D5DB',
  },
  holdingShares: {
    color: '#9CA3AF',
    fontSize: 12,
  },
  holdingSharesDark: {
    color: '#9CA3AF',
  },
  stockPrice: {
    alignItems: 'flex-end',
  },
  priceText: {
    color: '#111827',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
  },
  priceTextDark: {
    color: '#FFFFFF',
  },
  changeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  stockActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    flex: 1,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 4,
  },
  actionButtonBuy: {
    backgroundColor: '#10B981',
  },
  actionButtonSell: {
    backgroundColor: '#EF4444',
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  watchlistButton: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderColor: 'rgba(0,0,0,0.1)',
    borderWidth: 1,
  },
  watchlistButtonDark: {
    backgroundColor: '#374151',
    borderColor: '#4B5563',
  },
  watchlistButtonActive: {
    backgroundColor: '#DBEAFE',
    borderColor: '#3B82F6',
  },
  watchlistButtonText: {
    color: '#6B7280',
    fontSize: 12,
    fontWeight: '600',
  },
  watchlistButtonTextDark: {
    color: '#9CA3AF',
  },
  watchlistButtonTextActive: {
    color: '#3B82F6',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  emptyStateText: {
    color: '#6B7280',
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 22,
  },
  emptyStateTextDark: {
    color: '#9CA3AF',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
  },
  modalScrollContent: {
    padding: 24,
  },
  modalCard: {
    width: '95%',
    maxWidth: '95%',
    maxHeight: '90%',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 0,
    shadowColor: 'rgba(0,0,0,0.2)',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 1,
    shadowRadius: 24,
    elevation: 8,
    overflow: 'hidden',
  },
  modalCardDark: {
    backgroundColor: '#1F2937',
    shadowColor: 'rgba(0,0,0,0.5)',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  modalHeaderContent: {
    flex: 1,
  },
  modalTitle: {
    color: '#111827',
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 4,
  },
  modalTitleDark: {
    color: '#FFFFFF',
  },
  modalSubtitle: {
    color: '#6B7280',
    fontSize: 14,
  },
  modalSubtitleDark: {
    color: '#9CA3AF',
  },
  modalCloseButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCloseButtonDark: {
    backgroundColor: '#374151',
  },
  modalCloseText: {
    color: '#6B7280',
    fontSize: 24,
    lineHeight: 28,
  },
  modalCloseTextDark: {
    color: '#9CA3AF',
  },
  modalPriceCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
  },
  modalPriceCardDark: {
    backgroundColor: '#111827',
    borderColor: '#374151',
  },
  modalPriceLabel: {
    color: '#6B7280',
    fontSize: 12,
    marginBottom: 4,
  },
  modalPriceLabelDark: {
    color: '#9CA3AF',
  },
  modalPriceValue: {
    color: '#111827',
    fontSize: 28,
    fontWeight: '800',
  },
  modalPriceValueDark: {
    color: '#FFFFFF',
  },
  modalPriceInfo: {
    marginTop: 8,
  },
  modalPriceInfoText: {
    color: '#6B7280',
    fontSize: 12,
  },
  modalPriceInfoTextDark: {
    color: '#9CA3AF',
  },
  modalInputSection: {
    marginBottom: 20,
  },
  inputLabel: {
    color: '#6B7280',
    fontSize: 12,
    marginBottom: 8,
    fontWeight: '600',
  },
  inputLabelDark: {
    color: '#9CA3AF',
  },
  modalInput: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: '#111827',
    borderWidth: 2,
    borderColor: '#E5E7EB',
    fontSize: 18,
    fontWeight: '600',
  },
  modalInputDark: {
    backgroundColor: '#111827',
    borderColor: '#374151',
    color: '#FFFFFF',
  },
  calculationCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 12,
    marginTop: 12,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
  },
  calculationCardDark: {
    backgroundColor: '#111827',
    borderColor: '#374151',
  },
  calculationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  calculationLabel: {
    color: '#6B7280',
    fontSize: 14,
  },
  calculationLabelDark: {
    color: '#9CA3AF',
  },
  calculationValue: {
    color: '#111827',
    fontSize: 16,
    fontWeight: '700',
  },
  calculationValueDark: {
    color: '#FFFFFF',
  },
  insufficientFundsText: {
    color: '#EF4444',
    fontSize: 12,
    marginTop: 8,
  },
  inputModeContainer: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    padding: 4,
    marginBottom: 20,
  },
  inputModeContainerDark: {
    backgroundColor: '#111827',
  },
  inputModeButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  inputModeButtonDark: {
    backgroundColor: 'transparent',
  },
  inputModeButtonActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: 'rgba(0,0,0,0.1)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 4,
    elevation: 2,
  },
  inputModeText: {
    color: '#6B7280',
    fontSize: 14,
    fontWeight: '600',
  },
  inputModeTextDark: {
    color: '#9CA3AF',
  },
  inputModeTextActive: {
    color: '#111827',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 12,
  },
  inputContainer: {
    flex: 1,
  },
  maxButton: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 12,
    minWidth: 70,
    alignItems: 'center',
    justifyContent: 'center',
  },
  maxButtonDark: {
    backgroundColor: '#2563EB',
  },
  maxButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  modalCancelButton: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
  },
  modalCancelButtonDark: {
    backgroundColor: '#374151',
    borderColor: '#4B5563',
  },
  modalCancelText: {
    color: '#6B7280',
    fontWeight: '700',
    fontSize: 16,
  },
  modalCancelTextDark: {
    color: '#9CA3AF',
  },
  modalConfirmButton: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalConfirmButtonBuy: {
    backgroundColor: '#10B981',
  },
  modalConfirmButtonSell: {
    backgroundColor: '#EF4444',
  },
});
