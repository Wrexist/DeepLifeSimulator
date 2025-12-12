import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Alert, ScrollView, Modal } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowLeft, TrendingUp, TrendingDown, DollarSign, BarChart3, Plus, Minus, RefreshCw } from 'lucide-react-native';
import { useGame } from '@/contexts/GameContext';
import LoadingButton from '@/components/ui/LoadingButton';
import InfoButton from '@/components/ui/InfoButton';
import { SkeletonLoader, SkeletonList } from '@/components/ui/SkeletonLoader';
import { EmptyPortfolio } from '@/components/ui/EmptyState';
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
  const { gameState, setGameState, saveGame, updateMoney } = useGame();
  const { settings } = gameState;
  const [activeTab, setActiveTab] = useState<'market' | 'portfolio' | 'watchlist'>('market');
  const [selectedStock, setSelectedStock] = useState<Stock | null>(null);
  const [shares, setShares] = useState('');
  const [showTradeModal, setShowTradeModal] = useState(false);
  const [tradeType, setTradeType] = useState<'buy' | 'sell'>('buy');
  const [isLoading, setIsLoading] = useState(false);
  const [inputMode, setInputMode] = useState<'shares' | 'money'>('shares');
  const [tradingLoading, setTradingLoading] = useState(false);

  const holdings: Holding[] = gameState.stocks?.holdings || [];
  const watchlist: string[] = gameState.stocks?.watchlist || [];
  const cash = gameState.stats?.money || 0;

  // Generate real stock data
  const stocks = useMemo(() => generateRealStockData(), [gameState.week]); // Re-generate when week changes
  
  const portfolioValue = useMemo(() => {
    return holdings.reduce((total, holding) => {
      const stock = stocks.find(s => s.symbol === holding.symbol);
      return total + (holding.shares * (stock?.currentPrice || holding.currentPrice));
    }, 0);
  }, [holdings, stocks]);

  const totalInvested = useMemo(() => {
    return holdings.reduce((total, holding) => total + (holding.shares * holding.averagePrice), 0);
  }, [holdings]);

  const portfolioGain = portfolioValue - totalInvested;
  const portfolioGainPercent = totalInvested > 0 ? (portfolioGain / totalInvested) * 100 : 0;

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

    if (totalCost > cash) {
      Alert.alert('Insufficient Funds', `You need ${formatMoney(totalCost)} but only have ${formatMoney(cash)}.`);
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

             // Use centralized money handling - don't update dailySummary for stock purchases
    updateMoney(-totalCost, `Buy ${sharesToBuy} shares of ${selectedStock.symbol}`, false);
    
    setGameState(prev => ({
      ...prev,
      stocks: { 
        holdings: newHoldings,
        watchlist: prev.stocks?.watchlist || [],
      },
    }));
    saveGame();

      Alert.alert('Purchase Successful', `Bought ${sharesToBuy} shares of ${selectedStock.symbol} for ${formatMoney(totalCost)}.`);
      setShowTradeModal(false);
      setShares('');
      setSelectedStock(null);
    } catch (error) {
      Alert.alert('Trade Failed', 'Unable to complete the purchase. Please try again.');
    } finally {
      setTradingLoading(false);
    }
  }, [selectedStock, shares, inputMode, cash, holdings, setGameState, saveGame, updateMoney]);

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

    // Use centralized money handling - don't update dailySummary for stock sales
    updateMoney(totalValue, `Sell ${sharesToSell} shares of ${selectedStock.symbol}`, false);
    
    setGameState(prev => ({
      ...prev,
      stocks: { 
        holdings: newHoldings,
        watchlist: prev.stocks?.watchlist || [],
      },
    }));
    saveGame();

    Alert.alert('Sale Successful', `Sold ${sharesToSell} shares of ${selectedStock.symbol} for ${formatMoney(totalValue)}.`);
    setShowTradeModal(false);
    setShares('');
    setSelectedStock(null);
  }, [selectedStock, shares, inputMode, holdings, cash, setGameState, saveGame]);

  const toggleWatchlist = useCallback((symbol: string) => {
    const newWatchlist = watchlist.includes(symbol)
      ? watchlist.filter(s => s !== symbol)
      : [...watchlist, symbol];

         setGameState(prev => ({
       ...prev,
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

  return (
    <View style={styles.container}>
      {/* Header */}
      <LinearGradient colors={['#10B981', '#059669']} style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <ArrowLeft size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Stocks</Text>
        <InfoButton
          title="Stock Market Trading"
          content="Buy and sell stocks to grow your wealth! Stock prices fluctuate each week based on market conditions. Buy low, sell high to make profits. You can buy shares by quantity or by dollar amount. Higher stock prices mean more potential profit but also higher risk."
          size="small"
          darkMode={true}
        />
      </LinearGradient>

      {/* Content */}
      <ScrollView 
        style={styles.content} 
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={true}
      >
        {/* Portfolio Summary */}
        <View style={styles.summaryContainer}>
          <View style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>Portfolio Value</Text>
                <Text style={styles.summaryValue}>{formatMoney(portfolioValue)}</Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>Total Gain</Text>
                <Text style={[styles.summaryValue, portfolioGain >= 0 ? styles.positiveText : styles.negativeText]}>
                  {portfolioGain >= 0 ? '+' : ''}{formatMoney(portfolioGain)} ({portfolioGainPercent >= 0 ? '+' : ''}{portfolioGainPercent.toFixed(2)}%)
                </Text>
              </View>
            </View>
            <View style={styles.summaryRow}>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>Cash</Text>
                <Text style={styles.summaryValue}>{formatMoney(cash)}</Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>Holdings</Text>
                <Text style={styles.summaryValue}>{holdings.length}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Tabs */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'market' && styles.activeTab]}
            onPress={() => setActiveTab('market')}
          >
            <BarChart3 size={20} color={activeTab === 'market' ? '#FFFFFF' : (settings?.darkMode ? '#FFFFFF' : '#6B7280')} />
            <Text style={[styles.tabText, activeTab === 'market' ? styles.tabTextActive : (settings?.darkMode ? styles.tabTextInactiveDark : styles.tabTextInactive)]}>
              Market
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'portfolio' && styles.activeTab]}
            onPress={() => setActiveTab('portfolio')}
          >
            <TrendingUp size={20} color={activeTab === 'portfolio' ? '#FFFFFF' : (settings?.darkMode ? '#FFFFFF' : '#6B7280')} />
            <Text style={[styles.tabText, activeTab === 'portfolio' ? styles.tabTextActive : (settings?.darkMode ? styles.tabTextInactiveDark : styles.tabTextInactive)]}>
              Portfolio
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'watchlist' && styles.activeTab]}
            onPress={() => setActiveTab('watchlist')}
          >
            <TrendingUp size={20} color={activeTab === 'watchlist' ? '#FFFFFF' : (settings?.darkMode ? '#FFFFFF' : '#6B7280')} />
            <Text style={[styles.tabText, activeTab === 'watchlist' ? styles.tabTextActive : (settings?.darkMode ? styles.tabTextInactiveDark : styles.tabTextInactive)]}>
              Watchlist
            </Text>
          </TouchableOpacity>
        </View>
        {activeTab === 'market' && (
          <View style={styles.stockList}>
            {stocks.map((stock) => (
              <View key={stock.symbol} style={styles.stockCard}>
                <View style={styles.stockHeader}>
                                     <View style={styles.stockInfo}>
                     <Text style={styles.stockSymbol}>{stock.symbol}</Text>
                     <Text style={styles.stockName}>{stock.name}</Text>
                     <Text style={styles.holdingShares}>
                       {getHoldingShares(stock.symbol) > 0 ? `${getHoldingShares(stock.symbol)} shares owned` : 'Not owned'}
                     </Text>
                   </View>
                  <View style={styles.stockPrice}>
                    <Text style={styles.priceText}>{formatMoney(stock.currentPrice)}</Text>
                    <Text style={[styles.changeText, stock.change >= 0 ? styles.positiveText : styles.negativeText]}>
                      {stock.change >= 0 ? '+' : ''}{formatMoney(stock.change)} ({stock.changePercent >= 0 ? '+' : ''}{stock.changePercent.toFixed(2)}%)
                    </Text>
                  </View>
                </View>
                <View style={styles.stockActions}>
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => openTradeModal(stock, 'buy')}
                  >
                    <Plus size={16} color="#FFFFFF" />
                    <Text style={styles.actionButtonText}>Buy</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => openTradeModal(stock, 'sell')}
                  >
                    <Minus size={16} color="#FFFFFF" />
                    <Text style={styles.actionButtonText}>Sell</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.watchlistButton, watchlist.includes(stock.symbol) && styles.watchlistButtonActive]}
                    onPress={() => toggleWatchlist(stock.symbol)}
                  >
                    <Text style={[styles.watchlistButtonText, watchlist.includes(stock.symbol) && styles.watchlistButtonTextActive]}>
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
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateText}>No holdings yet. Start investing in the Market tab!</Text>
              </View>
            ) : (
              holdings.map((holding) => {
                const stock = stocks.find(s => s.symbol === holding.symbol);
                if (!stock) return null;
                
                const currentValue = holding.shares * stock.currentPrice;
                const totalCost = holding.shares * holding.averagePrice;
                const gain = currentValue - totalCost;
                const gainPercent = (gain / totalCost) * 100;

                return (
                  <View key={holding.symbol} style={styles.stockCard}>
                    <View style={styles.stockHeader}>
                      <View style={styles.stockInfo}>
                        <Text style={styles.stockSymbol}>{holding.symbol}</Text>
                        <Text style={styles.stockName}>{stock.name}</Text>
                        <Text style={styles.holdingShares}>{holding.shares} shares @ {formatMoney(holding.averagePrice)}</Text>
                      </View>
                      <View style={styles.stockPrice}>
                        <Text style={styles.priceText}>{formatMoney(currentValue)}</Text>
                        <Text style={[styles.changeText, gain >= 0 ? styles.positiveText : styles.negativeText]}>
                          {gain >= 0 ? '+' : ''}{formatMoney(gain)} ({gainPercent >= 0 ? '+' : ''}{gainPercent.toFixed(2)}%)
                        </Text>
                      </View>
                    </View>
                    <View style={styles.stockActions}>
                      <TouchableOpacity
                        style={styles.actionButton}
                        onPress={() => openTradeModal(stock, 'buy')}
                      >
                        <Plus size={16} color="#FFFFFF" />
                        <Text style={styles.actionButtonText}>Buy More</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.actionButton}
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
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateText}>No stocks in watchlist. Add some from the Market tab!</Text>
              </View>
            ) : (
              stocks
                .filter(stock => watchlist.includes(stock.symbol))
                .map((stock) => (
                  <View key={stock.symbol} style={styles.stockCard}>
                    <View style={styles.stockHeader}>
                      <View style={styles.stockInfo}>
                        <Text style={styles.stockSymbol}>{stock.symbol}</Text>
                        <Text style={styles.stockName}>{stock.name}</Text>
                        <Text style={styles.holdingShares}>
                          {getHoldingShares(stock.symbol) > 0 ? `${getHoldingShares(stock.symbol)} shares owned` : 'Not owned'}
                        </Text>
                      </View>
                      <View style={styles.stockPrice}>
                        <Text style={styles.priceText}>{formatMoney(stock.currentPrice)}</Text>
                        <Text style={[styles.changeText, stock.change >= 0 ? styles.positiveText : styles.negativeText]}>
                          {stock.change >= 0 ? '+' : ''}{formatMoney(stock.change)} ({stock.changePercent >= 0 ? '+' : ''}{stock.changePercent.toFixed(2)}%)
                        </Text>
                      </View>
                    </View>
                    <View style={styles.stockActions}>
                      <TouchableOpacity
                        style={styles.actionButton}
                        onPress={() => openTradeModal(stock, 'buy')}
                      >
                        <Plus size={16} color="#FFFFFF" />
                        <Text style={styles.actionButtonText}>Buy</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.actionButton}
                        onPress={() => openTradeModal(stock, 'sell')}
                      >
                        <Minus size={16} color="#FFFFFF" />
                        <Text style={styles.actionButtonText}>Sell</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.watchlistButton, styles.watchlistButtonActive]}
                        onPress={() => toggleWatchlist(stock.symbol)}
                      >
                        <Text style={[styles.watchlistButtonText, styles.watchlistButtonTextActive]}>
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

      {/* Trade Modal */}
      <Modal visible={showTradeModal} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {tradeType === 'buy' ? 'Buy' : 'Sell'} {selectedStock?.symbol}
            </Text>
            <Text style={[styles.modalSubtitle, settings?.darkMode && styles.modalSubtitleDark]}>
              Current Price: {formatMoney(selectedStock?.currentPrice || 0)}
            </Text>
            
            {/* Input Mode Toggle */}
            <View style={styles.inputModeContainer}>
              <TouchableOpacity
                style={[styles.inputModeButton, inputMode === 'shares' && styles.inputModeButtonActive]}
                onPress={() => setInputMode('shares')}
              >
                <Text style={[styles.inputModeText, settings?.darkMode && styles.inputModeTextDark, inputMode === 'shares' && styles.inputModeTextActive]}>
                  Shares
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.inputModeButton, inputMode === 'money' && styles.inputModeButtonActive]}
                onPress={() => setInputMode('money')}
              >
                <Text style={[styles.inputModeText, settings?.darkMode && styles.inputModeTextDark, inputMode === 'money' && styles.inputModeTextActive]}>
                  Money
                </Text>
              </TouchableOpacity>
            </View>

            {/* Input Row */}
            <View style={styles.inputRow}>
              <View style={styles.inputContainer}>
                <Text style={[styles.inputLabel, settings?.darkMode && styles.inputLabelDark]}>
                  {inputMode === 'shares' ? 'Number of Shares' : 'Amount ($)'}
                </Text>
                <TextInput
                  style={styles.input}
                  value={shares}
                  onChangeText={setShares}
                  placeholder="0"
                  placeholderTextColor={settings?.darkMode ? "#FFFFFF" : "#9CA3AF"}
                  keyboardType="numeric"
                />
              </View>
              <TouchableOpacity style={styles.maxButton} onPress={handleMaxButton}>
                <Text style={styles.maxButtonText}>Max</Text>
              </TouchableOpacity>
            </View>
            
            {shares && !isNaN(Number(shares)) && (
              <Text style={styles.totalText}>
                {inputMode === 'shares' 
                  ? `Total: ${formatMoney(Number(shares) * (selectedStock?.currentPrice || 0))}`
                  : `Shares: ${Math.floor(Number(shares) / (selectedStock?.currentPrice || 1))}`
                }
              </Text>
            )}

            <View style={styles.modalActions}>
              <LoadingButton
                onPress={() => setShowTradeModal(false)}
                title="Cancel"
                variant="secondary"
                size="medium"
                style={styles.modalButton}
              />
              <LoadingButton
                onPress={tradeType === 'buy' ? handleBuy : handleSell}
                title={tradeType === 'buy' ? 'Buy' : 'Sell'}
                loading={tradingLoading}
                variant="primary"
                size="medium"
                style={[styles.modalButton, styles.modalButtonPrimary]}
                loadingText={tradeType === 'buy' ? 'Buying...' : 'Selling...'}
              />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 16,
    paddingHorizontal: 16,
    paddingBottom: 10,
    backgroundColor: '#11131A',
    borderBottomColor: '#1F2230',
    borderBottomWidth: 1,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#1A1D29',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerSpacer: {
    width: 40,
  },
  summaryContainer: {
    padding: 16,
  },
  summaryCard: {
    backgroundColor: '#0F1220',
    borderRadius: 14,
    padding: 16,
    borderColor: '#23283B',
    borderWidth: 1,
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
    color: '#9FA4B3',
    fontSize: 12,
    marginBottom: 4,
  },
  summaryValue: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  positiveText: {
    color: '#10B981',
  },
  negativeText: {
    color: '#EF4444',
  },
  tabContainer: {
    marginHorizontal: 16,
    backgroundColor: '#0F1220',
    borderRadius: 12,
    borderColor: '#23283B',
    borderWidth: 1,
    flexDirection: 'row',
    padding: 10,
    gap: 10,
    marginBottom: 16,
  },
  tab: {
    flex: 1,
    height: 60,
    borderRadius: 10,
    backgroundColor: '#101426',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  activeTab: {
    backgroundColor: '#1E293B',
  },
  tabText: {
    fontSize: 13,
    fontWeight: '700',
  },
  tabTextActive: {
    color: '#FFFFFF',
  },
  tabTextInactive: {
    color: '#6B7280',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 2,
  },
  tabTextInactiveDark: {
    color: '#FFFFFF',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 2,
  },
  content: {
    flex: 1,
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
    backgroundColor: '#0F1220',
    borderRadius: 14,
    padding: 16,
    borderColor: '#23283B',
    borderWidth: 1,
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
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 2,
  },
  stockName: {
    color: '#E7EAF2',
    fontSize: 14,
    marginBottom: 4,
  },
  holdingShares: {
    color: '#9FA4B3',
    fontSize: 12,
  },
  stockPrice: {
    alignItems: 'flex-end',
  },
  priceText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
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
    backgroundColor: '#3B82F6',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 4,
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  watchlistButton: {
    flex: 1,
    backgroundColor: '#1A1D29',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderColor: '#23283B',
    borderWidth: 1,
  },
  watchlistButtonActive: {
    backgroundColor: '#1E293B',
    borderColor: '#3B82F6',
  },
  watchlistButtonText: {
    color: '#9FA4B3',
    fontSize: 12,
    fontWeight: '600',
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
    color: '#9FA4B3',
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 22,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: '#121527',
    borderRadius: 16,
    padding: 20,
    borderColor: '#23283B',
    borderWidth: 1,
  },
  modalTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 4,
    textAlign: 'center',
  },
  modalSubtitle: {
    color: '#9FA4B3',
    fontSize: 14,
    marginBottom: 16,
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 2,
  },
  modalSubtitleDark: {
    color: '#FFFFFF',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 2,
  },
  inputLabel: {
    color: '#9CA3AF',
    fontSize: 12,
    marginBottom: 6,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 2,
  },
  inputLabelDark: {
    color: '#FFFFFF',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 2,
  },
  input: {
    backgroundColor: '#101426',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#E7EAF2',
    borderWidth: 1,
    borderColor: '#2A2D3A',
    marginBottom: 8,
  },
  totalText: {
    color: '#E7EAF2',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 16,
    textAlign: 'center',
  },
  inputModeContainer: {
    flexDirection: 'row',
    backgroundColor: '#1F2937',
    borderRadius: 8,
    padding: 4,
    marginBottom: 16,
  },
  inputModeButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    alignItems: 'center',
  },
  inputModeButtonActive: {
    backgroundColor: '#3B82F6',
  },
  inputModeText: {
    color: '#9CA3AF',
    fontSize: 14,
    fontWeight: '500',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 2,
  },
  inputModeTextDark: {
    color: '#FFFFFF',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 2,
  },
  inputModeTextActive: {
    color: '#FFFFFF',
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
    backgroundColor: '#10B981',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    minWidth: 60,
    alignItems: 'center',
  },
  maxButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    backgroundColor: '#6B7280',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  modalButtonPrimary: {
    backgroundColor: '#3B82F6',
  },
  modalButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 16,
  },

});