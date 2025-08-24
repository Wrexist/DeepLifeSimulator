import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Modal, TextInput, useColorScheme, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowLeft, Bitcoin, Zap, DollarSign, TrendingUp, TrendingDown, Cpu, Activity } from 'lucide-react-native';
import { useGame } from '@/contexts/GameContext';

const { width: screenWidth } = Dimensions.get('window');

interface BitcoinMiningAppProps {
  onBack: () => void;
}

interface Miner {
  id: string;
  name: string;
  price: number;
  weeklyEarnings: number;
  powerConsumption: number;
  owned: number;
}

interface Crypto {
  id: string;
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  owned: number;
}

export default function BitcoinMiningApp({ onBack }: BitcoinMiningAppProps) {
  const { gameState, updateStats, buyCrypto, sellCrypto, swapCrypto, buyMiner, selectMiningCrypto, setGameState } = useGame();
  const [activeTab, setActiveTab] = useState<'miners' | 'crypto'>('miners');
  const [selectedStock, setSelectedStock] = useState<Crypto | null>(null);
  const isDarkMode = useColorScheme() === 'dark';
  const [investAmount, setInvestAmount] = useState('');
  const [showInvestModal, setShowInvestModal] = useState(false);
  const [swapFrom, setSwapFrom] = useState<Crypto | null>(null);
  const [swapTo, setSwapTo] = useState<Crypto | null>(null);
  const [swapAmount, setSwapAmount] = useState('');
  const [showSwapModal, setShowSwapModal] = useState(false);
  const [sellCryptoItem, setSellCryptoItem] = useState<Crypto | null>(null);
  const [sellAmount, setSellAmount] = useState('');
  const [showSellModal, setShowSellModal] = useState(false);

  const miners: Miner[] = [
    { id: 'basic', name: 'Basic Miner', price: 500, weeklyEarnings: 88, powerConsumption: 10, owned: 0 },
    { id: 'advanced', name: 'Advanced Miner', price: 2000, weeklyEarnings: 420, powerConsumption: 35, owned: 0 },
    { id: 'pro', name: 'Pro Miner', price: 8000, weeklyEarnings: 1750, powerConsumption: 100, owned: 0 },
    { id: 'industrial', name: 'Industrial Miner', price: 25000, weeklyEarnings: 6300, powerConsumption: 250, owned: 0 },
    { id: 'quantum', name: 'Quantum Miner', price: 100000, weeklyEarnings: 28000, powerConsumption: 500, owned: 0 },
  ];

  const handleInvest = () => {
    if (!selectedStock) return;
    
    const amount = parseFloat(investAmount);
    if (isNaN(amount) || amount <= 0 || amount > gameState.stats.money) {
      Alert.alert('Invalid Amount', 'Please enter a valid amount within your budget.');
      return;
    }

    buyCrypto(selectedStock.id, amount);
    
    Alert.alert(
      'Investment Successful',
      `You bought ${(amount / selectedStock.price).toFixed(6)} ${selectedStock.symbol}`
    );
    
    setShowInvestModal(false);
    setSelectedStock(null);
    setInvestAmount('');
  };

  const handleSellCryptoPress = (crypto: Crypto) => {
    setSellCryptoItem(crypto);
    setSellAmount('');
    setShowSellModal(true);
  };

  const confirmSellCrypto = () => {
    if (!sellCryptoItem) return;
    const amountNum = parseFloat(sellAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid amount to sell.');
      return;
    }

    const units = amountNum / sellCryptoItem.price;
    if (units > sellCryptoItem.owned) {
      Alert.alert('Not Enough Crypto', 'You do not own that much to sell.');
      return;
    }

    sellCrypto(sellCryptoItem.id, units);
    Alert.alert('Sold!', `Sold ${units.toFixed(6)} ${sellCryptoItem.symbol}`);

    setShowSellModal(false);
    setSellCryptoItem(null);
    setSellAmount('');
  };

  const confirmSellAllCrypto = () => {
    if (!sellCryptoItem) return;
    sellCrypto(sellCryptoItem.id, sellCryptoItem.owned);
    Alert.alert('Sold!', `Sold all ${sellCryptoItem.symbol}`);
    setShowSellModal(false);
    setSellCryptoItem(null);
    setSellAmount('');
  };

  const handleSwap = () => {
    if (!swapFrom || !swapTo) return;

    const amountNum = parseFloat(swapAmount);
    if (isNaN(amountNum) || amountNum <= 0 || amountNum > swapFrom.owned) {
      Alert.alert('Invalid Amount', 'Please enter a valid amount within your holdings.');
      return;
    }

    const toShares = (amountNum * swapFrom.price) / swapTo.price;
    swapCrypto(swapFrom.id, swapTo.id, amountNum);

    Alert.alert(
      'Swap Complete',
      `Swapped ${amountNum.toFixed(4)} ${swapFrom.symbol} for ${toShares.toFixed(4)} ${swapTo.symbol}`
    );

    setShowSwapModal(false);
    setSwapFrom(null);
    setSwapTo(null);
    setSwapAmount('');
  };

  const totalWeeklyEarnings = miners.reduce((total, miner) => {
    const owned = gameState.company?.miners[miner.id] || 0;
    return total + (miner.weeklyEarnings * owned);
  }, 0);
  const totalPowerConsumption = miners.reduce((total, miner) => {
    const owned = gameState.company?.miners[miner.id] || 0;
    return total + (miner.powerConsumption * owned);
  }, 0);

  const handleSelectCrypto = (cryptoId: string) => {
    // Initialize company if it doesn't exist
    if (!gameState.company) {
      const newCompany = {
        id: 'mining',
        name: 'Mining Company',
        type: 'factory' as const,
        weeklyIncome: 0,
        baseWeeklyIncome: 0,
        upgrades: [],
        employees: 1,
        workerSalary: 0,
        workerMultiplier: 1.1,
        marketingLevel: 1,
        selectedCrypto: cryptoId,
        miners: {},
      };
      setGameState(prev => ({
        ...prev,
        companies: [...prev.companies, newCompany],
        company: newCompany,
      }));
    } else {
      selectMiningCrypto(cryptoId);
    }
  };

  const handleBuyMiner = (minerId: string) => {
    const miner = miners.find(m => m.id === minerId);
    if (!miner || gameState.stats.money < miner.price) {
      Alert.alert('Cannot Purchase', 'Insufficient funds to buy this miner.');
      return;
    }

    // Initialize company if it doesn't exist
    if (!gameState.company) {
      const newCompany = {
        id: 'mining',
        name: 'Mining Company',
        type: 'factory' as const,
        weeklyIncome: 0,
        baseWeeklyIncome: 0,
        upgrades: [],
        employees: 1,
        workerSalary: 0,
        workerMultiplier: 1.1,
        marketingLevel: 1,
        miners: { [minerId]: 1 },
      };
      setGameState(prev => ({
        ...prev,
        companies: [...prev.companies, newCompany],
        company: newCompany,
      }));
      updateStats({ money: gameState.stats.money - miner.price });
    } else {
      buyMiner(minerId);
    }

    Alert.alert('Miner Purchased', `You bought a ${miner.name}!`);
  };

  const renderMinerCard = (miner: Miner) => {
    const owned = gameState.company?.miners[miner.id] || 0;
    const canAfford = gameState.stats.money >= miner.price;
    
    return (
      <View key={miner.id} style={styles.minerCard}>
        <LinearGradient
          colors={['#1F2937', '#111827']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.minerCardGradient}
        >
          <View style={styles.minerHeader}>
            <View style={styles.minerInfo}>
              <Text style={styles.minerName}>{miner.name}</Text>
              <View style={styles.minerStats}>
                <View style={styles.minerStat}>
                  <DollarSign size={16} color="#10B981" />
                  <Text style={styles.minerStatText}>${miner.weeklyEarnings}/week</Text>
                </View>
                <View style={styles.minerStat}>
                  <Zap size={16} color="#F59E0B" />
                  <Text style={styles.minerStatText}>{miner.powerConsumption}W</Text>
                </View>
              </View>
            </View>
            <View style={styles.minerPrice}>
              <Text style={styles.minerPriceText}>${miner.price.toLocaleString()}</Text>
            </View>
          </View>

          <View style={styles.minerOwned}>
            <Text style={styles.minerOwnedText}>Owned: {owned}</Text>
            <Text style={styles.minerEarningsText}>
              Earnings: ${(miner.weeklyEarnings * owned).toLocaleString()}/week
            </Text>
          </View>

          <TouchableOpacity
            style={styles.buyButton}
            onPress={() => handleBuyMiner(miner.id)}
            disabled={!canAfford}
          >
            <LinearGradient
              colors={canAfford ? ['#3B82F6', '#1D4ED8'] : ['#6B7280', '#4B5563']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.buyButtonGradient}
            >
              <Cpu size={16} color="#FFFFFF" />
              <Text style={styles.buyButtonText}>
                {canAfford ? 'Purchase Miner' : 'Insufficient Funds'}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        </LinearGradient>
      </View>
    );
  };

  const renderCryptoCard = (crypto: Crypto) => {
    const isSelected = gameState.company?.selectedCrypto === crypto.id;
    const changeColor = crypto.change >= 0 ? '#10B981' : '#EF4444';
    const changeIcon = crypto.change >= 0 ? TrendingUp : TrendingDown;
    
    return (
      <View key={crypto.id} style={styles.cryptoCard}>
        <LinearGradient
          colors={isSelected ? ['#10B981', '#059669'] : ['#1F2937', '#111827']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.cryptoCardGradient}
        >
          <View style={styles.cryptoHeader}>
            <View style={styles.cryptoInfo}>
              <Text style={styles.cryptoSymbol}>{crypto.symbol}</Text>
              <Text style={styles.cryptoName}>{crypto.name}</Text>
            </View>
            <View style={styles.cryptoPrice}>
              <Text style={styles.cryptoPriceText}>${crypto.price.toLocaleString()}</Text>
              <View style={styles.cryptoChange}>
                {crypto.change >= 0 ? (
                  <TrendingUp size={14} color={changeColor} />
                ) : (
                  <TrendingDown size={14} color={changeColor} />
                )}
                <Text style={[styles.cryptoChangeText, { color: changeColor }]}>
                  {crypto.changePercent.toFixed(2)}%
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.cryptoHoldings}>
            <Text style={styles.cryptoHoldingsText}>
              Owned: {crypto.owned.toFixed(6)} {crypto.symbol}
            </Text>
            <Text style={styles.cryptoValueText}>
              Value: ${(crypto.owned * crypto.price).toLocaleString()}
            </Text>
          </View>

          <View style={styles.cryptoActions}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => {
                setSelectedStock(crypto);
                setInvestAmount('');
                setShowInvestModal(true);
              }}
            >
              <LinearGradient
                colors={['#3B82F6', '#1D4ED8']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.actionButtonGradient}
              >
                <Text style={styles.actionButtonText}>Buy</Text>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => handleSellCryptoPress(crypto)}
            >
              <LinearGradient
                colors={['#EF4444', '#DC2626']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.actionButtonGradient}
              >
                <Text style={styles.actionButtonText}>Sell</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </LinearGradient>
      </View>
    );
  };

  const renderMiningSelection = () => {
    if (!gameState.company) {
      return (
        <View style={styles.miningSelectionContainer}>
          <Text style={styles.miningSelectionTitle}>Select Cryptocurrency to Mine:</Text>
          <View style={styles.cryptoOptions}>
            {gameState.cryptos.slice(0, 4).map(crypto => (
              <TouchableOpacity
                key={crypto.id}
                style={styles.cryptoOption}
                onPress={() => handleSelectCrypto(crypto.id)}
              >
                <LinearGradient
                  colors={['#3B82F6', '#1D4ED8']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.cryptoOptionGradient}
                >
                  <Text style={styles.cryptoOptionText}>{crypto.symbol}</Text>
                </LinearGradient>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.miningSelectionNote}>
            Choose a cryptocurrency to start mining. You'll need to buy miners first.
          </Text>
        </View>
      );
    }

    const selectedCrypto = gameState.cryptos.find(c => c.id === gameState.company?.selectedCrypto);
    return (
      <View style={styles.miningSelectionContainer}>
        <Text style={styles.miningSelectionTitle}>Currently Mining:</Text>
        <View style={styles.currentMiningContainer}>
          <LinearGradient
            colors={['#10B981', '#059669']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.currentMiningGradient}
          >
            <Text style={styles.currentMiningText}>
              {selectedCrypto ? selectedCrypto.symbol : 'None Selected'}
            </Text>
          </LinearGradient>
        </View>
        <Text style={styles.miningSelectionNote}>
          Change mining target:
        </Text>
        <View style={styles.cryptoOptions}>
          {gameState.cryptos.slice(0, 4).map(crypto => (
            <TouchableOpacity
              key={crypto.id}
              style={styles.cryptoOption}
              onPress={() => handleSelectCrypto(crypto.id)}
            >
              <LinearGradient
                colors={gameState.company?.selectedCrypto === crypto.id ? ['#10B981', '#059669'] : ['#3B82F6', '#1D4ED8']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.cryptoOptionGradient}
              >
                <Text style={styles.cryptoOptionText}>{crypto.symbol}</Text>
              </LinearGradient>
            </TouchableOpacity>
          ))}
        </View>
        {selectedCrypto && (
          <View style={styles.miningEarnings}>
            <Text style={styles.miningEarningsText}>
              Weekly Mining: {(totalWeeklyEarnings / selectedCrypto.price).toFixed(6)} {selectedCrypto.symbol}
            </Text>
            <Text style={styles.miningEarningsValue}>
              (≈ ${totalWeeklyEarnings.toLocaleString()})
            </Text>
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <LinearGradient
            colors={['#374151', '#1F2937']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.backButtonGradient}
          >
            <ArrowLeft size={24} color="#FFFFFF" />
          </LinearGradient>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Bitcoin Mining</Text>
        <View style={styles.placeholder} />
      </View>

      <View style={styles.summaryContainer}>
        <LinearGradient
          colors={['#1F2937', '#111827']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.summaryCard}
        >
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <DollarSign size={20} color="#10B981" />
              <Text style={styles.summaryLabel}>Weekly Earnings</Text>
              <Text style={styles.summaryValue}>${totalWeeklyEarnings.toLocaleString()}</Text>
            </View>
            <View style={styles.summaryItem}>
              <Zap size={20} color="#F59E0B" />
              <Text style={styles.summaryLabel}>Power Usage</Text>
              <Text style={styles.summaryValue}>{totalPowerConsumption}W</Text>
            </View>
            <View style={styles.summaryItem}>
              <Bitcoin size={20} color="#F7931A" />
              <Text style={styles.summaryLabel}>Mining</Text>
              <Text style={styles.summaryValue}>
                {gameState.company?.selectedCrypto ? gameState.cryptos.find(c => c.id === gameState.company?.selectedCrypto)?.symbol : 'None'}
              </Text>
            </View>
          </View>
        </LinearGradient>
      </View>

      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'miners' && styles.activeTab]}
          onPress={() => setActiveTab('miners')}
        >
          <LinearGradient
            colors={activeTab === 'miners' ? ['#3B82F6', '#1D4ED8'] : ['#374151', '#1F2937']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.tabGradient}
          >
            <Cpu size={16} color="#FFFFFF" />
            <Text style={styles.tabText}>Miners</Text>
          </LinearGradient>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'crypto' && styles.activeTab]}
          onPress={() => setActiveTab('crypto')}
        >
          <LinearGradient
            colors={activeTab === 'crypto' ? ['#3B82F6', '#1D4ED8'] : ['#374151', '#1F2937']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.tabGradient}
          >
            <Bitcoin size={16} color="#FFFFFF" />
            <Text style={styles.tabText}>Cryptocurrency</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.itemsContainer}>
          {activeTab === 'miners' 
            ? (
              <>
                {renderMiningSelection()}
                {miners.map(renderMinerCard)}
              </>
            )
            : gameState.cryptos.map(renderCryptoCard)
          }
        </View>
      </ScrollView>

      {/* Investment Modal */}
      <Modal visible={showInvestModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <LinearGradient
            colors={['#1F2937', '#111827']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.modalContent}
          >
            <Text style={styles.modalTitle}>Invest in {selectedStock?.symbol}</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Amount to invest"
              placeholderTextColor="#9CA3AF"
              value={investAmount}
              onChangeText={setInvestAmount}
              keyboardType="numeric"
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalButton}
                onPress={() => setShowInvestModal(false)}
              >
                <LinearGradient
                  colors={['#6B7280', '#4B5563']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.modalButtonGradient}
                >
                  <Text style={styles.modalButtonText}>Cancel</Text>
                </LinearGradient>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalButton}
                onPress={handleInvest}
              >
                <LinearGradient
                  colors={['#3B82F6', '#1D4ED8']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.modalButtonGradient}
                >
                  <Text style={styles.modalButtonText}>Invest</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </LinearGradient>
        </View>
      </Modal>

      {/* Sell Modal */}
      <Modal visible={showSellModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <LinearGradient
            colors={['#1F2937', '#111827']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.modalContent}
          >
            <Text style={styles.modalTitle}>Sell {sellCryptoItem?.symbol}</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Amount to sell"
              placeholderTextColor="#9CA3AF"
              value={sellAmount}
              onChangeText={setSellAmount}
              keyboardType="numeric"
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalButton}
                onPress={() => setShowSellModal(false)}
              >
                <LinearGradient
                  colors={['#6B7280', '#4B5563']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.modalButtonGradient}
                >
                  <Text style={styles.modalButtonText}>Cancel</Text>
                </LinearGradient>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalButton}
                onPress={confirmSellCrypto}
              >
                <LinearGradient
                  colors={['#EF4444', '#DC2626']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.modalButtonGradient}
                >
                  <Text style={styles.modalButtonText}>Sell</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </LinearGradient>
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
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 20,
  },
  backButton: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  backButtonGradient: {
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  placeholder: {
    width: 48,
  },
  summaryContainer: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  summaryCard: {
    padding: 20,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  summaryItem: {
    alignItems: 'center',
    flex: 1,
  },
  summaryLabel: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 4,
    marginBottom: 2,
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 20,
    gap: 12,
  },
  tab: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  activeTab: {
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  tabGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 8,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  itemsContainer: {
    gap: 16,
    paddingBottom: 40,
  },
  minerCard: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  minerCardGradient: {
    padding: 20,
  },
  minerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  minerInfo: {
    flex: 1,
  },
  minerName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  minerStats: {
    flexDirection: 'row',
    gap: 16,
  },
  minerStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  minerStatText: {
    fontSize: 14,
    color: '#D1D5DB',
  },
  minerPrice: {
    alignItems: 'flex-end',
  },
  minerPriceText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#F7931A',
  },
  minerOwned: {
    marginBottom: 16,
  },
  minerOwnedText: {
    fontSize: 14,
    color: '#9CA3AF',
    marginBottom: 2,
  },
  minerEarningsText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#10B981',
  },
  cryptoCard: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  cryptoCardGradient: {
    padding: 20,
  },
  cryptoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  cryptoInfo: {
    flex: 1,
  },
  cryptoSymbol: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  cryptoName: {
    fontSize: 14,
    color: '#E5E7EB',
  },
  cryptoPrice: {
    alignItems: 'flex-end',
  },
  cryptoPriceText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#F7931A',
    marginBottom: 4,
  },
  cryptoChange: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  cryptoChangeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  cryptoHoldings: {
    marginBottom: 16,
  },
  cryptoHoldingsText: {
    fontSize: 14,
    color: '#E5E7EB',
    marginBottom: 2,
  },
  cryptoValueText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#10B981',
  },
  cryptoActions: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  actionButton: {
    flex: 1,
    borderRadius: 8,
    overflow: 'hidden',
  },
  actionButtonGradient: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  actionButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  selectedBadge: {
    backgroundColor: '#10B981',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  selectedText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  buyButton: {
    borderRadius: 8,
    overflow: 'hidden',
  },
  buyButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 6,
  },
  buyButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 400,
    padding: 24,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 20,
    textAlign: 'center',
  },
  modalInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#FFFFFF',
    marginBottom: 20,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    borderRadius: 8,
    overflow: 'hidden',
  },
  modalButtonGradient: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  modalButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  miningSelectionContainer: {
    backgroundColor: '#1F2937',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  miningSelectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  cryptoOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-around',
    gap: 8,
    marginBottom: 16,
  },
  cryptoOption: {
    width: '48%', // Adjust as needed for 2 columns
    borderRadius: 8,
    overflow: 'hidden',
  },
  cryptoOptionGradient: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  cryptoOptionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  miningSelectionNote: {
    fontSize: 12,
    color: '#E5E7EB',
    marginBottom: 12,
  },
  currentMiningContainer: {
    backgroundColor: '#1F2937',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  currentMiningGradient: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  currentMiningText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  miningEarnings: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  miningEarningsText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#10B981',
  },
  miningEarningsValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#E5E7EB',
  },
});