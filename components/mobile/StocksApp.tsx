import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Alert, ScrollView, Modal } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowLeft, TrendingUp, TrendingDown, DollarSign, BarChart3, Plus, Minus, RefreshCw } from 'lucide-react-native';
import { useGame } from '@/contexts/GameContext';
import { SkeletonLoader, SkeletonList } from '@/components/ui/SkeletonLoader';
import { EmptyPortfolio } from '@/components/ui/EmptyState';

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



export default function StocksApp({ onBack }: StocksAppProps) {
  const { gameState, setGameState, saveGame, updateMoney } = useGame();
  const { settings } = gameState;
  const [activeTab, setActiveTab] = useState<'market' | 'portfolio' | 'watchlist'>('market');
  const [selectedStock, setSelectedStock] = useState<Stock | null>(null);
  const [shares, setShares] = useState('');
  const [showTradeModal, setShowTradeModal] = useState(false);
  const [tradeType, setTradeType] = useState<'buy' | 'sell'>('buy');
  const [isLoading, setIsLoading] = useState(false);

  const holdings: Holding[] = gameState.stocks?.holdings || [];
  const watchlist: string[] = gameState.stocks?.watchlist || [];
  const cash = gameState.stats?.money || 0;

  const portfolioValue = useMemo(() => {
    return holdings.reduce((total, holding) => {
      const stock = mockStocks.find(s => s.symbol === holding.symbol);
      return total + (holding.shares * (stock?.currentPrice || holding.currentPrice));
    }, 0);
  }, [holdings]);

  const totalInvested = useMemo(() => {
    return holdings.reduce((total, holding) => total + (holding.shares * holding.averagePrice), 0);
  }, [holdings]);

  const portfolioGain = portfolioValue - totalInvested;
  const portfolioGainPercent = totalInvested > 0 ? (portfolioGain / totalInvested) * 100 : 0;

  const handleBuy = useCallback(() => {
    if (!selectedStock || !shares || isNaN(Number(shares)) || Number(shares) <= 0) {
      Alert.alert('Invalid Input', 'Please enter a valid number of shares.');
      return;
    }

    const sharesToBuy = Number(shares);
    const totalCost = sharesToBuy * selectedStock.currentPrice;

    if (totalCost > cash) {
      Alert.alert('Insufficient Funds', `You need $${totalCost.toFixed(2)} but only have $${cash.toFixed(2)}.`);
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
          : h
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

    Alert.alert('Purchase Successful', `Bought ${sharesToBuy} shares of ${selectedStock.symbol} for $${totalCost.toFixed(2)}.`);
    setShowTradeModal(false);
    setShares('');
    setSelectedStock(null);
  }, [selectedStock, shares, cash, holdings, setGameState, saveGame]);

  const handleSell = useCallback(() => {
    if (!selectedStock || !shares || isNaN(Number(shares)) || Number(shares) <= 0) {
      Alert.alert('Invalid Input', 'Please enter a valid number of shares.');
      return;
    }

    const sharesToSell = Number(shares);
    const existingHolding = holdings.find(h => h.symbol === selectedStock.symbol);

    if (!existingHolding || existingHolding.shares < sharesToSell) {
      Alert.alert('Insufficient Shares', `You don't have enough shares of ${selectedStock.symbol}.`);
      return;
    }

    const totalValue = sharesToSell * selectedStock.currentPrice;
    const remainingShares = existingHolding.shares - sharesToSell;

    let newHoldings: Holding[];
    if (remainingShares > 0) {
      newHoldings = holdings.map(h => 
        h.symbol === selectedStock.symbol 
          ? { ...h, shares: remainingShares, currentPrice: selectedStock.currentPrice }
          : h
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

    Alert.alert('Sale Successful', `Sold ${sharesToSell} shares of ${selectedStock.symbol} for $${totalValue.toFixed(2)}.`);
    setShowTradeModal(false);
    setShares('');
    setSelectedStock(null);
  }, [selectedStock, shares, holdings, cash, setGameState, saveGame]);

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
    setShowTradeModal(true);
  };

  const getHoldingShares = (symbol: string) => {
    const holding = holdings.find(h => h.symbol === symbol);
    return holding?.shares || 0;
  };

  const getHoldingValue = (symbol: string) => {
    const holding = holdings.find(h => h.symbol === symbol);
    const stock = mockStocks.find(s => s.symbol === symbol);
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
        <View style={styles.headerSpacer} />
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
                <Text style={styles.summaryValue}>${portfolioValue.toFixed(2)}</Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>Total Gain</Text>
                <Text style={[styles.summaryValue, portfolioGain >= 0 ? styles.positiveText : styles.negativeText]}>
                  {portfolioGain >= 0 ? '+' : ''}${portfolioGain.toFixed(2)} ({portfolioGainPercent >= 0 ? '+' : ''}{portfolioGainPercent.toFixed(2)}%)
                </Text>
              </View>
            </View>
            <View style={styles.summaryRow}>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>Cash</Text>
                <Text style={styles.summaryValue}>${cash.toFixed(2)}</Text>
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
            <BarChart3 size={20} color={activeTab === 'market' ? '#FFFFFF' : '#6B7280'} />
            <Text style={[styles.tabText, activeTab === 'market' ? styles.tabTextActive : styles.tabTextInactive]}>
              Market
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'portfolio' && styles.activeTab]}
            onPress={() => setActiveTab('portfolio')}
          >
            <TrendingUp size={20} color={activeTab === 'portfolio' ? '#FFFFFF' : '#6B7280'} />
            <Text style={[styles.tabText, activeTab === 'portfolio' ? styles.tabTextActive : styles.tabTextInactive]}>
              Portfolio
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'watchlist' && styles.activeTab]}
            onPress={() => setActiveTab('watchlist')}
          >
            <TrendingUp size={20} color={activeTab === 'watchlist' ? '#FFFFFF' : '#6B7280'} />
            <Text style={[styles.tabText, activeTab === 'watchlist' ? styles.tabTextActive : styles.tabTextInactive]}>
              Watchlist
            </Text>
          </TouchableOpacity>
        </View>
        {activeTab === 'market' && (
          <View style={styles.stockList}>
            {mockStocks.map((stock) => (
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
                    <Text style={styles.priceText}>${stock.currentPrice.toFixed(2)}</Text>
                    <Text style={[styles.changeText, stock.change >= 0 ? styles.positiveText : styles.negativeText]}>
                      {stock.change >= 0 ? '+' : ''}{stock.change.toFixed(2)} ({stock.changePercent >= 0 ? '+' : ''}{stock.changePercent.toFixed(2)}%)
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
                const stock = mockStocks.find(s => s.symbol === holding.symbol);
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
                        <Text style={styles.holdingShares}>{holding.shares} shares @ ${holding.averagePrice.toFixed(2)}</Text>
                      </View>
                      <View style={styles.stockPrice}>
                        <Text style={styles.priceText}>${currentValue.toFixed(2)}</Text>
                        <Text style={[styles.changeText, gain >= 0 ? styles.positiveText : styles.negativeText]}>
                          {gain >= 0 ? '+' : ''}{gain.toFixed(2)} ({gainPercent >= 0 ? '+' : ''}{gainPercent.toFixed(2)}%)
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
              mockStocks
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
                        <Text style={styles.priceText}>${stock.currentPrice.toFixed(2)}</Text>
                        <Text style={[styles.changeText, stock.change >= 0 ? styles.positiveText : styles.negativeText]}>
                          {stock.change >= 0 ? '+' : ''}{stock.change.toFixed(2)} ({stock.changePercent >= 0 ? '+' : ''}{stock.changePercent.toFixed(2)}%)
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
            <Text style={styles.modalSubtitle}>
              Current Price: ${selectedStock?.currentPrice.toFixed(2)}
            </Text>
            
            <Text style={styles.inputLabel}>Number of Shares</Text>
            <TextInput
              style={styles.input}
              value={shares}
              onChangeText={setShares}
              placeholder="0"
              placeholderTextColor="#9CA3AF"
              keyboardType="numeric"
            />
            
            {shares && !isNaN(Number(shares)) && (
              <Text style={styles.totalText}>
                Total: ${(Number(shares) * (selectedStock?.currentPrice || 0)).toFixed(2)}
              </Text>
            )}

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalButton}
                onPress={() => setShowTradeModal(false)}
              >
                <Text style={styles.modalButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonPrimary]}
                onPress={tradeType === 'buy' ? handleBuy : handleSell}
              >
                <Text style={styles.modalButtonText}>
                  {tradeType === 'buy' ? 'Buy' : 'Sell'}
                </Text>
              </TouchableOpacity>
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
  },
  inputLabel: {
    color: '#9CA3AF',
    fontSize: 12,
    marginBottom: 6,
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